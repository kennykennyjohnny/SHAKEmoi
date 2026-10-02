// Bouton « Télécharger l'app » (A5, M6).
// Toujours visible en haut de l'accueil tant que l'appli n'est pas installée
// (fermé : il revient 7 jours plus tard).
// - Android / Chrome / Edge : fenêtre d'installation directe si le navigateur
//   la propose, sinon mode d'emploi (menu ⋮ → « Installer l'application »).
// - iPhone / iPad : mode d'emploi (Partager → « Sur l'écran d'accueil »).
// - Ordinateur : icône d'installation dans la barre d'adresse.
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Download, Share, PlusSquare, X, MoreVertical, MonitorDown } from 'lucide-react';

// L'évènement arrive parfois avant l'affichage : on le garde dès le chargement.
let deferredPrompt: any = null;
const listeners = new Set<() => void>();
const INSTALLED_KEY = 'shakemoi_installed';
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt = e;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    try { localStorage.setItem(INSTALLED_KEY, '1'); } catch { /* ignoré */ }
    listeners.forEach((l) => l());
  });
}

function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches
    || window.matchMedia?.('(display-mode: fullscreen)').matches
    || (navigator as any).standalone === true;
}
type Platform = 'ios' | 'android' | 'desktop';
function platform(): Platform {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/android/i.test(ua)) return 'android';
  return 'desktop';
}

const DISMISS_KEY = 'shakemoi_install_dismissed';
const DISMISS_DAYS = 7;
function dismissedRecently(): boolean {
  try { return Date.now() - Number(localStorage.getItem(DISMISS_KEY) || 0) < DISMISS_DAYS * 86_400_000; } catch { return false; }
}
function installedHere(): boolean {
  try { return localStorage.getItem(INSTALLED_KEY) === '1'; } catch { return false; }
}

export function InstallAppButton({ className = '', variant = 'pill' }: { className?: string; variant?: 'pill' | 'banner' }) {
  const [, force] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [dismissed, setDismissed] = useState(() => variant === 'banner' && dismissedRecently());
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  if (typeof window === 'undefined' || isStandalone() || installedHere()) return null;
  if (dismissed && !showHelp) return null;
  const os = platform();

  const onClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try { await deferredPrompt.userChoice; } catch { /* ignoré */ }
      deferredPrompt = null;
      force((n) => n + 1);
      return;
    }
    setShowHelp(true);
  };

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignoré */ }
    setDismissed(true);
  };

  const steps: { icon: React.ReactNode; text: React.ReactNode }[] =
    os === 'ios' ? [
      { icon: <Share className="w-4 h-4 text-sky-400" />, text: <>Dans Safari, touche <b>Partager</b> (en bas de l'écran)</> },
      { icon: <PlusSquare className="w-4 h-4" />, text: <>Choisis <b>Sur l'écran d'accueil</b></> },
      { icon: null, text: <>Touche <b>Ajouter</b> : l'icône SHAKEmoi apparaît avec tes applis.</> },
    ] : os === 'android' ? [
      { icon: <MoreVertical className="w-4 h-4" />, text: <>Dans Chrome, touche le menu <b>⋮</b> en haut à droite</> },
      { icon: <Download className="w-4 h-4" />, text: <>Choisis <b>Installer l'application</b> (ou <b>Ajouter à l'écran d'accueil</b>)</> },
      { icon: null, text: <>Confirme : l'icône SHAKEmoi apparaît avec tes applis.</> },
    ] : [
      { icon: <MonitorDown className="w-4 h-4" />, text: <>Dans Chrome ou Edge, clique l'icône <b>Installer</b> au bout de la barre d'adresse</> },
      { icon: <MoreVertical className="w-4 h-4" />, text: <>Ou menu <b>⋮</b> → <b>Installer SHAKEmoi</b></> },
      { icon: null, text: <>SHAKEmoi s'ouvre alors dans sa propre fenêtre.</> },
    ];

  return (
    <>
      {variant === 'banner' ? (
        <div className={`mx-4 mt-2 flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-purple-600/25 to-pink-600/20 border border-purple-400/25 px-3 py-2 ${className}`}>
          <img src="/icon-192.png" alt="" className="w-8 h-8 rounded-lg flex-shrink-0" />
          <p className="flex-1 min-w-0 text-xs text-purple-100/90 leading-tight"><b className="text-white">SHAKEmoi sur ton écran d'accueil</b><br />Plus rapide, en plein écran.</p>
          <button onClick={onClick} className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full bg-white text-[#1E1440] text-xs font-bold">
            <Download className="w-3.5 h-3.5" /> Télécharger l'app
          </button>
          <button onClick={dismiss} aria-label="Masquer pendant 7 jours" className="flex-shrink-0 p-1 rounded-full text-purple-200/80 hover:text-white">
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
        {showHelp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowHelp(false)}
          >
            <motion.div
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl bg-[#1D0F3D] border border-purple-500/30 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-white"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="font-bold">
                  {os === 'ios' ? 'Installer SHAKEmoi sur ton iPhone' : os === 'android' ? 'Installer SHAKEmoi sur ton téléphone' : 'Installer SHAKEmoi sur ton ordinateur'}
                </p>
                <button onClick={() => setShowHelp(false)} aria-label="Fermer" className="p-1.5 rounded-full hover:bg-white/10">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="space-y-3 text-sm text-purple-100/90">
                {steps.map((s, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <span className="w-7 h-7 flex-shrink-0 rounded-full bg-purple-600/40 flex items-center justify-center font-bold">{i + 1}</span>
                    <span className="flex items-center gap-1.5 flex-wrap">{s.icon}{s.text}</span>
                  </li>
                ))}
              </ol>
              {os === 'ios' && <p className="mt-4 text-xs text-purple-300/85">Sur iPhone, ça marche depuis Safari (et Chrome récent, via Partager).</p>}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
