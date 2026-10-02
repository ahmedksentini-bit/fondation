// Bureau de calcul : huit modules dans une coque de logiciel. Les calculs sont
// faits par src/bureau/*.js et les solveurs de src/gtr ; ce fichier ne gère
// que la saisie, la sauvegarde, le projet et l'impression de la note.

import { esc, f, nombre } from "./bureau/commun.js";
import { calculerClassement, calculerRoche } from "./bureau/materiaux.js";
import { calculerCompactage, calculerTraitement, calculerMouvement, OPTIONS_TABLEAUX, OPTIONS_COMPACTEURS, OPTIONS_ETATS } from "./bureau/chantier.js";
import { calculerPlateforme, calculerControle, calculerTalus, OPTIONS_SEUILS } from "./bureau/plateforme.js";
import { FAMILLES_ROCHES } from "./gtr/classification.js";
import { SOLS, ROCHES, ipiDe } from "./bancs/materiaux.js";

const app = document.getElementById("app");
const CLE = "georoute-bureau-v1";

// ─────────────────────────── Valeurs de départ ───────────────────────────
const sol = SOLS.graveArgileuse, marne = ROCHES.marne;
const OPT_METEO = [["++", "++ pluie forte"], ["+", "+ pluie faible"], ["=", "= ni pluie ni évaporation"], ["-", "− évaporation importante"]];
const OPT_ETAT = [["th", "th — très humide"], ["h", "h — humide"], ["m", "m — moyen"], ["s", "s — sec"], ["ts", "ts — très sec"], ["ins", "ins — insensible à l'eau"]];
const OPT_PST = ["F1", "F2", "F3", "F4", "I1", "I2", "S1", "S2", "S3", "S4", "G1", "G2", "G3", "G4", "VC1G3", "VC2F1", "CH1", "CH2", "CH3", "CH4", "R3 Li", "R4 Cl", "R5 Cl"].map((x) => [x, x]);
const PROFILS = "0 0 0\n50 32 0\n100 58 0\n150 46 4\n200 18 16\n250 0 42\n300 0 56\n350 0 30\n400 6 8\n450 14 0\n500 0 0";

