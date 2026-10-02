// Matériaux virtuels des bancs d'essai : chacun doit se classer, au GTR 2024,
// dans la classe qu'il annonce — sinon les essais du cours se contrediraient.
import test from "node:test";
import assert from "node:assert/strict";
import { SOLS, ROCHES, proctorDe, ipiDe, proctorModifieDe } from "../src/bancs/materiaux.js";
import { analyser } from "../src/gtr/granulo.js";
import { classerSol, classerRoche } from "../src/gtr/classification.js";
import { optimum, rhoDSaturation } from "../src/gtr/proctor.js";

for (const [cle, s] of Object.entries(SOLS)) {
  test(`${cle} — se classe ${s.classe}`, () => {
    const a = analyser(s.granulo);
    const r = classerSol({ Dmax: s.Dmax, p63um: a.p63um, p2mm: a.p2mm, Cu: a.Cu, D60: a.D60, fractionSable: a.fractionSable, fractionGrave: a.fractionGrave,
      VBS: s.VBS, IP: s.wL != null ? s.wL - s.wP : NaN, wL: s.wL ?? NaN, wP: s.wP ?? NaN, w: s.wn, wOPN: s.wOPN, IPI: ipiDe(s)(s.wn), CBRi: s.CBRi, LA: s.LA, MDE: s.MDE, FS: s.FS });
    assert.equal(r.symbole, s.classe);
  });
  test(`${cle} — courbe Proctor cohérente`, () => {
    const p = proctorDe(s), w = [-4, -2, 0, 2, 4].map((d) => s.wOPN + d);
    const o = optimum(w.map((x) => [x, p(x)]));
    assert.ok(o.applicable, "optimum encadré");
    assert.ok(Math.abs(o.wOPN - s.wOPN) < 0.6, `wOPN ${o.wOPN}`);
    assert.ok(Math.abs(o.rhoDOPN - s.rhoDOPN) < 0.02, `ρdOPN ${o.rhoDOPN}`);
    for (const x of w) assert.ok(p(x) < rhoDSaturation(x, { rhoS: s.rhoS }), "sous la courbe de saturation");
    const m = proctorModifieDe(s), om = optimum([-4, -2, 0, 2, 4].map((d) => [s.wOPN - 2 + d, m(s.wOPN - 2 + d)]));
    assert.ok(om.applicable && om.rhoDOPN > o.rhoDOPN && om.wOPN < o.wOPN, "le Proctor modifié est plus dense et plus sec");
  });
}

test("roches : les classes attendues", () => {
  assert.equal(classerRoche("Vo", ROCHES.basalte).sousClasse, "R1 Vo");
  assert.equal(classerRoche("Li", ROCHES.calcaireDur).sousClasse, "R3 Li");
  assert.equal(classerRoche("Li", ROCHES.calcaireTendre).sousClasse, "R5 Li");
  assert.equal(classerRoche("Cl", ROCHES.schiste).sousClasse, "R4 Cld1");
  assert.equal(classerRoche("Cl", ROCHES.marne).sousClasse, "R5 Cl m");
  assert.equal(classerRoche("CH", ROCHES.craie).sousClasse, "CH3m");
});
