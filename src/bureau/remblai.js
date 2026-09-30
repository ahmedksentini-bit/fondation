// Remblai sur sols compressibles, pour le bureau de calcul : tassement final
// par tranches sous l'axe (hauteur à mettre en œuvre, déjaugeage), consolidation
// du multicouche dans le temps par différences finies (drains verticaux
// compris), construction continue ou par étapes réglées sur la stabilité à
// court terme, fluage, et tassement résiduel après la mise en service.
// Unités : m, kPa, kN/m³, temps en années, tassements en mm.
import { GAMMA_W } from "../geotech/outils.js";
import { tassementOedometrique } from "../geotech/tassements.js";
import {
  profilRemblai, contrainteSousBande, contraintesInitiales, preconsolidation, solveurConsolidation,
  diametreInfluence, facteurDrain, hauteurMiseEnOeuvre, tassementDejauge,
} from "../geotech/consolidation.js";

export const NC = Math.PI + 2;

/**
 * Étude complète d'un remblai.
 * d = {
 *   H, mode ("mise" : hauteur mise en œuvre | "finale" : cote finale visée), gamma, largeurCrete, fruit, zw,
 *   couches : [{ z0, z1, nom, gamma, e0, Cc, Cs, pop, ocr, cv, ch, Cae, cu, drainante }],
 *   basDrainant, construction ("continue" | "etapes"), montee (ans par étape), Uetape, F, lambdaCu,
 *   drains : null | { espacement, maille, dw, s, kRapport, profondeur },
 *   tService, dureeService (ans), sAdmissible (mm)
 * }
 * Une couche sans Cc > 0 est drainante (sable, grave) et ne tasse pas.
 */