// ─────────────────────────── Définition des modules ───────────────────────
// Un champ : [id, libellé, unité | "texte" | "choix", valeur de départ, options].
const MODULES = [
  {
    id: "classement", groupe: "Matériaux", icone: "◆", titre: "Classement d'un sol", sous: "GTR 2024 et 1992, conditions d'emploi",
    description: "Classement d'un sol à partir de sa courbe granulométrique et de ses essais, aux deux éditions du GTR, puis ses conditions d'utilisation en remblai et en couche de forme pour la météo du jour, son cas de PST et sa sensibilité au gel.",
    champs: [
      ["Granularité et argilosité", [
        ["granulo", "Courbe granulométrique : ouverture (mm), passant (%) du matériau total", "texte", sol.granulo.map(([d, p]) => `${d} ${p}`).join("\n")],
        ["VBS", "Valeur de bleu VBS", "g/100 g", String(sol.VBS)], ["wL", "Limite de liquidité wL", "%", String(sol.wL)], ["wP", "Limite de plasticité wP", "%", String(sol.wP)],
        ["ES", "Équivalent de sable (si pas de VBS)", "", String(sol.ES)], ["MO", "Matières organiques", "%", String(sol.MO)],
        ["forme", "Gros éléments (sols VC)", "choix", "anguleux", [["anguleux", "anguleux"], ["roulés", "roulés"]]],
      ]],
      ["État hydrique et comportement", [
        ["wn", "Teneur en eau naturelle wn", "%", String(sol.wn)], ["wOPN", "Teneur en eau de l'optimum wOPN", "%", String(sol.wOPN)],
        ["IPI", "IPI à wn", "", String(Math.round(ipiDe(sol)(sol.wn) * 10) / 10)], ["CBRi", "CBR après immersion", "", String(sol.CBRi)],
        ["LA", "Los Angeles LA", "", String(sol.LA)], ["MDE", "Micro-Deval MDE", "", String(sol.MDE)], ["FS", "Friabilité des sables FS", "", ""],
      ]],
      ["Emploi", [["meteo", "Situation météorologique", "choix", "=", OPT_METEO], ["H", "Hauteur du remblai", "m", "8"]]],
    ],
    calculer: calculerClassement,
  },
  {
    id: "roche", groupe: "Matériaux", icone: "▲", titre: "Matériau rocheux", sous: "classe, conditions d'emploi, PST",
    description: "Classement d'un matériau rocheux par sa famille et ses essais (LA, MDE, IFR, IDGa, ρd, teneur en eau, éléments solubles), puis ses conditions d'utilisation en remblai et en couche de forme, son cas de PST et sa sensibilité au gel.",
    champs: [
      ["Nature et essais", [
        ["famille", "Famille", "choix", "Cl", Object.entries(FAMILLES_ROCHES).map(([k, n]) => [k, `${k} — ${n}`])],
        ["rhoD", "Masse volumique sèche ρd", "Mg/m³", ""], ["wn", "Teneur en eau naturelle wn", "%", String(marne.w)], ["wOPN", "wOPN après fragmentation", "%", String(marne.wOPN)],
        ["LA", "Los Angeles LA", "", ""], ["MDE", "Micro-Deval MDE", "", ""], ["IFR", "Fragmentabilité IFR", "", String(marne.IFR)], ["IDGa", "Dégradabilité IDGa", "", String(marne.IDGa)],
        ["IPI", "IPI", "", ""], ["gypse", "Teneur en gypse", "%", ""], ["sel", "Teneur en sel gemme", "%", ""],
      ]],
      ["Emploi", [["meteo", "Situation météorologique", "choix", "=", OPT_METEO]]],
    ],
    calculer: calculerRoche,
  },
  {
    id: "compactage", groupe: "Mise en œuvre", icone: "≋", titre: "Compactage", sous: "méthode Q/S, atelier, cadence",
    description: "Prescription du compactage par les tableaux de l'annexe 4 : Q/S, vitesse et nombre d'applications de chaque compacteur pour l'épaisseur du chantier, débit pratique de l'atelier (ou d'un compacteur mixte) face à la cadence de mise en œuvre, surfaces à balayer pour le contrôle du Q/S.",
    champs: [
      ["Matériau et énergie", [["table", "Tableau de compactage", "choix", OPTIONS_TABLEAUX[0][0], OPTIONS_TABLEAUX],
        ["code", "Énergie (code C du tableau d'utilisation)", "choix", "2", [["1", "1 — intense"], ["2", "2 — moyenne"], ["3", "3 — faible"]]]]],
      ["Compacteurs", [
        ["c1", "Compacteur 1", "choix", "V3", OPTIONS_COMPACTEURS], ["L1", "Largeur compactée 1", "m", "2.1"], ["Nn1", "Disposition 1", "choix", "1", [["1", "monocylindre ou pneus"], ["2", "tandem (N/n = 2)"]]],
        ["c2", "Compacteur 2", "choix", "P2", OPTIONS_COMPACTEURS], ["L2", "Largeur compactée 2", "m", "2"], ["Nn2", "Disposition 2", "choix", "1", [["1", "monocylindre ou pneus"], ["2", "tandem (N/n = 2)"]]],
        ["mode", "Organisation", "choix", "atelier", [["atelier", "atelier : compacteurs séparés"], ["mixte", "compacteur mixte (les deux trains d'un même engin)"]]],
      ]],
      ["Chantier", [["e", "Épaisseur compactée", "m", "0.30"], ["k", "Rendement k", "", "0.6"], ["Q", "Volume à compacter par jour", "m³", "2400"], ["heures", "Heures de compactage par jour", "h", "8"]]],
    ],
    calculer: calculerCompactage,
  },
  {
    id: "traitement", groupe: "Mise en œuvre", icone: "✱", titre: "Traitement à la chaux", sous: "état hydrique, dosage, quantités",
    description: "Traitement d'un sol humide à la chaux vive : état hydrique avant et après, dosage qui ramène le sol à l'état moyen, aptitude au traitement, quantités à épandre et contrôle à la bâche.",
    champs: [
      ["Sol", [["cle", "Sous-classe (seuils d'état)", "choix", "F2", OPTIONS_ETATS], ["w", "Teneur en eau", "%", "22"], ["wOPN", "wOPN", "%", "17"], ["IPI", "IPI avant traitement", "", "4"]]],
      ["Traitement", [["dosage", "Dosage en chaux vive", "%", "2"], ["eta", "Part de la chaleur qui évapore de l'eau η", "", "0.5"], ["Gv", "Aptitude : gonflement volumique Gv", "%", "3"], ["Rtb", "Aptitude : Rtb après immersion", "MPa", "0.25"]]],
      ["Chantier", [["rhoD", "ρd en place", "Mg/m³", "1.70"], ["e", "Épaisseur traitée", "m", "0.35"], ["S", "Surface à traiter", "m²", "12000"], ["bache", "Pesée sur la bâche", "kg/m²", ""]]],
    ],
    calculer: calculerTraitement,
  },
  {
    id: "plateforme", groupe: "Plateforme", icone: "▭", titre: "PST et couche de forme", sous: "arase, épaisseur, plateforme",
    description: "Du mètre supérieur des terrassements à la plateforme : cas de PST et classe d'arase à long terme, épaisseur de couche de forme pour la plateforme visée (tableaux du GTR 2000 et modèle bicouche), plus gros éléments, portance mesurée de l'arase.",
    champs: [
      ["Partie supérieure des terrassements", [
        ["sousClasse", "Matériau de la PST", "choix", "F2", OPT_PST], ["etat", "État hydrique", "choix", "m", OPT_ETAT],
        ["nappe", "Nappe", "choix", "non", [["non", "pas de remontée dans la PST"], ["risque", "remontée possible, sans rabattement"]]],
        ["drainage", "Drainage à la base de la chaussée et imperméabilisation de l'arase", "choix", "non", [["non", "non"], ["oui", "oui"]]],
        ["traitement", "Traitement de la PST", "choix", "non", [["non", "aucun"], ["amelioration", "amélioration (court terme)"], ["stabilisation", "stabilisation"]]],
        ["eTraitee", "Épaisseur traitée", "m", "0.35"], ["EV2arase", "EV2 mesuré sur l'arase (facultatif)", "MPa", ""],
      ]],
      ["Couche de forme", [
        ["ar", "Classe d'arase retenue", "choix", "auto", [["auto", "la plus prudente du cas de PST"], ["AR1", "AR1"], ["AR2", "AR2"], ["AR3", "AR3"]]],
        ["type", "Matériau", "choix", "grenuTraite", [["nonTraite", "granulaire non traité"], ["finChaux", "sol fin traité à la chaux seule"], ["finChauxCiment", "sol fin traité chaux + ciment"], ["grenuTraite", "grenu traité aux liants hydrauliques"]]],
        ["classeMeca", "Classe mécanique (traité aux liants)", "choix", "4", [["3", "3"], ["4", "4"], ["5", "5"]]],
        ["pf", "Plateforme visée", "choix", "PF3", [["PF2", "PF2"], ["PF3", "PF3"], ["PF4", "PF4"]]],
        ["E1", "Module de la couche (modèle bicouche)", "MPa", "5000"], ["eCouche", "Épaisseur d'une couche élémentaire", "m", "0.35"], ["Lmax", "Plus grande dimension du matériau", "mm", "60"],
      ]],
    ],
    calculer: calculerPlateforme,
  },
  {
    id: "controle", groupe: "Plateforme", icone: "◉", titre: "Réception d'une plateforme", sous: "plaque, dynaplaque, densités",
    description: "Réception d'une arase ou d'une plateforme : modules EV1, EV2 et k à la plaque, Evd à la dynaplaque, densités moyennes et en fond de couche, face aux seuils du GTR.",
    champs: [
      ["Objectifs", [["seuil", "Seuil de portance", "choix", "plateforme", OPTIONS_SEUILS], ["objectif", "Objectif de densification", "choix", "q3", [["q4", "q4 — remblai"], ["q3", "q3 — couche de forme"]]], ["rhoDOPN", "ρdOPN du matériau", "Mg/m³", "2.10"]]],
      ["Mesures", [
        ["plaques", "Plaque : point, z1 (mm), z2 (mm)", "texte", "1 1.45 0.95\n2 1.62 1.10\n3 1.38 0.88\n4 2.30 1.95\n5 1.50 1.02"],
        ["dyna", "Dynaplaque : point, enfoncements des chutes de mesure (mm)", "texte", "6 0.36 0.35 0.37\n7 0.41 0.40 0.42\n8 0.47 0.46 0.48"],
        ["densites", "Densité : point, ρd moyen, ρd en fond de couche (Mg/m³)", "texte", "1 2.08 2.03\n3 2.07 2.01\n5 2.09 2.04"],
      ]],
    ],
    calculer: calculerControle,
  },
  {
    id: "mouvement", groupe: "Terrassements", icone: "⇄", titre: "Mouvement des terres", sous: "épure de Lalanne, transports",
    description: "Volumes entre profils, épure de Lalanne et ligne de répartition : boucles de transport, distances moyennes, dépôts et emprunts, puis rendement de l'atelier pelle + tombereaux et durée des transports.",
    champs: [
      ["Profils et répartition", [["profils", "Profils : abscisse (m), déblai (m²), remblai (m²)", "texte", PROFILS], ["reemploi", "Part réutilisable du déblai", "", "0.85"],
        ["Ct", "Coefficient de compactage Ct", "", "0.95"], ["c", "Ligne de répartition", "m³", "0"]]],
      ["Engins", [["q", "Godet de la pelle", "m³", "2.5"], ["tc", "Cycle de la pelle", "s", "20"], ["Cf", "Foisonnement Cf", "", "1.25"], ["capacite", "Benne d'un tombereau", "m³", "18"],
        ["vCharge", "Vitesse en charge", "km/h", "20"], ["vVide", "Vitesse à vide", "km/h", "35"], ["tFixe", "Temps fixes par cycle", "s", "120"], ["n", "Tombereaux engagés (vide : saturation)", "", ""], ["heures", "Heures de travail par jour", "h", "8"]]],
    ],
    calculer: calculerMouvement,
  },
  {
    id: "talus", groupe: "Terrassements", icone: "◢", titre: "Stabilité d'un talus", sous: "Bishop, talus infini",
    description: "Coefficient de sécurité d'un talus homogène : cercle critique par la méthode de Bishop simplifiée, et talus infini à sec ou avec un écoulement parallèle à la pente.",
    champs: [["Géométrie et sol", [["H", "Hauteur du talus", "m", "8"], ["fruit", "Fruit (base pour 1 de hauteur)", "", "1.5"], ["c", "Cohésion effective c'", "kPa", "8"], ["phi", "Angle de frottement φ'", "°", "25"],
      ["gamma", "Poids volumique γ", "kN/m³", "20"], ["ru", "Rapport de pression interstitielle ru", "", "0"], ["Fvise", "Coefficient de sécurité visé", "", "1.5"]]]],
    calculer: calculerTalus,
  },
];

