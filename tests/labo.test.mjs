// Laboratoire virtuel : l'essai œdométrique simulé, dépouillé comme au
// laboratoire, doit rendre les paramètres du matériau ; le Cam-Clay modifié
// doit retrouver les résultats classiques de l'état critique.
import test from "node:test";
import assert from "node:assert/strict";
import * as O from "../src/geotech/oedometre.js";

const proche = (obtenu, attendu, tol, msg) =>
  assert.ok(Math.abs(obtenu - attendu) <= tol, `${msg} : obtenu ${obtenu}, attendu ${attendu} (± ${tol})`);
const PROGRAMME = [10, 20, 40, 80, 160, 320, 640, 1280, 320, 80, 20];

test("œdomètre — la courbe e – lg σ' rend Cc, Cs et σ'p", () => {
  for (const cle of ["argile-molle", "limon", "argile-raide"]) {
    const m = O.MATERIAUX_OEDO[cle];
    const prog = cle === "argile-raide" ? [20, 40, 80, 160, 320, 640, 1280, 2560, 5120, 1280, 320, 80] : PROGRAMME;
    const s = O.simulerOedometre(m, prog);
    const r = O.compressibilite(s.paliers.map((p) => ({ sigma: p.sigma, e: p.eFin })));
    assert.ok(r.applicable, cle);
    proche(r.Cc, m.Cc, 0.12 * m.Cc, `${cle} : Cc`);
    proche(r.Cs, m.Cs, 0.3 * m.Cs, `${cle} : Cs`);
    assert.ok(r.sp > 0.6 * m.sp && r.sp < 1.5 * m.sp, `${cle} : σ'p = ${r.sp} pour ${m.sp}`);
  }
});

test("œdomètre — pendant chaque palier, e va de son début à sa fin (le banc lit eDe en direct)", () => {
  const s = O.simulerOedometre(O.MATERIAUX_OEDO["argile-molle"], PROGRAMME);
  for (const p of s.paliers) {
    // Au tout début, seul le tassement immédiat (3 % de celui du palier) est acquis.
    proche(p.eDe(1e-6), p.eDebut, 0.05 * Math.abs(p.eDebut - p.eFin) + 1e-4, `σ' = ${p.sigma} kPa : e au début du palier`);
    proche(p.eDe(1440), p.eFin, 1e-9, `σ' = ${p.sigma} kPa : e à la fin du palier`);
    const milieu = p.eDe(30);
    assert.ok(milieu <= Math.max(p.eDebut, p.eFin) + 1e-9 && milieu >= Math.min(p.eDebut, p.eFin) - 0.01, `σ' = ${p.sigma} kPa : e à 30 min entre le début et la fin`);
  }
});

test("œdomètre — un échantillon remanié sous-estime σ'p", () => {
  const m = O.MATERIAUX_OEDO["argile-molle"];
  const sp = (rem) => O.compressibilite(O.simulerOedometre(m, PROGRAMME, { remaniement: rem }).paliers.map((p) => ({ sigma: p.sigma, e: p.eFin }))).sp;
  assert.ok(sp(1) < 0.95 * sp(0), `intact ${sp(0)}, remanié ${sp(1)}`);
});

test("œdomètre — Casagrande et Taylor retrouvent cv sur un palier de la branche vierge", () => {
  const m = O.MATERIAUX_OEDO["argile-molle"];
  const s = O.simulerOedometre(m, PROGRAMME);
  const p = s.paliers[5]; // 160 → 320 kPa, au-delà de σ'p
  const c = O.casagrande(p.lectures), t = O.taylor(p.lectures);
  assert.ok(c.applicable && t.applicable, `${c.motif ?? ""} ${t.motif ?? ""}`);
  proche(O.cvDeT50(c.t50, p.Hd), m.cv, 0.25 * m.cv, "cv de Casagrande");
  proche(O.cvDeT90(t.t90, p.Hd), m.cv, 0.25 * m.cv, "cv de Taylor");
  assert.ok(c.d100 > c.d0, "d100 au-delà de d0");
});

