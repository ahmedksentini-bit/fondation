// Modules « mise en œuvre » du bureau de calcul : prescription de compactage
// (tableaux de l'annexe 4, atelier ou compacteur mixte), traitement à la
// chaux vive, mouvement des terres et ateliers de transport.

import { esc, f, fd, nombre, lignes, pastille, tableau, donnees } from "./commun.js";
import { TABLEAUX, COMPACTEURS, ENERGIES, OBJECTIFS, prescrire, debitPratique, mixte } from "../gtr/compactage.js";
import { ETATS_2024, etatHydrique, intervalle } from "../gtr/classification.js";
import { aptitudeTraitement, chauxVive, dosagePour, quantite } from "../gtr/traitement.js";
import { volumes, epure, repartition } from "../gtr/cubatures.js";
import { atelier } from "../gtr/engins.js";
import { graphe, svg, texte, ligne, COULEURS } from "../figures.js";

const propre = (t) => String(t).replace(/\(\*\)/g, "").replace(/\s+\/\s+/g, " · ").replace(/\s+/g, " ").trim();

// ───────────────────────────── Compactage ─────────────────────────────

/** Choix des tableaux : « r:i » pour un tableau de remblai, « c:i:j » pour une ligne de couche de forme. */
export const OPTIONS_TABLEAUX = [
  ...TABLEAUX.map((t, i) => [t, i]).filter(([t]) => t.usage === "remblai").map(([t, i]) => [`r:${i}`, `Remblai (q4) · ${propre(t.titre)}`]),
  ...TABLEAUX.map((t, i) => [t, i]).filter(([t]) => t.lignes).flatMap(([t, i]) => t.lignes.map((l, j) => [`c:${i}:${j}`, `Couche de forme (q3) · ${propre(l.libelle)}`])),
];
export const OPTIONS_COMPACTEURS = [["", "—"], ...COMPACTEURS.map((c) => [c, c])];

function tableauChoisi(cle) {
  const [u, i, j] = String(cle).split(":");
  const t = TABLEAUX[Number(i)];
  if (!t) throw new Error("tableau de compactage inconnu");
  return u === "c" ? { t, ligne: t.lignes?.[Number(j)], usage: "couche de forme" } : { t, ligne: null, usage: "remblai" };
}

