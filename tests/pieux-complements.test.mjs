// Frottement négatif, groupes, effort transversal et tassement d'un pieu.
import test from "node:test";
import assert from "node:assert/strict";
import * as fn from "../src/geotech/frottement-negatif.js";
import * as gr from "../src/geotech/groupes.js";
import * as lat from "../src/geotech/lateral.js";
import * as tp from "../src/geotech/tassement-pieu.js";
import * as comb from "../src/geotech/combinaisons.js";

const proche = (obtenu, attendu, tol, msg) =>
  assert.ok(Math.abs(obtenu - attendu) <= tol,
    `${msg} : obtenu ${obtenu}, attendu ${attendu} (± ${tol})`);

test("λ de Combarieu : continuité aux raccords et valeurs remarquables", () => {
  proche(fn.lambdaCombarieu(0.15), 0.235, 1e-3, "K tanδ = 0,15 (les deux branches)");
  proche(fn.lambdaCombarieu(0.1), 1 / 3, 1e-12, "K tanδ = 0,1");
  assert.equal(fn.lambdaCombarieu(0.45), 0, "sables lâches : pas d'accrochage");
});

test("sans accrochage (λ = 0), σ'v = σ'1 et Fn atteint la borne haute", () => {
  const r = fn.frottementNegatif({ R: 0.3, q: 50, couches: [{ z0: 0, z1: 8, gamma: 8, Kt: 1.0 }] });
  const P = 2 * Math.PI * 0.3;
  // ∫ (50 + 8 z) dz sur 8 m = 400 + 256 = 656
  proche(r.Fn, P * 1.0 * 656, 1e-6, "Fn = P K tanδ ∫ σ'1 dz");
  proche(r.Fn, r.FnMax, 1e-9, "borne haute atteinte");
});

test("argile molle sous remblai : intégrale numérique = expression fermée de l'annexe", () => {
  const R = 0.4, Kt = 0.15, gamma = 6, q = 60, H = 10;
  const r = fn.frottementNegatif({ R, q, couches: [{ z0: 0, z1: H, gamma, Kt }], pas: 0.01 });
  // Expression fermée (F62 G.2 § 2.5 ; NF P94-262 H.2) sur la hauteur d'action :
  // Fn = (P R/μ) { [σ'1(h) − σ'v(h)] − [σ'1(0) − σ'v(0)] }
  const lam = fn.lambdaCombarieu(Kt), mu = fn.muIsole(lam), L0 = R / (mu * Kt);
  const h = r.hAction;
  const sv = (z) => L0 * gamma + (q - L0 * gamma) * Math.exp(-z / L0);
  const s1 = (z) => q + gamma * z;
  const P = 2 * Math.PI * R;
  const ferme = ((P * R) / mu) * ((s1(h) - sv(h)) - (s1(0) - sv(0)));
  proche(r.Fn, ferme, 0.002 * ferme, "Fn numérique = forme fermée");
  assert.ok(r.Fn < r.FnMax, "l'accrochage réduit le frottement");
  // Ici L0 ≈ 60 m : σ'v ne redescend jamais à σ'v0 sur 10 m, h = base de la couche.
  assert.equal(r.h1, null);
  proche(h, H, 1e-9, "hauteur d'action = épaisseur compressible");
});

test("hauteur d'action h1 : σ'v redescend à σ'v0 (micropieu, L0 ≈ 12 m)", () => {
  const R = 0.1, Kt = 0.1, gamma = 6, q = 60;
  const r = fn.frottementNegatif({ R, q, couches: [{ z0: 0, z1: 20, gamma, Kt }], pas: 0.01 });
  const lam = fn.lambdaCombarieu(Kt), mu = fn.muIsole(lam), L0 = R / (mu * Kt);
  proche(L0, 12, 1e-9, "L0 = R/(μ K tanδ)");
  const sv = (z) => L0 * gamma + (q - L0 * gamma) * Math.exp(-z / L0);
  assert.ok(r.h1 > 10 && r.h1 < 12, `h1 = ${r.h1}`);
  proche(sv(r.h1), gamma * r.h1, 0.05, "σ'v(h1) = σ'v0(h1)");
  const r2 = fn.frottementNegatif({ R, q, couches: [{ z0: 0, z1: 20, gamma, Kt }], h2: 6 });
  proche(r2.hAction, 6, 1e-9, "h = min(h1 ; h2)");
});

test("pieu au sein d'un groupe : Fn(b) borné par π b² q0 et répartition", () => {
  const b = fn.rayonInfluence({ d: 2, dPrime: 2 });
  proche(b, Math.sqrt(4 / Math.PI), 1e-12, "b = √(d d'/π)");
  const iso = fn.frottementNegatif({ R: 0.3, q: 80, couches: [{ z0: 0, z1: 12, gamma: 7, Kt: 0.2 }] });
  const grp = fn.frottementNegatif({ R: 0.3, q: 80, couches: [{ z0: 0, z1: 12, gamma: 7, Kt: 0.2 }], b });
  assert.ok(grp.Fn <= Math.PI * b * b * 80 + 1e-9, "borne π b² q0");
  const rep = fn.repartitionGroupe({ FnIsole: iso.Fn, FnGroupe: grp.Fn, files: 3 });
  proche(rep.angle, (7 * grp.Fn + 5 * iso.Fn) / 12, 1e-9, "pieu d'angle");
  proche(rep.interieur, grp.Fn, 1e-12, "pieu intérieur");
  proche(comb.combinaisonsF62({ G: { V: 1 }, Q: { V: 0 } }).ELS_QP.V, 1, 1e-12, "combinaison triviale");
});

