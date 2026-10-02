// Feuilles de modération : Signaler (P17), Signaler un bug (P15), personnes
// bloquées (P17). Même présentation partout (feuille qui monte du bas).
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { X, Loader2, Flag, Bug, ImagePlus, Check } from 'lucide-react';
import { REPORT_REASONS, reportContent, submitBugReport, getMyBlocks, unblockUser, type ReportKind, type ReportReason } from '../../lib/moderation';
import { useBackHandler } from '../../lib/navigation';
import { avatarThumb, defaultAvatar } from '../../lib/media';

function Sheet({ title, icon, onClose, children }: { title: string; icon?: ReactNode; onClose: () => void; children: ReactNode }) {
  useBackHandler(true, onClose);
  return createPortal(
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[65] bg-black/70" onClick={onClose} />
      <div className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center pointer-events-none">
        <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ type: 'tween', duration: 0.2 }}
          className="pointer-events-auto w-full sm:max-w-md max-h-[90dvh] bg-[#1D0F3D] rounded-t-3xl sm:rounded-2xl border-t sm:border border-purple-700/40 flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom)]"
          role="dialog" aria-label={title}>
          <div className="flex items-center gap-2 px-4 py-3 border-b border-purple-800/30">
            {icon}
            <p className="flex-1 font-bold">{title}</p>
            <button aria-label="Fermer" onClick={onClose} className="p-1.5 rounded-full hover:bg-purple-900/40"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
        </motion.div>
      </div>
    </>,
    document.body,
  );
}

const KIND_LABEL: Record<ReportKind, string> = {
  user: 'ce compte', post: 'ce shake', comment: 'ce commentaire', message: 'ce message', circle_message: 'ce message', story: 'ce Shake éphémère',
};

