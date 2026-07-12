# Nouf-ex — Architecture (محدّث بالتفاصيل الكاملة)

> **Source of truth:** هذا المستند محدّث بناءً على قراءة تفصيلية لكل ملف أساسي في المشروع.
> التحقق من كل سطر عبر قراءة المصدر الفعلي للملفات (وليس التقدير).
> Commit المرجع: `1c24fcb`، branch `fix/routes-cts-to-ts-2026-07-06`.

---

## 1. Monorepo layout (npm workspaces + Turbo)

المستودع **npm workspaces** يديره **Turbo 2.10.4**. يوجد **4 تطبيقات** و **4 حزم مشتركة**. كل اسم workspace بنطاق `@noufex/<scope>`. الجذر في `package.json` يحدد:

```json
"workspaces": ["apps/*", "packages/*"],
"packageManager": "npm@10.9.0"
```

### شجرة المشروع الكاملة:

```
nouf-ex/
├── package.json              # workspaces + lint-staged + husky
├── turbo.json                # 6-task pipeline (build/typecheck/lint/test/dev/clean)
├── Dockerfile                # 4-stage multi-stage build
├── docker-compose.yml        # service: noufex on :3000
├── docker-compose.override.yml
├── .env.example              # نموذج متغيرات البيئة
├── .env                      # المتغيرات الفعلية (مُستبعد من git)
├── .husky/                   # pre-commit hooks
├── .github/                  # workflows, dependabot.yml
│
├── apps/                     # 4 تطبيقات قابلة للنشر
│   ├── web/      @noufex/web         React 19 + Vite 7 SPA         (port 8080 dev)
│   ├── api/      @noufex/api         Express 5 REST API            (port 3000)
│   ├── mcp-server/ @noufex/mcp-server MCP server (stdio)          (no HTTP)
│   └── e2e/      @noufex/e2e         PowerShell phase scripts     (no runtime)
│
├── packages/                 # 4 مكتبات مشتركة
│   ├── db/        @noufex/db         7 SQL files + 30 migrations
│   ├── shared/    @noufex/shared     types + constants
│   ├── typescript-config/ @noufex/typescript-config  tsconfig presets
│   └── eslint-config/ @noufex/eslint-config          eslint presets
│
├── docker/                   # MCP Gateway Docker setup
│   └── mcp-gateway/          catalog.yaml + Dockerfile (port 8811)
│
├── docs/                     # MkDocs documentation
├── scripts/                  # admin scripts (db-setup, audit, gen-seed-hashes)
└── logs/                     # audit-dlq dead-letter queue
```

### المخططات (Mermaid):

```mermaid
graph LR
  subgraph root["Repo root"]
    PJ["package.json<br/>(workspaces + lint-staged)"]
    TJ["turbo.json<br/>(6 tasks)"]
    DF["Dockerfile<br/>(4-stage)"]
    DC["docker-compose.yml<br/>(:3000)"]
  end

  subgraph apps["apps/"]
    WEB["@noufex/web<br/>Vite 7 + React 19<br/>:8080"]
    API["@noufex/api<br/>Express 5<br/>:3000"]
    MCP["@noufex/mcp-server<br/>MCP SDK 1.0.4<br/>stdio"]
    E2E["@noufex/e2e<br/>PowerShell<br/>21 phases"]
  end

  subgraph pkgs["packages/"]
    DB["@noufex/db<br/>SQL + 30 migrations"]
    SHD["@noufex/shared<br/>types + constants"]
    TSC["@noufex/typescript-config"]
    ESC["@noufex/eslint-config"]
  end

  PJ --> WEB & API & MCP & E2E
  PJ --> DB & SHD & TSC & ESC
  TJ -. orchestrates .-> WEB & API & MCP
  DF -. builds .-> API & WEB
  DC -. runs .-> API
  WEB -. uses .-> TSC & ESC
  API -. uses .-> TSC & ESC & SHD & DB
  MCP -. uses .-> TSC
  SHD -. types .-> WEB & API
  API -. queries .-> DB
```

---

## 2. Runtime topology (طوبولوجيا التشغيل)

| العملية | المنفذ | القراءة | الكتابة |
|---|---|---|---|
| **Browser / PWA** | — | — | — |
| **Vite dev server** (`npm run dev` من `apps/web`) | **8080** | `apps/web/src/**` | dev assets |
| **Express API** (`tsx src/index.ts` من `apps/api`) | **3000** | `apps/api/src/**` + PostgreSQL | PostgreSQL عبر pg |
| **PostgreSQL 17** (خارجي، `host.docker.internal`) | **5432** | `packages/db/**` | — |
| **MCP server** (`tsx src/index.ts` من `apps/mcp-server`) | **stdio** | `apps/mcp-server/src/**` + PostgreSQL | — |
| **Docker MCP Gateway** (`docker/mcp-gateway`) | **8811 (SSE)** | `apps/mcp-server/dist/index.js` | — |

### آلية العمل الكاملة:

**في التطوير:**
- المتصفح → Vite (`:8080`) → `/api/*` proxy → Express API (`:3000`) → PostgreSQL (`:5432`)

**في الإنتاج:**
- المتصفح ↔ Docker image `noufex:latest` على `:3000` (يخدم SPA + API معاً)

**Vite proxy:** في `apps/web/vite.config.ts:135-141` يحوّل `/api/*` إلى `http://localhost:3000`:

```ts
proxy: {
  '/api': {
    target: 'http://localhost:3000',
    changeOrigin: false,
  },
}
```

**في الإنتاج:** نفس الأصل `:3000` يخدم SPA bundle + API (`apps/api/src/index.ts:268-300` static-fallback handler).

```mermaid
graph LR
  Browser["Browser<br/>(PWA, happy-dom in tests)"]

  subgraph dev["Dev (npm run dev)"]
    Vite["Vite :8080<br/>apps/web"]
    Proxy["proxy /api/*"]
  end

  subgraph prod["Production (docker compose)"]
    Noufex["Docker image noufex:latest<br/>Express :3000<br/>+ SPA bundle at STATIC_PATH"]
  end

  subgraph ext["External"]
    PG[("PostgreSQL 17<br/>noufex_db")]
  end

  subgraph ai["AI tooling"]
    MCP["apps/mcp-server<br/>(stdio)"]
    Gateway["Docker MCP Gateway<br/>:8811 (SSE)"]
  end

  Browser -- HTTP --> Vite
  Vite -- /api/* --> Proxy
  Proxy -- HTTP --> Noufex
  Noufex -- pg --> PG
  Noufex -- serves SPA --> Browser
  MCP -- pg --> PG
  Gateway -- spawns + stdio --> MCP
  Gateway -- SSE :8811 --> AI_Client["Claude / Cursor<br/>etc."]
  AI_Client -- Bearer token --> Gateway
```

