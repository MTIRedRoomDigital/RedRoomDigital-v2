'use client';

import { Suspense, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface SubscriptionData {
  tier: string;
  expiresAt: string | null;
  usage: {
    characters: number;
    worlds: number;
  };
  limits: {
    characters: number;
    worlds: number;
    dailyChats: number;
  };
}

interface ChatUsageData {
  used: number;
  limit: number | null;
  remaining: number | null;
  unlimited: boolean;
}

const tierInfo: Record<string, { name: string; color: string; bgColor: string; icon: string }> = {
  free: { name: 'Free', color: 'text-slate-400', bgColor: 'bg-slate-700', icon: '🎭' },
  premium: { name: 'Premium', color: 'text-amber-400', bgColor: 'bg-amber-900/30', icon: '👑' },
  ultimate: { name: 'Ultimate', color: 'text-purple-400', bgColor: 'bg-purple-900/30', icon: '⚡' },
};

export default function SubscriptionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-slate-400">Loading subscription...</div>
      </div>
    }>
      <SubscriptionContent />
    </Suspense>
  );
}

function SubscriptionContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [subData, setSubData] = useState<SubscriptionData | null>(null);
  const [chatUsage, setChatUsage] = useState<ChatUsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  const status = searchParams.get('status');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (!user) return;

    const loadData = async () => {
      const [subRes, chatRes] = await Promise.all([
        api.get<SubscriptionData>('/api/subscriptions/status'),
        api.get<ChatUsageData>('/api/subscriptions/chat-usage'),
      ]);

      if (subRes.success && subRes.data) setSubData(subRes.data as any);
      if (chatRes.success && chatRes.data) setChatUsage(chatRes.data as any);
      setLoading(false);
    };

    loadData();
  }, [user, authLoading, router]);

  const handleManageBilling = async () => {
    setPortalLoading(true);
    const res = await api.post<{ url: string }>('/api/subscriptions/portal', {});
    if (res.success && res.data) {
      window.location.href = (res.data as any).url;
    } else {
      alert((res as any).message || 'Could not open billing portal');
      setPortalLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-slate-400">Loading subscription...</div>
      </div>
    );
  }

  if (!subData) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-slate-400">Unable to load subscription data.</div>
      </div>
    );
  }

  const info = tierInfo[subData.tier] || tierInfo.free;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Success Banner */}
      {status === 'success' && (
        <div className="mb-6 p-4 bg-green-900/20 border border-green-800/50 rounded-xl text-center">
          <h3 className="text-green-400 font-semibold mb-1">Subscription Activated!</h3>
          <p className="text-sm text-slate-400">
            Welcome to {info.name}! Your new features are ready to use.
          </p>
        </div>
      )}

      {/* Header */}
      <h1 className="text-3xl font-bold text-white mb-6">My Subscription</h1>

      {/* Current Plan Card */}
      <div className={`p-6 bg-slate-800 border border-slate-700 rounded-xl mb-6`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{info.icon}</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">{info.name} Plan</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full ${info.bgColor} ${info.color}`}>
                  Active
                </span>
              </div>
              {subData.expiresAt && (
                <p className="text-xs text-slate-500 mt-1">
                  Renews on {new Date(subData.expiresAt).toLocaleDateString('en-US', {
                    month: 'long', day: 'numeric', year: 'numeric',
                  })}
                </p>
              )}
            </div>
          </div>

          {subData.tier !== 'free' ? (
            <button
              onClick={handleManageBilling}
              disabled={portalLoading}
              className="px-4 py-2 text-sm border border-slate-600 text-slate-300 hover:text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {portalLoading ? 'Opening...' : 'Manage Billing'}
            </button>
          ) : (
            <Link
              href="/pricing"
              className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
            >
              Upgrade
            </Link>
          )}
        </div>

        {/* Upgrade prompt for free */}
        {subData.tier === 'free' && (
          <div className="p-4 bg-amber-900/10 border border-amber-800/30 rounded-lg">
            <p className="text-sm text-amber-400 font-medium mb-1">Unlock more with Premium</p>
            <p className="text-xs text-slate-400">
              Create worlds, get unlimited chats, AI-powered character responses, and an ad-free experience starting at $9.99/month.
            </p>
          </div>
        )}
      </div>

      {/* Usage Stats */}
      <h3 className="text-lg font-semibold text-white mb-3">Usage</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Characters */}
        <div className="p-4 bg-slate-800 border border-slate-700 rounded-xl">
          <div className="text-sm text-slate-400 mb-2">Characters</div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-white">{subData.usage.characters}</span>
            <span className="text-sm text-slate-500">
              / {subData.limits.characters === Infinity ? '∞' : subData.limits.characters}
            </span>
          </div>
          {subData.limits.characters !== Infinity && (
            <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  subData.usage.characters >= subData.limits.characters ? 'bg-red-500' : 'bg-amber-500'
                }`}
                style={{ width: `${Math.min(100, (subData.usage.characters / subData.limits.characters) * 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* Worlds */}
        <div className="p-4 bg-slate-800 border border-slate-700 rounded-xl">
          <div className="text-sm text-slate-400 mb-2">Worlds</div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-white">{subData.usage.worlds}</span>
            <span className="text-sm text-slate-500">
              / {subData.limits.worlds === Infinity ? '∞' : subData.limits.worlds}
            </span>
          </div>
          {subData.limits.worlds !== Infinity && subData.limits.worlds > 0 && (
            <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  subData.usage.worlds >= subData.limits.worlds ? 'bg-red-500' : 'bg-amber-500'
                }`}
                style={{ width: `${Math.min(100, (subData.usage.worlds / subData.limits.worlds) * 100)}%` }}
              />
            </div>
          )}
          {subData.limits.worlds === 0 && (
            <p className="text-xs text-slate-500 mt-1">Upgrade to create worlds</p>
          )}
        </div>

        {/* Daily Chats */}
        <div className="p-4 bg-slate-800 border border-slate-700 rounded-xl">
          <div className="text-sm text-slate-400 mb-2">Chats Today</div>
          {chatUsage?.unlimited ? (
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-white">∞</span>
              <span className="text-sm text-slate-500">unlimited</span>
            </div>
          ) : (
            <>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-white">{chatUsage?.used || 0}</span>
                <span className="text-sm text-slate-500">/ {chatUsage?.limit || 10}</span>
              </div>
              {chatUsage && (
                <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      (chatUsage.remaining || 0) <= 2 ? 'bg-red-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(100, ((chatUsage.used || 0) / (chatUsage.limit || 10)) * 100)}%` }}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Feature Comparison */}
      <h3 className="text-lg font-semibold text-white mb-3">Your Features</h3>
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        {[
          { feature: 'Characters', free: '3', premium: '10', ultimate: 'Unlimited' },
          { feature: 'Daily Chats', free: '10', premium: 'Unlimited', ultimate: 'Unlimited' },
          { feature: 'Create Worlds', free: '✗', premium: '1', ultimate: 'Unlimited' },
          { feature: 'AI Responses', free: '✗', premium: '✓', ultimate: '✓ Priority' },
          { feature: 'Ad-Free', free: '✗', premium: '✓', ultimate: '✓' },
        ].map((row, i) => (
          <div
            key={i}
            className={`flex items-center px-5 py-3 text-sm ${i > 0 ? 'border-t border-slate-700' : ''}`}
          >
            <span className="flex-1 text-slate-300">{row.feature}</span>
            <span className={`w-20 text-center ${subData.tier === 'free' ? 'text-white font-medium' : 'text-slate-500'}`}>
              {row.free}
            </span>
            <span className={`w-20 text-center ${subData.tier === 'premium' ? 'text-amber-400 font-medium' : 'text-slate-500'}`}>
              {row.premium}
            </span>
            <span className={`w-20 text-center ${subData.tier === 'ultimate' ? 'text-purple-400 font-medium' : 'text-slate-500'}`}>
              {row.ultimate}
            </span>
          </div>
        ))}
      </div>

      {/* Upgrade CTA */}
      {subData.tier !== 'ultimate' && (
        <div className="mt-6 text-center">
          <Link
            href="/pricing"
            className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
          >
            View all plans &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}
