// Calculateurs du chapitre 7 : mécanisme de Prandtl en fonction de φ', et la
// feuille c–φ du CSTB (EN 1997-1 annexe D, approche 2) relue avec l'annexe F
// de la NF P94-261 (résistance nette, coefficient de modèle).
import { el, num, f, fd, verdict, brancher, garde } from "./ui.js";
import { svg, ligne, texte, fleche, coupeSemelle, COULEURS } from "./figures.js";
import { facteursPortance, portanceDrainee, portanceNonDrainee, verificationDA2, verificationAnnexeF } from "./geotech/cphi.js";

const RAD = Math.PI / 180;

// ── Mécanisme de Prandtl ────────────────────────────────────────────────
/** Géométrie du mécanisme pour une semelle filante de largeur 1 posée en surface. */
function mecanisme(phi) {
  const a = (45 + phi / 2) * RAD, t = Math.tan(phi * RAD);
  const r0 = 0.5 / Math.cos(a);
  const th0 = Math.PI - a, th1 = th0 - Math.PI / 2;
  const r = (th) => r0 * Math.exp((th0 - th) * t);
  const spirale = Array.from({ length: 49 }, (_, i) => {
    const th = th0 - (i / 48) * (Math.PI / 2), R = r(th);
    return [0.5 + R * Math.cos(th), R * Math.sin(th)];
  });
  const r1 = r(th1);
  const xF = 0.5 + 2 * r1 * Math.cos(th1);
  const apex = [0, 0.5 * Math.tan(a)];
  const prof = Math.max(apex[1], ...spirale.map((p) => p[1]));
  return { spirale, apex, xF, prof, E: spirale[spirale.length - 1] };
}

function figurePrandtl(phi) {
  const m = mecanisme(phi);
  const largeur = 560;
  const ech = Math.min((largeur - 40) / (2 * m.xF), 210 / m.prof);
  const hauteur = Math.round(52 + m.prof * ech + 34);
  const X = (x) => largeur / 2 + x * ech, Y = (y) => 52 + y * ech;
  const chemin = (pts) => pts.map(([x, y], i) => `${i ? "L" : "M"}${X(x).toFixed(1)} ${Y(y).toFixed(1)}`).join("");
  const miroir = (pts) => pts.map(([x, y]) => [-x, y]);
  return svg({
    largeur, hauteur, titre: `Mécanisme de Prandtl pour φ' = ${phi}°`, contenu: (id) => {
      let s = `<rect x="0" y="${Y(0)}" width="${largeur}" height="${hauteur - Y(0)}" fill="#f3e5ae"/>
        <rect x="0" y="${Y(0)}" width="${largeur}" height="${hauteur - Y(0)}" fill="url(#${id}-sable)"/>`;
      for (const cote of [1, -1]) {
        const sp = cote > 0 ? m.spirale : miroir(m.spirale);
        const bord = [0.5 * cote, 0];
        const E = cote > 0 ? m.E : [-m.E[0], m.E[1]];
        // Zone II : éventail limité par la spirale ; zone III : coin de butée.
        s += `<path d="${chemin([bord, ...sp])}Z" fill="${COULEURS.cyan}" fill-opacity=".22" stroke="${COULEURS.cyan}" stroke-width="1.4"/>`;
        s += `<path d="${chemin([bord, E, [m.xF * cote, 0]])}Z" fill="${COULEURS.f62}" fill-opacity=".18" stroke="${COULEURS.f62}" stroke-width="1.4"/>`;
        const mil = sp[24];
        s += texte(X((mil[0] + bord[0]) / 2), Y(mil[1] / 2) + 4, "II", `text-anchor="middle" class="gr" style="fill:${COULEURS.bleu}"`);
        s += texte(X((bord[0] + E[0] + m.xF * cote) / 3), Y(E[1] / 3) + 4, "III", `text-anchor="middle" class="gr" style="fill:${COULEURS.f62}"`);
        // Terrain soulevé à côté de la semelle
        s += `<path d="M${X(0.5 * cote).toFixed(1)} ${Y(0)}Q${X(((0.5 + m.xF) / 2) * cote).toFixed(1)} ${(Y(0) - 12).toFixed(1)} ${X(m.xF * cote).toFixed(1)} ${Y(0)}" fill="none" stroke="${COULEURS.f62}" stroke-width="1.6" stroke-dasharray="4 3"/>`;
      }
      s += `<path d="${chemin([[-0.5, 0], [0.5, 0], m.apex])}Z" fill="${COULEURS.reaction}" fill-opacity=".25" stroke="${COULEURS.reaction}" stroke-width="1.6"/>`;
      s += texte(X(0), Y(m.apex[1] / 3) + 4, "I", `text-anchor="middle" class="gr" style="fill:${COULEURS.reaction}"`);
      s += ligne(0, Y(0), largeur, Y(0), COULEURS.trait, 1.6);
      s += `<rect x="${X(-0.5).toFixed(1)}" y="${(Y(0) - 14).toFixed(1)}" width="${ech.toFixed(1)}" height="14" fill="${COULEURS.beton}" stroke="${COULEURS.betonTrait}" stroke-width="1.4"/>`;
      s += fleche(id, X(0), 6, X(0), Y(0) - 18, { libelle: "V", position: "debut" });
      s += texte(largeur - 8, hauteur - 8, `φ' = ${phi}° · largeur de rupture ${fd(2 * m.xF, 1)} B`, `text-anchor="end" class="pt"`);
      return s;
    },
  });
}

