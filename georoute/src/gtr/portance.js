// Portance des sols et des plateformes : poinçonnement IPI et CBR, essai de
// plaque (EV1, EV2), dynaplaque, classes d'arase et de plateforme, modèle
// bicouche d'une couche de forme sur son arase.

import { horsDomaine, interpoler } from "./outils.js";

// ───────────────────────────── IPI et CBR ─────────────────────────────

/**
 * Forces de référence du poinçonnement (NF EN 13286-47) : le piston de
 * 19,3 cm² enfoncé à 1,27 mm/min dans un matériau de référence demande
 * 13,35 kN à 2,5 mm et 20 kN à 5 mm. L'indice est le plus grand des deux
 * rapports, en %.
 */
export const REFERENCE_CBR = { 2.5: 13.35, 5: 20 };

/**
 * Indice portant d'une courbe force–enfoncement [(mm, kN)]. Si la courbe
 * commence concave (mauvaise mise en contact), l'origine est corrigée : on
 * prolonge la tangente au point de plus forte pente jusqu'à F = 0 et l'on
 * décale les enfoncements d'autant.
 */
export function indicePortant(points, { corriger = true } = {}) {
  const p = points.filter(([s, F]) => Number.isFinite(s) && Number.isFinite(F)).sort((a, b) => a[0] - b[0]);
  if (p.length < 3) return horsDomaine("Il faut la courbe force–enfoncement jusqu'à 5 mm au moins.");
  let decalage = 0;
  if (corriger) {
    let kMax = 0, iMax = 0;
    for (let i = 1; i < p.length; i++) {
      const k = (p[i][1] - p[i - 1][1]) / (p[i][0] - p[i - 1][0]);
      if (k > kMax) { kMax = k; iMax = i; }
    }
    // Tangente au milieu du segment le plus raide ; on ne corrige que si la
    // courbe était concave avant lui (pente initiale plus faible).
    const k0 = (p[1][1] - p[0][1]) / (p[1][0] - p[0][0]);
    if (iMax > 1 && kMax > 1.25 * k0) {
      const [s0, F0] = p[iMax - 1], [s1, F1] = p[iMax];
      const sm = (s0 + s1) / 2, Fm = (F0 + F1) / 2;
      decalage = Math.max(0, sm - Fm / kMax);
    }
  }
  const lu = (s) => interpoler(p, s + decalage);
  const F25 = lu(2.5), F5 = lu(5);
  if (p[p.length - 1][0] < 5 + decalage) return horsDomaine("La courbe s'arrête avant 5 mm d'enfoncement (corrigé).");
  const i25 = (100 * F25) / REFERENCE_CBR[2.5], i5 = (100 * F5) / REFERENCE_CBR[5];
  return { applicable: true, F25, F5, i25, i5, indice: Math.max(i25, i5), decalage, retenu: i5 > i25 ? "5 mm" : "2,5 mm" };
}

/** Gonflement linéaire après immersion (%) : Δh/h0. */
export const gonflement = ({ dh, h0 = 120 }) => (100 * dh) / h0;

// ───────────────────────────── Essai de plaque ─────────────────────────────

/**
 * Essai de plaque (NF P94-117-1), plaque rigide de 600 mm : EV = 1,5 q a / w
 * (q MPa, a = 300 mm, w mm). Premier cycle jusqu'à 0,25 MPa, second jusqu'à
 * 0,20 MPa : EV1 = 112,5/z1 et EV2 = 90/z2, z en mm. Le rapport
 * k = EV2/EV1 renseigne sur le compactage.
 */
export function plaque({ z1, z2, a = 300, q1 = 0.25, q2 = 0.2 }) {
  if (!(z1 > 0 && z2 > 0)) return horsDomaine("Les deux enfoncements doivent être positifs.");
  const EV1 = (1.5 * q1 * a) / z1, EV2 = (1.5 * q2 * a) / z2;
  return { applicable: true, EV1, EV2, k: EV2 / EV1 };
}

/**
 * Lecture du rapport k = EV2/EV1 (repère usuel) : jusqu'à 2, le matériau
 * est réputé bien compacté ; au-delà, le premier cycle a encore beaucoup
 * serré le sol, signe d'un compactage insuffisant.
 */
