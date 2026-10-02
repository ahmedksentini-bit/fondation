// Essais d'identification des sols : teneur en eau, masses volumiques,
// tamisage, sédimentométrie, limites d'Atterberg, valeur de bleu,
// équivalent de sable. Les fonctions prennent les lectures brutes du
// laboratoire et rendent les grandeurs que demande la classification.

import { horsDomaine, regression, RHO_W, G } from "./outils.js";

// ─────────────────────── Teneur en eau, masses volumiques ───────────────────────

/** Teneur en eau (%) : masse d'eau rapportée à la masse sèche (NF EN ISO 17892-1). */
export const teneurEau = ({ mh, ms }) => (100 * (mh - ms)) / ms;

/**
 * État d'un sol à partir de ρ (Mg/m³), w (%) et ρs : ρd, indice des vides,
 * porosité, degré de saturation.
 */
export function etat({ rho, w, rhoS = 2.65 }) {
  const rhoD = rho / (1 + w / 100);
  const e = rhoS / rhoD - 1;
  return { rhoD, e, n: e / (1 + e), Sr: (100 * (w / 100) * rhoS) / (e * RHO_W) };
}

/** Masse volumique des grains au pycnomètre : ρs = ms ρw / (ms + m1 − m2). */
export const rhoSPycnometre = ({ ms, m1, m2 }) => (ms * RHO_W) / (ms + m1 - m2);

// ──────────────────────────────── Tamisage ──────────────────────────────────

/**
 * Analyse granulométrique par tamisage (NF EN ISO 17892-4) : refus partiels
 * de chaque tamis (g), masse sèche totale (g). Renvoie la courbe des passants
 * cumulés et le bilan de masse (la perte au tamisage doit rester faible).
 */
export function tamisage({ masseSeche, refus }) {
  if (!(masseSeche > 0)) return horsDomaine("Masse sèche de l'échantillon manquante.");
  const tri = [...refus].sort((a, b) => b[0] - a[0]);
  let cumul = 0;
  const lignes = tri.map(([d, m]) => {
    cumul += m;
    return { d, refus: m, refusCumule: cumul, passant: 100 * (1 - cumul / masseSeche) };
  });
  const perte = masseSeche - cumul; // masse passée au fond, ou perdue
  return { applicable: true, lignes, courbe: lignes.map((l) => [l.d, l.passant]).reverse(), fond: perte, pctFond: (100 * perte) / masseSeche };
}

// ─────────────────────────────── Sédimentométrie ────────────────────────────

/**
 * Sédimentométrie au densimètre : loi de Stokes. Une particule sphérique de
 * diamètre D tombe à vitesse constante v = (ρs − ρw) g D² / (18 η). Au temps t
 * et à la profondeur effective Hr du centre de poussée du densimètre, seules
 * restent en suspension les particules plus fines que
 *   D = √(18 η Hr / ((ρs − ρw) g t)).
 * Unités : η en Pa·s, Hr en m, t en s, ρ en Mg/m³ ; D rendu en mm.
 */
export function diametreStokes({ Hr, t, rhoS = 2.65, eta = 1.0e-3 }) {
  const d = Math.sqrt((18 * eta * Hr) / ((rhoS - RHO_W) * 1000 * G * t));
  return d * 1000;
}

/** Viscosité de l'eau (Pa·s) en fonction de la température (°C) — formule de Vogel. */
export const viscositeEau = (T) => 2.414e-5 * 10 ** (247.8 / (T + 273.15 - 140));

/**
 * Pourcentage de particules plus fines que D dans la suspension (V cm³, ms g
 * de sol sec) quand le densimètre lit la masse volumique ρ (Mg/m³) :
 *   P = 100 · (V/ms) · ρs/(ρs − ρw) · (ρ − ρw).
 * C'est la masse des grains encore en suspension au niveau du densimètre,
 * rapportée à la masse totale.
 */
