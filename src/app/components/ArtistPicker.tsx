// Q9 : « Choisis au moins 3 artistes que tu aimes » (tuto, après le choix de
// l'appli d'écoute, avant « Suis au moins 3 personnes »), et « Mes artistes
// préférés » dans les Paramètres. Grandes photos rondes (comme Spotify / Apple
// Music), recherche, familles en petites puces ; choisir un artiste fait
// apparaître 3-4 artistes proches juste à côté. Les choix nourrissent le profil
// de goût (Découvrir, compatibilité, suggestions) : voir docs/reco.md.
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Check, Loader2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useBackHandler } from '../../lib/navigation';
import { tween } from '../../lib/motion';

export interface PickedArtist { id: string; name: string; picture: string | null }

const CHIPS: { key: string; label: string }[] = [
  { key: 'mix', label: 'Pour toi' }, { key: 'Rap', label: 'Rap FR' }, { key: 'Afro', label: 'Afro' }, { key: 'Latin', label: 'Latin' },
  { key: 'R&B', label: 'R&B' }, { key: 'Pop', label: 'Pop' }, { key: 'Électro', label: 'Électro' }, { key: 'Rock', label: 'Rock' },
];
const cache = new Map<string, PickedArtist[]>();
async function fetchArtists(params: string): Promise<PickedArtist[]> {
  if (cache.has(params)) return cache.get(params)!;
  const r = await fetch(`/api/artists?${params}`).then((x) => (x.ok ? x.json() : { artists: [] })).catch(() => ({ artists: [] }));
  const list = (r.artists || []) as PickedArtist[];
  if (list.length) cache.set(params, list);
  return list;
}

