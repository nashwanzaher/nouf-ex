/**
 * HTTP tracing middleware — Tier 3.1.
 *
 * Wires OpenTelemetry HTTP instrumentation into the Express
 * pipeline. The auto-instrumentations already inject an inbound
 * span, but this layer:
 *   1. Extracts the W3C `traceparent` header from the incoming
 *      request and binds it to the active context.
 *   2. Tags every request span with `http.route` (the matched
 *      Express route pattern, not the literal URL — prevents
 *      cardinality explosion) and `noufex.request_id` so we keep
 *      the X-Request-Id correlation that operators already query.
 *   3. Pairs with the log() helper so every request_log line
 *      carries the OTel trace_id / span_id.
 *
 * The OTLP exporter then ships the spans to the configured
 * collector (Tempo, Jaeger, Honeycomb, Datadog, etc.).
 */
import type { Request, Response, NextFunction } from 'express';
import {
	trace,
	context,
	propagation,
	SpanKind,
	SpanStatusCode,
} from '@opentelemetry/api';
import { log } from './shared.ts';

const TRACER_NAME = 'noufex.http';

export function httpTracingMiddleware() {
	return (req: Request, res: Response, next: NextFunction): void => {
		// The auto-instrumentation-http package has already started
		// an inbound span keyed by the traceparent header (if
		// present). We re-derive the active context to attach
		// correlation tags + log linkage.
		const tracer = trace.getTracer(TRACER_NAME);
		// Baggage / propagation context (W3C trace context + W3C
		// baggage) — lets an upstream service flag every span in
		// this request as belonging to, say, `user.id=42`.
		const carrier = {
			traceparent: req.header('traceparent') ?? '',
			tracestate: req.header('tracestate') ?? '',
			'x-request-id': req.id ?? '',
		};
		const extractedCtx = propagation.extract(context.active(), carrier);

		const expressRoute =
		(req.route?.path as string | undefined) ||
		(req.baseUrl ?? '') + (req.route?.path ?? '') ||
		(req.path.split('?')[0] ?? '');

		const span = tracer.startSpan(
			`${req.method} ${expressRoute}`,
			{
				kind: SpanKind.SERVER,
				attributes: {
					'http.method': req.method,
					'http.route': expressRoute,
					'http.url': req.originalUrl,
					'http.scheme': req.protocol,
					'http.host': req.headers.host ?? '',
					'http.user_agent': req.headers['user-agent'] ?? '',
					'noufex.request_id': req.id ?? '',
				},
			},
			extractedCtx,
		);

		// Stash the span on res.locals so downstream handlers can
		// add custom attributes (DB query latency, cache hit/miss…).
		(res as Response & { __otelSpan?: ReturnType<typeof tracer.startSpan> }).__otelSpan = span;

		const startNs = process.hrtime.bigint();
		res.on('finish', () => {
			const durationMs = Number(process.hrtime.bigint() - startNs) / 1e6;
			span.setAttribute('http.status_code', res.statusCode);
			span.setAttribute('http.response_content_length', Number(res.getHeader('content-length') ?? 0));
			if (res.statusCode >= 500) {
				span.setStatus({ code: SpanStatusCode.ERROR, message: `HTTP ${res.statusCode}` });
			} else {
				span.setStatus({ code: SpanStatusCode.OK });
			}
			// Emit an end-event on the carrier span so logs ordered
			// by trace_id can find the matching span. The auto-
			// instrumentation already ends its own span; this is
			// just for our manual child span.
			span.end();

			log.debug({
				msg: 'request_completed',
				request_id: req.id,
				trace_id: span.spanContext().traceId,
				span_id: span.spanContext().spanId,
				method: req.method,
				route: expressRoute,
				status: res.statusCode,
				duration_ms: Math.round(durationMs),
			});
		});
		void context.with(trace.setSpan(extractedCtx, span), () => next());
	};
}

/** Allow route handlers to attach attributes to the active span. */
export function recordSpanAttribute(key: string, value: string | number | boolean): void {
	const span = trace.getActiveSpan();
	if (span) span.setAttribute(key, value);
}

/** Mark the active span as failed (e.g. from a catch block). */
export function recordSpanError(err: unknown): void {
	const span = trace.getActiveSpan();
	if (!span) return;
	const message = err instanceof Error ? err.message : String(err);
	span.recordException(err instanceof Error ? err : new Error(message));
	span.setStatus({ code: SpanStatusCode.ERROR, message });
}

export function getCurrentTraceId(): string | undefined {
	return trace.getActiveSpan()?.spanContext().traceId;
}