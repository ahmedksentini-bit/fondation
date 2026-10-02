// Utilitaires communs aux bancs de laboratoire des chapitres 3 et 4 (Proctor,
// IPI et CBR, Los Angeles, micro-Deval, fragmentabilité et dégradabilité) :
// listes de réglage, bruit reproductible, classement d'un sol du catalogue,
// vitesse portée très haut pendant les longues attentes (immersion de quatre
// jours, étuve), mouvements figurés quand l'écran ne peut plus suivre l'essai,
// et matériel de paillasse dessiné en SVG — dame Proctor, moule, balance,
// étuve, tamis, granulats, comparateur.
import { analyser } from "../gtr/granulo.js";
import { classerSol } from "../gtr/classification.js";
import { ipiDe } from "./materiaux.js";
import { esc, r1 } from "./moteur.js";
import { teinte, horloge, ACIER, ACIER_SOMBRE } from "./loupe.js";

// ───────────────────────────── Réglages ──────────────────────────────

/** Liste de choix d'un banc : options [[valeur, libellé, inactive?]], cle : attribut data-r. */
export const choix = (libelle, cle, options) =>
  `<div class="field"><label>${esc(libelle)}</label><div class="input-wrap"><select data-r="${cle}">${options.map(([v, l, off]) => `<option value="${esc(v)}"${off ? " disabled" : ""}>${esc(l)}</option>`).join("")}</select></div></div>`;

// ─────────────────────────── Bruit reproductible ──────────────────────────

/** Graine numérique d'une clé : même clé, même graine (FNV-1a). */
export function graine(cle) {
  let h = 2166136261;
  for (const ch of String(cle)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0) % 99991;
}
/** Bruit reproductible dans [−1, 1] : la variabilité d'une mesure, identique d'une séance à l'autre. */
export const bruit = (g, i = 0) => { const x = Math.sin(g * 12.9898 + i * 78.233 + 0.5) * 43758.5453; return 2 * (x - Math.floor(x)) - 1; };

// ─────────────────────────── Classement d'un sol ──────────────────────────

/**
 * Classe GTR 2024 d'un sol du catalogue (classerSol), les mesures du banc
 * prenant la place des valeurs du catalogue (wOPN, IPI, CBRi…). Renvoie aussi
 * l'analyse granulométrique (tamisat à 2 mm pour la table des états des sables).
 */
export function classerCatalogue(s, mesures = {}) {
  const a = analyser(s.granulo);
  const r = classerSol({
    Dmax: s.Dmax, p63um: a.p63um, p2mm: a.p2mm, Cu: a.Cu, D60: a.D60, fractionSable: a.fractionSable, fractionGrave: a.fractionGrave,
    VBS: s.VBS, IP: s.wL != null ? s.wL - s.wP : NaN, wL: s.wL ?? NaN, wP: s.wP ?? NaN, w: s.wn, wOPN: s.wOPN, IPI: ipiDe(s)(s.wn),
    CBRi: s.CBRi, LA: s.LA, MDE: s.MDE, FS: s.FS, MO: s.MO, ...mesures,
  });
  return { ...r, analyse: a };
}

// ───────────────────────────── Vitesse ──────────────────────────────

/**
 * Régulateur de vitesse : pendant une longue attente (immersion, étuve), le
 * banc passe à une vitesse très élevée, puis revient à celle que l'on avait
 * choisie. Aucun bouton de vitesse n'est actif pendant l'accélération ; un clic
 * sur l'un d'eux reprend la main. À créer après brancherMarche.
 */
export function regulateur(c, b) {
  const boutons = [...c.corps.querySelectorAll("[data-vitesse]")];
  let base = Number(boutons.find((x) => x.classList.contains("actif"))?.dataset.vitesse ?? 1), force = null;
  boutons.forEach((x) => x.addEventListener("click", () => { base = Number(x.dataset.vitesse); force = null; }));
  return {
    accelerer(v) {
      if (force === v) return;
      force = v;
      boutons.forEach((x) => x.classList.remove("actif"));
      b.vitesse(v);
    },
    retablir() {
      if (force === null) return;
      force = null;
      boutons.forEach((x) => x.classList.toggle("actif", Number(x.dataset.vitesse) === base));
      b.vitesse(base);
    },
    /** Vitesse en cours (secondes d'essai par seconde d'écran). */
    get vitesse() { return force ?? base; },
    get force() { return force; },
  };
}

