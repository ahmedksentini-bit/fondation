// Exercices du chapitre 11 : la couche de forme — plus gros éléments,
// conditions d'utilisation (codes G W T S de l'annexe 3), classe mécanique
// des matériaux traités, épaisseurs tabulées du GTR 2000 et modèle bicouche.
import { fr, frd, nombre, choixMelange, donnee } from "./alea.js";
import { lmaxCoucheForme, DMAX_TRAITE, epaisseur2000 } from "../gtr/couche-forme.js";
import { zoneMecanique, classeMecanique, FRONTIERES_ZONES, rtFrontiere } from "../gtr/traitement.js";
import { conditionsCoucheForme, RUBRIQUES_CDF, RUBRIQUES_REMBLAI } from "../gtr/utilisation.js";
import { bicouche, epaisseurPour, CLASSES_PF, classePlateforme } from "../gtr/portance.js";
import { MODULE_AR } from "../gtr/pst.js";
import { graphe, svg, couche, cote, fleche, texte, COULEURS } from "../figures.js";

const METEO = {
  "++": "pluie forte (++)", "+": "pluie faible (+)",
  "=": "temps neutre, ni pluie ni évaporation importante (=)", "-": "évaporation importante (−)",
};
const symbole = (m) => m.replace("-", "−");

/** Tire des données jusqu'à ce qu'elles conviennent ; au pire, le dernier tirage reste valable (réponses du solveur). */
function tirer(a, tirage, accepte, essais = 80) {
  let d;
  for (let i = 0; i < essais; i++) { d = tirage(a); if (accepte(d)) return d; }
  return d;
}

/**
 * Abaque E–Rt à 90 jours des matériaux traités (GTR 2000 figure 6, repris par
 * le GTR 2024 F1 figure 12) : frontières des zones 1 à 5, sans le point du
 * matériau, avec un repère vertical au module de l'énoncé.
 */
function abaque(E) {
  const series = FRONTIERES_ZONES.map((c, i) => ({
    points: Array.from({ length: 40 }, (_, k) => { const x = 1000 * 50 ** (k / 39); return [x, rtFrontiere(c, x)]; }),
    couleur: "#334155", epaisseur: i === 4 ? 2 : 1.5, tirets: i === 4 ? "5 3" : null,
  }));
  series.push({ points: [[E, 0.08], [E, 3.5]], couleur: COULEURS.bleu, epaisseur: 1.6, tirets: "6 4", libelle: `module de l'étude : E = ${fr(E, 3)} MPa` });
  const xL = E > 9000 && E < 22000 ? 35000 : 14000; // les libellés des bandes, loin du repère vertical
  const milieu = (k) => Math.sqrt(rtFrontiere(FRONTIERES_ZONES[k - 2], xL) * rtFrontiere(FRONTIERES_ZONES[k - 1], xL));
  const textes = [
    { x: E < 3500 ? 6000 : 2400, y: 1.7, texte: "zone 1", couleur: COULEURS.gtr24, taille: 12 },
    ...[2, 3, 4, 5].map((k) => ({ x: xL, y: milieu(k), texte: `zone ${k}`, couleur: COULEURS.gtr24, taille: 11 })),
    { x: xL, y: 0.13, texte: "non classable", couleur: COULEURS.rouge, taille: 11 },
  ];
  return graphe({
    largeur: 620, hauteur: 320, xmin: 1000, xmax: 50000, ymin: 0.08, ymax: 3.5, logX: true, logY: true,
    xlabel: "module d'Young E à 90 jours (MPa)", ylabel: "Rt à 90 jours (MPa)", series, textes,
  });
}
const frontieres = (E) => FRONTIERES_ZONES.map((c) => rtFrontiere(c, E));
const nomZone = (z) => (z ? `zone ${z}` : "sous la zone 5 (non classable)");
const nomClasse = (c) => (c ? `classe ${c}` : "non classable");

/** Coupe du modèle bicouche : plaque, couche de forme (h, E1), arase (E2). */
function coupeBicouche({ h, E1, E2, ar, traitee }) {
  return svg({ largeur: 560, hauteur: 210, titre: "Modèle bicouche sous la plaque", contenu: (id) => {
    const x0 = 70, x1 = 520, ySurf = 64, kz = 110, yAr = ySurf + h * kz;
    let s = couche(id, { x: x0, y: ySurf, w: x1 - x0, h: yAr - ySurf, sol: traitee ? "traite" : "forme", etiquette: `couche de forme · E1 = ${fr(E1, 4)} MPa`, cote: "droite" });
    s += couche(id, { x: x0, y: yAr, w: x1 - x0, h: 200 - yAr, sol: "argile", etiquette: `arase ${ar} · E2 = ${E2} MPa`, cote: "droite", position: "haut" });
    s += `<path d="M${x0} ${ySurf}H${x1}M${x0} ${yAr.toFixed(1)}H${x1}" stroke="${COULEURS.trait}" stroke-width="1.4"/>`;
    // Plaque de 600 mm (a = 0,30 m), à l'échelle des épaisseurs.
    const xc = 200, ra = 0.3 * kz;
    s += `<rect x="${(xc - ra).toFixed(1)}" y="${ySurf - 9}" width="${(2 * ra).toFixed(1)}" height="9" fill="#475569"/>`;
    s += fleche(id, xc, 14, xc, ySurf - 11, { type: "effort" });
    s += texte(xc + ra + 8, ySurf - 14, "plaque Ø 600 mm (a = 0,30 m)", 'class="halo" style="font-size:11.5px;font-weight:700"');
    s += cote(id, 40, ySurf, 40, yAr, `h = ${frd(h, 2)} m`, { cote: "droite" });
    return s;
  } });
}

