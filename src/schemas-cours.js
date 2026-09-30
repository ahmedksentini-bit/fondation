// Schémas explicatifs du cours, hors appareils d'essai (src/schemas-essais.js) :
// modèle de terrain, profondeurs de reconnaissance, essais de laboratoire,
// classement des sols, valeurs caractéristiques… Mêmes règles que les autres
// figures : aucun libellé sur un tracé ni sur un autre libellé, rien hors du
// cadre (tests/schemas.test.mjs).

import { svg, couche, ligne, texte, cote, fleche, COULEURS, fmt, pasJoli } from "./figures.js";
import { CLASSES_F62 } from "./geotech/sols.js";

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
  const couleurs = { remblai: "#eadfd2", limon: "#e8dcc3", argile: "#dccab0", sable: "#f3e5ae", marne: "#cfd8c7", roche: "#b8bec7", tourbe: "#8d7a64" };
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
