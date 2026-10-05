// R6 : délimite une liste de sons à l'écran : ses pochettes jouent dans CETTE
// file (réponses en musique, récap…), avec sa source pour la barre de lecture.
import type { ReactNode } from 'react';
import { PlayQueueContext, type PlayerSource, type PlayerTrack } from '../../lib/player';

export function QueueScope({ tracks, source, children }: { tracks: () => PlayerTrack[]; source: PlayerSource; children: ReactNode }) {
  return <PlayQueueContext.Provider value={{ tracks, source }}>{children}</PlayQueueContext.Provider>;
}

/** Réponses en musique (sous un post) → file « Réponses en musique ». */
export const reactionTracks = (list: any[]): PlayerTrack[] => (list || []).filter((r) => r?.track_name).map((r) => ({
  id: `reaction-${r.id}`, title: r.track_name, artist: r.artist || '', cover: r.cover_url, previewUrl: r.preview_url,
  spotifyId: r.track_id || r.spotify_url?.match(/track[/:]([A-Za-z0-9]{22})/)?.[1] || null,
}));
export const REPLIES_SOURCE: PlayerSource = { kind: 'reply', label: 'Réponses en musique' };
