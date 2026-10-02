// Traitement des sols à la chaux et aux liants hydrauliques (GTS ; NF EN
// 16907-4) : quantités à épandre, effet de la chaux vive sur la teneur en
// eau, sensibilité au gel des matériaux traités.

import { horsDomaine } from "./outils.js";

/**
 * Quantité de produit à épandre : le dosage est un pourcentage de la masse
 * de sol sec. Pour une couche d'épaisseur e (m) compactée à ρd (Mg/m³) :
 *   q (kg/m²) = d/100 · ρd · 1 000 · e.
 */
export function quantite({ dosage, rhoD, e, surface = 1 }) {
  const q = (dosage / 100) * rhoD * 1000 * e;
  return { q, total: (q * surface) / 1000 }; // kg/m², t
}

/**
 * Chaux vive dans un sol humide. Pour 100 g de sol sec et C g de CaO :
 *  · l'hydratation CaO + H₂O → Ca(OH)₂ consomme 18/56 = 0,32 g d'eau par g de
 *    chaux et ajoute 1,32 g de solide ;
 *  · elle dégage environ 1,16 MJ/kg de CaO ; la part η de cette chaleur qui
 *    vaporise de l'eau (2,26 MJ/kg) en retire 0,51 η g par g de chaux.
 * D'où w' = (w − 0,32 C − 0,51 η C)/(100 + 1,32 C) × 100. On retient
 * couramment qu'1 % de chaux vive fait baisser la teneur en eau d'environ un
 * point : l'aération par le malaxage, par temps sec, s'y ajoute.
 */
export function chauxVive({ w, dosage, eta = 0.5 }) {
  const C = dosage;
  const eauHydratation = 0.321 * C, eauEvaporee = 0.513 * eta * C;
  const wFinal = (100 * (w - eauHydratation - eauEvaporee)) / (100 + 1.321 * C);
  return { wFinal, baisse: w - wFinal, eauHydratation, eauEvaporee, dilution: w - eauHydratation - eauEvaporee - wFinal };
}

/** Dosage de chaux vive pour ramener w à une valeur visée (dichotomie sur chauxVive). */
export function dosagePour({ w, wVise, eta = 0.5 }) {
  if (wVise >= w) return 0;
  let a = 0, b = 15;
  if (chauxVive({ w, dosage: b, eta }).wFinal > wVise) return horsDomaine("Plus de 15 % de chaux : le traitement seul n'y suffit pas.");
  for (let i = 0; i < 60; i++) { const m = (a + b) / 2; if (chauxVive({ w, dosage: m, eta }).wFinal > wVise) a = m; else b = m; }
  return (a + b) / 2;
}

/**
 * Sensibilité au gel d'un matériau d'après la pente p de l'essai de
 * gonflement au gel (NF P98-234-2), en mm/(°C·h)^½ [GTR 2024 F2 annexe 3] :
 * p ≤ 0,05 non gélif SGn ; 0,05 < p ≤ 0,4 peu gélif SGp ; p > 0,4 très gélif SGt.
 */
export function classeGel(p) {
  if (!Number.isFinite(p)) return horsDomaine("Pente de l'essai de gonflement au gel inconnue.");
  return p <= 0.05 ? { classe: "SGn", nom: "non gélif" } : p <= 0.4 ? { classe: "SGp", nom: "peu gélif" } : { classe: "SGt", nom: "très gélif" };
}

/**
 * Pente de gonflement au gel : le gonflement h (mm) croît comme la racine
 * de l'indice de gel cumulé I (°C·h) ; p est la pente de h en fonction de √I,
 * ajustée par les moindres carrés passant par l'origine.
 */
export function penteGel(points) {
  const p = points.filter(([I, h]) => I > 0 && Number.isFinite(h));
  if (!p.length) return NaN;
  const sx2 = p.reduce((s, [I]) => s + I, 0), sxy = p.reduce((s, [I, h]) => s + Math.sqrt(I) * h, 0);
  return sxy / sx2;
}

// ─────────────── Classe mécanique des matériaux traités (couche de forme) ───────────────

