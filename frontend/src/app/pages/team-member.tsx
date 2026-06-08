import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import { motion } from 'motion/react';
import { Linkedin, Twitter, Github, Globe, ArrowLeft, Briefcase, GraduationCap, FolderKanban, ExternalLink, Award, Cpu } from 'lucide-react';
import { Timeline, type TimelineEntry } from '../components/timeline';
import { api } from '../utils/api';

type Experience = {
  id: string;
  company: string;
  position: string;
  duration: string;
  location: string | null;
  description: string | null;
};

type Education = {
  id: string;
  institution: string;
  degree: string;
  field_of_study: string;
  start_year: string;
  end_year: string | null;
  description: string | null;
};

type Project = {
  id: string;
  title: string;
  description: string;
  tech_stack: string[];
  github_url: string | null;
  live_url: string | null;
  image_url: string | null;
};

type Certification = {
  id: string;
  title: string;
  issuer: string;
  date: string;
  credential_url: string | null;
};

type TeamMemberDetail = {
  id: string;
  slug: string;
  full_name: string;
  title: string;
  bio: string | null;
  photo_url: string | null;
  headline: string | null;
  linkedin_url: string | null;
  twitter_url: string | null;
  github_url: string | null;
  website: string | null;
  experiences: Experience[];
  educations: Education[];
  projects: Project[];
  certifications: Certification[];
};

