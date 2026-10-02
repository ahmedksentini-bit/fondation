// Calculateurs du chapitre 7 : densité dans l'épaisseur d'une couche (modèle
// d'enseignement), prescription d'un compacteur par les tableaux Q/S de
// l'annexe 4, classe d'un compacteur, contrôle d'un atelier.
import { el, num, f, fd, esc, verdict, brancher, garde } from "./ui.js";
import { graphe, svg, ligne, texte, COULEURS } from "./figures.js";
import { OBJECTIFS, profilDensification, prescrire, debitPratique, controleAtelier, classeCompacteur, TABLEAUX, COMPACTEURS, ENERGIES } from "./gtr/compactage.js";

const propre = (t) => t.replace(/\(\*\)/g, "").replace(/\s+\/\s+/g, " · ").trim();

// ── Densité dans l'épaisseur ──────────────────────────────────────────────
const majGradient = garde("grOutD", () => {
  const e = num("grE"), N = num("grN"), o = OBJECTIFS[el("grObj").value];
  if (!(e > 0.05 && N >= 1)) { el("grOutD").textContent = "Renseigner l'épaisseur et le nombre d'applications."; return; }
  const p = profilDensification({ N, Nref: 5, e, eRef: 0.3 });
  const pts = Array.from({ length: 41 }, (_, i) => { const z = (e * i) / 40; return [p.taux(z), z]; });
  el("grFigD").innerHTML = graphe({
    largeur: 620, hauteur: 300, xmin: 80, xmax: 104, ymin: 0, ymax: Math.max(0.3, e), inverserY: true, pasX: 2,
    xlabel: "ρd / ρdOPN (%)", ylabel: "profondeur dans la couche (m)",
    zones: [{ x0: 80, x1: 104, y0: Math.max(0, e - 0.08), y1: e, couleur: "#f59e0b", opacite: 0.16, libelle: "fond de couche (8 cm)", position: "droite" }],
    series: [
      { points: pts, couleur: COULEURS.bleu, epaisseur: 2.8, libelle: "densité dans la couche" },
      { points: [[o.moyen, 0], [o.moyen, e]], couleur: COULEURS.gtr24, tirets: "6 4", epaisseur: 1.6, libelle: `${fd(o.moyen, 1)} % : objectif moyen` },
      { points: [[o.fond, 0], [o.fond, e]], couleur: COULEURS.rouge, tirets: "3 3", epaisseur: 1.6, libelle: `${fd(o.fond, 0)} % : objectif en fond` },
    ],
    marques: [{ x: p.moyen, y: e / 2, couleur: COULEURS.gtr24, libelle: `moyenne ${fd(p.moyen, 1)} %` }, { x: p.fond, y: e - 0.04, couleur: COULEURS.rouge, libelle: `fond ${fd(p.fond, 1)} %` }],
  });
  const okM = p.moyen >= o.moyen, okF = p.fond >= o.fond;
  el("grOutD").innerHTML = `Densité moyenne <strong>${fd(p.moyen, 1)} %</strong> ${verdict(okM, `≥ ${fd(o.moyen, 1)} %`, `< ${fd(o.moyen, 1)} %`)} · en fond de couche <strong>${fd(p.fond, 1)} %</strong> ${verdict(okF, `≥ ${fd(o.fond, 0)} %`, `< ${fd(o.fond, 0)} %`)}
    <small>${okM && okF ? "L'objectif est atteint dans toute l'épaisseur." : !okF && okM ? "La moyenne est bonne mais le fond de couche est insuffisant : la couche est trop épaisse pour ce compactage. Réduire e est plus efficace qu'ajouter des passes."
      : "Il manque de l'énergie : plus d'applications de charge, ou un compacteur plus lourd."}</small>`;
});
brancher(["grE", "grN", "grObj"], majGradient);

// ── Prescription par les tableaux ─────────────────────────────────────────
const REMBLAIS = TABLEAUX.map((t, i) => [t, i]).filter(([t]) => t.usage === "remblai");
el("qsTab").innerHTML = REMBLAIS.map(([t, i]) => `<option value="${i}">${esc(propre(t.titre))}</option>`).join("");
el("qsTab").value = String(REMBLAIS.find(([t]) => t.classes.includes("S1"))[1]);
const NOM_CODE = { 1: "1 — intense", 2: "2 — moyenne", 3: "3 — faible" };

