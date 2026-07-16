# Noufex — Competitive Architecture Analysis

> دراسة مقارنة لبنية منصات التجارة الإلكترونية الكبرى واستخلاص الأنماط
> القابلة للتطبيق على Noufex (Yemen & Middle East B2B/B2C marketplace).

---

## 1. Alibaba / Taobao / Tmall

### البنية المعروفة (من المصادر العامة):

**Alibaba.com (B2B international):**
- **Frontend:** Taro (React cross-compiler → H5 + WeChat mini-program + RN)
- **Backend:** Java + Spring + Dubbo (RPC) + RocketMQ (message queue)
- **Database:** OceanBase (distributed SQL، compatible with MySQL)
- **Search:** HA3 + iGraph (proprietary search engines)
- **Cache:** Tair (Redis-like KV store) + ApsaraDB for Redis
- **Storage:** OSS (Object Storage) + Pangu (distributed file system)
- **CDN:** Alibaba Cloud CDN + WAF

**Taobao / Tmall (B2C):**
- **Frontend:** Weex (Vue-like → H5 + native) → تحوّل لاحقاً إلى Rax + icesjs
- **Backend:** Java + Spring + Dubbo
- **Database:** OceanBase + MySQL + HBase + TiDB (بحسب الـ tier)
- **Cache:** Tair + Codis (Redis cluster) + ApsaraDB
- **Message queue:** RocketMQ + Notify (داخلي)
- **Search:** HA3 (محرك بحث مخصص) + Elasticsearch لبعض الـ use cases
- **Config/Coordination:** Diamond + ZooKeeper
- **Real-time:** Notify + metaQ

### الأنماط المستفادة لـ Noufex:

| النمط | التطبيق على Noufex |
|---|---|
| **Taro/RN code-sharing** | إنشاء `apps/mobile` بـ Expo (React Native) مع shared types من `@noufex/shared` |
| **Dubbo (RPC)** | حالياً REST كافٍ، لكن `internalService.ts` لخدمات Node-to-Node (admin tasks) |
| **RocketMQ** | RabbitMQ (PMQ compatible) للـ async jobs (notifications, indexing, analytics) |
| **Tair (Redis-like)** | Redis للـ caching، sessions، pub/sub، rate-limit upgrade |
| **OceanBase** | PostgreSQL 17 + partitioning للـ orders/products كبديل عملي |
| **HA3 Search** | Elasticsearch (open-source) مع multi-language analyzers + faceted search |
| **Config center** | `app_settings` table (موجود) + Redis cache (P1-2 fix) |

---

## 2. Amazon

### البنية المعروفة (من ورقة Jeff Barr + re:Invent talks):

- **Frontend:** React + TypeScript + custom design system
- **Backend:** Java + Spring + AWS SDK
- **Database:** DynamoDB (NoSQL) + Aurora (MySQL-compatible) + RDS
- **Cache:** ElastiCache (Redis/Memcached) + DAX (DynamoDB Accelerator)
- **Search:** OpenSearch (forked from Elasticsearch) + CloudSearch
- **Message queue:** SQS + SNS + EventBridge
- **CDN:** CloudFront + Route 53
- **Storage:** S3 + Glacier
- **ML/AI:** SageMaker + Bedrock
- **Auth:** Cognito + IAM

### الأنماط المستفادة لـ Noufex:

| النمط | التطبيق على Noufex |
|---|---|
| **DynamoDB single-table** | PostgreSQL views (`v_product_with_store`, `v_order_summary`) للقراءة السريعة |
| **ElastiCache** | Redis للـ hot data (products, categories, stats) + cache-aside pattern |
| **SQS decoupling** | RabbitMQ (مع DLQ) لفصل الـ side-effects عن الـ request flow |
| **CloudFront CDN** | Cloudflare CDN (بديل مرن + أقل تكلفة) |
| **S3 + signed URLs** | S3-compatible (R2 / MinIO) لـ product images مع presigned URLs |
| **SageMaker** | (مستقبلي) ML للـ product recommendations + search ranking |
| **EventBridge** | RabbitMQ exchanges متعددة: `order.events`, `user.events`, `product.events` |
| **Cognito + IAM** | JWT-based auth (موجود) + role-based access (موجود) |

---

## 3. Noon (Middle East competitor)

### البنية المعروفة (من مدوّنة Noon الهندسية + LinkedIn engineering posts):

