# 📋 تقرير استكشاف تقني شامل — مشروع Nouf-ex

> **المشروع:** منصة تجارة إلكترونية B2B/B2C مقلّدة عن Alibaba/Taobao، موجّهة لليمن والشرق الأوسط.
> **تاريخ التقرير:** 2026-07-04
> **مُعدّ بواسطة:** Mavis (agent mode M3) — تحليل آلي شامل لكل ملفات المشروع.

---

## 1. 🧭 ملخص تنفيذي (Executive Summary)

| البُعد | القيمة |
|---|---|
| **نوع المشروع** | متجر إلكتروني متعدد البائعين (Marketplace) |
| **النطاق الجغرافي** | اليمن + الشرق الأوسط |
| **النموذج المُحاكى** | Alibaba / Taobao |
| **اللغات الرسمية** | العربية (افتراضي، RTL) + الإنجليزية + الصينية |
| **حجم قاعدة البيانات** | 25 جدول (16 أساسي + 9 إضافي) + 23 ترحيل + 7 دوال PL/pgSQL + 9 محفزات + 4 عروض + 3 أدوار |
| **عدد ترحيلات DB** | 23 ترحيل متسلسل (`0001` → `0023`) |
| **عدد Workflows في GitHub** | 4 (ci.yml, docs.yml, link-check.yml, deploy-staging.yml) |
| **عدد أدوات CI/CD** | GitHub Actions + Dependabot + release-please |
| **عدد الـ Skills في MCP** | 17 أداة (db_* × 9 + code_* × 3 + api_* × 3 + docs_* × 3) |
| **عدد الـ Extensions في VS Code** | 23 موصى بها، 36 غير مرغوب فيها |

---

## 2. 🏗️ البنية العامة للمشروع (Repository Structure)

```
nouf-ex/
│
├── app/                      # 🟢 تطبيق Node.js واحد (Front + Back)
│   ├── src/                  # 🎨 React 19 + Vite 7 (الواجهة الأمامية)
│   │   ├── components/       # مكونات قابلة لإعادة الاستخدام + ui/ (shadcn)
│   │   ├── context/          # AppContext (i18n + auth), CartContext
│   │   ├── data/             # بيانات JS احتياطية للبناء
│   │   ├── hooks/            # useApi, use-mobile
│   │   ├── i18n/             # locales/ar|en|zh.json + i18next setup
│   │   ├── lib/              # api.ts (عميل HTTP), jsonData.ts, utils.ts
│   │   └── pages/            # Home, Search, ProductDetail, StorePage, …
│   │       ├── admin/  auth/  customer/  seller/  Home/
│   ├── server/               # 🚀 Express 5 API (مستخرج)
│   │   ├── index.ts          # نقطة دخول Express
│   │   ├── db/pg-wrapper.cts # غلاف async pg.Pool
│   │   └── tests/            # api-server.test.ts, schema.test.ts
│   ├── tests/                # إعداد الواجهة + MSW mocks
│   ├── public/               # أصول ثابتة + JSON snapshots
│   └── package.json + configs (vite, vitest, eslint, tsconfig)
│
├── database/                 # 🐘 PostgreSQL 17 (مصدر الحقيقة)
│   ├── schema.sql            # 16 جدول أساسي
│   ├── schema-extra.sql      # 9 جداول إضافية (payments, coupons, refunds…)
│   ├── views.sql             # 4 عروض قراءة (security_invoker)
│   ├── functions.sql         # 7 دوال PL/pgSQL للمحفزات
│   ├── triggers.sql          # 9 تعريفات محفزات
│   ├── roles.sql             # noufex_app + noufex_owner + noufex_readonly
│   ├── seed.sql              # بيانات تجريبية (idempotent)
│   └── migrations/           # 23 ترحيل متسلسل
│
├── mcp-server/               # 🤖 خادم Model Context Protocol
│   ├── src/
│   │   ├── index.ts          # نقطة الدخول (stdio MCP server)
│   │   ├── project.ts        # CLI/env → ProjectContext
│   │   ├── db-tools.ts       # أدوات قاعدة البيانات (db_*)
│   │   ├── code-tools.ts     # أدوات استكشاف الكود (code_*)
│   │   ├── api-tools.ts      # أدوات فحص REST API (api_*)
│   │   └── docs-tools.ts     # أدوات قراءة الوثائق (docs_*)
│   └── scripts/              # smoke tests
│
├── scripts/                  # 🔧 أدوات مساعدة على مستوى المشروع
│   ├── db-setup.cjs          # يطبق pipeline الـ 8 ملفات + الترحيلات
│   ├── gen-seed-hashes.cjs   # يولد scrypt hashes للمستخدمين
│   ├── test-summary.cjs      # ينظف ملخص vitest
│   └── audit-db.cjs + format*.ps1 + build.ps1 + …
│
├── docker/
│   └── entrypoint.sh         # يشغّل الـ API داخل الـ container
│
├── docs/                     # 📚 وثائق Diátaxis (github pages)
│   ├── architecture/         # overview, api, database, security, SKILLS_MINDMAP
│   ├── development/          # workflow, conventions, ci-cd
│   ├── operations/           # docker, deployment, monitoring, backup
│   ├── planning/             # roadmap, risks, adr/
│   └── testing/              # README + phases/ (phase00..phase17)
│
├── .github/
│   ├── workflows/            # ci.yml, docs.yml, link-check.yml, deploy-*
│   ├── agents/               # 12 خبير ذكاء اصطناعي (agent)
│   ├── skills/               # 20+ skill.md للتدفقات
│   ├── prompts/              # قوالب prompts
│   ├── dependabot.yml        # تحديثات أسبوعية تلقائية
│   ├── copilot-instructions.md # تعليمات GitHub Copilot
│   ├── SECRETS.md, STANDARDS.md, branch-protection.md
│
├── .vscode/                  # ⚙️ إعدادات VS Code (settings, tasks, mcp, extensions)
├── .husky/                   # 🪝 Git hooks (pre-commit)
├── archive/                  # 📦 أرشيف تاريخي (audit/, research/, scripts-2026-07-fixes/)
│
├── Dockerfile                # 🐳 صورة الـ API (3 stages)
├── docker-compose.yml        # خدمة واحدة فقط: Nouf-ex (DB خارجي)
├── mkdocs.yml                # 📖 إعدادات توثيق Material
├── release-please-config.json # 🔖 إصدار آلي من Conventional Commits
├── requirements-docs.txt     # 📦 تبعيات Python لـ MkDocs
├── .markdown-link-check.json # فحص روابط Markdown
├── .markdownlint-cli2.jsonc  # قواعد فحص Markdown
└── .prettierrc + .prettierignore + eslint config
```