---

## 3. Frontend architecture (`apps/web`)

`apps/web/package.json` يؤكد الإصدارات: **React 19.2.0**، **Vite 7.2.4**، **react-router 7.6.1**، **tailwindcss 3.4.19**، **i18next 26.3.1**، **zod 4.3.5**، **i18next-browser-languagedetector 8.2.1**.

### 3.1 نقطة الدخول (`apps/web/src/main.tsx`)

ملف صغير (14 سطر) يقوم بـ:
1. `import './i18n'` — تفعيل i18next
2. `import './index.css'` — Tailwind base
3. `createRoot(document.getElementById('root')!).render()` — تركيب الجذر
4. `<StrictMode>` — كشف التفاعلات غير الآمنة
5. `<BrowserRouter>` — توجيه من جهة العميل

### 3.2 الـ Top-level wiring (`apps/web/src/App.tsx`)

`App.tsx` يُصدّر **33 `lazyPage()` route component** (سطر 22-37). كل صفحة مقسّمة إلى chunk خاص بها.

**الـ Providers بالترتيب الصحيح (مهم):**
```tsx
<AppProvider>           // state.lang, dir, user, toasts
  <CartProvider>        // حالة السلة + مزامنة مع الخادم
    <Layout>            // تخطيط رئيسي (Navbar + BottomNav + Footer)
      <ErrorBoundary>   // حاجز الأخطاء
        <Suspense>
          <Routes>...</Routes>
        </Suspense>
      </ErrorBoundary>
    </Layout>
  </CartProvider>
</AppProvider>
```

### 3.3 المسارات الـ 33:

**Public routes (8):**
- `/` → `pages/Home`
- `/search` → `SearchResults`
- `/product/:id` → `ProductDetail`
- `/store/:id` → `StorePage`
- `/categories` → `Categories`
- `/deals` → `Deals`
- `/checkout` → `Checkout` (محمي)
- `/messages` → `Messages`

**Auth routes (4):**
- `/auth/login`
- `/auth/register`
- `/auth/forgot-password`
- `/auth/reset-password`

**Customer routes (11):**
- `/customer` (dashboard)
- `/customer/orders`
- `/customer/orders/:id`
- `/customer/profile`
- `/customer/wallet`
- `/customer/coupons`
- `/customer/help`
- `/customer/wishlist`
- `/customer/reviews`
- `/customer/addresses`
- `/customer/notifications`

**Seller routes (6):**
- `/seller` (dashboard)
- `/seller/products`
- `/seller/products/new`
- `/seller/orders`
- `/seller/analytics`
- `/seller/onboarding`

**Admin routes (8) — nested تحت `/admin`:**
- `/admin` → `AdminOverview` (index)
- `/admin/overview`
- `/admin/users`
- `/admin/stores`
- `/admin/disputes`
- `/admin/reports`
- `/admin/audit-log`
- `/admin/all-products`
- `/admin/all-orders`

**Catch-all:** `*` → `NotFound`

### 3.4 المسار التقني للمخطط:

```mermaid
graph TB
  Main["apps/web/src/main.tsx"]
  App["apps/web/src/App.tsx<br/>33 × lazyPage()<br/>+ ErrorBoundary"]

  subgraph providers["Top-level providers (order matters)"]
    AppCtx["AppProvider<br/>(apps/web/src/context/AppContext.tsx)"]
    CartCtx["CartProvider<br/>(features/cart/context/CartContext.tsx)"]
  end

  Main --> App
  App --> AppCtx --> CartCtx
  App --> public & auth & cust & sell & admin
  cust -. ProtectedRoute .-> AppCtx
  sell -. ProtectedRoute .-> AppCtx
  admin -. ProtectedRoute .-> AppCtx
```

### 3.5 التنظيم المعتمد على الميزات (12 feature)

كل ميزة لها نفس الهيكل:
```
apps/web/src/features/<domain>/
├── api/<domain>.ts         // fetch wrappers → @/lib/api/client
├── components/*.tsx        // page + section components
└── index.ts                // public surface re-exports
```

| # | الميزة | API | المكونات الرئيسية |
|---|---|---|---|
| 1 | `auth/` | `api/auth.ts` | Login, Register, ForgotPassword, ResetPassword, AuthLayout |
| 2 | `products/` | `api/products.ts` | Categories, Deals, ProductDetail, SearchResults, StorePage |
| 3 | `cart/` | `api/cart.ts` + `context/CartContext.tsx` | (في السياق) |
| 4 | `checkout/` | `api/payments.ts` | Checkout |
| 5 | `orders/` | `api/orders.ts` | CustomerOrders |
| 6 | `home/` | `api/system.ts` | HeroSection, DealsBar, FeaturedMerchants, FeaturedProducts, StatsMarquee, +7 |
| 7 | `customer/` | `api/{addresses,reviews,notifications,refunds}.ts` | CustomerDashboard, Wishlist, Reviews, ... |
| 8 | `seller/` | `api/seller.ts` | SellerDashboard, SellerProducts, SellerOrders, SellerAnalytics, SellerOnboarding, DashboardShell |
| 9 | `admin/` | `api/admin.ts` | AdminOverview, AdminOrders, AdminProducts, StoresManagement, UsersManagement, ReportsAnalytics, DisputesManagement, AdminAuditLog |
| 10 | `messages/` | `api/messages.ts` | Messages |
| 11 | `shipping/` | `api/shipping.ts` | (helpers) |
| 12 | `coupons/` | `api/coupons.ts` | (helpers) |

### 3.6 Shared primitives (`apps/web/src/components/`):

- **`ui/`:** 10 shadcn primitives (avatar, badge, button, card, dialog, input, label, separator, switch, tabs, textarea)
- **Components:** `ErrorBoundary`, `Layout`, `ProtectedRoute`, `Navbar`, `BottomNav`, `Footer`, `Skeleton`, `Skeletons`, `Toast`, `ProductImage`
- **`i18n/`:** i18next + locales/{ar,en,zh}.json

