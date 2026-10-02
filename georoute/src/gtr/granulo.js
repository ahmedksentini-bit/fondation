// Courbe granulométrique : interpolation, diamètres caractéristiques,
// coefficients d'uniformité et de courbure, fractions utiles au classement.
//
// La courbe est une liste de points [d (mm), passant cumulé (%)]. Entre deux
// tamis, le passant varie linéairement avec le logarithme de l'ouverture :
// c'est l'hypothèse de tracé de toute courbe granulométrique sur papier
// semi-logarithmique (NF EN ISO 17892-4).

import { horsDomaine } from "./outils.js";

/** Tamis usuels (mm), de la série des normes européennes. */
export const TAMIS = [125, 100, 80, 63, 50, 40, 31.5, 20, 16, 10, 8, 6.3, 5, 4, 2, 1, 0.5, 0.4, 0.315, 0.2, 0.125, 0.08, 0.063];

/** Trie et nettoie une courbe : ouvertures croissantes, passants bornés à [0, 100]. */
export function normaliser(points) {
  return points
    .filter(([d, p]) => Number.isFinite(d) && d > 0 && Number.isFinite(p))
    .map(([d, p]) => [d, Math.min(100, Math.max(0, p))])
    .sort((a, b) => a[0] - b[0]);
}

/**
 * Passant (%) au diamètre d, interpolé en log d. Au-delà du plus gros tamis
 * le passant vaut 100 % si la courbe y arrive, sinon il est inconnu ; en deçà
 * du plus petit, il est inconnu (une sédimentométrie le dirait).
 */
export function passant(points, d) {
  const c = normaliser(points);
  if (!c.length || !(d > 0)) return NaN;
  if (d >= c[c.length - 1][0]) return c[c.length - 1][1] >= 99.999 ? 100 : (d === c[c.length - 1][0] ? c[c.length - 1][1] : NaN);
  if (d < c[0][0]) return NaN;
  for (let i = 1; i < c.length; i++) {
    const [d0, p0] = c[i - 1], [d1, p1] = c[i];
    if (d <= d1) return p0 + ((p1 - p0) * Math.log(d / d0)) / Math.log(d1 / d0);
  }
  return NaN;
}

/**
 * Diamètre Dx (mm) sous lequel passent x % de la masse, interpolé en log d.
 * NaN si la courbe ne descend pas jusqu'à x % (les fines n'ont pas été
 * analysées) ou ne monte pas jusqu'à x %.
 */
export function diametre(points, x) {
  const c = normaliser(points);
  for (let i = 1; i < c.length; i++) {
    const [d0, p0] = c[i - 1], [d1, p1] = c[i];
    if ((x >= p0 && x <= p1) && p1 > p0) return d0 * Math.exp((Math.log(d1 / d0) * (x - p0)) / (p1 - p0));
  }
  return NaN;
}

/**
 * Analyse d'une courbe complète (matériau total). Les paramètres de
 * classement du GTR 2024 se lisent sur la fraction 0/63 mm : les passants à
 * 2 mm et à 63 µm sont ramenés à cette fraction [GTR 2024 F1 § 2.2.1].
 * Ceux du GTR 1992 se lisaient sur la fraction 0/50 mm, avec le tamis de 80 µm.
 */
export function analyser(points) {
  const c = normaliser(points);
  if (c.length < 2) return horsDomaine("Il faut au moins deux tamis pour tracer une courbe.");
  const p63 = passant(c, 63), p50 = passant(c, 50);
  const brut = { p2: passant(c, 2), p0063: passant(c, 0.063), p008: passant(c, 0.08) };
  // Dmax : on l'assimile au D95 dès qu'une analyse existe [GTR 2024 F1 § 2.2.1 b].
  const D95 = diametre(c, 95);
  const Dmax = Number.isFinite(D95) ? D95 : c.find(([, p]) => p >= 95)?.[0] ?? c[c.length - 1][0];
  const surFraction = (p, pRef) => (Number.isFinite(p) && pRef > 0 ? Math.min(100, (100 * p) / pRef) : NaN);
  const ref63 = Number.isFinite(p63) ? p63 : 100, ref50 = Number.isFinite(p50) ? p50 : 100;
  const D10 = diametre(c, 10), D30 = diametre(c, 30), D60 = diametre(c, 60);
  const Cu = D60 / D10, Cc = (D30 * D30) / (D60 * D10);
  const f = {
    applicable: true, points: c, Dmax, D10, D30, D60, Cu, Cc,
    passant63mm: ref63, passant50mm: ref50,
    // Fraction 0/63 mm (GTR 2024)
    p2mm: surFraction(brut.p2, ref63), p63um: surFraction(brut.p0063, ref63),
    // Fraction 0/50 mm (GTR 1992)
    p2mm50: surFraction(brut.p2, ref50), p80um: surFraction(brut.p008, ref50),
  };
  // Fractions sableuse (0,063/2 mm) et graveleuse (2/63 mm), sur la fraction 0/63 mm.
  f.fractionSable = f.p2mm - f.p63um;
  f.fractionGrave = 100 - f.p2mm;
  return f;
}

/**
 * Étalement de la granulométrie au sens du GTR 2024 : étalée si Cu ≥ 6. Sans
 * sédimentométrie, D10 peut manquer quand les fines dépassent 10 % : on
 * regarde alors D60 — au-dessus de 400 µm la courbe est réputée étalée,
 * en dessous Cu est indéterminé et la granulométrie réputée uniforme
 * [GTR 2024 F1 § 2.2.1 e, remarque].
 */
export function etalement({ Cu, D60 }) {
  if (Number.isFinite(Cu)) return { etalee: Cu >= 6, motif: `Cu = ${Cu.toFixed(1).replace(".", ",")} ${Cu >= 6 ? "≥" : "<"} 6` };
  if (Number.isFinite(D60)) return D60 >= 0.4
    ? { etalee: true, motif: "Cu indéterminé (pas de D10), mais D60 ≥ 400 µm : granulométrie réputée étalée" }
    : { etalee: false, motif: "Cu indéterminé et D60 < 400 µm : granulométrie réputée uniforme" };
  return { etalee: null, motif: "Ni Cu ni D60 : l'étalement de la courbe est inconnu" };
}
