'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Film, Users, Package, MapPin, LayoutDashboard,
  BookImage, FileText, CreditCard, LogOut, User,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';

const nav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/productions', label: 'Productions', icon: Film },
  { href: '/crew', label: 'Crew', icon: Users },
  { href: '/inventory', label: 'Inventory', icon: Package },
  { href: '/locations', label: 'Locations', icon: MapPin },
  { href: '/storyboard', label: 'Storyboard', icon: BookImage },
  { href: '/documents', label: 'Documents', icon: FileText },
];

const PLAN_BADGE: Record<string, string> = {
  free: 'bg-gray-700 text-gray-300',
  pro: 'bg-blue-600 text-white',
  studio: 'bg-purple-600 text-white',
};

export default function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const { profile } = useAuth();

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/auth');
  };

  return (
    <aside className="w-56 min-h-screen bg-zinc-900 text-white flex flex-col shrink-0">
      <div className="px-6 py-5 border-b border-zinc-700">
        <span className="text-xl font-bold tracking-tight">PRO-LOGIC</span>
        <p className="text-xs text-zinc-400 mt-0.5">Studio Management</p>
      </div>

      <nav className="flex-1 py-4">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? path === '/' : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-6 py-3 text-sm transition-colors ${
                active
                  ? 'bg-zinc-700 text-white font-medium'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-700 px-4 py-4 space-y-2">
        <Link
          href="/pricing"
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          <CreditCard size={14} className="text-zinc-400" />
          <span className="text-xs text-zinc-400">Plan</span>
          {profile?.plan && (
            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium capitalize ${PLAN_BADGE[profile.plan]}`}>
              {profile.plan}
            </span>
          )}
        </Link>

        {profile && (
          <div className="flex items-center gap-2 px-2 py-1.5">
            <User size={14} className="text-zinc-400 shrink-0" />
            <span className="text-xs text-zinc-400 truncate">{profile.displayName}</span>
          </div>
        )}

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-2 py-1.5 w-full rounded-lg hover:bg-zinc-800 transition-colors text-left"
        >
          <LogOut size={14} className="text-zinc-400" />
          <span className="text-xs text-zinc-400">Sign out</span>
        </button>
      </div>
    </aside>
  );
}
