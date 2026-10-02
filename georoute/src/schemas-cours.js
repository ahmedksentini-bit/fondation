// Schémas explicatifs du cours : chaque fonction rend une figure SVG
// autonome, posée par src/cours-schemas.js dans la <figure data-schema="nom">
// du même nom. Les schémas qui suivent un calcul vivent dans le script de
// leur chapitre ; ceux-ci illustrent le texte.

import { svg, ligne, texte, couche, cote, fleche, nappe, placeur, COULEURS, solDe, courbeGranulo } from "./figures.js";

const n1 = (x) => x.toFixed(1);
const poly = (pts, attrs) => `<path d="M${pts.map(([x, y]) => `${n1(x)} ${n1(y)}`).join("L")}Z" ${attrs}/>`;
const trace = (pts, attrs) => `<path d="M${pts.map(([x, y]) => `${n1(x)} ${n1(y)}`).join("L")}" fill="none" ${attrs}/>`;
const etiq = (x, y, s, attrs = "") => texte(x, y, s, `class="halo" style="font-size:11.5px;font-weight:700" ${attrs}`);
/** Remplissage d'un polygone avec le fond et le motif d'un sol. */
const remplir = (id, pts, sol, extra = "") => {
  const s = solDe(sol);
  return poly(pts, `fill="${s.fond}" ${extra}`) + poly(pts, `fill="url(#${id}-${s.motif})"`);
};

// ─────────────────────────────── Chapitre 1 ───────────────────────────────

/**
 * Profil en travers mixte : à gauche le terrain est au-dessus du projet
 * (déblai), à droite au-dessous (remblai). La chaussée repose sur la couche
 * de forme, elle-même sur la partie supérieure des terrassements (PST),
 * dont la surface est l'arase.
 */
export function schemaProfilType() {
  return svg({ largeur: 640, hauteur: 320, titre: "Profil en travers mixte : déblai et remblai", contenu: (id) => {
    // Terrain naturel : haut à gauche, bas à droite ; il croise l'arase près de l'axe.
    const tn = [[0, 92], [140, 116], [320, 200], [470, 240], [640, 254]];
    const yAr = 200, yPf = 186, yCh = 174; // arase, plateforme, surface de chaussée
    const xg = 226, xd = 414; // bords de l'arase
    const crete = [88, 107], pied = [596, 250];
    let s = remplir(id, [...tn, [640, 320], [0, 320]], "argile");
    // Déblai : volume enlevé entre le terrain naturel et le talus de déblai.
    s += poly([crete, [140, 116], [320, 200], [xg, yAr]], `fill="#fff" fill-opacity=".75"`);
    s += poly([crete, [140, 116], [320, 200], [xg, yAr]], `fill="url(#${id}-remblai)" opacity=".3"`);
    // Remblai : matériaux rapportés sous l'arase, côté droit.
    s += remplir(id, [[320, 200], [xd, yAr], pied, [470, 240]], "remblai");
    // Terrain naturel en pointillé, dessiné avant la structure qui le masque.
    s += trace(tn, `stroke="${COULEURS.trait}" stroke-width="1.6" stroke-dasharray="7 4"`);
    // PST, couche de forme, chaussée.
    s += poly([[xg, yAr], [xd, yAr], [xd + 22, yAr + 24], [xg + 10, yAr + 24]], `fill="#fde68a" fill-opacity=".55"`);
    s += remplir(id, [[xg, yAr], [xd, yAr], [xd - 12, yPf], [xg + 12, yPf]], "forme", `stroke="${COULEURS.trait}" stroke-width=".8"`);
    s += poly([[xg + 34, yPf], [xd - 34, yPf], [xd - 40, yCh], [xg + 40, yCh]], `fill="#475569" stroke="#1e293b" stroke-width=".8"`);
    // Talus et arase.
    s += trace([crete, [xg, yAr]], `stroke="${COULEURS.trait}" stroke-width="2"`);
    s += trace([[xd, yAr], pied], `stroke="${COULEURS.trait}" stroke-width="2"`);
    s += ligne(xg, yAr, xd, yAr, "#b45309", 2.2);
    // Étiquettes, chacune dans une zone libre.
    s += etiq(14, 80, "terrain naturel (TN)");
    s += etiq(150, 150, "déblai", 'style="font-size:13px;font-weight:800"');
    s += etiq(70, 178, "talus de déblai");
    s += etiq(480, 232, "remblai", 'style="font-size:13px;font-weight:800"') + etiq(505, 214, "talus de remblai");
    s += texte(320, yCh - 6, "chaussée", 'text-anchor="middle" class="halo" style="font-size:11px;font-weight:800"');
    s += texte(320, yPf + 10.5, "couche de forme", 'text-anchor="middle" style="font-size:9.5px;font-weight:800;fill:#1e293b"');
    s += etiq(xg + 20, yAr + 18, "PST (≈ 1 m)", 'style="fill:#92400e"');
    s += etiq(xd + 8, yAr - 5, "arase (AR)", 'style="fill:#b45309"');
    s += fleche(id, 470, 120, xd - 30, yPf - 1, { type: "effort" });
    s += etiq(400, 112, "plateforme support de chaussée (PF)", 'style="fill:#b91c1c"');
    s += etiq(16, 300, "sol en place");
    return s;
  } });
}

