'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { NamespaceContext } from '@/hooks/useNamespace';

interface PendingInvite {
  ownerUid: string;
  email: string;
  companyName?: string;
}

export function NamespaceProvider({ children }: { children: React.ReactNode }) {
  const [namespace, setNamespace] = useState<string | null>(null);
  const [pendingInvite, setPendingInvite] = useState<PendingInvite | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async user => {
      if (!user) { setNamespace(null); setPendingInvite(null); return; }

      // Always default to own namespace first
      setNamespace(user.uid);
      setPendingInvite(null);

      try {
        const encoded = (user.email || '').replace(/[.@]/g, '_');
        const snap = await getDoc(doc(db, 'invites', encoded));
        if (!snap.exists()) return;

        const data = snap.data();
        if (data.accepted === true) {
          // Previously accepted — auto-switch to owner workspace
          setNamespace(data.ownerUid);
        } else {
          // Pending invite — show banner, user decides
          setPendingInvite({
            ownerUid: data.ownerUid,
            email: user.email || '',
            companyName: data.companyName || '',
          });
        }
      } catch {
        // Keep own namespace on any error
      }
    });
  }, []);

  const acceptInvite = async () => {
    if (!pendingInvite) return;
    try {
      const encoded = pendingInvite.email.replace(/[.@]/g, '_');
      await setDoc(doc(db, 'invites', encoded), { accepted: true }, { merge: true });
      setNamespace(pendingInvite.ownerUid);
      setPendingInvite(null);
    } catch (e) {
      console.error('Failed to accept invite', e);
    }
  };

  const dismissInvite = () => setPendingInvite(null);

  return (
    <NamespaceContext.Provider value={namespace}>
      {pendingInvite && (
        <div className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-center gap-3 px-4 py-2.5 text-sm text-white shadow-lg"
          style={{ backgroundColor: '#1d4ed8' }}>
          <span>
            You have a pending invitation to join
            {pendingInvite.companyName ? ` ${pendingInvite.companyName}'s` : ' a'} workspace.
          </span>
          <button
            onClick={acceptInvite}
            className="shrink-0 bg-white text-blue-700 px-3 py-1 rounded-lg font-semibold text-xs hover:bg-blue-50 transition-colors"
          >
            Accept &amp; Switch
          </button>
          <button
            onClick={dismissInvite}
            className="shrink-0 text-blue-200 hover:text-white text-xs transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}
      {children}
    </NamespaceContext.Provider>
  );
}
