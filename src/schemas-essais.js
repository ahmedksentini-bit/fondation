// Schémas des appareils d'essai en place (chapitre 2) : ce que l'on voit sur le
// chantier, ce que l'on mesure, et où. Même boîte à outils et mêmes règles que
// src/figures.js : aucun libellé ne se pose sur un tracé ni sur un autre libellé
// (tests/schemas.test.mjs le vérifie), les proportions des appareils sont
// respectées quand l'échelle le permet, exagérées et signalées sinon.

import { svg, couche, ligne, texte, cote, fleche, COULEURS, fmt } from "./figures.js";

const ACIER = "#cbd5e1", ACIER_FONCE = "#94a3b8", TRAIT = COULEURS.betonTrait, EAU = COULEURS.eau;
const r1 = (x) => x.toFixed(1);

/** Libellé simple ; `halo` le détache d'un fond chargé. */
function etiq(x, y, s, { ancre = "start", taille = 11, gras = true, couleur = COULEURS.encre, halo = true, italique = false } = {}) {
  return texte(x, y, s, `text-anchor="${ancre}" ${halo ? 'class="halo"' : ""} style="font-size:${taille}px;font-weight:${gras ? 700 : 400};fill:${couleur}${italique ? ";font-style:italic" : ""}"`);
}
/** Libellé sur plusieurs lignes. */
const etiqs = (x, y, lignes, o = {}) => lignes.map((l, i) => etiq(x, y + i * ((o.taille ?? 11) + 2), l, o)).join("");

/** Libellé relié à ce qu'il désigne par un trait fin terminé d'un point. */
function renvoi(xa, ya, xt, yt, lignes, o = {}) {
  const { ancre = "start", taille = 11 } = o;
  const ls = Array.isArray(lignes) ? lignes : [lignes];
  const xl = ancre === "start" ? xt - 3 : ancre === "end" ? xt + 3 : xt;
  return ligne(xa, ya, xl, yt - taille * 0.35, COULEURS.discret, 0.9)
    + `<circle cx="${r1(xa)}" cy="${r1(ya)}" r="1.9" fill="${COULEURS.discret}"/>` + etiqs(xt, yt, ls, o);
}

const rect = (x, y, w, h, fond, trait = TRAIT, ep = 1.2, attrs = "") =>
  `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" fill="${fond}" stroke="${trait}" stroke-width="${ep}" ${attrs}/>`;
const cercle = (x, y, r, fond, trait = TRAIT, ep = 1.2) => `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r)}" fill="${fond}" stroke="${trait}" stroke-width="${ep}"/>`;
const chemin = (d, fond = "none", trait = TRAIT, ep = 1.2, attrs = "") => `<path d="${d}" fill="${fond}" stroke="${trait}" stroke-width="${ep}" ${attrs}/>`;

/** Couches horizontales empilées : [{ y0, y1, sol }]. */
const terrain = (id, x, w, couches) => couches.map((c) => couche(id, { x, y: c.y0, w, h: c.y1 - c.y0, sol: c.sol })).join("");
/** Trait du terrain naturel. */
const sol = (x0, x1, y) => ligne(x0, y, x1, y, COULEURS.trait, 1.8);
/** Forage : trou blanc, parois en tirets. */
const forage = (xc, y0, y1, w) => `<rect x="${r1(xc - w / 2)}" y="${r1(y0)}" width="${r1(w)}" height="${r1(y1 - y0)}" fill="#fff"/>`
  + ligne(xc - w / 2, y0, xc - w / 2, y1, COULEURS.trait, 1, 'stroke-dasharray="4 3"') + ligne(xc + w / 2, y0, xc + w / 2, y1, COULEURS.trait, 1, 'stroke-dasharray="4 3"');
/** Train de tiges. */
const tiges = (xc, y0, y1, w = 7) => rect(xc - w / 2, y0, w, y1 - y0, ACIER, TRAIT, 1);
/** Niveau d'eau : tirets bleus et triangle. */
const niveauEau = (x0, x1, y, triangle = true) => ligne(x0, y, x1, y, EAU, 1.3, 'stroke-dasharray="6 4"')
  + (triangle ? `<path d="M${r1(x1 - 16)} ${r1(y - 1)}l6-9h-12z" fill="${EAU}"/>` : "");
/** Petite roue. */
const roue = (x, y, r = 11) => cercle(x, y, r, "#334155", "#0f172a", 1) + cercle(x, y, r * 0.42, "#cbd5e1", "#0f172a", 0.8);
/** Flèche courbe de rotation autour d'un axe vertical, vue de côté. */
const rotation = (id, xc, y, rx = 22, ry = 5) => chemin(`M${r1(xc - rx)} ${r1(y)}A${rx} ${ry} 0 1 0 ${r1(xc + rx)} ${r1(y - 1)}`, "none", COULEURS.effort, 1.8, `marker-end="url(#${id}-fl)"`);

/** Masse à main : manche de (x1, y1) à (x2, y2), tête perpendiculaire au manche en (x2, y2). */
function masse(x1, y1, x2, y2) {
  const a = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  return ligne(x1, y1, x2, y2, "#92400e", 2.4)
    + `<g transform="translate(${r1(x2)} ${r1(y2)}) rotate(${r1(a + 90)})"><rect x="-9" y="-5" width="18" height="10" rx="2" fill="#64748b" stroke="#1e293b" stroke-width="1"/></g>`;
}

/** Bruit déterministe dans [−1, 1] : les diagrammes « enregistrés » ne sont pas des marches parfaites. */
const bruit = (z) => 0.5 * Math.sin(12.9 * z) + 0.3 * Math.sin(31.7 * z + 1) + 0.2 * Math.sin(57.1 * z + 2);

// ───────────────────────── Sondage et paramètres de forage ───────────────

/**
 * Sondage carotté vu en coupe, avec la foreuse, la circulation du fluide et le
 * carottier double ; à droite, les paramètres enregistrés en continu sur le
 * même axe des profondeurs : les changements de couche, le toit du rocher et
 * une cavité s'y lisent.
 */
