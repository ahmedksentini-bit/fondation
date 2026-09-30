// Service worker : exécution réelle de sw.js dans un bac à sable, avec un
// cache simulé. Cas visé : Cloudflare Pages redirige /cours.html vers /cours ;
// le précache garde alors une réponse « redirigée », que le navigateur refuse
// pour une navigation. Hors connexion, le service worker doit la recopier en
// réponse propre, et ne jamais servir de HTML à la place d'une donnée.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ORIGINE = "https://fond.ksr-infra.org";
const source = readFileSync(new URL("../sw.js", import.meta.url), "utf8");

/** Réponse simulée : Response ne permet pas de fixer `redirected` à true. */
const reponseCache = (texte, { redirected = false, type = "text/html" } = {}) => ({
  status: 200, statusText: "OK", redirected, ok: true,
  headers: new Headers({ "Content-Type": type }),
  blob: async () => new Blob([texte], { type }),
  text: async () => texte,
});

function monter({ cache = {}, enLigne = false, appels = [] }) {
  const ecouteurs = {};
  const cle = (x) => new URL(typeof x === "string" ? x : x.url, `${ORIGINE}/sw.js`).pathname;
  const contexte = {
    self: null, location: { origin: ORIGINE }, URL, Response, Headers, Blob, Promise, console,
    caches: {
      match: async (x) => cache[cle(x)] ?? undefined,
      open: async () => ({ put: async () => {}, add: async () => {} }),
      keys: async () => [], delete: async () => true,
    },
    fetch: async (requete, init = {}) => {
      appels.push({ url: typeof requete === "string" ? requete : requete.url, cache: init.cache ?? "default" });
      if (!enLigne) throw new TypeError("Failed to fetch");
      return new Response("réseau", { status: 200 });
    },
  };
  contexte.self = { addEventListener: (type, f) => { ecouteurs[type] = f; }, skipWaiting: () => {}, clients: { claim: async () => {} } };
  vm.createContext(contexte);
  vm.runInContext(source, contexte);
  return async (chemin, mode = "navigate") => {
    let promesse = null;
    ecouteurs.fetch({ request: { method: "GET", url: `${ORIGINE}${chemin}`, mode }, respondWith: (p) => { promesse = p; } });
    return promesse;
  };
}

test("hors ligne : une page précachée par redirection est servie proprement", async () => {
  const servir = monter({ cache: { "/cours.html": reponseCache("COURS", { redirected: true }) } });
  const r = await servir("/cours.html");
  assert.equal(r.redirected, false, "la réponse servie ne doit plus être marquée redirigée");
  assert.equal(r.status, 200);
  assert.equal(await r.text(), "COURS");
});

test("hors ligne : /cours.html trouve la page gardée sous /cours, et inversement", async () => {
  const servir = monter({ cache: { "/cours": reponseCache("COURS") , "/bureau.html": reponseCache("BUREAU", { redirected: true }) } });
  assert.equal(await (await servir("/cours.html")).text(), "COURS");
  assert.equal(await (await servir("/bureau")).text(), "BUREAU");
});

test("hors ligne : une adresse inconnue retombe sur l'accueil, pour une navigation seulement", async () => {
  const servir = monter({ cache: { "/index.html": reponseCache("ACCUEIL", { redirected: true }) } });
  const page = await servir("/chapitre-inexistant");
  assert.equal(page.redirected, false, "l'accueil de repli doit être une réponse propre");
  assert.equal(await page.text(), "ACCUEIL");
  const donnee = await servir("/data/exercices-ch99.json", "cors");
  assert.equal(donnee.status, 504, "une donnée absente doit échouer franchement");
  assert.match(donnee.headers.get("Content-Type"), /text\/plain/);
});

test("en ligne : le réseau passe d'abord", async () => {
  const servir = monter({ cache: { "/cours.html": reponseCache("ANCIEN") }, enLigne: true });
  assert.equal(await (await servir("/cours.html")).text(), "réseau");
});

// Cloudflare fait garder les scripts quatre heures par le navigateur : sans
// revalidation, une page neuve chargerait des modules d'hier de même adresse.
test("en ligne : scripts et données sont revalidés, pas lus dans le cache HTTP", async () => {
  const appels = [];
  const servir = monter({ enLigne: true, appels });
  await servir("/src/cours-ch2.js", "cors");
  await servir("/data/chapitres.json", "cors");
  await servir("/cours", "navigate");
  assert.equal(appels[0].cache, "no-cache");
  assert.equal(appels[1].cache, "no-cache");
  assert.equal(appels[2].cache, "default", "une navigation garde sa requête d'origine");
});
