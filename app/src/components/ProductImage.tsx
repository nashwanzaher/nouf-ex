/**
 * ProductImage - safe <img> wrapper with:
 *   - correct URL resolution (see lib/utils/safe-format.ts)
 *   - skeleton placeholder while loading
 *   - error fallback to a bundled /images/placeholder.svg
 *   - bilingual alt text
 *
 * The <img> never has a broken src because safeImageUrl() always
 * returns a valid path. The `onError` handler kicks in if the
 * server responds 404 for the resolved path, swapping in the
 * project-wide placeholder.
 */
import { useState } from 'react';
import { safeImageUrl } from '@/lib/utils/safe-format';

const FALLBACK = '/images/placeholder.svg';

export interface ProductImageProps {
	src?: string | null;
	alt: string;
	altEn?: string;
	className?: string;
	kind?: 'product' | 'category' | 'store';
}

export function ProductImage({
	src,
	alt,
	altEn,
	className = '',
	kind = 'product',
}: ProductImageProps) {
	const initialSrc = safeImageUrl(src, { fallback: FALLBACK, kind });
	const [currentSrc, setCurrentSrc] = useState(initialSrc);
	const [isLoading, setIsLoading] = useState(true);
	const [hasErrored, setHasErrored] = useState(false);

	return (
		<div className={`relative overflow-hidden bg-[#F8F8F8] ${className}`}>
			{isLoading && !hasErrored && (
				<div aria-hidden="true" className="absolute inset-0 animate-pulse bg-[#F3EDE4]" />
			)}
			<img
				src={currentSrc}
				alt={altEn ? `${alt} / ${altEn}` : alt}
				loading="lazy"
				decoding="async"
				className={`relative w-full h-full object-cover transition-opacity duration-300 ${
					isLoading ? 'opacity-0' : 'opacity-100'
				}`}
				onLoad={() => setIsLoading(false)}
				onError={() => {
					if (hasErrored) return;
					setHasErrored(true);
					setCurrentSrc(FALLBACK);
					setIsLoading(false);
				}}
			/>
		</div>
	);
}
