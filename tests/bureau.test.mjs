// Bureau de calcul : la justification complète d'une semelle et d'un pieu doit
// retrouver, étape par étape, les solveurs élémentaires déjà validés.
import test from "node:test";
import assert from "node:assert/strict";
import { justifierSemelle, contraintes } from "../src/bureau/semelle.js";
import { justifierPieu, combinaisonsPieu } from "../src/bureau/pieu.js";
import * as S from "../src/geotech/superficielles.js";
import * as P from "../src/geotech/pieux.js";

const proche = (obtenu, attendu, tol, msg) =>
  assert.ok(Math.abs(obtenu - attendu) <= tol, `${msg} : obtenu ${obtenu}, attendu ${attendu} (± ${tol})`);

// Profil de l'exemple 1 du guide Cerema (semelle filante sur limons puis sables).
const couches = [
  { z0: 0, z1: 0.8, classe: "sable-A", categorie: "sable", gamma: 20, pl: 1.0, EM: 10 },
  { z0: 0.8, z1: 3.8, classe: "argile-A", categorie: "argile", gamma: 20, pl: 0.7, EM: 6 },
  { z0: 3.8, z1: 20, classe: "sable-B", categorie: "sable", gamma: 20, pl: 2.0, EM: 20 },
];

test("semelle — poids propres, torseur à la base et combinaisons", () => {
  const r = justifierSemelle({ forme: "filante", B: 3, D: 0.8, h: 0.5, couches, G: { V: 60, H: 10, M: 5 }, Q: { V: 20, H: 4 } });
  proche(r.poids.Gsemelle, 25 * 3 * 0.5, 1e-9, "poids de la semelle");
  proche(r.poids.Gterres, 20 * 0.3 * 3, 1e-9, "poids des terres");
  proche(r.torseurs.G.M, 5 + 10 * 0.5, 1e-9, "moment de H ramené à la base");
  const V = 1.35 * (60 + 37.5 + 18) + 1.5 * 20;
  proche(r.combinaisons.EC7.ELU.V, V, 1e-9, "ELU fondamental");
  proche(r.combinaisons.EC7.ELU_fav.V, 60 + 37.5 + 18 + 1.5 * 20, 1e-9, "ELU, G favorable");
});

test("semelle — la portance EC7 est celle des solveurs élémentaires", () => {
  const r = justifierSemelle({ forme: "filante", B: 3, D: 0.8, h: 0.5, couches, G: { V: 60, H: 10 }, Q: { V: 20 } });
  proche(r.geotech.pleQP, 0.99, 0.005, "ple* (guide : 0,99 MPa)");
  proche(r.geotech.DeE, 0.81, 0.005, "De (guide : 0,81 m)");
  const elu = r.etats.EC7.find((e) => e.cle === "ELU");
  const delta = Math.atan2(elu.H, elu.V) * 180 / Math.PI;
  const id = S.idEC7({ sol: "frottant", delta, B: 3, De: r.geotech.DeE }).i;
  const qnet = r.geotech.kpE.k * S.pleEC7({ profil: { fn: (z) => (z < 3.8 ? 0.7 : 2.0), ruptures: [3.8] }, D: 0.8, hr: 4.5 }).ple * id * 1000;
  // H = 10 kN/m au niveau du dessus de la semelle crée un moment H·h à la base :
  // la résultante est légèrement excentrée, d'où ie < 1.
  const ie = 1 - (2 * elu.e) / 3;
  proche(elu.excentrement.ie, ie, 1e-12, "ie");
  const direct = S.portanceEC7({ A: 3, ie, qnet, q0: 16, Vd: elu.V, etat: "ELU" });
  proche(elu.portance.Rvd, direct.Rvd, 1e-6 * direct.Rvd, "Rv;d");
  proche(elu.portance.R0, 48, 1e-9, "R0 = A γ D");
  assert.ok(r.tassement.EC7.sf > 0, "tassement calculé");
});

test("semelle — l'eau : poussée d'Archimède au F62, contraintes totales à l'EC7", () => {
  const r = justifierSemelle({ forme: "carree", B: 2, D: 1.5, h: 0.6, zw: 1, couches: couches.map((c) => ({ ...c, gammaSat: 21 })), G: { V: 800 }, Q: { V: 200 } });
  const s = contraintes(couches.map((c) => ({ ...c, gammaSat: 21 })), 1.5, 1);
  proche(s.u, 5, 1e-9, "u à la base");
  proche(r.U, 5 * 4, 1e-9, "poussée sur 4 m²");
  const f = r.etats.F62.find((e) => e.cle === "ELU"), e = r.etats.EC7.find((x) => x.cle === "ELU");
  proche(f.Veff, e.V - 20, 1e-9, "V' = V − U");
  proche(r.geotech.q0tot - r.geotech.q0eff, 5, 1e-9, "q0 − q'0 = u");
});

test("pieu — cumul du frottement négatif (même règle aux deux référentiels)", () => {
  const sans = combinaisonsPieu({ G: 1500, Q: 500, psi2: 0.3 });
  proche(sans.ELU, 1.35 * 1500 + 1.5 * 500, 1e-9, "sans Fn : 1,35 G + 1,5 Q");
  proche(sans.ELS_car, 2000, 1e-9, "ELS caractéristique");
  proche(sans.ELS_QP, 1650, 1e-9, "ELS quasi permanent");
  const avec = combinaisonsPieu({ G: 1500, Q: 500, psi2: 0.3, Fn: 400 });
  proche(avec.ELU, 1.35 * 1500 + 1.5 * 150 + Math.max(540, 525), 1e-9, "G'd + max(Gsn,d ; Q'd)");
  proche(avec.ELS_QP, 1650 + 400, 1e-9, "ELS QP : G' + Fn");
});

