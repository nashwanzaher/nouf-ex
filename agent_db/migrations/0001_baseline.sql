-- =====================================================================
-- agent_db — Baseline migration (0001)
-- =====================================================================
-- Tracks the initial 5-table schema. Run by db-setup.cjs to mark the
-- baseline as applied.
-- =====================================================================
INSERT INTO schema_migrations (version, description)
VALUES ('0001', 'Initial schema: knowledge_entries + revisions + tags + links + revisions + schema_migrations')
ON CONFLICT (version) DO NOTHING;
