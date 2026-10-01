// Banc d'essai : l'essai Lugeon (chapitre 2). Dans un forage au rocher, deux
// obturateurs gonflés isolent une passe ; on y injecte de l'eau par paliers de
// pression de dix minutes, en montant puis en redescendant, et l'on lit le
// débit. Chaque palier donne une valeur en unités Lugeon (L/min par mètre sous
// 1 MPa) ; la façon dont elles varient d'un palier à l'autre dit comment
// l'eau circule : écoulement laminaire, turbulent, ouverture des fissures,
// débourrage ou colmatage.
import { svg, ligne, texte, couche, COULEURS, graphe } from "../figures.js";
import { lugeon } from "../geotech/essais.js";
import { charpente, boucle, brancherMarche, lectures, f, fd, r1, esc, duree, sci } from "./moteur.js";
import { fenetreLoupe, blocSol, fleche, etiquette, horloge, W as WL, H as HL, ROUGE } from "./loupe.js";

const PALIERS = [0.2, 0.5, 1.0, 0.5, 0.2]; // MPa au manomètre
const DUREE = 600; // s par palier
const LPASSE = 5, ZPASSE = 22.5, HM = 1, ZW = 12;
const COMPORTEMENTS = {
  laminaire: { nom: "écoulement laminaire", UL: 6, f: (p, i) => 1 },
  turbulent: { nom: "écoulement turbulent", UL: 12, f: (p) => 1 / (1 + 0.9 * p) * 1.5 },
  dilatation: { nom: "ouverture des fissures", UL: 4, f: (p, i, max) => (p >= max - 1e-9 ? 2.6 : 1) },
  debourrage: { nom: "débourrage des fissures", UL: 5, f: (p, i) => 1 + 0.5 * i },
  colmatage: { nom: "colmatage des fissures", UL: 9, f: (p, i) => 1 / (1 + 0.45 * i) },
};

