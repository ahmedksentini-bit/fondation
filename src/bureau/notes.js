// Notes de calcul du bureau : mise en forme HTML des résultats des modules
// purs (semelle.js, pieu.js, et solveurs directs pour les autres modules).
// Chaque fonction renvoie { synthese, note } : la synthèse s'affiche à côté
// de la figure, la note se lit et s'imprime.

import { CLASSES_F62, CATEGORIES_EC7 } from "../geotech/sols.js";
import { PIEUX_F62, categoriePieu } from "../geotech/pieux.js";

const f = (x, c = 3) => (Number.isFinite(x) ? Number(x).toLocaleString("fr-FR", { maximumSignificantDigits: c }) : "—");
const fd = (x, d = 2) => (Number.isFinite(x) ? Number(x).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pastille = (ok) => `<span class="verdict ${ok ? "ok" : "ko"}">${ok ? "✓ vérifié" : "✕ non vérifié"}</span>`;
const tag = (ref) => `<span class="tag-${ref === "F62" ? "f62" : "ec7"}">${ref === "F62" ? "F62" : "EC7"}</span>`;
const nomForme = { filante: "filante", rectangulaire: "rectangulaire", carree: "carrée", circulaire: "circulaire" };

function tableSynthese(lignes) {
  return `<table class="resultats"><thead><tr><th>Vérification</th><th>État limite</th><th class="num">Taux</th><th></th></tr></thead><tbody>
    ${lignes.map((l) => `<tr class="${l.ok ? "" : "ko"}"><td>${tag(l.ref)} ${esc(l.verif)}${l.detail ? `<small>${esc(l.detail)}</small>` : ""}</td>
      <td class="motif">${esc(l.etat)}</td><td class="n">${Number.isFinite(l.taux) ? fd(l.taux, 2) : "—"}</td><td>${pastille(l.ok)}</td></tr>`).join("")}
  </tbody></table>`;
}

/** Pour chaque vérification et chaque référentiel, la combinaison la plus défavorable. */
function plusDefavorables(lignes) {
  const cle = (l) => `${l.verif}|${l.ref}`;
  const poids = (l) => (l.ok ? (Number.isFinite(l.taux) ? l.taux : 0) : Infinity);
  const m = new Map();
  for (const l of lignes) if (!m.has(cle(l)) || poids(l) > poids(m.get(cle(l)))) m.set(cle(l), l);
  const ordre = ["excentrement", "portance", "glissement", "glissement à court terme", "équilibre"];
  return [...m.values()].sort((a, b) => ordre.indexOf(a.verif) - ordre.indexOf(b.verif) || b.ref.localeCompare(a.ref));
}

function bandeau(ok, alertes = []) {
  return `<p class="final-result bureau-verdict ${ok ? "" : "ko"}">${ok ? "Toutes les vérifications sont satisfaites." : "Au moins une vérification n'est pas satisfaite."}</p>
    ${alertes.map((a) => `<p class="hint">${esc(a)}</p>`).join("")}`;
}

// ═══════════════════════════ SEMELLE ═══════════════════════════════════════
export function noteSemelle(r, d) {
  const e = r.entree, g = r.geotech, unite = e.forme === "filante" ? "kN/m" : "kN", uM = e.forme === "filante" ? "kN·m/m" : "kN·m";
  const synthese = `${bandeau(r.verdict, r.alertes)}${tableSynthese(plusDefavorables(r.synthese))}
    ${r.tassement ? `<p class="method-note">Tassement sous la combinaison quasi permanente : ${fd(r.tassement.F62.sf, 1)} mm (F62), ${fd(r.tassement.EC7.sf, 1)} mm (NF P94-261).</p>` : ""}
    <p class="method-note">Combinaison la plus défavorable de chaque vérification ; le détail de toutes les combinaisons figure dans la note.</p>`;
  const combo = (ref) => Object.values(r.etats[ref]).map((x) => `<tr><td>${esc(x.nom)}</td><td class="n">${f(x.V, 4)}</td><td class="n">${f(x.H, 3)}</td><td class="n">${f(x.M, 4)}</td><td class="n">${fd(x.e, 3)}</td></tr>`).join("");
  const exc = (ref) => r.etats[ref].map((x) => x.impossible ? `<tr class="ko"><td>${esc(x.nom)}</td><td colspan="2">${esc(x.impossible)}</td></tr>` : `<tr class="${x.excentrement.ok ? "" : "ko"}"><td>${esc(x.nom)}</td>
      <td class="n">${ref === "F62" ? `${f(100 * x.excentrement.valeur, 3)} % ≥ ${f(100 * x.excentrement.limite, 3)} %` : `${fd(x.excentrement.valeur, 3)} ≥ ${fd(x.excentrement.limite, 3)}`}</td><td>${pastille(x.excentrement.ok)}</td></tr>`).join("");
  const portF = r.etats.F62.filter((x) => x.portance).map((x) => `<tr class="${x.portance.ok ? "" : "ko"}"><td>${esc(x.nom)}</td>
      <td class="n">${fd(x.portance.delta, 1)}° · ${fd(x.portance.idb, 3)}</td><td class="n">${f(x.portance.qref, 4)}</td>
      <td class="n">${f(x.portance.qadm, 4)} <small>γq = ${x.portance.gammaQ}</small></td><td class="n">${fd(x.portance.taux, 2)} ${pastille(x.portance.ok)}</td></tr>`).join("");
  const portE = r.etats.EC7.filter((x) => x.portance).map((x) => `<tr class="${x.portance.ok ? "" : "ko"}"><td>${esc(x.nom)}</td>
      <td class="n">${fd(x.portance.hr, 2)} m · ${fd(x.portance.ple, 3)}</td><td class="n">${fd(x.portance.delta, 1)}° · ${fd(x.portance.id, 3)}</td>
      <td class="n">${fd(x.excentrement.ie, 3)}</td><td class="n">${f(x.V - x.portance.R0, 4)} / ${f(x.portance.Rvd, 4)} <small>γR;v = ${fd(x.portance.gammaRv, 1)}</small></td>
      <td class="n">${fd(x.portance.taux, 2)} ${pastille(x.portance.ok)}</td></tr>`).join("");
  const gl = (ref) => r.etats[ref].filter((x) => x.glissement).map((x) => `<tr class="${x.glissement.ok ? "" : "ko"}"><td>${tag(ref)} ${esc(x.nom)}</td>
      <td class="n">${f(Math.abs(x.H), 3)}</td><td class="n">${f(x.glissement.R, 4)}</td><td class="n">${fd(x.glissement.taux, 2)} ${pastille(x.glissement.ok)}</td></tr>
      ${x.glissementCourtTerme ? `<tr class="${x.glissementCourtTerme.ok ? "" : "ko"}"><td>${tag(ref)} ${esc(x.nom)}, court terme</td><td class="n">${f(Math.abs(x.H), 3)}</td>
      <td class="n">${f(x.glissementCourtTerme.R, 4)} <small>min(A'cu/1,21 ; 0,4 Vd)</small></td><td class="n">${fd(x.glissementCourtTerme.taux, 2)} ${pastille(x.glissementCourtTerme.ok)}</td></tr>` : ""}`).join("");
  const t = r.tassement;
  const note = `
    <h3>1 · Données</h3>
    <p>Semelle ${nomForme[e.forme]} ${e.forme === "filante" ? `de largeur B = ${fd(e.B, 2)} m (calcul par mètre linéaire)` : `${fd(e.B, 2)} m × ${fd(e.L, 2)} m`},
       base à D = ${fd(e.D, 2)} m, épaisseur ${fd(e.h, 2)} m ; ${Number.isFinite(e.zw) ? `nappe à ${fd(e.zw, 2)} m` : "pas de nappe"}.
       Sol d'assise : ${esc(CLASSES_F62[r.assise.classe]?.nom ?? r.assise.classe)} (classe ${esc(CLASSES_F62[r.assise.classe]?.lettre ?? "")}) —
       catégorie ${esc(CATEGORIES_EC7[r.assise.categorie]?.nom ?? r.assise.categorie)} ; comportement ${e.comportement} pour l'inclinaison.</p>
    <div class="table-large"><table class="resultats"><thead><tr><th>Couche</th><th>Classe F62</th><th>Catégorie EC7</th><th class="num">γ (kN/m³)</th><th class="num">p<sub>l</sub>* (MPa)</th><th class="num">E<sub>M</sub> (MPa)</th></tr></thead><tbody>
      ${d.couches.map((c) => `<tr><td>${fd(c.z0, 2)} – ${fd(c.z1, 2)} m</td><td class="motif">${esc(CLASSES_F62[c.classe]?.nom ?? c.classe)}</td><td class="motif">${esc(CATEGORIES_EC7[c.categorie]?.nom ?? c.categorie)}</td>
        <td class="n">${f(c.gamma, 3)}</td><td class="n">${fd(c.pl, 2)}</td><td class="n">${f(c.EM, 3)}</td></tr>`).join("")}</tbody></table></div>
    <p>Actions au niveau du dessus de la semelle : G = { V ${f(d.G.V, 4)} ; H ${f(d.G.H, 3)} ; M ${f(d.G.M, 3)} },
       Q = { V ${f(d.Q.V, 4)} ; H ${f(d.Q.H, 3)} ; M ${f(d.Q.M, 3)} } — ψ0 = ${fd(d.psi.psi0, 2)}, ψ1 = ${fd(d.psi.psi1, 2)}, ψ2 = ${fd(d.psi.psi2, 2)}.</p>

    <h3>2 · Poids propres et torseurs à la base</h3>
    <p class="formula">G<sub>semelle</sub> = ${fd(e.gb, 0)} × ${f(r.A, 4)} × ${fd(e.h, 2)} = ${f(r.poids.Gsemelle, 4)} ${unite} · G<sub>terres</sub> = ${f(r.poids.Gterres, 4)} ${unite}</p>
    <p>À la base : G = { V ${f(r.torseurs.G.V, 4)} ; H ${f(r.torseurs.G.H, 3)} ; M ${f(r.torseurs.G.M, 4)} } et Q = { V ${f(r.torseurs.Q.V, 4)} ; H ${f(r.torseurs.Q.H, 3)} ; M ${f(r.torseurs.Q.M, 4)} }
       (M augmenté de H × ${fd(e.h, 2)} m). ${r.U > 0 ? `Poussée d'Archimède sur la base : U = u A = ${f(g.u, 3)} × ${f(r.A, 4)} = ${f(r.U, 4)} ${unite}.` : ""}</p>

    <h3>3 · Combinaisons d'actions</h3>
    <div class="deux-ref">
      <div><h4>${tag("F62")} Fascicule 62 (A.5)</h4><div class="table-large"><table class="resultats"><thead><tr><th></th><th class="num">V</th><th class="num">H</th><th class="num">M</th><th class="num">e (m)</th></tr></thead><tbody>${combo("F62")}</tbody></table></div>
        <p class="method-note">e = M/V', avec V' = V − U (contraintes effectives).</p></div>
      <div><h4>${tag("EC7")} NF EN 1990, approche 2</h4><div class="table-large"><table class="resultats"><thead><tr><th></th><th class="num">V</th><th class="num">H</th><th class="num">M</th><th class="num">e (m)</th></tr></thead><tbody>${combo("EC7")}</tbody></table></div>
        <p class="method-note">e = M/V, V sans poussée d'Archimède (guide Cerema, note 36).</p></div>
    </div>

    <h3>4 · Paramètres pressiométriques</h3>
    <div class="deux-ref">
      <div><h4>${tag("F62")}</h4>
        <p class="formula">p<sub>le</sub>* = ${fd(g.pleF, 3)} MPa (moyenne géométrique sur 1,5 B)</p>
        <p class="formula">D<sub>e</sub> = ${fd(g.DeF, 2)} m · D<sub>e</sub>/B = ${fd(g.DeF / e.B, 3)}</p>
        <p class="formula">k<sub>p</sub> = ${g.kpF.applicable ? `${fd(g.kpF.k0, 1)} [1 + ${fd(g.kpF.a, 2)} (0,6 + 0,4 B/L) D<sub>e</sub>/B] = ${fd(g.kpF.k, 3)}` : esc(g.kpF.motif)}</p>
        <p class="formula">q'<sub>0</sub> = σ'<sub>v0</sub>(D) = ${f(g.q0eff, 4)} kPa</p></div>
      <div><h4>${tag("EC7")}</h4>
        <p class="formula">p<sub>le</sub>* = ${fd(g.pleQP, 3)} MPa (h<sub>r</sub> = 1,5 B ; réduit à l'ELU si e est grand)</p>
        <p class="formula">D<sub>e</sub> = ${fd(g.DeE, 2)} m · D<sub>e</sub>/B = ${fd(g.DeE / e.B, 3)}</p>
        <p class="formula">k<sub>p</sub> = ${g.kpE.applicable ? `${fd(g.kpE.k, 3)} (filante ${fd(g.kpE.kFilante, 3)}, carrée ${fd(g.kpE.kCarree, 3)}, B/L = ${fd(g.kpE.BL, 3)})` : esc(g.kpE.motif)}</p>
        <p class="formula">q<sub>0</sub> = σ<sub>v0</sub>(D) = ${f(g.q0tot, 4)} kPa · R<sub>0</sub> = A q<sub>0</sub></p></div>
    </div>

    <h3>5 · Excentrement</h3>
    <div class="deux-ref">
      <div><h4>${tag("F62")} surface comprimée (B.3.2, B.3.3)</h4><table class="resultats"><tbody>${exc("F62")}</tbody></table></div>
      <div><h4>${tag("EC7")} 1 − 2e/B (annexe Q)</h4><table class="resultats"><tbody>${exc("EC7")}</tbody></table></div>
    </div>

    <h3>6 · Portance</h3>
    <h4>${tag("F62")} q'<sub>ref</sub> ≤ q'<sub>0</sub> + k<sub>p</sub> p<sub>le</sub>* i<sub>δβ</sub>/γ<sub>q</sub> (B.3.1)</h4>
    <div class="table-large"><table class="resultats"><thead><tr><th>Combinaison</th><th class="num">δ · i<sub>δβ</sub></th><th class="num">q'<sub>ref</sub> (kPa)</th><th class="num">q'<sub>adm</sub> (kPa)</th><th class="num">Taux</th></tr></thead><tbody>${portF}</tbody></table></div>
    <h4>${tag("EC7")} V<sub>d</sub> − R<sub>0</sub> ≤ A i<sub>e</sub> k<sub>p</sub> p<sub>le</sub>* i<sub>δ</sub> / (γ<sub>R;v</sub> × 1,2) (§ 9)</h4>
    <div class="table-large"><table class="resultats"><thead><tr><th>Combinaison</th><th class="num">h<sub>r</sub> · p<sub>le</sub>*</th><th class="num">δ · i<sub>δ</sub></th><th class="num">i<sub>e</sub></th><th class="num">V<sub>d</sub> − R<sub>0</sub> / R<sub>v;d</sub> (${unite})</th><th class="num">Taux</th></tr></thead><tbody>${portE}</tbody></table></div>

    <h3>7 · Glissement</h3>
    <p class="method-note">F62 : H<sub>d</sub> ≤ V' tanφ'/1,2 + c'A'/1,5 avec φ' = ${e.phi}°, c' = ${f(e.c, 3)} kPa. EC7 : R<sub>h;d</sub> = V' tanδ/(1,1 × 1,1), δ = ${e.prefabrique ? "2/3 " : ""}φ'<sub>crit</sub> = ${fd(e.prefabrique ? (2 / 3) * e.phiCrit : e.phiCrit, 1)}°${e.cu > 0 ? ` ; court terme avec c<sub>u</sub> = ${f(e.cu, 3)} kPa` : ""}.</p>
    <div class="table-large"><table class="resultats"><thead><tr><th>Combinaison</th><th class="num">H<sub>d</sub> (${unite})</th><th class="num">Résistance (${unite})</th><th class="num">Taux</th></tr></thead><tbody>${gl("F62")}${gl("EC7")}</tbody></table></div>

    <h3>8 · Tassement (ELS quasi permanent)</h3>
    ${t ? `<p>q' = ${f(t.q, 4)} kPa, σ'<sub>v0</sub> = ${f(t.sigmaV0, 4)} kPa ; modules des tranches B/2 : ${t.tranches.slice(0, t.connues).map((x) => f(x, 3)).join(" · ")} MPa (${t.connues} tranches connues).</p>
      <table class="resultats"><thead><tr><th></th><th class="num">E<sub>c</sub></th><th class="num">E<sub>d</sub></th><th class="num">s<sub>c</sub></th><th class="num">s<sub>d</sub></th><th class="num">s<sub>f</sub></th></tr></thead><tbody>
        <tr><td>${tag("F62")} annexe F.2</td><td class="n">${fd(t.Ec, 2)}</td><td class="n">${fd(t.EdF, 2)}</td><td class="n">${fd(t.F62.sc, 2)}</td><td class="n">${fd(t.F62.sd, 2)}</td><td class="n"><strong>${fd(t.F62.sf, 2)} mm</strong></td></tr>
        <tr><td>${tag("EC7")} annexe H</td><td class="n">${fd(t.Ec, 2)}</td><td class="n">${fd(t.EdE, 2)}</td><td class="n">${fd(t.EC7.sc, 2)}</td><td class="n">${fd(t.EC7.sd, 2)}</td><td class="n"><strong>${fd(t.EC7.sf, 2)} mm</strong></td></tr>
      </tbody></table>
      <p class="method-note">α = ${fd(e.alpha, 3)}. Le tassement admissible dépend de la structure portée : le Fascicule 62 le laisse au marché, la NF P94-261 donne des ordres de grandeur en annexe L.</p>`
      : `<p class="method-note">Renseigner E<sub>M</sub> dans toutes les couches pour calculer le tassement.</p>`}

    <h3>9 · Synthèse</h3>
    ${bandeau(r.verdict, r.alertes)}
    <div class="table-large">${tableSynthese(r.synthese)}</div>`;
  return { synthese, note };
}

// ═══════════════════════════ PIEU ══════════════════════════════════════════
export function notePieu(r, d) {
  const e = r.entree, a = r.F62, b = r.EC7, c = r.combinaisons;
  const lignes = r.verifs.map((v) => ({ verif: `portance (${v.formule})`, ref: v.ref, etat: v.etat, taux: v.taux, ok: v.ok }));
  if (!a.applicable) lignes.push({ verif: "portance", ref: "F62", etat: "—", taux: NaN, ok: false, detail: a.motif });
  if (!b.applicable) lignes.push({ verif: "portance", ref: "EC7", etat: "—", taux: NaN, ok: false, detail: b.motif });
  const ok = lignes.every((l) => l.ok);
  const synthese = `${bandeau(ok, r.alertes)}${tableSynthese(lignes)}
    <p class="method-note">Tassement sous la charge quasi permanente : ${r.tassement.frankZhao?.s != null ? `${fd(r.tassement.frankZhao.s * 1000, 1)} mm (Frank et Zhao)` : "—"} ;
      ordre de grandeur forfaitaire ${fd(r.tassement.forfaitaire.s * 1000, 1)} mm.</p>`;
  const cat = categoriePieu(e.cat);
  const note = `
    <h3>1 · Données</h3>
    <p>Pieu ${esc(PIEUX_F62[e.type]?.nom.toLowerCase() ?? e.type)} (F62) — catégorie ${e.cat}, ${esc(cat?.nom.toLowerCase() ?? "")}, classe ${esc(String(cat?.classe ?? ""))} (NF P94-262).
       ${e.forme === "carre" ? "Section carrée" : "Diamètre"} B = ${fd(e.B, 2)} m, longueur D = ${fd(e.D, 2)} m, méthode ${e.methode === "pressio" ? "pressiométrique" : "pénétrométrique"}${e.zf > 0 ? `, frottement négligé au-dessus de ${fd(e.zf, 2)} m` : ""}.</p>
    <div class="table-large"><table class="resultats"><thead><tr><th>Couche</th><th>Classe F62</th><th>Catégorie EC7</th><th class="num">p<sub>l</sub>* (MPa)</th><th class="num">q<sub>c</sub> (MPa)</th><th class="num">E<sub>M</sub> (MPa)</th></tr></thead><tbody>
      ${d.couches.map((x) => `<tr><td>${fd(x.z0, 2)} – ${fd(x.z1, 2)} m</td><td class="motif">${esc(CLASSES_F62[x.classe]?.nom ?? x.classe)}</td><td class="motif">${esc(CATEGORIES_EC7[x.categorie]?.nom ?? x.categorie)}</td>
        <td class="n">${fd(x.pl, 2)}</td><td class="n">${f(x.qc, 3)}</td><td class="n">${f(x.EM, 3)}</td></tr>`).join("")}</tbody></table></div>

    <h3>2 · Actions en tête et cumul</h3>
    <p>G = ${f(e.G, 4)} kN, Q = ${f(e.Q, 4)} kN (ψ2 = ${fd(e.psi2, 2)}), frottement négatif G<sub>sn</sub> = ${f(e.Fn, 4)} kN.
       G' = G + ψ2 Q = ${f(c.Gp, 4)} kN ; Q' = (1 − ψ2) Q = ${f(c.Qp, 4)} kN.</p>
    <p class="formula">F<sub>d</sub> = G'<sub>d</sub> + max(G<sub>sn,d</sub> ; Q'<sub>d</sub>) : ELU ${f(c.ELU, 5)} kN · ELS caractéristique / rare ${f(c.ELS_car, 5)} kN · ELS quasi permanent ${f(c.ELS_QP, 5)} kN</p>

    <h3>3 · Portance au Fascicule 62</h3>
    ${a.applicable ? `
      <p class="formula">${e.methode === "pressio" ? "p<sub>le</sub>*" : "q<sub>ce</sub>"} = ${fd(a.qEquiv, 3)} MPa sur [${fd(a.detailPointe.z0, 2)} ; ${fd(a.detailPointe.z1, 2)}] m ·
        ${e.methode === "pressio" ? "k<sub>p</sub>" : "k<sub>c</sub>"} = ${fd(a.kPointe, 2)} · q<sub>u</sub> = ${f(a.qu, 4)} kPa · Q<sub>pu</sub> = ${f(a.Qpu, 4)} kN${a.rho[0] !== 1 ? ` (ρp = ${fd(a.rho[0], 2)})` : ""}</p>
      <table class="resultats"><thead><tr><th>Tranche</th><th>Classe</th><th class="num">Courbe</th><th class="num">q<sub>s</sub> (kPa)</th><th class="num">Q<sub>s</sub> (kN)</th></tr></thead><tbody>
        ${a.lignes.map((l) => `<tr><td>${fd(l.z0, 2)} – ${fd(l.z1, 2)} m</td><td class="motif">${esc(l.classe)}</td><td class="n">${l.courbe ? `Q${l.courbe}` : "β"}</td><td class="n">${fd(l.qs, 1)}</td><td class="n">${f(l.Q, 4)}</td></tr>`).join("")}
      </tbody></table>
      <p class="formula">Q<sub>su</sub> = ${f(a.Qsu, 4)} kN · Q<sub>u</sub> = ${f(a.Qu, 5)} kN · Q<sub>c</sub> = ${a.refoulement ? "0,7" : "0,5"} Q<sub>pu</sub> + 0,7 Q<sub>su</sub> = ${f(a.Qc, 5)} kN${a.flottant ? " — pieu flottant" : ""}</p>`
      : `<p class="hint">${esc(a.motif)}</p>`}

    <h3>4 · Portance à la NF P94-262</h3>
    ${b.applicable ? `
      <p class="formula">${e.methode === "pressio" ? "p<sub>le</sub>*" : "q<sub>ce</sub>"} = ${fd(e.methode === "pressio" ? b.pointe.ple : b.pointe.qce, 3)} MPa · D<sub>ef</sub> = ${fd(b.pointe.Def, 2)} m (D<sub>ef</sub>/B = ${fd(b.pointe.DefB, 2)}) ·
        k = ${fd(b.pointe.k, 3)} (max ${fd(b.pointe.kmax, 2)}) · q<sub>b</sub> = ${f(b.pointe.qb, 4)} kPa · R<sub>b</sub> = ${f(b.Rb, 4)} kN</p>
      <table class="resultats"><thead><tr><th>Tranche</th><th>Catégorie</th><th class="num">α · f<sub>sol</sub></th><th class="num">q<sub>s</sub> (kPa)</th><th class="num">R<sub>s</sub> (kN)</th></tr></thead><tbody>
        ${b.lignes.map((l) => `<tr><td>${fd(l.z0, 2)} – ${fd(l.z1, 2)} m</td><td class="motif">${esc(CATEGORIES_EC7[l.sol]?.nom ?? l.sol)}</td><td class="n">${fd(l.alpha, 2)} × ${f(l.fsol, 3)}</td>
          <td class="n">${fd(l.qs, 1)}${l.plafonne ? " <small>q<sub>s,max</sub></small>" : ""}</td><td class="n">${f(l.R, 4)}</td></tr>`).join("")}
      </tbody></table>
      <p class="formula">R<sub>s</sub> = ${f(b.Rs, 4)} kN · R<sub>c</sub> = ${f(b.Rb + b.Rs, 5)} kN</p>
      <p>${b.procedure === "pieu modèle"
        ? `Procédure du pieu modèle : N = ${b.N}, S = ${f(b.Sretenue, 4)} m², ξ3 = ${fd(b.xiMoy, 3)}, ξ4 = ${fd(b.xiMin, 3)}, γ<sub>R;d1</sub> = ${fd(b.gRd1c, 2)}.`
        : `Procédure du modèle de terrain : γ<sub>R;d1</sub> = ${fd(b.gRd1c, 2)} (compression), γ<sub>R;d2</sub> = ${fd(b.gRd2, 1)}.`}</p>
      <p class="formula">R<sub>c;k</sub> = ${f(b.Rck, 5)} kN · R<sub>c;d</sub> = ${f(b.calcul.ELU.Rcd, 5)} kN · R<sub>c;cr;k</sub> = ${f(b.Rccrk, 5)} kN → ${f(b.calcul.ELS_car.Rccrd, 5)} kN (ELS car.), ${f(b.calcul.ELS_QP.Rccrd, 5)} kN (ELS QP)</p>
      ${b.avertissements?.length ? b.avertissements.map((x) => `<p class="hint">${esc(x)}</p>`).join("") : ""}`
      : `<p class="hint">${esc(b.motif)}</p>`}

    <h3>5 · Vérifications</h3>
    <table class="resultats"><thead><tr><th></th><th>État limite</th><th class="num">F<sub>d</sub> (kN)</th><th class="num">Résistance (kN)</th><th class="num">Taux</th></tr></thead><tbody>
      ${r.verifs.map((v) => `<tr class="${v.ok ? "" : "ko"}"><td>${tag(v.ref)}</td><td>${esc(v.etat)} <small>${esc(v.formule)}</small></td><td class="n">${f(v.Fd, 5)}</td><td class="n">${f(v.R, 5)}</td><td class="n">${fd(v.taux, 2)} ${pastille(v.ok)}</td></tr>`).join("")}
    </tbody></table>

    <h3>6 · Tassement</h3>
    <p>Estimation forfaitaire (règles LCPC-Sétra) : ${fd(r.tassement.forfaitaire.s * 1000, 1)} mm (${fd(r.tassement.forfaitaire.min * 1000, 1)} à ${fd(r.tassement.forfaitaire.max * 1000, 1)} mm).
       ${r.tassement.frankZhao ? `Lois de transfert de Frank et Zhao, sous ${f(c.ELS_QP, 4)} kN : <strong>${r.tassement.frankZhao.s != null ? fd(r.tassement.frankZhao.s * 1000, 1) + " mm" : "charge supérieure à la capacité du modèle"}</strong>.` : "Renseigner E<sub>M</sub> dans toutes les couches pour la courbe de chargement."}</p>

    <h3>7 · Synthèse</h3>
    ${synthese}`;
  return { synthese, note };
}
