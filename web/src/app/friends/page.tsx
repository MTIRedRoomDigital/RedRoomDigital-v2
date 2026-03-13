'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface Friend {
  friendship_id: string;
  friend_id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  subscription: string;
  last_seen_at: string | null;
  friends_since: string;
}

interface PendingRequest {
  friendship_id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  subscription: string;
  created_at: string;
}

export default function FriendsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<'friends' | 'requests'>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (!user) return;

    // Fetch both friends and pending requests in parallel
    Promise.all([
      api.get<Friend[]>('/api/friends'),
      api.get<PendingRequest[]>('/api/friends/pending'),
    ]).then(([friendsRes, pendingRes]) => {
      if (friendsRes.success && friendsRes.data) {
        setFriends(friendsRes.data as any);
      }
      if (pendingRes.success && pendingRes.data) {
        setPending(pendingRes.data as any);
      }
      setLoading(false);
    });
  }, [user, authLoading, router]);

  const acceptRequest = async (friendshipId: string) => {
    const res = await api.put(`/api/friends/${friendshipId}/accept`, {});
    if (res.success) {
      // Move from pending to friends
      const accepted = pending.find((p) => p.friendship_id === friendshipId);
      setPending((prev) => prev.filter((p) => p.friendship_id !== friendshipId));
      if (accepted) {
        setFriends((prev) => [
          {
            friendship_id: accepted.friendship_id,
            friend_id: accepted.user_id,
            username: accepted.username,
            avatar_url: accepted.avatar_url,
            bio: accepted.bio,
            subscription: accepted.subscription,
            last_seen_at: null,
            friends_since: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
    }
  };

  const declineRequest = async (friendshipId: string) => {
    const res = await api.put(`/api/friends/${friendshipId}/decline`, {});
    if (res.success) {
      setPending((prev) => prev.filter((p) => p.friendship_id !== friendshipId));
    }
  };

  const removeFriend = async (friendshipId: string) => {
    const res = await api.put(`/api/friends/${friendshipId}/decline`, {});
    if (res.success) {
      setFriends((prev) => prev.filter((f) => f.friendship_id !== friendshipId));
    }
  };

  const tierColors: Record<string, string> = {
    free: 'text-slate-400 bg-slate-700',
    premium: 'text-amber-400 bg-amber-900/30',
    ultimate: 'text-purple-400 bg-purple-900/30',
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  if (authLoading || loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-700 rounded w-1/4 mb-6" />
          <div className="flex gap-4 mb-6">
            <div className="h-10 bg-slate-700 rounded w-24" />
            <div className="h-10 bg-slate-700 rounded w-28" />
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-slate-800 rounded-xl mb-3" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-6">Friends</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('friends')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'friends'
              ? 'bg-red-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          Friends ({friends.length})
        </button>
        <button
          onClick={() => setTab('requests')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors relative ${
            tab === 'requests'
              ? 'bg-red-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          Requests
          {pending.length > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold bg-red-500 text-white rounded-full">
              {pending.length}
            </span>
          )}
        </button>
      </div>

      {/* Friends Tab */}
      {tab === 'friends' && (
        <>
          {friends.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">👥</div>
              <p className="text-slate-400 mb-2">No friends yet</p>
              <p className="text-sm text-slate-500 mb-4">
                Explore characters and send friend requests to connect with other players!
              </p>
              <Link
                href="/explore"
                className="inline-block px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Explore Characters
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {friends.map((friend) => (
                <div
                  key={friend.friendship_id}
                  className="p-4 bg-slate-800 border border-slate-700 rounded-xl hover:border-slate-600 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <Link href={`/users/${friend.friend_id}`}>
                      {friend.avatar_url ? (
                        <img
                          src={friend.avatar_url}
                          alt={friend.username}
                          className="w-12 h-12 rounded-full object-cover shrink-0 hover:ring-2 hover:ring-red-500 transition-all"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center text-white font-bold text-lg shrink-0 hover:ring-2 hover:ring-red-500 transition-all">
                          {friend.username[0].toUpperCase()}
                        </div>
                      )}
                    </Link>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link href={`/users/${friend.friend_id}`} className="font-medium text-white hover:text-red-400 transition-colors">
                          {friend.username}
                        </Link>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${tierColors[friend.subscription] || tierColors.free}`}>
                          {friend.subscription}
                        </span>
                      </div>
                      {friend.bio && (
                        <p className="text-sm text-slate-400 truncate mt-0.5">{friend.bio}</p>
                      )}
                      <p className="text-xs text-slate-500 mt-0.5">
                        Friends since {new Date(friend.friends_since).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        href={`/users/${friend.friend_id}`}
                        className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
                      >
                        View Profile
                      </Link>
                      <button
                        onClick={() => removeFriend(friend.friendship_id)}
                        className="px-3 py-1.5 text-xs border border-slate-600 text-slate-400 hover:border-red-500 hover:text-red-400 rounded-lg transition-colors"
                        title="Remove friend"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Requests Tab */}
      {tab === 'requests' && (
        <>
          {pending.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">📬</div>
              <p className="text-slate-400">No pending friend requests</p>
              <p className="text-sm text-slate-500 mt-1">
                When someone sends you a friend request, it will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map((req) => (
                <div
                  key={req.friendship_id}
                  className="p-4 bg-slate-800 border border-amber-500/30 rounded-xl"
                >
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <Link href={`/users/${req.user_id}`}>
                      {req.avatar_url ? (
                        <img
                          src={req.avatar_url}
                          alt={req.username}
                          className="w-12 h-12 rounded-full object-cover shrink-0 hover:ring-2 hover:ring-red-500 transition-all"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center text-white font-bold text-lg shrink-0 hover:ring-2 hover:ring-red-500 transition-all">
                          {req.username[0].toUpperCase()}
                        </div>
                      )}
                    </Link>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link href={`/users/${req.user_id}`} className="font-medium text-white hover:text-red-400 transition-colors">
                          {req.username}
                        </Link>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${tierColors[req.subscription] || tierColors.free}`}>
                          {req.subscription}
                        </span>
                      </div>
                      {req.bio && (
                        <p className="text-sm text-slate-400 truncate mt-0.5">{req.bio}</p>
                      )}
                      <p className="text-xs text-slate-500 mt-0.5">
                        Sent {timeAgo(req.created_at)}
                      </p>
                    </div>

                    {/* Accept / Decline */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => acceptRequest(req.friendship_id)}
                        className="px-4 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => declineRequest(req.friendship_id)}
                        className="px-4 py-1.5 text-xs bg-slate-700 hover:bg-red-600 text-slate-300 hover:text-white rounded-lg transition-colors"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
