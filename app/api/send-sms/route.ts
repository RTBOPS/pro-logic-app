import { NextResponse } from 'next/server';

// SMS is handled natively via sms: links in lib/notifications.ts
// This endpoint is kept for backwards compatibility but is no longer used.
export async function POST() {
  return NextResponse.json({ ok: true, method: 'native' });
}
