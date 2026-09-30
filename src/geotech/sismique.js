// Portance sismique d'une semelle filante — NF EN 1998-5, annexe F
// (informative), avec les précisions de la NF P94-261 rapportées par le guide
// Cerema (chapitre 1, § 5) : γR;v = 1,4 et coefficient de modèle 1,2 pour les
// méthodes pressiométrique et pénétrométrique, Nmax calculé pour D = 0 ; avec
// c et φ, coefficients γM = 1,4 (cu) ou 1,25 (tanφ') et γRd du tableau F.2.
//
// Semelle filante posée sur un sol homogène ; efforts par mètre (kN/m, kN·m/m).
// Accélérations exprimées en fraction de g : αg = ag/g = γI agR/g.

import { RAD, horsDomaine, dichotomie } from "./outils.js";

/** Paramètres du tableau F.1. */
export const PARAMETRES_F1 = {
  coherent: { a: 0.70, b: 1.29, c: 2.14, d: 1.81, e: 0.21, f: 0.44, m: 0.21, k: 1.22, kp: 1.00, cT: 2.00, cM: 2.00, cMp: 1.00, beta: 2.57, gamma: 1.85 },
  frottant: { a: 0.92, b: 1.25, c: 0.92, d: 1.25, e: 0.41, f: 0.32, m: 0.96, k: 1.00, kp: 0.39, cT: 1.14, cM: 1.01, cMp: 1.01, beta: 2.90, gamma: 2.80 },
};

/** Coefficient de modèle γRd, tableau F.2. */
export const GAMMA_RD_F2 = {
  "sable-dense": { nom: "sable moyennement dense à dense", valeur: 1.00 },
  "sable-lache-sec": { nom: "sable lâche sec", valeur: 1.15 },
  "sable-lache-sature": { nom: "sable lâche saturé", valeur: 1.50 },
  "argile-non-sensible": { nom: "argile non sensible", valeur: 1.00 },
  "argile-sensible": { nom: "argile sensible", valeur: 1.15 },
};

/** Nmax d'un sol purement cohérent : (π + 2) c̄ B / γM (kN/m). */
export function nmaxCoherent({ cu, B, gammaM = 1.4 }) {
  return (Math.PI + 2) * (cu / gammaM) * B;
}

/**
 * Nmax d'un sol purement frottant : ½ γ (1 ∓ av/g) B² Nγ, Nγ = 2 (Nq − 1) tanφ'd
 * avec tanφ'd = tanφ'/γφ'. On retient par défaut le signe défavorable (1 − av/g).
 */
export function nmaxFrottant({ gamma, B, phi, gammaPhi = 1.25, avg = 0, signe = -1 }) {
  const t = Math.tan(phi * RAD) / gammaPhi;
  const phiD = Math.atan(t) / RAD;
  const Nq = Math.exp(Math.PI * t) * Math.tan((45 + phiD / 2) * RAD) ** 2;
  const Ngamma = 2 * (Nq - 1) * t;
  return { Nmax: 0.5 * gamma * (1 + signe * avg) * B * B * Ngamma, Ngamma, phiD };
}

/** Force d'inertie du sol adimensionnelle F̄ (F.2 et F.3). */
export function inertieSol({ sol, gamma, alphaG, S = 1, B, cu, gammaM = 1.4, phiD }) {
  if (sol === "coherent") return (gamma * alphaG * S * B) / (cu / gammaM);
  return alphaG / Math.tan(phiD * RAD);
}

/** Membre de gauche de l'inégalité F.1 (≤ 0 si la portance est assurée). */
export function critereF1(p, { Nb, Vb, Mb, Fb }) {
  const lim = (1 - p.m * Fb ** p.k) ** p.kp;
  const ecart = lim - Nb;
  const t1 = ((1 - p.e * Fb) ** p.cT * (p.beta * Math.abs(Vb)) ** p.cT) / (Nb ** p.a * ecart ** p.b);
  const t2 = ((1 - p.f * Fb) ** p.cMp * (p.gamma * Math.abs(Mb)) ** p.cM) / (Nb ** p.c * ecart ** p.d);
  return { valeur: t1 + t2 - 1, t1, t2, lim };
}

/**
 * Vérification complète. N, V, M : efforts de calcul sismiques à la base
 * (kN/m, kN·m/m) ; Nmax (kN/m) ; Fb : inertie du sol ; gammaRd.
 */
export function portanceSismique({ sol, N, V = 0, M = 0, B, Nmax, Fb, gammaRd = 1 }) {
  const p = PARAMETRES_F1[sol];
  if (!p) return horsDomaine(`sol « ${sol} » : l'annexe F ne traite que les sols purement cohérents ou purement frottants`);
  const Nb = (gammaRd * N) / Nmax, Vb = (gammaRd * V) / Nmax, Mb = (gammaRd * M) / (B * Nmax);
  const lim = (1 - p.m * Fb ** p.k) ** p.kp;
  if (!(lim > 0)) return horsDomaine("F̄ trop grand : le sol ne porte plus sa propre inertie (1 − m F̄^k ≤ 0)", { Nb, Vb, Mb, Fb, lim });
  const cN = Nb > 0 && Nb <= lim, cV = Math.abs(Vb) <= 1;
  const crit = cN ? critereF1(p, { Nb, Vb, Mb, Fb }) : { valeur: Infinity, t1: NaN, t2: NaN, lim };
  return { applicable: true, Nb, Vb, Mb, Fb, lim, conditionN: cN, conditionV: cV, ...crit, ok: cN && cV && crit.valeur <= 0 };
}

/**
 * Coupe de la surface limite dans le plan (N̄, M̄) pour V̄ et F̄ donnés : pour
 * chaque N̄, le moment M̄ qui annule le critère. Sert aux figures.
 */
export function coupeSurfaceLimite({ sol, Fb, Vb = 0, n = 60 }) {
  const p = PARAMETRES_F1[sol];
  const lim = (1 - p.m * Fb ** p.k) ** p.kp;
  const pts = [];
  for (let i = 1; i < n; i++) {
    const Nb = (lim * i) / n;
    const f0 = critereF1(p, { Nb, Vb, Mb: 0, Fb }).valeur;
    if (f0 > 0) { pts.push([Nb, 0]); continue; }
    const Mb = dichotomie((m) => critereF1(p, { Nb, Vb, Mb: m, Fb }).valeur, 0, 1, 60);
    pts.push([Nb, Mb]);
  }
  return { lim, points: [[0, 0], ...pts, [lim, 0]] };
}
