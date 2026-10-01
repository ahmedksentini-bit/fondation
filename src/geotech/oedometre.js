// Essai œdométrique virtuel et son dépouillement.
//  · loi de compressibilité : recompression C_s jusqu'à σ'p, branche vierge
//    C_c au-delà, coude arrondi d'autant plus que l'échantillon est remanié ;
//    déchargement et rechargement sur C_s depuis la plus forte contrainte subie ;
//  · chaque palier : tassement immédiat (faible), consolidation primaire de
//    Terzaghi (drainage double, H_d = moitié de l'épaisseur du moment), puis
//    fluage C_αe lg(t/t_p) ; c_v plus grand en recompression ;
//  · lectures du comparateur aux temps normalisés, au micron près ;
//  · dépouillement : d0, d100 et t50 de Casagrande, t90 de Taylor, c_v,
//    C_αe ; sur la courbe e – lg σ' : σ'p par la construction de Casagrande,
//    C_c, C_s, m_v et E_oed.
// Unités : kPa, mm, minutes pour les lectures, m²/an pour c_v.
import { degreConsolidation, facteurTemps } from "./consolidation.js";

export const ANNEE_MIN = 365.25 * 24 * 60;
/** Temps normalisés des lectures d'un palier (min). */
export const TEMPS_LECTURE = [0.1, 0.25, 0.5, 1, 2, 4, 8, 15, 30, 60, 120, 240, 480, 1440];

/**
 * Matériaux du banc : état en place (e0 sous σ'v0), préconsolidation σ'p,
 * indices C_c, C_s, coefficient de consolidation sur la branche vierge et en
 * recompression (m²/an), indice de fluage C_αe.
 */
export const MATERIAUX_OEDO = {
  "argile-molle": { nom: "Argile molle légèrement surconsolidée", e0: 1.42, sv0: 48, sp: 70, Cc: 0.62, Cs: 0.07, cv: 1.6, cvOC: 9, Cae: 0.024 },
  vase: { nom: "Vase organique", e0: 2.55, sv0: 26, sp: 34, Cc: 1.3, Cs: 0.14, cv: 0.45, cvOC: 2.5, Cae: 0.065 },
  limon: { nom: "Limon argileux", e0: 0.84, sv0: 85, sp: 150, Cc: 0.24, Cs: 0.032, cv: 7, cvOC: 35, Cae: 0.008 },
  "argile-raide": { nom: "Argile raide surconsolidée", e0: 0.66, sv0: 130, sp: 520, Cc: 0.26, Cs: 0.038, cv: 3.5, cvOC: 22, Cae: 0.006 },
};

const softplus = (y, r) => (r > 1e-6 ? r * Math.log1p(Math.exp(y / r)) : Math.max(0, y));

/**
 * Courbe de chargement à la fin de la consolidation primaire : recompression
 * C_s jusqu'à σ'p, branche vierge C_c au-delà, coude légèrement arrondi
 * (0,04 décade). Le remaniement (0 : échantillon intact, 1 : très remanié)
 * abaisse la courbe surtout juste avant σ'p — la recompression paraît plus
 * raide, le coude plus doux et plus précoce — puis la laisse rejoindre la
 * branche vierge aux fortes contraintes, comme l'a montré Schmertmann.
 */
export function courbeVierge(m, remaniement = 0) {
  const rem = Math.max(0, Math.min(1, remaniement));
  const xp = Math.log10(m.sp), xv = Math.log10(m.sv0), ep = m.e0 - m.Cs * Math.log10(m.sp / m.sv0);
  const w = Math.max(0.15, xp - xv + 0.3);
  const bosse = (x) => (x <= xp ? Math.max(0, 1 - ((xp - x) / w) ** 2) : Math.exp(-(x - xp) / 0.5));
  const chute = 0.32 * (m.Cc - m.Cs) * rem;
  return (s) => { const x = Math.log10(s); return ep - m.Cs * (x - xp) - (m.Cc - m.Cs) * softplus(x - xp, 0.04) - chute * bosse(x); };
}

