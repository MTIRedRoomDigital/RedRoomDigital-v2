'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import Link from 'next/link';
import { ImageUpload } from '@/components/ImageUpload';

interface WorldData {
  id: string;
  creator_id: string;
  name: string;
  description: string | null;
  banner_url: string | null;
  thumbnail_url: string | null;
  lore: string | null;
  rules: {
    magic_system?: string;
    technology_level?: string;
    custom_rules?: string[];
  } | null;
  setting: string | null;
  is_public: boolean;
  is_nsfw?: boolean;
  join_mode: 'open' | 'locked';
}

export default function EditWorldPage() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [setting, setSetting] = useState('');
  const [lore, setLore] = useState('');
  const [magicSystem, setMagicSystem] = useState('');
  const [techLevel, setTechLevel] = useState('');
  const [customRules, setCustomRules] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isNsfw, setIsNsfw] = useState(false);
  const [joinMode, setJoinMode] = useState<'open' | 'locked'>('open');
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  const tabs = ['Basics', 'Lore & Setting', 'Rules', 'Settings'];

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (!user || !id) return;

    api.get<WorldData>(`/api/worlds/${id}`).then((res) => {
      if (res.success && res.data) {
        const w = res.data as any;
        // Check if user is creator or WorldMaster
        if (w.creator_id !== user.id) {
          const isMember = w.members?.some((m: any) => m.user_id === user.id && m.is_worldmaster);
          if (!isMember) {
            router.push(`/worlds/${id}`);
            return;
          }
        }
        setName(w.name || '');
        setDescription(w.description || '');
        setSetting(w.setting || '');
        setLore(w.lore || '');
        setMagicSystem(w.rules?.magic_system || '');
        setTechLevel(w.rules?.technology_level || '');
        setCustomRules(w.rules?.custom_rules?.join('\n') || '');
        setIsPublic(w.is_public !== false);
        setIsNsfw(w.is_nsfw === true);
        setJoinMode(w.join_mode || 'open');
        setBannerUrl(w.banner_url || null);
        setThumbnailUrl(w.thumbnail_url || null);
      } else {
        router.push('/worlds');
      }
      setLoading(false);
    });
  }, [id, user, authLoading, router]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('World name is required');
      setTab(0);
      return;
    }

    setError('');
    setSuccess('');
    setSubmitting(true);

    const rules: Record<string, unknown> = {};
    if (magicSystem.trim()) rules.magic_system = magicSystem.trim();
    if (techLevel.trim()) rules.technology_level = techLevel.trim();
    if (customRules.trim()) {
      rules.custom_rules = customRules.split('\n').filter((r) => r.trim());
    }

    const res = await api.put(`/api/worlds/${id}`, {
      name: name.trim(),
      description: description.trim() || null,
      setting: setting.trim() || null,
      lore: lore.trim() || null,
      rules: Object.keys(rules).length > 0 ? rules : null,
      is_public: isPublic,
      is_nsfw: isNsfw,
      join_mode: joinMode,
      banner_url: bannerUrl,
      thumbnail_url: thumbnailUrl,
    });

    setSubmitting(false);

    if (res.success) {
      const mod = (res as any).moderation;
      if (mod?.auto_flagged) {
        setError(`Auto-flagged as NSFW: ${mod.reason}. The world was switched to private.`);
      } else {
        setSuccess('World updated successfully!');
        setTimeout(() => setSuccess(''), 3000);
      }
    } else {
      setError((res as any).message || 'Failed to update world');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link href={`/worlds/${id}`} className="text-sm text-slate-400 hover:text-white transition-colors mb-2 inline-block">
          &larr; Back to World
        </Link>
        <h1 className="text-3xl font-bold text-white">Edit World</h1>
        <p className="text-slate-400 mt-1">Update your world&apos;s settings, lore, and rules</p>
      </div>

      {/* Error / Success */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-500/10 border border-green-500/50 rounded-lg text-green-400 text-sm">
          {success}
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
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Banner Image</label>
              <ImageUpload
                shape="banner"
                uploadType="banner"
                currentImageUrl={bannerUrl}
                onUploadComplete={(url) => setBannerUrl(url)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Thumbnail</label>
              <ImageUpload
                shape="square"
                uploadType="thumbnail"
                currentImageUrl={thumbnailUrl}
                onUploadComplete={(url) => setThumbnailUrl(url)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                World Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
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
                placeholder="e.g., Medieval Fantasy, Cyberpunk, Post-Apocalyptic"
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </>
        )}

        {/* Tab 1: Lore & Setting */}
        {tab === 1 && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">World Lore</label>
            <textarea
              value={lore}
              onChange={(e) => setLore(e.target.value)}
              placeholder="The detailed lore and history of your world..."
              rows={14}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 resize-none"
            />
            <p className="text-xs text-slate-500 mt-1">
              The AI uses this lore as context when characters chat &ldquo;Within World.&rdquo;
            </p>
          </div>
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
                placeholder={"One rule per line, e.g.:\nNo modern technology\nMagic requires spoken incantations"}
                rows={6}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 resize-none"
              />
            </div>
          </>
        )}

        {/* Tab 3: Settings */}
        {tab === 3 && (
          <>
            <div className="flex items-center justify-between p-4 bg-slate-800 border border-slate-700 rounded-lg">
              <div>
                <h4 className="text-white font-medium">Public World</h4>
                <p className="text-sm text-slate-400 mt-0.5">Anyone can discover this world</p>
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
                  <p className="text-sm text-slate-400 mt-0.5">Users must request permission to join</p>
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

            {/* NSFW self-flag */}
            <div className={`flex items-center justify-between p-4 border rounded-lg ${
              isNsfw ? 'bg-rose-950/30 border-rose-800/50' : 'bg-slate-800 border-slate-700'
            }`}>
              <div>
                <h4 className="text-white font-medium flex items-center gap-2">
                  Adult content (18+) <span className="text-xs">🔞</span>
                </h4>
                <p className="text-sm text-slate-400 mt-0.5">
                  Marks this world as NSFW. Won&apos;t appear in public browse.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isNsfw}
                  onChange={(e) => {
                    setIsNsfw(e.target.checked);
                    if (e.target.checked) setIsPublic(false);
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600" />
              </label>
            </div>
          </>
        )}
      </div>

      {/* Navigation + Save */}
      <div className="flex justify-between mt-8">
        <button
          onClick={() => setTab(Math.max(0, tab - 1))}
          disabled={tab === 0}
          className="px-5 py-2 text-sm border border-slate-600 rounded-lg text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>

        <div className="flex gap-3">
          {tab < tabs.length - 1 && (
            <button
              onClick={() => setTab(tab + 1)}
              className="px-5 py-2 text-sm border border-slate-600 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              Next
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-6 py-2 text-sm bg-amber-600 hover:bg-amber-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
          >
            {submitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
