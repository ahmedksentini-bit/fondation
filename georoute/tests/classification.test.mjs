// Classification GTR 2024 : les exemples du guide (F1 tableau 6) et les
// seuils des tableaux de l'annexe 1 du fascicule 2, aux bornes.
import test from "node:test";
import assert from "node:assert/strict";
import { classerSol, classerRoche, etatHydrique, insensible, contient, enClair, ETATS_2024 } from "../src/gtr/classification.js";
import { analyser, passant, diametre, etalement } from "../src/gtr/granulo.js";

test("exemples du tableau 6 du fascicule 1", () => {
  assert.equal(classerSol({ Dmax: 30, p63um: 60, IP: 25 }).sousClasse, "F3");
  const s = classerSol({ Dmax: 50, p63um: 12, p2mm: 60, Cu: 25, fractionSable: 48, fractionGrave: 40 });
  assert.equal(s.classe, "S");
  assert.equal(s.sousClasse, "S3");
  const v = classerSol({ Dmax: 80, p63um: 4, p2mm: 40, Cu: 50, fractionSable: 36, fractionGrave: 60, fraction063: 95, forme: "anguleux" });
  assert.equal(v.vc, "VC2");
  assert.ok(v.symbole.startsWith("VC2G1"), v.symbole);
});

test("intervalles : bornes ouvertes et fermées comme dans les tableaux", () => {
  assert.ok(contient("(3,8]", 8) && !contient("(3,8]", 3));
  assert.ok(contient("[1.1,1.25)", 1.1) && !contient("[1.1,1.25)", 1.25));
  assert.ok(contient("(,0.7)", 0.69) && !contient("(,0.7)", 0.7));
  assert.equal(enClair("(3,8]", "IPI"), "3 < IPI ≤ 8");
  assert.equal(enClair("[1.25,)", "wn", " wOPN"), "wn ≥ 1,25 wOPN");
});

test("argilosité : la VBS sous IP = 12, l'IP au-delà", () => {
  // IP = 10 (F1) mais VBS = 4 (F2) : la VBS prime pour les sols peu plastiques.
  assert.equal(classerSol({ Dmax: 20, p63um: 70, IP: 10, VBS: 4 }).sousClasse, "F2");
  // IP = 30 (F3) mais VBS = 3 (F2) : l'IP prime dès qu'il dépasse 12.
  assert.equal(classerSol({ Dmax: 20, p63um: 70, IP: 30, VBS: 3 }).sousClasse, "F3");
  assert.equal(classerSol({ Dmax: 20, p63um: 70, IP: 22 }).sousClasse, "F2");
  assert.equal(classerSol({ Dmax: 20, p63um: 70, IP: 22.1 }).sousClasse, "F3");
  assert.equal(classerSol({ Dmax: 20, p63um: 70, IP: 56 }).sousClasse, "F4+");
  assert.equal(classerSol({ Dmax: 20, p63um: 25, VBS: 1.5 }).sousClasse, "I1");
  assert.equal(classerSol({ Dmax: 20, p63um: 25, VBS: 1.6 }).sousClasse, "I2");
  assert.equal(classerSol({ Dmax: 20, p63um: 35, VBS: 1 }).classe, "I", "35 % exactement reste un sol I");
  assert.equal(classerSol({ Dmax: 20, p63um: 35.1, VBS: 1 }).classe, "F");
});

