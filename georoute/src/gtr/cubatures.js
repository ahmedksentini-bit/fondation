// Cubatures et mouvement des terres : profils en travers (surfaces de
// déblai et de remblai), volumes entre profils, coefficients de foisonnement
// et de compactage, épure de Lalanne (courbe des volumes cumulés), lignes de
// répartition et moments de transport.

import { horsDomaine } from "./outils.js";

// ───────────────────────────── Profil en travers ─────────────────────────────

/** Cote d'une polyligne [(x, z)] triée en x, prolongée horizontalement aux bouts. */
export function coteEn(poly, x) {
  if (x <= poly[0][0]) return poly[0][1];
  for (let i = 1; i < poly.length; i++) {
    const [x0, z0] = poly[i - 1], [x1, z1] = poly[i];
    if (x <= x1) return x1 === x0 ? z1 : z0 + ((z1 - z0) * (x - x0)) / (x1 - x0);
  }
  return poly[poly.length - 1][1];
}

/**
 * Point où un talus issu de (x0, z0), de fruit f (horizontal pour 1 de
 * vertical), coupe le terrain naturel en s'éloignant de l'axe (sens = ±1).
 * En déblai le talus monte, en remblai il descend.
 */
function piedOuCrete(tn, x0, z0, f, sens, monte) {
  const pente = (monte ? 1 : -1) / f; // dz/d|x|
  const g = (x) => coteEn(tn, x) - (z0 + pente * Math.abs(x - x0));
  // On s'éloigne de l'axe par pas de 25 cm jusqu'au changement de signe, puis dichotomie.
  let a = x0, ga = g(a);
  for (let k = 1; k <= 4000; k++) {
    let b = x0 + sens * k * 0.25;
    const gb = g(b);
    if (ga === 0) return a;
    if ((ga > 0) !== (gb > 0) || gb === 0) {
      for (let i = 0; i < 70; i++) {
        const m = (a + b) / 2, gm = g(m);
        if ((gm > 0) === (ga > 0)) { a = m; ga = gm; } else b = m;
      }
      return (a + b) / 2;
    }
    a = b; ga = gb;
  }
  return null;
}

/**
 * Profil en travers type : plateforme de terrassement de demi-largeurs lg et
 * ld (m) autour de l'axe, cote à l'axe zAxe, dévers (pente transversale, en
 * %, positive quand le bord descend), talus de déblai et de remblai de
 * fruits fd et fr. Le profil projet rejoint le terrain naturel tn [(x, z)].
 * Renvoie la polyligne projet, l'emprise et les surfaces de déblai et de
 * remblai (m²).
 */
export function profilTravers({ tn, zAxe, lg = 5, ld = 5, devers = 2.5, fd = 1, fr = 1.5 }) {
  const t = [...tn].sort((a, b) => a[0] - b[0]);
  if (t.length < 2) return horsDomaine("Le terrain naturel doit compter au moins deux points.");
  const bordG = [-lg, zAxe - (devers / 100) * lg], bordD = [ld, zAxe - (devers / 100) * ld];
  const talus = (bord, sens) => {
    const enDeblai = coteEn(t, bord[0]) > bord[1];
    const f = enDeblai ? fd : fr;
    const x = piedOuCrete(t, bord[0], bord[1], f, sens, enDeblai);
    if (x === null) return null;
    return [x, coteEn(t, x)];
  };
  const extG = talus(bordG, -1), extD = talus(bordD, 1);
  if (!extG || !extD) return horsDomaine("Les talus ne rejoignent pas le terrain naturel dans la largeur décrite.");
  const projet = [extG, bordG, [0, zAxe], bordD, extD];
  const { deblai, remblai } = surfacesEntre(t, projet, extG[0], extD[0]);
  return { applicable: true, projet, tn: t, emprise: [extG[0], extD[0]], largeurEmprise: extD[0] - extG[0], deblai, remblai };
}

/**
 * Surfaces entre le terrain naturel et le projet sur [xa, xb] : déblai là où
 * le terrain est au-dessus du projet, remblai là où il est au-dessous.
 * Calcul exact pour des polylignes : sur chaque tronçon, l'écart est
 * linéaire ; on coupe au point où il change de signe.
 */
export function surfacesEntre(tn, projet, xa, xb) {
  const xs = [...new Set([xa, xb, ...tn.map((p) => p[0]), ...projet.map((p) => p[0])])].filter((x) => x >= xa && x <= xb).sort((a, b) => a - b);
  let deblai = 0, remblai = 0;
  const d = (x) => coteEn(tn, x) - coteEn(projet, x);
  for (let i = 1; i < xs.length; i++) {
    const x0 = xs[i - 1], x1 = xs[i], d0 = d(x0), d1 = d(x1), L = x1 - x0;
    if (d0 >= 0 && d1 >= 0) deblai += ((d0 + d1) / 2) * L;
    else if (d0 <= 0 && d1 <= 0) remblai -= ((d0 + d1) / 2) * L;
    else {
      const xc = (L * d0) / (d0 - d1); // distance au zéro depuis x0
      if (d0 > 0) { deblai += (d0 * xc) / 2; remblai += (-d1 * (L - xc)) / 2; }
      else { remblai += (-d0 * xc) / 2; deblai += (d1 * (L - xc)) / 2; }
    }
  }
  return { deblai, remblai };
}

// ───────────────────────────── Volumes entre profils ─────────────────────────

/**
 * Volumes par la moyenne des aires : entre deux profils distants de d, le
 * volume vaut d (S1 + S2)/2 ; le déblai et le remblai se cumulent séparément.
 * profils : [{ x (abscisse curviligne, m), deblai, remblai (m²) }].
 */
