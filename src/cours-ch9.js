// Calculateur du chapitre 9 : portance d'un pieu isolé au Fascicule 62
// (annexes C.3 et C.4) et à la NF P94-262 (annexes F et G), sur un même
// profil de sol saisi en couches.
import { el, num, f, fd, esc, verdict, brancher, garde } from "./ui.js";
import { graphe, COULEURS } from "./figures.js";
import { pieuF62, valeursLimitesEC7, intervallePointe } from "./geotech/pieux.js";
import { CLASSES_F62, CATEGORIES_EC7 } from "./geotech/sols.js";

const DEFAUT = [
  { base: 5, classe: "argile-A", sol: "argile", pl: 0.5, qc: 1.2 },
  { base: 12, classe: "sable-B", sol: "sable", pl: 1.5, qc: 10 },
  { base: 30, classe: "marne-A", sol: "marne", pl: 2.5, qc: 8 },
  { base: "", classe: "sable-C", sol: "sable", pl: 3, qc: 20 },
];

const optionsClasses = (choisie) => Object.entries(CLASSES_F62)
  .map(([k, c]) => `<option value="${k}"${k === choisie ? " selected" : ""}>${esc(c.nom)} (${c.lettre})</option>`).join("");
const optionsCategories = (choisie) => Object.entries(CATEGORIES_EC7)
  .map(([k, c]) => `<option value="${k}"${k === choisie ? " selected" : ""}>${esc(c.nom)}</option>`).join("");

el("piCouches").innerHTML = DEFAUT.map((c, i) => `<tr>
    <td>${i + 1}</td>
    <td><input id="piZ${i}" type="text" inputmode="decimal" value="${c.base}" style="width:5em" aria-label="Base de la couche ${i + 1}"></td>
    <td><select id="piC${i}" aria-label="Classe F62 de la couche ${i + 1}">${optionsClasses(c.classe)}</select></td>
    <td><select id="piS${i}" aria-label="Catégorie EC7 de la couche ${i + 1}">${optionsCategories(c.sol)}</select></td>
    <td><input id="piPl${i}" type="text" inputmode="decimal" value="${c.pl}" style="width:4.5em" aria-label="pl* de la couche ${i + 1}"></td>
    <td><input id="piQc${i}" type="text" inputmode="decimal" value="${c.qc}" style="width:4.5em" aria-label="qc de la couche ${i + 1}"></td>
  </tr>`).join("");

/** Couches actives : une couche compte si sa base dépasse la précédente. */
function lireCouches() {
  const couches = [];
  let z = 0;
  for (let i = 0; i < DEFAUT.length; i++) {
    const base = num(`piZ${i}`);
    if (!(base > z)) continue;
    couches.push({ z0: z, z1: base, classe: el(`piC${i}`).value, sol: el(`piS${i}`).value, pl: num(`piPl${i}`), qc: num(`piQc${i}`) });
    z = base;
  }
  return couches;
}

