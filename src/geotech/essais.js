// Dépouillement des essais en place autres que le pressiomètre : pénétromètres
// statique (CPT, CPTU) et dynamique, SPT, dilatomètre plat, scissomètre, plaque,
// chargement de pieu (fluage), carottage (RQD), essais d'eau (piézomètre,
// Lefranc, Lugeon, pompage), sismique réfraction et Vs,30.
//
// Unités : longueurs en m (dimensions d'appareil en mm quand l'usage le veut,
// signalées), contraintes du sol en kPa, qc et qd en MPa, perméabilités en m/s.

import { horsDomaine } from "./outils.js";

const log10 = Math.log10;
export const PA = 100; // pression atmosphérique de référence (kPa)

// ───────────────────────────── Piézocône CPTU ─────────────────────────────

/** Zones de comportement de Robertson (1990) repérées par l'indice Ic (Robertson et Wride, 1998). */
export const ZONES_IC = [
  { max: 1.31, zone: 7, nom: "sable graveleux à sable dense" },
  { max: 2.05, zone: 6, nom: "sable propre à sable limoneux" },
  { max: 2.6, zone: 5, nom: "mélange sableux : sable limoneux à limon sableux" },
  { max: 2.95, zone: 4, nom: "mélange limoneux : limon argileux à argile limoneuse" },
  { max: 3.6, zone: 3, nom: "argile : argile limoneuse à argile" },
  { max: Infinity, zone: 2, nom: "sol organique, tourbe" },
];

/**
 * Dépouillement d'une mesure CPTU. qc en MPa, fs et u2 en kPa, contraintes en
 * kPa, a = Au/Ac (rapport de surfaces du cône). Renvoie qt (kPa), Rf (%),
 * Qt, Fr (%), Bq et l'indice de comportement Ic avec sa zone.
 */
export function cptu({ qc, fs, u2 = null, a = 0.8, sigmaV0, u0 = 0, sigmaV0eff }) {
  if (!(qc > 0 && fs >= 0 && sigmaV0eff > 0)) return horsDomaine("qc, fs et σ'v0 doivent être positifs");
  const avecU = Number.isFinite(u2);
  const qt = qc * 1000 + (avecU ? (1 - a) * u2 : 0);
  const qn = qt - sigmaV0;
  if (!(qn > 0)) return horsDomaine("qt − σv0 ≤ 0 : mesure à revoir");
  const Qt = qn / sigmaV0eff;
  const Fr = (100 * fs) / qn;
  const Bq = avecU ? (u2 - u0) / qn : null;
  const Ic = Math.sqrt((3.47 - log10(Qt)) ** 2 + (log10(Math.max(Fr, 1e-3)) + 1.22) ** 2);
  const z = ZONES_IC.find((x) => Ic < x.max);
  return { applicable: true, qt, qn, Rf: (100 * fs) / (qc * 1000), Qt, Fr, Bq, Ic, zone: z.zone, nomZone: z.nom, u: avecU };
}

/** cu d'une argile au piézocône : (qt − σv0)/Nkt, Nkt de 10 à 20 (14 par défaut). kPa. */
export const cuCPTU = ({ qt, sigmaV0, Nkt = 14 }) => (qt - sigmaV0) / Nkt;

/**
 * Dissipation : t50 est le temps où la surpression u − u0 a perdu la moitié de
 * sa valeur à l'arrêt. mesures [{ t (s), u (kPa) }] ; interpolation en log t.
 */
export function t50Dissipation(mesures, u0) {
  const m = mesures.filter((q) => q.t > 0 && Number.isFinite(q.u)).sort((a, b) => a.t - b.t);
  if (m.length < 2) return horsDomaine("il faut au moins deux mesures");
  const ui = m[0].u, cible = u0 + 0.5 * (ui - u0);
  for (let i = 1; i < m.length; i++) {
    if ((m[i - 1].u - cible) * (m[i].u - cible) <= 0) {
      const f = (cible - m[i - 1].u) / (m[i].u - m[i - 1].u);
      return { applicable: true, t50: 10 ** (log10(m[i - 1].t) + f * (log10(m[i].t) - log10(m[i - 1].t))), cible };
    }
  }
  return horsDomaine("la surpression n'est pas encore redescendue à moitié", { cible });
}

// ─────────────────────────────────── SPT ──────────────────────────────────

/** Coefficients de correction usuels (Robertson et Wride ; NF EN 1998-5 annexe B pour CN). */
export const SPT = {
  energie: { donut: 0.75, securite: 0.9, automatique: 1.2 },
  diametre: (Dmm) => (Dmm <= 115 ? 1 : Dmm <= 150 ? 1.05 : 1.15),
  tiges: (L) => (L < 3 ? 0.75 : L < 4 ? 0.75 : L < 6 ? 0.85 : L < 10 ? 0.95 : 1),
};

