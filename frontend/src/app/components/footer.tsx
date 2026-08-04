import { useEffect, useState } from 'react';
import { Github, Linkedin, Mail, Twitter } from 'lucide-react';
import { Link } from 'react-router';
import { api } from '../utils/api';

type Profile = { github_url: string; full_name: string };

export function Footer() {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    api.get<Profile>('/portfolio/profile').then(setProfile).catch(() => {});
  }, []);

  const githubUrl = profile?.github_url || 'https://github.com';

  return (
    <footer className="border-t border-black/10 backdrop-blur-md bg-white/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* People */}
          <div className="space-y-4">
            <h3 className="text-lg">People</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/portfolio" className="text-black/60 hover:text-primary transition-colors">
                  CEO &amp; Founder
                </Link>
              </li>
            </ul>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="text-lg">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/projects" className="text-black/60 hover:text-primary transition-colors">Projects</Link></li>
              <li><Link to="/courses" className="text-black/60 hover:text-primary transition-colors">Courses</Link></li>
              <li><Link to="/store" className="text-black/60 hover:text-primary transition-colors">Store</Link></li>
              <li><Link to="/gallery" className="text-black/60 hover:text-primary transition-colors">Gallery</Link></li>
              <li><Link to="/contact" className="text-black/60 hover:text-primary transition-colors">Contact</Link></li>
            </ul>
          </div>

          {/* Resources */}
          <div className="space-y-4">
            <h3 className="text-lg">Resources</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/blog" className="text-black/60 hover:text-primary transition-colors">Blog &amp; News</Link></li>
              <li><Link to="/forms" className="text-black/60 hover:text-primary transition-colors">Apply / Register</Link></li>
              <li><Link to="/portfolio#publications" className="text-black/60 hover:text-primary transition-colors">Publications</Link></li>
              <li><Link to="/docs" className="text-black/60 hover:text-primary transition-colors">Help &amp; Docs</Link></li>
            </ul>
          </div>

          {/* Connect */}
          <div className="space-y-4">
            <h3 className="text-lg">Connect</h3>
            <div className="flex space-x-4">
              <a href={githubUrl} target="_blank" rel="noopener noreferrer" className="text-black/60 hover:text-primary transition-colors" aria-label="GitHub">
                <Github className="w-5 h-5" />
              </a>
              <a href="https://linkedin.com/company/gibson-technologies" target="_blank" rel="noopener noreferrer" className="text-black/60 hover:text-primary transition-colors" aria-label="LinkedIn">
                <Linkedin className="w-5 h-5" />
              </a>
              <a href="https://twitter.com/gibsontechs" target="_blank" rel="noopener noreferrer" className="text-black/60 hover:text-primary transition-colors" aria-label="Twitter / X">
                <Twitter className="w-5 h-5" />
              </a>
              <Link to="/contact" className="text-black/60 hover:text-primary transition-colors" aria-label="Contact">
                <Mail className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-black/10 text-center text-sm text-black/60">
          <p>&copy; {new Date().getFullYear()} Gibson Technologies. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
