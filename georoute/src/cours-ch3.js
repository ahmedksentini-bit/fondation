// Calculateurs du chapitre 3 : optimum Proctor et courbes de saturation,
// seuils d'état hydrique par sous-classe (GTR 2024 et 1992), indice portant,
// état hydrique d'un sol à partir de l'IPI, de l'Ic et de wn/wOPN.
import { el, num, f, fd, esc, brancher, garde, lireTableau } from "./ui.js";
import { graphe, echantillon, svg, ligne, texte, COULEURS } from "./figures.js";
import { optimum, rhoDSaturation, saturationOptimum } from "./gtr/proctor.js";
import { REFERENCE_CBR } from "./gtr/portance.js";
import { ETATS_2024, etatHydrique, enClair, intervalle } from "./gtr/classification.js";
import { ETATS_1992 } from "./gtr/classification92.js";
import { OBJECTIFS } from "./gtr/compactage.js";

/** Couleurs des cinq états (les mêmes que les pastilles .etat-hydrique). */
const TEINTE = { th: "#1e3a8a", h: "#3b82f6", m: "#22c55e", s: "#f59e0b", ts: "#b45309" };
const NOM_ETAT = { th: "très humide", h: "humide", m: "moyen", s: "sec", ts: "très sec" };
const pastille = (e) => `<span class="etat-hydrique ${e}">${e}</span>`;

// ── Optimum Proctor ───────────────────────────────────────────────────────
const majProctor = garde("prOut", () => {
  const pts = lireTableau(el("prPoints").value).filter((r) => r.length >= 2 && r[1] > 0).map((r) => [r[0], r[1]]);
  const rhoS = num("prRhoS"), wn = num("prWn");
  if (pts.length < 3 || !(rhoS > 1.5)) { el("prOut").textContent = "Il faut au moins trois points (w, ρd) et ρs."; el("prFig").innerHTML = ""; return; }
  const o = optimum(pts);
  const ws = pts.map((p) => p[0]), rs = pts.map((p) => p[1]);
  const xmin = Math.floor(Math.min(...ws, Number.isFinite(wn) ? wn : Infinity) - 2), xmax = Math.ceil(Math.max(...ws, Number.isFinite(wn) ? wn : -Infinity) + 2);
  const haut = Math.max(...rs, o.applicable ? o.rhoDOPN : 0);
  const ymin = Math.floor((Math.min(...rs) - 0.05) * 50) / 50, ymax = Math.ceil((haut + 0.12) * 50) / 50;
  const series = [
    { points: echantillon((w) => rhoDSaturation(w, { rhoS }), xmin, xmax, 60), couleur: "#0369a1", epaisseur: 2, libelle: "saturation Sr = 100 %" },
    { points: echantillon((w) => rhoDSaturation(w, { rhoS, Sr: 80 }), xmin, xmax, 60), couleur: "#0369a1", tirets: "6 4", epaisseur: 1.6, libelle: "Sr = 80 %" },
  ];
  const marques = [];
  if (o.applicable) {
    const a = o.retenus[0][0] - 0.6, b = o.retenus.at(-1)[0] + 0.6;
    series.push({ points: echantillon(o.courbe, a, b, 50), couleur: COULEURS.encre, epaisseur: 2.4, libelle: "parabole ajustée" });
    const q4 = (OBJECTIFS.q4.moyen / 100) * o.rhoDOPN;
    series.push({ points: [[xmin, q4], [xmax, q4]], couleur: "#15803d", tirets: "3 3", epaisseur: 1.4, libelle: "95 % ρdOPN (q4)" });
    marques.push({ x: o.wOPN, y: o.rhoDOPN, couleur: COULEURS.rouge, libelle: "OPN", guides: true });
    if (Number.isFinite(wn) && wn >= a && wn <= b) marques.push({ x: wn, y: o.courbe(wn), couleur: COULEURS.violet, libelle: "wn", rayon: 4 });
  }
  series.push({ points: pts, couleur: COULEURS.encre, nuage: true, rayon: 4.5, couleurs: pts.map((p) => (o.applicable && o.retenus.some((r) => r[0] === p[0]) ? COULEURS.encre : "#94a3b8")) });
  el("prFig").innerHTML = graphe({ largeur: 620, hauteur: 320, xmin, xmax, ymin, ymax, xlabel: "teneur en eau w (%)", ylabel: "ρd (Mg/m³)", series, marques, pasY: 0.05 });
  if (!o.applicable) { el("prOut").innerHTML = `<span class="verdict ko">optimum non encadré</span> <small>${esc(o.motif)}</small>`; return; }
  const sat = saturationOptimum({ wOPN: o.wOPN, rhoDOPN: o.rhoDOPN, rhoS });
  const r = wn / o.wOPN;
  const cote = !Number.isFinite(r) ? "" : r >= 1.1 ? "nettement du côté humide de l'optimum : le compactage sera difficile et la portance faible"
    : r >= 0.9 ? "au voisinage de l'optimum : les conditions sont les meilleures" : "du côté sec : le sol porte, mais il se compacte mal et peut s'effondrer s'il est mouillé plus tard";
  const q = (o_) => `${fd((o_.moyen / 100) * o.rhoDOPN, 3)} en moyenne et ${fd((o_.fond / 100) * o.rhoDOPN, 3)} en fond de couche`;
  el("prOut").innerHTML = `w<sub>OPN</sub> = <strong>${fd(o.wOPN, 1)} %</strong> · ρ<sub>dOPN</sub> = <strong>${fd(o.rhoDOPN, 3)} Mg/m³</strong> ·
    à l'optimum S<sub>r</sub> = ${fd(sat.Sr, 0)} %, air ${fd(sat.air, 1)} %${Number.isFinite(r) ? ` · w<sub>n</sub>/w<sub>OPN</sub> = <strong>${fd(r, 2)}</strong>` : ""}
    <small>${Number.isFinite(r) ? `Le sol en place est ${cote}. ` : ""}Objectifs de densification : q4 (remblai) ρ<sub>d</sub> ≥ ${q(OBJECTIFS.q4)} Mg/m³ ;
    q3 (couche de forme) ≥ ${q(OBJECTIFS.q3)} Mg/m³.${sat.Sr > 90 ? " Un optimum à plus de 90 % de saturation est suspect : vérifier ρs et les pesées." : ""}
    Les points gris n'ont pas servi à l'ajustement.</small>`;
});
brancher(["prPoints", "prRhoS", "prWn"], majProctor);