function remplirCodes() {
  const t = TABLEAUX[Number(el("qsTab").value)], avant = el("qsCode").value;
  const codes = Object.keys(t.codes).sort();
  el("qsCode").innerHTML = codes.map((c) => `<option value="${c}">${NOM_CODE[c] ?? c}</option>`).join("");
  el("qsCode").value = codes.includes(avant) ? avant : codes.includes("2") ? "2" : codes[0];
  remplirCompacteurs();
}
function remplirCompacteurs() {
  const t = TABLEAUX[Number(el("qsTab").value)], cells = t.codes[el("qsCode").value], avant = el("qsComp").value;
  el("qsComp").innerHTML = COMPACTEURS.map((c) => `<option value="${c}"${cells[c] ? "" : " disabled"}>${c}${cells[c] ? "" : " (ne convient pas)"}</option>`).join("");
  const ok = COMPACTEURS.filter((c) => cells[c]);
  el("qsComp").value = ok.includes(avant) ? avant : ok.includes("P1") ? "P1" : ok[0];
}

const opt = (o) => `e ${fd(o.e, 2)} m · V ${f(o.V, 2)} km/h · N ${o.N} · Q/L ${f(o.QL, 3)}`;
const majQS = garde("qsOut", () => {
  const t = TABLEAUX[Number(el("qsTab").value)], code = el("qsCode").value, comp = el("qsComp").value, cells = t.codes[code];
  el("qsLigne").innerHTML = `<table class="resultats"><thead><tr><th>Compacteur</th><th class="num">Q/S (m)</th><th>Conditions du tableau (énergie ${esc(ENERGIES[code] ?? code)})</th></tr></thead><tbody>
    ${COMPACTEURS.map((c) => {
      const x = cells[c];
      return `<tr${c === comp ? ' style="background:#f0fdfa;outline:2px solid #0f766e"' : ""}><td><strong>${c}</strong></td><td class="n">${x ? fd(x.QS, 3) : "—"}</td><td class="motif">${x ? x.options.map(opt).join("<br>ou ") : "ne convient pas"}</td></tr>`;
    }).join("")}</tbody></table>
    <p class="method-note">Tableau « ${esc(propre(t.titre))} », fascicule 2, annexe 4, p. ${t.page}.${Object.keys(t.notes ?? {}).length ? ` Notes : ${Object.entries(t.notes).map(([k, v]) => `(${esc(k)}) ${esc(v)}`).join(" ")}` : ""}</p>`;
  const cell = cells[comp], e = num("qsE");
  const r = prescrire(cell, e);
  if (!r.applicable) { el("qsOut").innerHTML = `<span class="verdict ko">impossible</span> <small>${esc(r.motif)}</small>`; return; }
  const Nn = Number(el("qsTandem").value), L = num("qsL"), k = num("qsK");
  const Qp = debitPratique({ QL: r.QL, L, k, Nn });
  const passes = Math.ceil(r.N / Nn);
  el("qsOut").innerHTML = `Q/S = <strong>${fd(r.QS, 3)} m</strong> · e = ${fd(e, 2)} m · V = <strong>${f(r.V, 2)} km/h</strong> · N = ${fd(e, 2)}/${fd(r.QS, 3)} = ${fd(e / r.QS, 2)} → <strong>${r.N}</strong> applications, soit ${passes} passe${passes > 1 ? "s" : ""} ·
    Q/L = 1 000 × ${fd(r.QS, 3)} × ${f(r.V, 2)} = <strong>${f(r.QL, 3)} m³/h·m</strong> · Q<sub>prat</sub> = ${fd(k, 2)} × ${f(r.QL, 3)} × ${fd(L, 2)} × ${Nn} = <strong>${f(Qp, 3)} m³/h</strong>
    <small>${cell.options.length > 1 && e > Math.min(...cell.options.map((o) => o.e)) + 1e-9 ? "Vibrant à deux colonnes : la vitesse se déduit de V × e = constante, à partir de la colonne de droite (e maximale, V minimale). " : ""}Soit ${f(Qp * 8, 3)} m³ en 8 heures de présence sur le chantier.</small>`;
});
el("qsTab").addEventListener("change", () => { remplirCodes(); majQS(); });
el("qsCode").addEventListener("change", () => { remplirCompacteurs(); majQS(); });
remplirCodes();
brancher(["qsComp", "qsE", "qsL", "qsK", "qsTandem"], majQS);

