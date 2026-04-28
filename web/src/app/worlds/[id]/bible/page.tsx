'use client';

/**
 * World Bible — public read view.
 *
 * Layout matches /guide: sticky sidebar of sections on the left, stacked
 * section cards on the right. Section bodies render plain text with
 * paragraph + line-break preservation (no markdown lib yet — the editor
 * stores plain text).
 *
 * The Bible is the world's deep lore: history, geography, factions,
 * magic system, glossary, etc. Empty bibles are common; we show a
 * friendly empty state and (for the creator) a CTA to start writing.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface BibleSection {
  id: string;
  icon: string;
  title: string;
  blurb?: string;
  body: string;
}

interface World {
  id: string;
  name: string;
  description: string | null;
  setting: string | null;
  thumbnail_url: string | null;
  creator_id: string;
  creator_name: string;
  bible: BibleSection[] | null;
}

export default function WorldBiblePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [world, setWorld] = useState<World | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    if (!id) return;
    api.get<World>(`/api/worlds/${id}`).then((res) => {
      if (res.success && res.data) {
        setWorld(res.data as any);
        const bible = ((res.data as any).bible || []) as BibleSection[];
        if (bible.length > 0) setActiveId(bible[0].id);
      }
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-700 rounded w-1/3" />
          <div className="h-64 bg-slate-800 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!world) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">📖</div>
        <h1 className="text-2xl font-bold text-white mb-2">World Not Found</h1>
        <Link href="/worlds" className="text-amber-400 hover:text-amber-300">Browse Worlds</Link>
      </div>
    );
  }

  const isCreator = user?.id === world.creator_id;
  const sections = (world.bible || []) as BibleSection[];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-400 mb-4">
        <Link href={`/worlds/${world.id}`} className="hover:text-white transition-colors">
          {world.name}
        </Link>
        <span>/</span>
        <span className="text-white">Bible</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-10">
        <div className="flex items-start gap-4">
          {world.thumbnail_url ? (
            <img src={world.thumbnail_url} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-3xl shrink-0">
              📖
            </div>
          )}
          <div>
            <p className="text-xs uppercase tracking-widest text-amber-400 font-bold mb-1">
              World Bible
            </p>
            <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight mb-1">
              {world.name}
            </h1>
            <p className="text-slate-400 text-sm max-w-2xl">
              The full canon of {world.name} — history, geography, factions, glossary. Maintained by{' '}
              <Link href={`/users/${world.creator_id}`} className="text-amber-400 hover:text-amber-300">
                {world.creator_name}
              </Link>
              .
            </p>
          </div>
        </div>
        {isCreator && (
          <Link
            href={`/worlds/${world.id}/bible/edit`}
            className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors font-medium shrink-0"
          >
            Edit Bible
          </Link>
        )}
      </div>

      {sections.length === 0 ? (
        <div className="text-center py-16 bg-slate-800/40 border border-slate-700 rounded-xl">
          <div className="text-5xl mb-4">📖</div>
          <h2 className="text-xl font-bold text-white mb-2">No Bible yet</h2>
          <p className="text-slate-400 max-w-md mx-auto mb-6">
            The Bible is where deep world lore lives — history, factions, glossary. {isCreator ? 'Start writing yours below.' : `Only ${world.creator_name} can write the Bible for this world.`}
          </p>
          {isCreator && (
            <Link
              href={`/worlds/${world.id}/bible/edit`}
              className="inline-block px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg transition-colors"
            >
              Start the Bible
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8">
          {/* Sidebar nav */}
          <nav className="lg:sticky lg:top-20 h-fit">
            <ul className="space-y-1">
              {sections.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => {
                      setActiveId(s.id);
                      if (typeof window !== 'undefined') {
                        document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                      activeId === s.id
                        ? 'bg-amber-600/20 text-amber-300 border border-amber-700/50'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/70 border border-transparent'
                    }`}
                  >
                    <span>{s.icon || '📄'}</span>
                    <span className="truncate">{s.title}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-6 p-4 rounded-lg bg-gradient-to-br from-amber-900/30 to-orange-900/30 border border-amber-800/40">
              <p className="text-sm font-semibold text-white mb-1">Want to play here?</p>
              <p className="text-xs text-slate-300 mb-3">
                Visit the world page to join and bring a character.
              </p>
              <Link
                href={`/worlds/${world.id}`}
                className="block text-center px-3 py-2 text-sm bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg transition-colors"
              >
                Back to {world.name}
              </Link>
            </div>
          </nav>

          {/* Sections */}
          <div className="space-y-8 min-w-0">
            {sections.map((s) => (
              <section
                key={s.id}
                id={s.id}
                className="scroll-mt-24 bg-slate-800/40 border border-slate-700/70 rounded-xl p-6"
              >
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-3xl">{s.icon || '📄'}</span>
                  <div>
                    <h2 className="text-2xl font-bold text-white">{s.title}</h2>
                    {s.blurb && <p className="text-sm text-slate-500">{s.blurb}</p>}
                  </div>
                </div>
                <div className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {s.body}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