export function schemaForage({ largeur = 640, hauteur = 398 } = {}) {
  return svg({
    largeur, hauteur, titre: "Sondage carotté et enregistrement des paramètres de forage", contenu: (id) => {
      const yS = 128, zMax = 12, Y = (z) => yS + (z * (hauteur - 20 - yS)) / zMax;
      const couches = [
        { z0: 0, z1: 1.2, sol: "remblai", nom: "remblai" }, { z0: 1.2, z1: 4.5, sol: "argile", nom: "argile molle" },
        { z0: 4.5, z1: 7.5, sol: "sable", nom: "sable" }, { z0: 7.5, z1: zMax, sol: "roche", nom: "calcaire" },
      ];
      const cav = [9.0, 9.8];
      const xG = 14, xD = 338, xF = 196, wF = 20;
      let s = terrain(id, xG, xD - xG, couches.map((c) => ({ y0: Y(c.z0), y1: Y(c.z1), sol: c.sol })));
      // Cavité karstique traversée par le forage.
      s += chemin(`M${xF - 64} ${r1(Y(cav[0]) + 6)}C${xF - 40} ${r1(Y(cav[0]) - 4)} ${xF + 30} ${r1(Y(cav[0]) - 3)} ${xF + 58} ${r1(Y(cav[0]) + 5)}`
        + `C${xF + 70} ${r1(Y(cav[1]) - 2)} ${xF + 20} ${r1(Y(cav[1]) + 5)} ${xF - 20} ${r1(Y(cav[1]) + 2)}C${xF - 50} ${r1(Y(cav[1]))} ${xF - 76} ${r1(Y(cav[0]) + 12)} ${xF - 64} ${r1(Y(cav[0]) + 6)}Z`,
      "#f8fafc", COULEURS.trait, 1, 'stroke-dasharray="3 2"');
      s += sol(xG, xD, yS);
      for (const c of couches) s += etiq(xG + 6, Y(c.z0) + 15, c.nom, { taille: 11 });
      // Forage, tubage provisoire en tête, tiges et carottier.
      const zC0 = 10.2, zC1 = 11.6;
      s += forage(xF, yS, Y(zC1) + 2, wF);
      s += rect(xF - wF / 2 - 4, yS - 6, 4, Y(1.8) - yS + 6, "#475569", "#1e293b", 0.8) + rect(xF + wF / 2, yS - 6, 4, Y(1.8) - yS + 6, "#475569", "#1e293b", 0.8);
      s += tiges(xF, 66, Y(zC0));
      // Carottier double : tube extérieur, carotte dans le tube intérieur, couronne.
      s += rect(xF - 8, Y(zC0), 16, Y(zC1) - Y(zC0) - 4, ACIER_FONCE, TRAIT, 1);
      s += rect(xF - 4.5, Y(zC0) + 5, 9, Y(zC1) - Y(zC0) - 10, "#6b7280", "#374151", 0.8);
      s += chemin(`M${xF - 8} ${r1(Y(zC1) - 4)}l2.7 4 2.7-4 2.7 4 2.6-4 2.7 4 2.6-4`, "#111827", "#111827", 1);
      // Foreuse : porteur, mât, tête de rotation, poussée.
      s += rect(xF - 176, yS - 44, 206, 22, "#e2e8f0", TRAIT, 1.2, 'rx="4"');
      s += rect(xF - 176, yS - 80, 50, 36, "#bfdbfe", TRAIT, 1.2, 'rx="5"') + rect(xF - 168, yS - 74, 26, 14, "#e0f2fe", TRAIT, 0.8, 'rx="2"');
      for (const x of [xF - 150, xF - 112, xF - 40]) s += roue(x, yS - 11);
      const xM = xF - 27;
      s += rect(xM, 10, 9, yS - 54, "#fbbf24", "#92400e", 1);
      for (let y = 10; y < yS - 62; y += 18) s += ligne(xM, y, xM + 9, y + 9, "#92400e", 0.8) + ligne(xM + 9, y + 9, xM, y + 18, "#92400e", 0.8);
      s += rect(xF - 16, 46, 32, 20, "#f1f5f9", TRAIT, 1.3, 'rx="3"');
      s += fleche(id, xF, 14, xF, 42, { type: "effort", ep: 2.2 }) + rotation(id, xF, 73, 18, 5);
      // Fluide : bac, pompe, injection par les tiges, retour par l'espace annulaire.
      const xB = 262;
      s += rect(xB, yS - 30, 64, 30, EAU + "22", EAU, 1.2) + rect(xB + 2, yS - 20, 60, 18, "#bae6fd", "none", 0);
      s += cercle(xB + 50, yS - 42, 9, "#e0f2fe", EAU, 1.3) + etiq(xB + 50, yS - 38.5, "P", { ancre: "middle", taille: 10, halo: false, couleur: EAU });
      s += chemin(`M${xB + 50} ${yS - 51}V56H${xF + 16}`, "none", EAU, 2);
      s += fleche(id, xF + 13, 118, xB - 2, 118, { type: "bleu", ep: 1.6 });
      s += fleche(id, xF, Y(3.2), xF, Y(4.6), { type: "bleu", ep: 1.5 });
      s += fleche(id, xF - wF / 2 + 3, Y(6.4), xF - wF / 2 + 3, Y(5.2), { type: "bleu", ep: 1.3 }) + fleche(id, xF + wF / 2 - 3, Y(6.4), xF + wF / 2 - 3, Y(5.2), { type: "bleu", ep: 1.3 });
      // Libellés de l'équipement.
      s += renvoi(xF + 10, 48, xF + 40, 40, ["tête de rotation"], {});
      s += etiq(xM - 5, 24, "mât", { ancre: "end", taille: 11 });
      s += etiq(xF + 7, 24, "poussée", { taille: 10.5, couleur: COULEURS.effort });
      s += etiq(xB + 63, yS - 38, "pompe", { taille: 10.5, couleur: EAU });
      s += etiq(xB + 32, yS + 14, "bac à boue", { ancre: "middle", taille: 10.5, couleur: EAU });
      s += renvoi(xF + wF / 2 + 4, Y(1.1), 242, Y(1.3) + 4, ["tubage provisoire"], {});
      s += renvoi(xF + 3, Y(2.4), 242, Y(2.6) + 4, ["tiges creuses"], {});
      s += renvoi(xF + wF / 2 - 3, Y(5.8), 234, Y(5.3), ["fluide : descend", "par les tiges,", "remonte autour"], { couleur: EAU, taille: 10.5 });
      s += renvoi(xF + 54, Y(cav[0]) + 8, 272, Y(8.3), ["cavité"], {});
      s += renvoi(xF + 8, Y(10.6), 242, Y(9.9), ["carottier double,", "tube intérieur fixe"], { taille: 10.5 });
      s += renvoi(xF + 2, Y(11.1), 242, Y(11.5) + 3, ["carotte"], { taille: 10.5 });
      s += renvoi(xF - 6, Y(zC1) - 2, 116, Y(zC1) - 5, ["couronne"], { ancre: "end" });
      // Axe des profondeurs commun.
      const xA = 356;
      s += ligne(xA, yS, xA, Y(zMax), COULEURS.trait, 1);
      for (let z = 0; z <= zMax; z += 2) s += ligne(xA - 4, Y(z), xA, Y(z), COULEURS.trait, 1) + etiq(xA - 6, Y(z) + 4, fmt(z, 3), { ancre: "end", taille: 10, gras: false, halo: false, couleur: COULEURS.discret });
      s += etiq(xA - 2, yS - 8, "z (m)", { ancre: "end", taille: 10, gras: false, halo: false, couleur: COULEURS.discret });
      // Paramètres enregistrés : vitesse d'avance, poussée, couple.
      const valeur = (z, p) => {
        if (z >= cav[0] && z <= cav[1]) return { VIT: 245, PO: 4, CR: 6 }[p] + 4 * bruit(z);
        const c = couches.find((k) => z >= k.z0 && z < k.z1) ?? couches[couches.length - 1];
        const base = { remblai: { VIT: 75, PO: 26, CR: 32 }, argile: { VIT: 165, PO: 11, CR: 14 }, sable: { VIT: 98, PO: 30, CR: 36 }, roche: { VIT: 18, PO: 78, CR: 62 } }[c.sol][p];
        return base * (1 + (p === "VIT" && c.sol === "roche" ? 0.25 : 0.14) * bruit(z * 1.7 + { VIT: 0, PO: 3, CR: 7 }[p]));
      };
      const panneaux = [{ p: "VIT", titre: "vitesse", unite: "m/h", max: 260 }, { p: "PO", titre: "poussée", unite: "bar", max: 100 }, { p: "CR", titre: "couple", unite: "bar", max: 80 }];
      const x0 = 372, wP = (largeur - 10 - x0 - 2 * 8) / 3;
      panneaux.forEach((pn, i) => {
        const xp = x0 + i * (wP + 8), X = (v) => xp + (v / pn.max) * wP;
        for (let z = 0; z <= zMax; z += 2) s += ligne(xp, Y(z), xp + wP, Y(z), COULEURS.grille, 1);
        const pts = [];
        for (let z = 0; z <= zC1 + 1e-9; z += 0.04) pts.push(`${pts.length ? "L" : "M"}${r1(X(Math.max(0, Math.min(pn.max, valeur(z, pn.p)))))} ${r1(Y(z))}`);
        s += chemin(pts.join(""), "none", pn.p === "VIT" ? COULEURS.bleu : pn.p === "PO" ? COULEURS.f62 : COULEURS.violet, 1.3, 'stroke-linejoin="round"');
        s += rect(xp, yS, wP, Y(zMax) - yS, "none", COULEURS.trait, 1);
        s += etiq(xp + wP / 2, yS - 22, pn.titre, { ancre: "middle", taille: 11 }) + etiq(xp + wP / 2, yS - 8, pn.unite, { ancre: "middle", taille: 10, gras: false, couleur: COULEURS.discret });
        s += etiq(xp + wP, Y(zMax) + 11, fmt(pn.max, 3), { ancre: "end", taille: 9.5, gras: false, halo: false, couleur: COULEURS.discret });
      });
      s += etiq(x0 + (largeur - 10 - x0) / 2, 58, "enregistrés en continu", { ancre: "middle", taille: 11 });
      s += etiq(x0 + (largeur - 10 - x0) / 2, 73, "pendant la foration", { ancre: "middle", taille: 11, gras: false });
      const xv = x0 + wP;
      s += etiq(xv - 4, Y(7.5) + 13, "toit du rocher", { ancre: "end", taille: 10.5, couleur: COULEURS.rouge });
      s += ligne(x0, Y(7.5), largeur - 10, Y(7.5), COULEURS.rouge, 1, 'stroke-dasharray="3 3"');
      s += etiq(xv - 4, Y(cav[1]) + 16, "chute d'outil", { ancre: "end", taille: 10.5, couleur: COULEURS.rouge });
      return s;
    },
  });
}

// ───────────────────────────────── Piézomètres ─────────────────────────────

/** Piézomètre ouvert (tube crépiné) et piézomètre fermé (capteur noyé). */
export function schemaPiezometres({ largeur = 560, hauteur = 340 } = {}) {
  return svg({
    largeur, hauteur, titre: "Piézomètre ouvert et piézomètre fermé", contenu: (id) => {
      const yS = 84, zMax = 8, Y = (z) => yS + (z * (hauteur - 8 - yS)) / zMax, zw = 2;
      let s = couche(id, { x: 10, y: yS, w: largeur - 20, h: hauteur - 8 - yS, sol: "limon" });
      s += niveauEau(10, largeur - 10, Y(zw));
      s += etiq(largeur - 30, Y(zw) - 6, "nappe", { ancre: "end", taille: 11, couleur: EAU });
      s += sol(10, largeur - 10, yS);
      const w = 44;
      // ── Piézomètre ouvert ──
      const x1 = 170;
      s += forage(x1, yS, Y(7.3), w);
      s += rect(x1 - w / 2, yS, w, Y(3.5) - yS, "#e5e7eb", "none", 0);
      s += couche(id, { x: x1 - w / 2, y: Y(3.5), w, h: Y(4.4) - Y(3.5), sol: "argile" }) + rect(x1 - w / 2, Y(3.5), w, Y(4.4) - Y(3.5), "#78716c66", "none", 0);
      s += couche(id, { x: x1 - w / 2, y: Y(4.4), w, h: Y(7.3) - Y(4.4), sol: "sable" });
      s += rect(x1 - 7, yS - 16, 14, Y(7.05) - yS + 16, "#fff", TRAIT, 1.2);
      s += rect(x1 - 6, Y(zw), 12, Y(7.05) - Y(zw), "#bae6fd", "none", 0);
      for (let y = Y(5) + 4; y < Y(7.0); y += 6) s += ligne(x1 - 7, y, x1 - 4, y, "#1e293b", 1.2) + ligne(x1 + 4, y, x1 + 7, y, "#1e293b", 1.2);
      s += rect(x1 - 7, Y(7.05), 14, 4, "#475569", "#1e293b", 0.8);
      s += chemin(`M${x1 - 20} ${yS}L${x1 - 14} ${yS - 8}H${x1 + 14}L${x1 + 20} ${yS}Z`, "#d6d3d1", TRAIT, 1);
      s += rect(x1 - 11, yS - 26, 22, 12, "#475569", "#1e293b", 1, 'rx="2"');
      // Sonde de niveau : ruban et touche au contact de l'eau.
      s += ligne(x1 + 2, yS - 30, x1 + 2, Y(zw) - 5, "#b45309", 1);
      s += cercle(x1 + 30, yS - 34, 9, "#fde68a", "#92400e", 1) + ligne(x1 + 2, yS - 30, x1 + 23, yS - 40, "#b45309", 1);
      s += rect(x1 - 0.5, Y(zw) - 8, 5, 9, "#b45309", "#78350f", 0.8);
      s += etiqs(x1, 16, ["piézomètre ouvert"], { ancre: "middle", taille: 12.5 });
      s += etiq(x1, 31, "réponse lente : le tube doit se remplir", { ancre: "middle", taille: 10.5, gras: false });
      s += renvoi(x1 - 11, yS - 20, x1 - 36, yS - 30, ["capot"], { ancre: "end" });
      s += renvoi(x1 - 16, Y(1.2), x1 - 36, Y(1.2) + 4, ["coulis"], { ancre: "end" });
      s += renvoi(x1 - 16, Y(3.95), x1 - 36, Y(3.95) + 4, ["bouchon d'argile"], { ancre: "end" });
      s += renvoi(x1 - 16, Y(4.9), x1 - 36, Y(4.9) + 4, ["massif filtrant"], { ancre: "end" });
      s += renvoi(x1 - 7, Y(6.2), x1 - 36, Y(6.2) + 4, ["crépine"], { ancre: "end" });
      s += etiq(x1 + 44, yS - 30, "sonde de niveau", { taille: 10.5 });
      s += renvoi(x1 + 6, Y(zw) + 12, x1 + 36, Y(2.9), ["niveau dans le tube", "= niveau de la nappe"], { taille: 10.5, couleur: EAU });
      // ── Piézomètre fermé ──
      const x2 = 400;
      s += forage(x2, yS, Y(7.3), w);
      s += rect(x2 - w / 2, yS, w, Y(4.6) - yS, "#e5e7eb", "none", 0);
      s += couche(id, { x: x2 - w / 2, y: Y(4.6), w, h: Y(5.4) - Y(4.6), sol: "argile" }) + rect(x2 - w / 2, Y(4.6), w, Y(5.4) - Y(4.6), "#78716c66", "none", 0);
      s += couche(id, { x: x2 - w / 2, y: Y(5.4), w, h: Y(6.6) - Y(5.4), sol: "sable" });
      s += couche(id, { x: x2 - w / 2, y: Y(6.6), w, h: Y(7.3) - Y(6.6), sol: "argile" }) + rect(x2 - w / 2, Y(6.6), w, Y(7.3) - Y(6.6), "#78716c66", "none", 0);
      s += chemin(`M${x2} ${r1(Y(5.75))}V${yS - 12}H${x2 + 44}`, "none", "#1e293b", 1.3);
      s += rect(x2 - 5, Y(5.75), 10, Y(6.3) - Y(5.75), ACIER_FONCE, TRAIT, 1, 'rx="2"') + rect(x2 - 5, Y(6.3) - 4, 10, 4, "#7dd3fc", TRAIT, 0.8);
      s += rect(x2 + 44, yS - 30, 56, 28, "#f1f5f9", TRAIT, 1.2, 'rx="4"') + rect(x2 + 50, yS - 25, 30, 11, "#dcfce7", TRAIT, 0.8);
      s += etiq(x2, 16, "piézomètre fermé", { ancre: "middle", taille: 12.5 });
      s += etiq(x2, 31, "réponse rapide : pas d'échange d'eau", { ancre: "middle", taille: 10.5, gras: false });
      s += etiq(x2 + 72, yS - 36, "centrale de mesure", { ancre: "middle", taille: 10.5 });
      s += renvoi(x2 + 1, Y(2.6), x2 + 36, Y(2.6) + 4, ["câble"], {});
      s += renvoi(x2 + 16, Y(5.0), x2 + 36, Y(5.0) + 4, ["bouchon d'argile"], {});
      s += renvoi(x2 + 5, Y(6.0), x2 + 36, Y(6.0) + 4, ["capteur de pression", "dans un sable filtrant"], {});
      return s;
    },
  });
}

