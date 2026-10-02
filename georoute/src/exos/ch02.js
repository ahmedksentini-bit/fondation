// Exercices du chapitre 2 : identifier un sol — tamisage, courbe
// granulométrique (D10, D60, Cu), fractions sur 0/63 mm, limites d'Atterberg
// et abaque de Casagrande, IP ou VBS, valeur de bleu, équivalent de sable,
// sédimentométrie.
import { fr, frd, nombre, choixMelange, donnee } from "./alea.js";
import {
  tamisage, wLCasagrande, atterberg, abaqueCasagrande, vbs, equivalentSable,
  diametreStokes, viscositeEau, pourcentageSedimento,
} from "../gtr/identification.js";
import { analyser, etalement, passant } from "../gtr/granulo.js";
import { classerSol, SEUILS_2024 } from "../gtr/classification.js";
import { classerSol1992, SOUS_CLASSES_1992 } from "../gtr/classification92.js";
import { courbeGranulo, graphe, COULEURS } from "../figures.js";

const pc = (x, d = 1) => `${frd(x, d)} %`;
const mm = (d) => `${fr(d, 3)} mm`;
const arrondi = (x, n = 1) => Math.round(x * 10 ** n) / 10 ** n;

/**
 * Premier niveau du GTR 2024 pour la fraction 0/63 mm : teneur en fines
 * (tamisat à 63 µm), puis comparaison des fractions 0,063/2 et 2/63 mm
 * [F1 § 2.2.2, synoptique]. C'est la règle que classerSol applique avant
 * l'argilosité ; elle est écrite ici parce que classerSol exige en plus la
 * VBS ou l'IP pour rendre un résultat (fonction propre aux exercices).
 */
function famille(p63um, p2mm) {
  const S = SEUILS_2024.fines;
  if (p63um > S.F) return "F";
  if (p63um > S.IS) return "I";
  return p2mm - p63um > 100 - p2mm ? "S" : "G";
}
const NOMS_FAMILLE = { F: "F : sol fin", I: "I : sol intermédiaire", S: "S : sol sableux", G: "G : sol graveleux" };
const regleFamille = (p63um, p2mm) => {
  const f = famille(p63um, p2mm);
  if (f === "F") return `fines ${pc(p63um)} > 35 % : sol fin F`;
  if (f === "I") return `fines ${pc(p63um)}, entre 15 et 35 % : sol intermédiaire I`;
  return `fines ${pc(p63um)} ≤ 15 % ; sable 0,063/2 mm = ${pc(p2mm - p63um)}, grave 2/63 mm = ${pc(100 - p2mm)} : ${f === "S" ? "le sable l'emporte, sol sableux S" : "la grave l'emporte, sol graveleux G"}`;
};
/** Marge (points de %) entre un sol et les seuils du premier niveau ; on écarte les cas limites. */
const margeFamille = (p63um, p2mm) => Math.min(Math.abs(p63um - 15), Math.abs(p63um - 35), p63um <= 15 ? Math.abs((p2mm - p63um) - (100 - p2mm)) / 2 : Infinity);

/** Courbe lisse : mélange de populations log-logistiques [(part, d50 en mm, raideur)] ; rend la fraction passante (0 à 1). */
const melange = (pops) => (d) => pops.reduce((s, [w, d50, k]) => s + w / (1 + (d50 / d) ** k), 0);
/** Signe moins typographique. */
const sg = (s) => String(s).replace(/^-/, "−");

/** Les deux points de la courbe qui encadrent le passant x, pour détailler une interpolation en log d. */
function encadrement(points, x) {
  for (let i = 1; i < points.length; i++) if (points[i - 1][1] <= x && points[i][1] >= x && points[i][1] > points[i - 1][1]) return [points[i - 1], points[i]];
  return null;
}
const detailDx = (points, x, D) => {
  const e = encadrement(points, x);
  if (!e) return `D${x} = ${mm(D)}.`;
  const [[d0, p0], [d1, p1]] = e;
  return `${x} % tombe entre ${mm(d0)} (${pc(p0)}) et ${mm(d1)} (${pc(p1)}) ; en log d : D${x} = ${fr(d0, 3)} × (${fr(d1, 3)}/${fr(d0, 3)})^((${x} − ${frd(p0, 1)})/(${frd(p1, 1)} − ${frd(p0, 1)})) = ${mm(D)}.`;
};

// Exposants pour écrire une puissance de dix.
const EXP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
const sci = (x, c = 3) => {
  let e = Math.floor(Math.log10(Math.abs(x)));
  if (Math.abs(Number((x / 10 ** e).toPrecision(c))) >= 10) e += 1;
  return `${fr(x / 10 ** e, c)} × 10${String(e).split("").map((ch) => EXP[ch]).join("")}`;
};

