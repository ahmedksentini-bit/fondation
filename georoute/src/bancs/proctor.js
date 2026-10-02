// Banc d'essai : l'essai Proctor (chapitre 3, NF EN 13286-2). On choisit le
// sol, l'énergie — Proctor normal : dame de 2,5 kg tombant de 305 mm, trois
// couches ; Proctor modifié : 4,5 kg, 457 mm, cinq couches — et le moule : A
// (Ø 100 mm, 25 coups par couche) pour les sols dont D ≤ 20 mm, B (Ø 150 mm,
// 56 coups, celui du CBR) jusqu'à 31,5 mm, la fraction plus grosse étant
// écrêtée. Pour cinq teneurs en eau qui encadrent l'optimum, on humidifie et
// malaxe le sol, on le compacte couche par couche (environ 25 coups par
// minute), on arase, on pèse le moule plein et l'on prélève de quoi mesurer
// la teneur en eau ; chaque point (w, ρd) se place sous les courbes de
// saturation, et la parabole ajustée autour du plus dense donne l'optimum dès
// qu'il est encadré. Le sol suit la courbe Proctor de son matériau virtuel
// (materiaux.js) ; la teneur en eau, mesurée après 24 h d'étuve à 105 °C, est
// affichée dès le prélèvement. L'essai fait à l'autre énergie, sur le même
// sol, reste en mémoire pour la comparaison.
import { svg, ligne, texte, couche, COULEURS, graphe, echantillon } from "../figures.js";
import { SOLS, proctorDe, proctorModifieDe } from "./materiaux.js";
import { MOULES, DAMES, volumeMoule, energie, rhoDPoint, optimum, rhoDSaturation, saturationOptimum } from "../gtr/proctor.js";
import { etat } from "../gtr/identification.js";
import { cleEtats, etatHydrique, ETATS_2024, enClair } from "../gtr/classification.js";
import { controleDensite } from "../gtr/compactage.js";
import { charpente, boucle, brancherMarche, lectures, f, fd, r1, esc, duree } from "./moteur.js";
import { fenetreLoupe, blocSol, fondSol, teinte, fleche, choc, etiquette, horloge, W as WL, H as HL, ROUGE, BLEU, EAU, ACIER, ACIER_SOMBRE } from "./loupe.js";
import { choix, graine, bruit, regulateur, instantCycle, classerCatalogue, paillasse, balance, etuve, tare, dame, moule, legende, assouplir } from "./labo-dessin.js";

const CADENCE = 2.4; // s par coup : environ 25 coups par minute
const LEVEE = 1.5; // s pour remonter la masse jusqu'à la butée
const DUREES = { preparation: 180, versement: 15, arasement: 60, pesee: 30, prelevement: 45 };
const TARE = { A: 3870, B: 7240 }; // g : moule et embase
const KCHUTE = 0.2; // px par mm pour la hauteur de chute (dessin réduit)
const YP = 288; // dessus de la paillasse
const XM = 290, XB = 492, XR = 404; // axes du moule, de la balance et de la dame au repos
const POSITIONS = [0, 0.75, -0.75, 0.4, -0.4, 1, -1, 0.55, -0.55, 0.2, -0.2]; // répartition des coups sur la surface
const NOMS_PHASES = { preparation: "humidification et malaxage", versement: "versement de la couche", compactage: "compactage", arasement: "arasement à la règle", pesee: "pesée du moule plein", prelevement: "prélèvement pour la teneur en eau" };

