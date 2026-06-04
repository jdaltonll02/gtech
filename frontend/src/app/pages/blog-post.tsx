import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import { motion } from 'motion/react';
import { Calendar, User, Tag, ArrowLeft } from 'lucide-react';
import { GlassCard } from '../components/glass-card';
import { api } from '../utils/api';

type Post = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
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

export function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    api.get<Post>(`/blog/${slug}`)
      .then(setPost)
      .catch(() => setPost(null))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <p className="text-black/40">Loading…</p>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen pt-24 flex flex-col items-center justify-center gap-4">
        <p className="text-2xl text-black/40">Post not found.</p>
        <Link to="/blog" className="text-primary hover:underline flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Back to News
        </Link>
      </div>
    );
  }

  const tags = post.tags ? post.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];

  return (
    <div className="min-h-screen pt-24 pb-20">
      {/* Cover image */}
      {post.cover_image_url && (
        <div className="relative h-80 sm:h-[420px] overflow-hidden mb-0">
          <img src={post.cover_image_url} alt={post.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-black/40 mt-8 mb-6">
            <Link to="/blog" className="hover:text-primary transition-colors flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> News
            </Link>
            {post.category && (
              <>
                <span>/</span>
                <span>{post.category}</span>
              </>
            )}
          </div>

          {/* Meta */}
          <div className="mb-2">
            {post.category && (
              <span className="inline-block bg-primary text-white text-xs uppercase tracking-wider px-3 py-1 rounded-full mb-4">
                {post.category}
              </span>
            )}
          </div>

          <h1 className="text-4xl sm:text-5xl leading-tight mb-6">{post.title}</h1>

          <div className="flex flex-wrap items-center gap-4 text-sm text-black/50 mb-8 pb-8 border-b border-black/10">
            <span className="flex items-center gap-1.5"><User className="w-4 h-4" />{post.author_name}</span>
            <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" />{formatDate(post.published_at || post.created_at)}</span>
            {tags.length > 0 && (
              <span className="flex items-center gap-1.5 flex-wrap">
                <Tag className="w-4 h-4" />
                {tags.map((t) => (
                  <span key={t} className="bg-black/5 px-2 py-0.5 rounded-full text-xs">{t}</span>
                ))}
              </span>
            )}
          </div>

          {/* Content */}
          <div
            className="prose prose-lg max-w-none
              prose-headings:font-semibold prose-headings:text-black
              prose-h1:text-4xl prose-h2:text-3xl prose-h3:text-2xl
              prose-p:text-black/75 prose-p:leading-relaxed
              prose-a:text-primary prose-a:no-underline hover:prose-a:underline
              prose-blockquote:border-l-primary prose-blockquote:text-black/60
              prose-code:bg-black/5 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
              prose-pre:bg-black/5 prose-pre:rounded-xl
              prose-img:rounded-xl prose-img:shadow-md
              prose-ul:list-disc prose-ol:list-decimal
              prose-li:text-black/75"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          {/* Footer */}
          <div className="mt-16 pt-8 border-t border-black/10 flex items-center justify-between">
            <Link to="/blog" className="flex items-center gap-1.5 text-primary hover:underline text-sm">
              <ArrowLeft className="w-4 h-4" /> All articles
            </Link>
            {tags.length > 0 && (
              <div className="flex gap-2">
                {tags.map((t) => (
                  <span key={t} className="bg-black/5 px-3 py-1 rounded-full text-xs text-black/50">{t}</span>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