test("coefficient d'efficacité : Converse-Labarre, F62 (cohérents) et EC7", () => {
  proche(gr.converseLabarre({ B: 0.6, d: 1.8, m: 3, n: 3 }), 0.7269, 1e-4, "Converse-Labarre 3 × 3, d = 3B");
  proche(gr.efficaciteCoherentF62({ B: 0.6, d: 1.2 }), 0.75, 1e-12, "F62 d = 2B");
  proche(gr.efficaciteEC7({ B: 0.6, d: 1.2, m: 3, n: 3 }), 2 / 3, 1e-12, "EC7 d = 2B, 3 × 3");
  proche(gr.efficaciteEC7({ B: 0.6, d: 1.8, m: 3, n: 3 }), 1, 1e-12, "EC7 d = 3B");
  proche(gr.efficaciteEC7({ B: 1, d: 1, m: 1, n: 5 }), 1 - 0.5 * (2 - 1 - 0.2), 1e-12, "EC7 file unique, d = B");
});

test("module de réaction de Ménard", () => {
  // B = B0 : Kf = 12 EM / (4/3 × 2,65^α + α)
  const k = lat.moduleKf({ EM: 10, B: 0.6, alpha: 0.5 });
  proche(k.Kf, 12e4 / ((4 / 3) * Math.sqrt(2.65) + 0.5), 1e-6, "Kf (kPa)");
  proche(k.KfLongTerme, k.Kf / 2, 1e-9, "long terme");
});

test("pieu long : différences finies = solution analytique (tête libre et encastrée)", () => {
  const EI = 1e5, Kf = 20000, H = 100;
  const an = lat.pieuLongAnalytique({ EI, Kf, H });
  proche(an.l0, 20 ** 0.25, 1e-12, "l0");
  proche(an.MMax, 0.3224 * H * an.l0, 0.05, "Mmax ≈ 0,322 H l0");
  const fd = lat.pieuDifferencesFinies({ L: 20, EI, H, reaction: () => ({ K: Kf, rmax: Infinity }), n: 400 });
  proche(fd.y0, an.y0, 0.01 * an.y0, "y0 tête libre");
  proche(Math.abs(fd.MMax), an.MMax, 0.01 * an.MMax, "Mmax tête libre");
  const ae = lat.pieuLongAnalytique({ EI, Kf, H, tete: "encastree" });
  const fe = lat.pieuDifferencesFinies({ L: 20, EI, H, tete: "encastree", reaction: () => ({ K: Kf, rmax: Infinity }), n: 400 });
  proche(fe.y0, ae.y0, 0.01 * ae.y0, "y0 tête encastrée");
  proche(fe.M[0], ae.M0, 0.02 * Math.abs(ae.M0), "moment d'encastrement −H l0/2");
});

test("palier plastique : le déplacement croît quand le sol plastifie", () => {
  const EI = 2e5, Kf = 15000, H = 300;
  const el = lat.pieuDifferencesFinies({ L: 15, EI, H, reaction: () => ({ K: Kf, rmax: Infinity }) });
  const pl = lat.pieuDifferencesFinies({ L: 15, EI, H, reaction: () => ({ K: Kf, rmax: 60 }) });
  assert.ok(pl.plastifies > 0, "des nœuds atteignent le palier");
  assert.ok(pl.y0 > el.y0 * 1.05, "déplacement plus grand");
  for (const r of pl.p) assert.ok(Math.abs(r) <= 60 * 1.001, "réaction bornée par rmax");
});

test("Frank et Zhao : courbe croissante, asymptote Rb + Rs", () => {
  const couches = [{ z0: 0, z1: 12, EM: 8, qs: 50, sol: "fin" }];
  const pointe = { EM: 15, qb: 1500, sol: "fin" };
  const B = 0.6, D = 12;
  const r = tp.courbeChargement({ B, D, Ep: 20000, couches, pointe });
  for (let i = 1; i < r.courbe.length; i++) assert.ok(r.courbe[i].Q >= r.courbe[i - 1].Q - 1e-9, "croissante");
  const Rlim = Math.PI * B * D * 50 + (Math.PI * B * B / 4) * 1500;
  proche(r.Qmax, Rlim, 0.02 * Rlim, "charge limite approchée");
  const s = r.tassementSous(0.7 * (0.5 * (Math.PI * B * B / 4) * 1500 + 0.7 * Math.PI * B * D * 50));
  assert.ok(s > 0 && s < 0.05 * B, `tassement de service raisonnable (${(s * 1000).toFixed(1)} mm)`);
});
