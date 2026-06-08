import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Printer } from 'lucide-react';
import { api } from '../utils/api';

interface ProfileSettings {
  full_name: string;
  title: string;
  subtitle: string;
  focus_paragraph_1: string | null;
  github_url: string;
  profile_photo_url: string | null;
}

interface Experience {
  id: string;
  company: string;
  position: string;
  duration: string;
  location: string;
  description: string;
  achievements: string[];
}

interface Education {
  id: string;
  institution: string;
  degree: string;
  field_of_study: string;
  start_year: string;
  end_year?: string;
  gpa?: string;
}

interface Skill {
  id: string;
  category: string;
  name: string;
  order_index: number;
}

interface Certification {
  id: string;
  title: string;
  issuer: string;
  date: string;
  credential_url?: string;
}

interface Project {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  github_url?: string;
  live_url?: string;
  featured?: boolean;
}

const DEFAULT_PROFILE: ProfileSettings = {
  full_name: 'John Dalton Gibson',
  title: 'AI/ML Engineer & CMU Graduate Student',
  subtitle: 'Specializing in Computer Vision, Robotics, and Deep Learning',
  focus_paragraph_1: null,
  github_url: 'https://github.com',
  profile_photo_url: null,
};

function Section({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4 mt-8 first:mt-0">
      <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-black/40 whitespace-nowrap">{title}</h2>
      <div className="flex-1 h-px bg-black/10" />
    </div>
  );
}

export function Resume() {
  const [profile, setProfile] = useState<ProfileSettings>(DEFAULT_PROFILE);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [educations, setEducations] = useState<Education[]>([]);
  const [skillsByCategory, setSkillsByCategory] = useState<Record<string, string[]>>({});
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    api.get<ProfileSettings>('/portfolio/profile').then(setProfile).catch(() => {});
    api.get<Experience[]>('/portfolio/experience').then(setExperiences).catch(() => {});
    api.get<Education[]>('/portfolio/education').then(setEducations).catch(() => {});
    api.get<Skill[]>('/portfolio/skills').then((data) => {
      const grouped: Record<string, string[]> = {};
      data.forEach((s) => {
        if (!grouped[s.category]) grouped[s.category] = [];
        grouped[s.category].push(s.name);
      });
      setSkillsByCategory(grouped);
    }).catch(() => {});
    api.get<Certification[]>('/portfolio/certifications').then(setCertifications).catch(() => {});
    api.get<Project[]>('/portfolio/projects').then((data) => {
      setProjects(data.filter((p) => p.featured).slice(0, 4));
    }).catch(() => {});
  }, []);

  const githubHandle = profile.github_url?.replace(/^https?:\/\/(www\.)?github\.com\//, '') || '';

  return (
    <div className="min-h-screen bg-white">
      {/* Action bar — hidden on print */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-black/8 px-6 py-3 flex items-center justify-between">
        <Link to="/portfolio" className="flex items-center gap-1.5 text-sm text-black/50 hover:text-black transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Portfolio
        </Link>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-black/80 transition-colors"
        >
          <Printer className="w-4 h-4" /> Print / Save as PDF
        </button>
      </div>

      {/* Resume body */}
      <div className="max-w-[800px] mx-auto px-10 py-10 print:px-6 print:py-4">
        {/* Header */}
        <div className="mb-6 print:mb-4">
          <h1 className="text-4xl print:text-3xl font-bold tracking-tight mb-1">{profile.full_name}</h1>
          <p className="text-lg print:text-base text-black/70 font-medium mb-1">{profile.title}</p>
          <p className="text-sm text-black/45 mb-3">{profile.subtitle}</p>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-black/50">
            {githubHandle && <span>github.com/{githubHandle}</span>}
          </div>
        </div>

        {/* Summary */}
        {profile.focus_paragraph_1 && (
          <>
            <Section title="Summary" />
            <p className="text-sm text-black/70 leading-relaxed">{profile.focus_paragraph_1}</p>
          </>
        )}

        {/* Skills */}
        {Object.keys(skillsByCategory).length > 0 && (
          <>
            <Section title="Skills" />
            <div className="space-y-1.5">
              {Object.entries(skillsByCategory).map(([cat, items]) => (
                <div key={cat} className="flex gap-2 text-sm">
                  <span className="font-semibold text-black/70 w-28 flex-shrink-0">{cat}:</span>
                  <span className="text-black/60">{items.join(', ')}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Experience */}
        {experiences.length > 0 && (
          <>
            <Section title="Experience" />
            <div className="space-y-5">
              {experiences.map((exp) => (
                <div key={exp.id} className="print:break-inside-avoid">
                  <div className="flex items-start justify-between mb-0.5">
                    <div>
                      <span className="font-bold text-sm">{exp.position}</span>
                      <span className="text-black/50 text-sm"> — {exp.company}</span>
                    </div>
                    <div className="text-xs text-black/40 text-right flex-shrink-0 pl-4">
                      <p>{exp.duration}</p>
                      {exp.location && <p>{exp.location}</p>}
                    </div>
                  </div>
                  {exp.description && <p className="text-xs text-black/60 leading-relaxed mb-1.5">{exp.description}</p>}
                  {exp.achievements?.length > 0 && (
                    <ul className="space-y-0.5 ml-3">
                      {exp.achievements.map((a, i) => (
                        <li key={i} className="text-xs text-black/60 flex gap-1.5">
                          <span className="text-black/30 flex-shrink-0">•</span>{a}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Education */}
        {educations.length > 0 && (
          <>
            <Section title="Education" />
            <div className="space-y-3">
              {educations.map((edu) => (
                <div key={edu.id} className="flex items-start justify-between print:break-inside-avoid">
                  <div>
                    <p className="font-bold text-sm">{edu.institution}</p>
                    <p className="text-xs text-black/60">{edu.degree} in {edu.field_of_study}{edu.gpa ? ` · GPA: ${edu.gpa}` : ''}</p>
                  </div>
                  <p className="text-xs text-black/40 flex-shrink-0 pl-4">{edu.start_year} – {edu.end_year ?? 'Present'}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Projects */}
        {projects.length > 0 && (
          <>
            <Section title="Projects" />
            <div className="space-y-3">
              {projects.map((proj) => (
                <div key={proj.id} className="print:break-inside-avoid">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="font-bold text-sm">{proj.title}</span>
                    {proj.tags.length > 0 && (
                      <span className="text-xs text-black/40">{proj.tags.join(', ')}</span>
                    )}
                  </div>
                  <p className="text-xs text-black/60 leading-relaxed">{proj.description}</p>
                  {(proj.github_url || proj.live_url) && (
                    <div className="flex gap-3 mt-0.5">
                      {proj.github_url && <span className="text-xs text-black/40">{proj.github_url}</span>}
                      {proj.live_url && <span className="text-xs text-black/40">{proj.live_url}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Certifications */}
        {certifications.length > 0 && (
          <>
            <Section title="Certifications" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {certifications.map((cert) => (
                <div key={cert.id} className="text-sm">
                  <span className="font-medium">{cert.title}</span>
                  <span className="text-black/50"> — {cert.issuer}</span>
                  <span className="text-xs text-black/40 ml-1">({cert.date})</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <style>{`
        @media print {
          @page { margin: 1.2cm 1.5cm; size: A4; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