/** Signaler une personne, un post, un commentaire, un message ou un Shake éphémère. */
export function ReportSheet({ kind, id, onClose }: { kind: ReportKind; id: string; onClose: () => void }) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);
  const send = async () => {
    if (!reason) return;
    setSending(true);
    setError(false);
    const ok = await reportContent(kind, id, reason, details);
    setSending(false);
    if (ok) setDone(true); else setError(true);
  };
  return (
    <Sheet title={`Signaler ${KIND_LABEL[kind]}`} icon={<Flag className="w-4 h-4 text-pink-300" />} onClose={onClose}>
      {done ? (
        <div className="text-center py-8">
          <Check className="w-10 h-10 text-emerald-300 mx-auto mb-3" />
          <p className="font-semibold">Merci, c'est signalé.</p>
          <p className="text-sm text-purple-200/70 mt-1">Kenny va regarder. Tu peux aussi bloquer la personne depuis son profil.</p>
          <button onClick={onClose} className="mt-5 px-5 py-2 rounded-full bg-purple-700/60 text-sm font-semibold">Fermer</button>
        </div>
      ) : (
        <>
          <p className="text-sm text-purple-200/80 mb-3">Pourquoi ? (la personne ne saura pas que c'est toi)</p>
          <div className="space-y-1.5">
            {REPORT_REASONS.map((r) => (
              <button key={r.key} onClick={() => setReason(r.key)}
                className={`w-full text-left px-3 py-3 rounded-xl border text-sm ${reason === r.key ? 'border-pink-400 bg-pink-500/10 text-white' : 'border-purple-700/40 text-purple-100 hover:bg-purple-900/30'}`}>
                {r.label}
              </button>
            ))}
          </div>
          <textarea value={details} onChange={(e) => setDetails(e.target.value.slice(0, 1000))} rows={3} placeholder="Ajoute un mot si tu veux (facultatif)"
            className="mt-3 w-full px-3 py-2 bg-violet-950/40 border border-purple-500/30 rounded-xl text-base sm:text-sm text-white placeholder-purple-300/40 focus:outline-none focus:border-pink-400" />
          {error && <p className="text-xs text-pink-300 mt-2">Le signalement n'est pas parti. Réessaie.</p>}
          <button onClick={send} disabled={!reason || sending} className="mt-4 w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 font-semibold disabled:opacity-40 flex items-center justify-center gap-2">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Envoyer le signalement'}
          </button>
        </>
      )}
    </Sheet>
  );
}

/** P15 : un champ texte, une capture en option, les infos ajoutées toutes seules. */
export function BugReportSheet({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('');
  const [shot, setShot] = useState<{ file: File; url: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url); }, [shot]);
  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    setError(false);
    const ok = await submitBugReport(text, shot?.file);
    setSending(false);
    if (ok) setDone(true); else setError(true);
  };
  return (
    <Sheet title="Signaler un bug" icon={<Bug className="w-4 h-4 text-pink-300" />} onClose={onClose}>
      {done ? (
        <div className="text-center py-8">
          <p className="text-3xl mb-2">🙏</p>
          <p className="font-semibold">Merci ! Kenny regarde ça 🙏</p>
          <button onClick={onClose} className="mt-5 px-5 py-2 rounded-full bg-purple-700/60 text-sm font-semibold">Fermer</button>
        </div>
      ) : (
        <>
          <textarea autoFocus value={text} onChange={(e) => setText(e.target.value.slice(0, 4000))} rows={5}
            placeholder="Qu'est-ce qui ne marche pas ? Où étais-tu, qu'as-tu touché ?"
            className="w-full px-3 py-2 bg-violet-950/40 border border-purple-500/30 rounded-xl text-base sm:text-sm text-white placeholder-purple-300/40 focus:outline-none focus:border-pink-400" />
          <div className="mt-3 flex items-center gap-3">
            {shot ? (
              <div className="relative">
                <img src={shot.url} alt="Capture" className="h-20 rounded-lg object-cover" />
                <button aria-label="Retirer la capture" onClick={() => setShot(null)} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center"><X className="w-3 h-3" /></button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-purple-600/40 text-sm text-purple-100">
                <ImagePlus className="w-4 h-4" /> Ajouter une capture d'écran
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setShot({ file: f, url: URL.createObjectURL(f) }); }} />
          </div>
          <p className="text-[11px] text-purple-300/60 mt-3">Ajouté automatiquement : ton téléphone, ton navigateur, la version de l'appli, l'écran en cours et ton compte. Rien d'autre.</p>
          {error && <p className="text-xs text-pink-300 mt-2">Le signalement n'est pas parti. Réessaie.</p>}
          <button onClick={send} disabled={!text.trim() || sending} className="mt-4 w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 font-semibold disabled:opacity-40 flex items-center justify-center gap-2">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Envoyer'}
          </button>
        </>
      )}
    </Sheet>
  );
}

/** Paramètres → Personnes bloquées, avec Débloquer. */
export function BlockedUsersSheet({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<any[] | null>(null);
  useEffect(() => { getMyBlocks().then(setList).catch(() => setList([])); }, []);
  const unblock = async (u: any) => {
    if (!confirm(`Débloquer @${u.username} ? Vous ne vous suivrez pas automatiquement.`)) return;
    if (await unblockUser(u.id)) setList((l) => (l || []).filter((x) => x.id !== u.id));
    else alert('Impossible de débloquer pour l’instant. Réessaie.');
  };
  return (
    <Sheet title="Personnes bloquées" onClose={onClose}>
      {list === null ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-purple-400" /></div>
        : list.length === 0 ? <p className="text-sm text-purple-300/70 text-center py-8">Tu n'as bloqué personne.</p>
        : list.map((u) => (
          <div key={u.id} className="flex items-center gap-3 p-2 rounded-xl">
            <img src={avatarThumb(u.profile_album_cover_url, 64) || defaultAvatar(u.username)} alt="" className="w-10 h-10 rounded-full object-cover" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{u.display_name || u.username}</p>
              <p className="text-xs text-purple-300/60">@{u.username}</p>
            </div>
            <button onClick={() => unblock(u)} className="px-3 py-1.5 rounded-lg bg-purple-800/60 text-xs font-semibold">Débloquer</button>
          </div>
        ))}
    </Sheet>
  );
}
