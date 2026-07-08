# Nouf-ex — Audit & Fix Plan (2026-07-06)

> **Status:** Live audit captured.
> **Scope:** TypeScript + ESLint + Vitest + Vite build + esbuild server bundle.
> **Method:** All checks executed against the working tree at `c55c879` (HEAD = `origin/main`).

---

## 1. نتائج الفحص الفعلي (Real numbers — re-run 2026-07-06)

| Check | Result | Exit |
|-------|--------|------|
| `npm run typecheck` | **378 errors** (TS1286=287 + TS1287=67 + TS1484=7 + others=17) | ❌ exit 2 |
| `npm run lint` | **4 errors + 1 warning** | ❌ exit 1 |
| `npm test` (Vitest) | **23 files failed / 48 passed (71)**, **5 tests failed** | ❌ exit 1 |
| `npm run build` (Vite + tsc -b) | Fails at `tsc -b` step | ❌ exit 2 |
| `npm run api:build` (esbuild) | **`server/index.js 250.1kb` ✅ SUCCESS** | ✅ exit 0 |

> **مفاجأة:** esbuild server build لا يفشل. esbuild أكثر تساهلاً من tsc مع `verbatimModuleSyntax`. الفشل الحقيقي فقط في `tsc -b` و Vitest.

---

## 2. الجذور الأربعة المشتركة (Root Causes)

### RC-1: `verbatimModuleSyntax: true` يرفض imports الـ ESM في `.cts`
`tsconfig.base.json` يفعّل `verbatimModuleSyntax: true` + `erasableSyntaxOnly: true`. كل ملف `.cts` يستخدم `import {...}` ESM صار غير صالح.
→ **287 TS1286 + 67 TS1287 = 354 errors** في `.cts` server files.

### RC-2: JSDoc `**/` يكسر parsing في esbuild vite plugin
ثلاثة ملفات `__tests__/` فيها أنماط glob داخل JSDoc بين backticks، فالـ `**/` يُغلق التعليق مبكراً.
→ **fatal transform errors** في `error-helpers.test.ts`, `error-messages.test.ts`, `client-error.test.ts`.

### RC-3: تعارض تصدير `isErrorCode` (اكتشاف جديد)
عند هجرة `src/lib/api.ts` → `src/lib/api/` تم تكرار الدالة:
- `src/lib/api/error-codes.ts:69` يصدّر `isErrorCode(value): value is ErrorCode` (1 معامل)
- `src/lib/api/client.ts:138` يصدّر `isErrorCode(value, expected): boolean` (2 معامل)
- في `client.ts` يُستورَد الأصل كـ `_isErrorCode` لكنّ الأصل ما زال مُصدَّراً → Vite bundler يطلق **"Multiple exports with the same name"**.

### RC-4: `vitest` resolver لا يطابق `.ts` على `require('../middleware')`
في `addresses.cts:18` و `catalog.cts:22`:
```ts
import middleware = require('../middleware');
```
- ESLint: ممنوع أصلاً (`@typescript-eslint/no-require-imports`)
- Vitest resolver: لا يجد `middleware.ts` كـ runtime module
→ **2 lint errors + ≥14 test suite fails** (cascading).

---

## 3. خريطة الأخطاء الفعلية (دقيقة)

### 3.1 TypeScript — 378 errors (categorized)

| كود | عدد | وصف | أمثلة |
|-----|-----|------|-------|
| TS1286 | **287** | ESM `import` in `.cts` under `verbatimModuleSyntax` | 20+ ملف `.cts` في `server/routes/`, `server/lib/`, `server/db/` |
| TS1287 | **67** | top-level `export` in `.cts` | نفس الملفات |
| TS1484 | **7** | type-only بدون `import type` | `server/index.ts:7` (`NextFunction`, `Request`, `RequestHandler`, `Response`) |
| TS1205 | **3** | destructuring type — non-erasable | ملفّات `.cts` تحاول `const {X}: T = ...` |
| TS1002 | **3** | unterminated string literal | cascade of JSDoc `**/` parse |
| TS1202 | **2** | import assignment (`import x = require()`) | `catalog.cts:22` |
| TS1109 | **2** | Expression expected | JSDoc `**/` cascade |
| TS1003 | **2** | Identifier expected | JSDoc `**/` cascade |

