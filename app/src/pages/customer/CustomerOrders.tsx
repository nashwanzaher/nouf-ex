import { useState } from 'react';
import { Package, ChevronDown, ChevronUp, RefreshCw, Truck, RotateCcw, Clock, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CustomerSidebar from './CustomerSidebar';

type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

interface OrderItem {
  name: string;
  qty: number;
  price: string;
}

interface Order {
  id: string;
  date: string;
  status: OrderStatus;
  statusLabel: string;
  total: string;
  items: OrderItem[];
  address: string;
}

const statusFilters = [
  { key: 'all', label: 'الكل' },
  { key: 'pending', label: 'قيد الانتظار' },
  { key: 'processing', label: 'قيد المعالجة' },
  { key: 'shipped', label: 'قيد الشحن' },
  { key: 'delivered', label: 'تم التوصيل' },
  { key: 'cancelled', label: 'ملغي' },
];

const statusColors: Record<OrderStatus, string> = {
  pending: 'bg-[#F59E0B] text-white',
  processing: 'bg-[#2563EB] text-white',
  shipped: 'bg-[#8B5CF6] text-white',
  delivered: 'bg-[#10B981] text-white',
  cancelled: 'bg-[#EF4444] text-white',
};

const allOrders: Order[] = [
  {
    id: 'NOUF-1234', date: '٢٠ يونيو ٢٠٢٥', status: 'delivered', statusLabel: 'تم التوصيل',
    total: '٢٥٠,٠٠٠ ر.ي', items: [{ name: 'سماعات لاسلكية', qty: 1, price: '٤٥,٠٠٠' }, { name: 'ساعة ذكية', qty: 2, price: '١٠٢,٥٠٠' }],
    address: 'صنعاء - شارع حدة - عمارة الأوراس - الطابق ٣',
  },
  {
    id: 'NOUF-1235', date: '١٨ يونيو ٢٠٢٥', status: 'shipped', statusLabel: 'قيد الشحن',
    total: '١٨٠,٠٠٠ ر.ي', items: [{ name: 'حقيبة جلدية', qty: 1, price: '١٢٠,٠٠٠' }, { name: 'محفظة جلدية', qty: 1, price: '٦٠,٠٠٠' }],
    address: 'عدن - المنصورة - شارع الجمهورية - بناية السعيد',
  },
  {
    id: 'NOUF-1236', date: '١٥ يونيو ٢٠٢٥', status: 'pending', statusLabel: 'قيد الانتظار',
    total: '٩٥,٠٠٠ ر.ي', items: [{ name: 'مكمل غذائي', qty: 3, price: '٩٥,٠٠٠' }],
    address: 'صنعاء - شارع الستين - جوار البنك الأهلي',
  },
  {
    id: 'NOUF-1237', date: '١٠ يونيو ٢٠٢٥', status: 'processing', statusLabel: 'قيد المعالجة',
    total: '٣٢٠,٠٠٠ ر.ي', items: [{ name: 'هاتف ذكي', qty: 1, price: '٣٢٠,٠٠٠' }],
    address: 'تعز - شارع الجحاف - عمارة السلام',
  },
  {
    id: 'NOUF-1238', date: '٥ يونيو ٢٠٢٥', status: 'cancelled', statusLabel: 'ملغي',
    total: '٤٥,٠٠٠ ر.ي', items: [{ name: 'كيبل شحن', qty: 2, price: '٤٥,٠٠٠' }],
    address: 'الحديدة - شارع صنعاء - بناية الرشيد',
  },
];

const timelineSteps = [
  { key: 'pending', label: 'تم الطلب', icon: Clock },
  { key: 'processing', label: 'قيد المعالجة', icon: Package },
  { key: 'shipped', label: 'تم الشحن', icon: Truck },
  { key: 'delivered', label: 'تم التوصيل', icon: CheckCircle },
];

function OrderTimeline({ status }: { status: OrderStatus }) {
  if (status === 'cancelled') return null;
  const activeIndex = timelineSteps.findIndex((s) => s.key === status);

  return (
    <div className="mt-6 p-5 bg-[#F8F8F8] rounded-xl">
      <p className="text-sm font-cairo font-semibold text-[#111111] mb-4">تتبع الطلب</p>
      <div className="flex items-start justify-between relative">
        <div className="absolute top-4 right-6 left-6 h-0.5 bg-[#F3EDE4] z-0" />
        <div
          className="absolute top-4 right-6 h-0.5 bg-[#D4A853] z-0 transition-all"
          style={{ width: `${(activeIndex / (timelineSteps.length - 1)) * 100}%` }}
        />
        {timelineSteps.map((step, idx) => {
          const isActive = idx <= activeIndex;
          const StepIcon = step.icon;
          return (
            <div key={step.key} className="flex flex-col items-center relative z-10 gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                isActive ? 'bg-[#D4A853] border-[#D4A853] text-white' : 'bg-white border-[#AAAAAA] text-[#AAAAAA]'
              }`}>
                <StepIcon className="w-4 h-4" strokeWidth={1.5} />
              </div>
              <span className={`text-[10px] font-cairo font-medium ${isActive ? 'text-[#111111]' : 'text-[#AAAAAA]'}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CustomerOrders() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredOrders = activeFilter === 'all'
    ? allOrders
    : allOrders.filter((o) => o.status === activeFilter);

  return (
    <div className="min-h-[100dvh] bg-[#F8F8F8]" dir="rtl">
      <CustomerSidebar />

      <div className="md:mr-60 min-h-[100dvh]">
        <div className="bg-white border-b border-[#F3EDE4] px-6 py-4 sticky top-0 z-30">
          <h1 className="text-2xl font-amiri font-bold text-[#1A1612]">طلباتي</h1>
          <p className="text-sm text-[#6B6B6B] font-cairo mt-1">تتبع وإدارة طلباتك</p>
        </div>

        <div className="p-6 max-w-4xl mx-auto space-y-6">
          {/* Filter tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {statusFilters.map((f) => (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`px-4 py-2 rounded-full text-sm font-cairo font-medium whitespace-nowrap transition-colors ${
                  activeFilter === f.key
                    ? 'bg-[#D4A853] text-[#1A1612]'
                    : 'bg-white text-[#6B6B6B] hover:bg-[#F3EDE4]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Orders */}
          {filteredOrders.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
              <div className="w-20 h-20 bg-[#F8F8F8] rounded-full flex items-center justify-center mx-auto mb-4">
                <Package className="w-10 h-10 text-[#AAAAAA]" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-amiri font-bold text-[#1A1612] mb-2">لا توجد طلبات</h3>
              <p className="text-[#6B6B6B] font-cairo text-sm mb-4">لا توجد طلبات في هذه الحالة حالياً</p>
              <Button className="bg-[#D4A853] text-[#1A1612] hover:bg-[#c49a48] font-cairo rounded-xl">
                تصفح المنتجات
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => {
                const expanded = expandedId === order.id;
                return (
                  <div key={order.id} className="bg-white rounded-2xl shadow-sm overflow-hidden transition-shadow hover:shadow-md">
                    {/* Order header */}
                    <div className="p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-[#F3EDE4] flex items-center justify-center shrink-0">
                            <Package className="w-6 h-6 text-[#D4A853]" strokeWidth={1.5} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-cairo font-bold text-[#111111]">#{order.id}</p>
                              <span className={`text-[11px] font-cairo font-medium px-2.5 py-0.5 rounded-full ${statusColors[order.status]}`}>
                                {order.statusLabel}
                              </span>
                            </div>
                            <p className="text-xs text-[#6B6B6B] font-cairo mt-0.5">{order.date} · {order.items.length} منتجات</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="font-mono font-bold text-[#D4A853] text-lg">{order.total}</p>
                          <button
                            onClick={() => setExpandedId(expanded ? null : order.id)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F8F8F8] transition-colors"
                          >
                            {expanded ? (
                              <ChevronUp className="w-5 h-5 text-[#6B6B6B]" strokeWidth={1.5} />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-[#6B6B6B]" strokeWidth={1.5} />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Quick items preview */}
                      <div className="mt-4 flex gap-3 overflow-x-auto">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2 bg-[#F8F8F8] rounded-lg px-3 py-2 shrink-0">
                            <Package className="w-4 h-4 text-[#AAAAAA]" strokeWidth={1.5} />
                            <span className="text-xs font-cairo text-[#111111]">{item.name}</span>
                            <span className="text-[10px] text-[#6B6B6B]">x{item.qty}</span>
                          </div>
                        ))}
                      </div>

                      {/* Actions */}
                      <div className="mt-4 flex gap-2">
                        {order.status !== 'cancelled' && (
                          <Button variant="outline" size="sm" className="border-[#D4A853] text-[#D4A853] hover:bg-[#F3EDE4] font-cairo text-xs rounded-lg h-9">
                            <Truck className="w-3.5 h-3.5 ml-1" strokeWidth={1.5} />
                            تتبع الطلب
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="text-[#6B6B6B] hover:text-[#1A1612] font-cairo text-xs rounded-lg h-9">
                          <RefreshCw className="w-3.5 h-3.5 ml-1" strokeWidth={1.5} />
                          إعادة الطلب
                        </Button>
                        {order.status === 'delivered' && (
                          <Button variant="ghost" size="sm" className="text-[#6B6B6B] hover:text-[#1A1612] font-cairo text-xs rounded-lg h-9">
                            <RotateCcw className="w-3.5 h-3.5 ml-1" strokeWidth={1.5} />
                            الإرجاع
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {expanded && (
                      <div className="border-t border-[#F3EDE4] px-5 pb-5">
                        <OrderTimeline status={order.status} />

                        <div className="mt-5">
                          <p className="text-sm font-cairo font-semibold text-[#111111] mb-3">تفاصيل المنتجات</p>
                          <div className="space-y-2">
                            {order.items.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between bg-[#F8F8F8] rounded-lg px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <Package className="w-5 h-5 text-[#AAAAAA]" strokeWidth={1.5} />
                                  <span className="text-sm font-cairo text-[#111111]">{item.name}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                  <span className="text-xs text-[#6B6B6B]">الكمية: {item.qty}</span>
                                  <span className="font-mono text-sm text-[#D4A853]">{item.price} ر.ي</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="mt-5 flex items-start gap-2 bg-[#F8F8F8] rounded-lg px-4 py-3">
                          <Truck className="w-5 h-5 text-[#6B6B6B] shrink-0 mt-0.5" strokeWidth={1.5} />
                          <div>
                            <p className="text-sm font-cairo font-semibold text-[#111111]">عنوان الشحن</p>
                            <p className="text-xs text-[#6B6B6B] font-cairo mt-1">{order.address}</p>
                          </div>
                        </div>

                        <div className="mt-4 flex justify-between items-center bg-[#1A1612] rounded-xl px-5 py-4">
                          <span className="text-white font-cairo font-semibold text-sm">الإجمالي</span>
                          <span className="font-mono font-bold text-[#D4A853] text-lg">{order.total}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
