// Terrain virtuel des bancs d'essai en place : les deux sites des sondages
// pressiométriques d'exemple (chapitre 3), qui répondent de façon cohérente à
// tous les essais. La base est la loi de pl* et de EM de chaque couche ; les
// autres mesures s'en déduisent par des rapports usuels selon la nature du sol
// (qc/pl*, rapport de frottement, Bq, qd/qc, qc/N60), avec une variabilité
// naturelle continue et reproductible. Ce n'est pas une corrélation de projet :
// c'est un terrain d'entraînement dont tous les essais racontent la même coupe.
import { SITES as SITES_PRESSIO } from "../pressio-exemples.js";
import { cptu } from "../geotech/essais.js";

export const GAMMA_W = 9.81;

/**
 * Rapports entre essais par nature de terrain : qc/pl*, Rf (%), Bq, qd/qc ;
 * pour les sols fins, sensibilité St, indice de plasticité Ip, indice de
 * rigidité Ir et coefficient de consolidation horizontal mesuré au piézocône
 * (m²/s), qui fixe la durée de dissipation.
 */
const NATURES = {
  remblai: { qcpl: 5, Rf: 1.6, Bq: 0, qdqc: 1.1 },
  argile: { qcpl: 2.2, Rf: 4.6, Bq: 0.55, qdqc: 1.35, St: 4, Ip: 38, Ir: 90, ch: 8e-7 },
  limon: { qcpl: 3.6, Rf: 2.8, Bq: 0.2, qdqc: 1.2, St: 2.5, Ip: 18, Ir: 150, ch: 4e-6 },
  sable: { qcpl: 6.5, Rf: 0.8, Bq: 0, qdqc: 1 },
  grave: { qcpl: 8, Rf: 0.6, Bq: 0, qdqc: 1 },
  marne: { qcpl: 3.4, Rf: 2.6, Bq: 0.05, qdqc: 1.25, St: 1.6, Ip: 25, Ir: 300, ch: 2e-5 },
  craie: { qcpl: 4.2, Rf: 1.3, Bq: 0, qdqc: 1.1 },
};
export const natureDe = (c) => NATURES[c.sol] ?? NATURES[c.nature] ?? NATURES.limon;
export const estFin = (c) => ["argile", "limon", "marne"].includes(c.sol);

export const SITES = Object.fromEntries(Object.entries(SITES_PRESSIO).map(([cle, s]) => [cle, {
  cle, nom: `Site ${cle} — ${s.nom}`, zw: s.zw, zMax: s.couches[s.couches.length - 1].z1,
  couches: s.couches.map((c) => ({ ...c, ...natureDe(c) })),
}]));

/** Bruit lisse et reproductible dans [−1, 1] : somme de sinusoïdes de phases fixées par le site. */
function bruitLisse(graine, frequences) {
  let s = graine;
  const phases = frequences.map(() => { s = (s * 16807) % 2147483647; return (s / 2147483647) * 2 * Math.PI; });
  const somme = frequences.reduce((a, [, p]) => a + p, 0);
  return (z) => frequences.reduce((a, [w, p], i) => a + p * Math.sin(w * z + phases[i]), 0) / somme;
}

/**
 * Le terrain d'un site : coupe, contraintes, et ce que chaque essai y mesure.
 * Toutes les fonctions prennent la profondeur z (m) sous le terrain naturel.
 */
export function terrain(cle = "A") {
  const site = SITES[cle] ?? SITES.A;
  const graine = cle === "B" ? 2024 : 1977;
  const lent = bruitLisse(graine, [[1.3, 0.5], [2.9, 0.3], [6.1, 0.2]]);
  const fin = bruitLisse(graine + 7, [[11, 0.4], [23, 0.35], [47, 0.25]]);
  const couche = (z) => site.couches.find((c) => z >= c.z0 && z < c.z1) ?? site.couches[site.couches.length - 1];
  const contraintes = (z) => {
    let sv = 0;
    for (const c of site.couches) {
      if (z <= c.z0) break;
      const h0 = c.z0, h1 = Math.min(z, c.z1);
      const sec = Math.max(0, Math.min(h1, site.zw) - h0), sat = (h1 - h0) - sec;
      sv += c.g * sec + c.gs * sat;
    }
    const u0 = GAMMA_W * Math.max(0, z - site.zw);
    return { sv, u0, svEff: Math.max(sv - u0, 1) };
  };
  /** Valeur « vraie » d'une couche, avec son gradient et la variabilité lente. */
  const base = (z, cle2, dcle) => { const c = couche(z); return (c[cle2] + (c[dcle] ?? 0) * (z - c.z0)) * (1 + 0.1 * lent(z)); };
  const plNette = (z) => base(z, "pl", "dpl");
  const EM = (z) => base(z, "EM", "dEM");
  /** Lissage sur ±10 cm : un cône voit une couche avant de l'atteindre. */
  const lisse = (f, z, h = 0.1) => (f(Math.max(z - h, 0)) + 2 * f(z) + f(z + h)) / 4;
  const qcBrut = (z) => natureDe(couche(z)).qcpl * plNette(z) * (1 + 0.14 * fin(z));
  const qc = (z) => Math.max(0.12, lisse(qcBrut, z));
  const Rf = (z) => lisse((x) => natureDe(couche(x)).Rf, z) * (1 + 0.18 * fin(z * 1.37 + 3));
  const fs = (z) => (Rf(z) / 100) * qc(z) * 1000;
  /** u2 = u0 + Bq (qt − σv0), avec qt = qc + (1 − a) u2 (a = 0,8). */
  const u2 = (z) => {
    const { sv, u0 } = contraintes(z), Bq = lisse((x) => natureDe(couche(x)).Bq, z), a = 0.8;
    return Math.max(0, (u0 + Bq * (qc(z) * 1000 - sv)) / (1 - Bq * (1 - a)));
  };
  const lectureCPTU = (z) => {
    const { sv, u0, svEff } = contraintes(z);
    const q = qc(z), f = fs(z), u = u2(z);
    return { z, qc: q, fs: f, u2: u, u0, sv, svEff, interp: cptu({ qc: q, fs: f, u2: u, sigmaV0: sv, u0, sigmaV0eff: svEff }) };
  };
  /** N60 par le rapport de Robertson (qc/pa)/N60 = 8,5 (1 − Ic/4,6). */
  const N60 = (z) => {
    const l = lectureCPTU(z), Ic = l.interp.applicable ? Math.min(l.interp.Ic, 3.8) : 2.6;
    return Math.max(1, ((l.qc * 1000) / 100) / (8.5 * (1 - Ic / 4.6)));
  };
  /** Résistance dynamique de pointe (MPa) : qc, majorée dans les sols fins sous la nappe. */
  const qd = (z) => natureDe(couche(z)).qdqc * qc(z) * (1 + 0.1 * fin(z * 0.73 + 1));
  /** Cohésion non drainée d'un sol fin (kPa) : (qt − σv0)/Nkt, le terrain prenant Nkt = 16. */
  const cu = (z) => {
    const l = lectureCPTU(z);
    return Math.max(5, (l.qc * 1000 + 0.2 * l.u2 - l.sv) / 16);
  };
  return { site, couche, contraintes, plNette, EM, qc, fs, u2, lectureCPTU, N60, qd, cu, bruitFin: fin };
}
