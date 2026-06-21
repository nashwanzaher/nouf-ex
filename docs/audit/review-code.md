# تقرير مراجعة الكود - تطبيق Nouf-ex

> **ملاحظة تاريخية**: هذا التقرير وثّق نتائج المراجعة في تاريخه. الملف الذي كان اسمه `api-server.ts` (في الجذر) أصبح اسمه `app/server/index.ts` بعد إعادة الهيكلة اللاحقة. أرقام الأسطر لم تعد مطابقة.

## ملخص تنفيذي

تم إجراء مراجعة شاملة على 14 ملفاً أساسياً في تطبيق Noufex (منصة تجارة إلكترونية). التطبيق يستخدم **React 19 + TypeScript + Tailwind CSS** في الواجهة الأمامية، و**Express + better-sqlite3** في الخلفية، مع نظام ترجمة ثلاثي اللغات (عربي/إنجليزي/صيني).

**النتيجة الإجمالية:** تم اكتشاف **42 مشكلة** موزعة كالتالي:
- 🔴 **حرجة (Critical):** 8 مشاكل
- 🟠 **متوسطة (Medium):** 18 مشكلة
- 🟡 **منخفضة (Low):** 16 مشكلة

---

## 1. المشاكل الحرجة (Critical) 🔴

### C1: تجزئة كلمات المرور غير الآمنة (api-server.ts)
**الملف:** `api-server.ts` | **الأسطر:** 816، 855

```typescript
// ❌ غير آمن - مجرد إضافة بادئة نصية!
const passwordHash = `hash_${password}`;
```

**التأثير:** كلمات المرور مخزنة بتجزئة قابلة للعكس بسهولة. أي مخترق يمكنه استخراج كلمات المرور الأصلية بحذف البادئة `hash_`.

**الإصلاح المقترح:**
```typescript
import bcrypt from 'bcrypt';

// التسجيل
const passwordHash = await bcrypt.hash(password, 12);

// تسجيل الدخول
const valid = await bcrypt.compare(password, user.password_hash);
```

---

### C2: نقص التحقق من المخزون عند إنشاء الطلب (api-server.ts)
**الملف:** `api-server.ts` | **الأسطر:** 587-589

```typescript
// ❌ لا يوجد تحقق من كفاية المخزون!
db.prepare("UPDATE products SET stock = stock - ?, sold_count = sold_count + ? WHERE id = ?")
  .run(item.quantity, item.quantity, item.productId);
```

**التأثير:** يمكن للمستخدم طلب كميات تتجاوز المخزون المتاح، مما يؤدي إلى قيم سالبة في قاعدة البيانات.

**الإصلاح المقترح:**
```typescript
// التحقق من المخزون أولاً
const product = db.prepare("SELECT stock FROM products WHERE id = ?").get(item.productId) as { stock: number };
if (!product || product.stock < item.quantity) {
  throw new Error(`Insufficient stock for product ${item.productId}. Available: ${product?.stock ?? 0}`);
}
// ثم التحديث
db.prepare("UPDATE products SET stock = stock - ?, sold_count = sold_count + ? WHERE id = ? AND stock >= ?")
  .run(item.quantity, item.quantity, item.productId, item.quantity);
```

---

### C3: عدم استخدام المعاملات (Transactions) في إنشاء الطلب (api-server.ts)
**الملف:** `api-server.ts` | **الأسطر:** 540-596

```typescript
// ❌ عدة عمليات بدون transaction wrapper
const result = db.prepare("INSERT INTO orders ...").run(...);
const orderId = result.lastInsertRowid;
for (const item of items) {
  insertItem.run(...);
  db.prepare("UPDATE products SET stock ...").run(...);
}
```

**التأثير:** إذا فشلت أي عملية وسطية، تصبح قاعدة البيانات في حالة غير متناسقة (طلب بدون عناصر، أو مخزون تم خصمه بدون طلب).

**الإصلاح المقترح:**
```typescript
const transaction = db.transaction((orderData, items) => {
  const result = db.prepare("INSERT INTO orders ...").run(...orderData);
  const orderId = result.lastInsertRowid;
  for (const item of items) {
    // تحقق من المخزون داخل المعاملة
    const product = db.prepare("SELECT stock FROM products WHERE id = ?").get(item.productId);
    if (!product || product.stock < item.quantity) throw new Error('Insufficient stock');
    insertItem.run(orderId, ...);
    db.prepare("UPDATE products SET stock ...").run(...);
  }
  return orderId;
});
```

