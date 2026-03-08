'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';

interface Category {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  post_count: string;
}

export default function ForumPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Category[]>('/api/forum/categories').then((res) => {
      if (res.success && res.data) setCategories(res.data as any);
      setLoading(false);
    });
  }, []);

  const categoryIcons: Record<string, string> = {
    'General Discussion': '💬',
    'Character Workshop': '🎭',
    'World Building': '🌍',
    'Quest Board': '⚔️',
    'Lore & Stories': '📜',
    'Bug Reports': '🐛',
    'Feature Requests': '💡',
    'Introductions': '👋',
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-700 rounded w-1/4 mb-6" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-slate-800 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Community Forum</h1>
          <p className="text-slate-400 text-sm mt-1">Discuss, share stories, and connect with fellow adventurers</p>
        </div>
      </div>

      {categories.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">💬</div>
          <h2 className="text-xl font-semibold text-white mb-2">Forum Coming Soon</h2>
          <p className="text-slate-400">Categories are being set up. Check back shortly!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/forum/${cat.id}`}
              className="block p-5 bg-slate-800 border border-slate-700 rounded-xl hover:border-red-500/50 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="text-3xl shrink-0">
                  {categoryIcons[cat.name] || '📌'}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white group-hover:text-red-400 transition-colors">
                    {cat.name}
                  </h3>
                  {cat.description && (
                    <p className="text-sm text-slate-400 mt-0.5">{cat.description}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-bold text-white">{cat.post_count}</div>
                  <div className="text-xs text-slate-500">posts</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
