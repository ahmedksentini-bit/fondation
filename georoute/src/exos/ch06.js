// Exercices du chapitre 6 : conditions d'utilisation des matériaux en remblai
// (GTR 2024, fascicule 2, annexe 2) — situations météorologiques, solutions,
// codes E G W T R C H et hauteur des remblais. Toutes les réponses viennent de
// conditionsRemblai et de decoder (src/gtr/utilisation.js) ; les solutions dont
// le code imprimé contredit le libellé (ANOMALIES de tables-remblai.js) ne sont
// jamais tirées.
import { frd, nombre, choixMelange, donnee } from "./alea.js";
import { conditionsRemblai, couvre, decoder, RUBRIQUES_REMBLAI, METEOS } from "../gtr/utilisation.js";
import { REMBLAI, ANOMALIES } from "../gtr/tables-remblai.js";
import { ETATS_2024, intervalle, etatHydrique } from "../gtr/classification.js";

// ───────────────────────────── Outils communs ─────────────────────────────

export const SYMBOLES_METEO = ["++", "+", "=", "-"];
const NOM_METEO = Object.fromEntries(METEOS.map((m) => [m.symbole, m.nom]));
const signe = (m) => m.replace("-", "−");
/** Situation météorologique en clair : « pluie faible (+) ». */
export const meteoEnClair = (m) => `${NOM_METEO[m]} (${signe(m)})`;
/** La même, précédée de sa préposition : « sous une pluie faible (+) », « par temps neutre (=) ». */
const PAR_METEO = { "++": "sous une pluie forte", "+": "sous une pluie faible", "=": "par temps neutre, sans pluie ni évaporation importante", "-": "par forte évaporation" };
export const parMeteo = (m) => `${PAR_METEO[m]} (${signe(m)})`;
const LETTRES = Object.keys(RUBRIQUES_REMBLAI); // E G W T R C H
const RANG = ["1er", "2e", "3e", "4e", "5e", "6e", "7e"];

export const ETATS = { th: "très humide", h: "humide", m: "moyen", s: "sec", ts: "très sec" };
/** Natures de sols : nom seul, puis précédé de son article. */
export const NATURES = {
  F1: "limon peu plastique", F2: "limon ou argile peu plastique", F3: "argile plastique", F4: "argile très plastique",
  I1: "sable ou grave très silteux", I2: "sable ou grave argileux",
  S1: "sable propre à granulométrie étalée", S2: "sable propre mal gradué", S3: "sable silteux à granulométrie étalée", S4: "sable silteux mal gradué",
  G1: "grave propre à granulométrie étalée", G2: "grave propre mal graduée", G3: "grave silteuse à granulométrie étalée", G4: "grave silteuse mal graduée",
};
const AVEC_ARTICLE = {
  F1: "un limon peu plastique", F2: "un limon ou une argile peu plastique", F3: "une argile plastique", F4: "une argile très plastique",
  I1: "un sable ou une grave très silteux", I2: "un sable ou une grave argileux",
  ...Object.fromEntries(["S1", "S2", "S3", "S4"].map((k) => [k, `un ${NATURES[k]}`])),
  ...Object.fromEntries(["G1", "G2", "G3", "G4"].map((k) => [k, `une ${NATURES[k]}`])),
};
const FAMILLES = { Li: ["un calcaire", "m"], Cl: ["une roche argileuse", "f"], Sa: ["un grès", "m"], Co: ["un conglomérat", "m"], Vo: ["une roche magmatique", "f"], Me: ["une roche métamorphique", "f"] };
const DURETES = { R1: "extrêmement dur", R2: "très dur", R3: "dur", R4: "de dureté moyenne", R5: "fragmentable" };
const accord = (adj, genre) => (genre === "f" && /dur$/.test(adj) ? `${adj}e` : adj);

/** Lecture d'un symbole de sol (F, I, S, G, éventuellement VC1/VC2) : nature et état. */
export function lireSymbole(symbole) {
  const m = /^(VC[12])?([FISG][1-4])(ins|th|h|m|s|ts)$/.exec(symbole);
  return m ? { vc: m[1] ?? "", nature: m[2], etat: m[3] } : null;
}

/** Nature d'un sol avec son article, sans son état : « un limon peu plastique à éléments de plus de 63 mm » (le symbole, cité à côté, dit VC1 ou VC2). */
export const natureAvecArticle = (vc, nature) => `${AVEC_ARTICLE[nature]}${vc ? " à éléments de plus de 63 mm" : ""}`;

