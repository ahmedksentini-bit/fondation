// Exercices du chapitre 2 : dépouillement des essais en place.
import { fr, frd, nombre, choixMelange, donnee } from "./alea.js";
import * as E from "../geotech/essais.js";
import { proposerClasseF62, CLASSES_F62 } from "../geotech/sols.js";

/** Classe F62 d'après qc, avec la même prudence que pour pl (trou du tableau → classe inférieure). */
function classeQc(famille, qc) {
  const lignes = Object.entries(CLASSES_F62).filter(([, c]) => c.famille === famille && c.qc);
  let retenue = lignes[0];
  for (const l of lignes) if (qc >= l[1].qc[0]) retenue = l;
  return retenue;
}

const GW = 9.81;

export default [
  {
    id: "ch2-cptu", titre: "Une mesure au piézocône", difficulte: 2,
    generer(a) {
      const argile = a.reel() < 0.5;
      const z = a.entre(4, 14, 0.5), zw = a.entre(0.5, 3, 0.5), g = a.entre(17, 19.5, 0.5), aa = a.entre(0.7, 0.85, 0.05);
      const qc = argile ? a.entre(0.6, 1.8, 0.05) : a.entre(6, 20, 0.5);
      const fs = argile ? a.entre(15, 45, 1) : a.entre(30, 120, 5);
      const sv = g * z, u0 = GW * Math.max(0, z - zw);
      const u2 = argile ? Math.round(u0 + a.entre(0.4, 0.7, 0.05) * (qc * 1000 - sv)) : Math.round(u0 + a.entre(-5, 10, 1));
      const r = E.cptu({ qc, fs, u2, a: aa, sigmaV0: sv, u0, sigmaV0eff: sv - u0 });
      const noms = E.ZONES_IC.map((x) => `zone ${x.zone} : ${x.nom}`);
      const bonne = `zone ${r.zone} : ${r.nomZone}`;
      return {
        enonce: `Au piézocône, à z = ${frd(z, 1)} m (γ = ${frd(g, 1)} kN/m³, nappe à ${frd(zw, 1)} m, γw = 9,81 kN/m³), on lit qc = ${frd(qc, 2)} MPa, fs = ${fr(fs, 3)} kPa et u2 = ${fr(u2, 3)} kPa. Le rapport de surfaces de la pointe vaut a = ${frd(aa, 2)}.`,
        donnees: [donnee("z", `${frd(z, 1)} m`), donnee("qc", `${frd(qc, 2)} MPa`), donnee("fs", `${fr(fs, 3)} kPa`), donnee("u2", `${fr(u2, 3)} kPa`), donnee("a", frd(aa, 2))],
        questions: [
          nombre("Résistance de pointe corrigée qt ?", r.qt, "kPa", `qt = qc + (1 − a) u2 = ${fr(qc * 1000, 4)} + ${frd(1 - aa, 2)} × ${fr(u2, 3)} = ${fr(r.qt, 5)} kPa.`, { rel: 0.01 }),
          nombre("Résistance normalisée Qt ?", r.Qt, "", `σv0 = ${fr(sv, 4)} kPa, u0 = ${fr(u0, 3)} kPa ; Qt = (qt − σv0)/σ'v0 = ${fr(r.qt - sv, 4)}/${fr(sv - u0, 4)} = ${fr(r.Qt, 3)}.`, { rel: 0.03 }),
          nombre("Rapport de frottement normalisé Fr (en %) ?", r.Fr, "%", `Fr = fs/(qt − σv0) = ${fr(fs, 3)}/${fr(r.qt - sv, 4)} = ${frd(r.Fr, 2)} %.`, { rel: 0.03 }),
          nombre("Indice de comportement Ic ?", r.Ic, "", `Ic = √[(3,47 − log Qt)² + (log Fr + 1,22)²] = ${frd(r.Ic, 2)}.`, { abs: 0.05 }),
          choixMelange(a, "Zone de comportement de Robertson ?", [bonne, ...a.tirage(noms.filter((n) => n !== bonne), 3)],
            `Ic = ${frd(r.Ic, 2)} : ${bonne}. C'est un classement de comportement, non une granulométrie.`),
        ],
      };
    },
  },
  {
    id: "ch2-spt", titre: "SPT : nombre de coups corrigé", difficulte: 1,
    generer(a) {
      const N = a.entier(8, 40), sv = a.entre(30, 180, 5);
      const mouton = a.choix([["annulaire lâché à la corde", 0.75], ["de sécurité", 0.9], ["automatique", 1.2]]);
      const L = a.choix([5, 8, 12, 20]);
      const CR = E.SPT.tiges(L);
      const r = E.sptCorrige({ N, sigmaV0eff: sv, CE: mouton[1], CB: 1, CR, CS: 1 });
      const p = E.phiSPT({ N60: r.N60, N160: r.N160, sigmaV0eff: sv });
      return {
        enonce: `Un SPT dans un sable donne N = ${N} coups sous σ'v0 = ${fr(sv, 3)} kPa, avec un mouton ${mouton[0]} (CE = ${frd(mouton[1], 2)}), ${L} m de tiges (CR = ${frd(CR, 2)}), un forage de 100 mm et un carottier standard (CB = CS = 1).`,
        donnees: [donnee("N", String(N)), donnee("σ'v0", `${fr(sv, 3)} kPa`), donnee("CE", frd(mouton[1], 2)), donnee("CR", frd(CR, 2))],
        questions: [
          nombre("N60 ?", r.N60, "", `N60 = N · CE · CB · CR · CS = ${N} × ${frd(mouton[1], 2)} × 1 × ${frd(CR, 2)} × 1 = ${frd(r.N60, 2)}.`, { rel: 0.01 }),
          nombre("Facteur de contrainte CN ?", r.CN, "", `CN = √(100/σ'v0) = √(100/${fr(sv, 3)}) = ${frd(r.CN, 3)}, borné entre 0,5 et 2.`, { rel: 0.01 }),
          nombre("(N1)60 ?", r.N160, "", `(N1)60 = CN · N60 = ${frd(r.CN, 3)} × ${frd(r.N60, 2)} = ${frd(r.N160, 2)}.`, { rel: 0.015 }),
          nombre("φ' selon Hatanaka et Uchida (φ' = √(20 (N1)60) + 20) ?", p.hatanakaUchida, "°", `φ' = √(20 × ${frd(r.N160, 2)}) + 20 = ${frd(p.hatanakaUchida, 1)}° — la corrélation de Wolff donnerait ${frd(p.wolff, 1)}° : un angle tiré du SPT reste un ordre de grandeur.`, { abs: 0.5 }),
        ],
      };
    },
  },
  {
    id: "ch2-dp", titre: "Pénétromètre dynamique : formule des Hollandais", difficulte: 1,
    generer(a) {
      const M = a.choix([30, 64, 90]), H = a.choix([0.4, 0.5, 0.75]), A = a.choix([20, 30]);
      const z = a.entre(2, 12, 1), Mp = +(a.entre(4, 7, 0.5) * z + a.entre(12, 20, 1)).toFixed(1), N = a.entier(4, 30);
      const r = E.qdHollandais({ M, Mp, H, Acm2: A, N });
      return {
        enonce: `Pénétromètre dynamique : mouton de ${M} kg tombant de ${frd(H, 2)} m, pointe de ${A} cm². À ${frd(z, 0)} m, la masse frappée (tiges, enclume, pointe) vaut M' = ${frd(Mp, 1)} kg, et il faut ${N} coups pour enfoncer la pointe de 10 cm.`,
        donnees: [donnee("M", `${M} kg`), donnee("H", `${frd(H, 2)} m`), donnee("A", `${A} cm²`), donnee("M'", `${frd(Mp, 1)} kg`), donnee("N", `${N} coups / 10 cm`)],
        questions: [
          nombre("Enfoncement moyen par coup e (mm) ?", 1000 * r.e, "mm", `e = 100 mm / ${N} = ${frd(1000 * r.e, 2)} mm.`, { rel: 0.01 }),
          nombre("Résistance dynamique qd ?", r.qd, "MPa", `qd = M² g H / [(M + M') A e] = ${M}² × 9,81 × ${frd(H, 2)} / [(${M} + ${frd(Mp, 1)}) × ${frd(A / 1e4, 4)} × ${frd(r.e, 5)}] = ${frd(r.qd, 2)} MPa.`, { rel: 0.02 }),
        ],
      };
    },
  },
  {
    id: "ch2-dmt", titre: "Dilatomètre plat : indices et module", difficulte: 2,
    generer(a) {
      const sable = a.reel() < 0.5;
      const dA = a.entre(10, 25, 1), dB = a.entre(30, 60, 5), u0 = a.entre(20, 120, 5), sv = a.entre(40, 160, 5);
      const A = sable ? a.entre(200, 450, 10) : a.entre(150, 280, 10);
      const B = sable ? A + a.entre(500, 1100, 10) : A + a.entre(60, 160, 10);
      const r = E.dmt({ A, B, dA, dB, u0, sigmaV0eff: sv });
      if (!r.applicable) return this.generer(a);
      return {
        enonce: `Dilatomètre plat : lectures A = ${fr(A, 3)} kPa et B = ${fr(B, 4)} kPa, corrections de membrane ΔA = ${fr(dA, 2)} kPa et ΔB = ${fr(dB, 2)} kPa (zM = 0). Au niveau de l'essai, u0 = ${fr(u0, 3)} kPa et σ'v0 = ${fr(sv, 3)} kPa.`,
        donnees: [donnee("A", `${fr(A, 3)} kPa`), donnee("B", `${fr(B, 4)} kPa`), donnee("ΔA · ΔB", `${fr(dA, 2)} · ${fr(dB, 2)} kPa`), donnee("u0", `${fr(u0, 3)} kPa`), donnee("σ'v0", `${fr(sv, 3)} kPa`)],
        questions: [
          nombre("p0 ?", r.p0, "kPa", `p0 = 1,05 (A + ΔA) − 0,05 (B − ΔB) = ${fr(r.p0, 4)} kPa.`, { rel: 0.01 }),
          nombre("Indice de matériau ID ?", r.ID, "", `p1 = B − ΔB = ${fr(r.p1, 4)} kPa ; ID = (p1 − p0)/(p0 − u0) = ${frd(r.ID, 2)} → ${r.sol}.`, { rel: 0.02 }),
          nombre("Indice de contrainte horizontale KD ?", r.KD, "", `KD = (p0 − u0)/σ'v0 = ${frd(r.KD, 2)}.`, { rel: 0.02 }),
          nombre("Module œdométrique M = RM · ED ?", r.M, "MPa", `ED = 34,7 (p1 − p0) = ${frd(r.ED, 2)} MPa ; RM = ${frd(r.RM, 2)} ; M = ${frd(r.M, 1)} MPa.`, { rel: 0.04 }),
        ],
      };
    },
  },
  {
    id: "ch2-vst", titre: "Scissomètre : cohésion non drainée", difficulte: 1,
    generer(a) {
      const D = a.choix([50, 65, 70]), H = 2 * D, M = a.entre(8, 70, 1), Mr = +(M * a.entre(0.2, 0.6, 0.05)).toFixed(1), Ip = a.entre(15, 70, 5);
      const r = E.scissometre({ M, Mres: Mr, Dmm: D, Hmm: H, Ip });
      return {
        enonce: `Un moulinet de ${D} × ${H} mm, tourné dans une argile d'indice de plasticité ${Ip} %, mesure un couple maximal de ${fr(M, 3)} N·m puis un couple résiduel de ${frd(Mr, 1)} N·m.`,
        donnees: [donnee("D × H", `${D} × ${H} mm`), donnee("M", `${fr(M, 3)} N·m`), donnee("M résiduel", `${frd(Mr, 1)} N·m`), donnee("Ip", `${Ip} %`)],
        questions: [
          nombre("Constante du moulinet K = πD²(H/2 + D/6) (cm³) ?", r.K * 1e6, "cm³", `K = π × ${frd(D / 1000, 3)}² × (${frd(H / 2000, 3)} + ${frd(D / 6000, 4)}) = ${fr(r.K * 1e6, 4)} cm³.`, { rel: 0.01 }),
          nombre("Cohésion non drainée cu ?", r.cu, "kPa", `cu = M/K = ${fr(M, 3)} / ${fr(r.K, 4)} m³ = ${fr(r.cu, 3)} kPa.`, { rel: 0.02 }),
          nombre("Sensibilité St ?", r.St, "", `St = cu/cr = M/Mrésiduel = ${frd(r.St, 2)}.`, { rel: 0.02 }),
          nombre("cu corrigée par μ de Bjerrum (μ = 1,7 − 0,54 log Ip) ?", r.cuCorrige, "kPa", `μ = ${frd(r.mu, 3)} ; cu × μ = ${fr(r.cuCorrige, 3)} kPa.`, { rel: 0.03 }),
        ],
      };
    },
  },
  {
    id: "ch2-plaque", titre: "Essai de plaque : EV1, EV2 et compactage", difficulte: 1,
    generer(a) {
      const z1 = a.entre(0.8, 5, 0.05), k = a.entre(1.1, 2.6, 0.05), z2 = +((0.8 * z1) / k).toFixed(2);
      const r = E.plaqueEV({ z1, z2 });
      const classes = ["PF1", "PF2", "PF3", "PF4", "inutilisable"];
      return {
        enonce: `Essai de plaque Ø 600 mm : enfoncement de ${frd(z1, 2)} mm sous 0,25 MPa au premier chargement, puis de ${frd(z2, 2)} mm sous 0,20 MPa au second.`,
        donnees: [donnee("z1 (0,25 MPa)", `${frd(z1, 2)} mm`), donnee("z2 (0,20 MPa)", `${frd(z2, 2)} mm`)],
        questions: [
          nombre("EV1 ?", r.EV1, "MPa", `EV1 = 1,5 p R / z1 = 112,5/${frd(z1, 2)} = ${frd(r.EV1, 1)} MPa.`, { rel: 0.01 }),
          nombre("EV2 ?", r.EV2, "MPa", `EV2 = 90/${frd(z2, 2)} = ${frd(r.EV2, 1)} MPa.`, { rel: 0.01 }),
          nombre("k = EV2/EV1 ?", r.k, "", `k = ${frd(r.k, 2)} : compactage ${r.compactage}.`, { rel: 0.015 }),
          choixMelange(a, "Classe de la plate-forme ?", [r.classe, ...classes.filter((c) => c !== r.classe).slice(0, 3)],
            `EV2 = ${frd(r.EV2, 1)} MPa : ${r.classe} (PF1 de 20 à 50, PF2 de 50 à 120, PF3 de 120 à 200, PF4 au-delà).`),
        ],
      };
    },
  },
  {
    id: "ch2-lefranc", titre: "Essai Lefranc à charge constante", difficulte: 2,
    generer(a) {
      const L = a.choix([0.5, 1, 1.5]), D = a.choix([0.08, 0.1, 0.12]), h = a.entre(0.5, 2, 0.1), Qlmin = a.entre(0.05, 4, 0.05);
      const r = E.lefrancConstant({ Q: Qlmin / 60000, h, L, D });
      return {
        enonce: `Essai Lefranc dans une cavité de ${frd(L, 1)} m de long et ${fr(D * 100, 2)} cm de diamètre : on injecte ${frd(Qlmin, 2)} L/min pour maintenir une surcharge constante de ${frd(h, 1)} m au-dessus du niveau de la nappe.`,
        donnees: [donnee("L", `${frd(L, 1)} m`), donnee("D", `${fr(D * 100, 2)} cm`), donnee("Q", `${frd(Qlmin, 2)} L/min`), donnee("h", `${frd(h, 1)} m`)],
        questions: [
          nombre("Facteur de forme F = 2πL/ln[L/D + √(1 + (L/D)²)] ?", r.F, "m", `F = ${frd(r.F, 3)} m (m = F/D = ${frd(r.m, 2)}).`, { rel: 0.01 }),
          nombre("Perméabilité k (m/s) ?", r.k, "m/s", `Q = ${fr(Qlmin / 60000, 3)} m³/s ; k = Q/(F h) = ${fr(r.k, 3)} m/s.`, { rel: 0.02 }),
        ],
      };
    },
  },
  {
    id: "ch2-jacob", titre: "Essai de pompage : méthode de Jacob", difficulte: 2,
    generer(a) {
      const Qh = a.entre(10, 80, 2), ds = a.entre(0.08, 0.6, 0.01), t0 = a.entre(20, 300, 10), r = a.choix([10, 15, 20, 30]), e = a.entre(6, 20, 1);
      const j = E.jacob({ Q: Qh / 3600, ds, t0, r });
      return {
        enonce: `On pompe ${fr(Qh, 3)} m³/h dans une nappe captive de ${fr(e, 2)} m d'épaisseur. Dans un piézomètre à ${r} m, le rabattement croît de ${frd(ds, 2)} m par cycle logarithmique du temps, et la droite de Jacob coupe s = 0 à t0 = ${fr(t0, 3)} s.`,
        donnees: [donnee("Q", `${fr(Qh, 3)} m³/h`), donnee("Δs", `${frd(ds, 2)} m/cycle`), donnee("t0", `${fr(t0, 3)} s`), donnee("r", `${r} m`), donnee("épaisseur", `${fr(e, 2)} m`)],
        questions: [
          nombre("Transmissivité T (m²/s) ?", j.T, "m²/s", `T = 0,183 Q/Δs = 0,183 × ${fr(Qh / 3600, 3)} / ${frd(ds, 2)} = ${fr(j.T, 3)} m²/s.`, { rel: 0.02 }),
          nombre("Perméabilité k = T/e (m/s) ?", j.T / e, "m/s", `k = ${fr(j.T, 3)} / ${fr(e, 2)} = ${fr(j.T / e, 3)} m/s.`, { rel: 0.02 }),
          nombre("Coefficient d'emmagasinement S ?", j.S, "", `S = 2,25 T t0 / r² = 2,25 × ${fr(j.T, 3)} × ${fr(t0, 3)} / ${r}² = ${fr(j.S, 3)}.`, { rel: 0.03 }),
        ],
      };
    },
  },
  {
    id: "ch2-rqd", titre: "RQD d'une passe de carottage", difficulte: 1,
    generer(a) {
      const morceaux = Array.from({ length: a.entier(7, 12) }, () => a.entier(3, 35));
      const somme = morceaux.reduce((s, x) => s + x, 0);
      const L = Math.max(150, Math.ceil((somme + a.entier(0, 20)) / 10) * 10);
      const r = E.rqd(morceaux, L);
      const qualites = ["très mauvaise", "mauvaise", "moyenne", "bonne", "excellente"];
      return {
        enonce: `Une passe de carottage de ${L} cm a ramené des morceaux de ${morceaux.join(", ")} cm.`,
        donnees: [donnee("longueur de passe", `${L} cm`), donnee("morceaux (cm)", morceaux.join(" · "))],
        questions: [
          nombre("RQD (%) ?", r.RQD, "%", `Morceaux d'au moins 10 cm : ${morceaux.filter((x) => x >= 10).join(" + ")} = ${morceaux.filter((x) => x >= 10).reduce((s, x) => s + x, 0)} cm ; RQD = ${frd(r.RQD, 1)} %.`, { abs: 1 }),
          nombre("Taux de récupération (%) ?", r.recuperation, "%", `${somme}/${L} = ${frd(r.recuperation, 1)} %.`, { abs: 1 }),
          choixMelange(a, "Qualité du rocher selon le RQD ?", [r.qualite, ...qualites.filter((q) => q !== r.qualite).slice(0, 3)],
            `RQD = ${frd(r.RQD, 0)} % : qualité ${r.qualite} (seuils 25, 50, 75, 90 %).`),
        ],
      };
    },
  },
  {
    id: "ch2-penetro", titre: "Pénétromètre et pressiomètre : deux regards sur un sable", difficulte: 1,
    generer(a) {
      const [cleQ, cQ] = a.choix(Object.entries(CLASSES_F62).filter(([, c]) => c.famille === "sable"));
      const qc = a.entre(Math.max(cQ.qc[0], 1) + 0.5, Number.isFinite(cQ.qc[1]) ? cQ.qc[1] - 0.5 : cQ.qc[0] + 10, 0.5);
      const pl = a.entre(Math.max(cQ.pl[0], 0.2) + 0.05, Number.isFinite(cQ.pl[1]) ? cQ.pl[1] - 0.05 : cQ.pl[0] + 1.5, 0.05);
      const [, parQc] = classeQc("sable", qc);
      const parPl = proposerClasseF62("sable", pl);
      const nomClasse = (x) => `${x.nom} (${x.lettre})`;
      const classes = Object.values(CLASSES_F62).filter((x) => x.famille === "sable");
      return {
        enonce: `Dans un sable, le pénétromètre statique donne qc = ${frd(qc, 1)} MPa et, à la même profondeur, le pressiomètre pl = ${frd(pl, 2)} MPa.`,
        donnees: [donnee("qc", `${frd(qc, 1)} MPa`), donnee("pl", `${frd(pl, 2)} MPa`)],
        questions: [
          choixMelange(a, "Classe d'après qc ?", [nomClasse(parQc), ...classes.filter((x) => x.lettre !== parQc.lettre).map(nomClasse)],
            `Sables : A pour qc < 5 MPa, B de 8 à 15 MPa, C au-delà de 20 MPa. qc = ${frd(qc, 1)} MPa → classe ${parQc.lettre}.`),
          choixMelange(a, "Classe d'après pl ?", [nomClasse(parPl), ...classes.filter((x) => x.lettre !== parPl.lettre).map(nomClasse)],
            `Sables : A pour pl < 0,5 MPa, B de 1 à 2 MPa, C au-delà de 2,5 MPa. pl = ${frd(pl, 2)} MPa → classe ${parPl.lettre}${parPl.entre ? " (entre deux classes : la plus faible)" : ""}.`),
          choixMelange(a, "Lequel des deux essais donne aussi un module de déformation utilisable pour les tassements de Ménard ?",
            ["le pressiomètre (EM)", "le pénétromètre (qc)", "aucun des deux"],
            "La méthode de Ménard utilise EM. Au pénétromètre, le tassement se calcule par Schmertmann, avec un module empirique 2,5 à 3,5 qc qui n'est pas un module d'Young."),
        ],
      };
    },
  },
];