- **Frontend:** React + Next.js (Web) + React Native (mobile)
- **Backend:** Node.js (Express/NestJS) + Python (ML/data) + Go (infra)
- **Database:** PostgreSQL + MongoDB (catalog variants)
- **Cache:** Redis + Memcached
- **Search:** Elasticsearch + OpenSearch
- **Message queue:** RabbitMQ + Kafka (لـ analytics)
- **CDN:** Cloudflare + Akamai
- **Storage:** S3 + Cloudflare R2
- **Payment:** HyperPay + Checkout.com + PayPal
- **Logistics:** Last-mile tracking system داخلي

### الأنماط المستفادة لـ Noufex:

| النمط | التطبيق على Noufex |
|---|---|
| **Node.js stack** | ✅ مطابق — Noufex API بالفعل Express 5 + Node 20 |
| **PostgreSQL** | ✅ مطابق — Noufex DB بالفعل PostgreSQL 17 |
| **Redis** | إضافة caching layer + pub/sub |
| **Elasticsearch** | بحث متقدم (autocomplete, fuzzy, faceted) |
| **RabbitMQ** | معالجة async (orders, notifications, indexing) |
| **Cloudflare** | CDN + WAF + bot protection + image optimization |
| **React Native** | mobile app + shared business logic |
| **Multi-region** | (مستقبلي) UAE + KSA + Egypt deploy targets |

---

## 4. الاستراتيجية المُعتمدة لـ Noufex

نظراً لأن Noufex يعمل في **اليمن والشرق الأوسط** بمتطلبات:
- **بنية تحتية محدودة** (لا OceanBase، لا DynamoDB، لا AWS region قريبة)
- **ميزانية متواضعة** مقارنة بـ Alibaba/Amazon
- **فريق صغير** (few engineers)
- **متطلبات قابلية التوسع** (B2C marketplace قابل للنمو)

### الترقيات المختارة (ترتيب الأولوية):

| # | التقنية | المبرر | الجهد | الأثر |
|---|---|---|---|---|
| 1 | **Redis** | cache + rate-limit + pub/sub | منخفض | عالٍ |
| 2 | **RabbitMQ** | async + DLQ + retry | متوسط | عالٍ |
| 3 | **Elasticsearch** | search quality + faceted + geo | متوسط | عالٍ |
| 4 | **Cloudflare** | CDN + WAF + images | منخفض (config) | متوسط |
| 5 | **React Native (Expo)** | mobile + share web code | عالٍ | عالٍ |

### مبادئ التصميم:

1. **Backward compatibility:** كل ترقية تعمل كـ optional enhancement.
   إذا كان Redis غير متاح → fallback للـ DB.
2. **Fail-OPEN:** لا ترقية يجب أن تكسر user experience.
3. **Gradual rollout:** كل خدمة لها env flag (`REDIS_URL`, `RABBITMQ_URL`, `ELASTICSEARCH_URL`).
4. **Shared types:** types بين web/mobile/api عبر `@noufex/shared`.
5. **Testable:** كل طبقة لها mock/in-memory adapter للاختبارات.
6. **Observability:** structured logs + health endpoints + metrics.

### المخطط النهائي:

```
┌──────────────────────────────────────────────────────────────┐
│  Client (Web PWA + RN Mobile + future Desktop)              │
└────────────────────┬─────────────────────────────────────────┘
                     │ HTTPS (Cloudflare CDN/WAF)
                     ▼
┌──────────────────────────────────────────────────────────────┐
│  Express API (Node 20 + TypeScript)                          │
│  ├─ Middleware: request-id, security, CORS, CSRF, auth       │
│  ├─ Routes: 22 modules + admin + seller + customer          │
│  ├─ Cache layer (Redis) ← NEW                                │
│  ├─ Search service (Elasticsearch) ← NEW                     │
│  └─ Event bus (RabbitMQ) ← NEW                               │
└────────┬─────────────┬──────────────┬──────────────┬────────┘
         │             │              │              │
         ▼             ▼              ▼              ▼
   ┌──────────┐  ┌──────────┐  ┌──────────────┐  ┌──────────────┐
   │PostgreSQL│  │  Redis   │  │ Elasticsearch│  │   RabbitMQ   │
   │   17     │  │   7.x    │  │     8.x      │  │   3.13+      │
   └──────────┘  └──────────┘  └──────────────┘  └──────┬───────┘
                                                       │
                                                       ▼
                                          ┌──────────────────────────┐
                                          │ Workers (Node, in-proc)  │
                                          │ ├─ Notification worker   │
                                          │ ├─ Email worker          │
                                          │ ├─ Search indexer        │
                                          │ └─ Analytics consumer    │
                                          └──────────────────────────┘
```

