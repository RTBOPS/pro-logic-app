/* Concert audio planning catalog.
   Each instrument template expands into the standard inputs a live audio
   director would patch for it: recommended mic or DI, phantom power, stand,
   typical preamp gain range and HPF — the starting point of gain structure. */

export type InputType = 'mic' | 'di' | 'line' | 'wireless';

export interface TemplateInput {
  source: string;          // what's being captured (e.g. "Kick In")
  mic: string;             // recommended transducer or DI
  type: InputType;
  phantom: boolean;        // +48V required
  stand: string;           // short boom, tall boom, clip, none…
  gain: string;            // typical preamp gain range
  hpf: string;             // recommended high-pass filter
  notes?: string;
}

export interface InstrumentTemplate {
  id: string;
  label: string;
  category: string;
  keywords: string[];      // EN/ES rider keywords for the parser
  inputs: TemplateInput[];
}

export const AUDIO_CATEGORIES = [
  'Drums', 'Percussion', 'Bass', 'Guitars', 'Keys & Playback',
  'Vocals', 'Horns', 'Strings', 'DJ & Electronic', 'Sports Broadcast', 'Utility',
];

export const INSTRUMENT_TEMPLATES: InstrumentTemplate[] = [
  /* ── Drums ─────────────────────────────────────────────── */
  {
    id: 'drum-kit', label: 'Drum Kit (full)', category: 'Drums',
    keywords: ['drum kit', 'drums', 'drumset', 'drum set', 'bateria', 'batería'],
    inputs: [
      { source: 'Kick In',      mic: 'Shure Beta 91A', type: 'mic', phantom: true,  stand: 'Inside drum',  gain: '15–25 dB', hpf: '30 Hz',  notes: 'Boundary mic on pillow' },
      { source: 'Kick Out',     mic: 'Shure Beta 52A', type: 'mic', phantom: false, stand: 'Short boom',   gain: '20–30 dB', hpf: '30 Hz' },
      { source: 'Snare Top',    mic: 'Shure SM57',     type: 'mic', phantom: false, stand: 'Short boom',   gain: '25–35 dB', hpf: '80 Hz' },
      { source: 'Snare Bottom', mic: 'Shure SM57',     type: 'mic', phantom: false, stand: 'Short boom',   gain: '25–35 dB', hpf: '80 Hz',  notes: 'Flip polarity' },
      { source: 'Hi-Hat',       mic: 'Shure SM81',     type: 'mic', phantom: true,  stand: 'Short boom',   gain: '25–35 dB', hpf: '200 Hz' },
      { source: 'Rack Tom 1',   mic: 'Sennheiser e904', type: 'mic', phantom: false, stand: 'Rim clip',    gain: '20–30 dB', hpf: '60 Hz' },
      { source: 'Rack Tom 2',   mic: 'Sennheiser e904', type: 'mic', phantom: false, stand: 'Rim clip',    gain: '20–30 dB', hpf: '60 Hz' },
      { source: 'Floor Tom',    mic: 'Sennheiser e904', type: 'mic', phantom: false, stand: 'Rim clip',    gain: '20–30 dB', hpf: '50 Hz' },
      { source: 'Overhead L',   mic: 'Shure KSM137',   type: 'mic', phantom: true,  stand: 'Tall boom',    gain: '25–40 dB', hpf: '100 Hz', notes: 'Pair with OH R' },
      { source: 'Overhead R',   mic: 'Shure KSM137',   type: 'mic', phantom: true,  stand: 'Tall boom',    gain: '25–40 dB', hpf: '100 Hz' },
    ],
  },
  {
    id: 'drum-kit-compact', label: 'Drum Kit (compact 4-mic)', category: 'Drums',
    keywords: ['compact drums', 'bateria compacta', 'jazz drums'],
    inputs: [
      { source: 'Kick',       mic: 'Shure Beta 52A', type: 'mic', phantom: false, stand: 'Short boom', gain: '20–30 dB', hpf: '30 Hz' },
      { source: 'Snare',      mic: 'Shure SM57',     type: 'mic', phantom: false, stand: 'Short boom', gain: '25–35 dB', hpf: '80 Hz' },
      { source: 'Overhead L', mic: 'Shure KSM137',   type: 'mic', phantom: true,  stand: 'Tall boom',  gain: '25–40 dB', hpf: '100 Hz' },
      { source: 'Overhead R', mic: 'Shure KSM137',   type: 'mic', phantom: true,  stand: 'Tall boom',  gain: '25–40 dB', hpf: '100 Hz' },
    ],
  },
  {
    id: 'e-drums', label: 'Electronic Drums', category: 'Drums',
    keywords: ['electronic drums', 'e-drums', 'edrums', 'bateria electronica', 'batería electrónica', 'spd'],
    inputs: [
      { source: 'E-Drums L', mic: 'Radial ProD2 (DI)', type: 'di', phantom: false, stand: 'None', gain: '0–10 dB', hpf: 'Off', notes: 'Stereo pair L' },
      { source: 'E-Drums R', mic: 'Radial ProD2 (DI)', type: 'di', phantom: false, stand: 'None', gain: '0–10 dB', hpf: 'Off', notes: 'Stereo pair R' },
    ],
  },

  /* ── Percussion ────────────────────────────────────────── */
  {
    id: 'congas', label: 'Congas (pair)', category: 'Percussion',
    keywords: ['congas', 'conga'],
    inputs: [
      { source: 'Conga Hi', mic: 'Sennheiser e904', type: 'mic', phantom: false, stand: 'Rim clip', gain: '20–30 dB', hpf: '80 Hz' },
      { source: 'Conga Lo', mic: 'Sennheiser e904', type: 'mic', phantom: false, stand: 'Rim clip', gain: '20–30 dB', hpf: '80 Hz' },
    ],
  },
  {
    id: 'timbales', label: 'Timbales', category: 'Percussion',
    keywords: ['timbales', 'timbal'],
    inputs: [
      { source: 'Timbales', mic: 'Shure SM57', type: 'mic', phantom: false, stand: 'Short boom', gain: '20–30 dB', hpf: '100 Hz' },
    ],
  },
  {
    id: 'bongos', label: 'Bongos', category: 'Percussion',
    keywords: ['bongos', 'bongo', 'bongó'],
    inputs: [
      { source: 'Bongos', mic: 'Shure SM57', type: 'mic', phantom: false, stand: 'Short boom', gain: '25–35 dB', hpf: '100 Hz' },
    ],
  },
  {
    id: 'cajon', label: 'Cajón', category: 'Percussion',
    keywords: ['cajon', 'cajón'],
    inputs: [
      { source: 'Cajón In',   mic: 'Shure Beta 91A', type: 'mic', phantom: true,  stand: 'Inside',     gain: '20–30 dB', hpf: '40 Hz' },
      { source: 'Cajón Front', mic: 'Shure SM57',    type: 'mic', phantom: false, stand: 'Short boom', gain: '25–35 dB', hpf: '60 Hz' },
    ],
  },
  {
    id: 'hand-perc', label: 'Hand Percussion (shaker/tamb)', category: 'Percussion',
    keywords: ['shaker', 'tambourine', 'pandereta', 'percusion menor', 'percusión menor', 'guiro', 'güiro', 'maracas'],
    inputs: [
      { source: 'Hand Perc', mic: 'Shure KSM137', type: 'mic', phantom: true, stand: 'Tall boom', gain: '30–40 dB', hpf: '150 Hz' },
    ],
  },

  /* ── Bass ──────────────────────────────────────────────── */
  {
    id: 'bass-di', label: 'Bass (DI + cab mic)', category: 'Bass',
    keywords: ['bass', 'bajo', 'bass guitar', 'bajo electrico', 'bajo eléctrico'],
    inputs: [
      { source: 'Bass DI',  mic: 'Radial J48 (DI)',  type: 'di',  phantom: true,  stand: 'None',       gain: '10–20 dB', hpf: 'Off',   notes: 'Active DI — converts Hi-Z to mic level' },
      { source: 'Bass Cab', mic: 'Shure Beta 52A',   type: 'mic', phantom: false, stand: 'Short boom', gain: '15–25 dB', hpf: '40 Hz' },
    ],
  },
  {
    id: 'upright-bass', label: 'Upright Bass', category: 'Bass',
    keywords: ['upright bass', 'double bass', 'contrabajo'],
    inputs: [
      { source: 'Upright Bass', mic: 'DPA 4099 (clip)', type: 'mic', phantom: true, stand: 'Clip', gain: '25–35 dB', hpf: '50 Hz', notes: 'Clip near f-hole; DI if pickup fitted' },
    ],
  },

  /* ── Guitars ───────────────────────────────────────────── */
  {
    id: 'electric-guitar', label: 'Electric Guitar (cab)', category: 'Guitars',
    keywords: ['electric guitar', 'guitarra electrica', 'guitarra eléctrica', 'guitar amp', 'gtr'],
    inputs: [
      { source: 'E. Gtr Cab', mic: 'Shure SM57', type: 'mic', phantom: false, stand: 'Short boom', gain: '15–25 dB', hpf: '80 Hz', notes: 'Alt: Sennheiser e906' },
    ],
  },
  {
    id: 'acoustic-guitar', label: 'Acoustic Guitar (DI)', category: 'Guitars',
    keywords: ['acoustic guitar', 'guitarra acustica', 'guitarra acústica', 'acustica', 'acústica'],
    inputs: [
      { source: 'Ac. Gtr DI', mic: 'Radial J48 (DI)', type: 'di', phantom: true, stand: 'None', gain: '15–25 dB', hpf: '80 Hz', notes: 'Piezo pickup is Hi-Z — needs active DI' },
    ],
  },
  {
    id: 'guitar-modeler', label: 'Guitar Modeler (Kemper/Helix)', category: 'Guitars',
    keywords: ['kemper', 'helix', 'axe-fx', 'fractal', 'modeler', 'quad cortex'],
    inputs: [
      { source: 'Modeler L', mic: 'XLR Line', type: 'line', phantom: false, stand: 'None', gain: '0–10 dB', hpf: 'Off', notes: 'Line level +4 dBu' },
      { source: 'Modeler R', mic: 'XLR Line', type: 'line', phantom: false, stand: 'None', gain: '0–10 dB', hpf: 'Off' },
    ],
  },

  /* ── Keys & Playback ───────────────────────────────────── */
  {
    id: 'keys-stereo', label: 'Keyboard (stereo DI)', category: 'Keys & Playback',
    keywords: ['keyboard', 'keys', 'teclado', 'piano electrico', 'piano eléctrico', 'nord', 'synth', 'sintetizador'],
    inputs: [
      { source: 'Keys L', mic: 'Radial ProD2 (DI)', type: 'di', phantom: false, stand: 'None', gain: '5–15 dB', hpf: 'Off', notes: 'Passive stereo DI' },
      { source: 'Keys R', mic: 'Radial ProD2 (DI)', type: 'di', phantom: false, stand: 'None', gain: '5–15 dB', hpf: 'Off' },
    ],
  },
  {
    id: 'grand-piano', label: 'Grand Piano', category: 'Keys & Playback',
    keywords: ['grand piano', 'piano de cola', 'piano acustico', 'piano acústico'],
    inputs: [
      { source: 'Piano Lo', mic: 'Shure KSM137', type: 'mic', phantom: true, stand: 'Inside lid', gain: '25–35 dB', hpf: '60 Hz' },
      { source: 'Piano Hi', mic: 'Shure KSM137', type: 'mic', phantom: true, stand: 'Inside lid', gain: '25–35 dB', hpf: '60 Hz' },
    ],
  },
  {
    id: 'playback', label: 'Playback / Tracks (stereo)', category: 'Keys & Playback',
    keywords: ['playback', 'tracks', 'secuencias', 'pistas', 'backing tracks', 'ableton', 'laptop'],
    inputs: [
      { source: 'Tracks L', mic: 'Radial ProD2 (DI)', type: 'di', phantom: false, stand: 'None', gain: '0–10 dB', hpf: 'Off', notes: 'From playback rig' },
      { source: 'Tracks R', mic: 'Radial ProD2 (DI)', type: 'di', phantom: false, stand: 'None', gain: '0–10 dB', hpf: 'Off' },
      { source: 'Click',    mic: 'Radial ProDI (DI)', type: 'di', phantom: false, stand: 'None', gain: '0–10 dB', hpf: 'Off', notes: 'To monitors only — NEVER to PA' },
    ],
  },

  /* ── Vocals ────────────────────────────────────────────── */
  {
    id: 'lead-vocal-wireless', label: 'Lead Vocal (wireless)', category: 'Vocals',
    keywords: ['lead vocal', 'lead singer', 'voz principal', 'cantante', 'vocalista', 'wireless mic', 'microfono inalambrico', 'micrófono inalámbrico'],
    inputs: [
      { source: 'Lead Vox (RF)', mic: 'Shure ULXD2/KSM9', type: 'wireless', phantom: false, stand: 'Straight + clip', gain: '20–30 dB', hpf: '100 Hz', notes: 'Add to RF worksheet' },
    ],
  },
  {
    id: 'lead-vocal-wired', label: 'Lead Vocal (wired)', category: 'Vocals',
    keywords: ['wired vocal', 'voz alambrica', 'voz alámbrica'],
    inputs: [
      { source: 'Lead Vox', mic: 'Shure Beta 58A', type: 'mic', phantom: false, stand: 'Straight + clip', gain: '25–35 dB', hpf: '100 Hz' },
    ],
  },
  {
    id: 'backing-vocals', label: 'Backing Vocal', category: 'Vocals',
    keywords: ['backing vocals', 'coros', 'bgv', 'backup vocals', 'coristas'],
    inputs: [
      { source: 'BGV', mic: 'Shure SM58', type: 'mic', phantom: false, stand: 'Straight + clip', gain: '25–35 dB', hpf: '120 Hz' },
    ],
  },
  {
    id: 'headset-vocal', label: 'Headset / Lavalier (wireless)', category: 'Vocals',
    keywords: ['headset', 'diadema', 'lavalier', 'lav', 'solapa'],
    inputs: [
      { source: 'Headset (RF)', mic: 'DPA 4088 + bodypack', type: 'wireless', phantom: false, stand: 'None', gain: '30–40 dB', hpf: '120 Hz', notes: 'Add to RF worksheet' },
    ],
  },
  {
    id: 'speech-podium', label: 'Podium / MC Mic', category: 'Vocals',
    keywords: ['podium', 'atril', 'mc', 'maestro de ceremonias', 'speech', 'discurso', 'presentador'],
    inputs: [
      { source: 'Podium', mic: 'Shure MX418 (gooseneck)', type: 'mic', phantom: true, stand: 'Podium', gain: '30–40 dB', hpf: '120 Hz' },
    ],
  },

  /* ── Horns ─────────────────────────────────────────────── */
  {
    id: 'trumpet', label: 'Trumpet', category: 'Horns',
    keywords: ['trumpet', 'trompeta'],
    inputs: [
      { source: 'Trumpet', mic: 'Shure SM57', type: 'mic', phantom: false, stand: 'Tall boom', gain: '15–25 dB', hpf: '100 Hz', notes: 'Alt: ATM350 clip' },
    ],
  },
  {
    id: 'sax', label: 'Saxophone', category: 'Horns',
    keywords: ['sax', 'saxophone', 'saxofon', 'saxofón'],
    inputs: [
      { source: 'Sax', mic: 'Sennheiser e908 (clip)', type: 'mic', phantom: true, stand: 'Bell clip', gain: '20–30 dB', hpf: '80 Hz' },
    ],
  },
  {
    id: 'trombone', label: 'Trombone', category: 'Horns',
    keywords: ['trombone', 'trombon', 'trombón'],
    inputs: [
      { source: 'Trombone', mic: 'Shure SM57', type: 'mic', phantom: false, stand: 'Tall boom', gain: '15–25 dB', hpf: '80 Hz' },
    ],
  },

  /* ── Strings ───────────────────────────────────────────── */
  {
    id: 'violin', label: 'Violin', category: 'Strings',
    keywords: ['violin', 'violín'],
    inputs: [
      { source: 'Violin', mic: 'DPA 4099 (clip)', type: 'mic', phantom: true, stand: 'Clip', gain: '30–40 dB', hpf: '120 Hz' },
    ],
  },
  {
    id: 'cello', label: 'Cello', category: 'Strings',
    keywords: ['cello', 'chelo', 'violonchelo'],
    inputs: [
      { source: 'Cello', mic: 'DPA 4099 (clip)', type: 'mic', phantom: true, stand: 'Clip', gain: '25–35 dB', hpf: '60 Hz' },
    ],
  },

  /* ── DJ & Electronic ───────────────────────────────────── */
  {
    id: 'dj-booth', label: 'DJ Booth (stereo)', category: 'DJ & Electronic',
    keywords: ['dj', 'pioneer', 'cdj', 'controlador', 'turntables', 'tornamesas'],
    inputs: [
      { source: 'DJ L', mic: 'Radial ProD2 (DI)', type: 'di', phantom: false, stand: 'None', gain: '0–10 dB', hpf: 'Off', notes: 'Booth master out' },
      { source: 'DJ R', mic: 'Radial ProD2 (DI)', type: 'di', phantom: false, stand: 'None', gain: '0–10 dB', hpf: 'Off' },
    ],
  },

  /* ── Sports Broadcast ──────────────────────────────────── */
  {
    id: 'announcer-pair', label: 'Announcers (pair, headsets)', category: 'Sports Broadcast',
    keywords: ['announcer', 'comentarista', 'comentaristas', 'narrador', 'play-by-play', 'booth', 'cabina'],
    inputs: [
      { source: 'Announcer 1 (PxP)',   mic: 'Sennheiser HMD 26 (headset)', type: 'mic', phantom: false, stand: 'None', gain: '25–35 dB', hpf: '100 Hz', notes: 'IFB return in same headset' },
      { source: 'Announcer 2 (Color)', mic: 'Sennheiser HMD 26 (headset)', type: 'mic', phantom: false, stand: 'None', gain: '25–35 dB', hpf: '100 Hz', notes: 'IFB return in same headset' },
    ],
  },
  {
    id: 'courtside-reporter', label: 'Courtside / Sideline Reporter', category: 'Sports Broadcast',
    keywords: ['sideline', 'courtside', 'reportero', 'reportera', 'cancha reporter'],
    inputs: [
      { source: 'Reporter (RF)', mic: 'Shure Axient HH', type: 'wireless', phantom: false, stand: 'None', gain: '25–35 dB', hpf: '120 Hz', notes: 'Add to RF worksheet; IFB earpiece' },
    ],
  },
  {
    id: 'crowd-pair', label: 'Crowd / Arena Ambience (pair)', category: 'Sports Broadcast',
    keywords: ['crowd', 'ambiente arena', 'publico arena', 'ambience'],
    inputs: [
      { source: 'Crowd L', mic: 'Shure KSM137', type: 'mic', phantom: true, stand: 'Tall boom / hung', gain: '35–45 dB', hpf: '120 Hz', notes: 'Aim at crowd, away from PA' },
      { source: 'Crowd R', mic: 'Shure KSM137', type: 'mic', phantom: true, stand: 'Tall boom / hung', gain: '35–45 dB', hpf: '120 Hz' },
    ],
  },
  {
    id: 'rim-mics', label: 'Rim / Backboard Mics (pair)', category: 'Sports Broadcast',
    keywords: ['rim mic', 'aro', 'tablero', 'canasta mic'],
    inputs: [
      { source: 'Rim Left',  mic: 'DPA 4061 (mounted)', type: 'mic', phantom: true, stand: 'Rim mount', gain: '25–35 dB', hpf: '80 Hz', notes: 'Swish & dunk impact' },
      { source: 'Rim Right', mic: 'DPA 4061 (mounted)', type: 'mic', phantom: true, stand: 'Rim mount', gain: '25–35 dB', hpf: '80 Hz' },
    ],
  },
  {
    id: 'court-effects', label: 'Court Effects (shotgun pair)', category: 'Sports Broadcast',
    keywords: ['court effects', 'efectos cancha', 'sneaker', 'floor mic'],
    inputs: [
      { source: 'Court FX L', mic: 'Sennheiser MKH 416 (shotgun)', type: 'mic', phantom: true, stand: 'Floor low-profile', gain: '30–40 dB', hpf: '100 Hz', notes: 'Sneaker squeaks, ball' },
      { source: 'Court FX R', mic: 'Sennheiser MKH 416 (shotgun)', type: 'mic', phantom: true, stand: 'Floor low-profile', gain: '30–40 dB', hpf: '100 Hz' },
    ],
  },
  {
    id: 'parabolic', label: 'Parabolic Mic (operated)', category: 'Sports Broadcast',
    keywords: ['parabolic', 'parabolica', 'parabólica'],
    inputs: [
      { source: 'Parab', mic: 'Klover MiK 16 (parabolic)', type: 'mic', phantom: true, stand: 'Handheld (operator)', gain: '30–40 dB', hpf: '120 Hz', notes: 'Follows the action' },
    ],
  },
  {
    id: 'pa-feed', label: 'Venue PA / Anthem Feed', category: 'Sports Broadcast',
    keywords: ['pa feed', 'venue feed', 'himno', 'anthem', 'arena audio'],
    inputs: [
      { source: 'Venue PA L', mic: 'XLR Line (from house)', type: 'line', phantom: false, stand: 'None', gain: '0–10 dB', hpf: 'Off', notes: 'Anthem, arena announcer' },
      { source: 'Venue PA R', mic: 'XLR Line (from house)', type: 'line', phantom: false, stand: 'None', gain: '0–10 dB', hpf: 'Off' },
    ],
  },

  /* ── Utility ───────────────────────────────────────────── */
  {
    id: 'ambient-pair', label: 'Audience / Ambient Pair', category: 'Utility',
    keywords: ['audience', 'ambient', 'ambiente', 'publico', 'público', 'broadcast'],
    inputs: [
      { source: 'Audience L', mic: 'Shure KSM137', type: 'mic', phantom: true, stand: 'Tall boom', gain: '35–45 dB', hpf: '150 Hz', notes: 'For broadcast/recording' },
      { source: 'Audience R', mic: 'Shure KSM137', type: 'mic', phantom: true, stand: 'Tall boom', gain: '35–45 dB', hpf: '150 Hz' },
    ],
  },
  {
    id: 'talkback', label: 'Talkback (FOH ↔ stage)', category: 'Utility',
    keywords: ['talkback', 'intercom', 'shout'],
    inputs: [
      { source: 'Talkback', mic: 'Shure SM58 (switch)', type: 'mic', phantom: false, stand: 'Straight', gain: '25–35 dB', hpf: '120 Hz', notes: 'To monitors only' },
    ],
  },
  {
    id: 'spare-vocal', label: 'Spare Vocal Mic', category: 'Utility',
    keywords: ['spare', 'respaldo', 'backup mic'],
    inputs: [
      { source: 'Spare Vox', mic: 'Shure SM58', type: 'mic', phantom: false, stand: 'Straight + clip', gain: '25–35 dB', hpf: '100 Hz', notes: 'Patched & tested, muted' },
    ],
  },
];

