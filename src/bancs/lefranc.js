// Banc d'essai : l'essai Lefranc (chapitre 2). Sous la nappe, au fond d'un
// tubage étanche, une cavité de longueur L et de diamètre D échange de l'eau
// avec le terrain. À charge constante, on règle le débit qui maintient le
// niveau dans le tube ; à charge variable, on remplit le tube et l'on suit la
// descente du niveau. Le facteur de forme de Hvorslev relie débit, charge et
// perméabilité : Q = F k h.
import { svg, ligne, texte, couche, COULEURS, graphe } from "../figures.js";
import { facteurForme, lefrancConstant, lefrancVariable } from "../geotech/essais.js";
import { charpente, boucle, brancherMarche, lectures, f, fd, r1, esc, duree, sci } from "./moteur.js";

const SOLS = {
  "sable-grossier": { nom: "sable grossier", k: 2e-4, sol: "sable" },
  "sable-fin": { nom: "sable fin", k: 2e-5, sol: "sable" },
  limon: { nom: "limon sableux", k: 1e-6, sol: "limon" },
  "argile-sableuse": { nom: "argile sableuse", k: 6e-8, sol: "argile" },
};
const L = 0.5, D = 0.1, DTUBE = 0.08, ZCAV = 6, ZW = 2; // m
const S = (Math.PI * DTUBE * DTUBE) / 4;

