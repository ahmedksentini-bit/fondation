// Banc d'essai : l'essai Los Angeles (chapitre 4, NF EN 1097-2). On charge le
// tambour de 711 mm de diamètre de 5 000 g de gravillons 10/14 mm et de 11
// boulets d'acier de 47 mm ; il tourne 500 tours à 31–33 tr/min : la tablette
// d'acier fixée dans le tambour soulève la charge et la laisse retomber, et
// les chocs brisent les granulats. On vide le tambour, on lave le matériau sur
// le tamis de 1,6 mm, on sèche le refus à 110 °C et on le pèse : LA = 100 m/M,
// m étant la masse passée au tamis. La production de fines au fil des tours
// suit la roche du catalogue (materiaux.js), avec une petite variabilité de
// mesure ; le séchage, de plusieurs heures, défile à ×10 000.
import { svg, texte, COULEURS, graphe, echantillon } from "../figures.js";
import { ROCHES } from "./materiaux.js";
import { losAngeles } from "../gtr/roches.js";
import { classerRoche, FAMILLES_ROCHES, SEUILS_2024 } from "../gtr/classification.js";
import { charpente, boucle, brancherMarche, lectures, f, fd, r1, esc, duree } from "./moteur.js";
import { fenetreLoupe, teinte, choc, fleche, etiquette, horloge, W as WL, H as HL, ROUGE, ACIER_SOMBRE } from "./loupe.js";
import { choix, graine, bruit, regulateur, angleTambour, instantCycle, paillasse, ecran, granulat, posteFin, legende, defsAcier, boulet, assouplir } from "./labo-dessin.js";

const MASSE = 5000; // g de gravillons 10/14 mm
const TOURS = 500;
const DUREES = { chargement: 60, vidange: 60, tamisage: 240, sechage: 12 * 3600, pesee: 30 };
const ACCELERE = 10000;
const YP = 300, CX = 165, CY = 146, R = 106; // paillasse ; axe et rayon intérieur du tambour (711 mm)
const D0 = 0.6 * R, MARGE = 6, TABLETTE = 27; // le lit de la charge ; profondeur de la tablette (90 mm)
const ROCHES_LA = Object.entries(ROCHES).filter(([, r]) => Number.isFinite(r.LA));
const PHASES = { chargement: "chargement : gravillons et boulets", rotation: "rotation du tambour", vidange: "vidange du tambour", tamisage: "lavage et tamisage à 1,6 mm", sechage: "séchage du refus à 110 °C", pesee: "pesée du refus" };
// Charge : gravillons et boulets, repérés dans le lit (u le long de la surface, v de la paroi à la surface).
const GRAVILLONS = Array.from({ length: 34 }, (_, i) => ({ u: 2 * ((i * 0.618034 + 0.03) % 1) - 1, v: (i * 0.41421 + 0.13) % 1, r: 4 + 0.7 * (i % 3) }));
const BOULETS = Array.from({ length: 11 }, (_, i) => ({ u: 2 * ((i * 0.381966 + 0.05) % 1) - 1, v: 0.22 + 0.62 * ((i * 0.70711) % 1) }));
/** Part des fines produites après une fraction x des 500 tours : la production ralentit à mesure que les gravillons s'émoussent. */
const production = (x) => (1 - Math.exp(-0.8 * x)) / (1 - Math.exp(-0.8));

