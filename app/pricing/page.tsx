'use client';

import { useAuth } from '@/hooks/useAuth';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Check } from 'lucide-react';
import { useState } from 'react';

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
  const [upgrading, setUpgrading] = useState<string | null>(null);

  const selectPlan = async (planId: string) => {
    if (!user) return;
    setUpgrading(planId);
    await updateDoc(doc(db, 'users', user.uid), { plan: planId });
    setUpgrading(null);
    alert(`Plan updated to ${planId}. In production, this would trigger Stripe checkout.`);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900">Choose your plan</h1>
        <p className="text-gray-500 mt-2">Start free, upgrade as your productions grow.</p>
        {profile && (
          <p className="text-sm text-blue-600 mt-2 font-medium">
            Current plan: <span className="capitalize">{profile.plan}</span>
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6">
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
                ? 'Updating…'
                : `Choose ${plan.name}`}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
