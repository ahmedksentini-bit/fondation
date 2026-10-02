// Banc d'essai : la valeur de bleu de méthylène d'un sol, essai à la tache
// (chapitre 2). On choisit le sol ; une prise d'essai de sa fraction 0/5 mm
// (30 à 60 g, davantage pour un sable propre) est dispersée dans 500 mL d'eau
// déminéralisée par un agitateur à ailettes, 5 min à 700 tr/min, puis l'on
// injecte la solution de bleu à 10 g/L par 5 mL. Une minute après chaque
// injection, une goutte prélevée à la baguette est déposée sur le papier
// filtre : tant que l'argile adsorbe tout le bleu, la tache est un dépôt bleu
// foncé entouré d'une auréole humide incolore ; quand le bleu est en excès,
// une auréole bleu clair apparaît. On la confirme alors par une tache par
// minute pendant cinq minutes ; si elle disparaît, on injecte 2 mL de plus.
// V donne la masse de bleu B, VB pour la fraction 0/5 mm, et la VBS du sol
// en la multipliant par la proportion C de 0/5 mm dans le 0/63 mm
// (NF P94-068, reprise par la NF EN 17542-3 ; seuils du GTR 2024).
//
// Modèle : la fraction 0/5 mm peut fixer S mL de solution (S = VB m0, avec
// VB = VBS/C du catalogue, moins le seuil de visibilité de l'auréole). Après
// chaque injection, le bleu libre décroît vers max(0, V − S) avec un temps
// d'adsorption de 15 s loin de la saturation, qui s'allonge jusqu'à 90 s quand
// les sites restants se raréfient : près de la fin, l'auréole apparaît puis
// s'efface, comme au laboratoire. Une tache montre l'auréole si le bleu libre
// dépasse l'équivalent d'1 mL de solution dans le bécher.
import { svg, texte, COULEURS, graphe } from "../figures.js";
import { SOLS } from "./materiaux.js";
import { analyser, passant } from "../gtr/granulo.js";
import { vbs } from "../gtr/identification.js";
import { classerSol, SEUILS_2024 } from "../gtr/classification.js";
import { charpente, boucle, brancherMarche, lectures, f, fd, r1, esc, duree } from "./moteur.js";
import { fenetreLoupe, etiquette, horloge, W as WL, H as HL, ACIER, ACIER_SOMBRE } from "./loupe.js";
import { bruit, hasard, teintesSol, paillasse, melange, barreEchelle } from "./identification-dessin.js";

const CHOIX = ["argile", "limon", "sableArgileux", "graveArgileuse", "sableDune"];
const M0 = { argile: 30, limon: 60, sableArgileux: 60, graveArgileuse: 60, sableDune: 200 }; // g de 0/5 mm sec
const DISPERSION = 300, ATTENTE = 60, DECISION = 4; // s
const SEUIL = 1; // mL de solution libre dans le bécher : seuil de visibilité de l'auréole
const BLEU_FONCE = "#1e3a8a", BLEU_CLAIR = "#7dd3fc";
const COL = 10, RANGS = 5; // taches sur le papier filtre