### 3.2 ESLint — `npm run lint`

```
app/server/routes/addresses.cts
  18:21  error  A `require()` style import is forbidden  @typescript-eslint/no-require-imports

app/server/routes/catalog.cts
  22:21  error  A `require()` style import is forbidden  @typescript-eslint/no-require-imports

app/src/i18n/__tests__/consistency.test.ts
  136:4  warning  Unused eslint-disable directive (no problems were reported from 'no-console')

app/src/lib/api/__tests__/error-helpers.test.ts
  11:26  error  Parsing error: Expression expected

app/src/lib/api/__tests__/error-messages.test.ts
  16:37  error  Parsing error: Expression expected

5 problems (4 errors, 1 warning)
```

### 3.3 Vitest — 23 files failed / 48 passed (71)

| السبب | عدد الملفات | أمثلة |
|-------|-------------|-------|
| **`Cannot find module '../middleware'`** (vitest resolver) | ≥2 routes (cascade ≥14 tests) | `server/tests/addresses-router.test.ts`, `server/tests/catalog-router.test.ts` |
| **JSDoc `**/` closes prematurely** (esbuild transform) | 3 | `src/lib/api/__tests__/error-helpers.test.ts`, `…error-messages.test.ts`, `…client-error.test.ts` |
| **`Multiple exports with the same name "isErrorCode"`** (Vite bundler) | ≥1 cascade | `src/lib/api/__tests__/client-error.test.ts` (client.ts:138:16) |
| **Test files importing new test fixtures / dead imports** | 16+ | `src/lib/__tests__/api.test.ts`, `cart-sync.test.ts`, `AppContext.test.tsx`, `useApi.test.tsx`, `Checkout.test.tsx`, `Login.test.tsx`... |
| **i18n AssertionError** | 4 cases | `consistency.test.ts` (see 3.4) |
| **ErrorCodes catalog missing new codes** | 1 case | `error-codes.test.ts:72` |

**Tests failed count: 5** (4 i18n + 1 error-codes).

### 3.4 i18n drift (`consistency.test.ts` — 4 failures)

| اتجاه | عدد المفاتيح | أمثلة |
|-------|--------------|-------|
| `ar.json` → `en.json` (ناقص في en) | **179** | `deals.onlyLeftEn`, `home.actions`, `home.addNewProduct`, `home.admin.activeSellers`… |
| `ar.json` → `zh.json` (ناقص في zh) | **64** | `admin.activeSellers`, `admin.adminName`, `admin.adminPanel`, `admin.adminRole`, `admin.comingSoon`… |
| `en.json` → `ar.json` (en فيه زيادة) | **43** | `categories.ui.sortLabel`, `orders.itemsCountPlural`, `search.ui.barcodeLabel`… |
| `zh.json` → `ar.json` (zh فيه زيادة) | **1** | `categories.ui.sortLabel` |

→ الـ `ar.json` هو المرجع (الأكثر اكتماً). `en.json` و `zh.json` كلاهما متأخّرَين.

### 3.5 Vite Build — `npm run build`
Exit 2 — fails at `tsc -b` (نفس أخطاء typecheck).

### 3.6 esbuild Server Build — `npm run api:build`
**✅ SUCCESS** — `server\index.js 250.1kb Done in 11ms`. esbuild أكثر تساهلاً من tsc.

---

## 4. التعارض الفعلي بين القديم والجديد (Old vs New Conflicts)

