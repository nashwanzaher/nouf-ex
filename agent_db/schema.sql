-- =====================================================================
-- agent_db — Base schema (agent_db)
-- =====================================================================
-- Purpose: central knowledge base for information, experiences, skills,
-- and reference material. Connects as `agent_app` (least-privilege role).
--
-- Conventions (mirroring database/):
--   * Identity columns:  GENERATED ALWAYS AS IDENTITY (PG 17 standard)
--   * Timestamps:        TIMESTAMPTZ everywhere
--   * Soft delete:       deleted_at TIMESTAMPTZ NULL on user-facing tables
--   * Bilingual:         title_ar NOT NULL, title_en / body_en nullable
--   * FTS:               STORED generated tsvector with two configs
--   * updated_at:        maintained by trg_set_updated_at
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS citext;        -- case-insensitive email/slug
CREATE EXTENSION IF NOT EXISTS pgcrypto;      -- gen_random_uuid()
-- (no vector extension — pure keyword search via tsvector is enough for v1)

-- =====================================================================
-- KNOWLEDGE ENTRIES — unified table for all four entry kinds
-- =====================================================================
-- discriminator: `kind` ∈ {information, experience, skill, reference}
-- kind-specific fields live in `payload` (JSONB) so the FTS, tags, and
-- revisions layer stays uniform across kinds.
-- =====================================================================
CREATE TABLE IF NOT EXISTS knowledge_entries (
    id                INTEGER     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    kind              VARCHAR(20) NOT NULL
        CHECK (kind IN ('information', 'experience', 'skill', 'reference')),
    title_ar          TEXT        NOT NULL CHECK (title_ar <> ''),
    title_en          TEXT,
    body_ar           TEXT,
    body_en           TEXT,
    summary           TEXT,
    slug              VARCHAR(120) UNIQUE,
    payload           JSONB       NOT NULL DEFAULT '{}'::jsonb,
    source_lang       VARCHAR(5)  NOT NULL DEFAULT 'ar'
        CHECK (source_lang IN ('ar', 'en', 'zh')),
    visibility        VARCHAR(20) NOT NULL DEFAULT 'private'
        CHECK (visibility IN ('private', 'team', 'public')),
    -- Bilingual FTS — Arabic gets weight A (titles), English gets B.
    -- The GIN index lives on this column; do not add a per-locale index.
    search_tsv        TSVECTOR
        GENERATED ALWAYS AS (
            setweight(to_tsvector('arabic',
                coalesce(title_ar, '') || ' ' || coalesce(body_ar, '')), 'A') ||
            setweight(to_tsvector('english',
                coalesce(title_en, '') || ' ' || coalesce(body_en, '')), 'B')
        ) STORED,
    -- Author tracking. `users` here is the same table as noufex_db.users
    -- in spirit, but kept as a local self-contained table so agent_db
    -- has no cross-DB foreign-key dependency.
    created_by        INTEGER     NOT NULL,
    updated_by        INTEGER,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at        TIMESTAMPTZ
);

-- GIN for FTS (the only way tsvector scales to millions of rows).
CREATE INDEX        IF NOT EXISTS idx_ke_search_tsv
    ON knowledge_entries USING GIN (search_tsv);