export default [
  {
    id: "ch2-tamisage", titre: "Tamisage : des refus aux passants", difficulte: 1,
    generer(a) {
      const TAMIS = [63, 31.5, 16, 8, 4, 2, 1, 0.5, 0.25, 0.125, 0.063];
      let t, M, refus, l2, l63, p2, p63;
      for (let essai = 0; essai < 60; essai++) {
        // Trois populations de grains (fines, sable, grave) ; la cible règle leurs parts.
        const cible = a.choix(["S", "G", "I", "F"]);
        const w1 = cible === "F" ? a.entre(0.44, 0.7, 0.01) : cible === "I" ? a.entre(0.2, 0.36, 0.01) : a.entre(0.03, 0.14, 0.01);
        const part = cible === "S" ? a.entre(0.6, 0.9, 0.01) : cible === "G" ? a.entre(0.1, 0.4, 0.01) : a.entre(0.35, 0.85, 0.01);
        const P = melange([[w1, a.entre(0.008, 0.03, 0.001), a.entre(1, 1.6, 0.05)], [(1 - w1) * part, a.entre(0.15, 0.7, 0.01), a.entre(1.5, 2.6, 0.05)], [(1 - w1) * (1 - part), a.entre(4, 12, 0.5), a.entre(1.6, 2.8, 0.05)]]);
        M = a.entre(1500, 4000, 50);
        let avant = 100;
        refus = TAMIS.map((d) => { const p = Math.min(100, (100 * P(d)) / P(63)); const m = Math.round((M * (avant - p)) / 100); avant = p; return [d, m]; });
        t = tamisage({ masseSeche: M, refus });
        l2 = t.lignes.find((x) => x.d === 2); l63 = t.lignes.find((x) => x.d === 0.063);
        p2 = l2.passant; p63 = l63.passant;
        if (margeFamille(p63, p2) >= 0.6) break;
      }
      const fam = famille(p63, p2);
      return {
        enonce: `Un échantillon de ${fr(M, 4)} g de sol sec est lavé sur le tamis de 63 µm, séché, puis tamisé sur une colonne de 63 mm à 63 µm. On pèse le refus de chaque tamis ; ce qui a passé à 63 µm est parti au lavage ou recueilli au fond.`,
        donnees: [donnee("Masse sèche", `${fr(M, 4)} g`), ...refus.map(([d, m]) => donnee(`refus ${mm(d)}`, `${fr(m, 4)} g`))],
        questions: [
          nombre("Refus cumulé sur le tamis de 2 mm ?", l2.refusCumule, "g", `On additionne les refus des tamis de 63 à 2 mm : ${refus.filter(([d]) => d >= 2).map(([, m]) => fr(m, 4)).join(" + ")} = ${fr(l2.refusCumule, 4)} g.`, { rel: 0.005 }),
          nombre("Passant au tamis de 2 mm ?", p2, "%", `100 × (1 − ${fr(l2.refusCumule, 4)}/${fr(M, 4)}) = ${pc(p2)}.`, { abs: 0.3 }),
          nombre("Tamisat à 63 µm (teneur en fines) ?", p63, "%", `Refus cumulé à 63 µm : ${fr(l63.refusCumule, 4)} g ; 100 × (1 − ${fr(l63.refusCumule, 4)}/${fr(M, 4)}) = ${pc(p63)} — c'est aussi la masse du fond et du lavage, ${fr(t.fond, 4)} g, rapportée à la masse sèche.`, { abs: 0.3 }),
          nombre("Fraction sableuse 0,063/2 mm ?", p2 - p63, "%", `${pc(p2)} − ${pc(p63)} = ${pc(p2 - p63)} ; la fraction graveleuse 2/63 mm vaut 100 − ${pc(p2)} = ${pc(100 - p2)}.`, { abs: 0.4 }),
          choixMelange(a, "Premier niveau de la classification du GTR 2024 (Dmax ≤ 63 mm) ?", [NOMS_FAMILLE[fam], ...Object.entries(NOMS_FAMILLE).filter(([k]) => k !== fam).map(([, v]) => v)],
            `${regleFamille(p63, p2)}. L'argilosité (VBS ou IP) ou la granularité (Cu) fixeront ensuite la sous-classe.`),
        ],
      };
    },
  },
  {
    id: "ch2-cu", titre: "D10, D60 et coefficient d'uniformité", difficulte: 2,
    generer(a) {
      const TAMIS = [0.063, 0.125, 0.25, 0.5, 1, 2, 4, 8, 16, 31.5, 63];
      // Populations (fines, sable, grave) réglées pour viser une sous-classe ; G4 n'est pas visé : avec 5 à
      // 10 % de fines, une grave a forcément un D10 dans les fines et un Cu très supérieur à 6.
      const RECETTES = {
        S1: (b) => [[b.entre(0.01, 0.035, 0.005), 0.02], [b.entre(0.55, 0.8, 0.01), b.entre(0.2, 0.8, 0.01), b.entre(1.2, 2, 0.05)], [null, b.entre(3, 10, 0.5), b.entre(1.4, 2.5, 0.05)]],
        S2: (b) => [[b.entre(0, 0.015, 0.005), 0.02], [b.entre(0.97, 1, 0.01), b.entre(0.18, 0.6, 0.01), b.entre(2.6, 4, 0.1)], [null, 6, 3]],
        S3: (b) => [[b.entre(0.05, 0.085, 0.005), 0.02], [b.entre(0.6, 0.85, 0.01), b.entre(0.2, 0.8, 0.01), b.entre(1.2, 2, 0.05)], [null, b.entre(3, 10, 0.5), b.entre(1.4, 2.5, 0.05)]],
        S4: (b) => [[0, 0.02], [1, b.entre(0.12, 0.19, 0.01), b.entre(2.5, 3.2, 0.05)], [null, 6, 3]],
        G1: (b) => [[b.entre(0.01, 0.035, 0.005), 0.02], [b.entre(0.2, 0.4, 0.01), b.entre(0.3, 1, 0.01), b.entre(1.2, 2, 0.05)], [null, b.entre(5, 16, 0.5), b.entre(1.2, 2.2, 0.05)]],
        G2: (b) => [[0, 0.02], [b.entre(0, 0.03, 0.01), 0.5, 2], [null, b.entre(6, 20, 0.5), b.entre(2.6, 4.5, 0.1)]],
        G3: (b) => [[b.entre(0.05, 0.085, 0.005), 0.02], [b.entre(0.2, 0.4, 0.01), b.entre(0.3, 1, 0.01), b.entre(1.2, 2, 0.05)], [null, b.entre(5, 16, 0.5), b.entre(1.2, 2.2, 0.05)]],
      };
      const visee = a.choix(Object.keys(RECETTES));
      let pts, an;
      for (let essai = 0; essai < 60; essai++) {
        const [[w1, d1], [part, d2, k2], [, d3, k3]] = RECETTES[visee](a);
        const P = melange([[w1, d1, 1.3], [(1 - w1) * part, d2, k2], [(1 - w1) * (1 - part), d3, k3]]);
        pts = TAMIS.map((d) => [d, arrondi(Math.min(100, (100 * P(d)) / P(63)))]);
        pts = pts.slice(0, pts.findIndex(([, p]) => p >= 100) + 1);
        an = analyser(pts);
        const ok = Number.isFinite(an.Cu) && an.p63um < 9.7 && Math.abs(an.Cu - 6) >= 0.4 && Math.abs(an.p63um - 5) >= 0.3 && Math.abs(an.fractionSable - an.fractionGrave) >= 3;
        if (ok && classerSol({ Dmax: an.Dmax, p63um: an.p63um, p2mm: an.p2mm, Cu: an.Cu, fractionSable: an.fractionSable, fractionGrave: an.fractionGrave }).sousClasse === visee) break;
      }
      const et = etalement({ Cu: an.Cu, D60: an.D60 });
      const c = classerSol({ Dmax: an.Dmax, p63um: an.p63um, p2mm: an.p2mm, Cu: an.Cu, D60: an.D60, D10: an.D10, fractionSable: an.fractionSable, fractionGrave: an.fractionGrave });
      const classe = c.sousClasse[0];
      const autres = ["S1", "S2", "S3", "S4", "G1", "G2", "G3", "G4"].filter((x) => x !== c.sousClasse);
      const figure = courbeGranulo({
        largeur: 600, hauteur: 300, dMin: 0.02, dMax: 100,
        series: [
          { points: [[0.02, 10], [100, 10]], couleur: "#a78bfa", tirets: "4 3", epaisseur: 1, libelle: "10 % et 60 %" },
          { points: [[0.02, 60], [100, 60]], couleur: "#a78bfa", tirets: "4 3", epaisseur: 1 },
          { points: pts, couleur: COULEURS.bleu, epaisseur: 2.4, marqueurs: true, libelle: "passant cumulé" },
        ],
      });
      return {
        enonce: `L'analyse granulométrique d'un matériau de Dmax ≤ 63 mm donne les passants cumulés ci-dessous (tracés sur la figure). Entre deux tamis, on interpole linéairement en fonction du logarithme de l'ouverture.`,
        donnees: pts.map(([d, p]) => donnee(mm(d), pc(p))),
        figure,
        questions: [
          nombre("Diamètre D10 ?", an.D10, "mm", detailDx(pts, 10, an.D10), { rel: 0.05 }),
          nombre("Diamètre D60 ?", an.D60, "mm", detailDx(pts, 60, an.D60), { rel: 0.05 }),
          nombre("Coefficient d'uniformité Cu = D60/D10 ?", an.Cu, "", `Cu = ${fr(an.D60, 3)} / ${fr(an.D10, 3)} = ${frd(an.Cu, 1)}.`, { rel: 0.06 }),
          choixMelange(a, "La granulométrie est…", [et.etalee ? "étalée : Cu ≥ 6" : "uniforme, mal graduée : Cu < 6", et.etalee ? "uniforme, mal graduée : Cu < 6" : "étalée : Cu ≥ 6", "indéterminée : il faudrait une sédimentométrie"],
            `${et.motif}. Une granulométrie étalée se compacte mieux : les petits grains comblent les vides des gros. D10 se lit ici au tamisage, puisque les fines (${pc(an.p63um)}) restent sous 10 %.`),
          choixMelange(a, "Sous-classe de nature au GTR 2024 ?", [c.sousClasse, ...a.tirage(autres, 3)],
            `${regleFamille(an.p63um, an.p2mm)} ; fines ${an.p63um <= 5 ? "≤ 5 %" : "de 5 à 15 %"} et granulométrie ${et.etalee ? "étalée" : "uniforme"} : ${c.sousClasse} (${classe === "S" ? "sable" : "grave"} ${an.p63um <= 5 ? "propre" : "silteux ou peu argileux"}, ${et.etalee ? "étalé" : "mal gradué"}).`),
        ],
      };
    },
  },
  {
    id: "ch2-fractions", titre: "Ramener les passants à la fraction 0/63 mm", difficulte: 2,
    generer(a) {
      const TAMIS = [0.063, 0.25, 2, 8, 31.5, 63, 125, 250];
      let pts, an;
      for (let essai = 0; essai < 50; essai++) {
        const f63 = a.reel() < 0.25 ? a.entre(96, 99, 1) : a.entre(55, 93, 1);
        const cible = a.choix(["F", "I", "S", "G"]);
        const f = cible === "F" ? a.entre(38, 62, 1) : cible === "I" ? a.entre(17, 33, 1) : a.entre(3, 13, 1);
        const p2 = cible === "S" ? a.entre(Math.ceil((100 + f) / 2 + 4), 94, 1) : cible === "G" ? a.entre(f + 6, Math.floor((100 + f) / 2 - 4), 1) : a.entre(Math.min(f + 12, 90), 96, 1);
        const appuis = [[0.063, f], [0.5, f + (p2 - f) * a.entre(0.4, 0.75, 0.05)], [2, p2], [16, p2 + (100 - p2) * a.entre(0.45, 0.8, 0.05)], [63, 100]];
        const p125 = f63 + (100 - f63) * a.entre(0.4, 0.8, 0.05);
        pts = TAMIS.map((d) => [d, arrondi(d <= 63 ? (f63 * passant(appuis, d)) / 100 : d === 125 ? p125 : 100)]);
        an = analyser(pts);
        if (margeFamille(an.p63um, an.p2mm) >= 1 && Math.abs(an.passant63mm - 95) >= 0.6) break;
      }
      const fam = famille(an.p63um, an.p2mm), vc = an.Dmax > 63;
      const p0063 = pts[0][1], p2tot = pts[2][1];
      const figure = courbeGranulo({ largeur: 600, hauteur: 300, dMin: 0.02, dMax: 300, series: [{ points: pts, couleur: COULEURS.bleu, epaisseur: 2.4, marqueurs: true, libelle: "passant cumulé, matériau total" }] });
      return {
        enonce: `La courbe granulométrique d'un matériau, mesurée sur le matériau total, passe par les points ci-dessous. Les paramètres de classement du GTR 2024 se lisent sur la fraction 0/63 mm.`,
        donnees: pts.map(([d, p]) => donnee(mm(d), pc(p))),
        figure,
        questions: [
          nombre("Part de la fraction 0/63 mm dans le matériau ?", an.passant63mm, "%", `C'est le passant à 63 mm : ${pc(an.passant63mm)}.`, { abs: 0.3 }),
          nombre("Tamisat à 63 µm rapporté à la fraction 0/63 mm ?", an.p63um, "%", `100 × ${pc(p0063)} / ${pc(an.passant63mm)} = ${pc(an.p63um)}.`, { abs: 0.4 }),
          nombre("Tamisat à 2 mm rapporté à la fraction 0/63 mm ?", an.p2mm, "%", `100 × ${pc(p2tot)} / ${pc(an.passant63mm)} = ${pc(an.p2mm)}.`, { abs: 0.4 }),
          choixMelange(a, "Classe de la fraction 0/63 mm (premier niveau) ?", [NOMS_FAMILLE[fam], ...Object.entries(NOMS_FAMILLE).filter(([k]) => k !== fam).map(([, v]) => v)],
            `Sur la fraction 0/63 mm : ${regleFamille(an.p63um, an.p2mm)}. Lire les fines sur le matériau total (${pc(p0063)}) les sous-estimerait.`),
          nombre("Dmax, assimilé au D95 ?", an.Dmax, "mm", `${detailDx(pts, 95, an.Dmax)}`, { rel: 0.04 }),
          choixMelange(a, "Le matériau entier se classe donc…", [vc ? "comme un sol VC (Dmax > 63 mm) : VC1 ou VC2, suivi de la classe de sa fraction 0/63 mm" : "comme un sol F, I, S ou G : son Dmax ne dépasse pas 63 mm",
            vc ? "comme un sol F, I, S ou G : son Dmax ne dépasse pas 63 mm" : "comme un sol VC (Dmax > 63 mm) : VC1 ou VC2, suivi de la classe de sa fraction 0/63 mm", "comme un matériau rocheux, ses gros éléments dépassant 63 mm"],
            `Dmax ≈ D95 = ${mm(an.Dmax)} ${vc ? `> 63 mm : sol à gros éléments VC ; sa fraction 0/63 mm se classe ensuite comme un sol ordinaire, d'où un double symbole VC…${fam}` : `≤ 63 mm : sol ${fam}, classé sur sa fraction 0/63 mm`}. Le seuil de 250 mm (Lmax) sépare, lui, les sols des matériaux blocailleux ou rocheux.`),
        ],
      };
    },
  },
  {
    id: "ch2-coupelle", titre: "Limite de liquidité à la coupelle et abaque de Casagrande", difficulte: 2,
    generer(a) {
      let pts, c, wP, IP, wn, at, pos;
      for (let essai = 0; essai < 60; essai++) {
        const wLv = a.entre(26, 78, 0.1), pente = a.entre(8, 22, 0.5);
        const Ns = [a.entier(15, 18), a.entier(20, 24), a.entier(27, 31), a.entier(33, 35)];
        pts = Ns.map((N) => [N, arrondi(wLv - pente * Math.log10(N / 25) + a.entre(-0.3, 0.3, 0.1))]);
        c = wLCasagrande(pts);
        const A = 0.73 * (c.wL - 20);
        const argile = A < 9 || a.reel() < 0.55;
        IP = argile ? A + a.entre(3, 14, 0.1) : A - a.entre(3, Math.min(9, A - 5), 0.1);
        wP = arrondi(c.wL - IP);
        IP = c.wL - wP;
        wn = arrondi(c.wL - a.entre(0.55, 1.3, 0.01) * IP);
        at = atterberg({ wL: c.wL, wP, w: wn });
        pos = abaqueCasagrande({ wL: c.wL, IP: at.IP });
        if (wP >= 8 && Math.abs(at.IP - pos.ligneA) >= 1.5 && Math.abs(c.wL - 50) >= 1.5 && [12, 22, 40, 55].every((s) => Math.abs(at.IP - s) >= 0.6)) break;
      }
      const sc = classerSol({ Dmax: 2, p63um: 85, IP: at.IP }).sousClasse;
      const ws = pts.map((p) => p[1]);
      const ymin = Math.floor(Math.min(...ws, c.wL) - 2), ymax = Math.ceil(Math.max(...ws, c.wL) + 2);
      const figure = graphe({
        largeur: 560, hauteur: 240, xmin: 10, xmax: 50, ymin, ymax, logX: true, xlabel: "nombre de coups N (échelle logarithmique)", ylabel: "w (%)",
        series: [
          { points: [[10, c.droite(10)], [50, c.droite(50)]], couleur: COULEURS.bleu, epaisseur: 2, libelle: "droite ajustée w – lg N" },
          { points: [[25, ymin], [25, ymax]], couleur: "#94a3b8", tirets: "4 3", epaisseur: 1, libelle: "N = 25" },
          { points: pts, couleur: COULEURS.encre, nuage: true, rayon: 4 },
        ],
      });
      const domaines = ["argile peu plastique", "argile très plastique", "limon peu plastique", "limon très plastique"];
      return {
        enonce: `À la coupelle de Casagrande, quatre essais sur la fraction 0/400 µm d'un sol fin donnent (N coups ; w) : ${pts.map(([N, w]) => `(${N} ; ${pc(w)})`).join(", ")}. Les rouleaux de 3 mm se fissurent à wP = ${pc(wP)}, et la teneur en eau naturelle vaut wn = ${pc(wn)}.`,
        donnees: [...pts.map(([N, w]) => donnee(`N = ${N}`, pc(w))), donnee("wP", pc(wP)), donnee("wn", pc(wn))],
        figure,
        questions: [
          nombre("Limite de liquidité wL (lue à 25 coups sur la droite) ?", c.wL, "%", `Droite des moindres carrés w = a + b lg N : b = ${sg(frd(c.pente, 2))} ; à N = 25, wL = ${pc(c.wL)}.`, { abs: 0.8 }),
          nombre("Indice de plasticité IP ?", at.IP, "", `IP = wL − wP = ${frd(c.wL, 1)} − ${frd(wP, 1)} = ${frd(at.IP, 1)}.`, { abs: 0.8 }),
          nombre("Indice de consistance Ic ?", at.Ic, "", `Ic = (wL − wn)/IP = (${frd(c.wL, 1)} − ${frd(wn, 1)})/${frd(at.IP, 1)} = ${frd(at.Ic, 2)}${at.Ic > 1 ? " : wn est sous la limite de plasticité, le sol est ferme" : ""}.`, { abs: 0.04 }),
          choixMelange(a, "Domaine de l'abaque de plasticité ?", [pos.nom, ...domaines.filter((d) => d !== pos.nom)],
            `Ligne A : IP = 0,73 (wL − 20) = ${frd(pos.ligneA, 1)} ; IP = ${frd(at.IP, 1)} est ${pos.argile ? "au-dessus : argile" : "au-dessous : limon"}. wL ${pos.tresPlastique ? "≥" : "<"} 50 % : ${pos.tresPlastique ? "très" : "peu"} plastique.`),
          choixMelange(a, "S'il s'agit d'un sol fin (fines > 35 %), sous-classe donnée par l'IP au GTR 2024 ?", [sc, ...["F1", "F2", "F3", "F4", "F4+"].filter((x) => x !== sc).slice(0, 3)],
            `Seuils d'IP : 12, 22, 40, 55. IP = ${frd(at.IP, 1)} → ${sc}.${at.IP <= 12 ? " Sous IP = 12, le GTR préfère la VBS, plus sûre pour les sols peu plastiques." : ""}`),
        ],
      };
    },
  },
  {
    id: "ch2-ip-vbs", titre: "IP ou VBS : quel critère retenir ?", difficulte: 2,
    generer(a) {
      const fin = a.reel() < 0.6, p63um = fin ? a.entre(38, 92, 1) : a.entre(17, 33, 1);
      // Fourchettes d'IP et de VBS de chaque sous-classe [F2 annexe 1] ; la VBS tombe dans la sous-classe
      // donnée par l'IP ou dans une voisine : les deux critères peuvent diverger, d'une classe au plus.
      const IPS = fin ? [[5, 11], [13, 21], [23, 39], [41, 52]] : [[5, 11], [13, 28]];
      const VBSS = fin ? [[0.8, 2.42], [2.58, 5.92], [6.08, 7.92], [8.08, 11]] : [[0.4, 1.42], [1.58, 3.2]];
      const i = a.entier(0, IPS.length - 1), j = Math.min(VBSS.length - 1, Math.max(0, i + a.choix([-1, 0, 0, 1])));
      const IP = a.entier(...IPS[i]), VBS = a.entre(...VBSS[j], 0.01);
      const wP = a.entier(IP > 25 ? 22 : 14, IP > 25 ? 34 : 28), wL = wP + IP;
      const base = { Dmax: 20, p63um };
      const parIP = classerSol({ ...base, IP }).sousClasse, parVBS = classerSol({ ...base, VBS }).sousClasse, r = classerSol({ ...base, IP, VBS });
      const sc = fin ? ["F1", "F2", "F3", "F4"] : ["I1", "I2"];
      const opts = (bonne) => [bonne, ...sc.filter((x) => x !== bonne)];
      return {
        enonce: `Un sol dont le tamisat à 63 µm vaut ${pc(p63um, 0)} (sur la fraction 0/63 mm) a pour limites d'Atterberg wL = ${fr(wL)} % et wP = ${fr(wP)} %, et pour valeur de bleu VBS = ${frd(VBS, 2)}.`,
        donnees: [donnee("Fines (63 µm)", pc(p63um, 0)), donnee("wL", `${fr(wL)} %`), donnee("wP", `${fr(wP)} %`), donnee("VBS", frd(VBS, 2))],
        questions: [
          nombre("Indice de plasticité IP ?", IP, "", `IP = ${fr(wL)} − ${fr(wP)} = ${fr(IP)}.`, { abs: 0.1 }),
          choixMelange(a, "Sous-classe donnée par l'IP seul ?", opts(parIP),
            fin ? `Sol fin (fines > 35 %) ; seuils d'IP 12, 22, 40, 55 : IP = ${fr(IP)} → ${parIP}.` : `Sol intermédiaire (fines de 15 à 35 %) : I1 si IP ≤ 12, I2 au-delà ; IP = ${fr(IP)} → ${parIP}.`),
          choixMelange(a, "Sous-classe donnée par la VBS seule ?", opts(parVBS),
            fin ? `Seuils de VBS des sols fins : 2,5, 6 et 8 ; VBS = ${frd(VBS, 2)} → ${parVBS}.` : `Seuil de VBS des sols intermédiaires : 1,5 ; VBS = ${frd(VBS, 2)} → ${parVBS}.`),
          choixMelange(a, "Sous-classe retenue au GTR 2024 ?", opts(r.sousClasse),
            `${IP > 12 ? `IP = ${fr(IP)} > 12 : l'IP est le critère le mieux adapté, il l'emporte` : `IP = ${fr(IP)} ≤ 12 : l'IP est imprécis pour les sols peu plastiques, la VBS l'emporte`} → ${r.sousClasse}.${parIP !== parVBS ? " Les deux critères divergent : on retient le critère privilégié et l'on garde l'autre en mémoire, c'est un signal sur la représentativité des essais." : " Les deux critères concordent."}`),
        ],
      };
    },
  },
  {
    id: "ch2-vbs", titre: "Valeur de bleu à la tache", difficulte: 1,
    generer(a) {
      const fin = a.reel() < 0.6, p63um = fin ? a.entre(38, 90, 1) : a.entre(17, 33, 1);
      const C = fin ? a.entre(0.9, 1, 0.01) : a.entre(0.6, 0.95, 0.01);
      const seuils = fin ? [2.5, 6, 8] : [1.5];
      let V, r, m0;
      for (let essai = 0; essai < 40; essai++) {
        const cible = fin ? a.entre(0.6, 10.5, 0.1) : a.entre(0.4, 3.2, 0.05);
        // Prise d'essai d'autant plus petite que le sol est argileux, comme au laboratoire.
        m0 = fin ? (cible > 5 ? 30 : a.choix([30, 40, 50, 60])) : a.choix([60, 80, 100]);
        V = Math.max(10, Math.round((cible * m0) / C / 5) * 5);
        r = vbs({ V, m0, C });
        if (seuils.every((s) => Math.abs(r.VBS - s) >= 0.06)) break;
      }
      const sc = classerSol({ Dmax: 10, p63um, VBS: r.VBS }).sousClasse;
      const choixSc = fin ? ["F1", "F2", "F3", "F4"] : ["I1", "I2", "F1", "F2"];
      return {
        enonce: `Essai au bleu de méthylène à la tache sur ${m0} g (masse sèche) de la fraction 0/5 mm d'un sol : le test devient positif après injection de ${fr(V)} cm³ de solution de bleu à 10 g/L. La fraction 0/5 mm représente ${frd(C, 2)} de la fraction 0/63 mm du sol, dont le tamisat à 63 µm vaut ${pc(p63um, 0)}.`,
        donnees: [donnee("Prise m0", `${m0} g`), donnee("Volume V", `${fr(V)} cm³`), donnee("Proportion C de 0/5 mm", frd(C, 2)), donnee("Fines (63 µm)", pc(p63um, 0))],
        questions: [
          nombre("Masse de bleu adsorbée B ?", r.B, "g", `B = V × 10 g/L = ${fr(V)} cm³ × 0,010 g/cm³ = ${frd(r.B, 2)} g.`, { rel: 0.01 }),
          nombre("Valeur de bleu de la fraction 0/5 mm (g pour 100 g) ?", r.VB, "", `VB = 100 B / m0 = 100 × ${frd(r.B, 2)} / ${m0} = ${frd(r.VB, 2)}.`, { rel: 0.01 }),
          nombre("Valeur de bleu du sol VBS ?", r.VBS, "", `VBS = VB × C = ${frd(r.VB, 2)} × ${frd(C, 2)} = ${frd(r.VBS, 2)} : la valeur est rapportée à la fraction 0/63 mm.`, { rel: 0.015 }),
          choixMelange(a, "Sous-classe donnée par cette VBS ?", [sc, ...choixSc.filter((x) => x !== sc)],
            fin ? `Sol fin (fines > 35 %) : F1 jusqu'à 2,5, F2 jusqu'à 6, F3 jusqu'à 8, F4 au-delà ; VBS = ${frd(r.VBS, 2)} → ${sc}. La VBS est le critère privilégié tant que l'IP ne dépasse pas 12.`
              : `Sol intermédiaire (fines de 15 à 35 %) : I1 jusqu'à 1,5, I2 au-delà ; VBS = ${frd(r.VBS, 2)} → ${sc}.`),
        ],
      };
    },
  },
  {
    id: "ch2-es", titre: "Équivalent de sable et classe du GTR 1992", difficulte: 1,
    generer(a) {
      const sable = a.reel() < 0.5, p2mm = sable ? a.entre(74, 96, 1) : a.entre(30, 66, 1), p80um = a.entre(3, 11.5, 0.5);
      const seuil = sable ? 35 : 25;
      let h1, h2a, h1b, h2b, es1, es2, ES;
      for (let essai = 0; essai < 40; essai++) {
        const cible = a.reel() < 0.5 ? a.entre(seuil + 4, seuil + 45, 1) : a.entre(Math.max(8, seuil - 18), seuil - 4, 1);
        h1 = a.entre(9, 18, 0.1); h2a = arrondi((h1 * (cible + a.entre(-2, 2, 0.5))) / 100);
        h1b = arrondi(h1 + a.entre(-0.8, 0.8, 0.1)); h2b = arrondi((h1b * (cible + a.entre(-2, 2, 0.5))) / 100);
        es1 = equivalentSable({ h1, h2: h2a }); es2 = equivalentSable({ h1: h1b, h2: h2b }); ES = (es1 + es2) / 2;
        if (Math.abs(ES - seuil) >= 2 && h2a > 0.5) break;
      }
      const c = classerSol1992({ Dmax: sable ? 5 : 40, p80um, p2mm, ES });
      const classes = ["B1", "B2", "B3", "B4"];
      const lib = (k) => `${k} : ${SOUS_CLASSES_1992[k]}`;
      return {
        enonce: `Deux éprouvettes d'équivalent de sable sont préparées avec la fraction 0/2 mm d'un ${sable ? "sable" : "matériau sablo-graveleux"} : après agitation et repos, on lit la hauteur du sommet du floculat h1 et, au piston, celle du sable h2. Le matériau a ${pc(p80um)} de passant à 80 µm et ${pc(p2mm, 0)} de passant à 2 mm sur la fraction 0/50 mm ; sa VBS n'a pas été mesurée.`,
        donnees: [donnee("Éprouvette 1", `h1 = ${frd(h1, 1)} cm · h2 = ${frd(h2a, 1)} cm`), donnee("Éprouvette 2", `h1 = ${frd(h1b, 1)} cm · h2 = ${frd(h2b, 1)} cm`), donnee("Passant 80 µm", pc(p80um)), donnee("Passant 2 mm", pc(p2mm, 0))],
        questions: [
          nombre("ES de la première éprouvette ?", es1, "", `ES = 100 h2/h1 = 100 × ${frd(h2a, 1)}/${frd(h1, 1)} = ${frd(es1, 1)}.`, { rel: 0.015 }),
          nombre("Équivalent de sable du matériau (moyenne des deux) ?", ES, "", `Seconde éprouvette : 100 × ${frd(h2b, 1)}/${frd(h1b, 1)} = ${frd(es2, 1)} ; moyenne (${frd(es1, 1)} + ${frd(es2, 1)})/2 = ${frd(ES, 1)}.`, { rel: 0.015 }),
          choixMelange(a, "Au GTR 1992, faute de VBS, ce matériau se classe…", [lib(c.sousClasse), ...classes.filter((k) => k !== c.sousClasse).map(lib)],
            `Fines ${pc(p80um)} ≤ 12 % au tamis de 80 µm ; tamisat à 2 mm ${sable ? "> 70 % : sable, argileux si ES ≤ 35" : "≤ 70 % : grave, argileuse si ES ≤ 25"}. ES = ${frd(ES, 1)} → ${c.sousClasse}.`),
          choixMelange(a, "Et au GTR 2024, que fait-on de l'équivalent de sable ?", ["un contrôle rapide de propreté sur chantier : le classement passe par la VBS", "il remplace la VBS pour les sables et graves", "il fixe l'état hydrique des sables", "il sépare les sous-classes S1 et S2"],
            "L'ES (NF EN 933-8) n'est pas un paramètre de classement du GTR 2024 : c'est un contrôle rapide de la propreté des sables et graves destinés aux couches de forme ou aux granulats. La sensibilité à l'eau se juge par la VBS (et le CBRi)."),
        ],
      };
    },
  },
  {
    id: "ch2-sedimento", titre: "Sédimentométrie : loi de Stokes et pourcentage", difficulte: 3,
    generer(a) {
      const TEMPS = [[120, "2 min"], [300, "5 min"], [900, "15 min"], [1800, "30 min"], [3600, "1 h"], [7200, "2 h"], [14400, "4 h"], [28800, "8 h"], [86400, "24 h"]];
      const FRACTIONS = { 120: [55, 92], 300: [50, 88], 900: [40, 80], 1800: [35, 75], 3600: [30, 70], 7200: [25, 62], 14400: [18, 55], 28800: [14, 48], 86400: [10, 40] };
      const k = a.entier(0, TEMPS.length - 1), [t, tLib] = TEMPS[k];
      const rhoS = a.choix([2.65, 2.68, 2.7, 2.72]), T = a.entier(16, 24);
      const eta = Math.round(viscositeEau(T) * 1e6) / 1e6;
      const temoin = a.entre(1.0012, 1.003, 0.0001), F = a.entre(...FRACTIONS[t], 0.5);
      const rho = Math.round((temoin + (F / 100) * (50 / 1000) * (1 - 1 / rhoS)) * 1e4) / 1e4;
      const Hr = 0.163 - 2.645 * (rho - 1);
      const D = diametreStokes({ Hr, t, rhoS, eta });
      const Pf = pourcentageSedimento({ rhoLu: rho, rhoEau: temoin, V: 1000, ms: 50, rhoS });
      const p63 = a.entre(45, 95, 1), P = (Pf * p63) / 100;
      const argile = D < 0.002;
      return {
        enonce: `Sédimentométrie : 50 g de la fraction < 63 µm d'un sol (ρs = ${frd(rhoS, 2)} Mg/m³), dispersés, sont mis en suspension dans 1 000 cm³ d'eau à ${T} °C (η = ${frd(eta * 1000, 3)} mPa·s). Au bout de ${tLib}, le densimètre lit ρ = ${frd(rho, 4)} Mg/m³ ; l'éprouvette témoin (eau et défloculant) lit ${frd(temoin, 4)} Mg/m³. L'étalonnage du densimètre donne la profondeur effective de son centre de poussée : Hr (m) = 0,163 − 2,645 (ρ − 1). Le tamisat à 63 µm du sol vaut ${pc(p63, 0)}.`,
        donnees: [donnee("t", tLib), donnee("ρ lue", `${frd(rho, 4)} Mg/m³`), donnee("ρ témoin", `${frd(temoin, 4)} Mg/m³`), donnee("ρs", `${frd(rhoS, 2)} Mg/m³`), donnee("η", `${frd(eta * 1000, 3)} mPa·s`), donnee("Fines (63 µm)", pc(p63, 0))],
        questions: [
          nombre("Profondeur effective Hr ?", Hr * 100, "cm", `Hr = 0,163 − 2,645 × (${frd(rho, 4)} − 1) = ${frd(Hr, 4)} m = ${frd(Hr * 100, 2)} cm.`, { rel: 0.01 }),
          nombre("Diamètre D des plus gros grains encore en suspension à cette profondeur ?", D * 1000, "µm",
            `Loi de Stokes : D = √(18 η Hr / ((ρs − ρw) g t)) = √(18 × ${sci(eta, 4)} × ${frd(Hr, 4)} / (${frd(rhoS - 1, 2)} × 1 000 × 9,81 × ${fr(t, 5)})) = ${sci(D / 1000)} m = ${fr(D * 1000, 3)} µm.`, { rel: 0.03 }),
          nombre("Pourcentage de grains plus fins que D, dans la fraction < 63 µm ?", Pf, "%",
            `P = 100 (V/ms) ρs/(ρs − ρw) (ρ − ρtémoin) = 100 × (1 000/50) × ${frd(rhoS, 2)}/${frd(rhoS - 1, 2)} × (${frd(rho, 4)} − ${frd(temoin, 4)}) = ${pc(Pf)}.`, { abs: 1 }),
          nombre("Rapporté au sol entier ?", P, "%", `${pc(Pf)} × ${pc(p63, 0)} / 100 = ${pc(P)} : c'est le point (${fr(D * 1000, 3)} µm ; ${pc(P)}) de la courbe granulométrique, sous 63 µm.`, { abs: 1 }),
          choixMelange(a, "Ce point renseigne-t-il sur la fraction argileuse (< 2 µm) ?", [argile ? "oui : D < 2 µm, les grains encore en suspension sont des argiles" : "non : D > 2 µm, il faut des lectures plus tardives pour atteindre 2 µm",
            argile ? "non : D > 2 µm, il faut des lectures plus tardives pour atteindre 2 µm" : "oui : D < 2 µm, les grains encore en suspension sont des argiles", "non : la sédimentométrie ne descend jamais sous 2 µm"],
            `D = ${fr(D * 1000, 3)} µm ${argile ? "<" : ">"} 2 µm, limite conventionnelle de l'argile. Le diamètre décroît comme 1/√t : les lectures s'étalent de 30 s à 24 h pour descendre jusqu'à 2 µm.`),
        ],
      };
    },
  },
];
