// Banc d'essai : masse volumique et teneur en eau en place au gammadensimètre
// (chapitre 8 ; NF P94-061-1, transmission directe). En chaque point de la
// couche, on enfonce au marteau une tige-guide à travers la plaque de
// guidage, on la retire, on pose l'appareil et l'on descend la source de
// césium 137 dans le trou, à 15, 20 ou 30 cm ; les détecteurs de l'embase
// comptent pendant une minute les photons qui ont traversé le sol — d'autant
// moins que le sol est dense : la courbe d'étalonnage donne ρh. En même temps,
// la source neutronique (américium-béryllium) de l'embase, en rétrodiffusion,
// mesure la masse d'eau par unité de volume, d'où w puis ρd = ρh/(1 + w).
// Le taux de compactage rapporte ρd à la référence ρdOPN. La mesure en
// transmission directe est la moyenne du sol traversé entre la source et la
// surface : la source à 15 cm ne voit pas le fond d'une couche de 30 cm, et
// même à 30 cm le fond de couche se fond dans la moyenne.
import { svg, ligne, texte, solDe, COULEURS, graphe } from "../figures.js";
import { etat } from "../gtr/identification.js";
import { OBJECTIFS, controleDensite } from "../gtr/compactage.js";
import { SOLS } from "./materiaux.js";
import { charpente, boucle, brancherMarche, lectures, f, fd, r1, esc } from "./moteur.js";
import { fenetreLoupe, vueTerrain, tige, choc, fleche, etiquette, horloge, teinte, W as WL, H as HL, ROUGE, BLEU, ACIER_SOMBRE, TRAIT } from "./loupe.js";
import {
  ETATS_COUCHE, profilEtat, teneurMiseEnOeuvre, teinteTaux, bruitLisse, gauss, graineDe, hasard, borne, barreEchelle, contenirLargeur,
  comptageGamma, rhoHGamma, comptageNeutrons, masseEauNeutrons, comptagePoisson, GAMMA,
} from "./controle-dessin.js";

const EPAISSEUR = 0.3; // m : couche contrôlée
const POINTS = [2.5, 7.5, 12.5, 17.5, 22.5, 27.5]; // m : abscisses des points le long de la planche
const PHASES = [["battage", 25], ["extraction", 10], ["pose", 12], ["comptage", 60], ["remontee", 8], ["deplacement", 20]]; // s
const LIBELLES = { battage: "battage de la tige-guide", extraction: "extraction de la tige-guide", pose: "pose de l'appareil, descente de la source", comptage: "comptage d'une minute", remontee: "source remontée dans son blindage", deplacement: "vers le point suivant" };
const COUPS = 18; // coups de marteau pour enfoncer la tige-guide