// ─────────────────────────── État et sauvegarde ───────────────────────────
function valeursParDefaut(m) {
  const v = {};
  for (const [, champs] of m.champs) for (const [id, , , def] of champs) v[id] = def;
  return v;
}
function lireEtat() {
  try { const e = JSON.parse(localStorage.getItem(CLE) || "null"); if (e && e.valeurs) return e; } catch { /* stockage indisponible */ }
  return { module: "projet", valeurs: {} };
}
function ecrireEtat() { try { localStorage.setItem(CLE, JSON.stringify(etat)); } catch { /* navigation privée */ } }

const aujourdhui = () => new Date().toISOString().slice(0, 10);
const PROJET_DEFAUT = () => ({
  affaire: "Étude de terrassements", ouvrage: "", lieu: "", auteur: "", verificateur: "", indice: "A", date: aujourdhui(),
  revisions: [{ indice: "A", date: aujourdhui(), objet: "Première émission" }],
});

const etat = lireEtat();
for (const m of MODULES) etat.valeurs[m.id] = { ...valeursParDefaut(m), ...(etat.valeurs[m.id] ?? {}) };
etat.projet = { ...PROJET_DEFAUT(), ...(etat.projet ?? {}) };

function toast(texte) {
  const t = document.getElementById("toast");
  t.textContent = texte; t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2400);
}

