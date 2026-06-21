import { useState } from 'react';
import { Heart, ShoppingCart, X, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CustomerSidebar from './CustomerSidebar';

interface WishlistItem {
  id: number;
  name: string;
  price: string;
  originalPrice?: string;
  merchant: string;
  rating: number;
}

const initialItems: WishlistItem[] = [
  { id: 1, name: 'سماعات لاسلكية فاخرة مع إلغاء الضوضاء', price: '٤٥,٠٠٠ ر.ي', originalPrice: '٦٠,٠٠٠ ر.ي', merchant: 'إلكترونيات اليمن', rating: 4.5 },
  { id: 2, name: 'ساعة ذكية رياضية مقاومة للماء', price: '٧٨,٠٠٠ ر.ي', merchant: 'تك ستور', rating: 4.8 },
  { id: 3, name: 'حقيبة جلدية يدوية أصلية', price: '١٢٠,٠٠٠ ر.ي', originalPrice: '١٥٠,٠٠٠ ر.ي', merchant: 'حرف يمنية', rating: 4.2 },
  { id: 4, name: 'عسل يمني كريمي درجة أولى', price: '٣٥,٠٠٠ ر.ي', merchant: 'منتجات يمنية', rating: 4.9 },
  { id: 5, name: 'بن يمني محمص فاخر (كيلو)', price: '١٢,٥٠٠ ر.ي', merchant: 'قهوة صنعاء', rating: 4.7 },
  { id: 6, name: 'جوال سامسونج جالكسي A54', price: '٢٩٠,٠٠٠ ر.ي', originalPrice: '٣٢٠,٠٠٠ ر.ي', merchant: 'إلكترونيات اليمن', rating: 4.4 },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Heart
          key={s}
          className={`w-3 h-3 ${s <= Math.floor(rating) ? 'text-[#D4A853] fill-[#D4A853]' : 'text-[#AAAAAA]'}`}
          strokeWidth={1.5}
        />
      ))}
      <span className="text-[10px] text-[#6B6B6B] font-cairo mr-1">{rating}</span>
    </div>
  );
}

export default function Wishlist() {
  const [items, setItems] = useState<WishlistItem[]>(initialItems);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [addedToCart, setAddedToCart] = useState<number | null>(null);

  const removeItem = (id: number) => {
    setRemovingId(id);
    setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
      setRemovingId(null);
    }, 200);
  };

  const moveToCart = (id: number) => {
    setAddedToCart(id);
    setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
      setAddedToCart(null);
    }, 800);
  };

  return (
    <div className="min-h-[100dvh] bg-[#F8F8F8]" dir="rtl">
      <CustomerSidebar />

      <div className="md:mr-60 min-h-[100dvh]">
        <div className="bg-white border-b border-[#F3EDE4] px-6 py-4 sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-amiri font-bold text-[#1A1612]">المفضلة</h1>
              <p className="text-sm text-[#6B6B6B] font-cairo mt-1">المنتجات التي حفظتها</p>
            </div>
            <span className="text-sm text-[#6B6B6B] font-cairo bg-[#F3EDE4] px-3 py-1 rounded-full">
              {items.length} منتج
            </span>
          </div>
        </div>

        <div className="p-6 max-w-5xl mx-auto">
          {items.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
              <Heart className="w-20 h-20 text-[#AAAAAA] mx-auto mb-4" strokeWidth={1} />
              <h3 className="text-xl font-amiri font-bold text-[#1A1612] mb-2">قائمة المفضلة فارغة</h3>
              <p className="text-[#6B6B6B] font-cairo text-sm mb-6">
                اضغط على <Heart className="w-4 h-4 inline text-[#AAAAAA]" strokeWidth={1.5} /> أثناء التسوق لحفظ المنتجات هنا
              </p>
              <Button className="bg-[#D4A853] text-[#1A1612] hover:bg-[#c49a48] font-cairo rounded-xl">
                استكشف المنتجات
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={`bg-white rounded-2xl shadow-sm overflow-hidden group transition-all duration-200 ${
                    removingId === item.id ? 'scale-95 opacity-0' : 'opacity-100'
                  } ${addedToCart === item.id ? 'ring-2 ring-[#10B981]' : ''}`}
                >
                  {/* Image area */}
                  <div className="relative aspect-square bg-[#F8F8F8] flex items-center justify-center overflow-hidden">
                    <Package className="w-12 h-12 text-[#AAAAAA]" strokeWidth={1} />

                    {/* Remove button */}
                    <button
                      onClick={() => removeItem(item.id)}
                      className="absolute top-3 left-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#EF4444] hover:text-white text-[#6B6B6B]"
                    >
                      <X className="w-4 h-4" strokeWidth={1.5} />
                    </button>

                    {/* Discount badge */}
                    {item.originalPrice && (
                      <span className="absolute top-3 right-3 bg-[#EF4444] text-white text-[10px] font-cairo font-semibold px-2 py-1 rounded-full">
                        خصم
                      </span>
                    )}

                    {addedToCart === item.id && (
                      <div className="absolute inset-0 bg-[#10B981]/90 flex items-center justify-center">
                        <div className="text-center">
                          <CheckIcon />
                          <p className="text-white font-cairo font-semibold text-sm mt-2">تمت الإضافة</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <h3 className="font-cairo font-medium text-sm text-[#111111] line-clamp-2 min-h-[2.5rem]">
                      {item.name}
                    </h3>
                    <p className="text-[11px] text-[#6B6B6B] font-cairo mt-1">{item.merchant}</p>
                    <StarRating rating={item.rating} />

                    <div className="flex items-center gap-2 mt-2">
                      <span className="font-mono font-bold text-[#D4A853]">{item.price}</span>
                      {item.originalPrice && (
                        <span className="font-mono text-xs text-[#AAAAAA] line-through">{item.originalPrice}</span>
                      )}
                    </div>

                    <Button
                      onClick={() => moveToCart(item.id)}
                      className="w-full mt-3 bg-[#D4A853] text-[#1A1612] hover:bg-[#c49a48] font-cairo font-semibold rounded-xl h-10 text-sm"
                    >
                      <ShoppingCart className="w-4 h-4 ml-1" strokeWidth={1.5} />
                      أضف إلى السلة
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="w-10 h-10 text-white mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
