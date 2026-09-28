// SHAKEMOI - Slogans de la marque, partagés par l'app et les aperçus de liens (api/).
// Ils alternent dans l'app ; dans les métadonnées (fixes par nature), le premier
// sert de titre et le second de description.

export const SLOGANS = ['Écoute. Partage. Shake.', 'Partage ce qui te fait vibrer.'] as const;

export const SITE_TITLE = `SHAKEmoi · ${SLOGANS[0]}`;
export const SITE_DESCRIPTION = `${SLOGANS[1]} Tes sons, avec tes amis, quelle que soit leur plateforme.`;
