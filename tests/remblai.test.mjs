// Bureau de calcul, module « Remblai sur sol compressible » : le calcul complet
// (différences finies, phasage, drains, fluage) doit retrouver le tassement
// final œdométrique, la hauteur à mettre en œuvre et les règles de phasage.
import test from "node:test";
import assert from "node:assert/strict";
import { etudierRemblai, NC } from "../src/bureau/remblai.js";

const proche = (obtenu, attendu, tol, msg) =>
  assert.ok(Math.abs(obtenu - attendu) <= tol, `${msg} : obtenu ${obtenu}, attendu ${attendu} (± ${tol})`);

const argile = { z0: 0, z1: 8, nom: "argile molle", gamma: 16, e0: 1.8, Cc: 0.7, Cs: 0.07, pop: 15, cv: 2, ch: 4, Cae: 0.02, cu: 20 };
const base = {
  H: 3, mode: "mise", gamma: 20, largeurCrete: 30, fruit: 2, zw: 0.5,
  couches: [argile, { z0: 8, z1: 10, nom: "sable", gamma: 20, drainante: true }],
  basDrainant: true, construction: "continue", montee: 0.1, Uetape: 0.7, F: 1.5, lambdaCu: 0.25,
  drains: null, tService: 2, dureeService: 60, sAdmissible: 100,
};

test("remblai — la consolidation finit sur le tassement œdométrique", () => {
  const r = etudierRemblai({ ...base, couches: [{ ...argile, Cae: 0 }, base.couches[1]] });
  const fin = r.courbe.at(-1);
  assert.ok(fin.U > 0.99, `degré final ${fin.U}`);
  proche(fin.s, r.final.centre, 0.02 * r.final.centre, "tassement au bout de 62 ans");
  assert.ok(r.final.centre > r.final.bord && r.final.bord > r.final.pied, "cuvette : l'axe tasse plus que le bord, le bord plus que le pied");
});

test("remblai — cote finale visée : H = Hfinale + s", () => {
  const r = etudierRemblai({ ...base, mode: "finale", H: 3 });
  proche(r.H - r.final.centre / 1000, 3, 1e-4, "plateforme à 3 m après tassement");
  assert.ok(r.final.dejaugeage > 0, "la base du remblai passe sous la nappe");
  proche(r.final.q, 20 * r.H - 10 * (r.final.centre / 1000 - 0.5), 1e-3, "charge déjaugée");
});

test("remblai — étapes réglées sur la stabilité à court terme", () => {
  const r = etudierRemblai({ ...base, H: 5, construction: "etapes", couches: [{ ...argile, cu: 12 }, base.couches[1]] });
  assert.ok(r.etapes.length >= 2, `${r.etapes.length} étape(s)`);
  proche(r.etapes[0].H1, (NC * 12) / (20 * 1.5), 1e-9, "première étape : (π + 2) cu/(γ F)");
  for (const e of r.etapes) assert.ok(e.F >= 1.5 - 1e-9, `étape ${e.n} : F = ${e.F}`);
  assert.ok(r.atteinte, "la hauteur visée est atteinte");
  const c = etudierRemblai({ ...base, H: 5, construction: "continue", couches: [{ ...argile, cu: 12 }, base.couches[1]] });
  assert.equal(c.stabilite.ok, false, "d'un seul jet, le remblai de 5 m ne tient pas");
});

test("remblai — les drains accélèrent sans changer le tassement final", () => {
  const sans = etudierRemblai({ ...base, couches: [{ ...argile, z1: 12 }, { ...base.couches[1], z0: 12, z1: 14 }], basDrainant: false, tService: 1 });
  const avec = etudierRemblai({ ...base, couches: [{ ...argile, z1: 12 }, { ...base.couches[1], z0: 12, z1: 14 }], basDrainant: false, tService: 1,
    drains: { espacement: 1.5, maille: "triangle", dw: 0.066, s: 2, kRapport: 2, profondeur: 12 } });
  assert.ok(avec.service.U > sans.service.U + 0.3, `U à la mise en service : ${avec.service.U} contre ${sans.service.U}`);
  proche(avec.final.centre, sans.final.centre, 1e-9, "même tassement final");
  assert.ok(avec.service.residuel < sans.service.residuel, "moins de tassement après la mise en service");
});

test("remblai — fluage après la consolidation primaire", () => {
  const r = etudierRemblai(base);
  proche(r.penteFluage, (8 * 0.02) / 2.8 * 1000, 1e-6, "H Cαe/(1 + e0) par décade");
  assert.ok(r.debutFluage > r.finTravaux, "le fluage commence après la fin des travaux");
  const fin = r.courbe.at(-1);
  proche(fin.sf, r.penteFluage * Math.log10(fin.t / r.debutFluage), 1e-6, "fluage à la fin");
});