/**
 * Instant d'un cycle de période T (s d'essai) à dessiner : l'instant réel si
 * l'écran peut le suivre, sinon un cycle figuré, rejoué à `cadence` cycles par
 * seconde d'écran (la dame qui frappe, le boulet qui retombe…).
 */
export function instantCycle(tReel, T, vitesse, cadence = 2.5) {
  if (T / Math.max(vitesse, 1e-9) >= 1 / cadence) return ((tReel % T) + T) % T;
  return ((horloge() * cadence) % 1) * T;
}

/**
 * Angle de rotation à dessiner (rad) d'un tambour qui a fait `tours` tours à
 * `trMin` tr/min : réel tant que l'écran le suit, sinon figuré à `maxTrS` tours
 * par seconde d'écran — le compteur, lui, garde le vrai nombre de tours.
 */
export function angleTambour(tours, trMin, vitesse, maxTrS = 0.6) {
  if ((trMin / 60) * vitesse <= maxTrS) return 2 * Math.PI * tours;
  return 2 * Math.PI * horloge() * maxTrS;
}

// ───────────────────────────── Paillasse ──────────────────────────────

/** Plan de travail de la paillasse, dessus à l'ordonnée y. */
export const paillasse = (y, x0 = 0, x1 = 640) =>
  `<rect x="${x0}" y="${y}" width="${x1 - x0}" height="11" fill="#e2e8f0" stroke="#94a3b8"/><rect x="${x0}" y="${y + 11}" width="${x1 - x0}" height="5" fill="#cbd5e1"/>`;

/** Écran numérique (fond sombre, chiffres cyan), calé à droite. */
export const ecran = (x, y, l, txt, { taille = 12, h = 18 } = {}) =>
  `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(l)}" height="${h}" rx="3" fill="#0f172a"/>`
  + `<text x="${r1(x + l - 5)}" y="${r1(y + h / 2 + taille * 0.36)}" text-anchor="end" style="font-family:ui-monospace,Consolas,monospace;font-size:${taille}px;font-weight:700;fill:#67e8f9">${esc(txt)}</text>`;

/** Balance posée sur la paillasse (y : dessus de la paillasse) ; le plateau est à y − 36. */
export function balance(x, y, { l = 110, lecture = "0,0 g" } = {}) {
  return `<rect x="${x}" y="${y - 30}" width="${l}" height="30" rx="5" fill="#e2e8f0" stroke="#64748b" stroke-width="1.2"/>`
    + `<rect x="${x + 10}" y="${y - 36}" width="${l - 20}" height="6" rx="2" fill="${ACIER}" stroke="${ACIER_SOMBRE}"/>`
    + ecran(x + 8, y - 25, l - 16, lecture);
}

/**
 * Étuve posée sur la paillasse (y : dessus de la paillasse) : consigne
 * affichée, voyant de chauffe, porte vitrée dont l'intérieur va de
 * (x + 8, y − h + 24) à (x + l − 8, y − 8) ; contenu : SVG posé par l'appelant.
 */
export function etuve(x, y, { l = 110, h = 110, consigne = 105, chauffe = true, contenu = "" } = {}) {
  const yh = y - h;
  let s = `<rect x="${x}" y="${yh}" width="${l}" height="${h}" rx="6" fill="#f1f5f9" stroke="#475569" stroke-width="1.3"/>`;
  s += `<rect x="${x + 8}" y="${yh + 24}" width="${l - 16}" height="${h - 32}" rx="3" fill="${chauffe ? "#fff7ed" : "#f8fafc"}" stroke="#64748b"/>`;
  s += ecran(x + 6, yh + 4, l - 26, `${consigne} °C`, { taille: 11, h: 16 });
  s += `<circle cx="${x + l - 10}" cy="${yh + 12}" r="4.5" fill="${chauffe ? "#f97316" : "#94a3b8"}" stroke="#7c2d12" stroke-width=".6"/>`;
  s += `<path d="M${x + 10} ${y - 30}h${l - 20}" stroke="#94a3b8" stroke-width="1.6"/>`;
  return s + contenu;
}

/** Petite tare (coupelle) de teneur en eau, posée en (x, y) bas. */
export const tare = (x, y, couleur = "#a8a29e") =>
  `<path d="M${r1(x - 9)} ${r1(y - 7)}h18l-2 7h-14z" fill="${ACIER}" stroke="${ACIER_SOMBRE}" stroke-width=".8"/><ellipse cx="${r1(x)}" cy="${r1(y - 7)}" rx="8" ry="2.2" fill="${couleur}"/>`;

