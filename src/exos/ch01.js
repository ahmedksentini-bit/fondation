// Exercices du chapitre 1 : le sol de fondation et sa reconnaissance.
import { fr, frd, nombre, choixMelange, donnee } from "./alea.js";
import { pressionNette, proposerClasseF62, alphaMenard, ALPHA_MENARD, CLASSES_F62 } from "../geotech/sols.js";

export const FRACTIONS = [[1, "1"], [2 / 3, "2/3"], [1 / 2, "1/2"], [1 / 3, "1/3"], [1 / 4, "1/4"]];
export const fraction = (x) => FRACTIONS.find(([v]) => Math.abs(v - x) < 1e-6)?.[1] ?? fr(x);

/** Classe F62 d'après qc, avec la même prudence que pour pl (trou du tableau → classe inférieure). */
function classeQc(famille, qc) {
  const lignes = Object.entries(CLASSES_F62).filter(([, c]) => c.famille === famille && c.qc);
  let retenue = lignes[0];
  for (const l of lignes) if (qc >= l[1].qc[0]) retenue = l;
  return retenue;
}

export default [
  {
    id: "ch1-pnette", titre: "Pression limite nette d'un essai sous la nappe", difficulte: 1,
    generer(a) {
      const z = a.entre(4, 12, 0.5), zw = a.entre(1, 3, 0.5), g = a.entre(18, 20, 0.5), gs = a.entre(20, 21.5, 0.5);
      const pl = a.entre(0.8, 2.4, 0.05);
      const sv = g * zw + gs * (z - zw), u = 10 * (z - zw), s1 = sv - u;
      const { p0, plNette } = pressionNette({ pl: pl * 1000, sigmaV0eff: s1, u, K0: 0.5 });
      return {
        enonce: `Un essai pressiométrique mené à ${fr(z)} m de profondeur donne une pression limite pl = ${frd(pl, 2)} MPa. La nappe est à ${fr(zw)} m de profondeur ; le sol pèse ${fr(g)} kN/m³ au-dessus et ${fr(gs)} kN/m³ (saturé) au-dessous. On prend K0 = 0,5 et γw = 10 kN/m³.`,
        donnees: [donnee("Profondeur de l'essai", `${fr(z)} m`), donnee("pl mesurée", `${frd(pl, 2)} MPa`), donnee("Nappe", `${fr(zw)} m`), donnee("γ / γsat", `${fr(g)} / ${fr(gs)} kN/m³`)],
        questions: [
          nombre("Contrainte verticale effective σ'v0 au niveau de l'essai ?", s1, "kPa",
            `σv0 = ${fr(g)} × ${fr(zw)} + ${fr(gs)} × ${fr(z - zw)} = ${fr(sv, 4)} kPa ; u = 10 × ${fr(z - zw)} = ${fr(u, 3)} kPa ; σ'v0 = σv0 − u = ${fr(s1, 4)} kPa.`, { rel: 0.01 }),
          nombre("Pression horizontale totale au repos p0 ?", p0, "kPa",
            `p0 = u + K0 σ'v0 = ${fr(u, 3)} + 0,5 × ${fr(s1, 4)} = ${fr(p0, 4)} kPa : l'eau compte entière, le squelette pour moitié.`),
          nombre("Pression limite nette pl* ?", plNette / 1000, "MPa",
            `pl* = pl − p0 = ${frd(pl, 2)} − ${frd(p0 / 1000, 3)} = ${frd(plNette / 1000, 3)} MPa. La correction représente ${fr((100 * p0) / (pl * 1000), 2)} % de pl : elle n'est pas négligeable en profondeur et sous la nappe.`, { rel: 0.01 }),
          choixMelange(a, "Quelle pression entre dans les formules de portance des deux référentiels ?",
            ["la pression limite nette pl*", "la pression limite mesurée pl", "la pression de fluage pf", "la pression p0 au repos"],
            "Les facteurs de portance kp multiplient la pression limite nette, qui mesure ce que le sol peut reprendre au-delà de son état initial. Les classes du Fascicule 62, elles, sont tabulées en pl."),
        ],
      };
    },
  },
  {
    id: "ch1-classe", titre: "Classer un sol au Fascicule 62", difficulte: 1,
    generer(a) {
      const famille = a.choix(["argile", "sable"]);
      const [, c] = a.choix(Object.entries(CLASSES_F62).filter(([, x]) => x.famille === famille));
      const bas = Math.max(c.pl[0], famille === "argile" ? 0.3 : 0.2);
      const haut = Number.isFinite(c.pl[1]) ? c.pl[1] : c.pl[0] + 1.5;
      const pl = a.entre(bas + 0.05, haut - 0.05, 0.05);
      const rapport = a.entre(famille === "argile" ? 8 : 6, famille === "argile" ? 18 : 14, 0.5);
      const EM = +(rapport * pl).toFixed(1);
      const prop = proposerClasseF62(famille, pl);
      const al = alphaMenard(famille, EM, pl);
      const classes = Object.values(CLASSES_F62).filter((x) => x.famille === famille);
      const nomClasse = (x) => `${x.nom} (${x.lettre})`;
      return {
        enonce: `Un ${famille === "argile" ? "sol argileux" : "sol sableux"} donne au pressiomètre pl = ${frd(pl, 2)} MPa et EM = ${fr(EM, 3)} MPa.`,
        donnees: [donnee("Nature", famille === "argile" ? "argile" : "sable"), donnee("pl", `${frd(pl, 2)} MPa`), donnee("EM", `${fr(EM, 3)} MPa`)],
        questions: [
          choixMelange(a, "Classe du sol au Fascicule 62 (annexe E.1) ?",
            [nomClasse(prop), ...classes.filter((x) => x.lettre !== prop.lettre).map(nomClasse)],
            `Le tableau donne pour ${famille === "argile" ? "les argiles" : "les sables"} : ${classes.map((x) => `${x.lettre} pour pl ${Number.isFinite(x.pl[1]) ? (x.pl[0] ? `de ${frd(x.pl[0], 1)} à ${frd(x.pl[1], 1)}` : `< ${frd(x.pl[1], 1)}`) : `> ${frd(x.pl[0], 1)}`} MPa`).join(", ")}. Avec ${frd(pl, 2)} MPa, on retient la classe ${prop.lettre}${prop.entre ? " — pl tombe entre deux classes : on garde la plus faible, par prudence" : ""}.`),
          nombre("Rapport EM/pl ?", EM / pl, "", `EM/pl = ${fr(EM, 3)} / ${frd(pl, 2)} = ${frd(EM / pl, 2)}.`, { rel: 0.01 }),
          choixMelange(a, "Coefficient rhéologique α ?", [fraction(al.alpha), ...FRACTIONS.map(([, t]) => t).filter((t) => t !== fraction(al.alpha))].slice(0, 4),
            `Pour ${famille === "argile" ? "une argile" : "un sable"}, EM/pl = ${frd(al.rapport, 2)} correspond à l'état « ${al.etat} » : α = ${fraction(al.alpha)}. Un grand rapport EM/pl signale un sol surconsolidé ou serré.`),
        ],
      };
    },
  },
  {
    id: "ch1-alpha", titre: "Coefficient rhéologique et état du sol", difficulte: 1,
    generer(a) {
      const nature = a.choix(["argile", "limon", "sable", "grave"]);
      const lignes = ALPHA_MENARD[nature];
      const l = a.choix(lignes);
      const r = a.entre(l.rapport[0] + 0.5, Number.isFinite(l.rapport[1]) ? l.rapport[1] - 0.5 : l.rapport[0] + 6, 0.5);
      const pl = a.entre(0.6, 2.5, 0.1);
      const EM = +(r * pl).toFixed(1);
      const al = alphaMenard(nature, EM, pl);
      const etats = [...new Set(lignes.map((x) => x.etat))];
      return {
        enonce: `Dans un ${nature}, l'essai pressiométrique donne EM = ${fr(EM, 3)} MPa et pl = ${frd(pl, 1)} MPa.`,
        donnees: [donnee("Nature", nature), donnee("EM", `${fr(EM, 3)} MPa`), donnee("pl", `${frd(pl, 1)} MPa`)],
        questions: [
          nombre("Rapport EM/pl ?", EM / pl, "", `EM/pl = ${fr(EM, 3)} / ${frd(pl, 1)} = ${frd(EM / pl, 2)}.`, { rel: 0.01 }),
          choixMelange(a, "État du sol d'après le tableau de α ?", [al.etat, ...etats.filter((e) => e !== al.etat)],
            `Le tableau du coefficient rhéologique (F62 annexe C.5 ; NF P94-261 tableau H.2.1.1.1 corrigé) classe ce rapport dans « ${al.etat} ».`),
          choixMelange(a, "Coefficient α à retenir ?", [fraction(al.alpha), ...FRACTIONS.map(([, t]) => t).filter((t) => t !== fraction(al.alpha))].slice(0, 4),
            `α = ${fraction(al.alpha)}. Il sert au tassement (chapitre 9) et au module de réaction transversal des pieux (chapitre 14).`),
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
        ["Le coefficient rhéologique α se lit…", ["sur le rapport EM/pl, selon la nature du sol", "sur la seule pression limite pl", "sur l'indice de plasticité", "sur la résistance de pointe qc"],
          "Un rapport EM/pl élevé indique un sol surconsolidé (argile) ou serré (sable) ; le tableau donne α selon la nature et ce rapport."],
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
    id: "ch1-penetro", titre: "Pénétromètre et pressiomètre : deux regards sur un sable", difficulte: 1,
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
