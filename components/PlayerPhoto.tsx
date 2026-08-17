'use client';

import { useState, useEffect } from 'react';

/* Player headshot with a generic-silhouette fallback: used when the feed has
   no photo for a player, the operator didn't upload one, or the URL 404s. */
export default function PlayerPhoto({
  src,
  className = '',
  style,
  tone = 'dark',
}: {
  src?: string;
  className?: string;
  style?: React.CSSProperties;
  tone?: 'dark' | 'light';   // dark backgrounds → white silhouette; light → gray
}) {
  const [err, setErr] = useState(false);
  useEffect(() => { setErr(false); }, [src]);

  if (src && !err) {
    return (
      <img src={src} onError={() => setErr(true)} alt=""
        className={className} style={style} />
    );
  }
  return (
    <div className={`${className} flex items-end justify-center overflow-hidden`} style={style}>
      <svg viewBox="0 0 24 24" fill="currentColor"
        className={`w-[72%] h-[72%] translate-y-[8%] ${tone === 'dark' ? 'text-white/45' : 'text-gray-400'}`}>
        <path d="M12 12.2c2.65 0 4.8-2.15 4.8-4.8S14.65 2.6 12 2.6 7.2 4.75 7.2 7.4s2.15 4.8 4.8 4.8zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2h19.2v-2c0-3.2-6.4-4.8-9.6-4.8z" />
      </svg>
    </div>
  );
}