/**
 * Dame Proctor en coupe : fourreau-guide posé sur la couche et masse dont la
 * face inférieure (Ø 50 mm) frappe le sol, levée de la fraction `levee` de la
 * hauteur de chute ; k px/mm pour la largeur, hChute en px (chute dessinée
 * réduite).
 */
export function dame({ cx, yPied, k = 1, hChute = 80, levee = 0, lourde = false }) {
  const lm = 50 * k, hm = lourde ? 34 : 26, ep = 3;
  const yHaut = yPied - hm - hChute - 6, yM = yPied - hm - levee * hChute;
  let s = `<rect x="${r1(cx - lm / 2 - ep)}" y="${r1(yHaut)}" width="${r1(lm + 2 * ep)}" height="${r1(yPied - yHaut)}" fill="#e2e8f0" fill-opacity=".5" stroke="#64748b" stroke-width="1.1"/>`;
  s += `<rect x="${r1(cx - lm / 2)}" y="${r1(yM)}" width="${r1(lm)}" height="${hm}" rx="2" fill="#475569" stroke="#1e293b"/>`;
  s += `<rect x="${r1(cx - lm / 2 + 3)}" y="${r1(yM + 3)}" width="4" height="${hm - 6}" fill="#94a3b8" opacity=".8"/>`;
  s += `<rect x="${r1(cx - lm / 2 - ep - 3)}" y="${r1(yHaut - 8)}" width="${r1(lm + 2 * ep + 6)}" height="8" rx="3" fill="#1e293b"/>`;
  return s;
}

/**
 * Moule cylindrique en coupe (diamètre D et hauteur H en mm, k px/mm) sur son
 * embase, hausse éventuelle (mm). Renvoie l'embase, les parois (à dessiner
 * après le sol) et la géométrie intérieure.
 */
export function moule({ cx, yBase, k, D, H, hausse = 0, embase = 10 }) {
  const l = D * k, h = H * k, ep = 7, yFond = yBase - embase, yHaut = yFond - h;
  const fond = `<rect x="${r1(cx - l / 2 - ep - 12)}" y="${r1(yFond)}" width="${r1(l + 2 * ep + 24)}" height="${embase}" rx="2" fill="${ACIER_SOMBRE}" stroke="#1e293b"/>`;
  let parois = [-1, 1].map((sg) => `<rect x="${r1(sg < 0 ? cx - l / 2 - ep : cx + l / 2)}" y="${r1(yHaut)}" width="${ep}" height="${r1(h)}" fill="${ACIER}" stroke="${ACIER_SOMBRE}"/>`).join("");
  if (hausse > 0) parois += [-1, 1].map((sg) => `<rect x="${r1(sg < 0 ? cx - l / 2 - ep - 2 : cx + l / 2)}" y="${r1(yHaut - hausse * k)}" width="${ep + 2}" height="${r1(hausse * k - 1.5)}" fill="#e2e8f0" stroke="${ACIER_SOMBRE}"/>`).join("");
  return { fond, parois, x0: cx - l / 2, x1: cx + l / 2, yFond, yHaut, yHausse: yHaut - hausse * k };
}

/** Tamis vu de côté : cadre et toile ; la toile est à y + h − 4. */
export function tamis(x, y, l, { h = 20, libelle = "", vibre = 0 } = {}) {
  const dx = vibre ? r1(vibre) : 0;
  return `<g transform="translate(${dx} 0)"><rect x="${x}" y="${y}" width="${l}" height="${h}" rx="2" fill="#f8fafc" stroke="#64748b" stroke-width="1.2"/>`
    + `<path d="M${x + 1} ${y + h - 4}h${l - 2}" stroke="#475569" stroke-width="2.2" stroke-dasharray="2 1.6"/>`
    + (libelle ? `<text x="${x + l - 4}" y="${y + 12}" text-anchor="end" style="font-size:10px;font-weight:700;fill:#475569">${esc(libelle)}</text>` : "") + "</g>";
}

/**
 * Granulat : polygone irrégulier de rayon moyen r ; arrondi de 0 (arêtes
 * vives) à 1 (grain émoussé, coins arrondis).
 */
