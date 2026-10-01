// Cam-Clay modifié (Roscoe et Burland, 1968) pour le triaxial virtuel.
//  · élasticité non linéaire : K = v p'/κ, coefficient de Poisson constant ;
//  · surface de charge elliptique q² = M² p' (p'c − p'), écoulement associé ;
//  · écrouissage dp'c/p'c = v dεv^p/(λ − κ) : durcissement du côté humide
//    (p' > p'c/2, le sol se contracte), radoucissement du côté sec (il dilate) ;
//  · état critique : q = M p', v = Γ − λ ln p', Γ = N − (λ − κ) ln 2.
// Intégration explicite à déformation axiale imposée, par petits pas, avec
// recalage de p'c sur l'état de contrainte. Compression triaxiale : σ3
// constante, drainée (p' = p'0 + q/3) ou non drainée (εv = 0, surpression u).
// Unités : kPa ; déformations en valeur relative (compression positive).

/**
 * Matériaux du banc. Argiles : préconsolidation isotrope p'c,max subie par le
 * sol, état en place pour l'essai non consolidé (p's conservée par succion
 * après prélèvement). Sables : leur état dense ou lâche est donné par le
 * rapport p'c/p'0 au moment du cisaillement.
 */
export const MATERIAUX_TRIAX = {
  "argile-nc": { nom: "Argile molle normalement consolidée", famille: "argile", lambda: 0.2, kappa: 0.04, M: 0.9, N: 3.32, nu: 0.25, pcMax: 50, cv: 1.5, enPlace: { ps: 32, pc: 55 } },
  "argile-sc": { nom: "Argile raide surconsolidée", famille: "argile", lambda: 0.12, kappa: 0.025, M: 0.95, N: 2.35, nu: 0.25, pcMax: 320, cv: 6, enPlace: { ps: 90, pc: 320 } },
  "sable-lache": { nom: "Sable lâche", famille: "sable", lambda: 0.06, kappa: 0.008, M: 1.3, N: 2.13, nu: 0.3, ocr: 1.1, cv: 3000 },
  "sable-dense": { nom: "Sable dense", famille: "sable", lambda: 0.06, kappa: 0.008, M: 1.3, N: 2.13, nu: 0.3, ocr: 16, cv: 3000 },
};

/** Angle de frottement à l'état critique en compression : sin φ' = 3M/(6 + M). */
export const phiCritique = (M) => (Math.asin((3 * M) / (6 + M)) * 180) / Math.PI;
export const gammaCS = (m) => m.N - (m.lambda - m.kappa) * Math.log(2);

/** État après consolidation isotrope sous p'0 (drainée, jusqu'à la fin de la consolidation). */
export function etatConsolide(m, p0) {
  const pc = m.famille === "sable" ? m.ocr * p0 : Math.max(m.pcMax, p0);
  return { p: p0, q: 0, pc, v: m.N - m.lambda * Math.log(pc) + m.kappa * Math.log(pc / p0), p0, ea: 0, ev: 0, u: 0 };
}

/** État d'une éprouvette d'argile non consolidée : contrainte effective de prélèvement p's. */
export function etatEnPlace(m) {
  const { ps, pc } = m.enPlace;
  return { p: ps, q: 0, pc, v: m.N - m.lambda * Math.log(pc) + m.kappa * Math.log(pc / ps), p0: ps, ea: 0, ev: 0, u: 0 };
}

