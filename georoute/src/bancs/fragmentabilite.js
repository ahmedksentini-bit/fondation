// Banc d'essai : fragmentabilité et dégradabilité des roches évolutives
// (chapitre 4). Fragmentabilité (NF EN 17542-2) : la fraction 10/20 mm de la
// roche, placée dans le moule CBR, reçoit 100 coups de dame Proctor normal
// (2,5 kg tombant de 305 mm) ; IFR = D10 avant / D10 après. Dégradabilité
// (NF EN 17542-1) : la même fraction subit quatre cycles d'immersion dans
// l'eau (8 h) et de séchage à l'étuve à 105 °C (16 h) ; IDGa = D10 avant /
// D10 après. Le D10 de l'échantillon décroît au fil des coups ou des cycles
// selon la loi géométrique de roches.js (d10Apres), jusqu'au coefficient de la
// roche du catalogue (materiaux.js) à une petite variabilité près ; la courbe
// granulométrique finale se construit tamis par tamis, et son D10 donne le
// coefficient. Les quatre jours de cycles défilent à ×10 000.
import { svg, texte, COULEURS, graphe } from "../figures.js";
import { ROCHES } from "./materiaux.js";
import { DAMES } from "../gtr/proctor.js";
import { fragmentabilite, degradabilite, d10Apres } from "../gtr/roches.js";
import { classerRoche, FAMILLES_ROCHES } from "../gtr/classification.js";
import { diametre } from "../gtr/granulo.js";
import { G } from "../gtr/outils.js";
import { charpente, boucle, brancherMarche, lectures, f, fd, r1, esc, duree } from "./moteur.js";
import { fenetreLoupe, teinte, choc, etiquette, horloge, W as WL, H as HL, ROUGE, BLEU, EAU, ACIER_SOMBRE } from "./loupe.js";
import { choix, graine, bruit, regulateur, instantCycle, paillasse, ecran, granulat, dame, moule, etuve, legende, assouplir } from "./labo-dessin.js";

const ROCHES_FR = ["marne", "schiste", "craie", "calcaireTendre", "gres", "calcaireDur"];
const TAMIS_FR = [0.063, 0.125, 0.25, 0.5, 1, 2, 4, 6.3, 8, 10, 12.5, 14, 16, 20, 25]; // mm
// Fraction 10/20 mm préparée : un peu de sous-calibre, D10 ≈ 10,5 mm.
const AVANT = [0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.7, 1, 1.6, 4, 30, 47, 66, 98, 100];
const NCOUPS = 100, CADENCE = 2.4, LEVEE = 1.5, T_CHUTE = Math.sqrt((2 * DAMES.normal.chute) / 9.81);
const DUREES = { preparation: 60, demoulage: 45, immersion: 8 * 3600, sechage: 16 * 3600, vibration: 60, pesee: 8 };
const ACCELERE = 10000;
const YP = 300, XM = 150; // paillasse ; axe du moule ou du bac
// Teneur en eau atteinte en immersion (%) : elle dit combien la roche boit d'eau à chaque cycle.
const ABSORPTION = { marne: 13, schiste: 6, craie: 24, calcaireTendre: 14, gres: 8, calcaireDur: 1.5 };
const ESSAIS = {
  frag: { nom: "fragmentabilité (IFR) : 100 coups de dame", coef: "IFR", norme: "NF EN 17542-2" },
  degrad: { nom: "dégradabilité (IDGa) : 4 cycles eau / étuve", coef: "IDGa", norme: "NF EN 17542-1" },
};
const PHASES = { preparation: "préparation de la fraction 10/20 mm", compactage: "compactage : 100 coups de dame Proctor normal", demoulage: "démoulage", immersion: "immersion dans l'eau (8 h)", sechage: "séchage à l'étuve à 105 °C (16 h)", vibration: "tamisage : la colonne vibre", pesee: "pesée des refus, tamis par tamis" };

/**
 * Courbe granulométrique après l'essai : loi en puissance du logarithme de
 * l'ouverture, réglée pour que son D10 (lu comme au laboratoire, par
 * interpolation entre tamis) soit celui visé ; jamais plus grossière qu'avant.
 */
function courbeApres(D10vise) {
  const dmin = 0.02, loi = (q) => TAMIS_FR.map((d, i) => [d, Math.min(100, Math.max(AVANT[i], 100 * Math.max(0, Math.log(d / dmin) / Math.log(20 / dmin)) ** q))]);
  let a = 0.3, b = 80;
  for (let k = 0; k < 70; k++) { const m = Math.sqrt(a * b); if (diametre(loi(m), 10) > D10vise) b = m; else a = m; }
  return loi(Math.sqrt(a * b));
}

