// Exercices du chapitre 15 : les engins et leurs rendements — pelle
// hydraulique, cycle d'un tombereau, atelier et nombre de saturation,
// bouteur, choix de l'engin d'extraction selon la rubrique E du GTR.
import { fr, frd, nombre, choixMelange, donnee } from "./alea.js";
import { pelle, tombereau, atelier, bouteur } from "../gtr/engins.js";
import { conditionsRemblai, RUBRIQUES_REMBLAI } from "../gtr/utilisation.js";

/** Tire des données jusqu'à ce qu'elles conviennent ; au pire, le dernier tirage reste valable (réponses du solveur). */
function tirer(a, tirage, accepte, essais = 80) {
  let d;
  for (let i = 0; i < essais; i++) { d = tirage(a); if (accepte(d)) return d; }
  return d;
}
/** Partie fractionnaire loin d'un entier : un arrondi au-dessus ne dépend pas des décimales retenues. */
const loinEntier = (x, marge = 0.06) => { const f = x - Math.floor(x); return f > marge && f < 1 - marge; };
/** Le nombre de godets arrondi est aussi la partie entière : la benne n'est pas surchargée. */
const godetsNets = (capacite, q, kr) => { const x = capacite / (q * kr); return x >= 3 && x - Math.floor(x) < 0.4; };

/** Matériaux à extraire : remplissage du godet et foisonnement courants. */
const MATERIAUX = [
  { nom: "un limon", kr: [0.95, 1.05], Cf: [1.2, 1.3] },
  { nom: "une grave argileuse", kr: [0.85, 0.95], Cf: [1.15, 1.25] },
  { nom: "un calcaire fragmenté au ripper", kr: [0.7, 0.85], Cf: [1.35, 1.5] },
];
function tirerPelle(a) {
  const m = a.choix(MATERIAUX);
  const q = a.entre(1.5, 4.5, 0.1), kr = a.entre(m.kr[0], m.kr[1], 0.05), Cf = a.entre(m.Cf[0], m.Cf[1], 0.05), tc = a.entre(16, 28, 1), minutes = a.entre(45, 55, 1);
  return { m, q, kr, Cf, tc, minutes, E: minutes / 60 };
}
function tirerTombereau(a, q, kr) {
  const capacite = a.entre(10, 30, 1), distance = a.entre(300, 3000, 50), vCharge = a.entre(15, 28, 1);
  const vVide = a.entre(vCharge + 5, 45, 1), tFixe = a.entre(90, 180, 10);
  return { capacite, distance, vCharge, vVide, tFixe, ok: godetsNets(capacite, q, kr) };
}
const textePelle = (p) => `godet de ${frd(p.q, 1)} m³, coefficient de remplissage kr = ${frd(p.kr, 2)}, cycle de ${p.tc} s, ${p.minutes} minutes utiles par heure (E = ${frd(p.E, 3)}), foisonnement Cf = ${frd(p.Cf, 2)}`;

/** Cas de remblai dont une solution impose l'extraction (rubrique E), sans discordance dans le guide imprimé. */
const CAS_E = [
  ...["F1h", "F2h", "F3h", "S2h", "G3h"].map((cle) => ({ cle, meteo: "-" })),
  ...["F1s", "F2s", "I1s", "I2s", "S3s", "G1s"].map((cle) => ({ cle, meteo: "+" })),
  ...["F1m", "F2m", "I1m", "I2m", "G3m"].map((cle) => ({ cle, meteo: "+" })),
  ...["F1s", "F2s", "I1s", "I2s", "F3s"].map((cle) => ({ cle, meteo: "-" })),
];
const NOM_NATURE = { F1: "limon peu plastique", F2: "limon argileux", F3: "argile", I1: "sable très silteux", I2: "sable argileux", S2: "sable propre mal gradué", S3: "sable limoneux", G1: "grave propre", G3: "grave silteuse" };
const NOM_ETAT = { h: "humide", m: "moyen", s: "sec" };
const METEO = { "+": "pluie faible (+)", "-": "évaporation importante (−)" };
const RAISONS = {
  "1h-": "exposer le sol humide à l'air, pour l'aérer et le sécher",
  "1s+": "exposer le sol sec à la pluie faible, qui l'humidifie un peu",
  "2m+": "soustraire le sol à la pluie, pour qu'il garde son état moyen",
  "2s-": "soustraire le sol sec à l'évaporation, qui le dessécherait encore",
};
const ENGINS = {
  1: "décapeuse (motor-scraper), éventuellement poussée par un bouteur",
  2: "pelle hydraulique, sur un front de taille de plus de 1 à 2 m",
};
const CATALOGUE = [1.2, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6];