/**
 * Simulation d'un essai à paliers. paliers : contraintes appliquées successives
 * (kPa), chargement ou déchargement ; duree (min) de chaque palier.
 * Éprouvette Ø 70 mm, H0 = 20 mm. Renvoie, pour chaque palier, ses lectures
 * [{ t, d }] (d : tassement cumulé, mm) et son état final.
 */
export function simulerOedometre(m, paliers, { H0 = 20, duree = 1440, remaniement = 0, assise = 5, graine = 1 } = {}) {
  const vierge = courbeVierge(m, remaniement);
  let s = (graine * 9301 + 49297) % 233280;
  const bruit = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 - 0.5; };
  // État de départ : l'éprouvette, déchargée, a regonflé sur C_s jusqu'à la contrainte d'assise.
  const eAssise = vierge(m.sv0) + m.Cs * Math.log10(m.sv0 / assise);
  // smax : plus forte contrainte appliquée jusque-là ; au-delà, la courbe de chargement (recompression puis vierge).
  // smax : plus forte contrainte appliquée ; eMax : indice des vides à la fin de ce palier.
  // Au-delà de smax, fin de consolidation primaire sur la courbe de chargement : le fluage
  // d'un palier ne s'ajoute pas à celui des suivants (courbes de Bjerrum parallèles).
  // En deçà, déchargement et rechargement sur la droite C_s issue du palier le plus chargé.
  let smax = assise, sCourant = assise, e = eAssise, eMax = eAssise;
  const eFin = (sig) => (sig >= smax ? Math.min(vierge(sig), e) : eMax + m.Cs * Math.log10(smax / sig));
  const res = [];
  let dCumul = 0;
  for (const sig of paliers) {
    const H = (H0 * (1 + e)) / (1 + eAssise), Hd = H / 2 / 1000; // m
    const charge = sig > sCourant;
    // c_v : branche vierge au-delà de la plus forte contrainte déjà subie, recompression en deçà.
    const vierge0 = Math.max(smax, m.sp);
    const part = !charge ? 0 : sig <= vierge0 ? 0 : sCourant >= vierge0 ? 1 : Math.log10(sig / vierge0) / Math.log10(sig / sCourant);
    const cv = charge ? 10 ** (part * Math.log10(m.cv) + (1 - part) * Math.log10(m.cvOC)) : m.cvOC;
    const eP = eFin(sig);
    const de = e - eP;
    const imm = 0.03 * de;
    const tp = (facteurTemps(0.95) * Hd * Hd) / cv * ANNEE_MIN; // min
    const Cae = charge && sig > vierge0 * 0.9 ? m.Cae : charge ? m.Cae * 0.2 : 0;
    // e change d'un palier au suivant : eDe garde celui du début de ce palier-ci.
    const eDebut = e;
    const eDe = (t) => {
      const U = degreConsolidation((cv * (t / ANNEE_MIN)) / (Hd * Hd));
      const sec = t > tp ? Cae * Math.log10(t / tp) : 0;
      return eDebut - imm - (de - imm) * U - sec;
    };
    const lectures = [{ t: 0, d: +dCumul.toFixed(3) }];
    for (const t of TEMPS_LECTURE.filter((x) => x <= duree + 1e-9)) {
      const d = dCumul + (H0 * (e - eDe(t))) / (1 + eAssise) + 0.0012 * bruit();
      lectures.push({ t, d: Math.round(d * 500) / 500 });
    }
    const eFinPalier = eDe(duree);
    dCumul += (H0 * (e - eFinPalier)) / (1 + eAssise);
    res.push({ sigma: sig, charge, cv, tp, H, Hd: Hd * 1000, eDebut: e, eFin: eFinPalier, eP, lectures, d: dCumul, eDe });
    e = eFinPalier;
    sCourant = sig;
    if (sig >= smax) { smax = sig; eMax = e; }
  }
  return { eAssise, H0, paliers: res };
}

