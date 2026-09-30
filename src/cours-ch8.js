// Calculateur du chapitre 8 : courbe de chargement d'un pieu par les lois de
// transfert de Frank et Zhao, avec la part de la pointe et du frottement, la
// charge limite et la charge de fluage des deux référentiels.
import { el, num, f, fd, brancher, garde } from "./ui.js";
import { graphe, COULEURS } from "./figures.js";
import { courbeChargement, coefficientsFrankZhao, loiFrankZhao } from "./geotech/tassement-pieu.js";

const majCc = garde("ccOut", () => {
  const B = num("ccB"), D = num("ccD"), Es = num("ccEs"), qs = num("ccQs"), Epte = num("ccEp"), qb = num("ccQb"), Ep = num("ccE");
  const sol = el("ccSol").value, refoulant = el("ccMise").value === "battu";
  if (!(B > 0 && D > 0 && Es > 0 && qs >= 0 && Epte > 0 && qb >= 0 && Ep > 0)) { el("ccOut").textContent = "Renseigner des valeurs positives."; return; }
  const couches = [{ z0: 0, z1: D, EM: Es, qs, sol }];
  const pointe = { EM: Epte, qb, sol };
  const r = courbeChargement({ B, D, Ep, couches, pointe, points: 60 });
  const Ab = (Math.PI * B * B) / 4, P = Math.PI * B;
  const Rb = Ab * qb, Rs = P * D * qs, Rc = Rb + Rs;
  const Qc = (refoulant ? 0.7 : 0.5) * Rb + 0.7 * Rs;
  const { kq } = coefficientsFrankZhao({ EM: Epte, B, sol });
  // Courbes en mm ; part de pointe à partir du déplacement de pointe sb.
  const tete = r.courbe.map((c) => [c.Q, c.s * 1000]);
  const partPointe = r.courbe.map((c) => [Ab * loiFrankZhao(c.sb, kq, qb), c.s * 1000]);
  const partFut = r.courbe.map((c) => [c.Q - Ab * loiFrankZhao(c.sb, kq, qb), c.s * 1000]);
  const sB10 = (B / 10) * 1000;
  const sQc = r.tassementSous(Qc);
  const smax = Math.min(Math.max(...tete.map((p) => p[1])), 1.6 * sB10);
  const QB10 = (() => {
    // charge atteinte pour un enfoncement de B/10 (interpolation sur la courbe)
    for (let i = 1; i < tete.length; i++) if (tete[i][1] >= sB10) {
      const [q0, s0] = tete[i - 1], [q1, s1] = tete[i];
      return q0 + ((q1 - q0) * (sB10 - s0)) / (s1 - s0);
    }
    return tete[tete.length - 1][0];
  })();
  el("ccFig").innerHTML = graphe({
    largeur: 560, hauteur: 300, xmin: 0, xmax: Rc * 1.1, ymin: 0, ymax: smax, inverserY: true,
    xlabel: "charge en tête Q (kN)", ylabel: "enfoncement de la tête (mm)",
    zones: [{ x0: 0, x1: Rc * 1.1, y0: sB10, y1: smax, couleur: COULEURS.discret, opacite: 0.08, libelle: "au-delà de B/10" }],
    series: [
      { points: tete, couleur: COULEURS.encre, epaisseur: 3, libelle: "charge en tête" },
      { points: partFut, couleur: COULEURS.ec7, tirets: "6 3", libelle: "frottement mobilisé" },
      { points: partPointe, couleur: COULEURS.f62, tirets: "6 3", libelle: "pointe mobilisée" },
    ],
    marques: [
      ...(sQc !== null ? [{ x: Qc, y: sQc * 1000, couleur: COULEURS.bleu, libelle: "Qc", guides: true }] : []),
      { x: QB10, y: sB10, couleur: COULEURS.rouge, libelle: "Qu (B/10)", guides: true },
    ],
  });
  const flottant = 0.7 * Rs > (refoulant ? 0.7 : 0.5) * Rb;
  const fracFut = sQc !== null ? (() => {
    const i = r.courbe.findIndex((c) => c.Q >= Qc);
    const c = r.courbe[Math.max(i, 1)];
    return (c.Q - Ab * loiFrankZhao(c.sb, kq, qb)) / c.Q;
  })() : null;
  el("ccOut").innerHTML = `
    <table class="resultats"><thead><tr><th>Grandeur</th><th class="num">Valeur</th></tr></thead><tbody>
      <tr><td>Résistance de pointe Q<sub>pu</sub> = A<sub>b</sub> q<sub>b</sub></td><td class="n">${f(Rb, 4)} kN</td></tr>
      <tr><td>Frottement Q<sub>su</sub> = P D q<sub>s</sub></td><td class="n">${f(Rs, 4)} kN</td></tr>
      <tr><td>Charge limite Q<sub>u</sub> = Q<sub>pu</sub> + Q<sub>su</sub></td><td class="n">${f(Rc, 4)} kN <small>courbe : ${f(QB10, 4)} kN à B/10 = ${fd(sB10, 0)} mm</small></td></tr>
      <tr><td>Charge de fluage Q<sub>c</sub> = ${refoulant ? "0,7" : "0,5"} Q<sub>pu</sub> + 0,7 Q<sub>su</sub></td><td class="n">${f(Qc, 4)} kN${sQc !== null ? ` <small>enfoncement ${fd(sQc * 1000, 1)} mm</small>` : ""}</td></tr>
    </tbody></table>
    <p class="method-note">${fracFut !== null ? `Sous Q<sub>c</sub>, le frottement porte ${f(100 * fracFut, 2)} % de la charge. ` : ""}Le pieu est
      <strong>${flottant ? "flottant" : "non flottant"}</strong> au sens du Fascicule 62 : sous la charge de fluage,
      0,7 Q<sub>su</sub> = ${f(0.7 * Rs, 4)} kN ${flottant ? "&gt;" : "≤"} ${refoulant ? "0,7" : "0,5"} Q<sub>pu</sub> = ${f((refoulant ? 0.7 : 0.5) * Rb, 4)} kN.
      ${QB10 >= 0.999 * Rc
        ? `À B/10 = ${fd(sB10, 0)} mm, pointe et frottement sont entièrement mobilisés : Q<sub>u</sub> est atteinte.`
        : `À B/10 = ${fd(sB10, 0)} mm, la courbe reste ${f(100 * (1 - QB10 / Rc), 2)} % sous Q<sub>pu</sub> + Q<sub>su</sub> : la pointe n'est pas entièrement mobilisée.`}</p>`;
});
brancher(["ccB", "ccD", "ccMise", "ccEs", "ccQs", "ccEp", "ccQb", "ccSol", "ccE"], majCc);
