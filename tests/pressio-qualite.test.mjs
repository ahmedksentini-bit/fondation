// Contrôle qualité du dépouillement pressiométrique : l'essai de validation
// passe tous les contrôles normatifs ; un essai tronqué, sans lecture à 30 s,
// ou dépouillé sur une plage qui déborde dans la phase plastique est signalé ;
// tous les contrôles sont rendus, qu'ils passent ou non.
import test from "node:test";
import assert from "node:assert/strict";
import * as P from "../src/geotech/pressio.js";
import { controlerEssai, controlerAppareillage, bilanControles } from "../src/geotech/pressio-qualite.js";

const TUBE = [[0.1, 62.0], [0.2, 121.5], [0.3, 160.3], [0.4, 176.8], [0.5, 181.9], [1.0, 185.3], [1.5, 187.7],
  [2.0, 190.5], [2.5, 192.9], [3.0, 195.6], [3.5, 198.3], [4.0, 200.7], [4.5, 203.4]].map(([p, V]) => ({ p, V }));
const AIR = [44, 101, 170, 247, 330, 412, 489, 558, 617, 668, 712, 751, 787, 820, 851, 880].map((V, i) => ({ p: 0.0051 + 0.01 * i, V }));
const PALIERS = [
  [0.03, 73.9, 79.2, 84.6], [0.14, 106.7, 110.1, 113.6], [0.26, 131.4, 133.2, 135.0], [0.38, 149.9, 151.7, 153.5],
  [0.5, 168.5, 170.3, 172.1], [0.62, 187.1, 188.9, 190.7], [0.74, 206.0, 209.4, 212.9], [0.86, 256.2, 262.9, 269.7],
  [0.98, 365.0, 375.0, 385.0], [1.04, 448.8, 460.3, 471.7], [1.1, 553.3, 566.0, 578.8], [1.16, 669.7, 683.6, 697.5],
  [1.22, 785.1, 799.9, 814.6],
].map(([p, V15, V30, V60]) => ({ p, V15, V30, V60 }));
const SOL = { zw: 2, gamma: 19, gammaSat: 20, K0: 0.5 };
const tube = P.calibrageAppareil(TUBE, { pmin: 1.0, di: 66, ls: 210 });
const air = P.etalonnageSonde(AIR, { dz: 0.5, Vs: tube.Vs });
const essai = (paliers, choix = {}) => {
  const r = P.depouiller({ paliers, Vs: tube.Vs, z: 6, hc: 1, pe: air.pe, a: tube.a, sol: SOL, pel: air.pel, choix });
  return { r, qc: controlerEssai({ r, paliers, Vs: tube.Vs, pel: air.pel, z: 6, voisins: [5, 7] }) };
};
const statut = (qc, id) => qc.find((c) => c.id === id)?.statut;

test("contrôle qualité — l'essai de validation est conforme, et chaque contrôle est rendu", () => {
  const { qc } = essai(PALIERS);
  const ids = qc.map((c) => c.id);
  for (const id of ["paliers", "increment", "lectures", "duree", "garde", "croissance", "fluagePositif", "arret", "avantPf", "apresPf",
    "v1", "espacement", "outil", "delai", "plage", "linearite", "fluagePlage", "p2pf", "pf", "pl", "lointaine", "membrane", "nettes", "plpf", "empl"])
    assert.ok(ids.includes(id), `contrôle « ${id} » rendu`);
  assert.equal(new Set(ids).size, ids.length, "chaque contrôle une seule fois");
  for (const c of qc) {
    assert.ok(["ok", "alerte", "ko", "nv"].includes(c.statut), `${c.id} : statut connu`);
    assert.ok(c.libelle && c.exigence && c.reference && c.groupe, `${c.id} : libellé, exigence, source et groupe`);
  }
  const b = bilanControles(qc);
  assert.equal(b.ko, 0, `aucun contrôle non conforme : ${qc.filter((c) => c.statut === "ko").map((c) => c.id)}`);
  assert.equal(statut(qc, "pl"), "ok", "pl lue sur la courbe");
  assert.equal(statut(qc, "arret"), "ok");
  assert.equal(statut(qc, "duree"), "nv", "les temps ne sont pas saisis");
  assert.equal(b.ok + b.alerte + b.ko + b.nv, qc.length);
});

test("contrôle qualité — essai tronqué et sans lecture à 30 s", () => {
  const court = PALIERS.slice(0, 6).map(({ p, V60 }) => ({ p, V60 }));
  const { qc } = essai(court);
  assert.equal(statut(qc, "paliers"), "ko", "6 paliers < 8");
  assert.equal(statut(qc, "lectures"), "ko", "pas de V30 : pas de fluage");
  assert.equal(bilanControles(qc).statut, "ko");
  const neuf = essai(PALIERS.slice(0, 9)).qc;
  assert.equal(statut(neuf, "paliers"), "alerte", "9 paliers : minimum tenu, 10 recommandés");
});

test("contrôle qualité — plage imposée par l'opérateur : EM change, et un débordement sur la phase plastique est signalé", () => {
  const auto = essai(PALIERS), imposee = essai(PALIERS, { i1: 2, i2: 4 }), large = essai(PALIERS, { i1: 2, i2: 8 });
  assert.equal(imposee.r.phase.auto, false);
  assert.equal(imposee.r.phase.i2, 4);
  assert.ok(Math.abs(imposee.r.EM - auto.r.EM) > 1e-6, "EM recalculé sur la plage choisie");
  assert.match(imposee.qc.find((c) => c.id === "plage").mesure, /imposée par l'opérateur/);
  assert.equal(statut(large.qc, "p2pf"), "ko", "p2 au-delà de pf");
  assert.ok(large.r.EM < auto.r.EM, "une plage qui mord sur la phase plastique fait chuter EM");
  const deux = essai(PALIERS, { i1: 3, i2: 4 });
  assert.equal(statut(deux.qc, "plage"), "ko", "deux paliers seulement");
});

test("contrôle qualité — appareillage : a, étalonnages présents ou absents", () => {
  const ok = controlerAppareillage({ tube, air, Vs: tube.Vs, Vmax: 815 });
  assert.equal(bilanControles(ok).ko, 0);
  assert.equal(statut(ok, "a"), "ok", "a = 5,19 cm³/MPa < 6");
  const raide = controlerAppareillage({ tube: { ...tube, a: 7.5 }, air, Vs: tube.Vs, Vmax: 815 });
  assert.equal(statut(raide, "a"), "ko");
  const nu = controlerAppareillage({ tube: { applicable: false }, air: { applicable: false }, Vs: 535, Vmax: 815 });
  assert.equal(statut(nu, "tube"), "ko");
  assert.equal(statut(nu, "a"), "nv");
  assert.equal(statut(nu, "air"), "ko");
  const court = controlerAppareillage({ tube, air, Vs: tube.Vs, Vmax: 950 });
  assert.equal(statut(court, "airCouvre"), "alerte", "l'étalonnage à l'air s'arrête avant le plus grand volume lu");
});

test("contrôle qualité — essais trop rapprochés", () => {
  const r = P.depouiller({ paliers: PALIERS, Vs: tube.Vs, z: 6, hc: 1, pe: air.pe, a: tube.a, sol: SOL, pel: air.pel });
  const qc = controlerEssai({ r, paliers: PALIERS, Vs: tube.Vs, pel: air.pel, z: 6, voisins: [5.5] });
  assert.equal(statut(qc, "espacement"), "ko", "0,5 m < 0,75 m");
});
