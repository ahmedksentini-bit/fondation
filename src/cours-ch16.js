// Calculateurs du chapitre 16 : tassement final d'un remblai sur argile,
// consolidation dans le temps, cv et ch (œdomètre, piézocône), drains
// verticaux, construction par étapes et méthode d'Asaoka.
import { el, num, f, fd, brancher, garde, lireTableau } from "./ui.js";
import { graphe, COULEURS } from "./figures.js";
import { GAMMA_W } from "./geotech/outils.js";
import {
  degreConsolidation, facteurTemps, surpressionRelative, longueurDrainage, diametreInfluence, facteurDrain,
  consolidationAvecDrains, tempsPourDegre, espacementDrains, profilRemblai, contrainteSousBande,
  contraintesInitiales, preconsolidation, tassementPrimaire, compressionSecondaire, tassementAvecConstruction,
  hauteurMiseEnOeuvre, tassementDejauge, constructionParEtapes, asaoka, cvAsaoka, chAsaoka,
} from "./geotech/consolidation.js";

const pc = (x) => `${fd(100 * x, 1)} %`;
/** Durée lisible : jours, mois ou années. */
const duree = (ans) => (!Number.isFinite(ans) ? "—" : ans < 0.1 ? `${f(ans * 365.25, 2)} jours` : ans < 2 ? `${f(ans * 12, 2)} mois` : `${f(ans, 3)} ans`);
/** Instants en progression géométrique entre a et b. */
const instants = (a, b, n = 160) => Array.from({ length: n + 1 }, (_, i) => a * (b / a) ** (i / n));

