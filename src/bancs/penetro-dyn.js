// Banc d'essai : pénétromètre dynamique (chapitre 2). Le mouton monte, tombe et
// frappe l'enclume ; le train de tiges s'enfonce de e = M² g H/[(M + M') A qd]
// — la formule des Hollandais lue à l'envers, le terrain virtuel donnant qd ;
// M' grandit à chaque tige ajoutée. On compte les coups pour chaque tranche de
// 10 cm, et l'on trace N10 puis qd au fil de l'enfoncement, jusqu'au refus.
import { svg, ligne, texte, COULEURS } from "../figures.js";
import { creerAlea } from "../exos/alea.js";
import { SITES, terrain } from "./terrain.js";
import { charpente, boucle, brancherMarche, lectures, coupe, axeProfondeur, panneau, points, f, fd, r1, esc, duree } from "./moteur.js";
import { fenetreLoupe, vueTerrain, tige, choc, fleche, etiquette, H, ACIER_SOMBRE, ROUGE } from "./loupe.js";

const APPAREILS = {
  pdb: { nom: "PDB : 64 kg, 0,75 m, 20 cm²", M: 64, H: 0.75, A: 20, mt: 6, me: 18 },
  pda: { nom: "PDA : 64 kg, 0,75 m, 30 cm²", M: 64, H: 0.75, A: 30, mt: 6, me: 18 },
  leger: { nom: "léger : 10 kg, 0,50 m, 10 cm²", M: 10, H: 0.5, A: 10, mt: 2.9, me: 6 },
};
const MONTEE = 1.3, CHUTE = 0.4, CYCLE = 2; // s : 30 coups par minute
const REFUS = 60; // coups pour 10 cm : arrêt conventionnel du banc
const AJOUT_TIGE = 25; // s pour visser une tige d'un mètre
const ACIER = "#cbd5e1", TRAIT = COULEURS.betonTrait;

