import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { ExternalLink, Github, FolderKanban, Code } from 'lucide-react';
import { GlassCard } from '../components/glass-card';
import { api } from '../utils/api';

export type OrganizationalProject = {
  id: string;
  title: string;
  description: string;
  tech_stack: string[];
  github_url: string | null;
  live_url: string | null;
  image_url: string | null;
  contributor_name: string;
  contributor_slug: string;
  contributor_photo_url: string | null;
};

export function ProjectCard({ project, index }: { project: OrganizationalProject; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.06 }}
    >
      <GlassCard className="overflow-hidden h-full flex flex-col" hover>
        <Link to={`/projects/${project.id}`} className="block">
          <div className="h-44 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center relative overflow-hidden">
            {project.image_url ? (
              <img src={project.image_url} alt={project.title} className="h-full w-full object-cover" />
            ) : (
              <Code className="w-14 h-14 text-primary/50" />
            )}
          </div>
        </Link>
        <div className="p-6 flex-1 flex flex-col">
          <Link to={`/projects/${project.id}`} className="hover:text-primary transition-colors">
            <h3 className="text-xl mb-2">{project.title}</h3>
          </Link>
          <p className="text-black/60 mb-4 flex-1 text-sm leading-relaxed">{project.description}</p>
          {project.tech_stack.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {project.tech_stack.map((tag) => (
                <span key={tag} className="px-2 py-1 text-xs bg-black/5 border border-black/10 rounded">{tag}</span>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between pt-4 border-t border-black/8 mt-auto">
            <div className="flex items-center gap-2 min-w-0">
              {project.contributor_photo_url ? (
                <img src={project.contributor_photo_url} alt={project.contributor_name} className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
                  {project.contributor_name.charAt(0)}
                </div>
              )}
              <span className="text-xs text-black/50 truncate">{project.contributor_name}</span>
            </div>
            <div className="flex gap-3 flex-shrink-0">
              {project.github_url && (
                <a href={project.github_url} target="_blank" rel="noopener noreferrer" className="text-black/50 hover:text-primary transition-colors">
                  <Github className="w-4 h-4" />
                </a>
              )}
              {project.live_url && (
                <a href={project.live_url} target="_blank" rel="noopener noreferrer" className="text-black/50 hover:text-primary transition-colors">
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}

export function Projects() {
  const [projects, setProjects] = useState<OrganizationalProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<OrganizationalProject[]>('/team/projects/organizational')
      .then(setProjects)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center mb-14">
          <div className="flex items-center justify-center gap-3 mb-4">
            <FolderKanban className="w-8 h-8 text-primary" />
            <p className="text-sm uppercase tracking-[0.22em] text-primary">Organization</p>
          </div>
          <h1 className="text-5xl mb-4">Our Projects</h1>
          <p className="text-xl text-black/60 max-w-2xl mx-auto">Ventures and initiatives built by the G-Tech team, across our people and disciplines.</p>
        </motion.div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(6)].map((_, i) => <div key={i} className="h-80 bg-black/5 rounded-xl animate-pulse" />)}
          </div>
        ) : projects.length === 0 ? (
          <p className="text-center text-black/40 py-20">No organizational projects published yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {projects.map((project, index) => (
              <ProjectCard key={project.id} project={project} index={index} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
