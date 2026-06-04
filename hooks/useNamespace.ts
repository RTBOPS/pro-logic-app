'use client';

import { createContext, useContext } from 'react';

export interface Workspace {
  ownerUid: string;
  companyName: string;
  role: string;
}

export interface NamespaceContextValue {
  namespace: string | null;      // active workspace UID
  ownUid: string | null;         // always the logged-in user's own UID
  workspaces: Workspace[];       // additional workspaces they have access to
  switchWorkspace: (uid: string) => void;
}

export const NamespaceContext = createContext<NamespaceContextValue>({
  namespace: null,
  ownUid: null,
  workspaces: [],
  switchWorkspace: () => {},
});

// Backward-compatible hook — just returns the active namespace string
export function useNamespace(): string | null {
  return useContext(NamespaceContext).namespace;
}

// Full hook for components that need workspace switching
export function useWorkspaces(): NamespaceContextValue {
  return useContext(NamespaceContext);
}
