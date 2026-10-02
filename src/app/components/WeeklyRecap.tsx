// P20 : récap de la semaine. Une carte dans le fil (« Ton récap de la semaine
// est prêt ») ouvre le récap en plein écran façon story, sur plusieurs écrans,
// et le dernier propose la vidéo à partager (même moteur que les sons).
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X, ChevronRight, Share2 } from 'lucide-react';
import { getWeeklyRecap, type WeeklyRecap } from '../../lib/social';
import { createRecapVideo } from '../../lib/storyVideo';
import { inviteLink } from '../../lib/links';
import { useBackHandler } from '../../lib/navigation';
import { avatarThumb, defaultAvatar } from '../../lib/media';
import { openProfile } from '../../lib/appNav';
import { SongCover } from './SongCover';
import { FlameIcon } from './Streak';
import { StoryVideoMaker } from './StoryVideoMaker';

const HIDDEN_KEY = 'shakemoi_recap_hidden';
let cache: { userId: string; recap: WeeklyRecap | null } | null = null;

function hasContent(r: WeeklyRecap | null): r is WeeklyRecap {
  return !!r && (r.shakes > 0 || r.likes > 0);
}

export function weekLabel(r: WeeklyRecap): string {
  const f = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  const [a, b] = [f(r.start), f(r.end)];
  const sameMonth = new Date(r.start).getMonth() === new Date(r.end).getMonth();
  return `du ${sameMonth ? a.split(' ')[0] : a} au ${b}`;
}

/** Carte discrète en haut du fil, toute la semaine (croix pour la masquer). */
export function RecapCard({ user }: { user: any }) {
  const [recap, setRecap] = useState<WeeklyRecap | null>(cache && cache.userId === user.id ? cache.recap : null);
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (cache?.userId === user.id) return;
    getWeeklyRecap().then((r) => { cache = { userId: user.id, recap: r }; setRecap(r); }).catch(() => {});
  }, [user.id]);

  useEffect(() => {
    if (!recap) return;
    try { setHidden(localStorage.getItem(HIDDEN_KEY) === String(recap.week)); } catch { /* stockage bloqué */ }
  }, [recap]);

  if (!hasContent(recap) || hidden) return null;

  const hide = () => {
    setHidden(true);
    try { localStorage.setItem(HIDDEN_KEY, String(recap.week)); } catch { /* stockage bloqué */ }
  };

  return (
    <>
      <div className="relative rounded-2xl overflow-hidden border border-fuchsia-500/30 bg-gradient-to-br from-purple-700/40 via-fuchsia-700/25 to-pink-600/30">
        <button onClick={() => setOpen(true)} className="w-full flex items-center gap-3 p-3.5 pr-10 text-left">
          <div className="relative w-12 h-12 flex-shrink-0">
            {recap.top[0]?.cover
              ? <img src={recap.top[0].cover} alt="" className="w-12 h-12 rounded-xl object-cover" />
              : <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600" />}
            {recap.streak > 0 && <span className="absolute -bottom-1 -right-1 bg-[#1E1440] rounded-full p-0.5"><FlameIcon className="w-4 h-4" /></span>}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">Ton récap de la semaine est prêt 🎧</p>
            <p className="text-xs text-purple-100/75 truncate">
              {recap.shakes} Shake{recap.shakes > 1 ? 's' : ''} · {recap.likes} like{recap.likes > 1 ? 's' : ''} reçu{recap.likes > 1 ? 's' : ''}{recap.genre ? ` · ${recap.genre}` : ''}
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-purple-200/70 flex-shrink-0" />
        </button>
        <button onClick={hide} aria-label="Masquer le récap" className="absolute top-2 right-2 p-1.5 rounded-full text-purple-200/60 hover:text-white hover:bg-white/10">
          <X className="w-4 h-4" />
        </button>
      </div>
      {open && <RecapViewer recap={recap} user={user} onClose={() => setOpen(false)} />}
    </>
  );
}

