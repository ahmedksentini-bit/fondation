// Solveurs des essais, du compactage, des cubatures et des engins : valeurs
// de référence des normes, exemples du fascicule 2 du GTR 2024 (annexe 4) et
// cas à solution exacte.
import test from "node:test";
import assert from "node:assert/strict";
import { teneurEau, etat, tamisage, diametreStokes, wLCasagrande, wLUnPoint, wLCone, atterberg, abaqueCasagrande, vbs, equivalentSable } from "../src/gtr/identification.js";
import { optimum, rhoDSaturation, wSaturation, energie, volumeMoule, MOULES } from "../src/gtr/proctor.js";
import { indicePortant, plaque, dynaplaque, bicouche, epaisseurPour, classePlateforme, classeArase } from "../src/gtr/portance.js";
import { losAngeles, microDeval, fragmentabilite } from "../src/gtr/roches.js";
import { applications, debitParLargeur, debitPratique, prescrire, mixte, controleAtelier, controleDensite, profilDensification } from "../src/gtr/compactage.js";
import { profilTravers, surfacesEntre, volumes, epure, repartition, prismoide } from "../src/gtr/cubatures.js";
import { pelle, tombereau, atelier } from "../src/gtr/engins.js";
import { quantite, chauxVive, dosagePour, classeGel, penteGel } from "../src/gtr/traitement.js";
import { penteInfinie, cercleCritique } from "../src/gtr/stabilite.js";

