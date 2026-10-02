// Banc d'essai : l'équivalent de sable (chapitre 2). On choisit le sol ; deux
// prises de 120 g de sa fraction 0/2 mm sont versées dans deux éprouvettes
// (Ø 32 mm) remplies de solution lavante jusqu'au trait de 100 mm. Après
// 10 min d'imbibition, chaque éprouvette, bouchée, est agitée 90 cycles en
// 30 s ; le tube laveur, plongé jusqu'au fond, remet les fines en suspension
// en complétant jusqu'au trait de 380 mm. Après 20 min de repos, le floculat
// d'argile surnage au-dessus du sable : on lit h1, sommet du floculat, à la
// règle, puis h2, sommet du sable, au piston taré (1 kg) que l'on descend
// jusqu'à lui. ES = 100 h2/h1 pour chaque éprouvette, et la moyenne des deux
// (NF EN 933-8).
//
// Modèle : le sable (part de la fraction 0/2 mm plus grosse que 63 µm) se
// dépose en quelques dizaines de secondes, à environ 1,6 g/cm³ sous le
// piston : il fixe h2. Le floculat descend du trait supérieur vers h1 en se
// tassant, d'autant plus lentement que le sol est argileux ; h1 est réglé
// pour que l'ES vaille celui du catalogue des matériaux. Pour un sable très
// argileux, le floculat, qui ne peut dépasser le niveau du liquide, retient
// une partie du sable fin : h2 baisse d'autant. Les lectures, au millimètre,
// portent une petite erreur reproductible.
import { svg, texte, COULEURS, graphe } from "../figures.js";
import { SOLS } from "./materiaux.js";
import { passant } from "../gtr/granulo.js";
import { equivalentSable } from "../gtr/identification.js";
import { charpente, boucle, brancherMarche, lectures, fd, r1, esc, duree } from "./moteur.js";
import { fenetreLoupe, etiquette, horloge, W as WL, H as HL, ACIER, ACIER_SOMBRE, BLEU } from "./loupe.js";
import { bruit, hasard, teintesSol, paillasse, melange, barreEchelle } from "./identification-dessin.js";

const CHOIX = ["sableDune", "graveConcassee", "graveAlluvionnaire", "graveArgileuse", "sableArgileux"];
const PHASES = [["remplissage", 20], ["versement", 20], ["imbibition", 600], ["agitation", 30], ["lavage", 40], ["repos", 1200], ["lecture", 15], ["piston", 26]];
const H_BAS = 100, H_HAUT = 380, H_EPR = 430; // mm : traits repères, hauteur de l'éprouvette
const SECTION = Math.PI * 1.6 ** 2; // cm² (Ø intérieur 32 mm)
const RHO_DEPOT = 1.62; // g/cm³ : sable déposé, sous le piston
const MASSE = 120; // g de 0/2 mm sec
const LIQUIDE = "#f7f9e8", PISTON_KG = 1;

