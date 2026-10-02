// Aides communes aux modules du bureau de calcul : lecture des saisies,
// écriture des nombres, petits tableaux de la note de calcul.

export const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const f = (x, c = 3) => (Number.isFinite(x) ? Number(x).toLocaleString("fr-FR", { maximumSignificantDigits: c }) : "—");
export const fd = (x, d = 2) => (Number.isFinite(x) ? Number(x).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—");

/** Nombre saisi (virgule acceptée) ; défaut si vide ou illisible. */
export const nombre = (v, defaut = NaN) => {
  const x = parseFloat(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(x) ? x : defaut;
};

/** Tableau de nombres saisi, une ligne par mesure (espaces, tabulations ou points-virgules). */
export function lignes(texte) {
  return String(texte ?? "").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !/^[A-Za-zÀ-ÿ#]/.test(l))
    .map((l) => (/[;\t]/.test(l) ? l.split(/[;\t]+/) : l.split(/\s+/)).map((c) => parseFloat(c.replace(",", "."))))
    .filter((r) => r.length && Number.isFinite(r[0]));
}

export const pastille = (ok, oui = "vérifié", non = "non vérifié") => (ok === null || ok === undefined
  ? `<span class="verdict na">sans objet</span>` : `<span class="verdict ${ok ? "ok" : "ko"}">${ok ? `✓ ${oui}` : `✕ ${non}`}</span>`);

/** Tableau HTML simple : en-têtes et lignes déjà formatées. */
export const tableau = (entetes, rangees, classe = "resultats") => `<div class="table-large"><table class="${classe}"><thead><tr>${entetes.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
  <tbody>${rangees.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;

/** Liste « donnée : valeur » de la note de calcul. */
export const donnees = (paires) => tableau(["Donnée", "Valeur"], paires.filter(([, v]) => v !== null && v !== undefined && v !== "").map(([k, v]) => [k, v]));

/** Chemin de classement (arbre de décision) en liste numérotée. */
export const arbre = (etapes) => `<ol class="arbre">${etapes.map((e, i) => `<li${i === etapes.length - 1 ? ' class="retenu"' : ""}><strong>${esc(e.question)}</strong> ${esc(e.reponse)}${e.detail ? `<small>${esc(e.detail)}</small>` : ""}</li>`).join("")}</ol>`;

export const classe = (s, edition = "gtr24", taille = 0) => `<span class="classe ${edition}"${taille ? ` style="font-size:${taille}px"` : ""}>${esc(s)}</span>`;
