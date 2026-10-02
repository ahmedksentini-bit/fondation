// Banc d'essai : l'essai micro-Deval en présence d'eau (chapitre 4, NF EN
// 1097-1). Le cylindre d'acier reçoit 500 g de gravillons 10/14 mm, 5 000 g
// de billes d'acier de 10 mm et 2,5 L d'eau ; posé sur ses rouleaux, il fait
// 12 000 tours à 100 ± 5 tr/min, soit deux heures : les billes roulent sur
// les gravillons et les usent, l'eau se charge de fines. On retire les billes
// à l'aimant, on lave le matériau sur le tamis de 1,6 mm, on sèche le refus à
// 110 °C et on le pèse : MDE = 100 (500 − m)/500. L'usure au fil des tours
// suit la roche du catalogue (materiaux.js), avec une petite variabilité de
// mesure ; le séchage, de plusieurs heures, défile à ×10 000.
import { svg, texte, COULEURS, graphe, echantillon } from "../figures.js";
import { ROCHES } from "./materiaux.js";
import { microDeval } from "../gtr/roches.js";
import { classerRoche, FAMILLES_ROCHES, SEUILS_2024 } from "../gtr/classification.js";
import { charpente, boucle, brancherMarche, lectures, f, fd, r1, esc, duree } from "./moteur.js";
import { fenetreLoupe, teinte, fleche, etiquette, horloge, W as WL, H as HL } from "./loupe.js";
import { choix, graine, bruit, regulateur, angleTambour, paillasse, ecran, granulat, posteFin, legende, defsAcier, boulet, assouplir } from "./labo-dessin.js";

const MASSE = 500; // g de gravillons 10/14 mm
const TOURS = 12000;
const DUREES = { chargement: 90, separation: 180, tamisage: 300, sechage: 12 * 3600, pesee: 30 };
const ACCELERE = 10000;
const YP = 300, JX = 165, JY = 150, RJ = 74; // paillasse ; axe et rayon intérieur du cylindre (Ø 200 mm)
const ROCHES_MDE = Object.entries(ROCHES).filter(([, r]) => Number.isFinite(r.MDE));
const PHASES = { chargement: "chargement : gravillons, billes et eau", rotation: "rotation sur les rouleaux", separation: "vidange et séparation des billes à l'aimant", tamisage: "lavage sur le tamis de 1,6 mm", sechage: "séchage du refus à 110 °C", pesee: "pesée du refus" };
const BILLES = Array.from({ length: 64 }, (_, i) => ({ u: 2 * ((i * 0.618034 + 0.02) % 1) - 1, v: (i * 0.41421 + 0.07) % 1 }));
const GRAVILLONS = Array.from({ length: 13 }, (_, i) => ({ u: 2 * ((i * 0.381966 + 0.11) % 1) - 1, v: 0.15 + 0.75 * ((i * 0.70711) % 1) }));
/** Part de l'usure finale atteinte après une fraction x des 12 000 tours : l'usure ralentit quand les arêtes sont émoussées. */
const usure = (x) => (1 - Math.exp(-0.6 * x)) / (1 - Math.exp(-0.6));
/** Couleur de l'eau : claire au départ, trouble à mesure qu'elle se charge de fines (k de 0 à 1). */
const eau = (k) => `rgba(${Math.round(125 - 10 * k)},${Math.round(211 - 95 * k)},${Math.round(252 - 150 * k)},${(0.35 + 0.35 * k).toFixed(2)})`;

