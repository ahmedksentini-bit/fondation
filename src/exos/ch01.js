// Exercices du chapitre 1 : le sol de fondation et sa reconnaissance.
import { fr, frd, nombre, choixMelange, donnee } from "./alea.js";
import { proposerClasseF62, sigmaV0, profondeurReconnaissance, CLASSES_F62 } from "../geotech/sols.js";

export default [
  {
    id: "ch1-classe", titre: "Classer un sol au Fascicule 62", difficulte: 1,
    generer(a) {
      const famille = a.choix(["argile", "sable"]);
      const [, c] = a.choix(Object.entries(CLASSES_F62).filter(([, x]) => x.famille === famille));
      const bas = Math.max(c.pl[0], famille === "argile" ? 0.3 : 0.2);
      const haut = Number.isFinite(c.pl[1]) ? c.pl[1] : c.pl[0] + 1.5;
      const pl = a.entre(bas + 0.05, haut - 0.05, 0.05);
      const prop = proposerClasseF62(famille, pl);
      const classes = Object.values(CLASSES_F62).filter((x) => x.famille === famille);
      const nomClasse = (x) => `${x.nom} (${x.lettre})`;
      const fourchette = (x) => (Number.isFinite(x.qc[1]) ? (x.qc[0] ? `de ${fr(x.qc[0])} à ${fr(x.qc[1])} MPa` : `moins de ${fr(x.qc[1])} MPa`) : `plus de ${fr(x.qc[0])} MPa`);
      return {
        enonce: `Un ${famille === "argile" ? "sol argileux" : "sol sableux"} donne au pressiomètre pl = ${frd(pl, 2)} MPa.`,
        donnees: [donnee("Nature", famille === "argile" ? "argile" : "sable"), donnee("pl", `${frd(pl, 2)} MPa`)],
        questions: [
          choixMelange(a, "Classe du sol au Fascicule 62 (annexe E.1) ?",
            [nomClasse(prop), ...classes.filter((x) => x.lettre !== prop.lettre).map(nomClasse)],
            `Le tableau donne pour ${famille === "argile" ? "les argiles" : "les sables"} : ${classes.map((x) => `${x.lettre} pour pl ${Number.isFinite(x.pl[1]) ? (x.pl[0] ? `de ${frd(x.pl[0], 1)} à ${frd(x.pl[1], 1)}` : `< ${frd(x.pl[1], 1)}`) : `> ${frd(x.pl[0], 1)}`} MPa`).join(", ")}. Avec ${frd(pl, 2)} MPa, on retient la classe ${prop.lettre}${prop.entre ? " — pl tombe entre deux classes : on garde la plus faible, par prudence" : ""}.`),
          choixMelange(a, "Quelle résistance de pointe qc attendrait-on au pénétromètre statique dans cette classe ?",
            [fourchette(prop), ...classes.filter((x) => x.lettre !== prop.lettre).map(fourchette)],
            `Le même tableau donne, pour la classe ${prop.lettre}, qc ${fourchette(prop)}. Les deux essais classent le même sol ; les fourchettes ne sont pas jointives, comme pour pl.`),
          choixMelange(a, "À l'Eurocode 7, ce sol se range…",
            [`dans la catégorie des ${famille === "argile" ? "argiles et limons" : "sables et graves"}, sans lettre`, `dans la classe ${prop.lettre} de la NF P94-261`, "dans la catégorie des sols intermédiaires, faute de lettre", "dans une catégorie fixée par la valeur de pl"],
            "Les catégories conventionnelles de la NF P94-261 et de la NF P94-262 ne décrivent que la nature du sol : la résistance entre directement par pl* ou qc dans les formules."),
        ],
      };
    },
  },
  {
    id: "ch1-homogene", titre: "Une formation homogène ?", difficulte: 2,
    generer(a) {
      const base = a.entre(0.6, 1.6, 0.1);
      const facteur = a.entre(1.4, 2.8, 0.1);
      const pls = [0, 1, 2, 3].map(() => a.entre(base, base * facteur, 0.05));
      pls[a.entier(0, 3)] = +(base * facteur).toFixed(2);
      pls[a.entier(0, 3)] = base;
      const max = Math.max(...pls), min = Math.min(...pls);
      const geo = Math.exp(pls.reduce((s, p) => s + Math.log(p), 0) / pls.length);
      const homogene = max <= 2 * min + 1e-9;
      return {
        enonce: `Quatre essais pressiométriques, espacés d'un mètre dans une même argile, donnent pl* = ${pls.map((p) => frd(p, 2)).join(" ; ")} MPa.`,
        donnees: pls.map((p, i) => donnee(`Essai ${i + 1}`, `${frd(p, 2)} MPa`)),
        questions: [
          nombre("Rapport pl*,max / pl*,min ?", max / min, "", `${frd(max, 2)} / ${frd(min, 2)} = ${frd(max / min, 2)}.`, { rel: 0.01 }),
          choixMelange(a, "Selon le critère indicatif du guide Cerema, la formation est-elle homogène ?",
            homogene ? ["oui : le maximum ne dépasse pas deux fois le minimum", "non : le maximum dépasse deux fois le minimum"] : ["non : le maximum dépasse deux fois le minimum", "oui : le maximum ne dépasse pas deux fois le minimum"],
            "Le guide Cerema de la NF P94-261 (note 27) considère, à titre indicatif, une formation comme homogène si elle est de nature unique et si ses pressions limites maximales n'excèdent pas deux fois les minimales."),
          nombre("Moyenne géométrique des quatre valeurs (épaisseurs égales) ?", geo, "MPa",
            `(${pls.map((p) => frd(p, 2)).join(" × ")})^(1/4) = ${frd(geo, 3)} MPa — c'est la forme que prend p_le* sous une semelle quand les épaisseurs sont égales (chapitre 6).`, { rel: 0.01 }),
          choixMelange(a, "Ce critère s'applique-t-il aux essais pénétrométriques ?",
            ["non : les diagrammes de qc sont trop irréguliers", "oui, sans restriction", "oui, à condition de doubler le seuil"],
            "Le guide l'exclut explicitement pour le pénétromètre, dont les diagrammes sont trop irréguliers pour ce type de critère."),
        ],
      };
    },
  },
  {
    id: "ch1-categories", titre: "Du Fascicule 62 à l'Eurocode 7 : classer les sols", difficulte: 1,
    generer(a) {
      const pool = [
        ["Les lettres A, B, C des classes du Fascicule 62 traduisent…", ["la résistance mesurée du sol (pl ou qc)", "la nature minéralogique du sol", "la profondeur de la couche", "la position de la nappe"],
          "Au Fascicule 62, chaque famille (argiles, sables, craies, marnes, roches) est découpée en classes A, B, C selon les fourchettes de pl et de qc. La NF P94-261/262 ne garde que la nature : la résistance entre directement par pl* ou qc dans les formules."],
        ["Un sable limoneux, dont la nature hésite entre sable et limon, relève à la NF P94-262 de…", ["la catégorie des sols intermédiaires", "la catégorie des sables et graves", "la catégorie des argiles et limons", "la catégorie des marnes"],
          "La norme a créé une catégorie « sols intermédiaires » entre les argiles-limons et les sables-graves. Le choix entre les catégories reste un jugement sur la nature dominante du sol."],
        ["Dans les tableaux pressiométriques des pieux (NF P94-262), un sol intermédiaire à dominante argileuse est traité comme…", ["une argile", "un sable", "une craie", "une marne"],
          "Les tableaux pressiométriques n'ont pas de colonne « intermédiaire » : ces sols y rejoignent la colonne de leur nature dominante. Les tableaux pénétrométriques, eux, en ont une."],
        ["Quelle catégorie de terrain la NF P94-262 ne traite-t-elle plus ?", ["les roches dures (mécanique des roches)", "les craies", "les marnes et calcaires marneux", "les sols intermédiaires"],
          "Le guide Cerema le note : les roches dures relèvent des méthodes de la mécanique des roches et sortent du domaine de la norme."],
        ["Sous une semelle isolée de 2,5 m de côté, l'annexe B.3 de la NF EN 1997-2 recommande de reconnaître le terrain sous l'assise sur au moins…", ["7,5 m : le plus grand de 6 m et 3 bF", "3,75 m : 1,5 bF", "2,5 m : une largeur", "6 m, quelle que soit la semelle"],
          "Pour une semelle, za ≥ 6 m et za ≥ 3 bF, bF étant son petit côté : ici max(6 ; 7,5) = 7,5 m sous l'assise."],
        ["Quel essai fournit à la fois un module (EM) et une résistance (pl) ?", ["l'essai pressiométrique Ménard", "l'essai au pénétromètre statique", "l'essai de cisaillement à la boîte", "l'essai œdométrique"],
          "Le pressiomètre donne EM (tassements, modules de réaction) et pl (portance) : c'est pourquoi la pratique française s'est construite autour de lui."],
      ];
      return {
        enonce: "Questions de cours sur la reconnaissance et le classement des sols.",
        questions: a.tirage(pool, 4).map(([t, o, e]) => choixMelange(a, t, o, e)),
      };
    },
  },
  {
    id: "ch1-contraintes", titre: "Contraintes effectives et nappe", difficulte: 1,
    generer(a) {
      const h1 = a.entre(2, 5, 0.5), g1 = a.entre(17, 19, 0.5), gs1 = +(g1 + a.entre(1, 2, 0.5)).toFixed(1);
      const g2 = a.entre(18, 20, 0.5), gs2 = +(g2 + a.entre(1, 2, 0.5)).toFixed(1);
      const zw = a.entre(1, h1, 0.5), z = +(h1 + a.entre(2, 8, 0.5)).toFixed(1);
      const couches = [{ z0: 0, z1: h1, gamma: g1, gammaSat: gs1 }, { z0: h1, z1: 1e6, gamma: g2, gammaSat: gs2 }];
      const r = sigmaV0({ couches, z, zNappe: zw }), haute = sigmaV0({ couches, z, zNappe: 0 });
      return {
        enonce: `Une couche de ${fr(h1)} m (γ = ${fr(g1)} kN/m³ hors d'eau, γsat = ${fr(gs1)} kN/m³ sous la nappe) repose sur une seconde couche (γ = ${fr(g2)} kN/m³, γsat = ${fr(gs2)} kN/m³). La nappe est à ${fr(zw)} m de profondeur ; γw = 10 kN/m³. On s'intéresse au point situé à ${fr(z)} m.`,
        donnees: [donnee("Couche 1", `${fr(h1)} m · γ ${fr(g1)} · γsat ${fr(gs1)} kN/m³`), donnee("Couche 2", `γ ${fr(g2)} · γsat ${fr(gs2)} kN/m³`), donnee("Nappe", `${fr(zw)} m`), donnee("Profondeur du point", `${fr(z)} m`)],
        questions: [
          nombre("Contrainte verticale totale σv0 ?", r.sigmaV, "kPa",
            `σv0 = ${fr(g1)} × ${fr(zw)} + ${fr(gs1)} × ${fr(h1 - zw)} + ${fr(gs2)} × ${fr(z - h1)} = ${fr(r.sigmaV, 4)} kPa.`, { rel: 0.01 }),
          nombre("Pression de l'eau u0 ?", r.u, "kPa", `u0 = γw (z − zw) = 10 × ${fr(z - zw)} = ${fr(r.u, 3)} kPa.`, { rel: 0.01 }),
          nombre("Contrainte verticale effective σ'v0 ?", r.sigmaVeff, "kPa", `σ'v0 = σv0 − u0 = ${fr(r.sigmaV, 4)} − ${fr(r.u, 3)} = ${fr(r.sigmaVeff, 4)} kPa.`, { rel: 0.01 }),
          nombre("Et si la nappe remontait jusqu'au terrain naturel, σ'v0 deviendrait ?", haute.sigmaVeff, "kPa",
            `Tout le terrain est alors saturé : σv0 = ${fr(gs1)} × ${fr(h1)} + ${fr(gs2)} × ${fr(z - h1)} = ${fr(haute.sigmaV, 4)} kPa, u0 = 10 × ${fr(z)} = ${fr(haute.u, 3)} kPa, σ'v0 = ${fr(haute.sigmaVeff, 4)} kPa. La contrainte effective baisse de ${fr(r.sigmaVeff - haute.sigmaVeff, 3)} kPa : une nappe haute affaiblit le sol.`, { rel: 0.01 }),
        ],
      };
    },
  },
  {
    id: "ch1-reconnaissance", titre: "Jusqu'où reconnaître ?", difficulte: 1,
    generer(a) {
      const type = a.choix(["semelle", "radier", "pieux"]);
      const b = type === "semelle" ? a.entre(1.2, 3.5, 0.1) : type === "radier" ? a.entre(10, 24, 1) : a.entre(1.5, 9, 0.5);
      const DF = type === "pieux" ? a.entre(0.5, 2, 0.1) : 0;
      const D = type === "pieux" ? a.entre(8, 25, 1) : a.entre(0.8, 2.5, 0.1);
      const r = profondeurReconnaissance({ type, b, DF });
      const quoi = type === "semelle" ? `une semelle isolée de ${fr(b)} m de petit côté, fondée à ${fr(D)} m`
        : type === "radier" ? `un radier de ${fr(b)} m de petit côté, fondé à ${fr(D)} m`
          : `un groupe de pieux inscrit dans un rectangle de ${fr(b)} m de petit côté, pieux de ${fr(DF)} m de diamètre à la base, pointes à ${fr(D)} m`;
      const regle = type === "semelle" ? "za ≥ 6 m et za ≥ 3 bF" : type === "radier" ? "za ≥ 1,5 bB" : "za ≥ bg, za ≥ 5 m et za ≥ 3 DF, sous les pointes";
      return {
        enonce: `On prépare la reconnaissance de ${quoi}, d'après les recommandations de l'annexe B.3 de la NF EN 1997-2.`,
        donnees: [donnee("Fondation", type), donnee("Petit côté", `${fr(b)} m`), donnee(type === "pieux" ? "Pointes" : "Assise", `${fr(D)} m`), ...(type === "pieux" ? [donnee("DF", `${fr(DF)} m`)] : [])],
        questions: [
          nombre(`Profondeur za à reconnaître ${type === "pieux" ? "sous les pointes" : "sous l'assise"} ?`, r.za, "m",
            `${regle} : za = max(${r.criteres.map(([n, v]) => `${n} = ${fr(v)} m`).join(" ; ")}) = ${fr(r.za)} m.`, { rel: 0.01 }),
          nombre("Profondeur minimale des sondages sous le terrain ?", D + r.za, "m", `${fr(D)} + ${fr(r.za)} = ${fr(D + r.za)} m.`, { rel: 0.01 }),
          choixMelange(a, "Quel espacement la même annexe suggère-t-elle entre les points de reconnaissance sous un bâtiment ?",
            ["une maille de 15 à 40 m", "un point tous les 5 m", "une maille de 100 à 200 m", "un seul point au centre"],
            "L'annexe B.3 propose 15 à 40 m sous les bâtiments et ouvrages industriels, 60 m au plus sous les grands ouvrages de surface, 20 à 200 m le long des ouvrages linéaires."),
        ],
      };
    },
  },
];
