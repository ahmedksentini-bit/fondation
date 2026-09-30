// Calculateurs du chapitre 6 : moyenne géométrique de pl*, facteurs de
// portance des deux référentiels et vérification d'une semelle au Fascicule 62
// et à la NF P94-261 sur les mêmes données.
import { el, num, f, fd, verdict, brancher, garde } from "./ui.js";
import { graphe, echantillon, coupeSemelle, COULEURS } from "./figures.js";
import { profilCouches } from "./geotech/outils.js";
import * as S from "./geotech/superficielles.js";
import { CLASSES_F62 } from "./geotech/sols.js";

const famille = (classe) => classe.split("-")[0];

/** Profil de pl* par couches, en profil { fn, ruptures } pour les intégrales. */
function profilPl(couches) {
  const p = profilCouches(couches.filter((c) => c.z1 > c.z0));
  return { fn: p.fn("pl"), ruptures: p.ruptures };
}

// ── Moyenne géométrique ou arithmétique ─────────────────────────────────
const majPle = garde("pleOut", () => {
  const B = num("pleB"), h1 = Math.max(num("pleH1", 0), 0), p1 = num("plePl1"), h2 = Math.max(num("pleH2", 0), 0), p2 = num("plePl2"), p3 = num("plePl3");
  if (!(B > 0 && p1 > 0 && p2 > 0 && p3 > 0)) { el("pleOut").textContent = "Renseigner B et des pressions limites positives."; return; }
  const hr = 1.5 * B;
  const zBas = Math.max(hr, h1 + h2) * 1.25 + 0.5;
  const couches = [
    { z0: 0, z1: h1, pl: p1 }, { z0: h1, z1: h1 + h2, pl: p2 }, { z0: h1 + h2, z1: zBas + 20, pl: p3 },
  ].filter((c) => c.z1 > c.z0);
  const profil = profilPl(couches);
  const g = S.moyenneGeometrique(profil, 0, hr);
  const a = S.moyenneArithmetique(profil, 0, hr);
  const parts = couches
    .map((c) => ({ ...c, h: Math.max(0, Math.min(c.z1, hr) - c.z0) }))
    .filter((c) => c.h > 1e-9);
  const escalier = couches.flatMap((c) => [[c.pl, c.z0], [c.pl, Math.min(c.z1, zBas)]]);
  const xmax = Math.max(p1, p2, p3) * 1.2;
  el("pleFig").innerHTML = graphe({
    largeur: 560, hauteur: 260, xmin: 0, xmax, ymin: 0, ymax: zBas, inverserY: true,
    xlabel: "pl* (MPa)", ylabel: "profondeur sous la base (m)",
    zones: [{ x0: 0, x1: xmax, y0: 0, y1: hr, couleur: COULEURS.bleu, opacite: 0.07, libelle: `hr = 1,5 B = ${fd(hr, 2)} m` }],
    series: [
      { points: escalier, couleur: COULEURS.trait, libelle: "profil pl*" },
      { points: [[g, 0], [g, hr]], couleur: COULEURS.ec7, epaisseur: 3, libelle: `géométrique ${fd(g, 2)}` },
      { points: [[a, 0], [a, hr]], couleur: COULEURS.f62, tirets: "6 4", libelle: `arithmétique ${fd(a, 2)}` },
    ],
  });
  const detail = parts.map((c) => `${fd(c.pl, 2)}<sup>${fd(c.h, 2)}</sup>`).join(" × ");
  el("pleOut").innerHTML =
    `p<sub>le</sub>* = (${detail})<sup>1/${fd(hr, 2)}</sup> = <strong>${fd(g, 3)} MPa</strong>
     <small>moyenne arithmétique : ${fd(a, 3)} MPa — la moyenne géométrique est plus faible de ${f(100 * (1 - g / a), 2)} %.
     Les deux ne coïncident que pour un sol homogène.</small>`;
});
brancher(["pleB", "pleH1", "plePl1", "pleH2", "plePl2", "plePl3"], majPle);

