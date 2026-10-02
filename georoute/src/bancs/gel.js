// Banc d'essai : l'essai de gonflement au gel (chapitre 13 ; NF P98-234-2).
// Trois éprouvettes du matériau 0/20 mm, de 70 mm de diamètre et 250 mm de
// hauteur, compactées à l'optimum Proctor et saturées, sont placées dans une
// enceinte : leur base baigne dans l'eau à +1 °C, alimentée par un vase de
// Mariotte, et leur tête est refroidie (ici vers −4 °C). Le front de gel
// descend dans l'éprouvette ; dans un sol fin gélif, la cryosuccion aspire
// l'eau vers le front, où elle gèle en lentilles de glace : l'éprouvette
// gonfle. Des comparateurs lisent le gonflement heure par heure pendant six
// jours ; on le trace en fonction de la racine de l'indice de gel cumulé en
// tête, I (°C·h), et la pente p de cette droite classe le matériau : SGn
// (p ≤ 0,05), SGp (p ≤ 0,4) ou SGt (p > 0,4) [GTR 2024, fascicule 2, annexe 3].
// Modèle : température de tête en exponentielle vers −4 °C ; gonflement de
// chaque éprouvette = p √I, p tiré du catalogue des matériaux avec une petite
// dispersion d'une éprouvette à l'autre ; front de gel vers sa position
// d'équilibre ; lentilles de glace au front, épaissies quand il s'arrête.
import { svg, ligne, texte, COULEURS, graphe } from "../figures.js";
import { penteGel, classeGel } from "../gtr/traitement.js";
import { SOLS } from "./materiaux.js";
import { charpente, boucle, brancherMarche, lectures, f, fd, r1, esc, duree } from "./moteur.js";
import { fenetreLoupe, blocSol, fleche, etiquette, horloge, W as WL, H as HL, BLEU } from "./loupe.js";
import { bruit, comparateur, idUnique } from "./chantier-dessin.js";

const H_EP = 250, D_EP = 70, DUREE_H = 144; // mm, mm, h (six jours)
const THETA = -4, TAU = 3, T_EAU = 1; // °C en tête (asymptote), h, °C à la base
const AIRE = (Math.PI * (D_EP / 20) ** 2); // cm²
/**
 * Matériaux essayés : ceux du catalogue (pente p de l'essai, pGel) ; les deux
 * limons traités ne sont pas au catalogue : leurs pentes sont des valeurs
 * d'école, typiques d'un traitement à la chaux seule et d'un traitement mixte.
 */
const MATERIAUX = {
  limon: { ...SOLS.limon, nom: "limon des plateaux F1 (très gélif)", dessin: "limon" },
  sableArgileux: { ...SOLS.sableArgileux, nom: "sable argileux I2", dessin: "sable" },
  graveArgileuse: { ...SOLS.graveArgileuse, nom: "grave argileuse G3, fraction 0/20", dessin: "grave" },
  graveAlluvionnaire: { ...SOLS.graveAlluvionnaire, nom: "grave alluvionnaire, fraction 0/20 (non gélive)", dessin: "grave" },
  limonChaux: { ...SOLS.limon, nom: "limon traité à 2 % de chaux vive", pGel: 0.12, traite: true, dessin: "traite" },
  limonMixte: { ...SOLS.limon, nom: "limon traité chaux et liant hydraulique", pGel: 0.03, traite: true, dessin: "traite" },
};
const TEINTES = [COULEURS.bleu, COULEURS.gtr24, COULEURS.violet], VERT_REPERE = "#15803d";

/** Température de tête (°C) et indice de gel cumulé en tête (°C·h) au temps t (h). */
const thetaTete = (t) => T_EAU + (THETA - T_EAU) * (1 - Math.exp(-t / TAU));
function indiceGel(t) {
  const t0 = TAU * Math.log((T_EAU - THETA) / -THETA); // passage à 0 °C
  if (t <= t0) return 0;
  return -THETA * (t - t0) + (T_EAU - THETA) * TAU * (Math.exp(-t / TAU) - Math.exp(-t0 / TAU));
}

