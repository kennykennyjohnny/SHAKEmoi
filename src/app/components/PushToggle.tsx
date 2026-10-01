// Interrupteur « Notifications sur le téléphone » (P6), le même en haut de
// l'onglet Notifications et dans les Paramètres. Son état reflète la réalité :
// abonnement push présent, autorisation refusée, iPhone pas installé, etc.
import { useEffect, useState } from 'react';
import { BellRing, Loader2 } from 'lucide-react';
import { getPushStatus, enablePush, disablePush, pushStatusHelp, sendTestPush, type PushStatus } from '../../lib/push';
import { DEFAULT_NOTIF_PREFS, getNotifPrefs, saveNotifPrefs, type NotifPrefs } from '../../lib/notify';

export function Switch({ on, disabled, onClick, label }: { on: boolean; disabled?: boolean; onClick: () => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors disabled:opacity-50 ${on ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-purple-900/60'}`}
    >
      <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

export function PushToggle({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPushStatus().then(setStatus);
    // Autorisation changée dans les réglages du téléphone puis retour dans l'appli.
    const onVisible = () => { if (document.visibilityState === 'visible') getPushStatus().then(setStatus); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const toggle = async () => {
    if (!status || busy) return;
    setBusy(true);
    setError(null);
    try {
      const next = status === 'on' ? await disablePush() : await enablePush();
      setStatus(next);
      // Activé : le serveur envoie tout de suite une notif de test.
      if (status !== 'on' && next === 'on') sendTestPush().catch(() => {});
    } catch {
      setError('Ça n’a pas marché. Vérifie ta connexion et réessaie.');
      setStatus(await getPushStatus());
    }
    setBusy(false);
  };

  const help = status ? pushStatusHelp(status) : null;
  const canToggle = status === 'on' || status === 'off';

  return (
    <div className={compact ? 'px-4 py-3 border-b border-purple-500/15' : 'bg-purple-950/40 rounded-xl p-3'}>
      <div className="flex items-center gap-3">
        <BellRing className="w-4 h-4 text-purple-300 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white font-medium">Notifications sur le téléphone</p>
          <p className="text-xs text-purple-300/60">
            {status === 'on' ? 'Activées, même appli fermée' : status === 'off' ? 'Désactivées sur ce téléphone' : status === null ? '…' : 'Indisponibles ici'}
          </p>
        </div>
        {busy ? <Loader2 className="w-5 h-5 text-purple-300 animate-spin" /> : (
          <Switch on={status === 'on'} disabled={!canToggle} onClick={toggle} label="Notifications sur le téléphone" />
        )}
      </div>
      {(help || error) && <p className={`text-xs mt-2 ${status === 'denied' || error ? 'text-pink-300' : 'text-purple-200/80'}`}>{error || help}</p>}
    </div>
  );
}

const PREF_ROWS: { key: keyof NotifPrefs; label: string }[] = [
  { key: 'likes', label: 'Likes' },
  { key: 'comments', label: 'Commentaires et réponses en musique' },
  { key: 'reshakes', label: 'Reshakes' },
  { key: 'follows', label: 'Nouveaux abonnés' },
  { key: 'messages', label: 'Messages privés' },
  { key: 'circles', label: 'Cercles (messages, ajouts)' },
  { key: 'streak', label: 'Rappel de série de Shakes' },
];

/** Réglages détaillés, enregistrés en base tout de suite (respectés par le serveur). */
export function NotifPrefsList() {
  const [prefs, setPrefs] = useState<NotifPrefs>(() => ({ ...DEFAULT_NOTIF_PREFS, ...getNotifPrefs() }));
  const [saveError, setSaveError] = useState(false);
  const flip = async (key: keyof NotifPrefs) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setSaveError(!(await saveNotifPrefs(next)));
  };
  return (
    <div className="bg-purple-950/40 rounded-xl divide-y divide-purple-800/20">
      {PREF_ROWS.map((row) => (
        <div key={row.key} className="flex items-center justify-between gap-3 p-3">
          <span className="text-sm text-white">{row.label}</span>
          <Switch on={prefs[row.key] !== false} onClick={() => flip(row.key)} label={row.label} />
        </div>
      ))}
      {saveError && <p className="text-xs text-pink-300 p-3">Réglage gardé sur ce téléphone, mais pas encore enregistré (connexion ?).</p>}
    </div>
  );
}
