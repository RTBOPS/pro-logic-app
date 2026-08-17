'use client';

import { useAuth } from '@/hooks/useAuth';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    color: 'border-gray-200',
    btn: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    features: [
      '1 active production',
      'Up to 5 crew members',
      'Up to 10 inventory items',
      'Basic call sheet (PDF)',
      'Community support',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$29',
    period: '/month',
    color: 'border-black ring-1 ring-black',
    btn: 'bg-black text-white hover:bg-zinc-800',
    badge: 'Most Popular',
    features: [
      'Unlimited productions',
      'Unlimited crew & inventory',
      'All PDF documents',
      'Audio planner (input list, RF & monitors)',
      'Storyboard creator',
      'Location blueprints',
      'Equipment database access',
      'Priority support',
    ],
  },
  {
    id: 'studio',
    name: 'Studio',
    price: '$79',
    period: '/month',
    color: 'border-purple-300 ring-1 ring-purple-400',
    btn: 'bg-purple-600 text-white hover:bg-purple-700',
    features: [
      'Everything in Pro',
      'Multiple team members',
      'Custom NDA & contract templates',
      'Advanced stripboard',
      'Dedicated support',
      'White-label exports',
    ],
  },
];

export default function PricingPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectPlan = async (planId: string) => {
    if (!user) {
      router.push('/auth');
      return;
    }

    // Free plan doesn't need PayPal
    if (planId === 'free') return;

    setUpgrading(planId);
    setError(null);

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId, uid: user.uid, email: user.email }),
      });

      const data = await res.json();

      if (!res.ok || !data.url) {
        setError(data.error || 'Could not start checkout. Please try again.');
        return;
      }

      // Redirect to PayPal approval page
      window.location.href = data.url;
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setUpgrading(null);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gray-50">
      {/* Top bar for visitors browsing pricing without an account */}
      {!user && (
        <header className="bg-black text-white">
          <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <img src="/logo.png" alt="PRO-LOGIC" className="h-7 object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/auth" className="text-sm text-zinc-300 hover:text-white">Sign in</Link>
              <Link href="/auth" className="text-sm font-medium bg-white text-black px-4 py-1.5 rounded-full hover:bg-zinc-200">
                Get started free
              </Link>
            </div>
          </div>
        </header>
      )}
    <div className="p-8 max-w-5xl mx-auto">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900">Choose your plan</h1>
        <p className="text-gray-500 mt-2">Start free, upgrade as your productions grow.</p>
        {profile && (
          <p className="text-sm text-blue-600 mt-2 font-medium">
            Current plan: <span className="capitalize">{profile.plan}</span>
          </p>
        )}
        {error && (
          <p className="text-sm text-red-600 mt-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2 inline-block">
            {error}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map(plan => (
          <div
            key={plan.id}
            className={`bg-white rounded-2xl border-2 p-6 flex flex-col ${plan.color} relative`}
          >
            {plan.badge && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-black text-white text-xs font-semibold px-3 py-1 rounded-full">
                {plan.badge}
              </div>
            )}
            <div className="mb-4">
              <div className="font-bold text-gray-900 text-lg">{plan.name}</div>
              <div className="mt-1">
                <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                <span className="text-gray-600 text-sm">{plan.period}</span>
              </div>
            </div>

            <ul className="space-y-2 flex-1 mb-6">
              {plan.features.map(f => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                  <Check size={14} className="text-green-500 mt-0.5 shrink-0" />
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
                ? 'Redirecting to PayPal…'
                : plan.id === 'free'
                ? 'Get started free'
                : `Subscribe with PayPal`}
            </button>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-gray-400 mt-8">
        Payments processed securely by PayPal. Cancel anytime from your PayPal account.
      </p>
    </div>
    </div>
  );
}
