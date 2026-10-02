// Cas de PST et classes d'arase du tableau 17 du fascicule 1 du GTR 2024.
import test from "node:test";
import assert from "node:assert/strict";
import { casPST, MODULE_AR, verifierArase } from "../src/gtr/pst.js";

test("sols sensibles à l'eau selon leur état", () => {
  assert.equal(casPST({ sousClasse: "F1", etat: "th" }).pst, "PST0");
  assert.equal(casPST({ sousClasse: "F1", etat: "h" }).pst, "PST1");
  assert.equal(casPST({ sousClasse: "F1", etat: "h", portanceCT: 12 }).pst, "PST0", "moins de 15 MPa à court terme");
  assert.equal(casPST({ sousClasse: "F2", etat: "m", nappe: "risque" }).pst, "PST2");
  assert.equal(casPST({ sousClasse: "F3", etat: "m", drainage: true }).pst, "PST2", "F3 et F4 restent en PST2");
  const p3 = casPST({ sousClasse: "G3", etat: "m", drainage: true });
  assert.equal(p3.pst, "PST3");
  assert.deepEqual(p3.ar, ["AR1", "AR2"]);
  assert.deepEqual(casPST({ sousClasse: "G3", etat: "s", drainage: true }).ar, ["AR1"], "état sec : AR1");
  assert.deepEqual(casPST({ sousClasse: "F1", etat: "m", drainage: true }).ar, ["AR1"], "sol fin : AR1 en l'état");
});

test("traitements : amélioration et stabilisation", () => {
  assert.equal(casPST({ sousClasse: "F2", etat: "m", traitement: "stabilisation", eTraitee: 0.35 }).pst, "PST4");
  assert.equal(casPST({ sousClasse: "F2", etat: "h", traitement: "stabilisation", eTraitee: 0.35 }).pst, "PST1", "depuis une PST1, 0,70 m en deux couches");
  assert.equal(casPST({ sousClasse: "F2", etat: "h", traitement: "stabilisation", eTraitee: 0.7 }).pst, "PST4");
  assert.equal(casPST({ sousClasse: "F2", etat: "m", traitement: "amelioration", eTraitee: 0.5, nappe: "risque" }).pst, "PST2");
  assert.equal(casPST({ sousClasse: "F2", etat: "m", traitement: "stabilisation", eTraitee: 0.35 }).ar[0], "AR2");
});

test("matériaux insensibles à l'eau et roches", () => {
  assert.deepEqual(casPST({ sousClasse: "S2", etat: "ins" }), { ...casPST({ sousClasse: "S2", etat: "ins" }), pst: "PST5", ar: ["AR2", "AR3"] });
  assert.equal(casPST({ sousClasse: "G1", etat: "ins" }).pst, "PST6");
  assert.equal(casPST({ sousClasse: "VC1G1", etat: "ins" }).pst, "PST6");
  assert.equal(casPST({ sousClasse: "CH2" }).pst, "PST6");
  assert.equal(casPST({ sousClasse: "R3 Li" }).pst, "PST6");
  assert.equal(casPST({ sousClasse: "O2" }).applicable, false);
});

test("modules des classes d'arase et vérification à court terme", () => {
  assert.equal(MODULE_AR.AR1, 20);
  assert.equal(MODULE_AR.AR2, 50);
  assert.equal(MODULE_AR.AR3, 120);
  assert.equal(verifierArase({ EV2: 45, ar: "AR2" }).ok, false);
  assert.equal(verifierArase({ EV2: 55, ar: "AR2" }).ok, true);
});
