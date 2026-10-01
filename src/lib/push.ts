// SHAKEMOI — notifications push sur ce téléphone (P6 / P7).
// L'abonnement Web Push de l'appareil est enregistré en base ; le serveur
// (Edge Function `push`) envoie les notifs, même appli fermée.
// iPhone : seulement dans l'appli installée sur l'écran d'accueil (iOS 16.4+).

import { supabase } from './supabase';

export type PushStatus =
  | 'on'                // abonné, les notifs arrivent sur ce téléphone
  | 'off'               // possible, pas activé
  | 'denied'            // refusé dans les réglages du téléphone / navigateur
  | 'ios-install'       // iPhone dans Safari : il faut installer l'appli d'abord
  | 'unsupported';      // navigateur sans notifications push

const LEGACY_KEY = 'shakemoi_push_enabled';

export function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}

function supported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined';
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register('/sw.js'));
  } catch {
    return null;
  }
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!supported()) return isIOS() && !isStandalone() ? 'ios-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription().catch(() => null);
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

function b64urlToBytes(str: string): Uint8Array {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function vapidPublicKey(): Promise<string> {
  const { data } = await supabase.rpc('get_vapid_public_key');
  if (data) return data as string;
  // Première fois : la fonction crée les clés et renvoie la clé publique.
  const r = await supabase.functions.invoke('push', { body: { action: 'setup' } });
  if (r.error || !r.data?.publicKey) throw new Error('vapid');
  return r.data.publicKey;
}

async function save(sub: PushSubscription) {
  const json = sub.toJSON() as any;
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: json.endpoint, p_p256dh: json.keys?.p256dh, p_auth: json.keys?.auth, p_user_agent: navigator.userAgent,
  });
  if (error) throw error;
}

/** Active les notifs sur ce téléphone. Renvoie le nouvel état. */
export async function enablePush(): Promise<PushStatus> {
  if (!supported()) return isIOS() && !isStandalone() ? 'ios-install' : 'unsupported';
  const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'off';
  const reg = await registration();
  if (!reg) return 'unsupported';
  await navigator.serviceWorker.ready;
  const key = await vapidPublicKey();
  let sub = await reg.pushManager.getSubscription();
  // Abonnement fait avec une autre clé (ancienne version) : on le refait.
  const current = sub?.options?.applicationServerKey;
  if (sub && current && btoa(String.fromCharCode(...new Uint8Array(current))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') !== key) {
    await sub.unsubscribe().catch(() => {});
    sub = null;
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64urlToBytes(key) as BufferSource });
  await save(sub);
  try { localStorage.setItem(LEGACY_KEY, 'true'); } catch { /* pas grave */ }
  return 'on';
}

/** Notif de test envoyée par le serveur à ce compte (preuve que tout marche). */
export async function sendTestPush(): Promise<boolean> {
  const r = await supabase.functions.invoke('push', { body: { action: 'test' } });
  return !r.error && (r.data?.sent ?? 0) > 0;
}

/** Coupe les notifs sur CE téléphone (les autres appareils ne changent pas). */
export async function disablePush(): Promise<PushStatus> {
  try { localStorage.setItem(LEGACY_KEY, 'false'); } catch { /* pas grave */ }
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription().catch(() => null);
  if (sub) {
    await supabase.rpc('delete_push_subscription', { p_endpoint: sub.endpoint }).then(() => {}, () => {});
    await sub.unsubscribe().catch(() => {});
  }
  return getPushStatus();
}

/**
 * Au démarrage (connecté) : l'abonnement de l'appareil est rattaché au compte
 * en cours. Quelqu'un qui avait activé les notifs « appli ouverte » avant P7 et
 * a déjà donné son accord passe automatiquement aux vraies notifs push.
 */
export async function syncPushSubscription() {
  try {
    if (!supported() || Notification.permission !== 'granted') return;
    const reg = await registration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) { await save(sub); return; }
    if (localStorage.getItem(LEGACY_KEY) === 'true') await enablePush();
  } catch { /* silencieux : réessayé au prochain démarrage */ }
}

/** Déconnexion : ce téléphone ne reçoit plus les notifs de ce compte. */
export async function forgetPushOnLogout() {
  try {
    const reg = await registration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await supabase.rpc('delete_push_subscription', { p_endpoint: sub.endpoint });
    await sub.unsubscribe();
  } catch { /* pas grave */ }
}

/** Phrase courte qui explique l'état quand ce n'est pas possible. */
export function pushStatusHelp(status: PushStatus): string | null {
  switch (status) {
    case 'ios-install': return 'Sur iPhone : installe d’abord l’appli sur ton écran d’accueil (Partager → « Sur l’écran d’accueil »), puis active-les depuis l’appli.';
    case 'denied': return isIOS()
      ? 'Notifications refusées. Réglages de l’iPhone → Notifications → SHAKEmoi → Autoriser.'
      : 'Notifications bloquées. Touche le cadenas à gauche de l’adresse (ou Réglages du site) → Notifications → Autoriser.';
    case 'unsupported': return 'Ce navigateur ne gère pas les notifications. Essaie Chrome sur Android, ou l’appli installée sur iPhone.';
    default: return null;
  }
}
