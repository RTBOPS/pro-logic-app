'use client';

import { useData } from '@/hooks/useData';
import { Film, Users, Package, MapPin } from 'lucide-react';
import Link from 'next/link';

const STATUS_COLOR: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-600',
};

export default function Dashboard() {
  const { data: productions, loading: lp } = useData('productions');
  const { data: crew, loading: lc } = useData('crew');
  const { data: inventory, loading: li } = useData('inventory');
  const { data: locations } = useData('locations');

  const stats = [
    { label: 'Productions', value: productions.length, icon: Film, href: '/productions', color: 'text-purple-600 bg-purple-50' },
    { label: 'Crew', value: crew.length, icon: Users, href: '/crew', color: 'text-blue-600 bg-blue-50' },
    { label: 'Equipment', value: inventory.length, icon: Package, href: '/inventory', color: 'text-green-600 bg-green-50' },
    { label: 'Locations', value: locations.length, icon: MapPin, href: '/locations', color: 'text-orange-600 bg-orange-50' },
  ];

  const recent = productions.slice(0, 4);

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Overview of your studio operations</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {stats.map(({ label, value, icon: Icon, href, color }) => (
          <Link key={href} href={href}>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer">
              <div className={`inline-flex p-2 rounded-lg mb-3 ${color}`}>
                <Icon size={20} />
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {lp || lc || li ? '—' : value}
              </div>
              <div className="text-sm text-gray-500 mt-0.5">{label}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent productions */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold text-gray-800">Recent Productions</h2>
          <Link href="/productions" className="text-sm text-blue-600 hover:underline">
            View all
          </Link>
        </div>
        {lp ? (
          <div className="p-6 text-gray-400 text-sm">Loading…</div>
        ) : recent.length === 0 ? (
          <div className="p-6 text-gray-400 text-sm">No productions yet.</div>
        ) : (
          <>
          {/* Mobile: cards / Desktop: table */}
          <div className="md:hidden divide-y divide-gray-50">
            {recent.map((p: any) => {
              const loc = locations.find((l: any) => l.id === p.location_id);
              return (
                <Link key={p.id} href={`/productions/${p.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 active:bg-gray-100">
                  <div>
                    <div className="font-medium text-gray-900 text-sm">{p.name}</div>
                    <div className="text-xs text-gray-400">{p.client}{loc?.name ? ` · ${loc.name}` : ''}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize shrink-0 ml-2 ${STATUS_COLOR[p.status] || 'bg-gray-100 text-gray-600'}`}>
                    {p.status}
                  </span>
                </Link>
              );
            })}
          </div>
          <table className="hidden md:table w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-6 py-3">Name</th>
                <th className="text-left px-6 py-3">Client</th>
                <th className="text-left px-6 py-3">Status</th>
                <th className="text-left px-6 py-3">Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recent.map((p: any) => {
                const loc = locations.find((l: any) => l.id === p.location_id);
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">
                      <Link href={`/productions/${p.id}`} className="hover:underline">{p.name}</Link>
                    </td>
                    <td className="px-6 py-3 text-gray-600">{p.client}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLOR[p.status] || 'bg-gray-100 text-gray-600'}`}>{p.status}</span>
                    </td>
                    <td className="px-6 py-3 text-gray-500">{loc?.name || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </>
        )}
      </div>
    </div>
  );
}
