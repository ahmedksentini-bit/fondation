// Engins de terrassement : cycles et rendements. Les volumes se comptent en
// m³ en place (le déblai mesuré au profil) ; les bennes et les godets se
// remplissent en m³ foisonnés, d'où le coefficient de foisonnement Cf.

/**
 * Pelle hydraulique : rendement en m³ en place par heure,
 *   Q = 3 600 q kr E / (tc Cf)
 * q capacité du godet (m³ foisonnés), kr coefficient de remplissage, E
 * efficacité horaire (minutes utiles / 60), tc durée d'un cycle (s).
 */
export function pelle({ q, kr = 0.9, E = 0.83, tc = 20, Cf = 1.25 }) {
  const parCycle = q * kr; // m³ foisonnés
  return { parCycle, cyclesParHeure: (3600 * E) / tc, Q: (3600 * parCycle * E) / (tc * Cf) };
}

/**
 * Cycle d'un tombereau : chargement (n godets de la pelle), trajet en
 * charge, déchargement et manœuvres, retour à vide. Distances en m,
 * vitesses en km/h, durées en s.
 */
export function tombereau({ capacite, godet, kr = 0.9, tcPelle = 20, distance, vCharge = 20, vVide = 35, tFixe = 120 }) {
  const n = Math.max(1, Math.round(capacite / (godet * kr)));
  const charge = n * godet * kr; // m³ foisonnés par voyage
  const tChargement = n * tcPelle;
  const tAller = (3.6 * distance) / vCharge, tRetour = (3.6 * distance) / vVide;
  const cycle = tChargement + tAller + tRetour + tFixe;
  return { godets: n, charge, tChargement, tAller, tRetour, tFixe, cycle };
}

/**
 * Atelier pelle + tombereaux : nombre de tombereaux qui sature la pelle
 * (n = cycle du tombereau / durée de chargement, arrondi au-dessus), et
 * rendement de l'atelier, limité par la pelle ou par la flotte.
 */
export function atelier({ q, kr = 0.9, E = 0.83, tc = 20, Cf = 1.25, capacite, distance, vCharge = 20, vVide = 35, tFixe = 120, nCamions = null }) {
  const P = pelle({ q, kr, E, tc, Cf });
  const T = tombereau({ capacite, godet: q, kr, tcPelle: tc, distance, vCharge, vVide, tFixe });
  const nSature = Math.ceil(T.cycle / T.tChargement - 1e-9);
  const n = nCamions ?? nSature;
  // Débit de la flotte : n voyages par cycle, chacun de T.charge m³ foisonnés.
  const Qflotte = (3600 * E * n * T.charge) / (T.cycle * Cf);
  const Q = Math.min(P.Q, Qflotte);
  return { pelle: P, tombereau: T, nSature, n, Qflotte, Q, limite: Qflotte < P.Q ? "la flotte de tombereaux" : "la pelle" };
}

/**
 * Bouteur poussant à distance d : volume de lame Vl (m³ foisonnés), vitesse
 * de poussée et de retour (km/h), temps fixe (s) ; rendement en m³ en place
 * par heure.
 */
export function bouteur({ Vl, distance, vPousse = 3, vRetour = 7, tFixe = 15, E = 0.83, Cf = 1.25 }) {
  const cycle = (3.6 * distance) / vPousse + (3.6 * distance) / vRetour + tFixe;
  return { cycle, Q: (3600 * Vl * E) / (cycle * Cf) };
}
