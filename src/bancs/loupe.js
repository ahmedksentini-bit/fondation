// Loupe des bancs d'essai : sous les afficheurs, une petite fenêtre agrandit
// l'organe actif de l'essai et montre ce qu'il fait — la pointe s'enfonce, le
// moulinet tourne, la membrane se gonfle, la couronne découpe la carotte…
// Le terrain y est dessiné en profondeur absolue : sa texture défile quand
// l'outil descend. Les mouvements seulement figuratifs (rotation d'un outil,
// filets d'eau) suivent l'horloge de l'écran ; ils s'arrêtent avec l'essai.
import { solDe } from "../figures.js";

export const W = 176, H = 168;
export const ACIER = "#cbd5e1", ACIER_SOMBRE = "#64748b", TRAIT = "#334155", ROUGE = "#dc2626", BLEU = "#0369a1", EAU = "#7dd3fc";
const n1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : "0");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** Horloge de l'écran (s), pour les mouvements figuratifs. */
export const horloge = () => (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;

let numero = 0;
/**
 * Crée la loupe dans la charpente du banc. echelle : { px, libelle } pour une
 * barre d'échelle. Renvoie maj(contenu SVG, légende) à appeler à chaque image.
 */
export function fenetreLoupe(c, titre, { echelle = null } = {}) {
  const id = `loupe-${++numero}`;
  const barre = echelle
    ? `<g><path d="M10 ${H - 11}h${echelle.px}M10 ${H - 15}v8M${10 + echelle.px} ${H - 15}v8" stroke="#0f172a" stroke-width="1.6" fill="none"/>
       <text x="${10 + echelle.px / 2}" y="${H - 18}" text-anchor="middle" class="halo">${esc(echelle.libelle)}</text></g>` : "";
  c.loupe.innerHTML = `<figure class="banc-loupe-cadre"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Loupe : ${esc(titre)}" xmlns="http://www.w3.org/2000/svg">
    <defs><clipPath id="${id}"><rect width="${W}" height="${H}" rx="10"/></clipPath></defs>
    <g clip-path="url(#${id})"><rect width="${W}" height="${H}" fill="#f8fafc"/><g class="loupe-dyn"></g></g>${barre}
    <rect x=".75" y=".75" width="${W - 1.5}" height="${H - 1.5}" rx="10" fill="none" stroke="#0f172a" stroke-width="1.5"/></svg>
    <figcaption><strong>Loupe · ${esc(titre)}</strong><span></span></figcaption></figure>`;
  const g = c.loupe.querySelector(".loupe-dyn"), leg = c.loupe.querySelector("figcaption span");
  return (contenu, legende = "") => {
    g.innerHTML = contenu;
    if (leg.textContent !== legende) leg.textContent = legende;
  };
}

// ───────────────────────────── Terrain ──────────────────────────────────

const hache = (i, j, s) => { const x = Math.sin(i * 127.1 + j * 311.7 + s * 74.7) * 43758.5453; return x - Math.floor(x); };
/** Assombrit (k < 1) ou éclaircit (k > 1) une teinte #rrggbb. */
export const teinte = (hex, k = 0.62) => `#${[1, 3, 5].map((p) => Math.min(255, Math.round(parseInt(hex.slice(p, p + 2), 16) * k)).toString(16).padStart(2, "0")).join("")}`;

const FAMILLE = { sable: "grains", intermediaire: "grains", grave: "galets", remblai: "melange", argile: "feuillets", limon: "feuillets", marne: "feuillets", tourbe: "fibres", craie: "blocs", roche: "blocs" };
/** Famille de texture d'une nature de sol : grains, galets, mélange, feuillets, fibres, blocs. */
export const familleSol = (sol) => FAMILLE[String(sol).split("-")[0]] ?? "feuillets";

function texture(cle, { Y, k, za, zb, x0, x1, deplacer, decalageX }) {
  const fam = familleSol(cle), fond = solDe(cle).fond, col = teinte(fond);
  const pas = { grains: 8, galets: 15, melange: 11, feuillets: 9, fibres: 11, blocs: 16 }[fam];
  const j0 = Math.floor((za * k) / pas) - 1, j1 = Math.ceil((zb * k) / pas) + 1;
  const i0 = Math.floor((x0 - decalageX) / pas) - 1, i1 = Math.ceil((x1 - decalageX) / pas) + 1;
  let s = "";
  if (fam === "blocs") {
    // Joints d'un massif : lits horizontaux, joints verticaux décalés d'un lit à l'autre.
    for (let j = j0; j <= j1; j++) {
      const za2 = (j * pas) / k, zb2 = ((j + 1) * pas) / k;
      if (zb2 < za || za2 > zb) continue;
      const ya = Y(Math.max(za2, za)), yb = Y(Math.min(zb2, zb));
      if (za2 >= za) s += `<path d="M${n1(x0)} ${n1(ya)}H${n1(x1)}" stroke="${col}" stroke-width=".8" opacity=".6"/>`;
      for (let i = Math.floor(i0 / 2) - 1; i <= Math.ceil(i1 / 2) + 1; i++) {
        const x = decalageX + (i + (j & 1) * 0.5) * pas * 2;
        if (x > x0 && x < x1) s += `<path d="M${n1(x)} ${n1(ya)}V${n1(yb)}" stroke="${col}" stroke-width=".8" opacity=".6"/>`;
      }
    }
    return s;
  }
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const z = ((j + hache(i, j, 1)) * pas) / k;
    if (z < za || z > zb) continue;
    let x = decalageX + (i + hache(i, j, 2)) * pas, y = Y(z);
    if (deplacer) [x, y] = deplacer(x, y);
    if (x < x0 - 4 || x > x1 + 4) continue;
    const h3 = hache(i, j, 3);
    if (fam === "grains") s += `<circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(1 + 1.2 * h3)}" fill="${col}"/>`;
    else if (fam === "galets") s += `<ellipse cx="${n1(x)}" cy="${n1(y)}" rx="${n1(2.6 + 3 * h3)}" ry="${n1(1.9 + 2 * h3)}" fill="${teinte(fond, 0.86)}" stroke="${col}" stroke-width=".7"/>`;
    else if (fam === "melange") s += h3 < 0.55 ? `<circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(1 + h3)}" fill="${col}"/>`
      : `<path d="M${n1(x - 3)} ${n1(y + 2)}l${n1(2 + 2 * h3)} -5l3 4z" fill="${teinte(fond, 0.78)}" stroke="${col}" stroke-width=".6"/>`;
    else if (fam === "feuillets") s += `<path d="M${n1(x - 3)} ${n1(y)}h${n1(4.5 + 3 * h3)}" stroke="${col}" stroke-width="1.1" stroke-linecap="round"/>`;
    else s += `<path d="M${n1(x - 4)} ${n1(y)}q2 -2.5 4 0t4 0" stroke="${col}" stroke-width="1" fill="none"/>`;
  }
  return s;
}

