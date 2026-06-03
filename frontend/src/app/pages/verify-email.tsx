import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router';
import { motion } from 'motion/react';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import { Button } from '../components/ui/button';
import { GlassCard } from '../components/glass-card';
import { api } from '../utils/api';

export function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token found in the URL.');
      return;
    }
    api.post<{ message: string }>(`/auth/verify-email?token=${encodeURIComponent(token)}`, {})
      .then((res) => {
        setStatus('success');
        setMessage(res.message);
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.message || 'Verification failed. The link may have expired.');
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <GlassCard className="p-10 text-center">
          {status === 'loading' && (
            <>
              <Loader className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
              <h1 className="text-2xl mb-2">Verifying your email…</h1>
              <p className="text-black/50">Please wait a moment.</p>
            </>
          )}
          {status === 'success' && (
            <>
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h1 className="text-2xl mb-2">Email Verified!</h1>
              <p className="text-black/60 mb-6">{message}</p>
              <Link to="/login">
                <Button size="lg" className="w-full">Sign In</Button>
              </Link>
            </>
          )}
          {status === 'error' && (
            <>
              <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h1 className="text-2xl mb-2">Verification Failed</h1>
              <p className="text-black/60 mb-6">{message}</p>
              <Link to="/login">
                <Button size="lg" variant="outline" className="w-full">Back to Login</Button>
              </Link>
            </>
          )}
        </GlassCard>
      </motion.div>
    </div>
  );
}
