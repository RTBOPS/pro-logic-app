'use client';

import { createContext, useContext } from 'react';

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

export function useNamespace(): string | null {
  return useContext(NamespaceContext).namespace;
}

export function useWorkspaces(): NamespaceContextValue {
  return useContext(NamespaceContext);
}
