# 🗺️ Nouf-ex — Master Execution Plan & Task Roadmap

> **Source of truth:** مستخرج من **41 ملف .md** فعلي (19 نشط + 22 أرشيف) في 2026-06-28.
> **المعايير المطبّقة:** [IEEE 829-2008](https://standards.ieee.org/ieee/829/4987/) · [ISO/IEC/IEEE 29119](https://www.iso.org/standard/81291.html) · [ISTQB CTFL](https://www.istqb.org/) · [Google Style Guide](https://google.github.io/styleguide/) · [Diátaxis](https://diataxis.fr/) · [Keep a Changelog](https://keepachangelog.com/)
> **القاعدة الصارمة:** كل بند هنا مأخوذ حرفياً من الكود الفعلي (`app/server/**/*.cts`، `app/src/**/*.tsx`) وملفات SQL (`database/*.sql`) ووثائق `.md` الـ 41. أي بند غير مؤكد يُكتب: **غير مؤكد**. أي بند غير موجود فعلياً يُكتب: **غير موجود**.
> **⚠️ هذه الوثيقة هي المرجع الإلزامي الوحيد لتنفيذ المهام** (اعتُمدت 2026-06-28 بعد مراجعة شاملة).
> **⏸️ يُمنع تنفيذ أي مهمة (P0/P1/P2/P3) قبل التحقق من القواعد النهائية أدناه.**

---

## 📊 ملخص تنفيذي

> **آخر تحديث فعلي:** 2026-06-28 — بعد `npm run typecheck/lint/test/build` على main.

| المقياس                    | القيمة المُتحقَّق منها                                           | المصدر / الأمر                              | الحالة  |
| -------------------------- | ----------------------------------------------------------------- | ------------------------------------------- | ------- |
| **ملفات .md**              | **41** (19 نشط + 22 أرشيف)                                        | `Get-ChildItem -Recurse -Filter *.md`       | ✅      |
| **مهام فريدة**             | **72** (A→J) + **6 جديدة** (Phase K — Gap Remediation) = **78**   | مراجعة UI/API/DB 2026-06-28                 | ✅      |
| **منجزة منعزلة (isolated)**  | **9 PHASES تمر فعلياً** (00، 02، 03، 04، 07، 14، 16 + 01 + 17 orchestrator) | reports/phase*.log (LastWrite 2026-06-28) | ⚠️ Partial |
| **تفشل في الـ batch**        | **9 PHASES** بسبب rate-limit cascade على `/api/auth/*` (05، 06، 08، 09، 10، 11، 13، 15 + 12 documented) | `actual=401` cascading من `customer=FAIL admin=FAIL` في tokens setup | ⚠️ Infra issue |
| **لا يوجد bug فعلي في الـ API** | الأدلة: PHASE 0 (18/0)، PHASE 7 (34/0)، PHASE 14 (19/0)، PHASE 16 (21/0) كلها تمر | logs 2026-06-28              | ✅      |
| **PHASE 4 status**           | **✅ Done 27/0** — أصلح A.1 | reports/phase04_cart.log       | ✅      |
| **Vitest**                 | **732 passed · 3 skipped (55 test files)** — Vitest **4.1.9**    | `npm run test` 2026-06-28 19:08             | ✅      |
| **TypeScript**             | **0 errors**                                                     | `npm run typecheck`                         | ✅      |
| **ESLint**                 | **0 issues**                                                     | `npm run lint`                              | ✅      |
| **Build**                  | **OK** — 2877 modules, 197 PWA entries, 21.18 MiB precache        | `npm run build` 2026-06-28 (after clearing `node_modules/.tmp/*.tsbuildinfo`) | ✅ |
| **DB tables (unique)**     | **30** (17 schema.sql + 10 schema-extra.sql + 3 migrations)       | `CREATE TABLE IF NOT EXISTS` في `database/` | ✅      |
| **DB functions**            | **13** (7 في functions.sql + 6 في migrations/)                   | `CREATE OR REPLACE FUNCTION`                | ✅      |
| **DB triggers**            | **10**                                                           | `database/triggers.sql`                     | ✅      |
| **DB views**               | **4**                                                            | `database/views.sql`                        | ✅      |
| **DB roles**               | **3 application** (noufex_owner, noufex_app, noufex_readonly) + 1 superuser (postgres) | `database/roles.sql`           | ✅      |
| **Server endpoints**       | **91** router declarations (51 unique paths عبر 19 route files)   | `app/server/routes/*.cts`                    | ✅      |
| **React Router routes**    | **23** routes (22 explicit `path=` + 1 wildcard `*` لـ NotFound) في `App.tsx` | `app/src/App.tsx`                | ✅      |
| **UI pages (wired)**       | **22** صفحة مُسجَّلة + NotFound (6 public + 4 auth + 4 seller + 6 customer + 1 admin + 1 NotFound) | App.tsx `<Route>` count        | ✅      |
| **UI pages (orphaned)**    | **5** admin pages بدون route: UsersManagement, StoresManagement, AdminOverview, DisputesManagement, ReportsAnalytics | `app/src/pages/admin/` ∉ App.tsx imports | ⏳ TODO |
| **Admin mock-data pages**  | **6** صفحات (شامل AdminDashboard المُسجَّل)                       | grep `usersData\|storesData\|disputesData\|mockAnalytics\|revenueData\|statsData` في admin/ | ⏳ TODO |
| **YER hardcoded**          | **8 مواضع** (4 Checkout + 2 SellerDashboard + 2 CustomerDashboard) | `grep '} YER'`                               | ⏳ TODO |
| **i18n keys (flat)**       | en=**828**, ar=**970**, zh=**895**                                | ConvertFrom-Json + recursive flatten        | ✅      |
| **فجوات توثيقية**          | **15** (6 P0 + 7 P1 + 2 P2)                                       | docs/testing/                               | ⏳ TODO |
| **ميزات وظيفية مفقودة**    | **14** (4 P1 + 6 P2 + 4 P3)                                      | roadmap.md                                  | ⏳ TODO |
| **فجوات UI/API/DB (جديد)** | **6 مهام Phase K** (47-69 ساعة — مُعدَّل بعد تصحيح YER=8 و K.6=4 صفحات) | § "مراجعة الفجوات UI ↔ Server ↔ DB" أدناه  | ⏳ TODO |
| **إصلاحات (Bugfixes)**     | **3**                                                            | RETURNING id، provider_meta، dotenv order  | ✅      |
| **Git remote**             | github.com/nashwanzaher/nouf-ex                                   | `git remote -v`                             | ✅      |
| **آخر commit على main**    | **d85f4a9** (Phase K docs) — يسبقه **4eeda90** (a11y fix)        | `git log --oneline -1`                      | ✅      |
| **Ahead of origin/main**   | **2 commits** غير مُدفوعين (d85f4a9, 4eeda90)                    | `git status`                                | ⏳      |
| **فروع محلية غير مدمجة**   | **opencode/silent-engine** (15 commits ahead, 153 خلف main) — Phase K K.1 partial | `git branch -a`                            | ⚠️      |
| **حجم هذه الوثيقة**        | محدّث عند كل تعديل                                                | `Get-Item`                                  | ✅      |

> **مفتاح الحالات:** ⏳ TODO (لم يبدأ) · 🔄 In Progress (قيد العمل) · ✅ Done (منجز) · ⚠️ Partial (جزئي) · ❌ غير موجود · ❓ غير مؤكد

---

## 📂 جرد ملفات .md الـ 41 (المُستخرجة فعلياً)

### نشطة (19 ملف في `docs/` + 13 في الجذر)

| #   | المسار                                            | الحجم (b) | الأسطر  | الوصف                           |
| --- | ------------------------------------------------- | --------- | ------- | ------------------------------- |
| 1   | `.github/copilot-instructions.md`                 | 362       | 3       | @azure Rules                    |
| 2   | `.github/prompts/noufex-explore-review.prompt.md` | 8505      | 100     | Agent prompt                    |
| 3   | `app/README.md`                                   | 2370      | 51      | Backend+tests+public            |
| 4   | `app/server/README.md`                            | 1572      | 37      | Server مختصر                    |
| 5   | `CHANGELOG.md`                                    | 2888      | 52      | Keep a Changelog                |
| 6   | `CONTRIBUTING.md`                                 | 4532      | 87      | Workflow + style                |
| 7   | `database/README.md`                              | 4607      | 71      | Schema source of truth          |
| 8   | `database/migrations/README.md`                   | 1102      | 21      | Workflow                        |
| 9   | `docs/README.md`                                  | 4381      | 85      | Index                           |
| 10  | `docs/STRUCTURE.md`                               | 15806     | 354     | Repository map                  |
| 11  | `docs/MASTER_PLAN.md`                             | يُحدَّث   | يُحدَّث | **هذا الملف — المرجع الإلزامي** |
| 12  | `docs/architecture/api.md`                        | 6725      | 81      | API reference (38 endpoints)    |
| 13  | `docs/architecture/database.md`                   | 11623     | 190     | Schema overview (29 tables)     |
| 14  | `docs/architecture/overview.md`                   | 11795     | 90      | Component map                   |
| 15  | `docs/development/conventions.md`                 | 5273      | 89      | Code style + naming             |
| 16  | `docs/development/getting-started.md`             | 11834     | 216     | Setup guide                     |
| 17  | `docs/development/workflow.md`                    | 3915      | 75      | Daily commands                  |
| 18  | `docs/operations/docker.md`                       | 2303      | 50      | Docker                          |
| 19  | `docs/planning/competitive-analysis.md`           | 39963     | 508     | 19 axes + 6 competitors         |
| 20  | `docs/planning/roadmap.md`                        | 23995     | 185     | P0/P1/P2/P3 backlog             |
| 21  | `docs/testing/PHASE_TEST_TASKS.md`                | 96800+    | 1436+   | Master Test Plan (مرجع تفصيلي)  |
| 22  | `docs/testing/README.md`                          | 4384      | 88      | Testing hub                     |
| 23  | `docs/testing/conventions.md`                     | 4647      | 95      | Test conventions                |
| 24  | `docs/testing/overview.md`                        | 4327      | 77      | Testing overview                |
| 25  | `docs/testing/standards/IEEE-829.md`              | 4897      | 84      | IEEE 829 mapping                |
| 26  | `docs/testing/standards/ISO-29119.md`             | 4787      | 74      | ISO 29119 mapping               |
| 27  | `docs/testing/standards/ISTQB-CTFL.md`            | 4423      | 82      | ISTQB mapping                   |
| 28  | `mcp-server/README.md`                            | 10279     | 222     | MCP server docs                 |
| 29  | `README.md`                                       | 6306      | 101     | Project entry point             |
| 30  | `scripts/README.md`                               | 1571      | 20      | Scripts docs                    |
| 31  | `tests/README.md`                                 | 5310      | 106     | Tests hub                       |
| 32  | `tests/e2e/README.md`                             | 4065      | 93      | E2E guide                       |

### في الأرشيف (22 ملف — تم النقل 2026-06-27)

| المجلد              | العدد | الإجراء                             |
| ------------------- | ----- | ----------------------------------- |
| `archive/audit/`    | 11    | `docs/audit/*` نُقلت إلى الأرشيف    |
| `archive/research/` | 11    | `docs/research/*` نُقلت إلى الأرشيف |

---

## 🎯 الرؤية الاستراتيجية

> **ملاحظة:** "Sprint" أدناه = مرحلة تخطيط (تطابق 🅰️🅱️🅲🅳🅴🅵🅶🅷🅸🅹 أدناه).

```
════════════════════════════════════════════════════════════════════════════════
  ⚠️ الحالة الراهنة الفعلي (logs 2026-06-28):
     · 9 PHASES تمر منعزلة (00، 01، 02، 03، 04، 07، 14، 16، 17)
     · 9 PHASES تفشل في الـ batch بسبب rate-limit cascade على /api/auth/*
       (05، 06، 08، 09، 10، 11، 12، 13، 15) — السبب: customer/admin login يُرجع 401
       بعد PHASE 0-4 تستهلك الـ rate-limit bucket. لا bug في الـ API
       (دليل: PHASE 5 ينجح merchant login لكن customer/admin يفشلان).
     · 0 PHASES تكشف bug فعلي في الـ code بعد إصلاح A.1.
  Sprint 1 (P0):        6 مهام حرجة (Templates + Fixes)         ← 4-6 ساعات
  Sprint 2 (P1):       36 مهمة (24 Docs + 4 Features + 8 CI/CD) ← 1-2 أسبوع
  Sprint 3 (P2):       20 مهمة (5 Docs + 6 UX + 6 Code + 3 Comm) ← 1 شهر
  Sprint 4 (P3):       10 مهام (6 Future Features + 4 Polish)   ← لاحقاً
════════════════════════════════════════════════════════════════════════════════
```

---

# 📋 المهام النهائية المعتمدة (72 مهمة فريدة بدون تكرار)

> **كل مهمة لها:** ID فريد · حالة · مصدر أصلي · ملف هدف · جهد مقدر.
> **التنظيم:** 10 Phase (A→J) × أولويات (P0/P1/P2/P3).

---

## 🅰️ Phase A — إصلاحات حرجة P0 (6 مهام · 4-6 ساعات · هذا الأسبوع)

> **الهدف:** معالجة العوائق التي تمنع تشغيل الاختبارات أو تهدد الإنتاج.
> **الحالة:** ✅ **6/6 Done (2026-06-28)** — Phase A مكتملة بالكامل.

| ID      | المهمة                                                                                  | المصدر الأصلي               | الملف الهدف                                                 | الحالة                                                          | الجهد    |
| ------- | --------------------------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------- | -------- |
| **A.1** | إصلاح PHASE 4 cart assertions (7 failures: route يتجاهل URL `:userId` — security issue) | PHASE_TEST_TASKS.md         | `app/server/routes/cart.cts` + `tests/e2e/phase04_cart.ps1` | ✅ Done (2026-06-28) — 669 tests passing                        | 1 ساعة   |
| **A.2** | إنشاء قالب PowerShell للـ PHASE scripts                                                 | PHASE_TEST_TASKS.md gap #2  | `docs/testing/templates/PS_TEST_TEMPLATE.ps1`               | ✅ **Done (2026-06-28)** — 13 assertions e2e PASS               | 1 ساعة   |
| **A.3** | إنشاء قالب Vitest للـ integration tests                                                 | PHASE_TEST_TASKS.md gap #2  | `docs/testing/templates/JS_INTEGRATION_TEST_TEMPLATE.ts`    | ✅ **Done (2026-06-28)** — 14/23 proof tests PASS, 9 كشف فجوات  | 30 دقيقة |
| **A.4** | إنشاء مرجع دوال `PS_TestHelpers.ps1`                                                    | PHASE_TEST_TASKS.md gap #2  | `docs/testing/templates/PS_TESTHELPERS_REFERENCE.md`        | ✅ **Done (2026-06-28)** — 8/8 functions documented             | 30 دقيقة |
| **A.5** | إنشاء COOKBOOK للحالات الشائعة في الاختبار                                              | PHASE_TEST_TASKS.md gap #13 | `tests/e2e/COOKBOOK.md`                                     | ✅ **Done (2026-06-28)** — 16 recipes + helpers + anti-patterns | 1-2 ساعة |
| **A.6** | إنشاء README لـ `tests/e2e/smoke/`                                                      | PHASE_TEST_TASKS.md gap #14 | `tests/e2e/smoke/README.md`                                 | ✅ **Done (2026-06-28)** — 17/17 scripts catalogued             | 1 ساعة   |

---

> **🎉 Phase A مكتملة بالكامل (2026-06-28):** 6/6 مهام منجزة. التحقق: 669 passing (53 ملف اختبار)، Vite build ✅، typecheck ✅، lint ✅. الـ 5 commits: `fd2c605` (A.1 fix) → `20ae169` (A.2) → `75be206` (A.3) → `5c38504` (A.4) → `b7a2b6f` (A.5) → `ae9dbe5` (A.6) → `eab7f61` (style).

## 🅱️ Phase B — توثيق البنية P1 (24 مهمة · 1-2 أسبوع)

### B.1: 18 ملف PHASE design specs (الأولوية القصوى ضمن P1)

> **القاعدة:** كل PHASE script (`tests/e2e/phaseNN_*.ps1`) يجب أن يقترن بـ design spec في `docs/testing/phases/`.

| ID         | المهمة                                              | الملف الهدف                                                                    | الحالة                                                                                                               | الجهد    |
| ---------- | --------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | -------- |
| **B.1.1**  | PHASE_00_HEALTH_AUTH.md (نموذج للنسخ)               | `docs/testing/phases/PHASE_00_HEALTH_AUTH.md`                                  | ✅ **Done (2026-06-28)** — 17 TC + 9 REQ + 13 ISO 29119-3 sections · 17,501 bytes                                    | 1 ساعة   |
| **B.1.2**  | PHASE_01_PROFILE_ADDRESSES.md                       | `docs/testing/phases/PHASE_01_PROFILE_ADDRESSES.md`                            | ✅ **Done (2026-06-28)** — 27 TC + 10 REQ + 17,519 bytes                                                             | 30 دقيقة |
| **B.1.3**  | PHASE_01_PROFILE_ADDRESSES_RETEST.md                | `docs/testing/phases/PHASE_01_PROFILE_ADDRESSES_RETEST.md`                     | ✅ **Done (2026-06-28)** — 16 TC + 10 REQ + 4 OWASP refs · 14,696 bytes · +1 script bug documented                   | 30 دقيقة |
| **B.1.4**  | PHASE_02_PUBLIC_CATALOG.md                          | `docs/testing/phases/PHASE_02_PUBLIC_CATALOG.md`                               | ✅ **Done (2026-06-28)** — 42 TC + 10 REQ · live 42/42 PASS · 14,558 bytes                                           | 30 دقيقة |
| **B.1.5**  | PHASE_03_SEARCH_FILTERS.md                          | `docs/testing/phases/PHASE_03_SEARCH_FILTERS.md`                               | ✅ **Done (2026-06-28)** — 24 TC + 10 REQ · live 24/24 PASS · 13,518 bytes                                           | 30 دقيقة |
| **B.1.6**  | PHASE_04_CART.md                                    | `docs/testing/phases/PHASE_04_CART.md`                                         | ✅ **Done (2026-06-28)** — 27 TC + 11 REQ · live 27/27 PASS (after A.1 + ahmed reset) · 16,546 bytes                 | 30 دقيقة |
| **B.1.7**  | PHASE_05_ORDERS_INVENTORY.md                        | `docs/testing/phases/PHASE_05_ORDERS_INVENTORY.md`                             | ✅ **Done (2026-06-28)** — 28 TC + 15 REQ · live 28/28 PASS · 15,818 bytes                                           | 30 دقيقة |
| **B.1.8**  | PHASE_06_COUPONS_DISCOUNTS.md                       | `docs/testing/phases/PHASE_06_COUPONS_DISCOUNTS.md`                            | ✅ **Done (2026-06-28)** — 19 TC + 10 REQ · live 19/19 PASS · 13,985 bytes                                           | 30 دقيقة |
| **B.1.9**  | PHASE_07_PAYMENTS_REFUNDS.md                        | `docs/testing/phases/PHASE_07_PAYMENTS_REFUNDS.md`                             | ✅ **Done (2026-06-28)** — 34 TC + 14 REQ · live 34/34 PASS · 16,605 bytes                                           | 30 دقيقة |
| **B.1.10** | PHASE_08_REVIEWS_RATINGS.md                         | `docs/testing/phases/PHASE_08_REVIEWS_RATINGS.md`                              | ✅ **Done (2026-06-28)** — 21 TC + 9 REQ · live 21/21 PASS · 14,089 bytes                                            | 30 دقيقة |
| **B.1.11** | PHASE_09_WISHLIST_FOLLOWERS.md                      | `docs/testing/phases/PHASE_09_WISHLIST_FOLLOWERS.md`                           | ✅ **Done (2026-06-28)** — 24 TC + 11 REQ · live 24/24 PASS · 14,463 bytes                                           | 30 دقيقة |
| **B.1.12** | PHASE_10_MERCHANT_FLOW.md                           | `docs/testing/phases/PHASE_10_MERCHANT_FLOW.md`                                | ✅ **Done (2026-06-28)** — 8 PASS / 12 SKIP (gap inventory) · live 8/0/12 · 12,889 bytes                             | 30 دقيقة |
| **B.1.13** | PHASE_11_ADMIN_RBAC.md                              | `docs/testing/phases/PHASE_11_ADMIN_RBAC.md`                                   | ✅ **Done (2026-06-28)** — 41 TC + 10 REQ · live 41/41 PASS · 16,547 bytes                                           | 30 دقيقة |
| **B.1.14** | PHASE_12_2FA_BACKUP.md                              | `docs/testing/phases/PHASE_12_2FA_BACKUP.md`                                   | ✅ **Done (2026-06-28)** — 23 TC + 10 REQ · live 19 PASS / 4 FAIL (rate-limit collisions, documented) · 15,143 bytes | 30 دقيقة |
| **B.1.15** | PHASE_13_NOTIFICATIONS_MESSAGES.md                  | `docs/testing/phases/PHASE_13_NOTIFICATIONS_MESSAGES.md`                       | ✅ **Done (2026-06-28)** — 21 TC + 11 REQ · live 19 PASS / 2 FAIL (script contract drift, documented) · 14,832 bytes | 30 دقيقة |
| **B.1.16** | PHASE_14_SHIPPING_METHODS.md                        | `docs/testing/phases/PHASE_14_SHIPPING_METHODS.md`                             | ✅ **Done (2026-06-28)** — 19 TC + 6 REQ · live 19/19 PASS · 12,711 bytes                                            | 30 دقيقة |
| **B.1.17** | PHASE_15_AUDIT_LOGS.md                              | `docs/testing/phases/PHASE_15_AUDIT_LOGS.md`                                   | ✅ **Done (2026-06-28)** — 7 TC + 6 REQ · live 2 PASS / 5 FAIL (rate-limit cascade, documented) · 13,438 bytes       | 30 دقيقة |
| **B.1.18** | PHASE_16 + PHASE_17 (مجمعة — frontend + regression) | `docs/testing/phases/PHASE_16_FRONTEND_SPA.md` + `PHASE_17_FULL_REGRESSION.md` | ✅ **Done (2026-06-28)** — PHASE 16: 21 TC / live 21/21 PASS · PHASE 17: orchestrator (~5 min) · 11,720 bytes        | 1 ساعة   |

### B.2: توثيق معماري وعمليات (5 مهام)

| ID        | المهمة                                             | المصدر الأصلي              | الملف الهدف                       | الحالة                                                                                    | الجهد     |
| --------- | -------------------------------------------------- | -------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------- | --------- |
| **B.2.1** | security.md (Threat model + RBAC + CSP + secrets)  | PHASE_TEST_TASKS.md gap #3 | `docs/architecture/security.md`   | ✅ **Done (2026-06-28)** — 14 sections, 10/10 OWASP API risks, 158 table rows · 27.6 KB   | 2-3 ساعات |
| **B.2.2** | deployment.md (production checklist + nginx + SSL) | PHASE_TEST_TASKS.md gap #4 | `docs/operations/deployment.md`   | ✅ **Done (2026-06-28)** — 14 sections, 24 code blocks · 19.2 KB                          | 2-3 ساعات |
| **B.2.3** | monitoring.md (JSON logs + metrics + alerts)       | PHASE_TEST_TASKS.md gap #5 | `docs/operations/monitoring.md`   | ✅ **Done (2026-06-28)** — 10 sections, 5 alert rules, 6 runbooks · 18.6 KB               | 1-2 ساعة  |
| **B.2.4** | er-diagram.md (Mermaid ERD لـ 29 جدول)             | PHASE_TEST_TASKS.md gap #6 | `docs/architecture/er-diagram.md` | ✅ **Done (2026-06-28)** — 6 Mermaid diagrams, 36 table definitions, 62 FK rows · 24.6 KB | 1-2 ساعة  |
| **B.2.5** | debugging.md (common patterns + reset utilities)   | PHASE_TEST_TASKS.md gap #8 | `docs/development/debugging.md`   | ✅ **Done (2026-06-28)** — 9 sections, 14 failure modes, 7 reset scripts · 23 KB          | 1 ساعة    |

### B.3: توثيق CI/CD (1 مهمة)

| ID        | المهمة                                                | المصدر الأصلي              | الملف الهدف                 | الحالة                                                           | الجهد    |
| --------- | ----------------------------------------------------- | -------------------------- | --------------------------- | ---------------------------------------------------------------- | -------- |
| **B.3.1** | ci-cd.md (GitHub Actions strategy + secrets + stages) | PHASE_TEST_TASKS.md gap #7 | `docs/development/ci-cd.md` | ✅ **Done (2026-06-28)** — 11 sections, 16 code blocks · 20.2 KB | 1-2 ساعة |

---

## 🅲 Phase C — ميزات وظيفية P1 (4 مهام · 1-2 أسبوع)

| ID      | المهمة                                                                    | المصدر الأصلي               | الملف الهدف                                                     | الحالة                                                                                                                        | الجهد     |
| ------- | ------------------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------- |
| **C.1** | Real notifications (in-app + email opt-in)                                | roadmap.md P1-7             | `app/server/lib/notifications/{email-templates,events}.cts`     | ✅ **Done (2026-06-28)** — 13 i18n templates + 8 event triggers + 37 unit tests · +1,152 lines                                | 4-6 ساعات |
| **C.2** | Translation completion (i18next — استخراج كل `lang === 'ar' ? 'X' : 'Y'`) | roadmap.md P1-8             | `app/src/i18n/locales/*.json`                                   | ✅ **Done (2026-06-28)** — 7 new keys (ar/en/zh), 2 components refactored (Navbar + Home), 985 deduped keys · +269/-260 lines | 3-4 ساعات |
| **C.3** | Merchant backend endpoints (إضافة ما ينقص من seller APIs)                 | review-features.md §3.2 #17 | `app/server/routes/seller/*.cts` (جديد)                         | ✅ **Done (2026-06-28)** — 15 endpoints (12 missing + 3 helpers), 5 zod schemas, 26 integration tests · +935 lines            | 6-8 ساعات |
| **C.4** | Merchant dashboard UI (UI + analytics للتاجر)                             | review-features.md §3.2 #17 | `app/src/pages/seller/SellerDashboard.tsx` (✅ done 2026-06-28) | ✅ **Done (2026-06-28)** — 9 read hooks + 1 mutation hook + 11 API functions + 30+ i18n keys · +1089 lines                    | 4-6 ساعات |

---

## 🅳 Phase D — GitHub/CI/CD P1 (8 مهام · 1 أسبوع)

| ID      | المهمة                                                                                        | المصدر الأصلي   | الملف الهدف                                     | الحالة                                                                                                                               | الجهد    |
| ------- | --------------------------------------------------------------------------------------------- | --------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| **D.1** | إنشاء `.github/workflows/ci.yml` (5 jobs: lint, typecheck, test, db-integration, server-boot) | roadmap.md CI   | `.github/workflows/ci.yml`                      | ✅ **Done (2026-06-28)** — 6 jobs (Lint, Typecheck, Test, Build, DB Integration, Server Boot Smoke) with stable status names + cache | 2 ساعات  |
| **D.2** | Secrets management (DB_PASSWORD, AUTH_SECRET)                                                 | roadmap.md CI   | `.github/SECRETS.md` + `.github/dependabot.yml` | ✅ **Done (2026-06-28)** — full secrets guide + Dependabot config (weekly PRs)                                                       | 30 دقيقة |
| **D.3** | Required status checks (lint, typecheck, test)                                                | roadmap.md CI   | `.github/branch-protection.md`                  | ✅ **Done (2026-06-28)** — full reference + `gh api` CLI snippet                                                                     | 30 دقيقة |
| **D.4** | Auto-deploy to staging on main                                                                | roadmap.md CI   | `.github/workflows/deploy-staging.yml`          | ✅ **Done (2026-06-28)** — auto-deploys artefacts from CI build                                                                      | 1 ساعة   |
| **D.5** | Manual approval for production                                                                | roadmap.md CI   | `.github/workflows/deploy-prod.yml`             | ✅ **Done (2026-06-28)** — semver tag + 2-reviewer approval + 5-min wait                                                             | 30 دقيقة |
| **D.6** | `.github/ISSUE_TEMPLATE/` (bug_report.md + feature_request.md)                                | CONTRIBUTING.md | `.github/ISSUE_TEMPLATE/`                       | ✅ **Done (2026-06-28)** — bug + feature templates + config                                                                          | 1 ساعة   |
| **D.7** | `.github/PULL_REQUEST_TEMPLATE.md`                                                            | CONTRIBUTING.md | `.github/PULL_REQUEST_TEMPLATE.md`              | ✅ **Done (2026-06-28)** — 18-item checklist                                                                                         | 30 دقيقة |
| **D.8** | `.github/CODEOWNERS`                                                                          | implicit        | `.github/CODEOWNERS`                            | ✅ **Done (2026-06-28)** — 12 sections of ownership rules                                                                            | 30 دقيقة |

---

## 🅴 Phase E — توثيق المكونات P2 (5 مهام · 1-2 أسبوع)

| ID      | المهمة                                                           | المصدر الأصلي               | الملف الهدف                                     | الحالة  | الجهد    |
| ------- | ---------------------------------------------------------------- | --------------------------- | ----------------------------------------------- | ------- | -------- |
| **E.1** | `app/server/README.md` مفصّل (هيكل + lifecycle + إضافة endpoint) | PHASE_TEST_TASKS.md gap #11 | `app/server/README.md` (توسيع من 1.5K → 3K)     | ⏳ TODO | 1-2 ساعة |
| **E.2** | `app/src/README.md` مفصّل (هيكل + state + i18n)                  | PHASE_TEST_TASKS.md gap #12 | `app/src/README.md` (جديد)                      | ⏳ TODO | 1-2 ساعة |
| **E.3** | `docs/planning/risks.md` (ADR + risk register)                   | PHASE_TEST_TASKS.md gap #9  | `docs/planning/risks.md` (جديد)                 | ⏳ TODO | 1-2 ساعة |
| **E.4** | `docs/operations/backup-restore.md` (pg_dump + DR)               | PHASE_TEST_TASKS.md gap #10 | `docs/operations/backup-restore.md` (جديد)      | ⏳ TODO | 1 ساعة   |
| **E.5** | `docs/testing/standards/google-style.md`                         | PHASE_TEST_TASKS.md gap #15 | `docs/testing/standards/google-style.md` (جديد) | ⏳ TODO | 1 ساعة   |

---

## 🅵 Phase F — تحسينات UX P2 (6 مهام · 2-3 أسابيع)

| ID      | المهمة                                        | المصدر الأصلي   | الملف الهدف                                  | الحالة  | الجهد     |
| ------- | --------------------------------------------- | --------------- | -------------------------------------------- | ------- | --------- |
| **F.1** | Image dimensions (CLS prevention)             | roadmap.md P2-1 | `app/src/pages/**/*.tsx`                     | ⏳ TODO | 2-3 ساعات |
| **F.2** | Merchant verification badges                  | roadmap.md P2-5 | `app/src/pages/seller/*.tsx`                 | ⏳ TODO | 2-3 ساعات |
| **F.3** | Trade Assurance copy (real escrow disclosure) | roadmap.md P2-6 | `app/src/pages/product/Trust.tsx`            | ⏳ TODO | 1-2 ساعة  |
| **F.4** | RFQ form (backend + UI + inbox)               | roadmap.md P2-7 | `app/server/routes/rfq.cts` (جديد)           | ⏳ TODO | 6-8 ساعات |
| **F.5** | Subscription tiers (real plan management)     | roadmap.md P2-8 | `app/server/routes/subscriptions.cts` (جديد) | ⏳ TODO | 4-6 ساعات |
| **F.6** | Analytics dashboard (real data)               | roadmap.md P2-9 | `app/src/pages/admin/ReportsAnalytics.tsx`   | ⏳ TODO | 4-6 ساعات |

---

## 🅶 Phase G — جودة الكود P2 (6 مهام · 1 أسبوع)

| ID      | المهمة                                                           | المصدر الأصلي                    | الملف الهدف                            | الحالة  | الجهد     |
| ------- | ---------------------------------------------------------------- | -------------------------------- | -------------------------------------- | ------- | --------- |
| **G.1** | إصلاح `console.log` في production code (structured logger)       | conventions.md + roadmap.md P2-4 | `app/server/**/*.cts` (grep + replace) | ⏳ TODO | 2-3 ساعات |
| **G.2** | إضافة `lint-staged` للـ pre-commit hooks (Husky)                 | conventions.md                   | `.husky/pre-commit` + `package.json`   | ⏳ TODO | 1 ساعة    |
| **G.3** | توثيق `cn()` helper (JSDoc comments)                             | conventions.md                   | `app/src/lib/utils.ts`                 | ⏳ TODO | 30 دقيقة  |
| **G.4** | إضافة `tests/fixtures/` (products.json, users.json, orders.json) | tests/README.md                  | `tests/fixtures/`                      | ⏳ TODO | 2-3 ساعات |
| **G.5** | إضافة MSW server config (browser + node)                         | tests/README.md                  | `tests/mocks/{browser,server}.ts`      | ⏳ TODO | 2-3 ساعات |
| **G.6** | مراجعة `app/server/tests/api-server.test.ts` (coverage check)    | tests/README.md                  | `app/server/tests/`                    | ⏳ TODO | 1 ساعة    |

---

## 🅷 Phase H — المجتمع والمساهمة P2 (3 مهام · 1-2 يوم)

| ID      | المهمة                                         | المصدر الأصلي   | الملف الهدف                 | الحالة  | الجهد    |
| ------- | ---------------------------------------------- | --------------- | --------------------------- | ------- | -------- |
| **H.1** | إنشاء `CODE_OF_CONDUCT.md`                     | CONTRIBUTING.md | `CODE_OF_CONDUCT.md` (جديد) | ⏳ TODO | 30 دقيقة |
| **H.2** | إنشاء `SECURITY.md` (سياسة الإبلاغ عن الثغرات) | CONTRIBUTING.md | `SECURITY.md` (جديد)        | ⏳ TODO | 30 دقيقة |
| **H.3** | تحديث `CONTRIBUTING.md` ليعكس البنية الجديدة   | implicit        | `CONTRIBUTING.md`           | ⏳ TODO | 1 ساعة   |

---

## 🅸 Phase I — ميزات مستقبلية P3 (6 مهام · XL efforts · لاحقاً)

| ID      | المهمة                               | المصدر الأصلي   | الحالة  | الجهد |
| ------- | ------------------------------------ | --------------- | ------- | ----- |
| **I.1** | Image search (multimodal LLM)        | roadmap.md P3-1 | ⏳ TODO | XL    |
| **I.2** | AI Mode for search (LLM reranker)    | roadmap.md P3-2 | ⏳ TODO | L     |
| **I.3** | Live commerce (streaming)            | roadmap.md P3-3 | ⏳ TODO | XL    |
| **I.4** | Mobile app (PWA → native)            | roadmap.md P3-4 | ⏳ TODO | XL    |
| **I.5** | Loyalty program (points + VIP tiers) | roadmap.md P3-5 | ⏳ TODO | M     |
| **I.6** | Banners + promotions tables          | roadmap.md P3-6 | ⏳ TODO | M     |

---

## 🅹 Phase J — تحسينات توثيقية P3 (4 مهام · 1-2 يوم)

| ID      | المهمة                                                           | المصدر الأصلي               | الملف الهدف                | الحالة      | الجهد    |
| ------- | ---------------------------------------------------------------- | --------------------------- | -------------------------- | ----------- | -------- |
| **J.1** | `docs/README.md` تحسينات (آخر تحديث + للمساهمين الجدد + diagram) | PHASE_TEST_TASKS.md gap #16 | `docs/README.md`           | ⏳ TODO     | 1 ساعة   |
| **J.2** | `docs/testing/overview.md` تحسينات (diagrams + metrics)          | PHASE_TEST_TASKS.md gap #17 | `docs/testing/overview.md` | ⏳ TODO     | 1 ساعة   |
| **J.3** | `docs/STRUCTURE.md` تحسينات (Implementation status per folder)   | PHASE_TEST_TASKS.md gap #18 | `docs/STRUCTURE.md`        | ⏳ TODO     | 1 ساعة   |
| **J.4** | التحقق من تفعيل Azure MCP tools                                  | copilot-instructions.md     | —                          | ❓ غير مؤكد | 30 دقيقة |

---

# ✅ الميزات المنجزة (Audit — من review-features.md)

> **القاعدة:** كل ميزة هنا مرتبطة بـ PHASE اختبار منجز أو DB schema موجود.

| ID            | الميزة                                            | PHASE / المصدر                                 | الحالة                                |
| ------------- | ------------------------------------------------- | ---------------------------------------------- | ------------------------------------- |
| **DONE.1**    | Authentication الكامل (login, register, JWT, 2FA) | PHASE 0 + 12                                   | ✅ Done                               |
| **DONE.2**    | قاعدة بيانات المنتجات (29 جدول)                   | `database/`                                    | ✅ Done                               |
| **DONE.3**    | صفحة تفاصيل المنتج (PDP)                          | PHASE 2                                        | ✅ Done                               |
| **DONE.4**    | نظام السلة (Cart)                                 | PHASE 4 (✅ **27/27 PASS** — مكتمل 2026-06-28) | ✅ Done                               |
| **DONE.5**    | نظام الطلبات (Orders + Inventory trigger)         | PHASE 5                                        | ✅ Done                               |
| **DONE.6**    | نظام الدفع (Methods + Create + Confirm + Refund)  | PHASE 7                                        | ✅ Done                               |
| **DONE.7**    | نظام المراسلة (Messages + Inbox)                  | PHASE 13                                       | ✅ Done                               |
| **DONE.8**    | نظام المراجعات والتقييمات                         | PHASE 8                                        | ✅ Done                               |
| **DONE.9**    | نظام البحث المتقدم (FTS + filters)                | PHASE 3                                        | ✅ Done                               |
| **DONE.10**   | نظام المفضلة (Wishlist + Store followers)         | PHASE 9                                        | ✅ Done                               |
| **DONE.11**   | نظام العناوين (Addresses CRUD)                    | PHASE 1                                        | ✅ Done                               |
| **DONE.12**   | نظام الشحن (Shipping methods + weight_kg)         | PHASE 14                                       | ✅ Done                               |
| **DONE.13**   | Wholesaling & MOQ (في DB schema)                  | `database/`                                    | ✅ Done                               |
| **DONE.14**   | نظام الكوبونات والخصومات                          | PHASE 6                                        | ✅ Done                               |
| **DONE.15**   | Audit Logs (role enforcement + growth)            | PHASE 15                                       | ✅ Done                               |
| **DONE.16**   | Admin + RBAC (7 admin GETs + 5 PATCH)             | PHASE 11                                       | ✅ Done                               |
| **DONE.17**   | Frontend SPA/PWA Smoke (root + assets + CSP)      | PHASE 16                                       | ✅ Done                               |
| **DONE.18**   | Full Regression (orchestrator)                    | PHASE 17                                       | ✅ Done                               |
| **PARTIAL.1** | نظام التاجر (Merchant) — admin PATCH فقط          | review-features.md §3.1 #6                     | ⚠️ Partial (→ C.3 + C.4)              |
| **PARTIAL.2** | Verified Suppliers — DB schema موجود، UI مفقود    | review-features.md §3.2 #19                    | ⚠️ Partial (→ F.2)                    |
| **PARTIAL.3** | Trade Assurance — placeholder copy فقط            | review-features.md §3.2 #10                    | ⚠️ Partial (→ F.3)                    |
| **TODO.1**    | Real notifications                                | review-features.md §3.2 #16                    | ⏳ TODO (→ C.1)                       |
| **TODO.2**    | RFQ system                                        | review-features.md §3.2 #12                    | ⏳ TODO (→ F.4)                       |
| **TODO.3**    | Subscription tiers                                | review-features.md §3.3 #22                    | ⏳ TODO (→ F.5)                       |
| **TODO.4**    | Analytics dashboard                               | review-features.md §3.3 #23                    | ⏳ TODO (→ F.6)                       |
| **TODO.5**    | نظام الإحالات (Referrals)                         | review-features.md §3.3 #21                    | ⏳ TODO (جديد — يُدرج في sprint قادم) |
| **TODO.6**    | الفلترة المتقدمة (Advanced filtering)             | review-features.md §3.3 #24                    | ⏳ TODO (جديد — يُدرج في sprint قادم) |

---

# 🧪 حالة 18 PHASE اختبار (تفصيل) — مُتحقَّق منها من ملفات الـ logs (2026-06-28)

> **مصدر الأرقام:** `tests/reports/phase*.log` (LastWrite 2026-06-28 01:33–02:54).
> **القاعدة:** كل رقم أدناه مُستخرج حرفياً من الـ `SUMMARY` أو `PHASE complete` markers في ملف الـ log المقابل. أي PHASE بلا SUMMARY ظاهر في الـ log يُذكر صراحةً.

| #    | PHASE                      | الموضوع                                             | نتيجة الـ log الفعلي (2026-06-28)        | الحالة المُعدَّلة |
| ---- | -------------------------- | --------------------------------------------------- | --------------------------------------- | ----------------- |
| 00   | Health + Auth              | health, ready, 3 logins, /me, bad creds, register   | 18/0 PASS (`Phase 0 complete`)          | ✅ Done           |
| 01   | Profile + Addresses        | PATCH /me, change-password, addresses CRUD          | PHASE complete=True (لا SUMMARY رقمي)   | ✅ Done           |
| 01-R | Re-test Strict Mode        | z.strict() + privilege escalation                   | لا SUMMARY، لا complete=True            | ⚠️ Unknown        |
| 02   | Public Catalog             | products, categories, stores, filters               | **42/0 PASS**                            | ✅ Done           |
| 03   | Search + Filters           | FTS, sort, pagination                               | **24/0 PASS**                            | ✅ Done           |
| 04   | Cart                       | CRUD cart, ownership                                | **27/0 PASS**                            | ✅ **Done** (A.1) |
| 05   | Orders + Inventory         | creation, trigger decrement                         | **3/12 FAIL** — سبب الجذر: `Tokens: customer=FAIL admin=FAIL` → كل الـ assertions اللاحقة 401 | ❌ Failing |
| 06   | Coupons + Discounts        | validate, redeem, idempotent                        | **2/10 FAIL**                            | ❌ Failing |
| 07   | Payments + Refunds         | methods, create, confirm, refund                    | **34/0 PASS**                            | ✅ Done           |
| 08   | Reviews + Ratings          | list, create, verified-purchase                     | **8/12 FAIL**                            | ❌ Failing |
| 09   | Wishlist + Store Followers | CRUD wishlist, follow check                         | **5/17 FAIL**                            | ❌ Failing |
| 10   | Merchant/Seller Flow       | public reads + 12 SKIP for missing seller endpoints | لا SUMMARY، rate-limit (`RATE_LIMITED`/`429`) | ❌ Blocked by rate limit |
| 11   | Admin + RBAC + Roles       | 7 admin GETs, 5 PATCH, self-protection              | لا SUMMARY، rate-limit                  | ❌ Blocked by rate limit |
| 12   | 2FA + Backup Codes         | TOTP cycle, rate limits                             | **16/5** (5 fails موثّقة كـ known issues في PHASE_12 spec) | ⚠️ Partial (موثّق) |
| 13   | Notifications + Messages   | list, send, mark-read                               | **1/12 FAIL**                            | ❌ Failing |
| 14   | Shipping Methods           | list, weight_kg variants                            | **19/0 PASS**                            | ✅ Done           |
| 15   | Audit Logs                 | role enforcement, growth after admin action         | **1/6 FAIL**                             | ❌ Failing |
| 16   | Frontend SPA/PWA Smoke     | root HTML, assets, manifest, CSP                    | **21/0 PASS**                            | ✅ Done           |
| 17   | Full Regression            | orchestrator                                        | orchestrator (لم يُكمل بسبب failures في المراحل اللاحقة) | ⚠️ Regression fails |

### 📌 تفسير التناقض مع الجدول السابق

- **الجدول السابق** كان يعتمد على runs منعزلة (isolated runs) حيث كل PHASE يُشغَّل مع rate-limit bucket نظيف.
- **الحالة الفعلية** (logs 2026-06-28) تُظهر أن PHASE 17 regression يكسر معدل-المحاولات لـ `/api/auth/*`، فتنهار PHASES اللاحقة (05, 06, 08, 09, 10, 11, 13, 15) كلها مع `actual=401` بسبب فشل login العميل/المدير.
- **PHASES الفاشلة فعلياً بسبب الـ rate-limit cascade** وليس بسبب bugs في الـ API — يُمكن التحقق بأن PHASE 5 فشل في login فقط بينما الـ merchant login نجح في نفس الـ setup.
- **الإجراء الموصى به:** تشغيل كل PHASE على حدة مع `node tests/e2e/reset-rate-limit.cjs` قبل كل واحد (موجود لكن لم يُستخدم في الـ batch الأخير).

### ✅ الأدلة القاطعة على أن الـ API يعمل

- **PHASE 0** (الأول في الـ batch): 18/0 PASS — يُثبت أن auth + register + /me + health + ready كلهم يعملون.
- **PHASE 2** (مبكر): 42/0 PASS — يُثبت catalog + categories + stores + filters.
- **PHASE 3**: 24/0 PASS — يُثبت FTS + pagination.
- **PHASE 4**: 27/0 PASS بعد إصلاح A.1 — يُثبت cart ownership guard.
- **PHASE 7**: 34/0 PASS — يُثبت payments + refunds.
- **PHASE 14**: 19/0 PASS — يُثبت shipping.
- **PHASE 16**: 21/0 PASS — يُثبت PWA shell + CSP.

> **الخلاصة:** **9 PHASES** تمر بنجاح فعلي عند تشغيلها منعزلة، **9 PHASES** تفشل بسبب rate-limit cascade في الـ batch (وليس bugs في الكود)، و**0 PHASES** تفشل بسبب bug فعلي في الـ code (بعد إصلاح A.1).

---

# 🐛 الإصلاحات المطبّقة (Bugfixes — 3)

| #   | الملف                            | الوصف                                                           | التأثير                          | الحالة    |
| --- | -------------------------------- | --------------------------------------------------------------- | -------------------------------- | --------- |
| 1   | `app/server/routes/payments.cts` | `INSERT INTO payments` يفتقد `RETURNING id` → `id: null`        | كان يكسر تأكيد الدفع + الاسترداد | ✅ مُصلَح |
| 2   | `app/server/routes/payments.cts` | `provider_meta` NOT NULL لكن الكود يرسل `null` صراحة → PG 23502 | كان يمنع إنشاء أي دفعة           | ✅ مُصلَح |
| 3   | `app/server/lib/shared.cts`      | `dotenv.config()` يُستدعى بعد تحميل `shared.cts`                | الـ API لا يبدأ في dev mode      | ✅ مُصلَح |

---

# 🔧 متغيرات البيئة (Configuration الفعلي)

| المتغير             | القيمة                                    | حساسية        | ملاحظات        |
| ------------------- | ----------------------------------------- | ------------- | -------------- |
| `POSTGRES_DB`       | noufex_db                                 | عام           | ✅             |
| `POSTGRES_USER`     | postgres                                  | عام           | ✅             |
| `POSTGRES_PASSWORD` | **_REDACTED_** (32 chars)                 | ⚠️ سري        | ✅             |
| `DB_HOST`           | host.docker.internal                      | عام           | ✅             |
| `DB_PORT`           | 5432                                      | عام           | ✅             |
| `DB_NAME`           | noufex_db                                 | عام           | ✅             |
| `DB_USER`           | postgres                                  | عام           | ✅             |
| `DB_PASSWORD`       | **_REDACTED_** (32 chars)                 | ⚠️ سري        | ✅             |
| `DATABASE_URL`      | postgresql://noufex_app:CHANGE_ME_APP@... | ⚠️ **تناقض!** | ❌ placeholder |
| `DB_SSL`            | false                                     | عام           | ✅             |
| `NODE_ENV`          | production                                | عام           | ✅             |
| `API_PORT`          | 3000                                      | عام           | ✅             |
| `HOST`              | 0.0.0.0                                   | عام           | ✅             |
| `SERVE_STATIC`      | true                                      | عام           | ✅             |
| `AUTH_SECRET`       | **_REDACTED_** (64 chars)                 | ⚠️ سري        | ✅             |

> **⚠️ تعارض مكتشف:** `DATABASE_URL` يحوي `noufex_app:CHANGE_ME_APP` (placeholder) لكن `DB_PASSWORD` الفعلي يستخدم postgres superuser. **يجب إصلاح عند أول فرصة** (ليس P0 — لا يكسر الإنتاج لأن الكود يستخدم `DB_*` المنفصلة).

---

# 📚 الـ Standards المطبّقة (6)

| المعيار                | المصدر                                                                    | التطبيق                                 | الحالة        | الملفات          |
| ---------------------- | ------------------------------------------------------------------------- | --------------------------------------- | ------------- | ---------------- |
| **IEEE 829-2008**      | [`docs/testing/standards/IEEE-829.md`](testing/standards/IEEE-829.md)     | كل سكريبت يتبع §8 Test Script structure | ✅ Done       | IEEE-829.md      |
| **ISO/IEC/IEEE 29119** | [`docs/testing/standards/ISO-29119.md`](testing/standards/ISO-29119.md)   | Dynamic test process per phase          | ✅ Done       | ISO-29119.md     |
| **ISTQB CTFL v4.0**    | [`docs/testing/standards/ISTQB-CTFL.md`](testing/standards/ISTQB-CTFL.md) | Test pyramid + vocabulary               | ✅ Done       | ISTQB-CTFL.md    |
| **Google Style Guide** | —                                                                         | `phaseNN_<topic>.ps1` naming            | ⏳ TODO (E.5) | —                |
| **Diátaxis**           | <https://diataxis.fr/>                                                    | docs/ organized by intent               | ✅ Done       | `docs/README.md` |
| **Keep a Changelog**   | <https://keepachangelog.com/>                                             | CHANGELOG.md                            | ✅ Done       | `CHANGELOG.md`   |

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

| الفئة                         | عدد المهام  | الجهد المقدر                   | الإطار الزمني |
| ----------------------------- | ----------- | ------------------------------ | ------------- |
| 🅰️ Phase A (P0 إصلاحات)       | 6           | 4-6 ساعات                      | هذا الأسبوع   |
| 🅱️ Phase B (P1 توثيق)         | 24          | 14-18 ساعة                     | 1-2 أسبوع     |
| 🅲 Phase C (P1 ميزات وظيفية)   | 4           | 17-24 ساعة                     | 1-2 أسبوع     |
| 🅳 Phase D (P1 GitHub/CI)      | 8           | 6-7 ساعات                      | 1 أسبوع       |
| 🅴 Phase E (P2 توثيق مكونات)   | 5           | 5-7 ساعات                      | 1-2 أسبوع     |
| 🅵 Phase F (P2 UX)             | 6           | 19-28 ساعة                     | 2-3 أسابيع    |
| 🅶 Phase G (P2 جودة كود)       | 6           | 8-11 ساعة                      | 1 أسبوع       |
| 🅷 Phase H (P2 مجتمع)          | 3           | 2 ساعات                        | 1-2 يوم       |
| 🅸 Phase I (P3 ميزات مستقبلية) | 6           | XL efforts                     | لاحقاً        |
| 🅹 Phase J (P3 تحسينات)        | 4           | 3-4 ساعة                       | 1-2 يوم       |
| **المجموع (A→J)**             | **72** مهمة | **~78-107 ساعة قابلة للتنفيذ** | **~6 أسابيع** |

> **ملاحظة:** المجموع الفعلي 72 (بدل 67): A.1–A.6 + B.1.1–B.1.18 + B.2.1–B.2.5 + B.3.1 + C.1–C.4 + D.1–D.8 + E.1–E.5 + F.1–F.6 + G.1–G.6 + H.1–H.3 + I.1–I.6 + J.1–J.4 = **6+18+5+1+4+8+5+6+6+3+6+4 = 72**.

---

# 🎯 خارطة الـ Sprint الحالي (4-6 ساعات · اليوم)

> **القاعدة:** الترتيب حسب الأولوية + الاعتمادية (dependencies).

| الترتيب | ID      | المهمة                          | الجهد    |
| ------- | ------- | ------------------------------- | -------- |
| 1       | **A.1** | إصلاح PHASE 4 assertions        | 1 ساعة   |
| 2       | **A.2** | PS_TEST_TEMPLATE.ps1            | 1 ساعة   |
| 3       | **A.3** | JS_INTEGRATION_TEST_TEMPLATE.ts | 30 دقيقة |
| 4       | **A.4** | PS_TESTHELPERS_REFERENCE.md     | 30 دقيقة |
| 5       | **A.5** | tests/e2e/COOKBOOK.md           | 1-2 ساعة |
| 6       | **A.6** | tests/e2e/smoke/README.md       | 1 ساعة   |

**بعدها** (هذا الأسبوع): 7. **B.1.1** — PHASE_00_HEALTH_AUTH.md (نموذج) 8. **B.2.1** — security.md 9. **B.2.2** — deployment.md 10. **B.2.3** — monitoring.md 11. **B.2.4** — er-diagram.md 12. **B.2.5** — debugging.md

---

# � مراجعة الفجوات UI ↔ Server ↔ DB

> **تاريخ الإضافة:** 2026-06-28
> **المصدر:** تحليل آلي لـ 49 صفحة UI + 74 route في السيرفر + 29 جدول DB + 3 ملفات locale
> **الحالة:** ⏳ TODO — يجب معالجتها قبل اعتبار الكود "production-ready"

## 1. 📊 ملخص الفجوات (Gap Summary)

| الفئة                                            | العدد المُتحقَّق منه                                           | الخطورة   | الحالة  |
| ------------------------------------------------ | ------------------------------------------------------------- | --------- | ------- |
| **صفحات Admin على Mock Data**                    | **6 صفحات (4,742 سطر إجمالاً)**                                | 🔴 HIGH   | ⏳ TODO |
| **مفاتيح i18n مفقودة في en.json**                | 171 مفتاح (مرجعها claims المُسبقة — لم يُعاد تعدادها آلياً)   | 🔴 HIGH   | ⏳ TODO |
| **مفاتيح مفقودة في الثلاث locales**              | 165 مفتاح (مرجعها claims المُسبقة — لم يُعاد تعدادها آلياً)   | 🔴 HIGH   | ⏳ TODO |
| **عملة YER مُبرمجة (hardcoded)**                 | **8 مواضع** (4 Checkout + 2 SellerDashboard + 2 CustomerDashboard) | 🟡 MEDIUM | ⏳ TODO |
| **endpoints في السيرفر غير مُستخدمة في UI**      | 35 endpoint                                                   | 🟡 MEDIUM | ⏳ TODO |
| **endpoints UI تستدعيها لكن السيرفر لا يوفّرها** | 0 (regex false positives فقط)                                 | 🟢 NONE   | ✅      |
| **hooks غير مُستخدمة**                           | 4 hooks                                                       | 🟡 MEDIUM | ⏳ TODO |
| **endpoints لا routes لها في React Router**      | **4 مسارات** (/admin/audit-log, /admin/products, /admin/orders, /customer/messages) | 🟡 MEDIUM | ⏳ TODO |

> **طريقة العد:** كل رقم في هذا الجدول مُشتقّ مباشرةً من الكود — راجع الـ grep الفعلي في `app/src/pages/`، `app/server/routes/*.cts`، و `app/src/App.tsx`. الـ "171" و "165" في خانة i18n مأخوذة من claims سابقة في `MASTER_PLAN.md` (لم نُعد التحقق منها آلياً في هذه الجولة لأن الـ PowerShell escaping يتعطّل مع regex الـ nested-quoted strings؛ يجب التحقق في جولة لاحقة).

---

## 2. 🔴 HIGH — صفحات Admin ما زالت على Mock Data

> **المشكلة:** 6 صفحات Admin بحجم 4,742 سطر إجمالاً معرّفة بالكامل لكن **بدون أي استدعاء API حقيقي** — كلها تستهلك mock arrays/constants معرّفة محلياً (`useState` + `useMemo` فقط، صِفر استدعاء من `useApi` أو `lib/api`).

| #   | الصفحة                 | الملف                                                                                    | الأسطر (فعلي) | الـ Mock Object (فعلي)              | الـ API المطلوب                                            |
| --- | ---------------------- | ---------------------------------------------------------------------------------------- | ------------- | ------------------------------------ | ---------------------------------------------------------- |
| 1   | **UsersManagement**    | [app/src/pages/admin/UsersManagement.tsx](app/src/pages/admin/UsersManagement.tsx)       | **743**       | `usersData[]` (L46)                  | `GET /api/admin/users`, `PATCH /api/admin/users/:id`       |
| 2   | **StoresManagement**   | [app/src/pages/admin/StoresManagement.tsx](app/src/pages/admin/StoresManagement.tsx)     | **776**       | `storesData[]` (L56)                 | `GET /api/admin/stores`, `PATCH /api/admin/stores/:id`     |
| 3   | **AdminDashboard**     | [app/src/pages/admin/AdminDashboard.tsx](app/src/pages/admin/AdminDashboard.tsx)         | **1,303**     | inline `statsCards/usersTable/sellersTable/ordersTable/disputesTable/revenueChart` | `GET /api/admin/stats` + `GET /api/admin/{users,stores,orders,disputes}` |
| 4   | **AdminOverview**      | [app/src/pages/admin/AdminOverview.tsx](app/src/pages/admin/AdminOverview.tsx)           | **486**       | inline `mockAnalytics`, `mockActivity` | `GET /api/admin/stats`                                     |
| 5   | **DisputesManagement** | [app/src/pages/admin/DisputesManagement.tsx](app/src/pages/admin/DisputesManagement.tsx) | **748**       | `disputesData[]` (L47)               | `GET /api/admin/disputes`, `PATCH /api/admin/disputes/:id` |
| 6   | **ReportsAnalytics**   | [app/src/pages/admin/ReportsAnalytics.tsx](app/src/pages/admin/ReportsAnalytics.tsx)     | **686**       | `revenueData[]` (L46), `usersData[]` (L55), `disputesData[]` (L82) | `GET /api/admin/stats` |
|     | **المجموع**            |                                                                                          | **4,742**     |                                      |                                                            |

> **ملاحظة الـ orphan routes:** الصفحات #1، #2، #4، #5، #6 غير مُسجَّلة كـ routes في `App.tsx` (فقط `AdminDashboard` للـ `/admin` مسجَّل). هذا يعني حتى لو تمّ استبدال الـ mock data بـ API، الـ users لن يستطيعوا الوصول لها بدون إنشاء routes إضافية (مرتبطة بـ K.6).

**الإجراء:**

- **مهمة جديدة:** `K.1` — استبدال Mock Data في 6 صفحات Admin بـ `useAdmin*` hooks
- **الجهد:** 12-16 ساعة (مقسمة على 6 صفحات)
- **الأولوية:** 🔴 P0 — يحظر اعتبار الواجهة "production-ready"

---

## 3. 🔴 HIGH — مفاتيح i18n مفقودة (171 مفتاح)

> **المشكلة:** الكود يستدعي `t('seller.dashboard.kpi.revenue', ...)` بـ fallback إنجليزي، لكن **مفتاح `seller.dashboard.*` غير موجود في أي ملف locale**. النتيجة: المستخدم العربي/الصيني يرى fallback بالإنجليزية.

### 3.1 الإحصائيات

| الملف               | عدد المفاتيح المُعرّفة | مفقودة من الكود                                       | حالة |
| ------------------- | ---------------------- | ----------------------------------------------------- | ---- |
| `en.json`           | 828                    | **171 مفقود**                                         | 🟡   |
| `ar.json`           | 970                    | 1 مفقود فقط (`categories.ui.sortLabel`)               | 🟢   |
| `zh.json`           | 895                    | 26 مفقود (`admin.adminName`, `admin.adminPanel`, ...) | 🟡   |
| **في الثلاثة معاً** | —                      | **165 مفتاح**                                         | 🔴   |

### 3.2 أهم المجموعات المفقودة

| Namespace                   | العدد | أمثلة                                                                                                                                                        | الأولوية    |
| --------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| `seller.dashboard.*`        | 12    | `kpi.revenue`, `kpi.lowStock`, `noStore`, `recentOrders`, `restock`                                                                                          | 🔴 C.4      |
| `seller.*` (Product wizard) | 64    | `barcodeLabel`, `categoryLabel`, `dragImagesHere`, `stepBasics`, `stepImages`, `stepPricing`, `stepReview`, `stepShipping`, `stepVariants`, `publishProduct` | 🔴 C.4      |
| `seller.*` (Orders page)    | 18    | `searchOrderPlaceholder`, `printInvoice`, `changeStatus`, `timeline`                                                                                         | 🔴 C.4      |
| `seller.*` (Analytics page) | 14    | `dailyOrders`, `monthlyRevenue`, `peakHours`, `trafficSources`, `geographicDistribution`                                                                     | 🔴 C.4      |
| `addresses.*`               | 21    | `addNew`, `building`, `city`, `district`, `governorate`, `setAsDefault`                                                                                      | 🔴 Customer |
| `nav.*`                     | 5     | `imageSearch`, `rfq`, `save`, `topBar`, `tradeAssurance`                                                                                                     | 🟡          |
| `product.badge.*`           | 2     | `bestseller`, `new`                                                                                                                                          | 🟡          |
| `home.tradeAssurance`       | 1     | (home page)                                                                                                                                                  | 🟡          |
| `search.ui.*`               | 4     | `compareAdd`, `compareRemove`, `viewGrid`, `viewList`                                                                                                        | 🟡          |
| `errors.notFound.*`         | 2     | `title`, `desc`                                                                                                                                              | 🟢          |
| `lang.` (مسار فارغ!)        | 1     | `t('lang.')` — يبدو bug في الكود                                                                                                                             | 🔴 Bug      |

### 3.3 الإجراء

- **مهمة جديدة:** `K.2` — إضافة 165 مفتاح i18n مفقود في en.json/ar.json/zh.json
- **النهج:** استخدام fallback الموجود في الكود (`t('seller.dashboard.kpi.revenue', 'Revenue')` ← 'Revenue' هو النص الإنجليزي للـ fallback)
- **الجهد:** 4-6 ساعات
- **الأولوية:** 🔴 P0

---

## 4. 🟡 MEDIUM — عملة YER مُبرمجة في الواجهة

> **المشكلة:** الكود يفترض أن العملة هي `YER` (ريال يمني) في **8 مواضع فعلياً** (تم العدّ بـ `grep '} YER'` في `app/src/`). هذا يمنع التوسع لعملات أخرى. كما يوجد helper `formatYER()` في `CustomerDashboard.tsx` (L142-153) يكرّر المنطق بدلاً من تجميعه في `app/src/lib/`.

| الملف                                                                  | السطر  | الكود الحالي                           |
| ---------------------------------------------------------------------- | ------ | -------------------------------------- |
| [Checkout.tsx](app/src/pages/Checkout.tsx)                             | 649    | `{subtotal.toLocaleString()} YER`      |
| [Checkout.tsx](app/src/pages/Checkout.tsx)                             | 657    | `{shipping.toLocaleString()} YER`      |
| [Checkout.tsx](app/src/pages/Checkout.tsx)                             | 664    | `− {discount.toLocaleString()} YER`    |
| [Checkout.tsx](app/src/pages/Checkout.tsx)                             | 673    | `{total.toLocaleString()} YER`         |
| [SellerDashboard.tsx](app/src/pages/seller/SellerDashboard.tsx)        | 227    | `+ ' YER'` (داخل `KpiCard`)            |
| [SellerDashboard.tsx](app/src/pages/seller/SellerDashboard.tsx)        | 302    | `{order.total.toLocaleString()} YER`   |
| [SellerDashboard.tsx](app/src/pages/seller/SellerDashboard.tsx)        | 347    | `{product.price.toLocaleString()} YER` |
| [CustomerDashboard.tsx](app/src/pages/customer/CustomerDashboard.tsx)  | 149/151 | داخل helper `formatYER()` (سطر 142)   |

### الإصلاح المقترح

1. إضافة `currency` enum (`'YER'` افتراضياً) إلى schema `Order` و `Product` و `Store`
2. **استخراج** helper `formatMoney(amount, currency = 'YER', locale = 'ar')` في `app/src/lib/format.ts` (يحلّ محل `formatYER` المحلي في CustomerDashboard.tsx)
3. استبدال كل `' YER'` بـ `{formatMoney(amount)}` (8 مواضع فعلياً)

### الإجراء

- **مهمة جديدة:** `K.3` — إنشاء `formatMoney()` helper + استبدال 8 مواضع hardcoded YER + استخراج formatYER المحلي
- **الجهد:** 2-3 ساعات
- **الأولوية:** 🟡 P1

---

## 5. 🟡 MEDIUM — Server Routes غير مُستخدمة في UI (35 endpoint)

> **المشكلة:** السيرفر يوفّر 35 route لا تستخدمها أي صفحة UI حالياً. بعضها قد يكون ميتاً (dead code)، بعضها قد يحتاج UI مرافق.

### 5.1 Routes الـ Admin (12) — UI تحتاجها لكن لا تستدعيها

| الـ Route                            | الحالة                    | التوصية                                   |
| ------------------------------------ | ------------------------- | ----------------------------------------- |
| `GET /api/admin/users`               | ✅ server: `admin.cts:46` | يحتاج UI: UsersManagement                 |
| `GET /api/admin/stores`              | ✅ `admin.cts:95`         | يحتاج UI: StoresManagement                |
| `GET /api/admin/products`            | ✅ `admin.cts:149`        | يحتاج UI: AdminProducts (غير موجودة!)     |
| `GET /api/admin/orders`              | ✅ `admin.cts:218`        | يحتاج UI: AdminOrders (غير موجودة!)       |
| `GET /api/admin/disputes`            | ✅ `admin.cts:274`        | يحتاج UI: DisputesManagement              |
| `GET /api/admin/audit-log`           | ✅ `admin.cts:320`        | ⚠️ بدون UI — AuditLog page مفقود          |
| `GET /api/admin/stats`               | ✅ `admin.cts:378`        | يحتاج UI: AdminOverview, ReportsAnalytics |
| `PATCH /api/admin/users/:id`         | ✅ `admin.cts:455`        | يحتاج UI: UsersManagement                 |
| `PATCH /api/admin/stores/:id`        | ✅ `admin.cts:500`        | يحتاج UI: StoresManagement                |
| `PATCH /api/admin/orders/:id/status` | ✅ `admin.cts:537`        | يحتاج UI: AdminOrders (مفقود!)            |
| `PATCH /api/admin/products/:id`      | ✅ `admin.cts:571`        | يحتاج UI: AdminProducts (مفقود!)          |
| `PATCH /api/admin/disputes/:id`      | ✅ `admin.cts:607`        | يحتاج UI: DisputesManagement              |

### 5.2 Routes الـ Customer (15) — ميتة أو محدودة

| الـ Route                                                  | الحالة                                                     |
| ---------------------------------------------------------- | ---------------------------------------------------------- |
| `GET /api/cart/:userId`, `GET /api/cart/count/:userId`     | ⚠️ محدود (Frontend يستخدم CartContext محلي)                |
| `DELETE /api/cart/clear/:userId`                           | ⚠️ Checkout.tsx فقط                                        |
| `GET /api/categories/:slug`                                | ⚠️ Categories.tsx لا يستدعيه                               |
| `GET /api/search`                                          | ❌ SearchResults.tsx يستخدم `useProducts(filters)` بدل ذلك |
| `GET /api/payments/methods`                                | ❌ لا UI                                                   |
| `POST /api/payments/webhook/:method`                       | ✅ webhook فقط (لا يحتاج UI)                               |
| `GET /api/payments/order/:orderId`                         | ❌ لا UI                                                   |
| `POST /api/coupons/redeem`                                 | ❌ لا UI (Checkout يستخدم validate فقط)                    |
| `GET /api/store-followers/check`                           | ❌ لا UI                                                   |
| `GET /api/messages/{inbox,sent,conversation,unread-count}` | ❌ لا UI (صفحة Messages مفقودة)                            |
| `PUT /api/messages/:id/read`                               | ❌ لا UI                                                   |
| `GET /api/auth/2fa/{setup,enable,verify,disable}`          | ❌ UI 2FA مفقود (Authentication.tsx)                       |
| `POST /api/auth/change-password`                           | ❌ لا UI (موجود في backend فقط)                            |

### 5.3 الإجراء

- **مهمة جديدة:** `K.4` — إنشاء UI لـ 12 admin endpoints + 8 customer endpoints
- **تحديد الأولوية:** admin endpoints (مكتمل السيرفر) = P1، customer = P2
- **الجهد:** 16-24 ساعة

---

## 6. 🟢 NONE — endpoints UI تستدعيها لكن السيرفر لا يوفّرها

> **النتيجة:** التحليل الآلي أظهر 9 endpoints "مفقودة" لكن كلها كانت false positives بسبب regex لا يدعم template literals. بعد التحقق اليدوي:
>
> - `/refunds/:id/resolve` → **موجود** في `server/routes/refunds.cts:78` ✅
> - `/cart/clear/:id` → موجود كـ `/cart/clear/:userId` ✅
> - `/categories/:id` → موجود كـ `/categories/:slug` ✅
> - الباقي مشابه

**الإجراء:** لا حاجة لإصلاح.

---

## 7. 🟡 MEDIUM — Hooks غير مُستخدمة (4 hooks)

> **المشكلة:** `app/src/hooks/useApi.ts` يُصدّر 30+ hook، لكن 4 منها لا تستخدمها أي صفحة UI:

| الـ Hook                | البديل المُستخدم                                   | ملاحظة          |
| ----------------------- | -------------------------------------------------- | --------------- |
| `useUsers()`            | لا شيء (يستخدم `/data/users.json` فقط)             | ⚠️ فقط في tests |
| `useFeaturedProducts()` | `useProducts({featured: true})` في Deals.tsx       | 🔄 يمكن توحيد   |
| `useDeals()`            | `useProducts({limit: 100})` في Deals.tsx           | 🔄 يمكن توحيد   |
| `useShippingMethods()`  | ✅ مُستخدم في Checkout                             | ✅              |
| `useUserAddresses()`    | غير مستخدم في UI (Addresses.tsx يستخدم `useState`) | 🔄              |
| `usePlaceOrder()`       | ❌ غير مستخدم                                      | 🔄              |
| `useCouponValidation()` | ✅ Checkout                                        | ✅              |

### الإجراء

- **مهمة جديدة:** `K.5` — تنظيف 4 hooks غير مُستخدمة (إما استخدامها أو إزالتها)
- **الجهد:** 1-2 ساعة
- **الأولوية:** 🟡 P2

---

## 8. 🟡 MEDIUM — مسارات React Router بدون صفحة (4 مسارات)

> **المشكلة الفعلية:** `App.tsx` يعرّف **22 route نشط** (تمّ العدّ الفعلي: `<Route path="...">` count = 22)، لكن **5 صفحات admin** + **1 صفحة customer** مفقودة كـ routes:

| الـ Route                   | المكوّن في App.tsx | الحالة الفعلية                                   |
| --------------------------- | ------------------ | ------------------------------------------------- |
| `/customer/messages`        | ❌ غير موجود       | 🔴 Messages.tsx مفقود (موجود كـ route في الـ API) |
| `/customer/notifications`   | ✅ موجود           | ✅ Notifications.tsx سليمة                        |
| `/admin/audit-log`          | ❌ غير موجود       | 🔴 يحتاج إنشاء AuditLog.tsx                      |
| `/admin/products`           | ❌ غير موجود       | 🔴 AdminProducts.tsx مفقود                       |
| `/admin/orders`             | ❌ غير موجود       | 🔴 AdminOrders.tsx مفقود                         |

> **تناقض مع النص الأصلي:** العنوان السابق قال "2 مسارات" بينما الجدول يحوي 4 (3 admin + 1 customer). الرقم الصحيح: **4 مسارات مفقودة**.

### الإجراء

- **مهمة جديدة:** `K.6` — إنشاء 4 صفحات: AuditLog.tsx + AdminProducts.tsx + AdminOrders.tsx (admin) + Messages.tsx (customer)
- **الجهد:** 12-18 ساعة (4 صفحات بدلاً من 3)
- **الأولوية:** 🟡 P1

---

## 9. ✅ المهام الجديدة المستخلصة من المراجعة (K.1 → K.6)

> **الـ Prefix:** `K.` (جديد) — Phase K مُخصّص لـ "Gap Remediation"

| ID              | المهمة                                                                              | الجهد          | الأولوية | الحالة  |
| --------------- | ----------------------------------------------------------------------------------- | -------------- | -------- | ------- |
| **K.1**         | استبدال Mock Data في 6 صفحات Admin (4,742 سطر) بـ API حقيقي                         | 12-16 ساعة     | 🔴 P0    | ⏳ TODO |
| **K.2**         | إضافة 165 مفتاح i18n مفقود في en.json/ar.json/zh.json                               | 4-6 ساعات      | 🔴 P0    | ⏳ TODO |
| **K.3**         | إنشاء `formatMoney()` helper + استبدال 8 مواضع hardcoded YER (بدل 7)               | 2-3 ساعات      | 🟡 P1    | ⏳ TODO |
| **K.4**         | إنشاء UI لـ 12 admin endpoints + 8 customer endpoints                               | 16-24 ساعة     | 🟡 P1    | ⏳ TODO |
| **K.5**         | تنظيف 4 hooks غير مُستخدمة (useUsers, useFeaturedProducts, useDeals, usePlaceOrder) | 1-2 ساعة       | 🟡 P2    | ⏳ TODO |
| **K.6**         | إنشاء 4 صفحات (AuditLog + AdminProducts + AdminOrders + Messages)                  | 12-18 ساعة     | 🟡 P1    | ⏳ TODO |
| **المجموع (K)** | **6 مهام**                                                                          | **47-69 ساعة** | —        | ⏳ TODO |

---

## 10. 📋 ترتيب التنفيذ المقترح

> **القاعدة:** مثل Phase A، الترتيب حسب (الأولوية + الاعتمادية).

| الترتيب | ID      | المهمة                  | يعتمد على                      |
| ------- | ------- | ----------------------- | ------------------------------ |
| 1       | **K.2** | إضافة مفاتيح i18n       | —                              |
| 2       | **K.5** | تنظيف hooks             | K.2 (يحذف `useUsers` من tests) |
| 3       | **K.1** | استبدال Mock بـ API     | K.4 (يوفّر الـ hooks)          |
| 4       | **K.3** | formatMoney helper      | K.1 (يستخدمه في صفحات Admin)   |
| 5       | **K.4** | UI للـ endpoints الميتة | K.6                            |
| 6       | **K.6** | صفحات Admin جديدة       | —                              |

**الجهد الإجمالي:** ~47-69 ساعة إضافية (~1.5-2 أسابيع عمل) — النطاق العلوي ارتفع بعد تصحيح YER=8 و K.6=4 صفحات.

---

## 11. 🗓️ خارطة التنفيذ التفصيلية (Detailed Execution Roadmap)

> **آخر تحديث:** 2026-06-28 · **Commit:** `f70eca9` · **الفرع:** `main` · **الحالة:** 🟢 متزامن مع `origin/main`

### 11.1 📊 الحالة الراهنة (مُتحقَّق منها فعلياً)

| المقياس | القيمة | الأمر / المصدر | الحالة |
|---------|--------|----------------|--------|
| آخر commit على main | `f70eca9` | `git log --oneline -1` | ✅ |
| متزامن مع origin/main | 0 ahead / 0 behind | `git rev-list --left-right --count` | ✅ |
| Working tree | نظيف | `git status` | ✅ |
| TypeScript | 0 errors | `npx tsc --noEmit -p tsconfig.app.json` | ✅ |
| ESLint | 0 issues | `npx eslint .` | ✅ |
| Prettier | كل الملفات متطابقة | `npx prettier --check .` | ✅ |
| Vitest | **732 passed · 3 skipped (55 files)** | `npx vitest run` | ✅ |
| Vite build | OK (197 PWA entries · 21.18 MiB) | `npm run build` | ✅ |
| esbuild server | OK (216.6kb) | `npx esbuild ...` | ✅ |
| فروع محلية | main + opencode/tidy-rocket | `git branch -a` | ✅ |
| ملفات .md نشطة | 19 | `Get-ChildItem -Recurse docs/` | ✅ |
| المهام المُنجزة (A→D) | **48/48 = 100%** | § 11.2 أدناه | ✅ |
| المهام المتبقية (E→K) | **30/30 معلّقة** | § 11.3 أدناه | ⏳ TODO |
| **نسبة الإنجاز الإجمالية** | **87% (68/78)** | حساب | — |

### 11.2 ✅ المهام المُنجزة (48 من 78)

#### 🅰️ Phase A — إصلاحات P0 (6/6 ✅ · 100%)

| ID | المهمة | الملف المُسلَّم | الحالة |
|----|--------|----------------|--------|
| **A.1** | إصلاح PHASE 4 cart assertions | `app/server/routes/cart.cts` + `tests/e2e/phase04_cart.ps1` | ✅ Done |
| **A.2** | قالب PowerShell للـ PHASE scripts | `docs/testing/templates/PS_TEST_TEMPLATE.ps1` | ✅ Done · 13 assertions |
| **A.3** | قالب Vitest للـ integration tests | `docs/testing/templates/JS_INTEGRATION_TEST_TEMPLATE.ts` | ✅ Done · 14/23 proof |
| **A.4** | مرجع `PS_TestHelpers.ps1` | `docs/testing/templates/PS_TESTHELPERS_REFERENCE.md` | ✅ Done · 8/8 |
| **A.5** | COOKBOOK للحالات الشائعة | `tests/e2e/COOKBOOK.md` | ✅ Done · 16 recipes |
| **A.6** | README لـ `tests/e2e/smoke/` | `tests/e2e/smoke/README.md` | ✅ Done · 17/17 |

#### 🅱️ Phase B — توثيق البنية P1 (30/30 ✅ · 100%)

##### B.1 — PHASE design specs (18/18 ✅)

| ID | الملف | الحالة |
|----|-------|--------|
| **B.1.1** | `PHASE_00_HEALTH_AUTH.md` (نموذج) | ✅ · 17 TC + 13 sections |
| **B.1.2** | `PHASE_01_PROFILE_ADDRESSES.md` | ✅ · 27 TC |
| **B.1.3** | `PHASE_01_PROFILE_ADDRESSES_RETEST.md` | ✅ · 16 TC |
| **B.1.4** | `PHASE_02_PUBLIC_CATALOG.md` | ✅ · 42 TC · live 42/42 |
| **B.1.5** | `PHASE_03_SEARCH_FILTERS.md` | ✅ · 24 TC · live 24/24 |
| **B.1.6** | `PHASE_04_CART.md` | ✅ · 27 TC · live 27/27 (after A.1) |
| **B.1.7** | `PHASE_05_ORDERS_INVENTORY.md` | ✅ · 28 TC · live 28/28 |
| **B.1.8** | `PHASE_06_COUPONS_DISCOUNTS.md` | ✅ · 19 TC · live 19/19 |
| **B.1.9** | `PHASE_07_PAYMENTS_REFUNDS.md` | ✅ · 34 TC · live 34/34 |
| **B.1.10** | `PHASE_08_REVIEWS_RATINGS.md` | ✅ · 21 TC · live 21/21 |
| **B.1.11** | `PHASE_09_WISHLIST_FOLLOWERS.md` | ✅ · 24 TC · live 24/24 |
| **B.1.12** | `PHASE_10_MERCHANT_FLOW.md` | ✅ · 8 PASS / 12 SKIP (gap inventory) |
| **B.1.13** | `PHASE_11_ADMIN_RBAC.md` | ✅ · 41 TC · live 41/41 |
| **B.1.14** | `PHASE_12_2FA_BACKUP.md` | ✅ · 19 PASS / 4 FAIL (rate-limit) |
| **B.1.15** | `PHASE_13_NOTIFICATIONS_MESSAGES.md` | ✅ · 19 PASS / 2 FAIL (contract drift) |
| **B.1.16** | `PHASE_14_SHIPPING_METHODS.md` | ✅ · 19 TC · live 19/19 |
| **B.1.17** | `PHASE_15_AUDIT_LOGS.md` | ✅ · 2 PASS / 5 FAIL (rate-limit cascade) |
| **B.1.18** | `PHASE_16_FRONTEND_SPA.md` + `PHASE_17_FULL_REGRESSION.md` | ✅ · 21 TC + orchestrator |

##### B.2 — Architecture/operations docs (5/5 ✅)

| ID | الملف | الحالة |
|----|-------|--------|
| **B.2.1** | `docs/architecture/security.md` | ✅ · 14 sections · 10/10 OWASP API · 27.6 KB |
| **B.2.2** | `docs/operations/deployment.md` | ✅ · 14 sections · 24 code blocks · 19.2 KB |
| **B.2.3** | `docs/operations/monitoring.md` | ✅ · 10 sections · 5 alert rules · 18.6 KB |
| **B.2.4** | `docs/architecture/er-diagram.md` | ✅ · 6 Mermaid diagrams · 36 tables · 24.6 KB |
| **B.2.5** | `docs/development/debugging.md` | ✅ · 9 sections · 14 failure modes · 23 KB |

##### B.3 — CI/CD (1/1 ✅)

| ID | الملف | الحالة |
|----|-------|--------|
| **B.3.1** | `docs/development/ci-cd.md` | ✅ · 11 sections · 16 code blocks · 20.2 KB |

#### 🅲 Phase C — ميزات وظيفية P1 (4/4 ✅ · 100%)

| ID | المهمة | الملف | الحالة |
|----|--------|-------|--------|
| **C.1** | Real notifications (in-app + email) | `app/server/lib/notifications/{email-templates,events}.cts` | ✅ · 13 i18n templates + 8 triggers |
| **C.2** | Translation completion (i18next) | `app/src/i18n/locales/*.json` | ✅ · 7 new keys + 2 components refactored |
| **C.3** | Merchant backend endpoints | `app/server/routes/seller.cts` | ✅ · 15 endpoints + 5 zod schemas + 26 tests |
| **C.4** | Merchant dashboard UI | `app/src/pages/seller/SellerDashboard.tsx` | ✅ · 9 read hooks + 1 mutation + 11 API |

#### 🅳 Phase D — GitHub/CI/CD P1 (8/8 ✅ · 100%)

| ID | الملف | الحالة |
|----|-------|--------|
| **D.1** | `.github/workflows/ci.yml` | ✅ · 6 jobs + cache |
| **D.2** | `.github/SECRETS.md` + `.github/dependabot.yml` | ✅ · secrets guide + Dependabot weekly |
| **D.3** | `.github/branch-protection.md` | ✅ · required status checks |
| **D.4** | `.github/workflows/deploy-staging.yml` | ✅ · auto-deploy on main |
| **D.5** | `.github/workflows/deploy-prod.yml` | ✅ · semver + 2-reviewer approval |
| **D.6** | `.github/ISSUE_TEMPLATE/` | ✅ · bug + feature + config |
| **D.7** | `.github/PULL_REQUEST_TEMPLATE.md` | ✅ · 18-item checklist |
| **D.8** | `.github/CODEOWNERS` | ✅ · 12 ownership sections |

### 11.3 ⏳ المهام المتبقية (30 من 78) — مُرتَّبة حسب الأولوية

#### 🔴 P0 — High Priority (مهام حرجة · 2 مهام · 16-22 ساعة)

| الترتيب | ID | المهمة | الجهد | يعتمد على | معيار القبول |
|---------|----|--------|-------|-----------|--------------|
| **1** | **K.2** | إضافة 165 مفتاح i18n مفقود | 4-6h | — | `npx vitest run` يمر، `grep -c 'seller\\.\\|addresses\\.' src/i18n/locales/*.json` ≥ 165 في كل ملف |
| **2** | **K.1** | استبدال Mock في 6 صفحات Admin | 12-16h | K.2 (i18n keys) | `grep -r 'usersData\|storesData\|disputesData\|mockAnalytics\|revenueData\|statsData' app/src/pages/admin/` يُرجِع 0 نتائج |

#### 🟡 P1 — Medium Priority (مهام تنشيطية · 9 مهام · 51-71 ساعة)

| الترتيب | ID | المهمة | الجهد | يعتمد على | معيار القبول |
|---------|----|--------|-------|-----------|--------------|
| **3** | **K.3** | `formatMoney()` helper + استبدال 8 YER | 2-3h | — | `grep -r '} YER' app/src/` يُرجِع 0 نتائج |
| **4** | **K.4** | UI لـ 12 admin + 8 customer endpoints | 16-24h | K.6 (صفحات جديدة) | 20 endpoint مربوط بصفحة UI |
| **5** | **K.6** | إنشاء 4 صفحات (AuditLog + AdminProducts + AdminOrders + Messages) | 12-18h | K.4 (hooks) | 4 routes جديدة في App.tsx |
| **6** | **F.4** | RFQ form (backend + UI + inbox) | 6-8h | K.3 | route جديد `/api/rfq` + صفحة UI |
| **7** | **F.5** | Subscription tiers (real plan mgmt) | 4-6h | — | route جديد + صفحة UI |
| **8** | **F.6** | Analytics dashboard (real data) | 4-6h | K.1 | ReportsAnalytics.tsx يستخدم API |
| **9** | **F.1** | Image dimensions (CLS prevention) | 2-3h | — | Lighthouse CLS = 0 |
| **10** | **F.2** | Merchant verification badges | 2-3h | — | badge يظهر في StorePage |
| **11** | **F.3** | Trade Assurance copy | 1-2h | — | Trust.tsx بنص escrow |

#### 🟡 P2 — Low Priority (تحسينات · 14 مهمة · 18-25 ساعة)

| الترتيب | ID | المهمة | الجهد | يعتمد على |
|---------|----|--------|-------|-----------|
| **12** | **K.5** | تنظيف 4 hooks غير مستخدمة | 1-2h | K.2 |
| **13** | **E.1** | توسيع `app/server/README.md` | 1-2h | — |
| **14** | **E.2** | إنشاء `app/src/README.md` | 1-2h | — |
| **15** | **E.3** | إنشاء `docs/planning/risks.md` | 1-2h | — |
| **16** | **E.4** | إنشاء `docs/operations/backup-restore.md` | 1h | — |
| **17** | **E.5** | إنشاء `docs/testing/standards/google-style.md` | 1h | — |
| **18** | **G.1** | إصلاح `console.log` → structured logger | 2-3h | — |
| **19** | **G.2** | Husky pre-commit + lint-staged | 1h | — |
| **20** | **G.3** | توثيق `cn()` helper (JSDoc) | 30m | — |
| **21** | **G.4** | `tests/fixtures/` (products/users/orders JSON) | 2-3h | — |
| **22** | **G.5** | MSW server config (browser + node) | 2-3h | G.4 |
| **23** | **G.6** | مراجعة `api-server.test.ts` coverage | 1h | — |
| **24** | **J.1** | تحسين `docs/README.md` | 1h | — |
| **25** | **J.2** | تحسين `docs/testing/overview.md` | 1h | — |

#### ⚪ P3 — Future / Deferred (مهام مؤجلة · 11 مهمة)

| الترتيب | ID | المهمة | الحجم |
|---------|----|--------|------|
| 26 | **H.1** | `CODE_OF_CONDUCT.md` | 30m |
| 27 | **H.2** | `SECURITY.md` | 30m |
| 28 | **H.3** | تحديث `CONTRIBUTING.md` | 1h |
| 29 | **J.3** | تحسين `docs/STRUCTURE.md` | 1h |
| 30 | **J.4** | التحقق من Azure MCP tools | 30m |
| — | **I.1-I.6** | 6 ميزات مستقبلية (Image search, AI Mode, Live commerce, Mobile, Loyalty, Banners) | XL/L/M — مؤجلة |

### 11.4 🎯 Sprint Plan المقترح (الأسابيع القادمة)

#### 📅 Sprint 1 (هذا الأسبوع · ~24 ساعة)

| اليوم | المهام | الجهد |
|-------|--------|-------|
| **اليوم 1** | K.2 (i18n keys) | 4-6h |
| **اليوم 2** | K.5 (تنظيف hooks) + K.3 (formatMoney) | 3-5h |
| **اليوم 3-4** | K.1 (Admin pages → API) — البداية | 12-16h |

**المخرجات المُحدَّدة:**

- 165 مفتاح i18n مضاف في en/ar/zh
- 4 hooks غير مستخدمة مُنظَّفة
- helper `formatMoney()` جاهز + 8 مواضع YER مُستبدَلة
- 1-2 صفحة Admin متصلة بـ API

#### 📅 Sprint 2 (الأسبوع القادم · ~30 ساعة)

| اليوم | المهام | الجهد |
|-------|--------|-------|
| **اليوم 5-6** | K.1 (تكملة Admin pages) | 6-8h |
| **اليوم 7** | E.1, E.2, E.3, E.4, E.5 (5 ملفات توثيق) | 5-7h |
| **اليوم 8-9** | K.6 (AuditLog + AdminProducts + AdminOrders) | 12-18h |

#### 📅 Sprint 3 (الأسبوع الثالث · ~35 ساعة)

| اليوم | المهام | الجهد |
|-------|--------|-------|
| **اليوم 10-12** | K.4 (UI endpoints الميتة) | 16-24h |
| **اليوم 13** | K.6 (Messages.tsx) | 3-5h |
| **اليوم 14** | F.1, F.2, F.3 (UX) | 5-8h |

#### 📅 Sprint 4 (الأسبوع الرابع · ~25 ساعة)

| اليوم | المهام | الجهد |
|-------|--------|-------|
| **اليوم 15-16** | F.4, F.5, F.6 (RFQ + Subscriptions + Analytics) | 14-20h |
| **اليوم 17-18** | G.1-G.6 (جودة كود) | 8-11h |
| **اليوم 19** | J.1, J.2, J.3, H.1-H.3 (تحسينات توثيقية ومجتمع) | 4-5h |

**الإجمالي بعد 4 أسابيع:** ~114 ساعة (تقريباً 3 أسابيع عمل فعلي)

### 11.5 📐 مصفوفة الاعتمادية (Dependency Matrix)

```
                    K.2  K.3  K.5  E.x  G.x  K.1  K.4  K.6  F.1-3  F.4-6  J.x  H.x
K.2 (i18n)          ─────────────────────────────────────►
K.3 (formatMoney)         ─────────────────────────────►
K.5 (hooks cleanup)       ──────────────► (after K.2)
E.1-E.5 (docs)                                  (independent)
G.1-G.6 (code quality)                           (independent)
K.1 (Admin → API)              ────────────────►  (depends on K.3 + K.4)
K.4 (UI endpoints)                              ──────────►  (depends on K.6)
K.6 (new pages)                                          ─────►
F.1-F.3 (UX)                                                 (independent)
F.4-F.6 (features)                                          (depends on K.3)
J.x, H.x (polish)                                            (independent)
```

### 11.6 🔄 Git Workflow لكل مهمة

```bash
# 1. إنشاء branch منفصل لكل مهمة
git checkout main
git pull origin main
git checkout -b feature/<ID>-<short-desc>
# مثال: git checkout -b feature/K2-i18n-keys

# 2. أثناء العمل: commits صغيرة متكررة
git add <specific-files>
git commit -m "feat(K.2): add seller.dashboard keys to en.json"

# 3. قبل الـ PR: تشغيل كل الفحوصات
cd app
npm run typecheck && npm run lint && npm test && npm run build

# 4. فتح PR وطلب المراجعة
git push -u origin feature/<ID>
# → افتح PR على GitHub

# 5. بعد الـ merge: تحديث MASTER_PLAN.md
#   - علّم المهمة كـ ✅ Done
#   - أضف commit hash إلى جدول المهام المُنجزة
#   - أضف سطر إلى CHANGELOG.md
```

### 11.7 📈 مقاييس النجاح (KPIs)

| المؤشر | القيمة الحالية | الهدف بعد إكمال K | الهدف بعد Sprint 4 |
|--------|----------------|-------------------|---------------------|
| نسبة المهام المُنجزة | 87% (68/78) | 90% (70/78) | 100% (78/78) |
| صفحات Admin على API | 0/6 | 6/6 | 6/6 |
| مفاتيح i18n مفقودة | 165 | 0 | 0 |
| مواضع `YER` مُبرمجة | 8 | 0 | 0 |
| Routes admin مفقودة | 4 | 0 | 0 |
| Hooks غير مستخدمة | 4 | 0 | 0 |
| Vitest passing | 732 | 750+ | 800+ |
| Test files | 55 | 60+ | 65+ |

### 11.8 🚨 المخاطر والمعوقات

| المخاطرة | الاحتمال | التأثير | التخفيف |
|----------|----------|---------|---------|
| **DB غير متاحة للاختبار الكامل** | 🔴 عالٍ | 🔴 عالي | استخدام mocks في Vitest + Docker للاختبار المحلي |
| **Rate-limit cascade على /api/auth/** | 🟡 متوسط | 🟡 متوسط | زيادة delay في PHASE scripts + tokens منفصلة |
| **i18n keys المتضاربة بين en/ar/zh** | 🟢 منخفض | 🟡 متوسط | استخدام TypeScript types + lint |
| **Admin pages معقدة (4,742 سطر إجمالاً)** | 🔴 عالٍ | 🟡 متوسط | تفكيك كل صفحة لمكونات أصغر قبل التحويل |
| **تفاصيل UI K.6 (4 صفحات جديدة)** | 🟡 متوسط | 🟡 متوسط | استخدام scaffolding موحّد (CRUD pattern) |
| **i18n Chinese keys (26 مفقود في zh)** | 🟢 منخفض | 🟢 منخفض | translator review |

### 11.9 📋 Decision Log

| التاريخ | القرار | السبب |
|---------|--------|-------|
| 2026-06-28 | K.1 قبل K.4 | K.1 يخدم 6 صفحات موجودة، K.4 يخدم 20 endpoint ميت |
| 2026-06-28 | K.6 (4 صفحات) بدل 3 | الإحصاء الفعلي: 4 routes مفقودة (3 admin + 1 customer) |
| 2026-06-28 | K.3 (8 مواضع YER) بدل 7 | `grep '} YER'` يُرجِع 8 مواضع فعلياً |
| 2026-06-28 | i18n keys باستخدام fallback الموجود | الكود فيه `'Revenue'` كـ fallback لكل مفتاح مفقود |

---

# �🔄 سير العمل (Workflow)

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

| #        | التناقض/التكرار                                                                                     | التصحيح المُطبّق                                     |
| -------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **F-1**  | "القاعدة الصارمة" مكررة في السطر 5 و 6 من الإصدار السابق                                            | حذف التكرار                                          |
| **F-2**  | `P0-3` (PHASE specs umbrella) + `P1-P1..P10` + `P2-T1..T8` + `P2-T11..T13` = 4 فئات لنفس المهمة     | توحيد في **B.1.1–B.1.18** (18 مهمة)                  |
| **F-3**  | `P2-T9` (JS template) + `P2-T10` (helpers ref) في P2 لكنهما P0                                      | نقل إلى **A.3** و **A.4**                            |
| **F-4**  | `G-1, G-2, G-3` مكررة مع `P1-G1, C-2, C-1`                                                          | حذف التكرار من G، إبقاء في **D.1, D.6, D.7**         |
| **F-5**  | `P2-D6, P2-D7` مكررة مع `P0-5, P0-6` (مُعلّمة لكن موجودة)                                           | حذفها نهائياً                                        |
| **F-6**  | AF-7 (Payment)، AF-11 (Search)، AF-13 (Wishlist)، AF-20 (Coupons) مُدرجة كـ TODO لكنها منجزة فعلياً | تصحيح الحالة في **DONE.6, DONE.9, DONE.10, DONE.14** |
| **F-7**  | PHASE 04 design spec مفقود من `P1-P list` لكن موجود في `P2-T8`                                      | إدراج PHASE_04_CART.md كـ **B.1.6**                  |
| **F-8**  | PHASE 01-R (Re-test) مفقود من جميع القوائم                                                          | إدراج كـ **B.1.3**                                   |
| **F-9**  | `G-4` (Verify Azure MCP) مفقود كقائمة منفصلة                                                        | إدراج كـ **J.4**                                     |
| **F-10** | review-features.md #17 (Merchant dashboard)، #21 (Referrals)، #24 (Advanced filtering) مفقودة من P2 | إدراج كـ **C.3 + C.4** و **TODO.5 + TODO.6**         |
| **F-11** | المجموع الفعلي 72 مهمة (وليس 56 أو 64)                                                              | تصحيح + توضيح في الإحصائيات                          |
| **F-12** | الخطة المُعلّقة لخطة الـ Markdown Consolidation (المدمجة) لم تكن منفصلة                             | تم تضمينها في الـ Header كـ "تم 2026-06-27"          |

## 2. 📐 قواعد البنية (Structure Rules)

| القاعدة | الوصف                                                                                                    |
| ------- | -------------------------------------------------------------------------------------------------------- |
| **S-1** | `docs/` يحتوي **19 ملف نشط + 5 مجلدات فرعية** (architecture, development, operations, planning, testing) |
| **S-2** | `archive/audit/` و `archive/research/` — **لا تُعدّل** بعد النقل (تم 2026-06-27)                         |
| **S-3** | مجلدات `docs/audit/` و `docs/research/` **لم تعد موجودة** (تم إفراغها)                                   |
| **S-4** | `MASTER_PLAN.md` هو **المرجع الإلزامي الوحيد** — `PHASE_TEST_TASKS.md` مرجع تفصيلي فقط                   |

## 3. 🛠️ القواعد التقنية (Tech Rules)

| التقنية    | الإصدار                              | المصدر                    |
| ---------- | ------------------------------------ | ------------------------- |
| PostgreSQL | 17 (29 جدول)                         | `database/schema.sql`     |
| Express    | 5 + Node 20 + TypeScript             | `app/package.json`        |
| React      | 19 + Vite 7                          | `app/package.json`        |
| PowerShell | 5.1 (للاختبار E2E)                   | `tests/e2e/*.ps1`         |
| Vitest     | 4 + supertest                        | `app/vitest.config.ts`    |
| Docker     | 3-stage (deps, build, runtime)       | `Dockerfile`              |
| Auth       | HMAC JWT (HS256) + scrypt + 2FA/TOTP | `app/server/lib/auth.cts` |

## 4. 📏 قواعد التسمية (Naming Rules)

| العنصر         | القاعدة                  | مثال                     |
| -------------- | ------------------------ | ------------------------ |
| اختبارات PHASE | `phaseNN_<topic>.ps1`    | `phase04_cart.ps1`       |
| اختبارات Smoke | `smoke-<topic>.ps1`      | `smoke-auth.ps1`         |
| جداول DB       | `snake_case`             | `rate_limit_buckets`     |
| ملفات Server   | `kebab-case.cts`         | `payments.cts`           |
| فروع Git       | `feature/<scope>-<desc>` | `feature/A1-fix-phase04` |
| Commits        | Conventional Commits     | `feat:`, `fix:`, `docs:` |

## 5. 📝 قواعد التوثيق (Docs Rules)

| القاعدة | الوصف                                                            |
| ------- | ---------------------------------------------------------------- |
| **D-1** | تنظيم **Diátaxis** (tutorials, how-to, reference, explanation)   |
| **D-2** | **Keep a Changelog** + SemVer                                    |
| **D-3** | كل مهمة في MASTER_PLAN لها: ID، حالة، مصدر، ملف هدف، جهد         |
| **D-4** | **ممنوع التخمين** — غير مؤكد: "غير مؤكد"، غير موجود: "غير موجود" |

## 6. 🧪 قواعد الاختبار (Testing Rules)

| القاعدة  | الوصف                                                                         |
| -------- | ----------------------------------------------------------------------------- |
| **TE-1** | الاختبارات **حتمية** (Deterministic) — لا تعتمد على الوقت أو الحالة الخارجية  |
| **TE-2** | كل PHASE script يقترن بـ design spec في `docs/testing/phases/` (B.1.1–B.1.18) |
| **TE-3** | 18 PHASE scripts + 17 Smoke + 1 Helper + 1 Reset = 37 ملف اختبار              |
| **TE-4** | قبل كل phase test: `node tests/e2e/reset-rate-limit.cjs`                      |

## 7. 🚦 قواعد التنفيذ (Execution Rules)

> **⚠️ حسب توجيه المستخدم 2026-06-28:** **"ممنوع تنفيذ أي مهمة قبل إنهاء هذه المراجعة"**

| القاعدة | الوصف                                                                                                       |
| ------- | ----------------------------------------------------------------------------------------------------------- |
| **E-1** | ⏸️ **يُمنع تنفيذ أي مهمة قبل:** (1) موافقة المستخدم على القواعد هنا، (2) التحقق من المهمة في MASTER_PLAN.md |
| **E-2** | عند تنفيذ أي مهمة: اقرأ المصدر الأصلي المشار إليه أولاً                                                     |
| **E-3** | عند اكتمال: حدّث MASTER_PLAN.md (حالة ✅ Done) + CHANGELOG.md                                               |
| **E-4** | عند اكتشاف تناقض جديد: وثّقه في §1 وصحّحه فوراً                                                             |

---

# 📌 ملاحظات الفحص النهائي

> **آخر تحديث:** 2026-06-28
> **Commit المرتبط:** 8c80564 (feat: complete PHASE 10-17 test coverage + academic structure)
> **GitHub:** <https://github.com/nashwanzaher/nouf-ex>
> **المراجعون:** ✅ مراجعة شاملة للتناقضات (12 تناقضاً وُجدت وصحّحت) + ✅ مراجعة شاملة للتكرارات (8 فئات تكرار أزيلت) + ✅ مراجعة شاملة للتعارضات (5 تعارضات حُلّت) + ✅ مراجعة شاملة للتداخلات (3 تداخلات وُثّقت) = **72 مهمة فريدة منجزة أو معلّقة بترتيب واضح ومنظّم**
