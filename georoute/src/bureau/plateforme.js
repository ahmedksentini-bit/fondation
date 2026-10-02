// Modules « plateforme » et « talus » du bureau de calcul : cas de PST,
// classe d'arase et épaisseur de couche de forme ; réception d'une arase ou
// d'une plateforme (plaque, dynaplaque, densités) ; stabilité d'un talus.

import { esc, f, fd, nombre, lignes, pastille, tableau, donnees, classe } from "./commun.js";
import { casPST, MODULE_AR } from "../gtr/pst.js";
import { epaisseur2000, lmaxCoucheForme, DMAX_TRAITE } from "../gtr/couche-forme.js";
import { bicouche, epaisseurPour, CLASSES_PF, plaque, jugerK, dynaplaque, classeArase, classePlateforme } from "../gtr/portance.js";
import { OBJECTIFS } from "../gtr/compactage.js";
import { cercleCritique, penteInfinie } from "../gtr/stabilite.js";
import { RAD } from "../gtr/outils.js";
import { graphe, COULEURS } from "../figures.js";
import { coupeTalus } from "../dessins-gtr.js";

// ───────────────────────────── PST et couche de forme ─────────────────────────────

const NOMS_TYPES = { nonTraite: "granulaire non traitée", finChaux: "sol fin traité à la chaux seule", finChauxCiment: "sol fin traité chaux + ciment", grenuTraite: "matériau grenu traité aux liants hydrauliques" };

