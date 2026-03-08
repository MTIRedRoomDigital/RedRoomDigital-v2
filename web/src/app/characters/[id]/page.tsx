'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
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
  history: { event: string; date?: string; impact?: string }[];
  world_id: string | null;
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
}

export default function CharacterDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [character, setCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showChatModal, setShowChatModal] = useState(false);
  const [myCharacters, setMyCharacters] = useState<MyCharacter[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);

  useEffect(() => {
    api.get<Character>(`/api/characters/${params.id}`).then((res) => {
      if (res.success && res.data) {
        setCharacter(res.data);
      } else {
        setError(res.message || 'Character not found');
      }
      setLoading(false);
    });
  }, [params.id]);

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
        // Only one character — start chat immediately
        startConversation(chars[0].id);
        return;
      }
      // Multiple characters — show picker
      setMyCharacters(chars);
      setShowChatModal(true);
    }
  };

  const startConversation = async (myCharacterId: string) => {
    setLoadingChat(true);
    setShowChatModal(false);
    const res = await api.post<{ id: string }>('/api/conversations', {
      character_id: myCharacterId,
      partner_character_id: character!.id,
      context: character!.world_id ? 'within_world' : 'vacuum',
      world_id: character!.world_id,
    });

    if (res.success && res.data) {
      router.push(`/chats/${(res.data as any).id}`);
    } else {
      setLoadingChat(false);
      alert(res.message || 'Failed to start conversation');
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
        <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center text-5xl shrink-0">
          🎭
        </div>

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
            <span>Created by <strong className="text-slate-300">{character.creator_name}</strong></span>
            <span>•</span>
            <span>{character.chat_count} chats</span>
            <span>•</span>
            <span>{new Date(character.created_at).toLocaleDateString()}</span>
          </div>

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
              <Link
                href={`/characters/${character.id}/edit`}
                className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
              >
                ✏️ Edit Character
              </Link>
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
                  <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center text-lg">
                    🎭
                  </div>
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
              {character.history.map((event, i) => (
                <div key={i} className="flex gap-3 pl-4 border-l-2 border-slate-600">
                  <div>
                    <p className="text-sm text-slate-300">{event.event}</p>
                    {event.date && <p className="text-xs text-slate-500 mt-0.5">{event.date}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

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
                  onClick={() => startConversation(char.id)}
                  className="w-full flex items-center gap-3 p-3 bg-slate-700/50 border border-slate-600 rounded-lg hover:border-red-500/50 hover:bg-slate-700 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center text-lg shrink-0">
                    🎭
                  </div>
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
    </div>
  );
}