// ─────────────────────────── Rendu de la coque ────────────────────────────
function coque(actif, contenu) {
  const groupes = [...new Set(MODULES.map((x) => x.groupe))];
  const bouton = (id, icone, titre, sous) => `<button class="software-module${id === actif ? " active" : ""}" data-module="${id}"><span class="module-icon">${icone}</span>
    <span><strong>${esc(titre)}</strong><small>${esc(sous)}</small></span></button>`;
  return `
  <div class="software-shell bureau">
    <aside class="software-sidebar">
      <div class="software-title"><span class="module-icon">⌗</span><div><p>BUREAU DE CALCUL</p><h1>Terrassements</h1></div></div>
      <nav><div class="software-group"><p>Projet</p>${bouton("projet", "▤", "Projet et tableau de bord", etat.projet.affaire || "cartouche, indices, état des modules")}</div>
        ${groupes.map((g) => `<div class="software-group"><p>${esc(g)}</p>${MODULES.filter((x) => x.groupe === g).map((x) => bouton(x.id, x.icone, x.titre, x.sous)).join("")}</div>`).join("")}</nav>
      <button class="software-study" id="imprimer">${actif === "projet" ? "Imprimer le tableau de bord" : "Imprimer la note de calcul"}</button>
    </aside>
    <section class="software-main">${contenu}</section>
  </div>`;
}

