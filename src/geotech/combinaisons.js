// Combinaisons d'actions, pour une action permanente G et une action
// variable de base Q (plus, éventuellement, une variable d'accompagnement Q2).
//  · Fascicule 62 titre V, chapitre A.5 (forme simplifiée « modèle linéaire »
//    de l'article A.5.2,1 pour l'ELU) ;
//  · NF EN 1990 et annexes nationales, NF P94-261 § 7.2 / NF P94-262 § 7.3
//    (approche de calcul 2).
// Chaque action est un torseur { V, H, M } exprimé à la base de la fondation.

const t = (a) => ({ V: a?.V ?? 0, H: a?.H ?? 0, M: a?.M ?? 0 });
const somme = (...termes) => termes.reduce((s, [k, a]) => ({
  V: s.V + k * a.V, H: s.H + k * a.H, M: s.M + k * a.M,
}), { V: 0, H: 0, M: 0 });

/**
 * Fascicule 62 : G défavorable ou favorable selon l'effet recherché.
 *  ELU fondamental (forme linéaire) : 1,35 Gmax + Gmin + γQ1 Q1 + 1,3 ψ0 Q2,
 *    γQ1 = 1,5 (1,35 pour les charges d'exploitation étroitement bornées) ;
 *  ELU accidentel : G + FA + ψ11 Q1 + ψ2 Q2 ;
 *  ELS rare : G + Q1 + ψ0 Q2 ; fréquent : G + ψ11 Q1 + ψ2 Q2 ; QP : G + ψ2 (Q1 + Q2).
 */
export function combinaisonsF62({ G, Q, Q2 = null, A = null, psi = {}, gQ1 = 1.5, favorable = false }) {
  const g = t(G), q = t(Q), q2 = t(Q2), a = t(A);
  const { psi0 = 0.77, psi1 = 0.6, psi2 = 0.3 } = psi;
  const gG = favorable ? 1.0 : 1.35;
  return {
    ELU: { nom: "ELU fondamental", ...somme([gG, g], [gQ1, q], [1.3 * psi0, q2]) },
    ELU_acc: A ? { nom: "ELU accidentel", ...somme([1, g], [1, a], [psi1, q], [psi2, q2]) } : null,
    ELS_rare: { nom: "ELS rare", ...somme([1, g], [1, q], [psi0, q2]) },
    ELS_freq: { nom: "ELS fréquent", ...somme([1, g], [psi1, q], [psi2, q2]) },
    ELS_QP: { nom: "ELS quasi permanent", ...somme([1, g], [psi2, q], [psi2, q2]) },
  };
}

/**
 * NF EN 1990 (bâtiments), approche 2 :
 *  ELU fondamental (6.10) : 1,35 Gsup (ou 1,0 Ginf) + 1,5 Q1 + 1,5 ψ0 Q2 ;
 *  ELU accidentel (6.11) : G + Ad + ψ1 Q1 + ψ2 Q2 ;
 *  ELS caractéristique : G + Q1 + ψ0 Q2 ; fréquent : G + ψ1 Q1 + ψ2 Q2 ;
 *  quasi permanent : G + ψ2 Q1 + ψ2 Q2.
 * Pour les ponts routiers, γQ vaut 1,35 sur le trafic (gQ1 = 1,35).
 */
export function combinaisonsEC7({ G, Q, Q2 = null, A = null, psi = {}, gQ1 = 1.5, favorable = false }) {
  const g = t(G), q = t(Q), q2 = t(Q2), a = t(A);
  const { psi0 = 0.7, psi1 = 0.5, psi2 = 0.3 } = psi;
  const gG = favorable ? 1.0 : 1.35;
  return {
    ELU: { nom: "ELU fondamental", ...somme([gG, g], [gQ1, q], [1.5 * psi0, q2]) },
    ELU_acc: A ? { nom: "ELU accidentel", ...somme([1, g], [1, a], [psi1, q], [psi2, q2]) } : null,
    ELS_car: { nom: "ELS caractéristique", ...somme([1, g], [1, q], [psi0, q2]) },
    ELS_freq: { nom: "ELS fréquent", ...somme([1, g], [psi1, q], [psi2, q2]) },
    ELS_QP: { nom: "ELS quasi permanent", ...somme([1, g], [psi2, q], [psi2, q2]) },
  };
}

/** Correspondance des états limites entre les deux référentiels. */
export const CORRESPONDANCE = [
  { F62: "ELU", EC7: "ELU", role: "portance, glissement, renversement" },
  { F62: "ELU_acc", EC7: "ELU_acc", role: "chocs, séisme (hors EC8), crue exceptionnelle" },
  { F62: "ELS_rare", EC7: "ELS_car", role: "portance de service, décompression" },
  { F62: "ELS_freq", EC7: "ELS_freq", role: "décompression (F62), fissuration (EC2)" },
  { F62: "ELS_QP", EC7: "ELS_QP", role: "tassements, fluage, décompression" },
];