// ── Tassement final d'un remblai ────────────────────────────────────────
const majRb = garde("rbOut", () => {
  const mode = el("rbMode").value, Hs = num("rbH"), g = num("rbG"), B = Math.max(num("rbB", 0), 0), n = num("rbN");
  const Ha = num("rbHa"), zw = Math.max(num("rbZw", 0), 0), ga = num("rbGa"), e0 = num("rbE0"), Cc = num("rbCc");
  const Cs = Math.max(num("rbCs", 0), 0), pop = Math.max(num("rbPop", 0), 0);
  if (!(Hs > 0 && g > 0 && n > 0 && Ha > 0 && ga > GAMMA_W && e0 > 0 && Cc > 0)) {
    el("rbOut").textContent = "Renseigner la géométrie du remblai et les paramètres de l'argile (γ de l'argile supérieur à 10 kN/m³).";
    el("rbFig").innerHTML = "";
    return;
  }
  const couches = [{ z0: 0, z1: Ha, gamma: ga, e0, Cc, Cs, pop }], tranche = Ha / 20;
  const calcul = (H, q, x) => {
    const profil = profilRemblai({ H, largeurCrete: B, fruit: n, q });
    return tassementPrimaire({ couches, zw, epaisseurTranche: tranche, dSigma: (z) => contrainteSousBande(profil, x, z) });
  };
  const sDe = (H, q, x = 0) => calcul(H, q, x).s / 1000;
  // Le tassement enfonce le remblai sous la nappe : la charge dépend du tassement (point fixe).
  const r = mode === "finale"
    ? hauteurMiseEnOeuvre({ Hfinale: Hs, gamma: g, zw, tassement: (H, q) => sDe(H, q) })
    : tassementDejauge({ H: Hs, gamma: g, zw, tassement: (H, q) => sDe(H, q) });
  const H = r.H, q = r.q;
  const b = B / 2, a = n * H, profil = profilRemblai({ H, largeurCrete: B, fruit: n, q });
  const centre = calcul(H, q, 0), bord = calcul(H, q, b), pied = calcul(H, q, b + a);

  const pts = Array.from({ length: 61 }, (_, i) => (Ha * i) / 60);
  const sv0 = (z) => contraintesInitiales(couches, z, zw).svp;
  const xmax = Math.max(...pts.map((z) => sv0(z) + contrainteSousBande(profil, 0, z)), pop + sv0(Ha)) * 1.1;
  el("rbFig").innerHTML = graphe({
    largeur: 560, hauteur: 300, xmin: 0, xmax, ymin: 0, ymax: Ha, inverserY: true,
    xlabel: "contrainte verticale effective (kPa)", ylabel: "profondeur sous le TN (m)",
    series: [
      { points: pts.map((z) => [sv0(z), z]), couleur: COULEURS.bleu, epaisseur: 2.2, libelle: "σ'v0" },
      { points: pts.map((z) => [preconsolidation(sv0(z), { pop }), z]), couleur: COULEURS.violet, tirets: "6 4", libelle: "σ'p = σ'v0 + POP" },
      { points: pts.map((z) => [sv0(z) + contrainteSousBande(profil, 0, z), z]), couleur: COULEURS.effort, epaisseur: 2.4, libelle: "σ'vf sous l'axe" },
      { points: pts.map((z) => [sv0(z) + contrainteSousBande(profil, b + a, z), z]), couleur: COULEURS.f62, tirets: "3 3", libelle: "σ'vf sous le pied du talus" },
    ],
  });
  const nc = centre.tranches.filter((t) => t.domaine !== "surconsolidé").length;
  const ligne = (nom, r2, x) => `<tr><td>${nom}</td><td class="n">${fd(contrainteSousBande(profil, x, 1e-6), 1)}</td><td class="n">${fd(contrainteSousBande(profil, x, Ha), 1)}</td><td class="n"><strong>${fd(r2.s, 0)}</strong></td></tr>`;
  const enfonce = Math.max(0, r.s - zw);
  el("rbOut").innerHTML = `
    <table class="resultats"><thead><tr><th>Point</th><th class="num">Δσ en tête d'argile (kPa)</th><th class="num">Δσ à la base (kPa)</th><th class="num">Tassement (mm)</th></tr></thead><tbody>
      ${ligne("sous l'axe du remblai", centre, 0)}${ligne("sous le bord de la crête", bord, b)}${ligne("sous le pied du talus", pied, b + a)}
    </tbody></table>
    ${mode === "finale" ? `<p class="final-result">Hauteur à mettre en œuvre : <strong>${fd(H, 2)} m</strong> pour une plateforme finale à ${fd(Hs, 2)} m au-dessus du terrain naturel
      <small>le tassement sous l'axe atteint ${fd(r.s, 3)} m ; ${enfonce > 0 ? `le remblai s'enfonce de ${fd(enfonce, 2)} m sous la nappe, ce qui allège la charge de ${f(GAMMA_W * enfonce, 3)} kPa` : "le remblai reste au-dessus de la nappe"} (${r.iterations} itérations).</small></p>` : ""}
    <p class="final-result">Tassement final de consolidation sous l'axe : <strong>${fd(centre.s, 0)} mm</strong>
      <small>q = ${f(q, 3)} kPa en crête${mode === "mise" && enfonce > 0 ? ` (γ H moins ${f(GAMMA_W * enfonce, 3)} kPa de déjaugeage : la base s'enfonce de ${fd(enfonce, 2)} m sous la nappe)` : ""} ; ${nc} tranche(s) sur ${centre.tranches.length} franchissent σ'<sub>p</sub> et travaillent sur la branche vierge ;
      C<sub>c</sub>/(1 + e<sub>0</sub>) = ${fd(Cc / (1 + e0), 3)}. Le tassement immédiat et le fluage s'y ajoutent ; la différence entre l'axe et le pied (${fd(centre.s - pied.s, 0)} mm) creuse la plateforme en cuvette.</small></p>`;
});
brancher(["rbMode", "rbH", "rbG", "rbB", "rbN", "rbHa", "rbZw", "rbGa", "rbE0", "rbCc", "rbCs", "rbPop"], majRb);

// ── Consolidation dans le temps ─────────────────────────────────────────
const majCt = garde("ctOut", () => {
  const H = num("ctH"), double = el("ctDrain").value === "double", cv = num("ctCv"), sc = num("ctS"), t = num("ctT");
  const tc = Math.max(num("ctTc", 0), 0), Ca = Math.max(num("ctCa", 0), 0), e0 = num("ctE0");
  if (!(H > 0 && cv > 0 && sc > 0 && t > 0 && e0 > 0)) { el("ctOut").textContent = "Renseigner l'épaisseur, cv, le tassement final, t et e0."; el("ctFig").innerHTML = ""; return; }
  const Hd = longueurDrainage(H, double), echelle = (Hd * Hd) / cv;
  const degre = (x) => degreConsolidation(x / echelle);
  const sPrim = (x) => tassementAvecConstruction({ sInf: sc, t: x, tc, degre });
  const tU = (U) => facteurTemps(U) * echelle + tc / 2;
  const tp = tU(0.95);
  const sFlu = (x) => compressionSecondaire({ H, e0, Calpha: Ca, tp, t: x });
  const sTot = (x) => sPrim(x) + sFlu(x);
  const tEq = t > tc ? t - tc / 2 : t / 2, Tv = tEq / echelle;
  const tmax = Math.max(100, 3 * t, 2 * tp), ts = instants(0.01, tmax);
  const yMax = Math.max(sTot(tmax), sc) * 1.08;
  const g1 = graphe({
    largeur: 560, hauteur: 270, xmin: 0.01, xmax: tmax, logX: true, ymin: 0, ymax: yMax, inverserY: true,
    xlabel: "temps (ans, échelle logarithmique)", ylabel: "tassement (mm)",
    series: [
      { points: ts.map((x) => [x, sPrim(x)]), couleur: COULEURS.bleu, tirets: "6 4", libelle: "consolidation primaire" },
      { points: ts.map((x) => [x, sTot(x)]), couleur: COULEURS.encre, epaisseur: 2.4, libelle: Ca > 0 ? "primaire + fluage" : "tassement" },
    ],
    marques: [{ x: t, y: sTot(t), couleur: COULEURS.effort, guides: true, libelle: `t = ${f(t, 3)} an${t >= 2 ? "s" : ""}` }],
  });
  // Isochrones : charge équivalente appliquée d'un coup à t − tc/2.
  const zs = Array.from({ length: 81 }, (_, i) => (H * i) / 80);
  const iso = (T) => zs.map((z) => [surpressionRelative(T, z / Hd), z]);
  const g2 = graphe({
    largeur: 560, hauteur: 230, xmin: 0, xmax: 1.05, ymin: 0, ymax: H, inverserY: true,
    xlabel: "surpression interstitielle u/Δσ", ylabel: "profondeur dans la couche (m)",
    series: [
      ...[0.05, 0.2, 0.5].map((T, k) => ({ points: iso(T), couleur: [COULEURS.discret, COULEURS.violet, COULEURS.cyan][k], tirets: "4 3", libelle: `Tv = ${fd(T, 2)}` })),
      { points: iso(Tv), couleur: COULEURS.effort, epaisseur: 2.6, libelle: `à t : Tv = ${f(Tv, 3)}` },
    ],
  });
  el("ctFig").innerHTML = g1 + g2;
  const U = sPrim(t) / sc;
  el("ctOut").innerHTML = `
    <table class="resultats"><tbody>
      <tr><td>Longueur de drainage H<sub>d</sub></td><td class="n">${fd(Hd, 2)} m</td></tr>
      <tr><td>Facteur temps T<sub>v</sub> à t ${tc > 0 ? "(charge équivalente instantanée)" : ""}</td><td class="n">${f(Tv, 3)}</td></tr>
      <tr><td>Degré de consolidation U = s<sub>c</sub>(t)/s<sub>c</sub></td><td class="n">${pc(U)}</td></tr>
      <tr><td>t<sub>50</sub> · t<sub>90</sub> · t<sub>p</sub> (U = 95 %)</td><td class="n">${duree(tU(0.5))} · ${duree(tU(0.9))} · ${duree(tp)}</td></tr>
      <tr><td>Consolidation primaire à t</td><td class="n">${fd(sPrim(t), 0)} mm</td></tr>
      <tr><td>Fluage à t (depuis t<sub>p</sub>)</td><td class="n">${fd(sFlu(t), 0)} mm</td></tr>
      <tr><td>Fluage par décade de temps, H C<sub>αe</sub>/(1 + e<sub>0</sub>)</td><td class="n">${fd((H * Ca * 1000) / (1 + e0), 0)} mm</td></tr>
    </tbody></table>
    <p class="final-result">Tassement à t = ${f(t, 3)} an${t >= 2 ? "s" : ""} : <strong>${fd(sTot(t), 0)} mm</strong>
      <small>${t <= tc ? `pendant la construction : la courbe instantanée est lue à t/2 et multipliée par la fraction de charge ${pc(t / tc)}. ` : ""}Diviser H<sub>d</sub> par deux divise tous ces temps par quatre.</small></p>`;
});
brancher(["ctH", "ctDrain", "ctCv", "ctS", "ctT", "ctTc", "ctCa", "ctE0"], majCt);

// ── cv et ch ────────────────────────────────────────────────────────────
const MIN_PAR_AN = 365.25 * 24 * 60, S_PAR_AN = 365.25 * 24 * 3600;
const majCv = garde("cvOut", () => {
  const he = num("cvHe"), t50 = num("cvT50"), t90 = num("cvT90"), r0 = Number(el("cvCone").value) / 1000;
  const t50p = num("cvT50p"), Ir = num("cvIr"), rap = num("cvRap");
  const Hd = he / 2000;
  const cvC = he > 0 && t50 > 0 ? (0.197 * Hd * Hd) / (t50 / MIN_PAR_AN) : NaN;
  const cvT = he > 0 && t90 > 0 ? (0.848 * Hd * Hd) / (t90 / MIN_PAR_AN) : NaN;
  const ch = t50p > 0 && Ir > 0 ? (0.245 * r0 * r0 * Math.sqrt(Ir)) / (t50p / S_PAR_AN) : NaN;
  const chV = ch * rap;
  const ligne = (nom, x, formule) => `<tr><td>${nom}<br><small>${formule}</small></td><td class="n">${f(x, 3)} m²/an</td><td class="n">${Number.isFinite(x) ? (x / S_PAR_AN).toExponential(2).replace(".", ",") : "—"} m²/s</td></tr>`;
  el("cvOut").innerHTML = `
    <table class="resultats"><thead><tr><th>Mesure</th><th class="num">m²/an</th><th class="num">m²/s</th></tr></thead><tbody>
      ${ligne("c<sub>v</sub>, Casagrande", cvC, `0,197 H<sub>d</sub>²/t<sub>50</sub>, H<sub>d</sub> = ${fd(he / 2, 1)} mm`)}
      ${ligne("c<sub>v</sub>, Taylor", cvT, "0,848 H<sub>d</sub>²/t<sub>90</sub>")}
      ${ligne("c<sub>h</sub>, piézocône", ch, `0,245 r<sub>0</sub>² √I<sub>r</sub>/t<sub>50</sub>, r<sub>0</sub> = ${fd(r0 * 1000, 1)} mm`)}
      ${ligne("c<sub>h</sub> ramené à la branche vierge", chV, `c<sub>h</sub> × C<sub>s</sub>/C<sub>c</sub> = c<sub>h</sub> × ${fd(rap, 2)}`)}
    </tbody></table>
    <p class="final-result">Rapport t<sub>90</sub>/t<sub>50</sub> = ${fd(t90 / t50, 2)} <small>(la théorie donne 0,848/0,197 = 4,3 : un écart fort signale un palier mal dépouillé ou un fluage marqué).
      c<sub>h</sub>/c<sub>v</sub> = ${fd(chV / cvC, 2)} entre le piézocône ramené à la branche vierge et l'œdomètre.</small></p>`;
});
brancher(["cvHe", "cvT50", "cvT90", "cvCone", "cvT50p", "cvIr", "cvRap"], majCv);

