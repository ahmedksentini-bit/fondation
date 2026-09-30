// Schémas explicatifs du cours, hors appareils d'essai (src/schemas-essais.js) :
// modèle de terrain, profondeurs de reconnaissance, essais de laboratoire,
// classement des sols, valeurs caractéristiques… Mêmes règles que les autres
// figures : aucun libellé sur un tracé ni sur un autre libellé, rien hors du
// cadre (tests/schemas.test.mjs).

import { svg, couche, ligne, texte, cote, fleche, COULEURS, fmt, pasJoli } from "./figures.js";
import { CLASSES_F62 } from "./geotech/sols.js";
import { degreConsolidation, surpressionRelative, facteurTemps } from "./geotech/consolidation.js";

const TRAIT = COULEURS.betonTrait, EAU = COULEURS.eau;
const r1 = (x) => x.toFixed(1);
const fr = (x, d = 2) => x.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });

function etiq(x, y, s, { ancre = "start", taille = 11, gras = true, couleur = COULEURS.encre, halo = true } = {}) {
  return texte(x, y, s, `text-anchor="${ancre}" ${halo ? 'class="halo"' : ""} style="font-size:${taille}px;font-weight:${gras ? 700 : 400};fill:${couleur}"`);
}
const etiqs = (x, y, lignes, o = {}) => lignes.map((l, i) => etiq(x, y + i * ((o.taille ?? 11) + 2), l, o)).join("");
const rect = (x, y, w, h, fond, trait = TRAIT, ep = 1.2, attrs = "") =>
  `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" fill="${fond}" stroke="${trait}" stroke-width="${ep}" ${attrs}/>`;
const chemin = (d, fond = "none", trait = TRAIT, ep = 1.2, attrs = "") => `<path d="${d}" fill="${fond}" stroke="${trait}" stroke-width="${ep}" ${attrs}/>`;
const poly = (pts) => pts.map(([x, y], i) => `${i ? "L" : "M"}${r1(x)} ${r1(y)}`).join("");
const beton = (id, x, y, w, h) => rect(x, y, w, h, COULEURS.beton, COULEURS.betonTrait, 1.3) + `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" fill="url(#${id}-beton)" opacity=".5"/>`;
/** Motif de sol dans un polygone quelconque. */
const zoneSol = (id, pts, sol) => {
  const couleurs = { remblai: "#eadfd2", limon: "#e8dcc3", argile: "#dccab0", sable: "#f3e5ae", grave: "#e3d3a0", marne: "#cfd8c7", roche: "#b8bec7", tourbe: "#8d7a64" };
  const motif = { limon: "argile", tourbe: "argile" }[sol] ?? sol;
  return `<path d="${poly(pts)}Z" fill="${couleurs[sol]}"/><path d="${poly(pts)}Z" fill="url(#${id}-${motif})"/>`;
};

// ─────────────────────────── Du sondage au modèle ─────────────────────────

/**
 * Trois sondages et la coupe interprétée entre eux : interfaces observées
 * (traits pleins sur les sondages) et interprétées (tirets), lentille molle
 * vue par un seul sondage, nappe, et les fondations qu'on calculera dessus.
 */
export function schemaModeleTerrain({ largeur = 640, hauteur = 340 } = {}) {
  return svg({
    largeur, hauteur, titre: "Du sondage au modèle de terrain", contenu: (id) => {
      const yS = 104, k = 16, Y = (z) => yS + z * k, x0 = 16, x1 = largeur - 16;
      const sp = [{ nom: "SP1", x: 120, fond: 12 }, { nom: "SP2", x: 330, fond: 10.5 }, { nom: "SP3", x: 540, fond: 14 }];
      // Profondeur de chaque interface à chaque sondage ; interpolée entre eux.
      const I = { remblai: [1.0, 1.2, 0.8], limon: [3.6, 4.2, 4.6], sable: [8.5, 9.6, 11.0] };
      const zA = (cle, x) => {
        const v = I[cle];
        if (x <= sp[0].x) return v[0];
        if (x >= sp[2].x) return v[2];
        const i = x < sp[1].x ? 0 : 1, t = (x - sp[i].x) / (sp[i + 1].x - sp[i].x);
        return v[i] + t * (v[i + 1] - v[i]);
      };
      const xs = [x0, ...sp.map((p) => p.x), x1];
      const bord = (cle) => xs.map((x) => [x, Y(zA(cle, x))]);
      const zBas = (hauteur - 8 - yS) / k;
      let s = "";
      s += zoneSol(id, [[x0, yS], [x1, yS], ...bord("remblai").reverse()], "remblai");
      s += zoneSol(id, [...bord("remblai"), ...bord("limon").reverse()], "limon");
      s += zoneSol(id, [...bord("limon"), ...bord("sable").reverse()], "sable");
      s += zoneSol(id, [...bord("sable"), [x1, Y(zBas)], [x0, Y(zBas)]], "marne");
      // Lentille d'argile molle : vue en SP3 seulement, son extension est une hypothèse.
      const xL = 418, lentille = [[xL, Y(zA("limon", xL))], ...[sp[2].x, x1].map((x) => [x, Y(zA("limon", x))]), [x1, Y(6.8)], [sp[2].x, Y(6.8)], [480, Y(6.1)]];
      s += zoneSol(id, lentille, "tourbe");
      s += chemin(`${poly(lentille)}Z`, "none", COULEURS.trait, 1.1, 'stroke-dasharray="5 3"');
      for (const cle of ["remblai", "limon", "sable"]) s += chemin(poly(bord(cle)), "none", COULEURS.trait, 1.1, 'stroke-dasharray="5 3"');
      s += ligne(x0, Y(2.5), x1, Y(2.5), EAU, 1.3, 'stroke-dasharray="6 4"') + `<path d="M${x1 - 16} ${r1(Y(2.5) - 1)}l6-9h-12z" fill="${EAU}"/>`;
      s += ligne(x0, yS, x1, yS, COULEURS.trait, 1.8);
      // Fondations : une semelle, un pieu qui traverse la lentille jusqu'à la marne.
      s += beton(id, 208, Y(1.1), 44, 10) + beton(id, 224, yS - 36, 12, Y(1.1) - yS + 36);
      s += beton(id, 452, yS - 36, 12, 36) + beton(id, 448, yS, 20, Y(12.2) - yS);
      // Sondages : colonnes, interfaces observées (traits pleins), noms.
      sp.forEach((p, i) => {
        s += rect(p.x - 6, yS, 12, Y(p.fond) - yS, "#fff", COULEURS.trait, 1.1);
        for (const cle of ["remblai", "limon", "sable"]) s += ligne(p.x - 10, Y(I[cle][i]), p.x + 10, Y(I[cle][i]), "#0f172a", 2);
        if (i === 2) s += ligne(p.x - 10, Y(6.8), p.x + 10, Y(6.8), "#0f172a", 2);
        s += etiq(p.x, yS - 8, p.nom, { ancre: "middle", taille: 11.5 });
      });
      s += etiq(24, Y(0.7), "remblai", { taille: 10.5 }) + etiq(24, Y(2.1) + 4, "limon", { taille: 10.5 });
      s += etiq(24, Y(6) + 4, "sable", { taille: 10.5 }) + etiq(24, Y(12) + 4, "marne", { taille: 10.5 });
      s += etiq(x1 - 6, Y(6.2), "argile molle", { ancre: "end", taille: 10.5, couleur: "#fff", halo: false });
      s += etiq(x1 - 24, Y(2.5) - 6, "nappe", { ancre: "end", taille: 10.5, couleur: EAU });
      s += etiq(404, Y(5.2), "?", { ancre: "middle", taille: 15, couleur: COULEURS.rouge });
      s += etiq(230, yS - 44, "semelle", { ancre: "middle", taille: 10.5 });
      s += etiq(458, yS - 44, "pieu", { ancre: "middle", taille: 10.5 });
      // Légende.
      s += ligne(24, 22, 48, 22, "#0f172a", 2) + etiq(56, 26, "interface observée dans un sondage", { taille: 10.5, gras: false });
      s += ligne(24, 42, 48, 42, COULEURS.trait, 1.1, 'stroke-dasharray="5 3"') + etiq(56, 46, "interface interprétée entre les sondages", { taille: 10.5, gras: false });
      s += etiq(x1, 26, "lentille molle vue par un seul sondage :", { ancre: "end", taille: 10.5, couleur: COULEURS.rouge });
      s += etiq(x1, 40, "jusqu'où s'étend-elle ?", { ancre: "end", taille: 10.5, gras: false, couleur: COULEURS.rouge });
      return s;
    },
  });
}

// ─────────────────────── Profondeurs de reconnaissance ─────────────────────

/** Profondeurs recommandées sous l'assise (NF EN 1997-2 annexe B.3) : semelle, radier, pieux. */
export function schemaProfondeurs({ largeur = 640, hauteur = 310 } = {}) {
  return svg({
    largeur, hauteur, titre: "Profondeurs de reconnaissance sous le niveau d'assise", contenu: (id) => {
      const yS = 62, k = 12, wP = (largeur - 40) / 3;
      let s = "";
      const panneau = (i, titre) => {
        const x = 12 + i * (wP + 8);
        s += couche(id, { x, y: yS, w: wP, h: hauteur - 8 - yS, sol: "limon" });
        s += ligne(x, yS, x + wP, yS, COULEURS.trait, 1.8);
        s += etiq(x + wP / 2, 24, titre, { ancre: "middle", taille: 11.5 });
        return x;
      };
      const sondage = (x, y0, y1) => rect(x - 4, y0, 8, y1 - y0, "#fff", COULEURS.trait, 1, 'stroke-dasharray="3 2"');
      const fleZa = (x, y0, y1, lignes) => cote(id, x, y0, x, y1, "") + etiqs(x + 8, (y0 + y1) / 2 - 4, lignes, { taille: 11, couleur: COULEURS.cote });
      // Semelle isolée : bF = 2,5 m, D = 1 m → za = max(6 ; 7,5) = 7,5 m.
      let x = panneau(0, "semelle");
      const xc = x + 62, yB = yS + k;
      s += beton(id, xc - 20, yB - 10, 40, 10) + beton(id, xc - 5, yS - 26, 10, yB - 10 - yS + 26);
      s += sondage(xc + 40, yS, yB + 7.5 * k + 16);
      s += ligne(xc - 20, yB, xc + 60, yB, COULEURS.cote, 0.9, 'stroke-dasharray="2 2"');
      s += fleZa(xc + 54, yB, yB + 7.5 * k, ["za ≥ 6 m", "et za ≥ 3 bF"]);
      s += cote(id, xc - 20, yB + 12, xc + 20, yB + 12, "");
      s += etiq(xc, yB + 28, "bF", { ancre: "middle", taille: 11, couleur: COULEURS.cote });
      s += etiqs(x + 8, hauteur - 44, ["bF = 2,5 m :", "za = 7,5 m sous l'assise"], { taille: 10.5, gras: false });
      // Radier : bB = 12 m → za = 18 m.
      x = panneau(1, "radier, semelles rapprochées");
      const xr = x + wP / 2;
      s += sondage(xr - 84, yS, yB + 18 * k);
      s += beton(id, xr - 72, yB - 10, 144, 10);
      s += ligne(xr - 72, yB, xr + 72, yB, COULEURS.cote, 0.9, 'stroke-dasharray="2 2"');
      s += fleZa(xr + 8, yB, yB + 18 * k, ["za ≥ 1,5 bB"]);
      s += cote(id, xr - 72, yB + 12, xr + 72, yB + 12, "");
      s += etiq(xr + 40, yB + 28, "bB", { ancre: "middle", taille: 11, couleur: COULEURS.cote });
      s += etiqs(x + wP - 8, hauteur - 44, ["bB = 12 m :", "za = 18 m"], { ancre: "end", taille: 10.5, gras: false });
      // Pieux : groupe de bg = 4 m, pointe à 10 m, DF = 0,8 m → za = 5 m.
      x = panneau(2, "pieux");
      const xp = x + 70, yP = yS + 10 * k;
      s += beton(id, xp - 30, yS - 12, 60, 12);
      for (const dx of [-24, 0, 24]) s += beton(id, xp + dx - 4, yS, 8, yP - yS);
      s += sondage(xp - 52, yS, yP + 5 * k + 16);
      s += ligne(xp - 30, yP, xp + 46, yP, COULEURS.cote, 0.9, 'stroke-dasharray="2 2"');
      s += fleZa(xp + 40, yP, yP + 5 * k, ["za ≥ bg,", "5 m et 3 DF"]);
      s += cote(id, xp - 28, yP + 12, xp + 28, yP + 12, "");
      s += etiq(xp, yP + 28, "bg", { ancre: "middle", taille: 11, couleur: COULEURS.cote });
      s += etiqs(x + 8, hauteur - 44, ["bg = 4 m, DF = 0,8 m :", "za = 5 m sous les pointes"], { taille: 10.5, gras: false });
      return s;
    },
  });
}

// ───────────────────────────── Essais de laboratoire ─────────────────────

/** Courbe œdométrique (e, log σ') et droite de Coulomb tangente aux cercles de Mohr. */
export function schemaLabo({ largeur = 640, hauteur = 290 } = {}) {
  return svg({
    largeur, hauteur, titre: "Essai œdométrique et essais de cisaillement", contenu: () => {
      let s = "";
      // (a) Courbe de compressibilité.
      const ax0 = 52, ax1 = 300, ay0 = 42, ay1 = 236;
      const X = (sig) => ax0 + ((Math.log10(sig) - 1) / 2) * (ax1 - ax0), E = (e) => ay1 - ((e - 0.6) / 0.4) * (ay1 - ay0);
      const e0 = 0.95, Cs = 0.03, Cc = 0.3, Lp = Math.log10(12);
      const eCharge = (sig) => { const L = Math.log10(sig / 10), t = 12 * (L - Lp); return e0 - Cs * L - ((Cc - Cs) * Math.log1p(Math.exp(t))) / 12; };
      s += ligne(ax0, ay1, ax1, ay1, COULEURS.trait, 1.2) + ligne(ax0, ay0, ax0, ay1, COULEURS.trait, 1.2);
      for (const sig of [10, 100, 1000]) s += ligne(X(sig), ay1, X(sig), ay1 + 4, COULEURS.trait, 1) + etiq(X(sig), ay1 + 16, fmt(sig, 4), { ancre: "middle", taille: 10, gras: false, halo: false, couleur: COULEURS.discret });
      const pts = [];
      for (let L = 1; L <= Math.log10(800) + 1e-9; L += 0.02) pts.push([X(10 ** L), E(eCharge(10 ** L))]);
      s += chemin(poly(pts), "none", COULEURS.bleu, 2.2);
      const eMax = eCharge(800), dech = [[X(800), E(eMax)], [X(100), E(eMax + Cs * Math.log10(8))]];
      s += chemin(poly(dech), "none", COULEURS.bleu, 1.6, 'stroke-dasharray="5 3"');
      s += ligne(X(120), ay0, X(120), ay1, COULEURS.rouge, 1, 'stroke-dasharray="3 3"');
      s += etiq(X(120) + 4, ay0 + 12, "σ'p", { taille: 11.5, couleur: COULEURS.rouge });
      s += etiq(X(22), E(eCharge(22)) - 10, "pente Cs", { taille: 10.5, couleur: COULEURS.bleu });
      s += etiq(X(330) + 8, E(eCharge(330)), "pente Cc", { taille: 10.5, couleur: COULEURS.bleu });
      s += etiq(X(260), E(eMax + Cs * Math.log10(8) * 0.4) + 18, "déchargement : Cs", { ancre: "middle", taille: 10.5, gras: false, couleur: COULEURS.bleu });
      s += etiq(ax0 + 6, E(e0) - 8, "e0", { taille: 11 });
      s += etiq(ax1, ay1 + 34, "σ' (kPa, échelle log)", { ancre: "end", taille: 10.5, gras: false });
      s += etiq(ax0 - 6, ay0 - 12, "indice des vides e", { ancre: "start", taille: 10.5, gras: false });
      s += etiq((ax0 + ax1) / 2, 18, "œdomètre : compressibilité", { ancre: "middle", taille: 11.5 });
      // (b) Cercles de Mohr et droite de Coulomb.
      const bx0 = 360, bx1 = largeur - 18, by1 = 236, by0 = 58, sMax = 500;
      const S = (x) => bx0 + (x / sMax) * (bx1 - bx0), T = (t) => by1 - (t / sMax) * (bx1 - bx0);
      const c = 12, phi = (28 * Math.PI) / 180, Kp = Math.tan(Math.PI / 4 + phi / 2) ** 2;
      s += ligne(bx0, by1, bx1, by1, COULEURS.trait, 1.2) + ligne(bx0, by0, bx0, by1, COULEURS.trait, 1.2);
      for (const s3 of [40, 90, 160]) {
        const s1 = s3 * Kp + 2 * c * Math.sqrt(Kp), cx = (s1 + s3) / 2, r = (s1 - s3) / 2;
        s += chemin(`M${r1(S(s3))} ${by1}A${r1(S(cx + r) - S(cx))} ${r1(S(cx + r) - S(cx))} 0 0 1 ${r1(S(s1))} ${by1}`, "none", COULEURS.violet, 1.5);
      }
      const sFin = sMax * 0.96, tFin = c + sFin * Math.tan(phi);
      s += ligne(S(0), T(c), S(sFin), T(tFin), COULEURS.rouge, 2);
      // Angle φ' marqué au-dessus des cercles, là où la droite est libre.
      const sA = 370, tA = c + sA * Math.tan(phi), xA = S(sA), yA = T(tA), rA = 34;
      s += ligne(xA, yA, xA + rA + 14, yA, COULEURS.rouge, 0.9, 'stroke-dasharray="3 3"');
      s += chemin(`M${r1(xA + rA)} ${r1(yA)}A${rA} ${rA} 0 0 0 ${r1(xA + rA * Math.cos(phi))} ${r1(yA - rA * Math.sin(phi))}`, "none", COULEURS.rouge, 1);
      s += etiq(xA + rA + 4, yA - 5, "φ'", { taille: 12, couleur: COULEURS.rouge });
      s += etiq(bx0 - 5, T(c) + 4, "c'", { ancre: "end", taille: 12, couleur: COULEURS.rouge });
      s += etiq(S(sFin) - 4, T(tFin) - 10, "τ = c' + σ' tan φ'", { ancre: "end", taille: 11, couleur: COULEURS.rouge });
      s += etiq(S(230), by1 + 18, "cercles de Mohr à la rupture", { ancre: "middle", taille: 10.5, gras: false, couleur: COULEURS.violet });
      s += etiq(bx1, by1 + 18, "σ'", { ancre: "end", taille: 11, gras: false });
      s += etiq(bx0 + 4, by0 - 6, "τ", { taille: 11, gras: false });
      s += etiq((bx0 + bx1) / 2, 18, "cisaillement : c' et φ'", { ancre: "middle", taille: 11.5 });
      return s;
    },
  });
}

