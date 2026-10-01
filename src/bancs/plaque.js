// Banc d'essai : l'essai de plaque à deux cycles (chapitre 2). Sous un camion
// lesté, le vérin charge une plaque rigide de 600 mm posée sur la plateforme ;
// la poutre de référence porte le comparateur. Premier cycle jusqu'à 0,25 MPa,
// déchargement, second cycle jusqu'à 0,20 MPa : EV1 et EV2 en sortent, et
// leur rapport k = EV2/EV1 juge le compactage.
import { svg, ligne, texte, couche, COULEURS, graphe } from "../figures.js";
import { plaqueEV } from "../geotech/essais.js";
import { charpente, boucle, brancherMarche, lectures, fd, r1, esc, duree } from "./moteur.js";
import { fenetreLoupe, blocSol, fleche, etiquette, W as WL, H as HL, ROUGE, ACIER, ACIER_SOMBRE, TRAIT } from "./loupe.js";

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
  const loupe = fenetreLoupe(c, "le sol sous la plaque", { echelle: { px: 30, libelle: "10 cm" } });
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
    loupe(...vueLoupe());
  }

  // ── Loupe : la demi-plaque et le sol qu'elle enfonce (déplacements ×10) ───
  const KL = 300, XA = 6, RP = 0.3 * KL, YS = 46, EXAG = 10; // px/m, axe, rayon de la plaque, surface du sol
  function vueLoupe() {
    const p = e.fini ? PROGRAMME.at(-1) : PROGRAMME[e.i] ?? 0, z = e.points.at(-1).s;
    const sp = (z / 1000) * KL * EXAG; // enfoncement dessiné (px)
    // Déplacement vertical du sol : entier sous la plaque, amorti en profondeur et au-delà du bord.
    const w = (x, y) => { const r = x - XA, prof = Math.max(0, y - YS); return sp * (r <= RP ? 1 : Math.exp(-(r - RP) / 22)) / (1 + (prof / 75) ** 2) ** 1.2; };
    let s = `<rect width="${WL}" height="${HL}" fill="#f8fafc"/>`;
    s += blocSol("remblai", { x0: 0, x1: WL, y0: YS, y1: HL + 30, k: 1000, deplacer: (x, y) => [x, y + w(x, y)] });
    // Surface déformée : cuvette sous la plaque.
    let surf = `M0 ${YS + sp}`;
    for (let x = XA; x <= WL; x += 4) surf += `L${x} ${r1(YS + w(x, YS))}`;
    s += `<path d="${surf}L${WL} 0H0Z" fill="#f8fafc"/><path d="${surf.replace("M0", "M" + XA)}" fill="none" stroke="${TRAIT}" stroke-width="1.4"/>`;
    // Bulbe des contraintes : isobares d'autant plus marquées que la pression est forte.
    for (const [a, b] of [[0.95, 1.1], [1.45, 2], [2.1, 3.2]]) s += `<path d="M${XA} ${r1(YS + sp)}A${r1(a * RP)} ${r1(b * RP)} 0 0 1 ${XA} ${r1(YS + sp + 2 * b * RP)}" fill="none" stroke="${ROUGE}" stroke-width="1.1" stroke-dasharray="4 3" opacity="${r1(Math.min(1, p / 0.25) * 0.8)}"/>`;
    // Plaque rigide, vérin, pression appliquée.
    s += `<rect x="0" y="${r1(YS - 12 + sp)}" width="${XA + RP}" height="12" fill="${ACIER_SOMBRE}" stroke="#1e293b"/>`;
    s += `<rect x="0" y="0" width="${XA + 30}" height="${r1(YS - 12 + sp)}" fill="${ACIER}" stroke="${ACIER_SOMBRE}"/>`;
    if (p > 0) for (const x of [52, 72, 92]) s += fleche(x, YS - 14 + sp - 6 - 22 * (p / 0.25), x, YS - 14 + sp, ROUGE, 1.8, 5);
    s += `<path d="M${XA} 0V${HL}" stroke="#475569" stroke-dasharray="8 3 2 3"/>`;
    s += etiquette(WL - 6, 13, `déplacements ×${EXAG}`, { ancre: "end", couleur: "#475569" }) + etiquette(XA + RP + 4, YS - 16 + sp, "bord", { couleur: "#475569" });
    const cyc = e.fini ? 3 : e.i <= 5 ? 1 : e.i <= 7 ? 0 : 2;
    const legende = e.t === 0 && e.i === 0 ? "plaque posée sur la plateforme, avant chargement"
      : cyc === 1 ? `1er chargement : la plaque enfonce et serre le sol (${fd(z, 2)} mm)`
        : cyc === 0 ? "déchargement : le sol ne remonte qu'en partie, le tassement reste"
          : cyc === 2 ? "2e chargement : le sol, déjà serré, est plus raide" : "deux cycles lus : EV1, EV2 et leur rapport";
    return [s, legende];
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
