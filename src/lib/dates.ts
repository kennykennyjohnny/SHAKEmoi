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