/**
 * Nombre de coups corrigé : N60 = N·CE·CB·CR·CS (énergie ramenée à 60 % de
 * l'énergie théorique), puis (N1)60 = CN·N60 avec CN = √(100/σ'v0) borné à
 * [0,5 ; 2] (NF EN 1998-5, annexe B).
 */
export function sptCorrige({ N, sigmaV0eff, CE = 1, CB = 1, CR = 1, CS = 1 }) {
  if (!(N >= 0 && sigmaV0eff > 0)) return horsDomaine("N et σ'v0 doivent être positifs");
  const N60 = N * CE * CB * CR * CS;
  const CN = Math.min(2, Math.max(0.5, Math.sqrt(PA / sigmaV0eff)));
  return { applicable: true, N60, CN, N160: CN * N60 };
}

/** Trois corrélations de φ' (sables) : leur écart montre ce que vaut une corrélation. */
export function phiSPT({ N60, N160, sigmaV0eff }) {
  return {
    wolff: 27.1 + 0.3 * N60 - 0.00054 * N60 ** 2,
    kulhawyMayne: (Math.atan((N60 / (12.2 + (20.3 * sigmaV0eff) / PA)) ** 0.34) * 180) / Math.PI,
    hatanakaUchida: Math.sqrt(20 * N160) + 20,
  };
}

/** Densité relative (Skempton) : Dr ≈ √((N1)60 / 60). */
export const drSPT = (N160) => Math.min(1, Math.sqrt(Math.max(N160, 0) / 60));

/** Compacité d'un sable d'après N (Terzaghi et Peck). */
export function compaciteSPT(N) {
  return N < 4 ? "très lâche" : N < 10 ? "lâche" : N < 30 ? "moyennement dense" : N < 50 ? "dense" : "très dense";
}

// ─────────────────────────── Pénétromètre dynamique ───────────────────────

/**
 * Résistance dynamique de pointe par la formule des Hollandais :
 * qd = M² g H / [(M + M')·A·e], e = h/N (enfoncement moyen par coup).
 * M, M' en kg ; H en m ; A en cm² ; h en cm pour N coups. Renvoie qd en MPa.
 */
export function qdHollandais({ M, Mp, H, Acm2, N, hcm = 10, g = 9.81 }) {
  if (!(M > 0 && H > 0 && Acm2 > 0 && N > 0)) return horsDomaine("masse, hauteur de chute, section et nombre de coups doivent être positifs");
  const e = hcm / 100 / N;
  const qd = (M * M * g * H) / ((M + Mp) * (Acm2 / 1e4) * e) / 1e6;
  return { applicable: true, qd, e, energie: M * g * H, rendement: M / (M + Mp) };
}

// ───────────────────────────── Dilatomètre plat ───────────────────────────

/**
 * Dépouillement DMT (Marchetti). Lectures A, B (kPa), corrections de
 * membrane ΔA, ΔB, zéro du manomètre zM ; u0 et σ'v0 en kPa.
 */
export function dmt({ A, B, dA = 15, dB = 40, zM = 0, u0 = 0, sigmaV0eff }) {
  const p0 = 1.05 * (A - zM + dA) - 0.05 * (B - zM - dB);
  const p1 = B - zM - dB;
  if (!(p1 > p0 && p0 > u0 && sigmaV0eff > 0)) return horsDomaine("lectures incohérentes : il faut p1 > p0 > u0");
  const ID = (p1 - p0) / (p0 - u0);
  const KD = (p0 - u0) / sigmaV0eff;
  const ED = 34.7 * (p1 - p0) / 1000; // MPa
  const lk = log10(KD);
  let RM;
  if (ID <= 0.6) RM = 0.14 + 2.36 * lk;
  else if (ID >= 3) RM = 0.5 + 2 * lk;
  else { const R0 = 0.14 + 0.15 * (ID - 0.6); RM = R0 + (2.5 - R0) * lk; }
  if (KD > 10) RM = 0.32 + 2.18 * lk;
  RM = Math.max(RM, 0.85);
  const sol = ID < 0.6 ? "argile" : ID < 1.8 ? "limon" : "sable";
  const r = { applicable: true, p0, p1, ID, KD, ED, RM, M: RM * ED, sol };
  if (ID < 1.2) {
    r.K0 = (KD / 1.5) ** 0.47 - 0.6;
    r.OCR = (0.5 * KD) ** 1.56;
    r.cu = 0.22 * sigmaV0eff * (0.5 * KD) ** 1.25;
  }
  if (ID > 1.8) r.phi = 28 + 14.6 * lk - 2.1 * lk * lk;
  return r;
}

