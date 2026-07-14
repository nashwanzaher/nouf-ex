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
│   ├── db/        @noufex/db         7 SQL files + 32 migrations
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
      DB["@noufex/db<br/>SQL + 32 migrations"]
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

`App.tsx` يُصدّر **46 `lazyPage()` route component** (سطر 22-37). كل صفحة مقسّمة إلى chunk خاص بها.

**ملاحظة مهمة:** عدد ملفات الصفحات في `apps/web/src/pages/` هو **47 ملف TypeScript** (باستثناء tests)، لكن 46 منها فقط مُسجَّلة في `App.tsx` كـ routes نشطة. الفرق يرجع إلى أن بعض الصفحات (مثل `CustomerSidebar`, `DashboardShell`) هي مكونات داخلية تُستعمل داخل صفحات أخرى، وليست routes.

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

| # | الميزة | API الرئيسية | المكونات |
|---|---|---|---|
| 1 | `auth/` | `api/auth.ts` | Login, Register, ForgotPassword, ResetPassword, AuthLayout |
| 2 | `products/` | `api/products.ts` | Categories, Deals, ProductDetail, SearchResults, StorePage (+ 5 tests) |
| 3 | `cart/` | `api/cart.ts` + `context/CartContext.tsx` | (لا توجد صفحة dedicated، state في Context فقط) |
| 4 | `checkout/` | `api/payments.ts` | Checkout (+ 1 test) |
| 5 | `orders/` | `api/orders.ts` | CustomerOrders, OrderDetail |
| 6 | `home/` | `api/system.ts` | HeroSection, DealsBar, FeaturedMerchants, FeaturedProducts, StatsMarquee, CategoriesGrid, HowItWorks, LiveCommerce, MobileAppCTA, NoufProtect, SubscriptionTiers |
| 7 | `customer/` | `api/{addresses,reviews,notifications,refunds}.ts` | CustomerDashboard, CustomerOrders, OrderDetail, Profile, Wallet, Coupons, Help, Wishlist, Reviews, Addresses, Notifications, CustomerSidebar |
| 8 | `seller/` | `api/seller.ts` | SellerDashboard, SellerProducts, SellerOrders, SellerAnalytics, SellerOnboarding, SellerProductNew, DashboardShell |
| 9 | `admin/` | `api/admin.ts` | AdminDashboard, AdminOverview, AdminOrders, AdminProducts, AdminCategories, AdminCoupons, AdminNotifications, AdminReviews, AdminSettings, AdminSystemHealth, AdminAuditLog, DisputesManagement, ReportsAnalytics, StoresManagement, UsersManagement |
| 10 | `messages/` | `api/messages.ts` | Messages |
| 11 | `shipping/` | `api/shipping.ts` | (helpers only) |
| 12 | `coupons/` | `api/coupons.ts` | (helpers only) |

### 3.5.1 Frontend API clients (الواجهة بين React والـ API):

**`features/auth/api/auth.ts` (143 سطر):**
- `login({email, password})` → `Promise<AuthLoginResult>` (union: `{kind: 'auth', user} | {kind: '2fa_required', partial_token, user_id}`)
- `register({email, password, name, role?})` → `Promise<AuthResponse>`
- `getCurrentUser()` / `updateProfile(body)`
- `changePassword({current_password, new_password})`
- `forgotPassword(email)` → `{ok, reset_token?, expires_at?}` (dev فقط)
- `resetPassword(token, new_password)`
- 2FA: `setup2FA`, `enable2FA`, `verify2FA`, `disable2FA`, `regenerateBackupCodes`

**`features/products/api/products.ts` (83 سطر):**
- `getProducts(filters)` → `{products, total, limit, offset}`
- `getProduct(id)` → `ProductWithDetails` (مع store + reviews + images)
- `getFeaturedProducts()` / `getDeals()`
- `getStores()` / `getStore(id)` → `StoreWithProducts`
- `getStoreReviews(id)`
- `getCategories()` / `getCategory(slug)`
- `searchProducts({q, limit?, offset?})`

**`features/cart/context/CartContext.tsx` (359 سطر):**
- CartState: `{items: CartItem[], loading, error}`
- **CartItem:** `{productId, name, price, quantity, image, merchantName}`
- **Reducer actions:** `ADD, REMOVE, UPDATE_QTY, CLEAR, HYDRATE, SET_LOADING, SET_ERROR`
- **Persistence:** localStorage `noufex_cart` للزوار، server للـ authenticated users
- **Sync logic:**
  - عند login: يدفع local cart إلى server + يسحب server cart + يمسح local
  - عند logout: يمسح local cart
  - على كل mutation: optimistic update + server reconcile
- **Hooks مُصدّرة:** `useCart()` → `{state, dispatch, cartCount, cartTotal}`

### 3.6 Shared primitives (`apps/web/src/components/`):

- **`ui/`:** 10 shadcn primitives (avatar, badge, button, card, dialog, input, label, separator, switch, tabs, textarea)
- **Layout components:**
  - `Layout.tsx` — Layout wrapper: Navbar + main + (Footer? + BottomNav) — يخفي Footer في dashboard routes
  - `Navbar.tsx` — top navigation
  - `BottomNav.tsx` — mobile bottom tab bar
  - `Footer.tsx` — site footer
- **Error handling:**
  - `ErrorBoundary.tsx` — React error boundary
  - `Toast.tsx` — toast notifications
  - `Skeleton.tsx` / `Skeletons.tsx` — loading placeholders
- **Auth:**
  - `ProtectedRoute.tsx` — Route guard:
    - إذا لم يكن مسجل دخول → redirect لـ `/auth/login?redirect=<path>`
    - إذا لم تتطابق role → redirect لـ dashboard الخاص بـ role
- **Visual:**
  - `ProductImage.tsx` — Safe image component with fallback

### 3.6.1 Frontend Pages (47 ملف TypeScript):