export function monter(banc) {
  const c = charpente(banc, {
    vitesse: 20, vitesses: [1, 5, 20, 100],
    commandes: `
      <div class="field"><label>Sol de la couche</label><div class="input-wrap"><select data-r="sol">${Object.entries(SOLS).map(([k, s]) => `<option value="${k}">${esc(s.nom)} (${esc(s.classe)})</option>`).join("")}</select></div></div>
      <div class="field"><label>État de compactage (couche de 30 cm)</label><div class="input-wrap"><select data-r="etat">${Object.entries(ETATS_COUCHE).map(([k, x]) => `<option value="${k}">${esc(x.nom)}</option>`).join("")}</select></div></div>
      <div class="field"><label>Profondeur de la source</label><div class="input-wrap"><select data-r="prof"><option value="0.15">15 cm</option><option value="0.2" selected>20 cm</option><option value="0.3">30 cm : toute la couche</option></select></div></div>
      <div class="field"><label>Référence ρdOPN du sol</label><div class="input-wrap"><input data-r="ref" type="text" inputmode="decimal" value="${SOLS.limon.rhoDOPN.toFixed(2)}" data-curseur="1.4 2.4 0.01"><span class="unit">Mg/m³</span></div></div>`,
  });
  contenirLargeur(c);
  const loupe = fenetreLoupe(c, "les photons de la source au détecteur");
  const val = (r) => c.q(`[data-r="${r}"]`).value;
  let e, b, etatBoutons, signature = "";

  const reinit = () => {
    const cleSol = val("sol"), sol = SOLS[cleSol], cleEtat = val("etat"), d = Number(val("prof"));
    const ref = borne(parseFloat(String(val("ref")).replace(",", ".")) || sol.rhoDOPN, 1, 3);
    const pr = profilEtat(cleEtat, EPAISSEUR), w0 = teneurMiseEnOeuvre(sol);
    const g = graineDe(`${cleSol}|${cleEtat}|${d}`), lisse = bruitLisse(g);
    const moyenne = (fn, a, b2, n = 30) => { let s = 0; for (let i = 0; i < n; i++) s += fn(a + ((b2 - a) * (i + 0.5)) / n); return s / n; };
    // Chaque point : la couche réelle (profil de l'état, un peu variable le long de la planche), puis ce qu'en voit l'appareil.
    const points = POINTS.map((x, i) => {
      const dTau = 1.1 * lisse(x / 4) + 0.25 * gauss(i, g), w = w0 + 0.35 * gauss(i + 20, g);
      const tau = (z) => pr.taux(z) + dTau, rhoD = (z) => (tau(z) / 100) * sol.rhoDOPN;
      const rhoHvu = moyenne((z) => rhoD(z) * (1 + w / 100), 0, d);
      const mEauVue = 1000 * moyenne((z) => (rhoD(z) * w) / 100, 0, 0.15);
      const Ng = comptagePoisson(comptageGamma({ rhoH: rhoHvu, z: d }), i, g), Nn = comptagePoisson(comptageNeutrons({ mEau: mEauVue }), i + 50, g);
      // Dépouillement : étalonnage gamma → ρh ; neutrons → masse d'eau → w ; puis ρd par la relation d'état.
      const rhoH = rhoHGamma({ N: Ng, z: d }), mEau = masseEauNeutrons({ N: Nn }), wMes = (100 * mEau) / (1000 * rhoH - mEau);
      const et = etat({ rho: rhoH, w: wMes, rhoS: sol.rhoS });
      return { x, tau, Ng, Nn, rhoH, mEau, w: wMes, rhoD: et.rhoD, Sr: et.Sr, taux: (100 * et.rhoD) / ref,
        rhoDcouche: moyenne(rhoD, 0, EPAISSEUR), tauxFondVrai: tau(EPAISSEUR - 0.04) };
    });
    e = { cleSol, sol, cleEtat, d, ref, pr, points, i: 0, ph: 0, tPh: 0, t: 0, fini: false, id: "" };
    c.scene.innerHTML = fond();
    c.courbes.innerHTML = '<div class="dyn-etalonnage"></div><div class="dyn-points"></div>';
    c.bilan.innerHTML = "";
    signature = "";
    dessiner(); dessinerLent();
  };

  const phase = () => PHASES[e.ph][0];
  const fait = (i) => i < e.i || (i === e.i && e.ph > 3); // comptage du point i terminé

  const avancer = (dt) => {
    if (e.fini) return false;
    let reste = dt;
    while (reste > 1e-9 && !e.fini) {
      const h = Math.min(reste, PHASES[e.ph][1] - e.tPh);
      e.tPh += h; e.t += h; reste -= h;
      if (e.tPh >= PHASES[e.ph][1] - 1e-9) {
        e.ph++; e.tPh = 0;
        // Au dernier point, l'essai s'arrête quand la source est remontée.
        if (e.ph >= PHASES.length || (e.i === POINTS.length - 1 && e.ph === PHASES.length - 1)) {
          e.ph = 0; e.i++;
          if (e.i >= POINTS.length) { e.fini = true; e.i = POINTS.length - 1; e.ph = PHASES.length - 1; e.tPh = PHASES[e.ph][1]; }
        }
      }
    }
    return !e.fini;
  };

  // ── Scène : coupe de la couche au point de mesure, et plan de la planche ──
  const KS = 360, YS = 172, XH = 112, YF = YS + EPAISSEUR * KS; // px/m, surface, axe du trou, fond de couche
  const solFig = () => solDe(e.sol.motif);

  function fond() {
    return svg({
      largeur: 640, hauteur: 352, titre: "Gammadensimètre en transmission directe", contenu: (id) => {
        e.id = id;
        let s = `<rect x="10" y="${YF}" width="400" height="${340 - YF}" fill="${teinte(solFig().fond, 0.82)}"/><rect x="10" y="${YF}" width="400" height="${340 - YF}" fill="url(#${id}-${solFig().motif})"/>`;
        s += texte(404, YF + 18, "couche précédente", 'text-anchor="end" class="halo" style="font-size:10px;font-weight:700"');
        s += `<g class="dyn-coupe"></g>`;
        // Règle des profondeurs, à gauche du trou.
        s += ligne(40, YS, 40, YF, COULEURS.trait, 1);
        for (let z = 0; z <= 0.3001; z += 0.05) s += ligne(36, YS + z * KS, 40, YS + z * KS, COULEURS.trait, 1) + (Math.round(z * 100) % 10 === 0 && z > 0 ? texte(33, YS + z * KS + 4, `${Math.round(z * 100)}`, 'text-anchor="end" style="font-size:10px;fill:#64748b"') : "");
        s += texte(33, YS - 6, "cm", 'text-anchor="end" style="font-size:10px;fill:#64748b"');
        // Plan de la planche, vue de dessus.
        s += texte(440, 22, "planche, vue de dessus", 'style="font-size:10.5px;font-weight:700"');
        s += `<rect x="440" y="34" width="36" height="300" rx="3" fill="${teinte(solFig().fond, 0.95)}" stroke="${COULEURS.trait}"/>`;
        s += texte(458, 346, "30 m", 'text-anchor="middle" style="font-size:10px;fill:#64748b"');
        s += `<g class="dyn-plan"></g>`;
        return s;
      },
    });
  }

  const yPlan = (x) => 34 + (x / 30) * 300;
  const coulTaux = (t) => (t >= OBJECTIFS.q3.moyen ? "#15803d" : t >= OBJECTIFS.q4.moyen ? COULEURS.bleu : t >= OBJECTIFS.q4.fond ? "#b45309" : ROUGE);

  /** État de la manœuvre au point courant : enfoncement de la tige-guide, hauteur de la source, appareil posé ou porté. */
  function manoeuvre() {
    // Fin des mesures : l'appareil reste posé au dernier point, la source au blindage.
    if (e.fini) return { ph: "fin", u: 1, tigeEnfoncee: 0, tigeVisible: false, maillet: null, appareil: true, source: 0, depart: 0, trou: e.d + 0.05 };
    const ph = phase(), u = PHASES[e.ph][1] ? e.tPh / PHASES[e.ph][1] : 1, prof = e.d + 0.05;
    const coup = Math.min(COUPS, Math.floor(u * COUPS * 1.05)), frac = (u * COUPS * 1.05) % 1;
    return {
      ph, u,
      tigeEnfoncee: ph === "battage" ? (prof * coup) / COUPS : ph === "extraction" ? prof * (1 - u) : 0,
      tigeVisible: ph === "battage" || ph === "extraction",
      maillet: ph === "battage" && coup < COUPS ? frac : null,
      appareil: ph === "pose" || ph === "comptage" || ph === "remontee" || ph === "deplacement",
      source: ph === "pose" ? e.d * borne((u - 0.35) / 0.65, 0, 1) : ph === "comptage" ? e.d : ph === "remontee" ? e.d * (1 - u) : 0,
      depart: ph === "deplacement" ? u : 0,
      trou: ph !== "battage" ? prof : (prof * coup) / COUPS,
    };
  }

  /** Gammadensimètre vu de côté, axe de la tige à l'abscisse x, posé sur le sol en y ; source descendue de zs (m). */
  function appareil(x, y, zs, op = 1) {
    const k = KS, corps = 0.12 * k, l0 = -0.07 * k, l1 = 0.37 * k, haut = y - corps;
    let s = `<g opacity="${r1(op)}">`;
    // Tige porte-source : la source à son extrémité ; la poignée glisse le long de la tour, crantée tous les 5 cm.
    const tour = 0.32 * k, yPoignee = haut - tour - 7 + zs * k;
    s += tige(x, yPoignee + 6, y + zs * k - 8, 7);
    s += `<rect x="${r1(x - 3.5)}" y="${r1(y + zs * k - 9)}" width="7" height="10" rx="2" fill="${ROUGE}" stroke="#7f1d1d"/>`;
    s += `<rect x="${r1(x - 0.045 * k)}" y="${r1(haut - tour)}" width="${r1(0.09 * k)}" height="${r1(tour)}" fill="#fde047" stroke="#854d0e" stroke-width="1.2"/>`;
    for (let j = 1; j <= 6; j++) s += ligne(x + 0.045 * k - 6, haut - tour + j * 0.05 * k, x + 0.045 * k, haut - tour + j * 0.05 * k, "#854d0e", 1);
    s += `<rect x="${r1(x - 16)}" y="${r1(yPoignee)}" width="32" height="7" rx="3" fill="#334155"/>`;
    // Corps : embase, écran, détecteurs.
    s += `<rect x="${r1(x + l0)}" y="${r1(haut)}" width="${r1(l1 - l0)}" height="${r1(corps)}" rx="4" fill="#facc15" stroke="#854d0e" stroke-width="1.4"/>`;
    s += `<rect x="${r1(x + 0.12 * k)}" y="${r1(haut + 6)}" width="${r1(0.1 * k)}" height="${r1(corps * 0.32)}" rx="2" fill="#0f172a"/>`;
    s += `<circle cx="${r1(x + 0.31 * k)}" cy="${r1(haut + corps * 0.38)}" r="7" fill="#fff" stroke="#0f172a"/>`;
    for (let j = 0; j < 3; j++) { const a = (j * 2 * Math.PI) / 3 - Math.PI / 2; s += `<path d="M${r1(x + 0.31 * k)} ${r1(haut + corps * 0.38)}l${r1(6 * Math.cos(a - 0.5))} ${r1(6 * Math.sin(a - 0.5))}A6 6 0 0 1 ${r1(x + 0.31 * k + 6 * Math.cos(a + 0.5))} ${r1(haut + corps * 0.38 + 6 * Math.sin(a + 0.5))}Z" fill="#0f172a"/>`; }
    for (const dx of [0.22, 0.27]) s += `<rect x="${r1(x + dx * k)}" y="${r1(y - 9)}" width="${r1(0.04 * k)}" height="6" rx="3" fill="#94a3b8" stroke="#334155"/>`;
    return s + "</g>";
  }

  function dessiner() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    const p = e.points[e.i], m = manoeuvre();
    // Coupe de la couche au point courant : tranches teintées selon le taux de compactage réel.
    let s = "";
    for (let j = 0; j < 12; j++) {
      const z0 = (j * EPAISSEUR) / 12, z1 = ((j + 1) * EPAISSEUR) / 12;
      s += `<rect x="10" y="${r1(YS + z0 * KS)}" width="400" height="${r1((z1 - z0) * KS + 0.6)}" fill="${teinteTaux(solFig().fond, p.tau((z0 + z1) / 2))}"/>`;
    }
    s += `<rect x="10" y="${YS}" width="400" height="${r1(EPAISSEUR * KS)}" fill="url(#${e.id}-${solFig().motif})" opacity=".8"/>`;
    s += ligne(10, YS, 410, YS, TRAIT, 1.8) + ligne(10, YF, 410, YF, "#475569", 1, 'stroke-dasharray="5 3"');
    s += texte(404, YF - 38, "couche contrôlée, 30 cm", 'text-anchor="end" class="halo" style="font-size:10.5px;font-weight:700"');
    s += texte(404, YF - 24, e.sol.nom.toLowerCase(), 'text-anchor="end" class="halo" style="font-size:10.5px;font-weight:700"');
    s += texte(404, YF - 8, `fond de couche : ${fd(p.tauxFondVrai, 1)} % de ρdOPN en réalité`, 'text-anchor="end" class="halo" style="font-size:10px;fill:#7c2d12"');
    s += texte(404, 22, `Point ${e.i + 1} sur ${POINTS.length} · x = ${fd(p.x, 1)} m · source à ${Math.round(e.d * 100)} cm`, 'text-anchor="end" style="font-size:11px;font-weight:800;fill:#334155"');
    // Trou de la tige-guide.
    if (m.trou > 0) s += `<rect x="${XH - 5}" y="${YS}" width="10" height="${r1(m.trou * KS)}" fill="#f1f5f9" stroke="#64748b" stroke-width=".8"/>`;
    if (m.tigeVisible) {
      // Plaque de guidage, tige-guide, maillet.
      s += `<rect x="${r1(XH - 0.18 * KS)}" y="${YS - 4}" width="${r1(0.36 * KS)}" height="4" fill="#475569"/>`;
      const yTete = YS + m.tigeEnfoncee * KS - 0.42 * KS;
      s += tige(XH, yTete, YS + m.tigeEnfoncee * KS, 7) + `<path d="M${XH - 3.5} ${r1(YS + m.tigeEnfoncee * KS)}l3.5 6l3.5 -6z" fill="${ACIER_SOMBRE}"/>`;
      if (m.maillet !== null) {
        const lev = m.maillet < 0.75 ? Math.sin((m.maillet / 0.75) * Math.PI / 2) : 1 - (m.maillet - 0.75) / 0.25, ang = -55 * lev;
        s += `<g transform="rotate(${r1(ang)} ${XH + 72} ${r1(yTete - 8)})"><rect x="${XH + 8}" y="${r1(yTete - 13)}" width="66" height="5" rx="2" fill="#92400e"/><rect x="${XH - 8}" y="${r1(yTete - 22)}" width="16" height="22" rx="3" fill="#475569" stroke="#1e293b"/></g>`;
        if (m.maillet < 0.08) s += choc(XH, yTete, 9);
      }
      if (m.ph === "battage") s += texte(XH + 22, YS - 44, "plaque de guidage et tige-guide", 'class="halo" style="font-size:10px;font-weight:700"');
    }
    if (m.appareil) {
      const dx = m.depart * 260, dy = -Math.sin(m.depart * Math.PI) * 30;
      s += appareil(XH + dx, YS + dy, m.depart > 0 ? 0 : m.source, 1 - 0.8 * m.depart);
      if (m.ph === "comptage") {
        // Photons en route vers les détecteurs, d'autant moins nombreux que le sol est dense.
        const t = horloge(), T = Math.exp(-0.9 * (p.rhoH - 1.3)), xs = XH, ys = YS + e.d * KS, xd = XH + GAMMA.d * KS, yd = YS - 6;
        for (let j = 0; j < 9; j++) {
          const q = (t * 0.8 + j / 9) % 1, cyc = Math.floor(t * 0.8 + j / 9), absorbe = hasard(j, cyc, 3) > T, a = 0.25 + 0.6 * hasard(j, cyc, 4);
          const ox = 10 * (hasard(j, cyc, 5) - 0.5), xx = xs + (xd + ox - xs) * q, yy = ys + (yd - ys) * q;
          if (absorbe && q > a) { if (q < a + 0.07) s += `<circle cx="${r1(xs + (xd + ox - xs) * a)}" cy="${r1(ys + (yd - ys) * a)}" r="3.5" fill="#f97316" opacity=".7"/>`; continue; }
          s += `<circle cx="${r1(xx)}" cy="${r1(yy)}" r="2.2" fill="#f59e0b" stroke="#b45309" stroke-width=".6"/>`;
        }
        s += texte(XH + GAMMA.d * KS + 10, YS - 0.12 * KS - 34, `${Math.round(p.Ng * m.u).toLocaleString("fr-FR")} coups`, 'class="halo" style="font-size:10.5px;font-weight:800;fill:#b45309"');
      }
      if (m.ph === "pose" || m.ph === "comptage") s += texte(XH + 10, YS + m.source * KS + 6, "¹³⁷Cs", 'class="halo" style="font-size:10.5px;font-weight:800;fill:#b91c1c"');
    }
    svgEl.querySelector(".dyn-coupe").innerHTML = s;
    // Plan : points mesurés, point en cours.
    let pl = "";
    e.points.forEach((q, i) => {
      const y = yPlan(q.x), mesure = fait(i) || e.fini;
      pl += `<circle cx="458" cy="${r1(y)}" r="${i === e.i && !e.fini ? 7 : 5}" fill="${mesure ? coulTaux(q.taux) : "#fff"}" stroke="${i === e.i && !e.fini ? ROUGE : "#334155"}" stroke-width="${i === e.i && !e.fini ? 2 : 1}"/>`;
      pl += texte(486, y + 4, mesure ? `${fd(q.rhoD, 3)} · ${fd(q.taux, 1)} %` : `point ${i + 1}`, `style="font-size:10.5px;font-weight:${mesure ? 800 : 400};fill:${mesure ? coulTaux(q.taux) : "#64748b"}"`);
    });
    svgEl.querySelector(".dyn-plan").innerHTML = pl;
    const montre = fait(e.i) || e.fini, enComptage = m.ph === "comptage";
    c.lectures.innerHTML = lectures([
      ["Point de mesure", `${e.i + 1} / ${POINTS.length}`, `à ${fd(p.x, 1)} m`],
      ["Comptage γ", enComptage ? Math.round(p.Ng * m.u).toLocaleString("fr-FR") : montre ? p.Ng.toLocaleString("fr-FR") : "—", "coups en 1 min"],
      ["ρh", montre ? fd(p.rhoH, 3) : "—", "Mg/m³"], ["w (neutrons)", montre ? fd(p.w, 1) : "—", "%"],
      ["ρd", montre ? fd(p.rhoD, 3) : "—", `Mg/m³${montre ? ` · ${fd(p.taux, 1)} %` : ""}`],
    ]) + `<p class="banc-etat">${e.fini ? "mesures terminées" : e.t === 0 ? "prêt : premier point" : LIBELLES[m.ph]}${enComptage ? ` — ${Math.round(60 * m.u)} s` : ""}</p>`;
    loupe(...vueLoupe(p, m));
  }

  // ── Loupe : le sol entre la source et les détecteurs ──
  function vueLoupe(p, m) {
    const d = e.d, k = Math.min(560, 128 / d), x0 = 24, y0 = 30, xd = x0 + GAMMA.d * k;
    const t = horloge();
    let s = `<rect width="${WL}" height="${HL}" fill="#f8fafc"/>`;
    // Sol en tranches teintées selon le taux de compactage réel du point.
    const Y = (z) => y0 + z * k;
    for (let j = 0; j < 10; j++) {
      const z0 = (j * EPAISSEUR) / 10, z1 = ((j + 1) * EPAISSEUR) / 10;
      if (Y(z0) > HL) break;
      s += `<rect x="0" y="${r1(Y(z0))}" width="${WL}" height="${r1((z1 - z0) * k + 0.6)}" fill="${teinteTaux(solFig().fond, p.tau((z0 + z1) / 2))}"/>`;
    }
    if (Y(EPAISSEUR) < HL) s += `<rect x="0" y="${r1(Y(EPAISSEUR))}" width="${WL}" height="${r1(HL - Y(EPAISSEUR))}" fill="${teinte(solFig().fond, 0.8)}"/>`;
    s += vueTerrain({ couches: [{ z0: 0, z1: EPAISSEUR, sol: e.sol.motif }, { z0: EPAISSEUR, z1: 9, sol: e.sol.motif }], Y, k, zHaut: 0, zBas: (HL - y0) / k, fond: false });
    s += ligne(0, y0, WL, y0, TRAIT, 1.4);
    if (m.trou > 0) s += `<rect x="${x0 - 6}" y="${y0}" width="12" height="${r1(m.trou * k)}" fill="#f1f5f9" stroke="#64748b" stroke-width=".8"/>`;
    let legende;
    if (m.tigeVisible) {
      s += tige(x0, 0, y0 + m.tigeEnfoncee * k, 9) + `<path d="M${x0 - 4.5} ${r1(y0 + m.tigeEnfoncee * k)}l4.5 7l4.5 -7z" fill="${ACIER_SOMBRE}"/>`;
      if (m.maillet !== null && m.maillet < 0.1) s += choc(x0, 8, 8) + fleche(x0 + 16, 2, x0 + 16, 22, ROUGE, 2, 6);
      legende = m.ph === "battage" ? "la tige-guide ouvre le trou de la source, 5 cm plus profond que la mesure" : "on retire la tige : le trou reste";
    } else if (m.appareil && m.depart === 0) {
      // Embase de l'appareil : détecteurs γ, source neutronique, tige porte-source.
      s += `<rect x="0" y="${y0 - 16}" width="${WL}" height="16" fill="#facc15" stroke="#854d0e"/>`;
      s += `<rect x="${r1(xd - 9)}" y="${y0 - 12}" width="18" height="8" rx="4" fill="#94a3b8" stroke="#334155"/>`;
      s += `<circle cx="${r1((x0 + xd) / 2 + 8)}" cy="${y0 - 8}" r="3.5" fill="${BLEU}"/>`;
      s += tige(x0, 0, y0 + m.source * k - 6, 8) + `<rect x="${x0 - 5}" y="${r1(y0 + m.source * k - 8)}" width="10" height="10" rx="2" fill="${ROUGE}"/>`;
      if (m.ph === "comptage") {
        const T = Math.exp(-0.9 * (p.rhoH - 1.3)), xs = x0, ys = y0 + d * k;
        for (let j = 0; j < 14; j++) {
          const q = (t * 0.55 + j / 14) % 1, cyc = Math.floor(t * 0.55 + j / 14), absorbe = hasard(j, cyc, 13) > T, a = 0.2 + 0.65 * hasard(j, cyc, 14);
          const xe = xd + 12 * (hasard(j, cyc, 15) - 0.5), ye = y0 - 6;
          if (absorbe && q > a) {
            if (q < a + 0.08) s += `<path d="M${r1(xs + (xe - xs) * a - 4)} ${r1(ys + (ye - ys) * a)}h8M${r1(xs + (xe - xs) * a)} ${r1(ys + (ye - ys) * a - 4)}v8" stroke="#ea580c" stroke-width="1.6"/>`;
            continue;
          }
          const xx = xs + (xe - xs) * q, yy = ys + (ye - ys) * q, xq = xs + (xe - xs) * Math.max(0, q - 0.06), yq = ys + (ye - ys) * Math.max(0, q - 0.06);
          s += `<path d="M${r1(xq)} ${r1(yq)}L${r1(xx)} ${r1(yy)}" stroke="#f59e0b" stroke-width="1.4" opacity=".7"/><circle cx="${r1(xx)}" cy="${r1(yy)}" r="2.2" fill="#f59e0b" stroke="#b45309" stroke-width=".6"/>`;
        }
        // Neutrons ralentis par l'eau, renvoyés vers l'embase.
        for (let j = 0; j < 6; j++) {
          const a = t * (1.3 + 0.2 * j) + j * 2.1, xn = (x0 + xd) / 2 + 8 + 26 * Math.sin(a) * Math.cos(0.7 * a + j), yn = y0 + 5 + 16 * Math.abs(Math.sin(0.9 * a + j));
          s += `<circle cx="${r1(xn)}" cy="${r1(yn)}" r="1.8" fill="${BLEU}" opacity=".85"/>`;
        }
        s += etiquette(x0 + 9, Math.min(HL - 22, ys + 4), "¹³⁷Cs", { couleur: "#b91c1c" });
        legende = "comptage : plus le sol est dense, plus il absorbe de photons avant les détecteurs";
      } else legende = m.ph === "pose" ? "la source descend dans le trou, jusqu'à la profondeur de mesure" : m.ph === "fin" ? "mesures terminées : la source est au blindage" : "la source remonte dans son blindage";
      s += etiquette(Math.min(WL - 4, xd + 10), 11, "détecteurs", { ancre: "end" });
    } else legende = e.fini ? "mesures terminées : la source est au blindage" : m.ph === "deplacement" ? "l'opérateur porte l'appareil au point suivant" : "point de mesure, avant battage";
    s += barreEchelle(WL - 16 - 0.05 * k, HL - 10, 0.05 * k, "5 cm");
    return [s, legende];
  }

  // ── Courbes : étalonnage, et ρd mesurées point par point ──
  function dessinerLent() {
    const ze = c.courbes.querySelector(".dyn-etalonnage"), zp = c.courbes.querySelector(".dyn-points");
    if (!ze || !zp) return;
    const nFaits = e.points.filter((_, i) => fait(i) || e.fini).length, sig = `${nFaits}|${e.fini}`;
    if (sig === signature) return;
    signature = sig;
    const faits = e.points.slice(0, nFaits), d = e.d;
    const Nmin = comptageGamma({ rhoH: 2.5, z: d }), Nmax = comptageGamma({ rhoH: 1.5, z: d });
    const courbe = Array.from({ length: 41 }, (_, i) => { const r = 1.5 + i / 40; return [comptageGamma({ rhoH: r, z: d }), r]; });
    ze.innerHTML = graphe({
      largeur: 560, hauteur: 240, xmin: Math.floor(Nmin / 1000) * 1000, xmax: Math.ceil(Nmax / 1000) * 1000, ymin: 1.5, ymax: 2.5,
      xlabel: "comptage γ en une minute (coups)", ylabel: "masse volumique humide ρh (Mg/m³)",
      series: [
        { points: courbe, couleur: COULEURS.gtr92, epaisseur: 2.2, libelle: `courbe d'étalonnage, source à ${Math.round(d * 100)} cm` },
        ...(faits.length ? [{ points: faits.map((q) => [q.Ng, q.rhoH]), couleur: COULEURS.bleu, nuage: true, rayon: 4.5, libelle: "points mesurés" }] : []),
      ],
    });
    const o4 = OBJECTIFS.q4, o3 = OBJECTIFS.q3, R = e.ref, rr = (pc) => (pc / 100) * R;
    const ys = [...e.points.map((q) => q.rhoD), ...e.points.map((q) => q.rhoDcouche), rr(o4.fond), rr(o3.moyen)];
    const yMin = Math.floor((Math.min(...ys) - 0.02) * 50) / 50, yMax = Math.ceil((Math.max(...ys) + 0.02) * 50) / 50;
    const h = (v) => [[0, v], [30, v]];
    zp.innerHTML = graphe({
      largeur: 560, hauteur: 250, xmin: 0, xmax: 30, ymin: yMin, ymax: yMax, pasX: 5,
      xlabel: "position du point le long de la planche (m)", ylabel: "ρd (Mg/m³)",
      series: [
        { points: h(rr(o3.moyen)), couleur: "#15803d", tirets: "6 4", epaisseur: 1.4, libelle: "q3 : 98,5 % de ρdOPN" },
        { points: h(rr(o3.fond)), couleur: "#15803d", tirets: "2 3", epaisseur: 1.4, libelle: "q3 : 96 %" },
        { points: h(rr(o4.moyen)), couleur: COULEURS.gtr92, tirets: "6 4", epaisseur: 1.4, libelle: "q4 : 95 %" },
        { points: h(rr(o4.fond)), couleur: COULEURS.gtr92, tirets: "2 3", epaisseur: 1.4, libelle: "q4 : 92 %" },
        ...(faits.length ? [
          { points: faits.map((q) => [q.x, q.rhoDcouche]), couleur: COULEURS.discret, tirets: "4 3", epaisseur: 1.4, marqueurs: true, libelle: "ρd réel moyen des 30 cm" },
          { points: faits.map((q) => [q.x, q.rhoD]), couleur: COULEURS.bleu, epaisseur: 2.2, marqueurs: true, libelle: `ρd mesuré, source à ${Math.round(d * 100)} cm` },
        ] : []),
      ],
    });
  }

  function bilan() {
    const P = e.points, n = P.length, moy = (fn) => P.reduce((a, q) => a + fn(q), 0) / n;
    const rhoH = moy((q) => q.rhoH), w = moy((q) => q.w), rhoD = moy((q) => q.rhoD), rhoDmin = Math.min(...P.map((q) => q.rhoD));
    const c4 = controleDensite({ rhoDmoy: rhoD, rhoDfc: rhoDmin, rhoDOPN: e.ref, objectif: "q4" }), c3 = controleDensite({ rhoDmoy: rhoD, rhoDfc: rhoDmin, rhoDOPN: e.ref, objectif: "q3" });
    const vraiMoy = moy((q) => q.rhoDcouche), vraiFond = moy((q) => q.tauxFondVrai), cm = Math.round(e.d * 100);
    const sous = (seuil) => { const k = P.filter((q) => q.taux < seuil).length; return k === 0 ? "aucun point sous" : k === 1 ? "un point sous" : `${k} points sous`; };
    const lire = (r, o) => `${r.ok ? "<strong>conforme</strong>" : "<strong>non conforme</strong>"} à ${o} (${r.okMoyen ? "moyenne ≥" : "moyenne <"} ${f(r.objectif.moyen, 3)} %, ${sous(r.objectif.fond)} ${f(r.objectif.fond, 3)} %)`;
    let lecon;
    if (e.d < EPAISSEUR - 1e-9) lecon = `La source à ${cm} cm ne voit que les ${cm} cm supérieurs de la couche de 30 cm : la transmission directe mesure la moyenne du sol traversé entre la source et la surface, et le bas de la couche lui échappe${e.cleEtat === "fond" ? ` — ici le fond est mal compacté (≈ ${fd(vraiFond, 1)} % en réalité), la mesure ne le voit pas` : ""}.`;
    else if (e.cleEtat === "fond") lecon = `Même à 30 cm, la mesure fait la moyenne de toute l'épaisseur : le fond de couche, à ≈ ${fd(vraiFond, 1)} % en réalité, se fond dans une moyenne de ${fd((100 * vraiMoy) / e.sol.rhoDOPN, 1)} %. Le GTR le rappelle : la masse volumique en fond de couche ne se contrôle pas vraiment ainsi — un pénétromètre la localise, et l'on contrôle d'abord le Q/S.`;
    else lecon = "La source descendue au fond de la couche mesure sa moyenne sur toute l'épaisseur ; le fond de couche, lui, n'est vu qu'à travers cette moyenne.";
    const refDiff = Math.abs(e.ref - e.sol.rhoDOPN) > 0.005;
    const ecart = (100 * rhoD) / e.ref - (100 * rhoD) / e.sol.rhoDOPN;
    const noteRef = refDiff ? ` La référence choisie (${fd(e.ref, 2)} Mg/m³) n'est pas le Proctor de ce sol (${fd(e.sol.rhoDOPN, 2)}) : les mêmes mesures donnent un taux ${ecart < 0 ? "trop bas" : "trop haut"} de ${fd(Math.abs(ecart), 1)} point${Math.abs(ecart) >= 2 ? "s" : ""} — le taux de compactage ne vaut que ce que vaut sa référence.` : "";
    const lignes = P.map((q, i) => `<tr><td class="n">${i + 1}</td><td class="n">${fd(q.x, 1)}</td><td class="n">${q.Ng.toLocaleString("fr-FR")}</td><td class="n">${fd(q.rhoH, 3)}</td><td class="n">${q.Nn.toLocaleString("fr-FR")}</td><td class="n">${fd(q.mEau, 0)}</td><td class="n">${fd(q.w, 1)}</td><td class="n">${fd(q.rhoD, 3)}</td><td class="n">${fd(q.taux, 1)}</td></tr>`).join("");
    c.bilan.innerHTML = `<p class="final-result">Six points, source à ${cm} cm (NF P94-061-1, comptages d'une minute) : ρh = <strong>${fd(rhoH, 3)} Mg/m³</strong>, w = <strong>${fd(w, 1)} %</strong>, ρd = ρh/(1 + w) = <strong>${fd(rhoD, 3)} Mg/m³</strong> en moyenne ;
        taux de compactage moyen <strong>${fd(c4.tauxMoyen, 1)} %</strong> et minimal <strong>${fd(c4.tauxFond, 1)} %</strong> de ρdOPN = ${fd(e.ref, 2)} Mg/m³ —
        ${lire(c4, "q4")} ; ${lire(c3, "q3")}.
        <small>${lecon}${noteRef}</small></p>
      <div class="table-large"><table class="resultats"><thead><tr><th class="num">Point</th><th class="num">x (m)</th><th class="num">comptage γ</th><th class="num">ρh (Mg/m³)</th><th class="num">comptage n</th><th class="num">eau (kg/m³)</th><th class="num">w (%)</th><th class="num">ρd (Mg/m³)</th><th class="num">taux (%)</th></tr></thead><tbody>${lignes}</tbody></table></div>`;
  }

  b = boucle({ avancer, dessiner, dessinerLent, surFin: () => { signature = ""; dessinerLent(); bilan(); }, surEtat: () => etatBoutons?.() });
  etatBoutons = brancherMarche(c, b, reinit);
  const relancer = () => { b.raz(); reinit(); etatBoutons(); };
  c.q('[data-r="sol"]').addEventListener("change", () => {
    // Nouveau sol : la référence reprend son Proctor.
    const champ = c.q('[data-r="ref"]');
    champ.value = SOLS[val("sol")].rhoDOPN.toFixed(2);
    champ.dispatchEvent(new Event("change"));
  });
  c.commandes.querySelectorAll('select:not([data-r="sol"])').forEach((x) => x.addEventListener("change", relancer));
  c.q('[data-r="ref"]').addEventListener("change", relancer);
  c.q('[data-r="ref"]').addEventListener("input", relancer);
  reinit();
  etatBoutons();
}
