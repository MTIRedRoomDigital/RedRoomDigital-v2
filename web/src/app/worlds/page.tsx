'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

interface World {
  id: string;
  name: string;
  description: string | null;
  setting: string | null;
  member_count: number;
  character_count: number;
  creator_name: string;
  is_public: boolean;
  created_at: string;
}

interface PaginatedResponse {
  data: World[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export default function WorldsPage() {
  const { user } = useAuth();
  const [worlds, setWorlds] = useState<World[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchWorlds = async (searchQuery = '', pageNum = 1) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(pageNum), limit: '12' });
    if (searchQuery) params.set('search', searchQuery);

    const res = await api.get<PaginatedResponse>(`/api/worlds?${params}`);
    if (res.success && res.data) {
      setWorlds((res.data as any).data || res.data as any);
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

  // Check if user can create worlds (premium+)
  const canCreateWorld = user && (user.subscription === 'premium' || user.subscription === 'ultimate');

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Explore Worlds</h1>
        <p className="text-slate-400">Discover immersive worlds created by WorldMasters</p>
      </div>

      {/* Search + Create */}
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
              canCreateWorld
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-slate-700 cursor-not-allowed'
            }`}
            title={!canCreateWorld ? 'Premium subscription required to create worlds' : undefined}
          >
            + Create World
          </Link>
        )}
      </div>

      {/* Free tier notice */}
      {user && !canCreateWorld && (
        <div className="max-w-xl mx-auto mb-6 p-4 bg-amber-900/20 border border-amber-700/50 rounded-lg text-center">
          <p className="text-amber-400 text-sm">
            World creation requires a <span className="font-semibold">Premium</span> or{' '}
            <span className="font-semibold">Ultimate</span> subscription.
          </p>
        </div>
      )}

      {/* Worlds Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-5 bg-slate-800 border border-slate-700 rounded-xl animate-pulse">
              <div className="h-5 bg-slate-700 rounded w-2/3 mb-3" />
              <div className="h-3 bg-slate-700 rounded w-full mb-2" />
              <div className="h-3 bg-slate-700 rounded w-4/5 mb-4" />
              <div className="flex justify-between">
                <div className="h-3 bg-slate-700 rounded w-1/4" />
                <div className="h-3 bg-slate-700 rounded w-1/4" />
              </div>
            </div>
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
                {/* World Header */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-2xl shrink-0">
                    🌍
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white group-hover:text-amber-400 transition-colors truncate">
                      {world.name}
                    </h3>
                    <p className="text-xs text-slate-500">by {world.creator_name}</p>
                  </div>
                </div>

                {/* Setting badge */}
                {world.setting && (
                  <p className="text-xs text-amber-400/80 bg-amber-900/20 px-2 py-1 rounded mb-2 truncate">
                    {world.setting}
                  </p>
                )}

                {/* Description */}
                {world.description && (
                  <p className="text-sm text-slate-400 mb-3 line-clamp-2">{world.description}</p>
                )}

                {/* Stats */}
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <div className="flex gap-3">
                    <span>{world.member_count} members</span>
                    <span>{world.character_count} characters</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <button
                onClick={() => { setPage(page - 1); fetchWorlds(search, page - 1); }}
                disabled={page === 1}
                className="px-4 py-2 text-sm border border-slate-600 rounded-lg text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <span className="px-4 py-2 text-sm text-slate-400">
                Page {page} of {totalPages}
              </span>
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
    </div>
  );
}
