'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { connectSocket, disconnectSocket, getSocket } from '@/lib/socket';
import Link from 'next/link';

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
  const [generatingAI, setGeneratingAI] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [chatLimitHit, setChatLimitHit] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Find which character belongs to the current user in this conversation
  const myParticipant = conversation?.participants.find((p) => p.user_id === user?.id);
  const partnerParticipant = conversation?.participants.find((p) => p.user_id !== user?.id);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Load conversation data + messages
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (!user || !id) return;

    const loadData = async () => {
      // Fetch conversation details
      const convRes = await api.get<ConversationData>(`/api/conversations/${id}`);
      if (convRes.success && convRes.data) {
        setConversation(convRes.data as any);
      } else {
        setLoading(false);
        return;
      }

      // Fetch messages
      const msgRes = await api.get<{ messages: Message[] }>(`/api/conversations/${id}/messages`);
      if (msgRes.success && msgRes.data) {
        setMessages((msgRes.data as any).messages || []);
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

    // Listen for new messages (only from OTHER users — we handle our own via optimistic update)
    socket.on('new_message', (message: Message) => {
      if (message.sender_user_id === user.id) return; // Skip our own messages
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

    return () => {
      socket.emit('leave_conversation', id);
      socket.off('new_message');
      socket.off('user_typing');
      socket.off('user_stop_typing');
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
    } else {
      // Check if rate limited (daily chat limit hit)
      const errData = res as any;
      if (errData.chatLimit) {
        setChatLimitHit(true);
        // Remove the optimistic message since it wasn't actually sent
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
        setNewMessage(content); // Put the message back in the input
      }
    }

    inputRef.current?.focus();
  };

  // Generate AI response for the partner character
  const handleAIResponse = async () => {
    if (generatingAI) return;
    setGeneratingAI(true);

    const res = await api.post<Message>(`/api/conversations/${id}/ai-response`, {});

    if (res.success && res.data) {
      // The socket will deliver the message, but if we're the sender's owner
      // we need to add it manually since our socket filter blocks own-user messages
      setMessages((prev) => {
        const msg = res.data as Message;
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    } else {
      alert((res as any).message || 'Failed to generate AI response');
    }

    setGeneratingAI(false);
  };

  // Handle typing indicator
  const handleTyping = () => {
    const socket = getSocket();
    if (!socket || !myParticipant) return;

    socket.emit('typing', {
      conversationId: id,
      characterName: myParticipant.character_name,
    });

    // Clear existing timeout
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    // Stop typing after 2 seconds of inactivity
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

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
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
                {partnerParticipant?.character_name || 'Unknown'}
              </h2>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${ctx.color}`}>
                {ctx.label}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Chatting as <span className="text-slate-400">{myParticipant?.character_name}</span>
              {' '}
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${socketConnected ? 'bg-green-400' : 'bg-slate-600'}`} />
            </p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Conversation start marker */}
          <div className="text-center py-4">
            <p className="text-xs text-slate-500">
              Conversation started between{' '}
              <span className="text-slate-400">{myParticipant?.character_name}</span>
              {' and '}
              <span className="text-slate-400">{partnerParticipant?.character_name}</span>
            </p>
          </div>

          {/* Messages */}
          {messages.map((msg) => {
            const isMe = msg.sender_user_id === user?.id;

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
                    <span className="text-xs font-medium text-slate-400">
                      {msg.sender_name}
                    </span>
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

      {/* AI Response Bar (show when messages exist and partner is AI-enabled) */}
      {messages.length > 0 && (
        <div className="px-4 py-2 bg-slate-800/50 border-t border-slate-700/50 shrink-0">
          <div className="max-w-3xl mx-auto flex items-center justify-center">
            <button
              onClick={handleAIResponse}
              disabled={generatingAI}
              className="flex items-center gap-2 px-4 py-1.5 text-sm bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-all"
            >
              {generatingAI ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {partnerParticipant?.character_name} is thinking...
                </>
              ) : (
                <>
                  <span>🤖</span>
                  Generate {partnerParticipant?.character_name}&apos;s Response
                </>
              )}
            </button>
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

      {/* Message Input */}
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
    </div>
  );
}
