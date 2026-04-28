'use client';

/**
 * World Bible editor — creator-only.
 *
 * Lets the world creator add / reorder / edit / delete sections. Sections
 * are stored on the world row as a JSONB array. Saves are sent through
 * the existing PUT /api/worlds/:id endpoint with `{ bible: [...] }`.
 *
 * This is intentionally simple: title + icon + blurb + plain-text body,
 * one section at a time. Markdown / rich text can come later.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface BibleSection {
  id: string;
  icon: string;
  title: string;
  blurb: string;
  body: string;
}

interface World {
  id: string;
  name: string;
  creator_id: string;
  bible: BibleSection[] | null;
}

const SUGGESTED_ICONS = ['📜', '🌍', '⚔️', '🧙', '👑', '🗺️', '🏛️', '⛓️', '✨', '🔥', '🌊', '🌑', '📖', '🎭', '🛡️', '⚖️'];

// Common templates the creator can stamp in to get going.
const TEMPLATES: { title: string; icon: string; blurb: string; body: string }[] = [
  { title: 'Overview', icon: '🌍', blurb: 'The world in a paragraph or two.', body: '' },
  { title: 'History', icon: '📜', blurb: 'Major events, in order.', body: '' },
  { title: 'Geography', icon: '🗺️', blurb: 'Regions, cities, important places.', body: '' },
  { title: 'Factions', icon: '⚔️', blurb: 'Who holds power, who wants it.', body: '' },
  { title: 'Magic / Tech', icon: '✨', blurb: 'How the rules of the world bend.', body: '' },
  { title: 'Glossary', icon: '📖', blurb: 'Terms, names, and titles.', body: '' },
];

function newId() {
  // Short, stable, doesn't need to be cryptographic — these are anchor ids.
  return Math.random().toString(36).slice(2, 10);
}

export default function WorldBibleEditPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [world, setWorld] = useState<World | null>(null);
  const [sections, setSections] = useState<BibleSection[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load world + auth gate
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    if (!id) return;
    api.get<World>(`/api/worlds/${id}`).then((res) => {
      if (!res.success || !res.data) {
        router.push(`/worlds/${id}`);
        return;
      }
      const w = res.data as any;
      if (w.creator_id !== user.id) {
        router.push(`/worlds/${id}/bible`);
        return;
      }
      setWorld(w);
      setSections((w.bible || []) as BibleSection[]);
      setLoading(false);
    });
  }, [id, user, authLoading, router]);

  const save = async (next: BibleSection[]) => {
    if (!world) return;
    setSaving(true);
    setError(null);
    const res = await api.put(`/api/worlds/${world.id}`, { bible: next });
    setSaving(false);
    if (res.success) {
      setSavedAt(new Date());
    } else {
      setError((res as any).message || 'Failed to save');
    }
  };

  const handleAddBlank = () => {
    const s: BibleSection = { id: newId(), icon: '📄', title: 'New Section', blurb: '', body: '' };
    const next = [...sections, s];
    setSections(next);
    setEditing(s.id);
    save(next);
  };

  const handleAddTemplate = (t: typeof TEMPLATES[number]) => {
    const s: BibleSection = { id: newId(), icon: t.icon, title: t.title, blurb: t.blurb, body: t.body };
    const next = [...sections, s];
    setSections(next);
    setEditing(s.id);
    save(next);
  };

  const handleUpdate = (id: string, patch: Partial<BibleSection>) => {
    const next = sections.map((s) => (s.id === id ? { ...s, ...patch } : s));
    setSections(next);
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this section? This cannot be undone.')) return;
    const next = sections.filter((s) => s.id !== id);
    setSections(next);
    save(next);
  };

  const handleMove = (id: string, dir: -1 | 1) => {
    const idx = sections.findIndex((s) => s.id === id);
    const swap = idx + dir;
    if (idx === -1 || swap < 0 || swap >= sections.length) return;
    const next = [...sections];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setSections(next);
    save(next);
  };

  if (authLoading || loading) {
    return <div className="max-w-4xl mx-auto px-4 py-8 text-slate-400">Loading…</div>;
  }
  if (!world) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-400 mb-4">
        <Link href={`/worlds/${world.id}`} className="hover:text-white">{world.name}</Link>
        <span>/</span>
        <Link href={`/worlds/${world.id}/bible`} className="hover:text-white">Bible</Link>
        <span>/</span>
        <span className="text-white">Edit</span>
      </div>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-amber-400 font-bold mb-1">Edit Bible</p>
          <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight">{world.name}</h1>
          <p className="text-sm text-slate-500 mt-1">
            Add sections, reorder them, and write deep lore. Saves automatically.
          </p>
        </div>
        <div className="text-right shrink-0">
          {saving && <p className="text-xs text-slate-500">Saving…</p>}
          {!saving && savedAt && <p className="text-xs text-green-400">Saved {savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>}
          {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
        </div>
      </div>

      {/* Empty state with templates */}
      {sections.length === 0 && (
        <div className="mb-6 p-5 rounded-xl bg-gradient-to-br from-amber-950/20 to-slate-800/40 border border-amber-900/30">
          <h3 className="font-semibold text-white mb-1">Start with a template</h3>
          <p className="text-xs text-slate-400 mb-4">
            Pick one to add — you can edit, reorder, and add more after.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.title}
                onClick={() => handleAddTemplate(t)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-amber-700 rounded-lg text-left transition-colors"
              >
                <span className="text-xl">{t.icon}</span>
                <div className="min-w-0">
                  <div className="text-sm text-white truncate">{t.title}</div>
                  <div className="text-[10px] text-slate-500 truncate">{t.blurb}</div>
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={handleAddBlank}
            className="mt-3 text-sm text-slate-400 hover:text-white"
          >
            + Add blank section
          </button>
        </div>
      )}

      {/* Sections list */}
      <div className="space-y-3">
        {sections.map((s, i) => (
          <div
            key={s.id}
            className="bg-slate-800/40 border border-slate-700 rounded-xl"
          >
            {editing === s.id ? (
              <div className="p-4 space-y-3">
                <div className="flex gap-2">
                  <select
                    value={s.icon}
                    onChange={(e) => handleUpdate(s.id, { icon: e.target.value })}
                    className="px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-lg"
                  >
                    {SUGGESTED_ICONS.map((ic) => (
                      <option key={ic} value={ic}>{ic}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={s.title}
                    onChange={(e) => handleUpdate(s.id, { title: e.target.value })}
                    placeholder="Section title"
                    className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-white text-sm"
                  />
                </div>
                <input
                  type="text"
                  value={s.blurb}
                  onChange={(e) => handleUpdate(s.id, { blurb: e.target.value })}
                  placeholder="One-line subtitle (optional)"
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-white text-xs"
                />
                <textarea
                  value={s.body}
                  onChange={(e) => handleUpdate(s.id, { body: e.target.value })}
                  placeholder="Section content. Plain text — line breaks preserved."
                  rows={10}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm leading-relaxed font-mono"
                />
                <div className="flex justify-between items-center">
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Delete section
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setEditing(null); save(sections); }}
                      className="px-4 py-1.5 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 flex items-center gap-3">
                <span className="text-2xl">{s.icon || '📄'}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white truncate">{s.title}</div>
                  {s.blurb && <div className="text-xs text-slate-500 truncate">{s.blurb}</div>}
                  <div className="text-xs text-slate-600 mt-0.5">
                    {s.body.length === 0 ? 'Empty' : `${s.body.length} characters`}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleMove(s.id, -1)}
                    disabled={i === 0}
                    className="px-2 py-1 text-slate-400 hover:text-white disabled:opacity-30 text-xs"
                    title="Move up"
                  >▲</button>
                  <button
                    onClick={() => handleMove(s.id, 1)}
                    disabled={i === sections.length - 1}
                    className="px-2 py-1 text-slate-400 hover:text-white disabled:opacity-30 text-xs"
                    title="Move down"
                  >▼</button>
                  <button
                    onClick={() => setEditing(s.id)}
                    className="px-3 py-1.5 text-xs border border-slate-600 text-slate-300 hover:text-white rounded ml-1"
                  >
                    Edit
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add buttons */}
      {sections.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={handleAddBlank}
            className="px-4 py-2 text-sm border border-amber-700/50 text-amber-400 hover:bg-amber-900/20 rounded-lg"
          >
            + Blank section
          </button>
          {TEMPLATES.filter((t) => !sections.some((s) => s.title === t.title)).slice(0, 4).map((t) => (
            <button
              key={t.title}
              onClick={() => handleAddTemplate(t)}
              className="px-3 py-2 text-xs border border-slate-700 text-slate-400 hover:text-white rounded-lg"
            >
              + {t.icon} {t.title}
            </button>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 pt-6 border-t border-slate-800 flex justify-between text-sm">
        <Link href={`/worlds/${world.id}/bible`} className="text-slate-400 hover:text-white">
          ← Back to Bible
        </Link>
        <Link href={`/worlds/${world.id}`} className="text-slate-400 hover:text-white">
          Back to world →
        </Link>
      </div>
    </div>
  );
}
