// Bureau de calcul : sept modules dans une coque de logiciel. Les calculs sont
// faits par src/bureau/semelle.js, src/bureau/pieu.js et les solveurs de
// src/geotech ; ce fichier ne gère que la saisie, la sauvegarde, les figures
// et l'impression de la note.

import { justifierSemelle } from "./bureau/semelle.js";
import { justifierPieu, combinaisonsPieu } from "./bureau/pieu.js";
import { noteSemelle, notePieu } from "./bureau/notes.js";
import { coupeSemelle, coupePieu, coupeRemblai, graphe, echantillon, COULEURS } from "./figures.js";
import { CLASSES_F62, CATEGORIES_EC7 } from "./geotech/sols.js";
import { K_TAN_DELTA, lambdaCombarieu, muIsole, frottementNegatif, rayonInfluence, repartitionGroupe } from "./geotech/frottement-negatif.js";
import { converseLabarre, efficaciteCoherentF62, efficaciteEC7, verifGroupeEC7, blocMonolithique } from "./geotech/groupes.js";
import { moduleKf, minorationSurface, pieuLongAnalytique, pieuDifferencesFinies, pieuSouple } from "./geotech/lateral.js";
import { calibrageAppareil, etalonnageSonde, depouiller, CONVENTIONS } from "./geotech/pressio.js";
import { controlerAppareillage, controlerEssai, bilanControles } from "./geotech/pressio-qualite.js";
import { alphaMenard } from "./geotech/sols.js";
import { profilPressio } from "./figures.js";
import { TUBE, AIR, SONDE, sondage, texteReleves, texteCouples } from "./pressio-exemples.js";
import { lireTableau } from "./ui.js";
import { figureTube, figureAir, figureCorrections, figureCourbe, figureFluage, figureInverse, figurePentes, figureHyperbole } from "./figures-pressio.js";
import { pentes } from "./geotech/pressio.js";
import { couchesDepuisSondage, balayage, tauxMaximaux } from "./bureau/projet.js";
import { etudierRemblai } from "./bureau/remblai.js";

