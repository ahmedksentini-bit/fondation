// Exercices du chapitre 13 : le gel et la sensibilité au gel — pente de
// l'essai de gonflement, classes SGn, SGp, SGt, règles par défaut de
// l'annexe 3, gélifraction des matériaux traités, profondeur de gel de
// Stefan (modèle d'enseignement).
import { fr, frd, nombre, choixMelange, donnee } from "./alea.js";
import { penteGel, classeGel } from "../gtr/traitement.js";
import { sensibiliteGel, profondeurGelStefan } from "../gtr/gel.js";
import { graphe, COULEURS } from "../figures.js";

const CLASSES = { SGn: "SGn · non gélif", SGp: "SGp · peu gélif", SGt: "SGt · très gélif" };
const nomGel = (c) => CLASSES[c] ?? "étude spécifique";
const OPTIONS_GEL = Object.values(CLASSES);
const moyenne = (t) => t.reduce((s, x) => s + x, 0) / t.length;

/** Tire des données jusqu'à ce qu'elles conviennent ; au pire, le dernier tirage reste valable (réponses du solveur). */
function tirer(a, tirage, accepte, essais = 80) {
  let d;
  for (let i = 0; i < essais; i++) { d = tirage(a); if (accepte(d)) return d; }
  return d;
}
/** Pente loin des seuils 0,05 et 0,4 : la classe ne dépend pas d'un arrondi. */
const loinDesSeuils = (p, marge = 0.07) => [0.05, 0.4].every((s) => Math.abs(p / s - 1) > marge);
/** Pente d'essai tirée dans une classe donnée, loin de ses bornes. */
const penteDans = (a, c) => (c === "SGn" ? a.entre(0.015, 0.04, 0.005) : c === "SGp" ? a.entre(0.07, 0.33, 0.01) : a.entre(0.48, 0.9, 0.02));

/**
 * Critère de gélifraction des matériaux traités [F1 § 4.2.1, repris au cours] :
 * la perte de résistance en traction à 28 jours après les cycles de gel ne
 * doit pas dépasser 50 %. Fonction écrite ici : src/gtr n'a pas de solveur
 * pour cet essai.
 */
function gelifraction({ temoins, geles }) {
  const mT = moyenne(temoins), mG = moyenne(geles), perte = 100 * (1 - mG / mT);
  return { mT, mG, perte, ok: perte <= 50 };
}

/**
 * Indice de gel (°C·jour) qui porte le front de gel de Stefan à la
 * profondeur z : inversion de profondeurGelStefan (z = √(2 λ I / L), donc
 * I = L z² / (2 λ), l'indice passant des °C·s aux °C·jour). Fonction écrite
 * ici : src/gtr/gel.js ne donne que le sens direct.
 */
function indicePourProfondeur({ z, lambda, w, rhoD }) {
  const L = (w / 100) * rhoD * 1000 * 334e3; // J/m³
  return (L * z * z) / (2 * lambda * 86400);
}

