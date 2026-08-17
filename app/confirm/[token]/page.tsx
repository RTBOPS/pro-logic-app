'use client';

import { useEffect, useState, use } from 'react';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CheckCircle, XCircle } from 'lucide-react';

export default function ConfirmPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [status, setStatus] = useState<'loading' | 'found' | 'not_found' | 'done'>('loading');
  const [assignment, setAssignment] = useState<any>(null);
  const [assignDocPath, setAssignDocPath] = useState<string | null>(null);
  const [responding, setResponding] = useState(false);

  useEffect(() => {
    const find = async () => {
      try {
        // Look up the token in the top-level confirm_tokens collection (no auth needed)
        const tokenSnap = await getDoc(doc(db, 'confirm_tokens', token));

        if (!tokenSnap.exists()) {
          setStatus('not_found');
          return;
        }

        const data = tokenSnap.data();
        const { uid, productionId, crewAssignId } = data;
        const crewPath = `users/${uid}/productions/${productionId}/crew/${crewAssignId}`;

        // New tokens carry a snapshot — no reads into users/{uid}/… needed
        if (data.snapshot) {
          setAssignment(data.snapshot);
          setAssignDocPath(crewPath);
          setStatus('found');
          return;
        }

        // Legacy tokens: live reads (require the owner to be signed in)
        const crewSnap = await getDoc(doc(db, crewPath));

        if (!crewSnap.exists()) {
          setStatus('not_found');
          return;
        }

        // Also load production name
        const prodSnap = await getDoc(doc(db, `users/${uid}/productions/${productionId}`));
        const prodData = prodSnap.exists() ? prodSnap.data() : {};

        setAssignment({
          ...crewSnap.data(),
          production_name: prodData.name || '',
          production_client: prodData.client || '',
        });
        setAssignDocPath(crewPath);
        setStatus('found');
      } catch {
        setStatus('not_found');
      }
    };
    find();
  }, [token]);

  const respond = async (answer: 'confirmed' | 'declined') => {
    if (!assignDocPath) return;
    setResponding(true);
    const respondedAt = new Date().toISOString();
    try {
      // Firestore rules allow this specific update (confirmation fields only)
      await updateDoc(doc(db, assignDocPath), {
        confirmation_status: answer,
        responded_at: respondedAt,
      });
      // Keep the public token snapshot in sync for repeat visits
      await setDoc(doc(db, 'confirm_tokens', token), {
        snapshot: { confirmation_status: answer },
        responded_at: respondedAt,
      }, { merge: true }).catch(() => {});
      setStatus('done');
      setAssignment((a: any) => ({ ...a, confirmation_status: answer }));
    } catch {
      alert('Could not record your response. Please try again or contact production.');
    } finally {
      setResponding(false);
    }
  };

  if (status === 'loading') {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-800 rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Looking up your invitation…</p>
        </div>
      </Shell>
    );
  }

  if (status === 'not_found') {
    return (
      <Shell>
        <XCircle size={48} className="text-red-400 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-800">Invitation not found</h1>
        <p className="text-gray-500 mt-2 text-sm">This link may have expired or already been used.</p>
      </Shell>
    );
  }

  if (status === 'done') {
    const confirmed = assignment?.confirmation_status === 'confirmed';
    return (
      <Shell>
        {confirmed
          ? <CheckCircle size={52} className="text-green-500 mx-auto mb-4" />
          : <XCircle size={52} className="text-red-400 mx-auto mb-4" />}
        <h1 className="text-xl font-bold text-gray-800">
          {confirmed ? "You're confirmed!" : 'Response recorded'}
        </h1>
        <p className="text-gray-500 mt-2 text-sm leading-relaxed">
          {confirmed
            ? `You're all set for "${assignment?.production_name}". You'll receive the call sheet closer to the shoot date.`
            : `We've noted your unavailability for "${assignment?.production_name}". Thanks for letting us know.`}
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* Production card */}
      <div className="bg-zinc-900 text-white rounded-2xl p-5 mb-6 text-left w-full">
        <div className="text-xs text-zinc-400 uppercase tracking-widest mb-1.5">Production</div>
        <div className="font-bold text-lg leading-tight">{assignment?.production_name}</div>
        {assignment?.production_client && (
          <div className="text-zinc-400 text-sm mt-0.5">{assignment?.production_client}</div>
        )}
      </div>

      {/* Assignment details */}
      <div className="w-full text-left space-y-2 text-sm mb-6">
        <div className="flex justify-between">
          <span className="text-gray-500">Crew member</span>
          <span className="font-medium text-gray-800">{assignment?.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Role</span>
          <span className="font-medium text-gray-800">{assignment?.role || '—'}</span>
        </div>
        {assignment?.call_time && (
          <div className="flex justify-between">
            <span className="text-gray-500">Call time</span>
            <span className="font-medium text-gray-800">{assignment.call_time}</span>
          </div>
        )}
        {assignment?.confirmation_status && assignment.confirmation_status !== 'pending' && (
          <div className="mt-3 bg-yellow-50 border border-yellow-100 rounded-xl px-3 py-2 text-xs text-yellow-700 text-center">
            You already responded: <strong className="capitalize">{assignment.confirmation_status}</strong>
          </div>
        )}
      </div>

      <p className="text-sm text-gray-500 mb-6 text-center">
        Please confirm your availability for this production:
      </p>

      <div className="flex gap-3 w-full">
        <button
          onClick={() => respond('confirmed')}
          disabled={responding}
          className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-3.5 rounded-2xl font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          <CheckCircle size={18} /> Confirm
        </button>
        <button
          onClick={() => respond('declined')}
          disabled={responding}
          className="flex-1 flex items-center justify-center gap-2 bg-red-50 text-red-600 py-3.5 rounded-2xl font-semibold hover:bg-red-100 disabled:opacity-50 border border-red-200 transition-colors"
        >
          <XCircle size={18} /> Decline
        </button>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-8">
      <div className="bg-white rounded-3xl shadow-xl p-7 w-full max-w-sm text-center">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <img src="/logo.png" alt="PRO-LOGIC" className="h-7 object-contain" />
        </div>
        {children}
      </div>
      <p className="text-xs text-gray-400 mt-5">
        pro-logic.studio · Production Management
      </p>
    </div>
  );
}
