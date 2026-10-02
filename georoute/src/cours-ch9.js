// Calculateurs du chapitre 9 : talus infini (sec et avec écoulement
// parallèle à la pente) et cercle critique de Bishop d'un talus homogène.
import { el, num, fd, esc, verdict, brancher, garde } from "./ui.js";
import { graphe, COULEURS } from "./figures.js";
import { penteInfinie, cercleCritique } from "./gtr/stabilite.js";
import { coupeTalus } from "./dessins-gtr.js";
import { RAD } from "./gtr/outils.js";

// ── Talus infini ──────────────────────────────────────────────────────────
const majPente = garde("peOut", () => {
  const fr = num("peFruit"), phi = num("pePhi"), g = num("peGamma");
  if (!(fr > 0 && phi > 0 && g > 10)) { el("peOut").textContent = "Renseigner le fruit, φ' et γsat (> 10 kN/m³)."; return; }
  const beta = Math.atan(1 / fr) / RAD;
  const Fs = penteInfinie({ phi, beta }), Fe = penteInfinie({ phi, beta, ecoulement: true, gamma: g, gammaW: 9.81 });
  const courbe = (ec) => Array.from({ length: 60 }, (_, i) => { const x = 0.5 + (3.5 * i) / 59; return [x, penteInfinie({ phi, beta: Math.atan(1 / x) / RAD, ecoulement: ec, gamma: g, gammaW: 9.81 })]; });
  el("peFig").innerHTML = graphe({
    largeur: 620, hauteur: 290, xmin: 0.5, xmax: 4, ymin: 0, ymax: Math.max(3, Math.ceil(Fs + 0.5)), pasX: 0.5, pasY: 0.5,
    xlabel: "fruit du talus (base / hauteur)", ylabel: "coefficient de sécurité F",
    zones: [{ x0: 0.5, x1: 4, y0: 0, y1: 1, couleur: "#dc2626", opacite: 0.08, libelle: "F < 1 : le talus glisse" }],
    series: [
      { points: courbe(false), couleur: COULEURS.bleu, epaisseur: 2.4, libelle: "talus sec" },
      { points: courbe(true), couleur: COULEURS.eau, epaisseur: 2.4, tirets: "6 4", libelle: "écoulement parallèle à la pente" },
      { points: [[0.5, 1.5], [4, 1.5]], couleur: "#64748b", epaisseur: 1.2, tirets: "3 3", libelle: "F = 1,5" },
    ],
    marques: [{ x: fr, y: Fs, couleur: COULEURS.bleu, libelle: `sec ${fd(Fs, 2)}` }, { x: fr, y: Fe, couleur: COULEURS.eau, libelle: `avec eau ${fd(Fe, 2)}` }],
  });
  el("peOut").innerHTML = `β = arctan(1/${fd(fr, 2)}) = ${fd(beta, 1)}° · à sec F = tan ${fd(phi, 1)}°/tan ${fd(beta, 1)}° = <strong>${fd(Fs, 2)}</strong> ${verdict(Fs >= 1.5, "≥ 1,5", "< 1,5")} ·
    avec écoulement F = <strong>${fd(Fe, 2)}</strong> ${verdict(Fe >= 1, "≥ 1", "< 1 : glissement")}
    <small>${Fe < 1 && Fs >= 1 ? "Le talus tient à sec mais glisse dès qu'une nappe s'écoule parallèlement à la pente : drainer ou adoucir la pente." : Fs < 1 ? "La pente dépasse l'angle de frottement : même sec, le talus ne tient pas." : "Le talus garde une marge même avec un écoulement."}</small>`;
});
brancher(["peFruit", "pePhi", "peGamma"], majPente);

// ── Cercle critique ───────────────────────────────────────────────────────
const majBishop = garde("biOut", () => {
  const p = { H: num("biH"), f: num("biF"), c: num("biC"), phi: num("biPhi"), gamma: num("biGamma"), ru: num("biRu") };
  if (!(p.H > 0 && p.f > 0 && p.phi >= 0 && p.gamma > 0 && p.c >= 0)) { el("biOut").textContent = "Renseigner la géométrie et les paramètres du sol."; el("biFig").innerHTML = ""; return; }
  const r = cercleCritique(p);
  if (!r.applicable) { el("biOut").innerHTML = `<span class="verdict ko">pas de cercle</span> <small>${esc(r.motif)}</small>`; el("biFig").innerHTML = ""; return; }
  el("biFig").innerHTML = coupeTalus(p, r);
  const beta = Math.atan(1 / p.f) / RAD;
  el("biOut").innerHTML = `Cercle critique : centre (${fd(r.cercle.xc, 1)} ; ${fd(r.cercle.yc, 1)}) m, rayon ${fd(r.cercle.R, 1)} m · <strong>F = ${fd(r.F, 2)}</strong> ${verdict(r.F >= 1.5, "≥ 1,5", r.F >= 1 ? "entre 1 et 1,5 : marge faible" : "< 1 : rupture")}
    <small>Talus à ${fd(beta, 1)}°. ${p.ru > 0 ? `Avec r<sub>u</sub> = ${fd(p.ru, 2)}, la pression interstitielle réduit la résistance de frottement. ` : ""}${p.c > 0 && p.phi < beta && r.F >= 1 ? "La cohésion seule fait tenir ce talus plus raide que l'angle de frottement : elle peut disparaître avec le temps, l'eau et le gel." : ""}</small>`;
});
brancher(["biH", "biF", "biC", "biPhi", "biGamma", "biRu"], majBishop);
