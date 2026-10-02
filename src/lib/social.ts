// Découverte de personnes : suggestions (P18), compatibilité (P25), invitations (P19).
import { supabase } from './supabase';

export type SuggestionMode = 'mixed' | 'taste' | 'popular';

export async function getSuggestions(mode: SuggestionMode = 'mixed', limit = 12): Promise<any[]> {
  const { data, error } = await supabase.rpc('get_suggestions', { p_mode: mode, p_limit: limit });
  if (error) throw error;
  return data || [];
}

export async function dismissSuggestion(userId: string) {
  const { data } = await supabase.auth.getSession();
  const me = data.session?.user.id;
  if (!me) return;
  await supabase.from('suggestion_dismissals').upsert({ user_id: me, dismissed_id: userId });
}

/** Raison affichée sur une carte : « 3 amis en commun » ou « 87 % compatibles · Rap, Afro ». */
export function suggestionReason(s: any): string {
  const fams = Array.isArray(s.taste_families) ? s.taste_families.slice(0, 2).join(', ') : '';
  const arts = Array.isArray(s.taste_artists) ? s.taste_artists.slice(0, 1).join('') : '';
  if (s.mutual > 0 && !(s.taste >= 75)) return `${s.mutual} ami${s.mutual > 1 ? 's' : ''} en commun`;
  if (s.taste) {
    const extra = [fams, arts && `${arts} en commun`].filter(Boolean).join(' · ');
    return `${s.taste} % compatibles${extra ? ` · ${extra}` : ''}`;
  }
  if (s.circles > 0) return `${s.circles} cercle${s.circles > 1 ? 's' : ''} en commun`;
  return 'Actif sur SHAKEmoi';
}

export interface Taste {
  status: 'ok' | 'not_enough';
  score?: number;
  families?: string[];
  artists?: string[];
  close?: [string, string][];
  mine?: number;
  theirs?: number;
}

export async function getTaste(userId: string): Promise<Taste | null> {
  const { data, error } = await supabase.rpc('get_taste', { p_other: userId });
  if (error || !data) return null;
  return data as Taste;
}

/** Explication du score : « Vous partagez : Rap FR, Afro · 3 artistes en commun (Tiakola, SDM…) ». */
export function tasteExplanation(t: Taste): string {
  const parts: string[] = [];
  if (t.families?.length) parts.push(`Vous partagez : ${t.families.slice(0, 2).join(', ')}`);
  if (t.artists?.length) parts.push(`${t.artists.length} artiste${t.artists.length > 1 ? 's' : ''} en commun (${t.artists.slice(0, 3).join(', ')})`);
  else if (t.close?.length) parts.push(`artistes proches : ${t.close.slice(0, 2).map(([a, b]) => `${a} ↔ ${b}`).join(', ')}`);
  return parts.join(' · ');
}

/** Arrivée par un lien d'invitation : abonnement mutuel + notif à l'inviteur. */
export async function acceptInvite(inviter: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('accept_invite', { p_inviter: inviter });
  if (error) return null;
  return (data as string) || null;
}

export async function getInviteCard(username: string): Promise<any | null> {
  const { data } = await supabase.rpc('get_invite_card', { p_username: username });
  return data || null;
}

// Récap de la semaine qui vient de se terminer (P20).
export interface WeeklyRecap {
  week: number;
  start: string;
  end: string;
  shakes: number;
  likes: number;
  streak: number;
  genre: string | null;
  match: { id: string; username: string; avatar: string | null; score: number } | null;
  top: { id: string; title: string; artist: string; cover: string | null; preview_url: string | null; track_id: string | null; spotify_url: string | null; likes: number }[];
}

export async function getWeeklyRecap(): Promise<WeeklyRecap | null> {
  const { data, error } = await supabase.rpc('get_weekly_recap');
  if (error) throw error;
  return (data as WeeklyRecap) || null;
}
