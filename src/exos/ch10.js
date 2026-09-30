// Exercices du chapitre 10 : les pieux, technologies et comportement.
import { fr, frd, nombre, choixMelange, donnee } from "./alea.js";
import { section, CATEGORIES_PIEUX_EC7 } from "../geotech/pieux.js";
import { coefficientsFrankZhao } from "../geotech/tassement-pieu.js";

export default [
  {
    id: "ch10-Qc", titre: "Charge limite et charge de fluage", difficulte: 1,
    generer(a) {
      const Qpu = a.entre(300, 2500, 10), Qsu = a.entre(400, 3000, 10), refoulant = a.choix([false, true]);
      const Qc = (refoulant ? 0.7 : 0.5) * Qpu + 0.7 * Qsu;
      return {
        enonce: `Un pieu ${refoulant ? "battu (mis en place avec refoulement du sol)" : "foré (sans refoulement)"} a une résistance de pointe Qpu = ${fr(Qpu, 4)} kN et un frottement latéral limite Qsu = ${fr(Qsu, 4)} kN.`,
        donnees: [donnee("Mise en œuvre", refoulant ? "battu" : "foré"), donnee("Qpu", `${fr(Qpu, 4)} kN`), donnee("Qsu", `${fr(Qsu, 4)} kN`)],
        questions: [
          nombre("Charge limite Qu ?", Qpu + Qsu, "kN", `Qu = Qpu + Qsu = ${fr(Qpu + Qsu, 5)} kN.`, { rel: 0.005 }),
          nombre("Charge de fluage Qc ?", Qc, "kN", `Qc = ${refoulant ? "0,7" : "0,5"} Qpu + 0,7 Qsu = ${fr((refoulant ? 0.7 : 0.5) * Qpu, 4)} + ${fr(0.7 * Qsu, 4)} = ${fr(Qc, 5)} kN (F62 annexe C.2 ; formule 14.2.2 de la NF P94-262 pour Rc;cr;k).`, { rel: 0.005 }),
          nombre("Rapport Qc/Qu ?", Qc / (Qpu + Qsu), "", `${frd(Qc / (Qpu + Qsu), 3)} : la charge de fluage est d'autant plus proche de la charge limite que le frottement domine.`, { rel: 0.01 }),
        ],
      };
    },
  },
  {
    id: "ch10-flottant", titre: "Un pieu flottant ?", difficulte: 1,
    generer(a) {
      const B = a.entre(0.4, 1.2, 0.1), D = a.entre(8, 25, 1), qb = a.entre(1000, 5000, 100), qs = a.entre(30, 120, 5), refoulant = false;
      const { Ab, P } = section({ B });
      const Qpu = Ab * qb, Qsu = P * D * qs;
      const flottant = 0.7 * Qsu > 0.5 * Qpu;
      return {
        enonce: `Pieu foré de diamètre B = ${frd(B, 1)} m et de longueur D = ${fr(D, 2)} m ; contrainte de rupture sous la pointe qb = ${fr(qb, 4)} kPa, frottement unitaire moyen qs = ${fr(qs, 3)} kPa.`,
        donnees: [donnee("B · D", `${frd(B, 1)} · ${fr(D, 2)} m`), donnee("qb", `${fr(qb, 4)} kPa`), donnee("qs", `${fr(qs, 3)} kPa`)],
        questions: [
          nombre("Résistance de pointe Qpu ?", Qpu, "kN", `Ab = π B²/4 = ${frd(Ab, 4)} m² ; Qpu = ${frd(Ab, 4)} × ${fr(qb, 4)} = ${fr(Qpu, 4)} kN.`, { rel: 0.01 }),
          nombre("Frottement Qsu ?", Qsu, "kN", `P = π B = ${frd(P, 3)} m ; Qsu = ${frd(P, 3)} × ${fr(D, 2)} × ${fr(qs, 3)} = ${fr(Qsu, 4)} kN.`, { rel: 0.01 }),
          choixMelange(a, "Le pieu est-il flottant au sens du Fascicule 62 ?",
            flottant ? ["oui : sous Qc, le frottement mobilisé dépasse la pointe", "non : la pointe l'emporte"] : ["non : sous Qc, la pointe l'emporte", "oui : le frottement l'emporte"],
            `F62 C.4.1,21 : sous la charge de fluage, frottement 0,7 Qsu = ${fr(0.7 * Qsu, 4)} kN contre pointe 0,5 Qpu = ${fr(0.5 * Qpu, 4)} kN. ${refoulant ? "" : ""}Un groupe de pieux flottants appelle une vérification d'effet de groupe.`),
        ],
      };
    },
  },
  {
    id: "ch10-traction", titre: "Pieu en traction", difficulte: 1,
    generer(a) {
      const Qsu = a.entre(300, 2500, 10);
      return {
        enonce: `Un pieu sollicité en traction a un frottement latéral limite Qsu = ${fr(Qsu, 4)} kN (le poids propre est négligé).`,
        donnees: [donnee("Qsu", `${fr(Qsu, 4)} kN`)],
        questions: [
          nombre("Charge limite en traction Qtu ?", Qsu, "kN", `Qtu = Qsu = ${fr(Qsu, 4)} kN : la pointe ne travaille pas en traction.`, { rel: 0.005 }),
          nombre("Charge de fluage en traction Qtc ?", 0.7 * Qsu, "kN", `Qtc = 0,7 Qsu = ${fr(0.7 * Qsu, 4)} kN.`, { rel: 0.005 }),
          nombre("Qmin à l'ELU fondamental, Fascicule 62 (traction comptée négativement) ?", -Qsu / 1.4, "kN", `Qmin = −Qtu/1,4 = −${fr(Qsu / 1.4, 4)} kN.`, { rel: 0.01 }),
          nombre("Qmin sous combinaison rare (négatif) ?", (-0.7 * Qsu) / 1.4, "kN", `Qmin = −Qtc/1,4 = −${fr((0.7 * Qsu) / 1.4, 4)} kN. Sous combinaison quasi permanente, aucune traction n'est admise.`, { rel: 0.01 }),
        ],
      };
    },
  },
  {
    id: "ch10-categories", titre: "Classes et catégories de pieux", difficulte: 1,
    generer(a) {
      const c = a.choix(CATEGORIES_PIEUX_EC7.filter((x) => x.cat <= 16));
      const autres = a.tirage(CATEGORIES_PIEUX_EC7.filter((x) => String(x.classe) !== String(c.classe)).map((x) => `classe ${x.classe}`), 6);
      const opts = [...new Set(autres)].slice(0, 3);
      return {
        enonce: `Un projet prévoit des pieux de type « ${c.nom.toLowerCase()} » (sigle ${c.abr}).`,
        donnees: [donnee("Technologie", c.nom), donnee("Sigle", c.abr)],
        questions: [
          choixMelange(a, "Classe de la NF P94-262 ?", [`classe ${c.classe}`, ...opts],
            `Catégorie ${c.cat} (${c.abr}), classe ${c.classe} de l'annexe A de la NF P94-262. La classe fixe k_p,max et k_c,max ; la catégorie fixe α_pieu-sol et q_s,max.`),
          choixMelange(a, "Mise en place avec refoulement du sol ?", c.refoulement ? ["oui", "non"] : ["non", "oui"],
            c.refoulement ? "Pieu battu ou vissé : le sol est chassé latéralement et densifié ; la charge de fluage prend alors 0,7 R_b." : "Pieu foré : le sol est extrait ; la charge de fluage ne prend que 0,5 R_b."),
          choixMelange(a, "Combien de catégories de pieux la NF P94-262 distingue-t-elle ?", ["20", "8", "12", "7"],
            "Vingt catégories, regroupées en huit classes (plus la classe 1bis des micropieux)."),
        ],
      };
    },
  },
  {
    id: "ch10-section", titre: "Pieu carré ou pieu circulaire", difficulte: 1,
    generer(a) {
      const B = a.entre(0.3, 0.6, 0.05), qb = a.entre(2000, 6000, 100), qs = a.entre(40, 120, 5);
      const c = section({ B }), k = section({ B, forme: "carre" });
      return {
        enonce: `On compare un pieu circulaire de diamètre ${frd(B, 2)} m et un pieu carré de ${frd(B, 2)} m de côté, avec qb = ${fr(qb, 4)} kPa et qs = ${fr(qs, 3)} kPa.`,
        donnees: [donnee("B", `${frd(B, 2)} m`), donnee("qb", `${fr(qb, 4)} kPa`), donnee("qs", `${fr(qs, 3)} kPa`)],
        questions: [
          nombre("Résistance de pointe du pieu circulaire ?", c.Ab * qb, "kN", `Ab = π B²/4 = ${frd(c.Ab, 4)} m² ; Rb = ${fr(c.Ab * qb, 4)} kN.`, { rel: 0.01 }),
          nombre("Résistance de pointe du pieu carré ?", k.Ab * qb, "kN", `Ab = B² = ${frd(k.Ab, 4)} m² ; Rb = ${fr(k.Ab * qb, 4)} kN, soit 4/π = 1,27 fois plus.`, { rel: 0.01 }),
          nombre("Frottement par mètre de fût du pieu carré ?", k.P * qs, "kN/m", `P = 4 B = ${frd(k.P, 3)} m ; P qs = ${fr(k.P * qs, 4)} kN/m (contre ${fr(c.P * qs, 4)} kN/m pour le pieu circulaire).`, { rel: 0.01 }),
        ],
      };
    },
  },
  {
    id: "ch10-frankzhao", titre: "Lois de transfert de Frank et Zhao", difficulte: 2,
    generer(a) {
      const B = a.entre(0.4, 1.2, 0.1), EM = a.entre(5, 30, 1), sol = a.choix(["fin", "granulaire"]), qs = a.entre(40, 120, 5);
      const { kt, kq } = coefficientsFrankZhao({ EM, B, sol });
      const s1 = qs / (2 * kt), s2 = s1 + qs / 2 / (kt / 5);
      return {
        enonce: `Pieu de diamètre B = ${frd(B, 1)} m dans un sol ${sol === "fin" ? "fin" : "granulaire"} de module pressiométrique EM = ${fr(EM, 2)} MPa ; frottement limite qs = ${fr(qs, 3)} kPa.`,
        donnees: [donnee("B", `${frd(B, 1)} m`), donnee("EM", `${fr(EM, 2)} MPa`), donnee("Sol", sol), donnee("qs", `${fr(qs, 3)} kPa`)],
        questions: [
          nombre("Pente kt de la loi de frottement ?", kt / 1000, "MPa/m", `kt = ${sol === "fin" ? "2" : "0,8"} EM/B = ${fr(kt / 1000, 3)} MPa/m.`, { rel: 0.01 }),
          nombre("Pente kq de la loi de pointe ?", kq / 1000, "MPa/m", `kq = ${sol === "fin" ? "11" : "4,8"} EM/B = ${fr(kq / 1000, 3)} MPa/m.`, { rel: 0.01 }),
          nombre("Déplacement mobilisant qs/2 ?", s1 * 1000, "mm", `La loi est linéaire jusqu'à qs/2 : s = qs/(2 kt) = ${frd(s1 * 1000, 2)} mm.`, { rel: 0.02 }),
          nombre("Déplacement mobilisant qs en entier ?", s2 * 1000, "mm", `Au-delà, la pente est divisée par 5 : s = qs/(2kt) + (qs/2)/(kt/5) = 3 qs/kt = ${frd(s2 * 1000, 2)} mm — quelques millimètres, contre des centimètres pour la pointe.`, { rel: 0.02 }),
        ],
      };
    },
  },
];