export function monter(banc) {
  const c = charpente(banc, {
    vitesse: 100, vitesses: [1, 10, 100, 1000],
    commandes: choix("Sol", "sol", Object.entries(SOLS).map(([k, s]) => [k, `${s.nom} (${s.classe})`]))
      + choix("Énergie", "energie", [["normal", "Proctor normal : 2,5 kg, 305 mm, 3 couches"], ["modifie", "Proctor modifié : 4,5 kg, 457 mm, 5 couches"]])
      + choix("Moule", "moule", [["A", "moule A : Ø 100 mm, 25 coups par couche"], ["B", "moule B (CBR) : Ø 150 mm, 56 coups"]])
      + '<p class="method-note banc-note" style="grid-column:1/-1;margin:0"></p>',
  });
  const loupe = fenetreLoupe(c, "la dame et la couche", { echelle: { px: 30, libelle: "2 cm" } });
  assouplir(c);
  const memoire = {}; // essais terminés : memoire[sol][énergie] = { points, opt }
  let e, b, etatBoutons, vit;

  const reinit = () => {
    const cle = c.q('[data-r="sol"]').value, s = SOLS[cle];
    const selM = c.q('[data-r="moule"]');
    selM.querySelector('option[value="A"]').disabled = s.Dmax > 20;
    if (s.Dmax > 20) selM.value = "B";
    const mo = selM.value, en = c.q('[data-r="energie"]').value;
    const d = DAMES[en], m = MOULES[mo], V = volumeMoule(m), N = d.coups[mo], nc = d.couches;
    const courbe = en === "normal" ? proctorDe(s) : proctorModifieDe(s);
    // L'opérateur centre ses cinq points sur l'optimum qu'il attend, à un demi-point près.
    let wAttendu = s.wOPN, rMax = 0;
    for (let w = 1; w < 40; w += 0.05) { const r = courbe(w); if (r > rMax) { rMax = r; wAttendu = w; } }
    const g = graine(cle + en + mo), pas = wAttendu < 9 ? 1.5 : 2;
    const centre = Math.round((wAttendu + 0.6 * bruit(g, 1)) * 2) / 2;
    const mesures = [-2, -1, 0, 1, 2].map((k, i) => {
      const wVise = centre + k * pas, w = wVise + 0.18 * bruit(g, 10 + i);
      const M = Math.round(courbe(w) * (1 + 0.004 * bruit(g, 20 + i)) * (1 + w / 100) * V);
      const rhoD = rhoDPoint({ M, V, w });
      return { wVise, w, M, Mplein: M + TARE[mo], rhoH: M / V, rhoD, Sr: etat({ rho: M / V, w, rhoS: s.rhoS }).Sr };
    });
    const hf = (m.H + 6) / nc; // épaisseur compactée d'une couche (mm) : la dernière dépasse de 6 mm dans la hausse
    e = { cle, s, en, mo, d, m, V, N, nc, mesures, hf, K: mo === "A" ? 0.9 : 0.72, hl: hf * 1.45, chute: d.chute * 1000, tChute: Math.sqrt((2 * d.chute) / 9.81),
      prog: programme(nc), k: 0, tp: 0, t: 0, faits: 0, fini: false, cleCourbe: "" };
    c.q(".banc-note").innerHTML = `${esc(s.nom)} : ${esc(s.texte)} ; D<sub>max</sub> = ${f(s.Dmax, 3)} mm, ρ<sub>s</sub> = ${fd(s.rhoS, 2)} Mg/m³.`
      + (s.Dmax > 31.5 ? ` Les éléments de plus de 31,5 mm sont écrêtés : l'essai se fait sur la fraction 0/31,5 mm, au moule B.` : s.Dmax > 20 ? " D > 20 mm : moule B obligatoire." : "");
    vit?.retablir();
    c.scene.innerHTML = fond();
    c.courbes.innerHTML = '<div class="dyn-courbe"></div>';
    c.bilan.innerHTML = "";
    dessiner(); dessinerLent();
  };

  function programme(nc) {
    const p = [];
    for (let i = 0; i < 5; i++) {
      p.push({ type: "preparation", i, duree: DUREES.preparation });
      for (let j = 0; j < nc; j++) { p.push({ type: "versement", i, j, duree: DUREES.versement }); p.push({ type: "compactage", i, j, duree: 0 }); }
      p.push({ type: "arasement", i, duree: DUREES.arasement }, { type: "pesee", i, duree: DUREES.pesee }, { type: "prelevement", i, duree: DUREES.prelevement });
    }
    return p;
  }
  const dureePas = (p) => (p.type === "compactage" ? e.N * CADENCE : p.duree);
  const pasCourant = () => e.prog[Math.min(e.k, e.prog.length - 1)];

  const avancer = (dt) => {
    if (e.fini) return false;
    let reste = dt;
    while (reste > 1e-9 && !e.fini) {
      const p = e.prog[e.k], D = dureePas(p), h = Math.min(reste, D - e.tp);
      e.tp += h; e.t += h; reste -= h;
      if (e.tp >= D - 1e-9) {
        if (p.type === "prelevement") e.faits = p.i + 1;
        e.k++; e.tp = 0;
        if (e.k >= e.prog.length) { e.fini = true; e.k = e.prog.length - 1; e.tp = dureePas(e.prog[e.k]); }
      }
    }
    return !e.fini;
  };

  /** Coups déjà portés dans la couche en cours de compactage. */
  const coupsFaits = () => {
    const p = pasCourant();
    if (p.type !== "compactage") return 0;
    const tImpact = LEVEE + e.tChute;
    return e.tp < tImpact ? 0 : Math.min(e.N, Math.floor((e.tp - tImpact) / CADENCE + 1e-9) + 1);
  };
  /** Épaisseur (mm) d'une couche foisonnée après n coups : elle tend vers l'épaisseur compactée. */
  const epaisseur = (n) => e.hf + (e.hl - e.hf) * (1 - (1 - Math.exp((-4 * n) / e.N)) / (1 - Math.exp(-4)));
  /** Hauteur de chute dessinée de la masse (0 au repos, 1 en butée haute), et choc en cours. */
  const levee = () => {
    const p = pasCourant();
    if (p.type !== "compactage" || e.fini) return { lev: 0, choc: false };
    const tc = instantCycle(e.tp, CADENCE, vit?.vitesse ?? 1), tI = LEVEE + e.tChute;
    if (tc < LEVEE) return { lev: 0.5 - 0.5 * Math.cos((Math.PI * tc) / LEVEE), choc: false };
    if (tc < tI) return { lev: 1 - ((tc - LEVEE) / e.tChute) ** 2, choc: false };
    return { lev: 0, choc: tc < tI + 0.22 && e.tp >= tI };
  };

  /** État du moule : épaisseurs des couches (mm), hausse, arasement, position. */
  function etatMoule() {
    const p = pasCourant(), hs = [], plein = () => { for (let j = 0; j < e.nc; j++) hs.push(e.hf); };
    if (e.fini) return { hs, hausse: true, rase: 0, x: XM, sur: "paillasse" };
    switch (p.type) {
      case "preparation": return { hs, hausse: true, rase: 0, x: XM, sur: "paillasse" };
      case "versement": for (let j = 0; j < p.j; j++) hs.push(e.hf); hs.push(e.hl * Math.min(1, e.tp / p.duree)); return { hs, hausse: true, rase: 0, x: XM, sur: "paillasse", actif: p.j };
      case "compactage": for (let j = 0; j < p.j; j++) hs.push(e.hf); hs.push(epaisseur(coupsFaits())); return { hs, hausse: true, rase: 0, x: XM, sur: "paillasse", actif: p.j };
      case "arasement": plein(); return { hs, hausse: false, rase: Math.min(1, e.tp / (p.duree * 0.8)), x: XM, sur: "paillasse" };
      case "pesee": plein(); return { hs, hausse: false, rase: 1, x: XB, sur: "balance" };
      default: plein(); return { hs, hausse: false, rase: 1, x: XM, sur: "paillasse", vide: Math.min(1, e.tp / (p.duree * 0.4)) };
    }
  }

  // ── Dessin de la paillasse ───────────────────────────────────────────────
  function fond() {
    return svg({
      largeur: 640, hauteur: 336, titre: "Essai Proctor en cours", contenu: (id) => {
        e.id = id;
        let s = paillasse(YP);
        // Bac de malaxage.
        s += `<path d="M22 ${YP - 34}H170L160 ${YP}H32Z" fill="#e2e8f0" stroke="#64748b" stroke-width="1.3"/>`;
        s += texte(14, 20, `${e.d.nom} · ${e.nc} couches × ${e.N} coups · dame de ${fd(e.d.masse, 1)} kg tombant de ${f(e.chute, 3)} mm · V = ${f(e.V, 4)} cm³`, 'style="font-size:11px;font-weight:700;fill:#334155"');
        s += `<g class="dyn"></g>`;
        s += legende(96, YP + 33, "bac de malaxage") + legende(XM, YP + 33, `moule ${e.mo} · Ø ${e.m.D} mm`) + legende(XR, YP + 33, "dame") + legende(XB, YP + 33, "balance") + legende(601, YP + 33, "étuve");
        return s;
      },
    });
  }

  function dessiner() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    const p = pasCourant(), mes = e.mesures[p.i], st = etatMoule(), fondS = fondSol(e.s.motif);
    const colSol = (w) => teinte(fondS, Math.max(0.6, 1.06 - 0.012 * w));
    let s = "";
    // Sol dans le bac : il se vide à chaque couche versée ; l'eau y est versée puis malaxée.
    const reste = e.fini ? 0 : p.type === "preparation" ? 1 : p.type === "versement" ? 1 - (p.j + e.tp / p.duree) / e.nc : p.type === "compactage" ? 1 - (p.j + 1) / e.nc : 0;
    if (reste > 0.01) {
      const hT = 6 + 20 * reste, wSol = p.type === "preparation" && e.tp < DUREES.preparation * 0.45 ? mes.wVise - 6 * (1 - e.tp / (DUREES.preparation * 0.45)) : mes.wVise;
      s += `<path d="M36 ${YP - 4}Q96 ${r1(YP - 4 - 2 * hT)} 156 ${YP - 4}Z" fill="${colSol(wSol)}" stroke="${teinte(fondS, 0.55)}" stroke-width=".8"/>`;
    }
    if (p.type === "preparation" && !e.fini) {
      const fr = e.tp / DUREES.preparation;
      if (fr < 0.45) {
        // Éprouvette graduée inclinée : l'eau tombe sur le sol.
        s += `<g transform="rotate(-38 132 214)"><rect x="124" y="190" width="16" height="48" rx="2" fill="#f8fafc" stroke="#64748b"/><rect x="125" y="${r1(206 + 22 * fr / 0.45)}" width="14" height="${r1(31 - 22 * fr / 0.45)}" fill="${EAU}" opacity=".85"/></g>`;
        const t = horloge();
        for (let j = 0; j < 5; j++) { const q = (t * 1.6 + j / 5) % 1; s += `<circle cx="${r1(116 - 6 * q)}" cy="${r1(200 + 62 * q)}" r="1.8" fill="${BLEU}" opacity="${r1(1 - 0.5 * q)}"/>`; }
        s += legende(96, 182, `+ eau : w visée ${fd(mes.wVise, 1)} %`, { couleur: BLEU });
      } else {
        // Malaxage à la truelle.
        const x = 96 + 34 * Math.sin(horloge() * 5);
        s += `<path d="M${r1(x - 10)} ${YP - 12}l20 -6l-2 -6l-20 6z" fill="${ACIER}" stroke="${ACIER_SOMBRE}"/><path d="M${r1(x + 8)} ${YP - 22}l18 -26" stroke="#78350f" stroke-width="4" stroke-linecap="round"/>`;
        s += legende(96, 182, "malaxage", { couleur: "#78350f" });
      }
    }
    // Moule, couches et hausse.
    const yBase = st.sur === "balance" ? YP - 36 : YP;
    const K = e.K, M = moule({ cx: st.x, yBase, k: K, D: e.m.D, H: e.m.H, hausse: st.hausse ? 50 : 0 });
    s += balance(XB - 56, YP, { l: 112, lecture: st.sur === "balance" ? `${f(mes.Mplein, 5)} g` : "0,0 g" });
    s += M.fond;
    let y = M.yFond;
    st.hs.forEach((h, j) => {
      const hp = h * K, yh = y - hp, lache = st.actif === j && (p.type === "versement" || coupsFaits() < e.N * 0.25);
      s += couche(e.id, { x: M.x0, y: yh, w: M.x1 - M.x0, h: hp, sol: e.s.motif });
      s += `<rect x="${r1(M.x0)}" y="${r1(yh)}" width="${r1(M.x1 - M.x0)}" height="${r1(hp)}" fill="${colSol(mes.wVise)}" opacity="${lache ? 0.25 : 0.45}"/>`;
      s += ligne(M.x0, yh, M.x1, yh, teinte(fondS, 0.5), 0.9, j === st.hs.length - 1 ? "" : 'stroke-dasharray="3 2"');
      y = yh;
    });
    // Arasement : la règle enlève ce qui dépasse du moule.
    if (st.hs.length === e.nc && !st.hausse && st.rase > 0) {
      const xr = M.x0 + (M.x1 - M.x0) * st.rase;
      s += `<rect x="${r1(M.x0 - 1)}" y="${r1(M.yHaut - 7)}" width="${r1(xr - M.x0 + 1)}" height="${r1(M.yHaut - y + 7)}" fill="#fff"/>`;
      if (st.rase < 1) s += `<rect x="${r1(xr - 2)}" y="${r1(M.yHaut - 4)}" width="${r1(M.x1 - M.x0 + 60)}" height="4" fill="${ACIER_SOMBRE}" transform="rotate(-8 ${r1(xr)} ${r1(M.yHaut)})"/>`;
    }
    if (st.vide) s += `<rect x="${r1(M.x0)}" y="${r1(M.yHaut - 8)}" width="${r1(M.x1 - M.x0)}" height="${r1(M.yFond - M.yHaut + 8)}" fill="#fff" opacity="${r1(0.85 * st.vide)}"/>`;
    s += M.parois;
    // La dame : sur la couche pendant le compactage, sinon au repos sur la paillasse.
    const { lev, choc: frappe } = levee();
    if (p.type === "versement" && !e.fini) {
      // Une main verse la couche : des grains tombent dans le moule.
      const t = horloge();
      for (let j = 0; j < 7; j++) { const q = (t * 1.3 + j / 7) % 1; s += `<circle cx="${r1(st.x - 30 + ((j * 23) % 60))}" cy="${r1(M.yHausse - 26 + q * (y - M.yHausse + 24))}" r="2.2" fill="${colSol(mes.wVise)}" stroke="${teinte(fondS, 0.5)}" stroke-width=".5"/>`; }
    }
    if (p.type === "compactage" && !e.fini) {
      const n = coupsFaits(), R = ((e.m.D - 50) / 2) * K - 6, xd = st.x + R * POSITIONS[n % POSITIONS.length];
      const yS = y; // surface de la couche
      s += dame({ cx: xd, yPied: yS, k: K, hChute: e.chute * KCHUTE, levee: lev, lourde: e.en === "modifie" });
      s += legende(xd + 31, yS - 34 - (e.chute * KCHUTE) / 2, `chute ${f(e.chute, 3)} mm`, { ancre: "start", taille: 10 });
      if (frappe) s += `<path d="M${r1(xd - 30)} ${r1(yS - 3)}l-9 -4M${r1(xd + 30)} ${r1(yS - 3)}l9 -4" stroke="${ROUGE}" stroke-width="2"/>`;
    } else s += dame({ cx: XR, yPied: YP, k: K, hChute: e.chute * KCHUTE, levee: 0, lourde: e.en === "modifie" });
    // Étuve : une tare par point prélevé ; la dernière y entre pendant le prélèvement.
    const posTare = (i) => [585 + 22 * (i % 2), YP - 31 - 30 * Math.floor(i / 2)];
    let tares = `<path d="M576 ${YP - 60}h52M576 ${YP - 90}h52" stroke="#94a3b8" stroke-width="1.6"/>`;
    for (let i = 0; i < e.faits; i++) tares += tare(...posTare(i), colSol(e.mesures[i].wVise));
    s += etuve(566, YP, { l: 70, h: 132, consigne: 105, contenu: tares });
    if (p.type === "prelevement" && !e.fini && e.tp > p.duree * 0.4) {
      const q = Math.min(1, (e.tp - p.duree * 0.4) / (p.duree * 0.6)), [xa, ya] = posTare(p.i), xt = XM + (xa - XM) * q, yt = M.yHaut + (ya - M.yHaut) * q - 70 * Math.sin(Math.PI * q);
      s += tare(xt, yt, colSol(mes.wVise));
    }
    svgEl.querySelector(".dyn").innerHTML = s;
    // Afficheurs : la couche et le coup en cours ; masse et masses volumiques du dernier point pesé.
    const ip = e.faits > 0 && !(p.type === "pesee" || p.type === "prelevement") ? e.faits - 1 : p.type === "pesee" || p.type === "prelevement" ? p.i : -1;
    const mp = ip >= 0 ? e.mesures[ip] : null, avecRhoD = ip >= 0 && (ip < e.faits);
    const comp = p.type === "compactage" && !e.fini;
    c.lectures.innerHTML = lectures([
      ["Couche", comp || p.type === "versement" ? `${p.j + 1} / ${e.nc}` : "—", ""],
      ["Coup", comp ? `${coupsFaits()} / ${e.N}` : "—", ""],
      [`Masse de sol humide${mp ? ` · pt ${ip + 1}` : ""}`, mp ? f(mp.M, 5) : "—", "g"],
      ["ρh", mp ? fd(mp.rhoH, 3) : "—", "Mg/m³"],
      ["ρd", avecRhoD ? fd(mp.rhoD, 3) : "—", "Mg/m³"],
    ]) + `<p class="banc-etat">${e.fini ? `essai terminé en ${duree(e.t)}` : `point ${p.i + 1}/5 · w visée ${fd(mes.wVise, 1)} % — ${NOMS_PHASES[p.type]}${p.type === "versement" ? ` ${p.j + 1}` : ""}`}</p>`;
    loupe(...vueLoupe());
  }

  // ── Loupe : la face de la dame sur la couche, les grains qui se serrent ──
  const KL = 1.5, YI = 138, XC = 92; // px par mm, interface avec la couche du dessous, axe de la dame
  const PORES = Array.from({ length: 34 }, (_, i) => [8 + ((i * 53) % 160) + 4 * bruit(7, i), (i * 0.61803) % 1]);
  function vueLoupe() {
    const p = pasCourant(), mes = e.mesures[p.i], st = etatMoule(), fondS = fondSol(e.s.motif);
    let s = `<rect width="${WL}" height="${HL}" fill="#f8fafc"/>`;
    // Couche observée : celle que l'on compacte, ou la dernière du moule.
    // À la fin, on regarde la dernière couche du dernier point.
    const hs = e.fini ? Array(e.nc).fill(e.hf) : st.hs;
    const j = st.actif ?? Math.max(0, hs.length - 1), h = hs.length ? hs[j] : 0;
    const comp = p.type === "compactage" && !e.fini, n = comp ? coupsFaits() : hs.length ? e.N : 0;
    const ySurf = YI - h * KL, ratio = h > 0 ? h / e.hl : 1;
    // Couche du dessous (ou embase du moule pour la première).
    if (j === 0) s += `<rect x="0" y="${YI}" width="${WL}" height="${HL - YI}" fill="${ACIER_SOMBRE}"/><path d="M0 ${YI}H${WL}" stroke="#1e293b" stroke-width="1.4"/>` + etiquette(WL - 6, HL - 9, "embase du moule", { ancre: "end" });
    else {
      s += `<rect x="0" y="${YI}" width="${WL}" height="${HL - YI}" fill="${teinte(fondS, 0.86)}"/>` + blocSol(e.s.motif, { x0: 0, x1: WL, y0: YI, y1: HL + 20, k: 700, fond: false });
      s += `<path d="M0 ${YI}H${WL}" stroke="${teinte(fondS, 0.45)}" stroke-dasharray="4 3"/>` + etiquette(WL - 6, HL - 9, `couche ${j} compactée`, { ancre: "end" });
    }
    if (h > 0.5) {
      // Les grains, posés foisonnés, se rapprochent à mesure que la couche s'amincit.
      const deplacer = (x, yy) => [x, YI - (YI - yy) * ratio];
      s += `<rect x="0" y="${r1(ySurf)}" width="${WL}" height="${r1(YI - ySurf)}" fill="${fondS}"/>`;
      s += blocSol(e.s.motif, { x0: 0, x1: WL, y0: YI - e.hl * KL, y1: YI, k: 700, deplacer, fond: false });
      // Vides : nombreux dans la couche foisonnée, plus rares à la fin ; pleins d'eau côté humide.
      const nv = Math.round(PORES.length * (0.25 + 0.75 * (ratio - e.hf / e.hl) / (1 - e.hf / e.hl)));
      PORES.slice(0, Math.max(4, nv)).forEach(([x, u], i) => {
        const yy = YI - (u * 0.9 + 0.05) * (YI - ySurf), plein = (i % 10) / 10 < (mes.Sr / 100) - 0.05;
        s += `<circle cx="${r1(x)}" cy="${r1(yy)}" r="${r1(1.4 + 0.9 * ((i * 7) % 3) / 2)}" fill="${plein ? EAU : "#fff"}" stroke="${plein ? BLEU : "#94a3b8"}" stroke-width=".5" opacity=".9"/>`;
      });
      s += `<path d="M0 ${r1(ySurf)}H${WL}" stroke="${teinte(fondS, 0.45)}" stroke-width="1.4"/>`;
      if (mes.Sr > 85 && n > e.N * 0.3) s += `<path d="M0 ${r1(ySurf - 1.2)}H${WL}" stroke="${BLEU}" stroke-width="2" opacity=".55"/>`;
    }
    // Versement : la terre tombe dans le moule. Compactage : la face de la dame frappe la couche, le fourreau repose sur le sol.
    if (p.type === "versement" && !e.fini) {
      const t = horloge();
      for (let i = 0; i < 9; i++) { const q = (t * 1.2 + i / 9) % 1; s += `<circle cx="${r1(30 + ((i * 47) % 120))}" cy="${r1(-6 + q * (ySurf + 4))}" r="${r1(2 + (i % 3))}" fill="${teinte(fondS, 0.8)}" stroke="${teinte(fondS, 0.5)}" stroke-width=".6"/>`; }
    }
    if (comp) {
      const { lev, choc: frappe } = levee(), lm = 50 * KL, yF = ySurf - 22 - lev * (ySurf + 30);
      s += `<rect x="${XC - lm / 2 - 7}" y="0" width="4" height="${r1(ySurf)}" fill="${ACIER}" stroke="${ACIER_SOMBRE}" stroke-width=".8"/><rect x="${XC + lm / 2 + 3}" y="0" width="4" height="${r1(ySurf)}" fill="${ACIER}" stroke="${ACIER_SOMBRE}" stroke-width=".8"/>`;
      s += `<rect x="${XC - lm / 2}" y="${r1(yF)}" width="${lm}" height="22" fill="#475569" stroke="#1e293b"/>`;
      if (frappe) s += choc(XC, ySurf - 4, 52) + fleche(XC, Math.max(4, ySurf - 70), XC, ySurf - 26, ROUGE, 2.6, 7);
    }
    s += etiquette(WL - 6, 13, h > 0.5 ? `couche ${j + 1}/${e.nc} : ${fd(h, 0)} mm` : "moule vide", { ancre: "end" });
    const legendeTxt = e.fini ? "cinq points compactés : la courbe est tracée"
      : p.type === "preparation" ? `point ${p.i + 1} : le sol est humidifié à ${fd(mes.wVise, 1)} % et malaxé`
        : p.type === "versement" ? `couche ${p.j + 1} versée, foisonnée : beaucoup de vides`
          : comp ? (mes.Sr > 88 ? `coup ${n}/${e.N} : côté humide, l'eau remplit les vides et le sol ne se serre plus` : mes.w < e.mesures[2].w - 0.5 ? `coup ${n}/${e.N} : côté sec, les grains frottent et se serrent mal` : `coup ${n}/${e.N} : la dame frappe, les grains se serrent`)
            : p.type === "arasement" ? "arasement : la règle enlève le sol qui dépasse du moule"
              : p.type === "pesee" ? `moule plein pesé : ρh = ${fd(mes.rhoH, 2)} Mg/m³`
                : `w = ${fd(mes.w, 1)} % : ρd = ${fd(mes.rhoD, 2)} Mg/m³, Sr = ${fd(mes.Sr, 0)} %`;
    return [s, legendeTxt];
  }

  // ── Courbe Proctor ───────────────────────────────────────────────────────
  function dessinerLent() {
    const zone = c.courbes.querySelector(".dyn-courbe");
    if (!zone) return;
    const cleC = `${e.cle}|${e.en}|${e.faits}|${e.fini}`;
    if (cleC === e.cleCourbe) return;
    e.cleCourbe = cleC;
    const pts = e.mesures.slice(0, e.faits).map((x) => [x.w, x.rhoD]);
    const o = pts.length ? optimum(pts) : null;
    const autreCle = e.en === "normal" ? "modifie" : "normal", autre = memoire[e.cle]?.[autreCle];
    const tous = [...pts, ...(autre?.points ?? [])];
    const ws = e.mesures.map((x) => x.w).concat(autre ? autre.points.map((q) => q[0]) : []);
    const wMin = Math.floor(Math.min(...ws) - 1.5), wMax = Math.ceil(Math.max(...ws) + 1.5);
    const rs = tous.length ? tous.map((q) => q[1]) : [e.s.rhoDOPN];
    const ymin = Math.floor((Math.min(...rs) - 0.05) * 50) / 50, ymax = Math.ceil((Math.max(...rs, o?.applicable ? o.rhoDOPN : 0) + 0.07) * 50) / 50;
    const nom = (cl) => (cl === "normal" ? "Proctor normal" : "Proctor modifié"), sigle = (cl) => (cl === "normal" ? "OPN" : "OPM");
    const series = [
      { points: echantillon((w) => rhoDSaturation(w, { rhoS: e.s.rhoS, Sr: 100 }), wMin, wMax, 40), couleur: COULEURS.eau, epaisseur: 1.6, libelle: "Sr = 100 %" },
      { points: echantillon((w) => rhoDSaturation(w, { rhoS: e.s.rhoS, Sr: 80 }), wMin, wMax, 40), couleur: COULEURS.eau, epaisseur: 1.3, tirets: "6 4", libelle: "Sr = 80 %" },
    ];
    const marques = [];
    if (autre) {
      series.push({ points: autre.points, couleur: COULEURS.violet, nuage: true, rayon: 3.2 });
      if (autre.opt.applicable) {
        const ret = autre.opt.retenus.map((q) => q[0]);
        series.push({ points: echantillon(autre.opt.courbe, Math.min(...ret) - 0.4, Math.max(...ret) + 0.4, 30), couleur: COULEURS.violet, tirets: "5 3", epaisseur: 1.6, libelle: `${nom(autreCle)} (essai fait)` });
        marques.push({ x: autre.opt.wOPN, y: autre.opt.rhoDOPN, couleur: COULEURS.violet, rayon: 4, libelle: sigle(autreCle) });
      }
    }
    if (pts.length) series.push({ points: pts, couleur: COULEURS.encre, nuage: true, rayon: 4.2, libelle: "" });
    if (o?.applicable) {
      const ret = o.retenus.map((q) => q[0]);
      series.push({ points: echantillon(o.courbe, Math.min(...ret) - 0.4, Math.max(...ret) + 0.4, 40), couleur: COULEURS.gtr24, epaisseur: 2.2, libelle: `${nom(e.en)} : parabole ajustée` });
      marques.push({ x: o.wOPN, y: o.rhoDOPN, couleur: COULEURS.effort, guides: true, libelle: `${sigle(e.en)} : ${fd(o.wOPN, 1)} % · ${fd(o.rhoDOPN, 2)}` });
    }
    zone.innerHTML = graphe({
      largeur: 560, hauteur: 270, xmin: wMin, xmax: wMax, ymin, ymax, pasY: ymax - ymin > 0.3 ? 0.05 : 0.02,
      xlabel: "teneur en eau w (%)", ylabel: "ρd (Mg/m³)", series, marques,
    }) + (!pts.length ? '<p class="method-note">Chaque point (w, ρ<sub>d</sub>) se place ici après sa pesée et sa teneur en eau ; la parabole et l\'optimum apparaissent dès que le plus dense est encadré.</p>'
      : !o?.applicable ? `<p class="method-note">${pts.length} point${pts.length > 1 ? "s" : ""} : ${esc(o.motif)}</p>` : "");
  }

  function bilan() {
    const pts = e.mesures.map((x) => [x.w, x.rhoD]), o = optimum(pts);
    if (!o.applicable) { c.bilan.innerHTML = `<p class="final-result">Optimum non encadré : ${esc(o.motif)}</p>`; return; }
    (memoire[e.cle] ??= {})[e.en] = { points: pts, opt: o };
    const sat = saturationOptimum({ wOPN: o.wOPN, rhoDOPN: o.rhoDOPN, rhoS: e.s.rhoS }), E = energie(e.en, e.mo);
    const table = `<div class="table-large"><table class="resultats"><thead><tr><th>Point</th><th class="num">w (%)</th><th class="num">moule plein (g)</th><th class="num">sol humide M (g)</th><th class="num" style="text-transform:none">ρh (Mg/m³)</th><th class="num" style="text-transform:none">ρd (Mg/m³)</th><th class="num">Sr (%)</th></tr></thead><tbody>${e.mesures.map((x, i) => `<tr${o.retenus.some((q) => q[0] === x.w) ? "" : ' class="ecarte"'}><td>${i + 1}</td><td class="n">${fd(x.w, 1)}</td><td class="n">${f(x.Mplein, 5)}</td><td class="n">${f(x.M, 5)}</td><td class="n">${fd(x.rhoH, 3)}</td><td class="n">${fd(x.rhoD, 3)}</td><td class="n">${fd(x.Sr, 0)}</td></tr>`).join("")}</tbody></table></div>`;
    const pied = `<small>${e.d.nom}, NF EN 13286-2 : ${e.nc} couches × ${e.N} coups au moule ${e.mo}, énergie ${f(E, 3)} kJ/m³ ; parabole ajustée sur ${o.retenus.length === e.mesures.length ? "les cinq points" : `les ${o.retenus.length} points qui entourent le plus dense (les autres en gris)`}. Le calculateur du chapitre refait l'ajustement pour d'autres points.</small>`;
    if (e.en === "normal") {
      const cl = classerCatalogue(e.s, { wOPN: o.wOPN }), cle = cl.applicable ? cleEtats(cl.sousClasse, cl.analyse.p2mm) : null;
      const r = e.s.wn / o.wOPN;
      let etatTxt;
      if (cl.ins) etatTxt = `le sol est insensible à l'eau (${esc(cl.symbole)}) : le GTR 2024 ne lui donne pas d'état hydrique${r < 0.9 ? " ; à cette teneur en eau, bien inférieure à l'optimum, il faudra l'arroser pour le compacter efficacement" : ""}`;
      else {
        const h = cle ? etatHydrique(cle, { w: e.s.wn, wOPN: o.wOPN }) : null, ligneEtat = h?.applicable ? ETATS_2024[cle].lignes.find((l) => l.etat === h.etat) : null;
        etatTxt = h?.applicable ? `état hydrique <strong>${h.etat}</strong> au GTR 2024 (${esc(cl.sousClasse)} : ${esc(enClair(ligneEtat.r, "wn/wOPN"))})` : "état hydrique indéterminé";
      }
      const q4 = controleDensite({ rhoDmoy: o.rhoDOPN, rhoDfc: o.rhoDOPN, rhoDOPN: o.rhoDOPN, objectif: "q4" }), q3 = controleDensite({ rhoDmoy: o.rhoDOPN, rhoDfc: o.rhoDOPN, rhoDOPN: o.rhoDOPN, objectif: "q3" });
      c.bilan.innerHTML = `<p class="final-result">w<sub>OPN</sub> = <strong>${fd(o.wOPN, 1)} %</strong> et ρ<sub>dOPN</sub> = <strong>${fd(o.rhoDOPN, 2)} Mg/m³</strong>, à S<sub>r</sub> = ${fd(sat.Sr, 0)} % (${fd(sat.air, 1)} % d'air).
        En place, w<sub>n</sub> = ${fd(e.s.wn, 1)} % donne w<sub>n</sub>/w<sub>OPN</sub> = <strong>${fd(r, 2)}</strong> : ${etatTxt} ; objectifs de densification : q4 ⇒ ρ<sub>d</sub> ≥ <strong>${fd(q4.rhoDmoyRequis, 2)}</strong> en moyenne et ${fd(q4.rhoDfcRequis, 2)} en fond de couche, q3 ⇒ ≥ <strong>${fd(q3.rhoDmoyRequis, 2)}</strong> et ${fd(q3.rhoDfcRequis, 2)} Mg/m³.
        ${pied}</p>${table}`;
    } else {
      const n = memoire[e.cle]?.normal?.opt;
      const comp = n ? `plus dense de ${fd(100 * (o.rhoDOPN / n.rhoDOPN - 1), 1)} % et plus sec de ${fd(n.wOPN - o.wOPN, 1)} point${n.wOPN - o.wOPN >= 2 ? "s" : ""} que l'optimum normal (${fd(n.wOPN, 1)} % · ${fd(n.rhoDOPN, 2)})` : "lancez l'essai normal sur ce sol pour comparer les deux optimums";
      c.bilan.innerHTML = `<p class="final-result">w<sub>OPM</sub> = <strong>${fd(o.wOPN, 1)} %</strong> et ρ<sub>dOPM</sub> = <strong>${fd(o.rhoDOPN, 2)} Mg/m³</strong> (S<sub>r</sub> = ${fd(sat.Sr, 0)} %) : avec ${fd(E / energie("normal", e.mo), 1)} fois plus d'énergie, le sol est ${comp}.
        Le GTR 2024 rapporte ses objectifs de densification q4 et q3 à l'optimum Proctor <em>normal</em> ; l'optimum modifié sert aux assises de chaussée.
        ${pied}</p>${table}`;
    }
    e.cleCourbe = ""; dessinerLent();
  }

  b = boucle({ avancer, dessiner, dessinerLent, surFin: bilan, surEtat: () => etatBoutons?.(), pasMax: Infinity });
  etatBoutons = brancherMarche(c, b, reinit);
  vit = regulateur(c, b);
  c.commandes.querySelectorAll("select").forEach((x) => x.addEventListener("change", () => { b.raz(); reinit(); etatBoutons(); }));
  reinit();
  etatBoutons();
}