// ─────────────────────────── Pénétromètre statique ─────────────────────────

/** Piézocône : camion de poussée, train de tiges, et détail de la pointe. */
export function schemaCptu({ largeur = 600, hauteur = 350 } = {}) {
  return svg({
    largeur, hauteur, titre: "Essai au piézocône (CPTU)", contenu: (id) => {
      const yS = 156, xR = 188;
      let s = terrain(id, 10, 310, [{ y0: yS, y1: 256, sol: "argile" }, { y0: 256, y1: hauteur - 8, sol: "sable" }]);
      s += sol(10, 320, yS);
      s += etiq(18, yS + 16, "argile", {}) + etiq(18, 272, "sable", {});
      // Camion lesté et vérin de fonçage.
      s += rect(30, yS - 44, 236, 20, "#e2e8f0", TRAIT, 1.2, 'rx="3"');
      s += rect(30, yS - 82, 52, 38, "#bfdbfe", TRAIT, 1.2, 'rx="6"') + rect(38, yS - 76, 28, 15, "#e0f2fe", TRAIT, 0.8, 'rx="2"');
      s += rect(88, yS - 104, 178, 60, "#f8fafc", TRAIT, 1.2, 'rx="4"');
      for (const x of [58, 112, 210, 240]) s += roue(x, yS - 12);
      s += rect(xR - 12, yS - 98, 24, 34, "#fde68a", "#92400e", 1.2, 'rx="2"') + rect(xR - 3, yS - 64, 6, 10, ACIER_FONCE, TRAIT, 1);
      s += tiges(xR, yS - 54, 300, 7);
      s += rect(xR - 3.5, 300, 7, 14, "#e2e8f0", TRAIT, 1) + chemin(`M${xR - 3.5} 314h7l-3.5 6z`, "#64748b", TRAIT, 1);
      s += cercle(xR, 309, 17, "none", COULEURS.discret, 1);
      s += ligne(xR + 14, 300, 330, 240, COULEURS.discret, 0.8, 'stroke-dasharray="3 3"') + ligne(xR + 12, 320, 330, 332, COULEURS.discret, 0.8, 'stroke-dasharray="3 3"');
      s += etiqs(96, yS - 88, ["camion lesté", "15 à 20 t"], { taille: 10.5 });
      s += renvoi(xR - 12, yS - 80, 150, yS - 116, ["vérin de fonçage"], { ancre: "end", taille: 10.5 });
      s += fleche(id, xR + 30, 176, xR + 30, 214, { type: "effort", ep: 2 });
      s += etiqs(xR + 38, 190, ["2 cm/s"], { taille: 11, couleur: COULEURS.effort });
      s += renvoi(xR + 3, 238, 252, 234, ["tiges"], {});
      // Détail de la pointe (échelle : 1,4 px par mm).
      s += rect(330, 14, largeur - 340, hauteur - 24, "#fff", COULEURS.grille, 1.2, 'rx="10"');
      s += etiq(342, 32, "détail de la pointe", { taille: 11.5 });
      const k = 1.4, xa = 400, rP = (35.7 / 2) * k, hCone = (35.7 / 2 / Math.tan(Math.PI / 6)) * k;
      const yPointe = hauteur - 22, yBase = yPointe - hCone, yFiltre = yBase - 5 * k, yManchon = yFiltre - 133.7 * k;
      s += rect(xa - rP, 68, 2 * rP, yManchon - 68, "#e2e8f0", TRAIT, 1.2);
      s += ligne(xa - rP, yManchon - 10, xa + rP, yManchon - 10, TRAIT, 0.8, 'stroke-dasharray="3 2"');
      s += rect(xa - rP, yManchon, 2 * rP, yFiltre - yManchon, "#f1f5f9", TRAIT, 1.4);
      s += rect(xa - rP, yFiltre, 2 * rP, yBase - yFiltre, "#7dd3fc", TRAIT, 1);
      s += chemin(`M${r1(xa - rP)} ${r1(yBase)}H${r1(xa + rP)}L${xa} ${r1(yPointe)}Z`, "#94a3b8", TRAIT, 1.3);
      // Réactions du sol : sur le cône (qc), le long du manchon (fs), sur le filtre (u2).
      const nx = Math.cos(Math.PI / 6), ny = Math.sin(Math.PI / 6);
      for (const f of [0.35, 0.7]) {
        const yp = yBase + f * hCone, dx = rP * (1 - f);
        s += fleche(id, xa - dx - 22 * nx, yp + 22 * ny, xa - dx - 2 * nx, yp + 2 * ny, { type: "reaction", ep: 1.6 });
        s += fleche(id, xa + dx + 22 * nx, yp + 22 * ny, xa + dx + 2 * nx, yp + 2 * ny, { type: "reaction", ep: 1.6 });
      }
      for (const y of [yManchon + 40, yManchon + 100, yManchon + 160]) {
        s += fleche(id, xa - rP - 7, y + 12, xa - rP - 7, y - 12, { type: "reaction", ep: 1.6 });
        s += fleche(id, xa + rP + 7, y + 12, xa + rP + 7, y - 12, { type: "reaction", ep: 1.6 });
      }
      s += fleche(id, xa + rP + 24, yFiltre + 3.5, xa + rP + 3, yFiltre + 3.5, { type: "bleu", ep: 1.5 });
      const xt = xa + rP + 44;
      s += etiqs(xt, yManchon + 70, ["manchon de frottement", "150 cm² : fs"], { taille: 11 });
      s += etiqs(xt, yFiltre + 8, ["filtre : u₂"], { taille: 11, couleur: EAU });
      s += etiqs(xt, yBase + 26, ["cône 60°, 10 cm² : qc"], { taille: 11 });
      s += etiqs(xt, 84, ["tige"], { taille: 11, gras: false });
      s += cote(id, xa - rP, 62, xa + rP, 62, "Ø 35,7 mm", { decalage: 6 });
      return s;
    },
  });
}

// ─────────────────────────── Pénétromètre dynamique ────────────────────────