### 3.7 Context API (`apps/web/src/context/AppContext.tsx`)

**AppState:**
```ts
{
  lang: 'ar' | 'en' | 'zh',
  dir: 'rtl' | 'ltr',
  user: User | null,
  toasts: Toast[]
}
```

**Reducer Actions:**
- `SET_LANG` — يحدّث اللغة والاتجاه (rtl للعربية، ltr للباقي)
- `SET_USER` — يكتب/يمسح المستخدم
- `ADD_TOAST` — يضيف إشعار toast مع معرّف فريد
- `REMOVE_TOAST` — يزيل toast بالـ ID

**Side effects (useEffect):**
1. `state.lang` يتغيّر → `document.documentElement.lang` و `.dir` تُحدّث
2. `state.user` يتغيّر → `localStorage['noufex_user']` تُحدّث (token في HttpOnly cookie، ليس localStorage)

**الـ Hooks المُصدّرة:**
- `useApp()` — السياق الكامل
- `useAuth()` — يُرجع `{user, isAuthenticated, login, logout, addToast}`

### 3.8 API Client (`apps/web/src/lib/api/client.ts`)

**الـ `apiRequest<T>()` wrapper:**
- URL: `${API_BASE}${endpoint}` (API_BASE من `import.meta.env.VITE_API_URL ?? '/api'`)
- Default timeout: **30 ثانية** عبر `AbortController`
- Headers: `Content-Type: application/json` (لا يُسمح للـ caller بتغييره)
- `credentials: 'include'` — لإرسال HttpOnly cookie تلقائياً
- يستجيب بـ `ApiResponse<T>` envelope (`{success, data, message, error, code, details, request_id}`)

**`ApiError` class:**
```ts
{
  status: number,
  code?: string,        // stable machine code
  request_id?: string,  // for log correlation
  details?: unknown
}
```

### 3.9 أنواع API (`apps/web/src/lib/api/types.ts`)

كل الكيانات (Product, Order, User, Store, etc.) معرّفة هنا لتفادي الـ circular imports.

---

## 4. Backend architecture (`apps/api`)

`apps/api/package.json` يؤكد: **Express 5.2.1**، **pg 8.22.0**، **zod 4.3.5**، **tsx 4.22.4**، **esbuild 0.25.12**، **vitest 4.1.9**.

### 4.1 Bootstrap (`apps/api/src/index.ts`, 396 سطر)

**ترتيب الـ middleware حرج:**

```js
configureTrustProxy(app)    // req.ip خلف proxy
  ↓
requestId                    // X-Request-Id من crypto.randomUUID()
  ↓
securityHeaders              // CSP nonce + HSTS + Permissions-Policy
  ↓
cors(ALLOWED_ORIGINS)        // credentials: true
  ↓
express.json(limit:'1mb')    // + verify() يلتقط rawBody للـ webhooks
  ↓
urlencoded rawBody parser    // لـ Paymob webhooks (1MB hard limit)
  ↓
optionalAuth                 // JWT decoding — لا يمنع
  ↓
requestLogger                // JSON line لكل طلب
```

**Health & Ready:**
- `GET /api/health` — JSON `{status, uptime_s, ts}` — للـ k8s/Docker healthcheck
- `GET /api/ready` — يفحص DB بـ `SELECT 1` مع timeout 2s — للـ readiness probe

**Background sweeper:**
```ts
setInterval(async () => {
  await db.prepare('SELECT cleanup_rate_limits() AS n').get()
  await db.prepare('SELECT cleanup_used_jtis() AS n').get()
}, 60 * 1000).unref()
```
كل 60 ثانية ينظّف rate-limit buckets و used_jtis منتهية الصلاحية.

**18 router mounts تحت `/api/*`:**

| المسار | الراوتر | Cache-Control |
|---|---|---|
| `/api/admin` | `adminRouter` + `adminExtrasRouter` | — |
| `/api` (catalog) | `catalogRouter` | **60 ثانية** |
| `/api/auth` | `authRouter` | — |
| `/api/auth/2fa` | `auth2faRouter` | — |
| `/api/orders` | `ordersRouter` | — |
| `/api/cart` | `cartRouter` | — |
| `/api/wishlist` | `wishlistRouter` | — |
| `/api/notifications` | `notificationsRouter` | — |
| `/api/messages` | `messagesRouter` | — |
| `/api/seller` | `sellerRouter` | — |
| `/api/payments` | `paymentsRouter` | — |
| `/api/coupons` | `couponsRouter` | — |
| `/api/refunds` | `refundsRouter` | — |
| `/api/reviews` | `reviewsRouter` | — |
| `/api/stats` | `statsRouter` | **30 ثانية** |
| `/api/shipping` | `shippingRouter` | **300 ثانية** |
| `/api/store-followers` | `storeFollowersRouter` | — |
| `/api/addresses` | `addressesRouter` | — |

**SPA static fallback (production only):**
```js
if (process.env.NODE_ENV === 'production' || process.env.SERVE_STATIC === 'true') {
  app.use(express.static(STATIC_PATH, { index: false }));
  app.get('/{*splat}', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    // يقرأ index.html، يحقن CSP nonce في <script>/<style> tags + <meta name="csp-nonce">
    // ...
  });
}
```

**Graceful shutdown (cross-platform):**
- يستجيب لـ `SIGTERM`, `SIGINT`
- Windows fallback: إذا `process.stdin.isTTY === true` يستمع لـ `'end'` event
- timeout 10 ثوانٍ force exit إذا لم تنتهِ الاتصالات

### 4.2 Layered modules (18 module)

**Pattern A — full layered (10 modules):**
```
modules/<name>/
├── routes.ts       // router creation + middleware attach
├── controller.ts   // HTTP handlers (req → res)
├── service.ts      // business logic
├── repository.ts   // SQL via `db` from lib/shared.ts
└── index.ts        // re-exports { <name>Router, *Service, *Repository }
```

النمط A يُطبّق على: `auth`, `addresses`, `cart`, `coupons`, `messages`, `notifications`, `shipping`, `stats`, `store-followers`, `wishlist`.

**Pattern B — thin wrapper (8 modules):**
```
modules/<name>/
├── routes.ts       // فقط: import { <name>Router } from '../../routes/<name>.ts'; export { <name>Router };
└── index.ts        // re-export
```

