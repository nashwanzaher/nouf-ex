# Noufex

> **منصة تجارة إلكترونية B2B/B2C** موجهة لليمن والشرق الأوسط، مستوحاة من Alibaba/Taobao.
> **B2B/B2C e-commerce marketplace** for Yemen & the Middle East, inspired by Alibaba/Taobao.
> React + Vite + Express + PostgreSQL 17، monorepo بـ npm workspaces + Turbo.

[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Changelog](https://img.shields.io/badge/keep--a--changelog-1.1.0-blue)](CHANGELOG.md)
[![Code of Conduct](https://img.shields.io/badge/contributor--covenant-3.0-purple)](.github/CODE_OF_CONDUCT.md)
[![Conventional Commits](https://img.shields.io/badge/conventional--commits-1.0.0-blue)](https://www.conventionalcommits.org/)
[![Diátaxis](https://img.shields.io/badge/Di%C3%A1taxis-compliant-purple)](https://diataxis.fr/)

**[📖 الوثائق الكاملة →](ARCHITECTURE.md)** · [المساهمة →](.github/CONTRIBUTING.md) · [الأمان →](.github/SECURITY.md) · [سجل التغييرات →](CHANGELOG.md)

---

## 🎯 الفكرة | Vision

منصة تجارة إلكترونية على طراز **Alibaba/Taobao** مصممة خصيصاً للسوق اليمني والشرق أوسط، مع:

A **Taobao-inspired** e-commerce platform designed for the Yemeni & Middle Eastern market, featuring:

- 🌐 **دعم ثلاثي اللغات:** العربية (RTL افتراضي)، الإنجليزية، الصينية
- 💰 **عملة محلية:** الريال اليمني (YER) كعملة افتراضية
- 🏪 **نظام متعدد المتاجر** (B2B/B2C)
- 🔐 **مصادقة آمنة:** HttpOnly cookies + scrypt + TOTP 2FA
- 📱 **PWA:** قابل للتثبيت كتطبيق ويب تقدمي
- 🤖 **أدوات ذكاء اصطناعي:** MCP server + Docker MCP Gateway

---

## 🏗️ البنية التقنية

| الطبقة | التقنية | الإصدار |
|---|---|---|
| **قاعدة البيانات** | PostgreSQL | 17 |
| **Backend API** | Node.js + Express | 20.x / 5.2.1 |
| **Driver** | `pg` (node-postgres) | 8.22.0 |
| **Hashing** | scrypt (Node built-in) | — |
| **JWT** | HMAC-SHA256 (Node built-in) | — |
| **Validation** | Zod | 4.3.5 |
| **Frontend** | React + Vite | 19.2 / 7.2.4 |
| **Routing** | React Router | 7.6.1 |
| **Styling** | Tailwind CSS | 3.4.19 |
| **i18n** | i18next | 26.3.1 |
| **UI Components** | shadcn/ui (Radix) | latest |
| **PWA** | vite-plugin-pwa + Workbox | 1.3.0 |
| **Charts** | recharts | 2.15.4 |
| **Animation** | framer-motion + gsap | 12.40 / 3.15 |
| **Container** | Docker (node:20.19-alpine + tini) | — |
| **Tests** | Vitest + Supertest + axe-core | 4.1.9 |

---

## 📁 بنية المشروع (Monorepo)

```
nouf-ex/
├── apps/                       # 4 تطبيقات قابلة للنشر
│   ├── web/      @noufex/web         # React 19 + Vite 7 SPA
│   ├── api/      @noufex/api         # Express 5 REST API
│   ├── mcp-server/ @noufex/mcp-server # MCP server (stdio)
│   └── e2e/      @noufex/e2e         # PowerShell E2E scripts
│
├── packages/                   # 4 مكتبات مشتركة
│   ├── db/        @noufex/db         # 7 SQL files + 30 migrations
│   ├── shared/    @noufex/shared     # types + constants
│   ├── typescript-config/            # tsconfig presets
│   └── eslint-config/                # eslint presets
│
├── docker/
│   └── mcp-gateway/            # Docker MCP Gateway catalog
│
├── docs/                       # MkDocs documentation
├── scripts/                    # admin scripts
├── logs/                       # audit-dlq dead-letter queue
│
├── package.json                # workspaces + lint-staged + husky
├── turbo.json                  # 6-task pipeline
├── Dockerfile                  # 4-stage multi-stage build
└── docker-compose.yml          # service: noufex on :3000
```

---

## 🚀 التشغيل السريع

### المتطلبات الأساسية:
- **Node.js** ≥ 20.18.0
- **npm** ≥ 10.0.0
- **PostgreSQL** 17 (مستقل أو في Docker)
- **Docker** + **Docker Compose** (اختياري، موصى به)

### خطوة 1: إعداد البيئة
```sh
git clone <repo-url> nouf-ex
cd nouf-ex
cp .env.example .env
```

عدّل ملف `.env` وعبئ كلمات المرور الخاصة بك:
```env
DB_PASSWORD=<كلمة-مرور-قوية>
AUTH_SECRET=<سر-عشوائي-32-حرف>
POSTGRES_PASSWORD=<كلمة-مرور-superuser>
```

### خطوة 2: تثبيت الحزم
```sh
npm install
```
هذا يثبت كل الحزم لكل workspaces عبر npm workspaces.

### خطوة 3: إعداد قاعدة البيانات
```sh
npm run db:setup
```
هذا يطبق:
- `packages/db/schema.sql` (الجداول الأساسية)
- `packages/db/schema-extra.sql` (الجداول الإضافية)
- `packages/db/functions.sql` (PL/pgSQL functions)
- `packages/db/triggers.sql` (triggers)
- `packages/db/views.sql` (views)
- `packages/db/roles.sql` (الأدوار + GRANTs)
- `packages/db/seed.sql` (بيانات تجريبية)
- `packages/db/migrations/0001..0030/*.sql`

### خطوة 4: تشغيل التطبيق

#### الخيار A: بـ Docker (موصى به)
```sh
docker compose up -d --build
```
- يبني 4-stage Dockerfile
- يعرض API + SPA على `:3000`
- healthcheck تلقائي على `/api/health`

→ افتح `http://localhost:3000`

#### الخيار B: بدون Docker (للتطوير)
في terminal واحد:
```sh
cd apps/api
npm run api
# Express يستمع على :3000
```

في terminal آخر:
```sh
cd apps/web
npm run dev
# Vite يستمع على :8080 مع proxy /api/* → :3000
```

→ افتح `http://localhost:8080`

---

## 🔌 المنافذ (Ports)

| المنفذ | الاستخدام | البيئة |
|---|---|---|
| **3000** | Express API + SPA (production) | dev + prod |
| **8080** | Vite dev server | dev only |
| **5432** | PostgreSQL 17 | dev + prod |
| **8811** | Docker MCP Gateway (SSE) | dev + prod |
| **stdio** | MCP server (stdio transport) | dev + prod |

---

## 🗄️ قاعدة البيانات

### الجداول الـ 32 (موزعة على 7 ملفات SQL + 30 migration):

**المستخدمون (5):** `users`, `subscriptions`, `rate_limit_buckets`, `used_jtis`, `admin_audit_log`

**المتاجر والمنتجات (8):** `stores`, `categories`, `products`, `product_variants`, `product_images`, `inventory_log`, `store_balance`, `store_followers`

**الطلبات والمدفوعات (6):** `orders`, `order_items`, `cart_items`, `payments`, `transactions`, `shipping_methods`, `refunds`

**التفاعل والمراجعات (5):** `reviews`, `wishlist`, `notifications`, `messages`, `disputes`, `addresses`

**العروض (2):** `coupons`, `coupon_usage`

**النظام (2):** `app_settings`, `search_logs`, `webhook_events`

### الأدوار (Roles):
- **`postgres`** — superuser (لا يستخدمه التطبيق أبداً)
- **`noufex_owner`** — DDL owner (migrations + setup فقط)
- **`noufex_app`** — least-privilege للتطبيق
- **`noufex_readonly`** — BI/reporting فقط

### PL/pgSQL Functions (8):
1. `trg_set_updated_at()` — تحديث تلقائي للـ `updated_at`
2. `trg_orders_state_machine()` — يفرض transitions صالحة
3. `trg_orders_append_timeline()` — يسجل تغييرات الحالة
4. `trg_order_items_decrement_stock()` — ينقص المخزون + يدون في `inventory_log`
5. `trg_reviews_refresh_rating()` — يُحدّث rating تلقائياً
6. `trg_products_refresh_store_count()` — يُحدّث عداد المنتجات
7. `trg_refunds_resolve_payments()` — يزامن الـ refund مع payment
8. `trg_stores_refresh_review_stats()` و `refresh_followers_count` و `refresh_sales_count`

---

## 🔐 المصادقة والأمان

### Auth Flow:

```
[Client]                       [Express API :3000]              [PostgreSQL]
   │                                   │                              │
   │──POST /api/auth/login ──────────→ │                              │
   │                                   │──SELECT users WHERE email ──→│
   │                                   │←───── user row ─────────────│
   │                                   │ verifyPassword(scrypt)       │
   │                                   │                              │
   │  if two_factor_enabled:           │                              │
   │  ←─ {requires_2fa, partial_token}─│                              │
   │                                   │                              │
   │──POST /api/auth/2fa/verify ─────→ │                              │
   │                                   │ verifyTotp                   │
   │                                   │                              │
   │  else:                            │                              │
   │  ←─ Set-Cookie: noufex_token=... ─│ signAuthToken(HMAC-SHA256)    │
   │                                   │                              │
   │──GET /api/cart ─────────────────→ │ requireAuth middleware       │
   │   (Cookie تلقائي)                 │ verifyAuthToken              │
   │                                   │──SELECT token_version ──────→│
   │                                   │   (cached 30s)               │
   │   ←─ 200 {cart}                   │ req.user = {id, role}        │
```

### Auth Security Features:

- **HttpOnly cookies** — `noufex_token` غير قابل للوصول من JavaScript (XSS protection)
- **SameSite=Strict** — CSRF protection
- **Secure flag** في production — HTTPS فقط
- **HMAC-SHA256 JWT** — `base64url(payload).base64url(hmac)`
- **7 أيام TTL** للـ token
- **30 ثانية cache** لـ `token_version` + `role` lookup
- **Bumping `token_version`** عند logout/change-password → يبطل كل الـ tokens دفعة واحدة
- **Dummy scrypt hash** عند login failure — للحماية من timing attacks
- **TOTP 2FA** اختياري (RFC 6238، ±30s tolerance)
- **Backup codes** للـ 2FA recovery

### Password Policy:
- طول 10..128 حرف (NIST 800-63B)
- على الأقل 3 من: lower, upper, digit, symbol
- رفض: 4+ chars متكررة، 4+ متتالية، كلمات شائعة
- لا يساوي local-part من email

### Security Headers:
- **CSP** مع per-request nonce (16 bytes base64url)
- **HSTS** في production: `max-age=31536000; includeSubDomains; preload`
- **X-Frame-Options: DENY**
- **Permissions-Policy** موسّعة (32 capability denied)
- **X-Content-Type-Options: nosniff**
- **Referrer-Policy: strict-origin-when-cross-origin**

### Rate Limiting:
- **DB-backed limiter** عبر `consume_rate_limit()` PL/pgSQL function
- **Auth endpoints:** 20 hits / 15min / IP
- **Health endpoints:** 30 hits / 1s / IP (in-memory)
- **Catalog/stats/shipping:** cache TTL على الـ responses (60s/30s/300s)

---

## 🛣️ API Reference (مختصر)

### 18 Router تحت `/api/*`:

| المسار | الوصف | Cache | عدد الـ routes |
|---|---|---|---|
| `/api/admin` | Admin endpoints | — | 12 endpoints |
| `/api/auth` | Authentication | — | 8 endpoints |
| `/api/auth/2fa` | 2FA endpoints | — | 4 endpoints |
| `/api/orders` | Order management | — | 3 endpoints |
| `/api/cart` | Shopping cart | — | 5 endpoints |
| `/api/wishlist` | User wishlist | — | 3 endpoints |
| `/api/notifications` | User notifications | — | 3 endpoints |
| `/api/messages` | Customer ↔ Merchant chat | — | 6 endpoints |
| `/api/seller` | Seller dashboard | — | 18 endpoints |
| `/api/payments` | Payment processing | — | 4 endpoints + webhook |
| `/api/coupons` | Coupon management | — | 2 endpoints |
| `/api/refunds` | Refund requests | — | 2 endpoints |
| `/api/reviews` | Product reviews | — | 2 endpoints |
| `/api/addresses` | User addresses | — | 4 endpoints |
| `/api/store-followers` | Store follows | — | 3 endpoints |
| `/api/shipping` | Shipping methods | 300s | 1 endpoint |
| `/api/stats` | Statistics (homepage) | 30s | 1 endpoint |
| `/api` (catalog) | Products/Stores/Categories/Search | 60s | 10 endpoints |

### Health & Ready:
- `GET /api/health` — liveness probe (no DB check)
- `GET /api/ready` — readiness probe (DB check with 2s timeout)

### Response Envelope (موحد):
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message",
  "request_id": "uuid-v4"
}
```

### Error Envelope:
```json
{
  "success": false,
  "error": "Human-readable message",
  "code": "STABLE_MACHINE_CODE",
  "details": [ /* Zod issues etc. */ ],
  "request_id": "uuid-v4"
}
```

### Stable Error Codes:
`VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `DUPLICATE`, `PAYLOAD_TOO_LARGE`, `UNPROCESSABLE_ENTITY`, `RATE_LIMITED`, `INTERNAL_ERROR`, `DATABASE_ERROR`, `SERVICE_UNAVAILABLE`, `INSERT_FAILED`, `UPDATE_FAILED`, `DELETE_FAILED`, `ALREADY_ENABLED`, `NOT_ENABLED`, `PARTIAL_INVALID`

---

## 🎨 الواجهة الأمامية (apps/web)

### 33 صفحة مقسّمة بـ `lazy()` loading:

**Public (8):** `/`, `/search`, `/product/:id`, `/store/:id`, `/categories`, `/deals`, `/checkout`, `/messages`

**Auth (4):** `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password`

**Customer (11):** `/customer`, `/customer/orders`, `/customer/orders/:id`, `/customer/profile`, `/customer/wallet`, `/customer/coupons`, `/customer/help`, `/customer/wishlist`, `/customer/reviews`, `/customer/addresses`, `/customer/notifications`

**Seller (6):** `/seller`, `/seller/products`, `/seller/products/new`, `/seller/orders`, `/seller/analytics`, `/seller/onboarding`

**Admin (8):** `/admin/overview`, `/admin/users`, `/admin/stores`, `/admin/disputes`, `/admin/reports`, `/admin/audit-log`, `/admin/all-products`, `/admin/all-orders`

### 12 Feature Modules:
`auth`, `products`, `cart`, `checkout`, `orders`, `home`, `customer`, `seller`, `admin`, `messages`, `shipping`, `coupons`

### Providers (الترتيب مهم):
```tsx
<AppProvider>          {/* lang, dir, user, toasts */}
  <CartProvider>       {/* cart + server sync */}
    <Layout>           {/* Navbar + BottomNav + Footer */}
      <ErrorBoundary>
        <Suspense>
          <Routes>...</Routes>
        </Suspense>
      </ErrorBoundary>
    </Layout>
  </CartProvider>
</AppProvider>
```

### Build Optimizations:
- **Code splitting** per route (33 chunks)
- **Manual chunks:** `react`, `recharts`, `framer-motion`, `gsap`, `radix-ui`
- **Tree-shaking** للـ `lucide-react` (icons only)
- **PWA** مع Workbox (HTML not cached — CSP nonce)
- **chunkSizeWarningLimit: 800** KB

---

## 🐳 Docker

### Dockerfile (4 stages):

| Stage | Base | Output |
|---|---|---|
| 1. `deps` | node:20.19-alpine | `/build/node_modules` |
| 2. `api-build` | node:20.19-alpine | `apps/api/dist/index.js` (esbuild ESM) |
| 3. `web-build` | node:20.19-alpine | `apps/web/dist/` (vite) |
| 4. `runtime` | node:20.19-alpine + tini | الصورة النهائية |

### docker-compose.yml:
- `noufex` service → `:3000`
- `healthcheck` كل 30s
- `extra_hosts: host.docker.internal:host-gateway` (Linux)
- Resources limit: 512MB RAM, 1.0 CPU

---

## 🤖 AI Tooling (MCP)

### MCP Server (`apps/mcp-server/`):

**18 أداة MCP عبر 4 عائلات (stdio transport):**

**`db_*` — 9 أدوات (`db-tools.ts`):**
- `db_stats` — counts: tables, views, functions, triggers, size
- `db_list_tables` — كل الجداول مع row counts و size
- `db_describe_table` — columns + types + constraints + indexes + FKs
- `db_list_views` — كل الـ views مع definitions
- `db_list_functions` — كل PL/pgSQL functions
- `db_list_triggers` — كل الـ triggers مع table و function
- `db_get_migrations` — migrations المطبّقة
- `db_sample_rows` — عينة من صفوف الجدول
- `db_query` — SQL مخصص (read-only افتراضياً)

**`code_*` — 3 أدوات (`code-tools.ts`):**
- `code_tree` — شجرة الملفات
- `code_read_file` — قراءة ملف (مع line numbers)
- `code_search` — regex search مع glob filters

**`api_*` — 3 أدوات (`api-tools.ts`):**
- `api_list_endpoints` — كل Express routes (مع auth detection)
- `api_get_endpoint` — تفاصيل endpoint + source excerpt
- `api_search` — بحث في المسارات

**`docs_*` — 3 أدوات (`docs-tools.ts`):**
- `docs_list` — قائمة ملفات `.md`
- `docs_read` — قراءة ملف doc
- `docs_search` — regex search في docs

### Docker MCP Gateway:
- يستمع على `:8811` (SSE)
- Bearer token authentication
- `/health` endpoint
- `catalog.yaml` يحدد 5 tools أساسية + 2 resources + 2 prompts
- mount الـ repo على `/repo` (read-only)
- يستقبل `DATABASE_URL` من host `.env`

---

## 🧪 الاختبارات

### Test Stack:
- **Vitest** 4.1.9 — test runner
- **Supertest** 7.2.2 — HTTP integration tests
- **axe-core** + **vitest-axe** — accessibility tests
- **happy-dom** — DOM environment
- **msw** — mock service worker

### السكربتات:
```sh
npm test                    # جميع workspaces
cd apps/api && npm test     # اختبارات الـ API
cd apps/web && npm test     # اختبارات الواجهة
cd apps/web && npm run test:a11y  # اختبارات الوصولية فقط
cd apps/web && npm run test:coverage  # مع coverage
```

---

## 📚 الوثائق

| الدليل | الموقع |
|---|---|
| **البنية المعمارية الكاملة** | [ARCHITECTURE.md](ARCHITECTURE.md) |
| **MkDocs (diataxis-compliant)** | [docs/README.md](docs/README.md) |
| **دليل المساهمة** | [.github/CONTRIBUTING.md](.github/CONTRIBUTING.md) |
| **سياسة الأمان** | [.github/SECURITY.md](.github/SECURITY.md) |
| **سجل التغييرات** | [CHANGELOG.md](CHANGELOG.md) |
| **قانون السلوك** | [.github/CODE_OF_CONDUCT.md](.github/CODE_OF_CONDUCT.md) |

---

## 🔧 الأوامر المتاحة

### من الجذر:
```sh
npm run dev         # تشغيل كل التطبيقات بالتوازي
npm run build       # بناء كل workspaces
npm run typecheck   # type-check كل workspaces
npm run lint        # eslint على كل workspaces
npm test            # تشغيل الاختبارات
npm run clean       # تنظيف dist/ و node_modules/.tmp
```

### apps/api:
```sh
npm run dev         # tsx src/index.ts (development)
npm run start       # NODE_ENV=production tsx src/index.ts
npm run build       # esbuild → apps/api/dist/index.js
```

### apps/web:
```sh
npm run dev         # vite (development)
npm run build       # tsc -b && vite build
npm run preview     # vite preview
```

---

## 🛡️ الأمان

- **كل كلمات المرور** يجب أن تكون ≥10 أحرف مع 3 فئات أحرف على الأقل
- **`AUTH_SECRET`** يجب أن يكون ≥32 حرف عشوائي:
  ```sh
  node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
  ```
- **DB password** يجب تغييرها من `CHANGE_ME_APP` الافتراضي
- **HTTPS** إلزامي في production (HSTS preload)
- **CSP nonce** لكل request (لا inline scripts بدون nonce)

---

## 📄 الترخيص

[MIT](LICENSE) — انظر الملف للنص الكامل.

---

## 🤝 المساهمة

نرحب بالمساهمات! اقرأ [CONTRIBUTING.md](.github/CONTRIBUTING.md) و [CODE_OF_CONDUCT.md](.github/CODE_OF_CONDUCT.md) قبل البدء.

Conventional Commits مطلوبة لكل commit. release-please يتولى versioning تلقائياً.

---

## 📊 إحصائيات المشروع

| القياس | العدد |
|---|---|
| التطبيقات (apps) | 4 |
| الحزم المشتركة (packages) | 4 |
| جداول قاعدة البيانات | **32** |
| PL/pgSQL Functions | ~14 (8 في functions.sql + 6 في migrations) |
| **Triggers** | **32** (17 dynamic updated_at + 15 explicit) |
| Views | 4 |
| **API routers** | **18** |
| **API endpoints** | **~60+** |
| lib utilities | 15 |
| **MCP tools** | **18** (4 عائلات) |
| **MCP catalog tools** | **5** (db_query, db_schema, code_search, api_routes, docs_search) |
| Notification channels | 3 (in_app, email, sms) |
| Notification event triggers | 8 |
| **Frontend pages** | **47** (8 public + 5 auth + 12 customer + 7 seller + 15 admin) |
| **Frontend custom hooks** | **30+** |
| **Backend tests (Vitest)** | **31** |
| **Frontend tests (Vitest)** | **38** |
| **E2E phase scripts** | **18** |
| **Agent skills** | **20** |
| **Agent definitions** | **12** |
| Payment providers | 4 (stripe, paymob, stub, offline) |
| صفحات الواجهة | 33 |
| Features modules | 12 |
| Migrations | 30 |
| Seed users | 10 |
| Seed stores | 7 |
| Seed products | 24 |
| Seed orders | 8 |
| Seed coupons | 4 |
| Seed categories | 18 (7 رئيسية + 11 فرعية) |
| Seed reviews | 10 |
| Seed transactions | 8 (wallet ledger) |

---

<!-- Schema.org structured data -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Noufex",
  "alternateName": "noufex",
  "description": "B2B/B2C e-commerce marketplace platform for Yemen and the Middle East. Multi-vendor with Arabic/English/Chinese support, local payment methods, and AI tools.",
  "url": "https://github.com/nashwanzaher/nouf-ex",
  "applicationCategory": "BusinessApplication",
  "applicationSubCategory": "E-commerce Marketplace",
  "operatingSystem": "Cross-platform (Node.js 20.18+, PostgreSQL 17)",
  "softwareRequirements": "Node.js ^20.19.0 || >=22.12.0, npm >= 10.0.0, PostgreSQL 17",
  "programmingLanguage": ["TypeScript", "SQL", "PL/pgSQL"],
  "runtimePlatform": ["Node.js", "Vite", "Express"],
  "license": "https://github.com/nashwanzaher/nouf-ex/blob/main/LICENSE",
  "inLanguage": ["ar", "en", "zh"]
}
</script>