// Matériaux des conditions d'utilisation (cas sans discordance dans le guide imprimé).
const CAS_CODES = [
  { cle: "F1", nom: "un limon peu plastique F1", meteos: ["=", "-"] },
  { cle: "F2", nom: "un limon argileux F2", meteos: ["="] },
  { cle: "F3", nom: "une argile F3", meteos: ["+", "="] },
  { cle: "I1", nom: "un sable très silteux I1", meteos: ["=", "-"] },
  { cle: "I2", nom: "un sable argileux I2", meteos: ["=", "-"] },
  { cle: "S31", nom: "un sable limoneux à grains résistants, sensible à l'eau (S31)", meteos: ["=", "-"] },
  { cle: "S21ins", nom: "un sable propre mal gradué à grains résistants (S21ins)", meteos: ["=", "-"] },
  { cle: "G31", nom: "une grave silteuse à grains résistants, sensible à l'eau (G31)", meteos: ["=", "-"] },
  { cle: "VC2F1", nom: "un limon à cailloux roulés VC2F1", meteos: ["=", "-"] },
  { cle: "VC1F3", nom: "une argile à blocs anguleux VC1F3", meteos: ["=", "-"] },
  { cle: "VC2S21", nom: "un sable à gros éléments roulés VC2S21", meteos: ["=", "-"] },
  { cle: "CH2", nom: "une craie dense CH2", meteos: ["=", "-"] },
  { cle: "R4 Cl", nom: "une roche argileuse R4 Cl", meteos: ["=", "-"] },
];
const CAS_METEO = [
  { cle: "F1", nom: "un limon peu plastique F1" },
  { cle: "F3", nom: "une argile F3" },
  { cle: "I2", nom: "un sable argileux I2" },
  { cle: "S31", nom: "un sable limoneux à grains résistants, sensible à l'eau (S31)" },
  { cle: "S11ins", nom: "un sable propre étalé à grains résistants, insensible à l'eau (S11ins)" },
  { cle: "S21ins", nom: "un sable propre mal gradué à grains résistants, insensible à l'eau (S21ins)" },
  { cle: "S12ins", nom: "un sable propre étalé à grains friables, insensible à l'eau (S12ins)" },
  { cle: "G21ins", nom: "une grave propre mal graduée à grains résistants, insensible à l'eau (G21ins)" },
  { cle: "G31ins", nom: "une grave silteuse à grains résistants, insensible à l'eau (G31ins)" },
  { cle: "G32ins", nom: "une grave silteuse à grains friables, insensible à l'eau (G32ins)" },
  { cle: "G31", nom: "une grave silteuse à grains résistants, sensible à l'eau (G31)" },
  { cle: "VC1G31ins", nom: "un matériau à blocs dont la fraction 0/63 mm est une grave insensible à l'eau (VC1G31ins)" },
  { cle: "CH2", nom: "une craie dense CH2" },
  { cle: "R3 Li", nom: "un calcaire dur concassé R3 Li" },
];

/** Chiffres dont la lecture « remblai » diffère nettement de la lecture « couche de forme » [F1 tableaux 11 et 15]. */
const PIEGES_REMBLAI = { W: { 1: RUBRIQUES_REMBLAI.W.valeurs[1] }, T: { 2: RUBRIQUES_REMBLAI.T.valeurs[2] } };
/** Actions sur la teneur en eau propres au remblai (aération, essorage), distracteurs de la rubrique W. */
const W_REMBLAI = [RUBRIQUES_REMBLAI.W.valeurs[1], RUBRIQUES_REMBLAI.W.valeurs[2]];

