// Banc d'essai : l'essai de pompage (chapitre 2). On pompe à débit constant
// dans un puits qui traverse une nappe captive ; deux piézomètres, à 10 et
// 30 m, suivent le rabattement. Le cône de dépression s'élargit (Theis) ; en
// temps logarithmique, chaque courbe devient une droite (Jacob) dont la pente
// par cycle donne la transmissivité T, et l'abscisse à rabattement nul le
// coefficient d'emmagasinement S. On arrête ensuite la pompe : la remontée.
import { svg, ligne, texte, couche, COULEURS, graphe } from "../figures.js";
import { Wtheis, jacob } from "../geotech/essais.js";
import { charpente, boucle, brancherMarche, lectures, f, fd, r1, esc, duree, sci } from "./moteur.js";
import { fenetreLoupe, blocSol, fleche, etiquette, horloge, W as WL, H as HL, BLEU, ACIER_SOMBRE } from "./loupe.js";

const AQUIFERES = {
  sable: { nom: "sable et graviers", T: 8e-3, S: 4e-4 },
  sableFin: { nom: "sable fin limoneux", T: 8e-4, S: 2e-4 },
  calcaire: { nom: "calcaire fissuré", T: 3e-2, S: 1e-3 },
};
const R = [10, 30]; // m
const POMPAGE = 8 * 3600, REMONTEE = 4 * 3600; // s