export function monter(banc) {
  const c = charpente(banc, {
    vitesse: 10,
    commandes: `
      <div class="field"><label>Terrain au droit de la cavité</label><div class="input-wrap"><select data-r="sol">${Object.entries(SOLS).map(([k, s]) => `<option value="${k}">${esc(s.nom)}</option>`).join("")}</select></div></div>
      <div class="field"><label>Méthode</label><div class="input-wrap"><select data-r="methode"><option value="constante">charge constante</option><option value="variable">charge variable</option></select></div></div>
      <p class="method-note" style="grid-column:1/-1">Cavité L = ${fd(L, 2)} m, D = ${fd(D, 2)} m à ${f(ZCAV, 2)} m de profondeur, nappe à ${f(ZW, 2)} m ; tubage Ø ${f(DTUBE * 1000, 3)} mm ; F = ${fd(facteurForme(L, D), 3)} m (Hvorslev).</p>`,
  });
  let e, b, etatBoutons;
  const F = facteurForme(L, D);

  const reinit = () => {
    const s = SOLS[c.q('[data-r="sol"]').value], methode = c.q('[data-r="methode"]').value;
    const h0 = methode === "constante" ? 1.0 : ZW + 1.2; // charge au-dessus de la nappe (m)
    const Q = F * s.k * h0;
    const tau = (S / (F * s.k)); // constante de temps de la descente (s)
    const tFin = methode === "constante" ? 20 * 60 : Math.min(Math.max(3 * tau * Math.log(10) / 3, 120), 6 * 3600);
    e = { s, methode, h0, Q, tau, tFin, t: 0, mesures: [], prochaine: methode === "constante" ? 60 : Math.max(5, tFin / 40), fini: false };
    c.scene.innerHTML = fond();
    c.courbes.innerHTML = '<div class="dyn-courbe"></div>';
    c.bilan.innerHTML = "";
    dessiner(); dessinerLent();
  };

  /** Débit (charge constante) ou charge (charge variable) à l'instant t. */
  const mesure = (t) => (e.methode === "constante"
    ? e.Q * (1 + 0.55 * Math.exp(-t / 90)) * (1 + 0.01 * Math.sin(t / 37))
    : e.h0 * Math.exp(-t / e.tau));

  const avancer = (dt) => {
    if (e.fini) return false;
    e.t = Math.min(e.tFin, e.t + dt);
    while (e.prochaine <= e.t + 1e-9) {
      e.mesures.push({ t: e.prochaine, v: mesure(e.prochaine) });
      e.prochaine += e.methode === "constante" ? 60 : Math.max(5, e.tFin / 40);
    }
    if (e.t >= e.tFin - 1e-9) e.fini = true;
    return !e.fini;
  };

  // ── Dessin ──────────────────────────────────────────────────────────────
  const yS = 90, k = 36, Y = (z) => yS + z * k, xF = 150;
  function fond() {
    return svg({
      largeur: 640, hauteur: 400, titre: "Essai Lefranc", contenu: (id) => {
        let s = couche(id, { x: 10, y: yS, w: 620, h: Y(4) - yS, sol: "limon" }) + couche(id, { x: 10, y: Y(4), w: 620, h: 400 - 8 - Y(4), sol: e.s.sol });
        s += ligne(10, yS, 630, yS, COULEURS.trait, 1.8) + ligne(10, Y(ZW), 630, Y(ZW), COULEURS.eau, 1.3, 'stroke-dasharray="6 4"');
        s += texte(624, Y(ZW) - 5, "nappe", `text-anchor="end" style="font-size:10.5px;font-weight:700;fill:${COULEURS.eau}"`);
        s += texte(16, Y(4) + 16, e.s.nom, 'class="halo" style="font-size:10.5px;font-weight:700"');
        // Forage tubé jusqu'au toit de la cavité ; cavité nue en dessous.
        s += `<rect x="${xF - 10}" y="${yS - 40}" width="20" height="${Y(ZCAV) - yS + 40}" fill="#fff" stroke="#475569" stroke-width="2"/>`;
        s += `<rect x="${xF - 11}" y="${Y(ZCAV)}" width="22" height="${L * k}" fill="#e0f2fe" stroke="${COULEURS.eau}" stroke-dasharray="3 2"/>`;
        s += texte(xF + 16, Y(ZCAV) + 12, "cavité L × D", 'style="font-size:10px;font-weight:700"');
        s += texte(xF + 16, yS - 30, "tubage étanche", 'style="font-size:10px;font-weight:700;fill:#475569"');
        // Réservoir et compteur (charge constante) ou repère de niveau (charge variable).
        s += `<rect x="40" y="18" width="70" height="40" rx="5" fill="#e0f2fe" stroke="${COULEURS.eau}"/>` + texte(75, 14, e.methode === "constante" ? "réservoir et compteur" : "remplissage", 'text-anchor="middle" style="font-size:9.5px;font-weight:700"');
        s += `<path d="M110 38H${xF}V${yS - 40}" fill="none" stroke="${COULEURS.eau}" stroke-width="2"/>`;
        s += `<g class="dyn-eau"></g>`;
        return s;
      },
    });
  }

  function dessiner() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    const h = e.methode === "constante" ? e.h0 : mesure(e.t); // charge au-dessus de la nappe
    const yNiv = Y(ZW) - h * k;
    let s = `<rect x="${xF - 8}" y="${r1(Math.max(yNiv, yS - 38))}" width="16" height="${r1(Y(ZCAV) - Math.max(yNiv, yS - 38))}" fill="#7dd3fc" opacity=".8"/>`;
    s += `<rect x="${xF - 10}" y="${Y(ZCAV)}" width="20" height="${L * k}" fill="#7dd3fc" opacity=".8"/>`;
    // Filets d'eau qui partent dans le terrain.
    const phase = (e.t / 4) % 1;
    for (let j = 0; j < 3; j++) {
      const y = Y(ZCAV) + 4 + j * 6, d = 8 + 26 * ((phase + j / 3) % 1);
      s += ligne(xF + 11, y, xF + 11 + d, y, COULEURS.bleu, 1.4) + ligne(xF - 11, y, xF - 11 - d, y, COULEURS.bleu, 1.4);
    }
    svgEl.querySelector(".dyn-eau").innerHTML = s;
    c.lectures.innerHTML = lectures([
      ["Temps", duree(e.t), ""],
      e.methode === "constante" ? ["Débit", f(mesure(Math.max(e.t, 1)) * 60000, 3), "L/min"] : ["Charge h", fd(h, 3), "m"],
      ["Charge imposée", e.methode === "constante" ? fd(e.h0, 2) : "—", "m"],
    ]);
  }

  function dessinerLent() {
    const zone = c.courbes.querySelector(".dyn-courbe");
    if (!zone) return;
    const M = e.mesures;
    if (e.methode === "constante") {
      const yMax = Math.max(e.Q * 1.6, ...M.map((m) => m.v)) * 60000 * 1.05;
      zone.innerHTML = graphe({
        largeur: 560, hauteur: 250, xmin: 0, xmax: e.tFin / 60, ymin: 0, ymax: yMax, xlabel: "temps (min)", ylabel: "débit injecté Q (L/min)",
        series: [{ points: M.map((m) => [m.t / 60, m.v * 60000]), couleur: COULEURS.bleu, marqueurs: true, epaisseur: 2, libelle: "débit lu chaque minute" }],
      });
    } else {
      zone.innerHTML = graphe({
        largeur: 560, hauteur: 250, xmin: 0, xmax: e.tFin / 60, ymin: Math.max(0.01, e.h0 * Math.exp(-e.tFin / e.tau)) * 0.8, ymax: e.h0 * 1.1, logY: true,
        xlabel: "temps (min)", ylabel: "charge h (m, échelle log)",
        series: [{ points: M.map((m) => [m.t / 60, m.v]), couleur: COULEURS.bleu, marqueurs: true, epaisseur: 2, libelle: "descente du niveau : droite en échelle log" }],
      });
    }
  }

  function bilan() {
    const M = e.mesures;
    let res;
    if (e.methode === "constante") {
      const fin = M.slice(-5), Q = fin.reduce((s2, m) => s2 + m.v, 0) / fin.length;
      res = lefrancConstant({ Q, h: e.h0, L, D });
      c.bilan.innerHTML = `<p class="final-result">Débit stabilisé Q = ${f(Q * 60000, 3)} L/min sous h = ${fd(e.h0, 2)} m ⇒ k = Q/(F h) = <strong>${sci(res.k, 3)} m/s</strong>
        <small>F = ${fd(res.F, 3)} m ; on retient le débit des dernières minutes, une fois le régime établi (le terrain se sature autour de la cavité au début).</small></p>`;
    } else {
      const a = M[Math.floor(M.length / 4)], z = M[M.length - 2];
      res = lefrancVariable({ S, h1: a.v, h2: z.v, dt: z.t - a.t, L, D });
      c.bilan.innerHTML = `<p class="final-result">De h1 = ${fd(a.v, 3)} m à h2 = ${fd(z.v, 3)} m en ${duree(z.t - a.t)} ⇒ k = S ln(h1/h2)/[F (t2 − t1)] = <strong>${sci(res.k, 3)} m/s</strong>
        <small>S = ${fd(S * 1e4, 1)} cm² (section du tube) ; F = ${fd(res.F, 3)} m. En échelle logarithmique, la descente est une droite : sa pente donne k.</small></p>`;
    }
    c.bilan.insertAdjacentHTML("beforeend", `<p class="method-note">Le terrain virtuel avait k = ${sci(e.s.k, 2)} m/s. Le calculateur qui suit refait le calcul pour d'autres lectures.</p>`);
  }

  b = boucle({ avancer, dessiner, dessinerLent, surFin: bilan, surEtat: () => etatBoutons?.(), pasMax: Infinity });
  etatBoutons = brancherMarche(c, b, reinit);
  c.commandes.querySelectorAll("select").forEach((x) => x.addEventListener("change", () => { b.raz(); reinit(); etatBoutons(); }));
  reinit();
  etatBoutons();
}
