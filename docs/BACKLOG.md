# Nouf-ex — المهام التنفيذية المتبقية (Backlog)
# ============================================================
# **آخر تحديث:** 2026-07-12
# **الفرع:** `fix/routes-cts-to-ts-2026-07-06`
# **الحالة العامة:** ✅ TypeScript نظيف · ✅ ESLint نظيف · ✅ Build نجح · ✅ Pushed

هذا الملف يُلخّص المهام المتبقية التي لم تُنفَّذ بعد (إما لأنها تتطلب
صلاحيات Admin، أو لأنها تحسينات اختيارية، أو لأنها منخفضة الأولوية).

---

## 🔴 P0 — مهام حرجة (يجب تنفيذها قبل النشر Production)

### Backend
- [ ] **Backend tests for new admin endpoints** — إضافة Vitest unit/integration
      tests لـ `routes/admin-extras.ts` (Categories / Coupons / Reviews /
      Settings / Broadcast). الملف: `apps/api/src/tests/`.

- [ ] **Auto-cleanup orphaned coupon_usage on coupon delete** — حذف القسيمة
      حالياً يحذف السجل لكن لا يحذف `coupon_usage` المرتبطة. أضف
      `DELETE FROM coupon_usage WHERE coupon_id = $1` قبل `DELETE FROM coupons`.

- [ ] **Rate-limit broadcast endpoint** — `POST /api/admin/notifications/broadcast`
      يمكن أن يبث لآلاف المستخدمين فيطلب rate-limiting (مثلاً: 10/minute per admin).
      استخدم `authLimiter` الموجود في `lib/ratelimit.ts`.

- [ ] **Settings schema validation** — `adminSettingUpdateSchema.value` حالياً
      يقبل أي نص. أضف validation لكل setting key معروف (مثلاً: `DEFAULT_CURRENCY`
      يجب أن يكون 3 أحرف، `FLAT_SHIPPING_COST` يجب أن يكون رقم موجب).

### Frontend
- [ ] **React Query / SWR** — استبدال `useDataHook` في `hooks/useApi.ts` بـ
      TanStack Query للحصول على caching, refetch, optimistic updates حقيقية.
      هذا مهم خصوصاً للـ admin tables حيث يحتاج المستخدم refresh سريع.

- [ ] **404 catch-all for /admin*** — لوحة Admin تحتوي sidebar links تشير إلى
      `/admin/notifications-broadcast` و `/admin/system`. تأكد أن جميع المسارات
      المعرّفة في `AdminDashboard.tsx` لها route مطابق في `App.tsx`.

- [ ] **Audit log export CSV** — صفحة `AdminAuditLog.tsx` لا تدعم تصدير CSV
      رغم وجود الزر. أضف action handler يستدعي `/api/admin/audit-log/export.csv`
      (يحتاج backend endpoint جديد).

- [ ] **Backend admin orders JOIN with PATCH support** — الـ endpoint
      `/orders-with-people` يرجع فقط. أضف PATCH customers/admin لتعديل
      orders عبر `/orders-with-people/:id` route.

### Security
- [ ] **Settings value redaction** — `admin_audit_log` يحفظ `old_value` و
      `new_value` بدون تشفير. لو احتوى setting على API key أو password (مثل
      `SUPPORT_EMAIL_PASSWORD`)، سيظهر في الـ audit log. أضف
      redaction pass عبر `redactSensitive()` من `lib/audit.ts`.

- [ ] **CSRF tokens for admin mutations** — التحقق الحالي يستخدم SameSite=Strict
      cookies. أضف CSRF token للـ mutations الحساسة (PATCH / DELETE).

- [ ] **Audit log retention** — لا يوجد scheduled cleanup. الـ endpoint
      `/admin/maintenance/cleanup-audit-logs` موجود لكن لا يوجد cron job
      يستدعيه. أضف pg_cron أو cron Linux على الـ container.

---

## 🟠 P1 — تحسينات عالية الأولوية (Week 1-2)

### Customer dashboard
- [ ] **Wishlist price-drop alerts** — أضف endpoint جديد
      `GET /api/wishlist/price-drops` يرجع المنتجات التي انخفض سعرها منذ إضافتها
      للقائمة. يحتاج schema جديد لتتبع `price_at_added`.

- [ ] **Wishlist move-all-to-cart** — زر "نقل الكل إلى السلة" في Wishlist.tsx
      غير مربوط بـ handler. أضف `bulkMoveToCart()` يستدعي `POST /api/cart/bulk`.

- [ ] **Order tracking with map preview** — صفحة OrderDetail.tsx تعرض
      tracking_number و shipping_company لكن بدون خريطة. أضف Leaflet مع
      OpenStreetMap إذا lat/lng موجود في shipping_address (يتطلب migration).

