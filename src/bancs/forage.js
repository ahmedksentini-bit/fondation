// Banc d'essai : le sondage carotté et l'enregistrement des paramètres de forage
// (chapitre 2). La foreuse descend passe après passe ; la vitesse d'avance, la
// poussée et le couple s'enregistrent en continu et dessinent la coupe — une
// chute d'outil trahit une cavité. Au rocher, chaque passe de 1,5 m est
// remontée et rangée dans la caisse à carottes : récupération et RQD.
import { svg, texte, COULEURS, solDe } from "../figures.js";
import { rqd } from "../geotech/essais.js";
import { creerAlea } from "../exos/alea.js";
import { charpente, boucle, brancherMarche, lectures, coupe, axeProfondeur, panneau, points, f, fd, r1, duree } from "./moteur.js";
import { fenetreLoupe, vueTerrain, etiquette, horloge, W as WL, H as HL, BLEU, ACIER, ACIER_SOMBRE } from "./loupe.js";

const COUCHES = [
  { z0: 0, z1: 1.2, sol: "remblai", nom: "remblai" }, { z0: 1.2, z1: 4.5, sol: "argile", nom: "argile molle" },
  { z0: 4.5, z1: 7.5, sol: "sable", nom: "sable" }, { z0: 7.5, z1: 15, sol: "roche", nom: "calcaire fracturé" },
];
const CAVITE = [9.0, 9.8], ZMAX = 15, PASSE = 1.5, EXTRACTION = 8 * 60;
const BASE = { remblai: { VIT: 75, PO: 26, CR: 32 }, argile: { VIT: 165, PO: 11, CR: 14 }, sable: { VIT: 98, PO: 30, CR: 36 }, roche: { VIT: 18, PO: 78, CR: 62 } };
const PERTE = { remblai: 0.15, argile: 0.04, sable: 0.3 }; // part des morceaux perdus au carottage
const bruit = (z) => 0.5 * Math.sin(12.9 * z) + 0.3 * Math.sin(31.7 * z + 1) + 0.2 * Math.sin(57.1 * z + 2);