// ─────────────────────────── Classes du Fascicule 62 ─────────────────────

const FAMILLES = [["argile", "argiles, limons"], ["sable", "sables, graves"], ["craie", "craies"], ["marne", "marnes"], ["roche", "roches"]];

/**
 * Fourchettes de pl des classes A, B, C du Fascicule 62, famille par famille,
 * sur un même axe : les trous entre fourchettes sautent aux yeux. Avec
 * `famille` et `pl`, la ligne de la famille est surlignée et la mesure placée.
 */
export function figureClassesF62({ famille = null, pl = null, largeur = 560, hauteur = 250 } = {}) {
  return svg({
    largeur, hauteur, titre: "Classes du Fascicule 62 selon la pression limite", contenu: () => {
      const x0 = 124, x1 = largeur - 18, plMax = 6, X = (p) => x0 + (Math.min(p, plMax) / plMax) * (x1 - x0);
      const y0 = 40, hL = 30;
      let s = "";
      for (let p = 0; p <= plMax; p += 1) {
        s += ligne(X(p), y0 - 4, X(p), y0 + FAMILLES.length * hL, COULEURS.grille, 1);
        s += etiq(X(p), y0 + FAMILLES.length * hL + 16, fmt(p, 2), { ancre: "middle", taille: 10, gras: false, halo: false, couleur: COULEURS.discret });
      }
      s += etiq(x1, y0 + FAMILLES.length * hL + 34, "pl (MPa)", { ancre: "end", taille: 10.5, gras: false });
      const teinte = { A: "#bfdbfe", B: "#60a5fa", C: "#1d4ed8" };
      FAMILLES.forEach(([cle, nom], i) => {
        const y = y0 + i * hL;
        if (cle === famille) s += rect(8, y, largeur - 16, hL, "#fef9c3", "none", 0, 'rx="4"');
        s += etiq(x0 - 8, y + hL / 2 + 4, nom, { ancre: "end", taille: 11, gras: cle === famille, halo: false });
        for (const c of Object.values(CLASSES_F62).filter((k) => k.famille === cle)) {
          const xa = X(c.pl[0]), xb = X(Number.isFinite(c.pl[1]) ? c.pl[1] : plMax);
          s += rect(xa, y + 6, xb - xa, hL - 12, teinte[c.lettre], "#1e3a8a", 0.8, 'rx="3"');
          if (!Number.isFinite(c.pl[1])) s += chemin(`M${r1(xb - 1)} ${y + 6}l7 ${(hL - 12) / 2}-7 ${(hL - 12) / 2}`, teinte[c.lettre], "#1e3a8a", 0.8);
          s += etiq((xa + xb) / 2, y + hL / 2 + 4, c.lettre, { ancre: "middle", taille: 11, couleur: c.lettre === "A" ? "#1e3a8a" : "#fff", halo: false });
        }
      });
      if (famille && Number.isFinite(pl) && pl > 0) {
        // Repère vertical depuis l'en-tête jusqu'à la ligne de la famille ; la mesure s'écrit en tête.
        const i = FAMILLES.findIndex(([k]) => k === famille), y = y0 + i * hL, xm = X(pl);
        s += ligne(xm, 20, xm, y + hL + 2, "#fff", 5) + ligne(xm, 20, xm, y + hL + 2, COULEURS.rouge, 2.4);
        s += etiq(xm, 15, `pl = ${fr(pl)} MPa`, { ancre: xm > x1 - 50 ? "end" : xm < x0 + 50 ? "start" : "middle", taille: 10.5, couleur: COULEURS.rouge });
      }
      s += etiq(x0, hauteur - 10, "entre deux fourchettes : aucune classe, on retient la plus faible", { taille: 10.5, gras: false });
      return s;
    },
  });
}

// ─────────────────────── Valeurs caractéristiques ─────────────────────────

/**
 * Huit essais dans une même argile : moyenne, moyenne prudente (grand volume
 * sollicité) et valeur basse (petit volume), estimées par les formules de
 * Student de l'annexe D de la NF EN 1990, et critère d'homogénéité max ≤ 2 min.
 */
export function schemaValeursCaracteristiques({ largeur = 560, hauteur = 300 } = {}) {
  const mesures = [[2.5, 0.72], [3.5, 0.58], [4.5, 0.81], [5.5, 0.66], [6.5, 0.49], [7.5, 0.77], [8.5, 0.62], [9.5, 0.70]];
  const v = mesures.map(([, p]) => p), n = v.length;
  const m = v.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)), t = 1.895; // t de Student, 95 %, 7 ddl
  const prudente = m - (t * sd) / Math.sqrt(n), basse = m - t * sd * Math.sqrt(1 + 1 / n);
  return svg({
    largeur, hauteur, titre: "Valeurs caractéristiques d'une couche", contenu: (id) => {
      const x0 = 70, x1 = 330, y0 = 34, y1 = hauteur - 30, zMax = 11, pMax = 1.0;
      const X = (p) => x0 + (p / pMax) * (x1 - x0), Y = (z) => y0 + (z / zMax) * (y1 - y0);
      let s = couche(id, { x: x0, y: Y(2), w: x1 - x0, h: Y(10) - Y(2), sol: "argile" });
      for (let p = 0; p <= pMax + 1e-9; p += 0.2) s += ligne(X(p), y0, X(p), y1, COULEURS.grille, 1) + etiq(X(p), y0 - 8, fr(p, 1), { ancre: "middle", taille: 10, gras: false, halo: false, couleur: COULEURS.discret });
      for (let z = 0; z <= zMax; z += 2) s += etiq(x0 - 6, Y(z) + 4, fmt(z, 3), { ancre: "end", taille: 10, gras: false, halo: false, couleur: COULEURS.discret });
      s += rect(x0, y0, x1 - x0, y1 - y0, "none", COULEURS.trait, 1);
      s += etiq(x0 - 6, y0 - 24, "z (m)", { ancre: "end", taille: 10, gras: false, halo: false, couleur: COULEURS.discret });
      s += etiq(x1, y1 + 18, "pl* (MPa)", { ancre: "end", taille: 10.5, gras: false });
      const vert = (p, couleur, tirets) => ligne(X(p), Y(2), X(p), Y(10), couleur, 2, tirets ? `stroke-dasharray="${tirets}"` : "");
      s += vert(m, COULEURS.bleu, "6 4") + vert(prudente, COULEURS.ec7) + vert(basse, COULEURS.rouge);
      for (const [z, p] of mesures) s += `<circle cx="${r1(X(p))}" cy="${r1(Y(z))}" r="4.5" fill="#fff" stroke="${COULEURS.encre}" stroke-width="1.6"/>`;
      const xt = 350;
      s += etiq(xt, 64, `moyenne : ${fr(m)} MPa`, { taille: 11, couleur: COULEURS.bleu });
      s += etiqs(xt, 94, [`moyenne prudente : ${fr(prudente)} MPa`, "grand volume sollicité :", "semelle large, long fût"], { taille: 10.5, couleur: COULEURS.ec7 });
      s += etiqs(xt, 150, [`valeur basse : ${fr(basse)} MPa`, "petit volume sollicité :", "pointe de pieu"], { taille: 10.5, couleur: COULEURS.rouge });
      s += etiqs(xt, 206, [`max / min = ${fr(Math.max(...v))} / ${fr(Math.min(...v))}`, `= ${fr(Math.max(...v) / Math.min(...v))} ≤ 2 : homogène`], { taille: 10.5 });
      s += etiq(x0 + 6, Y(2) + 14, "argile", { taille: 10.5 });
      return s;
    },
  });
}

// ───────────────────────────── Chapitre 4 : états limites ────────────────

/** Petite semelle de pictogramme : rectangle de béton centré en (x, y) (y = base). */
const semellePicto = (id, x, y, w = 44, h = 12, rot = 0) =>
  `<g transform="translate(${r1(x)} ${r1(y)}) rotate(${rot})">${beton(id, -w / 2, -h, w, h)}${beton(id, -5, -h - 22, 10, 22)}</g>`;

/**
 * La courbe charge–tassement d'une semelle, avec la charge de rupture et les
 * charges de service ; à droite, ce que l'on vérifie à chaque famille d'états limites.
 */
export function schemaEtatsLimites({ largeur = 640, hauteur = 330 } = {}) {
  return svg({
    largeur, hauteur, titre: "États limites ultimes et de service", contenu: (id) => {
      let s = "";
      // Courbe charge–tassement : s = a q / (1 − q), q = Q/Qu.
      const gx0 = 44, gx1 = 286, gy0 = 44, gy1 = 250, sMax = 1.6;
      const X = (q) => gx0 + q * (gx1 - gx0 - 20), Y = (t) => gy0 + (t / sMax) * (gy1 - gy0);
      const tas = (q) => (0.07 * q) / (1 - q);
      s += ligne(gx0, gy0, gx1, gy0, COULEURS.trait, 1.2) + ligne(gx0, gy0, gx0, gy1, COULEURS.trait, 1.2);
      const pts = [];
      for (let q = 0; q <= 0.955; q += 0.005) pts.push([X(q), Y(tas(q))]);
      s += chemin(poly(pts), "none", COULEURS.bleu, 2.4);
      s += ligne(X(1), gy0, X(1), gy1, COULEURS.rouge, 1.2, 'stroke-dasharray="5 4"');
      for (const [q, t, c] of [[1 / 3, "Qu/3", COULEURS.bleu], [1 / 2, "Qu/2", COULEURS.rouge]]) {
        s += ligne(X(q), gy0, X(q), Y(tas(q)), c, 1, 'stroke-dasharray="3 3"') + `<circle cx="${r1(X(q))}" cy="${r1(Y(tas(q)))}" r="4" fill="${c}"/>`;
        s += etiq(X(q), gy0 - 6, t, { ancre: "middle", taille: 10.5, couleur: c });
      }
      s += etiq(X(1) - 4, gy0 - 6, "Qu", { ancre: "middle", taille: 11, couleur: COULEURS.rouge });
      s += etiq(X(1) - 6, gy1 - 8, "rupture", { ancre: "end", taille: 10.5, couleur: COULEURS.rouge });
      s += etiqs(X(1 / 3) + 6, Y(0.55), ["service : le tassement", "reste faible et quasi linéaire"], { taille: 10, gras: false, couleur: COULEURS.bleu });
      s += etiq(gx1, gy0 - 20, "charge Q", { ancre: "end", taille: 10.5, gras: false });
      s += `<text transform="translate(${gx0 - 12} ${(gy0 + gy1) / 2}) rotate(-90)" text-anchor="middle" style="font-size:10.5px">tassement s</text>`;
      s += etiqs(gx0 + 8, hauteur - 24, ["Qu/2 et Qu/3 : les diviseurs globaux", "du Fascicule 62 (ELU et ELS)"], { taille: 10, gras: false });
      // Pictogrammes : ce que l'on vérifie.
      const x0 = 318, w = 100;
      s += etiq(x0, 30, "états limites ultimes : la ruine", { taille: 11.5, couleur: COULEURS.rouge });
      s += etiq(x0, 186, "états limites de service : l'usage", { taille: 11.5, couleur: COULEURS.bleu });
      const sol = (x, y) => couche(id, { x: x - w / 2 + 6, y, w: w - 12, h: 34, sol: "limon" }) + ligne(x - w / 2 + 6, y, x + w / 2 - 6, y, COULEURS.trait, 1.4);
      const cases = [
        ["portance", (x, y) => sol(x, y) + semellePicto(id, x, y + 6) + chemin(`M${x - 22} ${y + 6}Q${x - 6} ${y + 34} ${x + 26} ${y + 20}T${x + 42} ${y}`, "none", COULEURS.rouge, 1.6, 'stroke-dasharray="4 2"') + fleche(id, x, y - 58, x, y - 36, { ep: 2 })],
        ["glissement", (x, y) => sol(x, y) + semellePicto(id, x, y) + fleche(id, x - 44, y - 20, x - 16, y - 20, { ep: 2 }) + fleche(id, x + 26, y + 5, x + 42, y + 5, { type: "bleu", ep: 1.6 })],
        ["renversement", (x, y) => sol(x, y) + semellePicto(id, x + 4, y - 3, 44, 12, 12) + chemin(`M${x - 16} ${y - 52}A22 22 0 0 1 ${x + 16} ${y - 52}`, "none", COULEURS.effort, 1.8, `marker-end="url(#${id}-fl)"`)],
        ["tassement", (x, y) => sol(x, y) + `<g opacity=".35">${semellePicto(id, x, y)}</g>` + semellePicto(id, x, y + 9) + cote(id, x + 32, y - 12, x + 32, y - 3, "")],
        ["tassement différentiel", (x, y) => sol(x, y) + semellePicto(id, x - 26, y, 26, 10) + semellePicto(id, x + 26, y + 9, 26, 10) + ligne(x - 30, y - 32, x + 30, y - 23, COULEURS.betonTrait, 4)],
        ["décompression", (x, y) => sol(x, y) + semellePicto(id, x, y - 2, 44, 12, 6) + chemin(`M${x - 22} ${y + 1}L${x + 22} ${y + 1}L${x + 22} ${y + 16}Z`, COULEURS.rouge + "33", COULEURS.rouge, 1)],
      ];
      cases.forEach(([nom, dessin], i) => {
        const cx = x0 + 50 + (i % 3) * (w + 4), cy = i < 3 ? 110 : 266;
        s += dessin(cx, cy);
        s += etiq(cx, cy + 34 + 16, nom, { ancre: "middle", taille: 10.5 });
      });
      return s;
    },
  });
}

/** Les actions sur une fondation : structure, vent, poids des terres, eau (niveaux EB à EE), et celles du sol sur les pieux. */
export function schemaActions({ largeur = 640, hauteur = 340 } = {}) {
  return svg({
    largeur, hauteur, titre: "Actions sur une fondation", contenu: (id) => {
      const yS = 196;
      let s = "";
      // ── Semelle ──
      s += couche(id, { x: 10, y: yS, w: 300, h: hauteur - 8 - yS, sol: "limon" });
      const xs = 150, yB = 250;
      s += couche(id, { x: xs - 56, y: yS, w: 112, h: yB - 18 - yS, sol: "remblai" });
      s += ligne(10, yS, 310, yS, COULEURS.trait, 1.8);
      const niveaux = [["EE", 206], ["EH", 222], ["EF", 268], ["EB", 292]];
      for (const [n, y] of niveaux) s += ligne(18, y, 302, y, EAU, 1, 'stroke-dasharray="5 4"') + etiq(22, y - 3, n, { taille: 10, couleur: EAU });
      s += beton(id, xs - 50, yB - 18, 100, 18) + beton(id, xs - 12, 64, 24, yB - 18 - 64);
      s += fleche(id, xs - 4, 22, xs - 4, 60, { ep: 2.4 }) + fleche(id, xs + 12, 22, xs + 12, 60, { ep: 2.4 });
      s += etiq(xs - 12, 30, "G", { ancre: "end", taille: 12, couleur: COULEURS.effort }) + etiq(xs + 20, 30, "Q", { taille: 12, couleur: COULEURS.effort });
      s += fleche(id, xs - 64, 86, xs - 14, 86, { ep: 2.2 }) + etiq(xs - 66, 82, "W : vent", { ancre: "end", taille: 11, couleur: COULEURS.effort });
      for (const dx of [-38, -24, 24, 38]) s += fleche(id, xs + dx, yS + 4, xs + dx, yB - 22, { ep: 1.4 });
      s += etiq(xs + 62, yS - 8, "poids des terres", { taille: 10.5, couleur: COULEURS.effort });
      for (const dx of [-40, -20, 0, 20, 40]) s += fleche(id, xs + dx, yB + 26, xs + dx, yB + 3, { type: "bleu", ep: 1.6 });
      s += etiq(xs, 316, "sous-pression Gw", { ancre: "middle", taille: 10.5, couleur: EAU });
      s += etiqs(176, 112, ["niveaux d'eau :", "EB basses eaux, EF fréquent,", "EH hautes eaux (50 ans),", "EE exceptionnel"], { taille: 10, gras: false, couleur: EAU });
      // ── Pieux sous un remblai ──
      const x0 = 330, yR = 150;
      s += couche(id, { x: x0, y: yS, w: largeur - 10 - x0, h: 276 - yS, sol: "argile" });
      s += couche(id, { x: x0, y: 276, w: largeur - 10 - x0, h: hauteur - 8 - 276, sol: "sable" });
      s += zoneSol(id, [[x0, yS], [410, yS], [470, yR], [largeur - 10, yR], [largeur - 10, yS]], "remblai");
      s += chemin(`M${x0} ${yS}H410L470 ${yR}H${largeur - 10}`, "none", COULEURS.trait, 1.8);
      const xp = 540;
      s += beton(id, xp - 9, yR - 16, 18, 312 - yR + 16);
      for (const y of [178, 212, 246]) s += fleche(id, xp - 16, y - 12, xp - 16, y + 10, { ep: 1.8 }) + fleche(id, xp + 16, y - 12, xp + 16, y + 10, { ep: 1.8 });
      s += etiqs(xp + 26, 206, ["Gsn : le sol", "tasse et tire", "le pieu"], { taille: 10.5, couleur: COULEURS.effort });
      const xl = 400;
      s += beton(id, xl - 8, yS - 20, 16, 312 - yS + 20);
      for (const y of [220, 246]) s += fleche(id, xl + 44, y, xl + 12, y, { ep: 1.8 });
      s += etiqs(xl + 14, 290, ["Gsp : le sol", "mou flue et", "pousse le pieu"], { taille: 10.5, couleur: COULEURS.effort });
      s += etiq(largeur - 18, yR - 8, "remblai", { ancre: "end", taille: 10.5 });
      s += etiq(largeur - 18, 270, "argile molle", { ancre: "end", taille: 10.5 });
      return s;
    },
  });
}

