# alertmanager-sentry-relay — Dockerfile

Build context: `cloudflare/observability/alertmanager-sentry-relay/`

```dockerfile
FROM golang:1.23-alpine AS build
WORKDIR /src
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /relay .

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /relay /relay
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/relay"]
```

## Deployment

```yaml
# cloudflare/observability/k8s/alertmanager-sentry-relay.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: alertmanager-sentry-relay
  namespace: noufex-ops
spec:
  replicas: 1
  selector:
    matchLabels:
      app: alertmanager-sentry-relay
  template:
    metadata:
      labels:
        app: alertmanager-sentry-relay
    spec:
      containers:
        - name: relay
          image: ghcr.io/noufex/alertmanager-sentry-relay:latest
          env:
            - name: ADDR
              value: ":8080"
            - name: DEDUP_WINDOW
              value: "10m"
            - name: ALERTMANAGER_WEBHOOK_URL
              value: "http://alertmanager.observability:9093/api/v1/alerts"
          ports:
            - containerPort: 8080
          readinessProbe:
            httpGet: { path: /ready, port: 8080 }
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet: { path: /health, port: 8080 }
            initialDelaySeconds: 10
            periodSeconds: 20
          resources:
            requests: { cpu: 10m, memory: 32Mi }
            limits:   { cpu: 50m, memory: 64Mi }
---
apiVersion: v1
kind: Service
metadata:
  name: alertmanager-sentry-relay
  namespace: noufex-ops
spec:
  selector:
    app: alertmanager-sentry-relay
  ports:
    - port: 8080
      targetPort: 8080
```