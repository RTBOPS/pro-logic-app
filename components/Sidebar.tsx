'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Film, Users, Package, MapPin, LayoutDashboard,
  BookImage, FileText, CreditCard, LogOut, User,
  Layout, Clapperboard, CheckSquare, CalendarDays,
  Truck, Building2, IdCard, UserCheck, Layers, ClipboardCheck, Mic,
  ListOrdered, Shield, Tv, MonitorPlay, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { useWorkspaces } from '@/hooks/useNamespace';

const nav = [
  { section: 'Overview' },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/gantt', label: 'Gantt Chart', icon: CalendarDays },
  { section: 'Production' },
  { href: '/productions', label: 'Productions', icon: Film },
  { href: '/storyboard', label: 'Storyboard', icon: Layers },
  { href: '/stripboard', label: 'Stripboard', icon: BookImage },
  { href: '/blueprint', label: 'Blueprint', icon: Layout },
  { href: '/shoot-log', label: 'Shoot Log', icon: Clapperboard },
  { href: '/rundown', label: 'Run of Show', icon: ListOrdered },
  { href: '/broadcast', label: 'Broadcast Plan', icon: Tv },
  { href: '/live-graphics', label: 'Live Graphics', icon: MonitorPlay },
  { href: '/safety', label: 'Safety', icon: Shield },
  { section: 'Audio' },
  { href: '/audio', label: 'Audio Planner', icon: Mic },
  { section: 'Team' },
  { href: '/crew', label: 'Crew & Cast', icon: Users },
  { href: '/crew/id-cards', label: 'ID Cards', icon: IdCard },
  { href: '/character-breakdown', label: 'Characters', icon: UserCheck },
  { section: 'Assets' },
  { href: '/inventory', label: 'Inventory', icon: Package },
  { href: '/equipment', label: 'Equipment Forms', icon: ClipboardCheck },
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

export default function Sidebar({ forceExpanded = false }: { forceExpanded?: boolean }) {
  const path = usePathname();
  const [collapsedPref, setCollapsedPref] = useState(false);
  useEffect(() => {
    // Auto-shrink on the CG page (it needs the room); otherwise honor the saved preference
    if (path.startsWith('/live-graphics')) setCollapsedPref(true);
    else setCollapsedPref(localStorage.getItem('plg_sidebar_collapsed') === '1');
  }, [path]);
  const collapsed = forceExpanded ? false : collapsedPref;
  const toggle = () => {
    const next = !collapsedPref;
    setCollapsedPref(next);
    localStorage.setItem('plg_sidebar_collapsed', next ? '1' : '0');
  };
  const router = useRouter();
  const { profile } = useAuth();
  const company = useCompany();
  const { namespace, ownUid, workspaces, switchWorkspace } = useWorkspaces();

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/auth');
  };

  return (
    <aside className={`${collapsed ? 'w-16' : 'w-64 md:w-52'} h-screen text-white flex flex-col shrink-0 overflow-y-auto transition-all`}
      style={{ backgroundColor: company?.primary_color || '#18181b' }}>
      <div className={`px-3 py-3 border-b border-white/10 flex items-center gap-2 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && <img src="/logo-white.svg" alt="Pro-Logic" style={{ height: '28px', objectFit: 'contain', maxWidth: '90px' }} />}
        {!collapsed && company?.logo_url && (
          <img src={company.logo_url} alt={company.name} style={{ height: '28px', objectFit: 'contain', maxWidth: '64px', borderRadius: '4px' }} />
        )}
        {!forceExpanded && (
          <button onClick={toggle} title={collapsed ? 'Expand menu' : 'Collapse menu'}
            className="text-zinc-400 hover:text-white shrink-0 p-1 rounded hover:bg-white/10">
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
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
            if (collapsed) return <div key={i} className="mx-3 my-2 border-t border-white/10" />;
            return (
              <div key={i} className="px-4 pt-4 pb-1">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">{item.section}</span>
              </div>
            );
          }
          const { href, label, icon: Icon } = item as any;
          const active = href === '/' ? path === '/' : path.startsWith(href);
          return (
            <Link key={href} href={href} title={label}
              className={`flex items-center gap-2.5 py-2 text-sm transition-colors ${collapsed ? 'justify-center px-0' : 'px-4'} ${
                active ? 'bg-zinc-700 text-white font-medium' : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
              }`}>
              <Icon size={collapsed ? 17 : 15} />
              {!collapsed && label}
            </Link>
          );
        })}
      </nav>

      <div className={`border-t border-zinc-700 pt-3 pb-12 space-y-1.5 ${collapsed ? 'px-2' : 'px-4'}`}
        style={{ paddingBottom: 'calc(3rem + env(safe-area-inset-bottom))' }}>
        <Link href="/pricing" title="Plan" className={`flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800 ${collapsed ? 'justify-center' : ''}`}>
          <CreditCard size={13} className="text-zinc-300" />
          {!collapsed && <span className="text-xs text-zinc-300">Plan</span>}
          {!collapsed && profile?.plan && (
            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium capitalize ${PLAN_BADGE[profile.plan]}`}>
              {profile.plan}
            </span>
          )}
        </Link>
        {profile && !collapsed && (
          <div className="flex items-center gap-2 px-2 py-1">
            <User size={13} className="text-zinc-300 shrink-0" />
            <span className="text-xs text-zinc-300 truncate">{profile.displayName}</span>
          </div>
        )}
        <button onClick={handleLogout} title="Sign out" className={`flex items-center gap-2 px-2 py-1.5 w-full rounded-lg hover:bg-zinc-800 text-left ${collapsed ? 'justify-center' : ''}`}>
          <LogOut size={13} className="text-zinc-300" />
          {!collapsed && <span className="text-xs text-zinc-300">Sign out</span>}
        </button>
      </div>
    </aside>
  );
}
