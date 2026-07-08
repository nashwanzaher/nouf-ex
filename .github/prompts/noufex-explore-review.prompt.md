---
mode: agent
description: 'استكشاف ومراجعة شاملة لتطبيق Nouf-ex قبل أي تعديل'
tools: ['codebase', 'usages', 'problems', 'changes']
---

# 🔍 مراجعة واستكشاف شامل لتطبيق `Nouf-ex`

## الهدف

فهم كامل لبنية وطريقة عمل تطبيق **Nouf-ex** قبل أي تعديل، واكتشاف الفجوات الحرجة،
وإنتاج تقرير مختصر قابل للتنفيذ.

> مشروع Nouf-ex: منصة B2B/B2C على طراز Alibaba/Taobao، تستهدف اليمن والشرق الأوسط.
> React + Vite + Express + PostgreSQL 17، مع i18n ثلاثي (AR/EN/ZH).

---

## ⚠️ قواعد صارمة (لا تكسرها)

1. **لا تعدّل أي ملف** خارج هذا الـ prompt. القراءة فقط.
2. **لا تعمل `commit` ولا `push` ولا تنشئ فروعًا** — اكتفِ بالاستكشاف.
3. **لا تنفّذ أوامر تُغيّر حالة** (مثل `npm run db:setup`, `docker compose up`, `git checkout`).
4. **لا تعدّل `.env` أو إعدادات النظام.**
5. إن اكتشفت خللًا، **وثّقه فقط** دون إصلاح.
6. **استخدم العربية** في التقرير النهائي (مع مصطلحات تقنية بالإنجليزية عند الحاجة).
7. **اختم بإجابة صريحة** إن واجهت نقطة غير مؤكدة، بدلًا من التخمين.

---

## 📋 خطة الاستكشاف (6 مراحل)

### المرحلة 1 — النظرة العامة (5 دقائق)

- اقرأ [README.md](../../README.md) و [docs/README.md](../../docs/README.md).
- اقرأ [docs/architecture.md](../../docs/architecture.md) و [docs/getting-started.md](../../docs/getting-started.md).
- اقرأ [docker-compose.yml](../../docker-compose.yml) و [Dockerfile](../../Dockerfile).
- اقرأ [app/package.json](../../app/package.json) و [database/README.md](../../database/README.md).

### المرحلة 2 — طبقة البيانات (10 دقائق)

- اقرأ [database/schema.sql](../../database/schema.sql) و [database/schema-extra.sql](../../database/schema-extra.sql).
- اقرأ [database/migrations/](../../database/migrations/) بالكامل (0001 → 0012).
- اقرأ [database/triggers.sql](../../database/triggers.sql) و [database/functions.sql](../../database/functions.sql) و [database/views.sql](../../database/views.sql).
- اقرأ [database/roles.sql](../../database/roles.sql) لفهم نموذج الصلاحيات.
- اقرأ [database/seed.sql](../../database/seed.sql) لمعاينة البيانات التجريبية.

### المرحلة 3 — طبقة الخادم (Backend) (15 دقيقة)

- اقرأ [app/server/index.ts](../../app/server/index.ts) و [app/server/middleware.ts](../../app/server/middleware.ts).
- اقرأ [app/server/lib/shared.cts](../../app/server/lib/shared.cts).
- استعرض **كل** المسارات في [app/server/routes/](../../app/server/routes/) (18 ملف).
- حدد: نقاط النهاية، المصادقة، الصلاحيات، rate limiting، مخططات التحقق (zod).
- اقرأ [app/server/db/pg-wrapper.cts](../../app/server/db/pg-wrapper.cts).

### المرحلة 4 — الواجهة الأمامية (15 دقيقة)

- اقرأ [app/src/App.tsx](../../app/src/App.tsx) و [app/src/main.tsx](../../app/src/main.tsx).
- اقرأ [app/src/lib/api.ts](../../app/src/lib/api.ts) و [app/src/lib/utils.ts](../../app/src/lib/utils.ts).
- اقرأ [app/src/context/AppContext.tsx](../../app/src/context/AppContext.tsx) و [CartContext.tsx](../../app/src/context/CartContext.tsx).
- اقرأ [app/src/hooks/useApi.ts](../../app/src/hooks/useApi.ts).
- استعرض [app/src/pages/](../../app/src/pages/) بالكامل (admin, auth, customer, seller, Home).
- اقرأ [app/src/i18n/](../../app/src/i18n/) (ar.json / en.json / zh.json) — لاحظ النواقص.

### المرحلة 5 — الجودة والمخاطر (10 دقائق)

