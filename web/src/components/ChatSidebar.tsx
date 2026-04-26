'use client';

/**
 * Chat side panels + user strip.
 *
 * Used on /chats/[id] (and any future shared chat surfaces) to give the page
 * an "interview" feel: big character portrait + at-a-glance info on the
 * sides, two compact user identity cards along the bottom.
 *
 * Data:
 *   - CharacterPanel pulls /api/characters/:id (with relationships).
 *   - UserStrip pulls /api/users/:id/public for each user shown.
 *
 * Layout responsibility lives at the chat page — these components just fill
 * their container.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ConsistencyBadge } from './ConsistencyBadge';

interface CharacterFull {
  id: string;
  name: string;
  avatar_url: string | null;
  description: string | null;
  personality: { traits?: string[]; values?: string[]; flaws?: string[]; speaking_style?: string } | null;
  background: string | null;
  tags: string[] | null;
  chat_count: number;
  like_count: number;
  dislike_count: number;
  contradiction_score: number;
  contradictions_updated_at: string | null;
  is_nsfw: boolean;
  world_id: string | null;
  world_name: string | null;
  creator_id: string;
  creator_name: string;
  created_at: string;
  relationships: {
    related_character_id: string;
    related_character_name: string;
    related_character_avatar: string | null;
    relationship_type: string;
  }[];
}

interface UserPublic {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  subscription: string;
  created_at: string;
  character_count: string | number;
  world_count: string | number;
  friend_count: string | number;
}

const tierStyle: Record<string, string> = {
  premium: 'bg-amber-900/30 text-amber-400 border-amber-800/50',
  ultimate: 'bg-purple-900/30 text-purple-400 border-purple-800/50',
  free: 'bg-slate-700 text-slate-400 border-slate-600/50',
};

/**
 * One full-height side panel: avatar, name, world tag, stats grid, top traits,
 * relationships preview. Tinted with an accent color so the two panels visually
 * differ.
 */
