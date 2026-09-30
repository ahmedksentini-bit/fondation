// Boîte à outils des figures SVG : coupes de sol, semelles, pieux, cotes,
// efforts et graphiques. Tout est produit sous forme de chaîne SVG — la même
// figure sert au cours, à l'exerciseur, au bureau de calcul et à l'impression.

export const COULEURS = {
  encre: "#0f172a", trait: "#334155", discret: "#64748b", grille: "#e2e8f0",
  beton: "#cbd5e1", betonTrait: "#475569",
  eau: "#0077be", eauFond: "rgba(0,119,190,0.12)",
  effort: "#dc2626", reaction: "#0f766e", cote: "#2b2d42",
  f62: "#b45309", ec7: "#0f766e", bleu: "#0369a1", cyan: "#0891b2", rouge: "#b91c1c", violet: "#7c3aed",
};

/** Teintes et motifs par nature de terrain. */
export const SOLS = {
  remblai: { nom: "Remblai", fond: "#eadfd2", motif: "remblai" },
  argile: { nom: "Argile", fond: "#dccab0", motif: "argile" },
  limon: { nom: "Limon", fond: "#e8dcc3", motif: "argile" },
  intermediaire: { nom: "Sol intermédiaire", fond: "#e9dbb7", motif: "sable" },
  sable: { nom: "Sable", fond: "#f3e5ae", motif: "sable" },
  grave: { nom: "Grave", fond: "#e3d3a0", motif: "grave" },
  craie: { nom: "Craie", fond: "#f4f6f8", motif: "craie" },
  marne: { nom: "Marne", fond: "#cfd8c7", motif: "marne" },
  roche: { nom: "Roche", fond: "#b8bec7", motif: "roche" },
  tourbe: { nom: "Tourbe", fond: "#8d7a64", motif: "argile" },
};
export const solDe = (cle = "") => {
  const k = String(cle).split("-")[0];
  if (k.startsWith("intermediaire")) return SOLS.intermediaire;
  return SOLS[k] ?? SOLS.argile;
};

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const fmt = (x, c = 3) => (Number.isFinite(x) ? Number(x).toLocaleString("fr-FR", { maximumSignificantDigits: c }) : "—");

let compteur = 0;
/** Préfixe unique par figure : deux figures d'une même page ne partagent pas leurs motifs. */
const nouvelId = () => `f${(compteur++).toString(36)}`;

function defs(id) {
  return `<defs>
    <marker id="${id}-fl" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0 0l9 4.5-9 4.5z" fill="${COULEURS.effort}"/></marker>
    <marker id="${id}-fr" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0 0l9 4.5-9 4.5z" fill="${COULEURS.reaction}"/></marker>
    <marker id="${id}-fb" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0 0l9 4.5-9 4.5z" fill="${COULEURS.bleu}"/></marker>
    <marker id="${id}-fc" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto-start-reverse"><path d="M0 0l7 3.5-7 3.5z" fill="${COULEURS.cote}"/></marker>
    <pattern id="${id}-argile" width="14" height="8" patternUnits="userSpaceOnUse"><path d="M1 4h6" stroke="#8b7355" stroke-width="1" opacity=".55"/></pattern>
    <pattern id="${id}-sable" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".9" fill="#8a6d1f" opacity=".55"/><circle cx="6.5" cy="6" r=".9" fill="#8a6d1f" opacity=".5"/></pattern>
    <pattern id="${id}-grave" width="14" height="12" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="2.2" fill="none" stroke="#7c6a3a" stroke-width=".9" opacity=".6"/><circle cx="10.5" cy="9" r="1.6" fill="none" stroke="#7c6a3a" stroke-width=".9" opacity=".55"/></pattern>
    <pattern id="${id}-craie" width="16" height="10" patternUnits="userSpaceOnUse"><path d="M0 0h16M0 5h16M4 0v5M12 5v5" stroke="#94a3b8" stroke-width=".8" fill="none" opacity=".6"/></pattern>
    <pattern id="${id}-marne" width="12" height="10" patternUnits="userSpaceOnUse"><path d="M0 3h12M0 8h5" stroke="#5b6b52" stroke-width=".9" opacity=".5"/></pattern>
    <pattern id="${id}-roche" width="18" height="14" patternUnits="userSpaceOnUse"><path d="M0 7h18M9 0v7M3 7v7M15 7v7" stroke="#4b5563" stroke-width=".9" fill="none" opacity=".55"/></pattern>
    <pattern id="${id}-remblai" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M2 10l3-3M7 11l2-2M8 4l2-2" stroke="#7c6a58" stroke-width=".9" opacity=".6"/></pattern>
    <pattern id="${id}-beton" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0v7" stroke="#94a3b8" stroke-width="1"/></pattern>
  </defs>`;
}

