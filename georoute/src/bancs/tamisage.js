// Banc d'essai : l'analyse granulométrique par tamisage (chapitre 2). On
// choisit le sol ; la prise d'essai, d'autant plus lourde que les grains sont
// gros (m ≈ 200 D, m en grammes et D en millimètres), est d'abord lavée sur le
// tamis de 63 µm — les fines partent avec l'eau —, séchée à l'étuve, puis
// versée sur la colonne de la série de base (63 mm … 0,063 mm et fond) que la
// tamiseuse fait vibrer dix minutes. On pèse ensuite le refus de chaque tamis :
// la courbe des passants cumulés se construit tamis après tamis, et son
// analyse donne Dmax (D95), Cu, Cc, les tamisats à 63 µm et à 2 mm, les
// fractions sableuse et graveleuse, donc la famille F, I, S ou G du GTR 2024
// (NF EN ISO 17892-4, voie humide puis sèche ; série de tamis de la NF EN 933-2).
//
// Modèle : la courbe du sol (catalogue des matériaux) donne le passant vrai à
// chaque tamis ; une petite erreur reproductible s'y ajoute (prélèvement,
// tamisage). Presque toutes les fines partent au lavage ; celles restées
// collées aux grains tombent au fond pendant le tamisage à sec, et une perte
// de poussière de l'ordre du millième ferme le bilan de masse. Pendant la
// vibration, chaque classe de grains descend de tamis en tamis jusqu'à celui
// qui la retient.
import { svg, texte, COULEURS, graphe } from "../figures.js";
import { SOLS } from "./materiaux.js";
import { analyser, etalement, passant } from "../gtr/granulo.js";
import { tamisage } from "../gtr/identification.js";
import { classerSol, SEUILS_2024 } from "../gtr/classification.js";
import { charpente, boucle, brancherMarche, lectures, f, fd, r1, esc, duree } from "./moteur.js";
import { fenetreLoupe, etiquette, horloge, W as WL, H as HL, ACIER, ACIER_SOMBRE, BLEU } from "./loupe.js";
import { bruit, hasard, teintesSol, paillasse, balance, barreEchelle, melange } from "./identification-dessin.js";

const SERIE = [63, 31.5, 16, 8, 4, 2, 1, 0.5, 0.25, 0.125, 0.063]; // mm, série de base
const CHOIX = ["graveAlluvionnaire", "graveArgileuse", "graveConcassee", "sableArgileux", "sableDune", "limon"];
const DUREES = { lavage: 300, versement: 30, tamisage: 600, pesee: 20 }; // s
const TAU_LAVAGE = 70, TAU_TAMIS = 70; // s
const ETATS = {
  lavage: "lavage sur le tamis de 63 µm (voie humide)", versement: "refus séché à l'étuve (105 °C), versé sur la colonne",
  tamisage: "tamisage à sec : la colonne vibre dix minutes", pesee: "pesée des refus, tamis après tamis", fini: "essai terminé",
};

