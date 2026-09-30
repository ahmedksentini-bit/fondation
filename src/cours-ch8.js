// Calculateurs du chapitre 8 : glissement au Fascicule 62 et à la NF P94-261
// (drainé et non drainé), paramètres de calcul de la stabilité d'ensemble.
import { el, num, f, fd, verdict, brancher, garde } from "./ui.js";
import { coupeSemelle, fleche } from "./figures.js";
import { glissementF62, glissementEC7, diagramme } from "./geotech/superficielles.js";

const RAD = Math.PI / 180;

const majGl = garde("glOut", () => {
  const B = num("glB"), e = Math.abs(num("glE", 0)), V = num("glV"), H = Math.abs(num("glH", 0));
  const phi = num("glPhi"), phiC = num("glPhiC"), c = Math.max(num("glC", 0), 0), cu = num("glCu", 0);
  const prefa = el("glMise").value === "prefa";
  if (!(B > 0 && V > 0 && phi > 0 && phiC > 0)) { el("glOut").textContent = "Renseigner B, Vd, φ' et φ'crit."; return; }
  const d = diagramme({ B, V, e });
  if (!d.applicable || e >= B / 2) { el("glOut").innerHTML = verdict(false, "", "résultante hors de la semelle"); return; }
  const Ac = d.Bc;            // F62 : surface comprimée (par mètre)
  const Ap = B - 2 * e;       // EC7 : surface effective de Meyerhof
  const f62 = glissementF62({ Vd: V, Hd: H, phi, c, Aprime: Ac });
  const dr = glissementEC7({ Vd: V, Hd: H, drainage: "draine", phiCrit: phiC, prefabrique: prefa });
  const nd = cu > 0 ? glissementEC7({ Vd: V, Hd: H, drainage: "non-draine", cu, Aprime: Ap }) : null;

  el("glFig").innerHTML = coupeSemelle({
    B, D: 1, e, V: "Vd", H, hauteur: 240, profondeurVue: 3, epaisseur: 0.5, decalageCoteB: 36,
    couches: [{ z0: 0, z1: 20, sol: "argile", position: "bas", etiquette: `φ' ${f(phi, 3)}° · φ'crit ${f(phiC, 3)}° · c' ${f(c, 3)} kPa` }],
    // Réaction de frottement sous la base, opposée à H ; la cote B est descendue d'autant.
    annotations: [(id, { Y, xs, ws, P }) =>
      fleche(id, xs + ws * 0.8, Y(1) + 11, xs + ws * 0.2, Y(1) + 11, { type: "reaction", libelle: "R (frottement)", ep: 2.6, P })],
  });

  const col = (x) => `<td class="n">${x}</td>`;
  el("glOut").innerHTML = `
    <div class="table-large"><table class="resultats"><thead><tr><th>Terme</th>
      <th class="num"><span class="tag-f62">F62</span> drainé</th><th class="num"><span class="tag-ec7">EC7</span> drainé</th><th class="num"><span class="tag-ec7">EC7</span> non drainé</th></tr></thead><tbody>
      <tr><td>Surface</td>${col(`comprimée ${fd(Ac, 2)} m²/m`)}${col("—")}${col(`A' = B − 2e = ${fd(Ap, 2)} m²/m`)}</tr>
      <tr><td>Frottement</td>${col(`V tan${f(phi, 3)}°/1,2 = ${fd(f62.Rf, 1)}`)}${col(`V tan${f(dr.delta, 3)}°/1,21 = ${fd(dr.Rhd, 1)}`)}${col("—")}</tr>
      <tr><td>Cohésion</td>${col(`c'A'/1,5 = ${fd(f62.Rc, 1)}${f62.cPlafonnee ? " (c' limitée à 75 kPa)" : ""}`)}${col("négligée")}${col(nd ? `A'c<sub>u</sub>/1,21 = ${fd(nd.termeCohesion, 1)} ; 0,4 V = ${fd(nd.plafond, 1)}` : "c<sub>u</sub> non renseignée")}</tr>
      <tr><td>Résistance (kN/m)</td>${col(`<strong>${fd(f62.R, 1)}</strong>`)}${col(`<strong>${fd(dr.R, 1)}</strong>`)}${col(nd ? `<strong>${fd(nd.R, 1)}</strong>` : "—")}</tr>
      <tr><td>Taux H<sub>d</sub>/R</td>${col(`${fd(f62.taux, 2)} ${verdict(f62.ok)}`)}${col(`${fd(dr.taux, 2)} ${verdict(dr.ok)}`)}${col(nd ? `${fd(nd.taux, 2)} ${verdict(nd.ok)}` : "—")}</tr>
    </tbody></table></div>
    <p class="method-note">Coefficient de frottement de calcul : ${fd(Math.tan(phi * RAD) / 1.2, 3)} au Fascicule 62 contre
      ${fd(Math.tan(dr.delta * RAD) / 1.21, 3)} à l'Eurocode 7${prefa ? " (semelle préfabriquée : δ = 2/3 φ'crit)" : ""}.
      ${nd && !nd.ok ? "À court terme, la semelle glisse : au Fascicule 62, on y remédierait par une disposition constructive (bêche, butons) plutôt qu'en l'élargissant." : ""}</p>`;
});
brancher(["glB", "glE", "glMise", "glV", "glH", "glCu", "glPhi", "glPhiC", "glC"], majGl);

const majSe = garde("seOut", () => {
  const phi = num("sePhi"), c = Math.max(num("seC", 0), 0), cu = num("seCu", 0);
  if (!(phi >= 0)) { el("seOut").textContent = "Renseigner φ'."; return; }
  const t = Math.tan(phi * RAD);
  const phiF = Math.atan(t / 1.2) / RAD, phiE = Math.atan(t / 1.25) / RAD;
  el("seOut").innerHTML = `<table class="resultats"><thead><tr><th>Paramètre</th><th class="num"><span class="tag-f62">F62</span> B.3.6</th><th class="num"><span class="tag-ec7">EC7</span> approche 3</th></tr></thead><tbody>
      <tr><td>φ<sub>d</sub></td><td class="n">atan(tan${f(phi, 3)}°/1,20) = <strong>${fd(phiF, 1)}°</strong></td><td class="n">atan(tan${f(phi, 3)}°/1,25) = <strong>${fd(phiE, 1)}°</strong></td></tr>
      <tr><td>c<sub>d</sub> (kPa)</td><td class="n">${f(c, 3)}/1,50 = <strong>${fd(c / 1.5, 1)}</strong></td><td class="n">${f(c, 3)}/1,25 = <strong>${fd(c / 1.25, 1)}</strong></td></tr>
      <tr><td>c<sub>u,d</sub> (kPa)</td><td class="n">${f(cu, 3)}/1,50 = <strong>${fd(cu / 1.5, 1)}</strong></td><td class="n">${f(cu, 3)}/1,40 = <strong>${fd(cu / 1.4, 1)}</strong></td></tr>
    </tbody></table>
    <p class="method-note">Le Fascicule 62 est plus sévère sur la cohésion, l'Eurocode sur le frottement. Dans l'approche 3,
      les actions géotechniques (poids du sol, surcharges sur le terrain) sont prises avec γ<sub>G</sub> = 1,0 et γ<sub>Q</sub> = 1,3 ;
      les charges venant de la structure gardent 1,35 et 1,5.</p>`;
});
brancher(["sePhi", "seC", "seCu"], majSe);
