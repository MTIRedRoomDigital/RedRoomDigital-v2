'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';

interface Participant {
  id: string;
  character_id: string;
  user_id: string;
  character_name: string;
  character_avatar: string | null;
  character_description: string | null;
  owner_name: string;
  owner_id: string;
  turn_order: number;
  is_active: boolean;
}

interface CampaignData {
  id: string;
  world_id: string;
  world_name: string;
  creator_id: string;
  creator_name: string;
  name: string;
  description: string | null;
  premise: string | null;
  narrative_arc: string | null;
  outcome: string | null;
  status: 'draft' | 'active' | 'completed' | 'archived';
  conversation_id: string | null;
  current_turn: number;
  max_participants: number;
  min_participants: number;
  participants: Participant[];
  message_count: number;
  created_at: string;
}

interface Message {
  id: string;
  content: string;
  sender_name: string;
  sender_avatar: string | null;
  sender_character_id: string;
  sender_user_id: string;
  sender_type: string;
  created_at: string;
}

interface TurnInfo {
  currentTurn: number;
  currentPlayerUserId: string;
  currentCharacterId: string;
  currentCharacterName: string;
  participants: { userId: string; characterId: string; characterName: string; turnOrder: number }[];
}

export default function CampaignDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const router = useRouter();

  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [turnInfo, setTurnInfo] = useState<TurnInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [joining, setJoining] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showCharPicker, setShowCharPicker] = useState(false);
  const [myCharacters, setMyCharacters] = useState<{ id: string; name: string; avatar_url: string | null; world_id: string | null }[]>([]);
  const [activeView, setActiveView] = useState<'chat' | 'info'>('info');

  // Invite modal state
  const [showInvite, setShowInvite] = useState(false);
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteResults, setInviteResults] = useState<{ id: string; username: string; avatar_url: string | null }[]>([]);
  const [inviteMessage, setInviteMessage] = useState('');
  const [sendingInvite, setSendingInvite] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch campaign data
  useEffect(() => {
    if (!id) return;
    api.get<CampaignData>(`/api/campaigns/${id}`).then((res) => {
      if (res.success && res.data) {
        setCampaign(res.data as any);
        if ((res.data as any).status === 'active') {
          setActiveView('chat');
        }
      }
      setLoading(false);
    });
  }, [id]);

  // Fetch messages if campaign has a conversation
  useEffect(() => {
    if (!campaign || !campaign.conversation_id) return;
    api.get<{ messages: Message[] }>(`/api/campaigns/${id}/messages?limit=100`).then((res) => {
      if (res.success && res.data) {
        setMessages((res.data as any).messages || []);
      }
    });
  }, [campaign?.conversation_id, id]);

  // Poll for turn info + new messages when active
  useEffect(() => {
    if (!campaign || campaign.status !== 'active') return;

    const poll = () => {
      api.get<TurnInfo>(`/api/campaigns/${id}/turn`).then((res) => {
        if (res.success && res.data) setTurnInfo(res.data as any);
      });
      if (campaign.conversation_id) {
        api.get<{ messages: Message[] }>(`/api/campaigns/${id}/messages?limit=100`).then((res) => {
          if (res.success && res.data) setMessages((res.data as any).messages || []);
        });
      }
    };

    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [campaign?.status, campaign?.conversation_id, id]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const isWorldMaster = user && campaign && user.id === campaign.creator_id;
  const isParticipant = user && campaign?.participants.some((p) => p.user_id === user.id);
  const myParticipant = user ? campaign?.participants.find((p) => p.user_id === user.id) : null;
  const isMyTurn = user && turnInfo && turnInfo.currentPlayerUserId === user.id;

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !campaign || sending) return;
    setSending(true);
    const res = await api.post(`/api/campaigns/${id}/message`, { content: messageInput.trim() });
    if (res.success) {
      setMessageInput('');
      // Refresh messages and turn info
      const [msgRes, turnRes] = await Promise.all([
        api.get<{ messages: Message[] }>(`/api/campaigns/${id}/messages?limit=100`),
        api.get<TurnInfo>(`/api/campaigns/${id}/turn`),
      ]);
      if (msgRes.success && msgRes.data) setMessages((msgRes.data as any).messages || []);
      if (turnRes.success && turnRes.data) setTurnInfo(turnRes.data as any);
    } else {
      alert((res as any).message || 'Failed to send message');
    }
    setSending(false);
  };

  const handleSkipTurn = async () => {
    if (!campaign || sending) return;
    setSending(true);
    const res = await api.post(`/api/campaigns/${id}/skip`, {});
    if (res.success) {
      const [msgRes, turnRes] = await Promise.all([
        api.get<{ messages: Message[] }>(`/api/campaigns/${id}/messages?limit=100`),
        api.get<TurnInfo>(`/api/campaigns/${id}/turn`),
      ]);
      if (msgRes.success && msgRes.data) setMessages((msgRes.data as any).messages || []);
      if (turnRes.success && turnRes.data) setTurnInfo(turnRes.data as any);
    }
    setSending(false);
  };

  const handleJoin = async (characterId: string) => {
    if (!campaign) return;
    setJoining(true);
    const res = await api.post(`/api/campaigns/${id}/join`, { character_id: characterId });
    if (res.success) {
      setShowCharPicker(false);
      const updated = await api.get<CampaignData>(`/api/campaigns/${id}`);
      if (updated.success && updated.data) setCampaign(updated.data as any);
    } else {
      alert((res as any).message || 'Failed to join');
    }
    setJoining(false);
  };

  const handleLeave = async () => {
    if (!campaign || !confirm('Leave this campaign?')) return;
    setActionLoading(true);
    const res = await api.post(`/api/campaigns/${id}/leave`, {});
    if (res.success) {
      const updated = await api.get<CampaignData>(`/api/campaigns/${id}`);
      if (updated.success && updated.data) setCampaign(updated.data as any);
    }
    setActionLoading(false);
  };

  const handleStart = async () => {
    if (!campaign || !confirm('Start this campaign? Characters will no longer be able to join.')) return;
    setActionLoading(true);
    const res = await api.post(`/api/campaigns/${id}/start`, {});
    if (res.success) {
      const updated = await api.get<CampaignData>(`/api/campaigns/${id}`);
      if (updated.success && updated.data) {
        setCampaign(updated.data as any);
        setActiveView('chat');
      }
    } else {
      alert((res as any).message || 'Failed to start');
    }
    setActionLoading(false);
  };

  const handleEnd = async () => {
    if (!campaign || !confirm('End this campaign? You can then approve or reject the results.')) return;
    setActionLoading(true);
    const res = await api.post(`/api/campaigns/${id}/end`, {});
    if (res.success) {
      const updated = await api.get<CampaignData>(`/api/campaigns/${id}`);
      if (updated.success && updated.data) setCampaign(updated.data as any);
    }
    setActionLoading(false);
  };

  const handleApprove = async () => {
    if (!campaign || !confirm('Approve these results? They will be permanently added to world canon and character histories.')) return;
    setActionLoading(true);
    const res = await api.post(`/api/campaigns/${id}/approve`, {});
    if (res.success) {
      alert('Campaign results are now part of world canon!');
      const updated = await api.get<CampaignData>(`/api/campaigns/${id}`);
      if (updated.success && updated.data) setCampaign(updated.data as any);
    } else {
      alert((res as any).message || 'Failed to approve');
    }
    setActionLoading(false);
  };

  const handleReject = async () => {
    if (!campaign || !confirm('Reject these results? The campaign will be archived without changing world canon.')) return;
    setActionLoading(true);
    const res = await api.post(`/api/campaigns/${id}/reject`, {});
    if (res.success) {
      const updated = await api.get<CampaignData>(`/api/campaigns/${id}`);
      if (updated.success && updated.data) setCampaign(updated.data as any);
    }
    setActionLoading(false);
  };

  const openCharPicker = async () => {
    if (!user || !campaign) return;
    const res = await api.get<any[]>('/api/users/characters');
    if (res.success && res.data) {
      setMyCharacters(res.data as any[]);
      setShowCharPicker(true);
    }
  };

  // Debounced user search for invite modal
  useEffect(() => {
    if (!showInvite) return;
    const q = inviteQuery.trim();
    if (q.length < 2) {
      setInviteResults([]);
      return;
    }
    const timer = setTimeout(() => {
      api.get<{ users: { id: string; username: string; avatar_url: string | null }[] }>(
        `/api/users/search?q=${encodeURIComponent(q)}`
      ).then((res) => {
        if (res.success && res.data) {
          // Exclude self and existing participants
          const existingIds = new Set([
            user?.id,
            ...(campaign?.participants.map((p) => p.user_id) || []),
          ]);
          setInviteResults(((res.data as any).users || []).filter((u: any) => !existingIds.has(u.id)));
        }
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [inviteQuery, showInvite, user?.id, campaign?.participants]);

  const handleSendInvite = async (toUserId: string) => {
    if (!campaign || sendingInvite) return;
    setSendingInvite(toUserId);
    const res = await api.post(`/api/campaigns/${id}/invite`, {
      to_user_id: toUserId,
      message: inviteMessage.trim() || undefined,
    });
    if (res.success) {
      // Remove from results so user sees feedback
      setInviteResults((prev) => prev.filter((u) => u.id !== toUserId));
    } else {
      alert((res as any).message || 'Failed to send invite');
    }
    setSendingInvite(null);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-700 rounded w-1/3 mb-4" />
          <div className="h-4 bg-slate-700 rounded w-2/3 mb-8" />
          <div className="h-64 bg-slate-800 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">&#x2694;&#xFE0F;</div>
        <h1 className="text-2xl font-bold text-white mb-2">Campaign Not Found</h1>
        <p className="text-slate-400 mb-6">This campaign doesn&apos;t exist or has been deleted.</p>
        <Link href="/worlds" className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors inline-block">
          Browse Worlds
        </Link>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-yellow-900/30 text-yellow-400',
    active: 'bg-green-900/30 text-green-400',
    completed: 'bg-blue-900/30 text-blue-400',
    archived: 'bg-slate-700 text-slate-400',
  };

  const isCanon = campaign.status === 'archived' && campaign.outcome && campaign.outcome !== 'Rejected by WorldMaster';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-400 mb-4">
        <Link href={`/worlds/${campaign.world_id}`} className="hover:text-white transition-colors">
          {campaign.world_name}
        </Link>
        <span>/</span>
        <span className="text-slate-500">Campaigns</span>
        <span>/</span>
        <span className="text-white">{campaign.name}</span>
      </div>

      {/* Campaign Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-white">{campaign.name}</h1>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              isCanon ? 'bg-green-900/30 text-green-400' : statusColors[campaign.status]
            }`}>
              {isCanon ? 'Canon' : campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
            </span>
          </div>
          {campaign.description && (
            <p className="text-slate-300 mb-2">{campaign.description}</p>
          )}
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span>by {campaign.creator_name}</span>
            <span>{campaign.participants.length}/{campaign.max_participants} participants</span>
            {campaign.message_count > 0 && <span>{campaign.message_count} messages</span>}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 shrink-0">
          {campaign.status === 'draft' && !isParticipant && user && (
            <button
              onClick={openCharPicker}
              className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
            >
              Join Campaign
            </button>
          )}
          {campaign.status === 'draft' && isParticipant && !isWorldMaster && (
            <button
              onClick={handleLeave}
              disabled={actionLoading}
              className="px-4 py-2 text-sm border border-slate-600 text-slate-400 hover:text-white rounded-lg transition-colors disabled:opacity-50"
            >
              Leave Campaign
            </button>
          )}
          {campaign.status === 'draft' && isWorldMaster && (
            <button
              onClick={handleStart}
              disabled={actionLoading || campaign.participants.length < campaign.min_participants}
              className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 disabled:bg-slate-700 text-white rounded-lg transition-colors"
              title={campaign.participants.length < campaign.min_participants ? `Need ${campaign.min_participants} participants` : 'Start campaign'}
            >
              {actionLoading ? 'Starting...' : 'Start Campaign'}
            </button>
          )}
          {/* Invite is open to WorldMaster and participants while in draft */}
          {campaign.status === 'draft' && user && (isWorldMaster || isParticipant) && (
            <button
              onClick={() => setShowInvite(true)}
              className="px-4 py-2 text-sm border border-amber-600 text-amber-400 hover:bg-amber-900/20 rounded-lg transition-colors"
            >
              + Invite Players
            </button>
          )}
          {campaign.status === 'active' && isWorldMaster && (
            <button
              onClick={handleEnd}
              disabled={actionLoading}
              className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {actionLoading ? 'Ending...' : 'End Campaign'}
            </button>
          )}
          {campaign.status === 'completed' && isWorldMaster && (
            <div className="flex flex-col gap-2">
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Processing...' : 'Approve & Add to Canon'}
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading}
                className="px-4 py-2 text-sm border border-red-600 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
              >
                Reject Results
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Premise */}
      {campaign.premise && (
        <div className="p-4 bg-amber-900/20 border border-amber-700/30 rounded-xl mb-6">
          <h3 className="text-sm font-semibold text-amber-400 mb-1">Campaign Premise</h3>
          <p className="text-slate-300 text-sm leading-relaxed">{campaign.premise}</p>
        </div>
      )}

      {/* Outcome (canon) */}
      {isCanon && (
        <div className="p-4 bg-green-900/20 border border-green-700/30 rounded-xl mb-6">
          <h3 className="text-sm font-semibold text-green-400 mb-1">Campaign Outcome (World Canon)</h3>
          <p className="text-slate-300 text-sm leading-relaxed">{campaign.outcome}</p>
        </div>
      )}
      {campaign.outcome === 'Rejected by WorldMaster' && (
        <div className="p-4 bg-red-900/20 border border-red-700/30 rounded-xl mb-6">
          <h3 className="text-sm font-semibold text-red-400 mb-1">Campaign Rejected</h3>
          <p className="text-slate-400 text-sm">The WorldMaster decided these results would not become part of world canon.</p>
        </div>
      )}

      {/* Tabs */}
      {campaign.conversation_id && (
        <div className="flex border-b border-slate-700 mb-6">
          <button
            onClick={() => setActiveView('chat')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-[1px] transition-colors ${
              activeView === 'chat' ? 'text-amber-400 border-amber-400' : 'text-slate-400 border-transparent hover:text-white'
            }`}
          >
            Campaign Chat {campaign.message_count > 0 && `(${campaign.message_count})`}
          </button>
          <button
            onClick={() => setActiveView('info')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-[1px] transition-colors ${
              activeView === 'info' ? 'text-amber-400 border-amber-400' : 'text-slate-400 border-transparent hover:text-white'
            }`}
          >
            Participants ({campaign.participants.length})
          </button>
        </div>
      )}

      {/* Chat View */}
      {activeView === 'chat' && campaign.conversation_id && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          {/* Turn Indicator */}
          {campaign.status === 'active' && turnInfo && (
            <div className={`px-4 py-3 border-b border-slate-700 ${
              isMyTurn ? 'bg-amber-900/20 border-amber-700/30' : 'bg-slate-750'
            }`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${isMyTurn ? 'bg-amber-400 animate-pulse' : 'bg-slate-500'}`} />
                  <span className={`text-sm font-medium ${isMyTurn ? 'text-amber-400' : 'text-slate-400'}`}>
                    {isMyTurn
                      ? `Your turn as ${myParticipant?.character_name}`
                      : `Waiting for ${turnInfo.currentCharacterName}...`
                    }
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 flex-wrap">
                  {turnInfo.participants.map((p, i) => (
                    <span
                      key={p.characterId}
                      className={`px-2 py-0.5 rounded ${
                        p.userId === turnInfo.currentPlayerUserId
                          ? 'bg-amber-900/40 text-amber-400 font-medium'
                          : 'bg-slate-700 text-slate-500'
                      }`}
                    >
                      {i + 1}. {p.characterName}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="h-[450px] overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-3">&#x2694;&#xFE0F;</div>
                <p className="text-slate-500 italic">The campaign awaits its first move...</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isSkip = msg.content.includes('stays silent, yielding their turn');
                return (
                  <div key={msg.id} className={`flex gap-3 ${isSkip ? 'opacity-50' : ''}`}>
                    {msg.sender_avatar ? (
                      <img src={msg.sender_avatar} alt={msg.sender_name} className="w-9 h-9 rounded-full object-cover shrink-0 mt-0.5" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-sm font-bold text-white shrink-0 mt-0.5">
                        {msg.sender_name[0]}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Link
                          href={`/characters/${msg.sender_character_id}`}
                          className="text-sm font-semibold text-amber-400 hover:text-amber-300 transition-colors"
                        >
                          {msg.sender_name}
                        </Link>
                        <span className="text-[10px] text-slate-600">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isSkip ? 'text-slate-500 italic' : 'text-slate-300'}`}>
                        {msg.content}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          {campaign.status === 'active' && isParticipant && (
            <div className="border-t border-slate-700 p-3">
              {isMyTurn ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                    placeholder={`Write as ${myParticipant?.character_name}...`}
                    className="flex-1 px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
                    disabled={sending}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!messageInput.trim() || sending}
                    className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-700 text-white text-sm rounded-lg transition-colors font-medium"
                  >
                    {sending ? '...' : 'Send'}
                  </button>
                  <button
                    onClick={handleSkipTurn}
                    disabled={sending}
                    className="px-3 py-2.5 border border-slate-600 text-slate-400 hover:text-white text-sm rounded-lg transition-colors"
                    title="Skip your turn"
                  >
                    Skip
                  </button>
                </div>
              ) : (
                <div className="text-center py-2 text-sm text-slate-500">
                  Waiting for {turnInfo?.currentCharacterName || 'another player'}...
                </div>
              )}
            </div>
          )}

          {/* Ended state */}
          {(campaign.status === 'completed' || campaign.status === 'archived') && (
            <div className="border-t border-slate-700 px-4 py-3 bg-slate-800/80 text-center">
              <span className="text-sm text-slate-500">
                {isCanon
                  ? 'This campaign is now part of world canon.'
                  : campaign.status === 'completed'
                  ? 'Campaign ended. Awaiting WorldMaster review.'
                  : 'Campaign archived.'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Participants View */}
      {(activeView === 'info' || !campaign.conversation_id) && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            Participants ({campaign.participants.length}/{campaign.max_participants})
          </h3>

          {campaign.participants.length === 0 ? (
            <div className="text-center py-12 bg-slate-800 border border-slate-700 rounded-xl">
              <div className="text-4xl mb-3">&#x2694;&#xFE0F;</div>
              <p className="text-slate-400 mb-2">No one has joined yet</p>
              <p className="text-xs text-slate-500">Be the first to join this campaign!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {campaign.participants.map((p, i) => (
                <div
                  key={p.id}
                  className={`flex items-center gap-3 p-3 bg-slate-800 border rounded-lg transition-colors ${
                    turnInfo && turnInfo.currentCharacterId === p.character_id
                      ? 'border-amber-500/50 bg-amber-900/10'
                      : 'border-slate-700'
                  }`}
                >
                  <span className="text-sm font-mono text-slate-600 w-6 text-center">{i + 1}</span>
                  {p.character_avatar ? (
                    <img src={p.character_avatar} alt={p.character_name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-lg shrink-0">
                      &#x1F3AD;
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <Link href={`/characters/${p.character_id}`} className="font-medium text-white hover:text-amber-400 transition-colors">
                      {p.character_name}
                    </Link>
                    <p className="text-xs text-slate-500">played by {p.owner_name}</p>
                  </div>
                  {turnInfo && turnInfo.currentCharacterId === p.character_id && campaign.status === 'active' && (
                    <span className="text-xs px-2 py-0.5 bg-amber-900/30 text-amber-400 rounded-full animate-pulse">
                      Current Turn
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Min participants notice */}
          {campaign.status === 'draft' && campaign.participants.length < campaign.min_participants && (
            <p className="mt-3 text-sm text-slate-500 text-center">
              Need {campaign.min_participants - campaign.participants.length} more participant{campaign.min_participants - campaign.participants.length > 1 ? 's' : ''} to start
            </p>
          )}
        </div>
      )}

      {/* Character Picker Modal */}
      {showCharPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1">Join Campaign</h3>
            <p className="text-sm text-slate-400 mb-4">Choose a character to join &quot;{campaign.name}&quot;</p>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {myCharacters.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">You don&apos;t have any characters yet.</p>
              ) : (
                myCharacters.map((char) => (
                  <button
                    key={char.id}
                    onClick={() => handleJoin(char.id)}
                    disabled={joining}
                    className="w-full flex items-center gap-3 p-3 bg-slate-700/50 border border-slate-600 rounded-lg hover:border-amber-500/50 hover:bg-slate-700 transition-colors text-left disabled:opacity-50"
                  >
                    {char.avatar_url ? (
                      <img src={char.avatar_url} alt={char.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center text-lg shrink-0">
                        &#x1F3AD;
                      </div>
                    )}
                    <span className="font-medium text-white flex-1">{char.name}</span>
                  </button>
                ))
              )}
            </div>

            <button
              onClick={() => setShowCharPicker(false)}
              className="w-full mt-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Invite Players Modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1">Invite Players</h3>
            <p className="text-sm text-slate-400 mb-4">
              Search for users to invite to &quot;{campaign.name}&quot;. They&apos;ll get a notification and pick which character to bring.
            </p>

            <input
              type="text"
              value={inviteQuery}
              onChange={(e) => setInviteQuery(e.target.value)}
              placeholder="Search by username..."
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500 mb-3"
              autoFocus
            />

            <textarea
              value={inviteMessage}
              onChange={(e) => setInviteMessage(e.target.value)}
              placeholder="Optional message (e.g. 'I think your warrior would be perfect for this')"
              rows={2}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-xs focus:outline-none focus:border-amber-500 mb-3 resize-none"
            />

            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {inviteQuery.trim().length < 2 ? (
                <p className="text-xs text-slate-500 text-center py-4">Type at least 2 characters to search</p>
              ) : inviteResults.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No users found</p>
              ) : (
                inviteResults.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 p-2 bg-slate-700/50 border border-slate-600 rounded-lg"
                  >
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt={u.username} className="w-8 h-8 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center text-sm font-bold text-white shrink-0">
                        {u.username[0].toUpperCase()}
                      </div>
                    )}
                    <span className="font-medium text-white text-sm flex-1 truncate">{u.username}</span>
                    <button
                      onClick={() => handleSendInvite(u.id)}
                      disabled={sendingInvite === u.id}
                      className="px-3 py-1 text-xs bg-amber-600 hover:bg-amber-700 disabled:bg-slate-700 text-white rounded transition-colors"
                    >
                      {sendingInvite === u.id ? '...' : 'Invite'}
                    </button>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => { setShowInvite(false); setInviteQuery(''); setInviteMessage(''); setInviteResults([]); }}
              className="w-full mt-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
