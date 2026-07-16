/**
 * Manual OpenTelemetry spans for the components we instrument
 * explicitly (cache, queue, ES, settings). Auto-instrumentation
 * covers HTTP, pg, ioredis, amqplib, @elastic/elasticsearch,
 * but these helpers let us attach domain-specific attributes and
 * enforce consistent naming.
 *
 * All span names follow OTel semantic conventions:
 *   - https://opentelemetry.io/docs/specs/semconv/database/
 *   - https://opentelemetry.io/docs/specs/semconv/messaging/
 *   - https://opentelemetry.io/docs/specs/semconv/db/redis/
 */
import { trace, SpanKind, SpanStatusCode, type Span } from '@opentelemetry/api';

const TRACER = trace.getTracer('noufex.app');

export async function withSpan<T>(
	name: string,
	kind: SpanKind,
	attributes: Record<string, string | number | boolean>,
	fn: (span: Span) => Promise<T>,
): Promise<T> {
	const span = TRACER.startSpan(name, { kind, attributes });
	try {
		const result = await fn(span);
		span.setStatus({ code: SpanStatusCode.OK });
		return result;
	} catch (err) {
		span.recordException(err instanceof Error ? err : new Error(String(err)));
		span.setStatus({
			code: SpanStatusCode.ERROR,
			message: err instanceof Error ? err.message : String(err),
		});
		throw err;
	} finally {
		span.end();
	}
}

// Pre-built wrappers for the common operations:
export const cacheSpan = {
	wrap: <T,>(key: string, fn: () => Promise<T>) =>
		withSpan(`cache.get ${keyPrefix(key)}`, SpanKind.CLIENT, {
			'cache.system': 'redis',
			'cache.key': key,
		}, fn),
};

export const esSpan = {
	search: <T,>(q: string, fn: () => Promise<T>) =>
		withSpan('elasticsearch.search', SpanKind.CLIENT, {
			'db.system': 'elasticsearch',
			'db.operation': 'search',
			'db.elasticsearch.query': q,
		}, fn),
	index: <T,>(index: string, id: string, fn: () => Promise<T>) =>
		withSpan(`elasticsearch.index ${index}`, SpanKind.CLIENT, {
			'db.system': 'elasticsearch',
			'db.operation': 'index',
			'db.elasticsearch.index': index,
			'db.elasticsearch.id': id,
		}, fn),
	bulk: <T,>(index: string, count: number, fn: () => Promise<T>) =>
		withSpan(`elasticsearch.bulk ${index}`, SpanKind.CLIENT, {
			'db.system': 'elasticsearch',
			'db.operation': 'bulk',
			'db.elasticsearch.index': index,
			'db.elasticsearch.bulk_count': count,
		}, fn),
};

export const queueSpan = {
	publish: <T,>(exchange: string, routingKey: string, fn: () => Promise<T>) =>
		withSpan(`queue.publish ${exchange}`, SpanKind.PRODUCER, {
			'messaging.system': 'rabbitmq',
			'messaging.destination': exchange,
			'messaging.operation': 'publish',
			'messaging.rabbitmq.routing_key': routingKey,
		}, fn),
	consume: <T,>(queue: string, fn: () => Promise<T>) =>
		withSpan(`queue.consume ${queue}`, SpanKind.CONSUMER, {
			'messaging.system': 'rabbitmq',
			'messaging.destination': queue,
			'messaging.operation': 'process',
		}, fn),
};

function keyPrefix(k: string): string {
	// Strip the keyPrefix region for cleanliness, but keep enough
	// of the namespace for filtering.
	const idx = k.indexOf(':');
	if (idx > 0 && idx < 12) return k.slice(0, idx + 1) + '<key>';
	return k.slice(0, 60);
}