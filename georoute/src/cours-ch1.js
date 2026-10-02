// Calculateurs du chapitre 1 : objectifs de densification q4 et q3.
import { el, num, f, fd, brancher, garde, verdict } from "./ui.js";
import { svg, ligne, texte, COULEURS } from "./figures.js";
import { controleDensite, OBJECTIFS } from "./gtr/compactage.js";

/** Deux barres (moyenne, fond de couche) en % de ρdOPN, avec les seuils de l'objectif. */
function figureTaux({ tauxMoyen, tauxFond, objectif }) {
  const o = OBJECTIFS[objectif];
  const xMin = 85, xMax = 103, x0 = 150, x1 = 610;
  const X = (t) => x0 + ((Math.min(xMax, Math.max(xMin, t)) - xMin) / (xMax - xMin)) * (x1 - x0);
  return svg({ largeur: 640, hauteur: 150, titre: "Taux de compactage", contenu: () => {
    let s = "";
    for (let t = xMin; t <= xMax; t += 1) {
      s += ligne(X(t), 22, X(t), 118, t % 5 === 0 ? "#cbd5e1" : COULEURS.grille, 1);
      if (t % 5 === 0) s += texte(X(t), 134, `${t} %`, 'text-anchor="middle" class="pt"');
    }
    const barre = (y, t, seuil, nom) => {
      const ok = t >= seuil;
      let b = `<rect x="${x0}" y="${y}" width="${(X(t) - x0).toFixed(1)}" height="26" rx="5" fill="${ok ? "#0f766e" : "#b91c1c"}" opacity=".85"/>`;
      b += texte(x0 - 10, y + 18, nom, 'text-anchor="end" style="font-weight:700"');
      b += ligne(X(seuil), y - 6, X(seuil), y + 32, "#0f172a", 2.2, 'stroke-dasharray="4 3"');
      b += texte(Math.min(X(t) + 6, x1 - 60), y + 18, `${fd(t, 1)} %`, `class="halo" style="font-weight:800;fill:${ok ? "#0f766e" : "#b91c1c"}"`);
      b += texte(X(seuil) + 4, y - 9, `seuil ${f(seuil, 3)} %`, 'class="halo" style="font-size:10.5px;fill:#0f172a"');
      return b;
    };
    s += barre(30, tauxMoyen, o.moyen, "moyenne");
    if (Number.isFinite(tauxFond)) s += barre(82, tauxFond, o.fond, "fond de couche");
    return s;
  } });
}

const majObjectifs = garde("objOut", () => {
  const rhoDOPN = num("objOpn"), objectif = el("objQ").value, rhoDmoy = num("objMoy"), rhoDfc = num("objFond");
  if (!(rhoDOPN > 0 && rhoDmoy > 0)) { el("objOut").textContent = "Renseigner ρdOPN et la masse volumique sèche moyenne."; el("objFig").innerHTML = ""; return; }
  const c = controleDensite({ rhoDmoy, rhoDfc, rhoDOPN, objectif });
  el("objFig").innerHTML = figureTaux({ ...c, objectif });
  el("objOut").innerHTML = `Objectif ${objectif} : ρd moyenne ≥ <strong>${fd(c.rhoDmoyRequis, 3)} Mg/m³</strong>
    et ρd en fond de couche ≥ <strong>${fd(c.rhoDfcRequis, 3)} Mg/m³</strong>.
    Mesures : ${fd(c.tauxMoyen, 1)} % et ${fd(c.tauxFond, 1)} % de ρdOPN — ${verdict(c.ok, "objectif atteint", "objectif non atteint")}
    ${c.okMoyen && c.okFond === false ? "<small>La moyenne passe mais pas le fond : la couche est trop épaisse pour ce compacteur, ou le nombre de passes insuffisant. On ne rattrape pas le fond par des passes supplémentaires si l'épaisseur dépasse celle du tableau de compactage.</small>" : ""}`;
});
brancher(["objOpn", "objQ", "objMoy", "objFond"], majObjectifs);
