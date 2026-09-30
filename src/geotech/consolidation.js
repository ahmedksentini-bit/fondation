// Sols compressibles : consolidation, fluage et remblais.
//  · consolidation unidimensionnelle de Terzaghi : degré moyen U(Tv), son
//    inverse, isochrones u(z, t) ;
//  · consolidation radiale vers des drains verticaux (Barron 1948, zone
//    remaniée de Hansbo 1981) et combinaison de Carrillo (1942) ;
//  · contrainte verticale sous une charge en bande de profil quelconque : la
//    solution de Flamant intégrée par segments (au centre d'un remblai
//    trapézoïdal, c'est la formule d'Osterberg, 1957) ;
//  · tassement de consolidation par tranches (NF P94-261 annexe J.4 ;
//    Fascicule 62 annexe F.2 § 2.3), compression secondaire (Cαe) ;
//  · hauteur de remblai à mettre en œuvre, construction par étapes, méthode
//    observationnelle d'Asaoka (1978) ;
//  · consolidation d'un multicouche par différences finies (bureau de calcul).
//
// Unités : m, kPa, kN/m³ ; temps en années, cv et ch en m²/an
// (1 m²/an ≈ 3,17·10⁻⁸ m²/s) ; tassements en mm à la sortie, sauf mention.

import { GAMMA_W, dichotomie, horsDomaine } from "./outils.js";
import { tassementOedometrique } from "./tassements.js";

/** Fonction d'erreur (Abramowitz et Stegun 7.1.26 ; erreur < 1,5·10⁻⁷). */
function erf(x) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}

// ─────────────────────────── Consolidation verticale ─────────────────────

/**
 * Degré de consolidation moyen de Terzaghi, surpression initiale uniforme :
 * U = 1 − Σ 2/M² exp(−M² Tv), M = π(2m + 1)/2. Aux petits temps, la série
 * converge mal mais U = 2 √(Tv/π) y est exact à 10⁻⁶ près.
 */
export function degreConsolidation(Tv) {
  if (!(Tv > 0)) return 0;
  if (Tv < 0.05) return 2 * Math.sqrt(Tv / Math.PI);
  let somme = 0;
  for (let m = 0; m < 200; m++) {
    const M = (Math.PI * (2 * m + 1)) / 2, terme = (2 / (M * M)) * Math.exp(-M * M * Tv);
    somme += terme;
    if (terme < 1e-15) break;
  }
  return 1 - somme;
}

/** Facteur temps Tv qui donne le degré moyen U (inverse de degreConsolidation). */
export function facteurTemps(U) {
  if (!(U > 0)) return 0;
  if (U >= 1) return Infinity;
  if (U <= 0.25) return (Math.PI * U * U) / 4;
  return dichotomie((T) => degreConsolidation(T) - U, 0.04, 30);
}

/**
 * Surpression interstitielle relative u/u0 au facteur temps Tv, à la
 * profondeur relative Z = z/Hd comptée depuis la face drainante (0 ≤ Z ≤ 1 en
 * drainage simple ; 0 ≤ Z ≤ 2 en drainage double, symétrique autour de Z = 1).
 */
export function surpressionRelative(Tv, Z) {
  const Zs = Z <= 1 ? Math.max(Z, 0) : Math.max(2 - Z, 0);
  if (!(Tv > 0)) return Zs > 0 ? 1 : 0;
  // Aux petits temps, la couche se comporte comme un massif semi-infini.
  if (Tv < 0.02) return erf(Zs / (2 * Math.sqrt(Tv)));
  let u = 0;
  for (let m = 0; m < 400; m++) {
    const M = (Math.PI * (2 * m + 1)) / 2, e = Math.exp(-M * M * Tv);
    u += (2 / M) * Math.sin(M * Zs) * e;
    if (e < 1e-15) break;
  }
  return Math.min(1, Math.max(0, u));
}

/** Longueur de drainage : épaisseur entière en drainage simple, moitié en drainage double. */
export const longueurDrainage = (H, double = true) => (double ? H / 2 : H);

// ─────────────────────────── Drains verticaux ────────────────────────────