// ── Drains verticaux ────────────────────────────────────────────────────
const majDr = garde("drOut", () => {
  const H = num("drH"), double = el("drDrain").value === "double", cv = num("drCv"), ch = num("drCh"), maille = el("drMaille").value;
  const esp = num("drS"), dw = num("drDw") / 1000, sm = Math.max(num("drSm", 1), 1), kr = Math.max(num("drK", 1), 1), t = num("drT"), Uc = num("drU") / 100;
  if (!(H > 0 && cv > 0 && ch > 0 && esp > 0 && dw > 0 && t > 0 && Uc > 0 && Uc < 1)) { el("drOut").textContent = "Renseigner l'argile, les drains, le délai et le degré visé (entre 0 et 100 %)."; el("drFig").innerHTML = ""; return; }
  const Hd = longueurDrainage(H, double), par = { cv, ch, Hd, maille, dw, s: sm, kRapport: kr };
  const r = consolidationAvecDrains({ ...par, t, espacement: esp });
  if (!(r.F > 0)) { el("drOut").textContent = "Zone remaniée plus large que le cylindre drainé : réduire ds/dw ou élargir la maille."; el("drFig").innerHTML = ""; return; }
  const tAvec = tempsPourDegre({ ...par, U: Uc, espacement: esp }), tSans = tempsPourDegre({ ...par, U: Uc, espacement: 0 });
  const e = espacementDrains({ ...par, t, Ucible: Uc });
  const tmax = Math.max(20, 2 * tSans > 1e4 ? 1e4 : 2 * tSans), ts = instants(0.005, Math.min(tmax, 1e4));
  el("drFig").innerHTML = graphe({
    largeur: 560, hauteur: 280, xmin: 0.005, xmax: ts.at(-1), logX: true, ymin: 0, ymax: 100,
    xlabel: "temps (ans, échelle logarithmique)", ylabel: "degré de consolidation (%)",
    series: [
      { points: ts.map((x) => [x, 100 * consolidationAvecDrains({ ...par, t: x, espacement: 0 }).U]), couleur: COULEURS.discret, tirets: "6 4", libelle: "vertical seul (sans drains)" },
      { points: ts.map((x) => [x, 100 * consolidationAvecDrains({ ...par, t: x, espacement: esp }).Uh]), couleur: COULEURS.cyan, tirets: "3 3", libelle: "radial seul" },
      { points: ts.map((x) => [x, 100 * consolidationAvecDrains({ ...par, t: x, espacement: esp }).U]), couleur: COULEURS.bleu, epaisseur: 2.6, libelle: "combiné (Carrillo)" },
      { points: [[0.005, 100 * Uc], [ts.at(-1), 100 * Uc]], couleur: COULEURS.rouge, tirets: "2 3", epaisseur: 1.2, libelle: `degré visé ${fd(100 * Uc, 0)} %` },
    ],
    marques: [{ x: t, y: 100 * r.U, couleur: COULEURS.effort, guides: true }],
  });
  const conseil = e.espacement === Infinity ? "la consolidation verticale seule y suffit : les drains sont inutiles pour ce délai"
    : e.espacement === null ? "même des drains à 0,5 m n'y suffisent pas : allonger le délai ou ajouter une surcharge"
      : `il faut des drains espacés d'au plus <strong>${fd(e.espacement, 2)} m</strong> (maille ${maille === "carre" ? "carrée" : "triangulaire"})${e.borne ? " — au moins 10 m, la borne du calcul" : ""}`;
  el("drOut").innerHTML = `
    <table class="resultats"><tbody>
      <tr><td>D<sub>e</sub> · n = D<sub>e</sub>/d<sub>w</sub> · F</td><td class="n">${fd(r.De, 2)} m · ${fd(r.n, 1)} · ${fd(r.F, 2)}</td></tr>
      <tr><td>À t = ${duree(t)} : U<sub>v</sub> · U<sub>h</sub></td><td class="n">${pc(r.Uv)} · ${pc(r.Uh)}</td></tr>
      <tr><td><strong>Degré combiné U</strong></td><td class="n"><strong>${pc(r.U)}</strong></td></tr>
      <tr><td>Temps pour ${fd(100 * Uc, 0)} % : avec drains · sans drains</td><td class="n">${duree(tAvec)} · ${duree(tSans)}</td></tr>
    </tbody></table>
    <p class="final-result">Pour ${fd(100 * Uc, 0)} % en ${duree(t)}, ${conseil}.
      <small>Sans zone remaniée (d<sub>s</sub> = d<sub>w</sub>), F vaudrait ${fd(facteurDrain({ n: r.n }), 2)} au lieu de ${fd(r.F, 2)} : le remaniement multiplie les temps par ${fd(r.F / facteurDrain({ n: r.n }), 2)}.</small></p>`;
});
brancher(["drH", "drDrain", "drCv", "drCh", "drMaille", "drS", "drDw", "drSm", "drK", "drT", "drU"], majDr);