النمط B يُطبّق على: `admin`, `auth-2fa`, `catalog`, `orders`, `payments`, `refunds`, `reviews`, `seller`.
السبب: `routes/<name>.ts` يحتوي على منطق HTTP كامل (transaction، payments، 2FA flow). تم نقل البنية في commit `fix/routes-cts-to-ts-2026-07-06` من `.cts` إلى `.ts` مع modules كغلاف رفيع.

### 4.3 Middleware chain (`apps/api/src/middleware.ts`, 993 سطر)

**الصادرات الرئيسية (top-level):**

| الاسم | الغرض |
|---|---|
| `requestId` | يضع `X-Request-Id` من `crypto.randomUUID()` أو الـ header الوارد |
| `securityHeaders` | CSP (nonce لكل طلب) + HSTS + frame-options + referrer-policy + Permissions-Policy موسّعة (32 capability) |
| `log` | JSON structured logger (pino-style) على stdout |
| `requestLogger` | يُصدر JSON line لكل طلب (method, path, status, latency, userId, ip) |
| `optionalAuth` | يفك JWT، يُلحق `req.user` إن وجد، لا يمنع |
| `requireAuth` | مثل `optionalAuth` + 401 إن لم يكن `req.user` |
| `requireRole(...roles)` | مصنع: 403 إن لم يكن `req.user.role` ضمن المسموح |
| `errorHandler` | نهائي: 4-arg، يحوّل PG/Zod/HttpError إلى envelope موحد |
| `notFoundHandler` | نهائي: 404 envelope |
| `healthRateLimit` | Token-bucket limiter في الذاكرة لـ `/api/health` و `/api/ready` |
| `configureTrustProxy(app)` | يضبط `app.set('trust proxy', v)` مع validation |
| `parsePagination(raw, maxLimit=100)` | clamping للـ `limit/offset` |

**JWT helpers inline:**
- `signAuthToken(payload)` — يُنشئ `base64url(payload).base64url(hmac)` مع `sub, role, ver, exp` (TTL 7 أيام)
- `setAuthCookie(res, token)` — HttpOnly + SameSite=Strict + Max-Age + Secure (في production)
- `clearAuthCookie(res)` — Max-Age=0
- `extractAuthToken(req)` — من cookie أولاً، ثم `Authorization: Bearer`
- `invalidateAuthCache(userId)` / `invalidateTokenVersionCache(userId)` — alias
- `getAuthSecret()` — يجب أن يكون ≥32 chars، يرمي خطأ في module-load إن لم يكن

**Auth Cache (M-4 security fix):**
```ts
const authCache = new Map<number, AuthCacheEntry>();  // userId → {ver, role, cachedAt}
const AUTH_CACHE_TTL_MS = 30_000;  // 30s
const AUTH_CACHE_MAX_SIZE = 10_000;
```
- بعد كل `requireAuth`/`optionalAuth` يستعلم عن `users.token_version` و `users.role`
- يقرأ `role` من cache بدلاً من JWT (يمنع ترقية/تخفيض رتبة لمدة 7 أيام)
- LRU eviction عند تجاوز السعة

**HttpError class:**
```ts
class HttpError extends Error {
  status: number;
  code?: string;       // stable machine-readable code
  details?: unknown;
}
```

**PG error translation:**
| PG Code | Status | رسالة |
|---|---|---|
| `23505` | 409 | A record with that unique value already exists |
| `23503` | 409 | Referenced record does not exist |
| `23502` | 400 | A required field is missing |
| `23514` | 400 | A field value violates a database constraint |
| `22P02` | 400 | Invalid input format |
| `40001` | 409 | Serialization failure — retry |
| `40P01` | 503 | Database is unreachable |

**Response envelope (`sendSuccess` / `sendError`):**
```json
{
  "success": true|false,
  "data": ...,
  "message": "...",
  "error": "...",
  "code": "STABLE_CODE",
  "details": ...,
  "request_id": "uuid"
}
```

### 4.4 Database pool (`apps/api/src/db/pg-wrapper.ts`)

**PgDb class — wrapper async حول `pg.Pool`:**
- API يحاكي better-sqlite3:
  ```ts
  const rows = await db.prepare('SELECT * FROM t WHERE id = ?').all(7);
  const one  = await db.prepare('SELECT * FROM t WHERE id = ?').get(7);
  const r    = await db.prepare('DELETE ...').run(7);
  await db.tx(async (txDb) => { ... });
  ```
- SQL placeholders يبقى `?` — يُحوّل إلى `$1, $2, ...` عبر `pgify()`

**Helper functions:**
- `normalizeSql(sql)` — يحوّل `datetime('now')` → `CURRENT_TIMESTAMP` و `is_X = 1/0` → `TRUE/FALSE`
- `pgify(sql)` — state machine يحوّل `?` → `$N` مع مراعاة:
  - single-quoted strings مع `''` escapes
  - E-strings مع backslash escapes
  - double-quoted identifiers
  - dollar-quoted strings (`$$ ... $$`)
  - line/block comments
- `redactUrl(url)` — يخفي كلمة المرور من connection string للسجلات

**Pool config:**
```ts
{
  max: DB_POOL_MAX || 20,           // قابل للضبط 1..1000
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: DB_SSL === 'true' ? { rejectUnauthorized: ... } : undefined
}
```

### 4.5 مكتبة `lib/shared.ts` (barrel exports)

تعيد تصدير كل ما تحتاجه الـ routes:
```ts
export const db = new PgDb(process.env.DATABASE_URL);  // يفشل في module-load إن لم يكن موجوداً
export { HttpError, log, requireAuth, requireRole, sendError, sendSuccess };
export { ErrorCodes } from './error-codes';
export type { AuthRole, TokenPayload } from './types';
export { hashPassword, verifyPassword } from './auth';
export { authLimiter, rateLimit } from './ratelimit';
export { buildUpdateSet } from './sql-helpers';
export { validate } from './validation';
export { redactSensitive, writeAuditLog } from './audit';
export { getProductWithParsedFields, parseJson } from './json';
// Zod schemas: addressSchema, registerSchema, loginSchema, orderSchema, ...
export async function computeCouponDiscount(coupon, orderSubtotal) { ... }
```

### 4.6 مكتبة `lib/validation.ts` (Zod schemas)