/** Ce que permet une situation du tableau : la solution la moins exigeante l'emporte. */
const ISSUES = {
  etat: "emploi possible en l'état (code 0000)",
  granu: "emploi sans traitement, après action sur la granularité",
  traite: "emploi après traitement aux liants seulement",
  non: "pas d'emploi dans cette situation météorologique",
};
function issue(r) {
  if (!r.solutions?.length) return "non";
  const codes = r.solutions.map((s) => s.code);
  if (codes.includes("0000")) return "etat";
  if (codes.some((c) => c[2] === "0")) return "granu";
  return "traite";
}
function lireSituation(r, m) {
  if (r.solutions?.length) return `le tableau donne ${r.solutions.length > 1 ? "les solutions" : "la solution"} ${r.solutions.map((s) => s.code).join(" et ")} → ${ISSUES[issue(r)]}`;
  if (r.situation) return `NON, « ${r.non.replace(/\.$/, "")} » → ${ISSUES.non}`;
  return `la situation ${symbole(m)} n'est pas décrite pour ce matériau → ${ISSUES.non}`;
}

/** Combinaisons des épaisseurs du GTR 2000 tabulées pour les deux arases. */
const CAS_EPAISSEUR = [
  { type: "nonTraite", pf: "PF3", classe: null }, { type: "finChaux", pf: "PF3", classe: null }, { type: "finChauxCiment", pf: "PF3", classe: null },
  ...[3, 4, 5].flatMap((classe) => ["PF3", "PF4"].map((pf) => ({ type: "grenuTraite", pf, classe }))),
];
const NOM_TYPE = {
  nonTraite: () => "grave concassée non traitée, insensible à l'eau",
  finChaux: () => "argile F3 traitée en place à la chaux seule",
  finChauxCiment: () => "limon F1 traité en place à la chaux puis au ciment",
  grenuTraite: (k) => `grave traitée au liant hydraulique, de classe mécanique ${k}`,
};