---

## 5. تفاصيل الترقيات (5 تقنيات)

### 5.1 Redis Caching Layer

**الهدف:** تخفيف الحمل عن PostgreSQL للبيانات التي تُقرأ بكثرة.

**ما يتم تخزينه:**
- `catalog:product:{id}` — TTL 5min (catalogRouter `GET /products/:id`)
- `catalog:category:tree` — TTL 1h (rarely changes)
- `catalog:store:{id}` — TTL 5min
- `stats:home` — TTL 30s (already has `Cache-Control: 30s`)
- `search:suggest:{prefix}` — TTL 1h (autocomplete)
- `ratelimit:ip:{ip}` — TTL = window (replaces DB-backed for hot paths)
- `session:user:{userId}` — TTL 7d (JWT denylist + role cache)
- `lock:order:{userId}` — distributed lock for stock decrement
- `pubsub:order.events` — real-time notifications to WebSocket clients

**Pattern:** Cache-aside (lazy load) + Write-through (invalidate on write).

**Backend:** `apps/api/src/lib/redis.ts` + `cache.ts` wrapper.

### 5.2 RabbitMQ Message Queue

**الهدف:** فصل العمليات غير المتزامنة عن request lifecycle.

**الـ Exchanges / Queues:**

| Exchange | Type | Queues | Use case |
|---|---|---|---|
| `noufex.orders` | topic | `order.placed`, `order.paid`, `order.shipped`, `order.delivered` | Order lifecycle events |
| `noufex.notifications` | fanout | `email.send`, `sms.send`, `push.send` | Multi-channel delivery |
| `noufex.search` | direct | `search.index`, `search.deindex` | ES sync |
| `noufex.analytics` | topic | `analytics.events`, `analytics.daily-rollup` | Event tracking |
| `noufex.audit` | fanout | `audit.archive` | Long-term audit storage |
| `noufex.webhooks` | direct | `webhook.retry` | Failed webhook delivery |

**Pattern:** Producer in route → durable exchange → consumer worker → DLQ on failure.

**Backend:** `apps/api/src/lib/queue.ts` + `apps/api/src/workers/*` consumers.

### 5.3 Elasticsearch Search Service

**الهدف:** بحث متقدم (autocomplete، fuzzy، faceted، geo).

**Indices:**
- `products_v1` — multi-language (ar/en/zh)، variants، specs JSON
- `stores_v1` — geo (lat/lon)، rating، hours
- `categories_v1` — translated names
- `users_v1` — admin search (autocomplete by email/name)

**Features:**
- Analyzers per language (Arabic analyzer, English standard, Chinese IK)
- Autocomplete (completion suggester)
- Faceted aggregation (category, price range, store, rating)
- Geo search (stores within X km)
- Synonyms (e.g., "هاتف" ↔ "جوال" ↔ "موبايل")

**Sync strategy:** CDC (Change Data Capture) via RabbitMQ → ES indexer worker.
Bootstrap: initial backfill via `npm run search:reindex`.

**Backend:** `apps/api/src/lib/elasticsearch.ts` + `apps/api/src/workers/search-indexer.ts`.

### 5.4 Cloudflare CDN + WAF

**الهدف:** caching للحافة + حماية DDoS + image optimization.

**الإعدادات:**
- DNS proxied عبر Cloudflare
- Page Rules:
  - `/api/products*` → Edge cache 60s (Browser TTL 30s)
  - `/api/categories*` → Edge cache 1h
  - `/assets/*` → Edge cache 1y (immutable, hashed)
  - `/api/*` (admin/auth) → Bypass cache
- WAF rules:
  - Rate limit (Cloudflare) لغير المصادقين
  - Block countries غير المستهدفة (Yemen, GCC, Egypt)
  - Bot Fight Mode
- Image optimization: `cdn-cgi/Image` resizing + WebP/AVIF
- Tiered Cache + Argo (لخفض latency)
- Transform Rules: add security headers

**Backend:** `cloudflare/config.yml` + Terraform (اختياري) + `_headers` لـ Vite build.

### 5.5 React Native Mobile App (Expo)

**الهدف:** تطبيق iOS + Android مع shared code.