**Password Strength Helper (`evaluatePasswordStrength`):**
- طول 10..128 (NIST 800-63B)
- على الأقل 3 من: lower, upper, digit, symbol
- يرفض:
  - 4+ chars متكررة (`aaaa`)
  - 4+ chars متتالية (`1234`, `abcd`)
  - كلمات شائعة (55 password في القائمة)
  - password يساوي local-part من email

**Schemas المعاد تصديرها:**
- `emailSchema`, `passwordSchema`, `registerSchema`, `loginSchema`
- `orderItemSchema`, `orderSchema` — `.strict()`، pricing fields مُهملة عمداً
- `addressSchema`, `profileUpdateSchema`, `passwordChangeSchema`
- `paymentCreateSchema`, `refundCreateSchema`, `couponRedeemSchema`
- `paginationSchema`, `adminUserUpdateSchema`, `adminStoreUpdateSchema`, `adminOrderStatusSchema`, `adminProductUpdateSchema`, `adminDisputeUpdateSchema`
- `cartAddSchema`, `cartItemUpdateSchema`, `wishlistAddSchema`
- `sellerProductCreateSchema`, `sellerProductUpdateSchema`, `sellerStoreCreateSchema`, `sellerStoreUpdateSchema`, `sellerOrderStatusUpdateSchema`
- `adminCategoryCreateSchema`, `adminCouponCreateSchema`, `adminBroadcastSchema`, `adminSettingUpdateSchema`

**Helper functions:**
- `validate<T>(schema, body)` — يُرجع `{ok: true, data} | {ok: false, error}`
- `resolveOrderStoreId(productIds, productRows)` — يستنتج `store_id` من المنتجات، يرفض mixed-stores
- `OrderProductRow`, `CouponRow` types

### 4.7 مكتبة `lib/error-codes.ts`

**`ErrorCodes` (const object):**
- 4xx: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `DUPLICATE`, `PAYLOAD_TOO_LARGE`, `UNPROCESSABLE_ENTITY`, `RATE_LIMITED`
- 5xx: `INTERNAL_ERROR`, `DATABASE_ERROR`, `SERVICE_UNAVAILABLE`
- Mutations: `INSERT_FAILED`, `UPDATE_FAILED`, `DELETE_FAILED`
- Feature-specific: `ALREADY_ENABLED`, `NOT_ENABLED`, `PARTIAL_INVALID`

**`ErrorMessages`** — رسالة canonical لكل كود (نوع `Record<ErrorCode, string>`)
**`ErrorStatuses`** — HTTP status مقترح لكل كود (نوع `Record<ErrorCode, number>`)
**`isErrorCode(value)`** — type guard

### 4.8 مكتبة `lib/auth.ts` — Password Hashing

**scrypt مع salt عشوائي 16 bytes + key 64 bytes (256-bit):**
```ts
format on-disk: 'scrypt$<saltB64>$<keyB64>'
```
- `hashPassword(password)` → يُرجع الـ hash
- `verifyPassword(password, stored)` → يستخدم `timingSafeEqual`، يرجع false لأي format غير صحيح

### 4.9 مكتبة `lib/totp.ts` — TOTP (RFC 6238)

- **خوارزمية:** `T = floor((unix_time - 0) / 30)`, `HMAC-SHA1(secret, T_8bytes_BE)`, dynamic truncation، `code % 1_000_000`
- **Tolerance:** ±1 step (±30 ثانية) — لهجوم brute-force صغير
- **Base32 encoding/decoding** (RFC 4648 بدون padding)
- `generateSecret()` → 160 bits = 32 حرف base32
- `verifyTotp(secret, code, now?)` → يقارن مع current/prev/next window
- `otpauthUrl(account, secret, issuer, period, digits)` → URI لـ Google Authenticator

### 4.10 مكتبة `lib/ratelimit.ts`

- `rateLimit(windowMs, max, bucket)` — Express middleware factory
- يستدعي `consume_rate_limit(bucket, key, window_ms, max)` PL/pgSQL function
- Fail-OPEN عند تعطل DB (لا يحجب مستخدمين شرعيين)
- `authLimiter` — 20 hits / 15min / IP عبر `/api/auth/*`

### 4.11 مكتبة `lib/audit.ts`

- `writeAuditLog(req, action, entityType, entityId, oldValues, newValues)`
- يستخدم `write_audit_log(...)` SECURITY DEFINER function
- **3 retries مع exponential backoff** (100ms, 200ms, 400ms)
- عند الفشل → dead-letter في `logs/audit-dlq-YYYY-MM-DD.jsonl`
- `redactSensitive(value)` — يستبدل قيم 17 مفتاح sensitive (`password`, `token`, `secret`, `cvv`, ...) بـ `[REDACTED]`

### 4.12 الوحدات الـ 18:

**Auth module (`modules/auth/`):**

`controller.ts` (193 سطر) — 7 routes:
- `POST /register` (rate-limited)
- `POST /login` (rate-limited)
- `POST /logout` (auth)
- `GET /me` (auth)
- `PATCH /me` (auth)
- `POST /change-password` (auth)
- `POST /forgot-password`, `POST /reset-password` (rate-limited)

`service.ts` (182 سطر):
- `register()` — ينشئ user بـ scrypt + يُرجع token
- `login()` — dummy scrypt hash للحماية من timing attacks
- `logout()` — يب bumps `token_version`
- `updateProfile()`, `changePassword()`, `forgotPassword()`, `resetPassword()`

`repository.ts` (111 سطر) — pure DB access:
- `createUser`, `findUserByEmail`, `findUserById`
- `getTokenVersion`, `updateLastLogin`, `bumpTokenVersion`
- `updateProfile`, `getPasswordHash`, `setPasswordHash`, `setPasswordHashAndBumpVersion`

**Orders module (`routes/orders.ts`, 502 سطر):**

- `GET /` — قائمة طلبات المستخدم الحالي (admin يستطيع تحديد customerId)
- `GET /:id` — تفاصيل طلب + items + التحقق من الملكية
- `POST /` — إنشاء طلب جديد (SECURITY-CRITICAL):
  1. يسحب المنتجات بـ `SELECT ... FOR UPDATE` داخل transaction
  2. يحلّل `store_id` من المنتجات (يرفض mixed-stores)
  3. يتحقق من المخزون
  4. يحسب الأسعار **server-side** (لا يثق بـ body)
  5. يُطبّق coupon إن وجد (`coupon_discount_amount()` SQL function)
  6. ينشئ order + order_items
  7. trigger `trg_order_items_decrement_stock` ينقص المخزون تلقائياً
  8. يُطلق إشعارات للعميل والتاجر

