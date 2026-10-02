// Calculateurs du chapitre 8 : Q/S réalisé d'un poste, densité en place au
// gammadensimètre (tranches par différence, moyenne et fond de couche),
// modules à la plaque et à la dynaplaque, seuils de portance du chantier.
import { el, num, f, fd, esc, verdict, brancher, garde, lireTableau } from "./ui.js";
import { graphe, COULEURS } from "./figures.js";
import { OBJECTIFS, densiteTranche, tranchesDensite } from "./gtr/compactage.js";
import { plaque, jugerK, dynaplaque, classeArase, classePlateforme } from "./gtr/portance.js";

// ── Q/S réalisé ───────────────────────────────────────────────────────────
const majQSreel = garde("qrOut", () => {
  const Q = num("qrQ"), d = num("qrD"), L = num("qrL"), tab = num("qrTab");
  if (!(Q > 0 && d > 0 && L > 0 && tab > 0)) { el("qrOut").textContent = "Renseigner Q, la distance, la largeur et le Q/S du tableau."; return; }
  const S = 1000 * d * L, QS = Q / S, ok = QS <= tab + 1e-9;
  const manque = Q / tab / 1000 / L - d;
  el("qrOut").innerHTML = `S = 1 000 × ${fd(d, 1)} × ${fd(L, 2)} = ${f(S, 4)} m² · Q/S réalisé = ${f(Q, 4)}/${f(S, 4)} = <strong>${fd(QS, 3)} m</strong> ${verdict(ok, `≤ ${fd(tab, 3)} m`, `> ${fd(tab, 3)} m`)}
    <small>${ok ? `Le compacteur a appliqué au moins l'énergie prescrite (${fd(QS / tab * 100, 0)} % du Q/S admis).` : `Énergie insuffisante : il aurait fallu ${fd(manque, 1)} km de compactage de plus, ou ${f(tab * S, 4)} m³ au plus.`}</small>`;
});
brancher(["qrQ", "qrD", "qrL", "qrTab"], majQSreel);

// ── Densité en place ──────────────────────────────────────────────────────
const majDensite = garde("deOut", () => {
  const lignes = lireTableau(el("dePoints").value).filter((r) => r.length >= 3);
  const e = num("deE"), ref = num("deRef"), o = OBJECTIFS[el("deObj").value];
  const mesures = lignes.map(([z, rh, w]) => ({ z, rho: rh / (1 + w / 100) })).filter((m) => m.z > 0 && m.rho > 0).sort((a, b) => a.z - b.z);
  if (mesures.length < 2 || !(e > 8 && ref > 0)) { el("deOut").textContent = "Il faut au moins deux mesures, l'épaisseur (> 8 cm) et ρdOPN."; el("deFig").innerHTML = ""; return; }
  const zMax = mesures.at(-1).z;
  const moy = densiteTranche(mesures, 0, Math.min(e, zMax)), fond = densiteTranche(mesures, e - 8, e);
  const tranches = tranchesDensite(mesures);
  const pc = (r) => (100 * r) / ref;
  // Profil en escalier des tranches, en % de ρdOPN.
  const escalier = tranches.flatMap((t) => [[pc(t.rho), t.z0], [pc(t.rho), t.z1]]);
  const taux = tranches.map((t) => pc(t.rho));
  const xmin = Math.floor(Math.min(o.fond - 3, ...taux) / 2) * 2, xmax = Math.ceil(Math.max(102, ...taux.map((x) => x + 1)) / 2) * 2;
  el("deFig").innerHTML = graphe({
    largeur: 620, hauteur: 300, xmin, xmax, ymin: 0, ymax: Math.max(e, zMax), inverserY: true, pasX: 2,
    xlabel: "ρd / ρdOPN (%)", ylabel: "profondeur (cm)",
    zones: [{ x0: xmin, x1: xmax, y0: e - 8, y1: e, couleur: "#f59e0b", opacite: 0.16, libelle: "fond de couche", position: "droite" }],
    series: [
      { points: escalier, couleur: COULEURS.bleu, epaisseur: 2.6, libelle: "densité des tranches" },
      { points: mesures.map((m) => [pc(m.rho), m.z]), couleur: "#94a3b8", epaisseur: 1.6, tirets: "4 3", marqueurs: true, libelle: "moyenne de 0 à z (mesure)" },
      { points: [[o.moyen, 0], [o.moyen, e]], couleur: COULEURS.gtr24, tirets: "6 4", epaisseur: 1.5, libelle: `objectif moyen ${fd(o.moyen, 1)} %` },
      { points: [[o.fond, 0], [o.fond, e]], couleur: COULEURS.rouge, tirets: "3 3", epaisseur: 1.5, libelle: `objectif en fond ${fd(o.fond, 0)} %` },
    ],
  });
  if (!fond.applicable) { el("deOut").innerHTML = `Moyenne ${moy.applicable ? `${fd(moy.rho, 3)} Mg/m³ (${fd(pc(moy.rho), 1)} %)` : "—"} · <span class="verdict ko">fond de couche inconnu</span> <small>${esc(fond.motif)}</small>`; return; }
  const tm = pc(moy.rho), tf = pc(fond.rho), okM = tm >= o.moyen, okF = tf >= o.fond;
  el("deOut").innerHTML = `ρ<sub>d</sub> moyenne = ${fd(moy.rho, 3)} Mg/m³ soit <strong>${fd(tm, 1)} %</strong> ${verdict(okM, `≥ ${fd(o.moyen, 1)} %`, `< ${fd(o.moyen, 1)} %`)} ·
    fond de couche (${f(e - 8, 3)} à ${f(e, 3)} cm) = ${fd(fond.rho, 3)} Mg/m³ soit <strong>${fd(tf, 1)} %</strong> ${verdict(okF, `≥ ${fd(o.fond, 0)} %`, `< ${fd(o.fond, 0)} %`)}
    <small>${zMax < e ? `La mesure la plus profonde (${f(zMax, 3)} cm) n'atteint pas le fond de la couche : la moyenne porte sur 0–${f(zMax, 3)} cm. ` : ""}${okM && okF ? `Objectif ${el("deObj").value} atteint.` : okM ? "La moyenne passe, le fond de couche non : couche trop épaisse pour le compacteur, ou compacteur trop léger." : "Objectif non atteint : compléter le compactage avant de monter la couche suivante."}</small>`;
});
brancher(["dePoints", "deE", "deRef", "deObj"], majDensite);

