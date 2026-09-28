import { ArrowLeft } from 'lucide-react';
import { Logo } from './Logo';

// SHAKEMOI - Politique de confidentialité (/confidentialite).
// Exigée pour installer / publier l'app (Google Play, stores) et par le RGPD.
// À tenir à jour si de nouvelles données ou de nouveaux services apparaissent.

export const PRIVACY_CONTACT = 'contact@shakemoi.fr';
const UPDATED = '29 septembre 2026';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="text-base font-bold text-white mb-2">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-purple-100/80">{children}</div>
    </section>
  );
}

export function PrivacyPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-[100dvh] bg-[#1E1440] text-white overflow-y-auto">
      <header className="sticky top-0 z-10 bg-[#1E1440]/90 backdrop-blur border-b border-purple-500/15">
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-white/10" aria-label="Retour">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Logo size="sm" animated={false} showText={true} />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 pb-[max(3rem,env(safe-area-inset-bottom))]">
        <h1 className="text-2xl font-bold mt-6">Politique de confidentialité</h1>
        <p className="text-xs text-purple-300/60 mt-1">Dernière mise à jour : {UPDATED}</p>

        <Section title="En bref">
          <p>
            SHAKEmoi sert à partager des sons avec ses amis. On collecte le strict nécessaire pour faire
            tourner l'app, on ne vend aucune donnée, et il n'y a ni publicité ni pisteur publicitaire.
          </p>
        </Section>

        <Section title="Ce que nous collectons">
          <ul className="list-disc pl-5 space-y-1.5">
            <li><b>Compte</b> : adresse email et mot de passe (chiffré), pseudo, nom affiché, photo de profil, bio.</li>
            <li><b>Ce que tu publies</b> : shakes, stories (photos comprises), commentaires, réactions, messages privés et messages de cercles.</li>
            <li><b>Ton activité sociale</b> : abonnements, likes, vues de stories, cercles rejoints.</li>
            <li><b>Préférences</b> : plateforme d'écoute préférée, réglages de notifications.</li>
            <li><b>Liens partagés</b> : quand tu partages un son, on enregistre le son et le nombre d'ouvertures du lien (sans identifier qui l'ouvre).</li>
          </ul>
          <p>Sans compte, tu peux chercher et partager des sons : on n'enregistre alors aucune donnée personnelle.</p>
        </Section>

        <Section title="Pourquoi">
          <p>
            Uniquement pour faire fonctionner le service : afficher ton profil et tes publications à tes amis,
            acheminer tes messages, t'envoyer des notifications que tu as activées, et ouvrir les sons sur ta
            plateforme préférée. Base légale : l'exécution du service que tu demandes en créant ton compte.
          </p>
        </Section>

        <Section title="Qui y a accès">
          <p>Tes publications sont visibles par tes abonnés ; tes messages privés, seulement par leurs destinataires.
            Ton adresse email n'est jamais affichée aux autres membres.</p>
          <p>Nos prestataires techniques, uniquement pour héberger et faire tourner l'app :</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><b>Supabase</b> : base de données, comptes et fichiers, hébergés dans l'Union européenne (Irlande).</li>
            <li><b>Vercel</b> : hébergement du site.</li>
            <li><b>Spotify, Apple (iTunes), Deezer</b> : recherche de sons, pochettes, extraits et liens d'écoute. Ils ne reçoivent que le titre et l'artiste recherchés, jamais ton identité.</li>
          </ul>
        </Section>

        <Section title="Stockage sur ton appareil">
          <p>
            L'app garde sur ton téléphone ta session de connexion et quelques préférences (plateforme d'écoute,
            son des stories). Pas de cookie publicitaire ni de mesure d'audience tierce.
          </p>
        </Section>

        <Section title="Combien de temps">
          <p>
            Tant que ton compte existe. Les stories disparaissent du fil à leur expiration mais restent dans tes
            archives (visibles de toi seul) jusqu'à ce que tu les supprimes. Quand tu supprimes ton compte, toutes
            tes données sont effacées immédiatement.
          </p>
        </Section>

        <Section title="Tes droits">
          <p>
            Tu peux consulter, corriger et supprimer tes données à tout moment. Pour supprimer ton compte et tout
            son contenu : <b>Profil → Paramètres → Supprimer mon compte</b>. Pour toute autre demande (copie de tes
            données, question), écris-nous à{' '}
            <a className="text-fuchsia-300 underline" href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a>.
            Tu peux aussi saisir la CNIL (cnil.fr).
          </p>
        </Section>

        <Section title="Mineurs">
          <p>SHAKEmoi s'adresse aux personnes de 15 ans et plus.</p>
        </Section>

        <Section title="Sécurité">
          <p>
            Connexions chiffrées (HTTPS), mots de passe jamais stockés en clair, et accès aux données restreint par
            des règles de sécurité en base : chacun ne peut lire que ce qui lui est destiné.
          </p>
        </Section>
      </main>
    </div>
  );
}
