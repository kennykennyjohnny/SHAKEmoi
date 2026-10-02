// Bloquer, signaler (P17) et signaler un bug (P15). Les règles sont imposées par
// la base ; ici, seulement les appels.
import { supabase } from './supabase';
import { compressImage } from './media';

export type BlockStatus = 'none' | 'i_blocked' | 'blocked_me';
export type ReportKind = 'user' | 'post' | 'comment' | 'message' | 'circle_message' | 'story';
export type ReportReason = 'spam' | 'harcelement' | 'choquant' | 'faux_compte' | 'autre';

export const REPORT_REASONS: { key: ReportReason; label: string }[] = [
  { key: 'spam', label: 'Spam ou pub' },
  { key: 'harcelement', label: 'Harcèlement ou insultes' },
  { key: 'choquant', label: 'Contenu choquant' },
  { key: 'faux_compte', label: 'Faux compte / usurpation' },
  { key: 'autre', label: 'Autre' },
];

async function myId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function getBlockStatus(userId: string): Promise<BlockStatus> {
  const { data } = await supabase.rpc('get_block_status', { p_user: userId });
  return (data as BlockStatus) || 'none';
}

export async function blockUser(userId: string): Promise<boolean> {
  const me = await myId();
  if (!me) return false;
  const { error } = await supabase.from('blocks').insert({ blocker_id: me, blocked_id: userId });
  if (!error || /duplicate/i.test(error.message)) {
    window.dispatchEvent(new CustomEvent('shakemoi:blocks-changed'));
    return true;
  }
  return false;
}

export async function unblockUser(userId: string): Promise<boolean> {
  const me = await myId();
  if (!me) return false;
  const { error } = await supabase.from('blocks').delete().eq('blocker_id', me).eq('blocked_id', userId);
  if (!error) window.dispatchEvent(new CustomEvent('shakemoi:blocks-changed'));
  return !error;
}

export async function getMyBlocks(): Promise<any[]> {
  const { data } = await supabase.rpc('get_my_blocks');
  return data || [];
}

export async function reportContent(kind: ReportKind, id: string, reason: ReportReason, details?: string): Promise<boolean> {
  const { error } = await supabase.rpc('report_content', { p_kind: kind, p_id: id, p_reason: reason, p_details: details || null });
  return !error;
}

/** Infos ajoutées automatiquement à un signalement de bug (P15). */
export function deviceInfo(): Record<string, any> {
  const ua = navigator.userAgent;
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
  let view = '';
  try { view = sessionStorage.getItem('shakemoi_view') || ''; } catch { /* pas grave */ }
  return {
    ua,
    telephone: /iPhone|iPad|iPod/.test(ua) ? 'iPhone / iPad' : /Android/.test(ua) ? 'Android' : 'Ordinateur',
    navigateur: /CriOS|Chrome/.test(ua) ? 'Chrome' : /FxiOS|Firefox/.test(ua) ? 'Firefox' : /Safari/.test(ua) ? 'Safari' : 'Autre',
    appli_installee: standalone,
    ecran: `${window.innerWidth}×${window.innerHeight}`,
    vue: view || 'feed',
    adresse: location.pathname + location.search,
    version: (import.meta as any).env?.VITE_APP_VERSION || __APP_VERSION__,
    langue: navigator.language,
    date: new Date().toISOString(),
  };
}

export async function submitBugReport(text: string, screenshot?: File | null): Promise<boolean> {
  const me = await myId();
  if (!me) return false;
  let path: string | null = null;
  if (screenshot) {
    const small = await compressImage(screenshot, 1600, 0.8);
    path = `${me}/${Date.now()}.jpg`;
    const { error } = await supabase.storage.from('bug-screens').upload(path, small, { contentType: small.type || 'image/jpeg', upsert: false });
    if (error) path = null; // le texte part quand même
  }
  const { error } = await supabase.from('bug_reports').insert({ user_id: me, text: text.trim().slice(0, 4000), screenshot_path: path, info: deviceInfo() });
  return !error;
}

export async function isAdmin(): Promise<boolean> {
  const { data } = await supabase.rpc('is_admin');
  return !!data;
}
