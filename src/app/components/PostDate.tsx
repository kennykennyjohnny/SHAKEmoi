// R1 : la date d'un post, partout pareille (formatPostDate). Un toucher montre
// la date complète (« 12 septembre 2025 à 21:14 »), un second la replie ; sur
// ordinateur, elle s'affiche aussi au survol.
import { useState } from 'react';
import { formatPostDate, formatPostDateFull } from '../../lib/dates';

export function PostDate({ ts, prefix = '', className = '' }: { ts?: string | null; prefix?: string; className?: string }) {
  const [full, setFull] = useState(false);
  if (!ts) return null;
  const long = formatPostDateFull(ts);
  const label = full ? long : formatPostDate(ts);
  // « publié le 12 septembre », mais « publié il y a 3 h » / « publié hier ».
  const glue = prefix && /^\d/.test(label) ? 'le ' : '';
  return (
    <button type="button" title={long} aria-label={`${prefix}${prefix ? 'le ' : ''}${long}`}
      onClick={(e) => { e.stopPropagation(); setFull((v) => !v); }}
      onDoubleClick={(e) => e.stopPropagation()}
      className={`inline text-left hover:underline underline-offset-2 ${className}`}>
      <time dateTime={new Date(ts).toISOString()}>{prefix}{glue}{label}</time>
    </button>
  );
}