// ─────────────────────────────── Scissomètre ──────────────────────────────

/**
 * Constante du moulinet : couple = cu·K, cisaillement uniforme sur le
 * cylindre et ses deux bases : K = πD²H/2 + πD³/6 (m³ ; D, H en mm à l'entrée).
 */
export const constanteMoulinet = (Dmm, Hmm) => (Math.PI * (Dmm / 1000) ** 2 * (Hmm / 1000)) / 2 + (Math.PI * (Dmm / 1000) ** 3) / 6;

/**
 * cu au scissomètre (kPa) à partir du couple maximal M (N·m), cr du couple
 * résiduel ; correction de Bjerrum μ = 1,7 − 0,54 log Ip (bornée à [0,6 ; 1,2]).
 */
export function scissometre({ M, Mres = null, Dmm = 70, Hmm = 140, K = null, Ip = null }) {
  const k = K ?? constanteMoulinet(Dmm, Hmm);
  if (!(M > 0 && k > 0)) return horsDomaine("couple et géométrie doivent être positifs");
  const cu = M / k / 1000;
  const cr = Mres > 0 ? Mres / k / 1000 : null;
  const mu = Ip > 0 ? Math.min(1.2, Math.max(0.6, 1.7 - 0.54 * log10(Ip))) : null;
  return { applicable: true, K: k, cu, cr, St: cr ? cu / cr : null, mu, cuCorrige: mu ? mu * cu : null };
}

/** Droite de Coulomb τ = c + σ tanφ ajustée sur des couples (σ, τ) (boîte en place, phicomètre). */
export function droiteCoulomb(points) {
  const n = points.length;
  if (n < 2) return horsDomaine("il faut au moins deux couples (σ, τ)");
  const mx = points.reduce((s, p) => s + p.sigma, 0) / n, my = points.reduce((s, p) => s + p.tau, 0) / n;
  let sxx = 0, sxy = 0;
  for (const p of points) { sxx += (p.sigma - mx) ** 2; sxy += (p.sigma - mx) * (p.tau - my); }
  if (!(sxx > 0)) return horsDomaine("il faut au moins deux contraintes normales différentes");
  const t = sxy / sxx;
  return { applicable: true, c: my - t * mx, phi: (Math.atan(t) * 180) / Math.PI };
}

// ─────────────────────────────────── Plaque ───────────────────────────────

/** Classes de plate-forme selon EV2 (MPa). */
export const CLASSES_PF = [
  { min: 200, nom: "PF4" }, { min: 120, nom: "PF3" }, { min: 50, nom: "PF2" }, { min: 20, nom: "PF1" }, { min: 0, nom: "inutilisable" },
];

/**
 * Essai de plaque à deux cycles (NF P94-117-1, plaque Ø 600 mm) :
 * EV = 1,5·p·R/s, soit EV1 = 112,5/z1 (p = 0,25 MPa) et EV2 = 90/z2
 * (p = 0,20 MPa), z en mm, EV en MPa ; k = EV2/EV1 juge le compactage.
 */
export function plaqueEV({ z1, z2, R = 300, p1 = 0.25, p2 = 0.2 }) {
  if (!(z1 > 0 && z2 > 0)) return horsDomaine("les enfoncements doivent être positifs");
  const EV1 = (1.5 * p1 * R) / z1, EV2 = (1.5 * p2 * R) / z2;
  const k = EV2 / EV1;
  return { applicable: true, EV1, EV2, k, classe: CLASSES_PF.find((c) => EV2 >= c.min).nom, compactage: k <= 2 ? (k <= 1.2 ? "très bon" : "correct") : "insuffisant" };
}

/** Tassement d'une semelle de largeur B (m) extrapolé de celui d'une plaque (Terzaghi–Peck, sables). */
export const plaqueVersSemelle = ({ s1, B }) => s1 * ((2 * B) / (B + 0.3)) ** 2;

// ─────────────────────────── Chargement de pieu ───────────────────────────

/**
 * Charge de fluage d'un essai de pieu (NF P94-150-1) : sur chaque palier, le
 * fluage an = s60 − s30 ; la courbe an(Q) présente deux branches droites dont
 * l'intersection donne Qc. paliers [{ Q (kN), s30, s60 (mm) }].
 */
