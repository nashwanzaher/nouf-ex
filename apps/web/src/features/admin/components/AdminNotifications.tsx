import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	Bell,
	CheckCircle2,
	Loader2,
	Megaphone,
	Send,
	Users,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { cn } from '@/lib/utils';
import { broadcastNotification } from '@/features/admin/api/admin';

type Segment = 'all' | 'customers' | 'merchants' | 'admins';
type NotifType = 'system' | 'promo' | 'order' | 'message' | 'review' | 'dispute' | 'refund';

const SEGMENTS: { value: Segment; labelKey: string; icon: typeof Users; tone: string }[] = [
	{ value: 'all', labelKey: 'admin.notifications.allUsers', icon: Users, tone: 'amber' },
	{
		value: 'customers',
		labelKey: 'admin.notifications.customers',
		icon: Users,
		tone: 'blue',
	},
	{
		value: 'merchants',
		labelKey: 'admin.notifications.merchants',
		icon: Users,
		tone: 'emerald',
	},
	{
		value: 'admins',
		labelKey: 'admin.notifications.admins',
		icon: Users,
		tone: 'purple',
	},
];

const TYPES: { value: NotifType; labelKey: string; tone: string }[] = [
	{ value: 'system', labelKey: 'admin.notifications.typeSystem', tone: 'gray' },
	{ value: 'promo', labelKey: 'admin.notifications.typePromo', tone: 'amber' },
	{ value: 'order', labelKey: 'admin.notifications.typeOrder', tone: 'blue' },
	{ value: 'message', labelKey: 'admin.notifications.typeMessage', tone: 'emerald' },
	{ value: 'review', labelKey: 'admin.notifications.typeReview', tone: 'amber' },
	{ value: 'dispute', labelKey: 'admin.notifications.typeDispute', tone: 'red' },
	{ value: 'refund', labelKey: 'admin.notifications.typeRefund', tone: 'red' },
];

