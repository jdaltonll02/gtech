import { useEffect, useState } from 'react';
import { Github, Linkedin, Mail } from 'lucide-react';
import { Link } from 'react-router';
import { api } from '../utils/api';

type Profile = { github_url: string; full_name: string };

// lucide-react has no X (formerly Twitter) mark.
function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}

const linkClass = 'inline-flex min-h-8 items-center text-text-secondary hover:text-primary transition-colors';
const socialClass = 'h-11 w-11 flex items-center justify-center rounded-lg text-text-secondary hover:text-primary hover:bg-brand-tint-50 transition-colors';

const columns: { title: string; links: { to: string; label: string }[] }[] = [
  {
    title: 'Explore',
    links: [
      { to: '/projects', label: 'Projects' },
      { to: '/courses', label: 'Courses' },
      { to: '/store', label: 'Store' },
      { to: '/gallery', label: 'Gallery' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { to: '/blog', label: 'Blog & News' },
      { to: '/forms', label: 'Apply / Register' },
      { to: '/portfolio#publications', label: 'Publications' },
      { to: '/docs', label: 'Help & Docs' },
    ],
  },
  {
    title: 'Company',
    links: [
      { to: '/team', label: 'Our Team' },
      { to: '/portfolio', label: 'CEO & Founder' },
      { to: '/contact', label: 'Contact' },
    ],
  },
];

export function Footer() {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    api.get<Profile>('/portfolio/profile').then(setProfile).catch(() => {});
  }, []);

  const githubUrl = profile?.github_url || 'https://github.com';

  return (
    <footer className="border-t border-surface-border bg-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14">
        <div className="grid grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr_1fr] gap-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1 space-y-4">
            <Link to="/" className="inline-flex items-center gap-2.5" aria-label="G-Tech home">
              <img src="/gtech_mark.svg" alt="" className="h-10 w-10" />
              <span className="font-heading text-xl font-bold tracking-tight text-black">G-Tech</span>
            </Link>
            <p className="text-[15px] text-text-secondary leading-relaxed max-w-xs">
              STEM education, applied research, and tech ventures, built together.
            </p>
            <div className="flex -ml-3">
              <a href={githubUrl} target="_blank" rel="noopener noreferrer" className={socialClass} aria-label="G-Tech on GitHub">
                <Github className="w-5 h-5" aria-hidden />
              </a>
              <a href="https://linkedin.com/company/gibson-technologies" target="_blank" rel="noopener noreferrer" className={socialClass} aria-label="G-Tech on LinkedIn">
                <Linkedin className="w-5 h-5" aria-hidden />
              </a>
              <a href="https://x.com/gibsontechs" target="_blank" rel="noopener noreferrer" className={socialClass} aria-label="G-Tech on X">
                <XIcon className="w-[18px] h-[18px]" />
              </a>
              <Link to="/contact" className={socialClass} aria-label="Contact G-Tech">
                <Mail className="w-5 h-5" aria-hidden />
              </Link>
            </div>
          </div>

          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title} className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-black">{column.title}</h3>
              <ul className="space-y-1 text-[15px]">
                {column.links.map((link) => (
                  <li key={link.to}><Link to={link.to} className={linkClass}>{link.label}</Link></li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Extra bottom padding keeps the floating chat button off the copyright line */}
        <div className="mt-12 py-8 pb-24 sm:pb-8 sm:pr-20 border-t border-surface-border text-sm text-text-secondary">
          <p>&copy; {new Date().getFullYear()} Gibson Technologies (<span className="whitespace-nowrap">G-Tech</span>). All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
