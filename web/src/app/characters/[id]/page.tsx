'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { TestChatModal } from '@/components/TestChatModal';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

interface Character {
  id: string;
  creator_id: string;
  creator_name: string;
  name: string;
  avatar_url: string | null;
  description: string | null;
  personality: { traits?: string[]; values?: string[]; flaws?: string[] };
  background: string | null;
  likes: string[];
  dislikes: string[];
  history: { event: string; date?: string; impact?: string; source?: string; conversationId?: string }[];
  world_id: string | null;
  world_name: string | null;
  is_public: boolean;
  is_ai_enabled: boolean;
  tags: string[];
  chat_count: number;
  rating: number;
  created_at: string;
  relationships: {
    id: string;
    related_character_name: string;
    related_character_avatar: string | null;
    relationship_type: string;
    description: string | null;
    strength: number;
  }[];
}

interface MyCharacter {
  id: string;
  name: string;
  avatar_url: string | null;
  world_id: string | null;
  world_name?: string | null;
}

export default function CharacterDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [character, setCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showChatModal, setShowChatModal] = useState(false);
  const [showModeModal, setShowModeModal] = useState(false);
  const [showTestChat, setShowTestChat] = useState(false);
  const [myCharacters, setMyCharacters] = useState<MyCharacter[]>([]);
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [loadingChat, setLoadingChat] = useState(false);
  const [partnerStatus, setPartnerStatus] = useState<'online' | 'away' | 'offline'>('offline');
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [selectedContext, setSelectedContext] = useState<'vacuum' | 'within_world' | 'multiverse'>('vacuum');
  const [worldLocations, setWorldLocations] = useState<{ id: string; name: string; type: string | null }[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [requestingRemoval, setRequestingRemoval] = useState<string | null>(null);
  const [removalRequested, setRemovalRequested] = useState<Set<string>>(new Set());
  const [userVote, setUserVote] = useState<1 | -1 | null>(null);
  const [likeCount, setLikeCount] = useState(0);
  const [dislikeCount, setDislikeCount] = useState(0);
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    api.get<Character>(`/api/characters/${params.id}`).then((res) => {
      if (res.success && res.data) {
        setCharacter(res.data);
        setLikeCount((res.data as any).like_count || 0);
        setDislikeCount((res.data as any).dislike_count || 0);
      } else {
        setError(res.message || 'Character not found');
      }
      setLoading(false);
    });
  }, [params.id]);

  // Fetch user's existing vote
  useEffect(() => {
    if (!user || !params.id) return;
    api.get<{ user_vote: 1 | -1 | null }>(`/api/characters/${params.id}/vote`).then((res) => {
      if (res.success && res.data) setUserVote((res.data as any).user_vote);
    });
  }, [user, params.id]);

  const handleVote = async (vote: 1 | -1) => {
    if (!user || voting) return;
    setVoting(true);
    const res = await api.post<{ like_count: number; dislike_count: number; user_vote: 1 | -1 | null }>(
      `/api/characters/${params.id}/vote`, { vote }
    );
    if (res.success && res.data) {
      const d = res.data as any;
      setLikeCount(d.like_count);
      setDislikeCount(d.dislike_count);
      setUserVote(d.user_vote);
    }
    setVoting(false);
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-slate-400">Loading character...</div>
      </div>
    );
  }

  if (error || !character) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">😔</div>
          <h2 className="text-xl font-bold text-white mb-2">Character Not Found</h2>
          <p className="text-slate-400 mb-4">{error}</p>
          <Link href="/explore" className="text-red-400 hover:text-red-300">
            ← Browse Characters
          </Link>
        </div>
      </div>
    );
  }

  const isOwner = user?.id === character.creator_id;
  const personality = character.personality || {};

  const handleStartChat = async () => {
    if (!user) {
      router.push('/login');
      return;
    }

    // Load user's characters for selection
    const res = await api.get<MyCharacter[]>('/api/users/characters');
    if (res.success && res.data) {
      const chars = res.data as any;
      if (chars.length === 0) {
        alert('You need to create a character first!');
        router.push('/characters/create');
        return;
      }
      if (chars.length === 1) {
        // Only one character — go directly to mode selection
        setMyCharacters(chars);
        openModeModal(chars[0].id);
        return;
      }
      // Multiple characters — show picker first
      setMyCharacters(chars);
      setShowChatModal(true);
    }
  };

  // After character selection, fetch partner's presence and show chat mode modal
  const openModeModal = async (charId: string) => {
    setSelectedCharId(charId);
    setShowChatModal(false);
    setLoadingStatus(true);
    setShowModeModal(true);

    // Determine the selected character's world to figure out context options
    const selectedChar = myCharacters.find((c) => c.id === charId);
    const myWorldId = (selectedChar as any)?.world_id;

    // Set default context based on world membership
    if (character!.world_id && myWorldId === character!.world_id) {
      setSelectedContext('within_world');
    } else if (character!.world_id && myWorldId && myWorldId !== character!.world_id) {
      setSelectedContext('multiverse');
    } else {
      setSelectedContext('vacuum');
    }

    // Fetch locations if partner character has a world
    setSelectedLocationId(null);
    setWorldLocations([]);
    if (character!.world_id) {
      try {
        const locRes = await api.get<{ id: string; name: string; type: string | null }[]>(`/api/worlds/${character!.world_id}/locations`);
        if (locRes.success && locRes.data) {
          setWorldLocations(locRes.data as any);
        }
      } catch { /* ignore */ }
    }

    // Fetch partner user's online status
    try {
      const res = await api.get<{ status: string }>(`/api/users/${character!.creator_id}/presence`);
      if (res.success && res.data) {
        setPartnerStatus((res.data as any).status || 'offline');
      }
    } catch {
      setPartnerStatus('offline');
    }
    setLoadingStatus(false);
  };

  // Start a conversation with the chosen mode
  const startConversationWithMode = async (mode: 'ai' | 'live' | 'ai_fallback') => {
    setLoadingChat(true);
    setShowModeModal(false);

    const res = await api.post<{ id: string }>('/api/conversations', {
      character_id: selectedCharId,
      partner_character_id: character!.id,
      context: selectedContext,
      world_id: selectedContext === 'within_world' ? character!.world_id : null,
      location_id: selectedContext === 'within_world' ? selectedLocationId : null,
      chat_mode: mode,
    });

    if (res.success && res.data) {
      router.push(`/chats/${(res.data as any).id}`);
    } else {
      setLoadingChat(false);
      alert(res.message || 'Failed to start conversation');
    }
  };

  // Status indicator helpers
  const statusDot = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-400';
      case 'away': return 'bg-amber-400';
      default: return 'bg-slate-500';
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'online': return 'Online now';
      case 'away': return 'Away';
      default: return 'Offline';
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Back link */}
      <Link href={isOwner ? '/profile' : '/explore'} className="text-sm text-slate-400 hover:text-slate-300 mb-4 inline-block">
        ← Back
      </Link>

      {/* Character Header */}
      <div className="flex items-start gap-6 mb-8">
        {character.avatar_url ? (
          <img src={character.avatar_url} alt={character.name} className="w-28 h-28 rounded-2xl object-cover shrink-0" />
        ) : (
          <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center text-5xl shrink-0">
            🎭
          </div>
        )}

        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold text-white">{character.name}</h1>
            {character.is_ai_enabled && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/30 text-green-400 border border-green-800">
                🤖 AI Enabled
              </span>
            )}
          </div>

          {character.description && (
            <p className="text-slate-300 mt-1 mb-3">{character.description}</p>
          )}

          <div className="flex items-center gap-4 text-sm text-slate-400">
            <span>Created by <Link href={`/users/${character.creator_id}`} className="font-bold text-slate-300 hover:text-red-400 transition-colors">{character.creator_name}</Link></span>
            <span>•</span>
            <span>{character.chat_count} chats</span>
            <span>•</span>
            <span>{new Date(character.created_at).toLocaleDateString()}</span>
          </div>

          {/* Like / Dislike */}
          {user && user.id !== character.creator_id && (
            <div className="flex items-center gap-3 mt-3">
              <button
                onClick={() => handleVote(1)}
                disabled={voting}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  userVote === 1
                    ? 'bg-green-600/20 text-green-400 border border-green-600'
                    : 'bg-slate-700/50 text-slate-400 border border-slate-600 hover:text-green-400 hover:border-green-600/50'
                }`}
              >
                👍 {likeCount}
              </button>
              <button
                onClick={() => handleVote(-1)}
                disabled={voting}
                className={`flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  userVote === -1
                    ? 'bg-red-600/20 text-red-400 border border-red-600'
                    : 'bg-slate-700/50 text-slate-400 border border-slate-600 hover:text-red-400 hover:border-red-600/50'
                }`}
              >
                👎 {dislikeCount}
              </button>
            </div>
          )}
          {(!user || user.id === character.creator_id) && (likeCount > 0 || dislikeCount > 0) && (
            <div className="flex items-center gap-3 mt-3 text-sm text-slate-500">
              <span>👍 {likeCount}</span>
              <span>👎 {dislikeCount}</span>
            </div>
          )}

          {/* World Badge */}
          {character.world_id && character.world_name ? (
            <div className="mt-3">
              <Link
                href={`/worlds/${character.world_id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs bg-purple-900/30 text-purple-300 border border-purple-800/50 rounded-full hover:bg-purple-900/50 transition-colors"
              >
                🌍 {character.world_name}
              </Link>
            </div>
          ) : (
            <div className="mt-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs bg-slate-700/50 text-slate-400 rounded-full">
                🌌 Worldless
              </span>
            </div>
          )}

          {/* Tags */}
          {character.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {character.tags.map((tag) => (
                <span key={tag} className="px-2 py-0.5 text-xs bg-slate-700 text-slate-300 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 mt-4">
            {!isOwner && (
              <button
                onClick={handleStartChat}
                disabled={loadingChat}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {loadingChat ? 'Starting...' : '💬 Start Chat'}
              </button>
            )}
            {isOwner && (
              <>
                <button
                  onClick={() => setShowTestChat(true)}
                  className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  🧪 Test Chat
                </button>
                <Link
                  href={`/characters/${character.id}/edit`}
                  className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
                >
                  ✏️ Edit Character
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personality */}
        <div className="p-5 bg-slate-800 border border-slate-700 rounded-xl">
          <h2 className="text-lg font-semibold text-white mb-4">🧠 Personality</h2>

          {personality.traits && personality.traits.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs uppercase tracking-wider text-slate-500 mb-2">Traits</h3>
              <div className="flex flex-wrap gap-2">
                {personality.traits.map((t) => (
                  <span key={t} className="px-2.5 py-1 text-sm bg-blue-900/30 text-blue-300 rounded-lg border border-blue-800/50">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {personality.values && personality.values.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs uppercase tracking-wider text-slate-500 mb-2">Values</h3>
              <div className="flex flex-wrap gap-2">
                {personality.values.map((v) => (
                  <span key={v} className="px-2.5 py-1 text-sm bg-green-900/30 text-green-300 rounded-lg border border-green-800/50">
                    {v}
                  </span>
                ))}
              </div>
            </div>
          )}

          {personality.flaws && personality.flaws.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wider text-slate-500 mb-2">Flaws</h3>
              <div className="flex flex-wrap gap-2">
                {personality.flaws.map((f) => (
                  <span key={f} className="px-2.5 py-1 text-sm bg-red-900/30 text-red-300 rounded-lg border border-red-800/50">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {!personality.traits?.length && !personality.values?.length && !personality.flaws?.length && (
            <p className="text-slate-500 italic text-sm">No personality details yet.</p>
          )}
        </div>

        {/* Likes & Dislikes */}
        <div className="p-5 bg-slate-800 border border-slate-700 rounded-xl">
          <h2 className="text-lg font-semibold text-white mb-4">❤️ Likes & Dislikes</h2>

          {character.likes.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs uppercase tracking-wider text-slate-500 mb-2">Likes</h3>
              <div className="flex flex-wrap gap-2">
                {character.likes.map((l) => (
                  <span key={l} className="px-2.5 py-1 text-sm bg-emerald-900/30 text-emerald-300 rounded-lg">
                    👍 {l}
                  </span>
                ))}
              </div>
            </div>
          )}

          {character.dislikes.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wider text-slate-500 mb-2">Dislikes</h3>
              <div className="flex flex-wrap gap-2">
                {character.dislikes.map((d) => (
                  <span key={d} className="px-2.5 py-1 text-sm bg-rose-900/30 text-rose-300 rounded-lg">
                    👎 {d}
                  </span>
                ))}
              </div>
            </div>
          )}

          {character.likes.length === 0 && character.dislikes.length === 0 && (
            <p className="text-slate-500 italic text-sm">No likes or dislikes set.</p>
          )}
        </div>

        {/* Background */}
        {character.background && (
          <div className="p-5 bg-slate-800 border border-slate-700 rounded-xl md:col-span-2">
            <h2 className="text-lg font-semibold text-white mb-3">📜 Background</h2>
            <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{character.background}</p>
          </div>
        )}

        {/* Relationships */}
        {character.relationships.length > 0 && (
          <div className="p-5 bg-slate-800 border border-slate-700 rounded-xl md:col-span-2">
            <h2 className="text-lg font-semibold text-white mb-4">🤝 Relationships</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {character.relationships.map((rel) => (
                <div key={rel.id} className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg">
                  {rel.related_character_avatar ? (
                    <img src={rel.related_character_avatar} alt={rel.related_character_name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center text-lg">
                      🎭
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white">{rel.related_character_name}</div>
                    <div className="text-xs text-slate-400 capitalize">{rel.relationship_type}</div>
                  </div>
                  <div className="text-xs text-slate-500">{rel.strength}%</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* History / Events */}
        {character.history.length > 0 && (
          <div className="p-5 bg-slate-800 border border-slate-700 rounded-xl md:col-span-2">
            <h2 className="text-lg font-semibold text-white mb-4">📅 History</h2>
            <div className="space-y-3">
              {(() => {
                // Group canon events by conversationId so we show one removal button per conversation
                const canonConversations = new Set<string>();
                character.history.forEach((e) => {
                  if (e.source === 'canon_chat' && e.conversationId) {
                    canonConversations.add(e.conversationId);
                  }
                });

                let lastConvId: string | undefined;

                return character.history.map((event, i) => {
                  const isCanon = event.source === 'canon_chat' && event.conversationId;
                  const convId = event.conversationId;
                  // Show the removal button only on the first event of each canon conversation group
                  const showRemovalBtn = isCanon && convId && convId !== lastConvId && isOwner;
                  if (isCanon && convId) lastConvId = convId;

                  return (
                    <div key={i}>
                      {/* Canon conversation group header with removal button */}
                      {showRemovalBtn && (
                        <div className="flex items-center gap-2 mb-1 mt-2">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-900/30 text-amber-400">
                            📜 Canon
                          </span>
                          {removalRequested.has(convId!) ? (
                            <span className="text-[10px] text-green-400">✅ Removal requested</span>
                          ) : (
                            <button
                              onClick={async () => {
                                setRequestingRemoval(convId!);
                                const res = await api.post(`/api/conversations/${convId}/canon-removal-request`, {
                                  character_id: character.id,
                                });
                                if (res.success) {
                                  setRemovalRequested((prev) => new Set(prev).add(convId!));
                                } else {
                                  alert((res as any).message || 'Failed to send removal request');
                                }
                                setRequestingRemoval(null);
                              }}
                              disabled={requestingRemoval === convId}
                              className="text-[10px] text-red-400 hover:text-red-300 transition-colors disabled:text-slate-600"
                            >
                              {requestingRemoval === convId ? 'Requesting...' : 'Request Removal'}
                            </button>
                          )}
                        </div>
                      )}
                      <div className={`flex gap-3 pl-4 border-l-2 ${isCanon ? 'border-amber-700/50' : 'border-slate-600'}`}>
                        <div className="flex-1">
                          <p className="text-sm text-slate-300">{event.event}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {event.date && <p className="text-xs text-slate-500">{event.date}</p>}
                            {event.impact && <p className="text-xs text-slate-600 italic">{event.impact}</p>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Test Chat Modal */}
      {showTestChat && character && (
        <TestChatModal
          characterId={character.id}
          characterName={character.name}
          characterAvatar={character.avatar_url}
          onClose={() => setShowTestChat(false)}
        />
      )}

      {/* Character Picker Modal */}
      {showChatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1">Choose Your Character</h3>
            <p className="text-sm text-slate-400 mb-4">
              Which character will chat with <span className="text-red-400">{character.name}</span>?
            </p>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {myCharacters.map((char) => (
                <button
                  key={char.id}
                  onClick={() => openModeModal(char.id)}
                  className="w-full flex items-center gap-3 p-3 bg-slate-700/50 border border-slate-600 rounded-lg hover:border-red-500/50 hover:bg-slate-700 transition-colors text-left"
                >
                  {char.avatar_url ? (
                    <img src={char.avatar_url} alt={char.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center text-lg shrink-0">
                      🎭
                    </div>
                  )}
                  <span className="font-medium text-white">{char.name}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowChatModal(false)}
              className="w-full mt-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Chat Mode Selection Modal */}
      {showModeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1">How would you like to chat?</h3>
            <p className="text-sm text-slate-400 mb-4">
              Choose how to interact with <span className="text-red-400">{character.name}</span>
            </p>

            {/* Context Selector */}
            <div className="mb-4">
              <label className="text-xs uppercase tracking-wider text-slate-500 mb-2 block">Chat Context</label>
              <div className="flex gap-2">
                {/* Vacuum — always available */}
                <button
                  onClick={() => setSelectedContext('vacuum')}
                  className={`flex-1 py-2 px-3 text-xs rounded-lg border transition-all text-center ${
                    selectedContext === 'vacuum'
                      ? 'bg-slate-600 border-slate-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  <div className="text-base mb-0.5">🌌</div>
                  Vacuum
                </button>

                {/* Within World — only if both characters share a world */}
                {(() => {
                  const selectedChar = myCharacters.find((c) => c.id === selectedCharId);
                  const myWorldId = (selectedChar as any)?.world_id;
                  const sameWorld = character!.world_id && myWorldId === character!.world_id;
                  return (
                    <button
                      onClick={() => sameWorld && setSelectedContext('within_world')}
                      disabled={!sameWorld}
                      className={`flex-1 py-2 px-3 text-xs rounded-lg border transition-all text-center ${
                        !sameWorld
                          ? 'bg-slate-800/50 border-slate-700/50 text-slate-600 cursor-not-allowed'
                          : selectedContext === 'within_world'
                          ? 'bg-amber-900/30 border-amber-700 text-amber-400'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-amber-700/50'
                      }`}
                    >
                      <div className="text-base mb-0.5">🌍</div>
                      In World
                    </button>
                  );
                })()}

                {/* Multiverse — if both characters have different worlds */}
                {(() => {
                  const selectedChar = myCharacters.find((c) => c.id === selectedCharId);
                  const myWorldId = (selectedChar as any)?.world_id;
                  const canMultiverse = character!.world_id && myWorldId && myWorldId !== character!.world_id;
                  return (
                    <button
                      onClick={() => canMultiverse && setSelectedContext('multiverse')}
                      disabled={!canMultiverse}
                      className={`flex-1 py-2 px-3 text-xs rounded-lg border transition-all text-center ${
                        !canMultiverse
                          ? 'bg-slate-800/50 border-slate-700/50 text-slate-600 cursor-not-allowed'
                          : selectedContext === 'multiverse'
                          ? 'bg-purple-900/30 border-purple-700 text-purple-400'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-purple-700/50'
                      }`}
                    >
                      <div className="text-base mb-0.5">✨</div>
                      Multiverse
                    </button>
                  );
                })()}
              </div>
            </div>

            {/* Location Picker — only when "In World" context is selected */}
            {selectedContext === 'within_world' && worldLocations.length > 0 && (
              <div className="mb-4">
                <label className="text-xs uppercase tracking-wider text-slate-500 mb-2 block">Location (optional)</label>
                <select
                  value={selectedLocationId || ''}
                  onChange={(e) => setSelectedLocationId(e.target.value || null)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
                >
                  <option value="">No specific location</option>
                  {worldLocations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}{loc.type ? ` (${loc.type})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-3">
              {/* Option 1: Chat with AI */}
              <button
                onClick={() => startConversationWithMode('ai')}
                disabled={!character.is_ai_enabled || loadingChat}
                className={`w-full p-4 rounded-xl border text-left transition-all ${
                  character.is_ai_enabled
                    ? 'bg-purple-900/20 border-purple-700/50 hover:border-purple-500 hover:bg-purple-900/30 cursor-pointer'
                    : 'bg-slate-800/50 border-slate-700/50 opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-lg shrink-0">
                    🤖
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-white">Chat with AI</div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {character.is_ai_enabled
                        ? `${character.name}'s AI will respond. The owner won't be notified.`
                        : `${character.name} doesn't have AI enabled.`
                      }
                    </p>
                  </div>
                </div>
              </button>

              {/* Option 2: Chat with User (live) */}
              <button
                onClick={() => {
                  if (partnerStatus === 'online') {
                    startConversationWithMode('live');
                  } else if (character.is_ai_enabled) {
                    startConversationWithMode('ai_fallback');
                  } else {
                    startConversationWithMode('live');
                  }
                }}
                disabled={loadingChat || loadingStatus}
                className="w-full p-4 rounded-xl border bg-green-900/20 border-green-700/50 hover:border-green-500 hover:bg-green-900/30 transition-all text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-lg shrink-0">
                    💬
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">Chat with {character.creator_name}</span>
                      {loadingStatus ? (
                        <span className="text-xs text-slate-500">checking...</span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <span className={`w-2 h-2 rounded-full ${statusDot(partnerStatus)}`} />
                          <span className={`text-xs ${
                            partnerStatus === 'online' ? 'text-green-400' :
                            partnerStatus === 'away' ? 'text-amber-400' : 'text-slate-500'
                          }`}>
                            {statusLabel(partnerStatus)}
                          </span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {loadingStatus ? (
                        'Checking availability...'
                      ) : partnerStatus === 'online' ? (
                        'Live chat will start immediately. They\'ll be notified.'
                      ) : character.is_ai_enabled ? (
                        `AI will respond as ${character.name} until ${character.creator_name} takes over.`
                      ) : (
                        `${character.creator_name} will be notified of your chat request.`
                      )}
                    </p>
                  </div>
                </div>
              </button>
            </div>

            <button
              onClick={() => { setShowModeModal(false); setLoadingChat(false); }}
              className="w-full mt-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