// ── Classe d'un compacteur ────────────────────────────────────────────────
const CHAMPS_FAMILLE = { V: ["ccM", "ccL", "ccA"], VP: ["ccM", "ccL", "ccA"], P: ["ccCR"], SP: ["ccM", "ccL"], PQ: ["ccMgS"] };

/** Plan A0 – M1/L des vibrants : courbes (M1/L)·√A0 = constante, amplitudes minimales. */
function planVibrants(fam, M1L, A0) {
  const series = [15, 25, 40, 55, 70].map((p) => ({ points: Array.from({ length: 40 }, (_, i) => { const a = 0.4 + (1.8 * i) / 39; return [a, p / Math.sqrt(a)]; }), couleur: "#94a3b8", tirets: "5 4", epaisseur: 1.2 }));
  for (const a of [0.6, 0.8, 1, 1.3, 1.6]) series.push({ points: [[a, 0], [a, 80]], couleur: "#cbd5e1", epaisseur: 1 });
  const textes = [[0.7, 21, 1], [0.9, 34, 2], [1.15, 45, 3], [1.45, 53, 4], [1.95, 62, 5]].map(([x, y, k]) => ({ x, y, texte: `${fam}${k}`, couleur: "#0f766e", taille: 13 }));
  textes.push(...[15, 25, 40, 55, 70].map((p) => ({ x: 2.12, y: p / Math.sqrt(2.12) + 2, texte: String(p), couleur: "#64748b", taille: 10.5, gras: false })));
  return graphe({ largeur: 620, hauteur: 300, xmin: 0.4, xmax: 2.2, ymin: 0, ymax: 80, pasX: 0.2, pasY: 10, xlabel: "amplitude théorique à vide A0 (mm)", ylabel: "M1/L (kg/cm)", series, textes, legende: false,
    marques: Number.isFinite(M1L) && Number.isFinite(A0) ? [{ x: A0, y: M1L, couleur: COULEURS.rouge, libelle: "compacteur", guides: true }] : [] });
}

/** Réglette d'un critère unique (pneus, statiques à pieds, plaques). */
function reglette(valeur, bornes, noms, unite, max) {
  return svg({ largeur: 620, hauteur: 92, titre: "Classes", contenu: () => {
    const X = (v) => 30 + (Math.min(Math.max(v, 0), max) / max) * 560;
    let s = `<rect x="30" y="34" width="560" height="16" rx="8" fill="#e2e8f0"/>`;
    for (let i = 0; i < noms.length; i++) {
      const a = bornes[i], b = bornes[i + 1] ?? max;
      s += `<rect x="${X(a).toFixed(1)}" y="34" width="${(X(b) - X(a)).toFixed(1)}" height="16" fill="${noms[i] ? "#99f6e4" : "#e2e8f0"}" stroke="#fff"/>`;
      if (noms[i]) s += texte((X(a) + X(b)) / 2, 46, noms[i], 'text-anchor="middle" style="font-size:11px;font-weight:900;fill:#115e59"');
    }
    for (const b of bornes.slice(1)) s += texte(X(b), 66, `${b}`, 'text-anchor="middle" style="font-size:11px;fill:#334155"');
    s += texte(590, 84, unite, 'text-anchor="end" style="font-size:11px;fill:#64748b"');
    if (Number.isFinite(valeur)) s += `<path d="M${X(valeur).toFixed(1)} 32l-6 -10h12z" fill="${COULEURS.rouge}"/>` + texte(X(valeur), 18, String(valeur).replace(".", ","), 'text-anchor="middle" class="halo" style="font-weight:900;fill:#b91c1c"');
    return s;
  } });
}