/** Cadre SVG commun ; `contenu(id)` reçoit le préfixe des motifs. */
export function svg({ largeur = 560, hauteur = 300, titre = "", contenu }) {
  const id = nouvelId();
  return `<svg viewBox="0 0 ${largeur} ${hauteur}" role="img" aria-label="${esc(titre)}" xmlns="http://www.w3.org/2000/svg">
  ${defs(id)}<style>text{font-family:Inter,-apple-system,"Segoe UI",sans-serif;font-size:12px;fill:${COULEURS.encre}}.pt{font-size:11px;fill:${COULEURS.discret}}.gr{font-weight:800}</style>
  ${contenu(id)}</svg>`;
}

export const texte = (x, y, s, attrs = "") => `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" ${attrs}>${esc(s)}</text>`;
export const ligne = (x1, y1, x2, y2, couleur = COULEURS.trait, ep = 1.4, attrs = "") =>
  `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="${couleur}" stroke-width="${ep}" fill="none" ${attrs}/>`;

/** Rectangle de sol avec son motif. */
export function couche(id, { x, y, w, h, sol, etiquette = null, cote = "droite" }) {
  const s = typeof sol === "string" ? solDe(sol) : sol;
  let t = `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${s.fond}"/>
    <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="url(#${id}-${s.motif})"/>`;
  if (etiquette && h > 13) {
    const tx = cote === "droite" ? x + w - 6 : x + 6;
    t += texte(tx, y + Math.min(h / 2 + 4, 18), etiquette, `text-anchor="${cote === "droite" ? "end" : "start"}" class="gr" style="font-size:11px"`);
  }
  return t;
}

/** Ligne de cote avec flèches aux deux bouts et libellé. */
export function cote(id, x1, y1, x2, y2, libelle, { cote: position = "haut", decalage = 5 } = {}) {
  const vertical = Math.abs(x2 - x1) < Math.abs(y2 - y1);
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const lx = vertical ? mx + (position === "gauche" ? -decalage : decalage) : mx;
  const ly = vertical ? my + 4 : my + (position === "bas" ? 14 : -decalage);
  const ancre = vertical ? (position === "gauche" ? "end" : "start") : "middle";
  return `${ligne(x1, y1, x2, y2, COULEURS.cote, 1.1, `marker-start="url(#${id}-fc)" marker-end="url(#${id}-fc)"`)}
    ${libelle ? texte(lx, ly, libelle, `text-anchor="${ancre}" style="font-size:11.5px;font-weight:700;fill:${COULEURS.cote}"`) : ""}`;
}

/** Flèche d'effort (rouge), de réaction (vert) ou d'écoulement (bleu). */
export function fleche(id, x1, y1, x2, y2, { type = "effort", libelle = "", ep = 2.4, position = "fin" } = {}) {
  const couleur = type === "reaction" ? COULEURS.reaction : type === "bleu" ? COULEURS.bleu : COULEURS.effort;
  const m = type === "reaction" ? "fr" : type === "bleu" ? "fb" : "fl";
  const lx = position === "fin" ? x2 : x1, ly = position === "fin" ? y2 : y1;
  const dx = x2 - x1, dy = y2 - y1;
  const tx = lx + (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 6 : -6) : 7);
  const ty = ly + (Math.abs(dy) >= Math.abs(dx) ? (dy > 0 ? 14 : -6) : -6);
  const ancre = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "start" : "end") : "start";
  return `${ligne(x1, y1, x2, y2, couleur, ep, `marker-end="url(#${id}-${m})"`)}
    ${libelle ? texte(tx, ty, libelle, `text-anchor="${ancre}" style="font-weight:800;fill:${couleur}"`) : ""}`;
}

/** Symbole de nappe (triangle inversé) et trait du niveau d'eau. */
export function nappe(x, y, largeur) {
  return `${ligne(x, y, x + largeur, y, COULEURS.eau, 1.4, 'stroke-dasharray="6 4"')}
    <path d="M${x + 14} ${y - 1}l6-9h-12z" fill="${COULEURS.eau}"/>`;
}

