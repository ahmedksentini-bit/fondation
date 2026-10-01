// Banc d'essai : le scissomètre de chantier (chapitre 2). Le moulinet, protégé
// par un sabot, est foncé jusqu'à la cote d'essai ; après une courte attente,
// la tête motorisée le fait tourner à 6° par minute. Le couple monte jusqu'au
// pic — cu —, puis retombe ; on fait faire dix tours rapides au moulinet pour
// remanier l'argile, et l'on mesure le couple du sol remanié — cu,r et la
// sensibilité. Un essai par mètre dans les couches fines.
import { svg, ligne, texte, COULEURS, graphe } from "../figures.js";
import { constanteMoulinet, scissometre } from "../geotech/essais.js";
import { SITES, terrain, estFin, natureDe } from "./terrain.js";
import { charpente, boucle, brancherMarche, lectures, coupe, axeProfondeur, panneau, points, f, fd, r1, esc, duree } from "./moteur.js";
import { fenetreLoupe, vueTerrain, tige, fleche, etiquette, horloge, W as WL, H as HL, ROUGE, ACIER_SOMBRE } from "./loupe.js";

const D = 70, H = 140, K = constanteMoulinet(D, H); // mm, mm, m³
const VROT = 0.1; // °/s, soit 6° par minute
const DUREES = { fonçage: 40, attente: 120, remaniement: 60 };
const ROT_PIC = 14, ROT_FIN = 90, ROT_REMANIE = 30; // °

