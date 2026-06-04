'use client';

import { useCompany } from '@/hooks/useCompany';

interface Props {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, children }: Props) {
  const company = useCompany();

  return (
    <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
      <div className="flex items-center gap-3">
        {company?.logo_url && (
          <img
            src={company.logo_url}
            alt={company.name || ''}
            className="h-10 w-10 object-contain rounded-lg border border-gray-100 bg-white p-0.5 shrink-0"
          />
        )}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="text-gray-500 text-sm mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
    </div>
  );
}
