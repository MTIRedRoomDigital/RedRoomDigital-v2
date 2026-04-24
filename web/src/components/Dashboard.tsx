'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface DashboardData {
  recent_chats: {
    id: string;
    title: string;
    chat_mode: string;
    updated_at: string;
    is_active: boolean;
    my_character_name: string;
    my_character_avatar: string | null;
    partner_name: string;
    partner_avatar: string | null;
    partner_is_ai: boolean;
  }[];
  friends: {
    id: string;
    username: string;
    avatar_url: string | null;
    status: 'online' | 'away' | 'offline';
  }[];
  notifications: {
    items: {
      id: string;
      type: string;
      title: string;
      body: string | null;
      is_read: boolean;
      created_at: string;
    }[];
    unread_count: number;
  };
  leaderboards: {
    top_characters: {
      id: string;
      name: string;
      avatar_url: string | null;
      like_count: number;
      chat_count: number;
      creator_name: string;
    }[];
    top_worlds: {
      id: string;
      name: string;
      thumbnail_url: string | null;
      setting: string | null;
      like_count: number;
      member_count: number;
      character_count: number;
      creator_name: string;
    }[];
    top_users: {
      id: string;
      username: string;
      avatar_url: string | null;
      subscription: string;
      total_chats: string;
    }[];
  };
  recommended_characters: {
    id: string;
    name: string;
    avatar_url: string | null;
    description: string | null;
    tags: string[];
    like_count: number;
    chat_count: number;
    creator_name: string;
    world_name: string | null;
  }[];
  my_characters: {
    id: string;
    name: string;
    avatar_url: string | null;
    chat_count: number;
    like_count: number;
  }[];
}

const statusColors = {
  online: 'bg-green-400',
  away: 'bg-amber-400',
  offline: 'bg-slate-600',
};

const tierColors: Record<string, string> = {
  premium: 'text-amber-400',
  ultimate: 'text-purple-400',
};