-- BRIN for the timeline (matches the pattern in noufex_db's `users` table).
CREATE INDEX        IF NOT EXISTS idx_ke_created_brin
    ON knowledge_entries USING BRIN (created_at);
-- Filtering by kind × visibility is the hottest read path.
CREATE INDEX        IF NOT EXISTS idx_ke_kind_vis
    ON knowledge_entries (kind, visibility) WHERE deleted_at IS NULL;
-- Partial unique on slug — the global UNIQUE above can collide across
-- the soft-deleted set; the live set must remain conflict-free.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ke_slug_live
    ON knowledge_entries (slug) WHERE deleted_at IS NULL AND slug IS NOT NULL;
-- Payload GIN — for kind-specific queries (e.g. "all skills with
-- proficiency_level >= 4").
CREATE INDEX        IF NOT EXISTS idx_ke_payload_gin
    ON knowledge_entries USING GIN (payload jsonb_path_ops)
    WHERE deleted_at IS NULL;

-- =====================================================================
-- KNOWLEDGE ENTRY REVISIONS — immutable history
-- =====================================================================
-- One row per save. The application inserts BEFORE the UPDATE so the
-- previous state is captured; the row itself is never modified.
-- =====================================================================
CREATE TABLE IF NOT EXISTS knowledge_entry_revisions (
    id                INTEGER     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    entry_id          INTEGER     NOT NULL
        REFERENCES knowledge_entries(id) ON DELETE CASCADE,
    revision_number   INTEGER     NOT NULL,
    title_ar          TEXT        NOT NULL,
    title_en          TEXT,
    body_ar           TEXT,
    body_en           TEXT,
    payload           JSONB       NOT NULL DEFAULT '{}'::jsonb,
    editor_id         INTEGER     NOT NULL,
    edit_summary      TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (entry_id, revision_number)
);
CREATE INDEX IF NOT EXISTS idx_ker_entry ON knowledge_entry_revisions(entry_id);
CREATE INDEX IF NOT EXISTS idx_ker_created_brin
    ON knowledge_entry_revisions USING BRIN (created_at);

-- =====================================================================
-- TAGS — taxonomy (hierarchical via self-reference)
-- =====================================================================
CREATE TABLE IF NOT EXISTS tags (
    id                INTEGER     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    parent_id         INTEGER     REFERENCES tags(id) ON DELETE SET NULL,
    slug              VARCHAR(60) NOT NULL UNIQUE,
    name_ar           TEXT        NOT NULL CHECK (name_ar <> ''),
    name_en           TEXT,
    color             VARCHAR(7),           -- e.g. #ff8800
    usage_count       INTEGER     NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tags_parent ON tags(parent_id);
CREATE INDEX IF NOT EXISTS idx_tags_usage  ON tags(usage_count DESC) WHERE usage_count > 0;

-- =====================================================================
-- ENTRY ↔ TAG (M2M)
-- =====================================================================
CREATE TABLE IF NOT EXISTS knowledge_entry_tags (
    entry_id          INTEGER     NOT NULL
        REFERENCES knowledge_entries(id) ON DELETE CASCADE,
    tag_id            INTEGER     NOT NULL
        REFERENCES tags(id) ON DELETE CASCADE,
    tagged_by         INTEGER,
    tagged_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (entry_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_ket_tag ON knowledge_entry_tags(tag_id);

-- =====================================================================
-- SKILL DEPENDENCIES — M2M between skill entries and the experiences
-- that built them
-- =====================================================================
-- Only meaningful for kind='skill' / kind='experience' rows, but the
-- table is plain and lets the application enforce kind constraints.
-- =====================================================================
CREATE TABLE IF NOT EXISTS skill_dependencies (
    skill_entry_id    INTEGER     NOT NULL
        REFERENCES knowledge_entries(id) ON DELETE CASCADE,
    experience_entry_id INTEGER   NOT NULL
        REFERENCES knowledge_entries(id) ON DELETE CASCADE,
    proficiency_delta SMALLINT    NOT NULL DEFAULT 1
        CHECK (proficiency_delta BETWEEN -5 AND 5),
    note              TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (skill_entry_id, experience_entry_id),
    CHECK (skill_entry_id <> experience_entry_id)
);
CREATE INDEX IF NOT EXISTS idx_sd_experience
    ON skill_dependencies(experience_entry_id);

-- =====================================================================
-- ENTRY LINKS — directed cross-references
-- =====================================================================
-- e.g. an "experience" row can link to a "reference" (the book that
-- taught the lesson) and to a "skill" (the resulting capability).
-- =====================================================================
CREATE TABLE IF NOT EXISTS entry_links (
    id                INTEGER     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_entry_id   INTEGER     NOT NULL
        REFERENCES knowledge_entries(id) ON DELETE CASCADE,
    target_entry_id   INTEGER     NOT NULL
        REFERENCES knowledge_entries(id) ON DELETE CASCADE,
    relation          VARCHAR(20) NOT NULL DEFAULT 'related'
        CHECK (relation IN ('related', 'see_also', 'derived_from', 'contradicts', 'applies_to')),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (source_entry_id, target_entry_id, relation),
    CHECK (source_entry_id <> target_entry_id)
);
CREATE INDEX IF NOT EXISTS idx_el_target ON entry_links(target_entry_id);
CREATE INDEX IF NOT EXISTS idx_el_source ON entry_links(source_entry_id);

-- =====================================================================
-- MIGRATION TRACKER — idempotent setup like noufex_db's schema_migrations
-- =====================================================================
CREATE TABLE IF NOT EXISTS schema_migrations (
    version           VARCHAR(20) PRIMARY KEY,
    description       TEXT        NOT NULL,
    applied_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
