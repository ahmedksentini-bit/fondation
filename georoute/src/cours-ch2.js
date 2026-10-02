// Calculateurs du chapitre 2 : courbe granulométrique et famille du sol,
// limites d'Atterberg et abaque de plasticité, valeur de bleu.
import { el, num, f, fd, brancher, garde, lireTableau } from "./ui.js";
import { courbeGranulo, abaquePlasticite, graphe, svg, ligne, texte, COULEURS } from "./figures.js";
import { analyser } from "./gtr/granulo.js";
import { wLCasagrande, atterberg, abaqueCasagrande, vbs } from "./gtr/identification.js";
import { SEUILS_2024 } from "./gtr/classification.js";

// ── Courbe granulométrique ────────────────────────────────────────────────
const majGranulo = garde("grOut", () => {
  const pts = lireTableau(el("grPoints").value).filter((r) => r.length >= 2).map((r) => [r[0], r[1]]);
  const a = analyser(pts);
  if (!a.applicable) { el("grOut").textContent = a.motif; el("grFig").innerHTML = ""; return; }
  const S = SEUILS_2024, fines = a.p63um;
  const famille = !Number.isFinite(fines) ? null
    : a.Dmax > S.Dmax && fines <= S.fines.F ? null
      : fines > S.fines.F ? "F, sol fin" : fines > S.fines.IS ? "I, sol intermédiaire"
        : a.fractionSable > a.fractionGrave ? "S, sol sableux" : "G, sol graveleux";
  const marques = [];
  if (Number.isFinite(a.D10)) marques.push({ x: a.D10, y: 10, couleur: COULEURS.violet, libelle: "D10", guides: true });
  if (Number.isFinite(a.D60)) marques.push({ x: a.D60, y: 60, couleur: COULEURS.violet, libelle: "D60", guides: true });
  el("grFig").innerHTML = courbeGranulo({ dMin: Math.min(0.001, a.points[0][0] / 2), dMax: Math.max(100, a.points.at(-1)[0] * 1.6), series: [{ points: a.points, couleur: COULEURS.bleu, epaisseur: 2.6, marqueurs: true, libelle: "passant cumulé" }], marques });
  const cu = Number.isFinite(a.Cu) ? `C<sub>u</sub> = ${f(a.Cu, 3)} (${a.Cu >= 6 ? "étalée" : "uniforme"}) · C<sub>c</sub> = ${f(a.Cc, 2)}` : `D<sub>10</sub> inconnu : C<sub>u</sub> indéterminé${Number.isFinite(a.D60) ? ` ; D<sub>60</sub> = ${f(a.D60, 3)} mm ${a.D60 >= 0.4 ? "≥ 400 µm : réputée étalée" : "< 400 µm : réputée uniforme"}` : ""}`;
  el("grOut").innerHTML = `D<sub>max</sub> ≈ D<sub>95</sub> = <strong>${f(a.Dmax, 3)} mm</strong>${a.Dmax > S.Dmax ? ` &gt; 63 mm : sol VC, fraction 0/63 mm = ${fd(a.passant63mm, 0)} % du total` : ""} ·
    sur la fraction 0/63 mm : tamisat à 63 µm <strong>${fd(fines, 1)} %</strong>, à 2 mm ${fd(a.p2mm, 1)} % ·
    sable ${fd(a.fractionSable, 0)} %, grave ${fd(a.fractionGrave, 0)} % · ${cu}
    <small>Premier niveau du GTR 2024 : ${famille ? `<strong>${famille}</strong>${a.Dmax > S.Dmax ? ` pour la fraction 0/63 mm (sol VC${famille[0]}…)` : ""}` : "sol à gros éléments VC — sa fraction 0/63 mm se classe comme un sol F, I, S ou G"}.
    L'argilosité (VBS ou IP) précisera la sous-classe (chapitre 5).</small>`;
});
brancher(["grPoints"], majGranulo);

