// Classification des sols pour les remblais et les couches de forme, au GTR 2024
// [F1 § 2.2 ; F2 annexe 1], conforme à la NF EN 16907-2 : classes F, I, S, G
// (Dmax ≤ 63 mm) et VC (Dmax > 63 mm), sols organiques O, puis sous-classes
// d'état hydrique (th, h, m, s, ts) ou « ins » (insensible à l'eau).
//
// Tous les seuils sont rassemblés dans les tableaux ci-dessous, avec leur
// source : le cours les affiche, l'exerciseur et le bureau les appliquent.
// Les références « F1 » et « F2 » désignent les deux fascicules du guide des
// terrassements des remblais et des couches de forme (Cerema–IDRRIM, 2024).

import { horsDomaine } from "./outils.js";
import { etalement } from "./granulo.js";

// ───────────────────────────── Intervalles ──────────────────────────────

/**
 * Intervalle écrit comme en mathématiques : "(3,8]" ⇔ 3 < x ≤ 8 ;
 * "[1.25,)" ⇔ x ≥ 1,25 ; "(,3]" ⇔ x ≤ 3.
 */
export function intervalle(txt) {
  const m = /^([[(])\s*([-\d.]*)\s*,\s*([-\d.]*)\s*([\])])$/.exec(txt);
  if (!m) throw new Error(`intervalle illisible : ${txt}`);
  return { a: m[2] === "" ? -Infinity : Number(m[2]), b: m[3] === "" ? Infinity : Number(m[3]), ia: m[1] === "[", ib: m[4] === "]" };
}
export const contient = (txt, x) => {
  if (!Number.isFinite(x)) return false;
  const I = intervalle(txt);
  return (I.ia ? x >= I.a : x > I.a) && (I.ib ? x <= I.b : x < I.b);
};
/** Nombre écrit à la française, trois chiffres significatifs au plus (les seuils restent exacts). */
const nb = (x) => (Number.isFinite(x) ? String(Number(x.toPrecision(3))) : String(x)).replace(".", ",");
/** Écriture française d'un intervalle sur un paramètre : « 3 < IPI ≤ 8 ». */
export function enClair(txt, nom, facteur = "") {
  const I = intervalle(txt), v = (x) => `${nb(x)}${facteur}`;
  const gauche = I.a === -Infinity ? "" : `${v(I.a)} ${I.ia ? "≤" : "<"} `;
  const droite = I.b === Infinity ? "" : ` ${I.ib ? "≤" : "<"} ${v(I.b)}`;
  if (!gauche && droite) return `${nom}${droite}`;
  if (gauche && !droite) return `${nom} ${I.ia ? "≥" : ">"} ${v(I.a)}`;
  return `${gauche}${nom}${droite}`;
}

// ─────────────────────────── Seuils de nature ───────────────────────────

/** Seuils de nature retenus par le GTR 2024 [F1 § 2.2.1]. */
export const SEUILS_2024 = {
  Dmax: 63, // mm : sols F, I, S, G / sols VC
  Lmax: 250, // mm : sols / matériaux blocailleux ou rocheux
  fines: { F: 35, IS: 15, tresPeu: 5 }, // % de tamisat à 63 µm sur la fraction 0/63 mm
  Cu: 6, // granulométrie étalée si Cu ≥ 6
  IP: [12, 22, 40, 55],
  VBS: { inactif: 0.1, sensible: 0.2, I: 1.5, F12: 2.5, F23: 6, F34: 8 },
  LA: 45, MDE: 45, FS: 60, CBRi: 20,
  MO: [2, 6, 20], // % de matières organiques (perte au feu)
};