test("pieu — mêmes valeurs que les solveurs, et pieu modèle cohérent", () => {
  const profil = [
    { z0: 0, z1: 5, classe: "argile-A", categorie: "argile", pl: 0.5, EM: 5 },
    { z0: 5, z1: 12, classe: "sable-B", categorie: "sable", pl: 1.5, EM: 15 },
    { z0: 12, z1: 20, classe: "marne-A", categorie: "marne", pl: 2.5, EM: 30 },
  ];
  const r = justifierPieu({ type: "fore-boue", cat: 2, B: 0.8, D: 15, couches: profil, G: 1500, Q: 500 });
  const direct = P.pieuF62({ methode: "pressio", type: "fore-boue", B: 0.8, D: 15, couches: profil });
  proche(r.F62.Qu, direct.Qu, 1e-9, "Qu");
  proche(r.EC7.Rck, (r.EC7.Rb + r.EC7.Rs) / (1.15 * 1.1), 1e-6, "modèle de terrain");
  const m = justifierPieu({ type: "fore-boue", cat: 2, B: 0.8, D: 15, couches: profil, G: 1500, Q: 500, procedure: "modele", N: 1, S: 100 });
  proche(m.EC7.Rck, (m.EC7.Rb + m.EC7.Rs) / 1.08 / 1.15, 1e-6, "pieu modèle, sondage unique, S = 100 m²");
  assert.ok(r.tassement.frankZhao.s > 0 && r.tassement.frankZhao.s < 0.05, "tassement Frank et Zhao plausible");
  assert.equal(r.verifs.length, 6);
});

test("bureau — un sondage dépouillé devient des couches de calcul", async () => {
  const { couchesDepuisSondage, moyenneGeometrique, moyenneHarmonique } = await import("../src/bureau/projet.js");
  const couchesS = [
    { z0: 0, z1: 3, nature: "limon", sol: "limon", gamma: 18, gammaSat: 19 },
    { z0: 3, z1: 8, nature: "sable", sol: "sable", gamma: 19, gammaSat: 20 },
    { z0: 8, z1: 12, nature: "argile", sol: "marne", gamma: 20, gammaSat: 21 },
    { z0: 12, z1: 15, nature: "sable", sol: "sable", gamma: 20, gammaSat: 21 },
  ];
  const essais = [{ z: 1, plNette: 0.4, EM: 4 }, { z: 2, plNette: 0.9, EM: 9 }, { z: 4, plNette: 1.2, EM: 12 }, { z: 6, plNette: 1.5, EM: 15 }, { z: 9, plNette: 2.4, EM: 40 }];
  const r = couchesDepuisSondage(couchesS, essais);
  proche(r[0].pl, moyenneGeometrique([0.4, 0.9]), 1e-12, "pl* : moyenne géométrique");
  proche(r[0].EM, moyenneHarmonique([4, 9]), 1e-12, "EM : moyenne harmonique");
  assert.equal(r[0].classe, "argile-A", "limon à pl* = 0,6 MPa : argile ou limon mou");
  assert.equal(r[1].categorie, "sable");
  assert.equal(r[2].classe, "marne-A", "la marne garde sa famille");
  assert.equal(r[3].estimee, true, "une couche sans essai le signale");
  proche(r[3].pl, 2.4, 1e-12, "elle reprend l'essai le plus proche");
});

test("bureau — l'étude paramétrique trouve la plus petite dimension qui vérifie", async () => {
  const { balayage, tauxMaximaux } = await import("../src/bureau/projet.js");
  const { minimal, points } = balayage((B) => ({ F62: 3 / B, EC7: 2.5 / B }), 1, 5, 0.5);
  assert.equal(points.length, 9);
  proche(minimal.F62, 3, 1e-9, "3/B ≤ 1 dès B = 3");
  proche(minimal.EC7, 2.5, 1e-9, "2,5/B ≤ 1 dès B = 2,5 (interpolé)");
  assert.equal(balayage(() => ({ F62: 2, EC7: 2 }), 1, 2, 0.5).minimal.F62, null, "aucune valeur ne vérifie");
  assert.deepEqual(tauxMaximaux([{ ref: "F62", taux: 0.8, ok: true }, { ref: "EC7", taux: NaN, ok: false }, { ref: "F62", taux: 1.2, ok: false }]), { F62: 1.2, EC7: Infinity });
  // Sur un vrai cas : la semelle de l'exemple Cerema se vérifie mieux quand elle s'élargit.
  const d = (B) => ({ forme: "filante", B, D: 0.8, h: 0.5, couches, G: { V: 70, H: 8, M: 0 }, Q: { V: 25, H: 6, M: 0 } });
  const t1 = tauxMaximaux(justifierSemelle(d(1.2)).synthese), t2 = tauxMaximaux(justifierSemelle(d(3)).synthese);
  assert.ok(t2.EC7 < t1.EC7 && t2.F62 < t1.F62, "le taux de travail baisse quand B croît");
});