/** Description d'un matériau des tableaux (sols, craies, roches), article compris ; null si inconnu. */
export function decrire(symbole) {
  const s = lireSymbole(symbole);
  if (s) return `${natureAvecArticle(s.vc, s.nature)}, ${s.etat === "ins" ? "insensible à l'eau" : `à l'état ${ETATS[s.etat]}`}`;
  const c = /^CH([1-4])(th|h|m|s|ts)?$/.exec(symbole);
  if (c) return `une craie ${["très dense", "dense", "de densité moyenne", "peu dense"][c[1] - 1]}${c[2] ? `, à l'état ${ETATS[c[2]]}` : ""}`;
  const r = /^(R[1-5]) (Li|Cl|Sa|Co|Vo|Me)(d[12])?(th|h|m|s|ts)?$/.exec(symbole);
  if (r) {
    const [nom, genre] = FAMILLES[r[2]];
    return `${nom} ${accord(DURETES[r[1]], genre)}${r[3] ? (r[3] === "d1" ? ", très dégradable" : ", moyennement dégradable") : ""}${r[4] ? `, à l'état ${ETATS[r[4]]}` : ""}`;
  }
  return null;
}

/** Solution dont le code imprimé contredit le libellé (liste ANOMALIES du guide transcrit). */
const douteuse = (cas, sit, code) => ANOMALIES.some((x) => x.code === code && x.meteo === sit.meteo && x.classes.some((k) => cas.classes.includes(k)));

/** Lignes du tableau (cas × situation) qui portent au moins une solution sûre. */
const LIGNES = REMBLAI.flatMap((cas) => (cas.situations ?? [])
  .filter((sit) => sit.solutions?.some((x) => !douteuse(cas, sit, x.code)))
  .map((sit) => ({ cas, sit, classes: cas.classes.filter((k) => decrire(k)) })))
  .filter((l) => l.classes.length);
const estSol = (l) => l.classes.every((k) => lireSymbole(k));
const LIGNES_SOLS = LIGNES.filter(estSol);
const TOUS_CODES = [...new Set(REMBLAI.flatMap((c) => (c.situations ?? []).flatMap((s) => (s.solutions ?? []).map((x) => x.code))))];

/** Tire une ligne, un symbole de la ligne et une météo couverte ; la réponse vient de conditionsRemblai. */
function tirerLigne(a, lignes) {
  const l = a.choix(lignes);
  const symbole = a.choix(l.classes), meteo = a.choix(SYMBOLES_METEO.filter((m) => couvre(l.sit.meteo, m)));
  return { symbole, meteo, r: conditionsRemblai(symbole, meteo) };
}

/** Codes admis par le tableau pour un matériau et une météo (liste vide si NON). */
const codesAdmis = (symbole, meteo) => { const r = conditionsRemblai(symbole, meteo); return r.trouve ? (r.solutions ?? []).map((x) => x.code) : []; };

/**
 * Codes « voisins », pris dans le même tableau : même matériau par une autre
 * météo, même nature dans un autre état (l'erreur d'état hydrique), puis
 * n'importe quel code du guide ; jamais un code de `exclus`.
 */
function codesVoisins(a, symbole, meteo, exclus, n = 3) {
  const s = lireSymbole(symbole);
  const groupes = [SYMBOLES_METEO.filter((m) => m !== meteo).flatMap((m) => codesAdmis(symbole, m))];
  if (s) {
    const autres = ["th", "h", "m", "s", "ts", "ins"].filter((e) => e !== s.etat).map((e) => `${s.vc}${s.nature}${e}`);
    groupes.push(autres.flatMap((k) => codesAdmis(k, meteo)), autres.flatMap((k) => SYMBOLES_METEO.flatMap((m) => codesAdmis(k, m))));
  }
  groupes.push(TOUS_CODES);
  const res = [];
  for (const g of groupes) for (const c of a.tirage([...new Set(g)])) if (res.length < n && !exclus.has(c) && !res.includes(c)) res.push(c);
  return res;
}

/** Hauteur maximale de remblai d'une solution : rubrique H (0 : pas de condition, 1 : ≤ 5 m, 2 : ≤ 10 m) [F1 tableau 11]. */
const HAUTEUR_H = [Infinity, 5, 10];
const hauteurMax = (code) => HAUTEUR_H[Number(code[6])];
const TEXTE_HAUTEUR = { 5: "5 m (remblai de faible hauteur)", 10: "10 m (remblai de hauteur moyenne)", Infinity: "pas de limite propre à la solution (15 m, domaine du guide)" };

