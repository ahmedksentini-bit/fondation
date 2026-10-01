// Calculateurs du chapitre 3 : l'assistant de dépouillement d'un essai
// pressiométrique, étape par étape (étalonnages, corrections, courbes, EM, pf,
// pl, pressions nettes), puis le profil d'un sondage complet.
import { el, num, f, fd, esc, verdict, brancher, garde, lireTableau } from "./ui.js";
import { graphe, schemaPressio, profilPressio, COULEURS } from "./figures.js";
import * as P from "./geotech/pressio.js";
import { alphaMenard, pressionNette } from "./geotech/sols.js";
import { profilPoints } from "./geotech/outils.js";
import { pleF62 } from "./geotech/superficielles.js";
import { ESSAIS, TUBE, AIR, SONDE, texteReleves, texteCouples, sondage, etalonnagesExemple } from "./pressio-exemples.js";
import { figureTube, figureAir, figureCorrections, figureCourbe, figureFluage, figureInverse, figurePentes, figureHyperbole } from "./figures-pressio.js";

/** Paliers d'un essai : 4 colonnes (p, V15, V30, V60), 3 (p, V30, V60) ou 2 (p, V60). */
function lirePaliers(texte) {
  return lireTableau(texte).map((r) => (r.length >= 4 ? { p: r[0], V15: r[1], V30: r[2], V60: r[3] }
    : r.length === 3 ? { p: r[0], V30: r[1], V60: r[2] } : { p: r[0], V60: r[1] }))
    .filter((q) => Number.isFinite(q.V60));
}

// ── L'essai d'exemple choisi remplit les champs ──────────────────────────
const CHAMPS_CONTEXTE = { psZ: "z", psHc: "hc", psZw: "zw", psGam: "gamma", psGsat: "gammaSat", psK0: "K0" };
function chargerExemple() {
  const cle = el("psExemple").value;
  const ex = ESSAIS[cle];
  if (!ex) return;
  for (const [id, k] of Object.entries(CHAMPS_CONTEXTE)) el(id).value = String(ex.contexte[k]);
  el("psNature").value = ex.contexte.nature;
  el("psTube").value = texteCouples(TUBE);
  el("psAir").value = texteCouples(AIR);
  el("psReleves").value = texteReleves(ex.paliers());
  el("psPmin").value = String(SONDE.pminTube);
  el("psDi").value = String(SONDE.di);
  el("psLs").value = String(SONDE.ls);
  el("psDz").value = String(SONDE.dzAir);
  el("psVsImp").value = "";
  el("psAuto").value = "auto";
}
chargerExemple();
el("psExemple").addEventListener("change", () => { chargerExemple(); majAssistant(); });
// Toucher aux données fait passer en saisie libre (les valeurs restent).
for (const id of ["psTube", "psAir", "psReleves", ...Object.keys(CHAMPS_CONTEXTE), "psPmin", "psDi", "psLs", "psDz", "psVsImp"]) {
  el(id).addEventListener("input", () => { el("psExemple").value = "saisie"; });
}