export function ArtistPicker({ mode = 'onboarding', onDone }: { mode?: 'onboarding' | 'settings'; onDone: () => void }) {
  useBackHandler(true, onDone);
  const [chip, setChip] = useState('mix');
  const [query, setQuery] = useState('');
  const [grid, setGrid] = useState<PickedArtist[] | null>(null);
  const [picked, setPicked] = useState<PickedArtist[]>([]);
  const [related, setRelated] = useState<Record<string, PickedArtist[]>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const min = mode === 'onboarding' ? 3 : 0;
  const pickedIds = new Set(picked.map((a) => a.id));

  // Mes choix actuels (Paramètres, ou « Revoir le tuto »).
  useEffect(() => {
    supabase.from('artist_picks').select('name, deezer_id, picture_url').order('created_at')
      .then(({ data }) => { if (data?.length) setPicked(data.map((d: any) => ({ id: d.deezer_id || d.name, name: d.name, picture: d.picture_url }))); }, () => {});
  }, []);

  // Grille : recherche (après une petite pause) ou famille.
  const reqRef = useRef(0);
  useEffect(() => {
    const req = ++reqRef.current;
    const q = query.trim();
    const run = () => fetchArtists(q ? `q=${encodeURIComponent(q)}` : `family=${encodeURIComponent(chip)}`)
      .then((list) => { if (req === reqRef.current) setGrid(list); });
    if (!q) { setGrid(cache.get(`family=${encodeURIComponent(chip)}`) || null); run(); return; }
    const t = setTimeout(run, 300);
    return () => clearTimeout(t);
  }, [chip, query]);

  const toggle = (a: PickedArtist) => {
    if (pickedIds.has(a.id)) { setPicked((p) => p.filter((x) => x.id !== a.id)); return; }
    setPicked((p) => [...p, a]);
    navigator.vibrate?.(8);
    // Artistes proches, juste à côté (comme Spotify).
    if (!related[a.id] && /^\d+$/.test(a.id)) fetchArtists(`related=${a.id}`).then((list) => setRelated((r) => ({ ...r, [a.id]: list.slice(0, 4) })));
  };

  // La grille avec les proches insérés après chaque artiste choisi (sans doublon).
  const shown: (PickedArtist & { near?: boolean })[] = [];
  const seen = new Set<string>();
  const keyOf = (a: PickedArtist) => a.name.trim().toLowerCase();
  const add = (a: PickedArtist, near = false) => {
    if (seen.has(a.id) || seen.has(keyOf(a))) return;
    seen.add(a.id); seen.add(keyOf(a));
    shown.push(near ? { ...a, near } : a);
  };
  for (const a of grid || []) {
    add(a);
    for (const r of related[a.id] || []) add(r, true);
  }
  // Mes choix qui ne sont pas dans la grille actuelle restent visibles en tête.
  const extra = picked.filter((a) => !seen.has(a.id) && !seen.has(keyOf(a)));

  const save = async () => {
    setSaving(true);
    setError(null);
    const { error: e } = await supabase.rpc('save_artist_picks', { p_picks: picked.map((a) => ({ id: /^\d+$/.test(a.id) ? a.id : '', name: a.name, picture: a.picture })) });
    setSaving(false);
    if (e) { setError('Tes artistes n’ont pas pu être enregistrés. Réessaie.'); return; }
    onDone();
  };

  const left = Math.max(0, min - picked.length);
  // Fonction (pas un composant) : sinon chaque rendu recréerait les tuiles.
  const tile = (a: PickedArtist & { near?: boolean }) => {
    const on = pickedIds.has(a.id);
    return (
      <motion.button key={a.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={tween()}
        onClick={() => toggle(a)} aria-pressed={on} aria-label={a.name}
        className="flex flex-col items-center gap-1.5 min-w-0">
        <span className={`relative w-[5.5rem] h-[5.5rem] rounded-full overflow-hidden transition-shadow ${on ? 'ring-4 ring-purple-500 shadow-lg shadow-purple-900/60' : a.near ? 'ring-2 ring-pink-400/50' : 'ring-1 ring-white/10'}`}>
          {a.picture ? <img src={a.picture} alt="" loading="lazy" className="w-full h-full object-cover" /> : <span className="w-full h-full bg-violet-900/60 flex items-center justify-center text-2xl font-bold">{a.name[0]}</span>}
          {on && (
            <span className="absolute inset-0 bg-purple-700/45 flex items-center justify-center">
              <span className="w-8 h-8 rounded-full bg-purple-500 border-2 border-white flex items-center justify-center"><Check className="w-5 h-5 text-white" strokeWidth={3} /></span>
            </span>
          )}
        </span>
        <span className={`text-xs font-semibold text-center leading-tight line-clamp-2 ${on ? 'text-white' : 'text-purple-100'}`}>{a.name}</span>
      </motion.button>
    );
  };

  return (
    <div className="fixed inset-0 z-[85] bg-[#1E1440] text-white flex flex-col">
      <div className="px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2 flex-shrink-0">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h2 className="text-xl font-extrabold leading-tight">{mode === 'onboarding' ? 'Choisis au moins 3 artistes que tu aimes' : 'Mes artistes préférés'}</h2>
            <p className="text-sm text-purple-200 mt-1">On s'en sert pour te proposer des sons qui te ressemblent 🎧</p>
          </div>
          {mode === 'settings' && <button aria-label="Fermer" onClick={onDone} className="p-2 rounded-full hover:bg-white/10"><X className="w-5 h-5" /></button>}
        </div>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Chercher un artiste…"
            className="w-full pl-9 pr-3 py-2.5 rounded-full bg-violet-950/50 border border-purple-500/30 text-white placeholder-purple-300/70 focus:outline-none focus:border-pink-400" />
        </div>
        {!query && (
          <div className="flex gap-2 overflow-x-auto mt-3 -mx-4 px-4 pb-1" style={{ scrollbarWidth: 'none' }}>
            {CHIPS.map((c) => (
              <button key={c.key} onClick={() => setChip(c.key)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${chip === c.key ? 'bg-white text-[#1E1440] border-white' : 'bg-violet-950/40 text-purple-100 border-purple-500/30'}`}>
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {grid === null ? (
          <div className="grid grid-cols-3 gap-x-3 gap-y-4 pt-2">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5"><span className="w-[5.5rem] h-[5.5rem] rounded-full bg-purple-300/10 animate-pulse" /><span className="h-3 w-14 rounded bg-purple-300/10 animate-pulse" /></div>
            ))}
          </div>
        ) : (
          <motion.div layout className="grid grid-cols-3 gap-x-3 gap-y-4 pt-2">
            <AnimatePresence initial={false}>
              {[...extra, ...shown].map((a) => tile(a))}
            </AnimatePresence>
          </motion.div>
        )}
        {grid && grid.length === 0 && <p className="text-center text-sm text-purple-200 py-8">{query ? 'Aucun artiste trouvé.' : 'Les artistes n’ont pas pu se charger. Vérifie ta connexion.'}</p>}
      </div>

      <div className="flex-shrink-0 border-t border-purple-500/25 bg-[#1D0F3D] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {error && <p className="text-xs text-pink-200 mb-2 text-center">{error}</p>}
        <div className="flex items-center gap-3">
          {mode === 'onboarding' && <button onClick={onDone} className="px-4 py-3 text-sm font-semibold text-purple-200">Passer</button>}
          <button onClick={save} disabled={left > 0 || saving}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 font-bold disabled:opacity-40 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : left > 0 ? `Encore ${left}` : mode === 'onboarding' ? `Continuer · ${picked.length}` : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
