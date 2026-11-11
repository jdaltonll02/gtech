import { useState } from 'react';
import { motion } from 'motion/react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Lock } from 'lucide-react';
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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.id]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.post<{ access_token: string; refresh_token: string }>(
        '/auth/login',
        { email: form.email, password: form.password }
      );
      // Make token available for the immediate /auth/me call.
      localStorage.setItem('access_token', data.access_token);
      const me = await api.get<{ id: string; email: string; full_name: string; is_admin: boolean }>('/auth/me');
      setAuth(me, data.access_token, data.refresh_token);
      navigate(redirectTo, { replace: true });
    } catch (err: any) {
      localStorage.removeItem('access_token');
      setError(err.message || 'Invalid credentials.');
    } finally {
      setLoading(false);
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
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8" />
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
                <a href="#" className="text-sm text-primary hover:underline">Forgot password?</a>
              </div>
              <Input id="password" type="password" placeholder="••••••••" value={form.password} onChange={handleChange} required />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox id="remember" />
              <label htmlFor="remember" className="text-sm text-black/60 cursor-pointer">
                Remember me for 30 days
              </label>
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-black/60">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary hover:underline">Sign up</Link>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}
