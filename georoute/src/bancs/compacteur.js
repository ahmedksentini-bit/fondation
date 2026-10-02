// Banc d'essai : la planche de compactage (chapitre 7). On choisit le
// matériau, l'objectif de densification (q4 pour un remblai, q3 pour une
// couche de forme), le compacteur, l'épaisseur de la couche et l'allure ; le
// tableau de compactage donne Q/S, l'épaisseur maximale et la vitesse, d'où le
// nombre d'applications prescrit N = e/(Q/S), arrondi à l'entier supérieur
// [GTR 2024, fascicule 2, annexe 4 ; classes de compacteurs NF P98-736]. Le
// rouleau fait ses allers et retours sur une planche de 30 m ; à chaque passe
// la masse volumique sèche se resserre, davantage en surface qu'au fond de la
// couche (modèle d'enseignement profilDensification). Le banc poursuit
// jusqu'au double du N prescrit : une couche trop épaisse ne se rattrape pas
// par des passes de plus, c'est le fond qui manque.
//
// Effet de l'allure : un vibrant qui roule plus vite frappe moins de fois
// chaque mètre et porte moins profond — entre les deux colonnes du tableau,
// V e reste constant ; un compacteur à pneus ou un statique à pieds dameurs
// perd seulement un peu d'efficacité à chaque passe.
import { svg, ligne, texte, couche, solDe, largeurTexte, COULEURS, graphe } from "../figures.js";
import { OBJECTIFS, applications, prescrire, debitParLargeur, profilDensification, controleDensite } from "../gtr/compactage.js";
import { SOLS } from "./materiaux.js";
import { charpente, boucle, brancherMarche, lectures, f, fd, r1, esc, duree } from "./moteur.js";
import { fenetreLoupe, vueTerrain, fleche, etiquette, horloge, teinte, W as WL, H as HL, ROUGE, ACIER, ACIER_SOMBRE, TRAIT } from "./loupe.js";
import { cellulePlanche, teinteTaux, gauss, graineDe, borne, barreEchelle, contenirLargeur } from "./controle-dessin.js";

const COMPACTEURS = {
  P2: { nom: "P2 — à pneus, 40 à 60 kN par roue", court: "compacteur à pneus P2", vibrant: false, organe: "pneu", R: 0.5 },
  V2: { nom: "V2 — vibrant monocylindre léger", court: "vibrant V2", vibrant: true, organe: "bille", R: 0.6, L: 4.6, rt: 0.55 },
  V3: { nom: "V3 — vibrant monocylindre moyen", court: "vibrant V3", vibrant: true, organe: "bille", R: 0.75, L: 5.6, rt: 0.7 },
  V4: { nom: "V4 — vibrant monocylindre lourd", court: "vibrant V4", vibrant: true, organe: "bille", R: 0.8, L: 6, rt: 0.75 },
  VP3: { nom: "VP3 — vibrant à pieds dameurs", court: "vibrant à pieds dameurs VP3", vibrant: true, organe: "pieds", R: 0.68, L: 5.6, rt: 0.7, pieds: 0.1 },
  SP1: { nom: "SP1 — statique à pieds dameurs", court: "statique à pieds dameurs SP1", vibrant: false, organe: "pieds", R: 0.72, pieds: 0.13 },
};
const ALLURES = { 0.75: "lente", 1: "du tableau", 1.25: "rapide", 1.5: "trop rapide" };
const LONGUEUR = 30; // m : planche d'essai
const INVERSION = 4; // s : arrêt et changement de sens au bout de la planche
const FOND = 0.08; // m : épaisseur de la tranche « fond de couche »
let compteur = 0;

