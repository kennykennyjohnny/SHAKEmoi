import { useState } from 'react';
import { Music2, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Logo } from './Logo';

interface OnboardingDialogProps {
  onComplete: (preferences: { musicService: 'spotify' | 'apple' }) => void;
}

export function OnboardingDialog({ onComplete }: OnboardingDialogProps) {
  const [step, setStep] = useState<'welcome' | 'service'>('welcome');
  const [selectedService, setSelectedService] = useState<'spotify' | 'apple'>('spotify');

  const handleContinue = () => {
    if (step === 'welcome') {
      setStep('service');
    } else {
      onComplete({ musicService: selectedService });
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <AnimatePresence mode="wait">
          {step === 'welcome' ? (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring' }}
                className="mb-6 flex justify-center"
              >
                <Logo size="lg" animated={true} />
              </motion.div>

              <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
                Bienvenue sur Shakemoi
              </h1>
              
              <p className="text-gray-400 text-lg mb-8">
                Le réseau social musical que tu ouvres <span className="text-purple-400 font-semibold">avant</span> Spotify
              </p>

              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-3 text-left">
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-purple-400 font-bold">1</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">Shake tes sons préférés</h3>
                    <p className="text-sm text-gray-400">Partage ce que tu écoutes avec tes amis</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 text-left">
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-purple-400 font-bold">2</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">Découvre en temps réel</h3>
                    <p className="text-sm text-gray-400">Vois ce que tes amis shakent maintenant</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 text-left">
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-purple-400 font-bold">3</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">Écoute et reshake</h3>
                    <p className="text-sm text-gray-400">Previews 30s ou écoute complète sur ton app</p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleContinue}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                C'est parti !
                <ChevronRight className="w-5 h-5" />
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="service"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center"
            >
              <h2 className="text-2xl font-bold mb-2 text-white">Choisis ton service musical</h2>
              <p className="text-gray-400 mb-6">
                Tu pourras écouter les previews et ouvrir les sons dans ton app préférée
              </p>

              <div className="space-y-3 mb-8">
                <button
                  onClick={() => setSelectedService('spotify')}
                  className={`w-full p-4 rounded-xl border-2 transition-all ${
                    selectedService === 'spotify'
                      ? 'border-green-500 bg-green-500/10'
                      : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-black" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                      </svg>
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="font-bold text-white text-lg">Spotify</h3>
                      <p className="text-sm text-gray-400">Le plus populaire - 500M+ utilisateurs</p>
                    </div>
                    {selectedService === 'spotify' && (
                      <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                </button>

                <button
                  onClick={() => setSelectedService('apple')}
                  className={`w-full p-4 rounded-xl border-2 transition-all ${
                    selectedService === 'apple'
                      ? 'border-pink-500 bg-pink-500/10'
                      : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-pink-500 to-red-500 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M23.994 6.124a9.23 9.23 0 0 0-.24-2.132c-.317-1.394-1.062-2.573-2.17-3.547C20.618-.39 19.165-.657 17.6.48c-1.314.95-2.117 2.254-2.471 3.854-.16.73-.24 1.476-.24 2.232h-.007c-.02.143-.04.287-.056.43-.02.196-.04.394-.057.59-.017.2-.034.398-.05.6-.02.19-.034.38-.05.57l-.014.18c-.02.244-.037.488-.054.73-.02.283-.04.57-.056.854-.02.308-.036.617-.05.926-.014.3-.03.6-.047.897l-.053 1.05c-.02.386-.04.773-.06 1.16-.02.345-.034.693-.05 1.04-.02.42-.047.84-.07 1.26l-.014.18c-.02.374-.037.748-.056 1.122-.02.42-.044.84-.07 1.26-.02.346-.036.692-.053 1.038-.02.364-.034.728-.05 1.092l-.043.92c-.02.403-.04.806-.06 1.21-.02.407-.04.81-.06 1.214l-.06 1.194-.06 1.21-.06 1.185c-.016.404-.03.808-.05 1.21l-.043.93c-.02.42-.04.84-.06 1.26-.02.362-.03.725-.05 1.087l-.047.93-.044.903c-.02.42-.037.842-.056 1.262-.016.346-.03.69-.046.933 0 .017 0 .03-.002.047l-.047.93c-.02.42-.04.84-.06 1.26-.02.362-.03.725-.05 1.087l-.047.93-.044.903c-.02.42-.037.842-.056 1.262-.016.346-.03.69-.046.933v.047l-.047.93c-.02.42-.04.84-.06 1.26-.02.362-.03.725-.05 1.087l-.047.93-.044.903c-.02.42-.037.842-.056 1.262-.016.346-.03.69-.046.933v.03h6.14c.02-.335.037-.67.053-1.003.02-.346.034-.693.05-1.04.02-.362.034-.724.05-1.086.02-.42.04-.84.06-1.26.02-.346.036-.693.053-1.04.02-.362.036-.724.053-1.086.02-.42.04-.84.06-1.26.02-.346.036-.692.053-1.038.02-.363.036-.724.053-1.087.02-.42.04-.84.06-1.26.02-.346.036-.692.053-1.038.02-.364.036-.724.053-1.087.02-.42.04-.84.06-1.26.02-.346.036-.692.053-1.038.02-.364.036-.724.053-1.087.02-.42.04-.84.06-1.26.02-.346.036-.692.053-1.038.02-.364.036-.724.053-1.087.02-.42.04-.84.06-1.26.02-.346.036-.692.053-1.038.02-.364.036-.724.053-1.087.02-.42.04-.84.06-1.26.02-.346.036-.692.053-1.038.02-.364.036-.725.053-1.087.02-.42.04-.84.06-1.26.02-.346.036-.692.053-1.038.02-.364.036-.724.053-1.087.02-.42.04-.84.06-1.26.02-.346.036-.692.053-1.038.02-.364.036-.724.053-1.087.02-.42.04-.84.06-1.26.02-.33.036-.66.053-.99.02-.363.036-.724.053-1.087.02-.42.04-.84.06-1.26.02-.346.036-.692.053-1.038.02-.364.036-.724.053-1.087.02-.42.04-.84.06-1.26.02-.346.036-.692.053-1.038.02-.364.036-.724.053-1.087.02-.42.04-.84.06-1.26.02-.346.036-.692.053-1.038.02-.364.036-.724.053-1.087.02-.42.04-.84.06-1.26.02-.346.036-.692.053-1.038.02-.364.036-.724.053-1.087.02-.42.04-.84.06-1.26.02-.346.036-.692.053-1.038.02-.364.036-.724.053-1.087.02-.42.04-.84.06-1.26.02-.33.036-.66.053-.99.02-.363.036-.724.053-1.087.02-.42.04-.84.06-1.26.02-.346.036-.692.053-1.038.02-.364.036-.724.053-1.087.02-.42.04-.84.06-1.26.02-.346.036-.692.053-1.038.02-.364.036-.724.053-1.087.02-.42.04-.84.06-1.26.02-.346.036-.692.053-1.038.02-.364.036-.724.053-1.087.02-.42.04-.84.06-1.26.02-.346.036-.692.053-1.038.02-.364.036-.724.053-1.087.02-.42.04-.84.06-1.26.02-.346.036-.692.053-1.038.02-.364.036-.724.053-1.087.02-.42.04-.84.06-1.26.02-.346.036-.692.053-1.038.02-.364.036-.724.053-1.087.02-.42.04-.84.06-1.26z"/>
                      </svg>
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="font-bold text-white text-lg">Apple Music</h3>
                      <p className="text-sm text-gray-400">Parfait pour les utilisateurs Apple</p>
                    </div>
                    {selectedService === 'apple' && (
                      <div className="w-6 h-6 bg-pink-500 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                </button>
              </div>

              <p className="text-xs text-gray-500 mb-4">
                Tu pourras changer ce paramètre à tout moment dans ton profil
              </p>

              <button
                onClick={handleContinue}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                Continuer
                <ChevronRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
