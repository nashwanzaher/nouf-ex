// alertmanager-sentry-relay
//
// Reference implementation: a thin HTTP server that translates
// Sentry webhook payloads into Prometheus AlertManager v2 alerts.
// Production deployment wraps this in a container — see
// cloudflare/observability/Dockerfile for the build.
//
// This file is Go for a single-binary deploy + low memory
// footprint. It is NOT compiled by the Noufex API; it lives
// under cloudflare/observability/ as infrastructure-as-code.

package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/prometheus/alertmanager/template"
)

// SentryWebhookEvent — subset of the Sentry webhook payload that
// we forward to AlertManager. See
// https://docs.sentry.io/api/webhooks/ for the full schema.
type SentryWebhookEvent struct {
	Action     string `json:"action"`
	Level      string `json:"level"`
	Title      string `json:"title"`
	Message    string `json:"message"`
	Project    string `json:"project"`
	Environment string `json:"environment"`
	Release    string `json:"release"`
	Fingerprint []string `json:"fingerprint"`
	URL        string `json:"url"`
}

// AlertManagerAlert — the shape we POST to the webhook receiver.
// Matches the official Prometheus AlertManager webhook_config
// schema: https://prometheus.io/docs/alerting/latest/configuration/#webhook_config
type AlertManagerAlert struct {
	Status       string            `json:"status"` // "firing" or "resolved"
	Labels       map[string]string `json:"labels"`
	Annotations  map[string]string `json:"annotations"`
	StartsAt     time.Time         `json:"startsAt"`
	EndsAt       time.Time         `json:"endsAt,omitempty"`
	GeneratorURL string            `json:"generatorURL"`
}

// AlertManagerWebhookPayload — top-level wrapper required by
// AlertManager's webhook_config.
type AlertManagerWebhookPayload struct {
	Version         string             `json:"version"`
	GroupKey        string             `json:"groupKey"`
	Status          string             `json:"status"`
	Receiver        string             `json:"receiver"`
	GroupLabels     map[string]string  `json:"groupLabels"`
	CommonLabels    map[string]string  `json:"commonLabels"`
	CommonAnnotations map[string]string `commonAnnotations,string"`
	ExternalURL     string             `json:"externalURL"`
	Alerts          []AlertManagerAlert `json:"alerts"`
}

func main() {
	addr := os.Getenv("ADDR")
	if addr == "" {
		addr = ":8080"
	}
	dedup := os.Getenv("DEDUP_WINDOW")
	if dedup == "" {
		dedup = "10m"
	}
	webhookURL := os.Getenv("ALERTMANAGER_WEBHOOK_URL")

	// In-memory dedup store: fingerprint → last-seen timestamp.
	dedupStore := make(map[string]time.Time)

	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		_, _ = w.Write([]byte("ok"))
	})
	mux.HandleFunc("/ready", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		_, _ = w.Write([]byte("ready"))
	})
	mux.HandleFunc("/sentry-webhook", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", 405)
			return
		}
		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "bad request", 400)
			return
		}
		var event SentryWebhookEvent
		if err := json.Unmarshal(body, &event); err != nil {
			http.Error(w, "invalid JSON", 400)
			return
		}

		// Skip "resolved" events that we haven't seen recently —
		// AlertManager treats them as auto-resolve.
		if event.Action == "deleted" || event.Level == "info" {
			w.WriteHeader(204)
			return
		}

		fp := event.Fingerprint[0]
		if fp == "" {
			fp = fmt.Sprintf("%s-%s", event.Project, event.Title)
		}

		// Dedup window: skip if we saw this fingerprint within
		// the configured window.
		if last, ok := dedupStore[fp]; ok && time.Since(last) < parseDuration(dedup) {
			w.WriteHeader(204)
			return
		}
		dedupStore[fp] = time.Now()

		// Translate Sentry level → AlertManager severity.
		severity := "warn"
		switch event.Level {
		case "error", "fatal":
			severity = "page"
		}

		// Build the AlertManager payload.
		alert := AlertManagerAlert{
			Status: "firing",
			Labels: map[string]string{
				"alertname":   fmt.Sprintf("Sentry%s", event.Title),
				"severity":    severity,
				"team":        "noufex-platform",
				"project":     event.Project,
				"environment": event.Environment,
				"release":     event.Release,
				"fingerprint": fp,
			},
			Annotations: map[string]string{
				"summary":     event.Title,
				"description": truncate(event.Message, 1024),
				"sentry_url":  event.URL,
			},
			StartsAt: time.Now(),
		}
		payload := AlertManagerWebhookPayload{
			Version:         "4",
			Status:          "firing",
			Receiver:        "sentry-relay",
			GroupLabels:     alert.Labels,
			CommonLabels:    alert.Labels,
			CommonAnnotations: alert.Annotations,
			ExternalURL:     "https://noufex.com",
			Alerts:          []AlertManagerAlert{alert},
		}

		// Forward to AlertManager.
		body, _ = json.Marshal(payload)
		req, _ := http.NewRequest("POST", webhookURL, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			http.Error(w, fmt.Sprintf("forward failed: %v", err), 502)
			return
		}
		defer resp.Body.Close()
		w.WriteHeader(204)
	})

	_ = template.FromGlobs // keep import
	fmt.Printf("alertmanager-sentry-relay listening on %s\n", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		fmt.Fprintf(os.Stderr, "fatal: %v\n", err)
		os.Exit(1)
	}
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n-1] + "…"
}

func parseDuration(s string) time.Duration {
	d, err := time.ParseDuration(s)
	if err != nil {
		return 10 * time.Minute
	}
	return d
}