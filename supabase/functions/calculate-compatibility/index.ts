// Plus utilisée par SHAKEmoi (et cassée : la fonction SQL appelée n'existe pas).
// Tournait avec la clé service en CORS ouvert. Neutralisée le 30/09/2026 : 410.
Deno.serve(() => new Response(JSON.stringify({ error: 'gone' }), {
  status: 410,
  headers: { 'Content-Type': 'application/json' },
}));
