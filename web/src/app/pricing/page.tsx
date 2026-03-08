'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const plans = [
  {
    key: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Start your adventure. Create characters and explore worlds built by others.',
    color: 'border-slate-600',
    badgeColor: 'bg-slate-700 text-slate-300',
    buttonStyle: 'border border-slate-600 text-slate-300 hover:text-white hover:border-slate-500',
    features: [
      { text: '3 characters', included: true },
      { text: '10 chats per day', included: true },
      { text: 'Join worlds', included: true },
      { text: 'Join quests', included: true },
      { text: 'Community forum access', included: true },
      { text: 'Create worlds', included: false },
      { text: 'AI character responses', included: false },
      { text: 'Ad-free experience', included: false },
    ],
  },
  {
    key: 'premium',
    name: 'Premium',
    price: '$9.99',
    period: '/month',
    description: 'Become a WorldMaster. Build worlds, run campaigns, and unlock AI-powered roleplay.',
    color: 'border-amber-500',
    badgeColor: 'bg-amber-900/30 text-amber-400',
    buttonStyle: 'bg-amber-600 hover:bg-amber-700 text-white',
    popular: true,
    features: [
      { text: '10 characters', included: true },
      { text: 'Unlimited chats', included: true },
      { text: 'Join worlds', included: true },
      { text: 'Join quests', included: true },
      { text: 'Community forum access', included: true },
      { text: '1 world (WorldMaster)', included: true },
      { text: 'AI character responses', included: true },
      { text: 'Ad-free experience', included: true },
    ],
  },
  {
    key: 'ultimate',
    name: 'Ultimate',
    price: '$19.99',
    period: '/month',
    description: 'Unlimited power. No limits on characters, worlds, or anything else.',
    color: 'border-purple-500',
    badgeColor: 'bg-purple-900/30 text-purple-400',
    buttonStyle: 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white',
    features: [
      { text: 'Unlimited characters', included: true },
      { text: 'Unlimited chats', included: true },
      { text: 'Join worlds', included: true },
      { text: 'Join quests', included: true },
      { text: 'Community forum access', included: true },
      { text: 'Unlimited worlds', included: true },
      { text: 'AI character responses', included: true },
      { text: 'Ad-free experience', included: true },
      { text: 'Priority AI models', included: true },
      { text: 'Early access features', included: true },
    ],
  },
];

const faqs = [
  {
    q: 'Can I cancel anytime?',
    a: 'Yes! You can cancel your subscription at any time. Your premium features will remain active until the end of your billing period.',
  },
  {
    q: 'What happens to my content if I downgrade?',
    a: "Your characters, worlds, and chat history are never deleted. If you go over the free tier limits, you won't be able to create new ones, but existing content stays.",
  },
  {
    q: 'What AI models are used for character responses?',
    a: 'Premium users get access to high-quality AI models like GPT-4o-mini. Ultimate users get priority access to the best available models for more immersive roleplay.',
  },
  {
    q: 'What does WorldMaster mean?',
    a: 'WorldMasters can create custom worlds with their own lore, rules, magic systems, and campaigns. Other users can join your world, create characters in it, and participate in your quests.',
  },
];