// ── Essai de plaque ───────────────────────────────────────────────────────
const majPlaque = garde("plOut", () => {
  const z1 = num("plZ1"), z2 = num("plZ2"), niv = el("plNiv").value;
  const r = plaque({ z1, z2 });
  if (!r.applicable) { el("plOut").textContent = r.motif; el("plFig").innerHTML = ""; return; }
  // Courbes de chargement schématiques : premier cycle concave, déchargement, second cycle plus raide.
  // Le déchargement rend la part élastique (≈ z2 × 0,25/0,20) ; le rechargement repart de là.
  const zr = Math.max(0, z1 - 1.25 * z2);
  const c1 = Array.from({ length: 21 }, (_, i) => { const q = (0.25 * i) / 20; return [q, z1 * (0.55 * (q / 0.25) + 0.45 * (q / 0.25) ** 2)]; });
  const d1 = Array.from({ length: 11 }, (_, i) => { const q = 0.25 * (1 - i / 10); return [q, zr + (z1 - zr) * (q / 0.25) ** 0.7]; });
  const c2 = Array.from({ length: 21 }, (_, i) => { const q = (0.2 * i) / 20; return [q, zr + z2 * (0.9 * (q / 0.2) + 0.1 * (q / 0.2) ** 2)]; });
  el("plFig").innerHTML = graphe({
    largeur: 620, hauteur: 280, xmin: 0, xmax: 0.3, ymin: 0, ymax: Math.ceil((Math.max(z1, zr + z2) * 1.15) * 2) / 2, inverserY: true, pasX: 0.05,
    xlabel: "contrainte sous la plaque q (MPa)", ylabel: "enfoncement (mm)",
    series: [
      { points: c1, couleur: COULEURS.bleu, epaisseur: 2.4, libelle: "1er chargement (0,25 MPa)" },
      { points: d1, couleur: "#94a3b8", epaisseur: 1.6, tirets: "5 4", libelle: "déchargement" },
      { points: c2, couleur: COULEURS.rouge, epaisseur: 2.4, libelle: "2e chargement (0,20 MPa)" },
    ],
    marques: [{ x: 0.25, y: z1, couleur: COULEURS.bleu, libelle: `z1 = ${fd(z1, 2)} mm` }, { x: 0.2, y: zr + z2, couleur: COULEURS.rouge, libelle: `z2 = ${fd(z2, 2)} mm` }],
  });
  const seuil = niv === "arase"
    ? `Arase : ${verdict(r.EV2 >= 35, "≥ 35 MPa, couche de forme traitée possible", "< 35 MPa, pas de couche de forme traitée")} ${r.EV2 >= 20 ? "" : verdict(false, "", "< 20 MPa : même une couche de forme granulaire sera difficile")} · classe ${esc(classeArase(r.EV2))} si cette portance est durable`
    : `Plateforme : ${verdict(r.EV2 >= 50, "≥ 50 MPa, chaussée réalisable", "< 50 MPa, chaussée non réalisable")} · classe ${esc(classePlateforme(r.EV2))}`;
  el("plOut").innerHTML = `EV<sub>1</sub> = 112,5/${fd(z1, 2)} = <strong>${fd(r.EV1, 1)} MPa</strong> · EV<sub>2</sub> = 90/${fd(z2, 2)} = <strong>${fd(r.EV2, 1)} MPa</strong> · k = EV<sub>2</sub>/EV<sub>1</sub> = <strong>${fd(r.k, 2)}</strong>
    <small>${seuil}. Compactage : ${esc(jugerK(r))}.</small>`;
});
brancher(["plZ1", "plZ2", "plNiv"], majPlaque);

// ── Dynaplaque ────────────────────────────────────────────────────────────
const majDyna = garde("dyOut", () => {
  const s = String(el("dyS").value).split(/[\s;]+/).map((x) => parseFloat(x.replace(",", "."))).filter((x) => x > 0);
  const r = dynaplaque({ enfoncements: s });
  if (!r.applicable) { el("dyOut").textContent = r.motif; return; }
  el("dyOut").innerHTML = `${s.length} chute${s.length > 1 ? "s" : ""}, enfoncement moyen ${fd(r.sMoyen, 3)} mm · E<sub>vd</sub> = 22,5/${fd(r.sMoyen, 3)} = <strong>${fd(r.Evd, 1)} MPa</strong>
    <small>Avant de comparer E<sub>vd</sub> aux seuils exprimés en EV<sub>2</sub> (35 MPa sur l'arase pour une couche de forme traitée, 50 MPa sur la plateforme), il faut la relation E<sub>vd</sub>–EV<sub>2</sub> du matériau, établie sur une planche d'étalonnage.</small>`;
});
brancher(["dyS"], majDyna);
