// R8 : bandeau pour les visiteurs arrivés dans le navigateur intégré d'une
// appli (Instagram, TikTok…). Ce navigateur ne garde ni la session ni, parfois,
// le stockage : on propose d'ouvrir la même adresse (invitation comprise) dans
// le vrai navigateur. Android : un bouton ouvre Chrome directement. iPhone :
// pas de lien possible vers Safari, donc le geste à faire + « Copier le lien ».
import { useState } from 'react';
import { ExternalLink, Copy, Check, X, MoreHorizontal } from 'lucide-react';
import { ENTRY_PATH, chromeIntent, inAppBrowser, withRef } from '../../lib/referral';
import { PUBLIC_ORIGIN } from '../../lib/links';

const DISMISS_KEY = 'shakemoi_inapp_dismissed';

export function InAppBanner() {
  const env = inAppBrowser();
  const [hidden, setHidden] = useState(() => { try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; } });
  const [copied, setCopied] = useState(false);
  if (!env || hidden) return null;

  // L'adresse d'arrivée (avant toute réécriture), avec le parrain.
  const url = `${PUBLIC_ORIGIN}${withRef(ENTRY_PATH)}`;
  const close = () => { setHidden(true); try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* rien */ } };
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); }
    catch {
      const t = document.createElement('textarea'); t.value = url; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); } catch { /* rien */ } t.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div role="region" aria-label="Ouvrir dans ton navigateur"
      className="relative z-[60] px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 bg-[#2A1852]/95 backdrop-blur border-b border-purple-500/30 text-white shadow-lg">
      <div className="max-w-md mx-auto flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold leading-snug">Tu es dans le navigateur d'{env.app}</p>
          {env.os === 'android' ? (
            <p className="text-xs text-purple-100 leading-snug mt-0.5">Ouvre SHAKEmoi dans Chrome pour rester connecté·e (ton invitation suit).</p>
          ) : (
            <p className="text-xs text-purple-100 leading-snug mt-0.5">
              Touche <MoreHorizontal className="inline w-4 h-4 -mt-0.5" aria-label="les trois points" /> en haut à droite, puis
              {' '}<b>« Ouvrir dans le navigateur externe »</b> (ton invitation suit).
            </p>
          )}
          <div className="flex gap-2 mt-2">
            {env.os === 'android' && (
              <a href={chromeIntent(url)} className="min-h-[44px] px-3 rounded-full bg-white text-[#1E1440] text-xs font-bold flex items-center gap-1.5">
                <ExternalLink className="w-4 h-4" /> Ouvrir dans Chrome
              </a>
            )}
            <button onClick={copy} className="min-h-[44px] px-3 rounded-full bg-purple-700/70 border border-purple-400/40 text-xs font-bold flex items-center gap-1.5">
              {copied ? <><Check className="w-4 h-4" /> Lien copié</> : <><Copy className="w-4 h-4" /> Copier le lien</>}
            </button>
          </div>
        </div>
        <button aria-label="Fermer le bandeau" onClick={close} className="w-11 h-11 -mr-1 rounded-full flex items-center justify-center text-purple-100 hover:bg-white/10 flex-shrink-0">
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
