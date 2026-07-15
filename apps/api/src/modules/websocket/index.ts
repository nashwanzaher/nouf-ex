/**
 * WebSocket module — real-time messaging functionality.
 */
export {
	createWebSocketServer,
	getActiveConnectionCount,
	getConnectedUserIds,
	isUserOnline,
	sendToUser,
} from './server.ts';
export type {
	AuthenticatedWebSocket,
	WebSocketMessage,
	WebSocketMessageUnion,
	ChatMessage,
	TypingMessage,
	ReadMessage,
	PresenceMessage,
	ErrorMessage,
	WebSocketConfig,
} from './types.ts';
export { DEFAULT_WS_CONFIG } from './types.ts';
