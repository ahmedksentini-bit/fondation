// Outils communs aux bancs d'identification des sols (chapitre 2) : bruit
// reproductible des mesures, teintes des sols et des suspensions, paillasse,
// balance et barre d'échelle des loupes — et deux petites fonctions que les
// solveurs n'offrent pas : la courbe granulométrique prolongée sous son plus
// petit diamètre (la sédimentométrie descend jusqu'au micromètre) et la
// teneur en eau rapportée à la fraction 0/400 µm, celle qu'il faut comparer
// aux limites d'Atterberg [GTR 2024 F1 § 2.2.1 C, note 6].
import { solDe } from "../figures.js";
import { passant } from "../gtr/granulo.js";
import { teinte } from "./loupe.js";

const n1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : "0");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** Bruit reproductible dans [−1, 1] : la même mesure, rejouée, redonne la même valeur. */
export function bruit(i, graine = 0) {
  const x = Math.sin(i * 12.9898 + graine * 78.233 + 4.1414) * 43758.5453;
  return 2 * (x - Math.floor(x)) - 1;
}

/** Hachage reproductible dans [0, 1[ (positions des grains dessinés). */
export const hasard = (i, j = 0, k = 0) => {
  const x = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Mélange de deux teintes #rrggbb : t = 0 donne a, t = 1 donne b. */
export function melange(a, b, t) {
  const u = Math.min(1, Math.max(0, t));
  const v = (h, p) => parseInt(h.slice(p, p + 2), 16);
  return `#${[1, 3, 5].map((p) => Math.round(v(a, p) + (v(b, p) - v(a, p)) * u).toString(16).padStart(2, "0")).join("")}`;
}

/** Teintes d'un sol du catalogue : fond (sol en masse), grains, suspension trouble. */
export function teintesSol(sol) {
  const fond = solDe(sol.motif).fond;
  return { fond, grain: teinte(fond, 0.66), sombre: teinte(fond, 0.48), suspension: teinte(fond, 0.74) };
}

/**
 * Passant (%) d'une courbe du catalogue, prolongé sous son plus petit
 * diamètre avec la pente (en lg d) de son premier segment, et borné à 0 : la
 * sédimentométrie atteint en 24 h des particules plus fines que le premier
 * point de la courbe.
 */
export function passantProlonge(points, d) {
  const p = passant(points, d);
  if (Number.isFinite(p)) return p;
  const c = [...points].sort((a, b) => a[0] - b[0]);
  if (d >= c.at(-1)[0]) return 100;
  const [[d0, p0], [dd, pp]] = c;
  return Math.max(0, p0 + ((pp - p0) * Math.log(d / d0)) / Math.log(dd / d0));
}

/**
 * Teneur en eau (%) de la fraction 0/400 µm d'un sol dont la teneur en eau
 * globale est w et dont p400 % passent à 400 µm : les éléments plus gros sont
 * réputés secs. C'est elle qui entre dans Ic = (wL − w)/IP [GTR 2024 F1, note 6].
 */
export const teneurEau0400 = (w, p400) => (100 * w) / p400;

// ───────────────────────────── Dessin ───────────────────────────────────

/** Paillasse du laboratoire : plan de travail à l'ordonnée y, de x0 à x1. */
export const paillasse = (x0, x1, y) =>
  `<rect x="${n1(x0)}" y="${n1(y)}" width="${n1(x1 - x0)}" height="12" fill="#d6d3d1" stroke="#78716c" stroke-width="1"/>`
  + `<rect x="${n1(x0)}" y="${n1(y + 12)}" width="${n1(x1 - x0)}" height="6" fill="#a8a29e"/>`;

/**
 * Balance électronique posée sur la paillasse (base à l'ordonnée y), plateau
 * centré en x ; lu : texte de l'afficheur. Renvoie le SVG et l'ordonnée du plateau.
 */
export function balance({ x, y, largeur = 170, lu = "", libelle = "" }) {
  const l2 = largeur / 2, yP = y - 46;
  let s = `<path d="M${n1(x - l2)} ${n1(y)}l8 -34h${n1(largeur - 16)}l8 34z" fill="#e2e8f0" stroke="#475569" stroke-width="1.2"/>`;
  s += `<rect x="${n1(x - 8)}" y="${n1(yP + 5)}" width="16" height="8" fill="#94a3b8"/>`;
  s += `<rect x="${n1(x - l2 * 0.78)}" y="${n1(yP)}" width="${n1(largeur * 0.78)}" height="6" rx="2" fill="#cbd5e1" stroke="#64748b"/>`;
  s += `<rect x="${n1(x - 46)}" y="${n1(y - 27)}" width="92" height="19" rx="3" fill="#0f172a"/>`;
  s += `<text x="${n1(x + 41)}" y="${n1(y - 13)}" text-anchor="end" style="font-family:ui-monospace,Consolas,monospace;font-size:12.5px;font-weight:700;fill:#67e8f9">${esc(lu)}</text>`;
  if (libelle) s += `<text x="${n1(x)}" y="${n1(y + 30)}" text-anchor="middle" class="halo" style="font-size:10.5px;font-weight:700;fill:#475569">${esc(libelle)}</text>`;
  return { svg: s, yPlateau: yP };
}

/**
 * Barre d'échelle d'une loupe dessinée en px/mm (k), en bas à gauche : la
 * longueur ronde (1, 2 ou 5 × 10ⁿ) qui fait de 24 à 60 px.
 */
export function barreEchelle(k, { x = 10, y = 157 } = {}) {
  let L = 1;
  for (let n = -4; n <= 3; n++) for (const m of [1, 2, 5]) { const v = m * 10 ** n; if (v * k >= 24 && v * k <= 60) { L = v; n = 9; break; } }
  const px = L * k, lib = L < 1 ? `${Math.round(L * 1000)} µm` : `${String(L).replace(".", ",")} mm`;
  return `<path d="M${x} ${y}h${n1(px)}M${x} ${y - 4}v8M${n1(x + px)} ${y - 4}v8" stroke="#0f172a" stroke-width="1.6" fill="none"/>`
    + `<text x="${n1(x + px / 2)}" y="${y - 7}" text-anchor="middle" class="halo">${lib}</text>`;
}

/** Format d'une masse en grammes : entier au-delà du kilogramme, sinon une ou deux décimales. */
export function gramme(x) {
  if (!Number.isFinite(x)) return "—";
  const d = Math.abs(x) >= 1000 ? 0 : Math.abs(x) >= 100 ? 1 : 2;
  return Number(x).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
}