---

### C4: السماح بتسجيل أي دور (Role) (api-server.ts)
**الملف:** `api-server.ts` | **السطر:** 803

```typescript
// ❌ أي شخص يمكنه التسجيل كـ admin!
const { email, password, name, role = "customer" } = req.body;
```

**التأثير:** يمكن لأي مستخدم تسجيل حساب بصلاحيات مدير (`role: "admin"`).

**الإصلاح المقترح:**
```typescript
const { email, password, name } = req.body;
const role = "customer"; // الدور ثابت دائماً
```

---

### C5: localStorage غير الآمن في AppContext (AppContext.tsx)
**الملف:** `AppContext.tsx` | **الأسطر:** 25، 38-39

```typescript
// ❌ JSON.parse بدون try-catch + localStorage في initial state
user: JSON.parse(localStorage.getItem('noufex_user') || 'null'),
```

**التأثير:** إذا كان localStorage تالفاً، يتعطل التطبيق بالكامل عند التحميل.

**الإصلاح المقترح:**
```typescript
function loadUser(): User | null {
  try {
    const raw = localStorage.getItem('noufex_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    localStorage.removeItem('noufex_user');
    return null;
  }
}

const initialState: AppState = {
  // ...
  user: loadUser(),
};
```

---

### C6: تحديث localStorage داخل Reducer (CartContext.tsx)
**الملف:** `CartContext.tsx` | **السطر:** 55

```typescript
// ❌ Reducer يجب أن يكون pure function بدون side effects
function cartReducer(state: CartState, action: CartAction): CartState {
  // ...
  saveCart(newItems);  // ← side effect!
  return { items: newItems };
}
```

**التأثير:** Reducer غير نقي (impure) - يسبب side effects. يعطل time-travel debugging وقد يسبب مشاكل في Concurrent Mode.

**الإصلاح المقترح:**
```typescript
// استخدام useEffect للتخزين
export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initial);
  
  useEffect(() => {
    localStorage.setItem('noufex_cart', JSON.stringify(state.items));
  }, [state.items]);
  
  // ...
}
```

---

### C7: تسريب بيانات المستخدم في استجابة API (api-server.ts)
**الملف:** `api-server.ts` | **الأسطر:** 826-828

```typescript
// ❌ يتم إرجاع كل بيانات المستخدم بما في ذلك الحالة
const user = db.prepare("SELECT id, email, full_name, role, status, is_verified, created_at FROM users WHERE id = ?")
  .get(result.lastInsertRowid);
sendSuccess(res, user, "User registered successfully");
```

**التأثير:** قد يتم تسريب معلومات حساسة في استجابة التسجيل.

**الإصلاح المقترح:**
```typescript
const safeUser = {
  id: result.lastInsertRowid,
  email,
  full_name: name,
  role: 'customer',
};
sendSuccess(res, safeUser, "User registered successfully");
```

---

### C8: مشكلة في ترتيب Hooks (Navbar.tsx)
**الملف:** `Navbar.tsx` | **الأسطر:** 26-36

```typescript
// ❌ useEffect قبل useState!
useEffect(() => { ... setUserOpen(false); ... }, []);  // Line 26
// ...
const [userOpen, setUserOpen] = useState(false);  // Line 36 - بعد useEffect!
```

**التأثير:** يخالف قواعد React (Rules of Hooks). قد يسبب مشاكل غير متوقعة عند إضافة شروط مستقبلية.

**الإصلاح المقترح:**
```typescript
export default function Navbar() {
  const { t, i18n } = useTranslation();
  const { state, dispatch } = useApp();
  const { cartCount } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  
  // جميع الـ hooks في الأعلى
  const [searchQ, setSearchQ] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [catDropdownOpen, setCatDropdownOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);  // ← قبل useEffect
  const [searchCat, setSearchCat] = useState('all');
  const userRef = useRef<HTMLDivElement>(null);
  const catRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {  // ← بعد جميع الـ hooks
    function handleClick(e: MouseEvent) {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
      if (catRef.current && !catRef.current.contains(e.target as Node)) setCatDropdownOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);
```

---

## 2. المشاكل المتوسطة (Medium) 🟠

### M1: عدم وجود Rate Limiting (api-server.ts)
**الملف:** `api-server.ts` | **الأسطر:** 29-38

```typescript
// ❌ لا يوجد حماية من الهجمات
app.use(cors());  // مفتوح للجميع
app.use(express.json({ limit: "10mb" }));
```