export function TeamMember() {
  const { slug } = useParams<{ slug: string }>();
  const [member, setMember] = useState<TeamMemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    api.get<TeamMemberDetail>(`/team/${slug}`)
      .then(setMember)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

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

  if (notFound || !member) {
    return (
      <div className="min-h-screen pt-24 pb-20 px-4 flex flex-col items-center justify-center text-center">
        <p className="text-6xl font-bold text-black/10 mb-4">404</p>
        <h1 className="text-2xl mb-3">Team member not found</h1>
        <Link to="/team" className="text-primary hover:underline text-sm">← Back to Our Team</Link>
      </div>
    );
  }

  const hasSections = member.experiences.length > 0 || member.educations.length > 0 || member.projects.length > 0 || member.certifications.length > 0;
  const techStack = [...new Set(member.projects.flatMap((p) => p.tech_stack))].filter(Boolean);

  return (
    <div className="min-h-screen pt-20 pb-20">
      {/* Hero */}
      <div className="bg-gradient-to-br from-primary/5 via-white to-white border-b border-black/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <Link to="/team" className="inline-flex items-center gap-1.5 text-sm text-black/50 hover:text-primary transition-colors mb-8">
            <ArrowLeft className="w-4 h-4" /> Our Team
          </Link>

          <div className="flex flex-col sm:flex-row gap-8 items-start">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
              {member.photo_url ? (
                <img
                  src={member.photo_url}
                  alt={member.full_name}
                  className="w-36 h-36 rounded-full object-cover border-4 border-white shadow-xl flex-shrink-0"
                />
              ) : (
                <div className="w-36 h-36 rounded-full bg-primary/10 flex items-center justify-center border-4 border-white shadow-xl flex-shrink-0">
                  <span className="text-5xl font-bold text-primary">{member.full_name[0]}</span>
                </div>
              )}
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="flex-1">
              <h1 className="text-4xl font-bold mb-1">{member.full_name}</h1>
              <p className="text-primary font-semibold text-lg mb-2">{member.title}</p>
              {member.headline && <p className="text-black/60 text-base mb-4 italic">{member.headline}</p>}
              {member.bio && <p className="text-black/70 leading-relaxed max-w-2xl mb-5">{member.bio}</p>}

              <div className="flex flex-wrap gap-3">
                {member.linkedin_url && (
                  <a href={member.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-black/60 hover:text-primary transition-colors">
                    <Linkedin className="w-4 h-4" /> LinkedIn
                  </a>
                )}
                {member.twitter_url && (
                  <a href={member.twitter_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-black/60 hover:text-primary transition-colors">
                    <Twitter className="w-4 h-4" /> Twitter
                  </a>
                )}
                {member.github_url && (
                  <a href={member.github_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-black/60 hover:text-primary transition-colors">
                    <Github className="w-4 h-4" /> GitHub
                  </a>
                )}
                {member.website && (
                  <a href={member.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-black/60 hover:text-primary transition-colors">
                    <Globe className="w-4 h-4" /> Website
                  </a>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Sections */}
      {hasSections && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-14">
          {/* Work Experience */}
          {member.experiences.length > 0 && (
            <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <div className="flex items-center gap-2 mb-6">
                <Briefcase className="w-5 h-5 text-primary" />
                <h2 className="text-2xl font-bold">Work Experience</h2>
              </div>
              <Timeline
                entries={member.experiences.map((exp) => ({
                  id: exp.id,
                  heading: exp.position,
                  subheading: exp.company,
                  period: exp.duration,
                  location: exp.location,
                  body: exp.description,
                } satisfies TimelineEntry))}
              />
            </motion.section>
          )}

          {/* Education */}
          {member.educations.length > 0 && (
            <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
              <div className="flex items-center gap-2 mb-6">
                <GraduationCap className="w-5 h-5 text-primary" />
                <h2 className="text-2xl font-bold">Education</h2>
              </div>
              <div className="space-y-6">
                {member.educations.map((edu) => (
                  <div key={edu.id} className="bg-white/70 backdrop-blur border border-black/5 rounded-xl p-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 mb-1">
                      <h3 className="font-semibold text-lg">{edu.institution}</h3>
                      <span className="text-sm text-black/50 whitespace-nowrap">
                        {edu.start_year} – {edu.end_year ?? 'Present'}
                      </span>
                    </div>
                    <p className="text-primary font-medium text-sm mb-1">
                      {edu.degree} in {edu.field_of_study}
                    </p>
                    {edu.description && <p className="text-black/65 text-sm leading-relaxed mt-2">{edu.description}</p>}
                  </div>
                ))}
              </div>
            </motion.section>
          )}

          {/* Certifications */}
          {member.certifications.length > 0 && (
            <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
              <div className="flex items-center gap-2 mb-6">
                <Award className="w-5 h-5 text-primary" />
                <h2 className="text-2xl font-bold">Certifications</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {member.certifications.map((cert) => (
                  <div key={cert.id} className="bg-white/70 backdrop-blur border border-black/5 rounded-xl p-5 shadow-sm flex items-start gap-4">
                    <div className="p-2.5 rounded-lg bg-primary/10 flex-shrink-0">
                      <Award className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base leading-snug">{cert.title}</h3>
                      <p className="text-primary font-medium text-sm mt-0.5">{cert.issuer}</p>
                      <p className="text-black/40 text-xs mt-0.5">{cert.date}</p>
                      {cert.credential_url && (
                        <a
                          href={cert.credential_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                        >
                          <ExternalLink className="w-3 h-3" /> View Credential
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.section>
          )}

          {/* Tech Stack */}
          {techStack.length > 0 && (
            <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.25 }}>
              <div className="flex items-center gap-2 mb-6">
                <Cpu className="w-5 h-5 text-primary" />
                <h2 className="text-2xl font-bold">Tech Stack</h2>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {techStack.map((tech, i) => (
                  <motion.span
                    key={tech}
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.25, delay: i * 0.03 }}
                    whileHover={{ scale: 1.08, y: -2 }}
                    className="px-4 py-1.5 text-sm font-medium bg-primary/8 text-primary border border-primary/20 rounded-full cursor-default hover:bg-primary/15 hover:shadow-sm transition-colors"
                  >
                    {tech}
                  </motion.span>
                ))}
              </div>
            </motion.section>
          )}

          {/* Projects */}
          {member.projects.length > 0 && (
            <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
              <div className="flex items-center gap-2 mb-6">
                <FolderKanban className="w-5 h-5 text-primary" />
                <h2 className="text-2xl font-bold">Projects</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {member.projects.map((proj) => (
                  <div key={proj.id} className="bg-white/70 backdrop-blur border border-black/5 rounded-xl overflow-hidden shadow-sm">
                    {proj.image_url && (
                      <img src={proj.image_url} alt={proj.title} className="w-full h-40 object-cover" />
                    )}
                    <div className="p-5">
                      <h3 className="font-semibold text-lg mb-2">{proj.title}</h3>
                      <p className="text-black/65 text-sm leading-relaxed mb-3">{proj.description}</p>
                      {proj.tech_stack.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {proj.tech_stack.map((tech) => (
                            <span key={tech} className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                              {tech}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-3">
                        {proj.github_url && (
                          <a href={proj.github_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-black/60 hover:text-primary transition-colors">
                            <Github className="w-3.5 h-3.5" /> Code
                          </a>
                        )}
                        {proj.live_url && (
                          <a href={proj.live_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-black/60 hover:text-primary transition-colors">
                            <ExternalLink className="w-3.5 h-3.5" /> Live
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.section>
          )}
        </div>
      )}
    </div>
  );
}
