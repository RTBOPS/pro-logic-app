'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { seedSampleData } from '@/lib/sample-data';
import { auth, db } from '@/lib/firebase';

// 'pro' is the legacy name of the old $29 all-in plan; it ranks like broadcast.
export type Plan = 'free' | 'producer' | 'pro' | 'broadcast' | 'studio';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  plan: Plan;
  createdAt: string;
  referredBy?: string;
  event_pass_until?: string;
  [key: string]: any;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async firebaseUser => {
      setUser(firebaseUser);
      try {
        if (firebaseUser) {
          const ref = doc(db, 'users', firebaseUser.uid);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            setProfile(snap.data() as UserProfile);
          } else {
            let referredBy: string | undefined;
            try {
              const r = JSON.parse(localStorage.getItem('plg_ref') || 'null');
              if (r?.code && Date.now() - (r.at || 0) < 30 * 86400000) referredBy = r.code;
            } catch {}
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
              plan: 'free',
              createdAt: new Date().toISOString(),
              hasSampleData: true,
              ...(referredBy ? { referredBy } : {}),
            };
            await setDoc(ref, newProfile);
            // A populated app sells itself — every new account starts with a
            // sample production they can remove in one click.
            try { await seedSampleData(firebaseUser.uid); } catch {}
            if (referredBy) {
              try {
                await setDoc(doc(db, 'affiliates', referredBy, 'referrals', firebaseUser.uid), {
                  uid: firebaseUser.uid,
                  name: newProfile.displayName,
                  at: new Date().toISOString(),
                });
              } catch {}
            }
            setProfile(newProfile);
          }
        } else {
          setProfile(null);
        }
      } catch (e) {
        console.error('useAuth profile load failed:', e);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  return { user, profile, loading };
}
