// Exercices du chapitre 2 : actions, combinaisons et sécurité.
import { fr, frd, nombre, choixMelange, donnee } from "./alea.js";
import { combinaisonsF62, combinaisonsEC7 } from "../geotech/combinaisons.js";

export default [
  {
    id: "ch2-elu", titre: "Une charge permanente, une charge d'exploitation", difficulte: 1,
    generer(a) {
      const G = a.entre(300, 1500, 10), Q = a.entre(80, 600, 10), psi2 = a.choix([0.3, 0.6]);
      const f = combinaisonsF62({ G: { V: G }, Q: { V: Q }, psi: { psi2 } });
      const e = combinaisonsEC7({ G: { V: G }, Q: { V: Q }, psi: { psi2 } });
      return {
        enonce: `Un poteau descend sur sa semelle une charge permanente G = ${fr(G, 4)} kN et une charge d'exploitation Q = ${fr(Q, 4)} kN (ψ2 = ${frd(psi2, 1)}). Aucune autre action variable.`,
        donnees: [donnee("G", `${fr(G, 4)} kN`), donnee("Q", `${fr(Q, 4)} kN`), donnee("ψ2", frd(psi2, 1))],
        questions: [
          nombre("Charge verticale à l'ELU fondamental (Fascicule 62) ?", f.ELU.V, "kN", `1,35 G + 1,5 Q = 1,35 × ${fr(G, 4)} + 1,5 × ${fr(Q, 4)} = ${fr(f.ELU.V, 5)} kN.`, { rel: 0.005 }),
          nombre("Charge verticale à l'ELU fondamental (Eurocode 0, approche 2) ?", e.ELU.V, "kN", `Même expression (6.10) : 1,35 G + 1,5 Q = ${fr(e.ELU.V, 5)} kN.`, { rel: 0.005 }),
          nombre("Charge à l'ELS quasi permanent ?", e.ELS_QP.V, "kN", `G + ψ2 Q = ${fr(G, 4)} + ${frd(psi2, 1)} × ${fr(Q, 4)} = ${fr(e.ELS_QP.V, 5)} kN : c'est la charge des tassements.`, { rel: 0.005 }),
          choixMelange(a, "Avec une seule action variable, les deux référentiels donnent-ils la même combinaison fondamentale ?",
            ["oui : les écarts n'apparaissent qu'avec les actions d'accompagnement", "non : l'Eurocode majore G de 1,5", "non : le Fascicule 62 ne majore pas Q"],
            "La forme linéaire du Fascicule 62 (1,35 Gmax + Gmin + γQ1 Q1 + 1,3 ψ0 Q2) et l'expression 6.10 de l'EN 1990 coïncident pour une seule action variable. La vraie différence entre les deux textes est côté résistance."),
        ],
      };
    },
  },
  {
    id: "ch2-accompagnement", titre: "Deux actions variables", difficulte: 2,
    generer(a) {
      const G = a.entre(400, 1200, 10), Q1 = a.entre(100, 400, 10), Q2 = a.entre(50, 250, 10), psi0 = a.choix([0.6, 0.7]);
      const f = combinaisonsF62({ G: { V: G }, Q: { V: Q1 }, Q2: { V: Q2 }, psi: { psi0 } });
      const e = combinaisonsEC7({ G: { V: G }, Q: { V: Q1 }, Q2: { V: Q2 }, psi: { psi0 } });
      return {
        enonce: `Charges verticales sur une semelle : G = ${fr(G, 4)} kN, action variable de base Q1 = ${fr(Q1, 4)} kN, action d'accompagnement Q2 = ${fr(Q2, 4)} kN, avec ψ0 = ${frd(psi0, 1)} dans les deux référentiels.`,
        donnees: [donnee("G", `${fr(G, 4)} kN`), donnee("Q1", `${fr(Q1, 4)} kN`), donnee("Q2", `${fr(Q2, 4)} kN`), donnee("ψ0", frd(psi0, 1))],
        questions: [
          nombre("ELU fondamental au Fascicule 62 ?", f.ELU.V, "kN", `1,35 G + 1,5 Q1 + 1,3 ψ0 Q2 = ${fr(1.35 * G, 5)} + ${fr(1.5 * Q1, 4)} + ${fr(1.3 * psi0 * Q2, 4)} = ${fr(f.ELU.V, 5)} kN.`, { rel: 0.005 }),
          nombre("ELU fondamental à l'Eurocode 0 ?", e.ELU.V, "kN", `1,35 G + 1,5 Q1 + 1,5 ψ0 Q2 = ${fr(1.35 * G, 5)} + ${fr(1.5 * Q1, 4)} + ${fr(1.5 * psi0 * Q2, 4)} = ${fr(e.ELU.V, 5)} kN.`, { rel: 0.005 }),
          nombre("Écart entre les deux ?", e.ELU.V - f.ELU.V, "kN", `(1,5 − 1,3) ψ0 Q2 = 0,2 × ${frd(psi0, 1)} × ${fr(Q2, 4)} = ${fr(e.ELU.V - f.ELU.V, 4)} kN : seul le coefficient de l'action d'accompagnement diffère.`, { rel: 0.01 }),
        ],
      };
    },
  },
  {
    id: "ch2-els", titre: "Les trois combinaisons de service", difficulte: 1,
    generer(a) {
      const G = a.entre(200, 900, 10), Q = a.entre(100, 500, 10);
      const [psi1, psi2] = a.choix([[0.5, 0.3], [0.7, 0.6], [0.5, 0.2]]);
      const e = combinaisonsEC7({ G: { V: G }, Q: { V: Q }, psi: { psi1, psi2 } });
      return {
        enonce: `G = ${fr(G, 4)} kN, Q = ${fr(Q, 4)} kN ; ψ1 = ${frd(psi1, 1)}, ψ2 = ${frd(psi2, 1)}.`,
        donnees: [donnee("G", `${fr(G, 4)} kN`), donnee("Q", `${fr(Q, 4)} kN`), donnee("ψ1 · ψ2", `${frd(psi1, 1)} · ${frd(psi2, 1)}`)],
        questions: [
          nombre("ELS caractéristique (ELS rare au Fascicule 62) ?", e.ELS_car.V, "kN", `G + Q = ${fr(e.ELS_car.V, 5)} kN.`, { rel: 0.005 }),
          nombre("ELS fréquent ?", e.ELS_freq.V, "kN", `G + ψ1 Q = ${fr(G, 4)} + ${frd(psi1, 1)} × ${fr(Q, 4)} = ${fr(e.ELS_freq.V, 5)} kN.`, { rel: 0.005 }),
          nombre("ELS quasi permanent ?", e.ELS_QP.V, "kN", `G + ψ2 Q = ${fr(G, 4)} + ${frd(psi2, 1)} × ${fr(Q, 4)} = ${fr(e.ELS_QP.V, 5)} kN.`, { rel: 0.005 }),
          choixMelange(a, "Sous quelle combinaison calcule-t-on le tassement d'une semelle ?",
            ["quasi permanente", "caractéristique", "fréquente", "fondamentale"],
            "Le tassement se calcule sous les charges présentes la plus grande partie du temps : combinaison quasi permanente (F62 annexe F.2 § 1 ; NF P94-261 § 13)."),
        ],
      };
    },
  },
  {
    id: "ch2-excentrement", titre: "Quelle combinaison excentre le plus ?", difficulte: 2,
    generer(a) {
      const B = a.entre(1.6, 3.2, 0.1), VG = a.entre(250, 700, 10), HQ = a.entre(20, 80, 5), h = a.entre(1, 3, 0.5);
      const MQ = HQ * h;
      const def = { V: 1.35 * VG, M: 1.5 * MQ }, fav = { V: VG, M: 1.5 * MQ };
      const e1 = def.M / def.V, e2 = fav.M / fav.V;
      const ie = 1 - (2 * e2) / B;
      return {
        enonce: `Une semelle filante de largeur B = ${frd(B, 1)} m reçoit une charge permanente centrée VG = ${fr(VG, 3)} kN/m et un effort horizontal variable HQ = ${fr(HQ, 3)} kN/m appliqué à ${frd(h, 1)} m au-dessus de la base.`,
        donnees: [donnee("B", `${frd(B, 1)} m`), donnee("VG", `${fr(VG, 3)} kN/m`), donnee("HQ", `${fr(HQ, 3)} kN/m`), donnee("bras de levier", `${frd(h, 1)} m`)],
        questions: [
          nombre("Excentrement à l'ELU avec G défavorable (1,35 G + 1,5 Q) ?", e1, "m", `M = 1,5 × ${fr(HQ, 3)} × ${frd(h, 1)} = ${fr(def.M, 4)} kN·m/m ; V = 1,35 × ${fr(VG, 3)} = ${fr(def.V, 4)} kN/m ; e = ${frd(e1, 3)} m.`, { rel: 0.01 }),
          nombre("Excentrement à l'ELU avec G favorable (1,0 G + 1,5 Q) ?", e2, "m", `Même moment, V = ${fr(fav.V, 3)} kN/m : e = ${fr(fav.M, 4)} / ${fr(fav.V, 3)} = ${frd(e2, 3)} m — 35 % de plus.`, { rel: 0.01 }),
          nombre("Coefficient 1 − 2e/B de la NF P94-261 pour la combinaison défavorable à l'excentrement ?", ie, "", `1 − 2 × ${frd(e2, 3)} / ${frd(B, 1)} = ${frd(ie, 3)}, à comparer à 1/15 = 0,067 à l'ELU.`, { rel: 0.01 }),
          choixMelange(a, "Quelle combinaison faut-il retenir pour vérifier l'excentrement ?",
            ["celle où G est favorable : V minimal pour le même moment", "celle où G est défavorable : les charges sont maximales", "l'ELS quasi permanent"],
            "L'excentrement e = M/V augmente quand V diminue : on associe au moment maximal la charge verticale minimale (G avec γG = 1,0)."),
        ],
      };
    },
  },
  {
    id: "ch2-quelle-combinaison", titre: "À chaque vérification sa combinaison", difficulte: 1,
    generer(a) {
      const pool = [
        ["Vérification de la portance d'une semelle au Fascicule 62, en service ?", ["combinaisons rares (γq = 3)", "combinaisons quasi permanentes (γq = 2)", "combinaisons fréquentes (γq = 1,5)"],
          "F62 B.3.1,2 : états limites de service sous combinaisons rares, avec γq = 3 sur (q'u − q'0)."],
        ["Critère « sol entièrement comprimé » au Fascicule 62 ?", ["combinaisons fréquentes", "combinaisons rares", "combinaisons fondamentales"],
          "F62 B.3.3 : entièrement comprimé sous combinaisons fréquentes, au moins 75 % sous combinaisons rares."],
        ["Critère 1 − 2e/B ≥ 2/3 de la NF P94-261 ?", ["ELS quasi permanents et fréquents", "ELS caractéristiques", "ELU fondamentaux"],
          "Tableau 8 du guide Cerema : 2/3 aux ELS quasi permanents et fréquents, 1/2 aux ELS caractéristiques, 1/15 aux ELU."],
        ["Vérification du glissement d'une semelle ?", ["ELU, avec la charge verticale minimale associée à H", "ELS caractéristique", "ELU, avec la charge verticale maximale"],
          "Le glissement est un état limite ultime où V est une résistance : on prend la combinaison qui minimise V pour le H considéré."],
        ["Charge de fluage d'un pieu, vérifiée à l'ELS quasi permanent : quel coefficient au Fascicule 62 ?", ["Qc / 1,4", "Qc / 1,1", "Qu / 1,4"],
          "F62 C.4.1 : Qmax = Qc/1,4 sous combinaisons quasi permanentes, Qc/1,1 sous combinaisons rares, Qu/1,4 à l'ELU."],
      ];
      return { enonce: "Associer chaque vérification à sa combinaison d'actions.", questions: a.tirage(pool, 4).map(([t, o, e]) => choixMelange(a, t, o, e)) };
    },
  },
  {
    id: "ch2-securite", titre: "Où chaque référentiel place sa sécurité", difficulte: 2,
    generer(a) {
      const qnet = a.entre(400, 1500, 10);
      const qF62 = qnet / 2, qEC7 = qnet / (1.4 * 1.2);
      return {
        enonce: `Une semelle a une contrainte de rupture nette kp·ple* = ${fr(qnet, 4)} kPa, sous charge verticale centrée (iδ = ie = 1).`,
        donnees: [donnee("kp·ple*", `${fr(qnet, 4)} kPa`)],
        questions: [
          nombre("Contrainte nette admissible à l'ELU au Fascicule 62 ?", qF62, "kPa", `(q'u − q'0)/γq = ${fr(qnet, 4)} / 2 = ${fr(qF62, 4)} kPa.`, { rel: 0.01 }),
          nombre("Contrainte nette de calcul à l'ELU à la NF P94-261 ?", qEC7, "kPa", `qnet/(γR;v γR;d;v) = ${fr(qnet, 4)} / (1,4 × 1,2) = ${fr(qEC7, 4)} kPa.`, { rel: 0.01 }),
          nombre("Rapport des deux ?", qEC7 / qF62, "", `2 / 1,68 = ${frd(2 / 1.68, 3)} : à k_p égal, la norme admet 19 % de plus — mais ses k_p et sa surface effective diffèrent.`, { rel: 0.01 }),
          choixMelange(a, "Que mesure le coefficient γR;d;v = 1,2 de la NF P94-261 ?",
            ["l'incertitude de la méthode de calcul, calée sur des essais de chargement", "la variabilité des charges d'exploitation", "l'effet de la nappe"],
            "C'est un coefficient de modèle : il a été déterminé par l'exploitation d'une base d'essais de chargement de fondations superficielles (guide Cerema, note 37)."),
        ],
      };
    },
  },
];