export function monter(banc) {
  const c = charpente(banc, {
    vitesse: 30, vitesses: [1, 10, 30, 100],
    commandes: `
      <div class="field"><label>Sol</label><div class="input-wrap"><select data-r="sol">${CHOIX.map((k) => `<option value="${k}">${esc(SOLS[k].nom)}</option>`).join("")}</select></div></div>
      <p class="method-note banc-prise" style="grid-column:1/-1"></p>`,
  });
  const loupe = fenetreLoupe(c, "la maille d'un tamis");
  let e, b, etatBoutons;
  c.courbes.style.minWidth = "0"; // un tableau large défile dans son cadre au lieu d'élargir le banc

  const reinit = () => {
    const cle = c.q('[data-r="sol"]').value, sol = SOLS[cle], g = CHOIX.indexOf(cle) + 3;
    // Plus gros grain : premier point de la courbe où tout passe ; prise d'essai m ≈ 200 D.
    const D100 = sol.granulo.find(([, p]) => p >= 99.95)?.[0] ?? sol.granulo.at(-1)[0];
    const m = 200 * D100;
    // Colonne : du plus petit tamis de la série qui laisse tout passer (au moins 2 mm) jusqu'à 63 µm.
    const haut = SERIE.filter((d) => d >= Math.max(D100, 2)).at(-1) ?? 63;
    const colonne = SERIE.filter((d) => d <= haut);
    let prec = 100;
    const P = colonne.map((d, i) => {
      const vrai = passant(sol.granulo, d);
      const p = Math.min(prec, Math.max(0, vrai + 0.45 * bruit(i, g) * Math.min(1, (vrai * (100 - vrai)) / 900)));
      prec = p;
      return p;
    });
    const refus = colonne.map((d, i) => (m * ((i ? P[i - 1] : 100) - P[i])) / 100);
    const fines = (m * P.at(-1)) / 100;
    const perte = Math.min(0.3 * fines, 0.0008 * m * (1 + 0.4 * bruit(31, g)));
    const fond = Math.min(fines - perte, Math.max(0.02 * fines, 0.0015 * m));
    const lavees = fines - fond - perte;
    // Tamis montré à la loupe pendant la vibration : celui dont le passant est le plus proche de 50 %.
    let kLoupe = 0;
    P.forEach((p, i) => { if (Math.abs(p - 50) < Math.abs(P[kLoupe] - 50)) kLoupe = i; });
    const masses = [...refus, fond];
    e = {
      cle, sol, g, m, D100, colonne, n: colonne.length, P, refus, fines, perte, fond, lavees, mApres: m - lavees, masses,
      phiMax: Math.max(...masses) / (m - lavees), kLoupe, teintes: teintesSol(sol), fin: m >= 2000 ? 0 : 2,
      t: 0, phase: "lavage", tp: 0, iPesee: 0, lus: [], fini: false, cleCourbe: "",
    };
    c.q(".banc-prise").innerHTML = `Prise d'essai : <strong>${m >= 1000 ? `${fd(m / 1000, 1)} kg` : `${f(m, 3)} g`}</strong> de sol sec (plus gros grains ≈ ${f(D100, 3)} mm, m ≈ 200 D) ;
      lavage sur 63 µm, étuvage à 105 °C, puis tamisage à sec sur ${colonne.length} tamis de ${f(haut, 3)} à 0,063 mm et le fond.`;
    c.scene.innerHTML = decor();
    c.courbes.innerHTML = '<div class="dyn-courbe"></div><div class="dyn-tableau" style="min-width:0"></div>';
    c.bilan.innerHTML = "";
    dessiner(); dessinerLent();
  };

  const lu = (x) => (e.fin ? Math.round(x * 100) / 100 : Math.round(x));
  /** Masse au pas de lecture de la balance : le gramme pour les grosses prises, le centigramme sinon. */
  const gr = (x) => fd(x, e.fin);
  /** Part des fines déjà entraînées au temps τ du lavage (0 → 1). */
  const partLavee = (tau) => (1 - Math.exp(-tau / TAU_LAVAGE)) / (1 - Math.exp(-DUREES.lavage / TAU_LAVAGE));
  const avancer = (dt) => {
    if (e.fini) return false;
    let reste = dt;
    while (reste > 1e-9 && !e.fini) {
      const d = DUREES[e.phase];
      const h = Math.min(reste, d - e.tp);
      e.tp += h; e.t += h; reste -= h;
      if (e.tp < d - 1e-9) continue;
      e.tp = 0;
      if (e.phase === "lavage") e.phase = "versement";
      else if (e.phase === "versement") e.phase = "tamisage";
      else if (e.phase === "tamisage") { e.phase = "pesee"; e.iPesee = 0; }
      else {
        e.lus.push(lu(e.masses[e.iPesee]));
        e.iPesee++;
        if (e.iPesee > e.n) { e.phase = "fini"; e.fini = true; }
      }
    }
    return !e.fini;
  };

  /** Dépouillement des tamis déjà pesés (solveur du tamisage). */
  const depouiller = () => tamisage({ masseSeche: e.m, refus: e.lus.slice(0, e.n).map((x, i) => [e.colonne[i], x]) });

  // ── Répartition des grains pendant la vibration ─────────────────────────
  /** Avancement de la descente (0 → 1) au temps τ de la vibration. */
  const avance = (tau) => (1 - Math.exp(-tau / TAU_TAMIS)) / (1 - Math.exp(-DUREES.tamisage / TAU_TAMIS));
  /** Masse de chaque classe (retenue in fine sur le tamis j) présente sur chaque plateau k : [[j, masse]] par plateau. */
  function repartition() {
    const N = e.n + 1, plateaux = Array.from({ length: N }, () => []);
    const ph = e.phase;
    if (ph === "lavage") return plateaux;
    if (ph === "versement") {
      const part = Math.min(1, e.tp / DUREES.versement);
      e.masses.forEach((mj, j) => plateaux[0].push([j, mj * part]));
      return plateaux;
    }
    const av = ph === "tamisage" ? avance(e.tp) : 1;
    e.masses.forEach((mj, j) => {
      const l = j * av, k = Math.floor(l), fr = l - k;
      plateaux[k].push([j, mj * (1 - fr)]);
      if (fr > 1e-6 && k + 1 < N) plateaux[k + 1].push([j, mj * fr]);
    });
    return plateaux;
  }

  // ── Dessin ──────────────────────────────────────────────────────────────
  const G = { x0: 106, lp: 150, yBas: 344, yHaut: 46 }; // colonne : bord gauche, largeur des tamis, bas et haut utiles
  const xBal = 470, yBal = 404;
  const hPlateau = () => Math.min(30, (G.yBas - G.yHaut - 10) / (e.n + 1));
  const rayon = (j) => (j >= e.n ? 0.7 : Math.min(0.8 + 0.62 * Math.log2((e.colonne[j] * 1.41) / 0.063), hPlateau() / 2 - 3));

  function decor() {
    return svg({
      largeur: 640, hauteur: 424, titre: "Tamisage : poste de lavage, colonne de tamis sur la tamiseuse, balance", contenu: () => {
        let s = paillasse(0, 640, 404);
        // Tamiseuse : socle vibrant et minuterie.
        s += `<rect x="${G.x0 - 34}" y="352" width="${G.lp + 68}" height="52" rx="6" fill="#e2e8f0" stroke="#475569" stroke-width="1.3"/>`;
        s += `<rect x="${G.x0 - 22}" y="362" width="74" height="28" rx="3" fill="#cbd5e1" stroke="#64748b"/>`;
        s += `<circle cx="${G.x0 + 118}" cy="378" r="9" fill="#f8fafc" stroke="#475569" stroke-width="1.3"/><path d="M${G.x0 + 118} 378l5 -5" stroke="#475569" stroke-width="2"/>`;
        s += texte(G.x0 + 15, 380, "tamiseuse", 'text-anchor="middle" style="font-size:10.5px;font-weight:800;fill:#334155"');
        // Poste de lavage : robinet, cuvette ; étuve.
        s += `<path d="M560 26H452V46" fill="none" stroke="#64748b" stroke-width="7" stroke-linejoin="round"/><rect x="444" y="44" width="16" height="9" rx="2" fill="#475569"/>`;
        s += `<path d="M388 150h160l-12 46h-136z" fill="#f1f5f9" stroke="#64748b" stroke-width="1.3"/>`;
        s += texte(468, 214, "lavage sur le tamis de 63 µm", 'text-anchor="middle" class="halo" style="font-size:10.5px;font-weight:700;fill:#334155"');
        s += `<rect x="566" y="70" width="64" height="86" rx="5" fill="#e2e8f0" stroke="#475569" stroke-width="1.3"/><rect x="574" y="80" width="48" height="52" rx="3" fill="#fef3c7" stroke="#92400e"/>`;
        s += texte(598, 148, "105 °C", 'text-anchor="middle" style="font-size:10px;font-weight:800;fill:#92400e"') + texte(598, 170, "étuve", 'text-anchor="middle" style="font-size:10.5px;font-weight:700;fill:#334155"');
        s += `<g class="dyn-lavage"></g><g class="dyn-colonne"></g><g class="dyn-balance"></g>`;
        return s;
      },
    });
  }

  /** Un plateau de la colonne : cadre, tas de grains (classes présentes), toile ; k = e.n pour le fond. */
  function plateau(k, x, y, contenu, { vibre = 0 } = {}) {
    const hT = hPlateau(), lp = G.lp, estFond = k === e.n, yM = y + hT - 5;
    let s = `<rect x="${r1(x)}" y="${r1(y)}" width="${lp}" height="${r1(hT)}" fill="#f8fafc" stroke="${ACIER_SOMBRE}" stroke-width="1.1"/>`;
    const total = contenu.reduce((a, [, m]) => a + m, 0);
    const phi = total / e.mApres, h = Math.min(hT - 8, ((hT - 8) * phi) / e.phiMax);
    if (h > 0.5) {
      const yS = yM - h;
      s += `<path d="M${r1(x + 3)} ${r1(yM)}L${r1(x + 16)} ${r1(yS)}H${r1(x + lp - 16)}L${r1(x + lp - 3)} ${r1(yM)}Z" fill="${e.teintes.fond}"/>`;
      // Grains de chaque classe présente, au prorata de sa masse.
      const nTot = Math.round(Math.min(34, 8 + 40 * Math.min(1, phi / e.phiMax)));
      for (const [j, mj] of contenu) {
        const nj = Math.round((nTot * mj) / total), r = rayon(j);
        for (let q = 0; q < nj; q++) {
          const gx = x + 8 + hasard(k, j * 41 + q, 1) * (lp - 16);
          const gy = yM - Math.min(r, h / 2) - hasard(k, j * 41 + q, 2) * Math.max(0, h - 2 * Math.min(r, h / 2));
          s += `<circle cx="${r1(gx)}" cy="${r1(gy - vibre * hasard(j, q, 5))}" r="${r1(Math.min(r, h / 2 + 0.6))}" fill="${e.teintes.grain}"${r > 2.4 ? ` stroke="${e.teintes.sombre}" stroke-width=".7"` : ""}/>`;
        }
      }
    }
    // Toile du tamis : un tiret par maille, d'autant plus espacés que la maille est grande.
    if (!estFond) {
      const gap = 0.7 + (Math.log2(e.colonne[k] / 0.063) / 10) * 6.5;
      s += `<path d="M${r1(x + 1)} ${r1(yM)}h${lp - 2}" stroke="#475569" stroke-width="1.3" stroke-dasharray="1.6 ${r1(gap)}"/>`;
    } else s += `<rect x="${r1(x)}" y="${r1(yM)}" width="${lp}" height="5" fill="${ACIER}" stroke="${ACIER_SOMBRE}"/>`;
    return s;
  }

  function dessiner() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    const t = horloge(), ph = e.phase, hT = hPlateau(), N = e.n + 1;
    const vibre = ph === "tamisage" ? 1.4 * Math.sin(t * 2 * Math.PI * 6) : 0;
    const yTop = G.yBas - N * hT;
    const plateaux = repartition();
    // ── Colonne ──
    let s = "";
    const pese = ph === "pesee" ? e.iPesee : -1;
    // Tiges de serrage et couvercle, pendant la vibration seulement.
    if (ph === "tamisage" || ph === "versement") {
      s += `<rect x="${G.x0 - 8}" y="${r1(yTop - 22 + vibre)}" width="4" height="${r1(352 - yTop + 22)}" fill="#94a3b8"/><rect x="${G.x0 + G.lp + 4}" y="${r1(yTop - 22 + vibre)}" width="4" height="${r1(352 - yTop + 22)}" fill="#94a3b8"/>`;
      s += `<rect x="${G.x0 - 12}" y="${r1(yTop - 26 + vibre)}" width="${G.lp + 24}" height="6" rx="2" fill="#64748b"/>`;
    }
    if (ph === "tamisage") s += `<rect x="${G.x0 - 2}" y="${r1(yTop - 8 + vibre)}" width="${G.lp + 4}" height="8" rx="2" fill="${ACIER}" stroke="${ACIER_SOMBRE}"/>`;
    s += texte(G.x0 - 14, yTop - 14, "tamis (mm)", 'text-anchor="end" style="font-size:10.5px;font-weight:700;fill:#475569"');
    for (let k = 0; k < N; k++) {
      const y = yTop + k * hT + vibre;
      const lib = k < e.n ? f(e.colonne[k], 3) : "fond";
      s += texte(G.x0 - 14, y + hT / 2 + 4, lib, `text-anchor="end" style="font-size:10.5px;font-weight:700;fill:${k === pese ? COULEURS.effort : "#334155"}"`);
      if (k === pese) {
        s += `<rect x="${G.x0}" y="${r1(y)}" width="${G.lp}" height="${r1(hT)}" fill="none" stroke="#94a3b8" stroke-dasharray="4 3"/>`;
        continue;
      }
      s += plateau(k, G.x0, y, plateaux[k], { vibre: ph === "tamisage" ? Math.abs(vibre) * 2 : 0 });
      // Grains qui traversent la toile pendant la vibration.
      if (ph === "tamisage" && k < e.n) {
        const lam = avance(e.tp);
        let act = 0;
        e.masses.forEach((mj, j) => { if (j > k) act += (mj / e.mApres) * Math.max(0, 1 - Math.abs(j * lam - k - 0.5)); });
        const nb = Math.min(5, Math.ceil(act * 30));
        for (let q = 0; q < nb; q++) {
          const ph2 = (t * 1.3 + hasard(k, q, 7)) % 1;
          s += `<circle cx="${r1(G.x0 + 12 + hasard(k, q, 8) * (G.lp - 24))}" cy="${r1(y + hT - 4 + ph2 * (hT - 6))}" r="1.1" fill="${e.teintes.sombre}" opacity="${r1(1 - ph2 * 0.6)}"/>`;
        }
      }
      if (e.lus[k] !== undefined) s += texte(G.x0 + G.lp + 16, y + hT / 2 + 4, `${gr(e.lus[k])} g`, 'style="font-size:10.5px;font-weight:700;fill:#0369a1"');
    }
    // Versement : le refus sec tombe d'une cuvette sur le tamis de tête.
    if (ph === "versement") {
      const xc = G.x0 + G.lp / 2, yc = yTop - 54;
      s += `<path d="M${xc - 40} ${yc}q40 26 80 0z" fill="#e2e8f0" stroke="#475569" transform="rotate(-24 ${xc} ${yc})"/>`;
      for (let q = 0; q < 10; q++) { const p2 = (t * 1.6 + q / 10) % 1; s += `<circle cx="${r1(xc - 6 + hasard(q, 3) * 16)}" cy="${r1(yc + 6 + p2 * 40)}" r="${r1(1 + hasard(q, 4) * 2)}" fill="${e.teintes.grain}"/>`; }
    }
    svgEl.querySelector(".dyn-colonne").innerHTML = s;

    // ── Poste de lavage : tamis de protection de 2 mm sur le tamis de 63 µm, sous le jet ──
    let l = "";
    const yT = 100, xT = 420, lT = 96, P2 = e.P[e.colonne.indexOf(2)], P63 = e.P.at(-1);
    const tas = (y, frac, teinteTas) => {
      const hh = Math.min(15, 15 * frac);
      return hh > 0.4 ? `<path d="M${xT + 5} ${y}L${xT + 17} ${r1(y - hh)}H${xT + lT - 17}L${xT + lT - 5} ${y}Z" fill="${teinteTas}"/>` : "";
    };
    const eauCuvette = (part) => melange("#bae6fd", e.teintes.suspension, 0.15 + 0.7 * part * Math.min(1, (3 * e.lavees) / e.m));
    if (ph === "lavage") {
      const u = e.tp / DUREES.lavage, part = partLavee(e.tp), trouble = Math.exp(-e.tp / TAU_LAVAGE);
      let jet = `M452 53`;
      for (let y = 56; y <= yT - 18; y += 4) jet += `L${r1(452 + 1.6 * Math.sin(y * 0.7 + t * 18))} ${y}`;
      l += `<path d="${jet}" stroke="${BLEU}" stroke-width="3" fill="none" opacity=".8"/>`;
      // Le 2 mm garde la grave ; le 63 µm garde le sable et perd peu à peu ses fines.
      l += tas(yT - 4, (100 - P2) / 100, e.teintes.grain);
      l += tas(yT + 22, (P2 - P63) / 100 + (P63 / 100) * (1 - part), melange(e.teintes.fond, e.teintes.sombre, 0.35 * (1 - part)));
      for (let q = 0; q < 7; q++) { const p2 = (t * 1.4 + q / 7) % 1; l += `<path d="M${r1(xT + 20 + q * 9)} ${r1(yT + 30 + p2 * 22)}v6" stroke="${melange("#7dd3fc", e.teintes.sombre, trouble)}" stroke-width="2.4" opacity=".85"/>`; }
      l += `<rect x="392" y="${r1(186 - 26 * u)}" width="152" height="${r1(8 + 26 * u)}" fill="${eauCuvette(part)}" opacity=".85"/>`;
      l += texte(468, 232, `${gr(e.lavees * part)} g de fines entraînées`, 'text-anchor="middle" class="halo" style="font-size:10.5px;font-weight:700;fill:#92400e"');
    } else if (e.t > 0) l += `<rect x="392" y="160" width="152" height="34" fill="${eauCuvette(1)}" opacity=".85"/>`;
    l += `<rect x="${xT}" y="${yT - 18}" width="${lT}" height="16" fill="none" stroke="${ACIER_SOMBRE}" stroke-width="1.2"/><path d="M${xT} ${yT - 4}h${lT}" stroke="#475569" stroke-dasharray="1.6 4"/>`;
    l += `<rect x="${xT}" y="${yT}" width="${lT}" height="24" fill="none" stroke="${ACIER_SOMBRE}" stroke-width="1.2"/><path d="M${xT} ${yT + 22}h${lT}" stroke="#475569" stroke-dasharray="1.2 1"/>`;
    l += texte(xT - 6, yT - 6, "2 mm", 'text-anchor="end" style="font-size:10px;fill:#475569;font-weight:700"') + texte(xT - 6, yT + 16, "63 µm", 'text-anchor="end" style="font-size:10px;fill:#475569;font-weight:700"');
    svgEl.querySelector(".dyn-lavage").innerHTML = l;

    // ── Balance : le tamis pesé glisse de la colonne au plateau, puis revient ──
    let lecture = 0, bl = "";
    if (ph === "pesee") {
      const k = e.iPesee, tp = e.tp, yK = yTop + k * hT;
      const aller = Math.min(1, tp / 3), retour = Math.max(0, (tp - 17) / 3);
      const u = aller - retour, xB = xBal - G.lp / 2, yB = yBal - 46 - hT;
      const x = G.x0 + (xB - G.x0) * u, y = yK + (yB - yK) * u - 30 * Math.sin(Math.PI * u);
      bl += plateau(k, x, y, [[k, e.masses[k]]]);
      if (tp >= 3 && tp < 17) lecture = e.masses[k] * (1 + 0.04 * Math.exp(-(tp - 3) * 1.6) * Math.sin((tp - 3) * 9));
    }
    const lib = `${gr(lu(lecture))} g`;
    const bal = balance({ x: xBal, y: yBal, lu: lib, libelle: "balance (tare du tamis déduite)" });
    svgEl.querySelector(".dyn-balance").innerHTML = bal.svg + bl;

    // ── Afficheurs ──
    const tm = e.lus.length ? depouiller() : null, der = tm?.lignes?.at(-1);
    const partie = ph === "lavage" ? partLavee(e.tp) : 1;
    c.lectures.innerHTML = lectures([
      ["Temps d'essai", duree(e.t), ""],
      ["Fines lavées", gr(e.t > 0 ? e.lavees * partie : 0), "g"],
      ["Sur la balance", ph === "pesee" ? (e.iPesee < e.n ? `tamis ${f(e.colonne[e.iPesee], 3)}` : "fond") : "—", ph === "pesee" && e.iPesee < e.n ? "mm" : ""],
      ["Refus lu", ph === "pesee" && lecture > 0 ? gr(lu(lecture)) : "—", "g"],
      ["Passant au dernier tamis pesé", der ? fd(der.passant, 1) : "—", "%"],
    ]) + `<p class="banc-etat">${ETATS[ph]}</p>`;
    loupe(...vueLoupe());
  }

  // ── Loupe : la toile d'un tamis vue en coupe ; les grains plus fins que la maille passent ──
  const A = 22, RW = 4.6, PAS = A + 2 * RW, YM = 100; // ouverture, rayon du fil, pas de la toile, ordonnée de la toile (px)
  function vueLoupe() {
    const ph = e.phase, t = horloge();
    let k = e.kLoupe;
    if (ph === "lavage") k = e.n - 1;
    else if (ph === "pesee") k = e.iPesee;
    if (k >= e.n) {
      // Fond : la poussière des fines restées collées aux grains.
      let s = `<rect width="${WL}" height="${HL}" fill="#f8fafc"/><rect x="0" y="118" width="${WL}" height="${HL - 118}" fill="${ACIER}" stroke="${ACIER_SOMBRE}"/>`;
      s += `<path d="M12 118Q88 96 164 118Z" fill="${e.teintes.fond}"/>`;
      for (let q = 0; q < 70; q++) s += `<circle cx="${r1(14 + hasard(q, 1) * 148)}" cy="${r1(117 - hasard(q, 2) * 14 * Math.sin(Math.PI * hasard(q, 1)))}" r="${r1(0.6 + hasard(q, 3) * 0.9)}" fill="${e.teintes.sombre}"/>`;
      s += etiquette(8, 16, "fond de la colonne");
      return [s, `fond : ${gr(e.fond)} g de fines restées collées aux grains au lavage`];
    }
    const a = e.colonne[k], kmm = A / a; // px par mm
    const vib = ph === "tamisage" ? 2.2 * Math.sin(t * 2 * Math.PI * 4) : 0;
    let s = `<rect width="${WL}" height="${HL}" fill="${ph === "lavage" ? "#e0f2fe" : "#f8fafc"}"/>`;
    const x0 = WL / 2 - PAS / 2; // une maille centrée
    const trous = [];
    for (let x = x0 - 3 * PAS; x < WL + PAS; x += PAS) trous.push(x + PAS / 2);
    const fil = (x) => `<circle cx="${r1(x)}" cy="${r1(YM + vib)}" r="${RW}" fill="${ACIER}" stroke="${ACIER_SOMBRE}" stroke-width="1"/>`;
    // Gros grains (retenus) : ils rebondissent sur la toile pendant la vibration.
    const gros = [[0.18, 1.5], [0.5, 1.9], [0.82, 1.35]], col = e.teintes.grain, bord = e.teintes.sombre;
    let g = "";
    const grosGrain = (fx, taille, i) => {
      const r = (taille * A) / 2, saut = ph === "tamisage" ? Math.abs(Math.sin(t * 2 * Math.PI * 4 + i * 1.7)) * 7 : 0;
      return `<ellipse cx="${r1(fx * WL)}" cy="${r1(YM - RW - r * 0.92 + vib - saut)}" rx="${r1(r)}" ry="${r1(r * 0.92)}" fill="${col}" stroke="${bord}" stroke-width="1.2"/>`;
    };
    if (ph === "lavage") {
      const u = e.tp / DUREES.lavage, flot = Math.exp(-e.tp / TAU_LAVAGE), part = partLavee(e.tp);
      // Grains de sable retenus, eau qui traverse la toile en entraînant les fines.
      g += gros.slice(0, e.mApres / e.m > 0.4 ? 3 : 2).map(([fx, ta], i) => grosGrain(fx, ta, i)).join("");
      for (let q = 0; q < 18; q++) {
        const p2 = (t * 0.9 + q / 18) % 1, x = trous[(q % (trous.length - 2)) + 1] + (hasard(q, 4) - 0.5) * 8;
        g += `<path d="M${r1(x)} ${r1(p2 * HL - 6)}v7" stroke="${BLEU}" stroke-width="1.6" opacity=".55"/>`;
        if (q < Math.round(16 * flot) + 1) g += `<circle cx="${r1(x + 2)}" cy="${r1(((p2 + 0.3) % 1) * HL)}" r="${r1(0.9 + hasard(q, 5) * 1.6)}" fill="${e.teintes.sombre}"/>`;
      }
      s += g + trous.map((x) => fil(x - PAS / 2)).join("");
      s += etiquette(6, 14, "tamis de 63 µm sous l'eau", { taille: 9.5 }) + barreEchelle(kmm);
      return [s, u < 0.98 ? `l'eau entraîne les fines sous la maille : ${gr(e.lavees * part)} g partis` : "l'eau ressort claire : le lavage est fini"];
    }
    // Petits grains : ils passent par les mailles ; il en reste de moins en moins sur la toile.
    let nPetits = 0;
    if (ph === "versement") nPetits = 7;
    else if (ph === "tamisage") nPetits = Math.round(7 * Math.exp(-e.tp / 110));
    for (let q = 0; q < 7; q++) {
      const r = ((0.35 + 0.5 * hasard(k, q, 3)) * A) / 2, xg = trous[(q * 2) % trous.length];
      if (q < nPetits && ph === "tamisage") {
        const p2 = (t * 0.55 + q * 0.37) % 1;
        const y = p2 < 0.55 ? YM - r - Math.abs(Math.sin(t * 2 * Math.PI * 4 + q)) * 6 + vib : YM - r + ((p2 - 0.55) / 0.45) * (HL - YM + 2 * r + 10);
        g += `<circle cx="${r1(xg)}" cy="${r1(y)}" r="${r1(r)}" fill="${col}" stroke="${bord}" stroke-width=".8"/>`;
      } else if (q < nPetits) g += `<circle cx="${r1(xg)}" cy="${r1(YM - RW - r)}" r="${r1(r)}" fill="${col}" stroke="${bord}" stroke-width=".8"/>`;
    }
    g += gros.map(([fx, ta], i) => grosGrain(fx, ta, i)).join("");
    s += g + trous.map((x) => fil(x - PAS / 2)).join("");
    // Cote de la maille.
    const xm = trous[2], ouv = a < 1 ? `${f(a * 1000, 3)} µm` : `${f(a, 3)} mm`;
    s += `<path d="M${r1(xm - A / 2)} ${r1(YM + 16 + vib)}h${A}M${r1(xm - A / 2)} ${r1(YM + 12 + vib)}v8M${r1(xm + A / 2)} ${r1(YM + 12 + vib)}v8" stroke="${COULEURS.cote}" stroke-width="1.2"/>`;
    s += etiquette(xm + A / 2 + 4, YM + 20 + vib, `maille de ${ouv}`, { couleur: COULEURS.cote, taille: 9.5 });
    s += barreEchelle(kmm);
    const nom = `tamis de ${ouv}`;
    const legende = ph === "versement" ? `le refus sec arrive sur la colonne`
      : ph === "tamisage" ? (nPetits > 0 ? `${nom} : les grains plus fins que la maille passent, les gros restent` : `${nom} : il ne reste que les grains plus gros que la maille`)
        : ph === "pesee" ? `${nom} : son refus pèse ${gr(lu(e.masses[k]))} g` : `${nom} : chaque tamis garde les grains plus gros que sa maille`;
    return [s + etiquette(6, 14, nom, { taille: 9.5 }), legende];
  }

  // ── Courbe granulométrique et tableau des refus ──────────────────────────
  function dessinerLent() {
    const cle = `${e.cle}|${e.lus.length}`;
    if (cle === e.cleCourbe) return;
    e.cleCourbe = cle;
    const zone = c.courbes.querySelector(".dyn-courbe"), tab = c.courbes.querySelector(".dyn-tableau");
    if (!zone) return;
    const tm = e.lus.length ? depouiller() : null;
    const pts = tm ? tm.courbe : [];
    const marques = [];
    if (e.fini) {
      const a = analyser(tm.courbe);
      for (const [x, nom] of [[10, "D10"], [30, "D30"], [60, "D60"]]) {
        const D = a[nom];
        if (Number.isFinite(D)) marques.push({ x: D, y: x, couleur: COULEURS.violet, guides: true, rayon: 4, libelle: `${nom} = ${f(D, 2)} mm` });
      }
      marques.push({ x: 0.063, y: a.p63um, couleur: COULEURS.effort, guides: true, libelle: `63 µm : ${fd(a.p63um, 1)} %` });
      marques.push({ x: 2, y: a.p2mm, couleur: COULEURS.gtr24, guides: true, libelle: `2 mm : ${fd(a.p2mm, 1)} %` });
    }
    zone.innerHTML = graphe({
      largeur: 560, hauteur: 290, xmin: 0.01, xmax: 100, logX: true, ymin: 0, ymax: 100, pasY: 20,
      xlabel: "ouverture des tamis D (mm, échelle logarithmique)", ylabel: "passant cumulé (%)",
      series: [{ points: pts, couleur: COULEURS.bleu, epaisseur: 2.2, marqueurs: true, libelle: `${e.sol.nom} : passants cumulés` }],
      zones: [{ x0: 0.01, x1: 0.063, y0: 0, y1: 100, couleur: "#94a3b8", opacite: 0.14, libelle: "sous 63 µm : sédimentométrie" }],
      marques,
    });
    if (!tm) { tab.innerHTML = '<p class="method-note">La courbe et le tableau se remplissent à la pesée, tamis après tamis.</p>'; return; }
    const lignes = tm.lignes.map((x) => `<tr><td class="n">${f(x.d, 3)}</td><td class="n">${gr(x.refus)}</td><td class="n">${gr(x.refusCumule)}</td><td class="n">${fd((100 * x.refusCumule) / e.m, 1)}</td><td class="n">${fd(x.passant, 1)}</td></tr>`).join("");
    const pieds = e.lus.length > e.n ? `<tr><td>fond (tamisage à sec)</td><td class="n">${gr(e.lus[e.n])}</td><td colspan="3"></td></tr>
      <tr><td>parti au lavage (&lt; 63 µm)</td><td class="n">${gr(e.lavees)}</td><td colspan="3"></td></tr>` : "";
    tab.innerHTML = `<div class="table-large"><table class="resultats"><thead><tr><th class="num">Tamis (mm)</th><th class="num">Refus partiel (g)</th><th class="num">Refus cumulé (g)</th><th class="num">Refus cumulé (%)</th><th class="num">Passant (%)</th></tr></thead><tbody>${lignes}${pieds}</tbody></table></div>`;
  }

  function bilan() {
    const tm = depouiller(), a = analyser(tm.courbe);
    const r = classerSol({ Dmax: a.Dmax, p63um: a.p63um, p2mm: a.p2mm, Cu: a.Cu, D60: a.D60, D10: a.D10, fractionSable: a.fractionSable, fractionGrave: a.fractionGrave });
    const S = SEUILS_2024.fines, fam = r.applicable ? r.classeFraction : a.p63um > S.F ? "F" : "I";
    const sommeLue = e.lus.reduce((x, y) => x + y, 0), ecart = (100 * (e.mApres - sommeLue)) / e.mApres;
    const diam = ["D10", "D30", "D60"].map((n) => (Number.isFinite(a[n]) ? `${n} = ${f(a[n], 2)} mm` : null)).filter(Boolean);
    const cu = Number.isFinite(a.Cu) ? ` ⇒ Cu = <strong>${a.Cu < 100 ? fd(a.Cu, 1) : f(a.Cu, 3)}</strong>, Cc = ${fd(a.Cc, 2)}` : "";
    const fractions = `tamisats à 63 µm = <strong>${fd(a.p63um, 1)} %</strong> et à 2 mm = <strong>${fd(a.p2mm, 1)} %</strong> (fraction sableuse ${fd(a.fractionSable, 0)} %, graveleuse ${fd(a.fractionGrave, 0)} %)`;
    let sens, note;
    if (fam === "F") {
      sens = `plus de ${S.F} % de fines : <strong>sol fin F</strong> au GTR 2024`;
      note = `${diam.length ? "D10 est sous 63 µm : le tamisage ne l'atteint pas" : "D10, D30 et D60 sont sous 63 µm : le tamisage ne les atteint pas"} ; il faut la sédimentométrie pour D10 (donc Cu). La sous-classe F1 à F4 viendra de la VBS ou de l'IP.`;
    } else if (fam === "I") {
      sens = `de ${S.IS} à ${S.F} % de fines : <strong>sol intermédiaire I</strong> au GTR 2024`;
      note = "D10 est sous 63 µm : sans sédimentométrie Cu reste inconnu, mais il ne sert pas pour un sol I, dont la sous-classe (I1 ou I2) viendra de la VBS ou de l'IP.";
    } else {
      const et = etalement({ Cu: a.Cu, D60: a.D60 });
      sens = `au plus ${S.IS} % de fines et ${fam === "S" ? "plus de sable que de grave" : "plus de grave que de sable"} : <strong>sol ${fam === "S" ? "sableux S" : "graveleux G"}</strong> ;
        ${r.critereNature} ⇒ <strong>${r.sousClasse}</strong> au GTR 2024`;
      note = `${et.motif}. Reste la VBS : c'est elle qui dira si le sol est insensible à l'eau (suffixe ins).`;
    }
    c.bilan.innerHTML = `<p class="final-result">Dmax ≈ D95 = <strong>${f(a.Dmax, 2)} mm</strong>${diam.length ? ` · ${diam.join(", ")}` : ""}${cu} · ${fractions} ⇒ ${sens}.
        <small>Tamisage par voie humide puis sèche selon la NF EN ISO 17892-4. ${note} Bilan de masse du tamisage à sec : écart de ${fd(ecart, 2)} %, sous la tolérance de 1 %. Le chapitre 5 assemble ces paramètres en une classe complète.</small></p>`;
  }

  b = boucle({ avancer, dessiner, dessinerLent, surFin: () => { dessinerLent(); bilan(); }, surEtat: () => etatBoutons?.() });
  etatBoutons = brancherMarche(c, b, reinit);
  c.commandes.querySelectorAll("select").forEach((x) => x.addEventListener("change", () => { b.raz(); reinit(); etatBoutons(); }));
  reinit();
  etatBoutons();
}
