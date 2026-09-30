// Justification complète d'une semelle, au Fascicule 62 titre V et à la
// NF P94-261, à partir des mêmes données. Module pur (aucun accès au DOM) :
// le bureau de calcul l'affiche, les tests le vérifient.
//
// Conventions :
//  · z est compté depuis le terrain après travaux, positif vers le bas ;
//  · les actions G et Q sont données au niveau du dessus de la semelle, sous
//    forme de torseurs { V, H, M } (kN et kN·m, ou par mètre pour une filante) ;
//    le poids de la semelle et des terres qui la recouvrent est ajouté à G ;
//  · l'eau : le Fascicule 62 raisonne en contraintes effectives (V' = V − u A,
//    q'0 effective) ; la NF P94-261 prend V sans poussée d'Archimède et
//    R0 = A q0 avec q0 totale (guide Cerema, note 36). Les deux écritures sont
//    équivalentes hors coefficients partiels.

import { profilCouches, GAMMA_W } from "../geotech/outils.js";
import * as S from "../geotech/superficielles.js";
import { combinaisonsF62, combinaisonsEC7 } from "../geotech/combinaisons.js";
import { tranchesMenard, moduleEd, tassementMenard } from "../geotech/tassements.js";

const RAD = Math.PI / 180;
const fr = (x, d) => x.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });

/** Contraintes verticales totale et effective, et pression d'eau, à la profondeur z. */
export function contraintes(couches, z, zw = Infinity) {
  let sv = 0;
  for (const c of couches) {
    const a = c.z0, b = Math.min(c.z1, z);
    if (b <= a) continue;
    const hSec = Math.max(0, Math.min(b, zw) - a), hSat = b - a - hSec;
    sv += c.gamma * hSec + (c.gammaSat ?? c.gamma) * hSat;
  }
  const u = z > zw ? GAMMA_W * (z - zw) : 0;
  return { sv, u, s1: sv - u };
}

const LIMITES_F62 = { ELU: 0.10, ELU_fav: 0.10, ELS_rare: 0.75, ELS_freq: 1, ELS_QP: 1 };

