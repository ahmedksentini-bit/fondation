// Outils communs aux bancs d'essai du compactage et du contrôle (chapitres 7,
// 8 et 10) : planche de compactage, gammadensimètre, pénétromètre dynamique
// léger (PANDA) et essai de plaque. On y trouve le bruit reproductible des
// mesures simulées, les états de compactage d'une couche (décrits par le
// modèle d'enseignement profilDensification, si bien que le gammadensimètre
// et le pénétromètre racontent la même couche), la teinte d'un sol selon son
// taux de compactage, une barre d'échelle pour les loupes — et, en attendant
// leur place dans src/gtr, les petits solveurs propres à ces essais : formule
// des Hollandais, étalonnages du gammadensimètre, tableau de compactage réduit
// de la planche.
import { profilDensification, tableauCompactage, celluleCompactage, ENERGIES } from "../gtr/compactage.js";
import { conditionsRemblai } from "../gtr/utilisation.js";
import { teinte } from "./loupe.js";

const n1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : "0");
export const borne = (x, a, b) => Math.min(b, Math.max(a, x));

// ─────────────────────────── Bruit reproductible ───────────────────────────

/** Valeur pseudo-aléatoire reproductible dans [0, 1[ pour deux entiers et une graine. */
export const hasard = (i, j = 0, graine = 0) => {
  const x = Math.sin(i * 127.1 + j * 311.7 + graine * 74.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Écart normal centré réduit reproductible (Box–Muller sur deux tirages). */
export const gauss = (i, graine = 0) =>
  Math.sqrt(-2 * Math.log(Math.max(1e-9, hasard(i, 1, graine)))) * Math.cos(2 * Math.PI * hasard(i, 2, graine));

/** Graine numérique tirée d'une chaîne (les réglages d'un banc). */
export const graineDe = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 9973, 7);

/** Bruit lisse et reproductible dans [−1, 1] d'une abscisse : somme de sinusoïdes de phases fixées par la graine. */
export function bruitLisse(graine, frequences = [[1.3, 0.5], [2.9, 0.3], [6.1, 0.2]]) {
  const phases = frequences.map((_, i) => 2 * Math.PI * hasard(i, 7, graine));
  const somme = frequences.reduce((a, [, p]) => a + p, 0);
  return (x) => frequences.reduce((a, [w, p], i) => a + p * Math.sin(w * x + phases[i]), 0) / somme;
}

/** Comptage radioactif : loi de Poisson, approchée par une loi normale d'écart type √N. */
export const comptagePoisson = (N, i, graine) => Math.max(0, Math.round(N + Math.sqrt(N) * gauss(i, graine)));

// ───────────────────────── Couches et matériaux ──────────────────────────

/**
 * États de compactage d'une couche contrôlée, décrits par le modèle
 * d'enseignement profilDensification : N, nombre d'applications rapporté au N
 * du tableau ; e, épaisseur de la couche rapportée à l'épaisseur que le
 * compacteur sait traiter. Bien compactée : la couche atteint q3 (≈ 99 % en
 * moyenne, 97 % au fond) ; insuffisante : trop peu de passes, toute la
 * couche est lâche (≈ 90 %) ; fond mal compacté : assez de passes, mais une
 * couche trop épaisse — la moyenne passe q4, le fond reste vers 91 %.
 */
export const ETATS_COUCHE = {
  correct: { nom: "bien compactée", N: 2, e: 0.75 },
  insuffisant: { nom: "compactage insuffisant", N: 0.35, e: 1 },
  fond: { nom: "fond de couche mal compacté", N: 1.5, e: 1.6 },
};

/** Profil du taux de compactage (% de ρdOPN) d'une couche d'épaisseur e (m) dans l'un des états ci-dessus. */
export function profilEtat(etat, e) {
  const x = ETATS_COUCHE[etat] ?? ETATS_COUCHE.correct;
  return profilDensification({ N: 10 * x.N, Nref: 10, e, eRef: e / x.e });
}

/**
 * Teneur en eau d'une couche mise en œuvre : celle du sol en place, ramenée
 * dans l'état moyen (0,92 à 1,08 wOPN) par l'aération ou l'arrosage que
 * prescrivent les conditions d'utilisation.
 */
export const teneurMiseEnOeuvre = (s) => borne(s.wn, 0.92 * s.wOPN, 1.08 * s.wOPN);

/** Teinte d'un sol selon son taux de compactage : pâle à l'état foisonné (≈ 80 %), sombre une fois serré (≥ 100 %). */
export const teinteTaux = (fond, taux) => teinte(fond, 1.1 - 0.4 * borne((taux - 80) / 21, 0, 1));

/**
 * Les blocs de la charpente peuvent rétrécir sous la largeur de leur contenu :
 * un tableau large défile dans son cadre (.table-large) au lieu d'élargir tout
 * le banc sur un téléphone.
 */
export const contenirLargeur = (c) => { for (const el of c.corps.children) el.style.minWidth = "0"; };

/** Barre d'échelle d'une loupe (px de long, libellé). */
export const barreEchelle = (x, y, px, libelle) =>
  `<g><path d="M${n1(x)} ${n1(y)}h${n1(px)}M${n1(x)} ${n1(y - 4)}v8M${n1(x + px)} ${n1(y - 4)}v8" stroke="#0f172a" stroke-width="1.6" fill="none"/>`
  + `<text x="${n1(x + px / 2)}" y="${n1(y - 7)}" text-anchor="middle" class="halo">${libelle}</text></g>`;

// ───────────────── Solveurs provisoires (à verser dans src/gtr) ─────────────────

/**
 * Tableau de compactage réduit de la planche : valeurs du tableau « F1,
 * VC2F1 » du fascicule 2 du GTR 2024 (annexe 4), énergie de compactage
 * moyenne (code 2), pour les six compacteurs du banc — Q/S (m) et une ou deux
 * options (épaisseur maximale e en m, vitesse V en km/h). Ce sont des valeurs
 * provisoires, les mêmes pour tous les matériaux : un module du site les
 * remplacera par les tableaux complets (src/gtr/tables-compactage.js, lus par
 * tableauCompactage et celluleCompactage de src/gtr/compactage.js), qui
 * distinguent les matériaux et l'usage (remblai ou couche de forme).
 */

/**
 * Symbole de recherche dans les tableaux de compactage pour un sol du
 * catalogue : la sous-classe de nature, avec « ins » pour S3, S4, G3 et G4
 * insensibles (F1h → F1, I2m → I2, S21ins → S2, G31ins → G3ins, G11ins → G1).
 */
export function symboleTableau(classe) {
  const m = /^(VC[12])?([FISG])(\d)\d?(ins)?/.exec(String(classe));
  if (!m) return String(classe);
  const nature = `${m[1] ?? ""}${m[2]}${m[3]}`;
  return m[4] && /[SG][34]$/.test(nature) ? `${nature}ins` : nature;
}

/** Clé d'un sol dans les tableaux d'utilisation en remblai : nature sans chiffre de comportement, puis état (G31h → G3h). */
export function cleRemblai(classe) {
  const m = /^(VC[12])?([FISG]\d)\d?(ins|th|h|m|s|ts)?$/.exec(String(classe));
  return m ? `${m[1] ?? ""}${m[2]}${m[3] ?? ""}` : String(classe);
}

const propre = (t) => {
  const x = String(t).replace(/\(\*\)/g, "").replace(/\s+\/\s+/g, " · ").replace(/\s+/g, " ").trim();
  return x.length > 64 ? `${x.slice(0, x.lastIndexOf(",", 60))}…` : x;
};

/**
 * Cellule de la planche pour un sol, un compacteur et un objectif, lue dans
 * les tableaux de compactage de l'annexe 4 (src/gtr/tables-compactage.js) :
 *  · q4, remblai : l'énergie (code C) est celle de la première solution du
 *    tableau d'utilisation par temps neutre (« = ») ;
 *  · q3, couche de forme : ligne du matériau traité, sauf pour les matériaux
 *    insensibles à l'eau, lus parmi les granulaires non traités.
 */
export function cellulePlanche({ sol, compacteur, objectif = "q4" }) {
  const symbole = symboleTableau(sol.classe);
  if (objectif === "q3") {
    const ins = /ins$/.test(sol.classe);
    const t = tableauCompactage(symbole, { usage: "couche de forme", traite: !ins, forme: /roul/.test(sol.texte ?? "") ? "roulés" : "anguleux" });
    return { cellule: celluleCompactage(t, compacteur) ?? null, symbole, source: t ? `tableau « ${propre(t.tableau.titre)} », ligne « ${propre(t.ligne.libelle)} », p. ${t.tableau.page}` : "aucun tableau de couche de forme pour ce matériau" };
  }
  const cond = conditionsRemblai(cleRemblai(sol.classe), "=");
  const code = cond.solutions?.[0]?.code?.[5] ?? "2";
  const t = tableauCompactage(symbole, { usage: "remblai" });
  return { cellule: celluleCompactage(t, compacteur, code) ?? null, symbole, code, source: t ? `tableau « ${propre(t.tableau.titre)} », p. ${t.tableau.page}, énergie ${ENERGIES[code]} (code ${code})` : "aucun tableau de remblai pour ce matériau" };
}

/**
 * Formule des Hollandais sous sa forme énergétique (pénétromètre dynamique
 * léger à énergie variable, XP P94-105) : l'énergie cinétique E = M V²/2 du
 * coup, réduite par le choc de la masse frappante M sur la masse frappée P
 * (tête, tiges, pointe), rapportée à la section A de la pointe et à
 * l'enfoncement e du coup :
 *   qd = (1/A) · E · M/(M + P) / e  =  M² V² / (2 e (M + P) A).
 * E en J, M et P en kg, A en cm², e en mm ; qd en MPa.
 */
export const qdHollandais = ({ E, M, P, A, e }) => (E * M) / (M + P) / (A * 1e-4 * e * 1e-3) / 1e6;

/** Enfoncement d'un coup (mm) dans un sol de résistance qd (MPa) : la même formule, lue à l'envers. */
export const enfoncementHollandais = ({ E, M, P, A, qd }) => ((E * M) / (M + P) / (A * 1e-4 * qd * 1e6)) * 1e3;

/**
 * Gammadensimètre en transmission directe (NF P94-061-1) : la source de
 * césium 137 descend dans le trou à la profondeur z ; les détecteurs, dans
 * l'embase, sont à d = 0,25 m de la tige. Les photons qui parviennent aux
 * détecteurs ont traversé le sol sur L = √(z² + d²) : le comptage décroît
 * comme 1/L² (géométrie) et comme exp(−μ L ρh) (atténuation, μ coefficient
 * apparent, diffusion comprise). C'est l'étalonnage d'un appareil virtuel :
 * celui d'un appareil réel est établi par son constructeur sur des blocs de
 * référence et vérifié chaque jour par le comptage de référence.
 */
export const GAMMA = { d: 0.25, K: 1.055e8, mu: 0.045 }; // m ; coups/min × cm² ; 1/(cm · Mg/m³)
const trajetGamma = (z) => 100 * Math.hypot(z, GAMMA.d); // cm

/** Comptage gamma (coups par minute) pour une masse volumique humide ρh (Mg/m³), source à z (m). */
export const comptageGamma = ({ rhoH, z }) => {
  const L = trajetGamma(z);
  return (GAMMA.K / (L * L)) * Math.exp(-GAMMA.mu * L * rhoH);
};

/** Courbe d'étalonnage lue à l'envers : masse volumique humide ρh (Mg/m³) d'un comptage N (coups/min), source à z (m). */
export const rhoHGamma = ({ N, z }) => {
  const L = trajetGamma(z);
  return Math.log(GAMMA.K / (L * L) / N) / (GAMMA.mu * L);
};

/**
 * Sonde neutronique (américium-béryllium, en rétrodiffusion depuis l'embase) :
 * les neutrons rapides, ralentis par l'hydrogène de l'eau, reviennent vers le
 * détecteur ; le comptage croît avec la masse d'eau par unité de volume
 * mEau (kg/m³), sur les 15 à 20 cm supérieurs.
 */
export const comptageNeutrons = ({ mEau }) => 150 + 5 * mEau;
export const masseEauNeutrons = ({ N }) => (N - 150) / 5;
