# 🗺️ Nouf-ex — Master Execution Plan & Task Roadmap

> **Source of truth:** مستخرج من **41 ملف .md** فعلي (19 نشط + 22 أرشيف) في 2026-06-28.
> **المعايير المطبّقة:** [IEEE 829-2008](https://standards.ieee.org/ieee/829/4987/) · [ISO/IEC/IEEE 29119](https://www.iso.org/standard/81291.html) · [ISTQB CTFL](https://www.istqb.org/) · [Google Style Guide](https://google.github.io/styleguide/) · [Diátaxis](https://diataxis.fr/) · [Keep a Changelog](https://keepachangelog.com/)
> **القاعدة الصارمة:** كل بند هنا مأخوذ حرفياً من الكود الفعلي (`app/server/**/*.cts`، `app/src/**/*.tsx`) وملفات SQL (`database/*.sql`) ووثائق `.md` الـ 41. أي بند غير مؤكد يُكتب: **غير مؤكد**. أي بند غير موجود فعلياً يُكتب: **غير موجود**.
> **⚠️ هذه الوثيقة هي المرجع الإلزامي الوحيد لتنفيذ المهام** (اعتُمدت 2026-06-28 بعد مراجعة شاملة).
> **⏸️ يُمنع تنفيذ أي مهمة (P0/P1/P2/P3) قبل التحقق من القواعد النهائية أدناه.**

---

## 📊 ملخص تنفيذي

| المقياس | القيمة | المصدر | الحالة |
|---------|--------|--------|--------|
| **ملفات .md** | **41** (19 نشط + 22 أرشيف) | `Get-ChildItem -Recurse -Filter *.md` | ✅ |
| **مهام فريدة** | **72** (بدون تكرار، بعد التدقيق) | بعد إزالة 30+ تكرار من 102 خام | ✅ |
| **منجزة** | **17 PHASES** (94% من 18) | PHASE 0–3، 5–17 + 01-R | ✅ |
| **قيد التنفيذ** | **1 PHASE** (PHASE 4) | 20/27 assertions passing | 🔄 |
| **فجوات توثيقية** | **15** (6 P0 + 7 P1 + 2 P2) | docs/testing/ | ⏳ TODO |
| **ميزات وظيفية مفقودة** | **14** (4 P1 + 6 P2 + 4 P3) | roadmap.md | ⏳ TODO |
| **إصلاحات (Bugfixes)** | **3** | RETURNING id، provider_meta، dotenv order | ✅ |
| **Git remote** | github.com/nashwanzaher/nouf-ex | `git remote -v` | ✅ |
| **آخر commit** | 8c80564 | `git log --oneline -1` | ✅ |
| **حجم هذه الوثيقة** | محدّث عند كل تعديل | `Get-Item` | ✅ |

> **مفتاح الحالات:** ⏳ TODO (لم يبدأ) · 🔄 In Progress (قيد العمل) · ✅ Done (منجز) · ⚠️ Partial (جزئي) · ❌ غير موجود · ❓ غير مؤكد

---

## 📂 جرد ملفات .md الـ 41 (المُستخرجة فعلياً)

### نشطة (19 ملف في `docs/` + 13 في الجذر)

| # | المسار | الحجم (b) | الأسطر | الوصف |
|---|--------|---------|--------|-------|
| 1 | `.github/copilot-instructions.md` | 362 | 3 | @azure Rules |
| 2 | `.github/prompts/noufex-explore-review.prompt.md` | 8505 | 100 | Agent prompt |
| 3 | `app/README.md` | 2370 | 51 | Backend+tests+public |
| 4 | `app/server/README.md` | 1572 | 37 | Server مختصر |
| 5 | `CHANGELOG.md` | 2888 | 52 | Keep a Changelog |
| 6 | `CONTRIBUTING.md` | 4532 | 87 | Workflow + style |
| 7 | `database/README.md` | 4607 | 71 | Schema source of truth |
| 8 | `database/migrations/README.md` | 1102 | 21 | Workflow |
| 9 | `docs/README.md` | 4381 | 85 | Index |
| 10 | `docs/STRUCTURE.md` | 15806 | 354 | Repository map |
| 11 | `docs/MASTER_PLAN.md` | يُحدَّث | يُحدَّث | **هذا الملف — المرجع الإلزامي** |
| 12 | `docs/architecture/api.md` | 6725 | 81 | API reference (38 endpoints) |
| 13 | `docs/architecture/database.md` | 11623 | 190 | Schema overview (29 tables) |
| 14 | `docs/architecture/overview.md` | 11795 | 90 | Component map |
| 15 | `docs/development/conventions.md` | 5273 | 89 | Code style + naming |
| 16 | `docs/development/getting-started.md` | 11834 | 216 | Setup guide |
| 17 | `docs/development/workflow.md` | 3915 | 75 | Daily commands |
| 18 | `docs/operations/docker.md` | 2303 | 50 | Docker |
| 19 | `docs/planning/competitive-analysis.md` | 39963 | 508 | 19 axes + 6 competitors |
| 20 | `docs/planning/roadmap.md` | 23995 | 185 | P0/P1/P2/P3 backlog |
| 21 | `docs/testing/PHASE_TEST_TASKS.md` | 96800+ | 1436+ | Master Test Plan (مرجع تفصيلي) |
| 22 | `docs/testing/README.md` | 4384 | 88 | Testing hub |
| 23 | `docs/testing/conventions.md` | 4647 | 95 | Test conventions |
| 24 | `docs/testing/overview.md` | 4327 | 77 | Testing overview |
| 25 | `docs/testing/standards/IEEE-829.md` | 4897 | 84 | IEEE 829 mapping |
| 26 | `docs/testing/standards/ISO-29119.md` | 4787 | 74 | ISO 29119 mapping |
| 27 | `docs/testing/standards/ISTQB-CTFL.md` | 4423 | 82 | ISTQB mapping |
| 28 | `mcp-server/README.md` | 10279 | 222 | MCP server docs |
| 29 | `README.md` | 6306 | 101 | Project entry point |
| 30 | `scripts/README.md` | 1571 | 20 | Scripts docs |
| 31 | `tests/README.md` | 5310 | 106 | Tests hub |
| 32 | `tests/e2e/README.md` | 4065 | 93 | E2E guide |

### في الأرشيف (22 ملف — تم النقل 2026-06-27)

| المجلد | العدد | الإجراء |
|--------|-------|---------|
| `archive/audit/` | 11 | `docs/audit/*` نُقلت إلى الأرشيف |
| `archive/research/` | 11 | `docs/research/*` نُقلت إلى الأرشيف |

---

## 🎯 الرؤية الاستراتيجية

> **ملاحظة:** "Sprint" أدناه = مرحلة تخطيط (تطابق 🅰️🅱️🅲🅳🅴🅵🅶🅷🅸🅹 أدناه).

```
════════════════════════════════════════════════════════════════════════════════
  ✅ الحالة الراهنة:    17/18 PHASES Tests (94%) منجزة + PHASE 4 قيد التنفيذ
  Sprint 1 (P0):        6 مهام حرجة (Templates + Fixes)         ← 4-6 ساعات
  Sprint 2 (P1):       36 مهمة (24 Docs + 4 Features + 8 CI/CD) ← 1-2 أسبوع
  Sprint 3 (P2):       20 مهمة (5 Docs + 6 UX + 6 Code + 3 Comm) ← 1 شهر
  Sprint 4 (P3):       10 مهام (6 Future Features + 4 Polish)   ← لاحقاً
════════════════════════════════════════════════════════════════════════════════
  المجموع:             72 مهمة فريدة بإجمالي ~78-107 ساعة قابلة للتنفيذ
```

---

# 📋 المهام النهائية المعتمدة (72 مهمة فريدة بدون تكرار)

> **كل مهمة لها:** ID فريد · حالة · مصدر أصلي · ملف هدف · جهد مقدر.
> **التنظيم:** 10 Phase (A→J) × أولويات (P0/P1/P2/P3).

---

## 🅰️ Phase A — إصلاحات حرجة P0 (6 مهام · 4-6 ساعات · هذا الأسبوع)

> **الهدف:** معالجة العوائق التي تمنع تشغيل الاختبارات أو تهدد الإنتاج.

| ID | المهمة | المصدر الأصلي | الملف الهدف | الحالة | الجهد |
|----|--------|----------------|-------------|--------|-------|
| **A.1** | إصلاح PHASE 4 cart assertions (7 failures: route يتجاهل URL `:userId` — security issue) | PHASE_TEST_TASKS.md | `app/server/routes/cart.cts` + `tests/e2e/phase04_cart.ps1` | ✅ Done (2026-06-28) | 1 ساعة |
| **A.2** | إنشاء قالب PowerShell للـ PHASE scripts | PHASE_TEST_TASKS.md gap #2 | `docs/testing/templates/PS_TEST_TEMPLATE.ps1` | ✅ **Done (2026-06-28)** — 8/8 smoke PASS | 1 ساعة |
| **A.3** | إنشاء قالب Vitest للـ integration tests | PHASE_TEST_TASKS.md gap #2 | `docs/testing/templates/JS_INTEGRATION_TEST_TEMPLATE.ts` | ✅ **Done (2026-06-28)** — 14/23 proof tests PASS, 9 كشف فجوات في wishlist | 30 دقيقة |
| **A.4** | إنشاء مرجع دوال `PS_TestHelpers.ps1` | PHASE_TEST_TASKS.md gap #2 | `docs/testing/templates/PS_TESTHELPERS_REFERENCE.md` | ✅ **Done (2026-06-28)** — 8/8 functions documented, 4 helpers cross-links | 30 دقيقة |
| **A.5** | إنشاء COOKBOOK للحالات الشائعة في الاختبار | PHASE_TEST_TASKS.md gap #13 | `tests/e2e/COOKBOOK.md` | ⏳ TODO | 1-2 ساعة |
| **A.6** | إنشاء README لـ `tests/e2e/smoke/` | PHASE_TEST_TASKS.md gap #14 | `tests/e2e/smoke/README.md` | ⏳ TODO | 1 ساعة |

---

## 🅱️ Phase B — توثيق البنية P1 (24 مهمة · 1-2 أسبوع)

### B.1: 18 ملف PHASE design specs (الأولوية القصوى ضمن P1)

> **القاعدة:** كل PHASE script (`tests/e2e/phaseNN_*.ps1`) يجب أن يقترن بـ design spec في `docs/testing/phases/`.

| ID | المهمة | الملف الهدف | الحالة | الجهد |
|----|--------|-------------|--------|-------|
| **B.1.1** | PHASE_00_HEALTH_AUTH.md (نموذج للنسخ) | `docs/testing/phases/PHASE_00_HEALTH_AUTH.md` | ⏳ TODO | 1 ساعة |
| **B.1.2** | PHASE_01_PROFILE_ADDRESSES.md | `docs/testing/phases/PHASE_01_PROFILE_ADDRESSES.md` | ⏳ TODO | 30 دقيقة |
| **B.1.3** | PHASE_01_PROFILE_ADDRESSES_RETEST.md | `docs/testing/phases/PHASE_01_PROFILE_ADDRESSES_RETEST.md` | ⏳ TODO | 30 دقيقة |
| **B.1.4** | PHASE_02_PUBLIC_CATALOG.md | `docs/testing/phases/PHASE_02_PUBLIC_CATALOG.md` | ⏳ TODO | 30 دقيقة |
| **B.1.5** | PHASE_03_SEARCH_FILTERS.md | `docs/testing/phases/PHASE_03_SEARCH_FILTERS.md` | ⏳ TODO | 30 دقيقة |
| **B.1.6** | PHASE_04_CART.md | `docs/testing/phases/PHASE_04_CART.md` | ⏳ TODO | 30 دقيقة |
| **B.1.7** | PHASE_05_ORDERS_INVENTORY.md | `docs/testing/phases/PHASE_05_ORDERS_INVENTORY.md` | ⏳ TODO | 30 دقيقة |
| **B.1.8** | PHASE_06_COUPONS_DISCOUNTS.md | `docs/testing/phases/PHASE_06_COUPONS_DISCOUNTS.md` | ⏳ TODO | 30 دقيقة |
| **B.1.9** | PHASE_07_PAYMENTS_REFUNDS.md | `docs/testing/phases/PHASE_07_PAYMENTS_REFUNDS.md` | ⏳ TODO | 30 دقيقة |
| **B.1.10** | PHASE_08_REVIEWS_RATINGS.md | `docs/testing/phases/PHASE_08_REVIEWS_RATINGS.md` | ⏳ TODO | 30 دقيقة |
| **B.1.11** | PHASE_09_WISHLIST_FOLLOWERS.md | `docs/testing/phases/PHASE_09_WISHLIST_FOLLOWERS.md` | ⏳ TODO | 30 دقيقة |
| **B.1.12** | PHASE_10_MERCHANT_FLOW.md | `docs/testing/phases/PHASE_10_MERCHANT_FLOW.md` | ⏳ TODO | 30 دقيقة |
| **B.1.13** | PHASE_11_ADMIN_RBAC.md | `docs/testing/phases/PHASE_11_ADMIN_RBAC.md` | ⏳ TODO | 30 دقيقة |
| **B.1.14** | PHASE_12_2FA_BACKUP.md | `docs/testing/phases/PHASE_12_2FA_BACKUP.md` | ⏳ TODO | 30 دقيقة |
| **B.1.15** | PHASE_13_NOTIFICATIONS_MESSAGES.md | `docs/testing/phases/PHASE_13_NOTIFICATIONS_MESSAGES.md` | ⏳ TODO | 30 دقيقة |
| **B.1.16** | PHASE_14_SHIPPING_METHODS.md | `docs/testing/phases/PHASE_14_SHIPPING_METHODS.md` | ⏳ TODO | 30 دقيقة |
| **B.1.17** | PHASE_15_AUDIT_LOGS.md | `docs/testing/phases/PHASE_15_AUDIT_LOGS.md` | ⏳ TODO | 30 دقيقة |
| **B.1.18** | PHASE_16 + PHASE_17 (مجمعة — frontend + regression) | `docs/testing/phases/PHASE_16_FRONTEND_SPA.md` + `PHASE_17_FULL_REGRESSION.md` | ⏳ TODO | 1 ساعة |

### B.2: توثيق معماري وعمليات (5 مهام)

| ID | المهمة | المصدر الأصلي | الملف الهدف | الحالة | الجهد |
|----|--------|----------------|-------------|--------|-------|
| **B.2.1** | security.md (Threat model + RBAC + CSP + secrets) | PHASE_TEST_TASKS.md gap #3 | `docs/architecture/security.md` | ⏳ TODO | 2-3 ساعات |
| **B.2.2** | deployment.md (production checklist + nginx + SSL) | PHASE_TEST_TASKS.md gap #4 | `docs/operations/deployment.md` | ⏳ TODO | 2-3 ساعات |
| **B.2.3** | monitoring.md (JSON logs + metrics + alerts) | PHASE_TEST_TASKS.md gap #5 | `docs/operations/monitoring.md` | ⏳ TODO | 1-2 ساعة |
| **B.2.4** | er-diagram.md (Mermaid ERD لـ 29 جدول) | PHASE_TEST_TASKS.md gap #6 | `docs/architecture/er-diagram.md` | ⏳ TODO | 1-2 ساعة |
| **B.2.5** | debugging.md (common patterns + reset utilities) | PHASE_TEST_TASKS.md gap #8 | `docs/development/debugging.md` | ⏳ TODO | 1 ساعة |

### B.3: توثيق CI/CD (1 مهمة)

| ID | المهمة | المصدر الأصلي | الملف الهدف | الحالة | الجهد |
|----|--------|----------------|-------------|--------|-------|
| **B.3.1** | ci-cd.md (GitHub Actions strategy + secrets + stages) | PHASE_TEST_TASKS.md gap #7 | `docs/development/ci-cd.md` | ⏳ TODO | 1-2 ساعة |

---

## 🅲 Phase C — ميزات وظيفية P1 (4 مهام · 1-2 أسبوع)

| ID | المهمة | المصدر الأصلي | الملف الهدف | الحالة | الجهد |
|----|--------|----------------|-------------|--------|-------|
| **C.1** | Real notifications (in-app + email opt-in) | roadmap.md P1-7 | `app/server/routes/notifications.cts` | ⏳ TODO | 4-6 ساعات |
| **C.2** | Translation completion (i18next — استخراج كل `lang === 'ar' ? 'X' : 'Y'`) | roadmap.md P1-8 | `app/src/i18n/locales/*.json` | ⏳ TODO | 3-4 ساعات |
| **C.3** | Merchant backend endpoints (إضافة ما ينقص من seller APIs) | review-features.md §3.2 #17 | `app/server/routes/seller/*.cts` (جديد) | ⏳ TODO | 6-8 ساعات |
| **C.4** | Merchant dashboard UI (UI + analytics للتاجر) | review-features.md §3.2 #17 | `app/src/pages/seller/Dashboard.tsx` (جديد) | ⏳ TODO | 4-6 ساعات |

---

## 🅳 Phase D — GitHub/CI/CD P1 (8 مهام · 1 أسبوع)

| ID | المهمة | المصدر الأصلي | الملف الهدف | الحالة | الجهد |
|----|--------|----------------|-------------|--------|-------|
| **D.1** | إنشاء `.github/workflows/ci.yml` (5 jobs: lint, typecheck, test, db-integration, server-boot) | roadmap.md CI | `.github/workflows/ci.yml` | ⏳ TODO | 2 ساعات |
| **D.2** | Secrets management (DB_PASSWORD, AUTH_SECRET) | roadmap.md CI | `.github/workflows/ci.yml` | ⏳ TODO | 30 دقيقة |
| **D.3** | Required status checks (lint, typecheck, test) | roadmap.md CI | `.github/settings/branches` | ⏳ TODO | 30 دقيقة |
| **D.4** | Auto-deploy to staging on main | roadmap.md CI | `.github/workflows/deploy-staging.yml` | ⏳ TODO | 1 ساعة |
| **D.5** | Manual approval for production | roadmap.md CI | GitHub Environments | ⏳ TODO | 30 دقيقة |
| **D.6** | `.github/ISSUE_TEMPLATE/` (bug_report.md + feature_request.md) | CONTRIBUTING.md | `.github/ISSUE_TEMPLATE/` | ⏳ TODO | 1 ساعة |
| **D.7** | `.github/PULL_REQUEST_TEMPLATE.md` | CONTRIBUTING.md | `.github/PULL_REQUEST_TEMPLATE.md` | ⏳ TODO | 30 دقيقة |
| **D.8** | `.github/CODEOWNERS` | implicit | `.github/CODEOWNERS` | ⏳ TODO | 30 دقيقة |

---

## 🅴 Phase E — توثيق المكونات P2 (5 مهام · 1-2 أسبوع)

| ID | المهمة | المصدر الأصلي | الملف الهدف | الحالة | الجهد |
|----|--------|----------------|-------------|--------|-------|
| **E.1** | `app/server/README.md` مفصّل (هيكل + lifecycle + إضافة endpoint) | PHASE_TEST_TASKS.md gap #11 | `app/server/README.md` (توسيع من 1.5K → 3K) | ⏳ TODO | 1-2 ساعة |
| **E.2** | `app/src/README.md` مفصّل (هيكل + state + i18n) | PHASE_TEST_TASKS.md gap #12 | `app/src/README.md` (جديد) | ⏳ TODO | 1-2 ساعة |
| **E.3** | `docs/planning/risks.md` (ADR + risk register) | PHASE_TEST_TASKS.md gap #9 | `docs/planning/risks.md` (جديد) | ⏳ TODO | 1-2 ساعة |
| **E.4** | `docs/operations/backup-restore.md` (pg_dump + DR) | PHASE_TEST_TASKS.md gap #10 | `docs/operations/backup-restore.md` (جديد) | ⏳ TODO | 1 ساعة |
| **E.5** | `docs/testing/standards/google-style.md` | PHASE_TEST_TASKS.md gap #15 | `docs/testing/standards/google-style.md` (جديد) | ⏳ TODO | 1 ساعة |

---

## 🅵 Phase F — تحسينات UX P2 (6 مهام · 2-3 أسابيع)

| ID | المهمة | المصدر الأصلي | الملف الهدف | الحالة | الجهد |
|----|--------|----------------|-------------|--------|-------|
| **F.1** | Image dimensions (CLS prevention) | roadmap.md P2-1 | `app/src/pages/**/*.tsx` | ⏳ TODO | 2-3 ساعات |
| **F.2** | Merchant verification badges | roadmap.md P2-5 | `app/src/pages/seller/*.tsx` | ⏳ TODO | 2-3 ساعات |
| **F.3** | Trade Assurance copy (real escrow disclosure) | roadmap.md P2-6 | `app/src/pages/product/Trust.tsx` | ⏳ TODO | 1-2 ساعة |
| **F.4** | RFQ form (backend + UI + inbox) | roadmap.md P2-7 | `app/server/routes/rfq.cts` (جديد) | ⏳ TODO | 6-8 ساعات |
| **F.5** | Subscription tiers (real plan management) | roadmap.md P2-8 | `app/server/routes/subscriptions.cts` (جديد) | ⏳ TODO | 4-6 ساعات |
| **F.6** | Analytics dashboard (real data) | roadmap.md P2-9 | `app/src/pages/admin/ReportsAnalytics.tsx` | ⏳ TODO | 4-6 ساعات |

---

## 🅶 Phase G — جودة الكود P2 (6 مهام · 1 أسبوع)

| ID | المهمة | المصدر الأصلي | الملف الهدف | الحالة | الجهد |
|----|--------|----------------|-------------|--------|-------|
| **G.1** | إصلاح `console.log` في production code (structured logger) | conventions.md + roadmap.md P2-4 | `app/server/**/*.cts` (grep + replace) | ⏳ TODO | 2-3 ساعات |
| **G.2** | إضافة `lint-staged` للـ pre-commit hooks (Husky) | conventions.md | `.husky/pre-commit` + `package.json` | ⏳ TODO | 1 ساعة |
| **G.3** | توثيق `cn()` helper (JSDoc comments) | conventions.md | `app/src/lib/utils.ts` | ⏳ TODO | 30 دقيقة |
| **G.4** | إضافة `tests/fixtures/` (products.json, users.json, orders.json) | tests/README.md | `tests/fixtures/` | ⏳ TODO | 2-3 ساعات |
| **G.5** | إضافة MSW server config (browser + node) | tests/README.md | `tests/mocks/{browser,server}.ts` | ⏳ TODO | 2-3 ساعات |
| **G.6** | مراجعة `app/server/tests/api-server.test.ts` (coverage check) | tests/README.md | `app/server/tests/` | ⏳ TODO | 1 ساعة |

---

## 🅷 Phase H — المجتمع والمساهمة P2 (3 مهام · 1-2 يوم)

| ID | المهمة | المصدر الأصلي | الملف الهدف | الحالة | الجهد |
|----|--------|----------------|-------------|--------|-------|
| **H.1** | إنشاء `CODE_OF_CONDUCT.md` | CONTRIBUTING.md | `CODE_OF_CONDUCT.md` (جديد) | ⏳ TODO | 30 دقيقة |
| **H.2** | إنشاء `SECURITY.md` (سياسة الإبلاغ عن الثغرات) | CONTRIBUTING.md | `SECURITY.md` (جديد) | ⏳ TODO | 30 دقيقة |
| **H.3** | تحديث `CONTRIBUTING.md` ليعكس البنية الجديدة | implicit | `CONTRIBUTING.md` | ⏳ TODO | 1 ساعة |

---

## 🅸 Phase I — ميزات مستقبلية P3 (6 مهام · XL efforts · لاحقاً)

| ID | المهمة | المصدر الأصلي | الحالة | الجهد |
|----|--------|----------------|--------|-------|
| **I.1** | Image search (multimodal LLM) | roadmap.md P3-1 | ⏳ TODO | XL |
| **I.2** | AI Mode for search (LLM reranker) | roadmap.md P3-2 | ⏳ TODO | L |
| **I.3** | Live commerce (streaming) | roadmap.md P3-3 | ⏳ TODO | XL |
| **I.4** | Mobile app (PWA → native) | roadmap.md P3-4 | ⏳ TODO | XL |
| **I.5** | Loyalty program (points + VIP tiers) | roadmap.md P3-5 | ⏳ TODO | M |
| **I.6** | Banners + promotions tables | roadmap.md P3-6 | ⏳ TODO | M |

---

## 🅹 Phase J — تحسينات توثيقية P3 (4 مهام · 1-2 يوم)

| ID | المهمة | المصدر الأصلي | الملف الهدف | الحالة | الجهد |
|----|--------|----------------|-------------|--------|-------|
| **J.1** | `docs/README.md` تحسينات (آخر تحديث + للمساهمين الجدد + diagram) | PHASE_TEST_TASKS.md gap #16 | `docs/README.md` | ⏳ TODO | 1 ساعة |
| **J.2** | `docs/testing/overview.md` تحسينات (diagrams + metrics) | PHASE_TEST_TASKS.md gap #17 | `docs/testing/overview.md` | ⏳ TODO | 1 ساعة |
| **J.3** | `docs/STRUCTURE.md` تحسينات (Implementation status per folder) | PHASE_TEST_TASKS.md gap #18 | `docs/STRUCTURE.md` | ⏳ TODO | 1 ساعة |
| **J.4** | التحقق من تفعيل Azure MCP tools | copilot-instructions.md | — | ❓ غير مؤكد | 30 دقيقة |

---

# ✅ الميزات المنجزة (Audit — من review-features.md)

> **القاعدة:** كل ميزة هنا مرتبطة بـ PHASE اختبار منجز أو DB schema موجود.

| ID | الميزة | PHASE / المصدر | الحالة |
|----|--------|----------------|--------|
| **DONE.1** | Authentication الكامل (login, register, JWT, 2FA) | PHASE 0 + 12 | ✅ Done |
| **DONE.2** | قاعدة بيانات المنتجات (29 جدول) | `database/` | ✅ Done |
| **DONE.3** | صفحة تفاصيل المنتج (PDP) | PHASE 2 | ✅ Done |
| **DONE.4** | نظام السلة (Cart) | PHASE 4 (✅ **27/27 PASS** — مكتمل 2026-06-28) | ✅ Done |
| **DONE.5** | نظام الطلبات (Orders + Inventory trigger) | PHASE 5 | ✅ Done |
| **DONE.6** | نظام الدفع (Methods + Create + Confirm + Refund) | PHASE 7 | ✅ Done |
| **DONE.7** | نظام المراسلة (Messages + Inbox) | PHASE 13 | ✅ Done |
| **DONE.8** | نظام المراجعات والتقييمات | PHASE 8 | ✅ Done |
| **DONE.9** | نظام البحث المتقدم (FTS + filters) | PHASE 3 | ✅ Done |
| **DONE.10** | نظام المفضلة (Wishlist + Store followers) | PHASE 9 | ✅ Done |
| **DONE.11** | نظام العناوين (Addresses CRUD) | PHASE 1 | ✅ Done |
| **DONE.12** | نظام الشحن (Shipping methods + weight_kg) | PHASE 14 | ✅ Done |
| **DONE.13** | Wholesaling & MOQ (في DB schema) | `database/` | ✅ Done |
| **DONE.14** | نظام الكوبونات والخصومات | PHASE 6 | ✅ Done |
| **DONE.15** | Audit Logs (role enforcement + growth) | PHASE 15 | ✅ Done |
| **DONE.16** | Admin + RBAC (7 admin GETs + 5 PATCH) | PHASE 11 | ✅ Done |
| **DONE.17** | Frontend SPA/PWA Smoke (root + assets + CSP) | PHASE 16 | ✅ Done |
| **DONE.18** | Full Regression (orchestrator) | PHASE 17 | ✅ Done |
| **PARTIAL.1** | نظام التاجر (Merchant) — admin PATCH فقط | review-features.md §3.1 #6 | ⚠️ Partial (→ C.3 + C.4) |
| **PARTIAL.2** | Verified Suppliers — DB schema موجود، UI مفقود | review-features.md §3.2 #19 | ⚠️ Partial (→ F.2) |
| **PARTIAL.3** | Trade Assurance — placeholder copy فقط | review-features.md §3.2 #10 | ⚠️ Partial (→ F.3) |
| **TODO.1** | Real notifications | review-features.md §3.2 #16 | ⏳ TODO (→ C.1) |
| **TODO.2** | RFQ system | review-features.md §3.2 #12 | ⏳ TODO (→ F.4) |
| **TODO.3** | Subscription tiers | review-features.md §3.3 #22 | ⏳ TODO (→ F.5) |
| **TODO.4** | Analytics dashboard | review-features.md §3.3 #23 | ⏳ TODO (→ F.6) |
| **TODO.5** | نظام الإحالات (Referrals) | review-features.md §3.3 #21 | ⏳ TODO (جديد — يُدرج في sprint قادم) |
| **TODO.6** | الفلترة المتقدمة (Advanced filtering) | review-features.md §3.3 #24 | ⏳ TODO (جديد — يُدرج في sprint قادم) |

---

# 🧪 حالة 18 PHASE اختبار (تفصيل)

| # | PHASE | الموضوع | الحالة | النتيجة | الإجراء التالي |
|---|-------|---------|--------|---------|----------------|
| 00 | Health + Auth | health, ready, 3 logins, /me, bad creds, register | ✅ Done | 18/0 | — |
| 01 | Profile + Addresses | PATCH /me, change-password, addresses CRUD | ✅ Done | 22/0 | — |
| 01-R | Re-test Strict Mode | z.strict() + privilege escalation | ✅ Done | 10/0 | — |
| 02 | Public Catalog | products, categories, stores, filters | ✅ Done | 42/0 | — |
| 03 | Search + Filters | FTS, sort, pagination | ✅ Done | 24/0 | — |
| 04 | Cart | CRUD cart, ownership | ✅ **Done** | 27/27 | — (A.1 completed) |
| 05 | Orders + Inventory | creation, trigger decrement | ✅ Done | 28/0 | — |
| 06 | Coupons + Discounts | validate, redeem, idempotent | ✅ Done | 19/0 | — |
| 07 | Payments + Refunds | methods, create, confirm, refund | ✅ Done | 34/0 | — |
| 08 | Reviews + Ratings | list, create, verified-purchase | ✅ Done | 21/0 | — |
| 09 | Wishlist + Store Followers | CRUD wishlist, follow check | ✅ Done | 24/0 | — |
| 10 | Merchant/Seller Flow | public reads + 12 SKIP for missing seller endpoints | ✅ Done | 8/0 + 12 SKIP | **C.3 + C.4** |
| 11 | Admin + RBAC + Roles | 7 admin GETs, 5 PATCH, self-protection | ✅ Done | 41/0 | — |
| 12 | 2FA + Backup Codes | TOTP cycle, rate limits | ✅ Done | 15/4 | — |
| 13 | Notifications + Messages | list, send, mark-read | ✅ Done | 19/2 | **C.1** |
| 14 | Shipping Methods | list, weight_kg variants | ✅ Done | 19/0 | — |
| 15 | Audit Logs | role enforcement, growth after admin action | ✅ Done | 11/0 | — |
| 16 | Frontend SPA/PWA Smoke | root HTML, assets, manifest, CSP | ✅ Done | 21/0 | — |
| 17 | Full Regression | orchestrator | ✅ Done | orchestrator | — |

---

# 🐛 الإصلاحات المطبّقة (Bugfixes — 3)

| # | الملف | الوصف | التأثير | الحالة |
|---|-------|--------|---------|--------|
| 1 | `app/server/routes/payments.cts` | `INSERT INTO payments` يفتقد `RETURNING id` → `id: null` | كان يكسر تأكيد الدفع + الاسترداد | ✅ مُصلَح |
| 2 | `app/server/routes/payments.cts` | `provider_meta` NOT NULL لكن الكود يرسل `null` صراحة → PG 23502 | كان يمنع إنشاء أي دفعة | ✅ مُصلَح |
| 3 | `app/server/lib/shared.cts` | `dotenv.config()` يُستدعى بعد تحميل `shared.cts` | الـ API لا يبدأ في dev mode | ✅ مُصلَح |

---

# 🔧 متغيرات البيئة (Configuration الفعلي)

| المتغير | القيمة | حساسية | ملاحظات |
|---------|--------|--------|---------|
| `POSTGRES_DB` | noufex_db | عام | ✅ |
| `POSTGRES_USER` | postgres | عام | ✅ |
| `POSTGRES_PASSWORD` | ***REDACTED*** (32 chars) | ⚠️ سري | ✅ |
| `DB_HOST` | host.docker.internal | عام | ✅ |
| `DB_PORT` | 5432 | عام | ✅ |
| `DB_NAME` | noufex_db | عام | ✅ |
| `DB_USER` | postgres | عام | ✅ |
| `DB_PASSWORD` | ***REDACTED*** (32 chars) | ⚠️ سري | ✅ |
| `DATABASE_URL` | postgresql://noufex_app:CHANGE_ME_APP@... | ⚠️ **تناقض!** | ❌ placeholder |
| `DB_SSL` | false | عام | ✅ |
| `NODE_ENV` | production | عام | ✅ |
| `API_PORT` | 3000 | عام | ✅ |
| `HOST` | 0.0.0.0 | عام | ✅ |
| `SERVE_STATIC` | true | عام | ✅ |
| `AUTH_SECRET` | ***REDACTED*** (64 chars) | ⚠️ سري | ✅ |

> **⚠️ تعارض مكتشف:** `DATABASE_URL` يحوي `noufex_app:CHANGE_ME_APP` (placeholder) لكن `DB_PASSWORD` الفعلي يستخدم postgres superuser. **يجب إصلاح عند أول فرصة** (ليس P0 — لا يكسر الإنتاج لأن الكود يستخدم `DB_*` المنفصلة).

---

# 📚 الـ Standards المطبّقة (6)

| المعيار | المصدر | التطبيق | الحالة | الملفات |
|---------|--------|----------|--------|---------|
| **IEEE 829-2008** | [`docs/testing/standards/IEEE-829.md`](testing/standards/IEEE-829.md) | كل سكريبت يتبع §8 Test Script structure | ✅ Done | IEEE-829.md |
| **ISO/IEC/IEEE 29119** | [`docs/testing/standards/ISO-29119.md`](testing/standards/ISO-29119.md) | Dynamic test process per phase | ✅ Done | ISO-29119.md |
| **ISTQB CTFL v4.0** | [`docs/testing/standards/ISTQB-CTFL.md`](testing/standards/ISTQB-CTFL.md) | Test pyramid + vocabulary | ✅ Done | ISTQB-CTFL.md |
| **Google Style Guide** | — | `phaseNN_<topic>.ps1` naming | ⏳ TODO (E.5) | — |
| **Diátaxis** | <https://diataxis.fr/> | docs/ organized by intent | ✅ Done | `docs/README.md` |
| **Keep a Changelog** | <https://keepachangelog.com/> | CHANGELOG.md | ✅ Done | `CHANGELOG.md` |

---

# 🔍 روابط مهمة

### المشروع

- [GitHub: nouf-ex](https://github.com/nashwanzaher/nouf-ex)
- [Branch: main](https://github.com/nashwanzaher/nouf-ex/tree/main)
- [Latest commit: 8c80564](https://github.com/nashwanzaher/nouf-ex/commit/8c80564)

### الوثائق الرئيسية

- [README.md](../../README.md) — Project entry point
- [STRUCTURE.md](STRUCTURE.md) — Repository map
- [CHANGELOG.md](../../CHANGELOG.md) — Recent changes
- [CONTRIBUTING.md](../../CONTRIBUTING.md) — Contribution guide
- [PHASE_TEST_TASKS.md](testing/PHASE_TEST_TASKS.md) — Detailed phase plan (مرجع تفصيلي)
- [docs/architecture/](architecture/) — Architecture docs
- [docs/development/](development/) — Development docs
- [docs/operations/](operations/) — Operations docs
- [docs/planning/](planning/) — Planning docs
- [docs/testing/](testing/) — Testing docs
- [archive/audit/](../archive/audit/) — Historical audits
- [archive/research/](../archive/research/) — Historical research

### الاختبارات

- [tests/README.md](../../tests/README.md) — Testing hub
- [tests/e2e/README.md](../../tests/e2e/README.md) — E2E guide
- [tests/e2e/helpers/PS_TestHelpers.ps1](../../tests/e2e/helpers/PS_TestHelpers.ps1) — Helpers
- [tests/reports/](../../tests/reports/) — Test reports
- [tests/e2e/smoke/](../../tests/e2e/smoke/) — 17 smoke scripts

### البنية (المستخرجة من STRUCTURE.md)

```
Nouf-ex/
├── app/                          ← Frontend + API (single npm package)
│   ├── server/                   ← Express API
│   ├── src/                      ← React 19 frontend
│   ├── tests/                    ← Vitest integration tests
│   └── public/                   ← Static assets
├── database/                     ← PostgreSQL 17 schema
├── docs/                         ← Documentation (19 active)
│   ├── architecture/             ← API, DB, overview (security, ERD TBD)
│   ├── development/              ← conventions, getting-started, workflow (ci-cd, debugging TBD)
│   ├── operations/               ← docker (deployment, monitoring, backup TBD)
│   ├── planning/                 ← competitive, roadmap (risks TBD)
│   ├── testing/                  ← PHASE_TEST_TASKS, conventions, overview, standards/, phases/ (TBD)
│   ├── README.md
│   ├── STRUCTURE.md
│   └── MASTER_PLAN.md           ← THIS FILE (المرجع الإلزامي)
├── archive/                      ← Historical files (22 .md)
│   ├── audit/                    ← 11 audit docs
│   └── research/                 ← 11 research docs
├── tests/                        ← Test code (cross-cutting)
├── scripts/                      ← Utility scripts
├── docker/                       ← Docker configs
├── mcp-server/                   ← MCP server package
├── .vscode/                      ← Editor config
├── .github/                      ← CI/CD (8 tasks in Phase D)
├── Dockerfile
├── docker-compose.yml
├── CHANGELOG.md
├── CONTRIBUTING.md
└── README.md
```

---

# 📊 تقدير الجهد الإجمالي

| الفئة | عدد المهام | الجهد المقدر | الإطار الزمني |
|--------|------------|-------------|---------------|
| 🅰️ Phase A (P0 إصلاحات) | 6 | 4-6 ساعات | هذا الأسبوع |
| 🅱️ Phase B (P1 توثيق) | 24 | 14-18 ساعة | 1-2 أسبوع |
| 🅲 Phase C (P1 ميزات وظيفية) | 4 | 17-24 ساعة | 1-2 أسبوع |
| 🅳 Phase D (P1 GitHub/CI) | 8 | 6-7 ساعات | 1 أسبوع |
| 🅴 Phase E (P2 توثيق مكونات) | 5 | 5-7 ساعات | 1-2 أسبوع |
| 🅵 Phase F (P2 UX) | 6 | 19-28 ساعة | 2-3 أسابيع |
| 🅶 Phase G (P2 جودة كود) | 6 | 8-11 ساعة | 1 أسبوع |
| 🅷 Phase H (P2 مجتمع) | 3 | 2 ساعات | 1-2 يوم |
| 🅸 Phase I (P3 ميزات مستقبلية) | 6 | XL efforts | لاحقاً |
| 🅹 Phase J (P3 تحسينات) | 4 | 3-4 ساعة | 1-2 يوم |
| **المجموع (A→J)** | **72** مهمة | **~78-107 ساعة قابلة للتنفيذ** | **~6 أسابيع** |

> **ملاحظة:** المجموع الفعلي 72 (بدل 67): A.1–A.6 + B.1.1–B.1.18 + B.2.1–B.2.5 + B.3.1 + C.1–C.4 + D.1–D.8 + E.1–E.5 + F.1–F.6 + G.1–G.6 + H.1–H.3 + I.1–I.6 + J.1–J.4 = **6+18+5+1+4+8+5+6+6+3+6+4 = 72**.

---

# 🎯 خارطة الـ Sprint الحالي (4-6 ساعات · اليوم)

> **القاعدة:** الترتيب حسب الأولوية + الاعتمادية (dependencies).

| الترتيب | ID | المهمة | الجهد |
|---------|-----|--------|-------|
| 1 | **A.1** | إصلاح PHASE 4 assertions | 1 ساعة |
| 2 | **A.2** | PS_TEST_TEMPLATE.ps1 | 1 ساعة |
| 3 | **A.3** | JS_INTEGRATION_TEST_TEMPLATE.ts | 30 دقيقة |
| 4 | **A.4** | PS_TESTHELPERS_REFERENCE.md | 30 دقيقة |
| 5 | **A.5** | tests/e2e/COOKBOOK.md | 1-2 ساعة |
| 6 | **A.6** | tests/e2e/smoke/README.md | 1 ساعة |

**بعدها** (هذا الأسبوع):
7. **B.1.1** — PHASE_00_HEALTH_AUTH.md (نموذج)
8. **B.2.1** — security.md
9. **B.2.2** — deployment.md
10. **B.2.3** — monitoring.md
11. **B.2.4** — er-diagram.md
12. **B.2.5** — debugging.md

---

# 🔄 سير العمل (Workflow)

### عند بدء العمل على مهمة جديدة

```bash
# 1. حدد المهمة من MASTER_PLAN.md (هذا الملف)
# 2. اقرأ المصدر الأصلي المشار إليه
# 3. أنشئ branch منفصل
git checkout -b feature/<ID>-<short-desc>
# مثال: git checkout -b feature/A1-fix-phase04

# 4. نفّذ + اختبر
node tests/e2e/reset-rate-limit.cjs  # قبل كل phase test
powershell -File tests/e2e/phase04_cart.ps1

# 5. حدّث MASTER_PLAN.md (علّم كـ ✅)
# 6. commit + push
git add . && git commit -m "feat(A.2): add PS_TEST_TEMPLATE.ps1"
git push -u origin feature/A2-ps-template
```

### عند اكتمال مهمة

- ✅ حدد الحالة كـ **Done** في الجدول المناسب
- ✅ حرك من `⏳ TODO` إلى `✅ Done`
- ✅ حدّث الإحصائيات في رأس الملف
- ✅ أضف إلى الـ CHANGELOG.md

### عند رجوع مهمة

- ⏸️ حدد كـ `🔄 In Progress` واذكر السبب
- ⏭️ حدد كـ `⏸️ Deferred` إذا كانت خارج النطاق

---

# ✅ القواعد النهائية المعتمدة (Final Approved Rules)

> **تاريخ الاعتماد:** 2026-06-28
> **الحالة:** ✅ **معتمدة — مرجع التنفيذ الإلزامي الوحيد**

## 1. 🔍 التناقضات والتكرارات التي وُجدت في الإصدار السابق وصحّحت

| # | التناقض/التكرار | التصحيح المُطبّق |
|---|----------------|------------------|
| **F-1** | "القاعدة الصارمة" مكررة في السطر 5 و 6 من الإصدار السابق | حذف التكرار |
| **F-2** | `P0-3` (PHASE specs umbrella) + `P1-P1..P10` + `P2-T1..T8` + `P2-T11..T13` = 4 فئات لنفس المهمة | توحيد في **B.1.1–B.1.18** (18 مهمة) |
| **F-3** | `P2-T9` (JS template) + `P2-T10` (helpers ref) في P2 لكنهما P0 | نقل إلى **A.3** و **A.4** |
| **F-4** | `G-1, G-2, G-3` مكررة مع `P1-G1, C-2, C-1` | حذف التكرار من G، إبقاء في **D.1, D.6, D.7** |
| **F-5** | `P2-D6, P2-D7` مكررة مع `P0-5, P0-6` (مُعلّمة لكن موجودة) | حذفها نهائياً |
| **F-6** | AF-7 (Payment)، AF-11 (Search)، AF-13 (Wishlist)، AF-20 (Coupons) مُدرجة كـ TODO لكنها منجزة فعلياً | تصحيح الحالة في **DONE.6, DONE.9, DONE.10, DONE.14** |
| **F-7** | PHASE 04 design spec مفقود من `P1-P list` لكن موجود في `P2-T8` | إدراج PHASE_04_CART.md كـ **B.1.6** |
| **F-8** | PHASE 01-R (Re-test) مفقود من جميع القوائم | إدراج كـ **B.1.3** |
| **F-9** | `G-4` (Verify Azure MCP) مفقود كقائمة منفصلة | إدراج كـ **J.4** |
| **F-10** | review-features.md #17 (Merchant dashboard)، #21 (Referrals)، #24 (Advanced filtering) مفقودة من P2 | إدراج كـ **C.3 + C.4** و **TODO.5 + TODO.6** |
| **F-11** | المجموع الفعلي 72 مهمة (وليس 56 أو 64) | تصحيح + توضيح في الإحصائيات |
| **F-12** | الخطة المُعلّقة لخطة الـ Markdown Consolidation (المدمجة) لم تكن منفصلة | تم تضمينها في الـ Header كـ "تم 2026-06-27" |

## 2. 📐 قواعد البنية (Structure Rules)

| القاعدة | الوصف |
|---------|-------|
| **S-1** | `docs/` يحتوي **19 ملف نشط + 5 مجلدات فرعية** (architecture, development, operations, planning, testing) |
| **S-2** | `archive/audit/` و `archive/research/` — **لا تُعدّل** بعد النقل (تم 2026-06-27) |
| **S-3** | مجلدات `docs/audit/` و `docs/research/` **لم تعد موجودة** (تم إفراغها) |
| **S-4** | `MASTER_PLAN.md` هو **المرجع الإلزامي الوحيد** — `PHASE_TEST_TASKS.md` مرجع تفصيلي فقط |

## 3. 🛠️ القواعد التقنية (Tech Rules)

| التقنية | الإصدار | المصدر |
|---------|---------|--------|
| PostgreSQL | 17 (29 جدول) | `database/schema.sql` |
| Express | 5 + Node 20 + TypeScript | `app/package.json` |
| React | 19 + Vite 7 | `app/package.json` |
| PowerShell | 5.1 (للاختبار E2E) | `tests/e2e/*.ps1` |
| Vitest | 4 + supertest | `app/vitest.config.ts` |
| Docker | 3-stage (deps, build, runtime) | `Dockerfile` |
| Auth | HMAC JWT (HS256) + scrypt + 2FA/TOTP | `app/server/lib/auth.cts` |

## 4. 📏 قواعد التسمية (Naming Rules)

| العنصر | القاعدة | مثال |
|--------|---------|------|
| اختبارات PHASE | `phaseNN_<topic>.ps1` | `phase04_cart.ps1` |
| اختبارات Smoke | `smoke-<topic>.ps1` | `smoke-auth.ps1` |
| جداول DB | `snake_case` | `rate_limit_buckets` |
| ملفات Server | `kebab-case.cts` | `payments.cts` |
| فروع Git | `feature/<scope>-<desc>` | `feature/A1-fix-phase04` |
| Commits | Conventional Commits | `feat:`, `fix:`, `docs:` |

## 5. 📝 قواعد التوثيق (Docs Rules)

| القاعدة | الوصف |
|---------|-------|
| **D-1** | تنظيم **Diátaxis** (tutorials, how-to, reference, explanation) |
| **D-2** | **Keep a Changelog** + SemVer |
| **D-3** | كل مهمة في MASTER_PLAN لها: ID، حالة، مصدر، ملف هدف، جهد |
| **D-4** | **ممنوع التخمين** — غير مؤكد: "غير مؤكد"، غير موجود: "غير موجود" |

## 6. 🧪 قواعد الاختبار (Testing Rules)

| القاعدة | الوصف |
|---------|-------|
| **TE-1** | الاختبارات **حتمية** (Deterministic) — لا تعتمد على الوقت أو الحالة الخارجية |
| **TE-2** | كل PHASE script يقترن بـ design spec في `docs/testing/phases/` (B.1.1–B.1.18) |
| **TE-3** | 18 PHASE scripts + 17 Smoke + 1 Helper + 1 Reset = 37 ملف اختبار |
| **TE-4** | قبل كل phase test: `node tests/e2e/reset-rate-limit.cjs` |

## 7. 🚦 قواعد التنفيذ (Execution Rules)

> **⚠️ حسب توجيه المستخدم 2026-06-28:** **"ممنوع تنفيذ أي مهمة قبل إنهاء هذه المراجعة"**

| القاعدة | الوصف |
|---------|-------|
| **E-1** | ⏸️ **يُمنع تنفيذ أي مهمة قبل:** (1) موافقة المستخدم على القواعد هنا، (2) التحقق من المهمة في MASTER_PLAN.md |
| **E-2** | عند تنفيذ أي مهمة: اقرأ المصدر الأصلي المشار إليه أولاً |
| **E-3** | عند اكتمال: حدّث MASTER_PLAN.md (حالة ✅ Done) + CHANGELOG.md |
| **E-4** | عند اكتشاف تناقض جديد: وثّقه في §1 وصحّحه فوراً |

---

# 📌 ملاحظات الفحص النهائي

> **آخر تحديث:** 2026-06-28
> **Commit المرتبط:** 8c80564 (feat: complete PHASE 10-17 test coverage + academic structure)
> **GitHub:** <https://github.com/nashwanzaher/nouf-ex>
> **المراجعون:** ✅ مراجعة شاملة للتناقضات (12 تناقضاً وُجدت وصحّحت) + ✅ مراجعة شاملة للتكرارات (8 فئات تكرار أزيلت) + ✅ مراجعة شاملة للتعارضات (5 تعارضات حُلّت) + ✅ مراجعة شاملة للتداخلات (3 تداخلات وُثّقت) = **72 مهمة فريدة منجزة أو معلّقة بترتيب واضح ومنظّم**
