'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { ImageUpload } from '@/components/ImageUpload';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Character {
  id: string;
  creator_id: string;
  name: string;
  description: string | null;
  personality: { traits?: string[]; values?: string[]; flaws?: string[] };
  background: string | null;
  likes: string[];
  dislikes: string[];
  tags: string[];
  is_public: boolean;
  is_ai_enabled: boolean;
}

export default function EditCharacterPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();

  // Loading state
  const [pageLoading, setPageLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Basic info
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Personality
  const [traits, setTraits] = useState('');
  const [values, setValues] = useState('');
  const [flaws, setFlaws] = useState('');

  // Background
  const [background, setBackground] = useState('');

  // Likes & Dislikes
  const [likes, setLikes] = useState('');
  const [dislikes, setDislikes] = useState('');

  // Settings
  const [tags, setTags] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isAiEnabled, setIsAiEnabled] = useState(true);

  // Form state
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'basics' | 'personality' | 'background' | 'settings'>('basics');

  // Load existing character data
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    api.get<Character>(`/api/characters/${params.id}`).then((res) => {
      if (res.success && res.data) {
        const c = res.data as any;

        // Check ownership
        if (c.creator_id !== user.id) {
          setLoadError('You can only edit your own characters.');
          setPageLoading(false);
          return;
        }

        // Populate form fields
        setName(c.name || '');
        setDescription(c.description || '');
        setAvatarUrl(c.avatar_url || null);
        setBackground(c.background || '');

        const p = c.personality || {};
        setTraits((p.traits || []).join(', '));
        setValues((p.values || []).join(', '));
        setFlaws((p.flaws || []).join(', '));

        setLikes((c.likes || []).join(', '));
        setDislikes((c.dislikes || []).join(', '));
        setTags((c.tags || []).join(', '));
        setIsPublic(c.is_public ?? true);
        setIsAiEnabled(c.is_ai_enabled ?? true);
      } else {
        setLoadError(res.message || 'Character not found');
      }
      setPageLoading(false);
    });
  }, [params.id, user, authLoading, router]);

  if (authLoading || pageLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-slate-400">Loading character...</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">😔</div>
          <h2 className="text-xl font-bold text-white mb-2">Cannot Edit</h2>
          <p className="text-slate-400 mb-4">{loadError}</p>
          <Link href="/profile" className="text-red-400 hover:text-red-300">
            ← Back to Profile
          </Link>
        </div>
      </div>
    );
  }

  const parseList = (str: string) =>
    str.split(',').map((s) => s.trim()).filter(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Character name is required');
      return;
    }

    setSaving(true);

    const characterData = {
      name: name.trim(),
      description: description.trim() || null,
      avatar_url: avatarUrl,
      personality: {
        traits: parseList(traits),
        values: parseList(values),
        flaws: parseList(flaws),
      },
      background: background.trim() || null,
      likes: parseList(likes),
      dislikes: parseList(dislikes),
      tags: parseList(tags),
      is_public: isPublic,
      is_ai_enabled: isAiEnabled,
    };

    const res = await api.put(`/api/characters/${params.id}`, characterData);
    setSaving(false);

    if (res.success) {
      router.push(`/characters/${params.id}`);
    } else {
      setError(res.message || 'Failed to update character');
    }
  };

  const tabs = [
    { id: 'basics' as const, label: '📝 Basics', description: 'Name & description' },
    { id: 'personality' as const, label: '🧠 Personality', description: 'Traits, values & flaws' },
    { id: 'background' as const, label: '📜 Background', description: 'History & preferences' },
    { id: 'settings' as const, label: '⚙️ Settings', description: 'Visibility & AI' },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link href={`/characters/${params.id}`} className="text-sm text-slate-400 hover:text-slate-300 mb-2 inline-block">
          ← Back to Character
        </Link>
        <h1 className="text-3xl font-bold text-white">Edit Character</h1>
        <p className="text-slate-400 mt-1">
          Update your character&apos;s details. Changes affect future AI conversations.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 bg-slate-800 rounded-lg p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            <span className="block">{tab.label}</span>
            <span className="block text-xs opacity-60 hidden md:block">{tab.description}</span>
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        {/* TAB: Basics */}
        {activeTab === 'basics' && (
          <div className="space-y-5">
            {/* Character Avatar */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Character Avatar
              </label>
              <ImageUpload
                currentImageUrl={avatarUrl}
                onUploadComplete={(url) => setAvatarUrl(url)}
                uploadType="avatar"
                shape="square"
                size="lg"
                fallback={
                  <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center text-5xl">
                    🎭
                  </div>
                }
              />
              <p className="text-xs text-slate-500 mt-1">Click to upload a character portrait (max 5MB)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Character Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Kael Stormborn, Lady Midnight, Detective Nova"
                required
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A short description others will see when browsing characters."
                rows={3}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 resize-none"
              />
              <p className="text-xs text-slate-500 mt-1">This is the public-facing summary.</p>
            </div>
          </div>
        )}

        {/* TAB: Personality */}
        {activeTab === 'personality' && (
          <div className="space-y-5">
            <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg mb-4">
              <p className="text-sm text-slate-300">
                💡 <strong>This is the AI&apos;s brain.</strong> The more detail you provide, the more
                accurately the AI will roleplay as your character. Separate multiple items with commas.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Personality Traits
              </label>
              <input
                type="text"
                value={traits}
                onChange={(e) => setTraits(e.target.value)}
                placeholder="e.g. brave, sarcastic, curious, protective, witty"
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              />
              <p className="text-xs text-slate-500 mt-1">How does this character typically behave?</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Core Values
              </label>
              <input
                type="text"
                value={values}
                onChange={(e) => setValues(e.target.value)}
                placeholder="e.g. loyalty, justice, freedom, knowledge, family"
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              />
              <p className="text-xs text-slate-500 mt-1">What does this character stand for?</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Flaws
              </label>
              <input
                type="text"
                value={flaws}
                onChange={(e) => setFlaws(e.target.value)}
                placeholder="e.g. impulsive, distrustful, arrogant, fears abandonment"
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              />
              <p className="text-xs text-slate-500 mt-1">Flaws make characters interesting and real.</p>
            </div>
          </div>
        )}

        {/* TAB: Background */}
        {activeTab === 'background' && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Backstory
              </label>
              <textarea
                value={background}
                onChange={(e) => setBackground(e.target.value)}
                placeholder="Tell the character's story. Where did they come from? What shaped them?"
                rows={6}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Likes
              </label>
              <input
                type="text"
                value={likes}
                onChange={(e) => setLikes(e.target.value)}
                placeholder="e.g. thunderstorms, old books, sparring, strong ale"
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Dislikes
              </label>
              <input
                type="text"
                value={dislikes}
                onChange={(e) => setDislikes(e.target.value)}
                placeholder="e.g. betrayal, small talk, cold weather, crowded cities"
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              />
            </div>
          </div>
        )}

        {/* TAB: Settings */}
        {activeTab === 'settings' && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Tags
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g. fantasy, warrior, medieval, magic, anti-hero"
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              />
              <p className="text-xs text-slate-500 mt-1">Help others discover your character.</p>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-800 border border-slate-700 rounded-lg">
              <div>
                <div className="text-sm font-medium text-white">Public Character</div>
                <div className="text-xs text-slate-400">Others can discover and chat with your character</div>
              </div>
              <button
                type="button"
                onClick={() => setIsPublic(!isPublic)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  isPublic ? 'bg-red-600' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    isPublic ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-800 border border-slate-700 rounded-lg">
              <div>
                <div className="text-sm font-medium text-white">AI Takeover</div>
                <div className="text-xs text-slate-400">Allow AI to roleplay as this character when you&apos;re offline</div>
              </div>
              <button
                type="button"
                onClick={() => setIsAiEnabled(!isAiEnabled)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  isAiEnabled ? 'bg-red-600' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    isAiEnabled ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>
          </div>
        )}

        {/* Navigation & Submit */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-700">
          <div className="flex gap-2">
            {activeTab !== 'basics' && (
              <button
                type="button"
                onClick={() => {
                  const idx = tabs.findIndex((t) => t.id === activeTab);
                  setActiveTab(tabs[idx - 1].id);
                }}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-slate-600 rounded-lg transition-colors"
              >
                ← Previous
              </button>
            )}
          </div>

          <div className="flex gap-2">
            {activeTab !== 'settings' ? (
              <button
                type="button"
                onClick={() => {
                  const idx = tabs.findIndex((t) => t.id === activeTab);
                  setActiveTab(tabs[idx + 1].id);
                }}
                className="px-6 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Next →
              </button>
            ) : (
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="px-8 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
              >
                {saving ? 'Saving...' : '💾 Save Changes'}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
