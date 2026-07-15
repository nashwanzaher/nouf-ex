/**
 * WebSocket server for real-time messaging.
 *
 * SECURITY (OWASP ASVS 12.1.1):
 *   - Authentication required via JWT token in query or header
 *   - Rate limiting per connection
 *   - Message size limits
 *   - Heartbeat to detect dead connections
 *   - Input validation on all messages
 */
import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { verifyAuthToken } from '../../middleware.ts';
import { db } from '../../lib/shared.ts';
import type {
	AuthenticatedWebSocket,
	WebSocketMessage,
	WebSocketMessageUnion,
	WebSocketConfig,
	ChatMessage,
	TypingMessage,
	ReadMessage,
	PresenceMessage,
} from './types.ts';
import { DEFAULT_WS_CONFIG } from './types.ts';

/** Active connections by user ID */
const connections = new Map<number, AuthenticatedWebSocket>();

/** Rate limit counters per connection */
const rateLimits = new Map<WebSocket, { count: number; resetAt: number }>();

/**
 * Create and configure the WebSocket server.
 */
export function createWebSocketServer(
	httpServer: Server,
	config: WebSocketConfig = DEFAULT_WS_CONFIG,
): WebSocketServer {
	const wss = new WebSocketServer({
		server: httpServer,
		path: config.path,
		maxPayload: config.maxMessageSize,
	});

	// Handle new connections
	wss.on('connection', (ws: WebSocket, req) => {
		handleConnection(ws as AuthenticatedWebSocket, req, config);
	});

	// Heartbeat interval to detect dead connections
	const heartbeatInterval = setInterval(() => {
		wss.clients.forEach((ws) => {
			const authWs = ws as AuthenticatedWebSocket;
			if (authWs.isAlive === false) {
				// Connection didn't respond to last ping — terminate
				connections.delete(authWs.userId);
				rateLimits.delete(ws);
				return ws.terminate();
			}
			authWs.isAlive = false;
			authWs.ping();
		});
	}, config.heartbeatInterval);

	// Cleanup on server close
	wss.on('close', () => {
		clearInterval(heartbeatInterval);
		connections.clear();
		rateLimits.clear();
	});

	return wss;
}

/**
 * Handle a new WebSocket connection.
 */
async function handleConnection(
	ws: AuthenticatedWebSocket,
	req: import('http').IncomingMessage,
	config: WebSocketConfig,
): Promise<void> {
	// Extract token from query string or Authorization header
	const url = new URL(req.url || '/', `http://${req.headers.host}`);
	const token = url.searchParams.get('token') ||
		req.headers.authorization?.replace('Bearer ', '');

	if (!token) {
		ws.close(4001, 'Authentication required');
		return;
	}

	// Verify JWT token
	const payload = verifyAuthToken(token);
	if (!payload) {
		ws.close(4001, 'Invalid token');
		return;
	}

	// Check if user already has a connection (close old one)
	const existingWs = connections.get(payload.sub);
	if (existingWs && existingWs.readyState === WebSocket.OPEN) {
		existingWs.close(4002, 'New connection established');
	}

	// Store connection
	ws.userId = payload.sub;
	ws.userRole = payload.role;
	ws.isAlive = true;
	ws.lastActivity = Date.now();
	connections.set(payload.sub, ws);

	// Send welcome message
	sendMessage(ws, {
		type: 'presence',
		userId: payload.sub,
		status: 'online',
		timestamp: Date.now(),
	});

	// Broadcast presence to connected users
	broadcastPresence(payload.sub, 'online');

	// Handle incoming messages
	ws.on('message', (data) => {
		handleMessage(ws, data, config);
	});

	// Handle pong (heartbeat response)
	ws.on('pong', () => {
		ws.isAlive = true;
		ws.lastActivity = Date.now();
	});

	// Handle close
	ws.on('close', () => {
		connections.delete(ws.userId);
		rateLimits.delete(ws);
		broadcastPresence(ws.userId, 'offline');
	});

	// Handle errors
	ws.on('error', (error) => {
		console.error(`[WebSocket] Error for user ${ws.userId}:`, error.message);
		connections.delete(ws.userId);
		rateLimits.delete(ws);
	});
}

/**
 * Handle an incoming WebSocket message.
 */
async function handleMessage(
	ws: AuthenticatedWebSocket,
	data: import('ws').RawData,
	config: WebSocketConfig,
): Promise<void> {
	// Rate limiting
	if (!checkRateLimit(ws, config.rateLimitPerMinute)) {
		sendError(ws, 'RATE_LIMITED', 'Too many messages. Please slow down.');
		return;
	}

	// Parse and validate message
	let message: WebSocketMessage;
	try {
		const text = data.toString();
		if (text.length > config.maxMessageSize) {
			sendError(ws, 'MESSAGE_TOO_LARGE', 'Message exceeds maximum size.');
			return;
		}
		message = JSON.parse(text);
	} catch {
		sendError(ws, 'INVALID_JSON', 'Invalid message format.');
		return;
	}

	// Validate message type
	if (!message.type || !message.timestamp) {
		sendError(ws, 'INVALID_MESSAGE', 'Missing required fields: type, timestamp.');
		return;
	}

	ws.lastActivity = Date.now();

	// Handle based on message type
	switch (message.type) {
		case 'message':
			await handleChatMessage(ws, message as ChatMessage);
			break;
		case 'typing':
			handleTypingMessage(ws, message as TypingMessage);
			break;
		case 'read':
			await handleReadMessage(ws, message as ReadMessage);
			break;
		case 'ping':
			sendMessage(ws, { type: 'pong', timestamp: Date.now() });
			break;
		default:
			sendError(ws, 'UNKNOWN_TYPE', `Unknown message type: ${message.type}`);
	}
}

