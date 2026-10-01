// Contrôle qualité d'un sondage pressiométrique Ménard, au sens des règles
// d'exécution et de dépouillement de l'essai (NF P94-110-1, NF EN ISO
// 22476-4). Chaque contrôle est toujours rendu, qu'il passe ou non, avec son
// exigence, la valeur mesurée, sa source et un statut :
//   ok     conforme ;
//   alerte à surveiller (recommandation non tenue, résultat à relire) ;
//   ko     non conforme (le résultat concerné n'est pas garanti par la norme) ;
//   nv     non vérifiable avec les données saisies (temps, réglages, forage).
// Les seuils retenus sont ceux de la NF P94-110-1 telle que la présente la
// littérature (Monnet, 2015) et du support de cours ; les « indicateurs » sont
// des contrôles de vraisemblance, sans valeur normative.
import { pentes } from "./pressio.js";

const NFP = "NF P94-110-1", ISO = "NF EN ISO 22476-4", IND = "indicateur";
const fr = (x, d = 2) => (Number.isFinite(x) ? x.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—");
const controle = (groupe, id, libelle, exigence, reference, statut, mesure) => ({ groupe, id, libelle, exigence, reference, statut, mesure });

/** Statut global d'une liste de contrôles, et décompte par statut. */
export function bilanControles(liste) {
  const n = { ok: 0, alerte: 0, ko: 0, nv: 0 };
  for (const c of liste) n[c.statut]++;
  const statut = n.ko ? "ko" : n.alerte ? "alerte" : "ok";
  return { ...n, statut, libelle: { ok: "conforme", alerte: "conforme avec réserves", ko: "non conforme" }[statut] };
}

/**
 * Contrôles de l'appareillage, communs à tous les essais du sondage :
 * étalonnage en tube (a, linéarité, Vs) et étalonnage à l'air (pel, domaine couvert).
 * tube, air : résultats de calibrageAppareil et etalonnageSonde ; Vmax : plus
 * grand volume lu pendant les essais (cm³).
 */
export function controlerAppareillage({ tube, air, Vs, Vmax = null, VsImpose = false }) {
  const G = "Appareillage et étalonnages", L = [];
  L.push(controle(G, "tube", "Étalonnage en tube d'acier", "au moins trois paliers sur la partie rectiligne", NFP,
    tube?.applicable ? "ok" : "ko", tube?.applicable ? `${tube.points} paliers sur la droite` : "absent : volumes non corrigés de la dilatation"));
  L.push(controle(G, "a", "Dilatation de l'appareillage a", "a < 6 cm³/MPa (pour 50 m de tubulure)", NFP,
    !tube?.applicable ? "nv" : tube.a < 6 ? "ok" : "ko", tube?.applicable ? `a = ${fr(tube.a, 2)} cm³/MPa` : "—"));
  L.push(controle(G, "r2", "Linéarité de la droite du tube", "R² ≥ 0,99", IND,
    !tube?.applicable ? "nv" : tube.r2 >= 0.99 ? "ok" : "alerte", tube?.applicable ? `R² = ${fr(tube.r2, 4)}` : "—"));
  L.push(controle(G, "vs", "Volume de la cellule centrale Vs", "500 à 600 cm³ pour la cellule de 210 mm", IND,
    Vs >= 500 && Vs <= 600 ? "ok" : "alerte", `Vs = ${fr(Vs, 1)} cm³${VsImpose ? " (imposé)" : ""}`));
  L.push(controle(G, "air", "Étalonnage de la sonde à l'air libre", "jusqu'à 1,2 Vs au moins (pel)", NFP,
    !air?.applicable ? "ko" : air.Vmax >= 1.2 * Vs ? "ok" : "alerte",
    !air?.applicable ? "absent : résistance de la membrane non retranchée" : `jusqu'à ${fr(air.Vmax, 0)} cm³ ; pel = ${fr(air.pel, 3)} MPa`));
  L.push(controle(G, "airCouvre", "L'étalonnage à l'air couvre les essais", "volume d'étalonnage ≥ plus grand volume d'essai", IND,
    !air?.applicable || !Number.isFinite(Vmax) ? "nv" : air.Vmax >= Vmax ? "ok" : "alerte",
    !air?.applicable || !Number.isFinite(Vmax) ? "—" : `${fr(air.Vmax, 0)} cm³ pour ${fr(Vmax, 0)} cm³ lus`));
  L.push(controle(G, "date", "Étalonnages refaits en début de poste", "à chaque prise de poste et à chaque changement de gaine", NFP,
    "nv", "dates d'étalonnage non saisies"));
  return L;
}

/**
 * Contrôles d'un essai : exécution, forage (par l'intermédiaire de V1),
 * dépouillement et vraisemblance des résultats. r : résultat de depouiller ;
 * paliers : lectures brutes [{ p, V15?, V30?, V60 }] ; Vs (cm³) ; pel (MPa) ;
 * z : profondeur de l'essai ; voisins : profondeurs des autres essais du forage.
 */
export function controlerEssai({ r, paliers, Vs, pel = null, z = null, voisins = [] }) {
  const lus = paliers.filter((q) => Number.isFinite(q.p) && Number.isFinite(q.V60));
  const n = lus.length, ok = r?.applicable;
  const L = [];

  // ── Exécution de l'essai ──────────────────────────────────────────────
  let G = "Exécution de l'essai";
  L.push(controle(G, "paliers", "Nombre de paliers", "au moins 8 (10 recommandés)", `${ISO} · ${NFP}`,
    n >= 10 ? "ok" : n >= 8 ? "alerte" : "ko", `${n} paliers`));
  const dp = lus.slice(1).map((q, i) => q.p - lus[i].p), dpMax = dp.length ? Math.max(...dp) : NaN;
  const pl = ok ? r.pl : NaN, ref = Number.isFinite(pl) ? pl / 10 : NaN;
  L.push(controle(G, "increment", "Incréments de pression", "Δp ≤ pl/10, pl étant estimée avant l'essai", NFP,
    !Number.isFinite(dpMax) || !Number.isFinite(ref) ? "nv" : dpMax <= 1.05 * ref ? "ok" : "alerte",
    Number.isFinite(dpMax) ? `Δp max = ${fr(dpMax, 3)} MPa${Number.isFinite(ref) ? ` ; pl/10 = ${fr(ref, 3)} MPa` : " ; pl inconnue"}` : "—"));
  const avec30 = lus.filter((q) => Number.isFinite(q.V30)).length, avec15 = lus.filter((q) => Number.isFinite(q.V15)).length;
  L.push(controle(G, "lectures", "Lectures de volume à 15, 30 et 60 s", "V30 et V60 à chaque palier (le fluage en dépend), V15 conseillé", NFP,
    avec30 === n ? "ok" : avec30 ? "alerte" : "ko", `V30 sur ${avec30}/${n} paliers, V15 sur ${avec15}/${n}`));
  L.push(controle(G, "duree", "Paliers de 60 s, changement de pression en moins de 10 s", "durées respectées", NFP, "nv", "temps des lectures non saisis"));
  L.push(controle(G, "garde", "Pression des cellules de garde", "différentielle réglée selon la profondeur", NFP, "nv", "réglage du CPV non saisi"));
  if (ok) {
    const c = r.courbe;
    const decP = c.map((q, i) => (i && q.p <= c[i - 1].p ? q.n : null)).filter(Boolean), decV = c.map((q, i) => (i && q.V <= c[i - 1].V ? q.n : null)).filter(Boolean);
    L.push(controle(G, "croissance", "Pressions et volumes corrigés croissants", "chaque palier au-dessus du précédent", IND,
      decP.length || decV.length ? "ko" : "ok", decP.length || decV.length ? `${decP.length ? `p ne croît pas au palier ${decP.join(", ")}` : ""}${decP.length && decV.length ? " ; " : ""}${decV.length ? `V ne croît pas au palier ${decV.join(", ")}` : ""}` : "croissants"));
    const neg = c.filter((q) => q.fluage < 0).map((q) => q.n);
    L.push(controle(G, "fluagePositif", "Fluage positif à chaque palier", "V60 ≥ V30", IND,
      avec30 ? (neg.length ? "alerte" : "ok") : "nv", avec30 ? (neg.length ? `négatif au palier ${neg.join(", ")}` : "positif partout") : "pas de lecture à 30 s"));
    // Critères d'arrêt : l'essai doit avoir été poussé assez loin pour donner pl.
    const derniere = lus[n - 1], pfv = r.pf;
    const atteints = [];
    if (derniere.p >= 4.95) atteints.push("5 MPa atteints");
    if (derniere.V60 >= 600) atteints.push(`${fr(derniere.V60, 0)} cm³ injectés (≥ 600)`);
    if (r.limite.Vl && c[c.length - 1].V >= r.limite.Vl) atteints.push("volume Vs + 2V1 atteint");
    const avant = c.filter((q) => q.p <= pfv + 1e-9).length, apres = c.length - avant;
    if (avant >= 4 && apres >= 3) atteints.push(`${apres} paliers après pf, ${avant} avant`);
    L.push(controle(G, "arret", "Critère d'arrêt de l'essai", "5 MPa, ou 600 cm³ injectés, ou Vs + 2V1, ou 3 paliers au-delà de pf et 4 avant", `${ISO} · ${NFP}`,
      atteints.length ? "ok" : "ko", atteints.length ? atteints.join(" ; ") : "aucun : essai arrêté trop tôt"));
    L.push(controle(G, "avantPf", "Paliers avant pf", "au moins 4", NFP, avant >= 4 ? "ok" : "alerte", `${avant} paliers`));
    L.push(controle(G, "apresPf", "Paliers au-delà de pf", "au moins 3 si pl doit être extrapolée", NFP,
      !r.limite.extrapolee ? "ok" : apres >= 3 ? "ok" : apres === 2 ? "alerte" : "ko", `${apres} paliers${r.limite.extrapolee ? "" : " (pl lue sur la courbe)"}`));
  }

  // ── Forage et mise en place ───────────────────────────────────────────
  G = "Forage et mise en place";
  if (ok) {
    const V1 = r.phase.V1, part = V1 / Vs;
    L.push(controle(G, "v1", "Volume de mise en contact V1", "V1 ≤ 0,32 Vs, soit un trou de diamètre ≤ 1,15 ds", NFP,
      part <= 0.3225 ? "ok" : part <= 0.6 ? "alerte" : "ko", `V1 = ${fr(V1, 0)} cm³ = ${fr(100 * part, 0)} % de Vs`));
  }
  const ecarts = voisins.filter((x) => Number.isFinite(x) && Number.isFinite(z)).map((x) => Math.abs(x - z));
  const dMin = ecarts.length ? Math.min(...ecarts) : Infinity;
  L.push(controle(G, "espacement", "Distance à l'essai voisin", "au moins 0,75 m", NFP,
    Number.isFinite(dMin) ? (dMin >= 0.75 - 1e-9 ? "ok" : "ko") : "ok", Number.isFinite(dMin) ? `${fr(dMin, 2)} m` : "essai isolé"));
  L.push(controle(G, "outil", "Outil et méthode de forage adaptés au terrain", "selon le tableau des méthodes de forage", NFP, "nv", "méthode de forage non saisie"));
  L.push(controle(G, "delai", "Essai réalisé peu après le forage de la passe", "passe forée puis essayée sans attendre", NFP, "nv", "heures de forage et d'essai non saisies"));

  // ── Dépouillement ─────────────────────────────────────────────────────
  G = "Dépouillement";
  if (!ok) {
    L.push(controle(G, "depouillement", "Dépouillement possible", "au moins quatre paliers exploitables", NFP, "ko", r?.motif ?? "non dépouillable"));
    return L;
  }
  const ph = r.phase, c = r.courbe, plage = c.slice(ph.i1, ph.i2 + 1);
  L.push(controle(G, "plage", "Phase pseudo-élastique", "au moins 3 paliers", IND, ph.nPoints >= 3 ? "ok" : "ko",
    `paliers ${ph.i1 + 1} à ${ph.i2 + 1} (${ph.nPoints} points), ${ph.auto ? "proposée par le calcul" : "imposée par l'opérateur"}`));
  const s = pentes(plage), moy = s.length ? s.reduce((t, x) => t + x, 0) / s.length : NaN, dev = s.length ? Math.max(...s.map((x) => Math.abs(x - moy) / moy)) : NaN;
  L.push(controle(G, "linearite", "Linéarité de la plage", "pentes ΔV/Δp à ±30 % de leur moyenne", IND,
    s.length < 2 ? "nv" : dev <= 0.3 ? "ok" : "alerte", s.length < 2 ? "deux points seulement" : `écart maximal ${fr(100 * dev, 0)} % (pente moyenne ${fr(moy, 0)} cm³/MPa)`));
  const fl = plage.map((q) => q.fluage).filter(Number.isFinite);
  const fMoy = fl.length ? fl.reduce((t, x) => t + x, 0) / fl.length : NaN, fEcart = fl.length ? Math.max(...fl) - Math.min(...fl) : NaN;
  L.push(controle(G, "fluagePlage", "Fluage faible et stable dans la plage", "écart ≤ max(2 cm³ ; 50 % du fluage moyen)", IND,
    fl.length < 2 ? "nv" : fEcart <= Math.max(2, 0.5 * fMoy) ? "ok" : "alerte", fl.length < 2 ? "pas de lecture à 30 s" : `de ${fr(Math.min(...fl), 1)} à ${fr(Math.max(...fl), 1)} cm³`));
  L.push(controle(G, "p2pf", "La plage s'arrête avant pf", "p2 ≤ pf", NFP, ph.p2 <= r.pf * 1.03 ? "ok" : "ko",
    `p2 = ${fr(ph.p2, 3)} MPa ; pf = ${fr(r.pf, 3)} MPa`));
  L.push(controle(G, "pf", "Pression de fluage pf", "cassure de la courbe de fluage", NFP, r.fluage.atteinte ? "ok" : "alerte",
    r.fluage.atteinte ? `${r.fluage.methode}, pf = ${fr(r.pf, 3)} MPa` : `${r.fluage.motif ?? "cassure introuvable"} : pf prise à p2`));
  const lim = r.limite;
  L.push(controle(G, "pl", "Pression limite pl", "lue à Vs + 2V1 ; sinon deux extrapolations à moins de 20 % l'une de l'autre", NFP,
    !lim.applicable ? "ko" : !lim.extrapolee ? "ok" : lim.ecart === null || lim.ecart === undefined || lim.ecart <= 0.2 ? "ok" : "ko",
    !lim.applicable ? lim.motif ?? "pl non déterminée" : !lim.extrapolee ? `lue sur la courbe : ${fr(lim.pl, 3)} MPa`
      : `extrapolée : ${fr(lim.pl, 3)} MPa${Number.isFinite(lim.ecart) ? ` ; écart des méthodes ${fr(100 * lim.ecart, 1)} %` : ""}`));
  L.push(controle(G, "lointaine", "Extrapolation de pl peu lointaine", "dernier volume ≥ Vs + V1", IND,
    !lim.extrapolee ? "ok" : lim.lointaine ? "alerte" : "ok", !lim.extrapolee ? "sans objet : pl lue" : `dernier volume ${fr(c[c.length - 1].V, 0)} cm³ ; Vs + V1 = ${fr(Vs + ph.V1, 0)} cm³`));
  L.push(controle(G, "membrane", "Résistance propre de la sonde", "pel ≤ 30 % de pl", IND,
    !Number.isFinite(pel) || !Number.isFinite(r.pl) ? "nv" : pel <= 0.3 * r.pl ? "ok" : "alerte",
    Number.isFinite(pel) && Number.isFinite(r.pl) ? `pel = ${fr(pel, 3)} MPa = ${fr((100 * pel) / r.pl, 0)} % de pl` : "—"));

  // ── Vraisemblance des résultats ───────────────────────────────────────
  G = "Vraisemblance des résultats";
  L.push(controle(G, "nettes", "Pressions nettes positives", "pf* > 0 et pl* > 0", IND,
    r.pfNette > 0 && r.plNette > 0 ? "ok" : "ko", `pf* = ${fr(r.pfNette, 3)} MPa ; pl* = ${fr(r.plNette, 3)} MPa`));
  L.push(controle(G, "plpf", "Rapport pl/pf", "1,5 à 3 (fourchette usuelle)", IND,
    !Number.isFinite(r.rapportLimFluage) ? "nv" : r.rapportLimFluage >= 1.5 && r.rapportLimFluage <= 3 ? "ok" : "alerte", `pl/pf = ${fr(r.rapportLimFluage, 2)}`));
  const k = r.rapport;
  L.push(controle(G, "empl", "Rapport EM/pl*", "5 à 20 ; plus bas : forage remanié ou sol lâche ; plus haut : sol surconsolidé ou trou trop serré", IND,
    !Number.isFinite(k) ? "nv" : k >= 5 && k <= 20 ? "ok" : "alerte", `EM/pl* = ${fr(k, 1)}`));
  return L;
}
