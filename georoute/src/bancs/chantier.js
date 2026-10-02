// Banc d'essai : l'atelier d'extraction et de transport (chapitre 15). Une
// pelle hydraulique charge des tombereaux articulés qui portent le déblai au
// remblai, y basculent leur benne et reviennent à vide. Un cycle de godet dure
// une vingtaine de secondes ; un tombereau prend n godets, roule en charge à
// 20 km/h, manœuvre et vide en deux minutes, revient à vide à 35 km/h. Trop de
// camions : ils font la queue à la pelle ; trop peu : la pelle les attend.
// La simulation est à événements discrets (godet versé, fin de godet, départ,
// arrivée au remblai, fin de vidage, retour à la pelle), avec une petite
// variabilité reproductible des durées et du remplissage. Le temps simulé est
// du temps de travail effectif : on le ramène à l'heure de chantier par
// l'efficacité E = 0,83 (50 min utiles par heure). Atelier équilibré, la
// simulation retrouve les formules du solveur : rendement de la pelle
// 3 600 q kr E/(tc Cf) et nombre de tombereaux qui la sature,
// ⌈cycle du tombereau / durée de chargement⌉.
import { svg, texte, COULEURS, graphe } from "../figures.js";
import { pelle as pelleSolveur, tombereau, atelier } from "../gtr/engins.js";
import { creerAlea } from "../exos/alea.js";
import { charpente, boucle, brancherMarche, lectures, f, fd, r1, esc, duree } from "./moteur.js";
import { fenetreLoupe, blocSol, fondSol, teinte, etiquette, W as WL, H as HL } from "./loupe.js";
import { bruit, lisse, idUnique } from "./chantier-dessin.js";

const KR = 0.9, EFF = 0.83, TC = 20, V_CHARGE = 20, V_VIDE = 35, T_FIXE = 120; // paramètres du solveur
const DUREE = 3600; // s : une heure de travail effectif
const MATERIAUX = {
  grave: { nom: "grave sableuse : Cf = 1,15", Cf: 1.15, sol: "grave" },
  limon: { nom: "limon : Cf = 1,25", Cf: 1.25, sol: "limon" },
  argile: { nom: "argile : Cf = 1,30", Cf: 1.3, sol: "argile" },
  roche: { nom: "roche abattue : Cf = 1,50", Cf: 1.5, sol: "roche" },
};
/** Réglages : clé, libellé, valeur de départ, réglette (min max pas), unité. */
const CHAMPS = [
  ["q", "Godet de la pelle (foisonné)", 1.5, "0.8 3 0.1", "m³"],
  ["cap", "Benne des tombereaux (foisonné)", 12, "6 25 0.5", "m³"],
  ["d", "Distance de transport", 800, "100 3000 50", "m"],
  ["n", "Nombre de tombereaux", 4, "1 8 1", ""],
];

/**
 * Atelier simulé à événements discrets. R : réglages { q, cap, d, Cf } ; n :
 * nombre de tombereaux. Tous partent de la file, à la pelle, à t = 0.
 */
