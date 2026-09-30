// Portance des pieux : exemple 1 du guide Cerema « fondations profondes »
// (pieu tarière creuse Ø 420 mm dans la craie, pénétromètre, pieu modèle)
// et un pieu foré boue au Fascicule 62 calculé à la main.
import test from "node:test";
import assert from "node:assert/strict";
import * as p from "../src/geotech/pieux.js";

const proche = (obtenu, attendu, tol, msg) =>
  assert.ok(Math.abs(obtenu - attendu) <= tol,
    `${msg} : obtenu ${obtenu}, attendu ${attendu} (± ${tol})`);

test("courbes Q1 à Q7 du Fascicule 62 — points caractéristiques", () => {
  proche(p.courbeQ(1, 1.5), 40, 1e-9, "Q1 au palier (pl = pn)");
  proche(p.courbeQ(1, 0.5), 22.222, 1e-3, "Q1 à 0,5 MPa");
  proche(p.courbeQ(5, 0.2), 0, 1e-9, "Q5 part de 0,2 MPa");
  proche(p.courbeQ(6, 1), 140, 1e-9, "Q6 à 1 MPa");
  proche(p.courbeQ(7, 2.5), 290, 1e-9, "Q7 à 2,5 MPa");
  // Q1 à Q4 bornées par Q5 : à faible pl*, Q4 ne peut dépasser Q5.
  assert.ok(p.courbeQ(4, 0.4) <= p.courbeQ(5, 0.4) + 1e-9);
  for (let n = 1; n <= 6; n++) assert.ok(p.courbeQ(n, 3) <= p.courbeQ(n + 1, 3) + 1e-9, `Q${n} ≤ Q${n + 1}`);
});

test("choix de la courbe (tableau II) et notes", () => {
  assert.equal(p.choixCourbeF62("fore-boue", "sable-B").n, 2);
  assert.equal(p.choixCourbeF62("fore-boue", "sable-B", ["L"]).n, 1, "pieu de plus de 30 m");
  assert.equal(p.choixCourbeF62("fore-simple", "argile-C", ["R"]).n, 3, "réalésage et rainurage");
  assert.equal(p.choixCourbeF62("fore-simple", "sable-A").applicable, false, "case vide");
  assert.match(p.choixCourbeF62("battu-prefabrique", "craie-B").motif, /étude spécifique/);
  assert.equal(p.choixCourbeF62("injecte-hp", "roche-A").n, 7);
});

test("Fascicule 62 — pieu foré boue Ø 0,80 m, 15 m, ancré dans une marne", () => {
  const r = p.pieuF62({
    methode: "pressio", type: "fore-boue", B: 0.8, D: 15,
    couches: [
      { z0: 0, z1: 5, classe: "argile-A", pl: 0.5 },
      { z0: 5, z1: 12, classe: "sable-B", pl: 1.5 },
      { z0: 12, z1: 20, classe: "marne-A", pl: 2.5 },
    ],
  });
  assert.ok(r.applicable, r.motif);
  proche(r.qEquiv, 2.5, 1e-9, "ple* (MPa)");
  proche(r.kPointe, 1.8, 1e-12, "kp marne, sans refoulement");
  const Ab = Math.PI * 0.4 ** 2, P = Math.PI * 0.8;
  proche(r.Qpu, Ab * 4500, 1e-6, "Qpu (kN)");
  const Qsu = P * (5 * 22.2222222 + 7 * 75 + 3 * 120);
  proche(r.Qsu, Qsu, 1e-3, "Qsu (kN)");
  proche(r.Qc, 0.5 * r.Qpu + 0.7 * r.Qsu, 1e-9, "Qc = 0,5 Qpu + 0,7 Qsu");
  proche(r.limites.ELU.Qmax, r.Qu / 1.4, 1e-9, "Qmax ELU");
  proche(r.limites.ELS_QP.Qmax, r.Qc / 1.4, 1e-9, "Qmax ELS QP");
  proche(r.limites.ELS_rare.Qmax, r.Qc / 1.1, 1e-9, "Qmax ELS rares");
});

test("Fascicule 62 — pénétromètre, β et qsmax", () => {
  // Foré dans un sable C : qs = min(qc/200 ; 120 kPa).
  proche(p.qsPenetroF62("fore-boue", "sable-C", 16).qs, 80, 1e-9, "16 MPa / 200");
  proche(p.qsPenetroF62("fore-boue", "sable-C", 30).qs, 120, 1e-9, "plafonné à 120 kPa");
  proche(p.qsPenetroF62("fore-boue", "argile-A", 2).qs, 15, 1e-9, "β « – » : qs = qsmax");
  proche(p.qsPenetroF62("fore-boue", "sable-B", 0.8).qs, 0, 1e-9, "qc < 1 MPa : négligé");
});

test("EC7 exemple 1 — qs par couche (tableau 37 du guide)", () => {
  const cas = [["argile", 2.0, 43], ["argile", 6.0, 76], ["craie", 12.0, 107], ["craie", 8.0, 92], ["craie", 4.5, 68], ["craie", 7.6, 90]];
  for (const [sol, qc, qs] of cas) {
    const r = p.qsEC7({ methode: "penetro", cat: 6, sol, X: qc });
    proche(r.qs, qs, 0.6, `qs ${sol}, qc = ${qc} MPa`);
  }
});