export function monter(banc) {
  const c = charpente(banc, {
    vitesse: 100,
    commandes: '<p class="method-note" style="grid-column:1/-1">Sondage carotté au carottier double, jusqu\'à 15 m : remblai, argile molle, sable, puis un calcaire fracturé qui cache une cavité.</p>',
  });
  const loupe = fenetreLoupe(c, "la couronne du carottier", { echelle: { px: 30, libelle: "5 cm" } });
  let e, b, etatBoutons;

  const reinit = () => {
    e = { z: 0, t: 0, phase: "forage", minuteur: 0, debutPasse: 0, enreg: [], passes: [], alea: creerAlea(4242), fini: false };
    c.scene.innerHTML = fond();
    c.courbes.innerHTML = '<div class="dyn-caisse"></div>';
    c.bilan.innerHTML = "";
    dessiner(); dessinerLent();
  };

  const coucheDe = (z) => COUCHES.find((k) => z >= k.z0 && z < k.z1) ?? COUCHES.at(-1);
  const dansCavite = (z) => z >= CAVITE[0] && z < CAVITE[1];
  const param = (z, p) => {
    if (dansCavite(z)) return { VIT: 245, PO: 4, CR: 6 }[p] * (1 + 0.04 * bruit(z));
    const k = coucheDe(z);
    return BASE[k.sol][p] * (1 + (p === "VIT" && k.sol === "roche" ? 0.25 : 0.14) * bruit(z * 1.7 + { VIT: 0, PO: 3, CR: 7 }[p]));
  };

  /** Carotte d'une passe : morceaux (cm) ; perte dans la cavité, fracturation dans le calcaire. */
  const carotte = (z0, z1) => {
    const morceaux = [];
    let z = z0;
    while (z < z1 - 1e-6) {
      if (dansCavite(z)) { z = Math.min(z1, CAVITE[1]); continue; }
      const k = coucheDe(z);
      // Espacement moyen des fractures : toit altéré, roche brisée autour de la cavité, roche saine dessous.
      const espacement = k.sol === "roche" ? (z > 8.6 && z < 10.4 ? 0.04 : z < 8.6 ? 0.07 : 0.14) : k.sol === "sable" ? 0.15 : 0.3;
      const l = Math.min(z1 - z, Math.max(0.02, -espacement * Math.log(1 - e.alea.reel())));
      if (k.sol !== "roche" && e.alea.reel() < PERTE[k.sol]) { z += l; continue; } // perte au carottage des sols meubles
      morceaux.push({ l: l * 100, sol: k.sol });
      z += l;
    }
    return morceaux;
  };

  const avancer = (dt) => {
    if (e.fini) return false;
    let reste = dt;
    while (reste > 1e-9 && !e.fini) {
      if (e.phase === "extraction") {
        const h = Math.min(reste, e.minuteur);
        e.minuteur -= h; e.t += h; reste -= h;
        if (e.minuteur <= 1e-9) { if (e.z >= ZMAX - 1e-9) e.fini = true; else e.phase = "forage"; }
        continue;
      }
      const v = param(e.z, "VIT") / 3600, fin = Math.min(e.debutPasse + PASSE, ZMAX);
      const h = Math.min(reste, (fin - e.z) / v, 5);
      e.z += h * v; e.t += h; reste -= h;
      if (!e.enreg.length || e.z - e.enreg.at(-1).z >= 0.05) e.enreg.push({ z: e.z, VIT: param(e.z, "VIT"), PO: param(e.z, "PO"), CR: param(e.z, "CR") });
      if (e.z >= fin - 1e-9) {
        const m = carotte(e.debutPasse, fin);
        // RQD sur les morceaux de rocher ; récupération sur toute la carotte.
        const L = (fin - e.debutPasse) * 100, r = rqd(m.filter((x) => x.sol === "roche").map((x) => x.l), L);
        r.recuperation = (100 * m.reduce((t, x) => t + x.l, 0)) / L;
        e.passes.push({ z0: e.debutPasse, z1: fin, morceaux: m, r });
        e.debutPasse = fin; e.phase = "extraction"; e.minuteur = EXTRACTION;
      }
    }
    return !e.fini;
  };

  const G = { yS: 150, bas: 488, xF: 110 };
  const Y = (z) => G.yS + (z / ZMAX) * (G.bas - G.yS);
  const PANNEAUX = [{ p: "VIT", titre: "vitesse (m/h)", max: 260 }, { p: "PO", titre: "poussée (bar)", max: 110 }, { p: "CR", titre: "couple (bar)", max: 80 }];
  const X = {};
  function fond() {
    return svg({
      largeur: 640, hauteur: 500, titre: "Sondage carotté", contenu: (id) => {
        let s = coupe(id, { x0: 10, x1: 232, Y, couches: COUCHES, zMax: ZMAX });
        s += `<path d="M${G.xF - 60} ${r1(Y(CAVITE[0]) + 4)}C${G.xF - 30} ${r1(Y(CAVITE[0]) - 4)} ${G.xF + 40} ${r1(Y(CAVITE[0]) - 3)} ${G.xF + 70} ${r1(Y(CAVITE[0]) + 6)}C${G.xF + 80} ${r1(Y(CAVITE[1]))} ${G.xF + 20} ${r1(Y(CAVITE[1]) + 4)} ${G.xF - 30} ${r1(Y(CAVITE[1]) + 2)}C${G.xF - 60} ${r1(Y(CAVITE[1]))} ${G.xF - 74} ${r1(Y(CAVITE[0]) + 10)} ${G.xF - 60} ${r1(Y(CAVITE[0]) + 4)}Z" fill="#f8fafc" stroke="${COULEURS.trait}" stroke-dasharray="3 2"/>`;
        s += texte(G.xF + 76, Y(CAVITE[0]) + 12, "cavité", 'class="halo" style="font-size:10px;font-weight:700"');
        s += `<rect x="20" y="${G.yS - 44}" width="150" height="22" rx="4" fill="#e2e8f0" stroke="${COULEURS.betonTrait}"/>`;
        for (const x of [40, 80, 150]) s += `<circle cx="${x}" cy="${G.yS - 11}" r="10" fill="#334155"/><circle cx="${x}" cy="${G.yS - 11}" r="4" fill="#cbd5e1"/>`;
        s += `<rect x="${G.xF - 28}" y="12" width="8" height="${G.yS - 56}" fill="#fbbf24" stroke="#92400e"/>`;
        s += `<g class="dyn-train"></g>`;
        s += axeProfondeur({ x: 260, Y, zMax: ZMAX });
        PANNEAUX.forEach((pn, i) => { const x0 = 272 + i * 122; const pnl = panneau({ x0, x1: x0 + 112, Y, zMax: ZMAX, vMax: pn.max, titre: pn.titre }); X[pn.p] = pnl.X; s += pnl.svg; });
        s += PANNEAUX.map((pn) => `<polyline class="dyn-${pn.p}" fill="none" stroke="${pn.p === "VIT" ? COULEURS.f62 : pn.p === "PO" ? COULEURS.bleu : COULEURS.violet}" stroke-width="1.5"/>`).join("");
        return s;
      },
    });
  }

  function dessiner() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    const y = Y(e.z);
    let s = `<rect x="${G.xF - 6}" y="${G.yS}" width="12" height="${r1(Math.max(0, y - G.yS))}" fill="#fff"/>`;
    s += `<rect x="${G.xF - 2.5}" y="34" width="5" height="${r1(Math.max(0, y - 34 - 10))}" fill="#cbd5e1" stroke="${COULEURS.betonTrait}" stroke-width="0.8"/>`;
    s += `<rect x="${G.xF - 12}" y="${e.phase === "forage" ? 30 + ((e.z - e.debutPasse) / PASSE) * 40 : 30}" width="24" height="14" rx="3" fill="#f1f5f9" stroke="${COULEURS.betonTrait}"/>`;
    s += `<rect x="${G.xF - 5}" y="${r1(y - 10)}" width="10" height="10" fill="#94a3b8" stroke="#334155"/>`;
    if (e.phase === "forage") s += `<path d="M${G.xF - 5} ${r1(y)}l2.5 3 2.5-3 2.5 3 2.5-3" stroke="#111827" fill="none"/>`;
    svgEl.querySelector(".dyn-train").innerHTML = s;
    const d = e.enreg.at(-1);
    c.lectures.innerHTML = lectures([["Profondeur", fd(e.z, 2), "m"], ["Vitesse", d ? f(d.VIT, 3) : "—", "m/h"], ["Poussée · couple", d ? `${f(d.PO, 3)} · ${f(d.CR, 3)}` : "—", "bar"],
      ["Passes remontées", String(e.passes.length), ""], ["Temps", duree(e.t), ""]]) + `<p class="banc-etat">${e.phase === "extraction" ? "remontée de la passe et rangement de la carotte" : dansCavite(e.z) ? "chute d'outil !" : "carottage"}</p>`;
    loupe(...vueLoupe());
  }

  // ── Loupe : la couronne du carottier double, qui découpe la carotte ───────
  const KL = 600, YP = 112, XC = 88, RT = 0.056 * KL, RE = 0.043 * KL, RI = 0.031 * KL, RK = 0.027 * KL; // trou, tubes extérieur et intérieur, carotte
  /** Fractures du calcaire, attachées à la profondeur : serrées autour de la cavité. */
  const fractures = (zH, zB, Yl) => {
    let s = "";
    for (let z = 7.5, j = 0; z < zB && j < 400; j++) {
      z += (z > 8.6 && z < 10.4 ? 0.04 : z < 8.6 ? 0.07 : 0.14) * (0.6 + 0.8 * Math.abs(Math.sin(z * 91.7)));
      if (z < zH || dansCavite(z)) continue;
      const y = Yl(z), tl = 6 * Math.sin(z * 37.1);
      s += `<path d="M0 ${r1(y - tl)}L${WL} ${r1(y + tl)}" stroke="#334155" stroke-width=".9" opacity=".7"/>`;
    }
    return s;
  };
  function vueLoupe() {
    const t = horloge(), ext = e.phase === "extraction", cav = dansCavite(e.z);
    const Yl = (z) => YP + (z - e.z) * KL, zH = e.z - YP / KL, zB = e.z + (HL - YP) / KL;
    let s = vueTerrain({ couches: COUCHES, Y: Yl, k: KL, zHaut: zH, zBas: zB, x0: 0, x1: XC - RT }) + vueTerrain({ couches: COUCHES, Y: Yl, k: KL, zHaut: zH, zBas: zB, x0: XC + RT, x1: WL })
      + vueTerrain({ couches: COUCHES, Y: Yl, k: KL, zHaut: Math.max(zH, e.z), zBas: zB, x0: XC - RT, x1: XC + RT });
    s += fractures(zH, zB, Yl);
    if (CAVITE[1] > zH && CAVITE[0] < zB) s += `<rect x="0" y="${r1(Yl(CAVITE[0]))}" width="${WL}" height="${r1((CAVITE[1] - CAVITE[0]) * KL)}" fill="#0f172a" opacity=".82"/>` + etiquette(WL - 8, Math.min(HL - 30, Math.max(24, Yl(CAVITE[0]) + 16)), "cavité", { ancre: "end", couleur: "#f8fafc" }).replace("halo", "");
    // Trou foré au-dessus de la couronne : boue et déblais qui remontent.
    s += `<rect x="${r1(XC - RT)}" y="0" width="${r1(2 * RT)}" height="${YP}" fill="#cbd5e1"/>`;
    if (!ext) for (let i = 0; i < 10; i++) {
      const q = (t * 0.5 + i / 10) % 1, x = XC + (i % 2 ? 1 : -1) * (RE + (RT - RE) / 2);
      s += `<circle cx="${r1(x)}" cy="${r1(YP - q * YP)}" r="${i % 3 ? 1.2 : 1.7}" fill="#78716c"/>`;
    }
    // Carottier : il remonte pendant l'extraction ; la carotte de la passe est dans le tube intérieur.
    const dy = ext ? -(1 - e.minuteur / EXTRACTION) * 220 : 0, passe = e.passes.at(-1);
    const z0 = ext ? passe.z0 : e.debutPasse, z1 = ext ? passe.z1 : e.z;
    if (z1 > z0) {
      const Yc = (z) => Yl(z) + dy;
      for (const [a, b] of [[z0, Math.min(z1, CAVITE[0])], [Math.max(z0, CAVITE[1]), z1]]) if (b > a) s += vueTerrain({ couches: COUCHES, Y: Yc, k: KL, zHaut: a, zBas: b, x0: XC - RK, x1: XC + RK });
    }
    const yC = YP + dy;
    // Tube extérieur (qui tourne : ses génératrices défilent) et tube intérieur (fixe).
    for (const sg of [-1, 1]) {
      s += `<rect x="${r1(sg < 0 ? XC - RE : XC + RI + 2)}" y="${r1(Math.min(0, yC - 260))}" width="${r1(RE - RI - 2)}" height="${r1(yC - 10 - Math.min(0, yC - 260))}" fill="${ACIER}" stroke="${ACIER_SOMBRE}"/>`;
      s += `<rect x="${r1(sg < 0 ? XC - RI : XC + RK + 0.5)}" y="${r1(Math.min(0, yC - 260))}" width="${r1(RI - RK - 0.5)}" height="${r1(yC - 6 - Math.min(0, yC - 260))}" fill="#94a3b8"/>`;
      if (!ext && !cav) for (let i = 0; i < 4; i++) { const x = (sg < 0 ? XC - RE : XC + RI + 2) + ((t * 18 + i * 7) % (RE - RI - 2)); s += `<path d="M${r1(x)} ${r1(yC - 14)}V0" stroke="#64748b" stroke-width=".8" opacity=".6"/>`; }
    }
    // Couronne diamantée : un anneau dont les grains défilent quand elle tourne.
    s += `<rect x="${r1(XC - RE - 1)}" y="${r1(yC - 10)}" width="${r1(2 * RE + 2)}" height="10" fill="#475569" stroke="#1e293b"/>`;
    s += `<rect x="${r1(XC - RK - 1)}" y="${r1(yC - 10)}" width="${r1(2 * RK + 2)}" height="10" fill="#cbd5e1"/>`;
    for (let i = 0; i < 6; i++) {
      const q = ((t * (ext || cav ? 0 : 1.5) + i / 6) % 1), x = XC - RE + q * (RE - RK - 1);
      s += `<circle cx="${r1(x)}" cy="${r1(yC - 1)}" r="1.4" fill="#e2e8f0"/><circle cx="${r1(XC + RK + 1 + q * (RE - RK - 1))}" cy="${r1(yC - 1)}" r="1.4" fill="#e2e8f0"/>`;
    }
    if (!ext && !cav) for (const sg of [-1, 1]) s += `<path d="M${r1(XC + sg * (RE + (RT - RE) / 2))} ${YP - 6}v-22" stroke="${BLEU}" stroke-width="1.4" marker-end=""/><path d="M${r1(XC + sg * (RE + (RT - RE) / 2) - 3)} ${YP - 24}l3 -5l3 5z" fill="${BLEU}"/>`;
    const k = COUCHES.find((q) => e.z >= q.z0 && e.z < q.z1) ?? COUCHES.at(-1);
    s += etiquette(6, 13, k.nom);
    const legende = e.t === 0 ? "le carottier attend en surface" : e.fini ? "sondage terminé"
      : ext ? "remontée du carottier : la carotte est dans le tube intérieur" : cav ? "chute d'outil : la couronne ne rencontre plus rien"
        : k.sol === "roche" ? "la couronne use le calcaire ; la carotte monte dans le tube intérieur, qui ne tourne pas" : "carottage du sol : le tube intérieur protège la carotte du fluide";
    return [s, legende];
  }

  function dessinerLent() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    for (const pn of PANNEAUX) svgEl.querySelector(`.dyn-${pn.p}`).setAttribute("points", points(e.enreg.map((d) => [X[pn.p](Math.min(d[pn.p], pn.max)), Y(d.z)])));
    // Caisse à carottes : une rangée par passe de 1,5 m.
    const zone = c.courbes.querySelector(".dyn-caisse");
    if (!zone) return;
    const W = 640, kx = (W - 250) / (PASSE * 100);
    zone.innerHTML = svg({
      largeur: W, hauteur: 30 + 26 * Math.max(1, e.passes.length), titre: "Caisse à carottes", contenu: () => {
        let s = texte(10, 18, "caisse à carottes : une rangée par passe", 'style="font-size:11px;font-weight:700"');
        e.passes.forEach((p, i) => {
          const y = 28 + i * 26;
          s += `<rect x="70" y="${y}" width="${PASSE * 100 * kx}" height="18" fill="#f8fafc" stroke="#94a3b8"/>`;
          s += texte(64, y + 13, `${fd(p.z0, 1)}–${fd(p.z1, 1)} m`, 'text-anchor="end" style="font-size:9.5px"');
          let x = 70;
          for (const m of p.morceaux) { const w = m.l * kx; s += `<rect x="${r1(x)}" y="${y + 2}" width="${r1(Math.max(1, w - 1.5))}" height="14" rx="2" fill="${solDe(m.sol).fond}" stroke="#57534e" stroke-width="0.6"/>`; x += w; }
          s += texte(70 + PASSE * 100 * kx + 8, y + 13, `réc. ${fd(p.r.recuperation, 0)} % · RQD ${p.morceaux.some((m) => m.sol === "roche") ? fd(p.r.RQD, 0) + " %" : "—"}`, 'style="font-size:9.5px;font-weight:700"');
        });
        return s;
      },
    });
  }

  function bilan() {
    const lignes = e.passes.map((p) => `<tr><td class="n">${fd(p.z0, 1)} – ${fd(p.z1, 1)}</td><td class="n">${fd(p.r.recuperation, 0)} %</td><td class="n">${p.morceaux.some((m) => m.sol === "roche") ? `${fd(p.r.RQD, 0)} % (${p.r.qualite})` : "sol meuble"}</td></tr>`).join("");
    c.bilan.innerHTML = `<p class="final-result">Sondage terminé à ${fd(ZMAX, 1)} m en ${duree(e.t)}.
        <small>Les paramètres de forage lisent la coupe sans carotte : l'argile se fore vite et sans effort, le calcaire lentement sous forte poussée ; la vitesse qui s'emballe et la poussée qui s'effondre à ${fd(CAVITE[0], 1)} m signalent une cavité, que confirme la passe sans carotte.</small></p>
      <div class="table-large"><table class="resultats"><thead><tr><th class="num">Passe (m)</th><th class="num">Récupération</th><th class="num">RQD</th></tr></thead><tbody>${lignes}</tbody></table></div>`;
  }

  b = boucle({ avancer, dessiner, dessinerLent, surFin: () => { dessinerLent(); bilan(); }, surEtat: () => etatBoutons?.() });
  etatBoutons = brancherMarche(c, b, reinit);
  reinit();
  etatBoutons();
}
