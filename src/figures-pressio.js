// Figures du dépouillement pressiométrique, communes à l'assistant du
// chapitre 3 et au bureau de calcul : étalonnages (tube, air), corrections,
// courbe et ses trois phases, pentes ΔV/Δp (choix de la plage de EM), fluage
// (pf) et extrapolations de pl (inverse du volume, hyperbole).
import { graphe, COULEURS } from "./figures.js";
import { pentes } from "./geotech/pressio.js";

const f = (x, c = 3) => (Number.isFinite(x) ? Number(x).toLocaleString("fr-FR", { maximumSignificantDigits: c }) : "—");
const nb = (x, c = 3) => f(x, c);
const bornes = (vals, marge = 0.05) => {
  const v = vals.filter(Number.isFinite);
  const lo = Math.min(0, ...v), hi = Math.max(...v);
  return [lo, hi + (hi - lo) * marge];
};

export function figureTube(pts, tube) {
  const [, pmax] = bornes(pts.map((q) => q.p));
  const [, vmax] = bornes(pts.map((q) => q.V), 0.12);
  return graphe({
    largeur: 560, hauteur: 250, xmin: 0, xmax: pmax, ymin: 0, ymax: vmax, xlabel: "pression lue pr (MPa)", ylabel: "volume Vr (cm³)",
    zones: tube.applicable ? [{ x0: tube.pmin, x1: pmax, y0: 0, y1: vmax, couleur: COULEURS.bleu, opacite: 0.07, libelle: "partie droite ajustée", position: "droite" }] : [],
    series: [
      { points: pts.map((q) => [q.p, q.V]), couleur: COULEURS.trait, marqueurs: true, epaisseur: 1.4, libelle: "lectures en tube" },
      ...(tube.applicable ? [{ points: [[0, tube.Vc], [pmax, tube.Vc + tube.a * pmax]], couleur: COULEURS.bleu, tirets: "6 4", libelle: `V = ${nb(tube.Vc, 4)} + ${nb(tube.a, 3)} p` }] : []),
    ],
    marques: tube.applicable ? [{ x: 0, y: tube.Vc, couleur: COULEURS.bleu, libelle: `Vc = ${nb(tube.Vc, 4)} cm³`, rayon: 4 }] : [],
  });
}

export function figureAir(air, Vs) {
  const t = air.table;
  const vmax = Math.max(t[t.length - 1][0], 1.2 * Vs) * 1.05;
  const pmax = Math.max(...t.map((r) => r[1])) * 1.15;
  return graphe({
    largeur: 560, hauteur: 250, xmin: 0, xmax: vmax, ymin: 0, ymax: pmax, xlabel: "volume injecté V (cm³)", ylabel: "pe (MPa)",
    series: [{ points: t, couleur: COULEURS.f62, marqueurs: true, libelle: "résistance propre de la sonde pe(V)" }],
    marques: air.pel ? [{ x: 1.2 * Vs, y: air.pel, couleur: COULEURS.rouge, guides: true, libelle: `pel = ${nb(air.pel, 3)} MPa à 1,2 Vs` }] : [],
  });
}

/** Lectures brutes Vr(pr) et courbe corrigée V(p) superposées : l'effet des corrections se voit. */
export function figureCorrections(paliers, courbe) {
  const brut = paliers.map((q) => [q.p, q.V60]);
  const [, xmax] = bornes([...brut.map((b) => b[0]), ...courbe.map((q) => q.p)]);
  const [, ymax] = bornes([...brut.map((b) => b[1]), ...courbe.map((q) => q.V)]);
  return graphe({
    largeur: 560, hauteur: 260, xmin: 0, xmax, ymin: 0, ymax, xlabel: "pression (MPa)", ylabel: "volume (cm³)",
    series: [
      { points: brut, couleur: COULEURS.discret, tirets: "5 4", marqueurs: true, epaisseur: 1.4, libelle: "lectures brutes Vr(pr)" },
      { points: courbe.map((q) => [q.p, q.V]), couleur: COULEURS.bleu, marqueurs: true, libelle: "courbe corrigée V(p)" },
    ],
  });
}

