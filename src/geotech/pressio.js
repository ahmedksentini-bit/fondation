// Essai pressiométrique Ménard : du relevé brut aux caractéristiques
// pressiométriques (NF P94-110-1, NF EN ISO 22476-4), puis profil d'un sondage.
//
//  1. étalonnages : dilatation de l'appareillage en tube d'acier (a, Vc, Vs) ;
//     résistance propre de la sonde à l'air libre (pe(V), pel) ;
//  2. corrections de chaque palier : V = Vr − a·pr et p = pr + ph − pe(V),
//     ph = γw (hc + z) étant la colonne d'eau entre le manomètre et la sonde ;
//  3. courbe pressiométrique corrigée V60(p) et courbe de fluage V60 − V30 ;
//  4. phase pseudo-élastique [p1, p2] → module EM = 2(1 + ν)(Vs + Vm) Δp/ΔV ;
//  5. pression de fluage pf à la cassure de la courbe de fluage ;
//  6. pression limite conventionnelle pl : volume injecté Vl = Vs + 2V1 (la
//     cavité a doublé de volume depuis le contact) ; si l'essai ne l'atteint
//     pas, extrapolation par l'inverse du volume et par l'hyperbole, on retient
//     la plus faible, et l'écart doit rester sous 20 % ;
//  7. pressions nettes pl* = pl − p0, pf* = pf − p0, p0 = K0 σ'v0 + u0.
//
// Unités propres à l'essai : pressions en MPa, volumes en cm³, profondeurs en m ;
// σ'v0 et u0 en kPa comme dans les autres solveurs. γw = 9,81 kN/m³ pour les
// corrections de mesure.

import { horsDomaine } from "./outils.js";

export const NU = 0.33;
export const GAMMA_W_ESSAI = 9.81; // kN/m³

/** Régression linéaire y = a + b·x par moindres carrés, sur des couples [x, y]. */
export function regression(points) {
  const n = points.length;
  if (n < 2) return { a: NaN, b: NaN, r2: NaN, n };
  const mx = points.reduce((s, [x]) => s + x, 0) / n;
  const my = points.reduce((s, [, y]) => s + y, 0) / n;
  let sxx = 0, sxy = 0, syy = 0;
  for (const [x, y] of points) { sxx += (x - mx) ** 2; sxy += (x - mx) * (y - my); syy += (y - my) ** 2; }
  const b = sxy / sxx, a = my - b * mx;
  return { a, b, r2: syy > 0 ? (sxy * sxy) / (sxx * syy) : 1, n };
}

/** Colonne d'eau (MPa) entre le manomètre du CPV, à hc au-dessus du sol, et la sonde à la profondeur z. */
export const pressionHydrostatique = (z, hc = 0, gammaW = GAMMA_W_ESSAI) => (gammaW / 1000) * (z + hc);

// ───────────────────────────── Étalonnages ────────────────────────────────

/**
 * Dilatation de l'appareillage (sonde gonflée dans un tube d'acier) : une fois
 * la sonde plaquée contre le tube, V = Vc + a·p. On ajuste cette droite sur les
 * paliers de pression au moins égale à `pmin` (par défaut, la seconde moitié).
 * a (cm³/MPa) : dilatation des tubulures et écrasement des gaines ;
 * Vc (cm³) : volume injecté pour atteindre le tube ; si le diamètre intérieur
 * du tube di et la longueur de la cellule ls sont donnés (mm),
 * Vs = π di² ls/4 − Vc est le volume de la cellule centrale au repos.
 */
