'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Check, Zap } from 'lucide-react';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    monthly: 0, annual: 0,
    color: 'border-gray-200',
    btn: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    tag: 'Get started',
    features: [
      '1 active production',
      'Up to 5 crew members',
      'Up to 10 inventory items',
      'Basic call sheet (PDF)',
      'Sun tracker',
      'Community support',
    ],
  },
  {
    id: 'producer',
    name: 'Producer',
    monthly: 39, annual: 29,
    color: 'border-black ring-1 ring-black',
    btn: 'bg-black text-white hover:bg-zinc-800',
    badge: 'Most popular',
    tag: 'Every production document',
    features: [
      'Unlimited productions, crew & inventory',
      'All 30 production documents (PDF)',
      'Budget, purchase orders & invoices',
      'Clients & online proposals',
      'Permits & insurance vault',
      'Creative: treatment, look book, mood boards',
      'Audio planner, storyboard, stripboard',
      "Director's viewfinder & location blueprints",
      'Priority support',
    ],
  },
  {
    id: 'broadcast',
    name: 'Broadcast',
    monthly: 99, annual: 79,
    color: 'border-amber-400 ring-1 ring-amber-400',
    btn: 'bg-amber-400 text-black hover:bg-amber-300',
    badge: 'Live graphics',
    tag: 'Everything in Producer, plus the CG',
    features: [
      'Live sports graphics with real-time data',
      'Basketball, soccer, NFL, NHL, MLB — 15+ leagues',
      'News & church broadcast modes',
      'Court / field projection mapping',
      '1 on-air output',
      'Scorebug, lower thirds, stats & tickers',
    ],
  },
  {
    id: 'studio',
    name: 'Studio',
    monthly: 199, annual: 159,
    color: 'border-purple-300 ring-1 ring-purple-400',
    btn: 'bg-purple-600 text-white hover:bg-purple-700',
    tag: 'For teams & broadcasters',
    features: [
      'Everything in Broadcast',
      'Multiple team members',
      '3 on-air outputs',
      'White-label exports',
      'Custom NDA & contract templates',
      'Advanced stripboard',
      'Dedicated support',
    ],
  },
];

export default function PricingPage() {
  const { user, profile } = useAuth();
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [annual, setAnnual] = useState(true);

  const selectPlan = async (planId: string) => {
    if (!user) {
      window.location.href = '/auth?next=/pricing';
      return;
    }
    if (planId === 'free') return;

    const planKey = planId === 'event' ? 'event' : annual ? `${planId}_annual` : planId;
    setUpgrading(planId);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ plan: planKey }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
        setUpgrading(null);
        return;
      }
      // Redirect to PayPal approval page
      window.location.href = data.url;
    } catch {
      alert('Checkout failed. Please try again.');
      setUpgrading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-zinc-950">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/">
            <img src="/logo.png" alt="PRO-LOGIC" className="h-7 object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
          </Link>
          {!user && (
            <Link href="/auth" className="text-sm text-white/80 hover:text-white">
              Get started free
            </Link>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-12 text-center">
        <h1 className="text-3xl font-bold text-gray-900">Choose your plan</h1>
        <p className="text-gray-500 mt-2">Start free, upgrade as your productions grow.</p>
        {profile && (
          <p className="text-sm text-gray-600 mt-2">
            Current plan: <span className="capitalize font-medium">{profile.plan}</span>
          </p>
        )}

        <div className="inline-flex items-center gap-1 mt-6 bg-gray-100 rounded-xl p-1">
          <button onClick={() => setAnnual(false)} className={`px-4 py-1.5 rounded-lg text-sm font-medium ${!annual ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>Monthly</button>
          <button onClick={() => setAnnual(true)} className={`px-4 py-1.5 rounded-lg text-sm font-medium ${annual ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
            Annual <span className="text-green-600 font-semibold">save ~25%</span>
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 pb-8 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLANS.map(plan => (
          <div
            key={plan.id}
            className={`bg-white rounded-2xl border-2 p-6 flex flex-col ${plan.color} relative`}
          >
            {plan.badge && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[11px] font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                {plan.badge}
              </div>
            )}
            <div className="mb-4">
              <div className="font-bold text-gray-900 text-lg">{plan.name}</div>
              <div className="mt-1">
                <span className="text-3xl font-bold text-gray-900">${annual ? plan.annual : plan.monthly}</span>
                <span className="text-gray-600 text-sm">{plan.monthly === 0 ? ' forever' : '/month'}</span>
              </div>
              {plan.monthly > 0 && annual && (
                <div className="text-xs text-gray-400">billed annually (${plan.annual * 12}/yr)</div>
              )}
              <div className="text-xs text-gray-500 mt-1">{plan.tag}</div>
            </div>
            <ul className="space-y-2 text-sm text-gray-600 flex-1 mb-6 text-left">
              {plan.features.map(f => (
                <li key={f} className="flex items-start gap-2">
                  <Check size={15} className="text-green-500 mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => selectPlan(plan.id)}
              disabled={upgrading === plan.id || profile?.plan === plan.id}
              className={`w-full py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${plan.btn}`}
            >
              {profile?.plan === plan.id
                ? 'Current plan'
                : upgrading === plan.id
                ? 'Redirecting…'
                : plan.id === 'free'
                ? 'Get started free'
                : `Get ${plan.name}`}
            </button>
          </div>
        ))}
      </div>

      {/* Event pass */}
      <div className="max-w-6xl mx-auto px-6 pb-12">
        <div className="bg-zinc-950 rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-5">
          <div className="p-3 rounded-2xl bg-amber-400/10 text-amber-400"><Zap size={26} /></div>
          <div className="flex-1 text-center sm:text-left">
            <div className="font-bold text-white text-lg">Event Pass — $79</div>
            <p className="text-sm text-zinc-400">
              Full Broadcast access for 4 days: live graphics, real-time data, projection mapping.
              Perfect for a tournament, a church event or a single game weekend. One-time payment, no subscription.
            </p>
          </div>
          <button
            onClick={() => selectPlan('event')}
            disabled={upgrading === 'event'}
            className="bg-amber-400 text-black px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-amber-300 disabled:opacity-50 whitespace-nowrap"
          >
            {upgrading === 'event' ? 'Redirecting…' : 'Buy Event Pass'}
          </button>
        </div>
      </div>

      <p className="text-center text-xs text-gray-400 pb-10 px-6">
        Payments processed securely by PayPal. Cancel anytime from your PayPal account.
        Live sports data is provided by public third-party sources and official feeds where available.
      </p>
    </div>
  );
}
