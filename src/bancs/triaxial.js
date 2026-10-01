// Banc d'essai : le triaxial (chapitre 1). On choisit le matériau, puis deux
// réglages qui font tout l'essai : consolider ou non l'éprouvette avant de la
// cisailler, la laisser drainer ou non pendant le cisaillement — d'où les
// essais UU, CU (avec mesure de u) et CD. On monte et l'on sature l'éprouvette,
// on la consolide sous σ'3, puis la presse l'écrase à vitesse constante :
// l'éprouvette se déforme, et les courbes q – εa, u ou εv – εa et le chemin des
// contraintes se tracent en direct. Trois éprouvettes donnent les cercles de
// Mohr et la droite intrinsèque. Le sol suit le modèle de Cam-Clay modifié.
import { svg, ligne, texte, COULEURS, graphe } from "../figures.js";
import { MATERIAUX_TRIAX, etatConsolide, etatEnPlace, cisailler, rupture, enveloppe, phiCritique } from "../geotech/camclay.js";
import { degreConsolidation, facteurTemps } from "../geotech/consolidation.js";
import { poserCurseurs } from "../curseurs.js";
import { charpente, boucle, lectures, f, fd, r1, esc, duree } from "./moteur.js";

const H0 = 76, D0 = 38; // mm
const A0 = (Math.PI * (D0 / 1000) ** 2) / 4; // m²
const CONTRE_PRESSION = 300; // kPa
const VITESSES = { CD: 0.004, CU: 0.05, UU: 0.5 }; // %/min
const SATURATION = 2 * 3600; // s
const TEINTES = [COULEURS.ec7, COULEURS.f62, COULEURS.violet, COULEURS.bleu];
const PROPOSES = [100, 200, 400, 600];

