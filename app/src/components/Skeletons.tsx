/**
 * Loading skeletons used by Suspense boundaries and data-fetching
 * components. Every skeleton is a pure presentational component that
 * animates a `pulse` background — no business logic, no hooks.
 */

export function ProductCardSkeleton() {
	return (
		<div
			data-testid="product-card-skeleton"
			className="bg-white rounded-2xl overflow-hidden border border-[#F0EBE3] animate-pulse">
			<div className="aspect-square bg-[#E5E5E5]" />
			<div className="p-4 space-y-2">
				<div className="h-3 bg-[#E5E5E5] rounded w-3/4" />
				<div className="h-3 bg-[#E5E5E5] rounded w-1/2" />
				<div className="h-4 bg-[#E5E5E5] rounded w-1/3" />
			</div>
		</div>
	);
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
	return (
		<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
			{Array.from({ length: count }).map((_, i) => (
				<ProductCardSkeleton key={i} />
			))}
		</div>
	);
}

export function CategorySkeleton() {
	return (
		<div
			data-testid="category-skeleton"
			className="bg-white rounded-2xl p-4 border border-[#F0EBE3] animate-pulse">
			<div className="aspect-square bg-[#E5E5E5] rounded-xl mb-3" />
			<div className="h-3 bg-[#E5E5E5] rounded w-2/3 mx-auto" />
		</div>
	);
}

export function CategoryGridSkeleton({ count = 6 }: { count?: number }) {
	return (
		<div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-4">
			{Array.from({ length: count }).map((_, i) => (
				<CategorySkeleton key={i} />
			))}
		</div>
	);
}

export function HeroSkeleton() {
	return (
		<div data-testid="hero-skeleton" className="py-16 lg:py-24 animate-pulse">
			<div className="max-w-[1400px] mx-auto px-4 lg:px-8">
				<div className="grid lg:grid-cols-2 gap-12">
					<div className="space-y-4">
						<div className="h-4 bg-[#E5E5E5] rounded w-2/3" />
						<div className="h-12 bg-[#E5E5E5] rounded w-full" />
						<div className="h-6 bg-[#E5E5E5] rounded w-3/4" />
						<div className="h-12 bg-[#E5E5E5] rounded w-full max-w-lg" />
					</div>
					<div className="hidden lg:block aspect-square bg-[#E5E5E5] rounded-2xl" />
				</div>
			</div>
		</div>
	);
}

export function StatsSkeleton() {
	return (
		<div
			data-testid="stats-skeleton"
			className="flex flex-wrap justify-center gap-6 lg:gap-12 animate-pulse">
			{Array.from({ length: 4 }).map((_, i) => (
				<div key={i} className="flex items-center gap-3">
					<div className="w-11 h-11 rounded-full bg-[#E5E5E5]" />
					<div>
						<div className="h-5 bg-[#E5E5E5] rounded w-16 mb-1" />
						<div className="h-3 bg-[#E5E5E5] rounded w-24" />
					</div>
				</div>
			))}
		</div>
	);
}

export function SearchResultSkeleton() {
	return (
		<div
			data-testid="search-result-skeleton"
			className="bg-white rounded border border-[#E5E5E5] p-3 flex gap-3 animate-pulse">
			<div className="w-20 h-20 sm:w-24 sm:h-24 bg-[#E5E5E5] rounded flex-shrink-0" />
			<div className="flex-1 space-y-2">
				<div className="h-3 bg-[#E5E5E5] rounded w-3/4" />
				<div className="h-3 bg-[#E5E5E5] rounded w-1/2" />
				<div className="h-4 bg-[#E5E5E5] rounded w-1/3" />
			</div>
		</div>
	);
}

export function SearchResultsSkeleton({ count = 6 }: { count?: number }) {
	return (
		<div className="space-y-3">
			{Array.from({ length: count }).map((_, i) => (
				<SearchResultSkeleton key={i} />
			))}
		</div>
	);
}
