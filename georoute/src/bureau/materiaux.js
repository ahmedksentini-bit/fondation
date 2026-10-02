// Modules « matériaux » du bureau de calcul : classement d'un sol aux deux
// éditions du GTR avec ses conditions d'utilisation, et classement d'un
// matériau rocheux. Tout le calcul est fait par les solveurs de src/gtr.

import { esc, f, fd, nombre, lignes, pastille, tableau, donnees, arbre, classe } from "./commun.js";
import { analyser, passant } from "../gtr/granulo.js";
import { classerSol, classerRoche, FAMILLES_ROCHES } from "../gtr/classification.js";
import { classerSol1992, SOUS_CLASSES_1992 } from "../gtr/classification92.js";
import { conditionsRemblai, conditionsCoucheForme, RUBRIQUES_REMBLAI, RUBRIQUES_CDF, METEOS, couvre } from "../gtr/utilisation.js";
import { casPST } from "../gtr/pst.js";
import { sensibiliteGel } from "../gtr/gel.js";
import { courbeGranulo, graphe, COULEURS } from "../figures.js";
import { codeHtml } from "../codes.js";

const NOM_METEO = Object.fromEntries(METEOS.map((m) => [m.symbole, m.nom]));
const meteoTxt = (m) => String(m).replace(/-/g, "−");

/** Hauteur admise par le chiffre H d'un code de remblai : 0 sans limite, 1 ≤ 5 m, 2 ≤ 10 m. */
const hauteurAdmise = (code) => ({ 0: Infinity, 1: 5, 2: 10 }[code?.[6]] ?? Infinity);

/** Toutes les situations d'un cas de tableau, la météo du projet en surbrillance. */
function tableSituations(cas, rubriques, meteo, H = NaN) {
  if (!cas) return "";
  if (cas.non) return `<p><span class="verdict ko">NON</span> ${esc(cas.non)}</p>`;
  if (cas.renvoi || cas.texte) return `<p class="method-note">${esc(cas.renvoi ?? cas.texte)}</p>`;
  const lignesSit = (cas.situations ?? []).map((s) => {
    const choisie = couvre(s.meteo, meteo);
    const contenu = s.non ? `<span class="verdict ko">NON</span> ${esc(s.non)}`
      : s.solutions.map((x) => {
        const hMax = rubriques === RUBRIQUES_REMBLAI ? hauteurAdmise(x.code) : Infinity;
        const horsH = Number.isFinite(H) && H > hMax;
        return `<div style="margin:4px 0${horsH ? ";opacity:.55" : ""}">${x.titre ? `<strong>${esc(x.titre)}</strong> ` : ""}${codeHtml(x.code, rubriques)}${horsH ? ` <small>(remblai ≤ ${hMax} m : exclu pour ${fd(H, 1)} m)</small>` : ""}
          <small>${x.conditions.map(esc).join(" · ")}</small></div>`;
      }).join("");
    return [`${choisie ? "<strong>▶ " : ""}${esc(meteoTxt(s.meteo))}${choisie ? "</strong>" : ""}<small>${esc(s.libelle || "")}</small>`, contenu];
  });
  return tableau(["Météo", "Conditions d'utilisation"], lignesSit);
}

/** Courbe granulométrique de la note, avec les tamis de 63 et 80 µm. */
function figureGranulo(a) {
  const marques = [];
  const t63 = passant(a.points, 0.063), t80 = passant(a.points, 0.08);
  if (Number.isFinite(t63)) marques.push({ x: 0.063, y: t63, couleur: COULEURS.gtr24, libelle: `63 µm : ${fd(t63, 1)} %` });
  if (Number.isFinite(t80)) marques.push({ x: 0.08, y: t80, couleur: COULEURS.gtr92, libelle: `80 µm : ${fd(t80, 1)} %` });
  if (Number.isFinite(a.D10)) marques.push({ x: a.D10, y: 10, couleur: COULEURS.violet, libelle: "D10", guides: true });
  if (Number.isFinite(a.D60)) marques.push({ x: a.D60, y: 60, couleur: COULEURS.violet, libelle: "D60", guides: true });
  return courbeGranulo({
    largeur: 620, hauteur: 300, dMin: Math.min(0.001, a.points[0][0] / 2), dMax: Math.max(100, a.points.at(-1)[0] * 1.6),
    series: [{ points: a.points, couleur: COULEURS.bleu, epaisseur: 2.6, marqueurs: true, libelle: "passant cumulé" }], marques,
  });
}