export function monter(banc) {
  const c = charpente(banc, {
    vitesse: 20, vitesses: [1, 10, 20, 100],
    commandes: choix("Essai", "essai", Object.entries(ESSAIS).map(([k, x]) => [k, x.nom]))
      + choix("Roche", "roche", ROCHES_FR.map((k) => [k, `${ROCHES[k].nom} (${ROCHES[k].famille})`]))
      + '<p class="method-note banc-note" style="grid-column:1/-1;margin:0"></p>',
  });
  const loupe = fenetreLoupe(c, "un fragment de roche", { echelle: { px: 30, libelle: "1 cm" } });
  assouplir(c);
  let e, b, etatBoutons, vit;

  const reinit = () => {
    const essai = c.q('[data-r="essai"]').value, cle = c.q('[data-r="roche"]').value, r = ROCHES[cle], g = graine(cle + essai);
    const avant = TAMIS_FR.map((d, i) => [d, AVANT[i]]), D10avant = diametre(avant, 10);
    const C = (essai === "frag" ? r.IFR : r.IDGa) * (1 + 0.03 * bruit(g, 1)); // coefficient que la mesure va donner
    const apres = courbeApres(D10avant / C);
    const prog = [{ type: "preparation", duree: DUREES.preparation }];
    if (essai === "frag") prog.push({ type: "compactage", duree: NCOUPS * CADENCE }, { type: "demoulage", duree: DUREES.demoulage });
    else for (let k = 0; k < 4; k++) prog.push({ type: "immersion", cycle: k, duree: DUREES.immersion }, { type: "sechage", cycle: k, duree: DUREES.sechage });
    prog.push({ type: "vibration", duree: DUREES.vibration });
    for (let i = TAMIS_FR.length - 1; i >= 0; i--) prog.push({ type: "pesee", tamis: i, duree: DUREES.pesee });
    e = { essai, cle, r, g, avant, apres, D10avant, C, prog, k: 0, tp: 0, t: 0, fini: false, faits: 0, cleCourbe: "" };
    c.q(".banc-note").innerHTML = `${esc(r.nom)}, famille ${r.famille} du GTR 2024 (${esc(FAMILLES_ROCHES[r.famille])}). ${essai === "frag"
      ? "La fraction 10/20 mm est placée dans le moule CBR et reçoit 100 coups de dame Proctor normal (2,5 kg, 305 mm)."
      : "La fraction 10/20 mm, dans un panier grillagé, passe quatre fois de l'eau (8 h) à l'étuve à 105 °C (16 h)."} On compare ses courbes granulométriques avant et après.`;
    vit?.retablir();
    c.scene.innerHTML = fond();
    c.courbes.innerHTML = '<div class="dyn-courbe"></div>';
    c.bilan.innerHTML = "";
    dessiner(); dessinerLent();
  };

  const pas = () => e.prog[Math.min(e.k, e.prog.length - 1)];
  const avancer = (dt) => {
    if (e.fini) return false;
    let reste = dt;
    while (reste > 1e-9 && !e.fini) {
      const p = e.prog[e.k], h = Math.min(reste, p.duree - e.tp);
      e.tp += h; e.t += h; reste -= h;
      if (e.tp >= p.duree - 1e-9) {
        if (p.type === "pesee") e.faits++;
        e.k++; e.tp = 0;
        const s2 = e.prog[e.k];
        if (s2?.type === "immersion" && s2.cycle === 0) vit.accelerer(ACCELERE);
        if (s2?.type === "vibration") vit.retablir();
        if (e.k >= e.prog.length) { e.fini = true; e.k = e.prog.length - 1; e.tp = p.duree; }
      }
    }
    return !e.fini;
  };

  /** Avancement de l'action destructrice : coups portés (sur 100), ou cycles d'immersion faits (sur 4, l'eau délitant la roche). */
  const avancement = () => {
    const p = pas();
    if (e.essai === "frag") {
      if (p.type === "preparation") return { n: 0, N: NCOUPS };
      if (p.type !== "compactage" || e.fini) return { n: NCOUPS, N: NCOUPS };
      const tI = LEVEE + T_CHUTE;
      return { n: e.tp < tI ? 0 : Math.min(NCOUPS, Math.floor((e.tp - tI) / CADENCE + 1e-9) + 1), N: NCOUPS };
    }
    if (p.type === "immersion") return { n: p.cycle + Math.min(1, e.tp / (DUREES.immersion * 0.6)), N: 4 };
    if (p.type === "sechage") return { n: p.cycle + 1, N: 4 };
    return { n: p.type === "preparation" ? 0 : 4, N: 4 };
  };
  /** D10 de l'échantillon à l'instant (solveur d10Apres) et niveau de fragmentation pour le dessin (0 à 1). */
  const etatEchantillon = () => {
    const { n, N } = avancement(), D10 = d10Apres({ D10avant: e.D10avant, coefficient: e.C, n, nTotal: N });
    return { n, N, D10, niveau: Math.min(1, Math.log(e.D10avant / D10) / Math.log(16)) };
  };
  /** Teneur en eau de l'échantillon pendant les cycles : il boit dans l'eau, sèche à l'étuve. */
  const teneurEau = () => {
    const p = pas(), wa = ABSORPTION[e.cle];
    if (p.type === "immersion") return wa * (1 - Math.exp(-e.tp / 3600));
    if (p.type === "sechage") return wa * (1 - Math.exp(-DUREES.immersion / 3600)) * Math.exp(-e.tp / 5400);
    return 0;
  };

  // ── Dessin ──────────────────────────────────────────────────────────────
  function fond() {
    return svg({
      largeur: 640, hauteur: 340, titre: e.essai === "frag" ? "Essai de fragmentabilité" : "Essai de dégradabilité", contenu: () => {
        let s = paillasse(YP);
        s += `<g class="dyn"></g>`;
        s += texte(14, 20, e.essai === "frag" ? "Fragmentabilité · fraction 10/20 mm · 100 coups de dame Proctor normal dans le moule CBR" : "Dégradabilité · fraction 10/20 mm · 4 cycles : 8 h dans l'eau, 16 h à l'étuve à 105 °C", 'style="font-size:11px;font-weight:700;fill:#334155"');
        s += e.essai === "frag" ? legende(XM, YP + 33, "moule CBR Ø 150 mm") : legende(105, YP + 33, "bac d'immersion") + legende(258, YP + 33, "étuve 105 °C");
        s += legende(470, YP + 33, "colonne de tamis, de 25 à 0,063 mm");
        return s;
      },
    });
  }

  /**
   * Fragments de la prise d'essai dans un contenant (x0 à x1, fond à yF, sur la
   * hauteur h) : chacun se brise quand le niveau de fragmentation dépasse son
   * seuil ; les fines s'accumulent au fond.
   */
  function fragments(x0, x1, yF, h, niveau, { rFrag = 9, jeu = 0 } = {}) {
    const coul = e.r.couleur, n = Math.max(4, Math.floor((x1 - x0) / (2.2 * rFrag)));
    const hF = 2 + 14 * niveau * niveau;
    let s = niveau > 0.02 ? `<rect x="${r1(x0)}" y="${r1(yF - hF)}" width="${r1(x1 - x0)}" height="${r1(hF)}" fill="${teinte(coul, 0.82)}"/>` : "";
    const rangs = Math.max(2, Math.round((h - hF) / (1.7 * rFrag)));
    for (let j = 0; j < rangs; j++) for (let i = 0; i < n; i++) {
      const id = j * 13 + i, seuil = 0.06 + 0.85 * ((id * 0.618034) % 1);
      const cx = x0 + rFrag + 2 + i * ((x1 - x0 - 2 * rFrag - 4) / Math.max(1, n - 1)) + (j % 2 ? rFrag * 0.5 : 0) * (i < n - 1 ? 1 : 0);
      const cy = yF - hF - rFrag - j * 1.65 * rFrag * (1 - 0.25 * niveau) + jeu * Math.sin(id);
      if (cx > x1 - rFrag * 0.6) continue;
      if (niveau < seuil) s += granulat(cx, cy, rFrag, e.g + id, { couleur: coul, rot: id });
      else {
        // Fragment brisé : deux ou trois morceaux, puis des miettes.
        const parts = niveau > seuil + 0.3 ? 3 : 2;
        for (let m = 0; m < parts; m++) { const a = (2 * Math.PI * m) / parts + id; s += granulat(cx + 0.45 * rFrag * Math.cos(a), cy + 0.35 * rFrag * Math.sin(a), rFrag * (parts === 2 ? 0.62 : 0.5), e.g + 300 + id * 3 + m, { couleur: coul, rot: a }); }
      }
    }
    return s;
  }

  /** Colonne de tamis (de 25 à 0,063 mm) et écran du passant ; tamis i surligné pendant sa pesée. */
  function colonne(x0, yBas, { vibre = 0, actif = -1 } = {}) {
    const n = TAMIS_FR.length, hT = 11, l = 96;
    let s = `<g transform="translate(${r1(vibre)} 0)">`;
    s += `<rect x="${x0 - 4}" y="${yBas - 10}" width="${l + 8}" height="10" rx="2" fill="#475569"/>`; // fond (bac de récupération) et base vibrante
    s += `<rect x="${x0}" y="${yBas - 18}" width="${l}" height="8" fill="#e2e8f0" stroke="#64748b"/>`;
    for (let i = 0; i < n; i++) {
      const y = yBas - 18 - (i + 1) * hT, actifI = i === actif;
      s += `<rect x="${x0}" y="${y}" width="${l}" height="${hT}" fill="${actifI ? "#fef3c7" : "#f8fafc"}" stroke="${actifI ? "#d97706" : "#64748b"}" stroke-width="${actifI ? 1.8 : 1}"/>`;
      s += `<path d="M${x0 + 2} ${y + hT - 2.5}h${l - 4}" stroke="#94a3b8" stroke-width="1.6" stroke-dasharray="1.6 1.4"/>`;
      if ([0, 5, 9, 14].includes(i)) s += `<text x="${x0 - 6}" y="${y + hT - 1.5}" text-anchor="end" style="font-size:10px;font-weight:700;fill:#475569">${String(TAMIS_FR[i]).replace(".", ",")} mm</text>`;
    }
    s += `<rect x="${x0 - 2}" y="${yBas - 18 - n * hT - 8}" width="${l + 4}" height="8" rx="2" fill="#64748b"/>`; // couvercle
    return s + "</g>";
  }

  function dessiner() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    const p = pas(), t = horloge(), ech = etatEchantillon(), coul = e.r.couleur;
    let s = "";
    const tamisage = p.type === "vibration" || p.type === "pesee" || e.fini;
    if (e.essai === "frag") {
      const K = 0.8, M = moule({ cx: XM, yBase: YP, k: K, D: 150, H: 120 });
      s += M.fond;
      if (!tamisage && !(p.type === "demoulage" && e.tp > DUREES.demoulage * 0.6)) {
        const hE = 62 * (1 - 0.12 * ech.niveau);
        s += fragments(M.x0 + 1, M.x1 - 1, M.yFond, hE, ech.niveau);
        if (p.type === "compactage" && !e.fini) {
          const tc = instantCycle(e.tp, CADENCE, vit?.vitesse ?? 1), lev = tc < LEVEE ? 0.5 - 0.5 * Math.cos((Math.PI * tc) / LEVEE) : tc < LEVEE + T_CHUTE ? 1 - ((tc - LEVEE) / T_CHUTE) ** 2 : 0;
          const xd = XM + [0, 0.8, -0.8, 0.4, -0.4, 1, -1][ech.n % 7] * ((150 - 50) / 2 * K - 6);
          s += dame({ cx: xd, yPied: M.yFond - hE - 4, k: K, hChute: 61, levee: lev });
          if (tc >= LEVEE + T_CHUTE && tc < LEVEE + T_CHUTE + 0.22) s += `<path d="M${r1(xd - 26)} ${r1(M.yFond - hE - 6)}l-8 -4M${r1(xd + 26)} ${r1(M.yFond - hE - 6)}l8 -4" stroke="${ROUGE}" stroke-width="2"/>`;
        }
      }
      s += M.parois;
      if (p.type !== "compactage" || e.fini) s += dame({ cx: XM + 128, yPied: YP, k: K, hChute: 61, levee: 0 }) + legende(XM + 128, YP + 33, "dame");
    } else {
      // Bac d'immersion et étuve ; le panier passe de l'un à l'autre à chaque demi-cycle.
      const dansEau = p.type === "immersion" && !e.fini, dansEtuve = p.type === "sechage" && !e.fini;
      s += `<rect x="40" y="${YP - 92}" width="130" height="92" rx="4" fill="#f8fafc" stroke="#475569" stroke-width="1.3"/><rect x="42" y="${YP - 76}" width="126" height="74" fill="${EAU}" opacity=".45"/>`;
      if (ech.niveau > 0.05) s += `<rect x="42" y="${r1(YP - 2 - 10 * ech.niveau)}" width="126" height="${r1(10 * ech.niveau)}" fill="${teinte(coul, 0.7)}" opacity=".8"/>`;
      const panier = (cx, yB) => {
        let q = `<rect x="${cx - 48}" y="${yB - 40}" width="96" height="40" fill="none" stroke="#475569" stroke-width="1.4" stroke-dasharray="3 2"/>`;
        q += fragments(cx - 46, cx + 46, yB - 1, 36, ech.niveau, { rFrag: 7.5 });
        return q + `<path d="M${cx - 48} ${yB - 40}Q${cx} ${yB - 58} ${cx + 48} ${yB - 40}" fill="none" stroke="#475569" stroke-width="1.6"/>`;
      };
      s += etuve(196, YP, { l: 124, h: 136, consigne: 105, chauffe: dansEtuve, contenu: dansEtuve ? panier(258, YP - 31) : "" });
      if (dansEau) {
        s += panier(105, YP - 8);
        for (let j = 0; j < 5; j++) { const q = (t * 0.9 + j / 5) % 1; s += `<circle cx="${r1(70 + j * 17)}" cy="${r1(YP - 20 - 54 * q)}" r="${r1(1.4 + 0.8 * Math.min(1, e.r.IDGa / 20))}" fill="#fff" opacity="${r1(1 - q)}"/>`; }
      } else if (!dansEtuve && !tamisage) s += panier(105, YP - 96);
      if (dansEtuve) for (let j = 0; j < 4; j++) { const q = (t * 0.8 + j / 4) % 1; s += `<path d="M${r1(218 + j * 26)} ${r1(YP - 92 - 6 * q)}q4 -4 0 -8" stroke="#f97316" stroke-width="1.3" fill="none" opacity="${r1(0.8 * (1 - q))}"/>`; }
    }
    // Colonne de tamis et écran : pendant la pesée, le passant au tamis en cours.
    const actif = p.type === "pesee" && !e.fini ? p.tamis : -1;
    s += colonne(410, YP, { vibre: p.type === "vibration" && !e.fini ? 1.8 * Math.sin(t * 40) : 0, actif });
    if (tamisage && (p.type !== "vibration" || e.fini)) {
      const iT = e.fini ? 0 : p.tamis, pas2 = e.apres[iT];
      s += ecran(526, YP - 64, 104, `${String(TAMIS_FR[iT]).replace(".", ",")} mm`, { taille: 11.5, h: 18 }) + ecran(526, YP - 42, 104, `${fd(pas2[1], 1)} %`, { taille: 11.5, h: 18 });
      s += legende(578, YP - 70, "passant au tamis", { taille: 10 });
    }
    svgEl.querySelector(".dyn").innerHTML = s;
    const D10mes = e.fini || (tamisage && e.faits >= TAMIS_FR.length) ? diametre(e.apres, 10) : NaN;
    const iT = p.type === "pesee" && !e.fini ? p.tamis : -1;
    c.lectures.innerHTML = lectures([
      e.essai === "frag" ? ["Coup", `${ech.n} / ${NCOUPS}`, ""] : ["Cycle", p.type === "immersion" || p.type === "sechage" ? `${p.cycle + 1} / 4 · ${p.type === "immersion" ? "eau" : "étuve"}` : ech.n >= 4 ? "4 / 4" : "—", ""],
      e.essai === "frag" ? ["Énergie cumulée", fd((ech.n * DAMES.normal.masse * G * DAMES.normal.chute) / 1000, 2), "kJ"] : ["Teneur en eau", fd(teneurEau(), 1), "%"],
      ["Tamis pesé", iT >= 0 ? `${String(TAMIS_FR[iT]).replace(".", ",")} mm` : "—", ""],
      ["Passant", iT >= 0 ? fd(e.apres[iT][1], 1) : "—", "%"],
      ["D10 après", Number.isFinite(D10mes) ? fd(D10mes, 2) : "—", "mm"],
    ]) + `<p class="banc-etat">${e.fini ? "essai terminé" : PHASES[p.type]}${vit?.force ? ` — le banc défile à ×${f(vit.force, 6)}` : ""}</p>`;
    loupe(...vueLoupe());
  }

  // ── Loupe : un fragment se fend sous la dame, ou se délite dans l'eau ─────
  const XC = 88, YC = 92, RF = 34; // centre et rayon du fragment observé (3 px/mm)
  function vueLoupe() {
    const p = pas(), t = horloge(), ech = etatEchantillon(), L = ech.niveau, coul = e.r.couleur;
    let s = "", leg = "";
    const morceaux = L < 0.15 ? 1 : L < 0.4 ? 2 : L < 0.7 ? 3 : 5, fissure = L >= 0.06 && L < 0.15;
    const dessinerFragment = (dy = 0, ecart = 0) => {
      if (morceaux === 1) {
        let q = granulat(XC, YC + dy, RF, e.g + 900, { couleur: coul, n: 8, aplati: 0.8 });
        if (fissure) q += `<path d="M${XC - 18} ${YC - 20 + dy}l10 14l-4 10l12 18" fill="none" stroke="${teinte(coul, 0.4)}" stroke-width="1.6"/>`;
        return q;
      }
      let q = "";
      for (let m = 0; m < morceaux; m++) {
        const a = (2 * Math.PI * m) / morceaux + 0.6, d = (morceaux === 2 ? 10 : 15) + ecart;
        q += granulat(XC + d * Math.cos(a), YC + dy + d * 0.75 * Math.sin(a), RF * (morceaux === 2 ? 0.66 : morceaux === 3 ? 0.52 : 0.4), e.g + 910 + m, { couleur: coul, rot: a, n: 6 });
      }
      return q;
    };
    if (e.essai === "frag") {
      s += `<rect width="${WL}" height="${HL}" fill="#f8fafc"/><rect x="0" y="${HL - 18}" width="${WL}" height="18" fill="${ACIER_SOMBRE}"/>`;
      if (L > 0.05) s += `<rect x="0" y="${r1(HL - 18 - 12 * L)}" width="${WL}" height="${r1(12 * L)}" fill="${teinte(coul, 0.8)}"/>`;
      for (let i = 0; i < 5; i++) if (i !== 2) s += granulat(14 + i * 37, HL - 18 - 12 * L - 14, 15 * (1 - 0.3 * L), e.g + 950 + i, { couleur: coul, rot: i });
      const comp = p.type === "compactage" && !e.fini;
      const tc = comp ? instantCycle(e.tp, CADENCE, vit?.vitesse ?? 1) : 0, tI = LEVEE + T_CHUTE;
      const lev = !comp ? 1 : tc < LEVEE ? 0.5 - 0.5 * Math.cos((Math.PI * tc) / LEVEE) : tc < tI ? 1 - ((tc - LEVEE) / T_CHUTE) ** 2 : 0;
      const frappe = comp && tc >= tI && tc < tI + 0.25;
      s += dessinerFragment(16, frappe ? 3 : 0);
      // Face de la dame (Ø 50 mm, plus large que la vue) : elle frappe le haut du fragment.
      const yFace = YC + 16 - RF * 0.8 - lev * 110;
      s += `<rect x="0" y="${r1(yFace - 40)}" width="${WL}" height="40" fill="#475569" stroke="#1e293b"/>`;
      if (frappe) s += choc(XC, YC + 16 - RF * 0.6, RF * 0.7);
      leg = p.type === "preparation" ? "fragment de la fraction 10/20 mm, intact" : comp ? (frappe ? `coup ${ech.n} : ${morceaux === 1 ? (fissure ? "une fissure s'ouvre" : "le fragment encaisse") : "le fragment se fend en morceaux"}` : `coup ${ech.n}/${NCOUPS} : la dame remonte`)
        : `après 100 coups : ${morceaux === 1 ? "le fragment a résisté" : `${morceaux} morceaux et des miettes`}`;
    } else {
      const dansEau = p.type === "immersion" && !e.fini, dansEtuve = p.type === "sechage" && !e.fini;
      s += `<rect width="${WL}" height="${HL}" fill="${dansEau ? EAU : dansEtuve ? "#ffedd5" : "#f8fafc"}" opacity="${dansEau ? 0.55 : 1}"/>`;
      if (dansEau) s += `<rect width="${WL}" height="${HL}" fill="#f8fafc" opacity=".35"/>`;
      // Boue de délitage au fond, puis le fragment.
      if (L > 0.03) s += `<path d="M0 ${HL}V${r1(HL - 6 - 18 * L)}Q${XC} ${r1(HL - 14 - 26 * L)} ${WL} ${r1(HL - 6 - 18 * L)}V${HL}Z" fill="${teinte(coul, 0.72)}"/>`;
      s += dessinerFragment(4, dansEau ? 2 * Math.sin(t) : 0);
      if (dansEau) {
        // L'air chassé des fissures remonte en bulles ; des écailles se détachent et tombent.
        const vif = Math.min(1, e.r.IDGa / 15);
        for (let j = 0; j < 8; j++) { const q = (t * 0.7 + j / 8) % 1; s += `<circle cx="${r1(XC - 26 + ((j * 17) % 52))}" cy="${r1(YC - RF * 0.6 - 70 * q)}" r="${r1(1.2 + 1.4 * vif)}" fill="#fff" stroke="${BLEU}" stroke-width=".5" opacity="${r1(1 - q)}"/>`; }
        if (vif > 0.15) for (let j = 0; j < 6; j++) { const q = (t * 0.5 + j / 6) % 1; s += `<path d="M${r1(XC - 30 + ((j * 23) % 60))} ${r1(YC + 10 + (HL - YC - 30) * q)}l4 1l-1 3l-4 -1z" fill="${teinte(coul, 0.6)}" opacity="${r1(0.9 * vif)}"/>`; }
      }
      if (dansEtuve) {
        // À l'étuve, la roche argileuse se rétracte : des fentes de dessiccation s'ouvrent.
        const nf = Math.round(2 + 6 * Math.min(1, e.r.IDGa / 20));
        for (let j = 0; j < nf; j++) { const a = j * 1.7; s += `<path d="M${r1(XC + 6 * Math.cos(a))} ${r1(YC + 4 + 6 * Math.sin(a))}l${r1(14 * Math.cos(a + 0.4))} ${r1(12 * Math.sin(a + 0.4))}l${r1(8 * Math.cos(a - 0.3))} ${r1(8 * Math.sin(a - 0.3))}" fill="none" stroke="${teinte(coul, 0.35)}" stroke-width="1.3"/>`; }
        for (let j = 0; j < 3; j++) { const q = (t * 0.8 + j / 3) % 1; s += `<path d="M${r1(40 + j * 48)} ${r1(40 - 20 * q)}q4 -4 0 -8t0 -8" stroke="#f97316" stroke-width="1.3" fill="none" opacity="${r1(0.8 * (1 - q))}"/>`; }
      }
      leg = p.type === "preparation" ? "fragment de la fraction 10/20 mm, sec" : dansEau ? `cycle ${p.cycle + 1} : dans l'eau, ${e.r.IDGa > 5 ? "l'argile gonfle, la roche se délite" : "la roche boit un peu d'eau, sans se défaire"}`
        : dansEtuve ? `cycle ${p.cycle + 1} : à 105 °C, ${e.r.IDGa > 5 ? "la roche se rétracte et se fissure" : "la roche sèche, intacte"}` : `après 4 cycles : ${morceaux === 1 ? "le fragment a tenu" : `${morceaux} morceaux et de la boue`}`;
    }
    return [s + etiquette(WL - 6, 14, e.essai === "frag" ? `coup ${ech.n}/${NCOUPS}` : `cycle ${Math.min(4, Math.floor(ech.n) + (pas().type === "sechage" ? 0 : 1))}/4`, { ancre: "end" }), leg];
  }

  // ── Courbes granulométriques avant et après ──────────────────────────────
  function dessinerLent() {
    const zone = c.courbes.querySelector(".dyn-courbe");
    if (!zone) return;
    const cle = `${e.faits}|${e.fini}`;
    if (cle === e.cleCourbe) return;
    e.cleCourbe = cle;
    // Les refus pesés du plus gros tamis au plus fin donnent la courbe « après » de haut en bas.
    const faits = e.apres.slice(TAMIS_FR.length - e.faits);
    const series = [
      { points: e.avant, couleur: COULEURS.bleu, epaisseur: 2.2, marqueurs: true, libelle: "avant l'essai (fraction 10/20 mm)" },
      ...(faits.length ? [{ points: faits, couleur: COULEURS.effort, epaisseur: 2.2, marqueurs: true, libelle: `après ${e.essai === "frag" ? "100 coups de dame" : "4 cycles eau / étuve"}` }] : []),
    ];
    const marques = [{ x: e.D10avant, y: 10, couleur: COULEURS.bleu, guides: true, libelle: `D10 avant = ${fd(e.D10avant, 1)} mm` }];
    const D10ap = faits.length && faits[0][1] <= 10 ? diametre(e.apres, 10) : NaN;
    if (Number.isFinite(D10ap)) marques.push({ x: D10ap, y: 10, couleur: COULEURS.effort, guides: true, libelle: `D10 après = ${fd(D10ap, D10ap < 1 ? 2 : 1)} mm` });
    zone.innerHTML = graphe({ largeur: 560, hauteur: 260, xmin: 0.05, xmax: 40, logX: true, ymin: 0, ymax: 100, pasY: 20, xlabel: "ouverture des tamis (mm, échelle logarithmique)", ylabel: "passant (%)", series, marques });
  }

  function bilan() {
    const r = e.r, D10ap = diametre(e.apres, 10);
    const coef = e.essai === "frag" ? fragmentabilite({ D10avant: e.D10avant, D10apres: D10ap }) : degradabilite({ D10avant: e.D10avant, D10apres: D10ap });
    const cl = classerRoche(r.famille, e.essai === "frag" ? { ...r, IFR: coef } : { ...r, IDGa: coef });
    const nomC = ESSAIS[e.essai].coef, classe = `<strong>${esc(cl.sousClasse ?? "—")}</strong> (${esc(cl.nom ?? cl.motif ?? "")})`;
    const sens = e.essai === "frag"
      ? (coef > 7 ? "IFR > 7 : roche <strong>fragmentable</strong>, elle se broie sous les engins" : "IFR ≤ 7 : roche peu fragmentable au pilonnage")
      : coef > 20 ? "IDGa > 20 : roche <strong>très dégradable</strong>" : coef > 5 ? "5 < IDGa ≤ 20 : roche <strong>moyennement dégradable</strong>" : "IDGa ≤ 5 : roche peu dégradable, l'eau ne la délite pas";
    let gtr;
    if (r.famille === "CH") gtr = `le GTR 2024 classe les craies par leur masse volumique sèche et leur teneur en eau : ${classe}`;
    else if (r.famille === "Li") gtr = `le GTR 2024 classe les calcaires par leur MDE et leur masse volumique sèche : ${classe}`;
    else if (/^R5/.test(cl.sousClasse ?? "")) gtr = `classe ${classe}${e.essai === "degrad" ? `, car elle est d'abord fragmentable (IFR = ${f(r.IFR, 2)} > 7)` : ""} : après extraction, elle se comporte comme un sol, que l'on classe et emploie selon l'état hydrique de sa fraction 0/63 mm`;
    else if (/d[12]?$/.test(cl.sousClasse ?? "")) gtr = `classe ${classe} : elle continuera d'évoluer dans le remblai sous l'eau ; plus elle sera fragmentée à la mise en œuvre, moins elle évoluera ensuite`;
    else gtr = `classe ${classe} : elle garde sa structure de blocs dans l'ouvrage`;
    c.bilan.innerHTML = `<p class="final-result">${nomC} = D10 avant / D10 après = ${fd(e.D10avant, 1)}/${fd(D10ap, D10ap < 1 ? 2 : 1)} = <strong>${f(coef, 2)}</strong> — ${sens} ; ${gtr}.
        <small>${ESSAIS[e.essai].norme} ; seuils du GTR 2024 : IFR 7, IDGa 5 et 20. Le classement prend les autres paramètres de la roche dans le catalogue (${e.essai === "frag" ? `IDGa = ${f(r.IDGa, 2)}` : `IFR = ${f(r.IFR, 2)}`}${Number.isFinite(r.MDE) ? `, MDE = ${f(r.MDE, 2)}` : ""}, ρd = ${fd(r.rhoD, 2)} Mg/m³). Les calculateurs du chapitre refont le classement d'une roche.</small></p>
      <div class="table-large"><table class="resultats"><thead><tr><th>tamis (mm)</th>${TAMIS_FR.map((d) => `<th class="num">${String(d).replace(".", ",")}</th>`).join("")}</tr></thead>
      <tbody><tr><td>passant avant (%)</td>${e.avant.map(([, p]) => `<td class="n">${fd(p, 1)}</td>`).join("")}</tr><tr><td>passant après (%)</td>${e.apres.map(([, p]) => `<td class="n">${fd(p, 1)}</td>`).join("")}</tr></tbody></table></div>`;
    e.cleCourbe = ""; dessinerLent();
  }

  b = boucle({ avancer, dessiner, dessinerLent, surFin: bilan, surEtat: () => etatBoutons?.(), pasMax: Infinity });
  etatBoutons = brancherMarche(c, b, reinit);
  vit = regulateur(c, b);
  c.commandes.querySelectorAll("select").forEach((x) => x.addEventListener("change", () => { b.raz(); reinit(); etatBoutons(); }));
  reinit();
  etatBoutons();
}