/** Matériaux non traités et leurs règles par défaut (annexe 3 du fascicule 2). */
const NON_TRAITES = [
  () => ({ nom: "un limon peu plastique F1, sensible à l'eau", m: { nature: "F1", traitement: "aucun" } }),
  () => ({ nom: "une argile F3", m: { nature: "F3", traitement: "aucun" } }),
  () => ({ nom: "une argile très plastique F4", m: { nature: "F4", traitement: "aucun" } }),
  () => ({ nom: "un sable argileux I2", m: { nature: "I2", traitement: "aucun" } }),
  () => ({ nom: "une grave silteuse G3, sensible à l'eau", m: { nature: "G3", traitement: "aucun" } }),
  (a) => {
    const LA = a.entre(15, 60, 1), MDE = a.entre(10, 55, 1), sym = LA <= 45 && MDE <= 45 ? "G31ins" : "G32ins";
    return { nom: `une grave alluvionnaire insensible à l'eau (${sym}) : LA = ${LA}, MDE = ${MDE}`, m: { nature: "G3", traitement: "aucun", insensibleEau: true, LA, MDE } };
  },
  (a) => {
    const WA24 = a.entre(0.5, 4, 0.1);
    return { nom: `un sable propre insensible à l'eau, dont les grains absorbent WA24 = ${frd(WA24, 1)} % d'eau (LA et MDE non mesurés)`, m: { nature: "S2", traitement: "aucun", insensibleEau: true, WA24 } };
  },
  (a) => {
    const LA = a.entre(15, 40, 1), MDE = a.entre(10, 40, 1);
    return { nom: `une grave concassée insensible à l'eau (G11ins), de catégorie F4 au gel-dégel : LA = ${LA}, MDE = ${MDE}`, m: { nature: "G1", traitement: "aucun", insensibleEau: true, categorieF4: true, LA, MDE } };
  },
  () => ({ nom: "une craie dense CH2", m: { nature: "CH2", traitement: "aucun" } }),
  () => ({ nom: "une roche argileuse R4 Cl (marne compacte)", m: { nature: "R4 Cl", traitement: "aucun" } }),
  () => ({ nom: "une roche argileuse très dégradable R4 Cld1", m: { nature: "R4 Cld1", traitement: "aucun" } }),
  (a) => {
    const LA = a.entre(20, 60, 1), MDE = a.entre(15, 55, 1);
    return { nom: `des blocs calcaires VC1G3 dont la fraction 0/63 mm est sensible à l'eau : LA = ${LA}, MDE = ${MDE}`, m: { nature: "VC1G3", traitement: "aucun", LA, MDE } };
  },
];
const raison = (r) => { const t = r.etapes.join(" ; "); return t.charAt(0).toUpperCase() + t.slice(1); };
/** Matériaux insensibles à l'eau (grave, sable, grave concassée) et matériaux sensibles ou rocheux. */
const INSENSIBLES = NON_TRAITES.slice(5, 8), SENSIBLES = [...NON_TRAITES.slice(0, 5), ...NON_TRAITES.slice(8)];

/** Matériaux d'essai par classe attendue (contexte de l'énoncé de la pente). */
const MATERIAUX_ESSAI = {
  SGn: ["une grave alluvionnaire 0/20 insensible à l'eau", "une grave calcaire concassée 0/20", "un sable de dune"],
  SGp: ["une argile marneuse", "une grave argileuse", "un limon traité à 2 % de chaux vive"],
  SGt: ["un limon des plateaux", "un sable argileux", "un limon sableux"],
};

/** Figure de l'essai : gonflement en fonction de √I, avec les droites des seuils (sans la droite ajustée). */
function figurePente(pts) {
  const xmax = Math.ceil(Math.sqrt(Math.max(...pts.map((q) => q[0]))) / 5) * 5 + 5;
  const ymax = Math.max(Math.ceil(Math.max(...pts.map((q) => q[1])) * 1.3 * 10) / 10, 0.5);
  return graphe({
    largeur: 600, hauteur: 290, xmin: 0, xmax, ymin: 0, ymax, pasX: 5,
    xlabel: "√I ((°C·h)½)", ylabel: "gonflement h (mm)",
    series: [
      { points: [[0, 0], [xmax, 0.05 * xmax]], couleur: "#15803d", epaisseur: 1.4, tirets: "5 4", libelle: "p = 0,05 (SGn / SGp)" },
      { points: [[0, 0], [xmax, 0.4 * xmax]], couleur: COULEURS.rouge, epaisseur: 1.4, tirets: "5 4", libelle: "p = 0,4 (SGp / SGt)" },
      { points: pts.map(([I, h]) => [Math.sqrt(I), h]), couleur: COULEURS.encre, nuage: true, rayon: 4.5 },
    ],
  });
}