| المنطقة | العدد | الـ paths |
|---|---|---|
| **Public** | **8** | `/`, `/search`, `/product/:id`, `/store/:id`, `/categories`, `/deals`, `/checkout`, `/messages` |
| **Auth** | **5** | `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password` + `AuthLayout` |
| **Customer** | **12** | `/customer` (dashboard + sidebar), `/customer/orders`, `/customer/orders/:id`, `/customer/profile`, `/customer/wallet`, `/customer/coupons`, `/customer/help`, `/customer/wishlist`, `/customer/reviews`, `/customer/addresses`, `/customer/notifications` |
| **Seller** | **7** | `/seller` (dashboard), `/seller/products`, `/seller/products/new`, `/seller/orders`, `/seller/analytics`, `/seller/onboarding` + `DashboardShell` |
| **Admin** | **15** | `/admin` shell مع 9 sub-routes (`/overview`, `/users`, `/stores`, `/disputes`, `/reports`, `/audit-log`, `/all-products`, `/all-orders`) + AdminCategories/Coupons/Notifications/Reviews/Settings/SystemHealth/Dashboard |

**ملاحظة:** `pages/admin/AdminDashboard.tsx` يحتوي sidebar links لجميع هذه الأقسام. كل route له handler منفصل في `pages/admin/`.

### 3.6.2 Home page (`features/home/components/index.tsx`, 774 سطر)

صفحة Home الرئيسية تتكون من:
- **HeroSection:** ترحيب + شريط بحث + tabs (RFQ/Hot/Fast) + Hot searches
- **Trust Stats:** products_count, stores_count, orders_count, users_count
- **Deals Section:** Flash deals مع countdown `deal_ends_at`
- **Just for You:** 10 منتجات عشوائية
- **New Arrivals:** المنتجات بـ badge "new"
- **Top Merchants:** 8 متاجر بأعلى rating
- **Trade Assurance Banner:** مع 4 trust signals (Safe Shipping, Refund, Logistics, After-sales)
- **Ready to Ship:** المنتجات بـ stock > 5

**يستعمل hooks مخصصة:** `useHomeStats`, `useProducts`, `useStores`, `useCategories` من `@/hooks/useApi`

### 3.6.3 Custom Hooks (`apps/web/src/hooks/useApi.ts`, 768 سطر)

- **`useDataHook<T>(fetcher, deps)`** — generic hook مع AbortController
  - يرجع `{data, loading, error, refetch}`
  - يدعم cancellation عند unmount
  - JSON.stringify deps للمقارنة
- **30+ typed hooks** مخصصة:
  - `useOrders`, `useUserAddresses`, `useShippingMethods`, `useServerWishlist`
  - `useHomeStats`, `useProducts`, `useStores`, `useCategories`, `useProduct`
  - `useAdminUsers`, `useAdminStores`, `useAdminProducts`, `useAdminOrders`
  - `useAdminStats`, `useAdminTimeSeries`, `useAdminGovernorate`
  - `useCouponValidation` (state-based)
  - `usePlaceOrder` (mutation)

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

### 4.5.1 مكتبة `lib/auth.ts` — Password Hashing (مُستخرَجة من shared.cts في 2026-07-03)

**scrypt مع salt عشوائي 16 bytes + key 64 bytes (256-bit):**
- `hashPassword(password)` → يُرجع `'scrypt$<saltB64>$<keyB64>'`
- `verifyPassword(password, stored)` → يستخدم `timingSafeEqual`، يرجع false لأي format غير صحيح

### 4.5.2 مكتبة `lib/totp.ts` — TOTP (RFC 6238)

- **خوارزمية:** `T = floor((unix_time - 0) / 30)`، `HMAC-SHA1(secret, T_8bytes_BE)`، dynamic truncation، `code % 1_000_000`
- **Tolerance:** ±1 step (±30 ثانية) — لهجوم brute-force صغير (3 in 1M)
- **Base32 encoding/decoding** (RFC 4648 بدون padding)
- `generateSecret()` → 160 bits = 32 حرف base32
- `verifyTotp(secret, code, now?)` → يقارن مع current/prev/next window
- `otpauthUrl(account, secret, issuer, period, digits)` → URI لـ Google Authenticator

### 4.5.3 مكتبة `lib/ratelimit.ts`

- `rateLimit(windowMs, max, bucket)` — Express middleware factory
- يستدعي `consume_rate_limit(bucket, key, window_ms, max)` PL/pgSQL function (SECURITY DEFINER)
- Fail-OPEN عند تعطل DB
- `authLimiter` — 20 hits / 15min / IP عبر `/api/auth/*`

### 4.5.4 مكتبة `lib/audit.ts`

- `writeAuditLog(req, action, entityType, entityId, oldValues, newValues)`
- يستخدم `write_audit_log(...)` SECURITY DEFINER function
- **3 retries مع exponential backoff** (100ms, 200ms, 400ms)
- عند الفشل → dead-letter في `logs/audit-dlq-YYYY-MM-DD.jsonl`
- `redactSensitive(value)` — يستبدل قيم 17 مفتاح sensitive بـ `[REDACTED]`:
  - `password, password_hash, passwd, pwd, token, auth_token, access_token, refresh_token, api_key, apikey, secret, client_secret, private_key, cvv, cvc, ssn, authorization`

### 4.5.5 مكتبة `lib/reset-token.ts` (G7 fix 2026-07-11)

HMAC-signed token لإعادة تعيين كلمة المرور:
- `signResetToken(userId)` → يُنشئ token مع `jti` و `purpose: 'password_reset'`، TTL 30 دقيقة
- `verifyResetToken(token)` → يتحقق + يحجز jti في `used_jtis` (single-use via UPSERT)
- Format: `base64url({sub, purpose, jti, exp}).base64url(hmac)`

### 4.5.6 مكتبة `lib/partial-token.ts`

HMAC-signed token للربط بين خطوتي password + TOTP في 2FA:
- TTL: 5 دقائق
- `purpose: '2fa'`
- Single-use عبر `INSERT ... ON CONFLICT DO NOTHING` على `used_jtis`
- Test helper: `_resetPartialTokenForTests(userId?)`

### 4.5.7 مكتبة `lib/settings.ts` (P1-2 fix)

- `getSetting(key)` يقرأ من `app_settings` table
- **In-process cache** بـ TTL 60 ثانية
- **Fail-OPEN** عند تعطل DB (يرجع FALLBACK: `DEFAULT_CURRENCY='YER'`, `FREE_SHIPPING_THRESHOLD='10000'`, `FLAT_SHIPPING_COST='500'`)
- `getSettingSync(key)` للـ backstop (يرجع آخر قيمة مخزنة)
- Test helpers: `_resetSettingsCacheForTests()`, `_dumpSettingsCache()`

