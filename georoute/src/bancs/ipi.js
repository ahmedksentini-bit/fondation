// Banc d'essai : indice portant immédiat et CBR (chapitre 3, NF EN 13286-47).
// L'éprouvette est compactée à l'énergie Proctor normal dans le moule CBR
// (Ø 150 mm, trois couches de 56 coups) à la teneur en eau choisie ; puis,
// selon le mode, on la poinçonne aussitôt sans surcharge (IPI), sous deux
// surcharges annulaires de 2,27 kg (CBR immédiat), ou après quatre jours
// d'immersion sous ces surcharges, le comparateur posé sur son trépied suivant
// le gonflement (CBR immergé). La presse enfonce le piston de 19,3 cm² à
// 1,27 mm/min et l'on lit la force à 0,625 – 1,25 – 2 – 2,5 – 4 – 5 – 7,5 et
// 10 mm ; l'indice est le plus grand des rapports aux forces de référence
// (13,35 kN à 2,5 mm, 20 kN à 5 mm), après correction de l'origine quand la
// courbe commence concave. Le sol suit son matériau virtuel : IPI(w) de
// materiaux.js, CBR immédiat un peu plus fort (les surcharges confinent les
// sols grenus), CBR immergé tiré du CBRi du catalogue, gonflement d'autant
// plus fort que le sol est argileux et moulé sec. Les quatre jours d'immersion
// défilent à ×10 000. Les essais successifs sur un même sol s'accumulent sur
// la courbe IPI – w.
import { svg, ligne, texte, couche, COULEURS, graphe } from "../figures.js";
import { SOLS, ipiDe, proctorDe } from "./materiaux.js";
import { MOULES, DAMES, volumeMoule } from "../gtr/proctor.js";
import { indicePortant, gonflement, REFERENCE_CBR } from "../gtr/portance.js";
import { cleEtats, etatHydrique, insensible, ETATS_2024, intervalle, enClair } from "../gtr/classification.js";
import { charpente, boucle, brancherMarche, lectures, f, fd, r1, esc, duree } from "./moteur.js";
import { fenetreLoupe, blocSol, fondSol, teinte, fleche, etiquette, horloge, W as WL, H as HL, ROUGE, BLEU, EAU, ACIER, ACIER_SOMBRE } from "./loupe.js";
import { choix, graine, bruit, regulateur, instantCycle, classerCatalogue, paillasse, dame, moule, comparateur, ecran, legende, assouplir } from "./labo-dessin.js";

const LECTURES = [0.625, 1.25, 2, 2.5, 4, 5, 7.5, 10]; // mm
const V_PISTON = 1.27 / 60; // mm/s
const CADENCE = 2.4, LEVEE = 1.5, T_CHUTE = Math.sqrt((2 * DAMES.normal.chute) / 9.81); // dame Proctor normal : environ 25 coups par minute
const DUREES = { malaxage: 120, versement: 15, arasement: 60, surcharges: 30, immersion: 4 * 86400, egouttage: 900, presse: 40 };
const RELEVES = [0, 1, 2, 4, 8, 24, 48, 72, 96]; // h : lectures du gonflement pendant l'immersion
const ACCELERE = 10000;
const MODES = {
  ipi: { nom: "IPI : poinçonnement immédiat, sans surcharge", court: "IPI" },
  cbr: { nom: "CBR immédiat, sous surcharges", court: "CBR immédiat" },
  immersion: { nom: "CBR après 4 jours d'immersion", court: "CBR immergé" },
};
const ECARTS = [-4, -2, 0, 2, 4, 6];
const YP = 302, K = 0.6; // dessus de la paillasse ; px par mm pour le moule
const X1 = 132, X2 = 304, X3 = 516; // axes du moulage, du bac d'immersion et de la presse
const PHASES = { malaxage: "malaxage à la teneur en eau visée", versement: "versement de la couche", compactage: "compactage au Proctor normal", arasement: "arasement et pesée", surcharges: "pose des surcharges annulaires", immersion: "immersion sous surcharges : lecture du gonflement", egouttage: "égouttage (15 min)", presse: "mise en place sous la presse", poinconnement: "poinçonnement à 1,27 mm/min" };

/** CBR après immersion : maximal un peu au-dessus de l'optimum, d'autant plus sensible à w que le sol est argileux. */
const cbrImmerge = (s, w) => s.CBRi * Math.exp(-0.5 * ((w - s.wOPN - 0.5) / (2.5 + 4 * Math.exp(-s.VBS))) ** 2);

