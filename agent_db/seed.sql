-- =====================================================================
-- agent_db — Demo seed data
-- =====================================================================
-- Idempotent via ON CONFLICT — safe to re-run.
-- Seeds a small taxonomy (10 tags) + 4 entries (one per kind) so the
-- schema is immediately queryable end-to-end.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tag taxonomy
-- ---------------------------------------------------------------------
INSERT INTO tags (slug, name_ar, name_en, color) VALUES
    ('programming', 'برمجة',         'Programming',  '#3b82f6'),
    ('arabic',      'عربي',          'Arabic',       '#10b981'),
    ('postgresql',  'PostgreSQL',     'PostgreSQL',   '#336791'),
    ('typescript',  'TypeScript',     'TypeScript',   '#3178c6'),
    ('react',       'React',          'React',        '#61dafb'),
    ('security',    'أمن',            'Security',     '#ef4444'),
    ('performance', 'أداء',           'Performance',  '#f59e0b'),
    ('architecture', 'معمارية',       'Architecture', '#8b5cf6'),
    ('devops',      'DevOps',         'DevOps',       '#06b6d4'),
    ('ux',          'تجربة مستخدم',   'UX',           '#ec4899')
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------
-- 2. One entry per kind (information / experience / skill / reference)
-- ---------------------------------------------------------------------
-- created_by = 1 (placeholder author id; the application is responsible
-- for mapping the real user id at write time).
-- ---------------------------------------------------------------------

-- 2a. INFORMATION — a note about the project
INSERT INTO knowledge_entries
    (kind, title_ar, title_en, body_ar, body_en, summary, slug, payload, visibility, created_by)
VALUES
    ('information',
     'معمارية المعرفة المركزية',
     'Central knowledge architecture',
     'تستخدم قاعدة البيانات agent_db لتخزين المعلومات، الخبرات، المهارات، والمراجع بشكل موحّد.',
     'The agent_db is used to store information, experiences, skills, and references in a unified schema.',
     'Single source of truth for personal/team knowledge with FTS in ar+en.',
     'central-knowledge-architecture',
     '{"domain": "architecture", "importance": "high"}'::jsonb,
     'team', 1)
ON CONFLICT (slug) DO NOTHING;

-- 2b. EXPERIENCE — a lesson learned
INSERT INTO knowledge_entries
    (kind, title_ar, title_en, body_ar, body_en, summary, slug, payload, visibility, created_by)
VALUES
    ('experience',
     'دائماً راجع عدد المصيد (catch) في كتل try/catch',
     'Always review the catch count in try/catch blocks',
     'اكتشاف 35 كتلة catch بدون return في server/index.ts كاد يسبب ERR_HTTP_HEADERS_SENT صامت. القاعدة: كل sendError() داخل catch يجب أن يكون مسبوقًا بـ return.',
     'Finding 35 catch blocks without return in server/index.ts almost caused silent ERR_HTTP_HEADERS_SENT. Rule: every sendError() inside a catch must be preceded by return.',
     'Silent double-send prevention rule for Express handlers.',
     'always-return-from-catch',
     '{"outcome": "success", "severity": "critical", "commit": "b7bf701"}'::jsonb,
     'team', 1)
ON CONFLICT (slug) DO NOTHING;

-- 2c. SKILL — a capability
INSERT INTO knowledge_entries
    (kind, title_ar, title_en, body_ar, body_en, summary, slug, payload, visibility, created_by)
VALUES
    ('skill',
     'تصميم قواعد بيانات PostgreSQL متقدّمة',
     'Advanced PostgreSQL schema design',
     'تصميم schemas مع IDENTITY، TIMESTAMPTZ، CHECK constraints، GIN/BRIN indexes، PL/pgSQL triggers، Least-Privilege roles.',
     'Designing schemas with IDENTITY, TIMESTAMPTZ, CHECK constraints, GIN/BRIN indexes, PL/pgSQL triggers, Least-Privilege roles.',
     'Comfortable designing production-grade PostgreSQL schemas end-to-end.',
     'advanced-postgresql-design',
     '{"proficiency_level": 4, "years_experience": 5}'::jsonb,
     'private', 1)
ON CONFLICT (slug) DO NOTHING;

-- 2d. REFERENCE — a citation
INSERT INTO knowledge_entries
    (kind, title_ar, title_en, body_ar, body_en, summary, slug, payload, visibility, created_by)
VALUES
    ('reference',
     'OWASP Secure Headers Project',
     'OWASP Secure Headers Project',
     'مجموعة أساسية من رؤوس HTTP الأمنية: CSP، HSTS، X-Frame-Options، Referrer-Policy، Permissions-Policy.',
     'Baseline set of security HTTP headers: CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy.',
     'Authoritative reference for the securityHeaders middleware in Nouf-ex.',
     'owasp-secure-headers',
     '{"url": "https://owasp.org/www-project-secure-headers/", "citation_count": 1}'::jsonb,
     'public', 1)
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------
-- 3. Tag the seeded entries
-- ---------------------------------------------------------------------
-- (idempotent via ON CONFLICT DO NOTHING on the composite PK)
-- ---------------------------------------------------------------------
INSERT INTO knowledge_entry_tags (entry_id, tag_id, tagged_by)
SELECT ke.id, t.id, 1
FROM knowledge_entries ke, tags t
WHERE (ke.slug, t.slug) IN (
    ('central-knowledge-architecture', 'architecture'),
    ('central-knowledge-architecture', 'postgresql'),
    ('always-return-from-catch',       'typescript'),
    ('always-return-from-catch',       'programming'),
    ('advanced-postgresql-design',     'postgresql'),
    ('advanced-postgresql-design',     'architecture'),
    ('owasp-secure-headers',           'security')
)
ON CONFLICT (entry_id, tag_id) DO NOTHING;