// ── L'assistant ──────────────────────────────────────────────────────────
const majAssistant = garde("psOut8", () => {
  const z = num("psZ"), hc = num("psHc", 0), zw = num("psZw", Infinity), g = num("psGam", 18), gs = num("psGsat", g), K0 = num("psK0", 0.5);
  const convention = el("psConv").value;
  el("psSchema").innerHTML = schemaPressio({ z: z > 0 ? z : 6, hc: hc >= 0 ? hc : 1, zw: Number.isFinite(zw) ? zw : 99 });

  // Étape 1 : tube.
  const ptsTube = lireTableau(el("psTube").value).filter((r) => r.length >= 2).map(([p, V]) => ({ p, V }));
  const tube = P.calibrageAppareil(ptsTube, { pmin: num("psPmin", null), di: num("psDi", null), ls: num("psLs", null) });
  const VsImp = num("psVsImp");
  const Vs = VsImp > 0 ? VsImp : tube.Vs > 0 ? tube.Vs : 535;
  const a = tube.applicable ? tube.a : 0;
  el("psFigTube").innerHTML = ptsTube.length >= 2 ? figureTube(ptsTube, tube) : "";
  el("psOut1").innerHTML = tube.applicable
    ? `a = <strong>${fd(tube.a, 3)} cm³/MPa</strong> ${verdict(tube.a < 6, "< 6 cm³/MPa", "≥ 6 cm³/MPa : tubulures à vérifier")}
       · V<sub>c</sub> = ${fd(tube.Vc, 2)} cm³ <small>(droite sur ${tube.points} paliers, R² = ${fd(tube.r2, 4)})</small><br>
       ${tube.Vtube ? `V<sub>s</sub> = π d<sub>i</sub>² l<sub>s</sub>/4 − V<sub>c</sub> = ${fd(tube.Vtube, 2)} − ${fd(tube.Vc, 2)} = <strong>${fd(tube.Vs, 2)} cm³</strong>` : ""}
       ${VsImp > 0 ? `<br>V<sub>s</sub> imposé : <strong>${fd(VsImp, 1)} cm³</strong>` : ""}`
    : `${esc(tube.motif ?? "Saisir les lectures en tube.")} Sans dilatation connue, a = 0.`;

  // Étape 2 : air.
  const ptsAir = lireTableau(el("psAir").value).filter((r) => r.length >= 2).map(([p, V]) => ({ p, V }));
  const air = P.etalonnageSonde(ptsAir, { dz: num("psDz", 0), Vs, gammaW: P.CONVENTIONS[convention].gammaW });
  const pe = air.applicable ? air.pe : () => 0;
  el("psFigAir").innerHTML = air.applicable ? figureAir(air, Vs) : "";
  el("psOut2").innerHTML = air.applicable
    ? `p<sub>e</sub> = p<sub>r</sub> + γ<sub>w</sub>·Δz, interpolée entre ${air.table.length} points ;
       p<sub>el</sub> = p<sub>e</sub>(1,2 V<sub>s</sub> = ${fd(1.2 * Vs, 0)} cm³) = <strong>${fd(air.pel, 3)} MPa</strong>
       ${air.Vmax < 1.2 * Vs ? `<br><span class="verdict ko">étalonnage trop court</span> <small>il s'arrête à ${fd(air.Vmax, 0)} cm³ : p<sub>e</sub> est extrapolée au-delà</small>` : ""}`
    : "Saisir l'étalonnage à l'air libre (sans lui, p<sub>e</sub> = 0).";

  // Étapes 3 à 8.
  const paliers = lirePaliers(el("psReleves").value);
  const manuel = el("psAuto").value === "manuel";
  const choix = manuel ? { i1: Math.round(num("psI1")) - 1, i2: Math.round(num("psI2")) - 1 } : {};
  const r = P.depouiller({ paliers, Vs, z, hc, pe, a, sol: { zw, gamma: g, gammaSat: gs, K0 }, choix, pel: air.pel, convention });
  if (!r.applicable) {
    for (const id of ["psFigCorr", "psFigCourbe", "psFigFluage", "psFigInverse"]) el(id).innerHTML = "";
    for (const id of ["psOut3", "psOut5", "psOut7"]) el(id).innerHTML = "";
    el("psOut8").innerHTML = `<p class="final-result">${verdict(false, "", "dépouillement impossible")} ${esc(r.motif)}</p>`;
    return;
  }
  if (!manuel) { el("psI1").value = String(r.phase.i1 + 1); el("psI2").value = String(r.phase.i2 + 1); }
  const brut = new Map(paliers.map((q, i) => [i + 1, q.V60]));
  const c = r.courbe, pt = P.pentes(c);

  // Étapes 3 et 4 : table des corrections.
  el("psFigCorr").innerHTML = figureCorrections(paliers, c);
  el("psOut3").innerHTML = `
    <p class="method-note">p<sub>h</sub> = γ<sub>w</sub> (h<sub>c</sub> + z) = ${f(P.CONVENTIONS[convention].gammaW, 3)} × ${fd(hc + z, 2)} / 1000 = <strong>${fd(c[0].ph, 4)} MPa</strong>
      · a = ${fd(a, 3)} cm³/MPa · V<sub>s</sub> = ${fd(Vs, 1)} cm³ · conventions : ${esc(P.CONVENTIONS[convention].nom)}</p>
    <div class="table-large"><table class="resultats"><thead><tr><th>n°</th><th class="num">p<sub>r</sub></th><th class="num">V<sub>60</sub> lu</th>
      <th class="num">p<sub>e</sub></th><th class="num">p corrigée</th><th class="num">V corrigé</th><th class="num">ΔV<sub>60/30</sub></th><th class="num">ΔV/Δp</th></tr></thead><tbody>
      ${c.map((q, i) => `<tr${i >= r.phase.i1 && i <= r.phase.i2 ? ' class="ligne-retenue"' : ""}><td>${q.n}</td><td class="n">${fd(q.pr, 3)}</td><td class="n">${fd(brut.get(q.n), 1)}</td>
        <td class="n">${fd(q.pe, 4)}</td><td class="n">${fd(q.p, 4)}</td><td class="n">${fd(q.V, 1)}</td><td class="n">${Number.isFinite(q.fluage) ? fd(q.fluage, 1) : "—"}</td>
        <td class="n">${i ? f(pt[i - 1], 4) : ""}</td></tr>`).join("")}
    </tbody></table></div>
    <p class="method-note">Pressions en MPa, volumes en cm³, pentes en cm³/MPa. En vert, la plage retenue pour E<sub>M</sub>.</p>`;

  // Étapes 5 et 6 : courbe, fluage, EM.
  el("psFigCourbe").innerHTML = figureCourbe(r, Vs) + figurePentes(r);
  el("psFigFluage").innerHTML = figureFluage(r);
  const ph = r.phase;
  el("psOut5").innerHTML = `
    <p class="final-result">E<sub>M</sub> = 2,66 × (V<sub>s</sub> + V<sub>m</sub>) × Δp/ΔV = 2,66 × (${fd(Vs, 1)} + ${fd(r.Vm, 1)}) × ${fd(ph.p2 - ph.p1, 4)}/${fd(ph.V2 - ph.V1, 1)}
      = <strong>${fd(r.EM, 2)} MPa</strong>
      <small>plage ${ph.auto ? "proposée" : "imposée"} : paliers ${ph.i1 + 1} à ${ph.i2 + 1} (${ph.nPoints} points), p<sub>1</sub> = ${fd(ph.p1, 3)} MPa, V<sub>1</sub> = ${fd(ph.V1, 1)} cm³,
      p<sub>2</sub> = ${fd(ph.p2, 3)} MPa, V<sub>2</sub> = ${fd(ph.V2, 1)} cm³ · G = E<sub>M</sub>/2,66 = ${fd(r.G, 2)} MPa</small></p>
    <p class="final-result">p<sub>f</sub> = <strong>${fd(r.pf, 3)} MPa</strong> <small>${esc(r.fluage.methode)}${r.fluage.pfi ? ` (cassure à ${fd(r.fluage.pfi, 3)} MPa)` : ""}${r.fluage.motif ? " — " + esc(r.fluage.motif) : ""}</small>
      ${ph.nPoints < 3 ? `<br>${verdict(false, "", "moins de trois paliers dans la plage")}` : ""}
      ${ph.p2 > r.pf + 1e-9 ? `<br>${verdict(false, "", "p2 dépasse pf")}` : ""}</p>`;

  // Étape 7 : pl.
  const lim = r.limite;
  el("psFigInverse").innerHTML = figureInverse(r) + figureHyperbole(r);
  const ligneMethode = (nom, m) => (m?.applicable ? `<tr><td>${nom}</td><td class="n">${fd(m.pl, 3)} MPa</td><td class="motif">R² = ${fd(m.r2, 4)}</td></tr>` : "");
  el("psOut7").innerHTML = `
    <p class="final-result">V<sub>l</sub> = V<sub>s</sub> + 2 V<sub>1</sub> = ${fd(Vs, 1)} + 2 × ${fd(ph.V1, 1)} = ${fd(lim.Vl, 1)} cm³ ·
      ${lim.applicable ? `p<sub>l</sub> = <strong>${fd(lim.pl, 3)} MPa</strong> <small>${esc(lim.methode)}${lim.entre ? ` entre les paliers ${lim.entre[0]} et ${lim.entre[1]}` : ""}</small>`
        : `${verdict(false, "", "p<sub>l</sub> non déterminée")} <small>${esc(lim.motif)}</small>`}</p>
    ${lim.extrapolee ? `<table class="resultats"><thead><tr><th>Extrapolation (paliers ${lim.points.join(", ")})</th><th class="num">p<sub>l</sub></th><th>Ajustement</th></tr></thead><tbody>
      ${ligneMethode("inverse du volume", lim.inverse)}${ligneMethode("hyperbole", lim.hyperbole)}
      ${lim.ecart !== null && lim.ecart !== undefined ? `<tr><td>écart entre les deux</td><td class="n">${fd(100 * lim.ecart, 1)} %</td><td class="motif">${verdict(lim.ecart <= 0.2, "≤ 20 %", "> 20 %")}</td></tr>` : ""}
    </tbody></table>` : ""}`;

  // Étape 8 : pressions nettes, classement, avertissements.
  const nature = el("psNature").value;
  const al = Number.isFinite(r.plNette) && r.plNette > 0 ? alphaMenard(nature, r.EM, r.plNette) : null;
  el("psOut8").innerHTML = `
    <table class="resultats"><thead><tr><th>Grandeur</th><th class="num">Valeur</th></tr></thead><tbody>
      <tr><td>σ<sub>v0</sub> · u<sub>0</sub> · σ'<sub>v0</sub></td><td class="n">${f(r.contraintes.sigmaV, 4)} · ${f(r.contraintes.u, 3)} · ${f(r.contraintes.sigmaVeff, 4)} kPa</td></tr>
      <tr><td>p<sub>0</sub> = K<sub>0</sub> σ'<sub>v0</sub> + u<sub>0</sub></td><td class="n">${fd(r.p0 * 1000, 1)} kPa</td></tr>
      <tr><td><strong>E<sub>M</sub></strong></td><td class="n"><strong>${fd(r.EM, 2)} MPa</strong></td></tr>
      <tr><td><strong>p<sub>f</sub>* = p<sub>f</sub> − p<sub>0</sub></strong></td><td class="n"><strong>${fd(r.pfNette, 3)} MPa</strong></td></tr>
      <tr><td><strong>p<sub>l</sub>* = p<sub>l</sub> − p<sub>0</sub></strong></td><td class="n"><strong>${Number.isFinite(r.plNette) ? fd(r.plNette, 3) + " MPa" : "—"}</strong></td></tr>
      <tr><td>E<sub>M</sub>/p<sub>l</sub>* · p<sub>l</sub>/p<sub>f</sub></td><td class="n">${fd(r.rapport, 2)} · ${fd(r.rapportLimFluage, 2)}</td></tr>
      ${al ? `<tr><td>État du sol (${esc(nature)}) · α</td><td class="n">${esc(al.etat)} · α = ${fd(al.alpha, 2)}${al.dansTableau ? "" : " <small>rapport sous les tableaux</small>"}</td></tr>` : ""}
    </tbody></table>
    ${r.avertissements.length ? `<p class="method-note"><strong>À vérifier :</strong> ${r.avertissements.map(esc).join(" ; ")}.</p>` : `<p class="method-note">Aucune anomalie relevée par les contrôles automatiques.</p>`}`;
});

