'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

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

export default function PublicChatsPage() {
  const [chats, setChats] = useState<PublicChat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<PublicChat[]>('/api/conversations/public').then((res) => {
      if (res.success && res.data) setChats(res.data as any);
      setLoading(false);
    });
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold text-white">🌐 Public Chats</h1>
        </div>
        <p className="text-slate-400">
          Conversations the community has chosen to share. Read along — no spectating allowed in private rooms.
        </p>
      </div>

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
            Nobody has shared a chat publicly yet. Want to be first?{' '}
            Start a chat and both players can agree to make it public.
          </p>
          <Link
            href="/explore"
            className="inline-block px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
          >
            Find someone to chat with
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {chats.map((chat) => (
            <Link
              key={chat.id}
              href={`/chats/${chat.id}`}
              className="p-5 bg-slate-800/50 border border-slate-700 rounded-xl hover:border-blue-500/40 hover:-translate-y-0.5 transition-all group"
            >
              <div className="flex items-center gap-2 mb-3">
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
                    ) : '🎭'}
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
    </div>
  );
}