/**
 * Zones d'un remblai d'infrastructure (NF EN 16907-1) : A base, B noyau,
 * C encagements (bords), D zone supérieure — PST et couche de forme — sous
 * la superstructure S (la chaussée).
 */
export function schemaZonesRemblai() {
  return svg({ largeur: 640, hauteur: 300, titre: "Zones d'un remblai", contenu: (id) => {
    const yb = 250, yh = 70; // base et sommet
    const xg0 = 40, xd0 = 600, xg1 = 220, xd1 = 420; // pied et crête
    let s = remplir(id, [[0, yb], [640, yb], [640, 300], [0, 300]], "argile");
    // Base A.
    s += poly([[xg0 + 8, yb], [xd0 - 8, yb], [xd0 - 30, yb - 22], [xg0 + 30, yb - 22]], `fill="#d6d3d1"`);
    // Noyau B.
    s += remplir(id, [[xg0 + 30 + 34, yb - 22], [xd0 - 30 - 34, yb - 22], [xd1 + 6, yh + 46], [xg1 - 6, yh + 46]], "remblai");
    // Encagements C (bords).
    s += poly([[xg0 + 30, yb - 22], [xg0 + 64, yb - 22], [xg1 - 6, yh + 46], [xg1 - 30, yh + 46]], `fill="#bbf7d0" fill-opacity=".8"`);
    s += poly([[xd0 - 30, yb - 22], [xd0 - 64, yb - 22], [xd1 + 6, yh + 46], [xd1 + 30, yh + 46]], `fill="#bbf7d0" fill-opacity=".8"`);
    // Zone supérieure D : PST puis couche de forme.
    s += poly([[xg1 - 30, yh + 46], [xd1 + 30, yh + 46], [xd1 + 12, yh + 22], [xg1 - 12, yh + 22]], `fill="#fde68a" fill-opacity=".85"`);
    s += poly([[xg1 - 12, yh + 22], [xd1 + 12, yh + 22], [xd1 + 4, yh + 10], [xg1 - 4, yh + 10]], `fill="${solDe("forme").fond}"`);
    s += poly([[xg1 + 20, yh + 10], [xd1 - 20, yh + 10], [xd1 - 26, yh], [xg1 + 26, yh]], `fill="#475569"`);
    // Contour du remblai.
    s += trace([[xg0, yb], [xg1, yh + 10], [xd1, yh + 10], [xd0, yb]], `stroke="${COULEURS.trait}" stroke-width="2"`);
    s += ligne(0, yb, 640, yb, COULEURS.trait, 1.6);
    // Repères.
    const pastille = (x, y, l) => `<circle cx="${x}" cy="${y}" r="11" fill="#0f172a"/>` + texte(x, y + 4, l, 'text-anchor="middle" style="font-size:12px;font-weight:900;fill:#fff"');
    s += pastille(320, yb - 11, "A") + pastille(320, 170, "B") + pastille(118, 200, "C") + pastille(522, 200, "C") + pastille(320, yh + 34, "D") + pastille(320, yh - 14, "S");
    s += etiq(338, yb - 7, "base : contact avec le terrain, drainage");
    s += etiq(338, 174, "noyau : le corps du remblai, compacté à l'objectif q4");
    s += texte(320, yh + 18, "couche de forme (q3)", 'text-anchor="middle" style="font-size:9.5px;font-weight:800;fill:#1e293b"');
    s += etiq(442, yh + 40, "PST, zone supérieure", 'style="fill:#92400e"');
    s += etiq(338, yh - 10, "superstructure : la chaussée");
    s += etiq(24, 160, "encagements :", 'style="fill:#166534"') + etiq(24, 174, "talus, filtres,", 'style="fill:#166534"') + etiq(24, 188, "protections", 'style="fill:#166534"');
    return s;
  } });
}

