import { useState } from 'react';
import { MapPin, Plus, Edit3, Trash2, CheckCircle, Home, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import CustomerSidebar from './CustomerSidebar';

interface Address {
  id: number;
  name: string;
  phone: string;
  governorate: string;
  city: string;
  district: string;
  street: string;
  building: string;
  directions: string;
  isDefault: boolean;
}

const yemeniGovernorates = [
  'صنعاء', 'عدن', 'تعز', 'الحديدة', 'إب', 'المحويت', 'ذمار', 'البيضاء',
  'مأرب', 'الجوف', 'عمران', 'صعدة', 'حجة', 'ريمة', 'الضالع', 'لحج', 'أبين', 'شبوة', 'المهرة', 'حضرموت', 'سقطرى',
];

const initialAddresses: Address[] = [
  {
    id: 1,
    name: 'أحمد محمد',
    phone: '+967 771 234 567',
    governorate: 'صنعاء',
    city: 'صنعاء',
    district: 'حدة',
    street: 'شارع حدة الرئيسي',
    building: 'عمارة الأوراس - الطابق ٣ - شقة ١٢',
    directions: 'بجانك صيدلية النهدي، مدخل جانبي',
    isDefault: true,
  },
  {
    id: 2,
    name: 'أحمد محمد',
    phone: '+967 771 234 567',
    governorate: 'عدن',
    city: 'المنصورة',
    district: 'المنصورة',
    street: 'شارع الجمهورية',
    building: 'بناية السعيد - الطابق ٢',
    directions: 'خلف محل الأندلس',
    isDefault: false,
  },
];

export default function Addresses() {
  const [addresses, setAddresses] = useState<Address[]>(initialAddresses);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<Address>>({});

  const openAdd = () => {
    setEditingId(null);
    setForm({ isDefault: false });
    setDialogOpen(true);
  };

  const openEdit = (addr: Address) => {
    setEditingId(addr.id);
    setForm({ ...addr });
    setDialogOpen(true);
  };

  const saveAddress = () => {
    if (!form.name || !form.phone || !form.governorate || !form.city || !form.street) return;

    if (editingId) {
      setAddresses((prev) =>
        prev.map((a) => (a.id === editingId ? { ...a, ...form } as Address : a))
      );
    } else {
      const newAddr: Address = {
        id: Date.now(),
        name: form.name || '',
        phone: form.phone || '',
        governorate: form.governorate || '',
        city: form.city || '',
        district: form.district || '',
        street: form.street || '',
        building: form.building || '',
        directions: form.directions || '',
        isDefault: form.isDefault || false,
      };
      if (newAddr.isDefault) {
        setAddresses((prev) => [...prev.map((a) => ({ ...a, isDefault: false })), newAddr]);
      } else {
        setAddresses((prev) => [...prev, newAddr]);
      }
    }
    setDialogOpen(false);
  };

  const deleteAddress = (id: number) => {
    setAddresses((prev) => prev.filter((a) => a.id !== id));
  };

  const setDefault = (id: number) => {
    setAddresses((prev) =>
      prev.map((a) => ({ ...a, isDefault: a.id === id }))
    );
  };

  return (
    <div className="min-h-[100dvh] bg-[#F8F8F8]" dir="rtl">
      <CustomerSidebar />

      <div className="md:mr-60 min-h-[100dvh]">
        <div className="bg-white border-b border-[#F3EDE4] px-6 py-4 sticky top-0 z-30 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-amiri font-bold text-[#1A1612]">عناويني</h1>
            <p className="text-sm text-[#6B6B6B] font-cairo mt-1">إدارة عناوين الشحن</p>
          </div>
          <Button
            onClick={openAdd}
            className="bg-[#D4A853] text-[#1A1612] hover:bg-[#c49a48] font-cairo font-semibold rounded-xl"
          >
            <Plus className="w-4 h-4 ml-1" strokeWidth={1.5} />
            إضافة عنوان
          </Button>
        </div>

        <div className="p-6 max-w-4xl mx-auto">
          {addresses.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
              <MapPin className="w-20 h-20 text-[#AAAAAA] mx-auto mb-4" strokeWidth={1} />
              <h3 className="text-xl font-amiri font-bold text-[#1A1612] mb-2">لا توجد عناوين</h3>
              <p className="text-[#6B6B6B] font-cairo text-sm mb-4">أضف عنواناً لشحن طلباتك إليه</p>
              <Button onClick={openAdd} className="bg-[#D4A853] text-[#1A1612] hover:bg-[#c49a48] font-cairo rounded-xl">
                <Plus className="w-4 h-4 ml-1" strokeWidth={1.5} />
                إضافة عنوان جديد
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {addresses.map((addr) => (
                <div
                  key={addr.id}
                  className={`bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow ${
                    addr.isDefault ? 'ring-2 ring-[#D4A853]' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        addr.isDefault ? 'bg-[#D4A853]/15' : 'bg-[#F8F8F8]'
                      }`}>
                        {addr.building ? (
                          <Building2 className={`w-5 h-5 ${addr.isDefault ? 'text-[#D4A853]' : 'text-[#6B6B6B]'}`} strokeWidth={1.5} />
                        ) : (
                          <Home className={`w-5 h-5 ${addr.isDefault ? 'text-[#D4A853]' : 'text-[#6B6B6B]'}`} strokeWidth={1.5} />
                        )}
                      </div>
                      <div>
                        <p className="font-cairo font-semibold text-sm text-[#111111]">{addr.name}</p>
                        <p className="text-xs text-[#6B6B6B] font-cairo">{addr.phone}</p>
                      </div>
                    </div>
                    {addr.isDefault && (
                      <span className="bg-[#D4A853] text-[#1A1612] text-[10px] font-cairo font-semibold px-2.5 py-1 rounded-full">
                        افتراضي
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 mb-4">
                    <p className="text-sm text-[#111111] font-cairo">
                      {addr.street}، {addr.district}، {addr.city}
                    </p>
                    {addr.building && (
                      <p className="text-xs text-[#6B6B6B] font-cairo">{addr.building}</p>
                    )}
                    {addr.directions && (
                      <p className="text-xs text-[#AAAAAA] font-cairo">{addr.directions}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 mb-4">
                    <span className="bg-[#F3EDE4] text-[#6B6B6B] text-[10px] font-cairo font-medium px-2 py-1 rounded-full">
                      {addr.governorate}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(addr)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[#F3EDE4] text-sm text-[#6B6B6B] hover:bg-[#F8F8F8] font-cairo transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" strokeWidth={1.5} />
                      تعديل
                    </button>
                    <button
                      onClick={() => deleteAddress(addr.id)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[#EF4444]/20 text-sm text-[#EF4444] hover:bg-[#EF4444]/10 font-cairo transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </button>
                  </div>

                  {!addr.isDefault && (
                    <button
                      onClick={() => setDefault(addr.id)}
                      className="w-full mt-2 flex items-center justify-center gap-1.5 text-xs text-[#D4A853] font-cairo font-medium hover:underline py-1"
                    >
                      <CheckCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
                      تعيين كافتراضي
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Address Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="font-amiri text-xl text-[#1A1612]">
              {editingId ? 'تعديل العنوان' : 'إضافة عنوان جديد'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="font-cairo text-sm text-[#111111]">الاسم الكامل</Label>
              <Input
                value={form.name || ''}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="الاسم كما يظهر على البطاقة"
                className="rounded-xl mt-1 font-cairo"
              />
            </div>
            <div>
              <Label className="font-cairo text-sm text-[#111111]">رقم الهاتف</Label>
              <Input
                value={form.phone || ''}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+967 7XX XXX XXX"
                className="rounded-xl mt-1 font-cairo"
              />
            </div>
            <div>
              <Label className="font-cairo text-sm text-[#111111]">المحافظة</Label>
              <select
                value={form.governorate || ''}
                onChange={(e) => setForm((f) => ({ ...f, governorate: e.target.value }))}
                className="w-full mt-1 rounded-xl border border-[#e4e4e7] px-3 py-2 text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
              >
                <option value="">اختر المحافظة</option>
                {yemeniGovernorates.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-cairo text-sm text-[#111111]">المدينة</Label>
                <Input
                  value={form.city || ''}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  placeholder="المدينة"
                  className="rounded-xl mt-1 font-cairo"
                />
              </div>
              <div>
                <Label className="font-cairo text-sm text-[#111111]">الحي/المنطقة</Label>
                <Input
                  value={form.district || ''}
                  onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))}
                  placeholder="الحي"
                  className="rounded-xl mt-1 font-cairo"
                />
              </div>
            </div>
            <div>
              <Label className="font-cairo text-sm text-[#111111]">الشارع</Label>
              <Input
                value={form.street || ''}
                onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))}
                placeholder="اسم الشارع الرئيسي"
                className="rounded-xl mt-1 font-cairo"
              />
            </div>
            <div>
              <Label className="font-cairo text-sm text-[#111111]">المبنى/الطابق/الشقة</Label>
              <Input
                value={form.building || ''}
                onChange={(e) => setForm((f) => ({ ...f, building: e.target.value }))}
                placeholder="مثال: عمارة الأوراس - الطابق ٣ - شقة ١٢"
                className="rounded-xl mt-1 font-cairo"
              />
            </div>
            <div>
              <Label className="font-cairo text-sm text-[#111111]">إرشادات إضافية</Label>
              <Textarea
                value={form.directions || ''}
                onChange={(e) => setForm((f) => ({ ...f, directions: e.target.value }))}
                placeholder="أي معلومات إضافية تساعد المندوب في الوصول..."
                className="rounded-xl mt-1 font-cairo min-h-[80px] resize-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.isDefault || false}
                onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
                className="w-4 h-4 rounded accent-[#D4A853]"
              />
              <Label className="font-cairo text-sm text-[#111111] cursor-pointer">تعيين كعنوان افتراضي</Label>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                onClick={saveAddress}
                className="flex-1 bg-[#D4A853] text-[#1A1612] hover:bg-[#c49a48] font-cairo font-semibold rounded-xl h-11"
              >
                {editingId ? 'حفظ التعديلات' : 'إضافة العنوان'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setDialogOpen(false)}
                className="font-cairo rounded-xl h-11"
              >
                إلغاء
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
