import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import { motion } from 'motion/react';
import { ArrowLeft, ExternalLink, Github, Code } from 'lucide-react';
import { GlassCard } from '../components/glass-card';
import { Button } from '../components/ui/button';
import { api } from '../utils/api';
import type { OrganizationalProject } from './projects';

export function ProjectOrgDetail() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<OrganizationalProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.get<OrganizationalProject>(`/team/projects/organizational/${id}`)
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
        <Link to="/projects" className="text-primary hover:underline text-sm">← Back to Projects</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-20">
      <div className="bg-gradient-to-br from-primary/5 via-white to-white border-b border-black/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <Link to="/projects" className="inline-flex items-center gap-1.5 text-sm text-black/50 hover:text-primary transition-colors mb-8">
            <ArrowLeft className="w-4 h-4" /> Projects
          </Link>

          <div className="flex flex-col sm:flex-row gap-8 items-start">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
              <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-black/10 shadow-xl flex items-center justify-center overflow-hidden flex-shrink-0">
                {project.image_url ? (
                  <img src={project.image_url} alt={project.title} className="h-full w-full object-cover" />
                ) : (
                  <Code className="w-12 h-12 text-primary/50" />
                )}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="flex-1">
              <p className="text-sm uppercase tracking-[0.22em] text-primary mb-3">Organizational Project</p>
              <h1 className="text-4xl font-bold mb-4">{project.title}</h1>

              {project.tech_stack.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-5">
                  {project.tech_stack.map((tag) => (
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

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <h2 className="text-2xl font-bold mb-4">Overview</h2>
          <p className="text-black/70 leading-relaxed">{project.description}</p>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}>
          <GlassCard className="p-6 flex items-center gap-4" hover>
            {project.contributor_photo_url ? (
              <img src={project.contributor_photo_url} alt={project.contributor_name} className="w-14 h-14 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary flex-shrink-0">
                {project.contributor_name.charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs text-black/50 mb-0.5">Contributed by</p>
              <Link to={`/team/${project.contributor_slug}`} className="font-semibold hover:text-primary transition-colors">
                {project.contributor_name}
              </Link>
            </div>
          </GlassCard>
        </motion.section>
      </div>
    </div>
  );
}