export function figureCourbe(r, Vs) {
  const c = r.courbe, ph = r.phase, lim = r.limite;
  const pMax = Math.max(...c.map((q) => q.p), lim.applicable && lim.pl < 2 * c[c.length - 1].p ? lim.pl : 0) * 1.06;
  const vHaut = Math.max(...c.map((q) => q.V), lim.Vl ?? 0) * 1.08;
  const series = [
    { points: c.map((q) => [q.p, q.V]), couleur: COULEURS.bleu, marqueurs: true, libelle: "courbe corrigée V60(p)" },
    { points: [[ph.p1, ph.V1], [ph.p2, ph.V2]], couleur: COULEURS.ec7, epaisseur: 3.2, libelle: `plage de EM (paliers ${ph.i1 + 1} à ${ph.i2 + 1})` },
  ];
  if (lim.applicable && lim.extrapolee && lim.hyperbole?.applicable && lim.hyperbole.courbe) {
    const der = c[c.length - 1];
    const pts = [];
    for (let V = der.V; V <= lim.Vl * 1.001; V += (lim.Vl - der.V) / 30) pts.push([lim.hyperbole.courbe(V), V]);
    series.push({ points: pts, couleur: COULEURS.f62, tirets: "5 4", libelle: "prolongement hyperbolique" });
  }
  if (lim.Vl) series.push({ points: [[0, lim.Vl], [pMax, lim.Vl]], couleur: COULEURS.rouge, tirets: "2 3", epaisseur: 1.4, libelle: `Vl = Vs + 2V1 = ${nb(lim.Vl, 4)} cm³` });
  const marques = [
    { x: ph.p1, y: ph.V1, couleur: COULEURS.ec7, libelle: "p1, V1", rayon: 4 },
    { x: ph.p2, y: ph.V2, couleur: COULEURS.ec7, libelle: "p2, V2", rayon: 4 },
  ];
  if (lim.applicable) marques.push({ x: lim.pl, y: lim.Vl, couleur: COULEURS.rouge, guides: true, libelle: `pl = ${nb(lim.pl, 3)} MPa` });
  return graphe({
    largeur: 560, hauteur: 300, xmin: 0, xmax: pMax, ymin: 0, ymax: vHaut, xlabel: "pression corrigée p (MPa)", ylabel: "volume corrigé V (cm³)",
    zones: [
      { x0: 0, x1: ph.p1, y0: 0, y1: vHaut, couleur: COULEURS.discret, opacite: 0.06, libelle: "remise en contact", position: "gauche" },
      { x0: ph.p1, x1: ph.p2, y0: 0, y1: vHaut, couleur: COULEURS.ec7, opacite: 0.08, libelle: "pseudo-élastique", position: "gauche" },
      { x0: ph.p2, x1: pMax, y0: 0, y1: vHaut, couleur: COULEURS.rouge, opacite: 0.05, libelle: "grandes déformations", position: "gauche" },
    ],
    series, marques,
  });
}

export function figureFluage(r) {
  const c = r.courbe.filter((q) => Number.isFinite(q.fluage));
  if (c.length < 3) return "";
  const pMax = Math.max(...c.map((q) => q.p)) * 1.05;
  const fMax = Math.max(...c.map((q) => q.fluage)) * 1.2;
  const series = [{ points: c.map((q) => [q.p, q.fluage]), couleur: COULEURS.violet, marqueurs: true, libelle: "fluage ΔV60/30 = V60 − V30" }];
  const fl = r.fluage;
  if (fl.bas && fl.haut) {
    const droite = (d, a, b) => [[a, d.a + d.b * a], [b, d.a + d.b * b]];
    series.push({ points: droite(fl.bas, 0, pMax), couleur: COULEURS.ec7, tirets: "6 4", epaisseur: 1.4, libelle: "droite du palier bas" });
    series.push({ points: droite(fl.haut, r.phase.p1, pMax), couleur: COULEURS.rouge, tirets: "6 4", epaisseur: 1.4, libelle: "droite de la branche montante" });
  }
  const marques = [{ x: r.pf, y: fl.bas ? fl.bas.a + fl.bas.b * r.pf : 0, couleur: COULEURS.rouge, guides: true, libelle: `pf = ${nb(r.pf, 3)} MPa` }];
  return graphe({
    largeur: 560, hauteur: 240, xmin: 0, xmax: pMax, ymin: 0, ymax: fMax, xlabel: "pression corrigée p (MPa)", ylabel: "ΔV60/30 (cm³)",
    series, marques,
  });
}

