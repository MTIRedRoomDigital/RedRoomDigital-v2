'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';

interface PublicUser {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  subscription: string;
  created_at: string;
  character_count: string;
  world_count: string;
  friend_count: string;
  characters: { id: string; name: string; avatar_url: string | null; description: string | null; tags: string[]; chat_count: number }[];
}

interface FriendStatus {
  status: string;
  friendshipId?: string;
  isSender?: boolean;
}

export default function UserProfilePage() {
  const { id } = useParams();
  const { user } = useAuth();

  const [profile, setProfile] = useState<PublicUser | null>(null);
  const [friendStatus, setFriendStatus] = useState<FriendStatus>({ status: 'none' });
  const [loading, setLoading] = useState(true);
  const [friendLoading, setFriendLoading] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isBlockedBy, setIsBlockedBy] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

  const isOwnProfile = user?.id === id;

  useEffect(() => {
    if (!id) return;

    api.get<PublicUser>(`/api/users/${id}/public`).then((res) => {
      if (res.success && res.data) setProfile(res.data as any);
      setLoading(false);
    });

    // Check friendship status and block status if logged in
    if (user && !isOwnProfile) {
      api.get<FriendStatus>(`/api/friends/status/${id}`).then((res) => {
        if (res.success && res.data) setFriendStatus(res.data as any);
      });
      api.get<{ is_blocked: boolean; is_blocked_by: boolean }>(`/api/users/${id}/block-status`).then((res) => {
        if (res.success && res.data) {
          setIsBlocked((res.data as any).is_blocked);
          setIsBlockedBy((res.data as any).is_blocked_by);
        }
      });
    }
  }, [id, user, isOwnProfile]);

  const handleFriendAction = async () => {
    if (!user) return;
    setFriendLoading(true);

    if (friendStatus.status === 'none') {
      // Send friend request
      const res = await api.post(`/api/friends/request/${id}`, {});
      if (res.success) setFriendStatus({ status: 'pending', isSender: true });
    } else if (friendStatus.status === 'pending' && !friendStatus.isSender) {
      // Accept incoming request
      const res = await api.put(`/api/friends/${friendStatus.friendshipId}/accept`, {});
      if (res.success) setFriendStatus({ ...friendStatus, status: 'accepted' });
    } else if (friendStatus.status === 'accepted' || (friendStatus.status === 'pending' && friendStatus.isSender)) {
      // Remove friendship
      const res = await api.put(`/api/friends/${friendStatus.friendshipId}/decline`, {});
      if (res.success) setFriendStatus({ status: 'none' });
    }

    setFriendLoading(false);
  };

  const handleBlock = async () => {
    if (!user || blockLoading) return;
    setBlockLoading(true);

    if (isBlocked) {
      const res = await api.delete(`/api/users/${id}/block`);
      if (res.success) setIsBlocked(false);
    } else {
      if (!confirm(`Are you sure you want to block ${profile?.username}? This will also remove any friendship.`)) {
        setBlockLoading(false);
        return;
      }
      const res = await api.post(`/api/users/${id}/block`, {});
      if (res.success) {
        setIsBlocked(true);
        setFriendStatus({ status: 'none' });
      }
    }

    setBlockLoading(false);
  };

  const friendButtonLabel = () => {
    if (friendStatus.status === 'accepted') return 'Friends ✓';
    if (friendStatus.status === 'pending' && friendStatus.isSender) return 'Request Sent';
    if (friendStatus.status === 'pending' && !friendStatus.isSender) return 'Accept Request';
    return 'Add Friend';
  };

  const friendButtonStyle = () => {
    if (friendStatus.status === 'accepted') return 'border border-green-600 text-green-400 hover:border-red-500 hover:text-red-400';
    if (friendStatus.status === 'pending' && friendStatus.isSender) return 'border border-slate-600 text-slate-400';
    if (friendStatus.status === 'pending' && !friendStatus.isSender) return 'bg-green-600 hover:bg-green-700 text-white';
    return 'bg-red-600 hover:bg-red-700 text-white';
  };

  const tierInfo: Record<string, { color: string; bg: string }> = {
    premium: { color: 'text-amber-400', bg: 'bg-amber-900/30' },
    ultimate: { color: 'text-purple-400', bg: 'bg-purple-900/30' },
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-20 h-20 bg-slate-700 rounded-full" />
            <div className="flex-1">
              <div className="h-6 bg-slate-700 rounded w-1/3 mb-2" />
              <div className="h-4 bg-slate-700 rounded w-1/2" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">👤</div>
        <h1 className="text-2xl font-bold text-white mb-2">User Not Found</h1>
        <Link href="/explore" className="text-red-400 hover:text-red-300">Browse Characters</Link>
      </div>
    );
  }

  const tier = tierInfo[profile.subscription];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Profile Header */}
      <div className="flex items-start gap-5 mb-6">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center text-3xl text-white font-bold shrink-0">
          {profile.username[0].toUpperCase()}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-white">{profile.username}</h1>
            {tier && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${tier.bg} ${tier.color} uppercase font-semibold`}>
                {profile.subscription}
              </span>
            )}
          </div>
          {profile.bio ? (
            <p className="text-slate-400 text-sm">{profile.bio}</p>
          ) : (
            <p className="text-slate-600 text-sm italic">No bio yet</p>
          )}
          <p className="text-xs text-slate-500 mt-1">
            Joined {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Friend + Block Buttons */}
        {user && !isOwnProfile && (
          <div className="flex flex-col gap-2 shrink-0">
            {!isBlocked && !isBlockedBy && (
              <button
                onClick={handleFriendAction}
                disabled={friendLoading}
                className={`px-4 py-2 text-sm rounded-lg transition-colors disabled:opacity-50 ${friendButtonStyle()}`}
              >
                {friendLoading ? '...' : friendButtonLabel()}
              </button>
            )}
            {isBlockedBy && (
              <span className="px-4 py-2 text-sm text-slate-500 border border-slate-700 rounded-lg">
                Unable to interact
              </span>
            )}
            <button
              onClick={handleBlock}
              disabled={blockLoading}
              className={`px-4 py-2 text-xs rounded-lg transition-colors disabled:opacity-50 ${
                isBlocked
                  ? 'border border-red-600 text-red-400 hover:bg-red-900/20'
                  : 'border border-slate-600 text-slate-500 hover:text-red-400 hover:border-red-600/50'
              }`}
            >
              {blockLoading ? '...' : isBlocked ? '🚫 Unblock' : '🚫 Block'}
            </button>
          </div>
        )}
        {isOwnProfile && (
          <Link href="/profile" className="px-4 py-2 text-sm border border-slate-600 text-slate-300 hover:text-white rounded-lg transition-colors shrink-0">
            Edit Profile
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="p-4 bg-slate-800 border border-slate-700 rounded-xl text-center">
          <div className="text-2xl font-bold text-white">{profile.character_count}</div>
          <div className="text-xs text-slate-400">Characters</div>
        </div>
        <div className="p-4 bg-slate-800 border border-slate-700 rounded-xl text-center">
          <div className="text-2xl font-bold text-white">{profile.world_count}</div>
          <div className="text-xs text-slate-400">Worlds</div>
        </div>
        <div className="p-4 bg-slate-800 border border-slate-700 rounded-xl text-center">
          <div className="text-2xl font-bold text-white">{profile.friend_count}</div>
          <div className="text-xs text-slate-400">Friends</div>
        </div>
      </div>

      {/* Characters */}
      <h2 className="text-lg font-semibold text-white mb-3">Characters</h2>
      {profile.characters.length === 0 ? (
        <p className="text-sm text-slate-500">No public characters yet</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {profile.characters.map((char) => (
            <Link
              key={char.id}
              href={`/characters/${char.id}`}
              className="p-4 bg-slate-800 border border-slate-700 rounded-xl hover:border-red-500/50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center text-lg shrink-0">
                  🎭
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-white group-hover:text-red-400 transition-colors truncate">{char.name}</h4>
                  {char.description && (
                    <p className="text-xs text-slate-500 truncate">{char.description}</p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
