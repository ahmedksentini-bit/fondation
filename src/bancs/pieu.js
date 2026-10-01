// Banc d'essai : l'essai de chargement statique d'un pieu (chapitre 2). Le
// vérin s'appuie sous une poutre ancrée à des pieux de réaction ; on charge le
// pieu par paliers d'une heure, en lisant l'enfoncement de la tête à 1, 2, 5,
// 10, 15, 30, 45 et 60 minutes. La courbe charge–enfoncement se trace palier
// après palier ; le fluage de chaque palier, a = s60 − s30, change de pente à
// la charge de fluage Qc, et la charge limite se lit à un enfoncement de B/10.
import { svg, ligne, texte, couche, COULEURS, graphe } from "../figures.js";
import { chargeFluagePieu } from "../geotech/essais.js";
import { charpente, boucle, brancherMarche, lectures, f, fd, r1, esc, duree } from "./moteur.js";
import { fenetreLoupe, blocSol, fleche, etiquette, W as WL, H as HL, ROUGE } from "./loupe.js";

const PIEUX = {
  fore: { nom: "pieu foré Ø 600, L = 12 m", B: 0.6, Qu: 2600, Qc: 1700, Kel: 520 },
  battu: { nom: "pieu battu Ø 500, L = 12 m", B: 0.5, Qu: 3000, Qc: 2100, Kel: 700 },
};
const LECTURES = [1, 2, 5, 10, 15, 30, 45, 60]; // min
const PALIER = 3600;