/** Où chaque référentiel place sa sécurité : même majoration des actions, diviseur global ou coefficients partiels. */
export function schemaSecurite({ largeur = 640, hauteur = 280 } = {}) {
  return svg({
    largeur, hauteur, titre: "Où chaque référentiel place sa sécurité", contenu: (id) => {
      let s = "";
      const boite = (x, y, w, lignes, couleur, fond) => rect(x, y, w, 20 + 14 * (lignes.length - 1) + 12, fond, couleur, 1.4, 'rx="8"')
        + lignes.map((l, i) => etiq(x + w / 2, y + 20 + 14 * i, l, { ancre: "middle", taille: i ? 10.5 : 11.5, gras: !i, halo: false, couleur: i ? COULEURS.encre : couleur })).join("");
      const rang = (y, titre, actions, resistance, note) => {
        s += etiq(14, y - 10, titre, { taille: 12 });
        s += boite(14, y, 150, actions.slice(0, 2), COULEURS.effort, "#fef2f2");
        s += fleche(id, 168, y + 23, 214, y + 23, { ep: 2 });
        s += etiq(191, y + 16, "×γF", { ancre: "middle", taille: 10.5, couleur: COULEURS.effort });
        s += boite(218, y, 104, [actions[2], "sollicitation"], COULEURS.effort, "#fef2f2");
        s += etiq(338, y + 29, "≤", { ancre: "middle", taille: 20, couleur: COULEURS.encre });
        s += boite(356, y, largeur - 370, resistance, COULEURS.reaction, "#f0fdfa");
        s += etiqs(356, y + 72, note, { taille: 10.5, gras: false });
      };
      rang(44, "Fascicule 62", ["G, Q", "1,35 G + 1,5 Q", "q'ref"], ["q'0 + (q'u − q'0) / γq", "un diviseur global de la résistance nette :", "γq = 2 aux ELU, 3 aux ELS"], ["le coefficient global couvre à la fois", "le sol et la méthode"]);
      rang(160, "Eurocode 7, approche 2", ["Gk, Qk", "1,35 Gk + 1,5 Qk", "Vd"], ["R0 + A' qnet / (γR;v · γR;d;v)", "γR;v = 1,4 : la dispersion du sol", "γR;d;v = 1,2 : la précision du modèle"], ["le diviseur se décompose : 1,4 × 1,2 = 1,68", "aux ELU ; 2,3 × 1,2 = 2,76 aux ELS"]);
      return s;
    },
  });
}

// ─────────────────────────── Chapitre 5 : encastrement ─────────────────────

/** Superficielle, semi-profonde, profonde : c'est De/B qui classe une fondation. */
export function schemaTypesFondations({ largeur = 640, hauteur = 300 } = {}) {
  return svg({
    largeur, hauteur, titre: "Types de fondations selon l'encastrement", contenu: (id) => {
      const yS = 60, yC = 150, wP = (largeur - 36) / 3;
      let s = "";
      const panneau = (i, titre, critere, texte) => {
        const x = 12 + i * (wP + 6);
        s += couche(id, { x, y: yS, w: wP, h: yC - yS, sol: "limon" }) + couche(id, { x, y: yC, w: wP, h: hauteur - 60 - yC, sol: "sable" });
        s += ligne(x, yS, x + wP, yS, COULEURS.trait, 1.8);
        s += etiq(x + wP / 2, 18, titre, { ancre: "middle", taille: 12 });
        s += etiq(x + wP / 2, 36, critere, { ancre: "middle", taille: 11.5, couleur: COULEURS.bleu });
        s += etiq(x + wP / 2, hauteur - 36, texte[0], { ancre: "middle", taille: 10.5 });
        s += etiq(x + wP / 2, hauteur - 20, texte[1], { ancre: "middle", taille: 10, gras: false });
        return x + wP / 2;
      };
      let xc = panneau(0, "superficielle", "De/B < 1,5", ["semelle, radier", "NF P94-261"]);
      s += beton(id, xc - 40, yS + 26, 80, 16) + beton(id, xc - 8, yS - 10, 16, 36);
      s += cote(id, xc - 40, yS + 54, xc + 40, yS + 54, "") + etiq(xc, yS + 70, "B", { ancre: "middle", taille: 11, couleur: COULEURS.cote });
      s += cote(id, xc + 52, yS, xc + 52, yS + 42, "") + etiq(xc + 58, yS + 26, "D", { taille: 11, couleur: COULEURS.cote });
      xc = panneau(1, "semi-profonde", "1,5 ≤ De/B ≤ 5", ["puits, barrette courte", "NF P94-261, annexe P"]);
      s += beton(id, xc - 24, yS - 8, 48, 128);
      s += cote(id, xc - 24, yS + 132, xc + 24, yS + 132, "") + etiq(xc, yS + 148, "B", { ancre: "middle", taille: 11, couleur: COULEURS.cote });
      s += cote(id, xc + 36, yS, xc + 36, yS + 120, "") + etiq(xc + 42, yS + 64, "D", { taille: 11, couleur: COULEURS.cote });
      xc = panneau(2, "profonde", "De/B > 5", ["pieux, barrettes", "NF P94-262"]);
      s += beton(id, xc - 9, yS - 8, 18, hauteur - 78 - yS);
      s += cote(id, xc + 22, yS, xc + 22, hauteur - 76, "") + etiq(xc + 28, yS + 100, "D", { taille: 11, couleur: COULEURS.cote });
      s += etiq(xc - 16, hauteur - 70, "B", { ancre: "end", taille: 11, couleur: COULEURS.cote });
      return s;
    },
  });
}

/** Hauteur d'encastrement équivalente : l'aire sous le profil de pl* de la couverture, rapportée à ple*. */
export function schemaEncastrement({ largeur = 600, hauteur = 300 } = {}) {
  return svg({
    largeur, hauteur, titre: "Hauteur d'encastrement équivalente De", contenu: (id) => {
      const yS = 54, k = 40, D = 3, Y = (z) => yS + z * k, yB = Y(D), zMax = (hauteur - 30 - yS) / k;
      let s = couche(id, { x: 12, y: yS, w: 250, h: yB - yS, sol: "limon" }) + couche(id, { x: 12, y: yB, w: 250, h: Y(zMax) - yB, sol: "sable" });
      s += ligne(12, yS, 262, yS, COULEURS.trait, 1.8);
      s += beton(id, 82, yB - 16, 110, 16) + beton(id, 127, yS - 26, 20, yB - 16 - yS + 26);
      s += cote(id, 60, yS, 60, yB, "") + etiq(54, (yS + yB) / 2 + 4, "D", { ancre: "end", taille: 12, couleur: COULEURS.cote });
      s += etiq(20, yS + 18, "couverture : plus faible", { taille: 10.5 });
      s += etiq(20, yB + 30, "sol d'assise : ple*", { taille: 10.5 });
      // Profil de pl* : la couverture varie, le sol d'assise vaut ple*.
      const x0 = 330, x1 = largeur - 20, pMax = 1.6, X = (p) => x0 + (p / pMax) * (x1 - x0), ple = 1.2;
      const plc = (z) => 0.3 + 0.08 * z + 0.05 * Math.sin(3 * z);
      const pts = [];
      for (let z = 0; z <= D + 1e-9; z += 0.05) pts.push([X(plc(z)), Y(z)]);
      let aire = 0;
      for (let z = 0; z < D - 1e-9; z += 0.01) aire += plc(z + 0.005) * 0.01;
      const De = aire / ple;
      s += `<path d="M${x0} ${yS}${pts.map(([x, y]) => `L${r1(x)} ${r1(y)}`).join("")}L${x0} ${r1(yB)}Z" fill="${COULEURS.rouge}" opacity=".18"/>`;
      s += `<rect x="${x0}" y="${r1(Y(D - De))}" width="${r1(X(ple) - x0)}" height="${r1(Y(D) - Y(D - De))}" fill="${COULEURS.ec7}" opacity=".22" stroke="${COULEURS.ec7}" stroke-width="1.4" stroke-dasharray="5 3"/>`;
      s += chemin(`M${pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join("L")}L${r1(X(ple))} ${r1(yB)}L${r1(X(ple))} ${r1(Y(zMax))}`, "none", COULEURS.bleu, 2.2);
      s += ligne(x0, yS, x0, Y(zMax), COULEURS.trait, 1.2) + ligne(x0, yS, x1, yS, COULEURS.trait, 1.2);
      s += ligne(x0, yB, x1, yB, COULEURS.cote, 0.9, 'stroke-dasharray="3 3"');
      for (const p of [0, 0.5, 1, 1.5]) s += etiq(X(p), yS - 6, fr(p, 1), { ancre: "middle", taille: 10, gras: false, halo: false, couleur: COULEURS.discret });
      s += etiq(x1, yS - 22, "pl* (MPa)", { ancre: "end", taille: 10.5, gras: false });
      s += cote(id, X(ple) + 16, Y(D - De), X(ple) + 16, yB, "") + etiq(X(ple) + 22, (Y(D - De) + yB) / 2 + 4, "De", { taille: 12, couleur: COULEURS.ec7 });
      s += etiqs(X(0.52), Y(0.9), ["aire ∫ pl* dz", "de d à D"], { taille: 10.5, couleur: COULEURS.rouge });
      s += etiqs(X(ple) + 14, Y(zMax) - 30, ["même aire :", "ple* × De"], { taille: 10.5, couleur: COULEURS.ec7 });
      s += etiq(X(ple) + 6, yB + 32, "ple*", { taille: 11, couleur: COULEURS.bleu });
      s += etiq(20, hauteur - 10, `De = (1/ple*) ∫ pl* dz = ${fr(De, 2)} m pour D = ${fr(D, 1)} m`, { taille: 11, couleur: COULEURS.ec7 });
      return s;
    },
  });
}

// ─────────────────────────── Chapitre 6 : portance ─────────────────────────

/**
 * Portance pressiométrique : la zone de hauteur 1,5 B où l'on moyenne pl*,
 * le mécanisme de rupture, et la contrainte de rupture décomposée en ce que
 * le sol portait déjà (q'0) et ce qu'il ajoute (kp · ple*).
 */
export function schemaPortancePressio({ largeur = 640, hauteur = 320 } = {}) {
  return svg({
    largeur, hauteur, titre: "Portance d'une semelle par la méthode pressiométrique", contenu: (id) => {
      const yS = 64, k = 40, D = 1.5, B = 2, yB = yS + D * k, xg = 110, xd = xg + B * k;
      let s = couche(id, { x: 12, y: yS, w: 330, h: yB - yS, sol: "limon" });
      s += couche(id, { x: 12, y: yB, w: 330, h: 2.2 * k, sol: "sable" });
      s += couche(id, { x: 12, y: yB + 2.2 * k, w: 330, h: 0.6 * k, sol: "argile" });
      s += couche(id, { x: 12, y: yB + 2.8 * k, w: 330, h: hauteur - 8 - (yB + 2.8 * k), sol: "sable" });
      s += ligne(12, yS, 342, yS, COULEURS.trait, 1.8);
      // Zone de 1,5 B où ple* se calcule.
      s += `<rect x="${xg}" y="${yB}" width="${B * k}" height="${1.5 * B * k}" fill="${COULEURS.bleu}" opacity=".16" stroke="${COULEURS.bleu}" stroke-dasharray="5 3"/>`;
      // Mécanisme de rupture (schématique) de part et d'autre.
      const xm = (xg + xd) / 2, yA = yB + 0.9 * B * k;
      s += chemin(`M${xg} ${yB}L${xm} ${yA}L${xd} ${yB}`, "none", COULEURS.rouge, 1.2, 'stroke-dasharray="4 3"');
      s += chemin(`M${xm} ${yA}Q${xd + 70} ${yA + 16} ${xd + 96} ${yB + 20}L${xd + 150} ${yS}`, "none", COULEURS.rouge, 1.6, 'stroke-dasharray="4 3"');
      s += chemin(`M${xm} ${yA}Q${xg - 70} ${yA + 16} ${xg - 96} ${yB + 20}L${xg - 150 < 14 ? 14 : xg - 150} ${yS}`, "none", COULEURS.rouge, 1.6, 'stroke-dasharray="4 3"');
      s += beton(id, xg, yB - 16, B * k, 16) + beton(id, xm - 10, yS - 30, 20, yB - 16 - yS + 30);
      s += fleche(id, xm, 14, xm, yS - 32, { ep: 2.4 });
      s += cote(id, xg - 16, yB, xg - 16, yB + 1.5 * B * k, "") + etiq(xg - 22, yB + 0.75 * B * k + 4, "hr = 1,5 B", { ancre: "end", taille: 11, couleur: COULEURS.bleu });
      s += cote(id, xg, yB + 1.5 * B * k + 14, xd, yB + 1.5 * B * k + 14, "") + etiq(xm, yB + 1.5 * B * k + 30, "B", { ancre: "middle", taille: 11, couleur: COULEURS.cote });
      s += cote(id, xd + 16, yS, xd + 16, yB, "") + etiq(xd + 22, (yS + yB) / 2 + 4, "D", { taille: 11, couleur: COULEURS.cote });
      s += etiq(xd + 44, yB + 2.2 * k + 16, "couche molle", { taille: 10.5 });
      s += etiqs(xd + 44, yB + 28, ["ple* : moyenne", "géométrique de pl*", "sur hr"], { taille: 10.5, couleur: COULEURS.bleu });
      // Décomposition de la contrainte de rupture.
      const x0 = 364, base = 262, q0 = 30, qn = 150;
      s += etiq(x0, 30, "contrainte de rupture sous la semelle", { taille: 11.5 });
      s += rect(x0 + 36, base - q0, 58, q0, "#d6c3a5", COULEURS.betonTrait, 1.2);
      s += rect(x0 + 36, base - q0 - qn, 58, qn, "#bfdbfe", COULEURS.bleu, 1.4);
      s += ligne(x0 + 18, base, x0 + 110, base, COULEURS.trait, 1.4);
      s += etiqs(x0 + 102, base - q0 / 2 - 2, ["q'0 = γ' D : ce que", "le sol portait déjà"], { taille: 10.5 });
      s += etiqs(x0 + 102, base - q0 - qn / 2 - 4, ["kp · ple* : ce que", "le sol ajoute"], { taille: 10.5, couleur: COULEURS.bleu });
      s += cote(id, x0 + 26, base - q0 - qn, x0 + 26, base, "") + etiq(x0 + 20, base - (q0 + qn) / 2 + 4, "q'u", { ancre: "end", taille: 12, couleur: COULEURS.cote });
      s += etiq(x0, hauteur - 26, "F62 : q'u − q'0 = kp ple*", { taille: 11, couleur: COULEURS.f62 });
      s += etiq(x0, hauteur - 10, "EC7 : qnet = kp ple* iδ iβ", { taille: 11, couleur: COULEURS.ec7 });
      return s;
    },
  });
}

/** Charge inclinée d'un angle δ, et semelle à une distance d de la crête d'un talus de pente β. */
export function schemaInclinaisonTalus({ largeur = 640, hauteur = 290 } = {}) {
  return svg({
    largeur, hauteur, titre: "Charge inclinée et semelle en crête de talus", contenu: (id) => {
      let s = "";
      // (a) Charge inclinée.
      const yS = 118, xm = 150, yB = 160;
      s += couche(id, { x: 12, y: yS, w: 290, h: hauteur - 60 - yS, sol: "sable" }) + ligne(12, yS, 302, yS, COULEURS.trait, 1.8);
      s += beton(id, xm - 50, yB - 16, 100, 16) + beton(id, xm - 10, 104, 20, yB - 16 - 104);
      const d = (22 * Math.PI) / 180, L = 64, yF = 100, xa = xm - L * Math.sin(d), ya = yF - L * Math.cos(d);
      s += fleche(id, xa, ya, xm, yF, { ep: 2.6 });
      s += ligne(xm, yF - L - 4, xm, yF, COULEURS.effort, 1, 'stroke-dasharray="4 3"') + ligne(xa, ya, xm, ya, COULEURS.effort, 1, 'stroke-dasharray="4 3"');
      s += chemin(`M${xm} ${yF - 44}A44 44 0 0 0 ${r1(xm - 44 * Math.sin(d))} ${r1(yF - 44 * Math.cos(d))}`, "none", COULEURS.effort, 1.2);
      s += etiq(xm - 10, yF - 48, "δ", { ancre: "end", taille: 13, couleur: COULEURS.effort });
      s += etiq(xm + 6, ya + 8, "V", { taille: 11, couleur: COULEURS.effort }) + etiq((xa + xm) / 2, ya - 6, "H", { ancre: "middle", taille: 11, couleur: COULEURS.effort });
      s += etiq(xm + 22, yF - 14, "δ = arctan(Hd / Vd)", { taille: 11 });
      s += etiq(157, 18, "charge inclinée : iδ", { ancre: "middle", taille: 12 });
      s += etiqs(20, hauteur - 40, ["cohérent : iδ = (1 − δ/90°)²", "frottant : l'encastrement tempère la réduction"], { taille: 10.5, gras: false });
      // (b) Talus.
      const xc = 520, yT = 104, beta = (30 * Math.PI) / 180, yP = 226, xP = xc + (yP - yT) / Math.tan(beta);
      s += zoneSol(id, [[322, yT], [xc, yT], [Math.min(xP, largeur - 10), Math.min(yP, yT + (largeur - 10 - xc) * Math.tan(beta))], [largeur - 10, yP], [largeur - 10, hauteur - 60], [322, hauteur - 60]], "limon");
      s += chemin(`M322 ${yT}H${xc}L${r1(Math.min(xP, largeur - 10))} ${r1(Math.min(yP, yT + (largeur - 10 - xc) * Math.tan(beta)))}`, "none", COULEURS.trait, 1.8);
      const xs = 430;
      s += beton(id, xs - 40, yT + 14 - 16, 80, 16) + beton(id, xs - 9, 62, 18, yT - 2 - 62) + fleche(id, xs, 24, xs, 60, { ep: 2.2 });
      s += cote(id, xs + 40, yT + 14, xc, yT + 14, "") + etiq((xs + 40 + xc) / 2, yT + 30, "d", { ancre: "middle", taille: 12, couleur: COULEURS.cote });
      s += ligne(xc, yT, xc + 60, yT, COULEURS.cote, 0.9, 'stroke-dasharray="3 3"');
      s += chemin(`M${xc + 44} ${yT}A44 44 0 0 1 ${r1(xc + 44 * Math.cos(beta))} ${r1(yT + 44 * Math.sin(beta))}`, "none", COULEURS.cote, 1.2);
      s += etiq(xc + 50, yT + 18, "β", { taille: 13, couleur: COULEURS.cote });
      s += etiq(478, 18, "semelle en crête de talus : iβ", { ancre: "middle", taille: 12 });
      s += etiqs(332, hauteur - 40, ["iβ = 1 − 0,9 tanβ (2 − tanβ) [1 − d/8B]²", "plus d'effet au-delà de d = 8B"], { taille: 10.5, gras: false });
      return s;
    },
  });
}

// ─────────────────────────── Chapitre 7 : c–φ ──────────────────────────────

