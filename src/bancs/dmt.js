// Banc d'essai : le dilatomètre plat de Marchetti (chapitre 2). La lame est
// foncée par arrêts de 20 cm ; à chaque arrêt, le gaz gonfle la membrane : on
// lit A quand elle décolle, B quand son centre a avancé de 1,1 mm. Corrigées
// de la raideur de la membrane, ces lectures donnent p0 et p1, puis les trois
// indices ID (nature du sol), KD (contrainte horizontale, surconsolidation) et
// ED (module), qui se tracent arrêt après arrêt.
import { svg, texte, COULEURS } from "../figures.js";
import { dmt } from "../geotech/essais.js";
import { SITES, terrain } from "./terrain.js";
import { charpente, boucle, brancherMarche, lectures, coupe, axeProfondeur, panneau, points, f, fd, r1, esc, duree } from "./moteur.js";

const DA = 15, DB = 40; // kPa, raideur de la membrane
const PAS = 0.2, VITESSE = 0.02; // m, m/s
const T_A = 15, T_B = 30, T_DEGONFLE = 45; // s après l'arrêt
// Ordres de grandeur par nature : ID et KD « de base » ; ED s'en déduit, puisque
// p1 − p0 = ID (p0 − u0) et ED = 34,7 (p1 − p0).
const NATURE = { remblai: [1.6, 3.5], argile: [0.35, 2.4], limon: [1.1, 3], sable: [2.4, 4], grave: [3.5, 6], marne: [0.8, 7], craie: [1.5, 5] };

