// Calculateurs du chapitre 13 : pente de l'essai de gonflement au gel et
// classe de sensibilité, classe par les règles par défaut de l'annexe 3,
// profondeur de gel de Stefan (modèle d'enseignement).
import { el, num, f, fd, esc, brancher, garde, lireTableau } from "./ui.js";
import { graphe, COULEURS } from "./figures.js";
import { penteGel, classeGel } from "./gtr/traitement.js";
import { sensibiliteGel, profondeurGelStefan } from "./gtr/gel.js";

const NOM_GEL = { SGn: "non gélif", SGp: "peu gélif", SGt: "très gélif" };
const pastilleGel = (c) => `<span class="classe" style="background:${c === "SGn" ? "#15803d" : c === "SGp" ? "#d97706" : "#b91c1c"}">${c}</span>`;

// ── Pente de gonflement ───────────────────────────────────────────────────
const majPente = garde("pgOut", () => {
  const pts = lireTableau(el("pgPoints").value).filter((r) => r.length >= 2 && r[0] > 0);
  if (pts.length < 2) { el("pgOut").textContent = "Il faut au moins deux mesures (I, h)."; el("pgFig").innerHTML = ""; return; }
  const p = penteGel(pts), c = classeGel(p);
  const xmax = Math.ceil(Math.sqrt(Math.max(...pts.map((q) => q[0]))) / 5) * 5 + 5;
  const ymax = Math.max(Math.ceil(Math.max(...pts.map((q) => q[1])) * 1.3), Math.ceil(0.45 * xmax));
  el("pgFig").innerHTML = graphe({
    largeur: 620, hauteur: 290, xmin: 0, xmax, ymin: 0, ymax, pasX: 5,
    xlabel: "√I ((°C·h)½)", ylabel: "gonflement h (mm)",
    zones: [],
    series: [
      { points: [[0, 0], [xmax, 0.05 * xmax]], couleur: "#15803d", epaisseur: 1.4, tirets: "5 4", libelle: "p = 0,05 (SGn / SGp)" },
      { points: [[0, 0], [xmax, 0.4 * xmax]], couleur: "#b91c1c", epaisseur: 1.4, tirets: "5 4", libelle: "p = 0,4 (SGp / SGt)" },
      { points: [[0, 0], [xmax, p * xmax]], couleur: COULEURS.bleu, epaisseur: 2.4, libelle: `droite ajustée, p = ${fd(p, 3)}` },
      { points: pts.map(([I, h]) => [Math.sqrt(I), h]), couleur: COULEURS.encre, nuage: true, rayon: 4.5 },
    ],
  });
  el("pgOut").innerHTML = `p = Σ(√I·h)/ΣI = <strong>${fd(p, 3)} mm/(°C·h)<sup>½</sup></strong> → ${pastilleGel(c.classe)} ${c.nom}
    <small>${c.classe === "SGt" ? "Un tel matériau ne peut rester sous la chaussée sans protection : il faut assez de matériaux non gélifs au-dessus." : c.classe === "SGp" ? "Peu gélif : la protection au gel tient compte de sa pente dans le calcul de la NF P98-086." : "Non gélif : il protège ce qui est dessous."}</small>`;
});
brancher(["pgPoints"], majPente);

// ── Règles par défaut ─────────────────────────────────────────────────────
const majDefaut = garde("gdOut", () => {
  const r = sensibiliteGel({
    nature: el("gdNature").value, traitement: el("gdTrait").value, insensibleEau: el("gdIns").value === "oui",
    LA: num("gdLa"), MDE: num("gdMde"), Rc: num("gdRc"), Rit: num("gdRit"), p: num("gdP"),
  });
  el("gdOut").innerHTML = `${r.classe ? `${pastilleGel(r.classe)} <strong>${esc(r.nom)}</strong>` : `<span class="verdict na">${esc(r.nom)}</span>`}
    <small>${r.etapes.map(esc).join(" → ")}.</small>`;
});
brancher(["gdNature", "gdTrait", "gdIns", "gdLa", "gdMde", "gdRc", "gdRit", "gdP"], majDefaut);

// ── Stefan ────────────────────────────────────────────────────────────────
const majStefan = garde("stOut", () => {
  const I = num("stI"), lambda = num("stL"), w = num("stW"), rhoD = num("stRho");
  const z = profondeurGelStefan({ I, lambda, w, rhoD });
  if (!Number.isFinite(z)) { el("stOut").textContent = "Renseigner I, λ, w et ρd."; el("stFig").innerHTML = ""; return; }
  const courbe = (ww) => Array.from({ length: 41 }, (_, i) => { const x = 20 + (780 * i) / 40; return [x, profondeurGelStefan({ I: x, lambda, w: ww, rhoD })]; });
  el("stFig").innerHTML = graphe({
    largeur: 620, hauteur: 280, xmin: 0, xmax: 800, ymin: 0, ymax: Math.max(2.5, Math.ceil(z * 1.3 * 2) / 2), pasX: 100, pasY: 0.5, inverserY: true,
    xlabel: "indice de gel de l'hiver I (°C·jour)", ylabel: "profondeur gelée z (m)",
    series: [
      { points: courbe(w / 2), couleur: "#94a3b8", epaisseur: 1.6, tirets: "5 4", libelle: `w = ${fd(w / 2, 1)} %` },
      { points: courbe(w), couleur: COULEURS.bleu, epaisseur: 2.6, libelle: `w = ${fd(w, 1)} %` },
      { points: courbe(w * 2), couleur: "#94a3b8", epaisseur: 1.6, tirets: "2 3", libelle: `w = ${fd(w * 2, 1)} %` },
    ],
    marques: [{ x: I, y: z, couleur: COULEURS.rouge, libelle: `z ≈ ${fd(z, 2)} m`, guides: true }],
  });
  el("stOut").innerHTML = `L = ${fd(w, 1)} % × ${f(rhoD * 1000, 4)} kg/m³ × 334 kJ/kg = ${f((w / 100) * rhoD * 334, 3)} MJ/m³ · z = √(2 × ${fd(lambda, 1)} × ${f(I, 4)} × 86 400 / L) ≈ <strong>${fd(z, 2)} m</strong>
    <small>Plus le sol contient d'eau, plus il faut extraire de chaleur pour le geler : le front de gel descend moins vite dans un sol humide. Valeur majorante, à ne pas utiliser pour dimensionner.</small>`;
});
brancher(["stI", "stL", "stW", "stRho"], majStefan);