/**
 * Terrain à la loupe : couches [{ z0, z1, sol }] entre les profondeurs zHaut et
 * zBas, dessinées de x0 à x1 ; Y(z) donne l'ordonnée, k l'échelle (px/m).
 * deplacer(x, y) → [x, y] déforme la texture (cavité qui se dilate, sol tassé…).
 */
export function vueTerrain({ couches, Y, k, zHaut, zBas, x0 = 0, x1 = W, deplacer = null, decalageX = 0, fond = true }) {
  let s = "";
  couches.forEach((c, i) => {
    // La dernière couche décrite se prolonge sous la vue.
    const a = Math.max(c.z0, zHaut), b = Math.min(i === couches.length - 1 ? Infinity : c.z1, zBas);
    if (!(b > a)) return;
    if (fond) s += `<rect x="${n1(x0)}" y="${n1(Y(a))}" width="${n1(x1 - x0)}" height="${n1(Y(b) - Y(a) + 0.6)}" fill="${solDe(c.sol).fond}"/>`;
    s += texture(c.sol, { Y, k, za: a, zb: b, x0, x1, deplacer, decalageX });
  });
  // Terrain naturel, quand il entre dans la vue.
  const z0 = couches[0]?.z0;
  if (z0 > zHaut && z0 < zBas) s += `<path d="M${n1(x0)} ${n1(Y(z0))}H${n1(x1)}" stroke="${TRAIT}" stroke-width="1.6"/>`;
  return s;
}

/** Bloc de terrain uniforme (une seule nature), pour les vues sans profondeur. */
export const blocSol = (sol, { x0 = 0, x1 = W, y0 = 0, y1 = H, k = 1000, deplacer = null, decalageX = 0, decalageY = 0, fond = true } = {}) =>
  vueTerrain({ couches: [{ z0: -1e6, z1: 1e6, sol }], Y: (z) => y0 + z * k - decalageY, k, zHaut: decalageY / k, zBas: (y1 - y0 + decalageY) / k, x0, x1, deplacer, decalageX, fond });

