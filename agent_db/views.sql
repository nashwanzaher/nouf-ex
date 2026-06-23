-- =====================================================================
-- agent_db — Read-only views
-- =====================================================================
-- All views use `security_invoker` (PG 15+) so they run with the
-- caller's permissions, not the view owner's. Same pattern as
-- database/views.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- v_entries_by_kind — counts per (kind, visibility) for dashboards
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_entries_by_kind
WITH (security_invoker = true)
AS
SELECT
    kind,
    visibility,
    COUNT(*)::int                              AS entry_count,
    COUNT(*) FILTER (WHERE deleted_at IS NULL)::int AS live_count,
    MAX(created_at)                            AS last_created_at
FROM knowledge_entries
GROUP BY kind, visibility;

-- ---------------------------------------------------------------------
-- v_recent_entries — last 100 live entries, newest first
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_recent_entries
WITH (security_invoker = true)
AS
SELECT
    id, kind, title_ar, title_en, summary, visibility,
    payload, source_lang, created_at, updated_at
FROM knowledge_entries
WHERE deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 100;

-- ---------------------------------------------------------------------
-- v_tag_cloud — tags with at least one live entry, ordered by usage
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_tag_cloud
WITH (security_invoker = true)
AS
SELECT
    t.id, t.slug, t.name_ar, t.name_en, t.color,
    t.usage_count,
    COUNT(DISTINCT ket.entry_id) FILTER (WHERE ke.deleted_at IS NULL)::int AS live_entry_count
FROM tags t
LEFT JOIN knowledge_entry_tags ket ON ket.tag_id = t.id
LEFT JOIN knowledge_entries ke     ON ke.id = ket.entry_id
GROUP BY t.id
HAVING COUNT(DISTINCT ket.entry_id) FILTER (WHERE ke.deleted_at IS NULL) > 0
ORDER BY live_entry_count DESC, t.name_ar ASC;

-- ---------------------------------------------------------------------
-- v_entry_graph — adjacency list of entry links for graph traversals
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_entry_graph
WITH (security_invoker = true)
AS
SELECT
    source_entry_id,
    target_entry_id,
    relation,
    s.kind AS source_kind,
    t.kind AS target_kind
FROM entry_links el
JOIN knowledge_entries s ON s.id = el.source_entry_id AND s.deleted_at IS NULL
JOIN knowledge_entries t ON t.id = el.target_entry_id AND t.deleted_at IS NULL;