export function monter(banc) {
  const c = charpente(banc, {
    vitesse: 200, vitesses: [1, 10, 200, 1000],
    commandes: choix("Roche", "roche", ROCHES_MDE.map(([k, r]) => [k, `${r.nom} (${r.famille})`]))
      + '<p class="method-note banc-note" style="grid-column:1/-1;margin:0"></p>',
  });
  const loupe = fenetreLoupe(c, "les billes usent un gravillon", { echelle: { px: 28, libelle: "1 cm" } });
  assouplir(c);
  let e, b, etatBoutons, vit;

  const reinit = () => {
    const cle = c.q('[data-r="roche"]').value, r = ROCHES[cle], g = graine(cle + "mde");
    const refus = Math.round(MASSE * (1 - (r.MDE * (1 + 0.03 * bruit(g, 1))) / 100) * 10) / 10; // g restés sur le tamis de 1,6 mm
    const trMin = 100 + 1.5 * bruit(g, 2);
    const prog = [{ type: "chargement", duree: DUREES.chargement }, { type: "rotation", duree: (TOURS * 60) / trMin }, { type: "separation", duree: DUREES.separation },
      { type: "tamisage", duree: DUREES.tamisage }, { type: "sechage", duree: DUREES.sechage }, { type: "pesee", duree: DUREES.pesee }];
    e = { cle, r, g, refus, perte: MASSE - refus, trMin, prog, k: 0, tp: 0, t: 0, fini: false, cleCourbe: "" };
    c.q(".banc-note").innerHTML = `${esc(r.nom)}, famille ${r.famille} du GTR 2024 (${esc(FAMILLES_ROCHES[r.famille])}). Charge d'un cylindre : ${f(MASSE, 3)} g de gravillons 10/14 mm, 5 000 g de billes d'acier de 10 mm et 2,5 L d'eau.`;
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
  const tours = () => { const p = pas(); return p.type === "chargement" ? 0 : p.type === "rotation" && !e.fini ? (e.tp * e.trMin) / 60 : TOURS; };
  const pese = () => e.fini || (pas().type === "pesee" && e.tp > DUREES.pesee * 0.3);
  /** Trouble de l'eau (0 à 1) : il croît avec l'usure, d'autant plus que la roche s'use. */
  const trouble = () => Math.min(1, (usure(tours() / TOURS) * e.r.MDE) / 45);

  // ── Dessin ──────────────────────────────────────────────────────────────
  function fond() {
    return svg({
      largeur: 640, hauteur: 340, titre: "Machine micro-Deval", contenu: () => {
        let s = defsAcier("mde-acier") + paillasse(YP);
        // Bâti des rouleaux, moteur.
        s += `<rect x="${JX - 98}" y="${YP - 58}" width="196" height="58" rx="6" fill="#e2e8f0" stroke="#64748b" stroke-width="1.3"/>`;
        s += `<g class="dyn"></g>`;
        s += texte(14, 20, `Micro-Deval en présence d'eau · ${f(MASSE, 3)} g de 10/14 mm, 5 kg de billes Ø 10 mm, 2,5 L d'eau · ${f(TOURS, 5)} tours à 100 tr/min`, 'style="font-size:11px;font-weight:700;fill:#334155"');
        s += legende(JX, YP + 33, "cylindre Ø 200 mm sur rouleaux (coupe)") + legende(364, YP + 33, "tamis 1,6 mm") + legende(470, YP + 33, "balance") + legende(576, YP + 33, "étuve");
        return s;
      },
    });
  }

  /** Position dans la charge (billes et gravillons), au fond du cylindre, inclinée de beta. */
  const lit = (u, v, beta, plein = 1) => {
    const Rm = RJ - 5, d0 = Rm - (Rm - 0.28 * RJ) * plein, L = Math.sqrt(Math.max(0, Rm * Rm - d0 * d0));
    const x = u * L * 0.94, yMax = Math.sqrt(Math.max(0, Rm * Rm - x * x)), y = yMax - v * Math.max(0, yMax - d0);
    return [JX + x * Math.cos(beta) - y * Math.sin(beta), JY + x * Math.sin(beta) + y * Math.cos(beta)];
  };

  function dessiner() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    const p = pas(), t = horloge(), n = tours(), x = n / TOURS, coul = e.r.couleur, k = trouble();
    const tourne = p.type === "rotation" && !e.fini;
    const plein = p.type === "chargement" ? Math.min(1, e.tp / (DUREES.chargement * 0.7)) : p.type === "rotation" ? 1 : p.type === "separation" && !e.fini ? 1 - Math.min(1, e.tp / (DUREES.separation * 0.3)) : 0;
    const ang = tourne ? angleTambour(n, e.trMin, vit?.vitesse ?? 1, 0.7) : 0, beta = tourne ? 0.42 : 0;
    let s = "";
    // Rouleaux (ils tournent en sens inverse du cylindre) et compte-tours.
    for (const sg of [-1, 1]) {
      const rx = JX + sg * 60, ry = JY + RJ + 2;
      s += `<circle cx="${rx}" cy="${ry}" r="15" fill="#94a3b8" stroke="#334155" stroke-width="1.4"/>`;
      const a = -ang * 5.3;
      s += `<path d="M${r1(rx - 11 * Math.cos(a))} ${r1(ry - 11 * Math.sin(a))}L${r1(rx + 11 * Math.cos(a))} ${r1(ry + 11 * Math.sin(a))}" stroke="#334155" stroke-width="2"/><circle cx="${rx}" cy="${ry}" r="3" fill="#334155"/>`;
    }
    s += ecran(JX + 6, YP - 46, 84, `${f(Math.floor(n), 5)} tr`, { taille: 12, h: 20 });
    s += `<rect x="${JX - 88}" y="${YP - 46}" width="70" height="34" rx="4" fill="#cbd5e1" stroke="#64748b"/>` + texte(JX - 53, YP - 25, "moteur", 'text-anchor="middle" style="font-size:10px;font-weight:700;fill:#334155"');
    // Cylindre en coupe : l'eau, qui se trouble, et la charge qui cascade.
    s += `<circle cx="${JX}" cy="${JY}" r="${RJ}" fill="#f8fafc"/>`;
    if (plein > 0.02) {
      const yEau = JY + RJ - (RJ * 2 * 0.62) * Math.min(1, plein * 1.1), demi = Math.sqrt(Math.max(0, RJ * RJ - (yEau - JY) ** 2));
      const vague = tourne ? 2.5 * Math.sin(t * 6) : 0;
      s += `<path d="M${r1(JX - demi)} ${r1(yEau - vague)}Q${JX} ${r1(yEau + 2 * vague)} ${r1(JX + demi)} ${r1(yEau + vague)}A${RJ} ${RJ} 0 ${yEau < JY ? 1 : 0} 1 ${r1(JX - demi)} ${r1(yEau - vague)}Z" fill="${eau(k)}"/>`;
      const jit = tourne ? 1.2 : 0;
      BILLES.slice(0, Math.round(BILLES.length * plein)).forEach((q, i) => {
        const [bx, by] = lit(q.u, q.v, beta, plein);
        s += boulet(bx + jit * Math.sin(t * 11 + i), by + jit * Math.cos(t * 9 + i), 3.6, "mde-acier");
      });
      GRAVILLONS.slice(0, Math.round(GRAVILLONS.length * plein)).forEach((q, i) => {
        const [gx, gy] = lit(q.u, q.v, beta, plein);
        s += granulat(gx + jit * Math.sin(t * 8 + i), gy, 6.4 * (1 - 0.25 * x * Math.min(1, e.r.MDE / 50)), e.g + i, { couleur: coul, trait: "#1e293b", arrondi: Math.min(1, 0.05 + x * (0.4 + e.r.MDE / 50)), rot: i });
      });
    }
    // Paroi et couvercle serré par sa barre (elle tourne avec le cylindre).
    s += `<circle cx="${JX}" cy="${JY}" r="${RJ + 3.5}" fill="none" stroke="#64748b" stroke-width="7"/>`;
    s += `<path d="M${r1(JX - 40 * Math.cos(ang))} ${r1(JY - 40 * Math.sin(ang))}L${r1(JX + 40 * Math.cos(ang))} ${r1(JY + 40 * Math.sin(ang))}" stroke="#334155" stroke-width="5" stroke-linecap="round" opacity=".85"/><circle cx="${JX}" cy="${JY}" r="7" fill="#94a3b8" stroke="#334155" stroke-width="1.4"/>`;
    if (tourne) s += `<path d="M${JX + 34} ${JY - 74}A84 84 0 0 1 ${JX + 70} ${JY - 44}" fill="none" stroke="#dc2626" stroke-width="2"/>` + fleche(JX + 64, JY - 52, JX + 72, JY - 40, "#dc2626", 2, 7);
    // Poste de fin d'essai : séparation, tamis, balance, étuve.
    const phaseFin = e.fini ? "fini" : ["separation", "tamisage", "sechage", "pesee"].includes(p.type) ? p.type : "attente";
    s += posteFin({ x0: 316, y: YP, phase: phaseFin, fr: Math.min(1, e.tp / p.duree), couleur: coul, g: e.g, lecture: pese() ? `${fd(e.refus, 1)} g` : "0,0 g", acier: "mde-acier" });
    svgEl.querySelector(".dyn").innerHTML = s;
    const MDE = pese() ? microDeval({ refus16: e.refus, M: MASSE }) : NaN;
    c.lectures.innerHTML = lectures([
      ["Tours", `${f(Math.floor(n), 5)} / ${f(TOURS, 5)}`, ""],
      ["Vitesse de rotation", tourne ? fd(e.trMin + 0.3 * Math.sin(t * 1.1), 1) : "—", "tr/min"],
      ["Temps", duree(e.t), ""],
      ["Refus sec à 1,6 mm", pese() ? fd(e.refus, 1) : "—", "g"],
      ["MDE", Number.isFinite(MDE) ? f(MDE, 2) : "—", ""],
    ]) + `<p class="banc-etat">${e.fini ? "essai terminé" : PHASES[p.type]}${vit?.force ? ` — le banc défile à ×${f(vit.force, 6)}` : ""}</p>`;
    loupe(...vueLoupe());
  }

  // ── Loupe : les billes roulent sur un gravillon et l'usent ; l'eau se trouble ──
  const XC = 88, YC = 86, RB = 14; // centre du gravillon ; rayon d'une bille de 10 mm (2,8 px/mm)
  const FINES = Array.from({ length: 70 }, (_, i) => [(i * 0.618034) % 1, (i * 0.7548) % 1, 0.7 + 0.9 * ((i * 0.31) % 1)]);
  function vueLoupe() {
    const p = pas(), t = horloge(), x = tours() / TOURS, coul = e.r.couleur, k = trouble();
    const tourne = p.type === "rotation" && !e.fini, dans = ["chargement", "rotation"].includes(p.type) && !e.fini;
    const durete = Math.min(1, e.r.MDE / 50), rG = 26 * (1 - 0.22 * x * durete), arr = Math.min(1, 0.05 + x * (0.35 + durete));
    let s = defsAcier("mde-acier-l") + `<rect width="${WL}" height="${HL}" fill="#f8fafc"/>`;
    if (!dans && !e.fini) {
      // Après la rotation : le gravillon lavé, sans ses fines.
      s += `<rect width="${WL}" height="${HL}" fill="#f1f5f9"/>` + granulat(XC, YC, rG, e.g + 7, { couleur: coul, arrondi: arr, n: 8 });
      return [s + etiquette(WL - 6, 14, `${f(TOURS, 5)} tours`, { ancre: "end" }), p.type === "separation" ? "les billes sont retirées à l'aimant" : p.type === "tamisage" ? "lavage : les fines passent le tamis de 1,6 mm" : p.type === "sechage" ? "le refus sèche à 110 °C" : "pesée du refus sec"];
    }
    s += `<rect width="${WL}" height="${HL}" fill="${eau(k)}"/>`;
    // Fines en suspension : de plus en plus nombreuses.
    const nF = Math.round(FINES.length * k);
    FINES.slice(0, nF).forEach(([a, b2, r], i) => {
      const fx = (a * WL + (tourne ? 9 * Math.sin(t * 0.7 + i) : 0) + WL) % WL, fy = (b2 * HL + (tourne ? 7 * Math.cos(t * 0.6 + 2 * i) : 0) + HL) % HL;
      s += `<circle cx="${r1(fx)}" cy="${r1(fy)}" r="${r1(r)}" fill="#78716c" opacity=".7"/>`;
    });
    // Le gravillon s'émousse ; les billes roulent autour et arrachent de petits grains.
    s += granulat(XC, YC, rG, e.g + 7, { couleur: coul, arrondi: arr, n: 8 });
    const w = tourne ? t * 1.3 : 0.4;
    for (let j = 0; j < 5; j++) {
      const a = w + (j * 2 * Math.PI) / 5, d = rG + RB - 2, bx = XC + d * Math.cos(a), by = YC + d * Math.sin(a) * 0.92;
      s += boulet(bx, by, RB, "mde-acier-l");
      if (tourne && durete > 0.1) for (let m = 0; m < 2; m++) { const q = (t * 1.5 + j * 0.37 + m * 0.5) % 1; s += `<circle cx="${r1(XC + (rG - 2 + 16 * q) * Math.cos(a - 0.5))}" cy="${r1(YC + (rG - 2 + 16 * q) * Math.sin(a - 0.5))}" r="1.3" fill="${teinte(coul, 0.6)}" opacity="${r1(1 - q)}"/>`; }
    }
    s += etiquette(WL - 6, 14, `${f(Math.floor(tours()), 5)} tours`, { ancre: "end" });
    const leg = p.type === "chargement" ? "gravillons, billes de 10 mm et 2,5 L d'eau dans le cylindre"
      : durete < 0.25 ? `le ${e.r.nom.toLowerCase()} s'use à peine : l'eau reste presque claire` : durete < 0.7 ? "les billes roulent sur le gravillon et l'usent ; l'eau se charge de fines" : "le gravillon s'arrondit vite et l'eau se trouble";
    return [s, e.fini ? (durete < 0.25 ? "après 12 000 tours : le gravillon a peu perdu, l'eau est à peine troublée" : "après 12 000 tours : gravillon émoussé, eau chargée de fines") : leg];
  }

  // ── Courbe : usure au fil des tours ─────────────────────────────────────
  function dessinerLent() {
    const zone = c.courbes.querySelector(".dyn-courbe");
    if (!zone) return;
    const n = Math.floor(tours() / 50) * 50, cle = `${n}|${pese()}`;
    if (cle === e.cleCourbe) return;
    e.cleCourbe = cle;
    const MDEm = (100 * e.perte) / MASSE, ymax = Math.max(60, MDEm * 1.25), nn = tours();
    const series = [
      { points: nn > 0 ? echantillon((q) => MDEm * usure(q / TOURS), 0, nn, 50) : [], couleur: COULEURS.gtr92, epaisseur: 2.2, libelle: "usure au fil des tours (matériau du banc)" },
      { points: [[0, 10], [TOURS, 10]], couleur: COULEURS.gtr24, tirets: "2 3", epaisseur: 1.3, libelle: "10 : R1" },
      { points: [[0, 25], [TOURS, 25]], couleur: COULEURS.bleu, tirets: "5 3", epaisseur: 1.3, libelle: "25 : R2" },
      { points: [[0, SEUILS_2024.MDE], [TOURS, SEUILS_2024.MDE]], couleur: COULEURS.effort, tirets: "8 4", epaisseur: 1.5, libelle: `${SEUILS_2024.MDE} : R3 et couche de forme` },
    ];
    const MDE = microDeval({ refus16: e.refus, M: MASSE });
    const marques = pese() ? [{ x: TOURS, y: MDE, couleur: COULEURS.encre, guides: true, libelle: `mesure : MDE = ${f(MDE, 2)}` }] : [];
    zone.innerHTML = graphe({ largeur: 560, hauteur: 250, xmin: 0, xmax: TOURS, ymin: 0, ymax, pasX: 2000, xlabel: "nombre de tours", ylabel: "usure (% de la masse)", series, marques });
  }

  function bilan() {
    const MDE = microDeval({ refus16: e.refus, M: MASSE }), r = e.r, cl = classerRoche(r.famille, { ...r, MDE });
    const regle = { Vo: "roche magmatique : R1 si LA ≤ 25 et MDE ≤ 10, R2 si LA ≤ 35 et MDE ≤ 25, R3 si LA ≤ 45 et MDE ≤ 45", Me: "roche métamorphique : R1 si LA ≤ 25 et MDE ≤ 10, R2 si LA ≤ 35 et MDE ≤ 25, R3 si LA ≤ 45 et MDE ≤ 45",
      Li: "calcaire : R3 Li si MDE ≤ 45, sinon R4 ou R5 selon sa masse volumique sèche", Sa: "grès : R3 si LA ≤ 45 et MDE ≤ 45, sinon R4 ou R5 selon IFR et IDGa", Cl: "roche argileuse : la classe dépend aussi de IFR et IDGa" }[r.famille] ?? "";
    const seuil = MDE <= SEUILS_2024.MDE ? `MDE ≤ ${SEUILS_2024.MDE} : le critère MDE du GTR 2024 pour la couche de forme est satisfait (il faut aussi LA ≤ 45)` : `MDE > ${SEUILS_2024.MDE} : la roche s'use trop sous le trafic et en présence d'eau pour une couche de forme non traitée`;
    c.bilan.innerHTML = `<p class="final-result">MDE = 100 × (${f(MASSE, 3)} − ${fd(e.refus, 1)})/${f(MASSE, 3)} = <strong>${f(MDE, 2)}</strong> — ${seuil} ; ${regle} : avec ${r.famille === "Cl" ? `IFR = ${f(r.IFR, 2)} et IDGa = ${f(r.IDGa, 2)}` : r.famille === "Li" ? `ρd = ${fd(r.rhoD, 2)} Mg/m³` : `LA = ${f(r.LA, 2)}`}, classe <strong>${esc(cl.sousClasse ?? "—")}</strong> (${esc(cl.nom ?? cl.motif ?? "")}).
        <small>NF EN 1097-1 : 12 000 tours à 100 ± 5 tr/min, refus au tamis de 1,6 mm après lavage et séchage à 110 °C. Le LA vient de l'essai Los Angeles (banc précédent). Les calculateurs du chapitre refont le classement d'une roche.</small></p>
      <div class="table-large"><table class="resultats"><thead><tr><th class="num">M (g)</th><th class="num">refus sec m à 1,6 mm (g)</th><th class="num">perte M − m (g)</th><th class="num">MDE</th><th class="num">durée de rotation</th></tr></thead>
      <tbody><tr><td class="n">${f(MASSE, 3)}</td><td class="n">${fd(e.refus, 1)}</td><td class="n">${fd(e.perte, 1)}</td><td class="n">${f(MDE, 2)}</td><td class="n">${duree(e.prog[1].duree)} à ${fd(e.trMin, 1)} tr/min</td></tr></tbody></table></div>`;
    e.cleCourbe = ""; dessinerLent();
  }

  b = boucle({ avancer, dessiner, dessinerLent, surFin: bilan, surEtat: () => etatBoutons?.(), pasMax: Infinity });
  etatBoutons = brancherMarche(c, b, reinit);
  vit = regulateur(c, b);
  c.commandes.querySelectorAll("select").forEach((x) => x.addEventListener("change", () => { b.raz(); reinit(); etatBoutons(); }));
  reinit();
  etatBoutons();
}