/** Diamètre d'influence d'un drain : De = 1,05 s en maille triangulaire, 1,13 s en maille carrée. */
export const diametreInfluence = (espacement, maille = "triangle") =>
  espacement * Math.sqrt((maille === "carre" ? 4 : 2 * Math.sqrt(3)) / Math.PI);

/** Diamètre équivalent d'un drain en bande a × b (Hansbo, 1979) : dw = 2 (a + b)/π. */
export const diametreDrainBande = (a, b) => (2 * (a + b)) / Math.PI;

/**
 * Facteur de drain de Hansbo (1981), résistance hydraulique du drain négligée :
 * F = ln(n/s) + (kh/ks) ln s − 0,75, avec n = De/dw et s = ds/dw (zone
 * remaniée par le mandrin de fonçage). Sans remaniement (s = 1), c'est la
 * forme simplifiée de Barron, ln n − 0,75.
 */
export function facteurDrain({ n, s = 1, kRapport = 1 }) {
  const ss = Math.max(1, s);
  return Math.log(n / ss) + kRapport * Math.log(ss) - 0.75;
}

/** Degré de consolidation radiale : Uh = 1 − exp(−8 Th/F), Th = ch t/De². */
export function degreRadial({ ch, t, De, F }) {
  const Th = (ch * t) / (De * De);
  return { Th, Uh: F > 0 ? 1 - Math.exp((-8 * Th) / F) : 0 };
}

/** Combinaison de Carrillo : 1 − U = (1 − Uv)(1 − Uh). */
export const combinerCarrillo = (Uv, Uh) => 1 - (1 - Uv) * (1 - Uh);

/**
 * Consolidation d'une couche drainée verticalement (longueur Hd) et, si
 * espacement > 0, par un réseau de drains verticaux. Renvoie Uv, Uh et U à t.
 */
export function consolidationAvecDrains({ cv, Hd, t, ch = cv, espacement = 0, maille = "triangle", dw = 0.05, s = 1, kRapport = 1 }) {
  const Tv = (cv * t) / (Hd * Hd), Uv = degreConsolidation(Tv);
  if (!(espacement > 0)) return { Tv, Uv, Uh: 0, U: Uv, De: null, F: null, n: null };
  const De = diametreInfluence(espacement, maille), n = De / dw, F = facteurDrain({ n, s, kRapport });
  const { Th, Uh } = degreRadial({ ch, t, De, F });
  return { Tv, Uv, Th, Uh, U: combinerCarrillo(Uv, Uh), De, n, F };
}

/** Temps nécessaire pour atteindre le degré U, avec ou sans drains (ans). */
export function tempsPourDegre({ U, cv, Hd, ch = cv, espacement = 0, maille = "triangle", dw = 0.05, s = 1, kRapport = 1 }) {
  if (!(U > 0)) return 0;
  if (U >= 1) return Infinity;
  if (!(espacement > 0)) return (facteurTemps(U) * Hd * Hd) / cv;
  const f = (lt) => consolidationAvecDrains({ cv, Hd, t: 10 ** lt, ch, espacement, maille, dw, s, kRapport }).U - U;
  return 10 ** dichotomie(f, -8, 5);
}

/**
 * Espacement maximal des drains qui donne le degré Ucible au temps t. Si la
 * consolidation verticale y suffit seule, espacement = Infinity ; si même des
 * drains très serrés (0,5 m) n'y suffisent pas, null.
 */
export function espacementDrains({ cv, Hd, t, Ucible, ch = cv, maille = "triangle", dw = 0.05, s = 1, kRapport = 1 }) {
  const Uv = degreConsolidation((cv * t) / (Hd * Hd));
  if (Uv >= Ucible) return { espacement: Infinity, Uv, Uh: 0 };
  const Uh = 1 - (1 - Ucible) / (1 - Uv);
  const radial = (e) => consolidationAvecDrains({ cv, Hd, t, ch, espacement: e, maille, dw, s, kRapport }).Uh;
  const eMin = 0.5, eMax = 10;
  if (radial(eMin) < Uh) return { espacement: null, Uv, Uh };
  if (radial(eMax) >= Uh) return { espacement: eMax, Uv, Uh, borne: true };
  return { espacement: dichotomie((e) => radial(e) - Uh, eMin, eMax), Uv, Uh };
}

