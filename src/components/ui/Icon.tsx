import type { ReactNode } from 'react';

/**
 * Ícones no estilo Lucide (grade 24, traço 2). Mantidos localmente para evitar dependência;
 * trocar por `lucide-react` exige apenas substituir este componente.
 */
export type IconName =
  | 'play' | 'pause' | 'stop' | 'back5' | 'forward5' | 'volume' | 'volume-low' | 'volume-x'
  | 'maximize' | 'minimize' | 'repeat' | 'plus' | 'trash' | 'pencil' | 'star' | 'star-filled'
  | 'music' | 'video' | 'upload' | 'download' | 'search' | 'x' | 'check' | 'chevron-up' | 'chevron-down'
  | 'arrow-up' | 'arrow-down' | 'folder' | 'tag' | 'bookmark' | 'timer' | 'alert' | 'keyboard'
  | 'eraser' | 'library' | 'minus' | 'rotate-ccw' | 'headphones' | 'file';

const P = (d: string, key?: string) => <path key={key ?? d} d={d} />;

const ICONS: Record<IconName, ReactNode> = {
  play: <polygon points="7 4 20 12 7 20 7 4" fill="currentColor" />,
  pause: (
    <>
      <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" />
      <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" />
    </>
  ),
  stop: <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />,
  back5: (
    <>
      {P('M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8')}
      {P('M3 3v5h5')}
      <text x="12" y="15.5" fontSize="8.5" fontWeight="700" textAnchor="middle" fill="currentColor" stroke="none">5</text>
    </>
  ),
  forward5: (
    <>
      {P('M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8')}
      {P('M21 3v5h-5')}
      <text x="12" y="15.5" fontSize="8.5" fontWeight="700" textAnchor="middle" fill="currentColor" stroke="none">5</text>
    </>
  ),
  volume: (
    <>
      {P('M11 5 6 9H2v6h4l5 4V5z')}
      {P('M15.54 8.46a5 5 0 0 1 0 7.07')}
      {P('M19.07 4.93a10 10 0 0 1 0 14.14')}
    </>
  ),
  'volume-low': (
    <>
      {P('M11 5 6 9H2v6h4l5 4V5z')}
      {P('M15.54 8.46a5 5 0 0 1 0 7.07')}
    </>
  ),
  'volume-x': (
    <>
      {P('M11 5 6 9H2v6h4l5 4V5z')}
      {P('m22 9-6 6')}
      {P('m16 9 6 6')}
    </>
  ),
  maximize: (
    <>
      {P('M8 3H5a2 2 0 0 0-2 2v3')}
      {P('M21 8V5a2 2 0 0 0-2-2h-3')}
      {P('M3 16v3a2 2 0 0 0 2 2h3')}
      {P('M16 21h3a2 2 0 0 0 2-2v-3')}
    </>
  ),
  minimize: (
    <>
      {P('M8 3v3a2 2 0 0 1-2 2H3')}
      {P('M21 8h-3a2 2 0 0 1-2-2V3')}
      {P('M3 16h3a2 2 0 0 1 2 2v3')}
      {P('M16 21v-3a2 2 0 0 1 2-2h3')}
    </>
  ),
  repeat: (
    <>
      {P('m17 2 4 4-4 4')}
      {P('M3 11v-1a4 4 0 0 1 4-4h14')}
      {P('m7 22-4-4 4-4')}
      {P('M21 13v1a4 4 0 0 1-4 4H3')}
    </>
  ),
  plus: (
    <>
      {P('M5 12h14')}
      {P('M12 5v14')}
    </>
  ),
  minus: P('M5 12h14'),
  trash: (
    <>
      {P('M3 6h18')}
      {P('M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6')}
      {P('M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2')}
    </>
  ),
  pencil: (
    <>
      {P('M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z')}
      {P('m15 5 4 4')}
    </>
  ),
  star: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />,
  'star-filled': <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor" />,
  music: (
    <>
      {P('M9 18V5l12-2v13')}
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </>
  ),
  video: (
    <>
      {P('m16 13 5.22 3.48a.5.5 0 0 0 .78-.42V7.87a.5.5 0 0 0-.75-.43L16 10.5')}
      <rect x="2" y="6" width="14" height="12" rx="2" />
    </>
  ),
  upload: (
    <>
      {P('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4')}
      {P('m17 8-5-5-5 5')}
      {P('M12 3v12')}
    </>
  ),
  download: (
    <>
      {P('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4')}
      {P('m7 10 5 5 5-5')}
      {P('M12 15V3')}
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      {P('m21 21-4.3-4.3')}
    </>
  ),
  x: (
    <>
      {P('M18 6 6 18')}
      {P('m6 6 12 12')}
    </>
  ),
  check: P('M20 6 9 17l-5-5'),
  'chevron-up': P('m18 15-6-6-6 6'),
  'chevron-down': P('m6 9 6 6 6-6'),
  'arrow-up': (
    <>
      {P('m5 12 7-7 7 7')}
      {P('M12 19V5')}
    </>
  ),
  'arrow-down': (
    <>
      {P('M12 5v14')}
      {P('m19 12-7 7-7-7')}
    </>
  ),
  folder: P('M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z'),
  tag: (
    <>
      {P('M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.42l8.7 8.7a2.43 2.43 0 0 0 3.42 0l6.58-6.58a2.43 2.43 0 0 0 0-3.42z')}
      <circle cx="7.5" cy="7.5" r=".6" fill="currentColor" />
    </>
  ),
  bookmark: P('m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z'),
  timer: (
    <>
      {P('M10 2h4')}
      {P('m12 14 3-3')}
      <circle cx="12" cy="14" r="8" />
    </>
  ),
  alert: (
    <>
      {P('m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3')}
      {P('M12 9v4')}
      {P('M12 17h.01')}
    </>
  ),
  keyboard: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      {P('M6 8h.01')}
      {P('M10 8h.01')}
      {P('M14 8h.01')}
      {P('M18 8h.01')}
      {P('M8 12h.01')}
      {P('M12 12h.01')}
      {P('M16 12h.01')}
      {P('M7 16h10')}
    </>
  ),
  eraser: (
    <>
      {P('m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21')}
      {P('M22 21H7')}
      {P('m5 11 9 9')}
    </>
  ),
  library: (
    <>
      {P('m16 6 4 14')}
      {P('M12 6v14')}
      {P('M8 8v12')}
      {P('M4 4v16')}
    </>
  ),
  'rotate-ccw': (
    <>
      {P('M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8')}
      {P('M3 3v5h5')}
    </>
  ),
  headphones: P('M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3'),
  file: (
    <>
      {P('M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z')}
      {P('M14 2v6h6')}
    </>
  ),
};

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 20, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[name]}
    </svg>
  );
}