/** Conditions d'un code en toutes lettres, sans les chiffres : « E : extraction en couches… ; C : compactage moyen ». */
const decrireCode = (code) => decoder(code).filter((x) => x.valeur !== 0).map((x) => `${x.rubrique} : ${x.texte}`).join(" ; ");
const listeCodes = (sols) => sols.map((x) => `${x.code}${x.titre ? ` (${x.titre})` : ""}`).join(", ");
const ENERGIES_C = ["compactage intense", "compactage moyen", "compactage faible"];
const etatEnClair = (e) => `${e} (${ETATS[e]})`;
/** Nature d'un sol sans article ni état : « limon peu plastique à éléments de plus de 63 mm ». */
const decrireNature = (n) => { const s = lireSymbole(`${n}m`); return `${NATURES[s.nature]}${s.vc ? " à éléments de plus de 63 mm" : ""}`; };

// ───────────────────────────── Modèles ─────────────────────────────

export default [
  {
    id: "ch6-decoder", titre: "Décoder un code E G W T R C H", difficulte: 1,
    generer(a) {
      const { symbole, meteo, r } = tirerLigne(a, LIGNES);
      const sol = a.choix(r.solutions.filter((x) => !douteuse(r.cas, r.situation, x.code)));
      const d = sol.decode;
      const nonNuls = d.filter((x) => x.valeur !== 0), nuls = d.filter((x) => x.valeur === 0);
      const choisis = [...a.tirage(nonNuls, Math.min(3, nonNuls.length)), ...a.tirage(nuls, nuls.length ? 1 : 0)]
        .sort((x, y) => LETTRES.indexOf(x.rubrique) - LETTRES.indexOf(y.rubrique));
      return {
        enonce: `Matériau ${symbole} : ${decrire(symbole)}. Pour son extraction ${parMeteo(meteo)}, le tableau d'utilisation en remblai (fascicule 2, annexe 2, p. ${r.cas.page}) propose${r.solutions.length > 1 ? `, parmi ${r.solutions.length} solutions,` : ""} la solution ${sol.titre ? `« ${sol.titre} » ` : ""}codée ${sol.code}. Ses sept chiffres se lisent dans l'ordre des rubriques E, G, W, T, R, C, H.`,
        donnees: [donnee("Matériau", symbole), donnee("Météo", meteoEnClair(meteo)), donnee("Code", sol.code)],
        questions: choisis.map((x) => {
          const i = LETTRES.indexOf(x.rubrique);
          const autres = RUBRIQUES_REMBLAI[x.rubrique].valeurs.filter((t) => t && t !== x.texte);
          return choixMelange(a, `${RANG[i]} chiffre (rubrique ${x.rubrique}, ${x.nom.toLowerCase()}) = ${x.valeur} : que prescrit-il ?`, [x.texte, ...a.tirage(autres, 3)],
            `Rubrique ${x.rubrique} — ${x.nom} : le chiffre ${x.valeur} signifie « ${x.texte} ».${x.valeur === 0 ? " Un 0 veut dire qu'aucune condition n'est imposée sur cette rubrique." : ""}${x.rubrique === "C" ? " La rubrique C n'est jamais nulle : toute mise en remblai fixe une énergie de compactage, que les tableaux de l'annexe 4 traduisent en Q/S (chapitre 7)." : ""}${x.rubrique === "H" && x.valeur ? " Les solutions qui comptent sur l'état du jour ne valent pas pour les grands remblais." : ""}`);
        }),
      };
    },
  },
  {
    id: "ch6-lecture", titre: "Lire une ligne du tableau d'utilisation", difficulte: 1,
    generer(a) {
      const { symbole, meteo, r } = tirerLigne(a, LIGNES_SOLS);
      const codes = r.solutions.map((x) => x.code);
      const bon = a.choix(r.solutions.filter((x) => !douteuse(r.cas, r.situation, x.code))).code;
      const faux = codesVoisins(a, symbole, meteo, new Set(codes));
      const hMax = Math.max(...codes.map(hauteurMax));
      return {
        enonce: `Un déblai fournit ${decrire(symbole)} — classe ${symbole}. Le géotechnicien du chantier apprécie la situation du jour : ${meteoEnClair(meteo)}. On consulte le tableau d'utilisation en remblai de ce matériau (fascicule 2, annexe 2).`,
        donnees: [donnee("Matériau", symbole), donnee("Météo", meteoEnClair(meteo))],
        questions: [
          nombre("Combien de solutions le tableau admet-il pour cette situation ?", codes.length, "", `Tableau ${symbole}, p. ${r.cas.page}, ligne « ${r.situation.libelle ?? r.situation.meteo} » : ${codes.length} solution${codes.length > 1 ? "s" : ""}, ${listeCodes(r.solutions)}.${codes.length > 1 ? " Elles sont données sans ordre de préférence : toutes conviennent." : ""}`, { abs: 0 }),
          choixMelange(a, "Lequel de ces codes est une solution admise ?", [bon, ...faux],
            `Solutions de la ligne : ${listeCodes(r.solutions)}. Les autres codes proposés appartiennent à d'autres situations météorologiques ou à d'autres états du même sol : l'état constaté à l'extraction et la météo du jour fixent la ligne à lire.`),
          choixMelange(a, "Quelle hauteur de remblai l'ensemble de ces solutions permet-il au mieux ?", [TEXTE_HAUTEUR[hMax], ...Object.values(TEXTE_HAUTEUR).filter((t) => t !== TEXTE_HAUTEUR[hMax])],
            `Rubrique H (7e chiffre) des solutions : ${codes.map((c) => `${c} → H = ${c[6]}`).join(", ")}. H = 0 : pas de limite propre à la solution ; H = 1 : 5 m ; H = 2 : 10 m. ${hMax === Infinity ? "Une solution au moins n'impose pas de hauteur : le remblai reste dans le domaine du guide (15 m au plus, au-delà une étude propre)." : `La plus permissive limite le remblai à ${hMax} m.`}`),
        ],
      };
    },
  },
  {
    id: "ch6-journee", titre: "Refusé le matin, accepté l'après-midi", difficulte: 2,
    generer(a) {
      const { symbole, matin, apres } = a.choix(JOURNEES).tirer(a);
      const rm = conditionsRemblai(symbole, matin), ra = conditionsRemblai(symbole, apres);
      const codes = ra.solutions.map((x) => x.code);
      const bon = a.choix(ra.solutions.filter((x) => !douteuse(ra.cas, ra.situation, x.code))).code;
      const faux = codesVoisins(a, symbole, apres, new Set(codes));
      return {
        enonce: `Chantier de remblai avec ${decrire(symbole)} (${symbole}). Le matin : ${meteoEnClair(matin)}. Vers midi, le temps change ; l'après-midi : ${meteoEnClair(apres)}.`,
        donnees: [donnee("Matériau", symbole), donnee("Matin", meteoEnClair(matin)), donnee("Après-midi", meteoEnClair(apres))],
        questions: [
          choixMelange(a, "Que dit le tableau pour le matin ?",
            ["NON : pas de mise en remblai par ce temps", "mise en remblai avec un compactage faible", "mise en remblai après extraction frontale", "mise en remblai sans condition particulière"],
            `Tableau ${symbole} (p. ${rm.cas.page}) : « ${rm.non} »${rm.situation ? "" : " La ligne de pluie faible est déjà NON : a fortiori sous une pluie forte."} On suspend la mise en remblai, ou l'on change de matériau.`),
          nombre("Combien de solutions l'après-midi ?", codes.length, "", `Ligne « ${ra.situation.libelle ?? ra.situation.meteo} » : ${listeCodes(ra.solutions)}.`, { abs: 0 }),
          choixMelange(a, "Lequel de ces codes est admis l'après-midi ?", [bon, ...faux],
            `Solutions admises l'après-midi : ${codes.join(", ")}. Le même sol peut être refusé le matin et accepté l'après-midi, à condition d'adapter l'extraction, le régalage, le compactage et la hauteur.`),
          choixMelange(a, "Pourquoi le tableau refuse-t-il le matin ?",
            ["la pluie ferait monter la teneur en eau d'un sol sensible à l'eau : la qualité du remblai ne serait plus garantie", "la pluie empêche le fonctionnement des compacteurs vibrants", "le GTR interdit tout terrassement par temps de pluie, quel que soit le sol", "la pluie rend le sol insensible à l'eau"],
            `Sous la pluie, la teneur en eau monte (brutalement et de façon imprévisible sous une pluie forte, lentement sous une pluie faible). Pour ce sol sensible à l'eau, le guide ne voit pas de solution assurant la qualité — alors qu'un sable insensible à l'eau (S…ins) reste utilisable sauf sous une forte pluie, et une grave insensible à l'eau (G…ins) par tous les temps.`),
        ],
      };
    },
  },
  {
    id: "ch6-hauteur", titre: "Solutions et hauteur du remblai", difficulte: 2,
    generer(a) {
      for (let essai = 0; essai < 50; essai++) {
        const { symbole, meteo, r } = tirerLigne(a, LIGNES_HAUTEUR);
        const Hr = a.choix([3, 4, 4.5, 6, 7, 8, 9, 11, 12, 13, 14]);
        const ok = r.solutions.filter((x) => hauteurMax(x.code) >= Hr), ko = r.solutions.filter((x) => hauteurMax(x.code) < Hr);
        const surs = ok.filter((x) => !douteuse(r.cas, r.situation, x.code));
        if (!surs.length || !ko.length) continue;
        const bon = a.choix(surs).code;
        const exclus = new Set(ok.map((x) => x.code));
        const faux = [...a.tirage(ko.map((x) => x.code)), ...codesVoisins(a, symbole, meteo, new Set([...exclus, ...ko.map((x) => x.code)]))].slice(0, 3);
        return {
          enonce: `Un remblai de ${frd(Hr, Hr % 1 ? 1 : 0)} m de hauteur doit être construit avec ${decrire(symbole)} (${symbole}), ${parMeteo(meteo)}.`,
          donnees: [donnee("Matériau", symbole), donnee("Météo", meteoEnClair(meteo)), donnee("Hauteur du remblai", `${frd(Hr, Hr % 1 ? 1 : 0)} m`)],
          questions: [
            nombre("Combien de solutions du tableau restent applicables à cette hauteur ?", ok.length, "", `Solutions de la ligne (p. ${r.cas.page}) et rubrique H : ${r.solutions.map((x) => `${x.code} → ${hauteurMax(x.code) === Infinity ? "pas de limite" : `≤ ${hauteurMax(x.code)} m`}`).join(" ; ")}. Pour ${frd(Hr, Hr % 1 ? 1 : 0)} m : ${ok.length} solution${ok.length > 1 ? "s" : ""}.`, { abs: 0 }),
            choixMelange(a, "Lequel de ces codes convient pour ce remblai ?", [bon, ...faux],
              `${bon} est admis par le tableau et sa rubrique H (${bon[6]}) ${bon[6] === "0" ? "n'impose pas de hauteur" : `autorise ${hauteurMax(bon)} m`}. ${ko.length ? `${ko.map((x) => x.code).join(", ")} : admis par cette météo, mais limité${ko.length > 1 ? "s" : ""} à ${ko.map((x) => `${hauteurMax(x.code)} m`).join(", ")}.` : ""} Les autres codes ne figurent pas sur cette ligne du tableau.`),
            choixMelange(a, "Pourquoi certaines solutions limitent-elles la hauteur du remblai ?",
              ["un sol mis en œuvre humide, ou dont l'état dépend de la météo, garde des pressions interstitielles et tasse : seul un remblai bas le tolère", "les compacteurs ne peuvent pas travailler à plus de 5 m de hauteur", "le GTR interdit tout remblai de plus de 10 m", "la hauteur du remblai fixe l'épaisseur des couches de régalage"],
              "Les solutions qui comptent sur un état hydrique limite ou sur une amélioration due à la météo ne valent pas pour les grands remblais : pressions interstitielles pendant et après la construction, tassements, stabilité (chapitre 9). Au-delà de 15 m, la conception relève d'une étude propre."),
          ],
        };
      }
      throw new Error("ch6-hauteur : aucun tirage exploitable");
    },
  },
  {
    id: "ch6-compactage", titre: "Humide, moyen ou sec : l'énergie de compactage", difficulte: 2,
    generer(a) {
      const { nature, etats } = a.choix(COMPACTAGES);
      const lignes = etats.map(({ etat, sol }) => ({ etat, sol, C: sol.decode[5] }));
      const hMax = Math.max(...lignes.map((l) => hauteurMax(l.sol.code)));
      const meilleurs = lignes.filter((l) => hauteurMax(l.sol.code) === hMax);
      const q = a.tirage(lignes).map((l) => choixMelange(a, `Emploi en l'état du ${nature}${l.etat} : quelle énergie de compactage ?`, [l.C.texte, ...ENERGIES_C.filter((t) => t !== l.C.texte)],
        `Tableau ${nature}${l.etat}, situation « = » : solution ${l.sol.code}${l.sol.titre ? ` (${l.sol.titre})` : ""}, 6e chiffre C = ${l.C.valeur} → ${l.C.texte}.${l.etat === "h" ? " Un sol humide se compacte faiblement : un compactage énergique le mettrait en surpression interstitielle (matelassage, orniérage) sans le densifier." : l.etat === "s" ? " Un sol sec se compacte intensément : avec peu d'eau, il faut beaucoup d'énergie pour atteindre q4 — et il pourra encore tasser s'il se mouille plus tard." : " À l'état moyen, proche de l'optimum, un compactage moyen suffit."}`));
      if (meilleurs.length === 1) q.push(choixMelange(a, "Lequel des trois emplois permet le remblai le plus haut ?", [meilleurs[0], ...lignes.filter((l) => l !== meilleurs[0])].map((l) => `${nature}${l.etat}`),
        `Rubrique H : ${lignes.map((l) => `${nature}${l.etat} → ${l.sol.code} (H = ${l.sol.code[6]}, ${hauteurMax(l.sol.code) === Infinity ? "pas de limite" : `≤ ${hauteurMax(l.sol.code)} m`})`).join(" ; ")}. C'est l'état ${ETATS[meilleurs[0].etat]}, le plus proche de l'optimum, qui donne le remblai le plus sûr.`));
      return {
        enonce: `Le même sol ${nature} (${decrireNature(nature)}) est extrait en trois points d'un chantier : à l'état humide (${nature}h), à l'état moyen (${nature}m) et à l'état sec (${nature}s). Par temps neutre (=), on veut l'employer en l'état — sans action sur la teneur en eau ni traitement.`,
        donnees: [donnee("Nature", nature), donnee("États", "h · m · s"), donnee("Météo", meteoEnClair("="))],
        questions: q,
      };
    },
  },
  {
    id: "ch6-code", titre: "Écrire le code d'une solution", difficulte: 3,
    generer(a) {
      const { symbole, meteo, r } = tirerLigne(a, LIGNES);
      const surs = r.solutions.filter((x) => !douteuse(r.cas, r.situation, x.code));
      const sols = a.tirage(surs, Math.min(2, surs.length));
      const tous = new Set(r.solutions.map((x) => x.code));
      const q = sols.map((x, i) => choixMelange(a, `Code de la solution ${sols.length > 1 ? `n° ${i + 1}` : "décrite"} ?`, [x.code, ...variantes(a, x.code, tous)],
        `Rubrique par rubrique, dans l'ordre E G W T R C H : ${decoder(x.code).map((d) => `${d.rubrique} = ${d.valeur}`).join(", ")} → ${x.code}. Une rubrique sans condition vaut 0 ; seule C n'est jamais nulle.`));
      if (sols.length === 1) q.push(choixMelange(a, "Quel chiffre du code porte l'épaisseur de régalage ?", ["le 5e (R)", "le 1er (E)", "le 6e (C)", "le 7e (H)"],
        "Ordre des rubriques : E extraction, G granularité, W teneur en eau, T traitement, R régalage, C compactage, H hauteur. R est le 5e chiffre : 1 pour des couches minces (20 à 30 cm), 2 pour des couches moyennes (30 à 50 cm)."));
      return {
        enonce: `Pour ${decrire(symbole)} (${symbole}) ${parMeteo(meteo)}, le tableau d'utilisation en remblai décrit ${sols.length > 1 ? "deux des solutions par leurs conditions" : "une solution par ses conditions"}. ${sols.map((x, i) => `${sols.length > 1 ? `Solution n° ${i + 1}` : "Conditions imprimées"} — ${decrireCode(x.code)}.`).join(" ")} Écrire ${sols.length > 1 ? "leurs codes" : "son code"} à sept chiffres.`,
        donnees: [donnee("Matériau", symbole), donnee("Météo", meteoEnClair(meteo)), donnee("Ordre des rubriques", "E G W T R C H")],
        questions: q,
      };
    },
  },
  {
    id: "ch6-etat", titre: "De l'état hydrique au tableau d'utilisation", difficulte: 3,
    generer(a) {
      const nature = a.choix(["F1", "F2", "F3", "I1", "I2"]);
      const cible = a.choix(["th", "h", "h", "h", "m", "m", "m", "s", "s", "ts"]);
      const t = ETATS_2024[nature];
      const ligne = t.lignes.find((l) => l.etat === cible);
      const dans = (txt, marge, largeur) => {
        const I = intervalle(txt);
        const lo = Number.isFinite(I.a) ? I.a + marge : I.b - largeur, hi = Number.isFinite(I.b) ? I.b - marge : I.a + largeur;
        return [lo, hi];
      };
      const [r0, r1] = dans(ligne.r, 0.03, 0.2);
      const wOPN = nature.startsWith("I") ? a.entre(9, 15, 0.5) : a.entre(13, 22, 0.5);
      const w = +(wOPN * a.entre(r0, r1, 0.01)).toFixed(1);
      const mIPI = t.lignes.find((l) => l.etat === "m").IPI;
      const IPI = ligne.IPI ? Math.max(1, Math.round(a.entre(...dans(ligne.IPI, 0.5, 2), 0.5))) : Math.round(intervalle(mIPI).b + a.entre(3, 15, 1));
      const h = etatHydrique(nature, { IPI, w, wOPN });
      const symbole = `${nature}${h.etat}`;
      // Une fois sur trois au plus, une météo sans solution : le tableau dit aussi NON.
      const avecSolutions = SYMBOLES_METEO.filter((m) => codesAdmis(symbole, m).length);
      const meteo = avecSolutions.length && a.reel() < 0.7 ? a.choix(avecSolutions) : a.choix(SYMBOLES_METEO);
      const r = conditionsRemblai(symbole, meteo);
      const codes = (r.solutions ?? []).map((x) => x.code);
      const etats = ["th", "h", "m", "s", "ts"];
      const q = [
        nombre("Rapport wn/wOPN ?", h.r, "", `wn/wOPN = ${frd(w, 1)}/${frd(wOPN, 1)} = ${frd(h.r, 3)}.`, { rel: 0.01 }),
        choixMelange(a, `État hydrique du ${nature} ?`, [etatEnClair(h.etat), ...etats.filter((e) => e !== h.etat).map(etatEnClair)],
          `${h.mesures.map(([p, e]) => `${p} → ${e}`).join(" ; ")}. Le GTR privilégie l'IPI pour les états humides (il traduit la traficabilité) et wn/wOPN pour les états secs (difficulté de compactage) : état ${etatEnClair(h.etat)}.`),
        nombre(`Nombre de solutions admises ${parMeteo(meteo)} (0 si le tableau dit NON) ?`, codes.length, "", codes.length
          ? `Tableau ${symbole}, p. ${r.cas.page} : ${listeCodes(r.solutions)}.`
          : `Tableau ${symbole}${r.cas ? `, p. ${r.cas.page}` : ""} : NON — ${r.non}`, { abs: 0 }),
      ];
      if (codes.length) {
        const bon = a.choix(r.solutions.filter((x) => !douteuse(r.cas, r.situation, x.code))).code;
        q.push(choixMelange(a, "Lequel de ces codes est une solution admise ?", [bon, ...codesVoisins(a, symbole, meteo, new Set(codes))],
          `Solutions de ${symbole} ${parMeteo(meteo)} : ${codes.join(", ")}. Les autres codes sont ceux d'états voisins ou d'autres météos : se tromper d'état hydrique, c'est se tromper de ligne.`));
      } else {
        const inutilisable = Boolean(r.cas?.non);
        const options = ["sol normalement inutilisable en l'état, quelle que soit la météo", "pas de mise en remblai par ce temps : attendre une situation plus favorable", "mise en remblai possible avec un compactage faible", "mise en remblai possible après un simple arrosage"];
        q.push(choixMelange(a, "Que conclure ?", inutilisable ? options : [options[1], options[0], options[2], options[3]],
          inutilisable ? `Les sols ${h.etat === "th" ? "très humides" : "très secs"} ne sont pas réutilisables normalement : « ${r.cas.non} »` : `Le cas ${symbole} a des solutions par d'autres temps, mais pas ${parMeteo(meteo)} : ${r.non}`));
      }
      return {
        enonce: `Au laboratoire, ${AVEC_ARTICLE[nature]} (${nature}) donne wOPN = ${frd(wOPN, 1)} % ; sur le chantier, on mesure wn = ${frd(w, 1)} % et un indice portant immédiat IPI = ${IPI}. La mise en remblai est prévue ${parMeteo(meteo)}.`,
        donnees: [donnee("Nature", nature), donnee("wOPN", `${frd(wOPN, 1)} %`), donnee("wn", `${frd(w, 1)} %`), donnee("IPI", String(IPI)), donnee("Météo", meteoEnClair(meteo))],
        questions: q,
      };
    },
  },
];

