import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, Edit3, Home, Loader2, MapPin, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/AppContext';
import type { Address as ApiAddress, CreateAddressBody } from '@/lib/api';
import {
    deleteAddress as apiDeleteAddress,
    createAddress,
    formatApiError,
    getAddresses,
    updateAddress,
} from '@/lib/api';
import CustomerSidebar from './CustomerSidebar';

const yemeniGovernorates = [
	'صنعاء',
	'عدن',
	'تعز',
	'الحديدة',
	'إب',
	'المحويت',
	'ذمار',
	'البيضاء',
	'مأرب',
	'الجوف',
	'عمران',
	'صعدة',
	'حجة',
	'ريمة',
	'الضالع',
	'لحج',
	'أبين',
	'شبوة',
	'المهرة',
	'حضرموت',
	'سقطرى',
];

export default function Addresses() {
	const { t } = useTranslation();
	const { user, isAuthenticated, addToast } = useAuth();

	const [addresses, setAddresses] = useState<ApiAddress[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingId, setEditingId] = useState<number | null>(null);
	const [form, setForm] = useState<Partial<CreateAddressBody>>({});

	// Load addresses from the server on mount + when the user logs in/out.
	useEffect(() => {
		let cancelled = false;
		async function load() {
			if (!isAuthenticated || !user) {
				setAddresses([]);
				setLoading(false);
				return;
			}
			try {
				const list = await getAddresses(Number(user.id));
				if (!cancelled) setAddresses(Array.isArray(list) ? list : []);
			} catch {
				if (!cancelled) {
					addToast({
						message: t('addresses.loadError', 'Could not load addresses'),
						type: 'error',
					});
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		}
		void load();
		return () => {
			cancelled = true;
		};
	}, [isAuthenticated, user, t, addToast]);

	const openAdd = () => {
		setEditingId(null);
		setForm({ is_default: false });
		setDialogOpen(true);
	};

	const openEdit = (addr: ApiAddress) => {
		setEditingId(addr.id);
		setForm({
			label: addr.label,
			full_name: addr.full_name,
			phone: addr.phone,
			governorate: addr.governorate,
			city: addr.city,
			district: addr.district ?? undefined,
			street: addr.street,
			building: addr.building ?? undefined,
			notes: addr.notes ?? undefined,
			is_default: addr.is_default ?? false,
		});
		setDialogOpen(true);
	};

	/** Save the current form (create or update). Real network call —
	 *  the previous version only mutated local React state and the edit
	 *  was lost on reload. */
	const saveAddress = async () => {
		const missing: string[] = [];
		if (!form.label) missing.push(t('addresses.label', 'Label'));
		if (!form.full_name) missing.push(t('addresses.fullName', 'Full name'));
		if (!form.phone) missing.push(t('addresses.phone', 'Phone'));
		if (!form.governorate) missing.push(t('addresses.governorate', 'Governorate'));
		if (!form.city) missing.push(t('addresses.city', 'City'));
		if (!form.street) missing.push(t('addresses.street', 'Street'));
		if (missing.length > 0) {
			addToast({
				message: t('addresses.requiredFieldsMissing', { defaultValue: 'Please fill in: {{fields}}', fields: missing.join(', ') }),
				type: 'error',
			});
			return;
		}
		if (!user) return;
		const body: CreateAddressBody = {
			label: form.label ?? '',
			full_name: form.full_name ?? '',
			phone: form.phone ?? '',
			governorate: form.governorate ?? '',
			city: form.city ?? '',
			district: form.district ?? '',
			street: form.street ?? '',
			building: form.building ?? '',
			notes: form.notes ?? '',
			is_default: form.is_default,
		};
		setSaving(true);
		try {
			if (editingId) {
				const updated = await updateAddress(editingId, body);
				setAddresses((prev) => prev.map((a) => (a.id === editingId ? updated : a)));
				addToast({
					message: t('addresses.updateSuccess', 'Address updated'),
					type: 'success',
				});
			} else {
				const created = await createAddress(body);
				setAddresses((prev) => [...prev, created]);
				addToast({
					message: t('addresses.createSuccess', 'Address added'),
					type: 'success',
				});
			}
			setDialogOpen(false);
		} catch (err) {
			addToast({
				// R-15 §51: localized message from ErrorCodes catalog.
				message:
					formatApiError(err) ||
					t('addresses.saveError', 'Could not save address'),
				type: 'error',
			});
		} finally {
			setSaving(false);
		}
	};

	const deleteAddress = async (id: number) => {
		try {
			await apiDeleteAddress(id);
			setAddresses((prev) => prev.filter((a) => a.id !== id));
			addToast({ message: t('addresses.deleteSuccess', 'Address deleted'), type: 'success' });
		} catch (err) {
			addToast({
				message:
					formatApiError(err) ||
					t('addresses.deleteError', 'Could not delete'),
				type: 'error',
			});
		}
	};

	/** Set an address as the user's default. The backend clears the
	 *  `is_default` flag on every other row in the same transaction,
	 *  so we just refresh the local list to mirror the new state. */
	const setDefault = async (id: number) => {
		const current = addresses.find((a) => a.id === id);
		if (!current) return;
		try {
			const updated = await updateAddress(id, {
				label: current.label,
				full_name: current.full_name,
				phone: current.phone,
				governorate: current.governorate,
				city: current.city,
				district: current.district ?? undefined,
				street: current.street,
				building: current.building ?? undefined,
				notes: current.notes ?? undefined,
				is_default: true,
			});
			setAddresses((prev) =>
				prev.map((a) => (a.id === id ? updated : { ...a, is_default: false })),
			);
			addToast({
				message: t('addresses.defaultSet', 'Default address updated'),
				type: 'success',
			});
		} catch (err) {
			addToast({
				// R-15 §51: localized message from ErrorCodes catalog.
				message:
					formatApiError(err) ||
					t('addresses.saveError', 'Could not save address'),
				type: 'error',
			});
		}
	};

	return (
		<div className="min-h-[100dvh] bg-[#F8F8F8]" dir="rtl">
			<CustomerSidebar />

			<div className="md:mr-60 min-h-[100dvh]">
				<div className="bg-white border-b border-[#F3EDE4] px-6 py-4 sticky top-0 z-30 flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-amiri font-bold text-[#1A1612]">
							{t('addresses.title', 'My Addresses')}
						</h1>
						<p className="text-sm text-[#6B6B6B] font-cairo mt-0.5">
							{t('addresses.subtitle', 'Manage your delivery addresses')}
						</p>
					</div>
					<Button
						onClick={openAdd}
						className="bg-[#0F7B6C] hover:bg-[#0a6356] text-white"
					>
						<Plus className="w-4 h-4 ml-1" />
						{t('addresses.addNew', 'Add New')}
					</Button>
				</div>

				<div className="p-6 max-w-4xl">
					{loading ? (
						<div className="flex items-center justify-center py-12 text-[#6B6B6B]">
							<Loader2 className="w-5 h-5 animate-spin ml-2" />
							{t('common.loading', 'Loading...')}
						</div>
					) : addresses.length === 0 ? (
						<div className="bg-white rounded-2xl p-10 text-center shadow-sm">
							<MapPin
								className="w-12 h-12 mx-auto text-[#D4A853] mb-3"
								strokeWidth={1.5}
							/>
							<h2 className="text-xl font-amiri font-bold text-[#1A1612] mb-2">
								{t('addresses.emptyTitle', 'No saved addresses')}
							</h2>
							<p className="text-sm text-[#6B6B6B] font-cairo mb-4">
								{t(
									'addresses.emptyHint',
									'Add an address to speed up checkout and order tracking.',
								)}
							</p>
							<Button
								onClick={openAdd}
								className="bg-[#0F7B6C] hover:bg-[#0a6356] text-white"
							>
								<Plus className="w-4 h-4 ml-1" />
								{t('addresses.addNew', 'Add New')}
							</Button>
						</div>
					) : (
						<div className="grid gap-4 sm:grid-cols-2">
							{addresses.map((addr) => (
								<div
									key={addr.id}
									className={`bg-white rounded-2xl p-5 shadow-sm border-2 transition-colors ${
										addr.is_default ? 'border-[#0F7B6C]' : 'border-transparent'
									}`}
								>
									<div className="flex items-start justify-between mb-3">
										<div className="flex items-center gap-2">
											<div className="w-10 h-10 rounded-full bg-[#F3EDE4] flex items-center justify-center">
												<Home
													className="w-5 h-5 text-[#0F7B6C]"
													strokeWidth={1.5}
												/>
											</div>
											<div>
												<h3 className="text-base font-bold text-[#1A1612] font-cairo">
													{addr.label}
												</h3>
												{addr.is_default && (
													<span className="inline-flex items-center gap-1 text-[11px] text-[#0F7B6C] font-semibold font-cairo">
														<CheckCircle className="w-3 h-3" />
														{t('addresses.default', 'Default')}
													</span>
												)}
											</div>
										</div>
										<div className="flex items-center gap-1">
											<button
												type="button"
												onClick={() => openEdit(addr)}
												aria-label={t('addresses.edit', 'Edit')}
												className="p-2 rounded-lg hover:bg-[#F3EDE4] transition-colors text-[#6B6B6B]"
											>
												<Edit3 className="w-4 h-4" />
											</button>
											<button
												type="button"
												onClick={() => deleteAddress(addr.id)}
												aria-label={t('addresses.delete', 'Delete')}
												className="p-2 rounded-lg hover:bg-[#F3EDE4] transition-colors text-[#B85C5C]"
											>
												<Trash2 className="w-4 h-4" />
											</button>
										</div>
									</div>
									<div className="text-sm text-[#1A1612] font-cairo space-y-1">
										<p className="font-semibold">{addr.full_name}</p>
										<p className="text-[#6B6B6B]">{addr.phone}</p>
										<p className="text-[#6B6B6B]">
											{addr.street}
											{addr.building ? `, ${addr.building}` : ''}
										</p>
										<p className="text-[#6B6B6B]">
											{addr.district ? `${addr.district}, ` : ''}
											{addr.city}, {addr.governorate}
										</p>
										{addr.notes && (
											<p className="text-xs text-[#9A9A9A] mt-2 italic">
												{addr.notes}
											</p>
										)}
									</div>
									{!addr.is_default && (
										<button
											type="button"
											onClick={() => setDefault(addr.id)}
											className="mt-3 text-xs text-[#0F7B6C] hover:underline font-cairo font-semibold"
										>
											{t('addresses.setDefault', 'Set as default')}
										</button>
									)}
								</div>
							))}
						</div>
					)}
				</div>
			</div>

			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent className="max-w-lg">
					<DialogHeader>
						<DialogTitle className="font-amiri text-xl">
							{editingId
								? t('addresses.dialogTitleEdit', 'Edit Address')
								: t('addresses.dialogTitleAdd', 'Add New Address')}
						</DialogTitle>
					</DialogHeader>
					<div className="space-y-4 mt-2">
						<div>
							<Label className="text-sm font-medium mb-1.5 block">
								{t('addresses.label', 'Label (e.g. Home, Office)')}
							</Label>
							<Input
								value={form.label ?? ''}
								onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
								placeholder="Home"
								className="h-11"
							/>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div>
								<Label className="text-sm font-medium mb-1.5 block">
									{t('addresses.fullName', 'Full name')}
								</Label>
								<Input
									value={form.full_name ?? ''}
									onChange={(e) =>
										setForm((p) => ({ ...p, full_name: e.target.value }))
									}
									className="h-11"
								/>
							</div>
							<div>
								<Label className="text-sm font-medium mb-1.5 block">
									{t('addresses.phone', 'Phone')}
								</Label>
								<Input
									value={form.phone ?? ''}
									onChange={(e) =>
										setForm((p) => ({ ...p, phone: e.target.value }))
									}
									className="h-11"
									dir="ltr"
								/>
							</div>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div>
								<Label className="text-sm font-medium mb-1.5 block">
									{t('addresses.governorate', 'Governorate')}
								</Label>
								<select
									value={form.governorate ?? ''}
									onChange={(e) =>
										setForm((p) => ({ ...p, governorate: e.target.value }))
									}
									className="w-full h-11 px-3 rounded-md border border-[#E8DCC8] bg-white text-sm font-cairo"
								>
									<option value="">{t('addresses.selectGov', 'Select…')}</option>
									{yemeniGovernorates.map((g) => (
										<option key={g} value={g}>
											{g}
										</option>
									))}
								</select>
							</div>
							<div>
								<Label className="text-sm font-medium mb-1.5 block">
									{t('addresses.city', 'City')}
								</Label>
								<Input
									value={form.city ?? ''}
									onChange={(e) =>
										setForm((p) => ({ ...p, city: e.target.value }))
									}
									className="h-11"
								/>
							</div>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div>
								<Label className="text-sm font-medium mb-1.5 block">
									{t('addresses.district', 'District')}
								</Label>
								<Input
									value={form.district ?? ''}
									onChange={(e) =>
										setForm((p) => ({ ...p, district: e.target.value }))
									}
									className="h-11"
								/>
							</div>
							<div>
								<Label className="text-sm font-medium mb-1.5 block">
									{t('addresses.street', 'Street')}
								</Label>
								<Input
									value={form.street ?? ''}
									onChange={(e) =>
										setForm((p) => ({ ...p, street: e.target.value }))
									}
									className="h-11"
								/>
							</div>
						</div>
						<div>
							<Label className="text-sm font-medium mb-1.5 block">
								{t('addresses.building', 'Building / Floor / Apartment')}
							</Label>
							<Input
								value={form.building ?? ''}
								onChange={(e) =>
									setForm((p) => ({ ...p, building: e.target.value }))
								}
								className="h-11"
							/>
						</div>
						<div>
							<Label className="text-sm font-medium mb-1.5 block">
								{t('addresses.notes', 'Delivery notes')}
							</Label>
							<Textarea
								value={form.notes ?? ''}
								onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
								rows={2}
							/>
						</div>
						<label className="flex items-center gap-2 text-sm font-cairo">
							<input
								type="checkbox"
								checked={Boolean(form.is_default)}
								onChange={(e) =>
									setForm((p) => ({ ...p, is_default: e.target.checked }))
								}
							/>
							{t('addresses.setAsDefault', 'Set as default address')}
						</label>
					</div>
					<div className="flex justify-end gap-2 mt-4">
						<Button
							variant="outline"
							onClick={() => setDialogOpen(false)}
							disabled={saving}
						>
							{t('common.cancel', 'Cancel')}
						</Button>
						<Button
							onClick={saveAddress}
							disabled={saving}
							className="bg-[#0F7B6C] hover:bg-[#0a6356] text-white"
						>
							{saving && <Loader2 className="w-4 h-4 ml-1 animate-spin" />}
							{editingId ? t('common.save', 'Save') : t('addresses.addNew', 'Add')}
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
