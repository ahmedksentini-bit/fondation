// Stabilité des talus de remblai et de déblai : pente infinie et méthode de
// Bishop simplifiée sur des cercles de glissement. Le GTR ne traite pas la
// stabilité (elle relève de la conception géotechnique, NF P94-500,
// Eurocode 7) ; ce module sert à comprendre l'effet de la pente, de la
// cohésion, du frottement et de l'eau.

import { RAD, horsDomaine } from "./outils.js";

/**
 * Talus infini en sol frottant : F = tan φ'/tan β à sec ; avec un
 * écoulement parallèle à la pente, F = (γ'/γsat) tan φ'/tan β.
 */
export function penteInfinie({ phi, beta, ecoulement = false, gamma = 20, gammaW = 10 }) {
  const t = Math.tan(phi * RAD) / Math.tan(beta * RAD);
  return ecoulement ? ((gamma - gammaW) / gamma) * t : t;
}

/**
 * Géométrie d'un talus : pied en (0, 0), crête en (f H, H), terrain
 * horizontal de part et d'autre ; sol homogène jusqu'à une couche dure à la
 * profondeur D sous le pied.
 */
export function surfaceTalus({ H, f }) {
  return (x) => (x <= 0 ? 0 : x >= f * H ? H : x / f);
}

/**
 * Coefficient de sécurité de Bishop simplifié pour un cercle (xc, yc, R) :
 *   F = Σ [c' b + (W − u b) tan φ'] / mα  /  Σ W sin α,
 *   mα = cos α (1 + tan α tan φ'/F),
 * u = ru γ h (rapport de pression interstitielle). Renvoie null si le cercle
 * ne coupe pas le talus ou plonge sous la couche dure.
 */
export function bishop({ H, f, c, phi, gamma = 20, ru = 0, D = Infinity, cercle, tranches = 40 }) {
  const { xc, yc, R } = cercle, ys = surfaceTalus({ H, f });
  // Points d'entrée et de sortie : là où l'arc inférieur coupe la surface.
  const yb = (x) => yc - Math.sqrt(Math.max(0, R * R - (x - xc) ** 2));
  const ecart = (x) => ys(x) - yb(x);
  const xs = [];
  const a = xc - R + 1e-6, b = xc + R - 1e-6, n = 400;
  let prev = ecart(a);
  for (let i = 1; i <= n; i++) {
    const x = a + ((b - a) * i) / n, e = ecart(x);
    if ((prev <= 0 && e > 0) || (prev > 0 && e <= 0)) {
      let lo = x - (b - a) / n, hi = x;
      for (let k = 0; k < 50; k++) { const m = (lo + hi) / 2; if ((ecart(m) > 0) === (ecart(lo) > 0)) lo = m; else hi = m; }
      xs.push((lo + hi) / 2);
    }
    prev = e;
  }
  if (xs.length < 2) return null;
  const x1 = xs[0], x2 = xs[xs.length - 1];
  if (x2 - x1 < 0.2) return null;
  const bL = (x2 - x1) / tranches, tp = Math.tan(phi * RAD);
  const T = [];
  for (let i = 0; i < tranches; i++) {
    const x = x1 + (i + 0.5) * bL, h = ys(x) - yb(x);
    if (yb(x) < -D - 1e-9) return null;
    if (h <= 0) continue;
    const s = (x - xc) / R, al = Math.asin(Math.max(-1, Math.min(1, s)));
    T.push({ W: gamma * h * bL, al, u: ru * gamma * h });
  }
  const moteur = T.reduce((s, t) => s + t.W * Math.sin(t.al), 0);
  if (!(moteur > 0)) return null;
  let F = 1.2;
  for (let it = 0; it < 60; it++) {
    let res = 0;
    for (const t of T) {
      const m = Math.cos(t.al) * (1 + (Math.tan(t.al) * tp) / F);
      if (m < 0.2) return null; // tranche de pied trop inclinée : cercle non admissible
      res += (c * bL + (t.W - t.u * bL) * tp) / m;
    }
    const Fn = res / moteur;
    if (Math.abs(Fn - F) < 1e-6) { F = Fn; break; }
    F = Fn;
  }
  return { F, x1, x2, cercle };
}

/**
 * Recherche du cercle critique : centres sur une grille au-dessus du talus,
 * rayons tels que le cercle passe par le pied ou soit tangent à des niveaux
 * de profondeur croissante. Renvoie le plus faible F et son cercle.
 */
export function cercleCritique({ H, f, c, phi, gamma = 20, ru = 0, D = Infinity, maille = 14 }) {
  if (!(H > 0 && f > 0)) return horsDomaine("Hauteur et fruit du talus positifs.");
  const L = f * H;
  let meilleur = null;
  const profondeurs = [0, 0.25, 0.5, 1].map((k) => k * H).filter((d) => d <= D + 1e-9);
  for (let i = 0; i <= maille; i++) for (let j = 0; j <= maille; j++) {
    const xc = -0.5 * H + ((L + H) * i) / maille, yc = 0.6 * H + (2.4 * H * j) / maille;
    const rayons = [Math.hypot(xc, yc), ...profondeurs.map((d) => yc + d)];
    for (const R of rayons) {
      const r = bishop({ H, f, c, phi, gamma, ru, D, cercle: { xc, yc, R } });
      if (r && (!meilleur || r.F < meilleur.F)) meilleur = r;
    }
  }
  if (!meilleur) return horsDomaine("Aucun cercle admissible trouvé.");
  return { applicable: true, ...meilleur };
}
