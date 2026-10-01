// Banc d'essai : la sismique réfraction (chapitre 2). Un coup de masse sur une
// plaque émet une onde ; douze géophones, alignés tous les 5 m, enregistrent
// sa première arrivée. Près de la source, l'onde directe arrive la première ;
// au-delà de la distance critique, c'est l'onde réfractée, qui a parcouru le
// toit de la couche rapide. On regarde la scène au ralenti, puis
// l'hodochrone donne V1, V2 et l'épaisseur de la couche superficielle.
import { svg, ligne, texte, couche, COULEURS, graphe } from "../figures.js";
import { refraction } from "../geotech/essais.js";
import { charpente, boucle, brancherMarche, lectures, f, fd, r1, esc } from "./moteur.js";
import { fenetreLoupe, blocSol, etiquette, horloge, W as WL, H as HL } from "./loupe.js";

const SITES_SISMIQUES = {
  calcaire: { nom: "limon sur calcaire", V1: 500, V2: 2600, h: 6, sol1: "limon", sol2: "roche" },
  nappe: { nom: "sable sec sur sable sous la nappe", V1: 380, V2: 1600, h: 5, sol1: "sable", sol2: "sable" },
  marne: { nom: "remblai sur marne", V1: 300, V2: 1900, h: 5.5, sol1: "remblai", sol2: "marne" },
};
const ESPACEMENT = 5, N = 12;