---

## 3. 💻 الـ Tech Stack بالتفصيل

### 3.1 الواجهة الأمامية (Frontend)

| الفئة | التقنية | الإصدار | ملاحظات |
|---|---|---|---|
| **الإطار** | React | `^19.2.0` | مع Strict Mode + أحدث JSX transform |
| **الراوتر** | React Router | `^7.6.1` | وضع data router، يدعم التحميل المسبق |
| **بناء** | Vite | `^7.2.4` | مع manualChunks ذكي (React, recharts, gsap, framer-motion, radix-ui, dates) |
| **اللغة** | TypeScript | `~5.9.3` | strict mode + verbatimModuleSyntax |
| **CSS** | Tailwind CSS | `^3.4.19` | + tailwindcss-animate |
| **مكونات UI** | shadcn/ui (مبنية على Radix UI) | أحدث | 28 primitive من `@radix-ui/*` |
| **أيقونات** | lucide-react | `^0.562.0` | tree-shaken (لا يدخل الـ barrel كله) |
| **نماذج** | react-hook-form | `^7.70.0` | مع @hookform/resolvers/zod |
| **رسوم بيانية** | recharts | `^2.15.4` | مفصول في chunk مستقل |
| **رسوم متحركة** | framer-motion + gsap | `^12.40` + `^3.15` | مفصولين لـ chunks مختلفة |
| **تاريخ/وقت** | date-fns + react-day-picker | `^4.1.0` + `^9.13.0` | مفصولين |
| **Carousel** | embla-carousel-react | `^8.6.0` | |
| **Drawer** | vaul | `^1.1.2` | |
| **رسائل Toast** | sonner | `^2.0.7` | |
| **OTP Input** | input-otp | `^1.4.2` | |
| **بحث/فلترة** | cmdk | `^1.1.1` | Command palette |
| **Drag & Resize** | react-resizable-panels | `^4.2.2` | |
| **Theme** | next-themes | `^0.4.6` | light/dark |
| **اتجاه CSS** | tw-animate-css | `^1.4.0` | |
| **PWA** | vite-plugin-pwa + Workbox | `^1.3.0` | autoUpdate, NetworkFirst للأبواب، CacheFirst للأصول |
| **i18n** | i18next + react-i18next | `^26.3.1` + `^17.0.8` | لغات: ar (افتراضي RTL) + en + zh |
| **Font detection** | i18next-browser-languagedetector | `^8.2.1` | |
| **خطوط ذاتية الاستضافة** | @fontsource/amiri, cairo, jetbrains-mono | `^5.2.*` | بدون طلبات لخارجي |
| **classVariance** | class-variance-authority + clsx + tailwind-merge | `^0.7.1` + `^2.1.1` + `^3.4.0` | نظام variants خاص بـ shadcn |

### 3.2 الخلفية (Backend)

| الفئة | التقنية | الإصدار |
|---|---|---|
| **وقت التشغيل** | Node.js | **20** (مثبت في `node:20-alpine`) |
| **إطار HTTP** | Express | `^5.2.1` (أحدث إصدار رئيسي) |
| **سائق PostgreSQL** | `pg` | `^8.22.0` |
| **CORS** | cors | `^2.8.6` |
| **متغيرات بيئية** | dotenv | `^17.4.2` |
| **تحقق من البيانات** | Zod | `^4.3.5` |
| **هاش كلمات المرور** | scrypt (مدمج في Node) | مع timingSafeEqual |
| **تخزين الرموز** | JWT-HMAC موقّع بـ `AUTH_SECRET` | ≥32 حرف |
| **Rate Limiting** | داخلي (rate_limit_buckets table + 0024) | بدون مكتبات خارجية |
| **بدون ORM** | استعلامات `pg` مباشرة مع Prepared Statements | لتفادي N+1 وSQL injection |
| **تنفيذ TS** | tsx | `^4.22.4` (للتطوير) |
| **تجميع** | esbuild | `^0.25.12` (ESM bundle للـ production) |

### 3.3 قاعدة البيانات

