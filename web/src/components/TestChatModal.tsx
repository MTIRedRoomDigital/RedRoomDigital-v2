'use client';

import { useState, useRef, useEffect } from 'react';
import { api } from '@/lib/api';

interface Message {
  id: string;
  content: string;
  sender_type: 'user' | 'ai';
  sender_name: string;
  sender_avatar: string | null;
  created_at: string;
}

interface TestChatModalProps {
  characterId: string;
  characterName: string;
  characterAvatar: string | null;
  onClose: () => void;
}

/**
 * Test Chat Modal
 *
 * Lets character owners test how the AI responds as their character.
 * Opens a lightweight chat interface in a slide-up modal.
 * The user types as a "Stranger" and the AI responds in character.
 */
export function TestChatModal({ characterId, characterName, characterAvatar, onClose }: TestChatModalProps) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [initializing, setInitializing] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Create test conversation on mount
  useEffect(() => {
    api.post<{ id: string }>('/api/conversations', {
      character_id: characterId,
      is_test: true,
    }).then((res) => {
      if (res.success && res.data) {
        setConversationId((res.data as any).id);
      } else {
        setError(res.message || 'Failed to start test chat');
      }
      setInitializing(false);
    });
  }, [characterId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when ready
  useEffect(() => {
    if (!initializing && conversationId) {
      inputRef.current?.focus();
    }
  }, [initializing, conversationId]);

  const sendMessage = async () => {
    if (!input.trim() || !conversationId || sending || generating) return;

    const content = input.trim();
    setInput('');
    setSending(true);
    setError('');

    // Optimistic update — show user message immediately
    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      content,
      sender_type: 'user',
      sender_name: 'You',
      sender_avatar: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    // Send message
    const sendRes = await api.post<Message>(`/api/conversations/${conversationId}/test-message`, { content });

    if (!sendRes.success) {
      setError(sendRes.message || 'Failed to send message');
      setSending(false);
      return;
    }

    // Replace temp message with real one
    if (sendRes.data) {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempUserMsg.id ? { ...sendRes.data as Message } : m))
      );
    }

    setSending(false);

    // Auto-generate AI response
    setGenerating(true);
    const aiRes = await api.post<Message>(`/api/conversations/${conversationId}/ai-response`, {});

    if (aiRes.success && aiRes.data) {
      setMessages((prev) => [...prev, aiRes.data as Message]);
    } else {
      setError(aiRes.message || 'Failed to generate AI response');
    }
    setGenerating(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleClose = async () => {
    // Clean up test conversation
    if (conversationId) {
      api.delete(`/api/conversations/${conversationId}`);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-900 border-b border-slate-700">
        <button
          onClick={handleClose}
          className="text-slate-400 hover:text-white transition-colors text-sm"
        >
          ✕
        </button>

        {characterAvatar ? (
          <img src={characterAvatar} alt={characterName} className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center text-sm">
            🎭
          </div>
        )}

        <div className="flex-1">
          <h3 className="text-white font-semibold text-sm">{characterName}</h3>
          <p className="text-xs text-slate-400">Test Chat — talk to your character</p>
        </div>

        <span className="px-2 py-0.5 text-xs bg-amber-900/30 text-amber-400 border border-amber-800/50 rounded-full">
          TEST
        </span>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {initializing && (
          <div className="flex justify-center py-8">
            <div className="text-slate-400 text-sm">Setting up test chat...</div>
          </div>
        )}

        {!initializing && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-4xl mb-3">🧪</div>
            <h3 className="text-white font-semibold mb-1">Test Your Character</h3>
            <p className="text-slate-400 text-sm max-w-sm">
              Type a message below to see how {characterName} responds.
              You&apos;re chatting as a stranger — see if the personality feels right.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.sender_type === 'user' ? 'flex-row-reverse' : ''}`}
          >
            {/* Avatar */}
            {msg.sender_type === 'ai' ? (
              characterAvatar ? (
                <img src={characterAvatar} alt={characterName} className="w-8 h-8 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center text-sm shrink-0">
                  🎭
                </div>
              )
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-sm shrink-0">
                👤
              </div>
            )}

            {/* Bubble */}
            <div
              className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.sender_type === 'user'
                  ? 'bg-red-600 text-white rounded-tr-sm'
                  : 'bg-slate-700 text-slate-200 rounded-tl-sm'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {/* Generating indicator */}
        {generating && (
          <div className="flex gap-3">
            {characterAvatar ? (
              <img src={characterAvatar} alt={characterName} className="w-8 h-8 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center text-sm shrink-0">
                🎭
              </div>
            )}
            <div className="bg-slate-700 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/30">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Input Area */}
      <div className="px-4 py-3 bg-slate-900 border-t border-slate-700">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Say something to ${characterName}...`}
            disabled={initializing || !conversationId}
            className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-full text-white text-sm placeholder-slate-500 focus:outline-none focus:border-red-500 disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending || generating || !conversationId}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-full text-sm font-medium transition-colors"
          >
            {sending ? '...' : 'Send'}
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-2 text-center">
          Test conversations are temporary and won&apos;t appear in your chat list.
        </p>
      </div>
    </div>
  );
}
