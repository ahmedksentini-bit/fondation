// Exercices du chapitre 7 : objectifs de densification q4 et q3, méthode Q/S
// (GTR 2024, fascicule 2, annexe 4), classes de compacteurs, compacteurs
// mixtes et ateliers. Les cellules des tableaux de compactage viennent de
// tables-compactage.js ; celles que le guide imprime avec un écart (ANOMALIES)
// ne sont jamais tirées, ni le tableau F4 (colonnes dédoublées atypiques).
import { frd, fr, nombre, choixMelange, donnee } from "./alea.js";
import {
  OBJECTIFS, ENERGIES, controleDensite, applications, passes, debitParLargeur, debitPratique,
  prescrire, mixte, controleAtelier, classeCompacteur, tableauCompactage, TABLEAUX, COMPACTEURS,
} from "../gtr/compactage.js";
import { ANOMALIES as ANOMALIES_COMPACTAGE } from "../gtr/tables-compactage.js";
import { conditionsRemblai, couvre } from "../gtr/utilisation.js";
import { REMBLAI, ANOMALIES as ANOMALIES_REMBLAI } from "../gtr/tables-remblai.js";
import { graphe, echantillon, COULEURS } from "../figures.js";
import { lireSymbole, decrire, natureAvecArticle, parMeteo, SYMBOLES_METEO } from "./ch06.js";

// ───────────────────────────── Tableaux et cellules ─────────────────────────────

/** Tableaux de remblai des sols et des craies (le F4, aux colonnes atypiques, et les roches sont écartés). */
const PAGES = [75, 76, 77, 79, 80, 81, 82, 83, 84, 85, 86, 87];
const TABLES = TABLEAUX.filter((t) => t.usage === "remblai" && PAGES.includes(t.page));
/** Cellule imprimée avec un écart dans le guide (N ou Q/L) : jamais tirée. */
const celluleDouteuse = (t, code, comp) => ANOMALIES_COMPACTAGE.some((x) => x.page === t.page && new RegExp(`^code ${code}, ${comp}\\b`).test(x.position ?? ""));
export const CELLULES = TABLES.flatMap((t) => Object.entries(t.codes).flatMap(([code, cells]) => COMPACTEURS
  .filter((comp) => cells[comp]?.options?.length && !celluleDouteuse(t, code, comp))
  .map((comp) => ({ t, code, comp, cell: cells[comp] }))));

/** Matériau d'un tableau, article compris : « un sable silteux…, insensible à l'eau », « une craie ». */
export function materiau(symbole) {
  const m = /^(VC[12])?([FISG][1-4])(ins)?$/.exec(symbole);
  if (m) return `${natureAvecArticle(m[1] ?? "", m[2])}${m[3] ? ", insensible à l'eau" : ""}`;
  return symbole === "CH" ? "une craie" : `le matériau ${symbole}`;
}
const symboleDe = (a, t) => a.choix(t.classes);
export const famille = (comp) => comp.replace(/\d/g, "");
/** Largeur compactée plausible pour une classe de compacteur (m). */
export function largeur(a, comp) {
  const f = famille(comp);
  if (f === "PQ") return a.entre(0.5, 0.9, 0.05);
  if (comp === "V1") return a.entre(1.2, 1.5, 0.05);
  if (comp === "V2") return a.entre(1.5, 2, 0.05);
  return a.entre(f === "P" ? 1.9 : 2, f === "P" || f === "SP" ? 2.4 : 2.2, 0.05);
}
const NOM_FAMILLE = { P: "à pneus", V: "vibrant à cylindre lisse", VP: "vibrant à pieds dameurs", SP: "statique à pieds dameurs", PQ: "plaque vibrante" };
/** « un compacteur à pneus de classe P2 », « une plaque vibrante de classe PQ4 ». */
const designation = (comp) => (famille(comp) === "PQ" ? `une plaque vibrante de classe ${comp}` : `un compacteur ${NOM_FAMILLE[famille(comp)]} de classe ${comp}`);
const option = (o) => `e = ${frd(o.e, 2)} m à V = ${fr(o.V, 2)} km/h`;
const celluleEnClair = (cell) => `Q/S = ${frd(cell.QS, 3)} m, ${cell.options.map(option).join(" ou ")}`;
const plusMince = (cell) => cell.options.reduce((x, y) => (y.e < x.e ? y : x));
const plusEpaisse = (cell) => cell.options.reduce((x, y) => (y.e > x.e ? y : x));

