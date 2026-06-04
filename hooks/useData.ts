import { useEffect, useState } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useNamespace } from '@/hooks/useNamespace';

export function useData(collectionPath: string) {
  const namespace = useNamespace();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Inside useEffect = client only, safe to read auth.currentUser
    const ns = namespace ?? auth.currentUser?.uid ?? null;
    if (!ns) { setData([]); setLoading(true); return; }
    const q = query(collection(db, `users/${ns}/${collectionPath}`));
    const unsub = onSnapshot(
      q,
      snap => {
        setData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      err => {
        console.error('useData error:', err);
        setLoading(false);
      }
    );
    return unsub;
  }, [collectionPath, namespace]);

  return { data, loading };
}
