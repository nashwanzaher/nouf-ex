/**
 * Skeleton loading placeholders.
 *
 * Renders shimmering blocks while the API is in flight. The visual
 * shape matches the final card so layout does NOT shift on load
 * (Cumulative Layout Shift = 0, the metric Google ranks).
 *
 * Used by every page that calls `useProducts` / `useStores` / etc.
 * before its first fetch resolves. Drops in for the same container
 * so the parent <section> can hold either {skeleton} or {content}
 * without additional layout wrappers.
 */
import type { JSX } from 'react';

export interface SkeletonProps {
	className?: string;
}

export function SkeletonBlock({ className = '' }: SkeletonProps) {
	return (
		<div aria-hidden="true" className={`animate-pulse rounded-md bg-[#F3EDE4] ${className}`} />
	);
}

export function SkeletonProductCard() {
	return (
		<div className="bg-white rounded-2xl border border-[#F3EDE4] overflow-hidden">
			<SkeletonBlock className="aspect-square w-full" />
			<div className="p-4 space-y-2">
				<SkeletonBlock className="h-4 w-3/4" />
				<SkeletonBlock className="h-3 w-1/2" />
				<div className="flex gap-2 mt-3">
					<SkeletonBlock className="h-4 w-1/3" />
					<SkeletonBlock className="h-4 w-1/3" />
				</div>
			</div>
		</div>
	);
}

export function SkeletonCategoryCard() {
	return (
		<div className="text-center space-y-3">
			<SkeletonBlock className="aspect-square w-full rounded-2xl" />
			<SkeletonBlock className="h-4 w-2/3 mx-auto" />
		</div>
	);
}

export interface SkeletonGridProps {
	count?: number;
	Card: () => JSX.Element;
	className?: string;
}

export function SkeletonGrid({ count = 4, Card, className = '' }: SkeletonGridProps) {
	return (
		<div
			className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 ${className}`}
		>
			{Array.from({ length: count }).map((_, i) => (
				<Card key={i} />
			))}
		</div>
	);
}
