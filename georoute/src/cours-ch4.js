// Calculateurs du chapitre 4 : coefficients Los Angeles et micro-Deval et
// classes de résistance, fragmentabilité et dégradabilité d'une roche
// argileuse, classement des craies, classement d'un matériau rocheux.
import { el, num, f, fd, esc, brancher, garde } from "./ui.js";
import { graphe, echantillon, COULEURS } from "./figures.js";
import { losAngeles, microDeval, fragmentabilite, degradabilite } from "./gtr/roches.js";
import { classerRoche, FAMILLES_ROCHES } from "./gtr/classification.js";
import { wSaturation, rhoDSaturation } from "./gtr/proctor.js";

const classe = (s) => `<span class="classe gtr24">${esc(s)}</span>`;

// ── Los Angeles et micro-Deval ────────────────────────────────────────────
const majLaMde = garde("laOut", () => {
  const LA = losAngeles({ passant16: num("laP"), M: num("laM") }), MDE = microDeval({ refus16: num("mdR"), M: num("mdM") });
  if (!(LA >= 0 && LA <= 100 && MDE >= 0 && MDE <= 100)) { el("laOut").textContent = "Les masses doivent être positives et inférieures à la prise d'essai."; el("laFig").innerHTML = ""; return; }
  const xmax = Math.max(60, Math.ceil((MDE + 8) / 10) * 10), ymax = Math.max(70, Math.ceil((LA + 8) / 10) * 10);
  el("laFig").innerHTML = graphe({
    largeur: 620, hauteur: 330, xmin: 0, xmax, ymin: 0, ymax, xlabel: "micro-Deval MDE", ylabel: "Los Angeles LA", pasX: 10, pasY: 10,
    zones: [
      { x0: 0, x1: 45, y0: 0, y1: 45, couleur: "#0f766e", opacite: 0.1, libelle: "R3 · grave G…1", position: "droite" },
      { x0: 0, x1: 25, y0: 0, y1: 35, couleur: "#0f766e", opacite: 0.14, libelle: "R2 (Vo, Me)", position: "droite" },
      { x0: 0, x1: 10, y0: 0, y1: 25, couleur: "#0f766e", opacite: 0.2, libelle: "R1", position: "droite" },
    ],
    textes: [{ x: (45 + xmax) / 2, y: (45 + ymax) / 2 + 6, texte: "au-delà de 45 : R4 ou R5\nselon la fragmentabilité", couleur: COULEURS.discret }],
    marques: [{ x: MDE, y: LA, couleur: COULEURS.rouge, libelle: `LA ${f(LA, 3)} · MDE ${f(MDE, 3)}`, guides: true }],
  });
  const vo = classerRoche("Vo", { LA, MDE, IFR: 1 }), sa = classerRoche("Sa", { LA, MDE, IFR: 1, IDGa: 1 });
  const dur = LA <= 45 && MDE <= 45;
  el("laOut").innerHTML = `LA = 100 × ${f(num("laP"), 4)}/${f(num("laM"), 4)} = <strong>${fd(LA, 1)}</strong> · MDE = 100 × (${f(num("mdM"), 4)} − ${f(num("mdR"), 4)})/${f(num("mdM"), 4)} = <strong>${fd(MDE, 1)}</strong>
    <small>Roche magmatique ou métamorphique : ${classe(vo.sousClasse.replace(" Vo", ""))} ${esc(vo.nom)}${vo.sousClasse.startsWith("R4") ? " (si IFR ≤ 7)" : ""} ·
    grès : ${classe(sa.sousClasse.replace(" Sa", ""))} · calcaire : ${MDE <= 45 ? `${classe("R3 Li")} calcaire dur` : "MDE &gt; 45 : R4 ou R5 Li selon ρd"} ·
    une grave de cette roche aurait un comportement ${dur ? "<strong>G…1</strong> (grains résistants)" : "<strong>G…2</strong> (grains fragiles)"}.</small>`;
});
brancher(["laP", "laM", "mdR", "mdM"], majLaMde);

