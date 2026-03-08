'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';

interface WorldData {
  id: string;
  creator_id: string;
  name: string;
  description: string | null;
  lore: string | null;
  rules: {
    magic_system?: string;
    technology_level?: string;
    custom_rules?: string[];
  } | null;
  setting: string | null;
  is_public: boolean;
  max_characters: number;
  member_count: number;
  character_count: number;
  creator_name: string;
  created_at: string;
  campaigns: Campaign[];
  members: Member[];
  characters: WorldCharacter[];
}

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: string;
}

interface Member {
  user_id: string;
  username: string;
  avatar_url: string | null;
  is_worldmaster: boolean;
  joined_at: string;
}

interface WorldCharacter {
  id: string;
  name: string;
  avatar_url: string | null;
  description: string | null;
  tags: string[];
  chat_count: number;
  creator_name: string;
}

export default function WorldDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const router = useRouter();

  const [world, setWorld] = useState<WorldData | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'characters' | 'members' | 'campaigns'>('overview');

  useEffect(() => {
    if (!id) return;

    api.get<WorldData>(`/api/worlds/${id}`).then((res) => {
      if (res.success && res.data) {
        setWorld(res.data as any);
      }
      setLoading(false);
    });
  }, [id]);

  const isCreator = user && world && user.id === world.creator_id;
  const isMember = user && world?.members?.some((m) => m.user_id === user.id);
  const isWorldMaster = user && world?.members?.some((m) => m.user_id === user.id && m.is_worldmaster);

  const handleJoin = async () => {
    if (!user || !world) return;
    setJoining(true);
    const res = await api.post(`/api/worlds/${world.id}/join`, {});
    if (res.success) {
      // Refresh world data
      const updated = await api.get<WorldData>(`/api/worlds/${world.id}`);
      if (updated.success && updated.data) {
        setWorld(updated.data as any);
      }
    }
    setJoining(false);
  };

  const handleLeave = async () => {
    if (!user || !world) return;
    setJoining(true);
    const res = await api.post(`/api/worlds/${world.id}/leave`, {});
    if (res.success) {
      const updated = await api.get<WorldData>(`/api/worlds/${world.id}`);
      if (updated.success && updated.data) {
        setWorld(updated.data as any);
      }
    }
    setJoining(false);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-700 rounded w-1/3 mb-4" />
          <div className="h-4 bg-slate-700 rounded w-2/3 mb-2" />
          <div className="h-4 bg-slate-700 rounded w-1/2 mb-8" />
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-slate-800 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!world) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">🌍</div>
        <h1 className="text-2xl font-bold text-white mb-2">World Not Found</h1>
        <p className="text-slate-400 mb-6">This world doesn&apos;t exist or has been deleted.</p>
        <Link href="/worlds" className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors inline-block">
          Browse Worlds
        </Link>
      </div>
    );
  }

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'characters', label: `Characters (${world.character_count})` },
    { key: 'members', label: `Members (${world.members?.length || world.member_count})` },
    { key: 'campaigns', label: `Campaigns (${world.campaigns.length})` },
  ] as const;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Back Link */}
      <Link href="/worlds" className="text-sm text-slate-400 hover:text-white transition-colors mb-4 inline-block">
        &larr; Back to Worlds
      </Link>

      {/* World Header */}
      <div className="flex items-start gap-5 mb-6">
        <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-4xl shrink-0">
          🌍
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold text-white">{world.name}</h1>
            {!world.is_public && (
              <span className="text-xs px-2 py-0.5 bg-slate-700 text-slate-400 rounded-full">Private</span>
            )}
          </div>

          {world.setting && (
            <span className="inline-block text-xs text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded-full mb-2">
              {world.setting}
            </span>
          )}

          {world.description && (
            <p className="text-slate-300 mt-1">{world.description}</p>
          )}

          <div className="flex items-center gap-4 mt-3 text-sm text-slate-500">
            <span>Created by <span className="text-slate-300">{world.creator_name}</span></span>
            <span>{new Date(world.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="shrink-0 flex flex-col gap-2">
          {isCreator || isWorldMaster ? (
            <button
              onClick={() => router.push(`/worlds/${world.id}/edit`)}
              className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
            >
              Edit World
            </button>
          ) : isMember ? (
            <button
              onClick={handleLeave}
              disabled={joining}
              className="px-4 py-2 text-sm border border-slate-600 text-slate-400 hover:text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {joining ? 'Leaving...' : 'Leave World'}
            </button>
          ) : user ? (
            <button
              onClick={handleJoin}
              disabled={joining}
              className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {joining ? 'Joining...' : 'Join World'}
            </button>
          ) : (
            <Link
              href="/login"
              className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors text-center"
            >
              Log In to Join
            </Link>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-slate-800 border border-slate-700 rounded-lg text-center">
          <div className="text-2xl font-bold text-white">{world.members?.length || world.member_count}</div>
          <div className="text-sm text-slate-400">Members</div>
        </div>
        <div className="p-4 bg-slate-800 border border-slate-700 rounded-lg text-center">
          <div className="text-2xl font-bold text-white">{world.character_count}</div>
          <div className="text-sm text-slate-400">Characters</div>
        </div>
        <div className="p-4 bg-slate-800 border border-slate-700 rounded-lg text-center">
          <div className="text-2xl font-bold text-white">{world.campaigns.length}</div>
          <div className="text-sm text-slate-400">Campaigns</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700 mb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-[1px] ${
              activeTab === t.key
                ? 'text-amber-400 border-amber-400'
                : 'text-slate-400 border-transparent hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Lore */}
          {world.lore && (
            <div className="p-5 bg-slate-800 border border-slate-700 rounded-xl">
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <span>📜</span> World Lore
              </h3>
              <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">{world.lore}</p>
            </div>
          )}

          {/* Rules */}
          {world.rules && Object.keys(world.rules).length > 0 && (
            <div className="p-5 bg-slate-800 border border-slate-700 rounded-xl">
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <span>📋</span> World Rules
              </h3>
              <div className="space-y-3">
                {world.rules.magic_system && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded-full">Magic</span>
                    <span className="text-slate-300">{world.rules.magic_system}</span>
                  </div>
                )}
                {world.rules.technology_level && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded-full">Tech</span>
                    <span className="text-slate-300">{world.rules.technology_level}</span>
                  </div>
                )}
                {world.rules.custom_rules && world.rules.custom_rules.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-400 mb-2">Custom Rules</h4>
                    <ul className="space-y-1">
                      {world.rules.custom_rules.map((rule, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                          <span className="text-amber-400 mt-0.5">•</span>
                          {rule}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!world.lore && (!world.rules || Object.keys(world.rules).length === 0) && (
            <div className="text-center py-12">
              <p className="text-slate-500 italic">
                {isCreator
                  ? 'No lore or rules set yet. Edit your world to add them!'
                  : 'This world has no lore or rules documented yet.'}
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'characters' && (
        <div>
          {world.characters.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">🎭</div>
              <p className="text-slate-400">No characters in this world yet</p>
              {isMember && (
                <Link
                  href="/characters/create"
                  className="mt-4 px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors inline-block text-sm"
                >
                  Add a Character
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {world.characters.map((char) => (
                <Link
                  key={char.id}
                  href={`/characters/${char.id}`}
                  className="group p-4 bg-slate-800 border border-slate-700 rounded-lg hover:border-red-500/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center text-xl shrink-0">
                      🎭
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-white group-hover:text-red-400 transition-colors truncate">
                        {char.name}
                      </h4>
                      <p className="text-xs text-slate-500">by {char.creator_name}</p>
                    </div>
                    <span className="text-xs text-slate-500 shrink-0">{char.chat_count} chats</span>
                  </div>
                  {char.description && (
                    <p className="text-sm text-slate-400 mt-2 line-clamp-2">{char.description}</p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'members' && (
        <div className="space-y-2">
          {world.members.map((member) => (
            <div
              key={member.user_id}
              className="flex items-center gap-3 p-3 bg-slate-800 border border-slate-700 rounded-lg"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                {member.username[0].toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white">{member.username}</span>
                  {member.is_worldmaster && (
                    <span className="text-xs px-1.5 py-0.5 bg-amber-900/30 text-amber-400 rounded-full">
                      WorldMaster
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  Joined {new Date(member.joined_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'campaigns' && (
        <div>
          {/* WorldMaster link to full campaigns management page */}
          {isWorldMaster && (
            <div className="flex justify-end mb-4">
              <Link
                href={`/worlds/${world.id}/campaigns`}
                className="px-4 py-1.5 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
              >
                + Manage Campaigns
              </Link>
            </div>
          )}

          {world.campaigns.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">⚔️</div>
              <p className="text-slate-400 mb-2">No campaigns yet</p>
              {isWorldMaster && (
                <Link
                  href={`/worlds/${world.id}/campaigns`}
                  className="mt-3 px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors inline-block text-sm"
                >
                  Create Your First Campaign
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {world.campaigns.map((campaign) => (
                <Link
                  key={campaign.id}
                  href={`/campaigns/${campaign.id}`}
                  className="block p-4 bg-slate-800 border border-slate-700 rounded-lg hover:border-amber-500/50 transition-colors group"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-white group-hover:text-amber-400 transition-colors">{campaign.name}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      campaign.status === 'active'
                        ? 'bg-green-900/30 text-green-400'
                        : campaign.status === 'completed'
                        ? 'bg-blue-900/30 text-blue-400'
                        : 'bg-slate-700 text-slate-400'
                    }`}>
                      {campaign.status}
                    </span>
                  </div>
                  {campaign.description && (
                    <p className="text-sm text-slate-400">{campaign.description}</p>
                  )}
                </Link>
              ))}

              {/* Link to see all campaigns */}
              <div className="text-center pt-2">
                <Link
                  href={`/worlds/${world.id}/campaigns`}
                  className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
                >
                  View all campaigns &rarr;
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