type Screen = 'intro' | 'numbers' | 'top' | 'genre' | 'match' | 'streak' | 'share';
const SCREEN_MS = 5000;

export function RecapViewer({ recap, user, onClose }: { recap: WeeklyRecap; user: any; onClose: () => void }) {
  useBackHandler(true, onClose);
  const screens = useMemo<Screen[]>(() => [
    'intro', 'numbers',
    ...(recap.top.length ? ['top' as const] : []),
    ...(recap.genre ? ['genre' as const] : []),
    ...(recap.match ? ['match' as const] : []),
    ...(recap.streak > 0 ? ['streak' as const] : []),
    'share',
  ], [recap]);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const screen = screens[i];
  const last = i === screens.length - 1;
  const username = user.username;
  const avatar = user.profile_album_cover_url || user.avatar || null;
  const label = weekLabel(recap);

  // Défilement automatique (sauf le dernier écran, et pendant l'écoute d'un son).
  useEffect(() => {
    if (last || paused || screen === 'top') return;
    const t = setTimeout(() => setI((n) => Math.min(n + 1, screens.length - 1)), SCREEN_MS);
    return () => clearTimeout(t);
  }, [i, last, paused, screen, screens.length]);

  const go = (d: number) => setI((n) => Math.max(0, Math.min(screens.length - 1, n + d)));
  const onTap = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, a, [data-no-tap]')) return;
    go(e.clientX < window.innerWidth / 3 ? -1 : 1);
  };

  return createPortal(
    <div className="fixed inset-0 z-[85] text-white flex flex-col select-none"
      style={{ background: 'radial-gradient(circle at 20% 10%, #7B2CBF 0%, #2A1150 40%, #0A0614 100%)' }}
      onClick={onTap}
      onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} onPointerCancel={() => setPaused(false)}
      role="dialog" aria-label="Ton récap de la semaine">
      {/* Barres de progression, façon story */}
      <div className="flex gap-1 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        {screens.map((s, k) => (
          <div key={s} className="flex-1 h-1 rounded-full bg-white/20 overflow-hidden">
            <div className={`h-full bg-white ${k === i && !last && screen !== 'top' && !paused ? 'recap-fill' : ''}`}
              style={{ width: k < i ? '100%' : k === i && (last || screen === 'top') ? '100%' : k === i ? undefined : '0%', animationDuration: `${SCREEN_MS}ms` }} />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 px-4 pt-3">
        <img src={avatarThumb(avatar, 64) || defaultAvatar(username)} alt="" className="w-8 h-8 rounded-full object-cover" />
        <p className="flex-1 text-sm font-semibold">Ton récap · <span className="text-purple-200/80 font-normal">{label}</span></p>
        {!last && <button onClick={() => setI(screens.length - 1)} aria-label="Partager mon récap" className="p-2 rounded-full hover:bg-white/10"><Share2 className="w-5 h-5" /></button>}
        <button onClick={onClose} aria-label="Fermer" className="p-2 rounded-full hover:bg-white/10"><X className="w-5 h-5" /></button>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div key={screen} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }}
            className="w-full max-w-sm text-center">
            {screen === 'intro' && (
              <>
                <img src={avatarThumb(avatar, 256) || defaultAvatar(username)} alt="" className="w-32 h-32 rounded-full object-cover mx-auto ring-4 ring-fuchsia-500/60" />
                <h2 className="mt-6 text-4xl font-black">Ta semaine</h2>
                <p className="text-2xl font-black bg-gradient-to-r from-purple-300 to-pink-400 bg-clip-text text-transparent">en musique</p>
                <p className="mt-3 text-sm text-purple-100/75">{label}</p>
              </>
            )}
            {screen === 'numbers' && (
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-7xl font-black bg-gradient-to-b from-purple-200 to-pink-400 bg-clip-text text-transparent">{recap.shakes}</p><p className="mt-1 font-semibold">Shake{recap.shakes > 1 ? 's' : ''}</p></div>
                <div><p className="text-7xl font-black bg-gradient-to-b from-purple-200 to-pink-400 bg-clip-text text-transparent">{recap.likes}</p><p className="mt-1 font-semibold">like{recap.likes > 1 ? 's' : ''} reçu{recap.likes > 1 ? 's' : ''}</p></div>
              </div>
            )}
            {screen === 'top' && (
              <div className="text-left" data-no-tap>
                <h2 className="text-2xl font-black text-center mb-5">{recap.top.length > 1 ? `Tes ${recap.top.length} sons les plus likés` : 'Ton son le plus liké'}</h2>
                <div className="space-y-3">
                  {recap.top.map((s, k) => (
                    <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/10">
                      <SongCover songKey={`recap-${s.id}`} title={s.title} artist={s.artist} cover={s.cover} previewUrl={s.preview_url} spotifyId={s.track_id} spotifyUrl={s.spotify_url} className="w-16 h-16 flex-shrink-0" rounded="rounded-xl" iconSize="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black text-pink-300">#{k + 1}</p>
                        <p className="font-semibold truncate">{s.title}</p>
                        <p className="text-xs text-purple-100/70 truncate">{s.artist}</p>
                      </div>
                      <p className="text-sm font-bold text-pink-300 flex-shrink-0">♥ {s.likes}</p>
                    </div>
                  ))}
                </div>
                <button onClick={() => go(1)} className="mt-5 w-full py-2.5 rounded-xl bg-white/10 text-sm font-semibold">Suivant</button>
              </div>
            )}
            {screen === 'genre' && (
              <>
                <p className="text-lg text-purple-100/80">Ton genre du moment</p>
                <p className="mt-3 text-6xl font-black bg-gradient-to-r from-purple-300 to-pink-400 bg-clip-text text-transparent leading-tight">{recap.genre}</p>
              </>
            )}
            {screen === 'match' && recap.match && (
              <>
                <p className="text-lg text-purple-100/80">Ton meilleur match musical</p>
                <img src={avatarThumb(recap.match.avatar, 256) || defaultAvatar(recap.match.username)} alt="" className="mt-5 w-28 h-28 rounded-full object-cover mx-auto ring-4 ring-pink-500/60" />
                <p className="mt-4 text-2xl font-black">@{recap.match.username}</p>
                <p className="text-xl font-bold text-pink-300">{recap.match.score} % de goûts en commun</p>
                <button onClick={() => { onClose(); openProfile(recap.match!.id); }} className="mt-5 px-5 py-2.5 rounded-xl bg-white/10 text-sm font-semibold">Voir son profil</button>
              </>
            )}
            {screen === 'streak' && (
              <>
                <FlameIcon className="w-28 h-28 mx-auto" />
                <p className="mt-4 text-4xl font-black">{recap.streak} semaine{recap.streak > 1 ? 's' : ''}</p>
                <p className="text-lg text-purple-100/80">de Shakes d'affilée</p>
              </>
            )}
            {screen === 'share' && (
              <div className="text-left" data-no-tap>
                <h2 className="text-2xl font-black text-center mb-1">Partage ton récap</h2>
                <p className="text-sm text-purple-100/75 text-center mb-5">Une vidéo story avec ta semaine, sur ton son le plus liké.</p>
                <StoryVideoMaker
                  url={inviteLink(username)}
                  shareText="Mon récap de la semaine sur SHAKEmoi 🎧 Fais le tien :"
                  fileName={`shakemoi-recap-${recap.week}`}
                  title="Vidéo de ton récap"
                  make={(canvas, onProgress) => createRecapVideo(canvas, {
                    username, avatar, weekLabel: label, shakes: recap.shakes, likes: recap.likes, streak: recap.streak,
                    genre: recap.genre, match: recap.match, top: recap.top.map((s) => ({ title: s.title, artist: s.artist, cover: s.cover, previewUrl: s.preview_url, likes: s.likes })),
                  }, inviteLink(username), onProgress)}
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="pb-[max(1rem,env(safe-area-inset-bottom))]" />
    </div>,
    document.body,
  );
}