/** La démarche du GTR, de l'échantillon au contrôle. */
export function schemaDemarche() {
  const etapes = [
    ["Identifier", "granularité, argilosité, état hydrique, résistance des éléments"],
    ["Classer", "classe F, I, S, G, VC, roche… et son état : th, h, m, s, ts ou ins"],
    ["Choisir l'emploi", "remblai ou couche de forme, selon la météo du jour"],
    ["Compacter", "objectif q4 ou q3, compacteur, épaisseur, Q/S"],
    ["Contrôler", "Q/S réel, densité en place, portance de l'arase et de la plateforme"],
  ];
  return svg({ largeur: 640, hauteur: 300, titre: "La démarche du GTR", contenu: () => {
    let s = "";
    etapes.forEach(([titre, detail], i) => {
      const y = 18 + i * 56, x = 20;
      s += `<rect x="${x}" y="${y}" width="170" height="40" rx="10" fill="${i === 4 ? "#0f766e" : "#075985"}"/>`;
      s += texte(x + 85, y + 25, `${i + 1}. ${titre}`, 'text-anchor="middle" style="font-size:13.5px;font-weight:800;fill:#fff"');
      s += texte(x + 186, y + 25, detail, 'style="font-size:12px;fill:#334155"');
      if (i < etapes.length - 1) s += `<path d="M${x + 85} ${y + 41}v11" stroke="#64748b" stroke-width="2"/><path d="M${x + 80} ${y + 49}l5 6l5-6z" fill="#64748b"/>`;
    });
    return s;
  } });
}

// ─────────────────────────────── Chapitre 2 ───────────────────────────────

/** Lecture d'une courbe granulométrique au sens du GTR 2024 : fines, sable, grave, D10, D60. */
export function schemaFractions() {
  const courbe = [[0.002, 2], [0.02, 6], [0.063, 12], [0.125, 18], [0.25, 26], [0.5, 36], [1, 46], [2, 52], [4, 60], [10, 74], [20, 86], [40, 96], [63, 100]];
  const D = (x) => { for (let i = 1; i < courbe.length; i++) if (x <= courbe[i][1]) { const [d0, p0] = courbe[i - 1], [d1, p1] = courbe[i]; return d0 * Math.exp((Math.log(d1 / d0) * (x - p0)) / (p1 - p0)); } return NaN; };
  const D10 = D(10), D60 = D(60);
  return courbeGranulo({
    largeur: 620, hauteur: 330, dMin: 0.001, dMax: 100,
    series: [{ points: courbe, couleur: COULEURS.bleu, epaisseur: 3, marqueurs: true, libelle: "sol étudié" },
      { points: [[0.063, 12], [0.063, 12]], couleur: "#fff", epaisseur: 0 }],
    marques: [
      { x: 0.063, y: 12, couleur: COULEURS.rouge, libelle: "fines : 12 %", guides: true },
      { x: 2, y: 52, couleur: "#b45309", libelle: "tamisat 2 mm : 52 %", guides: true },
      { x: D10, y: 10, couleur: COULEURS.violet, libelle: `D10 = ${D10.toFixed(3).replace(".", ",")} mm`, guides: true },
      { x: D60, y: 60, couleur: COULEURS.violet, libelle: `D60 = ${D60.toFixed(1).replace(".", ",")} mm`, guides: true },
    ],
    textes: [{ x: 0.35, y: 88, texte: "sable 0,063/2 mm : 40 %", couleur: "#92400e", taille: 11.5 }, { x: 8, y: 30, texte: "grave 2/63 mm : 48 %", couleur: "#44403c", taille: 11.5 }],
  });
}

