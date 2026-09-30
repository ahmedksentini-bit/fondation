// Contrôles numériques des fondations superficielles, sur les trois exemples
// détaillés du guide Cerema « Eurocode 7 – Application aux fondations
// superficielles (NF P94-261) », chapitre 7, et sur les formules du
// Fascicule 62 titre V. Les tolérances reprennent l'arrondi du guide.
import test from "node:test";
import assert from "node:assert/strict";
import * as s from "../src/geotech/superficielles.js";
import { profilCouches } from "../src/geotech/outils.js";

const proche = (obtenu, attendu, tol, msg) =>
  assert.ok(Math.abs(obtenu - attendu) <= tol,
    `${msg} : obtenu ${obtenu}, attendu ${attendu} (± ${tol})`);

// Exemple 1 — semelle filante B = 3 m, D = 0,8 m, charge inclinée, pressiomètre.
const ex1 = profilCouches([
  { z0: 0, z1: 0.8, pl: 1.0, EM: 10 },   // remblai sableux
  { z0: 0.8, z1: 3.8, pl: 0.7, EM: 6 },  // limons
  { z0: 3.8, z1: 20, pl: 2.0, EM: 20 },  // sables
]);
const pl1 = { fn: ex1.fn("pl"), ruptures: ex1.ruptures };

test("exemple 1 — ple*, De et kp d'une filante sur limons", () => {
  const hr = s.hrEC7({ forme: "filante", B: 3, etat: "ELU" });
  proche(hr, 4.5, 1e-12, "hr = 1,5 B");
  const { ple } = s.pleEC7({ profil: pl1, D: 0.8, hr });
  proche(ple, 0.99, 0.005, "ple* (MPa)");
  const De = s.De({ profil: pl1, D: 0.8, reference: ple });
  proche(De, 0.81, 0.005, "De (m)");
  const kp = s.kpEC7({ categorie: "argile", B: 3, forme: "filante", De });
  proche(kp.k, 0.86, 0.005, "kp");
});

test("exemple 1 — iδ en sol frottant et portance aux trois états", () => {
  const cas = [
    { etat: "ELU", V: 174, H: 20.6, iAttendu: 0.75, qnet: 640, R: 1191 },
    { etat: "ELS_car", V: 129, H: 13.7, iAttendu: 0.77, qnet: 660, R: 765 },
    { etat: "ELS_QP", V: 118, H: 13.7, iAttendu: 0.75, qnet: 640, R: 744 },
  ];
  for (const c of cas) {
    const delta = Math.atan(c.H / c.V) * 180 / Math.PI;
    const id = s.idEC7({ sol: "frottant", delta, B: 3, De: 0.81 });
    // Le guide arrondit δd au centième de radian avant de calculer iδ
    // (0,11 rad à l'ELS caractéristique au lieu de 0,1057) : d'où 0,77 au
    // lieu de 0,777. L'écart vient de l'arrondi, pas de la formule.
    proche(id.i, c.iAttendu, 0.009, `iδ ${c.etat}`);
    // Le guide arrondit : ple* = 0,99 MPa, kp = 0,86.
    const qnet = 0.86 * 0.99 * Math.round(id.i * 100) / 100 * 1000;
    proche(qnet, c.qnet, 8, `qnet ${c.etat} (kPa)`);
    const p = s.portanceEC7({ A: 3, qnet: c.qnet, q0: 0.8 * 20, Vd: c.V, etat: c.etat });
    proche(p.Rvd + p.R0, c.R, 2, `Rv;d + R0 ${c.etat} (kN/m)`);
    assert.ok(p.ok, `portance vérifiée ${c.etat}`);
  }
});

test("exemple 1 — glissement drainé sur limons (φ' = 25°)", () => {
  const g = s.glissementEC7({ Vd: 174, Hd: 20.6, phiCrit: 25, etat: "ELU" });
  proche(g.Rhd, 67, 0.5, "Rh;d (kN/m)");
  assert.ok(g.ok);
});

