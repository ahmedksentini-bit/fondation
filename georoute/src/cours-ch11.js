// Calculateurs du chapitre 11 : plus gros éléments d'une couche de forme,
// classe mécanique d'un matériau traité (abaque E–Rt à 90 jours), conditions
// d'utilisation en couche de forme (annexe 3), épaisseur et modèle bicouche.
import { el, num, f, fd, esc, verdict, brancher, garde } from "./ui.js";
import { graphe, COULEURS } from "./figures.js";
import { lmaxCoucheForme, epaisseur2000 } from "./gtr/couche-forme.js";
import { zoneMecanique, classeMecanique, FRONTIERES_ZONES, rtFrontiere } from "./gtr/traitement.js";
import { RUBRIQUES_CDF, METEOS, couvre } from "./gtr/utilisation.js";
import { COUCHE_FORME } from "./gtr/tables-couche-forme.js";
import { bicouche, epaisseurPour, CLASSES_PF } from "./gtr/portance.js";
import { MODULE_AR } from "./gtr/pst.js";
import { codeHtml } from "./codes.js";

// ── Plus gros éléments ────────────────────────────────────────────────────
const TABLEAU_13 = { 0.3: [150, "0/90"], 0.35: [175, "0/100"], 0.4: [200, "0/120"], 0.45: [225, "0/135"], 0.5: [250, "0/150"], 0.6: [250, "0/150"] };
const majLmax = garde("lmOut", () => {
  const e = num("lmE"), L = num("lmL");
  if (!(e > 0)) { el("lmOut").textContent = "Renseigner l'épaisseur."; return; }
  const max = lmaxCoucheForme(e), t = TABLEAU_13[Math.round(e * 100) / 100];
  el("lmOut").innerHTML = `L<sub>max</sub> admise = min(250 ; ${f(e * 1000, 3)}/2) = <strong>${f(max, 3)} mm</strong>${t ? ` — matériau 0/D correspondant : ${t[1]} mm (tableau 13)` : ""}
    ${Number.isFinite(L) ? ` · matériau à ${f(L, 3)} mm : ${verdict(L <= max, "convient", "trop gros")}` : ""}
    <small>${Number.isFinite(L) && L > max ? `Il faut ${L > 250 ? "écrêter le matériau à 250 mm" : `une couche d'au moins ${fd((2 * L) / 1000, 2)} m`} ou éliminer les plus gros éléments. ` : ""}Pour des éléments non allongés, L<sub>max</sub> vaut 1,4 à 2 fois le D<sub>max</sub>.</small>`;
});
brancher(["lmE", "lmL"], majLmax);

// ── Classe mécanique d'un matériau traité ─────────────────────────────────
const majZone = garde("zoOut", () => {
  const E = num("zoE"), Rt = num("zoRt"), mode = el("zoMode").value;
  const z = zoneMecanique({ E, Rt });
  if (!z.applicable) { el("zoOut").textContent = z.motif; el("zoFig").innerHTML = ""; return; }
  const series = FRONTIERES_ZONES.map((c, i) => ({ points: Array.from({ length: 40 }, (_, k) => { const x = 1000 * 50 ** (k / 39); return [x, rtFrontiere(c, x)]; }), couleur: "#334155", epaisseur: i === 4 ? 2 : 1.5, tirets: i === 4 ? "5 3" : null }));
  // Libellés au milieu de chaque bande (en échelle logarithmique), vers la droite où elles s'élargissent.
  const xL = 14000, milieu = (k) => Math.sqrt(rtFrontiere(FRONTIERES_ZONES[k - 2], xL) * rtFrontiere(FRONTIERES_ZONES[k - 1], xL));
  const textes = [{ x: 2400, y: 1.6, texte: "zone 1", couleur: "#0f766e", taille: 12 },
    ...[2, 3, 4, 5].map((k) => ({ x: xL, y: milieu(k), texte: `zone ${k}`, couleur: "#0f766e", taille: 11 })),
    { x: xL, y: 0.14, texte: "non classable", couleur: COULEURS.rouge, taille: 11 }];
  el("zoFig").innerHTML = graphe({
    largeur: 620, hauteur: 320, xmin: 1000, xmax: 50000, ymin: 0.08, ymax: 3.5, logX: true, logY: true,
    xlabel: "module d'Young E à 90 jours (MPa)", ylabel: "Rt à 90 jours (MPa)", series, textes, legende: false,
    marques: [{ x: Math.min(Math.max(E, 1000), 50000), y: Math.min(Math.max(Rt, 0.08), 3.5), couleur: COULEURS.rouge, libelle: "matériau", guides: true }],
  });
  const cl = classeMecanique(z.zone, mode);
  el("zoOut").innerHTML = z.zone ? `Zone <strong>${z.zone}</strong> · traitement ${mode === "centrale" ? "en centrale" : "en place"} → classe mécanique ${cl ? `<span class="classe">${cl}</span>` : '<span class="verdict ko">non classable</span>'}
    <small>${z.horsAbaque ? "Module hors de l'abaque (1 000 à 50 000 MPa) : lecture extrapolée au bord. " : ""}${mode === "place" ? "En place, le mélange est moins homogène : la classe descend d'un rang par rapport à la zone." : "En centrale, la classe est celle de la zone."}</small>`
    : `<span class="verdict ko">sous la zone 5</span> <small>Performances insuffisantes pour une couche de forme traitée : revoir le liant, le dosage ou la compacité.</small>`;
});
brancher(["zoE", "zoRt", "zoMode"], majZone);

