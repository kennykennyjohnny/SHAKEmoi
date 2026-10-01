// Test local du chiffrement Web Push (P7) : node scripts/test-webpush.ts
import { generateVapidKeys, encryptPayload, vapidAuthorization, b64urlEncode, b64urlDecode } from '../supabase/functions/push/webpush.ts';
const enc = new TextEncoder();
async function hmac(key: Uint8Array, data: Uint8Array) { const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return new Uint8Array(await crypto.subtle.sign('HMAC', k, data)); }
const cat = (...p: Uint8Array[]) => { const o = new Uint8Array(p.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of p) { o.set(x, i); i += x.length; } return o; };
const ua = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
const uaPub = new Uint8Array(await crypto.subtle.exportKey('raw', ua.publicKey));
const auth = crypto.getRandomValues(new Uint8Array(16));
const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', p256dh: b64urlEncode(uaPub), auth: b64urlEncode(auth) };
const msg = JSON.stringify({ title: 'SHAKEmoi', body: '@léa a aimé ton shake 🎵' });
const body = await encryptPayload(sub, enc.encode(msg));
// Déchiffrement côté « téléphone »
const salt = body.slice(0, 16); const idlen = body[20]; const asPub = body.slice(21, 21 + idlen); const ct = body.slice(21 + idlen);
const asKey = await crypto.subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, ua.privateKey, 256));
const prkKey = await hmac(auth, ecdh);
const ikm = (await hmac(prkKey, cat(enc.encode('WebPush: info\0'), uaPub, asPub, new Uint8Array([1])))).slice(0, 32);
const prk = await hmac(salt, ikm);
const cek = (await hmac(prk, cat(enc.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
const nonce = (await hmac(prk, cat(enc.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);
const k = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['decrypt']);
const pt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, k, ct));
const out = new TextDecoder().decode(pt.slice(0, -1));
console.log('decrypt ok:', out === msg, 'delim', pt[pt.length - 1]);
// VAPID
const keys = await generateVapidKeys();
const h = await vapidAuthorization(sub.endpoint, keys, 'mailto:contact@shakemoi.fr');
const t = h.match(/t=([^,]+)/)![1]; const [a, b, s] = t.split('.');
const pub = await crypto.subtle.importKey('raw', b64urlDecode(keys.publicKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, b64urlDecode(s), enc.encode(`${a}.${b}`));
console.log('jwt verify:', ok, JSON.parse(new TextDecoder().decode(b64urlDecode(b))), 'pubkey len', b64urlDecode(keys.publicKey).length);
// Vraie requête vers FCM avec un faux abonnement : on attend 404/400 (pas d'erreur de chiffrement)
const { sendPush } = await import('../supabase/functions/push/webpush.ts');
const r = await sendPush(sub, { title: 'x' }, keys, { subject: 'mailto:contact@shakemoi.fr' });
console.log('fcm', r.status, r.gone, r.text?.slice(0, 120));
