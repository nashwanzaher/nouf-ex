/**
 * RabbitMQ client wrapper (Phase 2, competitive-architecture-analysis).
 *
 * Provides a typed publish/subscribe interface over amqplib. Like the
 * Redis wrapper, the connection is created lazily on first use and
 * `null` is returned if RABBITMQ_URL is not configured. Every caller
 * MUST be prepared to handle the "no queue broker" case — typically
 * by falling back to an in-process queue or by no-op-ing the message.
 *
 * Topology (declared on connect, idempotent):
 *   - `noufex.orders`      (topic)  order.placed, order.paid, …
 *   - `noufex.notifications` (fanout) email.send, sms.send, push.send
 *   - `noufex.search`      (direct) search.index, search.deindex
 *   - `noufex.analytics`   (topic)  analytics.events
 *   - `noufex.audit`       (fanout) audit.archive
 *   - `noufex.webhooks`    (direct) webhook.retry
 *
 * Each queue is declared with `x-dead-letter-exchange` so messages
 * that are NACKed without requeue land in `<queue>.dlq` for later
 * inspection. Consumers run inside the same process; for a real
 * multi-instance deployment split them into a separate worker
 * container (see apps/worker/ in a future iteration).
 */
import * as amqp from 'amqplib';
import { log } from './shared.ts';

export type ExchangeType = 'topic' | 'direct' | 'fanout' | 'headers';

export interface ExchangeDef {
	name: string;
	type: ExchangeType;
	durable?: boolean;
}

export interface QueueDef {
	name: string;
	durable?: boolean;
	exchange: string;
	routingKey?: string; // for direct/topic
	dlqSuffix?: string; // default '.dlq'
}

export const EXCHANGES: Record<string, ExchangeDef> = {
	orders: { name: 'noufex.orders', type: 'topic', durable: true },
	notifications: { name: 'noufex.notifications', type: 'fanout', durable: true },
	search: { name: 'noufex.search', type: 'direct', durable: true },
	analytics: { name: 'noufex.analytics', type: 'topic', durable: true },
	audit: { name: 'noufex.audit', type: 'fanout', durable: true },
	webhooks: { name: 'noufex.webhooks', type: 'direct', durable: true },
};

export const QUEUES: Record<string, QueueDef> = {
	orderPlaced: {
		name: 'orders.placed',
		exchange: 'noufex.orders',
		routingKey: 'order.placed',
	},
	orderPaid: {
		name: 'orders.paid',
		exchange: 'noufex.orders',
		routingKey: 'order.paid',
	},
	orderShipped: {
		name: 'orders.shipped',
		exchange: 'noufex.orders',
		routingKey: 'order.shipped',
	},
	orderDelivered: {
		name: 'orders.delivered',
		exchange: 'noufex.orders',
		routingKey: 'order.delivered',
	},
	emailSend: {
		name: 'notifications.email',
		exchange: 'noufex.notifications',
		routingKey: 'email.send',
	},
	smsSend: {
		name: 'notifications.sms',
		exchange: 'noufex.notifications',
		routingKey: 'sms.send',
	},
	searchIndex: {
		name: 'search.index',
		exchange: 'noufex.search',
		routingKey: 'search.index',
	},
	searchDeindex: {
		name: 'search.deindex',
		exchange: 'noufex.search',
		routingKey: 'search.deindex',
	},
	analyticsEvents: {
		name: 'analytics.events',
		exchange: 'noufex.analytics',
		routingKey: 'analytics.events',
	},
	auditArchive: {
		name: 'audit.archive',
		exchange: 'noufex.audit',
	},
	webhookRetry: {
		name: 'webhooks.retry',
		exchange: 'noufex.webhooks',
		routingKey: 'webhook.retry',
	},
};

interface AmqpConnection {
	connection: amqp.ChannelModel;
	channel: amqp.Channel;
	ready: boolean;
}

let _conn: AmqpConnection | null = null;
let _connecting: Promise<AmqpConnection | null> | null = null;
let _disabled = false;

export function isQueueEnabled(): boolean {
	return Boolean(process.env.RABBITMQ_URL?.trim()) && !_disabled;
}

/** Connect (or return cached connection). Returns `null` if the broker
 *  URL is not configured or the connection fails. Callers MUST handle
 *  `null`. */
