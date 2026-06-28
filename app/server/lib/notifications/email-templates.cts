/**
 * Bilingual email templates — Arabic + English.
 *
 * Each event type has two localized variants. The dispatcher picks the
 * variant based on `user.preferred_language` (defaults to Arabic).
 *
 * Templates are plain-text only (no HTML) for two reasons:
 *   1. Phishing-resistance — fewer ways for an attacker to inject markup
 *      that bypasses the receiver's email client sandbox.
 *   2. Simpler — the `Content-Type: text/plain` MIME type means we
 *      never need an HTML sanitizer in the pipeline.
 *
 * Bilingual layout: EN at the top, AR below, separated by a line of `=`.
 * This works in every email client and side-steps the RTL/LTR direction
 * problem (each block is internally consistent; we just display both).
 */

export type EventType =
	| 'order_placed'
	| 'order_confirmed'
	| 'order_shipped'
	| 'payment_confirmed'
	| 'refund_requested'
	| 'refund_approved'
	| 'refund_rejected'
	| 'dispute_opened'
	| 'dispute_resolved'
	| 'review_posted'
	| 'message_received'
	| 'welcome'
	| 'password_reset';

export interface TemplateInput {
	event: EventType;
	language?: 'ar' | 'en' | 'zh';
	/** Arbitrary data the template needs (orderId, amount, etc.). */
	data: Record<string, string | number>;
}

/**
 * Render the subject + body for a (event, language) pair.
 * Falls back to English for unknown languages.
 */
export function render(input: TemplateInput): { subject: string; body: string } {
	const lang = input.language ?? 'en';
	const en = renderEN(input.event, input.data);
	const ar = renderAR(input.event, input.data);
	if (lang === 'ar') return ar;
	if (lang === 'zh') return { subject: en.subject, body: en.body }; // zh fallback: EN
	return en;
}

/**
 * Two-language wrapper for when the receiver's language is unknown
 * or the notification is system-level (e.g., password reset).
 * Always returns the same structure as `render()`.
 */
export function renderBilingual(input: {
	event: EventType;
	data: Record<string, string | number>;
}): {
	subject: string;
	body: string;
} {
	const en = renderEN(input.event, input.data);
	const ar = renderAR(input.event, input.data);
	return {
		subject: `${en.subject} / ${ar.subject}`,
		body: `${en.body}\n\n========================================\n\n${ar.body}`,
	};
}

