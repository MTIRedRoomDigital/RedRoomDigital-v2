'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface FeaturedCharacter {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  tags: string[];
  creator_name: string;
  chat_count: number;
}

export default function Home() {
  const { user } = useAuth();
  const [characters, setCharacters] = useState<FeaturedCharacter[]>([]);
  const [stats, setStats] = useState({ characters: 0, worlds: 0, users: 0 });

  useEffect(() => {
    // Fetch featured characters
    api.get<{ characters: FeaturedCharacter[]; total: number }>('/api/characters?limit=6').then((res) => {
      if (res.success && res.data) {
        setCharacters((res.data as any).characters || []);
      }
    });
    // Fetch platform stats
    api.get<{ characters: number; worlds: number; users: number }>('/api/auth/stats').then((res) => {
      if (res.success && res.data) setStats(res.data as any);
    });
  }, []);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl" />
          <div className="absolute top-40 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-64 bg-purple-500/5 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 pt-20 pb-24 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-red-500/10 border border-red-500/20 rounded-full text-sm text-red-400 mb-8">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            AI-Powered Roleplaying Platform
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold mb-6 leading-tight">
            <span className="text-white">Create Characters.</span>
            <br />
            <span className="text-white">Build Worlds.</span>
            <br />
            <span className="bg-gradient-to-r from-red-500 via-amber-400 to-red-500 bg-clip-text text-transparent">
              Tell Epic Stories.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10">
            An AI-powered platform where your characters have memory, your worlds have depth,
            and every conversation shapes the story. Stay in character. Build your legacy.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            {user ? (
              <>
                <Link
                  href="/characters/create"
                  className="px-8 py-3.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold rounded-xl shadow-lg shadow-red-500/25 transition-all hover:shadow-red-500/40 hover:-translate-y-0.5"
                >
                  Create a Character
                </Link>
                <Link
                  href="/explore"
                  className="px-8 py-3.5 border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white font-semibold rounded-xl transition-all hover:-translate-y-0.5"
                >
                  Explore Characters
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/register"
                  className="px-8 py-3.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold rounded-xl shadow-lg shadow-red-500/25 transition-all hover:shadow-red-500/40 hover:-translate-y-0.5"
                >
                  Get Started Free
                </Link>
                <Link
                  href="/explore"
                  className="px-8 py-3.5 border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white font-semibold rounded-xl transition-all hover:-translate-y-0.5"
                >
                  Explore Characters
                </Link>
              </>
            )}
          </div>

          {/* Stats bar */}
          <div className="flex justify-center gap-12 md:gap-20">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-white">{stats.characters || '...'}</div>
              <div className="text-sm text-slate-500 mt-1">Characters Created</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-white">{stats.worlds || '...'}</div>
              <div className="text-sm text-slate-500 mt-1">Worlds Built</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-white">{stats.users || '...'}</div>
              <div className="text-sm text-slate-500 mt-1">Storytellers</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Everything You Need to Tell Stories</h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              From character creation to world building to AI-powered roleplay &mdash; it&apos;s all here.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon="🎭"
              title="Deep Characters"
              description="Build characters with personality traits, backstory, relationships, and memories. The AI uses everything to stay in character."
              color="red"
            />
            <FeatureCard
              icon="🌍"
              title="Rich Worlds"
              description="Create immersive worlds with lore, rules, and setting details. Invite others to explore and roleplay in your creation."
              color="amber"
            />
            <FeatureCard
              icon="⚔️"
              title="Campaigns & Quests"
              description="Design multi-step campaigns with objectives, lore reveals, and branching paths. Be the WorldMaster."
              color="purple"
            />
            <FeatureCard
              icon="🤖"
              title="AI Memory"
              description="Your AI remembers every conversation, every event, every relationship. Characters grow and evolve over time."
              color="green"
            />
            <FeatureCard
              icon="💬"
              title="In-Character Chat"
              description="Chat with other players or let AI take control. Stay in kayfabe — breaking character is a strike."
              color="blue"
            />
            <FeatureCard
              icon="👥"
              title="Community"
              description="Find friends, join forum discussions, share your characters and worlds with the community."
              color="pink"
            />
          </div>
        </div>
      </section>

      {/* Featured Characters */}
      {characters.length > 0 && (
        <section className="py-20 border-t border-slate-800">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">Featured Characters</h2>
                <p className="text-slate-400">Discover characters created by the community</p>
              </div>
              <Link
                href="/explore"
                className="text-sm text-red-400 hover:text-red-300 transition-colors"
              >
                View all &rarr;
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {characters.slice(0, 6).map((char) => (
                <Link
                  key={char.id}
                  href={`/characters/${char.id}`}
                  className="p-5 bg-slate-800/50 border border-slate-700/50 rounded-xl hover:border-red-500/30 transition-all hover:-translate-y-0.5 group"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-700 to-slate-600 flex items-center justify-center text-xl group-hover:from-red-500/20 group-hover:to-amber-500/20 transition-colors">
                      🎭
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white truncate group-hover:text-red-400 transition-colors">{char.name}</h3>
                      <p className="text-xs text-slate-500">by {char.creator_name}</p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-400 line-clamp-2 mb-3">
                    {char.description || 'A mysterious character...'}
                  </p>
                  {char.tags && char.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {char.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="text-xs px-2 py-0.5 bg-slate-700/50 text-slate-400 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* How It Works */}
      <section className="py-20 border-t border-slate-800">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">How It Works</h2>
            <p className="text-slate-400">Get started in three simple steps</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center text-2xl">
                1
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Create a Character</h3>
              <p className="text-sm text-slate-400">
                Define personality, backstory, traits, and relationships. Your character is as deep as you make them.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center text-2xl">
                2
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Enter a World</h3>
              <p className="text-sm text-slate-400">
                Join an existing world or build your own. Set the rules, lore, and campaigns for others to explore.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-center justify-center text-2xl">
                3
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Start Roleplaying</h3>
              <p className="text-sm text-slate-400">
                Chat in character with other players or AI. Your characters grow, remember, and evolve with every conversation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      {!user && (
        <section className="py-20 border-t border-slate-800">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to Create Your First Character?
            </h2>
            <p className="text-slate-400 mb-8">
              Join the community. It&apos;s free to start &mdash; no credit card required.
            </p>
            <Link
              href="/register"
              className="inline-block px-10 py-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold rounded-xl shadow-lg shadow-red-500/25 transition-all hover:shadow-red-500/40 hover:-translate-y-0.5 text-lg"
            >
              Sign Up Free
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

const colorMap: Record<string, string> = {
  red: 'border-red-500/20 hover:border-red-500/40',
  amber: 'border-amber-500/20 hover:border-amber-500/40',
  purple: 'border-purple-500/20 hover:border-purple-500/40',
  green: 'border-green-500/20 hover:border-green-500/40',
  blue: 'border-blue-500/20 hover:border-blue-500/40',
  pink: 'border-pink-500/20 hover:border-pink-500/40',
};

function FeatureCard({ icon, title, description, color }: { icon: string; title: string; description: string; color: string }) {
  return (
    <div className={`p-6 rounded-xl border bg-slate-800/30 transition-all hover:-translate-y-0.5 ${colorMap[color] || colorMap.red}`}>
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
    </div>
  );
}
