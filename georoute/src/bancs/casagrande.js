// Banc d'essai : les limites d'Atterberg (chapitre 2). On choisit la méthode —
// coupelle de Casagrande ou cône de pénétration (80 g, 30°) — et le sol ; la
// fraction 0/400 µm, gâchée en pâte, est essayée à quatre teneurs en eau
// croissantes. À la coupelle, la manivelle soulève la coupelle de 10 mm et la
// laisse retomber deux fois par seconde : on compte les chocs jusqu'à ce que
// la rainure se referme sur 1 cm. Au cône, la pointe, lâchée au contact de la
// pâte, s'enfonce pendant 5 s ; on lit l'enfoncement au comparateur, deux fois
// par teneur en eau. Chaque fois, une prise de pâte donne la teneur en eau ; la
// droite w – lg N donne wL à 25 coups, la droite w – enfoncement wL à 20 mm.
// Puis la limite de plasticité : on roule la pâte en rouleaux de 3 mm, qu'on
// reforme et roule à nouveau jusqu'à ce qu'ils se fissurent à 3 mm (deux
// essais, moyenne). wL, wP, IP, Ic et la place du sol sur l'abaque de
// Casagrande en sortent (NF EN ISO 17892-12).
//
// Modèle : la courbe d'écoulement du sol est la droite w = wL − If lg(N/25),
// d'autant plus pentue que le sol est plastique (If ≈ 0,4 IP + 2,5) ; au cône,
// la teneur en eau croît linéairement avec l'enfoncement autour de 20 mm. Les
// quatre teneurs en eau visent 15 à 35 coups (15 à 25 mm) ; le nombre de
// coups, entier, l'enfoncement et les pesées portent une petite erreur
// reproductible. wL et wP vrais sont ceux du catalogue des matériaux.
import { svg, texte, COULEURS, graphe } from "../figures.js";
import { SOLS } from "./materiaux.js";
import { analyser, passant } from "../gtr/granulo.js";
import { wLCasagrande, wLCone, atterberg, abaqueCasagrande } from "../gtr/identification.js";
import { classerSol, etatHydrique, cleEtats, ETATS_2024, enClair, SEUILS_2024 } from "../gtr/classification.js";
import { charpente, boucle, brancherMarche, lectures, fd, r1, esc, duree } from "./moteur.js";
import { fenetreLoupe, etiquette, fleche, choc, horloge, W as WL, H as HL, ACIER, ACIER_SOMBRE, ROUGE } from "./loupe.js";
import { bruit, hasard, teintesSol, paillasse, barreEchelle, teneurEau0400 } from "./identification-dessin.js";

const CHOIX = ["limon", "sableArgileux", "argile"];
const DUREES = { malaxage: 40, remplissage: 15, prelevement: 12, rouleau: 60, chute: 5, lecture: 6, recharge: 8 }; // s
const N_VISES = [33, 27, 21, 16], P_VISES = [15.5, 18.5, 21.5, 24.5]; // coups, mm
const METHODES = { coupelle: "coupelle de Casagrande", cone: "cône de pénétration (80 g, 30°)" };

