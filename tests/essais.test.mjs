// Essais en place : chaque dépouillement est contrôlé sur un cas chiffré,
// tiré d'un exemple publié ou refait à la main.
import test from "node:test";
import assert from "node:assert/strict";
import * as e from "../src/geotech/essais.js";

const proche = (obtenu, attendu, tol, msg) =>
  assert.ok(Math.abs(obtenu - attendu) <= tol, `${msg} : obtenu ${obtenu}, attendu ${attendu} (± ${tol})`);

test("CPTU — argile : qt, Bq, Qt, Fr, Ic", () => {
  // z = 10 m, γ = 18 kN/m³, nappe à 1 m (γw = 9,81) : σv0 = 180, u0 = 88,3 kPa.
  const r = e.cptu({ qc: 1.2, fs: 25, u2: 400, a: 0.8, sigmaV0: 180, u0: 88.29, sigmaV0eff: 91.71 });
  proche(r.qt, 1280, 1e-9, "qt (kPa)");
  proche(r.Bq, 0.283, 0.001, "Bq");
  proche(r.Qt, 12.0, 0.05, "Qt");
  proche(r.Fr, 2.27, 0.01, "Fr (%)");
  proche(r.Ic, 2.86, 0.01, "Ic");
  assert.equal(r.zone, 4);
});

test("CPTU — sable : Ic ≈ 1,57, zone 6", () => {
  const r = e.cptu({ qc: 12, fs: 60, u2: 60, a: 0.8, sigmaV0: 114, u0: 39.24, sigmaV0eff: 74.76 });
  proche(r.qt, 12012, 1e-9, "qt");
  proche(r.Qt, 159, 0.5, "Qt");
  proche(r.Fr, 0.5, 0.01, "Fr");
  proche(r.Ic, 1.57, 0.02, "Ic");
  assert.equal(r.zone, 6);
});

test("SPT — N60, CN, (N1)60 et trois corrélations de φ'", () => {
  const r = e.sptCorrige({ N: 20, sigmaV0eff: 64, CE: 0.75, CB: 1, CR: 0.95, CS: 1 });
  proche(r.N60, 14.25, 1e-9, "N60");
  proche(r.CN, 1.25, 1e-9, "CN");
  proche(r.N160, 17.81, 0.01, "(N1)60");
  const p = e.phiSPT({ N60: r.N60, N160: r.N160, sigmaV0eff: 64 });
  proche(p.wolff, 31.3, 0.1, "Wolff");
  proche(p.kulhawyMayne, 39.5, 0.2, "Kulhawy–Mayne");
  proche(p.hatanakaUchida, 38.9, 0.1, "Hatanaka–Uchida");
});

test("Pénétromètre dynamique — formule des Hollandais", () => {
  // Mouton 90 kg, chute 0,40 m, pointe Ø 70 mm, masse frappée 55,2 kg, 10 coups pour 10 cm.
  const r = e.qdHollandais({ M: 90, Mp: 55.2, H: 0.4, Acm2: (Math.PI * 7 * 7) / 4, N: 10 });
  proche(r.qd, 5.69, 0.01, "qd (MPa)");
});

test("Dilatomètre plat — sable puis argile", () => {
  const s = e.dmt({ A: 280, B: 980, dA: 15, dB: 40, u0: 50, sigmaV0eff: 80 });
  proche(s.p0, 262.75, 1e-9, "p0");
  proche(s.ID, 3.18, 0.01, "ID");
  proche(s.KD, 2.66, 0.01, "KD");
  proche(s.ED, 23.5, 0.01, "ED (MPa)");
  proche(s.M, 31.7, 0.1, "M (MPa)");
  proche(s.phi, 33.8, 0.1, "φ");
  const a = e.dmt({ A: 200, B: 300, dA: 15, dB: 40, u0: 100, sigmaV0eff: 60 });
  proche(a.ID, 0.42, 0.01, "ID argile");
  proche(a.RM, 0.85, 1e-9, "RM plancher");
  proche(a.K0, 0.51, 0.01, "K0");
  proche(a.OCR, 0.91, 0.01, "OCR");
  proche(a.cu, 12.2, 0.1, "cu");
});

