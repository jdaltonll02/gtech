import { useEffect, useState, type KeyboardEvent } from 'react';
import { motion, MotionConfig, useReducedMotion } from 'motion/react';
import { Link } from 'react-router';
import { ArrowRight, Rocket, GraduationCap, Handshake, Quote, FolderKanban, Pause, Play, BookOpen } from 'lucide-react';
import { Button } from '../components/ui/button';
import { GlassCard } from '../components/glass-card';
import { AnimatedBackground } from '../components/animated-background';
import { StarRating } from '../components/star-rating';
import { ProjectCard, type OrganizationalProject } from './projects';
import type { Course } from '../store/courseStore';
import { api } from '../utils/api';

type PartnerItem = { id: string; name: string; logo_url: string; website_url: string };
type BusinessItem = { id: string; name: string; logo_url: string; website_url: string };
type TestimonialItem = { id: string; author_name: string; author_title: string | null; content: string; rating: number };

// Keeps "G-Tech" from splitting across lines at the hyphen.
const Brand = () => <span className="whitespace-nowrap">G-Tech</span>;

const eyebrow = 'text-sm font-semibold uppercase tracking-[0.18em] text-primary';

function LogoCarousel({ items, label }: { items: { id: string; name: string; logo_url: string; website_url: string }[]; label: string }) {
  // Duplicate items for the infinite scroll effect; hovering pauses it.
  const doubled = [...items, ...items];

  return (
    <section className="py-14 px-4 sm:px-6 lg:px-8 overflow-hidden" aria-label={label}>
      <div className="max-w-7xl mx-auto">
        <p className={`${eyebrow} mb-6 text-center`}>{label}</p>
        <div className="relative group">
          <div
            className="flex gap-10 items-center group-hover:[animation-play-state:paused]"
            style={{ animation: `scroll-logos ${items.length * 3}s linear infinite` }}
          >
            {doubled.map((item, idx) => (
              <a
                key={`${item.id}-${idx}`}
                href={item.website_url}
                target="_blank"
                rel="noopener noreferrer"
                aria-hidden={idx >= items.length ? true : undefined}
                tabIndex={idx >= items.length ? -1 : undefined}
                className="flex-shrink-0 flex items-center justify-center h-16 w-36 grayscale hover:grayscale-0 transition-all duration-300 opacity-70 hover:opacity-100"
                title={item.name}
              >
                {item.logo_url ? (
                  <img src={item.logo_url} alt={item.name} className="h-full w-full object-contain" />
                ) : (
                  <div className="h-12 w-32 flex items-center justify-center rounded-lg border border-surface-border bg-surface text-sm text-text-secondary font-medium px-3 text-center leading-tight">
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
    image: '/img/stem_education.png',
    eyebrow: 'STEM Education',
    title: 'Structured learning pathways for the next generation of innovators.',
  },
  {
    image: '/img/research_and_innovation.png',
    eyebrow: 'Research & Innovation',
    title: 'Applied research that bridges science, engineering, and market impact.',
  },
  {
    image: '/img/tech_entrepreneurship.png',
    eyebrow: 'Tech Entrepreneurship',
    title: 'Turning ideas into scalable ventures through technology.',
  },
];

const focusAreas = [
  {
    icon: Rocket,
    title: 'Tech Entrepreneurship',
    description: 'We incubate ideas, build products, and partner with entrepreneurs to create tech-driven businesses with measurable real-world impact.',
    link: { to: '/projects', label: 'See our ventures' },
  },
  {
    icon: GraduationCap,
    title: 'STEM Education & Research',
    description: 'Rigorous courses, research collaborations, and learning tools designed to develop technically capable, innovation-ready talent.',
    link: { to: '/courses', label: 'Browse courses' },
  },
  {
    icon: Handshake,
    title: 'Innovation & Partnerships',
    description: 'We partner with tech companies, academic institutions, and NGOs to co-develop solutions, share resources, and advance shared missions.',
    link: { to: '/contact', label: 'Partner with us' },
  },
];

function HeroCarousel() {
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const playing = !paused && !interacting && !reduceMotion;
  const count = bannerSlides.length;

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setActive((c) => (c + 1) % count), 6000);
    return () => window.clearInterval(id);
  }, [playing, count]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); setActive((c) => (c + 1) % count); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); setActive((c) => (c - 1 + count) % count); }
  };

  const slide = bannerSlides[active];

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="G-Tech focus areas"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setInteracting(true)}
      onMouseLeave={() => setInteracting(false)}
      onFocus={() => setInteracting(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setInteracting(false); }}
      className="relative rounded-3xl overflow-hidden border border-white/15 shadow-2xl aspect-[4/5] sm:aspect-[5/4] lg:aspect-auto lg:min-h-[500px] bg-black/20"
    >
      {bannerSlides.map((s, index) => (
        <motion.div
          key={s.title}
          className="absolute inset-0"
          initial={false}
          animate={{ opacity: index === active ? 1 : 0 }}
          transition={{ duration: 0.7 }}
          aria-hidden={index !== active}
        >
          <img src={s.image} alt="" className="h-full w-full object-cover" />
        </motion.div>
      ))}
      {/* Strong bottom scrim so the caption stays legible over any photo */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 via-45% to-transparent" />

      <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8 text-white" aria-live={playing ? 'off' : 'polite'}>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold mb-3">{slide.eyebrow}</p>
        <h2 className="text-2xl sm:text-3xl max-w-xl leading-tight text-white">{slide.title}</h2>
        <div className="flex items-center gap-1 mt-5 -ml-3">
          {bannerSlides.map((s, index) => (
            <button
              key={s.eyebrow}
              type="button"
              aria-label={`Show slide ${index + 1}: ${s.eyebrow}`}
              aria-current={index === active}
              onClick={() => setActive(index)}
              className="h-11 min-w-11 px-3 flex items-center justify-center rounded-lg"
            >
              <span className={`block h-2.5 rounded-full transition-all ${index === active ? 'w-10 bg-white' : 'w-2.5 bg-white/50'}`} />
            </button>
          ))}
          {!reduceMotion && (
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? 'Play slideshow' : 'Pause slideshow'}
              className="ml-auto h-11 w-11 flex items-center justify-center rounded-lg text-white/85 hover:text-white hover:bg-white/10"
            >
              {paused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function FeaturedCourses({ courses }: { courses: Course[] }) {
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
          <div>
            <p className={`${eyebrow} mb-3`}>Learn with <Brand /></p>
            <h2 className="text-3xl sm:text-4xl leading-tight">Featured courses</h2>
          </div>
          <Link to="/courses" className="inline-flex items-center gap-1 font-medium text-primary hover:text-primary-hover min-h-11">
            View all courses <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <Link key={course.id} to={`/courses/${course.id}`} className="group block rounded-2xl">
              <GlassCard hover className="h-full overflow-hidden flex flex-col">
                <div className="aspect-video bg-brand-tint-100 overflow-hidden">
                  {course.thumbnail_url ? (
                    <img src={course.thumbnail_url} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center"><BookOpen className="w-10 h-10 text-primary/40" aria-hidden /></div>
                  )}
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <p className="text-sm font-medium capitalize text-text-secondary mb-2">{String(course.level ?? '').replace(/_/g, ' ')}</p>
                  <h3 className="text-xl leading-snug mb-2 group-hover:text-primary transition-colors">{course.title}</h3>
                  {course.short_description && <p className="text-base text-text-secondary leading-relaxed line-clamp-3 mb-4">{course.short_description}</p>}
                  <p className="mt-auto font-semibold text-primary">{course.is_free || !Number(course.price) ? 'Free' : `$${Number(course.price).toFixed(2)}`}</p>
                </div>
              </GlassCard>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Landing() {
  const [partners, setPartners] = useState<PartnerItem[]>([]);
  const [businesses, setBusinesses] = useState<BusinessItem[]>([]);
  const [testimonials, setTestimonials] = useState<TestimonialItem[]>([]);
  const [projects, setProjects] = useState<OrganizationalProject[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    api.get<PartnerItem[]>('/partners').then(setPartners).catch(() => {});
    api.get<BusinessItem[]>('/partners/businesses').then(setBusinesses).catch(() => {});
    api.get<TestimonialItem[]>('/portfolio/testimonials').then(setTestimonials).catch(() => {});
    api.get<OrganizationalProject[]>('/team/projects/organizational').then(setProjects).catch(() => {});
    api.get<Course[]>('/courses/?limit=3').then((c) => setCourses(c.slice(0, 3))).catch(() => {});
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen">
        <AnimatedBackground />

        {/* Hero */}
        <section className="relative overflow-hidden px-4 sm:px-6 lg:px-8 pt-28 pb-28 lg:pb-32 bg-gradient-to-br from-brand-900 to-brand-700">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-14 items-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold mb-5">STEM · Research · Ventures</p>
              <h1 className="text-[clamp(2.5rem,5vw,4rem)] leading-[1.05] font-bold text-white mb-6 max-w-[16ch]">
                Where STEM education, research, and ventures grow together
              </h1>
              <p className="text-lg sm:text-xl text-white/90 leading-relaxed max-w-xl mb-9">
                Advancing STEM education, applied research, and tech entrepreneurship on a global scale.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button asChild size="lg" className="group bg-white text-primary hover:bg-brand-tint-50 shadow-lg shadow-black/20">
                  <Link to="/courses">
                    Explore Courses
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" aria-hidden />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="bg-transparent border-white/70 text-white hover:bg-white/10 hover:text-white hover:border-white">
                  <Link to="/store">Browse Solutions</Link>
                </Button>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.15 }}>
              <HeroCarousel />
            </motion.div>
          </div>
        </section>

        {/* Pillars: overlap the hero's bottom edge by 48px */}
        <section className="px-4 sm:px-6 lg:px-8 -mt-12 relative z-10" aria-label="What we do">
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
                  <GlassCard className="p-7 h-full flex flex-col">
                    <div className="w-12 h-12 rounded-xl bg-brand-tint-100 flex items-center justify-center mb-5">
                      <Icon className="w-6 h-6 text-primary" aria-hidden />
                    </div>
                    <h3 className="text-xl mb-3">{item.title}</h3>
                    <p className="text-base text-text-secondary leading-relaxed mb-5">{item.description}</p>
                    <Link to={item.link.to} className="mt-auto inline-flex items-center gap-1 font-medium text-primary hover:text-primary-hover min-h-11 group">
                      {item.link.label}
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" aria-hidden />
                    </Link>
                  </GlassCard>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* Why G-Tech */}
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-8 items-stretch">
            <GlassCard className="p-8 sm:p-10 flex flex-col justify-center">
              <p className={`${eyebrow} mb-4`}>Why <Brand /></p>
              <h2 className="text-3xl sm:text-4xl mb-5 leading-tight">One mission across education, research, and enterprise.</h2>
              <p className="text-lg text-text-secondary mb-4 leading-relaxed">
                <Brand /> was built on a singular conviction: that technology, when paired with rigorous education and entrepreneurial intent, is the most reliable engine for sustainable development. We don't separate research from business, or education from industry — they are the same mission.
              </p>
              <p className="text-lg text-text-secondary leading-relaxed">
                Our ecosystem spans learning programs, product ventures, consulting engagements, and research partnerships, all built on shared infrastructure for global reach and local impact.
              </p>
            </GlassCard>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="relative overflow-hidden rounded-3xl min-h-[360px] lg:min-h-0 border border-black/[0.07] shadow-lg"
            >
              <img src="/img/research_and_innovation.png" alt="Researchers collaborating on applied technology" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-7 text-white">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold mb-2">Research & Innovation</p>
                <p className="text-xl leading-snug max-w-md">Translating discovery into deployable solutions.</p>
              </div>
            </motion.div>
          </div>
        </section>

        {courses.length > 0 && <FeaturedCourses courses={courses} />}

        {partners.length > 0 && <LogoCarousel items={partners} label="Our Partners" />}

        {businesses.length > 0 && <LogoCarousel items={businesses} label="Businesses & NGOs" />}

        {projects.length > 0 && (
          <section className="py-16 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center justify-center gap-3 mb-3">
                <FolderKanban className="w-5 h-5 text-primary" aria-hidden />
                <p className={eyebrow}>Organization</p>
              </div>
              <h2 className="text-3xl sm:text-4xl mb-10 text-center">Our Projects</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
                {projects.slice(0, 6).map((project, index) => (
                  <ProjectCard key={project.id} project={project} index={index} />
                ))}
              </div>
              <div className="text-center">
                <Button asChild size="lg" variant="outline" className="group">
                  <Link to="/projects">
                    View All Projects
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" aria-hidden />
                  </Link>
                </Button>
              </div>
            </div>
          </section>
        )}

        {testimonials.length > 0 && (
          <section className="py-16 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
              <p className={`${eyebrow} mb-3 text-center`}>Testimonials</p>
              <h2 className="text-3xl sm:text-4xl mb-10 text-center">What our community says</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {testimonials.map((t, index) => (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: index * 0.08 }}
                  >
                    <GlassCard className="p-6 h-full flex flex-col">
                      <Quote className="w-6 h-6 text-gold mb-3 flex-shrink-0" aria-hidden />
                      <p className="text-base text-text-secondary leading-relaxed flex-1 mb-4">"{t.content}"</p>
                      <div className="flex items-center justify-between mt-auto pt-4 border-t border-surface-border">
                        <div>
                          <p className="font-semibold text-sm">{t.author_name}</p>
                          {t.author_title && <p className="text-sm text-text-secondary mt-0.5">{t.author_title}</p>}
                        </div>
                        <StarRating value={t.rating} readOnly size="sm" />
                      </div>
                    </GlassCard>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Closing CTA */}
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <div className="rounded-3xl bg-brand-tint-50 border border-brand-tint-100 p-10 sm:p-14">
              <h2 className="text-3xl sm:text-4xl mb-5 leading-tight">Ready to build, learn, or partner with <Brand />?</h2>
              <p className="text-lg text-text-secondary mb-8 max-w-2xl mx-auto leading-relaxed">
                Whether you're a student pursuing STEM mastery, an entrepreneur building a tech venture, a researcher seeking collaboration, or an institution looking to partner, <Brand /> has a place for you.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild size="lg"><Link to="/courses">Start Learning</Link></Button>
                <Button asChild size="lg" variant="outline" className="bg-white"><Link to="/contact">Get in Touch</Link></Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </MotionConfig>
  );
}
