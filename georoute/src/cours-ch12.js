// Calculateurs du chapitre 12 : aptitude au traitement, effet de la chaux
// vive sur la teneur en eau, quantités à épandre et contrôle à la bâche.
import { el, num, f, fd, esc, verdict, brancher, garde } from "./ui.js";
import { graphe, COULEURS } from "./figures.js";
import { aptitudeTraitement, chauxVive, dosagePour, quantite } from "./gtr/traitement.js";

// ── Aptitude ──────────────────────────────────────────────────────────────
const majAptitude = garde("apOut", () => {
  const r = aptitudeTraitement({ Gv: num("apGv"), Rtb: num("apRtb") });
  if (!r.applicable) { el("apOut").textContent = r.motif; return; }
  const cls = { apte: "ok", douteux: "na", inapte: "ko" }[r.verdict];
  el("apOut").innerHTML = `<span class="verdict ${cls}">${r.verdict === "apte" ? "✓ apte" : r.verdict === "inapte" ? "✕ inapte" : "douteux"}</span> <small>${esc(r.motif)}. ${r.verdict === "apte" ? "Une étude de formulation fixe ensuite le produit et le dosage." : r.verdict === "douteux" ? "Changer de produit ou de dosage, ou rechercher la cause (sulfates, matières organiques) avant de conclure." : "Le traitement n'est pas une solution pour ce sol avec ce produit."}</small>`;
});
brancher(["apGv", "apRtb"], majAptitude);

// ── Chaux vive ────────────────────────────────────────────────────────────
const majChaux = garde("chOut", () => {
  const w = num("chW"), C = num("chC"), eta = num("chEta"), vise = num("chVise");
  if (!(w > 0 && C >= 0 && eta >= 0 && eta <= 1)) { el("chOut").textContent = "Renseigner w, le dosage et η (entre 0 et 1)."; el("chFig").innerHTML = ""; return; }
  const r = chauxVive({ w, dosage: C, eta });
  const courbe = (e) => Array.from({ length: 31 }, (_, i) => { const d = (6 * i) / 30; return [d, chauxVive({ w, dosage: d, eta: e }).wFinal]; });
  el("chFig").innerHTML = graphe({
    largeur: 620, hauteur: 280, xmin: 0, xmax: 6, ymin: Math.floor(w - 9), ymax: Math.ceil(w + 1), pasX: 1,
    xlabel: "dosage en chaux vive (%)", ylabel: "teneur en eau après traitement (%)",
    series: [
      { points: courbe(0), couleur: "#94a3b8", epaisseur: 1.6, tirets: "5 4", libelle: "sans évaporation (η = 0)" },
      { points: courbe(eta), couleur: COULEURS.bleu, epaisseur: 2.6, libelle: `η = ${fd(eta, 2)}` },
      { points: courbe(1), couleur: "#94a3b8", epaisseur: 1.6, tirets: "2 3", libelle: "toute la chaleur évapore (η = 1)" },
      ...(Number.isFinite(vise) ? [{ points: [[0, vise], [6, vise]], couleur: COULEURS.gtr24, epaisseur: 1.4, tirets: "6 3", libelle: "teneur en eau visée" }] : []),
    ],
    marques: [{ x: C, y: r.wFinal, couleur: COULEURS.rouge, libelle: `${fd(r.wFinal, 1)} %`, guides: true }],
  });
  const d = Number.isFinite(vise) ? dosagePour({ w, wVise: vise, eta }) : NaN;
  el("chOut").innerHTML = `w = ${fd(w, 1)} % → <strong>${fd(r.wFinal, 1)} %</strong> avec ${fd(C, 1)} % de chaux vive, soit −${fd(r.baisse, 1)} point${r.baisse >= 2 ? "s" : ""}
    <small>Hydratation −${fd(r.eauHydratation, 2)}, évaporation −${fd(r.eauEvaporee, 2)}, apport de matière sèche −${fd(r.dilution, 2)} point. ${Number.isFinite(vise) ? (typeof d === "number" ? `Pour atteindre ${fd(vise, 1)} %, il faut environ <strong>${fd(d, 1)} %</strong> de chaux vive.` : esc(d.motif)) : ""}</small>`;
});
brancher(["chW", "chC", "chEta", "chVise"], majChaux);

// ── Quantités et bâche ────────────────────────────────────────────────────
const majDosage = garde("doOut", () => {
  const dosage = num("doD"), rhoD = num("doRho"), e = num("doE"), S = num("doS"), b = num("doB");
  if (!(dosage > 0 && rhoD > 0 && e > 0)) { el("doOut").textContent = "Renseigner le dosage, ρd et l'épaisseur."; return; }
  const r = quantite({ dosage, rhoD, e, surface: S > 0 ? S : 1 });
  const ecart = Number.isFinite(b) ? (100 * (b - r.q)) / r.q : NaN;
  el("doOut").innerHTML = `q = ${fd(dosage, 1)} % × ${f(rhoD * 1000, 4)} kg/m³ × ${fd(e, 2)} m = <strong>${fd(r.q, 1)} kg/m²</strong>${S > 0 ? ` · pour ${f(S, 5)} m² : <strong>${f(r.total, 3)} t</strong> de produit` : ""}
    ${Number.isFinite(ecart) ? ` · bâche : ${fd(b, 1)} kg/m², écart ${ecart >= 0 ? "+" : "−"}${fd(Math.abs(ecart), 1)} % ${verdict(Math.abs(ecart) <= 10, "dans ± 10 %", "hors ± 10 %")}` : ""}
    <small>La tolérance sur le dosage est celle du marché et de l'étude ; ± 10 % n'est qu'un repère. ${Number.isFinite(ecart) && ecart < -10 ? "Sous-dosage : la portance et la durabilité visées ne seront pas atteintes." : ""}</small>`;
});
brancher(["doD", "doRho", "doE", "doS", "doB"], majDosage);
