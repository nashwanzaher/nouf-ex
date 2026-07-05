// filepath: scripts/audit-db.cjs
// Comprehensive DB audit: tables, columns, FKs, indexes, triggers, view defs.
const path = require('node:path');
const fs = require('node:fs');
const APP_NM = path.join(__dirname, '..', 'app', 'node_modules');
const { Client } = require(path.join(APP_NM, 'pg'));

const envPath = path.join(__dirname, '..', '.env');
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

(async () => {
  const c = new Client({
    host: process.env.DB_HOST, port: +process.env.DB_PORT,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  await c.connect();

  // 1. All tables + their declared primary key
  const tabs = await c.query(`
    SELECT t.table_name,
           (SELECT string_agg(c.column_name, ', ' ORDER BY c.ordinal_position)
            FROM information_schema.columns c
            WHERE c.table_schema = t.table_schema AND c.table_name = t.table_name
              AND c.column_name IN (SELECT kcu.column_name
                                     FROM information_schema.key_column_usage kcu
                                     JOIN information_schema.table_constraints tc
                                       ON tc.constraint_name = kcu.constraint_name
                                     WHERE tc.table_name = t.table_name
                                       AND tc.table_schema = t.table_schema
                                       AND tc.constraint_type = 'PRIMARY KEY')
           ) AS pkey_cols
    FROM information_schema.tables t
    WHERE t.table_schema='public' AND t.table_type='BASE TABLE'
    ORDER BY t.table_name
  `);
  console.log('=== TABLES (with PK) ===');
  tabs.rows.forEach((r) => console.log(`  ${r.table_name.padEnd(28)} PK(${r.pkey_cols})`));

  // 2. Foreign keys grouped by child table
  const fks = await c.query(`
    SELECT tc.table_name AS child, kcu.column_name AS child_col,
           ccu.table_name AS parent, ccu.column_name AS parent_col,
           rc.delete_rule AS on_delete, rc.update_rule AS on_update
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name
    JOIN information_schema.constraint_column_usage ccu
      ON rc.unique_constraint_name = ccu.constraint_name
    WHERE tc.table_schema='public' AND tc.constraint_type='FOREIGN KEY'
    ORDER BY tc.table_name, kcu.column_name
  `);
  console.log('\n=== FOREIGN KEYS ===');
  fks.rows.forEach((r) =>
    console.log(`  ${r.child}.${r.child_col} -> ${r.parent}.${r.parent_col} ON DELETE ${r.on_delete}`),
  );

  // 3. Indexes (non-pkey, non-unique-constraint)
  const idx = await c.query(`
    SELECT schemaname, tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname='public'
    ORDER BY tablename, indexname
  `);
  console.log('\n=== INDEXES ===');
  idx.rows.forEach((r) => {
    const kind = r.indexdef.match(/USING (\w+)/)?.[1] || '?';
    console.log(`  ${r.tablename.padEnd(28)} ${r.indexname.padEnd(40)} [${kind}]`);
  });

  // 4. Triggers grouped by table
  const trig = await c.query(`
    SELECT trigger_name, event_object_table, action_timing, event_manipulation
    FROM information_schema.triggers
    WHERE trigger_schema='public'
    ORDER BY event_object_table, trigger_name
  `);
  console.log('\n=== TRIGGERS ===');
  const trigByTable = {};
  trig.rows.forEach((r) => {
    trigByTable[r.event_object_table] = trigByTable[r.event_object_table] || [];
    trigByTable[r.event_object_table].push(`${r.trigger_name} (${r.action_timing} ${r.event_manipulation})`);
  });
  Object.entries(trigByTable).forEach(([tbl, list]) => {
    console.log(`  ${tbl}:`);
    list.forEach((t) => console.log(`    - ${t}`));
  });

  // 5. View definitions
  const views = await c.query(`
    SELECT table_name, view_definition
    FROM information_schema.views
    WHERE table_schema='public'
    ORDER BY table_name
  `);
  console.log('\n=== VIEWS ===');
  views.rows.forEach((r) => {
    const head = r.view_definition.split('\n')[0].slice(0, 80);
    console.log(`  ${r.table_name}: ${head}…`);
  });

  // 6. Check constraints per table
  const chk = await c.query(`
    SELECT tc.table_name, cc.constraint_name, cc.check_clause
    FROM information_schema.table_constraints tc
    JOIN information_schema.check_constraints cc
      ON tc.constraint_name = cc.constraint_name
    WHERE tc.table_schema='public' AND tc.constraint_type='CHECK'
    ORDER BY tc.table_name, cc.constraint_name
  `);
  console.log('\n=== CHECK CONSTRAINTS ===');
  chk.rows.forEach((r) =>
    console.log(`  ${r.table_name}.${r.constraint_name}: ${r.check_clause.slice(0, 60)}…`),
  );

  // 7. Sequences
  const seqs = await c.query(`
    SELECT sequence_name, last_value
    FROM information_schema.sequences
    WHERE sequence_schema='public'
    ORDER BY sequence_name
  `);
  console.log('\n=== SEQUENCES (last values) ===');
  seqs.rows.forEach((r) => console.log(`  ${r.sequence_name}: ${r.last_value}`));

  await c.end();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
