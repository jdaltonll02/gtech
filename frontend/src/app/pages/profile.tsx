import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  User, Lock, LayoutDashboard, BookOpen, Award, ShoppingBag,
  Save, ShieldCheck, ShieldOff, Clock, ChevronRight,
  CheckCircle, PlayCircle, XCircle, Search,
  Briefcase, GraduationCap, MapPin, Phone, Globe, Linkedin, Twitter, Github, FileText,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { GlassCard } from '../components/glass-card';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { useAuthStore } from '../store/authStore';
import { useCourseStore, type Enrollment } from '../store/courseStore';
import { api } from '../utils/api';
import { cn } from '../components/ui/utils';

type Tab = 'overview' | 'profile' | 'security' | 'courses';

interface UserResponse {
  id: string; email: string; full_name: string;
  role: string; is_active: boolean; is_verified: boolean; is_admin: boolean;
  bio?: string; headline?: string; job_title?: string; company?: string;
  school?: string; phone?: string; website?: string;
  city?: string; country?: string; address?: string;
  linkedin_url?: string; twitter_url?: string; github_url?: string;
}

type ProfileForm = {
  full_name: string; email: string;
  bio: string; headline: string;
  job_title: string; company: string; school: string;
  phone: string; website: string; city: string; country: string; address: string;
  linkedin_url: string; twitter_url: string; github_url: string;
};

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

  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>((searchParams.get('tab') as Tab) ?? 'overview');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [courseSearch, setCourseSearch] = useState('');

  const [profileForm, setProfileForm] = useState<ProfileForm>({
    full_name: '', email: '',
    bio: '', headline: '',
    job_title: '', company: '', school: '',
    phone: '', website: '', city: '', country: '', address: '',
    linkedin_url: '', twitter_url: '', github_url: '',
  });
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [originalEmail, setOriginalEmail] = useState('');
  const [emailChangePassword, setEmailChangePassword] = useState('');

  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [twoFaLoading, setTwoFaLoading] = useState(false);
  const [twoFaMsg, setTwoFaMsg] = useState('');

  const [badges, setBadges] = useState<{ id: string; badge_type: string; title: string; issued_at: string; course: { title: string } }[]>([]);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    Promise.all([
      api.get<Enrollment[]>('/courses/my/enrollments'),
      api.get<any[]>('/courses/my/certificates'),
      api.get<UserResponse>('/auth/me'),
      api.get<any[]>('/courses/my/badges').catch(() => []),
    ]).then(([enrs, certs, me, myBadges]) => {
      setEnrollments(enrs);
      setCertificates(certs);
      setBadges(myBadges);
      if (typeof me.two_factor_enabled === 'boolean') setTwoFaEnabled((me as any).two_factor_enabled);
      setOriginalEmail(me.email ?? '');
      setProfileForm({
        full_name: me.full_name ?? '',
        email: me.email ?? '',
        bio: me.bio ?? '',
        headline: me.headline ?? '',
        job_title: me.job_title ?? '',
        company: me.company ?? '',
        school: me.school ?? '',
        phone: me.phone ?? '',
        website: me.website ?? '',
        city: me.city ?? '',
        country: me.country ?? '',
        address: me.address ?? '',
        linkedin_url: me.linkedin_url ?? '',
        twitter_url: me.twitter_url ?? '',
        github_url: me.github_url ?? '',
      });
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

  const emailChanged = profileForm.email !== originalEmail;

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    if (emailChanged && !emailChangePassword) {
      setProfileMsg({ type: 'error', text: 'Enter your current password to change your email address.' });
      return;
    }
    setProfileLoading(true);
    try {
      const body: Record<string, unknown> = { ...profileForm };
      if (emailChanged) body.current_password = emailChangePassword;
      const updated = await api.patch<UserResponse>('/auth/me', body);
      const at = localStorage.getItem('access_token') ?? '';
      const rt = localStorage.getItem('refresh_token') ?? '';
      setAuth({ id: updated.id, email: updated.email, full_name: updated.full_name, is_admin: updated.is_admin }, at, rt);
      setOriginalEmail(updated.email);
      setEmailChangePassword('');
      setProfileMsg({
        type: 'success',
        text: emailChanged
          ? 'Profile updated. We sent a verification link to your new email address — you\'ll need to confirm it before your next sign-in.'
          : 'Profile updated successfully.',
      });
    } catch (err: any) {
      setProfileMsg({ type: 'error', text: err.message || 'Update failed.' });
    } finally {
      setProfileLoading(false);
    }
  };

  const setField = (field: keyof ProfileForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setProfileForm((p) => ({ ...p, [field]: e.target.value }));

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
      localStorage.setItem('password_changed', '1');
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

                      {/* Badges */}
                      {badges.length > 0 && (
                        <GlassCard className="p-5">
                          <h2 className="font-semibold mb-4">Badges</h2>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {badges.map((b) => (
                              <div key={b.id} className="flex flex-col items-center text-center gap-2 p-3 rounded-lg bg-black/[0.03]">
                                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center flex-shrink-0">
                                  <Award className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                  <p className="text-xs font-medium leading-tight">{b.title}</p>
                                  <p className="text-[10px] text-black/40 mt-0.5">{new Date(b.issued_at).toLocaleDateString()}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </GlassCard>
                      )}

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
                    <form onSubmit={handleProfileSubmit} className="space-y-5">

                      {/* Basic info */}
                      <GlassCard className="p-6">
                        <div className="flex items-center gap-2 mb-5">
                          <User className="w-4 h-4 text-primary" />
                          <h2 className="font-semibold">Basic Information</h2>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label htmlFor="full_name">Full Name *</Label>
                            <Input id="full_name" value={profileForm.full_name} onChange={setField('full_name')} required />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="email">Email Address *</Label>
                            <Input id="email" type="email" value={profileForm.email} onChange={setField('email')} required />
                          </div>
                        </div>
                        {emailChanged && (
                          <div className="mt-4 space-y-1.5">
                            <Label htmlFor="email_change_password">Current Password *</Label>
                            <Input
                              id="email_change_password"
                              type="password"
                              value={emailChangePassword}
                              onChange={(e) => setEmailChangePassword(e.target.value)}
                              required
                            />
                            <p className="text-xs text-black/40">Required to confirm this is you. You'll need to verify the new address before signing in again.</p>
                          </div>
                        )}
                        <div className="mt-4 space-y-1.5">
                          <Label htmlFor="headline">Headline</Label>
                          <Input id="headline" placeholder="e.g. Software Engineer · Lifelong Learner" value={profileForm.headline} onChange={setField('headline')} maxLength={120} />
                          <p className="text-xs text-black/40">A short tagline shown on your profile.</p>
                        </div>
                        <div className="mt-4 space-y-1.5">
                          <Label htmlFor="bio">About Me</Label>
                          <Textarea id="bio" placeholder="Tell people a bit about yourself…" rows={3} value={profileForm.bio} onChange={setField('bio')} maxLength={600} />
                          <p className="text-xs text-black/40">{profileForm.bio.length}/600</p>
                        </div>
                      </GlassCard>

                      {/* Work */}
                      <GlassCard className="p-6">
                        <div className="flex items-center gap-2 mb-5">
                          <Briefcase className="w-4 h-4 text-primary" />
                          <h2 className="font-semibold">Work</h2>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label htmlFor="job_title">Job Title</Label>
                            <Input id="job_title" placeholder="e.g. Software Engineer" value={profileForm.job_title} onChange={setField('job_title')} />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="company">Company / Organization</Label>
                            <Input id="company" placeholder="e.g. Google" value={profileForm.company} onChange={setField('company')} />
                          </div>
                        </div>
                      </GlassCard>

                      {/* Education */}
                      <GlassCard className="p-6">
                        <div className="flex items-center gap-2 mb-5">
                          <GraduationCap className="w-4 h-4 text-primary" />
                          <h2 className="font-semibold">Education</h2>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="school">School / Institution</Label>
                          <Input id="school" placeholder="e.g. Carnegie Mellon University" value={profileForm.school} onChange={setField('school')} />
                        </div>
                      </GlassCard>

                      {/* Location */}
                      <GlassCard className="p-6">
                        <div className="flex items-center gap-2 mb-5">
                          <MapPin className="w-4 h-4 text-primary" />
                          <h2 className="font-semibold">Location</h2>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label htmlFor="city">City</Label>
                            <Input id="city" placeholder="e.g. Pittsburgh" value={profileForm.city} onChange={setField('city')} />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="country">Country</Label>
                            <Input id="country" placeholder="e.g. United States" value={profileForm.country} onChange={setField('country')} />
                          </div>
                        </div>
                        <div className="mt-4 space-y-1.5">
                          <Label htmlFor="address">Street Address <span className="text-xs text-black/40">(private)</span></Label>
                          <Input id="address" placeholder="e.g. 123 Main St" value={profileForm.address} onChange={setField('address')} />
                        </div>
                      </GlassCard>

                      {/* Contact & Web */}
                      <GlassCard className="p-6">
                        <div className="flex items-center gap-2 mb-5">
                          <Phone className="w-4 h-4 text-primary" />
                          <h2 className="font-semibold">Contact & Web</h2>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label htmlFor="phone">Phone Number</Label>
                            <Input id="phone" type="tel" placeholder="+1 412 000 0000" value={profileForm.phone} onChange={setField('phone')} />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="website">Website</Label>
                            <div className="relative">
                              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-black/30" />
                              <Input id="website" type="url" placeholder="https://yoursite.com" className="pl-8" value={profileForm.website} onChange={setField('website')} />
                            </div>
                          </div>
                        </div>
                      </GlassCard>

                      {/* Social */}
                      <GlassCard className="p-6">
                        <div className="flex items-center gap-2 mb-5">
                          <FileText className="w-4 h-4 text-primary" />
                          <h2 className="font-semibold">Social Links</h2>
                        </div>
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <Label htmlFor="linkedin_url">LinkedIn</Label>
                            <div className="relative">
                              <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-black/30" />
                              <Input id="linkedin_url" type="url" placeholder="https://linkedin.com/in/yourname" className="pl-8" value={profileForm.linkedin_url} onChange={setField('linkedin_url')} />
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="twitter_url">X / Twitter</Label>
                            <div className="relative">
                              <Twitter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-black/30" />
                              <Input id="twitter_url" type="url" placeholder="https://x.com/yourhandle" className="pl-8" value={profileForm.twitter_url} onChange={setField('twitter_url')} />
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="github_url">GitHub</Label>
                            <div className="relative">
                              <Github className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-black/30" />
                              <Input id="github_url" type="url" placeholder="https://github.com/yourname" className="pl-8" value={profileForm.github_url} onChange={setField('github_url')} />
                            </div>
                          </div>
                        </div>
                      </GlassCard>

                      {profileMsg && (
                        <p className={cn('text-sm rounded-lg px-4 py-3', profileMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600')}>
                          {profileMsg.text}
                        </p>
                      )}
                      <Button type="submit" disabled={profileLoading} size="lg" className="w-full">
                        <Save className="w-4 h-4 mr-2" />
                        {profileLoading ? 'Saving…' : 'Save Changes'}
                      </Button>
                    </form>
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
