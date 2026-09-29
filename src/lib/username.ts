// Règle des pseudos (G2, G3) : 3 à 20 caractères, a-z 0-9 . _ - uniquement,
// en minuscules. Les liens de profil /u/<pseudo> n'acceptent que ça.
// La même règle est vérifiée en base (contrainte + unicité sans casse).
import { supabase } from './supabase';

export const USERNAME_RULE = /^[a-z0-9._-]{3,20}$/;

/** Minuscules, sans espaces ni accents (é → e). */
export function normalizeUsername(input: string): string {
  return input
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/^@/, '');
}

/** Message d'erreur en français, ou null si le pseudo est valide. */
export function usernameError(username: string): string | null {
  if (username.length < 3) return 'Ton pseudo doit faire au moins 3 caractères.';
  if (username.length > 20) return 'Ton pseudo doit faire 20 caractères maximum.';
  if (!USERNAME_RULE.test(username)) return 'Pseudo : lettres, chiffres, point, tiret et tiret bas uniquement.';
  return null;
}

/** Vrai si le pseudo est déjà pris par quelqu'un d'autre (sans distinction de casse). */
export async function isUsernameTaken(username: string, exceptUserId?: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('users_profile')
    .select('id')
    .ilike('username', username.replace(/[\\%_]/g, (c) => `\\${c}`))
    .limit(2);
  if (error) return false;
  return (data || []).some((r: any) => r.id !== exceptUserId);
}