// ── Seuils d'état hydrique d'une sous-classe ─────────────────────────────
/** Intervalle en clair, prêt pour innerHTML (les « < » échappés, le nom mis en forme). */
const crit = (txt, nomHtml, facteurHtml = "") => (txt
  ? esc(enClair(txt, "§", facteurHtml ? "¤" : "")).replace("§", nomHtml).replaceAll("¤", facteurHtml) : "—");
const NOMS = { IPI: "IPI", Ic: "I<sub>c</sub>", r: "w<sub>n</sub>" };
/** Équivalent de chaque sous-classe 2024 dans le GTR 1992 (seuils propres à chaque édition). */
const EQUIVALENT_1992 = { F1: "A1", F2: "A2", F3: "A3", F4: "A4", I1: "B5", I2: "B6", "S>70": "B2", "S≤70": "B4", G: "B4" };

function tableEtats(lignes) {
  const avec = ["IPI", "Ic", "r"].filter((p) => lignes.some((l) => l[p]));
  return `<table class="resultats"><thead><tr><th>État</th>${avec.map((p) => `<th>${p === "r" ? "r = w<sub>n</sub>/w<sub>OPN</sub>" : NOMS[p]}</th>`).join("")}</tr></thead><tbody>
    ${lignes.map((l) => `<tr><td>${pastille(l.etat)}</td>${avec.map((p) => `<td class="motif" style="white-space:nowrap">${crit(l[p], p === "r" ? "r" : NOMS[p])}</td>`).join("")}</tr>`).join("")}
  </tbody></table>`;
}

