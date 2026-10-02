// Sensibilité au gel des matériaux de PST et de couche de forme [GTR 2024
// F1 § 4.2.1 ; F2 annexe 3]. Trois classes : non gélif SGn, peu gélif SGp,
// très gélif SGt. L'essai de gonflement au gel (NF P98-234-2) prévaut ; à
// défaut, des règles par famille de matériaux. Le module rend la classe et
// le raisonnement qui y mène.

import { classeGel } from "./traitement.js";

/** IPI minimal d'un sol traité à la chaux seule pour être réputé peu gélif (SGp). */
export const IPI_MIN_CHAUX = [
  { famille: "F3", IPI: 10 }, { famille: "F2, I2", IPI: 15 }, { famille: "F1, I1", IPI: 20 }, { famille: "S, G", IPI: 30 },
];
const ipiMinChaux = (nature) => (/^F3/.test(nature) ? 10 : /^(F2|I2)/.test(nature) ? 15 : /^(F1|I1)/.test(nature) ? 20 : /^[SG]/.test(nature) ? 30 : NaN);

/** Pentes attribuées faute d'essai de gonflement, pour un traité réputé peu gélif. */
export const PENTES_ATTRIBUEES = { chaux: 0.4, liant: 0.25 };

/**
 * Classe de gel d'un matériau.
 * m : { nature (F1…G4, VC1…, R4 Cl, CH…), traitement : "aucun" | "chaux" | "liant",
 *       p (pente mesurée), insensibleEau (bool), LA, MDE, categorieF4 (bool), WA24 (%),
 *       Rc (MPa), Rit (MPa), mouture (mm), passant5 (%), VBS, dosage (%), q4 (bool), IPI, CBRiSurIPI }
 */
export function sensibiliteGel(m) {
  const etapes = [];
  const dit = (x) => etapes.push(x);
  const fin = (classe, pourquoi) => ({ classe, nom: { SGn: "non gélif", SGp: "peu gélif", SGt: "très gélif" }[classe] ?? classe, etapes: [...etapes, pourquoi] });
  if (Number.isFinite(m.p)) {
    const c = classeGel(m.p);
    return fin(c.classe, `pente mesurée p = ${String(m.p).replace(".", ",")} mm/(°C·h)^½ : l'essai de gonflement prévaut sur toute autre règle`);
  }
  const nature = String(m.nature ?? "");
  const graviers = (m.LA <= 45 && m.MDE <= 45) || m.categorieF4 === true || m.WA24 <= 2;
  const resGranulats = (m.LA <= 45 && m.MDE <= 45) ? "LA ≤ 45 et MDE ≤ 45" : m.categorieF4 ? "catégorie F4 au gel-dégel" : m.WA24 <= 2 ? "WA24 ≤ 2 %" : "";
  if (m.traitement === "chaux") {
    dit("matériau traité à la chaux seule, sans essai de gonflement");
    const chOuCl = /^CH|Cl/.test(nature);
    if (chOuCl) {
      if (m.mouture <= 20 && m.passant5 >= 60 && m.Rc >= 2.5) return fin("SGn", "craie ou roche argileuse : mouture ≤ 20 mm, passant à 5 mm ≥ 60 % et Rc ≥ 2,5 MPa à l'âge du premier gel");
    } else if (m.Rc >= 2.5) return fin("SGn", "Rc ≥ 2,5 MPa à l'âge du premier gel possible");
    const ipiMin = ipiMinChaux(nature.replace(/^VC2/, ""));
    if (m.VBS >= 0.5 && m.dosage >= 1.5 && m.mouture <= 40 && m.q4 && m.CBRiSurIPI > 1 && m.IPI >= ipiMin)
      return fin("SGp", `VBS ≥ 0,5, dosage ≥ 1,5 %, mouture ≤ 40 mm, compactage q4, CBRi/IPI > 1 et IPI ≥ ${ipiMin} : peu gélif, pente attribuée 0,4`);
    return fin("SGt", "aucune des règles par défaut n'est satisfaite : à défaut d'essai, le matériau est à considérer comme très gélif (un essai de gonflement peut le reclasser)");
  }
  if (m.traitement === "liant") {
    dit("matériau traité au liant hydraulique (éventuellement avec chaux), sans essai de gonflement");
    if (!/^CH|Cl/.test(nature) && m.Rit >= 0.25) return fin("SGn", "Rit ≥ 0,25 MPa à l'âge du premier gel possible");
    if (m.dosage >= 3 && m.Rc >= 1 && m.mouture <= 40 && m.q4) return fin("SGp", "dosage ≥ 3 %, Rc ≥ 1 MPa, mouture ≤ 40 mm et compactage q4 : peu gélif, pente attribuée 0,25");
    return fin("SGt", "aucune des règles par défaut n'est satisfaite : un essai de gonflement est nécessaire pour mieux classer");
  }
  // Matériaux non traités.
  if (m.insensibleEau) {
    dit("matériau insensible à l'eau (§ 4.2.1)");
    return graviers ? fin("SGn", `${resGranulats} : non gélif`) : fin("SGp", "aucun des critères LA/MDE, F4 ou WA24 n'est vérifié : peu gélif");
  }
  if (/^VC1/.test(nature)) {
    dit("matériau VC1 dont la fraction 0/63 mm est sensible à l'eau");
    return graviers ? fin("SGp", `${resGranulats} : peu gélif`) : fin("SGt", "aucun critère sur les gros éléments : très gélif");
  }
  if (/^R4 ?Cl$/.test(nature)) return fin("SGp", "roche argileuse R4 Cl : peu gélive");
  if (/^CH|R4 ?Cld/.test(nature)) return fin("SGt", "craies et roches argileuses dégradables : très gélives");
  const base = nature.replace(/^VC2/, "");
  if (/^(F3|F4)|AM-B1/.test(base)) return fin("SGp", `${nature} non traité, sans essai : peu gélif (tableau par défaut de l'annexe 3)`);
  if (/^(F1|F2|I1|I2|S|G)|R5 ?Cl/.test(base)) return fin("SGt", `${nature} sensible à l'eau, sans essai : très gélif (tableau par défaut de l'annexe 3)`);
  return { classe: null, nom: "étude spécifique", etapes: [...etapes, "matériau non visé par les règles par défaut : une étude spécifique fixe sa classe"] };
}

/**
 * Profondeur de pénétration du gel (formule de Stefan, modèle d'enseignement) :
 * z = √(2 λ I / L), I indice de gel (°C·jour, converti en °C·s), λ
 * conductivité thermique du sol gelé (W/m·K), L chaleur latente de l'eau du
 * sol par m³ = w ρd × 334 kJ/kg. Elle surestime la profondeur réelle (elle
 * néglige la chaleur sensible et le flux géothermique) : elle montre le rôle
 * de l'eau du sol et de l'intensité de l'hiver, pas un dimensionnement, qui
 * relève de la NF P98-086.
 */
export function profondeurGelStefan({ I, lambda = 1.8, w, rhoD }) {
  const L = (w / 100) * rhoD * 1000 * 334e3; // J/m³
  if (!(I > 0 && lambda > 0 && L > 0)) return NaN;
  return Math.sqrt((2 * lambda * I * 86400) / L);
}
