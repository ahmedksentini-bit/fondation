// Essais sur les matériaux rocheux et les granulats : Los Angeles,
// micro-Deval en présence d'eau, friabilité des sables, fragmentabilité et
// dégradabilité des roches évolutives.

/**
 * Los Angeles (NF EN 1097-2) : 5 000 g de gravillons 10/14 mm et 11 boulets
 * d'acier tournent 500 tours dans le tambour ; LA = 100 m/M, m étant la
 * masse passant au tamis de 1,6 mm à la fin de l'essai.
 */
export const losAngeles = ({ passant16, M = 5000 }) => (100 * passant16) / M;

/**
 * Micro-Deval en présence d'eau (NF EN 1097-1) : 500 g de gravillons 10/14,
 * 5 000 g de billes et 2,5 L d'eau, 12 000 tours ; MDE = 100 (M − m)/M, m
 * étant la masse restant sur le tamis de 1,6 mm.
 */
export const microDeval = ({ refus16, M = 500 }) => (100 * (M - refus16)) / M;

/**
 * Friabilité des sables (NF P18-576) : 500 g de sable 0,2/2 mm broyés avec
 * des billes dans le cylindre du micro-Deval ; FS = 100 m/M, m étant la masse
 * de fines produites (passant au tamis de contrôle).
 */
export const friabiliteSables = ({ fines, M = 500 }) => (100 * fines) / M;

/**
 * Coefficient de fragmentabilité (NF EN 17542-2) : rapport des D10 avant et
 * après 100 coups de dame Proctor normal sur un échantillon 10/20 mm.
 * IFR > 7 : roche fragmentable.
 */
export const fragmentabilite = ({ D10avant, D10apres }) => D10avant / D10apres;

/**
 * Coefficient de dégradabilité (NF EN 17542-1) : rapport des D10 avant et
 * après quatre cycles de séchage et d'immersion. IDGa > 20 : très dégradable.
 */
export const degradabilite = ({ D10avant, D10apres }) => D10avant / D10apres;

/**
 * Évolution d'un échantillon sous essai : D10 après n opérations, pour un
 * matériau dont le coefficient final vaut C après nTotal opérations (loi
 * géométrique : chaque opération divise D10 par le même facteur). Sert aux
 * bancs d'essai animés.
 */
export const d10Apres = ({ D10avant, coefficient, n, nTotal }) => D10avant / coefficient ** (n / nTotal);