export function calibrageAppareil(points, { pmin = null, di = null, ls = null } = {}) {
  const pts = points.filter((q) => Number.isFinite(q.p) && Number.isFinite(q.V)).sort((x, y) => x.p - y.p);
  if (pts.length < 3) return horsDomaine("il faut au moins trois paliers de calibrage", { a: 0 });
  const seuil = pmin ?? pts[Math.floor(pts.length / 2)].p;
  const droite = pts.filter((q) => q.p >= seuil - 1e-12);
  if (droite.length < 2) return horsDomaine("pas assez de paliers sur la partie droite", { a: 0 });
  const r = regression(droite.map((q) => [q.p, q.V]));
  const Vtube = di > 0 && ls > 0 ? (Math.PI * (di / 10) ** 2 * (ls / 10)) / 4 : null;
  return {
    applicable: true, a: r.b, Vc: r.a, r2: r.r2, points: droite.length, pmin: seuil,
    Vtube, Vs: Vtube ? Vtube - r.a : null,
  };
}

/**
 * Résistance propre de la sonde (étalonnage à l'air libre) : pression pe(V)
 * nécessaire pour gonfler la sonde seule. points [{ p, V }] lus au CPV (V à
 * 60 s) ; dz = dénivelé du manomètre au-dessus du centre de la sonde (m) :
 * pe = pr + γw·dz. Renvoie pe(V), interpolée entre les points (origine
 * comprise) et prolongée par la pente finale ; pel = pe(1,2·Vs) si Vs est donné.
 */
export function etalonnageSonde(points, { dz = 0, Vs = null, gammaW = GAMMA_W_ESSAI } = {}) {
  const table = points
    .filter((q) => Number.isFinite(q.p) && Number.isFinite(q.V))
    .map((q) => [q.V, q.p + (gammaW / 1000) * dz])
    .sort((a, b) => a[0] - b[0]);
  if (!table.length) return { applicable: false, motif: "aucun point d'étalonnage", pe: () => 0, table };
  if (table[0][0] > 0) table.unshift([0, 0]);
  const pe = (V) => {
    let i = 1;
    while (i < table.length - 1 && V > table[i][0]) i++;
    const [x0, y0] = table[i - 1], [x1, y1] = table[i];
    return Math.max(0, y0 + ((y1 - y0) * (V - x0)) / (x1 - x0));
  };
  return { applicable: true, pe, table, Vmax: table[table.length - 1][0], pel: Vs ? pe(1.2 * Vs) : null };
}

// ───────────────────────────── Corrections ────────────────────────────────

/**
 * Corrections d'un essai. paliers : [{ p (lecture CPV, MPa), V15?, V30, V60 }]
 * en cm³ lus au CPV. Renvoie la courbe corrigée dans l'ordre des paliers :
 * [{ n, pr, ph, pe, p, V, V30, fluage }], avec V = Vr60 − a·pr (lecture de
 * pression, pas pression corrigée) et p = pr + ph − pe(V) (pe au volume corrigé).
 */
export function corrigerEssai(paliers, { z, hc = 0, pe = () => 0, a = 0, gammaW = GAMMA_W_ESSAI }) {
  const ph = pressionHydrostatique(z, hc, gammaW);
  return paliers
    .filter((q) => Number.isFinite(q.p) && Number.isFinite(q.V60))
    .map((q, i) => {
      const V = q.V60 - a * q.p;
      const V30 = Number.isFinite(q.V30) ? q.V30 - a * q.p : NaN;
      const pE = pe(V);
      return { n: i + 1, pr: q.p, ph, pe: pE, p: q.p + ph - pE, V, V60: V, V30, fluage: Number.isFinite(q.V30) ? q.V60 - q.V30 : NaN };
    });
}

/** Pentes ΔV/Δp entre paliers successifs (cm³/MPa). */
export const pentes = (c) => c.slice(1).map((q, i) => (q.V - c[i].V) / (q.p - c[i].p));

// ─────────────────────────── Phase pseudo-élastique ───────────────────────

/**
 * Phase pseudo-élastique : paliers consécutifs où la courbe est la plus raide
 * en pression (ΔV/Δp minimal et presque constant), au moins trois paliers.
 * Détection : on part du segment de pente minimale (hors mise en contact) et
 * on l'étend tant que les pentes voisines restent à moins de 10 % du minimum,
 * en relâchant la tolérance si la plage n'a que deux paliers. i1, i2 imposés :
 * choix de l'opérateur (indices de la courbe, 0 = premier palier).
 */
