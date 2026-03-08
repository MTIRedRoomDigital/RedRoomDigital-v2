'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';

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
  created_at: string;
}

interface PaginatedResponse {
  data: Character[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export default function ExplorePage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchCharacters = async (searchQuery = '', pageNum = 1) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(pageNum), limit: '12' });
    if (searchQuery) params.set('search', searchQuery);

    const res = await api.get<PaginatedResponse>(`/api/characters?${params}`);
    if (res.success && res.data) {
      // The API returns { data: [...], pagination: {...} } nested inside the ApiResponse
      // But our api client wraps it, so res.data contains the inner data
      setCharacters((res.data as any).data || res.data as any);
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
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Explore Characters</h1>
        <p className="text-slate-400">Discover characters created by the community</p>
      </div>

      {/* Search */}
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

      {/* Characters Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-5 bg-slate-800 border border-slate-700 rounded-xl animate-pulse">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-slate-700" />
                <div className="flex-1">
                  <div className="h-4 bg-slate-700 rounded w-2/3 mb-2" />
                  <div className="h-3 bg-slate-700 rounded w-1/3" />
                </div>
              </div>
              <div className="h-3 bg-slate-700 rounded w-full mb-2" />
              <div className="h-3 bg-slate-700 rounded w-4/5" />
            </div>
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
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center text-2xl shrink-0">
                    🎭
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white group-hover:text-red-400 transition-colors truncate">
                      {char.name}
                    </h3>
                    <p className="text-xs text-slate-500">by {char.creator_name}</p>
                  </div>
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <button
                onClick={() => { setPage(page - 1); fetchCharacters(search, page - 1); }}
                disabled={page === 1}
                className="px-4 py-2 text-sm border border-slate-600 rounded-lg text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← Prev
              </button>
              <span className="px-4 py-2 text-sm text-slate-400">
                Page {page} of {totalPages}
              </span>
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
    </div>
  );
}