const majSeuils = garde("seTable", () => {
  const cle = el("seClasse").value, t = ETATS_2024[cle], c92 = EQUIVALENT_1992[cle], l92 = ETATS_1992[c92];
  const prio = t.prio.split(", ").map((p) => NOMS[p] ?? p).join(" et ");
  el("seTable").innerHTML = `<div class="comparaison">
    <div class="gtr24"><h4>GTR 2024 · ${esc(cle.replace(">", " > ").replace("≤", " ≤ "))}</h4>${tableEtats(t.lignes)}
      <p><small>Paramètre à privilégier : ${prio}.${cle === "G" ? " Les intervalles d'IPI des états h et m se recouvrent (7–15 et 12–30) : on lit les lignes de haut en bas, l'état le plus humide l'emporte." : ""}</small></p></div>
    <div class="gtr92"><h4>GTR 1992 · ${c92}</h4>${l92 ? tableEtats(l92) : `<p class="motif">Pas de seuils d'état pour ${c92} : leur réemploi demande une étude spécifique.</p>`}
      <p><small>${cle === "S≤70" ? "Équivalence approchée : en 1992 un sable dont le tamisat à 2 mm ne dépasse pas 70 % était classé B4, avec les seuils des graves." : cle === "G" ? "Les graves argileuses B4 ; les graves très silteuses ou argileuses étaient B5 ou B6." : "Classe la plus proche dans la NF P11-300."}</small></p></div>
  </div>`;
});
brancher(["seClasse"], majSeuils);

// ── Indice portant ────────────────────────────────────────────────────────
const CLES = Object.keys(ETATS_2024);
const LIBELLE_CLE = { "S>70": "S (2 mm > 70 %)", "S≤70": "S (2 mm ≤ 70 %)" };
const majIpi = garde("ipOut", () => {
  const F25 = num("ipF25"), F5 = num("ipF5"), mode = el("ipMode").value;
  if (!(F25 >= 0 && F5 >= 0)) { el("ipOut").textContent = "Renseigner les deux forces."; return; }
  const i25 = (100 * F25) / REFERENCE_CBR[2.5], i5 = (100 * F5) / REFERENCE_CBR[5], I = Math.max(i25, i5);
  const calc = `${fd(F25, 2)}/13,35 = ${fd(i25, 1)} % à 2,5 mm ; ${fd(F5, 2)}/20 = ${fd(i5, 1)} % à 5 mm`;
  if (mode === "IPI") {
    const parClasse = CLES.map((k) => [k, etatHydrique(k, { IPI: I })]).map(([k, e]) => `${esc(LIBELLE_CLE[k] ?? k)} ${e.applicable ? pastille(e.etat) : "—"}`);
    el("ipOut").innerHTML = `${calc} · <strong>IPI = ${fd(I, 1)}</strong>
      <small>Le même IPI ne dit pas la même chose pour tous les sols ; à lui seul, il situe l'état ainsi : ${parClasse.join(" · ")}.
      Un tiret : l'IPI n'a pas de seuil à ce niveau (états secs), c'est w<sub>n</sub>/w<sub>OPN</sub> qui tranche.</small>`;
  } else {
    el("ipOut").innerHTML = `${calc} · <strong>CBR<sub>i</sub> = ${fd(I, 1)}</strong>
      <small>${I > 20 ? "CBRi > 20 : le sol garde sa portance une fois immergé ; c'est l'un des critères qui permettent de dire « ins » (insensible à l'eau) un sable ou une grave à fines peu actives (fines de 5 à 12 %, VBS faible)."
        : "CBRi ≤ 20 : le matériau perd l'essentiel de sa portance quand il est mouillé ; il ne peut pas être dit insensible à l'eau par ce critère."}</small>`;
  }
});
brancher(["ipF25", "ipF5", "ipMode"], majIpi);

// ── État hydrique ─────────────────────────────────────────────────────────
/**
 * Réglettes d'état : une bande par paramètre de la sous-classe (wn/wOPN,
 * IPI, Ic), découpée en états colorés, avec la valeur du sol.
 */
