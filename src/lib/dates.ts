// Dates des messages (C5) : « 14:32 » aujourd'hui, « Hier », « lun. » cette
// semaine, « 12/09 » avant ; séparateurs « Aujourd'hui / Hier / lundi 22 septembre ».

export function isSameDay(a: string | Date, b: string | Date): boolean {
  const x = new Date(a), y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

function daysAgo(ts: string | Date): number {
  const d = new Date(ts); d.setHours(0, 0, 0, 0);
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - d.getTime()) / 86_400_000);
}

export function formatTime(ts: string | Date): string {
  return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/** Heure dans la liste des conversations. */
export function formatListTime(ts?: string | null): string {
  if (!ts) return '';
  const n = daysAgo(ts);
  if (n <= 0) return formatTime(ts);
  if (n === 1) return 'Hier';
  if (n < 7) return new Date(ts).toLocaleDateString('fr-FR', { weekday: 'short' });
  const d = new Date(ts);
  return d.toLocaleDateString('fr-FR', d.getFullYear() === new Date().getFullYear()
    ? { day: '2-digit', month: '2-digit' }
    : { day: '2-digit', month: '2-digit', year: '2-digit' });
}

/** Séparateur de jour dans une conversation. */
export function formatDayLabel(ts: string | Date): string {
  const n = daysAgo(ts);
  if (n <= 0) return 'Aujourd\'hui';
  if (n === 1) return 'Hier';
  const d = new Date(ts);
  const label = d.toLocaleDateString('fr-FR', d.getFullYear() === new Date().getFullYear()
    ? { weekday: 'long', day: 'numeric', month: 'long' }
    : { day: 'numeric', month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** « 12 septembre », ou « 12 septembre 2025 » si ce n'est pas cette année. */
export function formatCalendarDate(ts: string | Date): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', d.getFullYear() === new Date().getFullYear()
    ? { day: 'numeric', month: 'long' }
    : { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * R1 : LA date des posts, la même partout (fil, post, Shakes éphémères,
 * commentaires, notifications, profil, playlists, classement, admin) :
 * « à l'instant », « il y a 5 min », « il y a 3 h », « hier », « il y a 4 j »,
 * puis « 12 septembre » (« 12 septembre 2025 » une autre année).
 * (Les messages gardent leur format d'heure : « 14:32 », « Hier », « lun. ».)
 */
export function formatPostDate(ts?: string | Date | null): string {
  if (!ts || ts === 'now') return "à l'instant";
  const date = new Date(ts);
  if (isNaN(date.getTime())) return '';
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.max(1, daysAgo(date));
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} j`;
  return formatCalendarDate(date);
}

/** Date complète, au toucher : « 12 septembre 2025 à 21:14 ». */
export function formatPostDateFull(ts?: string | Date | null): string {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} à ${formatTime(d)}`;
}
