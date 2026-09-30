// Bureau de calcul : cinq modules dans une coque de logiciel. Les calculs sont
// faits par src/bureau/semelle.js, src/bureau/pieu.js et les solveurs de
// src/geotech ; ce fichier ne gère que la saisie, la sauvegarde, les figures
// et l'impression de la note.

import { justifierSemelle } from "./bureau/semelle.js";
import { justifierPieu, combinaisonsPieu } from "./bureau/pieu.js";
import { noteSemelle, notePieu } from "./bureau/notes.js";
import { coupeSemelle, coupePieu, graphe, echantillon, COULEURS } from "./figures.js";
import { CLASSES_F62, CATEGORIES_EC7 } from "./geotech/sols.js";
import { K_TAN_DELTA, lambdaCombarieu, muIsole, frottementNegatif, rayonInfluence, repartitionGroupe } from "./geotech/frottement-negatif.js";
import { converseLabarre, efficaciteCoherentF62, efficaciteEC7, verifGroupeEC7, blocMonolithique } from "./geotech/groupes.js";
import { moduleKf, minorationSurface, pieuLongAnalytique, pieuDifferencesFinies, pieuSouple } from "./geotech/lateral.js";

const app = document.getElementById("app");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const f = (x, c = 3) => (Number.isFinite(x) ? Number(x).toLocaleString("fr-FR", { maximumSignificantDigits: c }) : "—");
const fd = (x, d = 2) => (Number.isFinite(x) ? Number(x).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—");
const nombre = (v, defaut = NaN) => {
  const x = parseFloat(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(x) ? x : defaut;
};
const pastille = (ok) => `<span class="verdict ${ok ? "ok" : "ko"}">${ok ? "✓ vérifié" : "✕ non vérifié"}</span>`;
const CLE = "fondations-bureau-v1";

const OPT_CLASSES = Object.entries(CLASSES_F62).map(([k, c]) => [k, `${c.nom} (${c.lettre})`]);
const OPT_CATEGORIES = Object.entries(CATEGORIES_EC7).map(([k, c]) => [k, c.nom]);
const OPT_ALPHA = [["1", "1"], ["0.6666666667", "2/3"], ["0.5", "1/2"], ["0.3333333333", "1/3"], ["0.25", "1/4"]];
const TYPES_PIEU = [
  ["fore-simple|1", "Foré simple (cat. 1)"], ["fore-boue|2", "Foré boue (cat. 2)"], ["fore-tube-perdu|3", "Foré tubé, virole perdue (cat. 3)"],
  ["fore-tube-recupere|4", "Foré tubé, virole récupérée (cat. 4)"], ["battu-prefabrique|9", "Battu préfabriqué béton (cat. 9)"],
  ["battu-enrobe|10", "Battu enrobé (cat. 10)"], ["battu-moule|11", "Battu moulé (cat. 11)"], ["metal-battu-ferme|12", "Acier battu fermé (cat. 12)"],
  ["tube-ouvert|13", "Acier battu ouvert (cat. 13)"], ["profile-H|14", "Profilé H battu (cat. 14)"],
  ["injecte-bp|19", "Injecté basse pression / IGU (cat. 19)"], ["injecte-hp|20", "Injecté haute pression / IRS (cat. 20)"],
];

// ─────────────────────────── Définition des modules ───────────────────────
const MODULES = [
  {
    id: "semelle", groupe: "Fondations superficielles", icone: "▭", titre: "Semelle", sous: "excentrement, portance, glissement, tassement",
    description: "Une semelle justifiée au Fascicule 62 titre V et à la NF P94-261 sur les mêmes données : combinaisons, excentrement, portance pressiométrique, glissement et tassement de Ménard.",
    champs: [
      ["Géométrie", [
        ["forme", "Forme", "choix", "filante", [["filante", "filante"], ["rectangulaire", "rectangulaire"], ["carree", "carrée"]]],
        ["B", "Largeur B", "m", "3"], ["L", "Longueur L", "m", "12", (v) => v.forme === "rectangulaire"],
        ["D", "Profondeur de la base D", "m", "0.8"], ["h", "Épaisseur de la semelle", "m", "0.5"],
      ]],
      ["Sol et eau", [
        ["zw", "Profondeur de la nappe (vide : pas de nappe)", "m", ""],
        ["comportement", "Comportement pour l'inclinaison", "choix", "frottant", [["frottant", "frottant"], ["coherent", "cohérent"]]],
        ["phi", "φ' (glissement F62)", "°", "25"], ["phiCrit", "φ'crit (glissement EC7)", "°", "25"], ["c", "c'", "kPa", "0"],
        ["cu", "cu (0 : pas de vérification à court terme)", "kPa", "0"],
        ["prefabrique", "Semelle", "choix", "non", [["non", "coulée en place"], ["oui", "préfabriquée lisse"]]],
        ["alpha", "Coefficient α (tassement)", "choix", "0.5", OPT_ALPHA],
      ]],
      ["Actions au-dessus de la semelle", [
        ["GV", "G : V", "kN(/m)", "70"], ["GH", "G : H", "kN(/m)", "8"], ["GM", "G : M", "kN·m(/m)", "0"],
        ["QV", "Q : V", "kN(/m)", "25"], ["QH", "Q : H", "kN(/m)", "6"], ["QM", "Q : M", "kN·m(/m)", "0"],
        ["psi0", "ψ0", "", "0.7"], ["psi1", "ψ1", "", "0.5"], ["psi2", "ψ2", "", "0.3"],
      ]],
    ],
    couches: {
      colonnes: [["base", "Base (m)", "nombre"], ["classe", "Classe F62", "choix", OPT_CLASSES], ["categorie", "Catégorie EC7", "choix", OPT_CATEGORIES],
        ["gamma", "γ (kN/m³)", "nombre"], ["gammaSat", "γsat", "nombre"], ["pl", "pl* (MPa)", "nombre"], ["EM", "EM (MPa)", "nombre"]],
      defaut: [
        { base: "0.8", classe: "sable-A", categorie: "sable", gamma: "20", gammaSat: "21", pl: "1", EM: "10" },
        { base: "3.8", classe: "argile-A", categorie: "argile", gamma: "20", gammaSat: "20", pl: "0.7", EM: "6" },
        { base: "25", classe: "sable-B", categorie: "sable", gamma: "20", gammaSat: "21", pl: "2", EM: "20" },
      ],
    },
    calculer: calculerSemelle,
  },
  {
    id: "pieu", groupe: "Fondations profondes", icone: "▮", titre: "Pieu isolé", sous: "portance et justification axiale",
    description: "Un pieu isolé sous charge axiale : portance au Fascicule 62 (annexes C.3, C.4) et à la NF P94-262 (annexes F, G), cumul avec le frottement négatif, justifications aux ELU et ELS, tassement.",
    champs: [
      ["Pieu", [
        ["type", "Type de pieu", "choix", "fore-boue|2", TYPES_PIEU],
        ["forme", "Section", "choix", "circulaire", [["circulaire", "circulaire"], ["carre", "carrée"]]],
        ["B", "Diamètre ou côté B", "m", "0.8"], ["D", "Longueur D", "m", "15"],
        ["methode", "Essai", "choix", "pressio", [["pressio", "pressiomètre"], ["penetro", "pénétromètre"]]],
        ["zf", "Frottement négligé au-dessus de", "m", "0"], ["Ep", "Module du béton", "MPa", "20000"],
      ]],
      ["Procédure de la NF P94-262", [
        ["procedure", "Procédure", "choix", "terrain", [["terrain", "modèle de terrain"], ["modele", "pieu modèle"]]],
        ["N", "Nombre de sondages", "", "3", (v) => v.procedure === "modele"], ["S", "Surface d'investigation", "m²", "400", (v) => v.procedure === "modele"],
        ["raide", "Structure", "choix", "non", [["non", "souple"], ["oui", "raide (ξ/1,1)"]], (v) => v.procedure === "modele"],
      ]],
      ["Actions en tête", [
        ["G", "G", "kN", "1500"], ["Q", "Q", "kN", "500"], ["psi2", "ψ2", "", "0.3"], ["Fn", "Frottement négatif Gsn", "kN", "0"],
      ]],
    ],
    couches: {
      colonnes: [["base", "Base (m)", "nombre"], ["classe", "Classe F62", "choix", OPT_CLASSES], ["categorie", "Catégorie EC7", "choix", OPT_CATEGORIES],
        ["pl", "pl* (MPa)", "nombre"], ["qc", "qc (MPa)", "nombre"], ["EM", "EM (MPa)", "nombre"]],
      defaut: [
        { base: "5", classe: "argile-A", categorie: "argile", pl: "0.5", qc: "1.2", EM: "5" },
        { base: "12", classe: "sable-B", categorie: "sable", pl: "1.5", qc: "10", EM: "15" },
        { base: "30", classe: "marne-A", categorie: "marne", pl: "2.5", qc: "8", EM: "30" },
      ],
    },
    calculer: calculerPieu,
  },
  {
    id: "frottement", groupe: "Fondations profondes", icone: "⇊", titre: "Frottement négatif", sous: "Combarieu, isolé et en groupe",
    description: "Frottement négatif sous un remblai par la méthode de Combarieu (F62 annexe G.2 ; NF P94-262 annexe H), pieu isolé et pieu en groupe, et effort axial de calcul avec la règle de cumul.",
    champs: [
      ["Pieu et groupe", [
        ["B", "Diamètre B", "m", "0.6"], ["mise", "Pieu", "choix", "fore", [["tube", "tubé"], ["fore", "foré"], ["battu", "battu"], ["bitume", "chemisé au bitume"]]],
        ["d", "Entraxe d", "m", "1.8"], ["files", "Nombre de files", "", "3"],
      ]],
      ["Sol compressible et remblai", [
        ["nature", "Couche compressible", "choix", "argile-molle", [["tourbe", "tourbe"], ["argile-molle", "argile ou limon mou"], ["argile-ferme", "argile ferme"]]],
        ["H", "Épaisseur compressible", "m", "10"], ["gamma", "γ' de la couche", "kN/m³", "6"], ["h2", "h2 (vide : base de la couche)", "m", ""],
        ["hr", "Hauteur de remblai", "m", "3"], ["gr", "γ du remblai", "kN/m³", "20"],
        ["natR", "Remblai", "choix", "sable-autre", [["sable-autre", "granulaire"], ["sable-lache", "sable lâche"], ["argile-ferme", "argileux compacté"]]],
      ]],
      ["Actions en tête", [["G", "G", "kN", "900"], ["Q", "Q", "kN", "300"], ["psi2", "ψ2", "", "0.3"]]],
    ],
    calculer: calculerFrottement,
  },
  {
    id: "groupe", groupe: "Fondations profondes", icone: "⋮", titre: "Groupe de pieux", sous: "efficacité et bloc monolithique",
    description: "Coefficient d'efficacité d'un groupe en maille rectangulaire : Converse-Labarre et formule des sols cohérents (F62 annexe G.1), annexe J de la NF P94-262 ; résistance du groupe et dimensions du bloc.",
    champs: [
      ["Groupe", [["B", "Diamètre B", "m", "0.6"], ["d", "Entraxe d", "m", "1.5"], ["m", "Rangées m", "", "3"], ["n", "Pieux par rangée n", "", "4"],
        ["sol", "Sol et mise en œuvre (F62)", "choix", "frottant", [["coherent", "sol cohérent"], ["frottant", "sol frottant, sans refoulement"], ["lache", "sable lâche, refoulement"]]]]],
      ["Pieu isolé et charge", [["Rbd", "Rb;d d'un pieu", "kN", "300"], ["Rsd", "Rs;d d'un pieu", "kN", "900"], ["Qmax", "Qmax F62 d'un pieu (ELU)", "kN", "1150"], ["F", "Charge totale du groupe (ELU)", "kN", "11000"]]],
    ],
    calculer: calculerGroupe,
  },
  {
    id: "lateral", groupe: "Fondations profondes", icone: "⇉", titre: "Effort transversal", sous: "réaction de Ménard, différences finies",
    description: "Pieu sous effort horizontal et moment en tête dans un sol à deux couches : module de réaction de Ménard, palier B·pf*, minoration près de la surface, résolution par différences finies.",
    champs: [
      ["Pieu et chargement", [["B", "Diamètre B", "m", "0.8"], ["L", "Longueur L", "m", "15"], ["E", "Module du béton", "MPa", "30000"],
        ["H", "Effort H en tête", "kN", "150"], ["M", "Moment M en tête", "kN·m", "0"],
        ["tete", "Tête", "choix", "libre", [["libre", "libre"], ["encastree", "encastrée"]]],
        ["duree", "Sollicitation", "choix", "courte", [["courte", "courte durée"], ["longue", "longue durée"]]],
        ["min", "Minoration près de la surface", "choix", "oui", [["non", "non"], ["oui", "oui"], ["simple", "simplifiée (0,5 et 0,7)"]]]]],
      ["Sol", [["h1", "Couche 1 : épaisseur", "m", "4"], ["sol1", "Couche 1 : nature", "choix", "coherent", [["coherent", "cohérente"], ["frottant", "frottante"]]],
        ["EM1", "Couche 1 : EM", "MPa", "8"], ["a1", "Couche 1 : α", "choix", "0.6666666667", OPT_ALPHA], ["pf1", "Couche 1 : pf*", "MPa", "0.5"],
        ["EM2", "Couche 2 : EM", "MPa", "25"], ["a2", "Couche 2 : α", "choix", "0.5", OPT_ALPHA], ["pf2", "Couche 2 : pf*", "MPa", "1.2"]]],
    ],
    calculer: calculerLateral,
  },
];

// ─────────────────────────── État et sauvegarde ───────────────────────────
function valeursParDefaut(m) {
  const v = {};
  for (const [, champs] of m.champs) for (const [id, , , def] of champs) v[id] = def;
  if (m.couches) v.couches = m.couches.defaut.map((c) => ({ ...c }));
  return v;
}
function lireEtat() {
  try { const e = JSON.parse(localStorage.getItem(CLE) || "null"); if (e && e.valeurs) return e; } catch { /* stockage indisponible */ }
  return { module: "semelle", valeurs: {} };
}
function ecrireEtat() { try { localStorage.setItem(CLE, JSON.stringify(etat)); } catch { /* navigation privée */ } }

const etat = lireEtat();
for (const m of MODULES) etat.valeurs[m.id] = { ...valeursParDefaut(m), ...(etat.valeurs[m.id] ?? {}) };

function toast(texte) {
  const t = document.getElementById("toast");
  t.textContent = texte; t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2400);
}

// ─────────────────────────── Rendu de la coque ────────────────────────────
function rendre() {
  const m = MODULES.find((x) => x.id === etat.module) ?? MODULES[0];
  const v = etat.valeurs[m.id];
  const groupes = [...new Set(MODULES.map((x) => x.groupe))];
  app.innerHTML = `
  <div class="software-shell bureau">
    <aside class="software-sidebar">
      <div class="software-title"><span class="module-icon">⌗</span><div><p>BUREAU DE CALCUL</p><h1>Fondations</h1></div></div>
      <nav>${groupes.map((g) => `<div class="software-group"><p>${esc(g)}</p>${MODULES.filter((x) => x.groupe === g).map((x) => `
        <button class="software-module${x.id === m.id ? " active" : ""}" data-module="${x.id}"><span class="module-icon">${x.icone}</span>
          <span><strong>${esc(x.titre)}</strong><small>${esc(x.sous)}</small></span></button>`).join("")}</div>`).join("")}</nav>
      <button class="software-study" id="imprimer">Imprimer la note de calcul</button>
    </aside>
    <section class="software-main">
      <div class="software-head"><div><p class="eyebrow">Fascicule 62 titre V · Eurocode 7</p><h2>${esc(m.titre)}</h2><p>${esc(m.description)}</p></div>
        <div class="bureau-actions">
          <button class="ghost" id="exporter">Exporter</button><button class="ghost" id="importer">Importer</button>
          <button class="ghost" id="reinit">Valeurs de départ</button></div></div>
      <div class="bureau-grid">
        <div class="software-panel bureau-saisie">
          ${m.champs.map(([titre, champs]) => `<div class="bureau-groupe"><h3>${esc(titre)}</h3><div class="data-grid">
            ${champs.map((c) => champ(c, v)).join("")}</div></div>`).join("")}
          ${m.couches ? `<div class="bureau-groupe"><h3>Couches de sol <small>(profondeur de la base de chaque couche, depuis le terrain après travaux)</small></h3>
            <div class="table-large"><table class="couches-table"><thead><tr>${m.couches.colonnes.map(([, t]) => `<th>${esc(t)}</th>`).join("")}<th></th></tr></thead>
            <tbody>${v.couches.map((c, i) => ligneCouche(m, c, i)).join("")}</tbody></table></div>
            <div class="actions"><button class="ghost" id="ajouterCouche">Ajouter une couche</button></div></div>` : ""}
        </div>
        <div class="software-panel bureau-resultats">
          <div class="software-diagram" id="figure"></div>
          <div id="synthese"></div>
        </div>
      </div>
      <section class="software-panel note-calcul" id="note"></section>
    </section>
  </div>`;
  brancher(m);
  calculer(m);
}

function champ([id, label, unite, , options, visible], v) {
  // Pour un champ numérique, la fonction de visibilité occupe la place des options.
  if (typeof options === "function") { visible = options; options = null; }
  const cache = visible && !visible(v) ? ' style="display:none"' : "";
  if (unite === "choix") {
    return `<div class="field"${cache}><label for="c_${id}">${esc(label)}</label><div class="input-wrap"><select id="c_${id}" data-champ="${id}">
      ${options.map(([val, t]) => `<option value="${esc(val)}"${String(v[id]) === String(val) ? " selected" : ""}>${esc(t)}</option>`).join("")}</select></div></div>`;
  }
  return `<div class="field"${cache}><label for="c_${id}">${esc(label)}</label><div class="input-wrap">
    <input id="c_${id}" data-champ="${id}" type="text" inputmode="decimal" value="${esc(v[id])}">${unite ? `<span class="unit">${esc(unite)}</span>` : ""}</div></div>`;
}

function ligneCouche(m, c, i) {
  return `<tr>${m.couches.colonnes.map(([id, t, type, options]) => type === "choix"
    ? `<td><select data-couche="${i}" data-col="${id}" aria-label="${esc(t)}, couche ${i + 1}">${options.map(([val, txt]) => `<option value="${esc(val)}"${c[id] === val ? " selected" : ""}>${esc(txt)}</option>`).join("")}</select></td>`
    : `<td><input data-couche="${i}" data-col="${id}" type="text" inputmode="decimal" value="${esc(c[id] ?? "")}" style="width:4.8em" aria-label="${esc(t)}, couche ${i + 1}"></td>`).join("")}
    <td><button data-suppr="${i}" title="Supprimer la couche" aria-label="Supprimer la couche ${i + 1}">✕</button></td></tr>`;
}

let minuteur = null;
function brancher(m) {
  const v = etat.valeurs[m.id];
  app.querySelectorAll("[data-module]").forEach((b) => b.addEventListener("click", () => { etat.module = b.dataset.module; ecrireEtat(); rendre(); }));
  const maj = () => { clearTimeout(minuteur); minuteur = setTimeout(() => { ecrireEtat(); calculer(m); }, 150); };
  app.querySelectorAll("[data-champ]").forEach((e) => {
    const evt = e.tagName === "SELECT" ? "change" : "input";
    e.addEventListener(evt, () => {
      v[e.dataset.champ] = e.value;
      // Un choix peut montrer ou cacher d'autres champs : on redessine.
      if (e.tagName === "SELECT") { ecrireEtat(); rendre(); } else maj();
    });
  });
  app.querySelectorAll("[data-couche]").forEach((e) => {
    e.addEventListener(e.tagName === "SELECT" ? "change" : "input", () => { v.couches[Number(e.dataset.couche)][e.dataset.col] = e.value; maj(); });
  });
  app.querySelectorAll("[data-suppr]").forEach((b) => b.addEventListener("click", () => {
    if (v.couches.length <= 1) return toast("Il faut au moins une couche.");
    v.couches.splice(Number(b.dataset.suppr), 1); ecrireEtat(); rendre();
  }));
  const ajout = app.querySelector("#ajouterCouche");
  if (ajout) ajout.addEventListener("click", () => {
    const der = v.couches[v.couches.length - 1];
    v.couches.push({ ...der, base: String(nombre(der.base, 0) + 5) }); ecrireEtat(); rendre();
  });
  app.querySelector("#imprimer").addEventListener("click", () => window.print());
  app.querySelector("#reinit").addEventListener("click", () => { etat.valeurs[m.id] = valeursParDefaut(m); ecrireEtat(); rendre(); toast("Valeurs de départ rétablies."); });
  app.querySelector("#exporter").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ module: m.id, valeurs: etat.valeurs[m.id], date: new Date().toISOString() }, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `fondations-${m.id}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  app.querySelector("#importer").addEventListener("click", () => document.getElementById("fichierImport").click());
}

document.getElementById("fichierImport").addEventListener("change", async (e) => {
  const fichier = e.target.files[0];
  e.target.value = "";
  if (!fichier) return;
  try {
    const d = JSON.parse(await fichier.text());
    const m = MODULES.find((x) => x.id === d.module);
    if (!m || typeof d.valeurs !== "object") throw new Error("fichier sans module reconnu");
    etat.module = m.id;
    etat.valeurs[m.id] = { ...valeursParDefaut(m), ...d.valeurs };
    ecrireEtat(); rendre(); toast(`Projet « ${m.titre} » importé.`);
  } catch (err) { toast(`Import impossible : ${err.message}`); }
});

function calculer(m) {
  const v = etat.valeurs[m.id];
  const zones = { figure: app.querySelector("#figure"), synthese: app.querySelector("#synthese"), note: app.querySelector("#note") };
  try {
    const r = m.calculer(v);
    zones.figure.innerHTML = r.figure ?? "";
    zones.synthese.innerHTML = r.synthese;
    zones.note.innerHTML = `<h2>Note de calcul — ${esc(m.titre)}</h2><p class="method-note">Établie le ${new Date().toLocaleDateString("fr-FR")} avec le bureau de calcul du cours « Fondations des ouvrages ». Les valeurs sont celles de la saisie ci-dessus.</p>${r.note}`;
  } catch (e) {
    console.error(e);
    zones.figure.innerHTML = "";
    zones.synthese.innerHTML = `<p class="final-result bureau-verdict ko">Calcul impossible : ${esc(e.message)}</p>`;
    zones.note.innerHTML = "";
  }
}

/** « argile A · pl* 0,70 » : assez court pour ne pas chevaucher la fondation. */
const etiquetteCourte = (c) => `${c.classe.replace("-", " ")}${Number.isFinite(c.pl) ? ` · pl* ${fd(c.pl, 2)}` : ""}`;

// ─────────────────────────── Lecture des couches ──────────────────────────
function couchesDe(v, cles) {
  const res = [];
  let z = 0;
  for (const c of v.couches) {
    const base = nombre(c.base);
    if (!(base > z)) continue;
    const x = { z0: z, z1: base, classe: c.classe, categorie: c.categorie };
    for (const k of cles) x[k] = nombre(c[k]);
    res.push(x);
    z = base;
  }
  if (!res.length) throw new Error("aucune couche valide : les bases doivent croître");
  return res;
}

// ─────────────────────────── Calculs des modules ──────────────────────────
function calculerSemelle(v) {
  const couches = couchesDe(v, ["gamma", "gammaSat", "pl", "EM"]).map((c) => ({ ...c, gammaSat: Number.isFinite(c.gammaSat) ? c.gammaSat : c.gamma }));
  if (couches.some((c) => !(c.gamma > 0 && c.pl > 0))) throw new Error("renseigner γ et pl* dans chaque couche");
  const d = {
    forme: v.forme, B: nombre(v.B), L: nombre(v.L), D: nombre(v.D), h: nombre(v.h), zw: nombre(v.zw, Infinity),
    comportement: v.comportement, phi: nombre(v.phi, 30), phiCrit: nombre(v.phiCrit, 30), c: nombre(v.c, 0), cu: nombre(v.cu, 0),
    prefabrique: v.prefabrique === "oui", alpha: nombre(v.alpha, 0.5), couches,
    G: { V: nombre(v.GV, 0), H: nombre(v.GH, 0), M: nombre(v.GM, 0) }, Q: { V: nombre(v.QV, 0), H: nombre(v.QH, 0), M: nombre(v.QM, 0) },
    psi: { psi0: nombre(v.psi0, 0.7), psi1: nombre(v.psi1, 0.5), psi2: nombre(v.psi2, 0.3) },
  };
  const r = justifierSemelle(d);
  const elu = r.etats.EC7.find((x) => x.cle === "ELU");
  const figure = coupeSemelle({
    B: d.B, D: d.D, e: Math.min(elu.e, d.B / 2), V: "Vd", H: elu.H, epaisseur: d.h, zNappe: Number.isFinite(d.zw) ? d.zw : null,
    hauteur: 300, profondeurVue: d.D + 2 * d.B, montrerHr: 1.5 * d.B,
    couches: couches.map((c) => ({ z0: c.z0, z1: c.z1, sol: c.classe, etiquette: c.z0 >= d.D - 1e-9 ? etiquetteCourte(c) : null })),
  });
  return { figure, ...noteSemelle(r, d) };
}

function calculerPieu(v) {
  const [type, cat] = String(v.type).split("|");
  const couches = couchesDe(v, ["pl", "qc", "EM"]);
  const d = {
    type, cat: Number(cat), B: nombre(v.B), D: nombre(v.D), forme: v.forme, methode: v.methode, zf: nombre(v.zf, 0), couches,
    procedure: v.procedure, N: Math.max(1, Math.round(nombre(v.N, 1))), S: nombre(v.S, 100), raide: v.raide === "oui",
    G: nombre(v.G, 0), Q: nombre(v.Q, 0), psi2: nombre(v.psi2, 0.3), Fn: nombre(v.Fn, 0), Ep: nombre(v.Ep, 20000),
  };
  const cle = d.methode === "pressio" ? "pl" : "qc";
  if (couches.some((c) => !(c[cle] > 0))) throw new Error(`renseigner ${cle === "pl" ? "pl*" : "qc"} dans chaque couche`);
  const r = justifierPieu(d);
  const qs = r.EC7.applicable ? r.EC7.lignes : r.F62.applicable ? r.F62.lignes : [];
  const figure = coupePieu({
    B: d.B, D: d.D, hauteur: 360, zMax: Math.min(couches[couches.length - 1].z1, d.D + 4),
    couches: couches.map((c) => ({ z0: c.z0, z1: c.z1, sol: c.classe, etiquette: etiquetteCourte(c) })),
    zones: d.zf > 0 ? [{ z0: 0, z1: d.zf, couleur: COULEURS.rouge, libelle: "sans frottement" }] : [],
    profil: qs.length ? { libelle: `qs ${r.EC7.applicable ? "NF P94-262" : "F62"}`, unite: "kPa", valeurs: qs.map((l) => ({ z0: l.z0, z1: l.z1, v: l.qs })), etiquettes: true } : null,
  });
  return { figure, ...notePieu(r, d) };
}

function calculerFrottement(v) {
  const B = nombre(v.B), H = nombre(v.H), g = nombre(v.gamma), h2 = nombre(v.h2, Infinity), hr = Math.max(nombre(v.hr, 0), 0), gr = nombre(v.gr, 20);
  const d = nombre(v.d), files = Math.max(1, Math.round(nombre(v.files, 1)));
  if (!(B > 0 && H > 0 && g > 0)) throw new Error("renseigner B, l'épaisseur et γ' de la couche compressible");
  const Kt = K_TAN_DELTA[v.nature][v.mise], KtR = K_TAN_DELTA[v.natR][v.mise];
  const remblai = hr > 0 ? { h: hr, gamma: gr } : null;
  const couches = [{ z0: 0, z1: H, gamma: g, Kt }];
  const iso = frottementNegatif({ R: B / 2, remblai, couches, h2, KtRemblai: KtR });
  const b = d > B ? rayonInfluence(files > 1 ? { d, dPrime: d } : { d }) : null;
  const grp = b ? frottementNegatif({ R: B / 2, remblai, couches, h2, KtRemblai: KtR, b }) : null;
  const rep = grp ? repartitionGroupe({ FnIsole: iso.Fn, FnGroupe: grp.Fn, files }) : null;
  const lam = lambdaCombarieu(Kt), mu = muIsole(lam);
  const G = nombre(v.G, 0), Q = nombre(v.Q, 0), psi2 = nombre(v.psi2, 0.3);
  const Fdim = rep ? (files > 1 ? rep.angle : rep.extremite) : iso.Fn;
  const c = combinaisonsPieu({ G, Q, psi2, Fn: Fdim });
  const xmax = remblai ? Math.max(...iso.profil.map((p) => p.s1)) * 1.1 : g * H * 1.1;
  // Sans remblai, σ'v reste égal à σ'v0 : un seul profil, pas de hauteur d'action.
  const figure = !remblai ? graphe({
    largeur: 560, hauteur: 280, xmin: 0, xmax, ymin: 0, ymax: H, inverserY: true, xlabel: "contrainte verticale effective (kPa)", ylabel: "profondeur sous le TN (m)",
    zones: [{ x0: 0, x1: xmax, y0: 0, y1: H, couleur: "#dccab0", opacite: 0.35, libelle: "couche compressible, sans remblai", position: "droite" }],
    series: [{ points: [[0, 0], [g * H, H]], couleur: COULEURS.bleu, libelle: "σ'v = σ'v0 : pas de surcharge, pas de frottement négatif" }],
  }) : graphe({
    largeur: 560, hauteur: 320, xmin: 0, xmax, ymin: -hr, ymax: H, inverserY: true, xlabel: "contrainte verticale effective (kPa)", ylabel: "profondeur sous le TN (m)",
    zones: [...(hr > 0 ? [{ x0: 0, x1: xmax, y0: -hr, y1: 0, couleur: "#eadfd2", opacite: 0.6, libelle: "remblai", position: "droite" }] : []),
      { x0: 0, x1: xmax, y0: 0, y1: H, couleur: "#dccab0", opacite: 0.35, libelle: "couche compressible", position: "droite" }],
    series: [
      { points: iso.profil.map((p) => [p.s1, p.z]), couleur: COULEURS.discret, tirets: "5 4", libelle: "σ'1 champ libre" },
      { points: iso.profil.map((p) => [p.sv, p.z]), couleur: COULEURS.effort, epaisseur: 2.8, libelle: "σ'v au contact, pieu isolé" },
      ...(grp ? [{ points: grp.profil.map((p) => [p.sv, p.z]), couleur: COULEURS.violet, libelle: "σ'v au contact, pieu en groupe" }] : []),
      ...(iso.hAction > 0 && iso.hAction < H - 1e-6 ? [{ points: [[0, iso.hAction], [xmax, iso.hAction]], couleur: COULEURS.rouge, tirets: "2 3", epaisseur: 1.6, libelle: `hauteur d'action h = ${fd(iso.hAction, 2)} m` }] : []),
    ],
  });
  const synthese = `<table class="resultats"><thead><tr><th>Grandeur</th><th class="num">Valeur</th></tr></thead><tbody>
      <tr><td>K tanδ · λ · μ</td><td class="n">${fd(Kt, 2)} · ${fd(lam, 3)} · ${fd(mu, 4)}</td></tr>
      <tr><td>Hauteur d'action</td><td class="n">${fd(iso.hAction, 2)} m</td></tr>
      <tr><td><strong>F<sub>n</sub>, pieu isolé</strong></td><td class="n"><strong>${f(iso.Fn, 4)} kN</strong></td></tr>
      ${grp ? `<tr><td>F<sub>n</sub>, groupe illimité (b = ${fd(b, 2)} m)</td><td class="n">${f(grp.Fn, 4)} kN</td></tr>
      <tr><td>${files > 1 ? "Angle · bord · intérieur" : "Extrémité · courant"}</td><td class="n">${files > 1 ? `${f(rep.angle, 4)} · ${f(rep.bord, 4)} · ${f(rep.interieur, 4)}` : `${f(rep.extremite, 4)} · ${f(rep.courant, 4)}`} kN</td></tr>` : ""}
      <tr><td>F<sub>d</sub> ELU (pieu le plus chargé)</td><td class="n">${f(c.ELU, 5)} kN</td></tr>
    </tbody></table>`;
  const note = `
    <h3>1 · Données</h3>
    <p>Pieu ${esc(v.mise)} de diamètre ${fd(B, 2)} m ; couche compressible « ${esc(K_TAN_DELTA[v.nature].nom)} » de ${fd(H, 2)} m (γ' = ${f(g, 3)} kN/m³) ;
       ${hr > 0 ? `remblai de ${fd(hr, 2)} m (γ = ${f(gr, 3)} kN/m³, K tanδ = ${fd(KtR, 2)})` : "pas de remblai traversé"} ; ${Number.isFinite(h2) ? `h2 = ${fd(h2, 2)} m` : "h2 non limitant"}.</p>
    <h3>2 · Méthode de Combarieu</h3>
    <p class="formula">λ = ${Kt <= 0.15 ? "1/(0,5 + 25 K tanδ)" : Kt <= 0.385 ? "0,385 − K tanδ" : "0"} = ${fd(lam, 3)} · μ = λ²/(1 + λ) = ${fd(mu, 4)}${mu > 0 ? ` · L<sub>0</sub> = R/(μ K tanδ) = ${fd(B / 2 / (mu * Kt), 1)} m` : ""}</p>
    <p>σ'<sub>v</sub>(z) au contact du pieu est calculée de proche en proche ; la hauteur d'action vaut ${fd(iso.hAction, 2)} m
       ${iso.h1 !== null ? `(h1 = ${fd(iso.h1, 2)} m, où σ'v redescend à σ'v0)` : "(σ'v ne redescend pas à σ'v0 dans la couche)"}.</p>
    <p class="formula">F<sub>n</sub> = P ∫ K tanδ σ'<sub>v</sub> dz = ${f(iso.Fn, 4)} kN (sans accrochage : ${f(iso.FnMax, 4)} kN)</p>
    ${grp ? `<h3>3 · Pieu au sein du groupe</h3>
      <p>Rayon d'influence b = ${files > 1 ? "√(d d'/π)" : "d/√π"} = ${fd(b, 3)} m ; F<sub>n</sub>(b) = ${f(grp.Fn, 4)} kN (borne π b² q = ${f(Math.PI * b * b * (hr * gr), 4)} kN).
         Répartition empirique (F62 G.2 § 3.1 ; NF P94-262 H.3.1) : ${files > 1 ? `pieu d'angle ${f(rep.angle, 4)} kN, de bord ${f(rep.bord, 4)} kN, intérieur ${f(rep.interieur, 4)} kN` : `pieu d'extrémité ${f(rep.extremite, 4)} kN, courant ${f(rep.courant, 4)} kN`}.</p>` : ""}
    <h3>${grp ? 4 : 3} · Effort axial de calcul</h3>
    <p class="formula">F<sub>d</sub> = G'<sub>d</sub> + max(G<sub>sn,d</sub> ; Q'<sub>d</sub>) = ${f(1.35 * G + 1.5 * psi2 * Q, 5)} + max(${f(1.35 * Fdim, 4)} ; ${f(1.5 * (1 - psi2) * Q, 4)}) = ${f(c.ELU, 5)} kN (ELU)</p>
    <p>ELS caractéristique : ${f(c.ELS_car, 5)} kN · ELS quasi permanent : ${f(c.ELS_QP, 5)} kN. Le frottement positif est à retirer de la portance au-dessus du point neutre.</p>`;
  return { figure, synthese, note };
}