function reglettes(cle, valeurs) {
  const t = ETATS_2024[cle];
  const PARAMS = [
    { p: "r", nom: "wn / wOPN", a: 0.4, b: 1.6, v: valeurs.r, fmt: (x) => fd(x, 2) },
    { p: "IPI", nom: "IPI", a: 0, b: 35, v: valeurs.IPI, fmt: (x) => fd(x, 1) },
    { p: "Ic", nom: "Ic", a: 0.6, b: 1.5, v: valeurs.Ic, fmt: (x) => fd(x, 2) },
  ].filter((q) => t.lignes.some((l) => l[q.p]));
  const x0 = 96, x1 = 610, hb = 18, pas = 62;
  return svg({ largeur: 640, hauteur: 20 + pas * PARAMS.length, titre: `États hydriques ${cle}`, contenu: () => {
    let s = "";
    PARAMS.forEach((q, i) => {
      const y = 24 + i * pas;
      const X = (x) => x0 + ((Math.max(q.a, Math.min(q.b, x)) - q.a) / (q.b - q.a)) * (x1 - x0);
      s += texte(x0 - 10, y + 13, q.nom, 'text-anchor="end" style="font-weight:800;font-size:12px"');
      s += `<rect x="${x0}" y="${y}" width="${x1 - x0}" height="${hb}" fill="#e2e8f0"/>`;
      // Les bandes, du plus humide au plus sec ; un intervalle déjà couvert par l'état précédent n'est pas redessiné.
      const bandes = [];
      for (const l of t.lignes) {
        if (!l[q.p]) continue;
        const I = intervalle(l[q.p]);
        bandes.push({ etat: l.etat, a: Math.max(I.a, q.a), b: Math.min(I.b, q.b) });
      }
      // IPI et Ic croissent du plus humide au plus sec ; wn/wOPN décroît : on recolle les bandes sans chevauchement.
      const croissant = q.p !== "r";
      bandes.sort((u, w) => (croissant ? u.a - w.a : w.a - u.a));
      let borne = croissant ? q.a : q.b;
      for (const bd of bandes) {
        const a = croissant ? Math.max(bd.a, borne) : bd.a, b = croissant ? bd.b : Math.min(bd.b, borne);
        if (!(b > a)) continue;
        s += `<rect x="${X(a).toFixed(1)}" y="${y}" width="${(X(b) - X(a)).toFixed(1)}" height="${hb}" fill="${TEINTE[bd.etat]}"/>`;
        if (X(b) - X(a) > 22) s += texte((X(a) + X(b)) / 2, y + 13, bd.etat, `text-anchor="middle" style="font-size:11px;font-weight:900;fill:${bd.etat === "m" || bd.etat === "s" ? "#111827" : "#fff"}"`);
        borne = croissant ? b : a;
      }
      // Graduations aux bornes.
      const bornes = new Set();
      for (const l of t.lignes) if (l[q.p]) { const I = intervalle(l[q.p]); for (const z of [I.a, I.b]) if (z > q.a && z < q.b) bornes.add(z); }
      for (const z of bornes) {
        s += ligne(X(z), y + hb, X(z), y + hb + 5, "#334155", 1);
        s += texte(X(z), y + hb + 16, q.fmt(z).replace(/,?0+$/, "") || "0", 'text-anchor="middle" style="font-size:10.5px;fill:#334155"');
      }
      if (Number.isFinite(q.v)) {
        const xv = X(q.v);
        s += `<path d="M${xv.toFixed(1)} ${y - 1} l-6 -9 h12 z" fill="${COULEURS.rouge}" stroke="#fff" stroke-width="1"/>`;
        s += ligne(xv, y, xv, y + hb, COULEURS.rouge, 2.4);
        s += texte(Math.min(Math.max(xv, x0 + 20), x1 - 20), y - 12, q.fmt(q.v), `text-anchor="middle" class="halo" style="font-size:11px;font-weight:900;fill:${COULEURS.rouge}"`);
      }
      if (q.p === "IPI" && !t.lignes.some((l) => (l.etat === "s" || l.etat === "ts") && l.IPI)) {
        const finM = Math.max(...t.lignes.filter((l) => l.IPI).map((l) => intervalle(l.IPI).b).filter(Number.isFinite));
        if (finM < q.b) s += texte((X(finM) + x1) / 2, y + 13, "pas de seuil", 'text-anchor="middle" style="font-size:10.5px;font-style:italic;fill:#475569"');
      }
    });
    return s;
  } });
}

const majEtat = garde("etOut", () => {
  const cle = el("etClasse").value, w = num("etW"), wOPN = num("etWopn"), IPI = num("etIpi"), Ic = num("etIc");
  const e = etatHydrique(cle, { IPI, Ic, w, wOPN });
  el("etFig").innerHTML = reglettes(cle, { r: w / wOPN, IPI, Ic });
  if (!e.applicable) { el("etOut").innerHTML = `<span class="verdict ko">état indéterminé</span> <small>${esc(e.motif)}</small>`; return; }
  const detail = e.mesures.map(([p, et, v]) => `${p === "wn/wOPN" ? "w<sub>n</sub>/w<sub>OPN</sub>" : NOMS[p]} = ${p === "IPI" ? f(v, 3) : fd(v, 2)} → ${pastille(et)}`).join(" · ");
  const conseil = { th: "inutilisable en l'état : il faut d'abord l'assécher (aération, traitement à la chaux) ou le mettre en dépôt",
    h: "réemploi possible avec des précautions : traitement, aération, compactage faible, remblais de hauteur limitée",
    m: "l'état le plus favorable : mise en œuvre sans contrainte particulière liée à l'eau",
    s: "réemploi possible en humidifiant, ou avec un compactage intense ; prudence dans les remblais hauts",
    ts: "trop sec pour être bien compacté : humidifier dans la masse avant de l'employer" }[e.etat];
  el("etOut").innerHTML = `État : ${pastille(e.etat)} <strong>${NOM_ETAT[e.etat]}</strong> (déterminé par ${e.par === "wn/wOPN" ? "w<sub>n</sub>/w<sub>OPN</sub>" : NOMS[e.par] ?? e.par}) — symbole <strong>${esc(cle.replace(/[>≤]70/, ""))}${e.etat}</strong>
    <small>${detail}. ${e.discordance ? "Les paramètres ne concordent pas : on retient l'IPI pour un état humide, la teneur en eau pour un état sec. " : ""}${conseil}.</small>`;
});
brancher(["etClasse", "etW", "etWopn", "etIpi", "etIc"], majEtat);
