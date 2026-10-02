// Classification des sols du GTR 1992 (2e édition, 2000), celle de la norme
// NF P11-300 : classes A (sols fins), B (sableux et graveleux avec fines),
// C (avec fines et gros éléments), D (insensibles à l'eau). Tenue à côté de la
// classification du GTR 2024 parce que des milliers de rapports et de marchés
// la citent encore, et pour montrer ce qui change d'une édition à l'autre.
// Paramètres lus sur la fraction 0/50 mm, fines au tamis de 80 µm
// [GTR 92 fascicule I § 1.2 ; fascicule II annexe 1].

import { horsDomaine, fr } from "./outils.js";
import { contient, enClair } from "./classification.js";

const L = (etat, crit) => ({ etat, ...crit });
/** États hydriques du GTR 1992 (r = wn/wOPN) ; B1, B3 et D n'en ont pas. */
export const ETATS_1992 = {
  A1: [L("th", { IPI: "(,3]", r: "[1.25,)" }), L("h", { IPI: "(3,8]", r: "[1.1,1.25)" }), L("m", { IPI: "(8,25]", r: "[0.9,1.1)" }), L("s", { r: "[0.7,0.9)" }), L("ts", { r: "(,0.7)" })],
  A2: [L("th", { IPI: "(,2]", Ic: "(,0.9]", r: "[1.3,)" }), L("h", { IPI: "(2,5]", Ic: "(0.9,1.05]", r: "[1.1,1.3)" }), L("m", { IPI: "(5,15]", Ic: "(1.05,1.2]", r: "[0.9,1.1)" }),
    L("s", { Ic: "(1.2,1.4]", r: "[0.7,0.9)" }), L("ts", { Ic: "(1.4,)", r: "(,0.7)" })],
  A3: [L("th", { IPI: "(,1]", Ic: "(,0.8]", r: "[1.4,)" }), L("h", { IPI: "(1,3]", Ic: "(0.8,1]", r: "[1.2,1.4)" }), L("m", { IPI: "(3,10]", Ic: "(1,1.15]", r: "[0.9,1.2)" }),
    L("s", { Ic: "(1.15,1.3]", r: "[0.7,0.9)" }), L("ts", { Ic: "(1.3,)", r: "(,0.7)" })],
  B2: [L("th", { IPI: "(,4]", r: "[1.25,)" }), L("h", { IPI: "(4,8]", r: "[1.1,1.25)" }), L("m", { r: "[0.9,1.1)" }), L("s", { r: "[0.5,0.9)" }), L("ts", { r: "(,0.5)" })],
  B4: [L("th", { IPI: "(,7]", r: "[1.25,)" }), L("h", { IPI: "(7,15]", r: "[1.1,1.25)" }), L("m", { r: "[0.9,1.1)" }), L("s", { r: "[0.6,0.9)" }), L("ts", { r: "(,0.6)" })],
  B5: [L("th", { IPI: "(,5]", r: "[1.25,)" }), L("h", { IPI: "(5,12]", r: "[1.1,1.25)" }), L("m", { IPI: "(12,30]", r: "[0.9,1.1)" }), L("s", { r: "[0.6,0.9)" }), L("ts", { r: "(,0.6)" })],
  B6: [L("th", { IPI: "(,4]", Ic: "(,0.8]", r: "[1.3,)" }), L("h", { IPI: "(4,10]", Ic: "(0.8,1]", r: "[1.1,1.3)" }), L("m", { IPI: "(10,25]", Ic: "(1,1.2]", r: "[0.9,1.1)" }),
    L("s", { Ic: "(1.2,1.3]", r: "[0.7,0.9)" }), L("ts", { Ic: "(1.3,)", r: "(,0.7)" })],
};

