'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import AuthGuard from './AuthGuard';

const PUBLIC_PATHS = ['/auth', '/confirm'];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const isPublic = PUBLIC_PATHS.some(p => path === p || path.startsWith(p + '/'));

  if (isPublic) return <>{children}</>;

  return (
    <AuthGuard>
      <Sidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </AuthGuard>
  );
}