// ─────────────────────────── Dépouillement d'un palier ───────────────────

/** Lecture interpolée en lg t. */
function lireLog(lectures, t) {
  const l = lectures.filter((x) => x.t > 0);
  if (t <= l[0].t) return l[0].d;
  for (let i = 1; i < l.length; i++) if (t <= l[i].t) {
    const f = (Math.log10(t) - Math.log10(l[i - 1].t)) / (Math.log10(l[i].t) - Math.log10(l[i - 1].t));
    return l[i - 1].d + f * (l[i].d - l[i - 1].d);
  }
  return l.at(-1).d;
}

/**
 * Construction de Casagrande sur un palier : d0 par la parabole du début
 * (entre t1 et 4 t1 le tassement double), d100 à l'intersection de la tangente
 * au point d'inflexion et de la droite de fluage, t50 au milieu.
 */
export function casagrande(lectures, { t1 = 0.25 } = {}) {
  const l = lectures.filter((x) => x.t > 0);
  if (l.length < 6) return { applicable: false, motif: "trop peu de lectures" };
  const d0 = lireLog(l, t1) - (lireLog(l, 4 * t1) - lireLog(l, t1));
  // Pente maximale en lg t (point d'inflexion), sur des écarts centrés.
  let iMax = 1, pMax = -Infinity;
  for (let i = 1; i < l.length - 1; i++) {
    const p = (l[i + 1].d - l[i - 1].d) / (Math.log10(l[i + 1].t) - Math.log10(l[i - 1].t));
    if (p > pMax) { pMax = p; iMax = i; }
  }
  const xI = Math.log10(l[iMax].t), dI = l[iMax].d;
  // Droite de fluage : les trois dernières lectures.
  const fin = l.slice(-3), mx = fin.reduce((s, x) => s + Math.log10(x.t), 0) / 3, md = fin.reduce((s, x) => s + x.d, 0) / 3;
  let sxx = 0, sxd = 0;
  for (const x of fin) { sxx += (Math.log10(x.t) - mx) ** 2; sxd += (Math.log10(x.t) - mx) * (x.d - md); }
  const pF = sxd / sxx;
  if (!(pMax > pF * 1.5)) return { applicable: false, motif: "pas de point d'inflexion net : palier en recompression ou trop court" };
  const xX = (md - pF * mx - dI + pMax * xI) / (pMax - pF), d100 = dI + pMax * (xX - xI);
  const d50 = (d0 + d100) / 2;
  let t50 = null;
  for (let i = 1; i < l.length; i++) if ((l[i - 1].d - d50) * (l[i].d - d50) <= 0 && l[i].d !== l[i - 1].d) {
    const f = (d50 - l[i - 1].d) / (l[i].d - l[i - 1].d);
    t50 = 10 ** (Math.log10(l[i - 1].t) + f * (Math.log10(l[i].t) - Math.log10(l[i - 1].t)));
    break;
  }
  return { applicable: t50 !== null, d0, d100, d50, t50, t100: 10 ** xX, inflexion: { t: l[iMax].t, d: dI, pente: pMax }, fluage: { pente: pF, mx, md }, motif: t50 === null ? "d50 hors des lectures" : null };
}

/**
 * Construction de Taylor : droite du début en √t (deuxième à quatrième
 * lecture), puis droite d'abscisses 1,15 fois plus grandes ; son
 * intersection avec la courbe donne √t90.
 */