// ─────────────────────── Contraintes sous un remblai ─────────────────────

/**
 * Profil de charge [[x, q]] d'un remblai trapézoïdal symétrique centré en
 * x = 0 : crête de largeur 2b, talus de fruit n (n horizontal pour 1 vertical).
 */
export function profilRemblai({ H, largeurCrete, fruit, q }) {
  const b = largeurCrete / 2, a = fruit * H;
  return [[-b - a, 0], [-b, q], [b, q], [b + a, 0]];
}

/**
 * Contrainte verticale au point (x, z) sous une charge en bande dont le
 * profil [[x, q]] est linéaire par morceaux, sur un massif élastique
 * homogène : la solution de Flamant d'une charge linéique, σz = 2 p z³/(π r⁴),
 * intégrée exactement sur chaque segment.
 */
export function contrainteSousBande(profil, x, z) {
  if (!(z > 1e-9)) {
    for (let i = 0; i < profil.length - 1; i++) {
      const [x1, q1] = profil[i], [x2, q2] = profil[i + 1];
      if (x >= x1 && x <= x2 && x2 > x1) return q1 + ((q2 - q1) * (x - x1)) / (x2 - x1);
    }
    return 0;
  }
  const F = (u) => (Math.atan(u / z) + (u * z) / (u * u + z * z)) / Math.PI;
  const G = (u) => -(z ** 3) / (Math.PI * (u * u + z * z));
  let s = 0;
  for (let i = 0; i < profil.length - 1; i++) {
    const [x1, q1] = profil[i], [x2, q2] = profil[i + 1];
    if (!(x2 > x1)) continue;
    const B = (q2 - q1) / (x2 - x1), A = q1 - B * x1, u1 = x - x1, u2 = x - x2;
    s += (A + B * x) * (F(u1) - F(u2)) - B * (G(u1) - G(u2));
  }
  return s;
}

/**
 * Formule d'Osterberg (1957) : contrainte sous l'axe d'un remblai trapézoïdal
 * symétrique (demi-crête b, talus de largeur a, charge q = γ H), somme des
 * deux demi-remblais : 2 q/π [((a + b)/a)(α1 + α2) − (b/a) α2].
 */
export function osterbergAxe({ q, a, b, z }) {
  if (!(z > 0)) return q;
  const a2 = Math.atan(b / z), a1 = Math.atan((a + b) / z) - a2;
  return ((2 * q) / Math.PI) * (((a + b) / a) * (a1 + a2) - (b / a) * a2);
}

// ─────────────────────── Tassement de consolidation ──────────────────────

/**
 * Contraintes initiales à la profondeur z sous le terrain naturel, dans un
 * profil de couches [{ z0, z1, gamma }] (γ total, saturé sous la nappe) ;
 * nappe à zw sous le terrain naturel.
 */
export function contraintesInitiales(couches, z, zw = 0) {
  let sv = 0, fond = 0, gammaFond = couches[0]?.gamma ?? 18;
  for (const c of couches) {
    if (z > c.z0) sv += c.gamma * (Math.min(z, c.z1) - c.z0);
    fond = Math.max(fond, c.z1);
    if (c.z1 >= fond) gammaFond = c.gamma;
  }
  if (z > fond) sv += gammaFond * (z - fond);
  const u = GAMMA_W * Math.max(0, z - zw);
  return { sv, u, svp: sv - u };
}

/** Contrainte de préconsolidation : σ'p = max(OCR σ'v0 ; σ'v0 + POP). */
export const preconsolidation = (svp, { ocr = 1, pop = 0 } = {}) => Math.max(svp * (ocr > 0 ? ocr : 1), svp + (pop > 0 ? pop : 0));

/**
 * Tassement final de consolidation primaire, tranche par tranche.
 * couches : [{ z0, z1, gamma, e0, Cc, Cs, ocr, pop }] depuis le terrain
 * naturel ; une couche sans Cc > 0 (sable, substratum) ne tasse pas.
 * dSigma(z) : supplément de contrainte verticale (kPa) ; zw : nappe.
 */