| البُعد | التفاصيل |
|---|---|
| **النظام** | PostgreSQL **17** (خدمة خارجية — ليست داخل Docker) |
| **قاعدة البيانات** | `noufex_db` |
| **عدد الجداول الأساسية** | 16 في `schema.sql` |
| **عدد الجداول الإضافية** | 9 في `schema-extra.sql` (payments, coupons, refunds, balances, audit_log, …) |
| **عدد العروض (Views)** | 4 (`v_product_with_store`, `v_store_stats`, `v_order_summary`, `v_low_stock`) — كلها `security_invoker` |
| **عدد الدوال PL/pgSQL** | 7 (تُستخدم كمحفزات + utility) |
| **عدد المحفزات (Triggers)** | 9 |
| **الأدوار (Roles)** | 3: `noufex_owner` (مالك), `noufex_app` (أقل صلاحيات — اتصال التشغيل), `noufex_readonly` (تحليلات) |
| **عدد الترحيلات** | **23 ترحيل** متسلسل من `0001_baseline` إلى `0023_app_settings` |
| **UUID** | `gen_random_uuid()` افتراضي لكل PK |
| **التواريخ** | `TIMESTAMPTZ` افتراضياً |
| **بيانات مرنة** | `JSONB` |
| **حماية كلمة المرور** | `scrypt$<salt_b64>$<hash_b64>` (في seed.sql) |
| **أمان** | `security_invoker` على العروض، least-privilege roles، محفزات مسجلة في `schema_migrations` |
| **Indexes خاصة** | يدعم البحث النصي (بحث + filters)، unique constraints على `users(email)` و `users(phone)` |
| **تحسينات الـ Migrations** | TOTP columns, used_jtis (JWT replay), audit_log retention, token_version, products_popular_index, … |

### 3.4 الـ MCP Server (الطبقة الإضافية)

> بروتوكول **Model Context Protocol** — يتيح لوكيل LLM فحص المشروع وقاعدة البيانات بدقة بشرية.

| الفئة | التفاصيل |
|---|---|
| **SDK** | `@modelcontextprotocol/sdk` `^1.0.4` |
| **النوع** | `module` (ESM) — يُجمَّع عبر `tsc -p tsconfig.json` |
| **النقل** | `StdioServerTransport` (stdio) |
| **الناتج** | `dist/index.js` قابل للتنفيذ (`bin: noufex-mcp`) |
| **17 أداة مقسمة إلى 4 عائلات** | |
| • `db_*` (9 أدوات) | `db_stats`, `db_list_tables`, `db_describe_table`, `db_list_views`, `db_list_functions`, `db_list_triggers`, `db_get_migrations`, `db_sample_rows`, `db_query` (افتراضي read-only) |
| • `code_*` (3 أدوات) | `code_tree`, `code_read_file` (max 200KB + path safety ضد traversal)، `code_search` (regex + glob) |
| • `api_*` (3 أدوات) | `api_list_endpoints`, `api_get_endpoint`, `api_search` — يحلل `app/server/index.ts` ويكتشف تلقائياً Middleware (requireAuth → `authed`, requireRole('admin') → `role:admin`) |
| • `docs_*` (3 أدوات) | `docs_list`, `docs_read` (max 120KB)، `docs_search` — مع `--include-research/--include-audit` |
| **الأمان** | قراءة فقط افتراضياً، SQLi check (يحجب `;` خارج الـ strings/comments)، استبدال كلمات المرور بـ `***`، صفر طلبات HTTP خارجية، `path.relative` لمنع القراءة خارج الجذر |
| **السجلات** | كل استدعاء → خط JSON واحد على stderr |
| **التسجيل في VS Code** | مهيّأ في `.vscode/mcp.json` (3 خوادم MCP) |

---

## 4. 🧰 أدوات التطوير (Tooling Matrix)

### 4.1 TypeScript & Type-checking

| الإعداد | التفاصيل |
|---|---|
| **tsconfig.json** | مرجع Composite Project يربط 3 sub-projects |
| **tsconfig.app.json** | ES2022 + JSX react-jsx + moduleResolution=bundler + verbatimModuleSyntax + noUncheckedSideEffectImports |
| **tsconfig.node.json** | بيئة Node side |
| **tsconfig.server.json** | ES2023 + module=ESNext + noUnusedLocals/Parameters صارم |
| **strict** | true في الكل مع `noFallthroughCasesInSwitch`, `noUncheckedSideEffectImports` |
| **alias** | `@/* → ./src/*` |
| **ignoreDeprecations** | 5.0 (تجاهل تحذيرات TS 5.0 deprecation) |

### 4.2 Linting & Formatting

| الأداة | الإصدار | الهدف |
|---|---|---|
| **ESLint** | `^9.39.1` (flat config) | قواعد TS + React Hooks + react-refresh/vite |
| **@typescript-eslint** | `^8.46.4` | قواعد TS recommended |
| **eslint-plugin-react-hooks** | `^7.0.1` | |
| **eslint-plugin-react-refresh** | `^0.4.24` | HMR validation |
| **globals** | `^16.5.0` | browser + node |
| **eslint.config.js** | كتلتان: Frontend (`**/*.{ts,tsx}`) + Server (`server/**/*.{ts,cts}`) | |
| **Prettier** | `^3.6.2` | format على الحفظ لكل اللغات (تم تعطيل formatOnSave العام، مفعّل فقط للـ TS/JS/CSS/HTML/MD/SCSS/YAML/JSON/JSONC) |
| **lint-staged** | `^17.0.8` | مع `*.{ts,tsx,cts}` → `eslint --fix` + `prettier` — و `*.{js,cjs,mjs,json,md,css}` → `prettier` فقط |
| **Max warnings** | `--max-warnings=0` (CI يفشل على أي تحذير) | |
| **Markdownlint** | `markdownlint-cli2` | `.markdownlint-cli2.jsonc` للقواعد |