export function figureInverse(r) {
  const c = r.courbe.slice(r.phase.i1), lim = r.limite;
  if (!lim.Vl) return "";
  const pts = c.map((q) => [q.p, 1000 / q.V]);
  const pMax = Math.max(...c.map((q) => q.p), lim.applicable ? lim.pl : 0) * 1.08;
  const series = [{ points: pts, couleur: COULEURS.trait, marqueurs: true, epaisseur: 1.2, libelle: "1000/V des paliers" }];
  const inv = lim.inverse;
  if (inv?.applicable) {
    const a = r.pf * 0.9;
    series.push({ points: [[a, 1000 * (inv.B + inv.A * a)], [pMax, 1000 * (inv.B + inv.A * pMax)]], couleur: COULEURS.bleu, tirets: "6 4", libelle: "droite 1/V = A p + B (paliers plastiques)" });
  }
  series.push({ points: [[0, 1000 / lim.Vl], [pMax, 1000 / lim.Vl]], couleur: COULEURS.rouge, tirets: "2 3", epaisseur: 1.4, libelle: "1/Vl" });
  const yMax = Math.max(...pts.map((q) => q[1])) * 1.1;
  return graphe({
    largeur: 560, hauteur: 240, xmin: 0, xmax: pMax, ymin: 0, ymax: Math.max(yMax, (1000 / lim.Vl) * 1.3), xlabel: "pression corrigée p (MPa)", ylabel: "1/V (10⁻³ cm⁻³)",
    series,
    marques: lim.applicable ? [{ x: lim.pl, y: 1000 / lim.Vl, couleur: COULEURS.rouge, libelle: lim.extrapolee ? "pl extrapolée" : "pl lue" }] : [],
  });
}

/**
 * Pentes ΔV/Δp entre paliers successifs : la phase pseudo-élastique est celle
 * où la pente est la plus faible et à peu près constante ; c'est la plage
 * retenue pour EM.
 */
export function figurePentes(r) {
  const c = r.courbe, s = pentes(c), ph = r.phase;
  if (s.length < 2) return "";
  const pts = s.map((v, i) => [(c[i].p + c[i + 1].p) / 2, v]);
  const yMax = Math.min(Math.max(...s.filter(Number.isFinite)) * 1.1, 6 * Math.max(1, ...s.slice(ph.i1, ph.i2).filter(Number.isFinite)));
  return graphe({
    largeur: 560, hauteur: 230, xmin: 0, xmax: Math.max(...c.map((q) => q.p)) * 1.05, ymin: 0, ymax: yMax,
    xlabel: "pression corrigée p (MPa)", ylabel: "ΔV/Δp (cm³/MPa)",
    zones: [{ x0: ph.p1, x1: ph.p2, y0: 0, y1: yMax, couleur: COULEURS.ec7, opacite: 0.1, libelle: "plage de EM", position: "gauche" }],
    series: [{ points: pts.map(([x, y]) => [x, Math.min(y, yMax)]), couleur: COULEURS.ec7, marqueurs: true, libelle: "pente entre deux paliers" }],
  });
}

/**
 * Extrapolation hyperbolique de pl : les paliers au-delà de pf et l'hyperbole
 * ajustée, p(V) = [p1 (V1² + D) + C (V² − V1²)]/(V² + D), prolongée jusqu'à Vl.
 */
export function figureHyperbole(r) {
  const lim = r.limite, h = lim.hyperbole;
  if (!lim.extrapolee || !h?.applicable || !h.courbe) return "";
  const plast = r.courbe.filter((q) => q.p > r.pf + 1e-9);
  const V0 = Math.min(...plast.map((q) => q.V)) * 0.9;
  const pts = [];
  for (let V = V0; V <= lim.Vl * 1.0001; V += (lim.Vl - V0) / 60) pts.push([V, h.courbe(V)]);
  const pMax = Math.max(...pts.map((q) => q[1]), ...plast.map((q) => q.p)) * 1.08;
  return graphe({
    largeur: 560, hauteur: 240, xmin: V0 * 0.95, xmax: lim.Vl * 1.05, ymin: Math.min(...plast.map((q) => q.p)) * 0.8, ymax: pMax,
    xlabel: "volume corrigé V (cm³)", ylabel: "pression corrigée p (MPa)",
    series: [
      { points: plast.map((q) => [q.V, q.p]), couleur: COULEURS.trait, marqueurs: true, epaisseur: 1.2, libelle: "paliers au-delà de pf" },
      { points: pts, couleur: COULEURS.f62, tirets: "6 4", libelle: "hyperbole ajustée" },
      { points: [[lim.Vl, 0], [lim.Vl, pMax]], couleur: COULEURS.rouge, tirets: "2 3", epaisseur: 1.4, libelle: "Vl = Vs + 2V1" },
    ],
    marques: [{ x: lim.Vl, y: h.pl, couleur: COULEURS.rouge, libelle: `pl (hyperbole) = ${f(h.pl, 3)} MPa` }],
  });
}