/** Description des sous-classes de nature [F2 annexe 1]. */
export const SOUS_CLASSES = {
  F1: "limons peu plastiques, lœss, silts alluvionnaires, sables fins peu pollués, arènes peu plastiques",
  F2: "sables fins argileux, limons, argiles et marnes peu plastiques, arènes",
  F3: "argiles et argiles marneuses, limons très plastiques",
  F4: "argiles et argiles marneuses très plastiques",
  "F4+": "argiles extrêmement plastiques : emploi en l'état exclu hors étude spécifique",
  I1: "sables et graves très silteux",
  I2: "sables et graves argileux à très argileux",
  S1: "sables propres ou silteux à granulométrie étalée",
  S2: "sables propres ou silteux à granulométrie mal graduée",
  S3: "sables limoneux ou peu argileux à granulométrie étalée",
  S4: "sables limoneux ou peu argileux mal gradués",
  G1: "graves à peu de fines et granulométrie étalée, roulées ou anguleuses",
  G2: "graves homométriques à peu de fines (galets…)",
  G3: "graves silteuses ou peu argileuses à granulométrie étalée",
  G4: "graves silteuses ou peu argileuses mal graduées",
  VC1: "matériaux anguleux très charpentés (fraction 0/63 mm ≤ 60 à 80 %) : comportement régi par les gros éléments",
  VC2: "matériaux roulés, ou anguleux peu charpentés (fraction 0/63 mm > 60 à 80 %) : comportement régi par la fraction 0/63 mm",
};

// ─────────────────────────── États hydriques ────────────────────────────
// Pour chaque sous-classe, les lignes vont du plus humide au plus sec ; un
// critère manquant n'existe pas pour cet état. r = wn / wOPN. Le paramètre
// à privilégier est indiqué [F2 annexe 1, caractères gras].

const L = (etat, crit) => ({ etat, ...crit });
export const ETATS_2024 = {
  F1: { prio: "IPI", lignes: [
    L("th", { IPI: "(,3]", r: "[1.25,)" }), L("h", { IPI: "(3,8]", r: "[1.1,1.25)" }), L("m", { IPI: "(8,25]", r: "[0.9,1.1)" }),
    L("s", { r: "[0.7,0.9)" }), L("ts", { r: "(,0.7)" })] },
  F2: { prio: "IPI, Ic", lignes: [
    L("th", { IPI: "(,2]", Ic: "(,0.95]", r: "[1.3,)" }), L("h", { IPI: "(2,6]", Ic: "(0.95,1.05]", r: "[1.1,1.3)" }),
    L("m", { IPI: "(6,15]", Ic: "(1.05,1.15]", r: "[0.9,1.1)" }), L("s", { Ic: "(1.15,1.3]", r: "[0.7,0.9)" }), L("ts", { Ic: "(1.3,)", r: "(,0.7)" })] },
  F3: { prio: "IPI, Ic", lignes: [
    L("th", { IPI: "(,2]", Ic: "(,0.85]", r: "[1.4,)" }), L("h", { IPI: "(2,4]", Ic: "(0.85,1]", r: "[1.2,1.4)" }),
    L("m", { IPI: "(4,10]", Ic: "(1,1.1]", r: "[0.9,1.2)" }), L("s", { Ic: "(1.1,1.25]", r: "[0.7,0.9)" }), L("ts", { Ic: "(1.25,)", r: "(,0.7)" })] },
  F4: { prio: "IPI, Ic", lignes: [
    L("th", { IPI: "(,1]", Ic: "(,0.8]", r: "[1.4,)" }), L("h", { IPI: "(1,3]", Ic: "(0.8,1]", r: "[1.2,1.4)" }),
    L("m", { IPI: "(3,10]", Ic: "(1,1.1]", r: "[0.9,1.2)" }), L("s", { Ic: "(1.1,1.2]", r: "[0.7,0.9)" }), L("ts", { Ic: "(1.2,)", r: "(,0.7)" })] },
  I1: { prio: "IPI", lignes: [
    L("th", { IPI: "(,5]", r: "[1.25,)" }), L("h", { IPI: "(5,12]", r: "[1.1,1.25)" }), L("m", { IPI: "(12,30]", r: "[0.9,1.1)" }),
    L("s", { r: "[0.6,0.9)" }), L("ts", { r: "(,0.6)" })] },
  I2: { prio: "IPI, Ic", lignes: [
    L("th", { IPI: "(,4]", Ic: "(,0.85]", r: "[1.3,)" }), L("h", { IPI: "(4,10]", Ic: "(0.85,1]", r: "[1.1,1.3)" }),
    L("m", { IPI: "(10,25]", Ic: "(1,1.15]", r: "[0.9,1.1)" }), L("s", { Ic: "(1.15,1.25]", r: "[0.7,0.9)" }), L("ts", { Ic: "(1.25,)", r: "(,0.7)" })] },
  // Sables : deux jeux de seuils selon le tamisat à 2 mm (> 70 % ou ≤ 70 %).
  "S>70": { prio: "IPI", lignes: [
    L("th", { IPI: "(,4]", r: "[1.25,)" }), L("h", { IPI: "(4,8]", r: "[1.1,1.25)" }), L("m", { r: "[0.9,1.1)" }),
    L("s", { r: "[0.5,0.9)" }), L("ts", { r: "(,0.5)" })] },
  "S≤70": { prio: "IPI", lignes: [
    L("th", { IPI: "(,6]", r: "[1.25,)" }), L("h", { IPI: "(6,12]", r: "[1.1,1.25)" }), L("m", { r: "[0.9,1.1)" }),
    L("s", { r: "[0.6,0.9)" }), L("ts", { r: "(,0.6)" })] },
  // Graves : le guide écrit « 12 < IPI ≤ 30 » pour l'état m, qui chevauche
  // l'état h (7 < IPI ≤ 15) : on lit les lignes dans l'ordre, la plus humide l'emporte.
  G: { prio: "IPI", lignes: [
    L("th", { IPI: "(,7]", r: "[1.25,)" }), L("h", { IPI: "(7,15]", r: "[1.1,1.25)" }), L("m", { IPI: "(12,30]", r: "[0.9,1.1)" }),
    L("s", { r: "[0.6,0.9)" }), L("ts", { r: "(,0.6)" })] },
};

