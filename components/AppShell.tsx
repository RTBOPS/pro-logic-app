'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import AuthGuard from './AuthGuard';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const isAuthPage = path === '/auth';

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <AuthGuard>
      <Sidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </AuthGuard>
  );
}