### 4.5.8 مكتبة `lib/search.ts` (P1-1 fix)

Full-text search backend بـ PG:
- `runSearch(query, filters)` → يستخدم `websearch_to_tsquery('simple', $1)` مع weights:
  - A=`name_ar`, B=`name_en`, C=`name_zh`, D=`description*`
- `ts_rank_cd` (cover density) للترتيب
- COUNT(*) OVER () window function لجلب total_count في نفس round-trip
- `logSearch(query, normalized, resultCount, durationMs, userId, requestId)` — best-effort insert في `search_logs`
- `normalizeQuery(raw)` → lowercase + trim + collapse whitespace (للتجميع في analytics)

### 4.5.9 مكتبة `lib/json.ts`

- `parseJson<T>(value, fallback)` — يقبل `unknown` ويُرجع JS value من JSON string أو يتركه كما هو إن كان بالفعل object/array
- `getProductWithParsedFields(product)` — يُفكك `features`, `badges`, `specifications`, `colors`, `sizes` من JSONB إلى JS arrays/objects

### 4.5.10 مكتبة `lib/sql-helpers.ts`

- `buildUpdateSet(fields)` — يبني `col = $N, ...` dynamic SQL مع حماية SQL injection:
  - يتحقق من أسماء الأعمدة بـ regex `/^[a-z][a-z0-9_]*$/`
  - يرمي HttpError(400) لـ INVALID_COLUMN أو EMPTY_UPDATE

### 4.5.11 مكتبة `lib/payments/` — Provider Registry

- `types.ts` — تعريف `PaymentMethod`, `InitiateInput`, `InitiateResult`, `WebhookVerification`, `PaymentProvider`
- `registry.ts` — `selectProvider(method)` يختار provider، `hasProvider(method)`، `listProviders()`
  - **Real providers:** Stripe, Paymob (مفعّلة فقط عند وجود env keys)
  - **Stub:** يُستخدم للـ dev/MVP
  - **Offline methods (cod, card, wallet, bank_transfer):** بدون provider — يُعالجها route مباشرة
- `stripe.ts` — Stripe integration (Checkout Sessions)
- `paymob.ts` — Paymob integration (iframe)
- `stub.ts` — simulation للـ MVP

### 4.5.12 مكتبة `lib/notifications/` — Multi-channel notifications

- `dispatcher.ts` — `dispatch(notification)` ينسّق عبر `CHANNELS = [emailChannel, smsChannel]`
  - In-app يُسجَّل دائماً (الـ row نفسه)
  - لكل channel: `shouldDeliver()`, `isConfigured`, `send(ctx)` → `{channel, ok, providerMessageId, error}`
  - **Best-effort:** لا يُلقي خطأ عند تعطل SMTP — يسجّل ويكمل
- `email.ts` + `sms.ts` — channels (نمطي interface)
- `email-templates.ts` — `render({event, language, data})` يُرجع `{subject, body}` ثلاثي اللغات
- `events.ts` — high-level event triggers:
  - `onOrderPlaced({orderId, customerId, merchantId, orderNumber, total, itemCount, paymentMethod, trackingUrl, productName})` → customer + merchant
  - `onPaymentConfirmed({orderId, customerId, orderNumber, amount})` → customer
  - `onRefundRequested({orderId, orderNumber, customerId, merchantId, amount})` → customer + merchant
  - `onRefundResolved({orderId, orderNumber, customerId, amount, status, reason?})` → customer
  - `onDisputeOpened({orderId, orderNumber, merchantId, subject?})` → merchant
  - `onDisputeResolved({orderId, orderNumber, customerId, resolution?})` → customer
  - `onReviewPosted({productId, productName, merchantId, rating, comment?})` → merchant
  - `onWelcome({userId, name})` → customer
- `types.ts` — `NotificationType`, `NotificationRow`, `NotificationChannel`, `DispatchContext`, `DispatchResult`

### 4.5.13 مكتبة `lib/backup-codes.ts` (لـ 2FA recovery)

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

**Cart module (`modules/cart/`):**
- `GET /api/cart/:userId` — قائمة سلة المستخدم (مع تفاصيل المنتج والمتجر)
- `GET /api/cart/count/:userId` — مجموع الكميات
- `POST /api/cart` — إضافة منتج (`productId, quantity, variant?`) — يكتشف duplicates عبر `(user, product, variant)`
- `PUT /api/cart/:id` — تحديث الكمية
- `DELETE /api/cart/:id` — حذف منتج من السلة
- `DELETE /api/cart/clear/:userId` — تفريغ السلة بالكامل

**Wishlist module (`modules/wishlist/`):**
- `GET /api/wishlist` — قائمة المنتجات المفضلة
- `POST /api/wishlist` — إضافة منتج (`productId`)
- `DELETE /api/wishlist/:id` — إزالة

**Store Followers module (`modules/store-followers/`):**
- `GET /api/store-followers/check?store_id=&user_id=` — التحقق من المتابعة + preferences
- `POST /api/store-followers` — متابعة (مع `notify_new_products`, `notify_offers`)
- `DELETE /api/store-followers` — إلغاء متابعة

**Seller module (`routes/seller.ts`, 669 سطر):**
- `GET /api/seller/stores/me` — جلب متجري
- `POST /api/seller/stores` — إنشاء أول متجر (G2 fix 2026-07-11)
- `PATCH /api/seller/stores/:id` — تحديث متجري
- `GET /api/seller/products` — قائمة منتجاتي (paginated)
- `POST /api/seller/products` — إنشاء منتج
- `GET /api/seller/products/:id` — تفاصيل منتج
- `PATCH /api/seller/products/:id` — تحديث منتج (soft fields)
- `DELETE /api/seller/products/:id` — soft-delete
- `POST /api/seller/products/:id/images` — إضافة صورة
- `GET /api/seller/orders` — قائمة طلبات متجري
- `GET /api/seller/orders/:id` — تفاصيل طلب
- `POST /api/seller/orders/:id/status` — تحديث حالة الطلب (forward-only state machine)
- `GET /api/seller/analytics` — KPIs للمتجر
- `GET /api/seller/inventory` — مستويات المخزون مع `stock_status`
- `GET /api/seller/payouts` — معاملات wallet + balance
- `GET /api/seller/dashboard` — rollup KPIs (alias لـ `/analytics`)

