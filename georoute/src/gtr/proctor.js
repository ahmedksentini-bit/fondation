// Essai Proctor (NF EN 13286-2) : masses volumiques sèches des points,
// optimum par une parabole ajustée autour du sommet, courbes de saturation
// et énergies de compactage.

import { horsDomaine, parabole, RHO_W, G } from "./outils.js";

/**
 * Moules et dames de la NF EN 13286-2 : moule A (Ø 100 mm, h 120 mm) pour
 * les sols dont D ≤ 20 mm, moule B (Ø 150 mm, h 120 mm, celui de l'IPI et du
 * CBR) jusqu'à 31,5 mm.
 */
export const MOULES = {
  A: { nom: "moule A (Proctor)", D: 100, H: 120 }, // mm
  B: { nom: "moule B (CBR)", D: 150, H: 120 },
};
export const DAMES = {
  normal: { nom: "Proctor normal", masse: 2.5, chute: 0.305, couches: 3, coups: { A: 25, B: 56 } },
  modifie: { nom: "Proctor modifié", masse: 4.5, chute: 0.457, couches: 5, coups: { A: 25, B: 56 } },
};

/** Volume d'un moule (cm³). */
export const volumeMoule = ({ D, H }) => (Math.PI * (D / 20) ** 2 * H) / 10;

/** Énergie de compactage par unité de volume (kJ/m³) : n couches × N coups × m g h / V. */
export function energie(dame = "normal", moule = "A") {
  const d = DAMES[dame], m = MOULES[moule];
  const V = volumeMoule(m) * 1e-6; // m³
  return (d.couches * d.coups[moule] * d.masse * G * d.chute) / V / 1000;
}

/**
 * Masse volumique sèche d'un point : masse de sol humide M (g) dans le moule
 * de volume V (cm³), teneur en eau w (%).
 */
export const rhoDPoint = ({ M, V, w }) => M / V / (1 + w / 100);

/**
 * Courbe de saturation : ρd = ρs / (1 + w ρs / (Sr ρw)) ; Sr en % (100 :
 * courbe de saturation totale). Aucun point d'essai ne peut la dépasser.
 */
export const rhoDSaturation = (w, { rhoS = 2.65, Sr = 100 } = {}) => rhoS / (1 + ((w / 100) * rhoS) / ((Sr / 100) * RHO_W));

/** Teneur en eau de saturation pour une masse volumique sèche donnée : w = ρw (1/ρd − 1/ρs). */
export const wSaturation = (rhoD, rhoS = 2.65) => 100 * RHO_W * (1 / rhoD - 1 / rhoS);

/**
 * Optimum Proctor : parabole ajustée sur les trois ou quatre points qui
 * entourent le plus dense (ou sur tous s'il n'y en a que trois). Si le plus
 * dense est en bout de série, l'optimum n'est pas encadré : il faut un point
 * de plus du côté manquant.
 */
export function optimum(points) {
  const p = points.filter(([w, r]) => Number.isFinite(w) && Number.isFinite(r)).sort((a, b) => a[0] - b[0]);
  if (p.length < 3) return horsDomaine("Il faut au moins trois points (w, ρd) pour situer l'optimum.");
  const iMax = p.reduce((k, x, i) => (x[1] > p[k][1] ? i : k), 0);
  if (iMax === 0 || iMax === p.length - 1)
    return horsDomaine(iMax === 0 ? "Le point le plus dense est le plus sec : ajouter un point plus sec pour encadrer l'optimum."
      : "Le point le plus dense est le plus humide : ajouter un point plus humide pour encadrer l'optimum.", { points: p });
  const a = Math.max(0, iMax - 2), b = Math.min(p.length, iMax + 3);
  const choisis = p.slice(a, b);
  const c = parabole(choisis);
  if (!c || !(c.c2 < 0)) return horsDomaine("Les points ne dessinent pas une courbe en cloche.", { points: p });
  const wOPN = -c.c1 / (2 * c.c2);
  const rhoDOPN = c.c0 + c.c1 * wOPN + c.c2 * wOPN * wOPN;
  return { applicable: true, wOPN, rhoDOPN, coefficients: c, points: p, retenus: choisis, courbe: (w) => c.c0 + c.c1 * w + c.c2 * w * w };
}

/**
 * Degré de saturation à l'optimum et teneur en air : repères pour juger un
 * essai. Un optimum au-delà de 90 % de saturation est suspect.
 */
export function saturationOptimum({ wOPN, rhoDOPN, rhoS = 2.65 }) {
  const e = rhoS / rhoDOPN - 1;
  const Sr = (100 * (wOPN / 100) * rhoS) / (e * RHO_W);
  const air = 100 * (1 - rhoDOPN / rhoS - (rhoDOPN * wOPN) / 100 / RHO_W);
  return { Sr, air, e };
}