export function monter(banc) {
  const c = charpente(banc, {
    vitesse: 30, vitesses: [1, 10, 30, 100],
    commandes: choix("Sol", "sol", Object.entries(SOLS).map(([k, s]) => [k, `${s.nom} (${s.classe})`]))
      + choix("Teneur en eau de moulage", "w", [])
      + choix("Mode", "mode", Object.entries(MODES).map(([k, m]) => [k, m.nom]))
      + '<p class="method-note banc-note" style="grid-column:1/-1;margin:0"></p>',
  });
  const loupe = fenetreLoupe(c, "le piston et l'éprouvette", { echelle: { px: 30, libelle: "2 cm" } });
  assouplir(c);
  let memoire = { cle: null, essais: [] }; // essais terminés sur le sol en cours
  let e, b, etatBoutons, vit;

  /** Teneurs en eau proposées pour le sol : wn (sol en place) et des écarts à wOPN. */
  const optionsW = (s) => [["wn", `w naturelle : ${fd(s.wn, 1)} % (sol en place)`],
    ...ECARTS.map((d) => [String(d), d === 0 ? `wOPN = ${fd(s.wOPN, 1)} %` : `wOPN ${d > 0 ? "+" : "−"} ${Math.abs(d)} = ${fd(s.wOPN + d, 1)} %`])];
  const majOptionsW = () => {
    const s = SOLS[c.q('[data-r="sol"]').value], sel = c.q('[data-r="w"]'), avant = sel.value || "wn";
    sel.innerHTML = optionsW(s).map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join("");
    sel.value = optionsW(s).some(([v]) => v === avant) ? avant : "wn";
  };

  const reinit = () => {
    const cle = c.q('[data-r="sol"]').value, s = SOLS[cle], mode = c.q('[data-r="mode"]').value, wCle = c.q('[data-r="w"]').value;
    if (memoire.cle !== cle) memoire = { cle, essais: [] };
    const w = wCle === "wn" ? s.wn : s.wOPN + Number(wCle);
    const g = graine(`${cle}|${wCle}|${mode}`), V = volumeMoule(MOULES.B);
    const rhoD = proctorDe(s)(w) * (1 + 0.004 * bruit(g, 1)), M = Math.round(rhoD * (1 + w / 100) * V);
    // Indice visé par le matériau virtuel, puis forme de la courbe : plus droite pour un sol fin
    // et humide ; un pied concave (mauvais contact) quand la surface est ramollie.
    const ipi = ipiDe(s)(w);
    const cible = (mode === "ipi" ? ipi : mode === "cbr" ? ipi * (1 + 0.25 * Math.exp(-s.VBS)) : cbrImmerge(s, w)) * (1 + 0.03 * bruit(g, 2));
    const p = (s.VBS < 0.2 ? 0.6 : 0.72) + 0.04 * Math.max(-1, Math.min(2, (w - s.wOPN) / 2)) + (mode === "immersion" ? 0.05 : 0);
    const toe = w > s.wOPN + 1 || mode === "immersion" ? 0.6 + 0.12 * bruit(g, 3) : 0;
    const forme = (x) => { const se = toe > 0 ? x - toe * (1 - Math.exp(-x / toe)) : x; return Math.max(0, se) ** p; };
    const echelle = cible / indicePortant([[0, 0], ...LECTURES.map((x) => [x, forme(x)])]).indice;
    const facteurs = [[0, 1], ...LECTURES.map((x, i) => [x, 1 + 0.015 * bruit(g, 10 + i)])];
    const facteur = (x) => { for (let i = 1; i < facteurs.length; i++) if (x <= facteurs[i][0]) { const [a, fa] = facteurs[i - 1], [b2, fb] = facteurs[i]; return fa + ((fb - fa) * (x - a)) / (b2 - a); } return facteurs.at(-1)[1]; };
    const F = (x) => echelle * forme(x) * facteur(x);
    // Gonflement pendant l'immersion : fort pour une argile moulée sèche, nul pour un sol grenu.
    const gFinal = Math.max(0, 0.12 * s.VBS * (1 + 0.12 * (s.wOPN - w))) * (1 + 0.05 * bruit(g, 4)), tau = (3 + 2 * s.VBS) * 3600;
    e = { cle, s, mode, wCle, w, g, V, M, rhoD, F, toe, dhFinal: (120 * gFinal) / 100, tau, prog: programme(mode), k: 0, tp: 0, t: 0,
      sP: 0, lus: [], releves: [], fini: false, resultat: null, cleCourbes: "" };
    c.q(".banc-note").innerHTML = `${esc(s.nom)} (${esc(s.classe)}) : w<sub>OPN</sub> = ${fd(s.wOPN, 1)} %, w<sub>n</sub> = ${fd(s.wn, 1)} %. Éprouvette moulée à <strong>w = ${fd(w, 1)} %</strong> au moule CBR, énergie Proctor normal (3 couches × 56 coups) : ρ<sub>d</sub> ≈ ${fd(rhoD, 2)} Mg/m³.`;
    vit?.retablir();
    c.scene.innerHTML = fond();
    c.courbes.innerHTML = '<div class="dyn-force"></div><div class="dyn-ipi"></div><div class="dyn-gonfl"></div>';
    c.bilan.innerHTML = "";
    dessiner(); dessinerLent();
  };

  function programme(mode) {
    const p = [{ type: "malaxage", duree: DUREES.malaxage }];
    for (let j = 0; j < 3; j++) p.push({ type: "versement", j, duree: DUREES.versement }, { type: "compactage", j, duree: 56 * CADENCE });
    p.push({ type: "arasement", duree: DUREES.arasement });
    if (mode !== "ipi") p.push({ type: "surcharges", duree: DUREES.surcharges });
    if (mode === "immersion") p.push({ type: "immersion", duree: DUREES.immersion }, { type: "egouttage", duree: DUREES.egouttage });
    p.push({ type: "presse", duree: DUREES.presse }, { type: "poinconnement", duree: 10 / V_PISTON });
    return p;
  }
  const pas = () => e.prog[Math.min(e.k, e.prog.length - 1)];

  const avancer = (dt) => {
    if (e.fini) return false;
    let reste = dt;
    while (reste > 1e-9 && !e.fini) {
      const p = e.prog[e.k], h = Math.min(reste, p.duree - e.tp);
      e.tp += h; e.t += h; reste -= h;
      if (p.type === "immersion") {
        while (e.releves.length < RELEVES.length && e.tp >= RELEVES[e.releves.length] * 3600 - 1e-6) {
          const th = RELEVES[e.releves.length];
          e.releves.push([th, e.dhFinal * (1 - Math.exp((-th * 3600) / e.tau)) * (1 + 0.02 * bruit(e.g, 30 + e.releves.length))]);
        }
      }
      if (p.type === "poinconnement") {
        e.sP = Math.min(10, e.tp * V_PISTON);
        while (e.lus.length < LECTURES.length && e.sP >= LECTURES[e.lus.length] - 1e-9) { const x = LECTURES[e.lus.length]; e.lus.push([x, e.F(x)]); }
      }
      if (e.tp >= p.duree - 1e-9) {
        e.k++; e.tp = 0;
        const suivant = e.prog[e.k];
        if (suivant?.type === "immersion") vit.accelerer(ACCELERE);
        if (p.type === "egouttage") vit.retablir();
        if (e.k >= e.prog.length) { e.fini = true; e.k = e.prog.length - 1; e.tp = p.duree; }
      }
    }
    return !e.fini;
  };

  const coupsFaits = () => {
    const p = pas();
    if (p.type !== "compactage") return 0;
    const tI = LEVEE + T_CHUTE;
    return e.tp < tI ? 0 : Math.min(56, Math.floor((e.tp - tI) / CADENCE + 1e-9) + 1);
  };
  const dhCourant = () => {
    const i = e.prog.findIndex((q) => q.type === "immersion");
    if (i < 0 || e.k < i) return 0;
    return e.k === i ? e.dhFinal * (1 - Math.exp(-e.tp / e.tau)) : e.releves.at(-1)?.[1] ?? 0;
  };
  const indexDe = (type) => e.prog.findIndex((q) => q.type === type);
  const passe = (type) => indexDe(type) >= 0 && (e.k > indexDe(type) || e.fini);

  // ── Dessin ──────────────────────────────────────────────────────────────
  function fond() {
    return svg({
      largeur: 640, hauteur: 346, titre: "Indice portant : moulage, immersion, poinçonnement", contenu: (id) => {
        e.id = id;
        let s = paillasse(YP);
        // Bac d'immersion.
        s += `<rect x="${X2 - 72}" y="${YP - 96}" width="144" height="96" rx="4" fill="#f8fafc" stroke="#475569" stroke-width="1.3"/>`;
        // Presse : bâti, traverse, socle et vérin du plateau.
        s += `<rect x="${X3 - 100}" y="40" width="12" height="${YP - 58}" fill="#94a3b8" stroke="#475569"/><rect x="${X3 + 88}" y="40" width="12" height="${YP - 58}" fill="#94a3b8" stroke="#475569"/>`;
        s += `<rect x="${X3 - 108}" y="30" width="216" height="18" rx="3" fill="#475569"/>`;
        s += `<rect x="${X3 - 112}" y="${YP - 20}" width="224" height="20" rx="3" fill="#64748b"/>`;
        s += `<g class="dyn"></g>`;
        s += legende(X1 - 10, YP + 33, "moulage au Proctor normal") + legende(X2, YP + 33, "bac d'immersion") + legende(X3, YP + 33, "presse CBR · 1,27 mm/min");
        s += texte(14, 20, `${MODES[e.mode].nom} · w = ${fd(e.w, 1)} %`, 'style="font-size:11px;font-weight:700;fill:#334155"');
        return s;
      },
    });
  }

  /** Éprouvette dans son moule (sans hausse), surcharges et accessoires, axe cx, embase à yBase. */
  function eprouvette(cx, yBase, { surcharges = false, plaque = false, dh = 0, enfonce = 0 } = {}) {
    const M = moule({ cx, yBase, k: K, D: 150, H: 120 }), fondS = fondSol(e.s.motif);
    const yS = M.yHaut - dh * K * 4; // gonflement exagéré ×4
    let s = M.fond + couche(e.id, { x: M.x0, y: yS, w: M.x1 - M.x0, h: M.yFond - yS, sol: e.s.motif });
    s += `<rect x="${r1(M.x0)}" y="${r1(yS)}" width="${r1(M.x1 - M.x0)}" height="${r1(M.yFond - yS)}" fill="${teinte(fondS, Math.max(0.6, 1.06 - 0.012 * e.w))}" opacity=".45"/>`;
    if (enfonce > 0) s += `<path d="M${r1(cx - 15)} ${r1(yS)}h30v${r1(enfonce)}h-30z" fill="#fff" opacity=".7"/>`;
    s += M.parois;
    const lP = 49.6 * K;
    if (plaque) s += `<rect x="${r1(M.x0 + 2)}" y="${r1(yS - 4)}" width="${r1(M.x1 - M.x0 - 4)}" height="4" fill="${ACIER}" stroke="${ACIER_SOMBRE}" stroke-width=".8"/>`;
    if (surcharges) for (const dy of [0, 6]) for (const sg of [-1, 1]) {
      const xa = sg < 0 ? M.x0 + 3 : cx + lP / 2 + 2, xb = sg < 0 ? cx - lP / 2 - 2 : M.x1 - 3;
      s += `<rect x="${r1(xa)}" y="${r1(yS - (plaque ? 4 : 0) - 6 - dy)}" width="${r1(xb - xa)}" height="5.5" rx="1" fill="#64748b" stroke="#1e293b" stroke-width=".7"/>`;
    }
    return { svg: s, yS, M };
  }

  function dessiner() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    const p = pas(), fondS = fondSol(e.s.motif), t = horloge();
    let s = "";
    const moulage = ["malaxage", "versement", "compactage", "arasement", "surcharges"].includes(p.type) && !e.fini;
    // Bac d'immersion : plein pendant l'immersion.
    const immerge = p.type === "immersion" && !e.fini;
    if (immerge || (p.type === "egouttage" && !e.fini)) {
      const niveau = immerge ? 1 : Math.max(0, 1 - e.tp / (DUREES.egouttage * 0.3));
      s += `<rect x="${X2 - 70}" y="${r1(YP - 2 - 84 * niveau)}" width="140" height="${r1(84 * niveau)}" fill="${EAU}" opacity=".45"/>`;
    }
    // Moulage : bol, moule et hausse, dame.
    if (moulage && p.type === "surcharges") s += eprouvette(X1, YP, { surcharges: true, plaque: e.mode === "immersion" }).svg;
    else if (moulage) {
      const M = moule({ cx: X1, yBase: YP, k: K, D: 150, H: 120, hausse: p.type === "arasement" ? 0 : 50 });
      let y = M.yFond;
      const hf = 42, hl = 60;
      const hs = p.type === "malaxage" ? [] : p.type === "versement" ? [...Array(p.j).fill(hf), hl * (e.tp / p.duree)] : p.type === "compactage" ? [...Array(p.j).fill(hf), hf + (hl - hf) * Math.exp((-4 * coupsFaits()) / 56)] : [hf, hf, 36]; // arasé à 120 mm
      s += M.fond;
      hs.forEach((h) => { const yh = y - h * K; s += couche(e.id, { x: M.x0, y: yh, w: M.x1 - M.x0, h: y - yh, sol: e.s.motif }) + ligne(M.x0, yh, M.x1, yh, teinte(fondS, 0.5), 0.8, 'stroke-dasharray="3 2"'); y = yh; });
      s += M.parois;
      if (p.type === "compactage") {
        const tc = instantCycle(e.tp, CADENCE, vit?.vitesse ?? 1), lev = tc < LEVEE ? 0.5 - 0.5 * Math.cos((Math.PI * tc) / LEVEE) : tc < LEVEE + T_CHUTE ? 1 - ((tc - LEVEE) / T_CHUTE) ** 2 : 0;
        const pos = [0, 0.8, -0.8, 0.4, -0.4, 1, -1][coupsFaits() % 7], xd = X1 + pos * ((150 - 50) / 2 * K - 6);
        s += dame({ cx: xd, yPied: y, k: K, hChute: 62, levee: lev });
      }
      // Bol de malaxage.
      s += `<path d="M18 ${YP - 26}H70L64 ${YP}H24Z" fill="#e2e8f0" stroke="#64748b"/>`;
      if (p.type === "malaxage") s += `<path d="M24 ${YP - 4}Q44 ${YP - 30} 64 ${YP - 4}Z" fill="${teinte(fondS, Math.max(0.6, 1.06 - 0.012 * e.w))}"/><path d="M${r1(44 + 14 * Math.sin(t * 5))} ${YP - 12}l16 -30" stroke="#78350f" stroke-width="3" stroke-linecap="round"/>`;
    }
    // Immersion : l'éprouvette sous surcharges, plaque de gonflement, trépied et comparateur.
    if (immerge || (p.type === "egouttage" && !e.fini)) {
      const dh = dhCourant(), ep = eprouvette(X2, YP - 4, { surcharges: true, plaque: true, dh });
      s += ep.svg;
      if (immerge) {
        s += `<path d="M${X2 - 60} ${r1(ep.M.yHaut - 1)}L${X2} ${r1(ep.M.yHaut - 58)}L${X2 + 60} ${r1(ep.M.yHaut - 1)}" fill="none" stroke="#475569" stroke-width="2"/>`;
        s += ligne(X2, ep.yS - 4, X2, ep.M.yHaut - 50, ACIER_SOMBRE, 2.4);
        s += comparateur(X2, ep.M.yHaut - 70, 15, dh, { libelle: `${fd(dh, 2)} mm` });
        for (let j = 0; j < 4; j++) { const q = (t * 0.7 + j / 4) % 1; s += `<circle cx="${r1(X2 - 40 + j * 26)}" cy="${r1(YP - 10 - 60 * q)}" r="1.6" fill="#fff" opacity="${r1(1 - q)}"/>`; }
      }
    }
    // Presse : plateau monté par le vérin, éprouvette, piston, anneau dynamométrique.
    const sousPresse = p.type === "presse" || p.type === "poinconnement" || e.fini;
    const sAff = p.type === "poinconnement" || e.fini ? e.sP : 0, Fcour = sAff > 0 ? e.F(sAff) : 0;
    const exag = 2, yPlateau = YP - 62 - sAff * K * exag;
    s += `<rect x="${X3 - 9}" y="${r1(yPlateau)}" width="18" height="${r1(YP - 20 - yPlateau)}" fill="${ACIER}" stroke="${ACIER_SOMBRE}"/>`;
    s += `<rect x="${X3 - 70}" y="${r1(yPlateau - 8)}" width="140" height="8" rx="2" fill="#475569" stroke="#1e293b"/>`;
    let yTete = yPlateau - 8 - (10 + 120) * K - 14; // haut de l'éprouvette quand elle est sous la presse
    if (sousPresse) {
      const ep = eprouvette(X3, yPlateau - 8, { surcharges: e.mode !== "ipi", dh: e.mode === "immersion" ? dhCourant() : 0, enfonce: sAff * K * exag });
      s += ep.svg; yTete = ep.yS;
    }
    // Anneau dynamométrique et piston (Ø 49,6 mm).
    const yAnneau = 92, lP = 49.6 * K, yPiston = sousPresse ? yTete + sAff * K * exag : yTete - 6;
    s += `<rect x="${X3 - 3}" y="48" width="6" height="${yAnneau - 48 - 22}" fill="${ACIER_SOMBRE}"/>`;
    s += `<ellipse cx="${X3}" cy="${yAnneau}" rx="30" ry="22" fill="none" stroke="#334155" stroke-width="5"/>`;
    s += comparateur(X3, yAnneau, 12, Fcour / 2);
    s += `<rect x="${X3 - 4}" y="${yAnneau + 22}" width="8" height="${r1(Math.max(0, yPiston - lP * 0.2 - yAnneau - 22))}" fill="${ACIER}" stroke="${ACIER_SOMBRE}"/>`;
    s += `<rect x="${r1(X3 - lP / 2)}" y="${r1(yPiston - lP * 0.6)}" width="${r1(lP)}" height="${r1(lP * 0.6)}" fill="${ACIER_SOMBRE}" stroke="#1e293b"/>`;
    // Légendes à gauche du bâti, reliées à l'organe.
    s += ligne(X3 - 98, yAnneau, X3 - 31, yAnneau, "#94a3b8", 0.9) + legende(X3 - 104, yAnneau + 4, "anneau de force", { ancre: "end", taille: 10 });
    s += ligne(X3 - 98, yPiston - 9, X3 - lP / 2 - 1, yPiston - 9, "#94a3b8", 0.9) + legende(X3 - 104, yPiston - 5, "piston 19,3 cm²", { ancre: "end", taille: 10 });
    // Écran de la presse.
    s += ecran(X3 - 92, YP - 18, 184, `F ${fd(Fcour, 2)} kN · s ${fd(sAff, 2)} mm`, { taille: 11.5, h: 16 });
    svgEl.querySelector(".dyn").innerHTML = s;
    const comp = p.type === "compactage" && !e.fini;
    c.lectures.innerHTML = lectures([
      ["Couche · coup", comp ? `${p.j + 1}/3 · ${coupsFaits()}/56` : p.type === "versement" && !e.fini ? `${p.j + 1}/3 · 0/56` : "—", ""],
      ["Gonflement", e.mode === "immersion" ? fd(dhCourant(), 2) : "—", "mm"],
      ["Enfoncement", fd(sAff, 2), "mm"],
      ["Force", fd(Fcour, 2), "kN"],
      ["Temps", duree(e.t), ""],
    ]) + `<p class="banc-etat">${e.fini ? "essai terminé" : PHASES[p.type] + (p.type === "versement" ? ` ${p.j + 1}` : "")}${vit?.force ? ` — le banc défile à ×${f(vit.force, 6)}` : ""}</p>`;
    loupe(...vueLoupe());
  }

  // ── Loupe : le piston poinçonne, le sol se tasse dessous et reflue autour ──
  const KL = 1.5, EX = 3, XC = 88, Y0 = 70, A = (49.6 / 2) * KL; // px/mm, exagération, axe, surface, rayon du piston
  function vueLoupe() {
    const p = pas(), fondS = fondSol(e.s.motif), t = horloge();
    const sP = p.type === "poinconnement" || e.fini ? e.sP : 0, sp = sP * KL * EX;
    const surch = e.mode !== "ipi" && (passe("surcharges") || p.type === "surcharges");
    const dh = e.mode === "immersion" ? dhCourant() : 0, gonf = dh * KL * EX * 4;
    // Le sol humide sans surcharge reflue autour du piston ; les surcharges le retiennent.
    const hv = surch ? 0.06 : e.w > e.s.wOPN + 1 ? 0.5 : e.w < e.s.wOPN - 1 ? 0.12 : 0.28;
    const ys = Y0 - gonf;
    const uz = (x, y) => {
      const r = Math.abs(x - XC), d = Math.max(0, y - ys);
      const sous = r <= A ? 1 : Math.exp(-(((r - A) / 7) ** 2));
      return sp * sous * Math.exp(-d / 60) - (r > A ? sp * hv * Math.exp(-(r - A) / 16) * Math.exp(-d / 18) : 0);
    };
    const ux = (x, y) => { const r = x - XC, d = Math.max(0, y - ys); return Math.sign(r) * sp * 0.25 * Math.exp(-(((Math.abs(r) - A) / 12) ** 2)) * Math.exp(-d / 30); };
    let s = `<rect width="${WL}" height="${HL}" fill="#f8fafc"/>`;
    if (e.mode === "immersion" && (p.type === "immersion" || p.type === "egouttage")) s += `<rect width="${WL}" height="${HL}" fill="${EAU}" opacity="${p.type === "immersion" ? 0.35 : 0.12}"/>`;
    // Surface déformée et éprouvette.
    let surf = "";
    for (let x = 0; x <= WL; x += 4) surf += `${x ? "L" : "M"}${x} ${r1(Math.abs(x - XC) <= A ? ys + sp : ys + uz(x, ys))}`;
    s += `<path d="${surf}L${WL} ${HL}L0 ${HL}Z" fill="${fondS}"/>`;
    s += `<clipPath id="ipi-sol"><path d="${surf}L${WL} ${HL}L0 ${HL}Z"/></clipPath><g clip-path="url(#ipi-sol)">`;
    s += blocSol(e.s.motif, { x0: -10, x1: WL + 10, y0: ys, y1: HL + 30, k: 700, deplacer: (x, y) => [x + ux(x, y), y + uz(x, y)], fond: false });
    if (e.mode === "immersion" && passe("surcharges")) s += `<rect x="0" y="${r1(ys)}" width="${WL}" height="${r1(Math.min(HL - ys, 40 * Math.min(1, dh / Math.max(e.dhFinal, 1e-6)) + (p.type === "immersion" ? 0 : 40)))}" fill="${BLEU}" opacity=".12"/>`;
    s += `</g><path d="${surf}" fill="none" stroke="${teinte(fondS, 0.45)}" stroke-width="1.4"/>`;
    // Plaque de gonflement (pendant l'immersion), surcharges annulaires de part et d'autre du piston.
    const plaque = e.mode === "immersion" && (p.type === "immersion" || p.type === "egouttage") && !e.fini, dp = plaque ? 6 : 0;
    if (plaque) s += `<rect x="0" y="${r1(ys - 6)}" width="${WL}" height="6" fill="${ACIER}" stroke="${ACIER_SOMBRE}" stroke-width=".8"/>`;
    if (surch) for (const sg of [-1, 1]) {
      const xa = sg < 0 ? 0 : XC + A + 3, xb = sg < 0 ? XC - A - 3 : WL;
      s += `<rect x="${r1(xa)}" y="${r1(ys - dp - 24)}" width="${r1(xb - xa)}" height="11" fill="#64748b" stroke="#1e293b" stroke-width=".8"/><rect x="${r1(xa)}" y="${r1(ys - dp - 12)}" width="${r1(xb - xa)}" height="11" fill="#64748b" stroke="#1e293b" stroke-width=".8"/>`;
    }
    // Piston.
    if (["presse", "poinconnement"].includes(p.type) || e.fini) {
      const yb = ys + sp - (p.type === "presse" && !e.fini ? 26 * (1 - e.tp / DUREES.presse) : 0);
      s += `<rect x="${r1(XC - A)}" y="0" width="${r1(2 * A)}" height="${r1(yb)}" fill="${ACIER}" stroke="${ACIER_SOMBRE}" stroke-width="1.2"/><rect x="${r1(XC - A + 5)}" y="0" width="6" height="${r1(yb)}" fill="#f1f5f9" opacity=".8"/>`;
      if (p.type === "poinconnement" && !e.fini) s += fleche(XC, 8, XC, 34, ROUGE, 2.6, 7) + etiquette(XC + 8, 22, `${fd(e.F(sP), 2)} kN`, { couleur: ROUGE });
    } else if (p.type === "immersion") s += fleche(XC, ys - 8, XC, ys - 30, BLEU, 2.2, 6);
    s += etiquette(WL - 6, HL - 9, sp > 0 ? `déplacements ×${EX}` : e.mode === "immersion" && dh > 0 ? `gonflement ×${EX * 4}` : "", { ancre: "end", couleur: "#475569" });
    const legendeTxt = e.fini ? `essai terminé : ${fd(e.sP, 1)} mm d'enfoncement`
      : p.type === "poinconnement" ? (hv >= 0.4 && sP > 1 ? `s = ${fd(sP, 2)} mm : sans surcharge, le sol humide reflue autour du piston` : surch ? `s = ${fd(sP, 2)} mm : les surcharges empêchent le sol de remonter` : `s = ${fd(sP, 2)} mm : le sol se tasse et se cisaille sous le piston`)
        : p.type === "immersion" ? `immersion : l'eau pénètre, le sol gonfle de ${fd(dh, 2)} mm` : p.type === "egouttage" ? "égouttage : l'éprouvette sort du bac"
          : p.type === "presse" ? "le piston vient au contact de l'éprouvette" : p.type === "surcharges" ? "pose des surcharges annulaires (2 × 2,27 kg)" : "moulage de l'éprouvette au Proctor normal";
    return [s, legendeTxt];
  }

  // ── Courbes ──────────────────────────────────────────────────────────────
  function dessinerLent() {
    const zF = c.courbes.querySelector(".dyn-force"), zI = c.courbes.querySelector(".dyn-ipi"), zG = c.courbes.querySelector(".dyn-gonfl");
    if (!zF) return;
    const cle = `${e.lus.length}|${r1(e.sP)}|${e.releves.length}|${e.fini}|${memoire.essais.length}`;
    if (cle === e.cleCourbes) return;
    e.cleCourbes = cle;
    // Force – enfoncement : enregistrement continu, lectures normalisées, repères à 2,5 et 5 mm.
    const r = e.resultat, Fmax = Math.max(e.F(10), 0.05);
    const cont = []; for (let x = 0; x <= e.sP + 1e-9; x += 0.1) cont.push([x, e.F(x)]);
    if (e.sP > 0) cont.push([e.sP, e.F(e.sP)]);
    const marques = [];
    if (r?.applicable) {
      if (r.decalage > 0.005) marques.push({ x: r.decalage, y: 0, couleur: COULEURS.violet, rayon: 4, libelle: `origine corrigée : ${fd(r.decalage, 2)} mm` });
      marques.push({ x: 2.5 + r.decalage, y: r.F25, couleur: r.retenu === "2,5 mm" ? COULEURS.effort : COULEURS.discret, guides: true, libelle: `${fd(r.F25, 2)} kN → ${f(r.i25, 2)} %` });
      marques.push({ x: 5 + r.decalage, y: r.F5, couleur: r.retenu === "5 mm" ? COULEURS.effort : COULEURS.discret, guides: true, libelle: `${fd(r.F5, 2)} kN → ${f(r.i5, 2)} %` });
    }
    zF.innerHTML = graphe({
      largeur: 560, hauteur: 250, xmin: 0, xmax: 10.5, ymin: 0, ymax: Fmax * 1.15, pasX: 1, xlabel: "enfoncement du piston (mm)", ylabel: "force (kN)",
      series: [
        { points: cont, couleur: COULEURS.encre, epaisseur: 2, libelle: "enregistrement" },
        { points: e.lus, couleur: COULEURS.bleu, nuage: true, rayon: 4, libelle: "" },
        ...(e.lus.length ? [{ points: [], couleur: COULEURS.bleu, libelle: "lectures normalisées (points)" }] : []),
      ],
      marques,
    });
    // IPI (et CBR) en fonction de w : les essais faits sur ce sol.
    const s = e.s, cl = classerCatalogue(s), cleT = cl.applicable && !cl.ins ? cleEtats(cl.sousClasse, cl.analyse.p2mm) : null;
    const ess = memoire.essais, iMax = Math.max(30, ...ess.map((x) => x.indice)) * 1.15;
    const zones = [];
    if (cleT) for (const l of ETATS_2024[cleT].lignes.filter((q) => q.IPI)) {
      const I = intervalle(l.IPI), a = Math.max(0, I.a), b2 = Math.min(iMax, I.b);
      zones.push({ x0: s.wOPN - 6, x1: s.wOPN + 8, y0: a, y1: b2, couleur: { th: "#dc2626", h: "#f59e0b", m: "#16a34a" }[l.etat] ?? "#94a3b8", opacite: 0.1, libelle: `${l.etat} : ${enClair(l.IPI, "IPI")}`, position: "droite" });
    }
    const serieMode = (m, couleur) => ({ points: ess.filter((x) => x.mode === m).map((x) => [x.w, x.indice]), couleur, nuage: true, rayon: 4.5 });
    const legendeMode = (m, couleur) => (ess.some((x) => x.mode === m) ? [{ points: [], couleur, libelle: MODES[m].court }] : []);
    zI.innerHTML = graphe({
      largeur: 560, hauteur: 240, xmin: s.wOPN - 6, xmax: s.wOPN + 8, ymin: 0, ymax: iMax, xlabel: "teneur en eau de moulage w (%)", ylabel: "indice (%)", zones,
      series: [
        { points: [[s.wOPN, 0], [s.wOPN, iMax]], couleur: COULEURS.gtr24, tirets: "6 4", epaisseur: 1.4, libelle: `wOPN = ${fd(s.wOPN, 1)} %` },
        { points: [[s.wn, 0], [s.wn, iMax]], couleur: COULEURS.gtr92, tirets: "2 3", epaisseur: 1.6, libelle: `wn = ${fd(s.wn, 1)} %` },
        serieMode("ipi", COULEURS.bleu), serieMode("cbr", COULEURS.violet), serieMode("immersion", COULEURS.effort),
        ...legendeMode("ipi", COULEURS.bleu), ...legendeMode("cbr", COULEURS.violet), ...legendeMode("immersion", COULEURS.effort),
      ],
    }) + (ess.length ? "" : '<p class="method-note">Les essais terminés sur ce sol se placent ici : refaites-en à d\'autres teneurs en eau pour tracer la courbe IPI – w ; les bandes colorées sont les états hydriques du GTR 2024 lus sur l\'IPI.</p>');
    // Gonflement pendant l'immersion.
    zG.innerHTML = e.mode === "immersion" && e.releves.length ? graphe({
      largeur: 560, hauteur: 200, xmin: 0, xmax: 96, ymin: 0, ymax: Math.max(0.1, gonflement({ dh: e.dhFinal }) * 1.25), pasX: 12,
      xlabel: "durée d'immersion (h)", ylabel: "gonflement (%)",
      series: [{ points: e.releves.map(([th, dh]) => [th, gonflement({ dh, h0: 120 })]), couleur: COULEURS.bleu, epaisseur: 2, marqueurs: true, libelle: "gonflement linéaire Δh/h0" }],
    }) : "";
  }

  function bilan() {
    const r = indicePortant([[0, 0], ...e.lus]);
    e.resultat = r;
    if (!r.applicable) { c.bilan.innerHTML = `<p class="final-result">${esc(r.motif)}</p>`; return; }
    memoire.essais.push({ w: e.w, mode: e.mode, indice: r.indice });
    const s = e.s, nom = MODES[e.mode].court, cl = classerCatalogue(s, e.mode === "ipi" && e.wCle === "wn" ? { IPI: r.indice } : {});
    const lecture = `F<sub>2,5</sub> = ${fd(r.F25, 2)} kN, soit ${f(r.i25, 2)} % de ${fd(REFERENCE_CBR[2.5], 2)} kN ; F<sub>5</sub> = ${fd(r.F5, 2)} kN, soit ${f(r.i5, 2)} % de ${f(REFERENCE_CBR[5], 3)} kN${r.decalage > 0.005 ? ` (origine corrigée de ${fd(r.decalage, 2)} mm)` : ""}`;
    let sens;
    if (e.mode === "ipi") {
      const cleT = cl.applicable && !cl.ins ? cleEtats(cl.sousClasse, cl.analyse.p2mm) : null;
      const h = cleT ? etatHydrique(cleT, { IPI: r.indice, w: e.w, wOPN: s.wOPN }) : null;
      sens = cl.ins ? `le sol est insensible à l'eau (${esc(cl.symbole)}) : le GTR 2024 ne lui donne pas d'état hydrique, l'IPI dit seulement s'il porte les engins`
        : h?.applicable ? `au GTR 2024, un ${esc(cl.sousClasse)} ${e.wCle === "wn" ? "en place" : `moulé à ${fd(e.w, 1)} %`} est à l'état <strong>${h.etat}</strong> (lu sur ${h.par === "IPI" ? "l'IPI" : "w/wOPN"}${h.discordance ? " ; les critères ne concordent pas tout à fait" : ""})${e.wCle === "wn" ? "" : " — c'est l'IPI à w<sub>n</sub> qui classe le sol en place"}`
          : "état hydrique indéterminé";
    } else if (e.mode === "cbr") {
      const ipi = memoire.essais.find((x) => x.mode === "ipi" && Math.abs(x.w - e.w) < 0.05);
      sens = `les surcharges retiennent le sol${ipi ? ` (IPI = ${f(ipi.indice, 2)} à la même teneur en eau)` : ""} ; le GTR 2024 lit l'état hydrique sur l'IPI, sans surcharge, qui traduit la traficabilité`;
    } else {
      const fr = cl.analyse.p63um, gonf = gonflement({ dh: e.releves.at(-1)?.[1] ?? 0, h0: 120 });
      if (cl.classeFraction === "S" || cl.classeFraction === "G") {
        const ins = insensible(cl.classeFraction, { p63um: fr, VBS: s.VBS, CBRi: r.indice });
        const parCBRi = ins.motif.includes("CBRi");
        sens = `gonflement ${fd(gonf, 2)} % ; ${ins.ins ? (parCBRi ? `CBRi > 20 : <strong>insensible à l'eau</strong> au GTR 2024 (${esc(ins.motif)})` : `<strong>insensible à l'eau</strong> au GTR 2024 par ses fines et sa VBS (${esc(ins.motif)}), sans recourir au CBRi`)
          : `${r.indice > 20 ? "CBRi > 20" : "CBRi ≤ 20"} : pas d'insensibilité à l'eau (${esc(ins.motif)})`}`;
      } else sens = `gonflement ${fd(gonf, 2)} % ; le critère CBRi > 20 ne vaut que pour les sables et les graves : un sol ${esc(cl.classeFraction ?? "")} reste sensible à l'eau`;
    }
    c.bilan.innerHTML = `<p class="final-result">${nom} = <strong>${f(r.indice, 2)}</strong> à w = ${fd(e.w, 1)} % (le plus grand des deux rapports, à ${r.retenu}) — ${sens}.
        <small>${lecture}. NF EN 13286-47 : piston de 19,3 cm² à 1,27 mm/min, éprouvette compactée au Proctor normal dans le moule CBR. Le calculateur du chapitre refait le dépouillement d'une courbe.</small></p>
      <div class="table-large"><table class="resultats"><thead><tr><th>enfoncement (mm)</th>${LECTURES.map((x) => `<th class="num">${String(x).replace(".", ",")}</th>`).join("")}</tr></thead>
      <tbody><tr><td>force (kN)</td>${e.lus.map(([, F]) => `<td class="n">${fd(F, 2)}</td>`).join("")}</tr></tbody></table></div>`;
    e.cleCourbes = ""; dessinerLent();
  }

  b = boucle({ avancer, dessiner, dessinerLent, surFin: bilan, surEtat: () => etatBoutons?.(), pasMax: Infinity });
  etatBoutons = brancherMarche(c, b, reinit);
  vit = regulateur(c, b);
  majOptionsW();
  c.q('[data-r="sol"]').addEventListener("change", majOptionsW);
  c.commandes.querySelectorAll("select").forEach((x) => x.addEventListener("change", () => { b.raz(); reinit(); etatBoutons(); }));
  reinit();
  etatBoutons();
}