// ── Conditions d'utilisation en couche de forme ───────────────────────────
const libelle = (c) => (c.classes.length > 5 ? `${c.classes.slice(0, 4).join(", ")}… (${c.classes.length} classes)` : c.classes.join(", "));
el("cfClasse").innerHTML = COUCHE_FORME.map((c, i) => `<option value="${i}">${esc(libelle(c))}</option>`).join("");
el("cfClasse").value = String(COUCHE_FORME.findIndex((c) => c.classes.includes("G31")));
const NOM_METEO = Object.fromEntries(METEOS.map((m) => [m.symbole, m.nom]));
const majCdf = garde("cfOut", () => {
  const c = COUCHE_FORME[Number(el("cfClasse").value)], meteo = el("cfMeteo").value;
  const tete = `<p>${c.classes.map((k) => `<span class="classe gtr24">${esc(k)}</span>`).join(" ")} <small>fascicule 2, annexe 3, p. ${c.page}</small></p>`;
  if (c.texte) { el("cfOut").innerHTML = tete + `<p class="method-note">${esc(c.texte)}</p>`; return; }
  const lignes = (c.situations ?? []).map((s) => {
    const choisie = couvre(s.meteo, meteo);
    const contenu = s.non ? `<p><span class="verdict ko">NON</span> ${esc(s.non)}</p>` : s.solutions.map((x) => `<div style="margin:6px 0">${x.titre ? `<strong>${esc(x.titre)}</strong> ` : ""}${codeHtml(x.code, RUBRIQUES_CDF)}
        <ul style="margin:4px 0 0 18px">${x.conditions.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>`).join("");
    return `<tr${choisie ? ' style="background:#f0fdfa;outline:2px solid #0f766e"' : ""}><td style="white-space:nowrap"><strong>${esc(String(s.meteo).replaceAll("-", "−"))}</strong><small>${esc(s.libelle || "")}</small></td><td>${contenu}</td></tr>`;
  }).join("");
  const couverte = (c.situations ?? []).some((s) => couvre(s.meteo, meteo));
  el("cfOut").innerHTML = tete + `<table class="resultats"><thead><tr><th>Météo</th><th>Conditions d'utilisation</th></tr></thead><tbody>${lignes}</tbody></table>`
    + (couverte ? "" : `<p class="method-note">La situation « ${esc(NOM_METEO[meteo])} » n'est pas décrite pour ce matériau : pas d'emploi prévu en couche de forme dans ces conditions.</p>`);
});
brancher(["cfClasse", "cfMeteo"], majCdf);

// ── Épaisseur et modèle bicouche ──────────────────────────────────────────
const majEpaisseur = garde("epOut", () => {
  const type = el("epType").value, ar = el("epAr").value, pf = el("epPf").value, classe = Number(el("epClasse").value), E1 = num("epE1");
  el("epClasse").closest(".field").hidden = type !== "grenuTraite";
  const r = epaisseur2000({ type, ar, pf, classe });
  const E2 = MODULE_AR[ar];
  const cible = CLASSES_PF.find((c) => c.classe === pf)?.min;
  const pts = Array.from({ length: 51 }, (_, i) => { const h = i / 50; return [h, bicouche({ E1, E2, h }).Es]; });
  const ymax = Math.max(cible * 1.4, 150);
  const marques = [];
  if (r.applicable) marques.push({ x: r.e, y: bicouche({ E1, E2, h: r.e }).Es, couleur: COULEURS.rouge, libelle: `GTR 2000 : ${fd(r.e, 2)} m`, guides: true });
  el("epFig").innerHTML = graphe({
    largeur: 620, hauteur: 300, xmin: 0, xmax: 1, ymin: 0, ymax: Math.min(ymax, 400), pasX: 0.1,
    xlabel: "épaisseur de la couche de forme h (m)", ylabel: "module en surface Es (MPa)",
    series: [
      { points: pts, couleur: COULEURS.bleu, epaisseur: 2.6, libelle: `bicouche E1 = ${f(E1, 4)} MPa sur E2 = ${E2} MPa` },
      ...CLASSES_PF.filter((c) => c.min < ymax).map((c) => ({ points: [[0, c.min], [1, c.min]], couleur: c.classe === pf ? COULEURS.gtr24 : "#cbd5e1", epaisseur: c.classe === pf ? 1.8 : 1, tirets: "5 4", libelle: c.classe === pf ? `seuil ${c.classe} : ${c.min} MPa` : null })),
    ],
    marques,
  });
  const hModele = epaisseurPour({ E1, E2, Evise: cible });
  el("epOut").innerHTML = (r.applicable ? `GTR 2000 : <strong>${fd(r.e, 2)} m</strong> pour passer de ${ar} à ${pf}${r.notes.length ? ` <small>${r.notes.map(esc).join(" ; ")}.</small>` : ""}` : `<span class="verdict na">non tabulé</span> <small>${esc(r.motif)}</small>`)
    + `<br>Modèle bicouche : ${Number.isFinite(hModele) ? `E<sub>s</sub> atteint ${cible} MPa pour h ≈ <strong>${fd(hModele, 2)} m</strong>` : `E<sub>s</sub> n'atteint pas ${cible} MPa avec ce module de couche`} <small>Le modèle ignore la fatigue des matériaux traités, le gel et le trafic de chantier : il montre la tendance, les tableaux du guide font foi.</small>`;
});
// Module type de chaque couche de forme : granulaire 400 MPa, sol fin traité 600 à 1 000 MPa, grenu traité 5 000 MPa.
const E1_TYPE = { nonTraite: 400, finChaux: 600, finChauxCiment: 1000, grenuTraite: 5000 };
el("epType").addEventListener("change", () => { el("epE1").value = String(E1_TYPE[el("epType").value]); el("epE1").dispatchEvent(new Event("input")); });
el("epE1").value = String(E1_TYPE[el("epType").value]);
brancher(["epType", "epAr", "epClasse", "epPf", "epE1"], majEpaisseur);
