import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Search, Award, BookOpen, Clock, Download, ExternalLink } from 'lucide-react';
import { GlassCard } from '../../components/glass-card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { useCourseStore, type Enrollment, type Certificate } from '../../store/courseStore';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../utils/api';
import { cn } from '../../components/ui/utils';

type Tab = 'enrollments' | 'certificates';
type SortKey = 'recent' | 'progress' | 'title';

export function MyLearning() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const { enrollments, certificates, setEnrollments, setCertificates } = useCourseStore();
  const [tab, setTab] = useState<Tab>('enrollments');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    Promise.all([
      api.get<Enrollment[]>('/courses/my/enrollments'),
      api.get<Certificate[]>('/courses/my/certificates'),
    ]).then(([enrs, certs]) => {
      setEnrollments(enrs);
      setCertificates(certs);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [isAuthenticated]);

  const filteredEnrollments = useMemo(() => {
    let list = [...enrollments];
    if (search) list = list.filter((e) => e.course.title.toLowerCase().includes(search.toLowerCase()));
    if (filter !== 'all') list = list.filter((e) => e.status === filter);
    if (sort === 'recent') list.sort((a, b) => new Date(b.enrolled_at).getTime() - new Date(a.enrolled_at).getTime());
    if (sort === 'progress') list.sort((a, b) => b.progress_percent - a.progress_percent);
    if (sort === 'title') list.sort((a, b) => a.course.title.localeCompare(b.course.title));
    return list;
  }, [enrollments, search, sort, filter]);

  if (loading) return <div className="min-h-screen pt-24 flex items-center justify-center"><p className="text-black/40">Loading…</p></div>;

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-4xl mb-2">My Learning</h1>
          <p className="text-black/50 mb-8">Track your progress and access your certificates.</p>

          <div className="flex border-b border-black/10 mb-8">
            {(['enrollments', 'certificates'] as Tab[]).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={cn('px-6 py-3 text-sm capitalize transition-colors relative',
                  tab === t ? 'text-primary font-medium' : 'text-black/50 hover:text-black')}>
                {t}
                {tab === t && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
              </button>
            ))}
          </div>

          {tab === 'enrollments' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="text-xs text-black/50 mb-1 block">Sort by</label>
                  <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}
                    className="w-full border border-black/10 rounded-lg px-3 py-2 text-sm bg-white">
                    <option value="recent">Recently Enrolled</option>
                    <option value="progress">Progress</option>
                    <option value="title">Title A–Z</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-black/50 mb-1 block">Filter by</label>
                  <select value={filter} onChange={(e) => setFilter(e.target.value)}
                    className="w-full border border-black/10 rounded-lg px-3 py-2 text-sm bg-white">
                    <option value="all">All</option>
                    <option value="active">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-black/50 mb-1 block">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/30" />
                    <Input placeholder="Search..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
                  </div>
                </div>
              </div>

              {filteredEnrollments.length === 0 ? (
                <GlassCard className="p-12 text-center">
                  <BookOpen className="w-12 h-12 text-black/20 mx-auto mb-4" />
                  <p className="text-black/50 mb-4">No courses yet.</p>
                  <Button onClick={() => navigate('/courses')}>Browse Catalog</Button>
                </GlassCard>
              ) : (
                <div className="space-y-4">
                  {filteredEnrollments.map((enrollment) => (
                    <motion.div key={enrollment.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <GlassCard className="p-4">
                        <div className="flex items-center gap-4">
                          <div className="w-20 h-16 rounded-lg overflow-hidden bg-black/5 flex-shrink-0">
                            {enrollment.course.thumbnail_url && (
                              <img src={enrollment.course.thumbnail_url} alt={enrollment.course.title} className="w-full h-full object-cover" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h3 className="font-semibold truncate">{enrollment.course.title}</h3>
                                <span className={cn('text-xs capitalize px-2 py-0.5 rounded mt-1 inline-block',
                                  enrollment.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700')}>
                                  {enrollment.status === 'completed' ? '✓ Completed' : 'In Progress'}
                                </span>
                              </div>
                            </div>
                            <div className="mt-3">
                              <div className="flex justify-between text-xs text-black/40 mb-1">
                                <span>{enrollment.progress_percent}% complete</span>
                                {enrollment.course.estimated_hours && (
                                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{enrollment.course.estimated_hours}h</span>
                                )}
                              </div>
                              <div className="h-1.5 bg-black/10 rounded-full overflow-hidden">
                                <div className={cn('h-full rounded-full transition-all', enrollment.status === 'completed' ? 'bg-green-500' : 'bg-primary')}
                                  style={{ width: `${enrollment.progress_percent}%` }} />
                              </div>
                            </div>
                          </div>
                          <Button size="sm" variant={enrollment.status === 'completed' ? 'outline' : 'default'}
                            onClick={() => navigate(`/courses/${enrollment.course_id}/learn`)} className="flex-shrink-0">
                            {enrollment.status === 'completed' ? 'Review' : 'Continue'}
                          </Button>
                        </div>
                      </GlassCard>
                    </motion.div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'certificates' && (
            <>
              {certificates.length === 0 ? (
                <GlassCard className="p-12 text-center">
                  <Award className="w-12 h-12 text-black/20 mx-auto mb-4" />
                  <p className="text-black/50 mb-2">No certificates yet.</p>
                  <p className="text-sm text-black/40">Complete a course to earn your certificate.</p>
                </GlassCard>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {certificates.map((cert) => (
                    <motion.div key={cert.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                      <GlassCard className="p-6 border-2 border-amber-200">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                            <Award className="w-6 h-6 text-amber-600" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold mb-1">{cert.course.title}</h3>
                            <p className="text-xs text-black/40 mb-1">Certificate #{cert.certificate_number}</p>
                            <p className="text-xs text-black/40">
                              Issued {new Date(cert.issued_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <Button size="sm" variant="outline" className="flex-1"
                            onClick={() => navigate(`/courses/certificate/${cert.certificate_number}`)}>
                            <ExternalLink className="w-3 h-3 mr-1" /> View
                          </Button>
                          <Button size="sm" variant="outline" className="flex-1" onClick={() => window.print()}>
                            <Download className="w-3 h-3 mr-1" /> Download
                          </Button>
                        </div>
                      </GlassCard>
                    </motion.div>
                  ))}
                </div>
              )}
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