// ─────────────────────── Ensembles précalculés ───────────────────────

/** Lignes de sols à plusieurs solutions dont l'une au moins limite la hauteur. */
const LIGNES_HAUTEUR = LIGNES_SOLS.filter((l) => l.sit.solutions.length >= 2 && l.sit.solutions.some((x) => x.code[6] !== "0"));

/**
 * Journées : un sol (états h, m, s) refusé sous la pluie le matin et admis
 * l'après-midi par un temps moins humide. La réponse vient de conditionsRemblai.
 */
const ORDRE = { "++": 0, "+": 1, "=": 2, "-": 3 };
const JOURNEES = [];
for (const cas of REMBLAI) {
  const k = cas.classes.find((x) => lireSymbole(x) && ["h", "m", "s"].includes(lireSymbole(x).etat));
  if (!k) continue;
  const admiseSure = (m) => { const r = conditionsRemblai(k, m); return (r.solutions ?? []).some((x) => !douteuse(cas, r.situation, x.code)); };
  for (const matin of ["++", "+"]) {
    if (codesAdmis(k, matin).length) continue;
    // Une pluie forte non décrite au tableau n'est retenue que si la pluie faible est déjà refusée.
    if (matin === "++" && !conditionsRemblai(k, "++").situation && codesAdmis(k, "+").length) continue;
    const apres = SYMBOLES_METEO.filter((m) => ORDRE[m] > ORDRE[matin] && admiseSure(m));
    if (apres.length) JOURNEES.push({ tirer: (a) => ({ symbole: a.choix(cas.classes.filter((x) => lireSymbole(x))), matin, apres: a.choix(apres) }) });
  }
}