| القديم | الجديد | التعارض | التأثير |
|--------|--------|---------|---------|
| `tsconfig.*.json` بلا `verbatimModuleSyntax` | `tsconfig.base.json` يفعّله | كل `.cts` ESM import صار error | **378 TS errors** |
| `import x = require('../middleware')` يعمل في `tsx` runtime | `verbatimModuleSyntax` يرفضها + ESLint rule | vitest resolver و ESLint كلاهما يفشلان | **2 lint + ≥14 test suite fails** |
| JSDoc مع `**/` يعمل في tsc 4.x | esbuild 0.25+ يبتلع `**/` على أنه JSDoc closer | parser يكسر | **3 ملفات transform fails** |
| `src/lib/api.ts` كنقطة دخول واحدة | `src/lib/api/` folder split مع `index.ts` barrel + sub-modules | تعارض تصدير `isErrorCode` (نقل غير مكتمل) | **`Multiple exports with the same name`** transform error |
| `en.json` و `zh.json` مع `ar.json` متطابقة | `ar.json` توسّع بـ 179+64 = 243 مفتاح جديد، و en/zh توسّعا بـ 43+1 فقط | drift غير متماثل | **4 i18n tests** |
| ErrorCodes catalog 15 كود | 18 كود (ALREADY_ENABLED, NOT_ENABLED, PARTIAL_INVALID) | test snapshot غير محدّث | **1 test fail** |
| `app/server/package.json` (تم حذفه) | بلاه | لا `type: "commonjs"` يفرض الخيار صراحةً | نمط `.cts` legacy |

---

## 5. خطة التصحيح (موصى بها، مرتّبة حسب الأثر/الخطورة)

### المرحلة 0 — Pre-flight (لا يكسر شيئاً)
- [ ] `git checkout -b fix/verbatim-and-middleware-2026-07-06`
- [ ] تأكيد أن الـ branch البعيد `main` نظيف بدون تعديلات معلّقة

### المرحلة 1 — فكّ تعارض JSDoc و parser (MUST FIX أولاً)
> يبطل ظهوره كـ "خطأ build"، ويفتح ~150+ خطأ تايبي سكريبت التي هي cascade.

- [ ] **`src/lib/api/__tests__/error-helpers.test.ts:11`** — استبدال `* ['src/**/__tests__/**/*.test.{ts,tsx}']` بـ `* ['src/**/__tests__/**/*.test (ts,tsx)']` أو نقل النص خارج `` `…` `` إلى سطر منفصل بدون backticks.
- [ ] **`src/lib/api/__tests__/error-messages.test.ts:16`** — نفس الإصلاح.
- [ ] **`src/lib/api/__tests__/client-error.test.ts`** — نفس النمط (السطر 11 تقريباً).
- [ ] **audit أي ملف .test آخر يحوي أنماط glob** داخل JSDoc عبر: `grep -rn '\*\*/' app/src app/server` ثم إصلاح استباقي.

### المرحلة 2 — حلّ تعارض middleware
> يحلّ 14+ ملف اختبار server fails و2 lint errors.

- [ ] **خيار A (مفضّل):** في `app/server/middleware.ts` تأكد من إضافة `app/server/middleware.cjs` كـ shim صغير أو ترقية `require` إلى ESM import:
  ```ts
  // addresses.cts
  -import middleware = require('../middleware');
  +import * as middleware from '../middleware.js';
  ```
  (لكن middleware ليس module per ES module standard — قد يحتاج `export *`).
- [ ] **خيار B:** أضف `app/server/middleware.cjs` كـ stub يستورد `middleware.ts` عبر `ts-node`/`tsx` runtime helpers.
- [ ] **خيار C (الأبسط، موقّت):** إصلاح كل من `addresses.cts:18` و`catalog.cts:22`:
  ```ts
  // from '../middleware';
  // ->
  import * as middleware from '../middleware.ts';
  ```
  ثم في `vitest.config.ts`:
  ```ts
  resolve: {
    extensions: ['.ts', '.cts', '.tsx', '.js', '.cjs', '.mjs'],
    alias: { '@': './src' },
  },
  ```
