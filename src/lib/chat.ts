// Petits utilitaires partagés par la messagerie (privée et cercles).

/** Aperçu du dernier message d'un cercle dans les listes (téléphone + ordinateur). */
export function circlePreviewText(circle: any, myId?: string): string {
  const m = circle?.last_message;
  if (!m) return circle?.member_count ? `${circle.member_count} membre${circle.member_count > 1 ? 's' : ''}` : 'Cercle privé';
  const who = m.sender_id === myId ? 'Toi' : m.sender_username ? `@${m.sender_username}` : '';
  if (m.kind === 'rename') return `${who || 'Quelqu\'un'} a renommé le cercle`;
  if (m.deleted_at) return `${who ? `${who} : ` : ''}Message retiré`;
  const body = m.track_name ? `🎵 ${m.track_name}` : m.image_url ? '📷 Photo' : (m.text || '');
  return who ? `${who} : ${body}` : body;
}

/** Aperçu du dernier message d'une conversation privée. */
export function dmPreviewText(m: any, myId?: string): string {
  if (!m) return '…';
  const me = m.sender_id === myId ? 'Toi : ' : '';
  if (m.deleted_at) return `${me}Message retiré`;
  if (m.track_name) return `${me}🎵 ${m.track_name}`;
  if (m.story_id) return m.text ? `Shake éphémère : ${m.text}` : '❤️ a aimé un Shake éphémère';
  if (m.image_url && !m.text) return `${me}📷 Photo`;
  return `${me}${m.text || '…'}`;
}
