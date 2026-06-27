# خطة تنفيذ التوصيات وإصلاح المشاكل - Nouf-ex

## المرحلة 1: صور منتجات فريدة (الأثر البصري الأكبر)
- إنشاء 40 صورة فريدة باستخدام AI لكل منتج
- تصدير البيانات إلى JSON

## المرحلة 2: إصلاح بيانات قاعدة البيانات
- تفعيل Foreign Keys
- تصحيح products_count و review_count و sold_count
- تصحيح totals الطلبات
- إنشاء الفهارس المفقودة

## المرحلة 3: إنشاء الجداول المفقودة
- payments, coupons, product_variants, refunds
- store_balance, transactions, shipping_methods
- admin_audit_log, inventory_log, store_followers

## المرحلة 4: إصلاح أخطاء الأمان
- bcrypt لكلمات المرور
- transactions في الطلبات
- تحقق من المخزون
- validation للأدوار

## المرحلة 5: إصلاح الواجهة الأمامية
- إصلاح RTL
- إكمال الترجمات
- إصلاح الصفحات الفرعية

## المرحلة 6: نظام المستخدمين والميزات الأساسية
- تسجيل/دخول حقيقي
- نظام الطلبات
- نظام المراسلة