/* ── Rider parser ──────────────────────────────────────────
   Scans pasted technical-rider text (EN/ES) and returns the matching
   instrument templates with their quantities, e.g. "2x guitarra eléctrica". */
export function parseRider(text: string): { template: InstrumentTemplate; qty: number }[] {
  const lower = text.toLowerCase();
  const found: { template: InstrumentTemplate; qty: number }[] = [];

  for (const template of INSTRUMENT_TEMPLATES) {
    let best = 0;
    for (const kw of template.keywords) {
      const idx = lower.indexOf(kw);
      if (idx === -1) continue;
      // Look for a quantity right before or after the keyword on the SAME line:
      // "2x kw", "kw x2", "2 kw" — [ \t] so a qty on the previous line never bleeds in
      const before = lower.slice(Math.max(0, idx - 8), idx);
      const after = lower.slice(idx + kw.length, idx + kw.length + 8);
      const qtyMatch = before.match(/(\d+)[ \t]*x?[ \t]*$/) || after.match(/^[ \t]*x[ \t]*(\d+)/);
      const qty = qtyMatch ? Math.min(parseInt(qtyMatch[1], 10) || 1, 12) : 1;
      best = Math.max(best, qty);
    }
    if (best > 0) found.push({ template, qty: best });
  }
  return found;
}

/* Console size recommendation from total input count */
export function consoleRecommendation(channels: number): string {
  if (channels <= 12) return '16-channel console (e.g. Behringer X32 Compact, A&H SQ-5)';
  if (channels <= 24) return '32-channel console (e.g. Behringer X32, A&H SQ-6, Yamaha TF3)';
  if (channels <= 40) return '48-channel console (e.g. A&H SQ-7, Yamaha CL3, DiGiCo S21)';
  if (channels <= 56) return '64-channel console (e.g. Yamaha CL5, DiGiCo S31, Avid S6L-24)';
  return '96+ channel console / dual-console setup (e.g. DiGiCo SD7, Avid S6L-48)';
}
