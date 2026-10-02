// Inviter des amis (P19) : lien perso shakemoi.fr/i/<pseudo> partagé par la
// feuille de partage du téléphone (WhatsApp, Insta, SMS…), et QR code plein
// écran aux couleurs de SHAKEmoi pour le montrer en soirée.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Share2, QrCode, Copy, Check } from 'lucide-react';
import { inviteLink } from '../../lib/links';
import { useBackHandler } from '../../lib/navigation';
import { avatarThumb, defaultAvatar } from '../../lib/media';

const MESSAGE = (name: string) => `${name} t'invite sur SHAKEmoi 🎧 On y partage les sons qu'on écoute vraiment. Rejoins-moi :`;

export function InviteSheet({ user, onClose }: { user: any; onClose: () => void }) {
  useBackHandler(true, onClose);
  const [qr, setQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const link = inviteLink(user.username);
  const name = user.displayName || user.display_name || user.username;

  const share = async () => {
    const text = MESSAGE(name);
    try {
      if (navigator.share) { await navigator.share({ title: 'SHAKEmoi', text, url: link }); return; }
    } catch { return; }
    await navigator.clipboard.writeText(`${text} ${link}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const copy = async () => {
    await navigator.clipboard.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return createPortal(
    <div className="fixed inset-0 z-[65] bg-black/70 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-sm bg-[#1D0F3D] rounded-t-3xl sm:rounded-2xl border-t sm:border border-purple-700/40 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]" role="dialog" aria-label="Inviter des amis">
        <div className="flex items-center mb-4">
          <p className="flex-1 font-bold text-lg">Inviter des amis</p>
          <button aria-label="Fermer" onClick={onClose} className="p-1.5 rounded-full hover:bg-purple-900/40"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-purple-200/80 mb-4">Quand quelqu'un s'inscrit avec ton lien, vous vous suivez automatiquement et tu es prévenu·e.</p>
        <div className="flex items-center gap-2 bg-violet-950/40 border border-purple-500/30 rounded-xl px-3 py-2.5 mb-3">
          <p className="flex-1 min-w-0 text-sm font-mono truncate">{link.replace(/^https?:\/\/(www\.)?/, '')}</p>
          <button onClick={copy} aria-label="Copier le lien" className={`p-1.5 rounded-lg ${copied ? 'bg-fuchsia-500' : 'bg-purple-700/60'}`}>{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</button>
        </div>
        <button onClick={share} className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 font-semibold flex items-center justify-center gap-2">
          <Share2 className="w-4 h-4" /> Partager mon lien
        </button>
        <button onClick={() => setQr(true)} className="w-full mt-2 py-3 rounded-xl bg-purple-900/50 border border-purple-600/40 font-semibold flex items-center justify-center gap-2">
          <QrCode className="w-4 h-4" /> Montrer mon QR code
        </button>
      </div>
      {qr && <QrFullscreen user={user} link={link} onClose={() => setQr(false)} />}
    </div>,
    document.body,
  );
}

function QrFullscreen({ user, link, onClose }: { user: any; link: string; onClose: () => void }) {
  useBackHandler(true, onClose);
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    import('qrcode-generator').then(({ default: qrcode }) => {
      const q = qrcode(0, 'H'); // correction forte : l'avatar au centre ne gêne pas la lecture
      q.addData(link);
      q.make();
      // Modules dessinés en violet foncé sur fond clair (lisible par tous les téléphones).
      const n = q.getModuleCount();
      let rects = '';
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) rects += `<rect x="${c}" y="${r}" width="1.02" height="1.02"/>`;
      setSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 ${n + 4} ${n + 4}" shape-rendering="crispEdges"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#FFF7FF"/><g fill="#2A0F4A">${rects}</g></svg>`);
    });
  }, [link]);
  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center p-6 text-white" style={{ background: 'radial-gradient(circle at 30% 20%, #7B2CBF 0%, #1E1440 55%, #0A0614 100%)' }} onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <button aria-label="Fermer" onClick={onClose} className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 p-2 rounded-full bg-black/40"><X className="w-5 h-5" /></button>
      <img src="/shakemoi-logo.png" alt="SHAKEmoi" className="h-8 object-contain mb-6" />
      <div className="relative bg-[#FFF7FF] rounded-3xl p-4 shadow-2xl shadow-pink-500/30 w-[min(80vw,340px)] aspect-square">
        {svg ? <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: svg }} /> : <div className="w-full h-full animate-pulse bg-purple-200/30 rounded-2xl" />}
        <img src={avatarThumb(user.profile_album_cover_url || user.avatar, 128) || defaultAvatar(user.username)} alt="" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full object-cover ring-4 ring-[#FFF7FF]" />
      </div>
      <p className="mt-6 text-2xl font-black">@{user.username}</p>
      <p className="text-sm text-purple-100/80 mt-1">Scanne pour me rejoindre sur SHAKEmoi</p>
    </div>
  );
}
