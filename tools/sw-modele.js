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

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => Promise.allSettled(COQUILLE.map((u) => c.add(u))))
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

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== location.origin) return;

  e.respondWith(
    fetch(request)
      .then((reponse) => {
        if (reponse && reponse.ok) {
          const copie = reponse.clone();
          caches.open(VERSION).then((c) => c.put(request, copie));
        }
        return reponse;
      })
      .catch(() => caches.match(request).then((c) => {
        if (c) return c;
        // Le repli sur l'accueil ne vaut QUE pour une navigation : servir du
        // HTML à la place d'un .json ou d'un .js transformerait une panne
        // réseau franche en erreur d'analyse muette au fond d'un module.
        if (request.mode === "navigate") return caches.match("./index.html");
        return new Response(`Ressource indisponible hors ligne : ${new URL(request.url).pathname}`,
          { status: 504, statusText: "Hors ligne", headers: { "Content-Type": "text/plain" } });
      }))
  );
});
