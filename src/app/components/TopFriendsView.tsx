// TOP (P14) : deux onglets « Amis » / « Tout SHAKEMOI » qu'on change en glissant
// (même mécanique que Messages / Cercles, P10), trois périodes (7 j, 30 j,
// depuis toujours) gardées d'un onglet à l'autre. Tout est calculé en base
// (get_top) : sons les plus shakés (posts + reshakes), sons les plus likés,
// artistes, personnes les plus actives. Jamais de post privé ni de cercle.
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { SongCover } from './SongCover';
import { TrendingUp, Users, Loader2, Music, Crown, Repeat2, BarChart3, ChevronDown, ChevronUp, Sparkles, Heart, Mic2, Flame, X, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getCurrentUser, createPost } from '../../lib/database';
import { getPlatformUrl } from '../../lib/odesli';
import { supabase } from '../../lib/supabase';
import { openExternal } from '../../lib/platforms';
import { MyAppLogo } from './PlatformLogo';
import { useSwipeTabs } from '../../lib/useSwipeTabs';
import { avatarThumb, defaultAvatar, thumb } from '../../lib/media';
import { openPost, openProfile } from '../../lib/appNav';
import { formatRelative } from '../../lib/dates';
import { useBackHandler } from '../../lib/navigation';

interface TopFriendsViewProps {
  currentUser: any;
  onRefreshFeed?: () => void;
}

type Scope = 'friends' | 'all';
type Period = 7 | 30 | 0;
const SCOPES = ['friends', 'all'] as const;
const PERIOD_KEY = 'shakemoi_top_period';
const SCOPE_KEY = 'shakemoi_top_scope';

// Petit cache (2 min) : changer d'onglet ou de période ne recharge pas tout en 4G.
const cache = new Map<string, { at: number; data: any }>();
async function loadTop(scope: Scope, period: Period, force = false) {
  const key = `${scope}-${period}`;
  const hit = cache.get(key);
  if (!force && hit && Date.now() - hit.at < 120_000) return hit.data;
  const { data, error } = await supabase.rpc('get_top', { p_scope: scope, p_days: period });
  if (error) throw error;
  cache.set(key, { at: Date.now(), data });
  return data;
}

