'use client';

import { createContext, useContext } from 'react';

// Provides the effective Firestore namespace UID.
// For regular users this equals their own UID.
// For team members invited by another user this equals the owner's UID.
export const NamespaceContext = createContext<string | null>(null);

export function useNamespace(): string | null {
  return useContext(NamespaceContext);
}