// ─────────────────────────────── Chapitre 5 ───────────────────────────────

/** Boîte de schéma : bandeau titre coloré, lignes de texte dessous. */
function boite(x, y, w, h, titre, lignes, couleur = "#075985", { fond = "#fff" } = {}) {
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" fill="${fond}" stroke="${couleur}" stroke-width="1.6"/>`;
  s += `<path d="M${x} ${y + 9}a9 9 0 0 1 9 -9h${w - 18}a9 9 0 0 1 9 9v12h${-w}z" fill="${couleur}"/>`;
  s += texte(x + w / 2, y + 15, titre, 'text-anchor="middle" style="font-size:12px;font-weight:800;fill:#fff"');
  lignes.forEach((l, i) => { s += texte(x + w / 2, y + 36 + i * 15, l, 'text-anchor="middle" style="font-size:11.5px;fill:#1e293b"'); });
  return s;
}
const flecheGrise = (x1, y1, x2, y2, tirets = false) => `${ligne(x1, y1, x2, y2, "#64748b", 1.8, tirets ? 'stroke-dasharray="5 4"' : "")}`
  + (() => { const a = Math.atan2(y2 - y1, x2 - x1), c = Math.cos(a), s = Math.sin(a);
    return `<path d="M${n1(x2)} ${n1(y2)}L${n1(x2 - 9 * c + 4.5 * s)} ${n1(y2 - 9 * s - 4.5 * c)}L${n1(x2 - 9 * c - 4.5 * s)} ${n1(y2 - 9 * s + 4.5 * c)}Z" fill="#64748b"/>`; })();

/**
 * Synoptique de la classification des sols du GTR 2024 : matières
 * organiques, Dmax (sols VC), teneur en fines (F, I, S/G), argilosité ou
 * granularité, comportement, état hydrique ou « ins ».
 */
export function schemaSynoptique() {
  return svg({ largeur: 640, hauteur: 384, titre: "Classification des sols du GTR 2024", contenu: () => {
    const T = "#0f766e", B = "#075985", O = "#92400e", G = "#475569";
    let s = "";
    s += boite(222, 6, 196, 40, "Sol prélevé", ["fraction 0/63 mm analysée"], G);
    s += boite(16, 60, 196, 54, "Matières organiques", ["2 à 20 % : O1, O2 en tête", "> 20 % : O3, tourbe exclue"], O, { fond: "#fffbeb" });
    s += boite(222, 64, 196, 40, "Dmax > 63 mm ?", ["oui : VC → · non : F, I, S, G"], B, { fond: "#f0f9ff" });
    s += boite(428, 60, 196, 54, "VC1 · VC2", ["charpenté (VC1) ou non (VC2),", "puis la fraction 0/63 mm"], T, { fond: "#f0fdfa" });
    s += flecheGrise(320, 46, 320, 63);
    // Les matières organiques se regardent d'abord, sur le sol prélevé.
    s += ligne(222, 26, 114, 26, "#64748b", 1.8, 'stroke-dasharray="5 4"') + flecheGrise(114, 26, 114, 59, true);
    s += flecheGrise(418, 84, 427, 84);
    // Répartition par la teneur en fines.
    s += ligne(320, 104, 320, 122, "#64748b", 1.8) + ligne(114, 122, 526, 122, "#64748b", 1.8);
    s += ligne(526, 114, 526, 122, "#64748b", 1.8, 'stroke-dasharray="5 4"');
    for (const x of [114, 320, 526]) s += flecheGrise(x, 122, x, 137);
    s += texte(334, 117, "tamisat à 63 µm", 'class="halo" style="font-size:11px;font-weight:800;fill:#475569"');
    const col = [
      ["F · sol fin", "> 35 %", ["Argilosité", "VBS si IP ≤ 12, sinon IP", "F1 · F2 · F3 · F4 (F4+)"], ["État hydrique", "th · h · m · s · ts", "par IPI, Ic ou wn/wOPN"]],
      ["I · intermédiaire", "de 15 à 35 %", ["Argilosité", "VBS ≤ 1,5 ou IP ≤ 12 : I1", "sinon I2"], ["État hydrique", "th · h · m · s · ts", "par IPI, Ic ou wn/wOPN"]],
      ["S ou G", "≤ 15 % ; S si 0,063/2 > 2/63", ["Granularité", "fines ≤ 5 % ou 5 à 15 %,", "Cu ≥ 6 ou < 6 : S1…S4, G1…G4"], ["Comportement, eau", "FS ≤ 60 · LA, MDE ≤ 45 : 1 ou 2", "puis « ins » ou état hydrique"]],
    ];
    col.forEach(([t, seuil, [t3, ...l3], [t4, ...l4]], i) => {
      const x = 16 + i * 206;
      s += boite(x, 138, 196, 40, t, [seuil], B);
      s += flecheGrise(x + 98, 178, x + 98, 191);
      s += boite(x, 192, 196, 66, t3, l3, B, { fond: "#f8fafc" });
      s += flecheGrise(x + 98, 258, x + 98, 271);
      s += boite(x, 272, 196, 66, t4, l4, i === 2 ? T : B, { fond: "#f8fafc" });
    });
    s += `<rect x="16" y="350" width="608" height="28" rx="8" fill="#0f172a"/>`;
    s += texte(320, 368, "Symboles : F1h · I2m · S21ins · G31h · VC2G31ins · O1F2m", 'text-anchor="middle" style="font-size:12.5px;font-weight:800;fill:#fff"');
    return s;
  } });
}