export function creerAtelier(R, n) {
  const T = tombereau({ capacite: R.cap, godet: R.q, kr: KR, tcPelle: TC, distance: R.d, vCharge: V_CHARGE, vVide: V_VIDE, tFixe: T_FIXE });
  const A = creerAlea(1009 * n + Math.round(R.q * 10) * 37 + Math.round(R.cap * 2) * 101 + Math.round(R.d / 50) * 7 + Math.round(R.Cf * 100));
  const ecart = (a) => 1 + a * (2 * A.reel() - 1);
  const S = {
    t: 0, T, n, volume: 0, voyages: 0, departs: [], courbe: [[0, 0]], histo: [[0, 1, Math.max(0, n - 1)]], file: [],
    pelle: { camion: null, debut: 0, duree: TC, verse: false, attente: 0, depuis: 0 },
    camions: Array.from({ length: n }, (_, i) => ({ n: i + 1, phase: "file", fin: Infinity, debut: 0, duree: 1, charge: 0, godets: 0, attente: 0, depuis: 0, slot: 0, deLaFile: true })),
  };
  const noter = () => { const h = [S.t, S.pelle.camion === null ? 0 : 1, S.file.length]; const d = S.histo.at(-1); if (d[1] !== h[1] || d[2] !== h[2]) S.histo.push(h); };
  const godet = () => { const p = S.pelle; p.debut = S.t; p.duree = TC * ecart(0.07); p.verse = false; };
  const charger = (i, deLaFile) => {
    const k = S.camions[i];
    S.pelle.camion = i; k.phase = "chargement"; k.attente += S.t - k.depuis; k.debutCharge = S.t; k.deLaFile = deLaFile; k.charge = 0; k.godets = 0;
    godet();
  };
  S.file = S.camions.map((_, i) => i).slice(1);
  charger(0, false);
  const prochain = () => {
    let te = Infinity, act = null;
    const p = S.pelle;
    if (p.camion !== null) { te = p.debut + (p.verse ? 1 : 0.65) * p.duree; act = p.verse ? "fin" : "verse"; }
    S.camions.forEach((k, i) => { if (k.fin < te) { te = k.fin; act = i; } });
    return [te, act];
  };
  const traiter = (act) => {
    const p = S.pelle;
    if (act === "verse") {
      const k = S.camions[p.camion], v = R.q * KR * ecart(0.05);
      k.charge += v; k.godets++; S.volume += v / R.Cf; S.courbe.push([S.t, S.volume]); p.verse = true;
    } else if (act === "fin") {
      const k = S.camions[p.camion];
      if (k.godets < T.godets) godet();
      else {
        k.phase = "aller"; k.debut = S.t; k.duree = T.tAller * ecart(0.04); k.fin = S.t + k.duree; k.slot = S.departs.length % 3;
        S.departs.push([S.t, k.charge / R.Cf, p.camion]);
        p.camion = null; p.depuis = S.t;
        if (S.file.length) charger(S.file.shift(), true);
      }
    } else {
      const k = S.camions[act];
      if (k.phase === "aller") { k.phase = "vidage"; k.debut = S.t; k.duree = T.tFixe * ecart(0.05); k.fin = S.t + k.duree; }
      else if (k.phase === "vidage") { k.phase = "retour"; k.debut = S.t; k.duree = T.tRetour * ecart(0.04); k.fin = S.t + k.duree; k.charge = 0; k.godets = 0; S.voyages++; }
      else {
        k.phase = "file"; k.fin = Infinity; k.depuis = S.t;
        if (p.camion === null) { p.attente += S.t - p.depuis; charger(act, false); } else S.file.push(act);
      }
    }
    noter();
  };
  return {
    S,
    avancerJusqua(tc) {
      for (;;) { const [te, act] = prochain(); if (te > tc) break; S.t = te; traiter(act); }
      S.t = Math.max(S.t, tc);
    },
    /**
     * Rendement en régime établi (m³ en place par heure de chantier, E compris).
     * Une heure tronquée au milieu d'un cycle fausserait le compte quand les
     * camions sont peu nombreux : on compte les tombereaux partis chargés entre
     * deux départs du premier camion — chacun y part une fois par tour —, ou, à
     * défaut, entre le premier et le dernier départ.
     */
    rendement() {
      const D = S.departs, D1 = D.filter((d) => d[2] === 0);
      const [t0, t1] = D1.length >= 2 ? [D1[0][0], D1.at(-1)[0]] : D.length >= 2 ? [D[0][0], D.at(-1)[0]] : [0, 0];
      if (!(t1 > t0)) return (S.volume * EFF * 3600) / Math.max(S.t, 1);
      return (D.filter((d) => d[0] > t0 && d[0] <= t1).reduce((a, d) => a + d[1], 0) * EFF * 3600) / (t1 - t0);
    },
    attentePelle: () => S.pelle.attente + (S.pelle.camion === null ? S.t - S.pelle.depuis : 0),
    attenteCamions: () => S.camions.reduce((a, k) => a + k.attente + (k.phase === "file" ? S.t - k.depuis : 0), 0),
  };
}

// ── Géométrie du plan : piste en boucle (anneau de vitesse), pelle à l'ouest, remblai à l'est ──
const CL = [196, 160], CR = [510, 160], RR = 58, DROIT = CR[0] - CL[0], ARC = (Math.PI * RR) / 2;
const LP = 4 * ARC + 2 * DROIT, UE = 2 * ARC + DROIT, PAS_FILE = 46; // tour complet, point de vidage, intervalle dans la file
const PELLE = [96, 160], R_CAMION = 42; // pelle ; portée vers la benne à quai
/** Point de la piste à l'abscisse curviligne u (u = 0 : quai de chargement) et cap (rad). */
function piste(u) {
  u = ((u % LP) + LP) % LP;
  const arc = (C, phi) => ({ x: C[0] + RR * Math.cos(phi), y: C[1] + RR * Math.sin(phi), a: Math.atan2(-Math.cos(phi), Math.sin(phi)) });
  if (u < ARC) return arc(CL, Math.PI - u / RR);
  if (u < ARC + DROIT) return { x: CL[0] + (u - ARC), y: CL[1] + RR, a: 0 };
  if (u < 3 * ARC + DROIT) return arc(CR, Math.PI / 2 - (u - ARC - DROIT) / RR);
  if (u < 3 * ARC + 2 * DROIT) return { x: CR[0] - (u - 3 * ARC - DROIT), y: CR[1] - RR, a: Math.PI };
  return arc(CL, -Math.PI / 2 - (u - 3 * ARC - 2 * DROIT) / RR);
}
const deg = (a) => r1((a * 180) / Math.PI);