export function monter(banc) {
  const c = charpente(banc, {
    vitesse: 1000, vitesses: [10, 100, 1000, 10000],
    commandes: `
      <div class="field"><label>Aquifère</label><div class="input-wrap"><select data-r="aq">${Object.entries(AQUIFERES).map(([k, a]) => `<option value="${k}">${esc(a.nom)}</option>`).join("")}</select></div></div>
      <div class="field"><label>Débit de pompage</label><div class="input-wrap"><select data-r="Q"><option value="0.01">10 L/s</option><option value="0.005">5 L/s</option><option value="0.02">20 L/s</option></select></div></div>
      <p class="method-note" style="grid-column:1/-1">Nappe captive sous une couche d'argile ; piézomètres à 10 et 30 m du puits ; 8 h de pompage, puis 4 h de remontée.</p>`,
  });
  const loupe = fenetreLoupe(c, "la crépine du puits");
  let e, b, etatBoutons;

  const reinit = () => {
    const aq = AQUIFERES[c.q('[data-r="aq"]').value], Q = Number(c.q('[data-r="Q"]').value);
    e = { aq, Q, t: 0, mesures: R.map(() => []), prochaine: 30, fini: false };
    c.scene.innerHTML = fond();
    c.courbes.innerHTML = '<div class="dyn-courbe"></div>';
    c.bilan.innerHTML = "";
    dessiner(); dessinerLent();
  };

  /** Rabattement de Theis à la distance r au temps t (superposition pour la remontée). */
  const s = (r, t) => {
    const th = (tt) => (tt > 0 ? (e.Q / (4 * Math.PI * e.aq.T)) * Wtheis((r * r * e.aq.S) / (4 * e.aq.T * tt)) : 0);
    return t <= POMPAGE ? th(t) : th(t) - th(t - POMPAGE);
  };

  const avancer = (dt) => {
    if (e.fini) return false;
    e.t = Math.min(POMPAGE + REMONTEE, e.t + dt);
    while (e.prochaine <= e.t + 1e-9) {
      R.forEach((r, i) => e.mesures[i].push({ t: e.prochaine, s: s(r, e.prochaine) * (1 + 0.004 * Math.sin(e.prochaine / 97 + i)) }));
      // Lectures de plus en plus espacées, pendant le pompage puis depuis l'arrêt de la pompe.
      e.prochaine = e.prochaine < POMPAGE ? (e.prochaine * 1.12 > POMPAGE ? POMPAGE + 30 : e.prochaine * 1.12) : POMPAGE + (e.prochaine - POMPAGE) * 1.15;
    }
    if (e.t >= POMPAGE + REMONTEE - 1e-9) e.fini = true;
    return !e.fini;
  };

  // ── Dessin : coupe, cône de rabattement à l'instant t ─────────────────────
  const x0 = 60, kx = 2.2, yTN = 70, yN = 110, yToit = 160, yMur = 300;
  function fond() {
    return svg({
      largeur: 640, hauteur: 340, titre: "Essai de pompage", contenu: (id) => {
        let s = couche(id, { x: 10, y: yTN, w: 620, h: yToit - yTN, sol: "argile" }) + couche(id, { x: 10, y: yToit, w: 620, h: yMur - yToit, sol: "sable" }) + couche(id, { x: 10, y: yMur, w: 620, h: 332 - yMur, sol: "marne" });
        s += ligne(10, yTN, 630, yTN, COULEURS.trait, 1.8);
        s += texte(620, yToit + 18, e.aq.nom + " (nappe captive)", 'text-anchor="end" class="halo" style="font-size:10.5px;font-weight:700"');
        s += texte(620, yTN + 18, "argile (toit imperméable)", 'text-anchor="end" class="halo" style="font-size:10.5px;font-weight:700"');
        s += `<rect x="${x0 - 7}" y="${yTN - 30}" width="14" height="${yMur - yTN + 30}" fill="#fff" stroke="#334155" stroke-width="1.6"/>`;
        s += `<rect x="${x0 - 16}" y="${yTN - 52}" width="32" height="22" rx="4" fill="#fbbf24" stroke="#92400e"/>` + texte(x0, yTN - 58, "pompe", 'text-anchor="middle" style="font-size:10px;font-weight:700"');
        R.forEach((r) => { const x = x0 + r * kx * 4; s += `<rect x="${x - 4}" y="${yTN - 20}" width="8" height="${yMur - 10 - yTN + 20}" fill="#fff" stroke="#334155"/>` + texte(x, yTN - 26, `r = ${r} m`, 'text-anchor="middle" style="font-size:10px;font-weight:700"'); });
        s += `<g class="dyn-cone"></g>`;
        return s;
      },
    });
  }

  function dessiner() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    // Niveau piézométrique : au-dessus du toit (nappe captive), rabattu en cône autour du puits.
    const ech = 18; // px par mètre de rabattement
    const pts = [];
    for (let x = x0 + 8; x <= 630; x += 6) { const r = (x - x0) / (kx * 4); pts.push([x, yN + ech * s(Math.max(r, 0.15), Math.max(e.t, 1))]); }
    let d = `<polyline points="${pts.map(([x, y]) => `${r1(x)},${r1(Math.min(y, yMur - 4))}`).join(" ")}" fill="none" stroke="${COULEURS.eau}" stroke-width="2" stroke-dasharray="6 3"/>`;
    R.forEach((r) => { const x = x0 + r * kx * 4, y = Math.min(yN + ech * s(r, Math.max(e.t, 1)), yMur - 4); d += `<rect x="${x - 3}" y="${r1(y)}" width="6" height="${r1(yMur - 10 - y)}" fill="#7dd3fc"/>`; });
    if (e.t < POMPAGE) d += `<path d="M${x0 + 16} ${yTN - 41}h22" stroke="${COULEURS.eau}" stroke-width="3"/>` + texte(x0 + 42, yTN - 37, `${fd(e.Q * 1000, 0)} L/s`, `style="font-size:10px;font-weight:700;fill:${COULEURS.eau}"`);
    d += texte(630, yN - 6, "niveau piézométrique", `text-anchor="end" style="font-size:10px;fill:${COULEURS.eau};font-weight:700"`);
    svgEl.querySelector(".dyn-cone").innerHTML = d;
    c.lectures.innerHTML = lectures([
      ["Temps", duree(e.t), ""], ["Phase", e.t < POMPAGE ? "pompage" : "remontée", ""],
      ["s à 10 m", fd(s(R[0], Math.max(e.t, 1)), 3), "m"], ["s à 30 m", fd(s(R[1], Math.max(e.t, 1)), 3), "m"],
    ]);
    loupe(...vueLoupe());
  }

  // ── Loupe : la crépine du puits, vers laquelle l'eau de la nappe converge ──
  const YT = 28, YM = 146, XP = 22; // toit et mur de la nappe captive, paroi de la crépine
  function vueLoupe() {
    const t = horloge(), pompe = e.t > 0 && e.t < POMPAGE;
    // Écoulement vers le puits : plein pendant le pompage ; à la remontée, il s'éteint avec le rabattement résiduel.
    const r = e.t === 0 ? 0 : pompe ? 1 : Math.min(1, s(R[0], e.t) / Math.max(1e-6, s(R[0], POMPAGE)));
    const solNappe = e.aq === AQUIFERES.calcaire ? "roche" : e.aq === AQUIFERES.sable ? "grave" : "sable";
    let s2 = blocSol("argile", { x0: 0, x1: WL, y0: 0, y1: YT, k: 400 }) + blocSol(solNappe, { x0: 0, x1: WL, y0: YT, y1: YM, k: 400 }) + blocSol("marne", { x0: 0, x1: WL, y0: YM, y1: HL, k: 400 });
    s2 += `<path d="M0 ${YT}H${WL}M0 ${YM}H${WL}" stroke="#334155" stroke-width="1.2"/>`;
    // Massif de gravier autour de la crépine, crépine fendue, tubage plein au-dessus.
    s2 += `<rect x="${XP}" y="${YT}" width="14" height="${YM - YT}" fill="#e3d3a0"/>` + blocSol("grave", { x0: XP, x1: XP + 14, y0: YT, y1: YM, k: 400, fond: false });
    s2 += `<rect x="0" y="0" width="${XP}" height="${HL}" fill="#bae6fd"/><rect x="${XP - 3}" y="0" width="3" height="${YT}" fill="${ACIER_SOMBRE}"/>`;
    for (let y = YT + 4; y < YM; y += 9) s2 += `<rect x="${XP - 3}" y="${y}" width="3" height="5" fill="${ACIER_SOMBRE}"/>`;
    s2 += `<rect x="${XP - 3}" y="${YM}" width="3" height="${HL - YM}" fill="${ACIER_SOMBRE}"/>`;
    // Pompe immergée dans le puits.
    s2 += `<rect x="4" y="58" width="12" height="40" rx="3" fill="#f59e0b" stroke="#92400e"/><path d="M10 58V0" stroke="#1e293b" stroke-width="2"/>`;
    if (pompe) s2 += fleche(10, 52, 10, 20, BLEU, 2, 5);
    if (r > 0.005) for (const y of [46, 72, 98, 124]) {
      // Les filets d'eau accélèrent en approchant du puits (la vitesse croît comme 1/r).
      for (let j = 0; j < 4; j++) {
        const q = (t * 0.35 * (0.3 + r) + j / 4) % 1, x = XP + 16 + (WL - XP - 16) * (1 - q) ** 2;
        s2 += `<circle cx="${r1(x)}" cy="${y}" r="1.8" fill="${BLEU}" opacity="${r1(r * (0.4 + 0.6 * q))}"/>`;
      }
      s2 += fleche(WL - 8, y, WL - 8 - 16 - 14 * r, y, BLEU, 1.6, 4.5);
    }
    s2 += etiquette(WL - 6, 13, "toit argileux", { ancre: "end" }) + etiquette(WL - 6, YM - 6, "nappe captive", { ancre: "end", couleur: "#0369a1" }) + etiquette(XP + 18, 72, "gravier", { couleur: "#78350f" });
    const legende = e.t === 0 ? "puits crépiné dans la nappe captive ; pompe à l'arrêt"
      : pompe ? `pompage à ${fd(e.Q * 1000, 0)} L/s : l'eau converge vers la crépine` : e.fini ? "essai terminé"
        : "pompe arrêtée : l'eau afflue encore, la nappe remonte";
    return [s2, legende];
  }

  function dessinerLent() {
    const zone = c.courbes.querySelector(".dyn-courbe");
    if (!zone) return;
    const sMax = Math.max(0.05, ...e.mesures.flatMap((m) => m.map((x) => x.s))) * 1.15;
    const pomp = (m) => m.filter((x) => x.t <= POMPAGE);
    zone.innerHTML = graphe({
      largeur: 560, hauteur: 260, xmin: 30, xmax: POMPAGE * 1.1, logX: true, ymin: 0, ymax: sMax, inverserY: true,
      xlabel: "temps de pompage (s, échelle log)", ylabel: "rabattement s (m)",
      series: e.mesures.map((m, i) => ({ points: pomp(m).map((x) => [x.t, x.s]), couleur: [COULEURS.bleu, COULEURS.f62][i], marqueurs: true, epaisseur: 1.8, libelle: `piézomètre à ${R[i]} m` })),
    }) + (e.t > POMPAGE ? graphe({
      // Remontée de Theis : le rabattement résiduel s′ est une droite en log(t/t′), qui passe par l'origine.
      largeur: 560, hauteur: 230, xmin: 1, xmax: 2000, logX: true, ymin: 0, ymax: sMax, xlabel: "t/t′ (t depuis le début du pompage, t′ depuis l'arrêt), échelle log", ylabel: "rabattement résiduel s′ (m)",
      series: e.mesures.map((m, i) => ({ points: m.filter((x) => x.t > POMPAGE).map((x) => [x.t / (x.t - POMPAGE), x.s]), couleur: [COULEURS.bleu, COULEURS.f62][i], marqueurs: true, epaisseur: 1.8, libelle: `remontée à ${R[i]} m` })),
    }) : "");
  }

  function bilan() {
    // Droite de Jacob sur la fin du pompage du piézomètre le plus proche (u petit).
    const m = e.mesures[0].filter((x) => x.t > POMPAGE / 20 && x.t <= POMPAGE);
    const a = m[0], z = m.at(-1);
    const ds = (z.s - a.s) / Math.log10(z.t / a.t);
    const t0 = a.t / 10 ** (a.s / ds);
    const r = jacob({ Q: e.Q, ds, t0, r: R[0] });
    // Remontée : pente de s′ par cycle de t/t′, sur les lectures où t/t′ < 100 (droite de Theis).
    const rem = e.mesures[0].filter((x) => x.t > POMPAGE && x.t / (x.t - POMPAGE) < 100).map((x) => [Math.log10(x.t / (x.t - POMPAGE)), x.s]);
    const mx = rem.reduce((s2, p) => s2 + p[0], 0) / rem.length, my = rem.reduce((s2, p) => s2 + p[1], 0) / rem.length;
    const dsr = rem.reduce((s2, p) => s2 + (p[0] - mx) * (p[1] - my), 0) / rem.reduce((s2, p) => s2 + (p[0] - mx) ** 2, 0);
    c.bilan.innerHTML = `<p class="final-result">Droite de Jacob au piézomètre de ${R[0]} m : Δs = ${fd(ds, 3)} m par cycle, t0 = ${duree(t0)} ⇒
        T = 0,183 Q/Δs = <strong>${sci(r.T, 3)} m²/s</strong>, S = 2,25 T t0/r² = <strong>${sci(r.S, 3)}</strong>
        ; à la remontée, s′ croît de ${fd(dsr, 3)} m par cycle de t/t′ ⇒ T = 0,183 Q/Δs′ = <strong>${sci(0.183 * e.Q / dsr, 3)} m²/s</strong>.
        <small>Au début de la droite (t = ${duree(a.t)}), u = r²S/(4Tt) = ${f(R[0] ** 2 * r.S / (4 * r.T * a.t), 2)} : Jacob vaut tant que u reste petit (moins de 0,05). L'aquifère du banc avait T = ${sci(e.aq.T, 2)} m²/s et S = ${sci(e.aq.S, 2)}.</small></p>`;
  }

  b = boucle({ avancer, dessiner, dessinerLent, surFin: bilan, surEtat: () => etatBoutons?.(), pasMax: Infinity });
  etatBoutons = brancherMarche(c, b, reinit);
  c.commandes.querySelectorAll("select").forEach((x) => x.addEventListener("change", () => { b.raz(); reinit(); etatBoutons(); }));
  reinit();
  etatBoutons();
}
