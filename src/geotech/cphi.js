// Portance « analytique » à partir de c et φ — NF EN 1997-1, annexe D.
// C'est la méthode de la feuille du guide EC7 du CSTB (M. Zerhouni, 2009)
// fournie avec le cours ; la NF P94-261 la reprend dans son annexe F en y
// ajoutant un coefficient de modèle, et la réserve aux cas où les essais en
// place ne sont pas représentatifs.
//
// Unités : B', L' en m · c', cu, q' en kPa · γ' en kN/m³ · V, H en kN · angles en degrés.

import { RAD, horsDomaine } from "./outils.js";
import { GAMMA_RV_EC7 } from "./superficielles.js";

/** Facteurs de portance (D.4) : Nq, Nc, Nγ = 2 (Nq − 1) tanφ' (base rugueuse). */
export function facteursPortance(phi) {
  if (phi <= 0) return { Nq: 1, Nc: Math.PI + 2, Ngamma: 0 };
  const t = Math.tan(phi * RAD);
  const Nq = Math.exp(Math.PI * t) * Math.tan((45 + phi / 2) * RAD) ** 2;
  return { Nq, Nc: (Nq - 1) / t, Ngamma: 2 * (Nq - 1) * t };
}

/**
 * Conditions drainées (NF EN 1997-1 D.4) :
 *   R/A' = c' Nc bc sc ic + q' Nq bq sq iq + ½ γ' B' Nγ bγ sγ iγ
 * forme : "filante" | "rectangulaire" | "carree" ; H parallèle à B' (sens
 * "B") ou à L' (sens "L") ; alpha : inclinaison de la base (degrés).
 */
export function portanceDrainee({ forme = "filante", Bp, Lp = Infinity, phi, c = 0, q, gamma, V, H = 0, sensH = "B", alpha = 0 }) {
  if (!(phi > 0)) return horsDomaine("φ' nul : utiliser la formule non drainée");
  const { Nq, Nc, Ngamma } = facteursPortance(phi);
  const t = Math.tan(phi * RAD);
  const s = Math.sin(phi * RAD);
  const r = forme === "filante" ? 0 : forme === "carree" ? 1 : Math.min(Bp / Lp, 1);
  // Forme
  const sq = forme === "filante" ? 1 : 1 + r * s;
  const sg = forme === "filante" ? 1 : 1 - 0.3 * r;
  const sc = (sq * Nq - 1) / (Nq - 1);
  // Inclinaison de la base
  const a = alpha * RAD;
  const bq = (1 - a * t) ** 2, bg = bq;
  const bc = bq - (1 - bq) / (Nc * t);
  // Inclinaison de la charge
  const Ap = forme === "filante" ? Bp : Bp * Lp;
  const m = sensH === "L" && forme !== "filante"
    ? (2 + Lp / Bp) / (1 + Lp / Bp)
    : (2 + r) / (1 + r);
  const base = 1 - H / (V + Ap * c / t);
  if (base <= 0) return horsDomaine("H ≥ V + A'c' cotφ' : la charge est trop inclinée pour la formule");
  const iq = base ** m, ig = base ** (m + 1);
  const ic = iq - (1 - iq) / (Nc * t);
  const termeC = c * Nc * bc * sc * ic;
  const termeQ = q * Nq * bq * sq * iq;
  const termeG = 0.5 * gamma * Bp * Ngamma * bg * sg * ig;
  const qu = termeC + termeQ + termeG;
  return {
    applicable: true, Nq, Nc, Ngamma, sq, sc, sg, bq, bc, bg, iq, ic, ig, m,
    termeC, termeQ, termeG, qu, R: qu * Ap, Ap,
  };
}

/**
 * Conditions non drainées (NF EN 1997-1 D.3) :
 *   R/A' = (π + 2) cu bc sc ic + q
 * bc = 1 − 2α/(π + 2) ; sc = 1 + 0,2 B'/L' (1,2 pour carrée ou circulaire) ;
 * ic = ½ [1 + √(1 − H/(A' cu))].
 */
export function portanceNonDrainee({ forme = "filante", Bp, Lp = Infinity, cu, q, H = 0, alpha = 0 }) {
  const r = forme === "filante" ? 0 : forme === "carree" ? 1 : Math.min(Bp / Lp, 1);
  const Ap = forme === "filante" ? Bp : Bp * Lp;
  if (H > Ap * cu) return horsDomaine("H > A' cu : la semelle glisse avant de poinçonner");
  const bc = 1 - (2 * alpha * RAD) / (Math.PI + 2);
  const sc = 1 + 0.2 * r;
  const ic = 0.5 * (1 + Math.sqrt(1 - H / (Ap * cu)));
  const terme = (Math.PI + 2) * cu * bc * sc * ic;
  const qu = terme + q;
  return { applicable: true, bc, sc, ic, terme, qu, R: qu * Ap, Ap };
}

/** Approche de calcul 2 : Rd = Rk / γR;v, γR;v = 1,4 (NF EN 1997-1/NA, tableau A.5). */
export const GAMMA_RV_DA2 = 1.4;

export function verificationDA2({ Rk, Vd, gammaRv = GAMMA_RV_DA2 }) {
  const Rd = Rk / gammaRv;
  return { Rd, Vd, taux: Vd / Rd, ok: Vd <= Rd + 1e-9, surdimensionnement: Rd / Vd };
}

/**
 * NF P94-261, annexe F : la même résistance, mais nette et pénalisée par un
 * coefficient de modèle γR;d;v = 2,0 en conditions drainées (c', φ') et 1,2
 * en conditions non drainées (cu) — valeurs reprises par la présentation de
 * la norme au CFMS (11/10/2012) et par la notice FONDSUP de Terrasol (2020),
 * qui donne les produits γR;v γR;d;v : 2,8 et 1,68 à l'ELU fondamental.
 *   qnet = R/A' − q0 ;  Vd − R0 ≤ Rv;d = A' qnet / (γR;v γR;d;v) ;  R0 = A q0.
 * quBrut = R/A' de l'annexe D (kPa) ; q0 contrainte verticale au niveau de la
 * base retranchée de R/A' (effective en drainé, totale en non drainé) ;
 * q0Total contrainte totale γ·D qui définit R0 : la NF P94-261 ne déduit pas
 * la poussée d'Archimède de Vd (guide Cerema, note 36), Vd et R0 sont donc
 * « totaux » ; A aire totale, Ap = A'.
 */
export const GAMMA_RDV_CPHI = { draine: 2.0, nonDraine: 1.2 };

export function verificationAnnexeF({ A, Ap, quBrut, q0, q0Total = q0, Vd, drainage = "draine", etat = "ELU" }) {
  const gRv = GAMMA_RV_EC7[etat];
  if (!gRv) return horsDomaine(`état « ${etat} » non vérifié en portance par la NF P94-261`);
  const gRdv = drainage === "draine" ? GAMMA_RDV_CPHI.draine : GAMMA_RDV_CPHI.nonDraine;
  const qnet = quBrut - q0;
  const Rvd = (Ap * qnet) / (gRv * gRdv);
  const R0 = A * q0Total;
  return {
    applicable: true, gammaRv: gRv, gammaRdv: gRdv, facteur: gRv * gRdv,
    qnet, Rvd, R0, Vd, taux: (Vd - R0) / Rvd, ok: Vd - R0 <= Rvd + 1e-9,
  };
}