/** Anatomie de deux symboles du GTR 2024 : ce que dit chaque partie. */
export function schemaSymbole() {
  const exemples = [
    { parts: [["VC2", "#0f766e", "gros éléments :", "la fraction 0/63 mm gouverne"], ["G3", "#075985", "nature : grave,", "5 à 15 % de fines, étalée"], ["1", "#7c3aed", "comportement :", "LA ≤ 45 et MDE ≤ 45"], ["h", "#3b82f6", "état hydrique :", "humide"]] },
    { parts: [["S2", "#075985", "nature : sable propre,", "uniforme (Cu < 6)"], ["1", "#7c3aed", "comportement :", "FS ≤ 60"], ["ins", "#15803d", "insensible à l'eau :", "pas d'état hydrique"]] },
  ];
  return svg({ largeur: 640, hauteur: 250, titre: "Lire un symbole du GTR 2024", contenu: () => {
    let s = "";
    exemples.forEach(({ parts }, k) => {
      const y = 14 + k * 122;
      const larg = parts.map(([p]) => 18 + p.length * 15);
      let x = 70;
      const centres = [];
      parts.forEach(([p, c], i) => {
        s += `<rect x="${x}" y="${y}" width="${larg[i]}" height="38" rx="7" fill="${c}"/>`;
        s += texte(x + larg[i] / 2, y + 26, p, 'text-anchor="middle" style="font-size:21px;font-weight:900;fill:#fff;letter-spacing:.02em"');
        centres.push(x + larg[i] / 2);
        x += larg[i] + 6;
      });
      // Légendes en éventail sous le symbole, reliées à leur partie.
      const n = parts.length, pas = 150, x0 = 320 - ((n - 1) * pas) / 2;
      parts.forEach(([, c, l1, l2], i) => {
        const lx = x0 + i * pas;
        s += `<path d="M${n1(centres[i])} ${y + 39}L${n1(centres[i])} ${y + 50}L${n1(lx)} ${y + 62}L${n1(lx)} ${y + 66}" stroke="${c}" stroke-width="1.6" fill="none"/>`;
        s += texte(lx, y + 80, l1, `text-anchor="middle" style="font-size:11.5px;font-weight:800;fill:${c}"`);
        s += texte(lx, y + 95, l2, 'text-anchor="middle" style="font-size:11.5px;fill:#334155"');
      });
    });
    return s;
  } });
}

// ─────────────────────────────── Chapitre 6 ───────────────────────────────