export function taylor(lectures) {
  const l = lectures.filter((x) => x.t > 0).map((x) => ({ r: Math.sqrt(x.t), d: x.d }));
  if (l.length < 6) return { applicable: false, motif: "trop peu de lectures" };
  const deb = l.slice(1, 5), mr = deb.reduce((s, x) => s + x.r, 0) / deb.length, md = deb.reduce((s, x) => s + x.d, 0) / deb.length;
  let srr = 0, srd = 0;
  for (const x of deb) { srr += (x.r - mr) ** 2; srd += (x.r - mr) * (x.d - md); }
  const pente = srd / srr, d0 = md - pente * mr;
  if (!(pente > 0)) return { applicable: false, motif: "début de courbe sans pente" };
  const ligne2 = (r) => d0 + (pente / 1.15) * r;
  for (let i = 1; i < l.length; i++) {
    const a = l[i - 1].d - ligne2(l[i - 1].r), b = l[i].d - ligne2(l[i].r);
    if (a > 0 && b <= 0) {
      const f = a / (a - b), r90 = l[i - 1].r + f * (l[i].r - l[i - 1].r);
      return { applicable: true, d0, pente, t90: r90 * r90, d90: ligne2(r90) };
    }
  }
  return { applicable: false, motif: "la courbe ne recoupe pas la droite 1,15 : palier trop court" };
}

/** c_v (m²/an) d'après t50 ou t90 (min) et la demi-épaisseur H_d (mm). */
export const cvDeT50 = (t50, Hd) => (0.197 * (Hd / 1000) ** 2) / (t50 / ANNEE_MIN);
export const cvDeT90 = (t90, Hd) => (0.848 * (Hd / 1000) ** 2) / (t90 / ANNEE_MIN);

// ─────────────────────────── Courbe de compressibilité ───────────────────

/** Système linéaire 3 × 3 (règle de Cramer) ; null s'il est singulier. */
function resoudre3(A, B) {
  const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(A);
  if (!(Math.abs(D) > 1e-14)) return null;
  return [0, 1, 2].map((j) => det(A.map((ligne, i) => ligne.map((v, l) => (l === j ? B[i] : v)))) / D);
}

/**
 * Dépouillement de la courbe e – lg σ' (points de fin de palier) :
 * droite vierge sur les trois plus fortes contraintes du chargement, C_s sur
 * le déchargement, σ'p par la construction de Casagrande (point de plus forte
 * courbure, tangente, horizontale, bissectrice, intersection avec la vierge),
 * ici dans un repère normalisé comme le serait un graphique carré.
 */
