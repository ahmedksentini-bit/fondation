// Schémas des appareils d'essai : chaque schéma se construit, aucun libellé ne
// sort du cadre, et deux libellés ne se chevauchent jamais. Les schémas sont
// des chaînes SVG : on relit leurs <text> et l'on recalcule leurs boîtes avec
// la même approximation de chasse que le placeur d'étiquettes.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as E from "../src/schemas-essais.js";
import * as C from "../src/schemas-cours.js";
import { boiteTexte } from "../src/figures.js";

const S = { ...E, ...C };
const schemas = Object.entries(S).filter(([nom, f]) => /^(schema|figure)/.test(nom) && typeof f === "function");

/** Boîtes des textes horizontaux ; la taille vient du style (12 px par défaut). */
function boites(svg) {
  return [...svg.matchAll(/<text x="([\d.-]+)" y="([\d.-]+)" text-anchor="(\w+)"([^>]*)>([^<]*)<\/text>/g)].map(([, x, y, ancre, attrs, t]) => {
    const taille = Number(/font-size:([\d.]+)px/.exec(attrs)?.[1] ?? 12);
    const brut = t.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
    return { t: brut, ...boiteTexte(+x, +y, [brut], { taille, ancre }) };
  });
}

test("chaque schéma d'essai se construit", () => {
  assert.ok(schemas.length >= 3, "des schémas sont exportés");
  for (const [nom, f] of schemas) {
    const svg = f();
    assert.match(svg, /^<svg viewBox="0 0 \d+ \d+"/, `${nom} : cadre SVG`);
    assert.ok(!/NaN|undefined|Infinity/.test(svg), `${nom} : valeur non numérique dans le tracé`);
  }
});

test("aucun libellé de schéma ne sort du cadre", () => {
  for (const [nom, f] of schemas) {
    const svg = f();
    const [, W, H] = /viewBox="0 0 (\d+) (\d+)"/.exec(svg).map(Number);
    for (const b of boites(svg))
      assert.ok(b.x >= -0.5 && b.y >= -0.5 && b.x + b.w <= W + 0.5 && b.y + b.h <= H + 0.5, `${nom} : « ${b.t} » sort du cadre`);
  }
});

test("deux libellés d'un schéma ne se chevauchent pas", () => {
  for (const [nom, f] of schemas) {
    const bs = boites(f());
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i], b = bs[j];
      const dx = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), dy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      assert.ok(dx <= 1 || dy <= 1, `${nom} : « ${a.t} » chevauche « ${b.t} »`);
    }
  }
});

test("chaque figure data-schema du cours a son schéma", () => {
  const html = readFileSync(new URL("../cours.html", import.meta.url), "utf8");
  const noms = [...html.matchAll(/data-schema="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(noms.length >= 14, "les schémas des essais sont placés dans le cours");
  for (const n of noms) assert.equal(typeof S[n], "function", `${n} : aucun schéma de ce nom`);
  assert.ok(html.includes('src="src/cours-schemas.js"'), "le chargeur des schémas est appelé par la page");
});