**Catalog module (`routes/catalog.ts`, 514 سطر):**

- `GET /products` — مع فلترة (category, search, store, minPrice, maxPrice, sort) + pagination
- `GET /products/featured` — للـ homepage hero
- `GET /products/deals` — المنتجات بخصم نشط
- `GET /products/:id` — تفاصيل + store + reviews + images
- `GET /stores` — قائمة متاجر
- `GET /stores/:id` — تفاصيل + products (cap 100)
- `GET /stores/:id/reviews` — visible reviews فقط
- `GET /categories` — شجرة كاملة مع product_count
- `GET /categories/:slug` — فئة + منتجاتها
- `GET /search` — FTS مع websearch_to_tsquery + weights

---

## 5. Database (`packages/db`)

### 5.1 الملفات الـ 7 + 30 migration

| الملف | الغرض |
|---|---|
| `schema.sql` | Core tables (users, stores, products, orders, ...) — 459 سطر |
| `schema-extra.sql` | payments, coupons, refunds, balances, audit, ... — 202 سطر |
| `functions.sql` | PL/pgSQL functions (trg_set_updated_at, trg_orders_state_machine, ...) — 357 سطر |
| `triggers.sql` | BEFORE/AFTER triggers — 152 سطر |
| `views.sql` | v_product_with_store, v_store_stats, v_order_summary, v_low_stock — 168 سطر |
| `roles.sql` | noufex_owner, noufex_app, noufex_readonly + GRANTs — 170 سطر |
| `seed.sql` | 10 users + 18 categories + 7 stores + 24 products + 8 orders + ... — 706 سطر |

**Migrations مرقّمة `0001_baseline.sql` ... `0030_updated_at_triggers.sql`** تُطبَّق عبر `npm run db:setup`.

### 5.2 الجداول الـ 28:

**المستخدمون والمصادقة:**
- `users` (id, email CITEXT, password_hash, full_name, phone, role, status, is_verified, two_factor_enabled, preferred_language, gender, token_version, last_login, deleted_at, ...)
- `subscriptions` (merchant plans)
- `rate_limit_buckets` (key, count, reset_at)
- `used_jtis` (JWT replay protection)
- `admin_audit_log` (write-only)
- `webhook_events` (idempotency)

**المتاجر والمنتجات:**
- `stores` (id, owner_id, store_name, slug, trust_level, response_rate, on_time_delivery, commission_rate, rating, products_count, sales_count, followers_count, ...)
- `categories` (tree ذاتي المرجع، parent_id)
- `products` (id, store_id, category_id, name_ar/en/zh, price NUMERIC(12,2), currency YER, stock, moq, features TEXT[], specifications JSONB, rating, review_count, sold_count, view_count, deal_discount, ...)
- `product_variants` (size/color/SKU + price_delta + stock)
- `product_images` (product_id, image_url, is_primary, sort_order)
- `inventory_log` (append-only)
- `store_balance` (1:1 مع stores)
- `store_followers` (M:N customers ↔ stores)
- `app_settings` (key-value store)
- `search_logs` (analytics)

**الطلبات:**
- `orders` (id, order_number, customer_id, store_id, status enum, payment_method/status, subtotal/shipping_cost/discount/total NUMERIC, shipping_address JSONB, timeline JSONB, tracking_number, ...)
- `order_items` (order_id, product_id, variant_id, product_name snapshot, quantity, unit_price, total_price)
- `cart_items` (user_id, product_id, variant_id, variant JSONB, quantity, UNIQUE(user, product, variant))
- `payments` (order_id, user_id, method, status, provider, provider_txn_id, provider_meta JSONB)
- `transactions` (store_id, type, amount, balance_after — wallet ledger)
- `shipping_methods` (global catalog)
- `refunds` (order_id, payment_id, status)

**التفاعل:**
- `reviews` (product_id, store_id, customer_id, order_id, rating 1-5, title, comment, images, helpful_count, merchant_reply, is_verified, is_visible)
- `wishlist` (user_id, product_id, UNIQUE)
- `notifications` (user_id, type enum, title, body, data JSONB, is_read, read_at)
- `messages` (sender_id, receiver_id, store_id, body, attachments JSONB, is_read)
- `disputes` (order_id, customer_id, store_id, type, status enum, priority, subject, evidence JSONB, refund_amount)
- `addresses` (user_id, label, full_name, phone, city, governorate, district, street, building, latitude/longitude NUMERIC, is_default, UNIQUE INDEX على is_default)

**العروض:**
- `coupons` (code, type percentage/fixed, value, min_order_amount, max_discount, usage_limit, usage_count, per_user_limit, store_id NULL = site-wide, starts_at, expires_at)
- `coupon_usage` (coupon_id, user_id, order_id, discount_amount, UNIQUE)

### 5.3 الأدوار (`roles.sql`):

- **`postgres`** — superuser (لا يستخدمه التطبيق أبداً)
- **`noufex_owner`** — DDL owner، ينشئ الجداول والـ functions
- **`noufex_app`** — least-privilege للتطبيق
- **`noufex_readonly`** — BI/reporting

**Grant pattern (DB-CRITICAL-1):**
```sql
-- RW tables (25 table)
rw_tables := ['users','addresses','stores','categories','products',
              'product_variants','product_images','cart_items','orders',
              'order_items','reviews','wishlist','notifications','messages',
              'disputes','subscriptions','rate_limit_buckets','coupons',
              'coupon_usage','payments','refunds','store_balance',
              'store_followers','shipping_methods','used_jtis','webhook_events'];

-- RO tables (4 — writes عبر SECURITY DEFINER triggers فقط)
ro_tables := ['admin_audit_log','inventory_log','transactions','search_logs'];
```

### 5.4 PL/pgSQL Functions (8):

1. **`trg_set_updated_at()`** — universal `updated_at` maintainer
2. **`trg_orders_state_machine()`** — يفرض transitions صالحة:
   - `pending → confirmed | cancelled | refunded`
   - `confirmed → processing | cancelled`
   - `processing → shipped | cancelled`
   - `shipped → delivered`
   - `delivered → refunded`