export function monter(banc) {
  const uid = `planche${++compteur}`;
  const c = charpente(banc, {
    vitesse: 30, vitesses: [1, 10, 30, 100],
    commandes: `
      <div class="field"><label>Matériau</label><div class="input-wrap"><select data-r="mat">${Object.entries(SOLS).map(([k, s]) => `<option value="${k}">${esc(s.nom)} (${esc(s.classe)})</option>`).join("")}</select></div></div>
      <div class="field"><label>Objectif de densification</label><div class="input-wrap"><select data-r="obj">${Object.entries(OBJECTIFS).map(([k, o]) => `<option value="${k}">${esc(o.nom)}</option>`).join("")}</select></div></div>
      <div class="field"><label>Compacteur</label><div class="input-wrap"><select data-r="comp">${Object.entries(COMPACTEURS).map(([k, x]) => `<option value="${k}"${k === "V3" ? " selected" : ""}>${esc(x.nom)}</option>`).join("")}</select></div></div>
      <div class="field"><label>Épaisseur compactée de la couche</label><div class="input-wrap"><input data-r="ep" type="text" inputmode="decimal" value="0.30" data-curseur="0.2 0.6 0.05"><span class="unit">m</span></div></div>
      <div class="field"><label>Allure du compacteur</label><div class="input-wrap"><select data-r="all">${Object.entries(ALLURES).map(([k]) => `<option value="${k}"${k === "1" ? " selected" : ""}></option>`).join("")}</select></div></div>
      <p class="method-note banc-presc" style="grid-column:1/-1"></p>`,
  });
  contenirLargeur(c);
  const val = (r) => c.q(`[data-r="${r}"]`).value;
  let e, b, etatBoutons, loupe, signature = "";

  const reinit = () => {
    const sol = SOLS[val("mat")], obj = val("obj"), cle = val("comp"), eng = COMPACTEURS[cle];
    const ep = borne(Math.round(parseFloat(String(val("ep")).replace(",", ".")) * 100) / 100 || 0.3, 0.2, 0.6);
    const allure = Number(val("all")) || 1;
    const { cellule, source } = cellulePlanche({ sol, compacteur: cle, objectif: obj });
    loupe = fenetreLoupe(c, eng.organe === "pneu" ? "le pneu sur la couche" : eng.organe === "pieds" ? "les pieds dameurs sur la couche" : "la bille sur la couche");
    e = { sol, obj, cle, eng, ep, allure, source, cellule, x: 0, sens: 1, N: 0, pause: 0, t: 0, fini: false, id: "" };
    if (!cellule) {
      // Compacteur hors tableau pour ce matériau : pas de planche possible.
      e.fini = true;
      for (const o of c.q('[data-r="all"]').options) o.textContent = ALLURES[o.value];
      c.q(".banc-presc").textContent = `Le ${eng.court} ne convient pas pour ce matériau (case grisée du tableau de compactage).`;
      c.scene.innerHTML = ""; c.courbes.innerHTML = ""; c.lectures.innerHTML = "";
      loupe("", "compacteur ne convenant pas pour ce matériau");
      c.bilan.innerHTML = `<p class="final-result">Le ${esc(eng.court)} ne convient pas pour ce matériau : le tableau de compactage (GTR 2024, fascicule 2, annexe 4) ne le prescrit pas — choisissez un autre compacteur.</p>`;
      return;
    }
    // Prescription : Q/S, épaisseur maximale et vitesse lues au tableau, N = e/(Q/S).
    const tri = [...cellule.options].sort((a, b2) => a.e - b2.e), eMax = tri.at(-1).e, VeMax = tri.at(-1).V;
    const p = prescrire(cellule, ep);
    e.eMax = eMax; e.horsTableau = !p.applicable; e.motif = p.motif ?? "";
    e.Np = p.applicable ? p.N : applications(ep, cellule.QS);
    e.Vp = p.applicable ? p.V : VeMax;
    e.V = e.Vp * allure;
    e.QL = debitParLargeur(cellule.QS, e.Vp);
    // Ce que le compacteur sait traiter à l'allure choisie : V e = cste pour un vibrant.
    const capacite = (v) => Math.min(eMax, Math.max(...tri.map((o) => (o.e * o.V) / v)));
    e.eRef = eng.vibrant ? capacite(e.V) : eMax;
    e.eta = eng.vibrant ? borne(e.Vp / e.V, 0.5, 1.25) : borne(Math.sqrt(e.Vp / e.V), 0.6, 1.15);
    e.Nfin = 2 * e.Np;
    // Mesures de chaque application (avec la petite dispersion d'un contrôle réel).
    const g = graineDe(`${val("mat")}|${obj}|${cle}|${ep}|${allure}`);
    e.mesures = [];
    for (let n = 0; n <= e.Nfin; n++) {
      const pr = profilDensification({ N: n * e.eta, Nref: e.Np, e: ep, eRef: e.eRef });
      const moyen = pr.moyen + (n ? 0.15 * gauss(n, g) : 0), fond = pr.fond + (n ? 0.2 * gauss(n + 97, g) : 0);
      const rhoDm = (moyen / 100) * sol.rhoDOPN, rhoDfc = (fond / 100) * sol.rhoDOPN;
      e.mesures.push({ n, pr, rhoDm, rhoDfc, ctrl: controleDensite({ rhoDmoy: rhoDm, rhoDfc, rhoDOPN: sol.rhoDOPN, objectif: obj }) });
    }
    // Épaisseur de la couche : foisonnée au départ, elle se tasse jusqu'à l'épaisseur compactée.
    const moyenFin = e.mesures[e.Nfin].pr.moyen;
    e.h = (n) => (ep * moyenFin) / e.mesures[Math.min(n, e.Nfin)].pr.moyen;
    majAllures();
    c.q(".banc-presc").innerHTML = prescriptionTexte(tri);
    c.scene.innerHTML = fond();
    c.courbes.innerHTML = '<div class="dyn-profil"></div><div class="dyn-evolution"></div>';
    c.bilan.innerHTML = "";
    signature = "";
    dessiner(); dessinerLent();
  };

  /** Libellés de l'allure : la vitesse du tableau pour ce compacteur et cette épaisseur. */
  function majAllures() {
    for (const o of c.q('[data-r="all"]').options) {
      const k = Number(o.value);
      o.textContent = `${ALLURES[o.value]} : ${fd(e.Vp * k, 1)} km/h${k === 1 ? "" : ` (${f(k, 3)} V)`}`;
    }
  }

  function prescriptionTexte(tri) {
    const opts = tri.map((o) => `e ≤ ${fd(o.e, 2)} m à ${fd(o.V, 1)} km/h`).join(" ou ");
    return `GTR 2024, fascicule 2, annexe 4 : ${esc(e.source)} — ${esc(e.cle)} : Q/S = ${fd(e.cellule.QS, 3)} m ; ${opts}.
      Pour e = ${fd(e.ep, 2)} m : N prescrit = ⌈e/(Q/S)⌉ = <strong>${e.Np}</strong>${e.horsTableau ? ` — <strong>couche plus épaisse que l'épaisseur maximale du tableau</strong>` : ""}. La planche reçoit ${e.Nfin} applications, le double.`;
  }

  // ── Marche du rouleau : allers et retours, une application par passe ──
  const avancer = (dt) => {
    if (e.fini) return false;
    const v = e.V / 3.6;
    let reste = dt;
    while (reste > 1e-9 && !e.fini) {
      if (e.pause > 0) {
        const h = Math.min(reste, e.pause);
        e.pause -= h; e.t += h; reste -= h;
        if (e.pause <= 1e-9) { e.pause = 0; e.sens = -e.sens; }
        continue;
      }
      const cible = e.sens > 0 ? LONGUEUR : 0, h = Math.min(reste, Math.abs(cible - e.x) / v);
      e.x += e.sens * h * v; e.t += h; reste -= h;
      if (Math.abs(cible - e.x) < 1e-9) {
        e.x = cible; e.N++;
        if (e.N >= e.Nfin) e.fini = true; else e.pause = INVERSION;
      }
    }
    return !e.fini;
  };

  // ── Scène : la planche vue de côté (épaisseurs × 10) ──
  const X0 = 120, X1 = 610, KX = (X1 - X0) / LONGUEUR, KV = 10 * KX, KM = 1.3 * KX; // px/m : planche, épaisseurs (× 10), engins
  const X = (x) => X0 + x * KX;
  const motifSol = () => solDe(e.sol.motif);

  function fond() {
    // Base de la couche : sous les cases des applications, l'engin et la couche foisonnée.
    e.YB = Math.round(98 + 3.65 * KM + e.h(0) * KV);
    const YB = e.YB;
    return svg({
      largeur: 640, hauteur: YB + 66, titre: "Planche de compactage", contenu: (id) => {
        e.id = id;
        let s = couche(id, { x: 10, y: YB, w: 620, h: 34, sol: { fond: teinte(motifSol().fond, 0.86), motif: motifSol().motif } });
        s += texte(624, YB + 22, "couche précédente, déjà compactée", 'text-anchor="end" class="halo" style="font-size:10px;font-weight:700"');
        for (let x = 0; x <= LONGUEUR; x += 5) s += ligne(X(x), YB + 34, X(x), YB + 40, COULEURS.trait, 1) + texte(X(x), YB + 52, `${x}${x === LONGUEUR ? " m" : ""}`, 'text-anchor="middle" style="font-size:10px;fill:#64748b"');
        s += texte(14, YB + 52, "épaisseurs × 10", 'style="font-size:10px;fill:#64748b"');
        s += `<g class="dyn-planche"></g>`;
        return s;
      },
    });
  }

  /** Profil d'une application : taux de compactage aux profondeurs relatives 0 → 1. */
  const degrade = (gid, n, yHaut) => {
    const pr = e.mesures[Math.min(n, e.Nfin)].pr;
    const stops = [0, 0.15, 0.3, 0.5, 0.7, 0.85, 1].map((u) => `<stop offset="${u}" stop-color="${teinteTaux(motifSol().fond, pr.taux(u * e.ep))}"/>`).join("");
    return `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="0" y1="${r1(yHaut)}" x2="0" y2="${e.YB}">${stops}</linearGradient>`;
  };

  /** Engin vu de côté, organe de compactage au point (Xe, Ye) du sol, dessiné en mètres à k px/m. */
  function engin({ Xe, Ye, k, vib, angle }) {
    const ns = 'vector-effect="non-scaling-stroke"', J = "#fbbf24", JS = "#92400e", PN = "#1f2937", VITRE = "#bae6fd";
    const eng = e.eng, cle = e.cle;
    const rect = (x0, y0, x1, y1, fill, extra = "") => `<rect x="${x0}" y="${y0}" width="${(x1 - x0).toFixed(3)}" height="${(y1 - y0).toFixed(3)}" fill="${fill}" stroke="${JS}" stroke-width="1" ${ns} ${extra}/>`;
    const pneu = (cx, r, clair = false) => `<circle cx="${cx}" cy="${-r}" r="${r}" fill="${clair ? "#475569" : PN}" ${ns}/><circle cx="${cx}" cy="${-r}" r="${(r * 0.38).toFixed(3)}" fill="#94a3b8" stroke="#334155" stroke-width="1" ${ns}/>`;
    const cylindre = (cx, R, hp) => {
      let t = `<circle cx="${cx}" cy="${-(R + hp)}" r="${R}" fill="${ACIER}" stroke="${ACIER_SOMBRE}" stroke-width="1.2" ${ns}/>`;
      // Pieds dameurs : seize plots qui tournent avec le cylindre.
      const P = (r, a) => `${(cx + r * Math.cos(a)).toFixed(3)} ${(-(R + hp) + r * Math.sin(a)).toFixed(3)}`;
      if (hp) for (let j = 0; j < 16; j++) {
        const a = angle + (j * Math.PI) / 8;
        t += `<path d="M${P(R, a + 0.06)}L${P(R + hp, a + 0.035)}L${P(R + hp, a - 0.035)}L${P(R, a - 0.06)}Z" fill="${ACIER_SOMBRE}" ${ns}/>`;
      }
      return t + `<circle cx="${cx}" cy="${-(R + hp)}" r="0.14" fill="#334155" ${ns}/>`;
    };
    let s = "";
    if (cle === "P2") {
      s += rect(-3.95, -1.9, 0.6, -0.62, J) + rect(-3.6, -1.5, 0.2, -1.2, "#f59e0b", 'stroke="none"');
      s += rect(-2.75, -3.0, -1.5, -1.9, VITRE, `fill-opacity=".75"`) + rect(-2.9, -3.12, -1.35, -3.0, J);
      s += pneu(0.18, 0.5, true) + pneu(0, 0.5) + pneu(-3.12, 0.5, true) + pneu(-3.3, 0.5);
    } else if (cle === "SP1") {
      const R = eng.R, hp = eng.pieds;
      s += `<path d="M0.55 -1.15L1.15 -1.25L1.25 -0.12L1.05 -0.12Z" fill="#94a3b8" stroke="#334155" stroke-width="1" ${ns}/>`;
      s += rect(-4.45, -2.1, 0.75, -1.05, J) + rect(-4.45, -2.4, -2.7, -2.1, J);
      s += rect(-2.55, -3.35, -1.25, -2.1, VITRE, `fill-opacity=".75"`) + rect(-2.7, -3.48, -1.1, -3.35, J);
      s += cylindre(0, R, hp) + cylindre(-3.5, R, hp);
    } else {
      const R = eng.R, hp = eng.pieds ?? 0, L = eng.L, rt = eng.rt, xT = -(L - rt - R - hp);
      s += rect(xT - rt - 0.1, -1.95, -R - hp - 1.45, -0.95, J);
      s += rect(-R - hp - 0.75, -1.35, -R - hp + 0.15, -0.8, "#d97706");
      s += rect(-R - hp - 1.6, -3.05, -R - hp - 0.55, -1.95, VITRE, `fill-opacity=".75"`) + rect(-R - hp - 1.75, -3.18, -R - hp - 0.4, -3.05, J);
      s += pneu(xT, rt);
      s += cylindre(0, R, hp);
      s += rect(-(R + hp) - 0.15, -2 * (R + hp) - 0.32, R + hp + 0.15, -2 * (R + hp) - 0.08, J);
      s += `<path d="M${(-0.45 * R).toFixed(3)} ${(-2 * (R + hp) - 0.1).toFixed(3)}L${(0.45 * R).toFixed(3)} ${(-2 * (R + hp) - 0.1).toFixed(3)}L0.2 ${(-(R + hp) + 0.05).toFixed(3)}L-0.2 ${(-(R + hp) + 0.05).toFixed(3)}Z" fill="${J}" stroke="${JS}" stroke-width="1" ${ns}/>`;
      s += `<circle cx="0" cy="${-(R + hp)}" r="0.13" fill="#334155" ${ns}/>`;
    }
    return `<g transform="translate(${r1(Xe)} ${r1(Ye + vib)}) scale(${k.toFixed(3)})">${s}</g>`;
  }

  function dessiner() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    const N = e.N, enPause = e.pause > 0 || e.fini || (e.t === 0), YB = e.YB;
    const nDerriere = enPause ? N : Math.min(N + 1, e.Nfin);
    const yAv = YB - e.h(N) * KV, yAp = YB - e.h(nDerriere) * KV, Xd = X(e.x);
    // Couche : déjà passée dans cette passe (derrière l'organe) et encore à passer (devant).
    const [xa, xb] = e.sens > 0 ? [X0, Xd] : [Xd, X1];
    let s = `<defs>${degrade(`${uid}-av`, N, yAv)}${degrade(`${uid}-ap`, nDerriere, yAp)}</defs>`;
    s += `<rect x="10" y="${r1(yAv)}" width="620" height="${r1(YB - yAv)}" fill="url(#${uid}-av)"/>`;
    // Partie déjà passée : elle s'est tassée ; le ciel reprend la tranche du dessus.
    if (xb > xa) s += `<rect x="${r1(xa)}" y="${r1(yAv)}" width="${r1(xb - xa)}" height="${r1(Math.max(0, yAp - yAv))}" fill="#fff"/><rect x="${r1(xa)}" y="${r1(yAp)}" width="${r1(xb - xa)}" height="${r1(YB - yAp)}" fill="url(#${uid}-ap)"/>`;
    // Contour de la couche : motif du sol et surface.
    let surf = `M10 ${r1(yAv)}`;
    if (xb > xa) surf += `H${r1(xa)}V${r1(yAp)}H${r1(xb)}V${r1(yAv)}`;
    surf += "H630";
    s += `<path d="${surf}V${YB}H10Z" fill="url(#${e.id}-${motifSol().motif})" opacity=".7"/>`;
    s += `<path d="${surf}" fill="none" stroke="${TRAIT}" stroke-width="1.6"/>`;
    s += ligne(X0, yAv - 30, X0, YB, COULEURS.discret, 1, 'stroke-dasharray="4 3"') + ligne(X1, yAv - 30, X1, YB, COULEURS.discret, 1, 'stroke-dasharray="4 3"');
    // Le compacteur : il avance et recule sans faire demi-tour.
    const vibre = e.eng.vibrant && !enPause;
    const vib = vibre ? 0.6 * Math.sin(horloge() * 70) : 0;
    const yE = Math.min(yAv, yAp);
    s += engin({ Xe: Xd, Ye: yE, k: KM, vib, angle: e.x / (e.eng.R + (e.eng.pieds ?? 0)) });
    if (vibre) for (let j = 0; j < 3; j++) { const q = (horloge() * 3 + j / 3) % 1; s += `<path d="M${r1(Xd - 6 - 10 * q)} ${r1(yE + 4 + 10 * q)}Q${r1(Xd)} ${r1(yE + 10 + 14 * q)} ${r1(Xd + 6 + 10 * q)} ${r1(yE + 4 + 10 * q)}" fill="none" stroke="${ROUGE}" stroke-width="1.2" opacity="${r1(1 - q)}"/>`; }
    const yHaut = yE - 3.65 * KM;
    if (!e.fini && e.t > 0) {
      // Flèche du sens de marche ; le libellé passe de l'autre côté au bord de la scène.
      const droite = e.sens > 0 ? Xd + 80 < 636 : Xd - 80 < 4;
      s += fleche(Xd - 16 * e.sens, yHaut, Xd + 16 * e.sens, yHaut, enPause ? COULEURS.discret : COULEURS.bleu, 2, 6)
        + texte(droite ? Xd + 22 : Xd - 22, yHaut + 4, enPause ? "inversion" : `${fd(e.V, 1)} km/h`, `text-anchor="${droite ? "start" : "end"}" class="halo" style="font-size:10px;font-weight:700;fill:${enPause ? "#64748b" : COULEURS.bleu}"`);
    }
    // Applications : une case par passe, colorée selon l'objectif atteint.
    const pas = Math.min(18, (X1 - X0) / e.Nfin);
    s += texte(14, 25, "applications", 'style="font-size:10.5px;font-weight:700"');
    for (let n = 1; n <= e.Nfin; n++) {
      const m = e.mesures[n], fait = n <= N;
      const coul = !fait ? "#fff" : m.ctrl.ok ? "#16a34a" : m.ctrl.okMoyen ? "#f59e0b" : ROUGE;
      s += `<rect x="${r1(X0 + (n - 1) * pas)}" y="15" width="${r1(pas - 4)}" height="12" rx="2" fill="${coul}" stroke="#334155" stroke-width="${n === N && !enPause ? 1.8 : 0.8}"/>`;
    }
    const xs = X0 + e.Np * pas - 2;
    s += ligne(xs, 13, xs, 30, COULEURS.gtr24, 2) + texte(xs, 10, `N prescrit = ${e.Np}`, `text-anchor="middle" style="font-size:10px;font-weight:700;fill:${COULEURS.gtr24}"`);
    s += legendeCases(610, 45);
    s += texte(14, 66, `${e.sol.nom} · objectif ${e.obj} · ${e.eng.court} à ${fd(e.V, 1)} km/h · e = ${fd(e.ep, 2)} m`, 'style="font-size:10.5px;font-weight:700;fill:#334155"');
    svgEl.querySelector(".dyn-planche").innerHTML = s;
    const m = e.mesures[N];
    c.lectures.innerHTML = lectures([
      ["Applications N", String(N), `prescrit : ${e.Np}`], ["Taux moyen", fd(m.ctrl.tauxMoyen, 1), "% de ρdOPN"],
      ["Fond de couche", fd(m.ctrl.tauxFond, 1), "% de ρdOPN"], ["ρd moyen", fd(m.rhoDm, 3), "Mg/m³"], ["Temps d'essai", duree(e.t), ""],
    ]) + `<p class="banc-etat">${e.fini ? "planche terminée" : e.t === 0 ? "couche foisonnée, prête" : e.pause > 0 ? "bout de planche : inversion du sens de marche" : `passe ${N + 1} ${e.sens > 0 ? "→" : "←"}`}</p>`;
    loupe(...vueLoupe());
  }

  const legendeCases = (x, y) => {
    const items = [["#16a34a", "objectif atteint"], ["#f59e0b", "moyenne seule"], [ROUGE, "non atteint"]];
    let s = "", xx = x;
    for (const [col, lib] of [...items].reverse()) {
      const w = largeurTexte(lib, 10, false);
      s += texte(xx, y, lib, 'text-anchor="end" style="font-size:10px;fill:#475569"') + `<rect x="${r1(xx - w - 13)}" y="${y - 9}" width="9" height="9" rx="1.5" fill="${col}"/>`;
      xx -= w + 26;
    }
    return s;
  };

  // ── Loupe : l'organe de compactage sur la couche ; les grains se serrent derrière lui ──
  const XC = 88;
  function vueLoupe() {
    const N = e.N, enPause = e.pause > 0 || e.fini || e.t === 0, nAp = enPause ? N : Math.min(N + 1, e.Nfin);
    const h0 = e.h(0), k = borne(100 / h0, 130, 420), yBase = 152, yLache = yBase - h0 * k;
    const hAv = e.h(N), hAp = e.h(nAp), contact = Math.max(10, 0.12 * k);
    // Part « déjà passée » d'une colonne de la loupe, selon le sens de marche (0 devant, 1 derrière).
    const derriere = (x) => borne(0.5 - ((x - XC) * e.sens) / (2 * contact), 0, 1);
    const hDe = (x) => { const u = derriere(x); return hAv + (hAp - hAv) * u; };
    const pente = (n) => { const pr = e.mesures[n].pr; return 1 + 0.02 * Math.max(0, pr.taux(0) - pr.taux(e.ep)); };
    const gAv = pente(N), gAp = pente(nAp);
    // Les grains, dessinés à l'état foisonné, sont ramenés dans l'épaisseur actuelle : ils se rapprochent.
    const deplacer = (x, y) => {
      if (y > yBase) return [x, y];
      const z = borne((y - yLache) / (h0 * k), 0, 1), u = derriere(x), h = hDe(x), g = gAv + (gAp - gAv) * u;
      return [x, yBase - h * k + h * k * z ** g];
    };
    const ySurf = (x) => yBase - hDe(x) * k;
    const t = horloge(), vibre = e.eng.vibrant && !enPause;
    let s = `<rect width="${WL}" height="${HL}" fill="#f8fafc"/>`;
    // Couche colorée par son taux de compactage, puis la couche précédente.
    const col = (n, z) => teinteTaux(motifSol().fond, e.mesures[n].pr.taux(z * e.ep));
    const grad = (gid, n) => `<linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">${[0, 0.3, 0.6, 1].map((u) => `<stop offset="${u}" stop-color="${col(n, u)}"/>`).join("")}</linearGradient>`;
    let poly = `M0 ${r1(ySurf(0))}`;
    for (let x = 4; x <= WL; x += 4) poly += `L${x} ${r1(ySurf(x))}`;
    // Devant l'organe, l'état des passes déjà faites ; derrière, celui de la passe en cours.
    const [gx0, gx1] = e.sens > 0 ? [0, XC] : [XC, WL];
    s += `<defs>${grad(`${uid}-lav`, N)}${grad(`${uid}-lap`, nAp)}<clipPath id="${uid}-lc"><rect x="${gx0}" y="0" width="${gx1 - gx0}" height="${HL}"/></clipPath></defs>`;
    s += `<path d="${poly}V${yBase}H0Z" fill="url(#${uid}-lav)"/><path d="${poly}V${yBase}H0Z" fill="url(#${uid}-lap)" clip-path="url(#${uid}-lc)"/>`;
    s += `<rect x="0" y="${yBase}" width="${WL}" height="${HL - yBase}" fill="${teinte(motifSol().fond, 0.82)}"/>`;
    s += vueTerrain({ couches: [{ z0: 0, z1: h0, sol: e.sol.motif }, { z0: h0, z1: 9, sol: e.sol.motif }], Y: (z) => yLache + z * k, k, zHaut: 0, zBas: (HL - yLache) / k, decalageX: -e.x * k, deplacer, fond: false });
    s += `<path d="${poly}" fill="none" stroke="${TRAIT}" stroke-width="1.4"/>` + ligne(0, yBase, WL, yBase, "#475569", 1, 'stroke-dasharray="4 3"');
    // Ondes de la vibration sous l'organe.
    if (vibre) for (let j = 0; j < 3; j++) {
      const q = (t * 1.8 + j / 3) % 1, r = 8 + q * (yBase - ySurf(XC) + 10);
      s += `<path d="M${r1(XC - r)} ${r1(ySurf(XC))}A${r1(r)} ${r1(r * 0.8)} 0 0 0 ${r1(XC + r)} ${r1(ySurf(XC))}" fill="none" stroke="${ROUGE}" stroke-width="1.1" opacity="${r1(0.8 * (1 - q))}"/>`;
    }
    // L'organe : bille lisse, cylindre à pieds ou pneu, à grande échelle.
    const yC = ySurf(XC), dv = vibre ? 1.6 * Math.sin(t * 60) : 0, ang = e.x / e.eng.R;
    if (e.eng.organe === "pneu") {
      const R = e.eng.R * k;
      s += `<circle cx="${XC}" cy="${r1(yC - R + 2)}" r="${r1(R)}" fill="#1f2937"/>`;
      for (let j = 0; j < 24; j++) { const a = ang + (j * Math.PI) / 12; s += `<path d="M${r1(XC + (R - 1) * Math.cos(a))} ${r1(yC - R + 2 + (R - 1) * Math.sin(a))}L${r1(XC + (R - 7) * Math.cos(a))} ${r1(yC - R + 2 + (R - 7) * Math.sin(a))}" stroke="#4b5563" stroke-width="3"/>`; }
      s += `<circle cx="${XC}" cy="${r1(yC - R + 2)}" r="${r1(R * 0.55)}" fill="#94a3b8" stroke="#334155"/>`;
    } else {
      const R = e.eng.R * k, hp = (e.eng.pieds ?? 0) * k, cy = yC - R - hp * 0.55 + dv;
      s += `<circle cx="${XC}" cy="${r1(cy)}" r="${r1(R)}" fill="${ACIER}" stroke="${ACIER_SOMBRE}" stroke-width="2"/><circle cx="${XC}" cy="${r1(cy)}" r="${r1(R - 7)}" fill="none" stroke="#e2e8f0" stroke-width="2"/>`;
      if (hp) for (let j = 0; j < 40; j++) {
        const a = ang + (j * Math.PI) / 20;
        if (cy + R * Math.sin(a) < -10) continue;
        const w = 0.035;
        s += `<path d="M${r1(XC + R * Math.cos(a - w))} ${r1(cy + R * Math.sin(a - w))}L${r1(XC + (R + hp) * Math.cos(a - w * 0.6))} ${r1(cy + (R + hp) * Math.sin(a - w * 0.6))}L${r1(XC + (R + hp) * Math.cos(a + w * 0.6))} ${r1(cy + (R + hp) * Math.sin(a + w * 0.6))}L${r1(XC + R * Math.cos(a + w))} ${r1(cy + R * Math.sin(a + w))}Z" fill="${ACIER_SOMBRE}"/>`;
      }
      if (vibre) s += fleche(XC, Math.max(8, cy + R - 40), XC, Math.max(20, cy + R - 22), ROUGE, 1.6, 5) + fleche(XC, Math.max(20, cy + R - 22), XC, Math.max(8, cy + R - 40), ROUGE, 1.6, 5);
    }
    if (!enPause) s += fleche(e.sens > 0 ? WL - 40 : WL - 12, 14, e.sens > 0 ? WL - 12 : WL - 40, 14, COULEURS.bleu, 2, 6);
    s += etiquette(6, 13, e.eng.organe === "pneu" ? "pneu" : e.eng.organe === "pieds" ? "pieds dameurs" : "bille vibrante");
    s += etiquette(WL - 6, HL - 6, `fond : ${fd(e.mesures[N].ctrl.tauxFond, 1)} %`, { ancre: "end", couleur: "#7c2d12" });
    s += barreEchelle(10, HL - 12, 0.1 * k, "10 cm");
    const legende = e.t === 0 ? "couche foisonnée : les grains sont encore lâches"
      : e.fini ? "fin : le fond de couche reste moins serré que la surface"
        : e.pause > 0 ? "bout de planche : vibration coupée, le rouleau repart en arrière"
          : e.eng.vibrant ? `passe ${N + 1} : la bille vibre, les grains se serrent derrière elle`
            : e.eng.organe === "pneu" ? `passe ${N + 1} : le pneu pétrit et serre la couche` : `passe ${N + 1} : les pieds pétrissent et serrent la couche`;
    return [s, legende];
  }

  // ── Courbes : profil dans l'épaisseur, et évolution avec N ──
  function dessinerLent() {
    const zp = c.courbes.querySelector(".dyn-profil"), ze = c.courbes.querySelector(".dyn-evolution");
    if (!zp || !ze) return;
    const sig = `${e.N}|${e.fini}`;
    if (sig === signature) return;
    signature = sig;
    const o = OBJECTIFS[e.obj], ep = e.ep, cm = 100 * ep, N = e.N, m = e.mesures[N];
    const ech = (pr) => Array.from({ length: 31 }, (_, i) => [pr.taux((ep * i) / 30), (cm * i) / 30]);
    const xMin = Math.min(o.fond - 2, Math.floor(Math.min(...e.mesures.slice(1).map((q) => q.pr.taux(ep))) - 1));
    const series = [];
    if (N > e.Np) series.push({ points: ech(e.mesures[e.Np].pr), couleur: COULEURS.gtr24, tirets: "6 4", epaisseur: 1.8, libelle: `au N prescrit (${e.Np})` });
    if (N > 0) series.push({ points: ech(m.pr), couleur: COULEURS.bleu, epaisseur: 2.6, libelle: `après ${N} application${N > 1 ? "s" : ""}` });
    series.push({ points: [[o.moyen, 0], [o.moyen, cm]], couleur: COULEURS.gtr92, tirets: "5 4", epaisseur: 1.6, libelle: `moyenne visée ${e.obj} : ${f(o.moyen, 3)} %` });
    series.push({ points: [[o.fond, cm - 100 * FOND], [o.fond, cm]], couleur: COULEURS.rouge, tirets: "3 3", epaisseur: 2, libelle: `fond visé : ${f(o.fond, 3)} %` });
    zp.innerHTML = graphe({
      largeur: 560, hauteur: 250, xmin: xMin, xmax: 102, ymin: 0, ymax: cm, inverserY: true, pasX: 2,
      xlabel: "taux de compactage (% de ρdOPN)", ylabel: "profondeur dans la couche (cm)", series,
      zones: [{ x0: xMin, x1: 102, y0: cm - 100 * FOND, y1: cm, couleur: COULEURS.rouge, opacite: 0.08, libelle: "fond de couche (8 cm)", position: "gauche" }],
      marques: N > 0 ? [{ x: m.ctrl.tauxMoyen, y: cm / 2, couleur: COULEURS.bleu, rayon: 4, libelle: `ρdm ${fd(m.ctrl.tauxMoyen, 1)} %` }] : [],
    });
    const pts = e.mesures.slice(0, N + 1), yMin = Math.floor(Math.min(...e.mesures.map((q) => q.ctrl.tauxFond)) - 1);
    ze.innerHTML = graphe({
      largeur: 560, hauteur: 240, xmin: 0, xmax: e.Nfin, ymin: yMin, ymax: 102, pasX: e.Nfin > 16 ? 2 : 1,
      xlabel: "nombre d'applications N", ylabel: "taux de compactage (%)",
      series: [
        { points: [[0, o.moyen], [e.Nfin, o.moyen]], couleur: COULEURS.gtr92, tirets: "5 4", epaisseur: 1.4, libelle: "moyenne visée" },
        { points: [[0, o.fond], [e.Nfin, o.fond]], couleur: COULEURS.rouge, tirets: "3 3", epaisseur: 1.4, libelle: "fond visé" },
        { points: [[e.Np, yMin], [e.Np, 102]], couleur: COULEURS.gtr24, tirets: "6 4", epaisseur: 1.6, libelle: `N prescrit = e/(Q/S) → ${e.Np}` },
        { points: pts.map((q) => [q.n, q.ctrl.tauxMoyen]), couleur: COULEURS.bleu, epaisseur: 2.2, marqueurs: true, libelle: "taux moyen ρdm" },
        { points: pts.map((q) => [q.n, q.ctrl.tauxFond]), couleur: COULEURS.rouge, epaisseur: 2.2, marqueurs: true, libelle: "fond de couche ρdfc" },
      ],
    });
  }

  function bilan() {
    if (!e.mesures) return;
    const o = OBJECTIFS[e.obj], M = e.mesures, mP = M[e.Np], mF = M[e.Nfin];
    // Premier N à partir duquel l'objectif reste tenu jusqu'au bout de la planche.
    const nOk = M.findIndex((q, i) => q.n > 0 && M.slice(i).every((r) => r.ctrl.ok));
    const QS = e.cellule.QS, qsReel = (n) => e.ep / n;
    const verdict = (q) => (q.ctrl.ok ? `objectif ${e.obj} atteint` : q.ctrl.okMoyen ? "fond de couche insuffisant" : "moyenne insuffisante");
    const ligneT = (q, titre) => `<tr class="${q.ctrl.ok ? "ligne-retenue" : "ko"}"><td>${titre}</td><td class="n">${q.n}</td><td class="n">${fd(qsReel(q.n), 3)}</td><td class="n">${fd(q.rhoDm, 3)}</td><td class="n">${fd(q.ctrl.tauxMoyen, 1)}</td><td class="n">${fd(q.rhoDfc, 3)}</td><td class="n">${fd(q.ctrl.tauxFond, 1)}</td><td>${verdict(q)}</td></tr>`;
    const trop = e.ep > e.eRef + 1e-6;
    let lecon;
    if (!mF.ctrl.ok && mF.ctrl.okMoyen && mF.ctrl.tauxFond > o.fond - 0.6) lecon = `Le fond plafonne au seuil (${fd(mF.ctrl.tauxFond, 1)} % pour ${f(o.fond, 3)} %) : les passes de plus le font osciller autour de la limite sans la franchir franchement. Une couche trop épaisse ne se rattrape pas en ajoutant des passes — c'est le fond qui manque : couches plus minces (le ${esc(e.eng.court)} traite ${fd(e.eRef, 2)} m à cette allure) ou compacteur plus lourd.`;
    else if (!mF.ctrl.ok && mF.ctrl.okMoyen) lecon = `Une couche trop épaisse ne se rattrape pas en ajoutant des passes : à ${e.Nfin} applications, la surface est serrée (ρdm = ${fd(mF.ctrl.tauxMoyen, 1)} %) mais le fond plafonne à ${fd(mF.ctrl.tauxFond, 1)} % — c'est le fond qui manque. Il faut des couches plus minces (le ${esc(e.eng.court)} traite ${fd(e.eRef, 2)} m à cette allure), un compacteur plus lourd ou une allure plus lente.`;
    else if (!mF.ctrl.ok) lecon = `Même en doublant les passes, la moyenne n'atteint pas ${f(o.moyen, 3)} %${e.obj === "q3" ? " : les valeurs du tableau « remblai » visent q4 ; une couche de forme a ses propres tableaux, aux Q/S plus faibles" : ""}${trop ? ` et la couche dépasse ce que le compacteur traite (${fd(e.eRef, 2)} m)` : ""}.`;
    else if (nOk < e.Np) lecon = `Le tableau est tenu, avec une marge : l'objectif est déjà atteint à N = ${nOk} (Q/S réel ${fd(qsReel(nOk), 3)} m, plus que les ${fd(QS, 3)} m du tableau) ; les passes suivantes n'ajoutent que quelques points, surtout en surface.`;
    else if (nOk === e.Np) lecon = `Le tableau est tenu, sans marge : l'objectif est atteint juste au N prescrit ; les passes suivantes n'ajoutent que quelques points, surtout en surface.`;
    else lecon = `Le N prescrit ne suffit pas ici : il faut N = ${nOk} applications, soit Q/S réel = e/N = ${fd(qsReel(nOk), 3)} m au lieu de ${fd(QS, 3)} m${e.obj === "q3" ? " — normal : les valeurs du tableau « remblai » visent q4, une couche de forme a ses propres tableaux" : trop ? ` — la couche dépasse ce que le compacteur traite à cette allure (${fd(e.eRef, 2)} m)` : ""}.`;
    if (e.eng.vibrant && e.allure > 1) lecon += ` À ${fd(e.V, 1)} km/h au lieu de ${fd(e.Vp, 1)}, la bille frappe moins souvent chaque mètre et porte moins profond (V e = cste).`;
    c.bilan.innerHTML = `<p class="final-result">${esc(e.cle)} sur ${fd(e.ep, 2)} m (GTR 2024, fascicule 2, annexe 4 : ${esc(e.source)}) : Q/S = ${fd(QS, 3)} m ⇒ N prescrit = ⌈${fd(e.ep, 2)}/${fd(QS, 3)}⌉ = <strong>${e.Np}</strong>${e.horsTableau ? ` — couche plus épaisse que l'épaisseur maximale du tableau (${fd(e.eMax, 2)} m)` : ""}.
        Après ces ${e.Np} applications (Q/S réel = e/N = ${fd(qsReel(e.Np), 3)} m) : ρdm = <strong>${fd(mP.ctrl.tauxMoyen, 1)} %</strong> et ρdfc = <strong>${fd(mP.ctrl.tauxFond, 1)} %</strong> de ρdOPN —
        <strong>${mP.ctrl.ok ? `objectif ${e.obj} atteint` : `objectif ${e.obj} non atteint`}</strong> (${f(o.moyen, 3)} % en moyenne, ${f(o.fond, 3)} % au fond).
        <small>${lecon} Débit théorique du tableau : Q/L = 1 000 (Q/S) V = ${f(e.QL, 3)} m³/h par mètre de largeur compactée.</small></p>
      <div class="table-large"><table class="resultats"><thead><tr><th>Étape</th><th class="num">N</th><th class="num">Q/S réel = e/N (m)</th><th class="num">ρdm (Mg/m³)</th><th class="num">taux moyen (%)</th><th class="num">ρdfc (Mg/m³)</th><th class="num">taux au fond (%)</th><th>Lecture</th></tr></thead>
      <tbody>${[[mP, "N prescrit"], ...(nOk > 0 && nOk !== e.Np && nOk !== e.Nfin ? [[M[nOk], "objectif atteint"]] : []), [mF, "fin de planche"]].sort((a, b2) => a[0].n - b2[0].n).map(([q, t]) => ligneT(q, t)).join("")}</tbody></table></div>`;
  }

  b = boucle({ avancer, dessiner, dessinerLent, surFin: () => { signature = ""; dessinerLent(); bilan(); }, surEtat: () => etatBoutons?.() });
  etatBoutons = brancherMarche(c, b, reinit);
  const relancer = () => { b.raz(); reinit(); etatBoutons(); };
  c.commandes.querySelectorAll("select").forEach((x) => x.addEventListener("change", relancer));
  c.commandes.querySelector('[data-r="ep"]').addEventListener("change", relancer);
  c.commandes.querySelector('[data-r="ep"]').addEventListener("input", relancer);
  reinit();
  etatBoutons();
}