// Imposer un palier fait passer la plage en mode manuel (avant le recalcul).
for (const id of ["psI1", "psI2"]) el(id).addEventListener("input", () => { el("psAuto").value = "manuel"; majAssistant(); });
brancher(["psConv", "psZ", "psHc", "psZw", "psGam", "psGsat", "psK0", "psNature", "psTube", "psPmin", "psDi", "psLs", "psVsImp",
  "psAir", "psDz", "psReleves", "psAuto"], majAssistant);

// ── Le sondage complet ───────────────────────────────────────────────────
const majProfil = garde("psOutProfil", () => {
  const s = sondage(el("psSite").value);
  const { pe, a, Vs } = etalonnagesExemple();
  const convention = el("psConv").value;
  const res = s.essais.map((e) => {
    const r = P.depouiller({ paliers: e.paliers, Vs, z: e.z, hc: 1, pe, a, sol: { zw: s.zw, couches: s.poids, K0: 0.5 }, convention });
    const al = r.applicable && r.plNette > 0 ? alphaMenard(e.nature, r.EM, r.plNette) : null;
    return { ...e, r, al };
  });
  const essais = res.filter((e) => e.r.applicable).map((e) => ({ z: e.z, EM: e.r.EM, plNette: e.r.plNette, pfNette: e.r.pfNette }));
  const B = num("psSemB"), D = num("psSemD");
  let bande = [], ple = null;
  const pts = essais.filter((e) => e.plNette > 0).map((e) => ({ z: e.z, v: e.plNette }));
  if (B > 0 && D >= 0 && pts.length >= 2) {
    ple = pleF62({ profil: profilPoints(pts, { log: true }), D, B });
    bande = [{ z0: ple.z0, z1: ple.z1, libelle: `D à D + 1,5 B` }];
  }
  const seuils = s.couches.map((c) => ({ z0: c.z0, z1: c.z1, valeurs: c.nature === "argile" ? [9, 16] : c.nature === "limon" ? [8, 14] : c.nature === "grave" ? [6, 10] : [7, 12] }));
  el("psFigProfil").innerHTML = profilPressio({ couches: s.couches, essais, seuils, bandes: bande, largeur: 640, hauteur: 480 });
  el("psOutProfil").innerHTML = `
    ${ple ? `<p class="final-result">Semelle B = ${fd(B, 2)} m à D = ${fd(D, 2)} m : p<sub>le</sub>* = moyenne géométrique de p<sub>l</sub>* entre ${fd(ple.z0, 2)} et ${fd(ple.z1, 2)} m
      = <strong>${fd(ple.ple, 3)} MPa</strong> <small>interpolation entre les essais en échelle logarithmique ; c'est la valeur qu'utilise le chapitre 6.</small></p>` : ""}
    <div class="table-large"><table class="resultats"><thead><tr><th>z (m)</th><th>Couche</th><th class="num">E<sub>M</sub></th><th class="num">p<sub>f</sub>*</th>
      <th class="num">p<sub>l</sub>*</th><th class="num">E<sub>M</sub>/p<sub>l</sub>*</th><th>État · α</th><th>p<sub>l</sub></th></tr></thead><tbody>
      ${res.map((e) => (e.r.applicable ? `<tr><td>${fd(e.z, 1)}</td><td class="motif">${esc(e.couche)}</td><td class="n">${fd(e.r.EM, 1)}</td><td class="n">${fd(e.r.pfNette, 2)}</td>
        <td class="n">${fd(e.r.plNette, 2)}</td><td class="n">${fd(e.r.rapport, 1)}</td><td class="motif">${e.al ? `${esc(e.al.etat)} · ${fd(e.al.alpha, 2)}` : "—"}</td>
        <td class="motif">${e.r.limite.extrapolee ? "extrapolée" : "lue"}${e.r.avertissements.length ? ` <span title="${esc(e.r.avertissements.join(" ; "))}">⚠</span>` : ""}</td></tr>`
        : `<tr><td>${fd(e.z, 1)}</td><td class="motif">${esc(e.couche)}</td><td colspan="6" class="motif">${esc(e.r.motif)}</td></tr>`)).join("")}
    </tbody></table></div>
    <p class="method-note">E<sub>M</sub>, p<sub>f</sub>* et p<sub>l</sub>* en MPa. Chaque essai du sondage a été dépouillé par l'assistant ci-dessus, avec les étalonnages de la sonde d'exemple ; ⚠ signale un essai que les contrôles automatiques invitent à relire.</p>`;
});
brancher(["psSite", "psSemB", "psSemD", "psConv"], majProfil);