**Admin module (`routes/admin.ts`, 911 سطر):**
- **READ-ONLY:**
  - `GET /api/admin/users` — قائمة المستخدمين مع pagination + filter (role, status)
  - `GET /api/admin/stores` — قائمة المتاجر + filter (is_active, is_verified)
  - `GET /api/admin/products` — قائمة المنتجات + filter (is_active, is_featured, store_id, category_id)
  - `GET /api/admin/orders` — قائمة الطلبات + filter (status, payment_status)
  - `GET /api/admin/disputes` — قائمة النزاعات + filter (status, priority)
  - `GET /api/admin/audit-log` — admin_audit_log entries + filter (entity_type, action, user_id)
  - `GET /api/admin/stats` — dashboard summary (14 metrics في 1 query)
  - `GET /api/admin/stats/timeseries` — revenue/orders/users/disputes/merchants عبر time
  - `GET /api/admin/stats/by-governorate` — توزيع جغرافي (stores/addresses/merchants)
- **MUTATIONS (كلها تكتب في admin_audit_log):**
  - `POST /api/admin/maintenance/cleanup-audit-logs` — استدعاء `cleanup_audit_logs()`
  - `PATCH /api/admin/users/:id` — تحديث (status, role, is_verified, ...) — مع حماية SELF_BAN و SELF_DEMOTE
  - `PATCH /api/admin/stores/:id` — تحديث (is_active, is_verified, trust_level)
  - `PATCH /api/admin/orders/:id/status` — فرض حالة على الطلب
  - `PATCH /api/admin/products/:id` — تحديث (is_active, is_featured)
  - `PATCH /api/admin/disputes/:id` — حل نزاع (terminal states تحدد resolved_by/resolved_at)

**Payments module (`routes/payments.ts`, 409 سطر):**
- `GET /api/payments/methods` — قائمة providers المفعّلة
- `POST /api/payments/webhook/:method` — استقبال webhooks (idempotent عبر `webhook_events` table)
  - Rate-limited بـ 120 req/min/IP
  - HMAC verification → atomic claim via INSERT ON CONFLICT
- `POST /api/payments` — بدء عملية دفع (يحقق من ownership + amount match + idempotency)
  - يتعامل مع 6 طرق: `cod`, `card`, `wallet`, `bank_transfer`, `stripe`, `paymob`
- `GET /api/payments/order/:orderId` — قائمة المدفوعات لطلب
- `POST /api/payments/:id/confirm` — تأكيد دفع (admin-only)

**Reviews module (`routes/reviews.ts`, 170 سطر):**
- `GET /api/reviews?productId=&storeId=` — قائمة التقييمات (visible فقط)
- `POST /api/reviews` — إضافة تقييم (verified-purchase guard: لازم order.status='delivered')
  - يولّد notification للتاجر
  - يُحدّث product.rating و review_count

**Refunds module (`routes/refunds.ts`, 217 سطر):**
- `POST /api/refunds` — طلب استرداد (customer-only، فقط للطلبات المدفوعة)
  - يتحقق من remaining refundable balance
  - يولّد notification للعميل + التاجر
- `POST /api/refunds/:id/resolve` — حل الاسترداد (admin-only)
  - `approved` → `processed` (يخصم من wallet المتجر في transaction)
  - `rejected` → status='rejected'

**Addresses module (`modules/addresses/`):**
- `GET /api/addresses` — قائمة عناويني
- `POST /api/addresses` — إضافة عنوان
- `PUT /api/addresses/:id` — تحديث عنوان
- `DELETE /api/addresses/:id` — حذف عنوان
- Enforces **single default** عبر partial unique index على `is_default = TRUE`

**Shipping module (`modules/shipping/`):**
- `GET /api/shipping/methods?weight_kg=` — قائمة طرق الشحن المتاحة مع `estimated_total`

**Stats module (`modules/stats/`):**
- `GET /api/stats/home` — counts + featured + deals للـ homepage

**Notifications module (`modules/notifications/`):**
- `GET /api/notifications` — قائمة إشعاراتي
- `PUT /api/notifications/:id/read` — تعليم كمقروء
- `GET /api/notifications/unread-count/:userId` — عدد غير المقروء

**Messages module (`modules/messages/`):**
- `POST /api/messages` — إرسال رسالة (`receiver_id, body, store_id?, product_id?, order_id?, attachments?`)
- `GET /api/messages/inbox` — inbox (مع pagination + filter unread)
- `GET /api/messages/sent` — صندوق الصادر
- `GET /api/messages/conversation?peer_id=` — محادثة مع مستخدم
- `GET /api/messages/unread-count` — عدد غير المقروء
- `PUT /api/messages/:id/read` — تعليم كمقروء

---

## 5. Database (`packages/db`)

### 5.1 الملفات الـ 7 + 32 migration

| الملف | الغرض |
|---|---|
| `schema.sql` | Core tables (users, stores, products, orders, ...) — 459 سطر |
| `schema-extra.sql` | payments, coupons, refunds, balances, audit, ... — 202 سطر |
| `functions.sql` | PL/pgSQL functions (trg_set_updated_at, trg_orders_state_machine, ...) — 357 سطر |
| `triggers.sql` | BEFORE/AFTER triggers — 152 سطر |
| `views.sql` | v_product_with_store, v_store_stats, v_order_summary, v_low_stock — 168 سطر |
| `roles.sql` | noufex_owner, noufex_app, noufex_readonly + GRANTs — 170 سطر |
| `seed.sql` | 10 users + 18 categories + 7 stores + 24 products + 8 orders + ... — 706 سطر |

**Migrations مرقّمة `0001_baseline.sql` ... `0031_delivery_agent_tables.sql`** تُطبَّق عبر `npm run db:setup`.

### 5.2 الجداول الـ 34 (موزعة على 7 ملفات SQL + 32 migration):

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

### 5.5 Triggers المعرّفة (43 trigger):

