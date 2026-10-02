import { useEffect, useMemo, useState } from 'react';
import { Play, Pause, Loader2, Search, Share2, UserPlus, Check, ArrowRight, Headphones } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { getSharedSong, incrementShareViews, getPreferredPlatform, setPreferredPlatform } from '../../lib/shares';
import { resolvePreviewUrl, togglePreview, stopPreview, onPreviewChange, getPreviewState } from '../../lib/preview';
import {
  LISTEN_PLATFORMS, mergeLinks, normalizePlatform, platformUrl, resolveLinks,
  type PlatformKey, type StoredLinks,
} from '../../lib/platforms';
import { followUser, followErrorMessage, isFollowing } from '../../lib/database';
import { postLink, songLink } from '../../lib/links';
import { Logo } from './Logo';
import { Slogan } from './Slogan';
import { SongShareSheet } from './SongShareSheet';
import { PLATFORM_BUTTONS } from './PlatformButtons';
import { defaultAvatar, avatarThumb } from '../../lib/media';

// SHAKEMOI - Page publique d'un son partagé : LA MÊME pour tout le monde,
// qu'on arrive par un lien de son (/s/) ou de post (/p/), connecté ou non.
// Seules différences :
//   - si la personne qui partage a un compte : « @xxx t'a partagé ce son »,
//     et pour un visiteur, la proposition de l'ajouter en ami à l'inscription ;
//   - connecté : un bouton pour accéder à son compte.

export type LandingSource = { type: 'song'; slug: string } | { type: 'post'; id: string };

interface Props {
  source: LandingSource;
  currentUser: any | null;
  /** Visiteur : ouvrir l'inscription / la connexion. */
  onSignUp: () => void;
  onLogin: () => void;
  /** Connecté : aller dans l'app. */
  onOpenApp: () => void;
  onSearch?: () => void;
  /** Pseudo de la personne qui partage, dès qu'on le connaît (parrainage). */
  onSharer?: (username: string) => void;
}

interface Sharer { id: string; username: string; avatar: string | null }

interface LandingSong {
  title: string;
  artist: string;
  cover: string | null;
  preview: string | null;
  isrc: string | null;
  links: StoredLinks;
  sharer: Sharer | null;
}

const USER_COLS = 'id, username, display_name, profile_album_cover_url';

function toSharer(u: any): Sharer | null {
  return u?.username ? { id: u.id, username: u.username, avatar: u.profile_album_cover_url || null } : null;
}

async function loadSource(source: LandingSource): Promise<LandingSong | null> {
  if (source.type === 'song') {
    const res = await getSharedSong(source.slug);
    if (!res) return null;
    const { share, song } = res;
    incrementShareViews(source.slug);
    const { data: u } = share.user_id
      ? await supabase.from('users_profile').select(USER_COLS).eq('id', share.user_id).maybeSingle()
      : { data: null };
    return {
      title: song.track_name,
      artist: song.artist || '',
      cover: song.cover_url,
      preview: song.preview_url,
      isrc: song.isrc,
      links: song,
      sharer: toSharer(u),
    };
  }
  const { data: post } = await supabase
    .from('posts')
    .select(`*, user:users_profile!posts_user_id_fkey(${USER_COLS})`)
    .eq('id', source.id)
    .maybeSingle();
  if (!post?.track_name) return null;
  const spotifyFromId = post.track_id && /^[A-Za-z0-9]{22}$/.test(post.track_id)
    ? `https://open.spotify.com/track/${post.track_id}`
    : null;
  return {
    title: post.track_name,
    artist: post.artist || '',
    cover: post.cover_url,
    preview: post.preview_url,
    isrc: null,
    links: { ...post, spotify_url: post.spotify_url || spotifyFromId },
    sharer: toSharer(post.user),
  };
}