function calculerGroupe(v) {
  const B = nombre(v.B), d = nombre(v.d), m = Math.max(1, Math.round(nombre(v.m, 1))), n = Math.max(1, Math.round(nombre(v.n, 1)));
  const Rb = nombre(v.Rbd, 0), Rs = nombre(v.Rsd, 0), Qmax = nombre(v.Qmax, 0), F = nombre(v.F, 0);
  if (!(B > 0 && d >= B)) throw new Error("renseigner B et un entraxe d ≥ B");
  const N = m * n, cl = converseLabarre({ B, d, m, n }), coh = efficaciteCoherentF62({ B, d }), ec7 = efficaciteEC7({ B, d, m, n });
  const ceF = v.sol === "coherent" ? coh : v.sol === "frottant" ? cl : 1;
  const RF = ceF * N * Qmax, vE = verifGroupeEC7({ Fcgd: F, N, Rbd: Rb, Rsd: Rs, Ce: ec7 });
  const bloc = blocMonolithique({ B, d, m: Math.min(m, n), n: Math.max(m, n) });
  const figure = graphe({
    largeur: 560, hauteur: 300, xmin: 1, xmax: 5, ymin: 0, ymax: 1.05, xlabel: "d/B", ylabel: "Ce",
    series: [
      { points: echantillon((x) => converseLabarre({ B: 1, d: x, m, n }), 1, 5, 80), couleur: COULEURS.f62, libelle: "Converse-Labarre" },
      { points: echantillon((x) => efficaciteCoherentF62({ B: 1, d: x }), 1, 5, 80), couleur: COULEURS.f62, tirets: "6 3", libelle: "F62 sols cohérents" },
      { points: echantillon((x) => efficaciteEC7({ B: 1, d: x, m, n }), 1, 5, 80), couleur: COULEURS.ec7, epaisseur: 2.8, libelle: "NF P94-262" },
    ],
    marques: [{ x: d / B, y: ec7, couleur: COULEURS.ec7, guides: true }, { x: d / B, y: ceF, couleur: COULEURS.f62 }],
  });
  const synthese = `<table class="resultats"><thead><tr><th></th><th class="num">C<sub>e</sub></th><th class="num">Résistance</th><th class="num">Taux</th><th></th></tr></thead><tbody>
      <tr class="${F <= RF ? "" : "ko"}"><td><span class="tag-f62">F62</span></td><td class="n">${fd(ceF, 3)}</td><td class="n">${f(RF, 5)} kN</td><td class="n">${fd(F / RF, 2)}</td><td>${pastille(F <= RF + 1e-9)}</td></tr>
      <tr class="${vE.ok ? "" : "ko"}"><td><span class="tag-ec7">EC7</span></td><td class="n">${fd(ec7, 3)}</td><td class="n">${f(vE.R, 5)} kN</td><td class="n">${fd(vE.taux, 2)}</td><td>${pastille(vE.ok)}</td></tr>
    </tbody></table>`;
  const note = `
    <h3>1 · Données</h3><p>${m} × ${n} = ${N} pieux de diamètre ${fd(B, 2)} m, entraxe ${fd(d, 2)} m (d/B = ${fd(d / B, 2)}) ; charge totale de calcul ${f(F, 5)} kN.</p>
    <h3>2 · Fascicule 62 (annexe G.1)</h3>
    <p class="formula">Converse-Labarre : C<sub>e</sub> = 1 − [arctan(B/d)/(π/2)] (2 − 1/m − 1/n) = ${fd(cl, 3)}</p>
    <p class="formula">Sols cohérents : C<sub>e</sub> = ${d / B >= 3 ? "1 (d > 3B)" : `¼ (1 + d/B) = ${fd(coh, 3)}`}</p>
    <p>Retenu (${v.sol === "coherent" ? "sol cohérent" : v.sol === "frottant" ? "sol frottant, pieux sans refoulement" : "sable lâche, pieux refoulants"}) : C<sub>e</sub> = ${fd(ceF, 3)} ; Σ F<sub>d</sub> ≤ C<sub>e</sub> n Q<sub>max</sub> = ${f(RF, 5)} kN. À comparer au bloc de Terzaghi, dont on retient la plus faible estimation.</p>
    <h3>3 · NF P94-262 (annexe J)</h3>
    <p class="formula">C<sub>d</sub> = 1 − ¼ (1 + d/B) = ${fd(1 - 0.25 * (1 + Math.max(d / B, 1)), 3)} · C<sub>e</sub> = ${d / B >= 3 ? "1 (d ≥ 3B)" : `1 − C<sub>d</sub> [2 − (1/m + 1/n)] = ${fd(ec7, 3)}`}</p>
    <p class="formula">F<sub>cg;d</sub> ≤ N (R<sub>b;d</sub> + C<sub>e</sub> R<sub>s;d</sub>) = ${N} × (${f(Rb, 4)} + ${fd(ec7, 3)} × ${f(Rs, 4)}) = ${f(vE.R, 5)} kN</p>
    <h3>4 · Bloc monolithique</h3>
    <p>Dimensions ${fd(bloc.L, 2)} m × ${fd(bloc.l, 2)} m, périmètre ${fd(bloc.perimetre, 2)} m, base ${fd(bloc.aire, 2)} m² : à justifier comme une fondation dont la base est au niveau des pointes, avec le frottement sur son périmètre.</p>`;
  return { figure, synthese, note };
}

