import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';

// Écran chargé à la demande (perf 4G) : le premier affichage ne télécharge
// plus toute l'appli. Le composant renvoyé s'utilise exactement comme avant.
const preloaders: Array<() => Promise<unknown>> = [];

export function lazyView<M, P = any>(
  loader: () => Promise<M>,
  pick: (m: M) => ComponentType<P>,
  fallback: ReactNode = null,
): ComponentType<P> {
  const Lazy = lazy(() => loader().then((m) => ({ default: pick(m) })));
  preloaders.push(loader);
  const View = (props: P) => (
    <Suspense fallback={fallback}>
      <Lazy {...(props as any)} />
    </Suspense>
  );
  return View as ComponentType<P>;
}

/** Précharge tous les écrans en arrière-plan, une fois l'appli affichée. */
export function preloadViews() {
  const run = () => preloaders.forEach((p) => p().catch(() => {}));
  const w = window as any;
  if (w.requestIdleCallback) w.requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 2500);
}

export const ViewSpinner = (
  <div className="flex-1 flex items-center justify-center py-20">
    <div className="w-8 h-8 border-2 border-purple-500/40 border-t-purple-400 rounded-full animate-spin" />
  </div>
);
