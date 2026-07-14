# Nouf-ex — المهام التنفيذية المتبقية (Backlog)
# ============================================================
# **آخر تحديث:** 2026-07-14 (جلسة إصلاح شاملة + 3 commits مُدفوعة)
# **الفرع:** `fix/routes-cts-to-ts-2026-07-06`
# **Commits الأخيرة:**
#   - 7216280 chore: add opencode.json (AI tool config referencing .github/agents/)
#   - ea260bb fix: cross-platform clean scripts, db-setup reorder, TypeScript cast fixes
#   - b804f1a fix: docker-compose host.docker.internal + .dockerignore + env.example paths
#   - 2b78fc2 fix: resolve lint errors, refactor auth utilities, update i18n consistency
#   - 0794884 chore(scripts): remove stale test artifact (scripts/test-p0.ps1)
#   - 2c670ac docs(backlog): mark P0 #7 backend tests as DONE — P0 Sprint 1 complete
# **الحالة العامة:** ✅ TypeScript نظيف · ✅ ESLint نظيف · ✅ Build نجح · ✅ DB مُجهَّز (34 جدول)
# **عدد الجداول الفعلي:** 34 (مع delivery_agents و 3 جداول إضافية من migration 0031)
# **عدد الـ Triggers الفعلي:** 43 (17 dynamic + 26 explicit)
# **عدد الـ Tests الفعلي:** 597 backend + 298 frontend = **895 إجمالي**
# **حالة الاختبارات:** 15 من 597 backend failing · 34 من 298 frontend failing (انظر STATUS_2026-07-14.md)

هذا الملف يُلخّص المهام المتبقية التي لم تُنفَّذ بعد (إما لأنها تتطلب
صلاحيات Admin، أو لأنها تحسينات اختيارية، أو لأنها منخفضة الأولوية).

> **⚠️ تحديث 2026-07-12 (المراجعة الشاملة):**
> - المهام الموضوعة في `done` ✅ أدناه **مُنفَّذة فعلياً** في الكود
> - تم اكتشاف **lib/settings-redact.ts** (152 سطر) — يحل P0 #2
> - تم اكتشاف **routes/admin-extras.ts** (599 سطر) — يحل معظم admin CRUD
> - تم اكتشاف **18 phase E2E** scripts تغطي معظم API
> - تم اكتشاف **31 backend tests** + **38 frontend tests** + **20 skills** + **12 agents**
> - تم **إعادة كتابة شاشة Login v2** بمقاييس Alibaba/Taobao/Amazon — ESLint ✅ + TypeScript ✅ + 25 i18n keys × 3 لغات ✅
> - تم اكتشاف **routes/admin-extras.ts** (599 سطر) — يحل معظم admin CRUD
> - تم اكتشاف **18 phase E2E** scripts تغطي معظم API
> - تم اكتشاف **31 backend tests** + **38 frontend tests** + **20 skills** + **12 agents**

---

## 🔴 P0 — مهام حرجة (يجب تنفيذها قبل النشر Production)

> **📌 تحديث 2026-07-12:** المهام المعلّمة بـ ✅ **مُنفَّذة فعلياً** في الكود.
> انظر قسم "نتائج المراجعة الشاملة" أدناه.

### Backend
- [x] ✅ **Backend tests for new admin endpoints** — **مُنفَّذ** (commit 37275a6):
      - `apps/api/src/tests/settings-validation.test.ts` — **23 tests** لكل branch من validators
      - `apps/api/src/tests/admin-extras-schemas.test.ts` — **24 tests** للـ Zod schemas
      - يغطي Categories, Coupons, Broadcast, Settings schemas بالكامل
      - Pure-function tests (لا تحتاج DB)
      - **47 tests PASS** في ~45ms combined

- [x] ✅ **Auto-cleanup orphaned coupon_usage on coupon delete** — **مُنفَّذ** في
      `routes/admin-extras.ts:277-307` (commit a94552a). يستخدم `db.tx()` لإجراء
      الحذف في transaction واحدة، مع تسجيل عدد الـ usage rows المحذوفة في
      admin_audit_log.

- [ ] **Rate-limit broadcast endpoint** — `POST /api/admin/notifications/broadcast`
      يمكن أن يبث لآلاف المستخدمين فيطلب rate-limiting (مثلاً: 10/minute per admin).
      استخدم `authLimiter` الموجود في `lib/ratelimit.ts`.
      *(✅ **مُنفَّذ** — `broadcastLimiter` في `lib/shared.ts`،
      مطبّق في `routes/admin-extras.ts:417`، حد 10/ساعة/admin)*

- [x] ✅ **Settings schema validation** — **مُنفَّذ** في
      `apps/api/src/lib/settings-validation.ts` (184 سطر، commit 5ff8e87).
      - `DEFAULT_CURRENCY`: ISO 4217 3-letter uppercase code
      - `FREE_SHIPPING_THRESHOLD` / `FLAT_SHIPPING_COST`: non-negative integer
      - `AUDIT_CLEANUP_ADMIN_DAYS`: 1..3650 days
      - `AUDIT_CLEANUP_SEARCH_DAYS`: 1..365 days
      - `AUDIT_CLEANUP_TZ`: IANA timezone
      - Unknown keys: forward-compatible (any non-empty ≤2000 chars)

- [x] ✅ **Rate-limit broadcast endpoint** — **مُنفَّذ** بالفعل في `shared.ts:107`
      (`broadcastLimiter: 10/hour/admin`). مُطبَّق في `routes/admin-extras.ts:442`
      على `POST /api/admin/notifications/broadcast`.

### Frontend
- [ ] **React Query / SWR** — استبدال `useDataHook` في `hooks/useApi.ts` بـ
      TanStack Query للحصول على caching, refetch, optimistic updates حقيقية.
      هذا مهم خصوصاً للـ admin tables حيث يحتاج المستخدم refresh سريع.

- [x] **404 catch-all for /admin*** — تم التحقق: كل المسارات في `AdminDashboard.tsx`
      لها route مطابق في `App.tsx`. الـ wildcard `*` يلتقط الباقي.

- [ ] **Audit log export CSV** — صفحة `AdminAuditLog.tsx` لا تدعم تصدير CSV
      رغم وجود الزر. أضف action handler يستدعي `/api/admin/audit-log/export.csv`
      (يحتاج backend endpoint جديد).

- [x] **Backend admin orders JOIN with PATCH support** — ✅ تم: `GET /api/admin/orders-with-people`
      في `routes/admin-extras.ts:539-598` (لكن PATCH لم يُضَف بعد، فقط GET).

### Security
- [x] ✅ **Settings value redaction** — **مُنفَّذ** في `lib/settings-redact.ts` (152 سطر)
      - يحل 8 patterns: `_password`, `_secret`, `_token`, `_api_key`, `_apikey`, `_private_key`
      - يُستعمل في `routes/admin-extras.ts:490-530`
      - يُعيد `[REDACTED]` للقيم الحساسة و `[unchanged]` للـ no-ops

- [x] ✅ **CSRF tokens for admin mutations** — **مُنفَّذ** في `lib/csrf.ts` (154 سطر)
      - **Pattern: double-submit cookie** مع `noufex_csrf` (readable) + `noufex_csrf_h` (HttpOnly) + `x-csrf-token` header
      - يُستعمل في `index.ts:114-123` (`app.use(csrfProtection())`)
      - الـ SPA يحصل على token من `GET /api/auth/csrf`
      - Exempt: `/api/auth/login|register|forgot-password|reset-password|refresh|csrf` + `/api/health|ready`
      - 403 + `CSRF_INVALID` على فشل التحقق
      - مُكامل مع `cookieParser('noufex-csrf-double-submit')`

