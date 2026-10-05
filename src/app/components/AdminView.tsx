// Page admin (P15 / P17), visible seulement par le compte de Kenny (la base
// refuse la lecture à tout autre compte). Signalements de bugs et de contenus,
// avec statut et actions rapides.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Bug, Flag, Loader2, RefreshCw, EyeOff, Check, Zap, DatabaseBackup } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatPostDate } from '../../lib/dates';
import { useBackHandler } from '../../lib/navigation';
import { openProfile } from '../../lib/appNav';
import { sendTestError, sentryEnabled } from '../../lib/sentry';
import { REPORT_REASONS } from '../../lib/moderation';

const BUG_STATUS = [
  { key: 'nouveau', label: 'Nouveau' },
  { key: 'vu', label: 'Vu' },
  { key: 'regle', label: 'Réglé' },
];

export function AdminView({ onClose }: { onClose: () => void }) {
  useBackHandler(true, onClose);
  const [tab, setTab] = useState<'bugs' | 'reports'>('bugs');
  const [bugs, setBugs] = useState<any[] | null>(null);
  const [reports, setReports] = useState<any[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [shots, setShots] = useState<Record<string, string>>({});
  const [openInfo, setOpenInfo] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const [b, r] = await Promise.all([
      supabase.from('bug_reports').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('reports').select('*').order('created_at', { ascending: false }).limit(200),
    ]);
    if (b.error || r.error) { setMsg('Lecture refusée : cette page est réservée à l’admin.'); setBugs([]); setReports([]); return; }
    setBugs(b.data || []);
    setReports(r.data || []);
    const ids = [...new Set([...(b.data || []).map((x: any) => x.user_id), ...(r.data || []).flatMap((x: any) => [x.reporter_id, x.target_user_id])].filter(Boolean))];
    if (ids.length) {
      const { data } = await supabase.from('users_profile').select('id, username').in('id', ids);
      setNames(Object.fromEntries((data || []).map((u: any) => [u.id, u.username])));
    }
    // Captures : liens signés (espace privé).
    const withShot = (b.data || []).filter((x: any) => x.screenshot_path);
    if (withShot.length) {
      const { data } = await supabase.storage.from('bug-screens').createSignedUrls(withShot.map((x: any) => x.screenshot_path), 3600);
      setShots(Object.fromEntries((data || []).map((d: any, i: number) => [withShot[i].id, d.signedUrl])));
    }
  };
  useEffect(() => { load(); }, []);

  const setBugStatus = async (id: string, status: string) => {
    setBugs((l) => (l || []).map((x) => (x.id === id ? { ...x, status } : x)));
    const { error } = await supabase.from('bug_reports').update({ status }).eq('id', id);
    if (error) { setMsg('Statut non enregistré.'); load(); }
  };
  const moderate = async (id: string, action: 'hide' | 'ignore') => {
    if (action === 'hide' && !confirm('Retirer ce contenu pour tout le monde ?')) return;
    const { error } = await supabase.rpc('admin_moderate', { p_report: id, p_action: action });
    if (error) setMsg(`Action refusée : ${error.message}`);
    load();
  };
  const reasonLabel = (k: string) => REPORT_REASONS.find((r) => r.key === k)?.label || k;
  const who = (id?: string | null) => (id ? (names[id] ? `@${names[id]}` : '…') : 'compte supprimé');
  const newBugs = (bugs || []).filter((b) => b.status === 'nouveau').length;
  const newReports = (reports || []).filter((r) => r.status === 'nouveau').length;

  return createPortal(
    <div className="fixed inset-0 z-[66] bg-[#1E1440] text-white flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-purple-800/30 pt-[max(0.625rem,env(safe-area-inset-top))]">
        <button aria-label="Retour" onClick={onClose} className="p-2 rounded-full hover:bg-purple-900/40"><ArrowLeft className="w-5 h-5" /></button>
        <p className="flex-1 font-bold">Admin</p>
        <button onClick={() => { const ok = sendTestError(); setMsg(ok ? 'Erreur de test envoyée : regarde Sentry → Issues.' : 'Sentry pas encore configuré (VITE_SENTRY_DSN manquant).'); }}
          className="px-3 py-1.5 rounded-full bg-purple-900/50 text-xs font-semibold flex items-center gap-1.5" title="Vérifier Sentry">
          <Zap className="w-3.5 h-3.5" /> Test Sentry {sentryEnabled ? '' : '(off)'}
        </button>
        <button aria-label="Actualiser" onClick={load} className="p-2 rounded-full hover:bg-purple-900/40"><RefreshCw className="w-4 h-4" /></button>
      </div>
      <BackupStatus />
      <div className="grid grid-cols-2 border-b border-purple-800/30">
        <button onClick={() => setTab('bugs')} className={`py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5 ${tab === 'bugs' ? 'text-white border-b-2 border-pink-500' : 'text-purple-300/85'}`}><Bug className="w-4 h-4" /> Bugs {newBugs ? `(${newBugs})` : ''}</button>
        <button onClick={() => setTab('reports')} className={`py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5 ${tab === 'reports' ? 'text-white border-b-2 border-pink-500' : 'text-purple-300/85'}`}><Flag className="w-4 h-4" /> Signalements {newReports ? `(${newReports})` : ''}</button>
      </div>
      {msg && <p className="m-3 text-xs text-pink-200 bg-pink-500/10 border border-pink-500/20 rounded-lg px-3 py-2" onClick={() => setMsg(null)}>{msg}</p>}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 max-w-2xl w-full mx-auto">
        {(tab === 'bugs' ? bugs : reports) === null ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-purple-400" /></div>
        ) : tab === 'bugs' ? (
          bugs!.length === 0 ? <p className="text-center text-sm text-purple-300/85 py-12">Aucun bug signalé.</p> : bugs!.map((b) => (
            <div key={b.id} className={`rounded-xl border p-3 ${b.status === 'nouveau' ? 'border-pink-500/40 bg-pink-500/5' : 'border-purple-700/30 bg-violet-950/30'}`}>
              <div className="flex items-center gap-2 text-xs text-purple-300/90 mb-1.5">
                <button onClick={() => b.user_id && openProfile(b.user_id)} className="font-semibold text-purple-100">{who(b.user_id)}</button>
                <span>· {formatPostDate(b.created_at)}</span>
                <span className="ml-auto">{b.info?.telephone} · {b.info?.navigateur}{b.info?.appli_installee ? ' · appli' : ''}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap break-words">{b.text}</p>
              {shots[b.id] && <a href={shots[b.id]} target="_blank" rel="noreferrer"><img src={shots[b.id]} alt="Capture" className="mt-2 max-h-56 rounded-lg" /></a>}
              <button onClick={() => setOpenInfo(openInfo === b.id ? null : b.id)} className="mt-2 text-[11px] text-purple-300/90 underline">Infos techniques</button>
              {openInfo === b.id && <pre className="mt-1 text-[10px] bg-black/30 rounded-lg p-2 overflow-x-auto">{JSON.stringify(b.info, null, 2)}</pre>}
              <div className="flex gap-1.5 mt-2">
                {BUG_STATUS.map((s) => (
                  <button key={s.key} onClick={() => setBugStatus(b.id, s.key)} className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${b.status === s.key ? 'bg-pink-500 text-white' : 'bg-purple-900/50 text-purple-200'}`}>{s.label}</button>
                ))}
              </div>
            </div>
          ))
        ) : (
          reports!.length === 0 ? <p className="text-center text-sm text-purple-300/85 py-12">Aucun signalement.</p> : reports!.map((r) => (
            <div key={r.id} className={`rounded-xl border p-3 ${r.status === 'nouveau' ? 'border-pink-500/40 bg-pink-500/5' : 'border-purple-700/30 bg-violet-950/30 opacity-80'}`}>
              <div className="flex flex-wrap items-center gap-x-2 text-xs text-purple-300/90 mb-1.5">
                <span className="px-1.5 py-0.5 rounded bg-purple-800/60 text-purple-100">{r.target_kind}</span>
                <span className="font-semibold text-pink-200">{reasonLabel(r.reason)}</span>
                <span>· par {who(r.reporter_id)} · {formatPostDate(r.created_at)}</span>
                <span className="ml-auto">{r.status === 'nouveau' ? 'Nouveau' : r.status === 'masque' ? 'Masqué' : 'Ignoré'}</span>
              </div>
              <p className="text-xs text-purple-200/80">Visé : <button onClick={() => r.target_user_id && openProfile(r.target_user_id)} className="font-semibold text-white underline">{who(r.target_user_id)}</button></p>
              {r.details && <p className="text-sm mt-1">« {r.details} »</p>}
              {r.snapshot && (
                <div className="mt-2 text-xs bg-black/25 rounded-lg p-2 space-y-0.5">
                  {Object.entries(r.snapshot).filter(([, v]) => v).map(([k, v]) => (
                    <p key={k}><span className="text-purple-300/85">{k} :</span> {String(v)}</p>
                  ))}
                </div>
              )}
              {r.status === 'nouveau' && (
                <div className="flex gap-2 mt-2">
                  <button onClick={() => moderate(r.id, 'hide')} className="px-3 py-1.5 rounded-lg bg-red-500/80 text-xs font-semibold flex items-center gap-1"><EyeOff className="w-3.5 h-3.5" /> Masquer</button>
                  <button onClick={() => moderate(r.id, 'ignore')} className="px-3 py-1.5 rounded-lg bg-purple-800/60 text-xs font-semibold flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Ignorer</button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>,
    document.body,
  );
}

// R10 : état des sauvegardes nocturnes (écrit par la tâche GitHub « Sauvegarde »).
// Rouge si la dernière a échoué ou si la dernière réussie date de plus de 36 h.
function BackupStatus() {
  const [st, setSt] = useState<any | null | undefined>(undefined);
  useEffect(() => { supabase.rpc('admin_backup_status').then(({ data, error }) => setSt(error ? null : data), () => setSt(null)); }, []);
  if (st === undefined || st === null) return null;
  const ok = st.last_ok;
  const ageH = ok ? (Date.now() - new Date(ok.created_at).getTime()) / 3600000 : Infinity;
  const failed = st.last && !st.last.ok;
  const bad = failed || ageH > 36;
  const mb = (b?: number | null) => (b ? `${(b / 1048576).toFixed(1).replace('.', ',')} Mo` : null);
  return (
    <div role={bad ? 'alert' : undefined} className={`mx-3 mt-2 px-3 py-2 rounded-xl text-xs flex items-start gap-2 ${bad ? 'bg-red-900/50 border border-red-400/50 text-red-50' : 'bg-emerald-900/30 border border-emerald-400/30 text-emerald-50'}`}>
      <DatabaseBackup className="w-4 h-4 flex-shrink-0 mt-px" />
      <p className="leading-snug">
        {!ok ? 'Aucune sauvegarde réussie pour l’instant : configure-la (docs/restauration.md).'
          : <>Dernière sauvegarde {formatPostDate(ok.created_at)} · {ok.tables} tables, {Number(ok.rows_total).toLocaleString('fr-FR')} lignes{mb(ok.db_bytes) ? ` · ${mb(ok.db_bytes)}` : ''} · {ok.restore_ok ? 'restaurable ✓' : 'restauration non testée'}</>}
        {failed && <><br />⚠️ Le dernier passage a échoué {formatPostDate(st.last.created_at)} : GitHub → Actions → Sauvegarde.</>}
        {!failed && ok && ageH > 36 && <><br />⚠️ Plus de 36 h sans sauvegarde : regarde GitHub → Actions → Sauvegarde.</>}
      </p>
    </div>
  );
}