// ---------------------------------------------------------------------------
// English templates
// ---------------------------------------------------------------------------
function renderEN(
	event: EventType,
	data: Record<string, string | number>,
): { subject: string; body: string } {
	switch (event) {
		case 'order_placed':
			return {
				subject: `Order #${data.orderNumber} received`,
				body: [
					`Hi,`,
					``,
					`Thanks for your order #${data.orderNumber} on Nouf-ex.`,
					``,
					`  Total:        ${data.total} YER`,
					`  Items:        ${data.itemCount}`,
					`  Payment:      ${data.paymentMethod}`,
					``,
					`We'll notify you when your order is confirmed and shipped.`,
					``,
					`Track your order: ${data.trackingUrl}`,
					``,
					`Thank you for shopping with us.`,
					`— The Nouf-ex team`,
				].join('\n'),
			};

		case 'order_confirmed':
			return {
				subject: `Order #${data.orderNumber} confirmed`,
				body: [
					`Hi,`,
					``,
					`Good news! Your order #${data.orderNumber} has been confirmed by the seller.`,
					``,
					`It's being prepared for shipment.`,
					``,
					`— The Nouf-ex team`,
				].join('\n'),
			};

		case 'order_shipped':
			return {
				subject: `Order #${data.orderNumber} shipped`,
				body: [
					`Hi,`,
					``,
					`Your order #${data.orderNumber} is on its way!`,
					``,
					`Tracking: ${data.trackingNumber ?? 'pending'}`,
					``,
					`— The Nouf-ex team`,
				].join('\n'),
			};

		case 'payment_confirmed':
			return {
				subject: `Payment for order #${data.orderNumber} confirmed`,
				body: [
					`Hi,`,
					``,
					`We received your payment of ${data.amount} YER for order #${data.orderNumber}.`,
					``,
					`— The Nouf-ex team`,
				].join('\n'),
			};

		case 'refund_requested':
			return {
				subject: `Refund request received for order #${data.orderNumber}`,
				body: [
					`Hi,`,
					``,
					`We received your refund request for order #${data.orderNumber}.`,
					`Amount: ${data.amount} YER`,
					``,
					`Our team will review and respond within 2 business days.`,
					``,
					`— The Nouf-ex team`,
				].join('\n'),
			};

		case 'refund_approved':
			return {
				subject: `Refund approved for order #${data.orderNumber}`,
				body: [
					`Hi,`,
					``,
					`Great news! Your refund of ${data.amount} YER for order #${data.orderNumber} has been approved.`,
					``,
					`The amount will be credited back to your original payment method within 5-10 business days.`,
					``,
					`— The Nouf-ex team`,
				].join('\n'),
			};

		case 'refund_rejected':
			return {
				subject: `Refund request declined for order #${data.orderNumber}`,
				body: [
					`Hi,`,
					``,
					`Unfortunately, your refund request for order #${data.orderNumber} was declined.`,
					``,
					`Reason: ${data.reason ?? 'not specified'}`,
					``,
					`If you have questions, please contact our support.`,
					``,
					`— The Nouf-ex team`,
				].join('\n'),
			};

		case 'dispute_opened':
			return {
				subject: `Dispute opened on order #${data.orderNumber}`,
				body: [
					`Hi,`,
					``,
					`A dispute has been opened on order #${data.orderNumber}.`,
					`Subject: ${data.subject ?? 'not specified'}`,
					``,
					`Our team will review and respond within 24 hours.`,
					``,
					`— The Nouf-ex team`,
				].join('\n'),
			};

		case 'dispute_resolved':
			return {
				subject: `Dispute resolved on order #${data.orderNumber}`,
				body: [
					`Hi,`,
					``,
					`The dispute on order #${data.orderNumber} has been resolved.`,
					`Resolution: ${data.resolution ?? 'see order details'}`,
					``,
					`— The Nouf-ex team`,
				].join('\n'),
			};

		case 'review_posted':
			return {
				subject: `New review on ${data.productName ?? 'your product'}`,
				body: [
					`Hi,`,
					``,
					`A new ${data.rating}-star review was posted on your product "${data.productName ?? 'N/A'}".`,
					``,
					`Comment: ${data.comment ?? '(no comment)'}`,
					``,
					`— The Nouf-ex team`,
				].join('\n'),
			};

		case 'message_received':
			return {
				subject: `New message from ${data.senderName ?? 'a user'}`,
				body: [
					`Hi,`,
					``,
					`You have a new message from ${data.senderName ?? 'a user'}.`,
					``,
					`Preview: ${data.preview ?? '(no preview)'}`,
					``,
					`Reply: ${data.inboxUrl ?? 'https://noufex.example.com/messages'}`,
					``,
					`— The Nouf-ex team`,
				].join('\n'),
			};

		case 'welcome':
			return {
				subject: `Welcome to Nouf-ex, ${data.name ?? ''}!`,
				body: [
					`Hi ${data.name ?? 'there'},`,
					``,
					`Welcome to Nouf-ex — the trusted B2B/B2C marketplace for Yemen and the Middle East.`,
					``,
					`Get started: browse products, follow your favorite stores, and enjoy secure payments.`,
					``,
					`— The Nouf-ex team`,
				].join('\n'),
			};

		case 'password_reset':
			return {
				subject: `Reset your Nouf-ex password`,
				body: [
					`Hi,`,
					``,
					`We received a request to reset your Nouf-ex password.`,
					``,
					`Reset link (valid 1 hour): ${data.resetUrl ?? 'https://noufex.example.com/reset'}`,
					``,
					`If you didn't request this, you can safely ignore this email.`,
					``,
					`— The Nouf-ex team`,
				].join('\n'),
			};
	}
}

