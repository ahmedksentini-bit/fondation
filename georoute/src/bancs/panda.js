// Banc d'essai : le pénétromètre dynamique léger à énergie variable, type
// PANDA (chapitre 8 ; XP P94-105). L'opérateur frappe au marteau la tête de
// battage ; à chaque coup, la tête mesure l'énergie transmise et le capteur
// d'enfoncement la descente de la pointe. La résistance de pointe vient de la
// formule des Hollandais, qd = (1/A) · E · M/(M + P) / e, et le pénétrogramme
// qd(z) se trace en direct. On le compare à une droite de référence et à une
// droite limite propres au matériau et à l'objectif de densification : là où
// le profil passe sous la droite limite, le compactage est insuffisant.
//
// Les droites du banc sont illustratives : la norme les donne, matériau par
// matériau, dans un catalogue établi par étalonnage, que nous n'avons pas.
// Elles sont construites ici avec une loi supposée, qd ∝ τ¹² (τ taux de
// compactage) — qd croît très vite avec la densité —, et le même effet de
// confinement près de la surface que le terrain virtuel. Appareil virtuel :
// masse frappante M = 2 kg ; masse frappée P = tête de battage 1,3 kg, tiges
// de 0,5 m (0,6 kg chacune), pointe 0,05 kg ; pointe de 2 cm², ou de 4 cm²
// dans les graves.
import { svg, ligne, texte, COULEURS, graphe } from "../figures.js";
import { OBJECTIFS } from "../gtr/compactage.js";
import { SOLS } from "./materiaux.js";
import { charpente, boucle, brancherMarche, lectures, coupe, axeProfondeur, panneau, points, fd, r1, esc, duree } from "./moteur.js";
import { fenetreLoupe, vueTerrain, tige, choc, fleche, etiquette, W as WL, H as HL, ROUGE, ACIER_SOMBRE } from "./loupe.js";
import { ETATS_COUCHE, profilEtat, qdHollandais, enfoncementHollandais, bruitLisse, gauss, hasard, graineDe, borne, contenirLargeur } from "./controle-dessin.js";

const M = 2, TETE = 1.3, TIGE = 0.6, POINTE = 0.05, LTIGE = 0.5; // kg, kg, kg par tige, kg, m
const CYCLE = 1.4, LEVER = 0.95, FRAPPE = 0.15; // s : un coup toutes les 1,4 s
const AJOUT = 15; // s pour visser une tige
const PUISSANCE = 12; // loi illustrative qd ∝ τ¹²
const ZC = 0.3; // m : profondeur sous laquelle le confinement ne croît plus
/** Résistance de pointe de chaque sol compacté à 100 % de ρdOPN, sous la profondeur critique (MPa), et dispersion. */
const RESISTANCE = {
  limon: [10, 0.1], argile: [7, 0.1], sableArgileux: [11, 0.12], sableDune: [8, 0.12],
  graveAlluvionnaire: [20, 0.22], graveArgileuse: [15, 0.2], graveConcassee: [24, 0.22],
};
const SOUS = {
  remblai: { nom: "remblai compacté", qd: 8, sol: "remblai" },
  arase: { nom: "arase limoneuse humide (AR1)", qd: 3, sol: "limon" },
  grave: { nom: "grave compacte", qd: 20, sol: "grave" },
};
const confinement = (z) => 0.45 + 0.55 * Math.min(1, Math.max(0, z) / ZC);