/** Mouton, enclume, tiges et pointe débordante ; à droite, le nombre de coups tous les 10 cm. */
export function schemaPenetroDyn({ largeur = 560, hauteur = 330 } = {}) {
  return svg({
    largeur, hauteur, titre: "Pénétromètre dynamique", contenu: (id) => {
      const yS = 170, zMax = 6, Y = (z) => yS + (z * (hauteur - 10 - yS)) / zMax, xa = 150;
      const couches = [{ z0: 0, z1: 1, sol: "remblai", nom: "remblai" }, { z0: 1, z1: 3.5, sol: "argile", nom: "argile" }, { z0: 3.5, z1: zMax, sol: "sable", nom: "sable dense" }];
      let s = terrain(id, 10, 290, couches.map((c) => ({ y0: Y(c.z0), y1: Y(c.z1), sol: c.sol })));
      s += sol(10, 300, yS);
      for (const c of couches) s += etiq(18, Y(c.z0) + 15, c.nom);
      // Tige-guide, mouton levé, enclume, tiges, pointe débordante.
      s += rect(xa - 2.5, 16, 5, 118, ACIER_FONCE, TRAIT, 1);
      s += rect(xa - 22, 34, 44, 30, "#64748b", "#1e293b", 1.2, 'rx="3"');
      s += rect(xa - 16, 128, 32, 12, ACIER_FONCE, TRAIT, 1.2);
      s += tiges(xa, 140, Y(5.1), 8);
      const yP = Y(5.1);
      s += rect(xa - 9, yP, 18, 8, ACIER_FONCE, TRAIT, 1.2) + chemin(`M${xa - 9} ${r1(yP + 8)}h18l-9 9z`, "#64748b", TRAIT, 1.2);
      s += cote(id, xa - 40, 64, xa - 40, 128, "");
      s += etiq(xa - 46, 100, "hauteur H", { ancre: "end", taille: 11, couleur: COULEURS.cote });
      s += fleche(id, xa + 34, 44, xa + 34, 112, { type: "effort", ep: 2 });
      s += etiq(xa + 30, 30, "mouton M", { ancre: "start", taille: 11 });
      s += renvoi(xa + 16, 134, xa + 46, 132, ["enclume"], {});
      s += renvoi(xa + 4, Y(2.2), xa + 26, Y(2.2) + 4, ["tiges"], {});
      s += renvoi(xa + 9, yP + 4, xa + 26, yP + 4, ["pointe débordante,", "section A"], { taille: 10.5 });
      // Nombre de coups pour 10 cm, sur le même axe des profondeurs.
      const x0 = 352, x1 = largeur - 14, nMax = 40, X = (n) => x0 + (n / nMax) * (x1 - x0);
      const n10 = (z) => {
        const c = couches.find((k) => z >= k.z0 && z < k.z1) ?? couches[couches.length - 1];
        const b = c.sol === "remblai" ? 6 : c.sol === "argile" ? 3 : 14 + 4.5 * (z - 3.5);
        return Math.max(1, Math.round(b * (1 + 0.3 * bruit(4.3 * z))));
      };
      for (let n = 0; n <= nMax; n += 10) {
        s += ligne(X(n), yS, X(n), Y(zMax), COULEURS.grille, 1);
        s += etiq(X(n), yS - 6, fmt(n, 3), { ancre: "middle", taille: 10, gras: false, halo: false, couleur: COULEURS.discret });
      }
      for (let z = 0; z < 5.1 - 1e-9; z += 0.1) s += `<rect x="${x0}" y="${r1(Y(z) + 0.3)}" width="${r1(X(n10(z)) - x0)}" height="${r1(Y(0.1) - Y(0) - 0.6)}" fill="${COULEURS.bleu}" opacity=".75"/>`;
      s += rect(x0, yS, x1 - x0, Y(zMax) - yS, "none", COULEURS.trait, 1);
      for (let z = 0; z <= zMax; z += 1) s += etiq(x0 - 5, Y(z) + 4, fmt(z, 3), { ancre: "end", taille: 10, gras: false, halo: false, couleur: COULEURS.discret });
      s += etiq(x0 + (x1 - x0) / 2, yS - 22, "N₁₀ : coups pour 10 cm", { ancre: "middle", taille: 11 });
      s += etiq(x0 - 5, yS - 6, "z (m)", { ancre: "end", taille: 10, gras: false, halo: false, couleur: COULEURS.discret });
      s += etiqs(x0, 40, ["qd = M² g H / [(M + M') A e]"], { taille: 12, couleur: COULEURS.bleu });
      s += etiqs(x0, 62, ["e = 10 cm / N₁₀ : enfoncement par coup", "M' : tiges, enclume et pointe"], { taille: 10.5, gras: false });
      return s;
    },
  });
}

// ─────────────────────────────────── SPT ───────────────────────────────────

/** Essai de pénétration au carottier : battage au fond du forage, comptage par 15 cm, carottier fendu. */
export function schemaSpt({ largeur = 560, hauteur = 340 } = {}) {
  return svg({
    largeur, hauteur, titre: "Essai de pénétration au carottier (SPT)", contenu: (id) => {
      const yS = 126, xa = 150, k = 1.72, yF = 222; // 1,72 px par cm sous le fond du forage
      let s = couche(id, { x: 10, y: yS, w: 330, h: hauteur - 8 - yS, sol: "sable" });
      s += sol(10, 340, yS);
      s += forage(xa, yS, yF, 34);
      s += rect(xa - 21, yS - 6, 4, 50, "#475569", "#1e293b", 0.8) + rect(xa + 17, yS - 6, 4, 50, "#475569", "#1e293b", 0.8);
      // Mouton de 63,5 kg sur sa tige-guide, enclume, tiges.
      s += rect(xa - 2.5, 12, 5, 70, ACIER_FONCE, TRAIT, 1);
      s += rect(xa - 20, 22, 40, 24, "#64748b", "#1e293b", 1.2, 'rx="3"');
      s += rect(xa - 14, 82, 28, 10, ACIER_FONCE, TRAIT, 1.2);
      s += tiges(xa, 92, yF - 26, 8);
      // Carottier fendu : tête, corps, sabot ; enfoncé de 45 cm sous le fond du forage.
      const yPied = yF + 45 * k;
      s += rect(xa - 8, yF - 26, 16, 12, ACIER_FONCE, TRAIT, 1);
      s += rect(xa - 7, yF - 14, 14, yPied - (yF - 14) - 6, ACIER, TRAIT, 1.1);
      s += chemin(`M${xa - 7} ${r1(yPied - 6)}h14l-2 6h-10z`, "#475569", TRAIT, 1);
      s += cote(id, xa - 34, 46, xa - 34, 82, "");
      s += etiq(xa - 40, 68, "76 cm", { ancre: "end", taille: 11, couleur: COULEURS.cote });
      s += fleche(id, xa + 30, 28, xa + 30, 76, { type: "effort", ep: 2 });
      s += etiq(xa + 38, 36, "mouton 63,5 kg", { taille: 11 });
      s += renvoi(xa + 14, 87, xa + 38, 92, ["enclume"], {});
      s += renvoi(xa + 4, 158, xa + 38, 162, ["tiges"], {});
      s += renvoi(xa + 21, yS + 16, xa + 38, yS + 20, ["tubage"], {});
      // Les trois passes de 15 cm.
      const xb = xa + 26;
      const passes = [["amorçage : 15 cm, non compté", COULEURS.discret], ["15 cm : n₂ coups", COULEURS.encre], ["15 cm : n₃ coups", COULEURS.encre]];
      passes.forEach(([t, c], i) => {
        const y0 = yF + i * 15 * k, y1 = y0 + 15 * k;
        s += ligne(xa - 20, y0, xb + 6, y0, COULEURS.cote, 0.9, 'stroke-dasharray="2 2"');
        s += cote(id, xb, y0, xb, y1, "");
        s += etiq(xb + 8, (y0 + y1) / 2 + 4, t, { taille: 10.5, couleur: c });
      });
      s += ligne(xa - 20, yPied, xb + 6, yPied, COULEURS.cote, 0.9, 'stroke-dasharray="2 2"');
      s += etiq(xb + 8, yPied + 22, "N = n₂ + n₃", { taille: 12.5, couleur: COULEURS.bleu });
      s += etiq(18, yF + 4, "fond du forage", { taille: 10.5, gras: false });
      // Carottier ouvert : deux demi-coquilles et l'échantillon remanié.
      const xc = 356, yc0 = 124, yc1 = 316, wc = 40;
      s += etiq(xc + 47, 78, "carottier fendu ouvert", { ancre: "middle", taille: 11.5 });
      s += etiq(xc + 47, 93, "Ø ext. 51 mm · int. 35 mm", { ancre: "middle", taille: 10.5, gras: false });
      for (const dx of [0, wc + 14]) {
        s += rect(xc + dx, yc0, wc, yc1 - yc0 - 18, ACIER, TRAIT, 1.2, 'rx="4"');
        s += couche(id, { x: xc + dx + 7, y: yc0 + 30, w: wc - 14, h: yc1 - yc0 - 60, sol: "sable" });
        s += rect(xc + dx + 7, yc0 + 30, wc - 14, yc1 - yc0 - 60, "none", "#a16207", 0.8);
        s += chemin(`M${xc + dx + 4} ${yc1 - 18}h${wc - 8}l-4 12h${-(wc - 16)}z`, "#475569", TRAIT, 1);
      }
      s += rect(xc + 12, yc0 - 18, 2 * wc - 10, 16, ACIER_FONCE, TRAIT, 1.1, 'rx="3"') + cercle(xc + 47, yc0 - 10, 4, "#1e293b", "#0f172a", 0.8);
      const xl = xc + 2 * wc + 24;
      s += renvoi(xc + 2 * wc + 2, yc0 - 10, xl, yc0 - 6, ["tête", "à clapet"], { taille: 10.5 });
      s += renvoi(xc + 2 * wc + 6, yc0 + 110, xl, yc0 + 70, ["échantillon", "remanié :", "identification"], { taille: 10.5 });
      s += renvoi(xc + 2 * wc + 8, yc1 - 12, xl, yc1 - 8, ["sabot"], { taille: 10.5 });
      return s;
    },
  });
}

// ─────────────────────────────── Dilatomètre plat ─────────────────────────