// ---------------------------------------------------------------------------
// Arabic templates
// ---------------------------------------------------------------------------
function renderAR(
	event: EventType,
	data: Record<string, string | number>,
): { subject: string; body: string } {
	switch (event) {
		case 'order_placed':
			return {
				subject: `تم استلام طلبك رقم #${data.orderNumber}`,
				body: [
					`مرحباً،`,
					``,
					`شكراً لطلبك رقم #${data.orderNumber} في نوف-إكس.`,
					``,
					`  الإجمالي:        ${data.total} ريال`,
					`  عدد المنتجات:   ${data.itemCount}`,
					`  طريقة الدفع:    ${data.paymentMethod}`,
					``,
					`سنُعلمك فور تأكيد الطلب وشحنه.`,
					``,
					`تتبع طلبك: ${data.trackingUrl}`,
					``,
					`شكراً لتسوقك معنا.`,
					`— فريق نوف-إكس`,
				].join('\n'),
			};

		case 'order_confirmed':
			return {
				subject: `تم تأكيد طلبك رقم #${data.orderNumber}`,
				body: [
					`مرحباً،`,
					``,
					`أخبار سارة! تم تأكيد طلبك رقم #${data.orderNumber} من قبل البائع.`,
					``,
					`يتم الآن تجهيزه للشحن.`,
					``,
					`— فريق نوف-إكس`,
				].join('\n'),
			};

		case 'order_shipped':
			return {
				subject: `تم شحن طلبك رقم #${data.orderNumber}`,
				body: [
					`مرحباً،`,
					``,
					`طلبك رقم #${data.orderNumber} في الطريق إليك!`,
					``,
					`رقم التتبع: ${data.trackingNumber ?? 'قيد التجهيز'}`,
					``,
					`— فريق نوف-إكس`,
				].join('\n'),
			};

		case 'payment_confirmed':
			return {
				subject: `تم تأكيد الدفع لطلبك رقم #${data.orderNumber}`,
				body: [
					`مرحباً،`,
					``,
					`تم استلام دفعتك بمبلغ ${data.amount} ريال لطلبك رقم #${data.orderNumber}.`,
					``,
					`— فريق نوف-إكس`,
				].join('\n'),
			};

		case 'refund_requested':
			return {
				subject: `تم استلام طلب استرداد لطلبك رقم #${data.orderNumber}`,
				body: [
					`مرحباً،`,
					``,
					`تم استلام طلب الاسترداد لطلبك رقم #${data.orderNumber}.`,
					`المبلغ: ${data.amount} ريال`,
					``,
					`سيراجع فريقنا الطلب ويرد خلال يومي عمل.`,
					``,
					`— فريق نوف-إكس`,
				].join('\n'),
			};

		case 'refund_approved':
			return {
				subject: `تمت الموافقة على الاسترداد لطلبك رقم #${data.orderNumber}`,
				body: [
					`مرحباً،`,
					``,
					`أخبار سارة! تمت الموافقة على استردادك بمبلغ ${data.amount} ريال لطلبك رقم #${data.orderNumber}.`,
					``,
					`سيتم رد المبلغ إلى وسيلة الدفع الأصلية خلال 5-10 أيام عمل.`,
					``,
					`— فريق نوف-إكس`,
				].join('\n'),
			};

		case 'refund_rejected':
			return {
				subject: `تم رفض طلب الاسترداد لطلبك رقم #${data.orderNumber}`,
				body: [
					`مرحباً،`,
					``,
					`للأسف، تم رفض طلب الاسترداد لطلبك رقم #${data.orderNumber}.`,
					``,
					`السبب: ${data.reason ?? 'غير محدد'}`,
					``,
					`للاستفسار، يرجى التواصل مع الدعم.`,
					``,
					`— فريق نوف-إكس`,
				].join('\n'),
			};

		case 'dispute_opened':
			return {
				subject: `تم فتح نزاع على طلبك رقم #${data.orderNumber}`,
				body: [
					`مرحباً،`,
					``,
					`تم فتح نزاع على طلبك رقم #${data.orderNumber}.`,
					`الموضوع: ${data.subject ?? 'غير محدد'}`,
					``,
					`سيراجع فريقنا النزاع ويرد خلال 24 ساعة.`,
					``,
					`— فريق نوف-إكس`,
				].join('\n'),
			};

		case 'dispute_resolved':
			return {
				subject: `تم حل النزاع على طلبك رقم #${data.orderNumber}`,
				body: [
					`مرحباً،`,
					``,
					`تم حل النزاع على طلبك رقم #${data.orderNumber}.`,
					`الحل: ${data.resolution ?? 'راجع تفاصيل الطلب'}`,
					``,
					`— فريق نوف-إكس`,
				].join('\n'),
			};

		case 'review_posted':
			return {
				subject: `تقييم جديد على ${data.productName ?? 'منتجك'}`,
				body: [
					`مرحباً،`,
					``,
					`تم نشر تقييم جديد ${data.rating} نجوم على منتجك "${data.productName ?? 'غير متوفر'}".`,
					``,
					`التعليق: ${data.comment ?? '(بدون تعليق)'}`,
					``,
					`— فريق نوف-إكس`,
				].join('\n'),
			};

		case 'message_received':
			return {
				subject: `رسالة جديدة من ${data.senderName ?? 'مستخدم'}`,
				body: [
					`مرحباً،`,
					``,
					`لديك رسالة جديدة من ${data.senderName ?? 'مستخدم'}.`,
					``,
					`معاينة: ${data.preview ?? '(لا توجد معاينة)'}`,
					``,
					`الرد: ${data.inboxUrl ?? 'https://noufex.example.com/messages'}`,
					``,
					`— فريق نوف-إكس`,
				].join('\n'),
			};

		case 'welcome':
			return {
				subject: `مرحباً بك في نوف-إكس، ${data.name ?? ''}!`,
				body: [
					`مرحباً ${data.name ?? ''}،`,
					``,
					`مرحباً بك في نوف-إكس — السوق الموثوق B2B/B2C لليمن والشرق الأوسط.`,
					``,
					`ابدأ الآن: تصفح المنتجات، تابع متاجرك المفضلة، واستمتع بمدفوعات آمنة.`,
					``,
					`— فريق نوف-إكس`,
				].join('\n'),
			};

		case 'password_reset':
			return {
				subject: `إعادة تعيين كلمة المرور في نوف-إكس`,
				body: [
					`مرحباً،`,
					``,
					`تلقّينا طلباً لإعادة تعيين كلمة مرورك في نوف-إكس.`,
					``,
					`رابط الإعادة (صالح ساعة): ${data.resetUrl ?? 'https://noufex.example.com/reset'}`,
					``,
					`إذا لم تطلب ذلك، يمكنك تجاهل هذا البريد بأمان.`,
					``,
					`— فريق نوف-إكس`,
				].join('\n'),
			};
	}
}
