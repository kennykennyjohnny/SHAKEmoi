// Suivi automatique des erreurs (P16), avec Sentry (offre gratuite).
// - Ne fait RIEN tant que VITE_SENTRY_DSN n'est pas configuré (l'appli marche pareil).
// - Chargé à part, après l'affichage : n'alourdit pas le premier écran.
// - Vie privée (RGPD) : seulement l'id de la personne, jamais l'email, le
//   contenu des messages ni les photos ; pas d'enregistrement vidéo des
//   sessions ; les textes saisis ne sont jamais envoyés.
type SentryLike = typeof import('@sentry/react');

let sentry: SentryLike | null = null;
let userId: string | null = null;
const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

export const sentryEnabled = !!DSN;

// Ce qui ne doit jamais partir : emails, jetons, contenu saisi.
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const TOKEN = /(eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}|access_token=[^&\s]+|apikey=[^&\s]+)/g;
const scrub = (s?: string) => (s ? s.replace(EMAIL, '[email]').replace(TOKEN, '[jeton]') : s);

export async function initSentry() {
  if (!DSN || sentry) return;
  try {
    const S = await import('@sentry/react');
    S.init({
      dsn: DSN,
      release: __APP_VERSION__,
      environment: import.meta.env.PROD ? 'production' : 'dev',
      sendDefaultPii: false,
      // Pas de traces de performance ni d'enregistrement de session (vidéo).
      tracesSampleRate: 0,
      integrations: (defaults) => defaults
        .filter((i) => i.name !== 'Breadcrumbs')
        // Fil d'Ariane sans la console (elle peut contenir des messages) ni le
        // texte des éléments touchés.
        .concat(S.breadcrumbsIntegration({ console: false, dom: { serializeAttribute: ['aria-label', 'data-testid'] } })),
      beforeBreadcrumb(b) {
        if (b.category === 'ui.input') return null;
        if (b.data?.url) b.data.url = scrub(String(b.data.url).split('?')[0]);
        return b;
      },
      beforeSend(event) {
        event.user = userId ? { id: userId } : undefined;
        if (event.request) {
          delete event.request.cookies;
          delete event.request.data;
          if (event.request.url) event.request.url = scrub(event.request.url.split('?')[0]);
          delete event.request.query_string;
        }
        event.message = scrub(event.message);
        event.exception?.values?.forEach((v) => { v.value = scrub(v.value); });
        return event;
      },
    });
    if (userId) S.setUser({ id: userId });
    sentry = S;
  } catch {
    /* Sentry indisponible : l'appli continue */
  }
}

/** Seul l'identifiant (jamais l'email ni le pseudo). */
export function setSentryUser(id: string | null) {
  userId = id;
  sentry?.setUser(id ? { id } : null);
}

/** Erreur importante attrapée à la main (envoi raté, requête refusée…). */
export function reportError(err: unknown, where: string) {
  if (!sentry) return;
  sentry.withScope((scope) => {
    scope.setTag('where', where);
    sentry!.captureException(err instanceof Error ? err : new Error(scrub(String((err as any)?.message || err)) || 'Erreur'));
  });
}

/** Erreur de test (page admin) : pour vérifier que tout arrive dans Sentry. */
export function sendTestError(): boolean {
  if (!sentry) return false;
  sentry.captureException(new Error(`Erreur de test SHAKEmoi (${new Date().toISOString()})`));
  return true;
}
