import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  User, Lock, LayoutDashboard, BookOpen, Award, ShoppingBag,
  Save, ShieldCheck, ShieldOff, Clock, ChevronRight,
  CheckCircle, PlayCircle, XCircle, Search,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { GlassCard } from '../components/glass-card';
import { Switch } from '../components/ui/switch';
import { useAuthStore } from '../store/authStore';
import { useCourseStore, type Enrollment } from '../store/courseStore';
import { api } from '../utils/api';
import { cn } from '../components/ui/utils';

type Tab = 'overview' | 'profile' | 'security' | 'courses';

interface UserResponse {
  id: string; email: string; full_name: string;
  role: string; is_active: boolean; is_verified: boolean; is_admin: boolean;
}

const STATUS_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  completed: { label: 'Completed',  color: 'bg-green-100 text-green-700',  icon: CheckCircle },
  active:    { label: 'In Progress', color: 'bg-blue-100  text-blue-700',   icon: PlayCircle  },
  dropped:   { label: 'Dropped',    color: 'bg-gray-100  text-gray-500',   icon: XCircle     },
};

// ── Stat chip ──────────────────────────────────────────────────────────────────
function Stat({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) {
  return (
    <GlassCard className="p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div>
        <p className="text-xl font-bold leading-none">{value}</p>
        <p className="text-xs text-black/50 mt-0.5">{label}</p>
      </div>
    </GlassCard>
  );
}

// ── Course row ─────────────────────────────────────────────────────────────────
function CourseRow({ enrollment }: { enrollment: Enrollment }) {
  const navigate = useNavigate();
  const meta = STATUS_META[enrollment.status] ?? STATUS_META.active;
  const Icon = meta.icon;
  return (
    <GlassCard className="p-4 hover:border-primary/30 transition-colors">
      <div className="flex items-center gap-4">
        <div className="w-16 h-12 rounded-lg overflow-hidden bg-black/5 flex-shrink-0">
          {enrollment.course.thumbnail_url
            ? <img src={enrollment.course.thumbnail_url} alt={enrollment.course.title} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center"><BookOpen className="w-5 h-5 text-black/20" /></div>
          }
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-medium truncate text-sm">{enrollment.course.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium', meta.color)}>
              <Icon className="w-3 h-3" /> {meta.label}
            </span>
            {enrollment.course.estimated_hours && (
              <span className="text-xs text-black/40 flex items-center gap-1">
                <Clock className="w-3 h-3" />{enrollment.course.estimated_hours}h
              </span>
            )}
          </div>
          {enrollment.status !== 'dropped' && (
            <div className="mt-2 h-1.5 bg-black/10 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', enrollment.status === 'completed' ? 'bg-green-500' : 'bg-primary')}
                style={{ width: `${enrollment.progress_percent}%` }}
              />
            </div>
          )}
        </div>

        <div className="flex-shrink-0 text-right">
          {enrollment.status !== 'dropped' && (
            <p className="text-xs text-black/40 mb-1">{Math.round(enrollment.progress_percent)}%</p>
          )}
          <Button
            size="sm" variant={enrollment.status === 'completed' ? 'outline' : 'default'}
            onClick={() => navigate(`/courses/${enrollment.course_id}/learn`)}
            className="text-xs"
          >
            {enrollment.status === 'completed' ? 'Review' : 'Continue'}
          </Button>
        </div>
      </div>
    </GlassCard>
  );
}

// ── Main dashboard ─────────────────────────────────────────────────────────────
export function Profile() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);

  const { enrollments, certificates, setEnrollments, setCertificates } = useCourseStore();

  const [tab, setTab] = useState<Tab>('overview');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [courseSearch, setCourseSearch] = useState('');

  const [profileForm, setProfileForm] = useState({ full_name: '', email: '' });
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' });

  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [twoFaLoading, setTwoFaLoading] = useState(false);
  const [twoFaMsg, setTwoFaMsg] = useState('');

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    setProfileForm({ full_name: user.full_name, email: user.email });
    Promise.all([
      api.get<Enrollment[]>('/courses/my/enrollments'),
      api.get<any[]>('/courses/my/certificates'),
      api.get<any>('/auth/me'),
    ]).then(([enrs, certs, me]) => {
      setEnrollments(enrs);
      setCertificates(certs);
      if (typeof me.two_factor_enabled === 'boolean') setTwoFaEnabled(me.two_factor_enabled);
    }).catch(() => {});
  }, []);

  const filteredCourses = useMemo(() => {
    let list = [...enrollments];
    if (courseFilter !== 'all') list = list.filter((e) => e.status === courseFilter);
    if (courseSearch) list = list.filter((e) => e.course.title.toLowerCase().includes(courseSearch.toLowerCase()));
    return list.sort((a, b) => new Date(b.enrolled_at).getTime() - new Date(a.enrolled_at).getTime());
  }, [enrollments, courseFilter, courseSearch]);

  const stats = useMemo(() => ({
    total:     enrollments.length,
    active:    enrollments.filter((e) => e.status === 'active').length,
    completed: enrollments.filter((e) => e.status === 'completed').length,
    certs:     certificates.length,
  }), [enrollments, certificates]);

  if (!user) return null;

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    setProfileLoading(true);
    try {
      const updated = await api.patch<UserResponse>('/auth/me', profileForm);
      const at = localStorage.getItem('access_token') ?? '';
      const rt = localStorage.getItem('refresh_token') ?? '';
      setAuth({ id: updated.id, email: updated.email, full_name: updated.full_name, is_admin: updated.is_admin }, at, rt);
      setProfileMsg({ type: 'success', text: 'Profile updated successfully.' });
    } catch (err: any) {
      setProfileMsg({ type: 'error', text: err.message || 'Update failed.' });
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    setPasswordLoading(true);
    try {
      await api.patch('/auth/me', { current_password: passwordForm.current_password, new_password: passwordForm.new_password });
      setPasswordMsg({ type: 'success', text: 'Password changed successfully.' });
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err: any) {
      setPasswordMsg({ type: 'error', text: err.message || 'Password change failed.' });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleToggle2fa = async () => {
    setTwoFaLoading(true); setTwoFaMsg('');
    try {
      const res = await api.post<{ message: string }>(twoFaEnabled ? '/auth/2fa/disable' : '/auth/2fa/enable', {});
      setTwoFaEnabled((v) => !v);
      setTwoFaMsg(res.message);
    } catch (err: any) {
      setTwoFaMsg(err.message || 'Failed to update 2FA.');
    } finally {
      setTwoFaLoading(false);
    }
  };

  const NAV: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview',  icon: LayoutDashboard },
    { id: 'profile',  label: 'Profile',   icon: User            },
    { id: 'security', label: 'Security',  icon: Lock            },
    { id: 'courses',  label: 'My Courses', icon: BookOpen       },
  ];

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>

          {/* ── Header ── */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
              {user.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{user.full_name}</h1>
              <p className="text-black/50 text-sm">{user.email}</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-6">

            {/* ── Sidebar nav ── */}
            <nav className="md:w-48 flex-shrink-0">
              <GlassCard className="p-2">
                {NAV.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors text-left',
                      tab === id ? 'bg-primary text-white font-medium' : 'text-black/60 hover:bg-black/5 hover:text-black',
                    )}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {label}
                  </button>
                ))}
              </GlassCard>
            </nav>

            {/* ── Content ── */}
            <div className="flex-1 min-w-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.18 }}
                >

                  {/* ── Overview ── */}
                  {tab === 'overview' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <Stat label="Enrolled"  value={stats.total}     icon={BookOpen}  />
                        <Stat label="In Progress" value={stats.active}  icon={PlayCircle} />
                        <Stat label="Completed" value={stats.completed} icon={CheckCircle} />
                        <Stat label="Certificates" value={stats.certs}  icon={Award}     />
                      </div>

                      {/* Recent courses */}
                      <GlassCard className="p-5">
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="font-semibold">Recent Courses</h2>
                          <button onClick={() => setTab('courses')} className="text-xs text-primary flex items-center gap-1 hover:underline">
                            View all <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                        {enrollments.length === 0 ? (
                          <div className="text-center py-8">
                            <BookOpen className="w-8 h-8 text-black/20 mx-auto mb-2" />
                            <p className="text-sm text-black/40 mb-3">No courses yet.</p>
                            <Button size="sm" onClick={() => navigate('/courses')}>Browse Catalog</Button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {enrollments.slice(0, 3).map((e) => <CourseRow key={e.id} enrollment={e} />)}
                          </div>
                        )}
                      </GlassCard>

                      {/* Quick links */}
                      <div className="grid grid-cols-2 gap-3">
                        <GlassCard className="p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <ShoppingBag className="w-4 h-4 text-primary" />
                            <h3 className="font-medium text-sm">Orders</h3>
                          </div>
                          <Link to="/store/orders">
                            <Button variant="outline" size="sm" className="w-full text-xs">View Orders</Button>
                          </Link>
                        </GlassCard>
                        <GlassCard className="p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Award className="w-4 h-4 text-primary" />
                            <h3 className="font-medium text-sm">Certificates</h3>
                          </div>
                          <Link to="/courses/my-learning">
                            <Button variant="outline" size="sm" className="w-full text-xs">View All</Button>
                          </Link>
                        </GlassCard>
                      </div>
                    </div>
                  )}

                  {/* ── Profile ── */}
                  {tab === 'profile' && (
                    <GlassCard className="p-6">
                      <div className="flex items-center gap-2 mb-5">
                        <User className="w-5 h-5 text-primary" />
                        <h2 className="text-lg font-semibold">Profile Information</h2>
                      </div>
                      <form onSubmit={handleProfileSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="full_name">Full Name</Label>
                          <Input
                            id="full_name"
                            value={profileForm.full_name}
                            onChange={(e) => setProfileForm((p) => ({ ...p, full_name: e.target.value }))}
                            required
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="email">Email Address</Label>
                          <Input
                            id="email" type="email"
                            value={profileForm.email}
                            onChange={(e) => setProfileForm((p) => ({ ...p, email: e.target.value }))}
                            required
                          />
                        </div>
                        {profileMsg && (
                          <p className={cn('text-sm rounded p-2', profileMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600')}>
                            {profileMsg.text}
                          </p>
                        )}
                        <Button type="submit" disabled={profileLoading} className="w-full">
                          <Save className="w-4 h-4 mr-2" />
                          {profileLoading ? 'Saving…' : 'Save Changes'}
                        </Button>
                      </form>
                    </GlassCard>
                  )}

                  {/* ── Security ── */}
                  {tab === 'security' && (
                    <div className="space-y-5">
                      <GlassCard className="p-6">
                        <div className="flex items-center gap-2 mb-5">
                          <Lock className="w-5 h-5 text-primary" />
                          <h2 className="text-lg font-semibold">Change Password</h2>
                        </div>
                        <form onSubmit={handlePasswordSubmit} className="space-y-4">
                          {(['current_password', 'new_password', 'confirm_password'] as const).map((field) => (
                            <div key={field} className="space-y-1.5">
                              <Label htmlFor={field}>
                                {{ current_password: 'Current Password', new_password: 'New Password', confirm_password: 'Confirm New Password' }[field]}
                              </Label>
                              <Input
                                id={field} type="password"
                                value={passwordForm[field]}
                                onChange={(e) => setPasswordForm((p) => ({ ...p, [field]: e.target.value }))}
                                required
                              />
                            </div>
                          ))}
                          {passwordMsg && (
                            <p className={cn('text-sm rounded p-2', passwordMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600')}>
                              {passwordMsg.text}
                            </p>
                          )}
                          <Button type="submit" disabled={passwordLoading} className="w-full">
                            <Lock className="w-4 h-4 mr-2" />
                            {passwordLoading ? 'Updating…' : 'Update Password'}
                          </Button>
                        </form>
                      </GlassCard>

                      <GlassCard className="p-6">
                        <div className="flex items-start gap-3">
                          {twoFaEnabled
                            ? <ShieldCheck className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                            : <ShieldOff className="w-5 h-5 text-black/40 mt-0.5 flex-shrink-0" />
                          }
                          <div className="flex-1">
                            <h2 className="text-lg font-semibold">Two-Factor Authentication</h2>
                            <p className="text-sm text-black/50">
                              {twoFaEnabled
                                ? 'Enabled — a code will be emailed to you on each sign-in.'
                                : 'Disabled — enable for an extra layer of account security.'}
                            </p>
                            {twoFaMsg && (
                              <p className={cn('text-sm rounded p-2 mt-3', twoFaEnabled ? 'bg-green-50 text-green-700' : 'bg-black/5 text-black/60')}>
                                {twoFaMsg}
                              </p>
                            )}
                          </div>
                          <Switch checked={twoFaEnabled} onCheckedChange={handleToggle2fa} disabled={twoFaLoading} />
                        </div>
                      </GlassCard>
                    </div>
                  )}

                  {/* ── My Courses ── */}
                  {tab === 'courses' && (
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row gap-3">
                        {/* Status filter pills */}
                        <div className="flex gap-2 flex-wrap">
                          {[
                            { value: 'all',       label: 'All'         },
                            { value: 'active',    label: 'In Progress' },
                            { value: 'completed', label: 'Completed'   },
                            { value: 'dropped',   label: 'Dropped'     },
                          ].map(({ value, label }) => (
                            <button
                              key={value}
                              onClick={() => setCourseFilter(value)}
                              className={cn(
                                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                                courseFilter === value
                                  ? 'bg-primary text-white border-primary'
                                  : 'bg-white border-black/10 text-black/60 hover:border-primary/40',
                              )}
                            >
                              {label}
                              <span className="ml-1.5 opacity-60">
                                {value === 'all' ? enrollments.length : enrollments.filter((e) => e.status === value).length}
                              </span>
                            </button>
                          ))}
                        </div>

                        {/* Search */}
                        <div className="relative sm:ml-auto sm:w-52">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-black/30" />
                          <Input
                            placeholder="Search courses…"
                            className="pl-8 h-8 text-xs"
                            value={courseSearch}
                            onChange={(e) => setCourseSearch(e.target.value)}
                          />
                        </div>
                      </div>

                      {filteredCourses.length === 0 ? (
                        <GlassCard className="p-12 text-center">
                          <BookOpen className="w-10 h-10 text-black/20 mx-auto mb-3" />
                          <p className="text-black/50 text-sm mb-4">
                            {enrollments.length === 0 ? 'No courses yet.' : 'No courses match your filter.'}
                          </p>
                          {enrollments.length === 0 && (
                            <Button size="sm" onClick={() => navigate('/courses')}>Browse Catalog</Button>
                          )}
                        </GlassCard>
                      ) : (
                        <div className="space-y-3">
                          {filteredCourses.map((e) => <CourseRow key={e.id} enrollment={e} />)}
                        </div>
                      )}
                    </div>
                  )}

                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