/** Bouteur vu de profil, lame à droite, posé sur y ; s : échelle. */
function bouteur(x, y, s = 1, couleur = "#f59e0b") {
  return `<rect x="${n1(x)}" y="${n1(y - 14 * s)}" width="${n1(70 * s)}" height="${n1(14 * s)}" rx="${n1(7 * s)}" fill="#334155"/>`
    + [12, 26, 40, 54].map((c) => `<circle cx="${n1(x + c * s + 2)}" cy="${n1(y - 7 * s)}" r="${n1(4 * s)}" fill="#64748b"/>`).join("")
    + `<rect x="${n1(x + 6 * s)}" y="${n1(y - 34 * s)}" width="${n1(52 * s)}" height="${n1(20 * s)}" rx="${n1(3 * s)}" fill="${couleur}"/>`
    + `<rect x="${n1(x + 12 * s)}" y="${n1(y - 54 * s)}" width="${n1(22 * s)}" height="${n1(20 * s)}" rx="${n1(3 * s)}" fill="${couleur}"/>`
    + `<rect x="${n1(x + 16 * s)}" y="${n1(y - 50 * s)}" width="${n1(14 * s)}" height="${n1(10 * s)}" fill="#bae6fd"/>`
    + ligne(x + 56 * s, y - 22 * s, x + 74 * s, y - 18 * s, "#334155", 3 * s)
    + `<path d="M${n1(x + 72 * s)} ${n1(y - 38 * s)}h${n1(8 * s)}l${n1(5 * s)} ${n1(38 * s)}h${n1(-13 * s)}z" fill="#475569"/>`;
}

/** Tombereau vu de profil, benne levée vers la gauche ; posé sur y. */
function tombereau(x, y, s = 1) {
  return `<circle cx="${n1(x + 14 * s)}" cy="${n1(y - 9 * s)}" r="${n1(9 * s)}" fill="#1f2937"/><circle cx="${n1(x + 58 * s)}" cy="${n1(y - 9 * s)}" r="${n1(9 * s)}" fill="#1f2937"/>`
    + `<rect x="${n1(x + 2 * s)}" y="${n1(y - 22 * s)}" width="${n1(72 * s)}" height="${n1(8 * s)}" fill="#475569"/>`
    + `<rect x="${n1(x + 56 * s)}" y="${n1(y - 44 * s)}" width="${n1(20 * s)}" height="${n1(22 * s)}" rx="${n1(3 * s)}" fill="#f59e0b"/>`
    + `<rect x="${n1(x + 61 * s)}" y="${n1(y - 40 * s)}" width="${n1(11 * s)}" height="${n1(8 * s)}" fill="#bae6fd"/>`
    + `<path d="M${n1(x + 50 * s)} ${n1(y - 24 * s)}L${n1(x - 6 * s)} ${n1(y - 40 * s)}L${n1(x - 2 * s)} ${n1(y - 66 * s)}L${n1(x + 44 * s)} ${n1(y - 52 * s)}Z" fill="#d97706" stroke="#92400e" stroke-width="1"/>`;
}

/** Quelques blocs anguleux autour de (x, y), de taille t. */
function blocs(liste) {
  return liste.map(([x, y, t]) => `<path d="M${n1(x - t)} ${n1(y)}l${n1(t * 0.4)} ${n1(-t * 0.9)}l${n1(t)} ${n1(-t * 0.2)}l${n1(t * 0.7)} ${n1(t * 0.8)}l${n1(-t * 0.5)} ${n1(t * 0.5)}z" fill="#a8a29e" stroke="#57534e" stroke-width="1"/>`).join("");
}

/**
 * Régalage des matériaux rocheux [F1 § 3.3, figure 9] : déchargement sur la
 * couche en cours et poussage au bouteur lourd dans le talus de la couche
 * (bon), ou déchargement sur la couche compactée et étalement au bouteur
 * léger (mauvais).
 */