export function monter(banc) {
  const c = charpente(banc, {
    vitesse: 30, vitesses: [1, 10, 30, 100],
    commandes: choix("Roche", "roche", ROCHES_LA.map(([k, r]) => [k, `${r.nom} (${r.famille})`]))
      + '<p class="method-note banc-note" style="grid-column:1/-1;margin:0"></p>',
  });
  const loupe = fenetreLoupe(c, "un boulet frappe les gravillons", { echelle: { px: 28, libelle: "2 cm" } });
  assouplir(c);
  let e, b, etatBoutons, vit;

  const reinit = () => {
    const cle = c.q('[data-r="roche"]').value, r = ROCHES[cle], g = graine(cle);
    const passant = Math.round((r.LA * (1 + 0.025 * bruit(g, 1)) * MASSE) / 100); // g passés au tamis de 1,6 mm
    const trMin = 32 + 0.6 * bruit(g, 2);
    const prog = [{ type: "chargement", duree: DUREES.chargement }, { type: "rotation", duree: (TOURS * 60) / trMin }, { type: "vidange", duree: DUREES.vidange },
      { type: "tamisage", duree: DUREES.tamisage }, { type: "sechage", duree: DUREES.sechage }, { type: "pesee", duree: DUREES.pesee }];
    e = { cle, r, g, passant, refus: MASSE - passant, trMin, prog, k: 0, tp: 0, t: 0, fini: false, cleCourbe: "" };
    c.q(".banc-note").innerHTML = `${esc(r.nom)}, famille ${r.famille} du GTR 2024 (${esc(FAMILLES_ROCHES[r.famille])}). Prise d'essai : ${f(MASSE, 4)} g de gravillons 10/14 mm lavés et séchés, 11 boulets d'acier de 47 mm (4 690 à 4 860 g en tout).`;
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
        e.k++; e.tp = 0;
        if (e.prog[e.k]?.type === "sechage") vit.accelerer(ACCELERE);
        if (p.type === "sechage") vit.retablir();
        if (e.k >= e.prog.length) { e.fini = true; e.k = e.prog.length - 1; e.tp = p.duree; }
      }
    }
    return !e.fini;
  };
  /** Tours faits (nombre réel). */
  const tours = () => { const p = pas(); return p.type === "chargement" ? 0 : p.type === "rotation" && !e.fini ? (e.tp * e.trMin) / 60 : TOURS; };
  const pese = () => e.fini || (pas().type === "pesee" && e.tp > DUREES.pesee * 0.3);

  // ── Dessin ──────────────────────────────────────────────────────────────
  function fond() {
    return svg({
      largeur: 640, hauteur: 340, titre: "Machine Los Angeles", contenu: () => {
        let s = defsAcier("la-acier") + paillasse(YP);
        // Bâti en A derrière le tambour, et carter du moteur avec son compte-tours.
        s += `<path d="M${CX - 122} ${YP}L${CX} ${CY}L${CX + 122} ${YP}" fill="none" stroke="#64748b" stroke-width="9" stroke-linejoin="round"/>`;
        s += `<g class="dyn"></g>`;
        s += texte(14, 20, `Los Angeles · ${f(MASSE, 4)} g de gravillons 10/14 mm et 11 boulets · ${TOURS} tours à 31–33 tr/min`, 'style="font-size:11px;font-weight:700;fill:#334155"');
        s += legende(CX, YP + 33, "tambour Ø 711 mm (coupe)") + legende(364, YP + 33, "tamis 1,6 mm") + legende(470, YP + 33, "balance") + legende(576, YP + 33, "étuve");
        return s;
      },
    });
  }

  /** Position dans le lit de la charge, incliné de beta (rad) dans le sens de la rotation. */
  const lit = (u, v, beta, remplissage = 1) => {
    const Rm = R - MARGE, d0 = Rm - (Rm - D0) * remplissage, L = Math.sqrt(Rm * Rm - d0 * d0);
    const x = u * L * 0.95, yMax = Math.sqrt(Math.max(0, Rm * Rm - x * x)), y = yMax - v * Math.max(0, yMax - d0);
    return [CX + x * Math.cos(beta) - y * Math.sin(beta), CY + x * Math.sin(beta) + y * Math.cos(beta)];
  };

  function dessiner() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    const p = pas(), t = horloge(), n = tours(), x = n / TOURS, fr = Math.min(1, e.r.LA / 50), coul = e.r.couleur;
    const tourne = p.type === "rotation" && !e.fini;
    const plein = p.type === "chargement" ? Math.min(1, e.tp / (DUREES.chargement * 0.7)) : p.type === "rotation" ? 1 : p.type === "vidange" && !e.fini ? 1 - Math.min(1, e.tp / (DUREES.vidange * 0.8)) : 0;
    // Angle du tambour : la tablette part en haut à gauche au chargement, le couvercle finit en bas pour la vidange.
    const psi = tourne ? (130 * Math.PI) / 180 + angleTambour(n, e.trMin, vit?.vitesse ?? 1) : p.type === "chargement" ? (130 * Math.PI) / 180 : (-50 * Math.PI) / 180;
    const beta = tourne ? 0.5 : 0, jit = tourne ? 1.4 : 0;
    let s = `<circle cx="${CX}" cy="${CY}" r="${R}" fill="#f8fafc"/>`;
    // Fines produites : un liseré gris au fond du lit, qui s'épaissit.
    if (plein > 0.02 && x > 0) {
      const pts = []; for (let i = 0; i <= 24; i++) pts.push(lit(-1 + i / 12, 0, beta, plein));
      for (let i = 24; i >= 0; i--) pts.push(lit(-1 + i / 12, Math.min(0.5, 0.12 + 0.5 * x * fr), beta, plein));
      s += `<path d="M${pts.map(([a, b2]) => `${r1(a)} ${r1(b2)}`).join("L")}Z" fill="#a8a29e" opacity=".75"/>`;
    }
    // Gravillons (grossis pour la lecture) et boulets ; ils s'émoussent et rapetissent au fil des tours.
    const nG = Math.round(GRAVILLONS.length * plein), nB = Math.round(BOULETS.length * plein);
    GRAVILLONS.slice(0, nG).forEach((q, i) => {
      const [gx, gy] = lit(q.u, q.v, beta, plein);
      s += granulat(gx + jit * Math.sin(t * 9 + i), gy + jit * Math.cos(t * 7 + i), q.r * (1 - 0.3 * x * fr), e.g + i, { couleur: coul, trait: teinte(coul, 0.5), arrondi: Math.min(1, 0.1 + x * (0.3 + fr)), rot: i });
    });
    BOULETS.slice(0, nB).forEach((q, i) => {
      const [bx, by] = lit(q.u, q.v, beta, plein);
      s += boulet(bx + jit * Math.sin(t * 6 + 2 * i), by, 7.5, "la-acier");
    });
    // Tablette : elle soulève une part de la charge, qui retombe quand elle passe en haut.
    const c1 = Math.cos(psi), s1 = Math.sin(psi), deg = ((((psi * 180) / Math.PI) % 360) + 360) % 360;
    const bx = CX + R * c1, by = CY + R * s1, tx = CX + (R - TABLETTE) * c1, ty = CY + (R - TABLETTE) * s1;
    if (tourne && deg > 105 && deg < 235) {
      const nx = -s1, ny = c1; // normale à la face avant de la tablette (sens de la rotation) : la charge repose dessus
      for (let j = 0; j < 3; j++) { const d = 6 + 8 * j; s += granulat(bx - c1 * d + nx * 5, by - s1 * d + ny * 5, 4.5, e.g + 50 + j, { couleur: coul, arrondi: 0.3 }); }
    }
    if (tourne && deg >= 235 && deg < 300) {
      for (let j = 0; j < 6; j++) {
        const q = (t * 2.2 + j / 6) % 1, yy = ty + q * q * (CY + D0 - ty);
        s += j === 2 ? boulet(tx + 3, yy, 7.5, "la-acier") : granulat(tx - 6 + (j % 3) * 6, yy, 4.2, e.g + 60 + j, { couleur: coul });
      }
    }
    s += `<path d="M${r1(bx)} ${r1(by)}L${r1(tx)} ${r1(ty)}" stroke="#334155" stroke-width="6" stroke-linecap="square"/>`;
    // Virole, couvercle (en bas pendant la vidange), moyeu.
    s += `<circle cx="${CX}" cy="${CY}" r="${R + 4.5}" fill="none" stroke="#64748b" stroke-width="9"/>`;
    const pc = psi + (140 * Math.PI) / 180, ouvert = p.type === "vidange" && !e.fini;
    s += `<path d="M${r1(CX + (R + 4.5) * Math.cos(pc - 0.2))} ${r1(CY + (R + 4.5) * Math.sin(pc - 0.2))}A${R + 4.5} ${R + 4.5} 0 0 1 ${r1(CX + (R + 4.5) * Math.cos(pc + 0.2))} ${r1(CY + (R + 4.5) * Math.sin(pc + 0.2))}" fill="none" stroke="${ouvert ? "#f8fafc" : "#334155"}" stroke-width="11"/>`;
    for (const da of [-0.13, 0.13]) s += `<circle cx="${r1(CX + (R + 4.5) * Math.cos(pc + da))}" cy="${r1(CY + (R + 4.5) * Math.sin(pc + da))}" r="2.2" fill="#cbd5e1"/>`;
    s += `<circle cx="${CX}" cy="${CY}" r="9" fill="#94a3b8" stroke="#334155" stroke-width="1.5"/><circle cx="${CX}" cy="${CY}" r="3" fill="#334155"/>`;
    if (tourne) s += `<path d="M${CX + 44} ${CY - 70}A82 82 0 0 1 ${CX + 76} ${CY - 34}" fill="none" stroke="${ROUGE}" stroke-width="2"/>` + fleche(CX + 70, CY - 44, CX + 77, CY - 31, ROUGE, 2, 7);
    // Vidange : la charge tombe dans le bac posé sous le tambour.
    const bac = p.type === "vidange" && !e.fini ? Math.min(1, e.tp / (DUREES.vidange * 0.8)) : 0;
    if (p.type === "vidange" && !e.fini) {
      s += `<path d="M${CX - 46} ${YP - 22}h92l-5 22h-82z" fill="#e2e8f0" stroke="#64748b"/>`;
      s += `<path d="M${CX - 38} ${YP - 3}Q${CX} ${r1(YP - 3 - 30 * bac)} ${CX + 38} ${YP - 3}Z" fill="${teinte(e.r.couleur, 0.9)}" stroke="${teinte(e.r.couleur, 0.6)}"/>`;
      if (bac < 1) for (let j = 0; j < 5; j++) { const q = (t * 2 + j / 5) % 1; s += granulat(CX - 8 + (j % 3) * 7, CY + R + 10 + q * (YP - 30 - CY - R - 10), 4, e.g + 70 + j, { couleur: coul }); }
    }
    // Carter du moteur et compte-tours.
    s += `<rect x="${CX + 62}" y="${YP - 34}" width="78" height="34" rx="4" fill="#e2e8f0" stroke="#64748b"/>` + ecran(CX + 68, YP - 28, 66, `${f(Math.floor(n), 3)} tr`, { taille: 12, h: 20 });
    // Poste de fin d'essai : tamis, balance, étuve.
    const phaseFin = e.fini ? "fini" : ["tamisage", "sechage", "pesee"].includes(p.type) ? p.type : "attente";
    s += posteFin({ x0: 316, y: YP, phase: phaseFin, fr: Math.min(1, e.tp / p.duree), couleur: coul, g: e.g, lecture: pese() ? `${fd(e.refus, 1)} g` : "0,0 g" });
    svgEl.querySelector(".dyn").innerHTML = s;
    const LA = pese() ? losAngeles({ passant16: e.passant, M: MASSE }) : NaN;
    c.lectures.innerHTML = lectures([
      ["Tours", `${f(Math.floor(n), 3)} / ${TOURS}`, ""],
      ["Vitesse de rotation", tourne ? fd(e.trMin + 0.15 * Math.sin(t * 1.3), 1) : "—", "tr/min"],
      ["Temps", duree(e.t), ""],
      ["Refus sec à 1,6 mm", pese() ? f(e.refus, 4) : "—", "g"],
      ["LA", Number.isFinite(LA) ? f(LA, 2) : "—", ""],
    ]) + `<p class="banc-etat">${e.fini ? "essai terminé" : PHASES[p.type]}${vit?.force ? ` — le banc défile à ×${f(vit.force, 6)}` : ""}</p>`;
    loupe(...vueLoupe());
  }

  // ── Loupe : un boulet retombe sur les gravillons, qui éclatent ────────────
  const KL = 1.4, RB = (47 / 2) * KL, XC = 92, YF = HL - 14; // px/mm ; rayon du boulet (Ø 47 mm) ; point d'impact ; tôle du tambour
  function vueLoupe() {
    const p = pas(), t = horloge(), x = tours() / TOURS, fr = Math.min(1, e.r.LA / 50), coul = e.r.couleur;
    const tourne = p.type === "rotation" && !e.fini;
    const rG = 9.5 * (1 - 0.3 * x * fr), arr = Math.min(1, 0.1 + x * (0.3 + fr));
    let s = defsAcier("la-acier-l") + `<rect width="${WL}" height="${HL}" fill="#f1f5f9"/><rect x="0" y="${YF}" width="${WL}" height="14" fill="${ACIER_SOMBRE}"/>`;
    // Fines au fond, puis deux rangs de gravillons ; ils s'émoussent et rapetissent au fil des tours.
    const hF = x > 0 ? 3 + 10 * x * fr : 0;
    if (hF) s += `<rect x="0" y="${r1(YF - hF)}" width="${WL}" height="${r1(hF)}" fill="#a8a29e" opacity=".85"/>`;
    for (let i = 0; i < 9; i++) s += granulat(4 + i * 21, YF - hF - rG, rG, e.g + 100 + i, { couleur: coul, arrondi: arr, rot: i });
    for (let i = 0; i < 8; i++) if (i !== 4) s += granulat(4 + 10.5 + i * 21, YF - hF - 2.55 * rG, rG, e.g + 120 + i, { couleur: coul, arrondi: arr, rot: i + 3 });
    const yC = YF - hF - 2.55 * rG, yImpact = yC - rG - RB + 2;
    if (!tourne) {
      s += granulat(XC, yC, rG, e.g + 104, { couleur: coul, arrondi: arr }) + boulet(XC + 52, yC - rG - RB + 4, RB, "la-acier-l");
      const leg = p.type === "chargement" ? "les gravillons 10/14 et les boulets entrent dans le tambour"
        : p.type === "vidange" && !e.fini ? "vidange : la charge tombe dans le bac" : "après 500 tours : gravillons émoussés, éclats et fines";
      return [s + etiquette(WL - 6, 14, `${f(Math.floor(tours()), 3)} tours`, { ancre: "end" }), leg];
    }
    // Cycle d'un choc : chute du boulet lâché par la tablette, impact, éclats.
    const T = 60 / e.trMin, q = instantCycle(e.tp, T, vit?.vitesse ?? 1, 0.8) / T;
    let yB, apres = 0;
    if (q < 0.4) yB = -RB + (q / 0.4) ** 2 * (yImpact + RB);
    else { yB = yImpact - 3 * Math.abs(Math.sin((q - 0.4) * 9)) * (1 - q); apres = (q - 0.4) / 0.6; }
    const morceaux = fr < 0.3 ? 1 : fr < 0.7 ? 2 : 3;
    if (apres === 0 || morceaux === 1) s += granulat(XC, yC, rG, e.g + 104, { couleur: coul, arrondi: arr });
    else for (let k = 0; k < morceaux; k++) {
      const a = Math.PI * (k / (morceaux - 1) - 0.5) * 0.9, d = 5 + 10 * apres;
      s += granulat(XC + d * Math.sin(a), yC + 2 + d * 0.25 * Math.abs(Math.cos(a)), rG * (morceaux === 2 ? 0.72 : 0.6), e.g + 110 + k, { couleur: coul, arrondi: 0.05, rot: k * 2 });
    }
    if (apres > 0) {
      // Éclats projetés, d'autant plus nombreux que la roche est fragile, et un nuage de poussière.
      const nE = Math.round(2 + 7 * fr);
      for (let k = 0; k < nE; k++) {
        const a = -Math.PI * (0.1 + 0.8 * ((k * 0.618) % 1)), v = 30 + 34 * ((k * 0.37) % 1);
        const ex = XC + Math.cos(a) * v * apres, ey = yC - 4 + Math.sin(a) * v * apres + 46 * apres * apres;
        s += `<path d="M${r1(ex)} ${r1(ey)}l3 -1.6l-0.9 3.2z" fill="${teinte(coul, 0.85)}" stroke="${teinte(coul, 0.5)}" stroke-width=".5"/>`;
      }
      if (fr > 0.3) s += `<ellipse cx="${XC}" cy="${r1(yC - 2)}" rx="${r1(12 + 28 * apres)}" ry="${r1(6 + 11 * apres)}" fill="#a8a29e" opacity="${r1(0.55 * fr * (1 - apres))}"/>`;
      if (apres < 0.15) s += choc(XC, yC - rG * 0.4, rG + 5);
    } else s += fleche(XC + RB + 10, Math.max(8, yB - 12), XC + RB + 10, Math.max(8, yB - 12) + 20, ROUGE, 2, 6);
    s += boulet(XC, yB, RB, "la-acier-l");
    s += etiquette(WL - 6, 14, `tour ${f(Math.floor(tours()), 3)}`, { ancre: "end" });
    const leg = apres === 0 ? "la tablette lâche la charge : un boulet de 47 mm tombe"
      : fr < 0.3 ? `choc : le ${e.r.nom.toLowerCase()} résiste, seuls de petits éclats partent` : fr < 0.7 ? "choc : le gravillon se fend, des éclats partent" : "choc : le gravillon éclate en morceaux et en poussière";
    return [s, leg];
  }

  // ── Courbe : production de fines au fil des tours ─────────────────────────
  function dessinerLent() {
    const zone = c.courbes.querySelector(".dyn-courbe");
    if (!zone) return;
    const n = Math.floor(tours()), cle = `${n}|${pese()}`;
    if (cle === e.cleCourbe) return;
    e.cleCourbe = cle;
    const LAm = (100 * e.passant) / MASSE, ymax = Math.max(60, LAm * 1.25);
    const series = [
      { points: echantillon((k) => (100 * e.passant * production(k / TOURS)) / MASSE, 0, Math.max(1e-6, n), 50).filter(() => n > 0), couleur: COULEURS.gtr92, epaisseur: 2.2, libelle: "passant à 1,6 mm au fil des tours (matériau du banc)" },
      { points: [[0, 25], [TOURS, 25]], couleur: COULEURS.gtr24, tirets: "2 3", epaisseur: 1.3, libelle: "25 : R1" },
      { points: [[0, 35], [TOURS, 35]], couleur: COULEURS.bleu, tirets: "5 3", epaisseur: 1.3, libelle: "35 : R2" },
      { points: [[0, SEUILS_2024.LA], [TOURS, SEUILS_2024.LA]], couleur: COULEURS.effort, tirets: "8 4", epaisseur: 1.5, libelle: `${SEUILS_2024.LA} : R3 et couche de forme` },
    ];
    const marques = pese() ? [{ x: TOURS, y: losAngeles({ passant16: e.passant, M: MASSE }), couleur: COULEURS.encre, guides: true, libelle: `mesure : LA = ${f(losAngeles({ passant16: e.passant, M: MASSE }), 2)}` }] : [];
    zone.innerHTML = graphe({ largeur: 560, hauteur: 250, xmin: 0, xmax: TOURS, ymin: 0, ymax, pasX: 100, xlabel: "nombre de tours", ylabel: "passant à 1,6 mm (% de M)", series, marques });
  }

  function bilan() {
    const LA = losAngeles({ passant16: e.passant, M: MASSE }), r = e.r, cl = classerRoche(r.famille, { ...r, LA });
    const regle = { Vo: "roche magmatique : R1 si LA ≤ 25 et MDE ≤ 10, R2 si LA ≤ 35 et MDE ≤ 25, R3 si LA ≤ 45 et MDE ≤ 45", Me: "roche métamorphique : R1 si LA ≤ 25 et MDE ≤ 10, R2 si LA ≤ 35 et MDE ≤ 25, R3 si LA ≤ 45 et MDE ≤ 45",
      Li: "les calcaires se classent par leur MDE et leur masse volumique sèche", Sa: "grès : R3 si LA ≤ 45 et MDE ≤ 45, sinon R4 ou R5 selon IFR et IDGa", Cl: "les roches argileuses se classent par IFR, IDGa et MDE" }[r.famille] ?? "";
    const seuil = LA <= SEUILS_2024.LA ? `LA ≤ ${SEUILS_2024.LA} : le critère LA du GTR 2024 pour la couche de forme est satisfait (il faut aussi MDE ≤ 45)` : `LA > ${SEUILS_2024.LA} : trop friable pour une couche de forme non traitée, les engins la broieraient`;
    c.bilan.innerHTML = `<p class="final-result">LA = 100 × ${f(e.passant, 4)}/${f(MASSE, 4)} = <strong>${f(LA, 2)}</strong> — ${seuil} ; ${regle} : avec ${r.famille === "Cl" ? `IFR = ${f(r.IFR, 2)}, IDGa = ${f(r.IDGa, 2)} et MDE = ${f(r.MDE, 2)}` : r.famille === "Li" ? `MDE = ${f(r.MDE, 2)} et ρd = ${fd(r.rhoD, 2)} Mg/m³` : `MDE = ${f(r.MDE, 2)}`}, classe <strong>${esc(cl.sousClasse ?? "—")}</strong> (${esc(cl.nom ?? cl.motif ?? "")}).
        <small>NF EN 1097-2 : 500 tours à 31–33 tr/min dans le tambour de 711 mm, passant au tamis de 1,6 mm après lavage et séchage à 110 °C. Le MDE vient de l'essai micro-Deval (banc suivant). Les calculateurs du chapitre refont le classement d'une roche.</small></p>
      <div class="table-large"><table class="resultats"><thead><tr><th class="num">M (g)</th><th class="num">refus sec à 1,6 mm (g)</th><th class="num">passant m (g)</th><th class="num">LA = 100 m/M</th><th class="num">durée de rotation</th></tr></thead>
      <tbody><tr><td class="n">${f(MASSE, 4)}</td><td class="n">${f(e.refus, 4)}</td><td class="n">${f(e.passant, 4)}</td><td class="n">${f(LA, 2)}</td><td class="n">${duree(e.prog[1].duree)} à ${fd(e.trMin, 1)} tr/min</td></tr></tbody></table></div>`;
    e.cleCourbe = ""; dessinerLent();
  }

  b = boucle({ avancer, dessiner, dessinerLent, surFin: bilan, surEtat: () => etatBoutons?.(), pasMax: Infinity });
  etatBoutons = brancherMarche(c, b, reinit);
  vit = regulateur(c, b);
  c.commandes.querySelectorAll("select").forEach((x) => x.addEventListener("change", () => { b.raz(); reinit(); etatBoutons(); }));
  reinit();
  etatBoutons();
}
