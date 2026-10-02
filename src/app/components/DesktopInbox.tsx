// Colonne de gauche sur ordinateur (M7) : conversations récentes et cercles,
// avec pastilles de non-lus. Un clic ouvre la conversation ou le cercle.
import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Users, Loader2 } from 'lucide-react';
import { getConversations, getUserCirclesByActivity } from '../../lib/database';
import { supabase } from '../../lib/supabase';
import { defaultAvatar, MediaImg, avatarThumb } from '../../lib/media';
import { formatListTime } from '../../lib/dates';
import { circlePreviewText, dmPreviewText } from '../../lib/chat';
import { useActiveChat } from '../../lib/activeChat';

interface Props {
  currentUser: any;
  onOpenConversation: (partner: any) => void;
  onOpenCircle: (circleId: string) => void;
}


export function DesktopInbox({ currentUser, onOpenConversation, onOpenCircle }: Props) {
  // Ce qui est ouvert au centre, vu par la même source que l'écran Messages (P13).
  const active = useActiveChat();
  const activePartnerId = active?.kind === 'dm' ? active.id : null;
  const activeCircleId = active?.kind === 'circle' ? active.id : null;
  const [conversations, setConversations] = useState<any[]>([]);
  const [circles, setCircles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Plusieurs évènements d'affilée (message + like + lu) : un seul rechargement,
  // et une réponse plus ancienne n'écrase jamais une plus récente.
  const seq = useRef(0);
  const timer = useRef<number | null>(null);
  const load = async () => {
    const id = ++seq.current;
    const [c, g] = await Promise.all([getConversations().catch(() => null), getUserCirclesByActivity().catch(() => null)]);
    if (id !== seq.current) return;
    if (c) setConversations(c);
    if (g) setCircles(g);
    setLoading(false);
  };
  const reload = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(load, 250);
  };

  useEffect(() => {
    if (!currentUser?.id) return;
    load();
    // En direct : un message reçu ou une conversation lue met la liste à jour.
    const channel = supabase
      .channel(`desktop-inbox-${currentUser.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${currentUser.id}` }, reload)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, reload)
      // Un nouveau message de cercle fait remonter ce cercle en haut (P13).
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'circle_messages' }, reload)
      // Ajouté à un cercle, cercle renommé ou nouvelle photo, likes reçus.
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'circle_members', filter: `user_id=eq.${currentUser.id}` }, reload)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'circles' }, reload)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_likes' }, reload)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'circle_message_likes' }, reload)
      .subscribe();
    const onRead = () => reload();
    window.addEventListener('shakemoi:messages-read', onRead);
    window.addEventListener('shakemoi:circles-changed', onRead);
    return () => { supabase.removeChannel(channel); window.removeEventListener('shakemoi:messages-read', onRead); window.removeEventListener('shakemoi:circles-changed', onRead); };
  }, [currentUser?.id]);

  return (
    <div className="h-full overflow-y-auto p-4 space-y-5">
      <section>
        <h2 className="flex items-center gap-2 text-sm font-bold text-white mb-2 px-1">
          <MessageCircle className="w-4 h-4 text-fuchsia-400" /> Messages
        </h2>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 text-purple-400 animate-spin" /></div>
        ) : conversations.length === 0 ? (
          <p className="text-xs text-purple-300/85 px-1">Pas encore de conversation.</p>
        ) : (
          <div className="space-y-0.5">
            {conversations.slice(0, 12).map((c) => (
              <button
                key={c.partnerId}
                data-testid="inbox-item" data-title={c.partner?.display_name || c.partner?.username}
                onClick={() => onOpenConversation(c.partner)}
                className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-xl text-left transition-colors ${activePartnerId === c.partnerId ? 'bg-violet-900/40' : 'hover:bg-violet-900/25'}`}
              >
                <div className="relative flex-shrink-0">
                  <img loading="lazy" src={avatarThumb(c.partner?.profile_album_cover_url, 128) || defaultAvatar(c.partner?.username)} alt="" className="w-10 h-10 rounded-full object-cover" />
                  {c.unreadCount > 0 && !c.muted && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 bg-pink-500 border-2 border-[#1E1440] rounded-full text-[9px] font-bold flex items-center justify-center text-white">
                      {c.unreadCount > 9 ? '9+' : c.unreadCount}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <p className={`text-sm truncate flex-1 ${c.unreadCount > 0 ? 'font-bold text-white' : 'font-semibold text-white/90'}`}>
                      {c.partner?.display_name || c.partner?.username}
                    </p>
                    <span className={`text-[10px] flex-shrink-0 ${c.unreadCount > 0 ? 'text-pink-300' : 'text-purple-300/80'}`}>{formatListTime(c.lastMessage?.created_at)}</span>
                  </div>
                  <p className={`text-xs truncate ${c.unreadCount > 0 ? 'text-purple-100/90' : 'text-purple-300/85'}`}>{dmPreviewText(c.lastMessage, currentUser?.id)}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="flex items-center gap-2 text-sm font-bold text-white mb-2 px-1">
          <Users className="w-4 h-4 text-fuchsia-400" /> Cercles
        </h2>
        {!loading && circles.length === 0 ? (
          <p className="text-xs text-purple-300/85 px-1">Aucun cercle pour l'instant.</p>
        ) : (
          <div className="space-y-0.5">
            {circles.map((g) => (
              <button
                key={g.id}
                data-testid="inbox-item" data-title={g.name}
                onClick={() => onOpenCircle(g.id)}
                className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-xl text-left transition-colors ${activeCircleId === g.id ? 'bg-violet-900/40' : 'hover:bg-violet-900/25'}`}
              >
                <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                  {g.photo_url ? (
                    <MediaImg src={g.photo_url} width={128} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center"><Users className="w-4 h-4 text-white" /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <p className={`text-sm truncate flex-1 ${g.unread_count > 0 ? 'font-bold text-white' : 'font-semibold text-white/90'}`}>{g.name}</p>
                    <span className={`text-[10px] flex-shrink-0 ${g.unread_count > 0 ? 'text-pink-300' : 'text-purple-300/80'}`}>{formatListTime(g.last_activity_at)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <p className={`text-xs truncate flex-1 ${g.unread_count > 0 ? 'text-purple-100/90' : 'text-purple-300/85'}`}>{circlePreviewText(g, currentUser?.id)}</p>
                    {g.has_mention && <span className="w-[17px] h-[17px] bg-pink-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white flex-shrink-0">@</span>}
                    {g.unread_count > 0 && (
                      <span className={`min-w-[17px] h-[17px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center flex-shrink-0 ${g.muted ? 'bg-purple-800/70 text-purple-200' : 'bg-pink-500 text-white'}`}>{g.unread_count > 9 ? '9+' : g.unread_count}</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
