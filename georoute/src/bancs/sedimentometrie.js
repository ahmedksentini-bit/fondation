// Banc d'essai : la sédimentométrie au densimètre (chapitre 2). On choisit le
// sol — on en a lavé la fraction fine — et la température du bain : 50 g de la
// fraction < 63 µm, dispersés avec un défloculant, sont mis en suspension dans
// une éprouvette de 1 L que l'on retourne pendant une minute ; puis le
// chronomètre part et l'on lit le densimètre à 30 s, 1, 2, 5, 15 et 30 min,
// 1, 2, 4 et 24 h. La suspension s'éclaircit par le haut, le densimètre
// s'enfonce à mesure que la masse volumique baisse ; chaque lecture donne un
// diamètre (loi de Stokes) et un pourcentage de grains plus fins, et la courbe
// se raccorde au point de tamisage à 63 µm. D10, Cu et la fraction argileuse
// (< 2 µm) en sortent (NF EN ISO 17892-4).
//
// Modèle : la suspension est homogène au départ ; à la profondeur z et au
// temps t, il ne reste que les grains plus fins que D(z, t) = √(18 η z /
// ((ρs − ρw) g t)). La masse volumique au centre de poussée du densimètre
// (profondeur Hr, fonction de la lecture par l'étalonnage du densimètre) se
// déduit donc de la courbe granulométrique fine du sol, interpolée et
// prolongée sous son premier point : ρ = ρw + δ + (ms/V)(1 − 1/ρs)·F(D). La
// lecture du densimètre redonne ainsi la courbe du sol. Le défloculant (δ) et
// la température sont corrigés par l'éprouvette témoin, lue dans le même bain.
//
// Les lectures s'étalent de 30 s à 24 h en progression géométrique : passé
// les 30 premières secondes, le temps de l'essai s'accélère à mesure qu'il
// avance (la vitesse choisie est celle du début), si bien que les lectures se
// suivent à intervalles à peu près réguliers.
import { svg, texte, COULEURS, graphe } from "../figures.js";
import { SOLS } from "./materiaux.js";
import { analyser, etalement, passant } from "../gtr/granulo.js";
import { diametreStokes, viscositeEau, pourcentageSedimento } from "../gtr/identification.js";
import { classerSol } from "../gtr/classification.js";
import { charpente, boucle, brancherMarche, lectures, f, fd, r1, esc, duree } from "./moteur.js";
import { fenetreLoupe, etiquette, fleche, horloge, W as WL, H as HL, BLEU } from "./loupe.js";
import { bruit, hasard, teintesSol, paillasse, melange, passantProlonge } from "./identification-dessin.js";

const CHOIX = ["limon", "argile", "sableArgileux", "graveArgileuse"];
const LECTURES = [30, 60, 120, 300, 900, 1800, 3600, 7200, 14400, 86400]; // s
const MS = 50, V = 1000; // g de sol sec, cm³ de suspension
const AGITATION = 60; // s : retournements de l'éprouvette avant le départ du chronomètre
const T0 = 30; // s : au-delà, le temps de l'essai s'accélère comme t/T0
const DELTA = 0.003; // Mg/m³ : masse volumique ajoutée par le défloculant
const H_SUSP = 0.354; // m : hauteur de la suspension (1 L dans une éprouvette de Ø 60 mm)
/** Étalonnage du densimètre : profondeur effective Hr (m) du centre de poussée pour la lecture ρ. */
const HR = (rho) => 0.163 - 2.645 * (rho - 1);
/** Distance (mm) du haut du bulbe à la graduation ρ de la tige. */
const L1 = (rho) => 105 - 2645 * (rho - 1);
/** Masse volumique de l'eau (Mg/m³) à T °C — formule de Thiesen. */
const rhoEau = (T) => 1 - ((T - 3.98) ** 2 * (T + 283)) / (503570 * (T + 67.26));
/** Temps d'essai t ↔ horloge de base s du banc : linéaire jusqu'à T0, logarithmique ensuite. */
const tDeS = (s) => (s <= T0 ? s : T0 * Math.exp((s - T0) / T0));
const sDeT = (t) => (t <= T0 ? t : T0 + T0 * Math.log(t / T0));
const CLASSES = [[63, 32], [32, 16], [16, 8], [8, 4], [4, 2], [2, 0.6]]; // µm : classes de grains montrées à la loupe

