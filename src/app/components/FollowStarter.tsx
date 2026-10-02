// P29 : plus jamais de fil vide. À la fin du tuto, « Suis au moins 3 personnes »,
// avec les suggestions (amis d'amis, mêmes goûts, comptes populaires), un
// toucher par personne, et Passer. Si on est arrivé par une invitation, la
// personne qui a invité est en premier (déjà suivie).
import { useEffect, useState } from 'react';
import { UserPlus, UserCheck, Loader2 } from 'lucide-react';
import { getSuggestions, suggestionReason } from '../../lib/social';
import { followUser, unfollowUser, getUserProfile } from '../../lib/database';
import { avatarThumb, defaultAvatar } from '../../lib/media';

export function FollowStarter({ inviterId, onDone }: { inviterId?: string | null; onDone: () => void }) {
  const [people, setPeople] = useState<any[] | null>(null);
  const [followed, setFollowed] = useState<Set<string>>(new Set(inviterId ? [inviterId] : []));
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [mixed, taste, popular, inviter] = await Promise.all([
        getSuggestions('mixed', 12).catch(() => []),
        getSuggestions('taste', 6).catch(() => []),
        getSuggestions('popular', 15).catch(() => []),
        inviterId ? getUserProfile(inviterId).catch(() => null) : Promise.resolve(null),
      ]);
      const seen = new Set<string>();
      const list: any[] = [];
      if (inviter) { list.push({ id: inviter.id, username: inviter.username, display_name: inviter.display_name, avatar: inviter.profile_album_cover_url, _inviter: true }); seen.add(inviter.id); }
      for (const s of [...mixed, ...taste, ...popular]) if (!seen.has(s.id)) { seen.add(s.id); list.push(s); }
      setPeople(list.slice(0, 18));
    })();
  }, [inviterId]);

  const toggle = async (p: any) => {
    if (busy) return;
    setBusy(p.id);
    const on = followed.has(p.id);
    const r = on ? await unfollowUser(p.id) : await followUser(p.id);
    setBusy(null);
    if (r.success) setFollowed((f) => { const n = new Set(f); if (on) n.delete(p.id); else n.add(p.id); return n; });
  };
  const count = followed.size;

  return (
    <div className="fixed inset-0 z-[60] bg-[#1E1440] text-white flex flex-col">
      <div className="px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-3 text-center">
        <img src="/shakemoi-logo.png" alt="SHAKEmoi" className="h-6 object-contain mx-auto mb-4" />
        <h1 className="text-2xl font-black">Suis au moins 3 personnes</h1>
        <p className="text-sm text-purple-200/80 mt-1">Ton fil se remplit de leurs sons. Tu pourras en suivre d'autres plus tard.</p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4 max-w-md w-full mx-auto">
        {people === null ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-purple-400" /></div>
        ) : people.map((p) => {
          const on = followed.has(p.id);
          return (
            <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-violet-950/40">
              <img src={avatarThumb(p.avatar, 128) || defaultAvatar(p.username)} alt="" className="w-12 h-12 rounded-full object-cover" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{p.display_name || p.username}</p>
                <p className="text-xs text-purple-300/90 truncate">{p._inviter ? 'T’a invité·e sur SHAKEmoi' : p.mutual || p.taste || p.circles ? suggestionReason(p) : `@${p.username}`}</p>
              </div>
              <button onClick={() => toggle(p)} disabled={busy === p.id}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1 ${on ? 'bg-purple-900/60 text-purple-100' : 'bg-gradient-to-r from-purple-600 to-pink-600'}`}>
                {busy === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : on ? <><UserCheck className="w-3.5 h-3.5" /> Suivi</> : <><UserPlus className="w-3.5 h-3.5" /> Suivre</>}
              </button>
            </div>
          );
        })}
      </div>
      <div className="px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-purple-800/30 max-w-md w-full mx-auto flex gap-3">
        <button onClick={onDone} className="px-4 py-3 rounded-xl text-sm text-purple-200/80">Passer</button>
        <button onClick={onDone} disabled={count < 3} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 font-semibold disabled:opacity-40">
          {count < 3 ? `Encore ${3 - count}` : 'C’est parti 🎧'}
        </button>
      </div>
    </div>
  );
}