export function etudierRemblai(d) {
  const couches = d.couches.filter((c) => c.z1 > c.z0);
  if (!couches.length) throw new Error("aucune couche valide : les bases doivent croître");
  // 1. Tranches : 0,2 m dans les couches compressibles, 0,5 m dans les couches drainantes.
  const tranches = [];
  for (const c of couches) {
    const h = c.z1 - c.z0, drainante = Boolean(c.drainante) || !(c.Cc > 0);
    if (!drainante && !(c.e0 > 0 && c.cv > 0 && c.gamma > 0)) throw new Error(`couche « ${c.nom || "sans nom"} » : renseigner γ, e0 et cv`);
    const n = drainante ? Math.max(1, Math.ceil(h / 0.5)) : Math.max(2, Math.ceil(h / 0.2)), dz = h / n;
    for (let i = 0; i < n; i++) {
      const z = c.z0 + (i + 0.5) * dz, { svp } = contraintesInitiales(couches, z, d.zw);
      tranches.push({ c, z, dz, drainante, svp, sp: preconsolidation(svp, c) });
    }
  }
  const compressibles = tranches.filter((t) => !t.drainante);
  if (!compressibles.length) throw new Error("aucune couche compressible : renseigner Cc");
  if (compressibles.some((t) => !(t.svp > 0))) throw new Error("contrainte effective initiale nulle : vérifier γ et la nappe");

  // 2. Charge et tassement final ; hauteur à mettre en œuvre (tassement et déjaugeage).
  const sOedo = (t, ds) => (ds > 0 ? tassementOedometrique({ H: t.dz, e0: t.c.e0, Cc: t.c.Cc, Cs: t.c.Cs ?? 0, sigmaV0: t.svp, sigmaP: t.sp, dSigma: ds }).s : 0);
  const profil = (H, q) => profilRemblai({ H, largeurCrete: d.largeurCrete, fruit: d.fruit, q });
  const sFinal = (H, q, x = 0) => { const p = profil(H, q); return compressibles.reduce((s, t) => s + sOedo(t, contrainteSousBande(p, x, t.z)), 0); };
  const eq = d.mode === "finale"
    ? hauteurMiseEnOeuvre({ Hfinale: d.H, gamma: d.gamma, zw: d.zw, tassement: (H, q) => sFinal(H, q) / 1000 })
    : tassementDejauge({ H: d.H, gamma: d.gamma, zw: d.zw, tassement: (H, q) => sFinal(H, q) / 1000 });
  const H = d.mode === "finale" ? eq.H : d.H, q0 = d.gamma * H, qEq = eq.q, pFin = profil(H, qEq);
  const b = d.largeurCrete / 2, a = d.fruit * H;
  const final = { centre: sFinal(H, qEq), bord: sFinal(H, qEq, b), pied: sFinal(H, qEq, b + a), q: qEq, dejaugeage: eq.dejaugeage };
  for (const t of tranches) {
    t.ds = contrainteSousBande(profil(H, q0), 0, t.z);
    if (t.drainante) { t.mv = 1e-6; continue; }
    const s = sOedo(t, t.ds) / 1000;
    t.mv = t.ds > 1e-6 && s > 0 ? s / t.dz / t.ds : (0.434 * (t.c.Cs > 0 ? t.c.Cs : t.c.Cc)) / ((1 + t.c.e0) * t.svp);
    t.sInf = sOedo(t, contrainteSousBande(pFin, 0, t.z));
  }

  // 3. Drains verticaux : taux de drainage radial r = 8 ch/(De² F) jusqu'à leur profondeur.
  let De = null, Fd = null;
  if (d.drains) {
    De = diametreInfluence(d.drains.espacement, d.drains.maille);
    Fd = facteurDrain({ n: De / d.drains.dw, s: d.drains.s, kRapport: d.drains.kRapport });
    if (!(Fd > 0)) throw new Error("drains : la zone remaniée est plus large que la cellule drainée");
  }
  const N = tranches.length;
  const solveur = solveurConsolidation({
    basDrainant: d.basDrainant,
    tranches: tranches.map((t) => ({
      dz: t.dz, mv: t.mv, drainante: t.drainante, cv: t.drainante ? 1e6 : t.c.cv,
      r: d.drains && !t.drainante && t.z < d.drains.profondeur ? (8 * (t.c.ch > 0 ? t.c.ch : t.c.cv)) / (De * De * Fd) : 0,
    })),
  });

  // 4. Chargement construit au fil du calcul : rampes, attentes, étapes réglées sur c_u.
  const avecCu = compressibles.some((t) => t.c.cu > 0);
  const cuMin = (u, sigma) => {
    const parCouche = new Map();
    tranches.forEach((t, i) => {
      if (t.drainante || !(t.c.cu > 0)) return;
      const x = parCouche.get(t.c) ?? { s: 0, h: 0 };
      x.s += Math.max(0, sigma[i] - u[i]) * t.dz; x.h += t.dz;
      parCouche.set(t.c, x);
    });
    let m = Infinity;
    for (const [c, x] of parCouche) m = Math.min(m, c.cu + (d.lambdaCu ?? 0.25) * (x.s / x.h));
    return m;
  };
  const montee = Math.max(d.montee ?? 0.1, 1e-3), tFin = d.tService + d.dureeService;
  let H0 = 0, H1 = 0, tr0 = 0, tr1 = 0, seuilU = d.Uetape ?? 0.7, bloque = false;
  const hauteur = (x) => (x >= tr1 ? H1 : H0 + ((H1 - H0) * (x - tr0)) / (tr1 - tr0));
  const etapes = [];
  const lancer = (x, u, sigma) => {
    const cu = avecCu ? cuMin(u, sigma) : Infinity;
    const Hadm = d.construction === "etapes" && avecCu ? (NC * cu) / (d.gamma * d.F) : Infinity;
    const cible = Math.min(H, Hadm), actuelle = hauteur(x);
    if (cible <= actuelle + 0.05) {
      if (seuilU < 0.97) seuilU = 0.97; else bloque = true;
      return;
    }
    H0 = actuelle; H1 = cible; tr0 = x; tr1 = x + montee; seuilU = d.Uetape ?? 0.7;
    etapes.push({ n: etapes.length + 1, t0: x, t1: tr1, H0: actuelle, H1: cible, cu, F: avecCu ? (NC * cu) / (d.gamma * cible) : null });
  };
  const zero = new Float64Array(N);
  lancer(0, zero, zero);

  // 5. Pas de temps : géométriques, bornés pendant les rampes, calés sur la mise en service.
  const sigma = new Float64Array(N);
  const courbe = [{ t: 0, H: 0, q: 0, s: 0, U: 0 }];
  const isochrones = [];
  const reperes = [{ nom: "fin des travaux", t: null }, { nom: "mise en service", t: d.tService }, { nom: "fin de la période de service", t: tFin }];
  let t = 0, dt = 1e-3, sPrec = 0, finTravaux = null, Fconstruction = null;
  for (let k = 0; k < 20000 && t < tFin - 1e-9; k++) {
    let h = Math.min(dt, tFin - t, 0.25);
    if (t < tr1) h = Math.min(h, montee / 8, tr1 - t);
    if (t < d.tService && t + h > d.tService) h = d.tService - t;
    const tn = t + h, Hn = hauteur(tn);
    const qn = Math.max(0, d.gamma * Hn - GAMMA_W * Math.max(0, sPrec / 1000 - d.zw));
    for (let i = 0; i < N; i++) sigma[i] = q0 > 0 ? (qn / q0) * tranches[i].ds : 0;
    const u = solveur.pas(h, sigma);
    let s = 0, sCharge = 0;
    tranches.forEach((tr, i) => { if (!tr.drainante) { s += sOedo(tr, Math.max(0, sigma[i] - u[i])); sCharge += sOedo(tr, sigma[i]); } });
    sPrec = s; t = tn; dt *= 1.12;
    const U = sCharge > 0 ? s / sCharge : 0;
    courbe.push({ t, H: Hn, q: qn, s, U });
    const fini = H1 >= H - 1e-6 && t >= tr1 - 1e-9;
    if (fini && finTravaux === null) {
      finTravaux = t; reperes[0].t = t;
      if (avecCu) Fconstruction = (NC * cuMin(u, sigma)) / (d.gamma * H);
    }
    for (const r of reperes) if (r.t !== null && !r.u && t >= r.t - 1e-9) r.u = Array.from(u, (x, i) => ({ z: tranches[i].z, u: x, sigma: sigma[i] }));
    if (!fini && !bloque && t >= tr1 - 1e-9 && U >= seuilU) lancer(t, u, sigma);
  }
  for (const r of reperes) if (r.u) isochrones.push({ nom: r.nom, t: r.t, points: r.u });

  // 6. Fluage après la fin de la consolidation primaire (U = 95 % une fois les travaux finis).
  const debutFluage = courbe.find((p) => finTravaux !== null && p.t >= finTravaux && p.U >= 0.95)?.t ?? null;
  const pente = compressibles.reduce((s, tr) => s + ((tr.dz * (tr.c.Cae ?? 0)) / (1 + tr.c.e0)) * 1000, 0);
  for (const p of courbe) {
    p.sf = debutFluage !== null && p.t > debutFluage ? pente * Math.log10(p.t / debutFluage) : 0;
    p.stot = p.s + p.sf;
  }
  const lire = (x) => {
    for (let i = 1; i < courbe.length; i++) if (courbe[i].t >= x - 1e-9) {
      const a0 = courbe[i - 1], a1 = courbe[i], w = a1.t > a0.t ? (x - a0.t) / (a1.t - a0.t) : 1;
      return { s: a0.s + w * (a1.s - a0.s), stot: a0.stot + w * (a1.stot - a0.stot), U: a0.U + w * (a1.U - a0.U) };
    }
    return courbe.at(-1);
  };
  const service = lire(d.tService), finService = lire(tFin);
  const residuel = finService.stot - service.stot;
  const Fobtenu = !avecCu ? null : d.construction === "etapes" ? Math.min(...etapes.map((e) => e.F)) : Fconstruction;

  // 7. Synthèse par couche.
  const parCouche = couches.map((c) => {
    const ts = tranches.filter((x) => x.c === c), mil = ts[Math.floor(ts.length / 2)];
    return {
      couche: c, drainante: ts[0].drainante, svp: mil.svp, sp: mil.sp, ds: contrainteSousBande(pFin, 0, mil.z),
      s: ts.reduce((s, x) => s + (x.drainante ? 0 : x.sInf), 0),
    };
  });
  return {
    H, Hmode: d.mode, eq, q0, final, tranches, parCouche, De, F: Fd, courbe, isochrones, etapes, bloque,
    atteinte: etapes.length > 0 && etapes.at(-1).H1 >= H - 1e-6, finTravaux, debutFluage, penteFluage: pente,
    service: { t: d.tService, s: service.stot, U: service.U, sFin: finService.stot, tFin, residuel, ok: residuel <= d.sAdmissible + 1e-9 },
    stabilite: { verifiee: avecCu, F: Fobtenu, ok: !avecCu || Fobtenu === null ? null : Fobtenu >= d.F - 1e-6 },
  };
}
