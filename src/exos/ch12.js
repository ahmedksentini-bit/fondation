// Exercices du chapitre 12 : justifier un pieu.
import { fr, frd, nombre, choixMelange, donnee } from "./alea.js";
import * as P from "../geotech/pieux.js";
import { tassementForfaitaire, tassementPrudent } from "../geotech/tassement-pieu.js";

export default [
  {
    id: "ch12-f62", titre: "Qmax et Qmin du Fascicule 62", difficulte: 1,
    generer(a) {
      const Qpu = a.entre(400, 2500, 10), Qsu = a.entre(500, 3000, 10), refoulant = a.choix([false, true]);
      const Qu = Qpu + Qsu, Qc = (refoulant ? 0.7 : 0.5) * Qpu + 0.7 * Qsu;
      const l = P.limitesF62({ Qu, Qc, Qtu: Qsu, Qtc: 0.7 * Qsu });
      return {
        enonce: `Pieu ${refoulant ? "battu" : "foré"} : Qpu = ${fr(Qpu, 4)} kN, Qsu = ${fr(Qsu, 4)} kN.`,
        donnees: [donnee("Qpu", `${fr(Qpu, 4)} kN`), donnee("Qsu", `${fr(Qsu, 4)} kN`), donnee("Mise en œuvre", refoulant ? "battu" : "foré")],
        questions: [
          nombre("Qmax à l'ELU fondamental ?", l.ELU.Qmax, "kN", `Qu/1,4 = ${fr(Qu, 5)}/1,4 = ${fr(l.ELU.Qmax, 5)} kN.`, { rel: 0.01 }),
          nombre("Qmax sous combinaison rare ?", l.ELS_rare.Qmax, "kN", `Qc = ${fr(Qc, 5)} kN ; Qc/1,1 = ${fr(l.ELS_rare.Qmax, 5)} kN.`, { rel: 0.01 }),
          nombre("Qmax sous combinaison quasi permanente ?", l.ELS_QP.Qmax, "kN", `Qc/1,4 = ${fr(l.ELS_QP.Qmax, 5)} kN.`, { rel: 0.01 }),
          nombre("Qmin à l'ELU fondamental (traction comptée négativement) ?", l.ELU.Qmin, "kN", `−Qtu/1,4 = −${fr(Qsu, 4)}/1,4 = ${fr(l.ELU.Qmin, 5)} kN.`, { rel: 0.01 }),
        ],
      };
    },
  },
  {
    id: "ch12-terrain", titre: "Procédure du modèle de terrain", difficulte: 2,
    generer(a) {
      const methode = a.choix(["pressio", "penetro"]), cat = a.choix([1, 2, 6, 9, 12]), craie = a.choix([false, false, true]);
      const Rb = a.entre(300, 2000, 10), Rs = a.entre(500, 3000, 10);
      const pc = P.categoriePieu(cat);
      const r = P.modeleTerrain({ applicable: true, methode, categorie: pc, craie, refoulement: pc.refoulement, Rb, Rs, Rc: Rb + Rs, Rt: Rs });
      return {
        enonce: `Pieu de catégorie ${cat} (${pc.nom.toLowerCase()}) calculé ${methode === "pressio" ? "au pressiomètre" : "au pénétromètre"}${craie ? ", pointe ancrée dans la craie" : ""} : Rb = ${fr(Rb, 4)} kN, Rs = ${fr(Rs, 4)} kN (valeurs calculées sur le profil de sol représentatif).`,
        donnees: [donnee("Catégorie", `${cat} · ${pc.abr}`), donnee("Méthode", methode === "pressio" ? "pressiomètre" : "pénétromètre"), donnee("Rb · Rs", `${fr(Rb, 4)} · ${fr(Rs, 4)} kN`), donnee("Craie", craie ? "oui" : "non")],
        questions: [
          nombre("Coefficient γR;d1 en compression ?", r.gRd1c, "", `Tableau F.2.1/G.2.1 : γR;d1 = ${frd(r.gRd1c, 2)}${[10, 15, 17, 18, 19, 20].includes(cat) ? " (catégorie à coefficient majoré)" : craie ? " (pointe dans la craie)" : ""} ; γR;d2 = 1,1.`, { abs: 0.001 }),
          nombre("Rc;k ?", r.Rck, "kN", `Rc;k = (Rb + Rs)/(γR;d1 γR;d2) = ${fr(Rb + Rs, 5)} / (${frd(r.gRd1c, 2)} × 1,1) = ${fr(r.Rck, 5)} kN.`, { rel: 0.01 }),
          nombre("Rc;d à l'ELU fondamental ?", r.calcul.ELU.Rcd, "kN", `Rc;d = Rc;k/γt = ${fr(r.Rck, 5)}/1,1 = ${fr(r.calcul.ELU.Rcd, 5)} kN.`, { rel: 0.01 }),
          nombre("Coefficient global Rc / Rc;d ?", (Rb + Rs) / r.calcul.ELU.Rcd, "", `${frd(r.gRd1c, 2)} × 1,1 × 1,1 = ${frd((Rb + Rs) / r.calcul.ELU.Rcd, 3)}, à comparer au 1,4 du Fascicule 62.`, { rel: 0.005 }),
        ],
      };
    },
  },
  {
    id: "ch12-xi", titre: "Facteurs de corrélation ξ", difficulte: 2,
    generer(a) {
      const N = a.entier(1, 10), L = a.entre(15, 80, 5), l = a.entre(8, 40, 1);
      const s = P.surfaceInvestigation({ L, l });
      const x = P.facteursCorrelation({ N, S: s.S });
      return {
        enonce: `Les appuis et les ${N} sondage${N > 1 ? "s" : ""} d'un ouvrage tiennent dans un rectangle de ${fr(Math.max(L, l), 3)} m × ${fr(Math.min(L, l), 3)} m.`,
        donnees: [donnee("Rectangle", `${fr(Math.max(L, l), 3)} × ${fr(Math.min(L, l), 3)} m`), donnee("N", String(N))],
        questions: [
          nombre("Surface d'investigation S à retenir ?", s.S, "m²", `Élancement limité à 2 : l = max(${fr(Math.min(L, l), 3)} ; ${fr(Math.max(L, l), 3)}/2) = ${fr(s.l, 3)} m ; S = ${fr(s.L, 3)} × ${fr(s.l, 3)} = ${fr(s.L * s.l, 4)} m², bornée à [100 ; 2 500] : S = ${fr(s.S, 4)} m².`, { rel: 0.005 }),
          nombre("ξ3 ?", x.xiMoy, "", `ξ'3 = ${frd(x.xiPrime[0], 2)} pour N = ${N} ; ξ3 = 1 + (ξ'3 − 1) √(S/2500) = 1 + ${frd(x.xiPrime[0] - 1, 2)} × ${frd(Math.sqrt(x.Sretenue / 2500), 3)} = ${frd(x.xiMoy, 3)}.`, { rel: 0.005 }),
          nombre("ξ4 ?", x.xiMin, "", `ξ'4 = ${frd(x.xiPrime[1], 2)} ; ξ4 = 1 + ${frd(x.xiPrime[1] - 1, 2)} × ${frd(Math.sqrt(x.Sretenue / 2500), 3)} = ${frd(x.xiMin, 3)}.`, { rel: 0.005 }),
        ],
      };
    },
  },
  {
    id: "ch12-modele", titre: "Procédure du pieu modèle avec trois sondages", difficulte: 3,
    generer(a) {
      const cat = a.choix([1, 2, 6]), methode = "pressio", S = a.entre(300, 2500, 50);
      const base = a.entre(1500, 3000, 50);
      const Rc = [0, 1, 2].map(() => +(base * a.entre(0.75, 1.25, 0.01)).toFixed(0));
      const pc = P.categoriePieu(cat);
      const res = Rc.map((v) => ({ applicable: true, methode, categorie: pc, craie: false, refoulement: false, Rb: 0.3 * v, Rs: 0.7 * v, Rc: v, Rt: 0.7 * v }));
      const r = P.pieuModele({ resultats: res, S });
      const moy = (Rc[0] + Rc[1] + Rc[2]) / 3, min = Math.min(...Rc);
      return {
        enonce: `Un pieu de catégorie ${cat} (${pc.nom.toLowerCase()}) est calculé au pressiomètre au droit de trois sondages : Rc = ${Rc.map((v) => fr(v, 4)).join(" ; ")} kN. Surface d'investigation S = ${fr(S, 4)} m² ; structure souple.`,
        donnees: [donnee("Rc (3 sondages)", `${Rc.map((v) => fr(v, 4)).join(" · ")} kN`), donnee("S", `${fr(S, 4)} m²`)],
        questions: [
          nombre("(Rc)moy / ξ3 ?", moy / r.xiMoy, "kN", `(Rc)moy = ${fr(moy, 5)} kN ; ξ3 = ${frd(r.xiMoy, 3)} ; ${fr(moy / r.xiMoy, 5)} kN.`, { rel: 0.01 }),
          nombre("(Rc)min / ξ4 ?", min / r.xiMin, "kN", `(Rc)min = ${fr(min, 4)} kN ; ξ4 = ${frd(r.xiMin, 3)} ; ${fr(min / r.xiMin, 5)} kN.`, { rel: 0.01 }),
          nombre("Rc;k ?", r.Rck, "kN", `Rc;k = min(…)/γR;d1 = ${fr(Math.min(moy / r.xiMoy, min / r.xiMin), 5)} / ${frd(r.gRd1c, 2)} = ${fr(r.Rck, 5)} kN — c'est ${r.moyenneGouverne ? "la moyenne" : "le minimum"} qui gouverne.`, { rel: 0.01 }),
        ],
      };
    },
  },
  {
    id: "ch12-els", titre: "Charge de fluage de calcul", difficulte: 2,
    generer(a) {
      const Rbk = a.entre(200, 1500, 10), Rsk = a.entre(400, 2500, 10), refoulant = a.choix([false, true]);
      const Rccrk = (refoulant ? 0.7 : 0.5) * Rbk + 0.7 * Rsk;
      const Fqp = +(Rccrk / a.entre(0.9, 1.4, 0.05)).toFixed(0);
      return {
        enonce: `Pieu ${refoulant ? "battu" : "foré"} : Rb;k = ${fr(Rbk, 4)} kN, Rs;k = ${fr(Rsk, 4)} kN. À l'ELS quasi permanent, Fc;d = ${fr(Fqp, 4)} kN.`,
        donnees: [donnee("Rb;k · Rs;k", `${fr(Rbk, 4)} · ${fr(Rsk, 4)} kN`), donnee("Fc;d (ELS QP)", `${fr(Fqp, 4)} kN`)],
        questions: [
          nombre("Rc;cr;k ?", Rccrk, "kN", `Rc;cr;k = ${refoulant ? "0,7" : "0,5"} Rb;k + 0,7 Rs;k = ${fr(Rccrk, 5)} kN.`, { rel: 0.01 }),
          nombre("Rc;cr;d à l'ELS quasi permanent ?", Rccrk / 1.1, "kN", `Rc;cr;d = Rc;cr;k/γcr = ${fr(Rccrk, 5)}/1,1 = ${fr(Rccrk / 1.1, 5)} kN.`, { rel: 0.01 }),
          nombre("Rc;cr;d à l'ELS caractéristique ?", Rccrk / 0.9, "kN", `γcr = 0,9 : ${fr(Rccrk / 0.9, 5)} kN.`, { rel: 0.01 }),
          choixMelange(a, "La vérification quasi permanente est-elle satisfaite ?", Fqp <= Rccrk / 1.1 ? ["oui", "non"] : ["non", "oui"],
            `Fc;d = ${fr(Fqp, 4)} kN ${Fqp <= Rccrk / 1.1 ? "≤" : ">"} ${fr(Rccrk / 1.1, 5)} kN.`),
        ],
      };
    },
  },
  {
    id: "ch12-traction", titre: "Résistance de calcul en traction", difficulte: 2,
    generer(a) {
      const methode = a.choix(["pressio", "penetro"]), cat = a.choix([1, 2, 12]), Rs = a.entre(400, 2500, 10);
      const pc = P.categoriePieu(cat);
      const r = P.modeleTerrain({ applicable: true, methode, categorie: pc, craie: false, refoulement: pc.refoulement, Rb: 0, Rs, Rc: Rs, Rt: Rs });
      return {
        enonce: `Pieu tendu de catégorie ${cat} (${pc.nom.toLowerCase()}), calculé ${methode === "pressio" ? "au pressiomètre" : "au pénétromètre"} par le modèle de terrain : frottement calculé Rs = ${fr(Rs, 4)} kN.`,
        donnees: [donnee("Catégorie", `${cat}`), donnee("Méthode", methode === "pressio" ? "pressiomètre" : "pénétromètre"), donnee("Rs", `${fr(Rs, 4)} kN`)],
        questions: [
          nombre("γR;d1 en traction ?", r.gRd1t, "", `Tableau F.2.1/G.2.1 : ${frd(r.gRd1t, 2)} — plus sévère qu'en compression (${frd(r.gRd1c, 2)}).`, { abs: 0.001 }),
          nombre("Rt;k ?", r.Rtk, "kN", `Rt;k = Rs/(γR;d1 γR;d2) = ${fr(Rs, 4)} / (${frd(r.gRd1t, 2)} × 1,1) = ${fr(r.Rtk, 5)} kN.`, { rel: 0.01 }),
          nombre("Rt;d à l'ELU fondamental ?", r.calcul.ELU.Rtd, "kN", `Rt;d = Rt;k/γs;t = ${fr(r.Rtk, 5)}/1,15 = ${fr(r.calcul.ELU.Rtd, 5)} kN (facteur global ${frd(Rs / r.calcul.ELU.Rtd, 2)} contre 1,4 au Fascicule 62).`, { rel: 0.01 }),
        ],
      };
    },
  },
  {
    id: "ch12-tassement", titre: "Ordre de grandeur du tassement d'un pieu", difficulte: 1,
    generer(a) {
      const B = a.entre(0.4, 1.5, 0.1), mise = a.choix(["fore", "battu"]), L = a.entre(10, 30, 1), N = a.entre(500, 3000, 50), E = a.choix([20000, 25000, 30000]);
      const f = tassementForfaitaire({ B, mise });
      const el = (N * L) / (E * 1000 * (Math.PI * B * B) / 4);
      const sp = tassementPrudent({ B, el });
      return {
        enonce: `Pieu ${mise === "fore" ? "foré" : "battu"} de diamètre ${frd(B, 1)} m et de ${fr(L, 2)} m de long, en béton (E = ${fr(E, 3)} MPa), sous un effort de service de ${fr(N, 4)} kN.`,
        donnees: [donnee("B · L", `${frd(B, 1)} · ${fr(L, 2)} m`), donnee("Mise en œuvre", mise === "fore" ? "foré" : "battu"), donnee("N · E", `${fr(N, 4)} kN · ${fr(E, 3)} MPa`)],
        questions: [
          nombre("Tassement forfaitaire (règles LCPC-Sétra) ?", f.s * 1000, "mm", `${mise === "fore" ? "0,006" : "0,009"} B = ${frd(f.s * 1000, 1)} mm (fourchette ${frd(f.min * 1000, 1)} à ${frd(f.max * 1000, 1)} mm).`, { rel: 0.01 }),
          nombre("Raccourcissement élastique du fût, effort supposé constant ?", el * 1000, "mm", `el = N L/(E A) = ${fr(N, 4)} × ${fr(L, 2)} / (${fr(E * 1000, 5)} × ${frd((Math.PI * B * B) / 4, 4)}) = ${frd(el * 1000, 2)} mm — majorant, l'effort décroissant en réalité avec la profondeur.`, { rel: 0.02 }),
          nombre("Estimation prudente de la NF P94-262 (2 B/100 + el) ?", sp * 1000, "mm", `s = 2 × ${frd(B, 1)}/100 + el = ${frd((2 * B) / 100 * 1000, 1)} + ${frd(el * 1000, 2)} = ${frd(sp * 1000, 1)} mm.`, { rel: 0.02 }),
        ],
      };
    },
  },
];