export function tassementPrimaire({ couches, dSigma, zw = 0, epaisseurTranche = 0.5 }) {
  const tranches = [];
  let s = 0;
  for (const c of couches) {
    if (!(c.Cc > 0) || !(c.z1 > c.z0)) continue;
    const H = c.z1 - c.z0, n = Math.max(1, Math.ceil(H / epaisseurTranche - 1e-9)), dz = H / n;
    for (let i = 0; i < n; i++) {
      const z = c.z0 + (i + 0.5) * dz;
      const { svp } = contraintesInitiales(couches, z, zw);
      if (!(svp > 0)) continue;
      const sp = preconsolidation(svp, c), ds = Math.max(0, dSigma(z));
      const r = tassementOedometrique({ H: dz, e0: c.e0, Cc: c.Cc, Cs: c.Cs ?? 0, sigmaV0: svp, sigmaP: sp, dSigma: ds });
      tranches.push({ couche: c, z, dz, svp, sp, ds, s: r.s, domaine: r.domaine });
      s += r.s;
    }
  }
  return { s, tranches };
}

/** Compression secondaire : s2 = H Cαe/(1 + e0) lg(t/tp) pour t > tp (mm). */
export function compressionSecondaire({ H, e0, Calpha, tp, t }) {
  if (!(t > tp && tp > 0 && Calpha > 0)) return 0;
  return ((H * Calpha) / (1 + e0)) * Math.log10(t / tp) * 1000;
}

/**
 * Tassement de consolidation au temps t quand la charge monte linéairement
 * pendant tc (correction de Terzaghi) : pendant la construction,
 * s = s∞ U(t/2) t/tc ; ensuite, s = s∞ U(t − tc/2). degre(t) : degré de
 * consolidation sous chargement instantané.
 */
export function tassementAvecConstruction({ sInf, t, tc = 0, degre }) {
  if (!(t > 0)) return 0;
  if (!(tc > 0)) return sInf * degre(t);
  if (t <= tc) return sInf * degre(t / 2) * (t / tc);
  return sInf * degre(t - tc / 2);
}

// ─────────────────────── Remblais sur sols mous ──────────────────────────

/**
 * Hauteur à mettre en œuvre pour qu'après tassement la plateforme soit à
 * Hfinale au-dessus du terrain naturel : H = Hfinale + s. La part du remblai
 * enfoncée sous la nappe (nappe à zw sous le terrain naturel) est déjaugée :
 * la charge devient γ H − γw max(0, s − zw). tassement(H, q) : tassement final
 * (m) sous un remblai de hauteur H exerçant la charge q.
 */
export function hauteurMiseEnOeuvre({ Hfinale, gamma, tassement, zw = Infinity, immersion = true }) {
  const charge = (H, s) => gamma * H - (immersion ? GAMMA_W * Math.max(0, s - zw) : 0);
  let H = Hfinale, s = 0, iterations = 0;
  for (; iterations < 200; iterations++) {
    const sn = tassement(H, charge(H, s)), Hn = Hfinale + sn;
    const fini = Math.abs(Hn - H) < 1e-6 && Math.abs(sn - s) < 1e-6;
    H = Hn; s = sn;
    if (fini) break;
  }
  return { H, s, q: charge(H, s), dejaugeage: immersion ? GAMMA_W * Math.max(0, s - zw) : 0, iterations };
}

/**
 * Tassement final d'un remblai de hauteur mise en œuvre H, déjaugeage compris :
 * la part du remblai enfoncée sous la nappe (s − zw) ne pèse plus que γ − γw,
 * d'où le point fixe s = tassement(H, γ H − γw max(0, s − zw)).
 */
export function tassementDejauge({ H, gamma, tassement, zw = Infinity, immersion = true }) {
  const charge = (s) => gamma * H - (immersion ? GAMMA_W * Math.max(0, s - zw) : 0);
  let s = 0, iterations = 0;
  for (; iterations < 200; iterations++) {
    const sn = tassement(H, charge(s)), fini = Math.abs(sn - s) < 1e-6;
    s = sn;
    if (fini) break;
  }
  return { H, s, q: charge(s), dejaugeage: immersion ? GAMMA_W * Math.max(0, s - zw) : 0, iterations };
}