/** Les trois termes de la superposition de Terzaghi, chacun sur le mécanisme de Prandtl. */
export function schemaTerzaghi({ largeur = 640, hauteur = 260 } = {}) {
  return svg({
    largeur, hauteur, titre: "Les trois termes de la portance", contenu: (id) => {
      const wP = (largeur - 36) / 3, yS = 78, yB = 104, w = 44;
      let s = "";
      const mecanisme = (xm) => {
        const xg = xm - w / 2, xd = xm + w / 2, yA = yB + 0.62 * w;
        const cote = (sgn) => {
          const xe = sgn > 0 ? xd : xg, P = [xe + sgn * 0.95 * w, yB + 0.34 * w], Q = [xe + sgn * 1.75 * w, yB];
          return { chemin: `M${xm} ${r1(yA)}Q${r1(xe + sgn * 0.62 * w)} ${r1(yA + 6)} ${r1(P[0])} ${r1(P[1])}L${r1(Q[0])} ${yB}`, P, Q, xe };
        };
        const g = cote(-1), d = cote(1);
        const contour = `M${r1(g.Q[0])} ${yB}L${r1(g.P[0])} ${r1(g.P[1])}Q${r1(g.xe - 0.62 * w)} ${r1(yA + 6)} ${xm} ${r1(yA)}Q${r1(d.xe + 0.62 * w)} ${r1(yA + 6)} ${r1(d.P[0])} ${r1(d.P[1])}L${r1(d.Q[0])} ${yB}Z`;
        const interieur = `M${xg} ${yB}L${xm} ${r1(yA)}L${xd} ${yB}M${xd} ${yB}L${r1(d.P[0])} ${r1(d.P[1])}M${xg} ${yB}L${r1(g.P[0])} ${r1(g.P[1])}`;
        return { contour, interieur, g, d, xg, xd };
      };
      const panneau = (i, titre, formule, dessin) => {
        const x = 12 + i * (wP + 6), xm = x + wP / 2, m = mecanisme(xm);
        s += couche(id, { x, y: yS, w: wP, h: hauteur - 62 - yS, sol: "limon" }) + ligne(x, yS, x + wP, yS, COULEURS.trait, 1.8);
        s += ligne(x, yB, x + wP, yB, COULEURS.cote, 0.8, 'stroke-dasharray="2 3"');
        s += dessin(m, xm, x);
        s += chemin(m.contour, "none", COULEURS.trait, 1, 'stroke-dasharray="4 3"') + chemin(m.interieur, "none", COULEURS.trait, 0.8, 'stroke-dasharray="3 3"');
        s += beton(id, xm - w / 2, yB - 12, w, 12) + beton(id, xm - 6, yS - 26, 12, yB - 12 - yS + 26);
        s += etiq(xm, 20, titre, { ancre: "middle", taille: 12 });
        s += etiq(xm, 38, formule, { ancre: "middle", taille: 11.5, couleur: COULEURS.bleu });
      };
      panneau(0, "cohésion", "c' Nc", (m) => chemin(m.contour, "none", COULEURS.rouge, 3));
      panneau(1, "surcharge latérale", "q' Nq", (m, xm) => {
        let t = `<rect x="${r1(m.g.Q[0])}" y="${yS}" width="${r1(m.xg - m.g.Q[0])}" height="${yB - yS}" fill="${COULEURS.f62}" opacity=".35"/>`
          + `<rect x="${m.xd}" y="${yS}" width="${r1(m.d.Q[0] - m.xd)}" height="${yB - yS}" fill="${COULEURS.f62}" opacity=".35"/>`;
        for (const x of [m.g.Q[0] + 12, m.xd + 24, m.d.Q[0] - 12]) t += fleche(id, x, yS + 4, x, yB - 2, { ep: 1.6 });
        return t;
      });
      panneau(2, "poids du sol entraîné", "½ γ' B' Nγ", (m) => `<path d="${m.contour}" fill="${COULEURS.bleu}" opacity=".25"/>`);
      s += etiqs(20, hauteur - 38, ["la cohésion mobilisée le long", "de la surface de rupture"], { taille: 10.5, gras: false });
      s += etiqs(12 + wP + 14, hauteur - 38, ["le poids des terres au niveau de la", "base, que le coin de butée soulève"], { taille: 10.5, gras: false });
      s += etiqs(12 + 2 * (wP + 6) + 8, hauteur - 38, ["le poids du coin et des zones", "cisaillées : seul terme en B'"], { taille: 10.5, gras: false });
      return s;
    },
  });
}

// ─────────────────────────── Chapitre 8 : glissement ────────────────────────

/** Les forces du glissement : H contre le frottement sous la base, la butée frontale souvent négligée. */
export function schemaGlissement({ largeur = 600, hauteur = 280 } = {}) {
  return svg({
    largeur, hauteur, titre: "Glissement d'une semelle", contenu: (id) => {
      const yS = 90, xg = 170, xd = 350, yB = 176;
      let s = couche(id, { x: 12, y: yS, w: largeur - 24, h: hauteur - 8 - yS, sol: "limon" });
      s += couche(id, { x: xg - 60, y: yS, w: 60, h: yB - yS, sol: "remblai" });
      s += ligne(12, yS, largeur - 12, yS, COULEURS.trait, 1.8);
      s += beton(id, xg, yB - 34, xd - xg, 34) + beton(id, (xg + xd) / 2 - 14, 30, 28, yB - 34 - 30);
      const xm = (xg + xd) / 2;
      s += fleche(id, xm - 30, 18, xm - 30, 62, { ep: 2.6 }) + etiq(xm - 38, 34, "Vd", { ancre: "end", taille: 12, couleur: COULEURS.effort });
      s += fleche(id, xm + 76, 70, xm + 20, 70, { ep: 2.6 }) + etiq(xm + 80, 66, "Hd", { taille: 12, couleur: COULEURS.effort });
      s += fleche(id, xg + 20, yB + 10, xd - 30, yB + 10, { type: "reaction", ep: 2.6 });
      s += etiqs(xg + 22, yB + 32, ["Rh;d = Vd tanδ / (γR;h γR;d;h)", "frottement sous la base"], { taille: 10.5, couleur: COULEURS.reaction });
      for (const y of [yB - 30, yB - 16]) s += fleche(id, xg - 44, y, xg - 4, y, { type: "reaction", ep: 1.6 });
      s += etiqs(18, yB - 40, ["Rp;d : butée", "frontale, souvent", "négligée"], { taille: 10.5, couleur: COULEURS.reaction });
      s += etiqs(xd + 24, yB - 44, ["Hd ≤ Rh;d + Rp;d"], { taille: 12, couleur: COULEURS.encre });
      s += etiqs(xd + 24, yB - 22, ["F62 : Vd tanφ'/1,2 + c' A'/1,5", "EC7 : δ = φ'crit, c' négligée"], { taille: 10.5, gras: false });
      s += etiqs(18, hauteur - 28, ["cas dimensionnant : H maximal avec la plus petite charge verticale", "(G favorable, charges d'exploitation verticales absentes)"], { taille: 10.5, gras: false, couleur: COULEURS.rouge });
      return s;
    },
  });
}

/** Dispositions constructives : hors gel, béton de propreté, enrobage, épaisseur d'une semelle non armée, distance au talus. */
export function schemaDispositions({ largeur = 640, hauteur = 300 } = {}) {
  return svg({
    largeur, hauteur, titre: "Dispositions constructives d'une semelle", contenu: (id) => {
      const yS = 70, xc = 480, yT = yS, beta = (34 * Math.PI) / 180;
      const pente = (x) => yT + (x - xc) * Math.tan(beta);
      const xFin = largeur - 10, yFin = pente(xFin);
      let s = zoneSol(id, [[12, yS], [xc, yT], [xFin, yFin], [xFin, hauteur - 8], [12, hauteur - 8]], "limon");
      s += chemin(`M12 ${yS}H${xc}L${xFin} ${r1(yFin)}`, "none", COULEURS.trait, 1.8);
      // Semelle : béton de propreté, semelle, poteau.
      const xg = 170, xd = 330, yB = 170, h = 44, yP = yB + 10;
      s += `<rect x="${xg - 10}" y="${yB}" width="${xd - xg + 20}" height="10" fill="#e5e7eb" stroke="${COULEURS.trait}" stroke-width="1"/>`;
      s += beton(id, xg, yB - h, xd - xg, h) + beton(id, 232, yS - 30, 36, yB - h - yS + 30);
      for (let x = xg + 12; x <= xd - 12; x += 16) s += `<circle cx="${x}" cy="${yB - 8}" r="2.4" fill="#1e293b"/>`;
      s += ligne(xg + 8, yB - 8, xd - 8, yB - 8, "#1e293b", 1.2);
      // Profondeur hors gel.
      s += ligne(12, yS + 34, 420, yS + 34, COULEURS.bleu, 1.1, 'stroke-dasharray="6 3"');
      s += etiq(20, yS + 30, "profondeur de gel", { taille: 10.5, couleur: COULEURS.bleu });
      s += cote(id, 118, yS, 118, yB, "") + etiqs(24, yS + 64, ["hors gel :", "≥ 0,50 m en", "terrain meuble"], { taille: 10.5, couleur: COULEURS.cote });
      // Épaisseur et débord d'une semelle non armée.
      s += cote(id, xg, yB - h - 12, 232, yB - h - 12, "") + etiq((xg + 232) / 2, yB - h - 18, "a", { ancre: "middle", taille: 11, couleur: COULEURS.cote });
      s += cote(id, xd + 14, yB - h, xd + 14, yB, "") + etiq(xd + 20, yB - h / 2 + 4, "h ≥ 2a", { taille: 11, couleur: COULEURS.cote });
      s += etiqs(xd + 20, yB - h / 2 + 18, ["(non armée)"], { taille: 10, gras: false, couleur: COULEURS.cote });
      // Béton de propreté, enrobage.
      s += etiqs(xg - 10, yB + 30, ["béton de propreté ;", "enrobage des aciers ≥ 5 cm (F62)"], { taille: 10.5 });
      // Distance au talus.
      const yH = yB, xT = xc + (yH - yT) / Math.tan(beta);
      s += cote(id, xd + 10, yH + 22, xT, yH + 22, "") + ligne(xT, yH, xT, yH + 28, COULEURS.cote, 0.8, 'stroke-dasharray="2 2"');
      s += etiqs(xd + 26, yH + 46, ["≥ 2,00 m jusqu'à la surface", "du talus (terrain meuble)"], { taille: 10.5, couleur: COULEURS.cote });
      return s;
    },
  });
}

// ─────────────────────────── Chapitre 9 : tassements ────────────────────────

/** Les seize tranches de Ménard et leurs poids dans le module déviatorique Ed. */
export function schemaTranchesMenard({ largeur = 600, hauteur = 396 } = {}) {
  return svg({
    largeur, hauteur, titre: "Tranches de la méthode pressiométrique", contenu: (id) => {
      const yB = 60, k = 20, xg = 110, B = 2 * k * 2 / 2; // B = 40 px : chaque tranche fait B/2 = 20 px
      const xd = xg + 2 * k * 1, yT = (i) => yB + i * k;
      let s = couche(id, { x: 12, y: 34, w: 300, h: hauteur - 8 - 34, sol: "limon" });
      s += ligne(12, 34, 312, 34, COULEURS.trait, 1.8);
      s += beton(id, xg, yB - 12, xd - xg, 12) + beton(id, (xg + xd) / 2 - 6, 18, 12, yB - 12 - 18);
      const groupes = [["E1", 0, 1, "#fca5a5"], ["E2", 1, 2, "#fdba74"], ["E3;5", 2, 5, "#fde68a"], ["E6;8", 5, 8, "#bbf7d0"], ["E9;16", 8, 16, "#bfdbfe"]];
      for (const [nom, a, b, c] of groupes) {
        s += `<rect x="${xg - 30}" y="${yT(a)}" width="${xd - xg + 60}" height="${yT(b) - yT(a)}" fill="${c}" opacity=".75" stroke="${COULEURS.trait}" stroke-width=".8"/>`;
        s += etiq(xd + 38, (yT(a) + yT(b)) / 2 + 4, nom, { taille: 11 });
      }
      for (let i = 1; i < 16; i++) s += ligne(xg - 30, yT(i), xd + 30, yT(i), COULEURS.trait, 0.5, 'stroke-dasharray="2 2"');
      s += cote(id, xg - 44, yT(0), xg - 44, yT(1), "") + etiq(xg - 50, yT(0.5) + 4, "B/2", { ancre: "end", taille: 10.5, couleur: COULEURS.cote });
      s += cote(id, xg - 44, yT(1), xg - 44, yT(16), "") + etiq(xg - 50, yT(9) + 4, "8 B", { ancre: "end", taille: 11, couleur: COULEURS.cote });
      s += ligne(xg - 30, yT(0.5), 64, yT(2.4) - 4, COULEURS.discret, 0.9) + etiqs(20, yT(2.4) + 8, ["tassement", "sphérique"], { taille: 10.5, couleur: COULEURS.rouge });
      s += etiqs(20, yT(12), ["tassement", "déviatorique"], { taille: 10.5, couleur: COULEURS.bleu });
      // Poids des groupes dans 1/Ed (NF P94-261) et dans 4/Ed (F62), en barres.
      const x0 = 360, x1 = largeur - 16, poids = [0.25, 0.30, 0.25, 0.10, 0.10], pF = [1, 1 / 0.85, 1, 1 / 2.5, 1 / 2.5].map((p) => p / 4);
      s += etiq(x0, 30, "poids dans 1/Ed", { taille: 11.5 });
      s += etiq(x0, 46, "NF P94-261 · F62 (divisé par 4)", { taille: 10, gras: false });
      groupes.forEach(([nom, a, b, c], i) => {
        const y = 70 + i * 52, X = (p) => x0 + (p / 0.32) * (x1 - x0 - 44);
        s += etiq(x0, y + 2, nom, { taille: 11 });
        s += rect(x0, y + 8, X(poids[i]) - x0, 13, COULEURS.ec7, "none", 0) + etiq(X(poids[i]) + 5, y + 19, fr(poids[i], 2), { taille: 10, gras: false, halo: false });
        s += rect(x0, y + 24, X(pF[i]) - x0, 13, COULEURS.f62, "none", 0) + etiq(X(pF[i]) + 5, y + 35, fr(pF[i], 3), { taille: 10, gras: false, halo: false });
      });
      s += etiqs(x0, hauteur - 26, ["Ec = E1 · Ei : moyenne harmonique", "des modules de la tranche i"], { taille: 10.5, gras: false });
      return s;
    },
  });
}

/** Le sol remplacé par des ressorts : p = k · y, et k dépend de la largeur. */
export function schemaWinkler({ largeur = 560, hauteur = 226 } = {}) {
  return svg({
    largeur, hauteur, titre: "Module de réaction : le sol remplacé par des ressorts", contenu: (id) => {
      let s = "";
      const y0 = 70, x0 = 60, x1 = 500;
      s += rect(x0, y0, x1 - x0, 22, COULEURS.beton, COULEURS.betonTrait, 1.3) + `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="22" fill="url(#${id}-beton)" opacity=".5"/>`;
      for (const x of [140, 280, 420]) s += fleche(id, x, 24, x, y0 - 2, { ep: 2.2 });
      const def = (x) => 16 * Math.sin((Math.PI * (x - x0)) / (x1 - x0)) + 6;
      for (let x = x0 + 14; x <= x1 - 14; x += 24) {
        const y1 = y0 + 22, y2 = 170 + 0 * def(x);
        const zig = [];
        for (let i = 0; i <= 8; i++) zig.push(`${i ? "L" : "M"}${r1(x + (i % 2 ? 6 : -6) * (i > 0 && i < 8 ? 1 : 0))} ${r1(y1 + 8 + (i * (y2 - y1 - 16)) / 8)}`);
        s += ligne(x, y1, x, y1 + 8, COULEURS.trait, 1.2) + chemin(zig.join(""), "none", COULEURS.trait, 1.2) + ligne(x, y2 - 8, x, y2, COULEURS.trait, 1.2);
      }
      s += ligne(x0 - 20, 170, x1 + 20, 170, COULEURS.trait, 2);
      for (let x = x0 - 16; x <= x1 + 16; x += 12) s += ligne(x, 170, x - 8, 180, COULEURS.trait, 1);
      s += etiq(x0 + 10, y0 + 15, "semelle ou radier", { taille: 10.5 });
      s += etiq(20, 200, "p = k · y : chaque ressort ne voit que son propre enfoncement ;", { taille: 10.5, gras: false });
      s += etiq(20, 214, "k dépend de la largeur B : ce n'est pas une propriété du sol.", { taille: 10.5, gras: false });
      return s;
    },
  });
}

// ─────────────────────────── Chapitre 3 : la courbe ─────────────────────────

/** Courbe pressiométrique idéalisée : trois phases, V1, pf, pl à Vs + 2V1 ; en dessous, la courbe de fluage. */
export function schemaCourbePressio({ largeur = 600, hauteur = 380 } = {}) {
  return svg({
    largeur, hauteur, titre: "Courbe pressiométrique et courbe de fluage", contenu: () => {
      const x0 = 70, x1 = largeur - 30, y0 = 30, y1 = 228, pMax = 2.2, VMax = 900;
      const X = (p) => x0 + (p / pMax) * (x1 - x0), Y = (V) => y1 - (V / VMax) * (y1 - y0);
      // Courbe : remise en contact, droite pseudo-élastique, phase plastique vers pl.
      const Vs = 535, V1 = 150, pf = 1.1, pl = 1.75, p1 = 0.3;
      const V = (p) => {
        if (p <= p1) return 40 + (V1 - 40) * Math.sqrt(p / p1);
        if (p <= pf) return V1 + ((p - p1) / (pf - p1)) * 90;
        const Vf = V1 + 90, t = (p - pf) / (pl - pf); // Vf à pf, Vs + 2V1 = 835 à pl
        return Vf + (Vs + 2 * V1 - Vf) * (Math.exp(2.2 * t) - 1) / (Math.exp(2.2) - 1);
      };
      let s = ligne(x0, y1, x1, y1, COULEURS.trait, 1.2) + ligne(x0, y0, x0, y1, COULEURS.trait, 1.2);
      const pts = [];
      for (let p = 0; p <= pl + 0.06; p += 0.01) pts.push([X(p), Y(V(p))]);
      s += `<rect x="${r1(X(p1))}" y="${y0}" width="${r1(X(pf) - X(p1))}" height="${y1 - y0}" fill="${COULEURS.ec7}" opacity=".08"/>`;
      s += chemin(poly(pts), "none", COULEURS.bleu, 2.4);
      s += ligne(x0, Y(Vs + 2 * V1), x1, Y(Vs + 2 * V1), COULEURS.rouge, 1, 'stroke-dasharray="5 4"');
      s += etiq(x0 + 6, Y(Vs + 2 * V1) - 6, "Vs + 2 V1 : la cavité a doublé de volume", { taille: 10.5, couleur: COULEURS.rouge });
      for (const [p, t, c] of [[p1, "p1", COULEURS.ec7], [pf, "pf", COULEURS.ec7], [pl, "pl", COULEURS.rouge]]) {
        s += ligne(X(p), Y(V(p)), X(p), y1, c, 1, 'stroke-dasharray="3 3"') + etiq(X(p), y1 + 16, t, { ancre: "middle", taille: 11.5, couleur: c });
      }
      s += ligne(x0 - 4, Y(V1), X(p1), Y(V1), COULEURS.cote, 0.9, 'stroke-dasharray="2 2"') + etiq(x0 - 6, Y(V1) + 4, "V1", { ancre: "end", taille: 11, couleur: COULEURS.cote });
      s += etiq((X(p1) + X(pf)) / 2, Y(V((p1 + pf) / 2)) - 12, "EM ∝ Δp/ΔV", { ancre: "middle", taille: 11, couleur: COULEURS.ec7 });
      s += etiq(X(0.12), Y(20) - 4, "I", { ancre: "middle", taille: 12, couleur: COULEURS.discret });
      s += etiq((X(p1) + X(pf)) / 2, y1 - 10, "II · pseudo-élastique", { ancre: "middle", taille: 10.5, couleur: COULEURS.ec7 });
      s += etiq(X(1.45), y1 - 10, "III · plastique", { ancre: "middle", taille: 10.5, couleur: COULEURS.discret });
      s += etiq(x1, y1 + 32, "pression p", { ancre: "end", taille: 10.5, gras: false });
      s += etiq(x0 + 4, y0 - 10, "volume injecté V", { taille: 10.5, gras: false });
      // Courbe de fluage : ΔV60/30 en fonction de p, cassure à pf.
      const fy0 = 282, fy1 = hauteur - 30, F = (p) => (p <= pf ? 4 + 3 * p : 4 + 3 * pf + 38 * (p - pf) ** 1.4);
      const FY = (v) => fy1 - (v / 40) * (fy1 - fy0);
      s += ligne(x0, fy1, x1, fy1, COULEURS.trait, 1.2) + ligne(x0, fy0, x0, fy1, COULEURS.trait, 1.2);
      const pf2 = [];
      for (let p = 0.1; p <= 1.62; p += 0.1) pf2.push([X(p), FY(F(p))]);
      s += chemin(poly(pf2), "none", COULEURS.violet, 1.8) + pf2.map(([x, y]) => `<circle cx="${r1(x)}" cy="${r1(y)}" r="2.6" fill="${COULEURS.violet}"/>`).join("");
      s += ligne(X(pf), fy0, X(pf), fy1, COULEURS.ec7, 1, 'stroke-dasharray="3 3"');
      s += etiq(x0 + 4, fy0 - 6, "fluage ΔV60/30", { taille: 10.5, gras: false });
      s += etiq(X(pf) + 6, fy0 + 10, "cassure : pf", { taille: 10.5, couleur: COULEURS.ec7 });
      return s;
    },
  });
}

