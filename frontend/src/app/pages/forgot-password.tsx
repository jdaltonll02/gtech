import { useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { GlassCard } from '../components/glass-card';
import { api } from '../utils/api';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-16">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-3xl mb-2">Forgot Password?</h1>
          <p className="text-black/60">Enter your email and we'll send you a reset link.</p>
        </div>

        <GlassCard className="p-8">
          {sent ? (
            <div className="text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl mb-2">Check your email</h2>
              <p className="text-black/60 mb-6">
                If an account exists for <strong>{email}</strong>, a password reset link has been sent. It expires in 1 hour.
              </p>
              <p className="text-sm text-black/40 mb-6">Didn't receive it? Check your spam folder or try again.</p>
              <div className="space-y-3">
                <Button className="w-full" variant="outline" onClick={() => setSent(false)}>Send another link</Button>
                <Link to="/login"><Button className="w-full">Back to Sign In</Button></Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && <p className="text-sm text-red-500 text-center">{error}</p>}
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  className="mt-1.5"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? 'Sending…' : 'Send Reset Link'}
              </Button>
              <div className="text-center">
                <Link to="/login" className="inline-flex items-center text-sm text-primary hover:underline">
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" />Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </GlassCard>
      </motion.div>
    </div>
  );
}
