# Production Data Hygiene and Bootstrap

## نطاق المهمة

تم الفحص على الفرع الحالي `fix/routes-cts-to-ts-2026-07-06` مع تغييرات سابقة غير مرتبطة في:

- `apps/api/src/lib/types.ts`
- `apps/api/src/lib/shared.ts`
- `apps/api/src/modules/*`
- `apps/api/src/routes/*`
- `packages/db/migrations/0036_extend_role_enum.sql`

لم تُستخدم قيم `.env` للاتصال بقاعدة بيانات، ولم يُنفذ cleanup أو حذف أو تعديل على أي قاعدة.

## تصنيف مصادر البيانات

### 1. بيانات مرجعية مسموحة في الإنتاج

| المصدر | البيانات | القرار |
|---|---|---|
| `packages/db/reference-seed.sql` | 18 فئة تصنيف ثنائية/ثلاثية اللغة | مسموح، idempotent |
| `packages/db/reference-seed.sql` | 4 طرق شحن عامة | مسموح، idempotent |
| `packages/db/schema*.sql` و`packages/db/views.sql` و`packages/db/functions.sql` و`packages/db/triggers.sql` | DDL وقيود وفهارس ودوال/مشغلات | ليست بيانات تجارية، تطبق حسب migrations |
| `packages/db/migrations/*` | تغييرات schema ووظائف وقيود | ليست demo seed؛ تُراجع كـ migrations مستقلة |

### 2. بيانات demo للتطوير وstaging فقط

| المصدر | المحتوى |
|---|---|
| `packages/db/demo-seed.sql` | 12 مستخدمًا demo، 7 متاجر، 24 منتجًا، عناوين، كوبونات، اشتراكات، طلبات، عناصر طلب، مدفوعات، refunds، معاملات wallet، reviews، followers، wishlist، cart، رسائل، notifications، disputes |
| `scripts/db/gen-seed-hashes.cjs` | hashes لحسابات demo غير إدارية؛ محمي الآن من `NODE_ENV=production` |
| `apps/e2e/e2e/*` و`apps/e2e/e2e/helpers/*` | حسابات وكوبونات وطلبات demo لتدفقات E2E؛ لم تُحذف لأنها ليست production runtime |
| `docs/*` و`JULES_REPORT.md` وملفات التشغيل المحلية | نصوص تشغيل/نتائج قديمة تتضمن demo credentials؛ ليست build artifacts، وتحتاج تحديثًا منفصلًا قبل اعتمادها كتوثيق إنتاجي |

حساب `admin@noufex.com` وكلمة `admin123` أُزيلا من demo seed. إنشاء أول `super_admin` يتم من `scripts/db/bootstrap-admin.cjs` فقط.

### 3. Fixtures وmocks للاختبارات ويجب الحفاظ عليها

- `apps/web/mocks/fixtures/*.json`
- `apps/web/mocks/handlers.ts` و`apps/web/mocks/fetch-spy.ts`
- `apps/api/vitest.setup.ts` وmock layers لـ PostgreSQL/Redis/RabbitMQ/Elasticsearch
- `apps/api/src/tests/*`
- `apps/web/src/**/__tests__/*` و`apps/web/src/__tests__/*`
- `apps/e2e/e2e/*` كاختبارات تشغيلية لا تُحزم مع production web build

هذه المصادر لا تُستخدم كـ fallback داخل واجهات الإنتاج.

### 4. بيانات محتملة داخل قاعدة الإنتاج تحتاج مراجعة قبل الحذف

أداة `scripts/db/audit-demo-data.cjs` تبحث read-only عن:

- عناوين demo users وعلاقات المستخدمين.
- متاجر demo ومالكيها وكل المنتجات التابعة لها.
- product images المعروفة في demo seed.
- أرقام الطلبات `NOF-2026-0001` إلى `NOF-2026-0008`.
- كوبونات `WELCOME10`, `FREESHIP`, `YEMEN25`, `SPICE20`.
- كل العلاقات التابعة: order_items، reviews، wishlist، cart، messages، notifications، disputes، followers، subscriptions، coupon_usage، audit log.
- payments، refunds، transactions، store_balance، shipments، invoices، delivery assignments.