export function monter(banc) {
  const c = charpente(banc, {
    vitesse: 100,
    commandes: `
      <div class="field"><label>Terrain</label><div class="input-wrap"><select data-r="site">${Object.values(SITES).map((s) => `<option value="${s.cle}">${esc(s.nom)}</option>`).join("")}</select></div></div>
      <div class="field"><label>Moulinet</label><div class="input-wrap"><select disabled><option>D = 70 mm, H = 140 mm (rapport 2)</option></select></div></div>`,
  });
  const loupe = fenetreLoupe(c, "le moulinet", { echelle: { px: 42.5, libelle: "5 cm" } });
  let e, b, etatBoutons;

  const reinit = () => {
    const site = SITES[c.q('[data-r="site"]').value], T = terrain(site.cle);
    // Cotes d'essai : tous les mètres dans les couches fines assez molles pour le moulinet.
    const cotes = [];
    for (let z = 1; z < site.zMax - 0.5; z += 1) {
      const k = T.couche(z);
      if (estFin(k) && z > k.z0 + 0.3 && z < k.z1 - 0.3 && T.cu(z) < 150) cotes.push(z);
    }
    e = { site, T, cotes, zMax: Math.min(site.zMax, Math.max(...cotes, 4) + 2), i: 0, t: 0, phase: cotes.length ? "fonçage" : "fini",
      minuteur: DUREES.fonçage, theta: 0, mesures: [], resultats: [], fini: !cotes.length };
    c.scene.innerHTML = fond(e);
    c.courbes.innerHTML = '<div class="dyn-courbe"></div>';
    c.bilan.innerHTML = cotes.length ? "" : '<p class="final-result">Aucune couche fine assez molle pour le scissomètre sur ce site.</p>';
    dessiner(); dessinerLent();
  };

  const essaiCourant = () => {
    const z = e.cotes[e.i], cu = e.T.cu(z), k = e.T.couche(z), nat = natureDe(k);
    return { z, cu, St: nat.St ?? 3, Ip: nat.Ip ?? 30, couche: k.nom, Mp: cu * 1000 * K };
  };
  /** Couple (N·m) à la rotation θ : montée au pic, radoucissement, puis sol remanié. */
  const couple = (x, theta, remanie) => {
    if (remanie) return (x.Mp / x.St) * (1 - Math.exp(-theta / 5)) * (1 + 0.02 * e.T.bruitFin(theta / 7));
    const u = theta / ROT_PIC;
    const g = u <= 1 ? u * Math.exp(1 - u) : 1 - 0.45 * (1 - Math.exp(-(theta - ROT_PIC) / 35));
    return x.Mp * g * (1 + 0.012 * e.T.bruitFin(theta / 5));
  };

  const avancer = (dt) => {
    if (e.fini) return false;
    let reste = dt;
    while (reste > 1e-9 && !e.fini) {
      if (e.phase === "rotation" || e.phase === "residuel") {
        const fin = e.phase === "rotation" ? ROT_FIN : ROT_REMANIE;
        const h = Math.min(reste, (fin - e.theta) / VROT);
        const avant = Math.floor(e.theta);
        e.theta += h * VROT; e.t += h; reste -= h;
        const x = essaiCourant();
        for (let d = avant + 1; d <= Math.floor(e.theta + 1e-9); d++) e.mesures.push({ theta: d, M: couple(x, d, e.phase === "residuel"), remanie: e.phase === "residuel" });
        if (e.theta >= fin - 1e-9) {
          if (e.phase === "rotation") { e.phase = "remaniement"; e.minuteur = DUREES.remaniement; }
          else conclure();
        }
        continue;
      }
      const h = Math.min(reste, e.minuteur);
      e.minuteur -= h; e.t += h; reste -= h;
      if (e.minuteur > 1e-9) continue;
      if (e.phase === "fonçage") { e.phase = "attente"; e.minuteur = DUREES.attente; }
      else if (e.phase === "attente") { e.phase = "rotation"; e.theta = 0; e.mesures = []; }
      else if (e.phase === "remaniement") { e.phase = "residuel"; e.theta = 0; }
    }
    return !e.fini;
  };

  const conclure = () => {
    const x = essaiCourant();
    const Mmax = Math.max(...e.mesures.filter((m) => !m.remanie).map((m) => m.M));
    const Mr = Math.max(...e.mesures.filter((m) => m.remanie).map((m) => m.M));
    const r = scissometre({ M: Mmax, Mres: Mr, Dmm: D, Hmm: H, Ip: x.Ip });
    e.resultats.push({ z: x.z, couche: x.couche, Ip: x.Ip, Mmax, Mr, r, courbe: [...e.mesures] });
    dessinerCourbe(true);
    e.i++;
    if (e.i >= e.cotes.length) { e.fini = true; e.phase = "fini"; }
    else { e.phase = "fonçage"; e.minuteur = DUREES.fonçage; e.theta = 0; e.mesures = []; }
  };

  // ── Dessin ──────────────────────────────────────────────────────────────
  const G = { yS: 176, bas: 488, xF: 104 };
  const Y = (z) => G.yS + (z / e.zMax) * (G.bas - G.yS);

  function fond(e2) {
    return svg({
      largeur: 640, hauteur: 500, titre: "Scissomètre en cours d'essai", contenu: (id) => {
        let s = coupe(id, { x0: 10, x1: 250, Y, couches: e2.site.couches, zMax: e2.zMax, zw: e2.site.zw });
        s += `<rect x="20" y="${G.yS - 30}" width="62" height="22" rx="5" fill="#e2e8f0" stroke="${COULEURS.betonTrait}"/>`;
        s += `<rect x="${G.xF - 16}" y="${G.yS - 64}" width="32" height="22" rx="4" fill="#fbbf24" stroke="#92400e"/>`;
        s += texte(G.xF + 20, G.yS - 66, "tête de rotation", 'style="font-size:9.5px;font-weight:700;fill:#78350f"');
        // Vue de dessus du moulinet (encart).
        s += `<circle cx="196" cy="70" r="40" fill="#fff" stroke="${COULEURS.trait}"/>`;
        s += texte(196, 124, "moulinet vu de dessus", 'text-anchor="middle" style="font-size:9.5px;fill:#475569"');
        s += `<g class="dyn-dessus"></g><g class="dyn-train"></g>`;
        s += axeProfondeur({ x: 274, Y, zMax: e2.zMax });
        const pC = panneau({ x0: 288, x1: 630, Y, zMax: e2.zMax, vMax: 100, titre: "cu et cu,r (kPa)", pas: 20 });
        e2.XC = pC.X;
        s += pC.svg + `<g class="dyn-cu"></g>`;
        return s;
      },
    });
  }

  function dessiner() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    const x = e.i < e.cotes.length ? essaiCourant() : null;
    let zV = x?.z ?? 0;
    if (e.phase === "fonçage" && x) zV = (e.i ? e.cotes[e.i - 1] : 0) + (x.z - (e.i ? e.cotes[e.i - 1] : 0)) * (1 - e.minuteur / DUREES.fonçage);
    const y = Y(zV);
    let t = `<rect x="${G.xF - 2.5}" y="${G.yS - 42}" width="5" height="${r1(Math.max(0, y - 12 - (G.yS - 42)))}" fill="#cbd5e1" stroke="${COULEURS.betonTrait}" stroke-width="0.8"/>`;
    t += `<rect x="${G.xF - 5}" y="${G.yS}" width="10" height="${r1(Math.max(0, y - 24 - G.yS))}" fill="#94a3b8" opacity=".55"/>`;
    t += `<rect x="${G.xF - 9}" y="${r1(y - 12)}" width="18" height="24" fill="#e2e8f0" stroke="#334155" stroke-width="1"/>` + ligne(G.xF, y - 12, G.xF, y + 12, "#334155", 1.4);
    svgEl.querySelector(".dyn-train").innerHTML = t;
    const ang = e.phase === "remaniement" ? (1 - e.minuteur / DUREES.remaniement) * 3600 : e.theta + (e.phase === "residuel" ? 0 : 0);
    let d = "";
    for (let k = 0; k < 4; k++) { const a = ((ang + 90 * k) * Math.PI) / 180; d += ligne(196, 70, 196 + 32 * Math.cos(a), 70 + 32 * Math.sin(a), "#334155", 3.2); }
    svgEl.querySelector(".dyn-dessus").innerHTML = d + `<circle cx="196" cy="70" r="4" fill="#334155"/>`;
    const M = e.mesures.at(-1)?.M;
    const libelles = { fonçage: "fonçage du moulinet", attente: "attente avant rotation", rotation: "rotation à 6° par minute", remaniement: "remaniement : dix tours rapides", residuel: "mesure sur sol remanié" };
    c.lectures.innerHTML = lectures([
      ["Essai", x ? `${Math.min(e.i + 1, e.cotes.length)} / ${e.cotes.length}` : "—", ""], ["Profondeur", x ? fd(x.z, 1) : "—", "m"],
      ["Rotation", e.phase === "rotation" || e.phase === "residuel" ? fd(e.theta, 1) : "—", "°"], ["Couple", Number.isFinite(M) ? fd(M, 1) : "—", "N·m"],
      ["Temps", duree(e.t), ""],
    ]) + `<p class="banc-etat">${libelles[e.phase] ?? ""}</p>`;
    loupe(...vueLoupe());
  }

  // ── Loupe : le moulinet vu de côté, et le cylindre d'argile qu'il cisaille ──
  const KL = 850, XC = 88, RV = (D / 2000) * KL, HV = (H / 1000) * KL, YH = 28; // rayon, hauteur, haut des pales
  function vueLoupe() {
    const x = e.i < e.cotes.length ? essaiCourant() : null;
    if (!e.cotes.length) {
      // Pas d'argile molle : le moulinet reste dans son sabot, au-dessus d'un terrain qu'il ne saurait cisailler.
      const Yv = (z) => 60 + (z - 1) * KL;
      return [vueTerrain({ couches: e.site.couches, Y: Yv, k: KL, zHaut: 1 - 60 / KL, zBas: 1 + (HL - 60) / KL }) + etiquette(6, 13, e.T.couche(1).nom),
        "pas de couche assez molle pour le moulinet sur ce site"];
    }
    let zV = x?.z ?? e.cotes.at(-1);
    if (e.phase === "fonçage" && x) zV = (e.i ? e.cotes[e.i - 1] : 0) + (x.z - (e.i ? e.cotes[e.i - 1] : 0)) * (1 - e.minuteur / DUREES.fonçage);
    const YM = YH + HV / 2, Yl = (z) => YM + (z - zV) * KL, yB = YH + HV;
    let s = vueTerrain({ couches: e.site.couches, Y: Yl, k: KL, zHaut: zV - YM / KL, zBas: zV + (HL - YM) / KL }) + tige(XC, 0, YH, 14);
    if (e.phase === "fonçage") {
      // Pendant le fonçage, les pales restent rentrées dans le sabot qui les protège.
      s += `<rect x="${r1(XC - RV - 5)}" y="${YH - 6}" width="${r1(2 * RV + 10)}" height="${r1(HV + 12)}" rx="6" fill="${ACIER_SOMBRE}" stroke="#1e293b"/>`;
      s += `<path d="M${r1(XC - RV - 5)} ${r1(yB + 6)}L${XC} ${r1(yB + 30)}L${r1(XC + RV + 5)} ${r1(yB + 6)}Z" fill="#475569" stroke="#1e293b"/>`;
      return [s + etiquette(WL - 8, HL - 9, e.T.couche(zV).nom, { ancre: "end" }), "fonçage : le moulinet est rentré dans son sabot"];
    }
    const ang = e.phase === "remaniement" ? horloge() * 540 : e.theta, M = e.mesures.at(-1)?.M ?? 0, mob = x ? Math.min(1.2, M / x.Mp) : 0;
    const apresPic = (e.phase === "rotation" && e.theta > ROT_PIC) || e.phase === "remaniement" || e.phase === "residuel" || e.phase === "fini";
    // Coquille d'argile remaniée autour du cylindre cisaillé.
    if (apresPic) {
      const op = e.phase === "rotation" ? Math.min(0.35, (e.theta - ROT_PIC) / 150) : 0.4;
      s += `<path d="M${r1(XC - RV - 5)} ${YH - 4}V${r1(yB + 4)}H${r1(XC - RV + 2)}V${YH - 4}ZM${r1(XC + RV - 2)} ${YH - 4}V${r1(yB + 4)}H${r1(XC + RV + 5)}V${YH - 4}Z" fill="#7c2d12" opacity="${r1(op)}"/>`;
    }
    // Pales : celles de derrière d'abord, plus pâles ; la projection de chacune suit la rotation.
    const pales = [0, 1, 2, 3].map((j) => { const a = ((ang + 45 + 90 * j) * Math.PI) / 180; return { px: RV * Math.cos(a), devant: Math.sin(a) }; }).sort((p, q) => p.devant - q.devant);
    for (const p of pales) {
      const xa = XC + p.px, devant = p.devant >= 0;
      s += `<path d="M${XC} ${YH}H${r1(xa)}V${r1(yB - 9)}L${XC} ${r1(yB)}Z" fill="${devant ? "#e2e8f0" : "#94a3b8"}" stroke="${devant ? "#334155" : "#64748b"}" stroke-width="${devant ? 1.2 : 0.8}" opacity="${devant ? 1 : 0.85}"/>`;
      if (Math.abs(p.px) < 2) s += `<path d="M${r1(xa)} ${YH}V${r1(yB - 4)}" stroke="#334155" stroke-width="2"/>`;
    }
    // Surface cisaillée : le cylindre circonscrit aux pales, couleur selon la mobilisation de cu.
    const coul = apresPic ? "#9a3412" : mob > 0.85 ? ROUGE : "#d97706";
    s += `<rect x="${r1(XC - RV)}" y="${YH}" width="${r1(2 * RV)}" height="${r1(HV)}" fill="none" stroke="${coul}" stroke-width="1.6" stroke-dasharray="5 3"/>`;
    s += `<ellipse cx="${XC}" cy="${YH}" rx="${r1(RV)}" ry="6" fill="none" stroke="${coul}" stroke-width="1.2" stroke-dasharray="4 3"/><ellipse cx="${XC}" cy="${r1(yB)}" rx="${r1(RV)}" ry="6" fill="none" stroke="${coul}" stroke-width="1.2" stroke-dasharray="4 3"/>`;
    if (e.phase === "rotation" || e.phase === "residuel" || e.phase === "remaniement") {
      // Sens de rotation et couple appliqué par la tête.
      s += `<path d="M${r1(XC - RV - 6)} ${YH - 12}Q${XC} ${YH - 2} ${r1(XC + RV + 2)} ${YH - 12}" fill="none" stroke="${ROUGE}" stroke-width="1.8"/>` + fleche(XC + RV - 4, YH - 9, XC + RV + 6, YH - 14, ROUGE, 1.8, 6);
      if (e.phase !== "remaniement") s += etiquette(XC + RV + 8, YH + 14, `${fd(M, 1)} N·m`, { couleur: ROUGE });
    }
    s += etiquette(WL - 8, HL - 9, e.T.couche(zV).nom, { ancre: "end" });
    const legende = e.phase === "attente" ? "moulinet sorti : l'argile se rééquilibre avant la rotation"
      : e.phase === "rotation" ? (e.theta <= ROT_PIC ? `rotation à 6°/min : le couple monte, θ = ${fd(e.theta, 1)}°` : "pic dépassé : l'argile se radoucit le long du cylindre")
        : e.phase === "remaniement" ? "dix tours rapides : l'argile du cylindre est remaniée"
          : e.phase === "residuel" ? "couple résiduel : l'argile remaniée résiste moins" : "essais terminés";
    return [s, legende];
  }

  function dessinerLent() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    let s = points(e.resultats.map((x) => [e.XC(Math.min(x.r.cu, 100)), Y(x.z)]));
    let g = `<polyline points="${s}" fill="none" stroke="${COULEURS.ec7}" stroke-width="1.6"/>`;
    s = points(e.resultats.map((x) => [e.XC(Math.min(x.r.cr, 100)), Y(x.z)]));
    g += `<polyline points="${s}" fill="none" stroke="${COULEURS.f62}" stroke-width="1.4" stroke-dasharray="5 3"/>`;
    for (const x of e.resultats) g += `<circle cx="${r1(e.XC(Math.min(x.r.cu, 100)))}" cy="${r1(Y(x.z))}" r="3.2" fill="${COULEURS.ec7}"/><circle cx="${r1(e.XC(Math.min(x.r.cr, 100)))}" cy="${r1(Y(x.z))}" r="3" fill="${COULEURS.f62}"/>`;
    svgEl.querySelector(".dyn-cu").innerHTML = g;
    if (e.phase === "rotation" || e.phase === "residuel") dessinerCourbe(false);
  }

  function dessinerCourbe(fin) {
    const zone = c.courbes.querySelector(".dyn-courbe");
    const res = fin ? e.resultats.at(-1) : null;
    const ms = res ? res.courbe : e.mesures;
    if (!zone || !ms.length || (!res && e.i >= e.cotes.length)) return;
    const x = essaiCourant();
    const MMax = (res ? res.Mmax : x.Mp) * 1.15;
    const pic = ms.filter((m) => !m.remanie), rem = ms.filter((m) => m.remanie);
    zone.innerHTML = graphe({
      largeur: 560, hauteur: 260, xmin: 0, xmax: ROT_FIN, ymin: 0, ymax: MMax, xlabel: "rotation (°)", ylabel: "couple (N·m)",
      titre: `Essai à ${fd(res ? res.z : x.z, 1)} m`,
      series: [
        { points: pic.map((m) => [m.theta, m.M]), couleur: COULEURS.ec7, epaisseur: 2.2, libelle: "sol en place" },
        ...(rem.length ? [{ points: rem.map((m) => [m.theta, m.M]), couleur: COULEURS.f62, epaisseur: 2, libelle: "après dix tours : sol remanié" }] : []),
      ],
      marques: res ? [{ x: pic.find((m) => m.M === res.Mmax)?.theta ?? ROT_PIC, y: res.Mmax, couleur: COULEURS.effort, libelle: `Mmax = ${fd(res.Mmax, 1)} N·m` }] : [],
    }) + (res ? `<p class="final-result">K = πD²H/2 + πD³/6 = ${f(K * 1e6, 4)} cm³ ⇒ c<sub>u</sub> = M<sub>max</sub>/K = <strong>${fd(res.r.cu, 1)} kPa</strong>,
        c<sub>u,r</sub> = ${fd(res.r.cr, 1)} kPa, sensibilité S<sub>t</sub> = ${fd(res.r.St, 1)}
        <small>correction de Bjerrum pour I<sub>p</sub> = ${res.Ip} : μ = ${fd(res.r.mu, 2)}, c<sub>u</sub> corrigée = ${fd(res.r.cuCorrige, 1)} kPa.</small></p>` : "");
  }

  function bilan() {
    if (!e.resultats.length) return;
    const lignes = e.resultats.map((x) => `<tr><td class="n">${fd(x.z, 1)}</td><td>${esc(x.couche)}</td><td class="n">${fd(x.Mmax, 1)}</td><td class="n">${fd(x.r.cu, 1)}</td><td class="n">${fd(x.r.cr, 1)}</td><td class="n">${fd(x.r.St, 1)}</td><td class="n">${fd(x.r.cuCorrige, 1)}</td></tr>`).join("");
    c.bilan.innerHTML = `<p class="final-result">${e.resultats.length} essais en ${duree(e.t)}.
        <small>Le profil de c<sub>u</sub> croît avec la profondeur dans l'argile molle ; c'est lui qui règle la hauteur d'un remblai ou la stabilité d'une fouille. Le calculateur qui suit refait le dépouillement d'un essai.</small></p>
      <div class="table-large"><table class="resultats"><thead><tr><th class="num">z (m)</th><th>Couche</th><th class="num">M<sub>max</sub> (N·m)</th><th class="num">c<sub>u</sub> (kPa)</th><th class="num">c<sub>u,r</sub> (kPa)</th><th class="num">S<sub>t</sub></th><th class="num">μ c<sub>u</sub> (kPa)</th></tr></thead><tbody>${lignes}</tbody></table></div>`;
  }

  b = boucle({ avancer, dessiner, dessinerLent, surFin: bilan, surEtat: () => etatBoutons?.() });
  etatBoutons = brancherMarche(c, b, reinit);
  c.commandes.querySelectorAll("select").forEach((s) => s.addEventListener("change", () => { b.raz(); reinit(); etatBoutons(); }));
  reinit();
  etatBoutons();
}
