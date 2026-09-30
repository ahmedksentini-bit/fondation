// Consolidation et remblais : chaque formule du chapitre 16 retrouve les
// valeurs de référence (tables de Terzaghi, cas limites), et le solveur par
// différences finies retrouve les solutions analytiques.
import test from "node:test";
import assert from "node:assert/strict";
import * as K from "../src/geotech/consolidation.js";
import { tassementOedometrique, boussinesqAxe } from "../src/geotech/tassements.js";

const proche = (obtenu, attendu, tol, msg) =>
  assert.ok(Math.abs(obtenu - attendu) <= tol, `${msg} : obtenu ${obtenu}, attendu ${attendu} (± ${tol})`);

test("Terzaghi — degrés moyens des tables classiques", () => {
  // Table usuelle : U = 20 % → Tv = 0,031 ; 50 % → 0,197 ; 90 % → 0,848 ; 95 % → 1,129.
  proche(K.degreConsolidation(0.0314), 0.2, 0.001, "U(0,031)");
  proche(K.degreConsolidation(0.197), 0.5, 0.001, "U(0,197)");
  proche(K.degreConsolidation(0.848), 0.9, 0.001, "U(0,848)");
  proche(K.degreConsolidation(1.129), 0.95, 0.001, "U(1,129)");
  // Raccord de l'approximation des petits temps avec la série.
  let serie = 0;
  for (let m = 0; m < 200; m++) { const M = (Math.PI * (2 * m + 1)) / 2; serie += (2 / (M * M)) * Math.exp(-M * M * 0.05); }
  proche(K.degreConsolidation(0.05), 1 - serie, 1e-6, "raccord à Tv = 0,05");
  assert.equal(K.degreConsolidation(0), 0);
});

test("Terzaghi — le facteur temps est l'inverse du degré moyen", () => {
  proche(K.facteurTemps(0.5), 0.1967, 0.0005, "Tv(50 %)");
  proche(K.facteurTemps(0.9), 0.848, 0.001, "Tv(90 %)");
  for (const U of [0.1, 0.3, 0.6, 0.8, 0.99]) proche(K.degreConsolidation(K.facteurTemps(U)), U, 1e-6, `aller-retour U = ${U}`);
});

test("Terzaghi — la moyenne des isochrones vaut 1 − U", () => {
  for (const Tv of [0.01, 0.1, 0.3, 0.7]) {
    const n = 400;
    let moy = 0;
    for (let i = 0; i < n; i++) moy += K.surpressionRelative(Tv, (i + 0.5) / n) / n;
    proche(moy, 1 - K.degreConsolidation(Tv), 0.003, `Tv = ${Tv}`);
  }
  proche(K.surpressionRelative(0.2, 0), 0, 1e-9, "face drainante");
  proche(K.surpressionRelative(0.2, 0.6), K.surpressionRelative(0.2, 1.4), 1e-9, "symétrie en drainage double");
});

test("drains — diamètre d'influence, facteur de Hansbo, combinaison de Carrillo", () => {
  proche(K.diametreInfluence(1, "triangle"), 1.050, 0.001, "maille triangulaire");
  proche(K.diametreInfluence(1, "carre"), 1.128, 0.001, "maille carrée");
  proche(K.diametreDrainBande(0.1, 0.004), 0.0662, 0.0001, "bande 100 × 4 mm");
  proche(K.facteurDrain({ n: 20 }), Math.log(20) - 0.75, 1e-12, "Barron simplifié");
  proche(K.facteurDrain({ n: 20, s: 2, kRapport: 3 }), Math.log(10) + 3 * Math.log(2) - 0.75, 1e-12, "Hansbo avec remaniement");
  const r = K.degreRadial({ ch: 3, t: 0.5, De: 1.5, F: 2.2 });
  proche(r.Uh, 1 - Math.exp((-8 * (3 * 0.5) / 2.25) / 2.2), 1e-12, "Uh");
  proche(K.combinerCarrillo(0.3, 0.8), 1 - 0.7 * 0.2, 1e-12, "Carrillo");
});

test("drains — l'espacement trouvé donne bien le degré visé", () => {
  const d = { cv: 1.5, ch: 3, Hd: 8, t: 0.5, dw: 0.066, maille: "triangle", s: 2, kRapport: 2 };
  const e = K.espacementDrains({ ...d, Ucible: 0.9 });
  assert.ok(e.espacement > 0.5 && e.espacement < 10, `espacement ${e.espacement}`);
  proche(K.consolidationAvecDrains({ ...d, espacement: e.espacement }).U, 0.9, 1e-6, "U au temps visé");
  const t = K.tempsPourDegre({ ...d, U: 0.9, espacement: e.espacement });
  proche(t, 0.5, 1e-4, "temps pour 90 % avec cet espacement");
  assert.equal(K.espacementDrains({ ...d, Hd: 0.8, Ucible: 0.9 }).espacement, Infinity, "couche mince : pas besoin de drains");
});

