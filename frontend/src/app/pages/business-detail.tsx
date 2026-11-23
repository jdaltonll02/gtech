import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import { motion } from 'motion/react';
import { ArrowLeft, ExternalLink, Mail, MapPin, Calendar, Building2, TrendingUp, Target, Lightbulb, Images } from 'lucide-react';
import { GlassCard } from '../components/glass-card';
import { Button } from '../components/ui/button';
import { api } from '../utils/api';

type BusinessDetail = {
  id: string;
  name: string;
  description?: string | null;
  logo_url: string;
  website_url: string;
  tagline?: string | null;
  industry?: string | null;
  stage?: string | null;
  founded_year?: string | null;
  location?: string | null;
  pitch_summary?: string | null;
  problem_statement?: string | null;
  solution?: string | null;
  gallery_urls: string[];
  contact_email?: string | null;
  is_seeking_investment: boolean;
  investment_ask?: string | null;
};

const STAGE_COLORS: Record<string, string> = {
  Idea: 'bg-slate-100 text-slate-700 border-slate-200',
  'Pre-seed': 'bg-violet-50 text-violet-700 border-violet-200',
  Seed: 'bg-blue-50 text-blue-700 border-blue-200',
  Growth: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Established: 'bg-amber-50 text-amber-700 border-amber-200',
};

export function BusinessDetail() {
  const { id } = useParams<{ id: string }>();
  const [business, setBusiness] = useState<BusinessDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.get<BusinessDetail>(`/partners/businesses/${id}`)
      .then(setBusiness)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen pt-24 pb-20 px-4 flex items-center justify-center">
        <div className="animate-pulse space-y-4 w-full max-w-3xl">
          <div className="h-32 bg-black/5 rounded-2xl" />
          <div className="h-8 bg-black/5 rounded w-1/2" />
          <div className="h-4 bg-black/5 rounded w-3/4" />
        </div>
      </div>
    );
  }

  if (notFound || !business) {
    return (
      <div className="min-h-screen pt-24 pb-20 px-4 flex flex-col items-center justify-center text-center">
        <p className="text-6xl font-bold text-black/10 mb-4">404</p>
        <h1 className="text-2xl mb-3">Business not found</h1>
        <Link to="/" className="text-primary hover:underline text-sm">← Back to Home</Link>
      </div>
    );
  }

  const stageColor = business.stage ? (STAGE_COLORS[business.stage] || 'bg-primary/10 text-primary border-primary/20') : null;

  return (
    <div className="min-h-screen pt-20 pb-20">
      {/* Hero */}
      <div className="bg-gradient-to-br from-primary/5 via-white to-white border-b border-black/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-black/50 hover:text-primary transition-colors mb-8">
            <ArrowLeft className="w-4 h-4" /> Home
          </Link>

          <div className="flex flex-col sm:flex-row gap-8 items-start">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
              <div className="w-28 h-28 rounded-2xl bg-white border border-black/10 shadow-xl flex items-center justify-center overflow-hidden flex-shrink-0 p-3">
                <img src={business.logo_url} alt={business.name} className="max-w-full max-h-full object-contain" />
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {business.industry && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium bg-black/5 border border-black/10 rounded-full">
                    <Building2 className="w-3 h-3" />{business.industry}
                  </span>
                )}
                {stageColor && (
                  <span className={`px-3 py-1 text-xs font-medium border rounded-full ${stageColor}`}>{business.stage}</span>
                )}
                {business.is_seeking_investment && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200 rounded-full">
                    <TrendingUp className="w-3 h-3" />Seeking Investment
                  </span>
                )}
              </div>
              <h1 className="text-4xl font-bold mb-2">{business.name}</h1>
              {business.tagline && <p className="text-primary font-semibold text-lg mb-3">{business.tagline}</p>}
              <div className="flex flex-wrap gap-4 text-sm text-black/50 mb-5">
                {business.location && (
                  <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{business.location}</span>
                )}
                {business.founded_year && (
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />Founded {business.founded_year}</span>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                <a href={business.website_url} target="_blank" rel="noopener noreferrer">
                  <Button>
                    Visit Website<ExternalLink className="ml-2 w-4 h-4" />
                  </Button>
                </a>
                {business.contact_email && (
                  <a href={`mailto:${business.contact_email}`}>
                    <Button variant="outline">
                      <Mail className="mr-2 w-4 h-4" />Contact
                    </Button>
                  </a>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
        {business.pitch_summary && (
          <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <GlassCard className="p-8">
              <p className="text-lg text-black/80 leading-relaxed italic">"{business.pitch_summary}"</p>
            </GlassCard>
          </motion.section>
        )}

        {business.description && (
          <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}>
            <h2 className="text-2xl font-bold mb-4">About</h2>
            <p className="text-black/70 leading-relaxed">{business.description}</p>
          </motion.section>
        )}

        {(business.problem_statement || business.solution) && (
          <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="grid sm:grid-cols-2 gap-6">
            {business.problem_statement && (
              <GlassCard className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-lg">The Problem</h3>
                </div>
                <p className="text-black/65 text-sm leading-relaxed">{business.problem_statement}</p>
              </GlassCard>
            )}
            {business.solution && (
              <GlassCard className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-lg">The Solution</h3>
                </div>
                <p className="text-black/65 text-sm leading-relaxed">{business.solution}</p>
              </GlassCard>
            )}
          </motion.section>
        )}

        {business.gallery_urls.length > 0 && (
          <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}>
            <div className="flex items-center gap-2 mb-6">
              <Images className="w-5 h-5 text-primary" />
              <h2 className="text-2xl font-bold">Gallery</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {business.gallery_urls.map((url, i) => (
                <img key={i} src={url} alt={`${business.name} gallery ${i + 1}`} className="w-full h-40 object-cover rounded-xl border border-black/10" />
              ))}
            </div>
          </motion.section>
        )}

        {business.is_seeking_investment && business.investment_ask && (
          <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
            <GlassCard className="p-8 border-rose-200 bg-rose-50/30">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-5 h-5 text-rose-600" />
                <h3 className="font-semibold text-lg">Investment Ask</h3>
              </div>
              <p className="text-black/70 text-sm leading-relaxed">{business.investment_ask}</p>
            </GlassCard>
          </motion.section>
        )}
      </div>
    </div>
  );
}