### 4.3 Git Hooks & Commit Hygiene

| الأداة | التفاصيل |
|---|---|
| **Husky** | `^9.1.7` — `prepare` script يُفعّله عند `npm install` |
| **`.husky/pre-commit`** | يدخل `cd app` ثم `npx lint-staged` |
| **lint-staged** | شغّل ESLint --fix و Prettier --write على الملفات المُعدَّلة فقط |

### 4.4 Testing

| الطبقة | الأداة | التفاصيل |
|---|---|---|
| **Test Runner** | **Vitest 4** | `^4.1.9`، **مشروعان (projects)** في `vitest.config.ts`: `server` (Node env) + `dom` (happy-dom env) |
| **DOM emulation** | happy-dom `^20.10.6` | بديل خفيف لـ jsdom |
| **HTTP integration** | supertest `^7.2.2` + @types/supertest `^6.0.3` | |
| **Component tests** | @testing-library/react `^16.3.2` + user-event `^14.6.1` | |
| **Assertion** | @testing-library/jest-dom `^6.9.1` | matchers مخصصة |
| **API mocking** | MSW `^2.14.6` (Mock Service Worker) | |
| **Accessibility** | axe-core `^4.12.1` + vitest-axe `^0.1.0` | تكامل مع Vitest في `test:a11y` |
| **Coverage** | @vitest/coverage-v8 `^4.1.9` | text/html/json-summary |
| **E2E (مُخطط)** | playwright في قائمة Extensions (مسودة) | لم يُضبط كـ devDependency بعد |
| **.cts معاملة خاصة** | `esbuild.loader: 'tsx'` و `include: /server/.*\.[mc]?[jt]sx?$/` | يسمح بـ .cts كـ TS في الاختبارات |

**سكربتات الاختبار في app/package.json:**
```
npm test                → vitest run (الكل)
npm run test:unit       → يستبعد server/tests/api-server.test.ts
npm run test:a11y       → يقتصر على src/__tests__/a11y
npm run test:watch      → وضع المراقبة
npm run test:coverage   → مع تغطية
npm run test:ui         → واجهة Vitest
```

### 4.5 Build & Bundler

| الأداة | الدور |
|---|---|
| **Vite 7** | بناء الواجهة + dev server على البورت 3000 (proxy `/api` → 3000) |
| **Rollup manualChunks** | فصل React / recharts / gsap / framer-motion / radix-ui / dates |
| **esbuild** | تجميع Express server (`server/index.ts` → `server/index.js` ESM bundle) بـ `--packages=external` |
| **PWA** | vite-plugin-pwa + Workbox (NetworkFirst للصفحات بسبب CSP nonce، CacheFirst للأصول 30 يوم، StaleWhileRevalidate للصور 7 أيام) |
| **TypeScript build** | `tsc -b` (project references) |

### 4.6 Containerization & Deployment

| الأداة | التفاصيل |
|---|---|
| **Dockerfile** | 3 مراحل: `deps` (npm ci) → `build` (esbuild) → runtime (`node:20-alpine` + tini) |
| **Base image** | `node:20-alpine` |
| **PID 1** | `tini` (يستقبل إشارات SIGTERM بشكل سليم) |
| **User** | `node` (uid=1000) — تخلّي root |
| **Healthcheck** | يفحص `/api/health` كل 30s، timeout 10s، start-period 20s، retries 3 |
| **npm ci timeouts** | `npm_config_fetch_timeout=1800000` (تجاوز علة EIDLETIMEOUT لـ 877 حزمة) |
| **docker-compose.yml** | خدمة واحدة (`noufex`) — DB خارجي |
| **Network** | `extra_hosts: host.docker.internal:host-gateway` (Linux) |
| **env_file** | `.env` (gitignored) |
| **Healthcheck container** | نفس منطق Dockerfile |
| **Entrypoint** | `docker/entrypoint.sh` — ينتظر DB (TCP polling حتى 60s) ثم ينفّذ `node server/index.js` |
| **Production envs** | `NODE_ENV=production`, `HOST=0.0.0.0`, `API_PORT=3000`, `DB_SSL=true`, `SERVE_STATIC=true`, `STATIC_PATH=/app/dist`, `TRUST_PROXY`، `ALLOWED_ORIGINS`, `LOG_LEVEL=info` |

### 4.7 CI/CD (GitHub Actions)

**4 Workflows رئيسية:**

