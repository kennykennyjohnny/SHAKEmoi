// Une conversation, privée OU de cercle : exactement les mêmes possibilités
// (lot 4). Bulles, double-tap = like (P9), appui long / clic droit = menu
// (Répondre, Copier, Liker, Retirer…), glisser vers la droite = répondre (P27),
// citation cliquable, @mentions (P28), « Vu » / « Vu par » (P12-4),
// « … est en train d'écrire » (P12-5), sourdine (P12-6), séparateur « Non lus »
// et bouton « ↓ nouveaux messages » (P12-7), sons partout (P12-9).
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Send, Search, Music, Loader2, X, Camera, Smile, Heart, Reply, Copy, Trash2, Bell, BellOff, ChevronDown, MoreHorizontal, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { spotify } from '../../lib/spotify';
import { getPlatformUrl } from '../../lib/odesli';
import { openExternal } from '../../lib/platforms';
import { SongCover } from './SongCover';
import { MediaImg, thumb, defaultAvatar, avatarThumb } from '../../lib/media';
import { searchGifs, GIF_ERROR_TEXT } from '../../lib/gifs';
import { formatDayLabel, isSameDay, formatTime } from '../../lib/dates';
import { MyAppLogo } from './PlatformLogo';
import { openProfile } from '../../lib/appNav';
import { setActiveChat, getActiveChat } from '../../lib/activeChat';
import {
  type ChatRef, CHAT_PAGE, fetchChatPage, fetchChatMessage, sendChatMessage, uploadChatPhoto, likedMessageIds,
  setMessageLike, messageLikers, retractMessage, markChatRead, fetchDmPartnerRead, fetchCircleReads,
  isChatMuted, setChatMuted, chatChannelKey, messageSnippet, type OutgoingMessage,
} from '../../lib/chatData';

interface ChatThreadProps {
  chat: ChatRef;
  currentUser: any;
  title: string;
  avatarUrl?: string | null;
  avatarName?: string;
  /** Cercle : pastille photo / icône à la place de l'avatar. */
  circlePhoto?: string | null;
  subtitle?: string;
  members?: any[];
  isCircleOwner?: boolean;
  /** Non-lus au moment d'ouvrir : séparateur « Non lus » au bon endroit. */
  initialUnread?: number;
  onBack: () => void;
  onHeaderClick?: () => void;
  headerActions?: ReactNode;
}

const isTemp = (m: any) => String(m.id).startsWith('temp-');
const INTERACTIVE = 'button, a, input, textarea, [data-no-gesture]';

