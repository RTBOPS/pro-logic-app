import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import AppShell from '@/components/AppShell';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' });

export const metadata: Metadata = {
  title: 'PRO-LOGIC Studio',
  description: 'Production management for Pro-Logic Studio',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PRO-LOGIC',
  },
};

export const viewport = {
  themeColor: '#09090b',
  viewportFit: 'cover' as const,
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full`}>
      <body className="flex h-full min-h-screen bg-gray-50 font-sans antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
