// Justification d'un pieu isolé sous charge axiale, au Fascicule 62 titre V
// et à la NF P94-262, sur un même profil de sol. Module pur, sans DOM.
//
// Actions en tête : G (permanente) et Q (variable), verticales, en kN ; ψ2
// sépare la part quasi permanente de Q ; Fn est le frottement négatif
// caractéristique (0 s'il n'y en a pas). Règle de cumul commune aux deux
// textes (F62 C.3.3 ; NF P94-262 7.3.3) :
//   Fd = G'd + max(Gsn,d ; Q'd), G' = G + ψ2 Q, Q' = (1 − ψ2) Q,
// avec 1,35 sur G, 1,5 sur Q et 1,35 sur Fn à l'ELU (1,125 × 1,2 au F62).

import * as P from "../geotech/pieux.js";
import { tassementForfaitaire, courbeChargement } from "../geotech/tassement-pieu.js";

export function combinaisonsPieu({ G, Q = 0, psi2 = 0.3, Fn = 0 }) {
  const Gp = G + psi2 * Q, Qp = (1 - psi2) * Q;
  const ELU = 1.35 * G + 1.5 * psi2 * Q + Math.max(1.35 * Fn, 1.5 * Qp);
  const ELS_car = Gp + Math.max(Fn, Qp);
  const ELS_QP = Gp + Fn;
  return { ELU, ELS_car, ELS_QP, Gp, Qp };
}

export function justifierPieu(d) {
  const {
    type = "fore-boue", cat = 2, B, D, forme = "circulaire", methode = "pressio", couches, zf = 0,
    procedure = "terrain", N = 1, S = 100, raide = false, G, Q = 0, psi2 = 0.3, Fn = 0, Ep = 20000, optionsF62 = [],
  } = d;
  if (!(B > 0 && D > 0)) throw new Error("renseigner B et D");
  const tri = [...couches].sort((a, b) => a.z0 - b.z0);
  const alertes = [];
  if (tri[tri.length - 1].z1 < D + 3 * Math.max(B / 2, 0.5)) alertes.push("le profil doit descendre au moins de 3a sous la pointe");

  const c = combinaisonsPieu({ G, Q, psi2, Fn });
  const r62 = P.pieuF62({ methode, type, B, D, forme, zf, options: optionsF62, couches: tri.map((x) => ({ z0: x.z0, z1: x.z1, classe: x.classe, pl: x.pl, qc: x.qc })) });
  const lim = P.valeursLimitesEC7({ methode, cat, B, D, forme, zf, couches: tri.map((x) => ({ z0: x.z0, z1: x.z1, sol: x.categorie, pl: x.pl, qc: x.qc })) });
  let r7 = lim;
  if (lim.applicable) r7 = procedure === "modele" ? { ...lim, ...P.pieuModele({ resultats: Array(Math.max(1, N)).fill(lim), S, raide }) } : P.modeleTerrain(lim);

  const verifs = [];
  if (r62.applicable) {
    const l = r62.limites;
    verifs.push(
      { ref: "F62", etat: "ELU fondamental", Fd: c.ELU, R: l.ELU.Qmax, formule: "Qu/1,4" },
      { ref: "F62", etat: "ELS rare", Fd: c.ELS_car, R: l.ELS_rare.Qmax, formule: "Qc/1,1" },
      { ref: "F62", etat: "ELS quasi permanent", Fd: c.ELS_QP, R: l.ELS_QP.Qmax, formule: "Qc/1,4" },
    );
  }
  if (r7.applicable) {
    const k = r7.calcul;
    verifs.push(
      { ref: "EC7", etat: "ELU fondamental", Fd: c.ELU, R: k.ELU.Rcd, formule: "Rc;k/1,1" },
      { ref: "EC7", etat: "ELS caractéristique", Fd: c.ELS_car, R: k.ELS_car.Rccrd, formule: "Rc;cr;k/0,9" },
      { ref: "EC7", etat: "ELS quasi permanent", Fd: c.ELS_QP, R: k.ELS_QP.Rccrd, formule: "Rc;cr;k/1,1" },
    );
  }
  for (const v of verifs) { v.taux = v.Fd / v.R; v.ok = v.Fd <= v.R + 1e-9; }

  // Tassement sous la charge quasi permanente : forfaitaire, et lois de Frank
  // et Zhao si les modules EM sont connus (qs et qb de la norme).
  const refoulant = r7.applicable ? r7.refoulement : r62.applicable && r62.refoulement;
  const tassement = { forfaitaire: tassementForfaitaire({ B, mise: refoulant ? "battu" : "fore" }) };
  if (lim.applicable && tri.every((x) => x.EM > 0)) {
    const porteuse = tri.find((x) => D - 1e-9 >= x.z0 && D - 1e-9 < x.z1) ?? tri[tri.length - 1];
    const fin = (x) => (["argile", "intermediaire-argileux", "craie", "marne"].includes(x.categorie) ? "fin" : "granulaire");
    const cz = lim.lignes.map((l) => {
      const x = tri.find((y) => (l.z0 + l.z1) / 2 >= y.z0 && (l.z0 + l.z1) / 2 < y.z1) ?? porteuse;
      return { z0: l.z0, z1: l.z1, EM: x.EM, qs: l.qs, sol: fin(x) };
    });
    if (zf > 0) cz.unshift({ z0: 0, z1: zf, EM: tri[0].EM, qs: 0, sol: fin(tri[0]) });
    const courbe = courbeChargement({ B, D, Ep, couches: cz, pointe: { EM: porteuse.EM, qb: lim.pointe.qb, sol: fin(porteuse) } });
    tassement.frankZhao = { s: courbe.tassementSous(c.ELS_QP), courbe: courbe.courbe };
  }
  return {
    entree: { type, cat, B, D, forme, methode, zf, procedure, N, S, raide, G, Q, psi2, Fn, Ep },
    combinaisons: c, F62: r62, EC7: r7, verifs, tassement, alertes,
    verdict: verifs.length > 0 && verifs.every((v) => v.ok),
  };
}
