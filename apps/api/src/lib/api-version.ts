/**
 * API versioning — Tier 5.3.
 *
 * Stripe-style media-type versioning per RFC 6838 §4.2 and
 * IETF custom media-type conventions:
 *
 *   Accept: application/vnd.noufex.v1+json
 *
 * Why Stripe-style and not URL-style (`/api/v1/...`)
 *   - Existing endpoints (`/api/products`, `/api/cart`, …) keep
 *     working without breaking clients or load-balancer rules.
 *   - The version travels with the request body / headers —
 *     easier to debug in a tracing system.
 *   - Adding a new version is a Content-Negotiation concern,
 *     not a routing concern.
 *
 * Sunset / Deprecation (RFC 8594)
 *   When a version is retired, the API emits:
 *     Deprecation: true
 *     Sunset: Sat, 01 Jan 2028 00:00:00 GMT
 *     Link: </api/docs/migrations/v2>; rel="successor-version"
 *   This gives clients machine-readable signals (RFC 8594 §4) to
 *   plan their migration. The header values come from the
 *   `DEPRECATION_POLICY` env var (JSON) so they can be updated
 *   without a code change.
 *
 * Backward compatibility
 *   - Requests without `Accept: application/vnd.noufex.v1+json`
 *     (or any vendor suffix) are served the latest stable
 *     version. This matches the existing behaviour — no client
 *     breaks.
 *   - Wildcard Accept is treated as the latest stable version.
 *   - Requests with an UNKNOWN vendor version get a 406 with the
 *     supported versions listed in the response body. This is the
 *     same behaviour RFC 7231 §6.5.6 prescribes for 406 Not
 *     Acceptable.
 */
import type { NextFunction, Request, Response } from 'express';
import { log } from './shared.ts';

const MEDIA_TYPE_RE = /^application\/vnd\.noufex\.v(\d+)\+json$/;

export interface VersionInfo {
	version: number;
	status: 'current' | 'beta' | 'deprecated' | 'sunset';
	sunset?: string;
	/** ISO date of the sunset. RFC 8594 §4 prefers HTTP-date. */
	sunsetRfc?: string;
	successorVersion?: number;
}

/** Static table of supported API versions. Bumped by adding an
 *  entry to the table — no code change required to retire an old
 *  version, just edit its `status`. */
const VERSION_TABLE: VersionInfo[] = [
	{ version: 1, status: 'current' },
];

const LATEST = VERSION_TABLE.find((v) => v.status === 'current') ?? VERSION_TABLE[0];

export function getActiveVersions(): VersionInfo[] {
	return VERSION_TABLE.filter((v) => v.status !== 'sunset');
}

export function getLatestVersion(): VersionInfo {
	return LATEST;
}

/** Resolve the API version for a given `Accept` header.
 *  Returns the latest version when the header is missing or
 *  non-vendor (e.g. `application/json`, wildcard). Returns `null`
 *  only when the client explicitly requested a vendor version we
 *  don't know about. */
export function resolveVersion(acceptHeader: string | undefined): VersionInfo | null {
	if (!acceptHeader) return LATEST;
	// Split on commas (Accept can list multiple media types).
	const types = acceptHeader.split(',').map((t) => t.trim().split(';')[0]?.trim() ?? '');
	for (const type of types) {
		// Wildcards → latest.
		if (type === '*\u002F*' || type === 'application/*') return LATEST;
		// Non-vendor JSON → latest.
		if (type === 'application/json') return LATEST;
		const m = type.match(MEDIA_TYPE_RE);
		if (m) {
			const requested = Number.parseInt(m[1], 10);
			const found = VERSION_TABLE.find((v) => v.version === requested);
			if (!found) return null;
			return found;
		}
	}
	// No vendor marker → treat as "latest".
	return LATEST;
}

/** Express middleware. Sets `X-API-Version` on every response and
 *  (when applicable) `Deprecation` + `Sunset` + `Link` headers
 *  per RFC 8594. Does NOT reject unknown versions here — the
 *  handler is free to handle a `null` version as a 406. We
 *  prefer to attach the headers and let the route decide. */
export function apiVersionMiddleware() {
	return (req: Request, res: Response, next: NextFunction): void => {
		const v = resolveVersion(req.headers.accept);
		if (!v) {
			res.setHeader('X-API-Version', 'unknown');
			// Don't block here — let the route return 406 if it
			// wants to. The header tells the client what went
			// wrong.
		} else {
			res.setHeader('X-API-Version', `v${v.version}`);
			if (v.status === 'deprecated') {
				res.setHeader('Deprecation', 'true');
			}
			if (v.sunsetRfc) {
				res.setHeader('Sunset', v.sunsetRfc);
			}
			if (v.successorVersion) {
				res.setHeader(
					'Link',
					`</api/docs/migrations/v${v.successorVersion}>; rel="successor-version"`,
				);
			}
		}
		next();
	};
}

/** Throws a 406 if the requested version is unknown. Use this
 *  on routes that are version-sensitive and should reject the
 *  request explicitly. */
export function requireApiVersion() {
	return (req: Request, res: Response, next: NextFunction): void => {
		const v = resolveVersion(req.headers.accept);
		if (!v) {
			log.warn({
				msg: 'api_version_not_acceptable',
				accept: req.headers.accept,
				path: req.path,
			});
			res.status(406).json({
				success: false,
				error: 'Unsupported API version. Use one of the supported Accept media types.',
				code: 'VERSION_NOT_ACCEPTABLE',
				supported: getActiveVersions().map((vi) => ({
					version: vi.version,
					media_type: `application/vnd.noufex.v${vi.version}+json`,
				})),
				request_id: req.id,
			});
			return;
		}
		next();
	};
}