/** Clé du tableau d'états d'une sous-classe de nature (S1…S4 → S>70 ou S≤70, G1…G4 → G). */
export function cleEtats(sousClasse, p2mm) {
  if (/^S[1-4]$/.test(sousClasse)) return p2mm > 70 ? "S>70" : "S≤70";
  if (/^G[1-4]$/.test(sousClasse)) return "G";
  return ETATS_2024[sousClasse] ? sousClasse : null;
}

/** État donné par un seul paramètre (premier état, du plus humide au plus sec, dont l'intervalle contient la valeur). */
function etatPar(lignes, cle, x) {
  if (!Number.isFinite(x)) return null;
  return lignes.find((l) => l[cle] && contient(l[cle], x))?.etat ?? null;
}

/**
 * État hydrique d'un sol sensible à l'eau, à partir de l'IPI, de l'indice de
 * consistance Ic et du rapport r = wn/wOPN (ceux qui sont connus). Le GTR
 * privilégie l'IPI pour les états humides (h, th) — il traduit la difficulté
 * de circulation des engins — et wn/wOPN pour les états secs (s, ts), dont
 * dépend la difficulté de compactage ; l'Ic ne vaut que pour les sols
 * moyennement à très argileux [F1 § 2.2.1 C]. Les paramètres peuvent ne pas
 * concorder : on le dit.
 */
export function etatHydrique(cleTable, { IPI = NaN, Ic = NaN, w = NaN, wOPN = NaN } = {}) {
  const t = ETATS_2024[cleTable];
  if (!t) return horsDomaine(`Pas de seuils d'état hydrique pour « ${cleTable} » : ils sont à fixer par une étude spécifique.`);
  const r = w / wOPN;
  const parIPI = etatPar(t.lignes, "IPI", IPI), parIc = etatPar(t.lignes, "Ic", Ic), parR = etatPar(t.lignes, "r", r);
  let etat = null, par = "";
  if (parIPI === "th" || parIPI === "h") { etat = parIPI; par = "IPI"; }
  else if (Number.isFinite(IPI) && (parR === "th" || parR === "h")) {
    // L'IPI dit que le sol porte : il l'emporte sur la teneur en eau pour les états humides.
    etat = parIPI ?? "m"; par = "IPI";
  } else if (parR) { etat = parR; par = "wn/wOPN"; }
  else if (parIc) { etat = parIc; par = "Ic"; }
  else if (parIPI) { etat = parIPI; par = "IPI"; }
  const mesures = [["IPI", parIPI, IPI], ["Ic", parIc, Ic], ["wn/wOPN", parR, r]].filter(([, e]) => e);
  const discordance = new Set(mesures.map(([, e]) => e)).size > 1;
  if (!etat) return horsDomaine("Aucun paramètre d'état (IPI, Ic, wn et wOPN) ne permet de situer l'état hydrique.", { mesures });
  return { applicable: true, etat, par, r, mesures, discordance, table: cleTable };
}

