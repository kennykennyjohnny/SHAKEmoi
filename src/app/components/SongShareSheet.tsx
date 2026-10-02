import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X, Copy, Check, Share2, Clapperboard, Link2, MessageSquare } from 'lucide-react';
import { createStoryVideo } from '../../lib/storyVideo';
import { StoryVideoMaker } from './StoryVideoMaker';
import { supabase } from '../../lib/supabase';
import { resolvePreviewUrl } from '../../lib/preview';
import { PUBLIC_ORIGIN } from '../../lib/links';
import { useBackHandler } from '../../lib/navigation';
import { tween } from '../../lib/motion';

// SHAKEMOI - Feuille de partage d'un son : vidéo story (Insta, TikTok, Snap,
// WhatsApp…) + partages rapides. Même feuille partout (recherche, feed, profil,
// détail d'un post) pour que partager un son se fasse toujours de la même façon.

export interface ShareableSong {
  title: string;
  artist: string;
  cover?: string | null;
  previewUrl?: string | null;
}

interface Props {
  song: ShareableSong;
  /** Pseudo de la personne qui partage (affiché dans la vidéo). */
  by?: string | null;
  /** Lien public, ou fonction qui le crée (ex. lien /s/ d'un son de la recherche). */
  link: string | (() => Promise<string>);
  onClose: () => void;
}

function fileSlug(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'son';
}

const WhatsAppIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
);
const XIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
);
const TelegramIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M9.78 15.27l-.4 5.63c.57 0 .82-.25 1.12-.54l2.69-2.57 5.57 4.08c1.02.57 1.75.27 2.02-.94l3.66-17.15c.33-1.51-.54-2.1-1.53-1.73L1.4 10.3c-1.47.57-1.45 1.39-.25 1.76l5.5 1.72L19.43 5.7c.6-.4 1.15-.18.7.22"/></svg>
);

export function SongShareSheet({ song, by, link, onClose }: Props) {
  // Retour du téléphone : ferme cette fenêtre au lieu de quitter l'appli (N2).
  useBackHandler(true, onClose);
  const [url, setUrl] = useState<string | null>(typeof link === 'string' ? link : null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(song.previewUrl ?? null);
  const [byAvatar, setByAvatar] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Le lien et l'extrait se préparent dès l'ouverture : le clic « vidéo » part
  // alors tout de suite (et reste dans le geste de l'utilisateur, requis par iOS).
  useEffect(() => {
    let cancelled = false;
    if (typeof link === 'function') {
      link().then(u => { if (!cancelled) setUrl(u); }).catch(() => { if (!cancelled) setUrl(PUBLIC_ORIGIN); });
    }
    if (!song.previewUrl) {
      resolvePreviewUrl(song.title, song.artist).then(p => { if (!cancelled) setPreviewUrl(p); }).catch(() => {});
    }
    // Avatar de la personne qui partage, affiché dans la vidéo.
    if (by) {
      supabase.from('users_profile').select('profile_album_cover_url').eq('username', by).maybeSingle()
        .then(({ data }) => { if (!cancelled) setByAvatar(data?.profile_album_cover_url || null); });
    }
    return () => { cancelled = true; };
  }, []);

  const text = `${song.title} — ${song.artist}${by ? ` · partagé par @${by}` : ''} sur SHAKEmoi`;

  const copyLink = async () => {
    if (!url) return;
    try { await navigator.clipboard.writeText(url); } catch { return; }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const nativeShare = async () => {
    if (!url) return;
    if (navigator.share) {
      try { await navigator.share({ title: song.title, text, url }); } catch { /* annulé */ }
    } else {
      copyLink();
    }
  };

  const open = (href: string) => window.open(href, '_blank', 'noopener');
  const quick = [
    { key: 'whatsapp', label: 'WhatsApp', icon: <WhatsAppIcon />, bg: 'bg-[#25D366]', run: () => open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`) },
    { key: 'sms', label: 'SMS', icon: <MessageSquare className="w-5 h-5" />, bg: 'bg-[#34C759]', run: () => { window.location.href = `sms:?&body=${encodeURIComponent(`${text} ${url}`)}`; } },
    { key: 'telegram', label: 'Telegram', icon: <TelegramIcon />, bg: 'bg-[#229ED9]', run: () => open(`https://t.me/share/url?url=${encodeURIComponent(url || '')}&text=${encodeURIComponent(text)}`) },
    { key: 'x', label: 'X', icon: <XIcon />, bg: 'bg-black border border-white/20', run: () => open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url || '')}`) },
    { key: 'copy', label: copied ? 'Copié !' : 'Copier', icon: copied ? <Check className="w-5 h-5" /> : <Link2 className="w-5 h-5" />, bg: 'bg-white/10 border border-white/15', run: copyLink },
    { key: 'more', label: 'Plus', icon: <Share2 className="w-5 h-5" />, bg: 'bg-white/10 border border-white/15', run: nativeShare },
  ];

  // Portail sur <body> : les parents animés (transform) casseraient le plein écran.
  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={tween()}
          onClick={e => e.stopPropagation()}
          className="w-full sm:max-w-md max-h-[92dvh] overflow-y-auto bg-[#1E1440] border border-purple-500/25 rounded-t-3xl sm:rounded-3xl text-white pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          {/* En-tête : le son partagé */}
          <div className="flex items-center gap-3 p-4 border-b border-purple-500/15">
            {song.cover
              ? <img loading="lazy" src={song.cover} alt="" className="w-12 h-12 rounded-lg object-cover" />
              : <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600" />}
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate">{song.title}</p>
              <p className="text-xs text-purple-300/90 truncate">{song.artist}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-colors" aria-label="Fermer">
              <X className="w-5 h-5 text-purple-300/90" />
            </button>
          </div>

          {/* Vidéo story */}
          <div className="p-4">
            <StoryVideoMaker
              url={url}
              shareText={text}
              fileName={`shakemoi-${fileSlug(song.title)}`}
              make={(canvas, onProgress) => createStoryVideo(canvas, { ...song, previewUrl, by, byAvatar }, url!, onProgress)}
              placeholder={song.cover
                ? <img loading="lazy" src={song.cover} alt="" className="w-16 h-16 rounded-lg object-cover opacity-80" />
                : <Clapperboard className="w-8 h-8 text-purple-300/85" />}
            />
          </div>

          {/* Partages rapides */}
          <div className="px-4 pb-2">
            <p className="text-[11px] uppercase tracking-wider text-purple-300/80 font-semibold mb-2">Envoyer le lien</p>
            <div className="grid grid-cols-6 gap-2">
              {quick.map(q => (
                <button key={q.key} onClick={q.run} disabled={!url} className="flex flex-col items-center gap-1.5 disabled:opacity-50">
                  <span className={`w-11 h-11 rounded-full flex items-center justify-center ${q.bg}`}>{q.icon}</span>
                  <span className="text-[10px] text-purple-200/80">{q.label}</span>
                </button>
              ))}
            </div>
            <button
              onClick={copyLink}
              disabled={!url}
              className="mt-3 w-full flex items-center gap-2 rounded-xl bg-black/25 border border-white/10 px-3 py-2.5 text-left"
            >
              <span className="flex-1 truncate font-mono text-xs text-purple-100/80">
                {url ? url.replace(/^https?:\/\/(www\.)?/, '') : 'Création du lien…'}
              </span>
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-purple-300/90" />}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
