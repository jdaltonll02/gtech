import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import { motion } from 'motion/react';
import { ArrowLeft, ExternalLink, Github, Target, Lightbulb, Images, Users, Megaphone, Code } from 'lucide-react';
import { GlassCard } from '../components/glass-card';
import { Button } from '../components/ui/button';
import { api } from '../utils/api';

type Collaborator = { name: string; role?: string | null; url?: string | null };

type ProjectDetail = {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  github_url?: string | null;
  live_url?: string | null;
  image_url?: string | null;
  featured: boolean;
  tagline?: string | null;
  status: string;
  pitch_summary?: string | null;
  problem_statement?: string | null;
  solution?: string | null;
  collaborators: Collaborator[];
  gallery_urls: string[];
  looking_for?: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  concept: 'Concept',
  in_progress: 'In Progress',
  mvp: 'MVP',
  launched: 'Launched',
  seeking_collaborators: 'Seeking Collaborators',
  completed: 'Completed',
  on_hold: 'On Hold',
};

const STATUS_COLORS: Record<string, string> = {
  concept: 'bg-slate-100 text-slate-700 border-slate-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  mvp: 'bg-violet-50 text-violet-700 border-violet-200',
  launched: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  seeking_collaborators: 'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  on_hold: 'bg-rose-50 text-rose-700 border-rose-200',
};

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.get<ProjectDetail>(`/portfolio/projects/${id}`)
      .then(setProject)
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

  if (notFound || !project) {
    return (
      <div className="min-h-screen pt-24 pb-20 px-4 flex flex-col items-center justify-center text-center">
        <p className="text-6xl font-bold text-black/10 mb-4">404</p>
        <h1 className="text-2xl mb-3">Project not found</h1>
        <Link to="/portfolio" className="text-primary hover:underline text-sm">← Back to Portfolio</Link>
      </div>
    );
  }

  const statusLabel = STATUS_LABELS[project.status] || project.status;
  const statusColor = STATUS_COLORS[project.status] || 'bg-primary/10 text-primary border-primary/20';

  return (
    <div className="min-h-screen pt-20 pb-20">
      {/* Hero */}
      <div className="bg-gradient-to-br from-primary/5 via-white to-white border-b border-black/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <Link to="/portfolio" className="inline-flex items-center gap-1.5 text-sm text-black/50 hover:text-primary transition-colors mb-8">
            <ArrowLeft className="w-4 h-4" /> Portfolio
          </Link>

          <div className="flex flex-col sm:flex-row gap-8 items-start">
            {project.image_url && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
                <img src={project.image_url} alt={project.title} className="w-28 h-28 rounded-2xl object-cover border-4 border-white shadow-xl flex-shrink-0" />
              </motion.div>
            )}

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium bg-black/5 border border-black/10 rounded-full">
                  {project.category}
                </span>
                <span className={`px-3 py-1 text-xs font-medium border rounded-full ${statusColor}`}>{statusLabel}</span>
                {project.featured && (
                  <span className="px-3 py-1 text-xs font-medium bg-primary text-white rounded-full">Featured</span>
                )}
              </div>
              <h1 className="text-4xl font-bold mb-2">{project.title}</h1>
              {project.tagline && <p className="text-primary font-semibold text-lg mb-4">{project.tagline}</p>}

              {project.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-5">
                  {project.tags.map((tag) => (
                    <span key={tag} className="px-2.5 py-1 text-xs bg-black/5 border border-black/10 rounded-full">{tag}</span>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                {project.github_url && (
                  <a href={project.github_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline"><Github className="mr-2 w-4 h-4" />Code</Button>
                  </a>
                )}
                {project.live_url && (
                  <a href={project.live_url} target="_blank" rel="noopener noreferrer">
                    <Button><ExternalLink className="mr-2 w-4 h-4" />Live Demo</Button>
                  </a>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
        {project.pitch_summary && (
          <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <GlassCard className="p-8">
              <p className="text-lg text-black/80 leading-relaxed italic">"{project.pitch_summary}"</p>
            </GlassCard>
          </motion.section>
        )}

        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}>
          <h2 className="text-2xl font-bold mb-4">Overview</h2>
          <p className="text-black/70 leading-relaxed">{project.description}</p>
        </motion.section>

        {(project.problem_statement || project.solution) && (
          <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="grid sm:grid-cols-2 gap-6">
            {project.problem_statement && (
              <GlassCard className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-lg">The Problem</h3>
                </div>
                <p className="text-black/65 text-sm leading-relaxed">{project.problem_statement}</p>
              </GlassCard>
            )}
            {project.solution && (
              <GlassCard className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-lg">The Approach</h3>
                </div>
                <p className="text-black/65 text-sm leading-relaxed">{project.solution}</p>
              </GlassCard>
            )}
          </motion.section>
        )}

        {project.collaborators.length > 0 && (
          <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}>
            <div className="flex items-center gap-2 mb-6">
              <Users className="w-5 h-5 text-primary" />
              <h2 className="text-2xl font-bold">Collaborators</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {project.collaborators.map((c, i) => (
                <GlassCard key={i} className="p-5 flex items-center gap-3" hover>
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">{c.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    {c.url ? (
                      <a href={c.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-sm hover:text-primary transition-colors truncate block">{c.name}</a>
                    ) : (
                      <p className="font-semibold text-sm truncate">{c.name}</p>
                    )}
                    {c.role && <p className="text-xs text-black/50 truncate">{c.role}</p>}
                  </div>
                </GlassCard>
              ))}
            </div>
          </motion.section>
        )}

        {project.gallery_urls.length > 0 && (
          <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
            <div className="flex items-center gap-2 mb-6">
              <Images className="w-5 h-5 text-primary" />
              <h2 className="text-2xl font-bold">Gallery</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {project.gallery_urls.map((url, i) => (
                <img key={i} src={url} alt={`${project.title} gallery ${i + 1}`} className="w-full h-40 object-cover rounded-xl border border-black/10" />
              ))}
            </div>
          </motion.section>
        )}

        {project.looking_for && (
          <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.25 }}>
            <GlassCard className="p-8 border-primary/30 bg-primary/[0.04]">
              <div className="flex items-center gap-2 mb-3">
                <Megaphone className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-lg">Looking For</h3>
              </div>
              <p className="text-black/70 text-sm leading-relaxed">{project.looking_for}</p>
            </GlassCard>
          </motion.section>
        )}
      </div>
    </div>
  );
}
