// Compactage des remblais et des couches de forme [GTR 2024 F1 § 1.6 et
// chap. 5 ; F2 annexe 4] : objectifs de densification q4 et q3, contrôle de
// la masse volumique sèche, et méthode Q/S — le rapport du volume compacté à
// la surface balayée par le compacteur, qui fixe l'énergie appliquée.

import { horsDomaine } from "./outils.js";
import { TABLEAUX, COMPACTEURS } from "./tables-compactage.js";

/**
 * Objectifs de densification, en % de la masse volumique sèche de
 * l'optimum Proctor normal : en moyenne sur la couche et au minimum en fond
 * de couche (les 8 cm inférieurs) [F1 § 1.6].
 */
export const OBJECTIFS = {
  q4: { nom: "q4 — remblai", moyen: 95, fond: 92 },
  q3: { nom: "q3 — couche de forme", moyen: 98.5, fond: 96 },
};

/** Énergie de compactage des tableaux d'utilisation : code C → énergie et code des tableaux de compactage. */
export const ENERGIES = { 1: "intense", 2: "moyenne", 3: "faible" };

/**
 * Contrôle d'une couche : masses volumiques sèches moyenne et en fond de
 * couche (Mg/m³) rapportées à ρdOPN, comparées à l'objectif.
 */
export function controleDensite({ rhoDmoy, rhoDfc, rhoDOPN, objectif = "q4" }) {
  const o = OBJECTIFS[objectif];
  if (!o) return horsDomaine(`Objectif inconnu : ${objectif}`);
  if (!(rhoDOPN > 0)) return horsDomaine("La masse volumique sèche de l'optimum Proctor normal est nécessaire.");
  const tm = (100 * rhoDmoy) / rhoDOPN, tf = (100 * rhoDfc) / rhoDOPN;
  return {
    applicable: true, objectif: o, tauxMoyen: tm, tauxFond: tf,
    okMoyen: tm >= o.moyen, okFond: Number.isFinite(tf) ? tf >= o.fond : null,
    ok: tm >= o.moyen && (!Number.isFinite(tf) || tf >= o.fond),
    rhoDmoyRequis: (o.moyen / 100) * rhoDOPN, rhoDfcRequis: (o.fond / 100) * rhoDOPN,
  };
}

/**
 * Gammadensimètre en transmission directe (NF P94-061-1) : chaque mesure
 * donne la masse volumique moyenne entre la surface et la profondeur z de la
 * source. La masse par unité de surface M(z) = z ρ̄(z) est donc connue aux
 * profondeurs mesurées ; entre deux mesures, la densité est réputée
 * uniforme. La densité d'une tranche [za, zb] vaut (M(zb) − M(za))/(zb − za) ;
 * pour deux mesures successives : (z2 ρ̄2 − z1 ρ̄1)/(z2 − z1).
 * mesures : [{ z, rho }] (z dans une unité quelconque, la même pour za, zb).
 */
export function densiteTranche(mesures, za, zb) {
  const m = mesures.filter((x) => x.z > 0 && x.rho > 0).sort((a, b) => a.z - b.z);
  if (!m.length) return horsDomaine("Aucune mesure.");
  if (!(zb > za && za >= 0)) return horsDomaine("Tranche mal définie.");
  if (zb > m[m.length - 1].z + 1e-9) return horsDomaine("La tranche descend sous la mesure la plus profonde.");
  const pts = [[0, 0], ...m.map((x) => [x.z, x.z * x.rho])];
  const M = (z) => {
    for (let i = 1; i < pts.length; i++) if (z <= pts[i][0] + 1e-12) {
      const [z0, m0] = pts[i - 1], [z1, m1] = pts[i];
      return m0 + ((m1 - m0) * (z - z0)) / (z1 - z0);
    }
    return NaN;
  };
  return { applicable: true, rho: (M(zb) - M(za)) / (zb - za) };
}

