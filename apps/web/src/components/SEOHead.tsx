/**
 * SEOHead — Unified SEO meta tag manager for Noufex.
 *
 * Implements:
 *   - T001: SEO Meta Tags (title, description)
 *   - T002: Open Graph & Twitter Cards
 *   - T003: Schema.org JSON-LD structured data
 *   - T005: Canonical URLs
 *
 * References:
 *   - Google SEO Starter Guide: https://developers.google.com/search/docs/fundamentals/seo-starter-guide
 *   - Open Graph Protocol: https://ogp.me/
 *   - Schema.org Product: https://schema.org/Product
 *   - Google Ecommerce SEO: https://developers.google.com/search/docs/specialty/ecommerce
 *
 * Usage:
 *   <SEOHead title="Product Name" description="..." image="/products/p1.jpg" />
 */

import { useEffect } from 'react';

interface SEOHeadProps {
	/** Page title (appears in browser tab and search results) */
	title: string;
	/** Meta description (150-160 chars recommended by Google) */
	description: string;
	/** Canonical URL path (e.g. '/product/1') */
	canonical?: string;
	/** Open Graph image URL (absolute or relative) */
	image?: string;
	/** Open Graph type: 'website' | 'product' | 'article' */
	type?: 'website' | 'product' | 'article';
	/** Product-specific: price */
	price?: number;
	/** Product-specific: currency */
	currency?: string;
	/** Product-specific: availability */
	availability?: 'in stock' | 'out of stock';
	/** Product-specific: rating value */
	rating?: number;
	/** Product-specific: review count */
	reviewCount?: number;
	/** Locale (default: 'ar_YE') */
	locale?: string;
	/** Site name */
	siteName?: string;
}

const SITE_NAME = 'Noufex';
const SITE_URL = 'https://noufex.com';
const DEFAULT_IMAGE = '/noufex-logo.svg';
const DEFAULT_LOCALE = 'ar_YE';

export function SEOHead({
	title,
	description,
	canonical,
	image,
	type = 'website',
	price,
	currency = 'YER',
	availability,
	rating,
	reviewCount,
	locale = DEFAULT_LOCALE,
	siteName = SITE_NAME,
}: SEOHeadProps) {
	useEffect(() => {
		const fullTitle = `${title} | ${siteName}`;
		const fullUrl = canonical ? `${SITE_URL}${canonical}` : SITE_URL;
		const fullImage = image?.startsWith('http') ? image : `${SITE_URL}${image || DEFAULT_IMAGE}`;

		// Basic meta tags
		document.title = fullTitle;
		setMeta('description', description);
		setMeta('robots', 'index, follow');
		setLink('canonical', fullUrl);

		// Open Graph
		setProperty('og:title', title);
		setProperty('og:description', description);
		setProperty('og:image', fullImage);
		setProperty('og:url', fullUrl);
		setProperty('og:type', type);
		setProperty('og:site_name', siteName);
		setProperty('og:locale', locale);

		// Twitter Cards
		setMeta('twitter:card', 'summary_large_image');
		setMeta('twitter:title', title);
		setMeta('twitter:description', description);
		setMeta('twitter:image', fullImage);

		// Product-specific Open Graph
		if (type === 'product' && price) {
			setProperty('product:price:amount', String(price));
			setProperty('product:price:currency', currency);
			if (availability) {
				setProperty('product:availability', availability);
			}
		}

		// Structured Data (JSON-LD)
		const jsonLd = buildJsonLd({
			title,
			description,
			fullUrl,
			fullImage,
			type,
			price,
			currency,
			availability,
			rating,
			reviewCount,
		});
		if (jsonLd) {
			let script = document.getElementById('noufex-jsonld') as HTMLScriptElement | null;
			if (!script) {
				script = document.createElement('script');
				script.id = 'noufex-jsonld';
				script.type = 'application/ld+json';
				document.head.appendChild(script);
			}
			script.textContent = JSON.stringify(jsonLd);
		}

		// Cleanup on unmount
		return () => {
			// Restore default title
			document.title = `${siteName} — Yemen & Middle East Marketplace`;
		};
	}, [title, description, canonical, image, type, price, currency, availability, rating, reviewCount, locale, siteName]);

	return null; // This component only manages <head>
}

// ─── Helpers ───────────────────────────────────────────────

function setMeta(name: string, content: string) {
	let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
	if (!el) {
		el = document.createElement('meta');
		el.name = name;
		document.head.appendChild(el);
	}
	el.content = content;
}

function setProperty(property: string, content: string) {
	let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
	if (!el) {
		el = document.createElement('meta');
		el.setAttribute('property', property);
		document.head.appendChild(el);
	}
	el.content = content;
}

function setLink(rel: string, href: string) {
	let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
	if (!el) {
		el = document.createElement('link');
		el.rel = rel;
		document.head.appendChild(el);
	}
	el.href = href;
}

interface JsonLdInput {
	title: string;
	description: string;
	fullUrl: string;
	fullImage: string;
	type: string;
	price?: number;
	currency?: string;
	availability?: string;
	rating?: number;
	reviewCount?: number;
}

function buildJsonLd(input: JsonLdInput): Record<string, unknown> | null {
	if (input.type === 'product' && input.price) {
		return {
			'@context': 'https://schema.org',
			'@type': 'Product',
			name: input.title,
			description: input.description,
			image: input.fullImage,
			url: input.fullUrl,
			offers: {
				'@type': 'Offer',
				price: input.price,
				priceCurrency: input.currency,
				availability: input.availability === 'in stock'
					? 'https://schema.org/InStock'
					: 'https://schema.org/OutOfStock',
			},
			...(input.rating && {
				aggregateRating: {
					'@type': 'AggregateRating',
					ratingValue: input.rating,
					reviewCount: input.reviewCount || 0,
					bestRating: 5,
					worstRating: 1,
				},
			}),
		};
	}

	if (input.type === 'website') {
		return {
			'@context': 'https://schema.org',
			'@type': 'WebSite',
			name: SITE_NAME,
			url: SITE_URL,
			potentialAction: {
				'@type': 'SearchAction',
				target: `${SITE_URL}/search?q={search_term_string}`,
				'query-input': 'required name=search_term_string',
			},
		};
	}

	return null;
}