export function monter(banc) {
  const c = charpente(banc, {
    vitesse: 100, vitesses: [10, 100, 1000],
    commandes: `<div class="field" style="grid-column:span 2"><label>Pieu d'essai</label><div class="input-wrap"><select data-r="pieu">${Object.entries(PIEUX).map(([k, x]) => `<option value="${k}">${esc(x.nom)}</option>`).join("")}</select></div></div>
      <p class="method-note" style="grid-column:1/-1">Paliers de 10 % de la charge maximale d'essai, une heure chacun (NF P94-150-1).</p>`,
  });
  const loupe = fenetreLoupe(c, "la pointe du pieu", { echelle: { px: 32, libelle: "20 cm" } });
  let e, b, etatBoutons;

  const reinit = () => {
    const pi = PIEUX[c.q('[data-r="pieu"]').value];
    const Qmax = 1.0 * pi.Qu;
    const paliers = Array.from({ length: 10 }, (_, i) => Math.round(((i + 1) * Qmax) / 10));
    e = { pi, paliers, t: 0, i: 0, lus: [], resultats: [], fini: false, sPrec: 0 };
    c.scene.innerHTML = fond();
    c.courbes.innerHTML = '<div class="dyn-courbe"></div>';
    c.bilan.innerHTML = "";
    dessiner(); dessinerLent();
  };

  /** Enfoncement final d'un palier (mm, hors fluage) : loi hyperbolique jusqu'à Qu, atteinte vers B/10. */
  const sCharge = (Q) => {
    const { Qu, Kel, B } = e.pi, x = Math.min(Q / Qu, 0.995);
    return (Q / Kel) / (1 - 0.9 * x ** 1.6) + (x > 0.97 ? (B * 100) * (x - 0.97) / 0.03 : 0);
  };
  /** Fluage par décade de temps sur un palier (mm) : faible sous Qc, rapide au-delà. */
  const fluage = (Q) => { const { Qc } = e.pi; return 0.03 + 0.08 * (Q / Qc) + (Q > Qc ? 0.9 * ((Q - Qc) / Qc) * 6 : 0); };
  /** Enfoncement à t (min) dans le palier i. */
  const enf = (i, t) => {
    const Q = e.paliers[i], s0 = i ? sCharge(e.paliers[i - 1]) + e.resultats.slice(0, i).reduce((a, r) => a + r.fl, 0) : 0;
    const s1 = sCharge(Q) + e.resultats.slice(0, i).reduce((a, r) => a + r.fl, 0);
    const inst = s0 + (s1 - s0) * Math.min(1, t / 0.5);
    return inst + (t > 1 ? fluage(Q) * Math.log10(t) : 0);
  };

  const avancer = (dt) => {
    if (e.fini) return false;
    let reste = dt;
    while (reste > 1e-9 && !e.fini) {
      const fin = (e.i + 1) * PALIER, h = Math.min(reste, fin - e.t);
      e.t += h; reste -= h;
      const tp = (e.t - e.i * PALIER) / 60;
      while (e.lus.length < LECTURES.length && LECTURES[e.lus.length] <= tp + 1e-9) e.lus.push({ t: LECTURES[e.lus.length], s: enf(e.i, LECTURES[e.lus.length]) });
      if (e.t >= fin - 1e-9) {
        const Q = e.paliers[e.i], s30 = e.lus[5].s, s60 = e.lus[7].s;
        // fl : fluage accumulé pendant le palier, qui reste acquis pour les paliers suivants.
        e.resultats.push({ Q, s30, s60, fl: fluage(Q) * Math.log10(60), lus: e.lus });
        e.lus = [];
        e.i++;
        if (e.i >= e.paliers.length || s60 > e.pi.B * 100 * 1.3) e.fini = true;
      }
    }
    return !e.fini;
  };

  const yS = 150;
  function fond() {
    return svg({
      largeur: 640, hauteur: 360, titre: "Essai de chargement d'un pieu", contenu: (id) => {
        let s = couche(id, { x: 10, y: yS, w: 620, h: 352 - yS, sol: "limon" });
        s += ligne(10, yS, 630, yS, COULEURS.trait, 1.8);
        // Pieux de réaction et poutre de réaction.
        for (const x of [90, 550]) s += `<rect x="${x - 10}" y="${yS - 20}" width="20" height="${352 - yS + 20}" fill="#cbd5e1" stroke="#475569"/>`;
        s += `<rect x="70" y="40" width="500" height="26" rx="3" fill="#475569"/>` + texte(320, 34, "poutre de réaction", 'text-anchor="middle" style="font-size:10.5px;font-weight:700;fill:#334155"');
        for (const x of [90, 550]) s += ligne(x, 66, x, yS - 20, "#334155", 3);
        s += texte(90, 352 - 6, "pieu de réaction", 'text-anchor="middle" class="halo" style="font-size:9.5px;font-weight:700"');
        s += `<rect x="${320 - 16}" y="${yS - 10}" width="32" height="${352 - yS + 10}" fill="#e2e8f0" stroke="#334155" stroke-width="1.4"/>` + texte(360, 340, "pieu d'essai", 'class="halo" style="font-size:10px;font-weight:700"');
        s += ligne(150, yS - 50, 280, yS - 50, "#78350f", 3) + texte(150, yS - 56, "poutre de référence", 'style="font-size:9.5px;font-weight:700;fill:#78350f"');
        s += `<g class="dyn-verin"></g>`;
        return s;
      },
    });
  }

  function dessiner() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    const i = Math.min(e.i, e.paliers.length - 1), tp = (e.t - e.i * PALIER) / 60;
    const s = e.fini ? e.resultats.at(-1).s60 : enf(i, Math.max(tp, 0.01));
    const Q = e.fini ? e.resultats.at(-1).Q : e.paliers[i];
    let d = `<rect x="304" y="66" width="32" height="${r1(yS - 10 - 66 - 34)}" fill="#f59e0b" stroke="#92400e"/>`;
    d += `<rect x="296" y="${r1(yS - 44)}" width="48" height="34" rx="3" fill="#94a3b8" stroke="#334155"/>` + texte(350, yS - 22, "vérin et capteur", 'style="font-size:9.5px;font-weight:700"');
    d += `<circle cx="270" cy="${yS - 78}" r="13" fill="#fff" stroke="#334155" stroke-width="1.5"/>` + ligne(270, yS - 65, 270, yS - 50, "#334155", 1.2);
    const a = (((s / 2) % 1) * 360 - 90) * Math.PI / 180;
    d += ligne(270, yS - 78, 270 + 10 * Math.cos(a), yS - 78 + 10 * Math.sin(a), COULEURS.effort, 1.8);
    svgEl.querySelector(".dyn-verin").innerHTML = d;
    c.lectures.innerHTML = lectures([["Palier", `${Math.min(e.i + 1, e.paliers.length)} / ${e.paliers.length}`, ""], ["Charge", f(Q, 4), "kN"], ["Enfoncement", fd(s, 2), "mm"], ["Temps du palier", e.fini ? "—" : `${fd(tp, 1)} min`, ""], ["Temps total", duree(e.t), ""]]);
    loupe(...vueLoupe());
  }

  // ── Loupe : le bas du pieu, son frottement et sa pointe (enfoncements ×2) ──
  const KL = 160, XC = 88, YT = 92, VERT = "#0f766e"; // px/m, axe, pointe au repos
  function vueLoupe() {
    const i = Math.min(e.i, e.paliers.length - 1), tp = (e.t - e.i * PALIER) / 60;
    const s0 = e.t === 0 ? 0 : e.fini ? e.resultats.at(-1).s60 : enf(i, Math.max(tp, 0.01)), Q = e.t === 0 ? 0 : e.fini ? e.resultats.at(-1).Q : e.paliers[i];
    const sp = s0 * 0.32, rb = (e.pi.B / 2) * KL, yP = YT + sp; // enfoncement dessiné : 1 mm → 0,32 px
    // Le sol est entraîné le long du fût, et refoulé sous la pointe.
    const deplacer = (x, y) => {
      const dl = Math.max(0, Math.abs(x - XC) - rb), dp = Math.max(0, y - YT);
      return [x, y + sp * Math.exp(-dl / 14) * Math.exp(-dp / 26)];
    };
    let s = blocSol("limon", { x0: 0, x1: WL, y0: -20, y1: HL + 20, k: 1000, deplacer });
    // Zone plastique sous la pointe à l'approche de la rupture.
    if (Q >= 0.85 * e.pi.Qu) for (const sg of [-1, 1]) s += `<path d="M${r1(XC + sg * rb)} ${r1(yP)}Q${r1(XC + sg * (rb + 30))} ${r1(yP + 42)} ${r1(XC + sg * (rb + 46))} ${r1(yP - 4)}" fill="none" stroke="${ROUGE}" stroke-width="1.4" stroke-dasharray="4 3"/>`;
    s += `<ellipse cx="${XC}" cy="${r1(yP + 10)}" rx="${r1(rb * 1.1)}" ry="${r1(14 + 22 * Math.min(1, Q / e.pi.Qu))}" fill="#0f172a" opacity="${r1(0.05 + 0.18 * Math.min(1, Q / e.pi.Qu))}"/>`;
    s += `<rect x="${r1(XC - rb)}" y="-2" width="${r1(2 * rb)}" height="${r1(yP + 2)}" fill="#d6d3d1" stroke="#57534e" stroke-width="1.2"/>`;
    for (let j = 0; j < 14; j++) s += `<circle cx="${r1(XC - rb + 6 + ((j * 37) % Math.max(8, 2 * rb - 12)))}" cy="${r1(8 + ((j * 53) % Math.max(10, yP - 14)))}" r="1.3" fill="#a8a29e"/>`;
    // Frottement latéral : mobilisé dès quelques millimètres ; résistance de pointe : beaucoup plus tard.
    const mf = Math.min(1, s0 / 6), mp = Math.min(1, s0 / (e.pi.B * 100)) ** 0.6;
    if (s0 > 0.05) {
      for (const y of [20, 46, 72]) for (const sg of [-1, 1]) s += fleche(XC + sg * (rb + 5), y + 4 + 12 * mf, XC + sg * (rb + 5), y, VERT, 1.8, 5);
      for (const x of [-0.6, 0, 0.6]) s += fleche(XC + x * rb, yP + 8 + 24 * mp, XC + x * rb, yP + 2, VERT, 2, 6);
      s += etiquette(XC, 28, "frottement latéral", { ancre: "middle", couleur: VERT }) + etiquette(XC, yP - 8, "pointe", { ancre: "middle", couleur: VERT });
    }
    s += etiquette(6, 13, `Q = ${f(Q, 4)} kN`, { couleur: ROUGE }) + etiquette(WL - 6, HL - 9, "enfoncements ×2", { ancre: "end", couleur: "#475569" });
    const legende = e.t === 0 ? "le pieu attend la première charge"
      : Q < e.pi.Qc ? "le frottement latéral porte l'essentiel de la charge"
        : Q < e.pi.Qu ? "au-delà de Qc : la pointe se mobilise, le pieu flue"
          : "rupture : la pointe poinçonne le sol (B/10 atteint)";
    return [s, legende];
  }

  function dessinerLent() {
    const zone = c.courbes.querySelector(".dyn-courbe");
    if (!zone) return;
    const R2 = e.resultats, QMax = e.paliers.at(-1) * 1.05;
    const sMax = Math.max(5, ...R2.map((r) => r.s60), e.pi.B * 100 * 0.3) * 1.15;
    const g1 = graphe({
      largeur: 560, hauteur: 250, xmin: 0, xmax: QMax, ymin: 0, ymax: sMax, inverserY: true, xlabel: "charge en tête Q (kN)", ylabel: "enfoncement (mm)",
      series: [{ points: [[0, 0], ...R2.map((r) => [r.Q, r.s60])], couleur: COULEURS.encre, marqueurs: true, epaisseur: 2, libelle: "enfoncement en fin de palier (60 min)" },
        ...(sMax > e.pi.B * 100 ? [{ points: [[0, e.pi.B * 100], [QMax, e.pi.B * 100]], couleur: COULEURS.rouge, tirets: "4 3", libelle: "B/10" }] : [])],
    });
    const cf = R2.length >= 4 ? chargeFluagePieu(R2.map((r) => ({ Q: r.Q, s30: r.s30, s60: r.s60 }))) : null;
    const g2 = R2.length ? graphe({
      largeur: 560, hauteur: 230, xmin: 0, xmax: QMax, ymin: 0, ymax: Math.max(0.2, ...R2.map((r) => r.s60 - r.s30)) * 1.2, xlabel: "charge Q (kN)", ylabel: "fluage s60 − s30 (mm)",
      series: [{ points: R2.map((r) => [r.Q, r.s60 - r.s30]), couleur: COULEURS.violet, marqueurs: true, epaisseur: 2, libelle: "fluage de chaque palier" },
        ...(cf?.applicable ? [{ points: [[0, cf.d1.a], [cf.Qc * 1.1, cf.d1.a + cf.d1.b * cf.Qc * 1.1]], couleur: COULEURS.ec7, tirets: "5 3", libelle: "droite basse" },
          { points: [[cf.Qc * 0.9, cf.d2.a + cf.d2.b * cf.Qc * 0.9], [QMax, cf.d2.a + cf.d2.b * QMax]], couleur: COULEURS.rouge, tirets: "5 3", libelle: "droite haute" }] : [])],
      marques: cf?.applicable ? [{ x: cf.Qc, y: cf.d1.a + cf.d1.b * cf.Qc, couleur: COULEURS.effort, guides: true, libelle: `Qc ≈ ${f(cf.Qc, 4)} kN` }] : [],
    }) : "";
    zone.innerHTML = g1 + g2;
  }

  function bilan() {
    const R2 = e.resultats;
    const cf = chargeFluagePieu(R2.map((r) => ({ Q: r.Q, s30: r.s30, s60: r.s60 })));
    const lim = R2.find((r) => r.s60 >= e.pi.B * 100);
    c.bilan.innerHTML = `<p class="final-result">${cf.applicable ? `Charge de fluage Qc ≈ <strong>${f(cf.Qc, 4)} kN</strong> (intersection des deux droites de fluage)` : "Le fluage ne change pas de pente : Qc n'est pas atteinte"} ;
        ${lim ? `charge limite Qu ≈ <strong>${f(lim.Q, 4)} kN</strong> (enfoncement B/10 = ${fd(e.pi.B * 100, 0)} mm atteint)` : "B/10 n'est pas atteint : la charge limite est au-delà de la charge maximale d'essai"}.
        <small>Qc/Qu ≈ ${lim && cf.applicable ? fd(cf.Qc / lim.Q, 2) : "—"} ; la NF P94-262 et le Fascicule 62 tirent de ces deux charges la résistance du pieu (chapitres 11 et 12).</small></p>`;
  }

  b = boucle({ avancer, dessiner, dessinerLent, surFin: () => { dessinerLent(); bilan(); }, surEtat: () => etatBoutons?.(), pasMax: 60 });
  etatBoutons = brancherMarche(c, b, reinit);
  c.commandes.querySelectorAll("select").forEach((x) => x.addEventListener("change", () => { b.raz(); reinit(); etatBoutons(); }));
  reinit();
  etatBoutons();
}