export function chargeFluagePieu(paliers, { nBas = null } = {}) {
  const p = paliers.filter((q) => Number.isFinite(q.Q) && Number.isFinite(q.s30) && Number.isFinite(q.s60)).sort((a, b) => a.Q - b.Q)
    .map((q) => ({ ...q, an: q.s60 - q.s30 }));
  if (p.length < 4) return horsDomaine("il faut au moins quatre paliers");
  // Coupure : on essaie chaque partage et on garde celui qui ajuste le mieux les deux droites.
  const droite = (pts) => {
    const n = pts.length, mx = pts.reduce((s, q) => s + q.Q, 0) / n, my = pts.reduce((s, q) => s + q.an, 0) / n;
    let sxx = 0, sxy = 0;
    for (const q of pts) { sxx += (q.Q - mx) ** 2; sxy += (q.Q - mx) * (q.an - my); }
    const b = sxx > 0 ? sxy / sxx : 0, a = my - b * mx;
    return { a, b, res: pts.reduce((s, q) => s + (q.an - a - b * q.Q) ** 2, 0) };
  };
  let meilleur = null;
  const debut = nBas ? nBas : 2;
  for (let k = debut; k <= (nBas ?? p.length - 2); k++) {
    const d1 = droite(p.slice(0, k)), d2 = droite(p.slice(k));
    if (!(d2.b > d1.b)) continue;
    const res = d1.res + d2.res;
    if (!meilleur || res < meilleur.res) meilleur = { k, d1, d2, res };
  }
  if (!meilleur) return horsDomaine("pas de changement de pente du fluage : Qc non atteinte");
  const Qc = (meilleur.d1.a - meilleur.d2.a) / (meilleur.d2.b - meilleur.d1.b);
  return { applicable: true, Qc, paliers: p, coupure: meilleur.k, d1: meilleur.d1, d2: meilleur.d2 };
}

// ─────────────────────────────────── RQD ──────────────────────────────────

/** Rock Quality Designation : part (%) de la passe en morceaux d'au moins 10 cm. longueurs en cm. */
export function rqd(morceaux, longueurPasse) {
  if (!(longueurPasse > 0)) return horsDomaine("longueur de passe nulle");
  const somme = morceaux.filter((l) => l >= 10).reduce((s, l) => s + l, 0);
  const v = (100 * somme) / longueurPasse;
  const qualite = v < 25 ? "très mauvaise" : v < 50 ? "mauvaise" : v < 75 ? "moyenne" : v < 90 ? "bonne" : "excellente";
  return { applicable: true, RQD: v, qualite, recuperation: (100 * morceaux.reduce((s, l) => s + l, 0)) / longueurPasse };
}

// ─────────────────────────────── Essais d'eau ─────────────────────────────

/**
 * Facteur de forme d'une cavité cylindrique de longueur L et de diamètre D
 * dans un milieu isotrope (Hvorslev) : F = 2πL / ln[L/D + √(1 + (L/D)²)].
 * Débit de l'essai Lefranc : Q = F·k·h ; m = F/D est le coefficient de forme.
 */
export const facteurForme = (L, D) => (2 * Math.PI * L) / Math.log(L / D + Math.sqrt(1 + (L / D) ** 2));

/** Lefranc à charge constante : k = Q/(F·h). Q en m³/s, h en m. */
export function lefrancConstant({ Q, h, L, D }) {
  const F = facteurForme(L, D);
  if (!(Q > 0 && h > 0)) return horsDomaine("débit et charge doivent être positifs");
  return { applicable: true, k: Q / (F * h), F, m: F / D };
}

/** Lefranc à charge variable : k = S·ln(h1/h2) / [F·(t2 − t1)], S section du tube (m²). */
export function lefrancVariable({ S, h1, h2, dt, L, D }) {
  const F = facteurForme(L, D);
  if (!(h1 > h2 && h2 > 0 && dt > 0)) return horsDomaine("il faut h1 > h2 > 0 et une durée positive");
  return { applicable: true, k: (S * Math.log(h1 / h2)) / (F * dt), F, m: F / D };
}

/**
 * Essai Lugeon : pression effective sur la passe pj = pm + γw·hw − Δpc (MPa),
 * hw étant la colonne d'eau du manomètre (à hm au-dessus du sol) jusqu'à la
 * nappe, ou jusqu'au milieu de la passe si celle-ci est hors nappe ; unité
 * Lugeon = débit (L/min) par mètre de passe, ramené à 1 MPa.
 * paliers [{ p (MPa au manomètre), Q (L/min) }].
 */