export function ChatThread({
  chat, currentUser, title, avatarUrl, avatarName, circlePhoto, subtitle, members = [], isCircleOwner = false,
  initialUnread = 0, onBack, onHeaderClick, headerActions,
}: ChatThreadProps) {
  const me = currentUser?.id as string;
  const isCircle = chat.kind === 'circle';
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [menuMsg, setMenuMsg] = useState<any | null>(null);
  const [likersOf, setLikersOf] = useState<{ msg: any; users: any[] } | null>(null);
  const [burstId, setBurstId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null);
  const [partnerReadAt, setPartnerReadAt] = useState<string | null>(null);
  const [reads, setReads] = useState<any[]>([]);
  const [showSeen, setShowSeen] = useState(false);
  const [typing, setTyping] = useState<Record<string, { name: string; until: number }>>({});
  const [muted, setMuted] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  // Saisie
  const [text, setText] = useState('');
  const [caret, setCaret] = useState(0);
  const [panel, setPanel] = useState<'none' | 'track' | 'gif'>('none');
  const [trackQuery, setTrackQuery] = useState('');
  const [trackResults, setTrackResults] = useState<any[]>([]);
  const [gifQuery, setGifQuery] = useState('');
  const [gifResults, setGifResults] = useState<any[]>([]);
  const [gifError, setGifError] = useState<string | null>(null);
  const [gifSearching, setGifSearching] = useState(false);
  const [photo, setPhoto] = useState<{ file: File; preview: string } | null>(null);

  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<any>(null);
  const messagesRef = useRef<any[]>([]);
  messagesRef.current = messages;
  const atBottomRef = useRef(true);
  atBottomRef.current = atBottom;
  const keepOffsetRef = useRef<number | null>(null);

  const membersById = useMemo(() => Object.fromEntries(members.map((m: any) => [m.id, m])), [members]);
  const membersByName = useMemo(() => Object.fromEntries(members.map((m: any) => [String(m.username).toLowerCase(), m])), [members]);

  const flash = (t: string) => { setNotice(t); setTimeout(() => setNotice(null), 3000); };

  // Source de vérité partagée avec la colonne ordinateur (P13).
  useEffect(() => {
    setActiveChat(chat);
    return () => { const a = getActiveChat(); if (a?.kind === chat.kind && a?.id === chat.id) setActiveChat(null); };
  }, [chat.kind, chat.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Défilement ----------
  const scrollToBottom = (smooth = false) => {
    const box = boxRef.current;
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  };
  const onScroll = () => {
    const box = boxRef.current;
    if (!box) return;
    const bottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 80;
    setAtBottom(bottom);
    if (bottom) setNewCount(0);
  };
  // Clavier du téléphone : la zone visible rétrécit, on reste en bas.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => { if (atBottomRef.current) scrollToBottom(); };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);
  // Messages plus anciens chargés en haut : on garde la position de lecture.
  useEffect(() => {
    if (keepOffsetRef.current === null) return;
    const box = boxRef.current;
    if (box) box.scrollTop = box.scrollHeight - keepOffsetRef.current;
    keepOffsetRef.current = null;
  }, [messages]);

  // ---------- Lu ----------
  const readTimer = useRef<number | null>(null);
  const markRead = () => {
    if (document.visibilityState !== 'visible') return;
    if (readTimer.current) window.clearTimeout(readTimer.current);
    readTimer.current = window.setTimeout(() => {
      markChatRead(chat).catch(() => {});
      channelRef.current?.send({ type: 'broadcast', event: 'read', payload: { userId: me, at: new Date().toISOString() } });
    }, 400);
  };
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') markRead(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [chat.kind, chat.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Chargement ----------
  useEffect(() => {
    let off = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [page, isMuted] = await Promise.all([fetchChatPage(chat), isChatMuted(chat)]);
        if (off) return;
        setMessages(page);
        setHasMore(page.length === CHAT_PAGE);
        setMuted(isMuted);
        // Séparateur « Non lus » : avant le premier des N derniers messages reçus.
        if (initialUnread > 0) {
          const received = page.filter((m: any) => m.sender_id !== me && !m.kind && !m.deleted_at);
          const first = received[Math.max(0, received.length - initialUnread)];
          setFirstUnreadId(first?.id || null);
        }
        likedMessageIds(chat, page.map((m: any) => m.id)).then((s) => { if (!off) setLiked(s); });
        if (isCircle) fetchCircleReads(chat.id).then((r) => { if (!off) setReads(r); });
        else fetchDmPartnerRead(chat.id).then((r) => { if (!off) setPartnerReadAt(r); });
      } catch {
        if (!off) setError('Impossible de charger la conversation. Vérifie ta connexion.');
      }
      if (!off) setLoading(false);
      markRead();
    })();
    return () => { off = true; };
  }, [chat.kind, chat.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Première ouverture : on arrive sur les non-lus, sinon tout en bas.
  const placedRef = useRef(false);
  useEffect(() => { placedRef.current = false; }, [chat.kind, chat.id]);
  useEffect(() => {
    if (loading || placedRef.current) return;
    placedRef.current = true;
    requestAnimationFrame(() => {
      const el = firstUnreadId ? document.getElementById(`msg-${firstUnreadId}`) : null;
      if (el) el.scrollIntoView({ block: 'center' });
      else scrollToBottom();
      // Les images changent la hauteur après coup : on recale une fois.
      setTimeout(() => { if (!firstUnreadId) scrollToBottom(); }, 200);
    });
  }, [loading, firstUnreadId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Temps réel ----------
  useEffect(() => {
    if (!me) return;
    const key = chatChannelKey(chat, me);
    const table = isCircle ? 'circle_messages' : 'messages';
    const insertFilter = isCircle ? `circle_id=eq.${chat.id}` : `receiver_id=eq.${me}`;
    const updateFilter = isCircle ? `circle_id=eq.${chat.id}` : undefined;
    const involves = (m: any) => isCircle || (m.sender_id === chat.id && m.receiver_id === me) || (m.sender_id === me && m.receiver_id === chat.id);

    const ch = supabase.channel(`chat-${key}-${me}`, { config: { broadcast: { self: false } } })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter: insertFilter }, async (payload: any) => {
        const raw = payload.new;
        if (!raw || raw.sender_id === me || !involves(raw)) return;
        const full = (await fetchChatMessage(chat, raw.id)) || raw;
        setMessages((prev) => (prev.some((m) => m.id === full.id) ? prev : [...prev, full]));
        setTyping((t) => { const n = { ...t }; delete n[raw.sender_id]; return n; });
        if (atBottomRef.current) requestAnimationFrame(() => scrollToBottom(true));
        else setNewCount((c) => c + 1);
        markRead();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table, ...(updateFilter ? { filter: updateFilter } : {}) }, (payload: any) => {
        const n = payload.new;
        if (!n || !involves(n)) return;
        // Like compté, message retiré, renommage : la bulle suit sans recharger.
        setMessages((prev) => prev.map((m) => {
          if (m.id === n.id) return { ...m, ...n, sender: m.sender, story: m.story, reply: m.reply };
          if (m.reply?.id === n.id) return { ...m, reply: { ...m.reply, ...n } };
          return m;
        }));
      })
      .on('broadcast', { event: 'typing' }, ({ payload }: any) => {
        if (!payload?.userId || payload.userId === me) return;
        setTyping((t) => ({ ...t, [payload.userId]: { name: payload.name, until: Date.now() + 4000 } }));
      })
      .on('broadcast', { event: 'read' }, ({ payload }: any) => {
        if (!payload?.userId || payload.userId === me) return;
        if (isCircle) setReads((r) => r.map((x) => (x.user_id === payload.userId ? { ...x, last_read_at: payload.at } : x)));
        else if (payload.userId === chat.id) setPartnerReadAt(payload.at);
      })
      .subscribe();
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); channelRef.current = null; };
  }, [chat.kind, chat.id, me]); // eslint-disable-line react-hooks/exhaustive-deps

  // « écrit… » disparaît tout seul.
  useEffect(() => {
    const keys = Object.keys(typing);
    if (!keys.length) return;
    const t = setInterval(() => setTyping((cur) => {
      const now = Date.now();
      const next = Object.fromEntries(Object.entries(cur).filter(([, v]) => v.until > now));
      return Object.keys(next).length === Object.keys(cur).length ? cur : next;
    }), 1000);
    return () => clearInterval(t);
  }, [typing]);

  const lastTypingSent = useRef(0);
  const sendTyping = () => {
    const now = Date.now();
    if (now - lastTypingSent.current < 2500) return;
    lastTypingSent.current = now;
    channelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { userId: me, name: currentUser?.username } });
  };

  // ---------- Messages plus anciens ----------
  const loadOlder = async (): Promise<any[]> => {
    if (loadingOlder) return [];
    const oldest = messagesRef.current.find((m) => !isTemp(m));
    if (!oldest) return [];
    setLoadingOlder(true);
    try {
      const older = await fetchChatPage(chat, oldest.created_at);
      setHasMore(older.length === CHAT_PAGE);
      const box = boxRef.current;
      keepOffsetRef.current = box ? box.scrollHeight - box.scrollTop : 0;
      setMessages((prev) => [...older.filter((o) => !prev.some((p) => p.id === o.id)), ...prev]);
      likedMessageIds(chat, older.map((m: any) => m.id)).then((s) => setLiked((cur) => new Set([...cur, ...s])));
      setLoadingOlder(false);
      return older;
    } catch {
      setLoadingOlder(false);
      return [];
    }
  };

  // Toucher une citation : on remonte jusqu'au message d'origine et on le surligne.
  const jumpTo = async (id: string) => {
    let tries = 0;
    while (!messagesRef.current.some((m) => m.id === id) && tries < 6) {
      const older = await loadOlder();
      if (!older.length) break;
      tries++;
      await new Promise((r) => setTimeout(r, 50));
    }
    requestAnimationFrame(() => {
      const el = document.getElementById(`msg-${id}`);
      if (!el) { flash('Ce message est trop ancien pour être affiché.'); return; }
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightId(id);
      setTimeout(() => setHighlightId((h) => (h === id ? null : h)), 1600);
    });
  };

  // ---------- Envoi (optimiste, avec Réessayer) ----------
  const sendOptimistic = async (temp: any, run: () => Promise<{ success: boolean; data?: any }>) => {
    setMessages((prev) => [...prev.filter((m) => m.id !== temp.id), { ...temp, _status: 'sending' }]);
    requestAnimationFrame(() => scrollToBottom(true));
    let r: { success: boolean; data?: any } = { success: false };
    try { r = await run(); } catch { /* traité plus bas */ }
    setMessages((prev) => {
      if (!r.success) return prev.map((m) => (m.id === temp.id ? { ...m, _status: 'failed' } : m));
      if (prev.some((m) => m.id === r.data?.id)) return prev.filter((m) => m.id !== temp.id);
      return prev.map((m) => (m.id === temp.id ? { ...r.data, sender: r.data.sender || currentUser } : m));
    });
  };

  const mentionIdsIn = (t: string) => (isCircle
    ? members.filter((m: any) => m.id !== me && new RegExp(`(^|\\s)@${m.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w.-])`, 'i').test(t)).map((m: any) => m.id)
    : []);

  const send = (payload: OutgoingMessage & { preview?: any }) => {
    const reply = replyTo;
    const temp: any = {
      id: `temp-${Date.now()}`, sender_id: me, sender: currentUser, created_at: new Date().toISOString(),
      text: payload.text || null, image_url: payload.preview?.image || payload.imageUrl || null,
      reply_to_id: reply?.id || null, reply: reply || null, likes_count: 0,
      ...(payload.track ? { track_name: payload.track.name || payload.track.title, artist: payload.track.artist, cover_url: payload.track.cover || payload.track.coverUrl } : {}),
    };
    const out: OutgoingMessage = { text: payload.text, track: payload.track, imageUrl: payload.imageUrl, replyToId: reply?.id || null, mentionedIds: payload.text ? mentionIdsIn(payload.text) : [] };
    temp._retry = () => sendOptimistic(temp, () => sendChatMessage(chat, out));
    setReplyTo(null);
    temp._retry();
  };

  const sendText = () => {
    const t = text.trim();
    if (photo) { sendPhoto(); return; }
    if (!t) return;
    setText('');
    send({ text: t });
  };

  const sendPhoto = () => {
    if (!photo) return;
    const { file, preview } = photo;
    const caption = text.trim() || null;
    setPhoto(null);
    setText('');
    const reply = replyTo;
    const temp: any = { id: `temp-${Date.now()}`, sender_id: me, sender: currentUser, created_at: new Date().toISOString(), image_url: preview, text: caption, reply_to_id: reply?.id || null, reply, likes_count: 0 };
    temp._retry = () => sendOptimistic(temp, async () => {
      const url = await uploadChatPhoto(chat, file);
      if (!url) return { success: false };
      return sendChatMessage(chat, { imageUrl: url, text: caption, replyToId: reply?.id || null, mentionedIds: caption ? mentionIdsIn(caption) : [] });
    });
    setReplyTo(null);
    temp._retry();
  };

  // ---------- Like (P9) ----------
  const likeBusy = useRef<Set<string>>(new Set());
  const toggleLike = async (msg: any, forceLike = false) => {
    if (isTemp(msg) || msg.deleted_at || msg.kind || likeBusy.current.has(msg.id)) return;
    const was = liked.has(msg.id);
    const next = forceLike ? true : !was;
    if (next === was) return;
    likeBusy.current.add(msg.id);
    const apply = (on: boolean) => {
      setLiked((s) => { const n = new Set(s); if (on) n.add(msg.id); else n.delete(msg.id); return n; });
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, likes_count: Math.max(0, (m.likes_count || 0) + (on ? 1 : -1)) } : m)));
    };
    apply(next);
    const ok = await setMessageLike(chat, msg.id, next);
    if (!ok) { apply(was); flash('Le like n’est pas passé. Réessaie.'); }
    likeBusy.current.delete(msg.id);
  };

  // ---------- Gestes sur une bulle ----------
  const tapRef = useRef<{ id: string; t: number } | null>(null);
  const press = useRef<{ id: string; x: number; y: number; timer: number | null; swiping: boolean; moved: boolean } | null>(null);
  const [swipe, setSwipe] = useState<{ id: string; dx: number } | null>(null);

  const onBubbleClick = (e: React.MouseEvent, msg: any) => {
    if ((e.target as HTMLElement).closest(INTERACTIVE)) return;
    const now = Date.now();
    if (tapRef.current && tapRef.current.id === msg.id && now - tapRef.current.t < 320) {
      tapRef.current = null;
      // Double-tap : like (jamais « unlike » par erreur), petit cœur animé.
      if (!msg.deleted_at && !isTemp(msg)) {
        setBurstId(msg.id);
        setTimeout(() => setBurstId((b) => (b === msg.id ? null : b)), 750);
        if (liked.has(msg.id)) toggleLike(msg); else toggleLike(msg, true);
      }
    } else {
      tapRef.current = { id: msg.id, t: now };
    }
  };
  const onTouchStart = (e: React.TouchEvent, msg: any) => {
    if ((e.target as HTMLElement).closest(INTERACTIVE)) return;
    const t = e.touches[0];
    const timer = window.setTimeout(() => {
      if (press.current && !press.current.moved) { navigator.vibrate?.(12); setMenuMsg(msg); }
    }, 450);
    press.current = { id: msg.id, x: t.clientX, y: t.clientY, timer, swiping: false, moved: false };
  };
  const onTouchMove = (e: React.TouchEvent, msg: any) => {
    const p = press.current;
    if (!p || p.id !== msg.id) return;
    const t = e.touches[0];
    const dx = t.clientX - p.x;
    const dy = t.clientY - p.y;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) { p.moved = true; if (p.timer) { clearTimeout(p.timer); p.timer = null; } }
    // Glisser vers la droite = répondre (pas depuis le bord gauche : geste retour d'iPhone).
    if (!p.swiping && dx > 12 && Math.abs(dy) < 14 && p.x > 28 && !msg.deleted_at && !msg.kind && !isTemp(msg)) p.swiping = true;
    if (p.swiping) setSwipe({ id: msg.id, dx: Math.max(0, Math.min(80, dx)) });
  };
  const onTouchEnd = (msg: any) => {
    const p = press.current;
    if (p?.timer) clearTimeout(p.timer);
    if (p?.swiping && swipe && swipe.id === msg.id && swipe.dx > 55) { setReplyTo(msg); inputRef.current?.focus(); navigator.vibrate?.(8); }
    press.current = null;
    setSwipe(null);
  };

  // ---------- Menu d'actions ----------
  const canRetract = (m: any) => !m.deleted_at && !m.kind && !isTemp(m) && (m.sender_id === me || (isCircle && isCircleOwner));
  const doRetract = async (m: any) => {
    setMenuMsg(null);
    if (!confirm(m.sender_id === me ? 'Retirer ce message pour tout le monde ?' : 'Retirer ce message (modération du cercle) ?')) return;
    const before = messagesRef.current;
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, deleted_at: new Date().toISOString(), text: null, image_url: null, track_name: null, likes_count: 0 } : x)));
    const r = await retractMessage(chat, m.id);
    if (!r.success) { setMessages(before); flash('Le message n’a pas pu être retiré. Réessaie.'); }
  };
  const doCopy = async (m: any) => {
    setMenuMsg(null);
    const t = m.text || (m.track_name ? `${m.track_name} — ${m.artist || ''}` : '');
    try { await navigator.clipboard.writeText(t); flash('Copié'); } catch { flash('Impossible de copier ici.'); }
  };
  const showLikers = async (m: any) => {
    setMenuMsg(null);
    setLikersOf({ msg: m, users: await messageLikers(chat, m.id) });
  };

  // ---------- Saisie : @mentions (cercles) ----------
  const mentionQuery = useMemo(() => {
    if (!isCircle) return null;
    const before = text.slice(0, caret);
    const m = before.match(/(^|\s)@([a-z0-9._-]*)$/i);
    return m ? m[2].toLowerCase() : null;
  }, [text, caret, isCircle]);
  const mentionOptions = mentionQuery === null ? [] : members
    .filter((m: any) => m.id !== me && (m.username.toLowerCase().startsWith(mentionQuery) || (m.display_name || '').toLowerCase().includes(mentionQuery)))
    .slice(0, 6);
  const pickMention = (m: any) => {
    const before = text.slice(0, caret).replace(/@([a-z0-9._-]*)$/i, `@${m.username} `);
    const next = before + text.slice(caret);
    setText(next);
    setCaret(before.length);
    requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.setSelectionRange(before.length, before.length); });
  };

  // ---------- Recherche de sons / GIF ----------
  useEffect(() => {
    if (panel !== 'track' || trackQuery.length < 2) { setTrackResults([]); return; }
    const t = setTimeout(async () => { try { setTrackResults(await spotify.searchTracks(trackQuery)); } catch { /* rien */ } }, 400);
    return () => clearTimeout(t);
  }, [trackQuery, panel]);
  useEffect(() => {
    if (panel !== 'gif') return;
    const t = setTimeout(async () => {
      setGifSearching(true);
      try { const r = await searchGifs(gifQuery.length < 2 ? '' : gifQuery); setGifResults(r.gifs); setGifError(r.error ? GIF_ERROR_TEXT[r.error] : null); }
      catch { setGifResults([]); }
      setGifSearching(false);
    }, gifQuery ? 400 : 0);
    return () => clearTimeout(t);
  }, [gifQuery, panel]);

  // ---------- Affichage ----------
  const renderText = (t: string) => {
    if (!isCircle) return t;
    return t.split(/(@[a-z0-9._-]+)/gi).map((part, i) => {
      const u = part.startsWith('@') ? membersByName[part.slice(1).toLowerCase()] : null;
      return u
        ? <button key={i} data-no-gesture onClick={(e) => { e.stopPropagation(); openProfile(u.id); }} className="font-semibold text-pink-300 hover:underline">{part}</button>
        : <span key={i}>{part}</span>;
    });
  };

  const lastMine = [...messages].reverse().find((m) => m.sender_id === me && !isTemp(m) && !m.kind && !m.deleted_at);
  const seenBy = isCircle && lastMine ? reads.filter((r) => r.user_id !== me && r.last_read_at && new Date(r.last_read_at) >= new Date(lastMine.created_at)) : [];
  const dmSeen = !isCircle && lastMine && partnerReadAt && new Date(partnerReadAt) >= new Date(lastMine.created_at);
  const typingNames = Object.values(typing).map((t) => `@${t.name}`);

  const seenLabel = () => {
    if (isCircle) {
      if (!seenBy.length) return 'Envoyé';
      return seenBy.length >= Math.max(1, members.length - 1) ? 'Vu par tout le monde' : `Vu par ${seenBy.length}`;
    }
    if (!dmSeen) return 'Envoyé';
    const d = new Date(partnerReadAt!);
    return isSameDay(d, new Date()) ? `Vu à ${formatTime(d)}` : `Vu le ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
  };

  const toggleMute = async () => {
    const next = !muted;
    setMuted(next);
    if (!(await setChatMuted(chat, next))) { setMuted(!next); flash('Réessaie dans un instant.'); }
    else flash(next ? 'Sourdine : plus de notifs ni de pastille pour cette conversation.' : 'Notifications réactivées.');
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden min-h-0 relative">
      {/* En-tête */}
      <div className="px-3 py-2.5 border-b border-purple-500/25 flex items-center gap-2.5 flex-shrink-0 bg-[#1E1440]/95 backdrop-blur-sm">
        <button onClick={onBack} aria-label="Retour" className="p-1.5 hover:bg-violet-900/25 rounded-full"><ArrowLeft className="w-5 h-5" /></button>
        <button onClick={onHeaderClick} className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
          <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
            {isCircle ? (
              circlePhoto ? <MediaImg src={circlePhoto} width={128} className="w-full h-full object-cover" alt="" />
                : <div className="w-full h-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center"><Users className="w-4 h-4 text-white" /></div>
            ) : (
              <img src={avatarThumb(avatarUrl, 128) || defaultAvatar(avatarName)} className="w-full h-full object-cover" alt="" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate" data-testid="chat-title">{title}</p>
            <p className={`text-xs truncate ${typingNames.length ? 'text-pink-300' : 'text-purple-300/70'}`}>
              {typingNames.length ? (isCircle ? `${typingNames.slice(0, 2).join(', ')} ${typingNames.length > 1 ? 'écrivent' : 'écrit'}…` : 'est en train d’écrire…') : subtitle}
            </p>
          </div>
        </button>
        <button onClick={toggleMute} aria-label={muted ? 'Réactiver les notifications' : 'Mettre en sourdine'} title={muted ? 'En sourdine' : 'Mettre en sourdine'}
          className={`p-2 rounded-full ${muted ? 'text-pink-300 bg-pink-500/10' : 'text-purple-300/70 hover:bg-violet-900/25'}`}>
          {muted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
        </button>
        {headerActions}
      </div>

      {/* Messages */}
      <div ref={boxRef} onScroll={onScroll} className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 min-h-0">
        {hasMore && (
          <div className="flex justify-center mb-2">
            <button onClick={() => loadOlder()} disabled={loadingOlder} className="px-3 py-1.5 rounded-full bg-violet-950/40 border border-purple-500/25 text-xs text-purple-200/80 disabled:opacity-50">
              {loadingOlder ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Messages plus anciens'}
            </button>
          </div>
        )}
        {error && <p className="text-center text-sm text-pink-300 py-6">{error}</p>}
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-purple-500 animate-spin" /></div>
        ) : !error && messages.length === 0 ? (
          <div className="text-center py-14 text-purple-300/60 text-sm">
            <Music className="w-9 h-9 text-[#FFEFD5] mx-auto mb-2" />
            {isCircle ? 'Aucun message dans ce cercle. Envoie un mot ou un son !' : 'Dis bonjour ou envoie un son 🎧'}
          </div>
        ) : messages.map((msg, idx) => {
          const prev = messages[idx - 1];
          const newDay = !prev || !isSameDay(prev.created_at, msg.created_at);
          const mine = msg.sender_id === me;
          const sender = msg.sender || membersById[msg.sender_id];
          if (msg.kind === 'rename') {
            return (
              <div key={msg.id} id={`msg-${msg.id}`}>
                {newDay && <DaySep ts={msg.created_at} />}
                <p className="text-center text-[11px] text-purple-300/70 py-1.5">
                  {mine ? 'Tu as' : `@${sender?.username || 'quelqu’un'} a`} renommé le cercle en « {msg.text} »
                </p>
              </div>
            );
          }
          const showName = isCircle && !mine && (newDay || !prev || prev.sender_id !== msg.sender_id || prev.kind);
          const isLiked = liked.has(msg.id);
          const sw = swipe && swipe.id === msg.id ? swipe.dx : 0;
          const isStory = !!msg.story_id;
          return (
            <div key={msg.id} id={`msg-${msg.id}`}>
              {newDay && <DaySep ts={msg.created_at} />}
              {firstUnreadId === msg.id && (
                <div className="flex items-center gap-2 my-3">
                  <div className="flex-1 h-px bg-pink-500/40" /><span className="text-[11px] font-semibold text-pink-300">Non lus</span><div className="flex-1 h-px bg-pink-500/40" />
                </div>
              )}
              <div className={`flex gap-2 ${mine ? 'justify-end' : 'justify-start'} ${showName || !isCircle || mine ? 'mt-2' : 'mt-0.5'}`}>
                {/* Glisser pour répondre : la flèche apparaît à mesure. */}
                {sw > 0 && <Reply className="w-4 h-4 text-pink-300 self-center flex-shrink-0" style={{ opacity: Math.min(1, sw / 55) }} />}
                {isCircle && !mine && (
                  <button data-no-gesture onClick={() => sender && openProfile(sender.id)} className={`w-7 h-7 flex-shrink-0 self-end ${showName ? '' : 'invisible'}`} aria-label={`Profil de @${sender?.username || ''}`}>
                    <img src={avatarThumb(sender?.profile_album_cover_url, 64) || defaultAvatar(sender?.username)} className="w-7 h-7 rounded-full object-cover" alt="" />
                  </button>
                )}
                <div className={`flex flex-col max-w-[78%] ${mine ? 'items-end' : 'items-start'}`}>
                  {showName && <button data-no-gesture onClick={() => sender && openProfile(sender.id)} className="text-[11px] text-purple-300/80 mb-0.5 ml-1 font-medium">@{sender?.username || '…'}</button>}
                  <div
                    onClick={(e) => onBubbleClick(e, msg)}
                    onContextMenu={(e) => { if (msg.deleted_at || isTemp(msg)) return; e.preventDefault(); setMenuMsg(msg); }}
                    onTouchStart={(e) => onTouchStart(e, msg)}
                    onTouchMove={(e) => onTouchMove(e, msg)}
                    onTouchEnd={() => onTouchEnd(msg)}
                    onTouchCancel={() => onTouchEnd(msg)}
                    style={{ transform: sw ? `translateX(${sw}px)` : undefined, transition: sw ? 'none' : 'transform .2s' }}
                    className={`group relative select-none rounded-2xl overflow-hidden transition-shadow ${
                      msg.deleted_at ? 'border border-dashed border-purple-500/30 bg-transparent'
                        : msg._status === 'failed' ? 'bg-pink-900/30 border border-pink-500/50'
                        : mine ? 'bg-purple-600/30 border border-purple-500/30' : 'bg-violet-950/40 border border-purple-500/25'
                    } ${msg._status === 'sending' ? 'opacity-70' : ''} ${highlightId === msg.id ? 'ring-2 ring-pink-400 shadow-lg shadow-pink-500/30' : ''} ${menuMsg?.id === msg.id ? 'ring-2 ring-pink-400/60' : ''}`}
                  >
                    {burstId === msg.id && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
                        <motion.div initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: [0.3, 1.25, 1], opacity: [0, 1, 0] }} transition={{ duration: 0.7 }}>
                          <Heart className="w-12 h-12 text-pink-500 fill-pink-500 drop-shadow-lg" />
                        </motion.div>
                      </div>
                    )}
                    {/* Ordinateur : menu au survol (en plus du clic droit). */}
                    {!msg.deleted_at && !isTemp(msg) && (
                      <button data-no-gesture aria-label="Actions" onClick={(e) => { e.stopPropagation(); setMenuMsg(msg); }}
                        className="hidden lg:flex absolute top-1 right-1 z-10 p-1 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {msg.deleted_at ? (
                      <p className="px-3 py-2 text-sm italic text-purple-300/60">Message retiré</p>
                    ) : (
                      <>
                        {/* Citation (P27) */}
                        {msg.reply && (
                          <button data-no-gesture onClick={(e) => { e.stopPropagation(); jumpTo(msg.reply.id); }}
                            className="m-1.5 mb-0 px-2.5 py-1.5 rounded-xl bg-black/25 border-l-2 border-pink-400 text-left max-w-full flex items-center gap-2">
                            {!msg.reply.deleted_at && (msg.reply.image_url || msg.reply.cover_url) && (
                              msg.reply.image_url ? <MediaImg src={msg.reply.image_url} width={96} className="w-8 h-8 rounded object-cover flex-shrink-0" alt="" />
                                : <img src={thumb(msg.reply.cover_url, 96)} className="w-8 h-8 rounded object-cover flex-shrink-0" alt="" />
                            )}
                            <span className="min-w-0">
                              <span className="block text-[11px] font-semibold text-pink-300">
                                {msg.reply.sender_id === me ? 'Toi' : `@${(membersById[msg.reply.sender_id] || (msg.reply.sender_id === chat.id ? { username: avatarName } : null))?.username || '…'}`}
                              </span>
                              <span className={`block text-xs truncate ${msg.reply.deleted_at ? 'italic text-purple-300/60' : 'text-purple-100/80'}`}>{messageSnippet(msg.reply)}</span>
                            </span>
                          </button>
                        )}
                        {isStory && (
                          <div className="flex gap-2.5 p-2 pr-3 items-start">
                            {(msg.story?.image_url || msg.story?.cover_url)
                              ? <img src={thumb(msg.story.image_url, 256) || msg.story.cover_url} alt="" className="w-11 h-[4.5rem] rounded-lg object-cover flex-shrink-0 ring-1 ring-white/10" />
                              : <div className="w-11 h-[4.5rem] rounded-lg bg-gradient-to-br from-purple-700 to-pink-700 flex-shrink-0" />}
                            <div className="min-w-0 text-sm">
                              <p className="text-[11px] font-semibold text-purple-300/80 mb-0.5">
                                {msg.text ? (mine ? 'Tu as répondu à son Shake éphémère' : 'A répondu à ton Shake éphémère') : (mine ? 'Tu as aimé son Shake éphémère' : 'A aimé ton Shake éphémère')}
                              </p>
                              {msg.text ? <p className="text-purple-50 break-words">{msg.text.startsWith('💭') ? (msg.text.split(':\n')[1] || msg.text) : msg.text}</p> : <p className="text-lg leading-none">❤️</p>}
                              {msg.story?.track_name && <p className="text-[10px] text-purple-300/60 mt-1 truncate">🎵 {msg.story.track_name}{msg.story.artist ? ` — ${msg.story.artist}` : ''}</p>}
                            </div>
                          </div>
                        )}
                        {msg.image_url && (
                          <div className="p-1">
                            <MediaImg src={msg.image_url} alt="" className="max-w-full max-h-64 min-w-[6rem] min-h-[6rem] rounded-xl object-cover" />
                          </div>
                        )}
                        {msg.track_name && (
                          <div className="p-2 flex gap-2 items-center min-w-[13rem]">
                            <SongCover
                              songKey={`${chat.kind}-${msg.id}`}
                              title={msg.track_name} artist={msg.artist} cover={msg.cover_url}
                              previewUrl={msg.preview_url} spotifyId={msg.track_id || msg.spotify_url?.match(/track\/([a-zA-Z0-9]+)/)?.[1]} spotifyUrl={msg.spotify_url}
                              className="w-12 h-12"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate">{msg.track_name}</p>
                              <p className="text-xs text-purple-200/70 truncate">{msg.artist}</p>
                            </div>
                            <button data-no-gesture aria-label="Ouvrir dans mon appli de musique"
                              onClick={(e) => { e.stopPropagation(); const url = getPlatformUrl({ spotify_url: msg.spotify_url, apple_music_url: msg.apple_music_url, deezer_url: msg.deezer_url, youtube_url: msg.youtube_url, youtube_music_url: msg.youtube_music_url, tidal_url: msg.tidal_url, odesli_page_url: msg.odesli_page_url }, currentUser?.musicService || 'spotify', { title: msg.track_name, artist: msg.artist }); if (url) openExternal(url); }}
                              className="flex-shrink-0 p-2 rounded-full bg-purple-600/20 hover:bg-purple-600/30">
                              <MyAppLogo className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                        {msg.text && !isStory && <p className={`px-3 ${msg.image_url || msg.track_name ? 'pb-1 pt-0.5 text-xs text-purple-100/90' : 'py-2 text-sm'} whitespace-pre-wrap break-words`}>{renderText(msg.text)}</p>}
                      </>
                    )}
                    <p className={`px-3 pb-1.5 text-[10px] ${mine ? 'text-purple-300/60 text-right' : 'text-purple-400/50'}`}>
                      {msg._status === 'sending' ? 'Envoi…' : formatTime(msg.created_at)}
                    </p>
                  </div>

                  {/* Petit cœur + nombre sous la bulle ; le toucher retire / remet le like. */}
                  {!msg.deleted_at && (msg.likes_count > 0 || isLiked) && (
                    <button onClick={() => toggleLike(msg)} onContextMenu={(e) => { e.preventDefault(); showLikers(msg); }}
                      className={`-mt-1.5 z-[1] flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-semibold ${isLiked ? 'bg-pink-500/20 border-pink-500/40 text-pink-200' : 'bg-violet-950/80 border-purple-500/30 text-purple-200'}`}>
                      <Heart className={`w-3 h-3 ${isLiked ? 'fill-pink-400 text-pink-400' : ''}`} /> {msg.likes_count || 1}
                    </button>
                  )}
                  {msg._status === 'failed' && (
                    <div className="flex items-center gap-2 mt-1 text-[11px]">
                      <span className="text-pink-300">Pas envoyé</span>
                      <button onClick={() => msg._retry?.()} className="font-semibold text-white underline">Réessayer</button>
                      <button onClick={() => setMessages((p) => p.filter((m) => m.id !== msg.id))} className="text-purple-300/70">Annuler</button>
                    </div>
                  )}
                  {lastMine && msg.id === lastMine.id && (
                    <button onClick={() => isCircle && seenBy.length && setShowSeen(true)} className="mt-0.5 text-[10px] text-purple-300/70">{seenLabel()}</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div className="h-1" />
      </div>

      {/* ↓ nouveaux messages (P12-7) */}
      <AnimatePresence>
        {newCount > 0 && !atBottom && (
          <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            onClick={() => { scrollToBottom(true); setNewCount(0); }}
            className="absolute left-1/2 -translate-x-1/2 bottom-[calc(var(--nav-h)+4.5rem)] lg:bottom-20 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-xs font-semibold shadow-lg">
            <ChevronDown className="w-4 h-4" /> {newCount} nouveau{newCount > 1 ? 'x' : ''} message{newCount > 1 ? 's' : ''}
          </motion.button>
        )}
      </AnimatePresence>
      {notice && <p className="absolute left-1/2 -translate-x-1/2 top-16 z-30 px-3 py-1.5 rounded-full bg-black/80 text-xs text-white">{notice}</p>}

      {/* Panneaux : son, GIF, photo */}
      <AnimatePresence>
        {panel === 'track' && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-purple-500/25 bg-[#1E1440] max-h-60 overflow-y-auto flex-shrink-0">
            <div className="p-3">
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300/70" />
                <input autoFocus value={trackQuery} onChange={(e) => setTrackQuery(e.target.value)} placeholder="Rechercher un son à envoyer…" className="w-full pl-9 pr-3 py-2 bg-violet-950/20 border border-purple-500/30 rounded-lg text-base sm:text-sm text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-500" />
              </div>
              {trackResults.map((t: any) => (
                <button key={t.id} onClick={() => { setPanel('none'); setTrackQuery(''); setTrackResults([]); send({ track: t }); }} className="w-full flex items-center gap-2 p-2 hover:bg-violet-900/25 rounded-lg">
                  <img src={t.cover} alt="" className="w-10 h-10 rounded-md object-cover" />
                  <div className="flex-1 text-left min-w-0"><p className="text-sm font-medium truncate">{t.name}</p><p className="text-xs text-purple-200/70 truncate">{t.artist}</p></div>
                  <Send className="w-4 h-4 text-purple-400" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
        {panel === 'gif' && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="max-h-72 overflow-hidden border-t border-purple-500/25 bg-[#1E1440] flex flex-col flex-shrink-0">
            <div className="p-3 pb-0">
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300/60" />
                <input autoFocus value={gifQuery} onChange={(e) => setGifQuery(e.target.value)} placeholder="Rechercher un GIF…" className="w-full pl-9 pr-3 py-2 bg-violet-950/20 border border-purple-500/30 rounded-lg text-base sm:text-sm text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-500" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-3">
              {gifSearching && <Loader2 className="w-4 h-4 text-purple-500 animate-spin mx-auto my-2" />}
              <div className="grid grid-cols-2 gap-2">
                {gifError && <p className="col-span-full text-center text-xs text-purple-200/80 py-3 px-2">{gifError}</p>}
                {gifResults.map((g: any) => (
                  <button key={g.id} onClick={() => { setPanel('none'); setGifQuery(''); send({ imageUrl: g.url }); }} className="rounded-lg overflow-hidden hover:ring-2 hover:ring-purple-500">
                    <img src={g.preview} alt="" className="w-full h-24 object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Barre « Répondre à… » (P27) */}
      {replyTo && (
        <div className="flex items-center gap-2 px-3 py-2 border-t border-purple-500/25 bg-violet-950/40 flex-shrink-0">
          <Reply className="w-4 h-4 text-pink-300 flex-shrink-0" />
          <div className="flex-1 min-w-0 border-l-2 border-pink-400 pl-2">
            <p className="text-[11px] font-semibold text-pink-300">Répondre à {replyTo.sender_id === me ? 'toi-même' : `@${(replyTo.sender || membersById[replyTo.sender_id])?.username || avatarName || ''}`}</p>
            <p className="text-xs text-purple-100/80 truncate">{messageSnippet(replyTo)}</p>
          </div>
          <button onClick={() => setReplyTo(null)} aria-label="Annuler la réponse" className="p-1.5 rounded-full hover:bg-purple-900/40"><X className="w-4 h-4" /></button>
        </div>
      )}
      {photo && (
        <div className="flex items-center gap-3 px-3 py-2 border-t border-purple-500/25 bg-[#1E1440] flex-shrink-0">
          <div className="relative">
            <img src={photo.preview} alt="Aperçu" className="h-16 w-16 rounded-lg object-cover" />
            <button onClick={() => { URL.revokeObjectURL(photo.preview); setPhoto(null); }} aria-label="Retirer la photo" className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center"><X className="w-3 h-3" /></button>
          </div>
          <p className="text-xs text-purple-300/70">Photo prête. Ajoute une légende si tu veux, puis envoie.</p>
        </div>
      )}

      {/* @mentions (P28) */}
      {mentionOptions.length > 0 && (
        <div className="border-t border-purple-500/25 bg-[#1D0F3D] max-h-48 overflow-y-auto flex-shrink-0">
          {mentionOptions.map((m: any) => (
            <button key={m.id} onMouseDown={(e) => e.preventDefault()} onClick={() => pickMention(m)} className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-violet-900/30 text-left">
              <img src={avatarThumb(m.profile_album_cover_url, 64) || defaultAvatar(m.username)} className="w-7 h-7 rounded-full object-cover" alt="" />
              <span className="text-sm font-medium">{m.display_name || m.username}</span>
              <span className="text-xs text-purple-300/60">@{m.username}</span>
            </button>
          ))}
        </div>
      )}

      {/* Saisie */}
      <div className="flex-shrink-0 bg-[#1E1440] border-t border-purple-500/25 pb-[var(--nav-h)] lg:pb-0">
        <div className="px-2.5 py-2 flex items-center gap-1.5">
          <button onClick={() => setPanel(panel === 'track' ? 'none' : 'track')} aria-label="Envoyer un son" className={`flex-shrink-0 p-2 rounded-full ${panel === 'track' ? 'bg-purple-500 text-white' : 'hover:bg-purple-900/40 text-purple-400'}`}><Music className="w-5 h-5" /></button>
          <button onClick={() => setPanel(panel === 'gif' ? 'none' : 'gif')} aria-label="Envoyer un GIF" className={`flex-shrink-0 p-2 rounded-full ${panel === 'gif' ? 'bg-purple-500 text-white' : 'hover:bg-purple-900/40 text-purple-400'}`}><Smile className="w-5 h-5" /></button>
          <button onClick={() => fileRef.current?.click()} aria-label="Ajouter une photo" className="flex-shrink-0 p-2 rounded-full hover:bg-purple-900/40 text-purple-400"><Camera className="w-5 h-5" /></button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            if (f.size > 30 * 1024 * 1024) { flash('Photo trop lourde (30 Mo max).'); return; }
            setPhoto({ file: f, preview: URL.createObjectURL(f) });
          }} />
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => { setText(e.target.value); setCaret(e.target.selectionStart || e.target.value.length); if (e.target.value) sendTyping(); }}
            onSelect={(e) => setCaret((e.target as HTMLInputElement).selectionStart || 0)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (mentionOptions.length) pickMention(mentionOptions[0]); else sendText(); } }}
            placeholder={photo ? 'Légende (facultatif)…' : isCircle ? 'Message… (@ pour mentionner)' : 'Envoie un message…'}
            enterKeyHint="send"
            className="flex-1 min-w-0 px-3 py-2 bg-violet-950/20 border border-purple-500/30 rounded-full text-base sm:text-sm text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-500"
          />
          <button onClick={sendText} disabled={!text.trim() && !photo} aria-label="Envoyer" className="flex-shrink-0 p-2 bg-purple-600 rounded-full hover:bg-purple-700 disabled:opacity-40"><Send className="w-5 h-5" /></button>
        </div>
      </div>

      {/* Menu d'actions (appui long / clic droit) : le même en privé et en cercle */}
      {menuMsg && createPortal(
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60" onClick={() => setMenuMsg(null)}>
          <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-sm bg-[#1D0F3D] rounded-t-3xl sm:rounded-2xl border-t sm:border border-purple-700/40 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <p className="px-3 pt-2 pb-2 text-xs text-purple-300/70 truncate">{messageSnippet(menuMsg) || 'Message'}</p>
            <MenuItem icon={<Reply className="w-4 h-4" />} label="Répondre" onClick={() => { setReplyTo(menuMsg); setMenuMsg(null); inputRef.current?.focus(); }} />
            {(menuMsg.text || menuMsg.track_name) && <MenuItem icon={<Copy className="w-4 h-4" />} label="Copier" onClick={() => doCopy(menuMsg)} />}
            <MenuItem icon={<Heart className={`w-4 h-4 ${liked.has(menuMsg.id) ? 'fill-pink-400 text-pink-400' : ''}`} />} label={liked.has(menuMsg.id) ? 'Retirer mon like' : 'Liker'} onClick={() => { toggleLike(menuMsg); setMenuMsg(null); }} />
            {menuMsg.likes_count > 0 && <MenuItem icon={<Users className="w-4 h-4" />} label={`Voir les likes (${menuMsg.likes_count})`} onClick={() => showLikers(menuMsg)} />}
            {canRetract(menuMsg) && <MenuItem danger icon={<Trash2 className="w-4 h-4" />} label="Retirer le message" onClick={() => doRetract(menuMsg)} />}
            <MenuItem icon={<X className="w-4 h-4" />} label="Annuler" onClick={() => setMenuMsg(null)} />
          </motion.div>
        </div>,
        document.body,
      )}

      {/* Qui a liké / qui a vu */}
      {(likersOf || showSeen) && createPortal(
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60" onClick={() => { setLikersOf(null); setShowSeen(false); }}>
          <div onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-sm max-h-[60dvh] overflow-y-auto bg-[#1D0F3D] rounded-t-3xl sm:rounded-2xl border-t sm:border border-purple-700/40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <p className="font-bold mb-2 px-1">{likersOf ? 'Likes' : 'Vu par'}</p>
            {(likersOf ? likersOf.users : seenBy.map((r) => ({ id: r.user_id, username: r.username, display_name: r.display_name, profile_album_cover_url: r.profile_album_cover_url, at: r.last_read_at }))).map((u: any) => (
              <button key={u.id} onClick={() => { setLikersOf(null); setShowSeen(false); openProfile(u.id); }} className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-purple-900/30 text-left">
                <img src={avatarThumb(u.profile_album_cover_url, 64) || defaultAvatar(u.username)} className="w-9 h-9 rounded-full object-cover" alt="" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{u.display_name || u.username}</p>
                  <p className="text-xs text-purple-300/60">@{u.username}{u.at ? ` · ${formatTime(u.at)}` : ''}</p>
                </div>
                {likersOf && <Heart className="w-4 h-4 text-pink-400 fill-pink-400" />}
              </button>
            ))}
            {likersOf && likersOf.users.length === 0 && <p className="text-sm text-purple-300/60 p-2">Personne pour l’instant.</p>}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

function DaySep({ ts }: { ts: string }) {
  return (
    <div className="flex justify-center my-2">
      <span className="px-2.5 py-0.5 rounded-full bg-violet-950/50 text-[11px] font-medium text-purple-300/70">{formatDayLabel(ts)}</span>
    </div>
  );
}

function MenuItem({ icon, label, onClick, danger }: { icon: ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium hover:bg-purple-900/40 ${danger ? 'text-pink-300' : 'text-white'}`}>
      {icon}{label}
    </button>
  );
}
