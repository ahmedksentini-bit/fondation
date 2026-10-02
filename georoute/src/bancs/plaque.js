// Banc d'essai : l'essai de plaque à deux cycles sur une arase ou une
// plateforme (chapitres 8 et 10 ; NF P94-117-1), adapté du banc du site
// jumeau. Sous un camion lesté, le vérin charge une plaque rigide de 600 mm ;
// la poutre de référence, appuyée hors de la zone d'influence, porte le
// comparateur. Premier cycle par paliers jusqu'à 0,25 MPa, chaque palier
// maintenu jusqu'à stabilisation de l'enfoncement (moins de 0,02 mm par
// minute, critère du banc), déchargement, second cycle jusqu'à 0,20 MPa :
// EV1 = 1,5 q a/z1 et EV2 = 1,5 q a/z2, leur rapport k = EV2/EV1 juge le
// compactage, et EV2 classe l'arase (AR) ou la plateforme (PF) et dit ce que
// l'on peut construire dessus [GTR 2024, F1 § 4.1.3 et § 4.3].
import { svg, ligne, texte, couche, COULEURS, graphe } from "../figures.js";
import { plaque, jugerK, classePlateforme, classeArase, CLASSES_AR, CLASSES_PF } from "../gtr/portance.js";
import { charpente, boucle, brancherMarche, lectures, f, fd, r1, esc, duree } from "./moteur.js";
import { fenetreLoupe, vueTerrain, fleche, etiquette, W as WL, H as HL, ROUGE, ACIER, ACIER_SOMBRE, TRAIT } from "./loupe.js";
import { gauss, graineDe, contenirLargeur } from "./controle-dessin.js";

/**
 * Surfaces essayées : type (arase AR ou plateforme PF), modules du terrain
 * virtuel, couches (couche de forme d'épaisseur h sur l'arase) et constante de
 * temps de la stabilisation (s) — longue pour un sol fin humide.
 */
const SURFACES = {
  ar0: { nom: "arase en sol fin humide (PST1)", type: "AR", EV1: 8, EV2: 14, sol: "limon", tau: 16 },
  ar1: { nom: "arase en limon F1 à l'état moyen (PST2)", type: "AR", EV1: 17, EV2: 32, sol: "limon", tau: 12 },
  ar2: { nom: "arase en grave drainée (PST3)", type: "AR", EV1: 34, EV2: 63, sol: "grave", tau: 9 },
  pf2: { nom: "couche de forme granulaire", type: "PF", EV1: 38, EV2: 70, forme: "forme", h: 0.4, sol: "limon", tau: 9 },
  pf2m: { nom: "couche de forme granulaire mal compactée", type: "PF", EV1: 22, EV2: 58, forme: "forme", h: 0.4, sol: "limon", tau: 11 },
  pf3: { nom: "couche de forme traitée aux liants hydrauliques", type: "PF", EV1: 95, EV2: 160, forme: "traite", h: 0.35, sol: "limon", tau: 6 },
  pf2qs: { nom: "plateforme d'une chaussée à fort trafic, PF2qs visée", type: "PF", EV1: 52, EV2: 98, forme: "forme", h: 0.5, sol: "limon", tau: 8 },
};
// Programme : paliers de pression (MPa) — premier cycle, déchargement, second cycle.
const PROGRAMME = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.125, 0, 0.05, 0.1, 0.15, 0.2];
const R = 300; // mm : rayon de la plaque
const VSTAB = 0.02 / 60; // mm/s : critère de stabilisation du banc