const proche = (a, b, tol = 1e-6, msg = "") => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} ≠ ${b}`);

test("identification : teneur en eau, état, tamisage", () => {
  proche(teneurEau({ mh: 120, ms: 100 }), 20);
  const e = etat({ rho: 2.04, w: 20, rhoS: 2.7 });
  proche(e.rhoD, 1.7);
  proche(e.Sr, (20 * 2.7) / (2.7 / 1.7 - 1), 1e-9);
  const t = tamisage({ masseSeche: 1000, refus: [[20, 50], [10, 150], [2, 300], [0.063, 350]] });
  assert.deepEqual(t.lignes.map((l) => Math.round(l.passant)), [95, 80, 50, 15]);
  proche(t.pctFond, 15);
});

test("sédimentométrie : loi de Stokes", () => {
  // Hr = 0,15 m, t = 3 600 s, ρs = 2,65, η = 1 mPa·s → D ≈ 6,8 µm
  proche(diametreStokes({ Hr: 0.15, t: 3600 }), 0.00681, 0.0001);
});

test("Atterberg : wL à 25 coups, à un point, au cône ; abaque", () => {
  const c = wLCasagrande([[15, 52], [25, 48], [35, 45.7]]);
  proche(c.wL, 48, 0.2);
  proche(wLUnPoint({ N: 25, w: 40 }), 40);
  proche(wLCone([[15, 40], [20, 44], [25, 48]]).wL, 44);
  const a = atterberg({ wL: 48, wP: 22, w: 30 });
  proche(a.IP, 26); proche(a.Ic, 18 / 26);
  assert.equal(abaqueCasagrande({ wL: 48, IP: 26 }).code, "Ap");
  assert.equal(abaqueCasagrande({ wL: 60, IP: 20 }).code, "Lt");
});

test("valeur de bleu et équivalent de sable", () => {
  // 30 cm³ de solution à 10 g/L sur 60 g de 0/5 mm, 50 % de 0/5 dans le sol
  proche(vbs({ V: 30, m0: 60, C: 0.5 }).VBS, 0.25);
  proche(equivalentSable({ h1: 200, h2: 90 }), 45);
});

test("Proctor : énergie normale, optimum d'une parabole exacte, saturation", () => {
  proche(energie("normal", "A"), 595, 2);
  proche(volumeMoule(MOULES.A), 942.5, 0.1);
  const f = (w) => 1.9 - 0.004 * (w - 14) ** 2;
  const o = optimum([10, 12, 14, 16, 18].map((w) => [w, f(w)]));
  proche(o.wOPN, 14, 1e-6); proche(o.rhoDOPN, 1.9, 1e-9);
  proche(wSaturation(rhoDSaturation(15, { rhoS: 2.7 }), 2.7), 15, 1e-9);
  assert.equal(optimum([[10, 1.9], [12, 1.85], [14, 1.8]]).applicable, false, "optimum non encadré");
});

test("IPI et CBR : forces de référence, correction d'origine", () => {
  const r = indicePortant([[0, 0], [1, 1.5], [2, 3], [2.5, 4.005], [3, 4.6], [4, 5.5], [5, 6], [6, 6.4]], { corriger: false });
  proche(r.i25, 30, 1e-6); proche(r.i5, 30, 1e-6);
  const concave = indicePortant([[0, 0], [0.5, 0.05], [1, 0.3], [1.5, 1.1], [2, 2], [2.5, 2.8], [3, 3.5], [4, 4.6], [5, 5.4], [6, 6], [7, 6.4]]);
  assert.ok(concave.decalage > 0.3, "origine corrigée");
  assert.ok(concave.indice > indicePortant([[0, 0], [0.5, 0.05], [1, 0.3], [1.5, 1.1], [2, 2], [2.5, 2.8], [3, 3.5], [4, 4.6], [5, 5.4], [6, 6], [7, 6.4]], { corriger: false }).indice);
});

test("plaque, dynaplaque, classes PF et AR", () => {
  const p = plaque({ z1: 1.5, z2: 0.9 });
  proche(p.EV1, 75); proche(p.EV2, 100); proche(p.k, 100 / 75);
  proche(dynaplaque({ enfoncements: [0.45, 0.45, 0.45] }).Evd, 50);
  assert.equal(classePlateforme(85), "PF2qs");
  assert.equal(classePlateforme(50), "PF2");
  assert.equal(classePlateforme(15), "hors classe (< 20 MPa)");
  assert.equal(classeArase(19.9), "AR0");
  assert.equal(classeArase(120), "AR3");
});

test("bicouche : limites exactes et épaisseur pour un module visé", () => {
  proche(bicouche({ E1: 200, E2: 20, h: 0 }).Es, 20, 1e-9);
  assert.ok(bicouche({ E1: 200, E2: 20, h: 50 }).Es > 190, "une couche très épaisse impose son propre module");
  const h = epaisseurPour({ E1: 150, E2: 20, Evise: 50 });
  proche(bicouche({ E1: 150, E2: 20, h }).Es, 50, 1e-6);
});

test("roches : LA, MDE, fragmentabilité", () => {
  proche(losAngeles({ passant16: 1250 }), 25);
  proche(microDeval({ refus16: 425 }), 15);
  proche(fragmentabilite({ D10avant: 12, D10apres: 1.5 }), 8);
});

test("compactage : exemples de l'annexe 4 du fascicule 2", () => {
  // Sol S1 en remblai, P1 code 2 : Q/S 0,060 ; e 0,30 ; V 5 ⇒ N 5 ; Q/L 300 ; k 0,6 ; L 2 m ⇒ 360 m³/h
  assert.equal(applications(0.3, 0.06), 5);
  assert.equal(applications(0.2, 0.06), 4);
  proche(debitParLargeur(0.06, 5), 300);
  proche(debitPratique({ QL: 300, L: 2, k: 0.6 }), 360);
  // V3 code 2 : Q/S 0,120 ; (0,30 ; 5) et (0,75 ; 2) ; e = 0,50 ⇒ V 3, N 5, Q/L 360
  const v3 = { QS: 0.12, options: [{ e: 0.3, V: 5 }, { e: 0.75, V: 2 }] };
  const r = prescrire(v3, 0.5);
  proche(r.V, 3); assert.equal(r.N, 5); proche(r.QL, 360);
  assert.equal(prescrire(v3, 0.8).applicable, false);
  // Mixte P1 + V3 : Q/S 0,180, e 0,30, V 5, N 2, Q/L 900
  const m = mixte({ QS: 0.06, e: 0.3, V: 5 }, { QS: 0.12, e: 0.3, V: 5 });
  proche(m.QS, 0.18); assert.equal(m.N, 2); proche(m.QL, 900);
  // Atelier : deux V4 (Q/S 0,05), Q = 2 400 m³, S1 = 24 000 m², S2 = 18 000 m² ⇒ 0,875 < 1
  const a = controleAtelier({ Q: 2400, engins: [{ S: 24000, QStableau: 0.05 }, { S: 18000, QStableau: 0.05 }] });
  proche(a.somme, 0.875); assert.equal(a.ok, false);
});

test("compactage : objectifs q4 et q3, profil de densification", () => {
  const c = controleDensite({ rhoDmoy: 1.79, rhoDfc: 1.72, rhoDOPN: 1.88, objectif: "q4" });
  assert.ok(c.okMoyen && !c.okFond);
  assert.equal(controleDensite({ rhoDmoy: 1.86, rhoDfc: 1.81, rhoDOPN: 1.88, objectif: "q3" }).ok, true);
  const p1 = profilDensification({ N: 2, Nref: 6, e: 0.3, eRef: 0.3 }), p2 = profilDensification({ N: 8, Nref: 6, e: 0.3, eRef: 0.3 });
  assert.ok(p2.moyen > p1.moyen && p2.fond < p2.moyen);
});

test("profil en travers : remblai trapézoïdal exact", () => {
  // Terrain plat à 0, plateforme de 10 m à la cote 2, sans dévers, talus 3/2.
  const p = profilTravers({ tn: [[-30, 0], [30, 0]], zAxe: 2, lg: 5, ld: 5, devers: 0, fr: 1.5 });
  proche(p.remblai, ((10 + 16) / 2) * 2, 1e-6);
  proche(p.deblai, 0, 1e-9);
  proche(p.largeurEmprise, 16, 1e-6);
  // Déblai symétrique : terrain à 3, plateforme à 0, talus 1/1 → (10 + 16)/2 × 3
  const d = profilTravers({ tn: [[-30, 3], [30, 3]], zAxe: 0, lg: 5, ld: 5, devers: 0, fd: 1 });
  proche(d.deblai, ((10 + 16) / 2) * 3, 1e-6);
  // Profil mixte sur terrain en pente : déblai et remblai coexistent.
  const m = profilTravers({ tn: [[-30, -3], [30, 3]], zAxe: 0, lg: 5, ld: 5, devers: 0, fd: 1, fr: 1.5 });
  assert.ok(m.deblai > 0 && m.remblai > 0);
  const s = surfacesEntre([[0, 1], [2, -1]], [[0, 0], [2, 0]], 0, 2);
  proche(s.deblai, 0.5); proche(s.remblai, 0.5);
});

test("volumes, épure de Lalanne et ligne de répartition", () => {
  const v = volumes([{ x: 0, deblai: 10, remblai: 0 }, { x: 20, deblai: 30, remblai: 0 }, { x: 40, deblai: 0, remblai: 20 }]);
  proche(v.total.deblai, 400 + 300); proche(v.total.remblai, 200);
  proche(prismoide({ d: 10, S1: 2, Sm: 3, S2: 4 }), 30);
  const e = epure([{ de: 0, a: 100, deblai: 1000, remblai: 0 }, { de: 100, a: 200, deblai: 0, remblai: 1000 }]);
  proche(e.solde, 0);
  const r = repartition(e.points, 0);
  assert.equal(r.boucles.length, 1);
  proche(r.boucles[0].volume, 1000);
  proche(r.boucles[0].moment, 100000); // triangle : 200 m × 1 000 m³ / 2
  proche(r.boucles[0].distance, 100);
  // Ligne relevée à 300 m³ : le déblai d'avant la boucle part en dépôt (+),
  // le remblai d'après la boucle vient d'un emprunt (−).
  const h = repartition(e.points, 300);
  proche(h.boucles[0].volume, 700);
  proche(h.debut, 300);
  proche(h.fin, -300);
});

test("engins : pelle, tombereau, atelier", () => {
  const p = pelle({ q: 2, kr: 0.9, E: 0.83, tc: 20, Cf: 1.25 });
  proche(p.Q, (3600 * 1.8 * 0.83) / (20 * 1.25));
  const t = tombereau({ capacite: 14, godet: 2, kr: 0.9, tcPelle: 20, distance: 1000, vCharge: 20, vVide: 36, tFixe: 120 });
  assert.equal(t.godets, 8); proche(t.tAller, 180); proche(t.tRetour, 100);
  const a = atelier({ q: 2, capacite: 14, distance: 1000 });
  assert.ok(a.nSature >= 3 && a.Q <= a.pelle.Q + 1e-9);
});

test("traitement : quantités, chaux vive, gel", () => {
  proche(quantite({ dosage: 2, rhoD: 1.7, e: 0.35 }).q, 11.9);
  const c = chauxVive({ w: 25, dosage: 2, eta: 0.5 });
  assert.ok(c.baisse > 1.5 && c.baisse < 2.2, `baisse ${c.baisse}`);
  proche(chauxVive({ w: 25, dosage: dosagePour({ w: 25, wVise: 22 }), eta: 0.5 }).wFinal, 22, 1e-6);
  assert.equal(classeGel(0.05).classe, "SGn");
  assert.equal(classeGel(0.3).classe, "SGp");
  assert.equal(classeGel(0.5).classe, "SGt");
  proche(penteGel([[100, 1], [400, 2]]), 0.1, 1e-9);
});

test("stabilité : talus frottant proche de la pente infinie", () => {
  proche(penteInfinie({ phi: 30, beta: Math.atan(1 / 2) / (Math.PI / 180) }), Math.tan(Math.PI / 6) / 0.5, 1e-9);
  const r = cercleCritique({ H: 6, f: 2, c: 0, phi: 30 });
  assert.ok(r.F > 1.1 && r.F < 1.35, `F = ${r.F}`);
  const coh = cercleCritique({ H: 6, f: 1.5, c: 10, phi: 25 });
  assert.ok(coh.F > 1, `F = ${coh.F}`);
});

test("tableaux de compactage : recherche et lecture", async () => {
  const { tableauCompactage, celluleCompactage, prescrire } = await import("../src/gtr/compactage.js");
  const t = tableauCompactage("F1");
  assert.equal(t.tableau.page, 75);
  const v3 = celluleCompactage(t, "V3", "3");
  proche(v3.QS, 0.125); assert.equal(v3.options.length, 2);
  assert.equal(celluleCompactage(t, "PQ3", "3"), null, "PQ3 ne convient pas");
  const p = prescrire(celluleCompactage(t, "V3", "3"), 0.4);
  proche(p.V, (0.5 * 2.5) / 0.4); assert.equal(p.N, 4);
  assert.equal(tableauCompactage("S3ins").tableau.page, 82);
  assert.equal(tableauCompactage("S3").tableau.page, 81);
  assert.equal(tableauCompactage("VC1G3").tableau.page, 84);
  assert.equal(tableauCompactage("F2", { usage: "couche de forme" }).tableau.page, 91);
});

test("compactage en couche de forme : sables et graves non traités lus par leur nature", async () => {
  const { tableauCompactage } = await import("../src/gtr/compactage.js");
  const s = tableauCompactage("S11", { usage: "couche de forme", traite: false });
  assert.ok(s && /^Sables/.test(s.ligne.libelle), "sable non traité");
  const g = tableauCompactage("G11", { usage: "couche de forme", traite: false, forme: "roulés" });
  assert.ok(g && /roulés/.test(g.ligne.libelle));
  const ga = tableauCompactage("VC2G31", { usage: "couche de forme", traite: false });
  assert.ok(ga && /anguleuses/.test(ga.ligne.libelle));
  const t = tableauCompactage("S1", { usage: "couche de forme", traite: true });
  assert.ok(t && t.ligne.traitement !== "non traité", "le même sable traité");
});

test("classes de compacteurs (NF P98-736)", async () => {
  const { classeCompacteur } = await import("../src/gtr/compactage.js");
  assert.equal(classeCompacteur("P", { CR: 50 }).classe, "P2");
  assert.equal(classeCompacteur("V", { M1L: 30, A0: 1.2 }).classe, "V2", "30·√1,2 = 32,9, entre 25 et 40 : V2 malgré A0 ≥ 1");
  assert.equal(classeCompacteur("V", { M1L: 40, A0: 1.2 }).classe, "V3", "40·√1,2 = 43,8 et A0 ≥ 1 : V3");
  assert.equal(classeCompacteur("V", { M1L: 50, A0: 0.9 }).classe, "V2", "paramètre 47 (V3) mais A0 < 1 : V2");
  assert.equal(classeCompacteur("V", { M1L: 60, A0: 1.7 }).classe, "V5");
  assert.equal(classeCompacteur("VP", { M1L: 20, A0: 1.5 }).classe, "VP1");
  assert.equal(classeCompacteur("SP", { M1L: 70 }).classe, "SP2");
  assert.equal(classeCompacteur("PQ", { MgS: 12 }).classe, "PQ3");
  assert.equal(classeCompacteur("V", { M1L: 10, A0: 1 }).applicable, false);
});

test("gammadensimètre : densités des tranches par différence", async () => {
  const { densiteTranche, tranchesDensite } = await import("../src/gtr/compactage.js");
  // Couche de 30 cm : 1,82 / 1,80 / 1,77 / 1,73 sur 0–10, 10–15, 15–22, 22–30 cm.
  const vrai = [[10, 1.82], [15, 1.8], [22, 1.77], [30, 1.73]];
  let M = 0, z0 = 0;
  const mesures = vrai.map(([z, r]) => { M += (z - z0) * r; z0 = z; return { z, rho: M / z }; });
  const t = tranchesDensite(mesures);
  t.forEach((x, i) => assert.ok(Math.abs(x.rho - vrai[i][1]) < 1e-9));
  assert.ok(Math.abs(densiteTranche(mesures, 22, 30).rho - 1.73) < 1e-9, "fond de couche");
  assert.ok(Math.abs(densiteTranche(mesures, 0, 30).rho - mesures[3].rho) < 1e-9, "moyenne de la couche");
  assert.ok(Math.abs(densiteTranche(mesures, 18, 26).rho - (4 * 1.77 + 4 * 1.73) / 8) < 1e-9, "tranche à cheval");
  assert.equal(densiteTranche(mesures, 25, 35).applicable, false);
});

test("matériaux traités : zones de l'abaque et classes mécaniques", async () => {
  const { zoneMecanique, classeMecanique, rtFrontiere, FRONTIERES_ZONES } = await import("../src/gtr/traitement.js");
  assert.ok(Math.abs(rtFrontiere(FRONTIERES_ZONES[1], 4932) - 0.5) < 1e-9, "point lu sur la frontière 2");
  assert.equal(zoneMecanique({ E: 10000, Rt: 2 }).zone, 1);
  assert.equal(zoneMecanique({ E: 10000, Rt: 0.5 }).zone, 3);
  assert.equal(zoneMecanique({ E: 10000, Rt: 0.2 }).zone, null, "sous la zone 5");
  assert.equal(classeMecanique(2, "centrale"), 2);
  assert.equal(classeMecanique(2, "place"), 3);
  assert.equal(classeMecanique(5, "place"), null);
  // Les frontières ne se croisent pas.
  for (const E of [1000, 3000, 10000, 30000, 50000]) for (let k = 1; k < 5; k++) assert.ok(rtFrontiere(FRONTIERES_ZONES[k - 1], E) > rtFrontiere(FRONTIERES_ZONES[k], E));
});

test("couche de forme : Lmax et épaisseurs du GTR 2000", async () => {
  const { lmaxCoucheForme, epaisseur2000 } = await import("../src/gtr/couche-forme.js");
  assert.equal(lmaxCoucheForme(0.3), 150);
  assert.equal(lmaxCoucheForme(0.45), 225);
  assert.equal(lmaxCoucheForme(0.6), 250, "tableau 13 : plafonné à 250 mm");
  assert.equal(epaisseur2000({ type: "nonTraite", ar: "AR1", pf: "PF3" }).e, 0.8);
  assert.equal(epaisseur2000({ type: "grenuTraite", ar: "AR2", classe: 4, pf: "PF4" }).e, 0.35);
  assert.equal(epaisseur2000({ type: "grenuTraite", ar: "AR1", classe: 3, pf: "PF2" }).e, 0.3);
  assert.equal(epaisseur2000({ type: "finChaux", ar: "AR3", pf: "PF3" }).applicable, false);
});

test("aptitude au traitement (NF P94-100)", async () => {
  const { aptitudeTraitement } = await import("../src/gtr/traitement.js");
  assert.equal(aptitudeTraitement({ Gv: 3, Rtb: 0.25 }).verdict, "apte");
  assert.equal(aptitudeTraitement({ Gv: 7, Rtb: 0.25 }).verdict, "douteux");
  assert.equal(aptitudeTraitement({ Gv: 3, Rtb: 0.15 }).verdict, "douteux");
  assert.equal(aptitudeTraitement({ Gv: 12, Rtb: 0.3 }).verdict, "inapte");
  assert.equal(aptitudeTraitement({ Gv: 2, Rtb: 0.05 }).verdict, "inapte");
});

test("gel : pente de gonflement, classes et profondeur de Stefan", async () => {
  const { classeGel, penteGel } = await import("../src/gtr/traitement.js");
  const { sensibiliteGel, profondeurGelStefan } = await import("../src/gtr/gel.js");
  assert.equal(classeGel(0.05).classe, "SGn");
  assert.equal(classeGel(0.3).classe, "SGp");
  assert.equal(classeGel(0.41).classe, "SGt");
  const p = penteGel([[100, 0.3 * 10], [400, 0.3 * 20], [900, 0.3 * 30]]);
  assert.ok(Math.abs(p - 0.3) < 1e-9);
  assert.equal(sensibiliteGel({ nature: "F1" }).classe, "SGt");
  assert.equal(sensibiliteGel({ nature: "F3" }).classe, "SGp");
  assert.equal(sensibiliteGel({ nature: "G1", insensibleEau: true, LA: 30, MDE: 20 }).classe, "SGn");
  assert.equal(sensibiliteGel({ nature: "F2", traitement: "chaux", Rc: 2.6 }).classe, "SGn");
  const z = profondeurGelStefan({ I: 300, lambda: 1.8, w: 8, rhoD: 2 });
  assert.ok(z > 1.2 && z < 1.45, `Stefan ≈ 1,33 m (${z})`);
});