| الملف | المحفز | الوظائف |
|---|---|---|
| **`ci.yml`** | push/PR إلى main أو develop | 8 وظائف متسلسلة: `mindmap` → `lint` → `typecheck` → `test` → `build` → `a11y` → `db-integration` → `server-boot` |
| | • Job 0: **Mind map compliance** | يتحقق من `docs/architecture/SKILLS_MINDMAP.md` ≥ 10 من 12 معيار أكاديمي |
| | • Job 1: **Lint** | `--max-warnings=0` |
| | • Job 2: **Typecheck** | `tsc -b --noEmit` + mcp-server typecheck |
| | • Job 3: **Test** | `npm test` + a11y tests عبر vitest-axe، يحفظ coverage artifact (main فقط، 14 يوم) |
| | • Job 4: **Build** | vite SPA + esbuild API + mcp-server build، يحفظ artifacts (7 أيام) |
| | • Job 5: **a11y** | vitest-axe فقط (timeout 5min) |
| | • Job 6: **DB Integration** | postgres:17 service container، يطبق schema + seed + smoke query |
| | • Job 7: **Server Boot Smoke** | postgres:17 service container، يُشغّل API بـ tsx، يفحص `/api/health`, `/api/ready`, `/api/stats/home` ويتحقق من body shape (`status:ok` و `uptime_s`) |
| **Per-job parallelism** | `concurrency: cancel-in-progress: true` (عدا prod) |
| **Permissions** | least-privilege (`contents: read`، + `actions: read` للنشر) |
| **`docs.yml`** | push/PR إلى main على `docs/**` أو `mkdocs.yml`، أو يدوي | Python 3.12 + `pip install -r requirements-docs.txt` + `mkdocs build --strict` + verify no banned patterns (TODO/FIXME/docs/audit/،docs/research/) + `actions/upload-pages-artifact` + `actions/deploy-pages@v4` → GitHub Pages |
| **`link-check.yml`** | PR + nightly cron 06:00 UTC + workflow_dispatch | `markdown-link-check@3.12.2` — matrix: `docs` و `root` — يتخطى `archive/*` |
| **`deploy-staging.yml`** | push إلى main + workflow_dispatch | تسلسلي: تحقّق secrets → download build artifact → verify dist/index.html و server/index.js → SSH (webfactory/ssh-agent) → rsync artifacts → اكتب env + restart stack → انتظار health → smoke 3 endpoints → |

### 4.8 Scheduled Updates

| الأداة | التفاصيل |
|---|---|
| **Dependabot** (`dependabot.yml`) | يوم الإثنين 09:00 Asia/Aden |
| • npm `app/` | production + development groups (minor + patch)، open-PRs-limit=5 |
| • npm `mcp-server/` | open-PRs-limit=3 + label `mcp-server` |
| • GitHub Actions | group `actions-group`، open-PRs-limit=2 |
| **تجاهل التحديث التلقائي** | `express`, `pg`, `jsonwebtoken` (تتطلب مراجعة يدوية) |

### 4.9 Release Automation

| الأداة | التفاصيل |
|---|---|
| **release-please** (`release-please-config.json`) | release-type: node، package-name: `nouf-ex`, versioning: default |
| **pull-request-title-pattern** | `chore(main): release${scope} ${version}` |
| **Branches** | main |
| **Tags** | `v*.*.*` |
| **Extra files في الـ release** | `docs/MASTER_PLAN.md`, `docs/STRUCTURE.md` |
| **Packages** | `app/` (path: app, package-name: my-app) |
| **Standard** | Keep a Changelog 1.1.0 + SemVer + Conventional Commits |

### 4.10 Documentation Toolchain

| الأداة | الإصدار/التفاصيل |
|---|---|
| **MkDocs** | `mkdocs.yml` |
| **Theme** | **Material for MkDocs** — features: navigation.tabs, sections, indexes, top, footer, tracking, toc.follow, search.suggest/highlight/share, code.copy/annotate, tabs.link, tooltips, action.edit |
| **Palette** | Teal + Amber (ألوان مستوحاة من علم اليمن). light/dark + toggle |
| **Plugins** | search (langs: en/ar/zh + configurable separator), minify, git-revision-date-localized (enable_creation_date, type: date, fallback_to_build_date) |
| **Markdown Extensions** | admonition, attr_list, def_list, footnotes, md_in_html, tables, toc (permalink, toc_depth: 4), pymdownx.details/superfences/highlight/inlinehilite/snippets/tabbed/tasklist/keys/mark/tilde/caret/smartsymbols/emoji |
| **Strict mode** | true — يفشل على أي رابط داخلي مكسور |
| **Validation** | `links.not_found: warn`, `nav.omitted_files: warn`, `markup.failed_bodies: error` |
| **Exclude** | `archive/`, `archive/audit/`, `archive/research/` |
| **استضافة** | GitHub Pages عبر `actions/deploy-pages@v4` |
| **Python** | 3.12 (CI) |
| **requirements-docs.txt** | mkdocs + mkdocs-material + plugins |
| **GitHub Pages URL** | `https://nashwanzaher.github.io/nouf-ex/` |
| **التنظيم** | **Diátaxis**: Tutorials / How-to / Reference / Explanation / Planning / About |
| **Navigation root** | Home → Code of Conduct → Security → Tutorials → How-to → Reference → Planning → About |

### 4.11 VS Code Workspace Configuration