/**
 * Construction par étapes (prédimensionnement ; rupture non drainée d'un
 * remblai large sur sol fin) : une étape peut monter jusqu'à H = Nc cu/(γ F) ;
 * la consolidation qui suit, jusqu'au degré U, accroît la cohésion de
 * Δcu = λcu U Δσ'v, avec Δσ'v ≈ γ H sous un remblai large. Les hauteurs
 * successives tendent vers H∞ = H1/(1 − k), k = Nc λcu U/F : un remblai plus
 * haut que H∞ demande un autre moyen (banquettes, renforcement, allègement).
 */
export function constructionParEtapes({ cu0, gamma, Hfinale, F = 1.5, Nc = Math.PI + 2, lambdaCu = 0.25, U = 0.7, maxEtapes = 12 }) {
  const H1 = (Nc * cu0) / (gamma * F), k = (Nc * lambdaCu * U) / F;
  const Hinf = k < 1 ? H1 / (1 - k) : Infinity;
  const etapes = [];
  let cu = cu0, H = 0;
  while (etapes.length < maxEtapes && H < Hfinale - 1e-6) {
    const Hn = Math.min(Hfinale, (Nc * cu) / (gamma * F));
    if (Hn <= H + 0.05) break;
    const e = { n: etapes.length + 1, H0: H, H: Hn, cu };
    H = Hn;
    cu = cu0 + lambdaCu * U * gamma * H;
    e.cuApres = cu;
    etapes.push(e);
  }
  return { etapes, H1, Hinf, k, atteinte: H >= Hfinale - 1e-6 };
}

/**
 * Méthode d'Asaoka (1978). Les mesures [[t, s]] sont rééchantillonnées au pas
 * constant Δt ; les couples (s_{i−1}, s_i) s'alignent sur s_i = β0 + β1 s_{i−1},
 * et le tassement final vaut s∞ = β0/(1 − β1). Avec le premier terme de la
 * solution de Terzaghi, ln β1 = −π² cv Δt/(4 Hd²) ; vers des drains,
 * ln β1 = −8 ch Δt/(De² F).
 */
export function asaoka(mesures, { pas = null, depuis = -Infinity } = {}) {
  const m = mesures.filter(([t, s]) => Number.isFinite(t) && Number.isFinite(s) && t >= depuis).sort((a, b) => a[0] - b[0]);
  if (m.length < 4) return horsDomaine("il faut au moins quatre mesures après le début retenu");
  const t0 = m[0][0], t1 = m[m.length - 1][0];
  const dt = pas > 0 ? pas : (t1 - t0) / (m.length - 1);
  const n = Math.floor((t1 - t0) / dt + 1e-9) + 1;
  if (!(dt > 0) || n < 4) return horsDomaine("pas de temps trop grand : moins de quatre points à pas constant");
  const lire = (t) => {
    for (let i = 1; i < m.length; i++) if (t <= m[i][0] + 1e-12) {
      const [ta, sa] = m[i - 1], [tb, sb] = m[i];
      return tb > ta ? sa + ((sb - sa) * (t - ta)) / (tb - ta) : sb;
    }
    return m[m.length - 1][1];
  };
  const serie = Array.from({ length: n }, (_, i) => [t0 + i * dt, lire(t0 + i * dt)]);
  const X = serie.slice(0, -1).map((p) => p[1]), Y = serie.slice(1).map((p) => p[1]);
  const moy = (v) => v.reduce((a, b) => a + b, 0) / v.length;
  const mx = moy(X), my = moy(Y);
  let sxx = 0, sxy = 0, syy = 0;
  for (let i = 0; i < X.length; i++) { sxx += (X[i] - mx) ** 2; sxy += (X[i] - mx) * (Y[i] - my); syy += (Y[i] - my) ** 2; }
  if (!(sxx > 0)) return horsDomaine("tassements constants : rien à extrapoler");
  const beta1 = sxy / sxx, beta0 = my - beta1 * mx, r2 = syy > 0 ? (sxy * sxy) / (sxx * syy) : 1;
  const points = X.map((x, i) => [x, Y[i]]);
  if (!(beta1 > 0 && beta1 < 1)) return horsDomaine("β1 hors de ]0 ; 1[ : les mesures ne tendent pas encore vers une valeur finale", { beta0, beta1, points, serie, pas: dt, r2 });
  return { applicable: true, pas: dt, serie, points, beta0, beta1, sInf: beta0 / (1 - beta1), r2 };
}

