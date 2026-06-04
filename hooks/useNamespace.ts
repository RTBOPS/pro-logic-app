'use client';

import { createContext, useContext } from 'react';
import { auth } from '@/lib/firebase';

export interface Workspace {
  ownerUid: string;
  companyName: string;
  role: string;
}

export interface NamespaceContextValue {
  namespace: string | null;
  ownUid: string | null;
  workspaces: Workspace[];
  switchWorkspace: (uid: string) => void;
}

export const NamespaceContext = createContext<NamespaceContextValue>({
  namespace: null,
  ownUid: null,
  workspaces: [],
  switchWorkspace: () => {},
});

// Returns the active namespace — always falls back to the current Firebase
// user's UID so it is never null for a logged-in user.
export function useNamespace(): string | null {
  const ctx = useContext(NamespaceContext);
  return ctx.namespace ?? auth.currentUser?.uid ?? null;
}

// Full context for workspace switching UI
export function useWorkspaces(): NamespaceContextValue {
  return useContext(NamespaceContext);
}
