// Exercices du chapitre 4 : les matériaux rocheux — Los Angeles et
// micro-Deval, friabilité des sables, calcaires, roches salines,
// fragmentabilité et dégradabilité des roches argileuses, craies, roches
// siliceuses, et la correspondance avec les familles du GTR 1992.
import { fr, frd, nombre, choixMelange, donnee } from "./alea.js";
import { losAngeles, microDeval, friabiliteSables, fragmentabilite, degradabilite } from "../gtr/roches.js";
import { classerRoche, classerSol, etatHydrique } from "../gtr/classification.js";
import { ROCHES_1992_2024 } from "../gtr/classification92.js";
import { wSaturation, rhoDSaturation } from "../gtr/proctor.js";
import { diametre, passant } from "../gtr/granulo.js";
import { graphe, courbeGranulo, echantillon, COULEURS } from "../figures.js";

const pc = (x, d = 1) => `${frd(x, d)} %`;
const arrondi = (x, n = 1) => Math.round(x * 10 ** n) / 10 ** n;
const sig3 = (x) => Number(x.toPrecision(3));
/** Une valeur mesurée reste-t-elle à distance de chacun des seuils ? (une valeur absente ne gêne pas) */
const loin = (x, seuils, marge) => !Number.isFinite(x) || seuils.every((s) => Math.abs(x - s) >= marge);

/** Détail de la lecture de D10 sur une courbe : les deux tamis qui encadrent 10 % et l'interpolation en log d. */
function detailD10(points, D) {
  for (let i = 1; i < points.length; i++) {
    const [d0, p0] = points[i - 1], [d1, p1] = points[i];
    if (p0 <= 10 && p1 >= 10 && p1 > p0) return `10 % entre ${fr(d0, 3)} mm (${pc(p0)}) et ${fr(d1, 3)} mm (${pc(p1)}) : D10 = ${fr(d0, 3)} × (${fr(d1, 3)}/${fr(d0, 3)})^((10 − ${frd(p0, 1)})/(${frd(p1, 1)} − ${frd(p0, 1)})) = ${fr(D, 3)} mm.`;
  }
  return `D10 = ${fr(D, 3)} mm.`;
}

/** Famille du GTR 1992 qui correspond à une famille du GTR 2024 (tableau de correspondance du solveur). */
const famille1992 = (f) => ROCHES_1992_2024.find(([, , f24]) => f24.split(", ").includes(f));
const OPTIONS_1992 = ROCHES_1992_2024.map(([r, nom]) => `${r} : ${nom}`);

/** Lecture du classement d'une roche argileuse pour le remblai (cours, chapitre 4). */
const SENS_CL = {
  R5: "elle se réduira en grande partie en sol fin sous les engins : son emploi dépendra de sa teneur en eau, comme un sol",
  Cld1: "elle se mettra en œuvre comme un rocher puis se délitera à l'eau dans l'ouvrage : la fragmenter et la compacter intensément, en couches minces",
  Cld2: "dégradable : fragmentation complémentaire et compactage soigné pour limiter les vides et l'évolution",
  dur: "peu évolutive : elle se comportera durablement comme un matériau rocheux",
};
const sensCl = (sc) => (sc.startsWith("R5") ? SENS_CL.R5 : sc === "R4 Cld1" ? SENS_CL.Cld1 : sc === "R4 Cld2" ? SENS_CL.Cld2 : SENS_CL.dur);

/** Abaque des craies : classes de densité, puis états hydriques des craies CH3 et CH4 (même découpage que le cours). */
function figureCraies() {
  const TEINTE = { th: "#1e3a8a", h: "#3b82f6", m: "#22c55e", s: "#f59e0b", ts: "#b45309" };
  const bande = (x0, x1, y0, y1, etat, libelle) => ({ x0, x1, y0, y1, couleur: etat ? TEINTE[etat] : "#64748b", opacite: etat ? 0.22 : 0.1, libelle });
  return graphe({
    largeur: 620, hauteur: 320, xmin: 5, xmax: 45, ymin: 1.3, ymax: 2.3, xlabel: "teneur en eau naturelle wn (%)", ylabel: "ρd (Mg/m³)", pasX: 5, pasY: 0.1,
    zones: [
      bande(5, 45, 1.95, 2.3, null, "CH1 : craie très dense"), bande(5, 45, 1.7, 1.95, null, "CH2 : craie dense"),
      bande(5, 18, 1.55, 1.7, "ts", "CH3ts"), bande(18, 22, 1.55, 1.7, "s", "CH3s"), bande(22, 27, 1.55, 1.7, "m", "CH3m"), bande(27, 45, 1.55, 1.7, "h", "CH3h"),
      bande(5, 16, 1.3, 1.55, "ts", "CH4ts"), bande(16, 21, 1.3, 1.55, "s", "CH4s"), bande(21, 26, 1.3, 1.55, "m", "CH4m"), bande(26, 31, 1.3, 1.55, "h", "CH4h"), bande(31, 45, 1.3, 1.55, "th", "CH4th"),
    ],
    series: [
      ...[1.55, 1.7, 1.95].map((y) => ({ points: [[5, y], [45, y]], couleur: "#475569", epaisseur: 1.2 })),
      { points: echantillon((w) => rhoDSaturation(w, { rhoS: 2.7 }), 5, 45, 60), couleur: COULEURS.bleu, epaisseur: 2, libelle: "saturation (ρs = 2,70 Mg/m³)" },
    ],
  });
}

