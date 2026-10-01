// Banc d'essai : l'essai pressiométrique Ménard (chapitre 3). La foreuse ouvre
// le forage jusqu'à la cote d'essai, on descend la sonde, puis le contrôleur
// pression-volume (CPV) applique les paliers : la sonde gonfle, on lit le
// volume à 15, 30 et 60 s, et la courbe pressiométrique se trace palier après
// palier. Sonde dégonflée et remontée, l'essai est dépouillé (EM, pf, pl,
// pressions nettes) et vient prendre place dans le profil, mètre après mètre.
// Les relevés sont ceux du sondage d'exemple que dépouille l'assistant du
// chapitre et le bureau de calcul.
import { svg, ligne, texte, COULEURS, graphe } from "../figures.js";
import { depouiller } from "../geotech/pressio.js";
import { sondage, etalonnagesExemple } from "../pressio-exemples.js";
import { SITES } from "./terrain.js";
import { charpente, boucle, brancherMarche, lectures, coupe, axeProfondeur, panneau, points, f, fd, r1, esc, duree } from "./moteur.js";

const PALIER = 60; // s
const VITESSE_FORAGE = { remblai: 1.2, argile: 1.6, limon: 1.4, sable: 1.0, grave: 0.5, marne: 0.4, craie: 0.6 }; // m/min
const DUREES = { descente: 50, degonflage: 40, remontee: 45 };