export default function PricingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const currentTier = user?.subscription || 'free';

  const handleSelectPlan = async (planKey: string) => {
    if (!user) {
      router.push('/register');
      return;
    }

    if (planKey === currentTier) return;
    if (planKey === 'free') return; // Can't "buy" free

    setLoadingPlan(planKey);

    // Create Stripe checkout session
    const res = await api.post<{ url: string }>('/api/subscriptions/checkout', {
      plan: planKey,
      cycle: billingCycle,
    });

    if (res.success && res.data) {
      // Redirect to Stripe checkout
      window.location.href = (res.data as any).url;
    } else {
      alert((res as any).message || 'Failed to start checkout. Please try again.');
      setLoadingPlan(null);
    }
  };

  const getButtonLabel = (planKey: string) => {
    if (!user) return 'Get Started';
    if (planKey === currentTier) return 'Current Plan';
    const tierLevel: Record<string, number> = { free: 0, premium: 1, ultimate: 2 };
    return tierLevel[planKey] > tierLevel[currentTier] ? 'Upgrade' : 'Downgrade';
  };

  const yearlyPrice = (monthly: string) => {
    const num = parseFloat(monthly.replace('$', ''));
    if (num === 0) return '$0';
    const yearly = (num * 10).toFixed(2); // 2 months free
    return `$${yearly}`;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-white mb-3">Choose Your Path</h1>
        <p className="text-lg text-slate-400 max-w-xl mx-auto">
          Whether you&apos;re a casual explorer or a dedicated WorldMaster, there&apos;s a plan for you.
        </p>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-3 mt-6">
          <span className={`text-sm ${billingCycle === 'monthly' ? 'text-white' : 'text-slate-500'}`}>Monthly</span>
          <button
            onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              billingCycle === 'yearly' ? 'bg-amber-600' : 'bg-slate-600'
            }`}
          >
            <div
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                billingCycle === 'yearly' ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
          <span className={`text-sm ${billingCycle === 'yearly' ? 'text-white' : 'text-slate-500'}`}>
            Yearly
            <span className="ml-1 text-xs text-green-400 font-medium">Save 17%</span>
          </span>
        </div>
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        {plans.map((plan) => {
          const isCurrent = currentTier === plan.key;
          const displayPrice = billingCycle === 'yearly' ? yearlyPrice(plan.price) : plan.price;
          const displayPeriod = plan.price === '$0' ? 'forever' : billingCycle === 'yearly' ? '/year' : '/month';

          return (
            <div
              key={plan.key}
              className={`relative p-6 bg-slate-800 rounded-xl border-2 ${plan.color} ${
                plan.popular ? 'ring-1 ring-amber-500/30' : ''
              } transition-all hover:translate-y-[-2px]`}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 text-xs font-semibold bg-amber-600 text-white rounded-full">
                    Most Popular
                  </span>
                </div>
              )}

              {/* Plan Header */}
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-xl font-bold text-white">{plan.name}</h2>
                  {isCurrent && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${plan.badgeColor}`}>Current</span>
                  )}
                </div>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-3xl font-bold text-white">{displayPrice}</span>
                  <span className="text-sm text-slate-500">{displayPeriod}</span>
                </div>
                <p className="text-sm text-slate-400">{plan.description}</p>
              </div>

              {/* Features */}
              <ul className="space-y-2.5 mb-6">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    {feature.included ? (
                      <span className="text-green-400 text-base">✓</span>
                    ) : (
                      <span className="text-slate-600 text-base">✗</span>
                    )}
                    <span className={feature.included ? 'text-slate-300' : 'text-slate-600'}>{feature.text}</span>
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              <button
                onClick={() => handleSelectPlan(plan.key)}
                disabled={isCurrent || loadingPlan === plan.key}
                className={`w-full py-2.5 px-4 rounded-lg font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${plan.buttonStyle}`}
              >
                {loadingPlan === plan.key ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </span>
                ) : (
                  getButtonLabel(plan.key)
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* FAQ Section */}
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-white text-center mb-6">Frequently Asked Questions</h2>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left"
              >
                <span className="font-medium text-white text-sm">{faq.q}</span>
                <span className="text-slate-400 text-lg ml-2">{expandedFaq === i ? '−' : '+'}</span>
              </button>
              {expandedFaq === i && (
                <div className="px-5 pb-4">
                  <p className="text-sm text-slate-400 leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      {!user && (
        <div className="text-center mt-12 p-8 bg-gradient-to-r from-red-900/20 to-amber-900/20 border border-red-800/30 rounded-xl">
          <h3 className="text-xl font-bold text-white mb-2">Ready to start your journey?</h3>
          <p className="text-slate-400 mb-4">Create a free account and start building characters today.</p>
          <Link
            href="/register"
            className="inline-block px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
          >
            Create Free Account
          </Link>
        </div>
      )}
    </div>
  );
}
