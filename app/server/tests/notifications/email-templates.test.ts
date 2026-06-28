/**
 * Unit tests for the bilingual email templates.
 * Validates that the render() function produces correct subject + body
 * for each event type × language combination.
 */
import { describe, it, expect } from 'vitest';
import { render, renderBilingual } from '../../lib/notifications/email-templates.cts';

describe('email-templates — render()', () => {
	describe('Arabic (default lang=ar)', () => {
		it('order_placed: subject includes order number, body has totals', () => {
			const { subject, body } = render({
				event: 'order_placed',
				language: 'ar',
				data: { orderNumber: 'ORD-ABC12345', total: 5000, itemCount: 3, paymentMethod: 'cod', trackingUrl: 'https://noufex.example.com/orders/1' },
			});
			expect(subject).toContain('ORD-ABC12345');
			expect(subject).toContain('تم استلام'); // "received" in AR
			expect(body).toContain('5000');
			expect(body).toContain('https://noufex.example.com/orders/1');
		});

		it('payment_confirmed: subject has order number', () => {
			const { subject, body } = render({
				event: 'payment_confirmed',
				language: 'ar',
				data: { orderNumber: 'ORD-XYZ99999', amount: 1500 },
			});
			expect(subject).toContain('ORD-XYZ99999');
			expect(body).toContain('1500');
		});

		it('refund_approved: body reassures the customer', () => {
			const { body } = render({
				event: 'refund_approved',
				language: 'ar',
				data: { orderNumber: 'ORD-12345', amount: 500 },
			});
			expect(body).toContain('500');
			expect(body).toContain('5-10 أيام'); // 5-10 days in AR
		});

		it('welcome: uses the user name', () => {
			const { body } = render({
				event: 'welcome',
				language: 'ar',
				data: { name: 'أحمد' },
			});
			expect(body).toContain('أحمد');
		});
	});

	describe('English', () => {
		it('order_placed: subject is in English', () => {
			const { subject, body } = render({
				event: 'order_placed',
				language: 'en',
				data: { orderNumber: 'ORD-ABC12345', total: 5000, itemCount: 3, paymentMethod: 'cod', trackingUrl: 'https://noufex.example.com/orders/1' },
			});
			expect(subject).toContain('Order');
			expect(subject).toContain('ORD-ABC12345');
			expect(body).toContain('Thanks for your order');
			expect(body).toContain('5000 YER');
		});

		it('refund_rejected: includes the reason', () => {
			const { body } = render({
				event: 'refund_rejected',
				language: 'en',
				data: { orderNumber: 'ORD-12345', amount: 500, reason: 'Outside return window' },
			});
			expect(body).toContain('Outside return window');
		});

		it('review_posted: includes rating and comment', () => {
			const { body } = render({
				event: 'review_posted',
				language: 'en',
				data: { productName: 'Yemeni Honey', rating: 5, comment: 'Excellent!' },
			});
			expect(body).toContain('5-star');
			expect(body).toContain('Yemeni Honey');
			expect(body).toContain('Excellent!');
		});
	});

	describe('Fallback behavior', () => {
		it('unknown language falls back to English', () => {
			const { subject, body } = render({
				event: 'welcome',
				// @ts-expect-error — testing runtime fallback for unknown lang
				language: 'klingon',
				data: { name: 'Worf' },
			});
			expect(body).toContain('Worf');
			expect(subject).toContain('Welcome');
		});

		it('missing language defaults to English', () => {
			const { body } = render({
				event: 'welcome',
				data: { name: 'Anonymous' },
			});
			expect(body).toContain('Anonymous');
		});
	});

	describe('All event types produce non-empty output', () => {
		const events = [
			'order_placed',
			'order_confirmed',
			'order_shipped',
			'payment_confirmed',
			'refund_requested',
			'refund_approved',
			'refund_rejected',
			'dispute_opened',
			'dispute_resolved',
			'review_posted',
			'message_received',
			'welcome',
			'password_reset',
		] as const;
		for (const event of events) {
			it(`${event} — EN has subject and body`, () => {
				const { subject, body } = render({ event, language: 'en', data: { x: 'y' } });
				expect(subject.length).toBeGreaterThan(0);
				expect(body.length).toBeGreaterThan(0);
			});
			it(`${event} — AR has subject and body`, () => {
				const { subject, body } = render({ event, language: 'ar', data: { x: 'y' } });
				expect(subject.length).toBeGreaterThan(0);
				expect(body.length).toBeGreaterThan(0);
			});
		}
	});
});

describe('email-templates — renderBilingual()', () => {
	it('subject is "EN / AR" format', () => {
		const { subject } = renderBilingual({
			event: 'welcome',
			data: { name: 'Test' },
		});
		expect(subject).toContain(' / ');
	});

	it('body contains both EN and AR sections', () => {
		const { body } = renderBilingual({
			event: 'welcome',
			data: { name: 'Test' },
		});
		expect(body).toContain('Welcome');
		expect(body).toContain('مرحباً');
		// Sections separated by a divider
		expect(body).toContain('=======');
	});
});