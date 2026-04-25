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

  // Aggregate stats for the hero strip
  const totalChats = data.my_characters.reduce((s, c) => s + (c.chat_count || 0), 0);
  const totalLikes = data.my_characters.reduce((s, c) => s + (c.like_count || 0), 0);
  const onlineFriends = data.friends.filter((f) => f.status === 'online').length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* ─────────────── HERO ─────────────── */}
      {/* Greeting + at-a-glance stats. Stats give the page a "command center" feel
          rather than just a list of cards. */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-900/30 via-slate-800/40 to-purple-900/20 border border-slate-700/60 p-6 md:p-7 mb-8">
        <div className="absolute -top-10 -right-10 w-64 h-64 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-red-400/80 font-semibold mb-1">
              Your control room
            </p>
            <h1 className="text-2xl md:text-3xl font-bold text-white">
              Welcome back, <span className="text-red-400">{user?.username}</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1">Here&apos;s what&apos;s happening in your stories.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700/60 text-center min-w-[72px]">
              <div className="text-lg font-bold text-red-400">{data.my_characters.length}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Chars</div>
            </div>
            <div className="px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700/60 text-center min-w-[72px]">
              <div className="text-lg font-bold text-green-400">{totalChats}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Chats</div>
            </div>
            <div className="px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700/60 text-center min-w-[72px]">
              <div className="text-lg font-bold text-amber-400">{totalLikes}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Likes</div>
            </div>
            <div className="px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700/60 text-center min-w-[72px]">
              <div className="text-lg font-bold text-blue-400">{onlineFriends}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Online</div>
            </div>
            <div className="hidden md:block w-px h-10 bg-slate-700 mx-1" />
            <Link
              href="/characters/create"
              className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium shadow-lg shadow-red-900/30"
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
      </div>

      {/* Second-step nudge (unchanged) */}
      {data.recent_chats.length === 0 && (
        <div className="mb-8 p-4 rounded-xl bg-gradient-to-r from-amber-900/20 to-red-900/20 border border-amber-700/40 flex flex-col sm:flex-row items-center justify-between gap-3">
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

      {/* ─────────────── ACTIVITY: Recent Chats (wide hero band) ─────────────── */}
      {/* Most-used section first. Bigger, distinct green accent so it reads as
          "live / in-progress" — separates it visually from creation and discovery. */}
      <SectionHeader
        accent="green"
        eyebrow="Activity"
        title="Recent Chats"
        description="Pick up where you left off — live conversations and AI sessions."
        href="/chats"
        hrefLabel="All chats"
      />
      <div className="bg-gradient-to-br from-green-950/20 to-slate-800/40 border border-green-900/30 rounded-2xl p-5 mb-10">
        {data.recent_chats.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-500 text-sm mb-3">No conversations yet</p>
            <Link href="/explore" className="text-sm text-red-400 hover:text-red-300">Find someone to chat with →</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {data.recent_chats.map((chat) => (
              <Link
                key={chat.id}
                href={`/chats/${chat.id}`}
                className="p-3 bg-slate-900/60 border border-slate-700/60 rounded-lg hover:border-green-500/40 hover:bg-slate-900/80 transition-all group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center text-xs shrink-0 overflow-hidden ring-2 ring-slate-900">
                    {chat.partner_avatar ? (
                      <img src={chat.partner_avatar} alt="" className="w-full h-full object-cover" />
                    ) : '🎭'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate group-hover:text-green-400 transition-colors">
                      {chat.partner_name}
                    </p>
                    <p className="text-[10px] text-slate-500">as {chat.my_character_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {chat.chat_mode === 'ai' ? (
                    <span className="text-[10px] px-1.5 py-0.5 bg-purple-900/40 text-purple-300 rounded-full border border-purple-800/40">AI</span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 bg-green-900/40 text-green-300 rounded-full border border-green-800/40">Live</span>
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

      {/* ─────────────── YOUR STUFF (red) ─────────────── */}
      {/* Mid-priority but high-personal-value: own characters, social, alerts. */}
      <SectionHeader
        accent="red"
        eyebrow="Your stuff"
        title="Yours"
        description="Characters you've built, friends you play with, and what needs your attention."
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-10">
        {/* My Characters — accented red because these are YOURS */}
        <Panel accent="red" title="My Characters" href="/characters" hrefLabel="View all">
          {data.my_characters.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-slate-500 text-sm mb-3">No characters yet</p>
              <Link href="/characters/create" className="text-sm text-red-400 hover:text-red-300">Create your first →</Link>
            </div>
          ) : (
            <div className="space-y-1">
              {data.my_characters.map((char) => (
                <Link
                  key={char.id}
                  href={`/characters/${char.id}`}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-red-900/10 transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center text-sm shrink-0 overflow-hidden">
                    {char.avatar_url ? (
                      <img src={char.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : '🎭'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{char.name}</p>
                    <p className="text-xs text-slate-500">
                      <span className="text-green-400/70">{char.chat_count}</span> chats
                      <span className="mx-1.5 text-slate-700">·</span>
                      <span className="text-amber-400/70">{char.like_count}</span> likes
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        {/* Notifications — accented red with badge */}
        <Panel
          accent="red"
          title={
            <span className="flex items-center gap-2">
              Notifications
              {data.notifications.unread_count > 0 && (
                <span className="px-2 py-0.5 text-xs bg-red-600 text-white rounded-full">
                  {data.notifications.unread_count}
                </span>
              )}
            </span>
          }
          href="/notifications"
          hrefLabel="View all"
        >
          {data.notifications.items.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-6">No notifications</p>
          ) : (
            <div className="space-y-1.5">
              {data.notifications.items.slice(0, 4).map((n) => (
                <Link
                  key={n.id}
                  href="/notifications"
                  className={`block p-2.5 rounded-lg transition-colors border-l-2 ${
                    n.is_read
                      ? 'border-slate-700 hover:bg-slate-700/30'
                      : 'border-red-500 bg-red-900/10 hover:bg-red-900/20'
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
        </Panel>

        {/* Friends — accented blue (community feels) */}
        <Panel accent="blue" title="Friends" href="/search" hrefLabel="Find people">
          {data.friends.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-6">No friends yet</p>
          ) : (
            <div className="space-y-1">
              {data.friends.map((f) => (
                <Link
                  key={f.id}
                  href={`/users/${f.id}`}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-blue-900/10 transition-colors"
                >
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center text-sm font-bold text-white">
                      {f.username[0].toUpperCase()}
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${statusColors[f.status]}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{f.username}</p>
                    <p className="text-xs text-slate-500 capitalize">{f.status}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* ─────────────── DISCOVER (purple) ─────────────── */}
      {/* Recommendations — visually distinct: bigger cards, image-forward feel. */}
      {data.recommended_characters.length > 0 && (
        <>
          <SectionHeader
            accent="purple"
            eyebrow="Discover"
            title="Recommended For You"
            description="Hand-picked characters worth chatting with — based on what's popular right now."
            href="/explore"
            hrefLabel="See more"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            {data.recommended_characters.map((char) => (
              <Link
                key={char.id}
                href={`/characters/${char.id}`}
                className="relative p-4 bg-gradient-to-br from-purple-950/30 to-slate-800/50 border border-purple-900/30 rounded-xl hover:border-purple-500/50 transition-all hover:-translate-y-0.5 group overflow-hidden"
              >
                <div className="absolute -top-8 -right-8 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
                <div className="relative">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center text-lg shrink-0 overflow-hidden ring-2 ring-purple-900/40">
                      {char.avatar_url ? (
                        <img src={char.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : '🎭'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white truncate group-hover:text-purple-300 transition-colors">{char.name}</h3>
                      <p className="text-xs text-slate-500">
                        by {char.creator_name}
                        {char.world_name && <span className="text-purple-400"> · {char.world_name}</span>}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-400 line-clamp-2 mb-3">
                    {char.description || 'A mysterious character awaits...'}
                  </p>
                  <div className="flex items-center gap-2 text-xs flex-wrap">
                    <span className="px-1.5 py-0.5 bg-amber-900/30 text-amber-400 rounded-full border border-amber-800/40">👍 {char.like_count}</span>
                    <span className="px-1.5 py-0.5 bg-green-900/30 text-green-400 rounded-full border border-green-800/40">💬 {char.chat_count}</span>
                    {char.tags?.slice(0, 2).map((tag) => (
                      <span key={tag} className="px-1.5 py-0.5 bg-slate-700/50 rounded-full text-slate-400">{tag}</span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* ─────────────── LEADERBOARDS (amber/gold) ─────────────── */}
      <SectionHeader
        accent="amber"
        eyebrow="Leaderboards"
        title="Top of the Realm"
        description="The most-loved characters, most-active worlds, and most prolific writers right now."
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
        {/* Top Characters */}
        <LeaderboardPanel title="Top Characters" icon="🏆" empty="No votes yet">
          {data.leaderboards.top_characters.map((char, i) => (
            <Link
              key={char.id}
              href={`/characters/${char.id}`}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-amber-900/10 transition-colors"
            >
              <Rank i={i} />
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center text-xs shrink-0 overflow-hidden">
                {char.avatar_url ? (
                  <img src={char.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : '🎭'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{char.name}</p>
                <p className="text-xs text-slate-500">{char.creator_name}</p>
              </div>
              <span className="text-xs text-amber-400 shrink-0 font-semibold">👍 {char.like_count}</span>
            </Link>
          ))}
        </LeaderboardPanel>

        {/* Top Worlds */}
        <LeaderboardPanel title="Top Worlds" icon="🌍" empty="No worlds yet">
          {data.leaderboards.top_worlds.map((world, i) => (
            <Link
              key={world.id}
              href={`/worlds/${world.id}`}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-amber-900/10 transition-colors"
            >
              <Rank i={i} />
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
        </LeaderboardPanel>

        {/* Top Users */}
        <LeaderboardPanel title="Most Active" icon="👑" empty="No activity yet">
          {data.leaderboards.top_users.map((u, i) => (
            <Link
              key={u.id}
              href={`/users/${u.id}`}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-amber-900/10 transition-colors"
            >
              <Rank i={i} />
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center text-sm font-bold text-white">
                {u.username[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm truncate ${tierColors[u.subscription] || 'text-white'}`}>{u.username}</p>
                <p className="text-xs text-slate-500">{u.total_chats} chats</p>
              </div>
            </Link>
          ))}
        </LeaderboardPanel>
      </div>

      {/* ─────────────── QUICK LINKS FOOTER ─────────────── */}
      {/* Distinct treatment — compact, color-coded shortcuts to other parts of the app. */}
      <div className="border-t border-slate-800 pt-6">
        <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">Jump to</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <QuickLink href="/worlds" emoji="🌍" label="Browse Worlds" color="amber" />
          <QuickLink href="/forum" emoji="💬" label="Forum" color="blue" />
          <QuickLink href="/characters" emoji="🎭" label="My Characters" color="red" />
          <QuickLink href="/settings" emoji="⚙️" label="Settings" color="purple" />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Helper components — kept inline so the file stays self-contained.
// ─────────────────────────────────────────────────────────────

const accentText: Record<string, string> = {
  red: 'text-red-400',
  amber: 'text-amber-400',
  purple: 'text-purple-400',
  blue: 'text-blue-400',
  green: 'text-green-400',
};
const accentBar: Record<string, string> = {
  red: 'bg-red-500',
  amber: 'bg-amber-500',
  purple: 'bg-purple-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
};
const accentBorder: Record<string, string> = {
  red: 'border-red-900/40',
  amber: 'border-amber-900/40',
  purple: 'border-purple-900/40',
  blue: 'border-blue-900/40',
  green: 'border-green-900/40',
};

/**
 * Section header — colored eyebrow + title + description + optional "see all" link.
 * Used to break up the page into themed bands.
 */
function SectionHeader({
  accent,
  eyebrow,
  title,
  description,
  href,
  hrefLabel,
}: {
  accent: 'red' | 'amber' | 'purple' | 'blue' | 'green';
  eyebrow: string;
  title: string;
  description?: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="flex items-end justify-between mb-4 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-1 h-10 rounded-full ${accentBar[accent]} shrink-0`} />
        <div className="min-w-0">
          <p className={`text-[10px] uppercase tracking-widest ${accentText[accent]} font-bold mb-0.5`}>
            {eyebrow}
          </p>
          <h2 className="text-xl font-bold text-white leading-tight">{title}</h2>
          {description && (
            <p className="text-xs text-slate-500 mt-0.5 truncate sm:whitespace-normal">{description}</p>
          )}
        </div>
      </div>
      {href && (
        <Link href={href} className={`text-xs ${accentText[accent]} hover:opacity-80 shrink-0 whitespace-nowrap`}>
          {hrefLabel || 'See all'} →
        </Link>
      )}
    </div>
  );
}

/**
 * Generic content panel with an accent-colored top stripe.
 */
function Panel({
  accent,
  title,
  href,
  hrefLabel,
  children,
}: {
  accent: 'red' | 'amber' | 'purple' | 'blue' | 'green';
  title: React.ReactNode;
  href?: string;
  hrefLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`relative bg-slate-800/50 border ${accentBorder[accent]} rounded-xl p-5 overflow-hidden`}>
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${accentBar[accent]} opacity-60`} />
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white">{title}</h3>
        {href && (
          <Link href={href} className={`text-xs ${accentText[accent]} hover:opacity-80`}>
            {hrefLabel || 'View all'}
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

/**
 * Leaderboard panel — gold-themed, slightly taller than the regular Panel
 * so leaderboards visually pop against the rest of the page.
 */
function LeaderboardPanel({
  title,
  icon,
  empty,
  children,
}: {
  title: string;
  icon: string;
  empty: string;
  children: React.ReactNode;
}) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <div className="relative bg-gradient-to-b from-amber-950/20 to-slate-800/50 border border-amber-900/30 rounded-xl p-5 overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500" />
      <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <span>{title}</span>
      </h3>
      {items.length === 0 || (Array.isArray(children) && (children as any).length === 0) ? (
        <p className="text-slate-500 text-sm text-center py-4">{empty}</p>
      ) : (
        <div className="space-y-1">{children}</div>
      )}
    </div>
  );
}

/** Numeric rank pill — gold/silver/bronze for top 3. */
function Rank({ i }: { i: number }) {
  const cls =
    i === 0 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
    i === 1 ? 'bg-slate-300/10 text-slate-200 border border-slate-400/30' :
    i === 2 ? 'bg-amber-700/20 text-amber-500 border border-amber-700/40' :
    'bg-slate-700/30 text-slate-400 border border-slate-700/50';
  return (
    <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${cls}`}>
      {i + 1}
    </span>
  );
}

/** Compact footer link card with color-coded hover. */
function QuickLink({
  href,
  emoji,
  label,
  color,
}: {
  href: string;
  emoji: string;
  label: string;
  color: 'red' | 'amber' | 'purple' | 'blue';
}) {
  const hover: Record<string, string> = {
    red: 'hover:border-red-500/40 hover:bg-red-900/10',
    amber: 'hover:border-amber-500/40 hover:bg-amber-900/10',
    purple: 'hover:border-purple-500/40 hover:bg-purple-900/10',
    blue: 'hover:border-blue-500/40 hover:bg-blue-900/10',
  };
  return (
    <Link
      href={href}
      className={`p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl text-center transition-all group ${hover[color]}`}
    >
      <div className="text-2xl mb-1">{emoji}</div>
      <p className="text-sm text-slate-300 group-hover:text-white transition-colors">{label}</p>
    </Link>
  );
}