// ───────────────────────── Sensibilité à l'eau ──────────────────────────

/**
 * Sables et graves « insensibles à l'eau » (suffixe ins) [F2 annexe 1] :
 * sables — fines ≤ 5 % et VBS < 0,2 ; ou fines de 5 à 10 % et VBS < 0,1 ;
 * ou VBS < 0,1, fines < 12 % et CBRi > 20.
 * graves — fines ≤ 5 % et VBS < 0,2 ; ou fines de 5 à 10 % et VBS < 0,1 ;
 * ou fines de 5 à 10 %, 0,1 ≤ VBS < 0,2 et CBRi > 20 ; ou fines de 10 à
 * 12 %, VBS < 0,1 et CBRi > 20.
 */
export function insensible(classe, { p63um, VBS, CBRi = NaN }) {
  if (!Number.isFinite(p63um) || !Number.isFinite(VBS)) return { ins: null, motif: "VBS ou tamisat à 63 µm inconnu : sensibilité à l'eau indéterminée" };
  const f = p63um, c = Number.isFinite(CBRi) && CBRi > 20;
  const regles = classe === "S"
    ? [[f <= 5 && VBS < 0.2, "fines ≤ 5 % et VBS < 0,2"], [f > 5 && f <= 10 && VBS < 0.1, "fines de 5 à 10 % et VBS < 0,1"],
      [VBS < 0.1 && f < 12 && c, "VBS < 0,1, fines < 12 % et CBRi > 20"]]
    : [[f <= 5 && VBS < 0.2, "fines ≤ 5 % et VBS < 0,2"], [f > 5 && f <= 10 && VBS < 0.1, "fines de 5 à 10 % et VBS < 0,1"],
      [f > 5 && f <= 10 && VBS >= 0.1 && VBS < 0.2 && c, "fines de 5 à 10 %, 0,1 ≤ VBS < 0,2 et CBRi > 20"],
      [f > 10 && f <= 12 && VBS < 0.1 && c, "fines de 10 à 12 %, VBS < 0,1 et CBRi > 20"]];
  const ok = regles.find(([v]) => v);
  if (ok) return { ins: true, motif: ok[1] };
  const attendCBRi = !Number.isFinite(CBRi) && VBS < 0.2 && f <= 12;
  return { ins: false, motif: attendCBRi ? "aucun critère d'insensibilité n'est rempli sans CBRi : un CBR immergé pourrait le démontrer" : "aucun critère d'insensibilité à l'eau n'est rempli" };
}

// ─────────────────────────── Classes de nature ──────────────────────────

/**
 * Sous-classe d'argilosité d'un sol F ou I. Le critère à privilégier :
 * la VBS pour les sols peu plastiques (F1, I1), l'IP dès qu'il atteint 12
 * [F1 § 2.2.1 A.2 ; F2 annexe 1]. Renvoie la sous-classe, le critère
 * utilisé et l'avis de l'autre critère.
 */
function argilosite(classe, { IP, VBS }) {
  const S = SEUILS_2024;
  const parIP = (x) => (classe === "F"
    ? (x <= 12 ? "F1" : x <= 22 ? "F2" : x <= 40 ? "F3" : x <= 55 ? "F4" : "F4+")
    : (x <= 12 ? "I1" : "I2"));
  const parVBS = (x) => (classe === "F"
    ? (x <= S.VBS.F12 ? "F1" : x <= S.VBS.F23 ? "F2" : x <= S.VBS.F34 ? "F3" : "F4")
    : (x <= S.VBS.I ? "I1" : "I2"));
  const ip = Number.isFinite(IP) ? parIP(IP) : null, vb = Number.isFinite(VBS) ? parVBS(VBS) : null;
  if (!ip && !vb) return null;
  // L'IP prime dès qu'il dépasse 12 ; en dessous, la VBS est plus sûre.
  const parL_IP = ip && IP > 12;
  const retenue = parL_IP ? ip : vb ?? ip;
  const critere = parL_IP ? `IP = ${nb(IP)}` : vb ? `VBS = ${nb(VBS)}` : `IP = ${nb(IP)}`;
  const autre = parL_IP ? (vb ? `VBS = ${nb(VBS)} → ${vb}` : null) : (vb && ip ? `IP = ${nb(IP)} → ${ip}` : null);
  return { sousClasse: retenue, critere, autre, concordent: !(ip && vb) || ip === vb };
}

