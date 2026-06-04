'use client';

import { useEffect, useState, use } from 'react';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

export default function ConfirmPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [status, setStatus] = useState<'loading' | 'found' | 'not_found' | 'done'>('loading');
  const [assignment, setAssignment] = useState<any>(null);
  const [docRef, setDocRef] = useState<any>(null);
  const [responding, setResponding] = useState(false);

  useEffect(() => {
    const find = async () => {
      // Search all productions for a crew assignment with this token
      const prodsSnap = await getDocs(collection(db, 'productions'));
      for (const prod of prodsSnap.docs) {
        const crewSnap = await getDocs(
          query(collection(db, 'productions', prod.id, 'crew'), where('confirm_token', '==', token))
        );
        if (!crewSnap.empty) {
          const d = crewSnap.docs[0];
          setAssignment({ ...d.data(), production_name: prod.data().name, production_client: prod.data().client });
          setDocRef(doc(db, 'productions', prod.id, 'crew', d.id));
          setStatus('found');
          return;
        }
      }
      setStatus('not_found');
    };
    find();
  }, [token]);

  const respond = async (answer: 'confirmed' | 'declined') => {
    if (!docRef) return;
    setResponding(true);
    await updateDoc(docRef, {
      confirmation_status: answer,
      responded_at: new Date().toISOString(),
    });
    setStatus('done');
    setAssignment((a: any) => ({ ...a, confirmation_status: answer }));
    setResponding(false);
  };

  if (status === 'loading') {
    return <Shell><p className="text-gray-500">Looking up your invitation…</p></Shell>;
  }

  if (status === 'not_found') {
    return (
      <Shell>
        <XCircle size={48} className="text-red-400 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-800">Invitation not found</h1>
        <p className="text-gray-500 mt-2">This link may have expired or already been used.</p>
      </Shell>
    );
  }

  if (status === 'done') {
    const confirmed = assignment?.confirmation_status === 'confirmed';
    return (
      <Shell>
        {confirmed
          ? <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
          : <XCircle size={48} className="text-red-400 mx-auto mb-4" />}
        <h1 className="text-xl font-bold text-gray-800">
          {confirmed ? 'You\'re confirmed!' : 'Response recorded'}
        </h1>
        <p className="text-gray-500 mt-2">
          {confirmed
            ? `Great! You're confirmed for "${assignment?.production_name}". You'll receive the call sheet closer to the shoot date.`
            : `We've noted your unavailability for "${assignment?.production_name}". Thank you for letting us know.`}
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="text-left w-full max-w-sm">
        <div className="bg-zinc-900 text-white rounded-xl p-4 mb-6">
          <div className="text-xs text-zinc-300 mb-1">Production</div>
          <div className="font-bold text-lg">{assignment?.production_name}</div>
          <div className="text-zinc-300 text-sm">{assignment?.production_client}</div>
        </div>

        <div className="mb-6 space-y-1 text-sm text-gray-600">
          <div><span className="font-medium text-gray-800">Crew member:</span> {assignment?.name}</div>
          <div><span className="font-medium text-gray-800">Role:</span> {assignment?.role || '—'}</div>
          {assignment?.confirmation_status && assignment.confirmation_status !== 'pending' && (
            <div className="mt-3 text-yellow-700 bg-yellow-50 rounded-lg px-3 py-2 text-xs">
              You already responded: <strong>{assignment.confirmation_status}</strong>
            </div>
          )}
        </div>

        <p className="text-sm text-gray-600 mb-6">
          You've been invited to join this production. Please confirm your availability:
        </p>

        <div className="flex gap-3">
          <button
            onClick={() => respond('confirmed')}
            disabled={responding}
            className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-xl font-medium hover:bg-green-700 disabled:opacity-50"
          >
            <CheckCircle size={18} /> Confirm
          </button>
          <button
            onClick={() => respond('declined')}
            disabled={responding}
            className="flex-1 flex items-center justify-center gap-2 bg-red-50 text-red-600 py-3 rounded-xl font-medium hover:bg-red-100 disabled:opacity-50 border border-red-200"
          >
            <XCircle size={18} /> Decline
          </button>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center">
        <div className="text-lg font-bold text-zinc-900 mb-1">PRO-LOGIC</div>
        <div className="text-xs text-zinc-300 mb-6">Studio Management</div>
        {children}
      </div>
    </div>
  );
}
