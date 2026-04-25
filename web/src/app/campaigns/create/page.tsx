'use client';

/**
 * Campaign creation flow.
 *
 * Step 1: Pick a world. Only worlds the user is WorldMaster of are eligible
 *         (currently filtered to worlds they CREATED — proper WorldMaster
 *         membership filter can be added later).
 * Step 2: Fill in name / description / premise / participant range.
 *
 * On submit, posts to /api/campaigns and redirects to the new campaign page.
 */

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface OwnedWorld {
  id: string;
  name: string;
  thumbnail_url: string | null;
  setting: string | null;
}

export default function CreateCampaignPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetWorldId = searchParams.get('world');

  const [worlds, setWorlds] = useState<OwnedWorld[]>([]);
  const [worldsLoading, setWorldsLoading] = useState(true);
  const [worldId, setWorldId] = useState<string>(presetWorldId || '');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [premise, setPremise] = useState('');
  const [minParticipants, setMinParticipants] = useState(2);
  const [maxParticipants, setMaxParticipants] = useState(6);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auth gate
  useEffect(() => {
    if (!authLoading && !user) router.push('/login?next=/campaigns/create');
  }, [user, authLoading, router]);

  // Load user's owned worlds
  useEffect(() => {
    if (!user) return;
    api.get<{ worlds: OwnedWorld[] }>(`/api/users/profile`).then((res) => {
      if (res.success && res.data) {
        const list = ((res.data as any).worlds || []) as OwnedWorld[];
        setWorlds(list);
        // Auto-pick if there's only one world
        if (!worldId && list.length === 1) setWorldId(list[0].id);
      }
      setWorldsLoading(false);
    });
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSubmit = !!worldId && name.trim().length > 0 && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    const res = await api.post<{ id: string }>('/api/campaigns', {
      world_id: worldId,
      name: name.trim(),
      description: description.trim() || undefined,
      premise: premise.trim() || undefined,
      min_participants: minParticipants,
      max_participants: maxParticipants,
    });
    if (res.success && res.data) {
      router.push(`/campaigns/${(res.data as any).id}`);
    } else {
      setError((res as any).message || 'Failed to create campaign');
      setSubmitting(false);
    }
  };

  if (authLoading || worldsLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-3">
          <div className="h-8 bg-slate-700 rounded w-1/3" />
          <div className="h-32 bg-slate-800 rounded-xl" />
        </div>
      </div>
    );
  }

  // No worlds → guide them to create one first
  if (worlds.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">⚔️</div>
        <h1 className="text-2xl font-bold text-white mb-2">No Worlds Yet</h1>
        <p className="text-slate-400 mb-6">
          Campaigns happen inside worlds. Create a world first — you&apos;ll automatically be its WorldMaster and can run campaigns there.
        </p>
        <Link
          href="/worlds/create"
          className="inline-block px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors font-medium"
        >
          Create a World
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Create Campaign</h1>
        <p className="text-sm text-slate-400">
          A campaign is a world-changing event — an election, a war, a heist. Characters take turns playing it out, and when it ends you can approve the results to become permanent canon.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* World picker */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">World</label>
          {worlds.length === 1 ? (
            <div className="px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg flex items-center gap-3">
              {worlds[0].thumbnail_url ? (
                <img src={worlds[0].thumbnail_url} alt={worlds[0].name} className="w-8 h-8 rounded object-cover" />
              ) : (
                <span className="text-lg">🌍</span>
              )}
              <div className="flex-1">
                <div className="text-sm font-medium text-white">{worlds[0].name}</div>
                {worlds[0].setting && (
                  <div className="text-xs text-slate-500">{worlds[0].setting}</div>
                )}
              </div>
            </div>
          ) : (
            <select
              value={worldId}
              onChange={(e) => setWorldId(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
              required
            >
              <option value="">— Pick a world —</option>
              {worlds.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}{w.setting ? ` — ${w.setting}` : ''}
                </option>
              ))}
            </select>
          )}
          <p className="text-xs text-slate-500 mt-1.5">
            Only worlds you created appear here. The campaign will fit the world&apos;s tone — a modern campaign in a medieval world counts as a contradiction.
          </p>
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Campaign Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="The Siege of Ironhold"
            className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
            maxLength={100}
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Short Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="The capital is under attack."
            className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
            maxLength={200}
          />
        </div>

        {/* Premise */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Premise</label>
          <textarea
            value={premise}
            onChange={(e) => setPremise(e.target.value)}
            placeholder="The setup that all players read before the campaign begins. Set the stakes, the location, the conflict."
            rows={5}
            className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500 resize-none"
            maxLength={2000}
          />
          <p className="text-xs text-slate-500 mt-1.5">
            The premise is the prompt — a clear premise makes for better campaigns. The AI also reads it when checking world consistency.
          </p>
        </div>

        {/* Participants */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Min Participants</label>
            <input
              type="number"
              value={minParticipants}
              onChange={(e) => setMinParticipants(Math.max(2, parseInt(e.target.value) || 2))}
              min={2}
              max={maxParticipants}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Max Participants</label>
            <input
              type="number"
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(Math.max(minParticipants, parseInt(e.target.value) || 6))}
              min={minParticipants}
              max={20}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-900/20 border border-red-700/30 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={!canSubmit}
            className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
          >
            {submitting ? 'Creating...' : 'Create Campaign'}
          </button>
          <Link
            href="/worlds"
            className="px-6 py-2.5 border border-slate-600 text-slate-300 hover:text-white rounded-lg transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