const majClasse = garde("ccOut", () => {
  const fam = el("ccFam").value;
  for (const id of ["ccM", "ccL", "ccA", "ccCR", "ccMgS"]) el(id).closest(".field").hidden = !CHAMPS_FAMILLE[fam].includes(id);
  const M1L = num("ccM") / num("ccL"), A0 = num("ccA"), CR = num("ccCR"), MgS = num("ccMgS");
  const r = classeCompacteur(fam, { CR, M1L, A0, MgS });
  el("ccFig").innerHTML = fam === "V" || fam === "VP" ? planVibrants(fam, M1L, A0)
    : fam === "P" ? reglette(CR, [0, 25, 40, 60], [null, "P1", "P2", "P3"], "charge par roue (kN)", 90)
      : fam === "SP" ? reglette(Math.round(M1L * 10) / 10, [0, 30, 60, 90], [null, "SP1", "SP2", null], "M1/L (kg/cm)", 110)
        : reglette(MgS, [0, 10, 15], [null, "PQ3", "PQ4"], "Mg/S (kPa)", 25);
  const detail = fam === "V" || fam === "VP" ? `M1/L = ${fd(M1L, 1)} kg/cm · (M1/L)·√A0 = ${fd(M1L * Math.sqrt(A0), 1)} · A0 = ${fd(A0, 2)} mm` : fam === "SP" ? `M1/L = ${fd(M1L, 1)} kg/cm` : "";
  el("ccOut").innerHTML = r.applicable
    ? `${detail ? `${detail} → ` : ""}classe <span class="classe">${r.classe}</span>${r.limite && r.limite !== "les deux critères" ? ` <small>La classe est limitée par ${r.limite}.</small>` : ""}`
    : `${detail ? `${detail} · ` : ""}<span class="verdict ko">hors classes</span> <small>${esc(r.motif)}</small>`;
});
brancher(["ccFam", "ccM", "ccL", "ccA", "ccCR", "ccMgS"], majClasse);

// ── Atelier de compactage ─────────────────────────────────────────────────
const majAtelier = garde("atOutA", () => {
  const Q = num("atQ");
  const engins = [[num("atS1"), num("atQS1")], [num("atS2"), num("atQS2")]].filter(([S, q]) => S > 0 && q > 0).map(([S, QStableau]) => ({ S, QStableau }));
  if (!(Q > 0) || !engins.length) { el("atOutA").textContent = "Renseigner Q et au moins un compacteur."; el("atFigA").innerHTML = ""; return; }
  const r = controleAtelier({ Q, engins });
  const max = Math.max(1.25, r.somme * 1.1);
  el("atFigA").innerHTML = svg({ largeur: 620, hauteur: 96, titre: "Contributions des compacteurs", contenu: () => {
    const X = (v) => 30 + (v / max) * 560;
    let s = `<rect x="30" y="30" width="560" height="26" rx="6" fill="#f1f5f9"/>`, x0 = 0;
    r.termes.forEach((t, i) => {
      s += `<rect x="${X(x0).toFixed(1)}" y="30" width="${(X(x0 + t.part) - X(x0)).toFixed(1)}" height="26" fill="${i ? "#38bdf8" : "#0369a1"}" stroke="#fff"/>`;
      if (X(x0 + t.part) - X(x0) > 60) s += texte((X(x0) + X(x0 + t.part)) / 2, 47, `n° ${i + 1} : ${fd(t.part, 3)}`, 'text-anchor="middle" style="font-size:11px;font-weight:800;fill:#fff"');
      x0 += t.part;
    });
    s += ligne(X(1), 20, X(1), 66, COULEURS.rouge, 2.2) + texte(X(1), 80, "1 : énergie suffisante", 'text-anchor="middle" class="halo" style="font-size:11px;font-weight:800;fill:#b91c1c"');
    return s;
  } });
  el("atOutA").innerHTML = r.termes.map((t, i) => `Q/S<sub>${i + 1}</sub> = ${f(Q, 4)}/${f(t.S, 5)} = ${fd(t.QSreel, 3)} m → ${fd(t.QStableau, 3)}/${fd(t.QSreel, 3)} = ${fd(t.part, 3)}`).join(" · ")
    + ` · Σ = <strong>${fd(r.somme, 3)}</strong> ${verdict(r.ok, "compactage suffisant", "compactage insuffisant")}
    <small>${r.ok ? "Les compacteurs ont balayé assez de surface pour le volume mis en œuvre." : `Il manque ${f(Q / Math.max(...engins.map((x) => x.QStableau)) * (1 - r.somme), 3)} m² environ de surface balayée au Q/S du tableau, ou il fallait mettre en œuvre moins de volume.`}</small>`;
});
brancher(["atQ", "atS1", "atQS1", "atS2", "atQS2"], majAtelier);
