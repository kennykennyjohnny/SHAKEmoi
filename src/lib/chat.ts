// Petits utilitaires partagés par la messagerie (privée et cercles).

/** Aperçu du dernier message d'un cercle dans les listes (téléphone + ordinateur). */
export function circlePreviewText(circle: any, myId?: string): string {
  const m = circle?.last_message;
  if (!m) return circle?.member_count ? `${circle.member_count} membre${circle.member_count > 1 ? 's' : ''}` : 'Cercle privé';
  const who = m.sender_id === myId ? 'Toi' : m.sender_username ? `@${m.sender_username}` : '';
  if (m.kind === 'rename') return `${who || 'Quelqu\'un'} a renommé le cercle`;
  const body = m.track_name ? `🎵 ${m.track_name}` : m.image_url ? '📷 Photo' : (m.text || '');
  return who ? `${who} : ${body}` : body;
}