لا يعني تطابق الاسم أن السجل قابل للحذف. تطابق أي علاقة مالية أو شحنية أو سجل غير معروف يوقف cleanup ويحوّله إلى مراجعة يدوية.

## ضمانات التشغيل

- `scripts/db/db-setup.cjs` يطبق `reference-seed.sql` في production، ويتخطى `demo-seed.sql`.
- `demo-seed.sql` يرفض التشغيل دون GUC مستقل، ويرفض `noufex.environment=production`.
- `scripts/db/run-demo-seed.cjs` يرفض `NODE_ENV=production` قبل الاتصال.
- `scripts/db/bootstrap-admin.cjs` يحتاج email وكلمة مرور من secret manager أو stdin، ويستخدم scrypt بملح عشوائي، وadvisory lock، وtransaction، ويجعل المحاولة الثانية no-op.
- الحقول الإدارية غير موجودة في public registration schema؛ `.strict()` يرفض `is_admin`, `password_hash` وأي حقول إضافية.
- `scripts/db/cleanup-demo-data.cjs` dry-run افتراضي، ويحتاج `--apply` وfingerprint من dry-run، ويقبل `development/test/staging` فقط.
- cleanup يطبع before/after، ينفذ داخل transaction، ويدعم `--rollback`، ولا يستخدم `TRUNCATE CASCADE`.
- وجود payments أو refunds أو transactions أو invoices أو shipments أو delivery assignments أو حقول شحن/دفع على الطلب يوقف cleanup.
- لا يُجرى cleanup على production، ولم يُجرَ cleanup في هذه المهمة.

## خطة تنظيف مقترحة بعد الموافقة

1. شغّل التقرير على اتصال read-only موجّه إلى قاعدة staging أو نسخة snapshot:

   `NODE_ENV=staging node scripts/db/audit-demo-data.cjs`

2. راجع قائمة `target` و`relations` و`blockers` واحتفظ بالـ `fingerprint`.
3. إذا وُجد blocker مالي/شحن أو علاقة غير معروفة: توقف، صدّر السجلات، واطلب قرار مالك البيانات.
4. إذا كانت القائمة آمنة، نفّذ dry-run مرة ثانية وتحقق من نفس fingerprint.
5. بعد موافقة صريحة على fingerprint فقط:

   `NODE_ENV=staging node scripts/db/cleanup-demo-data.cjs --apply --confirm=<fingerprint>`

6. نفّذ أولًا `--rollback` للتحقق من before/after داخل transaction، ثم نفّذ apply commit بعد مراجعة التقرير.
7. أعد تشغيل audit وتحقق من بقاء reference seed وعدم وجود demo graph.

الأوامر أعلاه خطة فقط ولم تُنفذ.

## الواجهات

- صفحة coupons أصبحت API-backed عبر `GET /api/coupons/mine` وتعرض empty/error/loading states.
- Home تعرض empty states عند غياب المتاجر والمنتجات.
- أزيلت fallback charts والـ KPI trends المصطنعة من seller/delivery dashboards.
- أزيلت أرقام المشاهدين والفيديو التجاري الثابت من Live Commerce.
- أزيلت أرقام الهاتف وURL وقدرات/أسواق المتجر المختلقة؛ لا تظهر إلا إن أعادتها قاعدة البيانات.
- `apps/web/package.json` يتحقق بعد البناء من عدم وجود demo-commerce markers في `dist`.

## النتائج والمخاطر المتبقية

لم تُشغّل نتائج lint/typecheck/test/build بعد في لحظة إنشاء هذا التقرير. يجب اعتماد النتائج المطبوعة من أوامر التحقق فقط.

المخاطر المتبقية:

- ملفات E2E والوثائق القديمة ما زالت تحتوي demo credentials لأنها fixtures/توثيق، وتحتاج مسارًا منفصلًا لترحيل E2E إلى bootstrap secret.
- قاعدة الإنتاج الفعلية لم تُفحص، لذلك لا توجد قائمة سجلات إنتاجية مؤكدة ولا يجوز افتراض خلوها.
- `shipments` و`invoices` غير موجودتين في schema الحالي، لكن أداة التقرير تتحقق من وجودهما إن أُضيفتا لاحقًا.
- أي بيانات demo أُنشئت خارج signatures المعروفة لن تُحذف تلقائيًا، وتظهر كـ potential relation أو تحتاج مراجعة يدوية.
