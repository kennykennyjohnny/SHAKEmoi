// Plantage React : au lieu d'un écran blanc, un écran propre « Oups, on
// recharge » (P16), et l'erreur part dans Sentry (si configuré).
import { Component, type ReactNode } from 'react';
import { reportError } from '../../lib/sentry';

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    reportError(error, 'react');
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="min-h-[100dvh] bg-[#1E1440] text-white flex flex-col items-center justify-center gap-4 p-6 text-center">
        <img src="/shakemoi-logo.png" alt="SHAKEmoi" className="h-7 object-contain" />
        <p className="text-lg font-bold">Oups, on recharge 🎧</p>
        <p className="text-sm text-purple-200/80 max-w-xs">Quelque chose s'est mal passé. On a prévenu Kenny ; recharger règle presque toujours le souci.</p>
        <button onClick={() => window.location.reload()} className="px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 font-semibold">
          Recharger
        </button>
      </div>
    );
  }
}