export default function AdminNotifications() {
	const { t } = useTranslation();
	const { addToast } = useApp();
	const [segment, setSegment] = useState<Segment>('all');
	const [type, setType] = useState<NotifType>('system');
	const [title, setTitle] = useState('');
	const [body, setBody] = useState('');
	const [sending, setSending] = useState(false);
	const [lastResult, setLastResult] = useState<{ created: number; segment: string } | null>(
		null,
	);

	const handleSend = async () => {
		if (!title.trim() || !body.trim()) {
			addToast({
				type: 'warning',
				message: t('admin.notifications.fillAll', 'Title and body are required'),
			});
			return;
		}
		setSending(true);
		try {
			const res = await broadcastNotification({ segment, type, title, body });
			setLastResult({ created: res.created, segment: res.segment });
			addToast({
				type: 'success',
				message: `${res.created} ${t('admin.notifications.sent', 'notifications sent')}`,
			});
			setTitle('');
			setBody('');
		} catch (e: unknown) {
			addToast({
				type: 'error',
				message: e instanceof Error ? e.message : String(e),
			});
		} finally {
			setSending(false);
		}
	};

	const tones: Record<string, string> = {
		amber: 'bg-amber-50 text-amber-700 border-amber-200',
		blue: 'bg-blue-50 text-blue-700 border-blue-200',
		emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
		purple: 'bg-purple-50 text-purple-700 border-purple-200',
		red: 'bg-red-50 text-red-700 border-red-200',
		gray: 'bg-gray-100 text-gray-600 border-gray-200',
	};

	return (
		<div className="min-h-screen bg-[#FAFAF7]">
			<div className="max-w-3xl mx-auto px-4 lg:px-6 py-6 space-y-6">
				<div className="rounded-2xl bg-gradient-to-br from-[#1A1612] via-[#2A2420] to-[#1A1612] text-white p-6 lg:p-8 relative overflow-hidden">
					<div className="absolute inset-0 opacity-10">
						<div className="absolute -top-12 -end-12 w-64 h-64 rounded-full bg-[#D4A853] blur-3xl" />
					</div>
					<div className="relative flex items-center gap-4">
						<div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center">
							<Megaphone size={26} className="text-[#D4A853]" />
						</div>
						<div>
							<p className="text-xs uppercase tracking-widest text-[#D4A853] font-bold">
								{t('admin.navNotifications', 'Marketing')}
							</p>
							<h1 className="text-xl font-bold mt-1">
								{t('admin.notifications.title', 'Broadcast Notifications')}
							</h1>
							<p className="text-sm text-white/60 mt-1">
								{t(
									'admin.notifications.subtitle',
									'Send a platform-wide notification to a user segment.',
								)}
							</p>
						</div>
					</div>
				</div>

				{lastResult && (
					<div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
						<CheckCircle2 size={20} className="text-emerald-600" />
						<div>
							<p className="text-sm font-bold text-emerald-900">
								{t('admin.notifications.lastSent', 'Last broadcast sent')}
							</p>
							<p className="text-xs text-emerald-700">
								{lastResult.created} → {lastResult.segment}
							</p>
						</div>
					</div>
				)}

				<div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
					{/* Segment */}
					<div>
						<label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">
							{t('admin.notifications.segment', 'Target segment')}
						</label>
						<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
							{SEGMENTS.map((s) => (
								<button
									key={s.value}
									type="button"
									onClick={() => setSegment(s.value)}
									className={cn(
										'flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-start',
										segment === s.value
											? 'border-[#D4A853] bg-[#D4A853]/5'
											: 'border-gray-200 hover:border-gray-300',
									)}
								>
									<div
										className={cn(
											'w-8 h-8 rounded-lg flex items-center justify-center',
											tones[s.tone],
										)}
									>
										<s.icon size={14} />
									</div>
									<span className="text-xs font-bold text-gray-900">
										{t(s.labelKey, s.value)}
									</span>
								</button>
							))}
						</div>
					</div>

					{/* Type */}
					<div>
						<label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">
							{t('admin.notifications.type', 'Notification type')}
						</label>
						<div className="flex flex-wrap gap-2">
							{TYPES.map((tp) => (
								<button
									key={tp.value}
									type="button"
									onClick={() => setType(tp.value)}
									className={cn(
										'px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all',
										type === tp.value
											? 'border-[#D4A853] bg-[#D4A853]/10 text-[#1A1612]'
											: 'border-gray-200 text-gray-600 hover:border-gray-300',
									)}
								>
									{t(tp.labelKey, tp.value)}
								</button>
							))}
						</div>
					</div>

					{/* Title */}
					<label className="block">
						<span className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
							{t('admin.notifications.titleField', 'Title')}
						</span>
						<input
							type="text"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder={t('admin.notifications.titlePlaceholder', 'e.g. Special Ramadan Offer')}
							maxLength={120}
							className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:border-[#D4A853] focus:ring-1 focus:ring-[#D4A853] outline-none"
						/>
						<span className="text-[10px] text-gray-400 mt-1">
							{title.length}/120
						</span>
					</label>

					{/* Body */}
					<label className="block">
						<span className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
							{t('admin.notifications.bodyField', 'Message body')}
						</span>
						<textarea
							value={body}
							onChange={(e) => setBody(e.target.value)}
							placeholder={t(
								'admin.notifications.bodyPlaceholder',
								'Write your message here…',
							)}
							rows={4}
							maxLength={1000}
							className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:border-[#D4A853] focus:ring-1 focus:ring-[#D4A853] outline-none resize-none"
						/>
						<span className="text-[10px] text-gray-400 mt-1">
							{body.length}/1000
						</span>
					</label>

					{/* Preview */}
					{(title || body) && (
						<div className="border-2 border-dashed border-gray-200 rounded-xl p-4 bg-gray-50">
							<p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">
								{t('admin.notifications.preview', 'Preview')}
							</p>
							<div className="bg-white rounded-lg shadow-sm p-3 border border-gray-200">
								<div className="flex items-start gap-2">
									<Bell size={16} className="text-amber-500 shrink-0 mt-0.5" />
									<div>
										<p className="text-sm font-bold text-gray-900">
											{title || '...'}
										</p>
										<p className="text-xs text-gray-600 mt-0.5">
											{body || '...'}
										</p>
									</div>
								</div>
							</div>
						</div>
					)}

					{/* Send button */}
					<div className="flex justify-end pt-4 border-t border-gray-100">
						<button
							type="button"
							onClick={handleSend}
							disabled={sending || !title.trim() || !body.trim()}
							className="px-6 py-2.5 rounded-full bg-[#D4A853] hover:bg-[#B8923F] text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
						>
							{sending ? (
								<Loader2 size={14} className="animate-spin" />
							) : (
								<Send size={14} />
							)}
							{t('admin.notifications.send', 'Send Broadcast')}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