export function calculerCompactage(v) {
  const { t, ligne: l, usage } = tableauChoisi(v.table);
  const code = String(v.code);
  const cellules = l ? l.cellules : t.codes?.[code];
  if (!cellules) throw new Error(`pas de code d'énergie ${code} dans ce tableau (codes ${Object.keys(t.codes ?? {}).join(", ")})`);
  const e = nombre(v.e), k = nombre(v.k, 0.6), Q = nombre(v.Q), heures = nombre(v.heures, 8);
  if (!(e > 0)) throw new Error("épaisseur de couche à renseigner");
  const choisis = [[v.c1, nombre(v.L1), nombre(v.Nn1, 1)], [v.c2, nombre(v.L2), nombre(v.Nn2, 1)]].filter(([c]) => c);
  if (!choisis.length) throw new Error("choisir au moins un compacteur");
  const pres = choisis.map(([c, L, Nn]) => {
    const r = prescrire(cellules[c], e);
    return { c, L, Nn, r, Qprat: r.applicable ? debitPratique({ QL: r.QL, L, k, Nn }) : NaN };
  });
  const mixteActif = v.mode === "mixte" && pres.length === 2 && pres.every((p) => p.r.applicable);
  let total, lignesPres;
  if (mixteActif) {
    const m = mixte({ QS: pres[0].r.QS, e, V: pres[0].r.V }, { QS: pres[1].r.QS, e, V: pres[1].r.V });
    const L = Math.min(pres[0].L, pres[1].L);
    total = debitPratique({ QL: m.QL, L, k, Nn: 1 });
    lignesPres = [[`${esc(pres[0].c)} + ${esc(pres[1].c)} (mixte)`, fd(m.QS, 3), fd(e, 2), f(m.V, 2), `${m.N}`, f(m.QL, 3), f(total, 3)]];
  } else {
    total = pres.reduce((s, p) => s + (Number.isFinite(p.Qprat) ? p.Qprat : 0), 0);
    lignesPres = pres.map((p) => p.r.applicable
      ? [esc(p.c), fd(p.r.QS, 3), fd(e, 2), f(p.r.V, 2), `${p.r.N}${p.Nn === 2 ? ` (${Math.ceil(p.r.N / 2)} passes)` : ""}`, f(p.r.QL, 3), f(p.Qprat, 3)]
      : [esc(p.c), "—", fd(e, 2), "—", "—", "—", `<span class="verdict ko">${esc(p.r.motif)}</span>`]);
  }
  const tousOk = pres.every((p) => p.r.applicable);
  const besoin = Q > 0 ? Q / heures : NaN;
  const capaciteOk = Number.isFinite(besoin) ? total >= besoin - 1e-9 : null;
  const verdict = tousOk && capaciteOk !== false;
  // Surface que chaque compacteur doit balayer s'il compactait seul le volume du jour.
  const surfaces = Q > 0 ? pres.filter((p) => p.r.applicable).map((p) => [esc(p.c), `${f(Q / p.r.QS, 4)} m²`, `${fd(Q / p.r.QS / p.L / 1000, 1)} km`]) : [];
  const max = Math.max(total, besoin || 0) * 1.25 || 1;
  // Figure étroite (420 de large) : elle reste lisible dans la colonne des résultats.
  const figure = svg({ largeur: 420, hauteur: 150, titre: "Débit de l'atelier", contenu: () => {
    const X = (x) => 20 + (x / max) * 380;
    let s = texte(20, 24, "débit pratique de l'atelier", 'style="font-weight:800;font-size:12px"');
    let x0 = 0;
    (mixteActif ? [{ c: `${pres[0].c} + ${pres[1].c}`, Qprat: total }] : pres).forEach((p, i) => {
      if (!(p.Qprat > 0)) return;
      s += `<rect x="${X(x0).toFixed(1)}" y="34" width="${(X(x0 + p.Qprat) - X(x0)).toFixed(1)}" height="28" fill="${i ? "#38bdf8" : "#0369a1"}" stroke="#fff"/>`;
      if (X(x0 + p.Qprat) - X(x0) > 60) s += texte((X(x0) + X(x0 + p.Qprat)) / 2, 53, `${p.c} : ${f(p.Qprat, 3)}`, 'text-anchor="middle" style="font-size:11px;font-weight:800;fill:#fff"');
      x0 += p.Qprat;
    });
    if (Number.isFinite(besoin)) s += ligne(X(besoin), 28, X(besoin), 70, COULEURS.rouge, 2.2) + texte(Math.min(Math.max(X(besoin), 110), 310), 90, `besoin : ${f(besoin, 3)} m³/h`, 'text-anchor="middle" class="halo" style="font-size:12px;font-weight:800;fill:#b91c1c"')
      + texte(Math.min(Math.max(X(besoin), 110), 310), 106, `(${f(Q, 4)} m³ en ${f(heures, 2)} h)`, 'text-anchor="middle" class="halo" style="font-size:11px;fill:#b91c1c"');
    s += ligne(20, 124, 400, 124, "#94a3b8", 1) + texte(400, 140, "m³/h", 'text-anchor="end" style="font-size:11px;fill:#64748b"');
    return s;
  } });
  const objectif = usage === "remblai" ? OBJECTIFS.q4 : OBJECTIFS.q3;
  const synthese = `
    <p class="final-result bureau-verdict ${verdict ? "ok" : "ko"}">${tousOk ? `Débit pratique de l'atelier : <strong>${f(total, 3)} m³/h</strong>` : "Un compacteur ne convient pas"} ${pastille(capaciteOk, "cadence tenue", "cadence non tenue")}
      <small>${esc(propre(t.titre))}${l ? ` — ${esc(propre(l.libelle))}` : ` — énergie ${esc(ENERGIES[code] ?? code)} (code ${esc(code)})`} · objectif ${esc(objectif.nom)}.</small></p>
    ${tableau(["Compacteur", "Q/S (m)", "V (km/h)", "N", "Q<sub>prat</sub> (m³/h)"], lignesPres.map((r) => [r[0], r[1], r[3], r[4], r[6]]))}
    ${capaciteOk === false ? `<p class="method-note">Il manque ${f(besoin - total, 3)} m³/h : ajouter un compacteur, en prendre un plus lourd, ou réduire la cadence de mise en œuvre.</p>` : ""}`;
  const note = `
    <h3>1. Données</h3>
    ${donnees([["Tableau de compactage", `${esc(propre(t.titre))}, fascicule 2, annexe 4, p. ${t.page}`], ["Usage et objectif", `${usage} · ${esc(objectif.nom)} (ρd ≥ ${fd(objectif.moyen, 1)} % ρdOPN en moyenne, ${fd(objectif.fond, 0)} % en fond)`],
      ["Énergie (code C du tableau d'utilisation)", l ? "ligne de couche de forme" : `${esc(code)} — ${esc(ENERGIES[code] ?? "")}`], ["Épaisseur compactée e", `${fd(e, 2)} m`],
      ["Rendement k", fd(k, 2)], ["Cadence", Q > 0 ? `${f(Q, 4)} m³ en ${f(heures, 2)} h` : ""], ["Organisation", mixteActif ? "compacteur mixte" : pres.length > 1 ? "atelier de compactage" : "un compacteur"]])}
    <h3>2. Prescriptions (méthode Q/S)</h3>
    <p class="formula">N = ⌈e / (Q/S)⌉ · Q/L = 1 000 (Q/S) V · Q<sub>prat</sub> = k (Q/L) L (N/n)</p>
    ${tableau(["Compacteur", "Q/S (m)", "e (m)", "V (km/h)", "N", "Q/L (m³/h·m)", "Q<sub>prat</sub> (m³/h)"], lignesPres)}
    ${pres.filter((p) => p.r.applicable && cellules[p.c].options.length > 1).map((p) => `<p class="method-note">${esc(p.c)} : vibrant à deux colonnes, vitesse déduite de V × e = constante à partir de la colonne de droite.</p>`).join("")}
    ${mixteActif ? `<p class="method-note">Compacteur mixte : Q/S somme des deux, e et V les plus faibles, N/n = 1 [F2 annexe 4].</p>` : ""}
    <h3>3. Contrôle du Q/S sur le chantier</h3>
    ${surfaces.length ? `<p>Pour le volume du jour, chaque compacteur doit balayer au moins (s'il compactait seul) :</p>${tableau(["Compacteur", "Surface S = Q/(Q/S)", "Distance de compactage"], surfaces)}
      ${pres.length > 1 ? `<p class="formula">Atelier : Σ (Q/S)<sub>tableau,i</sub> × S<sub>i</sub> / Q ≥ 1</p>` : ""}` : "<p>Renseigner la cadence pour obtenir les surfaces à balayer.</p>"}`;
  return { figure, synthese, note, verdict, resume: tousOk ? `${f(total, 3)} m³/h` : "compacteur inadapté" };
}

// ───────────────────────────── Traitement ─────────────────────────────

export const OPTIONS_ETATS = Object.keys(ETATS_2024).map((k) => [k, k.replace(">70", " (2 mm > 70 %)").replace("≤70", " (2 mm ≤ 70 %)")]);
const TEINTE = { th: "#1e3a8a", h: "#3b82f6", m: "#22c55e", s: "#f59e0b", ts: "#b45309" };

export function calculerTraitement(v) {
  const cle = v.cle, t = ETATS_2024[cle];
  if (!t) throw new Error("sous-classe sans seuils d'état");
  const w = nombre(v.w), wOPN = nombre(v.wOPN), IPI = nombre(v.IPI), C = nombre(v.dosage), eta = nombre(v.eta, 0.5);
  if (!(w > 0 && wOPN > 0 && C >= 0)) throw new Error("renseigner w, wOPN et le dosage");
  const avant = etatHydrique(cle, { w, wOPN, IPI });
  const r = chauxVive({ w, dosage: C, eta });
  const apres = etatHydrique(cle, { w: r.wFinal, wOPN });
  const ligneM = t.lignes.find((x) => x.etat === "m");
  const rMax = ligneM?.r ? intervalle(ligneM.r).b : 1.1;
  const wVise = rMax * wOPN - 0.05;
  const d = dosagePour({ w, wVise, eta });
  const apt = aptitudeTraitement({ Gv: nombre(v.Gv), Rtb: nombre(v.Rtb) });
  const rhoD = nombre(v.rhoD), e = nombre(v.e), S = nombre(v.S), b = nombre(v.bache);
  const q = rhoD > 0 && e > 0 ? quantite({ dosage: C, rhoD, e, surface: S > 0 ? S : 1 }) : null;
  const ecart = q && b > 0 ? (100 * (b - q.q)) / q.q : NaN;
  const okEtat = apres.applicable && (apres.etat === "m" || apres.etat === "s");
  const verdict = (apt.applicable ? apt.verdict === "apte" : true) && okEtat;
  // Teneur en eau après traitement en fonction du dosage, devant les bandes d'état (w = r wOPN).
  const zones = t.lignes.filter((x) => x.r).map((x) => { const I = intervalle(x.r); return { x0: 0, x1: 6, y0: Math.max(I.a * wOPN, 0), y1: Math.min(I.b * wOPN, w + 4), couleur: TEINTE[x.etat], opacite: 0.14, libelle: x.etat, position: "droite" }; })
    .filter((z) => z.y1 > z.y0);
  const figure = graphe({
    largeur: 620, hauteur: 290, xmin: 0, xmax: 6, ymin: Math.max(0, Math.floor(w - 9)), ymax: Math.ceil(w + 2), pasX: 1,
    xlabel: "dosage en chaux vive (%)", ylabel: "teneur en eau après traitement (%)", zones,
    series: [{ points: Array.from({ length: 31 }, (_, i) => { const x = (6 * i) / 30; return [x, chauxVive({ w, dosage: x, eta }).wFinal]; }), couleur: COULEURS.bleu, epaisseur: 2.6, libelle: `η = ${fd(eta, 2)}` }],
    marques: [{ x: C, y: r.wFinal, couleur: COULEURS.rouge, libelle: `${fd(r.wFinal, 1)} %`, guides: true }],
  });
  const synthese = `
    <p class="final-result bureau-verdict ${verdict ? "ok" : "ko"}">${cle} : état <strong>${esc(avant.etat ?? "?")}</strong> → <strong>${esc(apres.etat ?? "?")}</strong> avec ${fd(C, 1)} % de chaux vive (w ${fd(w, 1)} → ${fd(r.wFinal, 1)} %)
      <small>${typeof d === "number" ? `Dosage pour atteindre l'état m (w < ${fd(rMax, 2)} wOPN = ${fd(rMax * wOPN, 1)} %) : <strong>${fd(d, 1)} %</strong>.` : esc(d.motif)}</small></p>
    ${tableau(["Contrôle", "Résultat"], [
      ["Aptitude au traitement (NF P94-100)", apt.applicable ? `${pastille(apt.verdict === "apte", "apte", apt.verdict)} <small>${esc(apt.motif)}</small>` : "non renseignée"],
      ["Quantité à épandre", q ? `<strong>${fd(q.q, 1)} kg/m²</strong>${S > 0 ? ` · ${f(q.total, 3)} t pour ${f(S, 5)} m²` : ""}` : "—"],
      ["Contrôle à la bâche", Number.isFinite(ecart) ? `${fd(b, 1)} kg/m², écart ${ecart >= 0 ? "+" : "−"}${fd(Math.abs(ecart), 1)} %` : "—"],
    ])}`;
  const note = `
    <h3>1. Données</h3>
    ${donnees([["Sous-classe (seuils d'état)", esc(cle)], ["w · wOPN", `${fd(w, 1)} · ${fd(wOPN, 1)} %`], ["IPI avant traitement", f(IPI, 3)], ["Dosage en chaux vive", `${fd(C, 1)} %`], ["Part de chaleur évaporant de l'eau η", fd(eta, 2)],
      ["ρd · épaisseur · surface", `${fd(rhoD, 2)} Mg/m³ · ${fd(e, 2)} m · ${f(S, 5)} m²`], ["Aptitude : Gv · Rtb", `${f(nombre(v.Gv), 3)} % · ${f(nombre(v.Rtb), 3)} MPa`]])}
    <h3>2. État hydrique avant traitement</h3><p>${avant.applicable ? `${esc(avant.etat)} (par ${esc(avant.par)}) — ${avant.mesures.map(([p, e2, x]) => `${esc(p)} = ${fd(x, 2)} → ${esc(e2)}`).join(" ; ")}` : esc(avant.motif)}</p>
    <h3>3. Effet de la chaux vive</h3>
    <p class="formula">w' = (w − 0,32 C − 0,51 η C) / (100 + 1,32 C) × 100 = ${fd(r.wFinal, 2)} %</p>
    <p>Hydratation −${fd(r.eauHydratation, 2)} point, évaporation −${fd(r.eauEvaporee, 2)}, apport de matière sèche −${fd(r.dilution, 2)} : soit −${fd(r.baisse, 2)} point. Après traitement, w'/wOPN = ${fd(r.wFinal / wOPN, 2)} → état <strong>${esc(apres.etat ?? "?")}</strong>.</p>
    <h3>4. Quantités</h3><p class="formula">q = dosage × ρd × e = ${fd(C, 1)} % × ${f(rhoD * 1000, 4)} × ${fd(e, 2)} = ${q ? fd(q.q, 1) : "—"} kg/m²</p>`;
  return { figure, synthese, note, verdict, resume: `${avant.etat ?? "?"} → ${apres.etat ?? "?"} (${fd(C, 1)} %)` };
}

// ───────────────────────────── Mouvement des terres ─────────────────────────────

export function calculerMouvement(v) {
  const profils = lignes(v.profils).filter((p) => p.length >= 3).map(([x, deblai, remblai]) => ({ x, deblai, remblai }));
  if (profils.length < 2) throw new Error("il faut au moins deux profils (x, déblai, remblai)");
  const reemploi = nombre(v.reemploi, 1), Ct = nombre(v.Ct, 1), Cf = nombre(v.Cf, 1.25), c = nombre(v.c, 0), heures = nombre(v.heures, 8);
  const vol = volumes(profils), ep = epure(vol.troncons, { reemploi, Ct }), rep = repartition(ep.points, c);
  const engins = { q: nombre(v.q), tc: nombre(v.tc, 20), Cf, capacite: nombre(v.capacite), vCharge: nombre(v.vCharge, 20), vVide: nombre(v.vVide, 35), tFixe: nombre(v.tFixe, 120) };
  const nCamions = nombre(v.n) > 0 ? Math.round(nombre(v.n)) : null;
  const boucles = rep.boucles.map((b) => {
    const at = engins.q > 0 && engins.capacite > 0 ? atelier({ ...engins, distance: Math.max(b.distance, 30), nCamions }) : null;
    const enPlace = b.volume / Ct;
    const jours = at ? enPlace / at.Q / heures : NaN;
    return { ...b, at, enPlace, jours };
  });
  const ys = ep.points.map((p) => p[1]);
  const ymin = Math.min(0, c, ...ys), ymax = Math.max(0, c, ...ys), marge = 0.12 * (ymax - ymin || 1);
  const figure = graphe({
    largeur: 620, hauteur: 300, xmin: ep.points[0][0], xmax: ep.points.at(-1)[0], ymin: ymin - marge, ymax: ymax + marge,
    xlabel: "abscisse (m)", ylabel: "volume cumulé (m³)",
    series: [
      { points: ep.points, couleur: COULEURS.bleu, epaisseur: 2.6, marqueurs: true, libelle: "épure de Lalanne" },
      { points: [[ep.points[0][0], c], [ep.points.at(-1)[0], c]], couleur: COULEURS.rouge, epaisseur: 1.8, tirets: "6 4", libelle: "ligne de répartition" },
    ],
    marques: rep.coupes.map((x) => ({ x, y: c, couleur: COULEURS.rouge, rayon: 4 })),
  });
  const bout = (x) => (Math.abs(x) < 1 ? "—" : x > 0 ? `${f(x, 4)} m³ en dépôt` : `${f(-x, 4)} m³ d'emprunt`);
  const lignesB = boucles.map((b, i) => [`${i + 1}`, `${f(b.de, 4)} – ${f(b.a, 4)} m`, `${f(b.volume, 4)} m³`, `${f(b.distance, 3)} m`, `${f(b.moment / 1000, 4)}`,
    b.at ? `${f(b.at.Q, 3)} m³/h (${b.at.n} tomb., saturation ${b.at.nSature})` : "—", Number.isFinite(b.jours) ? `${fd(b.jours, 1)} j` : "—"]);
  const totalJours = boucles.reduce((s, b) => s + (Number.isFinite(b.jours) ? b.jours : 0), 0);
  const synthese = `
    <p class="final-result bureau-verdict na">Solde <strong>${ep.solde >= 0 ? `+${f(ep.solde, 4)} m³ (excédent)` : `−${f(-ep.solde, 4)} m³ (déficit)`}</strong> · ${boucles.length} boucle${boucles.length > 1 ? "s" : ""} de transport · moment ${f(rep.momentTotal / 1000, 4)} × 10³ m³·m
      <small>Début : ${bout(rep.debut)} · fin : ${bout(rep.fin)}${totalJours > 0 ? ` · durée des transports ≈ ${fd(totalJours, 1)} jours de ${f(heures, 2)} h` : ""}.</small></p>
    ${tableau(["n°", "Volume", "Distance", "Débit", "Durée"], boucles.map((b, i) => [`${i + 1}`, `${f(b.volume, 4)} m³`, `${f(b.distance, 3)} m`, b.at ? `${f(b.at.Q, 3)} m³/h` : "—", Number.isFinite(b.jours) ? `${fd(b.jours, 1)} j` : "—"]))}`;
  const note = `
    <h3>1. Données</h3>
    ${donnees([["Profils", `${profils.length}, de ${f(profils[0].x, 4)} à ${f(profils.at(-1).x, 4)} m`], ["Part réutilisable du déblai", fd(reemploi, 2)], ["Coefficient de compactage Ct", fd(Ct, 2)], ["Foisonnement Cf", fd(Cf, 2)],
      ["Ligne de répartition", `${f(c, 4)} m³`], ["Pelle", `${f(engins.q, 3)} m³, cycle ${f(engins.tc, 3)} s`], ["Tombereaux", `${f(engins.capacite, 3)} m³, ${f(engins.vCharge, 3)} / ${f(engins.vVide, 3)} km/h, temps fixes ${f(engins.tFixe, 3)} s${nCamions ? `, ${nCamions} engagés` : ""}`]])}
    <h3>2. Volumes entre profils (moyenne des aires)</h3>
    ${tableau(["Tronçon", "Déblai (m³)", "Remblai (m³)"], vol.troncons.map((t) => [`${f(t.de, 4)} – ${f(t.a, 4)} m`, f(t.deblai, 4), f(t.remblai, 4)]).concat([["<strong>Total</strong>", `<strong>${f(vol.total.deblai, 5)}</strong>`, `<strong>${f(vol.total.remblai, 5)}</strong>`]]))}
    <h3>3. Épure de Lalanne et répartition</h3>
    <p>Ordonnée = Σ (déblai × ${fd(reemploi, 2)} × ${fd(Ct, 2)} − remblai). ${boucles.length ? "" : "La ligne ne referme aucune boucle sur l'épure."}</p>
    ${tableau(["n°", "De – à", "Volume", "Distance moyenne", "Moment (10³ m³·m)", "Atelier", "Durée"], lignesB)}
    <p>Extrémités : début ${bout(rep.debut)} ; fin ${bout(rep.fin)}.</p>`;
  return { figure, synthese, note, verdict: null, etat: "étude du mouvement des terres", resume: `solde ${ep.solde >= 0 ? "+" : "−"}${f(Math.abs(ep.solde), 4)} m³` };
}

