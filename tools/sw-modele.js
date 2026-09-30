// Service worker du site « Fondations ».
//
// Stratégie RÉSEAU D'ABORD pour tout ce qui vient du site, cache en secours :
// un visiteur déjà venu reçoit toujours la dernière version du cours, et le
// cache ne sert que hors connexion. La coquille est préchargée à l'installation
// pour que le cours, l'exerciseur et le bureau de calcul marchent hors ligne.
// Ce fichier est produit par tools/generer-sw.py ; tests/pages.test.mjs vérifie
// qu'aucun fichier de src/ ou de data/ ne manque à la coquille.
const VERSION = "__VERSION__";
const COQUILLE = [
  __COQUILLE__
];

// Cloudflare fait garder les scripts et les données plusieurs heures par le
// navigateur. Sans précaution, une page neuve tournerait avec des modules
// d'hier gardés sous la même adresse. Tout passe donc en requête
// conditionnelle (no-cache) : le serveur renvoie le fichier s'il a changé, et
// sinon une réponse 304 légère — rien n'est téléchargé deux fois.
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => Promise.allSettled(COQUILLE.map((u) => fetch(u, { cache: "no-cache" })
        .then((r) => (r.ok ? c.put(u, r) : null)))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((noms) => Promise.all(noms.filter((n) => n !== VERSION).map((n) => caches.delete(n))))
    .then(() => self.clients.claim()));
});

// La page peut demander à la nouvelle version de prendre la main tout de suite,
// et demander quelle version la sert (diagnostic à distance).
self.addEventListener("message", (e) => {
  if (e.data?.type === "prendre-la-main") self.skipWaiting();
  if (e.data?.type === "version") e.ports?.[0]?.postMessage({ version: VERSION });
});

// Cloudflare Pages redirige /cours.html vers /cours (et /index.html vers /).
// Une réponse issue d'une redirection ne peut pas servir une navigation : le
// navigateur la refuse et affiche une erreur réseau. On la recopie donc en
// réponse « propre » avant de la rendre depuis le cache.
const propre = (r) => (r && r.redirected
  ? r.blob().then((corps) => new Response(corps, { status: r.status, statusText: r.statusText, headers: r.headers }))
  : r);

/** La même page sous son autre forme d'adresse : /cours ↔ /cours.html, / ↔ /index.html. */
function variantes(url) {
  const p = new URL(url).pathname;
  if (p.endsWith("/")) return [p + "index.html"];
  if (p.endsWith("/index.html")) return [p.slice(0, -"index.html".length)];
  if (p.endsWith(".html")) return [p.slice(0, -".html".length)];
  if (!/\.[a-z0-9]+$/i.test(p)) return [p + ".html"];
  return [];
}

async function depuisLeCache(request) {
  const direct = await caches.match(request);
  if (direct) return propre(direct);
  // Le repli ne vaut QUE pour une navigation : servir du HTML à la place d'un
  // .json ou d'un .js transformerait une panne réseau franche en erreur
  // d'analyse muette au fond d'un module.
  if (request.mode !== "navigate") return null;
  for (const v of variantes(request.url)) {
    const r = await caches.match(v);
    if (r) return propre(r);
  }
  const accueil = (await caches.match("./")) ?? (await caches.match("./index.html"));
  return accueil ? propre(accueil) : null;
}

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== location.origin) return;

  // Une navigation garde sa requête d'origine (le HTML est déjà servi sans
  // durée de cache) ; toute autre ressource est revalidée auprès du serveur,
  // avec ses en-têtes d'origine (une lecture partielle garde son Range).
  const reseau = request.mode === "navigate" ? fetch(request) : fetch(new Request(request, { cache: "no-cache" }));
  e.respondWith(
    reseau
      .then((reponse) => {
        // Seule une réponse complète est gardée : ni redirection (réponse
        // opaque, statut 0 — le navigateur la suit, et c'est l'adresse finale
        // qui sera gardée), ni morceau de fichier (206).
        if (reponse && reponse.status === 200) {
          const copie = reponse.clone();
          caches.open(VERSION).then((c) => c.put(request, copie)).catch(() => {});
        }
        return reponse;
      })
      .catch(async () => (await depuisLeCache(request))
        ?? new Response(`Ressource indisponible hors ligne : ${new URL(request.url).pathname}`,
          { status: 504, statusText: "Hors ligne", headers: { "Content-Type": "text/plain" } }))
  );
});
