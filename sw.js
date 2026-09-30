// Service worker du site « Fondations ».
//
// Stratégie RÉSEAU D'ABORD pour tout ce qui vient du site, cache en secours :
// un visiteur déjà venu reçoit toujours la dernière version du cours, et le
// cache ne sert que hors connexion. La coquille est préchargée à l'installation
// pour que le cours, l'exerciseur et le bureau de calcul marchent hors ligne.
// Ce fichier est produit par tools/generer-sw.py ; tests/pages.test.mjs vérifie
// qu'aucun fichier de src/ ou de data/ ne manque à la coquille.
const VERSION = "fond-v3";
const COQUILLE = [
  "./", "./index.html", "./cours.html", "./exerciseur.html", "./bureau.html",
  "./cours", "./exerciseur", "./bureau", "./styles.css", "./enhancements.css",
  "./site.css", "./assets/icon.svg", "./manifest.webmanifest",
  // Modules : pages, solveurs, modèles d'exercices, bureau de calcul.
  "./src/app.js", "./src/bureau.js", "./src/bureau/notes.js",
  "./src/bureau/pieu.js", "./src/bureau/semelle.js", "./src/cours-ch1.js",
  "./src/cours-ch10.js", "./src/cours-ch11.js", "./src/cours-ch12.js",
  "./src/cours-ch13.js", "./src/cours-ch14.js", "./src/cours-ch15.js",
  "./src/cours-ch2.js", "./src/cours-ch3.js", "./src/cours-ch4.js",
  "./src/cours-ch5.js", "./src/cours-ch6.js", "./src/cours-ch7.js",
  "./src/cours-ch8.js", "./src/cours-ch9.js", "./src/donnees.js",
  "./src/essais-exemples.js", "./src/exercices.js", "./src/exerciseur.js",
  "./src/exos/alea.js", "./src/exos/ch01.js", "./src/exos/ch02.js",
  "./src/exos/ch03.js", "./src/exos/ch04.js", "./src/exos/ch05.js",
  "./src/exos/ch06.js", "./src/exos/ch07.js", "./src/exos/ch08.js",
  "./src/exos/ch09.js", "./src/exos/ch10.js", "./src/exos/ch11.js",
  "./src/exos/ch12.js", "./src/exos/ch13.js", "./src/exos/ch14.js",
  "./src/exos/ch15.js", "./src/exos/index.js", "./src/figures.js",
  "./src/geotech/combinaisons.js", "./src/geotech/cphi.js", "./src/geotech/essais.js",
  "./src/geotech/frottement-negatif.js", "./src/geotech/groupes.js", "./src/geotech/lateral.js",
  "./src/geotech/outils.js", "./src/geotech/pieux.js", "./src/geotech/pressio.js",
  "./src/geotech/sismique.js", "./src/geotech/sols.js", "./src/geotech/superficielles.js",
  "./src/geotech/tassement-pieu.js", "./src/geotech/tassements.js", "./src/impression.js",
  "./src/pressio-exemples.js", "./src/socle.js", "./src/tableaux.js",
  "./src/ui.js",
  // Les données : un chapitre sans son fichier est un chapitre vide hors ligne.
  "./data/chapitres.json", "./data/exercices-ch1.json", "./data/exercices-ch10.json",
  "./data/exercices-ch11.json", "./data/exercices-ch12.json", "./data/exercices-ch13.json",
  "./data/exercices-ch14.json", "./data/exercices-ch15.json", "./data/exercices-ch2.json",
  "./data/exercices-ch3.json", "./data/exercices-ch4.json", "./data/exercices-ch5.json",
  "./data/exercices-ch6.json", "./data/exercices-ch7.json", "./data/exercices-ch8.json",
  "./data/exercices-ch9.json",
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

  e.respondWith(
    fetch(request)
      .then((reponse) => {
        // Une redirection (réponse opaque, statut 0) n'est pas mise en cache :
        // le navigateur la suit, et c'est l'adresse finale qui sera gardée.
        if (reponse && reponse.ok) {
          const copie = reponse.clone();
          caches.open(VERSION).then((c) => c.put(request, copie));
        }
        return reponse;
      })
      .catch(async () => (await depuisLeCache(request))
        ?? new Response(`Ressource indisponible hors ligne : ${new URL(request.url).pathname}`,
          { status: 504, statusText: "Hors ligne", headers: { "Content-Type": "text/plain" } }))
  );
});
