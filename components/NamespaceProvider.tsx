'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { NamespaceContext } from '@/hooks/useNamespace';

export function NamespaceProvider({ children }: { children: React.ReactNode }) {
  const [namespace, setNamespace] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async user => {
      if (!user) { setNamespace(null); return; }
      try {
        const encoded = (user.email || '').replace(/[.@]/g, '_');
        const snap = await getDoc(doc(db, 'invites', encoded));
        setNamespace(snap.exists() ? snap.data().ownerUid : user.uid);
      } catch {
        setNamespace(user.uid);
      }
    });
  }, []);

  return (
    <NamespaceContext.Provider value={namespace}>
      {children}
    </NamespaceContext.Provider>
  );
}
