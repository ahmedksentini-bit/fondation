// Calculateurs du chapitre 7 : tassement pressiométrique de Ménard (tranches
// B/2, Ed des deux référentiels, module de réaction), méthode de Schmertmann
// et consolidation œdométrique d'une couche d'argile.
import { el, num, f, fd, brancher, garde } from "./ui.js";
import { graphe, COULEURS } from "./figures.js";
import { profilCouches } from "./geotech/outils.js";
import { tranchesMenard, moduleEd, tassementMenard, moduleReaction, schmertmann, boussinesqAxe, tassementOedometrique, regrouper } from "./geotech/tassements.js";

// ── Ménard ──────────────────────────────────────────────────────────────
const majMe = garde("meOut", () => {
  const forme = el("meForme").value;
  const B = num("meB"), L = forme === "rectangulaire" ? num("meL") : B;
  const q = num("meQ"), s0 = num("meS", 0), alpha = num("meAlpha");
  const h1 = Math.max(num("meH1", 0), 0), h2 = Math.max(num("meH2", 0), 0);
  const E1 = num("meE1"), E2 = num("meE2"), E3 = num("meE3");
  const connu = Number(el("meConnu").value);
  el("meL").closest(".field").style.display = forme === "rectangulaire" ? "" : "none";
  if (!(B > 0 && L > 0 && q > 0 && E1 > 0 && E2 > 0 && E3 > 0)) { el("meOut").textContent = "Renseigner B, q' et les modules."; return; }
  // Profil de EM repéré depuis la base de la semelle (D = 0).
  const p = profilCouches([
    { z0: 0, z1: h1, EM: E1 }, { z0: h1, z1: h1 + h2, EM: E2 }, { z0: h1 + h2, z1: 8 * B + 50, EM: E3 },
  ].filter((c) => c.z1 > c.z0));
  const t = tranchesMenard({ profilEM: { fn: p.fn("EM"), ruptures: p.ruptures }, D: 0, B });
  const g = regrouper(t.E.slice(0, connu));
  const Ed7 = moduleEd({ ...g, referentiel: "EC7" });
  const Ed62 = moduleEd({ ...g, referentiel: "F62" });
  const Ec = t.E[0];
  const s7 = tassementMenard({ forme, B, L, q, sigmaV0: s0, alpha, Ec, Ed: Ed7 });
  const s62 = tassementMenard({ forme, B, L, q, sigmaV0: s0, alpha, Ec, Ed: Ed62 });
  const k = moduleReaction({ forme, B, L, alpha, Ec, Ed: Ed7 });

  // Figure : modules des tranches et regroupements.
  const pts = [];
  t.E.forEach((E, i) => { if (i < connu) pts.push([E, (i * B) / 2], [E, ((i + 1) * B) / 2]); });
  const xmax = Math.max(...t.E.slice(0, connu)) * 1.25;
  const zones = [
    { y0: 0, y1: B / 2, libelle: "E1 → Ec", couleur: COULEURS.f62 },
    { y0: B / 2, y1: B, libelle: "E2", couleur: COULEURS.cyan },
    { y0: B, y1: 2.5 * B, libelle: "E3;5", couleur: COULEURS.bleu },
    { y0: 2.5 * B, y1: 4 * B, libelle: "E6;8", couleur: COULEURS.violet },
    { y0: 4 * B, y1: 8 * B, libelle: "E9;16", couleur: COULEURS.discret },
  ].filter((z) => z.y0 < (connu * B) / 2 - 1e-9).map((z) => ({ ...z, x0: 0, x1: xmax, opacite: 0.1 }));
  el("meFig").innerHTML = graphe({
    largeur: 560, hauteur: 300, xmin: 0, xmax, ymin: 0, ymax: (connu * B) / 2, inverserY: true,
    xlabel: "module EM des tranches (MPa)", ylabel: "profondeur sous la base (m)", zones,
    series: [{ points: pts, couleur: COULEURS.trait, libelle: "Ei (moyenne harmonique par tranche B/2)" }],
  });

  const ligne = (nom, a, b) => `<tr><td>${nom}</td><td class="n">${a}</td><td class="n">${b}</td></tr>`;
  const formule = connu === 16 ? "H.2.1.2.4" : connu === 8 ? "H.2.1.2.6" : "H.2.1.2.7";
  el("meOut").innerHTML = `
    <table class="resultats"><thead><tr><th>Grandeur</th><th class="num"><span class="tag-f62">F62</span></th><th class="num"><span class="tag-ec7">NF P94-261</span></th></tr></thead><tbody>
      ${ligne("E<sub>c</sub> = E<sub>1</sub> (MPa)", fd(Ec, 2), fd(Ec, 2))}
      ${ligne(`E<sub>d</sub> (MPa) <small>formule ${formule}</small>`, fd(Ed62, 2), fd(Ed7, 2))}
      ${ligne("λ<sub>c</sub> · λ<sub>d</sub>", `${fd(s7.lc, 2)} · ${fd(s7.ld, 2)}`, `${fd(s7.lc, 2)} · ${fd(s7.ld, 2)}`)}
      ${ligne("s<sub>c</sub> (mm)", fd(s62.sc, 2), fd(s7.sc, 2))}
      ${ligne("s<sub>d</sub> (mm)", fd(s62.sd, 2), fd(s7.sd, 2))}
      ${ligne("<strong>s<sub>f</sub> (mm)</strong>", `<strong>${fd(s62.sf, 2)}</strong>`, `<strong>${fd(s7.sf, 2)}</strong>`)}
    </tbody></table>
    <p class="final-result">Module de réaction : k<sub>v</sub> = <strong>${f(k.kv / 1000, 3)} MN/m³</strong> (charges de longue durée)
      · k<sub>i</sub> = 2 k<sub>v</sub> = ${f(k.ki / 1000, 3)} MN/m³
      <small>soit la pente q/s de la méthode : ${f(q - s0, 3)} kPa / ${fd(s7.sf, 2)} mm. Un k calculé pour B = ${fd(B, 2)} m ne vaut pas pour une autre largeur.</small></p>`;
});
brancher(["meForme", "meB", "meL", "meQ", "meS", "meAlpha", "meH1", "meE1", "meH2", "meE2", "meE3", "meConnu"], majMe);

