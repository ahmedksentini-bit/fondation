// Banc d'essai : l'œdomètre (chapitre 1). On choisit l'argile et la qualité de
// l'échantillon, on pose les masses sur le plateau du levier palier après
// palier ; le comparateur tourne à mesure que l'éprouvette tasse, les lectures
// aux temps normalisés se placent sur la courbe du palier (lg t et √t), que
// l'on dépouille par Casagrande et par Taylor ; la courbe e – lg σ' se
// construit point par point, jusqu'à la contrainte de préconsolidation.
import { svg, ligne, texte, COULEURS, graphe } from "../figures.js";
import { MATERIAUX_OEDO, simulerOedometre, casagrande, taylor, cvDeT50, cvDeT90, compressibilite, TEMPS_LECTURE } from "../geotech/oedometre.js";
import { charpente, boucle, lectures, f, fd, r1, esc, duree } from "./moteur.js";

const PROGRAMME = "10, 20, 40, 80, 160, 320, 640, 1280, 320, 80, 20";
const SECTION = Math.PI * 0.035 ** 2; // m², éprouvette Ø 70 mm
const BRAS = 10; // rapport du levier
const QUALITES = { 0: "intact (carottier à piston)", 0.5: "un peu remanié", 1: "remanié" };

export function monter(banc) {
  const c = charpente(banc, {
    boutons: false,
    commandes: `
      <div class="field"><label>Matériau</label><div class="input-wrap"><select data-r="mat">${Object.entries(MATERIAUX_OEDO).map(([k, m]) => `<option value="${k}">${esc(m.nom)}</option>`).join("")}</select></div></div>
      <div class="field"><label>Échantillon</label><div class="input-wrap"><select data-r="rem">${Object.entries(QUALITES).map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join("")}</select></div></div>
      <div class="field"><label>Durée d'un palier</label><div class="input-wrap"><select data-r="duree"><option value="1440" selected>24 h</option><option value="480">8 h</option><option value="60">1 h</option></select></div></div>
      <div class="field champ-large"><label>Programme de chargement (kPa, dans l'ordre ; une baisse est un déchargement)</label><div class="input-wrap"><input data-r="prog" type="text" value="${PROGRAMME}"></div></div>`,
  });
  c.commandes.insertAdjacentHTML("beforeend", `<div class="banc-marche">
      <button type="button" class="primary" data-action="palier">Appliquer le palier suivant</button>
      <button type="button" class="secondary" data-action="tout">Tout l'essai</button>
      <span class="banc-vitesses" role="group" aria-label="Vitesse de l'essai">${[100, 1000, 10000, 100000].map((v) => `<button type="button" class="ghost${v === 10000 ? " actif" : ""}" data-vitesse="${v}">×${f(v, 6)}</button>`).join("")}</span>
      <button type="button" class="ghost" data-action="raz">Recommencer</button></div>`);
  let e, b, vitesse = 10000;

  const reinit = () => {
    const m = MATERIAUX_OEDO[c.q('[data-r="mat"]').value], rem = Number(c.q('[data-r="rem"]').value), dureeMin = Number(c.q('[data-r="duree"]').value);
    const prog = String(c.q('[data-r="prog"]').value).split(/[;,\s]+/).map((x) => parseFloat(x.replace(",", "."))).filter((x) => x > 0);
    const sim = simulerOedometre(m, prog, { duree: dureeMin, remaniement: rem, graine: prog.length + Math.round(rem * 10) });
    e = { m, rem, dureeMin, prog, sim, i: -1, t: 0, tTotal: 0, enCours: false, tout: false, faits: [] };
    c.scene.innerHTML = fond();
    c.courbes.innerHTML = '<div class="dyn-palier"></div><div class="dyn-compress"></div>';
    c.bilan.innerHTML = "";
    dessiner(); majBoutons();
  };

  const palier = () => e.sim.paliers[e.i];
  /** Tassement cumulé (mm) à l'instant t (min) du palier en cours. */
  const tassement = () => {
    if (e.i < 0) return 0;
    const p = palier(), d0 = e.i ? e.sim.paliers[e.i - 1].d : 0;
    return d0 + (e.sim.H0 * (p.eDebut - p.eDe(Math.max(e.t, 1e-6)))) / (1 + e.sim.eAssise);
  };

  const lancerPalier = () => {
    if (e.enCours || e.i >= e.sim.paliers.length - 1) return;
    e.i++; e.t = 0; e.enCours = true;
    // La boucle s'arrête à la fin de chaque palier : on la réarme pour le suivant.
    b.raz(); b.lancer();
  };
  const avancer = (dt) => {
    if (!e.enCours) return false;
    e.t = Math.min(e.dureeMin, e.t + dt / 60);
    e.tTotal += dt;
    if (e.t >= e.dureeMin - 1e-9) {
      e.enCours = false;
      e.faits.push(depouillerPalier(palier()));
      dessinerCompress();
      if (e.tout && e.i < e.sim.paliers.length - 1) { e.i++; e.t = 0; e.enCours = true; return true; }
      e.tout = false;
      majBoutons();
      if (e.i >= e.sim.paliers.length - 1) bilan();
      return false;
    }
    return true;
  };

  const depouillerPalier = (p) => {
    const ca = p.charge ? casagrande(p.lectures) : { applicable: false, motif: "déchargement" };
    const ta = p.charge ? taylor(p.lectures) : { applicable: false, motif: "déchargement" };
    return { p, ca, ta, cv50: ca.applicable ? cvDeT50(ca.t50, p.Hd) : NaN, cv90: ta.applicable ? cvDeT90(ta.t90, p.Hd) : NaN };
  };

  // ── Dessin de l'appareil ─────────────────────────────────────────────────
  function fond() {
    return svg({
      largeur: 640, hauteur: 330, titre: "Œdomètre à levier", contenu: () => {
        let s = `<rect x="20" y="300" width="600" height="14" rx="3" fill="#64748b"/>`;
        s += `<rect x="128" y="96" width="12" height="204" fill="#94a3b8" stroke="#475569"/>`;
        s += `<circle cx="134" cy="98" r="6" fill="#334155"/>`;
        s += texte(134, 84, "pivot", 'text-anchor="middle" style="font-size:10px;fill:#475569;font-weight:700"');
        // Bac et cellule.
        s += `<rect x="168" y="214" width="124" height="86" rx="4" fill="#e0f2fe" stroke="${COULEURS.eau}" stroke-width="1.3"/>`;
        s += texte(230, 316 + 12, "", "");
        s += `<g class="dyn-machine"></g>`;
        s += texte(472, 22, "rapport du levier 1/10", 'text-anchor="middle" style="font-size:10px;fill:#475569"');
        return s;
      },
    });
  }

  function dessiner() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    const d = tassement(), sigma = e.i >= 0 ? palier().sigma : 0;
    const k = 3.2; // px par mm d'éprouvette (épaisseur exagérée)
    const yBas = 288, hEp = 20 * k - d * k, yHaut = yBas - hEp;
    let s = "";
    // Pierre poreuse du bas, éprouvette dans sa bague, pierre du haut, chapeau.
    s += `<rect x="196" y="${yBas}" width="68" height="8" fill="#cbd5e1" stroke="#64748b"/>`;
    s += `<rect x="198" y="${r1(yHaut)}" width="64" height="${r1(hEp)}" fill="#a78b6d" stroke="#57534e"/>`;
    s += `<rect x="192" y="${r1(yHaut - 4)}" width="6" height="${r1(hEp + 8)}" fill="#94a3b8"/><rect x="262" y="${r1(yHaut - 4)}" width="6" height="${r1(hEp + 8)}" fill="#94a3b8"/>`;
    s += `<rect x="198" y="${r1(yHaut - 8)}" width="64" height="8" fill="#cbd5e1" stroke="#64748b"/>`;
    s += `<rect x="214" y="${r1(yHaut - 22)}" width="32" height="14" fill="#64748b" stroke="#334155"/>`;
    // Tige de chargement jusqu'au levier ; levier qui s'incline à peine avec le tassement.
    const yLev = 104 + d * 0.6;
    s += ligne(230, yHaut - 22, 230, yLev, "#334155", 3);
    const xBout = 560, yBout = 98 + (yLev - 98) * ((xBout - 134) / (230 - 134));
    s += ligne(134, 98, xBout, yBout, "#334155", 5);
    // Plateau et masses : une galette par palier de chargement appliqué.
    const masse = (sigma * 1000 * SECTION) / (9.81 * BRAS);
    s += ligne(xBout, yBout, xBout, yBout + 60, "#334155", 2) + `<rect x="${xBout - 34}" y="${r1(yBout + 60)}" width="68" height="5" fill="#334155"/>`;
    const n = e.i < 0 ? 0 : Math.max(1, Math.round(Math.log2(Math.max(sigma, 5) / 5)));
    for (let j = 0; j < n; j++) s += `<rect x="${xBout - 28}" y="${r1(yBout + 54 - j * 7)}" width="56" height="6" rx="1.5" fill="#475569" stroke="#0f172a" stroke-width="0.6"/>`;
    s += texte(xBout, yBout + 82, e.i < 0 ? "plateau vide" : `${fd(masse, 1)} kg`, 'text-anchor="middle" class="halo" style="font-size:11px;font-weight:800"');
    // Comparateur : un tour par millimètre.
    const yC = yHaut - 70;
    s += `<rect x="228" y="${r1(yC + 22)}" width="4" height="${r1(Math.max(0, yHaut - 22 - yC - 22))}" fill="#94a3b8"/>`;
    s += `<circle cx="230" cy="${r1(yC)}" r="22" fill="#fff" stroke="#334155" stroke-width="2"/>`;
    for (let j = 0; j < 10; j++) { const a = (j * 36 * Math.PI) / 180; s += ligne(230 + 17 * Math.sin(a), yC - 17 * Math.cos(a), 230 + 21 * Math.sin(a), yC - 21 * Math.cos(a), "#334155", 1); }
    const ang = ((d % 1) * 360 * Math.PI) / 180;
    s += ligne(230, yC, 230 + 18 * Math.sin(ang), yC - 18 * Math.cos(ang), COULEURS.effort, 2) + `<circle cx="230" cy="${r1(yC)}" r="2.4" fill="#334155"/>`;
    s += texte(262, yC + 4, "comparateur", 'style="font-size:10px;font-weight:700;fill:#334155"');
    svgEl.querySelector(".dyn-machine").innerHTML = s;
    c.lectures.innerHTML = lectures([
      ["Palier", e.i >= 0 ? `${e.i + 1} / ${e.sim.paliers.length}` : "—", ""], ["σ'", e.i >= 0 ? f(sigma, 4) : "—", "kPa"],
      ["Temps du palier", e.i >= 0 ? duree(e.t * 60) : "—", ""], ["Comparateur", fd(d, 3), "mm"],
      ["Épaisseur", fd(20 - d, 3), "mm"], ["e", e.i >= 0 ? fd(palier().eDe(Math.max(e.t, 1e-6)), 3) : fd(e.sim.eAssise, 3), ""],
    ]) + (e.enCours ? `<p class="banc-etat">${palier().charge ? "consolidation sous le nouveau palier" : "gonflement au déchargement"}</p>` : "");
  }

  /** Courbe du palier en cours : lectures en lg t, puis Casagrande et Taylor. */
  function dessinerPalier(final) {
    const zone = c.courbes.querySelector(".dyn-palier");
    if (!zone || e.i < 0) return;
    const p = palier(), lus = p.lectures.filter((x) => x.t > 0 && x.t <= e.t + 1e-9);
    const dMin = p.lectures[0].d, dMax = p.lectures.at(-1).d;
    const bas = Math.min(dMin, dMax), haut = Math.max(dMin, dMax), marge = Math.max(0.01, (haut - bas) * 0.12);
    const fait = final ? e.faits.at(-1) : null;
    const series = [{ points: lus.map((x) => [x.t, x.d]), couleur: COULEURS.encre, epaisseur: 2, marqueurs: true, libelle: `σ' = ${f(p.sigma, 4)} kPa : lectures` }];
    const marques = [];
    if (fait?.ca.applicable) {
      const ca = fait.ca;
      series.push({ points: [[0.1, ca.d0], [1440, ca.d0]], couleur: COULEURS.bleu, tirets: "4 3", libelle: "d0" });
      series.push({ points: [[0.1, ca.d100], [1440, ca.d100]], couleur: COULEURS.violet, tirets: "4 3", libelle: "d100" });
      marques.push({ x: ca.t50, y: ca.d50, couleur: COULEURS.effort, guides: true, libelle: `t50 = ${f(ca.t50, 3)} min` });
    }
    const gLog = graphe({
      largeur: 560, hauteur: 250, xmin: 0.1, xmax: Math.max(e.dureeMin, 1), logX: true, ymin: bas - marge, ymax: haut + marge, inverserY: true,
      xlabel: "temps (min, échelle logarithmique)", ylabel: "comparateur (mm)", series, marques,
    });
    let gRac = "";
    if (fait?.ta.applicable) {
      const ta = fait.ta, rMax = Math.sqrt(e.dureeMin);
      gRac = graphe({
        largeur: 560, hauteur: 220, xmin: 0, xmax: Math.min(rMax, Math.sqrt(ta.t90) * 3), ymin: bas - marge, ymax: haut + marge, inverserY: true,
        xlabel: "√t (√min)", ylabel: "comparateur (mm)",
        series: [
          { points: p.lectures.filter((x) => x.t > 0).map((x) => [Math.sqrt(x.t), x.d]), couleur: COULEURS.encre, epaisseur: 2, marqueurs: true, libelle: "lectures" },
          { points: [[0, ta.d0], [Math.sqrt(ta.t90) * 1.6, ta.d0 + ta.pente * Math.sqrt(ta.t90) * 1.6]], couleur: COULEURS.bleu, tirets: "5 3", libelle: "droite du début" },
          { points: [[0, ta.d0], [Math.sqrt(ta.t90) * 2, ta.d0 + (ta.pente / 1.15) * Math.sqrt(ta.t90) * 2]], couleur: COULEURS.violet, tirets: "5 3", libelle: "abscisses × 1,15" },
        ],
        marques: [{ x: Math.sqrt(ta.t90), y: ta.d90, couleur: COULEURS.effort, guides: true, libelle: `√t90 → t90 = ${f(ta.t90, 3)} min` }],
      });
    }
    zone.innerHTML = gLog + gRac + (fait ? `<p class="final-result">Palier ${e.i + 1}, σ' = ${f(p.sigma, 4)} kPa (H<sub>d</sub> = ${fd(p.Hd, 2)} mm) :
      ${fait.ca.applicable ? `Casagrande t<sub>50</sub> = ${f(fait.ca.t50, 3)} min ⇒ c<sub>v</sub> = 0,197 H<sub>d</sub>²/t<sub>50</sub> = <strong>${f(fait.cv50, 3)} m²/an</strong>` : `pas de construction de Casagrande (${esc(fait.ca.motif)})`}
      ${fait.ta.applicable ? ` · Taylor t<sub>90</sub> = ${f(fait.ta.t90, 3)} min ⇒ c<sub>v</sub> = ${f(fait.cv90, 3)} m²/an` : ""}</p>` : "");
  }

  /** Courbe de compressibilité e – lg σ' et sa construction de Casagrande. */
  function dessinerCompress() {
    const zone = c.courbes.querySelector(".dyn-compress");
    if (!zone || !e.faits.length) return;
    const pts = e.faits.map((x) => ({ sigma: x.p.sigma, e: x.p.eFin }));
    const r = compressibilite(pts);
    const smin = Math.min(...pts.map((p) => p.sigma), 10) * 0.7, smax = Math.max(...pts.map((p) => p.sigma)) * 1.4;
    const emin = Math.min(...pts.map((p) => p.e)) - 0.05, emax = Math.max(...pts.map((p) => p.e), e.sim.eAssise) + 0.05;
    const series = [{ points: pts.map((p) => [p.sigma, p.e]), couleur: COULEURS.encre, epaisseur: 2, marqueurs: true, libelle: "fin de chaque palier" }];
    const marques = [];
    if (r.applicable) {
      const L = (sg, ref) => ref.me + ref.pente * (Math.log10(sg) - ref.mx);
      series.push({ points: [[r.sp * 0.6, L(r.sp * 0.6, r.vierge)], [smax, L(smax, r.vierge)]], couleur: COULEURS.f62, tirets: "6 4", libelle: `droite vierge : Cc = ${fd(r.Cc, 3)}` });
      const xT = r.tangente.x, eT = r.tangente.e;
      series.push({ points: [[10 ** (xT - 0.4), eT - r.tangente.pente * 0.4], [10 ** (xT + 0.5), eT + r.tangente.pente * 0.5]], couleur: COULEURS.discret, tirets: "3 3", libelle: "tangente au point de plus forte courbure" });
      series.push({ points: [[10 ** xT, eT], [10 ** (xT + 0.8), eT]], couleur: COULEURS.discret, tirets: "1 3", libelle: "horizontale" });
      series.push({ points: [[10 ** xT, eT], [r.sp, eT + r.bissectrice.pente * (Math.log10(r.sp) - xT)]], couleur: COULEURS.violet, epaisseur: 1.6, libelle: "bissectrice" });
      marques.push({ x: r.sp, y: L(r.sp, r.vierge), couleur: COULEURS.effort, guides: true, libelle: `σ'p ≈ ${f(r.sp, 3)} kPa` });
    }
    zone.innerHTML = graphe({
      largeur: 560, hauteur: 300, xmin: smin, xmax: smax, logX: true, ymin: emin, ymax: emax,
      xlabel: "contrainte effective σ' (kPa, échelle logarithmique)", ylabel: "indice des vides e", series, marques,
    }) + (r.applicable ? `<p class="final-result">σ'<sub>p</sub> ≈ <strong>${f(r.sp, 3)} kPa</strong> (Casagrande ; ${f(r.spBilineaire, 3)} kPa par l'intersection des deux droites) ·
      C<sub>c</sub> = <strong>${fd(r.Cc, 3)}</strong>${Number.isFinite(r.Cs) ? ` · C<sub>s</sub> = ${fd(r.Cs, 3)}` : ""}
      <small>Matériau du banc : σ'<sub>p</sub> = ${f(e.m.sp, 3)} kPa, C<sub>c</sub> = ${fd(e.m.Cc, 2)}, C<sub>s</sub> = ${fd(e.m.Cs, 3)}${e.rem > 0 ? " — l'échantillon remanié arrondit le coude et fausse σ'p" : ""}.</small></p>`
      : '<p class="method-note">La construction de σ\'p demande au moins cinq paliers de chargement.</p>');
  }

  function bilan() {
    const lignes = e.faits.map((x, i) => {
      const p = x.p, eps = (100 * x.p.d) / 20;
      const prec = i ? e.faits[i - 1].p : null;
      const mv = prec && p.charge ? ((p.eDebut - p.eFin) / (1 + p.eDebut)) / ((p.sigma - prec.sigma) / 1000) : NaN; // 1/MPa
      return `<tr><td class="n">${f(p.sigma, 4)}</td><td class="n">${fd(20 - p.d, 3)}</td><td class="n">${fd(p.eFin, 3)}</td><td class="n">${fd(eps, 1)}</td>
        <td class="n">${x.ca.applicable ? f(x.ca.t50, 3) : "—"}</td><td class="n">${f(x.cv50, 3)}</td><td class="n">${x.ta.applicable ? f(x.ta.t90, 3) : "—"}</td><td class="n">${f(x.cv90, 3)}</td>
        <td class="n">${Number.isFinite(mv) ? f(mv, 3) : "—"}</td><td class="n">${Number.isFinite(mv) ? f(1 / mv, 3) : "—"}</td></tr>`;
    }).join("");
    c.bilan.innerHTML = `<p class="final-result">Essai terminé : ${e.faits.length} paliers en ${duree(e.tTotal)}.
        <small>c<sub>v</sub> grandit quand on décharge ou que l'on recharge sous σ'<sub>p</sub> : le sol surconsolidé est moins compressible. m<sub>v</sub> et E<sub>oed</sub> = 1/m<sub>v</sub> dépendent de l'intervalle de contraintes — le chapitre 16 s'en sert pour les tassements.</small></p>
      <div class="table-large"><table class="resultats"><thead><tr><th class="num">σ' (kPa)</th><th class="num">H (mm)</th><th class="num">e</th><th class="num">ε (%)</th><th class="num">t<sub>50</sub> (min)</th><th class="num">c<sub>v</sub> Casagrande (m²/an)</th><th class="num">t<sub>90</sub> (min)</th><th class="num">c<sub>v</sub> Taylor (m²/an)</th><th class="num">m<sub>v</sub> (1/MPa)</th><th class="num">E<sub>oed</sub> (MPa)</th></tr></thead><tbody>${lignes}</tbody></table></div>`;
  }

  const majBoutons = () => {
    const fin = e.i >= e.sim.paliers.length - 1;
    const bP = c.q('[data-action="palier"]'), bT = c.q('[data-action="tout"]');
    bP.disabled = e.enCours || fin; bT.disabled = e.enCours || fin;
    const suivant = e.sim.paliers[e.i + 1];
    bP.textContent = fin ? "Essai terminé" : e.enCours ? "Palier en cours…" : `Appliquer le palier suivant : ${f(suivant.sigma, 4)} kPa${suivant.charge ? "" : " (déchargement)"}`;
  };

  b = boucle({ avancer, dessiner, dessinerLent: () => dessinerPalier(false), surFin: () => { dessinerPalier(true); majBoutons(); } });
  b.vitesse(vitesse);
  c.q('[data-action="palier"]').addEventListener("click", () => { lancerPalier(); majBoutons(); });
  c.q('[data-action="tout"]').addEventListener("click", () => { e.tout = true; lancerPalier(); majBoutons(); });
  c.q('[data-action="raz"]').addEventListener("click", () => { b.raz(); reinit(); });
  c.corps.querySelectorAll("[data-vitesse]").forEach((x) => x.addEventListener("click", () => {
    c.corps.querySelectorAll("[data-vitesse]").forEach((y) => y.classList.toggle("actif", y === x));
    vitesse = Number(x.dataset.vitesse); b.vitesse(vitesse);
  }));
  c.commandes.querySelectorAll("select, input").forEach((s) => s.addEventListener("change", () => { b.raz(); reinit(); }));
  reinit();
}