export function monter(banc) {
  const c = charpente(banc, {
    vitesse: 50, vitesses: [1, 10, 50, 200],
    commandes: `
      <div class="field"><label>Sol (fraction 0/2 mm)</label><div class="input-wrap"><select data-r="sol">${CHOIX.map((k) => `<option value="${k}">${esc(SOLS[k].nom)}</option>`).join("")}</select></div></div>
      <p class="method-note" style="grid-column:1/-1">Deux prises de ${MASSE} g de 0/2 mm ; solution lavante jusqu'à ${H_BAS} mm ; 10 min d'imbibition ; 90 cycles d'agitation en 30 s ;
        lavage jusqu'au trait de ${H_HAUT} mm ; 20 min de repos ; h1 à la règle, h2 au piston taré de ${PISTON_KG} kg.</p>`,
  });
  const loupe = fenetreLoupe(c, "l'interface sable – floculat");
  let e, b, etatBoutons;
  c.courbes.style.minWidth = "0"; // un tableau large défile dans son cadre au lieu d'élargir le banc

  const reinit = () => {
    const cle = c.q('[data-r="sol"]').value, sol = SOLS[cle], g = CHOIX.indexOf(cle) + 5;
    // Hauteurs vraies : sable déposé (h2), puis floculat (h1) tel que l'ES soit celui du catalogue.
    const fines = passant(sol.granulo, 0.063) / passant(sol.granulo, 2);
    let h2 = ((MASSE * (1 - fines)) / (RHO_DEPOT * SECTION)) * 10, h1 = (100 * h2) / sol.ES;
    if (h1 > 362) { h1 = 362; h2 = (sol.ES * h1) / 100; }
    // Deux prises : écarts reproductibles et de sens contraires, autour des hauteurs vraies.
    const eprouvettes = [0, 1].map((j) => {
      const H2 = h2 * (1 + 0.008 * bruit(j + 4, g)), lu2 = Math.round(H2);
      const H1 = ((100 * lu2) / sol.ES) * (1 + (j ? -1 : 1) * 0.008 * bruit(9, g));
      return { H1, H2, lu1: Math.round(H1), lu2 };
    });
    let t0 = 0;
    const debuts = PHASES.map(([, d]) => { const x = t0; t0 += d; return x; });
    e = {
      cle, sol, g, fines, eprouvettes, teintes: teintesSol(sol), debuts, total: t0,
      tauFloc: 120 + 420 * (1 - sol.ES / 100), t: 0, fini: false, cleCourbe: "",
    };
    c.scene.innerHTML = fond();
    c.courbes.innerHTML = '<div class="dyn-courbe"></div><div class="dyn-tableau" style="min-width:0"></div>';
    c.bilan.innerHTML = "";
    dessiner(); dessinerLent();
  };

  /** Phase en cours et temps écoulé dans la phase. */
  function phase() {
    let i = PHASES.length - 1;
    while (i > 0 && e.t < e.debuts[i] - 1e-9) i--;
    if (e.fini) i = PHASES.length - 1;
    return { nom: PHASES[i][0], tp: Math.min(PHASES[i][1], e.t - e.debuts[i]), d: PHASES[i][1], i };
  }

  const avancer = (dt) => {
    if (e.fini) return false;
    e.t = Math.min(e.total, e.t + dt);
    if (e.t >= e.total - 1e-9) e.fini = true;
    return !e.fini;
  };

  // ── Modèle des hauteurs (mm) ─────────────────────────────────────────────
  const VOL_SABLE = MASSE / 2.65; // cm³ de grains
  const montee = (VOL_SABLE / SECTION) * 10; // mm : le liquide monte quand on verse le sable
  /** Niveau du liquide dans l'éprouvette j. */
  function niveau(j) {
    const p = phase();
    if (p.nom === "remplissage") return H_BAS * (p.tp / p.d);
    if (p.nom === "versement") return H_BAS + montee * (p.tp / p.d);
    if (["imbibition", "agitation"].includes(p.nom)) return H_BAS + montee;
    if (p.nom === "lavage") { const u = Math.min(1, Math.max(0, (p.tp - 20 * j) / 20)); return H_BAS + montee + (H_HAUT - H_BAS - montee) * u; }
    return H_HAUT;
  }
  /** Temps de repos écoulé (s), ou −1 avant le repos. */
  function tRepos() {
    const p = phase();
    if (p.i < 5) return -1;
    return p.i === 5 ? p.tp : PHASES[5][1];
  }
  /** Sommet du floculat dans l'éprouvette j (mm) : descend du niveau du liquide vers h1. */
  function floculat(j) {
    const tr = tRepos(), x = e.eprouvettes[j];
    if (tr < 0) return NaN;
    const T = PHASES[5][1], k = (Math.exp(-tr / e.tauFloc) - Math.exp(-T / e.tauFloc)) / (1 - Math.exp(-T / e.tauFloc));
    return x.H1 + (H_HAUT - x.H1) * k;
  }
  /** Sommet du sable déposé (mm) : il se dépose en une minute ; le piston le tasse d'un rien. */
  function sable(j) {
    const p = phase(), x = e.eprouvettes[j];
    if (p.i <= 1) return p.i === 1 ? x.H2 * 1.12 * (p.tp / p.d) : 0;
    if (p.nom === "imbibition") return x.H2 * 1.12;
    if (p.nom === "agitation" || p.nom === "lavage") return x.H2 * 0.25;
    const tr = tRepos();
    if (p.nom === "piston" && pistonPose(j)) return x.H2;
    return x.H2 * 1.03 * (1 - Math.exp(-Math.max(0, tr) / 14)) + x.H2 * 0.25 * Math.exp(-Math.max(0, tr) / 14);
  }
  /** Le piston de l'éprouvette j : hauteur de son pied (mm), ou NaN s'il n'est pas dans l'éprouvette. */
  function piston(j) {
    const p = phase(), x = e.eprouvettes[j];
    if (p.nom !== "piston" && !e.fini) return NaN;
    const u = e.fini ? 1 : Math.min(1, Math.max(0, (p.tp - 13 * j) / 10));
    return H_EPR - (H_EPR - x.H2) * u;
  }
  const pistonPose = (j) => { const p = phase(); return e.fini || (p.nom === "piston" && p.tp - 13 * j >= 10); };

  // ── Dessin ──────────────────────────────────────────────────────────────
  const K = 0.78, Y0 = 400; // px par mm, fond intérieur des éprouvettes
  const Y = (h) => Y0 - h * K;
  const XS = [156, 236], R = 12.5; // axes des éprouvettes, rayon intérieur (px)
  function fond() {
    return svg({
      largeur: 640, hauteur: 432, titre: "Équivalent de sable : deux éprouvettes, règle, piston taré, flacon de solution lavante", contenu: () => {
        let s = paillasse(0, 640, 412);
        // Règle graduée.
        s += `<rect x="92" y="${r1(Y(410))}" width="18" height="${r1(Y(0) - Y(410))}" fill="#fef3c7" stroke="#a16207"/>`;
        for (let h = 0; h <= 400; h += 10) s += `<path d="M110 ${r1(Y(h))}h${h % 50 ? -4 : -8}" stroke="#78350f" stroke-width="${h % 100 ? 0.7 : 1.2}"/>`;
        for (let h = 0; h <= 400; h += 100) s += texte(88, Y(h) + 4, String(h), 'text-anchor="end" style="font-size:10px;font-weight:700;fill:#78350f"');
        s += texte(96, Y(418), "mm", 'text-anchor="middle" style="font-size:10px;fill:#78350f"');
        // Flacon de solution lavante, sur son étagère.
        s += `<rect x="330" y="70" width="80" height="6" fill="#94a3b8"/><path d="M344 70V34q0-8 8-8h28q8 0 8 8V70z" fill="#ecfccb" stroke="#4d7c0f" stroke-width="1.3"/>`;
        s += texte(370, 92, "solution lavante", 'text-anchor="middle" style="font-size:10.5px;font-weight:700;fill:#3f6212"');
        s += `<g class="dyn-eprouvettes"></g><g class="dyn-droite"></g>`;
        return s;
      },
    });
  }

  /** Contenu et verre de l'éprouvette j. */
  function eprouvette(j, tH) {
    const p = phase(), xc = XS[j], x = e.eprouvettes[j];
    const dx = p.nom === "agitation" ? 7 * Math.sin(tH * 2 * Math.PI * 3 + j) : 0;
    const xg = xc - R + dx, l = 2 * R;
    let s = "";
    const hL = niveau(j), hS = sable(j), hF = floculat(j);
    const grains = (ha, hb) => {
      let g = "";
      for (let q = 0; q < Math.min(70, (hb - ha) * 0.6); q++) g += `<circle cx="${r1(xg + 2 + hasard(j, q, 1) * (l - 4))}" cy="${r1(Y(ha + hasard(j, q, 2) * (hb - ha)))}" r="${r1(0.7 + 1.1 * hasard(j, q, 3))}" fill="${e.teintes.grain}"/>`;
      return g;
    };
    if (hL > 0.5) {
      if (p.nom === "agitation" || p.nom === "lavage") {
        // Tout est en suspension : trouble du fond à la surface, plus dense en bas.
        const n = 18;
        for (let q = 0; q < n; q++) {
          const ha = (q / n) * hL, hb = ((q + 1) / n) * hL;
          s += `<rect x="${r1(xg)}" y="${r1(Y(hb))}" width="${l}" height="${r1((hb - ha) * K + 0.6)}" fill="${melange(LIQUIDE, e.teintes.suspension, 0.45 + 0.4 * (1 - q / n))}"/>`;
        }
        s += grains(0, Math.min(hL, hS + 40));
      } else {
        s += `<rect x="${r1(xg)}" y="${r1(Y(hL))}" width="${l}" height="${r1(hL * K)}" fill="${LIQUIDE}"/>`;
        if (Number.isFinite(hF)) {
          // Floculat : de h2 à son sommet, trouble et brun.
          s += `<rect x="${r1(xg)}" y="${r1(Y(hF))}" width="${l}" height="${r1((hF - hS) * K)}" fill="${e.teintes.suspension}" opacity="${r1(0.35 + 0.4 * Math.min(1, (x.H1 - x.H2) / 150))}"/>`;
          for (let q = 0; q < Math.min(40, (hF - hS) * 0.3); q++) s += `<circle cx="${r1(xg + 3 + hasard(j, q, 7) * (l - 6))}" cy="${r1(Y(hS + hasard(j, q, 8) * (hF - hS)))}" r="1.3" fill="${e.teintes.sombre}" opacity=".45"/>`;
        } else if (p.i >= 1) {
          // Avant l'agitation : liquide un peu trouble au-dessus du sable imbibé.
          s += `<rect x="${r1(xg)}" y="${r1(Y(hL))}" width="${l}" height="${r1((hL - hS) * K)}" fill="${e.teintes.suspension}" opacity=".12"/>`;
        }
        if (hS > 0.3) s += `<rect x="${r1(xg)}" y="${r1(Y(hS))}" width="${l}" height="${r1(hS * K)}" fill="${e.teintes.fond}"/>` + grains(0, hS);
      }
    }
    // Verre, traits repères, base.
    s += `<path d="M${r1(xg - 2)} ${r1(Y(H_EPR))}V${r1(Y0 + 2)}H${r1(xg + l + 2)}V${r1(Y(H_EPR))}" fill="none" stroke="#475569" stroke-width="1.6"/>`;
    s += `<path d="M${r1(xg + 4)} ${r1(Y(H_EPR) + 6)}V${r1(Y0 - 6)}" stroke="#fff" stroke-width="2.2" opacity=".6"/>`;
    for (const h of [H_BAS, H_HAUT]) s += `<path d="M${r1(xg - 2)} ${r1(Y(h))}h8M${r1(xg + l - 6)} ${r1(Y(h))}h8" stroke="#dc2626" stroke-width="1.4"/>`;
    s += `<rect x="${r1(xg - 12)}" y="${Y0 + 2}" width="${l + 24}" height="8" rx="2" fill="#94a3b8"/>`;
    s += texte(xc, Y(H_EPR) - 22, `n° ${j + 1}`, 'text-anchor="middle" style="font-size:10.5px;font-weight:800;fill:#334155"');
    if (p.nom === "agitation") s += `<rect x="${r1(xg - 3)}" y="${r1(Y(H_EPR) - 12)}" width="${l + 6}" height="14" rx="3" fill="#334155"/>`;
    // Tube laveur, plongé jusqu'au fond pendant le lavage de cette éprouvette.
    if (p.nom === "lavage" && p.tp >= 20 * j && p.tp < 20 * (j + 1)) {
      const u = (p.tp - 20 * j) / 20, bas = u < 0.75 ? 4 + 10 * Math.abs(Math.sin(tH * 4)) : 4 + (u - 0.75) * 4 * (H_HAUT - 30);
      s += `<path d="M${xc} 76V${r1(Y(bas))}" stroke="#64748b" stroke-width="3"/><path d="M${xc} 76Q${xc} 60 344 52" fill="none" stroke="#65a30d" stroke-width="2"/>`;
      for (let q = 0; q < 6; q++) { const ph = (tH * 2 + q / 6) % 1; s += `<circle cx="${r1(xc + (q % 2 ? 6 : -6) * (1 - ph))}" cy="${r1(Y(bas + ph * 60))}" r="1.6" fill="${BLEU}" opacity="${r1(1 - ph)}"/>`; }
    }
    // Remplissage par le siphon.
    if (p.nom === "remplissage" && !e.fini) s += `<path d="M${xc} 76V${r1(Y(Math.max(hL, 5)))}" stroke="#65a30d" stroke-width="2.5"/><path d="M${xc} 76Q${xc} 60 344 52" fill="none" stroke="#65a30d" stroke-width="2"/>`;
    // Piston taré : tige, lest, pied ; le manchon s'appuie sur le haut de l'éprouvette.
    const hp = piston(j);
    if (Number.isFinite(hp)) {
      s += `<rect x="${xc - 2}" y="${r1(Y(hp) - 300 * K)}" width="4" height="${r1(300 * K)}" fill="${ACIER}" stroke="${ACIER_SOMBRE}" stroke-width=".7"/>`;
      s += `<rect x="${xc - 10}" y="${r1(Y(hp) - 6)}" width="20" height="6" fill="${ACIER_SOMBRE}"/>`;
      s += `<rect x="${xc - 11}" y="${r1(Y(hp) - 300 * K - 30)}" width="22" height="30" rx="3" fill="#475569"/>`;
    }
    return s;
  }

  function dessiner() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    const tH = horloge(), p = phase();
    svgEl.querySelector(".dyn-eprouvettes").innerHTML = eprouvette(0, tH) + eprouvette(1, tH) + cotes();
    // À droite : chronomètre de la phase, résultats des deux éprouvettes, légende.
    let r = `<rect x="430" y="40" width="196" height="52" rx="8" fill="#0f172a"/>`;
    r += texte(528, 58, nomPhase(p.nom), 'text-anchor="middle" style="font-size:10.5px;fill:#94a3b8"');
    r += texte(528, 82, e.fini ? "terminé" : `${chrono(p.tp)} / ${chrono(p.d)}`, 'text-anchor="middle" style="font-family:ui-monospace,Consolas,monospace;font-size:15px;font-weight:800;fill:#67e8f9"');
    r += texte(320, 140, "lectures", 'style="font-size:10.5px;font-weight:800;fill:#334155"');
    const lus = lecturesFaites();
    e.eprouvettes.forEach((x, j) => {
      const y = 166 + j * 50;
      r += `<rect x="314" y="${y - 18}" width="312" height="42" rx="6" fill="#f8fafc" stroke="#cbd5e1"/>`;
      r += texte(324, y, `n° ${j + 1}`, 'style="font-size:11px;font-weight:800;fill:#334155"');
      r += texte(366, y, `h1 = ${lus.h1 ? `${x.lu1} mm` : "…"}`, `style="font-size:11px;font-weight:700;fill:${lus.h1 ? COULEURS.violet : "#94a3b8"}"`);
      r += texte(470, y, `h2 = ${lus.h2[j] ? `${x.lu2} mm` : "…"}`, `style="font-size:11px;font-weight:700;fill:${lus.h2[j] ? COULEURS.gtr24 : "#94a3b8"}"`);
      if (lus.h2[j]) r += texte(366, y + 17, `ES = 100 h2/h1 = ${fd(equivalentSable({ h1: x.lu1, h2: x.lu2 }), 1)}`, `style="font-size:11px;font-weight:800;fill:${COULEURS.effort}"`);
    });
    // Légende des couches.
    [["liquide clair", LIQUIDE], ["floculat d'argile", e.teintes.suspension], ["sable", e.teintes.fond]].forEach(([lib, col], q) => {
      r += `<rect x="320" y="${282 + q * 22}" width="18" height="14" fill="${col}" stroke="#94a3b8"/>` + texte(346, 293 + q * 22, lib, 'style="font-size:10.5px;fill:#334155"');
    });
    if (p.nom === "agitation" && !e.fini) r += texte(472, 360, "agitateur : 90 cycles en 30 s", 'text-anchor="middle" class="halo" style="font-size:10.5px;font-weight:700;fill:#b45309"');
    svgEl.querySelector(".dyn-droite").innerHTML = r;
    // Afficheurs (éprouvette n° 1).
    const hF = floculat(0), hS = sable(0);
    c.lectures.innerHTML = lectures([
      ["Temps d'essai", duree(e.t), ""],
      ["Niveau du liquide (n° 1)", fd(niveau(0), 0), "mm"],
      ["Sommet du floculat (n° 1)", Number.isFinite(hF) ? fd(hF, 0) : "—", "mm"],
      ["Sommet du sable (n° 1)", hS > 0.5 && !["agitation", "lavage"].includes(p.nom) ? fd(hS, 0) : "—", "mm"],
      ["ES (n° 1)", lus.h2[0] ? fd(equivalentSable({ h1: e.eprouvettes[0].lu1, h2: e.eprouvettes[0].lu2 }), 1) : "—", ""],
    ]) + `<p class="banc-etat">${etat(p)}</p>`;
    loupe(...vueLoupe(tH));
  }

  /** Cotes h1 et h2 de l'éprouvette n° 1, une fois lues. */
  function cotes() {
    const lus = lecturesFaites(), x = e.eprouvettes[0], xc = XS[0] - R - 14;
    let s = "";
    if (lus.h1) s += `<path d="M${xc} ${r1(Y(x.H1))}h${R + 14}" stroke="${COULEURS.violet}" stroke-width="1.4" stroke-dasharray="3 2"/>` + texte(XS[0] + R + 6, Y(x.H1) - 4, "h1", `style="font-size:11px;font-weight:800;fill:${COULEURS.violet}"`);
    if (lus.h2[0]) s += `<path d="M${xc} ${r1(Y(x.H2))}h${R + 14}" stroke="${COULEURS.gtr24}" stroke-width="1.4" stroke-dasharray="3 2"/>` + texte(XS[0] + R + 6, Y(x.H2) + 12, "h2", `style="font-size:11px;font-weight:800;fill:${COULEURS.gtr24}"`);
    return s;
  }
  /** Ce qui est déjà lu : h1 (fin de la lecture à la règle), h2 de chaque éprouvette (piston posé). */
  function lecturesFaites() {
    const p = phase();
    return { h1: e.fini || p.i > 6 || (p.i === 6 && p.tp >= 8), h2: [0, 1].map((j) => pistonPose(j)) };
  }
  const chrono = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const nomPhase = (n) => ({ remplissage: "remplissage jusqu'à 100 mm", versement: "versement de 120 g de 0/2 mm", imbibition: "imbibition", agitation: "agitation", lavage: "lavage au tube laveur", repos: "repos", lecture: "lecture de h1", piston: "descente du piston" }[n]);
  function etat(p) {
    if (e.fini) return "essai terminé : h1 et h2 lus sur les deux éprouvettes";
    return {
      remplissage: "solution lavante siphonnée jusqu'au trait de 100 mm",
      versement: "120 g de 0/2 mm versés à l'entonnoir ; on tape le fond pour chasser les bulles",
      imbibition: `imbibition : 10 min (reste ${fd((p.d - p.tp) / 60, 1)} min)`,
      agitation: `éprouvette bouchée : ${Math.min(90, Math.floor(p.tp * 3))} cycles sur 90`,
      lavage: "le tube laveur remet les fines en suspension, jusqu'au trait de 380 mm",
      repos: `repos : 20 min (reste ${fd((p.d - p.tp) / 60, 1)} min) — le floculat se tasse`,
      lecture: "h1 lu à la règle, au sommet du floculat",
      piston: "le piston taré descend jusqu'au sable : h2",
    }[p.nom];
  }

  // ── Loupe : l'interface entre le sable et le floculat, éprouvette n° 1 ──
  function vueLoupe(tH) {
    const p = phase(), x = e.eprouvettes[0], k = 6; // px par mm
    const hS = sable(0), hF = floculat(0), hc = Math.max(8, hS); // hauteur au centre de la vue
    const Yl = (h) => 96 - (h - hc) * k;
    let s = `<rect width="${WL}" height="${HL}" fill="${LIQUIDE}"/>`;
    const tout = p.nom === "agitation" || p.nom === "lavage";
    if (tout) {
      s = `<rect width="${WL}" height="${HL}" fill="${melange(LIQUIDE, e.teintes.suspension, 0.55)}"/>`;
      for (let q = 0; q < 46; q++) { const a = tH * (1 + hasard(q, 4)) + q; s += `<circle cx="${r1((hasard(q, 1) * WL + 30 * Math.sin(a)) % WL)}" cy="${r1((hasard(q, 2) * HL + 24 * Math.cos(a * 1.3)) % HL)}" r="${r1(1 + 3.5 * hasard(q, 3))}" fill="${e.teintes.grain}" stroke="${e.teintes.sombre}" stroke-width=".5"/>`; }
      return [s + barreEchelle(k), p.nom === "agitation" ? "agitation : grains et fines mêlés" : "lavage : le courant soulève les fines, le sable retombe"];
    }
    // Floculat au-dessus du sable : flocons lâches qui descendent lentement.
    if (Number.isFinite(hF)) {
      const yF = Math.max(-10, Yl(hF));
      s += `<rect x="0" y="${r1(yF)}" width="${WL}" height="${r1(HL - yF)}" fill="${e.teintes.suspension}" opacity=".45"/>`;
      for (let q = 0; q < 30; q++) {
        const fx = hasard(q, 5) * WL, fy = yF + ((hasard(q, 6) * (HL - yF) + (p.nom === "repos" ? tH * 3 : 0)) % Math.max(1, HL - yF));
        s += `<g opacity=".7">${[0, 1, 2, 3].map((m) => `<circle cx="${r1(fx + 3 * Math.cos(m * 1.7 + q))}" cy="${r1(fy + 3 * Math.sin(m * 1.7 + q))}" r="1.6" fill="${e.teintes.sombre}"/>`).join("")}</g>`;
      }
      if (yF > 16) s += etiquette(6, yF - 4, "sommet du floculat", { couleur: "#78350f", taille: 9.5 });
    }
    // Sable : grains de 0,06 à 2 mm, serrés sous l'interface.
    const yS = Yl(hS);
    if (hS > 0.3 && yS < HL) {
      s += `<rect x="0" y="${r1(yS)}" width="${WL}" height="${r1(HL - yS)}" fill="${e.teintes.fond}"/>`;
      for (let q = 0; q < 70; q++) { const gx = hasard(q, 11) * WL, gy = yS + 2 + hasard(q, 12) * (HL - yS); s += `<circle cx="${r1(gx)}" cy="${r1(gy)}" r="${r1(1 + 4 * hasard(q, 13) ** 2)}" fill="${e.teintes.grain}" stroke="${e.teintes.sombre}" stroke-width=".5"/>`; }
      s += `<path d="M0 ${r1(yS)}H${WL}" stroke="#78350f" stroke-width="1.2"/>`;
    }
    // Pied du piston, quand il descend.
    const hp = piston(0);
    if (Number.isFinite(hp) && Yl(hp) > -40) {
      const yp = Yl(hp);
      s += `<rect x="20" y="${r1(yp - 16)}" width="${WL - 40}" height="16" fill="${ACIER_SOMBRE}" stroke="#1e293b"/><rect x="${WL / 2 - 6}" y="${r1(yp - 80)}" width="12" height="64" fill="${ACIER}" stroke="${ACIER_SOMBRE}"/>`;
      if (pistonPose(0)) s += etiquette(WL - 6, Math.min(HL - 30, yp + 14), `h2 = ${x.lu2} mm`, { ancre: "end", couleur: COULEURS.gtr24 });
    }
    s += barreEchelle(k);
    const tr = tRepos();
    const leg = p.nom === "remplissage" ? "la solution lavante monte jusqu'au trait de 100 mm"
      : p.nom === "versement" || p.nom === "imbibition" ? "le sable s'imbibe ; ses fines restent collées aux grains"
        : p.nom === "repos" ? (tr < 90 ? "le sable se dépose en quelques dizaines de secondes" : "le floculat d'argile se tasse lentement au-dessus du sable")
          : p.nom === "lecture" ? `h1 = ${x.lu1} mm : sommet du floculat` : pistonPose(0) ? `le piston repose sur le sable : h2 = ${x.lu2} mm` : "le piston descend à travers le floculat";
    return [s, leg];
  }

  // ── Courbes : décantation pendant le repos ; tableau des lectures ────────
  function dessinerLent() {
    const tr = tRepos(), lus = lecturesFaites();
    const cle = `${e.cle}|${Math.floor(tr / 20)}|${lus.h1}|${lus.h2.join()}|${e.fini}`;
    if (cle === e.cleCourbe) return;
    e.cleCourbe = cle;
    const zone = c.courbes.querySelector(".dyn-courbe"), tab = c.courbes.querySelector(".dyn-tableau");
    if (!zone) return;
    const T = PHASES[5][1], fin = tr < 0 ? 0 : Math.min(T, tr), x = e.eprouvettes[0];
    const series = [];
    if (tr >= 0) {
      // Éprouvette n° 1 (la seconde suit la même courbe à quelques millimètres près).
      series.push({ points: Array.from({ length: 61 }, (_, q) => (fin * q) / 60).map((t) => {
        const k = (Math.exp(-t / e.tauFloc) - Math.exp(-T / e.tauFloc)) / (1 - Math.exp(-T / e.tauFloc));
        return [t / 60, x.H1 + (H_HAUT - x.H1) * k];
      }), couleur: COULEURS.violet, epaisseur: 2.2, libelle: "sommet du floculat (éprouvette n° 1)" });
      series.push({ points: Array.from({ length: 31 }, (_, q) => (fin * q) / 30).map((t) => [t / 60, x.H2 * 1.03 * (1 - Math.exp(-t / 14)) + x.H2 * 0.25 * Math.exp(-t / 14)]), couleur: COULEURS.gtr24, epaisseur: 2, libelle: "sommet du sable (éprouvette n° 1)" });
    }
    const marques = [];
    if (lus.h1) marques.push({ x: 20, y: x.lu1, couleur: COULEURS.violet, libelle: `h1 = ${x.lu1} mm` });
    if (lus.h2[0]) marques.push({ x: 20, y: x.lu2, couleur: COULEURS.gtr24, libelle: `h2 = ${x.lu2} mm (piston)` });
    zone.innerHTML = graphe({
      largeur: 560, hauteur: 260, xmin: 0, xmax: 20, ymin: 0, ymax: 400, pasX: 2, pasY: 100,
      xlabel: "temps de repos (min)", ylabel: "hauteur (mm)", series, marques,
      zones: [{ x0: 0, x1: 20, y0: H_HAUT - 2, y1: H_HAUT + 2, couleur: "#dc2626", opacite: 0.25 }],
    }) + (tr < 0 ? '<p class="method-note">La décantation se trace pendant les 20 minutes de repos.</p>' : "");
    if (!lus.h1) { tab.innerHTML = ""; return; }
    const lignes = e.eprouvettes.map((x, j) => `<tr><td>n° ${j + 1}</td><td class="n">${x.lu1}</td><td class="n">${lus.h2[j] ? x.lu2 : "—"}</td><td class="n">${lus.h2[j] ? fd(equivalentSable({ h1: x.lu1, h2: x.lu2 }), 1) : "—"}</td></tr>`).join("");
    tab.innerHTML = `<div class="table-large"><table class="resultats"><thead><tr><th>Éprouvette</th><th class="num">h1 (mm)</th><th class="num">h2 (mm)</th><th class="num">ES = 100 h2/h1</th></tr></thead><tbody>${lignes}</tbody></table></div>`;
  }

  function bilan() {
    const es = e.eprouvettes.map((x) => equivalentSable({ h1: x.lu1, h2: x.lu2 }));
    const ES = Math.round((es[0] + es[1]) / 2), vbsSol = e.sol.VBS;
    const grave = e.cle.startsWith("grave"), seuil92 = grave ? 25 : 35, a = grave ? "e" : "";
    const sujet = grave ? "la fraction 0/2 mm de cette grave est" : "ce sable est";
    const propre = ES >= 80 ? "très propre : peu de fines, qui floculent à peine" : ES >= 60 ? "propre : peu de fines, peu argileuses"
      : ES > seuil92 ? `chargé${a} de fines, mais peu argileuses` : `chargé${a} de fines argileuses, qui floculent en abondance`;
    const accord = vbsSol <= 0.2 ? `sa VBS (${fd(vbsSol, 2)}) le dit aussi : fines peu actives` : `sa VBS (${fd(vbsSol, vbsSol < 1 ? 2 : 1)}) le confirme : fines actives, sol sensible à l'eau`;
    const ecart = Math.abs(es[0] - es[1]);
    c.bilan.innerHTML = `<p class="final-result">ES = ${fd(es[0], 1)} et ${fd(es[1], 1)} ⇒ <strong>ES = ${ES}</strong> : ${sujet} ${propre} — ${accord}.
        <small>Essai selon la NF EN 933-8. ${ecart < 0.05 ? "Les deux éprouvettes donnent la même valeur" : `Les deux éprouvettes diffèrent de ${fd(ecart, 1)} point${ecart >= 2 ? "s" : ""}`} (la norme fait recommencer au-delà de 4).
        Au GTR 1992, l'ES pouvait remplacer la VBS pour les sables et graves à moins de 12 % de fines (fines argileuses sous 35 pour un sable, sous 25 pour une grave) ; le GTR 2024 ne classe plus que sur la VBS et l'IP : l'ES reste un contrôle rapide de propreté.</small></p>`;
  }

  b = boucle({ avancer, dessiner, dessinerLent, surFin: () => { dessinerLent(); bilan(); }, surEtat: () => etatBoutons?.(), pasMax: 2 });
  etatBoutons = brancherMarche(c, b, reinit);
  c.commandes.querySelectorAll("select").forEach((x) => x.addEventListener("change", () => { b.raz(); reinit(); etatBoutons(); }));
  reinit();
  etatBoutons();
}