export function phasePseudoElastique(courbe, { i1 = null, i2 = null } = {}) {
  const n = courbe.length;
  if (n < 4) return horsDomaine("il faut au moins quatre paliers");
  let d, f, auto = true;
  if (Number.isInteger(i1) && Number.isInteger(i2) && i2 > i1 && i1 >= 0 && i2 < n) {
    d = i1; f = i2; auto = false;
  } else {
    const s = pentes(courbe);
    let k = 1;
    for (let j = 1; j < s.length; j++) if (s[j] > 0 && (s[j] < s[k] || !(s[k] > 0))) k = j;
    for (const tol of [0.1, 0.15, 0.2, 0.3, 0.45]) {
      d = k; f = k + 1;
      while (d - 1 >= 1 && s[d - 1] > 0 && s[d - 1] <= s[k] * (1 + tol)) d--;
      while (f < n - 1 && s[f] > 0 && s[f] <= s[k] * (1 + tol)) f++;
      if (f - d >= 2) break;
    }
  }
  const q1 = courbe[d], q2 = courbe[f];
  return { applicable: true, auto, i1: d, i2: f, p1: q1.p, V1: q1.V, p2: q2.p, V2: q2.V, nPoints: f - d + 1 };
}

/** Module pressiométrique Ménard : EM = 2(1 + ν)(Vs + Vm)·Δp/ΔV, Vm = (V1 + V2)/2. MPa. */
export function moduleMenard({ Vs, p1, V1, p2, V2, nu = NU }) {
  const Vm = (V1 + V2) / 2;
  const K = 2 * (1 + nu);
  const EM = (K * (Vs + Vm) * (p2 - p1)) / (V2 - V1);
  return { EM, Vm, K, G: EM / K };
}

/**
 * Pression de fluage : cassure de la courbe de fluage ΔV60/30(p). Droite du
 * palier bas sur la phase pseudo-élastique, droite de la branche montante sur
 * les `nMontee` premiers paliers qui suivent ; pf est leur intersection.
 * Faute de deux paliers après la phase, pf = p2.
 */
export function pressionFluage(courbe, phase, { nMontee = 3 } = {}) {
  const plateau = courbe.slice(phase.i1, phase.i2 + 1).filter((q) => Number.isFinite(q.fluage));
  const montee = courbe.slice(phase.i2 + 1, phase.i2 + 1 + nMontee).filter((q) => Number.isFinite(q.fluage));
  const repli = (motif) => ({ pf: phase.p2, methode: "fin de la phase pseudo-élastique", motif });
  if (plateau.length < 2 || montee.length < 2) return repli("pas assez de paliers après la phase pseudo-élastique");
  const bas = regression(plateau.map((q) => [q.p, q.fluage]));
  const haut = regression(montee.map((q) => [q.p, q.fluage]));
  const pf = (bas.a - haut.a) / (haut.b - bas.b);
  if (!(haut.b > bas.b) || !(pf >= phase.p1 && pf <= montee[montee.length - 1].p)) return { ...repli("les deux droites ne se coupent pas dans l'essai"), bas, haut };
  return { pf, methode: "intersection des droites de fluage", bas, haut, montee: montee.map((q) => q.n) };
}

// ───────────────────────────── Pression limite ────────────────────────────

/** Méthode de l'inverse du volume : 1/V = A·p + B sur les paliers plastiques ; pl = (1/Vl − B)/A. */
export function extrapolationInverse(points, Vl) {
  const r = regression(points.map((q) => [q.p, 1 / q.V]));
  if (!(r.b < 0)) return horsDomaine("1/V ne décroît pas avec p");
  return { applicable: true, pl: (1 / Vl - r.a) / r.b, pInfini: -r.a / r.b, A: r.b, B: r.a, r2: r.r2 };
}