export function monter(banc) {
  const c = charpente(banc, {
    vitesse: 10, vitesses: [1, 10, 100],
    commandes: `
      <div class="field"><label>Sol (fraction &lt; 63 µm)</label><div class="input-wrap"><select data-r="sol">${CHOIX.map((k) => `<option value="${k}">${esc(SOLS[k].nom)}</option>`).join("")}</select></div></div>
      <div class="field"><label>Température du bain</label><div class="input-wrap"><input data-r="T" type="text" inputmode="decimal" value="20" data-curseur="10 30 1"><span class="unit">°C</span></div></div>
      <p class="method-note" style="grid-column:1/-1">${MS} g de la fraction &lt; 63 µm et le défloculant dans ${f(V, 4)} cm³ ; lectures à 30 s, 1, 2, 5, 15 et 30 min, 1, 2, 4 et 24 h.
        La vitesse choisie est celle du départ : le temps s'accélère ensuite, pour que les lectures se suivent à intervalles réguliers.</p>`,
  });
  const loupe = fenetreLoupe(c, "les grains autour du bulbe");
  let e, b, etatBoutons;
  c.courbes.style.minWidth = "0"; // un tableau large défile dans son cadre au lieu d'élargir le banc

  const reinit = () => {
    const cle = c.q('[data-r="sol"]').value, sol = SOLS[cle], g = CHOIX.indexOf(cle) + 11;
    const T = Math.min(35, Math.max(5, parseFloat(String(c.q('[data-r="T"]').value).replace(",", ".")) || 20));
    const p63 = passant(sol.granulo, 0.063);
    const eta = viscositeEau(T), rw = rhoEau(T);
    e = {
      cle, sol, g, T, eta, rw, p63, rhoS: sol.rhoS, teintes: teintesSol(sol),
      base: rw + DELTA, c0: (MS / V) * (1 - 1 / sol.rhoS), temoin: Math.round((rw + DELTA) * 1e4) / 1e4,
      phase: "agitation", tp: 0, s: 0, t: 0, i: 0, mesures: [], fini: false, cleCourbe: "",
    };
    c.scene.innerHTML = fond();
    c.courbes.innerHTML = '<div class="dyn-courbe"></div><div class="dyn-tableau" style="min-width:0"></div>';
    c.bilan.innerHTML = "";
    dessiner(); dessinerLent();
  };

  /** Part (0–1) de la fraction fine plus fine que D (mm), d'après la courbe du sol. */
  const F = (D) => Math.min(1, passantProlonge(e.sol.granulo, D) / e.p63);
  /** Diamètre (mm) des plus gros grains encore présents à la profondeur z (m) au temps t (s). */
  const Dz = (z, t) => (t > 0 ? diametreStokes({ Hr: z, t, rhoS: e.rhoS, eta: e.eta }) : Infinity);
  /** Masse volumique vraie au centre de poussée du densimètre : point fixe, car Hr dépend de la lecture. */
  function rhoVrai(t) {
    let rho = e.base + e.c0;
    for (let k = 0; k < 8; k++) rho = e.base + e.c0 * F(Dz(HR(rho), t));
    return rho;
  }

  const lire = () => {
    const t = LECTURES[e.i];
    const rho = Math.round((rhoVrai(t) + 0.00012 * bruit(e.i, e.g)) * 1e4) / 1e4; // lecture au dix-millième
    const Hr = HR(rho), D = diametreStokes({ Hr, t, rhoS: e.rhoS, eta: e.eta });
    const Pf = pourcentageSedimento({ rhoLu: rho, rhoEau: e.temoin, V, ms: MS, rhoS: e.rhoS });
    e.mesures.push({ t, rho, Hr, D, Pf, P: (Pf * e.p63) / 100 });
  };

  const avancer = (dt) => {
    if (e.fini) return false;
    let reste = dt;
    while (reste > 1e-9 && !e.fini) {
      if (e.phase === "agitation") {
        const h = Math.min(reste, AGITATION - e.tp);
        e.tp += h; reste -= h;
        if (e.tp >= AGITATION - 1e-9) { e.phase = "decantation"; e.s = 0; e.t = 0; }
        continue;
      }
      const sL = sDeT(LECTURES[e.i]);
      const h = Math.min(reste, sL - e.s);
      e.s += h; reste -= h; e.t = tDeS(e.s);
      if (e.s >= sL - 1e-9) {
        e.t = LECTURES[e.i];
        lire();
        e.i++;
        if (e.i >= LECTURES.length) { e.fini = true; e.phase = "fini"; }
      }
    }
    return !e.fini;
  };

  // ── Dessin ──────────────────────────────────────────────────────────────
  const KS = 0.75; // px par mm dans l'éprouvette
  const EP = { xc: 110, yS: 128, r: 22.5 }; // éprouvette d'essai : axe, surface libre, rayon intérieur (Ø 60 mm)
  const TE = { xc: 238 }; // éprouvette témoin
  const yFondEp = EP.yS + H_SUSP * 1000 * KS;
  function fond() {
    return svg({
      largeur: 640, hauteur: 444, titre: "Sédimentométrie : éprouvette d'essai et témoin dans le bain, tige du densimètre, lectures", contenu: () => {
        let s = paillasse(0, 640, 422);
        // Bain thermostaté.
        s += `<rect x="30" y="96" width="272" height="326" rx="6" fill="#e0f2fe" opacity=".55" stroke="#64748b" stroke-width="1.4"/>`;
        s += `<path d="M30 112H302" stroke="${COULEURS.eau}" stroke-width="1" stroke-dasharray="5 4" opacity=".7"/>`;
        s += texte(165, 415, "bain thermostaté", 'text-anchor="middle" class="halo" style="font-size:10.5px;font-weight:700;fill:#475569"');
        // Éprouvette témoin : eau et défloculant seuls.
        s += eprouvette(TE.xc, "#eef7fd") + texte(TE.xc - EP.r - 6, 90, "témoin", 'text-anchor="end" style="font-size:10.5px;font-weight:700;fill:#334155"');
        s += `<g class="dyn-temoin"></g><g class="dyn-essai"></g><g class="dyn-droite"></g>`;
        return s;
      },
    });
  }

  /** Verre d'une éprouvette de 1 L dans le bain ; contenu : teinte de fond. */
  function eprouvette(xc, contenu = null) {
    let s = "";
    if (contenu) s += `<rect x="${r1(xc - EP.r)}" y="${r1(EP.yS)}" width="${r1(2 * EP.r)}" height="${r1(yFondEp - EP.yS)}" fill="${contenu}"/>`;
    s += `<path d="M${r1(xc - EP.r - 2)} 74V${r1(yFondEp + 3)}H${r1(xc + EP.r + 2)}V74" fill="none" stroke="#475569" stroke-width="1.6"/>`;
    s += `<rect x="${r1(xc - EP.r - 12)}" y="${r1(yFondEp + 3)}" width="${r1(2 * EP.r + 24)}" height="6" rx="2" fill="#94a3b8"/>`;
    s += `<path d="M${r1(xc - EP.r + 4)} 80V${r1(yFondEp - 4)}" stroke="#fff" stroke-width="2.4" opacity=".7"/>`;
    // Trait de jauge 1 000 mL.
    s += `<path d="M${r1(xc + EP.r - 10)} ${EP.yS}h12" stroke="#334155" stroke-width="1"/>`;
    return s;
  }

  /** Densimètre dont la graduation ρ affleure à la surface libre ; xc : axe. */
  function densimetre(xc, rho, yS = EP.yS) {
    const yBulbe = yS + L1(rho) * KS, lb = 140 * KS, rb = 14 * KS, yTige = yBulbe - 150 * KS;
    let s = `<rect x="${r1(xc - 2.4)}" y="${r1(yTige)}" width="4.8" height="${r1(yBulbe - yTige + 6)}" rx="2" fill="#f8fafc" stroke="#475569" stroke-width="1"/>`;
    s += `<path d="M${r1(xc - 2.4)} ${r1(yBulbe + 2)}C${r1(xc - rb)} ${r1(yBulbe + 10)} ${r1(xc - rb)} ${r1(yBulbe + 10)} ${r1(xc - rb)} ${r1(yBulbe + 20)}V${r1(yBulbe + lb - 16)}Q${r1(xc - rb)} ${r1(yBulbe + lb)} ${r1(xc)} ${r1(yBulbe + lb)}Q${r1(xc + rb)} ${r1(yBulbe + lb)} ${r1(xc + rb)} ${r1(yBulbe + lb - 16)}V${r1(yBulbe + 20)}C${r1(xc + rb)} ${r1(yBulbe + 10)} ${r1(xc + rb)} ${r1(yBulbe + 10)} ${r1(xc + 2.4)} ${r1(yBulbe + 2)}Z" fill="#f1f5f9" fill-opacity=".85" stroke="#475569" stroke-width="1.2"/>`;
    s += `<rect x="${r1(xc - rb + 3)}" y="${r1(yBulbe + lb - 22)}" width="${r1(2 * rb - 6)}" height="14" rx="5" fill="#64748b"/>`; // lest
    // Graduations de la tige au-dessus de la surface.
    for (let v = 0.995; v <= 1.0381; v += 0.005) {
      const y = yBulbe - L1(v) * KS;
      if (y < yS - 1) s += `<path d="M${r1(xc - 2.4)} ${r1(y)}h3" stroke="#334155" stroke-width=".8"/>`;
    }
    return s;
  }

  function dessiner() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    const tH = horloge(), ph = e.phase;
    // ── Éprouvette d'essai ──
    let s = "";
    const n = 48, hz = (yFondEp - EP.yS) / n;
    const agite = ph === "agitation";
    const rhoNow = agite ? e.base + e.c0 : rhoVrai(e.t);
    // Dépôt au fond : la masse déjà décantée, sur une hauteur d'environ 1,4 cm pour 50 g.
    let moy = 0;
    for (let j = 0; j < n; j++) {
      const z = ((j + 0.5) / n) * H_SUSP, C = agite ? 1 : F(Dz(z, e.t));
      moy += C / n;
      s += `<rect x="${r1(EP.xc - EP.r)}" y="${r1(EP.yS + j * hz)}" width="${r1(2 * EP.r)}" height="${r1(hz + 0.6)}" fill="${trouble(C)}"/>`;
    }
    const hDepot = agite ? 0 : (1 - moy) * 14 * KS;
    if (hDepot > 0.3) s += `<path d="M${r1(EP.xc - EP.r)} ${r1(yFondEp)}V${r1(yFondEp - hDepot)}Q${EP.xc} ${r1(yFondEp - hDepot * 1.3)} ${r1(EP.xc + EP.r)} ${r1(yFondEp - hDepot)}V${r1(yFondEp)}Z" fill="${e.teintes.sombre}"/>`;
    s += eprouvette(EP.xc);
    if (agite) {
      // Retournements : l'éprouvette bouchée bascule tête en bas, une fois toutes les deux secondes.
      const ang = 90 * (1 - Math.cos(Math.PI * ((e.tp / 2) % 2)));
      // Sortie du bain le temps de l'agitation : dessinée réduite de moitié pour rester dans le cadre.
      const yC = r1((EP.yS + yFondEp) / 2);
      s = `<g transform="translate(${EP.xc} ${yC}) rotate(${r1(ang)}) scale(.5) translate(${-EP.xc} ${-yC})">${s}<rect x="${r1(EP.xc - EP.r - 4)}" y="66" width="${r1(2 * EP.r + 8)}" height="10" rx="3" fill="#334155"/></g>`;
      s += `<path d="M${EP.xc - 62} 150a70 70 0 0 1 124 0" fill="none" stroke="${COULEURS.effort}" stroke-width="1.6"/>` + fleche(EP.xc + 58, 140, EP.xc + 63, 151, COULEURS.effort, 1.6, 6);
    } else {
      s += densimetre(EP.xc, rhoNow);
      // Repère du centre de poussée (profondeur Hr).
      const yHr = EP.yS + HR(rhoNow) * 1000 * KS;
      s += `<path d="M${r1(EP.xc - EP.r - 14)} ${r1(yHr)}h10" stroke="${COULEURS.effort}" stroke-width="1.6"/>` + texte(EP.xc - EP.r - 16, yHr + 4, `Hr = ${fd(HR(rhoNow) * 100, 1)} cm`, `text-anchor="end" class="halo" style="font-size:10px;font-weight:700;fill:${COULEURS.effort}"`);
    }
    s += texte(EP.xc - EP.r - 6, 90, "essai", 'text-anchor="end" style="font-size:10.5px;font-weight:700;fill:#334155"');
    svgEl.querySelector(".dyn-essai").innerHTML = s;
    // ── Témoin : densimètre (et thermomètre) toujours dans l'eau claire ──
    let tm = densimetre(TE.xc - 6, e.temoin);
    tm += `<rect x="${TE.xc + 9}" y="84" width="5" height="210" rx="2.5" fill="#fff" stroke="#475569"/><rect x="${TE.xc + 10.5}" y="${r1(290 - 140 * (e.T / 40))}" width="2" height="${r1(140 * (e.T / 40))}" fill="${COULEURS.effort}"/><circle cx="${TE.xc + 11.5}" cy="296" r="5" fill="${COULEURS.effort}"/>`;
    tm += texte(TE.xc + EP.r + 6, 104, `${f(e.T, 3)} °C`, `class="halo" style="font-size:10.5px;font-weight:700;fill:${COULEURS.effort}"`);
    svgEl.querySelector(".dyn-temoin").innerHTML = tm;
    // ── À droite : la tige du densimètre au ménisque, le chronomètre, les lectures ──
    let r = "";
    const xt = 352, yM = 196, pas = 13; // 0,001 = 13 px
    r += texte(xt + 8, 54, "tige au ménisque", 'text-anchor="middle" style="font-size:10.5px;font-weight:700;fill:#334155"');
    r += `<rect x="${xt - 26}" y="62" width="76" height="262" rx="4" fill="#f8fafc" stroke="#cbd5e1"/>`;
    r += `<rect x="${xt - 26}" y="${yM}" width="76" height="${324 - yM}" fill="${trouble(agite ? 1 : F(Dz(0.01, e.t)))}" opacity=".9"/>`;
    r += `<rect x="${xt - 7}" y="62" width="14" height="262" fill="#fff" stroke="#475569"/>`;
    if (!agite) {
      for (let k = -12; k <= 12; k++) {
        const v = Math.round(rhoNow * 1000 + k) / 1000, y = yM + (v - rhoNow) * 1000 * pas;
        if (y < 66 || y > 320) continue;
        const cinq = Math.abs(v * 1000 - Math.round(v * 200) * 5) < 1e-6;
        r += `<path d="M${xt - 7} ${r1(y)}h${cinq ? 10 : 6}" stroke="#0f172a" stroke-width="${cinq ? 1.3 : 0.8}"/>`;
        if (cinq) r += texte(xt + 11, y + 4, fd(v, 3), 'style="font-size:10px;font-weight:700;fill:#0f172a"');
      }
      r += `<path d="M${xt - 26} ${yM}H${xt - 7}Q${xt - 4} ${yM - 5} ${xt} ${yM - 7}Q${xt + 4} ${yM - 5} ${xt + 7} ${yM}H${xt + 50}" fill="none" stroke="${BLEU}" stroke-width="1.6"/>`;
      r += texte(xt + 12, 344, `R = ${fd(rhoNow, 4)}`, `text-anchor="middle" style="font-size:12px;font-weight:800;fill:${BLEU}"`);
    } else r += texte(xt + 12, 344, "densimètre hors de l'éprouvette", 'text-anchor="middle" style="font-size:10px;fill:#475569"');
    // Chronomètre.
    r += `<rect x="452" y="44" width="176" height="52" rx="8" fill="#0f172a"/>`;
    r += texte(540, 64, agite ? "agitation" : "chronomètre", 'text-anchor="middle" style="font-size:10px;fill:#94a3b8"');
    r += texte(540, 86, agite ? `${fd(e.tp, 0)} s / 60 s` : chrono(e.t), 'text-anchor="middle" style="font-family:ui-monospace,Consolas,monospace;font-size:16px;font-weight:800;fill:#67e8f9"');
    // Lectures relevées.
    r += texte(452, 118, "lectures", 'style="font-size:10.5px;font-weight:800;fill:#334155"') + texte(628, 118, "R", 'text-anchor="end" style="font-size:10.5px;font-weight:800;fill:#334155"');
    LECTURES.forEach((t, k) => {
      const m = e.mesures[k], y = 138 + k * 19, prochaine = !e.fini && k === e.i && !agite;
      r += `<rect x="450" y="${y - 13}" width="180" height="17" rx="3" fill="${prochaine ? "#fef3c7" : k % 2 ? "#f8fafc" : "#fff"}"/>`;
      r += texte(456, y, libT(t), `style="font-size:10.5px;font-weight:700;fill:${m ? "#0f172a" : "#94a3b8"}"`);
      r += texte(626, y, m ? fd(m.rho, 4) : prochaine ? "à venir" : "—", `text-anchor="end" style="font-size:10.5px;font-weight:700;fill:${m ? BLEU : "#94a3b8"}"`);
    });
    svgEl.querySelector(".dyn-droite").innerHTML = r;
    // ── Afficheurs ──
    const D = agite ? NaN : Dz(HR(rhoNow), e.t);
    c.lectures.innerHTML = lectures([
      ["Temps", agite ? "—" : duree(e.t), ""],
      ["Lecture R", agite ? "—" : fd(rhoNow, 4), "Mg/m³"],
      ["Profondeur Hr", agite ? "—" : fd(HR(rhoNow) * 100, 1), "cm"],
      ["D au niveau du bulbe", Number.isFinite(D) ? f(D * 1000, 3) : "—", "µm"],
      ["% < D (fraction fine)", agite ? "100" : fd(pourcentageSedimento({ rhoLu: rhoNow, rhoEau: e.temoin, V, ms: MS, rhoS: e.rhoS }), 1), "%"],
    ]) + `<p class="banc-etat">${etat()}</p>`;
    loupe(...vueLoupe(tH, rhoNow));
  }

  /** Teinte de la suspension pour une concentration relative C (0 : eau claire, 1 : suspension de départ). */
  const trouble = (C) => melange("#e8f4fb", e.teintes.suspension, 0.06 + 0.94 * C ** 1.6);
  const libT = (t) => (t < 60 ? `${t} s` : t < 3600 ? `${t / 60} min` : `${t / 3600} h`);
  function chrono(t) {
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = Math.floor(t % 60);
    return `${h} h ${String(m).padStart(2, "0")} min ${String(s).padStart(2, "0")} s`;
  }
  function etat() {
    if (e.phase === "agitation") return "retournements de l'éprouvette bouchée, une minute";
    if (e.fini) return "essai terminé : dix lectures en 24 h";
    const v = Number(c.corps.querySelector("[data-vitesse].actif")?.dataset.vitesse ?? 10) * Math.max(1, e.t / T0);
    return `décantation — prochaine lecture à ${libT(LECTURES[e.i])} (temps accéléré ×${f(v, 2)})`;
  }

  // ── Loupe : autour du bulbe, chaque grain tombe à sa vitesse de Stokes ──
  function vueLoupe(tH, rhoNow) {
    const agite = e.phase === "agitation";
    const Dt = agite ? Infinity : Dz(HR(rhoNow), e.t) * 1000; // µm
    let s = `<rect width="${WL}" height="${HL}" fill="${melange("#eaf6fd", e.teintes.suspension, agite ? 0.55 : 0.1 + 0.5 * F(Dt / 1000))}"/>`;
    // Le bulbe : sa paroi de verre à gauche.
    if (!agite) s += `<path d="M0 0H34Q46 84 34 ${HL}H0Z" fill="#f1f5f9" fill-opacity=".9" stroke="#475569" stroke-width="1.4"/>` + `<path d="M20 10Q28 84 20 158" stroke="#fff" stroke-width="3" fill="none" opacity=".8"/>`;
    let legendeVitesse = "";
    CLASSES.forEach(([hi, lo], j) => {
      const Dm = Math.sqrt(hi * lo), masse = F(hi / 1000) - F(lo / 1000);
      const present = Dt >= hi ? 1 : Dt <= lo ? 0 : (F(Dt / 1000) - F(lo / 1000)) / Math.max(1e-9, masse);
      const nb = Math.round(Math.min(26, 80 * masse * present));
      const v = ((e.rhoS - 1) * 1000 * 9.81 * (Dm * 1e-6) ** 2) / (18 * e.eta); // m/s
      const vpx = agite ? 40 : v * 1000 * 22; // 22 px par mm : vitesse figurée
      const r = 0.7 + 0.42 * Math.sqrt(Dm);
      for (let q = 0; q < nb; q++) {
        const x = 50 + hasard(j, q, 1) * 120, y0 = hasard(j, q, 2) * (HL + 20);
        const y = agite ? (y0 + 60 * Math.sin(tH * 3 + q + j)) % (HL + 20) : (y0 + vpx * tH) % (HL + 20);
        s += `<circle cx="${r1(x + (agite ? 8 * Math.sin(tH * 2 + q) : 0))}" cy="${r1(y - 10)}" r="${r1(r)}" fill="${e.teintes.sombre}"/>`;
      }
      if (!agite && nb > 0 && !legendeVitesse) legendeVitesse = `${f(Dm, 2)} µm : ${v * 1000 >= 0.01 ? `${f(v * 1000, 2)} mm/s` : `${f(v * 1e6, 2)} µm/s`}`;
    });
    if (!agite) {
      s += etiquette(46, 14, `au bulbe : D = ${f(Dt, 3)} µm`, { couleur: COULEURS.effort, taille: 9.5 });
      if (legendeVitesse) s += fleche(160, 128, 160, 156, BLEU, 1.6, 5) + etiquette(154, 150, legendeVitesse, { ancre: "end", couleur: BLEU, taille: 9.5 });
      s += etiquette(6, HL - 8, "bulbe", { taille: 9.5 });
    }
    const legende = agite ? "agitation : tous les grains sont en suspension"
      : e.t === 0 ? "départ : la suspension est encore homogène"
        : e.fini ? `24 h : il ne reste au niveau du bulbe que les grains de moins de ${f(Dt, 2)} µm`
          : `à ${duree(e.t)}, les grains de plus de ${f(Dt, 2)} µm sont passés sous le bulbe ; les plus fins tombent à peine`;
    return [s, legende];
  }

  // ── Courbe et tableau ────────────────────────────────────────────────────
  /** Courbe complète : tamisage (catalogue, d ≥ 63 µm) raccordé aux lectures (rapportées au sol entier). */
  const courbeComplete = () => [...e.mesures.map((m) => [m.D, m.P]), ...e.sol.granulo.filter(([d]) => d >= 0.063)];
  function dessinerLent() {
    const cle = `${e.cle}|${e.T}|${e.mesures.length}`;
    if (cle === e.cleCourbe) return;
    e.cleCourbe = cle;
    const zone = c.courbes.querySelector(".dyn-courbe"), tab = c.courbes.querySelector(".dyn-tableau");
    if (!zone) return;
    const xmax = Math.max(2, e.sol.granulo.find(([, p]) => p >= 99.95)?.[0] ?? 2) * 1.2;
    const marques = [];
    if (e.fini) {
      const a = analyser(courbeComplete()), p2 = passant(courbeComplete(), 0.002);
      if (Number.isFinite(a.D10)) marques.push({ x: a.D10, y: 10, couleur: COULEURS.violet, guides: true, libelle: `D10 = ${f(a.D10 * 1000, 2)} µm` });
      if (Number.isFinite(p2)) marques.push({ x: 0.002, y: p2, couleur: COULEURS.effort, guides: true, libelle: `< 2 µm : ${fd(p2, 1)} %` });
      marques.push({ x: 0.063, y: e.p63, couleur: COULEURS.gtr24, rayon: 4, libelle: `raccord à 63 µm : ${fd(e.p63, 0)} %` });
    }
    zone.innerHTML = graphe({
      largeur: 560, hauteur: 300, xmin: 0.0005, xmax, logX: true, ymin: 0, ymax: 100, pasY: 20,
      xlabel: "diamètre D (mm, échelle logarithmique)", ylabel: "passant cumulé (% du sol)",
      series: [
        { points: e.sol.granulo.filter(([d]) => d >= 0.063), couleur: COULEURS.discret, epaisseur: 1.8, marqueurs: true, tirets: "5 3", libelle: "tamisage (≥ 63 µm)" },
        { points: e.mesures.map((m) => [m.D, m.P]), couleur: COULEURS.bleu, epaisseur: 2.2, marqueurs: true, libelle: "sédimentométrie (lectures du densimètre)" },
      ],
      zones: [
        { x0: 0.0005, x1: 0.002, y0: 0, y1: 100, couleur: "#a16207", opacite: 0.1, libelle: "argiles" },
        { x0: 0.002, x1: 0.063, y0: 0, y1: 100, couleur: "#94a3b8", opacite: 0.08, libelle: "silts", position: "droite" },
      ],
      marques,
    });
    if (!e.mesures.length) { tab.innerHTML = '<p class="method-note">Chaque lecture du densimètre s\'inscrit dans le tableau et sur la courbe.</p>'; return; }
    const lignes = e.mesures.map((m) => `<tr><td class="n">${libT(m.t)}</td><td class="n">${fd(m.rho, 4)}</td><td class="n">${fd(m.Hr * 100, 1)}</td><td class="n">${f(m.D, 3)}</td><td class="n">${fd(m.Pf, 1)}</td><td class="n">${fd(m.P, 1)}</td></tr>`).join("");
    tab.innerHTML = `<div class="table-large"><table class="resultats"><thead><tr><th class="num">t</th><th class="num">Lecture R</th><th class="num">H<sub>r</sub> (cm)</th><th class="num">D (mm)</th><th class="num">% &lt; D (fines)</th><th class="num">% &lt; D (sol)</th></tr></thead><tbody>${lignes}</tbody></table></div>
      <p class="method-note">Témoin (eau et défloculant, même bain) : R<sub>témoin</sub> = ${fd(e.temoin, 4)}, que l'on retranche de chaque lecture ; viscosité de l'eau à ${f(e.T, 3)} °C : η = ${fd(e.eta * 1000, 3)} mPa·s.</p>`;
  }

  function bilan() {
    const pts = courbeComplete(), a = analyser(pts), p2 = passant(pts, 0.002);
    const r = classerSol({ Dmax: a.Dmax, p63um: a.p63um, p2mm: a.p2mm, Cu: a.Cu, D60: a.D60, D10: a.D10, fractionSable: a.fractionSable, fractionGrave: a.fractionGrave });
    const fam = r.applicable ? r.classeFraction : a.p63um > 35 ? "F" : "I";
    const Dmin = e.mesures.at(-1).D;
    const d10 = Number.isFinite(a.D10) ? `D10 = <strong>${f(a.D10 * 1000, 2)} µm</strong> ⇒ Cu = D60/D10 = <strong>${a.Cu < 100 ? fd(a.Cu, 1) : f(a.Cu, 3)}</strong> (D60 = ${a.D60 < 0.063 ? `${f(a.D60 * 1000, 2)} µm` : `${f(a.D60, 2)} mm`})`
      : `D10 n'est pas atteint : plus de 10 % du sol reste plus fin que ${f(Dmin * 1000, 2)} µm après 24 h, Cu reste indéterminé`;
    let sens;
    if (fam === "F" || fam === "I") sens = `Pour un sol ${fam === "F" ? "fin F" : "intermédiaire I"}, le GTR 2024 ne se sert pas de Cu : c'est la VBS (ou l'IP) qui fixera la sous-classe ; la sédimentométrie mesure la quantité d'argile, dont la VBS dit à la fois la quantité et l'activité.`;
    else {
      const et = etalement({ Cu: a.Cu, D60: a.D60 });
      sens = `Avec ${fd(a.p63um, 0)} % de fines, D10 tombe sous 63 µm : sans sédimentométrie, le GTR 2024 se contente de D60 ≥ 400 µm pour réputer la courbe étalée ; ici ${et.motif} ${et.etalee ? "le confirme" : "la dit uniforme"} : <strong>${r.sousClasse}</strong>.`;
    }
    c.bilan.innerHTML = `<p class="final-result">${d10} ; fraction argileuse (&lt; 2 µm) = <strong>${fd(p2, 1)} %</strong> du sol. ${sens}
        <small>Sédimentométrie au densimètre selon la NF EN ISO 17892-4. À ${f(e.T, 3)} °C, η = ${fd(e.eta * 1000, 3)} mPa·s : une autre température change les lectures et le plus fin diamètre atteint en 24 h, pas la courbe, dès lors qu'on corrige la viscosité. Le tamisage du même sol fournit le raccord à 63 µm.</small></p>`;
  }

  b = boucle({ avancer, dessiner, dessinerLent, surFin: () => { dessinerLent(); bilan(); }, surEtat: () => etatBoutons?.() });
  etatBoutons = brancherMarche(c, b, reinit);
  c.commandes.querySelectorAll("select, input").forEach((x) => x.addEventListener("change", () => { b.raz(); reinit(); etatBoutons(); }));
  reinit();
  etatBoutons();
}
