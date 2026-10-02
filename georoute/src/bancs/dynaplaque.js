// Banc d'essai : la dynaplaque, ou plaque dynamique légère (chapitre 8 ;
// NF P94-117-2). Une masse de 10 kg tombe de 0,72 m le long d'une tige de
// guidage sur un amortisseur à tampons posé sur une plaque de 300 mm : la
// hauteur est réglée pour une impulsion de 7,07 kN en 17 ms environ, soit
// σ = 0,1 MPa sous la plaque. Un capteur logé dans la plaque donne
// l'enfoncement élastique s. À chaque point : trois chutes de mise en place,
// qui assoient la plaque, puis trois chutes de mesure ; s est la moyenne des
// trois dernières et Evd = 1,5 σ a / s = 22,5/s (MPa, s en mm). On relève
// ainsi une ligne de 10 à 20 points ; le profil des Evd, comparé au seuil
// visé, montre l'homogénéité de la portance et ses points faibles.
// Modèle : module « vrai » de la plateforme variable le long de la ligne
// (variabilité lisse et reproductible, point mou éventuel) ; chaque chute
// enfonce la plaque de 22,5/Evd, plus un tassement résiduel qui s'éteint au
// fil des chutes de mise en place.
import { svg, ligne, texte, couche, COULEURS, graphe } from "../figures.js";
import { dynaplaque, classePlateforme, classeArase } from "../gtr/portance.js";
import { charpente, boucle, brancherMarche, lectures, f, fd, r1, esc, duree } from "./moteur.js";
import { fenetreLoupe, blocSol, fleche, etiquette, choc, tige, horloge, W as WL, H as HL, ROUGE, BLEU, ACIER_SOMBRE, TRAIT } from "./loupe.js";
import { bruit, bruitLisse, ecran, lisse, idUnique } from "./chantier-dessin.js";

const HAUTEUR = 0.72, F_MAX = 7.07, AIRE = Math.PI * 0.15 ** 2; // m, kN, m² (plaque Ø 300 mm)
const T_CHUTE = Math.sqrt((2 * HAUTEUR) / 9.81); // 0,38 s de chute libre
const DUREES = { pose: 12, choc: 0.04, rebond: 0.22, remontee: 2.2, lecture: 1.6 }; // s
const MARCHE = 1; // m/s : l'opérateur porte l'appareil (25 kg) d'un point au suivant
const LONGUEUR = 200; // m de ligne
const RESIDUEL = [0.3, 0.13, 0.06, 0.03, 0.018, 0.012]; // tassement résiduel de chaque chute, en part de s

const PLATEFORMES = {
  forme: { nom: "couche de forme granulaire bien compactée", sol: "forme", Evd: 96, cv: 0.07, tassement: 0.6, graine: 3 },
  inegale: { nom: "couche de forme mince, compactage inégal", sol: "forme", Evd: 60, cv: 0.16, tassement: 1.2, graine: 11 },
  arase: { nom: "arase limoneuse humide (limon F1h)", sol: "limon", Evd: 24, cv: 0.13, tassement: 1.6, graine: 5 },
  mou: { nom: "plateforme avec un point mou (tranchée mal compactée)", sol: "forme", Evd: 80, cv: 0.06, tassement: 0.8, graine: 7, creux: { x: 128, l: 5, p: 0.66 } },
};
const PAS = [[10, "20 points, un tous les 10 m"], [12.5, "16 points, un tous les 12,5 m"], [20, "10 points, un tous les 20 m"]];
const SEUILS = [[50, "PF2 : 50 MPa"], [80, "PF2qs : 80 MPa"]];
const VERT = "#15803d";