export function SongLanding({ source, currentUser, onSignUp, onLogin, onOpenApp, onSearch, onSharer }: Props) {
  const [data, setData] = useState<LandingSong | null>(null);
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState<StoredLinks>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewChecked, setPreviewChecked] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [following, setFollowing] = useState<boolean | null>(null);
  const [followBusy, setFollowBusy] = useState(false);

  const sourceKey = source.type === 'song' ? source.slug : source.id;
  const previewKey = `landing-${sourceKey}`;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const d = await loadSource(source).catch(() => null);
      if (cancelled) return;
      setData(d);
      setLinks(d?.links ?? {});
      setLoading(false);
      if (!d) return;
      if (d.sharer) onSharer?.(d.sharer.username);

      // Liens exacts manquants + extrait, résolus en arrière-plan. Les boutons
      // marchent déjà : en attendant, ils ouvrent la recherche de la plateforme.
      const [resolved, preview] = await Promise.all([
        resolveLinks({ title: d.title, artist: d.artist, spotifyUrl: d.links.spotify_url, isrc: d.isrc }),
        resolvePreviewUrl(d.title, d.artist, d.preview, d.links.spotify_url).catch(() => null),
      ]);
      if (cancelled) return;
      setLinks(l => mergeLinks(l, resolved));
      setPreviewUrl(preview);
      setPreviewChecked(true);
      // M2 : jamais de lecture automatique, pour personne. Le son démarre au
      // clic sur la pochette.
    })();
    return () => { cancelled = true; };
  }, [sourceKey]);

  // Lecteur partagé avec le reste de l'app.
  const [preview, setPreview] = useState(getPreviewState());
  useEffect(() => onPreviewChange(() => setPreview(getPreviewState())), []);
  useEffect(() => () => stopPreview(), []);
  const playing = preview.key === previewKey && preview.playing;

  // Connecté : suit-on déjà la personne qui a partagé ?
  const sharer = data?.sharer ?? null;
  const isMe = !!currentUser && sharer?.id === currentUser.id;
  useEffect(() => {
    if (!currentUser || !sharer || isMe) { setFollowing(null); return; }
    isFollowing(sharer.id).then(setFollowing).catch(() => setFollowing(null));
  }, [currentUser?.id, sharer?.id]);

  // Ordre fixé à l'ouverture, plateforme préférée en premier. On ne réordonne
  // PAS au clic : avant, le bouton sautait en haut au lieu de s'ouvrir.
  const preferred = useMemo<PlatformKey | null>(
    () => normalizePlatform(currentUser?.musicService || currentUser?.preferred_streaming_app || currentUser?.preferred_platform)
      || normalizePlatform(getPreferredPlatform()),
    [currentUser?.id],
  );
  const ordered = useMemo(
    () => (preferred && !LISTEN_PLATFORMS.includes(preferred) ? [preferred, ...LISTEN_PLATFORMS] : LISTEN_PLATFORMS)
      .slice()
      .sort((a, b) => (b === preferred ? 1 : 0) - (a === preferred ? 1 : 0))
      .map(k => PLATFORM_BUTTONS.find(p => p.key === k))
      .filter((p): p is (typeof PLATFORM_BUTTONS)[number] => !!p),
    [preferred],
  );

  // Le clic ne fait que mémoriser la préférence du VISITEUR : l'ouverture est
  // assurée par le lien lui-même (<a href>), ce qui marche partout, iOS compris.
  // Connecté : l'appli d'écoute est celle du profil (O1), modifiable dans les
  // paramètres — un clic ici ne la change plus en douce.
  const rememberPlatform = (key: PlatformKey) => {
    if (!currentUser) setPreferredPlatform(key);
  };

  const follow = async () => {
    if (!sharer) return;
    setFollowBusy(true);
    try {
      const r = await followUser(sharer.id);
      if (!r.success) alert(followErrorMessage(r.error));
      else setFollowing(true);
    } catch { /* on laisse le bouton */ }
    setFollowBusy(false);
  };

  if (loading) return (
    <div className="min-h-[100dvh] bg-[#1E1440] flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
    </div>
  );

  if (!data) return (
    <div className="min-h-[100dvh] bg-[#1E1440] text-white flex flex-col items-center justify-center gap-4 text-center p-6">
      <Logo size="sm" animated={false} showText={true} href="/" />
      <p className="text-purple-300/90">Ce son n'existe plus ou le lien est invalide.</p>
      <button onClick={currentUser ? onOpenApp : onSignUp} className="px-6 py-3 bg-gradient-to-r from-fuchsia-600 to-pink-600 rounded-xl font-bold text-sm">
        {currentUser ? 'Accéder à mon compte' : 'Découvrir SHAKEmoi'}
      </button>
    </div>
  );

  const sharerName = sharer ? `@${sharer.username}` : null;
  const shareLinkUrl = source.type === 'song' ? songLink(source.slug) : postLink(source.id);

  return (
    <div className="min-h-[100dvh] bg-[#1E1440] text-white relative overflow-x-hidden">
      {data.cover && (
        <div className="fixed inset-0 pointer-events-none">
          <img loading="lazy" src={data.cover} className="w-full h-full object-cover opacity-20 blur-3xl scale-110" alt="" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#1E1440]/70 via-[#1E1440]/60 to-[#1E1440]" />
        </div>
      )}

      {/* En-tête : logo + accès au compte / connexion */}
      <header className="relative z-10 flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 max-w-md mx-auto">
        <Logo size="sm" animated={false} showText={true} href="/" />
        {currentUser ? (
          <button onClick={onOpenApp} className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-semibold hover:bg-white/15 transition-colors">
            <img loading="lazy" src={avatarThumb(currentUser.avatar) || defaultAvatar(currentUser.username)} alt="" className="w-6 h-6 rounded-full object-cover" />
            Mon compte
          </button>
        ) : (
          <button onClick={onLogin} className="px-3 py-1.5 rounded-full text-xs font-semibold text-purple-100/90 hover:bg-white/10 transition-colors">
            Se connecter
          </button>
        )}
      </header>

      <motion.main
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md mx-auto px-5 pb-10"
      >
        {/* Qui a partagé */}
        <div className="flex items-center justify-center gap-2 mt-3 mb-5 text-sm">
          {sharer ? (
            <>
              {sharer.avatar
                ? <img loading="lazy" src={avatarThumb(sharer.avatar) || sharer.avatar} alt="" className="w-7 h-7 rounded-full object-cover ring-2 ring-fuchsia-500/40" />
                : <span className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-xs font-bold">{sharer.username[0]?.toUpperCase()}</span>}
              <span className="text-purple-100/90">
                {isMe ? 'Tu as partagé ce son' : <><b className="text-white">{sharerName}</b> t'a partagé ce son</>}
              </span>
            </>
          ) : (
            <span className="text-purple-100/90 flex items-center gap-1.5">
              <Headphones className="w-4 h-4 text-fuchsia-300" /> On t'a partagé ce son
            </span>
          )}
        </div>

        {/* Pochette = lecture / pause de l'extrait */}
        <button
          type="button"
          onClick={() => previewUrl && togglePreview(previewKey, previewUrl)}
          disabled={!previewUrl}
          aria-label={playing ? "Mettre en pause l'extrait" : "Écouter l'extrait"}
          className="relative block w-64 max-w-[75vw] aspect-square mx-auto rounded-2xl overflow-hidden shadow-2xl shadow-fuchsia-500/20 group disabled:cursor-default"
        >
          {data.cover
            ? <img loading="lazy" src={data.cover} className="w-full h-full object-cover" alt="" />
            : <div className="w-full h-full bg-gradient-to-br from-purple-600 to-pink-600" />}
          <span className={`absolute inset-0 bg-black/30 flex items-center justify-center transition-opacity ${playing ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'} ${previewChecked && !previewUrl ? 'hidden' : ''}`}>
            {!previewChecked
              ? <Loader2 className="w-10 h-10 text-white/80 animate-spin" />
              : playing
                ? <Pause className="w-14 h-14 text-white fill-white drop-shadow-lg" />
                : <Play className="w-14 h-14 text-white fill-white drop-shadow-lg" />}
          </span>
          {playing && (
            <span className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-end gap-0.5 h-4">
              {[0, 1, 2, 3].map(i => (
                <motion.span
                  key={i}
                  className="w-1 bg-fuchsia-400 rounded-full"
                  animate={{ height: ['30%', '100%', '40%', '80%', '30%'] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.12 }}
                />
              ))}
            </span>
          )}
        </button>
        {previewChecked && !previewUrl && (
          <p className="text-center text-[11px] text-purple-300/80 mt-2">Pas d'extrait pour ce son : écoute-le en entier ci-dessous</p>
        )}

        <div className="text-center mt-5 mb-5">
          <h1 className="text-xl font-bold leading-tight">{data.title}</h1>
          <p className="text-sm text-purple-300/90 mt-0.5">{data.artist}</p>
        </div>

        {/* Écouter : un vrai lien par plateforme, jamais de bouton mort */}
        <div className="space-y-2.5 mb-6">
          {ordered.map(p => {
            const isPref = p.key === preferred;
            return (
              <a
                key={p.key}
                href={platformUrl(links, p.key, data.title, data.artist)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => rememberPlatform(p.key)}
                className={`w-full py-3 rounded-xl font-semibold text-sm bg-gradient-to-r ${p.color} hover:opacity-90 active:scale-[0.99] transition flex items-center justify-center gap-2 relative ${isPref ? 'ring-2 ring-white/70' : ''}`}
              >
                {p.logo}
                Écouter sur {p.label}
                {isPref && <span className="absolute right-3 text-[10px] font-bold bg-white/25 px-1.5 py-0.5 rounded-full">Ta plateforme</span>}
              </a>
            );
          })}
        </div>

        {/* Social : la seule partie qui dépend du compte */}
        <div className="bg-gradient-to-r from-purple-500/15 to-pink-500/10 border border-purple-400/20 rounded-2xl p-4">
          {currentUser ? (
            <div className="space-y-2.5">
              {sharer && !isMe && following === false && (
                <button
                  onClick={follow}
                  disabled={followBusy}
                  className="w-full py-3 rounded-xl bg-white/10 border border-white/15 font-bold text-sm flex items-center justify-center gap-2 hover:bg-white/15 disabled:opacity-60"
                >
                  {followBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  Ajouter {sharerName} en ami
                </button>
              )}
              {sharer && !isMe && following === true && (
                <p className="text-center text-xs text-purple-200/80 flex items-center justify-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-green-400" /> {sharerName} fait partie de tes amis
                </p>
              )}
              <button
                onClick={onOpenApp}
                className="w-full py-3 bg-gradient-to-r from-fuchsia-600 to-pink-600 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90"
              >
                Accéder à mon compte <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-center text-purple-100/90 mb-3">
                {sharer
                  ? <>Crée ton compte : <b className="text-white">{sharerName}</b> sera ajouté à tes amis et tu pourras lui renvoyer des sons.</>
                  : 'Crée ton compte pour partager tes sons avec tes amis.'}
              </p>
              <button
                onClick={onSignUp}
                className="w-full py-3 bg-gradient-to-r from-fuchsia-600 to-pink-600 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90"
              >
                {sharer ? <><UserPlus className="w-4 h-4" /> Créer mon compte et ajouter {sharerName}</> : 'Créer mon compte'}
              </button>
              <button onClick={onLogin} className="w-full mt-2 py-2 text-xs text-purple-200/80 hover:text-white">
                J'ai déjà un compte
              </button>
            </>
          )}
        </div>

        <div className={`grid ${onSearch ? 'grid-cols-2' : 'grid-cols-1'} gap-2.5 mt-3`}>
          <button
            onClick={() => setShowShare(true)}
            className="py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-sm font-semibold flex items-center justify-center gap-2"
          >
            <Share2 className="w-4 h-4" /> Partager
          </button>
          {onSearch && (
            <button
              onClick={onSearch}
              className="py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-sm font-semibold flex items-center justify-center gap-2"
            >
              <Search className="w-4 h-4" /> Autre son
            </button>
          )}
        </div>

        <p className="text-center text-[10px] text-purple-300/80 mt-8">shakemoi.fr · <Slogan /></p>
      </motion.main>

      {showShare && (
        <SongShareSheet
          song={{ title: data.title, artist: data.artist, cover: data.cover, previewUrl }}
          by={currentUser?.username}
          link={shareLinkUrl}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}