export function volumes(profils) {
  const p = [...profils].sort((a, b) => a.x - b.x);
  const troncons = [];
  for (let i = 1; i < p.length; i++) {
    const d = p[i].x - p[i - 1].x;
    troncons.push({ de: p[i - 1].x, a: p[i].x, deblai: (d * (p[i - 1].deblai + p[i].deblai)) / 2, remblai: (d * (p[i - 1].remblai + p[i].remblai)) / 2 });
  }
  const total = troncons.reduce((s, t) => ({ deblai: s.deblai + t.deblai, remblai: s.remblai + t.remblai }), { deblai: 0, remblai: 0 });
  return { troncons, total };
}

/** Formule des trois niveaux (prismoïde) : V = d (S1 + 4 Sm + S2)/6. */
export const prismoide = ({ d, S1, Sm, S2 }) => (d * (S1 + 4 * Sm + S2)) / 6;

// ───────────────────────────── Foisonnement ─────────────────────────────

/**
 * Passage des volumes : un mètre cube en place devient Cf m³ foisonnés dans
 * le camion, puis Ct m³ une fois compacté en remblai (Ct = ρd en place /
 * ρd compacté). Cf et Ct dépendent du matériau.
 */
export function foisonnement({ Vplace, Cf = 1.25, Ct = 0.95 }) {
  return { Vplace, Vfoisonne: Vplace * Cf, Vcompacte: Vplace * Ct };
}

/** Coefficient de compactage à partir des masses volumiques sèches en place et en remblai. */
export const coefficientCompactage = ({ rhoDplace, rhoDremblai }) => rhoDplace / rhoDremblai;

// ───────────────────────────── Épure de Lalanne ─────────────────────────────

/**
 * Courbe des volumes cumulés (épure de Lalanne, ou de Brückner) : le long du
 * tracé, on cumule le déblai utilisable converti en volume de remblai
 * compacté, moins le remblai. La courbe monte dans les déblais et descend
 * dans les remblais ; son ordonnée finale est l'excédent (> 0, mis en dépôt)
 * ou le déficit (< 0, à emprunter).
 * troncons : [{ de, a, deblai, remblai }] ; reemploi : part du déblai
 * réutilisable (0 à 1) ; Ct : coefficient de compactage.
 */
export function epure(troncons, { reemploi = 1, Ct = 1 } = {}) {
  const pts = [[troncons[0]?.de ?? 0, 0]];
  let y = 0;
  for (const t of troncons) {
    // Déblai et remblai d'un tronçon sont répartis uniformément sur sa longueur :
    // un seul point en fin de tronçon suffit (la courbe y est linéaire).
    y += t.deblai * reemploi * Ct - t.remblai;
    pts.push([t.a, y]);
  }
  return { points: pts, solde: y };
}

/**
 * Ligne de répartition horizontale y = c sur l'épure : entre deux points où
 * elle coupe la courbe, déblais et remblais s'équilibrent. Pour chaque
 * boucle : volume transporté (écart maximal à la ligne) et moment de
 * transport (aire entre la courbe et la ligne, m³·m) ; la distance moyenne
 * de transport en est le quotient. Les bouts non équilibrés partent en
 * dépôt (excédent) ou viennent d'emprunt (déficit).
 */
export function repartition(points, c) {
  const g = points.map(([x, y]) => [x, y - c]);
  const coupes = [];
  for (let i = 1; i < g.length; i++) {
    const [x0, y0] = g[i - 1], [x1, y1] = g[i];
    if (y0 === 0) coupes.push(x0);
    if ((y0 < 0 && y1 > 0) || (y0 > 0 && y1 < 0)) coupes.push(x0 + ((x1 - x0) * y0) / (y0 - y1));
  }
  if (g[g.length - 1][1] === 0) coupes.push(g[g.length - 1][0]);
  const yEn = (x) => {
    for (let i = 1; i < g.length; i++) if (x <= g[i][0]) {
      const [x0, y0] = g[i - 1], [x1, y1] = g[i];
      return x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
    return g[g.length - 1][1];
  };
  const aire = (a, b) => {
    // |aire| entre a et b, en suivant les sommets de la courbe.
    const xs = [a, ...g.map((p) => p[0]).filter((x) => x > a && x < b), b];
    let s = 0;
    for (let i = 1; i < xs.length; i++) s += Math.abs((yEn(xs[i - 1]) + yEn(xs[i])) / 2) * (xs[i] - xs[i - 1]);
    return s;
  };
  const extremum = (a, b) => Math.max(...[a, ...g.map((p) => p[0]).filter((x) => x > a && x < b), b].map((x) => Math.abs(yEn(x))));
  const boucles = [];
  for (let i = 1; i < coupes.length; i++) {
    const a = coupes[i - 1], b = coupes[i];
    if (b - a < 1e-9) continue;
    const V = extremum(a, b), M = aire(a, b);
    boucles.push({ de: a, a: b, volume: V, moment: M, distance: V > 0 ? M / V : 0, sens: yEn((a + b) / 2) > 0 ? "vers l'aval" : "vers l'amont" });
  }
  const debut = g[0][1], fin = g[g.length - 1][1];
  return {
    c, coupes, boucles,
    momentTotal: boucles.reduce((s, b) => s + b.moment, 0),
    volumeTransporte: boucles.reduce((s, b) => s + b.volume, 0),
    // Bouts : au départ, la courbe part de 0 ; avec la ligne à c, le début apporte −c.
    debut: -debut, fin,
  };
}