test("exemple 2 — semelle en crête de talus, pénétromètre", () => {
  const prof = profilCouches([
    { z0: 0, z1: 1, qc: 1 }, { z0: 1, z1: 3, qc: 2.5 }, { z0: 3, z1: 6, qc: 4 },
    { z0: 6, z1: 8, qc: 12 }, { z0: 8, z1: 13, qc: 18 },
  ]);
  const qc = { fn: prof.fn("qc"), ruptures: prof.ruptures };
  const { qce, qcm } = s.qceEC7({ profil: qc, D: 1, hr: 4.5 });
  proche(qcm, 3.33, 0.005, "qcm (MPa)");
  proche(qce, 3.33, 0.005, "qce, sans écrêtage (MPa)");
  const De = s.De({ profil: qc, D: 1, reference: qce });
  proche(De, 0.30, 0.005, "De (m)");
  const kc = s.kcEC7({ categorie: "argile", B: 3, forme: "filante", De });
  proche(kc.k, 0.28, 0.005, "kc");
  const ib = s.ibEC7({ sol: "coherent", beta: 35, d: 3.5, B: 3, De });
  proche(ib.i, 0.86, 0.005, "iβ sol cohérent");
  const qnet = 0.28 * 3.33 * 0.86;
  proche(qnet, 0.80, 0.005, "qnet (MPa)");
  const elu = s.portanceEC7({ A: 3, qnet: 800, q0: 18, Vd: 1110, etat: "ELU", methode: "penetro" });
  proche(elu.Rvd, 1429, 2, "Rv;d ELU (kN/m)");
  const qp = s.portanceEC7({ A: 3, qnet: 800, q0: 18, Vd: 610, etat: "ELS_QP", methode: "penetro" });
  proche(qp.Rvd, 870, 2, "Rv;d ELS (kN/m)");
});

test("exemple 3 — semelle rectangulaire à charge excentrée", () => {
  const exc = s.excentrementEC7({ forme: "rectangulaire", B: 2.8, L: 14, eB: 0.4 });
  proche(exc.ie, 0.71, 0.005, "ie ELU");
  assert.ok(exc.ELU.ok, "ELU : ie ≥ 1/15");
  const car = s.excentrementEC7({ forme: "rectangulaire", B: 2.8, L: 14, eB: 940 / 1960 });
  proche(car.ie, 0.66, 0.005, "ie ELS caractéristique");
  assert.ok(car.ELS_car.ok);
  const prof = profilCouches([
    { z0: 0, z1: 1.5, pl: 0.35 }, { z0: 1.5, z1: 4.0, pl: 1.0 }, { z0: 4.0, z1: 20, pl: 1.5 },
  ]);
  const pl = { fn: prof.fn("pl"), ruptures: prof.ruptures };
  const hr = s.hrEC7({ forme: "rectangulaire", B: 2.8, L: 14, eB: 0.4, etat: "ELU" });
  proche(hr, 4.2, 1e-9, "hr = 1,5 B");
  const { ple } = s.pleEC7({ profil: pl, D: 1.5, hr });
  proche(ple, 1.18, 0.005, "ple* (MPa)");
  const De = s.De({ profil: pl, D: 1.5, reference: ple });
  // 0,35 × 1,5 / 1,178 = 0,4455 m : le guide tronque à 0,44.
  proche(De, 0.44, 0.006, "De (m)");
  const kp = s.kpEC7({ categorie: "argile", B: 2.8, L: 14, forme: "rectangulaire", De });
  proche(kp.kFilante, 0.84, 0.005, "kp;B/L=0");
  proche(kp.kCarree, 0.86, 0.005, "kp;B/L=1");
  proche(kp.k, 0.84, 0.005, "kp;B/L=0,2");
  const p = s.portanceEC7({ A: 39.2, ie: 0.71, qnet: 990, q0: 1.5 * 18, Vd: 2800, etat: "ELU" });
  proche(p.Rvd / 1000, 16.4, 0.05, "Rv;d (MN)");
  proche((p.Rvd + p.R0) / 1000, 17.5, 0.05, "Rv;d + R0 (MN)");
});

test("les critères d'excentrement EC7 sont ceux du Fascicule 62 réécrits", () => {
  // 100 % comprimé ⇔ e ≤ B/6 ⇔ 1 − 2e/B ≥ 2/3 ; 75 % ⇔ e ≤ B/4 ⇔ ≥ 1/2 ;
  // 10 % ⇔ e ≤ 7B/15 ⇔ ≥ 1/15.
  const B = 3;
  proche(s.eLimiteF62(B, 1), B / 6, 1e-12, "100 %");
  proche(1 - 2 * s.eLimiteF62(B, 1) / B, 2 / 3, 1e-12, "100 % ↔ 2/3");
  proche(1 - 2 * s.eLimiteF62(B, 0.75) / B, 1 / 2, 1e-12, "75 % ↔ 1/2");
  proche(1 - 2 * s.eLimiteF62(B, 0.10) / B, 1 / 15, 1e-12, "10 % ↔ 1/15");
});

