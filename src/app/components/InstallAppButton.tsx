// Bouton « Télécharger l'app » (A5).
// Android / Chrome : ouvre directement la fenêtre d'installation.
// iPhone : petit mode d'emploi (Partager → « Sur l'écran d'accueil »).
// Caché quand l'appli est déjà installée (ou sur ordinateur sans installation possible).
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Download, Share, PlusSquare, X } from 'lucide-react';

// L'évènement arrive parfois avant l'affichage : on le garde dès le chargement.
let deferredPrompt: any = null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt = e;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    try { localStorage.setItem('shakemoi_installed', '1'); } catch { /* ignoré */ }
    listeners.forEach((l) => l());
  });
}

function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}
function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

const DISMISS_KEY = 'shakemoi_install_dismissed';
function dismissedRecently(): boolean {
  try { return Date.now() - Number(localStorage.getItem(DISMISS_KEY) || 0) < 14 * 86_400_000; } catch { return false; }
}

export function InstallAppButton({ className = '', variant = 'pill' }: { className?: string; variant?: 'pill' | 'banner' }) {
  const [, force] = useState(0);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [dismissed, setDismissed] = useState(() => variant === 'banner' && dismissedRecently());
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  if (typeof window === 'undefined' || isStandalone()) return null;
  const ios = isIOS();
  if (!ios && !deferredPrompt) return null;
  if (dismissed && !showIosHelp) return null;

  const onClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try { await deferredPrompt.userChoice; } catch { /* ignoré */ }
      deferredPrompt = null;
      force((n) => n + 1);
      return;
    }
    setShowIosHelp(true);
  };

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignoré */ }
    setDismissed(true);
  };

  return (
    <>
      {variant === 'banner' ? (
        <div className={`mx-4 mt-2 flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-purple-600/25 to-pink-600/20 border border-purple-400/25 px-3 py-2 ${className}`}>
          <img src="/icon-192.png" alt="" className="w-8 h-8 rounded-lg flex-shrink-0" />
          <p className="flex-1 min-w-0 text-xs text-purple-100/90 leading-tight"><b className="text-white">SHAKEmoi sur ton écran d'accueil</b><br />Plus rapide, en plein écran.</p>
          <button onClick={onClick} className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full bg-white text-[#1E1440] text-xs font-bold">
            <Download className="w-3.5 h-3.5" /> Télécharger l'app
          </button>
          <button onClick={dismiss} aria-label="Masquer" className="flex-shrink-0 p-1 rounded-full text-purple-200/60 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
      <button
        onClick={onClick}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap bg-white/10 border border-white/15 text-white hover:bg-white/15 transition-colors ${className}`}
      >
        <Download className="w-3.5 h-3.5" />
        <span>Télécharger l'app</span>
      </button>
      )}

      <AnimatePresence>
        {showIosHelp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowIosHelp(false)}
          >
            <motion.div
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl bg-[#1D0F3D] border border-purple-500/30 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-white"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="font-bold">Installer SHAKEmoi sur ton iPhone</p>
                <button onClick={() => setShowIosHelp(false)} aria-label="Fermer" className="p-1.5 rounded-full hover:bg-white/10">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="space-y-3 text-sm text-purple-100/90">
                <li className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-purple-600/40 flex items-center justify-center font-bold">1</span>
                  <span className="flex items-center gap-1.5">Dans Safari, touche <Share className="w-4 h-4 text-sky-400" /> <b>Partager</b></span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-purple-600/40 flex items-center justify-center font-bold">2</span>
                  <span className="flex items-center gap-1.5">Choisis <PlusSquare className="w-4 h-4" /> <b>Sur l'écran d'accueil</b></span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-purple-600/40 flex items-center justify-center font-bold">3</span>
                  <span>Touche <b>Ajouter</b> : l'icône SHAKEmoi apparaît avec tes applis.</span>
                </li>
              </ol>
              <p className="mt-4 text-xs text-purple-300/60">Ça marche aussi depuis Chrome sur iPhone (menu Partager).</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
