// Onglet « Découvrir » du Classement (Q4). Le moteur de recommandation (Q8)
// arrive au lot suivant ; en attendant, l'onglet existe déjà à sa place.
import { Sparkles } from 'lucide-react';

export function DiscoverPanel(_: { visible: boolean; currentUser: any; onRefreshFeed?: () => void }) {
  return (
    <div className="text-center py-16 px-6">
      <Sparkles className="w-10 h-10 text-pink-300 mx-auto mb-3" />
      <p className="font-bold text-white">Des sons choisis pour toi</p>
      <p className="text-sm text-purple-200 mt-1">Bientôt ici : une sélection d'après tes Shakes, tes likes et les goûts de tes potes.</p>
    </div>
  );
}