export function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<DashboardData>('/api/dashboard').then((res) => {
      if (res.success && res.data) setData(res.data as any);
    }).catch(() => {
      // API may not be reachable
    }).finally(() => {
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-700 rounded w-1/3" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-slate-800 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-20 text-center">
        <p className="text-slate-400 mb-4">Unable to load dashboard data.</p>
        <button onClick={() => window.location.reload()} className="text-sm text-red-400 hover:text-red-300">
          Try again
        </button>
      </div>
    );
  }

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  // Brand-new user: no characters yet → show dedicated onboarding hero
  const isNewUser = data.my_characters.length === 0;

  if (isNewUser) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Onboarding hero */}
        <div className="relative overflow-hidden rounded-2xl border border-red-500/20 bg-gradient-to-br from-red-500/10 via-slate-800/50 to-amber-500/5 p-8 md:p-12 mb-8">
          <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/30 rounded-full text-xs text-red-400 mb-4">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              Welcome to RedRoom
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
              Hi <span className="text-red-400">{user?.username}</span> — let&apos;s build your first character.
            </h1>
            <p className="text-slate-400 mb-6 max-w-xl leading-relaxed">
              Your character is the heart of everything on RedRoom. Give them a personality, a backstory,
              and quirks — the AI uses all of it to keep them in character across every chat.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/characters/create"
                className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold rounded-xl shadow-lg shadow-red-500/25 transition-all hover:-translate-y-0.5 text-center"
              >
                🎭 Create Your First Character
              </Link>
              <Link
                href="/explore/public-chats"
                className="px-6 py-3 border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white font-semibold rounded-xl transition-all text-center"
              >
                See How Others Play
              </Link>
            </div>
          </div>
        </div>

        {/* 3-step mini primer */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="p-5 bg-slate-800/50 border border-slate-700/50 rounded-xl">
            <div className="text-2xl mb-2">🎭</div>
            <h3 className="text-sm font-semibold text-white mb-1">1. Create a character</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Personality, backstory, likes, dislikes. Takes 2 minutes.
            </p>
          </div>
          <div className="p-5 bg-slate-800/50 border border-slate-700/50 rounded-xl">
            <div className="text-2xl mb-2">💬</div>
            <h3 className="text-sm font-semibold text-white mb-1">2. Start a chat</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Play with another writer live, or let AI run a character for you.
            </p>
          </div>
          <div className="p-5 bg-slate-800/50 border border-slate-700/50 rounded-xl">
            <div className="text-2xl mb-2">📜</div>
            <h3 className="text-sm font-semibold text-white mb-1">3. Make it canon</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Freeze great moments as permanent character history.
            </p>
          </div>
        </div>

        {/* Recommended characters to chat with (if we have some) */}
        {data.recommended_characters.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white">Popular characters to chat with</h2>
              <Link href="/explore" className="text-xs text-red-400 hover:text-red-300">See all</Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.recommended_characters.slice(0, 3).map((char) => (
                <Link
                  key={char.id}
                  href={`/characters/${char.id}`}
                  className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl hover:border-red-500/30 transition-all hover:-translate-y-0.5 group"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center text-lg shrink-0 overflow-hidden">
                      {char.avatar_url ? (
                        <img src={char.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : '🎭'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white truncate group-hover:text-red-400 transition-colors">{char.name}</h3>
                      <p className="text-xs text-slate-500">by {char.creator_name}</p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-400 line-clamp-2">
                    {char.description || 'A mysterious character awaits...'}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Greeting */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            Welcome back, <span className="text-red-400">{user?.username}</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">Here&apos;s what&apos;s happening in your world</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/characters/create"
            className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
          >
            + Character
          </Link>
          <Link
            href="/explore"
            className="px-4 py-2 text-sm border border-slate-600 text-slate-300 hover:text-white rounded-lg transition-colors"
          >
            Explore
          </Link>
        </div>
      </div>

      {/* Second-step nudge — user has a character but hasn't started a chat yet.
          Gets them from "I made something" to "I used something." Hidden once they chat. */}
      {data.recent_chats.length === 0 && (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-amber-900/20 to-red-900/20 border border-amber-700/40 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">Next: start your first chat 💬</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Your character is built — now take them for a spin. Find someone to roleplay with or chat with an AI character.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link
              href="/explore"
              className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
            >
              Find a chat partner
            </Link>
            <Link
              href="/guide#canon"
              className="px-3 py-1.5 text-xs border border-slate-600 text-slate-300 hover:text-white rounded-lg transition-colors"
            >
              How canon works
            </Link>
          </div>
        </div>
      )}

      {/* Top Row: Quick Actions + Notifications + Friends */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* My Characters */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">My Characters</h2>
            <Link href="/characters" className="text-xs text-red-400 hover:text-red-300">View all</Link>
          </div>
          {data.my_characters.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-slate-500 text-sm mb-3">No characters yet</p>
              <Link href="/characters/create" className="text-sm text-red-400 hover:text-red-300">Create your first</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {data.my_characters.map((char) => (
                <Link
                  key={char.id}
                  href={`/characters/${char.id}`}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center text-sm shrink-0 overflow-hidden">
                    {char.avatar_url ? (
                      <img src={char.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : '🎭'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{char.name}</p>
                    <p className="text-xs text-slate-500">{char.chat_count} chats &middot; {char.like_count} likes</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">
              Notifications
              {data.notifications.unread_count > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-red-600 text-white rounded-full">
                  {data.notifications.unread_count}
                </span>
              )}
            </h2>
            <Link href="/notifications" className="text-xs text-red-400 hover:text-red-300">View all</Link>
          </div>
          {data.notifications.items.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-6">No notifications</p>
          ) : (
            <div className="space-y-2">
              {data.notifications.items.slice(0, 4).map((n) => (
                <Link
                  key={n.id}
                  href="/notifications"
                  className={`block p-2.5 rounded-lg transition-colors ${
                    n.is_read ? 'hover:bg-slate-700/30' : 'bg-slate-700/30 hover:bg-slate-700/50'
                  }`}
                >
                  <p className={`text-sm truncate ${n.is_read ? 'text-slate-400' : 'text-white font-medium'}`}>
                    {n.title}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{timeAgo(n.created_at)}</p>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Friends */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">Friends</h2>
            <Link href="/search" className="text-xs text-red-400 hover:text-red-300">Find people</Link>
          </div>
          {data.friends.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-6">No friends yet</p>
          ) : (
            <div className="space-y-2">
              {data.friends.map((f) => (
                <Link
                  key={f.id}
                  href={`/users/${f.id}`}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
                >
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center text-sm font-bold text-white">
                      {f.username[0].toUpperCase()}
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-800 ${statusColors[f.status]}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{f.username}</p>
                    <p className="text-xs text-slate-500 capitalize">{f.status}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Chats */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white">Recent Chats</h2>
          <Link href="/chats" className="text-xs text-red-400 hover:text-red-300">All chats</Link>
        </div>
        {data.recent_chats.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-500 text-sm mb-3">No conversations yet</p>
            <Link href="/explore" className="text-sm text-red-400 hover:text-red-300">Find someone to chat with</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {data.recent_chats.map((chat) => (
              <Link
                key={chat.id}
                href={`/chats/${chat.id}`}
                className="p-3 bg-slate-700/30 border border-slate-700/50 rounded-lg hover:border-red-500/30 transition-all group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center text-xs shrink-0 overflow-hidden">
                    {chat.partner_avatar ? (
                      <img src={chat.partner_avatar} alt="" className="w-full h-full object-cover" />
                    ) : '🎭'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate group-hover:text-red-400 transition-colors">
                      {chat.partner_name}
                    </p>
                    <p className="text-[10px] text-slate-500">as {chat.my_character_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {chat.chat_mode === 'ai' ? (
                    <span className="text-[10px] px-1.5 py-0.5 bg-purple-900/30 text-purple-400 rounded-full">AI</span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 bg-green-900/30 text-green-400 rounded-full">Live</span>
                  )}
                  {!chat.is_active && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded-full">Ended</span>
                  )}
                  <span className="text-[10px] text-slate-600 ml-auto">{timeAgo(chat.updated_at)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recommended Characters */}
      {data.recommended_characters.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white text-lg">Recommended For You</h2>
            <Link href="/explore" className="text-xs text-red-400 hover:text-red-300">See more</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.recommended_characters.map((char) => (
              <Link
                key={char.id}
                href={`/characters/${char.id}`}
                className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl hover:border-red-500/30 transition-all hover:-translate-y-0.5 group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center text-lg shrink-0 overflow-hidden">
                    {char.avatar_url ? (
                      <img src={char.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : '🎭'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate group-hover:text-red-400 transition-colors">{char.name}</h3>
                    <p className="text-xs text-slate-500">
                      by {char.creator_name}
                      {char.world_name && <span className="text-purple-400"> &middot; {char.world_name}</span>}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-slate-400 line-clamp-2 mb-2">
                  {char.description || 'A mysterious character awaits...'}
                </p>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>👍 {char.like_count}</span>
                  <span>💬 {char.chat_count}</span>
                  {char.tags?.slice(0, 2).map((tag) => (
                    <span key={tag} className="px-1.5 py-0.5 bg-slate-700/50 rounded-full text-slate-400">{tag}</span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Leaderboards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Top Characters */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <h2 className="font-semibold text-white mb-4">
            <span className="text-amber-400">🏆</span> Top Characters
          </h2>
          {data.leaderboards.top_characters.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-4">No votes yet</p>
          ) : (
            <div className="space-y-2">
              {data.leaderboards.top_characters.map((char, i) => (
                <Link
                  key={char.id}
                  href={`/characters/${char.id}`}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
                >
                  <span className={`text-sm font-bold w-5 ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-600' : 'text-slate-500'}`}>
                    {i + 1}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center text-xs shrink-0 overflow-hidden">
                    {char.avatar_url ? (
                      <img src={char.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : '🎭'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{char.name}</p>
                    <p className="text-xs text-slate-500">{char.creator_name}</p>
                  </div>
                  <span className="text-xs text-green-400 shrink-0">👍 {char.like_count}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Top Worlds */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <h2 className="font-semibold text-white mb-4">
            <span className="text-amber-400">🌍</span> Top Worlds
          </h2>
          {data.leaderboards.top_worlds.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-4">No worlds yet</p>
          ) : (
            <div className="space-y-2">
              {data.leaderboards.top_worlds.map((world, i) => (
                <Link
                  key={world.id}
                  href={`/worlds/${world.id}`}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
                >
                  <span className={`text-sm font-bold w-5 ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-600' : 'text-slate-500'}`}>
                    {i + 1}
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-purple-600 flex items-center justify-center text-xs shrink-0 overflow-hidden">
                    {world.thumbnail_url ? (
                      <img src={world.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    ) : '🌍'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{world.name}</p>
                    <p className="text-xs text-slate-500">{world.member_count} members</p>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0">{world.character_count} chars</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Top Users */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <h2 className="font-semibold text-white mb-4">
            <span className="text-amber-400">👑</span> Most Active
          </h2>
          {data.leaderboards.top_users.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-4">No activity yet</p>
          ) : (
            <div className="space-y-2">
              {data.leaderboards.top_users.map((u, i) => (
                <Link
                  key={u.id}
                  href={`/users/${u.id}`}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
                >
                  <span className={`text-sm font-bold w-5 ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-600' : 'text-slate-500'}`}>
                    {i + 1}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center text-sm font-bold text-white">
                    {u.username[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${tierColors[u.subscription] || 'text-white'}`}>{u.username}</p>
                    <p className="text-xs text-slate-500">{u.total_chats} chats</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Links Footer */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link href="/worlds" className="p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl text-center hover:border-amber-500/30 transition-all group">
          <div className="text-2xl mb-1">🌍</div>
          <p className="text-sm text-slate-300 group-hover:text-white transition-colors">Browse Worlds</p>
        </Link>
        <Link href="/forum" className="p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl text-center hover:border-blue-500/30 transition-all group">
          <div className="text-2xl mb-1">💬</div>
          <p className="text-sm text-slate-300 group-hover:text-white transition-colors">Forum</p>
        </Link>
        <Link href="/characters" className="p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl text-center hover:border-red-500/30 transition-all group">
          <div className="text-2xl mb-1">🎭</div>
          <p className="text-sm text-slate-300 group-hover:text-white transition-colors">My Characters</p>
        </Link>
        <Link href="/settings" className="p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl text-center hover:border-purple-500/30 transition-all group">
          <div className="text-2xl mb-1">⚙️</div>
          <p className="text-sm text-slate-300 group-hover:text-white transition-colors">Settings</p>
        </Link>
      </div>
    </div>
  );
}