export function pourcentageSedimento({ rhoLu, V = 1000, ms = 50, rhoS = 2.65, rhoEau = RHO_W }) {
  return (100 * (V / ms) * (rhoS / (rhoS - RHO_W)) * (rhoLu - rhoEau));
}

// ─────────────────────────────── Limites d'Atterberg ─────────────────────────

/**
 * Limite de liquidité à la coupelle de Casagrande : droite de w en fonction
 * de lg N ajustée sur les points (N coups, w %), lue à N = 25. Le domaine de
 * l'essai va de 15 à 35 coups.
 */
export function wLCasagrande(points) {
  const ok = points.filter(([N, w]) => N > 0 && Number.isFinite(w));
  if (ok.length < 2) return horsDomaine("Il faut au moins deux points (nombre de coups, teneur en eau).");
  const r = regression(ok.map(([N, w]) => [Math.log10(N), w]));
  return { applicable: true, wL: r.a + r.b * Math.log10(25), pente: r.b, r2: r.r2, droite: (N) => r.a + r.b * Math.log10(N) };
}

/** Limite de liquidité « à un point » : wL = w (N/25)^0,121. */
export const wLUnPoint = ({ N, w }) => w * (N / 25) ** 0.121;

/**
 * Limite de liquidité au cône de pénétration (NF EN ISO 17892-12, cône de
 * 80 g et 30°) : teneur en eau pour un enfoncement de 20 mm, sur la droite
 * w = f(enfoncement) ajustée sur les points (enfoncement mm, w %).
 */
export function wLCone(points) {
  const ok = points.filter(([p, w]) => p > 0 && Number.isFinite(w));
  if (ok.length < 2) return horsDomaine("Il faut au moins deux points (enfoncement, teneur en eau).");
  const r = regression(ok);
  return { applicable: true, wL: r.a + r.b * 20, pente: r.b, r2: r.r2, droite: (p) => r.a + r.b * p };
}

/**
 * Indices de plasticité et de consistance. Ic = (wL − wn)/IP vaut 0 à la
 * limite de liquidité et 1 à la limite de plasticité ; IL = 1 − Ic.
 */
export function atterberg({ wL, wP, w = NaN }) {
  const IP = wL - wP;
  const Ic = (wL - w) / IP;
  return { wL, wP, IP, Ic, IL: 1 - Ic };
}

/**
 * Position sur l'abaque de plasticité de Casagrande : la ligne A
 * (IP = 0,73 (wL − 20)) sépare argiles (au-dessus) et limons (au-dessous) ;
 * wL = 50 % sépare peu et très plastiques (classification LCPC des sols fins).
 */
export function abaqueCasagrande({ wL, IP }) {
  const A = 0.73 * (wL - 20);
  const argile = IP >= A;
  const tres = wL >= 50;
  const nom = `${argile ? "argile" : "limon"} ${tres ? "très" : "peu"} plastique`;
  const code = `${argile ? "A" : "L"}${tres ? "t" : "p"}`;
  return { ligneA: A, argile, tresPlastique: tres, nom, code };
}

// ──────────────────────────────── Valeur de bleu ─────────────────────────────

/**
 * Valeur de bleu du sol (NF P94-068, essai à la tache) : masse de bleu (g)
 * adsorbée par 100 g de sol. V cm³ de solution à 10 g/L sur m0 g de la
 * fraction 0/5 mm sèche ; C : proportion de 0/5 mm dans la fraction 0/50 (ou
 * 0/63) mm du sol, pour rapporter la valeur au sol entier.
 */
export function vbs({ V, m0, C = 1, concentration = 10 }) {
  const B = (V * concentration) / 1000; // g de bleu
  return { B, VB: (100 * B) / m0, VBS: (100 * B * C) / m0 };
}

/** Équivalent de sable : ES = 100 h2/h1 (h1 sommet du floculat, h2 sommet du sable). */
export const equivalentSable = ({ h1, h2 }) => (100 * h2) / h1;
