// Vitest setup file for @noufex/api.
// Loaded before every test file. Its job is to populate process.env
// from the repo-root .env so the modules under test (which read
// DATABASE_URL / AUTH_SECRET at import time) don't fail with
// "DATABASE_URL is not set".
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

dotenv.config({ path: path.join(repoRoot, '.env'), quiet: true });