**الإصلاح المقترح:**
```typescript
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 5, // 5 محاولات
  message: { success: false, error: 'Too many attempts, please try again later' }
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
```

---

### M2: CORS مفتوح بالكامل (api-server.ts)
**الملف:** `api-server.ts` | **السطر:** 30

```typescript
app.use(cors());  // ❌ يسمح لأي نطاق
```

**الإصلاح المقترح:**
```typescript
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
  credentials: true
}));
```

---

### M3: محاكاة DOM أثناء الرندر (AppContext.tsx)
**الملف:** `AppContext.tsx` | **الأسطر:** 56-59

```typescript
// ❌ side effect مباشر في الرندر
if (typeof document !== 'undefined') {
  document.documentElement.lang = state.lang;
  document.documentElement.dir = state.dir;
}
```

**الإصلاح المقترح:**
```typescript
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  
  useEffect(() => {
    document.documentElement.lang = state.lang;
    document.documentElement.dir = state.dir;
  }, [state.lang, state.dir]);
  
  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}
```

---

### M4: عدم وجود route guards (App.tsx)
**الملف:** `App.tsx` | **جميع Routes

```tsx
// ❌ أي شخص يمكنه الوصول لجميع الصفحات
<Route path="/admin" element={<AdminDashboard />} />
<Route path="/seller" element={<SellerDashboard />} />
```

**الإصلاح المقترح:**
```tsx
function ProtectedRoute({ children, allowedRoles }: { children: ReactNode; allowedRoles: Role[] }) {
  const { state } = useApp();
  if (!state.user) return <Navigate to="/auth/login" />;
  if (!allowedRoles.includes(state.user.role)) return <Navigate to="/" />;
  return children;
}

<Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
<Route path="/seller" element={<ProtectedRoute allowedRoles={['merchant']}><SellerDashboard /></ProtectedRoute>} />
```

---

### M5: صفحة 404 غير موجودة (App.tsx)
**الملف:** `App.tsx` | **آخر Route

```tsx
// ❌ لا يوجد catch-all route
// أضف:
<Route path="*" element={<NotFoundPage />} />
```

---

### M6: التنقل يستخدم `react-router` بدلاً من `react-router-dom` (App.tsx + جميع الصفحات)
**الملف:** `App.tsx` | **السطر:** 1

```typescript
import { Routes, Route } from 'react-router';  // ⚠️ ربما يجب التحقق من الإصدار
```

**ملاحظة:** في React Router v7، تم دمج `react-router-dom` في `react-router`. إذا كان المشروع يستخدم v6، فهذه مشكلة.

---

### M7: تحويل `numericId` بدون تحقق (ProductDetail.tsx + StorePage.tsx)
**الملف:** `ProductDetail.tsx` | **السطر:** 34

```typescript
// ❌ لا يوجد تحقق من صحة المعرف
const numericId = Number(id);
// إذا كان id = "abc"، فإن numericId = NaN
```

**الإصلاح المقترح:**
```typescript
const numericId = Number(id);
if (isNaN(numericId) || numericId <= 0) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center">
      <h2>Invalid product ID</h2>
      <Link to="/">Go Home</Link>
    </div>
  );
}
```

---

### M8: عدد عشوائي في JSX (StorePage.tsx)
**الملف:** `StorePage.tsx` | **السطر:** 269

```typescript
// ❌ يتغير على كل رندر!
value: '+967-' + Math.floor(Math.random() * 9000000 + 1000000)
```

**الإصلاح المقترح:**
```typescript
const storePhone = useMemo(() => '+967-' + Math.floor(Math.random() * 9000000 + 1000000), [store?.id]);
```

---

### M9: قسم التصنيفات يعرض أرقام بدل أسماء (StorePage.tsx)
**الملف:** `StorePage.tsx` | **السطر:** 205

```tsx
// ❌ يعرض "فئة 5" بدلاً من "إلكترونيات"
{lang === 'ar' ? `فئة ${catId}` : `Cat ${catId}`}
```

**الإصلاح المقترح:**
```tsx
// استخدام خريطة التصنيفات
const catName = categories.find(c => c.id === catId)?.name_ar || `Cat ${catId}`;
{catName}
```

---

### M10: الترقيم الصفحي ثابت (SearchResults.tsx)
**الملف:** `SearchResults.tsx` | **الأسطر:** 377-381

```tsx
// ❌ دائماً يعرض صفحات 1, 2, 3 بغض النظر عن عدد النتائج
{[1, 2, 3].map(page => (
  <button key={page} ...>{page}</button>
))}
```

