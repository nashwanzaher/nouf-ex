# Nouf-ex — خطة العمل التنفيذية (Workflow Tasks)
# ============================================================
# **آخر تحديث:** 2026-07-16
# **الهدف:** تحسين المنصة لتنافس Amazon, Alibaba, Noon, AliExpress, Shopify
# **المبدأ:** لا كسر للبنية الحالية — تحسينات تدريجية فقط
# **المراجع:** Google SEO Starter Guide, Open Graph Protocol, Schema.org, WCAG 2.1

---

## المرجع الرسمي (Official References)

| المرجع | الرابط | الاستخدام |
|---|---|---|
| Google SEO Starter Guide | https://developers.google.com/search/docs/fundamentals/seo-starter-guide | SEO meta tags, structured data |
| Google Ecommerce SEO | https://developers.google.com/search/docs/specialty/ecommerce | Product schema, breadcrumbs |
| Open Graph Protocol | https://ogp.me/ | Social sharing meta tags |
| Schema.org Product | https://schema.org/Product | Structured data for products |
| WCAG 2.1 | https://www.w3.org/WAI/WCAG21/quickref/ | Accessibility compliance |
| Web Push API | https://developer.mozilla.org/en-US/docs/Web/API/Push_API | Push notifications |
| Service Worker API | https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API | PWA offline support |

---

## 🔴 P0 — مهام حرجة (أولوية قصوى — قبل النشر)

### T001: SEO Meta Tags
**المشكلة:** صفحات المنتجات بدون `<title>`, `<meta description>`, Open Graph
**المرجع:** Google SEO Starter Guide — "Make sure each page has a unique title"
**الحل:**
- إضافة `react-helmet-async` لإدارة `<head>` ديناميكياً
- لكل صفحة: `title`, `description`, `og:title`, `og:description`, `og:image`, `og:url`
- صفحات المنتجات: `product:price:amount`, `product:price:currency`
**الملفات:** `apps/web/src/components/SEOHead.tsx` (جديد), `apps/web/src/App.tsx`
**الⲞ影响:** لا يكسر أي بنية — إضافة component جديد فقط

### T002: Open Graph & Twitter Cards
**المشكلة:** مشاركة الروابط على社交媒体 تعرض بيانات فارغة
**المرجع:** Open Graph Protocol (ogp.me), Twitter Cards
**الحل:**
- إضافة `og:type`, `og:site_name`, `og:locale`
- `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`
- صفحات المنتجات: `og:type = product`
**الملفات:** `apps/web/src/components/SEOHead.tsx` (نفس T001)
**ال影响:** لا يكسر أي بنية

### T003: Structured Data (Schema.org)
**المشكلة:** Google لا يفهم بيانات المنتجات
**المرجع:** Schema.org Product, Google Ecommerce SEO
**الحل:**
- إضافة JSON-LD `<script type="application/ld+json">` لكل صفحة منتج
- البيانات: `name`, `description`, `image`, `price`, `currency`, `availability`, `rating`, `review`
- صفحات المتاجر: `Organization` schema
- الصفحة الرئيسية: `WebSite` schema مع `SearchAction`
**الملفات:** `apps/web/src/components/StructuredData.tsx` (جديد)
**ال影响:** لا يكسر أي بنية — إضافة component فقط

### T004: robots.txt & Sitemap
**المشكلة:** لا يوجد `robots.txt` أو `sitemap.xml`
**المرجع:** Google SEO Starter Guide — "Help Google find your content"
**الحل:**
- إنشاء `apps/web/public/robots.txt` يسمح بال crawling
- إنشاء `apps/web/public/sitemap.xml` يحتوي على:
  - الصفحة الرئيسية (`/`)
  - صفحات الفئات (`/categories`)
  - صفحات المتاجر (`/store/:id`)
  - صفحات المنتجات (`/product/:id`)
- إضافة `<link rel="sitemap" type="application/xml" href="/sitemap.xml">`
**الملفات:** `apps/web/public/robots.txt`, `apps/web/public/sitemap.xml`
**ال影响:** ملفات ثابتة فقط — لا تغيير في الكود

### T005: Canonical URLs
**المشكلة:** صفحات مكررة بدون `canonical`
**المرجع:** Google SEO Starter Guide — "Consolidate duplicate URLs"
**الحل:**
- إضافة `<link rel="canonical" href="...">` لكل صفحة
- استخدام `react-helmet-async` لإدارة الـ canonical dynamically
**الملفات:** `apps/web/src/components/SEOHead.tsx` (نفس T001)
**ال影响:** لا يكسر أي بنية

---

## 🟡 P1 — مهام مهمة (أولوية عالية)

