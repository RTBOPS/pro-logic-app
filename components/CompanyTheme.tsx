'use client';

import { useEffect } from 'react';
import { useCompany } from '@/hooks/useCompany';

export default function CompanyTheme() {
  const company = useCompany();

  useEffect(() => {
    const root = document.documentElement;
    const primary = company?.primary_color || '#18181b';   // zinc-900
    const secondary = company?.secondary_color || '#ffffff';

    // Parse hex to RGB for rgba() support
    const hexToRgb = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `${r} ${g} ${b}`;
    };

    try {
      root.style.setProperty('--brand-primary', primary);
      root.style.setProperty('--brand-primary-rgb', hexToRgb(primary));
      root.style.setProperty('--brand-secondary', secondary);
    } catch {}
  }, [company?.primary_color, company?.secondary_color]);

  return null;
}
