// Jeux d'exemple du dépouillement pressiométrique : étalonnages d'une sonde,
// essais complets et sondages entiers. Tout est fabriqué ici — l'essai du
// limon est un cas de validation construit pour le cours, les autres sont
// générés par le modèle d'essai synthétique avec une graine fixe — et sert au
// cours (chapitre 3), aux exercices et au bureau de calcul.

import * as P from "./geotech/pressio.js";
import { creerAlea } from "./exos/alea.js";

/** Sonde Ø 58 mm dans un tube d'étalonnage de 66 mm, cellule centrale de 210 mm. */
export const SONDE = { di: 66, ls: 210, dzAir: 0.5, pminTube: 1 };

/** Dilatation de l'appareillage, en tube d'acier : [pr (MPa), Vr (cm³)]. */
export const TUBE = [[0.1, 62.0], [0.2, 121.5], [0.3, 160.3], [0.4, 176.8], [0.5, 181.9], [1.0, 185.3], [1.5, 187.7],
  [2.0, 190.5], [2.5, 192.9], [3.0, 195.6], [3.5, 198.3], [4.0, 200.7], [4.5, 203.4]];

/** Résistance propre de la sonde, à l'air libre : [pr (MPa), V60 (cm³)]. */
export const AIR = [44, 101, 170, 247, 330, 412, 489, 558, 617, 668, 712, 751, 787, 820, 851, 880]
  .map((V, i) => [+(0.0051 + 0.01 * i).toFixed(4), V]);

/** Limon à 6 m : [pr, V15, V30, V60] — l'essai de validation du dépouillement. */
const LIMON = [[0.03, 73.9, 79.2, 84.6], [0.14, 106.7, 110.1, 113.6], [0.26, 131.4, 133.2, 135.0], [0.38, 149.9, 151.7, 153.5],
  [0.5, 168.5, 170.3, 172.1], [0.62, 187.1, 188.9, 190.7], [0.74, 206.0, 209.4, 212.9], [0.86, 256.2, 262.9, 269.7],
  [0.98, 365.0, 375.0, 385.0], [1.04, 448.8, 460.3, 471.7], [1.1, 553.3, 566.0, 578.8], [1.16, 669.7, 683.6, 697.5],
  [1.22, 785.1, 799.9, 814.6]];

/** Étalonnages de la sonde d'exemple, prêts à l'emploi (conventions de la norme). */
export function etalonnagesExemple() {
  const tube = P.calibrageAppareil(TUBE.map(([p, V]) => ({ p, V })), { pmin: SONDE.pminTube, di: SONDE.di, ls: SONDE.ls });
  const air = P.etalonnageSonde(AIR.map(([p, V]) => ({ p, V })), { dz: SONDE.dzAir, Vs: tube.Vs });
  return { tube, air, Vs: tube.Vs, a: tube.a, pe: air.pe };
}

const ligne = (q) => [q.p, q.V15, q.V30, q.V60].map((x) => (Number.isFinite(x) ? String(+x.toFixed(3)) : "")).join(" ");

/**
 * Relevés synthétiques d'un sol donné, lus avec la sonde d'exemple.
 * sol : { z, zw, gamma, gammaSat, K0, plNette, pfNette, EM, V1 } (MPa, cm³).
 */
export function essaiDeSol(sol, graine = 1) {
  const { pe, a, Vs } = etalonnagesExemple();
  const c = P.contraintesEssai({ z: sol.z, zw: sol.zw, gamma: sol.gamma, gammaSat: sol.gammaSat, couches: sol.couches ?? null });
  const p0 = P.pressionRepos({ sigmaVeff: c.sigmaVeff, u: c.u, K0: sol.K0 ?? 0.5 });
  const alea = creerAlea(graine);
  const s = P.essaiSynthetique({
    Vs, V1: sol.V1 ?? 130, p0, pf: p0 + sol.pfNette, pl: p0 + sol.plNette, EM: sol.EM, z: sol.z, hc: sol.hc ?? 1,
    pe, a, vMax: sol.vMax ?? 820, fluageE: sol.fluage ?? 1.8, alea: alea.reel, bruit: sol.bruit ?? 0.6,
  });
  return s.paliers;
}

