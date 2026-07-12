/**
 * Skeletons tests
 *
 * Skeletons are pure presentational placeholders. We assert that each
 * named export renders without crashing and contains an `animate-pulse`
 * class (Tailwind) so the visual feedback works.
 */

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
	ProductCardSkeleton,
	CategorySkeleton,
	HeroSkeleton,
	StatsSkeleton,
	SearchResultSkeleton,
} from '../Skeletons';

const targets: Array<[string, React.ComponentType]> = [
	['ProductCardSkeleton', ProductCardSkeleton],
	['CategorySkeleton', CategorySkeleton],
	['HeroSkeleton', HeroSkeleton],
	['StatsSkeleton', StatsSkeleton],
	['SearchResultSkeleton', SearchResultSkeleton],
];

describe('Skeletons', () => {
	for (const [name, Cmp] of targets) {
		it(`${name} renders an animated placeholder`, () => {
			const { container } = render(<Cmp />);
			expect(container.querySelector('.animate-pulse')).not.toBeNull();
		});
	}
});