export function monter(banc) {
  const c = charpente(banc, {
    vitesse: 50, vitesses: [1, 10, 50, 200],
    commandes: CHAMPS.map(([k, nom, v, cur, u]) => `<div class="field"><label>${esc(nom)}</label><div class="input-wrap"><input data-r="${k}" type="text" inputmode="decimal" value="${v}" data-curseur="${cur}">${u ? `<span class="unit">${u}</span>` : ""}</div></div>`).join("")
      + `<div class="field"><label>Matériau (foisonnement Cf)</label><div class="input-wrap"><select data-r="mat">${Object.entries(MATERIAUX).map(([k, m]) => `<option value="${k}"${k === "limon" ? " selected" : ""}>${esc(m.nom)}</option>`).join("")}</select></div></div>`,
  });
  const loupe = fenetreLoupe(c, "le godet et la benne", { echelle: { px: 25, libelle: "1 m" } });
  const uid = idUnique("deblai");
  let e, b, etatBoutons;

  const reglages = () => {
    // Chaque valeur est ramenée dans la plage de sa réglette ; une case illisible reprend sa valeur de départ.
    const R = Object.fromEntries(CHAMPS.map(([k, , d, cur]) => {
      const [a, z] = cur.split(" ").map(Number), x = parseFloat(String(c.q(`[data-r="${k}"]`).value).replace(",", "."));
      return [k, Number.isFinite(x) ? Math.min(z, Math.max(a, x)) : d];
    }));
    const m = MATERIAUX[c.q('[data-r="mat"]').value];
    return { ...R, n: Math.round(R.n), Cf: m.Cf, mat: m };
  };
  const solveur = (R, n, E = EFF) => atelier({ q: R.q, kr: KR, E, tc: TC, Cf: R.Cf, capacite: R.cap, distance: R.d, vCharge: V_CHARGE, vVide: V_VIDE, tFixe: T_FIXE, nCamions: n });

  const reinit = () => {
    const R = reglages();
    e = { R, sim: creerAtelier(R, R.n), A: solveur(R, R.n), t: 0, fini: false, parN: null };
    c.scene.innerHTML = fond();
    c.courbes.innerHTML = '<div class="dyn-volume"></div><div class="dyn-flotte"></div>';
    c.bilan.innerHTML = "";
    dessiner(); dessinerLent();
  };

  const avancer = (dt) => {
    if (e.fini) return false;
    e.t = Math.min(DUREE, e.t + dt);
    e.sim.avancerJusqua(e.t);
    if (e.t >= DUREE - 1e-9) e.fini = true;
    return !e.fini;
  };

  // ── Scène : plan du chantier ─────────────────────────────────────────────
  function fond() {
    const { R, A } = e, T = A.tombereau;
    return svg({
      largeur: 640, hauteur: 330, titre: "Atelier pelle et tombereaux, vu de dessus", contenu: (id) => {
        let s = `<rect x="0" y="0" width="640" height="330" fill="#f5f0e6"/>`;
        // Déblai : terrain en place au nord, fond de fouille au sud ; remblai à l'est.
        s += `<rect x="8" y="8" width="126" height="314" rx="6" fill="#e9dfcc"/>`;
        s += `<clipPath id="${uid}"><rect x="8" y="8" width="126" height="314" rx="6"/></clipPath><g class="dyn-front" clip-path="url(#${uid})"></g>`;
        s += texte(16, 30, "terrain en place", 'class="halo" style="font-size:10.5px;font-weight:800"');
        s += texte(16, 300, "fond de fouille", `class="halo" style="font-size:10px;font-weight:700;fill:${COULEURS.discret}"`);
        s += `<rect x="580" y="22" width="54" height="290" rx="6" fill="#efe6d4" stroke="#d6c7a8"/>`;
        s += texte(607, 16, "remblai", 'text-anchor="middle" style="font-size:10.5px;font-weight:800"');
        // Piste en boucle ; sens de circulation.
        const anneau = `M${CL[0]} ${CL[1] - RR}H${CR[0]}A${RR} ${RR} 0 0 1 ${CR[0]} ${CR[1] + RR}H${CL[0]}A${RR} ${RR} 0 0 1 ${CL[0]} ${CL[1] - RR}Z`;
        s += `<path d="${anneau}" fill="none" stroke="#a8a29e" stroke-width="22"/><path d="${anneau}" fill="none" stroke="#d6d3d1" stroke-width="18"/><path d="${anneau}" fill="none" stroke="#fff" stroke-width="1" stroke-dasharray="7 7"/>`;
        s += texte(353, CL[1] - 30, `piste de ${f(R.d, 4)} m (dessin hors échelle)`, 'text-anchor="middle" style="font-size:10.5px;font-weight:800"');
        s += texte(353, CL[1] - 14, `en charge à ${V_CHARGE} km/h : ${fd(T.tAller, 0)} s`, `text-anchor="middle" style="font-size:10px;fill:${COULEURS.discret}"`);
        s += texte(353, CL[1] + 2, `à vide à ${V_VIDE} km/h : ${fd(T.tRetour, 0)} s`, `text-anchor="middle" style="font-size:10px;fill:${COULEURS.discret}"`);
        s += texte(353, CL[1] + 18, `chargement : ${T.godets} godets × ${TC} s = ${T.tChargement} s`, `text-anchor="middle" style="font-size:10px;fill:${COULEURS.discret}"`);
        s += texte(353, CL[1] + 34, `manœuvres et vidage : ${T.tFixe} s`, `text-anchor="middle" style="font-size:10px;fill:${COULEURS.discret}"`);
        for (const [x, y, sens] of [[300, CL[1] + RR, 1], [420, CL[1] + RR, 1], [420, CL[1] - RR, -1], [300, CL[1] - RR, -1]]) s += `<path d="M${x - 5 * sens} ${y - 4}l${10 * sens} 4l${-10 * sens} 4z" fill="#78716c"/>`;
        s += texte(CL[0] + 14, CL[1] - RR - 16, "← retour à vide, file d'attente", 'class="halo" style="font-size:10px;font-weight:700;fill:#57534e"');
        s += texte(CR[0] - 14, CL[1] + RR + 25, "aller en charge →", 'text-anchor="end" class="halo" style="font-size:10px;font-weight:700;fill:#57534e"');
        // Chronogramme de la pelle et de la file.
        s += texte(196, 262, "activité de la pelle", 'style="font-size:10px;font-weight:800"');
        s += texte(560, 262, "vert : elle charge · rouge : elle attend", `text-anchor="end" style="font-size:10px;fill:${COULEURS.discret}"`);
        s += `<rect x="196" y="267" width="364" height="10" fill="#fff" stroke="#cbd5e1"/>`;
        s += texte(196, 296, "camions dans la file", 'style="font-size:10px;font-weight:800"');
        s += `<rect x="196" y="300" width="364" height="18" fill="#fff" stroke="#cbd5e1"/>`;
        s += texte(560, 328, "1 h de travail", `text-anchor="end" style="font-size:10px;fill:${COULEURS.discret}"`);
        s += `<g class="dyn-chrono"></g><g class="dyn-remblai"></g><g class="dyn-engins"></g>`;
        return s;
      },
    });
  }

  /** Ordonnée du front de taille : il recule à mesure que la pelle extrait. */
  const yFront = (x) => 112 - Math.min(14, e.sim.S.volume * 0.025) + 3 * Math.sin(x / 9);

  /** Angle de la tourelle (degrés, 0 = vers la benne, −90 = vers le front) et portée du godet, selon la phase du godet. */
  function poseGodet() {
    const S = e.sim.S, p = S.pelle, rFront = PELLE[1] - yFront(PELLE[0]) + 2;
    if (p.camion === null) return { th: -90, r: rFront, plein: 0, f: -1 };
    const fr = Math.min(1, Math.max(0, (S.t - p.debut) / p.duree));
    if (fr < 0.35) return { th: -90, r: rFront + 6 - 14 * (fr / 0.35), plein: fr / 0.35, f: fr };
    if (fr < 0.55) { const u = lisse((fr - 0.35) / 0.2); return { th: -90 + 90 * u, r: rFront - 8 + (R_CAMION - rFront + 8) * u, plein: 1, f: fr }; }
    if (fr < 0.7) return { th: 0, r: R_CAMION, plein: 1 - lisse((fr - 0.55) / 0.13), f: fr };
    const u = lisse((fr - 0.7) / 0.3);
    return { th: -90 * u, r: R_CAMION + (rFront + 6 - R_CAMION) * u, plein: 0, f: fr };
  }

  /** Tombereau articulé vu de dessus : benne centrée en u, cabine en avant le long de la piste. */
  function camion(u, k, { leve = 0 } = {}) {
    const P = piste(u), Q = piste(u + 21), sol = fondSol(e.R.mat.sol), plein = Math.min(1.08, k.charge / e.A.tombereau.charge);
    let s = `<path d="M${r1(P.x)} ${r1(P.y)}L${r1(Q.x)} ${r1(Q.y)}" stroke="#1f2937" stroke-width="3"/>`;
    s += `<g transform="translate(${r1(P.x)} ${r1(P.y)}) rotate(${deg(P.a)})">`;
    s += `<rect x="-14" y="-7.5" width="28" height="15" rx="2" fill="${leve > 0 ? "#d97706" : "#f59e0b"}" stroke="#78350f"/><rect x="-12" y="-5.5" width="24" height="11" rx="1.5" fill="#92400e"/>`;
    if (plein > 0.02) s += `<ellipse cx="0" cy="0" rx="${r1(11.5 * Math.sqrt(plein))}" ry="${r1(5 * Math.sqrt(plein))}" fill="${sol}" stroke="${teinte(sol)}" stroke-width=".8"/>`;
    if (leve > 0) s += `<path d="M-14 -6L${r1(-14 - 9 * leve)} -8V8L-14 6Z" fill="${sol}" stroke="${teinte(sol)}" stroke-width=".7"/>`;
    s += `</g><g transform="translate(${r1(Q.x)} ${r1(Q.y)}) rotate(${deg(Q.a)})"><rect x="-6.5" y="-7" width="13" height="14" rx="2.5" fill="#fbbf24" stroke="#78350f"/><rect x="3" y="-5.5" width="2.6" height="11" rx="1" fill="#1e3a5f"/></g>`;
    s += `<text x="${r1(Q.x)}" y="${r1(Q.y + 3.6)}" text-anchor="middle" style="font-size:10px;font-weight:800;fill:#0f172a">${k.n}</text>`;
    return s;
  }

  function dessiner() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    const S = e.sim.S, T = e.A.tombereau;
    // Front de taille.
    let fr = "";
    let d = `M8 8H134V${r1(yFront(134))}`;
    for (let x = 134; x >= 8; x -= 4) d += `L${x} ${r1(yFront(x))}`;
    fr += `<path d="${d}Z" fill="${fondSol(e.R.mat.sol)}"/>`;
    fr += blocSol(e.R.mat.sol, { x0: 8, x1: 134, y0: 8, y1: 120, k: 260 });
    fr += `<path d="M8 ${r1(yFront(8) + 0.5)}${Array.from({ length: 33 }, (_, j) => `L${8 + j * 4} ${r1(yFront(8 + j * 4) + 0.5)}`).join("")}V124H8Z" fill="#e9dfcc"/>`;
    fr += `<path d="M8 ${r1(yFront(8))}${Array.from({ length: 33 }, (_, j) => `L${8 + j * 4} ${r1(yFront(8 + j * 4))}`).join("")}" fill="none" stroke="#78350f" stroke-width="2"/>`;
    svgEl.querySelector(".dyn-front").innerHTML = fr;
    // Remblai : les tas déversés, les plus anciens déjà étalés.
    let rb = "";
    for (let i = 0; i < S.voyages; i++) {
      const j = i % 39, x = 593 + (j % 3) * 14 + (Math.floor(j / 3) % 2) * 7, y = 36 + Math.floor(j / 3) * 21.5, vieux = S.voyages - 1 - i >= 12;
      rb += vieux ? `<rect x="${x - 9}" y="${y - 8}" width="18" height="16" rx="3" fill="#e3d6bd"/>` : `<circle cx="${x}" cy="${y}" r="6.5" fill="${fondSol(e.R.mat.sol)}" stroke="${teinte(fondSol(e.R.mat.sol))}" stroke-width="1"/>`;
    }
    svgEl.querySelector(".dyn-remblai").innerHTML = rb;
    // Tombereaux.
    let en = "";
    const occupe = S.pelle.camion !== null, queue = Math.max(0, LP - PAS_FILE * (S.file.length + (occupe ? 1 : 0)));
    S.camions.forEach((k, i) => {
      const prog = Math.min(1, Math.max(0, (S.t - k.debut) / k.duree)), uSlot = UE + (k.slot - 1) * 34;
      let u = 0, leve = 0;
      if (k.phase === "chargement") u = k.deLaFile ? -PAS_FILE * (1 - lisse((S.t - k.debutCharge) / 6)) : 0;
      else if (k.phase === "file") u = LP - PAS_FILE * (S.file.indexOf(i) + 1);
      else if (k.phase === "aller") u = prog * uSlot;
      else if (k.phase === "vidage") { u = uSlot; leve = Math.sin(Math.PI * Math.min(1, prog * 1.6)); }
      else u = Math.min(uSlot + prog * (LP - uSlot), queue);
      en += camion(u, k.phase === "vidage" ? { ...k, charge: k.charge * (1 - lisse(prog * 1.6)) } : k, { leve });
    });
    // Pelle : chenilles, tourelle orientée, flèche et godet.
    const g = poseGodet(), [px, py] = PELLE, th = (g.th * Math.PI) / 180, bx = px + g.r * Math.cos(th), by = py + g.r * Math.sin(th);
    en += `<rect x="${px - 14}" y="${py - 15}" width="7" height="30" rx="3" fill="#1f2937"/><rect x="${px + 7}" y="${py - 15}" width="7" height="30" rx="3" fill="#1f2937"/>`;
    en += `<g transform="translate(${px} ${py}) rotate(${r1(g.th)})"><rect x="-11" y="-10" width="21" height="20" rx="4" fill="#fbbf24" stroke="#92400e"/><rect x="-11" y="-10" width="6" height="20" rx="2" fill="#78350f"/><rect x="2" y="-9" width="7" height="7" rx="1.5" fill="#93c5fd" stroke="#1e3a5f" stroke-width=".7"/></g>`;
    en += `<path d="M${r1(px + 8 * Math.cos(th))} ${r1(py + 8 * Math.sin(th))}L${r1(bx)} ${r1(by)}" stroke="#92400e" stroke-width="7" stroke-linecap="round"/><path d="M${r1(px + 8 * Math.cos(th))} ${r1(py + 8 * Math.sin(th))}L${r1(bx)} ${r1(by)}" stroke="#fbbf24" stroke-width="4.5" stroke-linecap="round"/>`;
    en += `<g transform="translate(${r1(bx)} ${r1(by)}) rotate(${r1(g.th)})"><rect x="-4" y="-6.5" width="9" height="13" rx="2" fill="#334155"/>${g.plein > 0.05 ? `<ellipse cx="1" cy="0" rx="${r1(3.4 * g.plein + 0.6)}" ry="${r1(5 * g.plein + 0.6)}" fill="${fondSol(e.R.mat.sol)}"/>` : ""}</g>`;
    en += texte(px, py + 32, "pelle", 'text-anchor="middle" class="halo" style="font-size:10.5px;font-weight:800"');
    svgEl.querySelector(".dyn-engins").innerHTML = en;
    // Chronogramme.
    let ch = "";
    const X = (t) => 196 + (t / DUREE) * 364;
    S.histo.forEach((h, j) => {
      const t1 = j + 1 < S.histo.length ? S.histo[j + 1][0] : S.t;
      if (t1 <= h[0]) return;
      ch += `<rect x="${r1(X(h[0]))}" y="268" width="${r1(Math.max(0.6, X(t1) - X(h[0])))}" height="8" fill="${h[1] ? "#16a34a" : "#dc2626"}"/>`;
      if (h[2] > 0) ch += `<rect x="${r1(X(h[0]))}" y="${r1(317 - 16 * Math.min(1, h[2] / 7))}" width="${r1(Math.max(0.6, X(t1) - X(h[0])))}" height="${r1(16 * Math.min(1, h[2] / 7))}" fill="#b45309" opacity=".75"/>`;
    });
    ch += `<path d="M${r1(X(S.t))} 264V320" stroke="#0f172a" stroke-width="1.2"/>`;
    svgEl.querySelector(".dyn-chrono").innerHTML = ch;
    const p = S.pelle, kc = p.camion !== null ? S.camions[p.camion] : null;
    c.lectures.innerHTML = lectures([
      ["Volume en place extrait", f(S.volume, 4), "m³"],
      ["Voyages au remblai", String(S.voyages), ""],
      ["Attente de la pelle", fd(e.sim.attentePelle() / 60, 1), "min"],
      ["Attente des camions", fd(e.sim.attenteCamions() / 60, 1), "min, en cumul"],
      ["Temps de travail", duree(S.t), "effectif"],
    ]) + `<p class="banc-etat${kc ? "" : " ko"}">${e.fini ? "heure de travail terminée" : kc ? `la pelle charge le tombereau ${kc.n} : godet ${Math.min(T.godets, kc.godets + (p.verse ? 0 : 1))}/${T.godets}${S.file.length ? ` · ${S.file.length} en file` : ""}` : "la pelle attend un camion"}</p>`;
    loupe(...vueLoupe());
  }

  // ── Loupe : le godet au front de taille, puis au-dessus de la benne (vue de côté) ──
  const CLES = [[0, 60, 62, -90], [0.35, 56, 132, -60], [0.45, 82, 44, 0], [0.55, 128, 40, 0], [0.62, 128, 40, 150], [0.7, 128, 40, 150], [0.85, 90, 30, -20], [1, 60, 62, -90]];
  const cle = (fr) => {
    let j = 0;
    while (j < CLES.length - 2 && fr > CLES[j + 1][0]) j++;
    const [f0, x0, y0, a0] = CLES[j], [f1, x1, y1, a1] = CLES[j + 1], u = lisse((fr - f0) / (f1 - f0));
    return { x: x0 + (x1 - x0) * u, y: y0 + (y1 - y0) * u, a: a0 + (a1 - a0) * u };
  };
  function vueLoupe() {
    const S = e.sim.S, T = e.A.tombereau, sol = e.R.mat.sol, fond = fondSol(sol), p = S.pelle, k = p.camion !== null ? S.camions[p.camion] : null;
    const g = poseGodet(), vEnPlace = (e.R.q * KR) / e.R.Cf;
    let s = `<rect width="${WL}" height="${HL}" fill="#f8fafc"/>`;
    // Front de taille (en place, serré) et fond de fouille.
    s += blocSol(sol, { x0: 0, x1: 60, y0: 46, y1: 150, k: 300 });
    s += `<path d="M50 46L57 150H61V46Z" fill="#f8fafc"/><path d="M0 46H50L57 150" fill="none" stroke="#78350f" stroke-width="1.6"/>`;
    s += blocSol(sol, { x0: 0, x1: WL, y0: 150, y1: HL, k: 300 }) + `<path d="M0 150H${WL}" stroke="#78350f" stroke-width="1.4"/>`;
    s += etiquette(4, 60, "en place");
    // Benne du tombereau à quai, et sa charge foisonnée.
    if (k) {
      const plein = Math.min(1.08, k.charge / T.charge), yN = 112 - 38 * Math.min(1, plein);
      s += `<circle cx="150" cy="131" r="19" fill="#1f2937"/><circle cx="150" cy="131" r="8" fill="#94a3b8"/>`;
      s += `<path d="M104 72L112 114H${WL}V72" fill="#fbbf24" stroke="#92400e" stroke-width="1.6"/><path d="M108 76L114 110H${WL}V76Z" fill="#7c2d12"/>`;
      if (plein > 0.01) {
        s += `<path d="M${r1(111 - (110 - yN) * 0.15)} ${r1(yN)}Q140 ${r1(yN - (plein > 0.95 ? 9 : 3))} ${WL} ${r1(yN - 2)}V110H114Z" fill="${teinte(fond, 1.05)}"/>`;
        for (let j = 0; j < 46; j++) {
          const x = 116 + ((j * 37) % 60) + 3 * bruit(j, 1), y = 108 - ((j * 11) % 34) * Math.min(1, plein) + 2 * bruit(j, 2);
          if (y > yN + 3) s += `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(2.2 + 1.3 * Math.abs(bruit(j, 3)))}" fill="${fond}" stroke="${teinte(fond)}" stroke-width=".7"/>`;
        }
      }
      s += etiquette(WL - 4, 164, `benne : ${k.godets}/${T.godets} godets`, { ancre: "end" });
    }
    // Godet : position et orientation selon la phase ; chute du matériau dans la benne.
    const P = k ? cle(g.f) : { x: 58, y: 134, a: -70 };
    s += `<path d="M${r1(P.x)} ${r1(P.y)}L118 -20" stroke="#92400e" stroke-width="9" stroke-linecap="round"/><path d="M${r1(P.x)} ${r1(P.y)}L118 -20" stroke="#fbbf24" stroke-width="6" stroke-linecap="round"/>`;
    s += `<g transform="translate(${r1(P.x)} ${r1(P.y)}) rotate(${r1(P.a)})">`;
    if (g.plein > 0.02) {
      const h = 22 * Math.min(1, g.plein);
      s += `<rect x="-10.5" y="${r1(22 - h)}" width="21" height="${r1(h)}" rx="5" fill="${teinte(fond, 1.05)}"/>`;
      if (g.plein > 0.9) s += `<path d="M-11 1Q0 -9 11 1Z" fill="${teinte(fond, 1.05)}"/>`;
      for (let j = 0; j < 9; j++) { const y = 20 - ((j * 7) % 22) * Math.min(1, g.plein) - 1; s += `<circle cx="${r1(-7 + ((j * 5) % 14))}" cy="${r1(y)}" r="2.3" fill="${fond}" stroke="${teinte(fond)}" stroke-width=".6"/>`; }
    }
    s += `<path d="M-12 0V14Q-12 23 -3 23H3Q12 23 12 14V0" fill="none" stroke="#334155" stroke-width="3.4" stroke-linejoin="round"/><path d="M12 0l-2.5 -6l-2.5 6z" fill="#334155"/></g>`;
    if (k && g.f >= 0.55 && g.f < 0.7) for (let j = 0; j < 6; j++) {
      const q = (((g.f - 0.55) / 0.15) * 1.6 + j / 6) % 1;
      s += `<circle cx="${r1(P.x + 8 + 6 * bruit(j, 5))}" cy="${r1(P.y + 18 + q * 50)}" r="2.6" fill="${fond}" stroke="${teinte(fond)}" stroke-width=".7"/>`;
    }
    if (k && g.f >= 0.35 && g.f < 0.62) s += P.x < 100 ? etiquette(P.x + 18, P.y + 16, "foisonné", { couleur: "#92400e" }) : etiquette(P.x - 18, P.y + 16, "foisonné", { ancre: "end", couleur: "#92400e" });
    const legende = e.fini ? "heure terminée" : !k ? "la pelle attend un camion : le godet reste vide"
      : g.f < 0.35 ? `le godet arrache ${fd(vEnPlace, 2)} m³ de terrain en place`
        : g.f < 0.55 ? `godet plein : ${fd(e.R.q * KR, 2)} m³ foisonnés = ${fd(vEnPlace, 2)} m³ en place`
          : g.f < 0.7 ? `le godet ${k.godets + (p.verse ? 0 : 1)}/${T.godets} se vide dans la benne` : "le godet vide retourne au front";
    return [s, legende];
  }

  function dessinerLent() {
    const zv = c.courbes.querySelector(".dyn-volume"), zf = c.courbes.querySelector(".dyn-flotte");
    if (!zv || !zf) return;
    const S = e.sim.S, R = e.R;
    const Qp = pelleSolveur({ q: R.q, kr: KR, E: 1, tc: TC, Cf: R.Cf }).Q, Qf = solveur(R, R.n, 1).Qflotte;
    const marches = [[0, 0]];
    for (const [t, V] of S.courbe.slice(1)) marches.push([t / 60, marches.at(-1)[1]], [t / 60, V]);
    marches.push([S.t / 60, S.volume]);
    const yMax = 1.1 * Math.max(Qp, Math.min(Qf, 1.4 * Qp), S.volume);
    zv.innerHTML = graphe({
      largeur: 560, hauteur: 250, xmin: 0, xmax: 60, ymin: 0, ymax: yMax, pasX: 10, xlabel: "temps de travail effectif (min)", ylabel: "volume en place extrait (m³)",
      series: [
        { points: marches, couleur: "#94a3b8", epaisseur: 3.2, libelle: "atelier simulé" },
        { points: [[0, 0], [60, Qp]], couleur: COULEURS.violet, tirets: "6 4", epaisseur: 1.8, libelle: `pelle jamais à l'arrêt : ${f(Qp, 3)} m³/h de travail` },
        { points: [[0, 0], [60, Qf]], couleur: COULEURS.gtr92, tirets: "3 3", epaisseur: 1.8, libelle: `${R.n} tombereau${R.n > 1 ? "x" : ""} jamais en file : ${f(Qf, 3)} m³/h de travail` },
      ],
    });
    if (!e.fini) { zf.innerHTML = ""; return; }
    // Rendement selon la flotte : solveur et simulations d'une heure, de 1 à 8 tombereaux.
    if (!e.parN) e.parN = Array.from({ length: 8 }, (_, j) => { const a = creerAtelier(R, j + 1); a.avancerJusqua(DUREE); return [j + 1, a.rendement()]; });
    const theo = Array.from({ length: 8 }, (_, j) => [j + 1, solveur(R, j + 1).Q]), ns = e.A.nSature;
    const Qmax = Math.max(...theo.map((x) => x[1]), ...e.parN.map((x) => x[1]));
    zf.innerHTML = graphe({
      largeur: 560, hauteur: 250, xmin: 0.5, xmax: 8.5, ymin: 0, ymax: Qmax * 1.2, pasX: 1, xlabel: "nombre de tombereaux", ylabel: "rendement (m³ en place / h)",
      series: [
        { points: theo, couleur: COULEURS.gtr24, epaisseur: 2.2, libelle: "solveur : la plus faible de la pelle et de la flotte" },
        { points: e.parN, couleur: COULEURS.encre, nuage: true, rayon: 4.5, libelle: "simulation d'une heure (E = 0,83 compris)" },
      ],
      marques: [
        ...(ns <= 8 ? [{ x: ns, y: solveur(R, ns).Q, couleur: COULEURS.effort, libelle: `optimum : ${ns} tombereaux` }] : []),
        ...(R.n !== ns ? [{ x: R.n, y: e.parN[R.n - 1][1], couleur: COULEURS.bleu, rayon: 4, libelle: "atelier essayé" }] : []),
      ],
    });
  }

  function bilan() {
    const S = e.sim.S, R = e.R, A = e.A, T = A.tombereau;
    const Qsim = e.sim.rendement(), ap = e.sim.attentePelle() / 60, ac = e.sim.attenteCamions() / 60;
    const limite = A.limite === "la pelle"
      ? `c'est la pelle qui limite l'atelier${R.n > A.nSature ? ` : les camions de trop attendent à la pelle (${f(ac, 3)} min en cumul sur l'heure)` : " : elle ne s'arrête presque jamais"}`
      : `c'est la flotte qui limite l'atelier : la pelle a attendu ${f(ap, 3)} min sur l'heure`;
    c.bilan.innerHTML = `<p class="final-result">Rendement réel de l'atelier : <strong>${f(Qsim, 3)} m³ en place par heure</strong> (une heure de travail simulée, efficacité E = 0,83 comprise ; le solveur donne ${f(A.Q, 3)} m³/h). ${A.nSature <= 8 ? `<strong>${A.nSature} tombereaux</strong> saturent la pelle` : `il faudrait ${A.nSature} tombereaux pour saturer la pelle`} ; avec ${R.n}, ${limite} — et c'est ce débit, en m³ en place, que l'atelier de compactage du remblai doit pouvoir suivre (méthode Q/S).
        <small>${S.departs.length} chargements dans l'heure ; le rendement se compte sur des tours complets de la flotte. Cycle d'un tombereau : ${T.godets} godets × ${TC} s = ${T.tChargement} s de chargement, ${fd(T.tAller, 0)} s en charge, ${T.tFixe} s de manœuvres et de vidage, ${fd(T.tRetour, 0)} s à vide : ${fd(T.cycle, 0)} s ; tombereaux pour saturer la pelle : ⌈${fd(T.cycle, 0)}/${T.tChargement}⌉ = ${A.nSature}. Pelle seule : Q = 3 600 q k<sub>r</sub> E/(t<sub>c</sub> C<sub>f</sub>) = ${f(A.pelle.Q, 3)} m³/h ; flotte de ${R.n} : ${f(A.Qflotte, 3)} m³/h. Le calculateur du cours refait ces calculs.</small></p>`;
  }

  b = boucle({ avancer, dessiner, dessinerLent, surFin: bilan, surEtat: () => etatBoutons?.() });
  etatBoutons = brancherMarche(c, b, reinit);
  c.commandes.querySelectorAll("[data-r]").forEach((x) => x.addEventListener("change", () => { b.raz(); reinit(); etatBoutons(); }));
  reinit();
  etatBoutons();
}
