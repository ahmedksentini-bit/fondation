// Banc d'essai : pénétromètre statique et piézocône (chapitre 2). Le camion
// lesté fonce le train de tiges à 2 cm/s ; la pointe mesure qc, le manchon fs,
// le filtre u2, une lecture tous les 2 cm, et les trois profils se tracent au
// fil de l'enfoncement. On peut arrêter le fonçage pour un essai de
// dissipation : la surpression retombe vers u0, et son temps de
// demi-dissipation t50 donne ch (Teh et Houlsby).
import { svg, ligne, texte, COULEURS, graphe } from "../figures.js";
import { t50Dissipation, ZONES_IC } from "../geotech/essais.js";
import { SITES, terrain, natureDe, estFin } from "./terrain.js";
import { charpente, boucle, brancherMarche, lectures, coupe, axeProfondeur, panneau, points, f, fd, r1, esc, duree } from "./moteur.js";

const VITESSE = 0.02; // m/s
const PAS = 0.02; // m entre deux lectures
const AJOUT_TIGE = 20; // s
const R0 = 0.01784, T50 = 0.245; // cône de 10 cm² ; facteur temps de Teh et Houlsby (filtre u2)
const COULEURS_IC = { 7: "#f6d860", 6: "#f3e5ae", 5: "#e8dcc3", 4: "#c7d2c0", 3: "#b7a99a", 2: "#7c6a58" };

