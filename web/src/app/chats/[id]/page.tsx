'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { connectSocket, disconnectSocket, getSocket } from '@/lib/socket';
import Link from 'next/link';
import { CharacterPanel, UserStrip } from '@/components/ChatSidebar';

interface Message {
  id: string;
  conversation_id: string;
  sender_character_id: string;
  sender_user_id: string;
  sender_type: string;
  content: string;
  sender_name: string;
  sender_avatar: string | null;
  created_at: string;
}

interface Participant {
  character_id: string;
  user_id: string;
  character_name: string;
  character_avatar: string | null;
  owner_name: string;
  is_ai_controlled: boolean;
}

interface ConversationData {
  id: string;
  context: string;
  title: string;
  is_active: boolean;
  world_id: string | null;
  location_id: string | null;
  location: { id: string; name: string; description: string | null; type: string | null } | null;
  chat_mode: 'ai' | 'live' | 'ai_fallback';
  is_canon: boolean;
  is_public: boolean;
  last_canon_at: string | null;
  public_requested_by: string | null;
  takeover_requested_by: string | null;
  participants: Participant[];
}

export default function ChatRoomPage() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [conversation, setConversation] = useState<ConversationData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [chatLimitHit, setChatLimitHit] = useState(false);
  const [takingOver, setTakingOver] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [ending, setEnding] = useState(false);
  const [requestingCanon, setRequestingCanon] = useState(false);
  const [canonRequestSent, setCanonRequestSent] = useState(false);
  const [requestingPublic, setRequestingPublic] = useState(false);
  const [publicRequestSent, setPublicRequestSent] = useState(false);
  const [takeoverRequesting, setTakeoverRequesting] = useState(false);
  const [takeoverRequestSent, setTakeoverRequestSent] = useState(false);
  const [takeoverPrompt, setTakeoverPrompt] = useState<{ characterName: string } | null>(null);
  const [respondingToTakeover, setRespondingToTakeover] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Find which character belongs to the current user in this conversation
  const myParticipant = conversation?.participants.find((p) => p.user_id === user?.id);
  const partnerParticipant = conversation?.participants.find((p) => p.user_id !== user?.id);

  // Can this user take over from AI? (User B sees this when their character is AI-controlled in ai_fallback)
  const canTakeOver = conversation?.chat_mode === 'ai_fallback' && myParticipant?.is_ai_controlled;

  // Is this user the character owner in a pure AI chat? (They can REQUEST to take over)
  const isCharOwnerInAIChat = conversation?.chat_mode === 'ai' && myParticipant?.is_ai_controlled;

  // Is there a pending takeover request aimed at this user? (User A sees the prompt)
  const hasPendingTakeoverForMe = conversation?.takeover_requested_by && conversation.takeover_requested_by !== user?.id;

  // Is this an AI-powered chat? (used to show thinking indicator)
  const isAIChat = (conversation?.chat_mode === 'ai' || conversation?.chat_mode === 'ai_fallback') && !canTakeOver;

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Load conversation data + messages
  useEffect(() => {
    if (authLoading || !id) return;

    const loadData = async () => {
      // Fetch conversation details — backend allows anonymous read for public chats
      const convRes = await api.get<ConversationData>(`/api/conversations/${id}`);
      if (!convRes.success || !convRes.data) {
        // Private chat + no auth, or chat not found
        if (!user) {
          router.push('/login');
          return;
        }
        setLoading(false);
        return;
      }

      const convData = convRes.data as any;

      // If not logged in and the chat is not public → redirect to login
      if (!user && !convData.is_public) {
        router.push('/login');
        return;
      }

      setConversation(convData);

      // Fetch messages
      const msgRes = await api.get<{ messages: Message[] }>(`/api/conversations/${id}/messages`);
      if (msgRes.success && msgRes.data) {
        setMessages((msgRes.data as any).messages || []);
      }

      // Check if there's a pending takeover request for this user (only if logged in)
      if (user) {
        if (convData.takeover_requested_by && convData.takeover_requested_by !== user.id) {
          const requesterParticipant = (convData.participants || []).find(
            (p: any) => p.user_id === convData.takeover_requested_by
          );
          if (requesterParticipant) {
            setTakeoverPrompt({ characterName: requesterParticipant.character_name });
          }
        } else if (convData.takeover_requested_by === user.id) {
          setTakeoverRequestSent(true);
        }
      }

      setLoading(false);
    };

    loadData();
  }, [id, user, authLoading, router]);

  // Connect Socket.IO
  useEffect(() => {
    if (!user || !id || !conversation) return;

    const socket = connectSocket();

    socket.on('connect', () => {
      setSocketConnected(true);
      socket.emit('join_conversation', id);
    });

    // If already connected
    if (socket.connected) {
      setSocketConnected(true);
      socket.emit('join_conversation', id);
    }

    // Listen for new messages (from other users or AI auto-responses)
    socket.on('new_message', (message: Message) => {
      // Skip our own user messages (we handle those via optimistic update)
      if (message.sender_type === 'user' && message.sender_user_id === user.id) return;
      // AI response arrived — clear thinking indicator
      if (message.sender_type === 'ai') {
        setAiThinking(false);
      }
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
    });

    // Typing indicators
    socket.on('user_typing', (data: { characterName: string }) => {
      setTypingUser(data.characterName);
    });

    socket.on('user_stop_typing', () => {
      setTypingUser(null);
    });

    // Listen for chat mode changes (takeover: ai_fallback → live)
    socket.on('chat_mode_changed', (data: { conversationId: string; newMode: string }) => {
      if (data.conversationId === id) {
        setConversation((prev) =>
          prev
            ? {
                ...prev,
                chat_mode: data.newMode as ConversationData['chat_mode'],
                participants: prev.participants.map((p) => ({
                  ...p,
                  // When mode switches to 'live', AI-controlled participants become human-controlled
                  is_ai_controlled: data.newMode === 'live' ? false : p.is_ai_controlled,
                })),
              }
            : null
        );
      }
    });

    // Listen for conversation ended by the other user
    socket.on('conversation_ended', (data: { conversationId: string }) => {
      if (data.conversationId === id) {
        setConversation((prev) => prev ? { ...prev, is_active: false } : null);
      }
    });

    // Listen for takeover request (User A sees this prompt)
    socket.on('takeover_requested', (data: { conversationId: string; characterName: string }) => {
      if (data.conversationId === id) {
        setTakeoverPrompt({ characterName: data.characterName });
      }
    });

    // Listen for takeover accepted (both users see the transition)
    socket.on('takeover_accepted', (data: { conversationId: string }) => {
      if (data.conversationId === id) {
        setTakeoverPrompt(null);
        setTakeoverRequestSent(false);
      }
    });

    // Listen for takeover declined (character owner sees this)
    socket.on('takeover_declined', (data: { conversationId: string }) => {
      if (data.conversationId === id) {
        setTakeoverRequestSent(false);
        setTakeoverPrompt(null);
      }
    });

    return () => {
      socket.emit('leave_conversation', id);
      socket.off('new_message');
      socket.off('user_typing');
      socket.off('user_stop_typing');
      socket.off('chat_mode_changed');
      socket.off('conversation_ended');
      socket.off('takeover_requested');
      socket.off('takeover_accepted');
      socket.off('takeover_declined');
    };
  }, [user, id, conversation]);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Send message
  const handleSend = async () => {
    if (!newMessage.trim() || !myParticipant || sending) return;

    const content = newMessage.trim();
    setNewMessage('');
    setSending(true);

    // Optimistic update — add message immediately
    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: id as string,
      sender_character_id: myParticipant.character_id,
      sender_user_id: user!.id,
      sender_type: 'user',
      content,
      sender_name: myParticipant.character_name,
      sender_avatar: myParticipant.character_avatar,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    // Stop typing indicator
    const socket = getSocket();
    if (socket) {
      socket.emit('stop_typing', { conversationId: id });
    }

    const res = await api.post<Message>(`/api/conversations/${id}/messages`, {
      character_id: myParticipant.character_id,
      content,
    });

    setSending(false);

    if (res.success && res.data) {
      // Replace optimistic message with real one
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticMsg.id ? (res.data as Message) : m))
      );
      // Show AI thinking indicator for AI chats
      if (isAIChat) {
        setAiThinking(true);
      }
    } else {
      // Check if rate limited (daily chat limit hit)
      const errData = res as any;
      if (errData.chatLimit) {
        setChatLimitHit(true);
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
        setNewMessage(content);
      }
    }

    inputRef.current?.focus();
  };

  // Take over from AI (User B clicks this to go live)
  const handleTakeOver = async () => {
    if (takingOver) return;
    setTakingOver(true);

    const res = await api.post(`/api/conversations/${id}/takeover`, {});
    if (res.success) {
      // Optimistic update — the socket event will also fire
      setConversation((prev) =>
        prev
          ? {
              ...prev,
              chat_mode: 'live',
              participants: prev.participants.map((p) =>
                p.user_id === user?.id ? { ...p, is_ai_controlled: false } : p
              ),
            }
          : null
      );
    } else {
      alert((res as any).message || 'Failed to take over');
    }

    setTakingOver(false);
  };

  // End the conversation
  const handleEndChat = async () => {
    if (ending) return;
    setEnding(true);

    const res = await api.post(`/api/conversations/${id}/end`, {});
    if (res.success) {
      setConversation((prev) => prev ? { ...prev, is_active: false } : null);
      setShowEndConfirm(false);
    } else {
      alert((res as any).message || 'Failed to end conversation');
    }

    setEnding(false);
  };

  // Request to add conversation to both characters' canon (works mid-chat or after end)
  const handleCanonRequest = async () => {
    if (!myParticipant || requestingCanon) return;
    setRequestingCanon(true);

    const res = await api.post(`/api/conversations/${id}/canon-request`, {
      character_id: myParticipant.character_id,
    });

    if (res.success) {
      if ((res.data as any)?.solo) {
        // Solo/AI chat — applied directly
        alert('Canon updated for your character');
        // Refresh conversation to get updated last_canon_at
        const refreshed = await api.get<ConversationData>(`/api/conversations/${id}`);
        if (refreshed.success && refreshed.data) setConversation(refreshed.data as any);
      } else {
        setCanonRequestSent(true);
      }
    } else {
      alert((res as any).message || 'Failed to send canon request');
    }

    setRequestingCanon(false);
  };

  // Request to make this chat public (both users must agree)
  const handlePublicRequest = async () => {
    if (requestingPublic) return;
    if (!confirm('Make this chat visible to the community? The other player will need to agree.')) return;
    setRequestingPublic(true);

    const res = await api.post(`/api/conversations/${id}/public-request`, {});

    if (res.success) {
      if ((res.data as any)?.solo) {
        alert('Conversation is now public');
        const refreshed = await api.get<ConversationData>(`/api/conversations/${id}`);
        if (refreshed.success && refreshed.data) setConversation(refreshed.data as any);
      } else {
        setPublicRequestSent(true);
      }
    } else {
      alert((res as any).message || 'Failed to send public request');
    }

    setRequestingPublic(false);
  };

  // Toggle back to private
  const handleUnpublish = async () => {
    if (!confirm('Make this chat private again? It will no longer appear in the public feed.')) return;
    const res = await api.post(`/api/conversations/${id}/unpublish`, {});
    if (res.success) {
      const refreshed = await api.get<ConversationData>(`/api/conversations/${id}`);
      if (refreshed.success && refreshed.data) setConversation(refreshed.data as any);
    } else {
      alert((res as any).message || 'Failed to unpublish');
    }
  };

  // Request to take over from AI (character owner clicks this)
  const handleRequestTakeover = async () => {
    if (takeoverRequesting) return;
    setTakeoverRequesting(true);

    const res = await api.post(`/api/conversations/${id}/request-takeover`, {});
    if (res.success) {
      setTakeoverRequestSent(true);
    } else {
      alert((res as any).message || 'Failed to send takeover request');
    }

    setTakeoverRequesting(false);
  };

  // Respond to takeover request (User A accepts or declines)
  const handleRespondTakeover = async (accept: boolean) => {
    if (respondingToTakeover) return;
    setRespondingToTakeover(true);

    const res = await api.post(`/api/conversations/${id}/respond-takeover`, { accept });
    if (res.success) {
      setTakeoverPrompt(null);
      if (accept) {
        // The socket 'chat_mode_changed' event will handle the UI update
      }
    } else {
      alert((res as any).message || 'Failed to respond');
    }

    setRespondingToTakeover(false);
  };

  // Handle typing indicator
  const handleTyping = () => {
    const socket = getSocket();
    if (!socket || !myParticipant) return;

    socket.emit('typing', {
      conversationId: id,
      characterName: myParticipant.character_name,
    });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop_typing', { conversationId: id });
    }, 2000);
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const contextLabels: Record<string, { label: string; color: string }> = {
    vacuum: { label: 'Vacuum', color: 'text-slate-400 bg-slate-700' },
    within_world: { label: 'Within World', color: 'text-amber-400 bg-amber-900/30' },
    multiverse: { label: 'Multiverse', color: 'text-purple-400 bg-purple-900/30' },
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-slate-400">Loading chat...</div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">💬</div>
          <h2 className="text-xl font-bold text-white mb-2">Chat Not Found</h2>
          <Link href="/chats" className="text-red-400 hover:text-red-300">
            &larr; Back to Chats
          </Link>
        </div>
      </div>
    );
  }

  const ctx = contextLabels[conversation.context] || contextLabels.vacuum;
  const chatMode = conversation.chat_mode || 'live';

  // Side panels show participant 0 on the left, participant 1 on the right.
  // For the viewer's own chats, this naturally puts "you" on whichever side
  // the database returned first — we don't reorder, since the conversation
  // page already labels "Chatting as {myCharacter}" in the header. Public
  // chats have no viewer-side preference, which is the point.
  const leftParticipant = conversation.participants[0];
  const rightParticipant = conversation.participants[1];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Main row: left panel | center chat | right panel */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left character panel — desktop only */}
        {leftParticipant && (
          <aside className="hidden lg:block w-72 xl:w-80 shrink-0 border-r border-slate-700/50 bg-slate-900/40 overflow-y-auto">
            <CharacterPanel characterId={leftParticipant.character_id} side="left" />
          </aside>
        )}

        {/* Center column: existing chat content */}
        <div className="flex flex-col flex-1 min-w-0">
      {/* Chat Header */}
      <div className="px-4 py-3 bg-slate-800 border-b border-slate-700 shrink-0">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link href="/chats" className="text-slate-400 hover:text-white transition-colors">
            &larr;
          </Link>

          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center text-lg shrink-0">
            🎭
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-white truncate">
                {partnerParticipant ? (
                  <Link
                    href={`/characters/${partnerParticipant.character_id}`}
                    className="hover:text-red-400 transition-colors"
                  >
                    {partnerParticipant.character_name}
                  </Link>
                ) : 'Unknown'}
              </h2>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${ctx.color}`}>
                {ctx.label}
              </span>
              {/* Chat mode badge */}
              {chatMode === 'ai' ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-900/30 text-purple-400 border border-purple-800/50">
                  🤖 AI
                </span>
              ) : chatMode === 'ai_fallback' ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-900/30 text-amber-400 border border-amber-800/50">
                  🤖 AI Fallback
                </span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-900/30 text-green-400 border border-green-800/50">
                  Live
                </span>
              )}
              {conversation.is_canon && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-900/30 text-amber-400 border border-amber-800/50">
                  📜 Canon
                </span>
              )}
              {conversation.last_canon_at && !conversation.is_canon && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-900/20 text-amber-500/80 border border-amber-800/30" title={`Last canon snapshot: ${new Date(conversation.last_canon_at).toLocaleString()}`}>
                  ✨ Canon up to snapshot
                </span>
              )}
              {conversation.is_public && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-900/30 text-blue-400 border border-blue-800/50">
                  🌐 Public
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Chatting as <span className="text-slate-400">{myParticipant?.character_name}</span>
              {chatMode === 'live' && partnerParticipant?.owner_name && (
                <span> &middot; <Link href={`/users/${partnerParticipant.user_id}`} className="text-slate-400 hover:text-red-400 transition-colors">{partnerParticipant.owner_name}</Link></span>
              )}
              {conversation.location && (
                <span> &middot; <span className="text-amber-400">📍 {conversation.location.name}</span></span>
              )}
              {' '}
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${socketConnected ? 'bg-green-400' : 'bg-slate-600'}`} />
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Canon Snapshot — available any time there are new messages since last snapshot */}
            {myParticipant && messages.length >= 2 && !canonRequestSent && (
              <button
                onClick={handleCanonRequest}
                disabled={requestingCanon}
                className="text-xs px-3 py-1.5 text-amber-400 hover:text-amber-300 hover:bg-amber-900/20 border border-amber-800/40 hover:border-amber-700/60 rounded-lg transition-colors disabled:opacity-50"
                title="Mark everything up to this point as canon — both players must agree"
              >
                {requestingCanon ? '✨ Requesting...' : conversation.last_canon_at ? '✨ New Canon Snapshot' : '✨ Canon Snapshot'}
              </button>
            )}
            {canonRequestSent && (
              <span className="text-[11px] px-2 py-1 rounded-lg bg-amber-900/20 text-amber-400 border border-amber-800/40">
                ⏳ Canon request sent
              </span>
            )}

            {/* Make Public / Unpublish */}
            {myParticipant && (
              conversation.is_public ? (
                <button
                  onClick={handleUnpublish}
                  className="text-xs px-3 py-1.5 text-slate-400 hover:text-blue-300 hover:bg-blue-900/20 border border-slate-700 hover:border-blue-800/50 rounded-lg transition-colors"
                  title="Make this chat private"
                >
                  🔒 Unpublish
                </button>
              ) : !publicRequestSent && !conversation.public_requested_by ? (
                <button
                  onClick={handlePublicRequest}
                  disabled={requestingPublic}
                  className="text-xs px-3 py-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 border border-blue-800/40 hover:border-blue-700/60 rounded-lg transition-colors disabled:opacity-50"
                  title="Let the community view this chat (other player must agree)"
                >
                  {requestingPublic ? '🌐 Requesting...' : '🌐 Make Public'}
                </button>
              ) : (
                <span className="text-[11px] px-2 py-1 rounded-lg bg-blue-900/20 text-blue-400 border border-blue-800/40">
                  ⏳ Public request pending
                </span>
              )
            )}

            {/* End Chat button — only when active */}
            {conversation.is_active && (
              <button
                onClick={() => setShowEndConfirm(true)}
                className="text-xs px-3 py-1.5 text-slate-400 hover:text-red-400 hover:bg-red-900/20 border border-slate-700 hover:border-red-800/50 rounded-lg transition-colors"
              >
                End Chat
              </button>
            )}
          </div>
        </div>
      </div>

      {/* AI Fallback Banner — shows for both users with different content */}
      {chatMode === 'ai_fallback' && (
        <div className="px-4 py-3 bg-amber-900/20 border-b border-amber-800/50 shrink-0">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            {canTakeOver ? (
              <>
                <div>
                  <p className="text-sm text-amber-400 font-medium">AI is responding as your character</p>
                  <p className="text-xs text-slate-400">Take control to chat live as {myParticipant?.character_name}</p>
                </div>
                <button
                  onClick={handleTakeOver}
                  disabled={takingOver}
                  className="px-4 py-1.5 text-sm bg-green-600 hover:bg-green-700 disabled:bg-slate-700 text-white rounded-lg transition-colors shrink-0 ml-4 font-semibold"
                >
                  {takingOver ? 'Taking over...' : '🎮 Take Over'}
                </button>
              </>
            ) : (
              <div>
                <p className="text-sm text-amber-400 font-medium">
                  AI is responding as {partnerParticipant?.character_name}
                </p>
                <p className="text-xs text-slate-400">
                  Waiting for {partnerParticipant?.owner_name} to take over
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Chat — Character Owner Can Request Takeover */}
      {isCharOwnerInAIChat && conversation.is_active && (
        <div className="px-4 py-3 bg-purple-900/20 border-b border-purple-800/50 shrink-0">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            {takeoverRequestSent ? (
              <div>
                <p className="text-sm text-purple-400 font-medium">⏳ Takeover request sent</p>
                <p className="text-xs text-slate-400">Waiting for the other user to accept...</p>
              </div>
            ) : (
              <>
                <div>
                  <p className="text-sm text-purple-400 font-medium">
                    Someone is chatting with your character via AI
                  </p>
                  <p className="text-xs text-slate-400">
                    You can request to take over and chat live as {myParticipant?.character_name}
                  </p>
                </div>
                <button
                  onClick={handleRequestTakeover}
                  disabled={takeoverRequesting}
                  className="px-4 py-1.5 text-sm bg-green-600 hover:bg-green-700 disabled:bg-slate-700 text-white rounded-lg transition-colors shrink-0 ml-4 font-semibold"
                >
                  {takeoverRequesting ? 'Requesting...' : '🎮 Request Takeover'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Takeover Request Prompt — shown to User A when character owner wants to go live */}
      {takeoverPrompt && conversation?.is_active && (
        <div className="px-4 py-3 bg-green-900/20 border-b border-green-800/50 shrink-0 animate-pulse">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-400 font-medium">
                  🎮 {takeoverPrompt.characterName}&apos;s owner wants to take over!
                </p>
                <p className="text-xs text-slate-400">
                  They want to chat with you live instead of through AI. Do you accept?
                </p>
              </div>
              <div className="flex gap-2 shrink-0 ml-4">
                <button
                  onClick={() => handleRespondTakeover(false)}
                  disabled={respondingToTakeover}
                  className="px-3 py-1.5 text-sm text-slate-400 hover:text-white border border-slate-600 rounded-lg transition-colors"
                >
                  Decline
                </button>
                <button
                  onClick={() => handleRespondTakeover(true)}
                  disabled={respondingToTakeover}
                  className="px-4 py-1.5 text-sm bg-green-600 hover:bg-green-700 disabled:bg-slate-700 text-white rounded-lg transition-colors font-semibold"
                >
                  {respondingToTakeover ? '...' : '✅ Accept'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Conversation start marker */}
          <div className="text-center py-4">
            <p className="text-xs text-slate-500">
              Conversation started between{' '}
              <span className="text-slate-400">{leftParticipant?.character_name}</span>
              {' and '}
              <span className="text-slate-400">{rightParticipant?.character_name}</span>
            </p>
          </div>

          {/* Messages */}
          {messages.map((msg) => {
            // Right-side rendering rule:
            //   - If viewer IS a participant: their own messages go on the right
            //     ("you on the right" — the long-standing chat convention).
            //   - If viewer is NOT a participant (public chat reader): use the
            //     panel layout as the source of truth — rightParticipant's
            //     messages render on the right. Otherwise a public chat would
            //     stack everything on the left and look broken.
            const isOnRight = myParticipant
              ? msg.sender_user_id === user?.id
              : msg.sender_character_id === rightParticipant?.character_id;
            const isMe = isOnRight;

            // System messages (e.g., takeover notifications)
            if (msg.sender_type === 'system') {
              return (
                <div key={msg.id} className="text-center py-2">
                  <p className="text-xs text-slate-400 bg-slate-800/50 inline-block px-4 py-1.5 rounded-full border border-slate-700">
                    {msg.content}
                  </p>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm shrink-0 ${
                  isMe
                    ? 'bg-gradient-to-br from-red-500 to-amber-500'
                    : 'bg-gradient-to-br from-red-500 to-purple-600'
                }`}>
                  🎭
                </div>

                {/* Message bubble */}
                <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Link
                      href={`/characters/${msg.sender_character_id}`}
                      className="text-xs font-medium text-slate-400 hover:text-red-400 transition-colors"
                    >
                      {msg.sender_name}
                    </Link>
                    {msg.sender_type === 'ai' && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-purple-900/30 text-purple-400 rounded-full">
                        AI
                      </span>
                    )}
                    <span className="text-[10px] text-slate-600">
                      {formatTime(msg.created_at)}
                    </span>
                  </div>
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      isMe
                        ? 'bg-red-600/20 border border-red-800/50 text-slate-200 rounded-tr-md'
                        : 'bg-slate-700/50 border border-slate-600/50 text-slate-200 rounded-tl-md'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {typingUser && (
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center text-sm shrink-0">
                🎭
              </div>
              <div>
                <span className="text-xs text-slate-400">{typingUser}</span>
                <div className="px-4 py-2.5 bg-slate-700/50 border border-slate-600/50 rounded-2xl rounded-tl-md mt-1">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* AI Thinking Indicator */}
      {aiThinking && conversation.is_active && (
        <div className="px-4 py-2 bg-purple-900/10 border-t border-purple-800/30 shrink-0">
          <div className="max-w-3xl mx-auto flex items-center gap-2 justify-center text-sm text-purple-400">
            <span className="inline-block w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
            {partnerParticipant?.character_name} is thinking...
          </div>
        </div>
      )}

      {/* Chat Limit Banner */}
      {chatLimitHit && (
        <div className="px-4 py-3 bg-amber-900/20 border-t border-amber-800/50 shrink-0">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div>
              <p className="text-sm text-amber-400 font-medium">Daily chat limit reached</p>
              <p className="text-xs text-slate-400">Free accounts can send 10 messages per day. Upgrade for unlimited chats!</p>
            </div>
            <Link
              href="/pricing"
              className="px-4 py-1.5 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors shrink-0 ml-4"
            >
              Upgrade
            </Link>
          </div>
        </div>
      )}

      {/* Message Input or Ended Banner */}
      {!user ? (
        /* Anonymous viewer — read-only CTA */
        <div className="px-4 py-4 bg-gradient-to-r from-red-900/30 to-amber-900/30 border-t border-red-800/50 shrink-0">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">Want to start your own roleplay?</p>
              <p className="text-xs text-slate-300">Sign up free to create characters and chat with anyone on RedRoom.</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Link
                href="/login"
                className="px-4 py-2 text-sm text-slate-300 hover:text-white border border-slate-600 rounded-lg transition-colors"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
              >
                Sign up free
              </Link>
            </div>
          </div>
        </div>
      ) : conversation.is_active ? (
        isCharOwnerInAIChat ? (
          /* Character owner can't send messages until takeover is accepted */
          <div className="px-4 py-3 bg-slate-800 border-t border-slate-700 shrink-0">
            <div className="max-w-3xl mx-auto text-center">
              <p className="text-sm text-slate-500">
                🤖 AI is chatting as {myParticipant?.character_name}. Request a takeover above to chat live.
              </p>
            </div>
          </div>
        ) : (
          <div className="px-4 py-3 bg-slate-800 border-t border-slate-700 shrink-0">
            <div className="max-w-3xl mx-auto flex gap-3 items-end">
              <div className="flex-1">
                <textarea
                  ref={inputRef}
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    handleTyping();
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={`Write as ${myParticipant?.character_name || 'your character'}...`}
                  rows={1}
                  className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 resize-none max-h-32"
                  style={{ minHeight: '44px' }}
                />
              </div>
              <button
                onClick={handleSend}
                disabled={!newMessage.trim() || sending}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors shrink-0"
              >
                Send
              </button>
            </div>
          </div>
        )
      ) : (
        <div className="px-4 py-4 bg-slate-800 border-t border-slate-700 shrink-0">
          <div className="max-w-3xl mx-auto text-center space-y-2">
            <p className="text-slate-500 text-sm">This conversation has ended.</p>

            {/* Canon status or request button — participants only.
                Public-chat readers who weren't in the conversation see only
                the canon status if it's already canon. They can't request
                changes to a chat they weren't part of. */}
            {conversation.is_canon ? (
              <p className="text-sm text-amber-400 font-medium">📜 This conversation is canon</p>
            ) : myParticipant ? (
              <>
                {messages.length >= 2 && !canonRequestSent && (
                  <button
                    onClick={handleCanonRequest}
                    disabled={requestingCanon}
                    className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-700 disabled:bg-slate-700 text-white rounded-lg transition-colors font-medium"
                  >
                    {requestingCanon
                      ? '📜 Sending request...'
                      : `📜 Request ${partnerParticipant?.owner_name || 'other player'} to add to canon`}
                  </button>
                )}
                {canonRequestSent && (
                  <p className="text-sm text-green-400">
                    ✅ Canon request sent! Waiting for {partnerParticipant?.owner_name || 'the other player'} to accept.
                  </p>
                )}
              </>
            ) : null}

            <div>
              <Link href="/chats" className="text-xs text-red-400 hover:text-red-300 transition-colors inline-block">
                &larr; Back to Chats
              </Link>
            </div>
          </div>
        </div>
      )}
        {/* End of center column */}
        </div>

        {/* Right character panel — desktop only */}
        {rightParticipant && (
          <aside className="hidden lg:block w-72 xl:w-80 shrink-0 border-l border-slate-700/50 bg-slate-900/40 overflow-y-auto">
            <CharacterPanel characterId={rightParticipant.character_id} side="right" />
          </aside>
        )}
      </div>
      {/* End of main row */}

      {/* User identity strip — both participants' user info, hidden on mobile */}
      <div className="hidden md:block">
        <UserStrip
          leftUserId={leftParticipant?.user_id}
          rightUserId={rightParticipant?.user_id}
        />
      </div>

      {/* End Chat Confirmation Modal */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-sm mx-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">End Conversation?</h3>
            <p className="text-sm text-slate-400 mb-5">
              This will end the conversation. You can still view the chat history, but no new messages can be sent.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowEndConfirm(false)}
                className="flex-1 py-2 text-sm text-slate-400 hover:text-white border border-slate-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEndChat}
                disabled={ending}
                className="flex-1 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:bg-slate-700 text-white font-semibold rounded-lg transition-colors"
              >
                {ending ? 'Ending...' : 'End Chat'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
