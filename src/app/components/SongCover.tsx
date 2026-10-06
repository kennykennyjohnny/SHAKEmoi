// Pochette jouable (M2) : LA seule façon d'afficher un son dans l'appli.
// - bouton lecture toujours visible (aussi sur téléphone) ;
// - un clic lance / met en pause l'extrait dans notre lecteur (jamais d'embed
//   Spotify, jamais de lecture automatique) ;
// - un seul son à la fois dans toute l'appli (lecteur global de lib/preview) ;
// - pas d'extrait nulle part (M1) : petit bouton « Écouter sur <mon appli> » (O1).
import { useContext, useEffect, useState } from 'react';
import { Play, Pause, Loader2 } from 'lucide-react';
import { togglePreview, getPreviewState, onPreviewChange, resolvePreviewUrl, playPreview } from '../../lib/preview';
import { playQueue, PlayQueueContext, usePlayer, type PlayerTrack } from '../../lib/player';
import { openExternal, PLATFORM_LABELS, searchUrl } from '../../lib/platforms';
import { MyAppLogo, useMyStreamingApp } from './PlatformLogo';
import { thumb } from '../../lib/media';

export interface SongCoverProps {
  /** Identifiant unique de ce son à l'écran (id du post, du message…). */
  songKey: string;
  title?: string | null;
  artist?: string | null;
  cover?: string | null;
  previewUrl?: string | null;
  /** Id ou lien Spotify : retrouve l'extrait exact (ISRC) et sert de secours. */
  spotifyId?: string | null;
  spotifyUrl?: string | null;
  /** Taille de la pochette (classes Tailwind), ex. « w-12 h-12 ». */
  className?: string;
  rounded?: string;
  /** Taille de l'icône lecture. */
  iconSize?: 'sm' | 'md' | 'lg';
  /** Essai de son (composeur, tuto…) : joue sans passer par la file de l'appli. */
  standalone?: boolean;
}

function usePreviewState() {
  const [state, setState] = useState(getPreviewState());
  useEffect(() => onPreviewChange(() => setState(getPreviewState())), []);
  return state;
}

export function SongCover({
  songKey, title, artist, cover, previewUrl, spotifyId, spotifyUrl,
  className = 'w-12 h-12', rounded = 'rounded-lg', iconSize = 'md', standalone = false,
}: SongCoverProps) {
  const state = usePreviewState();
  // R6 : la file de l'écran (fil, profil, classement…) ; sinon ce son seul.
  const queueCtx = useContext(PlayQueueContext);
  const myApp = useMyStreamingApp();
  const [loading, setLoading] = useState(false);
  const [noPreview, setNoPreview] = useState(false);
  // Correctif 06/10 : l'extrait s'est révélé illisible même après réparation.
  const failed = usePlayer().failedId === songKey;
  const isCurrent = state.key === songKey;
  const isPlaying = isCurrent && state.playing;
  const trackId = spotifyId || spotifyUrl?.match(/track[/:]([A-Za-z0-9]{22})/)?.[1] || null;
  const icon = iconSize === 'sm' ? 'w-3.5 h-3.5' : iconSize === 'lg' ? 'w-7 h-7' : 'w-5 h-5';

  const onClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isCurrent && !failed) { togglePreview(songKey); return; }
    setLoading(true);
    if (standalone) {
      const url = await resolvePreviewUrl(title || '', artist || '', previewUrl, trackId).catch(() => null);
      setLoading(false);
      if (url) playPreview(songKey, url);
      setNoPreview(!url);
      return;
    }
    // R5 / R6 : tout passe par le lecteur de l'appli, dans la file de l'écran.
    const self: PlayerTrack = { id: songKey, title: title || '', artist: artist || '', cover, previewUrl, spotifyId: trackId };
    let tracks = queueCtx ? await Promise.resolve(queueCtx.tracks()).catch(() => []) : [];
    let idx = tracks.findIndex((t) => t.id === songKey);
    if (idx < 0) { tracks = [self]; idx = 0; }
    const ok = await playQueue(tracks, idx, tracks.length > 1 && queueCtx ? queueCtx.source : { kind: 'single', label: title || 'Son' });
    setLoading(false);
    setNoPreview(!ok);
  };

  const openSpotify = (e: React.MouseEvent) => {
    e.stopPropagation();
    openExternal(myApp === 'spotify' && trackId ? `https://open.spotify.com/track/${trackId}` : searchUrl(myApp, title || '', artist || ''));
  };

  return (
    <div className={`relative flex-shrink-0 ${className}`}>
      <button
        type="button"
        onClick={onClick}
        aria-label={isPlaying ? `Mettre en pause ${title || 'le son'}` : `Écouter ${title || 'le son'}`}
        className={`group relative block w-full h-full overflow-hidden ${rounded} bg-violet-950/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400`}
      >
        {cover ? (
          <img loading="lazy" src={thumb(cover, 320)} alt="" className={`w-full h-full object-cover ${isPlaying ? 'scale-[1.03]' : ''} transition-transform`} />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-purple-700 to-pink-700" />
        )}
        {/* Toujours visible : sur téléphone il n'y a pas de survol (H4). */}
        <span className={`absolute inset-0 flex items-center justify-center transition-colors ${isPlaying ? 'bg-black/35' : 'bg-black/25 group-hover:bg-black/40'}`}>
          <span className="rounded-full bg-black/45 p-1.5 backdrop-blur-[2px]">
            {loading ? <Loader2 className={`${icon} text-white animate-spin`} />
              : isPlaying ? <Pause className={`${icon} text-white fill-white`} />
              : <Play className={`${icon} text-white fill-white translate-x-[1px]`} />}
          </span>
        </span>
        {isPlaying && (
          <span className="absolute bottom-1 left-1 right-1 flex items-end justify-center gap-[2px] h-2.5">
            {[0, 1, 2, 3].map(i => (
              <span key={i} className="w-[3px] bg-white/90 rounded-full animate-pulse" style={{ height: `${40 + ((i * 23) % 60)}%`, animationDelay: `${i * 0.15}s` }} />
            ))}
          </span>
        )}
      </button>
      {(noPreview || failed) && (
        <button
          type="button"
          onClick={openSpotify}
          className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-10 whitespace-nowrap flex items-center gap-1 px-2 py-1 rounded-full bg-white text-[#1E1440] text-[10px] font-bold shadow-lg"
        >
          <MyAppLogo className="w-3 h-3" /> Écouter sur {PLATFORM_LABELS[myApp]}
        </button>
      )}
    </div>
  );
}