**الإصلاح المقترح:** حساب الصفحات ديناميكياً بناءً على `total / limit`.

---

### M11: `as any` في TypeScript (SearchResults.tsx)
**الملف:** `SearchResults.tsx` | **السطر:** 211

```typescript
// ❌ يفقد type safety
onChange={e => setSort(e.target.value as any)}
```

**الإصلاح المقترح:**
```typescript
onChange={e => setSort(e.target.value as typeof sort)}
```

---

### M12: تحديث المخزن المؤقت (jsonData.ts)
**الملف:** `jsonData.ts` | **الأسطر:** 82-87

```typescript
// ❌ تعديل الكائن المخزن مباشرة (mutation)
(product as any).store = stores.find(s => s.id === product.store_id) || null;
(product as any).reviews = reviews.filter(r => r.product_id === id);
```

**التأثير:** البيانات المخزنة مؤقتاً يتم تعديلها، مما يؤثر على المكالمات اللاحقة.

**الإصلاح المقترح:**
```typescript
return {
  ...product,
  store: stores.find(s => s.id === product.store_id) || null,
  reviews: reviews.filter(r => r.product_id === id),
};
```

---

### M13: الـ Timer يستمر بعد انتهاء العد التنازلي (Deals.tsx)
**الملف:** `Deals.tsx` | **الأسطر:** 21-32

```typescript
// ❌ الـ interval يستمر حتى بعد الوصول للصفر
const interval = setInterval(() => {
  const diff = Math.max(0, endTime - Date.now());
  // ...
}, 1000);
```

**الإصلاح المقترح:**
```typescript
const interval = setInterval(() => {
  const diff = Math.max(0, endTime - Date.now());
  setTimeLeft({
    hours: Math.floor(diff / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
  });
  if (diff <= 0) clearInterval(interval); // ← أوقف الـ interval
}, 1000);
```

---

### M14: Lightbox لا يدعم مفتاح Escape (ProductDetail.tsx)
**الملف:** `ProductDetail.tsx` | **الأسطر:** 546-551

```tsx
// ❌ لا يوجد معالج لحدث لوحة المفاتيح
<div className="fixed inset-0 z-[200] bg-black/90 ..." onClick={() => setLightboxOpen(false)}>
```

**الإصلاح المقترح:**
```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') setLightboxOpen(false);
  };
  if (lightboxOpen) {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }
}, [lightboxOpen]);
```

---

### M15: محاكاة الـ Reviews تحدث عند كل رندر (ProductDetail.tsx)
**الملف:** `ProductDetail.tsx` | **الأسطر:** 450-460

```typescript
// ❌ تحسب النسب المئوية عند كل رندر
{[5, 4, 3, 2, 1].map(stars => {
  const pct = Math.round((reviews.filter(r => r.rating === stars).length / Math.max(reviews.length, 1)) * 100);
  // ...
})}
```

**الإصلاح المقترح:**
```typescript
const ratingDistribution = useMemo(() => {
  return [5, 4, 3, 2, 1].map(stars => ({
    stars,
    pct: Math.round((reviews.filter(r => r.rating === stars).length / Math.max(reviews.length, 1)) * 100),
  }));
}, [reviews]);
```

---

### M16: إعادة إنشاء المصفوفات عند كل رندر (Home/index.tsx)
**الملف:** `Home/index.tsx` | **الأسطر:** 139-146، 305-310، 551-580

المصفوفات الثابتة التي تعتمد على اللغة يتم إعادة إنشاؤها عند كل رندر. استخدم `useMemo` للتحسين.

---

### M17: لا يوجد تحقق من صحة المدخلات في API (api-server.ts)
**الملف:** `api-server.ts` | **عدة نقاط

```typescript
// ❌ لا يوجد تحقق من أن rating بين 1 و 5
const { productId, storeId, customerId, rating, title, comment } = req.body;

// ❌ لا يوجد تحقق من أن العناصر مصفوفة صالحة
const { customerId, storeId, items, ... } = req.body;
```

**الإصلاح المقترح:** استخدام مكتبة تحقق مثل `zod` أو `joi`.

---

### M18: الصور بدون أبعاد محددة (ProductDetail.tsx + جميع الصفحات)
**الملف:** `ProductDetail.tsx` | **الأسطر:** 135، 161

```tsx
// ❌ لا يوجد width/height للصورة = layout shift
<img src={allImages[selectedImage]} alt={getName(product)} className="w-full h-full object-cover" />
```

