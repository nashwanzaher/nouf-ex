/**
 * Messages.tsx — K.6 page (customer / merchant)
 *
 * Inbox / sent / read of the authenticated user's direct messages,
 * served by /api/messages/* (server/routes/messages.ts).
 *
 * Two-pane layout: thread list on the left, conversation view on
 * the right. Unread count surfaces from getUnreadMessageCount().
 *
 * The compose box sends via sendMessage({ recipient_id, subject,
 * body, related_product_id?, related_store_id?, related_order_id? }).
 * The conversation view runs markMessageRead() on each inbound
 * message as it appears.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Inbox as InboxIcon,
    Loader2,
    MessageSquare,
    RefreshCw,
    Search,
    Send,
    Send as SentIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useApp, useAuth } from '@/context/AppContext';
import {
    formatApiError,
    getConversation,
    getInbox,
    getSent,
    getUnreadMessageCount,
    markMessageRead,
    sendMessage,
    type Message,
    type MessageThread,
} from '@/lib/api';

type Folder = 'inbox' | 'sent';

export default function Messages() {
	const { t } = useTranslation();
	const { addToast } = useApp();
	const { user, isAuthenticated } = useAuth();

	const [folder, setFolder] = useState<Folder>('inbox');
	const [search, setSearch] = useState('');
	const [selectedPeerId, setSelectedPeerId] = useState<number | null>(null);
	const [threads, setThreads] = useState<MessageThread[]>([]);
	const [conversation, setConversation] = useState<Message[]>([]);
	const [unreadCount, setUnreadCount] = useState(0);
	const [loadingThreads, setLoadingThreads] = useState(true);
	const [loadingConversation, setLoadingConversation] = useState(false);
	const [composeOpen, setComposeOpen] = useState(false);
	const [composeRecipientId, setComposeRecipientId] = useState('');
	const [composeSubject, setComposeSubject] = useState('');
	const [composeBody, setComposeBody] = useState('');
	const [sending, setSending] = useState(false);

	const userId = isAuthenticated && user ? Number(user.id) : null;

	/* ── Load thread list ── */
	const reloadThreads = useCallback(async () => {
		if (!userId) return;
		setLoadingThreads(true);
		try {
			const [inboxRes, countRes] = await Promise.all([
				getInbox(),
				getUnreadMessageCount(),
			]);
			if (folder === 'inbox') {
				setThreads(inboxRes.messages);
			} else {
				const sent = await getSent();
				setThreads(sent.messages);
			}
			setUnreadCount(countRes.count);
		} catch (err) {
			// R-15 §51: formatApiError returns a localized message
			// (from `ErrorCodes` → `ErrorMessages`) instead of the
			// raw server string. Falls back gracefully for unknown codes.
			addToast({ type: 'error', message: formatApiError(err) });
		} finally {
			setLoadingThreads(false);
		}
	}, [folder, userId, addToast]);

	// Suppress set-state-in-effect for the data-fetch pattern below.
	// reloadThreads() is itself an async function that triggers setX
	// inside its .then()/.finally; the lint rule's synchronous-call
	// heuristic treats `void reloadThreads()` as a violation because
	// the function starts with setLoadingThreads(true). The pattern
	// is intentional and matches the React docs "fetching data"
	// example (https://react.dev/reference/react/useEffect#fetching-data).
	useEffect(() => {
		void reloadThreads();
	}, [reloadThreads]);

	/* ── Load conversation ── */
	useEffect(() => {
		if (selectedPeerId == null) {
			setConversation([]);
			return;
		}
		setLoadingConversation(true);
		let cancelled = false;
		(async () => {
			try {
				const msgs = await getConversation(selectedPeerId);
				if (cancelled) return;
				setConversation(msgs);
				// Mark unread inbound messages read so the inbox badge
				// decrements when the user opens the thread.
				const unread = msgs.filter(
					(m) => m.recipient_id === userId && m.is_read === 0,
				);
				for (const m of unread) {
					try {
						await markMessageRead(Number(m.id));
					} catch {
						/* swallow — the next reload will retry */
					}
				}
				if (!cancelled) {
					setUnreadCount((c) => Math.max(0, c - unread.length));
				}
			} catch (err) {
				if (cancelled) return;
				addToast({
					type: 'error',
					message: formatApiError(err),
				});
			} finally {
				if (!cancelled) setLoadingConversation(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [selectedPeerId, userId, addToast]);

	/* ── UI helpers ── */
	const filteredThreads = useMemo(() => {
		if (!search.trim()) return threads;
		const needle = search.toLowerCase();
		return threads.filter((t) => {
			const subj = (t.subject ?? '').toLowerCase();
			const peer = (t.peer_email ?? '').toLowerCase();
			const body = (t.body ?? '').toLowerCase();
			return subj.includes(needle) || peer.includes(needle) || body.includes(needle);
		});
	}, [threads, search]);

	const selectedThread = useMemo(
		() => threads.find((t) => t.peer_id === selectedPeerId) ?? null,
		[threads, selectedPeerId],
	);

	const handleCompose = useCallback(async () => {
		const recipient = Number(composeRecipientId);
		if (!Number.isInteger(recipient) || recipient <= 0) {
			addToast({ type: 'error', message: t('messages.invalidRecipient', 'Invalid recipient ID') });
			return;
		}
		if (!composeSubject.trim() || !composeBody.trim()) {
			addToast({ type: 'error', message: t('messages.subjectAndBodyRequired', 'Subject and body are required') });
			return;
		}
		setSending(true);
		try {
			await sendMessage({
				recipient_id: recipient,
				subject: composeSubject,
				body: composeBody,
			});
			addToast({ type: 'success', message: t('messages.sent', 'Message sent') });
			setComposeOpen(false);
			setComposeRecipientId('');
			setComposeSubject('');
			setComposeBody('');
			await reloadThreads();
		} catch (err) {
			addToast({ type: 'error', message: formatApiError(err) });
		} finally {
			setSending(false);
		}
	}, [composeRecipientId, composeSubject, composeBody, reloadThreads, addToast, t]);

	if (!isAuthenticated) {
		return (
			<Card className="border-0 shadow-sm">
				<CardContent className="p-10 text-center">
					<MessageSquare className="w-12 h-12 text-[#AAAAAA] mx-auto mb-4" />
					<p className="text-base font-cairo text-[#111111]">
						{t('messages.loginToView', 'Sign in to view your messages')}
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-5">
			{/* ── Header ── */}
			<div className="flex flex-wrap gap-2 items-center justify-between">
				<div className="flex gap-2">
					<button
						type="button"
						onClick={() => {
							setFolder('inbox');
							setSelectedPeerId(null);
						}}
						className={`px-3 py-2 rounded-xl text-xs font-cairo font-medium inline-flex items-center gap-1.5 transition-all ${
							folder === 'inbox'
								? 'bg-[#D4A853] text-[#1A1612] shadow-sm'
								: 'bg-white text-[#6B6B6B] hover:bg-[#F8F8F8] border border-[#EEEEEE]'
						}`}
					>
						<InboxIcon className="w-4 h-4" />
						{t('messages.inbox', 'Inbox')}
						{unreadCount > 0 && folder === 'inbox' && (
							<span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
								{unreadCount}
							</span>
						)}
					</button>
					<button
						type="button"
						onClick={() => {
							setFolder('sent');
							setSelectedPeerId(null);
						}}
						className={`px-3 py-2 rounded-xl text-xs font-cairo font-medium inline-flex items-center gap-1.5 transition-all ${
							folder === 'sent'
								? 'bg-[#D4A853] text-[#1A1612] shadow-sm'
								: 'bg-white text-[#6B6B6B] hover:bg-[#F8F8F8] border border-[#EEEEEE]'
						}`}
					>
						<SentIcon className="w-4 h-4" />
						{t('messages.sent', 'Sent')}
					</button>
				</div>
				<div className="flex gap-2">
					<Button
						onClick={() => void reloadThreads()}
						variant="outline"
						size="sm"
						className="font-cairo text-xs"
					>
						<RefreshCw className="w-3.5 h-3.5 ml-1" />
						{t('messages.refresh', 'Refresh')}
					</Button>
					<Button
						onClick={() => setComposeOpen(!composeOpen)}
						size="sm"
						className="bg-[#0F7B6C] hover:bg-[#0a6356] text-white font-cairo text-xs"
					>
						<Send className="w-3.5 h-3.5 ml-1" />
						{t('messages.newMessage', 'New Message')}
					</Button>
				</div>
			</div>

			{/* ── Compose panel ── */}
			{composeOpen && (
				<Card className="border-0 shadow-sm">
					<CardContent className="p-4 space-y-3">
						<h3 className="text-sm font-cairo font-bold text-[#111111]">
							{t('messages.newMessage', 'New Message')}
						</h3>
						<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
							<input
								type="number"
								min={1}
								value={composeRecipientId}
								onChange={(e) => setComposeRecipientId(e.target.value)}
								placeholder={t('messages.recipientIdPlaceholder', 'Recipient ID (#ID)')}
								className="md:col-span-1 text-sm px-3 py-2.5 rounded-xl border border-[#e5e5e5] bg-[#F8F8F8] font-mono"
							/>
							<input
								type="text"
								value={composeSubject}
								onChange={(e) => setComposeSubject(e.target.value)}
								placeholder={t('messages.subjectPlaceholder', 'Subject')}
								className="md:col-span-2 text-sm px-3 py-2.5 rounded-xl border border-[#e5e5e5] bg-[#F8F8F8] font-cairo"
							/>
						</div>
						<textarea
							value={composeBody}
							onChange={(e) => setComposeBody(e.target.value)}
							placeholder={t('messages.bodyPlaceholder', 'Write your message...')}
							rows={4}
							className="w-full text-sm p-3 rounded-xl border border-[#e5e5e5] bg-[#F8F8F8] font-cairo resize-none"
						/>
						<div className="flex justify-end gap-2">
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => setComposeOpen(false)}
							>
								{t('messages.cancel', 'Cancel')}
							</Button>
							<Button
								type="button"
								size="sm"
								disabled={sending}
								onClick={() => void handleCompose()}
								className="bg-[#0F7B6C] hover:bg-[#0a6356] text-white font-cairo"
							>
								{sending ? (
									<Loader2 className="w-4 h-4 animate-spin ml-1" />
								) : (
									<Send className="w-4 h-4 ml-1" />
								)}
								{t('messages.send', 'Send')}
							</Button>
						</div>
					</CardContent>
				</Card>
			)}

			{/* ── Thread list + conversation ── */}
			<div className="grid lg:grid-cols-5 gap-4">
				<Card className="lg:col-span-2 border-0 shadow-sm overflow-hidden">
					<div className="p-3 border-b border-[#F5F5F5]">
						<div className="relative">
							<Search
								className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AAAAAA]"
								strokeWidth={1.5}
							/>
							<input
								type="text"
								placeholder={t('messages.searchPlaceholder', 'Search conversations...')}
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								className="w-full pr-9 pl-3 py-2 rounded-xl border border-[#e5e5e5] bg-[#F8F8F8] text-sm font-cairo"
							/>
						</div>
					</div>
					<div className="overflow-auto max-h-[60vh]">
						{loadingThreads ? (
							<div className="p-6 text-center">
								<Loader2 className="w-5 h-5 mx-auto animate-spin" />
							</div>
						) : filteredThreads.length === 0 ? (
							<div className="p-6 text-center text-xs text-[#AAAAAA] font-cairo">
								{t('messages.noMessages', 'No messages')}
							</div>
						) : (
							filteredThreads.map((t) => {
								const unread =
									folder === 'inbox' && t.is_read === 0;
								const active = selectedPeerId === t.peer_id;
								return (
									<button
										key={t.peer_id + ':' + t.id}
										type="button"
										onClick={() => setSelectedPeerId(t.peer_id)}
										className={`block w-full text-right p-3 border-b border-[#F5F5F5] transition-colors ${
											active
												? 'bg-[#FFF8F3]'
												: 'hover:bg-[#F8F8F8]'
										}`}
									>
										<div className="flex items-center justify-between gap-2">
											<span
												className={`text-sm font-cairo truncate ${
													unread
														? 'font-bold text-[#111111]'
														: 'text-[#111111]'
												}`}
											>
												{t.peer_email ?? `#${t.peer_id}`}
											</span>
											{unread && (
												<span className="bg-red-500 w-2 h-2 rounded-full" />
											)}
										</div>
										<p
											className={`text-[11px] font-cairo truncate mt-1 ${
												unread ? 'text-[#111111]' : 'text-[#6B6B6B]'
											}`}
										>
											{t.subject}
										</p>
										<p className="text-[10px] text-[#AAAAAA] font-cairo truncate mt-0.5">
											{t.created_at
												? new Date(t.created_at)
														.toISOString()
														.slice(0, 16)
														.replace('T', ' ')
												: ''}
										</p>
									</button>
								);
							})
						)}
					</div>
				</Card>

				<Card className="lg:col-span-3 border-0 shadow-sm overflow-hidden">
					<div className="h-full">
						{selectedThread == null ? (
							<div className="p-10 text-center h-[40vh] flex flex-col items-center justify-center">
								<MessageSquare className="w-12 h-12 text-[#AAAAAA] mb-3" />
								<p className="text-sm text-[#6B6B6B] font-cairo">
									{t('messages.selectThread', 'اختر محادثة من القائمة')}
								</p>
							</div>
						) : (
							<div className="flex flex-col h-full">
								<div className="p-4 border-b border-[#F5F5F5] flex items-center justify-between">
									<div>
										<p className="text-sm font-cairo font-bold text-[#111111]">
											{selectedThread.peer_email ??
												`#${selectedThread.peer_id}`}
										</p>
										<p className="text-[11px] text-[#6B6B6B] font-cairo truncate max-w-md">
											{selectedThread.subject}
										</p>
									</div>
								</div>
								<div className="flex-1 overflow-auto p-4 space-y-3 bg-[#FAFAFA]">
									{loadingConversation ? (
										<div className="text-center py-6">
											<Loader2 className="w-5 h-5 mx-auto animate-spin" />
										</div>
									) : conversation.length === 0 ? (
										<div className="text-center text-xs text-[#AAAAAA] font-cairo py-6">
											{t('messages.noMessages', 'لا توجد رسائل في هذه المحادثة')}
										</div>
									) : (
										conversation.map((m) => {
											const mine = m.sender_id === userId;
											return (
												<div
													key={m.id}
													className={`flex ${
														mine ? 'justify-start' : 'justify-end'
													}`}
												>
													<div
														className={`max-w-[75%] rounded-2xl px-3 py-2 ${
															mine
																? 'bg-[#F8F8F8] text-[#111111]'
																: 'bg-[#0F7B6C] text-white'
														}`}
													>
														<p className="text-xs whitespace-pre-wrap leading-relaxed">
															{m.body}
														</p>
									<p className="text-[10px] mt-1 opacity-70">
														{new Date(m.created_at)
															.toISOString()
															.slice(0, 16)
															.replace('T', ' ')}
													</p>
												</div>
												</div>
											);
										})
									)}
								</div>
							</div>
						)}
					</div>
				</Card>
			</div>
		</div>
	);
}