export function schemaRegalageRocheux() {
  return svg({ largeur: 640, hauteur: 250, titre: "Régalage des matériaux rocheux", contenu: (id) => {
    let s = "";
    const panneau = (x0, bon) => {
      let p = `<rect x="${x0}" y="6" width="306" height="236" rx="10" fill="${bon ? "#f0fdf4" : "#fef2f2"}" stroke="${bon ? "#16a34a" : "#dc2626"}" stroke-width="1.4"/>`;
      p += texte(x0 + 153, 26, bon ? "BON" : "À ÉVITER", `text-anchor="middle" style="font-size:13px;font-weight:900;fill:${bon ? "#15803d" : "#b91c1c"}"`);
      // Couche inférieure, déjà compactée.
      p += remplir(id, [[x0 + 8, 200], [x0 + 298, 200], [x0 + 298, 234], [x0 + 8, 234]], "remblai");
      p += texte(x0 + 18, 226, "couche compactée", 'class="halo" style="font-size:11px;font-weight:700"');
      return p;
    };
    // Bon : couche en cours de régalage, avec son talus de front.
    s += panneau(8, true);
    s += remplir(id, [[16, 160], [214, 160], [262, 200], [16, 200]], "blocs");
    // Tombereau retourné : il vide sa benne vers la droite, sur la couche en cours.
    s += `<g transform="translate(${n1(2 * (30 + 35 * 0.72))} 0) scale(-1 1)">${tombereau(30, 160, 0.72)}</g>`;
    s += blocs([[108, 160, 8], [118, 156, 7], [128, 160, 9]]);
    s += bouteur(132, 160, 0.95, "#f59e0b");
    s += blocs([[226, 160, 10], [238, 176, 12], [252, 194, 14]]);
    s += `<path d="M216 146q22 4 34 30" fill="none" stroke="#15803d" stroke-width="2" marker-end="url(#${id}-fr)"/>`;
    s += texte(160, 84, "bouteur lourd", 'text-anchor="middle" class="halo" style="font-size:11.5px;font-weight:800;fill:#15803d"');
    s += texte(64, 98, "déchargement sur", 'text-anchor="middle" class="halo" style="font-size:11px;font-weight:700"');
    s += texte(64, 111, "la couche en cours", 'text-anchor="middle" class="halo" style="font-size:11px;font-weight:700"');
    s += texte(268, 116, "poussage", 'text-anchor="middle" class="halo" style="font-size:11px;font-weight:700;fill:#15803d"');
    s += texte(268, 129, "dans le talus", 'text-anchor="middle" class="halo" style="font-size:11px;font-weight:700;fill:#15803d"');
    // À éviter : déchargement sur la couche compactée, étalement au bouteur léger.
    s += panneau(326, false);
    s += tombereau(520, 200, 0.72);
    s += blocs([[452, 200, 13], [470, 200, 11], [461, 186, 12], [488, 200, 10], [476, 182, 9]]);
    s += blocs([[408, 200, 9], [420, 196, 8]]);
    s += bouteur(340, 200, 0.7, "#fbbf24");
    s += texte(372, 140, "bouteur léger", 'text-anchor="middle" class="halo" style="font-size:11.5px;font-weight:800;fill:#b91c1c"');
    s += texte(500, 112, "déchargement sur la", 'text-anchor="middle" class="halo" style="font-size:11px;font-weight:700"');
    s += texte(500, 125, "couche déjà compactée", 'text-anchor="middle" class="halo" style="font-size:11px;font-weight:700"');
    s += texte(462, 160, "tas, vides", 'text-anchor="middle" class="halo" style="font-size:11px;font-weight:700;fill:#b91c1c"');
    return s;
  } });
}

// ─────────────────────────────── Chapitre 10 ──────────────────────────────

/**
 * Coupe de la structure d'assise : chaussée, couche de forme, plateforme
 * (PF), arase (AR), partie supérieure des terrassements (PST, ≈ 1 m),
 * sol support, avec un drainage latéral et une nappe.
 */