export function monter(banc) {
  const c = charpente(banc, {
    vitesse: 100,
    commandes: `
      <div class="field" style="grid-column:span 2"><label>Rocher</label><div class="input-wrap"><select data-r="comp">${Object.entries(COMPORTEMENTS).map(([k, x]) => `<option value="${k}">${esc(x.nom)}</option>`).join("")}</select></div></div>
      <p class="method-note" style="grid-column:1/-1">Passe de ${f(LPASSE, 2)} m centrée à ${fd(ZPASSE, 1)} m ; manomètre à ${f(HM, 2)} m au-dessus du sol ; nappe à ${f(ZW, 2)} m. Paliers ${PALIERS.map((p) => fd(p, 1)).join(" → ")} MPa, dix minutes chacun.</p>`,
  });
  const loupe = fenetreLoupe(c, "la passe entre les obturateurs", { echelle: { px: 30, libelle: "5 cm" } });
  let e, b, etatBoutons;

  const reinit = () => {
    const comp = COMPORTEMENTS[c.q('[data-r="comp"]').value];
    e = { comp, t: 0, i: 0, mesures: [], fini: false };
    c.scene.innerHTML = fond();
    c.courbes.innerHTML = '<div class="dyn-courbe"></div>';
    c.bilan.innerHTML = "";
    dessiner(); dessinerLent();
  };

  const hEau = (HM + Math.min(ZW, ZPASSE)) * 0.00981;
  /** Débit (L/min) du palier i : unités Lugeon du rocher × pression effective × L. */
  const debit = (i) => {
    const p = PALIERS[i], pj = p + hEau;
    return e.comp.UL * e.comp.f(p, i, Math.max(...PALIERS)) * pj * LPASSE;
  };

  const avancer = (dt) => {
    if (e.fini) return false;
    let reste = dt;
    while (reste > 1e-9 && !e.fini) {
      const h = Math.min(reste, (e.i + 1) * DUREE - e.t);
      e.t += h; reste -= h;
      if (e.t >= (e.i + 1) * DUREE - 1e-9) {
        e.mesures.push({ p: PALIERS[e.i], Q: debit(e.i) });
        e.i++;
        if (e.i >= PALIERS.length) e.fini = true;
      }
    }
    return !e.fini;
  };

  const yS = 60, k = 10, Y = (z) => yS + z * k, xF = 150;
  function fond() {
    return svg({
      largeur: 640, hauteur: 380, titre: "Essai Lugeon", contenu: (id) => {
        let s = couche(id, { x: 10, y: yS, w: 620, h: Y(6) - yS, sol: "limon" }) + couche(id, { x: 10, y: Y(6), w: 620, h: 372 - Y(6), sol: "roche" });
        s += ligne(10, yS, 630, yS, COULEURS.trait, 1.8) + ligne(10, Y(ZW), 630, Y(ZW), COULEURS.eau, 1.3, 'stroke-dasharray="6 4"');
        s += texte(624, Y(ZW) - 5, "nappe", `text-anchor="end" style="font-size:10.5px;font-weight:700;fill:${COULEURS.eau}"`);
        s += texte(624, Y(6) + 16, "rocher fissuré", 'text-anchor="end" class="halo" style="font-size:10.5px;font-weight:700"');
        // Fissures.
        for (const [x, y, l] of [[60, 140, 70], [250, 180, 90], [90, 230, 80], [270, 270, 60], [40, 320, 90], [420, 150, 80], [500, 215, 90], [400, 290, 70], [520, 335, 80]]) s += ligne(x, y, x + l, y + 12, "#475569", 1.2);
        s += `<rect x="${xF - 8}" y="${yS}" width="16" height="${372 - yS}" fill="#fff" stroke="#475569" stroke-dasharray="4 3"/>`;
        const y1 = Y(ZPASSE - LPASSE / 2), y2 = Y(ZPASSE + LPASSE / 2);
        s += `<rect x="${xF - 9}" y="${y1 - 14}" width="18" height="14" rx="4" fill="#1e293b"/><rect x="${xF - 9}" y="${y2}" width="18" height="14" rx="4" fill="#1e293b"/>`;
        s += texte(xF + 16, y1 - 4, "obturateur", 'style="font-size:10px;font-weight:700"') + texte(xF + 16, y2 + 11, "obturateur", 'style="font-size:10px;font-weight:700"');
        s += ligne(xF, yS - 30, xF, y1 - 14, "#334155", 2);
        s += `<rect x="40" y="16" width="80" height="34" rx="5" fill="#f1f5f9" stroke="#475569"/>` + texte(80, 12, "pompe et compteur", 'text-anchor="middle" style="font-size:9.5px;font-weight:700"');
        s += `<circle cx="${xF}" cy="${yS - 34}" r="12" fill="#fff" stroke="#334155" stroke-width="1.4"/>` + texte(xF + 18, yS - 30, "manomètre", 'style="font-size:9.5px;font-weight:700"');
        s += `<path d="M120 33H${xF - 12}" stroke="${COULEURS.eau}" stroke-width="2"/>`;
        s += `<g class="dyn-passe"></g>`;
        return s;
      },
    });
  }

  function dessiner() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    const i = Math.min(e.i, PALIERS.length - 1), p = e.fini ? 0 : PALIERS[i];
    const y1 = Y(ZPASSE - LPASSE / 2), y2 = Y(ZPASSE + LPASSE / 2);
    let s = e.fini ? "" : `<rect x="${xF - 7}" y="${y1}" width="14" height="${y2 - y1}" fill="#7dd3fc"/>`;
    const ph = (e.t / 6) % 1;
    if (!e.fini) for (let j = 0; j < 4; j++) { const y = y1 + 10 + j * ((y2 - y1 - 20) / 3), d = 10 + 40 * ((ph + j / 4) % 1) * (0.4 + p); s += ligne(xF + 8, y, xF + 8 + d, y + 3, COULEURS.bleu, 1.4) + ligne(xF - 8, y, xF - 8 - d, y + 3, COULEURS.bleu, 1.4); }
    const a = (-220 + (p / 1.2) * 260) * Math.PI / 180;
    s += ligne(xF, yS - 34, xF + 9 * Math.cos(a), yS - 34 + 9 * Math.sin(a), COULEURS.effort, 1.8);
    svgEl.querySelector(".dyn-passe").innerHTML = s;
    c.lectures.innerHTML = lectures([["Palier", e.fini ? "terminé" : `${i + 1} / ${PALIERS.length}`, ""], ["Pression au manomètre", fd(p, 2), "MPa"],
      ["Débit", e.fini ? "—" : fd(debit(i), 1), "L/min"], ["Temps", duree(e.t), ""]]);
    loupe(...vueLoupe());
  }

  // ── Loupe : la paroi du forage entre les obturateurs, et les fissures où l'eau s'engouffre ──
  const XC = 88, RB = 23, FISSURES = [[64, -0.2], [104, 0.13], [140, -0.07]]; // axe, rayon du forage (Ø 76 mm), fissures (ordonnée, pente)
  function vueLoupe() {
    const t = horloge(), cle = Object.entries(COMPORTEMENTS).find(([, x]) => x === e.comp)[0];
    const i = Math.min(e.i, PALIERS.length - 1), p = e.fini || e.t === 0 ? 0 : PALIERS[i], pMax = Math.max(...PALIERS);
    const qMax = Math.max(...PALIERS.map((_, j) => debit(j))), r = p > 0 ? debit(i) / qMax : 0;
    let s = blocSol("roche", { x0: 0, x1: WL, y0: 0, y1: HL, k: 600 });
    // Ouverture et remplissage des fissures selon le rocher choisi.
    const ouv = cle === "dilatation" && p >= pMax - 1e-9 ? 4.5 : 2.2;
    const avance = e.t === 0 ? 0 : (e.i + Math.min(1, (e.t % DUREE) / DUREE)) / PALIERS.length; // avancement de l'essai
    for (const [y0, pente] of FISSURES) for (const sg of [-1, 1]) {
      const xa = XC + sg * RB, xb = sg < 0 ? 0 : WL, ya = y0, yb = y0 + pente * (xb - xa) * sg;
      s += `<path d="M${xa} ${ya}L${xb} ${r1(yb)}" stroke="#1e293b" stroke-width="${ouv + 1.6}"/>`;
      if (cle === "debourrage" && avance < 1) { const l = 46 * (1 - avance); s += `<path d="M${xa} ${ya}L${r1(xa + sg * l)} ${r1(ya + pente * l)}" stroke="#92400e" stroke-width="${ouv}" opacity=".9"/>`; }
      if (r > 0) {
        // Filets d'eau qui partent dans la fissure, d'autant plus vite que le débit est fort.
        for (let j = 0; j < 4; j++) { const q = (t * (0.3 + 0.9 * r) + j / 4) % 1, x = xa + sg * q * Math.abs(xb - xa); s += `<circle cx="${r1(x)}" cy="${r1(ya + pente * sg * (x - xa))}" r="${r1(Math.min(2.2, ouv / 2 + 0.4))}" fill="#38bdf8" opacity="${r1(1 - 0.7 * q)}"/>`; }
        if (cle === "turbulent" && p >= 0.5) s += `<path d="M${r1(xa + sg * 8)} ${ya - 6}c${sg * 5} -4 ${sg * 9} 2 ${sg * 4} 5" stroke="#0369a1" stroke-width="1.2" fill="none"/>`;
      }
      if (cle === "colmatage" && avance > 0) for (let j = 0; j < Math.round(7 * avance); j++) s += `<circle cx="${r1(xa + sg * (3 + j * 4))}" cy="${r1(ya + pente * (3 + j * 4))}" r="1.6" fill="#92400e"/>`;
    }
    // Forage plein d'eau sous pression ; obturateur gonflé en haut de la passe.
    s += `<rect x="${XC - RB}" y="0" width="${2 * RB}" height="${HL}" fill="#7dd3fc"/>`;
    s += `<rect x="${XC - RB - 1}" y="0" width="${2 * RB + 2}" height="26" rx="5" fill="#111827"/><rect x="${XC - 6}" y="0" width="12" height="30" fill="#94a3b8"/>`;
    if (p > 0) for (const y of [52, 92, 128]) for (const sg of [-1, 1]) s += fleche(XC + sg * 4, y, XC + sg * (6 + 14 * (p / pMax)), y, ROUGE, 1.5, 4.5);
    s += etiquette(XC + RB + 4, 20, "obturateur") + etiquette(6, 13, "rocher fissuré");
    const pas = `palier ${i + 1} : ${fd(p, 1)} MPa — `;
    const legendes = {
      laminaire: "le débit suit la pression", turbulent: p >= 0.5 ? "à forte pression, l'écoulement devient turbulent" : "à faible pression, l'écoulement reste laminaire",
      dilatation: p >= pMax - 1e-9 ? "sous la plus forte pression, les fissures s'ouvrent" : "les fissures restent fermées",
      debourrage: "l'eau lave le remplissage des fissures", colmatage: "les fines bouchent peu à peu les fissures",
    };
    return [s, e.t === 0 ? "passe isolée par les obturateurs, prête" : e.fini ? "essai terminé : passe dégonflée" : pas + legendes[cle]];
  }

  function dessinerLent() {
    const zone = c.courbes.querySelector(".dyn-courbe");
    if (!zone || !e.mesures.length) return;
    const r = lugeon({ paliers: e.mesures, L: LPASSE, hauteurManometre: HM, profondeurNappe: ZW, profondeurPasse: ZPASSE });
    const QMax = Math.max(...e.mesures.map((m) => m.Q)) * 1.15;
    const g1 = graphe({
      largeur: 560, hauteur: 240, xmin: 0, xmax: 1.2, ymin: 0, ymax: QMax, xlabel: "pression effective sur la passe pj (MPa)", ylabel: "débit Q (L/min)",
      series: [{ points: r.paliers.slice(0, 3).map((q) => [q.pj, q.Q]), couleur: COULEURS.bleu, marqueurs: true, epaisseur: 2, libelle: "montée en pression" },
        ...(r.paliers.length > 3 ? [{ points: r.paliers.slice(2).map((q) => [q.pj, q.Q]), couleur: COULEURS.f62, marqueurs: true, epaisseur: 2, tirets: "6 4", libelle: "descente" }] : [])],
    });
    const barres = r.paliers.map((q, i) => `<div class="lugeon-barre"><span style="height:${r1(Math.min(100, (q.UL / (Math.max(...r.paliers.map((x) => x.UL)) * 1.1)) * 100))}%"></span><small>${fd(q.p, 1)} MPa<br>${fd(q.UL, 1)} UL</small></div>`).join("");
    zone.innerHTML = g1 + `<div class="lugeon-barres" aria-label="Unités Lugeon par palier">${barres}</div>`;
  }

  function bilan() {
    const r = lugeon({ paliers: e.mesures, L: LPASSE, hauteurManometre: HM, profondeurNappe: ZW, profondeurPasse: ZPASSE });
    const UL = r.paliers.map((q) => q.UL), m = UL.reduce((a, x) => a + x, 0) / UL.length;
    const iMax = PALIERS.indexOf(Math.max(...PALIERS));
    // Valeur retenue selon l'allure des cinq valeurs (Houlsby).
    const lecture = {
      laminaire: ["Les cinq valeurs sont égales : l'écoulement est laminaire, on retient leur moyenne", m],
      turbulent: ["La valeur la plus faible est celle du palier le plus fort : l'écoulement devient turbulent, on retient celle de ce palier", UL[iMax]],
      dilatation: ["La valeur bondit au palier le plus fort seulement : les fissures s'ouvrent sous la pression, on retient la plus faible, lue aux paliers bas", Math.min(...UL)],
      debourrage: ["Les valeurs croissent d'un palier au suivant, à la montée comme à la descente : l'eau lave le remplissage des fissures, on retient la plus forte", Math.max(...UL)],
      colmatage: ["Les valeurs décroissent d'un palier au suivant : les fissures se colmatent, on retient la plus faible", Math.min(...UL)],
    };
    const cle = Object.entries(COMPORTEMENTS).find(([, x]) => x === e.comp)[0], [texte, retenue] = lecture[cle];
    c.bilan.innerHTML = `<p class="final-result">Unités Lugeon des paliers : ${UL.map((x) => fd(x, 1)).join(" · ")}. Valeur retenue : <strong>${fd(retenue, 1)} UL</strong>, soit k ≈ ${sci(retenue * 1.3e-7, 2)} m/s.
        <small>${texte}. Une unité Lugeon vaut environ 1,3·10<sup>−7</sup> m/s dans un massif aux fissures régulières.</small></p>`;
  }

  b = boucle({ avancer, dessiner, dessinerLent, surFin: () => { dessinerLent(); bilan(); }, surEtat: () => etatBoutons?.(), pasMax: Infinity });
  etatBoutons = brancherMarche(c, b, reinit);
  c.commandes.querySelectorAll("select").forEach((x) => x.addEventListener("change", () => { b.raz(); reinit(); etatBoutons(); }));
  reinit();
  etatBoutons();
}
