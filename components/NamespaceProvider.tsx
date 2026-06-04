'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { NamespaceContext, Workspace } from '@/hooks/useNamespace';

export function NamespaceProvider({ children }: { children: React.ReactNode }) {
  const [ownUid, setOwnUid] = useState<string | null>(null);
  const [namespace, setNamespace] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [pendingInvite, setPendingInvite] = useState<{ ownerUid: string; email: string; companyName: string } | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async user => {
      if (!user) {
        setOwnUid(null); setNamespace(null); setWorkspaces([]); setPendingInvite(null);
        return;
      }
      setOwnUid(user.uid);
      setNamespace(user.uid);
      try {
        const profileSnap = await getDoc(doc(db, 'users', user.uid));
        if (profileSnap.exists()) setWorkspaces(profileSnap.data().workspaces || []);
        const encoded = (user.email || '').replace(/[.@]/g, '_');
        const inviteSnap = await getDoc(doc(db, 'invites', encoded));
        if (inviteSnap.exists()) {
          const d = inviteSnap.data();
          if (!d.accepted) setPendingInvite({ ownerUid: d.ownerUid, email: user.email || '', companyName: d.companyName || '' });
        }
      } catch { /* keep own namespace */ }
    });
  }, []);

  const switchWorkspace = (uid: string) => setNamespace(uid);

  const acceptInvite = async () => {
    if (!pendingInvite || !ownUid) return;
    try {
      const encoded = pendingInvite.email.replace(/[.@]/g, '_');
      await setDoc(doc(db, 'invites', encoded), { accepted: true }, { merge: true });
      const newWs: Workspace = { ownerUid: pendingInvite.ownerUid, companyName: pendingInvite.companyName, role: 'Editor' };
      const updated = [...workspaces.filter(w => w.ownerUid !== pendingInvite.ownerUid), newWs];
      await setDoc(doc(db, 'users', ownUid), { workspaces: updated }, { merge: true });
      setWorkspaces(updated); setPendingInvite(null);
    } catch (e) { console.error('acceptInvite failed', e); }
  };

  return (
    <NamespaceContext.Provider value={{ namespace, ownUid, workspaces, switchWorkspace }}>
      {pendingInvite && (
        <div className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-center gap-3 px-4 py-2.5 text-sm text-white shadow-lg bg-blue-700">
          <span>You have been invited to access <strong>{pendingInvite.companyName}</strong>'s workspace.</span>
          <button onClick={acceptInvite} className="bg-white text-blue-700 px-3 py-1 rounded-lg font-semibold text-xs">Accept</button>
          <button onClick={() => setPendingInvite(null)} className="text-blue-200 hover:text-white text-xs">Dismiss</button>
        </div>
      )}
      {children}
    </NamespaceContext.Provider>
  );
}