### T006: Email Notifications (SMTP)
**المشكلة:** لا إشعارات بريدية للطلبات والتحديثات
**المرجع:** Amazon, Alibaba, Noon — كلها ترسل إشعارات بريدية
**الحل:**
- استخدام `lib/notifications/email.ts` الموجود (already has SMTP channel)
- إضافة `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` إلى `.env`
- تفعيل `onOrderPlaced`, `onPaymentConfirmed`, `onRefundResolved` events
**الملفات:** `.env`, `apps/api/src/lib/notifications/dispatcher.ts`
**ال影响:** تفعيل channel موجود فقط — لا تغيير في البنية

### T007: Push Notifications (Service Worker)
**المشكلة:** لا إشعارات push على الموبايل
**المرجع:** Web Push API, Service Worker API
**الحل:**
- إضافة `web-push` library لل backend
- إضافة push subscription endpoint في الـ API
- تفعيل Service Worker push event في الـ frontend
- إضافة زر "Enable Notifications" في صفحة الإعدادات
**الملفات:**
- `apps/api/src/modules/notifications/push.ts` (جديد)
- `apps/web/src/lib/push.ts` (جديد)
- `apps/web/public/sw.js` (update)
**ال影响:** إضافة module جديد — لا يكسر البنية

### T008: Social Sharing Buttons
**المشكلة:** لا أزرار مشاركة على صفحات المنتجات
**المرجع:** Amazon, Noon, AliExpress — كلها تدعم المشاركة
**الحل:**
- إضافة component `ShareButtons` يدعم: WhatsApp, Twitter/X, Facebook, Telegram, Copy Link
- استخدام `navigator.share` API للموبايل (Web Share API)
- إضافة الأزرار في صفحة ProductDetail و StorePage
**الملفات:** `apps/web/src/components/ShareButtons.tsx` (جديد)
**ال影响:** إضافة component جديد فقط

### T009: Returns Management
**المشكلة:** لا نظام إرجاع منتجات
**المرجع:** Amazon A-to-Z, Noon Returns, AliExpress disputes
**الحل:**
- إضافة `returns` table في قاعدة البيانات
- إضافة `/api/returns` endpoints
- إضافة صفحة `/customer/returns` في ال frontend
- ربطها بنظام الـ refunds الموجود
**الملفات:**
- `packages/db/migrations/0036_returns.sql` (جديد)
- `apps/api/src/modules/returns/` (جديد)
- `apps/web/src/pages/customer/Returns.tsx` (جديد)
**ال影响:** إضافة module جديد — لا يكسر البنية

### T010: Product Videos
**المشكلة:** Amazon, Alibaba, Noon تدعم فيديو المنتج
**الحل:**
- إضافة `video_url` column لجدول `products`
- إضافة حقل رفع فيديو في صفحة إضافة المنتج
- عرض الفيديو في صفحة تفاصيل المنتج
**الملفات:**
- `packages/db/migrations/0037_product_videos.sql` (جديد)
- `apps/web/src/features/products/components/ProductDetail.tsx` (update)
**ال影响:** إضافة column جديد — لا يكسر البنية

---

## 🟢 P2 — مهام تحسين (أولوية متوسطة)

### T011: Bulk Product Import (CSV/Excel)
**المشكلة:** التاجر يضيف منتجات واحداً واحداً
**المرجع:** Amazon Seller Central, Alibaba Supplier
**الحل:**
- إضافة endpoint `POST /api/seller/products/import` يستقبل CSV
- معالجة الملف في ال backend باستخدام `csv-parser`
- إضافة زر "Import CSV" في صفحة إدارة المنتجات
**الملفات:**
- `apps/api/src/modules/seller/import.ts` (جديد)
- `apps/web/src/features/seller/components/BulkImport.tsx` (جديد)
**ال影响:** إضافة module جديد — لا يكسر البنية

### T012: Multi-Currency Support
**المشكلة:** العملة الافتراضية YER فقط
**المرجع:** Amazon, Noon — يدعمون عملات متعددة
**الحل:**
- إضافة `currency` column لجدول `users` (preferred currency)
- إضافة API endpoint لتحويل العملات
- عرض الأسعار بالعملة المفضلة للمستخدم
**الملفات:**
- `packages/db/migrations/0038_user_currency.sql` (جديد)
- `apps/api/src/lib/currency.ts` (جديد)
- `apps/web/src/lib/format.ts` (update)
**ال影响:** إضافة column جديد — لا يكسر البنية

### T013: Live Chat (Buyer-Seller)
**المشكلة:** Amazon, Noon تدعم محادثة مباشرة
**الحل:**
- استخدام WebSocket الموجود (`ws` library) لإنشاء نظام محادثة
- إضافة صفحة `/messages/chat` مع واجهة محادثة
- ربطها بنظام الرسائل الموجود
**الملفات:**
- `apps/web/src/features/messages/components/Chat.tsx` (جديد)
- `apps/api/src/modules/messages/chat.ts` (update)
**ال影响:** توسيع module موجود — لا يكسر البنية