/** Vibrants à deux colonnes dont le produit V × e est le même à 1 % près sur les deux colonnes. */
const DEUX_COLONNES = CELLULES.filter(({ cell }) => {
  if (cell.options.length !== 2) return false;
  const [g, d] = cell.options;
  return Math.abs(g.e * g.V - d.e * d.V) <= 0.01 * d.e * d.V && g.e !== d.e;
});

// ───────────────────────────── Objectifs q4 et q3 ─────────────────────────────

const VERDICTS = {
  q3: "objectif q3 atteint (couche de forme), donc q4 aussi",
  q4: "q4 atteint (remblai), mais pas q3",
  fond: "q4 non atteint : la moyenne passe, le fond de couche non",
  moyen: "q4 non atteint : la densité moyenne est insuffisante",
};
/** Verdict d'une couche contrôlée face aux deux objectifs, par controleDensite. */
function verdictCouche(rm, rf, ref) {
  const q3 = controleDensite({ rhoDmoy: rm, rhoDfc: rf, rhoDOPN: ref, objectif: "q3" });
  const q4 = controleDensite({ rhoDmoy: rm, rhoDfc: rf, rhoDOPN: ref, objectif: "q4" });
  return { q3, q4, cle: q3.ok ? "q3" : q4.ok ? "q4" : q4.okMoyen ? "fond" : "moyen" };
}

// ───────────────────────────── Prescriptions (ch. 6 → ch. 7) ─────────────────────────────

const douteuseRemblai = (cas, sit, code) => ANOMALIES_REMBLAI.some((x) => x.code === code && x.meteo === sit.meteo && x.classes.some((k) => cas.classes.includes(k)));
/** Clé du tableau de compactage d'un sol classé : nature, avec VC1/VC2 et « ins » pour S3, S4, G3, G4. */
const cleCompactage = (s) => `${s.vc}${s.nature}${s.etat === "ins" && /^[SG][34]$/.test(s.nature) ? "ins" : ""}`;
const PRESCRIPTIONS = [];
for (const cas of REMBLAI) for (const sit of cas.situations ?? []) for (const sol of sit.solutions ?? []) {
  if (douteuseRemblai(cas, sit, sol.code)) continue;
  for (const symbole of cas.classes) {
    const s = lireSymbole(symbole);
    if (!s) continue;
    const tc = tableauCompactage(cleCompactage(s));
    if (!tc || !TABLES.includes(tc.tableau)) continue;
    const cells = CELLULES.filter((c) => c.t === tc.tableau && c.code === sol.code[5] && famille(c.comp) !== "PQ");
    if (cells.length) PRESCRIPTIONS.push({ symbole, sit, code: sol.code, cells });
  }
}
const EPAISSEURS_R = { 0: [0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.6], 1: [0.2, 0.25, 0.3], 2: [0.3, 0.35, 0.4, 0.45, 0.5] };

// ───────────────────────────── Modèles ─────────────────────────────