const majPrandtl = garde("prOut", () => {
  const phi = Math.round(num("prPhi", 30));
  el("prPhiVal").textContent = `${phi}°`;
  const m = mecanisme(phi);
  const N = facteursPortance(phi);
  el("prFig").innerHTML = figurePrandtl(phi);
  el("prOut").innerHTML =
    `N<sub>q</sub> = <strong>${fd(N.Nq, 2)}</strong> · N<sub>c</sub> = <strong>${fd(N.Nc, 2)}</strong> · N<sub>γ</sub> = <strong>${fd(N.Ngamma, 2)}</strong>
     <small>La rupture remonte en surface à ${fd(m.xF, 2)} B de l'axe et descend à ${fd(m.prof, 2)} B sous la base :
     plus φ' est grand, plus le volume de sol mobilisé — et donc la résistance — est grand.</small>`;
});
brancher(["prPhi"], majPrandtl);

// ── Feuille c–φ du CSTB ─────────────────────────────────────────────────
const GAMMA_BETON = 25, GAMMA_W = 10;

const majCphi = garde("cpOut", () => {
  const B = num("cpB"), D = num("cpD"), h = num("cpH"), Dw = num("cpDw", Infinity), g = num("cpGam");
  const cu = num("cpCu"), phi = num("cpPhi"), c = Math.max(num("cpC", 0), 0);
  const G = num("cpG", 0), Q = num("cpQ", 0), eGQ = num("cpE", 0), GH = num("cpGH", 0), QH = num("cpQH", 0), l = num("cpL", 0);
  if (!(B > 0 && D >= h && h > 0 && g > 10 && cu > 0 && phi > 0)) {
    el("cpOut").textContent = "Renseigner B, D ≥ hauteur de semelle, γ > 10 kN/m³, cu et φ' positifs."; return;
  }
  // Poids de la semelle et des terres, totaux puis déjaugés sous la nappe.
  const Gsem = B * h * GAMMA_BETON, Gter = (D - h) * B * g;
  const zNappe = Math.max(Dw, 0);
  const G1sem = Gsem - GAMMA_W * B * Math.max(0, D - Math.max(zNappe, D - h));
  const G1ter = Gter - GAMMA_W * B * Math.max(0, D - h - zNappe);
  const q = g * D;
  const q1 = zNappe >= D ? g * D : g * zNappe + (g - GAMMA_W) * (D - zNappe);
  const g1 = zNappe <= D ? g - GAMMA_W : g;
  // Actions de calcul (approche 2).
  const Hd = 1.35 * GH + 1.5 * QH;
  const Md = (1.35 * G + 1.5 * Q) * eGQ + (1.35 * GH + 1.5 * QH) * l;
  const cas = (Vd) => ({ Vd, e: Md / Vd, Bp: B - 2 * Math.abs(Md / Vd) });
  const nd = cas(1.35 * (G + Gsem + Gter) + 1.5 * Q);
  const dr = cas(1.35 * (G + G1sem + G1ter) + 1.5 * Q);

  el("cpFig").innerHTML = coupeSemelle({
    B, D, e: nd.e, V: "Vd", H: Hd, epaisseur: h, zNappe: Dw, hauteur: 250, profondeurVue: Math.max(D + 1.5 * B, 4),
    couches: [{ z0: 0, z1: 60, sol: "argile", position: "bas", etiquette: `argile · cu ${f(cu, 3)} kPa · φ' ${f(phi, 3)}° · c' ${f(c, 3)} kPa` }],
  });

  const colonnes = [];
  const rnd = portanceNonDrainee({ forme: "filante", Bp: nd.Bp, cu, q, H: Hd });
  const rdr = portanceDrainee({ forme: "filante", Bp: dr.Bp, phi, c, q: q1, gamma: g1, V: dr.Vd, H: Hd });
  for (const [nom, k, r, q0, drainage] of [["Court terme (c<sub>u</sub>)", nd, rnd, q, "non-draine"], ["Long terme (c', φ')", dr, rdr, q1, "draine"]]) {
    if (!(k.Bp > 0)) { colonnes.push({ nom, erreur: "résultante hors de la semelle" }); continue; }
    if (!r.applicable) { colonnes.push({ nom, erreur: r.motif }); continue; }
    const da2 = verificationDA2({ Rk: r.R, Vd: k.Vd });
    // NF P94-261 : Vd avec les poids totaux et R0 = A γ D ; la résistance nette
    // retranche q0 (effective en conditions drainées).
    const af = verificationAnnexeF({ A: B, Ap: r.Ap, quBrut: r.qu, q0, q0Total: q, Vd: nd.Vd, drainage });
    colonnes.push({ nom, k, r, q0, da2, af, drainage });
  }
  const cellule = (col, fn) => (col.erreur ? `<td class="n">—</td>` : `<td class="n">${fn(col)}</td>`);
  const ligneT = (titre, fn) => `<tr><td>${titre}</td>${colonnes.map((col) => cellule(col, fn)).join("")}</tr>`;
  const erreurs = colonnes.filter((col) => col.erreur).map((col) => `<p>${col.nom} : ${verdict(false, "", col.erreur)}</p>`).join("");
  el("cpOut").innerHTML = `${erreurs}
    <div class="table-large"><table class="resultats"><thead><tr><th>Grandeur</th>${colonnes.map((col) => `<th class="num">${col.nom}</th>`).join("")}</tr></thead><tbody>
      ${ligneT("V<sub>d</sub> (kN/m) — poids totaux / déjaugés", (col) => fd(col.k.Vd, 1))}
      ${ligneT("e = M<sub>d</sub>/V<sub>d</sub> (m) · B' (m)", (col) => `${fd(col.k.e, 3)} · ${fd(col.k.Bp, 3)}`)}
      ${ligneT("Facteurs", (col) => col.drainage === "draine"
        ? `N<sub>q</sub> ${fd(col.r.Nq, 2)} · N<sub>c</sub> ${fd(col.r.Nc, 2)} · N<sub>γ</sub> ${fd(col.r.Ngamma, 2)}`
        : `N<sub>c</sub> = π + 2 = ${fd(Math.PI + 2, 2)}`)}
      ${ligneT("Inclinaison", (col) => col.drainage === "draine"
        ? `i<sub>q</sub> ${fd(col.r.iq, 3)} · i<sub>c</sub> ${fd(col.r.ic, 3)} · i<sub>γ</sub> ${fd(col.r.ig, 3)}`
        : `i<sub>c</sub> ${fd(col.r.ic, 3)}`)}
      ${ligneT("R/A' brute (kPa) · q<sub>0</sub> (kPa)", (col) => `${fd(col.r.qu, 1)} · ${fd(col.q0, 1)}`)}
      <tr><th colspan="${colonnes.length + 1}">EN 1997-1 annexe D, approche 2 : V<sub>d</sub> ≤ A'(R/A')/1,4</th></tr>
      ${ligneT("R<sub>d</sub> (kN/m)", (col) => `${fd(col.da2.Rd, 1)} ≥ ${fd(col.k.Vd, 1)} ${verdict(col.da2.ok)}`)}
      ${ligneT("Surdimensionnement R<sub>d</sub>/V<sub>d</sub>", (col) => fd(col.da2.surdimensionnement, 3))}
      <tr><th colspan="${colonnes.length + 1}">NF P94-261 annexe F : V<sub>d</sub> − R<sub>0</sub> ≤ A' q<sub>net</sub>/(γ<sub>R;v</sub> γ<sub>R;d;v</sub>)</th></tr>
      ${ligneT("γ<sub>R;v</sub> × γ<sub>R;d;v</sub>", (col) => `1,4 × ${fd(col.af.gammaRdv, 1)} = ${fd(col.af.facteur, 2)}`)}
      ${ligneT("R<sub>v;d</sub> (kN/m) · V<sub>d</sub> − R<sub>0</sub>", (col) => `${fd(col.af.Rvd, 1)} · ${fd(col.af.Vd - col.af.R0, 1)}`)}
      ${ligneT("Taux de travail", (col) => `${fd(col.af.taux, 3)} ${verdict(col.af.ok)}`)}
    </tbody></table></div>
    <p class="method-note">Deux conventions pour l'eau. La feuille du CSTB déjauge le poids de la semelle et des terres
      en conditions drainées (V<sub>d</sub> = ${fd(dr.Vd, 1)} kN/m au lieu de ${fd(nd.Vd, 1)}). La NF P94-261 ne déduit pas
      la poussée d'Archimède : V<sub>d</sub> reste calculé avec les poids totaux et R<sub>0</sub> = A γ D, tandis que la
      résistance nette retranche la contrainte effective q'<sub>0</sub>. Sans coefficients partiels, les deux écritures
      coïncident ; avec γ<sub>G</sub> = 1,35 sur des poids totaux, la norme est un peu plus sévère.</p>`;
});
brancher(["cpB", "cpD", "cpH", "cpDw", "cpGam", "cpCu", "cpPhi", "cpC", "cpE", "cpG", "cpQ", "cpL", "cpGH", "cpQH"], majCphi);
