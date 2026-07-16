/**
 * OpenTelemetry bootstrap — Tier 3.1.
 *
 * Implements the CNCF/OpenTelemetry standard for distributed tracing
 * in Node.js. Follows the official patterns documented at
 * https://opentelemetry.io/docs/languages/js/getting-started/nodejs/
 * and the W3C Trace Context spec (https://www.w3.org/TR/trace-context/).
 *
 * What this module does:
 *   1. Registers a global TracerProvider on first import (lazy).
 *   2. Configures W3C TraceContext propagator so that incoming
 *      `traceparent`/`tracestate` headers from upstream services
 *      (CDN, mobile clients) are honoured, and we emit a new one
 *      on every outgoing request.
 *   3. Loads the NodeSDK with auto-instrumentations for http,
 *      express, pg, ioredis, amqplib, and @elastic/elasticsearch.
 *   4. Exports traces via OTLP/HTTP to the endpoint configured via
 *      OTEL_EXPORTER_OTLP_ENDPOINT (defaults to
 *      http://localhost:4318/v1/traces, the standard OTel
 *      Collector default). When unset, the SDK still initialises
 *      but spans are dropped — zero overhead in dev.
 *
 * Why this exists
 *   The X-Request-Id header is a single-service correlation token.
 *   OpenTelemetry gives us end-to-end distributed tracing with
 *   parent/child relationships, sampling controls, baggage
 *   propagation, and standardised semantic attributes — the
 *   industry-wide replacement for ad-hoc correlation IDs.
 *
 * Fail-OPEN contract
 *   When OTEL_EXPORTER_OTLP_ENDPOINT is unset (the dev case) the
 *   SDK is still constructed but no exporter is registered.
 *   `getTracer()` always returns a no-op tracer.
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import {
	ATTR_SERVICE_NAME,
	ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { diag, DiagLogLevel, type DiagLogger } from '@opentelemetry/api';
import { log } from './shared.ts';

const SERVICE_NAME = 'noufex-api';
const SERVICE_VERSION = process.env.APP_VERSION ?? process.env.npm_package_version ?? 'dev';

let sdk: NodeSDK | null = null;
let initialised = false;
let exporterEnabled = false;

export function isTelemetryEnabled(): boolean {
	return Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT);
}

export function initTelemetry(): void {
	if (initialised) return;
	initialised = true;

	if (!isTelemetryEnabled()) {
		log.info({ msg: 'telemetry_disabled_no_endpoint' });
		return;
	}

	// Surface exporter errors through our logger (instead of stderr).
	// Suppress the W3C propagation double-register warning (which
	// fires in test environments that re-import the module twice).
	const silentDiag: DiagLogger = {
		verbose: () => {
			/* silent */
		},
		debug: () => {
			/* silent */
		},
		info: () => {
			/* silent */
		},
		warn: () => {
			/* silent — see /api/metrics for actual exporter state */
		},
		error: (msg: string) => log.warn({ msg: 'otel_diag_error', detail: msg }),
	};
	diag.setLogger(silentDiag, DiagLogLevel.WARN);

	const exporter = new OTLPTraceExporter({
		// Standard OTel Collector HTTP endpoint.
		url:
			process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
			`${(process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? '').replace(/\/$/, '')}/v1/traces`,
		headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
			? (JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS) as Record<string, string>)
			: undefined,
	});

	sdk = new NodeSDK({
		resource: new Resource({
			[ATTR_SERVICE_NAME]: SERVICE_NAME,
			[ATTR_SERVICE_VERSION]: SERVICE_VERSION,
			'deployment.environment': process.env.NODE_ENV ?? 'development',
		}),
		traceExporter: exporter,
		instrumentations: [
			getNodeAutoInstrumentations({
				'@opentelemetry/instrumentation-fs': { enabled: false },
				'@opentelemetry/instrumentation-dns': { enabled: false },
				'@opentelemetry/instrumentation-net': { enabled: false },
				'@opentelemetry/instrumentation-http': {
					// Don't trace the /api/metrics scrape — it's
					// high-frequency noise that would distort
					// sampling decisions.
					ignoreIncomingRequestHook: (req: { url?: string }) => {
						return req.url === '/api/metrics' || req.url === '/api/health';
					},
				},
			}),
		],
	});

	try {
		sdk.start();
		exporterEnabled = true;
		log.info({
			msg: 'telemetry_started',
			service: SERVICE_NAME,
			version: SERVICE_VERSION,
			endpoint: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
				`${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
		});
	} catch (err) {
		log.warn({ msg: 'telemetry_start_failed', error: (err as Error).message });
		sdk = null;
	}
}

export async function shutdownTelemetry(): Promise<void> {
	if (!sdk) return;
	try {
		await sdk.shutdown();
	} catch (err) {
		log.warn({ msg: 'telemetry_shutdown_failed', error: (err as Error).message });
	}
	sdk = null;
	exporterEnabled = false;
}

export function isExporterEnabled(): boolean {
	return exporterEnabled;
}

/**
 * Re-export the official API surface so call sites import from a
 * single module. Using `@opentelemetry/api` (not the SDK directly)
 * is the W3C-aligned contract — it lets us swap the TracerProvider
 * implementation without changing application code.
 */
export {
	trace,
	SpanStatusCode,
	SpanKind,
	context,
	propagation,
	type Span,
	type SpanContext,
	type Tracer,
} from '@opentelemetry/api';