/** Densités des tranches successives entre les profondeurs mesurées. */
export function tranchesDensite(mesures) {
  const m = mesures.filter((x) => x.z > 0 && x.rho > 0).sort((a, b) => a.z - b.z);
  return m.map((x, i) => {
    const z0 = i ? m[i - 1].z : 0, r0 = i ? m[i - 1].rho : 0;
    return { z0, z1: x.z, rho: (x.z * x.rho - z0 * r0) / (x.z - z0) };
  });
}

// ───────────────────────────── Méthode Q/S ─────────────────────────────

/** Nombre d'applications de charge N = e/(Q/S), arrondi à l'entier supérieur [F2 annexe 4]. */
export const applications = (e, QS) => Math.ceil(e / QS - 1e-9);

/** Nombre de passes : N pour un monocylindre ou un compacteur à pneus, N/2 pour un tandem (N/n = 2). */
export const passes = (N, tandem = false) => (tandem ? Math.ceil(N / 2) : N);

/** Débit théorique par mètre de largeur : Q/L = 1 000 (Q/S) V, en m³/h·m (Q/S en m, V en km/h). */
export const debitParLargeur = (QS, V) => 1000 * QS * V;

/**
 * Débit pratique d'un compacteur : Qprat = k (Q/L) L (N/n), k coefficient de
 * rendement (0,5 à 0,75), L largeur compactée (m), N/n = 2 pour un tandem.
 */
export const debitPratique = ({ QL, L, k = 0.6, Nn = 1 }) => k * QL * L * Nn;

/**
 * Compacteur vibrant à deux colonnes (V3 à V5) : entre l'épaisseur minimale
 * (vitesse maximale) et l'épaisseur maximale (vitesse minimale), le produit
 * V e reste constant ; on en déduit la vitesse pour l'épaisseur du chantier
 * [F2 annexe 4, exemple V3 : e = 0,50 m ⇒ V = 0,75 × 2/0,5 = 3 km/h].
 */
export function vitessePourEpaisseur({ eMax, Vmin, e, Vmax = Infinity }) {
  if (!(e > 0 && e <= eMax + 1e-9)) return horsDomaine(`Épaisseur hors du domaine du compacteur (≤ ${eMax} m).`);
  return { applicable: true, V: Math.min(Vmax, (eMax * Vmin) / e) };
}

/**
 * Prescription d'un compacteur pour une épaisseur donnée, à partir d'une
 * cellule du tableau de compactage { QS, options: [{ e, V, N, QL }] } : on
 * prend l'option dont l'épaisseur couvre e (la plus rapide), ou l'on
 * interpole la vitesse entre les deux colonnes par V e = cste.
 */
export function prescrire(cellule, e) {
  if (!cellule) return horsDomaine("Compacteur ne convenant pas pour ce matériau et cette énergie.");
  const { QS, options } = cellule;
  const tri = [...options].sort((a, b) => a.e - b.e);
  const eMax = tri[tri.length - 1].e;
  if (e > eMax + 1e-9) return horsDomaine(`Épaisseur ${String(e).replace(".", ",")} m supérieure à l'épaisseur maximale du tableau (${String(eMax).replace(".", ",")} m).`);
  let V;
  const couvrante = tri.find((o) => e <= o.e + 1e-9);
  if (tri.length === 2 && e > tri[0].e + 1e-9) V = (tri[1].e * tri[1].V) / e; // V e = cste
  else V = couvrante.V;
  const N = applications(e, QS);
  return { applicable: true, QS, e, V, N, QL: debitParLargeur(QS, V) };
}

/**
 * Compacteur mixte ou tandem différencié, vu comme deux compacteurs [F2
 * annexe 4] : Q/S somme, épaisseur et vitesse les plus faibles, N/n = 1.
 */
export function mixte(a, b) {
  const QS = a.QS + b.QS, e = Math.min(a.e, b.e), V = Math.min(a.V, b.V);
  return { QS, e, V, N: applications(e, QS), QL: debitParLargeur(QS, V) };
}

