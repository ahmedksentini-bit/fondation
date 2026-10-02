// Chapitre 6 : rubriques des conditions d'utilisation en remblai, décodage
// d'un code E G W T R C H, et explorateur des tableaux de l'annexe 2 du
// fascicule 2 (tous les cas, toutes les situations météorologiques).
import { el, esc, brancher, garde } from "./ui.js";
import { RUBRIQUES_REMBLAI, METEOS, decoder, couvre } from "./gtr/utilisation.js";
import { REMBLAI, ANOMALIES } from "./gtr/tables-remblai.js";
import { codeHtml } from "./codes.js";

// ── Tableau des rubriques ─────────────────────────────────────────────────
el("tabRubriques").innerHTML = Object.entries(RUBRIQUES_REMBLAI).map(([l, r]) => {
  const vals = r.valeurs.map((t, v) => [v, t]).filter(([, t]) => t);
  return vals.map(([v, t], i) => `<tr>${i === 0 ? `<td rowspan="${vals.length}"><strong>${l}</strong> · ${esc(r.nom)}</td>` : ""}<td class="n">${v}</td><td class="motif">${esc(t)}</td></tr>`).join("");
}).join("");

// ── Décodage d'un code ────────────────────────────────────────────────────
const majCode = garde("cdOut", () => {
  const code = el("cdCode").value.replace(/\D/g, "");
  if (code.length !== 7) { el("cdOut").innerHTML = `<p class="method-note">Un code de remblai a sept chiffres, un par rubrique E G W T R C H.</p>`; return; }
  const d = decoder(code);
  const faux = d.filter((x) => x.texte === "?" || x.texte === null);
  el("cdOut").innerHTML = `<p>${codeHtml(code)}</p><table class="resultats"><tbody>${d.map((x) => `<tr${x.valeur && !(x.rubrique === "C" && x.valeur === 2) ? ' style="background:#f0fdfa"' : ""}><td><strong>${x.rubrique}</strong> · ${esc(x.nom)}</td><td class="n">${x.valeur}</td><td class="motif">${esc(x.texte === "?" || x.texte === null ? "valeur inexistante pour cette rubrique" : x.texte)}</td></tr>`).join("")}</tbody></table>
    ${faux.length ? `<p><span class="verdict ko">code invalide</span> rubrique${faux.length > 1 ? "s" : ""} ${faux.map((x) => x.rubrique).join(", ")}.</p>` : ""}`;
});
brancher(["cdCode"], majCode);

// ── Explorateur des tableaux ──────────────────────────────────────────────
const GROUPES = [
  ["Sols fins F", (k) => /^F/.test(k)], ["Sols intermédiaires I", (k) => /^I/.test(k)], ["Sables S", (k) => /^S\d/.test(k)], ["Graves G", (k) => /^G/.test(k)],
  ["Sols VC2", (k) => /^VC2/.test(k)], ["Sols VC1", (k) => /^VC1/.test(k)], ["Craies CH", (k) => /^CH/.test(k)],
  ["Roches", (k) => /^R\d|^SR/.test(k)], ["Organiques, matériaux particuliers, recyclés, sous-produits", () => true],
];
const libelle = (c) => (c.classes.length > 4 ? `${c.classes.slice(0, 3).join(", ")}… (${c.classes.length} sous-classes)` : c.classes.join(", ")) + (c.precision ? ` — ${c.precision}` : "");
const places = new Set();
el("reClasse").innerHTML = GROUPES.map(([nom, test]) => {
  const opts = REMBLAI.map((c, i) => [c, i]).filter(([c, i]) => !places.has(i) && test(c.classes[0]));
  opts.forEach(([, i]) => places.add(i));
  return opts.length ? `<optgroup label="${esc(nom)}">${opts.map(([c, i]) => `<option value="${i}">${esc(libelle(c))}</option>`).join("")}</optgroup>` : "";
}).join("");
el("reClasse").value = String(REMBLAI.findIndex((c) => c.classes.includes("F2h")));

const NOM_METEO = Object.fromEntries(METEOS.map((m) => [m.symbole, m.nom]));
const meteoEnClair = (m) => String(m).split("/").map((x) => `<strong>${esc(x.replace("-", "−"))}</strong>`).join(" ");
const nonHtml = (t) => `<p><span class="verdict ko">NON</span> ${esc(t)}</p>`;

const majRemblai = garde("reOut", () => {
  const c = REMBLAI[Number(el("reClasse").value)], meteo = el("reMeteo").value;
  if (!c) return;
  const tete = `<p><span class="classe gtr24">${c.classes.map(esc).join("</span> <span class=\"classe gtr24\">")}</span>${c.precision ? ` <small>(${esc(c.precision)})</small>` : ""} <small>fascicule 2, annexe 2, p. ${c.page}</small></p>`;
  if (c.non) { el("reOut").innerHTML = tete + nonHtml(c.non); return; }
  if (c.renvoi) { el("reOut").innerHTML = tete + `<p class="method-note">${esc(c.renvoi)}</p>`; return; }
  const lignes = c.situations.map((s) => {
    const choisie = couvre(s.meteo, meteo);
    const contenu = s.non ? nonHtml(s.non) : s.solutions.map((x) => `<div style="margin:6px 0">
        ${x.titre ? `<strong>${esc(x.titre)}</strong> ` : ""}${codeHtml(x.code)}
        <ul style="margin:4px 0 0 18px">${x.conditions.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>`).join("");
    return `<tr${choisie ? ' style="background:#f0fdfa;outline:2px solid #0f766e"' : ""}><td style="white-space:nowrap">${meteoEnClair(s.meteo)}<small>${esc(s.libelle ?? s.meteo.split("/").map((m) => NOM_METEO[m]).join(", "))}</small></td><td>${contenu}</td></tr>`;
  }).join("");
  const couverte = c.situations.some((s) => couvre(s.meteo, meteo));
  el("reOut").innerHTML = tete + `<table class="resultats"><thead><tr><th>Météo</th><th>Conditions d'utilisation</th></tr></thead><tbody>${lignes}</tbody></table>`
    + (couverte ? "" : `<p class="method-note">La situation « ${esc(NOM_METEO[meteo])} » n'est pas décrite pour ce cas : le guide n'y prévoit pas de mise en remblai.</p>`);
});
brancher(["reClasse", "reMeteo"], majRemblai);

el("reAnomalies").innerHTML = ANOMALIES.map((a) => `<li><strong>p. ${a.page} · ${esc(a.classes.join(", "))}</strong>${a.meteo ? ` · météo ${esc(a.meteo)}` : ""}${a.code ? ` · code ${esc(a.code)}` : ""} : ${esc(a.texte)}</li>`).join("");
