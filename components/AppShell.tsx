'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import AuthGuard from './AuthGuard';
import CompanyTheme from './CompanyTheme';
import { NamespaceProvider } from './NamespaceProvider';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/hooks/useAuth';
import { Menu, X } from 'lucide-react';

const PUBLIC_PATHS = ['/', '/auth', '/confirm', '/callsheet', '/graphics-out'];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const company = useCompany();
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isPublic = path === '/' || PUBLIC_PATHS.filter(p => p !== '/').some(p => path === p || path.startsWith(p + '/'))
    // Pricing is public for visitors; logged-in users see it inside the app shell
    || (path === '/pricing' && !user);

  // Close sidebar on route change
  useEffect(() => { setSidebarOpen(false); }, [path]);

  if (isPublic) return <>{children}</>;

  return (
    <NamespaceProvider>
    <AuthGuard>
      <CompanyTheme />
      {/* Mobile header bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-14 shrink-0"
        style={{ backgroundColor: company?.primary_color || '#18181b' }}>
        <button onClick={() => setSidebarOpen(true)} className="text-white p-1">
          <Menu size={22} />
        </button>
        {/* Pro-Logic logo center-left */}
        <img src="/logo.png" alt="PRO-LOGIC" className="h-7 object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
        {/* Company logo right */}
        {company?.logo_url
          ? <img src={company.logo_url} alt={company.name} className="h-8 object-contain rounded" />
          : <div className="w-8" />
        }
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-10 w-64 h-full">
            <button onClick={() => setSidebarOpen(false)} className="absolute top-3 right-3 text-zinc-300 hover:text-white z-20">
              <X size={20} />
            </button>
            <Sidebar forceExpanded />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden md:flex md:shrink-0">
        <Sidebar />
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto pt-14 md:pt-0">
        {children}
      </main>
    </AuthGuard>
    </NamespaceProvider>
  );
}