// ── Schmertmann ─────────────────────────────────────────────────────────
const majSc = garde("scOut", () => {
  const forme = el("scForme").value, B = num("scB"), t = Math.max(num("scT", 1), 0.1);
  const q = num("scQ"), s0 = num("scS", 0), sp = num("scSp");
  const h = [num("scH1", 0), num("scH2", 0), num("scH3", 0)].map((x) => Math.max(x, 0));
  const qc = [num("scQ1"), num("scQ2"), num("scQ3"), num("scQ4")];
  if (!(B > 0 && q > 0 && sp > 0 && qc.every((x) => x > 0))) { el("scOut").textContent = "Renseigner B, q', σ'vp et les qc."; return; }
  const couches = [];
  let z = 0;
  h.forEach((hi, i) => { if (hi > 0) couches.push({ z0: z, z1: z + hi, qc: qc[i] }); z += hi; });
  couches.push({ z0: z, z1: z + 8 * B, qc: qc[3] });
  const r = schmertmann({ forme, B, q, sigmaV0: s0, sigmaVp: sp, t, couches });
  if (!r.applicable) {
    el("scOut").innerHTML = `<p class="final-result"><span class="verdict ko">méthode inapplicable</span> <small>${r.motif}</small></p>`;
    el("scFig").innerHTML = "";
    return;
  }
  const I0 = forme === "filante" ? 0.2 : 0.1;
  const Iz = [[I0, 0], [r.Izp, r.zp], [0, r.zf]];
  const qcMax = Math.max(...qc);
  const qcPts = couches.flatMap((c) => [[c.qc / qcMax, c.z0], [c.qc / qcMax, Math.min(c.z1, r.zf * 1.1)]]);
  el("scFig").innerHTML = graphe({
    largeur: 560, hauteur: 280, xmin: 0, xmax: 1.05, ymin: 0, ymax: r.zf * 1.1, inverserY: true,
    xlabel: `Iz — et qc/qc,max (qc,max = ${f(qcMax, 3)} MPa)`, ylabel: "profondeur sous la base (m)",
    series: [
      { points: Iz, couleur: COULEURS.ec7, epaisseur: 3, libelle: `Iz (pic ${fd(r.Izp, 2)} à ${fd(r.zp, 2)} m)` },
      { points: qcPts, couleur: COULEURS.f62, tirets: "5 3", libelle: "qc / qc,max" },
    ],
  });
  el("scOut").innerHTML = `
    <table class="resultats"><thead><tr><th>Couche (m)</th><th class="num">q<sub>c</sub> (MPa)</th><th class="num">E (MPa)</th><th class="num">∫ I<sub>z</sub> dz (m)</th></tr></thead><tbody>
      ${r.detail.map((c) => `<tr><td>${fd(c.z0, 2)} – ${fd(Math.min(c.z1, r.zf), 2)}</td><td class="n">${f(c.qc, 3)}</td><td class="n">${f(c.E, 3)}</td><td class="n">${fd(c.aireIz, 3)}</td></tr>`).join("")}
    </tbody></table>
    <p class="final-result">C<sub>1</sub> = ${fd(r.C1, 3)} · C<sub>2</sub> = ${fd(r.C2, 3)} · C<sub>3</sub> = ${fd(r.C3, 2)} → s = <strong>${fd(r.s, 1)} mm</strong>
      <small>Les couches proches du pic de I<sub>z</sub> pèsent le plus : une couche lâche entre ${fd(r.zp / 2, 2)} et ${fd(r.zp * 2, 2)} m sous la base domine le résultat.</small></p>`;
});
brancher(["scForme", "scB", "scT", "scQ", "scS", "scSp", "scH1", "scQ1", "scH2", "scQ2", "scH3", "scQ3", "scQ4"], majSc);

