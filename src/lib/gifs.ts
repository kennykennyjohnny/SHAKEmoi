// Recherche de GIF via notre relais /api/gifs (M5). Tenor a fermé son API :
// le relais parle à KLIPY ou GIPHY selon la clé configurée sur Vercel.
import { PUBLIC_ORIGIN } from './links';

export interface GifResult { id: string; preview: string; url: string }
export interface GifSearch { gifs: GifResult[]; error?: 'not_configured' | 'unavailable' }

export async function searchGifs(query: string): Promise<GifSearch> {
  const q = query.trim();
  // En local (vite), /api n'existe pas : on passe par le site en ligne.
  const base = import.meta.env.DEV ? PUBLIC_ORIGIN : '';
  try {
    const res = await fetch(`${base}/api/gifs${q ? `?q=${encodeURIComponent(q)}` : ''}`, { signal: AbortSignal.timeout(8000) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { gifs: [], error: data?.error === 'not_configured' ? 'not_configured' : 'unavailable' };
    return { gifs: data.gifs || [] };
  } catch {
    return { gifs: [], error: 'unavailable' };
  }
}

export const GIF_ERROR_TEXT: Record<string, string> = {
  not_configured: 'Les GIFs reviennent très bientôt (notre fournisseur a fermé, on branche le nouveau).',
  unavailable: 'Recherche de GIF indisponible pour le moment. Réessaie dans un instant.',
};
