'use client';

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useNamespace } from '@/hooks/useNamespace';

export interface CompanyProfile {
  name?: string;
  tagline?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  address?: string;
  city?: string;
  state?: string;
  phone?: string;
  email?: string;
  website?: string;
}

export function useCompany(): CompanyProfile | null {
  const namespace = useNamespace();
  const [company, setCompany] = useState<CompanyProfile | null>(null);

  useEffect(() => {
    const ns = namespace ?? auth.currentUser?.uid ?? null;
    if (!ns) return;
    const unsub = onSnapshot(doc(db, 'users', ns, 'company', 'profile'), snap => {
      setCompany(snap.exists() ? (snap.data() as CompanyProfile) : null);
    });
    return unsub;
  }, [namespace]);

  return company;
}
