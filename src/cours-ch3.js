// Calculateurs du chapitre 3 : hauteur d'encastrement équivalente et
// excentrement (diagramme plan du Fascicule 62, largeur effective de l'EC7).
import { el, num, fd, f, verdict, brancher, garde } from "./ui.js";
import { coupeSemelle, figureContraintes, cote, COULEURS } from "./figures.js";
import { diagramme, FRACTION_MIN_F62, eLimiteF62, contrainteReferenceEC7 } from "./geotech/superficielles.js";

// ── De sous une couverture plus faible ──────────────────────────────────
const majDe = garde("deOut", () => {
  const D = num("deD"), plc = num("dePlc"), ple = num("dePle"), B = num("deB"), d = Math.max(num("ded", 0), 0);
  if (!(D > 0 && plc > 0 && ple > 0 && B > 0)) { el("deOut").textContent = "Renseigner D, B et les deux pressions limites."; el("deFig").innerHTML = ""; return; }
  if (d >= D) { el("deOut").textContent = "L'épaisseur écartée d doit rester inférieure à D."; return; }
  const De = (plc * (D - d)) / ple;
  const r = De / B;
  const type = r < 1.5 ? "superficielle" : r <= 5 ? "semi-profonde" : "profonde";
  const couches = [
    ...(d > 0 ? [{ z0: 0, z1: d, sol: "remblai", etiquette: "couche écartée" }] : []),
    { z0: d, z1: D, sol: "limon", etiquette: `pl* = ${fd(plc, 2)} MPa` },
    { z0: D, z1: D + 4 * B, sol: "sable", etiquette: `ple* = ${fd(ple, 2)} MPa` },
  ];
  el("deFig").innerHTML = coupeSemelle({
    B, D, couches, hauteur: 250, profondeurVue: Math.max(D + 1.6 * B, 3),
    annotations: [(id, { Y, xs, ws, P }) => {
      const haut = Math.max(D - De, -0.25);
      if (De > D) {
        P.texte([{ x: xs + ws + 22, y: Y(haut) - 4, ancre: "start" }, { x: xs + ws + 10, y: Y(haut) - 4, ancre: "end" }]
          .map((c) => ({ ...c, lignes: ["De > D"] })), `class="halo" style="font-size:11px;fill:${COULEURS.f62};font-weight:800"`, { taille: 11, priorite: 3 });
      }
      return cote(id, xs + ws + 16, Y(haut), xs + ws + 16, Y(D), `De = ${fd(De, 2)} m`, { P });
    }],
  });
  el("deOut").innerHTML =
    `D<sub>e</sub> = p<sub>l</sub>*·(D − d)/p<sub>le</sub>* = ${fd(plc, 2)} × ${fd(D - d, 2)} / ${fd(ple, 2)} = <strong>${fd(De, 2)} m</strong>
     · D<sub>e</sub>/B = <strong>${fd(r, 2)}</strong> → fondation <strong>${type}</strong>
     <small>D/B géométrique = ${fd(D / B, 2)} : c'est D<sub>e</sub>/B, et non D/B, qui entre dans k<sub>p</sub> et dans le classement.</small>`;
});
brancher(["deD", "dePlc", "dePle", "deB", "ded"], majDe);

// ── Excentrement : diagramme, q'ref et critères ─────────────────────────
const majExc = garde("exOut", () => {
  const B = num("exB"), V = num("exV"), M = num("exM", 0);
  if (!(B > 0 && V > 0)) { el("exOut").textContent = "Renseigner B et une charge V positive."; el("exFig").innerHTML = ""; return; }
  const e = Math.abs(M) / V;
  const d = diagramme({ B, V, e });
  if (!d.applicable) {
    el("exFig").innerHTML = "";
    el("exOut").innerHTML = `<p class="final-result">e = M/V = ${fd(e, 3)} m ≥ B/2 : ${verdict(false, "", d.motif)}</p>`;
    return;
  }
  el("exFig").innerHTML = figureContraintes({ B, V, e, qmax: d.qmax, qmin: d.qmin, Bc: d.Bc, qref: d.qrefTrapeze, meyerhof: d.qrefMeyerhof });
  const ie = 1 - (2 * e) / B;
  const lignes = [
    { nom: "ELU", frac: FRACTION_MIN_F62.ELU, lim: 1 / 15, limTxt: "1/15" },
    { nom: "ELS rare / caractéristique", frac: FRACTION_MIN_F62.ELS_rare, lim: 1 / 2, limTxt: "1/2" },
    { nom: "ELS fréquente / quasi permanente", frac: FRACTION_MIN_F62.ELS_freq, lim: 2 / 3, limTxt: "2/3" },
  ];
  const corps = lignes.map((l) => `<tr>
      <td>${l.nom}</td>
      <td class="n">${f(100 * d.fraction, 3)} % ≥ ${f(100 * l.frac, 3)} %<br>${verdict(d.fraction >= l.frac - 1e-9)}</td>
      <td class="n">${fd(ie, 3)} ≥ ${l.limTxt}<br>${verdict(ie >= l.lim - 1e-9)}</td>
      <td class="n">${fd(eLimiteF62(B, l.frac), 3)} m</td></tr>`).join("");
  const ref = contrainteReferenceEC7({ V, B, e });
  el("exOut").innerHTML = `
    <p class="final-result">e = M/V = ${fd(e, 3)} m · e/B = ${fd(e / B, 3)} → diagramme <strong>${d.trapeze ? "trapézoïdal" : "triangulaire"}</strong>
      <small>q'max = ${f(d.qmax, 4)} kPa · q'min = ${f(d.qmin, 4)} kPa ·
      q'ref (3/4) = <strong>${f(d.qrefTrapeze, 4)} kPa</strong> · Meyerhof V/B' = <strong>${f(d.qrefMeyerhof, 4)} kPa</strong> sur B' = ${fd(B - 2 * e, 2)} m</small></p>
    <table class="resultats"><thead><tr><th>Combinaison</th><th class="num"><span class="tag-f62">F62</span> surface comprimée</th>
      <th class="num"><span class="tag-ec7">EC7</span> 1 − 2e/B</th><th class="num">e maximal</th></tr></thead><tbody>${corps}</tbody></table>
    <p class="method-note">Les deux colonnes donnent toujours le même verdict : c'est l'équivalence démontrée plus haut.
      Pour le ferraillage, la contrainte de référence de l'annexe G vaut ${f(ref.sigma, 4)} kPa (${ref.forme}).
      ${e > B / 3 ? "<br><strong>e &gt; B/3</strong> : la NF P94-261 demande alors de vérifier la sensibilité aux tolérances d'exécution (décalage défavorable de 10 cm)." : ""}</p>`;
});
brancher(["exB", "exV", "exM"], majExc);