export default [
  {
    id: "ch13-pente", titre: "Pente de l'essai de gonflement au gel", difficulte: 2,
    generer(a) {
      const d = tirer(a, (a) => {
        const I = a.choix([[50, 150, 300, 500, 800], [100, 200, 400, 600, 900], [80, 200, 350, 550, 750]]);
        const cible = a.choix(["SGn", "SGp", "SGp", "SGt"]), p0 = penteDans(a, cible);
        const h = I.map((x) => Math.round(p0 * Math.sqrt(x) * (1 + a.entre(-0.06, 0.06, 0.01)) * 100) / 100);
        const pts = I.map((x, i) => [x, h[i]]);
        return { cible, pts, p: penteGel(pts) };
      }, ({ p, cible }) => loinDesSeuils(p) && classeGel(p).classe === cible);
      const { cible, pts, p } = d;
      const c = classeGel(p), mat = a.choix(MATERIAUX_ESSAI[cible]);
      const sxy = pts.reduce((s, [I, h]) => s + Math.sqrt(I) * h, 0), sxx = pts.reduce((s, [I]) => s + I, 0);
      const Iref = a.choix([1000, 1200, 1500]), hRef = p * Math.sqrt(Iref);
      return {
        enonce: `Essai de gonflement au gel (NF P98-234-2) sur ${mat} : l'éprouvette 0/20 mm gèle par la tête, la base dans l'eau. On relève le gonflement h à mesure que l'indice de gel cumulé I augmente : ${pts.map(([I, h]) => `I = ${fr(I, 3)} °C·h → h = ${frd(h, 2)} mm`).join(" ; ")}. La droite h = p √I passe par l'origine (moindres carrés : p = Σ(√I·h)/ΣI).`,
        donnees: pts.map(([I, h]) => donnee(`I = ${fr(I, 3)} °C·h`, `h = ${frd(h, 2)} mm`)),
        figure: figurePente(pts),
        questions: [
          nombre("Pente p de la droite h(√I) ?", p, "mm/(°C·h)½", `Σ√I·h = ${pts.map(([I, h]) => `${frd(Math.sqrt(I), 2)} × ${frd(h, 2)}`).join(" + ")} = ${frd(sxy, 2)} ; ΣI = ${fr(sxx, 4)} ; p = ${frd(sxy, 2)}/${fr(sxx, 4)} = ${frd(p, 3)} mm/(°C·h)½.`, { rel: 0.03 }),
          choixMelange(a, "Classe de sensibilité au gel ?", [nomGel(c.classe), ...OPTIONS_GEL.filter((o) => o !== nomGel(c.classe))],
            `p = ${frd(p, 3)} : ${nomGel(c.classe)} (p ≤ 0,05 non gélif ; 0,05 < p ≤ 0,4 peu gélif ; p > 0,4 très gélif) [F2 annexe 3].`),
          nombre(`Gonflement prévu par la droite pour I = ${fr(Iref, 4)} °C·h ?`, hRef, "mm", `h = p √I = ${frd(p, 3)} × √${fr(Iref, 4)} = ${frd(p, 3)} × ${frd(Math.sqrt(Iref), 2)} = ${frd(hRef, 2)} mm : le gonflement croît comme la racine de l'indice de gel, pas comme l'indice lui-même.`, { rel: 0.03 }),
        ],
      };
    },
  },
  {
    id: "ch13-eprouvettes", titre: "Trois éprouvettes, une classe de gel", difficulte: 1,
    generer(a) {
      const d = tirer(a, (a) => {
        const mat = a.choix(NON_TRAITES.slice(0, 5))(a);
        const p0 = penteDans(a, a.choix(["SGn", "SGp", "SGt"]));
        const ps = [0, 1, 2].map(() => Math.round(p0 * (1 + a.entre(-0.08, 0.08, 0.01)) * 1000) / 1000);
        return { mat, ps, p: moyenne(ps) };
      }, ({ p }) => loinDesSeuils(p, 0.06));
      const { mat, ps, p } = d;
      const parEssai = sensibiliteGel({ ...mat.m, p }), parDefaut = sensibiliteGel(mat.m);
      return {
        enonce: `On a soumis ${mat.nom} à l'essai de gonflement au gel. Les pentes des trois éprouvettes valent ${ps.map((x) => frd(x, 3)).join(" ; ")} mm/(°C·h)½.`,
        donnees: ps.map((x, i) => donnee(`éprouvette ${i + 1}`, `p = ${frd(x, 3)}`)),
        questions: [
          nombre("Pente moyenne p ?", p, "mm/(°C·h)½", `p = (${ps.map((x) => frd(x, 3)).join(" + ")})/3 = ${frd(p, 3)} mm/(°C·h)½.`, { rel: 0.01 }),
          choixMelange(a, "Classe du matériau ?", [nomGel(parEssai.classe), ...OPTIONS_GEL.filter((o) => o !== nomGel(parEssai.classe))],
            `p = ${frd(p, 3)} → ${nomGel(parEssai.classe)} : l'essai de gonflement prévaut sur toute autre règle [F2 annexe 3].`),
          choixMelange(a, "Sans l'essai, quelle classe les règles par défaut de l'annexe 3 lui auraient-elles donnée ?", [nomGel(parDefaut.classe), ...OPTIONS_GEL.filter((o) => o !== nomGel(parDefaut.classe))],
            `Règle par défaut : ${raison(parDefaut)} → ${nomGel(parDefaut.classe)}.${parDefaut.classe !== parEssai.classe ? " L'essai change ici la classe : il vaut la peine d'être fait." : " L'essai confirme ici la règle."}`),
        ],
      };
    },
  },
  {
    id: "ch13-defaut", titre: "Deux matériaux sans essai de gel", difficulte: 1,
    generer(a) {
      const [fa, fb] = a.tirage([a.choix(INSENSIBLES), a.choix(SENSIBLES)]);
      const A = fa(a), B = fb(a);
      const rA = sensibiliteGel(A.m), rB = sensibiliteGel(B.m);
      const nA = rA.classe === "SGn", nB = rB.classe === "SGn";
      const bonne = nA && nB ? "les deux" : nA ? "le matériau A" : nB ? "le matériau B" : "aucun des deux";
      return {
        enonce: `Sans essai de gonflement au gel, on doit classer deux matériaux non traités disponibles sur le chantier. A : ${A.nom}. B : ${B.nom}.`,
        donnees: [donnee("Matériau A", A.nom.replace(/^(un|une|des) /, "")), donnee("Matériau B", B.nom.replace(/^(un|une|des) /, ""))],
        questions: [
          choixMelange(a, "Classe de gel du matériau A ?", [nomGel(rA.classe), ...OPTIONS_GEL.filter((o) => o !== nomGel(rA.classe))], `A : ${raison(rA)} → ${nomGel(rA.classe)} [F2 annexe 3].`),
          choixMelange(a, "Classe de gel du matériau B ?", [nomGel(rB.classe), ...OPTIONS_GEL.filter((o) => o !== nomGel(rB.classe))], `B : ${raison(rB)} → ${nomGel(rB.classe)} [F2 annexe 3].`),
          choixMelange(a, "Lequel peut-on placer au-dessus d'un sol support gélif pour le protéger du gel ?", [bonne, ...["le matériau A", "le matériau B", "les deux", "aucun des deux"].filter((x) => x !== bonne)],
            `Seul un matériau non gélif protège ce qui est dessous : A est ${nomGel(rA.classe)}, B est ${nomGel(rB.classe)} → ${bonne}. Un matériau peu gélif peut rester sous la chaussée, mais la vérification au gel (NF P98-086) tient compte de sa pente.`),
        ],
      };
    },
  },
  {
    id: "ch13-traite", titre: "Matériau traité : gélif ou non ?", difficulte: 2,
    generer(a) {
      const d = tirer(a, (a) => {
        const chaux = a.reel() < 0.5;
        const sol = chaux ? { nature: "F3", nom: "une argile F3 traitée à la chaux seule" }
          : a.choix([{ nature: "F1", nom: "un limon F1 traité au liant hydraulique" }, { nature: "F2", nom: "un limon argileux F2 traité à la chaux et au liant hydraulique" },
            { nature: "I2", nom: "un sable argileux I2 traité au ciment" }, { nature: "S3", nom: "un sable limoneux S3 traité au liant hydraulique routier" }]);
        const v0 = chaux ? a.choix([a.entre(1.2, 2.2, 0.1), a.entre(2.8, 4, 0.1)]) : a.choix([a.entre(0.12, 0.22, 0.01), a.entre(0.28, 0.45, 0.01)]);
        const v = [0, 1, 2].map(() => (chaux ? Math.round(v0 * (1 + a.entre(-0.08, 0.08, 0.01)) * 10) / 10 : Math.round(v0 * (1 + a.entre(-0.08, 0.08, 0.01)) * 100) / 100));
        const m = { nature: sol.nature, traitement: chaux ? "chaux" : "liant", [chaux ? "Rc" : "Rit"]: moyenne(v) };
        return { chaux, sol, v, m };
      }, ({ m, chaux }) => {
        const cle = chaux ? "Rc" : "Rit", c = sensibiliteGel(m).classe;
        return [0.95, 1.05].every((k) => sensibiliteGel({ ...m, [cle]: m[cle] * k }).classe === c);
      });
      const { chaux, sol, v, m } = d;
      const cle = chaux ? "Rc" : "Rit", moy = m[cle];
      const r = sensibiliteGel(m);
      const pEssai = penteDans(a, a.choix(["SGn", "SGp", "SGt"])), rp = sensibiliteGel({ ...m, p: pEssai });
      const unite = "MPa", decimales = chaux ? 2 : 3;
      return {
        enonce: `En couche de forme, ${sol.nom}. Aucun essai de gonflement n'a été fait, et l'on ne dispose pas des autres justifications de l'annexe 3 (dosage, mouture, compactage…). Trois éprouvettes conservées jusqu'à l'âge du premier gel possible donnent ${chaux ? "une résistance en compression" : "une résistance en compression diamétrale (traction indirecte)"} ${cle} = ${v.map((x) => frd(x, chaux ? 1 : 2)).join(" ; ")} ${unite}.`,
        donnees: [donnee("Traitement", chaux ? "chaux seule" : "liant hydraulique"), ...v.map((x, i) => donnee(`${cle} éprouvette ${i + 1}`, `${frd(x, chaux ? 1 : 2)} ${unite}`))],
        questions: [
          nombre(`${cle} moyenne à l'âge du premier gel ?`, moy, unite, `(${v.map((x) => frd(x, chaux ? 1 : 2)).join(" + ")})/3 = ${frd(moy, decimales)} ${unite}.`, { rel: 0.01 }),
          choixMelange(a, "Classe de gel par les règles par défaut ?", [nomGel(r.classe), ...OPTIONS_GEL.filter((o) => o !== nomGel(r.classe))],
            `${cle} = ${frd(moy, decimales)} MPa à l'âge du premier gel. ${raison(r)} → ${nomGel(r.classe)}. Repères du cours : traité à la chaux seule, non gélif si Rc ≥ 2,5 MPa ; traité au liant, si la compression diamétrale Rit atteint 0,25 MPa.`),
          choixMelange(a, `Un essai de gonflement donne ensuite p = ${frd(pEssai, 3)} mm/(°C·h)½. Classe retenue ?`, [nomGel(rp.classe), ...OPTIONS_GEL.filter((o) => o !== nomGel(rp.classe))],
            `p = ${frd(pEssai, 3)} → ${nomGel(rp.classe)} : l'essai de gonflement prévaut toujours sur les règles par défaut.`),
        ],
      };
    },
  },
  {
    id: "ch13-gelifraction", titre: "Gélifraction d'un matériau traité", difficulte: 1,
    generer(a) {
      const d = tirer(a, (a) => {
        const R0 = a.entre(0.3, 0.6, 0.01), perte0 = a.choix([a.entre(15, 42, 1), a.entre(58, 80, 1)]);
        const temoins = [0, 1, 2].map(() => Math.round(R0 * (1 + a.entre(-0.06, 0.06, 0.01)) * 100) / 100);
        const geles = [0, 1, 2].map(() => Math.round(R0 * (1 - perte0 / 100) * (1 + a.entre(-0.06, 0.06, 0.01)) * 100) / 100);
        return { temoins, geles, g: gelifraction({ temoins, geles }) };
      }, ({ g, geles }) => Math.abs(g.perte - 50) > 3 && geles.every((x) => x > 0));
      const { temoins, geles, g } = d;
      const mat = a.choix(["un sable traité au ciment", "une grave traitée au liant hydraulique routier", "un limon traité à la chaux et au ciment"]);
      const OK = "satisfaisant : la perte ne dépasse pas 50 %", KO = "insuffisant : la perte dépasse 50 %";
      const GEL = "la gélifraction : l'eau gèle dans les liaisons créées par la prise et les fragmente";
      return {
        enonce: `Pour une couche de forme en ${mat.replace(/^(un|une) /, "")}, on vérifie la résistance à la gélifraction : à 28 jours, trois éprouvettes témoins et trois éprouvettes soumises aux cycles de gel sont rompues en traction. Témoins : ${temoins.map((x) => frd(x, 2)).join(" ; ")} MPa. Après les cycles : ${geles.map((x) => frd(x, 2)).join(" ; ")} MPa.`,
        donnees: [donnee("Rt témoins", `${temoins.map((x) => frd(x, 2)).join(" · ")} MPa`), donnee("Rt après gel", `${geles.map((x) => frd(x, 2)).join(" · ")} MPa`)],
        questions: [
          nombre("Résistance moyenne des témoins ?", g.mT, "MPa", `(${temoins.map((x) => frd(x, 2)).join(" + ")})/3 = ${frd(g.mT, 3)} MPa.`, { rel: 0.01 }),
          nombre("Perte de résistance due au gel ?", g.perte, "%", `Moyenne après gel : ${frd(g.mG, 3)} MPa ; perte = 1 − ${frd(g.mG, 3)}/${frd(g.mT, 3)} = ${frd(g.perte, 1)} %.`, { abs: 1 }),
          choixMelange(a, "Le matériau résiste-t-il à la gélifraction ?", [g.ok ? OK : KO, g.ok ? KO : OK], `Perte de ${frd(g.perte, 1)} % → ${g.ok ? OK : KO} (critère : au plus 50 % de perte de résistance en traction à 28 jours) [F1 § 4.2.1].`),
          choixMelange(a, "Quel mécanisme cet essai examine-t-il ?", [GEL, "la cryosuccion : l'eau aspirée vers le front de gel forme des lentilles de glace", "le retrait de dessiccation du mélange", "le gonflement dû aux sulfates"],
            `${GEL}. La cryosuccion, elle, se juge par l'essai de gonflement au gel et la pente p.`),
        ],
      };
    },
  },
  {
    id: "ch13-stefan", titre: "Jusqu'où gèle le sol ? Formule de Stefan", difficulte: 2,
    generer(a) {
      const I = a.entre(100, 600, 10), lambda = a.entre(1.2, 2.2, 0.1), w = a.entre(5, 15, 0.5), rhoD = a.entre(1.7, 2.2, 0.05);
      const L = (w / 100) * rhoD * 334;
      const z = profondeurGelStefan({ I, lambda, w, rhoD }), z2 = profondeurGelStefan({ I, lambda, w: 2 * w, rhoD });
      return {
        enonce: `L'hiver de référence d'un site a un indice de gel I = ${fr(I, 3)} °C·jour. Le sol, de conductivité thermique λ = ${frd(lambda, 1)} W/m·K à l'état gelé, a une teneur en eau w = ${frd(w, 1)} % et ρd = ${frd(rhoD, 2)} Mg/m³ ; la chaleur latente de fusion de l'eau vaut 334 kJ/kg. On estime la profondeur gelée par la formule de Stefan, z = √(2 λ I / L), un modèle d'enseignement qui surestime la profondeur réelle.`,
        donnees: [donnee("I", `${fr(I, 3)} °C·jour`), donnee("λ", `${frd(lambda, 1)} W/m·K`), donnee("w · ρd", `${frd(w, 1)} % · ${frd(rhoD, 2)} Mg/m³`)],
        questions: [
          nombre("Chaleur latente du sol L par m³ ?", L, "MJ/m³", `L = w ρd × 334 kJ/kg = ${frd(w / 100, 3)} × ${fr(rhoD * 1000, 4)} kg/m³ × 334 kJ/kg = ${fr(L, 3)} MJ/m³.`, { rel: 0.01 }),
          nombre("Profondeur de gel z ?", z, "m", `I = ${fr(I, 3)} × 86 400 = ${fr(I * 86400, 3)} °C·s ; z = √(2 × ${frd(lambda, 1)} × ${fr(I * 86400, 3)} / ${fr(L * 1e6, 3)}) = ${frd(z, 2)} m.`, { rel: 0.02 }),
          nombre("Et si le sol contenait deux fois plus d'eau ?", z2, "m", `L double, z est divisé par √2 : ${frd(z, 2)}/1,414 = ${frd(z2, 2)} m. Il faut extraire plus de chaleur pour geler un sol humide : le front de gel y descend moins vite.`, { rel: 0.02 }),
        ],
      };
    },
  },
  {
    id: "ch13-stefan-inverse", titre: "Quel hiver une couche non gélive arrête-t-elle ?", difficulte: 3,
    generer(a) {
      const d = tirer(a, (a) => {
        const H = a.entre(0.6, 1.2, 0.05), lambda = a.entre(1.4, 2, 0.1), w = a.entre(5, 9, 0.5), rhoD = a.entre(2, 2.2, 0.05);
        const Iadm = indicePourProfondeur({ z: H, lambda, w, rhoD });
        const Iref = Math.round((Iadm * a.choix([a.entre(0.55, 0.85, 0.05), a.entre(1.15, 1.6, 0.05)])) / 10) * 10;
        return { H, lambda, w, rhoD, Iadm, Iref, zRef: profondeurGelStefan({ I: Iref, lambda, w, rhoD }) };
      }, ({ zRef, H, Iref }) => Math.abs(zRef / H - 1) > 0.04 && Iref >= 50);
      const { H, lambda, w, rhoD, Iadm, Iref, zRef } = d;
      const L = (w / 100) * rhoD * 334;
      const OUI = "oui : le front de gel dépasse les matériaux non gélifs", NON = "non : le front de gel reste dans les matériaux non gélifs";
      const bonne = zRef > H ? OUI : NON;
      return {
        enonce: `Sur un sol support très gélif, la chaussée et la couche de forme forment ${frd(H, 2)} m de matériaux non gélifs (λ = ${frd(lambda, 1)} W/m·K gelés, w = ${frd(w, 1)} %, ρd = ${frd(rhoD, 2)} Mg/m³ ; chaleur latente de l'eau 334 kJ/kg). On raisonne avec la formule de Stefan, z = √(2 λ I / L), en supposant ces matériaux sur toute la hauteur gelée : un modèle d'enseignement, majorant. L'hiver de référence du lieu a un indice I = ${fr(Iref, 4)} °C·jour.`,
        donnees: [donnee("Matériaux non gélifs", `${frd(H, 2)} m`), donnee("λ · w · ρd", `${frd(lambda, 1)} W/m·K · ${frd(w, 1)} % · ${frd(rhoD, 2)} Mg/m³`), donnee("I de référence", `${fr(Iref, 4)} °C·jour`)],
        questions: [
          nombre("Chaleur latente L des matériaux ?", L, "MJ/m³", `L = ${frd(w / 100, 3)} × ${fr(rhoD * 1000, 4)} × 334 kJ/kg = ${fr(L, 3)} MJ/m³.`, { rel: 0.01 }),
          nombre("Indice de gel qui amène le front de gel juste au sol support ?", Iadm, "°C·jour", `z = H ⇔ I = L H²/(2 λ) = ${fr(L * 1e6, 3)} × ${frd(H, 2)}² / (2 × ${frd(lambda, 1)}) = ${fr(Iadm * 86400, 3)} °C·s, soit ${fr(Iadm, 3)} °C·jour.`, { rel: 0.02 }),
          choixMelange(a, `Avec l'hiver de référence (I = ${fr(Iref, 4)} °C·jour), le gel atteint-il le sol support ?`, [bonne, bonne === OUI ? NON : OUI],
            `z = √(2 × ${frd(lambda, 1)} × ${fr(Iref * 86400, 3)} / ${fr(L * 1e6, 3)}) = ${frd(zRef, 2)} m ${zRef > H ? ">" : "<"} ${frd(H, 2)} m → ${bonne}. ${zRef > H ? "Le modèle majore la profondeur : la vérification réglementaire (NF P98-086) dira s'il faut épaissir la couche de forme." : "Le modèle majorant la profondeur, la marge est rassurante ; la vérification réglementaire suit la NF P98-086."}`),
        ],
      };
    },
  },
];