export function lugeon({ paliers, L, hauteurManometre = 0, profondeurNappe = Infinity, profondeurPasse, pertes = 0 }) {
  if (!(L > 0) || !paliers.length) return horsDomaine("longueur de passe et paliers requis");
  const hEau = (hauteurManometre + Math.min(profondeurNappe, profondeurPasse)) * 0.00981;
  const res = paliers.map((q) => {
    const pj = q.p + hEau - pertes;
    return { ...q, pj, UL: q.Q / L / pj };
  });
  const max = res.reduce((m, q) => (q.pj > m.pj ? q : m), res[0]);
  return { applicable: true, paliers: res, UL: max.UL, k: max.UL * 1.3e-7 };
}

/** Temps de réponse d'un piézomètre (Hvorslev) : T0 = A/(F·k), t90 = T0·ln 10. A section du tube (m²). */
export function tempsReponsePiezometre({ dTube, L, D, k }) {
  const A = (Math.PI * dTube * dTube) / 4, F = facteurForme(L, D);
  const T0 = A / (F * k);
  return { applicable: true, A, F, T0, t90: T0 * Math.log(10) };
}

/** Fonction de puits de Theis W(u) (série, u < 5). */
export function Wtheis(u) {
  if (u >= 5) return Math.exp(-u) / u * (1 - 1 / u + 2 / (u * u));
  let s = -0.5772156649 - Math.log(u), terme = u;
  for (let n = 1; n < 60; n++) {
    s += ((n % 2 ? 1 : -1) * terme) / n;
    terme *= u / (n + 1);
    if (Math.abs(terme) < 1e-14) break;
  }
  return s;
}

/**
 * Thiem (régime permanent, nappe captive) : deux piézomètres à r1 < r2
 * rabattus de s1 > s2 → T = Q ln(r2/r1) / [2π(s1 − s2)], rayon d'action R où
 * le rabattement s'annule. H épaisseur de l'aquifère pour k = T/H.
 */
export function thiem({ Q, r1, s1, r2, s2, H = null }) {
  if (!(r2 > r1 && s1 > s2 && Q > 0)) return horsDomaine("il faut r2 > r1 et s1 > s2");
  const T = (Q * Math.log(r2 / r1)) / (2 * Math.PI * (s1 - s2));
  const R = r1 * Math.exp((2 * Math.PI * T * s1) / Q);
  return { applicable: true, T, R, k: H > 0 ? T / H : null };
}

/**
 * Jacob (régime transitoire, u < 0,05) : le rabattement croît d'une même
 * quantité Δs par cycle logarithmique du temps : T = 0,183 Q/Δs, et la droite
 * coupe s = 0 à t0 : S = 2,25 T t0/r². t0 en s.
 */
export function jacob({ Q, ds, t0, r }) {
  if (!(Q > 0 && ds > 0 && t0 > 0 && r > 0)) return horsDomaine("Q, Δs, t0 et r doivent être positifs");
  const T = (0.183 * Q) / ds;
  const S = (2.25 * T * t0) / (r * r);
  return { applicable: true, T, S, uMax: (r * r * S) / (4 * T * t0) };
}

// ─────────────────────────────── Géophysique ──────────────────────────────

/**
 * Sismique réfraction à deux couches : vitesses V1 < V2 (m/s) lues sur les
 * pentes de l'hodochrone, épaisseur de la couche superficielle par la distance
 * critique xc (m) ou par le temps d'intercept ti (s).
 */
export function refraction({ V1, V2, xc = null, ti = null }) {
  if (!(V2 > V1 && V1 > 0)) return horsDomaine("la réfraction exige V2 > V1");
  const hX = xc > 0 ? (xc / 2) * Math.sqrt((V2 - V1) / (V2 + V1)) : null;
  const hT = ti > 0 ? (ti * V1 * V2) / (2 * Math.sqrt(V2 * V2 - V1 * V1)) : null;
  return { applicable: true, hX, hT, ic: (Math.asin(V1 / V2) * 180) / Math.PI };
}

/** Vs,30 = 30 / Σ(hi/Vsi) sur les 30 premiers mètres, et classe de sol de la NF EN 1998-1 (2005). */
export function vs30(couches) {
  let z = 0, t = 0;
  for (const c of couches) {
    if (z >= 30) break;
    const h = Math.min(c.h, 30 - z);
    t += h / c.Vs; z += h;
  }
  if (z < 30) {
    const der = couches[couches.length - 1];
    t += (30 - z) / der.Vs;
  }
  const v = 30 / t;
  const classe = v > 800 ? "A" : v > 360 ? "B" : v > 180 ? "C" : "D";
  return { applicable: true, Vs30: v, classe };
}
