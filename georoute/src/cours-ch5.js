// Calculateur du chapitre 5 : classement d'un sol au GTR 2024 et au GTR 1992
// à partir de la même courbe granulométrique et des mêmes essais, avec le
// chemin suivi dans chaque classification.
import { el, num, fd, esc, brancher, garde, lireTableau } from "./ui.js";
import { courbeGranulo, COULEURS } from "./figures.js";
import { analyser, passant } from "./gtr/granulo.js";
import { classerSol } from "./gtr/classification.js";
import { classerSol1992, SOUS_CLASSES_1992 } from "./gtr/classification92.js";
import { SOLS, ipiDe } from "./bancs/materiaux.js";

const CHAMPS = ["clGranulo", "clVbs", "clWl", "clWp", "clW", "clWopn", "clIpi", "clCbri", "clEs", "clLa", "clMde", "clFs", "clMo", "clForme"];
const vide = (x) => (x === null || x === undefined || !Number.isFinite(x) ? "" : String(Math.round(x * 100) / 100));

// Sols types du cours (les mêmes que ceux des bancs d'essai), puis la saisie libre.
const choix = el("clSol");
choix.innerHTML = Object.entries(SOLS).map(([k, s]) => `<option value="${k}">${esc(s.nom)}</option>`).join("") + `<option value="">saisie libre</option>`;
choix.value = "graveArgileuse";

function remplir() {
  const s = SOLS[choix.value];
  if (!s) return;
  el("clGranulo").value = s.granulo.map(([d, p]) => `${d} ${p}`).join("\n");
  const val = { clVbs: s.VBS, clWl: s.wL, clWp: s.wP, clW: s.wn, clWopn: s.wOPN, clIpi: ipiDe(s)(s.wn), clCbri: s.CBRi, clEs: s.ES, clLa: s.LA, clMde: s.MDE, clFs: s.FS, clMo: s.MO };
  for (const [id, v] of Object.entries(val)) el(id).value = vide(v);
  el("clForme").value = "anguleux";
}

/** Le chemin suivi, en liste numérotée. */
const arbre = (etapes) => `<ol class="arbre">${etapes.map((e, i) => `<li${i === etapes.length - 1 ? ' class="retenu"' : ""}><strong>${esc(e.question)}</strong> ${esc(e.reponse)}${e.detail ? `<small>${esc(e.detail)}</small>` : ""}</li>`).join("")}</ol>`;

const maj = garde("clRes", () => {
  const pts = lireTableau(el("clGranulo").value).filter((r) => r.length >= 2).map((r) => [r[0], r[1]]);
  const a = analyser(pts);
  if (!a.applicable) { el("clRes").innerHTML = `<p>${esc(a.motif)}</p>`; el("clFig").innerHTML = ""; return; }
  const wL = num("clWl"), wP = num("clWp"), w = num("clW");
  const IP = wL - wP, Ic = (wL - w) / IP;
  const commun = { VBS: num("clVbs"), IP, wL, wP, w, wOPN: num("clWopn"), IPI: num("clIpi"), LA: num("clLa"), MDE: num("clMde"), FS: num("clFs"), forme: el("clForme").value };
  const r24 = classerSol({
    ...commun, Dmax: a.Dmax, p63um: a.p63um, p2mm: a.p2mm, Cu: a.Cu, D60: a.D60, D10: a.D10,
    fractionSable: a.fractionSable, fractionGrave: a.fractionGrave, fraction063: a.passant63mm, CBRi: num("clCbri"), MO: num("clMo"),
  });
  const r92 = classerSol1992({ ...commun, Dmax: a.Dmax, p80um: a.p80um, p2mm: a.p2mm50, ES: num("clEs"), Ic, fraction050: a.passant50mm });

  const t63 = passant(a.points, 0.063), t80 = passant(a.points, 0.08);
  const marques = [];
  if (Number.isFinite(t63)) marques.push({ x: 0.063, y: t63, couleur: COULEURS.gtr24, libelle: `63 µm : ${fd(t63, 1)} %` });
  if (Number.isFinite(t80)) marques.push({ x: 0.08, y: t80, couleur: COULEURS.gtr92, libelle: `80 µm : ${fd(t80, 1)} %` });
  el("clFig").innerHTML = courbeGranulo({
    largeur: 620, hauteur: 300, dMin: Math.min(0.001, a.points[0][0] / 2), dMax: Math.max(100, a.points.at(-1)[0] * 1.6),
    series: [
      { points: [[50, 0], [50, 100]], couleur: COULEURS.gtr92, tirets: "6 3", epaisseur: 1.4, libelle: "50 mm (GTR 1992)" },
      { points: a.points, couleur: COULEURS.bleu, epaisseur: 2.6, marqueurs: true, libelle: "passant cumulé" },
    ],
    marques,
  });

  const carte = (r, edition) => {
    const c = edition === 2024 ? "gtr24" : "gtr92";
    if (!r.applicable) return `<div class="${c}"><h4>GTR ${edition}</h4><p><span class="verdict ko">classement incomplet</span> ${esc(r.motif)}</p>${r.arbre ? arbre(r.arbre) : ""}</div>`;
    const desc = edition === 2024 ? r.description : SOUS_CLASSES_1992[r.c ?? r.sousClasse] ?? r.description;
    return `<div class="${c}"><h4>GTR ${edition}</h4>
      <p><span class="classe ${c}" style="font-size:18px">${esc(r.symbole)}</span> <small>${esc(desc ?? "")}</small></p>
      ${arbre(r.arbre)}
      ${(r.avertissements ?? []).map((t) => `<p class="method-note">${esc(t)}</p>`).join("")}</div>`;
  };
  const fr = a.passant63mm < 99.9 || a.passant50mm < 99.9
    ? `<p class="method-note">Fines ramenées aux fractions : ${fd(a.p63um, 1)} % de la fraction 0/63 mm à 63 µm (2024), ${fd(a.p80um, 1)} % de la fraction 0/50 mm à 80 µm (1992).</p>` : "";
  el("clRes").innerHTML = carte(r24, 2024) + carte(r92, 1992);
  el("clFig").insertAdjacentHTML("beforeend", fr);
});

choix.addEventListener("change", () => { remplir(); maj(); });
// Toute retouche d'un essai fait passer en saisie libre.
for (const id of CHAMPS) el(id).addEventListener("input", () => { choix.value = ""; });
remplir();
brancher(CHAMPS, maj);
