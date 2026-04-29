'use client';

/**
 * /worlds/mine — the "My Worlds" page that the navbar dropdown points to.
 *
 * Two sections:
 *   1. Worlds I created — I'm the WorldMaster, full edit access.
 *   2. Worlds I'm in — joined as member / worldmaster, or my character lives there.
 *
 * Each row shows: thumbnail, name, setting tag, member/character counts, my
 * relationship pill, and how many of my own characters live in it.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

type Relationship = 'creator' | 'worldmaster' | 'member' | 'character_in';

interface MyWorld {
  id: string;
  name: string;
  description: string | null;
  setting: string | null;
  thumbnail_url: string | null;
  is_public: boolean;
  is_nsfw: boolean;
  member_count: number;
  character_count: string | number;
  my_character_count: string | number;
  created_at: string;
  creator_id?: string;
  creator_name?: string;
  relationship: Relationship;
}

interface MyWorldsResponse {
  created: MyWorld[];
  joined: MyWorld[];
}

const relPill: Record<Relationship, { label: string; cls: string }> = {
  creator:      { label: 'Creator',     cls: 'bg-amber-900/40 text-amber-300 border-amber-800/50' },
  worldmaster:  { label: 'WorldMaster', cls: 'bg-purple-900/40 text-purple-300 border-purple-800/50' },
  member:       { label: 'Member',      cls: 'bg-blue-900/30 text-blue-300 border-blue-800/50' },
  character_in: { label: 'Character lives here', cls: 'bg-slate-700/40 text-slate-300 border-slate-600/50' },
};

export default function MyWorldsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<MyWorldsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login?next=/worlds/mine'); return; }
    api.get<MyWorldsResponse>('/api/users/me/worlds').then((res) => {
      if (res.success && res.data) setData(res.data as any);
      setLoading(false);
    });
  }, [user, authLoading, router]);

  if (authLoading || loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-700 rounded w-1/3" />
          <div className="h-32 bg-slate-800 rounded-xl" />
          <div className="h-32 bg-slate-800 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data) return null;
  const totalCount = data.created.length + data.joined.length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">My Worlds</h1>
          <p className="text-sm text-slate-400">
            {totalCount === 0
              ? 'You haven\'t created or joined any worlds yet.'
              : `${data.created.length} created · ${data.joined.length} joined`}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link
            href="/explore?tab=worlds"
            className="px-4 py-2 text-sm border border-slate-600 text-slate-300 hover:text-white rounded-lg transition-colors"
          >
            Browse all
          </Link>
          <Link
            href="/worlds/create"
            className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors font-medium"
          >
            + Create World
          </Link>
        </div>
      </div>

      {totalCount === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Worlds I created */}
          {data.created.length > 0 && (
            <section className="mb-10">
              <SectionHeader
                accent="amber"
                eyebrow="You created"
                title="Worlds you run"
                description="You're the WorldMaster. Edit lore, run campaigns, approve members."
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.created.map((w) => (
                  <WorldCard key={w.id} world={w} />
                ))}
              </div>
            </section>
          )}

          {/* Worlds I'm in */}
          {data.joined.length > 0 && (
            <section>
              <SectionHeader
                accent="blue"
                eyebrow="You're in"
                title="Worlds you've joined"
                description="Worlds where you're a member, or where one of your characters lives."
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.joined.map((w) => (
                  <WorldCard key={w.id} world={w} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function SectionHeader({
  accent, eyebrow, title, description,
}: { accent: 'amber' | 'blue'; eyebrow: string; title: string; description: string; }) {
  const bar = accent === 'amber' ? 'bg-amber-500' : 'bg-blue-500';
  const eyebrowText = accent === 'amber' ? 'text-amber-400' : 'text-blue-400';
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`w-1 h-10 rounded-full ${bar} shrink-0`} />
      <div>
        <p className={`text-[10px] uppercase tracking-widest ${eyebrowText} font-bold mb-0.5`}>
          {eyebrow}
        </p>
        <h2 className="text-lg font-bold text-white leading-tight">{title}</h2>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function WorldCard({ world: w }: { world: MyWorld }) {
  const pill = relPill[w.relationship];
  const myChars = parseInt(String(w.my_character_count)) || 0;
  return (
    <Link
      href={`/worlds/${w.id}`}
      className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl hover:border-amber-500/40 hover:bg-slate-800 transition-all group"
    >
      <div className="flex items-start gap-3 mb-2">
        {w.thumbnail_url ? (
          <img src={w.thumbnail_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-2xl shrink-0">
            🌍
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <h3 className="font-bold text-white group-hover:text-amber-300 transition-colors truncate">
              {w.name}
            </h3>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border uppercase tracking-wider ${pill.cls}`}>
              {pill.label}
            </span>
          </div>
          {w.relationship !== 'creator' && w.creator_name && (
            <p className="text-xs text-slate-500">by {w.creator_name}</p>
          )}
          {w.relationship === 'creator' && !w.is_public && (
            <p className="text-xs text-slate-500">Private</p>
          )}
        </div>
      </div>

      {w.setting && (
        <span className="inline-block text-[11px] text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded-full mb-2">
          {w.setting}
        </span>
      )}

      {w.description && (
        <p className="text-sm text-slate-400 line-clamp-2 mb-3">{w.description}</p>
      )}

      <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
        <span className="px-2 py-0.5 rounded-full bg-slate-900/50 border border-slate-700/60">
          👥 {w.member_count} members
        </span>
        <span className="px-2 py-0.5 rounded-full bg-slate-900/50 border border-slate-700/60">
          🎭 {w.character_count} chars
        </span>
        {myChars > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-red-900/30 text-red-300 border border-red-800/50">
            {myChars} of yours
          </span>
        )}
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16 bg-slate-800/40 border border-slate-700 rounded-xl">
      <div className="text-5xl mb-4">🌍</div>
      <h2 className="text-xl font-bold text-white mb-2">No worlds yet</h2>
      <p className="text-slate-400 max-w-md mx-auto mb-6">
        Create a world to host campaigns and shared lore, or join an existing one to put your characters somewhere.
      </p>
      <div className="flex justify-center gap-3 flex-wrap">
        <Link
          href="/worlds/create"
          className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg transition-colors"
        >
          Create a world
        </Link>
        <Link
          href="/explore?tab=worlds"
          className="px-5 py-2.5 border border-slate-600 text-slate-300 hover:text-white rounded-lg transition-colors"
        >
          Browse worlds
        </Link>
      </div>
    </div>
  );
}