export function monter(banc) {
  const c = charpente(banc, {
    vitesse: 100,
    commandes: `
      <div class="field"><label>Terrain</label><div class="input-wrap"><select data-r="site">${Object.values(SITES).map((s) => `<option value="${s.cle}">${esc(s.nom)}</option>`).join("")}</select></div></div>
      <div class="field"><label>Sonde</label><div class="input-wrap"><select disabled><option>Ø 58 mm, cellule centrale de 210 mm</option></select></div></div>`,
  });
  const etal = etalonnagesExemple();
  let e, b, etatBoutons;

  const reinit = () => {
    const site = SITES[c.q('[data-r="site"]').value], S = sondage(site.cle);
    const zMax = Math.max(...S.essais.map((x) => x.z)) + 1.2;
    e = { site, S, zMax, t: 0, fond: 0, phase: "forage", minuteur: 0, i: 0, palier: 0, tPalier: 0, outil: 0, resultats: [], fini: false };
    c.scene.innerHTML = fond(e);
    c.courbes.innerHTML = '<div class="dyn-courbe"></div>';
    c.bilan.innerHTML = "";
    dessiner(); dessinerLent();
  };

  const essai = () => e.S.essais[e.i];

  const avancer = (dt) => {
    if (e.fini) return false;
    let reste = dt;
    while (reste > 1e-9 && !e.fini) {
      const x = essai();
      if (e.phase === "forage") {
        const cible = x.z + 0.45, k = e.site.couches.find((q) => e.fond >= q.z0 && e.fond < q.z1) ?? e.site.couches.at(-1);
        const v = (VITESSE_FORAGE[k.sol] ?? 1) / 60, h = Math.min(reste, Math.max(0, cible - e.fond) / v);
        e.fond += h * v; e.t += h; reste -= h; e.outil += h;
        if (e.fond >= cible - 1e-9) { e.phase = "descente"; e.minuteur = DUREES.descente; }
        continue;
      }
      if (e.phase === "paliers") {
        const h = Math.min(reste, PALIER - e.tPalier);
        e.tPalier += h; e.t += h; reste -= h;
        if (e.tPalier >= PALIER - 1e-9) {
          e.palier++; e.tPalier = 0;
          if (e.palier >= x.paliers.length) { e.phase = "degonflage"; e.minuteur = DUREES.degonflage; depouillerEssai(); }
        }
        continue;
      }
      const h = Math.min(reste, e.minuteur);
      e.minuteur -= h; e.t += h; reste -= h;
      if (e.minuteur > 1e-9) continue;
      if (e.phase === "descente") { e.phase = "paliers"; e.palier = 0; e.tPalier = 0; }
      else if (e.phase === "degonflage") { e.phase = "remontee"; e.minuteur = DUREES.remontee; }
      else if (e.phase === "remontee") {
        e.i++;
        if (e.i >= e.S.essais.length) e.fini = true; else e.phase = "forage";
      }
    }
    return !e.fini;
  };

  const depouillerEssai = () => {
    const x = essai();
    const r = depouiller({ paliers: x.paliers, Vs: etal.Vs, z: x.z, hc: 1, pe: etal.pe, a: etal.a, sol: { zw: e.S.zw, couches: e.S.poids, K0: 0.5 }, convention: "norme" });
    e.resultats.push({ z: x.z, couche: x.couche, r });
    dessinerCourbe(true);
  };

  /** Volume lu pendant le palier en cours : 0 → V15 → V30 → V60, le fluage se lisant entre 30 et 60 s. */
  const volume = () => {
    const x = essai();
    if (!x || e.phase !== "paliers") return e.phase === "degonflage" ? (x?.paliers.at(-1).V60 ?? 0) * (e.minuteur / DUREES.degonflage) : 0;
    const p = x.paliers[e.palier], avant = e.palier ? x.paliers[e.palier - 1].V60 : 0, t = e.tPalier;
    const V15 = p.V15 ?? p.V30, V30 = p.V30;
    if (t < 15) return avant + (V15 - avant) * (1 - (1 - t / 15) ** 3);
    if (t < 30) return V15 + (V30 - V15) * ((t - 15) / 15);
    return V30 + (p.V60 - V30) * ((t - 30) / 30);
  };

  // ── Dessin ──────────────────────────────────────────────────────────────
  const G = { yS: 176, bas: 488, xF: 104 };
  const Y = (z) => G.yS + (z / e.zMax) * (G.bas - G.yS);

  function fond(e2) {
    return svg({
      largeur: 640, hauteur: 500, titre: "Essai pressiométrique en cours", contenu: (id) => {
        let s = coupe(id, { x0: 10, x1: 250, Y, couches: e2.site.couches, zMax: e2.zMax, zw: e2.site.zw });
        // Foreuse et contrôleur pression-volume posé à côté du forage.
        s += `<rect x="16" y="${G.yS - 34}" width="62" height="24" rx="5" fill="#fde68a" stroke="#92400e" stroke-width="1.2"/>`;
        s += `<rect x="12" y="${G.yS - 11}" width="72" height="10" rx="5" fill="#334155"/>`;
        s += `<rect x="${G.xF - 28}" y="10" width="8" height="${G.yS - 18}" fill="#fbbf24" stroke="#92400e"/>`;
        s += ligne(G.xF - 20, 14, G.xF + 8, 14, "#92400e", 2.4);
        s += `<rect x="150" y="${G.yS - 96}" width="86" height="94" rx="6" fill="#e2e8f0" stroke="${COULEURS.betonTrait}" stroke-width="1.3"/>`;
        s += texte(193, G.yS - 102, "CPV", 'text-anchor="middle" style="font-size:10.5px;font-weight:800;fill:#334155"');
        s += `<circle cx="174" cy="${G.yS - 66}" r="17" fill="#fff" stroke="#334155" stroke-width="1.4"/>`;
        s += texte(174, G.yS - 40, "pression", 'text-anchor="middle" style="font-size:9px;fill:#475569"');
        s += `<rect x="208" y="${G.yS - 90}" width="14" height="70" rx="3" fill="#fff" stroke="#334155"/>`;
        s += texte(215, G.yS - 10, "volume", 'text-anchor="middle" style="font-size:9px;fill:#475569"');
        s += `<g class="dyn-forage"></g><g class="dyn-cpv"></g>`;
        s += axeProfondeur({ x: 274, Y, zMax: e2.zMax });
        const pP = panneau({ x0: 288, x1: 448, Y, zMax: e2.zMax, vMax: 4, titre: "pl* (MPa)", pas: 1 });
        const pE = panneau({ x0: 466, x1: 630, Y, zMax: e2.zMax, vMin: 1, vMax: 100, log: true, titre: "EM (MPa, échelle log)" });
        e2.XP = pP.X; e2.XE = pE.X;
        s += pP.svg + pE.svg;
        s += `<polyline class="dyn-pl" points="" fill="none" stroke="${COULEURS.f62}" stroke-width="1.6"/><g class="dyn-plp"></g>`;
        s += `<polyline class="dyn-em" points="" fill="none" stroke="${COULEURS.ec7}" stroke-width="1.6"/><g class="dyn-emp"></g>`;
        return s;
      },
    });
  }

  function dessiner() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    const x = essai(), yFond = Y(e.fond);
    let s = `<rect x="${G.xF - 7}" y="${G.yS}" width="14" height="${r1(Math.max(0, yFond - G.yS))}" fill="#fff"/>`
      + ligne(G.xF - 7, G.yS, G.xF - 7, yFond, COULEURS.trait, 0.9, 'stroke-dasharray="4 3"') + ligne(G.xF + 7, G.yS, G.xF + 7, yFond, COULEURS.trait, 0.9, 'stroke-dasharray="4 3"');
    const tube = (y) => `<path d="M${G.xF} ${r1(y)}V${G.yS - 4}H150" fill="none" stroke="${COULEURS.eau}" stroke-width="1.6"/>`;
    if (e.phase === "forage") {
      s += `<rect x="${G.xF - 2.5}" y="26" width="5" height="${r1(Math.max(0, yFond - 33))}" fill="#cbd5e1" stroke="${COULEURS.betonTrait}" stroke-width="0.8"/>`;
      s += `<rect x="${G.xF - 11}" y="20" width="22" height="12" rx="3" fill="#f1f5f9" stroke="${COULEURS.betonTrait}"/>`;
      const a = (e.outil * 6) % 1;
      s += `<path d="M${G.xF - 6} ${r1(yFond - 7)}h12l-2 7h-8z" fill="#475569"/><path d="M${r1(G.xF - 6 + 12 * a)} ${r1(yFond - 7)}v7" stroke="#cbd5e1" stroke-width="1.5"/>`;
    } else if (x) {
      // Sonde : descente, gonflement pendant les paliers, dégonflage, remontée.
      const zS = e.phase === "descente" ? x.z * (1 - e.minuteur / DUREES.descente) : e.phase === "remontee" ? x.z * (e.minuteur / DUREES.remontee) : x.z;
      const y = Y(zS), V = volume(), dr = Math.min(12, 2 + V / 70);
      s += tube(y - 10);
      s += `<rect x="${r1(G.xF - 4)}" y="${r1(y - 16)}" width="8" height="5" fill="#64748b"/><rect x="${r1(G.xF - 4)}" y="${r1(y + 11)}" width="8" height="5" fill="#64748b"/>`;
      s += `<rect x="${r1(G.xF - 4 - dr)}" y="${r1(y - 11)}" width="${r1(8 + 2 * dr)}" height="22" rx="${r1(Math.min(8, dr + 3))}" fill="#93c5fd" stroke="#1d4ed8" stroke-width="1"/>`;
    }
    svgEl.querySelector(".dyn-forage").innerHTML = s;
    // CPV : aiguille du manomètre, niveau dans le tube volumétrique.
    const p = e.phase === "paliers" && x ? x.paliers[e.palier].p : 0, V = volume();
    const ang = -220 + (Math.min(p, 5) / 5) * 260, rad = (ang * Math.PI) / 180;
    let cpv = ligne(174, G.yS - 66, 174 + 13 * Math.cos(rad), G.yS - 66 + 13 * Math.sin(rad), COULEURS.effort, 2);
    const hV = Math.min(66, (V / 900) * 66);
    cpv += `<rect x="210" y="${r1(G.yS - 22 - hV)}" width="10" height="${r1(hV)}" fill="#60a5fa"/>`;
    svgEl.querySelector(".dyn-cpv").innerHTML = cpv;
    const libelles = { forage: "forage", descente: "descente de la sonde", paliers: "palier en cours", degonflage: "dégonflage et dépouillement", remontee: "remontée de la sonde" };
    c.lectures.innerHTML = lectures([
      ["Essai", x ? `${e.i + 1} / ${e.S.essais.length}` : "—", ""], ["Profondeur", x ? fd(x.z, 1) : "—", "m"],
      ["Palier", e.phase === "paliers" && x ? `${e.palier + 1} · ${fd(p, 2)} MPa` : "—", ""],
      ["Volume lu", fd(V, 1), "cm³"], ["Temps du palier", e.phase === "paliers" ? `${fd(e.tPalier, 0)} s` : "—", ""], ["Temps total", duree(e.t), ""],
    ]) + `<p class="banc-etat">${libelles[e.phase] ?? ""}</p>`;
  }

  function dessinerLent() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    const ok = e.resultats.filter((x) => x.r.applicable && x.r.plNette > 0);
    svgEl.querySelector(".dyn-pl").setAttribute("points", points(ok.map((x) => [e.XP(Math.min(x.r.plNette, 4)), Y(x.z)])));
    svgEl.querySelector(".dyn-em").setAttribute("points", points(ok.map((x) => [e.XE(Math.min(Math.max(x.r.EM, 1), 100)), Y(x.z)])));
    svgEl.querySelector(".dyn-plp").innerHTML = ok.map((x) => `<circle cx="${r1(e.XP(Math.min(x.r.plNette, 4)))}" cy="${r1(Y(x.z))}" r="3" fill="${COULEURS.f62}"/>`).join("");
    svgEl.querySelector(".dyn-emp").innerHTML = ok.map((x) => `<circle cx="${r1(e.XE(Math.min(Math.max(x.r.EM, 1), 100)))}" cy="${r1(Y(x.z))}" r="3" fill="${COULEURS.ec7}"/>`).join("");
    if (e.phase === "paliers") dessinerCourbe(false);
  }

  /** Courbe de l'essai en cours (lectures brutes), puis corrigée et dépouillée. */
  function dessinerCourbe(fin) {
    const x = essai(), zone = c.courbes.querySelector(".dyn-courbe");
    if (!x || !zone) return;
    const lus = x.paliers.slice(0, fin ? x.paliers.length : e.palier);
    const pts = lus.map((q) => [q.p, q.V60]);
    if (!fin && e.phase === "paliers") pts.push([x.paliers[e.palier].p, volume()]);
    const res = fin ? e.resultats.at(-1) : null, r = res?.r;
    const pMax = Math.max(...x.paliers.map((q) => q.p)) * 1.08, VMax = Math.max(...x.paliers.map((q) => q.V60)) * 1.08;
    const series = [{ points: pts, couleur: COULEURS.encre, epaisseur: 2, marqueurs: true, libelle: "lectures brutes : pr et V60" }];
    if (r?.applicable) series.push({ points: r.courbe.map((q) => [q.p, q.V]), couleur: COULEURS.bleu, tirets: "5 3", libelle: "courbe corrigée : p et V" });
    const marques = r?.applicable ? [
      { x: r.pf, y: r.courbe.find((q) => q.p >= r.pf)?.V ?? 0, couleur: COULEURS.violet, libelle: `pf = ${fd(r.pf, 2)} MPa` },
      ...(Number.isFinite(r.pl) && r.pl < pMax ? [{ x: r.pl, y: VMax * 0.95, couleur: COULEURS.effort, libelle: `pl = ${fd(r.pl, 2)} MPa` }] : []),
    ] : [];
    zone.innerHTML = graphe({
      largeur: 560, hauteur: 270, xmin: 0, xmax: pMax, ymin: 0, ymax: VMax, xlabel: "pression (MPa)", ylabel: "volume (cm³)",
      titre: `Essai à ${fd(x.z, 1)} m`, series, marques,
    }) + (r ? (r.applicable
      ? `<p class="final-result">Essai à ${fd(x.z, 1)} m (${esc(res.couche)}) : E<sub>M</sub> = <strong>${f(r.EM, 3)} MPa</strong>, p<sub>f</sub> = ${fd(r.pf, 2)} MPa, p<sub>l</sub> = ${fd(r.pl, 2)} MPa${r.limite?.extrapolee ? " (extrapolée)" : ""},
        p<sub>l</sub>* = <strong>${fd(r.plNette, 2)} MPa</strong>, E<sub>M</sub>/p<sub>l</sub>* = ${fd(r.rapport, 1)}${r.avertissements.length ? `<small>${esc(r.avertissements.join(" ; "))}</small>` : ""}</p>`
      : `<p class="final-result"><span class="verdict ko">essai non dépouillable</span> <small>${esc(r.motif ?? "")}</small></p>`) : "");
  }

  function bilan() {
    const lignes = e.resultats.map((x) => x.r.applicable
      ? `<tr><td class="n">${fd(x.z, 1)}</td><td>${esc(x.couche)}</td><td class="n">${f(x.r.EM, 3)}</td><td class="n">${fd(x.r.pf, 2)}</td><td class="n">${fd(x.r.pl, 2)}</td><td class="n">${fd(x.r.plNette, 2)}</td><td class="n">${fd(x.r.rapport, 1)}</td></tr>`
      : `<tr><td class="n">${fd(x.z, 1)}</td><td>${esc(x.couche)}</td><td colspan="5">non dépouillable</td></tr>`).join("");
    c.bilan.innerHTML = `<p class="final-result">${e.resultats.length} essais en ${duree(e.t)}, un par mètre.
        <small>Ce sont les relevés du sondage que dépouille, étape par étape, l'assistant de ce chapitre ; le profil EM et p<sub>l</sub>* sert ensuite à la portance et au tassement (chapitres 6 et 9).</small></p>
      <div class="table-large"><table class="resultats"><thead><tr><th class="num">z (m)</th><th>Couche</th><th class="num">E<sub>M</sub> (MPa)</th><th class="num">p<sub>f</sub> (MPa)</th><th class="num">p<sub>l</sub> (MPa)</th><th class="num">p<sub>l</sub>* (MPa)</th><th class="num">E<sub>M</sub>/p<sub>l</sub>*</th></tr></thead><tbody>${lignes}</tbody></table></div>`;
  }

  b = boucle({ avancer, dessiner, dessinerLent, surFin: bilan, surEtat: () => etatBoutons?.() });
  etatBoutons = brancherMarche(c, b, reinit);
  c.commandes.querySelectorAll("select").forEach((s) => s.addEventListener("change", () => { b.raz(); reinit(); etatBoutons(); }));
  reinit();
  etatBoutons();
}