// ─────────────────────────── Chapitre 10 : pieux ────────────────────────────

/** Quatre modes d'exécution : le sol extrait (forés, tarière creuse) ou refoulé (battus, vissés). */
export function schemaMiseEnOeuvre({ largeur = 640, hauteur = 290 } = {}) {
  return svg({
    largeur, hauteur, titre: "Mise en œuvre des pieux", contenu: (id) => {
      const wP = (largeur - 36) / 4, yS = 78, yF = 226;
      let s = "";
      const panneau = (i, titre, legende) => {
        const x = 12 + i * (wP + 4), xm = x + wP / 2;
        s += couche(id, { x, y: yS, w: wP, h: hauteur - 48 - yS, sol: "sable" }) + ligne(x, yS, x + wP, yS, COULEURS.trait, 1.8);
        s += etiq(xm, 20, titre, { ancre: "middle", taille: 11.5 });
        s += etiqs(xm, hauteur - 30, legende, { ancre: "middle", taille: 10, gras: false });
        return xm;
      };
      // Foré : l'outil extrait le sol, le béton remplit le trou.
      let xm = panneau(0, "foré", ["sol extrait :", "terrain décomprimé"]);
      s += `<rect x="${xm - 14}" y="${yS}" width="28" height="${yF - yS}" fill="#fff" stroke="${COULEURS.trait}" stroke-dasharray="4 3"/>`;
      s += beton(id, xm - 14, yF - 60, 28, 60) + rect(xm - 3, 34, 6, yF - 90, ACIER_C, TRAIT, 1) + rect(xm - 13, yF - 104, 26, 28, "#94a3b8", TRAIT, 1, 'rx="3"');
      s += fleche(id, xm + 22, yS - 4, xm + 22, 40, { type: "bleu", ep: 1.6 }) + etiq(xm + 26, 36, "déblais", { taille: 10, couleur: COULEURS.bleu });
      // Tarière creuse : bétonnage par l'âme pendant la remontée.
      xm = panneau(1, "tarière creuse", ["bétonné par l'âme", "à la remontée"]);
      s += beton(id, xm - 14, yF - 70, 28, 70);
      let d = "";
      for (let y = 40; y < yF - 70; y += 14) d += `M${xm - 14} ${y + 7}L${xm + 14} ${y}`;
      s += rect(xm - 3, 34, 6, yF - 70 - 34, ACIER_C, TRAIT, 1) + chemin(d, "none", TRAIT, 1.6);
      s += fleche(id, xm + 24, yF - 80, xm + 24, yF - 130, { type: "bleu", ep: 1.6 }) + etiq(xm + 28, yF - 120, "remontée", { taille: 10, couleur: COULEURS.bleu });
      // Battu : le mouton enfonce un pieu préfabriqué, le sol est chassé.
      xm = panneau(2, "battu", ["sol refoulé :", "terrain densifié"]);
      s += beton(id, xm - 12, 60, 24, yF - 60) + rect(xm - 16, 30, 32, 18, "#64748b", "#1e293b", 1.2, 'rx="3"') + fleche(id, xm - 26, 20, xm - 26, 50, { ep: 1.8 });
      for (const y of [150, 190]) s += fleche(id, xm - 16, y, xm - 38, y, { ep: 1.6 }) + fleche(id, xm + 16, y, xm + 38, y, { ep: 1.6 });
      // Vissé : l'outil refoule le sol en descendant.
      xm = panneau(3, "vissé", ["sol refoulé,", "sans vibrations"]);
      s += beton(id, xm - 12, 60, 24, yF - 80) + chemin(`M${xm - 22} ${yF - 20}L${xm} ${yF}L${xm + 22} ${yF - 20}L${xm} ${yF - 12}Z`, "#94a3b8", TRAIT, 1.2);
      for (let y = yF - 70; y < yF - 20; y += 12) s += chemin(`M${xm - 20} ${y}L${xm + 20} ${y + 8}`, "none", TRAIT, 1.8);
      s += chemin(`M${xm - 20} 50A20 6 0 1 0 ${xm + 20} 49`, "none", COULEURS.effort, 1.8, `marker-end="url(#${id}-fl)"`);
      for (const y of [170, 200]) s += fleche(id, xm - 16, y, xm - 38, y, { ep: 1.6 }) + fleche(id, xm + 16, y, xm + 38, y, { ep: 1.6 });
      return s;
    },
  });
}
const ACIER_C = "#cbd5e1";

/** Transfert de la charge : frottement mobilisé vite, pointe lentement ; effort normal décroissant le long du fût. */
export function schemaTransfert({ largeur = 640, hauteur = 320 } = {}) {
  return svg({
    largeur, hauteur, titre: "Transfert de la charge d'un pieu au sol", contenu: (id) => {
      const yS = 70, yP = 282, xp = 120, B = 26;
      let s = couche(id, { x: 12, y: yS, w: 230, h: 150, sol: "argile" }) + couche(id, { x: 12, y: yS + 150, w: 230, h: hauteur - 8 - yS - 150, sol: "sable" });
      s += ligne(12, yS, 242, yS, COULEURS.trait, 1.8);
      s += beton(id, xp - B / 2, yS - 20, B, yP - yS + 20);
      s += fleche(id, xp, 18, xp, yS - 22, { ep: 2.6 }) + etiq(xp + 8, 32, "Q", { taille: 13, couleur: COULEURS.effort });
      for (const y of [100, 150, 200, 250]) s += fleche(id, xp - B / 2 - 7, y + 12, xp - B / 2 - 7, y - 10, { type: "reaction", ep: 1.6 }) + fleche(id, xp + B / 2 + 7, y + 12, xp + B / 2 + 7, y - 10, { type: "reaction", ep: 1.6 });
      s += fleche(id, xp, yP + 22, xp, yP + 3, { type: "reaction", ep: 2.2 });
      s += etiq(xp + B / 2 + 14, 176, "qs", { taille: 12, couleur: COULEURS.reaction }) + etiq(xp + 8, yP + 20, "qb", { taille: 12, couleur: COULEURS.reaction });
      // Effort normal dans le fût : de Q en tête à Rb à la pointe.
      const x0 = 172, X = (n) => x0 + n * 56;
      s += ligne(x0, yS - 20, x0, yP, COULEURS.trait, 1);
      s += chemin(`M${r1(X(1))} ${yS - 20}L${r1(X(0.78))} ${yS + 60}L${r1(X(0.5))} ${yS + 150}L${r1(X(0.28))} ${yP}L${x0} ${yP}`, "none", COULEURS.violet, 2);
      s += etiq(X(1) + 4, yS - 24, "N(z)", { taille: 11, couleur: COULEURS.violet });
      // Lois de mobilisation.
      const g = (x, y, titre, pente, sLim, note) => {
        const w = 160, h = 92;
        let t = ligne(x, y + h, x + w, y + h, COULEURS.trait, 1.1) + ligne(x, y, x, y + h, COULEURS.trait, 1.1);
        const xa = x + pente * w, ya = y + h * 0.5, xb = x + sLim * w;
        t += chemin(`M${x} ${y + h}L${r1(xa)} ${r1(ya)}L${r1(xb)} ${y + 12}H${x + w}`, "none", COULEURS.reaction, 2);
        t += etiq(x + 4, y - 6, titre, { taille: 11 });
        t += etiq(x, y + h + 16, note, { taille: 10, couleur: COULEURS.reaction });
        return t;
      };
      s += g(300, 60, "frottement qs", 0.04, 0.14, "atteint après quelques mm de déplacement");
      s += g(300, 196, "pointe qb", 0.12, 0.7, "atteinte vers B/10 de déplacement");
      s += etiqs(480, 84, ["le frottement se mobilise", "vite ; la pointe est une", "réserve lente"], { taille: 10.5, gras: false });
      s += etiqs(480, 216, ["Frank et Zhao : pente", "kt, kq puis divisée par 5", "au-delà de la moitié", "de la valeur limite"], { taille: 10.5, gras: false });
      return s;
    },
  });
}

// ─────────────────────────── Chapitre 11 : la pointe ────────────────────────

/** Où l'on moyenne pl* sous un pieu : de D − b à D + 3a ; le frottement couche par couche le long du fût. */
export function schemaPointePieu({ largeur = 600, hauteur = 340 } = {}) {
  return svg({
    largeur, hauteur, titre: "Portance d'un pieu : pointe et frottement", contenu: (id) => {
      const yS = 56, xp = 200, B = 30, yP = 236, a = 28, b = 26;
      let s = couche(id, { x: 12, y: yS, w: 380, h: 90, sol: "argile" }) + couche(id, { x: 12, y: yS + 90, w: 380, h: 70, sol: "sable" });
      s += couche(id, { x: 12, y: yS + 160, w: 380, h: hauteur - 8 - yS - 160, sol: "marne" });
      s += ligne(12, yS, 392, yS, COULEURS.trait, 1.8);
      s += `<rect x="${xp - 70}" y="${yP - b}" width="140" height="${b + 3 * a}" fill="${COULEURS.bleu}" opacity=".2" stroke="${COULEURS.bleu}" stroke-dasharray="5 3"/>`;
      s += beton(id, xp - B / 2, yS - 16, B, yP - yS + 16);
      for (const [y0, y1, c] of [[yS, yS + 90, "#fca5a5"], [yS + 90, yS + 160, "#fde68a"], [yS + 160, yP, "#bbf7d0"]]) s += rect(xp + B / 2 + 4, y0 + 3, 10, y1 - y0 - 6, c, COULEURS.trait, 0.8);
      s += cote(id, xp - 84, yP - b, xp - 84, yP, "") + etiq(xp - 90, yP - b / 2 + 4, "b", { ancre: "end", taille: 12, couleur: COULEURS.cote });
      s += cote(id, xp - 84, yP, xp - 84, yP + 3 * a, "") + etiq(xp - 90, yP + 1.5 * a + 4, "3a", { ancre: "end", taille: 12, couleur: COULEURS.cote });
      s += ligne(xp - 90, yP, xp + 90, yP, COULEURS.cote, 0.9, 'stroke-dasharray="2 2"');
      s += cote(id, xp - B / 2, yS - 26, xp + B / 2, yS - 26, "") + etiq(xp + B / 2 + 6, yS - 22, "B", { taille: 11, couleur: COULEURS.cote });
      s += etiqs(xp + 80, yP + 24, ["ple* : moyenne", "arithmétique", "de pl* sur b + 3a"], { taille: 10.5, couleur: COULEURS.bleu });
      s += etiqs(xp + 34, yS + 44, ["qs1 · h1"], { taille: 10.5 }) + etiqs(xp + 34, yS + 128, ["qs2 · h2"], { taille: 10.5 }) + etiqs(xp + 34, yS + 180, ["qs3 · h3"], { taille: 10.5 });
      s += etiq(20, yS + 20, "argile molle", { taille: 10.5 }) + etiq(20, yS + 110, "sable", { taille: 10.5 }) + etiq(20, hauteur - 16, "marne d'ancrage", { taille: 10.5 });
      const xt = 410;
      s += etiqs(xt, 70, ["Rc = Rb + Rs", "= Ab · qb + P · Σ qs,i hi"], { taille: 11.5, couleur: COULEURS.encre });
      s += etiqs(xt, 124, ["a = max(B/2 ; 0,5 m)", "b = min(a ; h)", "h : ancrage dans la", "couche porteuse"], { taille: 10.5, gras: false });
      s += etiqs(xt, 206, ["qb = kp · ple*", "kp croît avec", "l'ancrage (Def)"], { taille: 10.5, gras: false });
      return s;
    },
  });
}

// ─────────────────────────── Chapitre 12 : justifier ────────────────────────

/** Du calculé au caractéristique puis au calcul (NF P94-262), face aux quatre divisions du Fascicule 62. */
export function schemaProcedures({ largeur = 640, hauteur = 330 } = {}) {
  return svg({
    largeur, hauteur, titre: "Justifier un pieu : les étapes de la sécurité", contenu: (id) => {
      let s = "";
      const boite = (x, y, w, lignes, couleur, fond) => {
        const h = 16 + 14 * lignes.length;
        return rect(x, y, w, h, fond, couleur, 1.3, 'rx="8"') + lignes.map((l, i) => etiq(x + w / 2, y + 20 + 14 * i, l, { ancre: "middle", taille: i ? 10.5 : 11.5, gras: !i, halo: false, couleur: i ? COULEURS.encre : couleur })).join("");
      };
      const fl = (x1, y1, x2, y2, t, dx = 6) => fleche(id, x1, y1, x2, y2, { type: "bleu", ep: 1.8 }) + (t ? etiq((x1 + x2) / 2 + dx, (y1 + y2) / 2 + 4, t, { taille: 10.5, couleur: COULEURS.bleu }) : "");
      s += etiq(14, 22, "NF P94-262", { taille: 12, couleur: COULEURS.ec7 });
      s += boite(14, 34, 220, ["valeurs calculées Rb, Rs", "formules du chapitre 11"], COULEURS.ec7, "#f0fdfa");
      s += fl(80, 80, 80, 118) + fl(170, 80, 250, 118);
      s += boite(14, 122, 150, ["modèle de terrain", "÷ γR;d1 · γR;d2"], COULEURS.ec7, "#f0fdfa");
      s += boite(180, 122, 170, ["pieu modèle", "min(moy/ξ3 ; min/ξ4)", "÷ γR;d1"], COULEURS.ec7, "#f0fdfa");
      s += fl(88, 168, 140, 202) + fl(262, 182, 210, 202);
      s += boite(90, 206, 180, ["valeurs caractéristiques", "Rc;k et Rc;cr;k"], COULEURS.ec7, "#f0fdfa");
      s += fl(180, 250, 180, 276, "÷ γt : 1,1 · 0,9 · 1,1", 12);
      s += boite(90, 280, 180, ["Fc;d ≤ Rc;d"], COULEURS.ec7, "#ecfdf5");
      // Fascicule 62.
      const x = 420;
      s += etiq(x, 22, "Fascicule 62", { taille: 12, couleur: COULEURS.f62 });
      s += boite(x, 34, 200, ["Qu = Qpu + Qsu", "Qc = 0,5 ou 0,7 Qpu + 0,7 Qsu"], COULEURS.f62, "#fffbeb");
      s += fl(x + 100, 80, x + 100, 202, "÷ 1,4 (ELU) · 1,1 (rare) · 1,4 (QP)", -92);
      s += boite(x, 206, 200, ["Qmax, Qmin", "une seule division"], COULEURS.f62, "#fffbeb");
      s += fl(x + 100, 250, x + 100, 276);
      s += boite(x, 280, 200, ["Qmin ≤ Fd ≤ Qmax"], COULEURS.f62, "#fffbeb");
      s += etiqs(284, 218, ["1,15 × 1,1 × 1,1 ≈ 1,4 :", "la même sécurité,", "décomposée"], { taille: 10, gras: false });
      return s;
    },
  });
}

// ─────────────────────────── Chapitre 13 : frottement négatif ──────────────

