'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

interface MiniConversation {
  id: string;
  is_active: boolean;
  chat_mode: 'ai' | 'live' | 'ai_fallback';
  unread_count: number;
  my_character_name: string;
  partner: {
    character_name: string;
    character_avatar: string | null;
    owner_name: string;
  } | null;
  last_message: {
    content: string;
    sender_name: string;
  } | null;
}

export function ChatTabs() {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [conversations, setConversations] = useState<MiniConversation[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Don't show on chat detail pages (full chat is already open) or auth pages
  const hiddenPaths = ['/login', '/register'];
  const isOnChatPage = pathname?.match(/^\/chats\/[^/]+$/);
  const isHidden = !user || hiddenPaths.some((p) => pathname?.startsWith(p)) || isOnChatPage;

  useEffect(() => {
    if (!user) return;

    const fetchChats = () => {
      api.get<MiniConversation[]>('/api/conversations').then((res) => {
        if (res.success && res.data) {
          // Only show active conversations, limited to most recent 5
          const active = (res.data as any[])
            .filter((c: any) => c.is_active)
            .slice(0, 5);
          setConversations(active);
        }
        setLoaded(true);
      });
    };

    fetchChats();

    // Refresh every 30s
    const interval = setInterval(fetchChats, 30000);
    return () => clearInterval(interval);
  }, [user]);

  if (isHidden || !loaded || conversations.length === 0) return null;

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);

  return (
    <div className="fixed bottom-0 right-4 z-40 flex items-end gap-1">
      {/* Collapsed: just the bar header */}
      {collapsed ? (
        <button
          onClick={() => setCollapsed(false)}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 border border-slate-700 border-b-0 rounded-t-lg text-sm font-medium text-white hover:bg-slate-750 transition-colors shadow-lg"
        >
          <span>💬</span>
          <span>Chats</span>
          {totalUnread > 0 && (
            <span className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] text-white font-bold">
              {totalUnread > 9 ? '9+' : totalUnread}
            </span>
          )}
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
      ) : (
        <div className="w-72 bg-slate-800 border border-slate-700 border-b-0 rounded-t-lg shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 bg-slate-750 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <span className="text-sm">💬</span>
              <span className="text-sm font-semibold text-white">Active Chats</span>
              {totalUnread > 0 && (
                <span className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] text-white font-bold">
                  {totalUnread > 9 ? '9+' : totalUnread}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => router.push('/chats')}
                className="p-1 text-slate-400 hover:text-white transition-colors"
                title="View all chats"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </button>
              <button
                onClick={() => setCollapsed(true)}
                className="p-1 text-slate-400 hover:text-white transition-colors"
                title="Minimize"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Chat list */}
          <div className="max-h-80 overflow-y-auto">
            {conversations.map((conv) => {
              const isAI = conv.chat_mode === 'ai';
              return (
                <button
                  key={conv.id}
                  onClick={() => router.push(`/chats/${conv.id}`)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-700/50 transition-colors text-left border-b border-slate-700/50 last:border-b-0"
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    {conv.partner?.character_avatar ? (
                      <img
                        src={conv.partner.character_avatar}
                        alt={conv.partner?.character_name}
                        className={`w-9 h-9 rounded-full object-cover border-2 ${
                          isAI ? 'border-purple-500/50' : 'border-green-500/50'
                        }`}
                      />
                    ) : (
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs border-2 ${
                        isAI
                          ? 'bg-gradient-to-br from-purple-500 to-blue-600 border-purple-500/50'
                          : 'bg-gradient-to-br from-green-500 to-emerald-600 border-green-500/50'
                      }`}>
                        {isAI ? '🤖' : '🎭'}
                      </div>
                    )}
                    {conv.unread_count > 0 && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[8px] text-white font-bold">
                        {conv.unread_count > 9 ? '9+' : conv.unread_count}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-semibold truncate ${conv.unread_count > 0 ? 'text-white' : 'text-slate-300'}`}>
                        {conv.partner?.character_name || 'Unknown'}
                      </span>
                      {isAI && (
                        <span className="text-[8px] px-1 py-0.5 rounded bg-purple-900/30 text-purple-400 shrink-0">AI</span>
                      )}
                    </div>
                    {conv.last_message ? (
                      <p className={`text-[11px] truncate ${conv.unread_count > 0 ? 'text-slate-400' : 'text-slate-500'}`}>
                        {conv.last_message.content}
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-600 italic">No messages yet</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer link */}
          <button
            onClick={() => router.push('/chats')}
            className="w-full py-2 text-center text-[11px] text-slate-500 hover:text-slate-300 bg-slate-800/80 border-t border-slate-700/50 transition-colors"
          >
            View all chats &rarr;
          </button>
        </div>
      )}
    </div>
  );
}