export function compressibilite(points) {
  const charge = [], decharge = [];
  let max = -Infinity;
  for (const p of points) { if (p.sigma >= max) { charge.push(p); max = p.sigma; } else decharge.push(p); }
  if (charge.length < 5) return { applicable: false, motif: "il faut au moins cinq paliers de chargement" };
  const vierge = charge.slice(-3);
  const reg = (pts) => {
    const xs = pts.map((p) => Math.log10(p.sigma)), mx = xs.reduce((a, b) => a + b, 0) / xs.length, me = pts.reduce((a, p) => a + p.e, 0) / pts.length;
    let sxx = 0, sxe = 0;
    pts.forEach((p, i) => { sxx += (xs[i] - mx) ** 2; sxe += (xs[i] - mx) * (p.e - me); });
    return { pente: sxe / sxx, mx, me };
  };
  const v = reg(vierge), Cc = -v.pente;
  const Cs = decharge.length ? (decharge.at(-1).e - charge.at(-1).e) / (Math.log10(charge.at(-1).sigma) - Math.log10(decharge.at(-1).sigma)) : null;
  // Repère normalisé : une décade de contrainte et l'étendue de e occupent la même longueur.
  const xs = charge.map((p) => Math.log10(p.sigma)), es = charge.map((p) => p.e);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), e0 = Math.min(...es), e1 = Math.max(...es);
  const X = (x) => (x - x0) / (x1 - x0), E = (e) => (e - e0) / (e1 - e0);
  // Courbe lissée tracée au travers des points, comme le ferait le laborantin :
  // e = a − b x − c s_r(x − x0), ajustée par moindres carrés (a, b, c linéaires ;
  // x0 et l'arrondi r cherchés sur une grille). On y cherche le point de plus
  // forte courbure, dans le repère normalisé.
  const n = xs.length, sx = x1 - x0, se = e1 - e0;
  let meilleur = null;
  for (let r = 0.02; r <= 0.6 + 1e-9; r += 0.02) {
    for (let k = 0; k <= 80; k++) {
      const c0 = xs[1] + ((xs[n - 2] - xs[1]) * k) / 80;
      // Équations normales 3 × 3 pour (a, b, c), colonnes [1, −x, −s_r(x − c0)].
      const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], B = [0, 0, 0];
      for (let i = 0; i < n; i++) {
        const v = [1, -xs[i], -softplus(xs[i] - c0, r)];
        for (let j = 0; j < 3; j++) { B[j] += v[j] * es[i]; for (let l = 0; l < 3; l++) A[j][l] += v[j] * v[l]; }
      }
      const sol = resoudre3(A, B);
      if (!sol) continue;
      let sse = 0;
      for (let i = 0; i < n; i++) sse += (es[i] - (sol[0] - sol[1] * xs[i] - sol[2] * softplus(xs[i] - c0, r))) ** 2;
      if (sol[2] > 0 && (!meilleur || sse < meilleur.sse)) meilleur = { a: sol[0], b: sol[1], c: sol[2], x0: c0, r, sse };
    }
  }
  if (!meilleur) return { applicable: false, motif: "courbe impossible à lisser" };
  const lisse = (x) => {
    const sg = 1 / (1 + Math.exp(-(x - meilleur.x0) / meilleur.r));
    return { y: meilleur.a - meilleur.b * x - meilleur.c * softplus(x - meilleur.x0, meilleur.r), d1: -meilleur.b - meilleur.c * sg, d2: (-meilleur.c * sg * (1 - sg)) / meilleur.r };
  };
  let xC = xs[1], kMax = -Infinity;
  for (let k = 0; k <= 600; k++) {
    const x = xs[0] + ((xs[n - 1] - xs[0]) * k) / 600, v2 = lisse(x);
    const p1 = (v2.d1 * sx) / se, p2 = (v2.d2 * sx * sx) / se, kk = Math.abs(p2) / (1 + p1 * p1) ** 1.5;
    if (kk > kMax) { kMax = kk; xC = x; }
  }
  const vc = lisse(xC), P = [X(xC), E(vc.y)];
  const sl = (vc.d1 * sx) / se;
  const iC = xs.reduce((best, x, i) => (Math.abs(x - xC) < Math.abs(xs[best] - xC) ? i : best), 0);
  const aT = Math.atan(sl), aB = aT / 2; // bissectrice entre l'horizontale (0) et la tangente (pente négative)
  // Droite vierge dans le repère normalisé : E = E(me) + pv (X − X(mx)), pv = pente normalisée.
  const pv = (v.pente * (x1 - x0)) / (e1 - e0), Xm = X(v.mx), Em = E(v.me);
  const tb = Math.tan(aB);
  // Intersection : P[1] + tb (X − P[0]) = Em + pv (X − Xm).
  const Xi = (Em - pv * Xm - P[1] + tb * P[0]) / (tb - pv);
  const sp = 10 ** (x0 + Xi * (x1 - x0));
  // Variante : intersection de la droite de recompression (deux premiers points) et de la vierge.
  const r = reg(charge.slice(0, 2));
  const xInt = (v.me - v.pente * v.mx - (r.me - r.pente * r.mx)) / (r.pente - v.pente);
  return {
    applicable: true, Cc, Cs, sp, spBilineaire: 10 ** xInt, pointCourbure: { sigma: 10 ** xC, e: vc.y }, pointProche: charge[iC], lissage: meilleur,
    vierge: { pente: v.pente, mx: v.mx, me: v.me }, recompression: { pente: r.pente, mx: r.mx, me: r.me },
    tangente: { x: xC, e: vc.y, pente: sl * (e1 - e0) / (x1 - x0) }, bissectrice: { pente: tb * (e1 - e0) / (x1 - x0) },
  };
}