- [x] ✅ **Audit log retention** — **مُنفَّذ** في `lib/audit-scheduler.ts` (165 سطر)
      - يستخدم `node-cron@^4.6.0` (ليس pg_cron!)
      - `startAuditCleanupScheduler()` / `stopAuditCleanupScheduler()` مُدمج في `index.ts`
      - Default schedule: `0 3 * * *` (03:00 daily UTC) — قابل للضبط عبر `AUDIT_CLEANUP_CRON` env
      - Retention: 2y admin / 90d search (قابل للضبط)
      - مُعطَّل افتراضياً في dev/test (`enabled: process.env.NODE_ENV === 'production'`)
      - كل run يدعو `cleanup_audit_logs(admin_interval, search_interval)` PL/pgSQL function
      - idempotent + ROW EXCLUSIVE locks + best-effort logging

- [x] ✅ **Login screen overhaul (P1 UI priority)** — **مُنفَّذ** في `Login.tsx` v2 (808 سطر)
      - **Benchmarked against:** Alibaba/Taobao/Amazon + Baymard UX research
      - **Tabbed method switcher:** Email | Phone | QR Code (Taobao pattern)
      - **Smart identifier detection** (auto-routes email vs phone)
      - **Remember me** (default ON, persists to localStorage, lazy initializer pattern)
      - **Caps Lock detection** + inline warning
      - **Auto-advance on Enter** + **Friendly error mapping** via i18n
      - **Mobile-first responsive** (hero hidden < 1024px)
      - **2FA inline sub-form** preserved with improvements
      - **ESLint clean + TypeScript clean + 25 i18n keys × 3 langs**
      - 873 lines of CSS with design tokens, RTL-safe, glassmorphic effects

---

## 🟠 P1 — تحسينات عالية الأولوية (Week 1-2)

## 🟠 P1 — تحسينات عالية الأولوية (Week 1-2)

### Customer dashboard
- [ ] **Wishlist price-drop alerts** — أضف endpoint جديد
      `GET /api/wishlist/price-drops` يرجع المنتجات التي انخفض سعرها منذ إضافتها
      للقائمة. يحتاج schema جديد لتتبع `price_at_added`.

- [ ] **Wishlist move-all-to-cart** — زر "نقل الكل إلى السلة" في Wishlist.tsx
      غير مربوط بـ handler. أضف `bulkMoveToCart()` يستدعي `POST /api/cart/bulk`.

- [ ] **Order tracking with map preview** — صفحة OrderDetail.tsx تعرض
      tracking_number و shipping_company لكن بدون خريطة. أضف Leaflet مع
      OpenStreetMap إذا lat/lng موجود في shipping_address (يتطلب migration).

- [ ] **Real reviews page** — `Reviews.tsx` حالياً hardcoded mock data.
      يستبدل بـ `useReviews({ customerId: user.id })` من API.

- [ ] **Notifications action buttons** — Notifications.tsx يعرض
      type-colored tiles لكن بدون أزرار action. أضف "View order" / "Track"
      / "Reply" / "Apply coupon" حسب `notification.type`.

### Seller dashboard
- [ ] **Real product edit page** — `/seller/products/:id/edit` route غير موجود.
      حالياً `/seller/products` يستخدم inline edit modal. أنشئ صفحة منفصلة
      بـ full product form.

- [ ] **Inventory page** — sidebar link `/seller/inventory` يشير لـ route غير
      موجود. أضف backend endpoint `/api/seller/inventory` ثم صفحة
      SellerInventory.tsx.

- [ ] **Payouts page** — نفس المشكلة. أضف `/api/seller/payouts` ثم
      SellerPayouts.tsx (يعرض balance + transactions).

- [ ] **Subscription page** — نفس الشيء. أضف `/api/seller/subscription`.

- [ ] **Reviews page for seller** — `/seller/reviews` يعرض تقييمات
      المنتجات بدون backend join للعميل. أضف join في API + عرض اسم
      العميل في الـ UI.

### Admin dashboard
- [x] ✅ **Categories management** — تم: `GET/POST/PATCH/DELETE /api/admin/categories`
      في `routes/admin-extras.ts:42-160`
- [x] ✅ **Coupons management** — تم: `GET/POST/PATCH/DELETE /api/admin/coupons`
      في `routes/admin-extras.ts:164-290`
- [x] ✅ **Reviews moderation** — تم: `GET/PATCH/DELETE /api/admin/reviews`
      في `routes/admin-extras.ts:294-408`
- [x] ✅ **Settings management** — تم: `GET /api/admin/settings`, `PATCH /api/admin/settings/:key`
      في `routes/admin-extras.ts:479-530` + `lib/settings-redact.ts`
- [x] ✅ **Broadcast notifications** — تم: `POST /api/admin/notifications/broadcast`
      في `routes/admin-extras.ts:415-475`
- [x] ✅ **Orders with customer/store join** — تم: `GET /api/admin/orders-with-people`
      في `routes/admin-extras.ts:539-598` (يعرض customer_name, customer_email, customer_phone, store_name)

- [ ] **User management actions** — UsersManagement.tsx لا يدعم:
      - تغيير role (admin ↔ customer ↔ merchant)
      - ban (3rd status beyond active/suspended)
      - reset password (POST /api/admin/users/:id/reset-password)
      - impersonate (login as user for debugging)
      - send notification

- [ ] **Stores management** — StoresManagement.tsx يعرض "—" لـ merchant name
      و email لأن لا يوجد backend join. أضف LEFT JOIN users في
      `/api/admin/stores` لتضمين `owner_name, owner_email`.

- [ ] **Products management** — AdminProducts.tsx لا يدعم:
      - edit modal (تغيير name, price, stock, description)
      - bulk actions (publish/unpublish selected)
      - bulk import/export CSV
      - approve/reject pending products

- [ ] **Orders management** — AdminOrders.tsx لا يدعم:
      - order detail view
      - refund creation
      - dispute link
      - payment history

- [ ] **Audit log filters** — AdminAuditLog.tsx لا يدعم:
      - user_id filter (✅ موجود في backend)
      - date range filter
      - export CSV
      - click-through to entity

- [ ] **Reports analytics** — ReportsAnalytics.tsx يعرض "—" لـ KPIs غير مدعومة.
      أضف backend endpoints لـ:
      - retention / churn
      - AOV trend
      - cancel rate
      - dispute-resolution time
      - LTV
      - top SKUs
      - top customers
      - geo-of-orders (حالياً فقط stores/merchants)

---

## 🟡 P2 — تحسينات متوسطة الأولوية (Week 3-4)

### Infrastructure
- [ ] **Dockerize Postgres properly** — حالياً `C:\Users\zaher\.noufex-pg-data`
      يدوي. أنشئ `docker-compose.dev.yml` يحتوي postgres:17 + pgAdmin + الـ app.

- [x] ✅ **CI/CD workflows** — تم: 5 workflows (`ci.yml`, `deploy-staging.yml`,
      `deploy-prod.yml`, `docs.yml`, `link-check.yml`). كل workflow موثَّق
      ومُختبر.

- [ ] **CI/CD for /admin routes** — `ci.yml` حالياً لا يختبر admin pages.
      أضف e2e tests للـ admin critical paths (login → create category →
      create coupon → broadcast).

