'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

// ——— Types ———
interface Character {
  id: string;
  name: string;
  avatar_url: string | null;
  description: string | null;
  tags: string[];
  chat_count: number;
  rating: number;
  creator_id: string;
  creator_name: string;
  world_id: string | null;
  world_name: string | null;
  created_at: string;
  has_learned_voice?: boolean;
  has_preset_voice?: boolean;
}

interface World {
  id: string;
  name: string;
  description: string | null;
  setting: string | null;
  thumbnail_url: string | null;
  member_count: number;
  character_count: number;
  creator_name: string;
  is_public: boolean;
  created_at: string;
}

interface PublicChat {
  id: string;
  title: string | null;
  context: string;
  chat_mode: 'ai' | 'live' | 'ai_fallback';
  world_id: string | null;
  world_name: string | null;
  last_canon_at: string | null;
  created_at: string;
  updated_at: string;
  message_count: string;
  participants: {
    character_id: string;
    character_name: string;
    character_avatar: string | null;
    username: string;
  }[];
}

interface Paginated<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

type TabKey = 'characters' | 'public-chats' | 'worlds';

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function ExploreContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const initialTab = (searchParams.get('tab') as TabKey) || 'characters';
  const [tab, setTab] = useState<TabKey>(
    ['characters', 'public-chats', 'worlds'].includes(initialTab) ? initialTab : 'characters'
  );

  const setActiveTab = (t: TabKey) => {
    setTab(t);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', t);
    router.replace(`/explore?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Explore RedRoom</h1>
        <p className="text-slate-400">Discover characters, chats, and worlds created by the community</p>
      </div>

      {/* Unauthenticated banner — tells visitors landing directly on /explore what
          they can do here. Without this, a cold visitor from a shared link has no
          prompt to register or learn what the platform actually is. */}
      {!user && (
        <div className="mb-8 p-4 rounded-xl bg-gradient-to-r from-red-900/30 to-amber-900/20 border border-red-800/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div>
            <p className="text-sm text-white font-medium">New to RedRoom?</p>
            <p className="text-xs text-slate-400 mt-0.5">
              This is a roleplay platform where AI characters remember every chat. Create your own or chat with the ones below.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link
              href="/guide"
              className="px-3 py-1.5 text-xs border border-slate-600 text-slate-300 hover:text-white hover:border-slate-400 rounded-lg transition-colors"
            >
              Read the 2-min guide
            </Link>
            <Link
              href="/register"
              className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
            >
              Sign up free
            </Link>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex bg-slate-800/60 border border-slate-700 rounded-xl p-1 gap-1">
          {(
            [
              { key: 'characters', label: '🎭 Characters' },
              { key: 'public-chats', label: '🌐 Public Chats' },
              { key: 'worlds', label: '🌍 Worlds' },
            ] as { key: TabKey; label: string }[]
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                tab === t.key
                  ? 'bg-red-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'characters' && <CharactersTab />}
      {tab === 'public-chats' && <PublicChatsTab />}
      {tab === 'worlds' && <WorldsTab user={user} />}
    </div>
  );
}

// ——— Characters Tab ———
function CharactersTab() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchCharacters = async (searchQuery = '', pageNum = 1) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(pageNum), limit: '12' });
    if (searchQuery) params.set('search', searchQuery);
    const res = await api.get<Paginated<Character>>(`/api/characters?${params}`);
    if (res.success && res.data) {
      setCharacters((res.data as any).data || (res.data as any));
      setTotalPages((res.data as any).pagination?.totalPages || 1);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCharacters();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchCharacters(search, 1);
  };

  return (
    <>
      <form onSubmit={handleSearch} className="max-w-xl mx-auto mb-8">
        <div className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search characters by name or description..."
            className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
          />
          <button
            type="submit"
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Search
          </button>
        </div>
      </form>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-5 bg-slate-800 border border-slate-700 rounded-xl animate-pulse h-36" />
          ))}
        </div>
      ) : characters.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🎭</div>
          <h2 className="text-xl font-bold text-white mb-2">No characters found</h2>
          <p className="text-slate-400 mb-6">
            {search ? `No results for "${search}"` : 'Be the first to create a character!'}
          </p>
          <Link
            href="/characters/create"
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors inline-block"
          >
            Create a Character
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {characters.map((char) => (
              <Link
                key={char.id}
                href={`/characters/${char.id}`}
                className="group p-5 bg-slate-800 border border-slate-700 rounded-xl hover:border-red-500/50 transition-all hover:shadow-lg hover:shadow-red-500/5"
              >
                <div className="flex items-center gap-3 mb-3">
                  {char.avatar_url ? (
                    <img src={char.avatar_url} alt={char.name} className="w-12 h-12 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center text-2xl shrink-0">
                      🎭
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white group-hover:text-red-400 transition-colors truncate">
                      {char.name}
                    </h3>
                    <p className="text-xs text-slate-500">
                      by{' '}
                      <span
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          window.location.href = `/users/${char.creator_id}`;
                        }}
                        className="hover:text-red-400 cursor-pointer transition-colors"
                      >
                        {char.creator_name}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mb-2">
                  {char.world_name && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-purple-900/30 text-purple-300 border border-purple-800/50 rounded-full">
                      🌍 {char.world_name}
                    </span>
                  )}
                  {char.has_learned_voice ? (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-amber-900/30 text-amber-300 border border-amber-800/50 rounded-full"
                      title="The AI has learned this character's voice from real chats"
                    >
                      ✨ Learned voice
                    </span>
                  ) : char.has_preset_voice ? (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-slate-700/60 text-slate-300 border border-slate-600/50 rounded-full"
                      title="Creator picked a speaking style — the AI will refine it as they play"
                    >
                      📣 Preset voice
                    </span>
                  ) : null}
                </div>

                {char.description && (
                  <p className="text-sm text-slate-400 mb-3 line-clamp-2">{char.description}</p>
                )}

                <div className="flex items-center justify-between">
                  {char.tags.length > 0 ? (
                    <div className="flex gap-1 overflow-hidden">
                      {char.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="px-2 py-0.5 text-xs bg-slate-700 text-slate-400 rounded-full truncate">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div />
                  )}
                  <span className="text-xs text-slate-500 shrink-0">{char.chat_count} chats</span>
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <button
                onClick={() => { setPage(page - 1); fetchCharacters(search, page - 1); }}
                disabled={page === 1}
                className="px-4 py-2 text-sm border border-slate-600 rounded-lg text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← Prev
              </button>
              <span className="px-4 py-2 text-sm text-slate-400">Page {page} of {totalPages}</span>
              <button
                onClick={() => { setPage(page + 1); fetchCharacters(search, page + 1); }}
                disabled={page === totalPages}
                className="px-4 py-2 text-sm border border-slate-600 rounded-lg text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}

// ——— Public Chats Tab ———
function PublicChatsTab() {
  const [chats, setChats] = useState<PublicChat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<PublicChat[]>('/api/conversations/public').then((res) => {
      if (res.success && res.data) setChats(res.data as any);
      setLoading(false);
    });
  }, []);

  return (
    <>
      <p className="text-center text-slate-400 text-sm mb-6 max-w-2xl mx-auto">
        Conversations the community has chosen to share. Both players agreed to publish — peek in on the roleplay.
      </p>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-40 bg-slate-800/50 border border-slate-700 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : chats.length === 0 ? (
        <div className="text-center py-20 bg-slate-800/30 border border-slate-700/50 rounded-xl">
          <div className="text-6xl mb-4">🌐</div>
          <h2 className="text-xl font-semibold text-white mb-2">No public chats yet</h2>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Nobody has shared a chat publicly yet. Want to be first? Start a chat and both players can agree to make it public.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {chats.map((chat) => (
            <Link
              key={chat.id}
              href={`/chats/${chat.id}`}
              className="p-5 bg-slate-800/50 border border-slate-700 rounded-xl hover:border-blue-500/40 hover:-translate-y-0.5 transition-all group"
            >
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {chat.chat_mode === 'ai' || chat.chat_mode === 'ai_fallback' ? (
                  <span className="text-[10px] px-1.5 py-0.5 bg-purple-900/30 text-purple-400 rounded-full border border-purple-800/40">🤖 AI</span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 bg-green-900/30 text-green-400 rounded-full border border-green-800/40">Live</span>
                )}
                {chat.last_canon_at && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-amber-900/30 text-amber-400 rounded-full border border-amber-800/40">📜 Canon</span>
                )}
                {chat.world_name && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-slate-700/50 text-slate-300 rounded-full">{chat.world_name}</span>
                )}
              </div>

              <div className="flex items-center gap-2 mb-3">
                {chat.participants.slice(0, 3).map((p, i) => (
                  <div
                    key={p.character_id}
                    className="w-9 h-9 rounded-full bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center text-sm overflow-hidden border-2 border-slate-800"
                    style={{ marginLeft: i > 0 ? '-10px' : 0, zIndex: 3 - i }}
                  >
                    {p.character_avatar ? (
                      <img src={p.character_avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      '🎭'
                    )}
                  </div>
                ))}
              </div>

              <p className="text-sm font-semibold text-white mb-1 truncate group-hover:text-blue-400 transition-colors">
                {chat.participants.map((p) => p.character_name).join(' & ') || chat.title || 'Untitled chat'}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {chat.participants.map((p) => `@${p.username}`).join(' · ')}
              </p>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700/50 text-xs text-slate-500">
                <span>💬 {chat.message_count} messages</span>
                <span>{timeAgo(chat.updated_at)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

// ——— Worlds Tab ———
function WorldsTab({ user }: { user: any }) {
  const [worlds, setWorlds] = useState<World[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchWorlds = async (searchQuery = '', pageNum = 1) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(pageNum), limit: '12' });
    if (searchQuery) params.set('search', searchQuery);
    const res = await api.get<Paginated<World>>(`/api/worlds?${params}`);
    if (res.success && res.data) {
      setWorlds((res.data as any).data || (res.data as any));
      setTotalPages((res.data as any).pagination?.totalPages || 1);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchWorlds();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchWorlds(search, 1);
  };

  const canCreateWorld = user && (user.subscription === 'premium' || user.subscription === 'ultimate');

  return (
    <>
      <div className="flex flex-col sm:flex-row items-center gap-4 max-w-2xl mx-auto mb-8">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 w-full">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search worlds by name or setting..."
            className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
          />
          <button
            type="submit"
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Search
          </button>
        </form>
        {user && (
          <Link
            href="/worlds/create"
            className={`px-5 py-2.5 rounded-lg text-white text-sm font-medium transition-colors shrink-0 ${
              canCreateWorld ? 'bg-amber-600 hover:bg-amber-700' : 'bg-slate-700 cursor-not-allowed'
            }`}
            title={!canCreateWorld ? 'Premium subscription required to create worlds' : undefined}
          >
            + Create World
          </Link>
        )}
      </div>

      {user && !canCreateWorld && (
        <div className="max-w-xl mx-auto mb-6 p-4 bg-amber-900/20 border border-amber-700/50 rounded-lg text-center">
          <p className="text-amber-400 text-sm">
            World creation requires a <span className="font-semibold">Premium</span> or{' '}
            <span className="font-semibold">Ultimate</span> subscription.
          </p>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-5 bg-slate-800 border border-slate-700 rounded-xl animate-pulse h-36" />
          ))}
        </div>
      ) : worlds.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🌍</div>
          <h2 className="text-xl font-bold text-white mb-2">No worlds found</h2>
          <p className="text-slate-400 mb-6">
            {search ? `No results for "${search}"` : 'Be the first to create an immersive world!'}
          </p>
          {canCreateWorld && (
            <Link
              href="/worlds/create"
              className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors inline-block"
            >
              Create a World
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {worlds.map((world) => (
              <Link
                key={world.id}
                href={`/worlds/${world.id}`}
                className="group p-5 bg-slate-800 border border-slate-700 rounded-xl hover:border-amber-500/50 transition-all hover:shadow-lg hover:shadow-amber-500/5"
              >
                <div className="flex items-start gap-3 mb-3">
                  {world.thumbnail_url ? (
                    <img src={world.thumbnail_url} alt={world.name} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-2xl shrink-0">
                      🌍
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white group-hover:text-amber-400 transition-colors truncate">
                      {world.name}
                    </h3>
                    <p className="text-xs text-slate-500">by {world.creator_name}</p>
                  </div>
                </div>

                {world.setting && (
                  <p className="text-xs text-amber-400/80 bg-amber-900/20 px-2 py-1 rounded mb-2 truncate">
                    {world.setting}
                  </p>
                )}

                {world.description && (
                  <p className="text-sm text-slate-400 mb-3 line-clamp-2">{world.description}</p>
                )}

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <div className="flex gap-3">
                    <span>{world.member_count} members</span>
                    <span>{world.character_count} characters</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <button
                onClick={() => { setPage(page - 1); fetchWorlds(search, page - 1); }}
                disabled={page === 1}
                className="px-4 py-2 text-sm border border-slate-600 rounded-lg text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <span className="px-4 py-2 text-sm text-slate-400">Page {page} of {totalPages}</span>
              <button
                onClick={() => { setPage(page + 1); fetchWorlds(search, page + 1); }}
                disabled={page === totalPages}
                className="px-4 py-2 text-sm border border-slate-600 rounded-lg text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}

export default function ExplorePage() {
  return (
    <Suspense fallback={<div className="max-w-6xl mx-auto px-4 py-8 text-center text-slate-400">Loading...</div>}>
      <ExploreContent />
    </Suspense>
  );
}