export function monter(banc) {
  const c = charpente(banc, {
    vitesse: 10, vitesses: [1, 10, 50],
    commandes: `
      <div class="field"><label>Méthode (limite de liquidité)</label><div class="input-wrap"><select data-r="methode">${Object.entries(METHODES).map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join("")}</select></div></div>
      <div class="field"><label>Sol (fraction 0/400 µm)</label><div class="input-wrap"><select data-r="sol">${CHOIX.map((k) => `<option value="${k}">${esc(SOLS[k].nom)}</option>`).join("")}</select></div></div>`,
  });
  const loupe = fenetreLoupe(c, "la pâte au travail");
  let e, b, etatBoutons;

  const reinit = () => {
    const cle = c.q('[data-r="sol"]').value, sol = SOLS[cle], methode = c.q('[data-r="methode"]').value;
    const g = CHOIX.indexOf(cle) * 7 + (methode === "cone" ? 3 : 1);
    const IP = sol.wL - sol.wP, If = 0.4 * IP + 2.5, Kc = 0.035 * IP + 0.35;
    // Les quatre points de la limite de liquidité : teneur en eau de la pâte, réponse de l'appareil.
    const points = [0, 1, 2, 3].map((i) => {
      if (methode === "coupelle") {
        const w = sol.wL - If * Math.log10(N_VISES[i] / 25) + 0.25 * bruit(i, g);
        const N = Math.round(25 * 10 ** ((sol.wL - w) / If));
        return { N, w: Math.round((w + 0.12 * bruit(i + 10, g)) * 10) / 10 };
      }
      const w = sol.wL + Kc * (P_VISES[i] - 20) + 0.2 * bruit(i, g);
      const p0 = 20 + (w - sol.wL) / Kc;
      const p1 = Math.round((p0 + 0.2 * bruit(i + 20, g)) * 10) / 10, p2 = Math.round((p0 + 0.2 * bruit(i + 30, g)) * 10) / 10;
      return { p1, p2, p: (p1 + p2) / 2, w: Math.round((w + 0.12 * bruit(i + 10, g)) * 10) / 10 };
    });
    const wP = [0, 1].map((j) => Math.round((sol.wP + 0.35 * bruit(j + 40, g)) * 10) / 10);
    // Suite des étapes : quatre teneurs en eau, puis deux rouleaux.
    const etapes = [];
    points.forEach((pt, i) => {
      etapes.push({ type: "malaxage", i, d: DUREES.malaxage }, { type: "remplissage", i, d: DUREES.remplissage });
      if (methode === "coupelle") etapes.push({ type: "chocs", i, d: pt.N / 2 });
      else etapes.push({ type: "chute", i, k: 0, d: DUREES.chute }, { type: "lecture", i, k: 0, d: DUREES.lecture }, { type: "recharge", i, d: DUREES.recharge },
        { type: "chute", i, k: 1, d: DUREES.chute }, { type: "lecture", i, k: 1, d: DUREES.lecture });
      etapes.push({ type: "prelevement", i, d: DUREES.prelevement });
    });
    etapes.push({ type: "rouleau", j: 0, d: DUREES.rouleau }, { type: "rouleau", j: 1, d: DUREES.rouleau });
    e = {
      cle, sol, methode, g, IP, If, Kc, points, wP, etapes, teintes: teintesSol(sol),
      k: 0, tp: 0, t: 0, faits: [], lusP: [], wPlus: [], fini: false, cleCourbe: "",
    };
    c.scene.innerHTML = fond();
    c.courbes.innerHTML = '<div class="dyn-wl"></div><div class="dyn-abaque"></div>';
    c.bilan.innerHTML = "";
    dessiner(); dessinerLent();
  };

  const etape = () => e.etapes[Math.min(e.k, e.etapes.length - 1)];
  const avancer = (dt) => {
    if (e.fini) return false;
    let reste = dt;
    while (reste > 1e-9 && !e.fini) {
      const x = etape(), h = Math.min(reste, x.d - e.tp);
      e.tp += h; e.t += h; reste -= h;
      if (e.tp < x.d - 1e-9) continue;
      // Fin d'étape : on note ce qu'elle a donné.
      if (x.type === "lecture") e.lusP.push({ i: x.i, k: x.k, p: x.k ? e.points[x.i].p2 : e.points[x.i].p1 });
      if (x.type === "prelevement") e.faits.push(x.i);
      if (x.type === "rouleau") e.wPlus.push(e.wP[x.j]);
      e.k++; e.tp = 0;
      if (e.k >= e.etapes.length) { e.fini = true; e.k = e.etapes.length - 1; e.tp = etape().d; }
    }
    return !e.fini;
  };

  // ── Dessin ──────────────────────────────────────────────────────────────
  function fond() {
    return svg({
      largeur: 640, hauteur: 404, titre: e.methode === "coupelle" ? "Coupelle de Casagrande, pesées et rouleaux de plasticité" : "Cône de pénétration, pesées et rouleaux de plasticité", contenu: () => {
        let s = paillasse(0, 640, 384);
        s += texte(175, 24, METHODES[e.methode], 'text-anchor="middle" style="font-size:11px;font-weight:800;fill:#334155"');
        // Plaque de verre du malaxage, tares, plaque des rouleaux.
        s += `<rect x="352" y="40" width="268" height="62" rx="4" fill="#e0f2fe" opacity=".7" stroke="#94a3b8"/>`;
        s += texte(486, 32, "malaxage sur plaque de verre", 'text-anchor="middle" style="font-size:10.5px;font-weight:700;fill:#475569"');
        s += texte(486, 132, "prises de pâte pour la teneur en eau", 'text-anchor="middle" style="font-size:10.5px;font-weight:700;fill:#475569"');
        s += `<rect x="352" y="300" width="268" height="54" rx="4" fill="#e0f2fe" opacity=".7" stroke="#94a3b8"/>`;
        s += texte(486, 292, "limite de plasticité : rouleaux de 3 mm", 'text-anchor="middle" style="font-size:10.5px;font-weight:700;fill:#475569"');
        s += `<g class="dyn-appareil"></g><g class="dyn-droite"></g>`;
        return s;
      },
    });
  }

  /** Nombre de chocs déjà donnés dans l'étape en cours : le compteur avance quand la coupelle frappe le socle (à 90 % du tour). */
  const chocsDonnes = () => (etape().type === "chocs" ? Math.min(e.points[etape().i].N, Math.floor(e.tp * 2 + 0.1)) : 0);
  /** Enfoncement (mm) de la pointe du cône à l'instant présent. */
  function enfoncement() {
    const x = etape();
    if (e.methode !== "cone" || x.i === undefined) return 0;
    const pt = e.points[x.i], pk = x.k ? pt.p2 : pt.p1;
    if (x.type === "chute") return pk * (1 - Math.exp(-e.tp / 0.35)) / (1 - Math.exp(-DUREES.chute / 0.35));
    if (x.type === "lecture") return pk;
    return 0;
  }

  function dessinerCoupelle() {
    const x = etape(), enChocs = x.type === "chocs";
    const N = enChocs ? e.points[x.i].N : 0, n = chocsDonnes();
    // Came : la coupelle monte de 10 mm sur 82 % du tour, puis retombe et frappe le socle.
    const phi = enChocs ? (e.tp * 2) % 1 : 0, LEV = 16; // 10 mm à 1,6 px par mm
    const lev = !enChocs || n >= N ? 0 : phi < 0.82 ? LEV * (phi / 0.82) : phi < 0.9 ? LEV * (1 - ((phi - 0.82) / 0.08) ** 2) : 0;
    const impact = enChocs && n < N && phi >= 0.9 && phi < 0.97;
    const P = [80, 238], th = (-Math.atan(lev / 146) * 180) / Math.PI; // pivot de la coupelle, rotation (degrés)
    let s = `<rect x="56" y="330" width="254" height="54" rx="4" fill="#1f2937"/>` + texte(183, 362, "socle en ébonite", 'text-anchor="middle" style="font-size:10.5px;font-weight:700;fill:#e2e8f0"');
    s += `<rect x="72" y="230" width="16" height="100" fill="#94a3b8" stroke="#475569"/>`;
    // Came en colimaçon et manivelle, sur le même arbre.
    const ang = enChocs && n < N ? e.tp * 2 * 2 * Math.PI : 0, C = [116, 296];
    const pc = came(C[0], C[1], ang), yHautCame = Math.min(...pc.pts.map((q) => q[1]));
    s += `<path d="${pc.d}" fill="#94a3b8" stroke="#334155" stroke-width="1.2"/>`;
    // Coupelle, suspendue au pivot par sa potence ; elle tourne de quelques degrés quand la came la soulève.
    let g = `<path d="M${P[0]} ${P[1]}H150V286" fill="none" stroke="#64748b" stroke-width="5" stroke-linejoin="round"/>`;
    g += `<path d="M116 ${P[1]}V${r1(yHautCame + lev * 0.22)}" stroke="#64748b" stroke-width="3"/>`;
    g += `<path d="M150 287A76 42 0 0 0 302 287Z" fill="#d6b25e" stroke="#92400e" stroke-width="1.5"/>`;
    const pate = x.i !== undefined && x.type !== "malaxage" && x.type !== "rouleau";
    if (pate) {
      const ferme = enChocs ? Math.min(1, (n / N) ** 2) : x.type === "prelevement" ? 1 : 0, ecart = 9 * ferme;
      g += `<path d="M162 291Q226 297 290 291L282 301Q226 322 170 301Z" fill="${e.teintes.grain}"/>`;
      if (x.type !== "remplissage" || e.tp > DUREES.remplissage * 0.6) g += `<path d="M172 295Q${r1(199 - ecart)} 298 ${r1(226 - ecart)} 299" stroke="#5b3a1a" stroke-width="1.6" fill="none"/><path d="M${r1(226 + ecart)} 299Q${r1(253 + ecart)} 298 280 295" stroke="#5b3a1a" stroke-width="1.6" fill="none"/>`;
    }
    s += `<g transform="rotate(${th.toFixed(2)} ${P[0]} ${P[1]})">${g}</g>`;
    s += `<circle cx="${P[0]}" cy="${P[1]}" r="5" fill="#334155"/>`;
    s += `<circle cx="${C[0]}" cy="${C[1]}" r="5" fill="#334155"/><path d="M${C[0]} ${C[1]}L${r1(C[0] + 24 * Math.cos(ang + 2))} ${r1(C[1] + 24 * Math.sin(ang + 2))}" stroke="#334155" stroke-width="3.4" stroke-linecap="round"/>`;
    s += `<circle cx="${r1(C[0] + 24 * Math.cos(ang + 2))}" cy="${r1(C[1] + 24 * Math.sin(ang + 2))}" r="4.5" fill="${COULEURS.effort}"/>`;
    s += texte(66, 300, "manivelle", 'text-anchor="end" style="font-size:10px;font-weight:700;fill:#475569"');
    if (impact) s += choc(226, 326, 12);
    // Levée de 10 mm, repérée au bord avant de la coupelle.
    s += `<path d="M314 ${287 - LEV}h10M314 287h10M319 ${287 - LEV}V287" stroke="${lev > 1 ? COULEURS.cote : "#94a3b8"}" stroke-width="1.2"/>`;
    s += texte(328, 284, "10 mm", `style="font-size:10px;font-weight:700;fill:${lev > 1 ? COULEURS.cote : "#94a3b8"}"`);
    // Compteur de coups.
    s += `<rect x="40" y="58" width="96" height="40" rx="6" fill="#0f172a"/>` + texte(88, 74, "coups", 'text-anchor="middle" style="font-size:10px;fill:#94a3b8"');
    s += texte(88, 92, enChocs ? String(n) : x.type === "prelevement" ? String(e.points[x.i].N) : "0", 'text-anchor="middle" style="font-family:ui-monospace,Consolas,monospace;font-size:15px;font-weight:800;fill:#67e8f9"');
    s += texte(236, 254, "coupelle en laiton", 'text-anchor="middle" style="font-size:10px;font-weight:700;fill:#92400e"');
    return s;
  }

  /** Came en colimaçon (profil de la levée), centrée en (x, y), tournée de a. */
  function came(x, y, a) {
    const pts = [];
    for (let k = 0; k <= 24; k++) {
      const u = k / 24, r = 7 + 9 * u, t = a + u * 2 * Math.PI;
      pts.push([x + r * Math.cos(t), y + r * Math.sin(t)]);
    }
    return { pts, d: `${pts.map(([px, py], k) => `${k ? "L" : "M"}${r1(px)} ${r1(py)}`).join("")}Z` };
  }

  function dessinerCone() {
    const x = etape(), p = enfoncement(), kp = 2.4; // px par mm
    const yS = 276; // surface de la pâte, au ras de la coupelle
    let s = `<rect x="62" y="372" width="236" height="12" rx="3" fill="#475569"/>`;
    s += `<rect x="86" y="96" width="12" height="276" fill="#94a3b8" stroke="#64748b"/>`;
    s += `<rect x="86" y="124" width="120" height="16" rx="3" fill="#64748b"/><rect x="186" y="116" width="38" height="30" rx="4" fill="#475569"/>`;
    s += `<circle cx="238" cy="131" r="6" fill="${x.type === "chute" ? COULEURS.effort : "#cbd5e1"}" stroke="#334155"/>` + texte(250, 135, "déclencheur", 'style="font-size:10px;font-weight:700;fill:#475569"');
    const pleine = x.i !== undefined && !["malaxage", "rouleau"].includes(x.type) && !(x.type === "remplissage" && e.tp < DUREES.remplissage * 0.4);
    // Cône de 80 g, 30° : il descend de p mm sous la surface.
    const yPointe = yS + p * kp, hC = 35 * kp, lC = Math.tan((15 * Math.PI) / 180) * hC;
    s += `<rect x="202" y="${r1(106 + p * kp)}" width="6" height="${r1(yPointe - hC - 106 - p * kp)}" fill="${ACIER}" stroke="${ACIER_SOMBRE}"/>`;
    s += `<path d="M${r1(205 - lC)} ${r1(yPointe - hC)}H${r1(205 + lC)}L205 ${r1(yPointe)}Z" fill="#cbd5e1" stroke="#334155" stroke-width="1.3"/>`;
    s += `<rect x="${r1(205 - lC - 3)}" y="${r1(yPointe - hC - 8)}" width="${r1(2 * lC + 6)}" height="8" rx="2" fill="#64748b"/>`;
    // Coupelle (Ø 55 mm, profondeur 40 mm) pleine de pâte arasée.
    s += `<rect x="139" y="${yS}" width="132" height="96" fill="#cbd5e1" stroke="#475569" stroke-width="1.4"/>`;
    if (pleine) {
      s += `<rect x="142" y="${yS + 1}" width="126" height="92" fill="${e.teintes.grain}" opacity=".9"/>`;
      if (p > 0.5) s += `<path d="M${r1(205 - Math.tan(Math.PI / 12) * p * kp)} ${yS + 1}L205 ${r1(yPointe)}L${r1(205 + Math.tan(Math.PI / 12) * p * kp)} ${yS + 1}Z" fill="#cbd5e1" stroke="#334155" opacity=".75"/>`;
    }
    // Comparateur : un tour d'aiguille pour 10 mm.
    const a = ((p / 10) * 360 - 90) * (Math.PI / 180), yD = 74;
    s += `<rect x="201" y="${yD + 22}" width="8" height="${116 - yD - 22}" fill="#94a3b8"/><circle cx="205" cy="${yD}" r="22" fill="#fff" stroke="#334155" stroke-width="2"/>`;
    for (let j = 0; j < 10; j++) { const t2 = (j * 36 * Math.PI) / 180; s += `<path d="M${r1(205 + 17 * Math.sin(t2))} ${r1(yD - 17 * Math.cos(t2))}L${r1(205 + 21 * Math.sin(t2))} ${r1(yD - 21 * Math.cos(t2))}" stroke="#334155"/>`; }
    s += `<path d="M205 ${yD}L${r1(205 + 17 * Math.cos(a))} ${r1(yD + 17 * Math.sin(a))}" stroke="${COULEURS.effort}" stroke-width="2"/><circle cx="205" cy="${yD}" r="2.5" fill="#334155"/>`;
    s += texte(234, yD - 4, "comparateur", 'style="font-size:10px;font-weight:700;fill:#475569"') + texte(234, yD + 12, `${fd(p, 1)} mm`, `style="font-size:11px;font-weight:800;fill:${COULEURS.effort}"`);
    if (x.type === "chute" && e.tp < DUREES.chute) s += texte(234, 236, `chute libre : ${fd(Math.min(5, e.tp), 1)} s / 5 s`, `class="halo" style="font-size:10.5px;font-weight:700;fill:${COULEURS.effort}"`);
    return s;
  }

  function dessiner() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    const tH = horloge(), x = etape();
    svgEl.querySelector(".dyn-appareil").innerHTML = e.methode === "coupelle" ? dessinerCoupelle() : dessinerCone();
    // ── À droite : malaxage, tares, rouleaux ──
    let r = "";
    const malaxe = x.type === "malaxage" && !e.fini;
    r += `<ellipse cx="452" cy="74" rx="${malaxe ? 46 : 34}" ry="12" fill="${e.teintes.grain}" opacity="${x.type === "rouleau" ? 0.5 : 1}"/>`;
    if (malaxe) {
      const sx = 452 + 34 * Math.sin(tH * 5);
      r += `<path d="M${r1(sx)} 70l58 -22" stroke="#64748b" stroke-width="4" stroke-linecap="round"/><path d="M${r1(sx - 6)} 72l14 -4" stroke="#94a3b8" stroke-width="7" stroke-linecap="round"/>`;
      // Pissette : quelques gouttes d'eau au début du malaxage.
      if (e.tp < 10 && x.i > 0) for (let q = 0; q < 3; q++) { const p2 = (tH * 1.5 + q / 3) % 1; r += `<circle cx="${r1(560 - 30 * p2)}" cy="${r1(50 + 22 * p2)}" r="2" fill="${COULEURS.eau}"/>`; }
      if (x.i > 0) r += `<path d="M574 44l14 -6v26h-14z" fill="#bfdbfe" stroke="#1d4ed8"/>` + texte(596, 94, "+ eau", 'text-anchor="middle" style="font-size:10px;font-weight:700;fill:#1d4ed8"');
    }
    // Tares : une par teneur en eau.
    e.points.forEach((pt, i) => {
      const xc = 384 + i * 68, fait = e.faits.includes(i), cour = x.i === i && !e.fini && x.type !== "rouleau";
      r += `<path d="M${xc - 24} 160h48l-5 16h-38z" fill="${fait ? "#e2e8f0" : "#f1f5f9"}" stroke="${cour ? COULEURS.effort : "#64748b"}" stroke-width="${cour ? 1.8 : 1.1}"/>`;
      if (fait || (cour && x.type === "prelevement" && e.tp > 4)) r += `<ellipse cx="${xc}" cy="161" rx="13" ry="4" fill="${e.teintes.grain}"/>`;
      r += texte(xc, 154, `n° ${i + 1}`, 'text-anchor="middle" style="font-size:10px;font-weight:700;fill:#64748b"');
      const rep = e.methode === "coupelle" ? (fait || (x.i === i && (x.type === "prelevement")) ? `N = ${pt.N}` : x.i === i && x.type === "chocs" ? `N = ${chocsDonnes()}` : "")
        : e.lusP.filter((l) => l.i === i).length ? `p = ${fd(fait ? pt.p : e.lusP.filter((l) => l.i === i).at(-1).p, 1)}` : "";
      if (rep) r += texte(xc, 194, rep, 'text-anchor="middle" style="font-size:10.5px;font-weight:700;fill:#0f172a"');
      if (fait) r += texte(xc, 210, `w = ${fd(pt.w, 1)} %`, `text-anchor="middle" style="font-size:10.5px;font-weight:800;fill:${COULEURS.bleu}"`);
    });
    if (e.methode === "cone") r += texte(486, 228, "p en mm (moyenne de deux chutes)", 'text-anchor="middle" style="font-size:10px;fill:#64748b"');
    // Rouleaux : le diamètre diminue sous la paume ; au dernier passage, le rouleau se fissure à 3 mm.
    const roule = x.type === "rouleau" && !e.fini;
    const ro = rouleau();
    if (x.type === "rouleau" || e.fini) {
      const d = ro.d * 5, xa = 462, xb = 604, yc = 330;
      r += `<rect x="${xa}" y="${r1(yc - d / 2)}" width="${xb - xa}" height="${r1(d)}" rx="${r1(d / 2)}" fill="${e.teintes.grain}" stroke="${e.teintes.sombre}" stroke-width=".8"/>`;
      if (ro.fissure > 0) for (let q = 0; q < 7; q++) { const xq = xa + 10 + q * 18; r += `<path d="M${xq} ${r1(yc - d / 2)}l3 ${r1(d * 0.45 * ro.fissure)}l-2 ${r1(d * 0.3 * ro.fissure)}" stroke="#451a03" stroke-width="1.2" fill="none"/>`; }
      if (roule) { const px = 533 + 30 * Math.sin(tH * 6); r += `<ellipse cx="${r1(px)}" cy="${r1(yc - d / 2 - 11)}" rx="40" ry="11" fill="#fcd9b8" stroke="#b45309" stroke-width="1.2" opacity=".92"/>`; }
      r += texte(533, 372, `diamètre du rouleau : ${fd(ro.d, 1)} mm`, 'text-anchor="middle" style="font-size:10.5px;font-weight:700;fill:#0f172a"');
    }
    e.wPlus.forEach((w, j) => { r += texte(360, 320 + j * 22, `wP${j + 1} = ${fd(w, 1)} %`, `style="font-size:10.5px;font-weight:800;fill:${COULEURS.bleu}"`); });
    svgEl.querySelector(".dyn-droite").innerHTML = r;
    // ── Afficheurs ──
    const wL = wLProvisoire();
    const lib = e.methode === "coupelle" ? ["Coups N", x.type === "chocs" ? String(chocsDonnes()) : x.i !== undefined && e.faits.includes(x.i) ? String(e.points[x.i].N) : "—", ""]
      : ["Enfoncement", e.methode === "cone" && (x.type === "chute" || x.type === "lecture") ? fd(enfoncement(), 1) : "—", "mm"];
    c.lectures.innerHTML = lectures([
      ["Temps d'essai", duree(e.t), ""],
      ["Teneur en eau", x.type === "rouleau" ? (roule ? "—" : fd(e.wPlus.at(-1), 1)) : x.i !== undefined && e.faits.length ? fd(e.points[e.faits.at(-1)].w, 1) : "—", "%"],
      lib,
      ["Rouleau", x.type === "rouleau" ? fd(ro.d, 1) : "—", "mm"],
      ["wL (droite)", Number.isFinite(wL) ? fd(wL, 1) : "—", "%"],
    ]) + `<p class="banc-etat">${libelle()}</p>`;
    loupe(...vueLoupe(tH));
  }

  /** État du rouleau en cours : diamètre (mm) et fissuration (0 → 1). Trois passages de 20 s, de 6 à 3 mm. */
  function rouleau() {
    const x = etape();
    if (x.type !== "rouleau") return { d: 3, fissure: 1, passe: 3 };
    const u = e.tp / 20, passe = Math.min(2, Math.floor(u)), v = Math.min(1, u - passe);
    const d = 6 - 3 * Math.min(1, v / 0.85);
    return { d, fissure: passe === 2 && v > 0.85 ? Math.min(1, (v - 0.85) / 0.12) : 0, passe };
  }

  /** wL de la droite tracée sur les points déjà pesés (solveur), ou NaN. */
  function wLProvisoire() {
    const pts = e.faits.map((i) => e.points[i]);
    if (pts.length < 2) return NaN;
    const r = e.methode === "coupelle" ? wLCasagrande(pts.map((p) => [p.N, p.w])) : wLCone(pts.map((p) => [p.p, p.w]));
    return r.applicable ? r.wL : NaN;
  }

  function libelle() {
    const x = etape();
    if (e.fini) return "essai terminé : wL, wP, IP";
    const n = `teneur en eau n° ${(x.i ?? 0) + 1}`;
    return {
      malaxage: x.i ? `${n} : on ajoute un peu d'eau et l'on malaxe` : `${n} : la pâte, imbibée la veille, est malaxée`,
      remplissage: e.methode === "coupelle" ? `${n} : pâte étalée dans la coupelle, rainure tracée à l'outil` : `${n} : coupelle remplie et arasée`,
      chocs: `${n} : deux chocs par seconde jusqu'à fermer la rainure sur 1 cm`,
      chute: `${n} : le cône tombe et s'enfonce pendant 5 s`,
      lecture: `${n} : lecture de l'enfoncement au comparateur`,
      recharge: `${n} : cône nettoyé, un peu de pâte ajoutée, arasée`,
      prelevement: `${n} : prise de pâte pesée pour la teneur en eau`,
      rouleau: `limite de plasticité, essai ${(x.j ?? 0) + 1} : rouleau de 3 mm`,
    }[x.type];
  }

  // ── Loupe : la rainure vue de dessus, la pointe du cône, ou le rouleau ──
  function vueLoupe(tH) {
    const x = etape();
    if (x.type === "rouleau" || (e.fini && e.wPlus.length)) {
      // Rouleau à l'échelle : 14 px par mm ; jauge de 3 mm à côté.
      const ro = rouleau(), k = 14, d = ro.d * k, yc = 92;
      let s = `<rect width="${WL}" height="${HL}" fill="#e0f2fe"/>`;
      s += `<rect x="-6" y="${r1(yc - d / 2)}" width="${WL + 12}" height="${r1(d)}" rx="${r1(d / 2)}" fill="${e.teintes.grain}" stroke="${e.teintes.sombre}" stroke-width="1.2"/>`;
      for (let q = 0; q < 26; q++) s += `<path d="M${r1(hasard(q, 1) * WL)} ${r1(yc - d / 2 + 4 + hasard(q, 2) * (d - 8))}h${r1(4 + 5 * hasard(q, 3))}" stroke="${e.teintes.sombre}" stroke-width="1" opacity=".5"/>`;
      if (ro.fissure > 0) for (let q = 0; q < 5; q++) {
        const xq = 18 + q * 34, prof = d * (0.35 + 0.4 * hasard(q, 5)) * ro.fissure;
        s += `<path d="M${xq} ${r1(yc - d / 2)}l${r1(4 - 8 * hasard(q, 6))} ${r1(prof * 0.5)}l${r1(5 * hasard(q, 7))} ${r1(prof * 0.5)}" stroke="#451a03" stroke-width="2" fill="none"/>`;
        s += `<path d="M${xq + 10} ${r1(yc + d / 2)}l3 ${r1(-prof * 0.4)}" stroke="#451a03" stroke-width="1.6" fill="none"/>`;
      }
      s += `<path d="M150 ${r1(yc - 1.5 * k)}v${r1(3 * k)}" stroke="${COULEURS.cote}" stroke-width="1.4"/><path d="M146 ${r1(yc - 1.5 * k)}h8M146 ${r1(yc + 1.5 * k)}h8" stroke="${COULEURS.cote}" stroke-width="1.4"/>`;
      s += etiquette(146, r1(yc - 1.5 * k - 6), "3 mm", { ancre: "end", couleur: COULEURS.cote });
      if (x.type === "rouleau" && !e.fini && ro.fissure <= 0) s += fleche(70 + 30 * Math.sin(tH * 6), 30, 100 + 30 * Math.sin(tH * 6), 30, ROUGE, 1.8, 6);
      s += barreEchelle(k);
      const leg = e.fini || ro.fissure > 0.5 ? "à 3 mm, le rouleau se fissure : sa teneur en eau est wP"
        : ro.passe < 2 ? "à 3 mm le rouleau tient encore : on le reforme et on le roule à nouveau, il sèche" : "dernier passage : le rouleau approche de 3 mm";
      return [s, leg];
    }
    if (e.methode === "coupelle") {
      // Rainure vue de dessus : 5 px par mm ; elle se referme sur sa partie centrale.
      const k = 5, yc = 84, n = chocsDonnes(), N = x.type === "chocs" ? e.points[x.i].N : 1;
      const ferme = x.type === "chocs" ? Math.min(1, (n / N) ** 2) : x.type === "prelevement" ? 1 : 0;
      const L = 10 * k * ferme; // longueur refermée (px)
      let s = `<rect width="${WL}" height="${HL}" fill="${e.teintes.fond}"/>`;
      for (let q = 0; q < 46; q++) s += `<path d="M${r1(hasard(q, 1) * WL)} ${r1(hasard(q, 2) * HL)}h${r1(5 + 5 * hasard(q, 3))}" stroke="${e.teintes.grain}" stroke-width="1.2" opacity=".7"/>`;
      const avecRainure = !["malaxage"].includes(x.type) && !(x.type === "remplissage" && e.tp < DUREES.remplissage * 0.6);
      if (avecRainure) {
        // Bords de la rainure (pente des lèvres) puis fond : 2 mm de large, refermé sur L.
        let gauche = "", droite = "";
        for (let y = -4; y <= HL + 4; y += 4) {
          const dy = Math.abs(y - yc), cl = dy < L / 2 ? 1 : Math.max(0, 1 - (dy - L / 2) / 26) * ferme;
          const demi = (k * 1 * (1 - cl)) + 0.01;
          gauche += `${y === -4 ? "M" : "L"}${r1(WL / 2 - demi)} ${y}`;
          droite = `L${r1(WL / 2 + demi)} ${y}` + droite;
        }
        s += `<path d="M${WL / 2 - 27} -4H${WL / 2 + 27}V${HL + 4}H${WL / 2 - 27}Z" fill="${e.teintes.sombre}" opacity=".18"/>`;
        s += `<path d="${gauche}${droite}Z" fill="#7c5a3a"/>`;
        // Repères de 1 cm.
        s += `<path d="M${WL / 2 + 34} ${yc - 5 * k}h10M${WL / 2 + 34} ${yc + 5 * k}h10M${WL / 2 + 39} ${yc - 5 * k}V${yc + 5 * k}" stroke="${COULEURS.cote}" stroke-width="1.3"/>`;
        s += etiquette(WL / 2 + 47, yc + 4, "1 cm", { couleur: COULEURS.cote });
      }
      if (x.type === "chocs" && (e.tp * 2) % 1 >= 0.9) s += `<rect width="${WL}" height="${HL}" fill="none" stroke="${ROUGE}" stroke-width="4" opacity=".6"/>`;
      s += barreEchelle(k);
      const leg = x.type === "malaxage" ? "on gâche la pâte un peu plus humide" : x.type === "remplissage" ? (avecRainure ? "rainure de 2 mm tracée à l'outil, dans l'axe de la coupelle" : "pâte étalée et lissée : 10 mm d'épaisseur au centre")
        : x.type === "chocs" ? (n < N ? `choc n° ${n} : les lèvres de la rainure se rapprochent` : `${N} chocs : la rainure est fermée sur 1 cm`) : `rainure fermée sur 1 cm après ${e.points[x.i].N} coups`;
      return [s, leg];
    }
    // Cône : coupe à 4 px par mm, la pointe s'enfonce sous la surface.
    const k = 4, yS = 44, p = enfoncement();
    let s = `<rect width="${WL}" height="${HL}" fill="#f8fafc"/>`;
    const pleine = x.i !== undefined && !["malaxage"].includes(x.type);
    if (pleine) {
      s += `<rect x="0" y="${yS}" width="${WL}" height="${HL - yS}" fill="${e.teintes.fond}"/>`;
      for (let q = 0; q < 40; q++) s += `<path d="M${r1(hasard(q, 1) * WL)} ${r1(yS + 4 + hasard(q, 2) * (HL - yS))}h${r1(5 + 4 * hasard(q, 3))}" stroke="${e.teintes.grain}" stroke-width="1.2"/>`;
    }
    const yP = yS + p * k, hC = 35 * k, lC = Math.tan(Math.PI / 12) * hC, xc = 76;
    s += `<path d="M${r1(xc - lC)} ${r1(yP - hC)}H${r1(xc + lC)}L${xc} ${r1(yP)}Z" fill="#cbd5e1" stroke="#334155" stroke-width="1.4"/>`;
    s += `<path d="M${xc - 1} ${r1(yP - hC)}L${xc - 1} ${r1(yP - 2)}" stroke="#fff" stroke-width="2" opacity=".7"/>`;
    s += `<path d="M0 ${yS + 20 * k}H${WL}" stroke="${COULEURS.gtr24}" stroke-width="1.2" stroke-dasharray="5 3"/>` + etiquette(WL - 6, yS + 20 * k - 4, "20 mm", { ancre: "end", couleur: COULEURS.gtr24 });
    if (p > 0.3) s += `<path d="M${xc + 30} ${yS}V${r1(yP)}M${xc + 26} ${yS}h8M${xc + 26} ${r1(yP)}h8" stroke="${ROUGE}" stroke-width="1.4"/>` + etiquette(xc + 36, (yS + yP) / 2 + 4, `${fd(p, 1)} mm`, { couleur: ROUGE });
    s += barreEchelle(k);
    const leg = x.type === "chute" ? `le cône s'enfonce sous son poids : ${fd(p, 1)} mm` : x.type === "lecture" ? `enfoncement lu : ${fd(p, 1)} mm (wL correspond à 20 mm)`
      : x.type === "malaxage" ? "on gâche la pâte un peu plus humide" : "pointe posée au contact de la pâte arasée";
    return [s, leg];
  }

  // ── Courbes : droite de wL, abaque de plasticité ─────────────────────────
  function dessinerLent() {
    const cle = `${e.cle}|${e.methode}|${e.faits.length}|${e.wPlus.length}|${e.fini}`;
    if (cle === e.cleCourbe) return;
    e.cleCourbe = cle;
    const zone = c.courbes.querySelector(".dyn-wl"), zA = c.courbes.querySelector(".dyn-abaque");
    if (!zone) return;
    const pts = e.faits.map((i) => e.points[i]);
    const wMin = Math.min(...e.points.map((p) => p.w)) - 2, wMax = Math.max(...e.points.map((p) => p.w)) + 2;
    const series = [], marques = [];
    if (e.methode === "coupelle") {
      const r = pts.length >= 2 ? wLCasagrande(pts.map((p) => [p.N, p.w])) : null;
      if (r?.applicable) series.push({ points: [12, 15, 20, 25, 30, 35, 40].map((N) => [N, r.droite(N)]), couleur: COULEURS.bleu, epaisseur: 1.8, tirets: "6 4", libelle: "droite w – lg N" });
      series.push({ points: pts.map((p) => [p.N, p.w]), couleur: COULEURS.encre, nuage: true, rayon: 4.5, libelle: "points d'essai (N, w)" });
      if (r?.applicable && pts.length === 4) marques.push({ x: 25, y: r.wL, couleur: COULEURS.effort, guides: true, libelle: `wL = ${fd(r.wL, 1)} %` });
      zone.innerHTML = graphe({ largeur: 560, hauteur: 260, xmin: 10, xmax: 40, logX: true, ymin: Math.floor(wMin), ymax: Math.ceil(wMax), xlabel: "nombre de coups N (échelle logarithmique)", ylabel: "teneur en eau w (%)", series, marques });
    } else {
      const r = pts.length >= 2 ? wLCone(pts.map((p) => [p.p, p.w])) : null;
      if (r?.applicable) series.push({ points: [12, 28].map((p) => [p, r.droite(p)]), couleur: COULEURS.bleu, epaisseur: 1.8, tirets: "6 4", libelle: "droite w – enfoncement" });
      series.push({ points: pts.map((p) => [p.p, p.w]), couleur: COULEURS.encre, nuage: true, rayon: 4.5, libelle: "points d'essai (p, w)" });
      if (r?.applicable && pts.length === 4) marques.push({ x: 20, y: r.wL, couleur: COULEURS.effort, guides: true, libelle: `wL = ${fd(r.wL, 1)} %` });
      zone.innerHTML = graphe({ largeur: 560, hauteur: 260, xmin: 12, xmax: 28, pasX: 2, ymin: Math.floor(wMin), ymax: Math.ceil(wMax), xlabel: "enfoncement du cône p (mm)", ylabel: "teneur en eau w (%)", series, marques });
    }
    // Abaque de plasticité de Casagrande, avec les bandes d'IP du GTR 2024.
    const res = resultats();
    const xmax = 80, ymax = 50, [i1, i2, i3] = SEUILS_2024.IP;
    zA.innerHTML = graphe({
      largeur: 560, hauteur: 300, xmin: 0, xmax, ymin: 0, ymax, pasX: 10, pasY: 10,
      xlabel: "limite de liquidité wL (%)", ylabel: "indice de plasticité IP",
      zones: [
        { x0: 0, x1: xmax, y0: 0, y1: i1, couleur: "#a7f3d0", opacite: 0.22, libelle: `IP ≤ ${i1} : F1, I1`, position: "droite" },
        { x0: 0, x1: xmax, y0: i1, y1: i2, couleur: "#fde68a", opacite: 0.22, libelle: `${i1} < IP ≤ ${i2} : F2, I2`, position: "droite" },
        { x0: 0, x1: xmax, y0: i2, y1: i3, couleur: "#fdba74", opacite: 0.2, libelle: `${i2} < IP ≤ ${i3} : F3`, position: "droite" },
        { x0: 0, x1: xmax, y0: i3, y1: ymax, couleur: "#fca5a5", opacite: 0.2, libelle: `IP > ${i3} : F4`, position: "droite" },
      ],
      series: [
        { points: [[20, 0], [xmax, 0.73 * (xmax - 20)]], couleur: COULEURS.rouge, epaisseur: 2, libelle: "ligne A : IP = 0,73 (wL − 20)" },
        { points: [[50, 0], [50, ymax]], couleur: COULEURS.discret, tirets: "5 4", epaisseur: 1.4, libelle: "wL = 50 %" },
      ],
      marques: res ? [{ x: res.wL, y: res.IP, couleur: COULEURS.bleu, rayon: 6, libelle: `${e.sol.nom} (${res.abaque.code})` }] : [],
    }) + (res ? "" : '<p class="method-note">Le point du sol se place sur l\'abaque quand wL et wP sont mesurés.</p>');
  }

  /** wL, wP, IP, Ic et classes une fois l'essai terminé (solveurs). */
  function resultats() {
    if (!e.fini) return null;
    const pts = e.points;
    const rL = e.methode === "coupelle" ? wLCasagrande(pts.map((p) => [p.N, p.w])) : wLCone(pts.map((p) => [p.p, p.w]));
    const wP = (e.wPlus[0] + e.wPlus[1]) / 2;
    const p400 = passant(e.sol.granulo, 0.4), w0400 = teneurEau0400(e.sol.wn, p400);
    const at = atterberg({ wL: rL.wL, wP, w: w0400 });
    return { wL: rL.wL, wP, IP: at.IP, Ic: at.Ic, w0400, p400, at, abaque: abaqueCasagrande({ wL: rL.wL, IP: at.IP }), rL };
  }

  function bilan() {
    const res = resultats(), a = analyser(e.sol.granulo);
    const r = classerSol({ Dmax: a.Dmax, p63um: a.p63um, p2mm: a.p2mm, Cu: a.Cu, D60: a.D60, fractionSable: a.fractionSable, fractionGrave: a.fractionGrave, IP: res.IP, Ic: res.Ic });
    const sc = r.sousClasse, cleE = cleEtats(sc, a.p2mm), h = cleE ? etatHydrique(cleE, { Ic: res.Ic }) : null;
    const intervalle = h?.applicable ? ETATS_2024[cleE].lignes.find((l) => l.etat === h.etat)?.Ic : null;
    const methode = e.methode === "coupelle" ? `${fd(res.wL, 1)} % (droite w – lg N lue à 25 coups)` : `${fd(res.wL, 1)} % (droite w – enfoncement lue à 20 mm)`;
    const famille = r.classeFraction === "F" ? "sol fin" : "sol intermédiaire";
    let sens = `${famille[0].toUpperCase()}${famille.slice(1)} (${fd(a.p63um, 0)} % de fines) : IP = ${fd(res.IP, 1)} ⇒ <strong>${sc}</strong> au sens de l'IP`;
    if (res.IP <= SEUILS_2024.IP[0]) sens += ` — mais sous IP = ${SEUILS_2024.IP[0]}, le GTR 2024 préfère la VBS (celle de ce sol vaut ${fd(e.sol.VBS, 1)})`;
    if (intervalle) sens += ` ; Ic = ${fd(res.Ic, 2)} ⇒ état <strong>${h.etat}</strong> (${enClair(intervalle, "Ic")}) : <strong>${sc}${h.etat}</strong>`;
    const consistance = res.Ic > 1 ? "très raide" : res.Ic > 0.75 ? "raide" : res.Ic > 0.5 ? "ferme" : res.Ic > 0.25 ? "molle" : "très molle";
    c.bilan.innerHTML = `<p class="final-result">wL = <strong>${methode}</strong> · wP = <strong>${fd(res.wP, 1)} %</strong> (moyenne de ${fd(e.wPlus[0], 1)} et ${fd(e.wPlus[1], 1)} %) ⇒ IP = <strong>${fd(res.IP, 1)}</strong> · Ic = ${fd(res.Ic, 2)} à la teneur en eau naturelle (consistance ${consistance}) ;
        abaque de Casagrande : ${res.abaque.nom} (${res.abaque.code}). ${sens}.
        <small>Limites d'Atterberg selon la NF EN ISO 17892-12. La teneur en eau naturelle (${fd(e.sol.wn, 1)} %) est ramenée à la fraction 0/400 µm, seule essayée (${fd(res.p400, 0)} % du sol) : w = ${fd(res.w0400, 1)} % entre dans Ic = (wL − w)/IP. ${e.methode === "coupelle" ? "Le cône donnerait une limite de liquidité voisine ; la norme le préfère, moins dépendant de l'opérateur." : "La coupelle de Casagrande donnerait une valeur voisine : c'est l'essai historique du GTR."}</small></p>`;
  }

  b = boucle({ avancer, dessiner, dessinerLent, surFin: () => { dessinerLent(); bilan(); }, surEtat: () => etatBoutons?.() });
  etatBoutons = brancherMarche(c, b, reinit);
  c.commandes.querySelectorAll("select").forEach((x) => x.addEventListener("change", () => { b.raz(); reinit(); etatBoutons(); }));
  reinit();
  etatBoutons();
}