/**
 * Handle a chat message.
 */
async function handleChatMessage(
	ws: AuthenticatedWebSocket,
	message: ChatMessage,
): Promise<void> {
	// Validate required fields
	if (!message.receiverId || !message.content) {
		sendError(ws, 'INVALID_MESSAGE', 'Missing required fields: receiverId, content.');
		return;
	}

	// Validate content length
	if (message.content.length > 10000) {
		sendError(ws, 'MESSAGE_TOO_LARGE', 'Message content exceeds maximum length.');
		return;
	}

	try {
		// Save message to database
		const result = await db.prepare(
			`INSERT INTO messages (sender_id, receiver_id, store_id, product_id, order_id, body, attachments)
			 VALUES (?, ?, ?, ?, ?, ?, ?)
			 RETURNING id, created_at`
		).get(
			ws.userId,
			message.receiverId,
			message.storeId || null,
			message.productId || null,
			message.orderId || null,
			message.content,
			JSON.stringify(message.attachments || []),
		) as { id: number; created_at: string } | undefined;

		if (!result) {
			sendError(ws, 'SAVE_FAILED', 'Failed to save message.');
			return;
		}

		// Send to receiver if online
		const receiverWs = connections.get(message.receiverId);
		if (receiverWs && receiverWs.readyState === WebSocket.OPEN) {
			sendMessage(receiverWs, {
				type: 'message',
				id: result.id,
				receiverId: message.receiverId,
				content: message.content,
				storeId: message.storeId,
				productId: message.productId,
				orderId: message.orderId,
				attachments: message.attachments,
				timestamp: new Date(result.created_at).getTime(),
			});
		}

		// Send confirmation to sender
		sendMessage(ws, {
			type: 'message',
			id: result.id,
			receiverId: message.receiverId,
			content: message.content,
			storeId: message.storeId,
			productId: message.productId,
			orderId: message.orderId,
			attachments: message.attachments,
			timestamp: new Date(result.created_at).getTime(),
		});
	} catch (error) {
		console.error('[WebSocket] Error saving message:', error);
		sendError(ws, 'SAVE_FAILED', 'Failed to save message.');
	}
}

/**
 * Handle a typing indicator.
 */
function handleTypingMessage(
	ws: AuthenticatedWebSocket,
	message: TypingMessage,
): void {
	if (!message.receiverId) return;

	const receiverWs = connections.get(message.receiverId);
	if (receiverWs && receiverWs.readyState === WebSocket.OPEN) {
		sendMessage(receiverWs, {
			type: 'typing',
			receiverId: ws.userId,
			isTyping: message.isTyping,
			timestamp: Date.now(),
		});
	}
}

/**
 * Handle a read receipt.
 */
async function handleReadMessage(
	ws: AuthenticatedWebSocket,
	message: ReadMessage,
): Promise<void> {
	if (!message.messageId || !message.senderId) return;

	try {
		// Update message as read in database
		await db.prepare(
			`UPDATE messages SET is_read = TRUE, read_at = NOW()
			 WHERE id = ? AND receiver_id = ? AND is_read = FALSE`
		).run(message.messageId, ws.userId);

		// Notify sender
		const senderWs = connections.get(message.senderId);
		if (senderWs && senderWs.readyState === WebSocket.OPEN) {
			sendMessage(senderWs, {
				type: 'read',
				messageId: message.messageId,
				senderId: ws.userId,
				timestamp: Date.now(),
			});
		}
	} catch (error) {
		console.error('[WebSocket] Error marking message as read:', error);
	}
}

/**
 * Broadcast presence to all connected users.
 */
function broadcastPresence(userId: number, status: 'online' | 'offline' | 'away'): void {
	const presenceMessage: PresenceMessage = {
		type: 'presence',
		userId,
		status,
		timestamp: Date.now(),
	};

	connections.forEach((ws, connectedUserId) => {
		if (connectedUserId !== userId && ws.readyState === WebSocket.OPEN) {
			sendMessage(ws, presenceMessage);
		}
	});
}

/**
 * Check rate limit for a connection.
 */
function checkRateLimit(ws: AuthenticatedWebSocket, limit: number): boolean {
	const now = Date.now();
	let entry = rateLimits.get(ws);

	if (!entry || entry.resetAt < now) {
		entry = { count: 0, resetAt: now + 60_000 };
		rateLimits.set(ws, entry);
	}

	entry.count++;
	return entry.count <= limit;
}

/**
 * Send a message to a WebSocket client.
 */
function sendMessage(ws: WebSocket, message: WebSocketMessageUnion): void {
	if (ws.readyState === WebSocket.OPEN) {
		ws.send(JSON.stringify(message));
	}
}

/**
 * Send an error message to a WebSocket client.
 */
function sendError(ws: WebSocket, code: string, message: string): void {
	sendMessage(ws, {
		type: 'error',
		code,
		message,
		timestamp: Date.now(),
	});
}

/**
 * Get the number of active connections.
 */
export function getActiveConnectionCount(): number {
	return connections.size;
}

/**
 * Get connected user IDs.
 */
export function getConnectedUserIds(): number[] {
	return Array.from(connections.keys());
}

/**
 * Check if a user is online.
 */
export function isUserOnline(userId: number): boolean {
	const ws = connections.get(userId);
	return ws !== undefined && ws.readyState === WebSocket.OPEN;
}

/**
 * Send a message to a specific user (used by other modules).
 */
export function sendToUser(userId: number, message: WebSocketMessageUnion): boolean {
	const ws = connections.get(userId);
	if (ws && ws.readyState === WebSocket.OPEN) {
		sendMessage(ws, message);
		return true;
	}
	return false;
}