const majPi = garde("piOut", () => {
  const [typeF62, cat] = el("piType").value.split("|");
  const B = num("piB"), D = num("piD"), methode = el("piMeth").value;
  const couches = lireCouches();
  if (!(B > 0 && D > 0 && couches.length)) { el("piOut").textContent = "Renseigner B, D et au moins une couche."; return; }
  const cle = methode === "pressio" ? "pl" : "qc";
  if (couches.some((c) => !(c[cle] > 0))) { el("piOut").textContent = `Renseigner ${methode === "pressio" ? "pl*" : "qc"} dans chaque couche.`; return; }
  const bas = couches[couches.length - 1].z1;
  if (D >= bas) { el("piOut").textContent = `La dernière couche doit descendre sous la pointe (au moins jusqu'à ${fd(D + 3 * Math.max(B / 2, 0.5), 2)} m).`; return; }

  const r62 = pieuF62({ methode, type: typeF62, B, D, couches });
  const r7 = valeursLimitesEC7({ methode, cat: Number(cat), B, D, couches });

  // Figure : qs(z) des deux référentiels, couches et intervalle de pointe.
  const zMax = Math.min(bas, D + 3 * Math.max(B / 2, 0.5) + 2);
  const serie = (lignes, cleQs) => lignes.flatMap((l) => [[l[cleQs], l.z0], [l[cleQs], l.z1]]);
  const series = [];
  if (r62.applicable) series.push({ points: serie(r62.lignes, "qs"), couleur: COULEURS.f62, epaisseur: 2.6, libelle: "qs Fascicule 62" });
  if (r7.applicable) series.push({ points: serie(r7.lignes, "qs"), couleur: COULEURS.ec7, epaisseur: 2.6, tirets: "6 3", libelle: "qs NF P94-262" });
  const qsMax = Math.max(10, ...series.flatMap((s) => s.points.map((p) => p[0]))) * 1.25;
  const porteuse = couches.find((c) => D - 1e-9 >= c.z0 && D - 1e-9 < c.z1) ?? couches[couches.length - 1];
  const I = intervallePointe({ B, D, h: D - porteuse.z0 });
  const teintes = ["#dccab0", "#f3e5ae", "#cfd8c7", "#e3d3a0"];
  el("piFig").innerHTML = graphe({
    largeur: 560, hauteur: 320, xmin: 0, xmax: qsMax, ymin: 0, ymax: zMax, inverserY: true,
    xlabel: "frottement unitaire qs (kPa)", ylabel: "profondeur (m)",
    zones: [
      ...couches.map((c, i) => ({ x0: 0, x1: qsMax, y0: c.z0, y1: Math.min(c.z1, zMax), couleur: teintes[i % 4], opacite: 0.45, position: "droite",
        libelle: `F62 ${c.classe.replace("-", " ")} · EC7 ${CATEGORIES_EC7[c.sol].nom.split(" (")[0].toLowerCase()}` })),
      { x0: qsMax * 0.72, x1: qsMax, y0: I.z0, y1: I.z1, couleur: COULEURS.rouge, opacite: 0.18, libelle: "pointe", position: "droite" },
    ],
    series,
  });

  const cellule = (r, fn) => (r.applicable ? fn(r) : "—");
  const motif = (r) => (r.applicable ? "" : `<br><span class="verdict ko">non applicable</span> <small>${esc(r.motif)}</small>`);
  let lignesFrot = "";
  couches.forEach((c) => {
    const a = Math.max(c.z0, 0), b = Math.min(c.z1, D);
    if (b <= a) return;
    const l62 = r62.applicable ? r62.lignes.find((l) => Math.abs(l.z0 - a) < 1e-9) : null;
    const l7 = r7.applicable ? r7.lignes.filter((l) => l.z0 >= a - 1e-9 && l.z1 <= b + 1e-9) : [];
    const t7 = l7.map((l) => `${f(l.qs, 3)} kPa <small>α = ${fd(l.alpha, 2)} · f<sub>sol</sub> = ${f(l.fsol, 3)} · q<sub>s,max</sub> = ${f(l.qsmax, 3)}${l.plafonne ? " (plafond)" : ""}${l.reductions.length ? " · " + l.reductions.join(", ") : ""}</small>`).join("<br>");
    lignesFrot += `<tr><td>q<sub>s</sub> de ${fd(a, 1)} à ${fd(b, 1)} m</td>
      <td class="n">${l62 ? `${f(l62.qs, 3)} kPa <small>${l62.courbe ? `courbe Q${l62.courbe}` : `β, q<sub>s,max</sub>`}${l62.remarque ? " · " + esc(l62.remarque) : ""}</small>` : "—"}</td>
      <td class="n">${t7 || "—"}</td></tr>`;
  });
  const QcF = r62.applicable ? r62.Qc : NaN;
  const Rccr = r7.applicable ? (r7.refoulement ? 0.7 : 0.5) * r7.Rb + 0.7 * r7.Rs : NaN;
  el("piOut").innerHTML = `
    <div class="table-large"><table class="resultats"><thead><tr><th>Grandeur</th>
      <th class="num"><span class="tag-f62">Fascicule 62</span>${motif(r62)}</th><th class="num"><span class="tag-ec7">NF P94-262</span>${motif(r7)}</th></tr></thead><tbody>
      <tr><td>Intervalle de pointe [D − b ; D + 3a]</td><td class="n" colspan="2" style="text-align:center">[${fd(I.z0, 2)} ; ${fd(I.z1, 2)}] m · a = ${fd(I.a, 2)} · b = ${fd(I.b, 2)}</td></tr>
      <tr><td>${methode === "pressio" ? "p<sub>le</sub>*" : "q<sub>ce</sub>"} (MPa)</td><td class="n">${cellule(r62, (r) => fd(r.qEquiv, 3))}</td><td class="n">${cellule(r7, (r) => fd(methode === "pressio" ? r.pointe.ple : r.pointe.qce, 3))}</td></tr>
      <tr><td>Encastrement effectif</td><td class="n">—</td><td class="n">${cellule(r7, (r) => `D<sub>ef</sub> = ${fd(r.pointe.Def, 2)} m · D<sub>ef</sub>/B = ${fd(r.pointe.DefB, 2)}`)}</td></tr>
      <tr><td>Facteur de portance</td><td class="n">${cellule(r62, (r) => `${methode === "pressio" ? "k<sub>p</sub>" : "k<sub>c</sub>"} = ${fd(r.kPointe, 2)} <small>${r.refoulement ? "avec" : "sans"} refoulement</small>`)}</td>
        <td class="n">${cellule(r7, (r) => `${methode === "pressio" ? "k<sub>p</sub>" : "k<sub>c</sub>"} = ${fd(r.pointe.k, 3)} <small>max ${fd(r.pointe.kmax, 2)}</small>`)}</td></tr>
      <tr><td>Contrainte de pointe (kPa)</td><td class="n">${cellule(r62, (r) => f(r.qu, 4))}</td><td class="n">${cellule(r7, (r) => f(r.pointe.qb, 4))}</td></tr>
      <tr><td>Pointe Q<sub>pu</sub> · R<sub>b</sub> (kN)</td><td class="n">${cellule(r62, (r) => f(r.Qpu, 4))}</td><td class="n">${cellule(r7, (r) => f(r.Rb, 4))}</td></tr>
      ${lignesFrot}
      <tr><td>Frottement Q<sub>su</sub> · R<sub>s</sub> (kN)</td><td class="n">${cellule(r62, (r) => f(r.Qsu, 4))}</td><td class="n">${cellule(r7, (r) => f(r.Rs, 4))}</td></tr>
      <tr><td><strong>Charge limite Q<sub>u</sub> · R<sub>c</sub> (kN)</strong></td><td class="n"><strong>${cellule(r62, (r) => f(r.Qu, 4))}</strong></td><td class="n"><strong>${cellule(r7, (r) => f(r.Rc, 4))}</strong></td></tr>
      <tr><td>Charge de fluage Q<sub>c</sub> · R<sub>c;cr</sub> (kN)</td><td class="n">${f(QcF, 4)}</td><td class="n">${f(Rccr, 4)} <small>sur les valeurs calculées, avant coefficients de modèle</small></td></tr>
    </tbody></table></div>
    ${r7.applicable && r7.avertissements.length ? `<p class="method-note">${r7.avertissements.map(esc).join("<br>")}</p>` : ""}
    ${r62.applicable && r7.applicable ? `<p class="method-note">Écart sur la charge limite : ${r7.Rc >= r62.Qu ? "+" : ""}${f(100 * (r7.Rc / r62.Qu - 1), 2)} % (pointe ${f(100 * (r7.Rb / r62.Qpu - 1), 2)} %, frottement ${f(100 * (r7.Rs / r62.Qsu - 1), 2)} %).
      Ces valeurs ne sont pas encore des résistances de calcul : le chapitre 10 leur applique les coefficients de chaque référentiel.</p>` : ""}`;
});
const ids = ["piType", "piB", "piD", "piMeth"];
for (let i = 0; i < DEFAUT.length; i++) ids.push(`piZ${i}`, `piC${i}`, `piS${i}`, `piPl${i}`, `piQc${i}`);
brancher(ids, majPi);
