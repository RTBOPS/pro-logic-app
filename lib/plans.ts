import type { Plan } from '@/hooks/useAuth';

/* Feature limits per subscription plan. Keep in sync with app/pricing/page.tsx. */

export const PLAN_LIMITS: Record<Plan, { productions: number; crew: number; inventory: number }> = {
  free: { productions: 1, crew: 5, inventory: 10 },
  producer: { productions: Infinity, crew: Infinity, inventory: Infinity },
  pro: { productions: Infinity, crew: Infinity, inventory: Infinity },
  broadcast: { productions: Infinity, crew: Infinity, inventory: Infinity },
  studio: { productions: Infinity, crew: Infinity, inventory: Infinity },
};

// 'pro' (legacy $29 all-in) keeps broadcast-level access.
const PLAN_RANK: Record<Plan, number> = { free: 0, producer: 1, pro: 2, broadcast: 2, studio: 3 };

export const PLAN_LABEL: Record<Plan, string> = {
  free: 'Free', producer: 'Producer', pro: 'Pro', broadcast: 'Broadcast', studio: 'Studio',
};

export function planAtLeast(plan: Plan | undefined | null, required: Plan): boolean {
  return PLAN_RANK[plan || 'free'] >= PLAN_RANK[required];
}

/* An active Event Pass unlocks broadcast-level features until it expires. */
export function eventPassActive(profile: any): boolean {
  const until = profile?.event_pass_until;
  return !!until && new Date(until).getTime() > Date.now();
}

export function hasAccess(profile: any, required: Plan): boolean {
  if (planAtLeast(profile?.plan, required)) return true;
  return PLAN_RANK[required] <= PLAN_RANK.broadcast && eventPassActive(profile);
}

export function limitFor(plan: Plan | undefined | null, key: keyof typeof PLAN_LIMITS.free): number {
  return PLAN_LIMITS[plan || 'free'][key];
}