/** Teinte de fond d'une nature de sol. */
export const fondSol = (sol) => solDe(sol).fond;

// ───────────────────────────── Dessin ───────────────────────────────────

/** Flèche pleine de (x1, y1) vers (x2, y2). */
export function fleche(x1, y1, x2, y2, couleur = ROUGE, ep = 1.6, tete = 5) {
  const L = Math.hypot(x2 - x1, y2 - y1);
  if (!(L > 0.8)) return "";
  const ux = (x2 - x1) / L, uy = (y2 - y1) / L, t = Math.min(tete, L * 0.7);
  const bx = x2 - ux * t, by = y2 - uy * t, px = -uy * t * 0.55, py = ux * t * 0.55;
  return `<path d="M${n1(x1)} ${n1(y1)}L${n1(bx)} ${n1(by)}" stroke="${couleur}" stroke-width="${ep}" fill="none"/>`
    + `<path d="M${n1(x2)} ${n1(y2)}L${n1(bx + px)} ${n1(by + py)}L${n1(bx - px)} ${n1(by - py)}Z" fill="${couleur}"/>`;
}

/** Étiquette lisible sur n'importe quel fond. */
export const etiquette = (x, y, s, { ancre = "start", couleur = "#0f172a", taille = 9.5 } = {}) =>
  `<text x="${n1(x)}" y="${n1(y)}" text-anchor="${ancre}" class="halo" style="fill:${couleur};font-size:${taille}px">${esc(s)}</text>`;

/** Tige d'acier verticale, de y0 à y1, centrée en cx. */
export const tige = (cx, y0, y1, largeur = 10) =>
  `<rect x="${n1(cx - largeur / 2)}" y="${n1(y0)}" width="${n1(largeur)}" height="${n1(Math.max(0, y1 - y0))}" fill="${ACIER}" stroke="${ACIER_SOMBRE}" stroke-width="1"/>`
  + `<rect x="${n1(cx - largeur / 2 + 2)}" y="${n1(y0)}" width="${n1(Math.max(1, largeur * 0.18))}" height="${n1(Math.max(0, y1 - y0))}" fill="#f1f5f9" opacity=".8"/>`;

/** Éclats d'un choc autour du point (x, y). */
export const choc = (x, y, r = 14) => [0, 1, 2, 3, 4, 5].map((i) => {
  const a = (i * Math.PI) / 3 + 0.4, c2 = Math.cos(a), s2 = Math.sin(a);
  return `<path d="M${n1(x + r * c2)} ${n1(y + r * s2)}L${n1(x + (r + 7) * c2)} ${n1(y + (r + 7) * s2)}" stroke="${ROUGE}" stroke-width="2" stroke-linecap="round"/>`;
}).join("");

/**
 * Fond de forage vu à la loupe : le trépan tourne au fond du trou, les déblais
 * remontent avec le fluide. cx, yFond : centre et fond du trou ; largeur du trou.
 */
export function trepan({ cx, yFond, largeur, t }) {
  const l2 = largeur / 2;
  let s = `<rect x="${n1(cx - l2)}" y="0" width="${n1(largeur)}" height="${n1(yFond)}" fill="#e2e8f0"/>`;
  for (let i = 0; i < 9; i++) {
    const p = (t * 0.7 + i / 9) % 1, x = cx - l2 + 4 + ((i * 37) % 10) / 10 * (largeur - 8);
    s += `<circle cx="${n1(x)}" cy="${n1(yFond - 18 - p * (yFond - 18))}" r="${n1(1.2 + (i % 3) * 0.5)}" fill="#78716c"/>`;
  }
  s += tige(cx, 0, yFond - 16, 12);
  s += `<path d="M${n1(cx - l2 + 2)} ${n1(yFond - 16)}h${n1(largeur - 4)}l-3 16h${n1(-(largeur - 10))}z" fill="#475569" stroke="#1e293b"/>`;
  // Taillants qui défilent : l'outil tourne.
  for (let i = 0; i < 4; i++) {
    const p = ((t * 1.6 + i / 4) % 1), x = cx - l2 + 5 + p * (largeur - 10), w = 2 + 4 * Math.sin(Math.PI * p);
    s += `<path d="M${n1(x - w / 2)} ${n1(yFond - 1)}l${n1(w / 2)} 4l${n1(w / 2)} -4z" fill="#e2e8f0" stroke="#1e293b" stroke-width=".6"/>`;
  }
  return s;
}
