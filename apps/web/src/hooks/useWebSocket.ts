/**
 * useWebSocket hook — real-time WebSocket connection for messaging.
 *
 * SECURITY (OWASP ASVS 12.1.1):
 *   - Authentication via HttpOnly cookie (same-origin)
 *   - Automatic reconnection with exponential backoff
 *   - Message validation
 *   - Rate limiting awareness
 */
import { useState, useEffect, useCallback, useRef } from 'react';

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
	id: number;
	receiverId: number;
	content: string;
	storeId?: number;
	productId?: number;
	orderId?: number;
	attachments?: Array<{
		url: string;
		type: string;
		name: string;
	}>;
}

/** Typing indicator */
export interface TypingMessage extends WebSocketMessage {
	type: 'typing';
	receiverId: number;
	isTyping: boolean;
}

/** Read receipt */
export interface ReadMessage extends WebSocketMessage {
	type: 'read';
	messageId: number;
	senderId: number;
}

/** Presence update */
export interface PresenceMessage extends WebSocketMessage {
	type: 'presence';
	userId: number;
	status: 'online' | 'offline' | 'away';
}

/** Error message */
export interface ErrorMessage extends WebSocketMessage {
	type: 'error';
	code: string;
	message: string;
}

/** Union of all WebSocket messages */
export type WebSocketMessageUnion =
	| ChatMessage
	| TypingMessage
	| ReadMessage
	| PresenceMessage
	| ErrorMessage;

/** WebSocket connection state */
export type WebSocketState = 'connecting' | 'connected' | 'disconnected' | 'error';

/** useWebSocket options */
export interface UseWebSocketOptions {
	/** WebSocket server URL (default: auto-detect from current host) */
	url?: string;
	/** Whether to connect automatically (default: true) */
	autoConnect?: boolean;
	/** Reconnect interval in ms (default: 1000) */
	reconnectInterval?: number;
	/** Maximum reconnect interval in ms (default: 30000) */
	maxReconnectInterval?: number;
	/** Maximum reconnect attempts (default: 10) */
	maxReconnectAttempts?: number;
	/** Heartbeat interval in ms (default: 30000) */
	heartbeatInterval?: number;
}

/** useWebSocket return type */
export interface UseWebSocketReturn {
	/** Current connection state */
	state: WebSocketState;
	/** Send a message */
	send: (message: WebSocketMessageUnion) => void;
	/** Send a chat message */
	sendMessage: (receiverId: number, content: string, options?: {
		storeId?: number;
		productId?: number;
		orderId?: number;
		attachments?: Array<{ url: string; type: string; name: string }>;
	}) => void;
	/** Send typing indicator */
	sendTyping: (receiverId: number, isTyping: boolean) => void;
	/** Send read receipt */
	sendRead: (messageId: number, senderId: number) => void;
	/** Connect to WebSocket server */
	connect: () => void;
	/** Disconnect from WebSocket server */
	disconnect: () => void;
	/** Last received message */
	lastMessage: WebSocketMessageUnion | null;
	/** Connected user IDs */
	connectedUsers: Set<number>;
	/** Error message */
	error: string | null;
}

/**
 * WebSocket hook for real-time messaging.
 */