/**
 * Classe d'un sol au GTR 2024 à partir de ses essais. Entrées (fraction 0/63
 * mm pour les passants) : Dmax (mm), p63um, p2mm (%), Cu (ou D60, D10),
 * fractionSable et fractionGrave (sinon déduites de p63um et p2mm), VBS, IP,
 * w, wOPN, IPI, Ic (ou wL et wP), CBRi, LA, MDE, FS ; pour Dmax > 63 mm :
 * fraction063 (part de la fraction 0/63 mm, %) et forme (« roulés » ou
 * « anguleux ») ; MO (% de matières organiques).
 * Renvoie { classe, sousClasse, comportement, etat, symbole, arbre, avertissements }.
 */
export function classerSol(e) {
  const S = SEUILS_2024, arbre = [], avert = [];
  const etape = (question, reponse, detail = "") => arbre.push({ question, reponse, detail });
  const { Dmax, p63um, VBS, IP, CBRi } = e;
  let { p2mm, Cu, fractionSable, fractionGrave } = e;
  if (!Number.isFinite(p63um)) return horsDomaine("Le tamisat à 63 µm est indispensable pour classer un sol.");

  // Sols organiques : la teneur en matières organiques passe avant tout [F1 § 2.4.1].
  let organique = null;
  if (Number.isFinite(e.MO) && e.MO > S.MO[0]) {
    organique = e.MO <= S.MO[1] ? "O1" : e.MO <= S.MO[2] ? "O2" : "O3";
    etape("Teneur en matières organiques > 2 % ?", `oui : ${nb(e.MO)} % → ${organique}`,
      organique === "O3" ? "tourbe : ni remblai ni couche de forme" : "on classe ensuite la partie minérale (double symbole)");
    if (organique === "O3") return { applicable: true, classe: "O", sousClasse: "O3", symbole: "O3", organique, arbre, avertissements: avert, etat: null };
  }

  // 1er niveau : Dmax, sur 63 mm.
  const gros = Number.isFinite(Dmax) && Dmax > S.Dmax;
  etape("Dmax > 63 mm ?", gros ? `oui (${nb(Dmax)} mm) : sol VC, la fraction 0/63 mm est classée à part` : `non${Number.isFinite(Dmax) ? ` (${nb(Dmax)} mm)` : ""} : sol F, I, S ou G`);
  let vc = null;
  if (gros) {
    const part = e.fraction063, roules = e.forme === "roulés";
    if (roules) vc = "VC2";
    else if (Number.isFinite(part)) vc = part > 80 ? "VC2" : part <= 60 ? "VC1" : null;
    if (!vc) {
      vc = "VC1";
      avert.push("Fraction 0/63 mm entre 60 et 80 % d'éléments anguleux : le guide laisse le choix VC1/VC2 au géotechnicien, selon que les gros éléments forment ou non un squelette. VC1 retenu par prudence.");
    }
    etape("Comportement régi par les gros éléments ?", vc === "VC1" ? "oui : VC1 (matériau anguleux charpenté)" : "non : VC2 (la fraction 0/63 mm gouverne)",
      roules ? "éléments roulés" : Number.isFinite(part) ? `fraction 0/63 mm = ${nb(part)} %` : "");
  }

  // 2e niveau : la teneur en fines.
  let classe, sousClasse;
  if (p63um > S.fines.F) {
    classe = "F";
    etape("Tamisat à 63 µm > 35 % ?", `oui (${nb(p63um)} %) : sol fin F`);
  } else if (p63um > S.fines.IS) {
    classe = "I";
    etape("Tamisat à 63 µm > 35 % ?", `non ; > 15 % (${nb(p63um)} %) : sol intermédiaire I`);
  } else {
    if (!Number.isFinite(fractionSable) || !Number.isFinite(fractionGrave)) {
      if (Number.isFinite(p2mm)) { fractionSable = p2mm - p63um; fractionGrave = 100 - p2mm; }
    }
    if (!Number.isFinite(fractionSable)) return horsDomaine("Fines ≤ 15 % : il faut le tamisat à 2 mm (ou les fractions sableuse et graveleuse) pour distinguer un sable d'une grave.", { arbre });
    classe = fractionSable > fractionGrave ? "S" : "G";
    etape("Tamisat à 63 µm ≤ 15 % : fraction 0,063/2 mm > fraction 2/63 mm ?",
      `${classe === "S" ? "oui" : "non"} (${nb(Math.round(fractionSable))} % contre ${nb(Math.round(fractionGrave))} %) : sol ${classe === "S" ? "sableux S" : "graveleux G"}`);
  }

  let comportement = null, etat = null, ins = null, critereNature = "";
  if (classe === "F" || classe === "I") {
    const a = argilosite(classe, { IP, VBS });
    if (!a) return horsDomaine(`Sol ${classe} : il faut la VBS ou l'IP pour fixer la sous-classe.`, { arbre });
    sousClasse = a.sousClasse; critereNature = a.critere;
    etape("Argilosité (VBS pour les sols peu plastiques, IP dès 12) ?", `${a.critere} → ${sousClasse}`, a.autre ? `l'autre critère : ${a.autre}${a.concordent ? "" : " — désaccord, le critère privilégié l'emporte"}` : "");
    if (!a.concordent) avert.push(`IP et VBS ne donnent pas la même sous-classe (${a.critere} ; ${a.autre}) : le guide fait primer la VBS sous IP = 12, l'IP au-delà.`);
  } else {
    if (!Number.isFinite(Cu) && Number.isFinite(e.D60) && Number.isFinite(e.D10)) Cu = e.D60 / e.D10;
    const et = etalement({ Cu, D60: e.D60 });
    if (et.etalee === null) return horsDomaine(`Sol ${classe} : il faut Cu (ou D60) pour savoir si la granulométrie est étalée.`, { arbre });
    const peu = p63um <= S.fines.tresPeu;
    const n = (peu ? 1 : 3) + (et.etalee ? 0 : 1);
    sousClasse = `${classe}${n}`;
    critereNature = `fines ${peu ? "≤ 5 %" : "de 5 à 15 %"}, ${et.etalee ? "étalée" : "uniforme"}`;
    etape("Fines ≤ 5 % ? Granulométrie étalée (Cu ≥ 6) ?", `${peu ? "≤ 5 %" : "de 5 à 15 %"} ; ${et.motif} → ${sousClasse}`);
    // Comportement mécanique (couche de forme) : FS pour les sables, LA et MDE pour les graves.
    if (classe === "S" && Number.isFinite(e.FS)) comportement = `${sousClasse}${e.FS <= S.FS ? 1 : 2}`;
    if (classe === "G" && (Number.isFinite(e.LA) || Number.isFinite(e.MDE))) {
      const dur = (!Number.isFinite(e.LA) || e.LA <= S.LA) && (!Number.isFinite(e.MDE) || e.MDE <= S.MDE);
      comportement = `${sousClasse}${dur ? 1 : 2}`;
      if (!Number.isFinite(e.LA) || !Number.isFinite(e.MDE)) avert.push("LA et MDE sont tous deux nécessaires pour le comportement mécanique d'une grave : un seul a été donné.");
    }
    if (comportement) etape(classe === "S" ? "Friabilité FS ≤ 60 ?" : "LA ≤ 45 et MDE ≤ 45 ?", `→ ${comportement}`, "paramètre de comportement : il ne sert qu'à l'emploi en couche de forme");
    const s = insensible(classe, { p63um, VBS, CBRi });
    ins = s.ins;
    etape("Insensible à l'eau (VBS, fines, CBRi) ?", s.ins ? `oui : ${s.motif} → suffixe « ins »` : s.ins === false ? `non : ${s.motif}` : s.motif);
  }

  // État hydrique (sauf matériau insensible à l'eau).
  if (ins) etat = "ins";
  else {
    const cle = cleEtats(sousClasse, p2mm);
    if (sousClasse === "F4+") {
      etape("État hydrique ?", "F4+ : seuils à fixer par une étude spécifique");
    } else if (cle) {
      const wL = e.wL, wP = e.wP;
      const Ic = Number.isFinite(e.Ic) ? e.Ic : (Number.isFinite(wL) && Number.isFinite(wP) && Number.isFinite(e.w) ? (wL - e.w) / (wL - wP) : NaN);
      const h = etatHydrique(cle, { IPI: e.IPI, Ic, w: e.w, wOPN: e.wOPN });
      if (h.applicable) {
        etat = h.etat;
        etape("État hydrique ?", `${h.etat} (par ${h.par})`, h.mesures.map(([p, x]) => `${p} → ${x}`).join(" ; ") + (h.discordance ? " — les paramètres ne concordent pas, le guide prévient que la correspondance n'est pas parfaite" : ""));
      } else etape("État hydrique ?", "indéterminé", h.motif);
    }
  }

  const coeur = comportement ?? sousClasse;
  const symboleSol = `${coeur}${etat ?? ""}`;
  let symbole = vc ? `${vc}${symboleSol}` : symboleSol;
  if (organique) symbole = `${organique}${symbole}`;
  return {
    applicable: true, classe: vc ?? classe, classeFraction: classe, sousClasse, comportement, etat, ins, vc, organique,
    symbole, critereNature, description: SOUS_CLASSES[sousClasse] ?? "", arbre, avertissements: avert,
  };
}

