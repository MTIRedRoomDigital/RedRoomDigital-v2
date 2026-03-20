'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import Link from 'next/link';

interface Character {
  id: string;
  name: string;
  avatar_url: string | null;
  description: string | null;
  tags: string[];
  is_public: boolean;
  is_ai_enabled: boolean;
  chat_count: number;
  world_id: string | null;
  world_name?: string | null;
  created_at: string;
}

export default function MyCharactersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (!user) return;

    api.get<Character[]>('/api/users/characters').then((res) => {
      if (res.success && res.data) {
        setCharacters(res.data as any);
      }
      setLoading(false);
    });
  }, [user, authLoading, router]);

  if (authLoading || loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-700 rounded w-1/3 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-slate-800 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">My Characters</h1>
          <p className="text-sm text-slate-400 mt-1">{characters.length} character{characters.length !== 1 ? 's' : ''}</p>
        </div>
        <Link
          href="/characters/create"
          className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
        >
          + New Character
        </Link>
      </div>

      {/* Character Grid */}
      {characters.length === 0 ? (
        <div className="text-center py-16 bg-slate-800 border border-slate-700 rounded-xl">
          <div className="text-5xl mb-4">&#x1F3AD;</div>
          <h2 className="text-xl font-semibold text-white mb-2">No characters yet</h2>
          <p className="text-slate-400 mb-6 text-sm max-w-sm mx-auto">
            Create your first character to start roleplaying, chatting, and building stories.
          </p>
          <Link
            href="/characters/create"
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors inline-block text-sm font-medium"
          >
            Create Your First Character
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {characters.map((char) => (
            <Link
              key={char.id}
              href={`/characters/${char.id}`}
              className="group p-4 bg-slate-800 border border-slate-700 rounded-xl hover:border-red-500/50 transition-all"
            >
              <div className="flex gap-4">
                {/* Avatar */}
                {char.avatar_url ? (
                  <img
                    src={char.avatar_url}
                    alt={char.name}
                    className="w-16 h-16 rounded-xl object-cover shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center text-2xl shrink-0">
                    &#x1F3AD;
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-white group-hover:text-red-400 transition-colors truncate">
                      {char.name}
                    </h3>
                    {!char.is_public && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded-full shrink-0">
                        Private
                      </span>
                    )}
                    {char.is_ai_enabled && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-purple-900/30 text-purple-400 rounded-full shrink-0">
                        AI
                      </span>
                    )}
                  </div>

                  {char.description && (
                    <p className="text-sm text-slate-400 line-clamp-2 mb-2">{char.description}</p>
                  )}

                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>{char.chat_count} chats</span>
                    {char.world_name && (
                      <span className="flex items-center gap-1">
                        <span>&#x1F30D;</span> {char.world_name}
                      </span>
                    )}
                    {char.tags && char.tags.length > 0 && (
                      <span className="truncate">{char.tags.slice(0, 2).join(', ')}</span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Explore CTA */}
      {characters.length > 0 && (
        <div className="mt-8 text-center">
          <Link
            href="/explore"
            className="text-sm text-slate-400 hover:text-amber-400 transition-colors"
          >
            Explore other characters &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}
