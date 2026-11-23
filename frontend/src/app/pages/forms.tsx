import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { ClipboardList, ArrowRight, Users, Calendar } from 'lucide-react';
import { GlassCard } from '../components/glass-card';
import { api } from '../utils/api';

type FormItem = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string;
  requires_auth: boolean;
};

const CATEGORY_ICONS: Record<string, typeof ClipboardList> = {
  recruitment: Users,
  event: Calendar,
  general: ClipboardList,
};

const CATEGORY_LABELS: Record<string, string> = {
  recruitment: 'Recruitment',
  event: 'Events',
  general: 'General',
};

export function Forms() {
  const [forms, setForms] = useState<FormItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    const url = activeCategory ? `/forms?category=${encodeURIComponent(activeCategory)}` : '/forms';
    api.get<FormItem[]>(url)
      .then(setForms)
      .catch(() => setForms([]))
      .finally(() => setLoading(false));
  }, [activeCategory]);

  const categories = ['recruitment', 'event', 'general'];

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <p className="text-sm uppercase tracking-[0.22em] text-primary mb-3">G-Tech</p>
          <h1 className="text-5xl mb-4">Apply &amp; Register</h1>
          <p className="text-xl text-black/60 mb-10 max-w-2xl">
            Recruitment applications, event registrations, and more — all in one place.
          </p>

          <div className="flex flex-wrap gap-2 mb-10">
            <button
              onClick={() => setActiveCategory(null)}
              className={`px-4 py-1.5 rounded-full text-sm transition-colors ${!activeCategory ? 'bg-primary text-white' : 'bg-black/5 text-black/60 hover:bg-black/10'}`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
                className={`px-4 py-1.5 rounded-full text-sm transition-colors ${activeCategory === cat ? 'bg-primary text-white' : 'bg-black/5 text-black/60 hover:bg-black/10'}`}
              >
                {CATEGORY_LABELS[cat] ?? cat}
              </button>
            ))}
          </div>
        </motion.div>

        {loading && <p className="text-black/40 text-center py-20">Loading…</p>}

        {!loading && forms.length === 0 && (
          <div className="text-center py-24">
            <ClipboardList className="w-12 h-12 text-black/20 mx-auto mb-4" />
            <p className="text-xl text-black/40">No open forms right now. Check back soon.</p>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-6">
          {forms.map((form, i) => {
            const Icon = CATEGORY_ICONS[form.category] ?? ClipboardList;
            return (
              <motion.div
                key={form.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.07 }}
              >
                <Link to={`/forms/${form.slug}`} className="block group h-full">
                  <GlassCard className="p-6 h-full flex flex-col gap-4 hover:border-primary/30 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <span className="text-xs uppercase tracking-wider text-primary font-medium">
                          {CATEGORY_LABELS[form.category] ?? form.category}
                        </span>
                        <h3 className="text-lg font-medium mt-0.5 group-hover:text-primary transition-colors leading-snug">
                          {form.title}
                        </h3>
                      </div>
                    </div>
                    {form.description && (
                      <p className="text-black/60 text-sm leading-relaxed line-clamp-3">{form.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-black/8">
                      {form.requires_auth && (
                        <span className="text-xs text-black/40">Sign-in required</span>
                      )}
                      <span className="flex items-center gap-1 text-primary text-sm ml-auto group-hover:gap-2 transition-all">
                        Open form <ArrowRight className="w-4 h-4" />
                      </span>
                    </div>
                  </GlassCard>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
