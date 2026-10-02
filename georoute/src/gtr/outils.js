// Outils numériques communs aux solveurs. Aucun accès au DOM : ces modules
// tournent aussi bien dans la page que sous `node --test`.
//
// Conventions d'unités, tenues dans TOUS les solveurs :
//   masses volumiques en Mg/m³ (= t/m³ = g/cm³) · teneurs en eau et
//   pourcentages en % · longueurs d'ouvrage en m, d'éprouvette en mm ·
//   forces en kN · contraintes en kPa · modules de plateforme en MPa ·
//   volumes de terrassement en m³ · angles en degrés aux entrées publiques.

export const RAD = Math.PI / 180;
export const RHO_W = 1; // Mg/m³ — masse volumique de l'eau
export const G = 9.81; // m/s²
export const GAMMA_W = 9.81; // kN/m³

/** Une méthode qui ne s'applique pas doit dire pourquoi (principe du site). */
export function horsDomaine(motif, extra = {}) {
  return { applicable: false, motif, ...extra };
}

/** Borne x dans [a, b]. */
export const borner = (x, a, b) => Math.min(Math.max(x, a), b);

/** Somme d'un tableau. */
export const somme = (t) => t.reduce((s, x) => s + x, 0);

/** Moyenne d'un tableau. */
export const moyenne = (t) => (t.length ? somme(t) / t.length : NaN);

/** Écart type (n − 1) d'un tableau. */
export function ecartType(t) {
  if (t.length < 2) return NaN;
  const m = moyenne(t);
  return Math.sqrt(somme(t.map((x) => (x - m) ** 2)) / (t.length - 1));
}

/** Dichotomie sur une fonction qui change de signe entre a et b. */
export function dichotomie(f, a, b, iterations = 80) {
  let fa = f(a);
  for (let i = 0; i < iterations; i++) {
    const m = (a + b) / 2, fm = f(m);
    if ((fm > 0) === (fa > 0)) { a = m; fa = fm; } else b = m;
  }
  return (a + b) / 2;
}

/** Interpolation linéaire dans un tableau [x, y] trié en x, bornée aux extrémités. */
export function interpoler(table, x) {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (x <= table[i][0]) {
      const [x0, y0] = table[i - 1], [x1, y1] = table[i];
      return x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return table[table.length - 1][1];
}

/**
 * Régression linéaire y = a + b x par les moindres carrés. Renvoie aussi le
 * coefficient de détermination r².
 */
export function regression(points) {
  const n = points.length;
  if (n < 2) return { a: NaN, b: NaN, r2: NaN };
  const mx = moyenne(points.map((p) => p[0])), my = moyenne(points.map((p) => p[1]));
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of points) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  const b = sxy / sxx, a = my - b * mx;
  return { a, b, r2: syy > 0 ? (sxy * sxy) / (sxx * syy) : 1 };
}

/**
 * Parabole y = c0 + c1 x + c2 x² ajustée par les moindres carrés (système
 * normal 3 × 3 résolu par Cramer). Sert au sommet de la courbe Proctor.
 */
export function parabole(points) {
  const n = points.length;
  if (n < 3) return null;
  let s0 = n, s1 = 0, s2 = 0, s3 = 0, s4 = 0, t0 = 0, t1 = 0, t2 = 0;
  for (const [x, y] of points) {
    const x2 = x * x;
    s1 += x; s2 += x2; s3 += x2 * x; s4 += x2 * x2;
    t0 += y; t1 += x * y; t2 += x2 * y;
  }
  const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const M = [[s0, s1, s2], [s1, s2, s3], [s2, s3, s4]];
  const D = det(M);
  if (!(Math.abs(D) > 1e-12)) return null;
  const col = (k, v) => M.map((l, i) => l.map((x, j) => (j === k ? v[i] : x)));
  const v = [t0, t1, t2];
  return { c0: det(col(0, v)) / D, c1: det(col(1, v)) / D, c2: det(col(2, v)) / D };
}

/** Nombre au format français, chiffres significatifs. */
export const fr = (x, chiffres = 3) => Number.isFinite(x)
  ? Number(x).toLocaleString("fr-FR", { maximumSignificantDigits: chiffres })
  : "—";

/** Nombre au format français, décimales fixes. */
export const frd = (x, decimales = 2) => Number.isFinite(x)
  ? Number(x).toLocaleString("fr-FR", { minimumFractionDigits: decimales, maximumFractionDigits: decimales })
  : "—";

/** Arrondi à n décimales (pour comparer ou afficher un seuil). */
export const arrondi = (x, n = 2) => Math.round(x * 10 ** n) / 10 ** n;
