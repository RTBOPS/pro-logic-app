'use client';

import Link from 'next/link';
import { ArrowUpRight, ClipboardCheck, ClipboardList, Wrench, Archive } from 'lucide-react';
import PageHeader from '@/components/PageHeader';

const FORMS = [
  {
    href: '/equipment/checkout',
    title: 'Equipment Check-Out',
    desc: 'Issue equipment to crew. Records condition, accessories, and requires dual signature.',
    icon: ClipboardList,
    color: 'bg-blue-50 text-blue-600',
  },
  {
    href: '/equipment/return',
    title: 'Equipment Return Inspection',
    desc: 'Inspect returned equipment. Documents condition, functional tests, and any damage found.',
    icon: ClipboardCheck,
    color: 'bg-green-50 text-green-600',
  },
  {
    href: '/equipment/maintenance',
    title: 'Maintenance Report',
    desc: 'Log repair work, replacement parts, and final service status for any asset.',
    icon: Wrench,
    color: 'bg-orange-50 text-orange-600',
  },
  {
    href: '/equipment/retirement',
    title: 'Asset Retirement / Disposal',
    desc: 'Formally retire an asset from inventory, documenting reason and disposition method.',
    icon: Archive,
    color: 'bg-red-50 text-red-600',
  },
];

export default function EquipmentPage() {
  return (
    <div className="p-4 md:p-8">
      <PageHeader title="Equipment Forms" subtitle="Check-out, return inspection, maintenance, and asset retirement" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {FORMS.map(f => (
          <Link key={f.href} href={f.href}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex gap-4 items-start hover:shadow-md transition-shadow group">
            <div className={`p-3 rounded-xl shrink-0 ${f.color}`}>
              <f.icon size={22} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1">
                <h3 className="font-semibold text-gray-900">{f.title}</h3>
                <ArrowUpRight size={14} className="text-gray-400 group-hover:text-gray-700 transition-colors" />
              </div>
              <p className="text-xs text-gray-500 mt-1">{f.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