export function granulat(cx, cy, r, g, { arrondi = 0, couleur = "#cbd5e1", trait = null, rot = 0, n = 7, aplati = 0.85, opacite = 1 } = {}) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (2 * Math.PI * (i + 0.32 * bruit(g, i))) / n, rr = r * (0.8 + 0.22 * bruit(g, i + 50));
    pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a) * aplati]);
  }
  const t = Math.max(0, Math.min(1, arrondi)) * 0.5;
  let d = "";
  pts.forEach((p, i) => {
    const prec = pts[(i + n - 1) % n], suiv = pts[(i + 1) % n];
    const a = [p[0] + (prec[0] - p[0]) * t, p[1] + (prec[1] - p[1]) * t], b = [p[0] + (suiv[0] - p[0]) * t, p[1] + (suiv[1] - p[1]) * t];
    d += `${i ? "L" : "M"}${r1(a[0])} ${r1(a[1])}Q${r1(p[0])} ${r1(p[1])} ${r1(b[0])} ${r1(b[1])}`;
  });
  return `<path d="${d}Z" fill="${couleur}" stroke="${trait ?? teinte(couleur, 0.62)}" stroke-width="1" stroke-linejoin="round"${opacite < 1 ? ` opacity="${opacite}"` : ""}/>`;
}

/** Comparateur à cadran : l'aiguille fait un tour par millimètre. */
export function comparateur(cx, cy, r, mm, { libelle = "" } = {}) {
  let s = `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r}" fill="#fff" stroke="#334155" stroke-width="1.6"/>`;
  for (let j = 0; j < 10; j++) {
    const a = (j * Math.PI) / 5;
    s += `<path d="M${r1(cx + (r - 4) * Math.sin(a))} ${r1(cy - (r - 4) * Math.cos(a))}L${r1(cx + (r - 1) * Math.sin(a))} ${r1(cy - (r - 1) * Math.cos(a))}" stroke="#334155" stroke-width="1"/>`;
  }
  const a = (((mm % 1) + 1) % 1) * 2 * Math.PI;
  s += `<path d="M${r1(cx)} ${r1(cy)}L${r1(cx + (r - 3) * Math.sin(a))} ${r1(cy - (r - 3) * Math.cos(a))}" stroke="#dc2626" stroke-width="1.8" stroke-linecap="round"/><circle cx="${r1(cx)}" cy="${r1(cy)}" r="2" fill="#334155"/>`;
  if (libelle) s += `<text x="${r1(cx + r + 5)}" y="${r1(cy + 4)}" class="halo" style="font-size:10px;font-weight:700;fill:#334155">${esc(libelle)}</text>`;
  return s;
}

/** Libellé de scène, sous la paillasse ou ailleurs (≥ 10 px, liseré blanc). */
export const legende = (x, y, txt, { ancre = "middle", taille = 10.5, couleur = "#334155", gras = true } = {}) =>
  `<text x="${r1(x)}" y="${r1(y)}" text-anchor="${ancre}" class="halo" style="font-size:${taille}px;font-weight:${gras ? 700 : 500};fill:${couleur}">${esc(txt)}</text>`;

/** Plat de refus (granulats lavés), posé en (cx, y bas). */
export function platRefus(cx, y, couleur, g = 1, n = 6) {
  let s = `<path d="M${r1(cx - 26)} ${r1(y - 9)}h52l-3 9h-46z" fill="${ACIER}" stroke="${ACIER_SOMBRE}" stroke-width=".9"/>`;
  for (let i = 0; i < n; i++) s += granulat(cx - 18 + (36 * i) / Math.max(1, n - 1), y - 11 - 3 * Math.sin((Math.PI * i) / Math.max(1, n - 1)), 4.2, g + i, { couleur, arrondi: 0.3 });
  return s;
}

/**
 * Poste de fin d'essai des granulats (Los Angeles, micro-Deval), posé sur la
 * paillasse à partir de x0 : tamis de 1,6 mm sur son bac de lavage, balance,
 * étuve. phase : "attente" | "tamisage" | "sechage" | "pesee" | "fini" ; fr :
 * avancement de la phase ; lecture : affichage de la balance pendant la pesée.
 */