const etapesDe = (m) => [...m.champs.map(([titre], i) => ({ titre, cible: `g${i}` })), { titre: "Résultats", cible: "resultats" }, { titre: "Note de calcul", cible: "note" }];

function rendre() {
  if (etat.module === "projet") return rendreProjet();
  const m = MODULES.find((x) => x.id === etat.module) ?? MODULES[0];
  const v = etat.valeurs[m.id];
  const etapes = etapesDe(m);
  app.innerHTML = coque(m.id, `
      <div class="software-head"><div><p class="eyebrow">GTR 2024 · ${esc(etat.projet.affaire)}</p><h2>${esc(m.titre)}</h2><p>${esc(m.description)}</p></div>
        <div class="bureau-actions">
          <button class="ghost" id="exporter">Exporter</button><button class="ghost" id="importer">Importer</button>
          <button class="ghost" id="reinit">Valeurs de départ</button></div></div>
      <nav class="etapes" aria-label="Étapes du calcul">${etapes.map((e, i) => `<button type="button" data-cible="${e.cible}"><span class="num">${i + 1}</span>${esc(e.titre)}<span class="etat" data-etat="${e.cible}"></span></button>`).join("")}</nav>
      <div class="bureau-grid">
        <div class="software-panel bureau-saisie">
          ${m.champs.map(([titre, champs], i) => `<div class="bureau-groupe" id="g${i}"><h3><span class="num">${i + 1}</span>${esc(titre)}</h3><div class="data-grid">
            ${champs.map((c) => champ(c, v)).join("")}</div></div>`).join("")}
        </div>
        <div class="software-panel bureau-resultats" id="resultats">
          <div class="software-diagram" id="figure"></div>
          <div id="synthese"></div>
        </div>
      </div>
      <section class="software-panel note-calcul" id="note"></section>`);
  brancher(m);
  calculer(m);
}

// ─────────────────────────── Projet et tableau de bord ────────────────────
function cartouche(titre) {
  const p = etat.projet;
  return `<table class="cartouche"><tbody>
    <tr><th>Affaire</th><td colspan="3">${esc(p.affaire || "—")}</td><th>Indice</th><td>${esc(p.indice || "—")}</td></tr>
    <tr><th>Ouvrage</th><td colspan="3">${esc(p.ouvrage || "—")}${p.lieu ? ` · ${esc(p.lieu)}` : ""}</td><th>Date</th><td>${esc(dateFr(p.date))}</td></tr>
    <tr><th>Élément</th><td>${esc(titre)}</td><th>Établi par</th><td>${esc(p.auteur || "—")}</td><th>Vérifié par</th><td>${esc(p.verificateur || "—")}</td></tr>
  </tbody></table>`;
}
const dateFr = (iso) => { const d = new Date(`${iso}T12:00:00`); return Number.isNaN(d.getTime()) ? String(iso ?? "") : d.toLocaleDateString("fr-FR"); };
const historique = () => `<h3>Historique des indices</h3><table class="resultats"><thead><tr><th>Indice</th><th>Date</th><th>Objet</th></tr></thead><tbody>
  ${etat.projet.revisions.map((r) => `<tr><td>${esc(r.indice)}</td><td>${esc(dateFr(r.date))}</td><td class="motif">${esc(r.objet)}</td></tr>`).join("")}</tbody></table>`;