/** Dilatomètre de Marchetti : fonçage de la lame, lectures A et B, détail de la lame. */
export function schemaDmt({ largeur = 560, hauteur = 320 } = {}) {
  return svg({
    largeur, hauteur, titre: "Dilatomètre plat (DMT)", contenu: (id) => {
      const yS = 118, xa = 120;
      let s = couche(id, { x: 10, y: yS, w: 250, h: hauteur - 8 - yS, sol: "limon" });
      s += sol(10, 260, yS);
      // Poussée, tiges, lame ; tube pneumo-électrique jusqu'au boîtier.
      s += fleche(id, xa, 22, xa, 52, { type: "effort", ep: 2.2 });
      s += rect(xa - 12, 54, 24, 14, "#fde68a", "#92400e", 1.1, 'rx="2"');
      s += tiges(xa, 68, 250, 8);
      s += chemin(`M${xa - 7} 250h14v40l-7 10l-7-10z`, ACIER, TRAIT, 1.2) + cercle(xa, 268, 5, "#fef3c7", "#92400e", 1);
      s += chemin(`M${xa + 5} 76C${xa + 30} 70 ${xa + 40} 62 ${xa + 58} 62H182`, "none", "#0f766e", 1.6);
      s += rect(182, 44, 50, 34, "#f1f5f9", TRAIT, 1.2, 'rx="4"') + cercle(207, 61, 10, "#fff", TRAIT, 1) + ligne(207, 61, 212, 55, COULEURS.effort, 1.4);
      s += rect(236, 50, 16, 28, "#99f6e4", "#0f766e", 1, 'rx="7"');
      s += etiq(xa - 8, 38, "poussée", { ancre: "end", taille: 10.5, couleur: COULEURS.effort });
      s += etiq(207, 36, "boîtier de mesure", { ancre: "middle", taille: 10.5 });
      s += renvoi(244, 78, 238, 100, ["gaz"], { ancre: "middle", taille: 10.5 });
      s += renvoi(xa + 4, 190, xa + 30, 194, ["tiges"], {});
      s += renvoi(xa + 6, 268, xa + 30, 272, ["lame et membrane"], {});
      s += renvoi(xa + 3, 292, xa + 30, 298, ["arrêt tous les 20 cm"], { taille: 10.5, gras: false });
      // Détail de la lame (0,9 px par mm) : face avant et profil.
      s += rect(284, 14, largeur - 294, hauteur - 24, "#fff", COULEURS.grille, 1.2, 'rx="10"');
      s += etiq(296, 32, "la lame", { taille: 11.5 });
      const k = 0.9, xf = 352, wl = 95 * k, yl0 = 64, yl1 = 264;
      s += chemin(`M${r1(xf - wl / 2)} ${yl0}V${yl1}L${xf} ${yl1 + 34}L${r1(xf + wl / 2)} ${yl1}V${yl0}Z`, ACIER, TRAIT, 1.3);
      const yMb = 196, rM = 30 * k;
      s += cercle(xf, yMb, rM, "#fef3c7", "#92400e", 1.4);
      s += cote(id, xf - wl / 2, 54, xf + wl / 2, 54, "95 mm");
      s += cote(id, xf - rM, yMb + rM + 12, xf + rM, yMb + rM + 12, "");
      s += etiq(xf, yMb + rM + 28, "membrane Ø 60 mm", { ancre: "middle", taille: 10.5, couleur: COULEURS.cote });
      // Profil : 15 mm d'épaisseur, biseau, membrane gonflée (agrandie).
      const xp = 442, ep = 15 * k * 1.4;
      s += chemin(`M${r1(xp - ep / 2)} ${yl0}V${yl1}L${xp} ${yl1 + 34}L${r1(xp + ep / 2)} ${yl1}V${yl0}Z`, ACIER, TRAIT, 1.3);
      s += chemin(`M${r1(xp + ep / 2)} ${yMb - rM}Q${r1(xp + ep / 2 + 18)} ${yMb} ${r1(xp + ep / 2)} ${yMb + rM}`, "none", "#92400e", 1.4, 'stroke-dasharray="4 2"');
      s += chemin(`M${r1(xp + ep / 2)} ${yMb - rM}Q${r1(xp + ep / 2 + 4)} ${yMb} ${r1(xp + ep / 2)} ${yMb + rM}`, "none", "#92400e", 1.2);
      s += cote(id, xp - ep / 2, 54, xp + ep / 2, 54, "15 mm");
      s += renvoi(xp + ep / 2 + 3, yMb - 14, xp + 26, yMb - 52, ["A : la membrane", "décolle"], { taille: 10.5 });
      s += renvoi(xp + ep / 2 + 12, yMb + 6, xp + 26, yMb + 46, ["B : son centre", "a avancé", "de 1,1 mm"], { taille: 10.5 });
      s += etiq(xp, yl1 + 50, "profil", { ancre: "middle", taille: 10.5, gras: false });
      s += etiq(xf, yl1 + 50, "face", { ancre: "middle", taille: 10.5, gras: false });
      return s;
    },
  });
}

// ─────────────────────────────────── Scissomètre ───────────────────────────

/** Scissomètre de chantier : tête de mesure du couple, moulinet, cylindre cisaillé, courbe couple–rotation. */
export function schemaScissometre({ largeur = 560, hauteur = 320 } = {}) {
  return svg({
    largeur, hauteur, titre: "Scissomètre (essai au moulinet)", contenu: (id) => {
      const yS = 96, xa = 140;
      let s = couche(id, { x: 10, y: yS, w: 270, h: hauteur - 8 - yS, sol: "argile" });
      s += sol(10, 280, yS);
      s += etiq(18, yS + 16, "argile molle", {});
      // Tête de mesure, tube de protection, tiges, moulinet.
      s += rect(xa - 26, 48, 52, 30, "#f1f5f9", TRAIT, 1.3, 'rx="4"') + cercle(xa, 63, 9, "#fff", TRAIT, 1) + ligne(xa, 63, xa + 5, 57, COULEURS.effort, 1.4);
      s += rotation(id, xa, 38, 24, 6);
      s += etiq(xa + 34, 34, "rotation lente,", { taille: 10.5, couleur: COULEURS.effort });
      s += etiq(xa + 34, 48, "6 à 12° par minute", { taille: 10.5, gras: false, couleur: COULEURS.effort });
      s += renvoi(xa + 26, 70, xa + 44, 80, ["mesure du couple M"], { taille: 10.5 });
      const D = 40, H = 80, yv0 = 222, yv1 = yv0 + H;
      s += rect(xa - 8, 78, 16, 136, "none", TRAIT, 1, 'stroke-dasharray="4 3"');
      s += tiges(xa, 78, yv0, 6);
      s += rect(xa - D / 2, yv0, D, H - 6, ACIER, TRAIT, 1.3) + ligne(xa, yv0, xa, yv0 + H - 6, TRAIT, 1.4);
      s += chemin(`M${xa - D / 2} ${yv0 + H - 6}L${xa} ${yv0 + H + 2}L${xa + D / 2} ${yv0 + H - 6}`, "none", TRAIT, 1.1);
      // Cylindre cisaillé.
      s += `<ellipse cx="${xa}" cy="${yv0}" rx="${D / 2 + 3}" ry="5" fill="none" stroke="${COULEURS.rouge}" stroke-width="1.2" stroke-dasharray="4 3"/>`;
      s += `<ellipse cx="${xa}" cy="${yv0 + H - 6}" rx="${D / 2 + 3}" ry="5" fill="none" stroke="${COULEURS.rouge}" stroke-width="1.2" stroke-dasharray="4 3"/>`;
      s += ligne(xa - D / 2 - 3, yv0, xa - D / 2 - 3, yv0 + H - 6, COULEURS.rouge, 1.2, 'stroke-dasharray="4 3"') + ligne(xa + D / 2 + 3, yv0, xa + D / 2 + 3, yv0 + H - 6, COULEURS.rouge, 1.2, 'stroke-dasharray="4 3"');
      s += renvoi(xa - 12, 150, xa - 30, 150, ["tube de protection"], { ancre: "end", taille: 10.5 });
      s += renvoi(xa - D / 2 - 3, yv0 + 30, xa - 36, yv0 + 16, ["cylindre cisaillé :", "τ = cu sur", "toute sa surface"], { ancre: "end", taille: 10.5, couleur: COULEURS.rouge });
      s += cote(id, xa + D / 2 + 14, yv0, xa + D / 2 + 14, yv0 + H - 6, "");
      s += etiq(xa + D / 2 + 20, yv0 + H / 2, "H = 2D", { taille: 10.5, couleur: COULEURS.cote });
      s += cote(id, xa - D / 2, yv1 + 6, xa + D / 2, yv1 + 6, "");
      s += etiq(xa + D / 2 + 8, yv1 + 10, "D", { taille: 10.5, couleur: COULEURS.cote });
      // Vue en plan du moulinet.
      const xp = 360, yp = 86, R = 34;
      s += etiq(xp, 30, "vue en plan", { ancre: "middle", taille: 11 });
      s += `<circle cx="${xp}" cy="${yp}" r="${R + 4}" fill="none" stroke="${COULEURS.rouge}" stroke-width="1.2" stroke-dasharray="4 3"/>`;
      s += ligne(xp - R, yp, xp + R, yp, TRAIT, 3) + ligne(xp, yp - R, xp, yp + R, TRAIT, 3) + cercle(xp, yp, 4, ACIER_FONCE, TRAIT, 1);
      s += chemin(`M${xp + R + 10} ${yp + 10}A${R + 10} ${R + 10} 0 0 1 ${xp + 10} ${yp + R + 10}`, "none", COULEURS.effort, 1.6, `marker-end="url(#${id}-fl)"`);
      s += etiqs(xp + 56, 74, ["quatre pales", "de même hauteur"], { taille: 10.5, gras: false });
      s += etiq(xp + 64, 158, "M = cu π D² (H/2 + D/6)", { ancre: "middle", taille: 11.5 });
      // Couple en fonction de la rotation : pic, puis couple résiduel après une dizaine de tours.
      const gx0 = 312, gx1 = largeur - 16, gy0 = 192, gy1 = 292;
      s += ligne(gx0, gy1, gx1, gy1, COULEURS.trait, 1.2) + ligne(gx0, gy0, gx0, gy1, COULEURS.trait, 1.2);
      s += etiq(gx1, gy1 + 16, "rotation", { ancre: "end", taille: 10.5, gras: false });
      s += etiq(gx0 + 4, gy0 - 6, "couple", { taille: 10.5, gras: false });
      const courbe = [];
      for (let i = 0; i <= 60; i++) {
        const t = i / 60, x = gx0 + t * (gx1 - gx0 - 6);
        const m = t < 0.12 ? Math.sin((t / 0.12) * Math.PI / 2) : 0.38 + 0.62 * Math.exp(-(t - 0.12) * 9);
        courbe.push(`${i ? "L" : "M"}${r1(x)} ${r1(gy1 - m * (gy1 - gy0 - 18))}`);
      }
      s += chemin(courbe.join(""), "none", COULEURS.bleu, 2);
      s += etiq(gx0 + 0.12 * (gx1 - gx0) + 6, gy0 + 16, "Mmax → cu", { taille: 10.5, couleur: COULEURS.bleu });
      s += etiq(gx1 - 4, gy1 - 0.38 * (gy1 - gy0 - 18) - 8, "Mr → cu remanié", { ancre: "end", taille: 10.5, couleur: COULEURS.bleu });
      return s;
    },
  });
}

// ───────────────────────────────── Essai de plaque ─────────────────────────

