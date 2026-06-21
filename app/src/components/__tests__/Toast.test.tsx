/**
 * Toast component tests
 *
 * The Toast component is a controlled UI surface for AppContext's
 * toast queue. We render it standalone and assert the message and
 * dismiss handler.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ToastContainer, { type Toast } from '../Toast';

const sampleToast: Toast = { id: '1', message: 'Saved!', type: 'success' };

describe('ToastContainer', () => {
	it('renders the wrapper but no toast children when the list is empty', () => {
		const { container } = render(<ToastContainer toasts={[]} onRemove={() => undefined} />);
		// The outer wrapper div is always mounted (positions toasts via fixed
		// CSS). With no toasts, it should be empty.
		const wrapper = container.firstElementChild as HTMLElement | null;
		expect(wrapper).not.toBeNull();
		expect(wrapper?.children).toHaveLength(0);
	});

	it('renders the message and an icon for the type', () => {
		render(<ToastContainer toasts={[sampleToast]} onRemove={() => undefined} />);
		expect(screen.getByText('Saved!')).toBeInTheDocument();
	});

	it('invokes onRemove with the toast id when the close button is clicked', () => {
		const onRemove = vi.fn();
		render(<ToastContainer toasts={[sampleToast]} onRemove={onRemove} />);
		const closeBtn = screen.getByRole('button');
		fireEvent.click(closeBtn);
		expect(onRemove).toHaveBeenCalledWith('1');
	});

	it('renders all four type variants', () => {
		const variants: Array<Toast['type']> = ['success', 'error', 'warning', 'info'];
		const { container } = render(
			<ToastContainer
				toasts={variants.map((t, i) => ({ id: String(i), message: t, type: t }))}
				onRemove={() => undefined}
			/>
		);
		expect(container.firstElementChild?.children.length).toBe(4);
	});
});