// ── kp en fonction de De/B ──────────────────────────────────────────────
const majKp = garde("kpOut", () => {
  const classe = el("kpClasse").value, forme = el("kpForme").value, DeB = Math.max(num("kpDeB", 0), 0);
  const cat = famille(classe);
  const kF = (x) => S.kpF62({ classe, B: 1, L: 1, forme, De: x }).k;
  const kE = (x) => S.kpEC7({ categorie: cat, B: 1, L: 1, forme, De: x }).k;
  const xmax = Math.max(2.5, DeB * 1.1);
  const ymax = Math.max(kF(xmax), kE(xmax)) * 1.1;
  el("kpFig").innerHTML = graphe({
    largeur: 560, hauteur: 270, xmin: 0, xmax, ymin: 0, ymax, xlabel: "De/B", ylabel: "kp",
    zones: [{ x0: 1.5, x1: xmax, y0: 0, y1: ymax, couleur: COULEURS.f62, opacite: 0.08, libelle: "semi-profonde" }],
    series: [
      { points: echantillon(kF, 0, xmax, 60), couleur: COULEURS.f62, libelle: `F62 ${CLASSES_F62[classe]?.nom ?? classe}` },
      { points: echantillon(kE, 0, xmax, 120), couleur: COULEURS.ec7, libelle: `NF P94-261 ${cat}` },
    ],
    marques: [
      { x: DeB, y: kF(DeB), couleur: COULEURS.f62, guides: true },
      { x: DeB, y: kE(DeB), couleur: COULEURS.ec7, guides: true },
    ],
  });
  const a = kF(DeB), b = kE(DeB);
  el("kpOut").innerHTML =
    `À D<sub>e</sub>/B = ${fd(DeB, 2)} : <span class="tag-f62">F62</span> k<sub>p</sub> = <strong>${fd(a, 3)}</strong>
     · <span class="tag-ec7">EC7</span> k<sub>p</sub> = <strong>${fd(b, 3)}</strong>
     <small>écart ${b >= a ? "+" : ""}${f(100 * (b / a - 1), 2)} % ; valeurs à encastrement nul : ${fd(kF(0), 2)} et ${fd(kE(0), 2)}.
     ${DeB > 2 ? "Au-delà de De/B = 2, la norme plafonne k<sub>p</sub> à k<sub>p,max</sub>." : ""}</small>`;
});
brancher(["kpClasse", "kpForme", "kpDeB"], majKp);

