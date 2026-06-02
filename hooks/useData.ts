import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function useData(collectionName: string) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, collectionName));
    const unsub = onSnapshot(
      q,
      snap => {
        setData(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      err => {
        console.error(err);
        setLoading(false);
      }
    );
    return unsub;
  }, [collectionName]);

  return { data, loading };
}
