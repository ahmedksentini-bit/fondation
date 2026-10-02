// Affichage des codes des conditions d'utilisation du GTR : remblai
// (E G W T R C H, annexe 2) et couche de forme (G W T S, annexe 3).
import { esc } from "./ui.js";
import { RUBRIQUES_REMBLAI } from "./gtr/utilisation.js";

/** Code en pastilles, une par rubrique ; les rubriques actives sont teintées. */
export function codeHtml(code, rubriques = RUBRIQUES_REMBLAI) {
  const lettres = Object.keys(rubriques);
  return `<span class="code-gtr" title="${esc(code)}">${lettres.map((l, i) => {
    const v = code[i] ?? "?";
    const actif = v !== "0" && !(l === "C" && v === "2");
    return `<span${actif ? ' class="actif"' : ""}><b>${l}</b>${esc(v)}</span>`;
  }).join("")}</span>`;
}