test("états hydriques des sols fins : un exemple par ligne", () => {
  const F1 = (m) => etatHydrique("F1", m).etat;
  assert.equal(F1({ IPI: 3 }), "th");
  assert.equal(F1({ IPI: 5 }), "h");
  assert.equal(F1({ w: 12, wOPN: 10 }), "h", "1,2 wOPN : F1h");
  assert.equal(F1({ w: 8, wOPN: 10 }), "s");
  assert.equal(F1({ w: 6.9, wOPN: 10 }), "ts");
  assert.equal(etatHydrique("F2", { Ic: 1.1 }).etat, "m");
  assert.equal(etatHydrique("F3", { w: 12.5, wOPN: 10 }).etat, "h");
  assert.equal(etatHydrique("F4", { Ic: 1.25 }).etat, "ts");
  // Remarque du guide : wn entre 1,1 et 1,25 wOPN sans IPI strictement entre 3 et 8.
  const d = etatHydrique("F1", { IPI: 12, w: 11.5, wOPN: 10 });
  assert.equal(d.etat, "m", "l'IPI dit que le sol porte : il l'emporte pour les états humides");
  assert.ok(d.discordance);
});

test("sables et graves : sensibilité à l'eau et suffixe ins", () => {
  assert.equal(insensible("S", { p63um: 4, VBS: 0.15 }).ins, true);
  assert.equal(insensible("S", { p63um: 8, VBS: 0.15 }).ins, false);
  assert.equal(insensible("S", { p63um: 11, VBS: 0.08, CBRi: 25 }).ins, true);
  assert.equal(insensible("G", { p63um: 8, VBS: 0.15, CBRi: 25 }).ins, true, "graves : 5–10 %, 0,1 ≤ VBS < 0,2 et CBRi > 20");
  assert.equal(insensible("S", { p63um: 8, VBS: 0.15, CBRi: 25 }).ins, false, "ce cas n'existe pas pour les sables");
  const s = classerSol({ Dmax: 10, p63um: 3, p2mm: 90, Cu: 3, VBS: 0.05, FS: 40 });
  assert.equal(s.symbole, "S21ins");
  const g = classerSol({ Dmax: 40, p63um: 9, p2mm: 35, Cu: 30, VBS: 0.5, LA: 30, MDE: 20, IPI: 10, w: 7, wOPN: 6 });
  assert.equal(g.symbole, "G31h");
});

test("sables : seuils d'état selon le tamisat à 2 mm", () => {
  const fin = classerSol({ Dmax: 5, p63um: 10, p2mm: 85, Cu: 4, VBS: 0.8, w: 5.5, wOPN: 10 });
  assert.equal(fin.etat, "s", "tamisat 2 mm > 70 % : s dès 0,5 wOPN");
  const gros = classerSol({ Dmax: 20, p63um: 10, p2mm: 60, Cu: 12, fractionSable: 50, fractionGrave: 40, VBS: 0.8, w: 5.5, wOPN: 10 });
  assert.equal(gros.etat, "ts", "tamisat 2 mm ≤ 70 % : ts sous 0,6 wOPN");
});

test("roches : craies, calcaires, roches argileuses et magmatiques", () => {
  assert.equal(classerRoche("CH", { rhoD: 2 }).sousClasse, "CH1");
  assert.equal(classerRoche("CH", { rhoD: 1.6, wn: 23 }).sousClasse, "CH3m");
  assert.equal(classerRoche("CH", { rhoD: 1.5, wn: 32 }).sousClasse, "CH4th");
  assert.equal(classerRoche("Li", { MDE: 30 }).sousClasse, "R3 Li");
  assert.equal(classerRoche("Li", { MDE: 60, rhoD: 1.7 }).sousClasse, "R5 Li");
  assert.equal(classerRoche("Cl", { IFR: 3, IDGa: 25, MDE: 60 }).sousClasse, "R4 Cld1");
  assert.equal(classerRoche("Cl", { IFR: 10, w: 14, wOPN: 10 }).sousClasse, "R5 Cl th");
  assert.equal(classerRoche("Vo", { LA: 20, MDE: 8 }).sousClasse, "R1 Vo");
  assert.equal(classerRoche("Me", { LA: 40, MDE: 30 }).sousClasse, "R3 Me");
  assert.equal(classerRoche("SR", { gypse: 25 }).sousClasse, "SR3");
});