**Stack:**
- **Expo SDK 51+** (managed workflow للسرعة)
- **React Navigation 7** (مطابق للـ web)
- **NativeWind 4** (Tailwind for RN)
- **React Query 5** (caching + offline)
- **i18next + react-i18next** (نفس ملفات الترجمة)
- **Expo SecureStore** (token storage)
- **Expo Notifications** (push)
- **Reanimated 3** (animations)

**Shared code:**
- `apps/mobile/` — Expo app
- `packages/shared/` — types + constants (already)
- `apps/mobile/src/api/` — fetch wrappers (نفس endpoints)
- `apps/mobile/src/i18n/` — نفس ملفات الترجمة

**Build:** EAS Build (cloud) → APK/IPA.

---

## 6. خطة التنفيذ (5-Phase Rollout)

### Phase 1: Redis (week 1)
- ✅ `lib/redis.ts` — connection + retry + cluster support
- ✅ `lib/cache.ts` — typed cache wrapper (get/set/del/wrap)
- ✅ integrate في catalog (products, categories, stores)
- ✅ integrate في stats (home page)
- ✅ rate-limit upgrade (Redis fallback)
- ✅ session/role cache (already in memory, move to Redis)

### Phase 2: RabbitMQ (week 1-2)
- ✅ `lib/queue.ts` — connection + publisher + consumer
- ✅ Exchanges + queues definitions
- ✅ Producer في orders route (on order placed)
- ✅ Workers: notification, email, search indexer
- ✅ DLQ + retry policy
- ✅ Backward compat: in-process queue if RabbitMQ down

### Phase 3: Elasticsearch (week 2-3)
- ✅ `lib/elasticsearch.ts` — connection + typed client
- ✅ Index mapping (products, stores, categories)
- ✅ Bootstrap script (initial backfill)
- ✅ Search route (autocomplete, faceted, geo)
- ✅ Indexer worker (consumes RabbitMQ events)
- ✅ Backward compat: PG FTS if ES down

### Phase 4: Cloudflare (week 3)
- ✅ `cloudflare/workers/cache-rules.js`
- ✅ Terraform config (optional)
- ✅ `_headers` file in Vite
- ✅ Cache rules documentation
- ✅ Image optimization guide

### Phase 5: React Native (week 4+)
- ✅ `apps/mobile/` Expo app
- ✅ Shared navigation + auth
- ✅ Product list + detail + cart
- ✅ Push notifications
- ✅ EAS build config

---

## 7. الـ Trade-offs المُتخذة

| القرار | البديل | السبب |
|---|---|---|
| Redis (self-host) | ElastiCache / Upstash | Cost-effective، self-contained |
| RabbitMQ (self-host) | SQS / Cloud Tasks | Open-source، portable، no vendor lock |
| Elasticsearch (self-host) | OpenSearch / Algolia | المعرفة الموجودة، OSS، full features |
| Cloudflare (free/pro) | CloudFront / Akamai | Cheaper، better image optimization، Middle East POPs |
| Expo (managed) | Bare RN | Faster development، OTA updates، simpler CI |

---

## 8. الـ Risks + Mitigations

| Risk | Mitigation |
|---|---|
| Redis OOM | LRU eviction policy + maxmemory config |
| RabbitMQ backpressure | Queue depth alerts + max-length policy |
| ES index drift | Periodic full reconciliation + version field |
| CF cache stale | Short TTLs + purge API on write |
| RN platform bugs | Expo managed + EAS crash reporting (Sentry) |
| Service unavailable | كل طبقة لها fallback (in-memory queue, DB cache, PG FTS) |

---

## 9. خارطة الطريق (Roadmap)

```
Q1 2026: Phase 1 + 2 (Redis + RabbitMQ)         ← الآن
Q2 2026: Phase 3 + 4 (Elasticsearch + Cloudflare)
Q3 2026: Phase 5 (React Native mobile)
Q4 2026: ML (recommendations, search ranking, fraud detection)
2027:    Multi-region + multi-currency + GraphQL gateway
```

---

## 10. ملخص تنفيذي

> Noufex يتبع **best-of-breed** approach: PostgreSQL + Redis + RabbitMQ + Elasticsearch + Cloudflare
> (من Noon/Amazon stack) مع **shared types + monorepo** (من Alibaba stack).
> هذا يوفر قابلية التوسع لـ millions of users بدون التضحية بـ developer velocity.