/** Point neutre : au-dessus, le sol tasse plus que le pieu et le tire vers le bas ; au-dessous, il le porte. */
export function schemaFrottementNegatif({ largeur = 640, hauteur = 330 } = {}) {
  return svg({
    largeur, hauteur, titre: "Frottement négatif et point neutre", contenu: (id) => {
      const yR = 50, yS = 90, yA = 210, yP = 300, xp = 170, B = 24, yN = 178;
      let s = couche(id, { x: 12, y: yR, w: 320, h: yS - yR, sol: "remblai" }) + couche(id, { x: 12, y: yS, w: 320, h: yA - yS, sol: "argile" });
      s += couche(id, { x: 12, y: yA, w: 320, h: hauteur - 8 - yA, sol: "sable" });
      s += ligne(12, yR, 332, yR, COULEURS.trait, 1.8) + ligne(12, yS, 332, yS, COULEURS.trait, 1, 'stroke-dasharray="4 3"');
      s += beton(id, xp - B / 2, yR - 20, B, yP - yR + 20);
      s += fleche(id, xp, 14, xp, yR - 22, { ep: 2.4 }) + etiq(xp + 8, 26, "Q", { taille: 12, couleur: COULEURS.effort });
      for (const y of [70, 110, 150]) s += fleche(id, xp - B / 2 - 8, y - 12, xp - B / 2 - 8, y + 10, { ep: 1.7 }) + fleche(id, xp + B / 2 + 8, y - 12, xp + B / 2 + 8, y + 10, { ep: 1.7 });
      for (const y of [220, 262]) s += fleche(id, xp - B / 2 - 8, y + 12, xp - B / 2 - 8, y - 10, { type: "reaction", ep: 1.7 }) + fleche(id, xp + B / 2 + 8, y + 12, xp + B / 2 + 8, y - 10, { type: "reaction", ep: 1.7 });
      s += ligne(xp - 60, yN, xp + 60, yN, COULEURS.violet, 1.4, 'stroke-dasharray="5 3"') + etiq(xp + 64, yN + 4, "point neutre", { taille: 10.5, couleur: COULEURS.violet });
      s += etiqs(xp + 28, 104, ["frottement", "négatif Fn"], { taille: 10.5, couleur: COULEURS.effort });
      s += etiqs(xp + 28, 236, ["frottement", "positif"], { taille: 10.5, couleur: COULEURS.reaction });
      s += etiq(20, yR + 24, "remblai récent", { taille: 10.5 }) + etiq(20, yS + 24, "argile molle", { taille: 10.5 }) + etiq(20, yA + 24, "sable", { taille: 10.5 });
      // Tassements du sol et du pieu en fonction de la profondeur.
      const x0 = 380, x1 = largeur - 20, zY = (y) => y, X = (t) => x0 + t * (x1 - x0);
      s += ligne(x0, yR, x1, yR, COULEURS.trait, 1.1) + ligne(x0, yR, x0, yP, COULEURS.trait, 1.1);
      const sol = [];
      const L = (yN - yR) / Math.log(0.95 / 0.27);
      for (let y = yR; y <= yP; y += 4) sol.push([X(Math.max(0.03, 0.95 * Math.exp(-(y - yR) / L))), zY(y)]);
      s += chemin(poly(sol), "none", COULEURS.f62, 2.2) + chemin(`M${X(0.27)} ${yR}L${X(0.27)} ${yP}`, "none", COULEURS.betonTrait, 2.2);
      s += ligne(x0, yN, x1, yN, COULEURS.violet, 1.2, 'stroke-dasharray="5 3"');
      s += etiq(x1, yR - 8, "tassement", { ancre: "end", taille: 10.5, gras: false });
      s += etiq(X(0.62), yR + 26, "sol", { taille: 11, couleur: COULEURS.f62 });
      s += etiq(X(0.3), yP - 10, "pieu", { taille: 11, couleur: COULEURS.betonTrait });
      s += etiqs(X(0.42), yN - 34, ["le sol tasse plus", "que le pieu"], { taille: 10, gras: false, couleur: COULEURS.effort });
      s += etiqs(X(0.42), yN + 30, ["le pieu tasse", "plus que le sol"], { taille: 10, gras: false, couleur: COULEURS.reaction });
      return s;
    },
  });
}

/** Groupe de m × n pieux vu en plan : entraxes, bloc monolithique, cylindre d'influence d'un pieu. */
export function schemaGroupePieux({ largeur = 600, hauteur = 300 } = {}) {
  return svg({
    largeur, hauteur, titre: "Groupe de pieux en plan", contenu: (id) => {
      const x0 = 90, y0 = 70, d = 64, dp = 56, m = 3, n = 4, r = 14;
      let s = "";
      s += rect(x0 - r - 10, y0 - r - 10, (n - 1) * d + 2 * r + 20, (m - 1) * dp + 2 * r + 20, "#f1f5f9", COULEURS.trait, 1.3, 'rx="4"');
      s += rect(x0 - r, y0 - r, (n - 1) * d + 2 * r, (m - 1) * dp + 2 * r, "none", COULEURS.rouge, 1.6, 'stroke-dasharray="6 4"');
      const xc = x0 + d, yc = y0 + dp, b = Math.sqrt((d * dp) / Math.PI);
      s += `<circle cx="${xc}" cy="${yc}" r="${r1(b)}" fill="${COULEURS.violet}" opacity=".12" stroke="${COULEURS.violet}" stroke-dasharray="4 3"/>`;
      for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) s += `<circle cx="${x0 + j * d}" cy="${y0 + i * dp}" r="${r}" fill="${COULEURS.beton}" stroke="${COULEURS.betonTrait}" stroke-width="1.3"/>`;
      s += cote(id, x0, y0 + (m - 1) * dp + 40, x0 + d, y0 + (m - 1) * dp + 40, "") + etiq(x0 + d / 2, y0 + (m - 1) * dp + 56, "d", { ancre: "middle", taille: 12, couleur: COULEURS.cote });
      s += cote(id, x0 - 44, y0, x0 - 44, y0 + dp, "") + etiq(x0 - 50, y0 + dp / 2 + 4, "d'", { ancre: "end", taille: 12, couleur: COULEURS.cote });
      s += cote(id, x0 + 2 * d - r, y0 + (m - 1) * dp + 40, x0 + 2 * d + r, y0 + (m - 1) * dp + 40, "") + etiq(x0 + 2 * d + r + 6, y0 + (m - 1) * dp + 44, "B", { taille: 11, couleur: COULEURS.cote });
      s += etiq(x0 + (n - 1) * d / 2, 30, `${m} rangées × ${n} pieux`, { ancre: "middle", taille: 11.5 });
      const xt = 380;
      s += etiqs(xt, 76, ["bloc monolithique :", "base au niveau des pointes,", "frottement sur son périmètre"], { taille: 10.5, couleur: COULEURS.rouge });
      s += etiqs(xt, 140, ["cylindre d'influence", "d'un pieu intérieur :", "b = √(d d'/π)"], { taille: 10.5, couleur: COULEURS.violet });
      s += etiqs(xt, 204, ["Ce ≤ 1 : les pieux rapprochés", "partagent le même sol ;", "Ce = 1 dès que d ≥ 3B (EC7)"], { taille: 10.5, gras: false });
      s += etiq(x0 - r - 10, hauteur - 16, "semelle de liaison", { taille: 10.5, gras: false });
      return s;
    },
  });
}

// ─────────────────────────── Chapitre 14 : effort latéral ──────────────────

/** Pieu sous H et M en tête : réaction du sol, déformée, longueur de transfert, loi de réaction de Ménard. */
export function schemaPieuLateral({ largeur = 640, hauteur = 330 } = {}) {
  return svg({
    largeur, hauteur, titre: "Pieu sous effort transversal", contenu: (id) => {
      const yS = 70, yP = 310, xp = 150, B = 22, l0 = 70;
      let s = couche(id, { x: 12, y: yS, w: 290, h: hauteur - 8 - yS, sol: "limon" }) + ligne(12, yS, 302, yS, COULEURS.trait, 1.8);
      s += `<rect x="${xp - 60}" y="${yS}" width="120" height="${2 * B * 2}" fill="${COULEURS.rouge}" opacity=".1"/>`;
      s += beton(id, xp - B / 2, yS - 30, B, yP - yS + 30);
      const y = (z) => 38 * Math.exp(-z / l0) * Math.cos(z / l0);
      const def = [];
      for (let yy = yS - 30; yy <= yP; yy += 4) def.push([xp + y(Math.max(0, yy - yS + 30)), yy]);
      s += chemin(poly(def), "none", COULEURS.bleu, 2, 'stroke-dasharray="6 3"');
      s += fleche(id, xp - 70, yS - 26, xp - 14, yS - 26, { ep: 2.6 }) + etiq(xp - 74, yS - 30, "H", { ancre: "end", taille: 13, couleur: COULEURS.effort });
      s += chemin(`M${xp - 22} ${yS - 50}A26 26 0 0 1 ${xp + 24} ${yS - 44}`, "none", COULEURS.effort, 2, `marker-end="url(#${id}-fl)"`) + etiq(xp + 30, yS - 44, "M", { taille: 13, couleur: COULEURS.effort });
      for (const yy of [96, 130, 164, 198]) {
        const long = 30 * Math.exp(-(yy - yS) / l0) + 6;
        s += fleche(id, xp + B / 2 + 4 + long, yy, xp + B / 2 + 4, yy, { type: "reaction", ep: 1.6 });
      }
      s += cote(id, xp - 40, yS, xp - 40, yS + 3 * l0, "") + etiq(xp - 46, yS + 1.5 * l0 + 4, "≈ 3 l0", { ancre: "end", taille: 11, couleur: COULEURS.cote });
      s += etiqs(xp + 40, yS + 16, ["zc = 2B à 4B :", "réaction minorée"], { taille: 10, couleur: COULEURS.rouge });
      s += etiqs(xp + 40, yS + 104, ["réaction r = Kf · y"], { taille: 10.5, couleur: COULEURS.reaction });
      s += etiqs(xp + 24, yP - 26, ["pointe immobile", "si L > 3 l0"], { taille: 10, gras: false });
      s += etiq(20, hauteur - 12, "l0 = (4 EI / Kf)^1/4", { taille: 11, couleur: COULEURS.bleu });
      // Loi de réaction.
      const gx0 = 350, gx1 = largeur - 24, gy0 = 60, gy1 = 230;
      s += ligne(gx0, gy1, gx1, gy1, COULEURS.trait, 1.2) + ligne(gx0, gy0, gx0, gy1, COULEURS.trait, 1.2);
      const r1c = gy1 - 110;
      s += chemin(`M${gx0} ${gy1}L${gx0 + 70} ${r1c}H${gx1 - 10}`, "none", COULEURS.reaction, 2.4);
      s += chemin(`M${gx0} ${gy1}L${gx0 + 140} ${r1c}H${gx1 - 10}`, "none", COULEURS.reaction, 1.6, 'stroke-dasharray="5 3"');
      s += etiq(gx0 + 26, gy1 - 60, "Kf", { taille: 12, couleur: COULEURS.reaction });
      s += etiq(gx0 + 124, gy1 - 50, "Kf/2 : longue durée", { taille: 10.5, gras: false, couleur: COULEURS.reaction });
      s += etiq(gx1 - 10, r1c - 8, "palier r1 = B · pf*", { ancre: "end", taille: 11, couleur: COULEURS.reaction });
      s += etiq(gx1, gy1 + 18, "déplacement y", { ancre: "end", taille: 10.5, gras: false });
      s += etiq(gx0 + 4, gy0 - 8, "réaction r (kN/m)", { taille: 10.5, gras: false });
      s += etiqs(gx0, gy1 + 50, ["Kf de Ménard, tiré de EM et α ;", "doublé pour les sollicitations brèves"], { taille: 10.5, gras: false });
      return s;
    },
  });
}

// ─────────────────────────── Chapitre 15 : séisme ───────────────────────────

/** Semelle sous séisme : forces d'inertie de la structure (N, V, M) et du sol ; les trois vérifications. */
export function schemaSeisme({ largeur = 640, hauteur = 300 } = {}) {
  return svg({
    largeur, hauteur, titre: "Semelle sous séisme", contenu: (id) => {
      const yS = 150, xm = 190;
      let s = couche(id, { x: 12, y: yS, w: 370, h: hauteur - 8 - yS, sol: "sable" }) + ligne(12, yS, 382, yS, COULEURS.trait, 1.8);
      // Structure schématique qui oscille.
      s += rect(xm - 60, 30, 120, 90, "#f8fafc", COULEURS.trait, 1.2) + rect(xm - 60, 30, 120, 90, "none", COULEURS.trait, 0.8, 'transform="skewX(-6)" opacity=".35"');
      s += beton(id, xm - 70, yS - 14, 140, 14) + beton(id, xm - 12, 120, 24, yS - 14 - 120);
      s += fleche(id, xm + 84, 64, xm + 144, 64, { ep: 2.4 }) + etiqs(xm + 84, 86, ["inertie de", "la structure"], { taille: 10.5, couleur: COULEURS.effort });
      s += fleche(id, xm - 30, yS - 40, xm - 30, yS - 16, { ep: 2.2 }) + etiq(xm - 36, yS - 30, "N", { ancre: "end", taille: 12, couleur: COULEURS.effort });
      s += fleche(id, xm + 80, yS - 6, xm + 40, yS - 6, { ep: 2.2 }) + etiq(xm + 84, yS - 2, "V", { taille: 12, couleur: COULEURS.effort });
      s += chemin(`M${xm + 18} ${yS - 44}A22 22 0 0 1 ${xm + 40} ${yS - 22}`, "none", COULEURS.effort, 2, `marker-end="url(#${id}-fl)"`) + etiq(xm + 44, yS - 34, "M", { taille: 12, couleur: COULEURS.effort });
      // Inertie du sol dans la zone de rupture.
      s += chemin(`M${xm - 70} ${yS}Q${xm} ${yS + 110} ${xm + 150} ${yS + 36}L${xm + 200} ${yS}`, "none", COULEURS.rouge, 1.4, 'stroke-dasharray="5 3"');
      for (const [x, y] of [[xm - 20, yS + 40], [xm + 40, yS + 50], [xm + 100, yS + 34], [xm + 20, yS + 80]]) s += fleche(id, x - 18, y, x + 18, y, { type: "bleu", ep: 1.6 });
      s += etiqs(22, yS + 106, ["le sol aussi est secoué :", "son inertie F̄ réduit la portance"], { taille: 10.5, couleur: COULEURS.bleu });
      s += etiq(xm, 22, "G + AEd + ψ2 Q", { ancre: "middle", taille: 11 });
      // Trois vérifications.
      const xt = 410;
      s += etiq(xt, 40, "trois vérifications (EN 1998-5)", { taille: 11.5 });
      s += etiqs(xt, 66, ["1. portance et excentrement :", "(N̄, V̄, M̄) dans la surface limite"], { taille: 10.5 });
      s += etiqs(xt, 112, ["2. glissement : NEd tanδ / γM", "et butée frontale sous conditions"], { taille: 10.5 });
      s += etiqs(xt, 158, ["3. pertes de résistance cycliques :", "liquéfaction des sables saturés,", "argiles sensibles"], { taille: 10.5 });
      s += etiqs(xt, 222, ["N̄ = γRd NEd / Nmax", "M̄ = γRd MEd / (B Nmax)"], { taille: 10.5, gras: false });
      return s;
    },
  });
}

// ─────────────────── Chapitre 16 : sols compressibles et remblais ─────────────

/** Ressort vertical en zigzag entre y0 et y1, centré en x. */
const ressort = (x, y0, y1, n = 7, a = 9) => {
  const h = (y1 - y0) / n;
  let d = `M${r1(x)} ${r1(y0)}`;
  for (let i = 0; i < n; i++) d += `L${r1(x + (i % 2 ? -a : a))} ${r1(y0 + (i + 0.5) * h)}`;
  return `${d}L${r1(x)} ${r1(y1)}`;
};

/** L'analogie de Terzaghi : piston, ressort (le squelette), eau et orifice (la perméabilité), à trois instants. */
export function schemaAnalogieTerzaghi({ largeur = 640, hauteur = 300 } = {}) {
  return svg({
    largeur, hauteur, titre: "Analogie de Terzaghi : l'eau cède peu à peu la charge au squelette", contenu: (id) => {
      const etats = [
        { t: "t = 0", sous: "l'eau porte toute la charge", u: 1, yP: 92, fuite: false },
        { t: "0 < t < ∞", sous: "l'eau s'échappe par l'orifice", u: 0.45, yP: 104, fuite: true },
        { t: "t → ∞", sous: "le ressort porte tout", u: 0, yP: 116, fuite: false },
      ];
      const w = 196, yF = 206;
      let s = "";
      etats.forEach((e, i) => {
        const x0 = 16 + i * (w + 14), xc = x0 + w / 2, xg = xc - 44, xd = xc + 44;
        s += etiq(xc, 20, e.t, { ancre: "middle", taille: 12.5 });
        s += etiq(xc, 36, e.sous, { ancre: "middle", taille: 10.5, gras: false });
        s += rect(xg, e.yP + 10, 88, yF - e.yP - 10, COULEURS.eauFond, "none", 0);
        s += chemin(`M${xg} 60L${xg} ${yF}L${xd} ${yF}L${xd} 60`, "none", COULEURS.trait, 2);
        s += chemin(ressort(xc - 14, e.yP + 10, yF, 7, 9), "none", COULEURS.f62, 1.8);
        s += rect(xg + 1, e.yP, 86, 10, COULEURS.beton, COULEURS.betonTrait, 1.2);
        s += rect(xc + 20, e.yP, 6, 10, e.fuite ? COULEURS.eauFond : "#fff", COULEURS.betonTrait, 0.8);
        if (e.fuite) s += fleche(id, xc + 23, e.yP - 2, xc + 23, e.yP - 22, { type: "bleu", ep: 1.8 });
        s += fleche(id, xc - 14, 46, xc - 14, e.yP - 2, { ep: 2.4 });
        s += etiq(xc - 22, 62, "Δσ", { ancre: "end", taille: 11.5, couleur: COULEURS.effort });
        // Parts de la charge portées par l'eau et par le squelette.
        const lb = 100, xb = x0 + 44;
        s += etiq(x0 + 36, yF + 26, "u", { ancre: "end", taille: 11.5, couleur: EAU });
        s += rect(xb, yF + 16, lb, 12, "#f1f5f9", COULEURS.grille, 0.8) + (e.u > 0 ? rect(xb, yF + 16, lb * e.u, 12, EAU, "none", 0) : "");
        s += etiq(xb + lb + 6, yF + 26, `${Math.round(e.u * 100)} %`, { taille: 10.5, gras: false });
        s += etiq(x0 + 36, yF + 48, "σ'", { ancre: "end", taille: 11.5, couleur: COULEURS.f62 });
        s += rect(xb, yF + 38, lb, 12, "#f1f5f9", COULEURS.grille, 0.8) + (e.u < 1 ? rect(xb, yF + 38, lb * (1 - e.u), 12, COULEURS.f62, "none", 0) : "");
        s += etiq(xb + lb + 6, yF + 48, `${Math.round((1 - e.u) * 100)} %`, { taille: 10.5, gras: false });
      });
      s += etiq(largeur / 2, hauteur - 12, "ressort : squelette du sol · eau : eau interstitielle · orifice : perméabilité", { ancre: "middle", taille: 10.5, gras: false });
      return s;
    },
  });
}

