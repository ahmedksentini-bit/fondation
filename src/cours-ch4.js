// Calculateur du chapitre 4 : les mêmes charges combinées au Fascicule 62 et
// à l'Eurocode 0, avec l'excentrement résultant de chaque combinaison.
import { el, num, f, brancher, garde } from "./ui.js";
import { combinaisonsF62, combinaisonsEC7 } from "./geotech/combinaisons.js";

const maj = garde("cbOut", () => {
  const G = { V: num("cbGV"), H: num("cbGH"), M: num("cbGM") };
  const Q = { V: num("cbQV"), H: num("cbQH"), M: num("cbQM") };
  const psi = { psi0: 0.7, psi1: num("cbPsi1"), psi2: num("cbPsi2") };
  const gQ1 = num("cbGQ");
  const a = combinaisonsF62({ G, Q, psi: { ...psi, psi0: 0.77 }, gQ1 });
  const b = combinaisonsEC7({ G, Q, psi, gQ1 });
  const ligne = (nomF, cF, nomE, cE) => `<tr>
      <td>${nomF}</td><td class="n">${f(cF.V, 4)}</td><td class="n">${f(cF.H, 3)}</td><td class="n">${f(cF.M, 4)}</td><td class="n">${f(cF.M / cF.V, 3)}</td>
      <td>${nomE}</td><td class="n">${f(cE.V, 4)}</td><td class="n">${f(cE.H, 3)}</td><td class="n">${f(cE.M, 4)}</td><td class="n">${f(cE.M / cE.V, 3)}</td></tr>`;
  el("cbOut").innerHTML = `<table class="resultats"><thead><tr>
      <th><span class="tag-f62">F62</span></th><th class="num">V</th><th class="num">H</th><th class="num">M</th><th class="num">e (m)</th>
      <th><span class="tag-ec7">EC7</span></th><th class="num">V</th><th class="num">H</th><th class="num">M</th><th class="num">e (m)</th></tr></thead><tbody>
      ${ligne("ELU fond.", a.ELU, "ELU fond.", b.ELU)}
      ${ligne("ELS rare", a.ELS_rare, "ELS caract.", b.ELS_car)}
      ${ligne("ELS fréq.", a.ELS_freq, "ELS fréq.", b.ELS_freq)}
      ${ligne("ELS QP", a.ELS_QP, "ELS QP", b.ELS_QP)}
    </tbody></table>
    <p class="method-note">Avec une seule action variable, les deux référentiels donnent les
       mêmes combinaisons : les différences apparaissent avec les actions d'accompagnement
       (1,3 ψ0 au Fascicule, 1,5 ψ0 à l'Eurocode) et, surtout, dans la manière de diviser la
       résistance. L'excentrement e = M/V, lui, n'est pas le même d'une combinaison à l'autre :
       c'est pourquoi il se vérifie combinaison par combinaison.</p>`;
});
brancher(["cbGV", "cbGH", "cbGM", "cbQV", "cbQH", "cbQM", "cbPsi1", "cbPsi2", "cbGQ"], maj);