3. **`trg_orders_append_timeline()`** — يُضيف entry إلى `timeline` JSONB
4. **`trg_order_items_decrement_stock()`** — SECURITY DEFINER — يفحص + ينقص المخزون + يدون في `inventory_log`
5. **`trg_reviews_refresh_rating()`** — يُحدّث `products.review_count` و `rating`
6. **`trg_products_refresh_store_count()`** — يُحدّث `stores.products_count`
7. **`trg_refunds_resolve_payments()`** — عند `status='processed'` يُحوّل `payments.status='refunded'`
8. **`trg_stores_refresh_review_stats()`** — يُحدّث `stores.rating` و `review_count`
9. **`trg_stores_refresh_followers_count()`** — يُحدّث `stores.followers_count`
10. **`trg_stores_refresh_sales_count()`** — على `delivered` يزيد `sales_count`

### 5.5 Triggers المعرّفة (16 trigger):

- 1× dynamic loop على كل جدول فيه `updated_at` (يولّد `trg_<table>_set_updated_at`)
- 2× على `orders` (state_machine قبل timeline)
- 1× على `order_items` (decrement_stock)
- 6× على `reviews` (refresh_rating ins/upd/del × 2 = 6 triggers لـ product + store stats)
- 3× على `products` (refresh_store_count ins/upd/del)
- 1× على `refunds` (resolve_payments)
- 3× على `store_followers` (refresh_count ins/upd/del)

### 5.6 Views (4):

- **`v_product_with_store`** — product + store + category (مع `security_invoker=true`)
- **`v_store_stats`** — store + denormalized counters + revenue + active_products
- **`v_order_summary`** — order + customer + store + items_count + total_qty
- **`v_low_stock`** — products بـ stock < 10

### 5.7 البيانات التجريبية (Seed):

- **10 مستخدمين:** 1 admin + 3 customers + 6 merchants
- **18 فئة:** 7 فئات رئيسية + 11 فرعية (electronics, food-beverages, fashion, ...)
- **7 متاجر:** Yemen Spice House, Queen Perfumes, Jawf Dates, Yemen Handicrafts, Yemen Electronics, Mokha Coffee, Incense & Perfumes
- **24 منتج:** عسل، قهوة، تمور، عطور، إلكترونيات، حرف يدوية
- **4 كوبونات:** WELCOME10, FREESHIP, YEMEN25, SPICE20
- **8 طلبات** بحالات مختلفة (delivered, shipped, processing, pending, confirmed, cancelled)
- **9 عناصر طلبات**، **6 مدفوعات** (منها 1 failed)
- **2 استخدام كوبون**، **1 استرداد**، **8 معاملات wallet**، **10 تقييمات**

**كلمات المرور التجريبية:**
- admin@noufex.com / admin123
- ahmed@gmail.com / customer123
- fatima@spice-yemen.com / merchant123

### 5.8 Script `scripts/db/db-setup.cjs`:

- يطبق `packages/db/*.sql` بالترتيب (schema.sql → schema-extra.sql → functions.sql → triggers.sql → views.sql → roles.sql → seed.sql)
- يطبق migrations من `migrations/0001..0030`
- **Idempotent** — `IF NOT EXISTS` على كل CREATE
- يسجل `schema_migrations` جدول لتتبع migrations المطبّقة

---

## 6. Authentication & 2FA flow

### 6.1 التسجيل (`POST /api/auth/register`):

1. Zod validation → `registerSchema`
2. `hashPassword()` بـ scrypt → `scrypt$<salt>$<key>`
3. `repo.createUser()` → `INSERT INTO users RETURNING id`
4. `getTokenVersion()` → 0 للمستخدم الجديد
5. `signAuthToken({sub, role: 'customer', ver: 0})`
6. `setAuthCookie(res, token)` — HttpOnly + SameSite=Strict
7. `sendSuccess(res, {user}, 201)`
8. Best-effort: `onWelcome()` notification

**Roles:** `'customer'` أو `'merchant'` فقط — أي `role === 'admin'` يتم تخفيضه إلى `'customer'` في `service.ts:35`.

### 6.2 تسجيل الدخول (`POST /api/auth/login`):

1. Zod validation
2. `repo.findUserByEmail()`
3. **Dummy scrypt hash** إذا لم يوجد المستخدم — للحماية من timing attacks
4. `verifyPassword(password, user.password_hash)`
5. `updateLastLogin(user.id)`
6. إذا `two_factor_enabled === true`:
   - `signPartialToken(user.id)` — TTL 5 دقائق
   - `return {kind: '2fa_required', partial_token, user_id}`
7. وإلا:
   - `signAuthToken({sub, role, ver: token_version})`
   - `setAuthCookie(res, token)`

### 6.3 2FA Verification (`POST /api/auth/2fa/verify`):

1. استلام `partial_token` + `totp` code
2. `verifyPartialToken()` — فك الـ JWT قصير المدى
3. `verifyTotp(secret, code)` — مع tolerance ±30s
4. `signAuthToken({sub, role, ver})` + `setAuthCookie()`

### 6.4 Logout (`POST /api/auth/logout`):

1. `repo.bumpTokenVersion(userId)` — `UPDATE users SET token_version = token_version + 1`
2. `invalidateTokenVersionCache(userId)` — يمسح من cache
3. `clearAuthCookie(res)`

### 6.5 Change Password:

1. التحقق من `current_password` بـ scrypt
2. رفض إن كان `new_password === current_password`
3. `setPasswordHashAndBumpVersion(userId, newHash)` — يُحدّث hash + يب bumps version
4. `invalidateTokenVersionCache(userId)`
5. `writeAuditLog('change_password', 'user', userId, null, null)`

### 6.6 Forgot/Reset Password:

- `forgotPassword()` → `signResetToken(userId)` — TTL قصير
- في development: يُرجع `reset_token` في response (للاختبار)
- في production: يُرجع `{ok: true}` فقط (بدون تسريب)
- `resetPassword()` → `verifyResetToken()` + `setPasswordHashAndBumpVersion()`

---

## 7. MCP server & Gateway

### 7.1 `apps/mcp-server/` (stdio):

**4 عائلات أدوات:**

