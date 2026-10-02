// Utilitaires communs aux bancs du chantier (dynaplaque, atelier d'extraction,
// traitement à la chaux, gonflement au gel) : bruit reproductible, écran
// d'appareil, comparateur à cadran, roue d'engin, volutes de vapeur. Tout est
// produit en chaînes SVG, comme le reste des bancs.
import { r1 } from "./moteur.js";

let compteur = 0;
/** Identifiant unique dans la page (découpes SVG des bancs). */
export const idUnique = (prefixe) => `${prefixe}-${++compteur}`;

/** Bruit reproductible dans [−1, 1] : hachage de (i, graine), sans Math.random. */
export function bruit(i, graine = 0) {
  const x = Math.sin(i * 127.1 + graine * 311.7 + 1.234) * 43758.5453;
  return 2 * (x - Math.floor(x)) - 1;
}

/**
 * Bruit lisse d'écart type voisin de 1 : somme de sinusoïdes de longueurs
 * d'onde `ondes` (dans l'unité de x) et de phases fixées par la graine.
 */
export function bruitLisse(x, graine = 0, ondes = [41, 19, 9]) {
  let s = 0, n = 0;
  ondes.forEach((L, k) => {
    const a = 1 / (k + 1);
    s += a * Math.sin((2 * Math.PI * x) / L + Math.PI * (1 + bruit(k + 1, graine)));
    n += a * a;
  });
  return s / Math.sqrt(n / 2);
}

/** Lissage d'une progression : 0 → 1 sans à-coup. */
export const lisse = (u) => { const v = Math.min(1, Math.max(0, u)); return v * v * (3 - 2 * v); };

/**
 * Écran d'appareil (boîtier de mesure, peson) : cadre sombre, fond clair,
 * lignes de texte à chasse fixe. lignes : [texte, { gras, couleur, taille }].
 */
export function ecran(x, y, w, h, lignes, { taille = 11, pas = 15 } = {}) {
  let s = `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" rx="4" fill="#e7efe1" stroke="#1e293b" stroke-width="1.2"/>`;
  lignes.forEach(([t, o = {}], i) => {
    s += `<text x="${r1(x + 7)}" y="${r1(y + 14 + i * pas)}" style="font-family:ui-monospace,Consolas,monospace;font-size:${o.taille ?? taille}px;font-weight:${o.gras ? 800 : 600};fill:${o.couleur ?? "#1f2937"}">${String(t).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]))}</text>`;
  });
  return s;
}

/**
 * Comparateur à cadran : la grande aiguille fait un tour par millimètre (cent
 * divisions de 0,01 mm), la petite compte les millimètres.
 */
export function comparateur(cx, cy, r, mm, { etiquette = "" } = {}) {
  let s = `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}" fill="#fff" stroke="#334155" stroke-width="1.6"/>`;
  for (let j = 0; j < 20; j++) {
    const a = (j * 18 * Math.PI) / 180, l = j % 5 === 0 ? 0.24 : 0.13;
    s += `<path d="M${r1(cx + r * 0.9 * Math.sin(a))} ${r1(cy - r * 0.9 * Math.cos(a))}L${r1(cx + r * (0.9 - l) * Math.sin(a))} ${r1(cy - r * (0.9 - l) * Math.cos(a))}" stroke="#334155" stroke-width="${j % 5 === 0 ? 1.1 : 0.7}"/>`;
  }
  // Petit cadran des tours.
  const pr = r * 0.3, py = cy + r * 0.38, at = ((mm % 10) / 10) * 2 * Math.PI;
  s += `<circle cx="${r1(cx)}" cy="${r1(py)}" r="${r1(pr)}" fill="#f1f5f9" stroke="#64748b" stroke-width=".7"/>`;
  s += `<path d="M${r1(cx)} ${r1(py)}L${r1(cx + pr * 0.85 * Math.sin(at))} ${r1(py - pr * 0.85 * Math.cos(at))}" stroke="#334155" stroke-width="1"/>`;
  const a = (((mm % 1) + 1) % 1) * 2 * Math.PI;
  s += `<path d="M${r1(cx)} ${r1(cy)}L${r1(cx + r * 0.78 * Math.sin(a))} ${r1(cy - r * 0.78 * Math.cos(a))}" stroke="#dc2626" stroke-width="1.8" stroke-linecap="round"/>`;
  s += `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="2.2" fill="#334155"/>`;
  if (etiquette) s += `<text x="${r1(cx)}" y="${r1(cy - r - 4)}" text-anchor="middle" class="halo" style="font-size:10px;font-weight:800;fill:#334155">${etiquette}</text>`;
  return s;
}

/** Roue d'engin vue de côté : pneu, jante, rayons qui tournent avec l'angle. */
export function roue(cx, cy, r, angle = 0) {
  let s = `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}" fill="#1f2937"/><circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r * 0.55)}" fill="#94a3b8" stroke="#334155" stroke-width=".8"/>`;
  for (let j = 0; j < 3; j++) {
    const a = angle + (j * 2 * Math.PI) / 3;
    s += `<path d="M${r1(cx)} ${r1(cy)}L${r1(cx + r * 0.5 * Math.cos(a))} ${r1(cy + r * 0.5 * Math.sin(a))}" stroke="#334155" stroke-width="1.2"/>`;
  }
  return s;
}

/**
 * Volutes de vapeur qui montent au-dessus de (x, y). t : horloge de l'écran
 * (mouvement figuratif) ; force ∈ [0, 1] règle leur nombre et leur opacité.
 */
export function vapeur(x, y, t, { n = 3, hauteur = 20, largeur = 16, force = 1, couleur = "#94a3b8" } = {}) {
  if (!(force > 0.02)) return "";
  let s = "";
  for (let i = 0; i < n; i++) {
    const p = (t * 0.45 + i / n) % 1, xx = x + ((i * 37) % 11) / 11 * largeur - largeur / 2, yy = y - p * hauteur;
    const o = Math.min(1, force) * 0.75 * Math.sin(Math.PI * p);
    s += `<path d="M${r1(xx)} ${r1(yy)}q3 -3 0 -6t0 -6" fill="none" stroke="${couleur}" stroke-width="1.6" stroke-linecap="round" opacity="${o.toFixed(2)}"/>`;
  }
  return s;
}
