-- =====================================================================
-- agent_db — Trigger definitions
-- =====================================================================
-- Wires the functions in functions.sql to the tables in schema.sql.
-- Mirrors database/triggers.sql.
-- =====================================================================

-- updated_at maintenance
DROP TRIGGER IF EXISTS trg_ke_set_updated_at ON knowledge_entries;
CREATE TRIGGER trg_ke_set_updated_at
    BEFORE UPDATE ON knowledge_entries
    FOR EACH ROW
    EXECUTE FUNCTION trg_set_updated_at();

DROP TRIGGER IF EXISTS trg_tags_set_updated_at ON tags;
CREATE TRIGGER trg_tags_set_updated_at
    BEFORE UPDATE ON tags
    FOR EACH ROW
    EXECUTE FUNCTION trg_set_updated_at();

-- Snapshot to revisions on every UPDATE
DROP TRIGGER IF EXISTS trg_ke_snapshot ON knowledge_entries;
CREATE TRIGGER trg_ke_snapshot
    BEFORE UPDATE ON knowledge_entries
    FOR EACH ROW
    EXECUTE FUNCTION fn_snapshot_entry();

-- Tag usage counter
DROP TRIGGER IF EXISTS trg_ket_bump_usage ON knowledge_entry_tags;
CREATE TRIGGER trg_ket_bump_usage
    AFTER INSERT OR DELETE ON knowledge_entry_tags
    FOR EACH ROW
    EXECUTE FUNCTION fn_bump_tag_usage();
