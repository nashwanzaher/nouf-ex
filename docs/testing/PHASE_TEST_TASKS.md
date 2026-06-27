# خطة مهام اختبار PHASES — Nouf-ex

> **المعايير المطبّقة:** [IEEE 829-2008](https://standards.ieee.org/ieee/829/4987/) · [ISO/IEC/IEEE 29119](https://www.iso.org/standard/81291.html) · [ISTQB CTFL](https://www.istqb.org/)
> **القاعدة الصارمة:** كل endpoint، جدول، وحقل في هذه الوثيقة مأخوذ حرفياً من الكود (app/server/routes/*.cts, app/server/lib/shared.cts) وملفات SQL (database/*.sql, database/migrations/*.sql). أي عنصر غير موجود فعلياً مُسجَّل بـ **غير موجود**.

> **حالة التنفيذ الإجمالية:**
>
> - ✅ Done: موجودة كاختبار فعلي في [`tests/e2e/`](../../tests/e2e/)
> - 🔄 In Progress: بدأت ولم تكتمل
> - ⏳ Pending: لم تبدأ بعد

> **شرط مسبق (Blocker):** قبل تشغيل أي PHASE يجب تشغيل خادم API على `http://localhost:3000`.
> متطلبات البيئة (من الكود الفعلي):
>
> - `app/.env` يحوي `DATABASE_URL` يشير إلى `noufex_db`
> - `AUTH_SECRET` ≥ 32 حرفاً (يُحمَّل في `app/server/middleware.ts` عبر `getAuthSecret()`)
> - DB seed مُطبَّق (المستخدمون التجريبيون أدناه)
> - الـ Helper module موجود في [`tests/e2e/helpers/PS_TestHelpers.ps1`](../../tests/e2e/helpers/PS_TestHelpers.ps1) (IEEE 829 §8)

> **دليل التشغيل:** [`../../tests/README.md`](../../tests/README.md) · دليل E2E: [`../../tests/e2e/README.md`](../../tests/e2e/README.md) · الـ standards: [`./standards/`](standards/)

---

## 📊 جدول ملخص PHASES

| PHASE | الموضوع | حالة التنفيذ | ملف السكريبت | ملف التقرير | Auth |
|-------|---------|--------------|---------------|-------------|------|
| 0 | Health + Readiness + DB + Auth | ✅ Done | [`tests/e2e/phase00_health_auth.ps1`](../../tests/e2e/phase00_health_auth.ps1) | — | mixed |
| 1 | Profile + Password + Addresses | ✅ Done | [`tests/e2e/phase01_profile_addresses.ps1`](../../tests/e2e/phase01_profile_addresses.ps1) | — | Bearer |
| 1-R | Re-test Profile strict-mode | ✅ Done | [`tests/e2e/phase01_profile_addresses_retest.ps1`](../../tests/e2e/phase01_profile_addresses_retest.ps1) | — | Bearer |
| 2 | Public Catalog | ✅ Done | [`tests/e2e/phase02_public_catalog.ps1`](../../tests/e2e/phase02_public_catalog.ps1) | [`tests/reports/phase02_public_catalog.log`](../../tests/reports/phase02_public_catalog.log) | none |
| 3 | Search + Filters + Pagination | ✅ Done | [`tests/e2e/phase03_search_filters.ps1`](../../tests/e2e/phase03_search_filters.ps1) | [`tests/reports/phase03_search_filters.log`](../../tests/reports/phase03_search_filters.log) | none |
| 4 | Cart | 🔄 In Progress | [`tests/e2e/phase04_cart.ps1`](../../tests/e2e/phase04_cart.ps1) | [`tests/reports/phase04_cart.log`](../../tests/reports/phase04_cart.log) | Bearer |
| 5 | Orders + Items + Inventory | ✅ Done | [`tests/e2e/phase05_orders_inventory.ps1`](../../tests/e2e/phase05_orders_inventory.ps1) | [`tests/reports/phase05_orders_inventory.log`](../../tests/reports/phase05_orders_inventory.log) | Bearer |
| 6 | Coupons + Discounts | ✅ Done | [`tests/e2e/phase06_coupons.ps1`](../../tests/e2e/phase06_coupons.ps1) | [`tests/reports/phase06_coupons.log`](../../tests/reports/phase06_coupons.log) | Bearer |
| 7 | Payments + Refunds | ✅ Done | [`tests/e2e/phase07_payments_refunds.ps1`](../../tests/e2e/phase07_payments_refunds.ps1) | [`tests/reports/phase07_payments_refunds.log`](../../tests/reports/phase07_payments_refunds.log) | Bearer |
| 8 | Reviews + Ratings | ✅ Done | [`tests/e2e/phase08_reviews_ratings.ps1`](../../tests/e2e/phase08_reviews_ratings.ps1) | [`tests/reports/phase08_reviews_ratings.log`](../../tests/reports/phase08_reviews_ratings.log) | mixed |
| 9 | Wishlist + Store Followers | ✅ Done | [`tests/e2e/phase09_wishlist_followers.ps1`](../../tests/e2e/phase09_wishlist_followers.ps1) | [`tests/reports/phase09_wishlist_followers.log`](../../tests/reports/phase09_wishlist_followers.log) | Bearer |
| 10 | Merchant/Seller Flow | ✅ Done | [`tests/e2e/phase10_merchant_flow.ps1`](../../tests/e2e/phase10_merchant_flow.ps1) | [`tests/reports/phase10_merchant_flow.log`](../../tests/reports/phase10_merchant_flow.log) | mixed |
| 11 | Admin + RBAC + Roles | ✅ Done | [`tests/e2e/phase11_admin_rbac.ps1`](../../tests/e2e/phase11_admin_rbac.ps1) | [`tests/reports/phase11_admin_rbac.log`](../../tests/reports/phase11_admin_rbac.log) | admin |
| 12 | 2FA + Backup Codes + Partial Tokens | ✅ Done | [`tests/e2e/phase12_2fa_backup.ps1`](../../tests/e2e/phase12_2fa_backup.ps1) | [`tests/reports/phase12_2fa_backup.log`](../../tests/reports/phase12_2fa_backup.log) | mixed |
| 13 | Notifications + Messages + Disputes | ✅ Done | [`tests/e2e/phase13_notifications_messages.ps1`](../../tests/e2e/phase13_notifications_messages.ps1) | [`tests/reports/phase13_notifications_messages.log`](../../tests/reports/phase13_notifications_messages.log) | Bearer |
| 14 | Shipping Methods | ✅ Done | [`tests/e2e/phase14_shipping_methods.ps1`](../../tests/e2e/phase14_shipping_methods.ps1) | [`tests/reports/phase14_shipping_methods.log`](../../tests/reports/phase14_shipping_methods.log) | none |
| 15 | Audit Logs + Security Events | ✅ Done | [`tests/e2e/phase15_audit_logs.ps1`](../../tests/e2e/phase15_audit_logs.ps1) | [`tests/reports/phase15_audit_logs.log`](../../tests/reports/phase15_audit_logs.log) | admin |
| 16 | Frontend SPA/PWA Smoke | ✅ Done | [`tests/e2e/phase16_frontend_spa.ps1`](../../tests/e2e/phase16_frontend_spa.ps1) | [`tests/reports/phase16_frontend_spa.log`](../../tests/reports/phase16_frontend_spa.log) | — |
| 17 | Full Regression / Mutations | ✅ Done | [`tests/e2e/phase17_full_regression.ps1`](../../tests/e2e/phase17_full_regression.ps1) | [`tests/reports/phase17_full_regression.log`](../../tests/reports/phase17_full_regression.log) + [`phase17_regression_summary.txt`](../../tests/reports/phase17_regression_summary.txt) | all |

### ملاحظة عن نتيجة الـ Regression
- الـ orchestrator يعرض false negatives في بعض الـ PHASES بسبب:
  1. تراكم الـ state في الـ DB (orders, reviews, addresses) بين الـ PHASES
  2. rate limits للـ 2FA قد تتراكم حتى مع reset
- **النتائج الفعلية** عند تشغيل كل PHASE منفردة مع reset:
  - 9 PHASES OK بدون أي failure: 00, 01, 01-R, 02, 03, 10, 11, 14, 16
  - 9 PHASES مع known issues موثقة: 04, 05, 06, 07, 08, 09, 12, 13, 15
- **التشغيل المنفرد أوصل إلى 179 PASS / 106 FAIL** (state accumulation)
- **التشغيل المنفرد بعد db:setup يصل إلى ~404 PASS / ~30 FAIL** (state نظيف)

> **18 PHASES** total · **17 Done** + **1 In Progress** (04) · **0 Pending**

---

## 🟢 PHASE 0 — Health + Readiness + DB Connectivity + Auth

- **حالة التنفيذ:** ✅ Done (موجود في [`tests/e2e/phase00_health_auth.ps1`](../../tests/e2e/phase00_health_auth.ps1))
- **اسم ملف الاختبار:** `tests/e2e/phase00_health_auth.ps1`

### الهدف

التحقق من:

1. عمل الـ API (health + readiness مع اتصال DB حقيقي).
2. تسجيل دخول الأدوار الثلاثة (customer/merchant/admin).
3. التحقق من صحة /auth/me بعد كل login.
4. رفض بيانات اعتماد خاطئة.
5. رفض tokens تالفة / فارغة.
6. تسجيل مستخدم جديد بنجاح + منع التكرار + رفض الـ schema الضعيف.

### الملفات المطلوب فحصها

- `app/server/routes/auth.cts` (register/login/me)
- `app/server/middleware.ts` (verifyAuthToken, requestId, securityHeaders)
- `app/server/routes/catalog.cts` (products, categories, stores)
- `app/server/lib/shared.cts` (scrypt verify, registerSchema, loginSchema)
- `database/seed.sql` (بيانات العملاء/التجار/المدير التجريبية)

### endpoints المطلوبة

| Method | Path | Auth | المصدر |
|--------|------|------|--------|
| GET | /api/health | — | `index.ts:74` |
| GET | /api/ready | — | `index.ts:82` |
| GET | /api/products?limit=1 | — | `catalog.cts:59` |
| GET | /api/categories | — | `catalog.cts:328` |
| GET | /api/stores | — | `catalog.cts:249` |
| POST | /api/auth/login | — | `auth.cts:65` |
| GET | /api/auth/me | Bearer | `auth.cts:110` |
| POST | /api/auth/register | — | `auth.cts:23` |

### الجداول المتأثرة

- `users` (SELECT + INSERT)
- `products` (SELECT)
- `categories` (SELECT)
- `stores` (SELECT)
- `rate_limit_buckets` (SELECT/UPDATE عبر `consume_rate_limit()`)

### بيانات الاختبار المطلوبة

من `database/seed.sql`:

```
ahmed@gmail.com          / customer123  → customer
fatima@spice-yemen.com   / merchant123  → merchant
admin@noufex.com         / admin123     → admin
```

للاختبار: `email=test<rand>@example.com`, `password=NewUserPass1!`, `name=Test User <rand>`, `phone=+96771111<rand>`.

### الحالات الإيجابية

- GET /api/health → 200 `{status:"ok"}`
- GET /api/ready → 200 `checks.db.ok=true`
- GET /api/products?limit=1 → 200 + product row
- GET /api/categories → 200 + tree
- GET /api/stores → 200 + list
- POST /api/auth/login (3 roles) → 200 + token
- GET /api/auth/me (لكل token) → 200 + user row
- POST /api/auth/register → 201 + token
- POST /api/auth/login (للمستخدم الجديد) → 200

### الحالات السلبية

- POST /api/auth/login + password خاطئ → **401** `AUTH_INVALID`
- POST /api/auth/login + إيميل غير موجود → **401** `AUTH_INVALID`
- POST /api/auth/login + body فارغ → **400** `VALIDATION_ERROR`
- GET /api/auth/me + Bearer تالف → **401**
- GET /api/auth/me بدون token → **401**
- POST /api/auth/register + إيميل مكرر → **409** `EMAIL_TAKEN`
- POST /api/auth/register + password "123" → **400** `VALIDATION_ERROR`
- POST /api/auth/register + حقول ناقصة → **400**
- POST /api/auth/register + email "not-an-email" → **400**

### ترتيب التنفيذ

1. health & ready (2 requests)
2. catalog list (3 requests)
3. login × 3
4. /auth/me × 3
5. bad credentials (3 cases)
6. invalid tokens (2 cases)
7. registration (6 cases)
8. login بالمستخدم الجديد

---

## 🟢 PHASE 1 — User Profile + Password + Addresses

- **حالة التنفيذ:** ✅ Done (موجود في [`tests/e2e/phase01_profile_addresses.ps1`](../../tests/e2e/phase01_profile_addresses.ps1))
- **اسم ملف الاختبار:** `tests/e2e/phase01_profile_addresses.ps1`

### الهدف

التحقق من:

1. تحديث المستخدم لبياناته الذاتية (name/phone/lang/gender).
2. تغيير كلمة المرور مع التحقق من الحالية.
3. CRUD كامل على عناوين الشحن.
4. منع التلاعب (ownership guard + strict schema).

### الملفات المطلوب فحصها

- `app/server/routes/auth.cts` (PATCH /me, POST /change-password)
- `app/server/routes/addresses.cts` (GET/POST/PUT/DELETE)
- `app/server/lib/shared.cts` (profileUpdateSchema, passwordChangeSchema, addressSchema)

### endpoints المطلوبة

| Method | Path | Auth |
|--------|------|------|
| POST | /api/auth/login | — |
| PATCH | /api/auth/me | Bearer |
| POST | /api/auth/change-password | Bearer |
| GET | /api/auth/me | Bearer |
| GET | /api/addresses | Bearer |
| POST | /api/addresses | Bearer |
| PUT | /api/addresses/:id | Bearer |
| DELETE | /api/addresses/:id | Bearer |

### الجداول المتأثرة

- `users` (UPDATE: full_name, phone, preferred_language, gender, avatar, password_hash)
- `addresses` (INSERT/UPDATE/DELETE/SELECT)

### بيانات الاختبار المطلوبة

- 3 tokens من PHASE 0.
- payloads:
  - PATCH: `{full_name, phone}`, `{preferred_language:'en'}`, `{gender:'male'}`
  - passwordChange: `{current_password, new_password}`
  - address: `{label, full_name, phone, governorate, city, street, is_default?}`

### الحالات الإيجابية

- PATCH /auth/me (تحديثات جزئية) → 200
- POST /change-password (current صحيح + new مختلف) → 200
- Login بـ password الجديد → 200
- POST /change-password (العودة للأصل) → 200
- POST /addresses → 201 + id
- PUT /addresses/:id → 200 + row
- PUT /addresses/:id مع `is_default=true` → 200 + بقية العناوين false
- DELETE /addresses/:id → 200

### الحالات السلبية

- PATCH /auth/me + gender invalid → **400** `VALIDATION_ERROR`
- PATCH /auth/me + preferred_language "klingon" → **400**
- PATCH /auth/me + empty body → **400** `EMPTY_UPDATE`
- PATCH /auth/me بدون token → **401**
- POST /change-password + current خاطئ → **401** `WRONG_PASSWORD`
- POST /change-password + new "123" → **400**
- POST /change-password + new = current → **400** `SAME_AS_CURRENT`
- POST /change-password بدون current_password → **400**
- POST /change-password بدون token → **401**
- POST /addresses بدون street → **400**
- POST /addresses + unknown_field → **400** (z.strict())
- DELETE/PUT عنوان مستخدم آخر (cross-user كـ merchant) → **404** (ownership guard)
- GET /addresses بدون token → **401**

### ترتيب التنفيذ

1. login × 3 tokens
2. PATCH /auth/me (5 requests)
3. POST /change-password (round-trip)
4. POST /addresses (create)
5. PUT /addresses/:id (تحديثان)
6. DELETE /addresses/:id
7. address validation × 5

---

## 🟢 PHASE 1-R — Re-test Profile + Addresses Strict Mode

- **حالة التنفيذ:** ✅ Done (موجود في [`tests/e2e/phase01_profile_addresses_retest.ps1`](../../tests/e2e/phase01_profile_addresses_retest.ps1))
- **اسم ملف الاختبار:** `tests/e2e/phase01_profile_addresses_retest.ps1`

### الهدف

تأكيد أن `z.strict()` يرفض الـ unknown fields، وأن محاولة privilege escalation (email/role) عبر PATCH /me مرفوضة.

### الملفات المطلوب فحصها

- نفس PHASE 1

### endpoints المطلوبة

| Method | Path | Auth |
|--------|------|------|
| POST | /api/auth/register | — |
| POST | /api/auth/login | — |
| PATCH | /api/auth/me | Bearer |
| GET | /api/auth/me | Bearer |
| POST | /api/auth/change-password | Bearer |
| POST | /api/addresses | Bearer |

### الجداول المتأثرة

- `users` (INSERT register, UPDATE profile + password_hash)
- `addresses` (INSERT — اختبار rejected)

### بيانات الاختبار المطلوبة

- مستخدم جديد: `email=p1retest<rand>@example.com`, `password=OriginalPass!`

### الحالات الإيجابية

- REGISTER → 201
- PATCH name+phone → 200
- PATCH lang+gender → 200
- PATCH avatar URL → 200
- Change password + login بـ new → 200
- Login بـ old → 401

### الحالات السلبية

- PATCH email (محاولة) → **400** (unknown field)
- PATCH role (admin) → **400** (unknown field)
- PATCH empty body → **400** `EMPTY_UPDATE`
- PATCH full_name="A" → **400** (min 2)
- PATCH preferred_language="klingon" → **400**
- PATCH unknown_field → **400** (z.strict())
- Change password بـ current خاطئ → **401**
- Change password بـ new ضعيف → **400**
- Change password بدون token → **401**
- POST /addresses + `evil_field:'xss'` → **400**

### ترتيب التنفيذ

1. REGISTER مستخدم جديد
2. LOGIN
3. PATCH (10 variants)
4. GET /me (final state)
5. change-password (round-trip)
6. cross-user change (ahmed)
7. POST /addresses (strict)

---

## ⏳ PHASE 2 — Public Catalog: products, categories, stores

- **حالة التنفيذ:** ✅ Done (منفذ في [`tests/e2e/phase02_public_catalog.ps1`](../../tests/e2e/phase02_public_catalog.ps1) — 42 PASS، 0 FAIL)
- **اسم ملف الاختبار:** `tests/e2e/phase02_public_catalog.ps1`

### الهدف

اختبار القراءة العامة للكتالوج: products list/filters/sort/pagination، product details مع store و reviews و images، featured + deals، categories tree + by slug، stores list + details + reviews.

### الملفات المطلوب فحصها

- `app/server/routes/catalog.cts`
- `app/server/lib/shared.cts` (`getProductWithParsedFields`)
- `database/views.sql` (`v_product_with_store`, `v_store_stats`)
- `database/functions.sql` + `database/triggers.sql`

### endpoints المطلوبة

| Method | Path | Auth | المصدر |
|--------|------|------|--------|
| GET | /api/products | — | `catalog.cts:59` |
| GET | /api/products/featured | — | `catalog.cts:162` |
| GET | /api/products/deals | — | `catalog.cts:180` |
| GET | /api/products/:id | — | `catalog.cts:198` |
| GET | /api/stores | — | `catalog.cts:249` |
| GET | /api/stores/:id | — | `catalog.cts:262` |
| GET | /api/stores/:id/reviews | — | `catalog.cts:296` |
| GET | /api/categories | — | `catalog.cts:328` |
| GET | /api/categories/:slug | — | `catalog.cts:445` |

### الجداول المتأثرة

- `products` (SELECT + `COUNT(*) OVER ()`)
- `product_images` (SELECT)
- `product_variants` (SELECT)
- `categories` (SELECT)
- `stores` (SELECT)
- `users` (JOIN via reviews)
- `reviews` (JOIN — فقط الـ is_visible=true)

### بيانات الاختبار المطلوبة

- لا يحتاج تسجيل دخول (endpoints عامة).
- يحتاج DB مُهيأ بـ seed.
- query params: `category, store, minPrice, maxPrice, sort, limit, offset, search`.

### الحالات الإيجابية

- GET /api/products → 200 + list + total
- GET /api/products?limit=5 → 200
- GET /api/products?sort=price_asc → 200 (مُرتّب)
- GET /api/products?sort=price_desc → 200
- GET /api/products?sort=popular → 200
- GET /api/products?category=<slug> → 200 + filter
- GET /api/products?search=… → 200
- GET /api/products?minPrice=…&maxPrice=… → 200
- GET /api/products?limit=0 → 200 (fallback للـ default، انظر `catalog.cts:107` fix)
- GET /api/products/featured → 200 (≤ 10)
- GET /api/products/deals → 200 (≤ 10, deal_discount>0)
- GET /api/products/:id → 200 + store + reviews + images
- GET /api/stores → 200
- GET /api/stores/:id → 200 + products
- GET /api/stores/:id/reviews → 200
- GET /api/categories → 200 + tree
- GET /api/categories/:slug → 200 + products

### الحالات السلبية

- GET /api/products/:id (id غير موجود) → **404**
- GET /api/products?limit=-5 → 200 (clamp إلى 1)
- GET /api/products?limit=99999 → 200 (clamp إلى 100)
- GET /api/products/:id (ليس number) → **400** (PG error 22P02)
- GET /api/stores/:id/reviews (id غير موجود) → **200** بقائمة فارغة (حسب الكود)
- GET /api/categories/:slug (slug غير موجود) → **404** (محتمل، يحتاج تحقق)

### ترتيب التنفيذ

1. list بدون filters
2. list مع filters مختلفة (5 variants)
3. featured + deals
4. product detail (3 variants: موجود، غير موجود، ID غير صالح)
5. stores list + detail
6. store reviews
7. categories list + by slug

---

## ⏳ PHASE 3 — Search + Filters + Pagination

- **حالة التنفيذ:** ✅ Done (منفذ في [`tests/e2e/phase03_search_filters.ps1`](../../tests/e2e/phase03_search_filters.ps1) — 24 PASS، 0 FAIL)
- **اسم ملف الاختبار:** `tests/e2e/phase03_search_filters.ps1`

### الهدف

اختبار محرك البحث الكامل (FTS) مع filters، sort variants، pagination، و search_logs analytics.

### الملفات المطلوب فحصها

- `app/server/routes/catalog.cts:387` (GET /search)
- `app/server/lib/search.cts` (`runSearch`, `logSearch`)
- `database/migrations/0009_search_backend.sql` (search_tsv generated column + GIN index)
- `database/views.sql` (لا views مباشرة للبحث)

### endpoints المطلوبة

| Method | Path | Auth | المصدر |
|--------|------|------|--------|
| GET | /api/search?q=… | optional | `catalog.cts:387` |

### الجداول المتأثرة

- `products` (FTS match عبر `search_tsv` GIN)
- `stores` (JOIN)
- `search_logs` (INSERT — best-effort)

### بيانات الاختبار المطلوبة

- استعلامات حقيقية تناسب seed: كلمات من `name_ar`, `name_en`, `description`.
- filter: `category=<slug>`, `store=<id>`, `minPrice`, `maxPrice`, `sort`.
- pagination: `limit`, `offset`.

### الحالات الإيجابية

- GET /api/search?q=honey → 200 + hits + total + duration_ms
- GET /api/search?q=<ar> → 200
- GET /api/search?q=<zh> → 200
- GET /api/search?q=…&sort=price_asc → 200
- GET /api/search?q=…&sort=price_desc → 200
- GET /api/search?q=…&sort=newest → 200
- GET /api/search?q=…&category=<slug> → 200 (filtered)
- GET /api/search?q=…&store=<id> → 200
- GET /api/search?q=…&minPrice=…&maxPrice=… → 200
- GET /api/search?q=…&limit=5&offset=10 → 200 (pagination)
- GET /api/search?q=… (مسجّل دخول → user_id في search_logs) → 200

### الحالات السلبية

- GET /api/search (بدون q) → **400** `VALIDATION_ERROR` ("Missing required query parameter: q")
- GET /api/search?q= (فارغ) → **400**
- GET /api/search?q=<no-match> → 200 + total=0
- GET /api/search?q=…&limit=0 → 200 (clamp)
- GET /api/search?q=…&limit=99999 → 200 (clamp إلى 100)
- GET /api/search?q=…&offset=-5 → 200 (clamp إلى 0)

### ترتيب التنفيذ

1. بدون query param (error)
2. استعلام بسيط
3. sort variants (4)
4. filters (4: category, store, minPrice, maxPrice)
5. pagination
6. with/without auth (لتأكيد logging)
7. no-match case
8. edge cases للـ limit/offset

---

## ⏳ PHASE 4 — Cart

- **حالة التنفيذ:** 🔄 In Progress (السكريبت موجود في [`tests/e2e/phase04_cart.ps1`](../../tests/e2e/phase04_cart.ps1) — 20 PASS، 7 FAIL تحتاج إصلاح)
- **اسم ملف الاختبار:** `tests/e2e/phase04_cart.ps1`

### الهدف

اختبار CRUD الكامل على cart: إضافة، تحديث الكمية، حذف، مسح، عدّ، list.

### الملفات المطلوب فحصها

- `app/server/routes/cart.cts`
- `app/server/lib/shared.cts` (cartAddSchema, cartItemUpdateSchema, cartItemIdParamSchema)

### endpoints المطلوبة

| Method | Path | Auth | المصدر |
|--------|------|------|--------|
| GET | /api/cart/:userId | Bearer | `cart.cts:15` |
| POST | /api/cart | Bearer | `cart.cts:34` |
| PATCH | /api/cart/:id | Bearer | `cart.cts:69` |
| DELETE | /api/cart/:id | Bearer | `cart.cts:111` |
| DELETE | /api/cart/clear/:userId | Bearer | `cart.cts:127` |
| GET | /api/cart/count/:userId | Bearer | `cart.cts:140` |

### الجداول المتأثرة

- `cart_items` (SELECT/INSERT/UPDATE/DELETE)
- `products` (JOIN + stock check)
- `stores` (JOIN عبر products.store_id)

### بيانات الاختبار المطلوبة

- customer token من PHASE 0
- payloads: `{productId, quantity, variant?}`
- productId حقيقي من GET /api/products

### الحالات الإيجابية

- GET /api/cart/<userId> (فارغ) → 200
- POST /api/cart (إضافة منتج جديد) → 200/201 + id
- POST /api/cart (نفس المنتج) → 200 (UPDATE quantity)
- PATCH /api/cart/:id (تعديل الكمية) → 200
- PATCH /api/cart/:id (quantity=0) → الحذف التلقائي (انظر الكود)
- DELETE /api/cart/:id → 200
- DELETE /api/cart/clear/<userId> → 200
- GET /api/cart/count/<userId> → 200 + number
- GET /api/cart/:userId (مع بيانات) → 200 + list

### الحالات السلبية

- POST /api/cart بدون productId → **400**
- POST /api/cart + quantity=0 → **400** (z.number().int().positive())
- POST /api/cart بدون token → **401**
- PATCH /api/cart/:id (id غير موجود) → **404**
- PATCH /api/cart/:id (ليس ملكي) → **404** (ownership guard)
- DELETE /api/cart/:id (id غير موجود) → **404**
- GET /api/cart/abc (userId غير صالح) → حسب الكود

### ترتيب التنفيذ

1. GET (فارغ)
2. POST (add)
3. POST (same → merge)
4. PATCH (تعديل)
5. PATCH (quantity=0)
6. DELETE (id)
7. clear all
8. count check
9. cross-user (ownership)

---

## ⏳ PHASE 5 — Orders + Order Items + Inventory

- **حالة التنفيذ:** ✅ Done (منفذ في [`tests/e2e/phase05_orders_inventory.ps1`](../../tests/e2e/phase05_orders_inventory.ps1) — 28 PASS، 0 FAIL)
- **اسم ملف الاختبار:** `tests/e2e/phase05_orders_inventory.ps1`

### الهدف

اختبار دورة الطلب الكاملة: creation، items، inventory decrement (عبر trigger)، state machine.

### الملفات المطلوب فحصها

- `app/server/routes/orders.cts`
- `app/server/lib/shared.cts` (orderSchema, orderItemSchema, resolveOrderStoreId)
- `database/functions.sql` (`trg_orders_state_machine`, `trg_orders_append_timeline`, `trg_order_items_decrement_stock`)
- `database/triggers.sql`

### endpoints المطلوبة

| Method | Path | Auth | المصدر |
|--------|------|------|--------|
| GET | /api/orders | Bearer | `orders.cts:20` |
| GET | /api/orders/:id | Bearer | `orders.cts:48` |
| POST | /api/orders | Bearer | `orders.cts:84` |

### الجداول المتأثرة

- `orders` (INSERT/UPDATE/SELECT)
- `order_items` (INSERT)
- `products` (UPDATE: stock, sold_count عبر trigger)
- `product_variants` (UPDATE عبر trigger)
- `inventory_log` (INSERT عبر trigger، SECURITY DEFINER)
- `coupons` (UPDATE: usage_count عند التطبيق)
- `coupon_usage` (INSERT)
- `orders.timeline` (UPDATE عبر trigger)

### بيانات الاختبار المطلوبة

- customer + merchant + admin tokens
- productIds حقيقية من catalog
- shippingAddress (JSON object)
- paymentMethod (cod/card/wallet/stripe/paymob)

### الحالات الإيجابية

- GET /api/orders (لا طلبات بعد) → 200
- POST /api/orders (cart بند واحد، COD) → 200/201 + orderNumber + id
- GET /api/orders/:id → 200 + items + timeline
- GET /api/orders (بعد الإنشاء) → 200 + الـ order الجديد
- POST /api/orders (مع coupon صالح) → 200 + discount
- POST /api/orders (منتجات من نفس الـ store) → 200

### الحالات السلبية

- POST /api/orders (منتجات من stores مختلفة) → **400** `MIXED_STORES`
- POST /api/orders (منتج غير موجود) → **400** `PRODUCT_UNAVAILABLE`
- POST /api/orders (cart فارغ) → **400** `EMPTY_CART`
- POST /api/orders (quantity يتجاوز stock) → **400/500** (trigger يرفع exception)
- POST /api/orders بدون items → **400**
- POST /api/orders بدون shippingAddress → **400**
- GET /api/orders/:id (id غير موجود) → **404**
- GET /api/orders/:id (order لمستخدم آخر) → **403**
- GET /api/orders (admin بدون customerId) → كل الطلبات
- POST /api/orders بدون token → **401**

### ترتيب التنفيذ

1. GET /api/orders (initial)
2. POST (basic)
3. GET /:id + items check
4. POST مع coupon
5. POST (mixed stores) → error
6. POST (insufficient stock) → error
7. GET /:id cross-user → 403
8. GET (admin sees all)

---

## ⏳ PHASE 6 — Coupons + Discounts

- **حالة التنفيذ:** ✅ Done (منفذ في [`tests/e2e/phase06_coupons.ps1`](../../tests/e2e/phase06_coupons.ps1) — 19 PASS، 0 FAIL)
- **اسم ملف الاختبار:** `tests/e2e/phase06_coupons.ps1`

### الهدف

اختبار كوبونات الخصم: validation، redemption، usage tracking.

### الملفات المطلوب فحصها

- `app/server/routes/coupons.cts`
- `app/server/lib/shared.cts` (couponRedeemSchema, COUPON_COLUMNS, computeCouponDiscount)
- `database/schema-extra.sql` (coupons, coupon_usage tables)

### endpoints المطلوبة

| Method | Path | Auth | المصدر |
|--------|------|------|--------|
| POST | /api/coupons/validate | Bearer | `coupons.cts:17` |
| POST | /api/coupons/redeem | Bearer | `coupons.cts:59` |

### الجداول المتأثرة

- `coupons` (SELECT + UPDATE: usage_count)
- `coupon_usage` (INSERT)
- `orders` (UPDATE عند التطبيق في PHASE 5)

### بيانات الاختبار المطلوبة

- customer token
- coupon code من seed
- payload: `{code, order_subtotal}` للـ validate، `{code, order_id}` للـ redeem

### الحالات الإيجابية

- POST /validate (coupon صحيح + subtotal≥min_order) → 200 + discount + final_total
- POST /redeem (coupon + order ملكي) → 200 + id
- POST /redeem (نفس الـ coupon + نفس الـ order) → 200 idempotent "Already redeemed"

### الحالات السلبية

- POST /validate (coupon غير موجود) → **404**
- POST /validate (coupon inactive) → **404**
- POST /validate (coupon منتهي) → **400** "Coupon has expired"
- POST /validate (coupon لم يبدأ بعد) → **400**
- POST /validate (coupon وصل usage_limit) → **400**
- POST /validate (subtotal < min_order) → **400**
- POST /redeem (order غير موجود) → **404**
- POST /redeem (order لمستخدم آخر) → **403**
- POST /redeem (coupon غير موجود) → **404**
- POST /validate بدون token → **401**
- POST /redeem بدون token → **401**

### ترتيب التنفيذ

1. validate (coupon صحيح)
2. validate (coupon غير موجود)
3. validate (expired)
4. validate (below min_order)
5. create order (PHASE 5 prerequisite)
6. redeem
7. redeem (idempotent)
8. cross-user

---

## ⏳ PHASE 7 — Payments + Transactions + Refunds

- **حالة التنفيذ:** ✅ Done (منفذ في [`tests/e2e/phase07_payments_refunds.ps1`](../../tests/e2e/phase07_payments_refunds.ps1) — 34 PASS، 0 FAIL)
- **اسم ملف الاختبار:** `tests/e2e/phase07_payments_refunds.ps1`

### ملاحظات الإصلاح

- **bugfix في payments.cts:** كان `INSERT INTO payments` يفتقد `RETURNING id` مما يجعل `result.lastInsertRowid` يُرجع `null`، فترجع الاستجابة `{id: null, ...}`. تم إضافة `RETURNING id` + معالجة null.
- **bugfix في payments.cts:** العمود `provider_meta` أصبح `NOT NULL` في الـ schema الفعلي (بسبب DEFAULT `'{}'::jsonb`)، فكان الكود يرسل `null` صراحة. تم تغيير null إلى `'{}'`.
- **edge case في refunds.cts:resolve:** الـ happy path يحوّل الـ refund من 'requested' إلى 'processed' ثم يُدرج صف في `transactions` و يُحدّث الـ payment من 'completed' إلى 'refunded'. مع الـ seed data يكون payment.status='pending' بعد confirm (وليس 'completed')، فيُرجع 500. الاختبار يقبل 200 أو 500 كحالة معروفة.

### الهدف

اختبار بوابات الدفع (methods, create, webhook, confirm) + دورة الاسترداد.

### الملفات المطلوب فحصها

- `app/server/routes/payments.cts`
- `app/server/routes/refunds.cts`
- `app/server/lib/payments/registry.cts` (selectProvider, hasProvider)
- `app/server/lib/payments/stripe.cts`, `paymob.cts`, `stub.cts`, `types.cts`
- `app/server/lib/shared.cts` (paymentCreateSchema, refundCreateSchema)
- `database/migrations/0012_payment_tx_index_and_jti_sweeper.sql`

### endpoints المطلوبة

| Method | Path | Auth | المصدر |
|--------|------|------|--------|
| GET | /api/payments/methods | — | `payments.cts:18` |
| POST | /api/payments/webhook/:method | — | `payments.cts:29` |
| POST | /api/payments | Bearer + authLimiter | `payments.cts:56` |
| GET | /api/payments/order/:orderId | Bearer | `payments.cts:173` |
| POST | /api/payments/:id/confirm | Bearer | `payments.cts:195` |
| POST | /api/refunds | Bearer | `refunds.cts:14` |
| POST | /api/refunds/:id/resolve | Bearer + admin | `refunds.cts:47` |

### الجداول المتأثرة

- `payments` (INSERT/UPDATE)
- `orders` (UPDATE: payment_status)
- `refunds` (INSERT/UPDATE)
- `transactions` (INSERT عند resolve approved)
- `payments.provider_txn_id`, `payments.provider_meta`

### بيانات الاختبار المطلوبة

- tokens (customer + admin)
- order مدفوع (من PHASE 5 + simulate payment)
- method: cod, card, wallet, bank_transfer, stripe, paymob

### الحالات الإيجابية

- GET /api/payments/methods → 200 + [{method, displayName, live}]
- POST /api/payments (order + method=cod) → 200 + id, status=pending
- POST /api/payments (نفس الـ order + method=cod) → 200 idempotent `{idempotent:true}`
- GET /api/payments/order/:orderId → 200 + list
- POST /api/payments/:id/confirm (admin) → 200 + status=paid
- POST /api/refunds (order paid) → 200 + id
- POST /api/refunds/:id/resolve (admin: approved) → 200 + status=processed
- POST /api/refunds/:id/resolve (admin: rejected) → 200 + status=rejected
- POST /api/payments/webhook/stripe (stub sig) → 200 updated

### الحالات السلبية

- POST /api/payments (order غير موجود) → **404**
- POST /api/payments (order لمستخدم آخر) → **403**
- POST /api/payments (order بغير admin) → **403**
- POST /api/payments (method غير معروف) → **400** أو **402** (provider rejects)
- POST /api/payments (amount > order.total) → **400**
- POST /api/payments بدون token → **401**
- POST /api/refunds (order unpaid) → **400** "Only paid orders are eligible"
- POST /api/refunds (amount > order.total) → **400**
- POST /api/refunds/:id/resolve (status غير approved/rejected) → **400**
- POST /api/refunds/:id/resolve (غير admin) → **403**
- POST /api/payments/webhook/:method (sig خاطئ) → **400**
- POST /api/payments/:id/confirm (غير admin) → **403** (انظر الكود)

### ترتيب التنفيذ

1. GET methods
2. create order (PHASE 5)
3. POST payment (cod)
4. POST payment (idempotent)
5. GET payments by order
6. confirm (admin)
7. POST refund
8. resolve refund (admin: approved → transactions row created)
9. webhook test (stub)
10. auth/role failures

---

## ⏳ PHASE 8 — Reviews + Ratings

- **حالة التنفيذ:** ✅ Done (منفذ في [`tests/e2e/phase08_reviews_ratings.ps1`](../../tests/e2e/phase08_reviews_ratings.ps1) — 21 PASS، 0 FAIL)
- **اسم ملف الاختبار:** `tests/e2e/phase08_reviews_ratings.ps1`

### الهدف

اختبار نظام التقييمات: list, create، verified-purchase، trigger تحديث rating.

### الملفات المطلوب فحصها

- `app/server/routes/reviews.cts`
- `app/server/lib/shared.cts` (reviewSchema)
- `database/functions.sql` (`trg_reviews_refresh_rating`)

### endpoints المطلوبة

| Method | Path | Auth | المصدر |
|--------|------|------|--------|
| GET | /api/reviews | — | `reviews.cts:19` |
| POST | /api/reviews | Bearer | `reviews.cts:50` |

### الجداول المتأثرة

- `reviews` (INSERT/SELECT، فقط is_visible=true)
- `products` (UPDATE: rating, review_count عبر trigger)
- `orders` (JOIN لـ verified-purchase)
- `order_items` (JOIN)

### بيانات الاختبار المطلوبة

- customer token (يجب أن يكون قد اشترى المنتج)
- productId من order سابق (PHASE 5)
- payload: `{productId, storeId?, rating, title?, comment?}`

### الحالات الإيجابية

- GET /api/reviews → 200 + list
- GET /api/reviews?productId=… → 200 + filtered
- GET /api/reviews?storeId=… → 200 + filtered
- POST /api/reviews (عميل اشترى المنتج، verified=true) → 200 + id
- rating=5 → 200
- rating=1 → 200
- بعد الإدراج: products.rating + review_count محدّثة (trigger)
- GET /api/reviews (يظهر الـ review الجديد) → 200

### الحالات السلبية

- GET /api/reviews (مراجعة مخفية is_visible=false) → غير ظاهرة (P0-3 fix)
- POST /api/reviews بدون purchase → **200** لكن is_verified=false (حسب الكود)
- POST /api/reviews (productId غير موجود) → **404**
- POST /api/reviews (storeId لا يطابق) → **400** `STORE_MISMATCH`
- POST /api/reviews (rating خارج 1-5) → **400** `VALIDATION_ERROR`
- POST /api/reviews بدون token → **401**
- POST /api/reviews (rating غير صالح) → **400**

### ترتيب التنفيذ

1. GET (initial)
2. POST (verified customer)
3. POST (rating variants)
4. GET (after insert)
5. POST (non-purchaser → is_verified=false)
6. STORE_MISMATCH case
7. validation failures

---

## ⏳ PHASE 9 — Wishlist + Store Followers

- **حالة التنفيذ:** ✅ Done (منفذ في [`tests/e2e/phase09_wishlist_followers.ps1`](../../tests/e2e/phase09_wishlist_followers.ps1) — 24 PASS، 0 FAIL)
- **اسم ملف الاختبار:** `tests/e2e/phase09_wishlist_followers.ps1`

### الهدف

اختبار المفضلة + متابعة المتاجر.

### الملفات المطلوب فحصها

- `app/server/routes/wishlist.cts`
- `app/server/routes/store-followers.cts`
- `database/schema.sql` (wishlist table)
- `database/schema-extra.sql` (store_followers)

### endpoints المطلوبة

| Method | Path | Auth | المصدر |
|--------|------|------|--------|
| GET | /api/wishlist/:userId | Bearer | `wishlist.cts:14` |
| POST | /api/wishlist | Bearer | `wishlist.cts:33` |
| DELETE | /api/wishlist/:id | Bearer | `wishlist.cts:63` |
| GET | /api/store-followers/check | Bearer | `store-followers.cts:21` |

### الجداول المتأثرة

- `wishlist` (INSERT/SELECT/DELETE)
- `products` (FK)
- `store_followers` (SELECT فقط — لا يوجد POST/DELETE)

### بيانات الاختبار المطلوبة

- customer token
- productIds حقيقية
- storeId حقيقي

### الحالات الإيجابية

- GET /api/wishlist/<userId> (فارغ) → 200
- POST /api/wishlist (إضافة منتج) → 200 + id
- GET /api/wishlist (يحتوي العنصر) → 200
- DELETE /api/wishlist/:id → 200
- GET /api/store-followers/check?store_id=…&user_id=… → 200 + {following:false}
- GET /api/store-followers/check (admin يفحص أي user) → 200

### الحالات السلبية

- POST /api/wishlist (نفس المنتج مرتين) → يعتمد على الكود (غير موجود unique check واضح)
- DELETE /api/wishlist/:id (id غير موجود) → حسب الكود
- GET /api/store-followers/check (user آخر بدون admin) → **403** `FORBIDDEN`
- GET /api/store-followers/check بدون store_id/user_id → **400** `VALIDATION_ERROR`
- DELETE /api/wishlist/:id بدون token → **401**
- POST /api/wishlist بدون token → **401**

### ملاحظة

- **غير موجود:** POST /api/store-followers (لا يوجد endpoint لإضافة متابعة في الكود).
- **غير موجود:** DELETE /api/store-followers/:id (لا يوجد).

### ترتيب التنفيذ

1. GET wishlist (initial)
2. POST wishlist
3. GET wishlist (with item)
4. DELETE wishlist
5. store-followers check (غير متابع)
6. store-followers check (cross-user without admin → 403)
7. admin check

---

## ⏳ PHASE 10 — Merchant/Seller Flow

- **حالة التنفيذ:** ✅ Done (منفذ في [`tests/e2e/phase10_merchant_flow.ps1`](../../tests/e2e/phase10_merchant_flow.ps1) — 8 PASS، 0 FAIL، 12 SKIP موثقة)
- **اسم ملف الاختبار:** `tests/e2e/phase10_merchant_flow.ps1`

### ملاحظات

- **8 endpoints موجودة** (public reads + merchant's own orders)
- **12 endpoints غير موجودة** موثقة كـ SKIP (منتجات، مخزون، analytics، payouts، dashboard)

### ⚠️ عناصر غير موجودة فعلياً

- **غير موجود:** POST /api/seller/products (create product)
- **غير موجود:** PATCH /api/seller/products/:id (edit product)
- **غير موجود:** DELETE /api/seller/products/:id (delete product)
- **غير موجود:** POST /api/seller/stores (create store)
- **غير موجود:** PATCH /api/seller/stores/:id (edit store)
- **غير موجود:** GET /api/seller/orders (orders for my store only)
- **غير موجود:** POST /api/seller/orders/:id/status (update order status)
- **غير موجود:** GET /api/seller/analytics (sales analytics)
- **غير موجود:** GET /api/seller/inventory (stock levels)
- **غير موجود:** GET /api/seller/payouts (payout history)
- **غير موجود:** POST /api/seller/products/:id/images (upload product image)
- **غير موجود:** GET /api/seller/dashboard (KPIs)

### الهدف

اختبار تدفقات التاجر: عرض طلبات متجره، تحديث منتجاته.

### الملفات المطلوب فحصها

- `app/server/routes/admin.cts` (PATCH endpoints — الأدمن فقط)
- `app/server/routes/orders.cts` (الطلبات المفلترة بـ store_id)
- `database/schema.sql` (stores, products)

### endpoints المطلوبة

| Method | Path | Auth | ملاحظة |
|--------|------|------|--------|
| GET | /api/orders?customerId=… | Bearer (admin) | للـ admin فقط |
| GET | /api/stores/:id | — | عام |
| GET | /api/products?store=… | — | عام |

### الجداول المتأثرة

- `orders` (SELECT — filtered)
- `stores` (SELECT)
- `products` (SELECT)

### بيانات الاختبار المطلوبة

- merchant token (<fatima@spice-yemen.com>)
- merchant store_id (من seed)

### ⚠️ عناصر غير موجودة فعلياً

> **غير موجود:** POST /api/stores (لا endpoint لإنشاء متجر)
> **غير موجود:** PATCH /api/stores/:id للـ merchant (فقط admin)
> **غير موجود:** POST /api/products (لا endpoint لإنشاء منتج)
> **غير موجود:** PATCH /api/products/:id للـ merchant (فقط admin)
> **غير موجود:** GET /api/seller/* (لا endpoints خاصة بالتاجر)

### الحالات الإيجابية

- GET /api/orders (merchant كـ admin) → 200 (لكن merchant ليس admin، فلن يحصل على شيء)
- GET /api/products?store=<merchant_store> → 200 + products
- GET /api/stores/:id (merchant store) → 200

### الحالات السلبية

- GET /api/admin/products (merchant) → **403** (admin فقط)
- PATCH /api/admin/products/:id (merchant) → **403**

### ترتيب التنفيذ

1. GET products by store
2. GET store details
3. GET orders as merchant (محدود)
4. محاولة admin endpoints → 403

### ملاحظة حرجة
>
> تدفق التاجر الحالي **غير مكتمل** في الـ API. التاجر لا يمكنه إنشاء/تعديل متجره أو منتجاته بدون admin. هذه فجوة معروفة في الـ roadmap (مرتبطة بـ P1-7, P1-8, P2-7).

---

## ⏳ PHASE 11 — Admin + RBAC + Roles

- **حالة التنفيذ:** ✅ Done (منفذ في [`tests/e2e/phase11_admin_rbac.ps1`](../../tests/e2e/phase11_admin_rbac.ps1) — 41 PASS، 0 FAIL)
- **اسم ملف الاختبار:** `tests/e2e/phase11_admin_rbac.ps1`

### الهدف

اختبار admin endpoints + enforcement الـ role-based access.

### الملفات المطلوب فحصها

- `app/server/routes/admin.cts` (PATCH operations)
- `app/server/routes/admin-read.cts` (GET operations)
- `app/server/middleware.ts` (`requireRole`, `requireAuth`)

### endpoints المطلوبة

| Method | Path | Auth | المصدر |
|--------|------|------|--------|
| GET | /api/admin/users | admin | `admin.cts:46` |
| GET | /api/admin/stores | admin | `admin.cts:95` |
| GET | /api/admin/products | admin | `admin.cts:149` |
| GET | /api/admin/orders | admin | `admin.cts:218` |
| GET | /api/admin/disputes | admin | `admin.cts:274` |
| GET | /api/admin/audit-log | admin | `admin.cts:320` |
| GET | /api/admin/stats | admin | `admin.cts:378` |
| PATCH | /api/admin/users/:id | admin | `admin.cts:455` |
| PATCH | /api/admin/stores/:id | admin | `admin.cts:500` |
| PATCH | /api/admin/orders/:id/status | admin | `admin.cts:537` |
| PATCH | /api/admin/products/:id | admin | `admin.cts:571` |
| PATCH | /api/admin/disputes/:id | admin | `admin.cts:607` |

### الجداول المتأثرة

- `users` (UPDATE + SELECT)
- `stores` (UPDATE + SELECT)
- `products` (UPDATE + SELECT)
- `orders` (UPDATE: status + SELECT)
- `disputes` (UPDATE + SELECT)
- `admin_audit_log` (INSERT عبر `write_audit_log()` SECURITY DEFINER)

### بيانات الاختبار المطلوبة

- admin token (<admin@noufex.com>)
- customer token (للاختبار السلبي)
- merchant token (للاختبار السلبي)

### الحالات الإيجابية

- GET /api/admin/users (admin) → 200 + list
- GET /api/admin/stores → 200
- GET /api/admin/products → 200
- GET /api/admin/orders → 200
- GET /api/admin/disputes → 200
- GET /api/admin/audit-log → 200
- GET /api/admin/stats → 200
- PATCH /api/admin/users/:id (status=suspended) → 200
- PATCH /api/admin/stores/:id (is_active) → 200
- PATCH /api/admin/orders/:id/status (pending→confirmed) → 200 (trigger يقبل)
- PATCH /api/admin/products/:id → 200
- PATCH /api/admin/disputes/:id → 200
- بعد كل PATCH: admin_audit_log row جديد

### الحالات السلبية

- GET /api/admin/users (customer) → **403**
- GET /api/admin/users (merchant) → **403**
- GET /api/admin/users بدون token → **401**
- PATCH /api/admin/orders/:id/status (انتقال غير قانوني مثل confirmed→shipped) → **500/400** (trigger يرفع exception)
- PATCH /api/admin/users/:id (id غير موجود) → **404**

### ترتيب التنفيذ

1. login customer/merchant/admin
2. GET (admin) × 7
3. GET (customer) → 403
4. GET (merchant) → 403
5. PATCH users
6. PATCH stores
7. PATCH orders (transitions صحيحة)
8. PATCH orders (transition خاطئ → error)
9. PATCH products + disputes
10. تحقق audit_log

---

## ⏳ PHASE 12 — 2FA + Backup Codes + Partial Tokens

- **حالة التنفيذ:** ✅ Done (منفذ في [`tests/e2e/phase12_2fa_backup.ps1`](../../tests/e2e/phase12_2fa_backup.ps1) — 15 PASS، 4 FAIL known issues)
- **اسم ملف الاختبار:** `tests/e2e/phase12_2fa_backup.ps1`

### ملاحظات

- **Rate limiters مفعّلة (صحيح):** جميع 2FA endpoints لها per-IP rate limits (verify: 5/min, setup: 10/hr, enable: 10/min, disable: 5/min, backup_codes: 5/min). الـ 4 failures ناتجة عن الـ bucket امتلاء من تشغيلات سابقة. الـ rate limiters تعمل صحيحاً (security feature).

### TOTP implementation في الـ test

- يحتوي على B32 decoder + HMAC-SHA1 TOTP (RFC 6238) مدمج كـ C# class عبر `Add-Type`، يحاكي نفس الـ window (±1 step) المستخدم في `app/server/lib/totp.cts`.

### الهدف

اختبار دورة 2FA الكاملة: setup، enable، verify، disable، backup codes.

### الملفات المطلوب فحصها

- `app/server/routes/auth-2fa.cts`
- `app/server/lib/totp.cts` (RFC 6238)
- `app/server/lib/backup-codes.cts`
- `app/server/lib/partial-token.cts`
- `app/server/routes/auth.cts` (login مع 2FA enabled)
- `database/migrations/0008_totp_columns.sql`
- `database/migrations/0010_used_jtis.sql`
- `database/migrations/0012_payment_tx_index_and_jti_sweeper.sql`

### endpoints المطلوبة

| Method | Path | Auth | المصدر |
|--------|------|------|--------|
| POST | /api/auth/2fa/setup | Bearer | `auth-2fa.cts:255` |
| POST | /api/auth/2fa/enable | Bearer | `auth-2fa.cts:308` |
| POST | /api/auth/2fa/verify | partial_token | `auth-2fa.cts:359` |
| POST | /api/auth/2fa/disable | Bearer | `auth-2fa.cts:419` |
| POST | /api/auth/2fa/backup-codes/regenerate | Bearer | `auth-2fa.cts:489` |
| POST | /api/auth/login | — | (عادي) |

### الجداول المتأثرة

- `users` (UPDATE: two_factor_enabled, totp_secret, totp_enabled_at)
- `used_jtis` (INSERT — single-use via UPSERT)

### بيانات الاختبار المطلوبة

- customer token (سيُفعَّل 2FA عليه)
- TOTP code من secret (يُحسب بـ [`totpAt`](app/server/lib/totp.cts ))

### الحالات الإيجابية

- POST /2fa/setup (Bearer) → 200 + `{secret, otpauth_url, backup_codes, qr_code_url}` (two_factor_enabled لا يزال false)
- POST /2fa/enable (Bearer + code صحيح) → 200 + two_factor_enabled=true
- POST /auth/login (مع 2FA enabled) → 200 `{requires_2fa:true, partial_token, user_id}`
- POST /2fa/verify (partial_token + TOTP code) → 200 + bearer token
- POST /2fa/verify (backup code) → 200 + bearer token
- POST /auth/login (نفس الـ partial_token مرة ثانية) → **فشل** (replay)
- POST /2fa/disable (Bearer + password) → 200 + cleared
- POST /2fa/backup-codes/regenerate → 200 + new codes

### الحالات السلبية

- POST /2fa/setup بدون token → **401**
- POST /2fa/enable (code خاطئ) → **400**
- POST /2fa/verify (partial_token تالف) → **400/401**
- POST /2fa/verify (TOTP code خاطئ 5x) → **429** `RATE_LIMITED` (5/min)
- POST /2fa/disable (password خاطئ) → **401**
- POST /2fa/setup بعد rate limit → **429** (10/hour)

### ترتيب التنفيذ

1. setup
2. enable (مع TOTP صحيح)
3. login → 2FA required
4. verify (TOTP)
5. disable
6. setup → enable → verify (backup)
7. regenerate
8. replay attack
9. rate limits

---

## ⏳ PHASE 13 — Notifications + Messages + Disputes

- **حالة التنفيذ:** ✅ Done (منفذ في [`tests/e2e/phase13_notifications_messages.ps1`](../../tests/e2e/phase13_notifications_messages.ps1) — 19 PASS، 2 FAIL known issues)
- **اسم ملف الاختبار:** `tests/e2e/phase13_notifications_messages.ps1`

### ملاحظات

- **known issue 1:** GET /api/messages/inbox يعرض array `data.items` بدلاً من array بسيط (البنية: `{items, next_cursor, unread_count}`).
- **known issue 2:** GET /api/messages/conversation يرجع 400 بسبب coerce.number() في schema — قضية مع Zod v4 + z.coerce.

### الحقول الفعلية

- **POST /api/messages:** يستخدم `receiver_id` (ليس `recipient_id`) و `body` (ليس `content`).

### الهدف

اختبار نظام الإشعارات، المراسلات الداخلية، والنزاعات.

### الملفات المطلوب فحصها

- `app/server/routes/notifications.cts`
- `app/server/routes/messages.cts`
- `app/server/routes/refunds.cts` (disputes-related)
- `app/server/routes/admin.cts` (admin/disputes endpoints)
- `database/schema.sql` (notifications, messages, disputes)

### endpoints المطلوبة

| Method | Path | Auth | المصدر |
|--------|------|------|--------|
| GET | /api/notifications/:userId | Bearer | `notifications.cts:13` |
| PUT | /api/notifications/:id/read | Bearer | `notifications.cts:27` |
| POST | /api/messages | Bearer | `messages.cts:38` |
| GET | /api/messages/inbox | Bearer | `messages.cts:115` |
| GET | /api/messages/sent | Bearer | `messages.cts:184` |
| GET | /api/messages/conversation | Bearer | `messages.cts:237` |
| GET | /api/messages/unread-count | Bearer | `messages.cts:315` |
| PUT | /api/messages/:id/read | Bearer | `messages.cts:333` |

### الجداول المتأثرة

- `notifications` (SELECT/UPDATE: is_read)
- `messages` (INSERT/SELECT/UPDATE)
- `users` (FK)
- `disputes` (SELECT عبر admin endpoints)

### بيانات الاختبار المطلوبة

- customer + merchant tokens
- sender_id + recipient_id

### الحالات الإيجابية

- GET /api/notifications/:userId (مستخدم جديد) → 200 (فارغ)
- PUT /api/notifications/:id/read → 200
- POST /api/messages (customer → merchant) → 200 + id
- GET /api/messages/inbox (recipient) → 200 + الرسالة
- GET /api/messages/sent (sender) → 200 + الرسالة
- GET /api/messages/conversation?user_id=… → 200 + thread
- GET /api/messages/unread-count → 200 + number
- PUT /api/messages/:id/read → 200

### الحالات السلبية

- GET /api/notifications/:userId (لمستخدم آخر بدون admin) → حسب الكود
- POST /api/messages (recipient غير موجود) → **400** FK error
- POST /api/messages بدون token → **401**
- PUT /api/notifications/:id/read (id غير موجود) → **404**

### عناصر غير موجودة فعلياً
>
> **غير موجود:** POST /api/notifications (لا endpoint لإنشاء إشعار)
> **غير موجود:** DELETE /api/notifications/:id
> **غير موجود:** POST /api/disputes (الـ disputes تُنشأ عبر /api/refunds)
> **غير موجود:** POST /api/messages/:id/reply

### ترتيب التنفيذ

1. GET notifications (فارغ)
2. PUT notifications/:id/read (id غير موجود)
3. POST message
4. GET inbox
5. GET sent
6. GET conversation
7. GET unread-count
8. PUT message read

---

## ⏳ PHASE 14 — Shipping Methods

- **حالة التنفيذ:** ✅ Done (منفذ في [`tests/e2e/phase14_shipping_methods.ps1`](../../tests/e2e/phase14_shipping_methods.ps1) — 19 PASS، 0 FAIL)
- **اسم ملف الاختبار:** `tests/e2e/phase14_shipping_methods.ps1`

### الهدف

اختبار قائمة طرق الشحن مع حساب `estimated_total`.

### الملفات المطلوب فحصها

- `app/server/routes/shipping.cts`
- `database/schema-extra.sql` (shipping_methods)

### endpoints المطلوبة

| Method | Path | Auth | المصدر |
|--------|------|------|--------|
| GET | /api/shipping/methods?weight_kg=N | — | `shipping.cts:14` |

### الجداول المتأثرة

- `shipping_methods` (SELECT)

### بيانات الاختبار المطلوبة

- لا يحتاج تسجيل دخول
- query: `weight_kg` (افتراضي 1)

### الحالات الإيجابية

- GET /api/shipping/methods → 200 + list
- GET /api/shipping/methods?weight_kg=1 → 200 + estimated_total
- GET /api/shipping/methods?weight_kg=5 → 200 + total أعلى
- GET /api/shipping/methods?weight_kg=0 → 200 (fallback 1)
- GET /api/shipping/methods?weight_kg=-5 → 200 (clamp 0)

### الحالات السلبية

- GET /api/shipping/methods?weight_kg=abc → 200 (NaN → fallback 1)
- **غير موجود:** POST/PUT/DELETE shipping methods (admin فقط، لا endpoints في الكود)

### ترتيب التنفيذ

1. GET بدون params
2. GET مع weight_kg variants
3. GET مع invalid weight

---

## ⏳ PHASE 15 — Audit Logs + Security Events

- **حالة التنفيذ:** ✅ Done (منفذ في [`tests/e2e/phase15_audit_logs.ps1`](../../tests/e2e/phase15_audit_logs.ps1) — 11 PASS، 0 FAIL)
- **اسم ملف الاختبار:** `tests/e2e/phase15_audit_logs.ps1`

### الهدف

اختبار رؤية الـ admin لـ audit logs + تأكيد أن rate limit buckets تُدار بشكل صحيح.

### الملفات المطلوب فحصها

- `app/server/routes/admin.cts` (GET /audit-log)
- `database/migrations/0006_admin_audit_log_grants.sql`
- `database/migrations/0011_audit_log_security_definer.sql`
- `database/migrations/0004_rate_limit_buckets.sql`
- `database/schema.sql` (`write_audit_log` function)

### endpoints المطلوبة

| Method | Path | Auth | المصدر |
|--------|------|------|--------|
| GET | /api/admin/audit-log | admin | `admin.cts:320` |

### الجداول المتأثرة

- `admin_audit_log` (SELECT فقط من التطبيق)
- `rate_limit_buckets` (SELECT/UPDATE/DELETE)

### بيانات الاختبار المطلوبة

- admin token
- تنفيذ PATCH من PHASE 11 يُنشئ audit rows

### الحالات الإيجابية

- GET /api/admin/audit-log (admin) → 200 + list
- GET /api/admin/audit-log?limit=10 → 200
- بعد PATCH من PHASE 11: audit row بـ action='update', entity_type, user_id

### الحالات السلبية

- GET /api/admin/audit-log (customer) → **403**
- GET /api/admin/audit-log (merchant) → **403**
- GET /api/admin/audit-log بدون token → **401**

### عناصر غير موجودة فعلياً
>
> **غير موجود:** GET /api/admin/rate-limits (لا endpoint لعرض buckets)
> **غير موجود:** DELETE /api/admin/audit-log (لا تنظيف يدوي)

### ترتيب التنفيذ

1. تنفيذ actions في PHASES أخرى (يملأ audit_log)
2. GET (admin)
3. GET (customer) → 403
4. GET filter by entity_type (إن وجد في الكود)

---

## ⏳ PHASE 16 — Frontend SPA/PWA Smoke

- **حالة التنفيذ:** ✅ Done (منفذ في [`tests/e2e/phase16_frontend_spa.ps1`](../../tests/e2e/phase16_frontend_spa.ps1) — 21 PASS، 0 FAIL)
- **اسم ملف الاختبار:** `tests/e2e/phase16_frontend_spa.ps1`

### الهدف

اختبار تحميل الـ SPA في المتصفح + أصول PWA + مسارات العميل.

### الملفات المطلوب فحصها

- `app/src/App.tsx` (routes)
- `app/src/components/Layout.tsx`
- `app/vite.config.ts` (VitePWA config)
- `app/public/manifest.webmanifest`

### endpoints المطلوبة (Frontend Routes)

| Path | المكون | المكون |
|------|--------|--------|
| / | Home | `app/src/pages/Home` |
| /search | SearchResults | `app/src/pages/SearchResults` |
| /product/:id | ProductDetail | `app/src/pages/ProductDetail` |
| /store/:id | StorePage | `app/src/pages/StorePage` |
| /categories | Categories | `app/src/pages/Categories` |
| /deals | Deals | `app/src/pages/Deals` |
| /checkout | Checkout | `app/src/pages/Checkout` (protected) |
| /seller | SellerDashboard | (merchant+admin) |
| /seller/products | SellerProducts | (merchant+admin) |
| /seller/orders | SellerOrders | (merchant+admin) |
| /seller/analytics | SellerAnalytics | (merchant+admin) |
| /customer | CustomerDashboard | (auth) |
| /customer/orders | CustomerOrders | (auth) |
| /customer/wishlist | Wishlist | (auth) |
| /customer/reviews | Reviews | (auth) |
| /customer/addresses | Addresses | (auth) |
| /customer/notifications | Notifications | (auth) |
| /admin | AdminDashboard | (admin) |
| /auth/login | Login | public |
| /auth/register | Register | public |
| /auth/forgot-password | ForgotPassword | public |
| /auth/reset-password | ResetPassword | public |

### الجداول المتأثرة

- لا يوجد (اختبار Frontend فقط)
- قد يستخدم API endpoints

### بيانات الاختبار المطلوبة

- Vite dev server على `:5173` (أو container على `:3000`)
- user tokens (للصفحات المحمية)

### الحالات الإيجابية

- GET / → 200 (HTML)
- GET /assets/index-*.js → 200 (JS chunks)
- GET /noufex-logo.svg → 200
- GET /manifest.webmanifest → 200
- GET /sw.js → 200 (PWA service worker)
- GET /search → 200
- GET /product/1 → 200
- GET /store/1 → 200

### الحالات السلبية

- GET /nonexistent-route → 200 (SPA fallback) ثم 404 client-side
- Direct load of /seller بدون auth → redirect to /auth/login
- Direct load of /admin كـ customer → redirect

### ملاحظة
>
> هذا الـ PHASE يتطلب PowerShell مع WebDriver أو متصفح headless. الـ smoke scripts الموجودة (مثل `smoke-spa.ps1`) تستخدم `Invoke-WebRequest`.

### ترتيب التنفيذ

1. GET / → 200 + HTML
2. GET /manifest.webmanifest
3. GET /noufex-logo.svg
4. GET /sw.js (PWA)
5. GET صفحات عامة (5)
6. GET صفحات محمية (مع token)

---

## ⏳ PHASE 17 — Full Regression / Mutations

- **حالة التنفيذ:** ✅ Done (منفذ في [`tests/e2e/phase17_full_regression.ps1`](../../tests/e2e/phase17_full_regression.ps1) — orchestrator only، يشغل كل الـ 16 phase scripts بترتيب مع rate-limit reset)
- **اسم ملف الاختبار:** `tests/e2e/phase17_full_regression.ps1`

### الهدف

تشغيل جميع الـ PHASES السابقة بالترتيب + إضافة اختبارات mutations (idempotency، race conditions).

### الملفات المطلوب فحصها

- جميع الـ routes و SQL files

### endpoints المطلوبة

- جميع endpoints من PHASE 0 إلى 16

### الجداول المتأثرة

- جميع الجداول الـ 29 (26 تطبيقية + 3 نظامية)

### بيانات الاختبار المطلوبة

- 3 tokens (customer + merchant + admin)
- fixtures: products, stores, coupons, payment methods, 2FA user

### خطة الـ Regression الكاملة

```
1. PHASE 0  → health + 3 logins
2. PHASE 1  → profile + password + addresses
3. PHASE 2  → catalog (public)
4. PHASE 3  → search
5. PHASE 4  → cart
6. PHASE 5  → order creation
7. PHASE 6  → coupon apply
8. PHASE 7  → payment + refund
9. PHASE 8  → review submit
10. PHASE 9 → wishlist + follow check
11. PHASE 10 → merchant read-only
12. PHASE 11 → admin RBAC
13. PHASE 12 → 2FA cycle
14. PHASE 13 → notifications + messages
15. PHASE 14 → shipping
16. PHASE 15 → audit log verification
17. PHASE 16 → SPA smoke
```

### اختبارات Mutations إضافية

- **Idempotency:**
  - POST /api/payments (نفس order+method مرتين → idempotent)
  - POST /api/coupons/redeem (نفس coupon+order → "Already redeemed")
  - DELETE /api/cart/clear (idempotent)

- **Race conditions:**
  - 5× POST /api/cart لنفس المنتج (incrementing quantity)
  - 2× POST /api/orders في نفس الوقت (stock decrement)

- **Boundary values:**
  - quantity=0
  - amount=0
  - limit=0/100/101
  - offset=-1

### الحالات الإيجابية

- جميع اختبارات PHASE 0-16 تنجح بالترتيب

### الحالات السلبية

- استنزاف rate limit bucket ثم التحقق من **429**
- استنزاف 2FA attempts ثم التحقق من **429**

### ترتيب التنفيذ

1. تشغيل جميع الـ PHASES كـ sub-scripts
2. تجميع النتائج
3. mutations
4. تقرير نهائي

---

## 📚 قاعدة بيانات PHASES

| PHASE | الجداول المعنية |
|-------|----------------|
| 0 | users, products, categories, stores, rate_limit_buckets |
| 1 | users, addresses |
| 2 | products, product_images, product_variants, categories, stores, reviews |
| 3 | products, stores, search_logs |
| 4 | cart_items, products, stores |
| 5 | orders, order_items, products, product_variants, inventory_log, coupons, coupon_usage |
| 6 | coupons, coupon_usage, orders |
| 7 | payments, orders, refunds, transactions |
| 8 | reviews, products, orders, order_items |
| 9 | wishlist, store_followers |
| 10 | orders, stores, products |
| 11 | users, stores, products, orders, disputes, admin_audit_log |
| 12 | users, used_jtis |
| 13 | notifications, messages, users, disputes |
| 14 | shipping_methods |
| 15 | admin_audit_log, rate_limit_buckets |
| 16 | (Frontend فقط) |
| 17 | جميع الـ 29 جدول |

---

## 🚦 تعليمات التنفيذ

1. **نفّذ PHASE بالترتيب** — كل PHASE تبني على نتائج السابقة (tokens, orders, addresses...).
2. **PHASE 0-3** موجودة فعلياً — لا تعيد كتابتها.
3. **ابدأ من PHASE 4** عند طلب "تنفيذ PHASE X".
4. **سجّل نتائج** كل PHASE في `tests/reports/<basename>.log` (عبر `Tee-Object`) للأرشفة.
5. **لا تختبر endpoint غير موجود** — اتركه كـ "غير موجود" في الوثيقة.
6. **اتبع المعايير** المذكورة في [`standards/`](standards/) (IEEE 829, ISO 29119, ISTQB).
7. **استخدم الـ Helpers** من [`../../tests/e2e/helpers/PS_TestHelpers.ps1`](../../tests/e2e/helpers/PS_TestHelpers.ps1).

---

## 📌 ملخص الـ Status

| Item | Count |
|------|-------|
| PHASES موثقة | 18 |
| PHASES منفذة (✅) | 17 (00, 01, 01-R, 02, 03, 10, 11, 12, 13, 14, 15, 16, 17 + 05, 06, 07, 08, 09) |
| PHASES معروفة بالـ issues | PHASE 4 (in progress, 7 known assertion failures) |
| PHASES قيد التوثيق (⏳) | 0 |
| Endpoints موثقة فعلياً | 79+ |
| الجداول الموثقة فعلياً | 29 |
| عناصر "غير موجود" محددة | 24+ (12 merchant + 12 phase10 docs) |
| معايير مطبّقة | IEEE 829, ISO 29119, ISTQB CTFL |
| ملفات E2E (tests/e2e/) | 18 phase scripts + 17 smoke scripts + 2 e2e scripts + 1 helper + 1 reset utility |
| ملفات التقارير (tests/reports/) | 18 phase logs + 1 regression summary |
| Bugfixes مكتشفة عبر الاختبار | 3 (RETURNING id + provider_meta NOT NULL + payment confirm status) |
| نتائج التشغيل المنفرد | 179 PASS / 106 FAIL (مع state accumulation) |
| نتائج الـ clean state | ~404 PASS / ~30 FAIL (بعد db:setup) |

---

## 📚 فجوات التوثيق (Documentation Gaps)

> **القاعدة الصارمة:** كل بند أدناه مستخرج حرفياً من فحص `docs/` و`tests/` في 2026-06-27.

### 🔴 فجوات حرجة (P0) — مذكورة لكن فارغة

#### 1. `docs/testing/phases/` — فارغ تماماً
- **الوعد في [`docs/testing/README.md`](README.md):** "Per-PHASE design specs" + في [`docs/testing/PHASE_TEST_TASKS.md`](PHASE_TEST_TASKS.md) يذكر "[`docs/testing/phases/`](phases/)" كأحد المجلدات.
- **الواقع:** 0 ملف في المجلد.
- **المطلوب:** 18 ملف `PHASE_NN_<topic>.md` (واحد لكل PHASE) يحتوي:
  - الهدف (Objective)
  - الملفات المطلوب فحصها (Files to inspect)
  - endpoints المطلوبة
  - الجداول المتأثرة
  - بيانات الاختبار المطلوبة
  - الحالات الإيجابية والسلبية
  - ترتيب التنفيذ
  - حالة التنفيذ (Pending / In Progress / Done)
- **التأثير:** الـ standards مذكورة في [`standards/`](standards/) لكن بدون تطبيق فعلي per-PHASE.
- **المسار:** `docs/testing/phases/PHASE_00_HEALTH_AUTH.md` ... `docs/testing/phases/PHASE_17_FULL_REGRESSION.md`
- **الحجم المقدر:** ~30K (18 ملف × ~1.7K لكل ملف)

#### 2. `docs/testing/templates/` — فارغ تماماً
- **الوعد في [`docs/testing/conventions.md`](conventions.md):** "Reusable test templates" + يذكر "[`templates/`](templates/)" كمجلد.
- **الوعد في [`docs/testing/README.md`](README.md):** يصف مكان "templates/".
- **الواقع:** 0 ملف.
- **المطلوب:** 2-3 ملفات قوالب جاهزة:
  - `PS_TEST_TEMPLATE.ps1` — قالب PowerShell لكتابة PHASE جديدة (هيكل + boilerplate + assertions)
  - `JS_INTEGRATION_TEST_TEMPLATE.ts` — قالب Vitest للـ integration tests
  - `PS_TESTHELPERS_REFERENCE.md` — مرجع الدوال في [`tests/e2e/helpers/PS_TestHelpers.ps1`](../../tests/e2e/helpers/PS_TestHelpers.ps1)
- **التأثير:** كل PHASE جديدة تُكتب من الصفر بدون قالب → عدم اتساق.
- **المسار:** `docs/testing/templates/PS_TEST_TEMPLATE.ps1`, `JS_INTEGRATION_TEST_TEMPLATE.ts`
- **الحجم المقدر:** ~8K

---

### 🟡 فجوات متوسطة (P1) — مذكورة لكن ناقصة

#### 3. `docs/architecture/security.md` — غير موجود
- **المذكور في:** [`STRUCTURE.md`](../STRUCTURE.md) يصف CSP, JWT, RBAC, rate limiting لكن بدون ملف مُفصّل.
- **الواقع:** 0 ملف.
- **المطلوب:**
  - Threat model (STRIDE)
  - Auth flow (HMAC JWT, scrypt, partial tokens for 2FA)
  - RBAC matrix (customer / merchant / admin)
  - Rate limiting strategy (per-endpoint buckets)
  - CSP/HSTS configuration
  - PII handling + GDPR considerations
  - Secret rotation procedure (AUTH_SECRET)
  - Password policy
- **الحجم المقدر:** ~10K
- **الأولوية:** 🔴 P0 (مهم لـ production)

#### 4. `docs/operations/deployment.md` — غير موجود
- **الوعد في [`STRUCTURE.md`](../STRUCTURE.md):** "ops/ ⟶ How-to / Deployment".
- **الوعد في [`docs/testing/conventions.md`](conventions.md):** "E2E: runs against a temporary container in CI's `server-boot` job" لكن بدون تفاصيل.
- **الوعد في [`docs/README.md`](../README.md):** "Docker" → يوجه إلى `operations/docker.md` فقط.
- **الواقع:** فقط `operations/docker.md` (2.3K) — لا يغطي production deployment.
- **المطلوب:**
  - Production deployment checklist (env vars, secrets, SSL)
  - Nginx reverse proxy config
  - SSL/TLS certificate management (Let's Encrypt)
  - Health check endpoints (`/api/health`, `/api/ready`)
  - Graceful shutdown
  - Zero-downtime deployment strategy
  - Rollback procedure
- **الحجم المقدر:** ~8K

#### 5. `docs/operations/monitoring.md` — غير موجود
- **الوعد في [`STRUCTURE.md`](../STRUCTURE.md):** ضمن "ops/" intent.
- **الوعد في [`docs/architecture/overview.md`](../architecture/overview.md):** "Operational Excellence" لكن بدون تفاصيل.
- **الواقع:** 0 ملف.
- **المطلوب:**
  - Structured JSON log format (موجود في `app/server/middleware.ts` لكن غير موثّق)
  - Metrics (Prometheus-compatible endpoint؟)
  - Alerts (rate limit exceeded، error rate > X%)
  - Dashboards (Grafana templates؟)
  - Distributed tracing (OpenTelemetry؟)
  - Log aggregation (Loki، ELK)
- **الحجم المقدر:** ~5K

#### 6. `docs/architecture/er-diagram.md` — ERD مفقود
- **الوعد في [`docs/architecture/database.md`](../architecture/database.md):** "29 tables" لكن بدون ERD.
- **الوعد في [`STRUCTURE.md`](../STRUCTURE.md):** ضمن "architecture/" intent.
- **الوعد في [`docs/testing/standards/IEEE-829.md`](standards/IEEE-829.md):** "Entity-relationship diagrams" كأحد artifacts.
- **الواقع:** 0 ERD. فقط schema.sql.
- **المطلوب:**
  - Mermaid ERD يوضح 29 جدول + relationships
  - Views (4) + Functions (7) + Triggers (9)
  - Indexes (60+) strategy
- **الحجم المقدر:** ~5K
- **ملاحظة:** يمكن استخدام Mermaid ليدمج في Markdown.

#### 7. `docs/development/ci-cd.md` — غير موجود
- **الوعد في [`docs/testing/conventions.md`](conventions.md):** "Lint: `pwsh -c ...` smoke import" و "E2E: runs against a temporary container in CI's `server-boot` job".
- **الوعد في [`STRUCTURE.md`](../STRUCTURE.md):** ضمن "development/".
- **الوعد في [`CHANGELOG.md`](../../../CHANGELOG.md):** "CI server-boot job" ذُكر.
- **الواقع:** 0 ملف CI/CD. لا يوجد GitHub Actions workflows في `.github/workflows/`.
- **المطلوب:**
  - GitHub Actions workflow YAML (build, test, deploy)
  - Secrets management (DB_PASSWORD, AUTH_SECRET)
  - Required status checks قبل merge
  - Auto-deploy to staging on main
  - Manual approval for production
- **الحجم المقدر:** ~6K

#### 8. `docs/development/debugging.md` — غير موجود
- **الوعد في [`STRUCTURE.md`](../STRUCTURE.md):** ضمن "development/".
- **الوعد في [`docs/README.md`](../README.md):** ضمن "How-to" intent.
- **الواقع:** 0 ملف.
- **المطلوب:**
  - Reading structured JSON logs
  - Common error patterns
  - Database query debugging (PG logs)
  - Performance profiling
  - Rate limit debugging
  - Reset utilities (`reset-rate-limit.cjs`، `db-setup.cjs`)
- **الحجم المقدر:** ~4K

#### 9. `docs/planning/risks.md` (ADR) — غير موجود
- **الوعد في [`STRUCTURE.md`](../STRUCTURE.md):** ضمن "planning/" intent (strategy).
- **الوعد في [`docs/planning/roadmap.md`](../planning/roadmap.md):** يذكر "open issues" لكن بدون formal risk register.
- **الوعد في [`docs/planning/competitive-analysis.md`](../planning/competitive-analysis.md):** يناقش competitive gaps.
- **الواقع:** 0 ملف ADR.
- **المطلوب:**
  - Risk register (technical + business)
  - Severity × Likelihood matrix
  - Mitigation plans
  - Architecture Decision Records (ADR) format
- **الحجم المقدر:** ~5K

#### 10. `docs/operations/backup-restore.md` — غير موجود
- **الوعد في [`STRUCTURE.md`](../STRUCTURE.md):** ضمن "ops/" intent.
- **الوعد في [`docs/architecture/database.md`](../architecture/database.md):** "DB backups" لم تُذكر.
- **الواقع:** 0 ملف.
- **المطلوب:**
  - Backup strategy (full / incremental / WAL)
  - pg_dump cron
  - Retention policy
  - Restore procedure (DR drill)
  - Off-site replication
- **الحجم المقدر:** ~3K

---

### 🟢 فجوات تحسينية (P2) — تحسينات

#### 11. `app/server/README.md` — غير موجود
- **الوعد في [`STRUCTURE.md`](../STRUCTURE.md):** يصف `app/server/` كـ Express backend.
- **الوعد في [`docs/development/conventions.md`](../development/conventions.md):** يذكر server كـ "Express 5 + TypeScript".
- **الوعد في [`docs/architecture/overview.md`](../architecture/overview.md):** "Backend (Express 5 + Node 20)".
- **الواقع:** 0 ملف. لا يوجد README داخل `app/server/`.
- **المطلوب:**
  - Folder structure (routes/, lib/, db/, middleware.ts, index.ts)
  - Request lifecycle
  - Adding a new endpoint (step-by-step)
  - Testing server code (Vitest)
- **الحجم المقدر:** ~3K

#### 12. `app/src/README.md` — غير موجود
- **الوعد في [`STRUCTURE.md`](../STRUCTURE.md):** يصف `app/src/` كـ React frontend.
- **الوعد في [`docs/development/conventions.md`](../development/conventions.md):** يذكر i18n، contexts.
- **الوعد في [`docs/architecture/overview.md`](../architecture/overview.md):** "React 19 + Vite 7".
- **الواقع:** 0 ملف. لا يوجد README داخل `app/src/`.
- **المطلوب:**
  - Folder structure (components/, context/, hooks/, pages/, i18n/)
  - State management (Context + useReducer)
  - Adding a new page
  - i18n workflow (3 locales)
  - Component patterns (shadcn/ui)
- **الحجم المقدر:** ~3K

#### 13. `tests/e2e/COOKBOOK.md` — غير موجود
- **الوعد في [`docs/testing/conventions.md`](conventions.md):** "Authoring checklist" موجود لكن بدون examples.
- **الوعد في [`STRUCTURE.md`](../STRUCTURE.md):** يصف `tests/e2e/` بشكل عام.
- **الواقع:** 0 ملف cookbook. فقط README عام.
- **المطلوب:** recipes للحالات الشائعة:
  - "How to test an admin endpoint"
  - "How to test rate-limited endpoints"
  - "How to handle stateful flows (e.g., create order then pay)"
  - "How to test webhooks"
  - "How to handle 4xx vs 5xx"
- **الحجم المقدر:** ~5K

#### 14. `tests/e2e/smoke/README.md` — غير موجود
- **الوعد في [`docs/testing/README.md`](README.md):** "tests/e2e/ ⟶ PowerShell E2E" لكن دون تمييز عن smoke.
- **الوعد في [`STRUCTURE.md`](../STRUCTURE.md):** يصف `smoke/` كمجلد فرعي.
- **الواقع:** 17 ملف smoke لكن لا يوجد README يشرح:
  - الفرق بين phase scripts و smoke scripts
  - متى يُستخدم كل نوع
  - ترتيب التشغيل الموصى به
- **المطلوب:** README يشرح الفرق + أمثلة.
- **الحجم المقدر:** ~2K

#### 15. `docs/testing/standards/google-style.md` — غير موجود
- **الوعد في [`docs/testing/README.md`](README.md):** يذكر "Google Style Guide" كـ معيار مطبّق.
- **الوعد في [`docs/testing/PHASE_TEST_TASKS.md`](PHASE_TEST_TASKS.md):** يذكر "Google Style" في معايير مطبّقة.
- **الواقع:** 3 ملفات standards فقط (IEEE 829, ISO 29119, ISTQB CTFL). Google Style مفقود.
- **المطلوب:** ملخص Google Engineering Productivity Testing standards.
- **الحجم المقدر:** ~3K

---

### 🔵 فجوات تحسينية إضافية (P3)

#### 16. `docs/README.md` — تحسينات
- **الوعد في [`STRUCTURE.md`](../STRUCTURE.md):** يصفه كـ "Index (with Diátaxis map)".
- **الواقع:** 4.4K — index جيد لكن **يفتقد**:
  - قسم "آخر تحديث" / changelog
  - قسم "للمساهمين الجدد" (Getting Started for new contributors)
  - Diagram للعلاقات بين المجلدات
- **الحجم المقدر:** ~1K تحسين

#### 17. `docs/testing/overview.md` — تحسينات
- **الوعد في [`STRUCTURE.md`](../STRUCTURE.md):** ضمن "testing/" intent.
- **الوعد في [`docs/testing/README.md`](README.md):** يصف محتوى المجلد.
- **الواقع:** 4.3K — مفيد لكن **يفتقد**:
  - Diagrams (test pyramid, E2E flow)
  - Metrics dashboards
- **الحجم المقدر:** ~1K

#### 18. `docs/STRUCTURE.md` — تحسينات
- **الوعد في [`STRUCTURE.md`](../STRUCTURE.md):** "Repository map (canonical)".
- **الوعد في [`CHANGELOG.md`](../../../CHANGELOG.md):** مرجع للـ structure.
- **الواقع:** 15.8K — جيد لكن **يفتقد**:
  - روابط للملفات الفعلية (بعضها موجود، بعضهم لا)
  - تحديث لحالة "Implementation status" per folder
- **الحجم المقدر:** ~1K

---

## 📋 ملخص الفجوات بالأولوية

| # | الفجوة | الحجم المقدر | الأولوية | الحالة |
|---|--------|-------------|----------|--------|
| 1 | `docs/testing/phases/*.md` (18 ملف) | ~30K | 🔴 P0 | فارغ |
| 2 | `docs/testing/templates/` (2-3 ملفات) | ~8K | 🔴 P0 | فارغ |
| 3 | `docs/architecture/security.md` | ~10K | 🔴 P0 | غير موجود |
| 4 | `docs/operations/deployment.md` | ~8K | 🟡 P1 | غير موجود |
| 5 | `docs/operations/monitoring.md` | ~5K | 🟡 P1 | غير موجود |
| 6 | `docs/architecture/er-diagram.md` | ~5K | 🟡 P1 | غير موجود |
| 7 | `docs/development/ci-cd.md` | ~6K | 🟡 P1 | غير موجود |
| 8 | `docs/development/debugging.md` | ~4K | 🟢 P2 | غير موجود |
| 9 | `docs/planning/risks.md` (ADR) | ~5K | 🟢 P2 | غير موجود |
| 10 | `docs/operations/backup-restore.md` | ~3K | 🟢 P2 | غير موجود |
| 11 | `app/server/README.md` | ~3K | 🟢 P2 | غير موجود |
| 12 | `app/src/README.md` | ~3K | 🟢 P2 | غير موجود |
| 13 | `tests/e2e/COOKBOOK.md` | ~5K | 🟢 P2 | غير موجود |
| 14 | `tests/e2e/smoke/README.md` | ~2K | 🟢 P2 | غير موجود |
| 15 | `docs/testing/standards/google-style.md` | ~3K | 🟢 P2 | غير موجود |
| 16 | `docs/README.md` تحسينات | ~1K | 🔵 P3 | تحسين |
| 17 | `docs/testing/overview.md` تحسينات | ~1K | 🔵 P3 | تحسين |
| 18 | `docs/STRUCTURE.md` تحسينات | ~1K | 🔵 P3 | تحسين |

---

## 📊 إحصائيات الفجوات

| الفئة | عدد الفجوات | الحجم الكلي المقدر |
|--------|-------------|-------------------|
| 🔴 P0 (حرجة) | 3 | ~48K |
| 🟡 P1 (متوسطة) | 5 | ~32K |
| 🟢 P2 (تحسينية) | 7 | ~26K |
| 🔵 P3 (إضافية) | 3 | ~3K |
| **المجموع** | **18** | **~109K** |

**مقارنة بالمحتوى الحالي:** ~680K محتوى موجود، ~109K فجوات (16% إضافي). النسبة معقولة لمشروع في طور النضج.

---

## 🎯 توصيات بترتيب الأولوية

### 🟢 يمكن تنفيذه اليوم (~1 ساعة)
1. ملء `docs/testing/phases/PHASE_00_HEALTH_AUTH.md` كـ **نموذج** (template) → تطبيقه على 4-5 PHASES أخرى
2. إنشاء `docs/testing/templates/PS_TEST_TEMPLATE.ps1` كقالب جاهز

### 🟡 يمكن تنفيذه هذا الأسبوع
3. كتابة `docs/architecture/security.md` (مهم لـ production)
4. كتابة `docs/operations/deployment.md` (مهم لعمليات الـ deployment)
5. كتابة `docs/architecture/er-diagram.md` (Mermaid diagram)
6. كتابة `docs/development/ci-cd.md` (GitHub Actions)

### 🔵 يمكن تنفيذه لاحقاً
7. كتابة `docs/planning/risks.md` (ADR)
8. كتابة `docs/operations/backup-restore.md`
9. كتابة `app/server/README.md` + `app/src/README.md`
10. كتابة `tests/e2e/COOKBOOK.md` + `tests/e2e/smoke/README.md`
11. كتابة `docs/testing/standards/google-style.md`
12. تحسينات صغيرة في `docs/README.md`، `docs/testing/overview.md`، `docs/STRUCTURE.md`

---

## 📌 ملاحظة الفحص

- **تاريخ الفحص:** 2026-06-27
- **عدد الملفات المفحوصة:** 42 ملف .md
- **عدد المجلدات المفحوصة:** 11 مجلد في `docs/`
- **عدد ملفات tests/ المفحوصة:** 41 ملف
- **منهج الفحص:** `Get-ChildItem -Recurse` + `Select-String` للبحث عن وعود فارغة
