// Messages d'erreur lisibles, en français (I7, G5). Les erreurs techniques
// (anglais, codes) restent dans la console pour le débogage.

export function friendlyError(err: any, fallback = 'Oups, ça n\'a pas marché. Réessaie.'): string {
  const msg = String(err?.message || err?.error_description || err || '').toLowerCase();
  const code = String(err?.code || err?.name || '');

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'Pas de connexion internet. Vérifie ton réseau et réessaie.';
  }
  if (code === 'TimeoutError' || code === 'AbortError' || msg.includes('timeout') || msg.includes('timed out') || msg.includes('aborted')) {
    return 'Le réseau est trop lent en ce moment. Réessaie dans un instant.';
  }
  if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('load failed')) {
    return 'Connexion impossible. Vérifie ton réseau et réessaie.';
  }

  // Connexion / inscription (Supabase Auth)
  if (msg.includes('invalid login credentials')) return 'Email ou mot de passe incorrect.';
  if (msg.includes('email not confirmed')) return 'Confirme d\'abord ton email : regarde dans ta boîte de réception (et les spams).';
  if (msg.includes('user already registered') || msg.includes('already been registered')) return 'Un compte existe déjà avec cet email. Connecte-toi.';
  if (msg.includes('password should be at least') || msg.includes('weak password')) return 'Mot de passe trop court : 6 caractères minimum.';
  if (msg.includes('unable to validate email') || msg.includes('invalid email') || msg.includes('email address') && msg.includes('invalid')) return 'Adresse email invalide.';
  if (msg.includes('rate limit') || msg.includes('too many requests') || code === '429') return 'Trop d\'essais d\'affilée. Patiente une minute et réessaie.';
  if (msg.includes('same_password') || msg.includes('different from the old password')) return 'Choisis un mot de passe différent de l\'ancien.';
  if (msg.includes('jwt') || msg.includes('not authenticated') || msg.includes('session')) return 'Ta session a expiré. Reconnecte-toi.';
  if (code === '23505' || msg.includes('duplicate key')) return 'Ça existe déjà.';

  // Message déjà en français écrit par nous : on le garde.
  if (/[éèàçù]|^(ce|cette|ton|ta|tu|impossible|erreur|le |la |les )/i.test(String(err?.message || ''))) {
    return String(err.message);
  }
  return fallback;
}

/** Rejette une promesse trop lente (réseau 4G capricieux). */
export function withTimeout<T>(p: Promise<T>, ms = 15000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(Object.assign(new Error('timeout'), { name: 'TimeoutError' })), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}
