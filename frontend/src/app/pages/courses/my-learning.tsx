import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import {
  Search, Award, BookOpen, Clock, Download, ExternalLink,
  TrendingUp, CheckCircle, Play, BarChart2, Filter, SortAsc,
  GraduationCap, Zap, Star,
} from 'lucide-react';
import { GlassCard } from '../../components/glass-card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { useCourseStore, type Enrollment, type Certificate, type Badge } from '../../store/courseStore';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../utils/api';
import { cn } from '../../components/ui/utils';

type Tab = 'all' | 'inprogress' | 'completed' | 'certificates' | 'badges';
type SortKey = 'recent' | 'progress' | 'title';

function ProgressRing({ percent, size = 48, stroke = 4 }: { percent: number; size?: number; stroke?: number }) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={percent >= 100 ? '#22c55e' : '#8B0000'}
        strokeWidth={stroke}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
      />
    </svg>
  );
}

function StatCard({ icon: Icon, label, value, color = 'text-primary' }: {
  icon: React.ElementType; label: string; value: number | string; color?: string;
}) {
  return (
    <GlassCard className="p-5 flex items-center gap-4">
      <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center bg-current/10', color)}>
        <Icon className={cn('w-5 h-5', color)} style={{ opacity: 1 }} />
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-black/50">{label}</p>
      </div>
    </GlassCard>
  );
}