- [ ] **Real reviews page** — `Reviews.tsx` حالياً hardcoded mock data.
      يستبدل بـ `useReviews({ customerId: user.id })` من API.

- [ ] **Notifications action buttons** — Notifications.tsx يعرض
      type-colored tiles لكن بدون أزرار action. أضف "View order" / "Track"
      / "Reply" / "Apply coupon" حسب `notification.type`.

### Seller dashboard
- [ ] **Real product edit page** — `/seller/products/:id/edit` route غير موجود.
      حالياً `/seller/products` يستخدم inline edit modal. أنشئ صفحة منفصلة
      بـ full product form.

- [ ] **Inventory page** — sidebar link `/seller/inventory` يشير لـ route غير
      موجود. أضف backend endpoint `/api/seller/inventory` ثم صفحة
      SellerInventory.tsx.

- [ ] **Payouts page** — نفس المشكلة. أضف `/api/seller/payouts` ثم
      SellerPayouts.tsx (يعرض balance + transactions).

- [ ] **Subscription page** — نفس الشيء. أضف `/api/seller/subscription`.

- [ ] **Reviews page for seller** — `/seller/reviews` يعرض تقييمات
      المنتجات بدون backend join للعميل. أضف join في API + عرض اسم
      العميل في الـ UI.

### Admin dashboard
- [ ] **User management actions** — UsersManagement.tsx لا يدعم:
      - تغيير role (admin ↔ customer ↔ merchant)
      - ban (3rd status beyond active/suspended)
      - reset password (POST /api/admin/users/:id/reset-password)
      - impersonate (login as user for debugging)
      - send notification

- [ ] **Stores management** — StoresManagement.tsx يعرض "—" لـ merchant name
      و email لأن لا يوجد backend join. أضف LEFT JOIN users في
      `/api/admin/stores` لتضمين `owner_name, owner_email`.

- [ ] **Products management** — AdminProducts.tsx لا يدعم:
      - edit modal (تغيير name, price, stock, description)
      - bulk actions (publish/unpublish selected)
      - bulk import/export CSV
      - approve/reject pending products

- [ ] **Orders management** — AdminOrders.tsx لا يدعم:
      - order detail view
      - refund creation
      - dispute link
      - payment history

- [ ] **Audit log filters** — AdminAuditLog.tsx لا يدعم:
      - user_id filter
      - date range filter
      - export CSV
      - click-through to entity

- [ ] **Reports analytics** — ReportsAnalytics.tsx يعرض "—" لـ KPIs غير مدعومة.
      أضف backend endpoints لـ:
      - retention / churn
      - AOV trend
      - cancel rate
      - dispute-resolution time
      - LTV
      - top SKUs
      - top customers
      - geo-of-orders (حالياً فقط stores/merchants)

---

## 🟡 P2 — تحسينات متوسطة الأولوية (Week 3-4)

### Infrastructure
- [ ] **Dockerize Postgres properly** — حالياً `C:\Users\zaher\.noufex-pg-data`
      يدوي. أنشئ `docker-compose.dev.yml` يحتوي postgres:17 + pgAdmin + الـ app.

- [ ] **CI/CD for /admin routes** — `ci.yml` حالياً لا يختبر admin pages.
      أضف e2e tests للـ admin critical paths (login → create category →
      create coupon → broadcast).

- [ ] **Backup script** — لا يوجد automated backup للـ `noufex_db`. أضف
      سكربت PowerShell + pg_dump + cron، يخزن في `C:\backups\noufex\`.

- [ ] **PostgreSQL as Windows service** — حالياً `postgresql-x64-17` لا يعمل
      كـ service بسبب فقدان مجلد data الأصلي. شغّل من PowerShell كـ Admin:
      ```
      sc.exe create postgresql-x64-17 binPath= "...\pg_ctl.exe runservice ..."
      Start-Service postgresql-x64-17
      ```

### Feature work
- [ ] **Content management (CMS)** — لا يوجد نظام لإدارة:
      - Static pages (About, Terms, Privacy, Careers)
      - Blog posts
      - Homepage hero banners (carousel)
      - FAQ
      روابط الـ Footer تشير لـ `#` حالياً.

- [ ] **Email templates** — لا يوجد editor لـ:
      - Order confirmation email
      - Welcome email
      - Password reset email
      - Shipping notification
      يُستخدم حالياً `lib/notifications/email-templates.ts` لكن hardcoded.