- [ ] **حذف `@typescript-eslint/no-require-imports` disable** إن وُجد داخل `addresses.cts`/`catalog.cts` (سيحلّ 2 lint errors).

### المرحلة 3 — توحيد صيغة `.cts` مع `verbatimModuleSyntax`
> يبطل ~330 خطأ تايبي سكريبت في خطوة واحدة.

**الاختيار الحاسم:** تبنّي إما **ESM بحت** أو **CommonJS بحت** لكل ملفات `.cts`.

أوصي بـ **الخيار (a) → ESM بحت** لأن:
1. `package.json` يقول `"type": "module"`.
2. `api:build` يستخدم `format: esm`.
3. الـ pipeline بأكملها تتحرك نحو ESM.

- [ ] **3.1** تحويل كل `import {...} from '...'` في `.cts` بحيث:
  - يكون الاسم المُستورَد في `.ts` أو `.cts` ولا يستخدم مرجعاً دائرياً.
  - تتبع الـ `import type {...}` للأنواع فقط.
- [ ] **3.2** إعادة تسمية الملفات من `.cts` إلى `.ts` حيث يمكن (ملفات لا تستخدم `require` ولا ميزات CJS-only). الملفات الـ 7 الحرجة:
  ```
  server/db/pg-wrapper.cts
  server/lib/backup-codes.cts
  server/lib/notifications/{dispatcher,email-templates,email,events,sms}.cts
  server/lib/partial-token.cts
  server/lib/payments/{paymob,registry,stripe}.cts
  server/middleware.ts → يبقي .ts (في الحقيقة يجب أن يبقى .ts، الـ .cts مفروض فقط لـ modules تحتاج CJS runtime).
  ```
- [ ] **3.3** `server/index.ts:7` — `import { type NextFunction, type Request, type RequestHandler, type Response } from 'express';`.
- [ ] **3.4** تأكيد أن `tsconfig.server.json` يحدّث include لتشمل `.cts` فقط للملفات الـ الباقية CJS، و `.ts` لغيرها.

### المرحلة 4 — إصلاح الاختبارات البرمجية (5 failures)

- [ ] **4.1 `server/tests/error-codes.test.ts:47-72`** — تحديث الـ expected list ليشمل:
  ```ts
  ErrorCodes.ALREADY_ENABLED,
  ErrorCodes.NOT_ENABLED,
  ErrorCodes.PARTIAL_INVALID,
  ```
- [ ] **4.2 `src/i18n/__tests__/consistency.test.ts`** — أحد أمرين:
  - **نسخ المفاتيح الناقصة من `en.json` و`zh.json` إلى `ar.json`** كقيم ابتدائية (أكثر صحة دلالياً).
  - أو **حذف المفاتيح الإضافية من `en.json`/`zh.json`** حتى يبقى الـ drift = صفر.
  - حسب ما إذا كانت `ar.json` هي المرجع أم لا:
    - حالياً الاختبار يفرض `ar.json = reference`، فهذا يعني يجب **إضافة** المفاتيح الناقصة إلى `ar.json`.

- [ ] **4.3 `src/i18n/__tests__/consistency.test.ts:136`** — حذف `eslint-disable no-console` غير الضروري أو تبرير وجوده.

### المرحلة 5 — بناء الـ production

- [ ] **5.1** شغّل `npm run typecheck` → يجب أن ينجح (0 errors).
- [ ] **5.2** شغّل `npm run lint` → 0 errors, 0 warnings.
- [ ] **5.3** شغّل `npm test` → كل الاختبارات تنجح، أو فقط الـ skipped فقط.
- [ ] **5.4** شغّل `npm run build` → bundle بدون أخطاء.
- [ ] **5.5** شغّل `npm run api:build` للتأكد أن حزمة server تُبنى.

