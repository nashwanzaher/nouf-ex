// =============================================================================
// Notifications — shared types
// =============================================================================
// A notification is a row in the `notifications` table. The dispatcher
// reads the row, decides which channels to use (email / SMS / in-app)
// based on the notification type and the user's contact preferences,
// and then hands off to the corresponding channel implementation.
// =============================================================================

export type NotificationType =
	| 'order'
	| 'message'
	| 'review'
	| 'promo'
	| 'system'
	| 'dispute'
	| 'refund';

export interface NotificationRow {
	id: number;
	user_id: number;
	type: NotificationType;
	title: string;
	body: string | null;
	data: Record<string, unknown> | null;
	is_read: boolean;
	read_at: string | null;
	created_at: string;
}

export interface DispatchContext {
	// The notification being delivered.
	notification: NotificationRow;
	// Recipient contact info. Either may be null if the user hasn't
	// provided it.
	user: { id: number; email: string | null; phone: string | null; preferred_language?: string };
}

export interface DispatchResult {
	channel: 'email' | 'sms' | 'in_app';
	ok: boolean;
	// Provider-specific message id (SMTP message-id, Twilio SID, etc.)
	// for tracking / dedup. Null when ok=false or channel is in_app.
	providerMessageId: string | null;
	error: string | null;
}

export interface NotificationChannel {
	readonly name: 'email' | 'sms' | 'in_app';
	readonly isConfigured: boolean;
	// True if this channel is appropriate for the notification type
	// (e.g. we DON'T SMS every promo — only order/dispute updates).
	shouldDeliver(notification: NotificationRow): boolean;
	send(ctx: DispatchContext): Promise<DispatchResult>;
}
