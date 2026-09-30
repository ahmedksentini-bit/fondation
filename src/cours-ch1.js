// Calculateurs du chapitre 1 : pression limite nette, classe du Fascicule 62
// et coefficient rhéologique.
import { el, num, f, fd, brancher, garde } from "./ui.js";
import { pressionNette, proposerClasseF62, alphaMenard, CLASSES_F62 } from "./geotech/sols.js";

// ── p0 et pl* ─────────────────────────────────────────────────────────────
const majPl = garde("plOut", () => {
  const z = num("plZ"), pl = num("plMes") * 1000, g = num("plGamma"), zw = num("plNappe"), gs = num("plGsat"), K0 = num("plK0");
  if (!(z > 0 && pl > 0 && g > 0)) { el("plOut").textContent = "Renseigner z, pl et γ."; return; }
  const hSec = Math.min(z, Math.max(zw, 0)), hSat = Math.max(0, z - Math.max(zw, 0));
  const sv = g * hSec + gs * hSat;
  const u = 10 * hSat;
  const { p0, plNette } = pressionNette({ pl, sigmaV0eff: sv - u, u, K0 });
  const part = (100 * p0) / pl;
  el("plOut").innerHTML =
    `σv0 = ${f(sv, 4)} kPa · u = ${f(u, 3)} kPa · σ'v0 = ${f(sv - u, 4)} kPa<br>
     p0 = u + K0 σ'v0 = <strong>${f(p0, 3)} kPa</strong> →
     pl* = pl − p0 = <strong>${fd(plNette / 1000, 3)} MPa</strong>
     <small>p0 représente ${f(part, 2)} % de la pression limite mesurée.</small>`;
});
brancher(["plZ", "plMes", "plGamma", "plNappe", "plGsat", "plK0"], majPl);

// ── Classe F62 et coefficient α ──────────────────────────────────────────
const NATURE_ALPHA = { argile: "argile", sable: "sable", craie: null, marne: null, roche: null };
const majClasse = garde("clOut", () => {
  const famille = el("clFamille").value, pl = num("clPl"), EM = num("clEM");
  if (!(pl > 0)) { el("clOut").textContent = "Renseigner la pression limite."; return; }
  const c = proposerClasseF62(famille, pl);
  if (!c.cle) { el("clOut").textContent = c.motif; return; }
  const bornes = (b) => (b[1] === Infinity ? `> ${f(b[0], 2)}` : b[0] === 0 ? `< ${f(b[1], 2)}` : `${f(b[0], 2)} – ${f(b[1], 2)}`);
  let texte = `Classe proposée : <strong>${c.nom} (${c.lettre})</strong>
    <small>fourchette du tableau : pl ${bornes(c.pl)} MPa${c.entre ? " — pl tombe entre deux classes : on retient la plus faible, par prudence" : ""}.</small>`;
  const nature = NATURE_ALPHA[famille];
  if (nature && EM > 0) {
    const a = alphaMenard(nature, EM, pl);
    texte += `<br>EM/pl = ${f(a.rapport, 3)} → sol ${a.etat}, <strong>α = ${a.alpha === 2 / 3 ? "2/3" : a.alpha === 1 / 3 ? "1/3" : a.alpha === 1 / 4 ? "1/4" : a.alpha === 1 / 2 ? "1/2" : f(a.alpha, 3)}</strong>
      ${a.dansTableau ? "" : "<small>rapport sous la plus petite ligne du tableau : sol probablement remanié, à examiner.</small>"}`;
  } else if (!nature) {
    texte += `<br><small>Pour les craies, marnes et roches, α se choisit d'après la fracturation (2/3, 1/2 ou 1/3).</small>`;
  }
  el("clOut").innerHTML = texte;
});
brancher(["clFamille", "clPl", "clEM"], majClasse);

// Exposé pour les tests de structure : toutes les classes du tableau sont présentes.
export const nombreClasses = Object.keys(CLASSES_F62).length;