export function monter(banc) {
  const c = charpente(banc, {
    vitesse: 5, vitesses: [1, 2, 5, 20],
    commandes: `
      <div class="field"><label>Matériau de la couche</label><div class="input-wrap"><select data-r="mat">${Object.entries(SOLS).map(([k, s]) => `<option value="${k}">${esc(s.nom)} (${esc(s.classe)})</option>`).join("")}</select></div></div>
      <div class="field"><label>Objectif de densification</label><div class="input-wrap"><select data-r="obj">${Object.entries(OBJECTIFS).map(([k, o]) => `<option value="${k}">${esc(o.nom)}</option>`).join("")}</select></div></div>
      <div class="field"><label>Épaisseur de la couche</label><div class="input-wrap"><input data-r="ep" type="text" inputmode="decimal" value="0.35" data-curseur="0.2 0.6 0.05"><span class="unit">m</span></div></div>
      <div class="field"><label>Compactage de la couche</label><div class="input-wrap"><select data-r="etat">${Object.entries(ETATS_COUCHE).map(([k, x]) => `<option value="${k}">${esc(x.nom)}</option>`).join("")}</select></div></div>
      <div class="field"><label>Couche sous-jacente</label><div class="input-wrap"><select data-r="sous">${Object.entries(SOUS).map(([k, x]) => `<option value="${k}">${esc(x.nom)}</option>`).join("")}</select></div></div>
      <p class="method-note" style="grid-column:1/-1">Repères illustratifs : les droites de référence et limite sont construites ici avec une loi supposée, qd ∝ (taux de compactage)¹² ; en pratique, droites du catalogue de la norme XP P94-105 ou étalonnage sur planche.</p>`,
  });
  contenirLargeur(c);
  const loupe = fenetreLoupe(c, "la pointe dans la couche", { echelle: { px: 40, libelle: "2 cm" } });
  const val = (r) => c.q(`[data-r="${r}"]`).value;
  let e, b, etatBoutons, signature = "";

  const reinit = () => {
    const cle = val("mat"), sol = SOLS[cle], obj = val("obj"), etat = val("etat"), sous = SOUS[val("sous")];
    const ep = borne(Math.round(parseFloat(String(val("ep")).replace(",", ".")) * 100) / 100 || 0.35, 0.2, 0.6);
    const [Q, sigma] = RESISTANCE[cle] ?? [10, 0.12], grave = /^G/.test(sol.classe), A = grave ? 4 : 2;
    const pr = profilEtat(etat, ep), o = OBJECTIFS[obj];
    const g = graineDe(`${cle}|${obj}|${etat}|${ep}|${val("sous")}`), lisse = bruitLisse(g, [[45, 0.5], [97, 0.3], [180, 0.2]]);
    // Terrain virtuel : la couche (loi illustrative), puis la couche sous-jacente, que la pointe sent un peu avant d'y entrer.
    const qdCouche = (z) => Q * confinement(z) * (pr.taux(Math.min(z, ep)) / 100) ** PUISSANCE;
    const qdVrai = (z) => {
      const u = borne((z - (ep - 0.01)) / 0.03, 0, 1), m = u * u * (3 - 2 * u);
      return ((1 - m) * qdCouche(z) + m * sous.qd) * (1 + sigma * lisse(z));
    };
    const droite = (taux) => (z) => Q * confinement(z) * (taux / 100) ** PUISSANCE;
    e = {
      cle, sol, obj, o, etat, sous, ep, Q, A, grave, pr, qdVrai, g, ref: droite(o.moyen), lim: droite(o.fond),
      zMax: Math.min(1, ep + 0.3), z: 0, t: 0, phase: 0, coups: [], tiges: 1, pauseTige: 0, fini: false, zones: null,
    };
    e.vMax = Math.ceil((Math.max(Q * 1.25, sous.qd * 1.2, e.ref(ZC)) * 1.15) / 5) * 5;
    c.scene.innerHTML = fond();
    c.courbes.innerHTML = '<div class="dyn-penetro"></div><div class="dyn-coups"></div>';
    c.bilan.innerHTML = "";
    signature = "";
    dessiner(); dessinerLent();
  };

  const masseFrappee = () => TETE + TIGE * e.tiges + POINTE;
  const hauteurTete = () => LTIGE * e.tiges + 0.05 - e.z; // m au-dessus du sol

  /** Un coup de marteau : l'opérateur dose son coup pour enfoncer la pointe de quelques millimètres. */
  const frapper = () => {
    const n = e.coups.length, P = masseFrappee(), qd = e.qdVrai(e.z + 0.002) * Math.exp(0.08 * gauss(n, e.g));
    const Evise = (qd * e.A * 6 * (M + P)) / (10 * M); // énergie qui enfoncerait la pointe de 6 mm
    const E = borne(Evise * (0.75 + 0.5 * hasard(n, 3, e.g)), 5, 65);
    const pen = enfoncementHollandais({ E, M, P, A: e.A, qd });
    // Mesures : énergie à 2 % près (capteurs de la tête), enfoncement au dixième de millimètre.
    const Emes = E * (1 + 0.02 * gauss(n + 500, e.g)), emes = Math.max(0.1, Math.round(pen * 10) / 10);
    const z0 = e.z;
    e.z = Math.min(e.zMax, e.z + pen / 1000);
    e.coups.push({ n: n + 1, z0, z: e.z, E: Emes, e: emes, P, qd: qdHollandais({ E: Emes, M, P, A: e.A, e: emes }) });
    if (e.z >= e.zMax - 1e-9) { e.fini = true; e.zones = analyser(); }
    else if (hauteurTete() < 0.08) { e.tiges++; e.pauseTige = AJOUT; }
  };

  const avancer = (dt) => {
    if (e.fini) return false;
    let reste = dt;
    while (reste > 1e-9 && !e.fini) {
      if (e.pauseTige > 0) { const h = Math.min(reste, e.pauseTige); e.pauseTige -= h; e.t += h; reste -= h; continue; }
      const cible = e.phase < LEVER + FRAPPE ? LEVER + FRAPPE : CYCLE, h = Math.min(reste, cible - e.phase);
      e.phase += h; e.t += h; reste -= h;
      if (cible === LEVER + FRAPPE && e.phase >= cible - 1e-9) frapper();
      if (e.phase >= CYCLE - 1e-9) e.phase = 0;
    }
    return !e.fini;
  };

  /**
   * Lecture du pénétrogramme dans la couche : qd moyen par centimètre, lissé
   * sur 5 cm sans franchir le fond de couche, comparé aux deux droites. Les
   * zones sous la droite limite, d'au moins 2 cm, sont les anomalies.
   */
  function analyser() {
    const n = Math.round(e.ep * 100) - 1, brut = [];
    for (let i = 0; i < n; i++) {
      const a = i / 100, b2 = (i + 1) / 100, dans = e.coups.filter((k) => (k.z0 + k.z) / 2 >= a && (k.z0 + k.z) / 2 < b2);
      brut.push(dans.length ? dans.reduce((s, k) => s + Math.log(k.qd), 0) / dans.length : NaN);
    }
    for (let i = 0; i < n; i++) if (!Number.isFinite(brut[i])) { // centimètre traversé d'un seul coup : valeur voisine
      const j = [i - 1, i + 1, i - 2, i + 2].find((k) => Number.isFinite(brut[k]));
      brut[i] = j === undefined ? Math.log(e.Q) : brut[j];
    }
    const lisse = brut.map((_, i) => { const v = brut.slice(Math.max(0, i - 2), Math.min(n, i + 3)); return Math.exp(v.reduce((s, x) => s + x, 0) / v.length); });
    const zones = [];
    let debut = null;
    lisse.forEach((q, i) => {
      const sousLim = q < e.lim(i / 100 + 0.005);
      if (sousLim && debut === null) debut = i;
      if ((!sousLim || i === n - 1) && debut !== null) {
        const fin = sousLim ? i + 1 : i;
        if (fin - debut >= 2) zones.push({ z0: debut / 100, z1: fin / 100, qd: lisse.slice(debut, fin).reduce((s, x) => s + x, 0) / (fin - debut), qdLim: e.lim((debut + fin) / 200) });
        debut = null;
      }
    });
    // Deux zones séparées de 2 cm au plus n'en font qu'une.
    for (let i = zones.length - 1; i > 0; i--) {
      const a = zones[i - 1], b2 = zones[i];
      if (b2.z0 - a.z1 <= 0.02 + 1e-9) {
        const la = a.z1 - a.z0, lb = b2.z1 - b2.z0;
        zones.splice(i - 1, 2, { z0: a.z0, z1: b2.z1, qd: (a.qd * la + b2.qd * lb) / (la + lb), qdLim: e.lim((a.z0 + b2.z1) / 2) });
      }
    }
    // Le dernier centimètre, que la couche sous-jacente perturbe, suit le centimètre au-dessus.
    const z = zones.at(-1);
    if (z && z.z1 >= n / 100 - 1e-9) z.z1 = e.ep;
    const entre = lisse.filter((q, i) => q < e.ref(i / 100 + 0.005) && q >= e.lim(i / 100 + 0.005)).length / n;
    return { liste: zones, lisse, tolerance: entre };
  }

  // ── Scène : la coupe et l'appareil, le pénétrogramme en direct ──
  const G = { yS: 176, bas: 462, xT: 118, kh: 190 };
  const Y = (z) => G.yS + (z / e.zMax) * (G.bas - G.yS);
  const yHaut = (h) => G.yS - h * G.kh; // au-dessus du sol, échelle réduite

  function fond() {
    return svg({
      largeur: 640, hauteur: 492, titre: "Pénétromètre dynamique léger en cours d'essai", contenu: (id) => {
        const couches = [{ z0: 0, z1: e.ep, sol: e.sol.motif, nom: "couche contrôlée" }, { z0: e.ep, z1: 3, sol: e.sous.sol, nom: e.sous.nom }];
        let s = coupe(id, { x0: 10, x1: 232, Y, couches, zMax: e.zMax });
        // Terminal de dialogue, relié à la tête de battage.
        s += `<rect x="16" y="62" width="64" height="44" rx="6" fill="#e2e8f0" stroke="${COULEURS.betonTrait}" stroke-width="1.3"/><rect x="22" y="68" width="52" height="20" rx="2" fill="#0f172a"/>`;
        s += texte(48, 56, "terminal", 'text-anchor="middle" style="font-size:10px;font-weight:700;fill:#334155"');
        s += texte(234, 40, "au-dessus du sol :", `text-anchor="end" style="font-size:10px;fill:${COULEURS.discret}"`) + texte(234, 52, "échelle réduite", `text-anchor="end" style="font-size:10px;fill:${COULEURS.discret}"`);
        s += `<g class="dyn-appareil"></g>`;
        s += axeProfondeur({ x: 262, Y, zMax: e.zMax, pas: e.zMax > 0.75 ? 0.1 : 0.05 });
        const pQ = panneau({ x0: 276, x1: 630, Y, zMax: e.zMax, vMax: e.vMax, titre: `qd (MPa) · objectif ${e.obj}`, pas: e.vMax > 25 ? 10 : 5 });
        e.XQ = pQ.X;
        s += pQ.svg;
        // Fond de couche et droites (sur l'épaisseur de la couche).
        s += ligne(276, Y(e.ep), 630, Y(e.ep), COULEURS.trait, 1.2, 'stroke-dasharray="2 3"') + texte(626, Y(e.ep) + 13, "fond de couche", 'text-anchor="end" class="halo" style="font-size:10px;fill:#475569"');
        const ech = (fn) => points(Array.from({ length: 25 }, (_, i) => { const z = (e.ep * i) / 24; return [pQ.X(Math.min(fn(z), e.vMax)), Y(z)]; }));
        s += `<polyline points="${ech(e.ref)}" fill="none" stroke="#15803d" stroke-width="2" stroke-dasharray="7 4"/>`;
        s += `<polyline points="${ech(e.lim)}" fill="none" stroke="${ROUGE}" stroke-width="2" stroke-dasharray="7 4"/>`;
        s += `<g class="dyn-zones"></g><polyline class="dyn-qd" points="" fill="none" stroke="${COULEURS.bleu}" stroke-width="1.5"/>`;
        s += `<line class="dyn-repere" x1="276" x2="630" y1="${G.yS}" y2="${G.yS}" stroke="${COULEURS.effort}" stroke-width="1" stroke-dasharray="3 3"/>`;
        // Légende des repères, sous le panneau.
        const lg = (x, col, tir, lib) => ligne(x, 482, x + 18, 482, col, 2, tir ? `stroke-dasharray="${tir}"` : "") + texte(x + 23, 486, lib, 'style="font-size:10px;font-weight:700;fill:#334155"');
        s += lg(282, COULEURS.bleu, "", "qd mesuré") + lg(370, "#15803d", "7 4", "droite de référence") + lg(502, ROUGE, "7 4", "droite limite");
        return s;
      },
    });
  }

  function dessiner() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    const hT = hauteurTete(), yTete = yHaut(hT), yPointe = Y(e.z), xT = G.xT;
    // Tiges au-dessus du sol (échelle réduite) et dans le terrain ; tête de battage ; pointe.
    let s = `<rect x="${xT - 3}" y="${r1(yTete)}" width="6" height="${r1(G.yS - yTete)}" fill="#cbd5e1" stroke="#475569" stroke-width=".9"/>`;
    s += `<rect x="${xT - 2}" y="${G.yS}" width="4" height="${r1(Math.max(0, yPointe - G.yS - 6))}" fill="#cbd5e1" stroke="#475569" stroke-width=".8"/>`;
    s += `<path d="M${xT - 4} ${r1(yPointe - 6)}h8l-4 7z" fill="#475569" stroke="#1e293b" stroke-width=".8"/>`;
    s += `<rect x="${xT - 11}" y="${r1(yTete - 16)}" width="22" height="16" rx="2" fill="#f97316" stroke="#7c2d12"/>`;
    s += `<path d="M${xT - 11} ${r1(yTete - 9)}C40 ${r1(yTete - 9)} 60 140 74 106" fill="none" stroke="#334155" stroke-width="1.3"/>`;
    // Capteur d'enfoncement posé au sol : son ruban suit la tête.
    s += `<rect x="150" y="${G.yS - 16}" width="30" height="16" rx="3" fill="#e2e8f0" stroke="#475569"/>` + ligne(158, G.yS - 16, xT + 11, yTete - 8, "#0369a1", 1.2);
    s += texte(184, G.yS - 22, "capteur", 'class="halo" style="font-size:10px;font-weight:700;fill:#334155"');
    // Marteau : levé, puis abattu sur la tête de battage.
    let lev = 0;
    if (e.pauseTige <= 0 && !e.fini && e.t > 0) lev = e.phase < LEVER ? Math.sin((e.phase / LEVER) * Math.PI / 2) : e.phase < LEVER + FRAPPE ? 1 - (e.phase - LEVER) / FRAPPE : 0;
    const ang = -10 - 70 * lev, py = yTete - 24;
    s += `<g transform="rotate(${r1(ang)} ${xT + 66} ${r1(py + 6)})"><rect x="${xT + 4}" y="${r1(py + 3)}" width="64" height="5" rx="2" fill="#92400e"/><rect x="${xT - 12}" y="${r1(py - 6)}" width="24" height="15" rx="3" fill="#334155" stroke="#0f172a"/></g>`;
    const impact = e.coups.length && e.pauseTige <= 0 && e.phase >= LEVER + FRAPPE && e.phase < LEVER + FRAPPE + 0.12;
    if (impact) s += `<path d="M${xT - 20} ${r1(yTete - 10)}l-8 -4M${xT + 20} ${r1(yTete - 10)}l8 -4M${xT - 18} ${r1(yTete - 4)}l-9 2M${xT + 18} ${r1(yTete - 4)}l9 2" stroke="${COULEURS.effort}" stroke-width="2"/>`;
    const dernier = e.coups.at(-1);
    s += texte(48, 82, dernier ? `${fd(dernier.qd, 1)} MPa` : "prêt", 'text-anchor="middle" style="font-size:10.5px;font-weight:700;fill:#67e8f9;font-family:ui-monospace,Consolas,monospace"');
    svgEl.querySelector(".dyn-appareil").innerHTML = s;
    const rep = svgEl.querySelector(".dyn-repere");
    rep.setAttribute("y1", r1(yPointe)); rep.setAttribute("y2", r1(yPointe));
    c.lectures.innerHTML = lectures([
      ["Profondeur", fd(e.z, 3), "m"], ["Coups", String(e.coups.length), `${e.tiges} tige${e.tiges > 1 ? "s" : ""}`],
      ["Énergie du coup", dernier ? fd(dernier.E, 1) : "—", "J"], ["Enfoncement", dernier ? fd(dernier.e, 1) : "—", "mm"],
      ["qd", dernier ? fd(dernier.qd, 1) : "—", `MPa · pointe ${e.A} cm²`],
    ]) + `<p class="banc-etat">${e.fini ? "profil terminé" : e.pauseTige > 0 ? "ajout d'une tige…" : e.t === 0 ? "pointe posée, prête" : e.z < e.ep ? "dans la couche contrôlée" : "dans la couche sous-jacente"}</p>`;
    loupe(...vueLoupe(impact));
  }

  // ── Loupe : la pointe, que chaque coup enfonce ; les couches défilent ──
  const KL = 2000, YP = 104, XC = 88; // px/m (2 cm = 40 px), ordonnée de la pointe, axe
  function vueLoupe(impact) {
    const Yl = (z) => YP + (z - e.z) * KL, dc = (Math.sqrt((4 * e.A) / Math.PI) / 100) * KL, dt = 0.014 * KL;
    const couches = [{ z0: 0, z1: e.ep, sol: e.sol.motif }, { z0: e.ep, z1: 9, sol: e.sous.sol }];
    let s = vueTerrain({ couches, Y: Yl, k: KL, zHaut: e.z - YP / KL, zBas: e.z + (HL - YP) / KL });
    if (Yl(e.ep) > 0 && Yl(e.ep) < HL) s += ligne(0, Yl(e.ep), WL, Yl(e.ep), "#7c2d12", 1.4, 'stroke-dasharray="6 3"') + etiquette(WL - 6, Yl(e.ep) - 4, "fond de couche", { ancre: "end", couleur: "#7c2d12" });
    const yBase = YP - (dc / 2) * Math.tan((Math.PI / 180) * 45) * 1.15;
    s += `<ellipse cx="${XC}" cy="${YP + 5}" rx="${r1(dc * 0.8)}" ry="${r1(dc * 0.55)}" fill="#0f172a" opacity="${impact ? 0.22 : 0.08}"/>`;
    s += tige(XC, 0, yBase, dt);
    s += `<path d="M${r1(XC - dc / 2)} ${r1(yBase)}H${r1(XC + dc / 2)}L${XC} ${YP}Z" fill="#475569" stroke="#1e293b"/>`;
    s += `<rect x="${r1(XC - dc / 2)}" y="${r1(yBase - 8)}" width="${r1(dc)}" height="8" fill="${ACIER_SOMBRE}" stroke="#1e293b"/>`;
    const dernier = e.coups.at(-1);
    if (impact) s += choc(XC, yBase - 4, dc / 2 + 4) + fleche(XC + dc / 2 + 16, 6, XC + dc / 2 + 16, 30, ROUGE, 2.4, 7);
    if (dernier) s += etiquette(XC + dc / 2 + 6, YP + 2, `${fd(dernier.e, 1)} mm`, { couleur: ROUGE });
    s += etiquette(6, 13, e.z < e.ep ? "couche contrôlée" : e.sous.nom);
    const legende = e.t === 0 ? "la pointe attend le premier coup" : e.pauseTige > 0 ? "ajout d'une tige : la pointe attend" : e.fini ? "profil terminé"
      : impact ? `coup de ${fd(dernier.E, 0)} J : la pointe s'enfonce de ${fd(dernier.e, 1)} mm` : e.phase < LEVER ? "l'opérateur lève le marteau…" : `qd = ${fd(dernier?.qd ?? 0, 1)} MPa au dernier coup`;
    return [s, legende];
  }

  function dessinerLent() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    const X = e.XQ, borneQ = (q) => X(Math.min(q, e.vMax));
    svgEl.querySelector(".dyn-qd").setAttribute("points", points(e.coups.flatMap((k) => [[borneQ(k.qd), Y(k.z0)], [borneQ(k.qd), Y(k.z)]])));
    svgEl.querySelector(".dyn-zones").innerHTML = (e.zones?.liste ?? []).map((z) => `<rect x="276" y="${r1(Y(z.z0))}" width="354" height="${r1(Y(z.z1) - Y(z.z0))}" fill="${ROUGE}" opacity=".16"/>`
      + texte(626, Y(z.z0) + 12, "anomalie", 'text-anchor="end" class="halo" style="font-size:10px;font-weight:800;fill:#b91c1c"')).join("");
    const zp = c.courbes.querySelector(".dyn-penetro"), zc = c.courbes.querySelector(".dyn-coups");
    const sig = `${e.coups.length}|${e.fini}`;
    if (!zp || !zc || sig === signature) return;
    signature = sig;
    const ech = (fn) => Array.from({ length: 25 }, (_, i) => { const z = (e.ep * i) / 24; return [fn(z), z]; });
    zp.innerHTML = graphe({
      largeur: 560, hauteur: 300, xmin: 0, xmax: e.vMax, ymin: 0, ymax: e.zMax, inverserY: true,
      xlabel: "résistance de pointe qd (MPa)", ylabel: "profondeur z (m)",
      series: [
        { points: ech(e.ref), couleur: "#15803d", tirets: "7 4", epaisseur: 2, libelle: `droite de référence (${e.obj}, illustrative)` },
        { points: ech(e.lim), couleur: ROUGE, tirets: "7 4", epaisseur: 2, libelle: "droite limite (illustrative)" },
        ...(e.coups.length ? [{ points: e.coups.flatMap((k) => [[Math.min(k.qd, e.vMax), k.z0], [Math.min(k.qd, e.vMax), k.z]]), couleur: COULEURS.bleu, epaisseur: 1.5, libelle: "pénétrogramme" }] : []),
      ],
      zones: [
        { x0: 0, x1: e.vMax, y0: e.ep, y1: e.zMax, couleur: COULEURS.discret, opacite: 0.1, libelle: "couche sous-jacente", position: "droite" },
        ...(e.zones?.liste ?? []).map((z) => ({ x0: 0, x1: e.vMax, y0: z.z0, y1: z.z1, couleur: ROUGE, opacite: 0.16, libelle: "anomalie", position: "droite" })),
      ],
    });
    zc.innerHTML = e.coups.length ? graphe({
      largeur: 560, hauteur: 200, xmin: 0, xmax: Math.max(10, e.coups.length), ymin: 0, ymax: Math.ceil(Math.max(20, ...e.coups.map((k) => k.E), ...e.coups.map((k) => k.e)) / 10) * 10,
      xlabel: "numéro du coup", ylabel: "J ou mm",
      series: [
        { points: e.coups.map((k) => [k.n, k.E]), couleur: COULEURS.gtr92, epaisseur: 1.4, marqueurs: true, rayon: 2, libelle: "énergie mesurée E (J)" },
        { points: e.coups.map((k) => [k.n, k.e]), couleur: COULEURS.violet, epaisseur: 1.4, marqueurs: true, rayon: 2, libelle: "enfoncement e (mm)" },
      ],
    }) : "";
  }

  function bilan() {
    const K = e.coups, n = K.length, Emoy = K.reduce((s, k) => s + k.E, 0) / n, emoy = (1000 * e.z) / n;
    const Z = e.zones, liste = Z.liste, epCm = (z) => Math.round((z.z1 - z.z0) * 100);
    const objectif = `${e.obj} (${e.o.nom.split("—")[1].trim()})`;
    let lecture;
    if (!liste.length) lecture = `Aucune anomalie : sur toute la couche, le profil reste au-dessus de la droite limite de l'objectif ${objectif} — compactage jugé conforme${Z.tolerance > 0.05 ? ` ; il passe entre les deux droites, en zone de tolérance, sur ${fd(100 * Z.tolerance, 0)} % de l'épaisseur` : ""}.`;
    else {
      const total = liste.reduce((s, z) => s + epCm(z), 0), fondTouche = liste.some((z) => z.z1 >= e.ep - 0.02);
      lecture = `Anomalie de compactage : le profil passe sous la droite limite de l'objectif ${objectif} ${liste.map((z) => `de ${fd(z.z0, 2)} à ${fd(z.z1, 2)} m (${epCm(z)} cm)`).join(", ")}, soit ${total} cm sur ${Math.round(e.ep * 100)}${fondTouche && liste[0].z0 > e.ep * 0.4 ? " — c'est le fond de couche qui est insuffisamment compacté" : total > e.ep * 70 ? " — c'est toute la couche qui est insuffisamment compactée" : ""}.`;
    }
    const lignes = liste.map((z, i) => `<tr class="ko"><td>anomalie ${i + 1}</td><td class="n">${fd(z.z0, 2)}</td><td class="n">${fd(z.z1, 2)}</td><td class="n">${epCm(z)}</td><td class="n">${fd(z.qd, 1)}</td><td class="n">${fd(z.qdLim, 1)}</td></tr>`).join("");
    c.bilan.innerHTML = `<p class="final-result">Pénétrogramme de 0 à ${fd(e.z, 2)} m en ${n} coups (${duree(e.t)}) : énergie moyenne ${fd(Emoy, 0)} J, enfoncement moyen ${fd(emoy, 1)} mm par coup, pointe de ${e.A} cm², M = ${M} kg ; qd = (1/A) · E · M/(M + P) / e (XP P94-105).
        <strong>${lecture}</strong>
        <small>Repères illustratifs (loi qd ∝ τ¹²) : en pratique, droites du catalogue de la norme ou étalonnage sur planche. Sous la couche, le profil ne se juge pas avec ces droites.</small></p>
      ${liste.length ? `<div class="table-large"><table class="resultats"><thead><tr><th>Zone</th><th class="num">de z (m)</th><th class="num">à z (m)</th><th class="num">épaisseur (cm)</th><th class="num">qd lissé (MPa)</th><th class="num">qd limite (MPa)</th></tr></thead><tbody>${lignes}</tbody></table></div>` : ""}`;
  }

  b = boucle({ avancer, dessiner, dessinerLent, surFin: () => { signature = ""; dessinerLent(); bilan(); }, surEtat: () => etatBoutons?.() });
  etatBoutons = brancherMarche(c, b, reinit);
  const relancer = () => { b.raz(); reinit(); etatBoutons(); };
  c.commandes.querySelectorAll("select").forEach((x) => x.addEventListener("change", relancer));
  c.q('[data-r="ep"]').addEventListener("change", relancer);
  c.q('[data-r="ep"]').addEventListener("input", relancer);
  reinit();
  etatBoutons();
}