export const SOUS_CLASSES_1992 = {
  A1: "limons peu plastiques, lœss, silts alluvionnaires, sables fins peu pollués", A2: "sables fins argileux, limons, argiles et marnes peu plastiques",
  A3: "argiles et argiles marneuses, limons très plastiques", A4: "argiles et argiles marneuses très plastiques",
  B1: "sables silteux", B2: "sables argileux (peu argileux)", B3: "graves silteuses", B4: "graves argileuses (peu argileuses)",
  B5: "sables et graves très silteux", B6: "sables et graves argileux à très argileux",
  C1: "matériaux roulés ou anguleux peu charpentés (fraction 0/50 > 60 à 80 %)", C2: "matériaux anguleux charpentés (fraction 0/50 ≤ 60 à 80 %)",
  D1: "sables alluvionnaires propres, sables de dune", D2: "graves alluvionnaires propres, sables", D3: "graves alluvionnaires grossières propres",
};

function etat1992(cle, { IPI, Ic, w, wOPN }) {
  const lignes = ETATS_1992[cle];
  if (!lignes) return null;
  const r = w / wOPN;
  const par = (p, x) => (Number.isFinite(x) ? lignes.find((l) => l[p] && contient(l[p], x))?.etat ?? null : null);
  const eI = par("IPI", IPI), eC = par("Ic", Ic), eR = par("r", r);
  if (eI === "th" || eI === "h") return eI;
  if (Number.isFinite(IPI) && (eR === "th" || eR === "h")) return eI ?? "m";
  return eR ?? eC ?? eI;
}

/**
 * Classe NF P11-300 d'un sol. Entrées : Dmax (mm), p80um et p2mm (%, sur la
 * fraction 0/50 mm), VBS, IP, ES, w, wOPN, IPI, Ic, LA, MDE, FS ; pour
 * Dmax > 50 mm, fraction050 (%) et forme (« roulés » ou « anguleux »).
 */
