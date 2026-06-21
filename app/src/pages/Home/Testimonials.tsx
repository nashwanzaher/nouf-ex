import { useEffect, useRef, useCallback } from 'react';
import { Star, ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react';
import useEmblaCarousel from 'embla-carousel-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const testimonials = [
  {
    name: 'أحمد الصنعاني',
    role: 'تاجر إلكترونيات',
    avatar: '/testimonial-avatar-1.jpg',
    rating: 5,
    quote: 'نوّفت مبيعاتي ٣ أضعاف خلال شهرين. نوف-إكس غيّر طريقة بيعي بالكامل.',
  },
  {
    name: 'فاطمة الحضرمية',
    role: 'عميلة',
    avatar: '/testimonial-avatar-2.jpg',
    rating: 5,
    quote: 'أخيراً منصة أثق فيها! أشتري كل احتياجاتي من البيت بدون قلق.',
  },
  {
    name: 'عبدالله المكي',
    role: 'صاحب متجر أزياء',
    avatar: '/testimonial-avatar-3.jpg',
    rating: 5,
    quote: 'نظام الحماية يعطي العميل ثقة، وهذا ينعكس على مبيعاتي بشكل واضح.',
  },
  {
    name: 'أحمد الصنعاني',
    role: 'تاجر إلكترونيات',
    avatar: '/testimonial-avatar-1.jpg',
    rating: 5,
    quote: 'الدعم الفني رائع والمنصة سهلة الاستخدام. أنصح كل تاجر بالتسجيل.',
  },
  {
    name: 'فاطمة الحضرمية',
    role: 'عميلة',
    avatar: '/testimonial-avatar-2.jpg',
    rating: 5,
    quote: 'سرعة التوصيل ممتازة والمنتجات دائماً تطابق الوصف. تجربة رائعة!',
  },
  {
    name: 'عبدالله المكي',
    role: 'صاحب متجر أزياء',
    avatar: '/testimonial-avatar-3.jpg',
    rating: 5,
    quote: 'منصة نوف-إكس فتحت لي أسواق جديدة لم أكن أتخيل الوصول إليها.',
  },
];

export default function Testimonials() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    direction: 'rtl',
    containScroll: 'trimSnaps',
    slidesToScroll: 1,
  });

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.tm-header', { y: 40, opacity: 0 }, {
        y: 0, opacity: 1, duration: 0.5, ease: 'expo.out',
        scrollTrigger: { trigger: sectionRef.current, start: 'top 80%' },
      });
      gsap.fromTo('.tm-card', { y: 30, opacity: 0 }, {
        y: 0, opacity: 1, duration: 0.4, ease: 'expo.out', stagger: 0.1,
        scrollTrigger: { trigger: '.tm-carousel', start: 'top 85%' },
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="bg-white py-16 md:py-24 lg:py-[100px]">
      <div className="max-w-container mx-auto container-pad">
        {/* Header */}
        <div className="tm-header flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
          <div>
            <span className="text-[#D4A853] text-xs md:text-sm font-cairo font-semibold tracking-wider mb-3 block">
              قصص نجاح
            </span>
            <h2 className="font-amiri font-bold text-[#1A1612] text-2xl md:text-4xl lg:text-5xl">
              ماذا يقول تجارنا وعملاؤنا؟
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={scrollNext}
              className="w-10 h-10 rounded-full border-2 border-[#D4A853] flex items-center justify-center text-[#D4A853] hover:bg-[#D4A853] hover:text-[#1A1612] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
            </button>
            <button
              onClick={scrollPrev}
              className="w-10 h-10 rounded-full border-2 border-[#D4A853] flex items-center justify-center text-[#D4A853] hover:bg-[#D4A853] hover:text-[#1A1612] transition-colors"
            >
              <ArrowRight className="w-5 h-5" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Carousel */}
        <div className="tm-carousel relative">
          <div ref={emblaRef} className="overflow-hidden">
            <div className="flex gap-5">
              {testimonials.map((t, i) => (
                <div key={i} className="tm-card flex-shrink-0 w-[320px] md:w-[380px]">
                  <div className="bg-[#F8F8F8] rounded-3xl p-6 md:p-8 h-full">
                    {/* Stars */}
                    <div className="flex items-center gap-1 mb-4">
                      {Array.from({ length: t.rating }).map((_, j) => (
                        <Star key={j} className="w-4 h-4 fill-[#D4A853] text-[#D4A853]" />
                      ))}
                    </div>

                    {/* Quote */}
                    <p className="text-[#1A1612] text-sm md:text-base font-cairo leading-relaxed mb-6 italic min-h-[4em]">
                      "{t.quote}"
                    </p>

                    {/* Divider */}
                    <div className="h-px bg-[#E0E0E0] mb-4" />

                    {/* Author */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img src={t.avatar} alt={t.name} className="w-12 h-12 rounded-full object-cover" />
                        <div>
                          <h4 className="font-cairo font-bold text-sm text-[#111111]">{t.name}</h4>
                          <p className="text-xs text-[#6B6B6B] font-cairo">{t.role}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-[#10B981]">
                        <CheckCircle className="w-3.5 h-3.5" strokeWidth={2} />
                        <span className="text-[10px] font-cairo font-semibold">تجربة موثقة</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