/**
 * Contrôle a posteriori d'un atelier : Q volume compacté (m³) dans la
 * journée, surfaces balayées Si par chaque compacteur (m²), Q/S de tableau
 * de chacun. Le compactage est suffisant si Σ (Q/S)tableau,i / (Q/Si) ≥ 1.
 */
export function controleAtelier({ Q, engins }) {
  const termes = engins.map(({ S, QStableau }) => ({ S, QStableau, QSreel: Q / S, part: QStableau / (Q / S) }));
  const somme = termes.reduce((s, t) => s + t.part, 0);
  return { termes, somme, ok: somme >= 1 - 1e-9 };
}

/**
 * Profil de densification d'une couche (modèle d'enseignement) : la masse
 * volumique sèche croît avec le nombre d'applications N et décroît vers le
 * fond de la couche, d'autant plus que la couche est épaisse et le
 * compacteur léger. tauxSurface(N) tend vers tMax ; le fond garde un
 * déficit proportionnel à e/eRef.
 */
export function profilDensification({ N, Nref, e, eRef, t0 = 82, tMax = 101 }) {
  const progres = 1 - Math.exp(-(2.3 * N) / Nref); // ≈ 90 % du gain à N = Nref
  const surface = t0 + (tMax - t0) * progres;
  const deficitFond = 6.5 * (e / eRef) ** 1.3 * (0.6 + 0.4 * progres);
  const taux = (z) => surface - deficitFond * (z / e) ** 1.6; // z depuis le haut de la couche
  let s = 0;
  const n = 40;
  for (let i = 0; i <= n; i++) s += (i === 0 || i === n ? 0.5 : 1) * taux((e * i) / n);
  return { taux, moyen: s / n, fond: taux(e - 0.04) };
}

// ───────────────────── Tableaux de compactage (annexe 4) ─────────────────────

export { TABLEAUX, COMPACTEURS };

/** Familles de compacteurs [F1 chap. 5 ; GTR 92]. */
export const FAMILLES_COMPACTEURS = {
  P: "compacteur à pneus (classe selon la charge par roue)",
  V: "vibrant à cylindre lisse (classe selon M1/L et l'amplitude A0)",
  VP: "vibrant à pieds dameurs",
  SP: "statique à pieds dameurs (classe selon M1/L)",
  PQ: "plaque vibrante (classe selon la pression statique Mg/S)",
};

/**
 * Classe d'un compacteur (norme NF P98-736, reprise par le GTR) :
 * pneus (P) par la charge par roue CR (kN) ; vibrants lisses (V) et à pieds
 * dameurs (VP) par le paramètre (M1/L)·√A0 (M1/L en kg/cm, A0 amplitude
 * théorique à vide en mm) et une amplitude minimale ; statiques à pieds (SP)
 * par M1/L ; plaques (PQ) par la pression statique Mg/S (kPa).
 */
export function classeCompacteur(famille, { CR, M1L, A0, MgS } = {}) {
  switch (famille) {
    case "P":
      if (!(CR > 0)) return horsDomaine("Charge par roue nécessaire.");
      return CR < 25 ? horsDomaine("Charge par roue inférieure à 25 kN : compacteur à pneus hors classes du GTR.") : { applicable: true, classe: CR <= 40 ? "P1" : CR <= 60 ? "P2" : "P3" };
    case "V": case "VP": {
      if (!(M1L > 0 && A0 > 0)) return horsDomaine("M1/L et A0 nécessaires.");
      const p = M1L * Math.sqrt(A0);
      // Classe par le paramètre et classe par l'amplitude : la plus faible des deux.
      const parP = p < 15 ? 0 : p <= 25 ? 1 : p <= 40 ? 2 : p <= 55 ? 3 : p <= 70 ? 4 : 5;
      const parA = A0 < 0.6 ? 0 : A0 < 0.8 ? 1 : A0 < 1 ? 2 : A0 < 1.3 ? 3 : A0 < 1.6 ? 4 : 5;
      const k = Math.min(parP, parA);
      if (!k) return horsDomaine(`(M1/L)·√A0 = ${p.toFixed(1).replace(".", ",")}${p < 15 ? " < 15" : ""}, A0 = ${String(A0).replace(".", ",")} mm${A0 < 0.6 ? " < 0,6" : ""} : compacteur hors classes.`, { parametre: p });
      return { applicable: true, classe: `${famille}${k}`, parametre: p, limite: parP < parA ? "le paramètre (M1/L)·√A0" : parA < parP ? "l'amplitude A0" : "les deux critères" };
    }
    case "SP":
      if (!(M1L > 0)) return horsDomaine("M1/L nécessaire.");
      return M1L < 30 || M1L >= 90 ? horsDomaine("M1/L hors de 30 à 90 kg/cm : compacteur statique à pieds hors classes.") : { applicable: true, classe: M1L <= 60 ? "SP1" : "SP2" };
    case "PQ":
      if (!(MgS > 0)) return horsDomaine("Pression statique Mg/S nécessaire.");
      return MgS < 10 ? horsDomaine("Mg/S < 10 kPa : petite plaque (PQ1, PQ2), non prise en compte pour les remblais.") : { applicable: true, classe: MgS <= 15 ? "PQ3" : "PQ4" };
    default: return horsDomaine(`Famille de compacteur inconnue : ${famille}`);
  }
}