export default [
  {
    id: "ch7-objectifs", titre: "Objectifs de densification q4 et q3", difficulte: 1,
    generer(a) {
      const ref = a.entre(1.6, 2.1, 0.01);
      const cat = a.choix(["q3", "q4", "fond", "moyen"]);
      const [tm, tf] = cat === "q3" ? [a.entre(99, 101, 0.1), a.entre(96.5, 98.5, 0.1)]
        : cat === "q4" ? [a.entre(95.5, 98, 0.1), a.entre(92.5, 95, 0.1)]
          : cat === "fond" ? [a.entre(95.5, 98, 0.1), a.entre(88, 91.5, 0.1)]
            : [a.entre(90, 94.5, 0.1), a.entre(86, 89.5, 0.1)];
      const rm = +((tm * ref) / 100).toFixed(3), rf = +((tf * ref) / 100).toFixed(3);
      const v = verdictCouche(rm, rf, ref);
      const pc = (x) => frd((100 * x) / ref, 1);
      return {
        enonce: `Un même matériau, de masse volumique sèche à l'optimum Proctor normal ρdOPN = ${frd(ref, 2)} Mg/m³, sert en remblai et en couche de forme. Sur une couche, le gammadensimètre donne une masse volumique sèche moyenne de ${frd(rm, 3)} Mg/m³ et, sur les 8 cm inférieurs (fond de couche), de ${frd(rf, 3)} Mg/m³.`,
        donnees: [donnee("ρdOPN", `${frd(ref, 2)} Mg/m³`), donnee("ρd moyenne", `${frd(rm, 3)} Mg/m³`), donnee("ρd fond de couche", `${frd(rf, 3)} Mg/m³`)],
        questions: [
          nombre("ρd moyenne minimale d'une couche de remblai (objectif q4) ?", v.q4.rhoDmoyRequis, "Mg/m³", `q4 : ρd moyenne ≥ ${frd(OBJECTIFS.q4.moyen, 0)} % de ρdOPN = 0,95 × ${frd(ref, 2)} = ${frd(v.q4.rhoDmoyRequis, 3)} Mg/m³.`, { rel: 0.004 }),
          nombre("ρd minimale en fond de couche de remblai (q4) ?", v.q4.rhoDfcRequis, "Mg/m³", `q4 : ρd en fond de couche ≥ ${frd(OBJECTIFS.q4.fond, 0)} % de ρdOPN = 0,92 × ${frd(ref, 2)} = ${frd(v.q4.rhoDfcRequis, 3)} Mg/m³.`, { rel: 0.004 }),
          nombre("ρd moyenne minimale en couche de forme (q3) ?", v.q3.rhoDmoyRequis, "Mg/m³", `q3 : ρd moyenne ≥ ${frd(OBJECTIFS.q3.moyen, 1)} % de ρdOPN = 0,985 × ${frd(ref, 2)} = ${frd(v.q3.rhoDmoyRequis, 3)} Mg/m³ (et ≥ 96 % en fond de couche, soit ${frd(v.q3.rhoDfcRequis, 3)} Mg/m³).`, { rel: 0.004 }),
          choixMelange(a, "Verdict pour la couche contrôlée ?", [VERDICTS[v.cle], ...Object.values(VERDICTS).filter((t) => t !== VERDICTS[v.cle])],
            `Taux moyen ${pc(rm)} % et taux en fond de couche ${pc(rf)} % de ρdOPN, face à 95/92 % (q4) et 98,5/96 % (q3) : ${VERDICTS[v.cle]}. Le fond de couche compte autant que la moyenne : c'est là que le défaut apparaît d'abord.`),
        ],
      };
    },
  },
  {
    id: "ch7-qs", titre: "Q/S, nombre d'applications et débit d'un compacteur", difficulte: 1,
    generer(a) {
      const { t, code, comp, cell } = a.choix(CELLULES);
      const o = plusMince(cell);
      const tandem = ["V1", "V2", "V3"].includes(comp) && a.reel() < 0.4;
      const L = largeur(a, comp), k = a.entre(0.5, 0.75, 0.05), Nn = tandem ? 2 : 1;
      const N = applications(o.e, cell.QS), n = passes(N, tandem), QL = debitParLargeur(cell.QS, o.V), Qp = debitPratique({ QL, L, k, Nn });
      const symbole = symboleDe(a, t);
      return {
        enonce: `Remblai construit avec ${materiau(symbole)} (${symbole}), énergie de compactage ${ENERGIES[code]} (code ${code}). Pour ${designation(comp)}${tandem ? ", en tandem (deux cylindres vibrants identiques)" : ""}, le tableau de compactage (fascicule 2, annexe 4, p. ${t.page}) donne Q/S = ${frd(cell.QS, 3)} m, une épaisseur e = ${frd(o.e, 2)} m et une vitesse V = ${fr(o.V, 2)} km/h. Largeur compactée L = ${frd(L, 2)} m, rendement k = ${frd(k, 2)}.`,
        donnees: [donnee("Compacteur", `${comp}${tandem ? " (tandem)" : ""}`), donnee("Q/S", `${frd(cell.QS, 3)} m`), donnee("e · V", `${frd(o.e, 2)} m · ${fr(o.V, 2)} km/h`), donnee("L · k", `${frd(L, 2)} m · ${frd(k, 2)}`)],
        questions: [
          nombre("Nombre d'applications de charge N ?", N, "", `N = e/(Q/S) = ${frd(o.e, 2)}/${frd(cell.QS, 3)} = ${frd(o.e / cell.QS, 2)}, arrondi à l'entier supérieur : N = ${N}.`, { abs: 0 }),
          nombre("Nombre de passes du compacteur ?", n, "", tandem ? `Un tandem applique la charge deux fois par passe (N/n = 2) : n = ${N}/2, arrondi à l'entier supérieur = ${n} passes.` : `${famille(comp) === "P" ? "Un compacteur à pneus" : famille(comp) === "PQ" ? "Une plaque vibrante" : "Un monocylindre"} applique la charge une fois par passe (N/n = 1) : ${n} passes.`, { abs: 0 }),
          nombre("Débit par mètre de largeur Q/L ?", QL, "m³/h·m", `Q/L = 1 000 × (Q/S) × V = 1 000 × ${frd(cell.QS, 3)} × ${fr(o.V, 2)} = ${fr(QL, 4)} m³/h·m.`, { rel: 0.01 }),
          nombre("Débit pratique Qprat ?", Qp, "m³/h", `Qprat = k × (Q/L) × L × (N/n) = ${frd(k, 2)} × ${fr(QL, 4)} × ${frd(L, 2)} × ${Nn} = ${fr(Qp, 4)} m³/h, soit ${fr(8 * Qp, 4)} m³ en 8 heures de présence.`, { rel: 0.02 }),
        ],
      };
    },
  },
  {
    id: "ch7-classe", titre: "Classer un vibrant et un compacteur à pneus", difficulte: 1,
    generer(a) {
      const fam = a.choix(["V", "V", "VP"]);
      let M1 = 9800, L = 213, A0 = 1.7, r = classeCompacteur(fam, { M1L: M1 / L, A0 });
      for (let i = 0; i < 200; i++) {
        const m = a.entre(1500, 12000, 100), l = a.entre(120, 220, 1), a0 = a.entre(0.6, 2.1, 0.05);
        const x = classeCompacteur(fam, { M1L: m / l, A0: a0 });
        if (x.applicable && [15, 25, 40, 55, 70].every((s) => Math.abs(x.parametre - s) > 0.6)) { M1 = m; L = l; A0 = a0; r = x; break; }
      }
      let Mt = 24, nr = 8, p = classeCompacteur("P", { CR: (Mt * 9.81) / nr });
      for (let i = 0; i < 200; i++) {
        const m = a.entre(12, 50, 0.5), n = a.choix([7, 8, 9]), CR = (m * 9.81) / n;
        const x = classeCompacteur("P", { CR });
        if (x.applicable && [25, 40, 60].every((s) => Math.abs(CR - s) > 0.8)) { Mt = m; nr = n; p = x; break; }
      }
      const CR = (Mt * 9.81) / nr;
      const classes = [1, 2, 3, 4, 5].map((k) => `${fam}${k}`);
      return {
        enonce: `Pour classer les compacteurs d'un chantier selon la norme NF P98-736 : un ${NOM_FAMILLE[fam]} porte M1 = ${fr(M1, 5)} kg sur son cylindre, de génératrice L = ${L} cm, avec une amplitude théorique à vide A0 = ${frd(A0, 2)} mm ; un compacteur à pneus de ${frd(Mt, 1)} t repose sur ${nr} roues de même charge (g = 9,81 m/s²).`,
        donnees: [donnee("M1 · L", `${fr(M1, 5)} kg · ${L} cm`), donnee("A0", `${frd(A0, 2)} mm`), donnee("Pneus", `${frd(Mt, 1)} t sur ${nr} roues`)],
        questions: [
          nombre("Charge linéique M1/L ?", M1 / L, "kg/cm", `M1/L = ${fr(M1, 5)}/${L} = ${frd(M1 / L, 1)} kg/cm.`, { rel: 0.01 }),
          nombre("Paramètre de classement (M1/L)·√A0 ?", r.parametre, "", `(M1/L)·√A0 = ${frd(M1 / L, 1)} × √${frd(A0, 2)} = ${frd(r.parametre, 1)}.`, { rel: 0.01 }),
          choixMelange(a, "Classe du vibrant ?", [r.classe, ...classes.filter((c) => c !== r.classe).slice(0, 4)],
            `Classe par le paramètre : 15 à 25 → ${fam}1, 25 à 40 → ${fam}2, 40 à 55 → ${fam}3, 55 à 70 → ${fam}4, au-delà → ${fam}5 ; amplitude minimale 0,6 / 0,8 / 1,0 / 1,3 / 1,6 mm. On retient la plus faible des deux : ${r.classe}.`),
          choixMelange(a, "Qu'est-ce qui fixe cette classe ?", [r.limite, ...["le paramètre (M1/L)·√A0", "l'amplitude A0", "les deux critères"].filter((x) => x !== r.limite)],
            `Paramètre ${frd(r.parametre, 1)} et amplitude ${frd(A0, 2)} mm : la classe est limitée par ${r.limite}. Un rouleau lourd à faible amplitude reste dans une classe modeste.`),
          nombre("Charge par roue CR du compacteur à pneus ?", CR, "kN", `CR = ${frd(Mt, 1)} × 9,81 / ${nr} = ${frd(CR, 1)} kN.`, { rel: 0.01 }),
          choixMelange(a, "Classe du compacteur à pneus ?", [p.classe, ...["P1", "P2", "P3"].filter((c) => c !== p.classe)],
            `P1 de 25 à 40 kN par roue, P2 de 40 à 60 kN, P3 au-delà : CR = ${frd(CR, 1)} kN → ${p.classe}.`),
        ],
      };
    },
  },
  {
    id: "ch7-vibrant", titre: "Vibrant à deux colonnes : V × e = constante", difficulte: 2,
    generer(a) {
      const { t, code, comp, cell } = a.choix(DEUX_COLONNES);
      const g = plusMince(cell), d = plusEpaisse(cell);
      const es = [];
      for (let e = g.e + 0.05; e <= d.e + 1e-9; e += 0.05) es.push(+e.toFixed(2));
      const e = es.length ? a.choix(es) : d.e;
      const p = prescrire(cell, e);
      const eTrop = +(d.e + a.choix([0.05, 0.1, 0.15])).toFixed(2), trop = prescrire(cell, eTrop);
      const symbole = symboleDe(a, t);
      const cste = d.e * d.V;
      const xmax = d.e + 0.2, ymax = Math.ceil(g.V + 1);
      return {
        enonce: `Remblai construit avec ${materiau(symbole)} (${symbole}), énergie ${ENERGIES[code]} (code ${code}), compacteur vibrant ${comp}. Le tableau de compactage (annexe 4, p. ${t.page}) donne Q/S = ${frd(cell.QS, 3)} m et deux colonnes : ${option(g)} (vitesse maximale), ou ${option(d)} (couche épaisse, vitesse lente). L'entreprise veut régaler des couches de ${frd(e, 2)} m.`,
        donnees: [donnee("Compacteur", comp), donnee("Q/S", `${frd(cell.QS, 3)} m`), donnee("Colonne de gauche", `${frd(g.e, 2)} m · ${fr(g.V, 2)} km/h`), donnee("Colonne de droite", `${frd(d.e, 2)} m · ${fr(d.V, 2)} km/h`), donnee("e du chantier", `${frd(e, 2)} m`)],
        figure: graphe({
          largeur: 560, hauteur: 250, xmin: Math.max(0, g.e - 0.1), xmax, ymin: 0, ymax, pasX: 0.1,
          xlabel: "épaisseur de la couche e (m)", ylabel: "vitesse V (km/h)",
          zones: [{ x0: d.e, x1: xmax, y0: 0, y1: ymax, couleur: "#dc2626", opacite: 0.08, libelle: "au-delà de e max : interdit" }],
          series: [
            { points: echantillon((x) => cste / x, g.e, d.e, 40), couleur: COULEURS.bleu, epaisseur: 2.4, libelle: "V × e = constante" },
            { points: [[e, 0], [e, ymax]], couleur: COULEURS.rouge, tirets: "5 4", epaisseur: 1.4, libelle: "épaisseur du chantier" },
          ],
          marques: [{ x: g.e, y: g.V, couleur: COULEURS.gtr24, libelle: "colonne de gauche" }, { x: d.e, y: d.V, couleur: COULEURS.gtr24, libelle: "colonne de droite" }],
        }),
        questions: [
          nombre("Vitesse à prescrire pour cette épaisseur ?", p.V, "km/h", `Entre les deux colonnes, V × e reste constant : ${fr(d.V, 2)} × ${frd(d.e, 2)} = ${frd(cste, 3)} ; V = ${frd(cste, 3)}/${frd(e, 2)} = ${frd(p.V, 2)} km/h.`, { rel: 0.02 }),
          nombre("Nombre d'applications N ?", p.N, "", `N = ${frd(e, 2)}/${frd(cell.QS, 3)} = ${frd(e / cell.QS, 2)} → ${p.N}.`, { abs: 0 }),
          nombre("Débit par mètre de largeur Q/L ?", p.QL, "m³/h·m", `Q/L = 1 000 × ${frd(cell.QS, 3)} × ${frd(p.V, 2)} = ${fr(p.QL, 4)} m³/h·m — moins qu'avec la colonne de gauche (${fr(debitParLargeur(cell.QS, g.V), 4)} m³/h·m) : la couche épaisse se paie en vitesse.`, { rel: 0.02 }),
          choixMelange(a, `Peut-on compacter des couches de ${frd(eTrop, 2)} m avec ce compacteur ?`,
            [`non : ${frd(eTrop, 2)} m dépasse l'épaisseur maximale du tableau (${frd(d.e, 2)} m)`, `oui, à ${fr(g.V, 2)} km/h (vitesse de la colonne de gauche)`, `oui, à ${frd(cste / eTrop, 2)} km/h en prolongeant V × e = constante`, "oui, en augmentant le nombre de passes"],
            `${trop.motif} On ne prolonge pas la loi V × e au-delà de la colonne de droite, et l'on ne panache jamais les colonnes (couche la plus épaisse à la vitesse la plus élevée).`),
        ],
      };
    },
  },
  {
    id: "ch7-mixte", titre: "Compacteur mixte : vibrant et pneus", difficulte: 2,
    generer(a) {
      const { t, code, cv, cp } = a.choix(MIXTES);
      const ov = plusMince(cv.cell), op = plusMince(cp.cell);
      const m = mixte({ QS: cv.cell.QS, e: ov.e, V: ov.V }, { QS: cp.cell.QS, e: op.e, V: op.V });
      const L = a.entre(2, 2.2, 0.05), k = a.entre(0.5, 0.75, 0.05);
      const Qp = debitPratique({ QL: m.QL, L, k, Nn: 1 });
      const symbole = symboleDe(a, t);
      return {
        enonce: `Remblai construit avec ${materiau(symbole)} (${symbole}), énergie ${ENERGIES[code]} (code ${code}). Le compacteur est mixte : un cylindre vibrant de classe ${cv.comp} à l'avant, un train de pneus de classe ${cp.comp} à l'arrière. Tableau de compactage (annexe 4, p. ${t.page}) : ${cv.comp} — Q/S = ${frd(cv.cell.QS, 3)} m, ${option(ov)} ; ${cp.comp} — Q/S = ${frd(cp.cell.QS, 3)} m, ${option(op)}. Largeur L = ${frd(L, 2)} m, rendement k = ${frd(k, 2)}.`,
        donnees: [donnee(cv.comp, `${frd(cv.cell.QS, 3)} m · ${frd(ov.e, 2)} m · ${fr(ov.V, 2)} km/h`), donnee(cp.comp, `${frd(cp.cell.QS, 3)} m · ${frd(op.e, 2)} m · ${fr(op.V, 2)} km/h`), donnee("L · k", `${frd(L, 2)} m · ${frd(k, 2)}`)],
        questions: [
          nombre("Q/S du compacteur mixte ?", m.QS, "m", `Un mixte se traite comme la somme de deux compacteurs : Q/S = ${frd(cv.cell.QS, 3)} + ${frd(cp.cell.QS, 3)} = ${frd(m.QS, 3)} m.`, { rel: 0.01 }),
          nombre("Épaisseur de couche à retenir ?", m.e, "m", `e et V sont les plus faibles des deux : e = min(${frd(ov.e, 2)} ; ${frd(op.e, 2)}) = ${frd(m.e, 2)} m, V = min(${fr(ov.V, 2)} ; ${fr(op.V, 2)}) = ${fr(m.V, 2)} km/h.`, { rel: 0.01 }),
          nombre("Nombre d'applications N ?", m.N, "", `N = ${frd(m.e, 2)}/${frd(m.QS, 3)} = ${frd(m.e / m.QS, 2)} → ${m.N} (N/n = 1 : chaque passe applique les deux essieux, déjà comptés dans Q/S).`, { abs: 0 }),
          nombre("Débit pratique Qprat ?", Qp, "m³/h", `Q/L = 1 000 × ${frd(m.QS, 3)} × ${fr(m.V, 2)} = ${fr(m.QL, 4)} m³/h·m ; Qprat = ${frd(k, 2)} × ${fr(m.QL, 4)} × ${frd(L, 2)} × 1 = ${fr(Qp, 4)} m³/h.`, { rel: 0.02 }),
        ],
      };
    },
  },
  {
    id: "ch7-atelier", titre: "Contrôle a posteriori d'un atelier de compactage", difficulte: 2,
    generer(a) {
      const { t, code, cells } = a.choix(ATELIERS);
      const unique = a.choix(cells);
      const [c1, c2] = a.reel() < 0.3 ? [unique, unique] : a.tirage(cells, 2);
      const Q = a.entre(1200, 4000, 50);
      const sigma = a.reel() < 0.5 ? a.entre(0.7, 0.94, 0.01) : a.entre(1.06, 1.35, 0.01), u = a.entre(0.35, 0.65, 0.01);
      const S1 = Math.max(500, Math.round((sigma * u * Q) / c1.cell.QS / 100) * 100), S2 = Math.max(500, Math.round((sigma * (1 - u) * Q) / c2.cell.QS / 100) * 100);
      const r = controleAtelier({ Q, engins: [{ S: S1, QStableau: c1.cell.QS }, { S: S2, QStableau: c2.cell.QS }] });
      const [x1, x2] = r.termes;
      const Qmax = c1.cell.QS * S1 + c2.cell.QS * S2;
      const symbole = symboleDe(a, t);
      const memes = c1 === c2;
      return {
        enonce: `Remblai construit avec ${materiau(symbole)} (${symbole}), énergie ${ENERGIES[code]} (code ${code}). ${memes ? `Deux compacteurs ${c1.comp} identiques` : `Un ${c1.comp} et un ${c2.comp}`} se partagent les couches ; le tableau de compactage (annexe 4, p. ${t.page}) donne Q/S = ${frd(c1.cell.QS, 3)} m${memes ? "" : ` pour le ${c1.comp} et ${frd(c2.cell.QS, 3)} m pour le ${c2.comp}`}. En fin de journée, ${fr(Q, 4)} m³ ont été compactés ; les enregistreurs donnent les surfaces balayées S1 = ${fr(S1, 5)} m² et S2 = ${fr(S2, 5)} m².`,
        donnees: [donnee("Q", `${fr(Q, 4)} m³`), donnee(`S1 (${c1.comp})`, `${fr(S1, 5)} m²`), donnee(`S2 (${c2.comp})`, `${fr(S2, 5)} m²`), donnee("(Q/S) tableau", memes ? `${frd(c1.cell.QS, 3)} m` : `${frd(c1.cell.QS, 3)} · ${frd(c2.cell.QS, 3)} m`)],
        questions: [
          nombre("Q/S réalisé par le compacteur 1 (Q/S1) ?", x1.QSreel, "m", `Q/S1 = ${fr(Q, 4)}/${fr(S1, 5)} = ${frd(x1.QSreel, 3)} m.`, { rel: 0.01 }),
          nombre("Somme Σ (Q/S)tableau,i / (Q/Si) ?", r.somme, "", `Compacteur 1 : ${frd(c1.cell.QS, 3)}/${frd(x1.QSreel, 3)} = ${frd(x1.part, 3)} ; compacteur 2 : Q/S2 = ${fr(Q, 4)}/${fr(S2, 5)} = ${frd(x2.QSreel, 3)} m, ${frd(c2.cell.QS, 3)}/${frd(x2.QSreel, 3)} = ${frd(x2.part, 3)} ; Σ = ${frd(r.somme, 3)}.`, { rel: 0.01 }),
          choixMelange(a, "Le compactage de la journée est-il suffisant ?", [r.ok ? "oui : Σ ≥ 1" : "non : Σ < 1", r.ok ? "non : Σ < 1" : "oui : Σ ≥ 1", "on ne peut pas conclure sans mesure de densité", "oui, dès que l'un des compacteurs respecte seul son Q/S"],
            `Σ = ${frd(r.somme, 3)} ${r.ok ? "≥ 1 : les compacteurs ont balayé assez de surface pour le volume mis en œuvre" : "< 1 : énergie insuffisante — il fallait plus de surface balayée, ou moins de volume"}. Le contrôle du Q/S vérifie les moyens sur tout le chantier, sans attendre les mesures ponctuelles.`),
          nombre("Volume maximal que ces surfaces balayées permettaient de compacter ?", Qmax, "m³", `Σ ≥ 1 ⇔ Q ≤ Σ (Q/S)tableau,i × Si = ${frd(c1.cell.QS, 3)} × ${fr(S1, 5)} + ${frd(c2.cell.QS, 3)} × ${fr(S2, 5)} = ${fr(Qmax, 4)} m³ (${r.ok ? "le volume réel reste en dessous" : `${fr(Q - Qmax, 3)} m³ de trop`}).`, { rel: 0.01 }),
        ],
      };
    },
  },
  {
    id: "ch7-prescrire", titre: "Du tableau d'utilisation au tableau de compactage", difficulte: 3,
    generer(a) {
      for (let essai = 0; essai < 50; essai++) {
        const P = a.choix(PRESCRIPTIONS);
        const meteo = a.choix(SYMBOLES_METEO.filter((m) => couvre(P.sit.meteo, m)));
        const r = conditionsRemblai(P.symbole, meteo);
        const sol = r.solutions.find((x) => x.code === P.code);
        const C = sol.decode[5], R = sol.decode[4];
        const { t, comp, cell } = a.choix(P.cells);
        const eMax = plusEpaisse(cell).e;
        const es = EPAISSEURS_R[R.valeur].filter((e) => e <= eMax + 1e-9);
        if (!es.length) continue;
        const e = a.choix(es);
        const p = prescrire(cell, e);
        // Colonnes imprimées dont le produit V × e n'est pas constant : la vitesse déduite ne doit pas dépasser celle de la colonne de gauche.
        if (p.V > plusMince(cell).V + 1e-9) continue;
        const L = largeur(a, comp), k = a.entre(0.5, 0.75, 0.05);
        const Qp = debitPratique({ QL: p.QL, L, k, Nn: 1 });
        const Qext = a.entre(250, 900, 10);
        const nb = Math.ceil(Qext / Qp - 1e-9);
        if (Math.abs(Qext / Qp - Math.round(Qext / Qp)) < 0.04) continue;
        const extrait = ["1", "2", "3"].filter((c) => t.codes[c]).map((c) => `code ${c} (${ENERGIES[c]}) : ${t.codes[c][comp] ? celluleEnClair(t.codes[c][comp]) : "ne convient pas"}`).join(" ; ");
        const deuxCol = cell.options.length === 2 && e > plusMince(cell).e + 1e-9;
        return {
          enonce: `Remblai construit avec ${decrire(P.symbole)} (${P.symbole}), ${parMeteo(meteo)}. Le géotechnicien retient la solution ${sol.code}${sol.titre ? ` (${sol.titre})` : ""} du tableau d'utilisation ; l'entreprise régale en couches de ${frd(e, 2)} m et compacte avec des ${comp} (largeur ${frd(L, 2)} m, rendement k = ${frd(k, 2)}). Extrait du tableau de compactage (annexe 4, p. ${t.page}) pour le ${comp} : ${extrait}. L'atelier d'extraction produit ${fr(Qext, 4)} m³/h.`,
          donnees: [donnee("Matériau", P.symbole), donnee("Solution", sol.code), donnee("Compacteur", comp), donnee("e · L · k", `${frd(e, 2)} m · ${frd(L, 2)} m · ${frd(k, 2)}`), donnee("Extraction", `${fr(Qext, 4)} m³/h`)],
          questions: [
            choixMelange(a, "Énergie de compactage imposée par la solution ?", [C.texte, ...["compactage intense", "compactage moyen", "compactage faible"].filter((x) => x !== C.texte)],
              `6e chiffre du code ${sol.code} : C = ${C.valeur} → ${C.texte} ; on lit la ligne « code ${C.valeur} » du tableau de compactage.${R.valeur ? ` Le 5e chiffre, R = ${R.valeur} (${R.texte}), cadre l'épaisseur de ${frd(e, 2)} m.` : ""}`),
            nombre("Q/S à appliquer ?", cell.QS, "m", `Code ${C.valeur}, ${comp} : Q/S = ${frd(cell.QS, 3)} m.`, { rel: 0.005 }),
            nombre("Nombre d'applications N ?", p.N, "", `N = ${frd(e, 2)}/${frd(cell.QS, 3)} = ${frd(e / cell.QS, 2)} → ${p.N}.`, { abs: 0 }),
            nombre("Débit pratique d'un compacteur ?", Qp, "m³/h", `${deuxCol ? `Deux colonnes : V × e = constante, V = ${frd(plusEpaisse(cell).e * plusEpaisse(cell).V, 3)}/${frd(e, 2)} = ${frd(p.V, 2)} km/h` : `V = ${fr(p.V, 2)} km/h`} ; Q/L = 1 000 × ${frd(cell.QS, 3)} × ${frd(p.V, 2)} = ${fr(p.QL, 4)} m³/h·m ; Qprat = ${frd(k, 2)} × ${fr(p.QL, 4)} × ${frd(L, 2)} = ${fr(Qp, 4)} m³/h.`, { rel: 0.02 }),
            nombre("Combien de compacteurs pour suivre l'extraction ?", nb, "", `${fr(Qext, 4)}/${fr(Qp, 4)} = ${frd(Qext / Qp, 2)} → ${nb} compacteur${nb > 1 ? "s" : ""} : le compactage ne doit jamais freiner l'atelier, ni être bâclé pour le suivre.`, { abs: 0 }),
          ],
        };
      }
      throw new Error("ch7-prescrire : aucun tirage exploitable");
    },
  },
];

// ─────────────────────── Ensembles précalculés ───────────────────────

/** Couples vibrant + pneus d'un même tableau et d'une même énergie (compacteurs mixtes). */
const MIXTES = [];
/** Tableaux et énergies offrant au moins deux classes de compacteurs (ateliers). */
const ATELIERS = [];
for (const t of TABLES) for (const code of Object.keys(t.codes)) {
  const ici = CELLULES.filter((c) => c.t === t && c.code === code);
  const vs = ici.filter((c) => /^V\d/.test(c.comp)), ps = ici.filter((c) => /^P\d/.test(c.comp));
  for (const cv of vs) for (const cp of ps) MIXTES.push({ t, code, cv, cp });
  const lourds = ici.filter((c) => famille(c.comp) !== "PQ");
  if (lourds.length >= 2) ATELIERS.push({ t, code, cells: lourds });
}
