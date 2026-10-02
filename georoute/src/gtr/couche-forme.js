// Couche de forme : dimension des plus gros éléments, épaisseurs de
// surclassement de la plateforme. Les épaisseurs du GTR 2024 (F1 § 4.3.5)
// ne sont pas reprises ici ; celles du GTR 2000 (tableaux XIII, XIV, XVI)
// sont données comme référence pédagogique, avec leur édition.

import { horsDomaine } from "./outils.js";

/**
 * Plus grande longueur admise pour une couche de forme non traitée [F1 §
 * 4.2.1, tableau 13] : Lmax ≤ 250 mm et ≤ la moitié de l'épaisseur de la
 * couche élémentaire compactée (e en m, Lmax en mm).
 */
export const lmaxCoucheForme = (e) => Math.min(250, (1000 * e) / 2);

/** Dimension maximale des matériaux traités : 63 mm malaxés en centrale, 100 mm en place [F1 § 4.2.1]. */
export const DMAX_TRAITE = { centrale: 63, place: 100 };

/**
 * Épaisseurs de couche de forme du GTR 2000 (fascicule I § 3.4.2) pour
 * passer d'une arase AR1 ou AR2 à une plateforme visée.
 *  · non traitée (tableau XIII) : AR1 → PF3 0,80 m ; AR2 → PF3 0,50 m
 *    (0,10 à 0,15 m de moins avec un géotextile adapté sous la couche) ;
 *  · sol fin traité en place (tableau XIV, PST2 et PST3 seulement) :
 *    AR1 → PF3 0,70 m à la chaux seule (A3), 0,50 m chaux + ciment ;
 *    AR2 → PF3 0,50 m à la chaux seule, 0,35 m chaux + ciment ;
 *  · matériau grenu traité aux liants (tableau XVI) : selon la classe
 *    mécanique 3, 4 ou 5.
 */
export const EPAISSEURS_2000 = {
  nonTraite: { AR1: { PF3: 0.8 }, AR2: { PF3: 0.5 } },
  finChaux: { AR1: { PF3: 0.7 }, AR2: { PF3: 0.5 } },
  finChauxCiment: { AR1: { PF3: 0.5 }, AR2: { PF3: 0.35 } },
  grenuTraite: {
    AR1: { 3: { PF2: null, PF3: 0.3, PF4: 0.4 }, 4: { PF2: 0.3, PF3: 0.35, PF4: 0.45 }, 5: { PF2: 0.35, PF3: 0.5, PF4: 0.55 } },
    AR2: { 3: { PF3: 0.25, PF4: 0.3 }, 4: { PF3: 0.3, PF4: 0.35 }, 5: { PF3: 0.35, PF4: 0.45 } },
  },
};

/** Épaisseur du GTR 2000 pour un type de couche de forme, une arase et une plateforme visée. */
export function epaisseur2000({ type, ar, pf, classe = null }) {
  const t = EPAISSEURS_2000[type];
  if (!t) return horsDomaine(`Type de couche de forme inconnu : ${type}`);
  const parAr = t[ar];
  if (!parAr) return horsDomaine(`Pas d'épaisseur tabulée pour une arase ${ar}.`);
  const ligne = type === "grenuTraite" ? parAr[classe] : parAr;
  if (!ligne) return horsDomaine(`Classe mécanique ${classe ?? "?"} non tabulée.`);
  if (!(pf in ligne)) return horsDomaine(`Plateforme ${pf} non tabulée pour ce cas.`);
  const e = ligne[pf];
  const notes = [];
  if (e === null) return { applicable: true, e: 0.3, notes: ["épaisseur minimale de 30 cm : elle permet même un reclassement en PF3"] };
  if (type === "grenuTraite" && e >= 0.45) notes.push("la compacité visée en fond de couche conduit en général à deux couches");
  if (type.startsWith("fin")) notes.push("en deux couches ; non applicable sur une PST1");
  if (type === "nonTraite" && ar === "AR1") notes.push("réduction de 0,10 à 0,15 m admise avec un géotextile adapté entre couche de forme et PST");
  return { applicable: true, e, notes };
}