- [ ] **Multi-currency support** — `app_settings.DEFAULT_CURRENCY` موجود لكن
      لا يوجد price conversion API (مثل `exchangerate-api.com`). أضف:
      - `currencies` table
      - `/api/admin/currencies` endpoint
      - conversion utility في `lib/format.ts`

- [ ] **Multi-language content** — i18n.json موجود لكن لـ static strings فقط.
      لا يوجد UI لترجمة product names/descriptions من admin.

- [ ] **Roles & Permissions (RBAC)** — حالياً 3 roles hardcoded
      (customer/merchant/admin). لا يوجد:
      - Custom role creation
      - Fine-grained permissions
      - Permission inheritance
      أضف `roles`, `permissions`, `role_permissions` tables.

- [ ] **Support ticket system** — لا يوجد نظام tickets. أضف:
      - `tickets` table
      - `/api/customer/tickets` و `/api/admin/tickets`
      - CustomerTicket.tsx, AdminTickets.tsx

### Performance
- [ ] **React.lazy() for heavy pages** — كل الـ admin pages في chunk واحد.
      أضف `lazy()` imports لـ AdminProducts (recharts) و ReportsAnalytics.

- [ ] **Image optimization** — product images تُخدّم بالحجم الأصلي. أضف
      responsive images مع `srcset` + lazy loading.

- [ ] **Search performance** — search.ts يستخدم ILIKE بدون index. أضف
      GIN index على `tsvector` column (موجود في migration 0009 لكن غير مستخدم).

- [ ] **Bundle size** — main bundle ~200KB gzip. recharts (~120KB) و
      framer-motion (~45KB) تُحمّل eagerly. أضف code splitting.

---

## 🟢 P3 — تحسينات اختيارية (Later)

- [ ] **GraphQL API** — REST API الحالي يعمل بشكل ممتاز. GraphQL سيكون
      مفيد فقط إذا أصبحت الـ frontend تحتاج queries معقدة.

- [ ] **Real-time updates (WebSockets)** — لا يوجد real-time notifications.
      أضف `socket.io` server + client integration.

- [ ] **Mobile app (React Native)** — PWA الحالي يعمل على الجوال. RN
      سيكون مستحسن لو أردت push notifications أصلية.

- [ ] **AI-powered features**:
      - Product recommendations (`/api/recommendations`)
      - Auto-translate product descriptions
      - Fraud detection on orders
      - Chatbot for customer support

- [ ] **Advanced analytics**:
      - Cohort analysis
      - Funnel analysis (visit → cart → checkout → paid)
      - Heat maps
      - A/B testing framework

- [ ] **Marketing automation**:
      - Email drip campaigns
      - Abandoned cart recovery
      - Loyalty program / points system
      - Referral program

---

## 📋 ملخص سريع

| الفئة | عدد المهام |
|---|---|
| 🔴 P0 (حرجة) | 12 |
| 🟠 P1 (Week 1-2) | 18 |
| 🟡 P2 (Week 3-4) | 16 |
| 🟢 P3 (اختيارية) | 8 |
| **الإجمالي** | **54** |

---

## 🎯 توصية: ابدأ بـ P0 بالترتيب التالي

1. **CSRF tokens** (1-2 أيام) — أمان حرج
2. **Settings value redaction** (نصف يوم) — إصلاح security leak
3. **Audit log retention cron** (نصف يوم) — منع انفجار الـ DB
4. **Auto-cleanup orphaned coupon_usage** (ساعة واحدة) — إصلاح بسيط
5. **Settings schema validation** (يوم واحد) — منع invalid values
6. **Rate-limit broadcast endpoint** (يوم واحد) — منع abuse

بعدها انتقل لـ P1 ابدأ بـ:
- Real reviews page (P1 customer) — أكبر قيمة للمستخدمين
- User role management (P1 admin) — أكثر طلب تشغيلي

---

## 📝 ملاحظات التنفيذ

- **كل الكود الجديد يجب:**
  1. يمر من `tsc --noEmit` بدون errors
  2. يمر من `eslint` بدون warnings
  3. يكون ضمن commit منفصل مع رسالة Conventional Commits
  4. يضيف i18n keys لكل الـ 3 لغات (ar, en, zh)
  5. يكتب admin_audit_log entry لكل mutation

- **قبل فتح PR:**
  - شغّل `npm run lint && npm run build && npm test`
  - اختبر يدوياً في Chrome DevTools
  - تحقق من RTL layout
  - تأكد من responsive design (mobile/tablet/desktop)

- **الأولوية لما يطلبه المستخدم مباشرة** فوق أي مهمة أخرى. إذا طلب
  المستخدم ميزة P3 جديدة قبل إكمال P0، نفّذها فوراً.
