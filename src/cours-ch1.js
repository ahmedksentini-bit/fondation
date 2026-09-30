// Calculateurs du chapitre 1 : contraintes initiales dans le sol, profondeur
// de reconnaissance, classe du Fascicule 62.
import { el, num, f, fd, brancher, garde } from "./ui.js";
import { graphe, echantillon, COULEURS } from "./figures.js";
import { figureClassesF62 } from "./schemas-cours.js";
import { proposerClasseF62, sigmaV0, profondeurReconnaissance, CLASSES_F62 } from "./geotech/sols.js";

// ── Contraintes totales, pression de l'eau, contraintes effectives ────────
const majSv = garde("svOut", () => {
  const h1 = num("svH1"), g1 = num("svG1"), gs1 = num("svGs1"), g2 = num("svG2"), gs2 = num("svGs2");
  const zw = num("svZw", Infinity), z = num("svZ"), K0 = num("svK0", 0.5);
  if (!(h1 > 0 && g1 > 0 && gs1 > 0 && g2 > 0 && gs2 > 0 && z > 0 && K0 > 0)) {
    el("svOut").textContent = "Renseigner les deux couches, la profondeur de calcul et K0.";
    el("svFig").innerHTML = "";
    return;
  }
  const couches = [{ z0: 0, z1: h1, gamma: g1, gammaSat: gs1 }, { z0: h1, z1: 1e6, gamma: g2, gammaSat: gs2 }];
  const etat = (zz, nappe = zw) => sigmaV0({ couches, z: zz, zNappe: nappe });
  const zMax = Math.ceil((Math.max(z, h1, Number.isFinite(zw) ? zw : 0) + 2) / 2) * 2;
  const xMax = Math.ceil((etat(zMax).sigmaV * 1.05) / 20) * 20;
  const profil = (cle) => echantillon((zz) => etat(zz)[cle], 0, zMax, 160).map(([zz, v]) => [v, zz]);
  const ici = etat(z);
  const sh = K0 * ici.sigmaVeff + ici.u;
  el("svFig").innerHTML = graphe({
    largeur: 560, hauteur: 340, xmin: 0, xmax: xMax, ymin: 0, ymax: zMax, inverserY: true,
    xlabel: "contrainte (kPa)", ylabel: "profondeur (m)",
    zones: [
      { x0: 0, x1: xMax, y0: 0, y1: h1, couleur: "#e8dcc3", opacite: 0.5, libelle: "couche 1", position: "droite" },
      { x0: 0, x1: xMax, y0: h1, y1: zMax, couleur: "#f3e5ae", opacite: 0.5, libelle: "couche 2", position: "droite" },
    ],
    series: [
      { points: profil("sigmaV"), couleur: COULEURS.encre, epaisseur: 2, libelle: "σv0 totale" },
      { points: profil("u"), couleur: COULEURS.eau, epaisseur: 2, libelle: "u0 eau" },
      { points: profil("sigmaVeff"), couleur: COULEURS.ec7, epaisseur: 3, libelle: "σ'v0 effective" },
      { points: echantillon((zz) => K0 * etat(zz).sigmaVeff + etat(zz).u, 0, zMax, 160).map(([zz, v]) => [v, zz]), couleur: COULEURS.violet, tirets: "6 3", libelle: "σh0 = K0 σ'v0 + u0" },
      ...(Number.isFinite(zw) && zw < zMax ? [{ points: [[0, zw], [xMax, zw]], couleur: COULEURS.eau, tirets: "6 4", epaisseur: 1.2, libelle: "nappe" }] : []),
    ],
    marques: [{ x: ici.sigmaVeff, y: z, couleur: COULEURS.ec7, guides: true }, { x: ici.sigmaV, y: z, couleur: COULEURS.encre }],
  });
  // Même cote, nappe remontée au terrain naturel : la contrainte effective chute.
  const haute = etat(z, 0);
  const perte = ici.sigmaVeff > 0 ? (100 * (ici.sigmaVeff - haute.sigmaVeff)) / ici.sigmaVeff : 0;
  el("svOut").innerHTML = `À z = ${fd(z, 1)} m : σv0 = ${f(ici.sigmaV, 4)} kPa · u0 = ${f(ici.u, 3)} kPa ·
    <strong>σ'v0 = ${f(ici.sigmaVeff, 4)} kPa</strong> · σh0 = K0 σ'v0 + u0 = ${f(sh, 4)} kPa
    ${perte > 0.5 ? `<small>Si la nappe remontait jusqu'au terrain naturel, σ'v0 tomberait à ${f(haute.sigmaVeff, 4)} kPa (− ${f(perte, 2)} %) : la résistance du sol suit.</small>` : ""}`;
});
brancher(["svH1", "svG1", "svGs1", "svG2", "svGs2", "svZw", "svZ", "svK0"], majSv);

