// Banc d'essai : piézomètre ouvert et piézomètre à cellule (chapitre 2). On
// installe les deux à la même profondeur, puis on purge le tube ouvert : son
// niveau remonte vers celui de la nappe en suivant une exponentielle de
// constante T0 = A/(F k) (Hvorslev). Le capteur à cellule, qui n'a presque pas
// d'eau à déplacer, répond aussitôt. La droite ln[(h_eq − h)/(h_eq − h0)] en
// fonction du temps rend T0, donc k.
import { svg, ligne, texte, couche, COULEURS, graphe } from "../figures.js";
import { tempsReponsePiezometre } from "../geotech/essais.js";
import { charpente, boucle, brancherMarche, lectures, f, fd, r1, esc, duree, sci } from "./moteur.js";

const SOLS = {
  sable: { nom: "sable moyen", k: 1e-4, sol: "sable" },
  limon: { nom: "limon", k: 5e-7, sol: "limon" },
  argile: { nom: "argile limoneuse", k: 2e-9, sol: "argile" },
};
const L = 1, D = 0.1, ZC = 8, ZW = 2.5; // cellule filtrante et nappe (m)
const X1 = 190, X2 = 450; // piézomètre ouvert, capteur à cellule (px)

export function monter(banc) {
  const c = charpente(banc, {
    vitesse: 100, vitesses: [10, 100, 10000, 1000000],
    commandes: `
      <div class="field"><label>Terrain</label><div class="input-wrap"><select data-r="sol">${Object.entries(SOLS).map(([k, s]) => `<option value="${k}">${esc(s.nom)}</option>`).join("")}</select></div></div>
      <div class="field"><label>Diamètre du tube ouvert</label><div class="input-wrap"><select data-r="tube"><option value="0.05">50 mm</option><option value="0.025">25 mm</option><option value="0.1">100 mm</option></select></div></div>
      <p class="method-note" style="grid-column:1/-1">Cellule filtrante L = ${f(L, 2)} m, D = ${fd(D, 2)} m, centrée à ${f(ZC, 2)} m ; nappe à ${fd(ZW, 1)} m. On purge le tube ouvert jusqu'à 2 m sous la nappe.</p>`,
  });
  let e, b, etatBoutons;

  const reinit = () => {
    const s = SOLS[c.q('[data-r="sol"]').value], dTube = Number(c.q('[data-r="tube"]').value);
    const r = tempsReponsePiezometre({ dTube, L, D, k: s.k });
    e = { s, dTube, r, h0: -2, t: 0, tFin: Math.min(5 * r.T0, 3e7), mesures: [], prochaine: Math.max(1, r.T0 / 30), fini: false };
    c.scene.innerHTML = fond();
    c.courbes.innerHTML = '<div class="dyn-courbe"></div>';
    c.bilan.innerHTML = "";
    dessiner(); dessinerLent();
  };

  /** Niveau du tube ouvert par rapport à la nappe (m, négatif dessous). */
  const niveau = (t) => e.h0 * Math.exp(-t / e.r.T0);

  const avancer = (dt) => {
    if (e.fini) return false;
    e.t = Math.min(e.tFin, e.t + dt);
    while (e.prochaine <= e.t + 1e-9) { e.mesures.push({ t: e.prochaine, h: niveau(e.prochaine) }); e.prochaine *= 1.25; }
    if (e.t >= e.tFin - 1e-9) e.fini = true;
    return !e.fini;
  };

  const yS = 70, k = 30, Y = (z) => yS + z * k;
  function fond() {
    return svg({
      largeur: 640, hauteur: 400, titre: "Piézomètres", contenu: (id) => {
        let s = couche(id, { x: 10, y: yS, w: 620, h: 400 - 8 - yS, sol: e.s.sol });
        s += ligne(10, yS, 630, yS, COULEURS.trait, 1.8) + ligne(10, Y(ZW), 630, Y(ZW), COULEURS.eau, 1.3, 'stroke-dasharray="6 4"');
        s += texte(624, Y(ZW) - 5, "nappe", `text-anchor="end" style="font-size:10.5px;font-weight:700;fill:${COULEURS.eau}"`);
        s += texte(16, Y(ZW) + 18, e.s.nom, 'class="halo" style="font-size:10.5px;font-weight:700"');
        // Piézomètre ouvert : tube, bouchon d'argile, cellule de sable.
        const x1 = X1;
        s += `<rect x="${x1 - 13}" y="${Y(ZC - 0.5)}" width="26" height="${k * L}" fill="#f3e5ae" stroke="#8a6d1f"/>`;
        s += `<rect x="${x1 - 13}" y="${Y(ZC - 1.6)}" width="26" height="${k * 1.1}" fill="#8b7355" opacity=".8"/>`;
        s += `<rect x="${x1 - 6}" y="${yS - 30}" width="12" height="${Y(ZC + 0.5) - yS + 30}" fill="#fff" stroke="#334155" stroke-width="1.6"/>`;
        s += texte(x1, yS - 36, "piézomètre ouvert", 'text-anchor="middle" style="font-size:10.5px;font-weight:700"');
        s += texte(x1 + 18, Y(ZC - 1.2), "bouchon", 'style="font-size:9.5px;fill:#57534e;font-weight:700"');
        s += texte(x1 + 18, Y(ZC) + 4, "cellule filtrante", 'style="font-size:9.5px;font-weight:700"');
        // Piézomètre à cellule (corde vibrante) : capteur scellé, câble.
        const x2 = X2;
        s += `<rect x="${x2 - 13}" y="${Y(ZC - 0.5)}" width="26" height="${k * L}" fill="#f3e5ae" stroke="#8a6d1f"/>`;
        s += `<rect x="${x2 - 5}" y="${Y(ZC) - 10}" width="10" height="20" rx="3" fill="#475569"/>`;
        s += ligne(x2, Y(ZC) - 10, x2, yS - 20, "#1e293b", 1.4) + `<rect x="${x2 - 26}" y="${yS - 44}" width="52" height="22" rx="4" fill="#0f172a"/>`;
        s += texte(x2, yS - 50, "capteur à cellule", 'text-anchor="middle" style="font-size:10.5px;font-weight:700"');
        s += `<g class="dyn-niveaux"></g>`;
        return s;
      },
    });
  }

  function dessiner() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    const h = niveau(e.t), x1 = X1, x2 = X2;
    let s = `<rect x="${x1 - 5}" y="${r1(Y(ZW) - h * k)}" width="10" height="${r1(Y(ZC + 0.5) - (Y(ZW) - h * k))}" fill="#7dd3fc"/>`;
    s += ligne(x1 - 14, Y(ZW) - h * k, x1 + 14, Y(ZW) - h * k, COULEURS.eau, 1.6);
    const uCell = 9.81 * (ZC - ZW); // kPa : le capteur lit aussitôt la pression d'équilibre
    s += texte(x2, yS - 29, `${fd(uCell, 1)} kPa`, 'text-anchor="middle" style="font-size:11px;font-weight:800;font-family:ui-monospace,Consolas,monospace;fill:#67e8f9"');
    svgEl.querySelector(".dyn-niveaux").innerHTML = s;
    c.lectures.innerHTML = lectures([["Temps", duree(e.t), ""], ["Niveau du tube / nappe", fd(h, 3), "m"], ["Remontée", fd(100 * (1 - h / e.h0), 1), "%"], ["Capteur à cellule", fd(9.81 * (ZC - ZW), 1), "kPa"]]);
  }

  function dessinerLent() {
    const zone = c.courbes.querySelector(".dyn-courbe");
    if (!zone) return;
    const M = e.mesures, T0 = e.r.T0;
    const g1 = graphe({
      largeur: 560, hauteur: 230, xmin: 0, xmax: e.tFin / T0, ymin: e.h0 * 1.05, ymax: 0.1, xlabel: "temps / T0", ylabel: "niveau dans le tube (m)",
      series: [{ points: M.map((m) => [m.t / T0, m.h]), couleur: COULEURS.bleu, marqueurs: true, epaisseur: 2, libelle: "piézomètre ouvert" }, { points: [[0, 0], [e.tFin / T0, 0]], couleur: COULEURS.f62, epaisseur: 2, libelle: "capteur à cellule (aussitôt à l'équilibre)" }],
    });
    const g2 = graphe({
      largeur: 560, hauteur: 220, xmin: 0, xmax: e.tFin / 3600, ymin: 0.005, ymax: 1.2, logY: true, xlabel: "temps (h)", ylabel: "(h_eq − h)/(h_eq − h0), log",
      series: [{ points: M.map((m) => [m.t / 3600, m.h / e.h0]), couleur: COULEURS.violet, marqueurs: true, epaisseur: 2, libelle: "droite de pente −1/T0" }],
    });
    zone.innerHTML = g1 + g2;
  }

  function bilan() {
    const M = e.mesures.filter((m) => m.h / e.h0 > 0.02);
    const a = M[1], z = M.at(-1);
    const T0 = (z.t - a.t) / Math.log(a.h / z.h);
    const kMes = e.r.A / (e.r.F * T0);
    c.bilan.innerHTML = `<p class="final-result">T0 = (t2 − t1)/ln(Δh1/Δh2) = <strong>${duree(T0)}</strong> ⇒ k = A/(F T0) = <strong>${sci(kMes, 3)} m/s</strong> ; 90 % de la remontée demande t90 = T0 ln 10 = ${duree(T0 * Math.log(10))}.
      <small>A = ${fd(e.r.A * 1e4, 2)} cm² (tube Ø ${f(e.dTube * 1000, 3)} mm), F = ${fd(e.r.F, 3)} m. Dans une argile, un tube ouvert met des jours ou des mois à suivre la nappe : on y pose un capteur à cellule.</small></p>`;
  }

  b = boucle({ avancer, dessiner, dessinerLent, surFin: bilan, surEtat: () => etatBoutons?.(), pasMax: Infinity });
  etatBoutons = brancherMarche(c, b, reinit);
  c.commandes.querySelectorAll("select").forEach((x) => x.addEventListener("change", () => { b.raz(); reinit(); etatBoutons(); }));
  reinit();
  etatBoutons();
}
