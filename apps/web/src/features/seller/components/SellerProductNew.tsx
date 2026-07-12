/**
 * SellerProductNew — full-page host for the AddProductDialog.
 *
 * Route: /seller/products/new
 *
 * Renders the new single-page `AddProductDialog` (instant data entry)
 * inside the seller `DashboardShell`. The dialog is opened on mount
 * so the seller immediately sees the form. Closing it navigates back
 * to /seller/products.
 *
 * The previous multi-step `AddProductWizard` is still exported from
 * SellerProducts.tsx for any caller that still needs the legacy
 * 6-step flow.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import DashboardShell from './DashboardShell';
import { AddProductDialog } from './AddProductDialog';

export default function SellerProductNew() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	// Open the dialog on first render so the seller sees the form immediately.
	const [open, setOpen] = useState(true);

	const handleClose = () => {
		setOpen(false);
		// Give AnimatePresence a tick to run the exit animation before
		// swapping the route. Without this, the dialog visually pops
		// out instead of fading.
		setTimeout(() => {
			navigate('/seller/products', { replace: true });
		}, 200);
	};

	return (
		<DashboardShell title={t('seller.product.new', 'New Product')}>
			<div className="space-y-4">
				<p className="text-sm text-aliTextSec">
					{t(
						'seller.product.newSubtitle',
						'Add a new product — only the essentials required.',
					)}
				</p>
				<div className="bg-white rounded-2xl p-6 text-center text-aliTextMute">
					{t(
						'seller.product.dialogOpening',
						'The add-product dialog is opening…',
					)}
				</div>
			</div>
			{/* The dialog is auto-opened on mount. Closing it routes back. */}
			<AddProductDialog open={open} onClose={handleClose} />
		</DashboardShell>
	);
}
