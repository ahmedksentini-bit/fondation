// Calculateur du chapitre 12 : pieu sous effort transversal en tête, dans un
// sol à deux couches, par différences finies (loi élasto-plastique de Ménard,
// minoration près de la surface), comparé à la solution du pieu long.
import { el, num, f, fd, brancher, garde } from "./ui.js";
import { graphe, COULEURS } from "./figures.js";
import { moduleKf, minorationSurface, pieuLongAnalytique, pieuDifferencesFinies, pieuSouple } from "./geotech/lateral.js";

const majLa = garde("laOut", () => {
  const B = num("laB"), L = num("laL"), E = num("laE"), H = num("laH", 0), M = num("laM", 0);
  const tete = el("laTete").value, longue = el("laDuree").value === "longue", min = el("laMin").value;
  const h1 = Math.max(num("laH1", 0), 0), sol1 = el("laSol1").value;
  const c1 = { EM: num("laEM1"), alpha: num("laA1"), pf: num("laPf1") };
  const c2 = { EM: num("laEM2"), alpha: num("laA2"), pf: num("laPf2") };
  if (!(B > 0 && L > 0 && E > 0 && c1.EM > 0 && c2.EM > 0 && c1.pf > 0 && c2.pf > 0)) { el("laOut").textContent = "Renseigner la géométrie et les paramètres des deux couches."; return; }
  const EI = E * 1000 * (Math.PI * B ** 4) / 64;
  const facteur = longue ? 0.5 : 1;
  const couche = (z) => (z < h1 ? { ...c1, sol: sol1 } : { ...c2, sol: "frottant" });
  const reaction = (z) => {
    const c = couche(z);
    let K = moduleKf({ EM: c.EM, B, alpha: c.alpha }).Kf * facteur;
    let rmax = B * c.pf * 1000;
    if (min !== "non") {
      const m = minorationSurface({ z, B, sol: sol1, simplifiee: min === "simple" });
      K *= m.pente; rmax *= m.palier;
    }
    return { K, rmax };
  };
  const fdr = pieuDifferencesFinies({ L, EI, H, M, tete, reaction, n: 240 });
  const Kf1 = moduleKf({ EM: c1.EM, B, alpha: c1.alpha }).Kf * facteur;
  const an = pieuLongAnalytique({ EI, Kf: Kf1, H, M, tete });
  const souple = pieuSouple({ L, l0: an.l0 });

  const yPts = fdr.z.map((z, i) => [fdr.y[i] * 1000, z]);
  const mPts = fdr.z.map((z, i) => [fdr.M[i], z]);
  const zVue = Math.min(L, Math.max(4 * an.l0, 6));
  const yMax = Math.max(...yPts.map((p) => Math.abs(p[0]))) * 1.15 || 1;
  const mMax = Math.max(...mPts.map((p) => Math.abs(p[0]))) * 1.15 || 1;
  const zoneCouche = h1 > 0 && h1 < zVue ? [{ y0: 0, y1: h1, couleur: "#dccab0", opacite: 0.3, libelle: "couche 1" }] : [];
  const g1 = graphe({
    largeur: 300, hauteur: 300, xmin: -yMax * 0.3, xmax: yMax, ymin: 0, ymax: zVue, inverserY: true,
    xlabel: "déplacement y (mm)", ylabel: "profondeur (m)", legende: false,
    zones: zoneCouche.map((z) => ({ ...z, x0: -yMax * 0.3, x1: yMax })),
    series: [{ points: yPts, couleur: COULEURS.bleu, epaisseur: 2.6 }],
  });
  const g2 = graphe({
    largeur: 300, hauteur: 300, xmin: -mMax, xmax: mMax, ymin: 0, ymax: zVue, inverserY: true,
    xlabel: "moment M (kN·m)", ylabel: "profondeur (m)", legende: false,
    zones: zoneCouche.map((z) => ({ ...z, x0: -mMax, x1: mMax })),
    series: [{ points: mPts, couleur: COULEURS.effort, epaisseur: 2.6 }],
  });
  el("laFig").innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">${g1}${g2}</div>`;

  // Rapport réaction / palier maximal le long du pieu.
  let ratio = 0, zRatio = 0;
  fdr.z.forEach((z, i) => {
    const { rmax } = reaction(z);
    const r = Math.abs(fdr.p[i]) / rmax;
    if (r > ratio) { ratio = r; zRatio = z; }
  });
  el("laOut").innerHTML = `
    <table class="resultats"><thead><tr><th>Grandeur</th><th class="num">Différences finies</th><th class="num">Pieu long, sol homogène (couche 1)</th></tr></thead><tbody>
      <tr><td>EI · K<sub>f</sub> couche 1${longue ? " (longue durée : K<sub>f</sub>/2)" : ""}</td><td class="n" colspan="2" style="text-align:center">${f(EI, 4)} kN·m² · ${f(Kf1, 4)} kPa</td></tr>
      <tr><td>Longueur de transfert l<sub>0</sub></td><td class="n">—</td><td class="n">${fd(an.l0, 2)} m ${souple ? "(L ≥ 3 l<sub>0</sub> : pieu souple)" : "(L &lt; 3 l<sub>0</sub> : la solution du pieu long ne vaut pas)"}</td></tr>
      <tr><td>Déplacement en tête y<sub>0</sub></td><td class="n"><strong>${fd(fdr.y0 * 1000, 2)} mm</strong></td><td class="n">${fd(an.y0 * 1000, 2)} mm</td></tr>
      <tr><td>Moment maximal</td><td class="n"><strong>${f(Math.abs(fdr.MMax), 4)} kN·m</strong> à ${fd(fdr.zMMax, 2)} m</td><td class="n">${f(an.MMax, 4)} kN·m à ${fd(an.zMax, 2)} m</td></tr>
      <tr><td>Réaction / palier</td><td class="n">${f(100 * Math.min(ratio, 1), 3)} % à ${fd(zRatio, 2)} m${fdr.plastifies ? ` · ${fdr.plastifies} nœuds au palier` : ""}</td><td class="n">élastique, sans palier</td></tr>
    </tbody></table>
    <p class="method-note">L'écart entre les deux colonnes mesure ce que la solution analytique ignore : la seconde couche,
      la minoration près de la surface${fdr.plastifies ? " et la plastification du sol, qui augmente le déplacement" : ""}.
      Le moment maximal se situe à une profondeur de l'ordre de l<sub>0</sub> : c'est là que le ferraillage du pieu doit être dimensionné.</p>`;
});
brancher(["laB", "laL", "laE", "laH", "laM", "laTete", "laDuree", "laMin", "laH1", "laSol1", "laEM1", "laA1", "laPf1", "laEM2", "laA2", "laPf2"], majLa);