// ── Consolidation œdométrique ───────────────────────────────────────────
const majOe = garde("oeOut", () => {
  const forme = el("oeForme").value, B = num("oeB"), dq = num("oeDq"), z1 = Math.max(num("oeZ", 0), 0), H = num("oeH");
  const s0 = num("oeS0"), g = num("oeG"), e0 = num("oeE0"), Cc = num("oeCc"), Cs = Math.max(num("oeCs", 0), 0), pop = Math.max(num("oeOcr", 0), 0);
  if (!(B > 0 && dq > 0 && H > 0 && s0 > 0 && g >= 0 && e0 > 0 && Cc > 0)) { el("oeOut").textContent = "Renseigner la géométrie et les paramètres œdométriques."; return; }
  const n = 10, dz = H / n;
  let total = 0;
  const lignes = [];
  for (let i = 0; i < n; i++) {
    const z = z1 + (i + 0.5) * dz;
    const sv0 = s0 + g * (i + 0.5) * dz;
    const ds = boussinesqAxe({ forme, B, L: B, q: dq, z });
    const r = tassementOedometrique({ H: dz, e0, Cc, Cs, sigmaV0: sv0, sigmaP: sv0 + pop, dSigma: ds });
    total += r.s;
    lignes.push({ z, sv0, ds, s: r.s, domaine: r.domaine });
  }
  const profilDs = [];
  for (let i = 0; i <= 60; i++) {
    const z = ((z1 + H) * i) / 60;
    profilDs.push([boussinesqAxe({ forme, B, L: B, q: dq, z: Math.max(z, 1e-6) }), z]);
  }
  const xmax = Math.max(dq, s0 + g * H + pop) * 1.1;
  el("oeFig").innerHTML = graphe({
    largeur: 560, hauteur: 280, xmin: 0, xmax, ymin: 0, ymax: z1 + H, inverserY: true,
    xlabel: "contraintes (kPa)", ylabel: "profondeur sous la base (m)",
    zones: [{ x0: 0, x1: xmax, y0: z1, y1: z1 + H, couleur: "#8b7355", opacite: 0.12, libelle: "argile" }],
    series: [
      { points: profilDs, couleur: COULEURS.effort, libelle: "Δσ'v (Boussinesq, axe)" },
      { points: [[s0, z1], [s0 + g * H, z1 + H]], couleur: COULEURS.bleu, libelle: "σ'v0" },
      { points: [[s0 + pop, z1], [s0 + g * H + pop, z1 + H]], couleur: COULEURS.violet, tirets: "5 3", libelle: "σ'p" },
    ],
  });
  const nc = lignes.filter((l) => l.domaine !== "surconsolidé").length;
  el("oeOut").innerHTML = `
    <p class="final-result">Tassement de consolidation : <strong>${fd(total, 0)} mm</strong>
      <small>${n} tranches de ${fd(dz, 2)} m ; Δσ'<sub>v</sub> passe de ${f(lignes[0].ds, 3)} kPa au toit à ${f(lignes[n - 1].ds, 3)} kPa à la base de l'argile ;
      ${nc} tranche(s) sur ${n} dépassent σ'<sub>p</sub> et travaillent sur la branche vierge C<sub>c</sub>.</small></p>`;
});
brancher(["oeForme", "oeB", "oeDq", "oeZ", "oeH", "oeS0", "oeG", "oeE0", "oeCc", "oeCs", "oeOcr"], majOe);
