// Dépouillement pressiométrique : contrôle sur un essai de validation
// synthétique complet (étalonnages, 13 paliers, résultats attendus calculés à
// part avec γw = 9,81 kN/m³ et ν = 0,33), puis cohérence du générateur d'essais.
import test from "node:test";
import assert from "node:assert/strict";
import * as P from "../src/geotech/pressio.js";

const proche = (obtenu, attendu, tol, msg) =>
  assert.ok(Math.abs(obtenu - attendu) <= tol, `${msg} : obtenu ${obtenu}, attendu ${attendu} (± ${tol})`);

const TUBE = [[0.1, 62.0], [0.2, 121.5], [0.3, 160.3], [0.4, 176.8], [0.5, 181.9], [1.0, 185.3], [1.5, 187.7],
  [2.0, 190.5], [2.5, 192.9], [3.0, 195.6], [3.5, 198.3], [4.0, 200.7], [4.5, 203.4]].map(([p, V]) => ({ p, V }));
const AIR = [44, 101, 170, 247, 330, 412, 489, 558, 617, 668, 712, 751, 787, 820, 851, 880]
  .map((V, i) => ({ p: 0.0051 + 0.01 * i, V }));
const PALIERS = [
  [0.03, 73.9, 79.2, 84.6], [0.14, 106.7, 110.1, 113.6], [0.26, 131.4, 133.2, 135.0], [0.38, 149.9, 151.7, 153.5],
  [0.5, 168.5, 170.3, 172.1], [0.62, 187.1, 188.9, 190.7], [0.74, 206.0, 209.4, 212.9], [0.86, 256.2, 262.9, 269.7],
  [0.98, 365.0, 375.0, 385.0], [1.04, 448.8, 460.3, 471.7], [1.1, 553.3, 566.0, 578.8], [1.16, 669.7, 683.6, 697.5],
  [1.22, 785.1, 799.9, 814.6],
].map(([p, V15, V30, V60]) => ({ p, V15, V30, V60 }));
const SOL = { zw: 2, gamma: 19, gammaSat: 20, K0: 0.5 };

const calib = () => {
  const tube = P.calibrageAppareil(TUBE, { pmin: 1.0, di: 66, ls: 210 });
  const air = P.etalonnageSonde(AIR, { dz: 0.5, Vs: tube.Vs });
  return { tube, air };
};

test("étalonnages : a, Vc, Vs et pel", () => {
  const { tube, air } = calib();
  proche(tube.a, 5.1857, 5e-4, "a (cm³/MPa)");
  proche(tube.Vc, 180.04, 0.02, "Vc (cm³)");
  proche(tube.Vs, 538.41, 0.02, "Vs (cm³)");
  proche(air.pel, 0.0957, 1e-4, "pel (MPa)");
});

test("corrections : ph, volumes et pressions corrigés", () => {
  const { tube, air } = calib();
  const c = P.corrigerEssai(PALIERS, { z: 6, hc: 1, pe: air.pe, a: tube.a });
  proche(c[0].ph, 0.0687, 1e-4, "ph");
  const attendus = [[84.444, 0.0816], [112.874, 0.1869], [133.652, 0.3039], [151.529, 0.4213], [169.507, 0.5387],
    [187.485, 0.6564], [209.063, 0.7736], [265.240, 0.8865], [379.918, 0.9926], [466.307, 1.0416], [573.096, 1.0861],
    [691.485, 1.1233], [808.273, 1.1522]];
  c.forEach((q, i) => {
    proche(q.V, attendus[i][0], 0.01, `V corrigé, palier ${i + 1}`);
    proche(q.p, attendus[i][1], 2e-4, `p corrigée, palier ${i + 1}`);
  });
});

test("dépouillement complet : phase, EM, pf, pl lue, pressions nettes", () => {
  const { tube, air } = calib();
  const r = P.depouiller({ paliers: PALIERS, Vs: tube.Vs, z: 6, hc: 1, pe: air.pe, a: tube.a, sol: SOL, pel: air.pel });
  assert.equal(r.phase.i1, 2, "p1 au palier 3");
  assert.equal(r.phase.i2, 5, "p2 au palier 6");
  proche(r.EM, 12.17, 0.02, "EM (MPa)");
  proche(r.pf, 0.7169, 0.001, "pf (MPa)");
  assert.equal(r.limite.extrapolee, false);
  proche(r.limite.Vl, 805.72, 0.05, "Vl (cm³)");
  proche(r.pl, 1.1516, 0.001, "pl lue (MPa)");
  proche(r.p0 * 1000, 78.6, 0.1, "p0 (kPa)");
  proche(r.plNette, 1.073, 0.001, "pl* (MPa)");
  proche(r.pfNette, 0.638, 0.003, "pf* (MPa)");
  proche(r.rapport, 11.35, 0.05, "EM/pl*");
});

test("pl extrapolée : inverse du volume, hyperbole, la plus faible, règle des 20 %", () => {
  const { tube, air } = calib();
  const r = P.depouiller({ paliers: PALIERS.slice(0, 11), Vs: tube.Vs, z: 6, hc: 1, pe: air.pe, a: tube.a, sol: SOL });
  assert.equal(r.limite.extrapolee, true);
  proche(r.limite.inverse.pl, 1.1358, 0.002, "1/V");
  proche(r.limite.hyperbole.pl, 1.1070, 0.002, "hyperbole");
  proche(r.pl, 1.107, 0.002, "pl retenue");
  assert.ok(r.limite.ecart < 0.2);
});

// Le générateur n'a pas la forme exacte d'une hyperbole : quand l'essai s'arrête
// avant Vl, l'extrapolation (la plus faible des deux méthodes) reste prudente.
test("essais synthétiques : le dépouillement retrouve le sol de départ", () => {
  const pe = (V) => 0.05 * (1 - Math.exp(-V / 150)) + 0.00012 * V;
  for (const sol of [
    { p0: 0.05, pf: 0.35, pl: 0.6, EM: 4, z: 3, V1: 150 },
    { p0: 0.12, pf: 0.9, pl: 1.6, EM: 14, z: 8, V1: 120 },
    { p0: 0.25, pf: 1.8, pl: 3.2, EM: 40, z: 14, V1: 110 },
  ]) {
    const s = P.essaiSynthetique({ ...sol, pe, a: 4, hc: 1, vMax: 820 });
    const r = P.depouiller({ paliers: s.paliers, Vs: 535, z: sol.z, hc: 1, pe, a: 4 });
    proche(r.EM / sol.EM, 1, 0.05, `EM (${sol.EM} MPa)`);
    proche(r.pl / sol.pl, 1, 0.07, `pl (${sol.pl} MPa)`);
    proche(r.pf / sol.pf, 1, 0.12, `pf (${sol.pf} MPa)`);
  }
});
