// Tassements (exemples 1 à 3 du guide Cerema « fondations superficielles »)
// et méthode c–φ (valeurs de la feuille « portance semelle analytique c-phi »
// du guide EC7 du CSTB, fournie avec le cours dans docs/ec7).
import test from "node:test";
import assert from "node:assert/strict";
import * as t from "../src/geotech/tassements.js";
import * as c from "../src/geotech/cphi.js";

const proche = (obtenu, attendu, tol, msg) =>
  assert.ok(Math.abs(obtenu - attendu) <= tol,
    `${msg} : obtenu ${obtenu}, attendu ${attendu} (± ${tol})`);

test("coefficients de forme λc, λd, interpolés entre les colonnes", () => {
  proche(t.lambdas({ forme: "rectangulaire", B: 3, L: 15 }).lc, 1.4, 1e-12, "λc L/B = 5");
  proche(t.lambdas({ forme: "rectangulaire", B: 3, L: 15 }).ld, 2.14, 1e-12, "λd L/B = 5");
  proche(t.lambdas({ forme: "circulaire", B: 2 }).ld, 1, 1e-12, "cercle");
  proche(t.lambdas({ forme: "rectangulaire", B: 2, L: 5 }).lc, 1.25, 1e-12, "λc L/B = 2,5 interpolé");
});

test("exemple 1 du guide — Ed = 9 MPa, sf ≈ 2 mm", () => {
  const Ed = t.moduleEd({ E1: 6, E2: 6, E35: 20, E68: 20 });
  proche(Ed, 8.76, 0.01, "Ed (formule H.2.1.2.6)");
  const s = t.tassementMenard({ forme: "rectangulaire", B: 3, L: 15, q: 118 / 3, sigmaV0: 16, alpha: 0.5, Ec: 6, Ed: 9 });
  proche(s.sc, 0.9, 0.05, "sc (mm)");
  proche(s.sd, 1.1, 0.1, "sd (mm)");
  proche(s.sf, 2.0, 0.15, "sf (mm)");
});

test("exemple 3 du guide — Ed = 11,3 MPa, sf ≈ 1,4 mm", () => {
  const Ed = t.moduleEd({ E1: 9.4, E2: 9.4, E35: 15.1, E68: 15.1 });
  proche(Ed, 11.3, 0.05, "Ed");
  const s = t.tassementMenard({ forme: "rectangulaire", B: 2.8, L: 14, q: 1680 / 39.2, sigmaV0: 27, alpha: 2 / 3, Ec: 9.4, Ed: 11.3 });
  proche(s.sd, 0.9, 0.05, "sd (mm)");
  proche(s.sc, 0.5, 0.05, "sc (mm)");
});

test("Ed du Fascicule 62 : même structure, poids légèrement différents", () => {
  const E = { E1: 5, E2: 7, E35: 10, E68: 14, E916: 20 };
  const f62 = t.moduleEd({ ...E, referentiel: "F62" });
  const ec7 = t.moduleEd({ ...E });
  // Seule la contribution de E2 change : 1/(0,85 × 4) = 0,294 contre 0,3.
  proche(1 / f62 - 1 / ec7, 0.25 / (0.85 * 7) - 0.3 / 7, 1e-12, "écart sur le terme E2");
  // Sol homogène : Ec = Ed = EM avec la pondération de l'EC7 (somme des poids = 1).
  proche(t.moduleEd({ E1: 12, E2: 12, E35: 12, E68: 12, E916: 12 }), 12, 1e-12, "sol homogène EC7");
});

test("tranches de Ménard sur un profil par couches", () => {
  const profil = {
    fn: (z) => (z < 2.3 ? 6 : 20),
    ruptures: [2.3],
  };
  const { E1, E2, E35 } = t.tranchesMenard({ profilEM: profil, D: 0.8, B: 3 });
  proche(E1, 6, 1e-9, "E1 (0,8 à 2,3 m)");
  proche(E2, 20, 1e-6, "E2 (2,3 à 3,8 m)");
  proche(E35, 20, 1e-6, "E3,5");
});

test("exemple 2 du guide — Schmertmann : 29 mm", () => {
  const r = t.schmertmann({
    forme: "filante", B: 3, q: 610 / 3, sigmaV0: 18, sigmaVp: 74, t: 1,
    couches: [
      { z0: 0, z1: 2, qc: 2.5 }, { z0: 2, z1: 5, qc: 4 },
      { z0: 5, z1: 7, qc: 12 }, { z0: 7, z1: 12, qc: 18 },
    ],
  });
  proche(r.Izp, 0.66, 0.005, "Izp");
  proche(r.C1, 0.951, 0.001, "C1");
  proche(r.C2, 1.2, 1e-9, "C2 (t = 1 an)");
  proche(r.s, 29, 0.5, "s (mm)");
});