import * as C from "../src/geotech/camclay.js";

test("Cam-Clay — non drainé, normalement consolidé : p'cs = p'0 / 2^Λ et q = M p'cs", () => {
  const m = C.MATERIAUX_TRIAX["argile-nc"], p0 = 200;
  const pts = C.cisailler(m, C.etatConsolide(m, p0), { draine: false, eaMax: 0.25 });
  const fin = pts.at(-1), L = (m.lambda - m.kappa) / m.lambda, pcs = p0 / 2 ** L;
  proche(fin.p, pcs, 0.02 * pcs, "p' à l'état critique");
  proche(fin.q, m.M * pcs, 0.02 * m.M * pcs, "q à l'état critique");
  assert.ok(fin.u > 0, "surpression positive : l'argile normalement consolidée se contracterait");
  proche(fin.ev, 0, 1e-12, "volume constant");
});

test("Cam-Clay — drainé, normalement consolidé : chemin de pente 3 et q = M p'/(1 − M/3)", () => {
  const m = C.MATERIAUX_TRIAX["argile-nc"], p0 = 150;
  const pts = C.cisailler(m, C.etatConsolide(m, p0), { draine: true, eaMax: 0.4, dEa: 4e-5 });
  for (const pt of pts.slice(1)) proche(pt.p - p0, pt.q / 3, 1e-6 * p0 + 1e-6, "chemin de pente 3");
  const qcs = (m.M * p0) / (1 - m.M / 3);
  proche(pts.at(-1).q, qcs, 0.04 * qcs, "q au voisinage de l'état critique");
  assert.ok(pts.at(-1).ev > 0.02, "l'argile normalement consolidée se contracte");
});

test("Cam-Clay — fortement surconsolidé : dilatance en drainé, surpression négative en non drainé", () => {
  const m = C.MATERIAUX_TRIAX["argile-sc"], p0 = 60;
  const nd = C.cisailler(m, C.etatConsolide(m, p0), { draine: false, eaMax: 0.2 });
  assert.ok(nd.at(-1).u < 0, `u final ${nd.at(-1).u}`);
  const dr = C.cisailler(m, C.etatConsolide(m, p0), { draine: true, eaMax: 0.2 });
  assert.ok(dr.at(-1).ev < 0, `εv final ${dr.at(-1).ev}`);
  const qMax = Math.max(...dr.map((x) => x.q));
  assert.ok(qMax > dr.at(-1).q * 1.02, "pic puis radoucissement");
});

test("Cam-Clay — essai UU : même déviateur à la rupture quelle que soit σ3", () => {
  const m = C.MATERIAUX_TRIAX["argile-nc"];
  const pts = C.cisailler(m, C.etatEnPlace(m), { draine: false, eaMax: 0.2 });
  const r1 = C.rupture(pts, { sigma3: 100 }), r2 = C.rupture(pts, { sigma3: 300 });
  proche(r1.q, r2.q, 1e-9, "même cu");
  const env = C.enveloppe([[r1.s3, r1.s1], [r2.s3, r2.s1]]);
  proche(env.phi, 0, 1e-6, "φu = 0");
  proche(env.c, r1.q / 2, 1e-6, "cu = q/2");
});

test("Cam-Clay — l'enveloppe effective de sables lâches passe par l'origine avec φ'cs", () => {
  const m = C.MATERIAUX_TRIAX["sable-lache"];
  const cercles = [100, 200, 400].map((p0) => {
    const r = C.rupture(C.cisailler(m, C.etatConsolide(m, p0), { draine: true, eaMax: 0.3, dEa: 4e-5 }), { sigma3: p0 });
    return [r.s3eff, r.s1eff];
  });
  const env = C.enveloppe(cercles);
  proche(env.phi, C.phiCritique(m.M), 1.5, "φ'");
  assert.ok(env.c < 5, `c' = ${env.c}`);
});