function calculerLateral(v) {
  const B = nombre(v.B), L = nombre(v.L), E = nombre(v.E), H = nombre(v.H, 0), M = nombre(v.M, 0);
  const h1 = Math.max(nombre(v.h1, 0), 0), longue = v.duree === "longue";
  const c1 = { EM: nombre(v.EM1), alpha: nombre(v.a1), pf: nombre(v.pf1) }, c2 = { EM: nombre(v.EM2), alpha: nombre(v.a2), pf: nombre(v.pf2) };
  if (!(B > 0 && L > 0 && E > 0 && c1.EM > 0 && c2.EM > 0 && c1.pf > 0 && c2.pf > 0)) throw new Error("renseigner la géométrie et les deux couches");
  const EI = E * 1000 * (Math.PI * B ** 4) / 64, facteur = longue ? 0.5 : 1;
  const reaction = (z) => {
    const c = z < h1 ? c1 : c2;
    let K = moduleKf({ EM: c.EM, B, alpha: c.alpha }).Kf * facteur, rmax = B * c.pf * 1000;
    if (v.min !== "non") { const m = minorationSurface({ z, B, sol: v.sol1, simplifiee: v.min === "simple" }); K *= m.pente; rmax *= m.palier; }
    return { K, rmax };
  };
  const r = pieuDifferencesFinies({ L, EI, H, M, tete: v.tete, reaction, n: 240 });
  const Kf1 = moduleKf({ EM: c1.EM, B, alpha: c1.alpha }).Kf * facteur, Kf2 = moduleKf({ EM: c2.EM, B, alpha: c2.alpha }).Kf * facteur;
  const an = pieuLongAnalytique({ EI, Kf: Kf1, H, M, tete: v.tete });
  const zVue = Math.min(L, Math.max(4 * an.l0, 6));
  const yMax = Math.max(...r.y.map((y) => Math.abs(y) * 1000)) * 1.15 || 1, mMax = Math.max(...r.M.map(Math.abs)) * 1.15 || 1;
  const g1 = graphe({ largeur: 300, hauteur: 320, xmin: -yMax * 0.3, xmax: yMax, ymin: 0, ymax: zVue, inverserY: true, legende: false, xlabel: "y (mm)", ylabel: "z (m)", series: [{ points: r.z.map((z, i) => [r.y[i] * 1000, z]), couleur: COULEURS.bleu }] });
  const g2 = graphe({ largeur: 300, hauteur: 320, xmin: -mMax, xmax: mMax, ymin: 0, ymax: zVue, inverserY: true, legende: false, xlabel: "M (kN·m)", ylabel: "z (m)", series: [{ points: r.z.map((z, i) => [r.M[i], z]), couleur: COULEURS.effort }] });
  const figure = `<div style="display:grid;grid-template-columns:1fr 1fr;width:100%">${g1}${g2}</div>`;
  const synthese = `<table class="resultats"><thead><tr><th>Grandeur</th><th class="num">Valeur</th></tr></thead><tbody>
      <tr><td>Déplacement en tête y<sub>0</sub></td><td class="n"><strong>${fd(r.y0 * 1000, 2)} mm</strong></td></tr>
      <tr><td>Moment maximal</td><td class="n"><strong>${f(Math.abs(r.MMax), 4)} kN·m</strong> à ${fd(r.zMMax, 2)} m</td></tr>
      <tr><td>Nœuds au palier</td><td class="n">${r.plastifies}</td></tr>
      <tr><td>l<sub>0</sub> (couche 1)</td><td class="n">${fd(an.l0, 2)} m ${pieuSouple({ L, l0: an.l0 }) ? "· pieu souple" : "· pieu court"}</td></tr>
    </tbody></table>`;
  const note = `
    <h3>1 · Données</h3><p>Pieu B = ${fd(B, 2)} m, L = ${fd(L, 2)} m, E = ${f(E, 5)} MPa (EI = ${f(EI, 5)} kN·m²) ; H = ${f(H, 4)} kN, M = ${f(M, 4)} kN·m, tête ${v.tete === "libre" ? "libre" : "encastrée"} ; sollicitation de ${longue ? "longue" : "courte"} durée.</p>
    <h3>2 · Lois de réaction (F62 annexe C.5 ; NF P94-262 annexe I)</h3>
    <p class="formula">Couche 1 (0 – ${fd(h1, 2)} m) : K<sub>f</sub> = ${f(Kf1, 4)} kPa · palier B p<sub>f</sub>* = ${f(B * c1.pf * 1000, 4)} kN/m</p>
    <p class="formula">Couche 2 : K<sub>f</sub> = ${f(Kf2, 4)} kPa · palier ${f(B * c2.pf * 1000, 4)} kN/m</p>
    <p>${v.min === "non" ? "Sans minoration près de la surface." : `Minoration sur z<sub>c</sub> = ${v.sol1 === "coherent" ? "2" : "4"} B = ${fd((v.sol1 === "coherent" ? 2 : 4) * B, 2)} m ${v.min === "simple" ? "(0,5 sur la pente, 0,7 sur le palier)" : "(coefficient 0,5 (1 + z/z<sub>c</sub>))"}.`}</p>
    <h3>3 · Résultats</h3>
    <p class="formula">y<sub>0</sub> = ${fd(r.y0 * 1000, 2)} mm · M<sub>max</sub> = ${f(Math.abs(r.MMax), 4)} kN·m à ${fd(r.zMMax, 2)} m · ${r.plastifies} nœud(s) au palier</p>
    <p>Contrôle par la solution du pieu long en sol homogène (couche 1, sans palier) : y<sub>0</sub> = ${fd(an.y0 * 1000, 2)} mm, M<sub>max</sub> = ${f(an.MMax, 4)} kN·m, l<sub>0</sub> = ${fd(an.l0, 2)} m.</p>`;
  return { figure, synthese, note };
}

rendre();
