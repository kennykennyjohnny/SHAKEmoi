  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import { AppErrorBoundary } from "./app/components/AppErrorBoundary";
  import { initSentry } from "./lib/sentry";
  import "./styles/index.css";

  createRoot(document.getElementById("root")!).render(<AppErrorBoundary><App /></AppErrorBoundary>);

// Suivi des erreurs (P16) : chargé après l'affichage, seulement si configuré.
window.addEventListener('load', () => { initSentry(); });

// Service worker : rend l'app installable sur Android (voir public/sw.js).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