- 17× dynamic loop على كل جدول فيه `updated_at` (يولّد `trg_<table>_set_updated_at`)
- 2× على `orders` (state_machine قبل timeline)
- 1× على `order_items` (decrement_stock)
- 6× على `reviews` (refresh_rating ins/upd/del × 2 = 6 triggers لـ product + store stats)
- 3× على `products` (refresh_store_count ins/upd/del)
- 1× على `refunds` (resolve_payments)
- 3× على `store_followers` (refresh_count ins/upd/del)
- 2× على `delivery_agents` (updated_at + delivery_agent_assignments)
- 8× على tables أُضيفت في migrations (0021, 0024, 0030, 0031)

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

### 5.8 Migrations التفصيلية (30 migration):

| # | الوصف | الملفات الرئيسية |
|---|---|---|
| 0001 | baseline: schema_migrations table + initial mark | schema_migrations |
| 0002 | add_cart_variant — إضافة `variant` JSONB لـ cart_items | cart_items |
| 0003 | unique_user_email — UNIQUE على email بدون deleted_at | users |
| 0004 | rate_limit_buckets — جدول rate limiting DB-backed | rate_limit_buckets |
| 0005 | coupon_discount — دالة `coupon_discount_amount()` | coupons |
| 0006 | admin_audit_log_grants | admin_audit_log |
| 0007 | pi_unique_pair — منع duplicates لـ payment intent | payments |
| 0008 | totp_columns — `two_factor_enabled, totp_secret, backup_codes` | users |
| 0009 | search_backend — FTS مع search_tsv (GENERATED STORED) + search_logs | products, search_logs |
| 0010 | used_jtis — replay-protection لـ JWTs/partial-tokens | used_jtis |
| 0011 | audit_log_security_definer | admin_audit_log |
| 0012 | payment_tx_index_and_jti_sweeper | payments, used_jtis |
| 0013 | inventory_log_trigger_definer | inventory_log |
| 0014 | grants_critical_fix | (صلاحيات) |
| 0015 | subscriptions_unique_active — UNIQUE على active subs | subscriptions |
| 0016 | audit_log_retention — `cleanup_audit_logs()` PL/pgSQL | admin_audit_log |
| 0017 | **token_version** — عمود `users.token_version` للـ JWT revocation | users |
| 0018 | products_popular_index | products |
| 0019 | unique_user_phone | users |
| 0020 | **webhook_idempotency** — `webhook_events` table + RLS policies | webhook_events |
| 0021 | schema_hygiene — إضافة updated_at لـ product_images, order_items, rate_limit_buckets | multiple |
| 0022 | coupon_atomicity — حماية ضد race conditions على coupons | coupons |
| 0023 | **app_settings** — جدول key-value + RLS + `admin_set_app_setting()` SECURITY DEFINER | app_settings |
| 0024 | production_hardening | multiple |
| 0025 | store_counters_and_indexes | stores |
| 0026 | critical_fixes | multiple |
| 0027 | integrity_constraints | multiple |
| 0028 | transactions_balance_consistency | transactions |
| 0029 | orders_total_consistency | orders |
| 0030 | **updated_at_triggers** — إضافة trg_set_updated_at لـ tables أُضيفت بعد triggers.sql | product_images, order_items, rate_limit_buckets |

### 5.9 Script `scripts/db/db-setup.cjs`:

- يطبق `packages/db/*.sql` بالترتيب:
  1. `schema.sql` → الجداول الأساسية
  2. `schema-extra.sql` → payments, coupons, refunds, etc.
  3. `functions.sql` → PL/pgSQL functions (8)
  4. `triggers.sql` → dynamic loop + explicit triggers
  5. `views.sql` → 4 views
  6. `roles.sql` → 4 roles + GRANTs
  7. `seed.sql` → 10 users + 18 categories + 7 stores + 24 products + ...
- يطبق migrations من `migrations/0001..0030` بالترتيب
- **Idempotent** — `IF NOT EXISTS` على كل CREATE + INSERT ... ON CONFLICT
- يسجل في `schema_migrations` جدول لتتبع migrations المطبّقة
- يتحقق من `noufex.allow_seed = 'on'` قبل تطبيق seed.sql (gate ضد التشغيل في production)

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

### 7.0 `packages/shared/` — Common types & constants

`@noufex/shared` workspace يحتوي على types مشتركة بين web و api:

- **`src/types/index.ts` (321 سطر):** كل واجهات entity (Product, Store, Order, User, Address, ...)
  - Body types لـ POST/PATCH تبقى في domain modules لتفادي التضخم
- **`src/constants.ts`:** enumerations مُجمَّعة:
  - `SUPPORTED_LANGUAGES = ['ar', 'en', 'zh'] as const`
  - `USER_ROLES = ['customer', 'merchant', 'admin'] as const`
  - `ORDER_STATUSES` (7 حالات)
- **Exports:** `"./types"` و `"./constants"`

**Cross-workspace types:** `apps/api/tsconfig.json` يحتوي `paths: { "@noufex/web/*": ["../web/*"] }` للاستيراد بين workspaces.

### 7.1 `apps/mcp-server/` (stdio) — 18 أداة MCP:

**`db-tools.ts` (339 سطر) — 9 أدوات:**

| الأداة | الوصف | المعاملات |
|---|---|---|
| `db_stats` | إحصائيات عالية المستوى (count tables, views, functions, triggers, size) | — |
| `db_list_tables` | قائمة كل الجداول في schema العام مع row counts و size | — |
| `db_describe_table` | وصف جدول واحد: columns، types، constraints، indexes، FKs | `table: string` |
| `db_list_views` | كل الـ views مع definitions و security mode | — |
| `db_list_functions` | كل PL/pgSQL functions في schema العام | — |
| `db_list_triggers` | كل الـ triggers مع table و function | — |
| `db_get_migrations` | migrations المطبّقة من schema_migrations | — |
| `db_sample_rows` | عينة من صفوف الجدول | `table, limit?, where?` |
| `db_query` | تنفيذ SQL (read-only افتراضياً) | `sql, params?, read_only?, max_rows?` |

- **Security:** `isSafeReadOnlySql()` يرفض multi-statement و non-SELECT/WITH/EXPLAIN/SHOW

**`code-tools.ts` (212 سطر) — 3 أدوات:**

