// filepath: scripts/drop-test-db.cjs
// Drop a test database safely (terminate connections first).
const path = require('node:path');
const { Client } = require(path.join(process.cwd(), 'app', 'node_modules', 'pg'));
const db = process.argv[2] || 'noufex_db_verify';

(async () => {
  const c = new Client({ connectionString: 'postgresql://postgres:***REDACTED***@localhost:5432/postgres' });
  await c.connect();
  try {
    await c.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
       WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [db],
    );
  } catch (_) { /* db might not exist */ }
  try {
    await c.query(`DROP DATABASE IF EXISTS "${db}"`);
    console.log('  ' + db + ' dropped');
  } catch (e) {
    console.log('  drop failed: ' + e.message);
  }
  await c.end();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
