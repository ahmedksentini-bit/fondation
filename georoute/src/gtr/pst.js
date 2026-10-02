// Partie supérieure des terrassements (PST) et classe de l'arase [GTR 2024
// F1 § 4.3.3, tableau 17] : sept cas, de PST0 (impropre à la réalisation
// d'une plateforme) à PST6 (matériaux graveleux ou rocheux insensibles à
// l'eau), chacun associé à une ou deux classes de portance à long terme de
// l'arase, ARi. Les traitements « d'amélioration » laissent le sol dans son
// cas non traité ; seule la stabilisation (≥ 0,35 m, 0,70 m en deux couches
// depuis une PST1) donne la PST4.

import { horsDomaine } from "./outils.js";
import { CLASSES_AR } from "./portance.js";

/** Module de portance à long terme associé à chaque classe d'arase (MPa). */
export const MODULE_AR = Object.fromEntries(CLASSES_AR.map((c) => [c.classe, c.min]));

/** Matériaux rocheux ou crayeux qui forment une PST6 (tableau 17). */
const ROCHEUX_PST6 = /^(CH1|CH2|R1|R2|R3 ?(Cl|Li|Sa|Co|Vo|Me)|R4 ?(Cl|Li|Sa|Co|Vo|Me))/;

/**
 * Cas de PST et classe(s) d'arase. Entrées :
 *   sousClasse — F1…F4, I1, I2, S1…S4, G1…G4 (éventuellement préfixées VC1/VC2),
 *                CH1…CH4, R… pour les roches ;
 *   etat — th, h, m, s, ts ou ins ;
 *   traitement — "non", "amelioration" ou "stabilisation" ; eTraitee (m) ;
 *   nappe — "risque" (remontée possible dans la PST, pas de rabattement) ou "non" ;
 *   drainage — dispositions de drainage à la base de la chaussée et
 *              d'imperméabilisation de l'arase (pour viser AR2 en PST3) ;
 *   portanceCT — module mesuré à court terme (MPa), facultatif.
 */
export function casPST({ sousClasse = "", etat = null, traitement = "non", eTraitee = 0, nappe = "non", drainage = false, portanceCT = NaN } = {}) {
  const sc = String(sousClasse).replace(/\s+/g, " ").trim();
  const nature = sc.replace(/^VC[12]/, "");
  const avert = [];
  const res = (pst, ar, motif, extra = {}) => ({ applicable: true, pst, ar, modules: ar.map((a) => MODULE_AR[a]), motif, avertissements: avert, ...extra });
  if (!sc) return horsDomaine("Sous-classe du matériau de la PST nécessaire.");
  if (/^O|^F4\+/.test(sc)) return horsDomaine("Matériau hors du tableau des PST (sol organique, argile F4+) : étude spécifique.");

  // Matériaux insensibles à l'eau : sables fins (PST5), graves et roches (PST6).
  if (etat === "ins" && /^S/.test(nature)) return res("PST5", ["AR2", "AR3"], "sable insensible à l'eau : portance durable, mais traficabilité difficile ; la portance mesurée avant la couche de forme vaut à long terme");
  if ((etat === "ins" && /^G/.test(nature)) || ROCHEUX_PST6.test(sc)) return res("PST6", ["AR2", "AR3"], "matériau graveleux ou rocheux insensible à l'eau : la portance mesurée à court terme vaut à long terme");

  // Stabilisation : PST4 si l'épaisseur traitée suffit.
  if (traitement === "stabilisation") {
    const mini = etat === "h" ? 0.7 : 0.35;
    if (etat === "th") avert.push("Un sol très humide doit d'abord être ramené à un état compatible avec le traitement (drainage, purge, substitution).");
    else if (eTraitee + 1e-9 >= mini) return res("PST4", ["AR2"], `sol sensible à l'eau stabilisé par un traitement sur ${String(eTraitee).replace(".", ",")} m (au moins ${String(mini).replace(".", ",")} m${etat === "h" ? ", en deux couches depuis une PST1" : ""})`);
    else avert.push(`Épaisseur traitée insuffisante pour une PST4 (${String(mini).replace(".", ",")} m au moins${etat === "h" ? " en deux couches depuis une PST1" : ""}) : le sol est classé comme non traité.`);
  } else if (traitement === "amelioration") avert.push("Un traitement d'amélioration (action à court terme) ne change pas le cas de PST : le sol est classé comme non traité.");

  if (etat === "ins") return res("PST3", ["AR1"], "matériau insensible à l'eau hors cas prévus : à examiner");
  if (etat === "th") return res("PST0", ["AR0"], "sol sensible à l'eau très humide : pas de couche de forme possible sans reclassement (drainage, purge, substitution, traitement)");
  if (etat === "h") {
    if (Number.isFinite(portanceCT) && portanceCT < 15) return res("PST0", ["AR0"], "sol humide dont la portance à court terme est inférieure à 15–20 MPa : on est ramené au cas PST0, une amélioration est indispensable");
    return res("PST1", ["AR1"], "sol sensible à l'eau de mauvaise portance au moment des travaux, sans amélioration possible à long terme : couche de forme granulaire épaisse, ou traitement pour changer de cas ; pas de couche de forme traitée sur une PST1");
  }
  if (["m", "s", "ts"].includes(etat)) {
    if (etat === "ts") avert.push("État très sec : traité comme l'état sec ; une humidification préalable est en général nécessaire.");
    if (/^F[34]/.test(nature)) return res("PST2", ["AR1"], "argile F3 ou F4 en état moyen ou sec : la portance peut chuter à long terme ; on reste en PST2 même drainé");
    if (nappe === "risque") return res("PST2", ["AR1"], "sol sensible à l'eau de bonne portance aujourd'hui, mais exposé à une remontée de nappe et aux infiltrations : la portance peut chuter à long terme");
    const ar2 = etat === "m" && drainage && !/^F/.test(nature);
    if (etat === "m" && drainage && /^F/.test(nature)) avert.push("Les sols fins ne permettent en général pas d'accéder en l'état à une AR2, même drainés.");
    return res("PST3", ar2 ? ["AR1", "AR2"] : ["AR1"], ar2
      ? "sol sensible à l'eau, sans remontée de nappe, en état moyen, avec drainage à la base de la chaussée et imperméabilisation de l'arase : AR2 accessible selon la nature du matériau"
      : `sol sensible à l'eau sans risque de remontée de nappe${etat !== "m" ? " ; en état sec, on est limité à AR1" : " ; sans dispositions de drainage et d'imperméabilisation, AR1"}`);
  }
  return horsDomaine("État hydrique du matériau de la PST nécessaire (th, h, m, s, ts ou ins).");
}

/** Portance à court terme mesurée sur l'arase face au module à long terme de la classe retenue. */
export function verifierArase({ EV2, ar }) {
  const cible = MODULE_AR[ar];
  if (!Number.isFinite(EV2) || !Number.isFinite(cible)) return null;
  return { ok: EV2 >= cible, cible };
}