export default [
  {
    id: "ch11-lmax", titre: "Plus gros éléments et épaisseur de couche", difficulte: 1,
    generer(a) {
      const cas = a.choix(["convient", "epaissir", "ecreter"]);
      const e = cas === "epaissir" ? a.choix([0.25, 0.3, 0.35, 0.4, 0.45]) : a.choix([0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.6]);
      const max = lmaxCoucheForme(e), plafond = lmaxCoucheForme(Infinity);
      const L = cas === "convient" ? a.entre(60, Math.floor((max - 1) / 10) * 10, 10)
        : cas === "epaissir" ? a.entre(Math.floor(max / 10) * 10 + 10, plafond, 10) : a.entre(plafond + 20, 400, 10);
      const mat = a.choix(["tout-venant de carrière calcaire", "grave alluvionnaire à gros éléments", "concassé de roche granitique", "déblais rocheux de calcaire dur concassés"]);
      const mode = a.choix(["centrale", "place"]);
      const OK = "oui : L ne dépasse pas la longueur admise";
      const EC = `non : éliminer les éléments de plus de ${plafond} mm, aucune épaisseur ne les admet`;
      const EP = "non : couches élémentaires plus épaisses (au moins 2 L) ou élimination des plus gros éléments";
      const bonne = L <= max ? OK : L > plafond ? EC : EP;
      const detail = bonne === OK ? `L = ${L} mm ≤ ${fr(max, 3)} mm → ${OK} : la couche ne ségrège pas et le nivellement tient à ± 3 cm.`
        : bonne === EC ? `L = ${L} mm > ${plafond} mm : quelle que soit l'épaisseur, la règle des ${plafond} mm l'exclut → ${EC}.`
          : `L = ${L} mm > e/2 = ${fr(max, 3)} mm, mais ≤ ${plafond} mm → ${EP} : des couches de ${frd((2 * L) / 1000, 2)} m au moins l'admettraient, sinon on écrête à ${fr(max, 3)} mm.`;
      const dmax = DMAX_TRAITE[mode];
      return {
        enonce: `On prévoit une couche de forme non traitée en ${mat}, mise en œuvre en couches élémentaires de ${frd(e, 2)} m après compactage. Les plus gros éléments mesurent L = ${L} mm (plus grande dimension). Variante étudiée : traiter ce matériau au liant hydraulique, malaxé ${mode === "centrale" ? "en centrale" : "en place"}.`,
        donnees: [donnee("Couche élémentaire compactée", `${frd(e, 2)} m`), donnee("Plus gros éléments L", `${L} mm`), donnee("Variante traitée", mode === "centrale" ? "malaxage en centrale" : "malaxage en place")],
        questions: [
          nombre("Plus grande longueur admise Lmax ?", max, "mm",
            `Couche de forme non traitée : Lmax ≤ ${plafond} mm et Lmax ≤ e/2 = ${fr(1000 * e, 3)} mm / 2 = ${fr(500 * e, 3)} mm [F1 § 4.2.1] ; Lmax admise = min(${plafond} ; ${fr(500 * e, 3)}) = ${fr(max, 3)} mm.`, { abs: 0.5 }),
          choixMelange(a, `Le matériau, à L = ${L} mm, convient-il ?`, [bonne, ...[OK, EC, EP].filter((x) => x !== bonne)], detail),
          choixMelange(a, `Variante traitée, malaxée ${mode === "centrale" ? "en centrale" : "en place"} : quel Dmax faut-il respecter ?`,
            [`${dmax} mm`, ...["63 mm", "100 mm", "50 mm", "250 mm"].filter((x) => x !== `${dmax} mm`)].slice(0, 4),
            `Matériau traité : Dmax ${DMAX_TRAITE.centrale} mm pour un malaxage en centrale, ${DMAX_TRAITE.place} mm en place [F1 § 4.2.1] → ${dmax} mm. Les ${plafond} mm valent pour le non traité ; 50 mm était le seuil des gros éléments du GTR 1992.`),
        ],
      };
    },
  },
  {
    id: "ch11-code", titre: "Lire un code G W T S de couche de forme", difficulte: 1,
    generer(a) {
      const c = a.choix(CAS_CODES), m = a.choix(c.meteos);
      const r = conditionsCoucheForme(c.cle, m);
      const avecTrois = r.solutions.filter((s) => s.decode.filter((d) => d.valeur !== 0).length >= 3);
      const sol = a.choix(avecTrois.length ? avecTrois : r.solutions);
      const ordre = ["G", "T", "S", "W"];
      const lus = sol.decode.filter((d) => d.valeur !== 0).sort((x, y) => ordre.indexOf(x.rubrique) - ordre.indexOf(y.rubrique)).slice(0, 3)
        .sort((x, y) => "GWTS".indexOf(x.rubrique) - "GWTS".indexOf(y.rubrique));
      const question = (d) => {
        // Piège : le même chiffre lu dans la grille du remblai, quand son sens diffère nettement.
        const piege = PIEGES_REMBLAI[d.rubrique]?.[d.valeur] ?? null;
        let fausses = RUBRIQUES_CDF[d.rubrique].valeurs.filter((t) => t !== d.texte);
        if (d.rubrique === "W") fausses = [...fausses, ...W_REMBLAI];
        if (piege) fausses = fausses.filter((t) => t !== piege && !(piege.includes("chaux seule") && t === "chaux seule"));
        const autres = [...(piege ? [piege] : []), ...a.tirage(fausses, piege ? 2 : 3)];
        return choixMelange(a, `Que demande le chiffre ${d.rubrique} = ${d.valeur} (${d.nom.toLowerCase()}) ?`, [d.texte, ...autres],
          `Couche de forme, code G W T S [F1 tableau 15] : ${d.rubrique} = ${d.valeur} → ${d.texte}.${piege ? ` Lu avec les rubriques du remblai (code à sept chiffres E G W T R C H), le même chiffre voudrait dire « ${piege} » : les deux grilles ne se mélangent pas.` : ""}`);
      };
      return {
        enonce: `Pour ${c.nom}, par ${METEO[m]}, le tableau des conditions d'utilisation en couche de forme (GTR 2024, fascicule 2, annexe 3, p. ${r.cas.page}) donne ${r.solutions.length > 1 ? "entre autres " : ""}la solution codée ${sol.code}. Les quatre chiffres se lisent dans l'ordre G W T S.`,
        donnees: [donnee("Matériau", c.cle), donnee("Météo", symbole(m)), donnee("Code", sol.code)],
        questions: lus.map(question),
      };
    },
  },
  {
    id: "ch11-meteo", titre: "Couche de forme : selon le temps qu'il fait", difficulte: 2,
    generer(a) {
      const c = a.choix(CAS_METEO);
      const m1 = a.choix(["=", "-"]), m2 = a.choix(["++", "+", "+", "+"]);
      const r1 = conditionsCoucheForme(c.cle, m1), r2 = conditionsCoucheForme(c.cle, m2), rN = conditionsCoucheForme(c.cle, "=");
      const options = Object.values(ISSUES);
      const traitements = [...new Set(rN.solutions.map((s) => s.decode.find((d) => d.rubrique === "T")).filter((d) => d.valeur !== 0).map((d) => d.texte))];
      const bonneT = traitements.join(" ou ");
      const faussesT = RUBRIQUES_CDF.T.valeurs.filter((t) => t !== "pas de condition particulière" && !traitements.includes(t));
      const codesT = rN.solutions.filter((s) => s.code[2] !== "0").map((s) => s.code);
      return {
        enonce: `On envisage d'employer en couche de forme ${c.nom}. Le géotechnicien consulte le tableau de l'annexe 3 du fascicule 2 (GTR 2024, p. ${rN.cas.page}) pour deux situations météorologiques : ${METEO[m1]}, puis ${METEO[m2]}.`,
        donnees: [donnee("Matériau", c.cle), donnee("Situations", `« ${symbole(m1)} » puis « ${symbole(m2)} »`)],
        questions: [
          choixMelange(a, `Par ${METEO[m1]}, que permet le tableau ?`, [ISSUES[issue(r1)], ...options.filter((o) => o !== ISSUES[issue(r1)])],
            `${c.cle} par ${symbole(m1)} : ${lireSituation(r1, m1)}.`),
          choixMelange(a, `Par ${METEO[m2]} ?`, [ISSUES[issue(r2)], ...options.filter((o) => o !== ISSUES[issue(r2)])],
            `${c.cle} par ${symbole(m2)} : ${lireSituation(r2, m2)}. ${issue(r2) === "non" ? "Sous la pluie, ni l'état hydrique d'un mélange traité ni la mise en œuvre ne seraient maîtrisés." : "Matériau insensible à l'eau, à grains résistants : la pluie ne change pas sa portance, il se met en œuvre sans traitement."}`),
          choixMelange(a, "Par temps neutre (=), quel traitement le tableau prévoit-il pour ce matériau ?", [bonneT, ...a.tirage(faussesT, 3)],
            `Solution${codesT.length > 1 ? "s" : ""} avec traitement : ${codesT.join(" et ")} ; chiffre T → ${bonneT}. La chaux seule n'est admise en couche de forme que pour les sols F3.`),
        ],
      };
    },
  },
  {
    id: "ch11-zone", titre: "Classe mécanique d'un matériau traité", difficulte: 2,
    generer(a) {
      const d = tirer(a, (a) => {
        const E = a.choix([2000, 2500, 3000, 4000, 5000, 6000, 8000, 10000, 12000, 15000, 20000, 25000]);
        const cible = a.choix([1, 2, 2, 3, 3, 4, 4, 5, 6]), f = frontieres(E);
        const Rt0 = cible === 1 ? f[0] * a.entre(1.12, 1.4, 0.01) : cible === 6 ? f[4] * a.entre(0.65, 0.88, 0.01)
          : f[cible - 1] * (f[cible - 2] / f[cible - 1]) ** a.entre(0.25, 0.75, 0.05);
        const RTB = Math.round((Rt0 / 0.8) * 100) / 100;
        return { E, RTB, Rt: 0.8 * RTB, f };
      }, ({ Rt, f }) => Math.min(...f.map((x) => Math.abs(Math.log(Rt / x)))) > Math.log(1.06));
      const { E, RTB, Rt, f } = d;
      const mode = a.choix(["centrale", "place"]), autre = mode === "centrale" ? "place" : "centrale";
      const mat = a.choix(["une grave traitée au liant hydraulique routier", "un sable traité au ciment", "une grave traitée aux laitiers et à la chaux"]);
      const z = zoneMecanique({ E, Rt }).zone;
      const cl = classeMecanique(z, mode);
      const k = z ?? 6;
      const voisins = [k - 1, k + 1, k - 2, k + 2, k + 3, k - 3].filter((x) => x >= 1 && x <= 6).slice(0, 3).map((x) => nomZone(x === 6 ? null : x));
      const classes = [cl, classeMecanique(z, autre), z, ...(cl ? [cl + 1, cl - 1] : [5, 4])].map((x) => (x >= 1 && x <= 5 ? x : null));
      const optionsClasse = [...new Set(classes.map(nomClasse))];
      for (const x of ["classe 3", "classe 4", "classe 5", "non classable", "classe 2"]) if (optionsClasse.length < 4 && !optionsClasse.includes(x)) optionsClasse.push(x);
      const position = z === 1 ? `au-dessus de la frontière de la zone 1 (${frd(f[0], 2)} MPa)`
        : z ? `entre la frontière de la zone ${z} (${frd(f[z - 1], 2)} MPa) et celle de la zone ${z - 1} (${frd(f[z - 2], 2)} MPa)`
          : `sous la frontière de la zone 5 (${frd(f[4], 2)} MPa)`;
      return {
        enonce: `Pour une couche de forme, on étudie ${mat}, malaxé${mat.startsWith("une") ? "e" : ""} ${mode === "centrale" ? "en centrale" : "en place"}. À 90 jours, sur des éprouvettes moulées à la compacité visée en fond de couche, le module vaut E = ${fr(E, 3)} MPa et l'essai de fendage donne RTB = ${frd(RTB, 2)} MPa (Rt = 0,8 RTB). L'abaque est celui du guide, aux frontières numérisées à quelques pour cent près.`,
        donnees: [donnee("E à 90 jours", `${fr(E, 3)} MPa`), donnee("RTB à 90 jours", `${frd(RTB, 2)} MPa`), donnee("Malaxage", mode === "centrale" ? "en centrale" : "en place")],
        figure: abaque(E),
        questions: [
          nombre("Résistance en traction directe Rt ?", Rt, "MPa", `Rt = 0,8 RTB = 0,8 × ${frd(RTB, 2)} = ${frd(Rt, 3)} MPa.`, { rel: 0.01 }),
          choixMelange(a, "Zone de l'abaque ?", [nomZone(z), ...voisins],
            `À E = ${fr(E, 3)} MPa, les frontières inférieures des zones 1 à 5 passent à Rt = ${f.map((x) => frd(x, 2)).join(" ; ")} MPa. Rt = ${frd(Rt, 3)} MPa tombe ${position} : ${nomZone(z)}.`),
          choixMelange(a, "Classe mécanique du matériau ?", [nomClasse(cl), ...optionsClasse.filter((o) => o !== nomClasse(cl)).slice(0, 3)],
            `${mode === "centrale" ? "Malaxage en centrale : la classe est celle de la zone" : "Malaxage en place : le mélange est moins homogène, la classe descend d'un rang"} [F1 § 4.2.1, tableau 14] : ${nomZone(z)} → ${nomClasse(cl)}.${z ? ` En ${autre === "centrale" ? "centrale" : "place"}, ce serait ${nomClasse(classeMecanique(z, autre))}.` : ""}`),
        ],
      };
    },
  },
  {
    id: "ch11-rt-mini", titre: "Quelle résistance viser pour une classe mécanique ?", difficulte: 3,
    generer(a) {
      const E = a.choix([3000, 4000, 5000, 6000, 8000, 10000, 12000, 15000, 20000]);
      const mode = a.choix(["centrale", "place"]), classe = a.choix([3, 4, 5]);
      // Inversion du classement : la zone dont la classe, dans ce mode, est la classe visée.
      const zone = [1, 2, 3, 4, 5].find((z) => classeMecanique(z, mode) === classe);
      const f = frontieres(E), Rt = f[zone - 1], RTB = Rt / 0.8;
      const fausses = [classe, zone - 1, zone + 1, zone + 2, zone - 2, zone + 3, zone - 3].filter((x) => x >= 1 && x <= 5 && x !== zone);
      return {
        enonce: `Une couche de forme sera traitée au liant hydraulique ${mode === "centrale" ? "en centrale" : "en place"}. Le dimensionnement suppose un matériau de classe mécanique ${classe} au moins, et l'étude de formulation table sur un module de ${fr(E, 3)} MPa à 90 jours. Quelle résistance faut-il atteindre ?`,
        donnees: [donnee("Classe visée", String(classe)), donnee("Malaxage", mode === "centrale" ? "en centrale" : "en place"), donnee("E à 90 jours", `${fr(E, 3)} MPa`)],
        figure: abaque(E),
        questions: [
          choixMelange(a, "Zone de l'abaque à atteindre au moins ?", [`zone ${zone}`, ...[...new Set(fausses)].slice(0, 3).map((x) => `zone ${x}`)],
            `${mode === "centrale" ? "En centrale, classe = zone" : "En place, la classe descend d'un rang par rapport à la zone"} [F1 tableau 14] : la classe ${classe} demande la zone ${zone}.`),
          nombre("Résistance en traction directe minimale Rt à 90 jours ?", Rt, "MPa",
            `On lit, à E = ${fr(E, 3)} MPa, la frontière inférieure de la zone ${zone} : Rt ≈ ${frd(Rt, 3)} MPa (lecture d'abaque, à quelques pour cent près).`, { rel: 0.05 }),
          nombre("Résistance au fendage RTB correspondante ?", RTB, "MPa", `Rt = 0,8 RTB, donc RTB = Rt/0,8 = ${frd(Rt, 3)}/0,8 = ${frd(RTB, 3)} MPa.`, { rel: 0.05 }),
        ],
      };
    },
  },
  {
    id: "ch11-epaisseur", titre: "Épaisseur de couche de forme (tableaux du GTR 2000)", difficulte: 1,
    generer(a) {
      const c = a.choix(CAS_EPAISSEUR), ar = a.choix(["AR1", "AR2"]), autre = ar === "AR1" ? "AR2" : "AR1";
      const B = a.entre(8.5, 14, 0.5), Lkm = a.entre(0.6, 2.5, 0.1);
      const r = epaisseur2000({ type: c.type, ar, pf: c.pf, classe: c.classe });
      const r2 = epaisseur2000({ type: c.type, ar: autre, pf: c.pf, classe: c.classe });
      const V = r.e * B * Lkm * 1000, dV = Math.abs(r.e - r2.e) * B * Lkm * 1000;
      return {
        enonce: `Sur une section de ${frd(Lkm, 1)} km, la plateforme de terrassement mesure ${frd(B, 1)} m de large ; l'arase est de classe ${ar} (${MODULE_AR[ar]} MPa) et l'on vise une plateforme ${c.pf}. La couche de forme est en ${NOM_TYPE[c.type](c.classe)}. On prend les épaisseurs tabulées du GTR 2000 (fascicule I, tableaux XIII, XIV et XVI) comme référence : celles du GTR 2024 (F1 § 4.3.5), qui intègrent la classe PF2qs, se lisent dans le guide.`,
        donnees: [donnee("Arase", `${ar} (${MODULE_AR[ar]} MPa)`), donnee("Plateforme visée", c.pf), donnee("Couche de forme", c.type === "grenuTraite" ? `grave traitée, classe ${c.classe}` : NOM_TYPE[c.type]()), donnee("Section", `${frd(Lkm, 1)} km × ${frd(B, 1)} m`)],
        questions: [
          nombre("Épaisseur de couche de forme selon le GTR 2000 ?", r.e, "m",
            `Tableau du GTR 2000 pour ce matériau, de ${ar} à ${c.pf} : e = ${frd(r.e, 2)} m${r.notes.length ? ` (${r.notes.join(" ; ")})` : ""}.`, { abs: 0.005 }),
          nombre("Volume de couche de forme compactée sur la section ?", V, "m³", `V = e × largeur × longueur = ${frd(r.e, 2)} × ${frd(B, 1)} × ${fr(Lkm * 1000, 4)} = ${fr(V, 4)} m³.`, { rel: 0.01 }),
          nombre(ar === "AR1" ? "Volume économisé si un drainage garantissait une arase AR2 ?" : "Volume supplémentaire si l'arase n'était que AR1 ?", dV, "m³",
            `Avec ${autre}, le même tableau donne ${frd(r2.e, 2)} m ; ΔV = ${frd(Math.abs(r.e - r2.e), 2)} × ${frd(B, 1)} × ${fr(Lkm * 1000, 4)} = ${fr(dV, 4)} m³. La portance de l'arase se paie en épaisseur de couche de forme.`, { rel: 0.01 }),
        ],
      };
    },
  },
  {
    id: "ch11-bicouche", titre: "Module en surface d'une couche de forme : modèle bicouche", difficulte: 2,
    generer(a) {
      const d = tirer(a, (a) => {
        const t = a.choix([
          { nom: "grave non traitée", E1: a.entre(300, 450, 50), traitee: false },
          { nom: "limon traité à la chaux et au ciment", E1: a.entre(600, 1000, 100), traitee: true },
          { nom: "grave traitée au liant hydraulique", E1: a.entre(3000, 6000, 500), traitee: true },
        ]);
        const ar = a.choix(["AR1", "AR2"]), h = a.entre(0.3, 0.8, 0.05);
        return { ...t, ar, E2: MODULE_AR[ar], h, r: bicouche({ E1: t.E1, E2: MODULE_AR[ar], h }) };
      }, ({ r }) => CLASSES_PF.every((c) => Math.abs(r.Es / c.min - 1) > 0.025));
      const { nom, E1, E2, ar, h, r, traitee } = d;
      const pf = classePlateforme(r.Es);
      const noms = CLASSES_PF.map((c) => c.classe), i = noms.indexOf(pf);
      const voisins = [i - 1, i + 1, i - 2, i + 2, i + 3, i - 3].filter((j) => j >= 0 && j < noms.length).slice(0, 3).map((j) => noms[j]);
      const c = CLASSES_PF.find((x) => x.classe === pf);
      return {
        enonce: `Une couche de forme en ${nom} (E1 = ${fr(E1, 4)} MPa), épaisse de ${frd(h, 2)} m, repose sur une arase ${ar} (E2 = ${E2} MPa). On estime le module que mesurerait à sa surface une plaque de 600 mm (rayon a = 0,30 m) par le modèle d'Odemark–Boussinesq du cours : he = 0,9 h (E1/E2)^(1/3), f = 1/√(1 + (he/a)²), 1/Es = (1 − f)/E1 + f/E2.`,
        donnees: [donnee("E1 · h", `${fr(E1, 4)} MPa · ${frd(h, 2)} m`), donnee("Arase", `${ar} · E2 = ${E2} MPa`), donnee("Plaque", "a = 0,30 m")],
        figure: coupeBicouche({ h, E1, E2, ar, traitee }),
        questions: [
          nombre("Épaisseur équivalente he ?", r.he, "m", `he = 0,9 × ${frd(h, 2)} × (${fr(E1, 4)}/${E2})^(1/3) = 0,9 × ${frd(h, 2)} × ${frd(Math.cbrt(E1 / E2), 3)} = ${frd(r.he, 3)} m.`, { rel: 0.015 }),
          nombre("Facteur f ?", r.f, "", `f = 1/√(1 + (${frd(r.he, 3)}/0,30)²) = ${frd(r.f, 3)} : la part de la déflexion qui vient de l'arase.`, { rel: 0.02 }),
          nombre("Module en surface Es ?", r.Es, "MPa", `1/Es = (1 − ${frd(r.f, 3)})/${fr(E1, 4)} + ${frd(r.f, 3)}/${E2} = ${fr(1 / r.Es, 3)} MPa⁻¹ → Es = ${fr(r.Es, 3)} MPa.`, { rel: 0.02 }),
          choixMelange(a, "Classe de plateforme correspondante ?", [pf, ...voisins],
            `Es = ${fr(r.Es, 3)} MPa : ${pf} (${Number.isFinite(c.max) ? `${c.min} à ${c.max} MPa` : `${c.min} MPa et plus`} ; seuils 20, 50, 80, 120 et 200 MPa). Un modèle d'enseignement : il montre l'effet de l'épaisseur et de la raideur, les tableaux du guide font foi.`),
        ],
      };
    },
  },
  {
    id: "ch11-bicouche-inverse", titre: "Épaisseur pour une plateforme : modèle bicouche et GTR 2000", difficulte: 3,
    generer(a) {
      const t = a.choix([
        { type: "nonTraite", nom: "grave concassée non traitée", E1: a.entre(350, 450, 50), classe: null },
        { type: "finChaux", nom: "argile F3 traitée à la chaux seule", E1: a.entre(500, 700, 100), classe: null },
        { type: "finChauxCiment", nom: "limon F1 traité à la chaux et au ciment", E1: a.entre(800, 1200, 100), classe: null },
        { type: "grenuTraite", nom: "grave traitée au liant hydraulique", E1: a.entre(4000, 6000, 500), classe: a.choix([3, 4, 5]) },
      ]);
      const ar = a.choix(["AR1", "AR2"]), E2 = MODULE_AR[ar];
      const pf = t.type === "grenuTraite" ? a.choix(["PF3", "PF4"]) : "PF3";
      const Ev = CLASSES_PF.find((c) => c.classe === pf).min;
      const h = epaisseurPour({ E1: t.E1, E2, Evise: Ev });
      const r = bicouche({ E1: t.E1, E2, h });
      const g = epaisseur2000({ type: t.type, ar, pf, classe: t.classe });
      const bonne = "celle des tableaux du guide : le modèle ignore la fatigue, le gel et le trafic de chantier";
      return {
        enonce: `On vise une plateforme ${pf} (EV2 ≥ ${Ev} MPa) sur une arase ${ar} (E2 = ${E2} MPa), avec une couche de forme en ${t.nom}${t.classe ? ` de classe mécanique ${t.classe}` : ""}, de module E1 = ${fr(t.E1, 4)} MPa. Modèle bicouche du cours (plaque de rayon a = 0,30 m) : he = 0,9 h (E1/E2)^(1/3), f = 1/√(1 + (he/a)²), 1/Es = (1 − f)/E1 + f/E2.`,
        donnees: [donnee("Plateforme visée", `${pf} (${Ev} MPa)`), donnee("Arase", `${ar} · ${E2} MPa`), donnee("E1", `${fr(t.E1, 4)} MPa`)],
        questions: [
          nombre(`Valeur de f qui donne Es = ${Ev} MPa ?`, r.f, "", `f = (1/Es − 1/E1)/(1/E2 − 1/E1) = (1/${Ev} − 1/${fr(t.E1, 4)})/(1/${E2} − 1/${fr(t.E1, 4)}) = ${frd(r.f, 3)}.`, { rel: 0.02 }),
          nombre("Épaisseur donnée par le modèle bicouche ?", h, "m",
            `he = a √(1/f² − 1) = 0,30 × √(1/${frd(r.f, 3)}² − 1) = ${frd(r.he, 3)} m ; h = he / [0,9 (E1/E2)^(1/3)] = ${frd(r.he, 3)} / (0,9 × ${frd(Math.cbrt(t.E1 / E2), 3)}) = ${frd(h, 3)} m.`, { rel: 0.03 }),
          nombre("Épaisseur tabulée par le GTR 2000 pour ce cas ?", g.e, "m", `GTR 2000, de ${ar} à ${pf} pour ce matériau : ${frd(g.e, 2)} m${g.notes.length ? ` (${g.notes.join(" ; ")})` : ""}. Le GTR 2024 (F1 § 4.3.5) a ses propres tableaux.`, { abs: 0.005 }),
          choixMelange(a, "Quelle épaisseur retenir pour le projet ?", [bonne, "celle du modèle, puisqu'elle est calculée", "la plus faible des deux, par économie", "la moyenne des deux"],
            `Le modèle donne ${frd(h, 2)} m, le tableau ${frd(g.e, 2)} m : le modèle n'est qu'un outil de compréhension. On retient ${bonne}. La vérification au gel (NF P98-086) peut encore l'augmenter.`),
        ],
      };
    },
  },
];