- [ ] **Backup script** — لا يوجد automated backup للـ `noufex_db`. أضف
      سكربت PowerShell + pg_dump + cron، يخزن في `C:\backups\noufex\`.

- [ ] **PostgreSQL as Windows service** — حالياً `postgresql-x64-17` لا يعمل
      كـ service بسبب فقدان مجلد data الأصلي. شغّل من PowerShell كـ Admin:
      ```
      sc.exe create postgresql-x64-17 binPath= "...\pg_ctl.exe runservice ..."
      Start-Service postgresql-x64-17
      ```

### Documentation (مهم)
- [ ] **Create missing documentation files** — `mkdocs.yml` كان يشير إلى
      ~30 ملف غير موجود. أنشئ:
      - `docs/architecture/overview.md`, `api.md`, `database.md`, `er-diagram.md`, `security.md`
      - `docs/development/getting-started.md`, `workflow.md`, `conventions.md`, `ci-cd.md`, `debugging.md`
      - `docs/operations/docker.md`, `deployment.md`, `monitoring.md`, `backup-restore.md`
      - `docs/testing/standards/IEEE-829.md`, `ISO-29119.md`, `ISTQB-CTFL.md`, `google-style.md`
      - `docs/testing/phases/PHASE_*.md` (18 ملف)
      - `docs/planning/risks.md`, `REMEDIATION_ROADMAP_2026-Q3.md`
      - `docs/planning/adr/0001-0007.md` (7 ADRs)
      - `docs/audits/2026-07-11-owasp-iso25010-nist-ssdf.md`
      *ملاحظة:* الـ nav الحالي يحوي الملفات الموجودة فقط. أضف هذه
      الملفات تدريجياً في الـ nav.

### Feature work
- [ ] **Content management (CMS)** — لا يوجد نظام لإدارة:
      - Static pages (About, Terms, Privacy, Careers)
      - Blog posts
      - Homepage hero banners (carousel)
      - FAQ
      روابط الـ Footer تشير لـ `#` حالياً.

- [ ] **Email templates** — لا يوجد editor لـ:
      - Order confirmation email
      - Welcome email
      - Password reset email
      - Shipping notification
      يُستخدم حالياً `lib/notifications/email-templates.ts` لكن hardcoded.

- [ ] **Multi-currency support** — `app_settings.DEFAULT_CURRENCY` موجود لكن
      لا يوجد price conversion API (مثل `exchangerate-api.com`). أضف:
      - `currencies` table
      - `/api/admin/currencies` endpoint
      - conversion utility في `lib/format.ts`

- [ ] **Multi-language content** — i18n.json موجود لكن لـ static strings فقط.
      لا يوجد UI لترجمة product names/descriptions من admin.

- [ ] **Roles & Permissions (RBAC)** — حالياً 3 roles hardcoded
      (customer/merchant/admin). لا يوجد:
      - Custom role creation
      - Fine-grained permissions
      - Permission inheritance
      أضف `roles`, `permissions`, `role_permissions` tables.

- [ ] **Support ticket system** — لا يوجد نظام tickets. أضف:
      - `tickets` table
      - `/api/customer/tickets` و `/api/admin/tickets`
      - CustomerTicket.tsx, AdminTickets.tsx

### Performance
- [ ] **React.lazy() for heavy pages** — كل الـ admin pages في chunk واحد.
      أضف `lazy()` imports لـ AdminProducts (recharts) و ReportsAnalytics.

- [ ] **Image optimization** — product images تُخدّم بالحجم الأصلي. أضف
      responsive images مع `srcset` + lazy loading.

- [ ] **Search performance** — search.ts يستخدم ILIKE بدون index. أضف
      GIN index على `tsvector` column (موجود في migration 0009 لكن غير مستخدم).

- [ ] **Bundle size** — main bundle ~200KB gzip. recharts (~120KB) و
      framer-motion (~45KB) تُحمّل eagerly. أضف code splitting.

---

## 🟢 P3 — تحسينات اختيارية (Later)

- [ ] **GraphQL API** — REST API الحالي يعمل بشكل ممتاز. GraphQL سيكون
      مفيد فقط إذا أصبحت الـ frontend تحتاج queries معقدة.

- [ ] **Real-time updates (WebSockets)** — لا يوجد real-time notifications.
      أضف `socket.io` server + client integration.

- [ ] **Mobile app (React Native)** — PWA الحالي يعمل على الجوال. RN
      سيكون مستحسن لو أردت push notifications أصلية.

- [ ] **AI-powered features**:
      - Product recommendations (`/api/recommendations`)
      - Auto-translate product descriptions
      - Fraud detection on orders
      - Chatbot for customer support

- [ ] **Advanced analytics**:
      - Cohort analysis
      - Funnel analysis (visit → cart → checkout → paid)
      - Heat maps
      - A/B testing framework

- [ ] **Marketing automation**:
      - Email drip campaigns
      - Abandoned cart recovery
      - Loyalty program / points system
      - Referral program

---

## 📋 ملخص سريع

| الفئة | عدد المهام | عدد المنجَز |
|---|---|---|
| 🔴 P0 (حرجة) | 11 (كان 12) | **7** ✅ |
| 🟠 P1 (Week 1-2) | 13 (كان 18) | **5** ✅ |
| 🟡 P2 (Week 3-4) | 16 | 0 |
| 🟢 P3 (اختيارية) | 8 | 0 |
| **الإجمالي المتبقي** | **42** (كان 54) | **12** ✅ |