// ── Construction par étapes ─────────────────────────────────────────────
const majEp = garde("epOut", () => {
  const cu0 = num("epCu"), g = num("epG"), F = num("epF"), lam = num("epL"), U = num("epU") / 100, Hf = num("epHf");
  const Ha = num("epHa"), double = el("epDrain").value === "double", cv = num("epCv"), esp = Math.max(num("epS", 0), 0), ch = num("epCh"), montee = num("epMontee") / 12;
  if (!(cu0 > 0 && g > 0 && F > 0 && lam > 0 && U > 0 && U < 1 && Hf > 0 && Ha > 0 && cv > 0 && montee > 0)) { el("epOut").textContent = "Renseigner cu, γ, F, λcu, le degré entre étapes, la hauteur visée et l'argile."; el("epFig").innerHTML = ""; return; }
  const r = constructionParEtapes({ cu0, gamma: g, Hfinale: Hf, F, lambdaCu: lam, U });
  const Hd = longueurDrainage(Ha, double);
  const attente = tempsPourDegre({ U, cv, Hd, ch: ch > 0 ? ch : cv, espacement: esp, maille: "triangle", dw: 0.066, s: 2, kRapport: 2 });
  // Chronologie en mois : chaque étape monte en « montée », puis attend la consolidation (sauf la dernière).
  const pts = [[0, 0]];
  let t = 0;
  r.etapes.forEach((e, i) => {
    t += montee * 12; pts.push([t, e.H]);
    const derniere = i === r.etapes.length - 1;
    if (!derniere) { t += attente * 12; pts.push([t, e.H]); }
  });
  const fin = t;
  pts.push([fin * 1.08 + 1, r.etapes.at(-1)?.H ?? 0]);
  const yMax = Math.max(Hf, Number.isFinite(r.Hinf) ? Math.min(r.Hinf, 2 * Hf) : Hf) * 1.15;
  el("epFig").innerHTML = graphe({
    largeur: 560, hauteur: 270, xmin: 0, xmax: fin * 1.08 + 1, ymin: 0, ymax: yMax,
    xlabel: "temps depuis le début des travaux (mois)", ylabel: "hauteur de remblai (m)",
    series: [
      { points: pts, couleur: COULEURS.f62, epaisseur: 2.6, libelle: "hauteur mise en place" },
      { points: [[0, Hf], [fin * 1.08 + 1, Hf]], couleur: COULEURS.bleu, tirets: "6 4", libelle: `hauteur visée ${fd(Hf, 1)} m` },
      ...(Number.isFinite(r.Hinf) && r.Hinf < yMax ? [{ points: [[0, r.Hinf], [fin * 1.08 + 1, r.Hinf]], couleur: COULEURS.rouge, tirets: "2 3", libelle: `limite H∞ = ${fd(r.Hinf, 2)} m` }] : []),
    ],
  });
  const lignes = r.etapes.map((e, i) => `<tr><td>${e.n}</td><td class="n">${fd(e.H0, 2)} → ${fd(e.H, 2)} m</td><td class="n">${f(e.cu, 3)} kPa</td>
    <td class="n">${i < r.etapes.length - 1 ? `${duree(attente)} → c<sub>u</sub> = ${f(e.cuApres, 3)} kPa` : "—"}</td></tr>`).join("");
  el("epOut").innerHTML = `
    <table class="resultats"><thead><tr><th>Étape</th><th class="num">Hauteur</th><th class="num">c<sub>u</sub> disponible</th><th class="num">Attente jusqu'à U = ${fd(100 * U, 0)} %</th></tr></thead><tbody>${lignes}</tbody></table>
    <p class="final-result">${r.atteinte
      ? `Hauteur finale atteinte en <strong>${r.etapes.length} étape${r.etapes.length > 1 ? "s" : ""}</strong>, en ${f(fin, 3)} mois environ`
      : `<span class="verdict ko">hauteur visée hors de portée</span> — les étapes plafonnent vers H<sub>∞</sub> = ${fd(r.Hinf, 2)} m`}
      <small>Première étape H<sub>1</sub> = (π + 2) c<sub>u</sub>/(γ F) = ${fd(r.H1, 2)} m ; k = (π + 2) λ<sub>cu</sub> U/F = ${fd(r.k, 3)}.
      ${esp > 0 ? `Attentes calculées avec des drains à ${fd(esp, 2)} m (maille triangulaire, d<sub>w</sub> = 66 mm, d<sub>s</sub>/d<sub>w</sub> = 2, k<sub>h</sub>/k<sub>s</sub> = 2).` : "Sans drains, chaque attente dépend du seul drainage vertical."}
      Prédimensionnement : la stabilité se vérifie par un calcul de rupture le long de cercles.</small></p>`;
});
brancher(["epCu", "epG", "epF", "epL", "epU", "epHf", "epHa", "epDrain", "epCv", "epS", "epCh", "epMontee"], majEp);