test("remblai — Flamant intégré retrouve Boussinesq, Osterberg et la charge en surface", () => {
  const bande = [[-2, 100], [2, 100]];
  for (const z of [0.5, 2, 6]) proche(K.contrainteSousBande(bande, 0, z), boussinesqAxe({ forme: "filante", B: 4, q: 100, z }), 1e-9, `bande uniforme, z = ${z}`);
  const p = K.profilRemblai({ H: 4, largeurCrete: 12, fruit: 2, q: 80 });
  for (const z of [1, 5, 15]) proche(K.contrainteSousBande(p, 0, z), K.osterbergAxe({ q: 80, a: 8, b: 6, z }), 1e-9, `Osterberg, z = ${z}`);
  proche(K.contrainteSousBande(p, 0, 1e-12), 80, 1e-9, "sous la crête, en surface");
  proche(K.contrainteSousBande(p, -10, 1e-12), 40, 1e-9, "à mi-talus, en surface");
  assert.ok(K.contrainteSousBande(p, 0, 40) < 30, "la charge se diffuse en profondeur");
});

test("tassement primaire — une tranche redonne la formule œdométrique", () => {
  const couches = [{ z0: 0, z1: 4, gamma: 16, e0: 1.5, Cc: 0.6, Cs: 0.06, pop: 10 }];
  const r = K.tassementPrimaire({ couches, dSigma: () => 60, zw: 0, epaisseurTranche: 4 });
  const svp = (16 - 10) * 2;
  proche(r.s, tassementOedometrique({ H: 4, e0: 1.5, Cc: 0.6, Cs: 0.06, sigmaV0: svp, sigmaP: svp + 10, dSigma: 60 }).s, 1e-9, "une tranche");
  const fine = K.tassementPrimaire({ couches, dSigma: () => 60, zw: 0, epaisseurTranche: 0.25 });
  assert.ok(fine.s > r.s, "le découpage fin augmente le tassement : le haut de la couche, moins contraint au départ, tasse davantage");
  proche(K.preconsolidation(50, { ocr: 1.5, pop: 10 }), 75, 1e-12, "σ'p = max(OCR σ'v0 ; σ'v0 + POP)");
});

test("fluage, construction et hauteur à mettre en œuvre", () => {
  proche(K.compressionSecondaire({ H: 5, e0: 1.2, Calpha: 0.02, tp: 2, t: 20 }), (5 * 0.02) / 2.2 * 1000, 1e-9, "une décade de fluage");
  assert.equal(K.compressionSecondaire({ H: 5, e0: 1.2, Calpha: 0.02, tp: 2, t: 1 }), 0);
  const degre = (t) => K.degreConsolidation(t / 4);
  proche(K.tassementAvecConstruction({ sInf: 1, t: 1, tc: 2, degre }), degre(0.5) * 0.5, 1e-12, "pendant la construction");
  proche(K.tassementAvecConstruction({ sInf: 1, t: 5, tc: 2, degre }), degre(4), 1e-12, "après la construction");
  // Tassement proportionnel à la charge : point fixe calculable à la main.
  const c = 0.004, g = 20, Hf = 3, zw = 0.1;
  const r = K.hauteurMiseEnOeuvre({ Hfinale: Hf, gamma: g, zw, tassement: (H, q) => c * q });
  // s = c (γ (Hf + s) − γw (s − zw)) ⇒ s = c (γ Hf + γw zw)/(1 − c γ + c γw)
  proche(r.s, (c * (g * Hf + 10 * zw)) / (1 - c * g + c * 10), 1e-6, "tassement avec déjaugeage");
  proche(r.H, Hf + r.s, 1e-9, "H = Hfinale + s");
  // Hauteur mise en œuvre donnée : s = c (γ H − γw (s − zw)).
  const m = K.tassementDejauge({ H: 3.2, gamma: g, zw, tassement: (H, q) => c * q });
  proche(m.s, (c * (g * 3.2 + 10 * zw)) / (1 + c * 10), 1e-6, "tassement déjaugé, hauteur donnée");
  proche(m.q, g * 3.2 - 10 * (m.s - zw), 1e-9, "charge déjaugée");
});