// ── Fragmentabilité et dégradabilité ──────────────────────────────────────
const majIfr = garde("frOut", () => {
  const IFR = fragmentabilite({ D10avant: num("frA"), D10apres: num("frB") }), IDGa = degradabilite({ D10avant: num("dgA"), D10apres: num("dgB") }), MDE = num("frMde");
  if (!(IFR > 0 && IDGa > 0)) { el("frOut").textContent = "Renseigner les D10 avant et après chaque essai."; el("frFig").innerHTML = ""; return; }
  const xmax = Math.max(20, Math.ceil(IFR + 3)), ymax = Math.max(100, IDGa * 1.6);
  el("frFig").innerHTML = graphe({
    largeur: 620, hauteur: 320, xmin: 1, xmax, ymin: 1, ymax, logY: true, xlabel: "fragmentabilité IFR", ylabel: "dégradabilité IDGa", pasX: 2,
    zones: [
      { x0: 7, x1: xmax, y0: 1, y1: ymax, couleur: "#b91c1c", opacite: 0.1, libelle: "R5 Cl : fragmentable", position: "droite" },
      { x0: 1, x1: 7, y0: 20, y1: ymax, couleur: "#d97706", opacite: 0.16, libelle: "R4 Cld1 : très dégradable" },
      { x0: 1, x1: 7, y0: 5, y1: 20, couleur: "#eab308", opacite: 0.14, libelle: "R4 Cld2 : moyennement dégradable" },
      { x0: 1, x1: 7, y0: 1, y1: 5, couleur: "#0f766e", opacite: 0.12, libelle: "R3 Cl (MDE ≤ 45) ou R4 Cl" },
    ],
    marques: [{ x: Math.min(IFR, xmax), y: IDGa, couleur: COULEURS.rouge, libelle: `IFR ${f(IFR, 2)} · IDGa ${f(IDGa, 3)}`, guides: true }],
  });
  const r = classerRoche("Cl", { IFR, IDGa, MDE });
  const sens = !r.applicable ? esc(r.motif) : r.sousClasse.startsWith("R5") ? "la roche se réduira en grande partie en sol fin sous les engins : son emploi dépend alors de sa teneur en eau, comme un sol"
    : r.sousClasse === "R4 Cld1" ? "elle se met en œuvre comme un matériau rocheux mais se délitera à l'eau dans l'ouvrage : il faut la fragmenter et la compacter intensément, en couches minces, pour en faire un sol dès la construction"
      : r.sousClasse === "R4 Cld2" ? "dégradable : fragmentation complémentaire et compactage soigné pour limiter les vides et l'évolution"
        : "peu évolutive : elle se comporte durablement comme un matériau rocheux";
  el("frOut").innerHTML = `IFR = ${fd(num("frA"), 1)}/${fd(num("frB"), 2)} = <strong>${fd(IFR, 1)}</strong> · IDGa = ${fd(num("dgA"), 1)}/${fd(num("dgB"), 2)} = <strong>${fd(IDGa, 1)}</strong>
    ${r.applicable ? ` → ${classe(r.sousClasse)} ${esc(r.nom)}` : ""} <small>${sens}.${r.detail ? ` ${esc(r.detail)}.` : ""}</small>`;
});
brancher(["frA", "frB", "dgA", "dgB", "frMde"], majIfr);

