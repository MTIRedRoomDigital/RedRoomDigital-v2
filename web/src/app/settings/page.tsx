'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ImageUpload } from '@/components/ImageUpload';
import Link from 'next/link';

export default function SettingsPage() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const router = useRouter();
  const [bio, setBio] = useState('');
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<{ id: string; blocked_id: string; username: string; avatar_url: string | null }[]>([]);
  const [loadingBlocks, setLoadingBlocks] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user) {
      setUsername(user.username || '');
      setBio((user as any).bio || '');
      setAvatarUrl((user as any).avatar_url || null);
      // Load blocked users
      api.get<any[]>('/api/users/blocked').then((res) => {
        if (res.success && res.data) setBlockedUsers(res.data as any);
      });
    }
  }, [user, authLoading, router]);

  const handleSaveProfile = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await api.put('/api/users/profile', { username, bio, avatar_url: avatarUrl });
      if (res.success) {
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
        if (refreshUser) refreshUser();
      } else {
        setMessage({ type: 'error', text: (res as any).message || 'Failed to update profile' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to update profile' });
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }
    setChangingPassword(true);
    setMessage(null);
    try {
      const res = await api.put('/api/users/password', {
        currentPassword,
        newPassword,
      });
      if (res.success) {
        setMessage({ type: 'success', text: 'Password changed successfully!' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setMessage({ type: 'error', text: (res as any).message || 'Failed to change password' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to change password' });
    }
    setChangingPassword(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-white mb-8">Settings</h1>

      {/* Status Message */}
      {message && (
        <div className={`mb-6 p-4 rounded-xl border text-sm ${
          message.type === 'success'
            ? 'bg-green-500/10 border-green-500/20 text-green-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      {/* Profile Section */}
      <div className="mb-8 p-6 bg-slate-800/50 border border-slate-700 rounded-xl">
        <h2 className="text-xl font-semibold text-white mb-6">Edit Profile</h2>

        <div className="space-y-5">
          {/* Avatar Upload */}
          <div className="flex items-center gap-4">
            <ImageUpload
              currentImageUrl={avatarUrl}
              onUploadComplete={(url) => setAvatarUrl(url)}
              uploadType="avatar"
              shape="circle"
              size="md"
              fallback={
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center text-white text-2xl font-bold">
                  {username[0]?.toUpperCase() || '?'}
                </div>
              }
            />
            <div>
              <p className="text-white font-medium">{username}</p>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-red-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              maxLength={300}
              placeholder="Tell the world about yourself..."
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-red-500 focus:outline-none transition-colors resize-none"
            />
            <p className="text-xs text-slate-500 mt-1">{bio.length}/300</p>
          </div>

          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-600 text-white font-medium rounded-lg transition-colors"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Password Section */}
      <div className="mb-8 p-6 bg-slate-800/50 border border-slate-700 rounded-xl">
        <h2 className="text-xl font-semibold text-white mb-6">Change Password</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-red-500 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-red-500 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-red-500 focus:outline-none transition-colors"
            />
          </div>

          <button
            onClick={handleChangePassword}
            disabled={changingPassword || !currentPassword || !newPassword}
            className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 text-white font-medium rounded-lg transition-colors"
          >
            {changingPassword ? 'Changing...' : 'Change Password'}
          </button>
        </div>
      </div>

      {/* Account Info */}
      <div className="p-6 bg-slate-800/50 border border-slate-700 rounded-xl">
        <h2 className="text-xl font-semibold text-white mb-4">Account</h2>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Subscription</span>
            <Link href="/subscription" className="text-red-400 hover:text-red-300">
              {user.subscription?.toUpperCase() || 'FREE'} &mdash; Manage
            </Link>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Kayfabe Strikes</span>
            <span className="text-white">{(user as any).kayfabe_strikes || 0} / 3</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Member Since</span>
            <span className="text-white">
              {new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      {/* Blocked Users */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">🚫 Blocked Users</h2>
        {blockedUsers.length === 0 ? (
          <p className="text-sm text-slate-500">No blocked users</p>
        ) : (
          <div className="space-y-3">
            {blockedUsers.map((blocked) => (
              <div key={blocked.id} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                <Link href={`/users/${blocked.blocked_id}`} className="flex items-center gap-3 text-sm text-white hover:text-red-400 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center text-sm font-bold">
                    {blocked.username?.[0]?.toUpperCase() || '?'}
                  </div>
                  {blocked.username}
                </Link>
                <button
                  onClick={async () => {
                    const res = await api.delete(`/api/users/${blocked.blocked_id}/block`);
                    if (res.success) {
                      setBlockedUsers((prev) => prev.filter((b) => b.id !== blocked.id));
                    }
                  }}
                  className="text-xs px-3 py-1 border border-slate-600 text-slate-400 hover:text-white rounded-lg transition-colors"
                >
                  Unblock
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
