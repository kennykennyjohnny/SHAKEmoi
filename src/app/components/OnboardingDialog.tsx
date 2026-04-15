import { useState } from 'react';
import { ChevronRight, Music, Users, Repeat2, Zap, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface OnboardingDialogProps {
  onComplete: (preferences: { musicService: 'spotify' | 'apple' }) => void;
}

export function OnboardingDialog({ onComplete }: OnboardingDialogProps) {
  const [step, setStep] = useState(0);
  const [selectedService, setSelectedService] = useState<'spotify' | 'apple'>('spotify');

  const steps = [
    {
      icon: <Music className="w-8 h-8" />,
      gradient: 'from-purple-500 to-pink-500',
      title: 'Shake tes sons',
      subtitle: 'Partage ce que tu écoutes en un tap. Tes amis voient, écoutent, réagissent.',
      accent: 'text-purple-400',
    },
    {
      icon: <Users className="w-8 h-8" />,
      gradient: 'from-pink-500 to-violet-500',
      title: 'Crée tes Cercles',
      subtitle: 'Des groupes privés pour partager de la musique avec tes proches. Invite par code.',
      accent: 'text-pink-400',
    },
    {
      icon: <Repeat2 className="w-8 h-8" />,
      gradient: 'from-violet-500 to-cyan-400',
      title: 'Reshake & Réagis',
      subtitle: 'Reshake les sons que tu kiffes. Réagis avec des emojis musicaux. Fais monter le TOP.',
      accent: 'text-cyan-400',
    },
  ];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      setStep(steps.length); // go to service picker
    }
  };

  const handleFinish = () => {
    onComplete({ musicService: selectedService });
  };

  const isServiceStep = step >= steps.length;

  return (
    <div className="fixed inset-0 bg-[#0a0012] z-50 flex flex-col items-center justify-center p-6">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-pink-500/8 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-sm w-full relative z-10">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {[...Array(steps.length + 1)].map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-500 ${
                i === step ? 'w-8 bg-gradient-to-r from-purple-400 to-pink-400' :
                i < step ? 'w-2 bg-purple-400/60' : 'w-2 bg-purple-800/30'
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {!isServiceStep ? (
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.3 }}
              className="text-center"
            >
              {/* Icon with glow */}
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                className="mb-8 flex justify-center"
              >
                <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${steps[step].gradient} flex items-center justify-center text-white shadow-lg shadow-purple-500/20`}>
                  {steps[step].icon}
                </div>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-3xl font-black mb-3 text-white"
              >
                {steps[step].title}
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-purple-300/60 text-base leading-relaxed mb-10 max-w-xs mx-auto"
              >
                {steps[step].subtitle}
              </motion.p>

              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                onClick={handleNext}
                className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 text-white"
              >
                {step === steps.length - 1 ? 'Presque fini !' : 'Suivant'}
                <ChevronRight className="w-5 h-5" />
              </motion.button>

              <button onClick={() => { setStep(steps.length); }} className="mt-4 text-xs text-purple-400/40 hover:text-purple-300/60 transition-colors">
                Passer
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="service"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.3 }}
              className="text-center"
            >
              <div className="mb-6 flex justify-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                  <Sparkles className="w-7 h-7 text-white" />
                </div>
              </div>

              <h2 className="text-2xl font-bold mb-1 text-white">Ton app musicale</h2>
              <p className="text-purple-300/50 mb-6 text-sm">
                Pour ouvrir les sons directement dans ton player
              </p>

              <div className="space-y-3 mb-6">
                <button
                  onClick={() => setSelectedService('spotify')}
                  className={`w-full p-4 rounded-2xl border-2 transition-all ${
                    selectedService === 'spotify'
                      ? 'border-green-500/60 bg-green-500/5'
                      : 'border-purple-800/20 bg-violet-950/20 hover:border-purple-800/30'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center flex-shrink-0">
                      <svg className="w-7 h-7 text-black" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                      </svg>
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="font-bold text-white">Spotify</h3>
                      <p className="text-xs text-purple-300/50">Le plus populaire</p>
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
                  className={`w-full p-4 rounded-2xl border-2 transition-all ${
                    selectedService === 'apple'
                      ? 'border-pink-500/60 bg-pink-500/5'
                      : 'border-purple-800/20 bg-violet-950/20 hover:border-purple-800/30'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Music className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="font-bold text-white">Apple Music</h3>
                      <p className="text-xs text-purple-300/50">Pour les fans Apple</p>
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

              <button
                onClick={handleFinish}
                className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 text-white"
              >
                <Zap className="w-4 h-4" />
                Commencer à shaker
              </button>

              <p className="text-[11px] text-purple-400/30 mt-3">
                Modifiable à tout moment dans les paramètres
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
