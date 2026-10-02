// Sons épinglés (P24) : 1 à 3 grandes pochettes en haut du profil, avec une
// petite épingle violette. Lecture au toucher (M2). Sur mon profil : épingler un
// son (recherche) ou un de mes posts, désépingler, changer l'ordre.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pin, Plus, Search, Loader2, X, ArrowLeft, ArrowRight, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { spotify } from '../../lib/spotify';
import { getOdesliLinks, getSongPreview } from '../../lib/odesli';
import { SongCover } from './SongCover';
import { useBackHandler } from '../../lib/navigation';

export const MAX_PINS = 3;

export async function fetchPins(userId: string): Promise<any[]> {
  const { data } = await supabase.from('pinned_songs').select('*').eq('user_id', userId).order('position');
  return data || [];
}

/** Épingle un son (objet piste de la recherche, ou un post). Renvoie un message d'erreur ou null. */
export async function pinSong(track: any, fromPost?: any): Promise<string | null> {
  const { data: sess } = await supabase.auth.getSession();
  const me = sess.session?.user.id;
  if (!me) return 'Connecte-toi.';
  const current = await fetchPins(me);
  if (current.length >= MAX_PINS) return `Tu as déjà ${MAX_PINS} sons épinglés : désépingles-en un d'abord.`;
  const used = new Set(current.map((p) => p.position));
  const position = [1, 2, 3].find((n) => !used.has(n))!;
  let row: any;
  if (fromPost) {
    row = {
      post_id: fromPost.id, track_name: fromPost.track_name, artist: fromPost.artist, cover_url: fromPost.cover_url,
      track_id: fromPost.track_id, spotify_url: fromPost.spotify_url, preview_url: fromPost.preview_url, preview_source: fromPost.preview_source,
      apple_music_url: fromPost.apple_music_url, deezer_url: fromPost.deezer_url, youtube_url: fromPost.youtube_url,
      youtube_music_url: fromPost.youtube_music_url, tidal_url: fromPost.tidal_url, odesli_page_url: fromPost.odesli_page_url,
    };
  } else {
    const spotifyUrl = track.spotify_url || (track.id ? `https://open.spotify.com/track/${track.id}` : null);
    const meta = { title: track.name, artist: track.artist };
    const [links, preview] = await Promise.all([
      getOdesliLinks(spotifyUrl || '', meta).catch(() => ({})),
      getSongPreview(spotifyUrl || track.id || '', meta, track.preview_url).catch(() => ({})),
    ]);
    row = { track_name: track.name, artist: track.artist, cover_url: track.cover, track_id: track.id, spotify_url: spotifyUrl, ...links, ...preview };
  }
  if (current.some((p) => (p.track_id && p.track_id === row.track_id) || (p.track_name === row.track_name && p.artist === row.artist))) return 'Ce son est déjà épinglé.';
  const { error } = await supabase.from('pinned_songs').insert({ ...row, user_id: me, position });
  if (error) return 'Le son n’a pas pu être épinglé. Réessaie.';
  window.dispatchEvent(new CustomEvent('shakemoi:pins-changed'));
  return null;
}

