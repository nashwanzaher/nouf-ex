/**
 * Messages / inbox feature public surface.
 */
export { default as Messages } from './components/Messages';

export {
	getConversation,
	getInbox,
	getSent,
	getUnreadMessageCount,
	markMessageRead,
	sendMessage,
} from './api/messages';

export type { InboxResponse, Message, MessageThread } from '@/lib/api/types';
