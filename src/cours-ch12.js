// Calculateur du chapitre 12 : des valeurs calculées (Rb, Rs) aux valeurs
// caractéristiques puis de calcul de la NF P94-262 (modèle de terrain ou pieu
// modèle), comparées aux Qmax du Fascicule 62 sur les mêmes valeurs limites.
import { el, num, f, fd, esc, verdict, brancher, garde } from "./ui.js";
import { CATEGORIES_PIEUX_EC7, categoriePieu, modeleTerrain, pieuModele, limitesF62 } from "./geotech/pieux.js";

el("juCat").innerHTML = CATEGORIES_PIEUX_EC7
  .map((c) => `<option value="${c.cat}"${c.cat === 6 ? " selected" : ""}>${c.cat} · ${esc(c.nom)}</option>`).join("");

const majJu = garde("juOut", () => {
  const Rb = Math.max(num("juRb", 0), 0), Rs = Math.max(num("juRs", 0), 0);
  const methode = el("juMeth").value, cat = Number(el("juCat").value), craie = el("juCraie").value === "oui";
  const proc = el("juProc").value, N = Math.max(1, Math.round(num("juN", 1))), S = num("juS", 100), raide = el("juRaide").value === "oui";
  const F = { ELU: num("juFu"), car: num("juFc"), qp: num("juFq") };
  el("juN").closest(".field").style.display = proc === "modele" ? "" : "none";
  el("juS").closest(".field").style.display = proc === "modele" ? "" : "none";
  el("juRaide").closest(".field").style.display = proc === "modele" ? "" : "none";
  if (!(Rb + Rs > 0)) { el("juOut").textContent = "Renseigner Rb et Rs."; return; }
  const pc = categoriePieu(cat);
  const limites = { applicable: true, methode, categorie: pc, craie, refoulement: pc.refoulement, Rb, Rs, Rc: Rb + Rs, Rt: Rs };
  // Le pieu modèle est ici calculé comme N sondages identiques : c'est la
  // borne supérieure de ce que N sondages apportent (moyenne = minimum).
  const r = proc === "terrain" ? modeleTerrain(limites) : pieuModele({ resultats: Array(N).fill(limites), S, raide });
  const Qc = (pc.refoulement ? 0.7 : 0.5) * Rb + 0.7 * Rs;
  const f62 = limitesF62({ Qu: Rb + Rs, Qc, Qtu: Rs, Qtc: 0.7 * Rs });
  const d = r.calcul;
  const ligne = (etat, F62val, ec7val, Fd, detail) => {
    const okF = Fd <= F62val + 1e-9, okE = Fd <= ec7val + 1e-9;
    return `<tr class="${okF && okE ? "" : "ko"}"><td>${etat}</td><td class="n">${f(Fd, 4)}</td>
      <td class="n">${f(F62val, 4)} ${verdict(okF)}</td><td class="n">${f(ec7val, 4)} ${verdict(okE)}<br><small>${detail}</small></td>
      <td class="n">${fd((Rb + Rs) / ec7val, 2)}</td></tr>`;
  };
  const facteurs = proc === "terrain"
    ? `γ<sub>R;d1</sub> = ${fd(r.gRd1c, 2)} (compression), ${fd(r.gRd1t, 2)} (traction) · γ<sub>R;d2</sub> = ${fd(r.gRd2, 1)}`
    : `N = ${N} · S retenue = ${f(r.Sretenue, 4)} m² · ξ<sub>3</sub> = ${fd(r.xiMoy, 3)} · ξ<sub>4</sub> = ${fd(r.xiMin, 3)} (ξ' = ${fd(r.xiPrime[0], 2)} ; ${fd(r.xiPrime[1], 2)}) · γ<sub>R;d1</sub> = ${fd(r.gRd1c, 2)}`;
  el("juOut").innerHTML = `
    <p class="final-result">R<sub>c;k</sub> = <strong>${f(r.Rck, 4)} kN</strong> (R<sub>b;k</sub> = ${f(r.Rbk, 4)} ; R<sub>s;k</sub> = ${f(r.Rsk, 4)})
      · R<sub>c;cr;k</sub> = ${f(r.Rccrk, 4)} kN · R<sub>t;k</sub> = ${f(r.Rtk, 4)} kN
      <small>${r.procedure} — ${facteurs}</small></p>
    <div class="table-large"><table class="resultats"><thead><tr><th>État limite</th><th class="num">F<sub>c;d</sub> (kN)</th>
      <th class="num"><span class="tag-f62">F62</span> Q<sub>max</sub></th><th class="num"><span class="tag-ec7">EC7</span> résistance de calcul</th><th class="num">R<sub>c</sub>/résistance</th></tr></thead><tbody>
      ${ligne("ELU fondamental", f62.ELU.Qmax, d.ELU.Rcd, F.ELU, "R<sub>c;d</sub> = R<sub>c;k</sub>/1,1")}
      ${ligne("ELS rare / caractéristique", f62.ELS_rare.Qmax, d.ELS_car.Rccrd, F.car, "R<sub>c;cr;d</sub> = R<sub>c;cr;k</sub>/0,9")}
      ${ligne("ELS quasi permanent", f62.ELS_QP.Qmax, d.ELS_QP.Rccrd, F.qp, "R<sub>c;cr;d</sub> = R<sub>c;cr;k</sub>/1,1")}
    </tbody></table></div>
    <p class="method-note">La dernière colonne est le coefficient global que la norme applique à R<sub>c</sub> pour ce pieu :
      à comparer au 1,4 du Fascicule 62 à l'ELU (charge limite) — ici ${fd((Rb + Rs) / d.ELU.Rcd, 2)}.
      ${craie && pc.classe !== "1bis" && pc.classe !== 8 ? "La pointe dans la craie relève γ<sub>R;d1</sub> : les méthodes y sont moins fiables." : ""}
      ${proc === "modele" ? "Avec des sondages tous identiques, la moyenne égale le minimum : c'est ξ<sub>3</sub> qui gouverne ; des sondages dispersés feraient intervenir ξ<sub>4</sub>." : ""}
      Traction : F62 Q<sub>tu</sub>/1,4 = ${f(Rs / 1.4, 4)} kN, EC7 R<sub>t;d</sub> = ${f(d.ELU.Rtd, 4)} kN.</p>`;
});
brancher(["juRb", "juRs", "juMeth", "juCat", "juCraie", "juProc", "juN", "juS", "juRaide", "juFu", "juFc", "juFq"], majJu);