// ── Limites d'Atterberg ───────────────────────────────────────────────────
const majAtterberg = garde("atOut", () => {
  const pts = lireTableau(el("atPoints").value).filter((r) => r.length >= 2).map((r) => [r[0], r[1]]);
  const wP = num("atWp"), w = num("atW");
  const c = wLCasagrande(pts);
  if (!c.applicable || !Number.isFinite(wP)) { el("atOut").textContent = c.motif ?? "Renseigner la limite de plasticité."; el("atFig").innerHTML = ""; return; }
  const a = atterberg({ wL: c.wL, wP, w }), pos = abaqueCasagrande({ wL: c.wL, IP: a.IP });
  const Ns = pts.map((p) => p[0]), nMin = Math.min(10, ...Ns), nMax = Math.max(50, ...Ns);
  const droite = graphe({
    largeur: 620, hauteur: 230, xmin: nMin, xmax: nMax, ymin: Math.floor(Math.min(...pts.map((p) => p[1]), c.wL) - 2), ymax: Math.ceil(Math.max(...pts.map((p) => p[1]), c.wL) + 2), logX: true,
    xlabel: "nombre de coups N", ylabel: "w (%)",
    series: [{ points: [[nMin, c.droite(nMin)], [nMax, c.droite(nMax)]], couleur: COULEURS.bleu, epaisseur: 2 }, { points: pts, couleur: COULEURS.encre, nuage: true, rayon: 4 }],
    marques: [{ x: 25, y: c.wL, couleur: COULEURS.rouge, libelle: `wL = ${fd(c.wL, 1)} %`, guides: true }], legende: false,
  });
  const abaque = abaquePlasticite({ largeur: 620, hauteur: 330, points: [{ wL: c.wL, IP: a.IP, libelle: pos.code }] });
  el("atFig").innerHTML = `${droite}${abaque}`;
  const classeIP = a.IP <= 12 ? "IP ≤ 12 : sol faiblement argileux (le GTR préfère alors la VBS)" : a.IP <= 22 ? "12 < IP ≤ 22 : moyennement argileux (F2 s'il est fin)"
    : a.IP <= 40 ? "22 < IP ≤ 40 : argileux (F3 s'il est fin)" : a.IP <= 55 ? "40 < IP ≤ 55 : très argileux (F4)" : "IP > 55 : extrêmement plastique (F4+)";
  el("atOut").innerHTML = `w<sub>L</sub> = <strong>${fd(c.wL, 1)} %</strong> (r² = ${fd(c.r2, 3)}) · w<sub>P</sub> = ${fd(wP, 1)} % ·
    <strong>IP = ${fd(a.IP, 1)}</strong> · I<sub>c</sub> = (w<sub>L</sub> − w<sub>n</sub>)/IP = <strong>${fd(a.Ic, 2)}</strong>
    <small>${classeIP}. Sur l'abaque de Casagrande : ${pos.nom} (${pos.code}), ${pos.argile ? "au-dessus" : "au-dessous"} de la ligne A.
    ${a.Ic > 1 ? "Ic > 1 : la teneur en eau naturelle est sous la limite de plasticité, le sol est ferme." : a.Ic < 0.5 ? "Ic < 0,5 : le sol est très humide, proche de sa limite de liquidité." : ""}</small>`;
});
brancher(["atPoints", "atWp", "atW"], majAtterberg);

// ── Valeur de bleu ────────────────────────────────────────────────────────
/** Réglette des seuils de VBS du GTR, avec la valeur du sol. */
function regletteVbs(VBS) {
  const seuils = [[0.1, "insensible si fines ≤ 10 %"], [0.2, "sensibilité à l'eau"], [1.5, "I1 / I2"], [2.5, "F1 / F2"], [6, "F2 / F3"], [8, "F3 / F4"]];
  const X = (v) => 30 + (Math.log10(Math.max(0.03, Math.min(v, 20)) / 0.03) / Math.log10(20 / 0.03)) * 580;
  return svg({ largeur: 640, hauteur: 120, titre: "Seuils de VBS", contenu: () => {
    let s = `<rect x="30" y="52" width="580" height="12" rx="6" fill="#e2e8f0"/>`;
    seuils.forEach(([v, t], i) => {
      s += ligne(X(v), 44, X(v), 72, "#334155", 1.4);
      s += texte(X(v), 86 + (i % 2) * 14, `${String(v).replace(".", ",")}`, 'text-anchor="middle" style="font-size:11px;font-weight:800"');
      s += texte(X(v), 36 - (i % 2) * 14, t, 'text-anchor="middle" class="halo" style="font-size:10px;fill:#475569"');
    });
    s += `<circle cx="${X(VBS).toFixed(1)}" cy="58" r="8" fill="${COULEURS.rouge}" stroke="#fff" stroke-width="2"/>`;
    s += texte(Math.min(X(VBS), 560), 118, `VBS = ${String(Math.round(VBS * 100) / 100).replace(".", ",")}`, 'text-anchor="middle" class="halo" style="font-weight:800;fill:#b91c1c"');
    return s;
  } });
}

const majVbs = garde("vbOut", () => {
  const V = num("vbV"), m0 = num("vbM0"), C = num("vbC");
  if (!(V >= 0 && m0 > 0 && C > 0 && C <= 1)) { el("vbOut").textContent = "Renseigner V, m0 et C (entre 0 et 1)."; el("vbFig").innerHTML = ""; return; }
  const r = vbs({ V, m0, C });
  el("vbFig").innerHTML = regletteVbs(r.VBS);
  const lecture = r.VBS <= 0.1 ? "aucune activité mesurable des fines : avec au plus 10 % de fines, le sol est insensible à l'eau"
    : r.VBS <= 0.2 ? "fines peu actives : la sensibilité à l'eau n'apparaît qu'au-delà de 0,2"
      : r.VBS <= 1.5 ? "sol sablo-limoneux : sensible à l'eau" : r.VBS <= 2.5 ? "limon peu plastique (F1 s'il est fin)" : r.VBS <= 6 ? "limon de plasticité moyenne (F2 s'il est fin)"
        : r.VBS <= 8 ? "sol argileux (F3 s'il est fin)" : "sol très argileux (F4 s'il est fin)";
  el("vbOut").innerHTML = `B = V × 10 g/L = ${fd(r.B, 2)} g de bleu · VB de la fraction 0/5 mm = 100 B/m<sub>0</sub> = ${fd(r.VB, 2)} g/100 g ·
    <strong>VBS = VB × C = ${fd(r.VBS, 2)}</strong> <small>${lecture}.</small>`;
});
brancher(["vbV", "vbM0", "vbC"], majVbs);