| الإعداد | التفاصيل |
|---|---|
| **`.vscode/settings.json`** | 454 سطر: إعدادات editor/typescript/tailwind/eslint/docker/sqltools/git/copilot |
| **Per-language formatters** | Prettier لـ TS/JS/CSS/HTML/MD/JSON، vscode.docker لـ Dockerfile، mssql لـ SQL |
| **TypeScript inlay hints** | 9 أنواع (parameter names, functionLike return types, variable types, property declaration types, parameter types, enum member values, …) |
| **Tailwind** | experimental.classRegex يلتقط `cva(...)` و `cn(...)` |
| **Editor** | bracketPairColorization, stickyScroll.maxLineCount=5, smoothScrolling, mouseWheelZoom |
| **Terminal** | PowerShell افتراضي + cmd |
| **Git** | autofetch كل 180s، inputValidationSubjectLength=72، inputValidationLength=120 |
| **Copilot Chat** | `chat.agent.contextWindow: 1000000`, `temperature: 0.2`, `anthropic.thinking.maxTokens: 32000`, `requestLimit: 1000`, `requestTimeout: 120000`, `streamingTimeout: 60000` |
| **`.vscode/tasks.json`** | 22 مهمة: docker stack، logs، exec، psql، db:setup، install، typecheck، esbuild build، vite build، vitest، vitest watch، coverage، eslint، start-api، start-vite، test-stack، markdownlint (4 variants) |
| **`.vscode/launch.json`** | تصحيح Node + Vitest |
| **`.vscode/mcp.json`** | 3 خوادم MCP: filesystem, sequential-thinking, memory (مكوّنات إضافية على noufex-mcp الخاص بالمشروع) |
| **`.vscode/extensions.json`** | 23 موصى بها (ESLint, Prettier, Tailwind, TypeScript Next, Jest Runner, Pretty TS Errors, React Snippets, Docker, SQLTools, Postgres, YAML, Code Spell Checker, Error Lens, GitLens, PR GitHub, Change Case, IntelliCode, REST Client, File Nesting, Path Intellisense, Auto Rename Tag, Vitest Explorer, Playwright, Python, Rainbow CSV, Filewatcher) |
| **`.vscode/extensions.json` (unwanted)** | 36 غير مرغوب: ai alternatives، MiniMax-related، duplicate DB/Docker tools، SQL Server، AWS، .NET، Terraform، Live Server، Kubernetes |

### 4.12 i18n Strategy

| الجانب | التفاصيل |
|---|---|
| **المكتبة** | i18next + react-i18next + i18next-browser-languagedetector |
| **اللغات** | `ar` (افتراضي، RTL) / `en` / `zh` |
| **Locale sources** | JSON في `src/i18n/locales/ar.json`, `en.json`, `zh.json` |
| **Fonts** | Amiri + Cairo + JetBrains Mono (self-hosted via @fontsource) |
| **HTML lang** | `<html lang="ar" dir="rtl">` |

### 4.13 AI Integration Tools

| العنصر | التفاصيل |
|---|---|
| **noufex-mcp** | خادم MCP مخصص (انظر 3.4) — يصل عبر `.vscode/mcp.json` |
| **خوادم MCP مثبتة عبر mcp.json** | filesystem, sequential-thinking, memory |
| **`docs/architecture/SKILLS_MINDMAP.md`** | خريطة المهارات (9 skill domains × 9 sub-domains × 4 مستويات ≈150 skill entry) — إلزامية لكل AI agent |
| **`.github/agents/`** | 12 وكيل خبير: architect, frontend, backend, database, security, tester, reviewer, devops, performance, refactor, doc, debug |
| **`.github/skills/`** | 20+ skill: analyze, plan, implement, refactor, fix, verify, organize, cleanup, api-design, scaffold, test, document, review, debug, test, secure, deploy, migrate, integrate, monitor, feasibility-study, noufex-project, standards-aware |
| **5-Phase Framework** | ANALYZE → PLAN → EXECUTE → VERIFY → DOCUMENT |
| **`.github/copilot-instructions.md`** | تعليمات GitHub Copilot (متضمنة MiniMax API keys لكن الإعداد الحالي يستخدم Claude/Mavis) |
| **release-please CHANGELOG auto-generated** | من Conventional Commits |

---

## 5. 🛡️ الأمان (Security Posture)

| الطبقة | التفاصيل |
|---|---|
| **HTTPS/TLS** | DB_SSL=true افتراضياً (sslmode=require) |
| **CORS** | قائمة `ALLOWED_ORIGINS` محددة (env-controlled) |
| **Helmet/Headers** | تم ذكر CSP nonce injection في `index.html` (per-request) |
| **Rate Limiting** | جدول `rate_limit_buckets` + 0024 migration + middleware داخلي |
| **JWT** | HMAC مع `AUTH_SECRET` ≥ 32 حرف (HMAC موقّع بـ buffer + timingSafeEqual) |
| **JTI Replay** | migration 0010 + migration 0012 (sweeper) — يحجب إعادة استخدام الرموز |
| **2FA/TOTP** | migration 0008 (TOTP columns) + 0017 (token_version) |
| **Password Hashing** | scrypt مدمج في Node (`scripts/gen-seed-hashes.cjs`) — لا يُستخدم أي library خارجي |
| **CSRF** | إعدادات Bearer-token فقط (لا cookies)، حماية CSRF أقل إلحاحاً |
| **Audit Log** | migration 0006 (audit_log grants) + 0011 (security_definer) + 0016 (retention) |
| **Roles** | least-privilege (3 أدوار) + noufex_app بدون write على audit_log |
| **Secrets** | `.env` (gitignored)، `CHANGE_ME` placeholders، 90-day rotation policy (`.github/SECRETS.md`) |
| **JWT secrets rotation** | كل تغيير للمفتاح → كل الرموز القائمة باطلة (العملاء يعيدون login) |
| **DB Password rotation** | `ALTER USER` ثم تحديث env + restart |
| **OWASP API Top 10** | متّبع (معروض في `.github/copilot-instructions.md` كالتزام) |
| **WCAG 2.1 Level AA** | axe-core automated tests في CI |

---

## 6. 📐 الالتزام بالمعايير (Standards Compliance)

