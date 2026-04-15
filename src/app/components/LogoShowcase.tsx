import { Logo } from './Logo';

export function LogoShowcase() {
  const variants = [
    { 
      id: 1, 
      name: 'Spotify Waves', 
      desc: '3 ondes courbes style Spotify',
      style: 'Classique et reconnaissable'
    },
    { 
      id: 2, 
      name: 'Symmetric Waves', 
      desc: '2 ondes symétriques et centrées',
      style: 'Équilibré et harmonieux'
    },
    { 
      id: 3, 
      name: 'Minimal Lines', 
      desc: '3 lignes horizontales simples',
      style: 'Ultra minimaliste et moderne'
    },
    { 
      id: 4, 
      name: 'Soundwave Bars', 
      desc: 'Barres verticales animées',
      style: 'Dynamique et énergique'
    },
    { 
      id: 5, 
      name: 'Arc Stacks', 
      desc: 'Demi-cercles empilés',
      style: 'Unique et sophistiqué'
    },
  ];

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-black mb-3 bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent" style={{ fontFamily: "'Maven Pro', sans-serif" }}>
            Sound Circle
          </h1>
          <p className="text-gray-400 text-lg mb-2">
            5 variations du concept ✨
          </p>
          <p className="text-gray-500 text-sm">
            Cercle gradient + ondes sonores - Simple et reconnaissable
          </p>
        </div>

        {/* Large preview grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {variants.map((variant) => (
            <div
              key={variant.id}
              className="group"
            >
              {/* Giant preview */}
              <div className="bg-zinc-900 border-2 border-zinc-800 rounded-3xl p-12 mb-4 hover:border-purple-500/50 transition-all hover:scale-105 aspect-square flex items-center justify-center">
                <Logo variant={variant.id as any} size="lg" animated={true} showText={false} />
              </div>

              {/* Info */}
              <div className="text-center">
                <h3 className="text-xl font-bold text-white mb-2">
                  #{variant.id} · {variant.name}
                </h3>
                <p className="text-sm text-gray-400 mb-1">{variant.desc}</p>
                <p className="text-xs text-purple-400">{variant.style}</p>
              </div>

              {/* With text */}
              <div className="mt-4 bg-zinc-950 rounded-xl p-6 flex items-center justify-center border border-zinc-800">
                <Logo variant={variant.id as any} size="md" animated={false} showText={true} />
              </div>
            </div>
          ))}
        </div>

        {/* Comparison section */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="p-6 bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-purple-500/20 rounded-2xl">
            <h2 className="text-xl font-bold mb-4 text-purple-400">🎯 Pourquoi ce concept ?</h2>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>✅ <strong>Reconnaissable</strong> : Cercle = logo d'app</li>
              <li>✅ <strong>Musical</strong> : Ondes sonores = évident</li>
              <li>✅ <strong>Simple</strong> : 2 formes seulement</li>
              <li>✅ <strong>Moderne</strong> : Style 2025</li>
              <li>✅ <strong>Scalable</strong> : Fonctionne en petit et grand</li>
            </ul>
          </div>

          <div className="p-6 bg-zinc-900 border border-zinc-700 rounded-2xl">
            <h2 className="text-xl font-bold mb-4 text-white">🎨 Détails techniques</h2>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>• Gradient : Purple (#a855f7) → Pink (#ec4899)</li>
              <li>• Ondes : Blanc pur (#ffffff)</li>
              <li>• Forme : Cercle parfait 96px</li>
              <li>• Animation : Douce et subtile</li>
              <li>• Police : Maven Pro Black</li>
            </ul>
          </div>
        </div>

        {/* My recommendations */}
        <div className="p-8 bg-gradient-to-r from-purple-600/10 to-pink-600/10 border-2 border-purple-500/30 rounded-2xl mb-8">
          <h2 className="text-2xl font-black mb-6 text-center">🏆 Mes top 3</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="bg-black/50 rounded-2xl p-8 mb-4 border-2 border-yellow-500/30">
                <Logo variant={1} size="lg" animated={true} showText={false} />
              </div>
              <div className="text-2xl mb-2">🥇</div>
              <div className="font-bold text-lg text-yellow-400">#1 Spotify Waves</div>
              <p className="text-xs text-gray-400 mt-2">Le plus musical et pro. Inspiré de Spotify. Valeur sûre !</p>
            </div>

            <div className="text-center">
              <div className="bg-black/50 rounded-2xl p-8 mb-4 border-2 border-gray-400/30">
                <Logo variant={4} size="lg" animated={true} showText={false} />
              </div>
              <div className="text-2xl mb-2">🥈</div>
              <div className="font-bold text-lg text-gray-300">#4 Soundwave Bars</div>
              <p className="text-xs text-gray-400 mt-2">Énergique et dynamique. Représente vraiment le son !</p>
            </div>

            <div className="text-center">
              <div className="bg-black/50 rounded-2xl p-8 mb-4 border-2 border-pink-500/30">
                <Logo variant={3} size="lg" animated={true} showText={false} />
              </div>
              <div className="text-2xl mb-2">🥉</div>
              <div className="font-bold text-lg text-pink-400">#3 Minimal Lines</div>
              <p className="text-xs text-gray-400 mt-2">Le plus simple. Minimaliste et moderne.</p>
            </div>
          </div>
        </div>

        {/* Side by side comparison */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
          <h2 className="text-xl font-bold mb-6 text-center">📱 Comparaison tailles</h2>
          <div className="flex items-center justify-center gap-12 flex-wrap">
            <div className="text-center">
              <p className="text-sm text-gray-400 mb-4">Small (32px)</p>
              <div className="bg-black rounded-xl p-4 inline-block">
                <Logo variant={1} size="sm" animated={false} showText={false} />
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-400 mb-4">Medium (48px)</p>
              <div className="bg-black rounded-xl p-4 inline-block">
                <Logo variant={1} size="md" animated={false} showText={false} />
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-400 mb-4">Large (80px)</p>
              <div className="bg-black rounded-xl p-4 inline-block">
                <Logo variant={1} size="lg" animated={false} showText={false} />
              </div>
            </div>
          </div>
          <p className="text-center text-xs text-gray-500 mt-6">
            Les ondes restent lisibles même en petit 👌
          </p>
        </div>

        {/* Final CTA */}
        <div className="mt-12 text-center">
          <p className="text-gray-300 text-xl mb-4 font-semibold">
            Alors, lequel tu prends ? 🎯
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            {variants.map(v => (
              <button
                key={v.id}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl text-white font-bold hover:scale-105 transition-transform"
              >
                #{v.id}
              </button>
            ))}
          </div>
          <p className="text-gray-500 text-sm mt-6">
            Dis-moi juste le numéro et je l'applique dans toute l'app ! 🚀
          </p>
        </div>
      </div>
    </div>
  );
}
