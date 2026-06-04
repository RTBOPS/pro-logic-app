'use client';

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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

let _listeners = 0;
let _data: CompanyProfile | null = null;
const _cbs = new Set<(d: CompanyProfile | null) => void>();

export function useCompany(): CompanyProfile | null {
  const [company, setCompany] = useState<CompanyProfile | null>(_data);

  useEffect(() => {
    _cbs.add(setCompany);
    if (_listeners === 0) {
      _listeners++;
      const unsub = onSnapshot(doc(db, 'company', 'profile'), snap => {
        _data = snap.exists() ? (snap.data() as CompanyProfile) : null;
        _cbs.forEach(cb => cb(_data));
      });
      return () => { unsub(); _listeners = 0; _cbs.delete(setCompany); };
    }
    return () => { _cbs.delete(setCompany); };
  }, []);

  return company;
}