/**
 * Frontières inférieures des zones 1 à 5 de l'abaque de classement des
 * matériaux traités aux liants hydrauliques, à 90 jours : résistance en
 * traction directe Rt (MPa) en fonction du module E (MPa), échelles
 * logarithmiques [GTR 2024 F1 figure 12 ; GTR 2000 figure 6]. Courbes
 * numérisées sur l'abaque du GTR 2000 (lecture à ± 5 % environ) ; sous la
 * frontière de la zone 5, le matériau n'est pas classable.
 */
export const FRONTIERES_ZONES = [
  [[1000, 0.426], [2051, 0.83], [2973, 1.07], [4932, 1.38], [10000, 1.87], [19500, 2.36], [38800, 2.84], [50000, 2.98]],
  [[1000, 0.218], [2051, 0.336], [4932, 0.5], [10000, 0.619], [19500, 0.741], [50000, 0.956]],
  [[1000, 0.164], [2051, 0.251], [4932, 0.372], [10000, 0.459], [19500, 0.559], [50000, 0.721]],
  [[1000, 0.129], [2051, 0.189], [4932, 0.272], [10000, 0.34], [19500, 0.41], [50000, 0.55]],
  [[1000, 0.106], [2051, 0.155], [4932, 0.214], [7900, 0.249], [19500, 0.327], [50000, 0.441]],
];

/** Rt d'une frontière à un module E donné, interpolation en log–log (E borné à 1 000–50 000 MPa). */
export function rtFrontiere(courbe, E) {
  const x = Math.log10(Math.min(Math.max(E, courbe[0][0]), courbe[courbe.length - 1][0]));
  for (let i = 1; i < courbe.length; i++) {
    const [E0, R0] = courbe[i - 1], [E1, R1] = courbe[i];
    if (x <= Math.log10(E1) + 1e-12) {
      const t = (x - Math.log10(E0)) / (Math.log10(E1) - Math.log10(E0));
      return 10 ** (Math.log10(R0) + t * (Math.log10(R1) - Math.log10(R0)));
    }
  }
  return NaN;
}

/** Zone (1 à 5) d'un matériau traité d'après E et Rt à 90 jours ; null s'il est sous la zone 5. */
export function zoneMecanique({ E, Rt }) {
  if (!(E > 0 && Rt > 0)) return horsDomaine("E et Rt à 90 jours nécessaires.");
  const k = FRONTIERES_ZONES.findIndex((c) => Rt >= rtFrontiere(c, E));
  return { applicable: true, zone: k < 0 ? null : k + 1, horsAbaque: E < 1000 || E > 50000 };
}

/**
 * Classe mécanique selon le mode de traitement [F1 tableau 14] : en
 * centrale, classe = zone ; en place, le mélange est moins homogène et la
 * classe descend d'un rang (zone 1 → 2 … zone 4 → 5 ; zone 5 en place : non
 * classable). Le GTR 2000 admettait les zones 4 et 5 en place en classe 5.
 */
export function classeMecanique(zone, mode = "centrale") {
  if (!zone) return null;
  if (mode === "centrale") return zone;
  return zone <= 4 ? zone + 1 : null;
}

/**
 * Aptitude d'un sol au traitement (NF P94-100) d'après le gonflement
 * volumique Gv (%) et la résistance en traction indirecte Rtb (MPa)
 * d'éprouvettes immergées : apte si Gv ≤ 5 % et Rtb ≥ 0,2 MPa ; inapte si
 * Gv > 10 % ou Rtb < 0,1 MPa ; douteux entre les deux.
 */
export function aptitudeTraitement({ Gv, Rtb }) {
  if (!Number.isFinite(Gv) || !Number.isFinite(Rtb)) return horsDomaine("Gv et Rtb nécessaires.");
  if (Gv > 10 || Rtb < 0.1) return { applicable: true, verdict: "inapte", motif: Gv > 10 ? "gonflement volumique supérieur à 10 %" : "résistance après immersion inférieure à 0,1 MPa" };
  if (Gv <= 5 && Rtb >= 0.2) return { applicable: true, verdict: "apte", motif: "gonflement ≤ 5 % et résistance ≥ 0,2 MPa" };
  return { applicable: true, verdict: "douteux", motif: Gv > 5 ? "gonflement entre 5 et 10 %" : "résistance entre 0,1 et 0,2 MPa" };
}
