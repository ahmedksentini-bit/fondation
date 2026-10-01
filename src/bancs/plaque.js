// Banc d'essai : l'essai de plaque à deux cycles (chapitre 2). Sous un camion
// lesté, le vérin charge une plaque rigide de 600 mm posée sur la plateforme ;
// la poutre de référence porte le comparateur. Premier cycle jusqu'à 0,25 MPa,
// déchargement, second cycle jusqu'à 0,20 MPa : EV1 et EV2 en sortent, et
// leur rapport k = EV2/EV1 juge le compactage.
import { svg, ligne, texte, couche, COULEURS, graphe } from "../figures.js";
import { plaqueEV } from "../geotech/essais.js";
import { charpente, boucle, brancherMarche, lectures, fd, r1, esc, duree } from "./moteur.js";

const PLATEFORMES = {
  bonne: { nom: "couche de forme bien compactée", EV1: 75, EV2: 125 },
  moyenne: { nom: "remblai moyennement compacté", EV1: 38, EV2: 80 },
  mauvaise: { nom: "remblai mal compacté", EV1: 22, EV2: 62 },
  molle: { nom: "arase sur sol support humide", EV1: 14, EV2: 30 },
};
// Programme : paliers de pression (MPa) ; chaque palier tenu jusqu'à stabilisation (~ 2 min).
const PROGRAMME = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.125, 0, 0.05, 0.1, 0.15, 0.2];
const PALIER = 120; // s

