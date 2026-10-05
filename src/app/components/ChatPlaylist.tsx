// Playlist d'une conversation (P21 pour les cercles, R3 pour les messages
// privés) : un vrai écran à la place de la conversation (même en-tête). Tous
// les sons partagés, du plus récent au plus ancien ; un son partagé plusieurs
// fois n'apparaît qu'une fois (« partagé 3 fois ») ; les messages retirés n'y
// sont pas. « Tout écouter » et chaque ligne jouent dans LE lecteur de
// l'appli (R5) : la lecture continue quand on quitte l'écran.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, MessageCircle, Play, Pause, Loader2, Users, Music, ListMusic } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { MediaImg, thumb, avatarThumb, defaultAvatar } from '../../lib/media';
import { formatPostDate } from '../../lib/dates';
import { songKeyOf } from '../../lib/listenLog';
import { usePlayer, playQueue, togglePlayer, current as currentTrack, type PlayerTrack, type PlayerSource } from '../../lib/player';
import { getPreviewState, onPreviewChange } from '../../lib/preview';

export type ChatKind = 'dm' | 'circle';

interface Entry {
  key: string;
  track_name: string;
  artist: string;
  cover_url: string | null;
  preview_url: string | null;
  track_id: string | null;
  count: number;
  lastAt: string;
  lastById: string;
  lastBy: string;
  messageId: string;
}

/** Id d'un son de conversation dans le lecteur (le même que sa bulle). */
export const chatTrackId = (kind: ChatKind, messageId: string) => `${kind}-${messageId}`;
export const chatSource = (kind: ChatKind, id: string, name: string): PlayerSource => kind === 'circle'
  ? { kind: 'circle', label: `Playlist ${name}`, target: `circle-playlist:${id}` }
  : { kind: 'dm', label: `Playlist avec ${name}`, target: `dm-playlist:${id}` };

