// Conditions d'utilisation d'un matériau classé : en remblai (annexe 2 du
// fascicule 2 du GTR 2024) et en couche de forme (annexe 3). Le module
// retrouve le cas du tableau à partir du symbole de classement, choisit les
// lignes de la situation météorologique, et décode les codes.

import { REMBLAI } from "./tables-remblai.js";
import { COUCHE_FORME } from "./tables-couche-forme.js";

/** Rubriques des conditions en remblai [F1 tableau 11]. */
export const RUBRIQUES_REMBLAI = {
  E: { nom: "Extraction", valeurs: ["pas de condition particulière", "extraction en couches (0,1 à 0,3 m)", "extraction frontale (front de taille > 1 à 2 m)"] },
  G: { nom: "Action sur la granularité", valeurs: ["pas de condition particulière", "élimination des éléments de Lmax > 800 mm", "élimination des éléments de Lmax > 250 mm pour traitement", "fragmentation complémentaire après extraction"] },
  W: { nom: "Action sur la teneur en eau", valeurs: ["pas de condition particulière", "réduction de la teneur en eau par aération", "essorage par mise en dépôt provisoire", "arrosage pour maintien de l'état", "humidification pour changer d'état"] },
  T: { nom: "Traitement", valeurs: ["pas de condition particulière", "traitement avec un réactif ou un additif adapté", "traitement à la chaux seule"] },
  R: { nom: "Régalage", valeurs: ["pas de condition particulière", "couches minces (20 à 30 cm)", "couches moyennes (30 à 50 cm)"] },
  C: { nom: "Compactage", valeurs: [null, "compactage intense", "compactage moyen", "compactage faible"] },
  H: { nom: "Hauteur des remblais", valeurs: ["pas de condition particulière", "remblai de hauteur faible (≤ 5 m)", "remblai de hauteur moyenne (≤ 10 m)"] },
};
/** Rubriques des conditions en couche de forme [F1 tableau 15]. */
export const RUBRIQUES_CDF = {
  G: { nom: "Action sur la granularité", valeurs: ["pas de condition particulière", "élimination de la fraction 0/d sensible à l'eau", "élimination de la fraction grossière empêchant un malaxage correct", "élimination de la fraction grossière empêchant un réglage correct", "élimination de la fraction 0/d et de la fraction grossière (réglage)", "fragmentation de la fraction grossière pour obtenir des fines"] },
  W: { nom: "Action sur la teneur en eau", valeurs: ["pas de condition particulière", "arrosage ou humidification pour gestion de l'état hydrique"] },
  T: { nom: "Traitement", valeurs: ["pas de condition particulière", "liant hydraulique (ciment ou LHR)", "liant hydraulique éventuellement associé à la chaux", "traitement mixte chaux + liant hydraulique", "chaux seule", "liant hydraulique et éventuellement correcteur granulométrique"] },
  S: { nom: "Protection superficielle", valeurs: ["pas de condition particulière", "enduit de cure éventuellement gravillonné", "enduit de cure gravillonné éventuellement clouté", "couche de fin réglage"] },
};

/** Météo : libellés et symboles du guide. */
export const METEOS = [
  { symbole: "++", nom: "pluie forte" }, { symbole: "+", nom: "pluie faible" },
  { symbole: "=", nom: "ni pluie ni évaporation importante" }, { symbole: "-", nom: "évaporation importante" },
];

/** Décode un code (« 1010122 » en remblai, « 0111 » en couche de forme). */
export function decoder(code, rubriques = RUBRIQUES_REMBLAI) {
  const lettres = Object.keys(rubriques);
  return lettres.map((l, i) => {
    const v = Number(code[i]);
    return { rubrique: l, nom: rubriques[l].nom, valeur: v, texte: rubriques[l].valeurs[v] ?? "?" };
  });
}

const norme = (s) => String(s).replace(/\s+/g, "").replace("VC1A4", "VC1F4");

/** La situation du tableau couvre-t-elle la météo demandée (« ++/+ », « = ou - »…) ? */
export function couvre(meteoTableau, meteo) {
  if (!meteoTableau) return true;
  // « ++/+ », « = ou - », « + = - » : symboles séparés par une barre, « ou » ou des espaces.
  const symboles = String(meteoTableau).split(/\s*\/\s*|\s+ou\s+|\s+/).map((x) => x.trim()).filter(Boolean);
  return symboles.includes(meteo);
}