// ── Craies ────────────────────────────────────────────────────────────────
const TEINTE = { th: "#1e3a8a", h: "#3b82f6", m: "#22c55e", s: "#f59e0b", ts: "#b45309" };
const RHO_S_CRAIE = 2.7;
const majCraie = garde("crOut", () => {
  const rhoD = num("crRho"), wn = num("crW");
  if (!(rhoD > 1 && rhoD < 2.7)) { el("crOut").textContent = "ρd doit être compris entre 1 et 2,7 Mg/m³."; el("crFig").innerHTML = ""; return; }
  const bande = (x0, x1, y0, y1, etat, libelle) => ({ x0, x1, y0, y1, couleur: etat ? TEINTE[etat] : "#64748b", opacite: etat ? 0.22 : 0.1, libelle });
  const zones = [
    bande(5, 45, 1.95, 2.3, null, "CH1 : craie très dense"), bande(5, 45, 1.7, 1.95, null, "CH2 : craie dense"),
    bande(5, 18, 1.55, 1.7, "ts", "CH3ts"), bande(18, 22, 1.55, 1.7, "s", "CH3s"), bande(22, 27, 1.55, 1.7, "m", "CH3m"), bande(27, 45, 1.55, 1.7, "h", "CH3h"),
    bande(5, 16, 1.3, 1.55, "ts", "CH4ts"), bande(16, 21, 1.3, 1.55, "s", "CH4s"), bande(21, 26, 1.3, 1.55, "m", "CH4m"), bande(26, 31, 1.3, 1.55, "h", "CH4h"), bande(31, 45, 1.3, 1.55, "th", "CH4th"),
  ];
  el("crFig").innerHTML = graphe({
    largeur: 620, hauteur: 330, xmin: 5, xmax: 45, ymin: 1.3, ymax: 2.3, xlabel: "teneur en eau naturelle wn (%)", ylabel: "ρd (Mg/m³)", pasX: 5, pasY: 0.1, zones,
    series: [
      ...[1.55, 1.7, 1.95].map((y) => ({ points: [[5, y], [45, y]], couleur: "#475569", epaisseur: 1.2 })),
      { points: echantillon((w) => rhoDSaturation(w, { rhoS: RHO_S_CRAIE }), 5, 45, 60), couleur: COULEURS.bleu, epaisseur: 2, libelle: "saturation (ρs = 2,70 Mg/m³)" },
    ],
    marques: Number.isFinite(wn) ? [{ x: wn, y: rhoD, couleur: COULEURS.rouge, libelle: "craie étudiée", guides: true }] : [],
  });
  const r = classerRoche("CH", { rhoD, wn });
  if (!r.applicable) { el("crOut").innerHTML = `<span class="verdict ko">classement incomplet</span> <small>${esc(r.motif)}</small>`; return; }
  const wSat = wSaturation(rhoD, RHO_S_CRAIE), Sr = (100 * wn) / wSat;
  const etat = /(th|h|m|s|ts)$/.exec(r.sousClasse)?.[1];
  const lecture = { th: "la craie, saturée, donnera une pâte : inutilisable en l'état", h: "humide : les fines produites seront molles, la traficabilité difficile ; compactage faible, couches minces",
    m: "état moyen : mise en œuvre sans difficulté particulière liée à l'eau", s: "sèche : portante mais difficile à compacter ; arrosage ou compactage intense",
    ts: "très sèche : rigide, elle se compacte mal et pourra continuer à se fragmenter dans l'ouvrage" }[etat] ?? "craie dense : peu de fines au terrassement, mais elle peut continuer à se fragmenter sous les contraintes et le gel";
  el("crOut").innerHTML = `${classe(r.sousClasse)} ${esc(r.nom)}${r.detail ? ` (${esc(r.detail)})` : ""}
    <small>À ρ<sub>d</sub> = ${fd(rhoD, 2)} Mg/m³, les pores sont pleins d'eau pour w = ${fd(wSat, 1)} % : ${Number.isFinite(wn) ? (wn > wSat * 1.02 ? `w<sub>n</sub> = ${fd(wn, 1)} % dépasse cette valeur, la mesure est incohérente (ρd ou wn à vérifier).` : `la craie est saturée à ${fd(Sr, 0)} %.`) : ""} ${lecture}.</small>`;
});
brancher(["crRho", "crW"], majCraie);

// ── Classer un matériau rocheux ───────────────────────────────────────────
const majRoche = garde("roOut", () => {
  const fam = el("roFam").value;
  const p = { rhoD: num("roRho"), wn: num("roW"), w: num("roW"), wOPN: num("roWopn"), LA: num("roLa"), MDE: num("roMde"), IFR: num("roIfr"), IDGa: num("roIdg"), IPI: num("roIpi"), gypse: num("roGypse"), sel: num("roSel") };
  const r = classerRoche(fam, p);
  el("roOut").innerHTML = r.applicable
    ? `${esc(FAMILLES_ROCHES[fam])} : ${classe(r.sousClasse)} <strong>${esc(r.nom)}</strong>${r.detail ? `<small>${esc(r.detail)}.</small>` : ""}`
    : `<span class="verdict ko">classement incomplet</span> <small>${esc(r.motif)}</small>`;
});
brancher(["roFam", "roRho", "roW", "roWopn", "roLa", "roMde", "roIfr", "roIdg", "roIpi", "roGypse", "roSel"], majRoche);