const app = document.getElementById("app");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const f = (x, c = 3) => (Number.isFinite(x) ? Number(x).toLocaleString("fr-FR", { maximumSignificantDigits: c }) : "—");
const fd = (x, d = 2) => (Number.isFinite(x) ? Number(x).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—");
const nombre = (v, defaut = NaN) => {
  const x = parseFloat(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(x) ? x : defaut;
};
const pastille = (ok) => `<span class="verdict ${ok ? "ok" : "ko"}">${ok ? "✓ vérifié" : "✕ non vérifié"}</span>`;
const CLE = "fondations-bureau-v1";

const OPT_CLASSES = Object.entries(CLASSES_F62).map(([k, c]) => [k, `${c.nom} (${c.lettre})`]);
const OPT_CATEGORIES = Object.entries(CATEGORIES_EC7).map(([k, c]) => [k, c.nom]);
const OPT_ALPHA = [["1", "1"], ["0.6666666667", "2/3"], ["0.5", "1/2"], ["0.3333333333", "1/3"], ["0.25", "1/4"]];
const TYPES_PIEU = [
  ["fore-simple|1", "Foré simple (cat. 1)"], ["fore-boue|2", "Foré boue (cat. 2)"], ["fore-tube-perdu|3", "Foré tubé, virole perdue (cat. 3)"],
  ["fore-tube-recupere|4", "Foré tubé, virole récupérée (cat. 4)"], ["battu-prefabrique|9", "Battu préfabriqué béton (cat. 9)"],
  ["battu-enrobe|10", "Battu enrobé (cat. 10)"], ["battu-moule|11", "Battu moulé (cat. 11)"], ["metal-battu-ferme|12", "Acier battu fermé (cat. 12)"],
  ["tube-ouvert|13", "Acier battu ouvert (cat. 13)"], ["profile-H|14", "Profilé H battu (cat. 14)"],
  ["injecte-bp|19", "Injecté basse pression / IGU (cat. 19)"], ["injecte-hp|20", "Injecté haute pression / IRS (cat. 20)"],
];

// Sondage pressiométrique d'exemple : un bloc « z = … » par essai, puis ses paliers.
const EXEMPLE_SONDAGE = sondage("A");
const texteSondage = (s) => s.essais.map((e) => `z = ${e.z}\n${texteReleves(e.paliers)}`).join("\n");
const OPT_NATURE = [["argile", "argile"], ["limon", "limon"], ["sable", "sable"], ["grave", "grave"]];
const OPT_MOTIF = [["remblai", "remblai"], ["argile", "argile"], ["limon", "limon"], ["sable", "sable"], ["grave", "grave"], ["craie", "craie"], ["marne", "marne"], ["roche", "roche"]];
const POIDS_A = { remblai: [18, 19], argile: [17, 17.5], sable: [19, 20], marne: [20, 21] };

// ─────────────────────────── Définition des modules ───────────────────────
const MODULES = [
  {
    id: "pressio", groupe: "Essais en place", icone: "◎", titre: "Sondage pressiométrique", sous: "dépouillement des essais, profil",
    description: "Dépouillement d'un sondage pressiométrique complet, comme dans un logiciel dédié : étalonnages de la sonde, corrections de chaque palier, EM, pf et pl de chaque essai, pressions nettes, puis la feuille de sondage et sa note de calcul.",
    champs: [
      ["Appareillage", [
        ["conv", "Conventions de correction", "choix", "norme", [["norme", "NF P94-110-1"], ["shg", "logiciel Shg Ménard"]]],
        ["hc", "Hauteur du manomètre hc", "m", "1"],
        ["di", "Diamètre intérieur du tube d'étalonnage", "mm", String(SONDE.di)], ["ls", "Longueur de la cellule centrale", "mm", String(SONDE.ls)],
        ["pminTube", "Droite du tube à partir de", "MPa", String(SONDE.pminTube)], ["Vs", "Vs imposé (vide : d'après le tube)", "cm³", ""],
        ["tube", "Étalonnage en tube : pr (MPa), Vr (cm³)", "texte", texteCouples(TUBE)],
        ["dzAir", "Dénivelé manomètre − sonde à l'air", "m", String(SONDE.dzAir)],
        ["air", "Étalonnage à l'air : pr (MPa), V (cm³)", "texte", texteCouples(AIR)],
      ]],
      ["Sondage", [
        ["zw", "Profondeur de la nappe (vide : pas de nappe)", "m", String(EXEMPLE_SONDAGE.zw)], ["K0", "K0 pour p0", "", "0.5"],
        ["essais", "Essais : une ligne « z = … », puis un palier par ligne (pr, V15, V30, V60)", "texte", texteSondage(EXEMPLE_SONDAGE)],
      ]],
    ],
    couches: {
      colonnes: [["base", "Base (m)", "nombre"], ["nom", "Description", "texte"], ["nature", "Nature (α)", "choix", OPT_NATURE], ["sol", "Motif", "choix", OPT_MOTIF],
        ["gamma", "γ (kN/m³)", "nombre"], ["gammaSat", "γsat", "nombre"]],
      defaut: EXEMPLE_SONDAGE.couches.map((c) => ({ base: String(c.z1), nom: c.nom, nature: c.nature, sol: c.sol, gamma: String(POIDS_A[c.sol]?.[0] ?? 18), gammaSat: String(POIDS_A[c.sol]?.[1] ?? 19) })),
    },
    calculer: calculerSondage,
  },
  {
    id: "semelle", groupe: "Fondations superficielles", icone: "▭", titre: "Semelle", sous: "excentrement, portance, glissement, tassement",
    description: "Une semelle justifiée au Fascicule 62 titre V et à la NF P94-261 sur les mêmes données : combinaisons, excentrement, portance pressiométrique, glissement et tassement de Ménard.",
    champs: [
      ["Géométrie", [
        ["forme", "Forme", "choix", "filante", [["filante", "filante"], ["rectangulaire", "rectangulaire"], ["carree", "carrée"]]],
        ["B", "Largeur B", "m", "3"], ["L", "Longueur L", "m", "12", (v) => v.forme === "rectangulaire"],
        ["D", "Profondeur de la base D", "m", "0.8"], ["h", "Épaisseur de la semelle", "m", "0.5"],
      ]],
      ["Sol et eau", [
        ["zw", "Profondeur de la nappe (vide : pas de nappe)", "m", ""],
        ["comportement", "Comportement pour l'inclinaison", "choix", "frottant", [["frottant", "frottant"], ["coherent", "cohérent"]]],
        ["phi", "φ' (glissement F62)", "°", "25"], ["phiCrit", "φ'crit (glissement EC7)", "°", "25"], ["c", "c'", "kPa", "0"],
        ["cu", "cu (0 : pas de vérification à court terme)", "kPa", "0"],
        ["prefabrique", "Semelle", "choix", "non", [["non", "coulée en place"], ["oui", "préfabriquée lisse"]]],
        ["alpha", "Coefficient α (tassement)", "choix", "0.5", OPT_ALPHA],
      ]],
      ["Actions au-dessus de la semelle", [
        ["GV", "G : V", "kN(/m)", "70"], ["GH", "G : H", "kN(/m)", "8"], ["GM", "G : M", "kN·m(/m)", "0"],
        ["QV", "Q : V", "kN(/m)", "25"], ["QH", "Q : H", "kN(/m)", "6"], ["QM", "Q : M", "kN·m(/m)", "0"],
        ["psi0", "ψ0", "", "0.7"], ["psi1", "ψ1", "", "0.5"], ["psi2", "ψ2", "", "0.3"],
      ]],
    ],
    couches: {
      colonnes: [["base", "Base (m)", "nombre"], ["classe", "Classe F62", "choix", OPT_CLASSES], ["categorie", "Catégorie EC7", "choix", OPT_CATEGORIES],
        ["gamma", "γ (kN/m³)", "nombre"], ["gammaSat", "γsat", "nombre"], ["pl", "pl* (MPa)", "nombre"], ["EM", "EM (MPa)", "nombre"]],
      defaut: [
        { base: "0.8", classe: "sable-A", categorie: "sable", gamma: "20", gammaSat: "21", pl: "1", EM: "10" },
        { base: "3.8", classe: "argile-A", categorie: "argile", gamma: "20", gammaSat: "20", pl: "0.7", EM: "6" },
        { base: "25", classe: "sable-B", categorie: "sable", gamma: "20", gammaSat: "21", pl: "2", EM: "20" },
      ],
    },
    calculer: calculerSemelle,
    parametrique: {
      aide: "Faire varier une dimension, toutes les autres données restant celles de la saisie : la courbe donne, pour chaque référentiel, le plus grand taux de travail de toutes les vérifications ; le premier passage sous 1 est la plus petite dimension qui convient.",
      variables: [
        { id: "B", champ: "B", nom: "Largeur B", court: "B", unite: "m", plage: (v) => [Math.max(0.3, Math.round(nombre(v.B, 2) * 0.4 * 10) / 10), Math.round(nombre(v.B, 2) * 2 * 10) / 10, 0.1] },
        { id: "D", champ: "D", nom: "Profondeur de la base D", court: "D", unite: "m", plage: (v) => [Math.max(nombre(v.h, 0.5), 0.3), Math.max(3, Math.round(nombre(v.D, 1) * 3 * 10) / 10), 0.1] },
      ],
      evaluer: (v) => tauxMaximaux(justifierSemelle(donneesSemelle(v)).synthese),
    },
  },
  {
    id: "pieu", groupe: "Fondations profondes", icone: "▮", titre: "Pieu isolé", sous: "portance et justification axiale",
    description: "Un pieu isolé sous charge axiale : portance au Fascicule 62 (annexes C.3, C.4) et à la NF P94-262 (annexes F, G), cumul avec le frottement négatif, justifications aux ELU et ELS, tassement.",
    champs: [
      ["Pieu", [
        ["type", "Type de pieu", "choix", "fore-boue|2", TYPES_PIEU],
        ["forme", "Section", "choix", "circulaire", [["circulaire", "circulaire"], ["carre", "carrée"]]],
        ["B", "Diamètre ou côté B", "m", "0.8"], ["D", "Longueur D", "m", "15"],
        ["methode", "Essai", "choix", "pressio", [["pressio", "pressiomètre"], ["penetro", "pénétromètre"]]],
        ["zf", "Frottement négligé au-dessus de", "m", "0"], ["Ep", "Module du béton", "MPa", "20000"],
      ]],
      ["Procédure de la NF P94-262", [
        ["procedure", "Procédure", "choix", "terrain", [["terrain", "modèle de terrain"], ["modele", "pieu modèle"]]],
        ["N", "Nombre de sondages", "", "3", (v) => v.procedure === "modele"], ["S", "Surface d'investigation", "m²", "400", (v) => v.procedure === "modele"],
        ["raide", "Structure", "choix", "non", [["non", "souple"], ["oui", "raide (ξ/1,1)"]], (v) => v.procedure === "modele"],
      ]],
      ["Actions en tête", [
        ["G", "G", "kN", "1500"], ["Q", "Q", "kN", "500"], ["psi2", "ψ2", "", "0.3"], ["Fn", "Frottement négatif Gsn", "kN", "0"],
      ]],
    ],
    couches: {
      colonnes: [["base", "Base (m)", "nombre"], ["classe", "Classe F62", "choix", OPT_CLASSES], ["categorie", "Catégorie EC7", "choix", OPT_CATEGORIES],
        ["pl", "pl* (MPa)", "nombre"], ["qc", "qc (MPa)", "nombre"], ["EM", "EM (MPa)", "nombre"]],
      defaut: [
        { base: "5", classe: "argile-A", categorie: "argile", pl: "0.5", qc: "1.2", EM: "5" },
        { base: "12", classe: "sable-B", categorie: "sable", pl: "1.5", qc: "10", EM: "15" },
        { base: "30", classe: "marne-A", categorie: "marne", pl: "2.5", qc: "8", EM: "30" },
      ],
    },
    calculer: calculerPieu,
    parametrique: {
      aide: "Faire varier la longueur ou le diamètre du pieu, toutes les autres données restant celles de la saisie : la courbe donne le plus grand taux de travail des vérifications de chaque référentiel ; son passage sous 1 donne la plus petite dimension qui convient.",
      variables: [
        { id: "D", champ: "D", nom: "Longueur D", court: "D", unite: "m", plage: (v) => [Math.max(3, Math.round(nombre(v.D, 12) * 0.5)), Math.round(nombre(v.D, 12) * 1.5), 0.5] },
        { id: "B", champ: "B", nom: "Diamètre B", court: "B", unite: "m", plage: (v) => [0.3, Math.max(1.5, Math.round(nombre(v.B, 0.8) * 2 * 10) / 10), 0.05] },
      ],
      evaluer: (v) => tauxMaximaux(verifsPieu(justifierPieu(donneesPieu(v)))),
    },
  },
  {
    id: "frottement", groupe: "Fondations profondes", icone: "⇊", titre: "Frottement négatif", sous: "Combarieu, isolé et en groupe",
    description: "Frottement négatif sous un remblai par la méthode de Combarieu (F62 annexe G.2 ; NF P94-262 annexe H), pieu isolé et pieu en groupe, et effort axial de calcul avec la règle de cumul.",
    champs: [
      ["Pieu et groupe", [
        ["B", "Diamètre B", "m", "0.6"], ["mise", "Pieu", "choix", "fore", [["tube", "tubé"], ["fore", "foré"], ["battu", "battu"], ["bitume", "chemisé au bitume"]]],
        ["d", "Entraxe d", "m", "1.8"], ["files", "Nombre de files", "", "3"],
      ]],
      ["Sol compressible et remblai", [
        ["nature", "Couche compressible", "choix", "argile-molle", [["tourbe", "tourbe"], ["argile-molle", "argile ou limon mou"], ["argile-ferme", "argile ferme"]]],
        ["H", "Épaisseur compressible", "m", "10"], ["gamma", "γ' de la couche", "kN/m³", "6"], ["h2", "h2 (vide : base de la couche)", "m", ""],
        ["hr", "Hauteur de remblai", "m", "3"], ["gr", "γ du remblai", "kN/m³", "20"],
        ["natR", "Remblai", "choix", "sable-autre", [["sable-autre", "granulaire"], ["sable-lache", "sable lâche"], ["argile-ferme", "argileux compacté"]]],
      ]],
      ["Actions en tête", [["G", "G", "kN", "900"], ["Q", "Q", "kN", "300"], ["psi2", "ψ2", "", "0.3"]]],
    ],
    calculer: calculerFrottement,
  },
  {
    id: "groupe", groupe: "Fondations profondes", icone: "⋮", titre: "Groupe de pieux", sous: "efficacité et bloc monolithique",
    description: "Coefficient d'efficacité d'un groupe en maille rectangulaire : Converse-Labarre et formule des sols cohérents (F62 annexe G.1), annexe J de la NF P94-262 ; résistance du groupe et dimensions du bloc.",
    champs: [
      ["Groupe", [["B", "Diamètre B", "m", "0.6"], ["d", "Entraxe d", "m", "1.5"], ["m", "Rangées m", "", "3"], ["n", "Pieux par rangée n", "", "4"],
        ["sol", "Sol et mise en œuvre (F62)", "choix", "frottant", [["coherent", "sol cohérent"], ["frottant", "sol frottant, sans refoulement"], ["lache", "sable lâche, refoulement"]]]]],
      ["Pieu isolé et charge", [["Rbd", "Rb;d d'un pieu", "kN", "300"], ["Rsd", "Rs;d d'un pieu", "kN", "900"], ["Qmax", "Qmax F62 d'un pieu (ELU)", "kN", "1150"], ["F", "Charge totale du groupe (ELU)", "kN", "11000"]]],
    ],
    calculer: calculerGroupe,
  },
  {
    id: "lateral", groupe: "Fondations profondes", icone: "⇉", titre: "Effort transversal", sous: "réaction de Ménard, différences finies",
    description: "Pieu sous effort horizontal et moment en tête dans un sol à deux couches : module de réaction de Ménard, palier B·pf*, minoration près de la surface, résolution par différences finies.",
    champs: [
      ["Pieu et chargement", [["B", "Diamètre B", "m", "0.8"], ["L", "Longueur L", "m", "15"], ["E", "Module du béton", "MPa", "30000"],
        ["H", "Effort H en tête", "kN", "150"], ["M", "Moment M en tête", "kN·m", "0"],
        ["tete", "Tête", "choix", "libre", [["libre", "libre"], ["encastree", "encastrée"]]],
        ["duree", "Sollicitation", "choix", "courte", [["courte", "courte durée"], ["longue", "longue durée"]]],
        ["min", "Minoration près de la surface", "choix", "oui", [["non", "non"], ["oui", "oui"], ["simple", "simplifiée (0,5 et 0,7)"]]]]],
      ["Sol", [["h1", "Couche 1 : épaisseur", "m", "4"], ["sol1", "Couche 1 : nature", "choix", "coherent", [["coherent", "cohérente"], ["frottant", "frottante"]]],
        ["EM1", "Couche 1 : EM", "MPa", "8"], ["a1", "Couche 1 : α", "choix", "0.6666666667", OPT_ALPHA], ["pf1", "Couche 1 : pf*", "MPa", "0.5"],
        ["EM2", "Couche 2 : EM", "MPa", "25"], ["a2", "Couche 2 : α", "choix", "0.5", OPT_ALPHA], ["pf2", "Couche 2 : pf*", "MPa", "1.2"]]],
    ],
    calculer: calculerLateral,
  },
  {
    id: "remblai", groupe: "Sols compressibles", icone: "▱", titre: "Remblai sur sol compressible", sous: "tassement, consolidation, étapes, drains",
    description: "Un remblai sur un multicouche compressible : tassement final sous l'axe et hauteur à mettre en œuvre, consolidation dans le temps par différences finies, drains verticaux compris, construction d'un seul jet ou par étapes réglées sur la stabilité à court terme, fluage et tassement résiduel après la mise en service.",
    champs: [
      ["Remblai", [
        ["mode", "La hauteur saisie est", "choix", "finale", [["finale", "la cote finale visée"], ["mise", "la hauteur mise en œuvre"]]],
        ["H", "Hauteur", "m", "4"], ["gamma", "γ du remblai", "kN/m³", "20"],
        ["B", "Largeur en crête", "m", "24"], ["n", "Fruit des talus (H pour 1 V)", "", "2"],
        ["zw", "Nappe sous le terrain naturel", "m", "0.5"],
      ]],
      ["Phasage et stabilité", [
        ["construction", "Construction", "choix", "etapes", [["etapes", "par étapes réglées sur la stabilité"], ["continue", "d'un seul jet"]]],
        ["montee", "Durée de montée d'une étape", "mois", "1"],
        ["Uetape", "Consolidation atteinte entre deux étapes", "%", "70", (v) => v.construction === "etapes"],
        ["F", "Coefficient de sécurité au poinçonnement", "", "1.5"], ["lambdaCu", "λcu = Δcu/Δσ'v", "", "0.25"],
      ]],
      ["Drains verticaux", [
        ["drains", "Drains", "choix", "oui", [["oui", "drains verticaux"], ["non", "sans drains"]]],
        ["esp", "Espacement", "m", "1.6", (v) => v.drains === "oui"],
        ["maille", "Maille", "choix", "triangle", [["triangle", "triangulaire"], ["carre", "carrée"]], (v) => v.drains === "oui"],
        ["dw", "Diamètre équivalent dw", "mm", "66", (v) => v.drains === "oui"],
        ["sm", "Zone remaniée ds/dw", "", "2", (v) => v.drains === "oui"],
        ["kr", "kh/ks (zone remaniée)", "", "2", (v) => v.drains === "oui"],
        ["zd", "Profondeur des drains", "m", "9", (v) => v.drains === "oui"],
      ]],
      ["Service", [
        ["tms", "Mise en service, depuis le début des travaux", "mois", "30"],
        ["duree", "Période de service", "ans", "20"],
        ["sadm", "Tassement résiduel admissible", "mm", "100"],
        ["bas", "Base du profil", "choix", "drainante", [["drainante", "drainante"], ["impermeable", "imperméable"]]],
      ]],
    ],
    couches: {
      colonnes: [["base", "Base (m)", "nombre"], ["nom", "Description", "texte"], ["drainante", "Drainante", "choix", [["non", "non"], ["oui", "oui"]]],
        ["gamma", "γ (kN/m³)", "nombre"], ["e0", "e0", "nombre"], ["Cc", "Cc", "nombre"], ["Cs", "Cs", "nombre"], ["pop", "POP (kPa)", "nombre"],
        ["cv", "cv (m²/an)", "nombre"], ["ch", "ch (m²/an)", "nombre"], ["Cae", "Cαe", "nombre"], ["cu", "cu (kPa)", "nombre"]],
      defaut: [
        { base: "1.5", nom: "croûte argileuse", drainante: "non", gamma: "17.5", e0: "1.1", Cc: "0.35", Cs: "0.05", pop: "60", cv: "3", ch: "5", Cae: "0.008", cu: "35" },
        { base: "9", nom: "argile molle", drainante: "non", gamma: "16", e0: "1.9", Cc: "0.8", Cs: "0.09", pop: "15", cv: "1.2", ch: "2.4", Cae: "0.03", cu: "16" },
        { base: "11", nom: "sable", drainante: "oui", gamma: "20", e0: "", Cc: "", Cs: "", pop: "", cv: "", ch: "", Cae: "", cu: "" },
        { base: "15", nom: "argile raide", drainante: "non", gamma: "19", e0: "0.8", Cc: "0.25", Cs: "0.04", pop: "200", cv: "4", ch: "4", Cae: "0.005", cu: "90" },
      ],
    },
    calculer: calculerRemblai,
    parametrique: {
      aide: "Faire varier l'espacement des drains ou la date de mise en service, les autres données restant celles de la saisie : la courbe donne le rapport du tassement résiduel au tassement admissible, et celui du coefficient de sécurité requis au coefficient obtenu ; sous 1, le critère est tenu.",
      ylabel: "rapport au critère",
      series: [{ ref: "tas", nom: "tassement résiduel / admissible", couleur: COULEURS.f62 }, { ref: "stab", nom: "F requis / F obtenu", couleur: COULEURS.ec7 }],
      variables: [
        { id: "esp", champ: "esp", nom: "Espacement des drains", court: "l'espacement des drains", unite: "m", sens: "max", fixe: { drains: "oui" }, plage: () => [0.8, 4, 0.1] },
        { id: "tms", champ: "tms", nom: "Date de mise en service", court: "la date de mise en service", unite: "mois", plage: (v) => [3, Math.max(36, Math.round(nombre(v.tms, 18) * 2)), 3] },
      ],
      evaluer: (v) => {
        const d = donneesRemblai(v), r = etudierRemblai(d);
        // Une étape réglée sur la stabilité donne F = F requis exactement : l'arrondi ne doit pas la faire échouer.
        const stab = r.stabilite.verifiee && r.stabilite.F > 0 ? d.F / r.stabilite.F : 0;
        return { tas: r.service.residuel / Math.max(d.sAdmissible, 1e-9), stab: stab <= 1 + 1e-9 ? Math.min(stab, 1) : stab };
      },
    },
  },
];

// ─────────────────────────── État et sauvegarde ───────────────────────────
function valeursParDefaut(m) {
  const v = {};
  for (const [, champs] of m.champs) for (const [id, , , def] of champs) v[id] = def;
  if (m.couches) v.couches = m.couches.defaut.map((c) => ({ ...c }));
  return v;
}
function lireEtat() {
  try { const e = JSON.parse(localStorage.getItem(CLE) || "null"); if (e && e.valeurs) return e; } catch { /* stockage indisponible */ }
  return { module: "semelle", valeurs: {} };
}
function ecrireEtat() { try { localStorage.setItem(CLE, JSON.stringify(etat)); } catch { /* navigation privée */ } }

const aujourdhui = () => new Date().toISOString().slice(0, 10);
const PROJET_DEFAUT = () => ({
  affaire: "Étude de fondations", ouvrage: "", lieu: "", auteur: "", verificateur: "", indice: "A", date: aujourdhui(),
  revisions: [{ indice: "A", date: aujourdhui(), objet: "Première émission" }],
});

const etat = lireEtat();
for (const m of MODULES) etat.valeurs[m.id] = { ...valeursParDefaut(m), ...(etat.valeurs[m.id] ?? {}) };
etat.projet = { ...PROJET_DEFAUT(), ...(etat.projet ?? {}) };

function toast(texte) {
  const t = document.getElementById("toast");
  t.textContent = texte; t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2400);
}

// ─────────────────────────── Rendu de la coque ────────────────────────────
/** Coque commune : la barre latérale (projet, puis modules par groupe) et le contenu. */
function coque(actif, contenu) {
  const groupes = [...new Set(MODULES.map((x) => x.groupe))];
  const bouton = (id, icone, titre, sous) => `<button class="software-module${id === actif ? " active" : ""}" data-module="${id}"><span class="module-icon">${icone}</span>
    <span><strong>${esc(titre)}</strong><small>${esc(sous)}</small></span></button>`;
  return `
  <div class="software-shell bureau">
    <aside class="software-sidebar">
      <div class="software-title"><span class="module-icon">⌗</span><div><p>BUREAU DE CALCUL</p><h1>Fondations</h1></div></div>
      <nav><div class="software-group"><p>Projet</p>${bouton("projet", "▤", "Projet et tableau de bord", etat.projet.affaire || "cartouche, indices, état des modules")}</div>
        ${groupes.map((g) => `<div class="software-group"><p>${esc(g)}</p>${MODULES.filter((x) => x.groupe === g).map((x) => bouton(x.id, x.icone, x.titre, x.sous)).join("")}</div>`).join("")}</nav>
      <button class="software-study" id="imprimer">${actif === "projet" ? "Imprimer le tableau de bord" : "Imprimer la note de calcul"}</button>
    </aside>
    <section class="software-main">${contenu}</section>
  </div>`;
}

/** Étapes d'un module : ses groupes de champs, ses couches, ses résultats et sa note. */
const etapesDe = (m) => [
  ...m.champs.map(([titre], i) => ({ titre, cible: `g${i}` })),
  ...(m.couches ? [{ titre: "Couches de sol", cible: "gc" }] : []),
  { titre: "Vérifications", cible: "resultats" }, { titre: "Note de calcul", cible: "note" },
];

function rendre() {
  if (etat.module === "projet") return rendreProjet();
  const m = MODULES.find((x) => x.id === etat.module) ?? MODULES[0];
  const v = etat.valeurs[m.id];
  const etapes = etapesDe(m);
  app.innerHTML = coque(m.id, `
      <div class="software-head"><div><p class="eyebrow">Fascicule 62 titre V · Eurocode 7 · ${esc(etat.projet.affaire)}</p><h2>${esc(m.titre)}</h2><p>${esc(m.description)}</p></div>
        <div class="bureau-actions">
          <button class="ghost" id="exporter">Exporter</button><button class="ghost" id="importer">Importer</button>
          <button class="ghost" id="reinit">Valeurs de départ</button></div></div>
      <nav class="etapes" aria-label="Étapes du calcul">${etapes.map((e, i) => `<button type="button" data-cible="${e.cible}"><span class="num">${i + 1}</span>${esc(e.titre)}<span class="etat" data-etat="${e.cible}"></span></button>`).join("")}</nav>
      <div class="bureau-grid">
        <div class="software-panel bureau-saisie">
          ${m.champs.map(([titre, champs], i) => `<div class="bureau-groupe" id="g${i}"><h3><span class="num">${i + 1}</span>${esc(titre)}</h3><div class="data-grid">
            ${champs.map((c) => champ(c, v)).join("")}</div></div>`).join("")}
          ${m.couches ? `<div class="bureau-groupe" id="gc"><h3><span class="num">${m.champs.length + 1}</span>Couches de sol <small>(profondeur de la base de chaque couche, depuis le terrain après travaux)</small></h3>
            <div class="table-large"><table class="couches-table"><thead><tr>${m.couches.colonnes.map(([, t]) => `<th>${esc(t)}</th>`).join("")}<th></th></tr></thead>
            <tbody>${v.couches.map((c, i) => ligneCouche(m, c, i)).join("")}</tbody></table></div>
            <div class="actions"><button class="ghost" id="ajouterCouche">Ajouter une couche</button></div></div>` : ""}
        </div>
        <div class="software-panel bureau-resultats" id="resultats">
          <div class="software-diagram" id="figure"></div>
          <div id="synthese"></div>
          ${m.parametrique ? blocEtude(m) : ""}
        </div>
      </div>
      <section class="software-panel note-calcul" id="note"></section>`);
  brancher(m);
  calculer(m);
}

// ─────────────────────────── Étude paramétrique ───────────────────────────
function blocEtude(m) {
  const p = m.parametrique, v = etat.valeurs[m.id], x = p.variables[0];
  const [a, b, pas] = x.plage(v);
  return `<details class="etude" id="etude"><summary>Étude paramétrique</summary>
    <p class="method-note">${esc(p.aide)}</p>
    <div class="data-grid">
      <div class="field"><label for="etVar">Variable</label><div class="input-wrap"><select id="etVar">${p.variables.map((y) => `<option value="${y.id}">${esc(y.nom)}</option>`).join("")}</select></div></div>
      <div class="field"><label for="etMin">De</label><div class="input-wrap"><input id="etMin" type="text" inputmode="decimal" value="${a}"><span class="unit" data-unite>${esc(x.unite)}</span></div></div>
      <div class="field"><label for="etMax">À</label><div class="input-wrap"><input id="etMax" type="text" inputmode="decimal" value="${b}"><span class="unit" data-unite>${esc(x.unite)}</span></div></div>
      <div class="field"><label for="etPas">Pas</label><div class="input-wrap"><input id="etPas" type="text" inputmode="decimal" value="${pas}"><span class="unit" data-unite>${esc(x.unite)}</span></div></div>
    </div>
    <div class="actions"><button class="primary" id="etLancer">Tracer</button></div>
    <div class="software-diagram" id="etFig"></div>
    <p class="final-result" id="etOut" hidden></p>
  </details>`;
}

function lancerEtude(m) {
  const p = m.parametrique, v = etat.valeurs[m.id];
  const x = p.variables.find((y) => y.id === app.querySelector("#etVar").value) ?? p.variables[0];
  const min = nombre(app.querySelector("#etMin").value), max = nombre(app.querySelector("#etMax").value), pas = nombre(app.querySelector("#etPas").value);
  const sortie = app.querySelector("#etOut");
  sortie.hidden = false;
  if (!(max > min && pas > 0)) { sortie.innerHTML = "Renseigner une plage croissante et un pas positif."; return; }
  const refs = p.series ?? [{ ref: "F62", nom: "Fascicule 62", couleur: COULEURS.f62 }, { ref: "EC7", nom: m.id === "pieu" ? "NF P94-262" : "NF P94-261", couleur: COULEURS.ec7 }];
  const { points, minimal, maximal } = balayage((val) => p.evaluer({ ...v, ...(x.fixe ?? {}), [x.champ]: String(val) }), min, max, pas, refs.map((r) => r.ref));
  const retenu = x.sens === "max" ? maximal : minimal;
  const fini = points.flatMap((q) => refs.map((r) => q[r.ref])).filter(Number.isFinite);
  const yMax = Math.min(3, Math.max(1.4, ...fini) * 1.08);
  const courbe = (ref) => points.filter((q) => Number.isFinite(q[ref])).map((q) => [q.x, Math.min(q[ref], yMax)]);
  const actuel = nombre(v[x.champ]);
  app.querySelector("#etFig").innerHTML = graphe({
    largeur: 560, hauteur: 290, xmin: min, xmax: max, ymin: 0, ymax: yMax, xlabel: `${x.nom} (${x.unite})`, ylabel: p.ylabel ?? "taux de travail maximal",
    zones: [{ x0: min, x1: max, y0: 1, y1: yMax, couleur: COULEURS.rouge, opacite: 0.06, libelle: "non vérifié", position: "droite" }],
    series: [
      ...refs.map((r) => ({ points: courbe(r.ref), couleur: r.couleur, epaisseur: 2.4, libelle: p.series ? r.nom : r.ref === "F62" ? "Fascicule 62" : "NF P94-261/262" })),
      { points: [[min, 1], [max, 1]], couleur: COULEURS.rouge, tirets: "6 4", epaisseur: 1.4, libelle: p.series ? "rapport = 1" : "taux = 1" },
    ],
    marques: [...refs].reverse().filter((r) => retenu[r.ref] !== null).map((r) => ({ x: retenu[r.ref], y: 1, couleur: r.couleur, guides: true })),
    textes: Number.isFinite(actuel) && actuel >= min && actuel <= max ? [{ x: actuel, y: yMax * 0.92, texte: "valeur du projet", couleur: COULEURS.discret }] : [],
  });
  const dire = (ref, nom) => (retenu[ref] === null ? `${nom} : aucune valeur de la plage ne convient`
    : x.sens === "max" ? (retenu[ref] >= max - 1e-9 ? `${nom} : tenu sur toute la plage, jusqu'à ${fd(max, 2)} ${x.unite}` : `${nom} : ${fd(retenu[ref], 2)} ${x.unite}`)
      : retenu[ref] <= min + 1e-9 ? `${nom} : tout est vérifié dès ${fd(min, 2)} ${x.unite}, début de la plage`
        : `${nom} : ${fd(retenu[ref], 2)} ${x.unite}`);
  sortie.innerHTML = p.series
    ? `${x.sens === "max" ? "Plus grande" : "Plus petite"} valeur de ${esc(x.court)} qui tient chaque critère —
      ${p.series.map((r) => `<strong>${dire(r.ref, r.nom)}</strong>`).join(" · ")}
      <small>Rapports aux critères du module ; les autres données sont celles de la saisie.</small>`
    : `Plus petite valeur de ${esc(x.court)} qui satisfait toutes les vérifications —
      <strong>${dire("EC7", m.id === "pieu" ? "NF P94-262" : "NF P94-261")}</strong> · <strong>${dire("F62", "Fascicule 62")}</strong>
      <small>Taux de travail maximal de chaque référentiel sur l'ensemble des vérifications et des combinaisons ; les autres données sont celles de la saisie.</small>`;
}

// ─────────────────────────── Projet et tableau de bord ────────────────────
function cartouche(titre) {
  const p = etat.projet;
  return `<table class="cartouche"><tbody>
    <tr><th>Affaire</th><td colspan="3">${esc(p.affaire || "—")}</td><th>Indice</th><td>${esc(p.indice || "—")}</td></tr>
    <tr><th>Ouvrage</th><td colspan="3">${esc(p.ouvrage || "—")}${p.lieu ? ` · ${esc(p.lieu)}` : ""}</td><th>Date</th><td>${esc(dateFr(p.date))}</td></tr>
    <tr><th>Élément</th><td>${esc(titre)}</td><th>Établi par</th><td>${esc(p.auteur || "—")}</td><th>Vérifié par</th><td>${esc(p.verificateur || "—")}</td></tr>
  </tbody></table>`;
}
const dateFr = (iso) => { const d = new Date(`${iso}T12:00:00`); return Number.isNaN(d.getTime()) ? String(iso ?? "") : d.toLocaleDateString("fr-FR"); };
const historique = () => `<h3>Historique des indices</h3><table class="resultats"><thead><tr><th>Indice</th><th>Date</th><th>Objet</th></tr></thead><tbody>
  ${etat.projet.revisions.map((r) => `<tr><td>${esc(r.indice)}</td><td>${esc(dateFr(r.date))}</td><td class="motif">${esc(r.objet)}</td></tr>`).join("")}</tbody></table>`;

/** État de chaque module, calculé sur ses données du moment. */
function tableauDeBord() {
  return MODULES.map((m, i) => {
    let r = null, motif = "";
    try { r = m.calculer(etat.valeurs[m.id]); } catch (e) { motif = e.message; }
    const verdict = r ? r.verdict : false;
    const etat_ = r === null ? `<span class="verdict ko">✕ calcul impossible</span> <small>${esc(motif)}</small>`
      : verdict === true ? `<span class="verdict ok">✓ vérifié</span>` : verdict === false ? `<span class="verdict ko">✕ non vérifié</span>`
        : `<span class="verdict na">${esc(r.etat ?? "calcul sans vérification")}</span>`;
    const taux = r?.taux ? `${Number.isFinite(r.taux.F62) ? fd(r.taux.F62, 2) : "—"} · ${Number.isFinite(r.taux.EC7) ? fd(r.taux.EC7, 2) : "—"}` : "—";
    return `<tr><td>${i + 1}</td><td><strong>${esc(m.titre)}</strong><small>${esc(m.groupe)}</small></td><td>${etat_}</td><td class="n">${taux}</td>
      <td><button class="ghost" data-module="${m.id}">Ouvrir</button></td></tr>`;
  }).join("");
}

function rendreProjet() {
  const p = etat.projet;
  const champP = (id, label, type = "text") => `<div class="field"><label for="pj_${id}">${esc(label)}</label><div class="input-wrap">
    <input id="pj_${id}" data-projet="${id}" type="${type}" value="${esc(p[id] ?? "")}"></div></div>`;
  app.innerHTML = coque("projet", `
      <div class="software-head"><div><p class="eyebrow">Projet</p><h2>${esc(p.affaire || "Projet")}</h2>
        <p>Le cartouche figure en tête de chaque note de calcul. Le tableau de bord recalcule chaque module sur ses données et en donne l'état ;
           le projet entier, cartouche compris, s'enregistre dans un seul fichier.</p></div>
        <div class="bureau-actions">
          <button class="ghost" id="projEnregistrer">Enregistrer le projet</button><button class="ghost" id="projOuvrir">Ouvrir un projet</button>
          <button class="ghost" id="projNouveau">Nouveau projet</button></div></div>
      <div class="bureau-grid">
        <div class="software-panel bureau-saisie">
          <div class="bureau-groupe"><h3><span class="num">1</span>Cartouche</h3><div class="data-grid">
            ${champP("affaire", "Affaire")}${champP("ouvrage", "Ouvrage, élément")}${champP("lieu", "Lieu")}${champP("indice", "Indice")}
            ${champP("auteur", "Établi par")}${champP("verificateur", "Vérifié par")}${champP("date", "Date", "date")}</div></div>
          <div class="bureau-groupe"><h3><span class="num">2</span>Indices de révision</h3>
            <div class="table-large"><table class="couches-table"><thead><tr><th>Indice</th><th>Date</th><th>Objet</th><th></th></tr></thead><tbody>
              ${p.revisions.map((r, i) => `<tr><td><input data-rev="${i}" data-col="indice" value="${esc(r.indice)}" style="width:4em" aria-label="Indice ${i + 1}"></td>
                <td><input data-rev="${i}" data-col="date" type="date" value="${esc(r.date)}" aria-label="Date de l'indice ${i + 1}"></td>
                <td><input data-rev="${i}" data-col="objet" value="${esc(r.objet)}" style="width:16em" aria-label="Objet de l'indice ${i + 1}"></td>
                <td><button data-suppr-rev="${i}" title="Supprimer l'indice" aria-label="Supprimer l'indice ${i + 1}">✕</button></td></tr>`).join("")}
            </tbody></table></div>
            <div class="actions"><button class="ghost" id="ajouterRev">Nouvel indice</button></div></div>
        </div>
        <div class="software-panel bureau-resultats">
          <h3>Tableau de bord</h3>
          <div class="table-large"><table class="resultats tableau-bord"><thead><tr><th>n°</th><th>Module</th><th>État</th><th class="num">Taux max F62 · EC7</th><th></th></tr></thead>
            <tbody>${tableauDeBord()}</tbody></table></div>
          <p class="method-note">Le taux de travail est le plus grand rapport action / résistance de toutes les vérifications et combinaisons du module.
             « Valeurs de départ » d'un module rétablit l'exemple du cours.</p>
          ${cartouche("dossier de calcul")}
        </div>
      </div>`);
  app.querySelectorAll("[data-module]").forEach((b) => b.addEventListener("click", () => { etat.module = b.dataset.module; ecrireEtat(); rendre(); }));
  app.querySelectorAll("[data-projet]").forEach((e) => e.addEventListener("input", () => { p[e.dataset.projet] = e.value; ecrireEtat(); }));
  app.querySelectorAll("[data-projet]").forEach((e) => e.addEventListener("change", () => rendreProjet()));
  app.querySelectorAll("[data-rev]").forEach((e) => e.addEventListener("input", () => { p.revisions[Number(e.dataset.rev)][e.dataset.col] = e.value; ecrireEtat(); }));
  app.querySelectorAll("[data-suppr-rev]").forEach((b) => b.addEventListener("click", () => {
    if (p.revisions.length <= 1) return toast("Il faut au moins un indice.");
    p.revisions.splice(Number(b.dataset.supprRev), 1); ecrireEtat(); rendreProjet();
  }));
  app.querySelector("#ajouterRev").addEventListener("click", () => {
    const der = p.revisions[p.revisions.length - 1];
    const suivant = /^[A-Y]$/.test(der.indice) ? String.fromCharCode(der.indice.charCodeAt(0) + 1) : `${der.indice}+`;
    p.revisions.push({ indice: suivant, date: aujourdhui(), objet: "" });
    p.indice = suivant; ecrireEtat(); rendreProjet();
  });
  app.querySelector("#imprimer").addEventListener("click", () => window.print());
  app.querySelector("#projEnregistrer").addEventListener("click", enregistrerProjet);
  app.querySelector("#projOuvrir").addEventListener("click", () => document.getElementById("fichierImport").click());
  app.querySelector("#projNouveau").addEventListener("click", () => {
    if (!confirm("Commencer un nouveau projet ? Les données de tous les modules reviennent aux valeurs de départ.")) return;
    for (const m of MODULES) etat.valeurs[m.id] = valeursParDefaut(m);
    etat.projet = PROJET_DEFAUT(); ecrireEtat(); rendreProjet(); toast("Nouveau projet.");
  });
}

function enregistrerProjet() {
  const contenu = { format: "fondations-projet", version: 1, date: new Date().toISOString(), projet: etat.projet, module: etat.module, valeurs: etat.valeurs };
  const blob = new Blob([JSON.stringify(contenu, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  const nom = (etat.projet.affaire || "projet").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  a.href = URL.createObjectURL(blob); a.download = `fondations-${nom || "projet"}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function champ([id, label, unite, , options, visible], v) {
  // Pour un champ numérique, la fonction de visibilité occupe la place des options.
  if (typeof options === "function") { visible = options; options = null; }
  const cache = visible && !visible(v) ? ' style="display:none"' : "";
  if (unite === "texte") {
    return `<div class="field champ-large"${cache}><label for="c_${id}">${esc(label)}</label>
      <textarea id="c_${id}" data-champ="${id}" rows="${String(v[id] ?? "").split("\n").length > 12 ? 10 : 5}" spellcheck="false">${esc(v[id])}</textarea></div>`;
  }
  if (unite === "choix") {
    return `<div class="field"${cache}><label for="c_${id}">${esc(label)}</label><div class="input-wrap"><select id="c_${id}" data-champ="${id}">
      ${options.map(([val, t]) => `<option value="${esc(val)}"${String(v[id]) === String(val) ? " selected" : ""}>${esc(t)}</option>`).join("")}</select></div></div>`;
  }
  return `<div class="field"${cache}><label for="c_${id}">${esc(label)}</label><div class="input-wrap">
    <input id="c_${id}" data-champ="${id}" type="text" inputmode="decimal" value="${esc(v[id])}">${unite ? `<span class="unit">${esc(unite)}</span>` : ""}</div></div>`;
}

function ligneCouche(m, c, i) {
  return `<tr>${m.couches.colonnes.map(([id, t, type, options]) => type === "choix"
    ? `<td><select data-couche="${i}" data-col="${id}" aria-label="${esc(t)}, couche ${i + 1}">${options.map(([val, txt]) => `<option value="${esc(val)}"${c[id] === val ? " selected" : ""}>${esc(txt)}</option>`).join("")}</select></td>`
    : type === "texte"
      ? `<td><input data-couche="${i}" data-col="${id}" type="text" value="${esc(c[id] ?? "")}" style="width:11em" aria-label="${esc(t)}, couche ${i + 1}"></td>`
      : `<td><input data-couche="${i}" data-col="${id}" type="text" inputmode="decimal" value="${esc(c[id] ?? "")}" style="width:4.8em" aria-label="${esc(t)}, couche ${i + 1}"></td>`).join("")}
    <td><button data-suppr="${i}" title="Supprimer la couche" aria-label="Supprimer la couche ${i + 1}">✕</button></td></tr>`;
}

let minuteur = null;
function brancher(m) {
  const v = etat.valeurs[m.id];
  app.querySelectorAll("[data-module]").forEach((b) => b.addEventListener("click", () => { etat.module = b.dataset.module; ecrireEtat(); rendre(); }));
  const maj = () => { clearTimeout(minuteur); minuteur = setTimeout(() => { ecrireEtat(); calculer(m); }, 150); };
  app.querySelectorAll("[data-champ]").forEach((e) => {
    const evt = e.tagName === "SELECT" ? "change" : "input";
    e.addEventListener(evt, () => {
      v[e.dataset.champ] = e.value;
      // Un choix peut montrer ou cacher d'autres champs : on redessine.
      if (e.tagName === "SELECT") { ecrireEtat(); rendre(); } else maj();
    });
  });
  app.querySelectorAll("[data-couche]").forEach((e) => {
    e.addEventListener(e.tagName === "SELECT" ? "change" : "input", () => { v.couches[Number(e.dataset.couche)][e.dataset.col] = e.value; maj(); });
  });
  app.querySelectorAll("[data-suppr]").forEach((b) => b.addEventListener("click", () => {
    if (v.couches.length <= 1) return toast("Il faut au moins une couche.");
    v.couches.splice(Number(b.dataset.suppr), 1); ecrireEtat(); rendre();
  }));
  const ajout = app.querySelector("#ajouterCouche");
  if (ajout) ajout.addEventListener("click", () => {
    const der = v.couches[v.couches.length - 1];
    v.couches.push({ ...der, base: String(nombre(der.base, 0) + 5) }); ecrireEtat(); rendre();
  });
  app.querySelector("#imprimer").addEventListener("click", () => window.print());
  app.querySelector("#reinit").addEventListener("click", () => { etat.valeurs[m.id] = valeursParDefaut(m); ecrireEtat(); rendre(); toast("Valeurs de départ rétablies."); });
  app.querySelector("#exporter").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ module: m.id, valeurs: etat.valeurs[m.id], date: new Date().toISOString() }, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `fondations-${m.id}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  app.querySelector("#importer").addEventListener("click", () => document.getElementById("fichierImport").click());
  app.querySelectorAll(".etapes [data-cible]").forEach((b) => b.addEventListener("click", () => {
    const cible = document.getElementById(b.dataset.cible);
    if (!cible) return;
    if (cible.tagName === "DETAILS") cible.open = true;
    cible.scrollIntoView({ behavior: "smooth", block: "start" });
  }));
  if (m.parametrique) {
    const choix = app.querySelector("#etVar");
    choix.addEventListener("change", () => {
      const x = m.parametrique.variables.find((y) => y.id === choix.value);
      const [a, b, pas] = x.plage(v);
      app.querySelector("#etMin").value = a; app.querySelector("#etMax").value = b; app.querySelector("#etPas").value = pas;
      app.querySelectorAll("[data-unite]").forEach((u) => { u.textContent = x.unite; });
    });
    app.querySelector("#etLancer").addEventListener("click", () => lancerEtude(m));
  }
}

document.getElementById("fichierImport").addEventListener("change", async (e) => {
  const fichier = e.target.files[0];
  e.target.value = "";
  if (!fichier) return;
  try {
    const d = JSON.parse(await fichier.text());
    if (d.format === "fondations-projet") {
      // Projet complet : cartouche, indices et données de tous les modules.
      for (const m of MODULES) etat.valeurs[m.id] = { ...valeursParDefaut(m), ...(d.valeurs?.[m.id] ?? {}) };
      etat.projet = { ...PROJET_DEFAUT(), ...(d.projet ?? {}) };
      etat.module = "projet";
      ecrireEtat(); rendre(); toast(`Projet « ${etat.projet.affaire} » ouvert.`);
      return;
    }
    const m = MODULES.find((x) => x.id === d.module);
    if (!m || typeof d.valeurs !== "object") throw new Error("fichier sans module reconnu");
    etat.module = m.id;
    etat.valeurs[m.id] = { ...valeursParDefaut(m), ...d.valeurs };
    ecrireEtat(); rendre(); toast(`Module « ${m.titre} » importé.`);
  } catch (err) { toast(`Import impossible : ${err.message}`); }
});

function calculer(m) {
  const v = etat.valeurs[m.id];
  const zones = { figure: app.querySelector("#figure"), synthese: app.querySelector("#synthese"), note: app.querySelector("#note") };
  const marquer = (cible, classe, texte) => {
    const e = app.querySelector(`.etapes [data-etat="${cible}"]`);
    if (!e) return;
    e.className = `etat ${classe}`; e.textContent = texte;
  };
  // Le recalcul redessine la note : les essais dépliés le restent.
  const ouverts = new Set([...app.querySelectorAll("details[open][data-cle]")].map((d) => d.dataset.cle));
  try {
    const r = m.calculer(v);
    zones.figure.innerHTML = r.figure ?? "";
    zones.synthese.innerHTML = r.synthese;
    zones.note.innerHTML = `${cartouche(m.titre)}<h2>Note de calcul — ${esc(m.titre)}</h2>
      <p class="method-note">Établie le ${new Date().toLocaleDateString("fr-FR")} avec le bureau de calcul du cours « Fondations des ouvrages ». Les valeurs sont celles de la saisie.</p>
      ${r.note}${historique()}`;
    app.querySelectorAll("details[data-cle]").forEach((d) => { if (ouverts.has(d.dataset.cle)) d.open = true; });
    for (const e of etapesDe(m)) marquer(e.cible, "ok", "✓");
    if (r.verdict === false) marquer("resultats", "ko", "✕");
    else if (r.verdict !== true) marquer("resultats", "na", "·");
    app.querySelectorAll("[data-envoyer]").forEach((b) => b.addEventListener("click", () => envoyerSondage(v, b.dataset.envoyer)));
    brancherPlages(m, v);
  } catch (e) {
    console.error(e);
    zones.figure.innerHTML = "";
    zones.synthese.innerHTML = `<p class="final-result bureau-verdict ko">Calcul impossible : ${esc(e.message)}</p>`;
    zones.note.innerHTML = "";
    for (const x of etapesDe(m)) marquer(x.cible, "na", "");
    marquer(/couche|essai/.test(e.message) && m.couches ? "gc" : "resultats", "ko", "!");
    marquer("note", "na", "—");
  }
}

/**
 * Plage pseudo-élastique choisie par l'opérateur, essai par essai : elle est
 * rangée dans les données du module (donc dans le projet enregistré), puis
 * tout est recalculé ; la vue et le focus restent où ils étaient.
 */
function brancherPlages(m, v) {
  app.querySelectorAll(".plage-choix").forEach((bloc) => {
    const cle = bloc.dataset.cleEssai, s1 = bloc.querySelector('[data-plage="i1"]'), s2 = bloc.querySelector('[data-plage="i2"]');
    const dernier = s2.options.length; // indice du dernier palier
    const recalculer = (focus) => {
      const y = window.scrollY;
      ecrireEtat(); calculer(m);
      window.scrollTo(0, y);
      app.querySelector(`.plage-choix[data-cle-essai="${cle}"] ${focus}`)?.focus();
    };
    const appliquer = (quel) => {
      let i1 = Number(s1.value), i2 = Number(s2.value);
      // Au moins deux paliers : on décale l'autre borne si besoin (le contrôle qualité en réclame trois).
      if (i2 <= i1) { if (quel === "i1") i2 = Math.min(i1 + 2, dernier); else i1 = Math.max(i2 - 2, 0); }
      v.plages = { ...(v.plages ?? {}), [cle]: { i1, i2 } };
      recalculer(`[data-plage="${quel}"]`);
    };
    s1.addEventListener("change", () => appliquer("i1"));
    s2.addEventListener("change", () => appliquer("i2"));
    bloc.querySelector("[data-plage-auto]")?.addEventListener("click", () => {
      if (v.plages) delete v.plages[cle];
      recalculer('[data-plage="i1"]');
    });
  });
}

// ─────────────────────── Du sondage aux couches de calcul ─────────────────
/** Envoie le sondage dépouillé vers la semelle ou le pieu : couches, pl*, EM, classes proposées. */
function envoyerSondage(v, cible) {
  const { couches, res } = depouillerSondage(v);
  const essais = res.filter((e) => e.r.applicable).map((e) => ({ z: e.z, plNette: e.r.plNette, EM: e.r.EM }));
  const lignes = couchesDepuisSondage(couches, essais);
  const t = etat.valeurs[cible];
  const txt = (x, d) => x.toFixed(d);
  t.couches = lignes.map((c) => (cible === "semelle"
    ? { base: String(c.z1), classe: c.classe, categorie: c.categorie, gamma: String(c.gamma), gammaSat: String(c.gammaSat), pl: txt(c.pl, 2), EM: txt(c.EM, 1) }
    : { base: String(c.z1), classe: c.classe, categorie: c.categorie, pl: txt(c.pl, 2), qc: "", EM: txt(c.EM, 1) }));
  if (cible === "semelle" && v.zw !== undefined) t.zw = v.zw;
  if (cible === "pieu" && t.methode !== "pressio") t.methode = "pressio";
  etat.module = cible; ecrireEtat(); rendre();
  const estimees = lignes.filter((c) => c.estimee).length;
  toast(`${lignes.length} couches importées : pl* moyenne géométrique, EM moyenne harmonique${estimees ? ` (${estimees} sans essai, à vérifier)` : ""}.`);
}

/** « argile A · pl* 0,70 » : assez court pour ne pas chevaucher la fondation. */
const etiquetteCourte = (c) => `${c.classe.replace("-", " ")}${Number.isFinite(c.pl) ? ` · pl* ${fd(c.pl, 2)}` : ""}`;

// ─────────────────────────── Lecture des couches ──────────────────────────
function couchesDe(v, cles) {
  const res = [];
  let z = 0;
  for (const c of v.couches) {
    const base = nombre(c.base);
    if (!(base > z)) continue;
    const x = { z0: z, z1: base, classe: c.classe, categorie: c.categorie };
    for (const k of cles) x[k] = nombre(c[k]);
    res.push(x);
    z = base;
  }
  if (!res.length) throw new Error("aucune couche valide : les bases doivent croître");
  return res;
}

// ─────────────────────────── Calculs des modules ──────────────────────────
function donneesSemelle(v) {
  const couches = couchesDe(v, ["gamma", "gammaSat", "pl", "EM"]).map((c) => ({ ...c, gammaSat: Number.isFinite(c.gammaSat) ? c.gammaSat : c.gamma }));
  if (couches.some((c) => !(c.gamma > 0 && c.pl > 0))) throw new Error("renseigner γ et pl* dans chaque couche");
  return {
    forme: v.forme, B: nombre(v.B), L: nombre(v.L), D: nombre(v.D), h: nombre(v.h), zw: nombre(v.zw, Infinity),
    comportement: v.comportement, phi: nombre(v.phi, 30), phiCrit: nombre(v.phiCrit, 30), c: nombre(v.c, 0), cu: nombre(v.cu, 0),
    prefabrique: v.prefabrique === "oui", alpha: nombre(v.alpha, 0.5), couches,
    G: { V: nombre(v.GV, 0), H: nombre(v.GH, 0), M: nombre(v.GM, 0) }, Q: { V: nombre(v.QV, 0), H: nombre(v.QH, 0), M: nombre(v.QM, 0) },
    psi: { psi0: nombre(v.psi0, 0.7), psi1: nombre(v.psi1, 0.5), psi2: nombre(v.psi2, 0.3) },
  };
}

function calculerSemelle(v) {
  const d = donneesSemelle(v), couches = d.couches;
  const r = justifierSemelle(d);
  const elu = r.etats.EC7.find((x) => x.cle === "ELU");
  const figure = coupeSemelle({
    B: d.B, D: d.D, e: Math.min(elu.e, d.B / 2), V: "Vd", H: elu.H, epaisseur: d.h, zNappe: Number.isFinite(d.zw) ? d.zw : null,
    hauteur: 300, profondeurVue: d.D + 2 * d.B, montrerHr: 1.5 * d.B,
    couches: couches.map((c) => ({ z0: c.z0, z1: c.z1, sol: c.classe, etiquette: c.z0 >= d.D - 1e-9 ? etiquetteCourte(c) : null })),
  });
  return { figure, ...noteSemelle(r, d), verdict: r.verdict, taux: tauxMaximaux(r.synthese) };
}

function donneesPieu(v) {
  const [type, cat] = String(v.type).split("|");
  const couches = couchesDe(v, ["pl", "qc", "EM"]);
  const d = {
    type, cat: Number(cat), B: nombre(v.B), D: nombre(v.D), forme: v.forme, methode: v.methode, zf: nombre(v.zf, 0), couches,
    procedure: v.procedure, N: Math.max(1, Math.round(nombre(v.N, 1))), S: nombre(v.S, 100), raide: v.raide === "oui",
    G: nombre(v.G, 0), Q: nombre(v.Q, 0), psi2: nombre(v.psi2, 0.3), Fn: nombre(v.Fn, 0), Ep: nombre(v.Ep, 20000),
  };
  const cle = d.methode === "pressio" ? "pl" : "qc";
  if (couches.some((c) => !(c[cle] > 0))) throw new Error(`renseigner ${cle === "pl" ? "pl*" : "qc"} dans chaque couche`);
  return d;
}

/** Vérifications d'un pieu au format commun { ref, taux, ok }, portances inapplicables comprises. */
const verifsPieu = (r) => [...r.verifs, ...(r.F62.applicable ? [] : [{ ref: "F62", taux: NaN, ok: false }]), ...(r.EC7.applicable ? [] : [{ ref: "EC7", taux: NaN, ok: false }])];

function calculerPieu(v) {
  const d = donneesPieu(v), couches = d.couches;
  const r = justifierPieu(d);
  const qs = r.EC7.applicable ? r.EC7.lignes : r.F62.applicable ? r.F62.lignes : [];
  const figure = coupePieu({
    B: d.B, D: d.D, hauteur: 360, zMax: Math.min(couches[couches.length - 1].z1, d.D + 4),
    couches: couches.map((c) => ({ z0: c.z0, z1: c.z1, sol: c.classe, etiquette: etiquetteCourte(c) })),
    zones: d.zf > 0 ? [{ z0: 0, z1: d.zf, couleur: COULEURS.rouge, libelle: "sans frottement" }] : [],
    profil: qs.length ? { libelle: `qs ${r.EC7.applicable ? "NF P94-262" : "F62"}`, unite: "kPa", valeurs: qs.map((l) => ({ z0: l.z0, z1: l.z1, v: l.qs })), etiquettes: true } : null,
  });
  const verifs = verifsPieu(r);
  return { figure, ...notePieu(r, d), verdict: verifs.every((x) => x.ok), taux: tauxMaximaux(verifs) };
}

function calculerFrottement(v) {
  const B = nombre(v.B), H = nombre(v.H), g = nombre(v.gamma), h2 = nombre(v.h2, Infinity), hr = Math.max(nombre(v.hr, 0), 0), gr = nombre(v.gr, 20);
  const d = nombre(v.d), files = Math.max(1, Math.round(nombre(v.files, 1)));
  if (!(B > 0 && H > 0 && g > 0)) throw new Error("renseigner B, l'épaisseur et γ' de la couche compressible");
  const Kt = K_TAN_DELTA[v.nature][v.mise], KtR = K_TAN_DELTA[v.natR][v.mise];
  const remblai = hr > 0 ? { h: hr, gamma: gr } : null;
  const couches = [{ z0: 0, z1: H, gamma: g, Kt }];
  const iso = frottementNegatif({ R: B / 2, remblai, couches, h2, KtRemblai: KtR });
  const b = d > B ? rayonInfluence(files > 1 ? { d, dPrime: d } : { d }) : null;
  const grp = b ? frottementNegatif({ R: B / 2, remblai, couches, h2, KtRemblai: KtR, b }) : null;
  const rep = grp ? repartitionGroupe({ FnIsole: iso.Fn, FnGroupe: grp.Fn, files }) : null;
  const lam = lambdaCombarieu(Kt), mu = muIsole(lam);
  const G = nombre(v.G, 0), Q = nombre(v.Q, 0), psi2 = nombre(v.psi2, 0.3);
  const Fdim = rep ? (files > 1 ? rep.angle : rep.extremite) : iso.Fn;
  const c = combinaisonsPieu({ G, Q, psi2, Fn: Fdim });
  const xmax = remblai ? Math.max(...iso.profil.map((p) => p.s1)) * 1.1 : g * H * 1.1;
  // Sans remblai, σ'v reste égal à σ'v0 : un seul profil, pas de hauteur d'action.
  const figure = !remblai ? graphe({
    largeur: 560, hauteur: 280, xmin: 0, xmax, ymin: 0, ymax: H, inverserY: true, xlabel: "contrainte verticale effective (kPa)", ylabel: "profondeur sous le TN (m)",
    zones: [{ x0: 0, x1: xmax, y0: 0, y1: H, couleur: "#dccab0", opacite: 0.35, libelle: "couche compressible, sans remblai", position: "droite" }],
    series: [{ points: [[0, 0], [g * H, H]], couleur: COULEURS.bleu, libelle: "σ'v = σ'v0 : pas de surcharge, pas de frottement négatif" }],
  }) : graphe({
    largeur: 560, hauteur: 320, xmin: 0, xmax, ymin: -hr, ymax: H, inverserY: true, xlabel: "contrainte verticale effective (kPa)", ylabel: "profondeur sous le TN (m)",
    zones: [...(hr > 0 ? [{ x0: 0, x1: xmax, y0: -hr, y1: 0, couleur: "#eadfd2", opacite: 0.6, libelle: "remblai", position: "droite" }] : []),
      { x0: 0, x1: xmax, y0: 0, y1: H, couleur: "#dccab0", opacite: 0.35, libelle: "couche compressible", position: "droite" }],
    series: [
      { points: iso.profil.map((p) => [p.s1, p.z]), couleur: COULEURS.discret, tirets: "5 4", libelle: "σ'1 champ libre" },
      { points: iso.profil.map((p) => [p.sv, p.z]), couleur: COULEURS.effort, epaisseur: 2.8, libelle: "σ'v au contact, pieu isolé" },
      ...(grp ? [{ points: grp.profil.map((p) => [p.sv, p.z]), couleur: COULEURS.violet, libelle: "σ'v au contact, pieu en groupe" }] : []),
      ...(iso.hAction > 0 && iso.hAction < H - 1e-6 ? [{ points: [[0, iso.hAction], [xmax, iso.hAction]], couleur: COULEURS.rouge, tirets: "2 3", epaisseur: 1.6, libelle: `hauteur d'action h = ${fd(iso.hAction, 2)} m` }] : []),
    ],
  });
  const synthese = `<table class="resultats"><thead><tr><th>Grandeur</th><th class="num">Valeur</th></tr></thead><tbody>
      <tr><td>K tanδ · λ · μ</td><td class="n">${fd(Kt, 2)} · ${fd(lam, 3)} · ${fd(mu, 4)}</td></tr>
      <tr><td>Hauteur d'action</td><td class="n">${fd(iso.hAction, 2)} m</td></tr>
      <tr><td><strong>F<sub>n</sub>, pieu isolé</strong></td><td class="n"><strong>${f(iso.Fn, 4)} kN</strong></td></tr>
      ${grp ? `<tr><td>F<sub>n</sub>, groupe illimité (b = ${fd(b, 2)} m)</td><td class="n">${f(grp.Fn, 4)} kN</td></tr>
      <tr><td>${files > 1 ? "Angle · bord · intérieur" : "Extrémité · courant"}</td><td class="n">${files > 1 ? `${f(rep.angle, 4)} · ${f(rep.bord, 4)} · ${f(rep.interieur, 4)}` : `${f(rep.extremite, 4)} · ${f(rep.courant, 4)}`} kN</td></tr>` : ""}
      <tr><td>F<sub>d</sub> ELU (pieu le plus chargé)</td><td class="n">${f(c.ELU, 5)} kN</td></tr>
    </tbody></table>`;
  const note = `
    <h3>1 · Données</h3>
    <p>Pieu ${esc(v.mise)} de diamètre ${fd(B, 2)} m ; couche compressible « ${esc(K_TAN_DELTA[v.nature].nom)} » de ${fd(H, 2)} m (γ' = ${f(g, 3)} kN/m³) ;
       ${hr > 0 ? `remblai de ${fd(hr, 2)} m (γ = ${f(gr, 3)} kN/m³, K tanδ = ${fd(KtR, 2)})` : "pas de remblai traversé"} ; ${Number.isFinite(h2) ? `h2 = ${fd(h2, 2)} m` : "h2 non limitant"}.</p>
    <h3>2 · Méthode de Combarieu</h3>
    <p class="formula">λ = ${Kt <= 0.15 ? "1/(0,5 + 25 K tanδ)" : Kt <= 0.385 ? "0,385 − K tanδ" : "0"} = ${fd(lam, 3)} · μ = λ²/(1 + λ) = ${fd(mu, 4)}${mu > 0 ? ` · L<sub>0</sub> = R/(μ K tanδ) = ${fd(B / 2 / (mu * Kt), 1)} m` : ""}</p>
    <p>σ'<sub>v</sub>(z) au contact du pieu est calculée de proche en proche ; la hauteur d'action vaut ${fd(iso.hAction, 2)} m
       ${iso.h1 !== null ? `(h1 = ${fd(iso.h1, 2)} m, où σ'v redescend à σ'v0)` : "(σ'v ne redescend pas à σ'v0 dans la couche)"}.</p>
    <p class="formula">F<sub>n</sub> = P ∫ K tanδ σ'<sub>v</sub> dz = ${f(iso.Fn, 4)} kN (sans accrochage : ${f(iso.FnMax, 4)} kN)</p>
    ${grp ? `<h3>3 · Pieu au sein du groupe</h3>
      <p>Rayon d'influence b = ${files > 1 ? "√(d d'/π)" : "d/√π"} = ${fd(b, 3)} m ; F<sub>n</sub>(b) = ${f(grp.Fn, 4)} kN (borne π b² q = ${f(Math.PI * b * b * (hr * gr), 4)} kN).
         Répartition empirique (F62 G.2 § 3.1 ; NF P94-262 H.3.1) : ${files > 1 ? `pieu d'angle ${f(rep.angle, 4)} kN, de bord ${f(rep.bord, 4)} kN, intérieur ${f(rep.interieur, 4)} kN` : `pieu d'extrémité ${f(rep.extremite, 4)} kN, courant ${f(rep.courant, 4)} kN`}.</p>` : ""}
    <h3>${grp ? 4 : 3} · Effort axial de calcul</h3>
    <p class="formula">F<sub>d</sub> = G'<sub>d</sub> + max(G<sub>sn,d</sub> ; Q'<sub>d</sub>) = ${f(1.35 * G + 1.5 * psi2 * Q, 5)} + max(${f(1.35 * Fdim, 4)} ; ${f(1.5 * (1 - psi2) * Q, 4)}) = ${f(c.ELU, 5)} kN (ELU)</p>
    <p>ELS caractéristique : ${f(c.ELS_car, 5)} kN · ELS quasi permanent : ${f(c.ELS_QP, 5)} kN. Le frottement positif est à retirer de la portance au-dessus du point neutre.</p>`;
  return { figure, synthese, note, verdict: null, etat: `Fn = ${f(iso.Fn, 4)} kN (pieu isolé)` };
}

// ─────────────────────────── Sondage pressiométrique ─────────────────────
/** Blocs « z = … » suivis de leurs paliers (pr, V15, V30, V60 ; ou pr, V30, V60 ; ou pr, V60). */
function lireEssais(texte) {
  const essais = [];
  for (const brut of String(texte ?? "").split(/\r?\n/)) {
    const l = brut.trim();
    const m = l.match(/^z\s*=\s*([-\d.,]+)/i);
    if (m) { essais.push({ z: nombre(m[1]), paliers: [] }); continue; }
    if (!essais.length) continue;
    const r = lireTableau(l)[0];
    if (!r) continue;
    essais[essais.length - 1].paliers.push(r.length >= 4 ? { p: r[0], V15: r[1], V30: r[2], V60: r[3] }
      : r.length === 3 ? { p: r[0], V30: r[1], V60: r[2] } : { p: r[0], V60: r[1] });
  }
  return essais.filter((e) => Number.isFinite(e.z) && e.paliers.length);
}

function depouillerSondage(v) {
  const convention = v.conv === "shg" ? "shg" : "norme";
  const hc = nombre(v.hc, 0), zw = nombre(v.zw, Infinity), K0 = nombre(v.K0, 0.5);
  const tubePts = lireTableau(v.tube).filter((r) => r.length >= 2).map(([p, V]) => ({ p, V }));
  const tube = calibrageAppareil(tubePts, { pmin: nombre(v.pminTube, null), di: nombre(v.di, null), ls: nombre(v.ls, null) });
  const Vs = nombre(v.Vs) > 0 ? nombre(v.Vs) : tube.Vs > 0 ? tube.Vs : 535;
  const a = tube.applicable ? tube.a : 0;
  const air = etalonnageSonde(lireTableau(v.air).filter((r) => r.length >= 2).map(([p, V]) => ({ p, V })), { dz: nombre(v.dzAir, 0), Vs, gammaW: CONVENTIONS[convention].gammaW });
  const pe = air.applicable ? air.pe : () => 0;
  // Coupe : chaque couche va de la base précédente à la sienne.
  let z0 = 0;
  const couches = v.couches.map((c) => {
    const z1 = nombre(c.base);
    const k = { z0, z1, nom: c.nom || c.sol, nature: c.nature, sol: c.sol, gamma: nombre(c.gamma, 18), gammaSat: nombre(c.gammaSat, nombre(c.gamma, 18)) };
    z0 = z1;
    return k;
  }).filter((c) => c.z1 > c.z0);
  if (!couches.length) throw new Error("décrire au moins une couche");
  const essais = lireEssais(v.essais);
  if (!essais.length) throw new Error("saisir au moins un essai : une ligne « z = … » puis ses paliers");
  const coucheDe = (z) => couches.find((c) => z >= c.z0 && z < c.z1) ?? couches[couches.length - 1];
  const res = essais.map((e, i) => {
    // Plage pseudo-élastique imposée par l'opérateur pour cet essai, s'il en a choisi une.
    const cle = cleEssai(e.z), choix = v.plages?.[cle] ?? {};
    const r = depouiller({ paliers: e.paliers, Vs, z: e.z, hc, pe, a, sol: { zw, couches, K0 }, convention, pel: air.pel, choix });
    const c = coucheDe(e.z);
    const al = r.applicable && r.plNette > 0 ? alphaMenard(c.nature, r.EM, r.plNette) : null;
    const qc = controlerEssai({ r, paliers: e.paliers, Vs, pel: air.pel, z: e.z, voisins: essais.filter((_, j) => j !== i).map((x) => x.z) });
    return { ...e, cle, r, c, al, qc, bilan: bilanControles(qc) };
  });
  const Vmax = Math.max(...essais.flatMap((e) => e.paliers.map((q) => q.V60)).filter(Number.isFinite));
  const qcApp = controlerAppareillage({ tube, air, Vs, Vmax, VsImpose: nombre(v.Vs) > 0 });
  return { convention, hc, zw, K0, tube, tubePts, Vs, a, air, couches, res, qcApp, bilanApp: bilanControles(qcApp) };
}

/** Clé d'un essai : sa profondeur, au centimètre (les choix de l'opérateur y sont rangés). */
const cleEssai = (z) => Number(z).toFixed(2);

const PASTILLES = { ok: ["ok", "✓ conforme"], alerte: ["alerte", "⚠ à surveiller"], ko: ["ko", "✕ non conforme"], nv: ["na", "– non vérifiable"] };
/** Tous les contrôles, groupe par groupe, avec leur exigence, leur mesure et leur source. */
function tableControles(liste) {
  let groupe = "", lignes = "";
  for (const c of liste) {
    if (c.groupe !== groupe) { groupe = c.groupe; lignes += `<tr class="groupe"><th colspan="5">${esc(groupe)}</th></tr>`; }
    const [cls, txt] = PASTILLES[c.statut];
    lignes += `<tr><td>${esc(c.libelle)}</td><td class="motif">${esc(c.exigence)}</td><td class="motif">${esc(c.mesure)}</td><td><span class="verdict ${cls}">${txt}</span></td><td class="motif"><small>${esc(c.reference)}</small></td></tr>`;
  }
  return `<div class="table-large"><table class="resultats controles"><thead><tr><th>Contrôle</th><th>Exigence</th><th>Mesure</th><th>Statut</th><th>Source</th></tr></thead><tbody>${lignes}</tbody></table></div>`;
}
/** Verdict d'une liste de contrôles, et le décompte par statut. */
const pastilleBilan = (b, court = false) => `<span class="verdict ${b.statut}">${{ ok: "✓", alerte: "⚠", ko: "✕" }[b.statut]} ${b.libelle}</span>${court ? "" : ` <small class="decompte">${b.ok} ✓ · ${b.alerte} ⚠ · ${b.ko} ✕ · ${b.nv} non vérifiables</small>`}`;

/** Droite a + b p écrite avec ses signes. */
const droiteTxt = (d) => `${fd(d.a, 2).replace("-", "−")} ${d.b < 0 ? "−" : "+"} ${fd(Math.abs(d.b), 2)} p`;

/** Dépouillement d'un essai, étape par étape, avec toutes ses courbes : rien n'est caché. */
function detailEssai(e, Vs, a, hc) {
  const r = e.r, lus = e.paliers.filter((q) => Number.isFinite(q.p) && Number.isFinite(q.V60));
  const titre = `<strong>z = ${fd(e.z, 1)} m</strong> · ${esc(e.c.nom)}`;
  if (!r.applicable) {
    return `<details class="essai-detail" data-cle="essai-${e.cle}"><summary>${titre} · <span class="verdict ko">non dépouillable</span> ${esc(r.motif)}</summary>
      ${r.courbe ? figureCorrections(lus, r.courbe) : ""}
      <h4>Contrôle qualité de l'essai</h4>${pastilleBilan(e.bilan)}${tableControles(e.qc)}</details>`;
  }
  const c = r.courbe, ph = r.phase, lim = r.limite, pt = pentes(c);
  const lignes = c.map((q, i) => {
    const l = lus[i] ?? {};
    return `<tr${i >= ph.i1 && i <= ph.i2 ? ' class="ligne-retenue"' : ""}><td>${q.n}</td><td class="n">${fd(q.pr, 3)}</td><td class="n">${Number.isFinite(l.V15) ? fd(l.V15, 1) : "—"}</td>
      <td class="n">${Number.isFinite(l.V30) ? fd(l.V30, 1) : "—"}</td><td class="n">${fd(l.V60, 1)}</td><td class="n">${fd(q.ph, 4)}</td><td class="n">${fd(q.pe, 4)}</td>
      <td class="n"><strong>${fd(q.p, 4)}</strong></td><td class="n"><strong>${fd(q.V, 1)}</strong></td><td class="n">${Number.isFinite(q.fluage) ? fd(q.fluage, 1) : "—"}</td><td class="n">${i ? f(pt[i - 1], 4) : ""}</td></tr>`;
  }).join("");
  const plInv = lim.inverse?.applicable ? lim.inverse.pl : NaN, plHyp = lim.hyperbole?.applicable ? lim.hyperbole.pl : NaN;
  // Choix de la plage pseudo-élastique : premier et dernier palier retenus pour EM.
  const option = (i, retenu) => `<option value="${i}"${i === retenu ? " selected" : ""}>n° ${i + 1} · p = ${fd(c[i].p, 3)} MPa</option>`;
  const plage = `<div class="plage-choix" data-cle-essai="${e.cle}">
      <p><strong>Plage pseudo-élastique</strong> — elle fixe E<sub>M</sub>, V<sub>1</sub> donc V<sub>l</sub>, p<sub>f</sub> et p<sub>l</sub> :</p>
      <label>du palier <select data-plage="i1" aria-label="Premier palier de la plage, essai à ${fd(e.z, 1)} m">${c.slice(0, -1).map((_, i) => option(i, ph.i1)).join("")}</select></label>
      <label>au palier <select data-plage="i2" aria-label="Dernier palier de la plage, essai à ${fd(e.z, 1)} m">${c.map((_, i) => (i ? option(i, ph.i2) : "")).join("")}</select></label>
      ${ph.auto ? '<span class="plage-etat">plage proposée par le calcul</span>' : '<span class="plage-etat impose">plage imposée</span> <button type="button" class="ghost" data-plage-auto>Revenir à la plage proposée</button>'}
    </div>`;
  return `<details class="essai-detail" data-cle="essai-${e.cle}"><summary>${titre} · E<sub>M</sub> = ${fd(r.EM, 1)} MPa · p<sub>f</sub> = ${fd(r.pf, 2)} MPa · p<sub>l</sub> = ${fd(r.pl, 2)} MPa${lim.extrapolee ? " (extrapolée)" : ""} · p<sub>l</sub>* = ${fd(r.plNette, 2)} MPa${ph.auto ? "" : " · plage imposée"} · ${pastilleBilan(e.bilan, true)}</summary>
    <h4>a · Lectures et corrections, palier par palier</h4>
    <p class="formula">p<sub>h</sub> = γ<sub>w</sub> (h<sub>c</sub> + z) = ${fd(c[0].ph, 4)} MPa · V = V<sub>r,60</sub> − a·p<sub>r</sub> (a = ${fd(a, 3)} cm³/MPa) · p = p<sub>r</sub> + p<sub>h</sub> − p<sub>e</sub>(V)</p>
    <div class="table-large"><table class="resultats"><thead><tr><th>n°</th><th class="num">p<sub>r</sub></th><th class="num">V<sub>15</sub></th><th class="num">V<sub>30</sub></th><th class="num">V<sub>60</sub></th>
      <th class="num">p<sub>h</sub></th><th class="num">p<sub>e</sub>(V)</th><th class="num">p</th><th class="num">V</th><th class="num">ΔV<sub>60/30</sub></th><th class="num">ΔV/Δp</th></tr></thead><tbody>${lignes}</tbody></table></div>
    <p class="method-note">Pressions en MPa, volumes en cm³, pentes en cm³/MPa ; en vert, la plage retenue pour E<sub>M</sub>.</p>
    ${figureCorrections(lus, c)}
    <h4>b · La courbe corrigée et ses trois phases</h4>
    ${figureCourbe(r, Vs)}
    <h4>c · Le module pressiométrique</h4>
    ${plage}
    ${figurePentes(r)}
    <p class="formula">E<sub>M</sub> = 2 (1 + ν) (V<sub>s</sub> + V<sub>m</sub>) Δp/ΔV = 2,66 × (${fd(Vs, 1)} + ${fd(r.Vm, 1)}) × ${fd(ph.p2 - ph.p1, 4)} / ${fd(ph.V2 - ph.V1, 1)} = <strong>${fd(r.EM, 2)} MPa</strong></p>
    <p>Plage ${ph.auto ? "proposée par le calcul (pentes les plus faibles et régulières)" : "imposée"} : paliers ${ph.i1 + 1} à ${ph.i2 + 1}, p<sub>1</sub> = ${fd(ph.p1, 3)} MPa, V<sub>1</sub> = ${fd(ph.V1, 1)} cm³, p<sub>2</sub> = ${fd(ph.p2, 3)} MPa, V<sub>2</sub> = ${fd(ph.V2, 1)} cm³, V<sub>m</sub> = (V<sub>1</sub> + V<sub>2</sub>)/2 ; G = E<sub>M</sub>/2,66 = ${fd(r.G, 2)} MPa.</p>
    <h4>d · La pression de fluage</h4>
    ${figureFluage(r)}
    <p>p<sub>f</sub> = <strong>${fd(r.pf, 3)} MPa</strong> : ${esc(r.fluage.methode ?? "")}${r.fluage.pfi ? ` (cassure à ${fd(r.fluage.pfi, 3)} MPa)` : ""}${r.fluage.motif ? ` — ${esc(r.fluage.motif)}` : ""}.
      ${r.fluage.bas && r.fluage.haut ? `Droite basse ΔV = ${droiteTxt(r.fluage.bas)} ; droite haute ΔV = ${droiteTxt(r.fluage.haut)}.` : ""}</p>
    <h4>e · La pression limite</h4>
    ${figureInverse(r)}
    ${figureHyperbole(r)}
    <p>V<sub>l</sub> = V<sub>s</sub> + 2 V<sub>1</sub> = ${fd(Vs, 1)} + 2 × ${fd(ph.V1, 1)} = ${fd(lim.Vl, 1)} cm³.
      ${lim.extrapolee
        ? `Le dernier palier n'atteint pas V<sub>l</sub> : on extrapole sur les paliers au-delà de p<sub>f</sub>${lim.points ? ` (n° ${lim.points.join(", ")})` : ""}.
           Inverse du volume, 1/V = A p + B : p<sub>l</sub> = ${fd(plInv, 3)} MPa${lim.inverse?.applicable ? ` (R² = ${fd(lim.inverse.r2, 4)})` : ""} ;
           hyperbole : p<sub>l</sub> = ${fd(plHyp, 3)} MPa${lim.hyperbole?.applicable ? ` (R² = ${fd(lim.hyperbole.r2, 4)})` : ""}
           ${Number.isFinite(lim.ecart) ? ` ; écart ${fd(100 * lim.ecart, 1)} %` : ""} ; on retient la plus faible, <strong>${fd(lim.pl, 3)} MPa</strong>.`
        : `V<sub>l</sub> est atteint entre les paliers ${lim.entre.join(" et ")} : p<sub>l</sub> = <strong>${fd(lim.pl, 3)} MPa</strong>, lue par interpolation.`}</p>
    <h4>f · Pressions nettes et rapport E<sub>M</sub>/p<sub>l</sub>*</h4>
    <p class="formula">σ'<sub>v0</sub> = ${fd(r.contraintes.sigmaVeff, 1)} kPa · u<sub>0</sub> = ${fd(r.contraintes.u, 1)} kPa · p<sub>0</sub> = K<sub>0</sub> σ'<sub>v0</sub> + u<sub>0</sub> = ${fd(1000 * r.p0, 1)} kPa
      · p<sub>l</sub>* = ${fd(r.pl, 3)} − ${fd(r.p0, 3)} = <strong>${fd(r.plNette, 3)} MPa</strong> · p<sub>f</sub>* = ${fd(r.pfNette, 3)} MPa · E<sub>M</sub>/p<sub>l</sub>* = ${fd(r.rapport, 1)}${e.al ? ` · α = ${fd(e.al.alpha, 2)} (${esc(e.al.etat ?? "")})` : ""}</p>
    <h4>g · Contrôle qualité de l'essai</h4>
    <p>${pastilleBilan(e.bilan)}</p>
    ${tableControles(e.qc)}
    <p class="method-note">Tous les contrôles sont listés, qu'ils passent ou non. « Non vérifiable » : la saisie ne contient pas la donnée (temps des lectures, réglages du CPV, méthode et heures de forage) ; ces points se vérifient sur la feuille d'essai.</p>
  </details>`;
}


function calculerSondage(v) {
  const { convention, hc, zw, K0, tube, tubePts, Vs, a, air, couches, res, qcApp, bilanApp } = depouillerSondage(v);
  const ok = res.filter((e) => e.r.applicable);
  const seuils = couches.map((c) => ({ z0: c.z0, z1: c.z1, valeurs: c.nature === "argile" ? [9, 16] : c.nature === "limon" ? [8, 14] : c.nature === "grave" ? [6, 10] : [7, 12] }));
  const figure = profilPressio({ couches, essais: ok.map((e) => ({ z: e.z, EM: e.r.EM, plNette: e.r.plNette, pfNette: e.r.pfNette })), seuils, largeur: 640, hauteur: 500 });
  const signales = res.filter((e) => e.bilan.statut !== "ok");
  const imposees = res.filter((e) => e.r.applicable && !e.r.phase.auto).length;
  const synthese = `<table class="resultats"><thead><tr><th>z (m)</th><th class="num">E<sub>M</sub></th><th class="num">p<sub>f</sub>*</th><th class="num">p<sub>l</sub>*</th><th class="num">E<sub>M</sub>/p<sub>l</sub>*</th><th>α</th><th>Contrôle</th></tr></thead><tbody>
    ${res.map((e) => (e.r.applicable ? `<tr class="${e.bilan.statut === "ko" ? "ko" : ""}"><td>${fd(e.z, 1)}</td><td class="n">${fd(e.r.EM, 1)}${e.r.phase.auto ? "" : "<small>i</small>"}</td><td class="n">${fd(e.r.pfNette, 2)}</td><td class="n">${fd(e.r.plNette, 2)}${e.r.limite.extrapolee ? "<small>e</small>" : ""}</td>
      <td class="n">${fd(e.r.rapport, 1)}</td><td>${e.al ? fd(e.al.alpha, 2) : "—"}</td><td>${pastilleBilan(e.bilan, true)}</td></tr>` : `<tr class="ko"><td>${fd(e.z, 1)}</td><td colspan="5">${esc(e.r.motif)}</td><td>${pastilleBilan(e.bilan, true)}</td></tr>`)).join("")}
    </tbody></table>
    <p class="method-note">MPa ; « e » : p<sub>l</sub> extrapolée ; « i » : plage pseudo-élastique imposée par l'opérateur. Contrôle qualité de l'appareillage : ${pastilleBilan(bilanApp, true)} ;
      ${signales.length ? `${signales.length} essai(s) avec réserves ou non conformes : le détail des contrôles est dans la note, essai par essai.` : "tous les essais sont conformes."}
      ${imposees ? `${imposees} plage(s) imposée(s).` : "La plage pseudo-élastique de chaque essai se choisit dans son détail (note, partie 4)."}</p>
    <div class="actions envoi-sondage"><button class="secondary" data-envoyer="semelle">Calculer une semelle sur ce sondage</button>
      <button class="secondary" data-envoyer="pieu">Calculer un pieu sur ce sondage</button></div>
    <p class="method-note">Les couches passent au module choisi avec p<sub>l</sub>* (moyenne géométrique des essais de chaque couche),
       E<sub>M</sub> (moyenne harmonique) et une classe F62 proposée — à relire avant de conclure.</p>`;
  const court = (m = "") => (m.startsWith("lue") ? "lue" : m.includes("hyperbolique") ? "hyperbole" : m.includes("trois derniers") ? "1/V, 3 derniers" : m.includes("inverse") ? "inverse du volume" : m);
  const ligneEssai = (e) => {
    const r = e.r;
    if (!r.applicable) return `<tr><td>${fd(e.z, 1)}</td><td colspan="8">${esc(r.motif)}</td></tr>`;
    const ph = r.phase, lim = r.limite;
    return `<tr><td>${fd(e.z, 1)}</td><td class="n">${r.courbe.length}</td><td class="n">${ph.i1 + 1}–${ph.i2 + 1}</td><td class="n">${fd(ph.V1, 0)}</td><td class="n">${fd(r.EM, 2)}</td>
      <td class="n">${fd(r.pf, 3)}</td><td class="n">${fd(r.pl, 3)}</td><td class="motif">${esc(court(lim.methode))}${lim.extrapolee && lim.ecart !== null && lim.ecart !== undefined ? ` (écart ${fd(100 * lim.ecart, 1)} %)` : ""}</td><td class="n">${fd(1000 * r.p0, 1)}</td></tr>`;
  };
  const note = `
    <h3>1 · Appareillage et conventions</h3>
    <p>Étalonnage en tube : ${tube.applicable ? `a = ${fd(tube.a, 3)} cm³/MPa (droite sur ${tube.points} paliers, R² = ${fd(tube.r2, 4)}), V<sub>c</sub> = ${fd(tube.Vc, 1)} cm³` : "absent (a = 0)"} ;
      V<sub>s</sub> = ${fd(Vs, 1)} cm³${nombre(v.Vs) > 0 ? " (imposé)" : tube.Vtube ? ` = π d<sub>i</sub>² l<sub>s</sub>/4 − V<sub>c</sub>` : ""}.
      Étalonnage à l'air : ${air.applicable ? `${air.table.length} points, p<sub>el</sub> = p<sub>e</sub>(1,2 V<sub>s</sub>) = ${fd(air.pel, 3)} MPa` : "absent (p<sub>e</sub> = 0)"}.
      Manomètre à h<sub>c</sub> = ${fd(hc, 2)} m ; conventions : ${esc(CONVENTIONS[convention].nom)}.</p>
    <p class="formula">V = V<sub>r</sub> − a·${convention === "shg" ? "p" : "p<sub>r</sub>"} · p = p<sub>r</sub> + γ<sub>w</sub>(h<sub>c</sub> + z) − p<sub>e</sub>(${convention === "shg" ? "V<sub>r</sub>" : "V"}) · E<sub>M</sub> = 2,66 (V<sub>s</sub> + V<sub>m</sub>) Δp/ΔV · p<sub>l</sub> à V<sub>s</sub> + 2V<sub>1</sub></p>
    <h4>Étalonnage de l'appareillage dans le tube d'acier</h4>
    ${tubePts.length >= 2 ? figureTube(tubePts, tube) : "<p>Pas d'étalonnage en tube : a = 0.</p>"}
    <h4>Étalonnage de la sonde à l'air libre</h4>
    ${air.applicable ? figureAir(air, Vs) : "<p>Pas d'étalonnage à l'air : p<sub>e</sub> = 0.</p>"}
    <h4>Contrôle qualité de l'appareillage</h4>
    <p>${pastilleBilan(bilanApp)}</p>
    ${tableControles(qcApp)}
    <h3>2 · Coupe et état initial</h3>
    <p>${couches.map((c) => `${fd(c.z0, 1)}–${fd(c.z1, 1)} m : ${esc(c.nom)} (γ = ${f(c.gamma, 3)}, γ<sub>sat</sub> = ${f(c.gammaSat, 3)} kN/m³)`).join(" ; ")}.
      Nappe ${Number.isFinite(zw) ? `à ${fd(zw, 2)} m` : "absente"} ; p<sub>0</sub> = K<sub>0</sub> σ'<sub>v0</sub> + u<sub>0</sub> avec K<sub>0</sub> = ${fd(K0, 2)}.</p>
    <h3>3 · Dépouillement des essais</h3>
    <div class="table-large"><table class="resultats"><thead><tr><th>z (m)</th><th class="num">paliers</th><th class="num">plage E<sub>M</sub></th><th class="num">V<sub>1</sub> (cm³)</th><th class="num">E<sub>M</sub> (MPa)</th>
      <th class="num">p<sub>f</sub> (MPa)</th><th class="num">p<sub>l</sub> (MPa)</th><th>p<sub>l</sub> obtenue par</th><th class="num">p<sub>0</sub> (kPa)</th></tr></thead><tbody>${res.map(ligneEssai).join("")}</tbody></table></div>
    <h3>4 · Dépouillement détaillé, essai par essai</h3>
    <p class="method-note">Chaque essai se déplie : lectures et corrections, courbe corrigée, pentes et module, fluage et p<sub>f</sub>, extrapolations de p<sub>l</sub>, pressions nettes. Tout est ouvert à l'impression de la note.</p>
    <div class="essais-details">${res.map((e) => detailEssai(e, Vs, a, hc)).join("")}</div>
    <h3>5 · Contrôle qualité : synthèse</h3>
    <p>Appareillage : ${pastilleBilan(bilanApp)}</p>
    <div class="table-large"><table class="resultats"><thead><tr><th>z (m)</th><th>Plage E<sub>M</sub></th><th class="num">✓</th><th class="num">⚠</th><th class="num">✕</th><th class="num">–</th><th>Verdict</th><th>Points à revoir</th></tr></thead><tbody>
      ${res.map((e) => `<tr><td>${fd(e.z, 1)}</td><td>${e.r.applicable ? `${e.r.phase.i1 + 1}–${e.r.phase.i2 + 1} ${e.r.phase.auto ? "(proposée)" : "(imposée)"}` : "—"}</td>
        <td class="n">${e.bilan.ok}</td><td class="n">${e.bilan.alerte}</td><td class="n">${e.bilan.ko}</td><td class="n">${e.bilan.nv}</td><td>${pastilleBilan(e.bilan, true)}</td>
        <td class="motif">${esc(e.qc.filter((x) => x.statut === "ko" || x.statut === "alerte").map((x) => `${x.statut === "ko" ? "✕" : "⚠"} ${x.libelle} (${x.mesure})`).join(" ; ") || "—")}</td></tr>`).join("")}
    </tbody></table></div>
    <p class="method-note">✓ conforme · ⚠ à surveiller · ✕ non conforme · – non vérifiable avec les données saisies. Les exigences et leur source figurent dans le tableau de chaque essai (partie 4) ;
      les seuils sont ceux de la NF P94-110-1 et de la NF EN ISO 22476-4, les « indicateurs » sont des contrôles de vraisemblance. Un essai non conforme ne s'écarte pas d'office :
      il se discute, et les valeurs de calcul (p<sub>le</sub>*, modules des tranches) se tirent du profil couche par couche, après élimination motivée des essais douteux.</p>`;
  const nKo = res.filter((e) => e.bilan.statut === "ko").length, nAl = res.filter((e) => e.bilan.statut === "alerte").length;
  return { figure, synthese, note, verdict: signales.length ? null : true, etat: `${ok.length} essais dépouillés${nKo ? `, ${nKo} non conforme(s)` : ""}${nAl ? `, ${nAl} avec réserves` : ""}` };
}

function calculerGroupe(v) {
  const B = nombre(v.B), d = nombre(v.d), m = Math.max(1, Math.round(nombre(v.m, 1))), n = Math.max(1, Math.round(nombre(v.n, 1)));
  const Rb = nombre(v.Rbd, 0), Rs = nombre(v.Rsd, 0), Qmax = nombre(v.Qmax, 0), F = nombre(v.F, 0);
  if (!(B > 0 && d >= B)) throw new Error("renseigner B et un entraxe d ≥ B");
  const N = m * n, cl = converseLabarre({ B, d, m, n }), coh = efficaciteCoherentF62({ B, d }), ec7 = efficaciteEC7({ B, d, m, n });
  const ceF = v.sol === "coherent" ? coh : v.sol === "frottant" ? cl : 1;
  const RF = ceF * N * Qmax, vE = verifGroupeEC7({ Fcgd: F, N, Rbd: Rb, Rsd: Rs, Ce: ec7 });
  const bloc = blocMonolithique({ B, d, m: Math.min(m, n), n: Math.max(m, n) });
  const figure = graphe({
    largeur: 560, hauteur: 300, xmin: 1, xmax: 5, ymin: 0, ymax: 1.05, xlabel: "d/B", ylabel: "Ce",
    series: [
      { points: echantillon((x) => converseLabarre({ B: 1, d: x, m, n }), 1, 5, 80), couleur: COULEURS.f62, libelle: "Converse-Labarre" },
      { points: echantillon((x) => efficaciteCoherentF62({ B: 1, d: x }), 1, 5, 80), couleur: COULEURS.f62, tirets: "6 3", libelle: "F62 sols cohérents" },
      { points: echantillon((x) => efficaciteEC7({ B: 1, d: x, m, n }), 1, 5, 80), couleur: COULEURS.ec7, epaisseur: 2.8, libelle: "NF P94-262" },
    ],
    marques: [{ x: d / B, y: ec7, couleur: COULEURS.ec7, guides: true }, { x: d / B, y: ceF, couleur: COULEURS.f62 }],
  });
  const synthese = `<table class="resultats"><thead><tr><th></th><th class="num">C<sub>e</sub></th><th class="num">Résistance</th><th class="num">Taux</th><th></th></tr></thead><tbody>
      <tr class="${F <= RF ? "" : "ko"}"><td><span class="tag-f62">F62</span></td><td class="n">${fd(ceF, 3)}</td><td class="n">${f(RF, 5)} kN</td><td class="n">${fd(F / RF, 2)}</td><td>${pastille(F <= RF + 1e-9)}</td></tr>
      <tr class="${vE.ok ? "" : "ko"}"><td><span class="tag-ec7">EC7</span></td><td class="n">${fd(ec7, 3)}</td><td class="n">${f(vE.R, 5)} kN</td><td class="n">${fd(vE.taux, 2)}</td><td>${pastille(vE.ok)}</td></tr>
    </tbody></table>`;
  const note = `
    <h3>1 · Données</h3><p>${m} × ${n} = ${N} pieux de diamètre ${fd(B, 2)} m, entraxe ${fd(d, 2)} m (d/B = ${fd(d / B, 2)}) ; charge totale de calcul ${f(F, 5)} kN.</p>
    <h3>2 · Fascicule 62 (annexe G.1)</h3>
    <p class="formula">Converse-Labarre : C<sub>e</sub> = 1 − [arctan(B/d)/(π/2)] (2 − 1/m − 1/n) = ${fd(cl, 3)}</p>
    <p class="formula">Sols cohérents : C<sub>e</sub> = ${d / B >= 3 ? "1 (d > 3B)" : `¼ (1 + d/B) = ${fd(coh, 3)}`}</p>
    <p>Retenu (${v.sol === "coherent" ? "sol cohérent" : v.sol === "frottant" ? "sol frottant, pieux sans refoulement" : "sable lâche, pieux refoulants"}) : C<sub>e</sub> = ${fd(ceF, 3)} ; Σ F<sub>d</sub> ≤ C<sub>e</sub> n Q<sub>max</sub> = ${f(RF, 5)} kN. À comparer au bloc de Terzaghi, dont on retient la plus faible estimation.</p>
    <h3>3 · NF P94-262 (annexe J)</h3>
    <p class="formula">C<sub>d</sub> = 1 − ¼ (1 + d/B) = ${fd(1 - 0.25 * (1 + Math.max(d / B, 1)), 3)} · C<sub>e</sub> = ${d / B >= 3 ? "1 (d ≥ 3B)" : `1 − C<sub>d</sub> [2 − (1/m + 1/n)] = ${fd(ec7, 3)}`}</p>
    <p class="formula">F<sub>cg;d</sub> ≤ N (R<sub>b;d</sub> + C<sub>e</sub> R<sub>s;d</sub>) = ${N} × (${f(Rb, 4)} + ${fd(ec7, 3)} × ${f(Rs, 4)}) = ${f(vE.R, 5)} kN</p>
    <h3>4 · Bloc monolithique</h3>
    <p>Dimensions ${fd(bloc.L, 2)} m × ${fd(bloc.l, 2)} m, périmètre ${fd(bloc.perimetre, 2)} m, base ${fd(bloc.aire, 2)} m² : à justifier comme une fondation dont la base est au niveau des pointes, avec le frottement sur son périmètre.</p>`;
  return { figure, synthese, note, verdict: F <= RF + 1e-9 && vE.ok, taux: { F62: F / RF, EC7: vE.taux } };
}

function calculerLateral(v) {
  const B = nombre(v.B), L = nombre(v.L), E = nombre(v.E), H = nombre(v.H, 0), M = nombre(v.M, 0);
  const h1 = Math.max(nombre(v.h1, 0), 0), longue = v.duree === "longue";
  const c1 = { EM: nombre(v.EM1), alpha: nombre(v.a1), pf: nombre(v.pf1) }, c2 = { EM: nombre(v.EM2), alpha: nombre(v.a2), pf: nombre(v.pf2) };
  if (!(B > 0 && L > 0 && E > 0 && c1.EM > 0 && c2.EM > 0 && c1.pf > 0 && c2.pf > 0)) throw new Error("renseigner la géométrie et les deux couches");
  const EI = E * 1000 * (Math.PI * B ** 4) / 64, facteur = longue ? 0.5 : 1;
  const reaction = (z) => {
    const c = z < h1 ? c1 : c2;
    let K = moduleKf({ EM: c.EM, B, alpha: c.alpha }).Kf * facteur, rmax = B * c.pf * 1000;
    if (v.min !== "non") { const m = minorationSurface({ z, B, sol: v.sol1, simplifiee: v.min === "simple" }); K *= m.pente; rmax *= m.palier; }
    return { K, rmax };
  };
  const r = pieuDifferencesFinies({ L, EI, H, M, tete: v.tete, reaction, n: 240 });
  const Kf1 = moduleKf({ EM: c1.EM, B, alpha: c1.alpha }).Kf * facteur, Kf2 = moduleKf({ EM: c2.EM, B, alpha: c2.alpha }).Kf * facteur;
  const an = pieuLongAnalytique({ EI, Kf: Kf1, H, M, tete: v.tete });
  const zVue = Math.min(L, Math.max(4 * an.l0, 6));
  const yMax = Math.max(...r.y.map((y) => Math.abs(y) * 1000)) * 1.15 || 1, mMax = Math.max(...r.M.map(Math.abs)) * 1.15 || 1;
  const g1 = graphe({ largeur: 300, hauteur: 320, xmin: -yMax * 0.3, xmax: yMax, ymin: 0, ymax: zVue, inverserY: true, legende: false, xlabel: "y (mm)", ylabel: "z (m)", series: [{ points: r.z.map((z, i) => [r.y[i] * 1000, z]), couleur: COULEURS.bleu }] });
  const g2 = graphe({ largeur: 300, hauteur: 320, xmin: -mMax, xmax: mMax, ymin: 0, ymax: zVue, inverserY: true, legende: false, xlabel: "M (kN·m)", ylabel: "z (m)", series: [{ points: r.z.map((z, i) => [r.M[i], z]), couleur: COULEURS.effort }] });
  const figure = `<div style="display:grid;grid-template-columns:1fr 1fr;width:100%">${g1}${g2}</div>`;
  const synthese = `<table class="resultats"><thead><tr><th>Grandeur</th><th class="num">Valeur</th></tr></thead><tbody>
      <tr><td>Déplacement en tête y<sub>0</sub></td><td class="n"><strong>${fd(r.y0 * 1000, 2)} mm</strong></td></tr>
      <tr><td>Moment maximal</td><td class="n"><strong>${f(Math.abs(r.MMax), 4)} kN·m</strong> à ${fd(r.zMMax, 2)} m</td></tr>
      <tr><td>Nœuds au palier</td><td class="n">${r.plastifies}</td></tr>
      <tr><td>l<sub>0</sub> (couche 1)</td><td class="n">${fd(an.l0, 2)} m ${pieuSouple({ L, l0: an.l0 }) ? "· pieu souple" : "· pieu court"}</td></tr>
    </tbody></table>`;
  const note = `
    <h3>1 · Données</h3><p>Pieu B = ${fd(B, 2)} m, L = ${fd(L, 2)} m, E = ${f(E, 5)} MPa (EI = ${f(EI, 5)} kN·m²) ; H = ${f(H, 4)} kN, M = ${f(M, 4)} kN·m, tête ${v.tete === "libre" ? "libre" : "encastrée"} ; sollicitation de ${longue ? "longue" : "courte"} durée.</p>
    <h3>2 · Lois de réaction (F62 annexe C.5 ; NF P94-262 annexe I)</h3>
    <p class="formula">Couche 1 (0 – ${fd(h1, 2)} m) : K<sub>f</sub> = ${f(Kf1, 4)} kPa · palier B p<sub>f</sub>* = ${f(B * c1.pf * 1000, 4)} kN/m</p>
    <p class="formula">Couche 2 : K<sub>f</sub> = ${f(Kf2, 4)} kPa · palier ${f(B * c2.pf * 1000, 4)} kN/m</p>
    <p>${v.min === "non" ? "Sans minoration près de la surface." : `Minoration sur z<sub>c</sub> = ${v.sol1 === "coherent" ? "2" : "4"} B = ${fd((v.sol1 === "coherent" ? 2 : 4) * B, 2)} m ${v.min === "simple" ? "(0,5 sur la pente, 0,7 sur le palier)" : "(coefficient 0,5 (1 + z/z<sub>c</sub>))"}.`}</p>
    <h3>3 · Résultats</h3>
    <p class="formula">y<sub>0</sub> = ${fd(r.y0 * 1000, 2)} mm · M<sub>max</sub> = ${f(Math.abs(r.MMax), 4)} kN·m à ${fd(r.zMMax, 2)} m · ${r.plastifies} nœud(s) au palier</p>
    <p>Contrôle par la solution du pieu long en sol homogène (couche 1, sans palier) : y<sub>0</sub> = ${fd(an.y0 * 1000, 2)} mm, M<sub>max</sub> = ${f(an.MMax, 4)} kN·m, l<sub>0</sub> = ${fd(an.l0, 2)} m.</p>`;
  return { figure, synthese, note, verdict: null, etat: `y0 = ${fd(r.y0 * 1000, 1)} mm · Mmax = ${f(Math.abs(r.MMax), 3)} kN·m` };
}

// ─────────────────────────── Remblai sur sol compressible ─────────────────
function donneesRemblai(v) {
  const couches = [];
  let z = 0;
  for (const c of v.couches) {
    const base = nombre(c.base);
    if (!(base > z)) continue;
    const x = { z0: z, z1: base, nom: String(c.nom ?? "").trim(), drainante: c.drainante === "oui" };
    for (const k of ["gamma", "e0", "Cc", "Cs", "pop", "cv", "ch", "Cae", "cu"]) x[k] = nombre(c[k], 0);
    if (!(x.gamma > 0)) throw new Error(`couche « ${x.nom || "sans nom"} » : renseigner γ`);
    couches.push(x);
    z = base;
  }
  if (!couches.length) throw new Error("aucune couche valide : les bases doivent croître");
  const H = nombre(v.H), fruit = nombre(v.n, 2), gamma = nombre(v.gamma, 20);
  if (!(H > 0 && fruit > 0 && gamma > 0)) throw new Error("renseigner la hauteur, le fruit des talus et γ du remblai");
  const drains = v.drains === "oui" ? {
    espacement: nombre(v.esp), maille: v.maille, dw: nombre(v.dw, 66) / 1000, s: Math.max(nombre(v.sm, 1), 1),
    kRapport: Math.max(nombre(v.kr, 1), 1), profondeur: nombre(v.zd, Infinity),
  } : null;
  if (drains && !(drains.espacement > 0 && drains.dw > 0)) throw new Error("renseigner l'espacement et le diamètre des drains");
  const tService = nombre(v.tms, 18) / 12, dureeService = nombre(v.duree, 20);
  if (!(tService > 0 && dureeService > 0)) throw new Error("renseigner la date de mise en service et la période de service");
  return {
    H, mode: v.mode === "mise" ? "mise" : "finale", gamma, largeurCrete: Math.max(nombre(v.B, 0), 0), fruit, zw: Math.max(nombre(v.zw, 0), 0),
    couches, basDrainant: v.bas !== "impermeable", construction: v.construction === "continue" ? "continue" : "etapes",
    montee: Math.max(nombre(v.montee, 1), 0.05) / 12, Uetape: Math.min(Math.max(nombre(v.Uetape, 70), 10), 99) / 100,
    F: nombre(v.F, 1.5), lambdaCu: nombre(v.lambdaCu, 0.25), drains, tService, dureeService, sAdmissible: nombre(v.sadm, 100),
  };
}

const solRemblai = (c) => (c.drainante || !(c.Cc > 0) ? "sable" : /tourbe/i.test(c.nom) ? "tourbe" : /limon/i.test(c.nom) ? "limon" : "argile");
const mois = (ans) => `${f(ans * 12, 3)} mois`;
const date = (ans) => (ans < 2 ? mois(ans) : `${f(ans, 3)} ans`);

function calculerRemblai(v) {
  const d = donneesRemblai(v), r = etudierRemblai(d);
  const zBas = Math.max(...d.couches.map((c) => c.z1));
  const drainante = (c) => c.drainante || !(c.Cc > 0);
  const coupe = coupeRemblai({
    H: r.H, largeurCrete: d.largeurCrete, fruit: d.fruit, zw: d.zw, zDrains: d.drains ? Math.min(d.drains.profondeur, zBas) : null,
    couches: d.couches.map((c) => ({ z0: c.z0, z1: c.z1, sol: solRemblai(c), etiquette: `${c.nom || "couche"}${drainante(c) ? " · drainante" : ` · Cc ${fd(c.Cc, 2)} · cv ${fd(c.cv, 1)} m²/an`}` })),
  });
  const tCourt = Math.max(d.tService * 1.3, (r.finTravaux ?? d.tService) * 1.15);
  const court = r.courbe.filter((p) => p.t <= tCourt);
  const sMax = Math.max(...r.courbe.map((p) => p.stot), r.final.centre) * 1.1;
  const gH = graphe({
    largeur: 560, hauteur: 200, xmin: 0, xmax: tCourt * 12, ymin: 0, ymax: r.H * 1.15,
    xlabel: "temps depuis le début des travaux (mois)", ylabel: "hauteur (m)",
    series: [{ points: court.map((p) => [p.t * 12, p.H]), couleur: COULEURS.f62, epaisseur: 2.4, libelle: d.construction === "etapes" ? `hauteur de remblai (${r.etapes.length} étape${r.etapes.length > 1 ? "s" : ""})` : "hauteur de remblai" }],
    marques: [{ x: d.tService * 12, y: r.H, couleur: COULEURS.bleu, guides: true, libelle: "mise en service" }],
  });
  const gS = graphe({
    largeur: 560, hauteur: 240, xmin: 0, xmax: tCourt * 12, ymin: 0, ymax: sMax, inverserY: true,
    xlabel: "temps depuis le début des travaux (mois)", ylabel: "tassement sous l'axe (mm)",
    series: [
      { points: court.map((p) => [p.t * 12, p.stot]), couleur: COULEURS.encre, epaisseur: 2.4, libelle: "tassement" },
      { points: [[0, r.final.centre], [tCourt * 12, r.final.centre]], couleur: COULEURS.discret, tirets: "5 4", libelle: "tassement final de consolidation" },
    ],
    marques: [{ x: d.tService * 12, y: r.service.s, couleur: COULEURS.bleu, guides: true }],
  });
  const long = r.courbe.filter((p) => p.t >= 0.01);
  const gL = graphe({
    largeur: 560, hauteur: 250, xmin: 0.01, xmax: r.service.tFin, logX: true, ymin: 0, ymax: sMax, inverserY: true,
    xlabel: "temps (ans, échelle logarithmique)", ylabel: "tassement sous l'axe (mm)",
    zones: [{ x0: d.tService, x1: r.service.tFin, y0: 0, y1: sMax, couleur: COULEURS.rouge, opacite: 0.05, libelle: "service", position: "droite" }],
    series: [
      { points: long.map((p) => [p.t, p.s]), couleur: COULEURS.bleu, tirets: "6 4", libelle: "consolidation primaire" },
      { points: long.map((p) => [p.t, p.stot]), couleur: COULEURS.encre, epaisseur: 2.4, libelle: "primaire + fluage" },
    ],
    marques: [{ x: d.tService, y: r.service.s, couleur: COULEURS.bleu, guides: true }],
  });
  const figure = coupe + gH + gS + gL;

  const stab = r.stabilite;
  const okStab = stab.verifiee ? Boolean(stab.ok) && !r.bloque : null;
  const verdict = r.service.ok && okStab !== false;
  const synthese = `<table class="resultats"><thead><tr><th>Grandeur</th><th class="num">Valeur</th></tr></thead><tbody>
      <tr><td>Hauteur mise en œuvre${d.mode === "finale" ? ` (plateforme finale à ${fd(d.H, 2)} m)` : ""}</td><td class="n">${fd(r.H, 2)} m</td></tr>
      <tr><td>Tassement final de consolidation : axe · bord de crête · pied</td><td class="n">${fd(r.final.centre, 0)} · ${fd(r.final.bord, 0)} · ${fd(r.final.pied, 0)} mm</td></tr>
      <tr><td>Fin des travaux${d.construction === "etapes" ? ` (${r.etapes.length} étape${r.etapes.length > 1 ? "s" : ""})` : ""}</td><td class="n">${r.finTravaux !== null ? mois(r.finTravaux) : "non atteinte"}</td></tr>
      <tr><td>Mise en service : tassement · degré de consolidation</td><td class="n">${fd(r.service.s, 0)} mm · ${fd(100 * r.service.U, 1)} %</td></tr>
      <tr><td>Tassement résiduel sur ${f(d.dureeService, 3)} ans (fluage compris)</td><td class="n">${fd(r.service.residuel, 0)} mm ${pastille(r.service.ok)}</td></tr>
      <tr><td>Stabilité à court terme : F obtenu / F requis</td><td class="n">${stab.verifiee ? `${fd(stab.F, 2)} / ${fd(d.F, 2)} ${pastille(okStab)}` : "c<sub>u</sub> non renseignée"}</td></tr>
    </tbody></table>
    <p class="final-result bureau-verdict ${verdict ? "ok" : "ko"}">${verdict ? "Remblai vérifié" : "Remblai non vérifié"} : tassement résiduel ${fd(r.service.residuel, 0)} mm pour ${fd(d.sAdmissible, 0)} mm admissibles${stab.verifiee ? `, F = ${fd(stab.F, 2)}` : ""}${r.bloque ? " ; la hauteur visée n'est pas atteinte par étapes" : ""}.</p>`;

  const lignesCouches = r.parCouche.map((p) => `<tr><td>${esc(p.couche.nom || "—")}</td><td class="n">${fd(p.couche.z0, 2)} – ${fd(p.couche.z1, 2)}</td>
      <td class="n">${p.drainante ? "drainante" : `${fd(p.couche.e0, 2)} · ${fd(p.couche.Cc, 2)} · ${fd(p.couche.Cs, 3)}`}</td>
      <td class="n">${fd(p.svp, 1)}</td><td class="n">${p.drainante ? "—" : fd(p.sp, 1)}</td><td class="n">${fd(p.ds, 1)}</td><td class="n">${p.drainante ? "—" : fd(p.s, 0)}</td></tr>`).join("");
  const reperes = [[r.finTravaux, "fin des travaux"], [d.tService, "mise en service"], [r.service.tFin, "fin de la période de service"], [0.5, ""], [1, ""], [2, ""], [5, ""], [10, ""]]
    .filter(([x]) => x !== null && x > 0 && x <= r.service.tFin + 1e-9);
  const vus = new Set(), instants = [];
  for (const [x, nom] of reperes) { const k = x.toFixed(6); if (!vus.has(k)) { vus.add(k); instants.push([x, nom]); } }
  instants.sort((a, b) => a[0] - b[0]);
  const lire = (x) => r.courbe.find((p) => p.t >= x - 1e-9) ?? r.courbe.at(-1);
  const lignesTemps = instants.map(([x, nom]) => { const p = lire(x); return `<tr><td>${nom || "—"}</td><td class="n">${date(x)}</td><td class="n">${fd(p.H, 2)}</td><td class="n">${fd(p.s, 0)}</td><td class="n">${fd(p.sf, 0)}</td><td class="n">${fd(100 * p.U, 1)} %</td></tr>`; }).join("");
  const lignesEtapes = r.etapes.map((e) => `<tr><td>${e.n}</td><td class="n">${mois(e.t0)} → ${mois(e.t1)}</td><td class="n">${fd(e.H0, 2)} → ${fd(e.H1, 2)} m</td>
      <td class="n">${Number.isFinite(e.cu) ? `${f(e.cu, 3)} kPa` : "—"}</td><td class="n">${e.F !== null ? fd(e.F, 2) : "—"}</td></tr>`).join("");
  const uMax = Math.max(1, ...r.isochrones.flatMap((i) => i.points.map((p) => p.u)));
  const iso = r.isochrones.length ? graphe({
    largeur: 560, hauteur: 260, xmin: 0, xmax: uMax * 1.1, ymin: 0, ymax: zBas, inverserY: true,
    xlabel: "surpression interstitielle u (kPa)", ylabel: "profondeur sous le TN (m)",
    series: r.isochrones.map((i, k) => ({ points: i.points.map((p) => [p.u, p.z]), couleur: [COULEURS.effort, COULEURS.bleu, COULEURS.discret][k], epaisseur: 2, libelle: `${i.nom} (${date(i.t)})` })),
  }) : "";
  const note = `
    <h3>1 · Données</h3>
    <p>Remblai ${d.mode === "finale" ? `de cote finale ${fd(d.H, 2)} m, soit ${fd(r.H, 2)} m mis en œuvre` : `de ${fd(r.H, 2)} m`} (γ = ${f(d.gamma, 3)} kN/m³), crête de ${fd(d.largeurCrete, 1)} m, talus à ${fd(d.fruit, 1)} pour 1 ;
       nappe à ${fd(d.zw, 2)} m sous le terrain naturel ; base du profil ${d.basDrainant ? "drainante" : "imperméable"}.
       ${d.drains ? `Drains verticaux en maille ${d.drains.maille === "carre" ? "carrée" : "triangulaire"} de ${fd(d.drains.espacement, 2)} m (d<sub>w</sub> = ${f(d.drains.dw * 1000, 3)} mm, d<sub>s</sub>/d<sub>w</sub> = ${fd(d.drains.s, 1)}, k<sub>h</sub>/k<sub>s</sub> = ${fd(d.drains.kRapport, 1)}) jusqu'à ${fd(Math.min(d.drains.profondeur, zBas), 2)} m.` : "Sans drains verticaux."}
       Mise en service ${mois(d.tService)} après le début des travaux ; période de service ${f(d.dureeService, 3)} ans ; tassement résiduel admissible ${f(d.sAdmissible, 3)} mm.</p>
    <div class="table-large"><table class="resultats"><thead><tr><th>Couche</th><th class="num">z (m)</th><th class="num">γ</th><th class="num">e<sub>0</sub> · C<sub>c</sub> · C<sub>s</sub></th><th class="num">POP</th><th class="num">c<sub>v</sub> · c<sub>h</sub> (m²/an)</th><th class="num">C<sub>αe</sub></th><th class="num">c<sub>u</sub> (kPa)</th></tr></thead><tbody>
      ${d.couches.map((c) => `<tr><td>${esc(c.nom || "—")}</td><td class="n">${fd(c.z0, 2)} – ${fd(c.z1, 2)}</td><td class="n">${f(c.gamma, 3)}</td>
        <td class="n">${drainante(c) ? "drainante" : `${fd(c.e0, 2)} · ${fd(c.Cc, 2)} · ${fd(c.Cs, 3)}`}</td><td class="n">${drainante(c) ? "—" : f(c.pop, 3)}</td>
        <td class="n">${drainante(c) ? "—" : `${f(c.cv, 3)} · ${f(c.ch > 0 ? c.ch : c.cv, 3)}`}</td><td class="n">${drainante(c) ? "—" : f(c.Cae, 3)}</td><td class="n">${c.cu > 0 ? f(c.cu, 3) : "—"}</td></tr>`).join("")}
    </tbody></table></div>
    <h3>2 · Contraintes et tassement final</h3>
    <p>Supplément de contrainte sous l'axe par la solution de Flamant intégrée sur le profil trapézoïdal du remblai (Osterberg) ; tassement de consolidation par tranches de 0,2 m au plus,
       C<sub>s</sub> jusqu'à σ'<sub>p</sub> = σ'<sub>v0</sub> + POP, C<sub>c</sub> au-delà <span class="ref">[261 J.4.2.3 ; F62 F.2 § 2.3]</span>. La part du remblai enfoncée sous la nappe est déjaugée :
       charge en crête ${f(r.final.q, 4)} kPa${r.final.dejaugeage > 0 ? `, soit γ H − ${f(r.final.dejaugeage, 3)} kPa` : ""}.</p>
    <div class="table-large"><table class="resultats"><thead><tr><th>Couche</th><th class="num">z (m)</th><th class="num">e<sub>0</sub> · C<sub>c</sub> · C<sub>s</sub></th><th class="num">σ'<sub>v0</sub> au milieu (kPa)</th><th class="num">σ'<sub>p</sub> (kPa)</th><th class="num">Δσ au milieu (kPa)</th><th class="num">s (mm)</th></tr></thead><tbody>${lignesCouches}</tbody></table></div>
    <p class="formula">s<sub>c</sub> = ${fd(r.final.centre, 0)} mm sous l'axe · ${fd(r.final.bord, 0)} mm sous le bord de la crête · ${fd(r.final.pied, 0)} mm sous le pied des talus</p>
    <h3>3 · Consolidation dans le temps</h3>
    <p>Consolidation verticale du multicouche par différences finies (schéma implicite), m<sub>v</sub> de chaque tranche tiré de sa courbe œdométrique sur l'intervalle de contrainte final${d.drains ? ` ; drainage radial vers les drains selon Barron et Hansbo, D<sub>e</sub> = ${fd(r.De, 2)} m, F = ${fd(r.F, 2)}` : ""} ;
       les couches sans C<sub>c</sub> sont drainantes. À chaque instant, chaque tranche tasse selon sa courbe œdométrique sous sa contrainte effective du moment ; la charge suit le phasage et le déjaugeage.</p>
    <div class="table-large"><table class="resultats"><thead><tr><th>Instant</th><th class="num">t</th><th class="num">H (m)</th><th class="num">s<sub>c</sub> (mm)</th><th class="num">s<sub>f</sub> (mm)</th><th class="num">U</th></tr></thead><tbody>${lignesTemps}</tbody></table></div>
    ${iso ? `<div class="software-diagram">${iso}</div>` : ""}
    <h3>4 · Phasage et stabilité à court terme</h3>
    <p>${d.construction === "etapes" ? `Chaque étape monte en ${mois(d.montee)} jusqu'à H = (π + 2) c<sub>u</sub>/(γ F), c<sub>u</sub> étant celle de la couche la plus faible, accrue de λ<sub>cu</sub> Δσ'<sub>v</sub> (λ<sub>cu</sub> = ${fd(d.lambdaCu, 2)}) ; l'étape suivante attend U = ${fd(100 * d.Uetape, 0)} %.` : `Remblai monté d'un seul jet en ${mois(d.montee)} ; la stabilité se juge à la fin des travaux, avec c<sub>u</sub> accrue de λ<sub>cu</sub> Δσ'<sub>v</sub> (λ<sub>cu</sub> = ${fd(d.lambdaCu, 2)}).`}
       C'est un prédimensionnement : la stabilité se vérifie ensuite par un calcul le long de surfaces de rupture <span class="ref">[NF EN 1997-1 § 11 et § 12]</span>.</p>
    ${lignesEtapes ? `<div class="table-large"><table class="resultats"><thead><tr><th>Étape</th><th class="num">Période</th><th class="num">Hauteur</th><th class="num">c<sub>u</sub> la plus faible</th><th class="num">F</th></tr></thead><tbody>${lignesEtapes}</tbody></table></div>` : ""}
    ${!stab.verifiee ? "<p>Aucune cohésion non drainée renseignée : la stabilité à court terme n'est pas évaluée.</p>" : d.construction === "continue" ? `<p class="formula">F = (π + 2) c<sub>u</sub>/(γ H) = ${fd(stab.F, 2)} ${pastille(okStab)}</p>` : ""}
    ${r.bloque ? '<p class="final-result bureau-verdict ko">Hauteur visée non atteinte : la consolidation ne renforce plus assez le sol. Il faut des banquettes, un renforcement, un allègement ou des drains plus serrés.</p>' : ""}
    <h3>5 · Fluage et tassement résiduel</h3>
    <p>${r.debutFluage !== null ? `Fluage à partir de t<sub>p</sub> = ${date(r.debutFluage)} (U = 95 % après la fin des travaux) : ${fd(r.penteFluage, 0)} mm par décade de temps <span class="ref">[261 J.4.2.4]</span>.` : "La consolidation primaire n'atteint pas 95 % pendant la période étudiée : le fluage n'est pas compté ; le tassement résiduel vient de la consolidation."}
       Tassement à la mise en service ${fd(r.service.s, 0)} mm ; au bout de ${f(d.dureeService, 3)} ans de service, ${fd(r.service.sFin, 0)} mm.</p>
    <p class="formula">tassement résiduel = ${fd(r.service.sFin, 0)} − ${fd(r.service.s, 0)} = ${fd(r.service.residuel, 0)} mm ${r.service.ok ? "≤" : ">"} ${fd(d.sAdmissible, 0)} mm ${pastille(r.service.ok)}</p>`;
  return { figure, synthese, note, verdict, etat: `s∞ = ${fd(r.final.centre, 0)} mm · résiduel ${fd(r.service.residuel, 0)} mm` };
}

// À l'impression de la note, les essais repliés se déplient, puis reprennent leur état.
window.addEventListener("beforeprint", () => document.querySelectorAll("details.essai-detail:not([open])").forEach((d) => { d.open = true; d.dataset.replie = "1"; }));
window.addEventListener("afterprint", () => document.querySelectorAll('details.essai-detail[data-replie="1"]').forEach((d) => { d.open = false; delete d.dataset.replie; }));

rendre();