| المعيار | كيفية التطبيق |
|---|---|
| **ISO/IEC/IEEE 12207:2017** | Life cycle processes (مذكور في copilot-instructions) |
| **ISO/IEC 25010:2011** | Quality model |
| **IEEE 829-2008** | Test documentation structure (`docs/testing/standards/IEEE-829.md`) |
| **ISO/IEC/IEEE 29119** | Software testing standards (`docs/testing/standards/ISO-29119.md`) |
| **ISTQB CTFL v4.0** | Test techniques (`docs/testing/standards/ISTQB-CTFL.md`) |
| **OWASP API Security Top 10 (2023)** | `docs/architecture/security.md` يغطّي الـ security model |
| **WCAG 2.1 Level AA** | vitest-axe gates الـ PR |
| **Diátaxis** | هيكل `docs/` بالكامل (Tutorials/How-to/Reference/Explanation) |
| **Keep a Changelog 1.1.0** | `CHANGELOG.md` + release-please automation |
| **Conventional Commits 1.0.0** | نمط commit messages + release-please parser |
| **Semantic Versioning 2.0.0** | tags `v*.*.*` |
| **Microsoft Docs style** | admonitions, tabs, step-by-step |
| **CMMI-style promotion** | skill level matrix (Junior / Mid / Senior) |
| **12-Factor App** | `Config` (env vars)، `Disposability` (tini) |
| **IEEE 29119-3** | Test documentation sub-section 8.4 (مذكور في mkdocs.yml) |

---

## 7. 🛠️ أدوات مساعدة ومسوّيات (Scripts & Tooling)

**ملفات PowerShell (`scripts/*.ps1`):**
- `build.ps1`, `lint.ps1`, `format.ps1`, `format-check.ps1`
- `test.ps1`, `test-stack.ps1`, `typecheck.ps1`
- `docker-build.ps1`, `docker-run.ps1`, `install-autostart.ps1`
- `autostart.ps1`, `switch-db.ps1`, `e2e-step1.ps1`
- `cross-check-helpers-doc.ps1`

**ملفات Batch (`scripts/*.bat`):**
- `start-api.bat`, `start-vite.bat`, `autostart.bat`

**CJS Helpers:**
- `db-setup.cjs` (تشغيل pipeline الـ 8 ملفات + 23 ترحيل)
- `gen-seed-hashes.cjs` (توليد scrypt hashes للـ seed users)
- `test-summary.cjs` (تنظيف vitest summary)
- `audit-db.cjs` (تدقيق DB)
- `verify-fresh.cjs` (تحقق من fresh setup)
- `drop-test-db.cjs` (حذف test DB)

**Bash:**
- `docker/entrypoint.sh` (انتظار DB + تشغيل server)

**Smoke Tests للمشروع:**
- `mcp-server/scripts/smoke-mcp.cjs` (basic)
- `mcp-server/scripts/smoke-mcp-full.cjs` (يختبر كل tool family)
- `mcp-server/scripts/smoke-search.cjs` (يختبر glob behaviour لـ `code_search`)

---

## 8. 🧪 بنية الاختبارات

```
app/tests/                       # Frontend setup
├── setup.ts                     # setupFile مشترك لـ Vitest
├── mocks/                       # MSW mocks
server/tests/                    # Server-side integration
├── api-server.test.ts
├── schema.test.ts
src/
├── __tests__/                   # tests mirrored next to src
│   └── a11y/                    # vitest-axe accessibility tests (≥16 test)
└── **/*.test.{ts,tsx}           # unit tests
```

**مستهدفات التغطية (من STANDARDS.md):**
- Statements ≥ 80%
- Branches ≥ 80%
- Functions ≥ 80%
- Lines ≥ 80%
- Critical paths (auth, payments) 100%

---

## 9. 📦 دورات الإصدار (Release Cycles)

| الإصدار | الآلية |
|---|---|
| **PR-time** | Lint + Typecheck + Tests (Vitest + axe) + Build + A11y + DB integration (on push) + Server boot (on push) |
| **Dependabot** | weekly الاثنين 09:00 Asia/Aden |
| **Release on main** | CI + Deploy to Staging (auto) |
| **Production Release** | Tag `vX.Y.Z` → workflow_dispatch → manual approval (2 reviewers + 5min wait timer) → deploy-prod.yml |
| **Rollback** | Revert deployment في Settings → Environments → production → Deployments |
| **Doc update** | MkDocs build → GitHub Pages (auto-deploy على push إلى main) |

---

## 10. 📊 إحصائيات المشروع (Project Stats)

| المقياس | القيمة |
|---|---|
| **عدد ملفات الـ TS/TSX** | غير محسوب بدقة (لكن الـ `package.json` يُظهر مئات الـ deps) |
| **عدد الـ Atomic dependencies** | 60+ dependencies في `app/package.json` |
| **عدد الـ devDependencies** | 45+ |
| **عدد الـ PWA settings** | NetworkFirst للصفحات + CacheFirst للأصول + StaleWhileRevalidate للصور |
| **عدد الـ Primitives من Radix** | 28 |
| **حجم bundle الأمثل** | manualChunks مفصولة (React, recharts, framer, gsap, radix-ui, dates) |
| **Pre-cache limit** | 10 MiB (مرفوع من 2 MiB الافتراضي) |
| **API port** | 3000 |
| **Vite dev port** | 5173 (مع auto-increment حتى 3000 محجوز) |
| **DB port** | 5432 |
| **Languages** | ar, en, zh |
| **Accessibility level** | WCAG 2.1 Level AA (axe enforced) |

---

