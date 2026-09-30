// Outils du bureau de calcul, sans accès au DOM : passage d'un sondage
// dépouillé aux couches de calcul d'une semelle ou d'un pieu, et étude
// paramétrique (balayage d'une dimension, plus petite valeur qui vérifie).

import { proposerClasseF62, CLASSES_F62 } from "../geotech/sols.js";

export const moyenneGeometrique = (v) => (v.length ? Math.exp(v.reduce((s, x) => s + Math.log(x), 0) / v.length) : NaN);
export const moyenneHarmonique = (v) => (v.length ? v.length / v.reduce((s, x) => s + 1 / x, 0) : NaN);

/** Famille du Fascicule 62 d'une couche décrite par son motif (sol) et sa nature pour α. */
function famille(sol, nature) {
  if (["craie", "marne", "roche"].includes(sol)) return sol;
  return nature === "argile" || nature === "limon" ? "argile" : "sable";
}
/** Catégorie conventionnelle NF P94-261/262 correspondante. */
function categorie(sol, nature) {
  if (["craie", "marne", "roche"].includes(sol)) return sol;
  return nature === "argile" || nature === "limon" ? "argile" : "sable";
}

/**
 * Couches de calcul tirées d'un sondage pressiométrique dépouillé.
 * couches : [{ z0, z1, nature, sol, gamma, gammaSat }] ; essais : [{ z, plNette, EM }]
 * (MPa). Dans chaque couche, p_l* est la moyenne géométrique des essais — celle
 * que la NF P94-261 applique sous une semelle —, E_M la moyenne harmonique —
 * celle des tranches de Ménard. Une couche sans essai reprend l'essai le plus
 * proche et le signale. La classe F62 est proposée d'après p_l*, comme au
 * chapitre 1 : c'est une proposition, que l'ingénieur confirme.
 */
export function couchesDepuisSondage(couches, essais) {
  const valides = essais.filter((e) => Number.isFinite(e.z) && e.plNette > 0 && e.EM > 0);
  if (!valides.length) throw new Error("aucun essai exploitable dans le sondage");
  return couches.map((c) => {
    let dedans = valides.filter((e) => e.z >= c.z0 && e.z < c.z1), estimee = false;
    if (!dedans.length) {
      const zm = (c.z0 + c.z1) / 2;
      dedans = [valides.reduce((a, b) => (Math.abs(b.z - zm) < Math.abs(a.z - zm) ? b : a))];
      estimee = true;
    }
    const pl = moyenneGeometrique(dedans.map((e) => e.plNette)), EM = moyenneHarmonique(dedans.map((e) => e.EM));
    const fam = famille(c.sol, c.nature), prop = proposerClasseF62(fam, pl);
    const classe = prop.cle ?? Object.keys(CLASSES_F62).find((k) => CLASSES_F62[k].famille === fam);
    return { z0: c.z0, z1: c.z1, classe, categorie: categorie(c.sol, c.nature), gamma: c.gamma, gammaSat: c.gammaSat, pl, EM, essais: dedans.length, estimee };
  });
}

/**
 * Balayage d'une variable entre min et max : evaluer(x) renvoie les taux de
 * travail maximaux par référentiel, { F62, EC7 } (Infinity si le calcul est
 * impossible). Renvoie les points et, pour chaque référentiel, la plus petite
 * valeur qui vérifie tout (taux ≤ 1), interpolée entre deux points du balayage.
 */
export function balayage(evaluer, min, max, pas) {
  const n = Math.min(400, Math.max(2, Math.round((max - min) / pas) + 1));
  const points = Array.from({ length: n }, (_, i) => {
    const x = min + ((max - min) * i) / (n - 1);
    let t;
    try { t = evaluer(x); } catch { t = { F62: Infinity, EC7: Infinity }; }
    return { x, ...t };
  });
  const premier = (ref) => {
    for (let i = 0; i < points.length; i++) {
      if (!(points[i][ref] <= 1)) continue;
      if (i === 0) return points[0].x;
      const a = points[i - 1], b = points[i];
      // Interpolation linéaire du passage à 1, quand le point précédent est fini.
      return Number.isFinite(a[ref]) ? a.x + ((a[ref] - 1) / (a[ref] - b[ref])) * (b.x - a.x) : b.x;
    }
    return null;
  };
  return { points, minimal: { F62: premier("F62"), EC7: premier("EC7") } };
}

/** Taux de travail maximal par référentiel d'une liste de vérifications [{ ref, taux, ok }]. */
export function tauxMaximaux(verifs) {
  const t = { F62: 0, EC7: 0 };
  for (const v of verifs) {
    const x = Number.isFinite(v.taux) ? v.taux : v.ok ? 0 : Infinity;
    if (x > t[v.ref]) t[v.ref] = x;
  }
  return t;
}