export function monter(banc) {
  const c = charpente(banc, {
    vitesse: 20, vitesses: [1, 5, 20, 100],
    commandes: `
      <div class="field"><label>Plateforme essayée</label><div class="input-wrap"><select data-r="pf">${Object.entries(PLATEFORMES).map(([k, x]) => `<option value="${k}">${esc(x.nom)}</option>`).join("")}</select></div></div>
      <div class="field"><label>Points de mesure sur 200 m</label><div class="input-wrap"><select data-r="pas">${PAS.map(([v, n]) => `<option value="${v}">${esc(n)}</option>`).join("")}</select></div></div>
      <div class="field"><label>Seuil visé (Evd)</label><div class="input-wrap"><select data-r="seuil">${SEUILS.map(([v, n]) => `<option value="${v}">${esc(n)}</option>`).join("")}</select></div></div>`,
  });
  // Sur téléphone, le tableau des points défile dans sa boîte au lieu d'élargir tout le banc.
  c.bilan.style.minWidth = "0";
  const loupe = fenetreLoupe(c, "la masse sur ses tampons et la plaque", { echelle: { px: 50, libelle: "10 cm" } });
  const uid = idUnique("dyn");
  let e, b, etatBoutons;

  const reinit = () => {
    const pf = PLATEFORMES[c.q('[data-r="pf"]').value], pas = Number(c.q('[data-r="pas"]').value), seuil = Number(c.q('[data-r="seuil"]').value);
    const n = Math.round(LONGUEUR / pas);
    const points = Array.from({ length: n }, (_, i) => {
      const x = pas / 2 + i * pas;
      let E = pf.Evd * (1 + pf.cv * (0.8 * bruitLisse(x, pf.graine) + 0.45 * bruit(i, pf.graine + 1)));
      if (pf.creux) E *= 1 - pf.creux.p * Math.exp(-0.5 * ((x - pf.creux.x) / pf.creux.l) ** 2);
      return { x, EvdVrai: Math.max(6, E) };
    });
    e = { pf, pas, seuil, points, i: 0, k: 0, phase: "pose", minuteur: DUREES.pose, t: 0, xApp: points[0].x, xDepart: points[0].x,
      chutes: [], dernier: null, precedent: null, mesures: [], fini: false };
    c.scene.innerHTML = fond();
    c.courbes.innerHTML = '<div class="dyn-signal" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:10px"></div><div class="dyn-profil"></div>';
    c.bilan.innerHTML = "";
    dessiner(); dessinerLent();
  };

  /** Sol sous la plaque au point courant : la tranchée mal compactée, au droit du point mou. */
  const solEn = (x) => (e.pf.creux && Math.abs(x - e.pf.creux.x) < 1.6 * e.pf.creux.l ? "remblai" : e.pf.sol);

  /**
   * Une chute : enfoncement maximal (mm) et signal force–enfoncement sur 45 ms.
   * La force suit une demi-sinusoïde de 17 ms environ ; la plaque s'enfonce
   * avec un léger retard, remonte en oscillant et garde le tassement résiduel.
   */
  const chute = () => {
    const P = e.points[e.i], g = e.pf.graine * 31 + e.i * 7 + e.k;
    const sEl = (22.5 / P.EvdVrai) * (1 + 0.02 * bruit(g, 3));
    const res = RESIDUEL[e.k] * e.pf.tassement * sEl;
    const s = sEl + res, T = 16.8 + 0.9 * s, Fm = F_MAX * (1 + 0.006 * bruit(g, 4));
    const d = 0.7, Ts = T + 1.2 + 0.6 * s, tp = d + Ts / 2;
    const signal = [];
    for (let j = 0; j <= 180; j++) {
      const t = j * 0.25, F = t <= T ? Fm * Math.sin((Math.PI * t) / T) : 0;
      let w = 0;
      if (t > d && t <= d + Ts) w = sEl * Math.sin((Math.PI * (t - d)) / Ts);
      else if (t > d + Ts) { const u = t - d - Ts; w = -0.09 * sEl * Math.sin((Math.PI * u) / 7) * Math.exp(-u / 6); }
      signal.push({ t, F, sigma: F / AIRE, s: w + res * lisse((t - d) / (tp - d)) });
    }
    e.chutes.push(s);
    e.dernier = { k: e.k, s, res, T, signal, i: e.i };
  };

  /** Fin d'un point : s moyen des trois chutes de mesure et Evd, par le solveur. */
  const conclurePoint = () => {
    const P = e.points[e.i], mes = e.chutes.slice(3);
    const r = dynaplaque({ enfoncements: mes });
    e.mesures.push({ n: e.i + 1, x: P.x, s: mes, sMoyen: r.sMoyen, Evd: r.Evd });
    e.precedent = { n: e.i + 1, chutes: [...e.chutes], sMoyen: r.sMoyen, Evd: r.Evd };
  };

  const suivante = () => {
    switch (e.phase) {
      case "deplacement": e.phase = "pose"; e.minuteur = DUREES.pose; e.xApp = e.points[e.i].x; break;
      case "pose": e.phase = "chute"; e.minuteur = T_CHUTE; break;
      case "chute": chute(); e.phase = "choc"; e.minuteur = DUREES.choc; break;
      case "choc": e.phase = "rebond"; e.minuteur = DUREES.rebond; break;
      case "rebond": e.phase = "remontee"; e.minuteur = DUREES.remontee; break;
      case "remontee": e.phase = "lecture"; e.minuteur = DUREES.lecture; break;
      case "lecture":
        if (e.k < 5) { e.k++; e.phase = "chute"; e.minuteur = T_CHUTE; break; }
        conclurePoint();
        if (e.i >= e.points.length - 1) { e.fini = true; e.phase = "fini"; break; }
        e.xDepart = e.points[e.i].x; e.i++; e.k = 0; e.chutes = [];
        e.phase = "deplacement"; e.minuteur = (e.points[e.i].x - e.xDepart) / MARCHE;
        break;
      default: break;
    }
  };

  const avancer = (dt) => {
    if (e.fini) return false;
    let reste = dt;
    while (reste > 1e-9 && !e.fini) {
      const h = Math.min(reste, e.minuteur);
      e.minuteur -= h; e.t += h; reste -= h;
      if (e.phase === "deplacement") e.xApp = e.points[e.i].x - e.minuteur * MARCHE;
      if (e.minuteur <= 1e-9) suivante();
    }
    return !e.fini;
  };

  // ── Scène : l'appareil en grand (à gauche), son boîtier (à droite), la ligne de mesure (en bas) ──
  const XD = 232, G = 214, KD = 0.2; // axe de l'appareil, sol, px/mm
  const yAmort = G - 7 - 24, yAccroche = yAmort - HAUTEUR * 1000 * KD; // haut de l'amortisseur, bas de la masse accrochée
  const Y0 = 318, X = (m) => 30 + (m * 580) / LONGUEUR, KE = 48 / 150; // ligne de mesure : sol, abscisse, px/MPa

  function fond() {
    return svg({
      largeur: 640, hauteur: 362, titre: "Dynaplaque en cours d'essai", contenu: (id) => {
        let s = `<rect x="10" y="8" width="330" height="224" rx="8" fill="#f8fafc" stroke="${COULEURS.grille}"/>`;
        // Poignée, déclencheur, tige, amortisseur, plaque et masse : dessinés à chaque image.
        s += texte(XD - 22, 21, "poignée et déclencheur", 'text-anchor="end" class="halo" style="font-size:10px;font-weight:700;fill:#334155"');
        // Hauteur de chute.
        s += ligne(XD + 36, yAccroche, XD + 36, yAmort, COULEURS.cote, 1, `marker-start="url(#${id}-fc)" marker-end="url(#${id}-fc)"`);
        s += texte(XD + 42, (yAccroche + yAmort) / 2 - 2, "chute", 'class="halo" style="font-size:10.5px;font-weight:700;fill:#2b2d42"');
        s += texte(XD + 42, (yAccroche + yAmort) / 2 + 11, "0,72 m", 'class="halo" style="font-size:10.5px;font-weight:700;fill:#2b2d42"');
        s += `<g class="dyn-suivi"></g>`;
        s += texte(XD - 12, yAmort + 15, "tampons", 'text-anchor="end" class="halo" style="font-size:10px;font-weight:700;fill:#334155"');
        s += `<g class="dyn-appareil"></g>`;
        // Câble vers le boîtier de mesure.
        s += `<path d="M${XD + 30} ${G - 3}H336Q356 ${G - 3} 356 196" fill="none" stroke="#1e293b" stroke-width="1.6"/>`;
        // Boîtier.
        s += `<rect x="350" y="12" width="280" height="198" rx="12" fill="#334155" stroke="#0f172a" stroke-width="1.2"/>`;
        s += texte(362, 29, "boîtier de mesure", 'style="font-size:10.5px;font-weight:800;fill:#e2e8f0"');
        s += `<g class="dyn-ecran"></g>`;
        // Ligne de mesure : coupe de la plateforme, piquets, échelle des distances.
        s += texte(30, 252, "Ligne de mesure", 'style="font-size:11px;font-weight:800"');
        if (e.pf.sol === "forme") s += couche(id, { x: 30, y: Y0, w: 580, h: 10, sol: "forme" }) + couche(id, { x: 30, y: Y0 + 10, w: 580, h: 14, sol: "limon" });
        else s += couche(id, { x: 30, y: Y0, w: 580, h: 24, sol: "limon" });
        if (e.pf.creux) {
          const xc = X(e.pf.creux.x);
          s += `<path d="M${r1(xc - 9)} ${Y0}L${r1(xc - 5)} ${Y0 + 24}H${r1(xc + 5)}L${r1(xc + 9)} ${Y0}Z" fill="#eadfd2"/><path d="M${r1(xc - 9)} ${Y0}L${r1(xc - 5)} ${Y0 + 24}H${r1(xc + 5)}L${r1(xc + 9)} ${Y0}Z" fill="url(#${id}-remblai)" stroke="#7c6a58" stroke-width=".8"/>`;
        }
        s += ligne(30, Y0, 610, Y0, COULEURS.trait, 1.6);
        for (const P of e.points) s += ligne(X(P.x), Y0, X(P.x), Y0 - 4, COULEURS.trait, 1.2);
        for (let m = 0; m <= LONGUEUR; m += 50) s += ligne(X(m), Y0 + 24, X(m), Y0 + 28, COULEURS.trait, 1) + texte(X(m), Y0 + 39, m === LONGUEUR ? "200 m" : String(m), `text-anchor="${m === LONGUEUR ? "end" : "middle"}" style="font-size:10px;fill:${COULEURS.discret}"`);
        const ys = Y0 - e.seuil * KE;
        s += ligne(30, ys, 610, ys, ROUGE, 1, 'stroke-dasharray="5 3"');
        s += ligne(468, 248, 492, 248, ROUGE, 1.4, 'stroke-dasharray="5 3"') + texte(610, 252, `seuil visé : ${e.seuil} MPa`, `text-anchor="end" style="font-size:10.5px;font-weight:700;fill:${ROUGE}"`);
        s += `<g class="dyn-ligne"></g>`;
        return s;
      },
    });
  }

  /** Bas de la masse (ordonnée) selon la phase du cycle de chute. */
  const basMasse = () => {
    const tau = (d) => d - e.minuteur;
    switch (e.phase) {
      case "chute": { const u = tau(T_CHUTE); return yAccroche + ((0.5 * 9.81 * u * u) / HAUTEUR) * (yAmort - yAccroche); }
      case "choc": return yAmort + 2;
      case "rebond": return yAmort - 12 * Math.sin((Math.PI / 2) * Math.min(1, tau(DUREES.rebond) / 0.11));
      case "remontee": return yAmort - 12 - (yAmort - 12 - yAccroche) * lisse(tau(DUREES.remontee) / DUREES.remontee);
      default: return yAccroche;
    }
  };

  function dessiner() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    const depl = e.phase === "deplacement", leve = depl ? 9 : 0;
    const dz = (e.phase === "choc" && e.dernier ? e.dernier.s : 0) * 20 * KD; // enfoncement exagéré
    // Sol du point courant (sa texture défile quand on porte l'appareil).
    let s = `<clipPath id="${uid}"><rect x="11" y="${G}" width="328" height="${231 - G}"/></clipPath><g clip-path="url(#${uid})">${blocSol(solEn(e.xApp), { x0: 12, x1: 338, y0: G, y1: 231, k: 200, decalageX: -e.xApp * 200 })}</g>`;
    s += ligne(12, G, 338, G, TRAIT, 1.6);
    // Plaque, amortisseur, tige ; masse.
    const yP = G - 7 + dz - leve;
    s += `<rect x="${XD - 30}" y="${r1(yP)}" width="60" height="7" rx="1.5" fill="${ACIER_SOMBRE}" stroke="#1e293b"/>`;
    s += `<path d="M${XD - 30} ${r1(yP + 2)}h-6M${XD + 30} ${r1(yP + 2)}h6" stroke="#1e293b" stroke-width="2.4" stroke-linecap="round"/>`;
    const comp = e.phase === "choc" ? 3 : 0;
    s += `<rect x="${XD - 7}" y="${r1(yAmort + comp + dz - leve)}" width="14" height="${r1(24 - comp)}" rx="2" fill="#1f2937"/>`;
    for (let j = 1; j < 4; j++) s += ligne(XD - 7, yAmort + comp + dz - leve + j * (24 - comp) / 4, XD + 7, yAmort + comp + dz - leve + j * (24 - comp) / 4, "#64748b", 1);
    s += tige(XD, yAccroche - 14 - leve, yAmort + dz - leve, 4);
    s += `<rect x="${XD - 15}" y="${10 - leve}" width="30" height="5" rx="2.5" fill="#1e293b"/><rect x="${XD - 6}" y="${15 - leve}" width="12" height="${r1(yAccroche - 14 - 15)}" rx="2" fill="#475569" stroke="#1e293b" stroke-width=".8"/>`;
    const yM = basMasse() + dz - leve;
    s += `<rect x="${XD - 15}" y="${r1(yM - 14)}" width="30" height="14" rx="2" fill="#475569" stroke="#0f172a"/><rect x="${XD - 13}" y="${r1(yM - 12)}" width="5" height="10" fill="#94a3b8" opacity=".7"/>`;
    if (!depl) s += texte(XD - 20, yM - 3, "masse 10 kg", 'text-anchor="end" class="halo" style="font-size:10px;font-weight:700;fill:#334155"');
    s += texte(XD, G + 13, "plaque Ø 300 mm et son capteur", 'text-anchor="middle" class="halo" style="font-size:10px;font-weight:700;fill:#334155"');
    if (e.phase === "choc" || (e.phase === "rebond" && e.minuteur > DUREES.rebond - 0.08)) s += choc(XD, yAmort + dz, 16);
    if (depl) s += fleche(XD + 40, G - 30, XD + 90, G - 30, "#b45309", 2, 7) + texte(XD + 40, G - 38, `vers ${f(e.points[e.i].x, 4)} m`, 'class="halo" style="font-size:10.5px;font-weight:700;fill:#b45309"');
    svgEl.querySelector(".dyn-appareil").innerHTML = s;
    svgEl.querySelector(".dyn-ecran").innerHTML = ecranBoitier();
    svgEl.querySelector(".dyn-suivi").innerHTML = suiviChutes();
    // Ligne de mesure : barres des Evd mesurés, position de l'appareil.
    let l = "";
    for (const m of e.mesures) {
      const h = Math.min(150, m.Evd) * KE, ok = m.Evd >= e.seuil;
      l += `<rect x="${r1(X(m.x) - 3.5)}" y="${r1(Y0 - h)}" width="7" height="${r1(h)}" fill="${ok ? VERT : ROUGE}" opacity=".85"/>`;
    }
    const xa = X(e.xApp);
    l += `<path d="M${r1(xa)} ${Y0 - 2}V264" stroke="#b45309" stroke-width="1" stroke-dasharray="2 2"/><path d="M${r1(xa - 6)} 258h12l-6 7z" fill="#b45309"/>`;
    svgEl.querySelector(".dyn-ligne").innerHTML = l;
    const M = e.mesures.at(-1);
    c.lectures.innerHTML = lectures([
      ["Point", `${Math.min(e.i + 1, e.points.length)} / ${e.points.length}`, `x = ${f(e.points[e.i].x, 4)} m`],
      ["Chute", e.chutes.length ? `${e.chutes.length} / 6` : "—", e.chutes.length ? (e.chutes.length <= 3 ? "mise en place" : "mesure") : ""],
      ["Enfoncement s", e.dernier ? fd(e.dernier.s, 3) : "—", "mm"],
      ["Evd du dernier point", M ? fd(M.Evd, 1) : "—", "MPa"],
      ["Temps d'essai", duree(e.t), ""],
    ]) + `<p class="banc-etat">${{ pose: "pose de la plaque", deplacement: "transport au point suivant", chute: "chute de la masse", choc: "choc", rebond: "rebond : on rattrape la masse", remontee: "on remonte la masse au déclencheur", lecture: "lecture du boîtier", fini: "ligne terminée" }[e.phase] ?? ""}</p>`;
    loupe(...vueLoupe());
  }

  /** Suivi des six chutes du point : trois de mise en place, trois de mesure (avec leur s). */
  function suiviChutes() {
    const P = e.fini || (!e.chutes.length && e.precedent && (e.phase === "deplacement" || e.phase === "pose")) ? e.precedent : { n: e.i + 1, chutes: e.chutes };
    let s = texte(20, 34, `Chutes du point ${P.n}`, 'style="font-size:10.5px;font-weight:800"');
    for (let j = 0; j < 6; j++) {
      const y = 52 + j * 20, fait = j < P.chutes.length, courant = !P.Evd && j === P.chutes.length && e.phase !== "fini";
      const coul = j < 3 ? "#64748b" : COULEURS.bleu;
      s += `<circle cx="28" cy="${y - 4}" r="7.5" fill="${fait ? coul : "#fff"}" stroke="${courant ? "#b45309" : coul}" stroke-width="${courant ? 2.4 : 1.2}"/>`;
      s += texte(28, y - 0.5, String(j + 1), `text-anchor="middle" style="font-size:10px;font-weight:800;fill:${fait ? "#fff" : coul}"`);
      const t = j < 3 ? "mise en place" : fait ? `s = ${fd(P.chutes[j], 3)} mm` : "mesure";
      s += texte(42, y, t, `style="font-size:10.5px;font-weight:${j >= 3 && fait ? 800 : 600};fill:${j >= 3 && fait ? COULEURS.bleu : "#64748b"}"`);
    }
    s += ligne(20, 166, 140, 166, COULEURS.grille, 1);
    if (P.Evd) s += texte(20, 182, `s moyen ${fd(P.sMoyen, 3)} mm`, 'style="font-size:10.5px;font-weight:700"')
      + texte(20, 198, `Evd = ${fd(P.Evd, 1)} MPa`, `style="font-size:10.5px;font-weight:800;fill:${P.Evd >= e.seuil ? VERT : ROUGE}"`);
    else s += texte(20, 182, "Evd = 22,5 / s moyen", 'style="font-size:10.5px;font-weight:600;fill:#64748b"');
    return s;
  }

  /** Écran du boîtier : tracé de la dernière chute, s de la chute et Evd du point. */
  function ecranBoitier() {
    let s = ecran(362, 38, 256, 160, []);
    const x0 = 376, x1 = 606, y0 = 50, y1 = 124, D = e.dernier;
    s += ligne(x0, y1, x1, y1, "#64748b", 0.8) + ligne(x0, y0, x0, y1, "#64748b", 0.8);
    s += `<text x="${x1}" y="${y1 + 11}" text-anchor="end" style="font-size:10px;fill:#475569">45 ms</text>`;
    if (D) {
      const sMax = Math.max(...D.signal.map((p) => p.s)), X2 = (t) => x0 + (t / 45) * (x1 - x0);
      const pF = D.signal.map((p) => `${r1(X2(p.t))},${r1(y1 - (p.F / 7.5) * (y1 - y0 - 6))}`).join(" ");
      const pS = D.signal.map((p) => `${r1(X2(p.t))},${r1(y1 - (Math.max(p.s, -0.2 * sMax) / sMax) * (y1 - y0 - 14))}`).join(" ");
      s += `<polyline points="${pF}" fill="none" stroke="#b91c1c" stroke-width="1.5"/><polyline points="${pS}" fill="none" stroke="#0369a1" stroke-width="1.8"/>`;
      s += ligne(512, 58, 526, 58, "#b91c1c", 2) + `<text x="530" y="62" style="font-size:10px;font-weight:700;fill:#b91c1c">force</text>`;
      s += ligne(512, 74, 526, 74, "#0369a1", 2) + `<text x="530" y="78" style="font-size:10px;font-weight:700;fill:#0369a1">enfoncement</text>`;
    }
    const M = e.mesures.at(-1), ici = e.mesures.length && M.n === e.i + 1;
    const lignesTexte = [
      [`chute ${D ? `${D.k + 1}/6` : "—"}   s = ${D ? fd(D.s, 3) : "—"} mm`, "#1f2937"],
      [`point ${Math.min(e.i + 1, e.points.length)} : Evd = ${ici ? `${fd(M.Evd, 1)} MPa` : "…"}`, ici ? (M.Evd >= e.seuil ? VERT : ROUGE) : "#1f2937"],
    ];
    lignesTexte.forEach(([t, couleur], j) => { s += `<text x="372" y="${154 + j * 22}" style="font-family:ui-monospace,Consolas,monospace;font-size:12px;font-weight:800;fill:${couleur}">${esc(t)}</text>`; });
    return s;
  }

  // ── Loupe : la masse sur ses tampons, la plaque et le sol (ralenti de la dernière chute) ──
  const KL = 0.5, XC = 88, YS = 128, EXAG = 40, PERIODE = 3; // px/mm, axe, surface du sol, exagération, s
  function vueLoupe() {
    const D = e.dernier && e.dernier.i === e.i && e.phase !== "deplacement" && e.phase !== "pose" ? e.dernier : null;
    let dz = 0, comp = 0, yMasse = null, sigma = 0, approche = false, legende;
    if (!D) {
      legende = e.phase === "deplacement" ? `transport au point ${e.i + 1} (x = ${f(e.points[e.i].x, 4)} m)`
        : e.phase === "pose" ? "pose : on fait pivoter la plaque pour bien l'asseoir" : "masse accrochée au déclencheur, 72 cm plus haut";
    } else {
      // Ralenti ×60 : approche (les 5 derniers cm), choc (30 ms du signal), rebond.
      const ts = e.fini ? 0.8 + ((D.T / 2) * 60) / 1000 : horloge() % PERIODE;
      const sig = (tms) => D.signal[Math.max(0, Math.min(D.signal.length - 1, Math.round(tms / 0.25)))];
      if (ts < 0.8) { yMasse = -25 * (1 - ts / 0.8); approche = true; }
      else {
        const tms = ((ts - 0.8) * 1000) / 60, p = sig(Math.min(tms, 45));
        dz = p.s * EXAG * KL; comp = (7.5 * p.F) / F_MAX; sigma = p.sigma;
        yMasse = tms <= D.T ? comp : -0.5 * (tms - D.T);
      }
      legende = e.fini ? `dernière chute, au plus fort du choc : s = ${fd(D.s, 3)} mm`
        : `ralenti ×60, chute ${D.k + 1}/6 (${D.k < 3 ? "mise en place" : "mesure"}) : s = ${fd(D.s, 3)} mm`;
    }
    // Sol : enfoncé sous la plaque, de moins en moins en profondeur et au-delà du bord.
    const R = 150 * KL, w = (x, y) => dz * (Math.abs(x - XC) <= R ? 1 : Math.exp(-(Math.abs(x - XC) - R) / 14)) / (1 + ((y - YS) / 60) ** 2);
    let s = `<rect width="${WL}" height="${HL}" fill="#f8fafc"/>`;
    s += blocSol(solEn(e.xApp), { x0: 0, x1: WL, y0: YS, y1: HL + 30, k: 500, deplacer: (x, y) => [x, y + w(x, y)] });
    let surf = "M0 " + r1(YS + w(0, YS));
    for (let x = 4; x <= WL; x += 4) surf += `L${x} ${r1(YS + w(x, YS))}`;
    s += `<path d="${surf}L${WL} 0H0Z" fill="#f8fafc"/><path d="${surf}" fill="none" stroke="${TRAIT}" stroke-width="1.4"/>`;
    if (sigma > 3) for (const x of [28, 58, 88, 118, 148]) s += fleche(x, YS + dz + 3, x, YS + dz + 3 + 16 * (sigma / 100), ROUGE, 1.6, 4.5);
    // Plaque et capteur.
    const yP = YS - 10 + dz;
    s += `<rect x="${XC - R}" y="${r1(yP)}" width="${2 * R}" height="10" rx="2" fill="${ACIER_SOMBRE}" stroke="#1e293b"/>`;
    s += `<rect x="${XC + 32}" y="${r1(yP - 7)}" width="18" height="7" rx="1.5" fill="#0f172a"/><path d="M${XC + 50} ${r1(yP - 4)}H${WL}" stroke="#0f172a" stroke-width="1.4"/>`;
    // Tampons d'élastomère, écrasés par le choc ; tige de guidage.
    const hT = 50 - comp, yT = yP - hT;
    for (let j = 0; j < 3; j++) s += `<rect x="${XC - 15}" y="${r1(yT + (j * hT) / 3 + 1)}" width="30" height="${r1(hT / 3 - 2)}" rx="5" fill="#334155"/>`;
    s += tige(XC, 0, yT, 10);
    if (yMasse !== null) {
      const yb = yT + yMasse; // yMasse : écart au haut des tampons (positif quand ils s'écrasent)
      s += `<rect x="${XC - 38}" y="${r1(yb - 35)}" width="76" height="35" rx="3" fill="#475569" stroke="#0f172a"/><rect x="${XC - 34}" y="${r1(yb - 31)}" width="10" height="27" fill="#94a3b8" opacity=".6"/>`;
      s += tige(XC, 0, yb - 35, 10);
      if (approche) s += fleche(9, 6, 9, 34, BLEU, 2, 6) + etiquette(14, 16, "3,8", { couleur: BLEU }) + etiquette(14, 27, "m/s", { couleur: BLEU });
      else if (comp > 1) s += etiquette(4, 13, `F = ${fd((comp / 7.5) * F_MAX, 2)} kN`, { couleur: ROUGE });
    }
    s += etiquette(WL - 5, HL - 6, `déplacements ×${EXAG}`, { ancre: "end", couleur: "#475569" });
    if (D) s += etiquette(WL - 4, yP - 11, "capteur", { ancre: "end", couleur: "#334155" });
    return [s, legende];
  }

  function dessinerLent() {
    const zs = c.courbes.querySelector(".dyn-signal"), zp = c.courbes.querySelector(".dyn-profil");
    if (!zs || !zp) return;
    const D = e.dernier, sMax = D ? Math.max(...D.signal.map((p) => p.s)) : 0.3;
    zs.innerHTML = graphe({
      largeur: 360, hauteur: 210, xmin: 0, xmax: 45, ymin: 0, ymax: 120, pasX: 10, pasY: 20, xlabel: "temps (ms)", ylabel: "σ sous la plaque (kPa)",
      series: D ? [{ points: D.signal.map((p) => [p.t, p.sigma]), couleur: COULEURS.rouge, epaisseur: 2.2, libelle: `chute ${D.k + 1} : σ max ${f(Math.max(...D.signal.map((p) => p.sigma)), 3)} kPa` }] : [],
    }) + graphe({
      largeur: 360, hauteur: 210, xmin: 0, xmax: 45, ymin: Math.min(-0.05, -0.15 * sMax), ymax: sMax * 1.25, pasX: 10, xlabel: "temps (ms)", ylabel: "enfoncement s (mm)",
      series: D ? [{ points: D.signal.map((p) => [p.t, p.s]), couleur: COULEURS.bleu, epaisseur: 2.2, libelle: `s max = ${fd(D.s, 3)} mm` }] : [],
    });
    const M = e.mesures, EMax = Math.max(120, e.seuil * 1.3, ...M.map((m) => m.Evd * 1.15));
    const iMin = M.length ? M.reduce((k, m, j) => (m.Evd < M[k].Evd ? j : k), 0) : -1;
    zp.innerHTML = graphe({
      largeur: 560, hauteur: 230, xmin: 0, xmax: LONGUEUR, ymin: 0, ymax: EMax, pasX: 20, xlabel: "position le long de la ligne (m)", ylabel: "Evd (MPa)",
      zones: [{ x0: 0, x1: LONGUEUR, y0: 0, y1: e.seuil, couleur: ROUGE, opacite: 0.07 }],
      series: [
        { points: [[0, e.seuil], [LONGUEUR, e.seuil]], couleur: ROUGE, tirets: "6 4", epaisseur: 1.6, libelle: `seuil visé : ${e.seuil} MPa (${e.seuil === 80 ? "PF2qs" : "PF2"})` },
        ...(M.length ? [{ points: M.map((m) => [m.x, m.Evd]), couleur: COULEURS.encre, epaisseur: 1.6, marqueurs: true, rayon: 4, couleurs: M.map((m) => (m.Evd >= e.seuil ? VERT : ROUGE)), libelle: "Evd de chaque point" }] : []),
      ],
      marques: e.fini && iMin >= 0 ? [{ x: M[iMin].x, y: M[iMin].Evd, couleur: ROUGE, libelle: `min. ${f(M[iMin].Evd, 3)} MPa` }] : [],
    });
  }

  function bilan() {
    const M = e.mesures, N = M.length, evd = M.map((m) => m.Evd);
    const moy = evd.reduce((a, x) => a + x, 0) / N, min = Math.min(...evd), Pmin = M[evd.indexOf(min)];
    const sous = M.filter((m) => m.Evd < e.seuil), objectif = e.seuil === 80 ? "PF2qs" : "PF2";
    let verdict;
    if (!sous.length) verdict = `les ${N} points dépassent le seuil de ${e.seuil} MPa : la portance est homogène et l'objectif ${objectif} est atteint sur toute la ligne`;
    else if (sous.length === N) verdict = `aucun point n'atteint ${e.seuil} MPa : ${e.pf.sol === "limon" ? `c'est une arase ${classeArase(moy)}, pas une plateforme — il faut une couche de forme (ou un traitement) pour viser ${objectif}` : `la plateforme n'atteint pas l'objectif ${objectif} : il faut la reprendre (compactage, épaisseur de couche de forme)`}`;
    else {
      const a = sous[0].x - e.pas / 2, z = sous.at(-1).x + e.pas / 2, groupe = sous.every((m, j) => !j || m.n === sous[j - 1].n + 1);
      verdict = `${sous.length} point${sous.length > 1 ? "s" : ""} sur ${N} sous le seuil de ${e.seuil} MPa — l'objectif ${objectif} n'est pas atteint partout : ${groupe ? `la zone de ${f(a, 4)} à ${f(z, 4)} m est` : `les points ${sous.slice(0, -1).map((m) => m.n).join(", ")} et ${sous.at(-1).n} sont`} à reprendre avant la réception`;
    }
    const lignesT = M.map((m) => `<tr${m.Evd < e.seuil ? ' class="ko"' : ""}><td class="n">${m.n}</td><td class="n">${f(m.x, 4)}</td>${m.s.map((x) => `<td class="n">${fd(x, 3)}</td>`).join("")}<td class="n">${fd(m.sMoyen, 3)}</td><td class="q">${fd(m.Evd, 1)}</td><td>${m.Evd >= e.seuil ? "≥ seuil" : "sous le seuil"}</td></tr>`).join("");
    c.bilan.innerHTML = `<p class="final-result">Evd moyen <strong>${fd(moy, 1)} MPa</strong>, minimum <strong>${fd(min, 1)} MPa</strong> au point ${Pmin.n} (x = ${f(Pmin.x, 4)} m) : ${verdict}.
        <small>Evd = 22,5/s, s moyen des trois chutes de mesure (NF P94-117-2). Pris pour EV2 sans correction, ${e.pf.sol === "limon" ? `la moyenne classerait l'arase en ${classeArase(moy)} et le point le plus faible en ${classeArase(min)}` : `la moyenne classerait la plateforme en ${classePlateforme(moy)} et le point le plus faible en ${classePlateforme(min)}`} ; mais la dynaplaque mesure un module dynamique, dont la correspondance avec EV2 dépend des matériaux : elle s'établit par une planche d'étalonnage, faute de quoi Evd juge surtout l'homogénéité. Le calculateur du cours refait Evd pour d'autres enfoncements.</small></p>
      <div class="table-large"><table class="resultats"><thead><tr><th class="num">Point</th><th class="num">x (m)</th><th class="num">s1 (mm)</th><th class="num">s2 (mm)</th><th class="num">s3 (mm)</th><th class="num">s moyen (mm)</th><th class="num">Evd (MPa)</th><th>Seuil ${e.seuil} MPa</th></tr></thead><tbody>${lignesT}</tbody></table></div>`;
  }

  b = boucle({ avancer, dessiner, dessinerLent, surFin: bilan, surEtat: () => etatBoutons?.() });
  etatBoutons = brancherMarche(c, b, reinit);
  c.commandes.querySelectorAll("[data-r]").forEach((x) => x.addEventListener("change", () => { b.raz(); reinit(); etatBoutons(); }));
  reinit();
  etatBoutons();
}