export function monter(banc) {
  const c = charpente(banc, {
    vitesse: 100, vitesses: [1, 10, 100, 1000],
    commandes: `
      <div class="field"><label>Sol</label><div class="input-wrap"><select data-r="sol">${CHOIX.map((k) => `<option value="${k}">${esc(SOLS[k].nom)}</option>`).join("")}</select></div></div>
      <p class="method-note banc-prise" style="grid-column:1/-1"></p>`,
  });
  const loupe = fenetreLoupe(c, "la dernière tache");
  let e, b, etatBoutons;

  const reinit = () => {
    const cle = c.q('[data-r="sol"]').value, sol = SOLS[cle], g = CHOIX.indexOf(cle) + 2;
    const m0 = M0[cle], C = passant(sol.granulo, 5) / passant(sol.granulo, 63);
    const VB = sol.VBS / C, Vstar = VB * m0 * (1 + 0.006 * bruit(3, g));
    e = {
      cle, sol, g, m0, C, VB, S: Vstar - SEUIL, teintes: teintesSol(sol),
      t: 0, V: 0, F0: 0, tInj: 0, tTache: null, tInjection: DISPERSION, dV: 5, confirmation: false, nPos: 0,
      taches: [], injections: [], fini: false, cleCourbe: "",
    };
    c.q(".banc-prise").innerHTML = `Prise d'essai : <strong>m0 = ${m0} g</strong> de la fraction 0/5 mm sèche, qui forme C = ${fd(100 * C, 0)} % du sol (0/63 mm) ; 500 mL d'eau déminéralisée ;
      solution de bleu à 10 g/L, injectée par 5 mL puis par 2 mL ; une tache une minute après chaque injection.`;
    c.scene.innerHTML = fond();
    c.courbes.innerHTML = '<div class="dyn-dosage"></div><div class="dyn-reglette"></div>';
    c.bilan.innerHTML = "";
    dessiner(); dessinerLent();
  };

  /** Temps d'adsorption (s) : bref loin de la saturation, long près d'elle. */
  const tau = (V) => 15 + 75 * Math.exp(-Math.max(e.S - V, 0) / 3);
  /** Bleu libre dans le bécher (mL de solution) à l'instant t. */
  const libre = (t) => {
    if (!e.V) return 0;
    const Feq = Math.max(0, e.V - e.S);
    return Feq + (e.F0 - Feq) * Math.exp(-(t - e.tInj) / tau(e.V));
  };
  const injecter = (dv) => {
    const fl = libre(e.t);
    e.V += dv; e.F0 = fl + dv; e.tInj = e.t;
    e.injections.push({ t: e.t, dv, V: e.V });
  };
  const tache = () => {
    const fl = libre(e.t), pos = fl > SEUIL;
    e.taches.push({ t: e.t, V: e.V, F: fl, pos });
    if (pos) {
      e.confirmation = true; e.nPos++;
      if (e.nPos >= 5) { e.fini = true; e.tTache = null; return; }
      e.tTache = e.t + ATTENTE;
    } else {
      // Pas d'auréole : on injecte de nouveau — 5 mL, ou 2 mL une fois l'auréole apparue.
      e.nPos = 0; e.tTache = null; e.tInjection = e.t + DECISION; e.dV = e.confirmation ? 2 : 5;
    }
  };

  const avancer = (dt) => {
    if (e.fini) return false;
    let reste = dt;
    while (reste > 1e-9 && !e.fini) {
      const prochain = Math.min(e.tTache ?? Infinity, e.tInjection ?? Infinity);
      const h = Math.min(reste, prochain - e.t);
      e.t += h; reste -= h;
      if (e.t < prochain - 1e-9) continue;
      if (e.tInjection !== null && e.t >= e.tInjection - 1e-9) {
        injecter(e.dV); e.tInjection = null; e.tTache = e.t + ATTENTE;
      } else if (e.tTache !== null) tache();
    }
    return !e.fini;
  };

  // ── Dessin ──────────────────────────────────────────────────────────────
  const BE = { x0: 64, x1: 196, yFond: 352, yNiveau: 268 }; // bécher : bords, fond, niveau de 500 mL
  const PF = { x0: 300, y0: 40, dx: 32, dy: 50 }; // papier filtre : coin, pas des taches
  function fond() {
    return svg({
      largeur: 640, hauteur: 412, titre: "Essai au bleu : agitateur, bécher, burette et papier filtre", contenu: () => {
        let s = paillasse(0, 640, 392);
        // Potence de l'agitateur.
        s += `<rect x="22" y="40" width="10" height="352" fill="#94a3b8" stroke="#64748b"/><rect x="22" y="64" width="78" height="10" fill="#94a3b8" stroke="#64748b"/>`;
        s += `<rect x="94" y="40" width="72" height="56" rx="6" fill="#e2e8f0" stroke="#475569" stroke-width="1.3"/>`;
        s += texte(130, 32, "agitateur à ailettes", 'text-anchor="middle" style="font-size:10.5px;font-weight:700;fill:#334155"');
        // Burette sur son support.
        s += `<rect x="252" y="20" width="6" height="372" fill="#94a3b8" stroke="#64748b"/><rect x="216" y="60" width="40" height="7" fill="#94a3b8" stroke="#64748b"/>`;
        s += texte(222, 14, "burette (bleu à 10 g/L)", 'text-anchor="middle" style="font-size:10.5px;font-weight:700;fill:#334155"');
        // Papier filtre.
        s += `<rect x="${PF.x0 - 6}" y="${PF.y0 - 10}" width="${COL * PF.dx + 12}" height="${RANGS * PF.dy + 14}" rx="4" fill="#fdfdfb" stroke="#cbd5e1"/>`;
        s += texte(PF.x0 + (COL * PF.dx) / 2, PF.y0 + RANGS * PF.dy + 22, "papier filtre : une tache par minute", 'text-anchor="middle" style="font-size:10.5px;font-weight:700;fill:#334155"');
        // Légende des taches.
        s += tacheSVG(316, 346, 6, 0, false) + texte(330, 350, "pas d'auréole : le sol fixe encore le bleu", 'style="font-size:10.5px;fill:#334155"');
        s += tacheSVG(316, 372, 6, 3, true) + texte(330, 376, "auréole bleu clair : le bleu est en excès", 'style="font-size:10.5px;fill:#334155"');
        s += `<g class="dyn-beche"></g><g class="dyn-papier"></g>`;
        return s;
      },
    });
  }

  /** Une tache : dépôt bleu foncé, auréole humide incolore ou bleu clair. */
  function tacheSVG(x, y, r, F, pos) {
    const halo = pos ? `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r * 1.75)}" fill="${BLEU_CLAIR}" opacity="${r1(Math.min(0.95, 0.45 + 0.12 * (F - SEUIL)))}"/>`
      : `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r * 1.75)}" fill="#e2e8f0" opacity=".7"/>`;
    return halo + `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r)}" fill="${BLEU_FONCE}"/>`;
  }

  function dessiner() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    const tH = horloge(), disp = e.t < DISPERSION && !e.fini;
    const rpm = e.fini ? 0 : disp ? 700 : 400;
    let s = "";
    // Afficheur de l'agitateur, arbre et ailettes qui tournent.
    s += `<rect x="104" y="52" width="52" height="20" rx="3" fill="#0f172a"/>` + texte(150, 67, `${rpm}`, 'text-anchor="end" style="font-family:ui-monospace,Consolas,monospace;font-size:12px;font-weight:700;fill:#67e8f9"');
    s += texte(130, 88, "tr/min", 'text-anchor="middle" style="font-size:10px;fill:#475569"');
    s += `<rect x="128" y="96" width="4" height="${BE.yFond - 26 - 96}" fill="${ACIER}" stroke="${ACIER_SOMBRE}" stroke-width=".6"/>`;
    // Suspension : la teinte du sol bleuit à mesure que l'argile fixe le bleu.
    const sat = Math.min(1, e.V / (e.S + SEUIL));
    const coul = melange(e.teintes.suspension, "#3b5b9a", 0.75 * sat);
    s += `<path d="M${BE.x0 + 2} ${BE.yNiveau}H${BE.x1 - 2}V${BE.yFond - 2}H${BE.x0 + 2}Z" fill="${coul}" opacity=".9"/>`;
    if (rpm) for (let q = 0; q < 14; q++) { const a = tH * 3 + q * 0.45, rx = 40 * hasard(q, 1) + 8; s += `<circle cx="${r1(130 + rx * Math.cos(a))}" cy="${r1(BE.yNiveau + 14 + hasard(q, 2) * 60)}" r="${r1(0.8 + hasard(q, 3))}" fill="${e.teintes.sombre}" opacity=".7"/>`; }
    const ang = rpm ? tH * 2 * Math.PI * 3 : 0;
    for (const dph of [0, Math.PI / 2]) {
      const l = 22 * Math.cos(ang + dph);
      s += `<rect x="${r1(130 - Math.abs(l))}" y="${BE.yFond - 30}" width="${r1(2 * Math.abs(l) + 0.6)}" height="10" fill="${Math.cos(ang + dph) > 0 ? "#cbd5e1" : "#94a3b8"}" stroke="${ACIER_SOMBRE}" stroke-width=".6"/>`;
    }
    // Bécher (verre).
    s += `<path d="M${BE.x0} 196V${BE.yFond}H${BE.x1}V196" fill="none" stroke="#475569" stroke-width="1.8"/><path d="M${BE.x0 - 6} 196h8M${BE.x1 - 2} 196h8" stroke="#475569" stroke-width="1.8"/>`;
    s += `<path d="M${BE.x0 + 7} 206V${BE.yFond - 8}" stroke="#fff" stroke-width="3" opacity=".6"/>`;
    s += texte(BE.x1 + 6, BE.yNiveau + 4, "500 mL", 'style="font-size:10px;font-weight:700;fill:#475569"');
    // Burette de 50 mL, remplie à nouveau dès qu'elle se vide ; écoulement pendant 6 s après chaque injection.
    const yB0 = 70, yB1 = 210, reste = 50 - (e.V % 50); // vide, elle est aussitôt remplie à nouveau
    s += `<rect x="216" y="${yB0}" width="12" height="${yB1 - yB0}" fill="#f8fafc" stroke="#475569"/>`;
    s += `<rect x="217" y="${r1(yB1 - (reste / 50) * (yB1 - yB0))}" width="10" height="${r1((reste / 50) * (yB1 - yB0))}" fill="#1d4ed8" opacity=".85"/>`;
    for (let k = 0; k <= 5; k++) s += `<path d="M216 ${r1(yB0 + (k * (yB1 - yB0)) / 5)}h5" stroke="#334155"/>`;
    s += `<path d="M222 ${yB1}V222L196 236" fill="none" stroke="#475569" stroke-width="2"/><rect x="214" y="214" width="16" height="6" rx="2" fill="#64748b"/>`;
    const der = e.injections.at(-1), coule = der && e.t - der.t < 6 && !e.fini;
    if (coule) for (let q = 0; q < 4; q++) { const p2 = (tH * 2 + q / 4) % 1; s += `<circle cx="${r1(192 - 6 * p2)}" cy="${r1(240 + p2 * (BE.yNiveau - 240))}" r="2" fill="#1d4ed8"/>`; }
    if (coule) s += texte(236, 252, `+ ${der.dv} mL`, 'class="halo" style="font-size:11px;font-weight:800;fill:#1d4ed8"');
    // Baguette : dans le bécher, ou au-dessus du papier pendant 4 s quand on dépose une goutte.
    const dt2 = e.taches.length ? e.t - e.taches.at(-1).t : Infinity;
    if (dt2 < 4 && !e.fini) {
      const k = e.taches.length - 1, [xt, yt] = posTache(k);
      s += `<path d="M${r1(xt + 4)} ${r1(yt - 6)}L${r1(xt + 46)} ${r1(yt - 70)}" stroke="#94a3b8" stroke-width="4" stroke-linecap="round" opacity=".9"/>`;
    } else s += `<path d="M168 210L182 ${BE.yNiveau + 40}" stroke="#94a3b8" stroke-width="4" stroke-linecap="round" opacity=".9"/>`;
    svgEl.querySelector(".dyn-beche").innerHTML = s;
    // Papier filtre : la rangée des taches, et le volume injecté sous chacune.
    let p = "";
    const premiere = Math.max(0, e.taches.length - COL * RANGS);
    e.taches.slice(premiere).forEach((x, j) => {
      const [xt, yt] = posTache(premiere + j);
      p += tacheSVG(xt, yt, 6, x.F, x.pos) + texte(xt, yt + 24, f(x.V, 3), `text-anchor="middle" style="font-size:10px;font-weight:700;fill:${x.pos ? "#0369a1" : "#64748b"}"`);
    });
    svgEl.querySelector(".dyn-papier").innerHTML = p;
    // Afficheurs.
    c.lectures.innerHTML = lectures([
      ["Temps d'essai", duree(e.t), ""],
      ["Bleu injecté V", f(e.V, 4), "mL"],
      ["Taches", String(e.taches.length), ""],
      ["Taches avec auréole", String(e.taches.filter((x) => x.pos).length), ""],
      ["V/m0 (VB provisoire)", fd(e.V / e.m0, 2), "g/100 g"],
    ]) + `<p class="banc-etat">${etat()}</p>`;
    loupe(...vueLoupe());
  }

  /** Position (x, y) de la k-ième tache sur le papier. */
  const posTache = (k) => {
    const j = k - Math.max(0, e.taches.length - COL * RANGS);
    return [PF.x0 + PF.dx / 2 + (j % COL) * PF.dx, PF.y0 + 14 + Math.floor(j / COL) * PF.dy];
  };

  function etat() {
    if (e.fini) return "essai terminé : auréole persistante cinq minutes";
    if (e.t < DISPERSION) return `dispersion à 700 tr/min (${fd((DISPERSION - e.t) / 60, 1)} min restantes)`;
    if (e.tInjection !== null) return `pas d'auréole : injection de ${e.dV} mL`;
    return e.confirmation ? `auréole : confirmation, tache n° ${e.nPos + 1} sur 5 dans ${fd(Math.max(0, e.tTache - e.t), 0)} s`
      : `adsorption du bleu : tache dans ${fd(Math.max(0, e.tTache - e.t), 0)} s`;
  }

  // ── Loupe : la dernière tache, agrandie ──────────────────────────────────
  function vueLoupe() {
    const x = e.taches.at(-1), k = 4; // px par mm
    let s = `<rect width="${WL}" height="${HL}" fill="#fdfdfb"/>`;
    for (let q = 0; q < 40; q++) s += `<path d="M${r1(hasard(q, 1) * WL)} ${r1(hasard(q, 2) * HL)}l${r1(6 + 8 * hasard(q, 3))} ${r1(3 * hasard(q, 4) - 1.5)}" stroke="#e7e5e4" stroke-width="1"/>`;
    if (!x) return [s + barreEchelle(k), e.t < DISPERSION ? "papier filtre vierge : on disperse d'abord le sol" : "première tache une minute après la première injection"];
    const cx = 88, cy = 80;
    // Auréole : bleu clair si le bleu est en excès, sinon simple trace humide.
    s += `<circle cx="${cx}" cy="${cy}" r="62" fill="${x.pos ? BLEU_CLAIR : "#e2e8f0"}" opacity="${x.pos ? r1(Math.min(0.95, 0.45 + 0.12 * (x.F - SEUIL))) : 0.75}"/>`;
    // Dépôt : le sol chargé de bleu, au bord irrégulier.
    let d = "";
    for (let j = 0; j <= 28; j++) { const a = (j / 28) * 2 * Math.PI, r = 38 + 3.5 * Math.sin(5 * a + e.taches.length) + 2 * hasard(j, e.taches.length); d += `${j ? "L" : "M"}${r1(cx + r * Math.cos(a))} ${r1(cy + r * Math.sin(a))}`; }
    s += `<path d="${d}Z" fill="${BLEU_FONCE}"/>`;
    for (let q = 0; q < 34; q++) { const a = hasard(q, 5) * 2 * Math.PI, r = 34 * Math.sqrt(hasard(q, 6)); s += `<circle cx="${r1(cx + r * Math.cos(a))}" cy="${r1(cy + r * Math.sin(a))}" r="${r1(0.8 + 1.2 * hasard(q, 7))}" fill="#312e81"/>`; }
    s += texte(cx, cy + 4, "dépôt", 'text-anchor="middle" style="font-size:9.5px;font-weight:700;fill:#fff"');
    s += etiquette(WL - 6, 14, x.pos ? "auréole bleu clair" : "auréole incolore", { ancre: "end", couleur: x.pos ? "#0369a1" : "#64748b" });
    s += barreEchelle(k);
    const n = e.taches.length;
    const leg = x.pos ? (e.fini ? `tache n° ${n} : l'auréole a tenu cinq minutes, V = ${f(e.V, 4)} mL` : `tache n° ${n} : auréole bleu clair, le bleu est en excès — on confirme`)
      : `tache n° ${n} (V = ${f(x.V, 4)} mL) : pas d'auréole, l'argile a tout fixé`;
    return [s, leg];
  }

  // ── Courbes : volume injecté et taches ; réglette des seuils de VBS ──────
  function dessinerLent() {
    const cle = `${e.cle}|${e.taches.length}|${e.injections.length}|${e.fini}`;
    if (cle === e.cleCourbe) return;
    e.cleCourbe = cle;
    const zone = c.courbes.querySelector(".dyn-dosage"), zr = c.courbes.querySelector(".dyn-reglette");
    if (!zone) return;
    const tFin = Math.max(10, (e.t + 120) / 60), vMax = Math.max(10, e.V * 1.15, (e.S + SEUIL) * 1.1);
    const escalier = [[0, 0], [DISPERSION / 60, 0]];
    for (const x of e.injections) escalier.push([x.t / 60, x.V - x.dv], [x.t / 60, x.V]);
    escalier.push([e.t / 60, e.V]);
    zone.innerHTML = graphe({
      largeur: 560, hauteur: 260, xmin: 0, xmax: tFin, ymin: 0, ymax: vMax, xlabel: "temps (min)", ylabel: "bleu injecté V (mL)",
      series: [
        { points: escalier, couleur: COULEURS.bleu, epaisseur: 2, libelle: "volume de bleu injecté" },
        { points: e.taches.filter((x) => !x.pos).map((x) => [x.t / 60, x.V]), couleur: "#94a3b8", nuage: true, rayon: 4, libelle: "tache sans auréole" },
        { points: e.taches.filter((x) => x.pos).map((x) => [x.t / 60, x.V]), couleur: "#0284c7", nuage: true, rayon: 4.5, libelle: "tache avec auréole" },
      ],
      marques: e.fini ? [{ x: e.t / 60, y: e.V, couleur: COULEURS.effort, libelle: `V = ${f(e.V, 4)} mL` }] : [],
    });
    zr.innerHTML = reglette(e.fini ? vbs({ V: e.V, m0: e.m0, C: e.C }).VBS : NaN);
  }

  /** Réglette logarithmique des seuils de VBS du GTR 2024, avec la valeur mesurée au-dessus. */
  function reglette(VBS) {
    const S = SEUILS_2024.VBS, x0 = 30, x1 = 530, a = 0.01, z = 20;
    const X = (v) => x0 + ((Math.log10(v) - Math.log10(a)) / (Math.log10(z) - Math.log10(a))) * (x1 - x0);
    const seuils = [[S.inactif, "insensible à l'eau (fines ≤ 10 %)"], [S.sensible, "sensible à l'eau au-delà"], [S.I, "I1 | I2"], [S.F12, "F1 | F2"], [S.F23, "F2 | F3"], [S.F34, "F3 | F4"]];
    const bandes = ["#bbf7d0", "#d9f99d", "#fef08a", "#fde68a", "#fdba74", "#fca5a5", "#f87171"];
    const bornes = [a, ...seuils.map(([v]) => v), z];
    return svg({
      largeur: 560, hauteur: 150, titre: "Seuils de VBS du GTR 2024", contenu: () => {
        let s = texte(280, 16, "VBS (g de bleu pour 100 g de sol, échelle logarithmique) et seuils du GTR 2024", 'text-anchor="middle" style="font-size:11.5px;font-weight:800"');
        bornes.slice(0, -1).forEach((v, i) => { s += `<rect x="${r1(X(v))}" y="66" width="${r1(X(bornes[i + 1]) - X(v))}" height="18" fill="${bandes[i]}"/>`; });
        s += `<rect x="${x0}" y="66" width="${x1 - x0}" height="18" fill="none" stroke="#334155"/>`;
        s += texte(x0, 104, "0,01", 'text-anchor="middle" style="font-size:11px;fill:#64748b"') + texte(x1, 104, "20", 'text-anchor="middle" style="font-size:11px;fill:#64748b"');
        seuils.forEach(([v, lib], i) => {
          const x = X(v);
          s += `<path d="M${r1(x)} 66V92" stroke="#334155" stroke-width="1.2"/>`;
          s += texte(x, 104, String(v).replace(".", ","), 'text-anchor="middle" style="font-size:11px;font-weight:800;fill:#0f172a"');
          s += texte(Math.min(Math.max(x, 96), 470), i % 2 ? 141 : 122, lib, 'text-anchor="middle" style="font-size:11px;fill:#334155"');
        });
        if (Number.isFinite(VBS)) {
          const x = X(Math.min(Math.max(VBS, a), z));
          s += `<path d="M${r1(x)} 64l-6 -9h12z" fill="${COULEURS.effort}"/><path d="M${r1(x)} 64V86" stroke="${COULEURS.effort}" stroke-width="2.6"/>`;
          s += texte(Math.min(Math.max(x, 70), 490), 46, `VBS mesurée = ${fd(VBS, VBS < 1 ? 2 : 1)}`, `text-anchor="middle" class="halo" style="font-size:12px;font-weight:800;fill:${COULEURS.effort}"`);
        }
        return s;
      },
    });
  }

  function bilan() {
    const r = vbs({ V: e.V, m0: e.m0, C: e.C }), a = analyser(e.sol.granulo);
    const cl = classerSol({ Dmax: a.Dmax, p63um: a.p63um, p2mm: a.p2mm, Cu: a.Cu, D60: a.D60, fractionSable: a.fractionSable, fractionGrave: a.fractionGrave, VBS: r.VBS });
    const S = SEUILS_2024.VBS, v = r.VBS, fam = cl.classeFraction;
    // Ce que dit la VBS, selon la famille du sol (granulométrie).
    let plage;
    if (fam === "F") plage = v <= S.F12 ? `au plus ${fd(S.F12, 1)} : limoneux peu plastique` : v <= S.F23 ? `entre ${fd(S.F12, 1)} et ${S.F23} : limoneux de plasticité moyenne` : v <= S.F34 ? `entre ${S.F23} et ${S.F34} : argileux` : `au-delà de ${S.F34} : très argileux`;
    else if (fam === "I") plage = v <= S.I ? `au plus ${fd(S.I, 1)} : sablo-limoneux` : `au-delà de ${fd(S.I, 1)} : sablo-argileux`;
    else plage = v <= S.inactif ? `au plus ${fd(S.inactif, 1)} : fines inactives` : v <= S.sensible ? `entre ${fd(S.inactif, 1)} et ${fd(S.sensible, 1)} : sensibilité à l'eau douteuse` : `au-delà de ${fd(S.sensible, 1)} : fines actives`;
    const nature = { F: "sol fin", I: "sol intermédiaire", S: "sable", G: "grave" }[fam];
    const sym = `${cl.sousClasse}${cl.ins ? "ins" : ""}`;
    const eau = fam === "S" || fam === "G" ? (cl.ins ? ", insensible à l'eau" : ", sensible à l'eau (pas de suffixe ins)") : "";
    const v1 = e.taches.find((x) => x.pos).V;
    const aureole = v1 === e.V ? `l'auréole, apparue à ${f(v1, 4)} mL, a tenu cinq minutes` : `l'auréole, apparue à ${f(v1, 4)} mL, s'est effacée : il a fallu aller par 2 mL jusqu'à ${f(e.V, 4)} mL pour qu'elle tienne cinq minutes`;
    c.bilan.innerHTML = `<p class="final-result">V = ${f(e.V, 4)} mL de solution à 10 g/L, soit B = ${fd(r.B, 2)} g de bleu pour m0 = ${e.m0} g de 0/5 mm ⇒ VB = <strong>${fd(r.VB, 2)}</strong> g/100 g ;
        C = ${fd(e.C, 2)} ⇒ VBS = C·VB = <strong>${fd(v, v < 1 ? 2 : 1)}</strong> (${plage}) ⇒ ${nature} <strong>${sym}</strong> au GTR 2024${eau}.
        <small>Essai à la tache selon la NF P94-068 (NF EN 17542-3) : ${e.taches.length} taches en ${duree(e.t)} ; ${aureole}. La VBS dit à la fois la quantité et l'activité de l'argile : le GTR 2024 la privilégie pour les sols F1, I, S et G.</small></p>`;
  }

  b = boucle({ avancer, dessiner, dessinerLent, surFin: () => { dessinerLent(); bilan(); }, surEtat: () => etatBoutons?.(), pasMax: 5 });
  etatBoutons = brancherMarche(c, b, reinit);
  c.commandes.querySelectorAll("select").forEach((x) => x.addEventListener("change", () => { b.raz(); reinit(); etatBoutons(); }));
  reinit();
  etatBoutons();
}