// ───────────────────────────── Graphique x–y ──────────────────────────────

/**
 * Graphique cartésien : séries de points, axes gradués, légende.
 * series : [{ points: [[x, y]], couleur, libelle, tirets, epaisseur, points: bool }]
 * inverserY : pour un profil en profondeur (z croissant vers le bas).
 */
export function graphe({
  largeur = 560, hauteur = 300, xmin, xmax, ymin, ymax, xlabel = "", ylabel = "", series = [],
  titre = "", inverserY = false, pasX = null, pasY = null, marques = [], legende = true, zones = [],
}) {
  const g = { gauche: 58, droite: 18, haut: 18, bas: 44 };
  const W = largeur - g.gauche - g.droite, H = hauteur - g.haut - g.bas;
  const X = (x) => g.gauche + ((x - xmin) / (xmax - xmin)) * W;
  const Y = (y) => inverserY ? g.haut + ((y - ymin) / (ymax - ymin)) * H : g.haut + H - ((y - ymin) / (ymax - ymin)) * H;
  const pas = (a, b, voulu) => {
    if (voulu) return voulu;
    const brut = (b - a) / 6, p = 10 ** Math.floor(Math.log10(brut)), r = brut / p;
    return (r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10) * p;
  };
  const px = pas(xmin, xmax, pasX), py = pas(ymin, ymax, pasY);
  return svg({
    largeur, hauteur, titre, contenu: (id) => {
      let s = "";
      for (const z of zones) {
        s += `<rect x="${X(z.x0).toFixed(1)}" y="${Math.min(Y(z.y0), Y(z.y1)).toFixed(1)}" width="${(X(z.x1) - X(z.x0)).toFixed(1)}" height="${Math.abs(Y(z.y1) - Y(z.y0)).toFixed(1)}" fill="${z.couleur}" opacity="${z.opacite ?? 0.18}"/>`;
        if (z.libelle) s += texte(X(z.x0) + 4, Math.min(Y(z.y0), Y(z.y1)) + 13, z.libelle, `class="pt"`);
      }
      for (let x = Math.ceil(xmin / px) * px; x <= xmax + 1e-9; x += px) {
        s += ligne(X(x), g.haut, X(x), g.haut + H, COULEURS.grille, 1);
        s += texte(X(x), g.haut + H + 16, fmt(x, 4), `text-anchor="middle" class="pt"`);
      }
      for (let y = Math.ceil(ymin / py) * py; y <= ymax + 1e-9; y += py) {
        s += ligne(g.gauche, Y(y), g.gauche + W, Y(y), COULEURS.grille, 1);
        s += texte(g.gauche - 7, Y(y) + 4, fmt(y, 4), `text-anchor="end" class="pt"`);
      }
      s += `<rect x="${g.gauche}" y="${g.haut}" width="${W}" height="${H}" fill="none" stroke="${COULEURS.trait}" stroke-width="1.2"/>`;
      s += texte(g.gauche + W / 2, hauteur - 8, xlabel, `text-anchor="middle" style="font-weight:700"`);
      s += `<text transform="translate(14 ${g.haut + H / 2}) rotate(-90)" text-anchor="middle" style="font-weight:700">${esc(ylabel)}</text>`;
      const clip = `${id}-clip`;
      s += `<clipPath id="${clip}"><rect x="${g.gauche}" y="${g.haut}" width="${W}" height="${H}"/></clipPath>`;
      series.forEach((se) => {
        const pts = se.points.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
        if (!pts.length) return;
        const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${X(x).toFixed(1)} ${Y(y).toFixed(1)}`).join("");
        s += `<path d="${d}" fill="none" stroke="${se.couleur}" stroke-width="${se.epaisseur ?? 2.2}" ${se.tirets ? `stroke-dasharray="${se.tirets}"` : ""} clip-path="url(#${clip})"/>`;
        if (se.marqueurs) pts.forEach(([x, y]) => { s += `<circle cx="${X(x).toFixed(1)}" cy="${Y(y).toFixed(1)}" r="3" fill="${se.couleur}"/>`; });
      });
      for (const m of marques) {
        s += `<circle cx="${X(m.x).toFixed(1)}" cy="${Y(m.y).toFixed(1)}" r="${m.rayon ?? 5}" fill="${m.couleur ?? COULEURS.effort}" stroke="#fff" stroke-width="1.5"/>`;
        if (m.guides) {
          s += ligne(X(m.x), Y(m.y), X(m.x), inverserY ? g.haut : g.haut + H, m.couleur ?? COULEURS.effort, 1, 'stroke-dasharray="4 3"');
          s += ligne(g.gauche, Y(m.y), X(m.x), Y(m.y), m.couleur ?? COULEURS.effort, 1, 'stroke-dasharray="4 3"');
        }
        if (m.libelle) s += texte(X(m.x) + 8, Y(m.y) - 8, m.libelle, `style="font-weight:800;fill:${m.couleur ?? COULEURS.effort}"`);
      }
      if (legende) {
        const avec = series.filter((se) => se.libelle);
        avec.forEach((se, i) => {
          const lx = g.gauche + 10, ly = g.haut + 14 + i * 16;
          s += `<rect x="${lx - 4}" y="${ly - 11}" width="${Math.min(W - 12, 18 + se.libelle.length * 6.4)}" height="15" fill="#fff" opacity=".85"/>`;
          s += ligne(lx, ly - 4, lx + 16, ly - 4, se.couleur, 2.4, se.tirets ? `stroke-dasharray="${se.tirets}"` : "");
          s += texte(lx + 21, ly, se.libelle, `style="font-size:11px;font-weight:700"`);
        });
      }
      return s;
    },
  });
}

/** Échantillonne une fonction sur [a, b]. */
export const echantillon = (f, a, b, n = 80) => Array.from({ length: n + 1 }, (_, i) => {
  const x = a + ((b - a) * i) / n;
  return [x, f(x)];
});

// ───────────────────────────── Coupe d'une semelle ───────────────────────

/**
 * Coupe transversale d'une semelle : terrain, couches, semelle et poteau,
 * charge V (excentrée de e) et H, cotes B et D, nappe, talus éventuel.
 * couches : [{ z0, z1, sol, etiquette }] depuis le terrain après travaux.
 */
export function coupeSemelle({
  B, D, e = 0, V = null, H = 0, couches = [], zNappe = null, largeur = 560, hauteur = 300,
  profondeurVue = null, epaisseur = null, talus = null, annotations = [], montrerHr = null,
}) {
  const zVue = profondeurVue ?? Math.max(D + 2 * B, 4);
  const marge = { g: 40, d: 40, h: 58, b: 16 };
  const largeurM = Math.max(3.2 * B, B + 5, talus ? talus.d + B + 4 : 0);
  const ech = Math.min((largeur - marge.g - marge.d) / largeurM, (hauteur - marge.h - marge.b) / zVue);
  const x0 = marge.g + ((largeur - marge.g - marge.d) - largeurM * ech) / 2;
  const xC = x0 + (talus ? talus.d * ech + (largeurM - talus.d - B) * ech / 2 + B * ech / 2 : largeurM * ech / 2);
  const yTN = marge.h;
  const Y = (z) => yTN + z * ech;
  return svg({
    largeur, hauteur, titre: "Coupe de la semelle", contenu: (id) => {
      let s = "";
      const xg = x0, xd = x0 + largeurM * ech;
      const liste = couches.length ? couches : [{ z0: 0, z1: zVue, sol: "argile" }];
      for (const c of liste) {
        const a = Math.max(c.z0, 0), b = Math.min(c.z1, zVue);
        if (b <= a) continue;
        s += couche(id, { x: xg, y: Y(a), w: xd - xg, h: (b - a) * ech, sol: c.sol, etiquette: c.etiquette });
      }
      // Talus : on retire la partie du terrain à gauche de l'arête.
      if (talus) {
        const xa = xC - (B / 2) * ech - talus.d * ech; // arête du talus
        const t = Math.tan((talus.beta * Math.PI) / 180);
        const hVue = zVue;
        const xb = xa - (hVue / t) * ech;
        s += `<path d="M${xg} ${yTN - 1}L${xa.toFixed(1)} ${yTN - 1}L${Math.max(xb, xg).toFixed(1)} ${Y(Math.min(hVue, (xa - xg) / ech * t)).toFixed(1)}L${xg} ${Y(Math.min(hVue, (xa - xg) / ech * t)).toFixed(1)}Z" fill="#fff"/>`;
        s += ligne(xa, yTN, Math.max(xb, xg), Y(Math.min(hVue, (xa - xg) / ech * t)), COULEURS.trait, 1.6);
        s += texte(xa - 30, yTN + 26, `β = ${fmt(talus.beta, 3)}°`, `class="pt"`);
        s += cote(id, xa, yTN - 12, xC - (B / 2) * ech, yTN - 12, `d = ${fmt(talus.d, 3)} m`);
      }
      s += ligne(xg, yTN, xd, yTN, COULEURS.trait, 1.8);
      s += texte(xd - 4, yTN - 6, "TN après travaux", `text-anchor="end" class="pt"`);
      if (zNappe !== null && zNappe < zVue) s += nappe(xg, Y(zNappe), xd - xg);
      // Fouille remblayée, semelle et poteau.
      const ep = epaisseur ?? Math.min(Math.max(0.35 * B, 0.3), D);
      const xs = xC - (B / 2) * ech, ws = B * ech;
      s += `<rect x="${xs.toFixed(1)}" y="${Y(D - ep).toFixed(1)}" width="${ws.toFixed(1)}" height="${(ep * ech).toFixed(1)}" fill="${COULEURS.beton}" stroke="${COULEURS.betonTrait}" stroke-width="1.6"/>`;
      s += `<rect x="${xs.toFixed(1)}" y="${Y(D - ep).toFixed(1)}" width="${ws.toFixed(1)}" height="${(ep * ech).toFixed(1)}" fill="url(#${id}-beton)"/>`;
      const bp = Math.max(0.25 * B, 0.2) * ech;
      s += `<rect x="${(xC - bp / 2).toFixed(1)}" y="${(yTN - 34).toFixed(1)}" width="${bp.toFixed(1)}" height="${(Y(D - ep) - yTN + 34).toFixed(1)}" fill="${COULEURS.beton}" stroke="${COULEURS.betonTrait}" stroke-width="1.6"/>`;
      // Charges
      const xe = xC + e * ech;
      if (V !== null) s += fleche(id, xe, yTN - 56, xe, yTN - 36, { libelle: V, position: "debut" });
      if (H) s += fleche(id, xC - bp / 2 - 40, yTN - 28, xC - bp / 2 - 4, yTN - 28, { libelle: "H", position: "debut" });
      if (e) s += cote(id, xC, yTN - 40, xe, yTN - 40, "e");
      // Cotes
      s += cote(id, xs, Y(D) + 12, xs + ws, Y(D) + 12, `B = ${fmt(B, 3)} m`, { cote: "bas" });
      if (D > 0) s += cote(id, xs - 14, yTN, xs - 14, Y(D), `D = ${fmt(D, 3)} m`, { cote: "gauche" });
      if (montrerHr) {
        s += `<rect x="${xs.toFixed(1)}" y="${Y(D).toFixed(1)}" width="${ws.toFixed(1)}" height="${(montrerHr * ech).toFixed(1)}" fill="${COULEURS.bleu}" opacity=".12"/>`;
        s += cote(id, xs + ws + 14, Y(D), xs + ws + 14, Y(D + montrerHr), `hr = ${fmt(montrerHr, 3)} m`);
      }
      for (const a of annotations) s += a(id, { Y, xC, ech, xs, ws, yTN });
      return s;
    },
  });
}

// ─────────────────────────── Profil vertical d'un pieu ───────────────────

/**
 * Pieu dans son terrain, avec à droite un profil de valeurs (pl*, qc ou qs).
 * couches : [{ z0, z1, sol, etiquette }] ; profil : { valeurs: [{ z0, z1, v }],
 * libelle, unite, max } ; zones : [{ z0, z1, couleur, libelle }] (intervalle
 * de pointe, frottement négatif…).
 */
export function coupePieu({ B, D, couches, profil = null, zones = [], largeur = 560, hauteur = 360, zMax = null, tete = 0 }) {
  const zBas = zMax ?? Math.max(D + 4, ...couches.map((c) => c.z1).filter(Number.isFinite).map((z) => Math.min(z, D + 6)));
  const marge = { h: 28, b: 26 };
  const ech = (hauteur - marge.h - marge.b) / (zBas + tete);
  const Y = (z) => marge.h + (z + tete) * ech;
  const xs0 = 30, xs1 = profil ? 290 : largeur - 30;
  const xp = (xs0 + xs1) / 2, wp = Math.max(B * ech, 7);
  return svg({
    largeur, hauteur, titre: "Coupe du pieu", contenu: (id) => {
      let s = "";
      for (const c of couches) {
        const a = Math.max(c.z0, 0), b = Math.min(c.z1, zBas);
        if (b <= a) continue;
        s += couche(id, { x: xs0, y: Y(a), w: xs1 - xs0, h: (b - a) * ech, sol: c.sol, etiquette: c.etiquette, cote: "gauche" });
      }
      for (const z of zones) {
        s += `<rect x="${xs0}" y="${Y(z.z0).toFixed(1)}" width="${xs1 - xs0}" height="${((z.z1 - z.z0) * ech).toFixed(1)}" fill="${z.couleur}" opacity="${z.opacite ?? 0.18}"/>`;
        if (z.libelle) s += texte(xs1 - 6, Y(z.z0) + 13, z.libelle, `text-anchor="end" style="font-size:11px;font-weight:800;fill:${z.couleur}"`);
      }
      s += ligne(xs0, Y(0), xs1, Y(0), COULEURS.trait, 1.8);
      s += `<rect x="${(xp - wp / 2).toFixed(1)}" y="${Y(-tete).toFixed(1)}" width="${wp.toFixed(1)}" height="${((D + tete) * ech).toFixed(1)}" fill="${COULEURS.beton}" stroke="${COULEURS.betonTrait}" stroke-width="1.5"/>`;
      s += `<rect x="${(xp - wp / 2).toFixed(1)}" y="${Y(-tete).toFixed(1)}" width="${wp.toFixed(1)}" height="${((D + tete) * ech).toFixed(1)}" fill="url(#${id}-beton)"/>`;
      s += cote(id, xp + wp / 2 + 12, Y(0), xp + wp / 2 + 12, Y(D), `D = ${fmt(D, 3)} m`);
      // Échelle des profondeurs
      for (let z = 0; z <= zBas + 1e-9; z += zBas > 25 ? 5 : zBas > 12 ? 2 : 1) {
        s += ligne(xs0 - 5, Y(z), xs0, Y(z), COULEURS.trait, 1);
        s += texte(xs0 - 7, Y(z) + 4, fmt(z, 3), `text-anchor="end" class="pt"`);
      }
      if (profil) {
        const px0 = 330, px1 = largeur - 20;
        const vmax = profil.max ?? Math.max(...profil.valeurs.map((p) => p.v)) * 1.15;
        const X = (v) => px0 + (v / vmax) * (px1 - px0);
        s += ligne(px0, Y(0), px0, Y(zBas), COULEURS.trait, 1.2);
        s += ligne(px0, Y(0), px1, Y(0), COULEURS.trait, 1.2);
        s += texte((px0 + px1) / 2, Y(0) - 8, `${profil.libelle} (${profil.unite})`, `text-anchor="middle" style="font-weight:800;font-size:11.5px"`);
        const pasV = vmax > 1000 ? 500 : vmax > 400 ? 100 : vmax > 150 ? 50 : vmax > 40 ? 10 : vmax > 8 ? 2 : vmax > 3 ? 1 : 0.5;
        for (let v = pasV; v < vmax; v += pasV) {
          s += ligne(X(v), Y(0), X(v), Y(zBas), COULEURS.grille, 1);
          s += texte(X(v), Y(zBas) + 14, fmt(v, 4), `text-anchor="middle" class="pt"`);
        }
        let d = "";
        for (const p of profil.valeurs) {
          const a = Math.max(p.z0, 0), b = Math.min(p.z1, zBas);
          if (b <= a) continue;
          d += `M${X(0).toFixed(1)} ${Y(a).toFixed(1)}H${X(p.v).toFixed(1)}V${Y(b).toFixed(1)}H${X(0).toFixed(1)}`;
        }
        s += `<path d="${d}" fill="${profil.couleur ?? COULEURS.bleu}" fill-opacity=".22" stroke="${profil.couleur ?? COULEURS.bleu}" stroke-width="1.6"/>`;
        for (const p of profil.valeurs) {
          const a = Math.max(p.z0, 0), b = Math.min(p.z1, zBas);
          if (b - a < 0.5 || !profil.etiquettes) continue;
          s += texte(X(p.v) + 5, Y((a + b) / 2) + 4, fmt(p.v, 3), `style="font-size:11px;font-weight:800;fill:${profil.couleur ?? COULEURS.bleu}"`);
        }
        s += ligne(px0 - 4, Y(D), px1, Y(D), COULEURS.effort, 1, 'stroke-dasharray="5 4"');
      }
      return s;
    },
  });
}

// ───────────────────────── Diagramme des contraintes ─────────────────────

/** Semelle vue en coupe avec son diagramme de contraintes et la zone comprimée. */
export function figureContraintes({ B, V, e, qmax, qmin, Bc, qref = null, meyerhof = null, largeur = 560, hauteur = 250 }) {
  return svg({
    largeur, hauteur, titre: "Diagramme des contraintes sous la semelle", contenu: (id) => {
      const g = 70, W = largeur - 2 * g;
      const X = (x) => g + (x / B) * W;
      const yS = 78, ech = 110 / Math.max(qmax, 1);
      let s = "";
      s += `<rect x="${g}" y="${yS - 26}" width="${W}" height="26" fill="${COULEURS.beton}" stroke="${COULEURS.betonTrait}" stroke-width="1.5"/>`;
      s += `<rect x="${g}" y="${yS - 26}" width="${W}" height="26" fill="url(#${id}-beton)"/>`;
      const xe = X(B / 2 + e);
      s += fleche(id, xe, 8, xe, yS - 30, { libelle: `V = ${fmt(V, 4)}`, position: "debut" });
      s += ligne(X(B / 2), yS - 30, X(B / 2), yS + 2, COULEURS.discret, 1, 'stroke-dasharray="3 3"');
      // Diagramme : de x = B − Bc (bord décomprimé) à x = B (bord le plus chargé)
      const x0 = B - Bc;
      const pts = [[X(x0), yS], [X(x0), yS + qmin * ech], [X(B), yS + qmax * ech], [X(B), yS]];
      s += `<path d="M${pts.map((p) => p.map((v) => v.toFixed(1)).join(" ")).join("L")}Z" fill="${COULEURS.reaction}" fill-opacity=".2" stroke="${COULEURS.reaction}" stroke-width="1.8"/>`;
      if (x0 > 0) s += `<rect x="${X(0)}" y="${yS}" width="${(X(x0) - X(0)).toFixed(1)}" height="8" fill="#fee2e2"/>` + texte((X(0) + X(x0)) / 2, yS + 22, "décollée", `text-anchor="middle" style="fill:${COULEURS.rouge};font-size:11px;font-weight:800"`);
      s += texte(X(B) + 6, yS + qmax * ech + 4, `q'max = ${fmt(qmax, 4)} kPa`, `style="font-weight:800;fill:${COULEURS.reaction}"`);
      if (qmin > 0) s += texte(X(x0) + 6, yS + qmin * ech + 15, `q'min = ${fmt(qmin, 4)}`, `style="font-weight:700;fill:${COULEURS.reaction}"`);
      if (qref) {
        const xr = X(B - Bc / 4);
        s += ligne(xr, yS, xr, yS + qref * ech, COULEURS.f62, 2, 'stroke-dasharray="5 3"');
        s += texte(xr - 6, yS + qref * ech + 14, `q'ref = ${fmt(qref, 4)} (aux 3/4)`, `text-anchor="end" style="font-weight:800;fill:${COULEURS.f62}"`);
      }
      if (meyerhof) {
        const Bp = B - 2 * Math.abs(e);
        s += `<rect x="${X(B - Bp).toFixed(1)}" y="${(yS + meyerhof * ech).toFixed(1)}" width="${(X(B) - X(B - Bp)).toFixed(1)}" height="2.5" fill="${COULEURS.ec7}"/>`;
        s += texte(X(B - Bp / 2), yS + meyerhof * ech + 16, `Meyerhof : ${fmt(meyerhof, 4)} kPa sur B' = ${fmt(Bp, 3)} m`, `text-anchor="middle" style="font-weight:800;fill:${COULEURS.ec7}"`);
      }
      s += cote(id, X(0), hauteur - 14, X(B), hauteur - 14, `B = ${fmt(B, 3)} m`, { cote: "haut" });
      s += cote(id, X(x0), yS - 36, X(B), yS - 36, `comprimée : ${fmt(100 * Bc / B, 3)} %`);
      return s;
    },
  });
}