export function posteFin({ x0, y, phase, fr = 0, couleur = "#cbd5e1", g = 1, lecture = "0,0 g", consigne = 110, acier = null }) {
  const t = horloge(), lavage = phase === "tamisage";
  let s = `<path d="M${x0} ${y - 22}h96l-6 22h-84z" fill="#e2e8f0" stroke="#64748b" stroke-width="1.2"/>`;
  if (lavage) s += `<path d="M${x0 + 4} ${r1(y - 4 - 12 * fr)}h88l-${r1(1 + 3 * (1 - fr))} ${r1(4 + 12 * fr)}h-${r1(82 + 2 * fr)}z" fill="#a8a29e" opacity=".55"/>`;
  s += tamis(x0 + 6, y - 48, 84, { h: 22, libelle: "1,6 mm", vibre: lavage ? 1.6 * Math.sin(t * 38) : 0 });
  if (lavage) {
    for (let i = 0; i < 7; i++) s += granulat(x0 + 16 + i * 10.5, y - 31 - 3 * (i % 2), 4.6, g + 20 + i, { couleur, arrondi: 0.35 });
    // Douchette : l'eau lave les granulats, les fines passent dans le bac.
    s += `<path d="M${x0 + 20} ${y - 96}q8 -8 22 -2" stroke="#334155" stroke-width="4" fill="none" stroke-linecap="round"/>`;
    for (let i = 0; i < 6; i++) { const q = (t * 1.8 + i / 6) % 1; s += `<circle cx="${r1(x0 + 42 + 10 * q + (i % 3) * 3)}" cy="${r1(y - 94 + 56 * q)}" r="1.7" fill="#0369a1" opacity="${r1(1 - 0.4 * q)}"/>`; }
    for (let i = 0; i < 4; i++) { const q = (t * 1.2 + i / 4) % 1; s += `<circle cx="${r1(x0 + 24 + i * 16)}" cy="${r1(y - 24 + 12 * q)}" r="1.4" fill="#78716c" opacity="${r1(1 - q)}"/>`; }
  }
  if (phase === "separation") {
    // Les billes d'acier sont retirées à l'aimant ; les gravillons restent sur le tamis.
    for (let i = 0; i < 6; i++) s += granulat(x0 + 18 + i * 12, y - 31 - 2 * (i % 2), 4.4, g + 40 + i, { couleur, arrondi: 0.4 });
    const ya = y - 92 - 10 * Math.sin(Math.PI * fr);
    s += `<path d="M${x0 + 30} ${r1(ya)}v-18a18 18 0 0 1 36 0v18h-10v-18a8 8 0 0 0 -16 0v18z" fill="#dc2626" stroke="#7f1d1d"/><rect x="${x0 + 30}" y="${r1(ya)}" width="10" height="6" fill="#cbd5e1"/><rect x="${x0 + 56}" y="${r1(ya)}" width="10" height="6" fill="#cbd5e1"/>`;
    if (acier) for (let i = 0; i < 7; i++) s += boulet(x0 + 32 + (i % 4) * 9 + (i > 3 ? 4 : 0), ya + 10 + (i > 3 ? 7 : 0), 3.6, acier);
    s += `<text x="${x0 + 74}" y="${r1(ya - 6)}" class="halo" style="font-size:10px;font-weight:700;fill:#7f1d1d">aimant</text>`;
  }
  s += balance(x0 + 108, y, { l: 92, lecture: phase === "pesee" || phase === "fini" ? lecture : "0,0 g" });
  if (phase === "pesee" || phase === "fini") s += platRefus(x0 + 154, y - 36, couleur, g);
  s += etuve(x0 + 212, y, { l: 96, h: 116, consigne, chauffe: phase === "sechage", contenu: phase === "sechage" ? platRefus(x0 + 260, y - 31, couleur, g) : "" });
  if (phase === "sechage") for (let i = 0; i < 3; i++) { const q = (t * 0.8 + i / 3) % 1; s += `<path d="M${r1(x0 + 244 + i * 14)} ${r1(y - 46 - 26 * q)}q4 -4 0 -8t0 -8" stroke="#f97316" stroke-width="1.3" fill="none" opacity="${r1(0.8 * (1 - q))}"/>`; }
  return s;
}

/** Dégradé d'acier poli des boulets et des billes (à poser une fois par SVG, avec un id propre). */
export const defsAcier = (id) => `<defs><radialGradient id="${id}" cx=".36" cy=".34" r=".72"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#cbd5e1"/><stop offset="1" stop-color="#475569"/></radialGradient></defs>`;
/** Boulet ou bille d'acier de rayon r (px), avec le dégradé `id`. */
export const boulet = (cx, cy, r, id) => `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}" fill="url(#${id})" stroke="#1e293b" stroke-width="${r > 5 ? 1.1 : 0.7}"/>`;

/**
 * Laisse les blocs du banc rétrécir à la largeur de l'écran : sans cela, un
 * tableau large du bilan élargit toute la grille du banc sur un téléphone, au
 * lieu de défiler dans son cadre.
 */
export function assouplir(c) {
  for (const el of c.corps.children) el.style.minWidth = "0";
}
