// Exercices du chapitre 5 : géométrie, encastrement et excentrement.
import { fr, frd, nombre, choixMelange, donnee } from "./alea.js";
import { diagramme, excentrementEC7, eLimiteF62 } from "../geotech/superficielles.js";
import { coupeSemelle, figureContraintes } from "../figures.js";

export default [
  {
    id: "ch5-De", titre: "Encastrement équivalent sous une couverture faible", difficulte: 1,
    generer(a) {
      const D = a.entre(0.8, 3, 0.1), B = a.entre(1, 3, 0.1), plc = a.entre(0.2, 0.8, 0.05), ple = a.entre(1, 2.5, 0.05);
      const De = (plc * D) / ple, r = De / B;
      const type = r < 1.5 ? "superficielle" : r <= 5 ? "semi-profonde" : "profonde";
      return {
        enonce: `Une semelle de largeur B = ${frd(B, 1)} m est fondée à D = ${frd(D, 1)} m sous une couverture de pl* = ${frd(plc, 2)} MPa ; sous la base, ple* = ${frd(ple, 2)} MPa.`,
        donnees: [donnee("B", `${frd(B, 1)} m`), donnee("D", `${frd(D, 1)} m`), donnee("pl* couverture", `${frd(plc, 2)} MPa`), donnee("ple*", `${frd(ple, 2)} MPa`)],
        figure: coupeSemelle({ B, D, hauteur: 220, profondeurVue: D + 1.5 * B, couches: [{ z0: 0, z1: D, sol: "limon", etiquette: `pl* = ${frd(plc, 2)} MPa` }, { z0: D, z1: D + 5 * B, sol: "sable", etiquette: `ple* = ${frd(ple, 2)} MPa` }] }),
        questions: [
          nombre("Hauteur d'encastrement équivalente De ?", De, "m", `De = (1/ple*) ∫ pl*(z) dz = ${frd(plc, 2)} × ${frd(D, 1)} / ${frd(ple, 2)} = ${frd(De, 3)} m.`, { rel: 0.01 }),
          nombre("Encastrement relatif De/B ?", r, "", `${frd(De, 3)} / ${frd(B, 1)} = ${frd(r, 3)}.`, { rel: 0.01 }),
          choixMelange(a, "Type de fondation ?", [type, ...["superficielle", "semi-profonde", "profonde"].filter((t) => t !== type)],
            `De/B ${r < 1.5 ? "< 1,5" : r <= 5 ? "entre 1,5 et 5" : "> 5"} : fondation ${type}. C'est De/B, et non D/B = ${frd(D / B, 2)}, qui classe la fondation.`),
        ],
      };
    },
  },
  {
    id: "ch5-trapeze", titre: "Diagramme trapézoïdal et contrainte de référence", difficulte: 1,
    generer(a) {
      const B = a.entre(1.5, 3.5, 0.1), V = a.entre(300, 900, 10);
      const e = a.entre(0.02, 0.9, 0.01) * (B / 6);
      const M = +(V * e).toFixed(1);
      const d = diagramme({ B, V, e: M / V });
      return {
        enonce: `Semelle filante de largeur B = ${frd(B, 1)} m, sous V = ${fr(V, 3)} kN/m et M = ${frd(M, 1)} kN·m/m à la base.`,
        donnees: [donnee("B", `${frd(B, 1)} m`), donnee("V", `${fr(V, 3)} kN/m`), donnee("M", `${frd(M, 1)} kN·m/m`)],
        figure: figureContraintes({ B, V, e: M / V, qmax: d.qmax, qmin: d.qmin, Bc: d.Bc, largeur: 520, hauteur: 230 }),
        questions: [
          nombre("Excentrement e ?", M / V, "m", `e = M/V = ${frd(M, 1)} / ${fr(V, 3)} = ${frd(M / V, 3)} m < B/6 = ${frd(B / 6, 3)} m : toute la semelle est comprimée.`, { rel: 0.01 }),
          nombre("Contrainte maximale q'max ?", d.qmax, "kPa", `q'max = (V/B)(1 + 6e/B) = ${fr(V / B, 4)} × ${frd(1 + (6 * M) / V / B, 3)} = ${fr(d.qmax, 4)} kPa.`, { rel: 0.01 }),
          nombre("Contrainte minimale q'min ?", d.qmin, "kPa", `q'min = (V/B)(1 − 6e/B) = ${fr(d.qmin, 4)} kPa.`, { rel: 0.015 }),
          nombre("Contrainte de référence q'ref du Fascicule 62 ?", d.qrefTrapeze, "kPa", `q'ref = (3 q'max + q'min)/4 = ${fr(d.qrefTrapeze, 4)} kPa.`, { rel: 0.01 }),
          nombre("Contrainte uniforme de Meyerhof V/(B − 2e) ?", d.qrefMeyerhof, "kPa", `B' = ${frd(B - (2 * M) / V, 3)} m ; V/B' = ${fr(d.qrefMeyerhof, 4)} kPa — proche de q'ref tant que l'excentrement est faible.`, { rel: 0.01 }),
        ],
      };
    },
  },
  {
    id: "ch5-triangle", titre: "Semelle partiellement décollée", difficulte: 2,
    generer(a) {
      const B = a.entre(1.5, 3, 0.1), V = a.entre(200, 700, 10);
      const e = a.entre(B / 6 + 0.05, 0.4 * B, 0.01);
      const M = +(V * e).toFixed(1);
      const d = diagramme({ B, V, e: M / V });
      const ok75 = d.fraction >= 0.75 - 1e-9;
      return {
        enonce: `Semelle filante B = ${frd(B, 1)} m, V = ${fr(V, 3)} kN/m, M = ${frd(M, 1)} kN·m/m (combinaison rare).`,
        donnees: [donnee("B", `${frd(B, 1)} m`), donnee("V", `${fr(V, 3)} kN/m`), donnee("M", `${frd(M, 1)} kN·m/m`)],
        figure: figureContraintes({ B, V, e: M / V, qmax: d.qmax, qmin: 0, Bc: d.Bc, largeur: 520, hauteur: 230 }),
        questions: [
          nombre("Largeur comprimée Bc ?", d.Bc, "m", `e = ${frd(M / V, 3)} m > B/6 : diagramme triangulaire, Bc = 3(B/2 − e) = 3 × (${frd(B / 2, 2)} − ${frd(M / V, 3)}) = ${frd(d.Bc, 3)} m.`, { rel: 0.01 }),
          nombre("Contrainte maximale q'max ?", d.qmax, "kPa", `q'max = 2V/Bc = 2 × ${fr(V, 3)} / ${frd(d.Bc, 3)} = ${fr(d.qmax, 4)} kPa.`, { rel: 0.01 }),
          nombre("Fraction comprimée (en %) ?", 100 * d.fraction, "%", `Bc/B = ${frd(d.Bc, 3)} / ${frd(B, 1)} = ${fr(100 * d.fraction, 3)} %.`, { rel: 0.01 }),
          choixMelange(a, "Le critère du Fascicule 62 sous combinaison rare est-il satisfait ?",
            ok75 ? ["oui : au moins 75 % de la surface est comprimée", "non : il faut 100 % sous combinaison rare"] : ["non : moins de 75 % de la surface est comprimée", "oui : il suffit de 10 %"],
            `F62 B.3.3 : 75 % au moins sous combinaisons rares, soit e ≤ B/4 = ${frd(B / 4, 3)} m. Ici ${fr(100 * d.fraction, 3)} %.`),
        ],
      };
    },
  },
  {
    id: "ch5-ie", titre: "Surface effective d'une semelle rectangulaire", difficulte: 2,
    generer(a) {
      const B = a.entre(1.5, 3, 0.1), L = a.entre(B + 0.5, 3 * B, 0.1);
      const eB = a.entre(0.05, 0.25, 0.01) * B, eL = a.entre(0, 0.15, 0.01) * L;
      const r = excentrementEC7({ forme: "rectangulaire", B, L, eB, eL });
      const okQP = r.ELS_QP.ok;
      return {
        enonce: `Semelle rectangulaire ${frd(B, 1)} m × ${frd(L, 1)} m, résultante excentrée de eB = ${frd(eB, 2)} m selon B et eL = ${frd(eL, 2)} m selon L (combinaison quasi permanente).`,
        donnees: [donnee("B × L", `${frd(B, 1)} × ${frd(L, 1)} m`), donnee("eB", `${frd(eB, 2)} m`), donnee("eL", `${frd(eL, 2)} m`)],
        questions: [
          nombre("Coefficient ie ?", r.ie, "", `ie = (1 − 2eB/B)(1 − 2eL/L) = ${frd(1 - (2 * eB) / B, 3)} × ${frd(1 - (2 * eL) / L, 3)} = ${frd(r.ie, 3)}.`, { rel: 0.01 }),
          nombre("Surface effective A' ?", r.Aprime, "m²", `A' = A · ie = ${frd(B * L, 2)} × ${frd(r.ie, 3)} = ${frd(r.Aprime, 2)} m², soit B' × L' = ${frd(B - 2 * eB, 2)} × ${frd(L - 2 * eL, 2)} m.`, { rel: 0.01 }),
          choixMelange(a, "Le critère de la NF P94-261 à l'ELS quasi permanent est-il vérifié ?",
            okQP ? ["oui : ie ≥ 2/3", "non : ie < 2/3"] : ["non : ie < 2/3", "oui : ie ≥ 2/3"],
            `Tableau 9 du guide Cerema : pour une semelle rectangulaire, (1 − 2eB/B)(1 − 2eL/L) ≥ 2/3 aux ELS quasi permanents et fréquents. Ici ${frd(r.ie, 3)}.`),
        ],
      };
    },
  },
  {
    id: "ch5-cercle", titre: "Semelle circulaire excentrée", difficulte: 3,
    generer(a) {
      const B = a.entre(2, 6, 0.1), e = a.entre(0.05, 0.3, 0.01) * B;
      const r = excentrementEC7({ forme: "circulaire", B, eB: e });
      const crit = 1 - (2 * e) / B;
      return {
        enonce: `Semelle circulaire de diamètre B = ${frd(B, 1)} m ; la résultante est excentrée de e = ${frd(e, 2)} m (ELS caractéristique).`,
        donnees: [donnee("B", `${frd(B, 1)} m`), donnee("e", `${frd(e, 2)} m`), donnee("e/R", frd(e / (B / 2), 3))],
        questions: [
          nombre("Coefficient de réduction ie (annexe Q) ?", r.ie, "", `ie = 2 arccos(e/R)/π − (2e/πR) √(1 − (e/R)²) avec e/R = ${frd(e / (B / 2), 3)} : ie = ${frd(r.ie, 3)}.`, { rel: 0.01 }),
          nombre("Critère 1 − 2e/B ?", crit, "", `1 − 2 × ${frd(e, 2)} / ${frd(B, 1)} = ${frd(crit, 3)}.`, { rel: 0.01 }),
          choixMelange(a, "Critère d'excentrement à l'ELS caractéristique ?",
            crit >= 9 / 16 ? ["vérifié : 1 − 2e/B ≥ 9/16", "non vérifié : 1 − 2e/B < 9/16"] : ["non vérifié : 1 − 2e/B < 9/16", "vérifié : 1 − 2e/B ≥ 9/16"],
            "Pour une semelle circulaire, les seuils deviennent 3/40, 9/16 et 3/4 (ELU, ELS caractéristique, ELS quasi permanent) : ils correspondent aux mêmes surfaces comprimées que 1/15, 1/2 et 2/3 pour un rectangle."),
        ],
      };
    },
  },
  {
    id: "ch5-emax", titre: "Excentrements admissibles d'une semelle filante", difficulte: 1,
    generer(a) {
      const B = a.entre(1.2, 4, 0.1);
      const eU = eLimiteF62(B, 0.1), eR = eLimiteF62(B, 0.75), eF = eLimiteF62(B, 1);
      return {
        enonce: `Semelle filante de largeur B = ${frd(B, 1)} m. On cherche les excentrements maximaux admis par le Fascicule 62.`,
        donnees: [donnee("B", `${frd(B, 1)} m`)],
        questions: [
          nombre("Excentrement maximal à l'ELU (10 % comprimé) ?", eU, "m", `3(B/2 − e) ≥ 0,1 B ⇒ e ≤ B/2 − B/30 = 7B/15 = ${frd(eU, 3)} m.`, { rel: 0.01 }),
          nombre("Excentrement maximal sous combinaison rare (75 %) ?", eR, "m", `3(B/2 − e) ≥ 0,75 B ⇒ e ≤ B/4 = ${frd(eR, 3)} m.`, { rel: 0.01 }),
          nombre("Excentrement maximal sous combinaison fréquente (100 %) ?", eF, "m", `Diagramme trapézoïdal : e ≤ B/6 = ${frd(eF, 3)} m.`, { rel: 0.01 }),
          choixMelange(a, "Que valent ces limites exprimées en 1 − 2e/B, forme de la NF P94-261 ?",
            ["1/15, 1/2 et 2/3", "1/10, 3/4 et 1", "1/6, 1/4 et 7/15"],
            "1 − 2(7B/15)/B = 1/15 ; 1 − 2(B/4)/B = 1/2 ; 1 − 2(B/6)/B = 2/3 : les critères de la norme sont ceux du fascicule, réécrits en largeur de Meyerhof."),
        ],
      };
    },
  },
];