test("Boussinesq : contrainte sous l'axe d'une semelle", () => {
  proche(t.boussinesqAxe({ forme: "carree", B: 2, q: 100, z: 1e-6 }), 100, 0.01, "en surface");
  proche(t.boussinesqAxe({ forme: "carree", B: 2, q: 100, z: 2 }), 33.6, 0.1, "carrée à z = B");
  proche(t.boussinesqAxe({ forme: "filante", B: 2, q: 100, z: 2 }), 55.0, 0.2, "filante à z = B");
});

test("feuille CSTB c–φ — semelle filante, conditions non drainées", () => {
  const r = c.portanceNonDrainee({ forme: "filante", Bp: 2.3512289126176786, cu: 45, q: 31.5, H: 64.5 });
  proche(r.ic, 0.8124058708347217, 1e-9, "ic");
  proche(r.qu, 219.46770257476604, 1e-6, "Rk/A' (kPa)");
  const v = c.verificationDA2({ Rk: r.R, Vd: 356.1075 });
  proche(v.Rd, 368.5848626282624, 1e-6, "Rd (kN/m)");
  assert.ok(v.ok);
});

test("feuille CSTB c–φ — semelle filante, conditions drainées", () => {
  const f = c.facteursPortance(25);
  proche(f.Nq, 10.66214238849845, 1e-9, "Nq");
  proche(f.Nc, 20.720531219083686, 1e-9, "Nc");
  proche(f.Ngamma, 9.011061979881713, 1e-9, "Nγ");
  const r = c.portanceDrainee({ forme: "filante", Bp: 2.3324165945262036, phi: 25, c: 5, q: 26.5, gamma: 11, V: 337.8825, H: 64.5 });
  proche(r.iq, 0.6761133630715113, 1e-9, "iq");
  proche(r.ic, 0.6425921600188597, 1e-9, "ic");
  proche(r.ig, 0.5559417367607534, 1e-9, "iγ");
  proche(r.qu, 321.8728380708417, 1e-6, "Rk/A' (kPa)");
  const v = c.verificationDA2({ Rk: r.R, Vd: 337.8825 });
  proche(v.Rd, 536.2439634597691, 1e-6, "Rd (kN/m)");
  proche(v.surdimensionnement, 1.5870723208800963, 1e-6, "surdimensionnement");
});

test("feuille CSTB c–φ relue avec l'annexe F de la NF P94-261", () => {
  // Même semelle (B = 2,7 m, D = 1,5 m) : vérifiée en approche 2 de l'EN 1997-1
  // (γR;v = 1,4 seul), elle ne l'est plus avec la résistance nette et le
  // coefficient de modèle de la norme française.
  const dr = c.portanceDrainee({ forme: "filante", Bp: 2.3324165945262036, phi: 25, c: 5, q: 26.5, gamma: 11, V: 337.8825, H: 64.5 });
  // Vd et R0 « totaux » (poids non déjaugés, q0 = γ D = 31,5 kPa) ; la
  // résistance nette retranche la contrainte effective q'0 = 26,5 kPa.
  const fd = c.verificationAnnexeF({ A: 2.7, Ap: dr.Ap, quBrut: dr.qu, q0: 26.5, q0Total: 31.5, Vd: 356.1075, drainage: "draine" });
  proche(fd.facteur, 2.8, 1e-12, "γR;v γR;d;v drainé");
  proche(fd.Rvd, 246.047, 0.001, "Rv;d drainé (kN/m)");
  proche(fd.R0, 85.05, 1e-9, "R0 = A γ D");
  proche(fd.taux, 1.1017, 0.0001, "taux drainé");
  assert.equal(fd.ok, false);
  const nd = c.portanceNonDrainee({ forme: "filante", Bp: 2.3512289126176786, cu: 45, q: 31.5, H: 64.5 });
  const fn = c.verificationAnnexeF({ A: 2.7, Ap: nd.Ap, quBrut: nd.qu, q0: 31.5, Vd: 356.1075, drainage: "non-draine" });
  proche(fn.facteur, 1.68, 1e-12, "γR;v γR;d;v non drainé");
  proche(fn.Rvd, 263.069, 0.001, "Rv;d non drainé (kN/m)");
  assert.equal(fn.ok, false);
  proche(c.verificationAnnexeF({ A: 1, Ap: 1, quBrut: 100, q0: 0, Vd: 1, etat: "ELS_car" }).facteur, 4.6, 1e-12, "ELS drainé : 2,3 × 2");
});
