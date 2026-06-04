'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Film, Users, Package, MapPin, LayoutDashboard,
  BookImage, FileText, CreditCard, LogOut, User,
  Layout, Clapperboard, CheckSquare, CalendarDays,
  Truck, Building2, IdCard, UserCheck, Layers,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { useWorkspaces } from '@/hooks/useNamespace';

const nav = [
  { section: 'Overview' },
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/gantt', label: 'Gantt Chart', icon: CalendarDays },
  { section: 'Production' },
  { href: '/productions', label: 'Productions', icon: Film },
  { href: '/storyboard', label: 'Storyboard', icon: Layers },
  { href: '/stripboard', label: 'Stripboard', icon: BookImage },
  { href: '/blueprint', label: 'Blueprint', icon: Layout },
  { href: '/shoot-log', label: 'Shoot Log', icon: Clapperboard },
  { section: 'Team' },
  { href: '/crew', label: 'Crew & Cast', icon: Users },
  { href: '/crew/id-cards', label: 'ID Cards', icon: IdCard },
  { href: '/character-breakdown', label: 'Characters', icon: UserCheck },
  { section: 'Assets' },
  { href: '/inventory', label: 'Inventory', icon: Package },
  { href: '/transportation', label: 'Transportation', icon: Truck },
  { href: '/locations', label: 'Locations', icon: MapPin },
  { section: 'Tools' },
  { href: '/checklists', label: 'Checklists', icon: CheckSquare },
  { href: '/documents', label: 'Documents', icon: FileText },
  { section: 'Settings' },
  { href: '/company', label: 'Company Info', icon: Building2 },
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
  const company = useCompany();
  const { namespace, ownUid, workspaces, switchWorkspace } = useWorkspaces();

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/auth');
  };

  return (
    <aside className="w-64 md:w-52 h-screen text-white flex flex-col shrink-0 overflow-y-auto"
      style={{ backgroundColor: company?.primary_color || '#18181b' }}>
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-2">
        {/* Pro-Logic logo — always left */}
        <img src="/logo-white.svg" alt="Pro-Logic" style={{ height: '28px', objectFit: 'contain', maxWidth: '90px' }} />
        {/* Company logo — right side */}
        {company?.logo_url && (
          <img src={company.logo_url} alt={company.name} style={{ height: '28px', objectFit: 'contain', maxWidth: '80px', borderRadius: '4px' }} />
        )}
      </div>

      {/* Workspace switcher — only shown when user has access to multiple workspaces */}
      {workspaces.length > 0 && (
        <div className="px-3 py-2 border-b border-white/10">
          <div className="text-xs text-white/40 uppercase tracking-widest mb-1 px-1">Workspace</div>
          <select
            value={namespace || ownUid || ''}
            onChange={e => switchWorkspace(e.target.value)}
            className="w-full text-xs rounded-lg px-2 py-1.5 border border-white/20 focus:outline-none"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'white' }}
          >
            <option value={ownUid || ''}>My Company</option>
            {workspaces.map(w => (
              <option key={w.ownerUid} value={w.ownerUid}>
                {w.companyName || 'Shared Workspace'}
              </option>
            ))}
          </select>
        </div>
      )}

      <nav className="flex-1 py-2">
        {nav.map((item, i) => {
          if ('section' in item) {
            return (
              <div key={i} className="px-4 pt-4 pb-1">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">{item.section}</span>
              </div>
            );
          }
          const { href, label, icon: Icon } = item as any;
          const active = href === '/' ? path === '/' : path.startsWith(href);
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-2.5 px-4 py-2 text-sm transition-colors ${
                active ? 'bg-zinc-700 text-white font-medium' : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
              }`}>
              <Icon size={15} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-700 px-4 py-3 space-y-1.5">
        <Link href="/pricing" className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800">
          <CreditCard size={13} className="text-zinc-300" />
          <span className="text-xs text-zinc-300">Plan</span>
          {profile?.plan && (
            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium capitalize ${PLAN_BADGE[profile.plan]}`}>
              {profile.plan}
            </span>
          )}
        </Link>
        {profile && (
          <div className="flex items-center gap-2 px-2 py-1">
            <User size={13} className="text-zinc-300 shrink-0" />
            <span className="text-xs text-zinc-300 truncate">{profile.displayName}</span>
          </div>
        )}
        <button onClick={handleLogout} className="flex items-center gap-2 px-2 py-1.5 w-full rounded-lg hover:bg-zinc-800 text-left">
          <LogOut size={13} className="text-zinc-300" />
          <span className="text-xs text-zinc-300">Sign out</span>
        </button>
      </div>
    </aside>
  );
}
