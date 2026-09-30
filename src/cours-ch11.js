// Calculateurs du chapitre 11 : frottement négatif par la méthode de
// Combarieu (pieu isolé et pieu en groupe) et coefficient d'efficacité d'un
// groupe (Converse-Labarre, Fascicule 62 en sols cohérents, NF P94-262).
import { el, num, f, fd, verdict, brancher, garde } from "./ui.js";
import { graphe, echantillon, COULEURS } from "./figures.js";
import { K_TAN_DELTA, lambdaCombarieu, muIsole, frottementNegatif, rayonInfluence, repartitionGroupe } from "./geotech/frottement-negatif.js";
import { converseLabarre, efficaciteCoherentF62, efficaciteEC7, verifGroupeEC7, blocMonolithique } from "./geotech/groupes.js";

// ── Frottement négatif ──────────────────────────────────────────────────
const majFn = garde("fnOut", () => {
  const B = num("fnB"), mise = el("fnMise").value, nat = el("fnNat").value;
  const H = num("fnH"), g = num("fnG"), h2 = num("fnH2", Infinity);
  const hr = Math.max(num("fnHr", 0), 0), gr = num("fnGr", 20), natR = el("fnNr").value;
  const d = num("fnD"), files = Math.max(1, Math.round(num("fnFiles", 1)));
  if (!(B > 0 && H > 0 && g > 0)) { el("fnOut").textContent = "Renseigner B, l'épaisseur et le poids volumique de la couche."; return; }
  const R = B / 2;
  const Kt = K_TAN_DELTA[nat][mise];
  const KtR = K_TAN_DELTA[natR][mise];
  const remblai = hr > 0 ? { h: hr, gamma: gr } : null;
  const couches = [{ z0: 0, z1: H, gamma: g, Kt }];
  const iso = frottementNegatif({ R, remblai, couches, h2, KtRemblai: KtR });
  const b = d > B ? rayonInfluence(files > 1 ? { d, dPrime: d } : { d }) : null;
  const grp = b ? frottementNegatif({ R, remblai, couches, h2, KtRemblai: KtR, b }) : null;
  const lam = lambdaCombarieu(Kt), mu = muIsole(lam), L0 = mu > 0 ? R / (mu * Kt) : Infinity;

  const pts = (cle) => iso.profil.map((p) => [p[cle], p.z]);
  const xmax = Math.max(...iso.profil.map((p) => p.s1)) * 1.1;
  el("fnFig").innerHTML = graphe({
    largeur: 560, hauteur: 300, xmin: 0, xmax, ymin: -hr, ymax: H, inverserY: true,
    xlabel: "contrainte verticale effective (kPa)", ylabel: "profondeur sous le TN (m)",
    zones: [
      ...(hr > 0 ? [{ x0: 0, x1: xmax, y0: -hr, y1: 0, couleur: "#eadfd2", opacite: 0.6, libelle: "remblai" }] : []),
      { x0: 0, x1: xmax, y0: 0, y1: H, couleur: "#dccab0", opacite: 0.35, libelle: "couche compressible" },
      { x0: xmax * 0.85, x1: xmax, y0: -hr, y1: iso.hAction, couleur: COULEURS.rouge, opacite: 0.2, libelle: "h" },
    ],
    series: [
      { points: pts("s1"), couleur: COULEURS.discret, tirets: "5 4", libelle: "σ'1 : champ libre, après remblai" },
      { points: pts("sv"), couleur: COULEURS.effort, epaisseur: 2.8, libelle: "σ'v au contact du pieu" },
      { points: iso.profil.filter((p) => p.z >= 0).map((p) => [p.s0, p.z]), couleur: COULEURS.bleu, libelle: "σ'v0 : avant remblai" },
    ],
  });
  let groupe = "";
  if (grp) {
    const rep = repartitionGroupe({ FnIsole: iso.Fn, FnGroupe: grp.Fn, files });
    groupe = `<tr><td>Pieu en groupe illimité (b = ${fd(b, 2)} m)</td><td class="n">${f(grp.Fn, 4)} kN${grp.Fn < grp.FnSansBorne - 1e-6 ? " <small>borné par π b² q</small>" : ""}</td></tr>
      ${files > 1
        ? `<tr><td>Groupe fini : pieu d'angle · de bord · intérieur</td><td class="n">${f(rep.angle, 4)} · ${f(rep.bord, 4)} · ${f(rep.interieur, 4)} kN</td></tr>`
        : `<tr><td>File unique : pieu d'extrémité · courant</td><td class="n">${f(rep.extremite, 4)} · ${f(rep.courant, 4)} kN</td></tr>`}`;
  }
  el("fnOut").innerHTML = `
    <table class="resultats"><thead><tr><th>Grandeur</th><th class="num">Valeur</th></tr></thead><tbody>
      <tr><td>K tanδ couche · remblai</td><td class="n">${fd(Kt, 2)} · ${fd(KtR, 2)}</td></tr>
      <tr><td>λ · μ · L<sub>0</sub> = R/(μ K tanδ)</td><td class="n">${fd(lam, 3)} · ${fd(mu, 3)} · ${Number.isFinite(L0) ? fd(L0, 1) + " m" : "∞ (pas d'accrochage)"}</td></tr>
      <tr><td>Hauteur d'action h = min(h<sub>1</sub> ; h<sub>2</sub>)</td><td class="n">${fd(iso.hAction, 2)} m <small>${iso.h1 !== null ? `h<sub>1</sub> = ${fd(iso.h1, 2)} m` : "σ'v ne redescend pas à σ'v0 dans la couche"}${Number.isFinite(h2) ? ` · h<sub>2</sub> = ${fd(h2, 2)} m` : ""}</small></td></tr>
      <tr><td><strong>F<sub>n</sub> sur un pieu isolé</strong></td><td class="n"><strong>${f(iso.Fn, 4)} kN</strong> <small>sans accrochage : ${f(iso.FnMax, 4)} kN</small></td></tr>
      ${groupe}
      <tr><td>F<sub>n</sub> de calcul à l'ELU (γ<sub>sn</sub> = 1,35)</td><td class="n">${f(1.35 * iso.Fn, 4)} kN</td></tr>
    </tbody></table>
    <p class="method-note">L'accrochage réduit ici le frottement négatif de ${f(100 * (1 - iso.Fn / iso.FnMax), 2)} % par rapport au calcul en champ
      libre. Un chemisage au bitume (K tanδ = 0,05) le divise encore — c'est la parade classique, avec la
      préconsolidation du sol avant la mise en place des pieux.</p>`;
});
brancher(["fnB", "fnMise", "fnNat", "fnH", "fnG", "fnH2", "fnHr", "fnGr", "fnNr", "fnD", "fnFiles"], majFn);

// ── Effet de groupe ─────────────────────────────────────────────────────
const majGr = garde("grOut", () => {
  const B = num("grB"), d = num("grD"), m = Math.max(1, Math.round(num("grM", 1))), n = Math.max(1, Math.round(num("grN", 1)));
  const Rb = Math.max(num("grRb", 0), 0), Rs = Math.max(num("grRs", 0), 0), F = num("grF", 0);
  if (!(B > 0 && d >= B)) { el("grOut").textContent = "Renseigner B et un entraxe d ≥ B."; return; }
  const N = m * n;
  const cl = converseLabarre({ B, d, m, n });
  const coh = efficaciteCoherentF62({ B, d });
  const ec7 = efficaciteEC7({ B, d, m, n });
  el("grFig").innerHTML = graphe({
    largeur: 560, hauteur: 260, xmin: 1, xmax: 5, ymin: 0, ymax: 1.05, xlabel: "d/B", ylabel: "Ce",
    series: [
      { points: echantillon((x) => converseLabarre({ B: 1, d: x, m, n }), 1, 5, 80), couleur: COULEURS.f62, libelle: "Converse-Labarre (F62)" },
      { points: echantillon((x) => efficaciteCoherentF62({ B: 1, d: x }), 1, 5, 80), couleur: COULEURS.f62, tirets: "6 3", libelle: "F62 sols cohérents" },
      { points: echantillon((x) => efficaciteEC7({ B: 1, d: x, m, n }), 1, 5, 80), couleur: COULEURS.ec7, epaisseur: 2.8, libelle: "NF P94-262 (annexe J)" },
    ],
    marques: [{ x: d / B, y: ec7, couleur: COULEURS.ec7, guides: true }, { x: d / B, y: cl, couleur: COULEURS.f62 }],
  });
  const bloc = blocMonolithique({ B, d, m: Math.min(m, n), n: Math.max(m, n) });
  const vE = verifGroupeEC7({ Fcgd: F, N, Rbd: Rb, Rsd: Rs, Ce: ec7 });
  // F62 G.1 § 2.5 : sols cohérents → formule ¼(1 + d/B) ; sols frottants,
  // pieux sans refoulement → Converse-Labarre ; sables lâches et pieux
  // refoulants → Ce = 1 (toujours avec la réserve du bloc de Terzaghi).
  const sol = el("grSol").value;
  const ceF62 = sol === "coherent" ? coh : sol === "frottant" ? cl : 1;
  const RF62 = ceF62 * N * (Rb + Rs);
  el("grOut").innerHTML = `
    <table class="resultats"><thead><tr><th>Grandeur</th><th class="num"><span class="tag-f62">F62</span></th><th class="num"><span class="tag-ec7">EC7</span></th></tr></thead><tbody>
      <tr><td>C<sub>e</sub> (d/B = ${fd(d / B, 2)}, ${m} × ${n} pieux)</td><td class="n">Converse-Labarre ${fd(cl, 3)} · cohérent ${fd(coh, 3)}</td><td class="n">${fd(ec7, 3)}</td></tr>
      <tr><td>Résistance du groupe</td><td class="n">C<sub>e</sub> N (R<sub>b</sub> + R<sub>s</sub>) = ${f(RF62, 4)} kN <small>C<sub>e</sub> retenu : ${fd(ceF62, 3)}</small></td><td class="n">N (R<sub>b;d</sub> + C<sub>e</sub> R<sub>s;d</sub>) = ${f(vE.R, 4)} kN</td></tr>
      <tr><td>Taux sous ${f(F, 4)} kN</td><td class="n">${fd(F / RF62, 2)} ${verdict(F <= RF62 + 1e-9)}</td><td class="n">${fd(vE.taux, 2)} ${verdict(vE.ok)}</td></tr>
      <tr><td>Bloc monolithique</td><td class="n" colspan="2" style="text-align:center">${fd(bloc.L, 2)} m × ${fd(bloc.l, 2)} m · périmètre ${fd(bloc.perimetre, 2)} m · base ${fd(bloc.aire, 2)} m²</td></tr>
    </tbody></table>
    <p class="method-note">La norme ne réduit que le frottement : la pointe, qui travaille dans un sol non partagé, garde sa
      résistance entière. À d ≥ 3B, elle ne réduit plus rien, alors que Converse-Labarre pénalise encore le groupe.
      Le bloc monolithique se vérifie comme une fondation dont la base est au niveau des pointes (chapitres 4 et 9),
      avec le frottement sur son périmètre.</p>`;
});
brancher(["grB", "grD", "grM", "grN", "grRb", "grRs", "grSol", "grF"], majGr);
