'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

const typeIcons: Record<string, string> = {
  friend_request: '👤',
  friend_accepted: '🤝',
  chat_message: '💬',
  chat_request: '🔔',
  quest_invite: '⚔️',
  ai_transcript: '🤖',
  kayfabe_warning: '⚠️',
  world_invite: '🌍',
  world_character_request: '🎭',
  world_character_accepted: '✅',
  world_character_rejected: '❌',
  canon_request: '📜',
  canon_accepted: '📜',
  canon_rejected: '📜',
  canon_removal_request: '🗑️',
  canon_removal_accepted: '🗑️',
  canon_removal_rejected: '🗑️',
  system: '📢',
};

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (!user) return;

    api.get<{ notifications: Notification[] }>('/api/notifications').then((res) => {
      if (res.success && res.data) setNotifications((res.data as any).notifications);
      setLoading(false);
    });
  }, [user, authLoading, router]);

  const markRead = async (id: string) => {
    await api.put(`/api/notifications/${id}/read`, {});
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const markAllRead = async () => {
    await api.put('/api/notifications/read-all', {});
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const handleNotificationClick = async (n: Notification) => {
    // Don't navigate for actionable request notifications — they have inline buttons
    if (n.type === 'world_character_request' && !n.is_read) return;
    if (n.type === 'canon_request' && !n.is_read) return;
    if (n.type === 'canon_removal_request' && !n.is_read) return;

    // Mark as read first
    if (!n.is_read) await markRead(n.id);

    // Navigate based on notification type
    switch (n.type) {
      case 'friend_request':
      case 'friend_accepted':
        if (n.data?.fromUserId) {
          router.push(`/users/${n.data.fromUserId}`);
        }
        break;
      case 'chat_message':
      case 'chat_request':
        if (n.data?.conversationId) {
          router.push(`/chats/${n.data.conversationId}`);
        }
        break;
      case 'world_character_accepted':
      case 'world_character_rejected':
        if (n.data?.worldId) {
          router.push(`/worlds/${n.data.worldId}`);
        }
        break;
      case 'world_character_request':
        if (n.data?.worldId) {
          router.push(`/worlds/${n.data.worldId}`);
        }
        break;
      case 'canon_request':
      case 'canon_accepted':
      case 'canon_rejected':
      case 'canon_removal_request':
      case 'canon_removal_accepted':
      case 'canon_removal_rejected':
        if (n.data?.conversationId) {
          router.push(`/chats/${n.data.conversationId}`);
        }
        break;
      default:
        break;
    }
  };

  const handleCharacterRequest = async (n: Notification, action: 'accept' | 'reject') => {
    setResponding(n.id);
    const res = await api.post(`/api/worlds/${n.data.worldId}/character-request/respond`, {
      character_id: n.data.characterId,
      notification_id: n.id,
      action,
    });
    if (res.success) {
      setNotifications((prev) => prev.map((notif) => (notif.id === n.id ? { ...notif, is_read: true } : notif)));
    }
    setResponding(null);
  };

  const handleCanonRequest = async (n: Notification, action: 'accept' | 'reject') => {
    setResponding(n.id);
    const res = await api.post(`/api/conversations/${n.data.conversationId}/canon-request/respond`, {
      notification_id: n.id,
      action,
    });
    if (res.success) {
      setNotifications((prev) => prev.map((notif) => (notif.id === n.id ? { ...notif, is_read: true } : notif)));
    } else {
      alert((res as any).message || 'Something went wrong');
    }
    setResponding(null);
  };

  const handleCanonRemovalRequest = async (n: Notification, action: 'accept' | 'reject') => {
    setResponding(n.id);
    const res = await api.post(`/api/conversations/${n.data.conversationId}/canon-removal-request/respond`, {
      notification_id: n.id,
      action,
    });
    if (res.success) {
      setNotifications((prev) => prev.map((notif) => (notif.id === n.id ? { ...notif, is_read: true } : notif)));
    } else {
      alert((res as any).message || 'Something went wrong');
    }
    setResponding(null);
  };

  // Check if a notification type has a navigation target
  const isActionable = (n: Notification) => {
    if ((n.type === 'friend_request' || n.type === 'friend_accepted') && n.data?.fromUserId) return true;
    if ((n.type === 'chat_message' || n.type === 'chat_request') && n.data?.conversationId) return true;
    if ((n.type === 'world_character_accepted' || n.type === 'world_character_rejected') && n.data?.worldId) return true;
    if (n.type === 'world_character_request' && n.data?.worldId) return true;
    if (['canon_request', 'canon_accepted', 'canon_rejected', 'canon_removal_request', 'canon_removal_accepted', 'canon_removal_rejected'].includes(n.type) && n.data?.conversationId) return true;
    return false;
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  if (authLoading || loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-700 rounded w-1/4 mb-6" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-slate-800 rounded-xl mb-3" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Notifications</h1>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-sm text-red-400 hover:text-red-300 transition-colors"
          >
            Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🔔</div>
          <p className="text-slate-400">No notifications yet</p>
          <p className="text-sm text-slate-500 mt-1">You&apos;ll see friend requests, quest invites, and more here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => handleNotificationClick(n)}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                n.is_read
                  ? 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
                  : 'bg-slate-800 border-red-500/30 hover:border-red-500/50'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5">{typeIcons[n.type] || '📌'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium text-sm ${n.is_read ? 'text-slate-400' : 'text-white'}`}>
                      {n.title}
                    </span>
                    {!n.is_read && (
                      <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                    )}
                  </div>
                  {n.body && (
                    <p className="text-xs text-slate-500 mt-0.5">{n.body}</p>
                  )}
                  {/* Accept/Reject buttons for world character requests */}
                  {n.type === 'world_character_request' && !n.is_read && (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCharacterRequest(n, 'accept'); }}
                        disabled={responding === n.id}
                        className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 disabled:bg-slate-700 text-white rounded-lg transition-colors font-medium"
                      >
                        {responding === n.id ? '...' : 'Accept'}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCharacterRequest(n, 'reject'); }}
                        disabled={responding === n.id}
                        className="px-3 py-1 text-xs border border-slate-600 text-slate-400 hover:text-white rounded-lg transition-colors"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                  {/* Accept/Reject buttons for canon requests */}
                  {n.type === 'canon_request' && !n.is_read && (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCanonRequest(n, 'accept'); }}
                        disabled={responding === n.id}
                        className="px-3 py-1 text-xs bg-amber-600 hover:bg-amber-700 disabled:bg-slate-700 text-white rounded-lg transition-colors font-medium"
                      >
                        {responding === n.id ? '📜 Adding...' : '📜 Accept & Add to Canon'}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCanonRequest(n, 'reject'); }}
                        disabled={responding === n.id}
                        className="px-3 py-1 text-xs border border-slate-600 text-slate-400 hover:text-white rounded-lg transition-colors"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                  {/* Accept/Reject buttons for canon removal requests */}
                  {n.type === 'canon_removal_request' && !n.is_read && (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCanonRemovalRequest(n, 'accept'); }}
                        disabled={responding === n.id}
                        className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 disabled:bg-slate-700 text-white rounded-lg transition-colors font-medium"
                      >
                        {responding === n.id ? '🗑️ Removing...' : '🗑️ Accept & Remove Canon'}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCanonRemovalRequest(n, 'reject'); }}
                        disabled={responding === n.id}
                        className="px-3 py-1 text-xs border border-slate-600 text-slate-400 hover:text-white rounded-lg transition-colors"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-slate-600">{timeAgo(n.created_at)}</span>
                  {isActionable(n) && (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
