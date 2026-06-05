import { NextResponse } from 'next/server';

// Email is handled natively via mailto: links in lib/notifications.ts
// This endpoint is kept for backwards compatibility but is no longer used.
export async function POST() {
  return NextResponse.json({ ok: true, method: 'native' });
}