// ── Profondeur de reconnaissance (NF EN 1997-2 annexe B.3) ─────────────────
const NOMS = { semelle: "sous l'assise de la semelle", radier: "sous l'assise du radier", pieux: "sous la pointe des pieux" };
const majZa = garde("zaOut", () => {
  const type = el("zaType").value, b = num("zaB"), D = Math.max(num("zaD", 0), 0), DF = num("zaDF", 0);
  el("zaDF").closest(".field").hidden = type !== "pieux";
  if (!(b > 0) || (type === "pieux" && !(DF > 0))) { el("zaOut").textContent = "Renseigner les dimensions de la fondation."; return; }
  const r = profondeurReconnaissance({ type, b, DF });
  let t = `z<sub>a</sub> = max(${r.criteres.map(([n, v]) => `${n} = ${fd(v, 1)} m`).join(" ; ")}) = <strong>${fd(r.za, 1)} m</strong> ${NOMS[type]} :
    le sondage descend au moins jusqu'à <strong>${fd(D + r.za, 1)} m</strong> sous le terrain.`;
  if (type === "semelle") {
    t += ` <small>Le tassement pressiométrique (chapitre 9) mobilise le terrain jusqu'à 8 B sous la base, soit ${fd(D + 8 * b, 1)} m pour B = ${fd(b, 2)} m :
      ${8 * b > r.za ? "c'est lui qui fixe la profondeur utile si l'on veut calculer ce tassement." : "la recommandation de l'annexe B.3 le couvre."}</small>`;
  }
  el("zaOut").innerHTML = t;
});
brancher(["zaType", "zaB", "zaD", "zaDF"], majZa);

// ── Classe F62 ────────────────────────────────────────────────────────────
const majClasse = garde("clOut", () => {
  const famille = el("clFamille").value, pl = num("clPl");
  if (!(pl > 0)) { el("clOut").textContent = "Renseigner la pression limite."; el("clFig").innerHTML = ""; return; }
  el("clFig").innerHTML = figureClassesF62({ famille, pl });
  const c = proposerClasseF62(famille, pl);
  if (!c.cle) { el("clOut").textContent = c.motif; return; }
  const bornes = (b) => (b[1] === Infinity ? `> ${f(b[0], 2)}` : b[0] === 0 ? `< ${f(b[1], 2)}` : `${f(b[0], 2)} – ${f(b[1], 2)}`);
  el("clOut").innerHTML = `Classe proposée : <strong>${c.nom} (${c.lettre})</strong>
    <small>fourchette du tableau : pl ${bornes(c.pl)} MPa${c.entre ? " — pl tombe entre deux classes : on retient la plus faible, par prudence" : ""}.
    La classe reste un jugement sur la nature du sol ; ce tableau n'est qu'une aide.</small>`;
});
brancher(["clFamille", "clPl"], majClasse);

// Exposé pour les tests de structure : toutes les classes du tableau sont présentes.
export const nombreClasses = Object.keys(CLASSES_F62).length;