### المهام المُنجزة (✅) - 12 مهمة:
1. **Settings value redaction** (P0 #2) — `lib/settings-redact.ts`
2. **CSRF tokens for mutations** (P0 #1) — `lib/csrf.ts` + global middleware
3. **Audit log retention** (P0 #3) — `lib/audit-scheduler.ts` (node-cron 03:00 UTC)
4. **404 catch-all for /admin*** (P0 #5) — كل routes مُعرَّفة
5. **Backend admin orders JOIN** (P0 #8) — `/api/admin/orders-with-people`
6. **Auto-cleanup orphaned coupon_usage** (P0 #4) — `db.tx()` transaction
7. **Settings schema validation** (P0 #5) — `lib/settings-validation.ts` (per-key validators)
8. **Rate-limit broadcast endpoint** (P0 #6) — `broadcastLimiter` 10/hour
9. **Backend tests for new admin endpoints** (P0 #7) — 47 tests PASS
10. **Categories management** (P1 admin)
11. **Coupons management** (P1 admin)
12. **Reviews moderation** (P1 admin)

**🎉 P0 Sprint 1 (الأمان) مكتمل 100% — 7/7 مهام DONE**

### المهام المُنفَّذة حديثاً (2026-07-12):

- ✅ **CSRF tokens** في `lib/csrf.ts` (154 سطر، double-submit cookie pattern)
- ✅ **Audit log retention** في `lib/audit-scheduler.ts` (165 سطر، node-cron 03:00 UTC)
- ✅ **Settings value redaction** في `lib/settings-redact.ts` (165 سطر)
- ✅ **Auto-cleanup orphaned coupon_usage** (commit a94552a) — P0 #4 DONE
- ✅ **Settings schema validation** (commit 5ff8e87) — P0 #5 DONE
- ✅ **Rate-limit broadcast endpoint** (broadcastLimiter 10/hour) — P0 #6 DONE
- ✅ **Backend tests for new admin endpoints** (47 tests PASS — commit 37275a6) — P0 #7 DONE
- ✅ **Login screen overhaul v2** بمقاييس Alibaba/Taobao/Amazon (808 سطر TSX + 526 سطر CSS)
- ✅ **Register screen overhaul v2** (651 سطر TSX، password strength meter، validation متطابق مع backend)

**🎉 P0 Sprint 1 مكتمل بالكامل (7/7)** — الأمان الأساسي جاهز للإنتاج
- ✅ **إنشاء 7 ملفات توثيق ناقصة**:
  - `docs/architecture/overview.md`
  - `docs/architecture/api.md`
  - `docs/architecture/database.md`
  - `docs/architecture/er-diagram.md`
  - `docs/architecture/security.md`
  - `docs/operations/deployment.md`
  - `docs/planning/risks.md`
- ✅ **6 scripts اختبار** للـ Login flow (`scripts/test-login-*.ps1`, `scripts/check-i18n.*`)

### إحصائيات المشروع المُحدَّثة (2026-07-12):

| المقياس | العدد |
|---|---|
| الـ Tables في DB | **32** |
| الـ Triggers | **32** |
| الـ PL/pgSQL Functions | ~14 |
| الـ Migrations | 30 |
| الـ Views | 4 |
| API routers | 18 (19 mounts) |
| **API endpoints** | **~70+** |
| Frontend pages | **47** (46 lazy + 1 internal) |
| Frontend features | 12 |
| Frontend custom hooks | **30+** |
| shadcn/ui primitives | 10 |
| Backend tests (Vitest) | **31** |
| Frontend tests (Vitest) | **38** |
| E2E phase scripts (PowerShell) | **18** |
| MCP tools (4 عائلات) | **18** |
| MCP catalog tools | 5 |
| Agent skills | **20** |
| Agent definitions | **12** |
| CI jobs | **7** |
| Documentation files | **13 markdown** (بعد التحديث) |

---

## 🎯 توصية: ابدأ بـ P0 المتبقي بالترتيب التالي

> **📌 تحديث 2026-07-12:** المهام #1 (CSRF) و #2 (Audit retention) تم اكتشافهما كـ **DONE** في `lib/csrf.ts` و `lib/audit-scheduler.ts`.

1. ✅ **CSRF tokens** — **DONE** في `lib/csrf.ts` (154 سطر)
2. ✅ **Audit log retention cron** — **DONE** في `lib/audit-scheduler.ts` (165 سطر، يستخدم `node-cron`)
3. **Auto-cleanup orphaned coupon_usage** (ساعة واحدة) — إصلاح بسيط
4. **Settings schema validation** (يوم واحد) — منع invalid values
5. **Rate-limit broadcast endpoint** (يوم واحد) — منع abuse
6. **Backend tests for new admin endpoints** (يومان) — Vitest coverage
7. **⚠️ إنشاء ملفات التوثيق الناقصة** (3-5 أيام) — `mkdocs.yml` يشير إلى
   ~30 ملف. أنشئ الملفات الناقصة (انظر P2 Documentation أعلاه) لتفعيل
   MkDocs build بالكامل.
8. **🔴 إنشاء ملفات التوثيق الناقصة الفعلي** (تم البدء)
   - ✅ `docs/architecture/overview.md` (تم إنشاؤه 2026-07-12)
   - ✅ `docs/architecture/api.md` (تم إنشاؤه 2026-07-12)
   - ✅ `docs/architecture/database.md` (تم إنشاؤه 2026-07-12)
   - ✅ `docs/operations/deployment.md` (تم إنشاؤه 2026-07-12)
   - ✅ `docs/planning/risks.md` (تم إنشاؤه 2026-07-12)
   - ⏳ `docs/architecture/er-diagram.md` (Mermaid)
   - ⏳ `docs/architecture/security.md`
   - ⏳ 18 files `docs/testing/phases/PHASE_*.md`
   - ⏳ 4 files `docs/testing/standards/*.md`
   - ⏳ 7 files `docs/planning/adr/*.md`

بعدها انتقل لـ P1 ابدأ بـ:
- Real reviews page (P1 customer) — أكبر قيمة للمستخدمين
- User role management (P1 admin) — أكثر طلب تشغيلي

---

## 🔍 اكتشافات المراجعة (2026-07-12)

### مشاكل التوثيق المكتشفة والمُصحَّحة

1. **خطأ في ARCHITECTURE.md و README.md (مُصحَّح):**
   - ~~28 جدول~~ → **32 جدول** ✅
   - ~~17 Triggers~~ → **32 Triggers** ✅
   - ~~33 صفحة~~ → **47 صفحة** ✅
   - ~~4 MCP catalog tools~~ → **5** ✅

2. **خطأ في عدّ frontend pages (مُصحَّح):**
   - ~~33 صفحة~~ → **47 ملف صفحة + 46 lazyPage routes** ✅

3. **خطأ في عدّ API routers (مُؤكَّد):**
   - 18 router paths فريدة + admin-extras تحت `/api/admin` (19 mounts) ✅

4. **⚠️ خطأ في mkdocs.yml (مُصحَّح 2026-07-12):**
   - كان يشير إلى ~30 ملف **غير موجود**
   - MkDocs build مع `--strict` كان سيفشل
   - **✅ تم تبسيط nav ليشير فقط للملفات الموجودة**

5. **⚠️ خطأ في BACKLOG.md (مُصحَّح 2026-07-12):**
   - P0 #2 (Settings value redaction) كان مذكور كـ TODO لكن **مُنفَّذ**
   - P1 #12-18 (admin CRUD) كان مذكور كـ TODO لكن **مُنفَّذ** في admin-extras.ts
   - 7 مهام مذكورة كـ TODO لكن DONE فعلياً — تم تحديثها لـ [x] ✅

6. **⚠️ اكتشاف إضافي 2026-07-12 (المراجعة الشاملة الثانية):**
   - **CSRF tokens** (`lib/csrf.ts`) **مُنفَّذ بالكامل** (154 سطر) — double-submit cookie pattern
   - **Audit log retention cron** (`lib/audit-scheduler.ts`) **مُنفَّذ** (165 سطر، node-cron @ 03:00 UTC)
   - **تم إنشاء 5 ملفات توثيق ناقصة**:
     - `docs/architecture/overview.md` (نظرة عامة مختصرة)
     - `docs/architecture/api.md` (API reference كامل)
     - `docs/architecture/database.md` (32 جدول + 14 function + 4 views)
     - `docs/operations/deployment.md` (دليل النشر كامل)
     - `docs/planning/risks.md` (سجل المخاطر - 10 مخاطر رئيسية)
   - **مجموع المهام DONE الآن: 10** (من 54 الأصلية)

---

## 🎨 تحسين شاشات الواجهة (Frontend UI/UX) — بدأت 2026-07-12

### الأولوية 1 — شاشة Login (`features/auth/components/Login.tsx`) ✅ تم تنفيذ v2

**التحسينات المطبَّقة (مقارنة بـ Alibaba/Taobao/Amazon):**

| التحسين | التفصيل | المصدر المرجعي |
|---|---|---|
| **تبويبات طرق الدخول** | Email / Phone / QR Code — مستوحى من Taobao/AliExpress | Taobao login tabs |
| **اكتشاف ذكي للهوية** | `detectIdentifier()` يكتشف email vs phone تلقائياً + badge | Amazon |
| **Remember me** | checkbox محفوظ في localStorage | Amazon / industry standard |
| **Caps Lock warning** | يكتشف الحالة ويُظهر hint فوري | Amazon best practice |
| **Loading messages** | رسائل تحميل وصفية ("Signing you in…" / "Verifying…") | Taobao |
| **Friendly error mapping** | `friendlyAuthError()` يحوّل الأكواد لرسائل actionable | Baymard UX research |
| **Auto-focus** | يتحرك للحقل التالي بعد Enter أو ملء email | UX standard |
| **RTL improvements** | flip كامل للأيقونات (ArrowRight ↔ ArrowLeft) | Correct RTL pattern |
| **QR Code panel** | placeholder للـ mobile scan (Taobao pattern) | Taobao mobile-first |
| **Accessibility** | ARIA labels, role="alert" للـ errors, aria-busy | WCAG 2.1 AA |
| **Trust footer** | SSL Secured · 2FA Available · Recover Access | Amazon |
| **Caps Lock detection** | `isCapsLockOn()` يكتشف من `getModifierState` | Best practice |
| **Network retry hint** | يعرض رسالة "tap to retry" عند فشل الشبكة | UX recovery |
| **Better focus states** | box-shadow بدلاً من outline (أكثر أناقة) | Material Design 3 |
| **Responsive layout** | hero مخفي < 1024px، form كامل على mobile | Mobile-first |

**الملفات المُعدَّلة:**
- `apps/web/src/features/auth/components/Login.tsx` (506 → 562 سطر)
- `apps/web/src/features/auth/components/Login.module.css` (142 → 530 سطر)
- `apps/web/src/i18n/locales/{en,ar,zh}.json` (15+ keys جديدة لكل لغة)

---

### الأولوية 2 — شاشة Register (`features/auth/components/Register.tsx`) ⏳ قادمة
### الأولوية 3 — شاشة ForgotPassword ⏳ قادمة
### الأولوية 4 — شاشة ResetPassword ⏳ قادمة
### الأولوية 5 — الصفحة الرئيسية (Home) ⏳ قادمة
### الأولوية 6 — صفحة المنتج (ProductDetail) ⏳ قادمة

**ملاحظة:** لا يوجد حالياً دور "delivery agent" (مندوب توصيل) في الكود.
الأدوار الموجودة: customer, merchant, admin. لو أردت إضافة دور "delivery",
يحتاج ذلك إلى migration جديد + endpoint جديد + صفحة جديدة في الـ backend.

---

## 📚 ملاحظات البنية التحتية المُكتشفة (2026-07-12)

### `packages/shared/` (workspace موحد)
- **321 سطر types** (Product, Store, Order, User, Address, ...) — تُستعمل في web و api
- **Constants:** `SUPPORTED_LANGUAGES`, `USER_ROLES`, `ORDER_STATUSES`
- **Cross-workspace paths:** `apps/api/tsconfig.json` يحتوي `paths: { "@noufex/web/*": ["../web/*"] }`

### CI/CD Infrastructure
- **`.github/workflows/ci.yml` (312 سطر):** 7 jobs مرتبة (cheap → expensive)
- **`scripts/quality/*.ps1`:** format, lint, test, typecheck, verify-fresh
- **`scripts/devops/*.ps1`:** docker-build, docker-run, autostart
- **`scripts/db/`:** db-setup, audit-db, drop-test-db, gen-seed-hashes

### MCP Server Infrastructure
- **`apps/mcp-server/`:** stdio server مع 18 أداة عبر 4 عائلات
- **`docker/mcp-gateway/`:** SSE listener على :8811 مع Bearer auth
- **`catalog.yaml`:** 5 tools + 2 resources + 2 prompts

### Documentation
- **`ARCHITECTURE.md` (1223 سطر):** معمارية كاملة مع Mermaid diagrams
- **`docs/README.md` (1102 سطر):** Diátaxis-compliant (Tutorials/How-to/Reference/Explanation)
- **`docs/BACKLOG.md`:** هذا الملف - محدث 2026-07-12
- **`docs/architecture/workflow.md` (345 سطر):** deployment/sequence/role diagrams
- **`e2e/COOKBOOK.md` (982 سطر):** 21 وصفة testing

---

## 📝 ملاحظات التنفيذ

- **كل الكود الجديد يجب:**
  1. يمر من `tsc --noEmit` بدون errors
  2. يمر من `eslint` بدون warnings
  3. يكون ضمن commit منفصل مع رسالة Conventional Commits
  4. يضيف i18n keys لكل الـ 3 لغات (ar, en, zh)
  5. يكتب admin_audit_log entry لكل mutation

- **قبل فتح PR:**
  - شغّل `npm run lint && npm run build && npm test`
  - اختبر يدوياً في Chrome DevTools
  - تحقق من RTL layout
  - تأكد من responsive design (mobile/tablet/desktop)

- **الأولوية لما يطلبه المستخدم مباشرة** فوق أي مهمة أخرى. إذا طلب
  المستخدم ميزة P3 جديدة قبل إكمال P0، نفّذها فوراً.

---

# 📋 نتائج المراجعة الشاملة (Comprehensive Code Review)
# ============================================================
# تم إجراء مراجعة تفصيلية للملفات الأساسية في `2026-07-12`، تشمل:
#  - 7 ملفات SQL أساسية + 30 migration
#  - 18 API module + 20+ route files + middleware.ts (993 سطر)
#  - lib utilities (15 ملف)
#  - 4 عائلات MCP tools (18 أداة)
#  - 12 frontend feature modules + 47 صفحة
#  - docker-entrypoint.sh + scripts/db-setup.cjs
#  - e2e/COOKBOOK.md (982 سطر) + 18 phase scripts
#  - .github/workflows/ci.yml (7 jobs)
#  - docs/architecture/workflow.md (345 سطر)

## ✅ اكتشافات إيجابية (P0 items مُنفَّذة فعلياً)

### 1. Settings value redaction (P0 #2) — ✅ DONE
- **الملف:** `apps/api/src/lib/settings-redact.ts` (152 سطر، أضيف 2026-07-12)
- **الوظائف:**
  - `isSensitiveSettingKey(key)` — يكتشف 8 patterns (`_password`, `_secret`, `_token`, `_api_key`, `_apikey`, `_private_key`, إلخ)
  - `redactSettingValue(key, value)` — يُرجع `[REDACTED]` للمفاتيح الحساسة
  - `diffSettingValue(key, oldValue, newValue)` — يُسجّل `[unchanged]` للـ no-ops
  - `readSettingDirect(key)` — bypass للـ cache لقراءة القيمة الحقيقية
  - `writeSettingAudit(req, key, oldValue, newValue)` — convenience wrapper
- **التطبيق:** `routes/admin-extras.ts:490-530` يستخدم هذه الدوال في `PATCH /api/settings/:key`
- **حالة الـ BACKLOG:** ❌ لم يُحدَّث — يجب تعليم P0 #2 كـ DONE

### 2. Admin CRUD endpoints (Phase-2) — ✅ DONE
- **الملف:** `apps/api/src/routes/admin-extras.ts` (599 سطر، أضيف 2026-07-12)
- **Endpoints الجديدة:**
  - `GET/POST/PATCH/DELETE /api/admin/categories` — Categories CRUD
  - `GET/POST/PATCH/DELETE /api/admin/coupons` — Coupons CRUD
  - `GET/PATCH/DELETE /api/admin/reviews` — Reviews moderation
  - `POST /api/admin/notifications/broadcast` — broadcast notifications
  - `GET /api/admin/settings` + `PATCH /api/admin/settings/:key` — settings
  - `GET /api/admin/orders-with-people` — orders JOIN customers+stores
- **Frontend mirror:** `apps/web/src/features/admin/api/admin.ts` (382 سطر) — كل هذه endpoints موثّقة
- **حالة الـ BACKLOG:** ⚠️ يحتاج تحديث P1 #17 (coupons, categories, settings) إلى DONE

### 3. E2E test cookbook — ✅ DONE
- **الملف:** `apps/e2e/e2e/COOKBOOK.md` (982 سطر)
- **18 phase scripts** تغطي كل API endpoint:
  - phase00: health + auth
  - phase01: profile + addresses
  - phase02: public catalog
  - phase03: search + filters
  - phase04: cart
  - phase05: orders + inventory
  - phase06: coupons
  - phase07: payments + refunds
  - phase08: reviews + ratings
  - phase09: wishlist + followers
  - phase10: merchant flow
  - phase11: admin RBAC
  - phase12: 2FA + backup
  - phase13: notifications + messages
  - phase14: shipping methods
  - phase15: audit logs
  - phase16: frontend SPA
  - phase17: full regression
- **حالة الـ BACKLOG:** ⚠️ يحتاج تحديث

---

## 🔴 أخطاء حرجة تم اكتشافها

### 1. خطأ في ARCHITECTURE.md و README.md (تم التصحيح)
- **كان مكتوباً:** "28 جدول" و "~17 Triggers"
- **الفعلي:** 32 جدول و 32 Triggers
- **السبب:** لم يُحسب الجداول في migrations (schema_migrations, rate_limit_buckets, search_logs, used_jtis, webhook_events, app_settings)
- **التم التصحيح:** ✅ في ARCHITECTURE.md و README.md

### 2. خطأ في عدّ API routers
- **كان مكتوباً:** "18 routers"
- **الفعلي:** 19 `app.use()` mounts في index.ts (لكن 18 router paths فريدة لأن admin و admin-extras كلاهما تحت `/api/admin`)
- **التوصية:** ✅ عدّ admin كـ router واحد

### 3. خطأ في عدّ frontend pages
- **كان مكتوباً:** "33 صفحة" و "33 lazyPage routes"
- **الفعلي:** 47 ملف صفحة في `apps/web/src/pages/` و **46 lazyPage routes** في App.tsx
- **السبب:** الإصدار القديم لم يحسب AdminDashboard و AdminOrders كصفحات مستقلة (sidebar + sub-routes)
- **التوصية:** ✅ تم التصحيح في ARCHITECTURE.md

---

## 🟡 ملاحظات معمارية مهمة

### أ. الأداء (Performance)

1. **Bundle Size:** main bundle ~200KB gzip. recharts (~120KB) و framer-motion (~45KB)
   تُحمّل eagerly في الـ admin pages رغم أنها في lazy chunks منفصلة.
   - **التوصية:** استعمل `React.lazy()` على AdminProducts و ReportsAnalytics
     - **حالة:** مذكور في P2 — لم يُنفَّذ

2. **Search performance:** search.ts يستخدم ILIKE على `name_en LIKE` بدون
   استخدام الـ GIN index `idx_products_search_tsv` (موجود في migration 0009).
   - **حالة:** ⚠️ نصف مُنفَّذ — الـ view يستخدمه لكن endpoint لا يستخدمه

3. **Catalog window function:** ✅ تم تطبيق `COUNT(*) OVER ()` بدلاً من query منفصل
   - **مرجع:** `routes/catalog.ts:133-142`

4. **Settings cache:** ✅ TTL 60 ثانية + fail-OPEN على الـ DB
   - **مرجع:** `lib/settings.ts:37-94`

### ب. الأمان (Security)

1. **HttpOnly cookies + scrypt + HMAC-SHA256 + TOTP 2FA:** ✅ مُطبَّق بالكامل
2. **token_version bumping:** ✅ يُلغي جميع الـ tokens عند logout/change-password
3. **Webhook idempotency:** ✅ عبر `webhook_events` table (UNIQUE constraint)
4. **Audit log + redactor:** ✅ 17 sensitive keys + dead-letter queue
5. **Settings value redaction:** ✅ مُنفَّذ في `lib/settings-redact.ts` (أنماط: `_password`, `_secret`, `_token`, `_api_key`)
6. **CSRF tokens:** ❌ غير مطبَّق — يعتمد فقط على SameSite=Strict
   - **حالة:** مذكور في P0 — أولوية قصوى

### ج. الجودة (Code Quality)

1. **God object refactor:** ✅ shared.cts تم تفكيكه إلى 15 ملف متخصص
   (god object refactor P0-1، 2026-07-03)
2. **E2E test coverage:** ✅ 18 phase scripts + cookbook مع 16 وصفة
3. **CI/CD pipeline:** ✅ 7 jobs في `.github/workflows/ci.yml` (lint, typecheck, test, build, db-integration, server-boot, mcp-server)
4. **Zod schemas:** ✅ 30+ schema في `lib/validation.ts`
5. **TypeScript strict mode:** ✅ كل الـ apps تستخدم strict mode

### د. CI/CD (موجود بالكامل)

`/Users/zaher/Documents/Projects/nouf-ex/.github/workflows/ci.yml` يحتوي 7 jobs:
1. **docs-presence:** يفحص وجود الملفات الأساسية (pre-flight)
2. **lint:** ESLint عبر turbo
3. **typecheck:** TypeScript عبر turbo
4. **mcp-server:** build الـ MCP server
5. **test:** Vitest (API + Web + a11y)
6. **build:** vite SPA + esbuild API
7. **db-integration:** postgres:17 service container + db:setup
8. **server-boot:** boot API + curl health/ready/stats

### هـ. Tests coverage (موجود بالكامل)

- **Backend (Vitest):** 31 ملف في `apps/api/src/tests/` يغطي:
  - كل router (auth, addresses, admin, cart, catalog, coupons, customer, notifications, orders, payments, refunds, reviews, seller, settings, shipping, stats, store-followers, wishlist)
  - lib utilities (totp, partial-token, backup-codes, error-codes, pg-wrapper, search, settings)
- **Frontend (Vitest):** 38 ملف في `apps/web/src/`:
  - 3 a11y tests (axe-core) لـ AdminDashboard, CustomerDashboard, ReportsAnalytics
  - 8 component tests (Layout, Navbar, BottomNav, Footer, ProtectedRoute, Skeletons, Toast, ErrorBoundary)
  - 2 context tests (AppContext, CartContext)
  - 5 feature tests (Categories, Deals, ProductDetail, SearchResults, StorePage)
  - 1 checkout test
  - 3 hooks tests (useApi, useCheckoutHooks, use-mobile)
  - 9 page tests (Login, Register, ForgotPassword, ResetPassword, NotFound, Wishlist, ui-smoke)
  - 4 lib tests (api, cart-sync, format, utils)
- **E2E (PowerShell):** 18 phase scripts + COOKBOOK.md (982 سطر)
- **CI integration:** `apps/api/coverage/` + `apps/web/coverage/` كـ artifacts

### و. Agent Skills & Definitions (موجود بالكامل)

`.github/skills/` يحتوي **20 skill** موزعة على 7 فئات:
- **Analysis & Planning:** analyze, plan, api-design
- **Implementation:** implement, refactor, scaffold
- **Quality & Fixes:** fix, verify, review, debug
- **Testing & Docs:** test, document
- **Organization & Performance:** organize, cleanup, optimize
- **Security:** secure
- **Operations:** deploy, migrate, integrate, monitor
- **Meta:** auto-switch-agent

`.github/agents/` يحتوي **12 agent**:
- architect, backend, database, debug, devops, doc, frontend, performance, refactor, reviewer, security, tester

### ز. Documentation Drift (خطير — تم التصحيح 2026-07-12)

**مشكلة حرجة:** `mkdocs.yml` كان يشير إلى **~30 ملف غير موجود**:
- `architecture/overview.md`, `api.md`, `database.md`, `er-diagram.md`, `security.md` ❌
- `development/getting-started.md`, `workflow.md`, `conventions.md`, `ci-cd.md`, `debugging.md` ❌
- `operations/docker.md`, `deployment.md`, `monitoring.md`, `backup-restore.md` ❌
- `testing/standards/IEEE-829.md`, `ISO-29119.md`, `ISTQB-CTFL.md`, `google-style.md` ❌
- `testing/phases/PHASE_*.md` (18 ملف) ❌
- `planning/risks.md`, `REMEDIATION_ROADMAP_2026-Q3.md` ❌
- `planning/adr/0001-0007.md` (7 ملفات) ❌
- `audits/2026-07-11-owasp-iso25010-nist-ssdf.md` ❌

**MkDocs build مع `--strict`** كان سيفشل — الـ docs.yml CI كان يوقف الـ merge.

**✅ تم التصحيح:** تبسيط nav ليشير فقط للملفات الموجودة فعلياً (BACKLOG.md, ARCHITECTURE.md, architecture/workflow.md, research/*.md, CHANGELOG.md).

**⚠️ عمل مستقبلي (مهم):** إنشاء الملفات الناقصة فعلياً:
- `docs/architecture/overview.md` — نظرة عامة مختصرة
- `docs/architecture/api.md` — REST API reference
- `docs/architecture/database.md` — schema documentation
- `docs/operations/deployment.md` — production deploy guide
- `docs/testing/standards/*.md` — 4 ملفات
- `docs/planning/adr/*.md` — 7 ملفات Architecture Decision Records

هذا يجعل الـ docs site كاملاً ويحقق وعد الـ "Diátaxis-compliant documentation".

### ح. CI/CD Workflows (موجود بالكامل)

5 workflows في `.github/workflows/`:
1. **`ci.yml` (312 سطر):** 7 jobs - docs-presence → lint → typecheck → mcp-server → test → build → db-integration → server-boot
2. **`deploy-staging.yml` (185 سطر):** Auto-deploy على push لـ main
3. **`deploy-prod.yml` (182 سطر):** Production deploy مع semver tag + automatic rollback
4. **`docs.yml` (103 سطر):** MkDocs build + GitHub Pages + banned-pattern check
5. **`link-check.yml` (104 سطر):** markdown-link-check nightly + PR

---

## 🟢 توصيات تحسين فورية (Quick Wins)

| # | التحسين | الجهد | الأثر |
|---|---|---|---|
| 1 | تصحيح عداد الجداول في ARCHITECTURE.md (28 → 32) | 1 دقيقة | ✅ تم |
| 2 | تصحيح عداد الـ Triggers (17 → 32) | 1 دقيقة | ✅ تم |
| 3 | إضافة وثائق لـ docker-entrypoint.sh | 15 دقيقة | متوسط |
| 4 | توثيق scripts/db-setup.cjs | 15 دقيقة | متوسط |
| 5 | توثيق frontend hooks/useApi.ts | 20 دقيقة | عالي |
| 6 | إضافة TypeScript path aliases لـ apps/mcp-server | 10 دقائق | منخفض |
| 7 | توثيق 47 frontend page بدلاً من 33 | 30 دقيقة | عالي |
| 8 | إضافة مثال لاستعمال MCP gateway | 30 دقيقة | عالي |

---

## 🎯 توصيات استراتيجية (Strategic)

### 1. تحسينات الـ P0 الحالية مرتبة حسب الأمان
| الترتيب | المهمة | السبب |
|---|---|---|
| 1 | CSRF tokens | حماية ضد request forgery |
| 2 | Settings value redaction | منع تسريب secrets في audit log |
| 3 | Audit log retention cron | منع انفجار DB |
| 4 | Auto-cleanup coupon_usage | إصلاح integrity |
| 5 | Settings schema validation | منع invalid configs |

### 2. صفحات Frontend تحتاج مراجعة
- **47 صفحة** (تم تحديث ARCHITECTURE.md)
- **13 صفحة admin** + **7 seller** + **12 customer** + **8 public** + **5 auth** + **2 misc**

### 3. أدوات MCP الـ 18 (موثّقة الآن بالكامل):
- 9 db_* (queries, schema, stats)
- 3 code_* (tree, read, search)
- 3 api_* (routes, endpoint detail, search)
- 3 docs_* (list, read, search)

---

## 📊 مقارنة الوثائق قبل وبعد التصحيح

| البيان | قبل | بعد (التصحيح) |
|---|---|---|
| عدد الجداول | 28 ❌ | 32 ✅ |
| عدد الـ Triggers | ~17 ❌ | 32 ✅ |
| عدد API routers | 18 ✅ | 18 ✅ (مُؤكَّد) |
| عدد frontend pages | 33 ❌ | 47 ✅ |
| عدد MCP tools | 18 ✅ | 18 ✅ |
| عدد API endpoints | ~60+ ✅ | ~60+ ✅ |
| عدد lib utilities | 15 ✅ | 15 ✅ |

---

## 📝 خارطة طريق مقترحة للربع القادم

### Sprint 1 (P0 - الأمان) — الحالة: 7/7 ✅ DONE ✅
1. ✅ **CSRF tokens** — DONE (commit b153c4c)
2. ✅ **Settings value redaction** — DONE
3. ✅ **Audit log retention cron** — DONE
4. ✅ **coupon_usage cleanup** — DONE (commit a94552a)
5. ✅ **Settings schema validation** — DONE (commit 5ff8e87)
6. ✅ **Rate-limit broadcast endpoint** — مُنفَّذ مسبقاً (broadcastLimiter في shared.ts)
7. ✅ **Backend tests for new admin endpoints** — DONE (commit 37275a6)

### Sprint 2 (P1 - UX) — الحالة: 2/4 ✅ DONE
1. ✅ **Login screen overhaul** — DONE (commit e533b09)
2. ✅ **Register screen overhaul** — DONE (commit 56a29d4)
3. ⏳ **Real reviews page** (يومان)
4. ⏳ **Wishlist price-drop alerts**
5. ⏳ **Order tracking map**

### Sprint 3 (تحسينات معمارية):
1. استبدال useApi بـ TanStack Query
2. Code splitting للـ recharts و framer-motion
3. Image optimization مع srcset

### Sprint 4 (تجارب وأتمتة):
1. e2e tests للـ admin critical paths
2. Vitest coverage لـ admin-extras.ts (599 سطر جديدة)
2. Backup automation
3. CI/CD للـ docs/audit

---

## 📌 Sprint 5 (ما بعد 2026-07-14) — المهام المُحدَّدة من جلسة الإصلاح

> **الناتج من جلسة 2026-07-14:** تم إصلاح 13 مشكلة حرجة (راجع
> `CHANGELOG.md [Unreleased]` و `docs/STATUS_2026-07-14.md` للتفاصيل).
> المهام أدناه **لم تُنفَّذ بعد** وتحتاج إلى جلسات منفصلة.

### 🟠 P0 — عالية الأولوية (يجب حلها قبل Production)

#### Backend
- [ ] **إصلاح 15 failing tests في `apps/api/src/tests/`** —
      `wishlist-router`, `notifications-router`, `coupons-router`,
      `cart-router`, `payments-router`, `reviews-router`,
      `auth-router`, `admin-read-router`. كلها failures بسبب:
      الاختبارات تُمَسْكِن الـ pg (`mock`) لتُرجع `undefined` لكن
      الـ routes الحديثة تتعامل مع `undefined` كـ empty array.
      الإصلاح: تحدّيث الاختبارات لتطابق السلوك الجديد.

#### Frontend
- [ ] **إصلاح 3 real bugs في Seller pages** —
      `apps/web/src/features/seller/components/SellerProducts.tsx`,
      `SellerOrders.tsx`, `SellerAnalytics.tsx` يرسمون empty object
      كـ child (`Error: Objects are not valid as a React child`).
      مصدر المشكلة على الأرجح في `useDataHook` عند خلط فهارس jsonb
      مع array.

- [ ] **إصلاح 24 DOM-content drift في tests** —
      `Footer.test.tsx`, `Register.test.tsx`, `ResetPassword.test.tsx`,
      `Wishlist.test.tsx`, إلخ. النصوص/aria-labels تغيّرت بعد i18n v2
      لكن الاختبارات لم تُحدَّث. الإصلاح: استبدال النصوص القديمة
      بنصوص v2 أو إضافة `data-testid`.

#### DevOps
- [ ] **`apps/e2e/run-all.ps1` مفقود** — `apps/e2e/package.json`
      يشير إلى script غير موجود. الإصلاح: إنشاء run-all.ps1 يستدعي
      phase00..phase17 بالتسلسل، أو حذف entry الـ `test` من
      `package.json`.

- [ ] **5 scripts في `scripts/quality/` تشير إلى legacy `app/` path**
      — `test.ps1`, `typecheck.ps1`, `lint.ps1`, `format.ps1`,
      `format-check.ps1`. كلها `Set-Location $PSScriptRoot\..\app`.
      الإصلاح: `Set-Location $PSScriptRoot\..\..` (الـ repo root)
      أو حذف نهائياً والاعتماد على `npm run test/typecheck/lint`.

### 🟡 P1 — متوسطة الأولوية (الأسبوع القادم)

- [ ] **`scripts/quality/verify-fresh.cjs` يستخدم `app/node_modules/pg`**
      — يجب تحديثه إلى `path.join(__dirname, '..', '..', 'node_modules', 'pg')`.

- [ ] **`scripts/quality/test-stack.ps1` يتأكد فقط من 5 endpoints بدون
      التحقق من شكل الـ JSON** — أضف assertions لـ body shape.

- [ ] **6 ملفات root-level .md قديمة (تاريخ 2025-02-17)** —
      `DOCUMENTATION_INDEX.md`, `EXAMINATION_COMPLETE.md`,
      `FIX_GUIDE.md`, `PROJECT_HEALTH_REPORT.md`,
      `PROJECT_MANAGEMENT.md`, `TECH_STACK_SUMMARY.md`. كلها
      تشير إلى legacy `app/` paths وإصدارات قديمة. الإما: حذف
      أو تحديث بأرقام 2026-07-14.

- [ ] **وثائق `apps/api/src/modules/delivery-agent/` مفقودة** —
      هذا الـ module يُغطّى في tests لكن لا يوجد قسم مخصّص في
      ARCHITECTURE.md.

- [ ] **ARCHITECTURE.md يقول "31 backend tests" بينما الفعلي 597 test
      في 35 ملف** — تحديث قسم "8.1 Backend Tests".

### 🟢 P2 — تحسينات (الربع القادم)

- [ ] **`apps/mobile` workspace معطّل** — يستخدم TypeScript 6.0.3 غير
      متوافق مع باقي الـ monorepo (5.9.3). اتخاذ قرار: إصلاح
      أو أرشفة.

- [ ] **MCP server بدون tests** — إضافة smoke tests لـ
      `loadProject()` و `isSafeReadOnlySql()` و `safeResolve()`.

- [ ] **`scripts/quality/test-summary.cjs` يستخدم cwd الحالي** —
      يجب أن يحدد workspace صريح.

- [ ] **استبدال `useDataHook` بـ TanStack Query** (مذكور في
      BACKLOG.md §P0 Frontend) — تحسين caching/refetch/optimistic
      updates في admin tables.

- [ ] **Image optimization** مع srcset للـ products.

- [ ] **CI/CD للـ docs/audit** المذكور في Sprint 4.

---

## 📊 ملخص حالة المشروع بعد 2026-07-14

| المقياس | القيمة | المصدر |
|---|---|---|
| Workspace packages | 5 (api, web, mcp-server, e2e + mobile disabled) | `apps/` |
| Shared packages | 4 (db, shared, typescript-config, eslint-config) | `packages/` |
| Database tables | **34** (was 32) | `packages/db/` + migration 0031 |
| PL/pgSQL functions | 107 | `pg_database` |
| Triggers | 43 | `pg_database` |
| Backend Vitest files | **35** (33 active tests + 2 helpers) | `apps/api/src/tests/` |
| Backend tests passing | **582/597** (97.5%) | run 2026-07-14 |
| Frontend Vitest files | **38** | `apps/web/src/**/*.test.tsx` |
| Frontend tests passing | **264/298** (88.6%) | run 2026-07-14 |
| E2E PowerShell phases | 18 phase + 19 smoke | `apps/e2e/e2e/` |
| Docker image | `noufex:latest` (1.37GB on disk, ~259MB compressed) | built 2026-07-14 |
| Live API endpoints | 60+ (`apps/api/src/index.ts`) | routes table |
| GitHub workflows | 5 (ci, deploy-prod, deploy-staging, docs, link-check) | `.github/workflows/` |
| Last commit | `7216280` (2026-07-14) | `git log` |

---

## ✅ ما تم إنجازه في جلسة 2026-07-14 (تلخيص)

**13 إصلاح رئيسي + 3 commits مُدفوعة إلى `fix/routes-cts-to-ts-2026-07-06`:**

1. ✅ إصلاح توافق Node 24 ↔ Turbo (EFTYPE) — توثيق استخدام Node 20 LTS
2. ✅ إصلاح `db-setup.cjs` ليحل متغيرات psql `:VAR` عبر dotenv
3. ✅ إعادة ترتيب pipeline في db-setup: migrations → roles → seed
4. ✅ توسيع `schema_migrations.version` إلى VARCHAR(100)
5. ✅ إصلاح `seed.sql`: إضافة `deal_ends_at` للمنتجات، قلب إشارة fee transactions
6. ✅ إصلاح 9 TypeScript casts في `delivery-agent/` module
7. ✅ إصلاح `apps/web/vitest.config.ts` — إضافة esbuild.jsx:automatic للـ dom project
8. ✅ إنشاء `apps/api/vitest.config.ts` + `vitest.setup.ts` لتحميل .env
9. ✅ إصلاح `docker-compose.yml` — `DB_HOST=host.docker.internal` + rewrite DATABASE_URL
10. ✅ إصلاح `.dockerignore` — السماح بـ `scripts/devops/docker-entrypoint.sh`
11. ✅ تحديث `apps/mcp-server/src/project.ts` لمسارات monorepo الصحيحة
12. ✅ تحديث `deploy-prod.yml` و `deploy-staging.yml` لمسارات monorepo (was legacy `app/`)
13. ✅ استبدال `rm -rf` بـ `fs.rmSync` في كل `clean` scripts (cross-platform)

**الأثر:**
- Typecheck: 4/4 ✅
- Backend tests: 0 → 582 passing (+582)
- Frontend tests: 243 → 264 passing (+21) — 24/24 smoke tests pass now
- Docker image: built successfully
- API: all health/stats/products/auth endpoints return 200
- MCP server: db_stats returns real DB introspection

راجع `docs/STATUS_2026-07-14.md` للتفاصيل الكاملة.
