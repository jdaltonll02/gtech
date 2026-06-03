import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { ArrowRight, Building2, Cpu, ShieldCheck } from 'lucide-react';
import { Button } from '../components/ui/button';
import { GlassCard } from '../components/glass-card';
import { AnimatedBackground } from '../components/animated-background';
import { api } from '../utils/api';

type PartnerItem = { id: string; name: string; logo_url: string; website_url: string };
type BusinessItem = { id: string; name: string; logo_url: string; website_url: string };

function LogoCarousel({ items, label }: { items: { id: string; name: string; logo_url: string; website_url: string }[]; label: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  // Duplicate items for infinite scroll effect
  const doubled = [...items, ...items];

  return (
    <section className="py-14 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <p className="text-sm uppercase tracking-[0.22em] text-primary mb-6 text-center">{label}</p>
        <div className="relative">
          <div
            ref={trackRef}
            className="flex gap-10 items-center"
            style={{ animation: `scroll-logos ${items.length * 3}s linear infinite` }}
          >
            {doubled.map((item, idx) => (
              <a
                key={`${item.id}-${idx}`}
                href={item.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 flex items-center justify-center h-16 w-36 grayscale hover:grayscale-0 transition-all duration-300 opacity-70 hover:opacity-100"
                title={item.name}
              >
                {item.logo_url ? (
                  <img src={item.logo_url} alt={item.name} className="h-full w-full object-contain" />
                ) : (
                  <div className="h-12 w-32 flex items-center justify-center rounded-lg border border-black/15 bg-black/5 text-sm text-black/50 font-medium px-3 text-center leading-tight">
                    {item.name}
                  </div>
                )}
              </a>
            ))}
          </div>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-white to-transparent" />
        </div>
      </div>
    </section>
  );
}

const bannerSlides = [
  {
    image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1600&q=80',
    eyebrow: 'Digital Operations',
    title: 'Building systems that help ambitious organizations move faster.',
    copy: 'From public-facing websites to commerce, training, and internal workflows, Gibson Technologies turns scattered tools into one reliable operating layer.',
  },
  {
    image: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=80',
    eyebrow: 'Modern Infrastructure',
    title: 'Technology that feels clear, structured, and ready for growth.',
    copy: 'We design digital experiences for institutions that need more than a brochure site: they need platforms, automation, and trust at scale.',
  },
  {
    image: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1600&q=80',
    eyebrow: 'Human-Centered Delivery',
    title: 'Serious platforms, designed for the people who use them every day.',
    copy: 'Operations teams, learners, customers, and administrators all need different things. Gibson Technologies brings them into one coherent experience.',
  },
];

const focusAreas = [
  {
    icon: Building2,
    title: 'Organization Platforms',
    description: 'Unified web presence, admin systems, and service delivery tools for growing institutions.',
  },
  {
    icon: Cpu,
    title: 'Digital Products',
    description: 'E-commerce, learning, and operational features that turn a simple website into a working platform.',
  },
  {
    icon: ShieldCheck,
    title: 'Reliable Execution',
    description: 'Structured architecture, maintainable code, and production-minded implementation from the start.',
  },
];

export function Landing() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [partners, setPartners] = useState<PartnerItem[]>([]);
  const [businesses, setBusinesses] = useState<BusinessItem[]>([]);

  useEffect(() => {
    api.get<PartnerItem[]>('/partners').then(setPartners).catch(() => {});
    api.get<BusinessItem[]>('/partners/businesses').then(setBusinesses).catch(() => {});
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % bannerSlides.length);
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div className="min-h-screen">
      <AnimatedBackground />

      <section className="relative overflow-hidden px-4 sm:px-6 lg:px-8 pt-28 pb-16 bg-primary">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-[1.05fr_0.95fr] gap-10 items-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <p className="text-sm uppercase tracking-[0.28em] text-white/60 mb-4">G-Tech</p>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl mb-6 text-white max-w-4xl leading-tight">
              Innovation and Research in Tech and STEM Education
            </h1>
            <p className="text-xl sm:text-2xl text-white/80 mb-5 max-w-2xl">
              Transforming lives and impacting the community through technology, entrepreneurship, and STEM education. 
            </p>
            <p className="text-lg text-white/60 max-w-2xl mb-8">
              G-Tech is a consolidation of tech institutions and businesses that focues on technological advancements, e-commerce, research, and STEM Education. We are happy to partner with other tech institutions for business or humanitarian purposes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/portfolio"><Button size="lg" className="group bg-white text-primary hover:bg-white/90">Explore our Work<ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" /></Button></Link>
              <Link to="/store"><Button size="lg" variant="outline" className="border-white text-black hover:bg-white/10 hover:text-black">Browse Solutions</Button></Link>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.15 }}>
            <div className="relative rounded-[2rem] overflow-hidden border border-white/15 shadow-2xl min-h-[520px] bg-black/20">
              {bannerSlides.map((slide, index) => (
                <motion.div
                  key={slide.title}
                  className="absolute inset-0 transition-opacity duration-700"
                  initial={false}
                  animate={{ opacity: index === activeSlide ? 1 : 0 }}
                  transition={{ duration: 0.7 }}
                >
                  <img src={slide.image} alt={slide.title} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
                </motion.div>
              ))}

              <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8 text-white">
                <p className="text-xs uppercase tracking-[0.22em] text-white/60 mb-3">{bannerSlides[activeSlide].eyebrow}</p>
                <h2 className="text-2xl sm:text-3xl mb-3 max-w-xl leading-tight">{bannerSlides[activeSlide].title}</h2>
                <p className="text-sm sm:text-base text-white/75 max-w-xl">{bannerSlides[activeSlide].copy}</p>
                <div className="flex gap-2 mt-6">
                  {bannerSlides.map((slide, index) => (
                    <button
                      key={slide.eyebrow}
                      type="button"
                      aria-label={`Show banner ${index + 1}`}
                      onClick={() => setActiveSlide(index)}
                      className={`h-2.5 rounded-full transition-all ${index === activeSlide ? 'w-10 bg-white' : 'w-2.5 bg-white/40'}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="px-4 sm:px-6 lg:px-8 py-10 -mt-4 relative z-10">
        <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-6">
          {focusAreas.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <GlassCard className="p-6 h-full">
                  <Icon className="w-8 h-8 text-primary mb-4" />
                  <h3 className="text-2xl mb-3">{item.title}</h3>
                  <p className="text-black/65 leading-relaxed">{item.description}</p>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-[0.9fr_1.1fr] gap-8 items-stretch">
          <GlassCard className="p-8 sm:p-10">
            <p className="text-sm uppercase tracking-[0.22em] text-primary mb-4">Why G-Tecg</p>
            <h2 className="text-4xl mb-5 leading-tight">We run businesses that produce jobs, design products, provide tech solutions for other businesses, and partner with institutions in tech and entrepreneurship.</h2>
            <p className="text-black/70 mb-4 leading-relaxed">
              G-Tech is built around a practical idea and innovation: our goal is to promote technology, promote education, and improve lives through technology, research, entrepreneurship, and STEM education. 
            </p>
            <p className="text-black/65 leading-relaxed">
              This platform demonstrates that shift clearly, combining public storytelling with advanced back-office functionality in one cohesive system.
            </p>
          </GlassCard>

          <div className="grid sm:grid-cols-3 gap-4">
            {bannerSlides.map((slide, index) => (
              <motion.div key={slide.image} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: index * 0.08 }}>
                <div className="relative overflow-hidden rounded-[1.75rem] min-h-[320px] border border-black/10 shadow-lg">
                  <img src={slide.image} alt={slide.eyebrow} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/60 mb-2">Banner {index + 1}</p>
                    <p className="text-lg leading-snug">{slide.eyebrow}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {partners.length > 0 && (
        <LogoCarousel items={partners} label="Our Partners" />
      )}

      {businesses.length > 0 && (
        <LogoCarousel items={businesses} label="Businesses & NGOs" />
      )}

      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <GlassCard className="p-12">
            <h2 className="text-4xl mb-6">Let Gibson Technologies support the next stage of your organization.</h2>
            <p className="text-lg text-black/70 mb-8 max-w-2xl mx-auto">Whether you need a stronger public presence, a product-ready storefront, or an internal platform that reduces friction, this system is built to scale with you.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/store"><Button size="lg">Explore Services</Button></Link>
              <Link to="/portfolio"><Button size="lg" variant="outline">Meet the Builder</Button></Link>
            </div>
          </GlassCard>
        </div>
      </section>
    </div>
  );
}
