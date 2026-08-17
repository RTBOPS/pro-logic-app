import type { Plan } from '@/hooks/useAuth';

/* Feature limits per subscription plan. Keep in sync with app/pricing/page.tsx. */

export const PLAN_LIMITS: Record<Plan, { productions: number; crew: number; inventory: number }> = {
  free: { productions: 1, crew: 5, inventory: 10 },
  pro: { productions: Infinity, crew: Infinity, inventory: Infinity },
  studio: { productions: Infinity, crew: Infinity, inventory: Infinity },
};

const PLAN_RANK: Record<Plan, number> = { free: 0, pro: 1, studio: 2 };

export function planAtLeast(plan: Plan | undefined | null, required: Plan): boolean {
  return PLAN_RANK[plan || 'free'] >= PLAN_RANK[required];
}

export function limitFor(plan: Plan | undefined | null, key: keyof typeof PLAN_LIMITS.free): number {
  return PLAN_LIMITS[plan || 'free'][key];
}
