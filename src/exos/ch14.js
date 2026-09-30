// Exercices du chapitre 14 : pieux sous efforts transversaux.
import { fr, frd, nombre, choixMelange, donnee } from "./alea.js";
import { moduleKf, pieuLongAnalytique, pieuSouple, minorationSurface } from "../geotech/lateral.js";
import { fraction } from "./alea.js";

const EI = (E, B) => E * 1000 * (Math.PI * B ** 4) / 64;

export default [
  {
    id: "ch14-kf", titre: "Module de réaction de Ménard (B ≥ B0)", difficulte: 1,
    generer(a) {
      const B = a.entre(0.6, 1.5, 0.1), EM = a.entre(5, 40, 1), alpha = a.choix([1 / 3, 1 / 2, 2 / 3, 1]);
      const k = moduleKf({ EM, B, alpha });
      const den = (4 / 3) * (0.6 / B) * (2.65 * B / 0.6) ** alpha + alpha;
      return {
        enonce: `Pieu de diamètre B = ${frd(B, 1)} m dans un sol de module EM = ${fr(EM, 2)} MPa, α = ${fraction(alpha)}.`,
        donnees: [donnee("B", `${frd(B, 1)} m`), donnee("EM", `${fr(EM, 2)} MPa`), donnee("α", fraction(alpha))],
        questions: [
          nombre("Dénominateur 4/3 (B0/B)(2,65 B/B0)^α + α ?", den, "", `4/3 × ${frd(0.6 / B, 3)} × ${frd(2.65 * B / 0.6, 3)}^${fraction(alpha)} + ${frd(alpha, 3)} = ${frd(den, 3)}.`, { rel: 0.01 }),
          nombre("Kf (sollicitations de courte durée) ?", k.Kf / 1000, "MPa", `Kf = 12 EM / ${frd(den, 3)} = ${fr(k.Kf / 1000, 3)} MPa, soit ${fr(k.Kf / 1000, 3)} kN/m de réaction par millimètre de déplacement.`, { rel: 0.01 }),
          nombre("Module pour les sollicitations de longue durée ?", k.KfLongTerme / 1000, "MPa", `Kf/2 = ${fr(k.KfLongTerme / 1000, 3)} MPa.`, { rel: 0.01 }),
        ],
      };
    },
  },
  {
    id: "ch14-kf-petit", titre: "Module de réaction d'un pieu de petit diamètre", difficulte: 1,
    generer(a) {
      const B = a.entre(0.15, 0.55, 0.05), EM = a.entre(5, 40, 1), alpha = a.choix([1 / 3, 1 / 2, 2 / 3]);
      const k = moduleKf({ EM, B, alpha });
      const den = (4 / 3) * 2.65 ** alpha + alpha;
      return {
        enonce: `Micropieu ou petit pieu de diamètre B = ${frd(B, 2)} m < B0 = 0,60 m ; EM = ${fr(EM, 2)} MPa, α = ${fraction(alpha)}.`,
        donnees: [donnee("B", `${frd(B, 2)} m`), donnee("EM", `${fr(EM, 2)} MPa`), donnee("α", fraction(alpha))],
        questions: [
          nombre("Kf (courte durée) ?", k.Kf / 1000, "MPa", `B < B0 : Kf = 12 EM / [4/3 × 2,65^α + α] = 12 × ${fr(EM, 2)} / ${frd(den, 3)} = ${fr(k.Kf / 1000, 3)} MPa.`, { rel: 0.01 }),
          choixMelange(a, "Kf dépend-il du diamètre pour B < B0 ?", ["non : la formule ne contient plus B", "oui : il est proportionnel à B", "oui : il est inversement proportionnel à B"],
            "Pour B ≤ B0, la formule de Ménard ne dépend plus de B : Kf (module linéique) est constant, alors que le module surfacique k = Kf/B augmente quand le diamètre diminue."),
        ],
      };
    },
  },
  {
    id: "ch14-l0", titre: "Longueur de transfert : pieu souple ou rigide ?", difficulte: 2,
    generer(a) {
      const B = a.entre(0.4, 1.4, 0.1), E = a.choix([20000, 30000]), Kf = a.entre(5, 60, 1) * 1000, L = a.entre(3, 25, 1);
      const ei = EI(E, B);
      const l0 = (4 * ei / Kf) ** 0.25;
      const souple = pieuSouple({ L, l0 });
      return {
        enonce: `Pieu en béton (E = ${fr(E, 3)} MPa) de diamètre B = ${frd(B, 1)} m et de longueur L = ${fr(L, 2)} m ; module de réaction Kf = ${fr(Kf / 1000, 3)} MPa.`,
        donnees: [donnee("B · L", `${frd(B, 1)} · ${fr(L, 2)} m`), donnee("E", `${fr(E, 3)} MPa`), donnee("Kf", `${fr(Kf / 1000, 3)} MPa`)],
        questions: [
          nombre("Rigidité de flexion EI ?", ei, "kN·m²", `I = π B⁴/64 = ${frd((Math.PI * B ** 4) / 64, 5)} m⁴ ; EI = ${fr(ei, 4)} kN·m².`, { rel: 0.01 }),
          nombre("Longueur de transfert l0 ?", l0, "m", `l0 = (4 EI/Kf)^¼ = (4 × ${fr(ei, 4)} / ${fr(Kf, 4)})^¼ = ${frd(l0, 2)} m.`, { rel: 0.01 }),
          choixMelange(a, "Comportement du pieu ?", souple ? ["souple (pieu long) : L ≥ 3 l0", "rigide : il pivote en bloc"] : ["pas un pieu long : L < 3 l0, sa pointe participe", "souple (pieu long) : L ≥ 3 l0"],
            `L/l0 = ${frd(L / l0, 2)}. Au-delà de 3 environ, la pointe ne bouge plus et les formules du pieu infiniment long s'appliquent ; en deçà, il faut intégrer l'équation sur la longueur réelle.`),
        ],
      };
    },
  },
  {
    id: "ch14-libre", titre: "Pieu long, tête libre", difficulte: 2,
    generer(a) {
      const B = a.entre(0.6, 1.2, 0.1), E = 30000, Kf = a.entre(10, 50, 1) * 1000, H = a.entre(50, 400, 10);
      const r = pieuLongAnalytique({ EI: EI(E, B), Kf, H });
      return {
        enonce: `Pieu long (E = 30 000 MPa, B = ${frd(B, 1)} m) dans un sol homogène de module Kf = ${fr(Kf / 1000, 3)} MPa ; effort horizontal en tête H = ${fr(H, 3)} kN, tête libre, sans moment.`,
        donnees: [donnee("B", `${frd(B, 1)} m`), donnee("Kf", `${fr(Kf / 1000, 3)} MPa`), donnee("H", `${fr(H, 3)} kN`)],
        questions: [
          nombre("l0 ?", r.l0, "m", `l0 = (4 EI/Kf)^¼ = ${frd(r.l0, 3)} m.`, { rel: 0.01 }),
          nombre("Déplacement en tête y0 ?", r.y0 * 1000, "mm", `y0 = 2H/(Kf l0) = 2 × ${fr(H, 3)} / (${fr(Kf, 4)} × ${frd(r.l0, 3)}) = ${frd(r.y0 * 1000, 2)} mm.`, { rel: 0.015 }),
          nombre("Moment maximal ?", r.MMax, "kN·m", `Mmax ≈ 0,322 H l0 = ${fr(r.MMax, 4)} kN·m, atteint à ${frd(r.zMax, 2)} m (≈ 0,785 l0).`, { rel: 0.015 }),
        ],
      };
    },
  },
  {
    id: "ch14-encastre", titre: "Pieu long, tête encastrée dans la semelle", difficulte: 2,
    generer(a) {
      const B = a.entre(0.6, 1.2, 0.1), E = 30000, Kf = a.entre(10, 50, 1) * 1000, H = a.entre(50, 400, 10);
      const lib = pieuLongAnalytique({ EI: EI(E, B), Kf, H });
      const enc = pieuLongAnalytique({ EI: EI(E, B), Kf, H, tete: "encastree" });
      return {
        enonce: `Même pieu long (E = 30 000 MPa, B = ${frd(B, 1)} m, Kf = ${fr(Kf / 1000, 3)} MPa, H = ${fr(H, 3)} kN), mais la tête est encastrée dans une semelle rigide qui en bloque la rotation.`,
        donnees: [donnee("B", `${frd(B, 1)} m`), donnee("Kf", `${fr(Kf / 1000, 3)} MPa`), donnee("H", `${fr(H, 3)} kN`)],
        questions: [
          nombre("Déplacement en tête y0 ?", enc.y0 * 1000, "mm", `y0 = H/(Kf l0) = ${frd(enc.y0 * 1000, 2)} mm — la moitié du cas tête libre (${frd(lib.y0 * 1000, 2)} mm).`, { rel: 0.015 }),
          nombre("Moment d'encastrement M0 (valeur absolue) ?", Math.abs(enc.M0), "kN·m", `M0 = −H l0/2 = −${fr(H, 3)} × ${frd(enc.l0, 3)}/2 = −${fr(Math.abs(enc.M0), 4)} kN·m : le moment maximal passe en tête, où il faut ferrailler.`, { rel: 0.015 }),
        ],
      };
    },
  },
  {
    id: "ch14-palier", titre: "Palier de réaction et minoration près de la surface", difficulte: 2,
    generer(a) {
      const B = a.entre(0.5, 1.2, 0.1), pf = a.entre(0.3, 1.5, 0.05), sol = a.choix(["coherent", "frottant"]);
      const zc = (sol === "coherent" ? 2 : 4) * B, z = +(a.entre(0, 0.9, 0.05) * zc).toFixed(2);
      const m = minorationSurface({ z, B, sol });
      const r1 = B * pf * 1000;
      return {
        enonce: `Pieu de diamètre B = ${frd(B, 1)} m dans un sol ${sol === "coherent" ? "cohérent" : "frottant"} de pression de fluage nette pf* = ${frd(pf, 2)} MPa. On s'intéresse à la réaction du sol à ${frd(z, 2)} m sous la surface, pour une sollicitation de courte durée.`,
        donnees: [donnee("B", `${frd(B, 1)} m`), donnee("pf*", `${frd(pf, 2)} MPa`), donnee("Sol", sol === "coherent" ? "cohérent" : "frottant"), donnee("z", `${frd(z, 2)} m`)],
        questions: [
          nombre("Palier de réaction en profondeur r1 = B pf* ?", r1, "kN/m", `${frd(B, 1)} × ${fr(pf * 1000, 4)} = ${fr(r1, 4)} kN/m.`, { rel: 0.005 }),
          nombre("Profondeur de minoration zc ?", zc, "m", `zc = ${sol === "coherent" ? "2" : "4"} B = ${frd(zc, 2)} m.`, { rel: 0.005 }),
          nombre("Coefficient de minoration à cette profondeur ?", m.pente, "", `0,5 (1 + z/zc) = 0,5 × (1 + ${frd(z, 2)}/${frd(zc, 2)}) = ${frd(m.pente, 3)}.`, { rel: 0.01 }),
          nombre("Palier minoré ?", m.palier * r1, "kN/m", `${frd(m.palier, 3)} × ${fr(r1, 4)} = ${fr(m.palier * r1, 4)} kN/m.`, { rel: 0.01 }),
        ],
      };
    },
  },
];
