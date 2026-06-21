import { useEffect, useRef } from 'react';
import { ShieldCheck, Star, MessageSquare, Award, ArrowLeft } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Button } from '@/components/ui/button';

gsap.registerPlugin(ScrollTrigger);

const trustFeatures = [
  { icon: ShieldCheck, title: 'نوف-بروتكت', desc: 'نظام ضمان الدفع — أموالك محمية', color: '#10B981' },
  { icon: Star, title: 'نوف-ريتينج', desc: 'تقييم متعدد الأبعاد — شفاف وعادل', color: '#D4A853' },
  { icon: MessageSquare, title: 'نوف-ريزولف', desc: 'مركز تسوية النزاعات — حلول سريعة', color: '#2563EB' },
  { icon: Award, title: 'نوف-تراست', desc: 'شارات الثقة — موثق، ذهبي، ماسي', color: '#D4A853' },
];

export default function NoufProtect() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.np-content', { x: 40, opacity: 0 }, {
        x: 0, opacity: 1, duration: 0.6, ease: 'expo.out',
        scrollTrigger: { trigger: sectionRef.current, start: 'top 75%' },
      });
      gsap.fromTo('.np-illustration', { x: -40, opacity: 0 }, {
        x: 0, opacity: 1, duration: 0.6, ease: 'expo.out', delay: 0.2,
        scrollTrigger: { trigger: sectionRef.current, start: 'top 75%' },
      });
      gsap.fromTo('.np-feature', { y: 20, opacity: 0 }, {
        y: 0, opacity: 1, duration: 0.4, ease: 'expo.out', stagger: 0.1,
        scrollTrigger: { trigger: '.np-features', start: 'top 85%' },
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="bg-white py-16 md:py-24 lg:py-[100px]">
      <div className="max-w-container mx-auto container-pad">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Content */}
          <div className="np-content">
            <span className="text-[#D4A853] text-xs md:text-sm font-cairo font-semibold tracking-wider mb-3 block">
              نوف-بروتكت
            </span>
            <h2 className="font-amiri font-bold text-[#1A1612] text-2xl md:text-4xl lg:text-5xl mb-4">
              تسوق وبيع بأمان تام
            </h2>
            <p className="text-[#6B6B6B] text-sm md:text-lg font-cairo leading-relaxed mb-8 max-w-lg">
              نظام حماية شامل يضمن حقوق الطرفين. أموالك محمية حتى تستلم طلبك، وتقييمات شفافة تكشف عن تجار موثوقين.
            </p>

            <div className="np-features space-y-5 mb-8">
              {trustFeatures.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div key={feature.title} className="np-feature flex items-start gap-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${feature.color}15` }}
                    >
                      <Icon className="w-5 h-5" style={{ color: feature.color }} strokeWidth={1.5} />
                    </div>
                    <div>
                      <h4 className="font-cairo font-bold text-[#111111] text-sm md:text-base mb-0.5">
                        {feature.title}
                      </h4>
                      <p className="text-[#6B6B6B] text-xs md:text-sm font-cairo">{feature.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <Button
              variant="outline"
              className="border-[#D4A853] text-[#D4A853] hover:bg-[#D4A853] hover:text-[#1A1612] font-cairo font-semibold rounded-xl h-12 px-6"
            >
              <ArrowLeft className="w-4 h-4 ml-2" strokeWidth={1.5} />
              اعرف أكثر عن الحماية
            </Button>
          </div>

          {/* Illustration */}
          <div className="np-illustration relative flex items-center justify-center">
            <img
              src="/nouf-protect-illustration.svg"
              alt="نوف-بروتكت"
              className="max-w-[300px] md:max-w-[400px] w-full"
            />
            {/* Floating badges */}
            <img
              src="/trust-badge-verified.svg"
              alt=""
              className="absolute w-10 h-10 animate-orbit"
              style={{ animationDuration: '20s', animationDelay: '0s' }}
            />
            <img
              src="/trust-badge-golden.svg"
              alt=""
              className="absolute w-8 h-8 animate-orbit"
              style={{ animationDuration: '25s', animationDelay: '-8s', width: '32px', height: '32px' }}
            />
            <img
              src="/trust-badge-diamond.svg"
              alt=""
              className="absolute w-9 h-9 animate-orbit"
              style={{ animationDuration: '22s', animationDelay: '-15s', width: '36px', height: '36px' }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
