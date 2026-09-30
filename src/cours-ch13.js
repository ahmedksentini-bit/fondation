// Calculateur du chapitre 13 : portance sismique d'une semelle filante par
// l'annexe F de la NF EN 1998-5, avec la coupe de la surface limite dans le
// plan (N̄, M̄) pour le V̄ du projet, comparée au cas sans inertie du sol.
import { el, num, f, fd, verdict, brancher, garde } from "./ui.js";
import { graphe, COULEURS } from "./figures.js";
import { nmaxCoherent, nmaxFrottant, inertieSol, portanceSismique, coupeSurfaceLimite } from "./geotech/sismique.js";

const maj = garde("szOut", () => {
  const sol = el("szSol").value;
  const B = num("szB"), gamma = num("szGam"), cu = num("szCu"), phi = num("szPhi"), gammaRd = num("szRd", 1);
  const alphaG = num("szAg", 0), S = num("szS", 1), avg = num("szAv", 0);
  const N = num("szN"), V = num("szV", 0), M = num("szM", 0);
  el("szCu").closest(".field").style.display = sol === "coherent" ? "" : "none";
  el("szPhi").closest(".field").style.display = sol === "frottant" ? "" : "none";
  el("szAv").closest(".field").style.display = sol === "frottant" ? "" : "none";
  if (!(B > 0 && gamma > 0 && N > 0 && (sol === "coherent" ? cu > 0 : phi > 0))) { el("szOut").textContent = "Renseigner B, γ, N et la résistance du sol."; return; }
  let Nmax, Fb, detail;
  if (sol === "coherent") {
    Nmax = nmaxCoherent({ cu, B, gammaM: 1.4 });
    Fb = inertieSol({ sol, gamma, alphaG, S, B, cu, gammaM: 1.4 });
    detail = `N<sub>max</sub> = (π + 2) (c<sub>u</sub>/1,4) B = 5,142 × ${f(cu / 1.4, 4)} × ${fd(B, 2)} = ${f(Nmax, 4)} kN/m ·
      F̄ = γ (a<sub>g</sub>/g) S B / c̄ = ${f(gamma, 3)} × ${fd(alphaG, 3)} × ${fd(S, 2)} × ${fd(B, 2)} / ${f(cu / 1.4, 4)} = ${fd(Fb, 3)}`;
  } else {
    const n = nmaxFrottant({ gamma, B, phi, gammaPhi: 1.25, avg });
    Nmax = n.Nmax;
    Fb = inertieSol({ sol, alphaG, phiD: n.phiD });
    detail = `φ'<sub>d</sub> = ${fd(n.phiD, 2)}° · N<sub>γ</sub> = ${fd(n.Ngamma, 2)} · N<sub>max</sub> = ½ γ (1 − a<sub>v</sub>/g) B² N<sub>γ</sub> = ${f(Nmax, 4)} kN/m ·
      F̄ = (a<sub>g</sub>/g)/tanφ'<sub>d</sub> = ${fd(Fb, 3)}`;
  }
  const r = portanceSismique({ sol, N, V, M, B, Nmax, Fb, gammaRd });
  if (!r.applicable) { el("szOut").innerHTML = `<p class="final-result">${detail}<br>${verdict(false, "", r.motif)}</p>`; el("szFig").innerHTML = ""; return; }
  const coupe = coupeSurfaceLimite({ sol, Fb, Vb: Math.min(Math.abs(r.Vb), 0.99) });
  const ref = coupeSurfaceLimite({ sol, Fb: 0, Vb: 0 });
  const ymax = Math.max(...ref.points.map((p) => p[1]), r.Mb) * 1.2;
  el("szFig").innerHTML = graphe({
    largeur: 560, hauteur: 290, xmin: 0, xmax: 1, ymin: 0, ymax, xlabel: "N̄ = γRd N / Nmax", ylabel: "M̄ = γRd M / (B Nmax)",
    series: [
      { points: ref.points, couleur: COULEURS.discret, tirets: "6 4", libelle: "sans inertie du sol, V̄ = 0" },
      { points: coupe.points, couleur: COULEURS.ec7, epaisseur: 2.8, libelle: `surface limite (F̄ = ${fd(Fb, 2)}, V̄ = ${fd(r.Vb, 3)})` },
    ],
    marques: [{ x: Math.min(r.Nb, 1), y: r.Mb, couleur: r.ok ? COULEURS.reaction : COULEURS.rouge, libelle: "projet", guides: true }],
  });
  el("szOut").innerHTML = `
    <p class="method-note">${detail}</p>
    <table class="resultats"><thead><tr><th>Grandeur</th><th class="num">Valeur</th></tr></thead><tbody>
      <tr><td>N̄ · V̄ · M̄</td><td class="n">${fd(r.Nb, 3)} · ${fd(r.Vb, 3)} · ${fd(r.Mb, 3)}</td></tr>
      <tr><td>Condition 0 &lt; N̄ ≤ (1 − m F̄<sup>k</sup>)<sup>k'</sup> = ${fd(r.lim, 3)}</td><td class="n">${verdict(r.conditionN, "respectée", "non respectée")}</td></tr>
      <tr><td>Condition |V̄| ≤ 1</td><td class="n">${verdict(r.conditionV, "respectée", "non respectée")}</td></tr>
      <tr><td>Termes de l'inégalité F.1 (effort · moment)</td><td class="n">${Number.isFinite(r.t1) ? `${fd(r.t1, 3)} + ${fd(r.t2, 3)} − 1 = ${fd(r.valeur, 3)}` : "—"}</td></tr>
      <tr class="${r.ok ? "" : "ko"}"><td><strong>Portance sismique</strong></td><td class="n">${verdict(r.ok)}</td></tr>
    </tbody></table>`;
});
brancher(["szSol", "szB", "szGam", "szCu", "szPhi", "szRd", "szAg", "szS", "szAv", "szN", "szV", "szM"], maj);
