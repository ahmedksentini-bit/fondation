// Conditions d'utilisation : les tableaux transcrits des annexes 2 et 3 du
// fascicule 2 se lisent à partir d'un classement, et les exemples du
// fascicule 1 (tableaux 12 et 16) y sont retrouvés.
import test from "node:test";
import assert from "node:assert/strict";
import { REMBLAI } from "../src/gtr/tables-remblai.js";
import { COUCHE_FORME } from "../src/gtr/tables-couche-forme.js";
import { conditionsRemblai, conditionsCoucheForme, decoder, cles, couvre, RUBRIQUES_REMBLAI, RUBRIQUES_CDF } from "../src/gtr/utilisation.js";
import { classerSol } from "../src/gtr/classification.js";
import { sensibiliteGel } from "../src/gtr/gel.js";

test("codes : 7 chiffres en remblai, 4 en couche de forme, dans les rubriques", () => {
  for (const c of REMBLAI) for (const s of c.situations ?? []) for (const so of s.solutions ?? []) {
    assert.match(so.code, /^\d{7}$/, c.classes.join(" "));
    decoder(so.code).forEach((r, i) => assert.ok(r.valeur < RUBRIQUES_REMBLAI[r.rubrique].valeurs.length, `${c.classes[0]} rubrique ${i}`));
    assert.ok([1, 2, 3].includes(Number(so.code[5])), "énergie de compactage 1, 2 ou 3");
  }
  for (const c of COUCHE_FORME) for (const s of c.situations ?? []) for (const so of s.solutions ?? []) {
    assert.match(so.code, /^\d{4}$/, c.classes.join(" "));
    decoder(so.code, RUBRIQUES_CDF).forEach((r) => assert.ok(r.valeur < RUBRIQUES_CDF[r.rubrique].valeurs.length));
  }
});

test("F1 tableau 12 : le sol F2h en remblai", () => {
  const plus = conditionsRemblai("F2h", "+");
  assert.ok(plus.non, "pluie faible : non");
  const egal = conditionsRemblai("F2h", "=");
  assert.deepEqual(egal.solutions.map((s) => s.code), ["0002020", "0000031"]);
  const moins = conditionsRemblai("F2h", "-");
  assert.deepEqual(moins.solutions.map((s) => s.code), ["1010122", "0002020"]);
});

test("annexe 2 : F1h et F1m (contrôles de la transcription)", () => {
  assert.deepEqual(conditionsRemblai("F1h", "-").solutions.map((s) => s.code), ["0000031", "1010122", "0001020"]);
  assert.deepEqual(conditionsRemblai("F1m", "+").solutions.map((s) => s.code), ["2000022"]);
  assert.ok(conditionsRemblai("F1th", "=").non);
});

test("F1 tableau 16 : graves G31 en couche de forme", () => {
  const ins = conditionsCoucheForme("G31ins", "++");
  assert.deepEqual(ins.solutions.map((s) => s.code), ["0000"]);
  assert.deepEqual(conditionsCoucheForme("G31ins", "-").solutions.map((s) => s.code), ["0000", "0111"]);
  assert.ok(conditionsCoucheForme("G31", "+").non);
  assert.deepEqual(conditionsCoucheForme("G31", "=").solutions.map((s) => s.code), ["0111"]);
});

test("du classement au tableau : clés de recherche", () => {
  const g = classerSol({ Dmax: 40, p63um: 9, p2mm: 35, Cu: 30, VBS: 0.5, LA: 30, MDE: 20, IPI: 10, w: 7, wOPN: 6 });
  assert.deepEqual(cles(g).remblai, ["G3h"]);
  assert.deepEqual(cles(g).couche, ["G31"]);
  assert.ok(conditionsRemblai(g, "=").trouve);
  const f = classerSol({ Dmax: 20, p63um: 70, IP: 30, w: 12, wOPN: 10 });
  assert.deepEqual(cles(f).couche, ["F3"]);
  assert.ok(conditionsCoucheForme(f, "=").trouve);
  assert.ok(couvre("++/+", "+") && couvre("= ou -", "-") && !couvre("=", "-"));
});

test("chaque classe de sol F, I, S, G a son cas en remblai", () => {
  for (const n of ["F1", "F2", "F3", "F4", "I1", "I2"]) for (const e of ["th", "h", "m", "s", "ts"]) assert.ok(conditionsRemblai(`${n}${e}`, "=").trouve, `${n}${e}`);
  for (const n of ["S1", "S2", "S3", "S4", "G1", "G2", "G3", "G4"]) for (const e of ["ins", "th", "h", "m", "s", "ts"]) assert.ok(conditionsRemblai(`${n}${e}`, "=").trouve, `${n}${e}`);
});

test("gel : règles par défaut de l'annexe 3", () => {
  assert.equal(sensibiliteGel({ nature: "F1", p: 0.5 }).classe, "SGt");
  assert.equal(sensibiliteGel({ nature: "F1" }).classe, "SGt");
  assert.equal(sensibiliteGel({ nature: "F3" }).classe, "SGp");
  assert.equal(sensibiliteGel({ nature: "G11", insensibleEau: true, LA: 25, MDE: 20 }).classe, "SGn");
  assert.equal(sensibiliteGel({ nature: "S21", insensibleEau: true, LA: NaN, MDE: NaN }).classe, "SGp");
  assert.equal(sensibiliteGel({ nature: "R4 Cl" }).classe, "SGp");
  assert.equal(sensibiliteGel({ nature: "F2", traitement: "chaux", Rc: 2.6 }).classe, "SGn");
  assert.equal(sensibiliteGel({ nature: "F2", traitement: "chaux", VBS: 1, dosage: 2, mouture: 30, q4: true, CBRiSurIPI: 1.5, IPI: 16 }).classe, "SGp");
  assert.equal(sensibiliteGel({ nature: "I1", traitement: "liant", Rit: 0.3 }).classe, "SGn");
});