// ── p0 et pl* d'un essai isolé ───────────────────────────────────────────
const majPl = garde("plOut", () => {
  const z = num("plZ"), pl = num("plMes") * 1000, g = num("plGamma"), zw = num("plNappe"), gs = num("plGsat"), K0 = num("plK0");
  if (!(z > 0 && pl > 0 && g > 0)) { el("plOut").textContent = "Renseigner z, pl et γ."; return; }
  const hSec = Math.min(z, Math.max(zw, 0)), hSat = Math.max(0, z - Math.max(zw, 0));
  const sv = g * hSec + gs * hSat;
  const u = 10 * hSat;
  const { p0, plNette } = pressionNette({ pl, sigmaV0eff: sv - u, u, K0 });
  el("plOut").innerHTML =
    `σv0 = ${f(sv, 4)} kPa · u = ${f(u, 3)} kPa · σ'v0 = ${f(sv - u, 4)} kPa<br>
     p0 = u + K0 σ'v0 = <strong>${f(p0, 3)} kPa</strong> →
     pl* = pl − p0 = <strong>${fd(plNette / 1000, 3)} MPa</strong>
     <small>p0 représente ${f((100 * p0) / pl, 2)} % de la pression limite mesurée.</small>`;
});
brancher(["plZ", "plMes", "plGamma", "plNappe", "plGsat", "plK0"], majPl);

// ── État du sol et coefficient rhéologique α ─────────────────────────────
const FRACTION = [[1, "1"], [2 / 3, "2/3"], [1 / 2, "1/2"], [1 / 3, "1/3"], [1 / 4, "1/4"]];
const majAlpha = garde("alOut", () => {
  const nature = el("alNature").value, EM = num("alEM"), pl = num("alPl");
  if (!(EM > 0 && pl > 0)) { el("alOut").textContent = "Renseigner EM et pl*."; return; }
  const a = alphaMenard(nature, EM, pl);
  const txt = FRACTION.find(([v]) => Math.abs(v - a.alpha) < 1e-9)?.[1] ?? fd(a.alpha, 2);
  el("alOut").innerHTML = `EM/pl* = ${fd(a.rapport, 1)} → sol ${a.etat}, <strong>α = ${txt}</strong>
    ${a.dansTableau ? "" : "<small>Rapport sous la plus petite ligne du tableau : sol probablement remanié, ou forage de mauvaise qualité — à examiner avant de s'en servir.</small>"}`;
});
brancher(["alNature", "alEM", "alPl"], majAlpha);