// ───────────────────────────── Classement d'un sol ─────────────────────────────

export function calculerClassement(v) {
  const pts = lignes(v.granulo).filter((r) => r.length >= 2).map((r) => [r[0], r[1]]);
  const a = analyser(pts);
  if (!a.applicable) throw new Error(a.motif);
  const wL = nombre(v.wL), wP = nombre(v.wP), w = nombre(v.wn), IP = wL - wP;
  const commun = { VBS: nombre(v.VBS), IP, wL, wP, w, wOPN: nombre(v.wOPN), IPI: nombre(v.IPI), LA: nombre(v.LA), MDE: nombre(v.MDE), FS: nombre(v.FS), forme: v.forme };
  const r24 = classerSol({
    ...commun, Dmax: a.Dmax, p63um: a.p63um, p2mm: a.p2mm, Cu: a.Cu, D60: a.D60, D10: a.D10,
    fractionSable: a.fractionSable, fractionGrave: a.fractionGrave, fraction063: a.passant63mm, CBRi: nombre(v.CBRi), MO: nombre(v.MO),
  });
  if (!r24.applicable) throw new Error(`classement GTR 2024 impossible : ${r24.motif}`);
  const r92 = classerSol1992({ ...commun, Dmax: a.Dmax, p80um: a.p80um, p2mm: a.p2mm50, ES: nombre(v.ES), Ic: (wL - w) / IP, fraction050: a.passant50mm });
  const meteo = v.meteo, H = nombre(v.H);
  const rem = conditionsRemblai(r24, meteo), cdf = conditionsCoucheForme(r24, meteo);
  const solutionsH = (rem.solutions ?? []).filter((x) => !(H > hauteurAdmise(x.code)));
  const okRemblai = rem.trouve ? (rem.non || rem.renvoi ? false : solutionsH.length > 0) : null;
  const okCdf = cdf.trouve ? (cdf.non || cdf.texte ? false : (cdf.solutions ?? []).length > 0) : null;
  const pst = r24.etat ? casPST({ sousClasse: `${r24.vc ?? ""}${r24.sousClasse}`, etat: r24.etat }) : null;
  const gel = sensibiliteGel({ nature: `${r24.vc ?? ""}${r24.sousClasse}`, insensibleEau: r24.etat === "ins", LA: nombre(v.LA), MDE: nombre(v.MDE) });

  const ligneRemblai = !rem.trouve ? "cas absent des tableaux : étude spécifique"
    : rem.non ? `${pastille(false, "", "NON")} ${esc(rem.non)}` : rem.renvoi ? esc(rem.renvoi)
      : `${pastille(solutionsH.length > 0, `${solutionsH.length} solution${solutionsH.length > 1 ? "s" : ""}`, Number.isFinite(H) ? `aucune solution pour ${fd(H, 1)} m` : "aucune solution")} ${solutionsH.map((x) => codeHtml(x.code)).join(" ")}`;
  const ligneCdf = !cdf.trouve ? "cas absent des tableaux" : cdf.texte ? esc(cdf.texte) : cdf.non ? `${pastille(false, "", "NON")} ${esc(cdf.non)}`
    : `${pastille(true, `${cdf.solutions.length} solution${cdf.solutions.length > 1 ? "s" : ""}`)} ${cdf.solutions.map((x) => codeHtml(x.code, RUBRIQUES_CDF)).join(" ")}`;
  const synthese = `
    <p class="final-result bureau-verdict ${okRemblai ? "ok" : okRemblai === false ? "ko" : "na"}">${classe(r24.symbole, "gtr24", 22)} GTR 2024 · ${r92.applicable ? classe(r92.symbole, "gtr92", 18) : "—"} GTR 1992
      <small>${esc(r24.description)}</small></p>
    ${tableau(["", "Météo « " + esc(NOM_METEO[meteo]) + " »"], [
      ["Remblai", ligneRemblai], ["Couche de forme", ligneCdf],
      ["En PST", pst?.applicable ? `${esc(pst.pst)} · arase ${pst.ar.join(" ou ")}` : "—"],
      ["Gel (règles par défaut)", gel.classe ? `${esc(gel.classe)} — ${esc(gel.nom)}` : esc(gel.nom)],
    ])}
    ${(r24.avertissements ?? []).map((t) => `<p class="method-note">${esc(t)}</p>`).join("")}`;

  const note = `
    <h3>1. Données</h3>
    ${donnees([["Courbe granulométrique", `${pts.length} tamis, de ${f(a.points[0][0], 3)} à ${f(a.points.at(-1)[0], 3)} mm`], ["VBS", f(nombre(v.VBS), 3)], ["wL · wP · IP", Number.isFinite(IP) ? `${fd(wL, 1)} · ${fd(wP, 1)} · ${fd(IP, 1)} %` : ""],
      ["wn · wOPN", `${fd(w, 1)} · ${fd(nombre(v.wOPN), 1)} %`], ["IPI à wn", f(nombre(v.IPI), 3)], ["CBRi", f(nombre(v.CBRi), 3)], ["LA · MDE · FS", [v.LA, v.MDE, v.FS].map((x) => f(nombre(x), 3)).join(" · ")],
      ["Matières organiques", Number.isFinite(nombre(v.MO)) ? `${fd(nombre(v.MO), 1)} %` : ""], ["Météo · hauteur du remblai", `${esc(NOM_METEO[meteo])} · ${Number.isFinite(H) ? `${fd(H, 1)} m` : "—"}`]])}
    <h3>2. Analyse granulométrique</h3>
    ${tableau(["Paramètre", "Valeur", "Fraction de référence"], [
      ["Dmax ≈ D95", `${f(a.Dmax, 3)} mm`, "matériau total"], ["D10 · D60 · Cu", `${f(a.D10, 3)} · ${f(a.D60, 3)} mm · ${f(a.Cu, 3)}`, "matériau total"],
      ["tamisat à 63 µm", `${fd(a.p63um, 1)} %`, "0/63 mm (GTR 2024)"], ["tamisat à 2 mm", `${fd(a.p2mm, 1)} %`, "0/63 mm"],
      ["sable 0,063/2 · grave 2/63", `${fd(a.fractionSable, 0)} % · ${fd(a.fractionGrave, 0)} %`, "0/63 mm"],
      ["tamisat à 80 µm", `${fd(a.p80um, 1)} %`, "0/50 mm (GTR 1992)"], ["tamisat à 2 mm", `${fd(a.p2mm50, 1)} %`, "0/50 mm"]])}
    <h3>3. Classement GTR 2024 : ${classe(r24.symbole)}</h3>${arbre(r24.arbre)}
    <h3>4. Classement GTR 1992 (NF P11-300) : ${r92.applicable ? classe(r92.symbole, "gtr92") : "incomplet"}</h3>
    ${r92.applicable ? `${arbre(r92.arbre)}<p class="method-note">${esc(SOUS_CLASSES_1992[r92.c ?? r92.sousClasse] ?? "")}</p>` : `<p>${esc(r92.motif)}</p>`}
    <h3>5. Conditions d'utilisation en remblai (fascicule 2, annexe 2${rem.cas?.page ? `, p. ${rem.cas.page}` : ""})</h3>
    ${rem.trouve ? tableSituations(rem.cas, RUBRIQUES_REMBLAI, meteo, H) : `<p>Le cas ${esc((rem.cles ?? []).join(", "))} n'est pas dans les tableaux.</p>`}
    ${H > 15 ? `<p class="method-note">Remblai de plus de 15 m : hors du domaine des recommandations du GTR, conception spécialisée.</p>` : ""}
    <h3>6. Conditions d'utilisation en couche de forme (fascicule 2, annexe 3${cdf.cas?.page ? `, p. ${cdf.cas.page}` : ""})</h3>
    ${cdf.trouve ? tableSituations(cdf.cas, RUBRIQUES_CDF, meteo) : `<p>Le cas ${esc((cdf.cles ?? []).join(", "))} n'est pas dans les tableaux.</p>`}
    <h3>7. PST et gel</h3>
    <p>${pst?.applicable ? `En partie supérieure des terrassements : <strong>${esc(pst.pst)}</strong>, arase ${pst.ar.join(" ou ")} — ${esc(pst.motif)}.` : "Cas de PST : état hydrique nécessaire."}
       Sensibilité au gel, sans essai de gonflement : <strong>${esc(gel.classe ?? "—")}</strong> (${esc(gel.etapes.join(" ; "))}).</p>`;
  return {
    figure: figureGranulo(a), synthese, note, verdict: okRemblai,
    resume: `${r24.symbole} (1992 : ${r92.applicable ? r92.symbole : "—"})`,
  };
}

// ───────────────────────────── Matériau rocheux ─────────────────────────────

const TEINTE = { th: "#1e3a8a", h: "#3b82f6", m: "#22c55e", s: "#f59e0b", ts: "#b45309" };

/** Figure propre à la famille : plan LA–MDE, plan IFR–IDGa ou plan ρd–wn des craies. */
function figureRoche(fam, p) {
  if (["Vo", "Me", "Sa", "Co", "Li"].includes(fam) && (Number.isFinite(p.LA) || Number.isFinite(p.MDE))) {
    return graphe({
      largeur: 620, hauteur: 300, xmin: 0, xmax: 70, ymin: 0, ymax: 80, xlabel: "micro-Deval MDE", ylabel: "Los Angeles LA", pasX: 10, pasY: 10,
      zones: [
        { x0: 0, x1: 45, y0: 0, y1: 45, couleur: "#0f766e", opacite: 0.1, libelle: "R3", position: "droite" },
        { x0: 0, x1: 25, y0: 0, y1: 35, couleur: "#0f766e", opacite: 0.14, libelle: "R2 (Vo, Me)", position: "droite" },
        { x0: 0, x1: 10, y0: 0, y1: 25, couleur: "#0f766e", opacite: 0.2, libelle: "R1", position: "droite" },
      ],
      marques: [{ x: Number.isFinite(p.MDE) ? p.MDE : 0, y: Number.isFinite(p.LA) ? p.LA : 0, couleur: COULEURS.rouge, libelle: "roche", guides: true }],
    });
  }
  if (fam === "Cl" && Number.isFinite(p.IFR)) {
    const IDGa = Number.isFinite(p.IDGa) ? p.IDGa : 1;
    return graphe({
      largeur: 620, hauteur: 300, xmin: 1, xmax: 20, ymin: 1, ymax: 100, logY: true, xlabel: "fragmentabilité IFR", ylabel: "dégradabilité IDGa", pasX: 2,
      zones: [
        { x0: 7, x1: 20, y0: 1, y1: 100, couleur: "#b91c1c", opacite: 0.1, libelle: "R5 Cl", position: "droite" },
        { x0: 1, x1: 7, y0: 20, y1: 100, couleur: "#d97706", opacite: 0.16, libelle: "R4 Cld1" },
        { x0: 1, x1: 7, y0: 5, y1: 20, couleur: "#eab308", opacite: 0.14, libelle: "R4 Cld2" },
        { x0: 1, x1: 7, y0: 1, y1: 5, couleur: "#0f766e", opacite: 0.12, libelle: "R3 Cl ou R4 Cl" },
      ],
      marques: [{ x: Math.min(p.IFR, 20), y: IDGa, couleur: COULEURS.rouge, libelle: "roche", guides: true }],
    });
  }
  if (fam === "CH" && Number.isFinite(p.rhoD)) {
    const b = (x0, x1, y0, y1, e, l) => ({ x0, x1, y0, y1, couleur: e ? TEINTE[e] : "#64748b", opacite: e ? 0.22 : 0.1, libelle: l });
    return graphe({
      largeur: 620, hauteur: 300, xmin: 5, xmax: 45, ymin: 1.3, ymax: 2.3, xlabel: "wn (%)", ylabel: "ρd (Mg/m³)", pasX: 5, pasY: 0.1,
      zones: [b(5, 45, 1.95, 2.3, null, "CH1"), b(5, 45, 1.7, 1.95, null, "CH2"), b(5, 18, 1.55, 1.7, "ts", "CH3ts"), b(18, 22, 1.55, 1.7, "s", "CH3s"), b(22, 27, 1.55, 1.7, "m", "CH3m"), b(27, 45, 1.55, 1.7, "h", "CH3h"),
        b(5, 16, 1.3, 1.55, "ts", "CH4ts"), b(16, 21, 1.3, 1.55, "s", "CH4s"), b(21, 26, 1.3, 1.55, "m", "CH4m"), b(26, 31, 1.3, 1.55, "h", "CH4h"), b(31, 45, 1.3, 1.55, "th", "CH4th")],
      marques: [{ x: Number.isFinite(p.wn) ? p.wn : 5, y: p.rhoD, couleur: COULEURS.rouge, libelle: "craie", guides: true }],
    });
  }
  return "";
}

export function calculerRoche(v) {
  const fam = v.famille;
  const p = { rhoD: nombre(v.rhoD), wn: nombre(v.wn), w: nombre(v.wn), wOPN: nombre(v.wOPN), LA: nombre(v.LA), MDE: nombre(v.MDE), IFR: nombre(v.IFR), IDGa: nombre(v.IDGa), IPI: nombre(v.IPI), gypse: nombre(v.gypse), sel: nombre(v.sel) };
  const r = classerRoche(fam, p);
  if (!r.applicable) throw new Error(r.motif);
  const sc = r.sousClasse, meteo = v.meteo;
  const cleCdf = /^CH/.test(sc) ? sc.replace(/(th|h|m|s|ts)$/, "") : sc.replace(/ (th|h|m|s|ts)$/, "");
  const rem = conditionsRemblai(sc, meteo), cdf = conditionsCoucheForme(cleCdf, meteo);
  const pst = casPST({ sousClasse: sc.replace(/ (th|h|m|s|ts)$/, ""), etat: /(th|h|m|s|ts)$/.exec(sc)?.[1] ?? null });
  const gel = sensibiliteGel({ nature: sc.replace(/ (th|h|m|s|ts)$/, ""), LA: p.LA, MDE: p.MDE });
  const okRemblai = rem.trouve ? !(rem.non) && (rem.renvoi || (rem.solutions ?? []).length > 0) : null;
  const synthese = `
    <p class="final-result bureau-verdict ${okRemblai ? "ok" : okRemblai === false ? "ko" : "na"}">${classe(sc, "gtr24", 22)} <strong>${esc(r.nom)}</strong> <small>${esc(FAMILLES_ROCHES[fam])}${r.detail ? ` — ${esc(r.detail)}` : ""}</small></p>
    ${tableau(["", "Météo « " + esc(NOM_METEO[meteo]) + " »"], [
      ["Remblai", !rem.trouve ? "cas absent des tableaux" : rem.non ? `${pastille(false, "", "NON")} ${esc(rem.non)}` : rem.renvoi ? `<small>${esc(rem.renvoi)}</small>` : rem.solutions.map((x) => codeHtml(x.code)).join(" ")],
      ["Couche de forme", !cdf.trouve ? "cas absent des tableaux" : cdf.texte ? `<small>${esc(cdf.texte)}</small>` : cdf.non ? `${pastille(false, "", "NON")} ${esc(cdf.non)}` : cdf.solutions.map((x) => codeHtml(x.code, RUBRIQUES_CDF)).join(" ")],
      ["En PST", pst.applicable ? `${esc(pst.pst)} · arase ${pst.ar.join(" ou ")}` : esc(pst.motif)],
      ["Gel (règles par défaut)", gel.classe ? `${esc(gel.classe)} — ${esc(gel.nom)}` : esc(gel.nom)],
    ])}`;
  const note = `
    <h3>1. Données</h3>
    ${donnees([["Famille", esc(FAMILLES_ROCHES[fam])], ["ρd", Number.isFinite(p.rhoD) ? `${fd(p.rhoD, 2)} Mg/m³` : ""], ["wn · wOPN", Number.isFinite(p.wn) ? `${fd(p.wn, 1)} · ${fd(p.wOPN, 1)} %` : ""],
      ["LA · MDE", [p.LA, p.MDE].map((x) => f(x, 3)).join(" · ")], ["IFR · IDGa", [p.IFR, p.IDGa].map((x) => f(x, 3)).join(" · ")], ["Gypse · sel", [p.gypse, p.sel].map((x) => (Number.isFinite(x) ? `${f(x, 3)} %` : "—")).join(" · ")]])}
    <h3>2. Classement (fascicule 2, annexe 1) : ${classe(sc)}</h3>
    <p>${esc(r.nom)}${r.detail ? ` — ${esc(r.detail)}` : ""}.</p>
    <h3>3. Conditions d'utilisation en remblai</h3>${rem.trouve ? tableSituations(rem.cas, RUBRIQUES_REMBLAI, meteo) : "<p>Cas absent des tableaux.</p>"}
    <h3>4. Conditions d'utilisation en couche de forme</h3>${cdf.trouve ? tableSituations(cdf.cas, RUBRIQUES_CDF, meteo) : "<p>Cas absent des tableaux.</p>"}
    <h3>5. PST et gel</h3><p>${pst.applicable ? `${esc(pst.pst)}, arase ${pst.ar.join(" ou ")} : ${esc(pst.motif)}.` : esc(pst.motif)} Gel : ${esc(gel.classe ?? "—")} (${esc(gel.etapes.join(" ; "))}).</p>`;
  return { figure: figureRoche(fam, p), synthese, note, verdict: okRemblai, resume: sc };
}