/**
 * Méthode hyperbolique : X = (V² − V1²)/(p − p1), Y = (p V² − p1 V1²)/(p − p1),
 * Y = C·X − D ; la courbe p = [p1(V1² + D) + C(V² − V1²)]/(V² + D) passe par
 * (p1, V1) et tend vers C (pression limite théorique).
 */
export function extrapolationHyperbolique(points, { p1, V1, Vl }) {
  const xy = points.filter((q) => q.p > p1).map((q) => [(q.V * q.V - V1 * V1) / (q.p - p1), (q.p * q.V * q.V - p1 * V1 * V1) / (q.p - p1)]);
  if (xy.length < 2) return horsDomaine("pas assez de paliers pour l'hyperbole");
  const r = regression(xy);
  const C = r.b, D = -r.a;
  const pl = (p1 * (V1 * V1 + D) + C * (Vl * Vl - V1 * V1)) / (Vl * Vl + D);
  return { applicable: Number.isFinite(pl), pl, C, D, r2: r.r2, courbe: (V) => (p1 * (V1 * V1 + D) + C * (V * V - V1 * V1)) / (V * V + D) };
}

/**
 * Pression limite conventionnelle. Lue sur la courbe (interpolation linéaire)
 * quand le volume Vl = Vs + 2V1 est atteint ; sinon extrapolée sur les paliers
 * au-delà de pf par les deux méthodes : on retient la plus faible, et l'essai
 * ne donne pas pl si elles s'écartent de plus de 20 % (de la valeur hyperbolique).
 */
export function pressionLimite(courbe, { Vs, V1, p1, pf }) {
  const Vl = Vs + 2 * V1;
  for (let i = 1; i < courbe.length; i++) {
    const q0 = courbe[i - 1], q1 = courbe[i];
    if (q1.V >= Vl && q0.V < Vl) {
      const pl = q0.p + ((q1.p - q0.p) * (Vl - q0.V)) / (q1.V - q0.V);
      return { applicable: true, pl, Vl, extrapolee: false, methode: "lue sur la courbe", entre: [q0.n, q1.n] };
    }
  }
  const plast = courbe.filter((q) => q.p > pf + 1e-9);
  if (plast.length < 2) return horsDomaine("moins de deux paliers au-delà de pf : pl ne s'extrapole pas", { Vl });
  const inv = extrapolationInverse(plast, Vl);
  const hyp = extrapolationHyperbolique(plast, { p1, V1, Vl });
  const valeurs = [inv, hyp].filter((m) => m.applicable && m.pl > 0);
  if (!valeurs.length) return horsDomaine("aucune extrapolation possible", { Vl, inverse: inv, hyperbole: hyp });
  const pl = Math.min(...valeurs.map((m) => m.pl));
  const ecart = inv.applicable && hyp.applicable ? Math.abs(inv.pl - hyp.pl) / hyp.pl : null;
  const dernier = courbe[courbe.length - 1];
  const base = {
    Vl, extrapolee: true, inverse: inv, hyperbole: hyp, ecart, points: plast.map((q) => q.n),
    methode: pl === hyp.pl ? "extrapolation hyperbolique (la plus faible)" : "extrapolation par l'inverse du volume (la plus faible)",
    peuDePoints: plast.length < 3, lointaine: dernier.V < Vs + V1, pMax: dernier.p,
  };
  if (ecart !== null && ecart > 0.2) return { ...horsDomaine(`les deux extrapolations s'écartent de ${(100 * ecart).toFixed(0)} % (> 20 %) : l'essai ne donne pas pl`), ...base, pl: NaN };
  return { applicable: true, pl, ...base };
}

// ────────────────────────── Pressions nettes et synthèse ───────────────────

