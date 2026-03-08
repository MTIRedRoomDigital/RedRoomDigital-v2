'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import Link from 'next/link';

interface Quest {
  id: string;
  name: string;
  description: string | null;
  objectives: { description: string; completed: boolean }[];
  rewards: { lore_reveal?: string; items?: string[] };
  lore_reveals: string | null;
  status: string;
  participant_count: number;
}

interface CampaignData {
  id: string;
  world_id: string;
  world_name: string;
  name: string;
  description: string | null;
  narrative_arc: string | null;
  status: string;
  creator_name: string;
  created_at: string;
  quests: Quest[];
}

export default function CampaignDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();

  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isWorldMaster, setIsWorldMaster] = useState(false);

  // Create quest form
  const [showCreate, setShowCreate] = useState(false);
  const [questName, setQuestName] = useState('');
  const [questDesc, setQuestDesc] = useState('');
  const [questObjectives, setQuestObjectives] = useState('');
  const [questLore, setQuestLore] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!id) return;

    const loadData = async () => {
      const res = await api.get<CampaignData>(`/api/campaigns/${id}`);
      if (res.success && res.data) {
        const c = res.data as any;
        setCampaign(c);

        // Check WorldMaster status
        if (user && c.world_id) {
          const worldRes = await api.get<any>(`/api/worlds/${c.world_id}`);
          if (worldRes.success && worldRes.data) {
            const w = worldRes.data as any;
            const isMaster = w.creator_id === user.id ||
              w.members?.some((m: any) => m.user_id === user.id && m.is_worldmaster);
            setIsWorldMaster(!!isMaster);
          }
        }
      }
      setLoading(false);
    };

    loadData();
  }, [id, user]);

  const handleCreateQuest = async () => {
    if (!questName.trim() || !campaign) return;
    setCreating(true);

    const objectives = questObjectives
      .split('\n')
      .filter((o) => o.trim())
      .map((o) => ({ description: o.trim(), completed: false }));

    const res = await api.post<Quest>(`/api/campaigns/${campaign.id}/quests`, {
      name: questName.trim(),
      description: questDesc.trim() || null,
      objectives: objectives.length > 0 ? objectives : null,
      lore_reveals: questLore.trim() || null,
    });

    if (res.success && res.data) {
      setCampaign({
        ...campaign,
        quests: [...campaign.quests, { ...(res.data as any), participant_count: 0 }],
      });
      setShowCreate(false);
      setQuestName('');
      setQuestDesc('');
      setQuestObjectives('');
      setQuestLore('');
    }

    setCreating(false);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!campaign) return;

    const res = await api.put(`/api/campaigns/${campaign.id}`, { status: newStatus });
    if (res.success) {
      setCampaign({ ...campaign, status: newStatus });
    }
  };

  const handleQuestStatus = async (questId: string, newStatus: string) => {
    if (!campaign) return;

    const res = await api.put(`/api/campaigns/quests/${questId}`, { status: newStatus });
    if (res.success) {
      setCampaign({
        ...campaign,
        quests: campaign.quests.map((q) =>
          q.id === questId ? { ...q, status: newStatus } : q
        ),
      });
    }
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
        <div className="text-slate-400">Loading campaign...</div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center text-center">
        <div>
          <div className="text-4xl mb-4">⚔️</div>
          <h2 className="text-xl font-bold text-white mb-2">Campaign Not Found</h2>
          <Link href="/worlds" className="text-amber-400 hover:text-amber-300">&larr; Browse Worlds</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-400 mb-4">
        <Link href={`/worlds/${campaign.world_id}`} className="hover:text-white transition-colors">
          {campaign.world_name}
        </Link>
        <span>/</span>
        <Link href={`/worlds/${campaign.world_id}/campaigns`} className="hover:text-white transition-colors">
          Campaigns
        </Link>
        <span>/</span>
        <span className="text-slate-300">{campaign.name}</span>
      </div>

      {/* Campaign Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold text-white">{campaign.name}</h1>
          <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[campaign.status]}`}>
            {campaign.status}
          </span>
        </div>

        {campaign.description && (
          <p className="text-slate-300 mb-3">{campaign.description}</p>
        )}

        <div className="flex items-center gap-4 text-sm text-slate-500">
          <span>Created by <span className="text-slate-300">{campaign.creator_name}</span></span>
          <span>{campaign.quests.length} quests</span>
        </div>

        {/* WorldMaster Controls */}
        {isWorldMaster && (
          <div className="flex gap-2 mt-4">
            {campaign.status === 'draft' && (
              <button
                onClick={() => handleStatusChange('active')}
                className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                Activate Campaign
              </button>
            )}
            {campaign.status === 'active' && (
              <button
                onClick={() => handleStatusChange('completed')}
                className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Mark Completed
              </button>
            )}
            {campaign.status !== 'archived' && (
              <button
                onClick={() => handleStatusChange('archived')}
                className="px-3 py-1.5 text-xs bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors"
              >
                Archive
              </button>
            )}
          </div>
        )}
      </div>

      {/* Narrative Arc */}
      {campaign.narrative_arc && (
        <div className="p-5 bg-slate-800 border border-slate-700 rounded-xl mb-6">
          <h3 className="text-sm font-semibold text-amber-400 mb-2">📖 Narrative Arc</h3>
          <p className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">{campaign.narrative_arc}</p>
        </div>
      )}

      {/* Quests Section */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Quests</h2>
        {isWorldMaster && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-4 py-1.5 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
          >
            + Add Quest
          </button>
        )}
      </div>

      {/* Create Quest Form */}
      {showCreate && (
        <div className="mb-4 p-5 bg-slate-800 border border-slate-700 rounded-xl">
          <h3 className="text-lg font-semibold text-white mb-3">New Quest</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Quest Name *</label>
              <input
                type="text"
                value={questName}
                onChange={(e) => setQuestName(e.target.value)}
                placeholder="e.g., Retrieve the Crystal Shard"
                className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Description</label>
              <textarea
                value={questDesc}
                onChange={(e) => setQuestDesc(e.target.value)}
                placeholder="What must the adventurers do?"
                rows={2}
                className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Objectives (one per line)</label>
              <textarea
                value={questObjectives}
                onChange={(e) => setQuestObjectives(e.target.value)}
                placeholder={"Find the hidden entrance\nDefeat the crystal guardian\nRetrieve the shard"}
                rows={3}
                className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Lore Reveals (unlocked on completion)</label>
              <textarea
                value={questLore}
                onChange={(e) => setQuestLore(e.target.value)}
                placeholder="Secret lore revealed when the quest is completed..."
                rows={2}
                className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white">
                Cancel
              </button>
              <button
                onClick={handleCreateQuest}
                disabled={!questName.trim() || creating}
                className="px-5 py-2 text-sm bg-amber-600 hover:bg-amber-700 disabled:bg-slate-700 text-white rounded-lg transition-colors"
              >
                {creating ? 'Creating...' : 'Create Quest'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quest List */}
      {campaign.quests.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">🗡️</div>
          <p className="text-slate-400">No quests in this campaign yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaign.quests.map((quest, index) => {
            const objectives = quest.objectives || [];
            const completedCount = objectives.filter((o) => o.completed).length;

            return (
              <div
                key={quest.id}
                className="p-5 bg-slate-800 border border-slate-700 rounded-xl"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500 font-mono">#{index + 1}</span>
                    <h3 className="font-semibold text-white">{quest.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[quest.status]}`}>
                      {quest.status}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">{quest.participant_count} participants</span>
                </div>

                {quest.description && (
                  <p className="text-sm text-slate-400 mb-3">{quest.description}</p>
                )}

                {/* Objectives */}
                {objectives.length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-xs uppercase tracking-wider text-slate-500 mb-1.5">
                      Objectives ({completedCount}/{objectives.length})
                    </h4>
                    <div className="space-y-1">
                      {objectives.map((obj, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span className={obj.completed ? 'text-green-400' : 'text-slate-500'}>
                            {obj.completed ? '✅' : '⬜'}
                          </span>
                          <span className={obj.completed ? 'text-slate-500 line-through' : 'text-slate-300'}>
                            {obj.description}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lore Reveal (only show if completed) */}
                {quest.status === 'completed' && quest.lore_reveals && (
                  <div className="mt-3 p-3 bg-amber-900/10 border border-amber-800/30 rounded-lg">
                    <h4 className="text-xs text-amber-400 font-semibold mb-1">📜 Lore Revealed</h4>
                    <p className="text-sm text-slate-300">{quest.lore_reveals}</p>
                  </div>
                )}

                {/* WorldMaster Quest Controls */}
                {isWorldMaster && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-slate-700">
                    {quest.status === 'draft' && (
                      <button
                        onClick={() => handleQuestStatus(quest.id, 'active')}
                        className="px-3 py-1 text-xs bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded transition-colors"
                      >
                        Activate
                      </button>
                    )}
                    {quest.status === 'active' && (
                      <button
                        onClick={() => handleQuestStatus(quest.id, 'completed')}
                        className="px-3 py-1 text-xs bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded transition-colors"
                      >
                        Complete
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