/** cv tiré de la pente β1 d'Asaoka (drainage vertical, longueur Hd). */
export const cvAsaoka = ({ beta1, pas, Hd }) => (-4 * Hd * Hd * Math.log(beta1)) / (Math.PI * Math.PI * pas);
/** ch tiré de la pente β1 d'Asaoka (drains verticaux, De et F connus). */
export const chAsaoka = ({ beta1, pas, De, F }) => (-De * De * F * Math.log(beta1)) / (8 * pas);

// ─────────────────────── Multicouche, différences finies ─────────────────

/**
 * Solveur de consolidation d'un multicouche (volumes finis, schéma implicite
 * d'Euler, inconditionnellement stable) :
 *   mv ∂u/∂t = mv ∂σ/∂t + ∂/∂z (mv cv ∂u/∂z) − mv r u,
 * le dernier terme représentant les drains verticaux (équation moyennée de
 * Barron–Hansbo, r = 8 ch/(De² F)) : pour un chargement instantané d'une
 * couche homogène, on retrouve la combinaison de Carrillo.
 * tranches : [{ dz, cv, mv, r = 0, drainante = false }] de haut en bas ; la
 * face supérieure est drainante, la face inférieure si basDrainant.
 * pas(dt, sigma) : la contrainte totale de chaque tranche passe à sigma au début du
 * pas (réponse non drainée : u augmente d'autant), puis l'eau s'écoule pendant dt.
 */
export function solveurConsolidation({ tranches, basDrainant = false }) {
  const N = tranches.length;
  const k = tranches.map((c) => Math.max(c.mv * c.cv, 1e-30)); // k/γw
  const C = new Float64Array(N + 1);
  C[0] = (2 * k[0]) / tranches[0].dz;
  for (let i = 1; i < N; i++) C[i] = 1 / (tranches[i - 1].dz / (2 * k[i - 1]) + tranches[i].dz / (2 * k[i]));
  C[N] = basDrainant ? (2 * k[N - 1]) / tranches[N - 1].dz : 0;
  let u = new Float64Array(N), sigma = new Float64Array(N);
  const a = new Float64Array(N), b = new Float64Array(N), c = new Float64Array(N), d = new Float64Array(N);
  return {
    get u() { return u; },
    get sigma() { return sigma; },
    pas(dt, sigmaNouveau) {
      for (let i = 0; i < N; i++) {
        const t = tranches[i];
        if (t.drainante) { a[i] = 0; b[i] = 1; c[i] = 0; d[i] = 0; continue; }
        const W = t.mv * t.dz;
        a[i] = i > 0 ? -C[i] : 0;
        c[i] = i < N - 1 ? -C[i + 1] : 0;
        b[i] = W / dt + C[i] + C[i + 1] + W * (t.r ?? 0);
        d[i] = (W / dt) * (u[i] + (sigmaNouveau[i] - sigma[i]));
      }
      // Algorithme de Thomas (système tridiagonal).
      for (let i = 1; i < N; i++) {
        const m = a[i] / b[i - 1];
        b[i] -= m * c[i - 1];
        d[i] -= m * d[i - 1];
      }
      const x = new Float64Array(N);
      x[N - 1] = d[N - 1] / b[N - 1];
      for (let i = N - 2; i >= 0; i--) x[i] = (d[i] - c[i] * x[i + 1]) / b[i];
      u = x;
      sigma = Float64Array.from(sigmaNouveau);
      return u;
    },
  };
}
