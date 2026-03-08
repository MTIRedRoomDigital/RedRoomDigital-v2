'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import Link from 'next/link';

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  narrative_arc: string | null;
  status: string;
  quest_count: number;
  creator_name: string;
  created_at: string;
}

interface WorldInfo {
  id: string;
  name: string;
  creator_id: string;
}

export default function CampaignsPage() {
  const { id: worldId } = useParams();
  const { user } = useAuth();
  const router = useRouter();

  const [world, setWorld] = useState<WorldInfo | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [isWorldMaster, setIsWorldMaster] = useState(false);

  // Create campaign form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newArc, setNewArc] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!worldId) return;

    const loadData = async () => {
      // Get world info
      const worldRes = await api.get<WorldInfo>(`/api/worlds/${worldId}`);
      if (worldRes.success && worldRes.data) {
        const w = worldRes.data as any;
        setWorld(w);

        // Check if user is WorldMaster
        if (user) {
          const isMaster = w.creator_id === user.id ||
            w.members?.some((m: any) => m.user_id === user.id && m.is_worldmaster);
          setIsWorldMaster(!!isMaster);
        }
      }

      // Get campaigns
      const campRes = await api.get<Campaign[]>(`/api/campaigns/world/${worldId}`);
      if (campRes.success && campRes.data) {
        setCampaigns(campRes.data as any);
      }

      setLoading(false);
    };

    loadData();
  }, [worldId, user]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);

    const res = await api.post<Campaign>('/api/campaigns', {
      world_id: worldId,
      name: newName.trim(),
      description: newDesc.trim() || null,
      narrative_arc: newArc.trim() || null,
    });

    if (res.success && res.data) {
      setCampaigns([...campaigns, res.data as any]);
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
      setNewArc('');
    }

    setCreating(false);
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-slate-700 text-slate-400',
    active: 'bg-green-900/30 text-green-400',
    completed: 'bg-blue-900/30 text-blue-400',
    archived: 'bg-slate-700 text-slate-500',
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-slate-400">Loading campaigns...</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <Link href={`/worlds/${worldId}`} className="text-sm text-slate-400 hover:text-white transition-colors mb-4 inline-block">
        &larr; Back to {world?.name || 'World'}
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Campaigns</h1>
          <p className="text-slate-400 text-sm mt-1">{world?.name}</p>
        </div>
        {isWorldMaster && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
          >
            + New Campaign
          </button>
        )}
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="mb-6 p-5 bg-slate-800 border border-slate-700 rounded-xl">
          <h3 className="text-lg font-semibold text-white mb-4">Create Campaign</h3>

          <div className="space-y-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Campaign Name *</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., The Crystal Crusade"
                className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Description</label>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="What is this campaign about?"
                rows={2}
                className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Narrative Arc</label>
              <textarea
                value={newArc}
                onChange={(e) => setNewArc(e.target.value)}
                placeholder="The overarching story structure... (beginning, rising action, climax, resolution)"
                rows={3}
                className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || creating}
                className="px-5 py-2 text-sm bg-amber-600 hover:bg-amber-700 disabled:bg-slate-700 text-white rounded-lg transition-colors"
              >
                {creating ? 'Creating...' : 'Create Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Campaign List */}
      {campaigns.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">⚔️</div>
          <h2 className="text-xl font-bold text-white mb-2">No campaigns yet</h2>
          <p className="text-slate-400">
            {isWorldMaster
              ? 'Create your first campaign to start building quests and adventures!'
              : 'The WorldMaster hasn\'t created any campaigns yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((campaign) => (
            <Link
              key={campaign.id}
              href={`/campaigns/${campaign.id}`}
              className="group block p-5 bg-slate-800 border border-slate-700 rounded-xl hover:border-amber-500/50 transition-all"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚔️</span>
                  <h3 className="font-semibold text-white group-hover:text-amber-400 transition-colors">
                    {campaign.name}
                  </h3>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[campaign.status] || statusColors.draft}`}>
                  {campaign.status}
                </span>
              </div>

              {campaign.description && (
                <p className="text-sm text-slate-400 mb-3 line-clamp-2">{campaign.description}</p>
              )}

              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span>{campaign.quest_count} quests</span>
                <span>by {campaign.creator_name}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