test("courbe granulométrique : passants, Dx, Cu et fraction 0/63 mm", () => {
  const c = [[0.063, 12], [2, 60], [10, 80], [31.5, 95], [63, 100]];
  assert.ok(Math.abs(passant(c, 2) - 60) < 1e-9);
  const D60 = diametre(c, 60);
  assert.ok(Math.abs(D60 - 2) < 1e-9);
  const a = analyser([[0.063, 9], [2, 45], [63, 90], [125, 100]]);
  assert.ok(Math.abs(a.p63um - 10) < 1e-9, "9 % du total = 10 % de la fraction 0/63 mm");
  assert.ok(Math.abs(a.p2mm - 50) < 1e-9);
  assert.equal(etalement({ Cu: NaN, D60: 0.5 }).etalee, true);
  assert.equal(etalement({ Cu: NaN, D60: 0.3 }).etalee, false);
});

test("chaque ligne d'état a au moins un critère, et les intervalles se lisent", () => {
  for (const [cle, t] of Object.entries(ETATS_2024)) {
    assert.deepEqual(t.lignes.map((l) => l.etat), ["th", "h", "m", "s", "ts"], cle);
    for (const l of t.lignes) for (const p of ["IPI", "Ic", "r"]) if (l[p]) assert.doesNotThrow(() => contient(l[p], 1), `${cle} ${l.etat} ${p}`);
  }
});

test("GTR 1992 : classes A, B, C, D et états", async () => {
  const { classerSol1992 } = await import("../src/gtr/classification92.js");
  assert.equal(classerSol1992({ Dmax: 20, p80um: 60, IP: 30, w: 25, wOPN: 22 }).symbole, "A3m");
  assert.equal(classerSol1992({ Dmax: 20, p80um: 60, VBS: 2, w: 12, wOPN: 15 }).symbole, "A1s");
  assert.equal(classerSol1992({ Dmax: 20, p80um: 60, VBS: 2, w: 12, wOPN: 15 }).sousClasse, "A1");
  assert.equal(classerSol1992({ Dmax: 20, p80um: 20, VBS: 1, IPI: 20, w: 9, wOPN: 9 }).symbole, "B5m");
  assert.equal(classerSol1992({ Dmax: 30, p80um: 8, p2mm: 40, VBS: 0.5, LA: 30, MDE: 20, IPI: 10, w: 7, wOPN: 6 }).symbole, "B41h");
  assert.equal(classerSol1992({ Dmax: 10, p80um: 3, p2mm: 95, VBS: 0.05, FS: 30 }).symbole, "D11");
  assert.equal(classerSol1992({ Dmax: 30, p80um: 6, p2mm: 40, VBS: 0.15, LA: 25, MDE: 20 }).symbole, "B31");
  const c = classerSol1992({ Dmax: 150, p80um: 15, VBS: 2, IPI: 6, fraction050: 85, forme: "anguleux" });
  assert.equal(c.symbole, "C1B6h");
});

test("les deux éditions sur un même sol : les seuils diffèrent", async () => {
  const { classerSol1992 } = await import("../src/gtr/classification92.js");
  // 13 % de fines à 80 µm mais 11 % à 63 µm : B5/B6 en 1992, S3/G3 en 2024.
  const a = classerSol1992({ Dmax: 30, p80um: 13, p2mm: 45, VBS: 0.9 });
  const b = classerSol({ Dmax: 30, p63um: 11, p2mm: 45, Cu: 40, VBS: 0.9 });
  assert.equal(a.sousClasse, "B5");
  assert.equal(b.sousClasse, "G3");
  // IP = 24 : A2 en 1992, F3 en 2024 (seuil passé de 25 à 22).
  assert.equal(classerSol1992({ Dmax: 10, p80um: 80, IP: 24 }).sousClasse, "A2");
  assert.equal(classerSol({ Dmax: 10, p63um: 78, IP: 24 }).sousClasse, "F3");
});