export function jugerK({ k }) {
  if (!Number.isFinite(k)) return "—";
  return k <= 2 ? "bon compactage (k ≤ 2)" : "compactage insuffisant (k > 2) : le premier chargement a encore serré le sol";
}

/**
 * Dynaplaque (NF P94-117-2) : la chute d'une masse sur une plaque de 300 mm
 * (rayon a = 150 mm) produit un enfoncement élastique s (mm) sous la
 * contrainte σ (MPa) : module dynamique Evd = 1,5 σ a / s. Avec σ = 0,1 MPa,
 * Evd = 22,5/s. La correspondance avec EV2 dépend des matériaux : elle
 * s'établit par planche d'étalonnage.
 */
export function dynaplaque({ enfoncements, sigma = 0.1, a = 150 }) {
  const s = enfoncements.filter((x) => x > 0);
  if (!s.length) return horsDomaine("Aucun enfoncement mesuré.");
  const moy = s.reduce((x, y) => x + y, 0) / s.length;
  return { applicable: true, sMoyen: moy, Evd: (1.5 * sigma * a) / moy };
}

// ───────────────────────── Classes d'arase et de plateforme ─────────────────

/**
 * Classes de portance à long terme : arase de terrassement ARi et
 * plateforme support de chaussée PFi (modules EV2 en MPa). La classe PF2qs
 * (80 à 120 MPa) découpe l'ancienne PF2 (NF P98-086 ; GTR 2024 F1 § 4.3.4).
 */
export const CLASSES_AR = [
  { classe: "AR0", min: 0, max: 20 }, { classe: "AR1", min: 20, max: 50 }, { classe: "AR2", min: 50, max: 120 },
  { classe: "AR3", min: 120, max: 200 }, { classe: "AR4", min: 200, max: Infinity },
];
export const CLASSES_PF = [
  { classe: "PF1", min: 20, max: 50 }, { classe: "PF2", min: 50, max: 80 }, { classe: "PF2qs", min: 80, max: 120 },
  { classe: "PF3", min: 120, max: 200 }, { classe: "PF4", min: 200, max: Infinity },
];
const classeDe = (table, E) => (Number.isFinite(E) ? [...table].reverse().find((c) => E >= c.min) ?? null : null);
export const classeArase = (EV2) => classeDe(CLASSES_AR, EV2)?.classe ?? (EV2 < 20 ? "AR0" : "—");
export const classePlateforme = (EV2) => classeDe(CLASSES_PF, EV2)?.classe ?? (EV2 < 20 ? "hors classe (< 20 MPa)" : "—");

// ──────────────────────────── Modèle bicouche ─────────────────────────────

/**
 * Module de surface d'une couche d'épaisseur h (m) et de module E1 posée
 * sur un support de module E2, chargée par une plaque de rayon a (m) :
 * méthode des épaisseurs équivalentes d'Odemark, he = 0,9 h (E1/E2)^(1/3),
 * puis la déflexion de Boussinesq des deux milieux :
 *   1/Es = (1 − f)/E1 + f/E2,  f = 1/√(1 + (he/a)²).
 * C'est un modèle d'enseignement : il montre pourquoi l'épaisseur de couche
 * de forme compte, sans remplacer les tableaux du guide.
 */
export function bicouche({ E1, E2, h, a = 0.3 }) {
  if (!(E1 > 0 && E2 > 0 && h >= 0)) return horsDomaine("Modules positifs et épaisseur positive ou nulle.");
  const he = 0.9 * h * Math.cbrt(E1 / E2);
  const f = 1 / Math.sqrt(1 + (he / a) ** 2);
  const Es = 1 / ((1 - f) / E1 + f / E2);
  return { applicable: true, he, f, Es };
}

/** Épaisseur de couche (m) qui porte le module de surface à E visé, par dichotomie. */
export function epaisseurPour({ E1, E2, Evise, a = 0.3, hMax = 2 }) {
  if (Evise <= E2) return 0;
  if (Evise >= E1) return Infinity;
  let lo = 0, hi = hMax;
  if (bicouche({ E1, E2, h: hi, a }).Es < Evise) return Infinity;
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2;
    if (bicouche({ E1, E2, h: m, a }).Es < Evise) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}
