import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

gsap.registerPlugin(ScrollTrigger);

const tiers = [
  {
    name: 'Free',
    monthlyPrice: '$0',
    yearlyPrice: '$0',
    featured: false,
    color: '#AAAAAA',
    features: [
      { text: '٢٠ منتج', included: true },
      { text: 'متجر أساسي', included: true },
      { text: 'دعم عبر البريد', included: true },
      { text: 'إحصائيات أساسية', included: true },
      { text: 'ترويج مميز', included: false },
      { text: 'API للتكامل', included: false },
    ],
    cta: 'ابدأ مجاناً',
    ctaVariant: 'outline' as const,
  },
  {
    name: 'Starter',
    monthlyPrice: '$9.99',
    yearlyPrice: '$7.99',
    featured: false,
    color: '#D4A853',
    features: [
      { text: '١٠٠ منتج', included: true },
      { text: 'متجر مخصص', included: true },
      { text: 'دعم مباشر', included: true },
      { text: 'إحصائيات متقدمة', included: true },
      { text: 'ترويج مميز', included: false },
      { text: 'API للتكامل', included: false },
    ],
    cta: 'اشترك الآن',
    ctaVariant: 'outline' as const,
  },
  {
    name: 'Pro',
    monthlyPrice: '$29.99',
    yearlyPrice: '$23.99',
    featured: true,
    color: '#D4A853',
    features: [
      { text: 'منتجات غير محدودة', included: true },
      { text: 'ترويج مميز', included: true },
      { text: 'تخصيص كامل', included: true },
      { text: 'API للتكامل', included: true },
      { text: 'مدير حساب', included: true },
      { text: 'خدمات لوجستية', included: false },
    ],
    cta: 'اشترك الآن',
    ctaVariant: 'primary' as const,
  },
  {
    name: 'Enterprise',
    monthlyPrice: 'Custom',
    yearlyPrice: 'Custom',
    featured: false,
    color: '#2563EB',
    features: [
      { text: 'كل مميزات Pro', included: true },
      { text: 'API كامل', included: true },
      { text: 'مدير حساب مخصص', included: true },
      { text: 'خدمات لوجستية', included: true },
      { text: 'تكامل مخصص', included: true },
      { text: 'دعم ٢٤/٧', included: true },
    ],
    cta: 'تواصل معنا',
    ctaVariant: 'outline' as const,
  },
];

export default function SubscriptionTiers() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [yearly, setYearly] = useState(true);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.st-header', { y: 40, opacity: 0 }, {
        y: 0, opacity: 1, duration: 0.5, ease: 'expo.out',
        scrollTrigger: { trigger: sectionRef.current, start: 'top 80%' },
      });
      gsap.fromTo('.st-card', { y: 40, opacity: 0 }, {
        y: 0, opacity: 1, duration: 0.5, ease: 'expo.out', stagger: 0.15,
        scrollTrigger: { trigger: '.st-grid', start: 'top 85%' },
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="bg-[#1A1612] py-16 md:py-24 lg:py-[100px] relative overflow-hidden">
      {/* Noise texture */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '256px',
        }}
      />

      <div className="max-w-container mx-auto container-pad relative z-10">
        {/* Header */}
        <div className="st-header text-center mb-10 md:mb-14">
          <span className="text-[#D4A853] text-xs md:text-sm font-cairo font-semibold tracking-wider mb-3 block">
            خطط الاشتراك
          </span>
          <h2 className="font-amiri font-bold text-white text-2xl md:text-4xl lg:text-5xl mb-4 shimmer-text">
            اختر خطتك وابدأ البيع
          </h2>
          <p className="text-[#AAAAAA] text-sm md:text-lg font-cairo max-w-lg mx-auto mb-6">
            باقات تناسب كل التجار — من المبتدئين إلى المحترفين
          </p>

          {/* Toggle */}
          <div className="flex items-center justify-center gap-3">
            <span className={`text-sm font-cairo font-semibold ${!yearly ? 'text-white' : 'text-[#AAAAAA]'}`}>
              شهري
            </span>
            <Switch checked={yearly} onCheckedChange={setYearly} className="data-[state=checked]:bg-[#D4A853]" />
            <span className={`text-sm font-cairo font-semibold ${yearly ? 'text-white' : 'text-[#AAAAAA]'}`}>
              سنوي
            </span>
            {yearly && (
              <Badge className="bg-[#10B981] text-white text-[10px] font-cairo mr-2">
                وفر ٢٠٪
              </Badge>
            )}
          </div>
        </div>

        {/* Cards */}
        <div className="st-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`st-card relative rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1 ${
                tier.featured
                  ? 'bg-white shadow-gold border-2 border-[#D4A853] scale-[1.02]'
                  : 'bg-white/[0.04] border border-white/[0.1] hover:border-white/[0.3]'
              }`}
            >
              {tier.featured && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#D4A853] text-[#1A1612] text-xs font-cairo font-bold px-4 py-1">
                  الأكثر شيوعاً
                </Badge>
              )}

              <h3 className={`font-cairo font-bold text-lg mb-2 ${tier.featured ? 'text-[#1A1612]' : 'text-white'}`}>
                {tier.name}
              </h3>

              <div className="mb-5">
                <span className={`font-mono font-bold text-2xl ${tier.featured ? 'text-[#D4A853]' : 'text-[#D4A853]'}`}>
                  {yearly ? tier.yearlyPrice : tier.monthlyPrice}
                </span>
                {tier.monthlyPrice !== 'Custom' && (
                  <span className={`text-xs font-cairo mr-1 ${tier.featured ? 'text-[#6B6B6B]' : 'text-[#AAAAAA]'}`}>
                    /{yearly ? 'شهرياً (سنوي)' : 'شهري'}
                  </span>
                )}
              </div>

              <ul className="space-y-3 mb-6">
                {tier.features.map((feature) => (
                  <li key={feature.text} className="flex items-center gap-2">
                    {feature.included ? (
                      <Check className="w-4 h-4 text-[#10B981] shrink-0" strokeWidth={2} />
                    ) : (
                      <X className="w-4 h-4 text-[#AAAAAA] shrink-0" strokeWidth={2} />
                    )}
                    <span className={`text-xs md:text-sm font-cairo ${
                      feature.included
                        ? tier.featured ? 'text-[#111111]' : 'text-[#ddd]'
                        : 'text-[#666]'
                    }`}>
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>

              <Button
                variant={tier.featured ? 'default' : 'outline'}
                className={`w-full font-cairo font-semibold rounded-xl h-11 ${
                  tier.featured
                    ? 'bg-[#D4A853] text-[#1A1612] hover:bg-[#c49a48]'
                    : tier.name === 'Enterprise'
                    ? 'border-[#2563EB] text-[#2563EB] hover:bg-[#2563EB] hover:text-white'
                    : tier.featured === false && tier.name !== 'Enterprise'
                    ? 'border-[#D4A853] text-[#D4A853] hover:bg-[#D4A853] hover:text-[#1A1612]'
                    : 'border-white/30 text-white hover:bg-white/10'
                }`}
              >
                {tier.cta}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