export default [
  {
    id: "ch4-la-mde", titre: "Los Angeles et micro-Deval d'une roche dure", difficulte: 1,
    generer(a) {
      const fam = a.choix(["Vo", "Me"]);
      const nom = a.choix(fam === "Vo" ? ["un granite", "un basalte", "une diorite", "un porphyre"] : ["un gneiss", "un quartzite", "une amphibolite", "un micaschiste"]);
      const BOITES = {
        R1: (b) => [b.entre(10, 24, 0.1), b.entre(3, 9.4, 0.1)],
        R2: (b) => (b.reel() < 0.5 ? [b.entre(26, 34, 0.1), b.entre(4, 24, 0.1)] : [b.entre(12, 34, 0.1), b.entre(10.6, 24, 0.1)]),
        R3: (b) => (b.reel() < 0.5 ? [b.entre(36, 44, 0.1), b.entre(6, 44, 0.1)] : [b.entre(15, 44, 0.1), b.entre(26, 44, 0.1)]),
        R4: (b) => (b.reel() < 0.5 ? [b.entre(46, 62, 0.1), b.entre(10, 60, 0.1)] : [b.entre(25, 60, 0.1), b.entre(46, 62, 0.1)]),
      };
      const cas = a.choix(Object.keys(BOITES));
      let mLA, mMDE, LA, MDE;
      for (let essai = 0; essai < 40; essai++) {
        const [la, mde] = BOITES[cas](a);
        mLA = Math.round(la * 50); mMDE = arrondi(500 * (1 - mde / 100));
        LA = losAngeles({ passant16: mLA }); MDE = microDeval({ refus16: mMDE });
        if (loin(LA, [25, 35, 45], 0.5) && loin(MDE, [10, 25, 45], 0.5)) break;
      }
      const IFR = a.entre(1.1, 3, 0.1);
      const r = classerRoche(fam, { LA, MDE, IFR });
      const g = classerSol({ Dmax: 31.5, p63um: 3, p2mm: 28, Cu: 25, fractionSable: 25, fractionGrave: 72, LA, MDE });
      const classes = ["R1", "R2", "R3", "R4"].map((k) => `${k} ${fam}`);
      const NOMS = { R1: "extrêmement dure", R2: "très dure", R3: "dure", R4: "dureté moyenne" };
      const lib = (sc) => `${sc} : ${NOMS[sc.split(" ")[0]]}`;
      const dur = g.comportement.endsWith("1");
      return {
        enonce: `Les granulats 10/14 mm d'${nom} ${nom.startsWith("une ") ? "saine" : "sain"}, ${fam === "Vo" ? "roche magmatique" : "roche métamorphique"} (famille ${fam}), passent aux deux essais d'usure. Los Angeles : sur 5 000 g, ${fr(mLA, 4)} g passent au tamis de 1,6 mm après 500 tours. Micro-Deval en présence d'eau : sur 500 g, il reste ${frd(mMDE, 1)} g sur le tamis de 1,6 mm après 12 000 tours. Sa fragmentabilité est faible (IFR = ${frd(IFR, 1)}).`,
        donnees: [donnee("Roche", nom.replace(/^une? /, "")), donnee("LA : passant 1,6 mm", `${fr(mLA, 4)} g / 5 000 g`), donnee("MDE : refus 1,6 mm", `${frd(mMDE, 1)} g / 500 g`), donnee("IFR", frd(IFR, 1))],
        questions: [
          nombre("Coefficient Los Angeles LA ?", LA, "", `LA = 100 m/M = 100 × ${fr(mLA, 4)} / 5 000 = ${frd(LA, 1)}.`, { rel: 0.01 }),
          nombre("Coefficient micro-Deval MDE ?", MDE, "", `MDE = 100 (M − m)/M = 100 × (500 − ${frd(mMDE, 1)}) / 500 = ${frd(MDE, 1)}.`, { rel: 0.01 }),
          choixMelange(a, "Classe de résistance de la roche au GTR 2024 ?", [lib(r.sousClasse), ...classes.filter((c) => c !== r.sousClasse).map(lib)],
            `Roches magmatiques et métamorphiques : R1 si LA ≤ 25 et MDE ≤ 10, R2 si LA ≤ 35 et MDE ≤ 25, R3 si LA ≤ 45 et MDE ≤ 45, R4 au-delà (IFR ≤ 7). LA = ${frd(LA, 1)}, MDE = ${frd(MDE, 1)} → ${r.sousClasse}, ${r.nom}. Plus le coefficient est faible, plus la roche résiste.`),
          choixMelange(a, "Concassée en grave 0/31,5 propre et étalée (G1), elle aurait un comportement…", [dur ? "G11 : grains résistants au trafic" : "G12 : grains qui se fragmentent sous le trafic", dur ? "G12 : grains qui se fragmentent sous le trafic" : "G11 : grains résistants au trafic", "sans objet : le comportement ne se juge que pour les sables (FS)"],
            `Graves : comportement 1 si LA ≤ 45 et MDE ≤ 45, 2 sinon [F2 annexe 1] → ${g.comportement}. Ce paramètre ne sert qu'à juger l'emploi en couche de forme, où les grains subissent le trafic de chantier.`),
        ],
      };
    },
  },
  {
    id: "ch4-fs", titre: "Friabilité d'un sable et symbole complet", difficulte: 1,
    generer(a) {
      let m, FS, r, p63um, p2mm, Cu, VBS, w, wOPN;
      for (let essai = 0; essai < 60; essai++) {
        m = arrondi(a.entre(12, 95, 0.5) * 5);
        FS = friabiliteSables({ fines: m });
        p63um = a.entre(1, 12, 0.5); p2mm = a.entre(76, 98, 1); Cu = a.entre(1.8, 14, 0.1); VBS = a.entre(0.03, 0.6, 0.01);
        wOPN = a.entre(8, 14, 0.1); w = arrondi(wOPN * a.entre(0.55, 1.3, 0.01));
        r = classerSol({ Dmax: 4, p63um, p2mm, Cu, VBS, FS, w, wOPN });
        if (r.applicable && r.etat && loin(FS, [60], 0.6) && loin(Cu, [6], 0.3) && loin(p63um, [5, 10, 12], 0.4) && loin(VBS, [0.1, 0.2], 0.015) && loin(w / wOPN, [0.5, 0.9, 1.1, 1.25], 0.015)) break;
      }
      const autreComp = `${r.sousClasse}${r.comportement.endsWith("1") ? 2 : 1}`;
      // Symbole : comportement × (état ou ins), chaque valeur deux fois sur quatre options — rien n'y trahit la question 2.
      const etatAlt = r.etat === "ins" ? etatHydrique("S>70", { w, wOPN }).etat : "ins";
      const symboles = [r.symbole, `${autreComp}${etatAlt}`, `${r.comportement}${etatAlt}`, `${autreComp}${r.etat}`];
      return {
        enonce: `Un sable concassé 0/4 mm est soumis à l'essai de friabilité : 500 g de sa fraction 0,2/2 mm, broyés avec des billes dans le cylindre du micro-Deval, produisent ${frd(m, 1)} g de fines. Par ailleurs (fraction 0/63 mm) : tamisat à 63 µm ${pc(p63um)}, tamisat à 2 mm ${pc(p2mm, 0)}, Cu = ${frd(Cu, 1)}, VBS = ${frd(VBS, 2)} ; teneur en eau ${pc(w)} pour un optimum à ${pc(wOPN)}.`,
        donnees: [donnee("Fines produites", `${frd(m, 1)} g / 500 g`), donnee("Fines (63 µm)", pc(p63um)), donnee("Passant 2 mm", pc(p2mm, 0)), donnee("Cu", frd(Cu, 1)), donnee("VBS", frd(VBS, 2)), donnee("wn · wOPN", `${pc(w)} · ${pc(wOPN)}`)],
        questions: [
          nombre("Coefficient de friabilité FS ?", FS, "", `FS = 100 m/M = 100 × ${frd(m, 1)} / 500 = ${frd(FS, 1)}.`, { rel: 0.01 }),
          choixMelange(a, "Comportement mécanique du sable ?", [r.comportement, autreComp, "sans objet : le comportement d'un sable se juge au Los Angeles"],
            `Sables : comportement 1 si FS ≤ 60, 2 sinon [F2 annexe 1]. FS = ${frd(FS, 1)} → ${r.comportement} (sous-classe ${r.sousClasse} : fines ${p63um <= 5 ? "≤ 5 %" : "de 5 à 15 %"}, Cu ${Cu >= 6 ? "≥" : "<"} 6).`),
          choixMelange(a, "Symbole complet au GTR 2024 ?", symboles,
            `${r.ins ? `Insensible à l'eau (${r.arbre.find((x) => x.question.startsWith("Insensible")).reponse.replace(/^oui : /, "").replace(/ → suffixe « ins »$/, "")}) : suffixe ins` : `Sensible à l'eau, état hydrique ${r.etat} (wn/wOPN = ${frd(w / wOPN, 2)}, seuils des sables dont le tamisat à 2 mm dépasse 70 %)`} → ${r.symbole}. On lit : nature, comportement, puis état ou « ins ».`),
          choixMelange(a, "À quoi sert le coefficient FS dans le GTR ?", ["à juger l'emploi en couche de forme, où les grains subissent le trafic de chantier", "à fixer l'état hydrique du sable", "à décider si le sable est insensible à l'eau", "à choisir le compacteur du remblai"],
            "FS est un paramètre de comportement mécanique : il dit si le sable produira des fines sous le trafic. Il ne sert qu'à l'emploi en couche de forme ; la sensibilité à l'eau se juge par les fines et la VBS."),
        ],
      };
    },
  },
  {
    id: "ch4-calcaire", titre: "Un calcaire : R3, R4 ou R5 Li ?", difficulte: 1,
    generer(a) {
      const cas = a.choix(["R3", "R4", "R5"]);
      const mde = cas === "R3" ? a.entre(12, 44, 0.1) : a.entre(47, 75, 0.1);
      const rhoCible = cas === "R3" ? a.entre(2.2, 2.65, 0.01) : cas === "R4" ? a.entre(1.84, 2.4, 0.01) : a.entre(1.45, 1.76, 0.01);
      const mMDE = arrondi(500 * (1 - mde / 100)), MDE = microDeval({ refus16: mMDE });
      const V = a.entre(400, 1200, 10), ms = Math.round(rhoCible * V), rhoD = ms / V;
      const r = classerRoche("Li", { MDE, rhoD });
      const classes = ["R3 Li : calcaire dur", "R4 Li : calcaire de dureté moyenne", "R5 Li : calcaire fragmentable", "R4 Cl : roche argileuse peu fragmentable"];
      const bonne = classes.find((c) => c.startsWith(r.sousClasse));
      const f92 = famille1992("Li");
      return {
        enonce: `Un calcaire de déblai est testé. Micro-Deval en présence d'eau : sur 500 g de granulats 10/14 mm, il reste ${frd(mMDE, 1)} g sur le tamis de 1,6 mm. Un bloc taillé de ${fr(V, 4)} cm³ pèse ${fr(ms, 4)} g après séchage à l'étuve.`,
        donnees: [donnee("MDE : refus 1,6 mm", `${frd(mMDE, 1)} g / 500 g`), donnee("Bloc sec", `${fr(ms, 4)} g · ${fr(V, 4)} cm³`)],
        questions: [
          nombre("Coefficient micro-Deval MDE ?", MDE, "", `MDE = 100 × (500 − ${frd(mMDE, 1)}) / 500 = ${frd(MDE, 1)}.`, { rel: 0.01 }),
          nombre("Masse volumique sèche ρd de la roche ?", rhoD, "Mg/m³", `ρd = ${fr(ms, 4)} / ${fr(V, 4)} = ${frd(rhoD, 3)} g/cm³ = ${frd(rhoD, 3)} Mg/m³.`, { rel: 0.005 }),
          choixMelange(a, "Classe du calcaire au GTR 2024 ?", [bonne, ...classes.filter((c) => c !== bonne)],
            `Calcaires : R3 Li si MDE ≤ 45 ; sinon R4 Li si ρd > 1,8 Mg/m³, R5 Li (fragmentable) si ρd ≤ 1,8 Mg/m³. MDE = ${frd(MDE, 1)}, ρd = ${frd(rhoD, 2)} → ${r.sousClasse}.${cas !== "R3" ? " En couche de forme, l'attrition d'un calcaire tendre produit des fines qui le rendent sensible à l'eau." : ""}`),
          choixMelange(a, "Au GTR 1992, les calcaires formaient la famille…", [`${f92[0]} : ${f92[1]}`, ...a.tirage(OPTIONS_1992.filter((o) => !o.startsWith(f92[0])), 3)],
            `Correspondance indicative : ${ROCHES_1992_2024.map(([r92, , f24]) => `${r92} ↔ ${f24}`).join(", ")}. Le GTR 2024 commence le symbole par la classe de résistance (R1 à R5) et garde la famille en suffixe : un R2 de 1992 n'est pas un R2 de 2024.`),
        ],
      };
    },
  },
  {
    id: "ch4-saline", titre: "Roches salines : gypse et sel gemme", difficulte: 1,
    generer(a) {
      const cas = a.choix(["SR1", "SR2", "SR3", "SR4", "SR5"]);
      const [gypse, sel] = cas === "SR1" ? [a.entre(0.2, 1.8, 0.1), 0] : cas === "SR2" ? [a.entre(2.5, 19, 0.5), 0] : cas === "SR3" ? [a.entre(22, 80, 1), 0]
        : cas === "SR4" ? [a.entre(0, 15, 0.5), a.entre(0.1, 0.9, 0.1)] : [a.entre(0, 30, 0.5), a.entre(1.3, 20, 0.1)];
      const r = classerRoche("SR", { gypse, sel });
      const rhoD = a.entre(1.75, 2.1, 0.01), solubles = (1000 * rhoD * (gypse + sel)) / 100;
      const noms = { SR1: "très peu soluble (gypse ≤ 2 %)", SR2: "peu soluble (gypse ≤ 20 %)", SR3: "très soluble (gypse > 20 %)", SR4: "peu soluble (sel gemme ≤ 1 %)", SR5: "très soluble (sel gemme > 1 %)" };
      const lib = (k) => `${k} : ${noms[k]}`;
      return {
        enonce: `Un déblai traverse une formation évaporitique. L'analyse chimique d'un échantillon moyen donne ${pc(gypse)} de gypse et ${sel ? `${pc(sel)} de sel gemme (halite)` : "pas de sel gemme"}. Mis en remblai, le matériau sera compacté à ρd ≈ ${frd(rhoD, 2)} Mg/m³.`,
        donnees: [donnee("Gypse", pc(gypse)), donnee("Sel gemme", sel ? pc(sel) : "0 %"), donnee("ρd en remblai", `${frd(rhoD, 2)} Mg/m³`)],
        questions: [
          choixMelange(a, "Classe de la roche saline au GTR 2024 ?", [lib(r.sousClasse), ...a.tirage(Object.keys(noms).filter((k) => k !== r.sousClasse), 3).map(lib)],
            `Le sel gemme prime : SR5 au-delà de 1 %, SR4 jusqu'à 1 % ; sans sel, le gypse : SR1 jusqu'à 2 %, SR2 jusqu'à 20 %, SR3 au-delà. Ici → ${r.sousClasse}, ${r.nom}.`),
          nombre("Masse d'éléments solubles dans 1 m³ de remblai ?", solubles, "kg", `1 000 × ${frd(rhoD, 2)} × (${frd(gypse, 1)} + ${frd(sel, 1)}) / 100 = ${fr(solubles, 3)} kg par m³ : autant de matière que l'eau peut emporter.`, { rel: 0.02 }),
          choixMelange(a, "Quel est le risque propre à ces roches dans un remblai ?", ["leur dissolution par les circulations d'eau, qui peut créer des vides", "leur fragmentation sous les engins, qui produit des fines", "leur gonflement au gel", "leur trop grande dureté, qui use les compacteurs"],
            "Les roches salines se classent par leur teneur en éléments solubles : leur dissolution par les circulations d'eau peut créer des vides dans le remblai, avec des tassements et des effondrements à la clé [F1 § 2.3]."),
        ],
      };
    },
  },
  {
    id: "ch4-ifr", titre: "Roche argileuse : fragmentable, dégradable ?", difficulte: 2,
    generer(a) {
      const cas = a.choix(["R3 Cl", "R4 Cl", "R4 Cld2", "R4 Cld1"]);
      let Da, Db, Dc, Dd, IFR, IDGa, MDE;
      for (let essai = 0; essai < 40; essai++) {
        const ifr = a.entre(1.3, 6.6, 0.1), idga = cas === "R4 Cld1" ? a.entre(21, 60, 0.5) : cas === "R4 Cld2" ? a.entre(5.5, 19, 0.1) : a.entre(1.1, 4.7, 0.1);
        MDE = cas === "R3 Cl" ? a.entre(15, 44, 1) : a.entre(47, 80, 1);
        Da = a.entre(10.2, 11.5, 0.1); Db = sig3(Da / ifr); Dc = a.entre(10.2, 11.5, 0.1); Dd = sig3(Dc / idga);
        IFR = fragmentabilite({ D10avant: Da, D10apres: Db }); IDGa = degradabilite({ D10avant: Dc, D10apres: Dd });
        if (loin(IFR, [7], 0.15) && loin(IDGa, [5, 20], 0.15)) break;
      }
      const r = classerRoche("Cl", { IFR, IDGa, MDE });
      const classes = ["R3 Cl", "R4 Cl", "R4 Cld2", "R4 Cld1", "R5 Cl"];
      const NOMS = { "R3 Cl": "roche argileuse dure", "R4 Cl": "peu fragmentable, peu dégradable", "R4 Cld2": "peu fragmentable, moyennement dégradable", "R4 Cld1": "peu fragmentable, très dégradable", "R5 Cl": "fragmentable" };
      const lib = (k) => `${k} : ${NOMS[k]}`;
      const sens = Object.values(SENS_CL);
      return {
        enonce: `Une marne compacte de déblai est soumise aux essais d'évolution, sur des échantillons 10/20 mm. Fragmentabilité (100 coups de dame Proctor normal) : D10 = ${fr(Da, 3)} mm avant, ${fr(Db, 3)} mm après. Dégradabilité (cycles d'imbibition et de séchage) : D10 = ${fr(Dc, 3)} mm avant, ${fr(Dd, 3)} mm après. Son micro-Deval vaut MDE = ${fr(MDE)}.`,
        donnees: [donnee("Fragmentabilité · D10", `${fr(Da, 3)} → ${fr(Db, 3)} mm`), donnee("Dégradabilité · D10", `${fr(Dc, 3)} → ${fr(Dd, 3)} mm`), donnee("MDE", fr(MDE))],
        questions: [
          nombre("Coefficient de fragmentabilité IFR ?", IFR, "", `IFR = D10 avant / D10 après = ${fr(Da, 3)} / ${fr(Db, 3)} = ${frd(IFR, 2)} ${IFR > 7 ? "> 7 : fragmentable" : "≤ 7 : peu fragmentable"}.`, { rel: 0.02 }),
          nombre("Coefficient de dégradabilité IDGa ?", IDGa, "", `IDGa = ${fr(Dc, 3)} / ${fr(Dd, 3)} = ${frd(IDGa, 2)} : ${IDGa <= 5 ? "peu dégradable (≤ 5)" : IDGa <= 20 ? "moyennement dégradable (5 à 20)" : "très dégradable (> 20)"}.`, { rel: 0.02 }),
          choixMelange(a, "Classe de la roche argileuse au GTR 2024 ?", [lib(r.sousClasse), ...a.tirage(classes.filter((k) => k !== r.sousClasse), 3).map(lib)],
            `IFR ≤ 7 : la roche n'est pas R5. Puis IDGa et MDE : R3 Cl si IDGa ≤ 5 et MDE ≤ 45 ; R4 Cl si IDGa ≤ 5 et MDE > 45 ; R4 Cld2 si IDGa de 5 à 20 ; R4 Cld1 au-delà de 20. Ici IDGa = ${frd(IDGa, 1)}, MDE = ${fr(MDE)} → ${r.sousClasse}.`),
          choixMelange(a, "Que faut-il en attendre dans le remblai ?", [sensCl(r.sousClasse), ...sens.filter((t) => t !== sensCl(r.sousClasse))],
            `${r.sousClasse} : ${sensCl(r.sousClasse)}. ${r.sousClasse === "R4 Cld1" ? "C'est le cas le plus traître : la marne se transforme en sol fin dans l'ouvrage, avec tassements et glissements à la clé." : "La dégradabilité dit si la roche continuera à se déliter sous l'effet de l'eau."}`),
        ],
      };
    },
  },
  {
    id: "ch4-craie", titre: "Classer une craie : densité, puis teneur en eau", difficulte: 2,
    generer(a) {
      const cas = a.choix(["CH1", "CH2", "CH3", "CH3", "CH4", "CH4"]);
      const SEUILS_W = { CH3: [18, 22, 27], CH4: [16, 21, 26, 31] };
      let V, ms, mh, rhoD, wn, r;
      for (let essai = 0; essai < 60; essai++) {
        const rho = cas === "CH1" ? a.entre(1.97, 2.2, 0.01) : cas === "CH2" ? a.entre(1.72, 1.93, 0.01) : cas === "CH3" ? a.entre(1.57, 1.68, 0.01) : a.entre(1.35, 1.53, 0.01);
        // Craie le plus souvent proche de la saturation ; plus sèche quand elle a été exposée (climat sec, front de taille ancien).
        const w = ((a.reel() < 0.6 ? a.entre(80, 99, 1) : a.entre(45, 80, 1)) * wSaturation(rho, 2.7)) / 100;
        V = a.entre(300, 900, 10); ms = Math.round(rho * V); mh = Math.round(ms * (1 + w / 100));
        rhoD = ms / V; wn = (100 * (mh - ms)) / ms;
        r = classerRoche("CH", { rhoD, wn });
        if (loin(rhoD, [1.55, 1.7, 1.95], 0.008) && (!SEUILS_W[cas] || loin(wn, SEUILS_W[cas], 0.3)) && wn < wSaturation(rhoD, 2.7)) break;
      }
      const wSat = wSaturation(rhoD, 2.7), Sr = (100 * wn) / wSat;
      const LISTE = ["CH1", "CH2", "CH3ts", "CH3s", "CH3m", "CH3h", "CH4ts", "CH4s", "CH4m", "CH4h", "CH4th"];
      const i = LISTE.indexOf(r.sousClasse);
      const voisins = LISTE.filter((x, k) => x !== r.sousClasse && Math.abs(k - i) <= 4);
      return {
        enonce: `Un bloc de craie prélevé au déblai, taillé en un volume de ${fr(V, 4)} cm³, pèse ${fr(mh, 4)} g à l'état naturel et ${fr(ms, 4)} g après étuvage. On prend ρs = 2,70 Mg/m³ pour la calcite.`,
        donnees: [donnee("Volume", `${fr(V, 4)} cm³`), donnee("Masse naturelle", `${fr(mh, 4)} g`), donnee("Masse sèche", `${fr(ms, 4)} g`), donnee("ρs", "2,70 Mg/m³")],
        figure: figureCraies(),
        questions: [
          nombre("Teneur en eau naturelle wn ?", wn, "%", `wn = 100 × (${fr(mh, 4)} − ${fr(ms, 4)}) / ${fr(ms, 4)} = ${pc(wn)}.`, { abs: 0.2 }),
          nombre("Masse volumique sèche ρd ?", rhoD, "Mg/m³", `ρd = ${fr(ms, 4)} / ${fr(V, 4)} = ${frd(rhoD, 3)} Mg/m³.`, { rel: 0.005 }),
          choixMelange(a, "Classe de la craie au GTR 2024 ?", [r.sousClasse, ...a.tirage(voisins, 3)],
            `D'abord la densité : CH1 au-delà de 1,95 Mg/m³, CH2 de 1,7 à 1,95, CH3 de 1,55 à 1,7, CH4 sous 1,55. ρd = ${frd(rhoD, 2)} → ${r.sousClasse.slice(0, 3)}.${/^CH[34]/.test(r.sousClasse) ? ` Puis l'eau, avec des seuils propres à chaque classe (${r.sousClasse.startsWith("CH3") ? "CH3 : 18, 22, 27 %" : "CH4 : 16, 21, 26, 31 %"}) : wn = ${pc(wn)} → ${r.sousClasse}.` : " Les craies denses ne prennent pas d'état hydrique."}`),
          nombre("Teneur en eau qui saturerait cette craie ?", wSat, "%", `w = 100 × (1/ρd − 1/ρs) = 100 × (1/${frd(rhoD, 3)} − 1/2,70) = ${pc(wSat)}.`, { abs: 0.3 }),
          nombre("Degré de saturation de la craie en place ?", Sr, "%", `Sr = ${pc(wn)} / ${pc(wSat)} = ${pc(Sr, 0)}. ${Sr > 90 ? "Une craie peu dense est presque toujours proche de la saturation : au terrassement, l'eau de ses pores passe aux fines produites, qui prennent la consistance d'une pâte." : "La craie n'est pas saturée : ses fines resteront plus fermes au terrassement."}`, { abs: 2 }),
        ],
      };
    },
  },
  {
    id: "ch4-gres", titre: "Grès et poudingues : quatre essais, une classe", difficulte: 2,
    generer(a) {
      const fam = a.choix(["Sa", "Co"]);
      const cas = a.choix(["R3", "R4", "R4d", "R5"]);
      let mLA, mMDE, LA, MDE, IFR, IDGa;
      for (let essai = 0; essai < 40; essai++) {
        const hautLA = a.reel() < 0.5;
        const la = cas === "R3" ? a.entre(18, 44, 0.1) : cas === "R5" ? a.entre(35, 75, 0.1) : hautLA ? a.entre(46, 65, 0.1) : a.entre(28, 60, 0.1);
        const mde = cas === "R3" ? a.entre(8, 44, 0.1) : cas === "R5" ? a.entre(35, 80, 0.1) : hautLA ? a.entre(20, 70, 0.1) : a.entre(46, 70, 0.1);
        IFR = cas === "R5" ? a.entre(7.6, 25, 0.1) : a.entre(1.2, 6.5, 0.1);
        IDGa = cas === "R4d" ? a.entre(5.5, 25, 0.1) : cas === "R5" ? a.entre(2, 40, 0.1) : a.entre(1.05, 4.6, 0.05);
        mLA = Math.round(la * 50); mMDE = arrondi(500 * (1 - mde / 100));
        LA = losAngeles({ passant16: mLA }); MDE = microDeval({ refus16: mMDE });
        if (loin(LA, [45], 0.5) && loin(MDE, [45], 0.5)) break;
      }
      const r = classerRoche(fam, { LA, MDE, IFR, IDGa });
      const nom = fam === "Sa" ? "un grès" : "un poudingue";
      const classes = [`R3 ${fam}`, `R4 ${fam}`, `R4 ${fam}d`, `R5 ${fam}`];
      const NOMS = { R3: "roche siliceuse dure", R4: "dureté moyenne", R4d: "dureté moyenne, dégradable", R5: "fragmentable" };
      const lib = (k) => `${k} : ${NOMS[k.split(" ")[0] + (k.endsWith("d") ? "d" : "")]}`;
      const f92 = famille1992(fam);
      const regle = IFR > 7 ? `IFR = ${frd(IFR, 1)} > 7 : la roche est fragmentable, R5, quels que soient LA et MDE`
        : LA <= 45 && MDE <= 45 ? `IFR ≤ 7 ; LA = ${frd(LA, 1)} et MDE = ${frd(MDE, 1)}, tous deux ≤ 45 : R3`
          : `IFR ≤ 7 ; ${LA > 45 ? `LA = ${frd(LA, 1)}` : `MDE = ${frd(MDE, 1)}`} > 45 : R4, puis IDGa = ${frd(IDGa, 1)} ${IDGa > 5 ? "> 5 : dégradable (suffixe d)" : "≤ 5 : non dégradable"}`;
      return {
        enonce: `${nom.charAt(0).toUpperCase() + nom.slice(1)} de déblai passe à la batterie d'essais. Los Angeles : ${fr(mLA, 4)} g sur 5 000 g passent à 1,6 mm. Micro-Deval : ${frd(mMDE, 1)} g sur 500 g restent sur 1,6 mm. Fragmentabilité IFR = ${frd(IFR, 1)} ; dégradabilité IDGa = ${frd(IDGa, 1)}.`,
        donnees: [donnee("Roche", nom.slice(3)), donnee("LA : passant 1,6 mm", `${fr(mLA, 4)} g / 5 000 g`), donnee("MDE : refus 1,6 mm", `${frd(mMDE, 1)} g / 500 g`), donnee("IFR · IDGa", `${frd(IFR, 1)} · ${frd(IDGa, 1)}`)],
        questions: [
          nombre("Coefficient Los Angeles ?", LA, "", `LA = 100 × ${fr(mLA, 4)} / 5 000 = ${frd(LA, 1)}.`, { rel: 0.01 }),
          nombre("Coefficient micro-Deval ?", MDE, "", `MDE = 100 × (500 − ${frd(mMDE, 1)}) / 500 = ${frd(MDE, 1)}.`, { rel: 0.01 }),
          choixMelange(a, "Classe de la roche au GTR 2024 ?", [lib(r.sousClasse), ...classes.filter((k) => k !== r.sousClasse).map(lib)], `${regle} → ${r.sousClasse}.`),
          choixMelange(a, "Au GTR 1992, ces roches formaient la famille…", [`${f92[0]} : ${f92[1]}`, ...a.tirage(OPTIONS_1992.filter((o) => !o.startsWith(f92[0])), 3)],
            `Les grès, poudingues et brèches étaient les roches siliceuses ${f92[0]} du GTR 1992 ; le GTR 2024 les sépare en Sa (grès) et Co (conglomérats) et préfixe la classe de résistance.`),
        ],
      };
    },
  },
  {
    id: "ch4-marne", titre: "Une marne fragmentable : IFR lu sur les courbes, puis l'état", difficulte: 3,
    generer(a) {
      const TAMIS = [0.08, 0.25, 0.5, 1, 2, 4, 8, 10, 12.5, 16, 20];
      let avant, apres, Da, Db, IFR;
      for (let essai = 0; essai < 60; essai++) {
        avant = [[8, 0], [10, a.entre(2, 8, 0.5)], [12.5, a.entre(20, 40, 1)], [16, a.entre(55, 80, 1)], [20, 100]];
        const d50 = a.entre(2.5, 8, 0.1), k = a.entre(0.9, 1.5, 0.05);
        const L = (d) => 1 / (1 + (d50 / d) ** k);
        apres = TAMIS.map((d) => [d, d >= 20 ? 100 : arrondi(Math.max((100 * L(d)) / L(20), d >= 8 ? passant(avant, d) + 3 : 0))]);
        Da = diametre(avant, 10); Db = diametre(apres, 10);
        IFR = fragmentabilite({ D10avant: Da, D10apres: Db });
        if (IFR >= 7.6 && IFR <= 40 && apres.every((q, i) => !i || q[1] >= apres[i - 1][1])) break;
      }
      const ETATS = { th: [1.32, 1.5, 0.8, 1.8], h: [1.12, 1.28, 2.3, 4.7], m: [0.92, 1.08, 6, 15], s: [0.72, 0.88, 15, 30], ts: [0.55, 0.68, 25, 40] };
      const etatVise = a.choix(Object.keys(ETATS)), [r0, r1, i0, i1] = ETATS[etatVise];
      const wOPN = a.entre(12, 20, 0.1), w = arrondi(wOPN * a.entre(r0, r1, 0.01)), IPI = a.entre(i0, i1, 0.1);
      const r = classerRoche("Cl", { IFR, w, wOPN, IPI });
      const etat = r.sousClasse.split(" ")[2];
      const autres = ["th", "h", "m", "s", "ts"].filter((x) => x !== etat).map((x) => `R5 Cl ${x}`);
      const figure = courbeGranulo({
        largeur: 600, hauteur: 300, dMin: 0.05, dMax: 40,
        series: [
          { points: [[0.05, 10], [40, 10]], couleur: "#a78bfa", tirets: "4 3", epaisseur: 1, libelle: "10 %" },
          { points: avant, couleur: COULEURS.discret, tirets: "6 4", epaisseur: 2, marqueurs: true, libelle: "avant pilonnage" },
          { points: apres, couleur: COULEURS.rouge, epaisseur: 2.4, marqueurs: true, libelle: "après 100 coups de dame" },
        ],
      });
      return {
        enonce: `Essai de fragmentabilité sur une marne : un échantillon 10/20 mm reçoit 100 coups de dame Proctor normal. La figure et le tableau donnent ses courbes granulométriques avant et après pilonnage (interpolation en log d entre les tamis). Au déblai, la marne a une teneur en eau de ${pc(w)} ; l'optimum Proctor normal de la marne broyée est à ${pc(wOPN)}, et son IPI à la teneur en eau naturelle vaut ${frd(IPI, 1)}.`,
        donnees: [donnee("Avant (mm : %)", avant.map(([d, p]) => `${fr(d, 3)} : ${fr(p, 3)}`).join(" · ")), donnee("Après (mm : %)", apres.map(([d, p]) => `${fr(d, 3)} : ${fr(p, 3)}`).join(" · ")), donnee("wn · wOPN", `${pc(w)} · ${pc(wOPN)}`), donnee("IPI", frd(IPI, 1))],
        figure,
        questions: [
          nombre("D10 avant pilonnage ?", Da, "mm", detailD10(avant, Da), { rel: 0.04 }),
          nombre("D10 après pilonnage ?", Db, "mm", `Sur la courbe d'après : ${detailD10(apres, Db)}`, { rel: 0.06 }),
          nombre("Coefficient de fragmentabilité IFR ?", IFR, "", `IFR = ${fr(Da, 3)} / ${fr(Db, 3)} = ${frd(IFR, 1)} > 7 : la marne est fragmentable, classe R5.`, { rel: 0.08 }),
          choixMelange(a, "Classe et état de la marne au GTR 2024 ?", [r.sousClasse, ...a.tirage(autres, 2), "R4 Cld1"],
            `R5 Cl : l'état se lit sur wn/wOPN = ${frd(w / wOPN, 2)} et l'IPI = ${frd(IPI, 1)} : th si wn ≥ 1,3 wOPN ou IPI < 2 ; h si wn ≥ 1,1 wOPN ou IPI < 5 ; sinon m (0,9 à 1,1), s (0,7 à 0,9), ts (sous 0,7) → ${r.sousClasse}.`),
          choixMelange(a, "Comment ce matériau se comportera-t-il au terrassement ?", [SENS_CL.R5, SENS_CL.dur, SENS_CL.Cld1],
            "Une roche fragmentable se réduit sous les engins en un sol fin : la teneur en eau des marnes, qui passe aux fines produites, décide alors de leur emploi, d'où l'état hydrique accolé à la classe."),
        ],
      };
    },
  },
];
