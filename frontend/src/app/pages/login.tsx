import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { GlassCard } from '../components/glass-card';
import { Checkbox } from '../components/ui/checkbox';
import { useAuthStore } from '../store/authStore';
import { api } from '../utils/api';

export function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const justRegistered = searchParams.get('registered') === '1';
  const redirectTo = searchParams.get('redirect') || '/';
  const setAuth = useAuthStore((s) => s.setAuth);

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 2FA state
  const [twoFaState, setTwoFaState] = useState<{ userId: string; hint: string } | null>(null);
  const [otp, setOtp] = useState('');
  const [resending, setResending] = useState(false);

  // Handle Google OAuth redirect — backend sends a short-lived state key, exchange it for tokens
  useState(() => {
    const oauthState = searchParams.get('oauth_state');
    if (!oauthState) return;
    api.get<{ access_token: string; refresh_token: string }>(`/auth/oauth-token?state=${oauthState}`)
      .then(({ access_token, refresh_token }) => {
        localStorage.setItem('access_token', access_token);
        localStorage.setItem('refresh_token', refresh_token);
        return api.get<{ id: string; email: string; full_name: string; is_admin: boolean }>('/auth/me')
          .then(me => {
            setAuth(me, access_token, refresh_token);
            navigate(redirectTo, { replace: true });
          });
      })
      .catch(() => setError('Google sign-in failed. Please try again.'));
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.id]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.post<any>('/auth/login', { email: form.email, password: form.password });

      if (data.requires_2fa) {
        setTwoFaState({ userId: data.user_id, hint: data.hint });
        return;
      }

      localStorage.setItem('access_token', data.access_token);
      const me = await api.get<{ id: string; email: string; full_name: string; is_admin: boolean }>('/auth/me');
      setAuth(me, data.access_token, data.refresh_token);
      const hasChangedPassword = localStorage.getItem('password_changed');
      if (!hasChangedPassword && redirectTo === '/') {
        navigate('/profile?tab=security', { replace: true });
      } else {
        navigate(redirectTo, { replace: true });
      }
    } catch (err: any) {
      localStorage.removeItem('access_token');
      setError(err.message || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFaState || otp.length !== 6) return;
    setError('');
    setLoading(true);
    try {
      const data = await api.post<{ access_token: string; refresh_token: string }>(
        '/auth/2fa/verify',
        { user_id: twoFaState.userId, code: otp }
      );
      localStorage.setItem('access_token', data.access_token);
      const me = await api.get<{ id: string; email: string; full_name: string; is_admin: boolean }>('/auth/me');
      setAuth(me, data.access_token, data.refresh_token);
      navigate(redirectTo, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Invalid or expired code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!twoFaState) return;
    setResending(true);
    try {
      // Re-trigger login to resend code
      await api.post('/auth/login', { email: form.email, password: form.password });
      setError('');
    } catch {
      setError('Failed to resend code.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 pt-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        <AnimatePresence mode="wait">
          {!twoFaState ? (
            <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-4xl mb-2">Welcome Back</h1>
                <p className="text-black/60">Sign in to your account</p>
              </div>

              <GlassCard className="p-8">
                <form className="space-y-6" onSubmit={handleSubmit}>
                  {justRegistered && (
                    <p className="text-sm text-green-600 text-center">Account created! Please sign in.</p>
                  )}
                  {error && <p className="text-sm text-red-500 text-center">{error}</p>}

                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input id="email" type="email" placeholder="you@example.com" className="mt-2" value={form.email} onChange={handleChange} required />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="password">Password</Label>
                      <Link to="/forgot-password" className="text-sm text-primary hover:underline">Forgot password?</Link>
                    </div>
                    <div className="relative">
                      <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={form.password} onChange={handleChange} required />
                      <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 hover:text-black/70">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox id="remember" />
                    <label htmlFor="remember" className="text-sm text-black/60 cursor-pointer">Remember me for 30 days</label>
                  </div>

                  <Button type="submit" size="lg" className="w-full" disabled={loading}>
                    {loading ? 'Signing in…' : 'Sign In'}
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-black/10" /></div>
                    <div className="relative flex justify-center text-xs"><span className="bg-white px-2 text-black/40">or continue with</span></div>
                  </div>

                  <Button type="button" variant="outline" size="lg" className="w-full flex items-center gap-2" onClick={() => window.location.href = '/api/v1/auth/google'}>
                    <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                    Continue with Google
                  </Button>
                </form>

                <div className="mt-6 text-center text-sm text-black/60">
                  Don't have an account?{' '}
                  <Link to="/register" className="text-primary hover:underline">Sign up</Link>
                </div>
              </GlassCard>
            </motion.div>
          ) : (
            <motion.div key="2fa" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-3xl mb-2">Two-Factor Verification</h1>
                <p className="text-black/60">A 6-digit code was sent to <span className="font-medium">{twoFaState.hint}</span></p>
              </div>

              <GlassCard className="p-8">
                <form onSubmit={handleVerify2fa} className="space-y-6">
                  {error && <p className="text-sm text-red-500 text-center">{error}</p>}

                  <div>
                    <Label htmlFor="otp">Verification Code</Label>
                    <Input
                      id="otp"
                      className="mt-2 text-center text-2xl tracking-[0.5em] font-mono"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      autoFocus
                      required
                    />
                    <p className="text-xs text-black/40 mt-1.5 text-center">Code expires in 10 minutes</p>
                  </div>

                  <Button type="submit" size="lg" className="w-full" disabled={loading || otp.length !== 6}>
                    {loading ? 'Verifying…' : 'Verify & Sign In'}
                  </Button>

                  <div className="flex items-center justify-between text-sm">
                    <button type="button" onClick={() => { setTwoFaState(null); setOtp(''); setError(''); }} className="text-black/50 hover:text-black">
                      ← Back
                    </button>
                    <button type="button" onClick={handleResendCode} disabled={resending} className="text-primary hover:underline">
                      {resending ? 'Sending…' : 'Resend code'}
                    </button>
                  </div>
                </form>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