test("Scissomètre — moulinet 70 × 140 mm", () => {
  const r = e.scissometre({ M: 50, Dmm: 70, Hmm: 140, Ip: 40, Mres: 20 });
  proche(r.K * 1e6, 1257, 1, "K (cm³)");
  proche(r.cu, 39.8, 0.1, "cu (kPa)");
  proche(r.St, 2.5, 1e-9, "sensibilité");
  proche(r.mu, 1.7 - 0.54 * Math.log10(40), 1e-12, "μ de Bjerrum");
});

test("Plaque — EV1, EV2, k (exemple à deux cycles)", () => {
  const r = e.plaqueEV({ z1: 2.63, z2: 1.56 });
  proche(r.EV1, 42.8, 0.05, "EV1");
  proche(r.EV2, 57.7, 0.05, "EV2");
  proche(r.k, 1.35, 0.01, "k");
  assert.equal(r.classe, "PF2");
});

test("Lefranc — charge constante et charge variable", () => {
  const c = e.lefrancConstant({ Q: 8.33e-6, h: 1, L: 0.5, D: 0.1 });
  proche(c.m, 13.59, 0.01, "m");
  proche(c.k, 6.13e-6, 0.02e-6, "k");
  const v = e.lefrancVariable({ S: 7.85e-3, h1: 1, h2: 0.5, dt: 600, L: 0.5, D: 0.1 });
  proche(v.k, 6.67e-6, 0.02e-6, "k variable");
});

test("Pompage — Thiem, Jacob et fonction de Theis", () => {
  const t = e.thiem({ Q: 0.01, r1: 10, s1: 0.8, r2: 50, s2: 0.45, H: 10 });
  proche(t.T, 7.32e-3, 0.01e-3, "T Thiem");
  proche(t.R, 396, 2, "rayon d'action");
  const j = e.jacob({ Q: 0.01, ds: 0.237, t0: 17 * 60, r: 20 });
  proche(j.T, 7.72e-3, 0.01e-3, "T Jacob");
  proche(j.S, 0.0443, 0.0005, "S");
  proche(e.Wtheis(0.01), 4.038, 0.001, "W(0,01)");
  proche(e.Wtheis(0.1), 1.823, 0.001, "W(0,1)");
  proche(e.Wtheis(1), 0.2194, 0.0005, "W(1)");
});

test("Piézomètre — temps de réponse d'Hvorslev", () => {
  const r = e.tempsReponsePiezometre({ dTube: 0.05, L: 1, D: 0.1, k: 1e-7 });
  proche(r.F, 2.10, 0.01, "F (m)");
  proche(r.T0 / 3600, 2.6, 0.05, "T0 (h)");
});

test("Chargement de pieu — charge de fluage à l'intersection des deux droites", () => {
  const paliers = [100, 200, 300, 400, 500, 600, 700, 800].map((Q) => ({ Q, s30: Q / 100, s60: Q / 100 + (Q <= 500 ? 0.02 + Q * 1e-4 : 0.07 + (Q - 500) * 2e-3) }));
  const r = e.chargeFluagePieu(paliers);
  proche(r.Qc, 500, 5, "Qc (kN)");
});

test("RQD, réfraction et Vs,30", () => {
  const q = e.rqd([12, 8, 25, 30, 5, 15], 150);
  proche(q.RQD, 54.7, 0.1, "RQD");
  assert.equal(q.qualite, "moyenne");
  const r = e.refraction({ V1: 500, V2: 2000, xc: 20 });
  proche(r.hX, 10 * Math.sqrt(1500 / 2500), 1e-9, "épaisseur par xc");
  const v = e.vs30([{ h: 5, Vs: 150 }, { h: 10, Vs: 300 }, { h: 20, Vs: 600 }]);
  proche(v.Vs30, 30 / (5 / 150 + 10 / 300 + 15 / 600), 1e-9, "Vs,30");
  assert.equal(v.classe, "C");
});