export function schemaPST() {
  return svg({ largeur: 640, hauteur: 270, titre: "PST, arase et plateforme", contenu: (id) => {
    const x0 = 60, x1 = 520;
    let s = remplir(id, [[0, 150], [640, 150], [640, 270], [0, 270]], "argile");
    s += poly([[x0, 150], [x1, 150], [x1, 212], [x0, 212]], `fill="#fde68a" fill-opacity=".75"`);
    s += remplir(id, [[x0 + 10, 112], [x1 - 10, 112], [x1, 150], [x0, 150]], "forme", `stroke="${COULEURS.trait}" stroke-width="1"`);
    s += poly([[x0 + 60, 78], [x1 - 60, 78], [x1 - 50, 112], [x0 + 50, 112]], `fill="#475569" stroke="#1e293b" stroke-width="1"`);
    s += ligne(x0 - 20, 150, x1 + 30, 150, "#b45309", 2.4) + ligne(x0 - 10, 112, x1 + 20, 112, "#b91c1c", 2.4);
    // Tranchée drainante latérale et nappe.
    s += poly([[x1 + 40, 150], [x1 + 70, 150], [x1 + 66, 228], [x1 + 44, 228]], `fill="#cbd5e1" stroke="#64748b" stroke-width="1"`);
    s += `<circle cx="${x1 + 55}" cy="218" r="6" fill="#fff" stroke="#0369a1" stroke-width="2"/>`;
    s += nappe(0, 238, 440);
    // Étiquettes.
    s += texte(290, 99, "chaussée", 'text-anchor="middle" style="font-size:12px;font-weight:800;fill:#fff"');
    s += texte(290, 135, "couche de forme", 'text-anchor="middle" style="font-size:12px;font-weight:800;fill:#1e293b"');
    s += texte(290, 186, "PST : partie supérieure des terrassements (≈ 1 m)", 'text-anchor="middle" class="halo" style="font-size:12px;font-weight:800;fill:#92400e"');
    s += etiq(x1 + 26, 108, "plateforme PF", 'style="fill:#b91c1c"') + etiq(x1 + 32, 146, "arase AR", 'style="fill:#b45309"');
    s += etiq(x1 + 8, 250, "drain", 'style="fill:#0369a1"');
    s += etiq(16, 230, "nappe", 'style="fill:#0077be"');
    s += etiq(16, 264, "sol support");
    s += cote(id, 36, 150, 36, 212, "≈ 1 m", { cote: "gauche" });
    return s;
  } });
}

/** Échelles des classes de portance à long terme : arase (AR) et plateforme (PF). */
export function schemaClassesPortance() {
  const X = (E) => 100 + (Math.log10(E / 10) / Math.log10(400 / 10)) * 520;
  const bande = (y, classes, couleur) => classes.map(([nom, a, b], i) => {
    const xa = X(Math.max(a, 10)), xb = X(Math.min(b, 400));
    return `<rect x="${n1(xa)}" y="${y}" width="${n1(xb - xa)}" height="30" fill="${couleur}" fill-opacity="${0.25 + 0.15 * i}" stroke="#fff" stroke-width="2"/>`
      + texte((xa + xb) / 2, y + 20, nom, 'text-anchor="middle" style="font-size:12.5px;font-weight:900;fill:#0f172a"');
  }).join("");
  return svg({ largeur: 640, hauteur: 170, titre: "Classes de portance AR et PF", contenu: () => {
    let s = texte(92, 41, "arase", 'text-anchor="end" style="font-weight:800;fill:#b45309"') + texte(92, 101, "plateforme", 'text-anchor="end" style="font-weight:800;fill:#b91c1c"');
    s += bande(20, [["AR0", 10, 20], ["AR1", 20, 50], ["AR2", 50, 120], ["AR3", 120, 200], ["AR4", 200, 400]], "#f59e0b");
    s += bande(80, [["PF1", 20, 50], ["PF2", 50, 80], ["PF2qs", 80, 120], ["PF3", 120, 200], ["PF4", 200, 400]], "#ef4444");
    for (const E of [20, 50, 80, 120, 200]) s += ligne(X(E), 14, X(E), 120, "#334155", 1, 'stroke-dasharray="3 3"') + texte(X(E), 136, `${E}`, 'text-anchor="middle" style="font-size:11.5px;font-weight:800"');
    s += texte(620, 158, "module EV2 à long terme (MPa), échelle logarithmique", 'text-anchor="end" style="font-size:11px;fill:#64748b"');
    return s;
  } });
}
