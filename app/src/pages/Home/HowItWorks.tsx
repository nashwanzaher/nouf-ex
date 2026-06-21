import { useEffect, useRef } from 'react';
import { UserPlus, Store, Upload, TrendingUp, Search, Heart, ShoppingCart, Package } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const merchantSteps = [
  { icon: UserPlus, title: 'سجل حسابك', desc: 'أنشئ حساب تاجر في دقيقتين', color: '#D4A853' },
  { icon: Store, title: 'أنشئ متجرك', desc: 'خصص متجرك باسمك وشعارك', color: '#D4A853' },
  { icon: Upload, title: 'أضف منتجاتك', desc: 'ارفع صور ووصف لمنتجاتك', color: '#D4A853' },
  { icon: TrendingUp, title: 'ابدأ البيع', desc: 'استلم الطلبات ووسع عملك', color: '#D4A853' },
];

const customerSteps = [
  { icon: Search, title: 'ابحث', desc: 'ابحث عن أي منتج أو تاجر', color: '#2563EB' },
  { icon: Heart, title: 'قارن واختر', desc: 'قارن الأسعار والتقييمات', color: '#2563EB' },
  { icon: ShoppingCart, title: 'اطلب بثقة', desc: 'ادفع عند الاستلام أو إلكترونياً', color: '#2563EB' },
  { icon: Package, title: 'استلم طلبك', desc: 'توصيل سريع لباب بيتك', color: '#2563EB' },
];

function StepColumn({
  label,
  steps,
  accentColor,
}: {
  label: string;
  steps: typeof merchantSteps;
  accentColor: string;
}) {
  return (
    <div className="relative">
      <h3 className="text-lg font-cairo font-bold mb-6 text-center" style={{ color: accentColor }}>
        {label}
      </h3>
      <div className="relative space-y-6">
        {/* Connecting Line */}
        <div
          className="absolute right-6 top-8 bottom-8 w-0.5 hidden md:block"
          style={{ background: `linear-gradient(to bottom, ${accentColor}40, ${accentColor})` }}
        />
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <div key={i} className={`hw-step flex items-start gap-4 relative ${label === 'للعملاء' ? 'md:flex-row-reverse' : ''}`}>
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 relative z-10"
                style={{ backgroundColor: `${step.color}15`, border: `2px solid ${step.color}` }}
              >
                <Icon className="w-5 h-5" style={{ color: step.color }} strokeWidth={1.5} />
              </div>
              <div className="flex-1 pt-1">
                <h4 className="font-cairo font-bold text-[#111111] text-sm md:text-base mb-1">{step.title}</h4>
                <p className="text-[#6B6B6B] text-xs md:text-sm font-cairo leading-relaxed">{step.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function HowItWorks() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.hw-header', { y: 40, opacity: 0 }, {
        y: 0, opacity: 1, duration: 0.5, ease: 'expo.out',
        scrollTrigger: { trigger: sectionRef.current, start: 'top 80%' },
      });
      gsap.fromTo('.hw-step', { y: 30, opacity: 0 }, {
        y: 0, opacity: 1, duration: 0.4, ease: 'expo.out', stagger: 0.15,
        scrollTrigger: { trigger: '.hw-columns', start: 'top 85%' },
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="bg-[#F3EDE4] py-16 md:py-24 lg:py-[100px]">
      <div className="max-w-container mx-auto container-pad">
        {/* Header */}
        <div className="hw-header text-center mb-10 md:mb-14">
          <h2 className="font-amiri font-bold text-[#1A1612] text-2xl md:text-4xl lg:text-5xl mb-4">
            كيف يعمل نوف-إكس؟
          </h2>
          <p className="text-[#6B6B6B] text-sm md:text-lg font-cairo max-w-lg mx-auto">
            خطوات بسيطة للبدء كتاجر أو كعميل
          </p>
        </div>

        {/* Dual Track */}
        <div className="hw-columns grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 max-w-4xl mx-auto">
          <StepColumn label="للتجار" steps={merchantSteps} accentColor="#D4A853" />
          <StepColumn label="للعملاء" steps={customerSteps} accentColor="#2563EB" />
        </div>
      </div>
    </section>
  );
}