**الإصلاح المقترح:** إضافة `width` و `height` أو استخدام `aspect-ratio` مع placeholder.

---

## 3. المشاكل المنخفضة (Low) 🟡

### L1: استيراد `Flag` غير مستخدم (ProductDetail.tsx)
**الملف:** `ProductDetail.tsx` | **السطر:** 13
```typescript
import { ..., Flag } from 'lucide-react';  // ❌ غير مستخدم
```

### L2: استيراد `useCallback` غير مستخدم كاملاً (Deals.tsx)
**الملف:** `Deals.tsx` | **السطر:** 1
```typescript
import { useState, useEffect, useCallback } from 'react';  // useCallback مستخدم ولكن...
```

### L3: استيراد `useMemo` غير مستخدم (SearchResults.tsx)
**الملف:** `SearchResults.tsx` | **السطر:** 1
```typescript
import { useState, useEffect, useMemo } from 'react';  // ⚠️ useMemo مستخدم مرة واحدة فقط
```

### L4: مفتاح الترجمة `t('common.search')` ربما غير موجود (SearchResults.tsx)
**الملف:** `SearchResults.tsx` | **السطر:** 155
```tsx
<span className="hidden lg:inline">{t('nav.search')}</span>
```

### L5: `CheckSquare` مستورد ولكن غير مستخدم فعلياً في القالب (SearchResults.tsx)
**الملف:** `SearchResults.tsx` | **السطر:** 8

### L6: القيمة `totalProductCount` تحسب جميع التصنيفات بما فيها الفرعية (Categories.tsx)
**الملف:** `Categories.tsx` | **السطر:** 136
```typescript
const totalProductCount = allCategories.reduce((sum, c) => sum + (c.product_count ?? 0), 0);
// هذا يحسب المنتجات مرتين (التصنيف الرئيسي + الفرعي)
```

### L7: النصوص المختلطة بين i18n والنصوص المباشرة (Home/index.tsx)
**الملف:** `Home/index.tsx` | **عدة مواقع

الصفحة تستخدم مزيجاً غير متسق: أحياناً `t('key')` وأحياناً نصوص مباشرة مع `i18n.language === 'ar'`. يجب توحيد النهج.

### L8: مكونات SVG مكررة (ProductDetail.tsx + StorePage.tsx)
**الملف:** `ProductDetail.tsx` | **الأسطر:** 557-579

```tsx
// CalendarIcon, MapPin, PackageIcon معرفة يدوياً
// يمكن استبدالها بـ lucide-react equivalents
```

### L9: `escapeValue: false` في i18n (i18n/index.ts)
**الملف:** `i18n/index.ts` | **السطر:** 17

```typescript
interpolation: { escapeValue: false },  // ⚠️ يتطلب التأكد من تطهير المدخلات
```

**ملاحظة:** هذا مقبول إذا كان React يتعامل مع XSS (وهو كذلك)، لكن يجب توثيقه.

### L10: لا يوجد helmet/security headers (api-server.ts)
**الملف:** `api-server.ts` | **غائب

```typescript
// ❌ لا يوجد:
// Content-Security-Policy
// X-Frame-Options
// X-Content-Type-Options
```

### L11: استخدام `console.log` في الإنتاج (api-server.ts)
**الملف:** `api-server.ts` | **السطر:** 36

```typescript
console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
// يجب استخدام مكتبة logging مثل winston أو pino
```

### L12: لا يوجد معالج لإلغاء الطلبات (useApi.ts)
**الملف:** `useApi.ts` | **الأسطر:** 46-69

```typescript
// ❌ لا يوجد AbortController
const fetch = useCallback(async () => {
  setLoading(true);
  // إذا تم unmount أثناء التحميل، يحدث تسرب
}, deps);
```

### L13: hardcoded pagination pages (SearchResults.tsx)
**الملف:** `SearchResults.tsx` | **الأسطر:** 377-380

أزرار الترقيم الصفحي (1, 2, 3) ثابتة ولا تعمل فعلياً.

### L14: `className="border-3"` غير قياسي (ProductDetail.tsx + StorePage.tsx)
**الملف:** `ProductDetail.tsx` | **السطر:** 63

```tsx
<div className="w-10 h-10 border-3 border-[#FF6A00] ..." />
// Tailwind لا يدعم border-3 افتراضياً (يجب تفعيل Arbitrary values)
```

### L15: التباين بين `className` الملون و Tailwind (عدة ملفات)

