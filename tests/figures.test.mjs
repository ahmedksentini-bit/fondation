// Mise en page des figures : le placeur d'étiquettes évite les tracés et les
// autres textes, les coupures se font sur « · », les graduations restent
// propres. Les figures sont des chaînes SVG : on les lit comme du texte.
import test from "node:test";
import assert from "node:assert/strict";
import { placeur, couper, graphe, coupeSemelle, figureContraintes, boiteTexte, pasJoli } from "../src/figures.js";

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

test("coupe de semelle : étiquettes dans le cadre, une seule mention du TN", () => {
  const svg = coupeSemelle({
    B: 2.7, D: 1.5, e: 0.3, V: "Vd", H: 40, zNappe: 1, hauteur: 250, largeur: 560,
    couches: [{ z0: 0, z1: 30, sol: "argile", position: "bas", etiquette: "argile · cu 45 kPa · φ' 25° · c' 5 kPa" }],
  });
  const ts = textes(svg);
  assert.equal(ts.filter((t) => t.t === "TN après travaux").length, 1);
  for (const t of ts) {
    const b = boiteTexte(t.x, t.y, [t.t], { ancre: t.ancre });
    assert.ok(b.x >= 0 && b.x + b.w <= 560 && b.y >= 0 && b.y + b.h <= 250, `« ${t.t} » dans le cadre`);
  }
});

test("diagramme des contraintes : zone comprimée minuscule, libellé dans le cadre", () => {
  const svg = figureContraintes({ B: 2.4, V: 600, e: 1.167, qmax: 12000, qmin: 0, Bc: 0.1, qref: 9000, meyerhof: 9000 });
  const t = textes(svg).find((x) => x.t.startsWith("largeur comprimée"));
  const b = boiteTexte(t.x, t.y, [t.t], { ancre: t.ancre, taille: 11.5 });
  assert.ok(b.x + b.w <= 560, "libellé de la cote dans la figure");
});