/** État de chaque module, calculé sur ses données du moment. */
function tableauDeBord() {
  return MODULES.map((m, i) => {
    let r = null, motif = "";
    try { r = m.calculer(etat.valeurs[m.id]); } catch (e) { motif = e.message; }
    const etat_ = r === null ? `<span class="verdict ko">✕ calcul impossible</span> <small>${esc(motif)}</small>`
      : r.verdict === true ? `<span class="verdict ok">✓ vérifié</span>` : r.verdict === false ? `<span class="verdict ko">✕ non vérifié</span>`
        : `<span class="verdict na">${esc(r.etat ?? "calcul sans vérification")}</span>`;
    return `<tr><td>${i + 1}</td><td><strong>${esc(m.titre)}</strong><small>${esc(m.groupe)}</small></td><td>${etat_}</td><td>${esc(r?.resume ?? "—")}</td>
      <td><button class="ghost" data-module="${m.id}">Ouvrir</button></td></tr>`;
  }).join("");
}

function rendreProjet() {
  const p = etat.projet;
  const champP = (id, label, type = "text") => `<div class="field"><label for="pj_${id}">${esc(label)}</label><div class="input-wrap">
    <input id="pj_${id}" data-projet="${id}" type="${type}" value="${esc(p[id] ?? "")}"></div></div>`;
  app.innerHTML = coque("projet", `
      <div class="software-head"><div><p class="eyebrow">Projet</p><h2>${esc(p.affaire || "Projet")}</h2>
        <p>Le cartouche figure en tête de chaque note de calcul. Le tableau de bord recalcule chaque module sur ses données et en donne l'état ;
           le projet entier, cartouche compris, s'enregistre dans un seul fichier.</p></div>
        <div class="bureau-actions">
          <button class="ghost" id="projEnregistrer">Enregistrer le projet</button><button class="ghost" id="projOuvrir">Ouvrir un projet</button>
          <button class="ghost" id="projNouveau">Nouveau projet</button></div></div>
      <div class="bureau-grid">
        <div class="software-panel bureau-saisie">
          <div class="bureau-groupe"><h3><span class="num">1</span>Cartouche</h3><div class="data-grid">
            ${champP("affaire", "Affaire")}${champP("ouvrage", "Ouvrage, élément")}${champP("lieu", "Lieu")}${champP("indice", "Indice")}
            ${champP("auteur", "Établi par")}${champP("verificateur", "Vérifié par")}${champP("date", "Date", "date")}</div></div>
          <div class="bureau-groupe"><h3><span class="num">2</span>Indices de révision</h3>
            <div class="table-large"><table class="couches-table"><thead><tr><th>Indice</th><th>Date</th><th>Objet</th><th></th></tr></thead><tbody>
              ${p.revisions.map((r, i) => `<tr><td><input data-rev="${i}" data-col="indice" value="${esc(r.indice)}" style="width:4em" aria-label="Indice ${i + 1}"></td>
                <td><input data-rev="${i}" data-col="date" type="date" value="${esc(r.date)}" aria-label="Date de l'indice ${i + 1}"></td>
                <td><input data-rev="${i}" data-col="objet" value="${esc(r.objet)}" style="width:16em" aria-label="Objet de l'indice ${i + 1}"></td>
                <td><button data-suppr-rev="${i}" title="Supprimer l'indice" aria-label="Supprimer l'indice ${i + 1}">✕</button></td></tr>`).join("")}
            </tbody></table></div>
            <div class="actions"><button class="ghost" id="ajouterRev">Nouvel indice</button></div></div>
        </div>
        <div class="software-panel bureau-resultats">
          <h3>Tableau de bord</h3>
          <div class="table-large"><table class="resultats tableau-bord"><thead><tr><th>n°</th><th>Module</th><th>État</th><th>Résultat</th><th></th></tr></thead>
            <tbody>${tableauDeBord()}</tbody></table></div>
          <p class="method-note">« Valeurs de départ » d'un module rétablit l'exemple du cours. Les seuils, les tableaux et les classes sont ceux du GTR 2024 (fascicules 1 et 2), sauf mention contraire.</p>
          ${cartouche("dossier de calcul")}
        </div>
      </div>`);
  app.querySelectorAll("[data-module]").forEach((b) => b.addEventListener("click", () => { etat.module = b.dataset.module; ecrireEtat(); rendre(); }));
  app.querySelectorAll("[data-projet]").forEach((e) => e.addEventListener("input", () => { p[e.dataset.projet] = e.value; ecrireEtat(); }));
  app.querySelectorAll("[data-projet]").forEach((e) => e.addEventListener("change", () => rendreProjet()));
  app.querySelectorAll("[data-rev]").forEach((e) => e.addEventListener("input", () => { p.revisions[Number(e.dataset.rev)][e.dataset.col] = e.value; ecrireEtat(); }));
  app.querySelectorAll("[data-suppr-rev]").forEach((b) => b.addEventListener("click", () => {
    if (p.revisions.length <= 1) return toast("Il faut au moins un indice.");
    p.revisions.splice(Number(b.dataset.supprRev), 1); ecrireEtat(); rendreProjet();
  }));
  app.querySelector("#ajouterRev").addEventListener("click", () => {
    const der = p.revisions[p.revisions.length - 1];
    const suivant = /^[A-Y]$/.test(der.indice) ? String.fromCharCode(der.indice.charCodeAt(0) + 1) : `${der.indice}+`;
    p.revisions.push({ indice: suivant, date: aujourdhui(), objet: "" });
    p.indice = suivant; ecrireEtat(); rendreProjet();
  });
  app.querySelector("#imprimer").addEventListener("click", () => window.print());
  app.querySelector("#projEnregistrer").addEventListener("click", enregistrerProjet);
  app.querySelector("#projOuvrir").addEventListener("click", () => document.getElementById("fichierImport").click());
  app.querySelector("#projNouveau").addEventListener("click", () => {
    if (!confirm("Commencer un nouveau projet ? Les données de tous les modules reviennent aux valeurs de départ.")) return;
    for (const m of MODULES) etat.valeurs[m.id] = valeursParDefaut(m);
    etat.projet = PROJET_DEFAUT(); ecrireEtat(); rendreProjet(); toast("Nouveau projet.");
  });
}