export function ChatPlaylist({ kind, id, name, photoUrl, avatarName, subtitle, currentUserId, onBack, onChat, onOpenMessage, onSendFirst }: {
  kind: ChatKind; id: string; name: string; photoUrl: string | null; avatarName?: string; subtitle: string; currentUserId: string;
  onBack: () => void; onChat: () => void; onOpenMessage: (messageId: string) => void; onSendFirst: () => void;
}) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [byPerson, setByPerson] = useState<{ id: string; name: string; n: number }[]>([]);
  const [total, setTotal] = useState(0);
  const player = usePlayer();
  const [, setTick] = useState(0);
  useEffect(() => onPreviewChange(() => setTick((n) => n + 1)), []);
  const press = useRef<number | null>(null);

  useEffect(() => {
    let off = false;
    const q = kind === 'circle'
      ? supabase.from('circle_messages')
        .select('id, sender_id, track_name, artist, cover_url, preview_url, track_id, spotify_url, created_at, sender:users_profile!circle_messages_sender_id_fkey(username, display_name)')
        .eq('circle_id', id)
      : supabase.from('messages')
        .select('id, sender_id, track_name, artist, cover_url, preview_url, track_id, spotify_url, created_at, sender:users_profile!messages_sender_id_fkey(username, display_name)')
        .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${id}),and(sender_id.eq.${id},receiver_id.eq.${currentUserId})`);
    q.not('track_name', 'is', null).is('deleted_at', null)
      .order('created_at', { ascending: false }).limit(500)
      .then(({ data }) => {
        if (off) return;
        const map = new Map<string, Entry>();
        const people = new Map<string, { id: string; name: string; n: number }>();
        for (const m of (data as any[]) || []) {
          if (!m.track_name || m.deleted_at) continue;
          const s = Array.isArray(m.sender) ? m.sender[0] : m.sender;
          const p = people.get(m.sender_id) || { id: m.sender_id, name: m.sender_id === currentUserId ? 'toi' : (s?.display_name || s?.username || '…'), n: 0 };
          p.n++;
          people.set(m.sender_id, p);
          const k = songKeyOf(m.track_name, m.artist);
          const e = map.get(k);
          if (e) { e.count++; continue; }
          map.set(k, {
            key: k, track_name: m.track_name, artist: m.artist, cover_url: m.cover_url, preview_url: m.preview_url,
            track_id: m.track_id || m.spotify_url?.match(/track\/([a-zA-Z0-9]+)/)?.[1] || null,
            count: 1, lastAt: m.created_at, lastById: m.sender_id, lastBy: s?.username || '', messageId: m.id,
          });
        }
        setTotal((data || []).length);
        // « toi » d'abord, puis les autres par nombre de sons.
        setByPerson([...people.values()].sort((a, b) => (a.id === currentUserId ? -1 : b.id === currentUserId ? 1 : b.n - a.n)));
        setEntries([...map.values()]);
      }, () => { if (!off) setEntries([]); });
    return () => { off = true; };
  }, [kind, id, currentUserId]);

  const tracks: PlayerTrack[] = useMemo(() => (entries || []).map((e) => ({
    id: chatTrackId(kind, e.messageId), title: e.track_name, artist: e.artist, cover: e.cover_url, previewUrl: e.preview_url, spotifyId: e.track_id,
  })), [entries, kind]);
  const source = chatSource(kind, id, name);
  const cur = currentTrack();
  const curId = player.active ? cur?.id : null;
  const st = getPreviewState();

  // « 24 sons échangés · toi 13 · Bapt 11 »
  const phrase = total
    ? `${total} son${total > 1 ? 's' : ''} ${kind === 'dm' ? 'échangé' : 'partagé'}${total > 1 ? 's' : ''} · ${byPerson.slice(0, 3).map((p) => `${p.name} ${p.n}`).join(' · ')}${byPerson.length > 3 ? ` · +${byPerson.length - 3}` : ''}`
    : '';

  return (
    <div className="flex flex-col flex-1 overflow-hidden min-h-0">
      {/* En-tête (le même que la conversation) */}
      <div className="px-3 py-2.5 border-b border-purple-500/25 flex items-center gap-2.5 flex-shrink-0 bg-[#1E1440]/95">
        <button onClick={onBack} aria-label="Retour" className="w-10 h-10 -ml-1 flex items-center justify-center hover:bg-violet-900/25 rounded-full"><ArrowLeft className="w-5 h-5" /></button>
        <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
          {kind === 'circle'
            ? (photoUrl ? <MediaImg src={photoUrl} width={128} className="w-full h-full object-cover" alt="" />
              : <div className="w-full h-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center"><Users className="w-4 h-4 text-white" /></div>)
            : <img src={avatarThumb(photoUrl) || defaultAvatar(avatarName || name)} alt="" className="w-full h-full object-cover" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{name}</p>
          <p className="text-xs text-purple-200 truncate flex items-center gap-1"><ListMusic className="w-3 h-3" /> Playlist · {subtitle}</p>
        </div>
        <button onClick={onChat} aria-label="Revenir à la conversation" title="Conversation" className="w-11 h-11 flex items-center justify-center rounded-full text-purple-200 hover:bg-violet-900/25"><MessageCircle className="w-5 h-5" /></button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 px-3 py-3">
        <div className="max-w-2xl mx-auto">
          {entries === null ? (
            <div className="space-y-2 pt-1" aria-label="Chargement">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-purple-300/10 animate-pulse" />)}
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-16 text-sm text-purple-200">
              <Music className="w-9 h-9 text-[#FFEFD5] mx-auto mb-3" />
              <p>Pas encore de son ici. Envoie le premier 🎵</p>
              <button onClick={onSendFirst} className="mt-4 min-h-[44px] px-5 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 font-bold text-white inline-flex items-center gap-2">
                <Music className="w-4 h-4" /> Envoyer un son
              </button>
            </div>
          ) : (
            <>
              {phrase && <p className="text-xs text-purple-200 text-center mb-2" data-playlist-phrase>{phrase}</p>}
              <button onClick={() => playQueue(tracks, 0, source)} className="w-full mb-3 min-h-[48px] rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 font-semibold flex items-center justify-center gap-2">
                <Play className="w-4 h-4 fill-white" /> Tout écouter <span className="text-xs font-normal opacity-85">· {entries.length} son{entries.length > 1 ? 's' : ''}</span>
              </button>
              <div className="space-y-1">
                {entries.map((e, i) => {
                  const tid = tracks[i].id;
                  const active = curId === tid;
                  const playing = active && st.key === tid && st.playing;
                  return (
                    <button key={e.key}
                      onClick={() => (active ? togglePlayer() : playQueue(tracks, i, source))}
                      onContextMenu={(ev) => { ev.preventDefault(); onOpenMessage(e.messageId); }}
                      onTouchStart={() => { press.current = window.setTimeout(() => { navigator.vibrate?.(10); onOpenMessage(e.messageId); }, 550); }}
                      onTouchEnd={() => { if (press.current) clearTimeout(press.current); }}
                      onTouchMove={() => { if (press.current) clearTimeout(press.current); }}
                      aria-current={active ? 'true' : undefined}
                      className={`w-full flex items-center gap-3 p-2 rounded-xl text-left select-none ${active ? 'bg-pink-500/15 border border-pink-500/40' : 'hover:bg-violet-950/40 border border-transparent'}`}>
                      <div className="relative w-12 h-12 flex-shrink-0">
                        {e.cover_url ? <img src={thumb(e.cover_url, 128)} alt="" className="w-12 h-12 rounded-lg object-cover" /> : <div className="w-12 h-12 rounded-lg bg-violet-900/50" />}
                        {active && (
                          <span className="absolute inset-0 rounded-lg bg-black/45 flex items-center justify-center">
                            {player.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : playing ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${active ? 'text-pink-200' : 'text-white'}`}>{e.track_name}</p>
                        <p className="text-xs text-purple-200 truncate">{e.artist}</p>
                        <p className="text-[11px] text-purple-200/90 truncate">
                          {e.lastById === currentUserId ? 'par toi' : `par @${e.lastBy}`} · {formatPostDate(e.lastAt)}{e.count > 1 ? ` · partagé ${e.count} fois` : ''}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-purple-200/90 text-center mt-3">Appui long sur un son : voir le message d'origine.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