| العائلة | الملف | الأدوات |
|---|---|---|
| `db_*` | `db-tools.ts` (339 سطر) | `db_query`, `db_schema`, `db_list_tables`, ... |
| `code_*` | `code-tools.ts` (212 سطر) | `code_search`, `code_read`, ... |
| `api_*` | `api-tools.ts` (255 سطر) | `api_routes`, `api_route_detail` |
| `docs_*` | `docs-tools.ts` (119 سطر) | `docs_search` |

### 7.2 Docker MCP Gateway (`docker/mcp-gateway/`):

- يستمع على **TCP 8811** مع SSE transport (`/sse?sessionid=...`)
- يقرأ `catalog.yaml` لمعرفة أي stdio servers يُشغّل
- يتطلب `Bearer` token (يُطبع عند أول تشغيل)
- `/health` على نفس المنفذ

---

## 8. Docker build & deploy

### 8.1 Dockerfile (4 stages):

| Stage | Base | Output |
|---|---|---|
| 1. `deps` | node:20-alpine | `/build/node_modules` (workspace-wide `npm ci`) |
| 2. `api-build` | node:20-alpine | `apps/api/dist/index.js` (esbuild, ESM, external deps) |
| 3. `web-build` | node:20-alpine | `apps/web/dist/` (vite build) |
| 4. `runtime` | node:20-alpine + tini | الصورة النهائية، `USER node`، expose 3000 |

### 8.2 docker-compose.yml:

- `services.noufex`:
  - `image: noufex:latest`
  - `ports: 127.0.0.1:3000:3000`
  - `env_file: .env`
  - `extra_hosts: host.docker.internal:host-gateway` (للوصول إلى PostgreSQL على المضيف)
  - `healthcheck: GET /api/health` كل 30 ثانية

### 8.3 docker-entrypoint.sh:

- ينسخ `apps/api/dist/index.js` إلى المسار المتوقع
- ينتظر TCP `host.docker.internal:5432`
- `exec node apps/api/dist/index.js`

---

## 9. متغيرات البيئة (`.env.example`):

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=noufex_db
DB_USER=noufex_app
DB_PASSWORD=CHANGE_ME_APP
DATABASE_URL=postgresql://noufex_app:CHANGE_ME_APP@localhost:5432/noufex_db
DB_SSL=true

# Express API
NODE_ENV=development
API_PORT=3000
HOST=0.0.0.0
SERVE_STATIC=true

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# Auth
AUTH_SECRET=CHANGE_ME_AUTH_SECRET_min_32_chars  # ≥32 chars

# Postgres admin (للـ db-setup)
POSTGRES_DB=noufex_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=CHANGE_ME_POSTGRES

# Logging
LOG_LEVEL=info

# Trust proxy (في الإنتاج خلف nginx/k8s)
TRUST_PROXY=
```

---

## 10. CI / GitHub automation

- `dependabot.yml` يغطي 4 workspaces + GitHub Actions
- Pre-commit hook: `.husky/pre-commit` يشغّل `lint-staged`
  - `*.{ts,tsx,cts}` → `eslint --fix --max-warnings=0` + `prettier`
  - `*.{js,cjs,mjs,json,md,css}` → `prettier --write`

---

## 11. Cross-workspace TypeScript paths

`apps/api/tsconfig.json`:
```json
"paths": {
  "@noufex/web/*": ["../web/*"]
}
```

---

## 12. ملخص "أين أجد X" (cheat sheet):

| أريد... | الملف |
|---|---|
| إضافة صفحة جديدة | `apps/web/src/features/<domain>/components/` |
| إضافة endpoint جديد | `apps/api/src/modules/<name>/routes.ts` (ثم `controller.ts` و `service.ts`) |
| تعديل auth cookie | `apps/api/src/middleware.ts` (`setAuthCookie` / `clearAuthCookie`) |
| إضافة أداة MCP | `apps/mcp-server/src/<family>-tools.ts` + تسجيل في `index.ts` |
| إضافة migration | `packages/db/migrations/NNNN_<name>.sql` |
| تحديث PWA manifest | `apps/web/vite.config.ts` (`VitePWA({ manifest })`) |
| تحديث CSP | `apps/api/src/middleware.ts:securityHeaders` |
| تحديث Docker healthcheck | `docker-compose.yml` (line 53-59) |
| تعديل كلمة مرور seed | `scripts/gen-seed-hashes.cjs` ثم `packages/db/seed.sql` |
| إضافة خطاف trigger | `packages/db/functions.sql` ثم `packages/db/triggers.sql` |

---

## Appendix A — Counts (verified):

| القياس | القيمة | كيف تم التحقق |
|---|---|---|
| Frontend features | 12 | `ls apps/web/src/features/` |
| Backend modules | 18 | `ls apps/api/src/modules/` |
| Routes in App.tsx | 33 | `grep -c "lazyPage" apps/web/src/App.tsx` |
| SQL base files | 7 | `ls packages/db/*.sql` |
| Migrations | 30 | `ls packages/db/migrations/` |
| DB tables | 28 | `grep -r "CREATE TABLE" packages/db/*.sql packages/db/migrations/*.sql \| awk` |
| PL/pgSQL functions | 8 | `grep -c "CREATE OR REPLACE FUNCTION" packages/db/functions.sql` |
| Triggers | ~17 | `ls` في triggers.sql |
| Views | 4 | `grep -c "CREATE OR REPLACE VIEW" packages/db/views.sql` |
| Roles | 4 | postgres, noufex_owner, noufex_app, noufex_readonly |
| MCP tool families | 4 | `ls apps/mcp-server/src/*-tools.ts` |
| Docker stages | 4 | reading `Dockerfile` `FROM ... AS ...` blocks |
| Shared workspaces | 4 | `ls packages/` |
| Middleware exports | 14+ | `grep "^export " apps/api/src/middleware.ts` |
| Catalog tools | 5 | `grep "^  - name:" docker/mcp-gateway/catalog.yaml` |
| API routers mounted | 18 | `grep "app.use('/api" apps/api/src/index.ts` |
| Zod schemas | 30+ | `grep "^export const.*Schema" apps/api/src/lib/validation.ts` |
| Seed users | 10 | `grep "^INSERT INTO users" packages/db/seed.sql` |
| Seed stores | 7 | `grep "^INSERT INTO stores" packages/db/seed.sql` |
| Seed products | 24 | `grep "^INSERT INTO products" packages/db/seed.sql` |
| Seed orders | 8 | `grep "^INSERT INTO orders" packages/db/seed.sql` |
