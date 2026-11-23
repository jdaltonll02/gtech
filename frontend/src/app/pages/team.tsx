import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { Linkedin, Twitter, Github, Globe } from 'lucide-react';
import { api } from '../utils/api';

type TeamMember = {
  id: string;
  slug: string | null;
  full_name: string;
  title: string;
  bio: string | null;
  photo_url: string | null;
  headline: string | null;
  linkedin_url: string | null;
  twitter_url: string | null;
  github_url: string | null;
  website: string | null;
  portfolioPath: string;
};

type ProfileSettings = {
  full_name: string;
  title: string;
  subtitle: string | null;
  focus_paragraph_1: string | null;
  profile_photo_url: string | null;
  github_url: string | null;
};

function toCard(m: TeamMember, i: number) {
  return (
    <motion.div
      key={m.id}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: i * 0.08 }}
    >
      <div className="flex flex-col items-center text-center p-8 rounded-2xl bg-white/70 backdrop-blur border border-black/5 shadow-sm hover:shadow-md transition-shadow h-full">
        <div className="mb-5">
          {m.photo_url ? (
            <img
              src={m.photo_url}
              alt={m.full_name}
              className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg"
            />
          ) : (
            <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center border-4 border-white shadow-lg">
              <span className="text-4xl font-bold text-primary">{m.full_name[0]}</span>
            </div>
          )}
        </div>

        <h3 className="text-xl font-bold mb-1">{m.full_name}</h3>
        <p className="text-primary font-medium text-sm mb-3">{m.title}</p>

        {m.bio && (
          <p className="text-black/60 text-sm leading-relaxed mb-4 line-clamp-3 flex-1">
            {m.bio}
          </p>
        )}

        <div className="flex gap-3 mb-5">
          {m.linkedin_url && (
            <a href={m.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-black/40 hover:text-primary transition-colors">
              <Linkedin className="w-4 h-4" />
            </a>
          )}
          {m.twitter_url && (
            <a href={m.twitter_url} target="_blank" rel="noopener noreferrer" className="text-black/40 hover:text-primary transition-colors">
              <Twitter className="w-4 h-4" />
            </a>
          )}
          {m.github_url && (
            <a href={m.github_url} target="_blank" rel="noopener noreferrer" className="text-black/40 hover:text-primary transition-colors">
              <Github className="w-4 h-4" />
            </a>
          )}
          {m.website && (
            <a href={m.website} target="_blank" rel="noopener noreferrer" className="text-black/40 hover:text-primary transition-colors">
              <Globe className="w-4 h-4" />
            </a>
          )}
        </div>

        <Link
          to={m.portfolioPath}
          className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2 text-sm text-white hover:bg-primary/90 transition-colors mt-auto"
        >
          View Portfolio
        </Link>
      </div>
    </motion.div>
  );
}

export function Team() {
  const [allMembers, setAllMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<ProfileSettings>('/portfolio/profile'),
      api.get<Omit<TeamMember, 'portfolioPath'>[]>('/team'),
    ]).then(([profile, members]) => {
      const ceo: TeamMember = {
        id: 'ceo',
        slug: null,
        full_name: profile.full_name,
        title: profile.title,
        bio: profile.focus_paragraph_1 ?? null,
        photo_url: profile.profile_photo_url ?? null,
        headline: profile.subtitle ?? null,
        linkedin_url: null,
        twitter_url: null,
        github_url: profile.github_url ?? null,
        website: null,
        portfolioPath: '/portfolio',
      };

      const rest: TeamMember[] = members.map((m) => ({
        ...m,
        portfolioPath: `/team/${m.slug}`,
      }));

      setAllMembers([ceo, ...rest]);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <p className="text-sm text-primary uppercase tracking-widest mb-3">Our People</p>
          <h1 className="text-5xl font-bold mb-4">Meet the Team</h1>
          <p className="text-black/50 max-w-xl mx-auto">
            The talented individuals driving G-Tech's mission forward.
          </p>
        </motion.div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse flex flex-col items-center p-8 rounded-2xl bg-black/5">
                <div className="w-32 h-32 rounded-full bg-black/10 mb-4" />
                <div className="h-4 bg-black/10 rounded w-40 mb-2" />
                <div className="h-3 bg-black/10 rounded w-28" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {allMembers.map((member, i) => toCard(member, i))}
          </div>
        )}
      </div>
    </div>
  );
}
