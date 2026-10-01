// Contrôles structurels des pages. Pannes silencieuses visées :
//  · deux éléments portant le même id — getElementById ne renvoie que le
//    premier, et un calculateur écrit alors dans la figure d'un autre ;
//  · un script de chapitre qui appelle el("xxx") sans que cet id existe — la
//    page se charge, le calculateur reste vide, et rien ne le signale ;
//  · un module ou une donnée absents du service worker — hors ligne, le
//    chapitre est vide.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const lire = (f) => readFileSync(join(racine, f), "utf-8");
const PAGES = ["index.html", "cours.html", "exerciseur.html", "bureau.html"];
const idsDe = (html) => [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);

/** Tous les fichiers d'un dossier, récursivement, en chemins relatifs à la racine. */
function fichiers(dossier) {
  const res = [];
  for (const f of readdirSync(join(racine, dossier))) {
    const p = join(racine, dossier, f);
    if (statSync(p).isDirectory()) res.push(...fichiers(join(dossier, f)));
    else res.push(relative(racine, p).split("\\").join("/"));
  }
  return res;
}

for (const page of PAGES) {
  test(`${page} — aucun identifiant en double`, () => {
    const vus = new Set(), doubles = new Set();
    for (const id of idsDe(lire(page))) (vus.has(id) ? doubles : vus).add(id);
    assert.deepEqual([...doubles], [], `identifiants en double dans ${page}`);
  });

  test(`${page} — les feuilles et scripts appelés existent`, () => {
    const html = lire(page);
    for (const [, f] of html.matchAll(/(?:src|href)="((?:src|assets|data)\/[^"#?]+|[a-z-]+\.(?:css|webmanifest))"/g))
      assert.ok(existsSync(join(racine, f)), `${page} référence ${f}, absent`);
  });
}

test("les calculateurs du cours ne visent que des identifiants existants", () => {
  const html = lire("cours.html");
  const ids = new Set(idsDe(html));
  const scripts = readdirSync(join(racine, "src")).filter((f) => /^cours-ch\d+\.js$/.test(f));
  const rediges = JSON.parse(lire("data/chapitres.json")).chapitres.filter((c) => c.cours);
  assert.equal(scripts.length, rediges.length, "un script par chapitre rédigé");
  for (const f of scripts) {
    const src = lire(join("src", f));
    const siens = new Set([...src.matchAll(/\bid="([^"$]+)"/g)].map((m) => m[1]));
    for (const [, id] of src.matchAll(/\bel\("([^"]+)"\)/g))
      assert.ok(ids.has(id) || siens.has(id), `${f} appelle el("${id}") — absent de cours.html et non créé par le script`);
    for (const [, id] of src.matchAll(/brancher\(\[([^\]]+)\]/g))
      for (const [, x] of id.matchAll(/"([^"]+)"/g))
        assert.ok(ids.has(x) || siens.has(x), `${f} branche « ${x} » — absent de cours.html`);
    assert.ok(html.includes(`src="src/${f}"`), `${f} n'est pas chargé par cours.html`);
  }
});

test("le service worker précharge tout ce que les pages utilisent", () => {
  const sw = lire("sw.js");
  const attendus = [...PAGES, "styles.css", "enhancements.css", "site.css", "manifest.webmanifest",
    ...fichiers("src").filter((f) => f.endsWith(".js")),
    ...readdirSync(join(racine, "data")).filter((f) => f.endsWith(".json")).map((f) => `data/${f}`)];
  for (const f of attendus) assert.ok(sw.includes(`"./${f}"`), `${f} absent de la coquille du service worker (tools/generer-sw.py)`);
  assert.match(sw, /const VERSION = "fond-v\d+"/);
  assert.ok(lire("src/socle.js").includes(sw.match(/const VERSION = "([^"]+)"/)[1]), "socle.js attend la version du service worker");
});

test("hors ligne, une donnée absente ne se déguise pas en page d'accueil", () => {
  assert.match(lire("sw.js"), /request\.mode [!=]== "navigate"/, "le repli sur la coquille doit être réservé aux navigations");
  assert.match(lire("src/donnees.js"), /\^\\s\*</, "chargerJson doit détecter une réponse HTML");
  for (const f of fichiers("src").filter((x) => x.endsWith(".js") && !x.endsWith("donnees.js"))) {
    assert.ok(!/fetch\([^)]*\)\s*\.then\(\s*\(?r\)?\s*=>\s*r\.json\(\)/.test(lire(f)), `${f} décode du JSON sans passer par chargerJson`);
  }
});

test("hors ligne, une page redirigée par l'hébergeur reste servie", () => {
  // Cloudflare Pages redirige /cours.html vers /cours : une réponse redirigée
  // mise en cache doit être recopiée avant de servir une navigation, et les
  // deux formes d'adresse doivent être préchargées.
  const sw = lire("sw.js");
  assert.match(sw, /r\.redirected/, "le service worker doit nettoyer les réponses redirigées");
  for (const p of ["cours", "exerciseur", "bureau"]) assert.ok(sw.includes(`"./${p}"`), `forme /${p} absente de la coquille`);
});

test("une adresse inconnue répond par une vraie page 404", () => {
  const html = lire("404.html");
  assert.match(html, /href="\/styles\.css"/, "la page 404 doit charger ses styles en chemin absolu (elle peut être servie à toute profondeur)");
  assert.match(html, /href="\/"/, "lien vers l'accueil");
});

test("chaque chapitre annoncé a sa section de cours et sa banque complète", () => {
  const { chapitres } = JSON.parse(lire("data/chapitres.json"));
  const html = lire("cours.html");
  for (const c of chapitres) {
    if (c.cours) assert.ok(html.includes(`<section id="${c.id}"`), `${c.id} annoncé mais absent du cours`);
    if (c.exercices) {
      const b = JSON.parse(lire(`data/exercices-${c.id}.json`));
      assert.equal(b.exercices.length, c.exercices, `${c.id} : ${b.exercices.length} exercices en banque, ${c.exercices} annoncés`);
    }
  }
});

test("les normes et les feuilles de calcul fournies ne sont pas publiées", () => {
  const ignore = lire(".gitignore");
  assert.match(ignore, /^docs\/$/m, "docs/ (normes, guides, tableurs) doit rester hors du dépôt");
});

test("chaque curseur de calcul encadre la valeur de départ de sa case", () => {
  const html = lire("cours.html");
  assert.ok(html.includes('src="src/curseurs.js"'), "le module des curseurs est chargé par le cours");
  const champs = [...html.matchAll(/<input id="([^"]+)"[^>]*value="([^"]*)" data-curseur="([^"]+)"/g)];
  assert.ok(champs.length >= 150, "les calculateurs ont leurs curseurs");
  for (const [, id, valeur, plage] of champs) {
    const [min, max, pas] = plage.split(/\s+/).map(Number);
    assert.ok(max > min && pas > 0, `${id} : plage « ${plage} » incohérente`);
    assert.ok((max - min) / pas <= 20000, `${id} : pas trop fin pour une réglette`);
    const v = Number(valeur);
    assert.ok(valeur === "" || (v >= min && v <= max), `${id} : ${valeur} hors de la plage ${plage}`);
  }
});

test("chaque banc d'essai du cours a son module", () => {
  const html = lire("cours.html");
  const bancs = [...html.matchAll(/class="banc" data-banc="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(bancs.length >= 7, "les bancs d'essai sont placés dans le cours");
  assert.ok(html.includes('src="src/bancs.js"'), "le chargeur des bancs est appelé par la page");
  const chargeur = lire("src/bancs.js");
  for (const b of bancs) {
    const cle = /^[a-z]+$/.test(b) ? `${b}: () =>` : `"${b}": () =>`;
    assert.ok(chargeur.includes(`${cle} import("./bancs/${b}.js")`), `${b} : absent du chargeur src/bancs.js`);
    assert.ok(existsSync(join(racine, `src/bancs/${b}.js`)), `src/bancs/${b}.js absent`);
    assert.match(lire(`src/bancs/${b}.js`), /export function monter\(/, `${b} : pas de fonction monter`);
  }
});
