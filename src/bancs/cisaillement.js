// Banc d'essai : la boîte de cisaillement (chapitres 1 et 2). L'éprouvette est
// enfermée entre deux demi-boîtes ; on la charge d'une contrainte normale σ,
// puis on déplace la demi-boîte inférieure à vitesse constante et l'on mesure
// la force de cisaillement et le mouvement vertical. Trois éprouvettes sous
// trois contraintes placent trois points (σ, τ max) : la droite de Coulomb
// donne c' et φ'. Un sable dense passe par un pic et se dilate ; un sable
// lâche se contracte et n'a pas de pic.
import { svg, ligne, texte, COULEURS, graphe } from "../figures.js";
import { droiteCoulomb } from "../geotech/essais.js";
import { charpente, boucle, lectures, f, fd, r1, esc } from "./moteur.js";
import { fenetreLoupe, blocSol, fleche, etiquette, W as WL, H as HL, ROUGE, ACIER_SOMBRE } from "./loupe.js";

const RAD = Math.PI / 180;
const MATERIAUX = {
  "sable-dense": { nom: "sable dense", c: 0, phiP: 40, phiCv: 32, dp: 1.8, psi: 11, vitesse: 0.5,
    note: "Le sable dense doit son pic à la dilatance : en grands déplacements, il cesse de se dilater et τ redescend vers l'état critique" },
  "sable-lache": { nom: "sable lâche", c: 0, phiP: 32, phiCv: 32, dp: 5.5, psi: -3, vitesse: 0.5,
    note: "Le sable lâche n'a pas de pic : il se contracte et rejoint directement l'état critique" },
  "argile-sc": { nom: "argile surconsolidée (essai drainé lent)", c: 14, phiP: 25, phiCv: 22, dp: 1.4, psi: 3, vitesse: 0.01,
    note: "Cisaillée assez lentement pour rester drainée (plusieurs heures par éprouvette), l'argile surconsolidée passe par un petit pic ; la cohésion c' disparaît à l'état critique" },
  eboulis: { nom: "éboulis grossiers (boîte en place 300 × 300 mm)", c: 6, phiP: 43, phiCv: 37, dp: 6, psi: 9, vitesse: 1,
    note: "Les éléments grossiers interdisent la petite boîte de laboratoire : on taille un bloc au fond d'un puits et on le cisaille en place, dans une grande boîte" },
};
const DMAX = 10; // mm de déplacement horizontal

