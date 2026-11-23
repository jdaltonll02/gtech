import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { User, Lock, Save } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { GlassCard } from '../components/glass-card';
import { useAuthStore } from '../store/authStore';
import { api } from '../utils/api';

interface UserResponse {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  is_verified: boolean;
  is_admin: boolean;
}

export function Profile() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  // Redirect if not logged in
  if (!user) {
    navigate('/login');
    return null;
  }

  const [profileForm, setProfileForm] = useState({
    full_name: user.full_name,
    email: user.email,
  });
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfileForm((prev) => ({ ...prev, [e.target.id]: e.target.value }));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordForm((prev) => ({ ...prev, [e.target.id]: e.target.value }));
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    setProfileLoading(true);
    try {
      const updated = await api.patch<UserResponse>('/auth/me', {
        full_name: profileForm.full_name,
        email: profileForm.email,
      });
      // Update auth store with new user info (keep tokens)
      const accessToken = localStorage.getItem('access_token') ?? '';
      const refreshToken = localStorage.getItem('refresh_token') ?? '';
      setAuth(
        { id: updated.id, email: updated.email, full_name: updated.full_name, is_admin: updated.is_admin },
        accessToken,
        refreshToken
      );
      setProfileSuccess('Profile updated successfully.');
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setPasswordLoading(true);
    try {
      await api.patch<UserResponse>('/auth/me', {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      setPasswordSuccess('Password changed successfully.');
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : 'Password change failed');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Header */}
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white text-lg font-semibold">
              {user.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{user.full_name}</h1>
              <p className="text-black/50 text-sm">{user.email}</p>
            </div>
          </div>

          {/* Profile info card */}
          <GlassCard className="p-6 mb-6">
            <div className="flex items-center space-x-2 mb-4">
              <User className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Profile Information</h2>
            </div>
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  value={profileForm.full_name}
                  onChange={handleProfileChange}
                  placeholder="Your full name"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={profileForm.email}
                  onChange={handleProfileChange}
                  placeholder="your@email.com"
                  required
                />
              </div>

              {profileError && (
                <p className="text-sm text-red-600 bg-red-50 rounded p-2">{profileError}</p>
              )}
              {profileSuccess && (
                <p className="text-sm text-green-700 bg-green-50 rounded p-2">{profileSuccess}</p>
              )}

              <Button type="submit" disabled={profileLoading} className="w-full">
                <Save className="w-4 h-4 mr-2" />
                {profileLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </form>
          </GlassCard>

          {/* Change password card */}
          <GlassCard className="p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Lock className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Change Password</h2>
            </div>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="current_password">Current Password</Label>
                <Input
                  id="current_password"
                  type="password"
                  value={passwordForm.current_password}
                  onChange={handlePasswordChange}
                  placeholder="Enter current password"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new_password">New Password</Label>
                <Input
                  id="new_password"
                  type="password"
                  value={passwordForm.new_password}
                  onChange={handlePasswordChange}
                  placeholder="At least 8 chars, 1 uppercase, 1 digit"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm_password">Confirm New Password</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  value={passwordForm.confirm_password}
                  onChange={handlePasswordChange}
                  placeholder="Repeat new password"
                  required
                />
              </div>

              {passwordError && (
                <p className="text-sm text-red-600 bg-red-50 rounded p-2">{passwordError}</p>
              )}
              {passwordSuccess && (
                <p className="text-sm text-green-700 bg-green-50 rounded p-2">{passwordSuccess}</p>
              )}

              <Button type="submit" disabled={passwordLoading} className="w-full">
                <Lock className="w-4 h-4 mr-2" />
                {passwordLoading ? 'Updating...' : 'Update Password'}
              </Button>
            </form>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}