export function monter(banc) {
  const c = charpente(banc, {
    vitesse: 100,
    commandes: `
      <div class="field"><label>Terrain</label><div class="input-wrap"><select data-r="site">${Object.values(SITES).map((s) => `<option value="${s.cle}">${esc(s.nom)}</option>`).join("")}</select></div></div>
      <div class="field"><label>Appareil</label><div class="input-wrap"><select data-r="app">${Object.entries(APPAREILS).map(([k, a]) => `<option value="${k}">${esc(a.nom)}</option>`).join("")}</select></div></div>`,
  });
  const loupe = fenetreLoupe(c, "la pointe", { echelle: { px: 45, libelle: "5 cm" } });
  let e, b, etatBoutons;

  const reinit = () => {
    const site = SITES[c.q('[data-r="site"]').value], app = APPAREILS[c.q('[data-r="app"]').value];
    const T = terrain(site.cle), zMax = Math.min(site.zMax, 15);
    e = { site, app, T, zMax, z: 0, t: 0, coups: 0, phase: 0, hTete: 1.25, tiges: 2, pauseTige: 0, alea: creerAlea(site.cle === "B" ? 77 : 31),
      intervalles: [], courant: { z0: 0, N: 0 }, refus: false, fini: false, dernierePen: 0 };
    c.scene.innerHTML = fond(e);
    c.courbes.innerHTML = "";
    c.bilan.innerHTML = "";
    dessiner();
  };

  /** Un coup de mouton : enfoncement, comptage par tranches de 10 cm, refus. */
  const frapper = () => {
    const { app } = e;
    const Mp = app.me + app.mt * (e.z + e.hTete);
    const qd = e.T.qd(e.z + 0.02);
    let pen = (app.M * app.M * 9.81 * app.H) / ((app.M + Mp) * (app.A / 1e4) * qd * 1e6);
    pen *= 1 + 0.3 * (e.alea.reel() - 0.5);
    e.coups++; e.courant.N++; e.dernierePen = pen;
    const zAvant = e.z;
    e.z = Math.min(e.z + pen, e.zMax);
    e.hTete -= e.z - zAvant;
    while (e.z >= e.courant.z0 + 0.1 - 1e-9 && e.courant.z0 + 0.1 <= e.zMax + 1e-9) {
      const N = e.courant.N, eMoy = N >= 1 ? 0.1 / N : pen;
      e.intervalles.push({ z0: e.courant.z0, z1: e.courant.z0 + 0.1, N, qd: (app.M * app.M * 9.81 * app.H) / ((app.M + Mp) * (app.A / 1e4) * eMoy) / 1e6 });
      e.courant = { z0: e.courant.z0 + 0.1, N: 0 };
    }
    if (e.courant.N >= REFUS) { e.refus = true; e.fini = true; }
    if (e.z >= e.zMax - 1e-9) e.fini = true;
    if (!e.fini && e.hTete < 0.3) { e.hTete += 1; e.tiges++; e.pauseTige = AJOUT_TIGE; }
  };

  const avancer = (dt) => {
    if (e.fini) return false;
    let reste = dt;
    while (reste > 1e-9 && !e.fini) {
      if (e.pauseTige > 0) { const h = Math.min(reste, e.pauseTige); e.pauseTige -= h; e.t += h; reste -= h; continue; }
      const choc = MONTEE + CHUTE;
      const cible = e.phase < choc ? choc : CYCLE;
      const h = Math.min(reste, cible - e.phase);
      e.phase += h; e.t += h; reste -= h;
      if (cible === choc && e.phase >= choc - 1e-9) frapper();
      if (e.phase >= CYCLE - 1e-9) e.phase = 0;
    }
    return !e.fini;
  };

  // ── Dessin ──────────────────────────────────────────────────────────────
  const G = { yS: 168, bas: 486, xT: 112, kh: 58 };
  const Y = (z) => G.yS + (z / e.zMax) * (G.bas - G.yS);
  const yHaut = (h) => G.yS - h * G.kh; // au-dessus du sol, échelle dilatée

  function fond(e2) {
    return svg({
      largeur: 640, hauteur: 500, titre: "Pénétromètre dynamique en cours d'essai", contenu: (id) => {
        let s = coupe(id, { x0: 10, x1: 232, Y, couches: e2.site.couches, zMax: e2.zMax, zw: e2.site.zw });
        // Bâti : chenillard, mât et guide du mouton.
        s += `<rect x="${G.xT - 92}" y="${G.yS - 30}" width="74" height="22" rx="5" fill="#fde68a" stroke="#92400e" stroke-width="1.2"/>`;
        s += `<rect x="${G.xT - 96}" y="${G.yS - 9}" width="82" height="9" rx="4.5" fill="#334155"/>`;
        s += `<rect x="${G.xT - 26}" y="10" width="7" height="${G.yS - 18}" fill="#fbbf24" stroke="#92400e" stroke-width="1"/>`;
        s += ligne(G.xT - 19, 16, G.xT - 3, 16, "#92400e", 2.2);
        s += texte(G.xT - 60, G.yS - 36, "chenillard", 'text-anchor="middle" style="font-size:10px;fill:#78350f;font-weight:700"');
        s += texte(234, 40, "au-dessus du sol :", `text-anchor="end" style="font-size:9.5px;fill:${COULEURS.discret}"`);
        s += texte(234, 52, "échelle dilatée", `text-anchor="end" style="font-size:9.5px;fill:${COULEURS.discret}"`);
        s += `<g class="dyn-train"></g><g class="dyn-mouton"></g>`;
        s += axeProfondeur({ x: 262, Y, zMax: e2.zMax });
        const pN = panneau({ x0: 276, x1: 446, Y, zMax: e2.zMax, vMax: 60, titre: "N10 (coups / 10 cm)", pas: 20 });
        const pQ = panneau({ x0: 462, x1: 630, Y, zMax: e2.zMax, vMax: 30, titre: "qd (MPa)", pas: 10 });
        e2.XN = pN.X; e2.XQ = pQ.X;
        s += pN.svg + pQ.svg;
        s += `<path class="dyn-n" d="" fill="#fde68a" stroke="#b45309" stroke-width="1"/>`;
        s += `<polyline class="dyn-qd" points="" fill="none" stroke="${COULEURS.ec7}" stroke-width="1.8"/>`;
        s += `<line class="dyn-repere" x1="276" x2="630" y1="${G.yS}" y2="${G.yS}" stroke="${COULEURS.effort}" stroke-width="1" stroke-dasharray="3 3"/>`;
        return s;
      },
    });
  }

  function dessiner() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    const yTete = yHaut(e.hTete), yPointe = Y(e.z);
    // Train de tiges : au-dessus du sol (échelle dilatée), puis dans le terrain.
    let t = `<rect x="${G.xT - 4}" y="${r1(yTete)}" width="8" height="${r1(G.yS - yTete)}" fill="${ACIER}" stroke="${TRAIT}" stroke-width="1"/>`;
    t += `<rect x="${G.xT - 2.5}" y="${G.yS}" width="5" height="${r1(Math.max(0, yPointe - G.yS - 6))}" fill="${ACIER}" stroke="${TRAIT}" stroke-width="0.8"/>`;
    t += `<path d="M${G.xT - 5} ${r1(yPointe - 6)}h10l-5 7z" fill="#475569" stroke="#1e293b" stroke-width="0.8"/>`;
    t += `<rect x="${G.xT - 9}" y="${r1(yTete - 9)}" width="18" height="9" fill="#64748b" stroke="#1e293b" stroke-width="1"/>`;
    // Guide du mouton au-dessus de l'enclume.
    t += ligne(G.xT, yTete - 9, G.xT, yTete - 9 - (e.app.H + 0.45) * G.kh, "#475569", 2);
    svgEl.querySelector(".dyn-train").innerHTML = t;
    // Mouton : levage, chute libre, repos.
    let lev;
    if (e.pauseTige > 0) lev = 0;
    else if (e.phase < MONTEE) lev = e.phase / MONTEE;
    else if (e.phase < MONTEE + CHUTE) { const tc = e.phase - MONTEE; lev = Math.max(0, 1 - (9.81 * tc * tc) / 2 / e.app.H); }
    else lev = 0;
    const yM = yTete - 9 - lev * e.app.H * G.kh;
    svgEl.querySelector(".dyn-mouton").innerHTML = `<rect x="${G.xT - 13}" y="${r1(yM - 22)}" width="26" height="22" rx="2" fill="#334155" stroke="#0f172a" stroke-width="1"/>`
      + (e.phase >= MONTEE + CHUTE - 0.02 && e.phase < MONTEE + CHUTE + 0.12 && e.pauseTige <= 0
        ? `<path d="M${G.xT - 22} ${r1(yTete - 5)}l-8 -4M${G.xT + 22} ${r1(yTete - 5)}l8 -4M${G.xT - 20} ${r1(yTete)}l-9 2M${G.xT + 20} ${r1(yTete)}l9 2" stroke="${COULEURS.effort}" stroke-width="2"/>` : "");
    svgEl.querySelector(".dyn-repere").setAttribute("y1", r1(yPointe)); svgEl.querySelector(".dyn-repere").setAttribute("y2", r1(yPointe));
    c.lectures.innerHTML = lectures([
      ["Profondeur", fd(e.z, 2), "m"], ["Coups dans la tranche", String(e.courant.N), ""],
      ["N10 précédent", e.intervalles.length ? String(e.intervalles.at(-1).N) : "—", ""],
      ["qd précédent", e.intervalles.length ? fd(e.intervalles.at(-1).qd, 1) : "—", "MPa"],
      ["Tiges · M'", `${e.tiges} · ${f(e.app.me + e.app.mt * (e.z + e.hTete), 3)}`, "kg"], ["Temps d'essai", duree(e.t), ""],
    ]) + (e.pauseTige > 0 ? '<p class="banc-etat">ajout d\'une tige…</p>' : e.refus ? '<p class="banc-etat ko">refus</p>' : "");
    loupe(...vueLoupe());
  }

  // ── Loupe : la pointe, que chaque coup enfonce dans le terrain qui défile ──
  const KL = 900, YP = 118, XC = 88; // px/m, ordonnée de la pointe, axe
  function vueLoupe() {
    const Yl = (z) => YP + (z - e.z) * KL;
    const dc = (Math.sqrt((4 * e.app.A) / Math.PI) / 100) * KL, dt = (e.app.M > 30 ? 0.032 : 0.022) * KL;
    const yBase = YP - dc / 2, yCyl = yBase - 9;
    const t0 = MONTEE + CHUTE, impact = e.pauseTige <= 0 && e.coups > 0 && e.phase >= t0 - 0.02 && e.phase < t0 + 0.16;
    let s = vueTerrain({ couches: e.site.couches, Y: Yl, k: KL, zHaut: e.z - YP / KL, zBas: e.z + (H - YP) / KL });
    // Bulbe de sol comprimé sous la pointe, plus marqué au choc.
    s += `<ellipse cx="${XC}" cy="${YP + 6}" rx="${r1(dc * 0.75)}" ry="${r1(dc * 0.55)}" fill="#0f172a" opacity="${impact ? 0.22 : 0.08}"/>`;
    // Le cône est plus large que les tiges : derrière lui, le sol se referme mal.
    s += `<rect x="${r1(XC - dc / 2)}" y="0" width="${r1(dc)}" height="${r1(yCyl)}" fill="#fff" opacity=".35"/>`;
    s += tige(XC, 0, yCyl, dt);
    s += `<rect x="${r1(XC - dc / 2)}" y="${r1(yCyl)}" width="${r1(dc)}" height="9" fill="${ACIER_SOMBRE}" stroke="#1e293b"/>`;
    s += `<path d="M${r1(XC - dc / 2)} ${r1(yBase)}H${r1(XC + dc / 2)}L${XC} ${YP}Z" fill="#475569" stroke="#1e293b"/>`;
    if (impact) s += choc(XC, YP - dc / 4, dc / 2 + 3) + fleche(XC, 4, XC, 26, ROUGE, 3, 8);
    if (e.coups) s += etiquette(XC + dc / 2 + 5, YP - 2, `${fd(1000 * e.dernierePen, 1)} mm`, { couleur: ROUGE });
    s += etiquette(6, 13, e.T.couche(Math.min(e.z + 0.01, e.zMax - 0.01)).nom);
    const pen = `${fd(1000 * e.dernierePen, 1)} mm`;
    const legende = e.t === 0 ? "la pointe attend le premier coup" : e.pauseTige > 0 ? "ajout d'une tige : la pointe attend" : e.refus ? "refus : la pointe ne s'enfonce plus"
      : e.fini ? "fin de l'essai" : impact ? `choc : la pointe s'enfonce de ${pen}` : e.phase < MONTEE ? "le mouton remonte…" : e.phase < t0 ? "le mouton tombe…" : `enfoncement du dernier coup : ${pen}`;
    return [s, legende];
  }

  function dessinerLent() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    let d = "";
    for (const iv of e.intervalles) d += `M${r1(e.XN(0))} ${r1(Y(iv.z0))}H${r1(e.XN(Math.min(iv.N, 60)))}V${r1(Y(iv.z1))}H${r1(e.XN(0))}Z`;
    svgEl.querySelector(".dyn-n").setAttribute("d", d);
    svgEl.querySelector(".dyn-qd").setAttribute("points", points(e.intervalles.flatMap((iv) => [[e.XQ(Math.min(iv.qd, 30)), Y(iv.z0)], [e.XQ(Math.min(iv.qd, 30)), Y(iv.z1)]])));
  }

  function bilan() {
    const parCouche = e.site.couches.filter((k) => k.z0 < e.z).map((k) => {
      const iv = e.intervalles.filter((x) => x.z0 >= k.z0 && x.z1 <= k.z1);
      const nMoy = iv.length ? iv.reduce((s, x) => s + x.N, 0) / iv.length : NaN;
      const qMoy = iv.length ? iv.reduce((s, x) => s + x.qd, 0) / iv.length : NaN;
      return `<tr><td>${esc(k.nom)}</td><td class="n">${fd(k.z0, 1)} – ${fd(Math.min(k.z1, e.z), 1)}</td><td class="n">${f(nMoy, 3)}</td><td class="n">${f(qMoy, 3)}</td></tr>`;
    }).join("");
    c.bilan.innerHTML = `<p class="final-result">${e.refus ? `Refus à ${fd(e.z, 2)} m : ${REFUS} coups sans enfoncer la pointe de 10 cm` : `Essai mené jusqu'à ${fd(e.z, 2)} m`} —
        ${e.coups} coups en ${duree(e.t)}.
        <small>Les moyennes par couche (ci-dessous) retrouvent la coupe ; le calculateur qui suit refait la conversion de N10 en qd pour une tranche donnée.</small></p>
      <div class="table-large"><table class="resultats"><thead><tr><th>Couche traversée</th><th class="num">z (m)</th><th class="num">N10 moyen</th><th class="num">qd moyen (MPa)</th></tr></thead><tbody>${parCouche}</tbody></table></div>`;
  }

  b = boucle({ avancer, dessiner, dessinerLent, surFin: bilan, surEtat: () => etatBoutons?.() });
  etatBoutons = brancherMarche(c, b, reinit);
  c.commandes.querySelectorAll("select").forEach((s) => s.addEventListener("change", () => { b.raz(); reinit(); etatBoutons(); }));
  reinit();
  etatBoutons();
}