/** Contraintes au niveau de l'essai : γ au-dessus de la nappe, γsat dessous. kPa. */
export function contraintesEssai({ z, zw = Infinity, gamma = 18, gammaSat = null, gammaW = GAMMA_W_ESSAI }) {
  const hSec = Math.min(z, zw), hSat = Math.max(0, z - zw);
  const sigmaV = gamma * hSec + (gammaSat ?? gamma) * hSat;
  const u = gammaW * hSat;
  return { sigmaV, u, sigmaVeff: sigmaV - u };
}

/** Contrainte horizontale totale au repos p0 = K0·σ'v0 + u0, en MPa (σ'v0 et u0 en kPa). */
export const pressionRepos = ({ sigmaVeff, u = 0, K0 = 0.5 }) => (K0 * sigmaVeff + u) / 1000;

/**
 * Dépouillement complet d'un essai. Entrées :
 *  paliers [{ p, V15?, V30, V60 }] (lectures brutes), Vs (cm³), z et hc (m),
 *  pe(V) (étalonnage), a (cm³/MPa), sol { zw, gamma, gammaSat, K0 },
 *  choix { i1, i2 } de l'opérateur pour la phase pseudo-élastique.
 */
export function depouiller({ paliers, Vs, z, hc = 0, pe = () => 0, a = 0, sol = {}, choix = {}, pel = null, gammaW = GAMMA_W_ESSAI }) {
  const courbe = corrigerEssai(paliers, { z, hc, pe, a, gammaW });
  if (courbe.length < 4) return horsDomaine("il faut au moins quatre paliers exploitables", { courbe });
  const phase = phasePseudoElastique(courbe, choix);
  if (!phase.applicable) return { ...phase, courbe };
  const { EM, Vm, G } = moduleMenard({ Vs, ...phase });
  const fl = pressionFluage(courbe, phase);
  const lim = pressionLimite(courbe, { Vs, V1: phase.V1, p1: phase.p1, pf: fl.pf });
  const c = contraintesEssai({ z, zw: sol.zw ?? Infinity, gamma: sol.gamma ?? 18, gammaSat: sol.gammaSat ?? null, gammaW });
  const p0 = pressionRepos({ sigmaVeff: c.sigmaVeff, u: c.u, K0: sol.K0 ?? 0.5 });
  const pl = lim.applicable ? lim.pl : NaN;
  const plNette = pl - p0, pfNette = fl.pf - p0;
  const avert = [];
  if (courbe.length < 8) avert.push(`${courbe.length} paliers seulement (8 au moins, 10 de préférence)`);
  if (phase.nPoints < 3) avert.push("phase pseudo-élastique sur deux paliers : EM est peu sûr");
  if (phase.p2 > fl.pf + 1e-9) avert.push("p2 dépasse pf : la plage de EM empiète sur la phase plastique");
  if (phase.V1 > 0.5 * Vs) avert.push("V1 élevé : forage trop large ou paroi remaniée");
  if (courbe.some((q, i) => i && q.p < courbe[i - 1].p)) avert.push("la pression corrigée décroît entre deux paliers");
  if (courbe.some((q) => q.fluage < 0)) avert.push("fluage négatif sur un palier : lecture à vérifier");
  const apres = courbe.filter((q) => q.p > fl.pf).length;
  if (apres < 3 && lim.extrapolee) avert.push("moins de trois paliers au-delà de pf : extrapolation fragile");
  if (lim.lointaine) avert.push("le dernier volume n'atteint pas Vs + V1 : extrapolation lointaine");
  if (pel && Number.isFinite(pl) && pel > 0.2 * pl) avert.push("la résistance propre de la sonde n'est pas négligeable devant pl");
  if (Number.isFinite(pl) && (pl / fl.pf < 1.2 || pl / fl.pf > 3.5)) avert.push(`pl/pf = ${(pl / fl.pf).toFixed(2)}, hors de la fourchette usuelle (1,5 à 3)`);
  return {
    applicable: true, courbe, phase, EM, G, Vm, pf: fl.pf, fluage: fl, limite: lim, pl, contraintes: c, p0,
    plNette, pfNette, rapport: EM / plNette, rapportLimFluage: pl / fl.pf, avertissements: avert,
  };
}