export function calculerPlateforme(v) {
  const pst = casPST({ sousClasse: v.sousClasse, etat: v.etat, traitement: v.traitement, eTraitee: nombre(v.eTraitee, 0), nappe: v.nappe, drainage: v.drainage === "oui", portanceCT: nombre(v.EV2arase) });
  if (!pst.applicable) throw new Error(pst.motif);
  const ar = v.ar === "auto" ? pst.ar[0] : v.ar;
  const arOk = pst.ar.includes(ar);
  const E2 = MODULE_AR[ar], pf = v.pf, cible = CLASSES_PF.find((c) => c.classe === pf)?.min;
  const type = v.type, cl = Number(v.classeMeca), E1 = nombre(v.E1);
  const ep = ar === "AR0" ? { applicable: false, motif: "arase AR0 : pas de couche de forme sans reclassement de la PST" } : epaisseur2000({ type, ar, pf, classe: cl });
  const hModele = E1 > 0 && E2 > 0 && cible ? epaisseurPour({ E1, E2, Evise: cible }) : NaN;
  const eCouche = nombre(v.eCouche), Lmax = nombre(v.Lmax);
  const lmaxAdmis = type === "nonTraite" ? lmaxCoucheForme(eCouche) : DMAX_TRAITE.place;
  const okLmax = Number.isFinite(Lmax) ? Lmax <= lmaxAdmis : null;
  const EV2 = nombre(v.EV2arase);
  const okArase = Number.isFinite(EV2) ? EV2 >= E2 : null;
  // Chaux seule en couche de forme : sols F3 seulement (le sol de la PST, traité en place).
  const okType = !(type === "finChaux" && !/^F3/.test(v.sousClasse));
  const verdict = arOk && ep.applicable && okLmax !== false && okArase !== false && pst.pst !== "PST0" && okType;
  const pts = Array.from({ length: 51 }, (_, i) => { const h = i / 50; return [h, E2 > 0 && E1 > 0 ? bicouche({ E1, E2, h }).Es : NaN]; });
  const figure = E2 > 0 && E1 > 0 ? graphe({
    largeur: 620, hauteur: 290, xmin: 0, xmax: 1, ymin: 0, ymax: Math.min(400, Math.max(150, (cible ?? 100) * 1.4)), pasX: 0.1,
    xlabel: "épaisseur de couche de forme h (m)", ylabel: "module en surface Es (MPa)",
    series: [{ points: pts, couleur: COULEURS.bleu, epaisseur: 2.6, libelle: `bicouche ${f(E1, 4)} MPa sur ${ar} (${E2} MPa)` },
      ...(cible ? [{ points: [[0, cible], [1, cible]], couleur: COULEURS.gtr24, tirets: "5 4", epaisseur: 1.6, libelle: `seuil ${pf} : ${cible} MPa` }] : [])],
    marques: ep.applicable ? [{ x: ep.e, y: bicouche({ E1, E2, h: ep.e }).Es, couleur: COULEURS.rouge, libelle: `GTR 2000 : ${fd(ep.e, 2)} m`, guides: true }] : [],
  }) : "";
  const synthese = `
    <p class="final-result bureau-verdict ${verdict ? "ok" : "ko"}"><strong>${esc(pst.pst)}</strong> · arase ${classe(ar)} (${E2} MPa à long terme)${arOk ? "" : ` <span class="verdict ko">✕ ${esc(ar)} n'est pas admise pour cette PST (${pst.ar.join(" ou ")})</span>`}
      → ${ep.applicable ? `couche de forme ${esc(NOMS_TYPES[type])} de <strong>${fd(ep.e, 2)} m</strong> pour ${classe(pf)}` : `<span class="verdict ko">${esc(ep.motif)}</span>`}
      <small>${esc(pst.motif)}.</small></p>
    ${tableau(["Contrôle", "Résultat"], [
      ["Portance de l'arase mesurée à court terme", okArase === null ? "non renseignée" : `${pastille(okArase, `${fd(EV2, 0)} ≥ ${E2} MPa`, `${fd(EV2, 0)} < ${E2} MPa`)}`],
      ["Plus gros éléments", okLmax === null ? "non renseignés" : `${pastille(okLmax, `${f(Lmax, 3)} ≤ ${f(lmaxAdmis, 3)} mm`, `${f(Lmax, 3)} > ${f(lmaxAdmis, 3)} mm`)}`],
      ["Modèle bicouche", Number.isFinite(hModele) ? `${pf} atteinte pour h ≈ ${fd(hModele, 2)} m` : "seuil non atteint avec ce module"],
      ...(okType ? [] : [["Chaux seule en couche de forme", `<span class="verdict ko">✕ réservée aux sols F3</span>`]]),
    ])}`;
  const note = `
    <h3>1. Données</h3>
    ${donnees([["Matériau de la PST", `${esc(v.sousClasse)}, état ${esc(v.etat)}`], ["Nappe · drainage", `${v.nappe === "risque" ? "remontée possible" : "pas de remontée"} · ${v.drainage === "oui" ? "drainage et imperméabilisation de l'arase" : "sans dispositions"}`],
      ["Traitement de la PST", `${esc(v.traitement)}${v.traitement === "stabilisation" ? ` sur ${fd(nombre(v.eTraitee), 2)} m` : ""}`], ["Couche de forme", esc(NOMS_TYPES[type])],
      ["Classe mécanique", type === "grenuTraite" ? String(cl) : ""], ["Plateforme visée", pf], ["Module de la couche (modèle)", `${f(E1, 4)} MPa`]])}
    <h3>2. Cas de PST et arase (F1 § 4.3.3, tableau 17)</h3>
    <p><strong>${esc(pst.pst)}</strong>, arase ${pst.ar.join(" ou ")} : ${esc(pst.motif)}.${pst.avertissements.length ? ` ${pst.avertissements.map(esc).join(" ")}` : ""}</p>
    <h3>3. Épaisseur de couche de forme</h3>
    <p>${ep.applicable ? `GTR 2000 (fascicule I § 3.4.2) : <strong>${fd(ep.e, 2)} m</strong> pour passer de ${ar} à ${pf}${ep.notes.length ? ` — ${ep.notes.map(esc).join(" ; ")}` : ""}.` : esc(ep.motif)}
       Les épaisseurs du GTR 2024 (F1 § 4.3.5), qui intègrent la classe PF2qs, sont à vérifier dans le guide.</p>
    <p class="formula">Modèle bicouche : h<sub>e</sub> = 0,9 h (E<sub>1</sub>/E<sub>2</sub>)<sup>1/3</sup> ; 1/E<sub>s</sub> = (1 − φ)/E<sub>1</sub> + φ/E<sub>2</sub>, φ = 1/√(1 + (h<sub>e</sub>/a)²)</p>
    <h3>4. Plus gros éléments</h3>
    <p>${type === "nonTraite" ? `Couche non traitée : L<sub>max</sub> ≤ min(250 ; e/2) = ${f(lmaxAdmis, 3)} mm pour une couche élémentaire de ${fd(eCouche, 2)} m.` : `Matériau traité : D<sub>max</sub> ≤ 63 mm malaxé en centrale, 100 mm en place.`}</p>`;
  return { figure, synthese, note, verdict, resume: `${pst.pst} · ${ar} → ${ep.applicable ? `${fd(ep.e, 2)} m` : "—"} · ${pf}` };
}

// ───────────────────────────── Réception ─────────────────────────────

const SEUILS = { arTraitee: [35, "arase, couche de forme traitée"], arGranulaire: [20, "arase, couche de forme granulaire"], plateforme: [50, "plateforme (chaussée)"], pf2qs: [80, "plateforme PF2qs"], pf3: [120, "plateforme PF3"] };
export const OPTIONS_SEUILS = Object.entries(SEUILS).map(([k, [E, t]]) => [k, `${t} : ${E} MPa`]);

export function calculerControle(v) {
  const [seuil, nom] = SEUILS[v.seuil] ?? SEUILS.plateforme;
  const plaques = lignes(v.plaques).filter((r) => r.length >= 3).map(([p, z1, z2]) => ({ p, ...plaque({ z1, z2 }) })).filter((x) => x.applicable);
  const dyna = lignes(v.dyna).filter((r) => r.length >= 2).map(([p, ...s]) => ({ p, ...dynaplaque({ enfoncements: s }) })).filter((x) => x.applicable);
  const refRho = nombre(v.rhoDOPN), obj = OBJECTIFS[v.objectif] ?? OBJECTIFS.q4;
  const densites = lignes(v.densites).filter((r) => r.length >= 3).map(([p, moy, fond]) => ({ p, moy, fond, tm: (100 * moy) / refRho, tf: (100 * fond) / refRho }));
  if (!plaques.length && !dyna.length && !densites.length) throw new Error("aucune mesure lisible");
  const okP = plaques.filter((x) => x.EV2 >= seuil).length, okD = dyna.filter((x) => x.Evd >= seuil).length;
  const okDens = densites.filter((x) => x.tm >= obj.moyen && x.tf >= obj.fond).length;
  const verdict = okP === plaques.length && okD === dyna.length && okDens === densites.length;
  const pointsE = [...plaques.map((x) => [x.p, x.EV2]), ...dyna.map((x) => [x.p, x.Evd])];
  const xs = pointsE.map((p) => p[0]);
  const figure = pointsE.length ? graphe({
    largeur: 620, hauteur: 280, xmin: Math.min(...xs) - 1, xmax: Math.max(...xs) + 1, ymin: 0, ymax: Math.max(seuil * 1.6, ...pointsE.map((p) => p[1] * 1.15)),
    xlabel: "point de mesure", ylabel: "module (MPa)", pasX: Math.max(1, Math.round((Math.max(...xs) - Math.min(...xs)) / 10)),
    zones: [{ x0: Math.min(...xs) - 1, x1: Math.max(...xs) + 1, y0: 0, y1: seuil, couleur: "#dc2626", opacite: 0.07, libelle: "sous le seuil" }],
    series: [
      ...(plaques.length ? [{ points: plaques.map((x) => [x.p, x.EV2]), couleur: COULEURS.bleu, nuage: true, rayon: 5, libelle: "EV2 à la plaque" }] : []),
      ...(dyna.length ? [{ points: dyna.map((x) => [x.p, x.Evd]), couleur: COULEURS.violet, nuage: true, rayon: 5, libelle: "Evd à la dynaplaque" }] : []),
      { points: [[Math.min(...xs) - 1, seuil], [Math.max(...xs) + 1, seuil]], couleur: COULEURS.rouge, tirets: "6 4", epaisseur: 1.6, libelle: `seuil ${seuil} MPa` },
    ],
  }) : "";
  const ligneStat = (nomE, liste, cle) => {
    if (!liste.length) return null;
    const val = liste.map((x) => x[cle]), moy = val.reduce((s, x) => s + x, 0) / val.length;
    return [nomE, `${liste.length}`, `${f(Math.min(...val), 3)} · ${f(moy, 3)} · ${f(Math.max(...val), 3)}`, `${liste.filter((x) => x[cle] >= seuil).length}/${liste.length}`];
  };
  const synthese = `
    <p class="final-result bureau-verdict ${verdict ? "ok" : "ko"}">${verdict ? "Réception prononçable" : "Points non conformes"} — seuil ${esc(nom)} <small>${okP + okD}/${plaques.length + dyna.length} points de portance conformes${densites.length ? ` · ${okDens}/${densites.length} points de densité conformes (${esc(obj.nom)})` : ""}.</small></p>
    ${tableau(["Essai", "Points", "min · moyenne · max (MPa)", "Conformes"], [ligneStat("Plaque EV2", plaques, "EV2"), ligneStat("Dynaplaque Evd", dyna, "Evd")].filter(Boolean))}
    ${dyna.length ? `<p class="method-note">Evd se compare au seuil après étalonnage sur le matériau du chantier (relation Evd–EV2 établie sur une planche).</p>` : ""}`;
  const note = `
    <h3>1. Seuil de réception</h3><p>${esc(nom)} : module ≥ ${seuil} MPa [F1 § 4.1.3 et § 4.3.4].</p>
    ${plaques.length ? `<h3>2. Essais de plaque (NF P94-117-1)</h3><p class="formula">EV<sub>1</sub> = 112,5/z<sub>1</sub> · EV<sub>2</sub> = 90/z<sub>2</sub> · k = EV<sub>2</sub>/EV<sub>1</sub></p>
      ${tableau(["Point", "EV1 (MPa)", "EV2 (MPa)", "k", "Classe", "Verdict"], plaques.map((x) => [f(x.p, 4), fd(x.EV1, 1), fd(x.EV2, 1), fd(x.k, 2),
        v.seuil.startsWith("ar") ? esc(classeArase(x.EV2)) : esc(classePlateforme(x.EV2)), `${pastille(x.EV2 >= seuil, "conforme", "non conforme")} <small>${esc(jugerK(x))}</small>`]))}` : ""}
    ${dyna.length ? `<h3>3. Dynaplaque (NF P94-117-2)</h3><p class="formula">E<sub>vd</sub> = 22,5 / s</p>
      ${tableau(["Point", "s moyen (mm)", "Evd (MPa)", "Verdict"], dyna.map((x) => [f(x.p, 4), fd(x.sMoyen, 3), fd(x.Evd, 1), pastille(x.Evd >= seuil, "conforme", "non conforme")]))}` : ""}
    ${densites.length ? `<h3>4. Densités en place (objectif ${esc(obj.nom)}, ρdOPN = ${fd(refRho, 3)} Mg/m³)</h3>
      ${tableau(["Point", "ρd moyen", "taux", "ρd fond", "taux", "Verdict"], densites.map((x) => [f(x.p, 4), fd(x.moy, 3), `${fd(x.tm, 1)} %`, fd(x.fond, 3), `${fd(x.tf, 1)} %`, pastille(x.tm >= obj.moyen && x.tf >= obj.fond, "conforme", "non conforme")]))}` : ""}`;
  return { figure, synthese, note, verdict, resume: `${okP + okD}/${plaques.length + dyna.length} points ≥ ${seuil} MPa` };
}

// ───────────────────────────── Talus ─────────────────────────────

export function calculerTalus(v) {
  const p = { H: nombre(v.H), f: nombre(v.fruit), c: nombre(v.c, 0), phi: nombre(v.phi), gamma: nombre(v.gamma, 20), ru: nombre(v.ru, 0) };
  const Fvise = nombre(v.Fvise, 1.5);
  if (!(p.H > 0 && p.f > 0 && p.phi >= 0)) throw new Error("renseigner H, le fruit et φ'");
  const r = cercleCritique(p);
  if (!r.applicable) throw new Error(r.motif);
  const beta = Math.atan(1 / p.f) / RAD;
  const Finf = penteInfinie({ phi: p.phi, beta }), FinfEau = penteInfinie({ phi: p.phi, beta, ecoulement: true, gamma: p.gamma, gammaW: 9.81 });
  const verdict = r.F >= Fvise;
  const synthese = `
    <p class="final-result bureau-verdict ${verdict ? "ok" : "ko"}">Cercle critique : <strong>F = ${fd(r.F, 2)}</strong> ${pastille(verdict, `≥ ${fd(Fvise, 2)}`, `< ${fd(Fvise, 2)}`)}
      <small>Talus de ${fd(p.H, 1)} m au fruit ${fd(p.f, 2)}/1 (${fd(beta, 1)}°), c' = ${f(p.c, 3)} kPa, φ' = ${f(p.phi, 3)}°, r<sub>u</sub> = ${fd(p.ru, 2)}.</small></p>
    ${tableau(["Vérification", "F"], [["Glissement circulaire (Bishop)", fd(r.F, 2)], ["Talus infini, sec (sans cohésion)", fd(Finf, 2)], ["Talus infini, écoulement parallèle", fd(FinfEau, 2)]])}`;
  const note = `
    <h3>1. Données</h3>${donnees([["Hauteur H", `${fd(p.H, 1)} m`], ["Fruit", `${fd(p.f, 2)}/1 — ${fd(beta, 1)}°`], ["c' · φ'", `${f(p.c, 3)} kPa · ${f(p.phi, 3)}°`], ["γ", `${f(p.gamma, 3)} kN/m³`], ["ru", fd(p.ru, 2)], ["F visé", fd(Fvise, 2)]])}
    <h3>2. Méthode de Bishop simplifiée</h3>
    <p class="formula">F = Σ [c' b + (W − u b) tan φ'] / m<sub>α</sub> / Σ W sin α · m<sub>α</sub> = cos α (1 + tan α tan φ'/F)</p>
    <p>Cercle critique : centre (${fd(r.cercle.xc, 2)} ; ${fd(r.cercle.yc, 2)}) m, rayon ${fd(r.cercle.R, 2)} m, entre x = ${fd(r.x1, 2)} et ${fd(r.x2, 2)} m (pied du talus à l'origine). F = <strong>${fd(r.F, 3)}</strong>.</p>
    <p class="method-note">Talus homogène sur un terrain de même nature ; le GTR ne traite pas la stabilité : une étude réelle suit l'Eurocode 7 avec les paramètres mesurés.</p>`;
  return { figure: coupeTalus(p, r), synthese, note, verdict, resume: `F = ${fd(r.F, 2)}` };
}