export function CharacterPanel({
  characterId,
  side,
}: {
  characterId: string;
  side: 'left' | 'right';
}) {
  const [c, setC] = useState<CharacterFull | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!characterId) return;
    api.get<CharacterFull>(`/api/characters/${characterId}`).then((res) => {
      if (res.success && res.data) setC(res.data as any);
      setLoading(false);
    });
  }, [characterId]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 text-xs">
        Loading…
      </div>
    );
  }
  if (!c) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 text-xs">
        Character unavailable
      </div>
    );
  }

  const accent = side === 'left' ? 'red' : 'amber';
  const ringClass = side === 'left' ? 'ring-red-500/40' : 'ring-amber-500/40';
  const accentText = side === 'left' ? 'text-red-400' : 'text-amber-400';
  const traits = c.personality?.traits || [];

  return (
    <div className="flex flex-col h-full p-5 overflow-y-auto">
      {/* Portrait */}
      <Link href={`/characters/${c.id}`} className="block group">
        <div className={`relative w-full aspect-square rounded-2xl bg-gradient-to-br from-red-500/20 to-purple-600/20 ring-2 ${ringClass} overflow-hidden mb-4`}>
          {c.avatar_url ? (
            <img src={c.avatar_url} alt={c.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-7xl">🎭</div>
          )}
          {/* Subtle glow on hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
        </div>
        <h3 className="text-lg font-bold text-white group-hover:text-red-400 transition-colors leading-tight">
          {c.name}
        </h3>
      </Link>

      {/* Creator + world */}
      <div className="text-xs text-slate-500 mb-3 mt-1">
        by{' '}
        <Link href={`/users/${c.creator_id}`} className="text-slate-300 hover:text-red-400 transition-colors">
          {c.creator_name}
        </Link>
        {c.world_name && c.world_id && (
          <>
            {' · '}
            <Link href={`/worlds/${c.world_id}`} className="text-amber-400 hover:text-amber-300">
              🌍 {c.world_name}
            </Link>
          </>
        )}
      </div>

      {/* Description (truncated) */}
      {c.description && (
        <p className="text-xs text-slate-400 leading-relaxed mb-4 line-clamp-3">
          {c.description}
        </p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="px-2 py-2 rounded-lg bg-slate-900/50 border border-slate-700/60 text-center">
          <div className="text-sm font-bold text-green-400">{c.chat_count}</div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Chats</div>
        </div>
        <div className="px-2 py-2 rounded-lg bg-slate-900/50 border border-slate-700/60 text-center">
          <div className="text-sm font-bold text-amber-400">{c.like_count}</div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Likes</div>
        </div>
        <div className="px-2 py-2 rounded-lg bg-slate-900/50 border border-slate-700/60 text-center">
          <div className={`text-sm font-bold ${accentText}`}>
            {c.relationships?.length || 0}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Bonds</div>
        </div>
      </div>

      {/* Consistency badge if scored */}
      {c.contradictions_updated_at && (
        <div className="mb-4">
          <ConsistencyBadge score={c.contradiction_score || 0} />
        </div>
      )}

      {/* Top traits */}
      {traits.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Traits</p>
          <div className="flex flex-wrap gap-1">
            {traits.slice(0, 6).map((t) => (
              <span key={t} className={`text-[11px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 ${accentText}`}>
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Relationships preview */}
      {c.relationships && c.relationships.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Relationships</p>
          <div className="space-y-1.5">
            {c.relationships.slice(0, 4).map((r) => (
              <Link
                key={r.related_character_id}
                href={`/characters/${r.related_character_id}`}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-800 transition-colors group"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center text-xs shrink-0 overflow-hidden">
                  {r.related_character_avatar ? (
                    <img src={r.related_character_avatar} alt="" className="w-full h-full object-cover" />
                  ) : '🎭'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white group-hover:text-red-400 transition-colors truncate">
                    {r.related_character_name}
                  </p>
                  <p className="text-[10px] text-slate-500 capitalize">{r.relationship_type}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {c.tags && c.tags.length > 0 && (
        <div className="mb-4">
          <div className="flex flex-wrap gap-1">
            {c.tags.slice(0, 5).map((t) => (
              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                #{t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <Link
        href={`/characters/${c.id}`}
        className={`mt-auto block text-center text-xs py-2 rounded-lg border ${
          side === 'left'
            ? 'border-red-800/50 text-red-400 hover:bg-red-900/20'
            : 'border-amber-800/50 text-amber-400 hover:bg-amber-900/20'
        } transition-colors`}
      >
        View full character →
      </Link>
    </div>
  );
}

/**
 * Two-up user identity strip for the bottom of the chat page. Each side shows
 * the user behind one character: avatar, username, tier, and high-level stats.
 */
export function UserStrip({
  leftUserId,
  rightUserId,
}: {
  leftUserId: string | undefined;
  rightUserId: string | undefined;
}) {
  return (
    <div className="border-t border-slate-700 bg-slate-900/40 shrink-0">
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800">
        <UserCard userId={leftUserId} side="left" />
        <UserCard userId={rightUserId} side="right" />
      </div>
    </div>
  );
}

function UserCard({ userId, side }: { userId: string | undefined; side: 'left' | 'right' }) {
  const [u, setU] = useState<UserPublic | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    api.get<UserPublic>(`/api/users/${userId}/public`).then((res) => {
      if (res.success && res.data) setU(res.data as any);
      setLoading(false);
    });
  }, [userId]);

  if (loading) {
    return <div className="px-5 py-3 text-xs text-slate-500">Loading…</div>;
  }
  if (!u) {
    return <div className="px-5 py-3 text-xs text-slate-500">User unavailable</div>;
  }

  const accent = side === 'left' ? 'text-red-400' : 'text-amber-400';
  const memberSince = new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  return (
    <Link
      href={`/users/${u.id}`}
      className={`flex items-center gap-3 px-5 py-3 hover:bg-slate-800/30 transition-colors ${
        side === 'right' ? 'md:flex-row-reverse md:text-right' : ''
      }`}
    >
      {/* Avatar */}
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center text-lg font-bold text-white shrink-0 overflow-hidden">
        {u.avatar_url ? (
          <img src={u.avatar_url} alt={u.username} className="w-full h-full object-cover" />
        ) : (
          u.username[0].toUpperCase()
        )}
      </div>

      {/* Identity */}
      <div className={`flex-1 min-w-0 ${side === 'right' ? 'md:text-right' : ''}`}>
        <div className={`flex items-center gap-2 ${side === 'right' ? 'md:flex-row-reverse' : ''}`}>
          <span className={`font-semibold text-sm ${accent} truncate`}>{u.username}</span>
          {tierStyle[u.subscription] && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wider border ${tierStyle[u.subscription]}`}>
              {u.subscription}
            </span>
          )}
        </div>
        {u.bio && (
          <p className="text-[11px] text-slate-500 truncate mt-0.5">{u.bio}</p>
        )}
      </div>

      {/* Stats */}
      <div className={`flex items-center gap-4 text-xs shrink-0 ${side === 'right' ? 'md:flex-row-reverse' : ''}`}>
        <div className="text-center">
          <div className="font-bold text-white">{u.character_count}</div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Chars</div>
        </div>
        <div className="text-center hidden sm:block">
          <div className="font-bold text-white">{u.world_count}</div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Worlds</div>
        </div>
        <div className="text-center hidden sm:block">
          <div className="font-bold text-white">{u.friend_count}</div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Friends</div>
        </div>
        <div className="text-center hidden md:block">
          <div className="font-bold text-slate-300 text-[11px]">{memberSince}</div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Member</div>
        </div>
      </div>
    </Link>
  );
}
