'use client';

export default function LoadingOverlay({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <img src="/logo.png" alt="PRO-LOGIC" className="h-10 object-contain animate-pulse" />
        <div className="w-48 h-1 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-gray-900 rounded-full animate-[loading_1.4s_ease-in-out_infinite]" style={{ width: '40%' }} />
        </div>
        <p className="text-xs text-gray-500 tracking-wide">{message}</p>
      </div>
      <style>{`
        @keyframes loading {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(150%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}