/** Essai de plaque : réaction par un camion lesté, vérin, plaque, poutre de référence et comparateur. */
export function schemaPlaque({ largeur = 560, hauteur = 300 } = {}) {
  return svg({
    largeur, hauteur, titre: "Essai de chargement à la plaque", contenu: (id) => {
      const yS = 232, xp = 280;
      let s = terrain(id, 10, largeur - 20, [{ y0: yS, y1: 262, sol: "grave" }, { y0: 262, y1: hauteur - 8, sol: "limon" }]);
      s += sol(10, largeur - 10, yS);
      s += etiq(18, 252, "couche de forme", { taille: 10.5 }) + etiq(18, 282, "sol support", { taille: 10.5 });
      // Camion lesté : cabine, lest, châssis, roues.
      s += rect(20, 70, 62, 48, "#bfdbfe", TRAIT, 1.2, 'rx="6"') + rect(30, 78, 34, 18, "#e0f2fe", TRAIT, 0.8, 'rx="2"');
      s += rect(250, 74, 286, 44, "#f1f5f9", TRAIT, 1.2, 'rx="3"');
      s += etiq(393, 100, "lest : la réaction", { ancre: "middle", taille: 11 });
      s += rect(20, 118, 520, 16, "#e2e8f0", TRAIT, 1.2, 'rx="3"');
      for (const x of [44, 88, 472, 516]) s += ligne(x, 134, x, 206, TRAIT, 3) + roue(x, 212, 18);
      // Vérin sous le châssis, plaque, rotule.
      s += rect(xp - 4, 134, 8, 46, ACIER_FONCE, TRAIT, 1);
      s += rect(xp - 11, 180, 22, 30, "#fde68a", "#92400e", 1.2, 'rx="2"');
      s += rect(xp - 4, 210, 8, 16, ACIER_FONCE, TRAIT, 1);
      s += rect(xp - 40, 226, 80, 6, "#475569", "#1e293b", 1);
      s += cercle(xp + 22, 194, 7, "#fff", TRAIT, 1.1) + ligne(xp + 11, 194, xp + 15, 194, TRAIT, 1) + ligne(xp + 22, 194, xp + 25, 190, COULEURS.effort, 1.2);
      // Poutre de référence sur appuis éloignés, comparateur sur la plaque.
      s += rect(150, 206, 94, 5, "#a8a29e", "#57534e", 1) + rect(316, 206, 94, 5, "#a8a29e", "#57534e", 1);
      s += chemin(`M160 211l-7 21h14z`, "#d6d3d1", "#57534e", 1) + chemin(`M400 211l-7 21h14z`, "#d6d3d1", "#57534e", 1);
      s += cercle(252, 198, 7, "#fff", TRAIT, 1.1) + ligne(252, 205, 252, 226, TRAIT, 1.2) + ligne(252, 198, 255, 193, COULEURS.effort, 1.2);
      s += renvoi(248, 193, 238, 162, ["comparateur :", "enfoncement s"], { ancre: "end", taille: 10.5 });
      s += renvoi(xp + 29, 194, 322, 162, ["vérin et manomètre :", "pression p"], { taille: 10.5 });
      s += renvoi(176, 206, 104, 198, ["poutre de référence"], { taille: 10.5 });
      s += renvoi(xp + 30, 230, 330, 256, ["plaque rigide Ø 600 mm"], { taille: 10.5 });
      s += etiq(20, 28, "EV = 1,5 p R / s", { taille: 12.5, couleur: COULEURS.bleu });
      s += etiq(20, 48, "1er cycle jusqu'à 0,25 MPa : EV1 · 2e cycle jusqu'à 0,20 MPa : EV2", { taille: 10.5, gras: false });
      s += etiq(20, 64, "k = EV2 / EV1 < 2 : compactage correct", { taille: 10.5, gras: false });
      return s;
    },
  });
}

// ─────────────────────────── Chargement statique d'un pieu ─────────────────

/** Essai de chargement statique : poutre de réaction ancrée sur deux pieux, vérin, mesures en tête et dans le fût. */
export function schemaChargementPieu({ largeur = 600, hauteur = 360 } = {}) {
  return svg({
    largeur, hauteur, titre: "Essai de chargement statique d'un pieu", contenu: (id) => {
      const yS = 150, xp = 300, B = 28, xa = [100, 500];
      let s = terrain(id, 10, largeur - 20, [{ y0: yS, y1: 236, sol: "argile" }, { y0: 236, y1: hauteur - 8, sol: "sable" }]);
      s += sol(10, largeur - 10, yS);
      // Pieux de réaction et tirants.
      for (const x of xa) {
        s += `<rect x="${x - 11}" y="${yS - 10}" width="22" height="${300 - yS + 10}" fill="${COULEURS.beton}" stroke="${COULEURS.betonTrait}" stroke-width="1.2"/>`;
        s += `<rect x="${x - 11}" y="${yS - 10}" width="22" height="${300 - yS + 10}" fill="url(#${id}-beton)" opacity=".5"/>`;
        s += ligne(x, 96, x, yS - 10, "#1e293b", 3.2) + rect(x - 9, 66, 18, 6, "#475569", "#1e293b", 0.8);
      }
      // Poutre de réaction (profilé en I).
      s += rect(76, 72, 448, 4, "#64748b", "#1e293b", 1) + rect(76, 90, 448, 4, "#64748b", "#1e293b", 1) + rect(76, 76, 448, 14, ACIER, "#475569", 0.8);
      // Capteur de force, vérin, casque sur la tête du pieu d'essai.
      s += rect(xp - 10, 94, 20, 10, "#c7d2fe", "#3730a3", 1);
      s += rect(xp - 14, 104, 28, 28, "#fde68a", "#92400e", 1.2, 'rx="2"');
      s += rect(xp - 20, 132, 40, 4, "#475569", "#1e293b", 1);
      s += `<rect x="${xp - B / 2}" y="${yS - 14}" width="${B}" height="${330 - yS + 14}" fill="${COULEURS.beton}" stroke="${COULEURS.betonTrait}" stroke-width="1.3"/>`;
      s += `<rect x="${xp - B / 2}" y="${yS - 14}" width="${B}" height="${330 - yS + 14}" fill="url(#${id}-beton)" opacity=".5"/>`;
      // Poutre de référence (deux tronçons de part et d'autre du pieu) et comparateurs.
      s += rect(176, 138, 98, 4, "#a8a29e", "#57534e", 1) + rect(326, 138, 98, 4, "#a8a29e", "#57534e", 1);
      s += chemin(`M186 142l-6 8h12z`, "#d6d3d1", "#57534e", 1) + chemin(`M414 142l-6 8h12z`, "#d6d3d1", "#57534e", 1);
      s += rect(270, 128, 8, 10, "#fff", TRAIT, 1) + rect(322, 128, 8, 10, "#fff", TRAIT, 1);
      // Niveaux instrumentés dans le fût.
      for (const y of [192, 246, 300]) s += rect(xp - 4, y - 3, 8, 6, "#0891b2", "#155e75", 0.8);
      // Efforts : charge en tête, frottement et pointe.
      s += fleche(id, 262, 100, 262, 128, { type: "effort", ep: 2.2 });
      for (const y of [214, 266, 312]) {
        s += fleche(id, xp - B / 2 - 7, y + 12, xp - B / 2 - 7, y - 10, { type: "reaction", ep: 1.6 });
        s += fleche(id, xp + B / 2 + 7, y + 12, xp + B / 2 + 7, y - 10, { type: "reaction", ep: 1.6 });
      }
      s += fleche(id, xp, 350, xp, 333, { type: "reaction", ep: 2 });
      s += etiq(254, 118, "Q", { ancre: "end", taille: 13, couleur: COULEURS.effort });
      s += etiq(xp - B / 2 - 14, 264, "qs", { ancre: "end", taille: 12, couleur: COULEURS.reaction });
      s += etiq(xp + 10, 348, "qb", { taille: 12, couleur: COULEURS.reaction });
      s += etiq(xp, 62, "poutre de réaction", { ancre: "middle", taille: 11 });
      s += renvoi(xp + 10, 99, 338, 104, ["capteur de force"], { taille: 10.5 });
      s += renvoi(xp + 14, 122, 338, 124, ["vérin"], { taille: 10.5 });
      s += renvoi(xa[1] + 1, 118, 514, 114, ["tirant"], { taille: 10.5 });
      s += renvoi(xa[1] + 11, 250, 522, 246, ["pieu de", "réaction"], { taille: 10.5 });
      s += renvoi(xp + B / 2, 222, 350, 214, ["pieu d'essai"], { taille: 11 });
      s += renvoi(xp + 4, 300, 350, 296, ["niveaux instrumentés :", "effort dans le fût"], { taille: 10.5 });
      s += renvoi(220, 140, 146, 176, ["poutre de référence", "et comparateurs"], { ancre: "end", taille: 10.5 });
      s += etiq(20, 26, "paliers maintenus 60 min · fluage αn = s60 − s30", { taille: 10.5, gras: false });
      return s;
    },
  });
}

// ───────────────────────────────────── Lefranc ─────────────────────────────

/** Essai Lefranc à charge constante : cavité sous la nappe, débit injecté, charge h. */
export function schemaLefranc({ largeur = 560, hauteur = 320 } = {}) {
  return svg({
    largeur, hauteur, titre: "Essai Lefranc", contenu: (id) => {
      const yS = 72, Y = (z) => yS + z * 32, zw = 1.5, xf = 214, w = 36, zc0 = 5.2, zc1 = 6.1;
      let s = terrain(id, 10, 300, [{ y0: yS, y1: Y(1.1), sol: "limon" }, { y0: Y(1.1), y1: hauteur - 8, sol: "sable" }]);
      s += niveauEau(10, 310, Y(zw), false) + `<path d="M${40} ${r1(Y(zw) - 1)}l6-9h-12z" fill="${EAU}"/>`;
      s += sol(10, 310, yS);
      s += etiq(18, yS + 16, "limon", {}) + etiq(18, Y(3) + 4, "sable", {}) + etiq(54, Y(zw) - 5, "nappe", { taille: 10.5, couleur: EAU });
      // Forage tubé jusqu'à la cavité ; cavité (lanterne) de longueur L et de diamètre D.
      s += `<rect x="${xf - w / 2}" y="${yS}" width="${w}" height="${r1(Y(zc1) - yS)}" fill="#fff"/>`;
      s += rect(xf - w / 2 + 2, yS + 2, w - 4, Y(zc1) - yS - 2, "#bae6fd", "none", 0);
      s += ligne(xf - w / 2, Y(zc0), xf - w / 2, Y(zc1), COULEURS.trait, 1, 'stroke-dasharray="4 3"') + ligne(xf + w / 2, Y(zc0), xf + w / 2, Y(zc1), COULEURS.trait, 1, 'stroke-dasharray="4 3"');
      s += ligne(xf - w / 2 + 2, Y(zc1), xf + w / 2 - 2, Y(zc1), COULEURS.trait, 1, 'stroke-dasharray="4 3"');
      s += rect(xf - w / 2 - 4, yS - 12, 4, Y(zc0) - yS + 12, "#475569", "#1e293b", 0.8) + rect(xf + w / 2, yS - 12, 4, Y(zc0) - yS + 12, "#475569", "#1e293b", 0.8);
      for (const [dx, dy, ex, ey] of [[-1, 0.3, -30, 0], [-1, 0.7, -30, 0], [1, 0.3, 30, 0], [1, 0.7, 30, 0], [0, 1, 0, 16]]) {
        const x0 = xf + dx * (w / 2 + 3), y0 = Y(zc0) + dy * (Y(zc1) - Y(zc0)) + (dy === 1 ? 3 : 0);
        s += fleche(id, x0, y0, x0 + ex, y0 + ey, { type: "bleu", ep: 1.6 });
      }
      // Alimentation : réservoir, débitmètre, niveau maintenu en tête du tubage.
      s += rect(36, 20, 56, 32, "#e0f2fe", EAU, 1.2) + rect(38, 30, 52, 20, "#bae6fd", "none", 0);
      s += chemin(`M92 40H128`, "none", EAU, 2) + rect(128, 32, 28, 16, "#f1f5f9", TRAIT, 1.1, 'rx="3"') + chemin(`M156 40H${xf}V${yS - 4}`, "none", EAU, 2);
      s += etiq(64, 14, "réservoir", { ancre: "middle", taille: 10.5 });
      s += etiq(142, 66, "débitmètre : Q", { ancre: "middle", taille: 10.5 });
      s += cote(id, xf + w / 2 + 22, yS, xf + w / 2 + 22, Y(zw), "");
      s += etiq(xf + w / 2 + 28, (yS + Y(zw)) / 2 + 4, "h", { taille: 12, couleur: COULEURS.cote });
      s += cote(id, xf + w / 2 + 40, Y(zc0), xf + w / 2 + 40, Y(zc1), "");
      s += etiq(xf + w / 2 + 46, (Y(zc0) + Y(zc1)) / 2 + 4, "L", { taille: 12, couleur: COULEURS.cote });
      s += cote(id, xf - w / 2, Y(zc1) + 26, xf + w / 2, Y(zc1) + 26, "");
      s += etiq(xf + w / 2 + 6, Y(zc1) + 30, "D", { taille: 12, couleur: COULEURS.cote });
      s += renvoi(xf - w / 2 - 4, Y(2.8), xf - 44, Y(2.8) + 4, ["tubage étanche"], { ancre: "end", taille: 10.5 });
      s += renvoi(xf - w / 2, Y(zc0) + 4, xf - 44, Y(zc0) - 24, ["cavité ouverte", "(lanterne)"], { ancre: "end", taille: 10.5 });
      // Dépouillement.
      const xt = 340;
      s += etiq(xt, 104, "charge constante :", { taille: 11 });
      s += etiq(xt, 120, "on maintient h, on mesure Q", { taille: 10.5, gras: false });
      s += etiq(xt, 140, "Q = F k h", { taille: 12.5, couleur: COULEURS.bleu });
      s += etiq(xt, 176, "charge variable :", { taille: 11 });
      s += etiq(xt, 192, "on suit la baisse de h dans le tubage", { taille: 10.5, gras: false });
      s += etiq(xt, 212, "k = A ln(h1/h2) / (F Δt)", { taille: 12.5, couleur: COULEURS.bleu });
      s += etiq(xt, 248, "facteur de forme de la cavité :", { taille: 11 });
      s += etiq(xt, 268, "F = 2πL / ln[L/D + √(1 + (L/D)²)]", { taille: 11.5, couleur: COULEURS.bleu });
      return s;
    },
  });
}