/**
 * Clés de recherche d'un matériau classé dans les tableaux. Pour le remblai,
 * les sables et graves se lisent sans le chiffre de comportement (S3h) ;
 * pour la couche de forme, avec lui et sans l'état hydrique (S31, S31ins),
 * et les sols fins sans état (F1).
 */
export function cles(classement) {
  const c = classement;
  if (typeof c === "string") return { remblai: [norme(c)], couche: [norme(c)] };
  const vc = c.vc ?? "", nat = c.sousClasse, comp = c.comportement, etat = c.etat ?? "";
  const rem = [`${vc}${nat}${etat}`];
  if (c.sousClasse === "F4+") rem.unshift("F4+");
  if (c.organique) rem.unshift(c.organique);
  const cdf = [];
  if (/^[SG]/.test(nat)) {
    const comps = comp ? [comp] : [`${nat}1`, `${nat}2`];
    for (const k of comps) cdf.push(`${vc}${k}${etat === "ins" ? "ins" : ""}`);
  } else {
    if (etat === "s") cdf.push(`${vc}${nat}s`);
    cdf.push(`${vc}${nat}`);
  }
  return { remblai: rem.map(norme), couche: cdf.map(norme) };
}

const trouver = (table, cles_) => {
  for (const k of cles_) {
    const cas = table.filter((x) => x.classes.some((l) => norme(l) === k));
    if (cas.length) return { cle: k, cas };
  }
  return null;
};

/**
 * Conditions en remblai d'un matériau (objet de classement ou symbole) pour
 * une situation météorologique donnée (++, +, =, −). Renvoie le cas, et les
 * solutions applicables (ou le refus).
 */
export function conditionsRemblai(classement, meteo = "=") {
  const k = cles(classement).remblai;
  const t = trouver(REMBLAI, k);
  if (!t) return { trouve: false, cles: k };
  const cas = t.cas[0];
  if (cas.non) return { trouve: true, cle: t.cle, cas, non: cas.non, solutions: [] };
  if (cas.renvoi) return { trouve: true, cle: t.cle, cas, renvoi: cas.renvoi, solutions: [] };
  const s = (cas.situations ?? []).find((x) => couvre(x.meteo, meteo));
  if (!s) return { trouve: true, cle: t.cle, cas, non: "Situation non décrite au tableau pour cette météo : le guide ne donne pas de solution.", solutions: [] };
  if (s.non) return { trouve: true, cle: t.cle, cas, situation: s, non: s.non, solutions: [] };
  return { trouve: true, cle: t.cle, cas, situation: s, solutions: s.solutions.map((x) => ({ ...x, decode: decoder(x.code) })) };
}

/** Conditions en couche de forme : même principe, codes G W T S. */
export function conditionsCoucheForme(classement, meteo = "=") {
  const k = cles(classement).couche;
  const t = trouver(COUCHE_FORME, k);
  if (!t) return { trouve: false, cles: k };
  const cas = t.cas;
  const unCas = cas[0];
  if (unCas.texte) return { trouve: true, cle: t.cle, cas: unCas, autres: cas.slice(1), texte: unCas.texte, solutions: [] };
  const s = (unCas.situations ?? []).find((x) => couvre(x.meteo, meteo));
  if (!s) return { trouve: true, cle: t.cle, cas: unCas, autres: cas.slice(1), non: "Situation non décrite au tableau pour cette météo.", solutions: [] };
  if (s.non) return { trouve: true, cle: t.cle, cas: unCas, autres: cas.slice(1), situation: s, non: s.non, solutions: [] };
  return { trouve: true, cle: t.cle, cas: unCas, autres: cas.slice(1), situation: s, solutions: s.solutions.map((x) => ({ ...x, decode: decoder(x.code, RUBRIQUES_CDF) })) };
}

/** Toutes les classes présentes dans les tableaux (pour les listes de choix). */
export const CLASSES_REMBLAI = [...new Set(REMBLAI.flatMap((c) => c.classes))];
export const CLASSES_CDF = [...new Set(COUCHE_FORME.flatMap((c) => c.classes.map(norme)))];