// ── Une semelle, deux vérifications ─────────────────────────────────────
const majPt = garde("ptOut", () => {
  const forme = el("ptForme").value;
  const B = num("ptB");
  const L = forme === "filante" ? 1 : forme === "carree" ? B : num("ptL");
  const D = Math.max(num("ptD", 0), 0), plc = num("ptPlc"), gam = num("ptGam", 20), classe = el("ptClasse").value;
  const h1 = num("ptH1"), pl1 = num("ptPl1"), pl2 = num("ptPl2"), sol = el("ptSol").value;
  el("ptL").closest(".field").style.display = forme === "rectangulaire" ? "" : "none";
  if (!(B > 0 && L > 0 && h1 > 0 && pl1 > 0 && pl2 > 0 && (D === 0 || plc > 0))) {
    el("ptOut").textContent = "Renseigner la géométrie et le profil pressiométrique."; return;
  }
  const etats = [
    { nom: "ELU fondamental", f62: "ELU", ec7: "ELU", V: num("ptVu"), H: Math.abs(num("ptHu", 0)), e: Math.abs(num("ptEu", 0)) },
    { nom: "ELS rare / caractéristique", f62: "ELS_rare", ec7: "ELS_car", V: num("ptVs"), H: Math.abs(num("ptHs", 0)), e: Math.abs(num("ptEs", 0)) },
  ];
  if (etats.some((s) => !(s.V > 0))) { el("ptOut").textContent = "Renseigner des charges verticales positives."; return; }

  const profil = profilPl([
    { z0: 0, z1: D, pl: plc }, { z0: D, z1: D + h1, pl: pl1 }, { z0: D + h1, z1: D + h1 + 100, pl: pl2 },
  ]);
  const q0 = gam * D;
  const A = S.aire({ forme, B, L });
  const unite = forme === "filante" ? "kN/m" : "kN";

  // Paramètres communs aux combinaisons : ple* sur 1,5 B, De, kp.
  const pleF = S.pleF62({ profil, D, B }).ple;
  const DeF = S.De({ profil, D, reference: pleF });
  const kpF = S.kpF62({ classe, B, L, forme, De: DeF });
  const pleQP = S.pleEC7({ profil, D, hr: 1.5 * B }).ple;
  const DeE = S.De({ profil, D, reference: pleQP });
  const kpE = S.kpEC7({ categorie: famille(classe), B, L, forme, De: DeE });
  if (!kpF.applicable || !kpE.applicable) { el("ptOut").innerHTML = verdict(false, "", kpF.motif || kpE.motif); return; }

  el("ptFig").innerHTML = coupeSemelle({
    B, D, e: etats[0].e, V: "Vd", H: etats[0].H, hauteur: 280, montrerHr: 1.5 * B,
    couches: [
      { z0: 0, z1: D, sol: "remblai", etiquette: D > 0 ? `pl* ${fd(plc, 2)} MPa` : null },
      { z0: D, z1: D + h1, sol: classe, etiquette: `${classe.replace("-", " ")} · pl* ${fd(pl1, 2)} MPa` },
      { z0: D + h1, z1: D + h1 + 50, sol: "sable", etiquette: `pl* ${fd(pl2, 2)} MPa` },
    ],
  });

  let lignes = `
    <tr><td>p<sub>le</sub>* sur 1,5 B (MPa)</td><td class="n">${fd(pleF, 3)}</td><td class="n">${fd(pleQP, 3)}</td></tr>
    <tr><td>D<sub>e</sub> (m) · D<sub>e</sub>/B</td><td class="n">${fd(DeF, 2)} · ${fd(DeF / B, 3)}</td><td class="n">${fd(DeE, 2)} · ${fd(DeE / B, 3)}</td></tr>
    <tr><td>Facteur de portance k<sub>p</sub></td><td class="n">${fd(kpF.k, 3)}</td><td class="n">${fd(kpE.k, 3)}</td></tr>
    <tr><td>q'<sub>0</sub> = γ D (kPa)</td><td class="n" colspan="2" style="text-align:center">${f(q0, 3)}</td></tr>`;
  const bilans = [];
  for (const s of etats) {
    const delta = (Math.atan2(s.H, s.V) * 180) / Math.PI;
    // Fascicule 62
    const idb = S.idbF62({ sol, delta, B, De: DeF }).i;
    const dg = S.diagramme({ forme, B, L, V: s.V, e: s.e });
    const surf = S.surfaceComprimeeF62({ B, e: s.e, etat: s.f62 });
    // NF P94-261
    const hr = S.hrEC7({ forme, B, L, eB: s.e, etat: s.ec7 });
    const pleE = S.pleEC7({ profil, D, hr }).ple;
    const id = S.idEC7({ sol, delta, B, De: DeE }).i;
    const qnet = kpE.k * pleE * id * 1000;
    const exc = S.excentrementEC7({ forme, B, L, eB: s.e });
    lignes += `<tr><th colspan="3">${s.nom} — δ = arctan(H/V) = ${fd(delta, 2)}°</th></tr>`;
    if (!dg.applicable || !exc.applicable) {
      lignes += `<tr class="ko"><td>Excentrement</td><td colspan="2">${verdict(false, "", dg.motif || exc.motif)}</td></tr>`;
      bilans.push(null);
      continue;
    }
    const pF = S.portanceF62({ qnette: kpF.k * pleF * 1000, q0, idb, qref: dg.qrefTrapeze, etat: s.f62 });
    const pE = S.portanceEC7({ A, ie: exc.ie, qnet, q0, Vd: s.V, etat: s.ec7 });
    const critere = s.ec7 === "ELU" ? exc.ELU : exc.ELS_car;
    lignes += `
      ${hr !== 1.5 * B ? `<tr><td>h<sub>r</sub> réduit par l'excentrement</td><td class="n">1,5 B</td><td class="n">${fd(hr, 2)} m → p<sub>le</sub>* = ${fd(pleE, 3)}</td></tr>` : ""}
      <tr><td>Réduction d'inclinaison</td><td class="n">i<sub>δβ</sub> = ${sol === "coherent" ? "Φ1" : "Φ2"} = ${fd(idb, 3)}</td><td class="n">i<sub>δ</sub> = ${fd(id, 3)}</td></tr>
      <tr><td>Surface</td><td class="n">comprimée ${f(100 * surf.fraction, 3)} % ${verdict(surf.ok)}</td><td class="n">i<sub>e</sub> = ${fd(exc.ie, 3)} ${verdict(critere.ok)}</td></tr>
      <tr><td>Sollicitation</td><td class="n">q'<sub>ref</sub> = ${f(dg.qrefTrapeze, 4)} kPa</td><td class="n">V<sub>d</sub> − R<sub>0</sub> = ${f(s.V - pE.R0, 4)} ${unite}</td></tr>
      <tr><td>Résistance</td><td class="n">q'<sub>0</sub> + k<sub>p</sub>p<sub>le</sub>* i<sub>δβ</sub>/${pF.gammaQ} = ${f(pF.qadm, 4)} kPa</td>
        <td class="n">R<sub>v;d</sub> = A i<sub>e</sub> q<sub>net</sub>/(${fd(pE.gammaRv, 1)} × ${fd(pE.gammaRdv, 1)}) = ${f(pE.Rvd, 4)} ${unite}</td></tr>
      <tr class="${pF.ok && pE.ok ? "" : "ko"}"><td>Taux de travail</td><td class="n">${fd(pF.taux, 2)} ${verdict(pF.ok)}</td><td class="n">${fd(pE.taux, 2)} ${verdict(pE.ok)}</td></tr>`;
    bilans.push({
      nom: s.nom,
      netF: (kpF.k * pleF * 1000 * idb) / pF.gammaQ,
      netE: (exc.ie * qnet) / (pE.gammaRv * pE.gammaRdv),
      sollF: dg.qrefTrapeze - q0,
      sollE: (s.V - pE.R0) / A,
    });
  }
  const b = bilans[0];
  el("ptOut").innerHTML = `
    <div class="table-large"><table class="resultats"><thead><tr><th>Grandeur</th><th class="num"><span class="tag-f62">Fascicule 62</span></th><th class="num"><span class="tag-ec7">NF P94-261</span></th></tr></thead>
    <tbody>${lignes}</tbody></table></div>
    ${b ? `<p class="method-note">Ramenées à la surface totale de la semelle, à l'ELU : résistance nette de calcul
      <strong>${f(b.netF, 4)} kPa</strong> au Fascicule 62 contre <strong>${f(b.netE, 4)} kPa</strong> à l'Eurocode 7
      (rapport ${fd(b.netE / b.netF, 2)}), pour une sollicitation nette de ${f(b.sollF, 4)} et ${f(b.sollE, 4)} kPa.
      L'écart vient des facteurs k<sub>p</sub> (${fd(kpE.k / kpF.k, 2)}), des coefficients partiels (2 contre 1,4 × 1,2 = 1,68)
      et, dès que la charge est excentrée, du passage de q'<sub>ref</sub> à la surface effective.</p>` : ""}`;
});
brancher(["ptForme", "ptB", "ptL", "ptD", "ptPlc", "ptGam", "ptClasse", "ptH1", "ptPl1", "ptPl2", "ptSol", "ptVu", "ptHu", "ptEu", "ptVs", "ptHs", "ptEs"], majPt);