export function monter(banc) {
  const c = charpente(banc, {
    vitesse: 10,
    commandes: `
      <div class="field"><label>Terrain</label><div class="input-wrap"><select data-r="site">${Object.values(SITES).map((s) => `<option value="${s.cle}">${esc(s.nom)}</option>`).join("")}</select></div></div>
      <div class="field"><label>Arrêt à la profondeur</label><div class="input-wrap"><input data-r="zmax" type="text" inputmode="decimal" value="15" data-curseur="3 18 0.5"><span class="unit">m</span></div></div>`,
  });
  // Bouton de dissipation, à côté des boutons de marche.
  c.q(".banc-marche").insertAdjacentHTML("beforeend", '<button type="button" class="secondary" data-action="dissipation" disabled>Dissipation ici</button>');
  let e, b, etatBoutons;

  const reinit = () => {
    const site = SITES[c.q('[data-r="site"]').value], T = terrain(site.cle);
    const zMax = Math.min(site.zMax - 0.5, Math.max(3, parseFloat(String(c.q('[data-r="zmax"]').value).replace(",", ".")) || 15));
    e = { site, T, zMax, z: 0, t: 0, prochaine: PAS, mesures: [], pauseTige: 0, prochaineTige: 1, fini: false, dissip: null, dissipations: [] };
    c.scene.innerHTML = fond(e);
    c.courbes.innerHTML = "";
    c.bilan.innerHTML = "";
    dessiner(); dessinerLent();
  };

  // ── Simulation ──────────────────────────────────────────────────────────
  const avancer = (dt) => {
    if (e.fini) return false;
    let reste = dt;
    while (reste > 1e-9 && !e.fini) {
      if (e.dissip) {
        // Essai de dissipation : la surpression retombe vers u0 (courbe en S en lg t).
        const h = Math.min(reste, 1);
        e.dissip.t += h; e.t += h; reste -= h;
        const d = e.dissip, U = 1 / (1 + ((d.t * d.ch) / (R0 * R0 * Math.sqrt(d.Ir)) / T50) ** 0.7);
        const u = d.u0 + (d.ui - d.u0) * U * (1 + 0.006 * e.T.bruitFin(d.t / 40));
        if (d.t >= d.prochaine) { d.mesures.push({ t: d.t, u }); d.prochaine = Math.max(d.prochaine * 1.12, d.prochaine + 1); }
        if (U < 0.08 || d.t > 20000) finirDissipation();
        continue;
      }
      if (e.pauseTige > 0) { const h = Math.min(reste, e.pauseTige); e.pauseTige -= h; e.t += h; reste -= h; continue; }
      const h = Math.min(reste, (Math.min(e.prochaine, e.prochaineTige, e.zMax) - e.z) / VITESSE);
      e.z += h * VITESSE; e.t += h; reste -= h;
      if (e.z >= e.prochaine - 1e-9) { e.mesures.push(e.T.lectureCPTU(e.prochaine)); e.prochaine += PAS; }
      if (e.z >= e.zMax - 1e-9) { e.fini = true; break; }
      if (e.z >= e.prochaineTige - 1e-9) { e.pauseTige = AJOUT_TIGE; e.prochaineTige += 1; }
    }
    return !e.fini;
  };

  const lancerDissipation = () => {
    if (!e.mesures.length || e.dissip) return;
    const m = e.mesures.at(-1), k = e.T.couche(e.z), nat = natureDe(k);
    e.dissip = { z: m.z, ui: m.u2, u0: m.u0, t: 0, prochaine: 1, mesures: [{ t: 0.5, u: m.u2 }], ch: nat.ch ?? 1e-4, Ir: nat.Ir ?? 100, couche: k.nom };
    b.lancer();
  };
  const finirDissipation = () => {
    const d = e.dissip;
    const r = t50Dissipation(d.mesures, d.u0);
    d.t50 = r.applicable ? r.t50 : null;
    d.chMesure = d.t50 ? (T50 * R0 * R0 * Math.sqrt(d.Ir)) / d.t50 : null;
    e.dissipations.push(d);
    e.dissip = null;
    dessinerDissipation(d, true);
  };

  // ── Dessin ──────────────────────────────────────────────────────────────
  const G = { yS: 170, bas: 488, xT: 116, kh: 60 };
  const Y = (z) => G.yS + (z / e.zMax) * (G.bas - G.yS);

  function fond(e2) {
    return svg({
      largeur: 640, hauteur: 500, titre: "Piézocône en cours de fonçage", contenu: (id) => {
        let s = coupe(id, { x0: 10, x1: 232, Y, couches: e2.site.couches, zMax: e2.zMax, zw: e2.site.zw });
        // Camion lesté et bâti de fonçage (au-dessus du sol, échelle dilatée).
        s += `<rect x="18" y="${G.yS - 66}" width="150" height="44" rx="6" fill="#e2e8f0" stroke="${COULEURS.betonTrait}" stroke-width="1.3"/>`;
        s += `<rect x="24" y="${G.yS - 60}" width="58" height="32" rx="3" fill="#94a3b8" stroke="#475569"/>`;
        s += texte(53, G.yS - 40, "lest", 'text-anchor="middle" style="font-size:10px;font-weight:700;fill:#fff"');
        s += `<rect x="170" y="${G.yS - 58}" width="40" height="36" rx="6" fill="#bfdbfe" stroke="${COULEURS.betonTrait}" stroke-width="1.3"/>`;
        for (const x of [42, 136, 192]) s += `<circle cx="${x}" cy="${G.yS - 12}" r="11" fill="#334155"/><circle cx="${x}" cy="${G.yS - 12}" r="4.5" fill="#cbd5e1"/>`;
        s += `<rect x="${G.xT - 22}" y="${G.yS - 160}" width="6" height="96" fill="#475569"/><rect x="${G.xT + 16}" y="${G.yS - 160}" width="6" height="96" fill="#475569"/>`;
        s += texte(G.xT + 26, G.yS - 150, "vérins", 'style="font-size:10px;font-weight:700;fill:#334155"');
        s += `<g class="dyn-train"></g>`;
        s += axeProfondeur({ x: 260, Y, zMax: e2.zMax });
        const pQ = panneau({ x0: 272, x1: 380, Y, zMax: e2.zMax, vMax: 30, titre: "qc (MPa)", pas: 10 });
        const pF = panneau({ x0: 390, x1: 486, Y, zMax: e2.zMax, vMax: 300, titre: "fs (kPa)", pas: 100 });
        const pU = panneau({ x0: 496, x1: 604, Y, zMax: e2.zMax, vMin: -100, vMax: 800, titre: "u2 (kPa)", pas: 400 });
        e2.XQ = pQ.X; e2.XF = pF.X; e2.XU = pU.X;
        s += pQ.svg + pF.svg + pU.svg;
        s += `<rect x="612" y="${Y(0)}" width="18" height="${Y(e2.zMax) - Y(0)}" fill="#fff" stroke="${COULEURS.trait}"/>`;
        s += texte(621, Y(0) - 4, "Ic", 'text-anchor="middle" style="font-size:10px;font-weight:700"');
        s += `<g class="dyn-ic"></g><polyline class="dyn-u0" points="" fill="none" stroke="${COULEURS.eau}" stroke-width="1.2" stroke-dasharray="5 3"/>`;
        s += `<polyline class="dyn-qc" points="" fill="none" stroke="${COULEURS.f62}" stroke-width="1.4"/>`;
        s += `<polyline class="dyn-fs" points="" fill="none" stroke="${COULEURS.violet}" stroke-width="1.2"/>`;
        s += `<polyline class="dyn-u2" points="" fill="none" stroke="${COULEURS.bleu}" stroke-width="1.3"/>`;
        s += `<line class="dyn-repere" x1="272" x2="630" y1="${G.yS}" y2="${G.yS}" stroke="${COULEURS.effort}" stroke-width="1" stroke-dasharray="3 3"/>`;
        return s;
      },
    });
  }

  function dessiner() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    // Course des vérins : la tête monte et descend d'un mètre à chaque tige.
    const course = e.pauseTige > 0 ? 1 - e.pauseTige / AJOUT_TIGE : e.z % 1;
    const yPince = G.yS - 150 + course * 70, yPointe = Y(e.z);
    let t = `<rect x="${G.xT - 24}" y="${r1(yPince - 8)}" width="48" height="10" rx="2" fill="#f59e0b" stroke="#92400e"/>`;
    t += `<rect x="${G.xT - 3}" y="${r1(yPince)}" width="6" height="${r1(G.yS - yPince)}" fill="#cbd5e1" stroke="${COULEURS.betonTrait}" stroke-width="0.8"/>`;
    t += `<rect x="${G.xT - 2.5}" y="${G.yS}" width="5" height="${r1(Math.max(0, yPointe - G.yS - 9))}" fill="#cbd5e1" stroke="${COULEURS.betonTrait}" stroke-width="0.8"/>`;
    t += `<rect x="${G.xT - 3}" y="${r1(yPointe - 9)}" width="6" height="5" fill="#64748b"/><path d="M${G.xT - 3} ${r1(yPointe - 4)}h6l-3 5z" fill="#1e293b"/>`;
    if (e.dissip) t += `<circle cx="${G.xT}" cy="${r1(yPointe - 6)}" r="${r1(8 + 6 * Math.abs(Math.sin(e.t / 3)))}" fill="none" stroke="${COULEURS.eau}" stroke-width="1.4" opacity=".7"/>`;
    svgEl.querySelector(".dyn-train").innerHTML = t;
    svgEl.querySelector(".dyn-repere").setAttribute("y1", r1(yPointe)); svgEl.querySelector(".dyn-repere").setAttribute("y2", r1(yPointe));
    const m = e.mesures.at(-1);
    c.lectures.innerHTML = lectures([
      ["Profondeur", fd(e.z, 2), "m"], ["qc", m ? fd(m.qc, 2) : "—", "MPa"], ["fs", m ? f(m.fs, 3) : "—", "kPa"],
      ["u2", e.dissip ? f(e.dissip.mesures.at(-1).u, 3) : m ? f(m.u2, 3) : "—", "kPa"], ["Temps d'essai", duree(e.t), ""],
    ]) + (e.dissip ? `<p class="banc-etat">dissipation à ${fd(e.dissip.z, 2)} m : ${duree(e.dissip.t)}</p>` : e.pauseTige > 0 ? '<p class="banc-etat">ajout d\'une tige…</p>' : "");
    const boutonD = c.q('[data-action="dissipation"]');
    if (boutonD) {
      const m2 = e.mesures.at(-1);
      boutonD.disabled = e.fini || !!e.dissip || !m2 || !estFin(e.T.couche(e.z)) || m2.u2 - m2.u0 < 30;
      boutonD.textContent = e.dissip ? "Dissipation en cours…" : "Dissipation ici";
    }
  }

  function dessinerLent() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    const M = e.mesures;
    svgEl.querySelector(".dyn-qc").setAttribute("points", points(M.map((m) => [e.XQ(Math.min(m.qc, 30)), Y(m.z)])));
    svgEl.querySelector(".dyn-fs").setAttribute("points", points(M.map((m) => [e.XF(Math.min(m.fs, 300)), Y(m.z)])));
    svgEl.querySelector(".dyn-u2").setAttribute("points", points(M.map((m) => [e.XU(Math.max(-100, Math.min(m.u2, 800))), Y(m.z)])));
    svgEl.querySelector(".dyn-u0").setAttribute("points", M.length ? points([[e.XU(0), Y(0)], [e.XU(0), Y(e.site.zw)], [e.XU(M.at(-1).u0), Y(M.at(-1).z)]]) : "");
    let ic = "";
    for (const m of M) if (m.interp.applicable) ic += `<rect x="613" y="${r1(Y(m.z - PAS))}" width="16" height="${r1(Y(m.z) - Y(m.z - PAS) + 0.4)}" fill="${COULEURS_IC[m.interp.zone] ?? "#ddd"}"/>`;
    svgEl.querySelector(".dyn-ic").innerHTML = ic;
    if (e.dissip) dessinerDissipation(e.dissip, false);
  }

  function dessinerDissipation(d, fin) {
    const pts = d.mesures.filter((p) => p.t > 0);
    const tMax = Math.max(100, ...pts.map((p) => p.t)) * 1.2;
    const g = graphe({
      largeur: 560, hauteur: 250, xmin: 0.5, xmax: tMax, logX: true, ymin: Math.min(0, d.u0) , ymax: d.ui * 1.1,
      xlabel: "temps (s, échelle logarithmique)", ylabel: "u2 (kPa)",
      series: [
        { points: pts.map((p) => [p.t, p.u]), couleur: COULEURS.bleu, epaisseur: 2.2, libelle: `dissipation à ${fd(d.z, 2)} m (${d.couche})` },
        { points: [[0.5, d.u0], [tMax, d.u0]], couleur: COULEURS.eau, tirets: "5 3", libelle: "u0 hydrostatique" },
      ],
      marques: fin && d.t50 ? [{ x: d.t50, y: d.u0 + 0.5 * (d.ui - d.u0), couleur: COULEURS.effort, guides: true, libelle: `t50 = ${f(d.t50, 3)} s` }] : [],
    });
    const cle = `dissip-${d.z.toFixed(2)}`;
    let bloc = c.courbes.querySelector(`[data-cle="${cle}"]`);
    if (!bloc) { bloc = document.createElement("div"); bloc.dataset.cle = cle; c.courbes.appendChild(bloc); }
    bloc.innerHTML = g + (fin ? `<p class="final-result">t<sub>50</sub> = <strong>${f(d.t50, 3)} s</strong> ⇒ c<sub>h</sub> = T*<sub>50</sub> r<sub>0</sub>² √I<sub>r</sub>/t<sub>50</sub> = ${f(d.chMesure * 31557600, 3)} m²/an
        <small>avec T*<sub>50</sub> = 0,245, r<sub>0</sub> = 17,8 mm et I<sub>r</sub> = ${f(d.Ir, 3)} ; ce c<sub>h</sub> mesuré en recompression se ramène à la branche vierge par C<sub>s</sub>/C<sub>c</sub> (chapitre 16).</small></p>` : "");
  }

  function bilan() {
    const parCouche = e.site.couches.filter((k) => k.z0 < e.z).map((k) => {
      const ms = e.mesures.filter((m) => m.z > k.z0 + 0.1 && m.z < k.z1 - 0.1 && m.interp.applicable);
      const moy = (cle2) => (ms.length ? ms.reduce((s, m) => s + cle2(m), 0) / ms.length : NaN);
      const Ic = moy((m) => m.interp.Ic), zone = ZONES_IC.find((x) => Ic < x.max);
      return `<tr><td>${esc(k.nom)}</td><td class="n">${fd(k.z0, 1)} – ${fd(Math.min(k.z1, e.z), 1)}</td><td class="n">${f(moy((m) => m.qc), 3)}</td><td class="n">${f(moy((m) => m.interp.Rf), 2)}</td><td class="n">${fd(Ic, 2)}</td><td>${zone ? esc(zone.nom) : "—"}</td></tr>`;
    }).join("");
    c.bilan.innerHTML = `<p class="final-result">Fonçage arrêté à ${fd(e.z, 2)} m : ${e.mesures.length} lectures en ${duree(e.t)}.
        <small>Chaque couche se reconnaît à sa signature : qc faible, fs et u2 forts dans l'argile molle ; qc fort, u2 ≈ u0 dans le sable.
        La colonne Ic colore la zone de Robertson, comme l'abaque des calculateurs qui suivent.</small></p>
      <div class="table-large"><table class="resultats"><thead><tr><th>Couche traversée</th><th class="num">z (m)</th><th class="num">qc moyen (MPa)</th><th class="num">Rf (%)</th><th class="num">Ic</th><th>Comportement (Robertson)</th></tr></thead><tbody>${parCouche}</tbody></table></div>`;
  }

  b = boucle({ avancer, dessiner, dessinerLent, surFin: bilan, surEtat: () => etatBoutons?.() });
  etatBoutons = brancherMarche(c, b, reinit);
  c.q('[data-action="dissipation"]').addEventListener("click", lancerDissipation);
  c.commandes.querySelectorAll("select, input").forEach((s) => s.addEventListener("change", () => { b.raz(); reinit(); etatBoutons(); }));
  reinit();
  etatBoutons();
}