const sansEspace = (s) => String(s).replace(/\s+/g, "");

/**
 * Tableau de compactage d'un matériau pour un usage. Le symbole de recherche
 * est la sous-classe de nature (avec VC1/VC2 et « ins » pour S3, S4, G3, G4
 * insensibles) : F1, VC2F1, S3, S3ins, VC1G3… ; pour les roches, la famille.
 * En couche de forme, traite précise la ligne (sol traité ou non) ; les
 * matériaux granulaires non traités (page 95) se lisent par leur nature —
 * sables, graves roulées ou graves anguleuses (forme).
 */
export function tableauCompactage(classement, { usage = "remblai", traite = null, forme = "anguleux" } = {}) {
  let cle;
  if (typeof classement === "string") cle = sansEspace(classement);
  else {
    const c = classement, vc = c.vc ?? "", nat = c.sousClasse ?? "";
    const ins = c.etat === "ins" && /^[SG][34]$/.test(nat) ? "ins" : "";
    cle = `${vc}${nat}${ins}`;
  }
  const candidats = TABLEAUX.filter((t) => (t.usage === "remblai") === (usage === "remblai"));
  if (usage === "remblai") {
    let t = candidats.find((x) => x.classes.some((k) => sansEspace(k) === cle));
    if (!t && /Cl/.test(cle)) t = candidats.find((x) => x.classes.includes("Cl"));
    if (!t && /^CH/.test(cle)) t = candidats.find((x) => x.classes.includes("CH"));
    return t ? { tableau: t } : null;
  }
  for (const t of candidats) for (const l of t.lignes ?? []) {
    if (!l.classes.some((k) => sansEspace(k) === cle || (/^CH/.test(cle) && k === "CH"))) continue;
    if (traite !== null && l.traitement && (l.traitement !== "non traité") !== traite) continue;
    return { tableau: t, ligne: l };
  }
  // Sables et graves non traités : lignes désignées par la nature du matériau.
  const nat = cle.replace(/^VC[12]/, "");
  if (traite === false && /^[SG]/.test(nat)) {
    const motif = nat.startsWith("S") ? /^Sables/ : forme === "roulés" ? /roulés/ : /anguleuses/;
    for (const t of candidats) for (const l of t.lignes ?? []) if (!l.classes.length && motif.test(l.libelle)) return { tableau: t, ligne: l };
  }
  return null;
}

/** Cellule d'un compacteur : par code d'énergie (remblai) ou par ligne (couche de forme). */
export function celluleCompactage(trouve, compacteur, code = "2") {
  if (!trouve) return undefined;
  if (trouve.ligne) return trouve.ligne.cellules[compacteur];
  const c = trouve.tableau.codes?.[String(code)];
  return c ? c[compacteur] : undefined;
}
