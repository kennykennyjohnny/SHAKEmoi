// SHAKEMOI - Bloc « vidéo pour ta story » (P20), commun au partage d'un son et
// au récap de la semaine : création en direct, puis deux façons de partager.
//  - Story Insta / TikTok : la vidéo seule (ces applis ignorent le texte) et le
//    lien copié au même moment, à coller dans le sticker « Lien ».
//  - WhatsApp, SMS… : la vidéo ET le lien en texte, donc cliquable.
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Copy, Download, Share2, Clapperboard, Loader2, MessageCircle } from 'lucide-react';
import { pickVideoMime, VIDEO_SECONDS, type StoryResult } from '../../lib/storyVideo';

interface Props {
  /** Crée la vidéo dans le canvas (appelé dans le geste de l'utilisateur). */
  make: (canvas: HTMLCanvasElement, onProgress: (p: number) => void) => Promise<StoryResult>;
  /** Lien à copier / envoyer ; null tant qu'il se prépare. */
  url: string | null;
  /** Texte du partage WhatsApp/SMS (le lien est ajouté à la fin). */
  shareText: string;
  fileName: string;
  title?: string;
  subtitle?: string;
  placeholder?: React.ReactNode;
}

export function StoryVideoMaker({ make, url, shareText, fileName, title, subtitle, placeholder }: Props) {
  const [state, setState] = useState<'idle' | 'recording' | 'ready' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<(StoryResult & { objectUrl: string }) | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canRecord = pickVideoMime() !== null;

  useEffect(() => () => { if (result) URL.revokeObjectURL(result.objectUrl); }, [result]);

  const start = async () => {
    if (!url || !canvasRef.current || state === 'recording') return;
    setState('recording');
    setProgress(0);
    try {
      const res = await make(canvasRef.current, setProgress);
      setResult({ ...res, objectUrl: URL.createObjectURL(res.blob) });
      setState('ready');
    } catch (e) {
      console.error('Vidéo de partage :', e);
      setState('error');
    }
  };

  const file = () => (result ? new File([result.blob], `${fileName}.${result.ext}`, { type: result.mime }) : null);

  const download = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.objectUrl;
    a.download = `${fileName}.${result.ext}`;
    a.click();
  };

  const copyLink = () => {
    if (!url) return;
    navigator.clipboard?.writeText(url).catch(() => {});
    setLinkCopied(true);
  };

  const shareToStory = async () => {
    const f = file();
    if (!f || !url) return;
    copyLink(); // dans le même geste, avant d'ouvrir la feuille de partage
    if (navigator.canShare?.({ files: [f] })) {
      try { await navigator.share({ files: [f] }); } catch { /* annulé */ }
    } else download();
  };

  const shareWithLink = async () => {
    const f = file();
    if (!f || !url) return;
    if (navigator.canShare?.({ files: [f] })) {
      try { await navigator.share({ files: [f], text: `${shareText}\n${url}` }); } catch { /* annulé */ }
    } else {
      download();
      copyLink();
    }
  };

  const remaining = Math.max(0, Math.ceil(VIDEO_SECONDS - progress * VIDEO_SECONDS));

  return (
    <div className="rounded-2xl bg-gradient-to-br from-purple-700/30 to-pink-600/20 border border-purple-400/20 p-4">
      <div className="flex gap-4 items-center">
        <div className="relative w-[108px] aspect-[9/16] rounded-xl overflow-hidden bg-[#0A0614] flex-shrink-0 ring-1 ring-white/10">
          {/* Le canvas sert à la création ; la vidéo finie le remplace. */}
          <canvas ref={canvasRef} className={`w-full h-full ${state === 'recording' ? 'block' : 'hidden'}`} />
          {state === 'ready' && result && (
            result.isImage
              ? <img src={result.objectUrl} alt="" className="w-full h-full object-cover" />
              : <video src={result.objectUrl} className="w-full h-full object-cover" autoPlay loop muted playsInline />
          )}
          {(state === 'idle' || state === 'error') && (
            <div className="absolute inset-0 flex items-center justify-center">
              {placeholder || <Clapperboard className="w-8 h-8 text-purple-300/60" />}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-bold leading-tight">{title || (canRecord ? 'Vidéo pour ta story Insta' : 'Image pour ta story Insta')}</p>
          <p className="text-xs text-purple-200/70 mt-1">
            {subtitle || (canRecord
              ? `${VIDEO_SECONDS} s avec le son, prête pour Insta, TikTok, Snap ou WhatsApp.`
              : 'Ta story Insta avec la pochette et le lien.')}
          </p>

          {state === 'idle' && (
            <button
              onClick={start}
              disabled={!url}
              className="mt-3 w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {url ? <Clapperboard className="w-4 h-4" /> : <Loader2 className="w-4 h-4 animate-spin" />}
              {canRecord ? 'Créer la vidéo' : 'Créer l\'image'}
            </button>
          )}

          {state === 'recording' && (
            <div className="mt-3">
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-[width] duration-200" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
              <p className="text-[11px] text-purple-200/70 mt-1.5">Création en cours… {remaining} s</p>
            </div>
          )}

          {state === 'ready' && (
            <div className="mt-3 space-y-2">
              <button onClick={shareToStory} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 font-bold text-sm flex items-center justify-center gap-2">
                <Share2 className="w-4 h-4" /> Story Insta / TikTok
              </button>
              <div className="flex gap-2">
                <button onClick={shareWithLink} className="flex-1 py-2 rounded-xl bg-white/10 border border-white/15 font-semibold text-xs flex items-center justify-center gap-1.5">
                  <MessageCircle className="w-4 h-4" /> WhatsApp, SMS…
                </button>
                <button onClick={download} className="px-3 rounded-xl bg-white/10 border border-white/15" aria-label="Enregistrer">
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {state === 'error' && (
            <button onClick={() => setState('idle')} className="mt-3 text-xs text-pink-300 underline">
              La création a échoué — réessayer
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {linkCopied && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="overflow-hidden">
            <div className="mt-3 flex gap-2 items-start text-[12px] text-purple-100/90 bg-black/25 rounded-xl p-3" role="status">
              <Copy className="w-4 h-4 flex-shrink-0 mt-0.5 text-pink-300" />
              <span><b>Lien copié : colle-le en sticker « Lien » sur ta story.</b> Tes potes tapent dessus et tombent direct sur le son.</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