test("construction par étapes — hauteurs successives et limite H∞", () => {
  const r = K.constructionParEtapes({ cu0: 15, gamma: 20, Hfinale: 20, F: 1.5, lambdaCu: 0.25, U: 0.7 });
  proche(r.H1, ((Math.PI + 2) * 15) / 30, 1e-12, "première étape");
  proche(r.etapes[0].H, r.H1, 1e-12, "l'étape 1 monte à H1");
  assert.equal(r.atteinte, false, "20 m est hors de portée");
  assert.ok(r.etapes.at(-1).H < r.Hinf && r.etapes.at(-1).H > 0.9 * r.Hinf, "les étapes tendent vers H∞");
  const s = K.constructionParEtapes({ cu0: 15, gamma: 20, Hfinale: 4, F: 1.5, lambdaCu: 0.25, U: 0.7 });
  assert.equal(s.atteinte, true);
  assert.equal(s.etapes.at(-1).H, 4);
});

test("Asaoka — retrouve s∞ et cv sur une courbe de Terzaghi (premier terme)", () => {
  const sInf = 850, cv = 1.2, Hd = 6;
  const s = (t) => sInf * (1 - (8 / Math.PI ** 2) * Math.exp((-(Math.PI ** 2) * cv * t) / (4 * Hd * Hd)));
  const mesures = Array.from({ length: 12 }, (_, i) => [2 + 0.5 * i, s(2 + 0.5 * i)]);
  const r = K.asaoka(mesures);
  assert.ok(r.applicable);
  proche(r.sInf, sInf, 1e-6, "s∞");
  proche(K.cvAsaoka({ beta1: r.beta1, pas: r.pas, Hd }), cv, 1e-9, "cv");
  assert.equal(K.asaoka(mesures.slice(0, 3)).applicable, false, "trop peu de mesures");
});

test("différences finies — une couche homogène redonne Terzaghi et Carrillo", () => {
  const H = 10, cv = 2, N = 100, dz = H / N;
  const tranches = Array.from({ length: N }, () => ({ dz, cv, mv: 1e-3 }));
  const degreFD = (solveur, tFin, pasMax = 0.005) => {
    const q = new Float64Array(N).fill(100);
    let t = 0, dt = 1e-5;
    solveur.pas(1e-9, q);
    while (t < tFin - 1e-12) { const h = Math.min(dt, tFin - t, pasMax); solveur.pas(h, q); t += h; dt *= 1.15; }
    return 1 - solveur.u.reduce((a, b) => a + b, 0) / (100 * N);
  };
  // Drainage double : Hd = 5 m ; Tv = 0,197 → t = 0,197 × 25/2.
  proche(degreFD(K.solveurConsolidation({ tranches, basDrainant: true }), (0.197 * 25) / 2), 0.5, 0.01, "drainage double, U = 50 %");
  // Drainage simple : Hd = 10 m ; Tv = 0,848.
  proche(degreFD(K.solveurConsolidation({ tranches, basDrainant: false }), (0.848 * 100) / 2, 0.05), 0.9, 0.01, "drainage simple, U = 90 %");
  // Drains : r = 8 ch/(De² F) ; Carrillo pour un chargement instantané.
  const De = K.diametreInfluence(1.5), F = K.facteurDrain({ n: De / 0.066 }), ch = 4, r = (8 * ch) / (De * De * F);
  const t = 0.1, attendu = K.consolidationAvecDrains({ cv, ch, Hd: 5, t, espacement: 1.5, dw: 0.066 }).U;
  proche(degreFD(K.solveurConsolidation({ tranches: tranches.map((x) => ({ ...x, r })), basDrainant: true }), t, 0.001), attendu, 0.01, "drains verticaux");
});

test("différences finies — une couche drainante coupe la couche en deux", () => {
  const N = 100, dz = 0.1;
  const tranches = Array.from({ length: N }, (_, i) => ({ dz, cv: 1, mv: 1e-3, drainante: i >= 48 && i < 52 }));
  const s = K.solveurConsolidation({ tranches, basDrainant: false });
  const q = new Float64Array(N).fill(50);
  s.pas(1e-9, q);
  for (let i = 0; i < 200; i++) s.pas(0.002, q);
  assert.equal(s.u[50], 0, "la surpression est nulle dans la couche drainante");
  assert.ok(s.u[30] < 50 && s.u[70] < 50 && s.u[99] > s.u[70], "l'eau s'évacue vers le sable intercalé");
});