export function monter(banc) {
  const c = charpente(banc, {
    vitesse: 10, vitesses: [1, 10, 100],
    commandes: `<div class="field"><label>Plateforme essayée</label><div class="input-wrap"><select data-r="pf">${Object.entries(PLATEFORMES).map(([k, x]) => `<option value="${k}">${esc(x.nom)}</option>`).join("")}</select></div></div>`,
  });
  let e, b, etatBoutons;

  const reinit = () => {
    const pf = PLATEFORMES[c.q('[data-r="pf"]').value];
    e = { pf, t: 0, i: 0, points: [{ p: 0, s: 0, cycle: 1 }], fini: false };
    c.scene.innerHTML = fond();
    c.courbes.innerHTML = '<div class="dyn-courbe"></div>';
    c.bilan.innerHTML = "";
    dessiner(); dessinerLent();
  };

  /**
   * Enfoncement (mm) sous la pression p : premier chargement non linéaire
   * (corde EV1 à 0,25 MPa), retour élastique au déchargement, second
   * chargement le long de la corde EV2 depuis le zéro du second cycle.
   */
  const R = 300;
  const enfoncement = (i) => {
    const p = PROGRAMME[i];
    const z1 = (1.5 * 0.25 * R) / e.pf.EV1; // à 0,25 MPa, premier cycle
    if (i <= 5) return z1 * (p / 0.25) ** 0.85; // courbe concave vers le bas
    const zRes = z1 - (1.5 * 0.25 * R) / (e.pf.EV2 * 1.25); // enfoncement résiduel après déchargement
    if (i <= 7) return zRes + (z1 - zRes) * (p / 0.25) ** 0.6; // peu de retour au début du déchargement
    return zRes + ((1.5 * p * R) / e.pf.EV2) * (p / 0.2) ** 0.15;
  };

  const avancer = (dt) => {
    if (e.fini) return false;
    let reste = dt;
    while (reste > 1e-9 && !e.fini) {
      const h = Math.min(reste, (e.i + 1) * PALIER - e.t);
      e.t += h; reste -= h;
      if (e.t >= (e.i + 1) * PALIER - 1e-9) {
        e.i++;
        if (e.i >= PROGRAMME.length) { e.fini = true; break; }
        e.points.push({ p: PROGRAMME[e.i], s: enfoncement(e.i) * (1 + 0.015 * Math.sin(e.i * 2.3 + e.pf.EV1)), cycle: e.i <= 5 ? 1 : e.i <= 7 ? 0 : 2 });
      }
    }
    return !e.fini;
  };

  const yP = 230;
  function fond() {
    return svg({
      largeur: 640, hauteur: 330, titre: "Essai de plaque", contenu: (id) => {
        let s = couche(id, { x: 10, y: yP, w: 620, h: 322 - yP, sol: "remblai" });
        s += ligne(10, yP, 630, yP, COULEURS.trait, 1.8) + texte(620, yP + 18, e.pf.nom, 'text-anchor="end" class="halo" style="font-size:10.5px;font-weight:700"');
        // Camion lesté (réaction), vérin, plaque ; poutre de référence et comparateur.
        s += `<rect x="150" y="40" width="330" height="70" rx="8" fill="#e2e8f0" stroke="#475569" stroke-width="1.3"/>`;
        s += `<rect x="160" y="50" width="120" height="50" rx="4" fill="#94a3b8"/>` + texte(220, 80, "lest", 'text-anchor="middle" style="font-size:11px;font-weight:800;fill:#fff"');
        for (const x of [190, 430]) s += `<circle cx="${x}" cy="${yP - 14}" r="14" fill="#334155"/><circle cx="${x}" cy="${yP - 14}" r="5" fill="#cbd5e1"/>`;
        s += `<rect x="186" y="110" width="8" height="${yP - 28 - 110}" fill="#475569"/><rect x="426" y="110" width="8" height="${yP - 28 - 110}" fill="#475569"/>`;
        s += ligne(40, yP - 70, 290, yP - 70, "#78350f", 3) + `<rect x="34" y="${yP - 70}" width="6" height="70" fill="#92400e"/>` + texte(40, yP - 78, "poutre de référence", 'style="font-size:10px;font-weight:700;fill:#78350f"');
        s += `<g class="dyn-plaque"></g>`;
        return s;
      },
    });
  }

  function dessiner() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    const p = e.fini ? PROGRAMME.at(-1) : PROGRAMME[e.i] ?? 0, z = e.points.at(-1).s;
    const yPl = yP - 8 + z * 1.2; // enfoncement exagéré
    let s = `<rect x="270" y="${r1(yPl)}" width="90" height="8" fill="#64748b" stroke="#1e293b"/>`;
    s += `<rect x="304" y="110" width="22" height="${r1(yPl - 110 - 30)}" fill="#cbd5e1" stroke="#475569"/><rect x="298" y="${r1(yPl - 30)}" width="34" height="30" rx="3" fill="#f59e0b" stroke="#92400e"/>`;
    s += texte(342, yPl - 12, "vérin", 'style="font-size:10px;font-weight:700;fill:#78350f"');
    // Comparateur posé sur la plaque, porté par la poutre.
    s += `<circle cx="280" cy="${yP - 90}" r="14" fill="#fff" stroke="#334155" stroke-width="1.5"/>` + ligne(280, yP - 76, 280, yPl, "#334155", 1.2);
    const a = ((z % 1) * 360 - 90) * Math.PI / 180;
    s += ligne(280, yP - 90, 280 + 11 * Math.cos(a), yP - 90 + 11 * Math.sin(a), COULEURS.effort, 1.8);
    if (p > 0) for (const dx of [-30, 0, 30]) s += ligne(315 + dx, yPl + 10, 315 + dx, yPl + 24, COULEURS.effort, 2, "");
    svgEl.querySelector(".dyn-plaque").innerHTML = s;
    c.lectures.innerHTML = lectures([["Cycle", e.fini ? "terminé" : e.i <= 5 ? "1er chargement" : e.i <= 7 ? "déchargement" : "2e chargement", ""], ["Pression", fd(p, 3), "MPa"], ["Enfoncement", fd(z, 2), "mm"], ["Temps", duree(e.t), ""]]);
  }

  function dessinerLent() {
    const zone = c.courbes.querySelector(".dyn-courbe");
    if (!zone) return;
    const P = e.points, zMax = Math.max(1, ...P.map((q) => q.s)) * 1.15;
    zone.innerHTML = graphe({
      largeur: 560, hauteur: 260, xmin: 0, xmax: 0.28, ymin: 0, ymax: zMax, inverserY: true, xlabel: "pression sous la plaque (MPa)", ylabel: "enfoncement (mm)",
      series: [
        { points: P.filter((q, i) => i <= 5).map((q) => [q.p, q.s]), couleur: COULEURS.f62, marqueurs: true, epaisseur: 2, libelle: "1er cycle" },
        ...(P.length > 6 ? [{ points: P.slice(5, 8).map((q) => [q.p, q.s]), couleur: COULEURS.discret, tirets: "4 3", marqueurs: true, libelle: "déchargement" }] : []),
        ...(P.length > 8 ? [{ points: P.slice(7).map((q) => [q.p, q.s]), couleur: COULEURS.ec7, marqueurs: true, epaisseur: 2, libelle: "2e cycle" }] : []),
      ],
    });
  }

  function bilan() {
    const z1 = e.points[5].s, z2 = e.points.at(-1).s - e.points[7].s;
    const r = plaqueEV({ z1, z2 });
    c.bilan.innerHTML = `<p class="final-result">z1 = ${fd(z1, 2)} mm à 0,25 MPa ⇒ EV1 = 112,5/z1 = <strong>${fd(r.EV1, 1)} MPa</strong> ;
        z2 = ${fd(z2, 2)} mm entre 0 et 0,20 MPa au second cycle ⇒ EV2 = 90/z2 = <strong>${fd(r.EV2, 1)} MPa</strong> ;
        k = EV2/EV1 = <strong>${fd(r.k, 2)}</strong> — compactage ${r.compactage}, classe ${r.classe}.
        <small>Un sol mal compacté tasse beaucoup au premier chargement puis se raidit : k grandit. Le calculateur qui suit refait le calcul pour d'autres lectures.</small></p>`;
  }

  b = boucle({ avancer, dessiner, dessinerLent, surFin: bilan, surEtat: () => etatBoutons?.(), pasMax: Infinity });
  etatBoutons = brancherMarche(c, b, reinit);
  c.commandes.querySelectorAll("select").forEach((x) => x.addEventListener("change", () => { b.raz(); reinit(); etatBoutons(); }));
  reinit();
  etatBoutons();
}