export function monter(banc) {
  const c = charpente(banc, {
    boutons: false,
    commandes: `
      <div class="field"><label>Matériau</label><div class="input-wrap"><select data-r="mat">${Object.entries(MATERIAUX).map(([k, m]) => `<option value="${k}">${esc(m.nom)}</option>`).join("")}</select></div></div>
      <div class="field"><label>Contrainte normale σ</label><div class="input-wrap"><input data-r="sigma" type="text" inputmode="decimal" value="50" data-curseur="10 400 5"><span class="unit">kPa</span></div></div>`,
  });
  c.commandes.insertAdjacentHTML("beforeend", `<div class="banc-marche">
      <button type="button" class="primary" data-action="essai">Cisailler une éprouvette</button>
      <span class="banc-vitesses" role="group" aria-label="Vitesse de l'essai">${[10, 100, 1000].map((v) => `<button type="button" class="ghost${v === 100 ? " actif" : ""}" data-vitesse="${v}">×${f(v, 4)}</button>`).join("")}</span>
      <button type="button" class="ghost" data-action="fin">Finir l'éprouvette</button>
      <button type="button" class="ghost" data-action="raz">Nouvelle série</button></div>`);
  const loupe = fenetreLoupe(c, "le plan de cisaillement");
  let e, b;

  const reinit = () => {
    const m = MATERIAUX[c.q('[data-r="mat"]').value];
    e = { m, eprouvettes: [], courante: null, t: 0 };
    c.scene.innerHTML = fond();
    c.courbes.innerHTML = '<div class="dyn-courbe"></div>';
    c.bilan.innerHTML = "";
    dessiner(); majBouton();
  };

  /** Contrainte de cisaillement (kPa) et mouvement vertical (mm, > 0 : dilatance) pour un déplacement d (mm). */
  const loi = (m, sigma, d) => {
    const tp = m.c + sigma * Math.tan(m.phiP * RAD) * (1 - 0.03 * Math.log10(sigma / 50) * (m.phiP > m.phiCv ? 1 : 0));
    const tcv = sigma * Math.tan(m.phiCv * RAD) + 0.3 * m.c;
    const u = d / m.dp;
    const tau = u <= 1 ? tp * (1 - Math.exp(-3 * u)) / (1 - Math.exp(-3)) : tcv + (tp - tcv) * Math.exp(-(d - m.dp) / 2.2);
    const contr = -0.04 * Math.min(1, u * 2) * (50 / Math.max(sigma, 10)) ** 0.2;
    // Dilatance : d'autant plus faible que σ est fort ; elle s'éteint en grands déplacements (palier).
    const dil = m.psi > 0
      ? Math.tan(m.psi * RAD * Math.min(1.3, (50 / Math.max(sigma, 10)) ** 0.3)) * 2.2 * (1 - Math.exp(-Math.max(0, d - m.dp * 0.5) / 2.2))
      : Math.tan(m.psi * RAD) * (Math.max(sigma, 10) / 50) ** 0.2 * 4 * (1 - Math.exp(-d / 4));
    return { tau, v: contr + dil };
  };

  const lireSigma = () => Math.max(5, parseFloat(String(c.q('[data-r="sigma"]').value).replace(",", ".")) || 50);
  const lancer = () => {
    if (e.courante) return;
    const sigma = lireSigma();
    e.courante = { sigma, d: 0, points: [{ d: 0, tau: 0, v: 0 }], t: 0 };
    b.raz(); b.lancer(); majBouton();
  };
  const avancer = (dt) => {
    const k = e.courante;
    if (!k) return false;
    k.t += dt;
    const d = Math.min(DMAX, (k.t / 60) * e.m.vitesse);
    while (k.points.at(-1).d + 0.1 <= d + 1e-9) { const dd = k.points.at(-1).d + 0.1, r = loi(e.m, k.sigma, dd); k.points.push({ d: dd, tau: r.tau, v: r.v }); }
    k.d = d;
    if (d >= DMAX - 1e-9) {
      k.tauMax = Math.max(...k.points.map((p) => p.tau));
      e.eprouvettes.push(k); e.courante = null;
      dessinerCourbes(); bilan(); majBouton();
      const proposes = [50, 100, 200, 300];
      const suivant = proposes.find((x) => !e.eprouvettes.some((y) => Math.abs(y.sigma - x) < 1)) ?? 400;
      const champ = c.q('[data-r="sigma"]'); champ.value = String(suivant); champ.dispatchEvent(new Event("input"));
      return false;
    }
    return true;
  };

  function fond() {
    return svg({
      largeur: 640, hauteur: 300, titre: "Boîte de cisaillement", contenu: () => {
        let s = `<rect x="40" y="250" width="560" height="14" rx="3" fill="#64748b"/>`;
        s += `<rect x="60" y="210" width="40" height="40" rx="4" fill="#94a3b8" stroke="#475569"/>` + texte(80, 204, "moteur", 'text-anchor="middle" style="font-size:10px;font-weight:700"');
        s += `<rect x="470" y="128" width="30" height="40" rx="15" fill="none" stroke="#b45309" stroke-width="5"/>` + texte(485, 118, "anneau dynamométrique", 'text-anchor="middle" style="font-size:10px;font-weight:700;fill:#78350f"');
        s += `<rect x="540" y="120" width="16" height="56" fill="#94a3b8" stroke="#475569"/>`;
        s += `<g class="dyn-boite"></g>`;
        return s;
      },
    });
  }

  function dessiner() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    const k = e.courante, d = k ? k.d : 0, last = k?.points.at(-1) ?? { tau: 0, v: 0 };
    const kx = 7, dx = d * kx * 0.6, dv = (last.v ?? 0) * 18;
    let s = "";
    // Demi-boîte inférieure (mobile) et supérieure (retenue par l'anneau).
    s += `<rect x="${r1(220 + dx)}" y="190" width="200" height="50" fill="#cbd5e1" stroke="#334155" stroke-width="1.5"/>`;
    s += `<rect x="${r1(232 + dx)}" y="190" width="176" height="38" fill="#a78b6d"/>`;
    s += `<rect x="220" y="${r1(140 - dv)}" width="200" height="50" fill="#e2e8f0" stroke="#334155" stroke-width="1.5"/>`;
    s += `<rect x="232" y="${r1(152 - dv)}" width="176" height="38" fill="#a78b6d"/>`;
    s += ligne(232, 190, 408 + dx, 190, "#7f1d1d", 1.6, 'stroke-dasharray="5 3"') + texte(424 + dx, 194, "plan de cisaillement", 'style="font-size:9.5px;font-weight:700;fill:#7f1d1d"');
    s += `<rect x="236" y="${r1(130 - dv)}" width="168" height="10" fill="#475569"/>`;
    s += ligne(320, 60, 320, 128 - dv, COULEURS.effort, 3, "") + `<path d="M313 ${r1(118 - dv)}l7 10 7-10z" fill="${COULEURS.effort}"/>` + texte(330, 76, `σ = ${f(k?.sigma ?? lireSigma(), 3)} kPa`, `style="font-size:11px;font-weight:800;fill:${COULEURS.effort}"`);
    s += ligne(100, 230, 220 + dx, 230, "#334155", 4);
    s += ligne(420, 165 - dv, 470, 148, "#334155", 3);
    svgEl.querySelector(".dyn-boite").innerHTML = s;
    c.lectures.innerHTML = lectures([["Éprouvette", k ? `n° ${e.eprouvettes.length + 1}` : "—", ""], ["σ", k ? f(k.sigma, 3) : "—", "kPa"], ["Déplacement", fd(d, 2), "mm"],
      ["τ", k ? fd(last.tau, 1) : "—", "kPa"], ["Mouvement vertical", k ? fd(last.v, 3) : "—", "mm"]]);
    loupe(...vueLoupe());
  }

  // ── Loupe : les grains de part et d'autre du plan de cisaillement ─────────
  const KX = 6, KV = 25, YPL = 88; // px par mm (horizontal, vertical exagéré), plan de cisaillement
  function vueLoupe() {
    const k = e.courante ?? e.eprouvettes.at(-1), m = e.m;
    const pt = k?.points.at(-1) ?? { d: 0, tau: 0, v: 0 }, d = k ? (e.courante ? k.d : DMAX) : 0, v = pt.v ?? 0;
    const sol = m === MATERIAUX.eboulis ? "grave" : m === MATERIAUX["argile-sc"] ? "argile" : "sable";
    const dx = d * KX, dv = -v * KV; // la demi-boîte du bas glisse ; celle du haut monte (dilatance) ou descend
    let s = `<rect width="${WL}" height="${HL}" fill="#f1f5f9"/>`;
    s += blocSol(sol, { x0: 0, x1: WL, y0: 22 + dv, y1: YPL + dv, k: 1000, decalageY: 3 });
    s += blocSol(sol, { x0: 0, x1: WL, y0: YPL, y1: 154, k: 1000, decalageX: dx, decalageY: 41 });
    // Grains du plan : ils roulent (sable), s'orientent (argile) ou s'enchevêtrent (éboulis).
    const tauMax = Math.max(1, ...(k?.points ?? []).map((q) => q.tau));
    for (let i = -1; i < 16; i++) {
      const x = ((i * 12 + dx / 2) % (WL + 12) + WL + 12) % (WL + 12) - 6, y = YPL + dv / 2;
      if (sol === "argile") {
        const a = (i % 2 ? 1 : -1) * 32 * Math.exp(-d / (2 * m.dp)), c2 = Math.cos((a * Math.PI) / 180) * 5, s2 = Math.sin((a * Math.PI) / 180) * 5;
        s += `<path d="M${r1(x - c2)} ${r1(y - s2)}L${r1(x + c2)} ${r1(y + s2)}" stroke="#7c2d12" stroke-width="2" stroke-linecap="round"/>`;
      } else if (i % 2 === 0) {
        // Un grain sur deux, de taille et de hauteur variables : ils roulent à mi-vitesse.
        const h = Math.abs(Math.sin(i * 12.9898)), r = (sol === "grave" ? 5.5 : 3.8) + 2.2 * h, yy = y + (h - 0.5) * 4, a = dx / 2 / r + i;
        s += `<circle cx="${r1(x)}" cy="${r1(yy)}" r="${r1(r)}" fill="${sol === "grave" ? "#d6c48f" : "#e9d38a"}" stroke="#78350f" stroke-width="1"/>`;
        s += `<path d="M${r1(x)} ${r1(yy)}L${r1(x + r * Math.cos(a))} ${r1(yy + r * Math.sin(a))}" stroke="#78350f" stroke-width="1"/>`;
      }
    }
    // Trait repère, continu avant l'essai : sa partie basse suit la demi-boîte qui glisse.
    s += `<path d="M40 ${r1(22 + dv)}V${r1(YPL + dv)}M${r1(40 + dx)} ${YPL}V154" stroke="#0f172a" stroke-width="1.6" stroke-dasharray="5 3"/>`;
    s += `<path d="M0 ${r1(YPL + dv / 2)}H${WL}" stroke="${ROUGE}" stroke-width="1.2" stroke-dasharray="5 3" opacity=".8"/>`;
    // Piston de chargement, contrainte normale ; déplacement imposé en bas, réaction τ en haut.
    s += `<rect x="0" y="${r1(10 + dv)}" width="${WL}" height="12" fill="${ACIER_SOMBRE}"/>`;
    for (const x of [44, 88, 132]) s += fleche(x, 0, x, 9 + dv, ROUGE, 1.8, 5);
    if (k) {
      s += fleche(24, 140, 24 + 10 + Math.min(40, dx), 140, "#0f766e", 2.2, 6) + etiquette(28, 158, `d = ${fd(d, 1)} mm`, { couleur: "#0f766e" });
      const lt = 6 + 30 * (pt.tau / tauMax);
      s += fleche(WL - 20, 46 + dv, WL - 20 - lt, 46 + dv, ROUGE, 2, 6) + etiquette(WL - 8, 62 + dv, `τ = ${f(pt.tau, 3)} kPa`, { ancre: "end", couleur: ROUGE });
    }
    s += etiquette(WL - 8, 34 + dv, `σ = ${f(k?.sigma ?? lireSigma(), 3)} kPa`, { ancre: "end", couleur: ROUGE });
    const pic = k && d > m.dp;
    const legende = !k ? "posez une éprouvette, puis cisaillez-la"
      : !pic ? "le cisaillement se mobilise : les grains se serrent"
        : sol === "argile" ? "pic franchi : les feuillets s'orientent dans le plan de cisaillement"
          : sol === "grave" ? "pic franchi : les blocs enchevêtrés se chevauchent, l'éboulis se dilate"
          : m.psi > 0 ? "pic franchi : les grains roulent les uns sur les autres, le sol se dilate"
            : "les grains se rangent dans les vides : le sable lâche se contracte";
    return [s, legende];
  }

  function dessinerCourbes() {
    const zone = c.courbes.querySelector(".dyn-courbe");
    if (!zone) return;
    const toutes = [...e.eprouvettes, ...(e.courante ? [e.courante] : [])];
    if (!toutes.length) { zone.innerHTML = ""; return; }
    const teintes = [COULEURS.ec7, COULEURS.f62, COULEURS.violet, COULEURS.bleu, COULEURS.rouge];
    const tMax = Math.max(...toutes.flatMap((k) => k.points.map((p) => p.tau)), 10) * 1.12;
    const g1 = graphe({ largeur: 560, hauteur: 240, xmin: 0, xmax: DMAX, ymin: 0, ymax: tMax, xlabel: "déplacement horizontal (mm)", ylabel: "τ (kPa)",
      series: toutes.map((k, i) => ({ points: k.points.map((p) => [p.d, p.tau]), couleur: teintes[i % 5], epaisseur: 2, libelle: `σ = ${f(k.sigma, 3)} kPa` })) });
    const vs = toutes.flatMap((k) => k.points.map((p) => p.v));
    const g2 = graphe({ largeur: 560, hauteur: 200, xmin: 0, xmax: DMAX, ymin: Math.min(-0.1, ...vs) * 1.2, ymax: Math.max(0.1, ...vs) * 1.2, xlabel: "déplacement horizontal (mm)", ylabel: "déplacement vertical (mm)",
      textes: [{ x: 9.2, y: Math.max(0.1, ...vs) * 0.9, texte: "dilatance" }, { x: 9.2, y: Math.min(-0.1, ...vs) * 0.8, texte: "contractance" }],
      series: toutes.map((k, i) => ({ points: k.points.map((p) => [p.d, p.v]), couleur: teintes[i % 5], epaisseur: 2 })) });
    let g3 = "";
    if (e.eprouvettes.length) {
      const pts = e.eprouvettes.map((k) => [k.sigma, k.tauMax]);
      const sMax = Math.max(...pts.map((p) => p[0])) * 1.25;
      const dc = pts.length >= 2 ? droiteCoulomb(pts.map(([s2, t]) => ({ sigma: s2, tau: t }))) : null;
      g3 = graphe({ largeur: 560, hauteur: 250, xmin: 0, xmax: sMax, ymin: 0, ymax: Math.max(...pts.map((p) => p[1])) * 1.3, xlabel: "contrainte normale σ (kPa)", ylabel: "τ max (kPa)",
        series: [{ points: pts, couleur: COULEURS.encre, nuage: true, libelle: "τ max de chaque éprouvette" },
          ...(dc?.applicable ? [{ points: [[0, dc.c], [sMax, dc.c + sMax * Math.tan(dc.phi * RAD)]], couleur: COULEURS.rouge, epaisseur: 1.8, libelle: `droite de Coulomb : c' = ${fd(dc.c, 1)} kPa, φ' = ${fd(dc.phi, 1)}°` }] : [])] });
    }
    zone.innerHTML = g1 + g2 + g3;
  }

  function bilan() {
    const pts = e.eprouvettes.map((k) => ({ sigma: k.sigma, tau: k.tauMax }));
    if (pts.length < 2) { c.bilan.innerHTML = '<p class="method-note">Cisaillez au moins deux éprouvettes, sous deux contraintes différentes, pour tracer la droite de Coulomb.</p>'; return; }
    const dc = droiteCoulomb(pts);
    if (!dc.applicable) { c.bilan.innerHTML = '<p class="method-note">Les éprouvettes ont toutes été cisaillées sous la même contrainte normale : changez σ pour la suivante.</p>'; return; }
    c.bilan.innerHTML = `<p class="final-result">Droite de Coulomb sur ${pts.length} éprouvettes : c' = <strong>${fd(dc.c, 1)} kPa</strong>, φ' = <strong>${fd(dc.phi, 1)}°</strong>
        sur les pics ; le palier de fin d'essai donne l'angle de l'état critique, φ'<sub>cv</sub> ≈ ${fd(e.m.phiCv, 0)}°.
        <small>${e.m.note}.</small></p>`;
  }

  const majBouton = () => {
    const bt = c.q('[data-action="essai"]');
    bt.disabled = !!e.courante;
    bt.textContent = e.courante ? "Cisaillement en cours…" : `Cisailler une éprouvette sous σ = ${c.q('[data-r="sigma"]').value} kPa`;
  };

  b = boucle({ avancer, dessiner, dessinerLent: dessinerCourbes });
  b.vitesse(100);
  c.q('[data-action="essai"]').addEventListener("click", lancer);
  c.q('[data-action="fin"]').addEventListener("click", () => { if (e.courante) b.finir(60); });
  c.q('[data-action="raz"]').addEventListener("click", () => { b.raz(); reinit(); });
  c.q('[data-r="mat"]').addEventListener("change", () => { b.raz(); reinit(); });
  c.q('[data-r="sigma"]').addEventListener("input", () => { majBouton(); if (!e.courante) dessiner(); });
  c.corps.querySelectorAll("[data-vitesse]").forEach((x) => x.addEventListener("click", () => {
    c.corps.querySelectorAll("[data-vitesse]").forEach((y) => y.classList.toggle("actif", y === x));
    b.vitesse(Number(x.dataset.vitesse));
  }));
  reinit();
}