/** Un pas de déformation axiale dEa. Renvoie le nouvel état. */
export function pas(m, s, dEa, draine) {
  const { lambda: l, kappa: k, M, nu } = m;
  const K = (s.v * s.p) / k, G = (3 * K * (1 - 2 * nu)) / (2 * (1 + nu));
  const reponse = (dEv, dEs, plast) => {
    if (!plast) return { dp: K * dEv, dq: 3 * G * dEs, dL: 0 };
    const fp = M * M * (2 * s.p - s.pc), fq = 2 * s.q;
    const Hh = (M * M * s.p * s.pc * s.v * fp) / (l - k);
    const dL = (fp * K * dEv + 3 * G * fq * dEs) / (K * fp * fp + 3 * G * fq * fq + Hh);
    return { dp: K * (dEv - dL * fp), dq: 3 * G * (dEs - dL * fq), dL };
  };
  const resoudre = (plast) => {
    if (!draine) return { dEv: 0, dEs: dEa, ...reponse(0, dEa, plast) };
    // σ3 constante : dp' = dq/3, avec dεs = dεa − dεv/3 ; la contrainte est linéaire en dεv.
    const g = (dEv) => { const r = reponse(dEv, dEa - dEv / 3, plast); return r.dp - r.dq / 3; };
    const g0 = g(0), h = 1e-4, g1 = g(h), dEv = (-g0 * h) / (g1 - g0);
    return { dEv, dEs: dEa - dEv / 3, ...reponse(dEv, dEa - dEv / 3, plast) };
  };
  let r = resoudre(false), plast = false;
  const pT = s.p + r.dp, qT = s.q + r.dq;
  if (qT * qT - M * M * pT * (s.pc - pT) > 0) {
    const rp = resoudre(true);
    if (rp.dL > 0) { r = rp; plast = true; }
  }
  const p = Math.max(s.p + r.dp, 0.5), q = s.q + r.dq;
  // Recalage : en plasticité, l'ellipse passe par le point de contrainte.
  const pc = plast ? p + (q * q) / (M * M * p) : s.pc;
  const dq = q - s.q;
  return { ...s, p, q, pc, v: s.v * (1 - r.dEv), ea: s.ea + dEa, ev: s.ev + r.dEv, u: draine ? 0 : s.u + dq / 3 - (p - s.p), plast };
}

/**
 * Cisaillement en compression triaxiale jusqu'à eaMax. Renvoie les points
 * enregistrés tous les « sortie » de déformation : { ea, q, p, u, ev, v, pc, plast }.
 */
export function cisailler(m, etat, { draine, eaMax = 0.2, dEa = 2e-5, sortie = 0.002 } = {}) {
  let s = { ...etat };
  const points = [{ ...s, plast: false }];
  let prochain = sortie;
  while (s.ea < eaMax - 1e-12) {
    s = pas(m, s, Math.min(dEa, eaMax - s.ea), draine);
    if (s.ea >= prochain - 1e-12) { points.push({ ...s }); prochain += sortie; }
  }
  return points;
}

/**
 * Rupture d'une éprouvette selon le critère choisi : déviateur maximal, ou
 * rapport σ'1/σ'3 maximal. Renvoie les contraintes principales effectives et
 * totales à la rupture (σ3 totale donnée).
 */
export function rupture(points, { sigma3, critere = "deviateur" }) {
  const s3eff = (pt) => pt.p - pt.q / 3;
  let best = points[1] ?? points[0];
  for (const pt of points) {
    const k = critere === "rapport" ? (s3eff(pt) + pt.q) / s3eff(pt) : pt.q;
    const kb = critere === "rapport" ? (s3eff(best) + best.q) / s3eff(best) : best.q;
    if (k > kb) best = pt;
  }
  const s3e = s3eff(best);
  return { point: best, q: best.q, s3eff: s3e, s1eff: s3e + best.q, s3: sigma3, s1: sigma3 + best.q, u: best.u, ea: best.ea };
}

/**
 * Droite intrinsèque ajustée sur des cercles de Mohr : régression de
 * t = (σ1 − σ3)/2 sur s = (σ1 + σ3)/2 ; sin φ = pente, c = ordonnée/cos φ.
 */
export function enveloppe(cercles) {
  const pts = cercles.map(([s3, s1]) => [(s1 + s3) / 2, (s1 - s3) / 2]);
  if (pts.length < 2) return null;
  const n = pts.length, ms = pts.reduce((a, p) => a + p[0], 0) / n, mt = pts.reduce((a, p) => a + p[1], 0) / n;
  let sss = 0, sst = 0;
  for (const [s, t] of pts) { sss += (s - ms) ** 2; sst += (s - ms) * (t - mt); }
  if (!(sss > 0)) return { phi: 0, c: mt, pente: 0, ordonnee: mt };
  const pente = Math.max(0, Math.min(0.99, sst / sss)), ordonnee = mt - pente * ms;
  const phi = Math.asin(pente);
  return { phi: (phi * 180) / Math.PI, c: Math.max(0, ordonnee / Math.cos(phi)), pente, ordonnee };
}
