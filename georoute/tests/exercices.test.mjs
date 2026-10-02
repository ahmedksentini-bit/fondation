// Exercices : les banques figées sont exactement ce que produisent les modèles
// (aucune retouche à la main), et chaque modèle résiste aux tirages aléatoires.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { creerAlea } from "../src/exos/alea.js";
import { MODELES, graineDe, controler } from "../src/exos/index.js";

const racine = new URL("../", import.meta.url);
const { chapitres } = JSON.parse(readFileSync(new URL("data/chapitres.json", racine), "utf8"));

for (const ch of chapitres.filter((c) => MODELES[c.id])) {
  test(`${ch.id} — banque conforme aux modèles`, async () => {
    const modeles = (await MODELES[ch.id]()).default;
    assert.equal(modeles.length, ch.exercices, "autant de modèles que d'exercices annoncés");
    const ids = new Set(modeles.map((m) => m.id));
    assert.equal(ids.size, modeles.length, "identifiants uniques");
    const banque = JSON.parse(readFileSync(new URL(`data/exercices-${ch.id}.json`, racine), "utf8"));
    for (const m of modeles) {
      const figee = banque.exercices.find((e) => e.id === m.id);
      assert.ok(figee, `${m.id} absent de la banque : relancer tools/generer-exercices.mjs`);
      const r = m.generer(creerAlea(graineDe(m.id)));
      assert.deepEqual(figee.questions.map((q) => q.reponse), r.questions.map((q) => q.reponse),
        `${m.id} : la banque ne correspond plus au modèle — relancer tools/generer-exercices.mjs`);
    }
  });

  test(`${ch.id} — 40 tirages par modèle sans anomalie`, async () => {
    const modeles = (await MODELES[ch.id]()).default;
    for (const m of modeles)
      for (let g = 1; g <= 40; g++) {
        const exo = m.generer(creerAlea(g * 104729 + 17));
        assert.deepEqual(controler(exo), [], `${m.id}, graine ${g * 104729 + 17}`);
      }
  });
}
