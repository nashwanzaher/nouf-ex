/**
 * OpenAPI JSON generator — invoked by `npm run openapi:generate`.
 *
 * Boots a tiny Node process that uses the source `buildOpenApiDocument`
 * via `tsx` (the same runner the API uses in dev). The output is a
 * deterministic JSON file we ship in git so consumers (the SDK
 * package, contract tests, docs site) don't need a live API.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// shared.ts reads DATABASE_URL at module-load time. The OpenAPI
// generator doesn't touch the DB, so we stub it with a dummy
// connection string. Production callers should not run this with
// a real DSN — it's a build-time artifact.
process.env.DATABASE_URL ??= 'postgres://openapi-generator:noop@localhost:5432/noufex_db';
process.env.AUTH_SECRET ??= 'openapi-generator-dummy-secret-must-be-at-least-32-chars';
process.env.ALLOWED_ORIGINS ??= 'http://localhost:3000';

const { buildOpenApiDocument } = await import('../../apps/api/src/lib/openapi.ts');

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');

const doc = buildOpenApiDocument();

const outPaths = [
	resolve(repoRoot, 'apps/api/openapi.generated.json'),
	resolve(repoRoot, 'packages/api-client/openapi.generated.json'),
];

for (const out of outPaths) {
	mkdirSync(dirname(out), { recursive: true });
	writeFileSync(out, JSON.stringify(doc, null, 2) + '\n', 'utf8');
	console.log(`✓ wrote ${out}`);
}