// ────────────────────────── Essais synthétiques ──────────────────────────

/**
 * Relevés bruts d'un essai fictif mais cohérent, pour les exemples et les
 * exercices. Le sol est décrit par p0, pf, pl, EM ; la sonde par Vs et le
 * volume V1 au début de la phase pseudo-élastique ; l'appareil par pe(V), a et
 * hc. La courbe « vraie » suit trois phases : remise en contact (pente
 * décroissante), pseudo-élastique (droite qui redonne EM), plastique (volume
 * Vs + 2V1 atteint à pl). On lit ensuite le CPV : pr = p − ph + pe(V),
 * Vr = V + a·pr. alea : fonction () → [0, 1) pour un léger bruit de lecture.
 */
export function essaiSynthetique({
  Vs = 535, V1 = 140, p1 = null, p0, pf, pl, EM, z, hc = 1, pe = () => 0, a = 0, dp = null,
  vMax = 750, fluageE = 2, alea = null, bruit = 0, gammaW = GAMMA_W_ESSAI,
}) {
  const K = 2 * (1 + NU);
  const pa = p1 ?? Math.max(1.2 * p0, 0.05);
  const dpe = pf - pa;
  const se = (K * (Vs + V1)) / (EM - (K * dpe) / 2);
  const V2 = V1 + se * dpe;
  const VL = Vs + 2 * V1;
  // Plastique : V = Vlin + Vd·[1/(1 − x) − 1 − x], x = (p − pf)/(pu − pf) — raccord lisse en pf.
  const pu = pl + 0.55 * (pl - pf);
  const g = (x) => 1 / (1 - x) - 1 - x;
  const Vlin = (p) => V1 + se * (p - pa);
  const Vd = (VL - Vlin(pl)) / g((pl - pf) / (pu - pf));
  // Remise en contact : pente de s0 (à p = 0) à se (à p1), V(0) = 0.
  const s0 = (3 * (V1 - se * pa)) / pa + se;
  const vrai = (p) => {
    if (p <= pa) return se * p + ((s0 - se) * pa * (1 - (1 - p / pa) ** 3)) / 3;
    if (p <= pf) return Vlin(p);
    return Vlin(p) + Vd * g(Math.min((p - pf) / (pu - pf), 0.97));
  };
  // Fluage : plus fort à la mise en contact, faible et constant ensuite, puis
  // croissant linéairement au-delà de pf (les deux droites se coupent en pf).
  const fluage = (p) => (p <= pa ? fluageE * (2.2 - 1.2 * p / pa) : p <= pf ? fluageE : fluageE * (1 + 6 * (p - pf) / (pl - pf)));
  const ph = pressionHydrostatique(z, hc, gammaW);
  const pas = dp ?? Math.max(0.05, Math.round((pl / 10) * 40) / 40);
  const bruiter = (x, amp) => (alea ? x + (alea() - 0.5) * 2 * amp * bruit : x);
  const paliers = [];
  for (let k = 1; k <= 24; k++) {
    const pVise = k * pas;
    const V = vrai(pVise);
    const pr = pVise - ph + pe(V);
    if (pr <= 0) continue;
    const V60 = bruiter(V + a * pr, 1.5);
    // Réservoir du CPV épuisé ou sol en rupture : l'essai s'arrête là.
    if (V60 > vMax || pVise > pu * 0.985) break;
    const f = fluage(pVise);
    paliers.push({ p: Math.round(pr * 1000) / 1000, V15: Math.round(V60 - 1.6 * f), V30: Math.round(V60 - f), V60: Math.round(V60) });
  }
  return { paliers, vrai: { V1, p1: pa, V2, pf, pl, EM, se, VL, pu }, ph };
}