export default [
  {
    id: "ch15-pelle", titre: "Rendement d'une pelle hydraulique", difficulte: 1,
    generer(a) {
      const d = tirer(a, (a) => {
        const p = tirerPelle(a), V = a.entre(10000, 60000, 1000);
        return { p, V, r: pelle(p) };
      }, ({ r, V }) => loinEntier(V / (8 * r.Q), 0.04));
      const { p, V, r } = d;
      const postes = Math.ceil(V / (8 * r.Q));
      return {
        enonce: `Une pelle hydraulique en rétro extrait ${p.m.nom} : ${textePelle(p)}. Le déblai à extraire représente ${fr(V, 5)} m³ en place.`,
        donnees: [donnee("Godet · kr", `${frd(p.q, 1)} m³ · ${frd(p.kr, 2)}`), donnee("Cycle", `${p.tc} s`), donnee("Temps utile", `${p.minutes} min/h`), donnee("Cf", frd(p.Cf, 2)), donnee("Déblai", `${fr(V, 5)} m³ en place`)],
        questions: [
          nombre("Volume foisonné chargé à chaque cycle ?", r.parCycle, "m³", `q kr = ${frd(p.q, 1)} × ${frd(p.kr, 2)} = ${frd(r.parCycle, 3)} m³ foisonnés.`, { rel: 0.01 }),
          nombre("Nombre de cycles utiles par heure ?", r.cyclesParHeure, "", `3 600 E / tc = 3 600 × ${frd(p.E, 3)} / ${p.tc} = ${frd(r.cyclesParHeure, 1)} cycles.`, { rel: 0.01 }),
          nombre("Rendement Q en m³ en place par heure ?", r.Q, "m³/h", `Q = 3 600 q kr E / (tc Cf) = ${frd(r.cyclesParHeure, 1)} × ${frd(r.parCycle, 3)} / ${frd(p.Cf, 2)} = ${fr(r.Q, 4)} m³ en place par heure.`, { rel: 0.02 }),
          nombre("Nombre de postes de 8 heures pour tout le déblai ?", postes, "", `${fr(V, 5)} / (8 × ${fr(r.Q, 4)}) = ${frd(V / (8 * r.Q), 2)} → ${postes} postes, si les tombereaux suivent.`, { abs: 0.5 }),
        ],
      };
    },
  },
  {
    id: "ch15-tombereau", titre: "Le cycle d'un tombereau", difficulte: 2,
    generer(a) {
      const d = tirer(a, (a) => { const p = tirerPelle(a); return { p, t: tirerTombereau(a, p.q, p.kr) }; }, ({ t }) => t.ok);
      const { p, t } = d;
      const T = tombereau({ capacite: t.capacite, godet: p.q, kr: p.kr, tcPelle: p.tc, distance: t.distance, vCharge: t.vCharge, vVide: t.vVide, tFixe: t.tFixe });
      return {
        enonce: `Une pelle (godet de ${frd(p.q, 1)} m³, kr = ${frd(p.kr, 2)}, cycle de ${p.tc} s) charge des tombereaux de ${t.capacite} m³ foisonnés, qui roulent ${fr(t.distance, 4)} m jusqu'au remblai à ${t.vCharge} km/h en charge et reviennent à vide à ${t.vVide} km/h ; déchargement et manœuvres prennent ${t.tFixe} s par rotation.`,
        donnees: [donnee("Godet · kr · cycle", `${frd(p.q, 1)} m³ · ${frd(p.kr, 2)} · ${p.tc} s`), donnee("Benne", `${t.capacite} m³ foisonnés`), donnee("Distance", `${fr(t.distance, 4)} m`), donnee("Vitesses", `${t.vCharge} km/h en charge · ${t.vVide} km/h à vide`), donnee("Temps fixes", `${t.tFixe} s`)],
        questions: [
          nombre("Nombre de godets pour remplir la benne ?", T.godets, "", `${t.capacite} / (${frd(p.q, 1)} × ${frd(p.kr, 2)}) = ${frd(t.capacite / (p.q * p.kr), 2)} → ${T.godets} godets, soit ${frd(T.charge, 2)} m³ foisonnés par voyage.`, { abs: 0.5 }),
          nombre("Durée du chargement ?", T.tChargement, "s", `Le tombereau reste sous la pelle le temps de ses godets : ${T.godets} × ${p.tc} s = ${fr(T.tChargement, 3)} s.`, { rel: 0.01 }),
          nombre("Durée du trajet en charge ?", T.tAller, "s", `${t.vCharge} km/h = ${frd(t.vCharge / 3.6, 2)} m/s ; ${fr(t.distance, 4)} / ${frd(t.vCharge / 3.6, 2)} = ${fr(T.tAller, 3)} s.`, { rel: 0.01 }),
          nombre("Durée du cycle complet du tombereau ?", T.cycle / 60, "min", `${fr(T.tChargement, 3)} + ${fr(T.tAller, 3)} + ${fr(T.tRetour, 3)} (retour) + ${t.tFixe} = ${fr(T.cycle, 4)} s, soit ${frd(T.cycle / 60, 2)} min.`, { rel: 0.02 }),
        ],
      };
    },
  },
  {
    id: "ch15-saturation", titre: "Combien de tombereaux pour une pelle ?", difficulte: 2,
    generer(a) {
      const d = tirer(a, (a) => {
        const p = tirerPelle(a), t = tirerTombereau(a, p.q, p.kr);
        const r = atelier({ ...p, ...t });
        return { p, t, r };
      }, ({ t, r }) => t.ok && loinEntier(r.tombereau.cycle / r.tombereau.tChargement, 0.08) && r.nSature >= 2 && r.nSature <= 12);
      const { p, t, r } = d;
      const n = Math.max(1, r.nSature + a.choix([-2, -1, 1])), rn = atelier({ ...p, ...t, nCamions: n });
      const T = r.tombereau;
      const LP = "la pelle", LF = "la flotte de tombereaux";
      return {
        enonce: `Pelle : ${textePelle(p)}. Elle charge des tombereaux de ${t.capacite} m³ foisonnés, dont le cycle complet (chargement, trajets, déchargement et manœuvres) dure ${frd(T.cycle / 60, 2)} min. On dispose de ${n} tombereau${n > 1 ? "x" : ""}.`,
        donnees: [donnee("Pelle", `${frd(p.q, 1)} m³ · kr ${frd(p.kr, 2)} · ${p.tc} s`), donnee("E · Cf", `${frd(p.E, 3)} · ${frd(p.Cf, 2)}`), donnee("Tombereau", `${t.capacite} m³ · cycle ${frd(T.cycle / 60, 2)} min`), donnee("Tombereaux engagés", String(n))],
        questions: [
          nombre("Rendement de la pelle (m³ en place par heure) ?", r.pelle.Q, "m³/h", `Q = 3 600 × ${frd(p.q, 1)} × ${frd(p.kr, 2)} × ${frd(p.E, 3)} / (${p.tc} × ${frd(p.Cf, 2)}) = ${fr(r.pelle.Q, 4)} m³/h.`, { rel: 0.02 }),
          nombre("Nombre de tombereaux qui sature la pelle ?", r.nSature, "", `Chargement : ${T.godets} godets × ${p.tc} s = ${fr(T.tChargement, 3)} s ; ${frd(T.cycle, 0)} / ${fr(T.tChargement, 3)} = ${frd(T.cycle / T.tChargement, 2)} → ${r.nSature} tombereaux (on arrondit au-dessus).`, { abs: 0.5 }),
          nombre(`Débit de l'atelier avec ${n} tombereau${n > 1 ? "x" : ""} ?`, rn.Q, "m³/h", `Flotte : 3 600 E n × charge / (cycle × Cf) = 3 600 × ${frd(p.E, 3)} × ${n} × ${frd(T.charge, 2)} / (${frd(T.cycle, 0)} × ${frd(p.Cf, 2)}) = ${fr(rn.Qflotte, 4)} m³/h ; l'atelier donne le plus faible de ce débit et de celui de la pelle : ${fr(rn.Q, 4)} m³/h.`, { rel: 0.02 }),
          choixMelange(a, "Qu'est-ce qui limite l'atelier ?", [rn.limite, rn.limite === LP ? LF : LP],
            `${n} ${n < r.nSature ? `< ${r.nSature} : la pelle attend les camions` : `> ${r.nSature} : les camions attendent à la pelle`} → ${rn.limite}.${n > r.nSature ? " Un tombereau de moins coûterait moins pour le même débit." : ""}`),
        ],
      };
    },
  },
  {
    id: "ch15-bouteur", titre: "Bouteur : la distance qui ruine le rendement", difficulte: 2,
    generer(a) {
      const Vl = a.entre(3, 10, 0.5), dist = a.entre(20, 80, 5), vP = a.entre(2.5, 4, 0.5), vR = a.entre(6, 10, 0.5);
      const minutes = a.entre(45, 55, 1), E = minutes / 60, Cf = a.entre(1.15, 1.35, 0.05);
      const r = bouteur({ Vl, distance: dist, vPousse: vP, vRetour: vR, tFixe: 15, E, Cf }), r2 = bouteur({ Vl, distance: 2 * dist, vPousse: vP, vRetour: vR, tFixe: 15, E, Cf });
      const bonne = "la décapeuse (motor-scraper)";
      return {
        enonce: `Un bouteur pousse une lame de ${frd(Vl, 1)} m³ foisonnés sur ${dist} m à ${frd(vP, 1)} km/h, puis revient à vide à ${frd(vR, 1)} km/h ; changements de vitesse et manœuvres prennent 15 s par cycle. Temps utile ${minutes} min par heure (E = ${frd(E, 3)}), foisonnement Cf = ${frd(Cf, 2)}.`,
        donnees: [donnee("Lame", `${frd(Vl, 1)} m³ foisonnés`), donnee("Distance", `${dist} m`), donnee("Vitesses", `${frd(vP, 1)} km/h · ${frd(vR, 1)} km/h`), donnee("E · Cf", `${frd(E, 3)} · ${frd(Cf, 2)}`)],
        questions: [
          nombre("Durée d'un cycle ?", r.cycle, "s", `3,6 × ${dist}/${frd(vP, 1)} + 3,6 × ${dist}/${frd(vR, 1)} + 15 = ${frd((3.6 * dist) / vP, 1)} + ${frd((3.6 * dist) / vR, 1)} + 15 = ${frd(r.cycle, 1)} s.`, { rel: 0.01 }),
          nombre("Rendement (m³ en place par heure) ?", r.Q, "m³/h", `Q = 3 600 Vl E / (cycle × Cf) = 3 600 × ${frd(Vl, 1)} × ${frd(E, 3)} / (${frd(r.cycle, 1)} × ${frd(Cf, 2)}) = ${fr(r.Q, 4)} m³/h.`, { rel: 0.02 }),
          nombre(`Rendement si la distance de poussée passe à ${2 * dist} m ?`, r2.Q, "m³/h", `Cycle de ${frd(r2.cycle, 1)} s → Q = ${fr(r2.Q, 4)} m³/h, soit ${fr((100 * r2.Q) / r.Q, 3)} % du rendement à ${dist} m : seul le temps fixe ne double pas.`, { rel: 0.02 }),
          choixMelange(a, "Pour transporter sur quelques centaines de mètres, quel engin prend le relais du bouteur ?", [bonne, "la niveleuse", "le compacteur à pieds dameurs", "la chargeuse en reprise de stock"],
            `Au-delà de quelques dizaines de mètres, le rendement du bouteur s'effondre : sur les distances moyennes, c'est ${bonne} ; au-delà, la pelle et les tombereaux.`),
        ],
      };
    },
  },
  {
    id: "ch15-extraction", titre: "Extraire en couches ou frontalement ? La rubrique E", difficulte: 1,
    generer(a) {
      const c = a.choix(CAS_E);
      const r = conditionsRemblai(c.cle, c.meteo);
      const sol = r.solutions.find((s) => s.code[0] !== "0");
      const E = Number(sol.code[0]), nature = c.cle.replace(/(th|h|m|s|ts)$/, ""), etat = c.cle.slice(nature.length);
      const raison = RAISONS[`${E}${etat}${c.meteo}`];
      const sens = RUBRIQUES_REMBLAI.E.valeurs[E];
      return {
        enonce: `Pour mettre en remblai un ${NOM_NATURE[nature]} ${nature} en état ${NOM_ETAT[etat]} (${c.cle}), par ${METEO[c.meteo]}, le tableau de l'annexe 2 du fascicule 2 (GTR 2024) ${r.solutions.length > 1 ? "propose, entre autres, la solution codée" : "donne la solution codée"} ${sol.code}. Son premier chiffre est celui de la rubrique E, l'extraction.`,
        donnees: [donnee("Matériau", c.cle), donnee("Météo", c.meteo === "-" ? "−" : "+"), donnee("Code", sol.code)],
        questions: [
          choixMelange(a, `Que demande le chiffre E = ${E} ?`, [sens, ...RUBRIQUES_REMBLAI.E.valeurs.filter((x) => x !== sens)], `Rubrique E [F1 tableau 11] : E = ${E} → ${sens}.`),
          choixMelange(a, "Avec quel engin extraire ?", [ENGINS[E], ENGINS[E === 1 ? 2 : 1], "niveleuse", "compacteur vibrant"],
            `${E === 1 ? "Extraire en couches de 0,1 à 0,3 m, c'est le travail de la" : "Extraire frontalement, c'est le travail de la"} ${ENGINS[E]} [F1 § 3.3].`),
          choixMelange(a, "Pourquoi ce mode d'extraction ?", [raison, ...Object.values(RAISONS).filter((x) => x !== raison)],
            `L'extraction en couches expose le sol aux agents atmosphériques, l'extraction frontale l'en protège [F1 § 3.3]. Sol ${NOM_ETAT[etat]} par ${METEO[c.meteo]} : ${raison}.`),
        ],
      };
    },
  },
  {
    id: "ch15-delai", titre: "Dimensionner un atelier pour tenir le délai", difficulte: 3,
    generer(a) {
      const d = tirer(a, (a) => {
        const p = tirerPelle(a), t = tirerTombereau(a, p.q, p.kr), r = atelier({ ...p, ...t });
        const jours = a.entre(20, 60, 5), heures = a.choix([8, 9, 10]);
        const V = Math.round((r.pelle.Q * a.entre(1.2, 3.8, 0.05) * jours * heures) / 5000) * 5000, Qreq = V / (jours * heures);
        return { p, t, V, jours, heures, r, Qreq };
      }, ({ t, r, Qreq }) => t.ok && loinEntier(Qreq / r.pelle.Q) && loinEntier(r.tombereau.cycle / r.tombereau.tChargement, 0.08) && Qreq / r.pelle.Q > 1.1 && Qreq / r.pelle.Q < 3.9);
      const { p, t, V, jours, heures, r, Qreq } = d;
      const nP = Math.ceil(Qreq / r.pelle.Q), nT = nP * r.nSature, T = r.tombereau;
      return {
        enonce: `Il faut déplacer ${fr(V, 5)} m³ en place en ${jours} jours ouvrés de ${heures} heures. Chaque pelle : ${textePelle(p)}. Elle charge des tombereaux de ${t.capacite} m³ foisonnés dont le cycle complet dure ${frd(T.cycle / 60, 2)} min.`,
        donnees: [donnee("Volume", `${fr(V, 5)} m³ en place`), donnee("Délai", `${jours} j × ${heures} h`), donnee("Pelle", `${frd(p.q, 1)} m³ · kr ${frd(p.kr, 2)} · ${p.tc} s · E ${frd(p.E, 3)} · Cf ${frd(p.Cf, 2)}`), donnee("Tombereau", `${t.capacite} m³ · cycle ${frd(T.cycle / 60, 2)} min`)],
        questions: [
          nombre("Débit à tenir (m³ en place par heure) ?", Qreq, "m³/h", `${fr(V, 5)} / (${jours} × ${heures}) = ${fr(Qreq, 4)} m³/h.`, { rel: 0.01 }),
          nombre("Rendement d'une pelle ?", r.pelle.Q, "m³/h", `Q = 3 600 × ${frd(p.q, 1)} × ${frd(p.kr, 2)} × ${frd(p.E, 3)} / (${p.tc} × ${frd(p.Cf, 2)}) = ${fr(r.pelle.Q, 4)} m³/h.`, { rel: 0.02 }),
          nombre("Nombre de pelles ?", nP, "", `${fr(Qreq, 4)} / ${fr(r.pelle.Q, 4)} = ${frd(Qreq / r.pelle.Q, 2)} → ${nP} pelle${nP > 1 ? "s" : ""}.`, { abs: 0.5 }),
          nombre("Nombre total de tombereaux, chaque pelle étant saturée ?", nT, "", `Chargement d'un tombereau : ${T.godets} × ${p.tc} = ${fr(T.tChargement, 3)} s ; ${frd(T.cycle, 0)} / ${fr(T.tChargement, 3)} = ${frd(T.cycle / T.tChargement, 2)} → ${r.nSature} tombereaux par pelle, soit ${nT} en tout.`, { abs: 0.5 }),
        ],
      };
    },
  },
  {
    id: "ch15-godet", titre: "Quel godet pour un rendement visé ?", difficulte: 3,
    generer(a) {
      const d = tirer(a, (a) => {
        const m = a.choix(MATERIAUX);
        const kr = a.entre(m.kr[0], m.kr[1], 0.05), Cf = a.entre(m.Cf[0], m.Cf[1], 0.05), tc = a.entre(16, 28, 1), minutes = a.entre(45, 55, 1), E = minutes / 60;
        const Qv = a.entre(120, 450, 10), qMin = (Qv * tc * Cf) / (3600 * kr * E);
        return { m, kr, Cf, tc, minutes, E, Qv, qMin };
      }, ({ qMin }) => qMin <= CATALOGUE.at(-1) * 0.97 && CATALOGUE.every((c) => Math.abs(c / qMin - 1) > 0.04));
      const { m, kr, Cf, tc, minutes, E, Qv, qMin } = d;
      const i = CATALOGUE.findIndex((c) => c >= qMin), q = CATALOGUE[i];
      const r = pelle({ q, kr, E, tc, Cf }), rBas = i > 0 ? pelle({ q: CATALOGUE[i - 1], kr, E, tc, Cf }) : null;
      const fausses = [i - 1, i + 1, i + 2, i - 2].filter((j) => j >= 0 && j < CATALOGUE.length).slice(0, 3).map((j) => `${frd(CATALOGUE[j], 1)} m³`);
      return {
        enonce: `On veut extraire au moins ${Qv} m³ en place par heure dans ${m.nom} (kr = ${frd(kr, 2)}, Cf = ${frd(Cf, 2)}), avec une pelle dont le cycle dure ${tc} s et qui travaille ${minutes} minutes utiles par heure. Le loueur propose des godets de ${CATALOGUE.map((c) => frd(c, 1)).join(" ; ")} m³.`,
        donnees: [donnee("Rendement visé", `${Qv} m³/h en place`), donnee("kr · Cf", `${frd(kr, 2)} · ${frd(Cf, 2)}`), donnee("Cycle · E", `${tc} s · ${frd(E, 3)}`)],
        questions: [
          nombre("Capacité de godet minimale ?", qMin, "m³", `De Q = 3 600 q kr E / (tc Cf) : q = Q tc Cf / (3 600 kr E) = ${Qv} × ${tc} × ${frd(Cf, 2)} / (3 600 × ${frd(kr, 2)} × ${frd(E, 3)}) = ${frd(qMin, 2)} m³.`, { rel: 0.02 }),
          choixMelange(a, "Godet à retenir dans la gamme ?", [`${frd(q, 1)} m³`, ...fausses],
            `Le plus petit godet d'au moins ${frd(qMin, 2)} m³ : ${frd(q, 1)} m³.${rBas ? ` Celui de ${frd(CATALOGUE[i - 1], 1)} m³ ne donnerait que ${fr(rBas.Q, 3)} m³/h.` : ""}`),
          nombre("Rendement obtenu avec ce godet ?", r.Q, "m³/h", `Q = 3 600 × ${frd(q, 1)} × ${frd(kr, 2)} × ${frd(E, 3)} / (${tc} × ${frd(Cf, 2)}) = ${fr(r.Q, 4)} m³/h ≥ ${Qv} m³/h.`, { rel: 0.02 }),
        ],
      };
    },
  },
];