function ContinueLearningCard({ enrollment }: { enrollment: Enrollment }) {
  const navigate = useNavigate();
  const { getEnrollment } = useCourseStore();
  const stored = getEnrollment(enrollment.course_id);
  const resumeId = stored?.last_accessed_lesson_id;

  return (
    <GlassCard className="overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        <div className="sm:w-56 h-36 sm:h-auto bg-black/5 flex-shrink-0 relative overflow-hidden">
          {enrollment.course.thumbnail_url ? (
            <img src={enrollment.course.thumbnail_url} alt={enrollment.course.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen className="w-10 h-10 text-black/20" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/20" />
          <div className="absolute bottom-2 left-2">
            <span className="text-xs bg-black/60 text-white px-2 py-0.5 rounded capitalize">{enrollment.course.level}</span>
          </div>
        </div>
        <div className="flex-1 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-primary font-medium uppercase tracking-wide mb-1">Continue Learning</p>
                <h3 className="text-xl font-semibold mb-1">{enrollment.course.title}</h3>
                {enrollment.course.instructor_name && (
                  <p className="text-sm text-black/50">by {enrollment.course.instructor_name}</p>
                )}
              </div>
              <div className="flex-shrink-0 text-center">
                <ProgressRing percent={enrollment.progress_percent} size={52} stroke={4} />
                <p className="text-xs text-black/50 mt-1">{enrollment.progress_percent}%</p>
              </div>
            </div>
            <div className="mt-3">
              <div className="h-1.5 bg-black/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${enrollment.progress_percent}%` }}
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <Button
              onClick={() => navigate(resumeId ? `/courses/${enrollment.course_id}/learn/${resumeId}` : `/courses/${enrollment.course_id}/learn`)}
              className="flex items-center gap-2"
            >
              <Play className="w-4 h-4" /> Resume Course
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(`/courses/${enrollment.course_id}`)}>
              Course Details
            </Button>
            {enrollment.course.estimated_hours && (
              <span className="text-xs text-black/40 flex items-center gap-1 ml-auto">
                <Clock className="w-3.5 h-3.5" /> {enrollment.course.estimated_hours}h total
              </span>
            )}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

function CourseCard({ enrollment }: { enrollment: Enrollment }) {
  const navigate = useNavigate();
  const { getEnrollment } = useCourseStore();
  const stored = getEnrollment(enrollment.course_id);
  const resumeId = stored?.last_accessed_lesson_id;
  const done = enrollment.status === 'completed';

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <GlassCard className="overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow">
        {/* Thumbnail */}
        <div className="relative h-40 bg-black/5 flex-shrink-0">
          {enrollment.course.thumbnail_url ? (
            <img src={enrollment.course.thumbnail_url} alt={enrollment.course.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen className="w-10 h-10 text-black/15" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute bottom-2 left-2 flex gap-1.5">
            <span className="text-xs bg-white/90 text-black/70 px-2 py-0.5 rounded capitalize font-medium">{enrollment.course.level}</span>
            {done && <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded font-medium">✓ Completed</span>}
          </div>
          {!done && (
            <div className="absolute top-2 right-2">
              <div className="relative">
                <ProgressRing percent={enrollment.progress_percent} size={36} stroke={3} />
                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white">
                  {enrollment.progress_percent}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col flex-1">
          <h3 className="font-semibold text-sm leading-snug mb-1 line-clamp-2">{enrollment.course.title}</h3>
          {enrollment.course.instructor_name && (
            <p className="text-xs text-black/45 mb-3">by {enrollment.course.instructor_name}</p>
          )}

          {/* Progress bar */}
          <div className="mt-auto">
            <div className="flex justify-between text-xs text-black/40 mb-1">
              <span>{done ? 'Completed' : `${enrollment.progress_percent}% complete`}</span>
              {enrollment.course.estimated_hours && (
                <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{enrollment.course.estimated_hours}h</span>
              )}
            </div>
            <div className="h-1.5 bg-black/10 rounded-full overflow-hidden mb-3">
              <div
                className={cn('h-full rounded-full transition-all', done ? 'bg-green-500' : 'bg-primary')}
                style={{ width: `${enrollment.progress_percent}%` }}
              />
            </div>
            <Button
              size="sm"
              variant={done ? 'outline' : 'default'}
              className="w-full"
              onClick={() => navigate(done
                ? `/courses/${enrollment.course_id}`
                : (resumeId ? `/courses/${enrollment.course_id}/learn/${resumeId}` : `/courses/${enrollment.course_id}/learn`)
              )}
            >
              {done ? 'Review Course' : 'Continue'}
            </Button>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}

function BadgeCard({ badge }: { badge: Badge }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
      <GlassCard className="p-6 border border-green-200 bg-gradient-to-br from-green-50/50 to-white flex flex-col gap-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center flex-shrink-0">
            <CheckCircle className="w-7 h-7 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm leading-snug mb-1">{badge.title}</h3>
            <p className="text-xs text-black/40 capitalize mb-0.5">{badge.badge_type.replace('_', ' ')}</p>
            <p className="text-xs text-black/40">
              Earned {new Date(badge.issued_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}

function CertificateCard({ cert }: { cert: Certificate }) {
  const navigate = useNavigate();
  return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
      <GlassCard className="p-6 border border-amber-200 bg-gradient-to-br from-amber-50/50 to-white flex flex-col gap-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Award className="w-7 h-7 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm leading-snug mb-1">{cert.course.title}</h3>
            <p className="text-xs text-black/40 font-mono mb-0.5">#{cert.certificate_number}</p>
            <p className="text-xs text-black/40">
              Issued {new Date(cert.issued_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => navigate(`/courses/certificate/${cert.certificate_number}`)}>
            <ExternalLink className="w-3.5 h-3.5" /> View
          </Button>
          <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => {
            navigate(`/courses/certificate/${cert.certificate_number}`);
            setTimeout(() => window.print(), 500);
          }}>
            <Download className="w-3.5 h-3.5" /> Download
          </Button>
        </div>
      </GlassCard>
    </motion.div>
  );
}

export function MyLearning() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const user = useAuthStore((s) => s.user);
  const { enrollments, certificates, badges, setEnrollments, setCertificates, setBadges } = useCourseStore();
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    Promise.all([
      api.get<Enrollment[]>('/courses/my/enrollments'),
      api.get<Certificate[]>('/courses/my/certificates'),
      api.get<Badge[]>('/courses/my/badges'),
    ]).then(([enrs, certs, bdgs]) => {
      setEnrollments(enrs);
      setCertificates(certs);
      setBadges(bdgs);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [isAuthenticated]);

  // Stats
  const inProgressCount = enrollments.filter((e) => e.status === 'active' && e.progress_percent > 0).length;
  const completedCount = enrollments.filter((e) => e.status === 'completed').length;
  const totalHours = Math.round(enrollments.reduce((sum, e) => sum + (e.course.estimated_hours ?? 0), 0));
  const avgProgress = enrollments.length
    ? Math.round(enrollments.reduce((s, e) => s + e.progress_percent, 0) / enrollments.length)
    : 0;

  // Most recently enrolled active course for "Continue Learning"
  const continueCourse = useMemo(() => {
    return [...enrollments]
      .filter((e) => e.status !== 'completed')
      .sort((a, b) => new Date(b.enrolled_at).getTime() - new Date(a.enrolled_at).getTime())[0] ?? null;
  }, [enrollments]);

  const filteredEnrollments = useMemo(() => {
    let list = [...enrollments];
    if (tab === 'inprogress') list = list.filter((e) => e.status !== 'completed');
    if (tab === 'completed') list = list.filter((e) => e.status === 'completed');
    if (search) list = list.filter((e) => e.course.title.toLowerCase().includes(search.toLowerCase()));
    if (sort === 'recent') list.sort((a, b) => new Date(b.enrolled_at).getTime() - new Date(a.enrolled_at).getTime());
    if (sort === 'progress') list.sort((a, b) => b.progress_percent - a.progress_percent);
    if (sort === 'title') list.sort((a, b) => a.course.title.localeCompare(b.course.title));
    return list;
  }, [enrollments, tab, search, sort]);

  if (loading) return (
    <div className="min-h-screen pt-24 flex items-center justify-center">
      <p className="text-black/40">Loading your learning dashboard…</p>
    </div>
  );

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: 'all', label: 'All Courses', count: enrollments.length },
    { id: 'inprogress', label: 'In Progress', count: enrollments.filter((e) => e.status !== 'completed').length },
    { id: 'completed', label: 'Completed', count: completedCount },
    { id: 'certificates', label: 'Certificates', count: certificates.length },
    { id: 'badges', label: 'Badges', count: badges.length },
  ];

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

          {/* ── Header ── */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <h1 className="text-4xl mb-1">My Learning</h1>
              <p className="text-black/50">
                {user?.full_name ? `Welcome back, ${user.full_name.split(' ')[0]}!` : 'Welcome back!'}{' '}
                {enrollments.length > 0
                  ? `You're ${avgProgress}% through your learning journey.`
                  : 'Start your learning journey today.'}
              </p>
            </div>
            <Button onClick={() => navigate('/courses')} className="flex-shrink-0 hidden sm:flex items-center gap-2">
              <Search className="w-4 h-4" /> Browse Catalog
            </Button>
          </div>

          {/* ── Stats ── */}
          {enrollments.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard icon={BookOpen} label="Total Enrolled" value={enrollments.length} color="text-blue-600" />
              <StatCard icon={TrendingUp} label="In Progress" value={inProgressCount} color="text-primary" />
              <StatCard icon={CheckCircle} label="Completed" value={completedCount} color="text-green-600" />
              <StatCard icon={Award} label="Certificates" value={certificates.length} color="text-amber-500" />
            </div>
          )}

          {/* ── Continue Learning ── */}
          {continueCourse && tab === 'all' && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-primary" />
                <h2 className="text-lg font-semibold">Pick up where you left off</h2>
              </div>
              <ContinueLearningCard enrollment={continueCourse} />
            </div>
          )}

          {/* ── Tabs ── */}
          <div className="flex gap-1 border-b border-black/10 mb-6 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-3 text-sm whitespace-nowrap transition-colors relative flex-shrink-0',
                  tab === t.id ? 'text-primary font-medium' : 'text-black/50 hover:text-black',
                )}
              >
                {t.label}
                {t.count !== undefined && t.count > 0 && (
                  <span className={cn(
                    'text-xs px-1.5 py-0.5 rounded-full',
                    tab === t.id ? 'bg-primary/10 text-primary' : 'bg-black/5 text-black/40',
                  )}>
                    {t.count}
                  </span>
                )}
                {tab === t.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
              </button>
            ))}
          </div>

          {/* ── Course tabs ── */}
          {tab !== 'certificates' && tab !== 'badges' && (
            <>
              {/* Search + Sort */}
              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/30" />
                  <Input placeholder="Search your courses…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <div className="flex items-center gap-2 sm:flex-shrink-0">
                  <SortAsc className="w-4 h-4 text-black/30 flex-shrink-0" />
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortKey)}
                    className="border border-black/10 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="recent">Recently Enrolled</option>
                    <option value="progress">By Progress</option>
                    <option value="title">Title A–Z</option>
                  </select>
                </div>
              </div>

              {filteredEnrollments.length === 0 ? (
                <GlassCard className="p-16 text-center">
                  <GraduationCap className="w-14 h-14 text-black/15 mx-auto mb-4" />
                  <p className="text-lg font-medium text-black/40 mb-2">No courses found</p>
                  <p className="text-sm text-black/30 mb-6">
                    {enrollments.length === 0
                      ? "You haven't enrolled in any courses yet."
                      : 'No courses match your current filter.'}
                  </p>
                  <Button onClick={() => navigate('/courses')}>Browse Catalog</Button>
                </GlassCard>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredEnrollments.map((enrollment) => (
                    <CourseCard key={enrollment.id} enrollment={enrollment} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Certificates tab ── */}
          {tab === 'certificates' && (
            <>
              {certificates.length === 0 ? (
                <GlassCard className="p-16 text-center">
                  <Award className="w-14 h-14 text-black/15 mx-auto mb-4" />
                  <p className="text-lg font-medium text-black/40 mb-2">No certificates yet</p>
                  <p className="text-sm text-black/30 mb-6">Complete a course to earn your certificate of completion.</p>
                  <Button onClick={() => navigate('/courses')}>Browse Catalog</Button>
                </GlassCard>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <Star className="w-4 h-4 text-amber-500" />
                    <p className="text-sm text-amber-700">
                      You've earned <strong>{certificates.length}</strong> certificate{certificates.length !== 1 ? 's' : ''}. Keep going!
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {certificates.map((cert) => (
                      <CertificateCard key={cert.id} cert={cert} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
          {/* ── Badges tab ── */}
          {tab === 'badges' && (
            <>
              {badges.length === 0 ? (
                <GlassCard className="p-16 text-center">
                  <CheckCircle className="w-14 h-14 text-black/15 mx-auto mb-4" />
                  <p className="text-lg font-medium text-black/40 mb-2">No badges yet</p>
                  <p className="text-sm text-black/30 mb-6">Complete a course to earn your first achievement badge.</p>
                  <Button onClick={() => navigate('/courses')}>Browse Catalog</Button>
                </GlassCard>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-4 p-4 bg-green-50 border border-green-200 rounded-xl">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <p className="text-sm text-green-700">
                      You've earned <strong>{badges.length}</strong> badge{badges.length !== 1 ? 's' : ''}. Keep learning!
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {badges.map((badge) => (
                      <BadgeCard key={badge.id} badge={badge} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