test("EC7 exemple 1 — Rs, Rb et valeurs de calcul (pieu modèle, un sondage)", () => {
  const lim = p.valeursLimitesEC7({
    methode: "penetro", cat: 6, B: 0.42, D: 13,
    couches: [
      { z0: 0, z1: 2.5, sol: "argile", qc: 2.0 }, { z0: 2.5, z1: 3.3, sol: "argile", qc: 6.0 },
      { z0: 3.3, z1: 4.5, sol: "craie", qc: 12 }, { z0: 4.5, z1: 8, sol: "craie", qc: 8 },
      { z0: 8, z1: 8.5, sol: "craie", qc: 4.5 }, { z0: 8.5, z1: 20, sol: "craie", qc: 7.6 },
    ],
  });
  assert.ok(lim.applicable, lim.motif);
  // Le guide arrondit le périmètre à 1,32 m : 1 395 kN × 1,3195/1,32.
  proche(lim.Rs, 1395 * (Math.PI * 0.42) / 1.32, 4, "Rs (kN)");
  assert.equal(lim.pointe.kmax, 0.3, "kcmax classe 2, craie");
  // Rb avec la valeur retenue par le guide, qce = 10,5 MPa :
  proche(lim.Ab * 0.3 * 10.5 * 1000, 436, 1, "Rb (kN)");
  const mod = p.pieuModele({
    resultats: [{ applicable: true, methode: "penetro", categorie: p.categoriePieu(6), craie: true, refoulement: false, Rb: 436, Rs: 1395, Rc: 1831, Rt: 1395 }],
    S: 338,
  });
  proche(mod.xiMoy, 1.15, 0.005, "ξ");
  assert.equal(mod.gRd1c, 1.45, "γR;d1 pénétromètre, craie");
  proche(mod.Rck, 1098, 4, "Rc;k (kN)");
  proche(mod.calcul.ELU.Rcd, 998, 4, "Rc;d ELU");
  proche(mod.calcul.ELU_acc.Rcd, 1098, 4, "Rc;d accidentel");
  proche(mod.Rccrk, 716, 3, "Rc;cr;k");
  proche(mod.calcul.ELS_car.Rccrd, 796, 4, "Rc;cr;d caractéristique");
  proche(mod.calcul.ELS_QP.Rccrd, 651, 3, "Rc;cr;d quasi permanent");
});

test("EC7 — kp et kc selon l'encastrement effectif", () => {
  const lim = p.valeursLimitesEC7({
    methode: "pressio", cat: 1, B: 1, D: 10,
    couches: [{ z0: 0, z1: 8, sol: "argile", pl: 0.3 }, { z0: 8, z1: 30, sol: "sable", pl: 2.0 }],
  });
  // ple* = 2 MPa ; Def = (2 × 0,3·... ) : hD = min(10 ; 10) = 10 m.
  proche(lim.pointe.ple, 2.0, 1e-9, "ple*");
  proche(lim.pointe.Def, (8 * 0.3 + 2 * 2.0) / 2.0, 1e-9, "Def");
  const DefB = lim.pointe.Def;
  proche(lim.pointe.k, 1 + (1.1 - 1) * DefB / 5, 1e-9, "kp = 1 + (kpmax − 1) Def/(5B)");
});

test("facteurs de corrélation ξ — exemples de la figure 10 du guide", () => {
  const a = p.facteursCorrelation({ N: 3, S: 312.5 });
  proche(a.xiMoy, 1.12, 0.005, "ξ3 (N = 3)");
  proche(a.xiMin, 1.08, 0.005, "ξ4 (N = 3)");
  // Le guide écrit Smin = 60 × 30 = 1 800 m² mais calcule ξ avec 1 500 m²
  // (1,22 et 1,12). Avec 1 800 m², ξ3 = 1,246 et ξ4 = 1,127.
  const b = p.facteursCorrelation({ N: 6, S: 1500 });
  proche(b.xiMoy, 1.22, 0.005, "ξ3 (N = 6 → 5), S = 1 500 m²");
  proche(b.xiMin, 1.12, 0.005, "ξ4 (N = 6 → 5), S = 1 500 m²");
  const s1 = p.surfaceInvestigation({ L: 60, l: 25 });
  proche(s1.S, 1800, 1e-9, "L/l = 2,4 : l porté à 30 m");
  const s2 = p.surfaceInvestigation({ L: 25, l: 8 });
  proche(s2.S, 312.5, 1e-9, "L/l = 3,1 : l porté à 12,5 m");
  proche(p.facteursCorrelation({ N: 1, S: s2.S }).xiMoy, 1.14, 0.005, "ξ3 = ξ4 = 1,14 (N = 1)");
  const c = p.facteursCorrelation({ N: 1, S: 100 });
  proche(c.xiMoy, 1.08, 1e-9, "sondage unique, S = 100 m²");
});

test("coefficients γR;d2 : cohérence F62 / EC7 sur les états de service", () => {
  // Rc;cr;d = Rc;cr / (γR;d1 γR;d2 γcr). Avec 1,15 × 1,1 × 1,1 ≈ 1,39 à
  // l'ELS quasi permanent, on retrouve le Qc/1,4 du Fascicule 62.
  const { gRd1c, gRd2 } = p.coefficientsModele({ methode: "pressio", cat: 2 });
  proche(gRd1c * gRd2 * p.GAMMAS_PIEU_EC7.ELS_QP.gcr, 1.4, 0.01, "ELS QP ≈ 1,4");
  proche(gRd1c * gRd2 * p.GAMMAS_PIEU_EC7.ELS_car.gcr, 1.1, 0.04, "ELS car. ≈ 1,1");
  proche(gRd1c * gRd2 * p.GAMMAS_PIEU_EC7.ELU.gt, 1.4, 0.01, "ELU ≈ 1,4");
});

test("micropieux de type I et II : hors tables", () => {
  const r = p.qsEC7({ methode: "pressio", cat: 17, sol: "argile", X: 1 });
  assert.equal(r.applicable, false);
  assert.match(r.motif, /essais de chargement/);
});