const nomFichier = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
function telecharger(contenu, nom) {
  const blob = new Blob([JSON.stringify(contenu, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = nom; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function enregistrerProjet() {
  telecharger({ format: "georoute-projet", version: 1, date: new Date().toISOString(), projet: etat.projet, module: etat.module, valeurs: etat.valeurs },
    `terrassements-${nomFichier(etat.projet.affaire || "projet") || "projet"}.json`);
}

function champ([id, label, unite, , options], v) {
  if (unite === "texte") {
    return `<div class="field champ-large"><label for="c_${id}">${esc(label)}</label>
      <textarea id="c_${id}" data-champ="${id}" rows="${Math.min(12, Math.max(4, String(v[id] ?? "").split("\n").length + 1))}" spellcheck="false">${esc(v[id])}</textarea></div>`;
  }
  if (unite === "choix") {
    return `<div class="field"><label for="c_${id}">${esc(label)}</label><div class="input-wrap"><select id="c_${id}" data-champ="${id}">
      ${options.map(([val, t]) => `<option value="${esc(val)}"${String(v[id]) === String(val) ? " selected" : ""}>${esc(t)}</option>`).join("")}</select></div></div>`;
  }
  return `<div class="field"><label for="c_${id}">${esc(label)}</label><div class="input-wrap">
    <input id="c_${id}" data-champ="${id}" type="text" inputmode="decimal" value="${esc(v[id])}">${unite ? `<span class="unit">${esc(unite)}</span>` : ""}</div></div>`;
}

let minuteur = null;
function brancher(m) {
  const v = etat.valeurs[m.id];
  app.querySelectorAll("[data-module]").forEach((b) => b.addEventListener("click", () => { etat.module = b.dataset.module; ecrireEtat(); rendre(); }));
  const maj = () => { clearTimeout(minuteur); minuteur = setTimeout(() => { ecrireEtat(); calculer(m); }, 150); };
  app.querySelectorAll("[data-champ]").forEach((e) => {
    e.addEventListener(e.tagName === "SELECT" ? "change" : "input", () => { v[e.dataset.champ] = e.value; maj(); });
  });
  app.querySelector("#imprimer").addEventListener("click", () => window.print());
  app.querySelector("#reinit").addEventListener("click", () => { etat.valeurs[m.id] = valeursParDefaut(m); ecrireEtat(); rendre(); toast("Valeurs de départ rétablies."); });
  app.querySelector("#exporter").addEventListener("click", () => telecharger({ module: m.id, valeurs: etat.valeurs[m.id], date: new Date().toISOString() }, `terrassements-${m.id}.json`));
  app.querySelector("#importer").addEventListener("click", () => document.getElementById("fichierImport").click());
  app.querySelectorAll(".etapes [data-cible]").forEach((b) => b.addEventListener("click", () => {
    document.getElementById(b.dataset.cible)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }));
}

document.getElementById("fichierImport").addEventListener("change", async (e) => {
  const fichier = e.target.files[0];
  e.target.value = "";
  if (!fichier) return;
  try {
    const d = JSON.parse(await fichier.text());
    if (d.format === "georoute-projet") {
      for (const m of MODULES) etat.valeurs[m.id] = { ...valeursParDefaut(m), ...(d.valeurs?.[m.id] ?? {}) };
      etat.projet = { ...PROJET_DEFAUT(), ...(d.projet ?? {}) };
      etat.module = "projet";
      ecrireEtat(); rendre(); toast(`Projet « ${etat.projet.affaire} » ouvert.`);
      return;
    }
    const m = MODULES.find((x) => x.id === d.module);
    if (!m || typeof d.valeurs !== "object") throw new Error("fichier sans module reconnu");
    etat.module = m.id;
    etat.valeurs[m.id] = { ...valeursParDefaut(m), ...d.valeurs };
    ecrireEtat(); rendre(); toast(`Module « ${m.titre} » importé.`);
  } catch (err) { toast(`Import impossible : ${err.message}`); }
});

function calculer(m) {
  const v = etat.valeurs[m.id];
  const zones = { figure: app.querySelector("#figure"), synthese: app.querySelector("#synthese"), note: app.querySelector("#note") };
  const marquer = (cible, classe, texte) => {
    const e = app.querySelector(`.etapes [data-etat="${cible}"]`);
    if (e) { e.className = `etat ${classe}`; e.textContent = texte; }
  };
  try {
    const r = m.calculer(v);
    zones.figure.innerHTML = r.figure ?? "";
    zones.synthese.innerHTML = r.synthese;
    zones.note.innerHTML = `${cartouche(m.titre)}<h2>Note de calcul — ${esc(m.titre)}</h2>
      <p class="method-note">Établie le ${new Date().toLocaleDateString("fr-FR")} avec le bureau de calcul du cours « Terrassements routiers — GTR 2024 ». Les valeurs sont celles de la saisie.</p>
      ${r.note}${historique()}`;
    for (const e of etapesDe(m)) marquer(e.cible, "ok", "✓");
    if (r.verdict === false) marquer("resultats", "ko", "✕");
    else if (r.verdict !== true) marquer("resultats", "na", "·");
  } catch (e) {
    console.error(e);
    zones.figure.innerHTML = "";
    zones.synthese.innerHTML = `<p class="final-result bureau-verdict ko">Calcul impossible : ${esc(e.message)}</p>`;
    zones.note.innerHTML = "";
    for (const x of etapesDe(m)) marquer(x.cible, "na", "");
    marquer("resultats", "ko", "!");
    marquer("note", "na", "—");
  }
}

// Ouverture directe d'un module par l'adresse : bureau.html#compactage.
const demande = location.hash.replace("#", "");
if (demande && (demande === "projet" || MODULES.some((m) => m.id === demande))) etat.module = demande;
rendre();
window.addEventListener("hashchange", () => {
  const h = location.hash.replace("#", "");
  if (h && (h === "projet" || MODULES.some((m) => m.id === h))) { etat.module = h; ecrireEtat(); rendre(); }
});
export { MODULES, f, nombre };