export function PinnedSongs({ userId, isOwn = false }: { userId: string; isOwn?: boolean }) {
  const [pins, setPins] = useState<any[] | null>(null);
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const load = () => fetchPins(userId).then(setPins).catch(() => setPins([]));
  useEffect(() => {
    load();
    const on = () => load();
    window.addEventListener('shakemoi:pins-changed', on);
    return () => window.removeEventListener('shakemoi:pins-changed', on);
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!pins || (pins.length === 0 && !isOwn)) return null;

  const unpin = async (id: string) => {
    setEditing(null);
    setPins((p) => (p || []).filter((x) => x.id !== id));
    await supabase.from('pinned_songs').delete().eq('id', id);
    load();
  };
  const move = async (id: string, dir: -1 | 1) => {
    const list = [...(pins || [])];
    const i = list.findIndex((x) => x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    setPins(list);
    await supabase.rpc('reorder_pinned_songs', { p_ids: list.map((x) => x.id) });
  };

  return (
    <div className="mt-4">
      <p className="text-[11px] text-purple-300/60 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Pin className="w-3 h-3 text-fuchsia-400 fill-fuchsia-400" /> Sons épinglés</p>
      <div className="grid grid-cols-3 gap-2">
        {pins.map((p, i) => (
          <div key={p.id} className="relative">
            <SongCover songKey={`pin-${p.id}`} title={p.track_name} artist={p.artist} cover={p.cover_url}
              previewUrl={p.preview_url} spotifyId={p.track_id} spotifyUrl={p.spotify_url} className="w-full aspect-square" rounded="rounded-xl" />
            <span className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-[#1E1440]/80 flex items-center justify-center pointer-events-none">
              <Pin className="w-3.5 h-3.5 text-fuchsia-400 fill-fuchsia-400" />
            </span>
            <button onClick={() => isOwn && setEditing(editing === p.id ? null : p.id)} className="w-full text-left mt-1" disabled={!isOwn}>
              <p className="text-xs font-semibold text-white truncate">{p.track_name}</p>
              <p className="text-[11px] text-purple-300/60 truncate">{p.artist}</p>
            </button>
            {isOwn && editing === p.id && (
              <div className="absolute inset-x-0 top-0 z-10 aspect-square rounded-xl bg-black/75 flex flex-col items-center justify-center gap-1.5">
                <div className="flex gap-1.5">
                  <button aria-label="Vers la gauche" disabled={i === 0} onClick={() => move(p.id, -1)} className="p-2 rounded-full bg-purple-800/80 disabled:opacity-30"><ArrowLeft className="w-4 h-4" /></button>
                  <button aria-label="Vers la droite" disabled={i === pins.length - 1} onClick={() => move(p.id, 1)} className="p-2 rounded-full bg-purple-800/80 disabled:opacity-30"><ArrowRight className="w-4 h-4" /></button>
                </div>
                <button onClick={() => unpin(p.id)} className="px-2.5 py-1 rounded-full bg-pink-600/90 text-[11px] font-semibold flex items-center gap-1"><Trash2 className="w-3 h-3" /> Désépingler</button>
                <button onClick={() => setEditing(null)} className="text-[11px] text-purple-200 underline">Fermer</button>
              </div>
            )}
          </div>
        ))}
        {isOwn && pins.length < MAX_PINS && (
          <button onClick={() => setPicking(true)} className="aspect-square rounded-xl border-2 border-dashed border-purple-500/40 flex flex-col items-center justify-center gap-1 text-purple-300 hover:bg-purple-900/30">
            <Plus className="w-6 h-6" />
            <span className="text-[11px] font-semibold text-center px-1">Épingler un son</span>
          </button>
        )}
      </div>
      {isOwn && pins.length > 0 && <p className="text-[10px] text-purple-300/50 mt-1">Touche un titre pour le déplacer ou le désépingler.</p>}
      {picking && <PinPicker onClose={() => setPicking(false)} />}
    </div>
  );
}

function PinPicker({ onClose }: { onClose: () => void }) {
  useBackHandler(true, onClose);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => { try { setResults(await spotify.searchTracks(q.trim())); } catch { /* rien */ } }, 350);
    return () => clearTimeout(t);
  }, [q]);
  const pick = async (t: any) => {
    setBusy(t.id);
    setError(null);
    const err = await pinSong(t);
    setBusy(null);
    if (err) setError(err); else onClose();
  };
  return createPortal(
    <div className="fixed inset-0 z-[65] bg-black/70 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-md h-[80dvh] bg-[#1D0F3D] rounded-t-3xl sm:rounded-2xl border-t sm:border border-purple-700/40 flex flex-col overflow-hidden" role="dialog" aria-label="Épingler un son">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-purple-800/30">
          <Pin className="w-4 h-4 text-fuchsia-400" />
          <p className="flex-1 font-bold">Épingler un son</p>
          <button aria-label="Fermer" onClick={onClose} className="p-1.5 rounded-full hover:bg-purple-900/40"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300/60" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ce que tu écoutes en ce moment…" className="w-full pl-9 pr-3 py-2.5 bg-violet-950/40 border border-purple-500/30 rounded-xl text-base sm:text-sm text-white placeholder-purple-300/40 focus:outline-none focus:border-pink-400" />
          </div>
          {error && <p className="text-xs text-pink-300 mt-2">{error}</p>}
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {results.map((t) => (
            <button key={t.id} onClick={() => pick(t)} disabled={!!busy} className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-purple-900/30 text-left disabled:opacity-60">
              <img src={t.cover} alt="" className="w-11 h-11 rounded-md object-cover" />
              <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{t.name}</p><p className="text-xs text-purple-300/60 truncate">{t.artist}</p></div>
              {busy === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pin className="w-4 h-4 text-fuchsia-400" />}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
