-- =====================================================================
-- agent_db — PL/pgSQL trigger functions
-- =====================================================================
-- Mirrors the pattern in database/functions.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- trg_set_updated_at() — bumps `updated_at` on every UPDATE
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------
-- fn_upsert_tag() — atomic "find-or-create" for tags by slug
-- ---------------------------------------------------------------------
-- Returns the tag id, creating the row if missing. Centralised here so
-- the application never has to think about race conditions on the tag
-- taxonomy.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_upsert_tag(
    p_slug    TEXT,
    p_name_ar TEXT,
    p_name_en TEXT DEFAULT NULL,
    p_color   TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_id INTEGER;
BEGIN
    SELECT id INTO v_id FROM tags WHERE slug = p_slug;
    IF v_id IS NULL THEN
        INSERT INTO tags (slug, name_ar, name_en, color)
        VALUES (p_slug, p_name_ar, p_name_en, p_color)
        RETURNING id INTO v_id;
    END IF;
    RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------
-- fn_snapshot_entry() — captures the current state of an entry into
-- knowledge_entry_revisions BEFORE the UPDATE is applied.
-- ---------------------------------------------------------------------
-- The trigger calling this runs BEFORE UPDATE, so OLD.* is still the
-- pre-edit row. We compute the next revision_number atomically.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_snapshot_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_next INTEGER;
BEGIN
    SELECT COALESCE(MAX(revision_number), 0) + 1
      INTO v_next
      FROM knowledge_entry_revisions
     WHERE entry_id = OLD.id;
    INSERT INTO knowledge_entry_revisions
        (entry_id, revision_number, title_ar, title_en, body_ar, body_en, payload, editor_id, edit_summary)
    VALUES
        (OLD.id, v_next, OLD.title_ar, OLD.title_en, OLD.body_ar, OLD.body_en, OLD.payload, OLD.updated_by, 'pre-update');
    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------
-- fn_bump_tag_usage() — keeps tags.usage_count in sync with the
-- knowledge_entry_tags join table.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_bump_tag_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE tags SET usage_count = usage_count + 1 WHERE id = NEW.tag_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE tags SET usage_count = GREATEST(0, usage_count - 1) WHERE id = OLD.tag_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;