## 11. 🗺️ خريطة الـ Workflow الكاملة (End-to-End Flow)

```
[1] Local dev setup:
    Developer → cp .env.example .env → cd app → npm install → npm run db:setup
                                                      ↓
    [2] Two modes:
        A) docker compose up -d --build (full stack via Docker)
        B) npm run api (Express:3000)  ||  npm run dev (Vite:5173 with proxy)
                                                      ↓
    [3] Code cycle:
        editor (VS Code + Copilot + noufex-mcp) → changes
                                                      ↓
    [4] Pre-commit:
        Husky → lint-staged → ESLint --fix + Prettier --write
                                                      ↓
    [5] Push → CI:
        mindmap → lint → typecheck → test (+a11y) → build → mcp-server build
            → db-integration (postgres:17) → server-boot smoke
                                                      ↓
    [6] PR merge → main:
        auto-deploy to staging (via SCP + docker compose restart)
        smoke checks via /api/health, /api/ready, /api/stats/home
                                                      ↓
    [7] tag vX.Y.Z → manual approval → deploy to prod
                                                      ↓
    [8] Post-deploy checks (within 30min):
        health, ready, E2E spec phase 0 + 16, audit log entry, etc.
                                                      ↓
    [9] Docs site:
        push to main on docs/** → docs.yml → mkdocs build --strict → GitHub Pages
                                                      ↓
    [10] Dependabot (weekly Monday 09:00):
        groups minor+patch → labeled `dependencies` → CI runs automatically
                                                      ↓
    [11] releases:
        release-please scans Conventional Commits → opens release PR
        → tag v*.*.* → CHANGELOG.md auto-generated
```

---

## 12. ✅ قائمة فحص للصحة (Checklist)

| الفحص | الحالة |
|---|---|
| Frontend builds (Vite) | ✅ في CI |
| API bundles (esbuild ESM) | ✅ في CI |
| TypeScript strict | ✅ 3 tsconfigs |
| ESLint flat config no warnings | ✅ `--max-warnings=0` |
| Prettier auto-format | ✅ على الحفظ |
| Husky + lint-staged | ✅ |
| Vitest tests | ✅ server + dom projects |
| vitest-axe a11y | ✅ CI gate |
| DB integration (postgres:17 service) | ✅ |
| Real-API boot smoke | ✅ |
| Docker multi-stage build | ✅ 3 stages + tini |
| docker-compose with healthcheck | ✅ |
| MkDocs strict | ✅ |
| Markdown link check (nightly cron) | ✅ |
| Dependabot weekly | ✅ |
| release-please | ✅ |
| Mind map compliance gate | ✅ ≥ 10 of 12 standards |
| Conventional Commits enforced | ✅ (release-please) |
| PWA (Workbox) | ✅ |
| i18n (3 لغات) | ✅ |
| SCrypt password hashing | ✅ |
| JWT HMAC with timingSafeEqual | ✅ |
| TOTP 2FA columns | ✅ |
| Rate limit buckets | ✅ |
| Audit log + retention | ✅ |
| JWT JTI replay protection | ✅ |
| Token version invalidation | ✅ |
| Idempotent DB setup | ✅ |
| MCP for AI introspection | ✅ |
| Architecture docs (Diátaxis) | ✅ |
| CJS for one-off scripts | ✅ |
| ESM for app + mcp-server | ✅ |
| TypeScript everywhere | ✅ |

---

## 13. 📌 ملاحظات وقيود (Notes & Caveats)

1. **`.github/copilot-instructions.md`** يحتوي **إعدادات MiniMax API** لكن لا يبدو مستخدماً في الواقع الحالي (هذا المشروع يُدار بـ Mavis/Claude).
2. **`vscode/settings.json`** يحتوي مئات الإعدادات الخاصة بـ Copilot مع نماذج MiniMax — هذه الإعدادات تخصّ إعداد GitHub Copilot الافتراضي في ذلك الـ workspace.
3. **Docker Postgres** غير مشمول — Postgres متوقّع أن يكون خارجياً (host أو حاوية أخرى).
4. **Playwright** مذكور في extensions.json لكن ليس devDependency بعد (E2E مخطط له).
5. **Rate-limiting** يعتمد على جدول DB بدلاً من Redis — تبسيط تشغيلي.
6. **لا ORM** — استعلامات `pg` خام مع prepared statements.
7. **Bundle الواحد للـ API** (`server/index.js`) — يحلّ مشكلة CJS↔ESM interop عند tsx.
8. **كل الـ tests** تقريباً بدون DB حقيقية (pg مُسوّى mock global).

---

## 14. 🔗 روابط مرجعية سريعة

- **الوثائق المنشورة:** <https://nashwanzaher.github.io/nouf-ex/>
- **المستودع:** <https://github.com/nashwanzaher/nouf-ex>
- **Docker Compose service name:** `Nouf-ex` (كبـ container_name)
- **API base path:** `/api/*`
- **Health endpoints:** `/api/health` (status, uptime_s) + `/api/ready` (db check)

---

> 🎯 **خلاصة:** Nouf-ex هو مشروع **متكامل، مؤتمت بالكامل، متّبع لمعايير أكاديمية متعددة**، يستخدم **أحدث إصدارات Node و React و PostgreSQL**، مع **خادم MCP مبتكر** لربط وكلاء الذكاء الاصطناعي بفهم عميق لقاعدة البيانات والكود. البنية الهندسية **professional-grade** وقابلة للصيانة على المدى الطويل.
