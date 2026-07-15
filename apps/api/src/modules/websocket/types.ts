/**
 * WebSocket types for real-time messaging.
 *
 * SECURITY (OWASP ASVS 12.1.1):
 *   - All messages are validated against a schema
 *   - Authentication is required for all operations
 *   - Rate limiting is applied per connection
 */
import type { WebSocket } from 'ws';

/** WebSocket connection with authenticated user info */
export interface AuthenticatedWebSocket extends WebSocket {
	userId: number;
	userRole: string;
	isAlive: boolean;
	lastActivity: number;
}

/** WebSocket message types */
export type WebSocketMessageType =
	| 'message'
	| 'typing'
	| 'read'
	| 'presence'
	| 'error'
	| 'ping'
	| 'pong';

/** Base WebSocket message */
export interface WebSocketMessage {
	type: WebSocketMessageType;
	timestamp: number;
}

/** Chat message */
export interface ChatMessage extends WebSocketMessage {
	type: 'message';
	/** Message ID from database */
	id: number;
	/** Receiver user ID */
	receiverId: number;
	/** Message content */
	content: string;
	/** Optional store ID */
	storeId?: number;
	/** Optional product ID */
	productId?: number;
	/** Optional order ID */
	orderId?: number;
	/** Attachments */
	attachments?: Array<{
		url: string;
		type: string;
		name: string;
	}>;
}

/** Typing indicator */
export interface TypingMessage extends WebSocketMessage {
	type: 'typing';
	/** Receiver user ID */
	receiverId: number;
	/** Whether user is typing */
	isTyping: boolean;
}

/** Read receipt */
export interface ReadMessage extends WebSocketMessage {
	type: 'read';
	/** Message ID that was read */
	messageId: number;
	/** Sender of the original message */
	senderId: number;
}

/** Presence update */
export interface PresenceMessage extends WebSocketMessage {
	type: 'presence';
	/** User ID */
	userId: number;
	/** Online status */
	status: 'online' | 'offline' | 'away';
}

/** Error message */
export interface ErrorMessage extends WebSocketMessage {
	type: 'error';
	/** Error code */
	code: string;
	/** Error message */
	message: string;
}

/** Ping message */
export interface PingMessage extends WebSocketMessage {
	type: 'ping';
}

/** Pong message */
export interface PongMessage extends WebSocketMessage {
	type: 'pong';
}

/** Union of all WebSocket messages */
export type WebSocketMessageUnion =
	| ChatMessage
	| TypingMessage
	| ReadMessage
	| PresenceMessage
	| ErrorMessage
	| PingMessage
	| PongMessage;

/** WebSocket server configuration */
export interface WebSocketConfig {
	/** Path for WebSocket endpoint */
	path: string;
	/** Heartbeat interval in ms */
	heartbeatInterval: number;
	/** Connection timeout in ms */
	connectionTimeout: number;
	/** Maximum message size in bytes */
	maxMessageSize: number;
	/** Rate limit: messages per minute per connection */
	rateLimitPerMinute: number;
}

/** Default WebSocket configuration */
export const DEFAULT_WS_CONFIG: WebSocketConfig = {
	path: '/ws',
	heartbeatInterval: 30_000,
	connectionTimeout: 60_000,
	maxMessageSize: 64 * 1024, // 64KB
	rateLimitPerMinute: 60,
};
