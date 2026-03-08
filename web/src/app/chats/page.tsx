'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Conversation {
  id: string;
  context: string;
  title: string;
  is_active: boolean;
  updated_at: string;
  my_character_id: string;
  my_character_name: string;
  my_character_avatar: string | null;
  unread_count: number;
  partner: {
    character_id: string;
    character_name: string;
    character_avatar: string | null;
    owner_name: string;
  } | null;
  last_message: {
    content: string;
    created_at: string;
    sender_type: string;
    sender_name: string;
  } | null;
}

export default function ChatsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      api.get<Conversation[]>('/api/conversations').then((res) => {
        if (res.success && res.data) {
          setConversations(res.data as any);
        }
        setLoading(false);
      });
    }
  }, [user, authLoading, router]);

  if (authLoading || loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-slate-400">Loading conversations...</div>
      </div>
    );
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const contextLabels: Record<string, { label: string; color: string }> = {
    vacuum: { label: 'Vacuum', color: 'text-slate-400 bg-slate-700' },
    within_world: { label: 'In World', color: 'text-amber-400 bg-amber-900/30' },
    multiverse: { label: 'Multiverse', color: 'text-purple-400 bg-purple-900/30' },
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Chats</h1>
          <p className="text-slate-400 text-sm mt-1">Your character conversations</p>
        </div>
        <Link
          href="/explore"
          className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
        >
          Find Characters
        </Link>
      </div>

      {/* Conversations List */}
      {conversations.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">💬</div>
          <h2 className="text-xl font-bold text-white mb-2">No conversations yet</h2>
          <p className="text-slate-400 mb-6">
            Start a chat by visiting a character&apos;s page and clicking &ldquo;Start Chat&rdquo;
          </p>
          <Link
            href="/explore"
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors inline-block"
          >
            Explore Characters
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => {
            const ctx = contextLabels[conv.context] || contextLabels.vacuum;

            return (
              <Link
                key={conv.id}
                href={`/chats/${conv.id}`}
                className="group flex items-center gap-4 p-4 bg-slate-800 border border-slate-700 rounded-xl hover:border-red-500/50 transition-all"
              >
                {/* Partner Avatar */}
                <div className="relative shrink-0">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center text-2xl">
                    🎭
                  </div>
                  {conv.unread_count > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] text-white font-bold">
                      {conv.unread_count > 9 ? '9+' : conv.unread_count}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-white group-hover:text-red-400 transition-colors truncate">
                      {conv.partner?.character_name || 'Unknown'}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${ctx.color}`}>
                      {ctx.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-1">
                    {conv.my_character_name} &harr; {conv.partner?.character_name}
                    {conv.partner?.owner_name && (
                      <span className="text-slate-600"> (by {conv.partner.owner_name})</span>
                    )}
                  </p>
                  {conv.last_message ? (
                    <p className="text-sm text-slate-400 truncate">
                      <span className="text-slate-500">{conv.last_message.sender_name}:</span>{' '}
                      {conv.last_message.content}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-500 italic">No messages yet</p>
                  )}
                </div>

                {/* Time */}
                <div className="text-xs text-slate-500 shrink-0">
                  {conv.last_message
                    ? formatTime(conv.last_message.created_at)
                    : formatTime(conv.updated_at)}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
