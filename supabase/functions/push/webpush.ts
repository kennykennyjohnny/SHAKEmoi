// Web Push standard (RFC 8291 chiffrement aes128gcm + RFC 8292 VAPID), avec
// la seule API crypto du navigateur/Deno : aucune bibliothèque externe.
// Testé en local par scripts/test-webpush.ts (chiffrement puis déchiffrement).

export interface VapidKeys {
  publicKey: string;   // point P-256 non compressé (65 octets), base64url
  privateJwk: JsonWebKey;
}

export interface PushSubscriptionKeys {
  endpoint: string;
  p256dh: string;      // base64url
  auth: string;        // base64url
}

const enc = new TextEncoder();

export function b64urlEncode(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}

/** Nouvelle paire de clés VAPID (à générer une seule fois). */
export async function generateVapidKeys(): Promise<VapidKeys> {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
  const privateJwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
  return { publicKey: b64urlEncode(raw), privateJwk };
}

/** En-tête Authorization VAPID (JWT ES256 signé, valable 12 h). */
export async function vapidAuthorization(endpoint: string, keys: VapidKeys, subject: string): Promise<string> {
  const aud = new URL(endpoint).origin;
  const header = b64urlEncode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = b64urlEncode(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const unsigned = `${header}.${payload}`;
  const jwk = { ...keys.privateJwk, key_ops: ['sign'], ext: true };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  // WebCrypto renvoie déjà la signature brute r||s (64 octets) attendue par JWS.
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(unsigned)));
  return `vapid t=${unsigned}.${b64urlEncode(sig)}, k=${keys.publicKey}`;
}

/** Chiffre le message pour un abonnement (RFC 8291, un seul enregistrement). */
export async function encryptPayload(sub: PushSubscriptionKeys, plaintext: Uint8Array): Promise<Uint8Array> {
  const uaPublic = b64urlDecode(sub.p256dh);
  const authSecret = b64urlDecode(sub.auth);

  const asKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', asKeys.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asKeys.privateKey, 256));

  // IKM = HKDF(auth_secret, ecdh_secret, "WebPush: info\0" || ua_public || as_public, 32)
  const prkKey = await hmac(authSecret, ecdhSecret);
  const keyInfo = concat(enc.encode('WebPush: info\0'), uaPublic, asPublic, new Uint8Array([1]));
  const ikm = (await hmac(prkKey, keyInfo)).slice(0, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(enc.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);

  const key = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  // Délimiteur 0x02 : dernier (et seul) enregistrement.
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(plaintext, new Uint8Array([2]))));

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}

export interface SendResult { ok: boolean; status: number; gone: boolean; text?: string }

/** Envoie une notification. `gone` = abonnement expiré (404/410) : à supprimer. */
export async function sendPush(
  sub: PushSubscriptionKeys,
  payload: unknown,
  keys: VapidKeys,
  opts: { subject: string; ttl?: number; urgency?: 'very-low' | 'low' | 'normal' | 'high'; topic?: string } ,
): Promise<SendResult> {
  const body = await encryptPayload(sub, enc.encode(JSON.stringify(payload)));
  const headers: Record<string, string> = {
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    TTL: String(opts.ttl ?? 86400),
    Urgency: opts.urgency ?? 'high',
    Authorization: await vapidAuthorization(sub.endpoint, keys, opts.subject),
  };
  // Topic : une notif plus récente du même sujet remplace celle en attente (≤ 32 car. base64url).
  if (opts.topic) headers.Topic = opts.topic.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);
  const res = await fetch(sub.endpoint, { method: 'POST', headers, body });
  const text = res.ok ? undefined : (await res.text().catch(() => '')).slice(0, 300);
  return { ok: res.ok, status: res.status, gone: res.status === 404 || res.status === 410, text };
}