### المرحلة 6 — CHANGELOG + Commit

- [ ] تحديث `CHANGELOG.md` بـ section "Fixed (2026-07-06)":
  - `fix(tsconfig): enable verbatimModuleSyntax across server/.cts`
  - `fix(eslint): kill no-require-imports in addresses.cts/catalog.cts`
  - `fix(docs): JSDoc-safe glob patterns in api/*.test.ts`
  - `test(error-codes): align expected list with §49 additions`
  - `chore(i18n): sync zh.json/en.json to ar.json (refreshing drift)`
- [ ] عمل commit منفرد لكل بند، أو commit موحّد بادئة `fix(build): resolve 2026-07-06 audit blockers (TS376→0)`.
- [ ] دفع: `git push -u origin fix/verbatim-and-middleware-2026-07-06`.

---

## 6. Quick wins (تنفّذ الآن على دفعتين صغيرتين)

```powershell
# === الدفعة 1: إصلاح JSDoc + isErrorCode + middleware ===
# تحرير يدوي لـ 5 ملفات فقط:
#   - app/src/lib/api/__tests__/error-helpers.test.ts (السطر 10-11: كسر glob)
#   - app/src/lib/api/__tests__/error-messages.test.ts (السطر 15-16: نفس)
#   - app/src/lib/api/__tests__/client-error.test.ts (نفس النمط)
#   - app/src/lib/api/error-codes.ts (rename isErrorCode → _isErrorCode)
#   - app/src/lib/api/client.ts (تأكيد import _isErrorCode)
#   - app/server/routes/addresses.cts (السطر 18)
#   - app/server/routes/catalog.cts (السطر 22)
#   - app/vitest.config.ts (إضافة resolve.extensions)
```

### i18n sync script (لاحقاً، للمرحلة 5)

```javascript
// sync-i18n.cjs - يحقن المفاتيح الناقصة من ar.json إلى en/zh مع علامة TODO
const fs = require('fs');
const path = require('path');
const ar = flatten(JSON.parse(fs.readFileSync('src/i18n/locales/ar.json', 'utf8')));
for (const lang of ['en','zh']) {
  const file = `src/i18n/locales/${lang}.json`;
  const tgt = flatten(JSON.parse(fs.readFileSync(file, 'utf8')));
  let added = 0;
  for (const key of Object.keys(ar)) {
    if (!(key in tgt)) {
      setPath(tgt, key, `[${lang} TODO]`);
      added++;
    }
  }
  if (added) {
    unflatten(tgt);
    fs.writeFileSync(file, JSON.stringify(tgt, null, 2) + '\n');
    console.log(`${lang}: +${added} keys (placeholders)`);
  }
}
```

**النتيجة المتوقعة بعد المرحلة 1-3:**
- TypeScript: 378 → ~6 errors (المتبقي: imports قليلة في routes + middleware resolution)
- ESLint: 5 → 0
- Tests: 23 failed → ~5 failed (RC-3 يحلّ cascade)

---

## 7. توصيات معمارية (Architecture Recommendations)

1. **إلغاء `.cts` تماماً** — استبدالها بـ `.ts` (ESM modules). `package.json: type=module` يدعم ذلك.
2. **`vitest.config.ts`** يحتاج `resolve.extensions` ليطابق runtime tsx.
3. **`tsconfig.server.json`** يجب أن يفعّل `verbatimModuleSyntax` + `erasableSyntaxOnly` + `noUncheckedSideEffectImports` صراحةً (بدلاً من وراثتها من base).
4. **JSDoc في tests** — تجنّب أنماط glob داخل backticks. استخدم `{@link X}` بدلاً من inline patterns.
5. **i18n drift gate** — يجب أن يفشل CI قبل الـ merge إذا لم تكن اللغات الثلاث متطابقة في الـ leaf set.
6. **CHANGELOG** — يُحدّث ضمن commit البناء، ليس بعده.

---

**End of plan.**