export function monter(banc) {
  const c = charpente(banc, {
    vitesse: 100,
    commandes: `<div class="field"><label>Terrain</label><div class="input-wrap"><select data-r="site">${Object.values(SITES).map((s) => `<option value="${s.cle}">${esc(s.nom)}</option>`).join("")}</select></div></div>`,
  });
  let e, b, etatBoutons;

  const reinit = () => {
    const site = SITES[c.q('[data-r="site"]').value], T = terrain(site.cle);
    e = { site, T, zMax: Math.min(site.zMax - 1, 14), z: 0, t: 0, phase: "fonçage", tArret: 0, prochain: PAS * 2, mesures: [], fini: false };
    c.scene.innerHTML = fond(e);
    c.bilan.innerHTML = "";
    dessiner(); dessinerLent();
  };

  /** Lectures A et B à la cote z, tirées du terrain virtuel. */
  const lecture = (z) => {
    const k = e.T.couche(z), [ID0, KD0] = NATURE[k.sol] ?? NATURE.limon;
    const { u0, svEff } = e.T.contraintes(z), br = e.T.bruitFin(z * 1.9);
    const ID = ID0 * (1 + 0.12 * br);
    const KD = k.sol === "argile" ? 2 * (1 + 3 / (z + 1)) ** 0.64 : KD0 * (1 + 0.15 * e.T.bruitFin(z * 2.7 + 1));
    const p0 = u0 + KD * svEff, p1 = p0 + ID * KD * svEff;
    const B = p1 + DB, A = (p0 + 0.05 * (B - DB)) / 1.05 - DA;
    return { z, A, B, r: dmt({ A, B, dA: DA, dB: DB, u0, sigmaV0eff: svEff }), couche: k.nom };
  };

  const avancer = (dt) => {
    if (e.fini) return false;
    let reste = dt;
    while (reste > 1e-9 && !e.fini) {
      if (e.phase === "fonçage") {
        const h = Math.min(reste, (e.prochain - e.z) / VITESSE);
        e.z += h * VITESSE; e.t += h; reste -= h;
        if (e.z >= e.prochain - 1e-9) { e.phase = "essai"; e.tArret = 0; e.courante = lecture(e.z); }
        continue;
      }
      const h = Math.min(reste, T_DEGONFLE - e.tArret);
      e.tArret += h; e.t += h; reste -= h;
      if (e.tArret >= T_DEGONFLE - 1e-9) {
        e.mesures.push(e.courante);
        e.prochain += PAS;
        if (e.prochain > e.zMax) e.fini = true; else e.phase = "fonçage";
      }
    }
    return !e.fini;
  };

  const G = { yS: 150, bas: 488, xT: 196 };
  const Y = (z) => G.yS + (z / e.zMax) * (G.bas - G.yS);
  function fond(e2) {
    return svg({
      largeur: 640, hauteur: 500, titre: "Dilatomètre plat", contenu: (id) => {
        let s = coupe(id, { x0: 10, x1: 232, Y, couches: e2.site.couches, zMax: e2.zMax, zw: e2.site.zw });
        s += `<rect x="112" y="${G.yS - 66}" width="118" height="44" rx="6" fill="#e2e8f0" stroke="${COULEURS.betonTrait}" stroke-width="1.3"/>`;
        for (const x of [132, 212]) s += `<circle cx="${x}" cy="${G.yS - 12}" r="11" fill="#334155"/><circle cx="${x}" cy="${G.yS - 12}" r="4.5" fill="#cbd5e1"/>`;
        s += `<rect x="30" y="${G.yS - 60}" width="40" height="30" rx="4" fill="#f1f5f9" stroke="#475569"/>` + texte(50, G.yS - 66, "boîtier A, B", 'text-anchor="middle" style="font-size:9.5px;font-weight:700"');
        s += `<path d="M50 ${G.yS - 60}V${G.yS - 88}H${G.xT}V${G.yS - 80}" fill="none" stroke="#1e293b" stroke-width="1.2"/>`;
        s += `<g class="dyn-lame"></g>`;
        s += axeProfondeur({ x: 260, Y, zMax: e2.zMax });
        const pI = panneau({ x0: 272, x1: 376, Y, zMax: e2.zMax, vMin: 0.1, vMax: 10, log: true, titre: "ID" });
        const pK = panneau({ x0: 396, x1: 496, Y, zMax: e2.zMax, vMax: 15, titre: "KD", pas: 5 });
        const pE = panneau({ x0: 516, x1: 630, Y, zMax: e2.zMax, vMin: 0.5, vMax: 200, log: true, titre: "ED (MPa)" });
        e2.XI = pI.X; e2.XK = pK.X; e2.XE = pE.X;
        s += pI.svg + pK.svg + pE.svg;
        s += `<line x1="${pI.X(0.6)}" x2="${pI.X(0.6)}" y1="${Y(0)}" y2="${Y(e2.zMax)}" stroke="${COULEURS.discret}" stroke-dasharray="2 3"/><line x1="${pI.X(1.8)}" x2="${pI.X(1.8)}" y1="${Y(0)}" y2="${Y(e2.zMax)}" stroke="${COULEURS.discret}" stroke-dasharray="2 3"/>`;
        s += `<polyline class="dyn-id" fill="none" stroke="${COULEURS.f62}" stroke-width="1.6"/><polyline class="dyn-kd" fill="none" stroke="${COULEURS.violet}" stroke-width="1.6"/><polyline class="dyn-ed" fill="none" stroke="${COULEURS.ec7}" stroke-width="1.6"/>`;
        return s;
      },
    });
  }

  function dessiner() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    const y = Y(e.z);
    let s = `<rect x="${G.xT - 2.5}" y="${G.yS - 80}" width="5" height="${r1(y - 14 - (G.yS - 80))}" fill="#cbd5e1" stroke="${COULEURS.betonTrait}" stroke-width="0.8"/>`;
    s += `<path d="M${G.xT - 7} ${r1(y - 14)}h14v10l-7 6l-7-6z" fill="#94a3b8" stroke="#334155"/>`;
    const gonfle = e.phase === "essai" ? Math.min(1, e.tArret / T_B) * (e.tArret < T_DEGONFLE - 8 ? 1 : 0) : 0;
    s += `<ellipse cx="${G.xT + 7 + gonfle * 3}" cy="${r1(y - 8)}" rx="${r1(1.5 + gonfle * 3)}" ry="4" fill="#60a5fa" stroke="#1d4ed8" stroke-width="0.8"/>`;
    svgEl.querySelector(".dyn-lame").innerHTML = s;
    const k = e.courante, enEssai = e.phase === "essai";
    c.lectures.innerHTML = lectures([["Profondeur", fd(e.z, 2), "m"], ["A", enEssai && e.tArret >= T_A ? f(k.A, 3) : "—", "kPa"], ["B", enEssai && e.tArret >= T_B ? f(k.B, 3) : "—", "kPa"],
      ["ID · KD", e.mesures.length ? `${fd(e.mesures.at(-1).r.ID, 2)} · ${fd(e.mesures.at(-1).r.KD, 1)}` : "—", ""], ["Temps", duree(e.t), ""]])
      + `<p class="banc-etat">${enEssai ? (e.tArret < T_A ? "gonflement : décollement de la membrane…" : e.tArret < T_B ? "A lu ; gonflement jusqu'à 1,1 mm…" : "B lu ; dégonflement") : "fonçage de 20 cm"}</p>`;
  }

  function dessinerLent() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    const M = e.mesures.filter((m) => m.r.applicable);
    svgEl.querySelector(".dyn-id").setAttribute("points", points(M.map((m) => [e.XI(Math.min(Math.max(m.r.ID, 0.1), 10)), Y(m.z)])));
    svgEl.querySelector(".dyn-kd").setAttribute("points", points(M.map((m) => [e.XK(Math.min(m.r.KD, 15)), Y(m.z)])));
    svgEl.querySelector(".dyn-ed").setAttribute("points", points(M.map((m) => [e.XE(Math.min(Math.max(m.r.ED, 0.5), 200)), Y(m.z)])));
  }

  function bilan() {
    const parCouche = e.site.couches.filter((k) => k.z0 < e.zMax).map((k) => {
      const ms = e.mesures.filter((m) => m.r.applicable && m.z > k.z0 + 0.1 && m.z < k.z1 - 0.1);
      const moy = (fn) => (ms.length ? ms.reduce((s, m) => s + fn(m), 0) / ms.length : NaN);
      const ID = moy((m) => m.r.ID);
      return `<tr><td>${esc(k.nom)}</td><td class="n">${fd(ID, 2)}</td><td>${ID < 0.6 ? "argile" : ID < 1.8 ? "limon" : "sable"}</td><td class="n">${fd(moy((m) => m.r.KD), 1)}</td><td class="n">${f(moy((m) => m.r.ED), 3)}</td><td class="n">${f(moy((m) => m.r.M), 3)}</td></tr>`;
    }).join("");
    c.bilan.innerHTML = `<p class="final-result">${e.mesures.length} arrêts en ${duree(e.t)}.
        <small>I<sub>D</sub> sépare argiles (< 0,6), limons et sables (> 1,8) ; K<sub>D</sub> élevé près de la surface d'une argile signale sa croûte surconsolidée ; M = R<sub>M</sub> E<sub>D</sub> est le module œdométrique de Marchetti.</small></p>
      <div class="table-large"><table class="resultats"><thead><tr><th>Couche</th><th class="num">I<sub>D</sub></th><th>Nature lue</th><th class="num">K<sub>D</sub></th><th class="num">E<sub>D</sub> (MPa)</th><th class="num">M (MPa)</th></tr></thead><tbody>${parCouche}</tbody></table></div>`;
  }

  b = boucle({ avancer, dessiner, dessinerLent, surFin: bilan, surEtat: () => etatBoutons?.() });
  etatBoutons = brancherMarche(c, b, reinit);
  c.commandes.querySelectorAll("select").forEach((x) => x.addEventListener("change", () => { b.raz(); reinit(); etatBoutons(); }));
  reinit();
  etatBoutons();
}
