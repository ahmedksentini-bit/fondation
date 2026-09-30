// Calculateurs du chapitre 2 : les essais en place autres que le pressiomètre.
// Chaque calculateur part des lectures de chantier et montre, sur une figure,
// ce que le dépouillement en tire.
import { el, num, f, fd, esc, verdict, brancher, garde, lireTableau } from "./ui.js";
import { graphe, profilsVerticaux, figureCarotte, echantillon, COULEURS } from "./figures.js";
import * as E from "./geotech/essais.js";
import { cptuExemple, pompageExemple } from "./essais-exemples.js";

const GAMMA_W = 9.81;
/** Écriture scientifique lisible : 6,1·10⁻⁶. */
const sci = (x, c = 2) => {
  if (!Number.isFinite(x) || x <= 0) return "—";
  const n = Math.floor(Math.log10(x)), m = x / 10 ** n;
  const exp = String(n).replace("-", "⁻").replace(/\d/g, (d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[d]);
  return `${f(m, c)}·10${exp}`;
};
/** Durée en unité parlante. */
const duree = (s) => (s < 120 ? `${f(s, 3)} s` : s < 7200 ? `${f(s / 60, 3)} min` : s < 172800 ? `${f(s / 3600, 3)} h` : `${f(s / 86400, 3)} jours`);
/** Ordre de grandeur de la perméabilité. */
const natureK = (k) => (k > 1e-3 ? "graves propres" : k > 1e-5 ? "sables" : k > 1e-7 ? "sables fins, limons" : k > 1e-9 ? "limons argileux, argiles fissurées" : "argiles");

// ── RQD ──────────────────────────────────────────────────────────────────
const majRqd = garde("esRqdOut", () => {
  const morceaux = lireTableau(el("esRqdMorceaux").value.replace(/\n/g, " ")).flat().filter((x) => x > 0);
  const L = num("esRqdL");
  const somme = morceaux.reduce((s, x) => s + x, 0);
  if (!(L > 0) || !morceaux.length) { el("esRqdOut").textContent = "Saisir les morceaux et la longueur de la passe."; el("esRqdFig").innerHTML = ""; return; }
  if (somme > L + 1e-9) { el("esRqdOut").innerHTML = `${verdict(false, "", "morceaux plus longs que la passe")} <small>${f(somme, 4)} cm pour ${f(L, 4)} cm</small>`; return; }
  const r = E.rqd(morceaux, L);
  el("esRqdFig").innerHTML = figureCarotte(morceaux, L);
  el("esRqdOut").innerHTML = `RQD = Σ(morceaux ≥ 10 cm)/L = ${f(morceaux.filter((x) => x >= 10).reduce((s, x) => s + x, 0), 4)}/${f(L, 4)} = <strong>${fd(r.RQD, 0)} %</strong> → qualité <strong>${esc(r.qualite)}</strong>
    <small>taux de récupération ${fd(r.recuperation, 0)} % ; RQD : &lt; 25 % très mauvaise, 25–50 mauvaise, 50–75 moyenne, 75–90 bonne, &gt; 90 excellente</small>`;
});
brancher(["esRqdMorceaux", "esRqdL"], majRqd);

// ── Piézomètre ───────────────────────────────────────────────────────────
const majPz = garde("esPzOut", () => {
  const d = num("esPzD") / 1000, L = num("esPzL"), D = num("esPzF") / 1000, k = num("esPzK");
  if (!(d > 0 && L > 0 && D > 0 && k > 0)) { el("esPzOut").textContent = "Renseigner le tube, la crépine, le forage et k."; el("esPzFig").innerHTML = ""; return; }
  const r = E.tempsReponsePiezometre({ dTube: d, L, D, k });
  const cas = [{ k: k * 100, couleur: COULEURS.cyan }, { k, couleur: COULEURS.bleu, epaisseur: 2.8 }, { k: k / 100, couleur: COULEURS.f62 }];
  const t0 = r.T0 / 1000, t1 = r.T0 * 1000;
  const series = cas.map((c) => {
    const T0 = r.A / (r.F * c.k);
    const pts = [];
    for (let i = 0; i <= 80; i++) { const t = t0 * (t1 / t0) ** (i / 80); pts.push([t / 3600, 100 * Math.exp(-t / T0)]); }
    return { points: pts, couleur: c.couleur, epaisseur: c.epaisseur ?? 1.8, libelle: `k = ${sci(c.k, 1)} m/s` };
  });
  el("esPzFig").innerHTML = graphe({
    largeur: 560, hauteur: 250, xmin: t0 / 3600, xmax: t1 / 3600, ymin: 0, ymax: 100, logX: true,
    xlabel: "temps (h, échelle logarithmique)", ylabel: "écart restant (%)", series,
    marques: [{ x: r.t90 / 3600, y: 10, couleur: COULEURS.bleu, guides: true, libelle: "90 % du retard résorbé" }],
  });
  el("esPzOut").innerHTML = `F = 2πL/ln[L/D + √(1 + (L/D)²)] = ${fd(r.F, 2)} m · T<sub>0</sub> = A/(F·k) = <strong>${duree(r.T0)}</strong>
    · 90 % du retard résorbé en <strong>${duree(r.t90)}</strong>
    <small>${r.t90 > 86400 ? "trop lent pour suivre une nappe qui varie : un piézomètre fermé s'impose" : "le tube ouvert suit correctement la nappe"}</small>`;
});
brancher(["esPzD", "esPzL", "esPzF", "esPzK"], majPz);

// ── Abaque de Robertson ──────────────────────────────────────────────────
const ZONES_COULEURS = { 2: "#7c3aed", 3: "#0369a1", 4: "#0891b2", 5: "#65a30d", 6: "#ca8a04", 7: "#c2410c" };
/** Abaque Qt–Fr : limites de zones à Ic constant, et les mesures données. */
function abaqueRobertson(points, { largeur = 560, hauteur = 360 } = {}) {
  const arc = (Ic) => {
    const pts = [];
    for (let i = 0; i <= 60; i++) {
      const t = (i / 60) * (Math.PI / 2);
      pts.push([10 ** (-1.22 + Ic * Math.sin(t)), 10 ** (3.47 - Ic * Math.cos(t))]);
    }
    return pts;
  };
  const limites = [1.31, 2.05, 2.6, 2.95, 3.6];
  // Étiquettes au milieu de chaque bande, à un angle qui les garde dans l'abaque.
  const libelles = [
    { Ic: 1.0, texte: "7 · sable dense", t: 0.4 }, { Ic: 1.68, texte: "6 · sable", t: 0.5 }, { Ic: 2.33, texte: "5 · sable limoneux", t: 0.55 },
    { Ic: 2.78, texte: "4 · limon", t: 0.62 }, { Ic: 3.28, texte: "3 · argile", t: 0.6 }, { Ic: 3.9, texte: "2 · organique", t: 0.53 },
  ];
  return graphe({
    largeur, hauteur, xmin: 0.1, xmax: 10, ymin: 1, ymax: 1000, logX: true, logY: true, legende: false,
    xlabel: "rapport de frottement normalisé Fr (%)", ylabel: "résistance normalisée Qt",
    series: [
      ...limites.map((Ic) => ({ points: arc(Ic), couleur: COULEURS.discret, epaisseur: 1, tirets: "5 3" })),
      ...(points.length ? [{ points: points.map((p) => [p.Fr, p.Qt]), couleurs: points.map((p) => ZONES_COULEURS[p.zone] ?? COULEURS.trait), nuage: true, rayon: points.length > 1 ? 3 : 5.5, couleur: COULEURS.effort }] : []),
    ],
    textes: libelles.map((l) => ({ x: 10 ** (-1.22 + l.Ic * Math.sin(l.t)), y: 10 ** (3.47 - l.Ic * Math.cos(l.t)), texte: l.texte, couleur: ZONES_COULEURS[l.texte[0]], taille: 10.5 })),
  });
}

// ── CPTU : une mesure ────────────────────────────────────────────────────
function contraintes(z, gamma, zw) {
  const sv = gamma * z, u0 = GAMMA_W * Math.max(0, z - zw);
  return { sv, u0, sve: sv - u0 };
}
const majCpt = garde("esCptOut", () => {
  const z = num("esCptZ"), qc = num("esCptQc"), fs = num("esCptFs"), u2 = num("esCptU2"), a = num("esCptA", 0.8), g = num("esCptG", 18), zw = num("esCptZw", 0), Nkt = num("esCptNkt", 14);
  if (!(z > 0 && qc > 0 && fs >= 0)) { el("esCptOut").textContent = "Renseigner z, qc et fs."; return; }
  const c = contraintes(z, g, zw);
  const r = E.cptu({ qc, fs, u2, a, sigmaV0: c.sv, u0: c.u0, sigmaV0eff: c.sve });
  if (!r.applicable) { el("esCptOut").innerHTML = verdict(false, "", r.motif); el("esCptFig").innerHTML = ""; return; }
  el("esCptFig").innerHTML = abaqueRobertson([r]);
  const cu = r.Ic > 2.6 ? E.cuCPTU({ qt: r.qt, sigmaV0: c.sv, Nkt }) : null;
  el("esCptOut").innerHTML = `
    <table class="resultats"><thead><tr><th>Grandeur</th><th class="num">Valeur</th></tr></thead><tbody>
      <tr><td>σ<sub>v0</sub> · u<sub>0</sub> · σ'<sub>v0</sub></td><td class="n">${f(c.sv, 4)} · ${f(c.u0, 3)} · ${f(c.sve, 4)} kPa</td></tr>
      <tr><td>q<sub>t</sub> = q<sub>c</sub> + (1 − a) u<sub>2</sub></td><td class="n">${f(r.qt, 5)} kPa</td></tr>
      <tr><td>R<sub>f</sub> = f<sub>s</sub>/q<sub>c</sub> · F<sub>r</sub></td><td class="n">${fd(r.Rf, 2)} % · ${fd(r.Fr, 2)} %</td></tr>
      <tr><td>Q<sub>t</sub> · B<sub>q</sub></td><td class="n">${fd(r.Qt, 1)} · ${fd(r.Bq, 3)}</td></tr>
      <tr><td><strong>I<sub>c</sub></strong></td><td class="n"><strong>${fd(r.Ic, 2)}</strong> — zone ${r.zone} : ${esc(r.nomZone)}</td></tr>
      ${cu ? `<tr><td>c<sub>u</sub> = (q<sub>t</sub> − σ<sub>v0</sub>)/N<sub>kt</sub></td><td class="n">${f(cu, 3)} kPa</td></tr>` : ""}
    </tbody></table>`;
});
brancher(["esCptZ", "esCptQc", "esCptFs", "esCptU2", "esCptA", "esCptG", "esCptZw", "esCptNkt"], majCpt);

// ── CPTU : un sondage ────────────────────────────────────────────────────
el("esCpuDonnees").value = cptuExemple();
const NOMS_ZONES = Object.fromEntries(E.ZONES_IC.map((z) => [z.zone, z.nom]));
const majCpu = garde("esCpuOut", () => {
  const g = num("esCpuG", 18.5), zw = num("esCpuZw", 0), a = num("esCpuA", 0.8);
  const mesures = lireTableau(el("esCpuDonnees").value).filter((r) => r.length >= 3 && r[0] > 0 && r[1] > 0);
  if (mesures.length < 3) { el("esCpuOut").textContent = "Coller au moins trois mesures z, qc, fs, u2."; el("esCpuProfil").innerHTML = el("esCpuAbaque").innerHTML = ""; return; }
  const res = mesures.map(([z, qc, fs, u2]) => {
    const c = contraintes(z, g, zw);
    return { z, qc, fs, u2: Number.isFinite(u2) ? u2 : null, u0: c.u0, ...E.cptu({ qc, fs, u2: Number.isFinite(u2) ? u2 : null, a, sigmaV0: c.sv, u0: c.u0, sigmaV0eff: c.sve }) };
  }).filter((r) => r.applicable);
  const zMax = Math.ceil(Math.max(...res.map((r) => r.z)));
  const qcMax = Math.max(...res.map((r) => r.qc)) * 1.08;
  const uMax = Math.max(100, ...res.map((r) => r.u2 ?? 0)) * 1.1;
  const bandesIc = [[1, 1.31, 7], [1.31, 2.05, 6], [2.05, 2.6, 5], [2.6, 2.95, 4], [2.95, 3.6, 3], [3.6, 4, 2]]
    .map(([v0, v1, zn]) => ({ v0, v1, couleur: ZONES_COULEURS[zn], opacite: 0.12, libelle: String(zn) }));
  el("esCpuProfil").innerHTML = profilsVerticaux({
    zMax, zw, largeur: 640, hauteur: 460,
    panneaux: [
      { titre: "qc (MPa)", min: 0, max: qcMax, series: [{ points: res.map((r) => [r.qc, r.z]), couleur: COULEURS.trait }] },
      { titre: "Rf (%)", min: 0, max: 8, series: [{ points: res.map((r) => [r.Rf, r.z]), couleur: COULEURS.f62 }] },
      { titre: "u2 et u0 (kPa)", min: 0, max: uMax, series: [{ points: res.filter((r) => r.u2 !== null).map((r) => [r.u2, r.z]), couleur: COULEURS.bleu }, { points: res.map((r) => [r.u0, r.z]), couleur: COULEURS.discret, tirets: "5 4" }] },
      { titre: "Ic et zones", min: 1, max: 4, bandes: bandesIc, series: [{ points: res.map((r) => [Math.min(Math.max(r.Ic, 1), 4), r.z]), couleur: COULEURS.encre, epaisseur: 1.6 }] },
    ],
  });
  el("esCpuAbaque").innerHTML = abaqueRobertson(res);
  // Couches de comportement : mesures consécutives de même zone (au moins 40 cm).
  const couches = [];
  for (const r of res) {
    const der = couches[couches.length - 1];
    if (der && der.zone === r.zone) { der.z1 = r.z; der.pts.push(r); } else couches.push({ zone: r.zone, z0: r.z, z1: r.z, pts: [r] });
  }
  const lignes = couches.filter((c) => c.pts.length >= 2).map((c) => {
    const moy = (k) => c.pts.reduce((s, p) => s + p[k], 0) / c.pts.length;
    return `<tr><td>${fd(c.z0, 1)} – ${fd(c.z1, 1)} m</td><td class="motif">${c.zone} · ${esc(NOMS_ZONES[c.zone])}</td><td class="n">${fd(moy("qc"), 2)}</td><td class="n">${fd(moy("Rf"), 1)}</td><td class="n">${fd(moy("Ic"), 2)}</td></tr>`;
  });
  el("esCpuOut").innerHTML = `<div class="table-large"><table class="resultats"><thead><tr><th>Profondeur</th><th>Comportement</th><th class="num">q<sub>c</sub> moyen (MPa)</th><th class="num">R<sub>f</sub> moyen (%)</th><th class="num">I<sub>c</sub> moyen</th></tr></thead>
    <tbody>${lignes.join("")}</tbody></table></div>
    <p class="method-note">Les tronçons d'une seule mesure (lits minces, transitions) ne sont pas listés. Sur l'abaque, chaque mesure prend la couleur de sa zone.</p>`;
});
brancher(["esCpuDonnees", "esCpuG", "esCpuZw", "esCpuA"], majCpu);

// ── Pénétromètre dynamique ───────────────────────────────────────────────
const APPAREILS = { pdb: { M: 64, H: 0.75, A: 20, Mt: 6, Me: 18 }, pda: { M: 64, H: 0.75, A: 30, Mt: 6.5, Me: 20 }, leger: { M: 10, H: 0.5, A: 10, Mt: 2.9, Me: 4 } };
el("esDpApp").addEventListener("change", () => {
  const a = APPAREILS[el("esDpApp").value];
  if (a) { el("esDpM").value = a.M; el("esDpH").value = a.H; el("esDpA").value = a.A; el("esDpMt").value = a.Mt; el("esDpMe").value = a.Me; }
});
for (const id of ["esDpM", "esDpH", "esDpA", "esDpMt", "esDpMe"]) el(id).addEventListener("input", () => { el("esDpApp").value = "libre"; });
const majDp = garde("esDpOut", () => {
  const M = num("esDpM"), H = num("esDpH"), A = num("esDpA"), Mt = num("esDpMt", 0), Me = num("esDpMe", 0), z = num("esDpZ", 0), N = num("esDpN");
  const Mp = Mt * z + Me;
  const r = E.qdHollandais({ M, Mp, H, Acm2: A, N });
  if (!r.applicable) { el("esDpOut").innerHTML = verdict(false, "", r.motif); el("esDpFig").innerHTML = ""; return; }
  const courbe = (Mpx) => echantillon((n) => E.qdHollandais({ M, Mp: Mpx, H, Acm2: A, N: n }).qd, 1, 50, 49);
  const qmax = E.qdHollandais({ M, Mp: Me, H, Acm2: A, N: 50 }).qd * 1.05;
  el("esDpFig").innerHTML = graphe({
    largeur: 560, hauteur: 250, xmin: 0, xmax: 50, ymin: 0, ymax: qmax, xlabel: "nombre de coups pour 10 cm", ylabel: "qd (MPa)",
    series: [
      { points: courbe(Me), couleur: COULEURS.discret, tirets: "5 4", libelle: "tiges courtes (près de la surface)" },
      { points: courbe(Mp), couleur: COULEURS.bleu, libelle: `à ${fd(z, 1)} m : masse frappée ${f(Mp, 3)} kg` },
    ],
    marques: [{ x: N, y: r.qd, couleur: COULEURS.rouge, guides: true, libelle: `qd = ${fd(r.qd, 2)} MPa` }],
  });
  el("esDpOut").innerHTML = `e = 10 cm/${f(N, 3)} = ${fd(1000 * r.e, 1)} mm par coup · M' = ${f(Mt, 3)} × ${fd(z, 1)} + ${f(Me, 3)} = ${f(Mp, 3)} kg<br>
    q<sub>d</sub> = M² g H / [(M + M') A e] = <strong>${fd(r.qd, 2)} MPa</strong>
    <small>seule une part M/(M + M') = ${f(100 * r.rendement, 3)} % de la quantité de mouvement passe au train de tiges : à nombre de coups égal, q<sub>d</sub> baisse avec la profondeur</small>`;
});
brancher(["esDpApp", "esDpM", "esDpH", "esDpA", "esDpMt", "esDpMe", "esDpZ", "esDpN"], majDp);

// ── SPT ──────────────────────────────────────────────────────────────────
const majSpt = garde("esSptOut", () => {
  const N = num("esSptN"), sv = num("esSptSv"), CE = num("esSptMouton", 0.75), Df = num("esSptDf", 115), L = num("esSptL", 10), CS = num("esSptCs", 1);
  const CB = E.SPT.diametre(Df), CR = E.SPT.tiges(L);
  const r = E.sptCorrige({ N, sigmaV0eff: sv, CE, CB, CR, CS });
  if (!r.applicable) { el("esSptOut").innerHTML = verdict(false, "", r.motif); el("esSptFig").innerHTML = ""; return; }
  const p = E.phiSPT({ N60: r.N60, N160: r.N160, sigmaV0eff: sv });
  const courbe = (fn) => echantillon(fn, 1, 60, 59);
  el("esSptFig").innerHTML = graphe({
    largeur: 560, hauteur: 260, xmin: 0, xmax: 60, ymin: 25, ymax: 50, xlabel: "N60", ylabel: "φ' (°)",
    series: [
      { points: courbe((n) => E.phiSPT({ N60: n, N160: n * r.CN, sigmaV0eff: sv }).wolff), couleur: COULEURS.f62, libelle: "Wolff (Peck et al.)" },
      { points: courbe((n) => E.phiSPT({ N60: n, N160: n * r.CN, sigmaV0eff: sv }).kulhawyMayne), couleur: COULEURS.bleu, libelle: "Kulhawy et Mayne" },
      { points: courbe((n) => E.phiSPT({ N60: n, N160: n * r.CN, sigmaV0eff: sv }).hatanakaUchida), couleur: COULEURS.violet, libelle: "Hatanaka et Uchida" },
    ],
    marques: [
      { x: r.N60, y: p.wolff, couleur: COULEURS.f62, rayon: 4 },
      { x: r.N60, y: p.kulhawyMayne, couleur: COULEURS.bleu, rayon: 4 },
      { x: r.N60, y: p.hatanakaUchida, couleur: COULEURS.violet, rayon: 4 },
    ],
  });
  const phis = [p.wolff, p.kulhawyMayne, p.hatanakaUchida];
  el("esSptOut").innerHTML = `
    <p class="final-result">N<sub>60</sub> = ${f(N, 3)} × ${fd(CE, 2)} × ${fd(CB, 2)} × ${fd(CR, 2)} × ${fd(CS, 2)} = <strong>${fd(r.N60, 1)}</strong>
      · C<sub>N</sub> = √(100/${f(sv, 3)}) = ${fd(r.CN, 2)} · (N<sub>1</sub>)<sub>60</sub> = <strong>${fd(r.N160, 1)}</strong>
      <small>C<sub>B</sub> d'après le diamètre du forage, C<sub>R</sub> d'après la longueur des tiges ; sable ${esc(E.compaciteSPT(N))}, D<sub>r</sub> ≈ √((N<sub>1</sub>)<sub>60</sub>/60) = ${fd(100 * E.drSPT(r.N160), 0)} %</small></p>
    <p class="final-result">φ' = ${fd(p.wolff, 1)}° (Wolff) · ${fd(p.kulhawyMayne, 1)}° (Kulhawy et Mayne) · ${fd(p.hatanakaUchida, 1)}° (Hatanaka et Uchida)
      <small>écart de ${fd(Math.max(...phis) - Math.min(...phis), 1)}° entre les corrélations : un angle tiré du SPT est un ordre de grandeur</small></p>`;
});
brancher(["esSptN", "esSptSv", "esSptMouton", "esSptDf", "esSptL", "esSptCs"], majSpt);

// ── Dilatomètre plat ─────────────────────────────────────────────────────
const majDmt = garde("esDmtOut", () => {
  const r = E.dmt({ A: num("esDmtA"), B: num("esDmtB"), dA: num("esDmtDa", 0), dB: num("esDmtDb", 0), u0: num("esDmtU0", 0), sigmaV0eff: num("esDmtSv") });
  if (!r.applicable) { el("esDmtOut").innerHTML = verdict(false, "", r.motif); el("esDmtFig").innerHTML = ""; return; }
  el("esDmtFig").innerHTML = graphe({
    largeur: 560, hauteur: 280, xmin: 0.1, xmax: 10, ymin: 0.2, ymax: 200, logX: true, logY: true, legende: false,
    xlabel: "indice de matériau ID", ylabel: "module dilatométrique ED (MPa)",
    zones: [
      { x0: 0.1, x1: 0.6, y0: 0.2, y1: 200, couleur: ZONES_COULEURS[3], opacite: 0.08, libelle: "argile", position: "gauche" },
      { x0: 0.6, x1: 1.8, y0: 0.2, y1: 200, couleur: ZONES_COULEURS[4], opacite: 0.08, libelle: "limon", position: "gauche" },
      { x0: 1.8, x1: 10, y0: 0.2, y1: 200, couleur: ZONES_COULEURS[6], opacite: 0.08, libelle: "sable", position: "gauche" },
    ],
    marques: [{ x: r.ID, y: r.ED, couleur: COULEURS.rouge, libelle: `ID = ${fd(r.ID, 2)} · ED = ${fd(r.ED, 1)} MPa` }],
  });
  const lignes = [
    ["p<sub>0</sub> = 1,05 (A + ΔA) − 0,05 (B − ΔB)", `${f(r.p0, 4)} kPa`], ["p<sub>1</sub> = B − ΔB", `${f(r.p1, 4)} kPa`],
    ["I<sub>D</sub> · K<sub>D</sub>", `${fd(r.ID, 2)} · ${fd(r.KD, 2)} → ${esc(r.sol)}`], ["E<sub>D</sub> = 34,7 (p<sub>1</sub> − p<sub>0</sub>)", `${fd(r.ED, 2)} MPa`],
    ["<strong>M = R<sub>M</sub> · E<sub>D</sub></strong>", `<strong>${fd(r.M, 1)} MPa</strong> (R<sub>M</sub> = ${fd(r.RM, 2)})`],
  ];
  if (r.K0 !== undefined) lignes.push(["K<sub>0</sub> · OCR · c<sub>u</sub>", `${fd(r.K0, 2)} · ${fd(r.OCR, 2)} · ${f(r.cu, 3)} kPa`]);
  if (r.phi !== undefined) lignes.push(["φ' (sable)", `${fd(r.phi, 1)}°`]);
  el("esDmtOut").innerHTML = `<table class="resultats"><thead><tr><th>Grandeur</th><th class="num">Valeur</th></tr></thead><tbody>
    ${lignes.map(([a, b]) => `<tr><td>${a}</td><td class="n">${b}</td></tr>`).join("")}</tbody></table>
    <p class="method-note">Corrélations de Marchetti : K<sub>0</sub>, OCR et c<sub>u</sub> pour I<sub>D</sub> &lt; 1,2 ; φ' pour I<sub>D</sub> &gt; 1,8 ; R<sub>M</sub> ne descend pas sous 0,85.</p>`;
});
brancher(["esDmtA", "esDmtB", "esDmtDa", "esDmtDb", "esDmtU0", "esDmtSv"], majDmt);

// ── Scissomètre ──────────────────────────────────────────────────────────
const majVst = garde("esVstOut", () => {
  const M = num("esVstM"), Mr = num("esVstMr"), D = num("esVstD"), H = num("esVstH"), Ip = num("esVstIp");
  const r = E.scissometre({ M, Mres: Mr, Dmm: D, Hmm: H, Ip });
  if (!r.applicable) { el("esVstOut").innerHTML = verdict(false, "", r.motif); el("esVstFig").innerHTML = ""; return; }
  // Courbe type couple–rotation : montée au pic vers 15°, puis décroissance vers le résiduel.
  const res = Mr > 0 ? Mr : 0.4 * M;
  const courbe = echantillon((t) => (t <= 15 ? M * Math.sqrt(t / 15) : res + (M - res) * Math.exp(-(t - 15) / 55)), 0, 360, 120);
  el("esVstFig").innerHTML = graphe({
    largeur: 560, hauteur: 230, xmin: 0, xmax: 360, ymin: 0, ymax: M * 1.2, xlabel: "rotation du moulinet (°)", ylabel: "couple (N·m)",
    series: [{ points: courbe, couleur: COULEURS.bleu, libelle: "allure du couple mesuré" }],
    marques: [{ x: 15, y: M, couleur: COULEURS.rouge, libelle: `pic : ${f(M, 3)} N·m → cu` }, ...(Mr > 0 ? [{ x: 330, y: Mr, couleur: COULEURS.f62, libelle: `résiduel : ${f(Mr, 3)} N·m → cr` }] : [])],
  });
  el("esVstOut").innerHTML = `K = πD²(H/2 + D/6) = ${f(r.K * 1e6, 4)} cm³ · c<sub>u</sub> = M/K = <strong>${f(r.cu, 3)} kPa</strong>
    ${r.cr ? `· c<sub>r</sub> = ${f(r.cr, 3)} kPa · sensibilité S<sub>t</sub> = ${fd(r.St, 1)}` : ""}
    ${r.mu ? `<br>μ (Bjerrum, I<sub>p</sub> = ${f(Ip, 3)} %) = ${fd(r.mu, 2)} → c<sub>u</sub> de calcul ≈ <strong>${f(r.cuCorrige, 3)} kPa</strong>` : ""}`;
});
brancher(["esVstM", "esVstMr", "esVstD", "esVstH", "esVstIp"], majVst);

// ── Droite de Coulomb ────────────────────────────────────────────────────
const majCoul = garde("esCoulOut", () => {
  const pts = lireTableau(el("esCoulPts").value).filter((r) => r.length >= 2).map(([sigma, tau]) => ({ sigma, tau }));
  const r = E.droiteCoulomb(pts);
  if (!r.applicable) { el("esCoulOut").innerHTML = verdict(false, "", r.motif); el("esCoulFig").innerHTML = ""; return; }
  const sMax = Math.max(...pts.map((p) => p.sigma)) * 1.15, tMax = Math.max(...pts.map((p) => p.tau), r.c) * 1.2;
  const t = Math.tan((r.phi * Math.PI) / 180);
  el("esCoulFig").innerHTML = graphe({
    largeur: 560, hauteur: 250, xmin: 0, xmax: sMax, ymin: 0, ymax: tMax, xlabel: "contrainte normale σ (kPa)", ylabel: "résistance au cisaillement τ (kPa)",
    series: [{ points: pts.map((p) => [p.sigma, p.tau]), couleur: COULEURS.trait, nuage: true, rayon: 4.5, libelle: "essais" },
      { points: [[0, r.c], [sMax, r.c + t * sMax]], couleur: COULEURS.rouge, tirets: "6 4", libelle: "τ = c + σ tanφ" }],
    marques: [{ x: 0, y: r.c, couleur: COULEURS.rouge, rayon: 4, libelle: `c = ${f(r.c, 3)} kPa` }],
  });
  el("esCoulOut").innerHTML = `Droite des moindres carrés : c = <strong>${f(r.c, 3)} kPa</strong> · φ = <strong>${fd(r.phi, 1)}°</strong>
    <small>au moins trois essais sous des contraintes normales encadrant celles de l'ouvrage</small>`;
});
brancher(["esCoulPts"], majCoul);

// ── Plaque ───────────────────────────────────────────────────────────────
const majPlq = garde("esPlqOut", () => {
  const z1 = num("esPlqZ1"), z2 = num("esPlqZ2");
  const r = E.plaqueEV({ z1, z2 });
  if (!r.applicable) { el("esPlqOut").innerHTML = verdict(false, "", r.motif); el("esPlqFig").innerHTML = ""; return; }
  // Allure des deux cycles : chargement concave, déchargement élastique, rechargement.
  const zr = Math.max(0, z1 - 0.9 * z2);
  const c1 = echantillon((p) => z1 * (p / 0.25) ** 0.75, 0, 0.25, 30);
  const d1 = echantillon((p) => zr + (z1 - zr) * (p / 0.25) ** 1.6, 0.25, 0, 20);
  const c2 = echantillon((p) => zr + z2 * (p / 0.2) ** 0.9, 0, 0.2, 25);
  el("esPlqFig").innerHTML = graphe({
    largeur: 560, hauteur: 250, xmin: 0, xmax: 0.28, ymin: 0, ymax: Math.max(z1, zr + z2) * 1.2, inverserY: true,
    xlabel: "pression sous la plaque (MPa)", ylabel: "enfoncement (mm)",
    series: [{ points: c1, couleur: COULEURS.bleu, libelle: "1er chargement" }, { points: d1, couleur: COULEURS.discret, tirets: "4 3", libelle: "déchargement" },
      { points: c2, couleur: COULEURS.rouge, libelle: "2e chargement" }],
    marques: [{ x: 0.25, y: z1, couleur: COULEURS.bleu, libelle: `z1 = ${fd(z1, 2)} mm` }, { x: 0.2, y: zr + z2, couleur: COULEURS.rouge, libelle: `2e cycle : z2 = ${fd(z2, 2)} mm` }],
  });
  el("esPlqOut").innerHTML = `E<sub>V1</sub> = 112,5/z<sub>1</sub> = <strong>${fd(r.EV1, 1)} MPa</strong> · E<sub>V2</sub> = 90/z<sub>2</sub> = <strong>${fd(r.EV2, 1)} MPa</strong>
    · k = E<sub>V2</sub>/E<sub>V1</sub> = <strong>${fd(r.k, 2)}</strong><br>plate-forme <strong>${esc(r.classe)}</strong> · compactage ${verdict(r.k <= 2, esc(r.compactage), esc(r.compactage))}
    <small>z<sub>2</sub> est l'enfoncement du second chargement seul ; le dessin des cycles est schématique</small>`;
});
brancher(["esPlqZ1", "esPlqZ2"], majPlq);

// ── Pieu d'essai : charge de fluage ──────────────────────────────────────
const majPieu = garde("esPieuOut", () => {
  const paliers = lireTableau(el("esPieuPaliers").value).filter((r) => r.length >= 3).map(([Q, s30, s60]) => ({ Q, s30, s60 }));
  const r = E.chargeFluagePieu(paliers);
  if (!r.applicable) { el("esPieuOut").innerHTML = verdict(false, "", r.motif); el("esPieuFig").innerHTML = ""; return; }
  const qMax = Math.max(...r.paliers.map((p) => p.Q)) * 1.08, aMax = Math.max(...r.paliers.map((p) => p.an)) * 1.2;
  const droite = (d) => [[0, d.a], [qMax, d.a + d.b * qMax]];
  el("esPieuFig").innerHTML = graphe({
    largeur: 560, hauteur: 250, xmin: 0, xmax: qMax, ymin: 0, ymax: aMax, xlabel: "charge en tête Q (kN)", ylabel: "fluage s60 − s30 (mm)",
    series: [{ points: r.paliers.map((p) => [p.Q, p.an]), couleur: COULEURS.violet, marqueurs: true, libelle: "fluage par palier" },
      { points: droite(r.d1), couleur: COULEURS.ec7, tirets: "6 4", epaisseur: 1.4, libelle: "branche basse" },
      { points: droite(r.d2), couleur: COULEURS.rouge, tirets: "6 4", epaisseur: 1.4, libelle: "branche haute" }],
    marques: [{ x: r.Qc, y: r.d1.a + r.d1.b * r.Qc, couleur: COULEURS.rouge, guides: true, libelle: `Qc = ${f(r.Qc, 4)} kN` }],
  });
  el("esPieuOut").innerHTML = `Charge de fluage Q<sub>c</sub> = <strong>${f(r.Qc, 4)} kN</strong>
    <small>intersection des deux droites ajustées sur les paliers 1 à ${r.coupure} et ${r.coupure + 1} à ${r.paliers.length} ; à comparer à Q<sub>c</sub> = 0,5 Q<sub>pu</sub> + 0,7 Q<sub>su</sub> du Fascicule 62 (chapitre 11)</small>`;
});
brancher(["esPieuPaliers"], majPieu);

// ── Lefranc ──────────────────────────────────────────────────────────────
const majLef = garde("esLefOut", () => {
  const L = num("esLefL"), D = num("esLefD");
  const r = el("esLefMode").value === "constant"
    ? E.lefrancConstant({ Q: num("esLefQ") / 60000, h: num("esLefH"), L, D })
    : E.lefrancVariable({ S: (Math.PI * (num("esLefDt") / 1000) ** 2) / 4, h1: num("esLefH1"), h2: num("esLefH2"), dt: num("esLefT"), L, D });
  if (!r.applicable) { el("esLefOut").innerHTML = verdict(false, "", r.motif); return; }
  el("esLefOut").innerHTML = `F = 2πL/ln[L/D + √(1 + (L/D)²)] = ${fd(r.F, 3)} m (m = F/D = ${fd(r.m, 2)})<br>
    ${el("esLefMode").value === "constant" ? "k = Q/(F·h)" : "k = S·ln(h<sub>1</sub>/h<sub>2</sub>)/[F·(t<sub>2</sub> − t<sub>1</sub>)]"} = <strong>${sci(r.k)} m/s</strong>
    <small>ordre de grandeur des ${esc(natureK(r.k))}</small>`;
});
brancher(["esLefMode", "esLefL", "esLefD", "esLefQ", "esLefH", "esLefDt", "esLefH1", "esLefH2", "esLefT"], majLef);

// ── Lugeon ───────────────────────────────────────────────────────────────
const majLug = garde("esLugOut", () => {
  const paliers = lireTableau(el("esLugPaliers").value).filter((r) => r.length >= 2).map(([p, Q]) => ({ p, Q }));
  const r = E.lugeon({ paliers, L: num("esLugL"), hauteurManometre: num("esLugHm", 0), profondeurNappe: num("esLugZw", Infinity), profondeurPasse: num("esLugZ") });
  if (!r.applicable) { el("esLugOut").innerHTML = verdict(false, "", r.motif); el("esLugFig").innerHTML = ""; return; }
  const iMax = r.paliers.reduce((m, q, i) => (q.pj > r.paliers[m].pj ? i : m), 0);
  const montee = r.paliers.slice(0, iMax + 1), descente = r.paliers.slice(iMax);
  // Régime : comparaison des UL montants et descendants, et évolution de UL avec p.
  const moy = (t) => t.reduce((s, q) => s + q.UL, 0) / t.length;
  const um = moy(montee), ud = descente.length > 1 ? moy(descente.slice(1)) : um;
  const ulBas = montee[0].UL, ulHaut = montee[montee.length - 1].UL;
  const regime = ud > 1.2 * um ? "ouverture des fissures (claquage) ou lessivage : débits plus forts à la descente"
    : ud < 0.8 * um ? "colmatage : débits plus faibles à la descente"
      : ulHaut < 0.8 * ulBas ? "écoulement turbulent : UL baisse quand la pression monte" : "écoulement laminaire : UL à peu près constant";
  const pMax = Math.max(...r.paliers.map((q) => q.pj)) * 1.1, qMax = Math.max(...r.paliers.map((q) => q.Q)) * 1.15;
  el("esLugFig").innerHTML = graphe({
    largeur: 560, hauteur: 240, xmin: 0, xmax: pMax, ymin: 0, ymax: qMax, xlabel: "pression effective sur la passe (MPa)", ylabel: "débit (L/min)",
    series: [{ points: montee.map((q) => [q.pj, q.Q]), couleur: COULEURS.bleu, marqueurs: true, libelle: "paliers montants" },
      { points: descente.map((q) => [q.pj, q.Q]), couleur: COULEURS.f62, tirets: "5 4", marqueurs: true, libelle: "paliers descendants" }],
  });
  el("esLugOut").innerHTML = `Pression effective = pression au manomètre + ${fd(r.paliers[0].pj - r.paliers[0].p, 3)} MPa (colonne d'eau)
    · <strong>${fd(r.UL, 1)} unités Lugeon</strong> au palier le plus fort · k ≈ <strong>${sci(r.k)} m/s</strong><br>
    <small>${esc(regime)}</small>`;
});
brancher(["esLugPaliers", "esLugL", "esLugHm", "esLugZw", "esLugZ"], majLug);

// ── Pompage (Jacob) ──────────────────────────────────────────────────────
el("esPompSt").value = pompageExemple();
const majPomp = garde("esPompOut", () => {
  const Q = num("esPompQ") / 3600, r = num("esPompR"), e = num("esPompE");
  const pts = lireTableau(el("esPompSt").value).filter((l) => l.length >= 2 && l[0] > 0).map(([t, s]) => ({ t: t * 60, s }));
  if (pts.length < 4 || !(Q > 0 && r > 0)) { el("esPompOut").textContent = "Saisir Q, r et au moins quatre lectures."; el("esPompFig").innerHTML = ""; return; }
  // Droite de Jacob sur les lectures tardives (u < 0,05), en deux passes.
  const ajuster = (sel) => {
    const xs = sel.map((p) => Math.log10(p.t)), n = sel.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n, my = sel.reduce((a, p) => a + p.s, 0) / n;
    let sxx = 0, sxy = 0;
    sel.forEach((p, i) => { sxx += (xs[i] - mx) ** 2; sxy += (xs[i] - mx) * (p.s - my); });
    const ds = sxy / sxx;
    return { ds, t0: 10 ** (mx - my / ds) };
  };
  let sel = pts.slice(Math.floor(pts.length / 2)), fit = ajuster(sel), j;
  for (let passe = 0; passe < 2; passe++) {
    j = E.jacob({ Q, ds: fit.ds, t0: fit.t0, r });
    if (!j.applicable) break;
    const ok = pts.filter((p) => (r * r * j.S) / (4 * j.T * p.t) < 0.05);
    if (ok.length >= 3) { sel = ok; fit = ajuster(sel); }
  }
  j = E.jacob({ Q, ds: fit.ds, t0: fit.t0, r });
  if (!j.applicable) { el("esPompOut").innerHTML = verdict(false, "", j.motif); return; }
  const tMin = Math.min(...pts.map((p) => p.t)) / 60, tMax = Math.max(...pts.map((p) => p.t)) / 60;
  const xmin = 10 ** Math.floor(Math.log10(Math.min(tMin, fit.t0 / 60))), xmax = 10 ** Math.ceil(Math.log10(tMax));
  const sMax = Math.max(...pts.map((p) => p.s)) * 1.15;
  el("esPompFig").innerHTML = graphe({
    largeur: 560, hauteur: 260, xmin, xmax, ymin: 0, ymax: sMax, logX: true, xlabel: "temps depuis le début du pompage (min)", ylabel: "rabattement s (m)",
    series: [{ points: pts.map((p) => [p.t / 60, p.s]), couleur: COULEURS.trait, marqueurs: true, epaisseur: 1, libelle: "lectures" },
      { points: [[fit.t0 / 60, 0], [xmax, fit.ds * Math.log10((xmax * 60) / fit.t0)]], couleur: COULEURS.rouge, tirets: "6 4", libelle: `droite de Jacob : Δs = ${fd(fit.ds, 3)} m par décade` }],
    marques: [{ x: fit.t0 / 60, y: 0.004 * sMax, couleur: COULEURS.rouge, rayon: 4, libelle: `t0 = ${f(fit.t0 / 60, 3)} min` }],
  });
  el("esPompOut").innerHTML = `Droite ajustée sur ${sel.length} lectures (u &lt; 0,05) : Δs = ${fd(fit.ds, 3)} m par cycle, t<sub>0</sub> = ${f(fit.t0, 3)} s<br>
    T = 0,183 Q/Δs = <strong>${sci(j.T)} m²/s</strong> · k = T/e = <strong>${sci(j.T / e)} m/s</strong> · S = 2,25 T t<sub>0</sub>/r² = <strong>${sci(j.S)}</strong>
    <small>les premières lectures s'écartent de la droite tant que u = r²S/(4Tt) reste grand : c'est la courbe de Theis</small>`;
});
brancher(["esPompSt", "esPompQ", "esPompR", "esPompE"], majPomp);

// ── Sismique réfraction ──────────────────────────────────────────────────
const majRef = garde("esRefOut", () => {
  const pts = lireTableau(el("esRefPts").value).filter((l) => l.length >= 2).map(([x, t]) => ({ x, t: t / 1000 }));
  const n = Math.round(num("esRefN"));
  if (pts.length < 4 || !(n >= 2 && n <= pts.length - 2)) { el("esRefOut").textContent = "Il faut au moins deux géophones sur chaque droite."; el("esRefFig").innerHTML = ""; return; }
  const p1 = pts.slice(0, n), p2 = pts.slice(n);
  const pente0 = p1.reduce((s, p) => s + p.x * p.t, 0) / p1.reduce((s, p) => s + p.x * p.x, 0); // droite par l'origine
  const mx = p2.reduce((s, p) => s + p.x, 0) / p2.length, my = p2.reduce((s, p) => s + p.t, 0) / p2.length;
  let sxx = 0, sxy = 0;
  for (const p of p2) { sxx += (p.x - mx) ** 2; sxy += (p.x - mx) * (p.t - my); }
  const pente2 = sxy / sxx, ti = my - pente2 * mx;
  const V1 = 1 / pente0, V2 = 1 / pente2, xc = ti / (pente0 - pente2);
  const r = E.refraction({ V1, V2, ti, xc });
  if (!r.applicable) { el("esRefOut").innerHTML = verdict(false, "", r.motif); el("esRefFig").innerHTML = ""; return; }
  const xMax = Math.max(...pts.map((p) => p.x)) * 1.05, tMax = Math.max(...pts.map((p) => p.t)) * 1000 * 1.15;
  el("esRefFig").innerHTML = graphe({
    largeur: 560, hauteur: 250, xmin: 0, xmax: xMax, ymin: 0, ymax: tMax, xlabel: "distance à l'ébranlement (m)", ylabel: "temps de première arrivée (ms)",
    series: [{ points: pts.map((p) => [p.x, 1000 * p.t]), couleur: COULEURS.trait, nuage: true, rayon: 4, libelle: "premières arrivées" },
      { points: [[0, 0], [xMax, 1000 * pente0 * xMax]], couleur: COULEURS.bleu, tirets: "6 4", libelle: `onde directe : V1 = ${f(V1, 3)} m/s` },
      { points: [[0, 1000 * ti], [xMax, 1000 * (ti + pente2 * xMax)]], couleur: COULEURS.rouge, tirets: "6 4", libelle: `onde réfractée : V2 = ${f(V2, 3)} m/s` }],
    marques: [{ x: xc, y: 1000 * pente0 * xc, couleur: COULEURS.violet, guides: true, libelle: `xc = ${f(xc, 3)} m` }],
  });
  el("esRefOut").innerHTML = `V<sub>1</sub> = ${f(V1, 3)} m/s · V<sub>2</sub> = ${f(V2, 3)} m/s · temps d'intercept t<sub>i</sub> = ${fd(1000 * ti, 1)} ms
    · épaisseur de la couche superficielle h = t<sub>i</sub> V<sub>1</sub> V<sub>2</sub> / (2√(V<sub>2</sub>² − V<sub>1</sub>²)) = <strong>${fd(r.hT, 2)} m</strong>
    <small>par la distance critique : ${fd(r.hX, 2)} m ; V<sub>2</sub> ≈ ${f(V2, 2)} m/s évoque ${V2 > 3000 ? "un rocher sain" : V2 > 1500 ? "un sol saturé ou un rocher altéré" : "un sol sec compact"}</small>`;
});
brancher(["esRefPts", "esRefN"], majRef);

// ── Vs,30 ────────────────────────────────────────────────────────────────
const majVs = garde("esVsOut", () => {
  const couches = lireTableau(el("esVsCouches").value).filter((l) => l.length >= 2 && l[0] > 0 && l[1] > 0).map(([h, Vs]) => ({ h, Vs }));
  if (!couches.length) { el("esVsOut").textContent = "Saisir au moins une couche."; return; }
  const r = E.vs30(couches);
  el("esVsOut").innerHTML = `V<sub>s,30</sub> = 30/Σ(h<sub>i</sub>/V<sub>s,i</sub>) = <strong>${f(r.Vs30, 3)} m/s</strong> → classe de sol <strong>${r.classe}</strong>
    <small>A &gt; 800 m/s (rocher), B 360–800, C 180–360, D &lt; 180 m/s ; une couche molle de 5 à 20 m sur un substratum rigide relève de la classe E (NF EN 1998-1)</small>`;
});
brancher(["esVsCouches"], majVs);