export function classerSol1992(e) {
  const { Dmax, p80um: f, p2mm, VBS, IP, ES } = e;
  const arbre = [];
  const etape = (q, r, detail = "") => arbre.push({ question: q, reponse: r, detail });
  if (!Number.isFinite(f)) return horsDomaine("Le tamisat à 80 µm est indispensable.");
  const gros = Number.isFinite(Dmax) && Dmax > 50;
  etape("Dmax > 50 mm ?", gros ? `oui (${fr(Dmax)} mm) : sol C, la fraction 0/50 mm est classée à part` : `non${Number.isFinite(Dmax) ? ` (${fr(Dmax)} mm)` : ""}`);
  // Classe D : insensibles à l'eau.
  if (Number.isFinite(VBS) && VBS <= 0.1 && f <= 12) {
    const sc = gros ? "D3" : p2mm > 70 ? "D1" : "D2";
    etape("VBS ≤ 0,1 et tamisat 80 µm ≤ 12 % ?", `oui : sol insensible à l'eau, ${sc}`);
    let comp = null;
    if (sc === "D1" && Number.isFinite(e.FS)) comp = `D1${e.FS <= 60 ? 1 : 2}`;
    if (sc !== "D1" && Number.isFinite(e.LA) && Number.isFinite(e.MDE)) comp = `${sc}${e.LA <= 45 && e.MDE <= 45 ? 1 : 2}`;
    return { applicable: true, classe: "D", sousClasse: sc, comportement: comp, etat: null, symbole: comp ?? sc, description: SOUS_CLASSES_1992[sc], arbre };
  }
  // Fraction 0/50 classée comme un sol A ou B.
  const fine = (() => {
    if (f > 35) {
      const sc = Number.isFinite(IP) && IP > 12 ? (IP <= 25 ? "A2" : IP <= 40 ? "A3" : "A4")
        : Number.isFinite(VBS) ? (VBS <= 2.5 ? "A1" : VBS <= 6 ? "A2" : VBS <= 8 ? "A3" : "A4") : Number.isFinite(IP) ? "A1" : null;
      return sc && { classe: "A", sc, critere: Number.isFinite(IP) && IP > 12 ? `Ip = ${fr(IP)}` : `VBS = ${fr(VBS)}` };
    }
    if (f > 12) {
      const sc = Number.isFinite(VBS) ? (VBS <= 1.5 ? "B5" : "B6") : Number.isFinite(IP) ? (IP <= 12 ? "B5" : "B6") : null;
      return sc && { classe: "B", sc, critere: Number.isFinite(VBS) ? `VBS = ${fr(VBS)}` : `Ip = ${fr(IP)}` };
    }
    const sable = p2mm > 70;
    const argileux = Number.isFinite(VBS) ? VBS > 0.2 : Number.isFinite(ES) ? ES <= (sable ? 35 : 25) : null;
    if (argileux === null || !Number.isFinite(p2mm)) return null;
    return { classe: "B", sc: sable ? (argileux ? "B2" : "B1") : (argileux ? "B4" : "B3"), critere: `tamisat 2 mm ${sable ? "> 70 %" : "≤ 70 %"}, ${Number.isFinite(VBS) ? `VBS = ${fr(VBS)}` : `ES = ${fr(ES)}`}` };
  })();
  if (!fine) return horsDomaine("Il manque la VBS (ou l'IP, ou l'ES) et le tamisat à 2 mm pour classer la fraction 0/50 mm.", { arbre });
  etape("Tamisat à 80 µm : > 35 %, de 12 à 35 %, ≤ 12 % ?", `${fr(f)} % → classe ${fine.classe}, ${fine.sc} (${fine.critere})`);
  let comp = null;
  if (["B1", "B2"].includes(fine.sc) && Number.isFinite(e.FS)) comp = `${fine.sc}${e.FS <= 60 ? 1 : 2}`;
  if (["B3", "B4", "B5"].includes(fine.sc) && Number.isFinite(e.LA) && Number.isFinite(e.MDE)) comp = `${fine.sc}${e.LA <= 45 && e.MDE <= 45 ? 1 : 2}`;
  if (comp) etape(["B1", "B2"].includes(fine.sc) ? "Friabilité FS ≤ 60 ?" : "LA ≤ 45 et MDE ≤ 45 ?", `→ ${comp}`, "paramètre de comportement : emploi en couche de forme");
  const cleEtat = fine.sc;
  const Ic = Number.isFinite(e.Ic) ? e.Ic : NaN;
  const etat = ["B1", "B3"].includes(cleEtat) ? null : etat1992(cleEtat, { IPI: e.IPI, Ic, w: e.w, wOPN: e.wOPN });
  if (["B1", "B3"].includes(cleEtat)) etape("État hydrique ?", "sans objet : sol peu sensible à l'eau (B1, B3)");
  else if (!ETATS_1992[cleEtat]) etape("État hydrique ?", `${cleEtat} : seuils à fixer par une étude spécifique`);
  else etape("État hydrique ?", etat ? `${etat}` : "indéterminé (ni IPI, ni Ic, ni wn/wOPN)", [["IPI", e.IPI], ["Ic", Ic], ["wn/wOPN", e.w / e.wOPN]].filter(([, x]) => Number.isFinite(x)).map(([p, x]) => `${p} = ${fr(x)}`).join(" ; "));
  let c = null;
  if (gros) {
    const part = e.fraction050;
    c = e.forme === "roulés" || (Number.isFinite(part) && part > 80) ? "C1" : Number.isFinite(part) && part <= 60 ? "C2" : "C2";
    etape("Gros éléments : comportement régi par la fraction 0/50 mm ?", c === "C1" ? "oui : C1" : "non : C2");
  }
  const coeur = comp ?? fine.sc;
  return {
    applicable: true, classe: c ? "C" : fine.classe, sousClasse: fine.sc, comportement: comp, etat, c,
    symbole: `${c ?? ""}${coeur}${etat ?? ""}`, description: SOUS_CLASSES_1992[c ?? fine.sc], arbre,
  };
}

/** Correspondance indicative des familles de roches entre les deux éditions. */
export const ROCHES_1992_2024 = [
  ["R1", "craies", "CH"], ["R2", "calcaires", "Li"], ["R3", "roches argileuses (marnes, argilites, pélites)", "Cl"],
  ["R4", "roches siliceuses (grès, poudingues, brèches)", "Sa, Co"], ["R5", "roches salines (sel gemme, gypse)", "SR"],
  ["R6", "roches magmatiques et métamorphiques", "Vo, Me"],
];

/** Texte d'un critère d'état (pour les tableaux du cours). */
export const critereEnClair = (txt, nom) => enClair(txt, nom, nom === "wn" ? " wOPN" : "");