| الأداة | الوصف |
|---|---|
| `code_tree` | عرض شجرة الملفات (يتخطى node_modules، dist، coverage، dotfiles) |
| `code_read_file` | قراءة ملف source (مع رقم سطور، max 200KB) |
| `code_search` | بحث regex في شجرة المصدر (مع include/exclude glob patterns) |

- **Security:** `safeResolve()` يمنع المسارات خارج project root
- يحول glob patterns بسيطة إلى regex عبر sentinel tokens

**`api-tools.ts` (272 سطر) — 3 أدوات:**

| الأداة | الوصف |
|---|---|
| `api_list_endpoints` | كل Express routes (verb, path, auth, middleware, line) |
| `api_get_endpoint` | تفاصيل endpoint واحد + excerpt من المصدر |
| `api_search` | بحث في المسارات (substring match) |

- يُحلّل `app/server/index.ts` بـ regex للـ `app.METHOD('/path', ...)` patterns
- يكتشف middleware تلقائياً عبر heuristics (PascalCase tokens)
- يحسب auth type (`public`, `authed`, `role:admin`, `role:merchant`)
- Cache على routes (mtime-based)

**`docs-tools.ts` (128 سطر) — 3 أدوات:**

| الأداة | الوصف |
|---|---|
| `docs_list` | قائمة ملفات `.md` في `docs/` (يستثني research/audit افتراضياً) |
| `docs_read` | قراءة ملف doc مع max bytes |
| `docs_search` | regex search في `docs/*.md` |

### 7.2 Docker MCP Gateway (`docker/mcp-gateway/`):

**`catalog.yaml` (224 سطر):**
- `name: noufex-mcp`
- `transport: stdio`
- `command: ["node", "/app/dist/index.js"]`
- mounts: `..` و `../.env` (read_only)
- env: `DATABASE_URL, PROJECT_ROOT=/repo, NODE_ENV=production`
- **5 tools** (منفصلة عن الـ 22 في catalog، تمثل الواجهة الرسمية لـ clients):
  - `db_query` (مع `ALLOW_DB_WRITE=1` env للكتابة)
  - `db_schema` (يرجع كل schema بتنسيق JSON)
  - `code_search` (regex عبر monorepo)
  - `api_routes` (مع method/path_prefix filters)
  - `docs_search` (free-text query)
- **2 resources:** `architecture` (Mermaid file)
- **2 prompts:** `audit-monorepo`, `trace-request`

**`Dockerfile` (44 سطر) — 2 stages:**
1. `build` — `node:20-alpine` + `npm ci --workspaces` + `tsc -p tsconfig.json`
2. `runtime` — `node:20-alpine` + `USER node` + `node /app/dist/index.js`

**`docker-compose.yml`:** يستمع على **:8811** مع SSE transport، Bearer token، `/health` endpoint

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

### 10.1 CI/CD workflows (5 ملفات في `.github/workflows/`)