### T014: Order Tracking Map
**المشكلة:** Amazon, Noon تدعم خريطة تتبع
**الحل:**
- استخدام `leaflet` أو `mapbox-gl` لعرض خريطة
- عرض موقع المندوب في الوقت الحقيقي
- ربطها بـ `delivery_agents.current_lat/lng`
**الملفات:**
- `apps/web/src/features/orders/components/TrackingMap.tsx` (جديد)
**ال影响:** إضافة component جديد — لا يكسر البنية

### T015: Product Comparison
**المشكلة:** Amazon, AliExpress تدعم مقارنة المنتجات
**الحل:**
- إضافة `compare` state في CartContext أو context جديد
- إضافة صفحة `/compare` تعرض منتجات جنباً إلى جنب
- مقارنة المواصفات والأسعار والتقييمات
**الملفات:**
- `apps/web/src/features/products/components/Compare.tsx` (جديد)
- `apps/web/src/context/CompareContext.tsx` (جديد)
**ال影响:** إضافة context جديد — لا يكسر البنية

---

## 🔵 P3 — مهام مستقبلية (أولوية منخفضة)

### T016: Fraud Detection System
**المشكلة:** Amazon, Alibaba تستخدم ML لكشف الاحتيال
**الحل:**
- إضافة نظام قواعد بسيطة (rule-based) لكشف الاحتيال
- مراقبة: طلبات متعددة بنفس العنوان، مدفوعات فاشلة متكررة، حسابات جديدة بطلبات كبيرة
**ال影响:** إضافة service جديد

### T017: A/B Testing Tools
**المشكلة:** Amazon, Shopify تدعم اختبار التصميم
**الحل:**
- إضافة نظام feature flags بسيط
- تخزين الاختبارات في `app_settings`
**ال影响:** إضافة library جديد

### T018: Ad/Promotion Tools
**المشكلة:** Amazon, Alibaba تدعم أدوات إعلانية
**الحل:**
- إضافة `promoted_products` table
- إضافة نظام bidding بسيط
- عرض المنتجات المروّجة في أعلى نتائج البحث
**ال影响:** إضافة module جديد

### T019: Mobile App (Capacitor)
**المشكلة:** كل المنصات الكبرى لها تطبيقات native
**الحل:**
- استخدام Capacitor لتحويل PWA إلى تطبيق iOS/Android
- إضافة push notifications native
- إضافة camera integration للبحث بالصورة
**ال影响:** إضافة مشروع جديد — لا يكسر البنية الحالية

### T020: AI Content Moderation
**المشكلة:** Amazon, Alibaba تستخدم AI لفحص المحتوى
**الحل:**
- استخدام OpenAI API لفحص أوصاف المنتجات
- فحص الصور باستخدام Google Vision API
- إضافة نظام moderation queue
**ال影响:** إضافة service جديد

---

## ملخص المهام

| الأولوية | المهام | الوصف |
|---|---|---|
| 🔴 P0 | T001-T005 | SEO, Open Graph, Schema.org, robots.txt, canonical |
| 🟡 P1 | T006-T010 | Email, Push, Sharing, Returns, Videos |
| 🟢 P2 | T011-T015 | Bulk import, Multi-currency, Live chat, Tracking, Compare |
| 🔵 P3 | T016-T020 | Fraud, A/B testing, Ads, Mobile app, AI moderation |

---

## ملاحظات التنفيذ

1. **لا كسر للبنية:** كل المهام هي إضافات (additive) — لا تغيير في APIs الموجودة
2. **توافق مع ARCHITECTURE.md:** كل المهام تتبع نمط Module Pattern (routes + controller + service + repository)
3. **لا تغيير في قاعدة البيانات:** معظم المهام تستخدم tables/functions الموجودة
4. **اختبارات:** كل مهمة جديدة يجب أن تشمل tests في `apps/api/src/tests/` أو `apps/web/src/__tests__/`
5. **i18n:** كل نص جديد يجب أن يُضاف لملفات الترجمة الثلاثة (ar/en/zh)
6. **الأمان:** كل endpoint جديد يجب أن يمر عبر `requireAuth` + `csrfProtection` + `validate`

---

## معايير القبول (Definition of Done)

- [ ] TypeScript: 0 errors
- [ ] ESLint: 0 errors, 0 warnings
- [ ] Frontend tests: 298/298 passing
- [ ] Backend tests: 618/622 passing (1 flaky)
- [ ] i18n consistency: 1352/1352/1352 keys
- [ ] Docker build: successful
- [ ] Docker runtime: healthy
- [ ] SPA routes: 44/44 OK
- [ ] API endpoints: all returning 200
- [ ] No architecture-breaking changes