export function monter(banc) {
  const c = charpente(banc, {
    vitesse: 30, vitesses: [1, 10, 30, 100],
    commandes: `<div class="field" style="grid-column:span 2"><label>Surface essayée</label><div class="input-wrap"><select data-r="pf">${Object.entries(SURFACES).map(([k, x]) => `<option value="${k}">${esc(x.nom)}</option>`).join("")}</select></div></div>
      <p class="method-note" style="grid-column:1/-1">Plaque rigide de 600 mm ; paliers de 0,05 MPa jusqu'à 0,25 MPa, déchargement, second cycle jusqu'à 0,20 MPa ; chaque palier est tenu jusqu'à ce que l'enfoncement se stabilise.</p>`,
  });
  contenirLargeur(c);
  const loupe = fenetreLoupe(c, "le sol sous la plaque", { echelle: { px: 30, libelle: "10 cm" } });
  let e, b, etatBoutons;

  const reinit = () => {
    const cle = c.q('[data-r="pf"]').value, pf = SURFACES[cle], g = graineDe(cle);
    // Lectures de fin de palier : premier chargement concave, retour partiel au déchargement, second chargement raide.
    const z1 = (1.5 * 0.25 * R) / pf.EV1, zRes = z1 - (1.5 * 0.25 * R) / (pf.EV2 * 1.25);
    const cible = PROGRAMME.map((p, i) => {
      let s;
      if (i <= 5) s = z1 * (p / 0.25) ** 0.85;
      else if (i <= 7) s = zRes + (z1 - zRes) * (p / 0.25) ** 0.6;
      else s = zRes + ((1.5 * p * R) / pf.EV2) * (p / 0.2) ** 0.15;
      return i ? s * (1 + 0.01 * gauss(i, g)) : 0;
    });
    // Durée de chaque palier : l'enfoncement tend vers sa valeur ; on attend que sa vitesse passe sous le critère.
    const durees = cible.map((s, i) => (i ? Math.min(240, Math.max(30, pf.tau * Math.log(Math.abs(s - cible[i - 1]) / (pf.tau * VSTAB) + 1))) : 20));
    e = { cle, pf, cible, durees, i: 0, tPal: 0, t: 0, points: [{ p: 0, s: 0 }], fini: false, id: "" };
    c.scene.innerHTML = fond();
    c.courbes.innerHTML = '<div class="dyn-courbe"></div>';
    c.bilan.innerHTML = "";
    dessiner(); dessinerLent();
  };

  /** Enfoncement à l'instant courant : il rejoint la lecture du palier en s'amortissant. */
  const enfoncement = () => {
    if (e.fini || e.i === 0) return e.fini ? e.cible.at(-1) : 0;
    const a = e.cible[e.i - 1], z = e.cible[e.i];
    return z + (a - z) * Math.exp(-e.tPal / e.pf.tau);
  };

  const avancer = (dt) => {
    if (e.fini) return false;
    let reste = dt;
    while (reste > 1e-9 && !e.fini) {
      const h = Math.min(reste, e.durees[e.i] - e.tPal);
      e.tPal += h; e.t += h; reste -= h;
      if (e.tPal >= e.durees[e.i] - 1e-9) {
        if (e.i > 0) e.points.push({ p: PROGRAMME[e.i], s: enfoncement(), i: e.i });
        e.i++; e.tPal = 0;
        if (e.i >= PROGRAMME.length) { e.fini = true; e.i = PROGRAMME.length - 1; }
      }
    }
    return !e.fini;
  };

  const cycle = () => (e.fini ? "terminé" : e.i === 0 ? "mise en place" : e.i <= 5 ? "1er chargement" : e.i <= 7 ? "déchargement" : "2e chargement");

  // ── Scène : camion lesté, vérin, plaque, poutre de référence et comparateur ──
  const yP = 228;
  function fond() {
    const pf = e.pf;
    return svg({
      largeur: 640, hauteur: 330, titre: "Essai de plaque", contenu: (id) => {
        e.id = id;
        let s;
        if (pf.type === "PF") {
          const yF = yP + 44;
          s = couche(id, { x: 10, y: yP, w: 620, h: yF - yP, sol: pf.forme }) + couche(id, { x: 10, y: yF, w: 620, h: 322 - yF, sol: pf.sol });
          s += ligne(10, yF, 630, yF, "#475569", 1, 'stroke-dasharray="5 3"');
          s += texte(620, yP + 18, `${pf.forme === "traite" ? "couche de forme traitée" : "couche de forme granulaire"} (${f(100 * pf.h, 2)} cm)`, 'text-anchor="end" class="halo" style="font-size:10.5px;font-weight:700"');
          s += texte(620, yF + 18, "arase du terrassement", 'text-anchor="end" class="halo" style="font-size:10.5px;font-weight:700"');
        } else {
          s = couche(id, { x: 10, y: yP, w: 620, h: 322 - yP, sol: pf.sol });
          s += texte(620, yP + 18, `arase : ${pf.nom.replace(/^arase /, "")}`, 'text-anchor="end" class="halo" style="font-size:10.5px;font-weight:700"');
        }
        s += ligne(10, yP, 630, yP, COULEURS.trait, 1.8);
        // Camion lesté (réaction), roues, montants ; poutre de référence appuyée loin de la plaque.
        s += `<rect x="150" y="40" width="330" height="70" rx="8" fill="#e2e8f0" stroke="#475569" stroke-width="1.3"/>`;
        s += `<rect x="160" y="50" width="120" height="50" rx="4" fill="#94a3b8"/>` + texte(220, 80, "lest", 'text-anchor="middle" style="font-size:11px;font-weight:800;fill:#fff"');
        s += `<rect x="404" y="18" width="66" height="22" rx="4" fill="#cbd5e1" stroke="#475569"/>`;
        for (const x of [190, 430]) s += `<circle cx="${x}" cy="${yP - 14}" r="14" fill="#334155"/><circle cx="${x}" cy="${yP - 14}" r="5" fill="#cbd5e1"/>`;
        s += `<rect x="186" y="110" width="8" height="${yP - 28 - 110}" fill="#475569"/><rect x="426" y="110" width="8" height="${yP - 28 - 110}" fill="#475569"/>`;
        s += ligne(40, yP - 70, 290, yP - 70, "#78350f", 3) + `<rect x="34" y="${yP - 70}" width="6" height="70" fill="#92400e"/>` + texte(40, yP - 78, "poutre de référence", 'style="font-size:10px;font-weight:700;fill:#78350f"');
        s += `<g class="dyn-plaque"></g>`;
        return s;
      },
    });
  }

  function dessiner() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    const p = e.fini ? PROGRAMME.at(-1) : PROGRAMME[e.i], z = enfoncement();
    const yPl = yP - 8 + z * 1.2; // enfoncement exagéré
    let s = `<rect x="270" y="${r1(yPl)}" width="90" height="8" fill="#64748b" stroke="#1e293b"/>`;
    s += `<rect x="304" y="110" width="22" height="${r1(yPl - 110 - 30)}" fill="#cbd5e1" stroke="#475569"/><rect x="298" y="${r1(yPl - 30)}" width="34" height="30" rx="3" fill="#f59e0b" stroke="#92400e"/>`;
    s += texte(342, yPl - 12, "vérin", 'style="font-size:10px;font-weight:700;fill:#78350f"');
    // Comparateur posé sur la plaque, porté par la poutre : un tour par millimètre.
    s += `<circle cx="280" cy="${yP - 90}" r="14" fill="#fff" stroke="#334155" stroke-width="1.5"/>` + ligne(280, yP - 76, 280, yPl, "#334155", 1.2);
    const a = (((z % 1) * 360 - 90) * Math.PI) / 180;
    s += ligne(280, yP - 90, 280 + 11 * Math.cos(a), yP - 90 + 11 * Math.sin(a), COULEURS.effort, 1.8);
    s += texte(258, yP - 104, "comparateur", 'text-anchor="middle" style="font-size:10px;font-weight:700;fill:#334155"');
    if (p > 0) for (const dx of [-30, 0, 30]) s += ligne(315 + dx, yPl + 10, 315 + dx, yPl + 24, COULEURS.effort, 2);
    s += texte(315, yP + 40, `${fd(p, 3)} MPa`, 'text-anchor="middle" class="halo" style="font-size:11px;font-weight:800;fill:#b91c1c"');
    svgEl.querySelector(".dyn-plaque").innerHTML = s;
    c.lectures.innerHTML = lectures([
      ["Cycle", cycle(), ""], ["Palier", e.fini ? "—" : `${e.i} / ${PROGRAMME.length - 1}`, ""],
      ["Pression", fd(p, 3), "MPa"], ["Enfoncement", fd(z, 2), "mm"], ["Temps", duree(e.t), ""],
    ]) + (e.i > 0 && !e.fini ? `<p class="banc-etat">${e.tPal < e.durees[e.i] - 1 ? "palier tenu jusqu'à stabilisation" : "enfoncement stabilisé"}</p>` : "");
    loupe(...vueLoupe(p, z));
  }

  // ── Loupe : la demi-plaque et le sol qu'elle enfonce (déplacements × 10) ──
  const KL = 300, XA = 6, RP = 0.3 * KL, YS = 46, EXAG = 10; // px/m, axe, rayon de la plaque, surface du sol
  function vueLoupe(p, z) {
    const sp = (z / 1000) * KL * EXAG; // enfoncement dessiné (px)
    // Déplacement vertical du sol : entier sous la plaque, amorti en profondeur et au-delà du bord.
    const w = (x, y) => { const r = x - XA, prof = Math.max(0, y - YS); return (sp * (r <= RP ? 1 : Math.exp(-(r - RP) / 22))) / (1 + (prof / 75) ** 2) ** 1.2; };
    const couches = e.pf.type === "PF" ? [{ z0: 0, z1: e.pf.h, sol: e.pf.forme }, { z0: e.pf.h, z1: 9, sol: e.pf.sol }] : [{ z0: 0, z1: 9, sol: e.pf.sol }];
    let s = `<rect width="${WL}" height="${HL}" fill="#f8fafc"/>`;
    s += vueTerrain({ couches, Y: (zz) => YS + zz * KL, k: KL, zHaut: 0, zBas: (HL - YS + 30) / KL, deplacer: (x, y) => [x, y + w(x, y)] });
    if (e.pf.type === "PF") s += `<path d="M0 ${r1(YS + e.pf.h * KL + w(XA, YS + e.pf.h * KL))}H${WL}" stroke="#475569" stroke-dasharray="5 3"/>`;
    // Surface déformée : cuvette sous la plaque.
    let surf = `M0 ${r1(YS + sp)}`;
    for (let x = XA; x <= WL; x += 4) surf += `L${x} ${r1(YS + w(x, YS))}`;
    s += `<path d="${surf}L${WL} 0H0Z" fill="#f8fafc"/><path d="${surf.replace("M0", `M${XA}`)}" fill="none" stroke="${TRAIT}" stroke-width="1.4"/>`;
    // Bulbe des contraintes : isobares d'autant plus marquées que la pression est forte.
    for (const [a, b2] of [[0.95, 1.1], [1.45, 2], [2.1, 3.2]]) s += `<path d="M${XA} ${r1(YS + sp)}A${r1(a * RP)} ${r1(b2 * RP)} 0 0 1 ${XA} ${r1(YS + sp + 2 * b2 * RP)}" fill="none" stroke="${ROUGE}" stroke-width="1.1" stroke-dasharray="4 3" opacity="${r1(Math.min(1, p / 0.25) * 0.8)}"/>`;
    // Plaque rigide, vérin, pression appliquée.
    s += `<rect x="0" y="${r1(YS - 12 + sp)}" width="${XA + RP}" height="12" fill="${ACIER_SOMBRE}" stroke="#1e293b"/>`;
    s += `<rect x="0" y="0" width="${XA + 30}" height="${r1(YS - 12 + sp)}" fill="${ACIER}" stroke="${ACIER_SOMBRE}"/>`;
    if (p > 0) for (const x of [52, 72, 92]) s += fleche(x, YS - 14 + sp - 6 - 22 * (p / 0.25), x, YS - 14 + sp, ROUGE, 1.8, 5);
    s += `<path d="M${XA} 0V${HL}" stroke="#475569" stroke-dasharray="8 3 2 3"/>`;
    s += etiquette(WL - 6, 13, `déplacements × ${EXAG}`, { ancre: "end", couleur: "#475569" }) + etiquette(XA + RP + 4, YS - 16 + sp, "bord", { couleur: "#475569" });
    if (e.pf.type === "PF" && YS + e.pf.h * KL < HL - 22) s += etiquette(WL - 6, YS + e.pf.h * KL - 4, "arase", { ancre: "end", couleur: "#475569" });
    const cy = cycle();
    const legende = cy === "mise en place" ? "plaque posée sur la surface, avant chargement"
      : cy === "1er chargement" ? `1er chargement : la plaque enfonce et serre le sol (${fd(z, 2)} mm)`
        : cy === "déchargement" ? "déchargement : le sol ne remonte qu'en partie, le tassement reste"
          : cy === "2e chargement" ? "2e chargement : le sol, déjà serré, répond plus raide" : "deux cycles lus : EV1, EV2 et leur rapport k";
    return [s, legende];
  }

  function dessinerLent() {
    const zone = c.courbes.querySelector(".dyn-courbe");
    if (!zone) return;
    const P = e.points, zMax = Math.max(1, ...e.cible) * 1.15;
    const marques = [];
    if (P.length > 5) marques.push({ x: 0.25, y: P[5].s, couleur: COULEURS.gtr92, libelle: `z1 = ${fd(P[5].s, 2)} mm` });
    if (e.fini) marques.push({ x: 0.2, y: P.at(-1).s, couleur: COULEURS.gtr24, libelle: `z2 = ${fd(P.at(-1).s - P[7].s, 2)} mm` });
    zone.innerHTML = graphe({
      largeur: 560, hauteur: 260, xmin: 0, xmax: 0.28, ymin: 0, ymax: zMax, inverserY: true, pasX: 0.05,
      xlabel: "pression sous la plaque (MPa)", ylabel: "enfoncement (mm)", marques,
      series: [
        { points: P.filter((q, i) => i <= 5).map((q) => [q.p, q.s]), couleur: COULEURS.gtr92, marqueurs: true, epaisseur: 2, libelle: "1er cycle" },
        ...(P.length > 6 ? [{ points: P.slice(5, 8).map((q) => [q.p, q.s]), couleur: COULEURS.discret, tirets: "4 3", marqueurs: true, libelle: "déchargement" }] : []),
        ...(P.length > 8 ? [{ points: P.slice(7).map((q) => [q.p, q.s]), couleur: COULEURS.gtr24, marqueurs: true, epaisseur: 2, libelle: "2e cycle" }] : []),
      ],
    });
  }

  const plage = (c1) => (c1.max === Infinity ? `≥ ${c1.min}` : c1.min === 0 ? `< ${c1.max}` : `de ${c1.min} à ${c1.max}`);
  function bilan() {
    const P = e.points, z1 = P[5].s, z2 = P.at(-1).s - P[7].s;
    const r = plaque({ z1, z2 });
    const pf = e.pf, okK = r.k <= 2;
    let classe, lecture;
    if (pf.type === "AR") {
      classe = classeArase(r.EV2);
      const c1 = CLASSES_AR.find((x) => x.classe === classe);
      lecture = `arase <strong>${classe}</strong>${c1 ? ` (EV2 ${plage(c1)} MPa)` : ""} — `
        + (r.EV2 >= 35 ? "elle peut recevoir une couche de forme traitée (EV2 ≥ 35 MPa) comme une couche de forme granulaire."
          : r.EV2 >= 20 ? "elle porte une couche de forme granulaire (15 à 20 MPa suffisent) mais pas une couche de forme traitée, qui demande 35 MPa."
            : r.EV2 >= 15 ? "à la limite basse pour une couche de forme granulaire (15 à 20 MPa) ; trop faible pour une couche de forme traitée (35 MPa)."
              : "trop faible même pour une couche de forme granulaire (15 à 20 MPa) : il faut d'abord l'améliorer — traitement, purge ou drainage.");
    } else {
      classe = classePlateforme(r.EV2);
      const c1 = CLASSES_PF.find((x) => x.classe === classe);
      lecture = `plateforme <strong>${classe}</strong>${c1 ? ` (EV2 ${plage(c1)} MPa)` : ""} — `
        + (r.EV2 >= 50 ? "au-dessus des 50 MPa qu'exige la mise en œuvre de la chaussée." : "sous les 50 MPa qu'exige la mise en œuvre de la chaussée : il faut reprendre la couche de forme.");
    }
    c.bilan.innerHTML = `<p class="final-result">z1 = ${fd(z1, 2)} mm à 0,25 MPa ⇒ EV1 = 112,5/z1 = <strong>${fd(r.EV1, 1)} MPa</strong> ;
        z2 = ${fd(z2, 2)} mm entre 0 et 0,20 MPa au second cycle ⇒ EV2 = 90/z2 = <strong>${fd(r.EV2, 1)} MPa</strong> ;
        k = EV2/EV1 = <strong>${fd(r.k, 2)}</strong> : ${esc(jugerK(r))}. Classe : ${lecture}${okK ? "" : " Avant de conclure, il faut recompacter : le module mesuré n'est pas celui de la couche bien serrée."}
        <small>Seuils du GTR : 50 MPa sur la plateforme pour réaliser la chaussée, 35 MPa sur l'arase pour une couche de forme traitée, 15 à 20 MPa pour une couche de forme granulaire (NF P94-117-1 ; essai mené en ${duree(e.t)}).</small></p>`;
  }

  b = boucle({ avancer, dessiner, dessinerLent, surFin: bilan, surEtat: () => etatBoutons?.(), pasMax: Infinity });
  etatBoutons = brancherMarche(c, b, reinit);
  c.commandes.querySelectorAll("select").forEach((x) => x.addEventListener("change", () => { b.raz(); reinit(); etatBoutons(); }));
  reinit();
  etatBoutons();
}
