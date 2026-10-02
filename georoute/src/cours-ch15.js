// Calculateurs du chapitre 15 : rendement d'une pelle, atelier pelle +
// tombereaux (nombre de saturation), rendement d'un bouteur.
import { el, num, f, fd, brancher, garde } from "./ui.js";
import { graphe, COULEURS } from "./figures.js";
import { pelle, atelier, bouteur } from "./gtr/engins.js";

const lirePelle = () => ({ q: num("pelQ"), kr: num("pelKr"), E: num("pelE"), tc: num("pelTc"), Cf: num("pelCf") });
const pelleValide = (p) => p.q > 0 && p.kr > 0 && p.E > 0 && p.tc > 0 && p.Cf >= 1;

// ── Pelle ─────────────────────────────────────────────────────────────────
const majPelle = garde("pelOut", () => {
  const p = lirePelle();
  if (!pelleValide(p)) { el("pelOut").textContent = "Renseigner le godet, kr, tc, E et Cf (≥ 1)."; return; }
  const r = pelle(p);
  el("pelOut").innerHTML = `${fd(r.parCycle, 2)} m³ foisonnés par cycle · ${fd(r.cyclesParHeure, 0)} cycles utiles par heure · <strong>Q = ${f(r.Q, 3)} m³ en place par heure</strong>
    <small>Soit ${f(r.Q * 8, 3)} m³ en place pour un poste de 8 heures, si les tombereaux suivent.</small>`;
});
brancher(["pelQ", "pelKr", "pelE", "pelTc", "pelCf"], majPelle);

// ── Atelier pelle + tombereaux ────────────────────────────────────────────
const majFlotte = garde("floOut", () => {
  const p = lirePelle();
  const t = { capacite: num("floCap"), distance: num("floDist"), vCharge: num("floVc"), vVide: num("floVv"), tFixe: num("floTf") };
  const n = Math.max(1, Math.round(num("floN", 1)));
  if (!pelleValide(p) || !(t.capacite > 0 && t.distance > 0 && t.vCharge > 0 && t.vVide > 0 && t.tFixe >= 0)) { el("floOut").textContent = "Renseigner la pelle et les tombereaux."; el("floFig").innerHTML = ""; return; }
  const r = atelier({ ...p, ...t, nCamions: n });
  const nMax = Math.max(r.nSature + 3, n + 1, 6);
  const debits = Array.from({ length: nMax }, (_, i) => [i + 1, atelier({ ...p, ...t, nCamions: i + 1 }).Q]);
  el("floFig").innerHTML = graphe({
    largeur: 620, hauteur: 280, xmin: 0, xmax: nMax, ymin: 0, ymax: Math.ceil((r.pelle.Q * 1.2) / 50) * 50, pasX: 1,
    xlabel: "nombre de tombereaux", ylabel: "débit (m³ en place/h)",
    series: [
      { points: [[0, 0], ...debits], couleur: COULEURS.bleu, epaisseur: 2.4, marqueurs: true, libelle: "débit de l'atelier" },
      { points: [[0, r.pelle.Q], [nMax, r.pelle.Q]], couleur: COULEURS.rouge, epaisseur: 1.4, tirets: "6 4", libelle: "capacité de la pelle" },
    ],
    marques: n === r.nSature ? [{ x: n, y: r.Q, couleur: COULEURS.gtr24, libelle: `${n} tombereaux : saturation` }]
      : [{ x: n, y: r.Q, couleur: COULEURS.encre, libelle: `${n} tombereau${n > 1 ? "x" : ""}` }, { x: r.nSature, y: atelier({ ...p, ...t, nCamions: r.nSature }).Q, couleur: COULEURS.gtr24, libelle: `saturation : ${r.nSature}` }],
  });
  const T = r.tombereau;
  el("floOut").innerHTML = `Cycle d'un tombereau : chargement ${T.godets} godets × ${fd(p.tc, 0)} s = ${fd(T.tChargement, 0)} s + aller ${fd(T.tAller, 0)} s + retour ${fd(T.tRetour, 0)} s + fixes ${fd(T.tFixe, 0)} s = <strong>${fd(T.cycle / 60, 1)} min</strong> pour ${fd(T.charge, 1)} m³ foisonnés ·
    saturation à <strong>${r.nSature} tombereaux</strong> · avec ${n} : <strong>${f(r.Q, 3)} m³ en place/h</strong>, limité par ${r.limite}
    <small>${n < r.nSature ? `La pelle attend : ${r.nSature - n} tombereau${r.nSature - n > 1 ? "x" : ""} de plus porteraient le débit à ${f(r.pelle.Q, 3)} m³/h.` : n > r.nSature ? "Des tombereaux attendent leur tour à la pelle : un de moins coûterait moins pour le même débit." : "L'atelier est équilibré."}</small>`;
});
brancher(["pelQ", "pelKr", "pelE", "pelTc", "pelCf", "floCap", "floDist", "floVc", "floVv", "floTf", "floN"], majFlotte);

// ── Bouteur ───────────────────────────────────────────────────────────────
const majBouteur = garde("bouOut", () => {
  const Vl = num("bouVl"), d = num("bouD"), vPousse = num("bouVp"), vRetour = num("bouVr");
  if (!(Vl > 0 && d > 0 && vPousse > 0 && vRetour > 0)) { el("bouOut").textContent = "Renseigner la lame, la distance et les vitesses."; el("bouFig").innerHTML = ""; return; }
  const r = bouteur({ Vl, distance: d, vPousse, vRetour });
  const courbe = Array.from({ length: 30 }, (_, i) => { const x = 10 + (140 * i) / 29; return [x, bouteur({ Vl, distance: x, vPousse, vRetour }).Q]; });
  el("bouFig").innerHTML = graphe({
    largeur: 620, hauteur: 260, xmin: 0, xmax: 150, ymin: 0, ymax: Math.ceil(courbe[0][1] * 1.1 / 50) * 50, pasX: 25,
    xlabel: "distance de poussée (m)", ylabel: "rendement (m³ en place/h)",
    series: [{ points: courbe, couleur: COULEURS.bleu, epaisseur: 2.6, libelle: "rendement du bouteur" }],
    marques: [{ x: d, y: r.Q, couleur: COULEURS.rouge, libelle: `${f(r.Q, 3)} m³/h`, guides: true }],
  });
  el("bouOut").innerHTML = `Cycle = ${fd(d, 0)} m à ${fd(vPousse, 1)} km/h + retour à ${fd(vRetour, 1)} km/h + 15 s = <strong>${fd(r.cycle, 0)} s</strong> · <strong>Q = ${f(r.Q, 3)} m³ en place/h</strong>
    <small>À ${fd(d * 2, 0)} m, le rendement tomberait à ${f(bouteur({ Vl, distance: d * 2, vPousse, vRetour }).Q, 3)} m³/h.</small>`;
});
brancher(["bouVl", "bouD", "bouVp", "bouVr"], majBouteur);