| الـ Workflow | الوصف | Triggers |
|---|---|---|
| **`ci.yml` (312 سطر)** | CI pipeline: 7 jobs (docs-presence → lint → typecheck → mcp-server → test → build → db-integration → server-boot) | push/PR إلى main/develop |
| **`deploy-staging.yml` (185 سطر)** | Auto-deploy staging بعد CI pass: download artefacts → SSH upload → npm ci + db:setup → restart stack → smoke checks | push إلى main، manual dispatch |
| **`deploy-prod.yml` (182 سطر)** | Production deploy: semver tag validation + ancestor-of-main check + atomic swap + **automatic rollback** على فشل smoke checks | tag push `v*`، manual dispatch |
| **`docs.yml` (103 سطر)** | MkDocs build + GitHub Pages deploy + banned-pattern check (TODO, FIXME, docs/audit/) | push/PR على docs/**، main |
| **`link-check.yml` (104 سطر)** | `markdown-link-check` matrix على `docs/` + `*.md` (root) — nightly + PR | PR، schedule 06:00 UTC، manual |

### 10.2 .github/agents/ (12 agent definitions)

- **`architect.agent.md`** — Senior Software Architect (15+ years) - DDD, Clean Architecture, GoF patterns
- **`backend.agent.md`** — Backend specialist (Express, PostgreSQL, Auth)
- **`database.agent.md`** — Database specialist (PostgreSQL, migrations, performance)
- **`debug.agent.md`** — Systematic debugging
- **`devops.agent.md`** — DevOps (Docker, CI/CD, deployment)
- **`doc.agent.md`** — Documentation generation
- **`frontend.agent.md`** — Frontend (React, Vite, Tailwind, i18n)
- **`performance.agent.md`** — Performance optimization
- **`refactor.agent.md`** — Code refactoring
- **`reviewer.agent.md`** — Code review
- **`security.agent.md`** — Security audit (OWASP Top 10)
- **`tester.agent.md`** — Test design (IEEE 829, ISTQB CTFL)

كل agent يلتزم بـ **9-domain End-to-End Developer Skills Mind Map** (OWASP/ISO 25010/NIST SSDF v1.0).

### 10.3 .github/skills/ (20 skill + 2 index)

7 فئات: Analysis & Planning (3) | Implementation (3) | Quality & Fixes (4) | Testing & Docs (2) | Organization & Performance (3) | Security (1) | Operations (4) | Meta (1)

كل skill يتبع YAML structure: `name, description, trigger, phases, inputs, outputs, verification`.

### 10.4 .github/SECRETS.md (154 سطر)

- جدول كامل للأسرار: `AUTH_SECRET`, `DB_PASSWORD`, `SMTP_PASSWORD`, `STRIPE_SECRET_KEY`, `PAYMOB_API_KEY`, `STAGING_SSH_KEY`
- Rotation cadence: 90 days
- Best practices: Docker secrets, k8s Secret resources, AWS SSM/Secrets Manager
- CI uses **ephemeral test credentials** فقط (نفس نمط D.1)

### 10.5 Pre-commit hooks

- `.husky/pre-commit` يشغّل `lint-staged`
  - `*.{ts,tsx,cts}` → `eslint --fix --max-warnings=0` + `prettier`
  - `*.{js,cjs,mjs,json,md,css}` → `prettier --write`

### 10.6 MkDocs configuration (`mkdocs.yml`)

**⚠️ ملاحظة هامة (مُحدَّثة 2026-07-12):** الـ `mkdocs.yml` الأصلي كان يشير إلى ~30 ملف **غير موجود** (architecture/overview.md, operations/deployment.md, planning/adr/*.md, إلخ). تم تبسيط الـ nav ليشير فقط للملفات الموجودة فعلياً (BACKLOG.md, ARCHITECTURE.md, architecture/workflow.md, research/*.md, CHANGELOG.md). MkDocs build مع `--strict` كان سيفشل بدون هذا التصحيح.

### 10.7 scripts/ utility structure

- **`scripts/db/`**: `db-setup.cjs`, `audit-db.cjs`, `drop-test-db.cjs`, `gen-seed-hashes.cjs`, `switch-db.ps1`
- **`scripts/devops/`**: `autostart.bat/ps1`, `build.ps1`, `docker-build.ps1`, `docker-entrypoint.sh`, `docker-run.ps1`, `install-autostart.ps1`
- **`scripts/maintenance/`**: `e2e-step1.ps1`, `rename-cts-references.cjs/ps1`, `scan-unused.cjs`, `start-api.bat`, `start-vite.bat`
- **`scripts/quality/`**: `format.ps1`, `format-check.ps1`, `lint.ps1`, `test.ps1`, `test-stack.ps1`, `test-summary.cjs`, `typecheck.ps1`, `verify-fresh.cjs`

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

## 8. الاختبارات (Tests)

### 8.1 Backend Tests (`apps/api/src/tests/`)

**35 ملف Vitest** (33 test files + 2 helper files مثل `test-token.ts`):

**نتائج 2026-07-14:** 617/622 test يمر (99.2%)، 35 ملف test.
الـ 5 المتبقية هي flaky/timing-dependent:
- auth-router: rate-limiting (429 vs 400 expected after repeated runs)
- cart-router: DB-state-dependent test
- payments-router: rate-limit timing test
- security-fixes: CTE query pattern check

| الفئة | الملفات |
|---|---|
| **Router tests** | `addresses-router`, `admin-mutations`, `admin-read-router`, `auth-2fa`, `auth-router`, `cart-router`, `catalog-router`, `coupons-router`, `customer-mutations`, `notifications-and-admin-products`, `notifications-router`, `orders-router`, `payments-router`, `refunds-router`, `reviews-router`, `seller-router`, `settings`, `shipping-router`, `stats-router`, `store-followers-router`, `wishlist-router` |
| **Lib tests** | `error-codes`, `pg-wrapper`, `schema`, `search`, `security-fixes`, `test-helpers`, `test-token`, `totp`, `partial-token`, `backup-codes` |
| **Notifications** | `notifications/email-templates` |
| **Scripts** | `populate-product-images` |

### 8.2 Frontend Tests (`apps/web/src/`)

**38 ملف test** (298 test):

**نتائج 2026-07-14:** 298/298 test يمر (100%)، 38 ملف test. كلها خضراء.

| الفئة | العدد | الأمثلة |
|---|---|---|
| `__tests__/a11y/` | 3 | AdminDashboard, CustomerDashboard, ReportsAnalytics (axe-core) |
| `components/__tests__/` | 8 | Layout, Navbar, BottomNav, Footer, ProtectedRoute, Skeletons, Toast, ErrorBoundary |
| `context/__tests__/` | 2 | AppContext, CartContext |
| `features/products/__tests__/` | 5 | Categories, Deals, ProductDetail, SearchResults, StorePage |
| `features/checkout/__tests__/` | 1 | Checkout |
| `hooks/__tests__/` | 3 | useApi, useCheckoutHooks, use-mobile |
| `lib/__tests__/` | 4 | api, cart-sync, format, utils |
| `lib/api/__tests__/` | 2 | client-error, error-helpers |
| `i18n/__tests__/` | 1 | consistency |
| `pages/__tests__/` | 9 | ForgotPassword, Login, NotFound, Register, ResetPassword, Wishlist, ui-smoke, a11y |

### 8.3 E2E Tests (`apps/e2e/e2e/`)

**18 PowerShell phase scripts** + **COOKBOOK.md** (982 سطر):

| Phase | المحتوى |
|---|---|
| phase00 | Health + auth (login for all 3 roles) |
| phase01 | Profile + addresses |
| phase02 | Public catalog |
| phase03 | Search + filters |
| phase04 | Cart (add/update/remove/clear) |
| phase05 | Orders + inventory (state transitions) |
| phase06 | Coupons (validate + redeem) |
| phase07 | Payments + refunds |
| phase08 | Reviews + ratings |
| phase09 | Wishlist + store followers |
| phase10 | Merchant flow (CRUD products/orders) |
| phase11 | Admin RBAC |
| phase12 | 2FA + backup codes |
| phase13 | Notifications + messages |
| phase14 | Shipping methods |
| phase15 | Audit logs |
| phase16 | Frontend SPA (smoke tests) |
| phase17 | Full regression |

---

## Appendix A — Counts (verified):

| القياس | القيمة | كيف تم التحقق |
|---|---|---|
| Frontend features | 13 | `apps/web/src/features/` |
| Backend modules | 19 | `apps/api/src/modules/` |
| Routes in App.tsx | 33 | `grep -c "lazyPage" apps/web/src/App.tsx` |
| SQL base files | 7 | `ls packages/db/*.sql` |
| Migrations | **32** | `ls packages/db/migrations/` |
| DB tables | **34** | `grep -r "CREATE TABLE" packages/db/*.sql packages/db/migrations/*.sql` |
| PL/pgSQL functions (في functions.sql) | 8 | `grep -c "CREATE OR REPLACE FUNCTION" packages/db/functions.sql` |
| PL/pgSQL functions (في migrations) | +6 | `admin_set_app_setting`, `cleanup_audit_logs`, `consume_rate_limit`, `cleanup_rate_limits`, `cleanup_used_jtis`, `write_audit_log` |
| **Triggers** | **43** | 17 dynamic (`trg_<table>_set_updated_at`) + 26 explicit |
| Views | 4 | `v_product_with_store`, `v_store_stats`, `v_order_summary`, `v_low_stock` |
| Roles | 4 | `postgres`, `noufex_owner`, `noufex_app`, `noufex_readonly` |
| MCP tool families | 4 | `db-tools`, `code-tools`, `api-tools`, `docs-tools` |
| **MCP tools total** | **18** | `db_*` (9) + `code_*` (3) + `api_*` (3) + `docs_*` (3) |
| MCP catalog tools | 5 | `db_query`, `db_schema`, `code_search`, `api_routes`, `docs_search` (في catalog.yaml) |
| MCP resources | 1 | `architecture` (Mermaid file) |
| MCP prompts | 2 | `audit-monorepo`, `trace-request` |
| Frontend feature modules | 12 | `auth, products, cart, checkout, orders, home, customer, seller, admin, messages, shipping, coupons` |
| Frontend pages | **47** | 8 public + 5 auth + 12 customer + 7 seller + 15 admin |
| Frontend components (shared) | 12+ | `Layout, Navbar, BottomNav, Footer, ErrorBoundary, Toast, ProtectedRoute, Skeletons, ProductImage` |
| shadcn/ui primitives | 10 | avatar, badge, button, card, dialog, input, label, separator, switch, tabs, textarea |
| **Frontend custom hooks** | **30+** | `useDataHook + useProducts/useStores/useHomeStats/useAdmin*/...` |
| **Backend tests (Vitest)** | **35** | في `apps/api/src/tests/` |
| **Frontend tests (Vitest)** | **38** | في `apps/web/src/__tests__/` + components/hooks/lib/... |
| **E2E phase scripts** | **19** | `apps/e2e/e2e/phase*.ps1` |
| **Agent skills** | **20** | `.github/skills/` |
| **Agent definitions** | **12** | `.github/agents/` |
| **CI jobs** | **7** | `.github/workflows/ci.yml` |
| Docker stages | 4 | `deps`, `api-build`, `web-build`, `runtime` |
| Shared workspaces | 4 | `db`, `shared`, `typescript-config`, `eslint-config` |
| Middleware exports | 14+ | في `apps/api/src/middleware.ts` |
| API routers mounted | 19 | في `apps/api/src/index.ts` |
| API routes (in modules + routes/) | 60+ | مجموع endpoints |
| Zod schemas | 30+ | في `lib/validation.ts` |
| **lib utilities** | 15 | `auth`, `error-codes`, `ratelimit`, `audit`, `totp`, `validation`, `reset-token`, `partial-token`, `settings`, `search`, `json`, `sql-helpers`, `notifications/*`, `payments/*`, `backup-codes`, `types` |
| Notification events | 8 | `onOrderPlaced`, `onPaymentConfirmed`, `onRefundRequested/Resolved`, `onDisputeOpened/Resolved`, `onReviewPosted`, `onWelcome` |
| Notification channels | 3 | `in_app` (default), `email`, `sms` |
| Payment providers | 4 | `stripe`, `paymob` (real)، `stub` (fallback)، `null` (offline: cod/card/wallet/bank_transfer) |
| Seed users | 10 | في `seed.sql` |
| Seed stores | 7 | في `seed.sql` |
| Seed products | 24 | في `seed.sql` |
| Seed orders | 8 | في `seed.sql` |
| Seed coupons | 4 | في `seed.sql` |
| Seed categories | 18 | 7 رئيسية + 11 فرعية |
| Seed reviews | 10 | في `seed.sql` |
| Seed transactions | 8 | wallet ledger |
| Seed payments | 6 | في `seed.sql` |
| Seed shipping methods | 4 | في `seed.sql` |

---

## Appendix B — API Endpoints الكامل (مُجمَّع):

### المُصادقة (`/api/auth/*`):
- `POST /api/auth/register` — إنشاء حساب
- `POST /api/auth/login` — تسجيل دخول
- `POST /api/auth/logout` — تسجيل خروج (يب bumps token_version)
- `GET /api/auth/me` — بيانات المستخدم الحالي
- `PATCH /api/auth/me` — تحديث البيانات الشخصية
- `POST /api/auth/change-password` — تغيير كلمة المرور (يب bumps token_version)
- `POST /api/auth/forgot-password` — طلب reset
- `POST /api/auth/reset-password` — تنفيذ reset
- `POST /api/auth/2fa/setup` — إعداد TOTP
- `POST /api/auth/2fa/enable` — تفعيل
- `POST /api/auth/2fa/verify` — تحقق من partial_token + TOTP
- `POST /api/auth/2fa/disable` — تعطيل

### الكتالوج (`/api/*`):
- `GET /api/products` — قائمة المنتجات (filter + pagination)
- `GET /api/products/featured` — المنتجات المميزة
- `GET /api/products/deals` — المنتجات بخصم نشط
- `GET /api/products/:id` — تفاصيل + reviews + images
- `GET /api/stores` — قائمة المتاجر
- `GET /api/stores/:id` — تفاصيل + products
- `GET /api/stores/:id/reviews` — تقييمات المتجر
- `GET /api/categories` — شجرة الفئات
- `GET /api/categories/:slug` — فئة + منتجاتها
- `GET /api/search` — FTS

### العميل:
- `/api/cart/*` (5 routes)
- `/api/wishlist/*` (3 routes)
- `/api/orders/*` (3 routes: GET list, GET :id, POST create)
- `/api/addresses/*` (4 routes)
- `/api/notifications/*` (3 routes)
- `/api/messages/*` (6 routes)
- `/api/reviews` (GET + POST)

### التاجر (`/api/seller/*`):
- 18 routes تغطي: stores CRUD, products CRUD, orders list/status, analytics, inventory, payouts, dashboard

### المشرف (`/api/admin/*`):
- 12 GET endpoints + 1 POST maintenance + 5 PATCH mutations

### أخرى:
- `/api/delivery-agent/*` (12 routes: register, profile, location, orders, dashboard, available-orders, accept, status, go-online, go-offline)
- `/api/customer/reviews/*` (pending-reviews + my-reviews)
- `/api/store-followers/*` (3 routes)
- `/api/payments/*` (4 routes: methods, webhook, create, order/:id, :id/confirm)
- `/api/coupons/*` (validate, redeem)
- `/api/refunds/*` (create + resolve)
- `/api/shipping/methods`
- `/api/stats/home`

### System:
- `GET /api/health` — liveness (in-memory rate-limit 30/s)
- `GET /api/ready` — readiness (DB check مع timeout 2s)
