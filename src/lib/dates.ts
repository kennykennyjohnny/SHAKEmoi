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

/**
 * Date relative, la même partout (fil, notifications, commentaires, profil…) :
 * « À l'instant », « 5min », « 3h », « 2j », puis « 12 sept. » (année si besoin).
 */
export function formatRelative(ts?: string | Date | null): string {
  if (!ts || ts === 'now') return "À l'instant";
  const date = new Date(ts);
  if (isNaN(date.getTime())) return '';
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}j`;
  return date.toLocaleDateString('fr-FR', date.getFullYear() === new Date().getFullYear()
    ? { day: 'numeric', month: 'short' }
    : { day: 'numeric', month: 'short', year: 'numeric' });
}
