'use client';

import Link from 'next/link';
import { Lock, Sparkles } from 'lucide-react';
import { useAuth, Plan } from '@/hooks/useAuth';
import { hasAccess, PLAN_LABEL } from '@/lib/plans';
import Modal from './Modal';

/* Full-page gate: wraps a premium page and shows an upgrade screen
   when the user's plan is below the required one. */
export function UpgradeGate({
  feature,
  requires = 'pro',
  children,
}: {
  feature: string;
  requires?: Plan;
  children: React.ReactNode;
}) {
  const { profile, loading } = useAuth();

  if (loading) return null;
  if (hasAccess(profile, requires)) return <>{children}</>;

  return (
    <div className="p-8 flex items-center justify-center min-h-[70vh]">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-md w-full text-center">
        <div className="inline-flex p-3 rounded-2xl bg-purple-50 text-purple-600 mb-4">
          <Lock size={24} />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">{feature} is a {PLAN_LABEL[requires]} feature</h1>
        <p className="text-sm text-gray-500 mb-6">
          Upgrade your plan to unlock {feature.toLowerCase()} and take your productions further.
        </p>
        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-zinc-800"
        >
          <Sparkles size={15} /> View plans
        </Link>
      </div>
    </div>
  );
}

/* Modal shown when a feature requires a higher plan. */
export function FeatureModal({
  feature,
  requires = 'pro',
  onClose,
}: {
  feature: string;
  requires?: Plan;
  onClose: () => void;
}) {
  return (
    <Modal title={`${PLAN_LABEL[requires]} feature`} onClose={onClose}>
      <div className="text-center">
        <div className="inline-flex p-3 rounded-2xl bg-purple-50 text-purple-600 mb-4">
          <Lock size={22} />
        </div>
        <p className="text-sm text-gray-600 mb-6">
          <span className="font-semibold">{feature}</span> is available on the {PLAN_LABEL[requires]} plan.
        </p>
        <div className="flex justify-center gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
            Not now
          </button>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 bg-black text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-zinc-800"
          >
            <Sparkles size={14} /> Upgrade
          </Link>
        </div>
      </div>
    </Modal>
  );
}

/* Modal shown when a Free-plan user hits a creation limit. */
export function LimitModal({
  item,
  limit,
  onClose,
}: {
  item: string;
  limit: number;
  onClose: () => void;
}) {
  return (
    <Modal title="Plan limit reached" onClose={onClose}>
      <div className="text-center">
        <div className="inline-flex p-3 rounded-2xl bg-purple-50 text-purple-600 mb-4">
          <Lock size={22} />
        </div>
        <p className="text-sm text-gray-600 mb-1">
          The Free plan includes up to <span className="font-semibold">{limit} {item}</span>.
        </p>
        <p className="text-sm text-gray-500 mb-6">
          Upgrade to Pro for unlimited {item} and all premium tools.
        </p>
        <div className="flex justify-center gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
            Not now
          </button>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 bg-black text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-zinc-800"
          >
            <Sparkles size={14} /> Upgrade
          </Link>
        </div>
      </div>
    </Modal>
  );
}