test("iδ de l'EC7 pour un sol frottant = Φ2 du Fascicule 62", () => {
  for (const delta of [0, 5, 12, 20, 30, 44, 45, 50, 60])
    for (const DeB of [0, 0.25, 0.5, 1.2]) {
      const ec7 = s.idEC7({ sol: "frottant", delta, B: 1, De: DeB }).i;
      proche(ec7, s.phi2(delta, DeB), 1e-12, `δ = ${delta}°, De/B = ${DeB}`);
    }
  proche(s.idEC7({ sol: "coherent", delta: 20, B: 1 }).i, s.phi1(20), 1e-12, "sol cohérent : Φ1");
});

test("kp et kc de l'EC7 atteignent kmax à De/B = 2", () => {
  for (const [cat, t] of Object.entries(s.KP_EC7))
    for (const forme of ["filante", "carree"]) {
      const k = s.kpEC7({ categorie: cat, B: 1, L: 1, forme, De: 2 });
      proche(forme === "filante" ? k.kFilante : k.kCarree, t[forme].kmax, 0.0015, `kp ${cat} ${forme}`);
    }
  for (const [cat, t] of Object.entries(s.KC_EC7))
    for (const forme of ["filante", "carree"]) {
      const k = s.kcEC7({ categorie: cat, B: 1, L: 1, forme, De: 2 });
      proche(forme === "filante" ? k.kFilante : k.kCarree, t[forme].kmax, 0.0015, `kc ${cat} ${forme}`);
    }
});

test("Fascicule 62 — kp d'une semelle carrée sur sable B et portance", () => {
  const kp = s.kpF62({ classe: "sable-B", B: 2, L: 2, forme: "carree", De: 1 });
  // kp = 1 + 0,5 (0,6 + 0,4) × 0,5 = 1,25
  proche(kp.k, 1.25, 1e-12, "kp");
  const p = s.portanceF62({ qnette: 1.25 * 1500, q0: 20, qref: 700, etat: "ELU" });
  proche(p.qadm, 1.25 * 1500 / 2 + 20, 1e-9, "q'adm ELU");
  assert.equal(p.ok, true);
  const hors = s.kcF62({ classe: "marne-A", B: 2, L: 2, forme: "carree", De: 1 });
  assert.equal(hors.applicable, false, "kc non tabulé pour les marnes");
  assert.match(hors.motif, /absente/);
});

test("Fascicule 62 — talus : Φ2(β′) retrouve Ψ pour un encastrement nul", () => {
  // Par construction de β′ : Φ2(β′, 0) = (1 − β′/45)² = Ψ.
  for (const beta of [18.4, 26.6, 33.7, 45])
    for (const dB of [0, 1, 3, 6]) {
      const r = s.idbF62({ sol: "frottant", B: 1, De: 0, talus: { beta, d: dB } });
      proche(r.i, s.psiTalus(beta, dB), 1e-12, `β = ${beta}°, d/B = ${dB}`);
    }
  const coh = s.idbF62({ sol: "coherent", B: 1, talus: { beta: 20, d: 1 } });
  assert.equal(coh.applicable, false, "talus en sol cohérent hors annexe F.1");
});

test("diagramme des contraintes et q'ref", () => {
  const d = s.diagramme({ B: 3, V: 300, e: 0.25 });
  assert.equal(d.trapeze, true);
  proche(d.qmax, 150, 1e-9, "qmax trapèze");
  proche(d.qmin, 50, 1e-9, "qmin trapèze");
  proche(d.qrefTrapeze, 125, 1e-9, "q'ref = (3 qmax + qmin)/4");
  proche(d.qrefMeyerhof, 300 / 2.5, 1e-9, "Meyerhof");
  const t = s.diagramme({ B: 3, V: 300, e: 0.75 });
  assert.equal(t.trapeze, false);
  proche(t.fraction, 0.75, 1e-9, "fraction comprimée à e = B/4");
});