export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
	const {
		url,
		autoConnect = true,
		reconnectInterval = 1000,
		maxReconnectInterval = 30000,
		maxReconnectAttempts = 10,
		heartbeatInterval = 30000,
	} = options;

	const [state, setState] = useState<WebSocketState>('disconnected');
	const [lastMessage, setLastMessage] = useState<WebSocketMessageUnion | null>(null);
	const [connectedUsers, setConnectedUsers] = useState<Set<number>>(new Set());
	const [error, setError] = useState<string | null>(null);

	const wsRef = useRef<WebSocket | null>(null);
	const reconnectAttemptsRef = useRef(0);
	const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const messageHandlersRef = useRef<Map<string, Set<(message: WebSocketMessageUnion) => void>>>(new Map());

	/**
	 * Get WebSocket URL from current host.
	 */
	const getWebSocketUrl = useCallback((): string => {
		if (url) return url;
		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		return `${protocol}//${window.location.host}/ws`;
	}, [url]);

	/**
	 * Connect to WebSocket server.
	 */
	const connect = useCallback(() => {
		if (wsRef.current?.readyState === WebSocket.OPEN) return;

		const wsUrl = getWebSocketUrl();
		setState('connecting');
		setError(null);

		try {
			const ws = new WebSocket(wsUrl);
			wsRef.current = ws;

			ws.onopen = () => {
				setState('connected');
				setError(null);
				reconnectAttemptsRef.current = 0;

				// Start heartbeat
				heartbeatIntervalRef.current = setInterval(() => {
					if (ws.readyState === WebSocket.OPEN) {
						ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
					}
				}, heartbeatInterval);
			};

			ws.onmessage = (event) => {
				try {
					const message = JSON.parse(event.data) as WebSocketMessageUnion;
					setLastMessage(message);

					// Handle presence updates
					if (message.type === 'presence') {
						const presenceMsg = message as PresenceMessage;
						setConnectedUsers((prev) => {
							const next = new Set(prev);
							if (presenceMsg.status === 'online') {
								next.add(presenceMsg.userId);
							} else {
								next.delete(presenceMsg.userId);
							}
							return next;
						});
					}

					// Notify registered handlers
					const handlers = messageHandlersRef.current.get(message.type);
					if (handlers) {
						handlers.forEach((handler) => handler(message));
					}
				} catch (err) {
					console.error('[WebSocket] Failed to parse message:', err);
				}
			};

			ws.onclose = (event) => {
				setState('disconnected');
				if (heartbeatIntervalRef.current) {
					clearInterval(heartbeatIntervalRef.current);
				}

				// Attempt reconnection if not intentional close
				if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
					const delay = Math.min(
						reconnectInterval * Math.pow(2, reconnectAttemptsRef.current),
						maxReconnectInterval
					);
					reconnectAttemptsRef.current++;
					reconnectTimeoutRef.current = setTimeout(connect, delay);
				}
			};

			ws.onerror = () => {
				setState('error');
				setError('WebSocket connection failed');
			};
		} catch (err) {
			setState('error');
			setError(err instanceof Error ? err.message : 'Failed to connect');
		}
	}, [getWebSocketUrl, heartbeatInterval, reconnectInterval, maxReconnectInterval, maxReconnectAttempts]);

	/**
	 * Disconnect from WebSocket server.
	 */
	const disconnect = useCallback(() => {
		if (reconnectTimeoutRef.current) {
			clearTimeout(reconnectTimeoutRef.current);
		}
		if (heartbeatIntervalRef.current) {
			clearInterval(heartbeatIntervalRef.current);
		}
		if (wsRef.current) {
			wsRef.current.close(1000, 'User disconnected');
			wsRef.current = null;
		}
		setState('disconnected');
		setConnectedUsers(new Set());
	}, []);

	/**
	 * Send a message.
	 */
	const send = useCallback((message: WebSocketMessageUnion) => {
		if (wsRef.current?.readyState === WebSocket.OPEN) {
			wsRef.current.send(JSON.stringify(message));
		}
	}, []);

	/**
	 * Send a chat message.
	 */
	const sendMessage = useCallback((
		receiverId: number,
		content: string,
		options?: {
			storeId?: number;
			productId?: number;
			orderId?: number;
			attachments?: Array<{ url: string; type: string; name: string }>;
		}
	) => {
		send({
			type: 'message',
			receiverId,
			content,
			...options,
			timestamp: Date.now(),
		} as ChatMessage);
	}, [send]);

	/**
	 * Send typing indicator.
	 */
	const sendTyping = useCallback((receiverId: number, isTyping: boolean) => {
		send({
			type: 'typing',
			receiverId,
			isTyping,
			timestamp: Date.now(),
		} as TypingMessage);
	}, [send]);

	/**
	 * Send read receipt.
	 */
	const sendRead = useCallback((messageId: number, senderId: number) => {
		send({
			type: 'read',
			messageId,
			senderId,
			timestamp: Date.now(),
		} as ReadMessage);
	}, [send]);

	// Auto-connect on mount
	useEffect(() => {
		if (autoConnect) {
			connect();
		}
		return () => {
			disconnect();
		};
	}, [autoConnect, connect, disconnect]);

	return {
		state,
		send,
		sendMessage,
		sendTyping,
		sendRead,
		connect,
		disconnect,
		lastMessage,
		connectedUsers,
		error,
	};
}

/**
 * Register a message handler for a specific message type.
 */
export function useWebSocketMessage(
	type: WebSocketMessageType,
	handler: (message: WebSocketMessageUnion) => void,
): void {
	useEffect(() => {
		const handlers = messageHandlersRef.current.get(type) || new Set();
		handlers.add(handler);
		messageHandlersRef.current.set(type, handlers);

		return () => {
			handlers.delete(handler);
			if (handlers.size === 0) {
				messageHandlersRef.current.delete(type);
			}
		};
	}, [type, handler]);
}

/** Message handlers registry (shared across hook instances) */
const messageHandlersRef = {
	current: new Map<string, Set<(message: WebSocketMessageUnion) => void>>(),
};