بعض الملفات تستخدم ألوان مخصصة مثل `[#FF6A00]` بكثرة. يُفضل تعريفها في `tailwind.config.js` كـ `aliOrange` و `aliText` إلخ.

### L16: `useProducts` تُستدعى بكائنات مختلفة عند كل رندر (Home/index.tsx)
**الملف:** `Home/index.tsx` | **الأسطر:** 85-88

```typescript
// ⚠️ كل استدعاء ينشئ كائن جديد (يعمل بفضل JSON.stringify في deps)
const { data: popularResp } = useProducts({ limit: 24, sort: 'popular' });
const { data: dealsResp   } = useProducts({ limit: 4,  sort: 'popular' });
```

---

## 4. الملفات التي تحتاج إعادة كتابة

| الملف | الأولوية | السبب |
|-------|----------|-------|
| `api-server.ts` | 🔴 حرجة | 5 مشاكل حرجة (تجزئة كلمات المرور، المعاملات، المخزون، الأدوار، Rate Limiting) |
| `AppContext.tsx` | 🔴 حرجة | محاكاة DOM في الرندر + localStorage غير الآمن |
| `CartContext.tsx` | 🟠 متوسطة | Reducer غير نقي (side effects) |
| `Navbar.tsx` | 🟠 متوسطة | ترتيب Hooks خاطئ + تبعيات مفقودة في useEffect |

---

## 5. الملفات التي تحتاج إصلاح

| الملف | الأولوية | عدد المشاكل |
|-------|----------|-------------|
| `ProductDetail.tsx` | 🟠 متوسطة | 7 (escape key, NaN check, useMemo, unused imports, alt text) |
| `StorePage.tsx` | 🟠 متوسطة | 4 (Math.random, cat names, RTL) |
| `SearchResults.tsx` | 🟠 متوسطة | 4 (pagination, as any, error handling) |
| `Deals.tsx` | 🟠 متوسطة | 2 (timer leak, type) |
| `Home/index.tsx` | 🟡 منخفضة | 4 (useMemo, inconsistency, flyout) |
| `Categories.tsx` | 🟡 منخفضة | 2 (double count, i18n) |
| `jsonData.ts` | 🟠 متوسطة | 2 (mutation, cache) |
| `useApi.ts` | 🟡 منخفضة | 2 (cleanup, AbortController) |
| `App.tsx` | 🟠 متوسطة | 3 (404, route guards, router import) |
| `i18n/index.ts` | 🟡 منخفضة | 1 (escapeValue) |

---

## 6. توصيات عامة

### 6.1 الأمان
1. **استخدم bcrypt** لتجزئة كلمات المرور فوراً
2. **أضف rate limiting** على جميع نقاط النهاية الحساسة
3. **حدد CORS origins** في الإنتاج
4. **أضف Helmet.js** لرؤوس الأمان
5. **تحقق من صحة المدخلات** باستخدام Zod
6. **استخدم transactions** لجميع العمليات المتعددة الخطوات

### 6.2 الأداء
1. **غلف `useMemo`** حول جميع الحسابات الثقيلة (distribution, filtering)
2. **استخدم `React.memo`** للمكونات التي تُعاد كثيراً (DealCard, ProductCard)
3. **أضف `AbortController`** في hooks لإلغاء الطلبات
4. **استخدم `useCallback`** للدوال المُمررة كـ props

### 6.3 جودة الكود
1. **وحّد نهج الترجمة** - استخدم i18n keys فقط بدلاً من الشروط
2. **أنشئ مكونات مشتركة** للبطاقات المتكررة (ProductCard, DealCard)
3. **استخرج helpers** المشتركة (getProductName, formatPrice) إلى utils
4. **أضف اختبارات** للـ hooks والـ reducers

### 6.4 تجربة المستخدم
1. **أضف صفحة 404** مخصصة
2. **أضف route guards** للصفحات المحمية
3. **أصلح الترقيم الصفحي** ليكون ديناميكياً
4. **أضف loading skeletons** لجميع الأقسام

---

## 7. ملخص الإحصائيات

```
إجمالي المشاكل:        42
  ├─ حرجة:              8
  ├─ متوسطة:           18
  └─ منخفضة:           16

الملفات المراجعة:      14
  ├─ تحتاج إعادة كتابة: 4
  └─ تحتاج إصلاح:      10
```

---

*تم إعداد هذا التقرير بتاريخ ${new Date().toISOString().split('T')[0]}*