export function monter(banc) {
  const c = charpente(banc, {
    boutons: false,
    commandes: `
      <div class="field"><label>Matériau</label><div class="input-wrap"><select data-r="mat">${Object.entries(MATERIAUX_TRIAX).map(([k, m]) => `<option value="${k}">${esc(m.nom)}</option>`).join("")}</select></div></div>
      <div class="field"><label>Consolidation avant cisaillement</label><div class="input-wrap"><select data-r="conso"><option value="oui">oui : sous σ'3</option><option value="non">non : éprouvette telle que prélevée</option></select></div></div>
      <div class="field"><label>Drainage pendant le cisaillement</label><div class="input-wrap"><select data-r="drain"><option value="non">non : on mesure u</option><option value="oui">oui : on mesure ΔV</option></select></div></div>
      <div class="field"><label>Critère de rupture</label><div class="input-wrap"><select data-r="critere"><option value="deviateur">déviateur maximal</option><option value="rapport">rapport σ'1/σ'3 maximal</option></select></div></div>
      <div class="field"><label data-libelle-s3>Contrainte de consolidation σ'3</label><div class="input-wrap"><input data-r="s3" type="text" inputmode="decimal" value="100" data-curseur="25 800 5"><span class="unit">kPa</span></div></div>
      <p class="method-note banc-type" style="grid-column:1/-1"></p>`,
  });
  c.commandes.insertAdjacentHTML("beforeend", `<div class="banc-marche">
      <button type="button" class="primary" data-action="etape">Monter et saturer l'éprouvette</button>
      <span class="banc-vitesses" role="group" aria-label="Vitesse de l'essai">${[10, 100, 1000, 10000].map((v) => `<button type="button" class="ghost${v === 1000 ? " actif" : ""}" data-vitesse="${v}">×${f(v, 6)}</button>`).join("")}</span>
      <button type="button" class="ghost" data-action="fin">Finir l'étape</button>
      <button type="button" class="ghost" data-action="raz">Nouvelle série</button></div>`);
  poserCurseurs(c.commandes);
  let e, b;

  const reglages = () => {
    const m = MATERIAUX_TRIAX[c.q('[data-r="mat"]').value];
    const sable = m.famille === "sable";
    const selConso = c.q('[data-r="conso"]');
    selConso.querySelector('option[value="non"]').disabled = sable;
    if (sable) selConso.value = "oui";
    const conso = selConso.value === "oui", draine = c.q('[data-r="drain"]').value === "oui";
    const type = conso ? (draine ? "CD" : "CU") : draine ? null : "UU";
    c.q("[data-libelle-s3]").textContent = conso ? "Contrainte de consolidation σ'3" : "Pression de cellule σ3 (totale)";
    const txt = {
      CD: "Essai consolidé drainé (CD) : on cisaille lentement, l'eau s'écoule, u reste nulle ; on mesure la variation de volume. Il donne c' et φ'.",
      CU: "Essai consolidé non drainé avec mesure de la pression interstitielle (CU+u) : volume constant, on mesure u. Il donne c' et φ' en contraintes effectives, et c<sub>cu</sub>, φ<sub>cu</sub> en contraintes totales.",
      UU: "Essai non consolidé non drainé (UU) : l'éprouvette garde la contrainte effective de son prélèvement ; la pression de cellule ne fait que monter u. Toutes les éprouvettes donnent le même déviateur : φ<sub>u</sub> = 0, c<sub>u</sub> = q/2.",
    };
    c.q(".banc-type").innerHTML = type ? txt[type] : "Non consolidé mais drainé : l'éprouvette se consoliderait pendant le cisaillement — ce n'est pas un essai normalisé. Choisissez une autre combinaison.";
    return { m, sable, conso, draine, type, critere: c.q('[data-r="critere"]').value, s3: Math.max(10, parseFloat(String(c.q('[data-r="s3"]').value).replace(",", ".")) || 100) };
  };

  const reinit = () => {
    const r = reglages();
    e = { ...r, phase: "pret", t: 0, tPhase: 0, eprouvettes: [], courante: null, vitesse: 1000 };
    c.scene.innerHTML = fond();
    c.courbes.innerHTML = '<div class="dyn-conso"></div><div class="dyn-cisaillement"></div><div class="dyn-mohr"></div>';
    c.bilan.innerHTML = "";
    dessiner(); majBouton();
  };

  // ── Déroulement d'une éprouvette ────────────────────────────────────────
  const preparer = () => {
    const { m, conso, draine, s3 } = reglages();
    const avant = m.famille === "sable" ? etatConsolide(m, 10) : etatEnPlace(m);
    const apres = conso ? etatConsolide(m, s3) : { ...avant };
    const points = cisailler(m, apres, { draine, eaMax: 0.2, sortie: 0.001 });
    const dV = ((avant.v - apres.v) / avant.v) * Math.PI * (D0 / 20) ** 2 * (H0 / 10); // cm³
    // Consolidation drainée par les deux extrémités : Hd = H/2 ; t100 ≈ temps pour U = 99 %.
    const Hd = H0 / 2 / 1000, cv = m.cv / 31557600; // m²/s
    const t100 = (facteurTemps(0.99) * Hd * Hd) / cv;
    e.courante = {
      // Contraintes totales comptées à partir de la contre-pression : en CU et CD, σ3 = σ'3 de consolidation ;
      // en UU (sans contre-pression), σ3 est la pression de cellule et l'éprouvette garde sa p's.
      n: e.eprouvettes.length + 1, type: e.type, s3eff: conso ? s3 : avant.p, sigma3Total: s3,
      avant, apres, points, dV, t100, cv, Hd, ea: 0, i: 0, B: conso ? 0.97 : 1,
      vitesse: VITESSES[e.type] / 100 / 60, // par seconde
    };
  };

  const etapeSuivante = () => {
    if (!e.type) return;
    if (e.phase === "pret" || e.phase === "fini") { preparer(); e.phase = "saturation"; e.tPhase = 0; demarrer(); }
    else if (e.phase === "sature") { e.phase = e.conso ? "consolidation" : "cisaillement"; e.tPhase = 0; demarrer(); }
    else if (e.phase === "consolide") { e.phase = "cisaillement"; e.tPhase = 0; demarrer(); }
    majBouton();
  };
  const demarrer = () => { b.raz(); b.lancer(); };

  const avancer = (dt) => {
    const k = e.courante;
    if (!k) return false;
    e.t += dt; e.tPhase += dt;
    if (e.phase === "saturation") {
      if (e.tPhase >= SATURATION) { e.phase = "sature"; majBouton(); return false; }
      return true;
    }
    if (e.phase === "consolidation") {
      if (e.tPhase >= k.t100 * 1.2) { e.phase = "consolide"; dessinerConso(true); majBouton(); return false; }
      return true;
    }
    if (e.phase === "cisaillement") {
      k.ea = Math.min(0.2, e.tPhase * k.vitesse);
      k.i = Math.min(k.points.length - 1, Math.floor(k.ea / 0.001));
      if (k.ea >= 0.2 - 1e-12) {
        k.r = rupture(k.points, { sigma3: k.sigma3Total, critere: e.critere });
        e.eprouvettes.push(k);
        e.phase = "fini";
        dessinerCisaillement(); dessinerMohr(); bilan(); majBouton();
        // Prochaine éprouvette : la contrainte proposée suivante.
        const prop = PROPOSES.find((x) => !e.eprouvettes.some((y) => Math.abs((e.conso ? y.s3eff : y.sigma3Total) - x) < 1)) ?? 800;
        c.q('[data-r="s3"]').value = String(prop); c.q('[data-r="s3"]').dispatchEvent(new Event("input"));
        return false;
      }
      return true;
    }
    return false;
  };

  // ── Dessin de l'appareil ─────────────────────────────────────────────────
  function fond() {
    return svg({
      largeur: 640, hauteur: 380, titre: "Presse et cellule triaxiale", contenu: () => {
        let s = `<rect x="40" y="350" width="330" height="14" rx="3" fill="#64748b"/>`;
        s += `<rect x="58" y="40" width="12" height="310" fill="#94a3b8" stroke="#475569"/><rect x="340" y="40" width="12" height="310" fill="#94a3b8" stroke="#475569"/>`;
        s += `<rect x="52" y="30" width="306" height="16" rx="3" fill="#475569"/>`;
        s += texte(205, 24, "traverse de la presse", 'text-anchor="middle" style="font-size:10px;fill:#475569;font-weight:700"');
        // Embase de la cellule, cylindre transparent, chapeau.
        s += `<rect x="110" y="322" width="190" height="20" rx="3" fill="#cbd5e1" stroke="#475569"/>`;
        s += `<g class="dyn-cellule"></g>`;
        s += `<rect x="110" y="104" width="190" height="16" rx="3" fill="#cbd5e1" stroke="#475569"/>`;
        // Contrôleurs : pression de cellule, contre-pression et volume, pression interstitielle.
        s += `<rect x="410" y="60" width="200" height="54" rx="8" fill="#f1f5f9" stroke="#475569"/>` + texte(510, 82, "pression de cellule σ3", 'text-anchor="middle" style="font-size:10.5px;font-weight:700"');
        s += `<rect x="410" y="150" width="200" height="54" rx="8" fill="#f1f5f9" stroke="#475569"/>` + texte(510, 172, "contre-pression et volume", 'text-anchor="middle" style="font-size:10.5px;font-weight:700"');
        s += `<rect x="410" y="240" width="200" height="54" rx="8" fill="#f1f5f9" stroke="#475569"/>` + texte(510, 262, "capteur de pression u", 'text-anchor="middle" style="font-size:10.5px;font-weight:700"');
        s += `<path d="M300 140H380V87H410" fill="none" stroke="${COULEURS.eau}" stroke-width="2"/>`;
        s += `<path d="M205 342V358H390V177H410" fill="none" stroke="${COULEURS.eau}" stroke-width="2"/>`;
        s += `<path d="M215 342V352H396V267H410" fill="none" stroke="${COULEURS.bleu}" stroke-width="1.6" stroke-dasharray="5 3"/>`;
        s += `<g class="dyn-afficheurs"></g><g class="dyn-presse"></g>`;
        return s;
      },
    });
  }

  function dessiner() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    const k = e.courante, pt = k && e.phase !== "saturation" && e.phase !== "consolidation" && e.phase !== "sature" && e.phase !== "consolide" ? k.points[k.i] : null;
    const ea = pt ? k.ea : 0, ev = pt ? pt.ev : 0;
    const consoU = e.phase === "consolidation" ? degreConsolidation((k.cv * e.tPhase) / (k.Hd * k.Hd)) : e.phase === "consolide" || pt ? 1 : 0;
    // Cellule : niveau d'eau (remplissage pendant la saturation), éprouvette, membrane.
    const rempli = e.phase === "pret" ? 0 : e.phase === "saturation" ? Math.min(1, e.tPhase / (SATURATION * 0.3)) : 1;
    const kz = 2.6; // px/mm
    const hEp = H0 * kz * (1 - ea), yBas = 312, yHaut = yBas - hEp;
    const rMoy = (D0 / 2) * kz * Math.sqrt((1 - ev) / Math.max(1 - ea, 0.5));
    const r0 = (D0 / 2) * kz;
    const bombe = (rMoy - r0) * 1.5;
    let s = `<rect x="122" y="120" width="166" height="202" fill="#f8fafc" stroke="#64748b" stroke-width="1.6" rx="2"/>`;
    if (rempli > 0) s += `<rect x="124" y="${r1(322 - 200 * rempli)}" width="162" height="${r1(200 * rempli)}" fill="#bae6fd" opacity=".55"/>`;
    s += `<rect x="${r1(205 - r0 - 4)}" y="${yBas}" width="${r1(2 * r0 + 8)}" height="10" fill="#94a3b8" stroke="#475569"/>`;
    let qPic = 0;
    if (pt) for (let j = 0; j <= k.i; j++) qPic = Math.max(qPic, k.points[j].q);
    const dilatant = pt && pt.q < qPic * 0.97;
    const ech = `M${r1(205 - r0)} ${r1(yBas)}Q${r1(205 - r0 - 2 * bombe)} ${r1((yBas + yHaut) / 2)} ${r1(205 - r0)} ${r1(yHaut)}H${r1(205 + r0)}Q${r1(205 + r0 + 2 * bombe)} ${r1((yBas + yHaut) / 2)} ${r1(205 + r0)} ${r1(yBas)}Z`;
    s += `<path d="${ech}" fill="#a78b6d" stroke="#1f2937" stroke-width="1.3"/>`;
    if (dilatant) {
      const phi = (phiCritique(e.m.M) * Math.PI) / 180, a = Math.PI / 4 + phi / 2, dx = hEp / Math.tan(a);
      s += ligne(205 - Math.min(dx / 2, r0), yBas - 6, 205 + Math.min(dx / 2, r0), yHaut + 6, "#7f1d1d", 2);
    }
    s += `<rect x="${r1(205 - r0 - 4)}" y="${r1(yHaut - 12)}" width="${r1(2 * r0 + 8)}" height="12" fill="#94a3b8" stroke="#475569"/>`;
    // Piston et capteur de force sous la traverse.
    s += `<rect x="201" y="46" width="8" height="${r1(yHaut - 12 - 46)}" fill="#cbd5e1" stroke="#475569"/>`;
    s += `<rect x="186" y="46" width="38" height="18" rx="3" fill="#fbbf24" stroke="#92400e"/>` + texte(232, 59, "capteur de force", 'style="font-size:9.5px;font-weight:700;fill:#78350f"');
    if (e.phase === "consolidation") s += `<path d="M205 330v14" stroke="${COULEURS.eau}" stroke-width="2.4" marker-end=""/><text x="214" y="344" style="font-size:9.5px;fill:${COULEURS.eau};font-weight:700">l'eau sort</text>`;
    svgEl.querySelector(".dyn-cellule").innerHTML = s;
    // Afficheurs des contrôleurs.
    const rampe = e.phase === "saturation" ? Math.min(1, e.tPhase / SATURATION) : 1;
    const sig3 = !k || e.phase === "pret" ? 0 : e.conso ? (CONTRE_PRESSION + (e.phase === "saturation" ? 10 : k.sigma3Total)) * rampe : k.sigma3Total * rampe;
    const u = !k || e.phase === "pret" ? 0 : e.conso ? CONTRE_PRESSION * rampe + (pt ? pt.u : 0) : (k.sigma3Total - k.avant.p) * rampe + (pt ? pt.u : 0);
    const dVc = k ? -k.dV * consoU - (pt ? (pt.ev * Math.PI * (D0 / 20) ** 2 * (H0 / 10)) : 0) : 0;
    const val = (x, y, t2) => texte(x, y, t2, 'text-anchor="middle" style="font-size:15px;font-weight:800;font-family:ui-monospace,Consolas,monospace;fill:#0369a1"');
    svgEl.querySelector(".dyn-afficheurs").innerHTML = val(510, 104, `${f(sig3, 4)} kPa`) + val(510, 194, `${fd(dVc, 2)} cm³`) + val(510, 284, `${f(u, 4)} kPa`);
    const F = pt ? (pt.q * A0 * (1 - ea)) / (1 - ev) * 1000 : 0; // N
    const libelles = { pret: "éprouvette prête à monter", saturation: "saturation sous contre-pression", sature: `saturée : B = ${k ? fd(k.B, 2) : "—"}`, consolidation: "consolidation : l'eau sort", consolide: "consolidée", cisaillement: "cisaillement à vitesse constante", fini: "éprouvette rompue" };
    c.lectures.innerHTML = lectures([
      ["Éprouvette", k ? `n° ${k.n} · ${k.type}` : "—", ""], ["εa", fd(100 * ea, 2), "%"], ["Force", f(F, 4), "N"],
      ["q", pt ? f(pt.q, 4) : "—", "kPa"], [e.draine ? "εv" : "Δu", pt ? (e.draine ? fd(100 * pt.ev, 2) : f(pt.u, 4)) : "—", e.draine ? "%" : "kPa"], ["Temps", duree(e.t), ""],
    ]) + `<p class="banc-etat">${libelles[e.phase] ?? ""}</p>`;
  }

  function dessinerLent() {
    if (e.phase === "consolidation") dessinerConso(false);
    if (e.phase === "cisaillement") dessinerCisaillement();
  }

  function dessinerConso(fin) {
    const k = e.courante, zone = c.courbes.querySelector(".dyn-conso");
    if (!k || !zone) return;
    const tMax = k.t100 * 1.2, tEnCours = fin ? tMax : Math.min(e.tPhase, tMax);
    const pts = [];
    for (let i = 0; i <= 60; i++) { const t = (tEnCours * i) / 60; pts.push([Math.sqrt(t / 60), k.dV * degreConsolidation((k.cv * t) / (k.Hd * k.Hd))]); }
    zone.innerHTML = graphe({
      largeur: 560, hauteur: 220, xmin: 0, xmax: Math.sqrt(tMax / 60), ymin: 0, ymax: Math.max(k.dV, 0.1) * 1.1, inverserY: true,
      xlabel: "√t (√min)", ylabel: "volume expulsé (cm³)", titre: `Consolidation de l'éprouvette n° ${k.n} sous σ'3 = ${f(k.s3eff, 4)} kPa`,
      series: [{ points: pts, couleur: COULEURS.bleu, epaisseur: 2.2, libelle: "variation de volume" }],
      marques: fin ? [{ x: Math.sqrt(k.t100 / 60), y: k.dV * 0.99, couleur: COULEURS.effort, guides: true, libelle: `t100 ≈ ${duree(k.t100)}` }] : [],
    }) + (fin ? `<p class="final-result">Consolidation terminée : ${fd(k.dV, 2)} cm³ expulsés en ${duree(k.t100)} environ.
        <small>La vitesse de cisaillement se règle sur ce temps : lente en drainé (${fd(VITESSES.CD, 3)} %/min ici), pour que u reste nulle ; plus rapide en non drainé (${fd(VITESSES.CU, 2)} %/min), mais assez lente pour que u s'égalise dans l'éprouvette.</small></p>` : "");
  }

  function dessinerCisaillement() {
    const zone = c.courbes.querySelector(".dyn-cisaillement");
    if (!zone) return;
    const toutes = [...e.eprouvettes, ...(e.phase === "cisaillement" && e.courante ? [e.courante] : [])];
    if (!toutes.length) return;
    const pts = (k) => k.points.slice(0, (e.eprouvettes.includes(k) ? k.points.length - 1 : k.i) + 1);
    const qMax = Math.max(...toutes.flatMap((k) => k.points.map((x) => x.q))) * 1.1;
    const serie = (k, fn, i) => ({ points: pts(k).map(fn), couleur: TEINTES[i % 4], epaisseur: 2, libelle: `n° ${k.n} · σ'3 = ${f(k.s3eff, 4)} kPa` });
    const g1 = graphe({ largeur: 560, hauteur: 250, xmin: 0, xmax: 20, ymin: 0, ymax: qMax, xlabel: "déformation axiale εa (%)", ylabel: "déviateur q (kPa)", series: toutes.map((k, i) => serie(k, (x) => [100 * x.ea, x.q], i)) });
    const g2 = e.draine
      ? graphe({ largeur: 560, hauteur: 220, xmin: 0, xmax: 20, ymin: Math.min(-1, ...toutes.flatMap((k) => k.points.map((x) => -100 * x.ev))) * 1.1, ymax: Math.max(1, ...toutes.flatMap((k) => k.points.map((x) => -100 * x.ev))) * 1.1,
        xlabel: "déformation axiale εa (%)", ylabel: "εv (%), > 0 : dilatance", series: toutes.map((k, i) => serie(k, (x) => [100 * x.ea, -100 * x.ev], i)) })
      : graphe({ largeur: 560, hauteur: 220, xmin: 0, xmax: 20, ymin: Math.min(0, ...toutes.flatMap((k) => k.points.map((x) => x.u))) * 1.1 - 5, ymax: Math.max(5, ...toutes.flatMap((k) => k.points.map((x) => x.u))) * 1.1,
        xlabel: "déformation axiale εa (%)", ylabel: "surpression Δu (kPa)", series: toutes.map((k, i) => serie(k, (x) => [100 * x.ea, x.u], i)) });
    const pMax = Math.max(...toutes.flatMap((k) => k.points.map((x) => Math.max(x.p, x.p + (e.draine ? 0 : x.u))))) * 1.15;
    const M = e.m.M;
    const g3 = graphe({
      largeur: 560, hauteur: 260, xmin: 0, xmax: pMax, ymin: 0, ymax: qMax, xlabel: "p' (kPa)", ylabel: "q (kPa)",
      series: [
        { points: [[0, 0], [pMax, M * pMax]], couleur: COULEURS.rouge, tirets: "6 4", libelle: `état critique q = M p' (φ'cs = ${fd(phiCritique(M), 1)}°)` },
        ...toutes.map((k, i) => serie(k, (x) => [x.p, x.q], i)),
        ...(e.draine ? [] : toutes.map((k, i) => ({ points: pts(k).map((x) => [x.p + x.u, x.q]), couleur: TEINTES[i % 4], tirets: "2 3", epaisseur: 1.2 }))),
      ],
    });
    zone.innerHTML = g1 + g2 + g3 + (e.draine ? "" : '<p class="method-note">En pointillé, le chemin des contraintes totales (pente 3) ; l\'écart horizontal avec le chemin effectif est la surpression Δu.</p>');
  }

  function dessinerMohr() {
    const zone = c.courbes.querySelector(".dyn-mohr");
    const ep = e.eprouvettes;
    if (!zone || !ep.length) return;
    const eff = ep.map((k) => [k.r.s3eff, k.r.s1eff]), tot = ep.map((k) => [k.r.s3, k.r.s1]);
    const avecTot = e.type !== "CD";
    const sMax = Math.max(...eff.map((x) => x[1]), ...(avecTot ? tot.map((x) => x[1]) : [])) * 1.08;
    const W = 560 - 76, H = 300 - 58, tMax = (sMax * H) / W;
    const cercle = ([a, b2]) => Array.from({ length: 61 }, (_, i) => { const t = (Math.PI * i) / 60, cx = (a + b2) / 2, R = (b2 - a) / 2; return [cx - R * Math.cos(t), R * Math.sin(t)]; });
    const envE = e.type === "UU" ? null : enveloppe(eff), envT = avecTot ? enveloppe(tot) : null;
    const droite = (env) => [[0, env.c], [sMax, env.c + sMax * Math.tan((env.phi * Math.PI) / 180)]];
    const series = [
      ...eff.map((x, i) => ({ points: cercle(x), couleur: TEINTES[i % 4], epaisseur: 2, libelle: i === 0 ? "cercles effectifs" : "" })),
      ...(avecTot ? tot.map((x, i) => ({ points: cercle(x), couleur: TEINTES[i % 4], tirets: "4 3", epaisseur: 1.2, libelle: i === 0 ? "cercles totaux" : "" })) : []),
      ...(envE && ep.length >= 2 ? [{ points: droite(envE), couleur: COULEURS.encre, epaisseur: 1.8, libelle: `c' = ${fd(envE.c, 1)} kPa, φ' = ${fd(envE.phi, 1)}°` }] : []),
      ...(envT && ep.length >= 2 ? [{ points: droite(envT), couleur: COULEURS.discret, tirets: "6 4", epaisseur: 1.4, libelle: e.type === "UU" ? `cu = ${fd(envT.c, 1)} kPa, φu = ${fd(envT.phi, 1)}°` : `ccu = ${fd(envT.c, 1)} kPa, φcu = ${fd(envT.phi, 1)}°` }] : []),
    ];
    zone.innerHTML = graphe({ largeur: 560, hauteur: 300, xmin: 0, xmax: sMax, ymin: 0, ymax: tMax, xlabel: "contrainte normale σ (kPa)", ylabel: "τ (kPa)", series });
  }

  function bilan() {
    const ep = e.eprouvettes;
    const lignes = ep.map((k) => `<tr><td>${k.n} · ${k.type}</td><td class="n">${f(k.sigma3Total + CONTRE_PRESSION, 4)} · ${CONTRE_PRESSION}</td><td class="n">${f(k.s3eff, 4)}</td><td class="n">${fd(k.B, 2)}</td>
      <td class="n">${fd(100 * k.r.ea, 1)}</td><td class="n">${f(k.r.q, 4)}</td><td class="n">${e.draine ? "—" : f(k.r.u, 4)}</td><td class="n">${f(k.r.s3eff, 4)}</td><td class="n">${f(k.r.s1eff, 4)}</td></tr>`).join("");
    const eff = ep.map((k) => [k.r.s3eff, k.r.s1eff]), tot = ep.map((k) => [k.r.s3, k.r.s1]);
    const envE = ep.length >= 2 && e.type !== "UU" ? enveloppe(eff) : null, envT = ep.length >= 2 && e.type !== "CD" ? enveloppe(tot) : null;
    const res = e.type === "UU"
      ? (ep.length >= 2 ? `c<sub>u</sub> = <strong>${fd(ep.reduce((s2, k) => s2 + k.r.q / 2, 0) / ep.length, 1)} kPa</strong>, φ<sub>u</sub> ≈ ${fd(envT.phi, 1)}° : la pression de cellule ne change rien au déviateur de rupture` : "")
      : `${envE ? `c' = <strong>${fd(envE.c, 1)} kPa</strong>, φ' = <strong>${fd(envE.phi, 1)}°</strong>` : ""}${envT ? ` · en contraintes totales : c<sub>cu</sub> = ${fd(envT.c, 1)} kPa, φ<sub>cu</sub> = ${fd(envT.phi, 1)}°` : ""}`;
    c.bilan.innerHTML = `<p class="final-result">${ep.length} éprouvette${ep.length > 1 ? "s" : ""} rompue${ep.length > 1 ? "s" : ""}${ep.length >= 2 ? ` — ${res}` : " : lancez-en une deuxième, sous une autre contrainte, pour tracer la droite intrinsèque"}.
        <small>Modèle du matériau : Cam-Clay modifié, φ'<sub>cs</sub> = ${fd(phiCritique(e.m.M), 1)}°. Une argile surconsolidée cisaillée sous faible σ'3 donne un pic au-dessus de l'état critique : c'est l'origine de la cohésion apparente c'.</small></p>
      <div class="table-large"><table class="resultats"><thead><tr><th>Éprouvette</th><th class="num">σ3 · contre-pression (kPa)</th><th class="num">σ'3 initiale (kPa)</th><th class="num">B</th><th class="num">εa rupture (%)</th><th class="num">q<sub>f</sub> (kPa)</th><th class="num">Δu<sub>f</sub> (kPa)</th><th class="num">σ'3f (kPa)</th><th class="num">σ'1f (kPa)</th></tr></thead><tbody>${lignes}</tbody></table></div>`;
  }

  const majBouton = () => {
    const bt = c.q('[data-action="etape"]');
    const libelle = { pret: "Monter et saturer l'éprouvette", saturation: "Saturation en cours…", sature: e.conso ? `Consolider sous σ'3 = ${f(e.courante?.s3eff ?? e.s3, 4)} kPa` : "Cisailler", consolidation: "Consolidation en cours…", consolide: "Cisailler", cisaillement: "Cisaillement en cours…", fini: "Éprouvette suivante : monter et saturer" };
    bt.textContent = libelle[e.phase];
    bt.disabled = !e.type || ["saturation", "consolidation", "cisaillement"].includes(e.phase);
  };

  b = boucle({ avancer, dessiner, dessinerLent });
  b.vitesse(1000);
  c.q('[data-action="etape"]').addEventListener("click", etapeSuivante);
  c.q('[data-action="fin"]').addEventListener("click", () => { if (["saturation", "consolidation", "cisaillement"].includes(e.phase)) b.finir(30); });
  c.q('[data-action="raz"]').addEventListener("click", () => { b.raz(); reinit(); });
  c.corps.querySelectorAll("[data-vitesse]").forEach((x) => x.addEventListener("click", () => {
    c.corps.querySelectorAll("[data-vitesse]").forEach((y) => y.classList.toggle("actif", y === x));
    b.vitesse(Number(x.dataset.vitesse));
  }));
  // Changer de matériau ou de type d'essai repart d'une série neuve ; changer σ3 vaut pour l'éprouvette suivante.
  c.commandes.querySelectorAll('[data-r="mat"], [data-r="conso"], [data-r="drain"]').forEach((s) => s.addEventListener("change", () => { b.raz(); reinit(); }));
  c.q('[data-r="critere"]').addEventListener("change", () => {
    e.critere = c.q('[data-r="critere"]').value;
    for (const k of e.eprouvettes) k.r = rupture(k.points, { sigma3: k.sigma3Total, critere: e.critere });
    dessinerMohr(); if (e.eprouvettes.length) bilan();
  });
  c.q('[data-r="s3"]').addEventListener("input", () => { if (e.phase === "pret" || e.phase === "fini") majBouton(); });
  reinit();
}