// ────────────────────────────────────── Lugeon ─────────────────────────────

/** Essai Lugeon : passe isolée par obturateurs dans le rocher, pompe, débitmètre, manomètre, paliers de pression. */
export function schemaLugeon({ largeur = 600, hauteur = 330 } = {}) {
  return svg({
    largeur, hauteur, titre: "Essai Lugeon", contenu: (id) => {
      const yS = 96, xf = 196, w = 24, yO1 = 170, yO2 = 286;
      let s = terrain(id, 10, 316, [{ y0: yS, y1: 116, sol: "remblai" }, { y0: 116, y1: hauteur - 8, sol: "roche" }]);
      // Fissures du massif.
      const fissures = [[10, 148, 326, 184], [10, 226, 326, 204], [10, 262, 326, 292], [120, 312, 326, 250], [60, 130, 200, 150]];
      for (const [x1, y1, x2, y2] of fissures) s += ligne(x1, y1, x2, y2, "#1f2937", 1.6);
      s += niveauEau(10, 326, 138, false) + `<path d="M${300} ${137}l6-9h-12z" fill="${EAU}"/>`;
      s += sol(10, 326, yS);
      s += forage(xf, yS, 312, w);
      // Tube d'injection, obturateurs, perforations, eau vers les fissures.
      s += rect(xf - 4, yS - 20, 8, yO2 + 16 - (yS - 20), ACIER, TRAIT, 1);
      for (const y of [yO1, yO2]) s += rect(xf - w / 2 - 3, y - 8, w + 6, 16, "#1f2937", "#0f172a", 1, 'rx="6"');
      for (const y of [202, 228, 254]) s += ligne(xf + 4, y, xf + 9, y, EAU, 2);
      s += rect(xf - w / 2 + 1, yO1 + 8, w - 2, yO2 - yO1 - 16, "#bae6fd66", "none", 0);
      const yF = (f, x) => f[1] + ((x - f[0]) * (f[3] - f[1])) / (f[2] - f[0]);
      for (const f of [fissures[1], fissures[2]]) {
        s += fleche(id, xf + w / 2 + 2, yF(f, xf + w / 2 + 2), xf + w / 2 + 42, yF(f, xf + w / 2 + 42), { type: "bleu", ep: 1.8 });
        s += fleche(id, xf - w / 2 - 2, yF(f, xf - w / 2 - 2), xf - w / 2 - 42, yF(f, xf - w / 2 - 42), { type: "bleu", ep: 1.8 });
      }
      // Pompe, débitmètre, manomètre en surface.
      s += cercle(46, 60, 13, "#e0f2fe", EAU, 1.4) + etiq(46, 64, "P", { ancre: "middle", taille: 11, halo: false, couleur: EAU });
      s += chemin(`M59 60H84`, "none", EAU, 2) + rect(84, 52, 30, 16, "#f1f5f9", TRAIT, 1.1, 'rx="3"') + chemin(`M114 60H${xf}V${yS - 20}`, "none", EAU, 2);
      s += ligne(150, 60, 150, 42, TRAIT, 1.4) + cercle(150, 32, 10, "#fff", TRAIT, 1.2) + ligne(150, 32, 156, 26, COULEURS.effort, 1.4);
      s += etiq(46, 36, "pompe", { ancre: "middle", taille: 10.5 });
      s += etiq(99, 45, "débitmètre", { ancre: "middle", taille: 10.5 });
      s += etiq(164, 30, "manomètre", { taille: 10.5 });
      s += cote(id, 134, 32, 134, yS, "");
      s += etiq(128, 76, "hm", { ancre: "end", taille: 11, couleur: COULEURS.cote });
      s += cote(id, xf + w / 2 + 50, yO1 + 8, xf + w / 2 + 50, yO2 - 8, "");
      s += etiq(xf + w / 2 + 56, (yO1 + yO2) / 2 + 4, "passe L", { taille: 11, couleur: COULEURS.cote });
      s += renvoi(xf + w / 2 + 3, yO1 - 4, xf + 40, yO1 - 14, ["obturateur"], { taille: 10.5 });
      s += renvoi(xf + w / 2 + 3, yO2 + 4, xf + 40, yO2 + 22, ["obturateur"], { taille: 10.5 });
      s += etiq(312, 132, "nappe", { ancre: "end", taille: 10.5, couleur: EAU });
      s += etiq(24, 208, "fissures", { taille: 10.5, gras: false });
      // Paliers de pression montants puis descendants.
      const gx0 = 356, gx1 = largeur - 16, gy0 = 40, gy1 = 176, pMax = 0.8;
      const P = (p) => gy1 - (p / pMax) * (gy1 - gy0), T = (t) => gx0 + (t / 50) * (gx1 - gx0);
      s += ligne(gx0, gy1, gx1, gy1, COULEURS.trait, 1.2) + ligne(gx0, gy0, gx0, gy1, COULEURS.trait, 1.2);
      const paliers = [0.2, 0.4, 0.6, 0.4, 0.2];
      let d = `M${r1(T(0))} ${r1(P(0))}`;
      paliers.forEach((p, i) => { d += `V${r1(P(p))}H${r1(T(10 * (i + 1)))}`; });
      s += chemin(d + `V${r1(P(0))}`, "none", COULEURS.bleu, 2);
      for (const p of [0.2, 0.4, 0.6]) s += etiq(gx0 - 5, P(p) + 4, fmt(p, 2), { ancre: "end", taille: 10, gras: false, halo: false, couleur: COULEURS.discret });
      s += etiq(gx0 + 4, gy0 - 8, "pression (MPa)", { taille: 10.5, gras: false });
      s += etiq(gx1, gy1 + 16, "temps", { ancre: "end", taille: 10.5, gras: false });
      s += etiqs(gx0 + (gx1 - gx0) / 2, gy1 + 34, ["cinq paliers de 10 min,", "montants puis descendants"], { ancre: "middle", taille: 10.5 });
      s += etiq(gx0, 262, "unité Lugeon : 1 L/min par mètre", { taille: 11 });
      s += etiq(gx0, 278, "de passe sous 1 MPa", { taille: 11 });
      s += etiq(gx0, 298, "soit k voisin de 10⁻⁷ m/s", { taille: 10.5, gras: false });
      return s;
    },
  });
}

// ───────────────────────────────── Essai de pompage ────────────────────────