/**
 * Natures dont l'emploi en l'état (G = W = T = 0) par temps neutre existe aux
 * états h, m et s, avec un compactage faible à l'état humide et intense à
 * l'état sec.
 */
const COMPACTAGES = [];
for (const nature of ["F1", "F2", "F3", "I1", "I2", "S1", "S2", "S3", "S4", "G1", "G2", "G3", "G4", "VC2F1", "VC2F2", "VC2S3", "VC2G3", "VC1F2"]) {
  const etats = ["h", "m", "s"].map((etat) => {
    const r = conditionsRemblai(`${nature}${etat}`, "=");
    const sol = (r.solutions ?? []).find((x) => x.code.slice(1, 4) === "000" && !douteuse(r.cas, r.situation, x.code));
    return sol ? { etat, sol } : null;
  });
  if (etats.every(Boolean) && etats[0].sol.code[5] === "3" && etats[2].sol.code[5] === "1") COMPACTAGES.push({ nature, etats });
}

/**
 * Codes voisins d'un code donné, pour les distracteurs : un chiffre non nul
 * changé pour une autre valeur de sa rubrique, deux rubriques voisines
 * interverties (erreur d'ordre), puis une condition ajoutée.
 */
function variantes(a, code, exclus, n = 3) {
  const valeurs = LETTRES.map((l) => RUBRIQUES_REMBLAI[l].valeurs.map((t, v) => (t ? v : null)).filter((v) => v !== null));
  const valide = (c) => [...c].every((d, i) => valeurs[i].includes(Number(d)));
  const proches = [], ajouts = [];
  for (let i = 0; i < 7; i++) for (const v of valeurs[i]) {
    if (String(v) === code[i]) continue;
    const c = code.slice(0, i) + v + code.slice(i + 1);
    (code[i] !== "0" && v !== 0 ? proches : ajouts).push(c);
  }
  for (let i = 0; i < 6; i++) if (code[i] !== code[i + 1]) {
    const t = [...code];
    [t[i], t[i + 1]] = [t[i + 1], t[i]];
    if (valide(t.join(""))) proches.push(t.join(""));
  }
  const res = [];
  for (const g of [proches, ajouts]) for (const c of a.tirage([...new Set(g)])) if (res.length < n && c !== code && !exclus.has(c) && !res.includes(c)) res.push(c);
  return res;
}