- اقرأ [docs/testing.md](../../docs/testing.md) و [docs/conventions.md](../../docs/conventions.md).
- Historical audits/review notes are no longer in the repo — refer to git history on GitHub for prior audit reports (e.g. `code-audit-2026-06-21.md`, `review-code.md`, etc.).
- اقرأ [docs/roadmap.md](../../docs/roadmap.md) و [docs/competitive-analysis-2026.md](../../docs/competitive-analysis-2026.md).
- ابحث في الكود عن: `TODO`, `FIXME`, `HACK`, `XXX`, `console.log`, `mockData`, `dummyData`, `placeholder`.
- افحص ملف `app/src/pages/customer/Notifications.tsx` (مثال على بيانات وهمية في P1-7).
- راجع تغطية الاختبارات من [app/coverage/](../../app/coverage/).

### المرحلة 6 — الفجوات والفرز (5 دقائق)

- قارن ما هو موثّق في `docs/roadmap.md` بالكود الفعلي.
- صنّف الفجوات حسب: حرجة (تؤثر على الإنتاج) / مهمة / تحسينية.
- حدد أول 3–5 مهام حسب **التأثير/الجهد**.

---

## 📤 التقرير المطلوب (مختصر ومركّز)

أنتج تقريرًا **بالعربية** بصيغة Markdown، يحتوي على الأقسام التالية بالترتيب:

### 1) طريقة العمل (Architecture Snapshot)

- **المكدس التقني** — جدول مختصر (DB / API / Frontend / i18n / Tests / Container).
- **بنية قاعدة البيانات** — عدد الجداول، الأدوار، الـ triggers الرئيسية.
- **خريطة API** — روابط لكل router مع عدد نقاط النهاية.
- **بنية الواجهة** — عدد الصفحات، التقسيم، Code-splitting، RTL/i18n.
- **تدفقات المستخدم الرئيسية** — شراء، تسجيل، لوحة تحكم، إلخ (5–7 تدفقات).

### 2) الفجوات الحرجة (Critical Gaps)

لكل فجوة: **العنوان — الشاهد في الكود — الأثر — المرجع في الـ Roadmap.**

صنّفها إلى:

- **🔴 حرجة** — ميزات موثقة في الـ Roadmap لكن مفقودة أو معطّلة.
- **🟠 مخاطر** — ثغرات أمنية، أداء، أو قابلية صيانة.
- **🟡 تغطية ناقصة** — اختبارات، i18n، توثيق.

### 3) الخطوة التالية حسب الأولوية

أهم **3–5 مهام** يجب تنفيذها لاحقًا، بصيغة:

| #   | المهمة | الجهد | التأثير      | الـ ID في Roadmap | ملاحظات |
| --- | ------ | ----- | ------------ | ----------------- | ------- |
| 1   | ...    | S/M/L | High/Med/Low | P0-x / P1-x       | ...     |

### 4) ملاحظات وملفوفات (اختياري)

- أسئلة مفتوحة تحتاج توضيحًا من المستخدم.
- تناقضات أو معلومات متضاربة لاحظتها.

---

## 💡 قواعد الإخراج

- **اختصارات جدولية وروابط ملفات** بدلًا من مقاطع كود طويلة.
- **لا تنسخ كودًا كاملًا** — اكتفِ بالإشارة إلى `path:line` إن لزم.
- استخدم **emojis بحذر** للتأكيد البصري فقط (✅ / ⚠️ / ❌ / 🔴 / 🟠 / 🟡).
- **اذكر صراحةً** ما لم تستطع التحقق منه بدلًا من اختلاق إجابة.
- لا تُعد وعدًا بإصلاح — هذا prompt استكشافي فقط.

---

## 📚 مرجع سريع للملفات الرئيسية

| الطبقة            | الملف الأهم                                                  |
| ----------------- | ------------------------------------------------------------ |
| نقطة دخول الخادم  | [app/server/index.ts](../../app/server/index.ts)             |
| نقطة دخول الواجهة | [app/src/App.tsx](../../app/src/App.tsx)                     |
| Schema كامل       | [database/schema.sql](../../database/schema.sql)             |
| Schema إضافي      | [database/schema-extra.sql](../../database/schema-extra.sql) |
| Middleware        | [app/server/middleware.ts](../../app/server/middleware.ts)   |
| API client        | [app/src/lib/api.ts](../../app/src/lib/api.ts)               |
| Roadmap           | [docs/roadmap.md](../../docs/roadmap.md)                     |
| معمارية           | [docs/architecture.md](../../docs/architecture.md)           |
| اختبارات          | [docs/testing.md](../../docs/testing.md)                     |
