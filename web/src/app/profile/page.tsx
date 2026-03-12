'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';

interface Character {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  tags: string[];
  chat_count: number;
  created_at: string;
}

interface ProfileData {
  id: string;
  username: string;
  email: string;
  avatar_url: string | null;
  bio: string | null;
  role: string;
  subscription: string;
  kayfabe_strikes: number;
  created_at: string;
  characters: Character[];
  worlds: unknown[];
}

interface FriendData {
  friendship_id: string;
  friend_id: string;
  username: string;
}

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [friendCount, setFriendCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      // Fetch profile and friend count in parallel
      Promise.all([
        api.get<ProfileData>('/api/users/profile'),
        api.get<{ data: FriendData[] }>('/api/friends'),
      ]).then(([profileRes, friendsRes]) => {
        if (profileRes.success && profileRes.data) {
          setProfile(profileRes.data);
        }
        if (friendsRes.success && friendsRes.data) {
          setFriendCount(((friendsRes.data as any).data || []).length);
        }
        setLoading(false);
      });
    }
  }, [user, authLoading, router]);

  if (authLoading || loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-slate-400">Loading profile...</div>
      </div>
    );
  }

  if (!profile) return null;

  const tierColors = {
    free: 'text-slate-400 bg-slate-700',
    premium: 'text-amber-400 bg-amber-900/30',
    ultimate: 'text-purple-400 bg-purple-900/30',
  };

  const tierColor = tierColors[profile.subscription as keyof typeof tierColors] || tierColors.free;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Profile Header */}
      <div className="flex items-start gap-6 mb-8">
        {/* Avatar */}
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt={profile.username} className="w-24 h-24 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center text-white text-3xl font-bold shrink-0">
            {profile.username[0].toUpperCase()}
          </div>
        )}

        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-white">{profile.username}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tierColor}`}>
              {profile.subscription.toUpperCase()}
            </span>
          </div>

          <p className="text-slate-400 text-sm mb-2">{profile.email}</p>

          {profile.bio ? (
            <p className="text-slate-300">{profile.bio}</p>
          ) : (
            <p className="text-slate-500 italic">No bio yet</p>
          )}

          <p className="text-xs text-slate-500 mt-2">
            Joined {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="p-4 bg-slate-800 border border-slate-700 rounded-lg text-center">
          <div className="text-2xl font-bold text-white">{profile.characters.length}</div>
          <div className="text-sm text-slate-400">Characters</div>
        </div>
        <div className="p-4 bg-slate-800 border border-slate-700 rounded-lg text-center">
          <div className="text-2xl font-bold text-white">{profile.worlds.length}</div>
          <div className="text-sm text-slate-400">Worlds</div>
        </div>
        <Link href="/friends" className="p-4 bg-slate-800 border border-slate-700 rounded-lg text-center hover:border-red-500/50 transition-colors">
          <div className="text-2xl font-bold text-white">{friendCount}</div>
          <div className="text-sm text-slate-400">Friends</div>
        </Link>
        <div className="p-4 bg-slate-800 border border-slate-700 rounded-lg text-center">
          <div className="text-2xl font-bold text-white">{profile.kayfabe_strikes}</div>
          <div className="text-sm text-slate-400">Kayfabe Strikes</div>
        </div>
      </div>

      {/* Characters Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">My Characters</h2>
          <Link
            href="/characters/create"
            className="px-4 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            + Create Character
          </Link>
        </div>

        {profile.characters.length === 0 ? (
          <div className="p-8 border border-dashed border-slate-700 rounded-lg text-center">
            <p className="text-slate-400 mb-4">You haven&apos;t created any characters yet.</p>
            <Link
              href="/characters/create"
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors inline-block"
            >
              Create Your First Character
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {profile.characters.map((char) => (
              <Link
                key={char.id}
                href={`/characters/${char.id}`}
                className="p-4 bg-slate-800 border border-slate-700 rounded-lg hover:border-red-500/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {char.avatar_url ? (
                    <img src={char.avatar_url} alt={char.name} className="w-12 h-12 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center text-xl">
                      🎭
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate">{char.name}</h3>
                    <p className="text-sm text-slate-400 truncate">
                      {char.description || 'No description'}
                    </p>
                  </div>
                  <div className="text-xs text-slate-500">{char.chat_count} chats</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