export function monter(banc) {
  const c = charpente(banc, {
    vitesse: 0.01, vitesses: [0.002, 0.01, 0.05],
    commandes: `<div class="field" style="grid-column:span 2"><label>Site</label><div class="input-wrap"><select data-r="site">${Object.entries(SITES_SISMIQUES).map(([k, s]) => `<option value="${k}">${esc(s.nom)}</option>`).join("")}</select></div></div>
      <p class="method-note" style="grid-column:1/-1">Douze géophones tous les 5 m ; la scène se déroule au ralenti : quelques dizaines de millisecondes en tout.</p>`,
  });
  const loupe = fenetreLoupe(c, "la réfraction critique");
  let e, b, etatBoutons;

  const reinit = () => {
    const s = SITES_SISMIQUES[c.q('[data-r="site"]').value];
    const ti = (2 * s.h * Math.sqrt(s.V2 ** 2 - s.V1 ** 2)) / (s.V1 * s.V2);
    const arrivees = Array.from({ length: N }, (_, i) => {
      const x = (i + 1) * ESPACEMENT, td = x / s.V1, tr = x / s.V2 + ti;
      return { x, t: Math.min(td, tr) + 0.0004 * Math.sin(7.3 * i), type: td <= tr ? "directe" : "réfractée" };
    });
    e = { s, ti, arrivees, t: 0, tFin: Math.max(...arrivees.map((a) => a.t)) * 1.1, fini: false };
    c.scene.innerHTML = fond();
    c.courbes.innerHTML = '<div class="dyn-courbe"></div>';
    c.bilan.innerHTML = "";
    dessiner(); dessinerLent();
  };

  const avancer = (dt) => {
    if (e.fini) return false;
    e.t = Math.min(e.tFin, e.t + dt);
    if (e.t >= e.tFin - 1e-12) e.fini = true;
    return !e.fini;
  };

  const x0 = 40, kx = 9.5, yS = 90, kz = 16, Y = (z) => yS + z * kz, X = (x) => x0 + x * kx;
  function fond() {
    return svg({
      largeur: 640, hauteur: 330, titre: "Sismique réfraction", contenu: (id) => {
        let s = couche(id, { x: 10, y: yS, w: 620, h: e.s.h * kz, sol: e.s.sol1 }) + couche(id, { x: 10, y: Y(e.s.h), w: 620, h: 322 - Y(e.s.h), sol: e.s.sol2 });
        s += ligne(10, yS, 630, yS, COULEURS.trait, 1.8) + ligne(10, Y(e.s.h), 630, Y(e.s.h), COULEURS.trait, 1.2);
        s += texte(624, yS + 16, `V1 = ${f(e.s.V1, 4)} m/s`, 'text-anchor="end" class="halo" style="font-size:10.5px;font-weight:700"');
        s += texte(624, Y(e.s.h) + 16, `V2 = ${f(e.s.V2, 4)} m/s`, 'text-anchor="end" class="halo" style="font-size:10.5px;font-weight:700"');
        s += `<rect x="${x0 - 10}" y="${yS - 6}" width="20" height="6" fill="#475569"/>` + texte(x0, yS - 38, "source", 'text-anchor="middle" style="font-size:10px;font-weight:700"');
        for (let i = 1; i <= N; i++) s += `<path d="M${r1(X(i * ESPACEMENT))} ${yS}l-5 -12h10z" fill="#334155"/>`;
        s += texte(X(ESPACEMENT * 6.5), yS - 38, "géophones", 'text-anchor="middle" style="font-size:10px;font-weight:700"');
        s += `<defs><clipPath id="${e.clip = `${id}-c1`}"><rect x="10" y="${yS}" width="620" height="${e.s.h * kz}"/></clipPath><clipPath id="${id}-sc"><rect x="10" y="${yS - 30}" width="620" height="${330 - yS + 30}"/></clipPath></defs><g class="dyn-ondes" clip-path="url(#${id}-sc)"></g>`;
        return s;
      },
    });
  }

  function dessiner() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    const { V1, V2, h } = e.s, t = e.t, ic = Math.asin(V1 / V2);
    let s = "";
    // Onde directe : demi-cercle dans la couche superficielle.
    const r = V1 * t;
    s += `<g clip-path="url(#${e.clip})"><circle cx="${x0}" cy="${yS}" r="${r1(r * kx)}" fill="none" stroke="${COULEURS.bleu}" stroke-width="2" opacity=".8"/></g>`;
    // Onde réfractée : elle file le long du toit à V2, et renvoie vers le haut des ondes coniques.
    const xc = h * Math.tan(ic), tCrit = h / Math.cos(ic) / V1;
    if (t > tCrit) {
      const xf = xc + V2 * (t - tCrit);
      s += ligne(x0 + xc * kx, Y(h), X(xf), Y(h), COULEURS.effort, 2.4);
      // Front conique : droite issue du point courant, inclinée de ic sur la verticale.
      const dz = Math.min(h, (xf - xc) / Math.tan(ic));
      s += ligne(X(xf), Y(h), X(xf - dz * Math.tan(ic)), Y(h - dz), COULEURS.effort, 1.6, 'stroke-dasharray="5 3"');
    }
    // Géophones déclenchés.
    for (const a of e.arrivees) if (a.t <= t) s += `<circle cx="${r1(X(a.x))}" cy="${yS - 20}" r="4" fill="${a.type === "directe" ? COULEURS.bleu : COULEURS.effort}"/>`;
    svgEl.querySelector(".dyn-ondes").innerHTML = s;
    c.lectures.innerHTML = lectures([["Temps depuis le coup", fd(t * 1000, 1), "ms"], ["Géophones atteints", `${e.arrivees.filter((a) => a.t <= t).length} / ${N}`, ""]]);
    loupe(...vueLoupe());
  }

  // ── Loupe : au toit de la couche rapide, l'onde arrive sous l'angle critique et longe l'interface ──
  const YI = 96, XA = 46; // interface, point de réfraction critique
  function vueLoupe() {
    const { V1, V2 } = e.s, ic = Math.asin(V1 / V2), sn = Math.sin(ic), cs = Math.cos(ic);
    let s = blocSol(e.s.sol1, { x0: 0, x1: WL, y0: 0, y1: YI, k: 300 }) + blocSol(e.s.sol2, { x0: 0, x1: WL, y0: YI, y1: HL, k: 300 });
    s += `<path d="M0 ${YI}H${WL}" stroke="#0f172a" stroke-width="1.6"/>`;
    // Rayons : incident sous l'angle critique, réfracté le long de l'interface, réémis vers la surface.
    const S = [XA - 100 * sn, YI - 100 * cs], B = [148, YI], Hh = [148 + 100 * sn, YI - 100 * cs];
    s += `<path d="M${XA} ${YI - 58}V${YI + 40}" stroke="#475569" stroke-width="1" stroke-dasharray="4 3"/>`;
    s += `<path d="M${r1(S[0])} ${r1(S[1])}L${XA} ${YI}L${B[0]} ${YI}L${r1(Hh[0])} ${r1(Hh[1])}" fill="none" stroke="#dc2626" stroke-width="2.2"/>`;
    s += `<path d="M${XA} ${YI}L${r1(XA + 100 * sn)} ${r1(YI - 100 * cs)}" stroke="#dc2626" stroke-width="1.1" stroke-dasharray="4 3" opacity=".6"/>`;
    for (const x of [78, 112]) s += `<path d="M${x} ${YI}L${r1(x + 26 * sn)} ${r1(YI - 26 * cs)}" stroke="#dc2626" stroke-width="1.1" stroke-dasharray="3 2"/>`;
    // Angle critique entre la normale et le rayon incident.
    const ra = 26, a0 = -Math.PI / 2, a1 = -Math.PI / 2 - ic;
    s += `<path d="M${r1(XA + ra * Math.cos(a0))} ${r1(YI + ra * Math.sin(a0))}A${ra} ${ra} 0 0 0 ${r1(XA + ra * Math.cos(a1))} ${r1(YI + ra * Math.sin(a1))}" fill="none" stroke="#0f172a" stroke-width="1.3"/>`;
    s += etiquette(XA + 4, YI - ra - 5, `ic = ${fd((ic * 180) / Math.PI, 1)}°`);
    // L'impulsion parcourt le chemin pendant que l'essai tourne.
    if (e.t > 0) {
      const L1 = 100, L2 = B[0] - XA, tot = 2 * L1 + L2, q = ((horloge() * 0.45) % 1) * tot;
      const P = q < L1 ? [S[0] + (XA - S[0]) * (q / L1), S[1] + (YI - S[1]) * (q / L1)] : q < L1 + L2 ? [XA + (q - L1), YI] : [B[0] + (Hh[0] - B[0]) * ((q - L1 - L2) / L1), YI + (Hh[1] - YI) * ((q - L1 - L2) / L1)];
      s += `<circle cx="${r1(P[0])}" cy="${r1(P[1])}" r="4.5" fill="#fbbf24" stroke="#b45309" stroke-width="1.4"/>`;
    }
    s += etiquette(WL - 6, 14, `V1 = ${f(V1, 4)} m/s`, { ancre: "end" }) + etiquette(WL - 6, YI + 16, `V2 = ${f(V2, 4)} m/s`, { ancre: "end" });
    s += etiquette(8, HL - 10, "sin ic = V1 / V2", { couleur: "#b91c1c" });
    return [s, `réfraction critique : sin ic = V1/V2, ic = ${fd((ic * 180) / Math.PI, 1)}° ; l'onde longe le toit de la couche 2 à V2`];
  }

  function dessinerLent() {
    const zone = c.courbes.querySelector(".dyn-courbe");
    if (!zone) return;
    const lus = e.arrivees.filter((a) => a.t <= e.t);
    const series = [
      { points: lus.filter((a) => a.type === "directe").map((a) => [a.x, a.t * 1000]), couleur: COULEURS.bleu, nuage: true, libelle: "première arrivée : onde directe" },
      { points: lus.filter((a) => a.type !== "directe").map((a) => [a.x, a.t * 1000]), couleur: COULEURS.effort, nuage: true, libelle: "première arrivée : onde réfractée" },
    ];
    if (e.fini) {
      const d = e.arrivees.filter((a) => a.type === "directe"), rf = e.arrivees.filter((a) => a.type !== "directe");
      const V1 = d.reduce((s2, a) => s2 + a.x, 0) / d.reduce((s2, a) => s2 + a.t, 0);
      const reg = ((pts) => { const n = pts.length, mx = pts.reduce((s2, a) => s2 + a.x, 0) / n, mt = pts.reduce((s2, a) => s2 + a.t, 0) / n; let sxx = 0, sxt = 0; for (const a of pts) { sxx += (a.x - mx) ** 2; sxt += (a.x - mx) * (a.t - mt); } const p = sxt / sxx; return { p, ti: mt - p * mx }; })(rf);
      e.lecture = { V1, V2: 1 / reg.p, ti: reg.ti };
      series.push({ points: [[0, 0], [N * ESPACEMENT, (N * ESPACEMENT) / V1 * 1000]], couleur: COULEURS.bleu, tirets: "5 3", libelle: `pente 1/V1 : V1 = ${f(V1, 3)} m/s` });
      series.push({ points: [[0, reg.ti * 1000], [N * ESPACEMENT, (reg.ti + reg.p * N * ESPACEMENT) * 1000]], couleur: COULEURS.effort, tirets: "5 3", libelle: `pente 1/V2 : V2 = ${f(1 / reg.p, 3)} m/s, ti = ${fd(reg.ti * 1000, 1)} ms` });
    }
    zone.innerHTML = graphe({ largeur: 560, hauteur: 270, xmin: 0, xmax: N * ESPACEMENT + 3, ymin: 0, ymax: e.tFin * 1000 * 1.05, xlabel: "distance à la source x (m)", ylabel: "temps de première arrivée (ms)", series });
  }

  function bilan() {
    dessinerLent();
    const l = e.lecture, xc = (l.ti * l.V1 * l.V2) / (l.V2 - l.V1);
    const r = refraction({ V1: l.V1, V2: l.V2, xc, ti: l.ti });
    c.bilan.innerHTML = `<p class="final-result">Hodochrone : V1 = <strong>${f(l.V1, 3)} m/s</strong>, V2 = <strong>${f(l.V2, 3)} m/s</strong>, temps d'intercept ti = ${fd(l.ti * 1000, 1)} ms ⇒
        épaisseur h = ti V1 V2/[2 √(V2² − V1²)] = <strong>${fd(r.hT, 2)} m</strong> (par la distance critique xc = ${fd(xc, 1)} m : ${fd(r.hX, 2)} m).
        <small>Le banc avait h = ${fd(e.s.h, 1)} m. La réfraction ne voit qu'une couche plus rapide que celle du dessus : une couche lente sous une couche rapide reste invisible.</small></p>`;
  }

  b = boucle({ avancer, dessiner, dessinerLent, surFin: bilan, surEtat: () => etatBoutons?.(), pasMax: Infinity });
  etatBoutons = brancherMarche(c, b, reinit);
  c.commandes.querySelectorAll("select").forEach((x) => x.addEventListener("change", () => { b.raz(); reinit(); etatBoutons(); }));
  reinit();
  etatBoutons();
}