// ── Méthode d'Asaoka ────────────────────────────────────────────────────
const majAs = garde("asOut", () => {
  const mesures = lireTableau(el("asMesures").value).filter((l) => l.length >= 2 && Number.isFinite(l[1])).map(([t, s]) => [t, s]);
  const pas = num("asPas"), debut = num("asDebut", 0), Hd = num("asHd"), esp = Math.max(num("asS", 0), 0);
  const r = asaoka(mesures, { pas, depuis: debut });
  if (!r.applicable) {
    el("asOut").innerHTML = `<p class="final-result"><span class="verdict ko">extrapolation impossible</span> <small>${r.motif}</small></p>`;
    el("asFig").innerHTML = "";
    return;
  }
  const dtAn = r.pas / 365.25;
  const cv = Hd > 0 ? cvAsaoka({ beta1: r.beta1, pas: dtAn, Hd }) : NaN;
  const De = esp > 0 ? diametreInfluence(esp, "triangle") : null, Fd = De ? facteurDrain({ n: De / 0.066 }) : null;
  const ch = De ? chAsaoka({ beta1: r.beta1, pas: dtAn, De, F: Fd }) : NaN;
  const [tn, sn] = r.serie.at(-1);
  const prevoir = (t) => r.sInf - (r.sInf - sn) * r.beta1 ** ((t - tn) / r.pas);
  const sMax = Math.max(r.sInf, ...mesures.map((m) => m[1])) * 1.1;
  const x0 = Math.min(...r.points.map((p) => p[0]));
  const g1 = graphe({
    largeur: 560, hauteur: 290, xmin: 0, xmax: sMax, ymin: 0, ymax: sMax,
    xlabel: "tassement s(i−1) (mm)", ylabel: "tassement s(i) (mm)",
    series: [
      { points: r.points, couleur: COULEURS.bleu, nuage: true, libelle: "couples de mesures (s(i−1), s(i))" },
      { points: [[x0, r.beta0 + r.beta1 * x0], [r.sInf, r.sInf]], couleur: COULEURS.bleu, epaisseur: 2, libelle: `droite s(i) = ${f(r.beta0, 3)} + ${fd(r.beta1, 3)} s(i−1)` },
      { points: [[0, 0], [sMax, sMax]], couleur: COULEURS.discret, tirets: "5 4", libelle: "bissectrice s(i) = s(i−1)" },
    ],
    marques: [{ x: r.sInf, y: r.sInf, couleur: COULEURS.effort, guides: true, libelle: `s∞ = ${fd(r.sInf, 0)} mm` }],
  });
  const tFin = tn + 730, ts = Array.from({ length: 61 }, (_, i) => tn + ((tFin - tn) * i) / 60);
  const g2 = graphe({
    largeur: 560, hauteur: 260, xmin: 0, xmax: tFin, ymin: 0, ymax: sMax, inverserY: true,
    xlabel: "temps (jours)", ylabel: "tassement (mm)",
    series: [
      { points: mesures, couleur: COULEURS.encre, nuage: true, libelle: "mesures" },
      { points: ts.map((t) => [t, prevoir(t)]), couleur: COULEURS.effort, tirets: "6 4", epaisseur: 2, libelle: "extrapolation d'Asaoka" },
      { points: [[0, r.sInf], [tFin, r.sInf]], couleur: COULEURS.discret, tirets: "2 3", libelle: "tassement final s∞" },
    ],
  });
  el("asFig").innerHTML = g1 + g2;
  el("asOut").innerHTML = `
    <table class="resultats"><tbody>
      <tr><td>Points rééchantillonnés · pas Δt</td><td class="n">${r.serie.length} · ${f(r.pas, 3)} jours</td></tr>
      <tr><td>β<sub>0</sub> · β<sub>1</sub> · r²</td><td class="n">${f(r.beta0, 4)} mm · ${fd(r.beta1, 4)} · ${fd(r.r2, 4)}</td></tr>
      <tr><td><strong>Tassement final s<sub>∞</sub> = β<sub>0</sub>/(1 − β<sub>1</sub>)</strong></td><td class="n"><strong>${fd(r.sInf, 0)} mm</strong></td></tr>
      <tr><td>Degré atteint à la dernière lecture (${f(tn, 4)} j)</td><td class="n">${pc(sn / r.sInf)}</td></tr>
      <tr><td>Tassement encore attendu dans un an</td><td class="n">${fd(prevoir(tn + 365.25) - sn, 0)} mm</td></tr>
      <tr><td>c<sub>v</sub> équivalent (drainage vertical, H<sub>d</sub> = ${fd(Hd, 1)} m)</td><td class="n">${f(cv, 3)} m²/an</td></tr>
      ${De ? `<tr><td>c<sub>h</sub> équivalent (drains à ${fd(esp, 2)} m, F = ${fd(Fd, 2)} sans remaniement)</td><td class="n">${f(ch, 3)} m²/an</td></tr>` : ""}
    </tbody></table>
    <p class="final-result">Asaoka prévoit <strong>${fd(r.sInf, 0)} mm</strong> de tassement final.
      <small>La droite ne vaut que pour une charge constante : on n'analyse que les lectures postérieures à la fin des travaux, et un changement de pente signale une nouvelle phase (fluage, rechargement). ${De ? "Avec des drains, le drainage est surtout radial : c'est c<sub>h</sub> qu'il faut comparer aux essais." : ""}</small></p>`;
});
brancher(["asMesures", "asPas", "asDebut", "asHd", "asS"], majAs);
