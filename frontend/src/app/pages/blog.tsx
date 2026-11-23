import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { Calendar, Tag, User, ArrowRight, Newspaper } from 'lucide-react';
import { GlassCard } from '../components/glass-card';
import { Button } from '../components/ui/button';
import { api } from '../utils/api';

type Post = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  author_name: string;
  category: string | null;
  tags: string | null;
  published_at: string | null;
  created_at: string;
};

function formatDate(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function Blog() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<string[]>('/blog/categories').then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const url = activeCategory ? `/blog?category=${encodeURIComponent(activeCategory)}` : '/blog';
    api.get<Post[]>(url)
      .then(setPosts)
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, [activeCategory]);

  const featured = posts[0];
  const rest = posts.slice(1);

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <p className="text-sm uppercase tracking-[0.22em] text-primary mb-3">G-Tech</p>
          <h1 className="text-5xl sm:text-6xl mb-4">News &amp; Insights</h1>
          <p className="text-xl text-black/60 mb-10 max-w-2xl">
            Research updates, announcements, and stories from across the G-Tech ecosystem.
          </p>

          {/* Category filter */}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-10">
              <button
                onClick={() => setActiveCategory(null)}
                className={`px-4 py-1.5 rounded-full text-sm transition-colors ${!activeCategory ? 'bg-primary text-white' : 'bg-black/5 text-black/60 hover:bg-black/10'}`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
                  className={`px-4 py-1.5 rounded-full text-sm transition-colors ${activeCategory === cat ? 'bg-primary text-white' : 'bg-black/5 text-black/60 hover:bg-black/10'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </motion.div>

        {loading && <p className="text-black/40 text-center py-20">Loading…</p>}

        {!loading && posts.length === 0 && (
          <div className="text-center py-24">
            <Newspaper className="w-12 h-12 text-black/20 mx-auto mb-4" />
            <p className="text-xl text-black/40">No posts yet. Check back soon.</p>
          </div>
        )}

        {!loading && featured && (
          <>
            {/* Featured post — hero style */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-12">
              <Link to={`/blog/${featured.slug}`} className="block group">
                <div className="relative rounded-[2rem] overflow-hidden border border-black/10 shadow-lg">
                  {featured.cover_image_url ? (
                    <img src={featured.cover_image_url} alt={featured.title} className="w-full h-[440px] object-cover group-hover:scale-[1.02] transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-[440px] bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center">
                      <Newspaper className="w-20 h-20 text-primary/20" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-8 sm:p-10">
                    {featured.category && (
                      <span className="inline-block bg-primary text-white text-xs uppercase tracking-wider px-3 py-1 rounded-full mb-4">
                        {featured.category}
                      </span>
                    )}
                    <h2 className="text-3xl sm:text-4xl text-white mb-3 group-hover:text-white/90 transition-colors leading-tight max-w-3xl">
                      {featured.title}
                    </h2>
                    {featured.excerpt && (
                      <p className="text-white/70 mb-4 max-w-2xl leading-relaxed line-clamp-2">{featured.excerpt}</p>
                    )}
                    <div className="flex items-center gap-4 text-white/50 text-sm">
                      <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" />{featured.author_name}</span>
                      <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{formatDate(featured.published_at || featured.created_at)}</span>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>

            {/* Grid */}
            {rest.length > 0 && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {rest.map((post, i) => (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.06 }}
                  >
                    <Link to={`/blog/${post.slug}`} className="block group h-full">
                      <GlassCard className="h-full flex flex-col overflow-hidden">
                        <div className="relative overflow-hidden h-48 bg-gradient-to-br from-primary/10 to-black/5 flex-shrink-0">
                          {post.cover_image_url ? (
                            <img src={post.cover_image_url} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-400" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Newspaper className="w-10 h-10 text-primary/20" />
                            </div>
                          )}
                          {post.category && (
                            <span className="absolute top-3 left-3 bg-primary text-white text-xs uppercase tracking-wider px-2.5 py-1 rounded-full">
                              {post.category}
                            </span>
                          )}
                        </div>
                        <div className="p-5 flex flex-col flex-1">
                          <h3 className="text-lg font-medium mb-2 group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                            {post.title}
                          </h3>
                          {post.excerpt && (
                            <p className="text-black/60 text-sm leading-relaxed line-clamp-3 mb-4 flex-1">{post.excerpt}</p>
                          )}
                          <div className="flex items-center justify-between text-xs text-black/40 mt-auto pt-3 border-t border-black/8">
                            <span className="flex items-center gap-1"><User className="w-3 h-3" />{post.author_name}</span>
                            <span>{formatDate(post.published_at || post.created_at)}</span>
                          </div>
                        </div>
                      </GlassCard>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
