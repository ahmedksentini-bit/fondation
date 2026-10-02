// Mise en page des figures : le placeur d'étiquettes évite les tracés et les
// autres textes, les coupures se font sur « · », les graduations restent
// propres. Les figures sont des chaînes SVG : on les lit comme du texte.
import test from "node:test";
import assert from "node:assert/strict";
import { placeur, couper, graphe, courbeGranulo, abaquePlasticite, boiteTexte, pasJoli } from "../src/figures.js";
import * as SCHEMAS from "../src/schemas-cours.js";
import { coupeTalus, coupeProfil } from "../src/dessins-gtr.js";
import { cercleCritique } from "../src/gtr/stabilite.js";
import { profilTravers } from "../src/gtr/cubatures.js";

/** Positions (x, y, ancre, texte) des éléments <text> d'une figure. */
const textes = (svg) => [...svg.matchAll(/<text x="([\d.-]+)" y="([\d.-]+)" text-anchor="(\w+)"[^>]*>([^<]*)<\/text>/g)]
  .map(([, x, y, ancre, t]) => ({ x: +x, y: +y, ancre, t }));

test("placeur : une position barrée par un tracé cède la place à la suivante", () => {
  const P = placeur({ x: 0, y: 0, w: 400, h: 300 });
  P.segment(0, 100, 400, 100); // traverse la première position
  P.texte([{ x: 50, y: 104, ancre: "start", lignes: ["étiquette"] }, { x: 50, y: 160, ancre: "start", lignes: ["étiquette"] }], "");
  const [t] = textes(P.rendre());
  assert.equal(t.y, 160);
});

test("placeur : deux étiquettes ne se superposent jamais", () => {
  const P = placeur({ x: 0, y: 0, w: 400, h: 300 });
  const cands = [{ x: 100, y: 50 }, { x: 100, y: 80 }, { x: 100, y: 110 }].map((c) => ({ ...c, ancre: "start", lignes: ["même place"] }));
  P.texte(cands, ""); P.texte(cands, "");
  const [a, b] = textes(P.rendre());
  const ba = boiteTexte(a.x, a.y, [a.t]), bb = boiteTexte(b.x, b.y, [b.t]);
  assert.ok(ba.y + ba.h <= bb.y || bb.y + bb.h <= ba.y, "boîtes disjointes");
});

test("placeur : une étiquette ne sort pas du cadre", () => {
  const P = placeur({ x: 0, y: 0, w: 200, h: 100 });
  P.texte([{ x: 190, y: 50, ancre: "start", lignes: ["trop à droite"] }, { x: 190, y: 50, ancre: "end", lignes: ["trop à droite"] }], "");
  const [t] = textes(P.rendre());
  assert.equal(t.ancre, "end");
});

test("couper : sur « · » d'abord, puis sur les espaces", () => {
  assert.deepEqual(couper("argile A · pl* 0,70 MPa", 80, 11), ["argile A", "pl* 0,70 MPa"]);
  assert.deepEqual(couper("court", 80, 11), ["court"]);
});

test("graduations : pas ronds, jamais « -0 »", () => {
  assert.equal(pasJoli(138, 5), 20);
  assert.equal(pasJoli(2.6, 6), 0.5);
  const svg = graphe({ xmin: 0, xmax: 10, ymin: -3, ymax: 10, inverserY: true, series: [{ points: [[0, -3], [10, 10]], couleur: "#000" }] });
  assert.ok(!/>-0</.test(svg));
});

test("graphe : le libellé d'une zone évite la courbe qui la traverse", () => {
  // La courbe longe le haut de la zone côté droit : le libellé doit aller ailleurs.
  const svg = graphe({
    largeur: 560, hauteur: 300, xmin: 0, xmax: 100, ymin: 0, ymax: 10, inverserY: true,
    zones: [{ x0: 0, x1: 100, y0: 5, y1: 10, couleur: "#ccc", libelle: "couche de marne très compacte", position: "droite" }],
    series: [{ points: [[60, 5.3], [100, 5.3]], couleur: "#000" }],
  });
  const t = textes(svg).find((x) => x.t === "couche de marne très compacte");
  assert.ok(t, "libellé présent");
  assert.ok(!(t.ancre === "end" && t.y < 14 + 26 * 5.3 + 12), "pas en haut à droite, sur la courbe");
});

/** Tous les textes d'une figure, avec leur ancre et leur taille (12 px par défaut). */
const tousTextes = (svg) => [...svg.matchAll(/<text x="([\d.-]+)" y="([\d.-]+)"([^>]*)>([^<]*)<\/text>/g)].map(([, x, y, attrs, t]) => ({
  x: +x, y: +y, t, ancre: /text-anchor="(\w+)"/.exec(attrs)?.[1] ?? "start", taille: +(/font-size:([\d.]+)px/.exec(attrs)?.[1] ?? 12),
}));
const cadre = (svg) => { const [, , w, h] = /viewBox="([\d. ]+)"/.exec(svg)[1].split(" ").map(Number); return { w, h }; };
function dansLeCadre(svg, nom) {
  const { w, h } = cadre(svg);
  for (const t of tousTextes(svg)) {
    if (!t.t.trim()) continue;
    const b = boiteTexte(t.x, t.y, [t.t], { ancre: t.ancre, taille: t.taille });
    assert.ok(b.x >= -1 && b.x + b.w <= w + 1 && b.y >= -1 && b.y + b.h <= h + 1, `${nom} : « ${t.t} » sort du cadre`);
  }
}

test("courbe granulométrique et abaque de plasticité : textes dans le cadre", () => {
  dansLeCadre(courbeGranulo({ largeur: 620, hauteur: 300, series: [{ points: [[0.002, 3], [0.063, 11], [2, 31], [63, 100]], couleur: "#000", libelle: "sol" }],
    marques: [{ x: 0.063, y: 11, couleur: "#f00", libelle: "fines : 11 %" }] }), "courbe granulométrique");
  dansLeCadre(abaquePlasticite({ largeur: 620, hauteur: 330, points: [{ wL: 45, IP: 22, libelle: "Ap" }] }), "abaque de plasticité");
});

test("schémas du cours : chaque texte reste dans sa figure", () => {
  for (const [nom, dessin] of Object.entries(SCHEMAS)) if (typeof dessin === "function" && nom.startsWith("schema")) dansLeCadre(dessin(), nom);
});

test("coupes du talus et du profil en travers : textes dans le cadre", () => {
  const p = { H: 8, f: 1.5, c: 8, phi: 25, gamma: 20, ru: 0 };
  dansLeCadre(coupeTalus(p, cercleCritique(p)), "coupe du talus");
  const r = profilTravers({ tn: [[-30, 106.8], [-12, 104.6], [0, 102.6], [12, 100.4], [30, 97.6]], zAxe: 102, lg: 6, ld: 6, devers: 2.5, fd: 1, fr: 1.5 });
  dansLeCadre(coupeProfil(r), "profil en travers");
});