// ─────────────────────────── Matériaux rocheux ──────────────────────────

/** Familles pétrographiques du GTR 2024 [F1 tableau 7]. */
export const FAMILLES_ROCHES = {
  CH: "craie", Li: "calcaire", Cl: "roche argileuse (marne, argilite, pélite)", Sa: "grès", Co: "brèche, poudingue, conglomérat",
  SR: "roche saline (gypse, sel gemme, anhydrite)", Vo: "roche magmatique (granite, basalte…)", Me: "roche métamorphique (gneiss, schiste…)",
};

/**
 * Classe d'un matériau rocheux [F2 annexe 1] : famille et paramètres ρd
 * (Mg/m³), wn (%), MDE, LA, IFR (fragmentabilité), IDGa (dégradabilité),
 * teneurs en gypse et en sel (%) ; pour R5 Cl, wn/wOPN et IPI.
 */
export function classerRoche(famille, p = {}) {
  const { rhoD, wn, MDE, LA, IFR, IDGa } = p;
  const manque = (...noms) => horsDomaine(`Il faut ${noms.join(" et ")} pour classer ${FAMILLES_ROCHES[famille] ?? "cette roche"}.`);
  const ok = (sousClasse, nom, detail = "") => ({ applicable: true, famille, sousClasse, nom, detail });
  switch (famille) {
    case "CH": {
      if (!Number.isFinite(rhoD)) return manque("ρd");
      if (rhoD > 1.95) return ok("CH1", "craie très dense");
      if (rhoD > 1.7) return ok("CH2", "craie dense");
      if (!Number.isFinite(wn)) return manque("wn");
      if (rhoD > 1.55) return ok(`CH3${wn >= 27 ? "h" : wn >= 22 ? "m" : wn >= 18 ? "s" : "ts"}`, "craie de densité moyenne", "1,55 < ρd ≤ 1,7");
      return ok(`CH4${wn >= 31 ? "th" : wn >= 26 ? "h" : wn >= 21 ? "m" : wn >= 16 ? "s" : "ts"}`, "craie peu dense", "ρd ≤ 1,55");
    }
    case "Li": {
      if (Number.isFinite(MDE) && MDE <= 45) return ok("R3 Li", "calcaire dur");
      if (!Number.isFinite(rhoD)) return manque("MDE", "ρd");
      if (rhoD <= 1.8) return ok("R5 Li", "calcaire fragmentable");
      if (!Number.isFinite(MDE)) return manque("MDE");
      return ok("R4 Li", "calcaire de dureté moyenne");
    }
    case "Cl": {
      if (!Number.isFinite(IFR)) return manque("IFR");
      if (IFR > 7) {
        const r = p.w / p.wOPN, IPI = p.IPI;
        let e = null;
        if ((Number.isFinite(r) && r >= 1.3) || (Number.isFinite(IPI) && IPI < 2)) e = "th";
        else if ((Number.isFinite(r) && r >= 1.1) || (Number.isFinite(IPI) && IPI < 5)) e = "h";
        else if (Number.isFinite(r)) e = r >= 0.9 ? "m" : r >= 0.7 ? "s" : "ts";
        return ok(`R5 Cl${e ? " " + e : ""}`, "roche argileuse fragmentable", e ? "" : "état à préciser par wn/wOPN ou IPI");
      }
      if (!Number.isFinite(IDGa) || !Number.isFinite(MDE)) return manque("IDGa", "MDE");
      if (MDE <= 45) return IDGa <= 5 ? ok("R3 Cl", "roche argileuse dure") : ok("R4 Cld2", "roche argileuse peu fragmentable, dégradable", "MDE ≤ 45 mais IDGa > 5 : cas non prévu au tableau, rattaché à la dégradabilité");
      return IDGa > 20 ? ok("R4 Cld1", "peu fragmentable, très dégradable") : IDGa > 5 ? ok("R4 Cld2", "peu fragmentable, moyennement dégradable") : ok("R4 Cl", "peu fragmentable, peu dégradable");
    }
    case "Sa": case "Co": {
      if (Number.isFinite(IFR) && IFR > 7) return ok(`R5 ${famille}`, "roche siliceuse fragmentable");
      if (!Number.isFinite(LA) || !Number.isFinite(MDE)) return manque("LA", "MDE");
      if (LA <= 45 && MDE <= 45) return ok(`R3 ${famille}`, "roche siliceuse dure");
      if (!Number.isFinite(IFR) || !Number.isFinite(IDGa)) return manque("IFR", "IDGa");
      return IDGa > 5 ? ok(`R4 ${famille}d`, "dureté moyenne, dégradable") : ok(`R4 ${famille}`, "roche siliceuse de dureté moyenne");
    }
    case "Vo": case "Me": {
      if (Number.isFinite(IFR) && IFR > 7) return ok(`R5 ${famille}`, "fragmentable ou altérée");
      if (!Number.isFinite(LA) || !Number.isFinite(MDE)) return manque("LA", "MDE");
      if (LA <= 25 && MDE <= 10) return ok(`R1 ${famille}`, "extrêmement dure");
      if (LA <= 35 && MDE <= 25) return ok(`R2 ${famille}`, "très dure");
      if (LA <= 45 && MDE <= 45) return ok(`R3 ${famille}`, "dure");
      if (!Number.isFinite(IFR)) return manque("IFR");
      return ok(`R4 ${famille}`, "dureté moyenne");
    }
    case "SR": {
      const { gypse = NaN, sel = NaN } = p;
      if (Number.isFinite(sel) && sel > 1) return ok("SR5", "roche saline très soluble (sel gemme > 1 %)");
      if (Number.isFinite(gypse) && gypse > 20) return ok("SR3", "roche saline très soluble (gypse > 20 %)");
      if (Number.isFinite(sel) && sel > 0) return ok("SR4", "roche saline peu soluble (sel gemme ≤ 1 %)");
      if (!Number.isFinite(gypse)) return manque("la teneur en gypse ou en sel");
      return gypse <= 2 ? ok("SR1", "très peu soluble (gypse ≤ 2 %)") : ok("SR2", "peu soluble (gypse ≤ 20 %)");
    }
    default: return horsDomaine(`Famille de roche inconnue : ${famille}`);
  }
}

/** Indice de consistance Ic = (wL − wn)/IP. */
export const indiceConsistance = ({ wL, wP, w }) => (wL - w) / (wL - wP);
