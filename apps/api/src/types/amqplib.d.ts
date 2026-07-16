/**
 * Minimal type stubs for `amqplib` (the @types/amqplib package was
 * deprecated and never moved to DefinitelyTyped). The library
 * itself ships JS only; this file covers the surface we use
 * (Connection, Channel, publish, consume, ack/nack).
 */
declare module 'amqplib' {
	export interface ConsumeMessage {
		content: Buffer;
		fields: Record<string, unknown>;
		properties: Record<string, unknown>;
	}

	export interface ChannelModel {
		close(): Promise<void>;
		createChannel(): Promise<Channel>;
		on(event: 'error', listener: (err: Error) => void): void;
		on(event: 'close', listener: () => void): void;
		on(event: string, listener: (...args: unknown[]) => void): void;
	}

	export interface OptionsPublish {
		contentType?: string;
		persistent?: boolean;
		[key: string]: unknown;
	}

	export interface ConsumeOptions {
		noAck?: boolean;
	}

	export interface Channel {
		assertExchange(
			exchange: string,
			type: string,
			options?: { durable?: boolean },
		): Promise<unknown>;
		assertQueue(
			queue: string,
			options?: { durable?: boolean; deadLetterExchange?: string; deadLetterRoutingKey?: string },
		): Promise<unknown>;
		bindQueue(queue: string, exchange: string, routingKey: string): Promise<unknown>;
		prefetch(count: number): Promise<unknown>;
		publish(
			exchange: string,
			routingKey: string,
			content: Buffer,
			options?: OptionsPublish,
		): boolean;
		consume(
			queue: string,
			callback: (msg: ConsumeMessage | null) => Promise<void> | void,
			options?: ConsumeOptions,
		): Promise<{ consumerTag: string }>;
		ack(msg: ConsumeMessage): void;
		nack(msg: ConsumeMessage, allUpTo?: boolean, requeue?: boolean): void;
		cancel(consumerTag: string): Promise<void>;
		close(): Promise<void>;
		on(event: 'error', listener: (err: Error) => void): void;
		on(event: 'close', listener: () => void): void;
		on(event: string, listener: (...args: unknown[]) => void): void;
	}

	export function connect(url: string): Promise<ChannelModel>;
}

export namespace Options {
	export type Publish = OptionsPublish;
}

declare module 'amqplib/index' {
	export * from 'amqplib';
}