export async function getQueue(): Promise<AmqpConnection | null> {
	if (_disabled) return null;
	if (_conn?.ready) return _conn;
	if (_connecting) return _connecting;
	_connecting = (async () => {
		const url = process.env.RABBITMQ_URL?.trim();
		if (!url) {
			_disabled = true;
			return null;
		}
		try {
			const connection = await amqp.connect(url);
			const channel = await connection.createChannel();
			channel.on('error', (err: Error) => {
				log.warn({ msg: 'rabbitmq_channel_error', error: err.message });
			});
			connection.on('error', (err: Error) => {
				log.warn({ msg: 'rabbitmq_connection_error', error: err.message });
			});
			connection.on('close', () => {
				log.warn({ msg: 'rabbitmq_connection_closed' });
				_conn = null;
			});
			await declareTopology(channel);
			_conn = { connection, channel, ready: true };
			log.info({ msg: 'rabbitmq_ready', url: redactUrl(url) });
			return _conn;
		} catch (err) {
			log.warn({
				msg: 'rabbitmq_connect_failed',
				error: (err as Error).message,
			});
			_disabled = true;
			return null;
		} finally {
			_connecting = null;
		}
	})();
	return _connecting;
}

async function declareTopology(channel: amqp.Channel): Promise<void> {
	const prefetch = Number.parseInt(process.env.RABBITMQ_PREFETCH || '10', 10);
	await channel.prefetch(Number.isFinite(prefetch) ? prefetch : 10);

	for (const ex of Object.values(EXCHANGES)) {
		await channel.assertExchange(ex.name, ex.type, {
			durable: ex.durable !== false,
		});
	}

	for (const q of Object.values(QUEUES)) {
		const dlqName = `${q.name}.dlq`;
		await channel.assertQueue(dlqName, { durable: true });
		await channel.assertQueue(q.name, {
			durable: q.durable !== false,
			deadLetterExchange: '',
			deadLetterRoutingKey: dlqName,
		});
		if (q.exchange) {
			await channel.bindQueue(q.name, q.exchange, q.routingKey ?? '#');
			await channel.bindQueue(dlqName, '', dlqName);
		}
	}
}

/** Publish a JSON-encoded message to an exchange/routing-key. Returns
 *  `true` if the broker accepted the publish, `false` if the broker
 *  is unavailable. The caller decides whether to fail-OPEN (no-op)
 *  or fall back to an in-process queue. */
export async function publish(
	exchange: string,
	routingKey: string,
	payload: unknown,
	options?: amqp.Options.Publish,
): Promise<boolean> {
	const c = await getQueue();
	if (!c) return false;
	try {
		const buf = Buffer.from(JSON.stringify(payload));
		const ok = c.channel.publish(exchange, routingKey, buf, {
			contentType: 'application/json',
			persistent: true,
			...options,
		});
		return ok;
	} catch (err) {
		log.warn({
			msg: 'rabbitmq_publish_failed',
			exchange,
			routing_key: routingKey,
			error: (err as Error).message,
		});
		return false;
	}
}

/** Subscribe a handler to a queue. Returns an unsubscribe function.
 *  Failures NACK without requeue so the message lands in the DLQ. */
export async function subscribe<T = unknown>(
	queueName: string,
	handler: (msg: T, raw: amqp.ConsumeMessage) => Promise<void>,
): Promise<() => Promise<void>> {
	const c = await getQueue();
	if (!c) {
		log.warn({ msg: 'rabbitmq_subscribe_skipped', queue: queueName });
		return async () => void 0;
	}
	const { consumerTag } = await c.channel.consume(
		queueName,
		async (msg: amqp.ConsumeMessage | null) => {
			if (!msg) return; // cancelled by broker
			try {
				const body = JSON.parse(msg.content.toString('utf8')) as T;
				await handler(body, msg);
				c.channel.ack(msg);
			} catch (err) {
				log.warn({
					msg: 'rabbitmq_handler_failed',
					queue: queueName,
					error: (err as Error).message,
				});
				c.channel.nack(msg, false, false); // → DLQ
			}
		},
		{ noAck: false },
	);
	return async () => {
		try {
			await c.channel.cancel(consumerTag);
		} catch {
			// channel closed
		}
	};
}

export async function closeQueue(): Promise<void> {
	if (!_conn) return;
	try {
		await _conn.channel.close();
	} catch {
		// ignore
	}
	try {
		await _conn.connection.close();
	} catch {
		// ignore
	}
	_conn = null;
}

export function queueStatus(): {
	enabled: boolean;
	ready: boolean;
	exchanges: number;
	queues: number;
} {
	return {
		enabled: isQueueEnabled(),
		ready: _conn?.ready ?? false,
		exchanges: Object.keys(EXCHANGES).length,
		queues: Object.keys(QUEUES).length,
	};
}

function redactUrl(url: string | undefined): string {
	if (!url) return '(none)';
	try {
		const u = new URL(url);
		if (u.password) u.password = '***';
		return u.toString();
	} catch {
		return '(invalid-url)';
	}
}

export type { amqp };