/** Les trois composantes du tassement d'un sol fin saturé en fonction du logarithme du temps. */
export function schemaComposantesTassement({ largeur = 640, hauteur = 290 } = {}) {
  return svg({
    largeur, hauteur, titre: "Tassement immédiat, de consolidation et de fluage", contenu: () => {
      const xg = 84, xd = largeur - 24, yH = 44, yB = 244;
      const X = (lg) => xg + ((lg + 3) / 5) * (xd - xg);
      const si = 18, sc = 112, pente = 24;
      const Y = (lg) => yH + si + sc * degreConsolidation(1.97 * 10 ** lg) + pente * Math.max(0, lg);
      let s = "";
      s += ligne(xg, yH, xd, yH, COULEURS.trait, 1.3) + ligne(xg, yH, xg, yB, COULEURS.trait, 1.3);
      s += etiq(xd, yH - 10, "temps (échelle logarithmique)", { ancre: "end", taille: 10.5, gras: false });
      s += `<text transform="translate(${xg - 62} ${(yH + yB) / 2}) rotate(-90)" text-anchor="middle" style="font-size:10.5px">tassement</text>`;
      s += ligne(xg, yH + si, xd, yH + si, COULEURS.grille, 1, 'stroke-dasharray="4 3"');
      s += ligne(xg, yH + si + sc, xd, yH + si + sc, COULEURS.grille, 1, 'stroke-dasharray="4 3"');
      s += etiq(xg - 6, yH + si + 4, "si", { ancre: "end", taille: 11, couleur: COULEURS.violet });
      s += etiq(xg - 6, yH + si + sc + 4, "si + sc", { ancre: "end", taille: 11, couleur: COULEURS.bleu });
      s += ligne(X(0), yH, X(0), yB, COULEURS.discret, 1, 'stroke-dasharray="3 3"');
      s += etiq(X(0), yB + 16, "tp : fin de la consolidation primaire", { ancre: "middle", taille: 10.5, couleur: COULEURS.discret });
      const prim = [[xg, yH + si]], flu = [];
      for (let lg = -3; lg <= 0.0001; lg += 0.05) prim.push([X(lg), Y(lg)]);
      for (let lg = 0; lg <= 2.0001; lg += 0.05) flu.push([X(lg), Y(lg)]);
      s += chemin(poly([[xg, yH], [xg, yH + si]]), "none", COULEURS.violet, 3);
      s += chemin(poly(prim), "none", COULEURS.bleu, 2.6) + chemin(poly(flu), "none", COULEURS.f62, 2.6);
      s += etiq(X(0.35), 172, "fluage : pente Cαe par décade", { taille: 10.5, couleur: COULEURS.f62 });
      const legende = [
        [COULEURS.violet, "si : immédiat, à volume constant (non drainé)"],
        [COULEURS.bleu, "sc : consolidation primaire, l'eau s'évacue"],
        [COULEURS.f62, "sf : fluage, le squelette flue à σ' constant"],
      ];
      legende.forEach(([c, t], k) => { s += ligne(xg + 14, 196 + 18 * k, xg + 34, 196 + 18 * k, c, 3) + etiq(xg + 40, 200 + 18 * k, t, { taille: 10.5, gras: false }); });
      return s;
    },
  });
}

/** Drainage double et drainage simple : longueur de drainage et isochrones de surpression aux mêmes instants. */
export function schemaDrainage({ largeur = 640, hauteur = 316 } = {}) {
  return svg({
    largeur, hauteur, titre: "Drainage double et drainage simple", contenu: (id) => {
      const yS = 44, yA = 62, yB = 222, yF = 240, H = yB - yA, w = 296;
      const teintes = [COULEURS.bleu, COULEURS.violet, COULEURS.f62];
      let s = "";
      const panneau = (x0, double) => {
        s += couche(id, { x: x0, y: yS, w, h: yA - yS, sol: "sable" });
        s += couche(id, { x: x0, y: yA, w, h: H, sol: "argile" });
        s += couche(id, { x: x0, y: yB, w, h: yF - yB, sol: double ? "sable" : "marne" });
        s += ligne(x0, yA, x0 + w, yA, COULEURS.trait, 1) + ligne(x0, yB, x0 + w, yB, COULEURS.trait, 1);
        s += etiq(x0 + w / 2, 22, double ? "Drainage double : Hd = H/2" : "Drainage simple : Hd = H", { ancre: "middle", taille: 12 });
        s += etiq(x0 + w - 6, yS + 13, "sable drainant", { ancre: "end", taille: 10, gras: false });
        s += etiq(x0 + w - 6, yB + 13, double ? "sable drainant" : "substratum imperméable", { ancre: "end", taille: 10, gras: false });
        s += cote(id, x0 + 14, yA, x0 + 14, yB, "") + etiq(x0 + 20, yA + H / 2 + 4, "H", { taille: 11.5, couleur: COULEURS.cote });
        const yHd = double ? yA + H / 2 : yB;
        s += cote(id, x0 + 44, yA, x0 + 44, yHd, "") + etiq(x0 + 50, (yA + yHd) / 2 + 4, "Hd", { taille: 11.5, couleur: COULEURS.cote });
        s += fleche(id, x0 + 90, yA + 42, x0 + 90, yA + 6, { type: "bleu", ep: 2 });
        if (double) s += fleche(id, x0 + 90, yB - 42, x0 + 90, yB - 6, { type: "bleu", ep: 2 });
        // Isochrones aux mêmes instants : Tv quatre fois plus grand quand Hd est deux fois plus court.
        const xu = x0 + 122, lu = 150;
        s += ligne(xu, yA, xu, yB, COULEURS.trait, 0.9) + ligne(xu + lu, yA, xu + lu, yB, EAU, 1.1, 'stroke-dasharray="4 3"');
        s += etiq(xu, yA + H + 32, "u = 0", { ancre: "middle", taille: 10, gras: false });
        s += etiq(xu + lu, yA + H + 32, "u0", { ancre: "middle", taille: 10.5, couleur: EAU });
        [0.02, 0.08, 0.3].forEach((Tv1, k) => {
          const Tv = double ? 4 * Tv1 : Tv1, pts = [];
          for (let i = 0; i <= 80; i++) { const f = i / 80; pts.push([xu + lu * surpressionRelative(Tv, double ? 2 * f : f), yA + f * H]); }
          s += chemin(poly(pts), "none", teintes[k], 2);
        });
      };
      panneau(12, true);
      panneau(largeur - 12 - w, false);
      const yl = hauteur - 30;
      ["t1", "t2", "t3"].forEach((t, k) => { s += ligne(150 + 64 * k, yl - 4, 172 + 64 * k, yl - 4, teintes[k], 3) + etiq(178 + 64 * k, yl, t, { taille: 11, couleur: teintes[k] }); });
      s += etiq(348, yl, "isochrones de u aux mêmes instants", { taille: 10.5, gras: false });
      s += etiq(largeur / 2, hauteur - 10, "Hd deux fois plus long : quatre fois plus de temps pour le même degré de consolidation", { ancre: "middle", taille: 10.5, gras: false });
      return s;
    },
  });
}

/** Dépouillement d'un palier œdométrique : constructions de Casagrande (lg t) et de Taylor (√t). */
export function schemaCasagrandeTaylor({ largeur = 640, hauteur = 312 } = {}) {
  return svg({
    largeur, hauteur, titre: "Coefficient de consolidation : constructions de Casagrande et de Taylor", contenu: () => {
      const yH = 46, yB = 254;
      let s = "";
      // Casagrande : tassement du palier en fonction de lg t (t de 0,1 à 1000 min).
      {
        const xg = 44, xd = 300, lg0 = -1, lg1 = 3, d0 = yH + 26, d100 = yB - 64, Ca = 13, lgp = Math.log10(30 * 1.13);
        const X = (lg) => xg + ((lg - lg0) / (lg1 - lg0)) * (xd - xg);
        const Y = (lg) => d0 + (d100 - d0) * degreConsolidation(10 ** lg / 30) + Ca * Math.max(0, lg - lgp);
        s += ligne(xg, yH, xd, yH, COULEURS.trait, 1.2) + ligne(xg, yH, xg, yB, COULEURS.trait, 1.2);
        s += etiq((xg + xd) / 2, 22, "Casagrande : tassement – lg t", { ancre: "middle", taille: 12 });
        s += etiq(xd, yH - 8, "lg t", { ancre: "end", taille: 10.5, gras: false });
        const pts = [];
        for (let lg = lg0; lg <= lg1 + 1e-9; lg += 0.02) pts.push([X(lg), Y(lg)]);
        s += chemin(poly(pts), "none", COULEURS.encre, 2.2);
        // Tangente au point d'inflexion et droite de fluage : leur intersection donne d100.
        let lgI = lg0, m = 0;
        for (let lg = lg0; lg <= lg1; lg += 0.01) { const p = (Y(lg + 0.005) - Y(lg - 0.005)) / 0.01; if (p > m) { m = p; lgI = lg; } }
        const YI = Y(lgI), Yf = Y(lg1);
        const lgX = (Yf - Ca * lg1 - YI + m * lgI) / (m - Ca), dC100 = YI + m * (lgX - lgI);
        s += ligne(X(lgI - 0.55), YI - 0.55 * m, X(lgX + 0.3), YI + (lgX + 0.3 - lgI) * m, COULEURS.violet, 1.1, 'stroke-dasharray="5 3"');
        s += ligne(X(lgX - 0.6), Yf - Ca * (lg1 - lgX + 0.6), X(lg1), Yf, COULEURS.violet, 1.1, 'stroke-dasharray="5 3"');
        // d0 : la parabole du début ; entre t1 et 4 t1, le tassement double.
        const l1 = -0.5, l4 = l1 + Math.log10(4), dC0 = Y(l1) - (Y(l4) - Y(l1));
        s += ligne(xg, dC0, X(l4), dC0, COULEURS.bleu, 1, 'stroke-dasharray="4 3"');
        s += ligne(X(l1), dC0, X(l1), Y(l1), COULEURS.bleu, 1.4) + ligne(X(l4), Y(l1), X(l4), Y(l4), COULEURS.bleu, 1.4);
        s += ligne(X(l1), Y(l1), X(l4), Y(l1), COULEURS.bleu, 0.8, 'stroke-dasharray="2 2"');
        s += ligne(X(l1), yB, X(l1), Y(l1), COULEURS.grille, 1) + ligne(X(l4), yB, X(l4), Y(l4), COULEURS.grille, 1);
        s += ligne(xg, dC100, X(lgX), dC100, COULEURS.violet, 1, 'stroke-dasharray="4 3"');
        const dC50 = (dC0 + dC100) / 2;
        let a = lg0, b = lg1;
        for (let k = 0; k < 60; k++) { const mi = (a + b) / 2; if (Y(mi) < dC50) a = mi; else b = mi; }
        s += ligne(xg, dC50, X(a), dC50, COULEURS.effort, 1.1, 'stroke-dasharray="4 3"') + ligne(X(a), dC50, X(a), yB, COULEURS.effort, 1.1, 'stroke-dasharray="4 3"');
        s += `<circle cx="${r1(X(a))}" cy="${r1(dC50)}" r="3.2" fill="${COULEURS.effort}"/><circle cx="${r1(X(lgX))}" cy="${r1(dC100)}" r="3.2" fill="${COULEURS.violet}"/>`;
        s += etiq(xg - 5, dC0 + 4, "d0", { ancre: "end", taille: 10.5, couleur: COULEURS.bleu });
        s += etiq(xg - 5, dC50 + 4, "d50", { ancre: "end", taille: 10.5, couleur: COULEURS.effort });
        s += etiq(xg - 5, dC100 + 4, "d100", { ancre: "end", taille: 10.5, couleur: COULEURS.violet });
        s += etiq(X(l1), yB + 15, "t1", { ancre: "middle", taille: 10.5, gras: false });
        s += etiq(X(l4), yB + 15, "4 t1", { ancre: "middle", taille: 10.5, gras: false });
        s += etiq(X(a), yB + 15, "t50", { ancre: "middle", taille: 10.5, couleur: COULEURS.effort });
        s += etiq(X(1.9), dC100 - 8, "fluage", { ancre: "middle", taille: 10, gras: false, couleur: COULEURS.violet });
        s += etiq((xg + xd) / 2, hauteur - 12, "cv = 0,197 Hd² / t50", { ancre: "middle", taille: 11.5 });
      }
      // Taylor : tassement en fonction de √t ; la droite aux abscisses × 1,15 coupe la courbe à U = 90 %.
      {
        const xg = 366, xd = largeur - 20, d0 = yH + 26, d100 = yB - 40, rmax = 1.15;
        const X = (r) => xg + (r / rmax) * (xd - xg), Y = (r) => d0 + (d100 - d0) * degreConsolidation(r * r);
        s += ligne(xg, yH, xd, yH, COULEURS.trait, 1.2) + ligne(xg, yH, xg, yB, COULEURS.trait, 1.2);
        s += etiq((xg + xd) / 2, 22, "Taylor : tassement – √t", { ancre: "middle", taille: 12 });
        s += etiq(xd, yH - 8, "√t", { ancre: "end", taille: 10.5, gras: false });
        const pts = [];
        for (let r = 0; r <= rmax + 1e-9; r += 0.01) pts.push([X(r), Y(r)]);
        s += chemin(poly(pts), "none", COULEURS.encre, 2.2);
        const k1 = (d100 - d0) * (2 / Math.sqrt(Math.PI)), rF = (d100 - d0 + 22) / k1, r2 = 0.921 * 1.08;
        s += ligne(X(0), d0, X(rF), d0 + k1 * rF, COULEURS.bleu, 1.2, 'stroke-dasharray="5 3"');
        s += ligne(X(0), d0, X(r2), d0 + (k1 / 1.15) * r2, COULEURS.violet, 1.2, 'stroke-dasharray="5 3"');
        const r90 = Math.sqrt(0.848), y90 = Y(r90);
        s += ligne(X(r90), y90, X(r90), yB, COULEURS.effort, 1.1, 'stroke-dasharray="4 3"');
        s += `<circle cx="${r1(X(r90))}" cy="${r1(y90)}" r="3.2" fill="${COULEURS.effort}"/>`;
        // Même ordonnée : abscisse a sur la première droite, 1,15 a sur la seconde.
        const yc = d0 + 0.42 * (d100 - d0), ra = (yc - d0) / k1;
        s += ligne(X(0), yc, X(ra * 1.15), yc, COULEURS.cote, 0.8, 'stroke-dasharray="2 2"');
        s += `<circle cx="${r1(X(ra))}" cy="${r1(yc)}" r="2.6" fill="${COULEURS.bleu}"/><circle cx="${r1(X(ra * 1.15))}" cy="${r1(yc)}" r="2.6" fill="${COULEURS.violet}"/>`;
        s += etiq(X(ra) - 4, yc - 6, "a", { ancre: "end", taille: 11, couleur: COULEURS.bleu });
        s += etiq(X(ra * 1.15) + 5, yc + 14, "1,15 a", { taille: 11, couleur: COULEURS.violet });
        s += etiq(xg - 5, d0 + 4, "d0", { ancre: "end", taille: 10.5, couleur: COULEURS.bleu });
        s += etiq(X(r90), yB + 15, "√t90", { ancre: "middle", taille: 10.5, couleur: COULEURS.effort });
        s += etiq(X(r90) + 8, y90 - 8, "U = 90 %", { taille: 10.5, couleur: COULEURS.effort });
        s += etiq((xg + xd) / 2, hauteur - 12, "cv = 0,848 Hd² / t90", { ancre: "middle", taille: 11.5 });
      }
      return s;
    },
  });
}

/** Un remblai sur sol mou : cuvette de tassement, soulèvement au pied, déplacements, et les appareils de suivi. */
export function schemaRemblaiInstrumente({ largeur = 640, hauteur = 330 } = {}) {
  return svg({
    largeur, hauteur, titre: "Remblai sur sol compressible instrumenté", contenu: (id) => {
      const yT = 156, yC = 76, yA = 266, xgp = 122, xgc = 242, xdc = 402, xdp = 522;
      let s = "";
      s += couche(id, { x: 12, y: yT, w: largeur - 24, h: yA - yT, sol: "argile" });
      s += couche(id, { x: 12, y: yA, w: largeur - 24, h: hauteur - 8 - yA, sol: "sable" });
      s += zoneSol(id, [[xgp, yT], [xgc, yC], [xdc, yC], [xdp, yT]], "remblai");
      s += chemin(poly([[xgp, yT], [xgc, yC], [xdc, yC], [xdp, yT]]), "none", COULEURS.trait, 1.6);
      // Couche drainante à la base du remblai.
      s += zoneSol(id, [[xgp + 9, yT - 6], [xdp - 9, yT - 6], [xdp, yT], [xgp, yT]], "sable");
      s += ligne(12, yT, largeur - 12, yT, COULEURS.trait, 1.4) + ligne(12, yA, largeur - 12, yA, COULEURS.trait, 1);
      // Cuvette de tassement et bourrelet au pied.
      const cuvette = [];
      for (let x = xgp; x <= xdp; x += 6) cuvette.push([x, yT + 16 * Math.sin((Math.PI * (x - xgp)) / (xdp - xgp)) ** 2]);
      s += chemin(poly(cuvette), "none", COULEURS.effort, 1.6, 'stroke-dasharray="6 3"');
      s += chemin(`M${xgp - 42} ${yT}Q${xgp - 22} ${yT - 9} ${xgp - 2} ${yT}`, "none", COULEURS.effort, 1.6, 'stroke-dasharray="6 3"');
      s += fleche(id, 456, 206, 492, 206, { ep: 1.8 }) + fleche(id, 188, 206, 152, 206, { ep: 1.8 });
      // Nappe à fleur du terrain naturel, en champ libre.
      s += ligne(12, yT + 6, xgp - 44, yT + 6, EAU, 1.2, 'stroke-dasharray="6 4"') + `<path d="M${xgp - 56} ${yT + 5}l6-9h-12z" fill="${EAU}"/>`;
      // Tassomètre : plaque au terrain naturel, tige jusqu'au-dessus de la crête.
      s += rect(352, yT - 4, 24, 4, "#475569", "none", 0) + ligne(364, yT - 4, 364, 58, "#475569", 2);
      // Piézomètre dans l'argile, sous le remblai.
      s += `<circle cx="282" cy="214" r="4.5" fill="#fff" stroke="${EAU}" stroke-width="2"/>` + ligne(282, 210, 282, yT, EAU, 1.2, 'stroke-dasharray="3 2"');
      // Inclinomètre au pied, ancré dans le sable ; tubage déformé par le sol qui s'échappe.
      s += ligne(570, yT - 12, 570, 304, "#475569", 2.4);
      s += chemin(`M570 ${yT - 12}L570 ${yT + 6}Q598 214 570 ${yA}L570 304`, "none", COULEURS.effort, 1.6, 'stroke-dasharray="5 3"');
      // Libellés.
      s += etiq(322, 124, "remblai", { ancre: "middle", taille: 11.5 });
      s += etiq(372, 56, "tassomètre", { taille: 10.5 });
      s += etiq(292, 218, "piézomètre", { taille: 10.5, couleur: EAU });
      s += etiqs(578, 124, ["inclino-", "mètre"], { taille: 10.5 });
      s += etiq(18, 108, "couche drainante", { taille: 10.5 }) + ligne(106, 112, 150, 148, COULEURS.trait, 0.8);
      s += etiq(18, 140, "soulèvement au pied", { taille: 10.5, couleur: COULEURS.effort });
      s += etiq(18, 180, "nappe", { taille: 10.5, couleur: EAU });
      s += etiq(322, 194, "cuvette de tassement", { ancre: "middle", taille: 10.5, couleur: COULEURS.effort });
      s += etiq(474, 226, "déplacements latéraux", { ancre: "middle", taille: 10.5, couleur: COULEURS.effort });
      s += etiq(18, yA - 10, "argile molle", { taille: 10.5 }) + etiq(18, yA + 24, "sable", { taille: 10.5 });
      return s;
    },
  });
}

