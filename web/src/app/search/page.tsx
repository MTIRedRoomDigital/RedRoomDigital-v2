'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface SearchUser {
  id: string;
  username: string;
  avatar_url: string | null;
  subscription: string;
}

interface SearchCharacter {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  tags: string[];
  creator_name: string;
}

interface SearchWorld {
  id: string;
  name: string;
  description: string | null;
  setting: string | null;
  creator_name: string;
}

interface SearchResults {
  users: SearchUser[];
  characters: SearchCharacter[];
  worlds: SearchWorld[];
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (searchQuery?: string) => {
    const q = searchQuery ?? query;
    if (q.trim().length < 2) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await api.get<SearchResults>(`/api/users/search?q=${encodeURIComponent(q)}`);
      if (res.success && res.data) {
        setResults(res.data as any);
      }
    } catch {
      setResults(null);
    }
    setLoading(false);
  };

  const tierColors: Record<string, string> = {
    premium: 'text-amber-400',
    ultimate: 'text-purple-400',
    free: 'text-slate-500',
  };

  const totalResults = results
    ? results.users.length + results.characters.length + results.worlds.length
    : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-white mb-6">Search</h1>

      {/* Search Bar */}
      <div className="flex gap-3 mb-8">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search characters, worlds, users..."
          className="flex-1 px-5 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:border-red-500 focus:outline-none transition-colors text-lg"
          autoFocus
        />
        <button
          onClick={() => handleSearch()}
          disabled={loading || query.trim().length < 2}
          className="px-8 py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:text-slate-400 text-white font-semibold rounded-xl transition-colors"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Results */}
      {searched && !loading && results && (
        <div>
          <p className="text-sm text-slate-500 mb-6">
            {totalResults} result{totalResults !== 1 ? 's' : ''} found
          </p>

          {/* Characters */}
          {results.characters.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span>🎭</span> Characters
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {results.characters.map((char) => (
                  <Link
                    key={char.id}
                    href={`/characters/${char.id}`}
                    className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl hover:border-red-500/30 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-lg">
                        🎭
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white truncate">{char.name}</h3>
                        <p className="text-xs text-slate-500">by {char.creator_name}</p>
                      </div>
                    </div>
                    {char.description && (
                      <p className="text-sm text-slate-400 mt-2 line-clamp-2">{char.description}</p>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Worlds */}
          {results.worlds.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span>🌍</span> Worlds
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {results.worlds.map((world) => (
                  <Link
                    key={world.id}
                    href={`/worlds/${world.id}`}
                    className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl hover:border-amber-500/30 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-lg">
                        🌍
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white truncate">{world.name}</h3>
                        <p className="text-xs text-slate-500">
                          by {world.creator_name}
                          {world.setting && <span> &middot; {world.setting}</span>}
                        </p>
                      </div>
                    </div>
                    {world.description && (
                      <p className="text-sm text-slate-400 mt-2 line-clamp-2">{world.description}</p>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Users */}
          {results.users.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span>👥</span> Users
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {results.users.map((u) => (
                  <Link
                    key={u.id}
                    href={`/users/${u.id}`}
                    className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl hover:border-purple-500/30 transition-all flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center text-white font-bold">
                      {u.username[0].toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{u.username}</h3>
                      <p className={`text-xs ${tierColors[u.subscription] || tierColors.free}`}>
                        {u.subscription}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {totalResults === 0 && (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">🔍</div>
              <h3 className="text-xl font-semibold text-white mb-2">No results found</h3>
              <p className="text-slate-400">
                Try a different search term or check your spelling.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Initial state */}
      {!searched && (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold text-white mb-2">Find Anything</h3>
          <p className="text-slate-400">
            Search for characters, worlds, and users across the platform.
          </p>
        </div>
      )}
    </div>
  );
}
