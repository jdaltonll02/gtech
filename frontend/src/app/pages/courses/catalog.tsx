import { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router';
import { Search, Clock, BookOpen } from 'lucide-react';
import { GlassCard } from '../../components/glass-card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { useCourseStore, type Course } from '../../store/courseStore';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../utils/api';
import { cn } from '../../components/ui/utils';

const LEVEL_COLORS: Record<string, string> = {
  beginner: 'bg-green-100 text-green-700',
  intermediate: 'bg-blue-100 text-blue-700',
  advanced: 'bg-red-100 text-red-700',
};

export function CourseCatalog() {
  const navigate = useNavigate();
  const { isEnrolled, getCourseProgress, setCourses, courses } = useCourseStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Course[]>('/courses/')
      .then(setCourses)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return courses.filter((c) => {
      const matchSearch = c.title.toLowerCase().includes(search.toLowerCase()) ||
        (c.tags ?? '').toLowerCase().includes(search.toLowerCase());
      const matchLevel = levelFilter === 'all' || c.level === levelFilter;
      return matchSearch && matchLevel && c.is_published;
    });
  }, [courses, search, levelFilter]);

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="text-5xl mb-3">Course Catalog</h1>
          <p className="text-black/50 mb-10 text-lg">Learn AI, Robotics, and Machine Learning from real research.</p>

          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40" />
              <Input placeholder="Search courses or topics..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-2">
              {['all', 'beginner', 'intermediate', 'advanced'].map((l) => (
                <button key={l} onClick={() => setLevelFilter(l)}
                  className={cn('px-4 py-2 rounded-lg text-sm capitalize transition-colors',
                    levelFilter === l ? 'bg-primary text-white' : 'bg-black/5 hover:bg-black/10')}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {loading && <p className="text-center text-black/40 py-20">Loading courses…</p>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filtered.map((course, i) => {
              const enrolled = isAuthenticated && isEnrolled(course.id);
              const progress = isAuthenticated ? getCourseProgress(course.id) : 0;
              return (
                <motion.div key={course.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                  <GlassCard className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
                    onClick={() => navigate(`/courses/${course.id}`)}>
                    <div className="relative h-44 overflow-hidden bg-black/5">
                      {course.thumbnail_url && (
                        <img src={course.thumbnail_url} alt={course.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      )}
                      <div className="absolute top-3 left-3">
                        <span className={cn('px-2 py-1 rounded text-xs font-medium capitalize', LEVEL_COLORS[course.level])}>
                          {course.level}
                        </span>
                      </div>
                      <div className="absolute top-3 right-3">
                        {course.is_free
                          ? <span className="px-2 py-1 rounded text-xs font-medium bg-green-500 text-white">Free</span>
                          : <span className="px-2 py-1 rounded text-xs font-medium bg-black/70 text-white">${course.price}</span>
                        }
                      </div>
                    </div>

                    <div className="p-5">
                      <h3 className="text-lg font-semibold mb-1 line-clamp-2">{course.title}</h3>
                      <p className="text-sm text-black/50 mb-3 line-clamp-2">{course.short_description}</p>

                      <div className="flex items-center gap-4 text-xs text-black/40 mb-4">
                        {course.estimated_hours && (
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{course.estimated_hours}h</span>
                        )}
                        {course.instructor_name && (
                          <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{course.instructor_name}</span>
                        )}
                      </div>

                      {course.tags && (
                        <div className="flex flex-wrap gap-1 mb-4">
                          {course.tags.split(',').slice(0, 3).map((t) => (
                            <span key={t} className="px-2 py-0.5 text-xs bg-black/5 rounded">{t.trim()}</span>
                          ))}
                        </div>
                      )}

                      {enrolled && (
                        <div className="mb-3">
                          <div className="flex justify-between text-xs text-black/50 mb-1">
                            <span>Progress</span><span>{progress}%</span>
                          </div>
                          <div className="h-1.5 bg-black/10 rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                      )}

                      <Button className="w-full" variant={enrolled ? 'outline' : 'default'}
                        onClick={(e) => { e.stopPropagation(); navigate(`/courses/${course.id}`); }}>
                        {enrolled ? 'Continue Learning' : 'View Course'}
                      </Button>
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })}
          </div>

          {!loading && filtered.length === 0 && (
            <p className="text-center text-black/40 py-20">No courses found.</p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