/** Drains verticaux : maillages triangulaire et carré, cylindre d'influence, zone remaniée, écoulement radial. */
export function schemaDrainsVerticaux({ largeur = 640, hauteur = 300 } = {}) {
  return svg({
    largeur, hauteur, titre: "Drains verticaux : maillages et cylindre d'influence", contenu: (id) => {
      const esp = 44, rp = 3.4;
      let s = "";
      const drain = (x, y) => `<circle cx="${r1(x)}" cy="${r1(y)}" r="${rp}" fill="${COULEURS.encre}"/>`;
      // Maille triangulaire.
      const xt = 34, yt = 66, dy = (esp * Math.sqrt(3)) / 2;
      const xc = xt + esp + esp / 2, yc = yt + dy, R = esp / Math.sqrt(3);
      s += chemin(`${poly([0, 1, 2, 3, 4, 5].map((k) => [xc + R * Math.cos(Math.PI / 6 + (k * Math.PI) / 3), yc + R * Math.sin(Math.PI / 6 + (k * Math.PI) / 3)]))}Z`, "#e0f2fe", COULEURS.bleu, 1.1, 'stroke-dasharray="4 2"');
      s += `<circle cx="${r1(xc)}" cy="${r1(yc)}" r="${r1(0.525 * esp)}" fill="none" stroke="${COULEURS.violet}" stroke-width="1.4"/>`;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) s += drain(xt + j * esp + (i % 2) * (esp / 2), yt + i * dy);
      s += cote(id, xt, yt - 16, xt + esp, yt - 16, "") + etiq(xt + esp / 2, yt - 22, "s", { ancre: "middle", taille: 11.5, couleur: COULEURS.cote });
      s += etiq(110, 22, "Maille triangulaire", { ancre: "middle", taille: 12 });
      s += etiq(110, 222, "De = 1,05 s", { ancre: "middle", taille: 11.5, couleur: COULEURS.violet });
      // Maille carrée.
      const xq = 238, yq = 66, xcq = xq + esp, ycq = yq + esp;
      s += rect(xcq - esp / 2, ycq - esp / 2, esp, esp, "#e0f2fe", COULEURS.bleu, 1.1, 'stroke-dasharray="4 2"');
      s += `<circle cx="${r1(xcq)}" cy="${r1(ycq)}" r="${r1(0.564 * esp)}" fill="none" stroke="${COULEURS.violet}" stroke-width="1.4"/>`;
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) s += drain(xq + j * esp, yq + i * esp);
      s += cote(id, xq, yq - 16, xq + esp, yq - 16, "") + etiq(xq + esp / 2, yq - 22, "s", { ancre: "middle", taille: 11.5, couleur: COULEURS.cote });
      s += etiq(xq + esp, 22, "Maille carrée", { ancre: "middle", taille: 12 });
      s += etiq(xq + esp, 222, "De = 1,13 s", { ancre: "middle", taille: 11.5, couleur: COULEURS.violet });
      // Une cellule en coupe : drain, zone remaniée, écoulement radial vers le drain.
      const x0 = 400, x1 = largeur - 16, xm = (x0 + x1) / 2, yH = 58, yB = 236;
      s += etiq(xm, 22, "Une cellule en coupe", { ancre: "middle", taille: 12 });
      s += couche(id, { x: x0, y: 42, w: x1 - x0, h: yH - 42, sol: "sable" });
      s += couche(id, { x: x0, y: yH, w: x1 - x0, h: yB - yH, sol: "argile" });
      s += rect(xm - 20, yH, 40, yB - yH, "#cbd5e1", "none", 0, 'opacity=".55"');
      s += ligne(xm - 20, yH, xm - 20, yB, COULEURS.discret, 0.9, 'stroke-dasharray="3 2"') + ligne(xm + 20, yH, xm + 20, yB, COULEURS.discret, 0.9, 'stroke-dasharray="3 2"');
      s += rect(xm - 3, yH, 6, yB - yH, "#1e293b", "none", 0);
      s += ligne(x0, yH, x1, yH, COULEURS.trait, 1) + ligne(x0, yH, x0, yB, COULEURS.trait, 1, 'stroke-dasharray="5 3"') + ligne(x1, yH, x1, yB, COULEURS.trait, 1, 'stroke-dasharray="5 3"');
      for (const y of [150, 200]) s += fleche(id, x0 + 14, y, xm - 26, y, { type: "bleu", ep: 1.8 }) + fleche(id, x1 - 14, y, xm + 26, y, { type: "bleu", ep: 1.8 });
      s += fleche(id, xm, 110, xm, yH - 4, { type: "bleu", ep: 1.8 });
      s += etiq(x0 + 8, 54, "tapis drainant", { taille: 10, gras: false });
      s += etiq(xm + 26, 82, "drain dw", { taille: 10.5 });
      s += etiq(xm + 26, 100, "zone remaniée ds", { taille: 10.5, couleur: COULEURS.discret });
      s += etiq(x0 + 8, 138, "écoulement radial", { taille: 10.5, couleur: COULEURS.bleu });
      s += etiq(x0 + 8, yB - 8, "argile", { taille: 10.5, gras: false });
      s += cote(id, x0, yB + 14, x1, yB + 14, "") + etiq(xm, yB + 30, "De", { ancre: "middle", taille: 11.5, couleur: COULEURS.cote });
      s += etiq(largeur / 2, hauteur - 10, "chaque drain draine le cylindre de sol de même aire que sa maille", { ancre: "middle", taille: 10.5, gras: false });
      return s;
    },
  });
}

/** Préchargement avec surcharge temporaire : charges et tassements en fonction du temps. */
export function schemaSurcharge({ largeur = 640, hauteur = 318 } = {}) {
  return svg({
    largeur, hauteur, titre: "Préchargement et surcharge temporaire", contenu: () => {
      const xg = 76, xd = largeur - 24, X = (f) => xg + f * (xd - xg);
      const yq0 = 126, yqf = 92, yqs = 54, ys0 = 160, ysf = 252, k = 1.6;
      const ts = facteurTemps(1 / k) / 1.2;
      let s = "";
      s += ligne(xg, 36, xg, yq0, COULEURS.trait, 1.2) + ligne(xg, yq0, xd, yq0, COULEURS.trait, 1.2);
      s += ligne(xg, ys0, xg, ysf + 18, COULEURS.trait, 1.2) + ligne(xg, ys0, xd, ys0, COULEURS.trait, 1.2);
      s += etiq(xg - 8, 46, "charge", { ancre: "end", taille: 10.5, gras: false });
      s += etiq(xg - 8, ys0 + 16, "tassement", { ancre: "end", taille: 10.5, gras: false });
      s += etiq(xd, yq0 + 16, "temps", { ancre: "end", taille: 10.5, gras: false });
      s += chemin(poly([[X(0), yq0], [X(0.02), yqf], [X(1), yqf]]), "none", COULEURS.discret, 2, 'stroke-dasharray="6 4"');
      s += chemin(poly([[X(0), yq0], [X(0.03), yqs], [X(ts), yqs], [X(ts), yqf], [X(1), yqf]]), "none", COULEURS.effort, 2.2);
      s += etiq(X(0.05), yqs - 8, "qf + qs", { taille: 10.5, couleur: COULEURS.effort });
      s += etiq(X(0.05), yqs + 18, "surcharge qs", { taille: 10.5, gras: false, couleur: COULEURS.effort });
      s += etiq(X(0.62), yqf - 8, "qf : l'ouvrage seul", { taille: 10.5, couleur: COULEURS.discret });
      s += ligne(X(ts), 36, X(ts), ysf + 18, COULEURS.violet, 1, 'stroke-dasharray="3 3"');
      s += etiq(X(ts) + 6, 40, "ts : on retire la surcharge", { taille: 10.5, couleur: COULEURS.violet });
      const sans = [], avec = [];
      for (let f = 0; f <= 1.0001; f += 0.01) {
        const U = degreConsolidation(1.2 * f);
        sans.push([X(f), ys0 + (ysf - ys0) * U]);
        avec.push([X(f), ys0 + (ysf - ys0) * (f <= ts ? k * U : 1)]);
      }
      s += ligne(xg, ysf, xd, ysf, COULEURS.grille, 1, 'stroke-dasharray="4 3"');
      s += etiq(xg - 8, ysf + 4, "sf", { ancre: "end", taille: 11, couleur: COULEURS.encre });
      s += chemin(poly(sans), "none", COULEURS.discret, 2, 'stroke-dasharray="6 4"') + chemin(poly(avec), "none", COULEURS.effort, 2.4);
      s += etiq(X(0.5), 212, "sans surcharge : sf n'est approché que bien plus tard", { taille: 10.5, couleur: COULEURS.discret });
      s += etiq(X(ts) + 6, ysf + 16, "avec surcharge : sf atteint à ts", { taille: 10.5, couleur: COULEURS.effort });
      s += etiq(largeur / 2, hauteur - 10, "la surcharge retirée, le sol est surconsolidé sous qf : il ne tasse plus guère", { ancre: "middle", taille: 10.5, gras: false });
      return s;
    },
  });
}

/** Stabilité à court terme d'un remblai sur argile molle : cercle de rupture, banquette, hauteur admissible. */
export function schemaStabiliteRemblai({ largeur = 640, hauteur = 300 } = {}) {
  return svg({
    largeur, hauteur, titre: "Stabilité d'un remblai sur sol mou", contenu: (id) => {
      const yT = 150, yC = 80, yA = 250, xgp = 110, xgc = 220, xdc = 380, xdp = 490;
      let s = "";
      s += couche(id, { x: 12, y: yT, w: largeur - 24, h: yA - yT, sol: "argile" });
      s += couche(id, { x: 12, y: yA, w: largeur - 24, h: hauteur - 8 - yA, sol: "sable" });
      s += zoneSol(id, [[xgp, yT], [xgc, yC], [xdc, yC], [xdp, yT]], "remblai");
      const xB = xdc + ((130 - yC) / (yT - yC)) * (xdp - xdc);
      s += zoneSol(id, [[xB, 130], [566, 130], [598, yT], [xdp, yT]], "remblai");
      s += chemin(poly([[xgp, yT], [xgc, yC], [xdc, yC], [xdp, yT]]), "none", COULEURS.trait, 1.6);
      s += chemin(poly([[xB, 130], [566, 130], [598, yT]]), "none", COULEURS.trait, 1.4, 'stroke-dasharray="5 3"');
      s += ligne(12, yT, largeur - 12, yT, COULEURS.trait, 1.4) + ligne(12, yA, largeur - 12, yA, COULEURS.trait, 1);
      // Cercle de rupture : centre (190 ; 20), passe au pied gauche et sur la crête.
      const cx = 190, cy = 20, R = Math.hypot(xgp - 50 - cx, yT - cy), xs = cx + Math.sqrt(R * R - (yC - cy) ** 2);
      s += `<path d="M${xgp - 50} ${yT}A${r1(R)} ${r1(R)} 0 0 0 ${r1(xs)} ${yC}" fill="none" stroke="${COULEURS.effort}" stroke-width="2" stroke-dasharray="7 4"/>`;
      s += fleche(id, 250, 112, 214, 124, { ep: 2 });
      s += etiq(300, 118, "remblai", { ancre: "middle", taille: 11.5 });
      s += etiq(20, 238, "surface de rupture : cu le long du cercle", { taille: 10.5, couleur: COULEURS.effort });
      s += etiq(582, 122, "banquette", { ancre: "middle", taille: 10.5 });
      s += etiq(largeur - 16, 36, "Hmax ≈ (π + 2) cu / (γ F)", { ancre: "end", taille: 12 });
      s += etiq(largeur - 16, 54, "plus haut : étapes, banquettes, renforcement", { ancre: "end", taille: 10.5, gras: false });
      s += etiq(440, 214, "argile molle (cu)", { taille: 10.5 });
      s += etiq(560, yA + 26, "sable", { taille: 10.5 });
      return s;
    },
  });
}

/** Cinq façons de construire sur un sol mou : drains et préchargement, colonnes, inclusions, allègement, substitution. */
export function schemaAmelioration({ largeur = 640, hauteur = 250 } = {}) {
  return svg({
    largeur, hauteur, titre: "Techniques de construction sur sols compressibles", contenu: (id) => {
      const w = 116, yT = 110, yM = 186, yF = 204;
      const titres = [["drains verticaux", "et préchargement"], ["colonnes", "ballastées"], ["inclusions rigides", "et plateforme"], ["remblai", "allégé (PSE)"], ["purge et", "substitution"]];
      let s = "";
      titres.forEach((t, i) => {
        const x = 12 + i * (w + 9), rem = [[x + 8, yT], [x + 34, 70], [x + 82, 70], [x + 108, yT]];
        s += couche(id, { x, y: yT, w, h: yM - yT, sol: "argile" }) + couche(id, { x, y: yM, w, h: yF - yM, sol: "sable" });
        if (i === 4) {
          s += zoneSol(id, [[x + 4, yT], [x + 112, yT], [x + 96, yM], [x + 20, yM]], "sable");
          s += chemin(poly([[x + 4, yT], [x + 20, yM], [x + 96, yM], [x + 112, yT]]), "none", COULEURS.trait, 1.1, 'stroke-dasharray="4 2"');
        }
        s += zoneSol(id, rem, "remblai") + chemin(poly(rem), "none", COULEURS.trait, 1.3);
        if (i === 0) {
          for (let k = 0; k < 6; k++) s += ligne(x + 16 + 17 * k, yT, x + 16 + 17 * k, yM - 2, "#1e293b", 1.4);
          s += chemin(poly([[x + 34, 70], [x + 42, 50], [x + 74, 50], [x + 82, 70]]), "#fee2e2", COULEURS.effort, 1.2, 'stroke-dasharray="4 2"');
        }
        if (i === 1) for (let k = 0; k < 4; k++) s += `<rect x="${x + 18 + 24 * k}" y="${yT}" width="9" height="${yM - yT}" fill="#e3d3a0" stroke="#7c6a3a" stroke-width=".8"/><rect x="${x + 18 + 24 * k}" y="${yT}" width="9" height="${yM - yT}" fill="url(#${id}-grave)"/>`;
        if (i === 2) {
          for (let k = 0; k < 5; k++) s += beton(id, x + 16 + 20 * k, yT, 5, yF - yT - 6);
          s += zoneSol(id, [[x + 8, yT - 8], [x + 108, yT - 8], [x + 108, yT], [x + 8, yT]], "grave");
          s += ligne(x + 8, yT - 4, x + 108, yT - 4, COULEURS.violet, 1.6);
        }
        if (i === 3) for (let r = 0; r < 3; r++) for (let c = 0; c < 4 - r; c++) s += rect(x + 30 + r * 7 + c * 14, yT - 12 - r * 11, 13, 10, "#fff", "#94a3b8", 0.8);
        s += ligne(x, yT, x + w, yT, COULEURS.trait, 1.1);
        s += etiqs(x + w / 2, 222, t, { ancre: "middle", taille: 10.5 });
      });
      s += etiq(12, 26, "Une même argile molle, cinq parades :", { taille: 11 });
      return s;
    },
  });
}

/** Remblai d'accès contre une culée sur pieux : tassement, marche, dalle de transition, efforts parasites sur les pieux. */
export function schemaRemblaiContigu({ largeur = 640, hauteur = 320 } = {}) {
  return svg({
    largeur, hauteur, titre: "Remblai d'accès contre une culée sur pieux", contenu: (id) => {
      const yT = 150, yA = 250, yR = 70;
      let s = "";
      s += couche(id, { x: 12, y: yT, w: largeur - 24, h: yA - yT, sol: "argile" });
      s += couche(id, { x: 12, y: yA, w: largeur - 24, h: hauteur - 8 - yA, sol: "sable" });
      s += zoneSol(id, [[20, yT], [120, yR], [440, yR], [440, yT]], "remblai");
      s += chemin(poly([[20, yT], [120, yR], [440, yR]]), "none", COULEURS.trait, 1.6);
      s += ligne(12, yT, largeur - 12, yT, COULEURS.trait, 1.4) + ligne(12, yA, largeur - 12, yA, COULEURS.trait, 1);
      // Culée : mur, semelle sur deux pieux ancrés dans le sable ; tablier.
      s += beton(id, 440, 60, 18, yT - 60) + beton(id, 424, yT - 4, 100, 16);
      for (const x of [446, 500]) s += beton(id, x - 7, yT + 12, 14, 292 - yT - 12);
      s += beton(id, 458, 56, largeur - 12 - 458, 12);
      // Dalle de transition, appuyée sur la culée.
      s += `<path d="M372 ${yR + 12}L440 ${yR + 6}L440 ${yR + 12}L372 ${yR + 18}Z" fill="${COULEURS.beton}" stroke="${COULEURS.betonTrait}" stroke-width="1.1"/>`;
      // Profil du remblai après tassement : une marche se forme contre la culée.
      s += chemin(poly([[120, yR + 20], [370, yR + 18], [440, yR + 4]]), "none", COULEURS.effort, 1.5, 'stroke-dasharray="6 3"');
      for (const y of [168, 196, 224]) s += fleche(id, 430, y - 10, 430, y + 10, { ep: 1.6 }) + fleche(id, 516, y - 10, 516, y + 10, { ep: 1.6 });
      for (const y of [178, 214]) s += fleche(id, 380, y, 424, y, { ep: 1.8 });
      s += etiq(200, 126, "remblai d'accès", { ancre: "middle", taille: 11.5 });
      s += etiq(220, 56, "dalle de transition", { taille: 10.5 }) + ligne(326, 60, 380, 80, COULEURS.trait, 0.8);
      s += etiq(300, 102, "profil tassé", { taille: 10.5, couleur: COULEURS.effort });
      s += etiq(552, 50, "tablier", { taille: 10.5 });
      s += etiq(478, 110, "culée sur pieux", { taille: 10.5 });
      s += etiqs(530, 190, ["frottement", "négatif (ch. 13)"], { taille: 10.5, couleur: COULEURS.effort });
      s += etiqs(372, 196, ["poussée", "latérale (ch. 14)"], { ancre: "end", taille: 10.5, couleur: COULEURS.effort });
      s += etiq(20, yA - 10, "argile molle", { taille: 10.5 }) + etiq(20, yA + 26, "sable", { taille: 10.5 });
      return s;
    },
  });
}
