// Banc d'essai : l'essai cross-hole (chapitre 2). Deux forages tubés et
// cimentés, à 4 m l'un de l'autre ; à chaque mètre, une source frappe la paroi
// du premier, vers le haut puis vers le bas, et un géophone du second
// enregistre l'onde de cisaillement. Les deux traces, de polarités opposées,
// se séparent à l'arrivée de l'onde S : on y lit le temps de parcours, donc Vs.
// Le profil de Vs donne Vs,30 et la classe de sol sismique.
import { svg, texte, COULEURS, graphe } from "../figures.js";
import { vs30 } from "../geotech/essais.js";
import { SITES, terrain } from "./terrain.js";
import { charpente, boucle, brancherMarche, lectures, coupe, axeProfondeur, panneau, points, f, fd, r1, esc, duree } from "./moteur.js";
import { fenetreLoupe, vueTerrain, fleche, etiquette, horloge, H as HL, ROUGE, BLEU } from "./loupe.js";

const D = 4; // m entre les forages
const VS_BASE = { remblai: 180, argile: 120, limon: 200, sable: 260, grave: 350, marne: 450, craie: 420 };
const DESCENTE = 20, COUPS = 12; // s

export function monter(banc) {
  const c = charpente(banc, {
    vitesse: 10, vitesses: [1, 10, 100],
    commandes: `<div class="field"><label>Terrain</label><div class="input-wrap"><select data-r="site">${Object.values(SITES).map((s) => `<option value="${s.cle}">${esc(s.nom)}</option>`).join("")}</select></div></div>`,
  });
  const loupe = fenetreLoupe(c, "entre les deux forages");
  let e, b, etatBoutons;

  const reinit = () => {
    const site = SITES[c.q('[data-r="site"]').value], T = terrain(site.cle);
    const zMax = Math.min(site.zMax - 0.5, 18);
    e = { site, T, zMax, z: 0, cible: 1, phase: "descente", minuteur: DESCENTE, t: 0, mesures: [], fini: false };
    c.scene.innerHTML = fond(e);
    c.courbes.innerHTML = '<div class="dyn-traces"></div>';
    c.bilan.innerHTML = "";
    dessiner(); dessinerLent();
  };

  const vsDe = (z) => {
    const k = e.T.couche(z), { svEff } = e.T.contraintes(z);
    return (VS_BASE[k.sol] ?? 200) * (Math.max(svEff, 10) / 100) ** 0.25 * (1 + 0.06 * e.T.bruitFin(z * 1.3));
  };
  /** Temps d'arrivée de l'onde S pointé sur les traces (avec une petite erreur de pointé). */
  const pointe = (z) => D / vsDe(z) + 0.0003 * Math.sin(z * 3.1);
  /** Trace du géophone : onde P faible et précoce, onde S forte, de signe donné par le sens du coup. */
  const trace = (z, signe) => {
    const Vs = vsDe(z), tS = D / Vs, tP = D / 1500, pts = [];
    for (let i = 0; i <= 240; i++) {
      const t = (i / 240) * 0.1; // s
      let a = 0.02 * Math.sin(t * 2900 + z) ;
      if (t > tP) a += 0.15 * Math.sin((t - tP) * 2 * Math.PI * 180) * Math.exp(-(t - tP) * 120);
      if (t > tS) a += signe * Math.sin((t - tS) * 2 * Math.PI * 60) * Math.exp(-(t - tS) * 35);
      pts.push([t * 1000, a]);
    }
    return { pts, tS, Vs };
  };

  const avancer = (dt) => {
    if (e.fini) return false;
    let reste = dt;
    while (reste > 1e-9 && !e.fini) {
      const h = Math.min(reste, e.minuteur);
      e.minuteur -= h; e.t += h; reste -= h;
      if (e.phase === "descente") e.z = e.cible - e.minuteur / DESCENTE;
      if (e.minuteur > 1e-9) continue;
      if (e.phase === "descente") { e.z = e.cible; e.phase = "coups"; e.minuteur = COUPS; }
      else {
        const tS = pointe(e.cible);
        e.mesures.push({ z: e.cible, tS, Vs: D / tS, couche: e.T.couche(e.cible) });
        e.cible += 1;
        if (e.cible > e.zMax) e.fini = true; else { e.phase = "descente"; e.minuteur = DESCENTE; }
      }
    }
    return !e.fini;
  };

  const G = { yS: 130, bas: 488 }, XS = 214, XG = 300; // forages : source, géophone
  const Y = (z) => G.yS + (z / e.zMax) * (G.bas - G.yS);
  function fond(e2) {
    return svg({
      largeur: 640, hauteur: 500, titre: "Essai cross-hole", contenu: (id) => {
        let s = coupe(id, { x0: 10, x1: 320, Y, couches: e2.site.couches, zMax: e2.zMax, zw: e2.site.zw });
        for (const x of [XS, XG]) s += `<rect x="${x - 5}" y="${G.yS - 20}" width="10" height="${G.bas - G.yS + 20}" fill="#fff" stroke="#475569" stroke-width="1.4"/>`;
        s += texte(XS, G.yS - 26, "source", 'text-anchor="middle" style="font-size:10px;font-weight:700"') + texte(XG, G.yS - 26, "géophone", 'text-anchor="middle" style="font-size:10px;font-weight:700"');
        s += `<rect x="40" y="40" width="80" height="34" rx="5" fill="#0f172a"/>` + texte(80, 34, "enregistreur", 'text-anchor="middle" style="font-size:10px;font-weight:700"');
        s += `<path d="M120 50H${XS}V${G.yS - 20}M120 64H${XG}V${G.yS - 20}" fill="none" stroke="#1e293b" stroke-width="1.2"/>`;
        s += `<g class="dyn-sondes"></g>`;
        s += axeProfondeur({ x: 348, Y, zMax: e2.zMax });
        const pV = panneau({ x0: 362, x1: 630, Y, zMax: e2.zMax, vMax: 600, titre: "Vs (m/s)", pas: 200 });
        e2.XV = pV.X;
        s += pV.svg + `<polyline class="dyn-vs" fill="none" stroke="${COULEURS.ec7}" stroke-width="1.8"/><g class="dyn-vsp"></g>`;
        return s;
      },
    });
  }

  function dessiner() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    const y = Y(e.z);
    let s = `<rect x="${XS - 6}" y="${r1(y - 8)}" width="12" height="16" rx="3" fill="#f59e0b" stroke="#92400e"/><rect x="${XG - 6}" y="${r1(y - 8)}" width="12" height="16" rx="3" fill="#475569"/>`;
    if (e.phase === "coups") {
      const r = (((COUPS - e.minuteur) % 4) / 4) * (XG - XS - 16);
      s += `<path d="M${r1(XS + 8 + r)} ${r1(y - 22)}q8 22 0 44" fill="none" stroke="${COULEURS.effort}" stroke-width="1.6" opacity=".7"/>`;
    }
    svgEl.querySelector(".dyn-sondes").innerHTML = s;
    const m = e.mesures.at(-1);
    c.lectures.innerHTML = lectures([["Profondeur", fd(e.z, 1), "m"], ["Dernier temps S", m ? fd(m.tS * 1000, 2) : "—", "ms"], ["Dernière Vs", m ? f(m.Vs, 3) : "—", "m/s"], ["Temps", duree(e.t), ""]])
      + `<p class="banc-etat">${e.phase === "coups" ? "coups vers le haut puis vers le bas" : "descente des sondes"}</p>`;
    loupe(...vueLoupe());
  }

  // ── Loupe : entre les deux forages, l'onde S fait vibrer le sol de haut en bas ──
  const KL = 33, YP = 84, XG1 = 17, XG2 = 159, T_COUP = 1.6; // px/m, profondeur des sondes, axes des forages, période d'un coup (écran)
  function vueLoupe() {
    const t = horloge(), coups = e.phase === "coups" && !e.fini;
    const Yl = (z) => YP + (z - e.z) * KL, zH = e.z - YP / KL, zB = e.z + (HL - YP) / KL;
    let s = vueTerrain({ couches: e.site.couches, Y: Yl, k: KL, zHaut: zH, zBas: zB });
    // Forages tubés et cimentés ; source plaquée à gauche, géophone à droite.
    for (const x of [XG1, XG2]) s += `<rect x="${x - 9}" y="0" width="18" height="${HL}" fill="#e5e7eb" stroke="#475569"/>`;
    s += `<rect x="${XG1 - 6}" y="${YP - 10}" width="12" height="20" rx="3" fill="#f59e0b" stroke="#92400e"/><rect x="${XG2 - 6}" y="${YP - 10}" width="12" height="20" rx="3" fill="#475569"/>`;
    s += `<path d="M${XG1} ${YP - 10}V0M${XG2} ${YP - 10}V0" stroke="#1e293b" stroke-width="1.4"/>`;
    let haut = true;
    if (coups) {
      const n = Math.floor(t / T_COUP), tau = (t % T_COUP) / T_COUP;
      haut = n % 2 === 0;
      const sg = haut ? -1 : 1, xf = XG1 + 10 + tau * 1.3 * (XG2 - XG1 - 20), xp = XG1 + 10 + tau * 3.4 * (XG2 - XG1 - 20);
      s += fleche(XG1, YP + sg * 4, XG1, YP + sg * 24, ROUGE, 2.4, 6);
      // Onde P, rapide mais faible : elle arrive la première.
      if (xp < XG2 - 9) s += `<path d="M${r1(xp)} ${YP - 26}V${YP + 26}" stroke="${BLEU}" stroke-width="1" stroke-dasharray="3 3" opacity=".7"/>` + etiquette(xp + 2, YP - 28, "P", { couleur: BLEU });
      // Onde S : chaque particule oscille verticalement après le passage du front.
      for (let i = 0; i < 10; i++) {
        const x = XG1 + 16 + i * 12.4, retard = xf - x, a = retard > 0 ? 7 * Math.sin(retard / 6) * Math.exp(-retard / 70) * sg : 0;
        s += `<circle cx="${r1(x)}" cy="${r1(YP + a)}" r="3" fill="#7c2d12" stroke="#fff" stroke-width=".8"/>`;
      }
      if (xf < XG2 - 9) s += `<path d="M${r1(xf)} ${YP - 22}V${YP + 22}" stroke="${ROUGE}" stroke-width="1.2" stroke-dasharray="2 2"/>` + etiquette(xf + 2, YP + 32, "S", { couleur: ROUGE });
      s += fleche(46, YP - 40, 120, YP - 40, "#0f172a", 1.4, 5) + etiquette(83, YP - 46, "propagation", { ancre: "middle" });
      s += `<path d="M64 ${YP + 30}v16M64 ${YP + 30}l-3 4M64 ${YP + 30}l3 4M64 ${YP + 46}l-3 -4M64 ${YP + 46}l3 -4" stroke="#7c2d12" stroke-width="1.4" fill="none"/>` + etiquette(70, YP + 42, "particules", { couleur: "#7c2d12" });
    } else for (let i = 0; i < 10; i++) s += `<circle cx="${r1(XG1 + 16 + i * 12.4)}" cy="${YP}" r="3" fill="#7c2d12" stroke="#fff" stroke-width=".8"/>`;
    s += etiquette(6, 13, e.T.couche(Math.max(0.01, Math.min(e.z, e.zMax))).nom);
    const legende = e.t === 0 ? "sondes en tête de forage" : e.fini ? "mesures terminées"
      : coups ? `coup vers le ${haut ? "haut" : "bas"} : l'onde S fait vibrer le sol verticalement, elle avance à Vs` : `descente des sondes vers ${fd(e.cible, 0)} m`;
    return [s, legende];
  }

  function dessinerLent() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    svgEl.querySelector(".dyn-vs").setAttribute("points", points(e.mesures.map((m) => [e.XV(Math.min(m.Vs, 600)), Y(m.z)])));
    svgEl.querySelector(".dyn-vsp").innerHTML = e.mesures.map((m) => `<circle cx="${r1(e.XV(Math.min(m.Vs, 600)))}" cy="${r1(Y(m.z))}" r="3" fill="${COULEURS.ec7}"/>`).join("");
    const zone = c.courbes.querySelector(".dyn-traces");
    if (!zone) return;
    const z = !e.fini && e.phase === "coups" ? e.cible : e.mesures.at(-1)?.z;
    if (!z) { zone.innerHTML = ""; return; }
    const haut = trace(z, 1), bas = trace(z, -1);
    zone.innerHTML = graphe({
      largeur: 560, hauteur: 230, xmin: 0, xmax: 100, ymin: -1.2, ymax: 1.2, xlabel: "temps (ms)", ylabel: "signal du géophone",
      titre: `Traces à ${fd(z, 0)} m de profondeur`,
      series: [{ points: haut.pts, couleur: COULEURS.bleu, epaisseur: 1.4, libelle: "coup vers le haut" }, { points: bas.pts, couleur: COULEURS.effort, epaisseur: 1.4, libelle: "coup vers le bas" }],
      marques: [{ x: pointe(z) * 1000, y: 0, couleur: COULEURS.encre, guides: false, libelle: `arrivée S : ${fd(pointe(z) * 1000, 2)} ms` }],
    });
  }

  function bilan() {
    const couches = e.mesures.map((m) => ({ h: 1, Vs: m.Vs }));
    const r = vs30(couches);
    c.bilan.innerHTML = `<p class="final-result">${e.mesures.length} mesures, de 1 à ${f(e.mesures.at(-1).z, 2)} m ⇒ V<sub>s,30</sub> = 30/Σ(h<sub>i</sub>/V<sub>si</sub>) = <strong>${f(r.Vs30, 3)} m/s</strong>, classe de sol <strong>${r.classe}</strong> (NF EN 1998-1).
        <small>Au-delà de la dernière mesure, la dernière vitesse est prolongée jusqu'à 30 m. Les deux traces de polarités opposées font ressortir l'onde S : c'est là qu'on lit son arrivée, après l'onde P, rapide mais faible.</small></p>`;
  }

  b = boucle({ avancer, dessiner, dessinerLent, surFin: () => { dessinerLent(); bilan(); }, surEtat: () => etatBoutons?.() });
  etatBoutons = brancherMarche(c, b, reinit);
  c.commandes.querySelectorAll("select").forEach((x) => x.addEventListener("change", () => { b.raz(); reinit(); etatBoutons(); }));
  reinit();
  etatBoutons();
}