/** Essais du dépouillement pas à pas : contexte et relevés. */
export const ESSAIS = {
  limon: {
    nom: "Limon à 6 m", contexte: { z: 6, hc: 1, zw: 2, gamma: 19, gammaSat: 20, K0: 0.5, nature: "limon" },
    paliers: () => LIMON.map(([p, V15, V30, V60]) => ({ p, V15, V30, V60 })),
  },
  tronque: {
    nom: "Limon à 6 m, arrêté au 11e palier", contexte: { z: 6, hc: 1, zw: 2, gamma: 19, gammaSat: 20, K0: 0.5, nature: "limon" },
    paliers: () => LIMON.slice(0, 11).map(([p, V15, V30, V60]) => ({ p, V15, V30, V60 })),
  },
  argile: {
    nom: "Argile molle à 4 m", contexte: { z: 4, hc: 1, zw: 1, gamma: 17, gammaSat: 17.5, K0: 0.5, nature: "argile" },
    paliers: () => essaiDeSol({ z: 4, zw: 1, gamma: 17, gammaSat: 17.5, plNette: 0.32, pfNette: 0.2, EM: 3.4, V1: 150 }, 41),
  },
  marne: {
    nom: "Marne raide à 12 m", contexte: { z: 12, hc: 1, zw: 3, gamma: 20, gammaSat: 21, K0: 0.5, nature: "argile" },
    paliers: () => essaiDeSol({ z: 12, zw: 3, gamma: 20, gammaSat: 21, plNette: 2.9, pfNette: 1.7, EM: 46, V1: 118 }, 12),
  },
};

/** Relevés au format texte des zones de saisie (une ligne par palier). */
export const texteReleves = (paliers) => paliers.map(ligne).join("\n");
export const texteCouples = (couples) => couples.map(([x, y]) => `${x} ${y}`).join("\n");

/**
 * Sondages d'exemple : une coupe, et pour chaque couche la loi de ses
 * paramètres avec la profondeur ; un essai par mètre.
 */
const SITES = {
  A: {
    nom: "remblai, argile molle, sable, marne", zw: 2.4,
    couches: [
      { z0: 0, z1: 2.2, sol: "remblai", nom: "remblai sablo-argileux", nature: "sable", g: 18, gs: 19, EM: 6, pl: 0.55, r: 0.6 },
      { z0: 2.2, z1: 7.5, sol: "argile", nom: "argile molle grise", nature: "argile", g: 17, gs: 17.5, EM: 3.2, pl: 0.3, r: 0.62, dEM: 0.25, dpl: 0.025 },
      { z0: 7.5, z1: 13, sol: "sable", nom: "sable moyen compact", nature: "sable", g: 19, gs: 20, EM: 16, pl: 1.5, r: 0.58, dEM: 0.8, dpl: 0.06 },
      { z0: 13, z1: 19, sol: "marne", nom: "marne raide", nature: "argile", g: 20, gs: 21, EM: 42, pl: 2.8, r: 0.6, dEM: 2, dpl: 0.12 },
    ],
  },
  B: {
    nom: "limon, grave compacte, craie altérée", zw: 5,
    couches: [
      { z0: 0, z1: 3.5, sol: "limon", nom: "limon brun sableux", nature: "limon", g: 18, gs: 19, EM: 7, pl: 0.7, r: 0.6, dEM: 0.4, dpl: 0.04 },
      { z0: 3.5, z1: 9, sol: "grave", nom: "grave sableuse compacte", nature: "grave", g: 20, gs: 21, EM: 28, pl: 2.6, r: 0.55, dEM: 1.2, dpl: 0.08 },
      { z0: 9, z1: 16, sol: "craie", nom: "craie blanche altérée", nature: "argile", g: 18, gs: 19, EM: 18, pl: 1.6, r: 0.62, dEM: 1.5, dpl: 0.1 },
    ],
  },
};

export const listeSondages = () => Object.entries(SITES).map(([cle, s]) => ({ cle, nom: s.nom }));

/** Un sondage : coupe, niveau d'eau et relevés bruts de chaque essai (un par mètre). */
export function sondage(cle) {
  const site = SITES[cle] ?? SITES.A;
  const bas = site.couches[site.couches.length - 1].z1;
  const alea = creerAlea(cle === "B" ? 2024 : 1977);
  const poids = site.couches.map((c) => ({ z0: c.z0, z1: c.z1, gamma: c.g, gammaSat: c.gs }));
  const essais = [];
  for (let z = 1; z < bas - 0.4; z += 1) {
    const c = site.couches.find((k) => z >= k.z0 && z < k.z1);
    const dz = z - c.z0;
    // Dispersion naturelle d'un essai à l'autre : ± 12 % sur EM et pl*.
    const var1 = 1 + 0.24 * (alea.reel() - 0.5), var2 = 1 + 0.24 * (alea.reel() - 0.5);
    const EM = (c.EM + (c.dEM ?? 0) * dz) * var1;
    const plNette = (c.pl + (c.dpl ?? 0) * dz) * var2;
    const sol = { z, zw: site.zw, couches: poids, plNette, pfNette: c.r * plNette, EM, V1: 110 + 40 * alea.reel() };
    essais.push({ z, couche: c.nom, nature: c.nature, sol: c.sol, paliers: essaiDeSol(sol, 7919 * z + (cle === "B" ? 3 : 1)) });
  }
  return { nom: site.nom, zw: site.zw, poids, couches: site.couches.map(({ z0, z1, sol, nom, nature }) => ({ z0, z1, sol, nom, nature })), essais };
}