/** Essai de pompage en nappe libre : puits crépiné, cône de rabattement, piézomètres à r1 et r2. */
export function schemaPompage({ largeur = 600, hauteur = 320 } = {}) {
  return svg({
    largeur, hauteur, titre: "Essai de pompage", contenu: (id) => {
      const yS = 64, yB = 262, y0 = 104, xw = 84, rw = 9, R = 520;
      const Yr = (r) => y0 + (84 * Math.log(R / Math.max(r, rw))) / Math.log(R / rw);
      let s = terrain(id, 10, largeur - 20, [{ y0: yS, y1: yB, sol: "sable" }, { y0: yB, y1: hauteur - 8, sol: "argile" }]);
      // Zone saturée sous la surface libre rabattue.
      const pts = [];
      for (let x = 10; x <= largeur - 10; x += 4) pts.push(`${pts.length ? "L" : "M"}${x} ${r1(Yr(Math.abs(x - xw)))}`);
      s += `<path d="${pts.join("")}L${largeur - 10} ${yB}L10 ${yB}Z" fill="${EAU}" opacity=".16"/>`;
      s += chemin(pts.join(""), "none", EAU, 2);
      s += niveauEau(10, largeur - 10, y0);
      s += sol(10, largeur - 10, yS);
      // Puits : tubage, crépine, pompe immergée, refoulement.
      s += rect(xw - 9, yS - 26, 18, yB - yS + 26, "#fff", TRAIT, 1.2);
      s += rect(xw - 8, Yr(rw), 16, yB - Yr(rw), "#bae6fd", "none", 0);
      for (let y = 136; y < yB - 4; y += 7) s += ligne(xw - 9, y, xw - 6, y, "#1e293b", 1.2) + ligne(xw + 6, y, xw + 9, y, "#1e293b", 1.2);
      s += rect(xw - 5, 228, 10, 18, "#475569", "#1e293b", 1, 'rx="2"');
      s += chemin(`M${xw} 228V${yS - 36}H26`, "none", EAU, 2) + fleche(id, 40, yS - 36, 16, yS - 36, { type: "bleu", ep: 2 });
      s += etiq(16, yS - 44, "Q", { taille: 13, couleur: EAU });
      // Piézomètres.
      const rs = [120, 320];
      rs.forEach((r, i) => {
        const x = xw + r, yw = Yr(r);
        s += rect(x - 4, yS - 18, 8, 240 - yS + 18, "#fff", TRAIT, 1.1) + rect(x - 3, yw, 6, 240 - yw, "#bae6fd", "none", 0);
        s += cote(id, x + 16, y0, x + 16, yw, "");
        s += etiq(x + 22, (y0 + yw) / 2 + 4, `s${i + 1}`, { taille: 12, couleur: COULEURS.cote });
        s += cote(id, xw, 22 + 16 * i, x, 22 + 16 * i, "");
        s += etiq(x + 6, 26 + 16 * i, `r${i + 1}`, { taille: 11.5, couleur: COULEURS.cote });
      });
      s += renvoi(xw + 9, 150, 118, 180, ["crépine"], { taille: 10.5 });
      s += renvoi(xw + 5, 238, 118, 240, ["pompe immergée"], { taille: 10.5 });
      s += renvoi(xw + rs[1] + 4, 200, xw + rs[1] + 24, 214, ["piézomètre"], { taille: 10.5 });
      s += etiq(largeur - 30, y0 - 6, "nappe au repos", { ancre: "end", taille: 10.5, couleur: EAU });
      s += etiq(300, 168, "cône de rabattement", { taille: 11, couleur: EAU });
      s += etiq(largeur - 18, 244, "aquifère : T = k e", { ancre: "end", taille: 11 });
      s += etiq(largeur - 18, 290, "substratum imperméable", { ancre: "end", taille: 11 });
      s += etiq(20, 290, "Jacob : T = 0,183 Q / Δs", { taille: 11, couleur: COULEURS.bleu });
      return s;
    },
  });
}

// ─────────────────────────────── Sismique réfraction ───────────────────────

/** Sismique réfraction à deux couches : onde directe, onde réfractée à l'angle critique, géophones. */
export function schemaRefraction({ largeur = 600, hauteur = 290 } = {}) {
  return svg({
    largeur, hauteur, titre: "Sismique réfraction", contenu: (id) => {
      const yS = 96, yI = 186, xs = 40, rapport = 2.4;
      const ic = Math.asin(1 / rapport), dx = (yI - yS) * Math.tan(ic);
      let s = couche(id, { x: 10, y: yS, w: largeur - 20, h: yI - yS, sol: "limon" });
      s += couche(id, { x: 10, y: yI, w: largeur - 20, h: hauteur - 8 - yI, sol: "roche" });
      s += sol(10, largeur - 10, yS) + ligne(10, yI, largeur - 10, yI, COULEURS.trait, 1.2);
      // Source : masse sur une plaque.
      s += rect(xs - 10, yS - 4, 20, 4, "#475569", "#1e293b", 1);
      s += masse(xs + 30, 50, xs + 6, 80);
      s += etiqs(20, 30, ["source : masse", "frappant une plaque"], { taille: 10.5 });
      // Géophones reliés au sismographe.
      const xg = Array.from({ length: 11 }, (_, i) => 110 + 44 * i);
      s += chemin(`M${xg[0]} ${yS - 12}H${xg[10]}V64`, "none", "#475569", 1);
      s += rect(xg[10] - 44, 40, 58, 24, "#f1f5f9", TRAIT, 1.2, 'rx="4"') + rect(xg[10] - 38, 45, 30, 13, "#dcfce7", TRAIT, 0.8);
      for (const x of xg) s += chemin(`M${x - 5} ${yS - 12}h10l-5 12z`, "#0f766e", "#134e4a", 1);
      s += etiq(xg[10] - 15, 32, "sismographe", { ancre: "middle", taille: 10.5 });
      s += etiq(xg[2], yS - 20, "géophones", { ancre: "middle", taille: 10.5 });
      // Onde directe et onde réfractée (angle critique).
      s += fleche(id, xs + 12, yS + 12, 330, yS + 12, { type: "bleu", ep: 1.8 });
      s += etiq(190, yS + 30, "onde directe : V1", { ancre: "middle", taille: 10.5, couleur: COULEURS.bleu });
      const rouge = (x1, y1, x2, y2, fin = false) => ligne(x1, y1, x2, y2, COULEURS.effort, 1.8, fin ? `marker-end="url(#${id}-fl)"` : "");
      s += rouge(xs, yS, xs + dx, yI) + rouge(xs + dx, yI, xg[9] - dx, yI, true);
      for (const i of [5, 7, 9]) s += rouge(xg[i] - dx, yI, xg[i], yS, true);
      s += chemin(`M${xs} ${yS + 30}A30 30 0 0 0 ${r1(xs + 30 * Math.sin(ic))} ${r1(yS + 30 * Math.cos(ic))}`, "none", COULEURS.effort, 1);
      s += etiq(xs + 4, yS + 50, "ic", { taille: 11, couleur: COULEURS.effort });
      s += etiq(300, yI + 22, "onde réfractée : elle chemine dans la couche 2 à la vitesse V2", { ancre: "middle", taille: 10.5, couleur: COULEURS.effort });
      s += etiq(300, yI + 40, "et remonte vers chaque géophone sous l'angle critique ic", { ancre: "middle", taille: 10.5, gras: false, couleur: COULEURS.effort });
      s += etiq(120, 150, "couche 1 : vitesse V1", { taille: 11 });
      s += etiq(120, 250, "couche 2 : V2 > V1", { taille: 11 });
      s += etiq(120, 270, "sin ic = V1 / V2", { taille: 11, gras: false });
      s += cote(id, 22, yS, 22, yI, "");
      s += etiq(27, 160, "h", { taille: 12, couleur: COULEURS.cote });
      return s;
    },
  });
}

// ─────────────────────── Vitesse des ondes de cisaillement ─────────────────

/** Mesure de Vs : essai entre forages (cross-hole) et ondes de surface (MASW). */
export function schemaOndesS({ largeur = 600, hauteur = 300 } = {}) {
  return svg({
    largeur, hauteur, titre: "Mesure de la vitesse des ondes de cisaillement", contenu: (id) => {
      const yS = 78;
      let s = terrain(id, 10, largeur - 20, [{ y0: yS, y1: 142, sol: "sable" }, { y0: 142, y1: 216, sol: "argile" }, { y0: 216, y1: hauteur - 8, sol: "roche" }]);
      s += sol(10, largeur - 10, yS);
      s += ligne(290, 20, 290, hauteur - 8, COULEURS.grille, 1.4, 'stroke-dasharray="5 4"');
      // Cross-hole : deux forages équipés, source et récepteur à la même profondeur.
      const xa = 74, xb = 214, yM = 176;
      for (const x of [xa, xb]) {
        s += forage(x, yS, 282, 18) + rect(x - 5, yS - 8, 10, 282 - yS + 8, "#f8fafc", TRAIT, 1);
        for (let y = 104; y <= 272; y += 21) s += ligne(x + 9, y, x + 14, y, COULEURS.cote, 1);
      }
      s += rect(xa - 5, yM - 9, 10, 18, "#fb923c", "#9a3412", 1, 'rx="3"') + rect(xb - 5, yM - 9, 10, 18, "#34d399", "#065f46", 1, 'rx="3"');
      s += chemin(`M${xa} ${yM - 9}V46H124M${xb} ${yM - 9}V46H164`, "none", "#475569", 1);
      s += rect(124, 34, 40, 22, "#f1f5f9", TRAIT, 1.2, 'rx="4"');
      s += fleche(id, xa + 8, yM, xb - 8, yM, { type: "effort", ep: 1.8 });
      s += etiq(20, 24, "cross-hole", { taille: 12 });
      s += etiq(144, 28, "enregistreur", { ancre: "middle", taille: 10 });
      s += etiq((xa + xb) / 2, yM - 8, "onde S", { ancre: "middle", taille: 10.5, couleur: COULEURS.effort });
      s += etiqs(xb + 22, 110, ["un point", "par mètre"], { taille: 10, gras: false });
      s += renvoi(xa - 5, yM + 6, 20, yM + 34, ["source"], { taille: 10.5 });
      s += renvoi(xb + 5, yM + 6, xb + 22, yM + 30, ["récepteur"], { taille: 10.5 });
      s += etiq(150, 244, "Vs = distance / temps", { ancre: "middle", taille: 11, couleur: COULEURS.bleu });
      // MASW : ondes de surface, dont la pénétration croît avec la longueur d'onde.
      const xs = 318, xg = Array.from({ length: 11 }, (_, i) => 356 + 21 * i);
      s += rect(xs - 9, yS - 4, 18, 4, "#475569", "#1e293b", 1) + masse(xs + 24, 42, xs + 5, 68);
      for (const x of xg) s += chemin(`M${x - 4} ${yS - 10}h8l-4 10z`, "#0f766e", "#134e4a", 1);
      const onde = (y, a, lambda, couleur) => {
        const p = [];
        for (let x = 336; x <= largeur - 16; x += 2) p.push(`${p.length ? "L" : "M"}${x} ${r1(y + a * Math.sin(((x - 336) / lambda) * 2 * Math.PI))}`);
        return chemin(p.join(""), "none", couleur, 1.8);
      };
      s += onde(100, 5, 26, COULEURS.bleu) + onde(176, 9, 96, COULEURS.violet);
      s += etiq(310, 24, "ondes de surface (MASW)", { taille: 12 });
      s += etiq(largeur - 18, 124, "courte longueur d'onde : surface", { ancre: "end", taille: 10.5, couleur: COULEURS.bleu });
      s += etiq(largeur - 18, 206, "grande longueur d'onde : profondeur", { ancre: "end", taille: 10.5, couleur: COULEURS.violet });
      s += etiq(450, 244, "dispersion → profil Vs(z)", { ancre: "middle", taille: 11, couleur: COULEURS.bleu });
      s += etiq(450, 272, "G0 = ρ Vs² · Vs,30 = 30 / Σ(hi / Vs,i)", { ancre: "middle", taille: 11 });
      return s;
    },
  });
}
