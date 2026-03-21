'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ImageUpload } from '@/components/ImageUpload';

export default function CreateWorldPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [setting, setSetting] = useState('');
  const [lore, setLore] = useState('');
  const [magicSystem, setMagicSystem] = useState('');
  const [techLevel, setTechLevel] = useState('');
  const [customRules, setCustomRules] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [joinMode, setJoinMode] = useState<'open' | 'locked'>('open');
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  const tabs = ['Basics', 'Lore & Setting', 'Rules', 'Settings'];

  const canCreate = user && (user.subscription === 'premium' || user.subscription === 'ultimate');

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('World name is required');
      setTab(0);
      return;
    }

    setError('');
    setSubmitting(true);

    // Build rules JSONB
    const rules: Record<string, unknown> = {};
    if (magicSystem.trim()) rules.magic_system = magicSystem.trim();
    if (techLevel.trim()) rules.technology_level = techLevel.trim();
    if (customRules.trim()) {
      rules.custom_rules = customRules.split('\n').filter((r) => r.trim());
    }

    const res = await api.post<{ id: string }>('/api/worlds', {
      name: name.trim(),
      description: description.trim() || null,
      setting: setting.trim() || null,
      lore: lore.trim() || null,
      rules: Object.keys(rules).length > 0 ? rules : null,
      is_public: isPublic,
      join_mode: joinMode,
      banner_url: bannerUrl,
      thumbnail_url: thumbnailUrl,
    });

    setSubmitting(false);

    if (res.success && res.data) {
      router.push(`/worlds/${(res.data as any).id}`);
    } else {
      setError(res.message || 'Failed to create world');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h1 className="text-2xl font-bold text-white mb-2">Sign In Required</h1>
        <p className="text-slate-400 mb-6">You need to be logged in to create worlds.</p>
        <Link href="/login" className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors inline-block">
          Log In
        </Link>
      </div>
    );
  }

  if (!canCreate) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">👑</div>
        <h1 className="text-2xl font-bold text-white mb-2">Premium Required</h1>
        <p className="text-slate-400 mb-4">
          World creation is available to <span className="text-amber-400 font-semibold">Premium</span> and{' '}
          <span className="text-purple-400 font-semibold">Ultimate</span> subscribers.
        </p>
        <p className="text-slate-500 text-sm mb-6">
          As a WorldMaster, you can build immersive settings with custom lore, rules, magic systems, and campaigns for your characters to explore.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/worlds" className="px-5 py-2 border border-slate-600 text-slate-300 rounded-lg hover:text-white transition-colors">
            Browse Worlds
          </Link>
          <button className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors">
            Upgrade to Premium
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link href="/worlds" className="text-sm text-slate-400 hover:text-white transition-colors mb-2 inline-block">
          &larr; Back to Worlds
        </Link>
        <h1 className="text-3xl font-bold text-white">Create a World</h1>
        <p className="text-slate-400 mt-1">Build an immersive setting for characters and campaigns</p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-700 mb-6">
        {tabs.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-[1px] ${
              tab === i
                ? 'text-amber-400 border-amber-400'
                : 'text-slate-400 border-transparent hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {/* Tab 0: Basics */}
        {tab === 0 && (
          <>
            {/* Banner Image */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Banner Image</label>
              <ImageUpload
                shape="banner"
                uploadType="banner"
                currentImageUrl={bannerUrl}
                onUploadComplete={(url) => setBannerUrl(url)}
              />
              <p className="text-xs text-slate-500 mt-1">A wide banner image displayed at the top of your world page</p>
            </div>

            {/* Thumbnail Image */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Thumbnail</label>
              <ImageUpload
                shape="square"
                uploadType="thumbnail"
                currentImageUrl={thumbnailUrl}
                onUploadComplete={(url) => setThumbnailUrl(url)}
              />
              <p className="text-xs text-slate-500 mt-1">A square icon shown in world listings</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                World Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., The Shattered Realms"
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A brief overview of your world..."
                rows={3}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Setting</label>
              <input
                type="text"
                value={setting}
                onChange={(e) => setSetting(e.target.value)}
                placeholder="e.g., Medieval Fantasy, Cyberpunk 2177, Post-Apocalyptic"
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
              <p className="text-xs text-slate-500 mt-1">A short genre/era tag that helps users find your world</p>
            </div>
          </>
        )}

        {/* Tab 1: Lore & Setting */}
        {tab === 1 && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">World Lore</label>
              <textarea
                value={lore}
                onChange={(e) => setLore(e.target.value)}
                placeholder="The detailed lore and history of your world. This information will be used by the AI when generating character interactions within this world..."
                rows={12}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 resize-none"
              />
              <p className="text-xs text-slate-500 mt-1">
                Write as much detail as you want. History, geography, factions, key events — the AI uses all of this to make conversations feel grounded in your world.
              </p>
            </div>

            {/* AI info callout */}
            <div className="p-4 bg-amber-900/20 border border-amber-700/50 rounded-lg">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🧠</span>
                <div>
                  <h4 className="text-amber-400 font-medium text-sm">AI-Powered World Context</h4>
                  <p className="text-slate-400 text-xs mt-1">
                    The lore you write here becomes part of the AI&apos;s context when characters chat &ldquo;Within World.&rdquo;
                    Characters will reference your world&apos;s history, locations, and events naturally in conversation.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Tab 2: Rules */}
        {tab === 2 && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Magic System</label>
              <input
                type="text"
                value={magicSystem}
                onChange={(e) => setMagicSystem(e.target.value)}
                placeholder="e.g., Elemental, Arcane Schools, Rune-based, None"
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Technology Level</label>
              <input
                type="text"
                value={techLevel}
                onChange={(e) => setTechLevel(e.target.value)}
                placeholder="e.g., Medieval, Steampunk, Modern, Futuristic"
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Custom World Rules</label>
              <textarea
                value={customRules}
                onChange={(e) => setCustomRules(e.target.value)}
                placeholder={"One rule per line, e.g.:\nNo modern technology\nMagic requires spoken incantations\nDragons are extinct\nUndead cannot cross running water"}
                rows={6}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 resize-none"
              />
              <p className="text-xs text-slate-500 mt-1">
                These rules help the AI maintain consistency. Characters chatting in your world will follow these constraints.
              </p>
            </div>
          </>
        )}

        {/* Tab 3: Settings */}
        {tab === 3 && (
          <>
            <div className="flex items-center justify-between p-4 bg-slate-800 border border-slate-700 rounded-lg">
              <div>
                <h4 className="text-white font-medium">Public World</h4>
                <p className="text-sm text-slate-400 mt-0.5">
                  Anyone can discover and join this world
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500" />
              </label>
            </div>

            {isPublic && (
              <div className="flex items-center justify-between p-4 bg-slate-800 border border-slate-700 rounded-lg">
                <div>
                  <h4 className="text-white font-medium">🔒 Locked World</h4>
                  <p className="text-sm text-slate-400 mt-0.5">
                    Users must request permission to join. You approve or deny each request.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={joinMode === 'locked'}
                    onChange={(e) => setJoinMode(e.target.checked ? 'locked' : 'open')}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500" />
                </label>
              </div>
            )}

            {/* Summary card */}
            <div className="p-4 bg-slate-800 border border-slate-700 rounded-lg">
              <h4 className="text-white font-medium mb-3">World Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Name</span>
                  <span className="text-white">{name || '(not set)'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Setting</span>
                  <span className="text-white">{setting || '(not set)'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Magic System</span>
                  <span className="text-white">{magicSystem || '(none)'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Tech Level</span>
                  <span className="text-white">{techLevel || '(not set)'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Visibility</span>
                  <span className="text-white">{isPublic ? 'Public' : 'Private'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Lore</span>
                  <span className="text-white">{lore ? `${lore.length} characters` : '(none)'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Custom Rules</span>
                  <span className="text-white">
                    {customRules ? `${customRules.split('\n').filter((r) => r.trim()).length} rules` : '(none)'}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between mt-8">
        <button
          onClick={() => setTab(Math.max(0, tab - 1))}
          disabled={tab === 0}
          className="px-5 py-2 text-sm border border-slate-600 rounded-lg text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>

        {tab < tabs.length - 1 ? (
          <button
            onClick={() => setTab(tab + 1)}
            className="px-5 py-2 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
          >
            Next
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-6 py-2 text-sm bg-amber-600 hover:bg-amber-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
          >
            {submitting ? 'Creating...' : 'Create World'}
          </button>
        )}
      </div>
    </div>
  );
}