export function TopFriendsView({ currentUser, onRefreshFeed }: TopFriendsViewProps) {
  const [period, setPeriodState] = useState<Period>(() => {
    try { const v = sessionStorage.getItem(PERIOD_KEY); return (v === '30' ? 30 : v === '0' ? 0 : 7) as Period; } catch { return 7; }
  });
  const [scope, setScopeState] = useState<Scope>(() => {
    try { return sessionStorage.getItem(SCOPE_KEY) === 'all' ? 'all' : 'friends'; } catch { return 'friends'; }
  });
  const setPeriod = (p: Period) => { setPeriodState(p); try { sessionStorage.setItem(PERIOD_KEY, String(p)); } catch { /* pas grave */ } };
  const setScope = (s: Scope) => { setScopeState(s); try { sessionStorage.setItem(SCOPE_KEY, s); } catch { /* pas grave */ } };
  const swipe = useSwipeTabs(SCOPES, scope, setScope);

  return (
    <div className="w-full max-w-2xl mx-auto flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Onglets (on glisse ou on touche) + période */}
      <div className="px-4 pt-3 flex-shrink-0">
        <div className="relative grid grid-cols-2 border-b border-purple-500/20">
          {SCOPES.map((sc) => (
            <button key={sc} onClick={() => setScope(sc)} className={`py-2.5 text-sm font-semibold transition-colors ${scope === sc ? 'text-white' : 'text-purple-300/80 hover:text-purple-200'}`}>
              {sc === 'friends' ? 'Amis' : 'Tout SHAKEMOI'}
            </button>
          ))}
          <span className="absolute bottom-0 inset-x-0 h-0.5 pointer-events-none">
            <span className="block h-full" style={swipe.indicatorStyle}>
              <span className="block h-full mx-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" />
            </span>
          </span>
        </div>
        <div className="flex justify-center my-3">
          <div className="flex bg-violet-950/25 rounded-full p-0.5 border border-purple-500/20">
            {([7, 30, 0] as const).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${period === p ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-sm' : 'text-purple-300/85 hover:text-white'}`}>
                {p === 7 ? '7 jours' : p === 30 ? '30 jours' : 'Depuis toujours'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div ref={swipe.ref} className="flex-1 min-h-0 overflow-hidden" {...swipe.handlers}>
        <div className="flex h-full" style={swipe.trackStyle}>
          {SCOPES.map((sc) => (
            <div key={sc} className="w-full flex-shrink-0 h-full overflow-y-auto px-4 pb-[var(--nav-h)] lg:pb-4" aria-hidden={scope !== sc}>
              <TopPanel scope={sc} period={period} visible={scope === sc} currentUser={currentUser} onRefreshFeed={onRefreshFeed} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TopPanel({ scope, period, visible, currentUser, onRefreshFeed }: { scope: Scope; period: Period; visible: boolean; currentUser: any; onRefreshFeed?: () => void }) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [songSheet, setSongSheet] = useState<any | null>(null);
  const [shaking, setShaking] = useState<string | null>(null);
  const [shaked, setShaked] = useState<Set<string>>(new Set());
  const [loadedOnce, setLoadedOnce] = useState(false);

  const load = async (force = false) => {
    setLoading(true);
    setError(false);
    try { setData(await loadTop(scope, period, force)); setLoadedOnce(true); }
    catch { setError(true); }
    setLoading(false);
  };
  // L'onglet visible se charge tout de suite ; l'autre dès qu'on y va.
  useEffect(() => { if (visible || loadedOnce) load(); }, [period, visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const openSong = (t: any) => {
    const ids: string[] = t.post_ids || (t.post_id ? [t.post_id] : []);
    if (ids.length <= 1 && t.post_id) openPost(t.post_id);
    else setSongSheet(t);
  };
  const openInApp = (t: any) => {
    const url = getPlatformUrl({ spotify_url: t.spotify_url, apple_music_url: t.apple_music_url, deezer_url: t.deezer_url, youtube_url: t.youtube_url, youtube_music_url: t.youtube_music_url, tidal_url: t.tidal_url, odesli_page_url: t.odesli_page_url },
      currentUser?.musicService || 'spotify', { title: t.track_name, artist: t.artist });
    if (url) openExternal(url);
  };
  const shake = async (t: any) => {
    setShaking(t.key);
    const r = await createPost(t.track_name, t.artist, t.cover_url, '', t.preview_url || null, t.spotify_url, t.track_id).catch(() => ({ success: false }));
    setShaking(null);
    if (r?.success) { setShaked((s) => new Set([...s, t.key])); onRefreshFeed?.(); }
    else alert('Ton shake n’a pas pu être publié. Vérifie ta connexion et réessaie.');
  };

  const shakedList: any[] = data?.shaked || [];
  const top3 = shakedList.slice(0, 3);
  const rest = shakedList.slice(3);
  const label = period === 7 ? 'sur 7 jours' : period === 30 ? 'sur 30 jours' : 'depuis le début';

  if (loading && !data) {
    return <div className="flex flex-col items-center justify-center py-24"><Loader2 className="w-8 h-8 text-purple-500 animate-spin mb-3" /><p className="text-purple-300/85 text-sm">Calcul des tendances…</p></div>;
  }
  if (error && !data) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-purple-200/80">Impossible de charger le TOP. Vérifie ta connexion.</p>
        <button onClick={() => load(true)} className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-purple-900/50 text-sm font-semibold"><RefreshCw className="w-3.5 h-3.5" /> Réessayer</button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-4">
      {scope === 'friends' && <MyWrap period={period} />}

      {/* Sons les plus shakés (posts + reshakes) */}
      <section>
        <SectionTitle icon={<Flame className="w-4 h-4 text-pink-400" />} title="Sons les plus shakés" sub={`${scope === 'friends' ? 'Dans ton réseau' : 'Sur tout SHAKEMOI'}, ${label} · posts + reshakes`} />
        {shakedList.length === 0 ? (
          <Empty text={scope === 'friends' ? 'Rien encore dans ton réseau sur cette période. Suis des amis et shake !' : 'Rien sur cette période.'} />
        ) : (
          <>
            <div className="bg-gradient-to-b from-violet-950/30 to-violet-950/10 rounded-2xl border border-purple-500/15 overflow-hidden">
              <div className="flex items-end justify-center gap-2 px-3 pt-3">
                {top3[1] ? <PodiumCard track={top3[1]} rank={2} barHeight={96} onOpen={() => openSong(top3[1])} /> : <div className="w-[96px]" />}
                {top3[0] && <PodiumCard track={top3[0]} rank={1} barHeight={128} onOpen={() => openSong(top3[0])} crown />}
                {top3[2] ? <PodiumCard track={top3[2]} rank={3} barHeight={68} onOpen={() => openSong(top3[2])} /> : <div className="w-[96px]" />}
              </div>
            </div>
            {rest.length > 0 && (
              <div className="space-y-2 mt-3">
                {rest.map((t, i) => (
                  <SongRow key={t.key} rank={i + 4} track={t} detail={<><Users className="w-2.5 h-2.5" /> {t.shakes} fois · {sharersText(t.sharers)}</>}
                    onOpen={() => openSong(t)} onApp={() => openInApp(t)}
                    action={shaked.has(t.key) ? <span className="text-[10px] text-fuchsia-400 font-semibold">Shaké !</span> : (
                      <button onClick={() => shake(t)} disabled={shaking === t.key} className="px-2.5 py-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-[10px] font-bold flex items-center gap-1 disabled:opacity-50">
                        {shaking === t.key ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Shake
                      </button>
                    )} />
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* Sons les plus likés */}
      {(data?.liked || []).length > 0 && (
        <section>
          <SectionTitle icon={<Heart className="w-4 h-4 text-pink-400" />} title="Sons les plus likés" sub={label} />
          <div className="space-y-2">
            {data.liked.slice(0, 5).map((t: any, i: number) => (
              <SongRow key={t.key} rank={i + 1} track={t} detail={<><Heart className="w-2.5 h-2.5 text-pink-400" /> {t.likes} like{t.likes > 1 ? 's' : ''}</>} onOpen={() => openSong(t)} onApp={() => openInApp(t)} />
            ))}
          </div>
        </section>
      )}

      {/* Artistes du moment */}
      {(data?.artists || []).length > 0 && (
        <section>
          <SectionTitle icon={<Mic2 className="w-4 h-4 text-fuchsia-400" />} title="Artistes les plus partagés" sub={label} />
          <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {data.artists.slice(0, 10).map((a: any, i: number) => (
              <div key={a.name + i} className="flex-shrink-0 w-24 text-center">
                <div className="relative w-24 h-24 rounded-2xl overflow-hidden bg-violet-950/40">
                  {a.cover ? <img loading="lazy" src={thumb(a.cover, 300)} alt="" className="w-full h-full object-cover" /> : <Music className="w-8 h-8 m-8 text-purple-300/80" />}
                  <span className="absolute top-1 left-1 w-5 h-5 rounded-full bg-black/60 text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                </div>
                <p className="text-xs font-semibold text-white truncate mt-1.5">{a.name}</p>
                <p className="text-[10px] text-purple-300/85">{a.shakes} shake{a.shakes > 1 ? 's' : ''} · {a.people} pers.</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Genres du moment (P14) : familles de genres des sons partagés. */}
      {(data?.genres || []).length > 0 && (
        <section>
          <SectionTitle icon={<BarChart3 className="w-4 h-4 text-purple-300" />} title="Genres du moment" sub={label} />
          <div className="space-y-2">
            {data.genres.map((g: any) => {
              const max = Math.max(...data.genres.map((x: any) => x.shakes), 1);
              return (
                <div key={g.family} className="rounded-xl bg-violet-950/30 border border-purple-800/20 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <p className="flex-1 text-sm font-semibold text-white">{g.family}</p>
                    <p className="text-[11px] text-purple-300/90">{g.shakes} son{g.shakes > 1 ? 's' : ''} · {g.people} pers.</p>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500" style={{ width: `${Math.round((g.shakes / max) * 100)}%` }} />
                  </div>
                  {g.artists?.length > 0 && <p className="text-[11px] text-purple-300/85 mt-1.5 truncate">{g.artists.join(' · ')}</p>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Les plus actifs */}
      {(data?.people || []).length > 0 && (
        <section>
          <SectionTitle icon={<Crown className="w-4 h-4 text-yellow-400" />} title="Les plus actifs" sub={label} />
          <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {data.people.slice(0, 10).map((u: any, i: number) => (
              <button key={u.id} onClick={() => openProfile(u.id)} className="flex-shrink-0 w-[4.5rem] text-center">
                <div className="relative mx-auto w-14 h-14">
                  <img loading="lazy" src={avatarThumb(u.avatar, 128) || defaultAvatar(u.username)} alt="" className="w-14 h-14 rounded-full object-cover ring-2 ring-purple-500/40" />
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 text-[10px] font-bold flex items-center justify-center border border-[#1E1440]">{i + 1}</span>
                </div>
                <p className="text-[11px] font-semibold text-white truncate mt-1.5">@{u.username}</p>
                <p className="text-[10px] text-purple-300/85">{u.shakes} shake{u.shakes > 1 ? 's' : ''}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      <AnimatePresence>
        {songSheet && <SongPostsSheet song={songSheet} onClose={() => setSongSheet(null)} />}
      </AnimatePresence>
    </div>
  );
}

function sharersText(list: any[] = []) {
  const names = list.slice(0, 2).map((s) => `@${s.username}`).join(', ');
  return list.length > 2 ? `${names} +${list.length - 2}` : names;
}

function SectionTitle({ icon, title, sub }: { icon: React.ReactNode; title: string; sub?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-base font-bold flex items-center gap-2">{icon}{title}</h2>
      {sub && <p className="text-[11px] text-purple-300/85 mt-0.5">{sub}</p>}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center rounded-2xl border border-purple-500/15">
      <Music className="w-8 h-8 text-purple-300/80 mb-2" />
      <p className="text-xs text-purple-300/90 max-w-xs">{text}</p>
    </div>
  );
}

function SongRow({ rank, track, detail, onOpen, onApp, action }: { rank: number; track: any; detail: React.ReactNode; onOpen: () => void; onApp: () => void; action?: React.ReactNode }) {
  const trackId = track.track_id || track.spotify_url?.match(/track\/([a-zA-Z0-9]+)/)?.[1] || null;
  return (
    <div className="rounded-xl border bg-violet-950/15 hover:bg-violet-950/25 border-purple-500/20 p-3 flex items-center gap-3">
      <span className="text-sm font-bold text-purple-300/85 w-6 text-center flex-shrink-0">{rank}</span>
      <SongCover songKey={`top-${track.key}`} title={track.track_name} artist={track.artist} cover={track.cover_url}
        previewUrl={track.preview_url} spotifyId={trackId} spotifyUrl={track.spotify_url} className="w-12 h-12" iconSize="sm" />
      {/* Toucher la ligne : le post (ou les posts) de ce son (P2). */}
      <button onClick={onOpen} className="flex-1 min-w-0 text-left">
        <h3 className="font-semibold text-sm text-white truncate">{track.track_name}</h3>
        <p className="text-xs text-purple-200/80 truncate">{track.artist}</p>
        <p className="text-xs text-purple-300/85 flex items-center gap-1 mt-0.5 truncate">{detail}</p>
      </button>
      <button onClick={onApp} aria-label="Ouvrir dans mon appli" className="p-1.5 rounded-full bg-[#FFEFD5]/10 hover:bg-[#FFEFD5]/20 flex-shrink-0">
        <MyAppLogo className="w-4 h-4 text-[#FFEFD5]" />
      </button>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

function PodiumCard({ track, rank, barHeight, crown, onOpen }: { track: any; rank: number; barHeight: number; crown?: boolean; onOpen: () => void }) {
  const rankBorderColor = rank === 1 ? 'border-yellow-400/50' : rank === 2 ? 'border-slate-400/40' : 'border-amber-700/40';
  const rankBadgeBg = rank === 1 ? 'from-yellow-400 to-amber-500' : rank === 2 ? 'from-slate-300 to-slate-400' : 'from-amber-600 to-amber-700';
  const barGradient = rank === 1 ? 'from-yellow-400/25 to-yellow-400/5' : rank === 2 ? 'from-slate-400/20 to-slate-400/5' : 'from-amber-700/20 to-amber-700/5';
  const imgSize = rank === 1 ? 'w-20 h-20' : 'w-16 h-16';
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: rank * 0.08, duration: 0.3 }}
      className="flex flex-col items-center" style={{ width: rank === 1 ? 112 : 96 }}>
      {crown ? <Crown className="w-5 h-5 text-yellow-400 mb-1.5 drop-shadow-[0_0_6px_rgba(250,204,21,0.6)]" /> : <div className="h-6 mb-1.5" />}
      <div className="relative flex-shrink-0" title={track.track_name}>
        <SongCover songKey={`top-${track.key}`} title={track.track_name} artist={track.artist} cover={track.cover_url}
          previewUrl={track.preview_url} spotifyId={track.track_id} spotifyUrl={track.spotify_url} className={`${imgSize} shadow-lg`} rounded="rounded-xl" />
        <div className={`absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full bg-gradient-to-br ${rankBadgeBg} flex items-center justify-center text-white text-[10px] font-bold shadow-md border border-[#1E1440] pointer-events-none`}>{rank}</div>
      </div>
      <button onClick={onOpen} className={`w-full bg-gradient-to-t ${barGradient} border-t-2 ${rankBorderColor} flex flex-col items-center justify-start px-1.5 pt-2 pb-1 rounded-b-lg`} style={{ height: barHeight }}>
        <p className="text-[11px] font-bold text-white text-center leading-tight line-clamp-2 w-full">{track.track_name}</p>
        <p className="text-[9px] text-purple-300/85 truncate w-full text-center mt-0.5">{track.artist}</p>
        <span className="flex items-center gap-0.5 mt-1 text-[9px] text-purple-300/85 font-medium"><Repeat2 className="w-2.5 h-2.5" />{track.shakes}×</span>
      </button>
    </motion.div>
  );
}

// Tous les posts d'un même son (qui l'a shaké / reshaké) : un toucher ouvre le post (P2).
function SongPostsSheet({ song, onClose }: { song: any; onClose: () => void }) {
  useBackHandler(true, onClose);
  const [posts, setPosts] = useState<any[] | null>(null);
  useEffect(() => {
    const ids: string[] = song.post_ids || [song.post_id];
    supabase.from('posts')
      .select('id, created_at, text, is_reshake, likes_count, user:users_profile!posts_user_id_fkey(id, username, display_name, profile_album_cover_url)')
      .in('id', ids)
      .order('created_at', { ascending: false })
      .then(({ data }) => setPosts(data || []), () => setPosts([]));
  }, [song.key]); // eslint-disable-line react-hooks/exhaustive-deps
  return createPortal(
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/70" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
        <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
          className="pointer-events-auto w-full sm:max-w-md max-h-[75dvh] bg-[#1D0F3D] rounded-t-3xl sm:rounded-2xl border-t sm:border border-purple-700/40 flex flex-col overflow-hidden">
          <div className="flex items-center gap-3 p-4 border-b border-purple-800/30">
            <img src={thumb(song.cover_url, 128)} alt="" className="w-12 h-12 rounded-lg object-cover" />
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate">{song.track_name}</p>
              <p className="text-xs text-purple-300/90 truncate">{song.artist}</p>
            </div>
            <button aria-label="Fermer" onClick={onClose} className="p-1.5 rounded-full hover:bg-purple-900/40"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {posts === null ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-purple-400" /></div> : posts.map((p) => {
              const u = Array.isArray(p.user) ? p.user[0] : p.user;
              return (
                <button key={p.id} onClick={() => { onClose(); openPost(p.id); }} className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-purple-900/30 text-left">
                  <img src={avatarThumb(u?.profile_album_cover_url, 64) || defaultAvatar(u?.username)} alt="" className="w-9 h-9 rounded-full object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm"><span className="font-semibold">@{u?.username}</span> <span className="text-purple-300/90">{p.is_reshake ? 'a reshaké' : 'a shaké'}</span></p>
                    {p.text && <p className="text-xs text-purple-200/85 truncate">« {p.text} »</p>}
                  </div>
                  <span className="text-[10px] text-purple-300/85 flex-shrink-0">{formatRelative(p.created_at)}</span>
                </button>
              );
            })}
          </div>
        </motion.div>
      </div>
    </>,
    document.body,
  );
}

// Mon résumé (mêmes règles que le profil : pas de cercle, pas de privé).
function MyWrap({ period }: { period: Period }) {
  const [wrap, setWrap] = useState<any>(null);
  const [open, setOpen] = useState(true);
  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      if (!user) return;
      let q = supabase.from('posts').select('is_reshake, artist').eq('user_id', user.id).is('circle_id', null).not('is_private', 'is', true);
      if (period > 0) q = q.gte('created_at', new Date(Date.now() - period * 86_400_000).toISOString());
      const { data } = await q;
      const mine = (data || []).filter((p: any) => !p.is_reshake);
      const counts: Record<string, number> = {};
      mine.forEach((p: any) => { const a = (p.artist || '').split(',')[0].trim(); if (a) counts[a] = (counts[a] || 0) + 1; });
      setWrap({
        shakes: mine.length,
        reshakes: (data || []).length - mine.length,
        topArtist: Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
      });
    })().catch(() => {});
  }, [period]);
  if (!wrap) return null;
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl px-3.5 py-2.5">
        <span className="flex items-center gap-2 text-sm font-bold"><BarChart3 className="w-4 h-4 text-fuchsia-400" />{period === 7 ? 'Mon résumé de la semaine' : period === 30 ? 'Mon résumé du mois' : 'Mon résumé depuis le début'}</span>
        {open ? <ChevronUp className="w-4 h-4 text-purple-300/80" /> : <ChevronDown className="w-4 h-4 text-purple-300/80" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="grid grid-cols-3 gap-2 mt-2">
              <Stat icon={<Music className="w-4 h-4" />} value={wrap.shakes} label="Shakes" />
              <Stat icon={<Repeat2 className="w-4 h-4" />} value={wrap.reshakes} label="Reshakes" />
              <Stat icon={<TrendingUp className="w-4 h-4" />} value={wrap.topArtist || '–'} label="Artiste top" small />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Stat({ icon, value, label, small }: { icon: React.ReactNode; value: any; label: string; small?: boolean }) {
  return (
    <div className="bg-violet-950/25 border border-purple-500/15 rounded-xl p-2.5">
      <div className="text-purple-300 mb-1">{icon}</div>
      <p className={`${small ? 'text-xs' : 'text-lg'} font-bold text-white truncate leading-tight`}>{value}</p>
      <p className="text-[10px] text-purple-300/80">{label}</p>
    </div>
  );
}