export function justifierSemelle(d) {
  const {
    forme = "filante", B, L: Lsaisie = B, D, h = Math.min(0.5, D), gb = 25, zw = Infinity,
    couches, comportement = "frottant", phi = 30, phiCrit = 30, c = 0, cu = 0, prefabrique = false,
    G, Q, psi = { psi0: 0.7, psi1: 0.5, psi2: 0.3 }, alpha = 0.5,
  } = d;
  const L = forme === "filante" ? 1 : forme === "carree" ? B : Lsaisie;
  const alertes = [];
  if (!(B > 0 && L > 0 && D >= 0 && h > 0 && h <= D + 1e-9)) throw new Error("géométrie incohérente : il faut B, L > 0 et 0 < h ≤ D");
  const tri = [...couches].sort((a, b) => a.z0 - b.z0);
  const bas = tri[tri.length - 1].z1;
  if (bas < D + 1.5 * B) alertes.push(`profil reconnu jusqu'à ${bas} m seulement : moins de 1,5 B sous la base`);
  const A = S.aire({ forme, B, L });
  const p = profilCouches(tri);
  const couche = (z) => p.couche(z);
  const assise = couche(D + 1e-6);

  // ── Poids propres et torseurs à la base ─────────────────────────────────
  const sTerres = contraintes(tri, D - h, zw);
  const Gsemelle = gb * A * h, Gterres = sTerres.sv * A;
  const base = (a) => ({ V: a.V ?? 0, H: a.H ?? 0, M: (a.M ?? 0) + (a.H ?? 0) * h });
  const Gb = base(G), Qb = base(Q);
  Gb.V += Gsemelle + Gterres;
  const sD = contraintes(tri, D, zw);
  const U = sD.u * A; // poussée d'Archimède sur la base

  const cF = combinaisonsF62({ G: Gb, Q: Qb, psi });
  const cFfav = combinaisonsF62({ G: Gb, Q: Qb, psi, favorable: true });
  const cE = combinaisonsEC7({ G: Gb, Q: Qb, psi });
  const cEfav = combinaisonsEC7({ G: Gb, Q: Qb, psi, favorable: true });
  const combF62 = { ELU: cF.ELU, ELU_fav: { ...cFfav.ELU, nom: "ELU fondamental, G favorable" }, ELS_rare: cF.ELS_rare, ELS_freq: cF.ELS_freq, ELS_QP: cF.ELS_QP };
  const combEC7 = { ELU: cE.ELU, ELU_fav: { ...cEfav.ELU, nom: "ELU fondamental, G favorable" }, ELS_car: cE.ELS_car, ELS_freq: cE.ELS_freq, ELS_QP: cE.ELS_QP };

  // ── Paramètres pressiométriques ─────────────────────────────────────────
  const pl = { fn: p.fn("pl"), ruptures: p.ruptures };
  const pleF = S.pleF62({ profil: pl, D, B }).ple;
  const DeF = S.De({ profil: pl, D, reference: pleF });
  const kpF = S.kpF62({ classe: assise.classe, B, L, forme, De: DeF });
  const pleQP = S.pleEC7({ profil: pl, D, hr: 1.5 * B }).ple;
  const DeE = S.De({ profil: pl, D, reference: pleQP });
  const kpE = S.kpEC7({ categorie: assise.categorie, B, L, forme, De: DeE });
  if (!kpF.applicable) alertes.push(kpF.motif);
  if (!kpE.applicable) alertes.push(kpE.motif);
  if (DeE / B > 1.5) alertes.push("De/B > 1,5 : fondation semi-profonde, hors du domaine des formules de portance employées");
  const q0tot = sD.sv, q0eff = sD.s1;

  // ── Vérifications, combinaison par combinaison ──────────────────────────
  const etatsF62 = Object.entries(combF62).map(([cle, t]) => {
    const Vp = t.V - U;
    const e = Math.abs(t.M) / Vp;
    const dg = S.diagramme({ forme, B, L, V: Vp, e });
    const r = { ref: "F62", cle, nom: t.nom, V: t.V, Veff: Vp, H: t.H, M: t.M, e };
    if (!dg.applicable) { r.impossible = dg.motif; return r; }
    r.excentrement = { valeur: dg.fraction, limite: LIMITES_F62[cle], ok: dg.fraction >= LIMITES_F62[cle] - 1e-9, qmax: dg.qmax, qmin: dg.qmin };
    const delta = Math.atan2(Math.abs(t.H), Vp) / RAD;
    if (cle === "ELU" || cle === "ELU_fav" || cle === "ELS_rare") {
      const idb = S.idbF62({ sol: comportement, delta, B, De: DeF }).i;
      const pf = kpF.applicable ? S.portanceF62({ qnette: kpF.k * pleF * 1000, q0: q0eff, idb, qref: dg.qrefTrapeze, etat: cle === "ELS_rare" ? "ELS_rare" : "ELU" }) : null;
      r.portance = pf && { delta, idb, qref: dg.qrefTrapeze, qadm: pf.qadm, gammaQ: pf.gammaQ, taux: pf.taux, ok: pf.ok };
    }
    if (cle === "ELU" || cle === "ELU_fav") {
      const Ac = dg.Bc * (forme === "filante" ? 1 : L);
      r.glissement = S.glissementF62({ Vd: Vp, Hd: Math.abs(t.H), phi, c, Aprime: Ac });
    }
    return r;
  });

  const etatsEC7 = Object.entries(combEC7).map(([cle, t]) => {
    const e = Math.abs(t.M) / t.V;
    const ex = S.excentrementEC7({ forme, B, L, eB: e });
    const r = { ref: "EC7", cle, nom: t.nom, V: t.V, H: t.H, M: t.M, e };
    if (!ex.applicable) { r.impossible = ex.motif; return r; }
    const crit = cle.startsWith("ELU") ? ex.ELU : cle === "ELS_car" ? ex.ELS_car : ex.ELS_QP;
    r.excentrement = { valeur: ex.critere, limite: crit.limite, ok: crit.ok, ie: ex.ie, Aprime: ex.Aprime };
    const delta = Math.atan2(Math.abs(t.H), t.V) / RAD;
    if (cle !== "ELS_freq" && kpE.applicable) {
      const etat = cle.startsWith("ELU") ? "ELU" : cle;
      const hr = S.hrEC7({ forme, B, L, eB: e, etat });
      const ple = S.pleEC7({ profil: pl, D, hr }).ple;
      const id = S.idEC7({ sol: comportement, delta, B, De: DeE }).i;
      const qnet = kpE.k * ple * id * 1000;
      const pe = S.portanceEC7({ A, ie: ex.ie, qnet, q0: q0tot, Vd: t.V, etat });
      r.portance = { delta, hr, ple, id, qnet, Rvd: pe.Rvd, R0: pe.R0, gammaRv: pe.gammaRv, taux: pe.taux, ok: pe.ok };
    }
    if (cle.startsWith("ELU")) {
      r.glissement = S.glissementEC7({ Vd: t.V - U, Hd: Math.abs(t.H), phiCrit, prefabrique });
      if (cu > 0) r.glissementCourtTerme = S.glissementEC7({ Vd: t.V, Hd: Math.abs(t.H), drainage: "non-draine", cu, Aprime: ex.Aprime });
    }
    return r;
  });

  // ── Tassement (ELS quasi permanent) ─────────────────────────────────────
  let tassement = null;
  if (tri.every((x) => x.EM > 0)) {
    const t = tranchesMenard({ profilEM: { fn: p.fn("EM"), ruptures: p.ruptures }, D, B });
    const connues = Math.max(5, Math.min(16, Math.floor(((bas - D) / (B / 2)) + 1e-9)));
    const g = { E1: t.E[0], E2: t.E[1], E35: t.E35, E68: connues >= 8 ? t.E68 : null, E916: connues >= 16 ? t.E916 : null };
    const EdE = moduleEd({ ...g, referentiel: "EC7" }), EdF = moduleEd({ ...g, referentiel: "F62" });
    const qp = (combEC7.ELS_QP.V - U) / A;
    tassement = {
      q: qp, sigmaV0: q0eff, Ec: t.E[0], EdE, EdF, tranches: t.E, connues,
      EC7: tassementMenard({ forme, B, L, q: qp, sigmaV0: q0eff, alpha, Ec: t.E[0], Ed: EdE }),
      F62: tassementMenard({ forme, B, L, q: qp, sigmaV0: q0eff, alpha, Ec: t.E[0], Ed: EdF }),
    };
  }

  // ── Synthèse ────────────────────────────────────────────────────────────
  const synthese = [];
  const ajouter = (verif, r, taux, ok, detail = "") => synthese.push({ verif, ref: r.ref, etat: r.nom, taux, ok, detail });
  for (const r of [...etatsF62, ...etatsEC7]) {
    if (r.impossible) { synthese.push({ verif: "équilibre", ref: r.ref, etat: r.nom, taux: Infinity, ok: false, detail: r.impossible }); continue; }
    // Taux d'excentrement : e / e_max, e_max étant l'excentrement qui
    // amènerait exactement au critère (surface comprimée ou 1 − 2e/B).
    const ex = r.excentrement;
    const eMax = r.ref === "F62" ? S.eLimiteF62(B, ex.limite) : (B * (1 - ex.limite)) / 2;
    ajouter("excentrement", r, r.e / eMax, ex.ok,
      r.ref === "F62" ? `surface comprimée ${fr(100 * ex.valeur, 0)} % ≥ ${fr(100 * ex.limite, 0)} %` : `1 − 2e/B = ${fr(ex.valeur, 3)} ≥ ${fr(ex.limite, 3)}`);
    if (r.portance) ajouter("portance", r, r.portance.taux, r.portance.ok);
    if (r.glissement) ajouter("glissement", r, r.glissement.taux, r.glissement.ok);
    if (r.glissementCourtTerme) ajouter("glissement à court terme", r, r.glissementCourtTerme.taux, r.glissementCourtTerme.ok);
  }
  return {
    entree: { forme, B, L, D, h, gb, zw, comportement, phi, phiCrit, c, cu, prefabrique, alpha },
    A, poids: { Gsemelle, Gterres }, torseurs: { G: Gb, Q: Qb }, U, assise, alertes,
    geotech: { q0tot, q0eff, u: sD.u, pleF, DeF, kpF, pleQP, DeE, kpE },
    combinaisons: { F62: combF62, EC7: combEC7 }, etats: { F62: etatsF62, EC7: etatsEC7 }, tassement, synthese,
    verdict: synthese.every((s) => s.ok),
  };
}