export function monter(banc) {
  const c = charpente(banc, {
    vitesse: 10000, vitesses: [1000, 10000, 50000],
    commandes: `<div class="field" style="grid-column:span 2"><label>Matériau 0/20 essayé</label><div class="input-wrap"><select data-r="mat">${Object.entries(MATERIAUX).map(([k, m]) => `<option value="${k}">${esc(m.nom)}</option>`).join("")}</select></div></div>
      <p class="method-note" style="grid-column:1/-1">Trois éprouvettes Ø ${D_EP} × ${H_EP} mm ; base dans l'eau à +1 °C, tête refroidie vers −4 °C ; lectures toutes les heures pendant six jours.</p>`,
  });
  const loupe = fenetreLoupe(c, "le front de gel dans l'éprouvette 1", { echelle: { px: 44, libelle: "1 cm" } });
  const uid = idUnique("gel");
  let e, b, etatBoutons;

  const reinit = () => {
    const m = MATERIAUX[c.q('[data-r="mat"]').value];
    const graine = Math.round(m.pGel * 1000) + (m.traite ? 7 : 0);
    const ps = [0, 1, 2].map((i) => m.pGel * (1 + 0.06 * bruit(i + 1, graine)));
    e = { m, ps, graine, t: 0, lectures: [[0, 0, [0, 0, 0]]], lentilles: [[], [], []], fini: false };
    c.scene.innerHTML = fond();
    c.courbes.innerHTML = '<div class="dyn-temps"></div><div class="dyn-racine"></div>';
    c.bilan.innerHTML = "";
    dessiner(); dessinerLent();
  };

  /** Gonflement vrai de l'éprouvette i (mm) et profondeur du front de gel (mm sous la tête d'origine). */
  const gonflement = (i, t) => e.ps[i] * Math.sqrt(indiceGel(t));
  const front = (t) => {
    const th = thetaTete(t);
    if (th >= 0) return 0;
    const zEq = (H_EP * -th) / (-th + T_EAU);
    return zEq * (1 - Math.exp(-Math.sqrt(indiceGel(t)) / 4));
  };

  /** Lecture horaire des trois comparateurs (au 1/100 de mm) ; lentilles de glace formées au front. */
  const lire = (h) => {
    const I = indiceGel(h), zf = front(h);
    const mesures = [0, 1, 2].map((i) => Math.max(0, Math.round((gonflement(i, h) + 0.012 * bruit(h * 3 + i, e.graine)) * 100) / 100));
    [0, 1, 2].forEach((i) => {
      const L = e.lentilles[i], dh = gonflement(i, h) - gonflement(i, h - 1);
      if (!(dh > 0) || e.ps[i] < 0.1) return; // matériau non gélif : glace dans les pores, pas de lentille
      const der = L.at(-1);
      if (der && zf - der.z < 3) der.e += dh; else L.push({ z: zf, e: dh });
    });
    e.lectures.push([h, I, mesures]);
  };

  const avancer = (dt) => {
    if (e.fini) return false;
    const t1 = Math.min(DUREE_H, e.t + dt / 3600);
    for (let h = Math.floor(e.t) + 1; h <= Math.floor(t1 + 1e-9); h++) lire(h);
    e.t = t1;
    if (e.t >= DUREE_H - 1e-9) e.fini = true;
    return !e.fini;
  };

  // ── Scène : l'enceinte, trois éprouvettes, comparateurs, bain d'eau, profil de température ──
  const K = 0.8, YB = 302, XS = [104, 220, 336], L2 = (D_EP * K) / 2; // px/mm, base des éprouvettes, axes
  const yDe = (z) => YB - (H_EP - z) * K; // ordonnée d'une profondeur z (mm sous la tête d'origine), sans gonflement
  const TX = (th) => 486 + ((th + 6) / 8) * 136; // abscisse du profil de température (−6 à +2 °C)
  function fond() {
    return svg({
      largeur: 640, hauteur: 362, titre: "Essai de gonflement au gel", contenu: () => {
        let s = `<rect x="10" y="8" width="438" height="346" rx="12" fill="#e2e8f0" stroke="#64748b" stroke-width="2"/><rect x="20" y="18" width="418" height="326" rx="8" fill="#f0f7fc"/>`;
        s += texte(30, 36, "enceinte de gel", 'style="font-size:11px;font-weight:800;fill:#334155"');
        for (const x of [180, 262, 344, 410]) s += `<path d="M${x} 24v14M${x - 6} 27l12 8M${x + 6} 27l-12 8" stroke="#7dd3fc" stroke-width="1.6" stroke-linecap="round"/>`;
        s += texte(166, 36, "air froid", 'text-anchor="end" style="font-size:10px;font-weight:700;fill:#0369a1"');
        // Portique des comparateurs.
        s += `<rect x="46" y="46" width="354" height="6" rx="2" fill="#64748b"/><rect x="46" y="46" width="6" height="${YB - 58}" fill="#94a3b8"/><rect x="394" y="46" width="6" height="${YB - 58}" fill="#94a3b8"/>`;
        for (const x of XS) s += `<path d="M${x} 52v4" stroke="#475569" stroke-width="2"/>`;
        // Bain d'eau à +1 °C et pierres poreuses.
        s += `<rect x="52" y="${YB - 12}" width="346" height="38" rx="3" fill="#bae6fd" stroke="#0369a1" stroke-width="1"/>`;
        s += texte(225, YB + 22, "eau à +1 °C", 'text-anchor="middle" style="font-size:10.5px;font-weight:800;fill:#075985"');
        for (const x of XS) s += `<rect x="${x - L2 - 3}" y="${YB}" width="${2 * L2 + 6}" height="6" fill="#cbd5e1" stroke="#64748b" stroke-width=".8"/>`;
        // Vase de Mariotte (alimentation en eau).
        s += `<path d="M398 ${YB + 8}H419V${YB - 60}" fill="none" stroke="#0369a1" stroke-width="2"/>`;
        s += texte(437, YB - 186, "vase de", 'text-anchor="end" class="halo" style="font-size:10px;font-weight:700;fill:#334155"') + texte(437, YB - 174, "Mariotte", 'text-anchor="end" class="halo" style="font-size:10px;font-weight:700;fill:#334155"');
        // Profil de température (même échelle verticale que les éprouvettes).
        s += texte(554, 78, "température dans", 'text-anchor="middle" style="font-size:10.5px;font-weight:800"') + texte(554, 91, "l'éprouvette 1 (°C)", 'text-anchor="middle" style="font-size:10.5px;font-weight:800"');
        s += `<rect x="486" y="${yDe(0)}" width="136" height="${YB - yDe(0)}" fill="#fff" stroke="${COULEURS.trait}"/>`;
        for (let th = -6; th <= 2; th += 2) s += ligne(TX(th), yDe(0), TX(th), YB, th === 0 ? "#94a3b8" : COULEURS.grille, th === 0 ? 1.2 : 1) + texte(TX(th), YB + 14, th > 0 ? `+${th}` : String(th).replace("-", "−"), `text-anchor="middle" style="font-size:10px;fill:${COULEURS.discret}"`);
        s += texte(480, yDe(0) + 4, "tête", 'text-anchor="end" style="font-size:10px;fill:#64748b"') + texte(480, YB + 4, "base", 'text-anchor="end" style="font-size:10px;fill:#64748b"');
        s += `<g class="dyn-gel"></g>`;
        return s;
      },
    });
  }

  function dessiner() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    const t = e.t, zf = front(t), th = thetaTete(t), sol = e.m.dessin;
    let s = "";
    XS.forEach((x, i) => {
      const hg = gonflement(i, t), yT = yDe(0) - hg * K, L = e.lentilles[i];
      // Éprouvette : sol non gelé en bas, sol gelé en haut, lentilles de glace.
      s += `<clipPath id="${uid}-${i}"><rect x="${r1(x - L2)}" y="${r1(yT)}" width="${r1(2 * L2)}" height="${r1(YB - yT)}"/></clipPath><g clip-path="url(#${uid}-${i})">`;
      s += blocSol(sol, { x0: x - L2, x1: x + L2, y0: yT, y1: YB, k: 800, decalageY: 0 });
      if (zf > 0) {
        // Les lentilles soulèvent tout ce qui est au-dessus d'elles.
        let dessus = hg;
        const yFront = yDe(zf);
        s += `<rect x="${r1(x - L2)}" y="${r1(yT)}" width="${r1(2 * L2)}" height="${r1(yFront - yT)}" fill="#7dd3fc" opacity=".35"/>`;
        for (let j = L.length - 1; j >= 0; j--) {
          const l = L[j], eP = Math.max(1, l.e * K);
          dessus -= l.e;
          const y = yDe(l.z) - (hg - dessus) * K;
          s += `<rect x="${r1(x - L2)}" y="${r1(y - eP)}" width="${r1(2 * L2)}" height="${r1(eP)}" fill="#f0f9ff" stroke="#38bdf8" stroke-width=".5"/>`;
        }
      }
      s += "</g>";
      if (zf > 0) s += ligne(x - L2 - 4, yDe(zf), x + L2 + 4, yDe(zf), BLEU, 1.3, 'stroke-dasharray="4 3"');
      s += `<rect x="${r1(x - L2)}" y="${r1(yT)}" width="${r1(2 * L2)}" height="${r1(YB - yT)}" fill="none" stroke="#475569" stroke-width="1.4"/>`;
      // Chapeau, tige et comparateur.
      s += `<rect x="${r1(x - L2 - 2)}" y="${r1(yT - 6)}" width="${r1(2 * L2 + 4)}" height="6" rx="1.5" fill="#94a3b8" stroke="#475569"/>`;
      s += `<path d="M${x} ${r1(yT - 6)}V84" stroke="#475569" stroke-width="2"/>`;
      s += comparateur(x, 70, 15, hg, { etiquette: "" }) + texte(x + 20, 64, String(i + 1), `style="font-size:11px;font-weight:800;fill:${TEINTES[i]}"`);
    });
    if (zf > 0) s += texte(XS[0] - L2 - 6, yDe(zf) + 4, "0 °C", `text-anchor="end" class="halo" style="font-size:10px;font-weight:800;fill:${BLEU}"`);
    // Vase de Mariotte : il se vide de l'eau aspirée par les trois éprouvettes.
    const eau = [0, 1, 2].reduce((a, i) => a + (gonflement(i, t) * AIRE) / 10 / 1.09, 0); // cm³
    const hV = 96 * (1 - Math.min(0.9, eau / 400));
    s += `<rect x="406" y="${YB - 166}" width="26" height="106" rx="5" fill="#fff" stroke="#334155" stroke-width="1.3"/><rect x="408" y="${r1(YB - 62 - hV)}" width="22" height="${r1(hV)}" rx="3" fill="#7dd3fc"/>`;
    s += texte(437, YB - 46, `${f(eau, 3)} cm³`, 'text-anchor="end" class="halo" style="font-size:10px;font-weight:700;fill:#0369a1"') + texte(437, YB - 34, "aspirés", 'text-anchor="end" class="halo" style="font-size:10px;font-weight:700;fill:#0369a1"');
    // Profil de température : tête → front à 0 °C → base à +1 °C.
    const yF = yDe(Math.max(zf, 0.001));
    s += `<rect x="486" y="${r1(yDe(0))}" width="136" height="${r1(Math.max(0, yF - yDe(0)))}" fill="#7dd3fc" opacity=".25"/>`;
    s += zf > 0 ? `<polyline points="${r1(TX(th))},${r1(yDe(0))} ${r1(TX(0))},${r1(yF)} ${r1(TX(T_EAU))},${YB}" fill="none" stroke="${COULEURS.rouge}" stroke-width="2"/>`
      : `<polyline points="${r1(TX(th))},${r1(yDe(0))} ${r1(TX(T_EAU))},${YB}" fill="none" stroke="${COULEURS.rouge}" stroke-width="2"/>`;
    s += `<circle cx="${r1(TX(th))}" cy="${r1(yDe(0))}" r="3" fill="${COULEURS.rouge}"/>`;
    s += texte(TX(th) + (th < -2 ? 6 : -6), yDe(0) + 16, `${fd(th, 1).replace("-", "−")} °C`, `text-anchor="${th < -2 ? "start" : "end"}" class="halo" style="font-size:10px;font-weight:800;fill:${COULEURS.rouge}"`);
    if (zf > 0) s += ligne(486, yF, 622, yF, BLEU, 1, 'stroke-dasharray="4 3"') + texte(618, yF - 4, "gelé", `text-anchor="end" class="halo" style="font-size:10px;font-weight:700;fill:${BLEU}"`) + texte(618, yF + 13, "non gelé", 'text-anchor="end" class="halo" style="font-size:10px;font-weight:700;fill:#64748b"');
    svgEl.querySelector(".dyn-gel").innerHTML = s;
    const hm = [0, 1, 2].reduce((a, i) => a + gonflement(i, t), 0) / 3;
    c.lectures.innerHTML = lectures([
      ["Temps d'essai", duree(t * 3600), ""],
      ["Température en tête", fd(th, 1).replace("-", "−"), "°C"],
      ["Indice de gel I", f(indiceGel(t), 3), "°C·h"],
      ["Front de gel", f(zf, 3), "mm sous la tête"],
      ["Gonflement moyen", fd(hm, 2), "mm"],
    ]) + `<p class="banc-etat">${e.fini ? "six jours de gel : essai terminé" : th > 0 ? "la tête se refroidit" : "le front de gel descend"}</p>`;
    loupe(...vueLoupe());
  }

  // ── Loupe : 38 mm de l'éprouvette 1 autour du front de gel ───────────────
  const KL = 4.4, YF = 104; // px/mm ; ordonnée du front dans la loupe
  function vueLoupe() {
    const t = e.t, zf = front(t), hg = gonflement(0, t), L = e.lentilles[0], gelif = e.ps[0] >= 0.1, horl = horloge();
    const vit = e.fini || t < 1 ? 0 : (gonflement(0, t) - gonflement(0, Math.max(0, t - 1))); // mm/h
    // Repère : la vue suit le front (ou la tête tant qu'il n'est pas entré).
    const zc = zf > 0 ? zf : 8, Y = (z) => YF + (z - zc) * KL;
    let s = blocSol(e.m.dessin, { x0: 0, x1: WL, y0: 0, y1: HL, k: 4400, decalageY: zc * KL });
    if (zf > 0) {
      s += `<rect x="0" y="0" width="${WL}" height="${r1(Y(zf))}" fill="#7dd3fc" opacity=".35"/>`;
      // Lentilles : la plus profonde touche le front ; les autres, au-dessus, sont soulevées d'autant.
      let dessus = 0;
      for (let j = L.length - 1; j >= 0; j--) {
        const l = L[j], eP = l.e * KL, y = Y(l.z) - dessus * KL;
        if (y > -10 && y - eP < HL) s += `<rect x="0" y="${r1(y - eP)}" width="${WL}" height="${r1(Math.max(1.2, eP))}" fill="#f0f9ff" stroke="#38bdf8" stroke-width=".8"/>`;
        dessus += l.e;
      }
      s += `<path d="M0 ${r1(Y(zf))}H${WL}" stroke="${BLEU}" stroke-width="1.6" stroke-dasharray="5 3"/>`;
      // Eau aspirée vers le front (cryosuccion), d'autant plus vite que le sol gonfle.
      if (gelif && vit > 0.005 && !e.fini) {
        for (let j = 0; j < 10; j++) {
          const q = (horl * (0.35 + 2.5 * vit) + j / 10) % 1, x = 10 + ((j * 53) % 156);
          s += `<circle cx="${x}" cy="${r1(HL - 6 - q * (HL - 10 - Y(zf)))}" r="2.2" fill="${BLEU}" opacity="${r1(0.9 - 0.5 * q)}"/>`;
        }
        s += fleche(WL - 16, HL - 12, WL - 16, Y(zf) + 10, BLEU, 1.8, 6);
        s += etiquette(WL - 22, HL - 20, "eau aspirée", { ancre: "end", couleur: BLEU });
      }
      s += etiquette(6, Math.max(12, Y(zf) - 6), "front de gel 0 °C", { couleur: BLEU });
      if (Y(zf) > 30) s += etiquette(6, 14, gelif ? "sol gelé et lentilles de glace" : "sol gelé : glace dans les pores", { couleur: "#0369a1" });
    }
    const legende = zf <= 0 ? "la tête se refroidit : le gel n'est pas encore entré"
      : e.fini ? `fin d'essai : ${fd(hg, 2)} mm de gonflement${gelif ? ", surtout en lentilles de glace" : ""}`
        : gelif ? `cryosuccion : l'eau monte vers le front et y gèle en lentilles (${fd(vit, 2)} mm/h)`
          : "le matériau ne retient pas l'eau sous le front : pas de lentille, presque pas de gonflement";
    return [s, legende];
  }

  function dessinerLent() {
    const zt = c.courbes.querySelector(".dyn-temps"), zr = c.courbes.querySelector(".dyn-racine");
    if (!zt || !zr) return;
    const Lc = e.lectures, hMax = Math.max(0.05, ...Lc.map((l) => Math.max(...l[2]))), rMax = Math.sqrt(indiceGel(DUREE_H));
    zt.innerHTML = graphe({
      largeur: 560, hauteur: 230, xmin: 0, xmax: DUREE_H, ymin: 0, ymax: Math.max(hMax * 1.2, 0.5), pasX: 24, xlabel: "temps (h)", ylabel: "gonflement (mm)",
      series: [0, 1, 2].map((i) => ({ points: Lc.map((l) => [l[0], l[2][i]]), couleur: TEINTES[i], epaisseur: 2, libelle: `éprouvette ${i + 1}` })),
    });
    const ps = [0, 1, 2].map((i) => penteGel(Lc.map((l) => [l[1], l[2][i]]))), pm = ps.reduce((a, x) => a + x, 0) / 3;
    const yMax = Math.max(hMax * 1.25, 0.08 * rMax * 1.2);
    zr.innerHTML = graphe({
      largeur: 560, hauteur: 250, xmin: 0, xmax: Math.ceil(rMax / 5) * 5, ymin: 0, ymax: yMax, pasX: 5, xlabel: "√I, racine de l'indice de gel cumulé en tête (√(°C·h))", ylabel: "gonflement (mm)",
      series: [
        { points: [[0, 0], [rMax, 0.05 * rMax]], couleur: VERT_REPERE, tirets: "3 3", epaisseur: 1.5, libelle: "p = 0,05 : limite SGn / SGp" },
        { points: [[0, 0], [rMax, 0.4 * rMax]], couleur: COULEURS.gtr92, tirets: "3 3", epaisseur: 1.5, libelle: "p = 0,4 : limite SGp / SGt" },
        ...[0, 1, 2].map((i) => ({ points: Lc.filter((l, j) => j % 4 === 0 || j === Lc.length - 1).map((l) => [Math.sqrt(l[1]), l[2][i]]), couleur: TEINTES[i], nuage: true, rayon: 2.6, libelle: `éprouvette ${i + 1}` })),
        ...(Lc.length > 6 ? [{ points: [[0, 0], [rMax, pm * rMax]], couleur: COULEURS.encre, epaisseur: 1.8, tirets: "7 3", libelle: `droite de pente p = ${fd(pm, 3)}` }] : []),
      ],
    });
  }

  function bilan() {
    const Lc = e.lectures, ps = [0, 1, 2].map((i) => penteGel(Lc.map((l) => [l[1], l[2][i]]))), p = ps.reduce((a, x) => a + x, 0) / 3;
    const cl = classeGel(p), hm = Lc.at(-1)[2].reduce((a, x) => a + x, 0) / 3;
    const sens = cl.classe === "SGt"
      ? "il ne peut rester dans la zone atteinte par le gel, en PST ou en couche de forme, que protégé par une épaisseur suffisante de matériaux non gélifs — ou bien traité"
      : cl.classe === "SGp" ? "il gonfle modérément, ce dont la vérification au gel de la chaussée tient compte"
        : "il ne gonfle pas et s'emploie sans restriction vis-à-vis de la cryosuccion";
    const traite = e.m.traite
      ? ` Pour une couche de forme traitée, l'insensibilité au gel exige p ≤ 0,05 (GTR 2024, fascicule 1, § 3.2.2) : ${p <= 0.05 ? "c'est le cas" : "ce n'est pas le cas, la chaux seule ne suffit pas"}.`
      : e.m.classe.endsWith("ins") ? ` Pour une grave insensible à l'eau, le GTR regarde aussi la gélifraction (LA ≤ 45 et MDE ≤ 45, ou WA24 ≤ 2 %) : ici LA = ${e.m.LA} et MDE = ${e.m.MDE}, le critère est rempli.` : "";
    c.bilan.innerHTML = `<p class="final-result">Pentes des trois éprouvettes : ${ps.map((x) => fd(x, 3)).join(" · ")} mm/(°C·h)<sup>½</sup> ; moyenne <strong>p = ${fd(p, 3)}</strong> ⇒ classe <strong>${cl.classe}</strong> (${cl.nom}) : ${sens}.${traite}
        <small>Règle du GTR 2024 (fascicule 2, annexe 3) : p ≤ 0,05 non gélif SGn ; 0,05 < p ≤ 0,4 peu gélif SGp ; p > 0,4 très gélif SGt. Gonflement moyen ${fd(hm, 2)} mm pour I = ${f(Lc.at(-1)[1], 3)} °C·h ; p est la pente du gonflement en fonction de √I, ajustée par les moindres carrés passant par l'origine (NF P98-234-2). Le calculateur du cours refait la classe pour une autre pente.</small></p>`;
  }

  b = boucle({ avancer, dessiner, dessinerLent, surFin: () => { dessinerLent(); bilan(); }, surEtat: () => etatBoutons?.(), pasMax: 3600 });
  etatBoutons = brancherMarche(c, b, reinit);
  c.commandes.querySelectorAll("[data-r]").forEach((x) => x.addEventListener("change", () => { b.raz(); reinit(); etatBoutons(); }));
  reinit();
  etatBoutons();
}
