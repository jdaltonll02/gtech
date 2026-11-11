import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, ExternalLink, Award, BookOpen, Code, Download, Github } from 'lucide-react';
import { GlassCard } from '../components/glass-card';
import { Button } from '../components/ui/button';
import { api } from '../utils/api';

interface Project { id: string; title: string; description: string; category: string; tags: string[]; github_url?: string; live_url?: string; featured?: boolean; }
interface Experience { id: string; company: string; position: string; duration: string; location: string; description: string; achievements: string[]; }
interface Skill { id: string; category: string; name: string; order_index: number; }
interface Certification { id: string; title: string; issuer: string; date: string; credential_url?: string; }
interface Publication { id: string; title: string; authors: string; venue: string; year: string; link?: string; }

const RESUME_DOWNLOAD_URL = '/resume.pdf';
const LOCAL_PROFILE_PHOTO_URL = '/profile-photo.jpg';
const FALLBACK_PROFILE_PHOTO_URL = 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=900&q=80';

export function Portfolio() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [skills, setSkills] = useState<Record<string, string[]>>({});
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(LOCAL_PROFILE_PHOTO_URL);

  useEffect(() => {
    api.get<Project[]>('/portfolio/projects').then(setProjects).catch(() => {});
    api.get<Experience[]>('/portfolio/experience').then(setExperiences).catch(() => {});
    api.get<Skill[]>('/portfolio/skills').then((data) => {
      const grouped: Record<string, string[]> = {};
      data.forEach((skill) => {
        if (!grouped[skill.category]) grouped[skill.category] = [];
        grouped[skill.category].push(skill.name);
      });
      setSkills(grouped);
    }).catch(() => {});
    api.get<Certification[]>('/portfolio/certifications').then(setCertifications).catch(() => {});
    api.get<Publication[]>('/portfolio/publications').then(setPublications).catch(() => {});
  }, []);

  const featuredProjects = projects.filter((project) => project.featured);

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <section className="mb-16">
            <GlassCard className="p-8 sm:p-12 overflow-hidden">
              <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-8 items-center">
                <div>
                  <p className="text-sm uppercase tracking-[0.22em] text-primary mb-4">Personal Portfolio</p>
                  <h1 className="text-5xl sm:text-6xl mb-6">John Dalton Gibson</h1>
                  <p className="text-xl sm:text-2xl text-black/80 mb-4">AI/ML Engineer & CMU Graduate Student</p>
                  <p className="text-lg text-black/60 max-w-2xl mb-8">Specializing in Computer Vision, Robotics, and Deep Learning</p>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <a href="#featured-projects"><Button size="lg" className="group">View Featured Work<ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" /></Button></a>
                    <a href={RESUME_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer"><Button size="lg" variant="outline">View Resume</Button></a>
                    <a href={RESUME_DOWNLOAD_URL} download="John-Dalton-Gibson-Resume.pdf"><Button size="lg" variant="outline"><Download className="mr-2 w-5 h-5" />Download Resume</Button></a>
                    <a href="https://github.com" target="_blank" rel="noopener noreferrer"><Button size="lg" variant="outline"><Github className="mr-2 w-5 h-5" />GitHub</Button></a>
                  </div>
                </div>
                <div className="rounded-[2rem] border border-black/10 bg-gradient-to-br from-primary/12 to-black/[0.02] p-8 sm:p-10">
                  <div className="mb-6 overflow-hidden rounded-2xl border border-black/10 bg-white/70">
                    <img
                      src={profilePhotoUrl}
                      alt="Professional profile"
                      className="h-72 w-full object-cover"
                      onError={() => setProfilePhotoUrl(FALLBACK_PROFILE_PHOTO_URL)}
                    />
                  </div>
                  <p className="text-sm uppercase tracking-[0.2em] text-primary mb-4">Current Focus</p>
                  <div className="space-y-4 text-black/70 leading-relaxed">
                    <p>Designing production-ready digital systems that combine strong interface design with real operational depth.</p>
                    <p>Working across intelligent applications, platform architecture, learning systems, and tools that help organizations scale without chaos.</p>
                  </div>
                </div>
              </div>
            </GlassCard>
          </section>

          <h1 className="text-5xl mb-4 text-center">Portfolio</h1>
          <p className="text-xl text-black/60 text-center mb-12">Explore my work in AI, Machine Learning, and Robotics</p>

          <section className="py-20 px-4 sm:px-6 lg:px-8 bg-black/[0.02] rounded-3xl">
            <div className="max-w-7xl mx-auto">
              <h2 className="text-4xl mb-12 text-center">Skills & Expertise</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.entries(skills).map(([category, items], index) => (
                  <motion.div key={category} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: index * 0.1 }}>
                    <GlassCard className="p-6 h-full">
                      <h3 className="text-xl mb-4 text-primary">{category}</h3>
                      <div className="flex flex-wrap gap-2">
                        {items.map((skill) => (<span key={skill} className="px-3 py-1 text-sm bg-black/5 border border-black/10 rounded-full">{skill}</span>))}
                      </div>
                    </GlassCard>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {experiences.length > 0 && (
            <section className="py-20 px-4 sm:px-6 lg:px-8">
              <div className="max-w-4xl mx-auto">
                <h2 className="text-4xl mb-12 text-center">Experience</h2>
                <div className="space-y-8">
                  {experiences.map((exp, index) => (
                    <motion.div key={exp.id} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: index * 0.1 }}>
                      <GlassCard className="p-6" hover>
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-4">
                          <div><h3 className="text-xl text-primary">{exp.position}</h3><p className="text-lg">{exp.company}</p></div>
                          <div className="text-sm text-black/50 mt-2 md:mt-0 md:text-right"><p>{exp.duration}</p><p>{exp.location}</p></div>
                        </div>
                        <p className="text-black/70 mb-4">{exp.description}</p>
                        <ul className="space-y-2">
                          {exp.achievements.map((achievement, achievementIndex) => (<li key={achievementIndex} className="flex items-start text-sm text-black/60"><span className="text-primary mr-2">•</span>{achievement}</li>))}
                        </ul>
                      </GlassCard>
                    </motion.div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {featuredProjects.length > 0 && (
            <section id="featured-projects" className="py-20 px-4 sm:px-6 lg:px-8 bg-black/[0.02] rounded-3xl">
              <div className="max-w-7xl mx-auto">
                <h2 className="text-4xl mb-12 text-center">Featured Projects</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {featuredProjects.map((project, index) => (
                    <motion.div key={project.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: index * 0.1 }}>
                      <GlassCard className="overflow-hidden h-full flex flex-col" hover>
                        <div className="h-48 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                          <Code className="w-16 h-16 text-primary/50" />
                        </div>
                        <div className="p-6 flex-1 flex flex-col">
                          <h3 className="text-xl mb-2">{project.title}</h3>
                          <p className="text-sm text-primary mb-3">{project.category}</p>
                          <p className="text-black/60 mb-4 flex-1">{project.description}</p>
                          <div className="flex flex-wrap gap-2 mb-4">
                            {project.tags.map((tag) => (<span key={tag} className="px-2 py-1 text-xs bg-black/5 border border-black/10 rounded">{tag}</span>))}
                          </div>
                          {project.github_url && (
                            <a href={project.github_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm flex items-center">
                              View on GitHub<ExternalLink className="ml-1 w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </GlassCard>
                    </motion.div>
                  ))}
                </div>
              </div>
            </section>
          )}

          <section className="py-20 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
              <h2 className="text-4xl mb-12 text-center">Certifications</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {certifications.map((cert, index) => (
                  <motion.div key={cert.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: index * 0.1 }}>
                    <GlassCard className="p-6 text-center" hover>
                      <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full flex items-center justify-center">
                        <Award className="w-10 h-10 text-primary" />
                      </div>
                      <h3 className="mb-2">{cert.title}</h3>
                      <p className="text-sm text-black/60 mb-2">{cert.issuer}</p>
                      <p className="text-xs text-primary">{cert.date}</p>
                      {cert.credential_url && (
                        <a href={cert.credential_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline mt-2 inline-block">View credential</a>
                      )}
                    </GlassCard>
                  </motion.div>
                ))}
              </div>
              {certifications.length === 0 && <p className="text-center text-black/40 py-20">No certifications yet.</p>}
            </div>
          </section>

          <section className="py-20 px-4 sm:px-6 lg:px-8 bg-black/[0.02] rounded-3xl">
            <div className="space-y-6 max-w-4xl mx-auto">
              <h2 className="text-4xl mb-12 text-center">Publications</h2>
              {publications.map((pub, index) => (
                <motion.div key={pub.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: index * 0.1 }}>
                  <GlassCard className="p-6" hover>
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg flex items-center justify-center flex-shrink-0">
                        <BookOpen className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl mb-2">{pub.title}</h3>
                        <p className="text-sm text-black/60 mb-2">{pub.authors}</p>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-primary">{pub.venue}</span>
                          <span className="text-black/50">{pub.year}</span>
                        </div>
                        {pub.link && (
                          <a href={pub.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-primary hover:underline text-sm mt-3">
                            Read Paper<ExternalLink className="ml-1 w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
              {publications.length === 0 && <p className="text-center text-black/40 py-20">No publications yet.</p>}
            </div>
          </section>
        </motion.div>
      </div>
    </div>
  );
}
