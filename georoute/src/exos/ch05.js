// Exercices du chapitre 5 : classer les matériaux au GTR 2024 et au GTR
// 1992 — sols fins et intermédiaires, sables et graves, insensibilité à
// l'eau, sols à gros éléments VC, sols organiques, seuils qui ont changé
// d'une édition à l'autre, et un même sol classé aux deux éditions.
import { fr, frd, nombre, choixMelange, donnee } from "./alea.js";
import { classerSol, insensible, etatHydrique, ETATS_2024, cleEtats, intervalle, SOUS_CLASSES } from "../gtr/classification.js";
import { classerSol1992, SOUS_CLASSES_1992 } from "../gtr/classification92.js";
import { analyser } from "../gtr/granulo.js";
import { REFERENCE_CBR } from "../gtr/portance.js";
import { courbeGranulo, COULEURS } from "../figures.js";

const pc = (x, d = 1) => `${frd(x, d)} %`;
const arrondi = (x, n = 1) => Math.round(x * 10 ** n) / 10 ** n;
/** Une valeur mesurée reste-t-elle à distance de chacun des seuils ? (une valeur absente ne gêne pas) */
const loin = (x, seuils, marge) => !Number.isFinite(x) || seuils.every((s) => Math.abs(x - s) >= marge);
const ETATS = ["th", "h", "m", "s", "ts"];
const NOMS_ETAT = { th: "th : très humide", h: "h : humide", m: "m : moyen", s: "s : sec", ts: "ts : très sec" };
const optionsEtat = (bon) => [NOMS_ETAT[bon], ...ETATS.filter((e) => e !== bon).map((e) => NOMS_ETAT[e])];

/** Sous-classe voisine dans sa série (F2 → F1 ou F3, I1 → I2…), tirée au hasard quand il y en a deux. */
const SERIES = { F: 4, I: 2, S: 4, G: 4 };
function voisine(a, sc) {
  const n = Number(sc[1]);
  return `${sc[0]}${a.choix([n - 1, n + 1].filter((k) => k >= 1 && k <= SERIES[sc[0]]))}`;
}
const VOISINS_ETAT = { th: ["h"], h: ["th", "m"], m: ["h", "s"], s: ["m", "ts"], ts: ["s"] };
const etatVoisin = (a, e) => a.choix(VOISINS_ETAT[e]);
/**
 * Quatre symboles où chaque valeur de chaque composante apparaît deux fois
 * (carré latin ; grille 2 × 2 sans troisième composante). La bonne réponse
 * est f(x0, y0, z0) ; les options ne trahissent ainsi la réponse d'aucune
 * autre question de l'exercice (sous-classe, état, préfixe…).
 */
const equilibre = (f, [x0, x1], [y0, y1], [z0, z1] = ["", ""]) => [f(x0, y0, z0), f(x0, y1, z1), f(x1, y0, z1), f(x1, y1, z0)];
/**
 * Leurres tirés du solveur lui-même : le même classement relancé avec un
 * paramètre modifié (VBS, teneur en eau…) donne des symboles valides et
 * plausibles de la même édition.
 */
function leurres(a, classer, entree, alterations, juste, n = 3) {
  const vus = new Set();
  for (const alt of alterations) {
    const r = classer({ ...entree, ...alt });
    if (r.applicable && r.symbole !== juste) vus.add(r.symbole);
  }
  return a.tirage([...vus], n);
}
/** Valeur tirée dans un intervalle d'état « (a,b] », loin des bornes. */
function dans(a, txt, marge, bas, haut, pas) {
  const I = intervalle(txt);
  const lo = Number.isFinite(I.a) ? I.a + marge : bas, hi = Number.isFinite(I.b) ? I.b - marge : haut;
  return a.entre(Math.min(lo, hi), Math.max(lo, hi), pas);
}
const etape = (r, debut) => r.arbre.find((e) => e.question.startsWith(debut));
/** Paramètre qui a décidé de l'état hydrique, lu dans le chemin du classement (« m (par IPI) »). */
const decidePar = (r) => /\(par ([^)]+)\)/.exec(etape(r, "État hydrique")?.reponse ?? "")?.[1] ?? "";

// Emploi des sols selon leur teneur en matières organiques (tableau du cours, chapitre 2 [F1 § 2.4.1]).
const EMPLOI_REMBLAI = {
  "": "oui, comme un sol ordinaire", O1: "oui, pour des remblais courants de moins de 10 m",
  O2: "seulement pour des surfaces à enherber ou des merlons", O3: "non : tourbe exclue des remblais",
};
const EMPLOI_CDF = (org, MO) => (!org ? "oui" : org === "O1" ? (MO >= 3 ? "seulement après une étude particulière (dès 3 %)" : "oui, sous 3 % de matières organiques") : "non");

// Ce qui fait basculer un sol d'une classe à l'autre entre les deux éditions (tableau de correspondance du cours).
const BASCULES = {
  IP: "le seuil d'IP entre sols moyennement argileux et argileux, passé de 25 à 22",
  fines: "le tamis des fines (80 → 63 µm) et le seuil des sols riches en fines (12 → 15 %)",
  Dmax: "le Dmax de référence des sols à gros éléments, passé de 50 à 63 mm",
  VC: "l'inversion des numéros des sols à gros éléments (C1 devient VC2, C2 devient VC1)",
  ins: "les règles d'insensibilité à l'eau, plus détaillées (fines, VBS, CBRi)",
};

export default [
  {
    id: "ch5-fin", titre: "Classer un sol fin : sous-classe, état, symbole", difficulte: 1,
    generer(a) {
      let sc, IP, VBS, wL, wP, w, wOPN, IPI, r, h, Ic, f;
      for (let essai = 0; essai < 80; essai++) {
        sc = a.choix(["F1", "F2", "F3", "F4"]);
        IP = sc === "F1" ? a.entier(5, 11) : sc === "F2" ? a.entier(13, 21) : sc === "F3" ? a.entier(23, 39) : a.entier(41, 52);
        VBS = sc === "F1" ? a.entre(0.6, 2.4, 0.1) : a.reel() < 0.5 ? NaN : sc === "F2" ? a.entre(2.6, 5.9, 0.1) : sc === "F3" ? a.entre(6.1, 7.9, 0.1) : a.entre(8.1, 11, 0.1);
        const lignes = ETATS_2024[sc].lignes, l = a.choix(lignes);
        wOPN = a.entre(12, 26, 0.1);
        w = arrondi(dans(a, l.r, 0.03, 0.5, 1.6, 0.01) * wOPN);
        IPI = l.IPI ? dans(a, l.IPI, 0.5, 0.4, 30, 0.1) : arrondi(Math.max(...lignes.filter((x) => x.IPI).map((x) => intervalle(x.IPI).b)) + a.entre(4, 15, 0.5));
        if (l.Ic) { Ic = dans(a, l.Ic, 0.02, 0.6, 1.5, 0.01); wL = Math.round(w + Ic * IP); }
        else wL = Math.round(wOPN + a.entre(3, 9, 1) + IP);
        wP = wL - IP;
        f = a.entre(40, 95, 1);
        r = classerSol({ Dmax: 10, p63um: f, IP, VBS, wL, wP, w, wOPN, IPI });
        h = etatHydrique(sc, { IPI, Ic: sc === "F1" ? NaN : (wL - w) / IP, w, wOPN });
        if (r.applicable && r.etat === l.etat && !h.discordance && wP >= 10) break;
      }
      const autresSc = ["F1", "F2", "F3", "F4"].filter((x) => x !== r.sousClasse);
      const Icr = (wL - w) / IP;
      return {
        enonce: `Un sol de déblai (${f} % de passant à 63 µm sur la fraction 0/63 mm, Dmax = 10 mm) a pour limites wL = ${fr(wL)} % et wP = ${fr(wP)} %${Number.isFinite(VBS) ? `, pour valeur de bleu VBS = ${frd(VBS, 1)}` : ""}. Au moment de l'extraction, wn = ${pc(w)} ; son optimum Proctor normal est à wOPN = ${pc(wOPN)}, et l'IPI à wn vaut ${frd(IPI, 1)}.`,
        donnees: [donnee("Fines (63 µm)", `${f} %`), donnee("wL · wP", `${fr(wL)} · ${fr(wP)} %`), ...(Number.isFinite(VBS) ? [donnee("VBS", frd(VBS, 1))] : []), donnee("wn · wOPN", `${pc(w)} · ${pc(wOPN)}`), donnee("IPI", frd(IPI, 1))],
        questions: [
          choixMelange(a, "Sous-classe de nature ?", [r.sousClasse, ...autresSc],
            `Fines > 35 % : sol fin F. ${etape(r, "Argilosité").reponse}${etape(r, "Argilosité").detail ? ` (${etape(r, "Argilosité").detail})` : ""}. Seuils : IP 12, 22, 40, 55 ; VBS 2,5, 6, 8 ; l'IP prime dès qu'il dépasse 12.`),
          nombre("Rapport wn/wOPN ?", w / wOPN, "", `${pc(w)} / ${pc(wOPN)} = ${frd(w / wOPN, 3)}.`, { abs: 0.01 }),
          ...(r.sousClasse === "F1" ? [] : [nombre("Indice de consistance Ic ?", Icr, "", `Ic = (wL − wn)/IP = (${fr(wL)} − ${frd(w, 1)})/${fr(IP)} = ${frd(Icr, 3)}.`, { abs: 0.01 })]),
          choixMelange(a, "État hydrique ?", optionsEtat(r.etat),
            `${NOMS_ETAT[r.etat]}, retenu par ${decidePar(r)} ; chaque paramètre mesuré : ${etape(r, "État hydrique").detail}. Les paramètres concordent ici.`),
          choixMelange(a, "Symbole complet au GTR 2024 ?", equilibre((x, y) => `${x}${y}`, [r.sousClasse, voisine(a, r.sousClasse)], [r.etat, etatVoisin(a, r.etat)]),
            `Nature ${r.sousClasse}, puis l'état ${r.etat} : ${r.symbole} (${SOUS_CLASSES[r.sousClasse]}). Au GTR 1992, le même sol aurait été noté A…, avec d'autres seuils.`),
        ],
      };
    },
  },
  {
    id: "ch5-intermediaire", titre: "Sol intermédiaire : I1 ou I2, et B5 ou B6 en 1992", difficulte: 2,
    generer(a) {
      let p63, p80, VBS, IP, wP, wL, wOPN, w, IPI, r24, r92;
      for (let essai = 0; essai < 60; essai++) {
        p63 = a.entre(17, 32, 0.5); p80 = arrondi(p63 + a.entre(1, 3, 0.5));
        VBS = a.entre(0.4, 3.2, 0.05); IP = a.entier(5, 26);
        wP = a.entier(14, 24); wL = wP + IP;
        wOPN = a.entre(9, 16, 0.1); w = arrondi(wOPN * a.entre(0.65, 1.35, 0.01)); IPI = a.entre(2, 32, 0.5);
        const Ic = (wL - w) / IP;
        r24 = classerSol({ Dmax: 20, p63um: p63, IP, VBS, wL, wP, w, wOPN, IPI });
        r92 = classerSol1992({ Dmax: 20, p80um: p80, VBS, IP, w, wOPN, IPI, Ic });
        const t = ETATS_2024[r24.sousClasse].lignes;
        const bornes = (p) => t.filter((l) => l[p]).flatMap((l) => { const I = intervalle(l[p]); return [I.a, I.b]; }).filter(Number.isFinite);
        if (r24.applicable && r92.applicable && r24.etat && r92.etat && loin(VBS, [1.5], 0.08) && loin(IP, [12], 1)
          && loin(w / wOPN, [0.6, 0.7, 0.9, 1.1, 1.25, 1.3], 0.015) && loin(IPI, [4, 5, 10, 12, 25, 30], 0.4) && loin(Ic, bornes("Ic").concat([0.8, 1.2, 1.3]), 0.012)) break;
      }
      const autreSc = r24.sousClasse === "I1" ? "I2" : "I1";
      return {
        enonce: `Un sable argileux de déblai (Dmax = 20 mm) a ${pc(p63)} de passant à 63 µm (${pc(p80)} à 80 µm), une valeur de bleu VBS = ${frd(VBS, 2)} et des limites wL = ${fr(wL)} %, wP = ${fr(wP)} %. Extrait à wn = ${pc(w)} (wOPN = ${pc(wOPN)}), il donne IPI = ${frd(IPI, 1)}.`,
        donnees: [donnee("Fines", `${pc(p63)} (63 µm) · ${pc(p80)} (80 µm)`), donnee("VBS", frd(VBS, 2)), donnee("wL · wP", `${fr(wL)} · ${fr(wP)} %`), donnee("wn · wOPN", `${pc(w)} · ${pc(wOPN)}`), donnee("IPI", frd(IPI, 1))],
        questions: [
          choixMelange(a, "Sous-classe de nature au GTR 2024 ?", [r24.sousClasse, autreSc, "S3", "F1"],
            `Fines de 15 à 35 % : sol intermédiaire I. ${etape(r24, "Argilosité").reponse}${etape(r24, "Argilosité").detail ? ` (${etape(r24, "Argilosité").detail})` : ""}. Le GTR utilise prioritairement la VBS pour les sols I, sauf quand l'IP dépasse 12.`),
          choixMelange(a, "État hydrique au GTR 2024 ?", optionsEtat(r24.etat),
            `${NOMS_ETAT[r24.etat]}, retenu par ${decidePar(r24)} ; chaque paramètre mesuré : ${etape(r24, "État hydrique").detail}. Pour un état humide, l'IPI l'emporte s'il dit que le sol porte ; pour un état sec, c'est wn/wOPN.`),
          choixMelange(a, "Symbole au GTR 2024 ?", equilibre((x, y) => `${x}${y}`, [r24.sousClasse, autreSc], [r24.etat, etatVoisin(a, r24.etat)]),
            `${r24.sousClasse} puis l'état ${r24.etat} : ${r24.symbole} (${SOUS_CLASSES[r24.sousClasse]}).`),
          choixMelange(a, "Et au GTR 1992 (fines au tamis de 80 µm) ?", equilibre((x, y) => `${x}${y}`, [r92.sousClasse, r92.sousClasse === "B5" ? "B6" : "B5"], [r92.etat, etatVoisin(a, r92.etat)]),
            `Fines à 80 µm : ${pc(p80)}, entre 12 et 35 % : classe B ; la VBS décide (${frd(VBS, 2)} ${VBS <= 1.5 ? "≤" : ">"} 1,5) → ${r92.sousClasse} ; état ${r92.etat} avec les seuils de 1992 → ${r92.symbole}.${r92.sousClasse.slice(1) !== r24.sousClasse.slice(1) ? " En 1992, la VBS décidait même quand l'IP dépassait 12 : les deux éditions divergent." : ""}`),
        ],
      };
    },
  },
  {
    id: "ch5-sable-grave", titre: "Sable ou grave : de S1 à G4, comportement et état", difficulte: 2,
    generer(a) {
      let sable, p63, p2, Cu, VBS, FS, LA, MDE, w, wOPN, r;
      for (let essai = 0; essai < 80; essai++) {
        sable = a.reel() < 0.5;
        p63 = a.entre(1.5, 14, 0.5);
        p2 = sable ? a.entre(Math.ceil((100 + p63) / 2 + 3), 97, 1) : a.entre(Math.ceil(p63 + 8), Math.floor((100 + p63) / 2 - 3), 1);
        Cu = a.entre(2, 40, 0.5); VBS = a.entre(0.25, 1.4, 0.05);
        FS = sable ? a.entre(20, 90, 1) : NaN; LA = sable ? NaN : a.entre(15, 65, 1); MDE = sable ? NaN : a.entre(10, 60, 1);
        wOPN = a.entre(5, 12, 0.1); w = arrondi(wOPN * a.entre(0.55, 1.35, 0.01));
        r = classerSol({ Dmax: sable ? 5 : 40, p63um: p63, p2mm: p2, Cu, VBS, FS, LA, MDE, w, wOPN });
        const seuilsR = ETATS_2024[cleEtats(r.sousClasse ?? "S1", p2)]?.lignes.flatMap((l) => { const I = intervalle(l.r); return [I.a, I.b]; }).filter(Number.isFinite) ?? [];
        if (r.applicable && r.etat && loin(p63, [5, 15], 0.4) && loin(Cu, [6], 0.4) && loin(FS, [60], 2) && loin(LA, [45], 1.5) && loin(MDE, [45], 1.5) && loin(w / wOPN, seuilsR, 0.015)) break;
      }
      const n = r.sousClasse[1], nv = voisine(a, r.sousClasse)[1], autre = sable ? "G" : "S";
      const comp = r.comportement.slice(-1);
      return {
        enonce: `${sable ? "Un sable alluvionnaire" : "Une grave alluvionnaire"} (Dmax = ${sable ? 5 : 40} mm) a, sur sa fraction 0/63 mm, ${pc(p63)} de fines (63 µm) et ${pc(p2, 0)} de passant à 2 mm ; Cu = ${frd(Cu, 1)} ; VBS = ${frd(VBS, 2)}. ${sable ? `Friabilité FS = ${fr(FS)}.` : `LA = ${fr(LA)} et MDE = ${fr(MDE)}.`} Teneur en eau naturelle ${pc(w)}, optimum à ${pc(wOPN)}.`,
        donnees: [donnee("Fines (63 µm)", pc(p63)), donnee("Passant 2 mm", pc(p2, 0)), donnee("Cu", frd(Cu, 1)), donnee("VBS", frd(VBS, 2)), donnee(sable ? "FS" : "LA · MDE", sable ? fr(FS) : `${fr(LA)} · ${fr(MDE)}`), donnee("wn · wOPN", `${pc(w)} · ${pc(wOPN)}`)],
        questions: [
          choixMelange(a, "Sable ou grave ?", [sable ? "S : la fraction 0,063/2 mm l'emporte" : "G : la fraction 2/63 mm l'emporte", sable ? "G : la fraction 2/63 mm l'emporte" : "S : la fraction 0,063/2 mm l'emporte", "on ne peut pas trancher sans le tamisat à 2 mm de 70 %"],
            `Fines ${pc(p63)} ≤ 15 % ; fraction 0,063/2 mm = ${pc(p2 - p63)}, fraction 2/63 mm = ${pc(100 - p2)} : ${sable ? "le sable l'emporte, S" : "la grave l'emporte, G"}. Le GTR 2024 compare les deux fractions ; le seuil de 70 % au tamis de 2 mm ne sert plus qu'aux états hydriques des sables.`),
          choixMelange(a, "Sous-classe de nature ?", [r.sousClasse, `${autre}${n}`, `${r.sousClasse[0]}${nv}`, `${autre}${nv}`], `Fines ${pc(p63)} : ${p63 <= 5 ? "≤ 5 %" : "de 5 à 15 %"} ; Cu = ${frd(Cu, 1)} ${Cu >= 6 ? "≥ 6, granulométrie étalée" : "< 6, granulométrie uniforme"} → ${r.sousClasse} (${SOUS_CLASSES[r.sousClasse]}).`),
          choixMelange(a, "Symbole complet au GTR 2024 ?", equilibre((x, y, z) => `${x}${y}${z}`, [r.sousClasse, `${autre}${nv}`], [comp, comp === "1" ? "2" : "1"], [r.etat, etatVoisin(a, r.etat)]),
            `${r.comportement} : comportement ${comp} (${sable ? `FS ${FS <= 60 ? "≤" : ">"} 60` : `LA et MDE ${comp === "1" ? "≤ 45" : ": l'un dépasse 45"}`}) ; insensible à l'eau ? ${etape(r, "Insensible").reponse} ; ${r.etat === "ins" ? "suffixe ins" : `état ${r.etat} (${etape(r, "État hydrique")?.detail ?? ""})`} → ${r.symbole}.`),
          choixMelange(a, `Dans un symbole comme ${a.choix(["G31h", "S42m", "G12ins", "S31s", "G42th"].filter((x) => x !== r.symbole))}, que dit le chiffre qui suit la sous-classe (S1 à S4, G1 à G4) ?`, ["le comportement mécanique : 1 si les grains résistent au trafic, 2 sinon", "l'étalement de la courbe granulométrique", "la propreté : fines à moins de 5 % ou non", "l'état hydrique du matériau"],
            `Un symbole se lit de gauche à droite : gros éléments, nature (ici ${r.sousClasse}), comportement (ici ${comp}), puis état ou « ins ». Le comportement n'est indiqué que pour les sables et les graves, quand l'essai (${sable ? "FS" : "LA et MDE"}) a été fait ; il ne sert qu'à l'emploi en couche de forme.`),
        ],
      };
    },
  },
  {
    id: "ch5-ins", titre: "Sable ou grave insensible à l'eau ?", difficulte: 2,
    generer(a) {
      // Cas visés : chacune des règles d'insensibilité, et des matériaux qui n'en remplissent aucune.
      const CAS = [
        ["S", [1.5, 4.6], [0.03, 0.19], [8, 40]], ["G", [1.5, 4.6], [0.03, 0.19], [8, 40]], ["S", [5.4, 9.6], [0.03, 0.09], [8, 40]],
        ["S", [10.4, 11.6], [0.03, 0.09], [21.5, 45]], ["G", [5.4, 9.6], [0.11, 0.19], [21.5, 45]], ["G", [10.4, 11.6], [0.03, 0.09], [21.5, 45]],
        ["S", [5.4, 9.6], [0.11, 0.19], [21.5, 45]], ["G", [5.4, 9.6], [0.11, 0.19], [6, 18.5]], ["S", [10.4, 11.6], [0.03, 0.09], [6, 18.5]], ["G", [2, 9.6], [0.22, 0.5], [21.5, 45]],
      ];
      let cl, p63, VBS, F25, F5, CBRi, s, r, r92, e92, p2, Cu, w, wOPN;
      for (let essai = 0; essai < 60; essai++) {
        const [c, fF, fV, fC] = a.choix(CAS);
        cl = c; p63 = a.entre(...fF, 0.1); VBS = a.entre(...fV, 0.01);
        const cible = a.entre(...fC, 0.5);
        F5 = Math.round(cible * REFERENCE_CBR[5]) / 100; F25 = Math.round(F5 * a.entre(0.5, 0.64, 0.01) * 100) / 100;
        CBRi = Math.max((100 * F25) / REFERENCE_CBR[2.5], (100 * F5) / REFERENCE_CBR[5]);
        s = insensible(cl, { p63um: p63, VBS, CBRi });
        p2 = cl === "S" ? a.entre(76, 96, 1) : a.entre(22, 48, 1); Cu = a.entre(cl === "S" ? 2.5 : 8, cl === "S" ? 12 : 40, 0.5);
        wOPN = a.entre(6, 11, 0.1); w = arrondi(wOPN * a.entre(0.7, 1.2, 0.01));
        r = classerSol({ Dmax: cl === "S" ? 5 : 31.5, p63um: p63, p2mm: p2, Cu, VBS, CBRi, w, wOPN });
        e92 = { Dmax: cl === "S" ? 5 : 31.5, p80um: arrondi(p63 + 1), p2mm: p2, VBS, w, wOPN };
        r92 = classerSol1992(e92);
        if (r.applicable && r92.applicable && loin(CBRi, [20], 0.6) && loin(Cu, [6], 0.4) && loin(w / wOPN, [0.9, 1.1], 0.015)) break;
      }
      const vrai = s.ins ? `oui : ${s.motif}` : `non : ${s.motif}`;
      const faux = [s.ins ? "non : aucun critère d'insensibilité à l'eau n'est rempli" : "oui : un CBRi supérieur à 20 suffit", "oui : moins de 12 % de fines et une VBS inférieure à 0,2 suffisent", `non : un${cl === "S" ? " sable" : "e grave"} n'est jamais insensible à l'eau`];
      return {
        enonce: `${cl === "S" ? "Un sable" : "Une grave"} (fraction 0/63 mm) a ${pc(p63)} de fines au tamis de 63 µm (${pc(p63 + 1)} à 80 µm) et une valeur de bleu VBS = ${frd(VBS, 2)} ; tamisat à 2 mm ${pc(p2, 0)}, Cu = ${frd(Cu, 1)}. Après quatre jours d'immersion, le poinçonnement lit ${frd(F25, 2)} kN à 2,5 mm et ${frd(F5, 2)} kN à 5 mm. Teneur en eau naturelle ${pc(w)}, optimum à ${pc(wOPN)}.`,
        donnees: [donnee("Fines", `${pc(p63)} (63 µm) · ${pc(p63 + 1)} (80 µm)`), donnee("VBS", frd(VBS, 2)), donnee("Passant 2 mm · Cu", `${pc(p2, 0)} · ${frd(Cu, 1)}`), donnee("Immersion : F 2,5 · 5 mm", `${frd(F25, 2)} · ${frd(F5, 2)} kN`), donnee("wn · wOPN", `${pc(w)} · ${pc(wOPN)}`)],
        questions: [
          nombre("Indice CBR après immersion (CBRi) ?", CBRi, "", `max(100 × ${frd(F25, 2)}/13,35 ; 100 × ${frd(F5, 2)}/20) = ${frd(CBRi, 1)}.`, { rel: 0.02 }),
          choixMelange(a, `Au GTR 2024, ce${cl === "S" ? " sable" : "tte grave"} est-${cl === "S" ? "il" : "elle"} insensible à l'eau ?`, [vrai, ...faux.filter((x) => x !== vrai)],
            `${cl === "S" ? "Sables : fines ≤ 5 % et VBS < 0,2 ; ou 5 à 10 % et VBS < 0,1 ; ou VBS < 0,1, fines < 12 % et CBRi > 20." : "Graves : fines ≤ 5 % et VBS < 0,2 ; ou 5 à 10 % et VBS < 0,1 ; ou 5 à 10 %, 0,1 ≤ VBS < 0,2 et CBRi > 20 ; ou 10 à 12 %, VBS < 0,1 et CBRi > 20."} Ici : ${s.ins ? s.motif : "aucune de ces conditions n'est remplie"}.`),
          choixMelange(a, "Symbole au GTR 2024 ?", equilibre((x, y) => `${x}${y}`, [r.sousClasse, voisine(a, r.sousClasse)], [r.etat, r.etat === "ins" ? etatHydrique(cleEtats(r.sousClasse, p2), { w, wOPN }).etat : "ins"]),
            `${etape(r, "Fines ≤ 5 %").reponse} ; ${s.ins ? "insensible : suffixe ins à la place de l'état" : `sensible à l'eau : état ${r.etat} (${etape(r, "État hydrique").detail})`} → ${r.symbole}.`),
          choixMelange(a, "Au GTR 1992, le même matériau était…", [r92.symbole, ...leurres(a, classerSol1992, e92, [{ VBS: 0.05 }, { VBS: 0.15 }, { VBS: 0.6 }, { p80um: 14, VBS: 0.6 }, { p80um: 14, VBS: 2 }], r92.symbole)],
            `GTR 1992 : classe D (insensible) si VBS ≤ 0,1 et fines à 80 µm ≤ 12 % ; sinon B1 à B4 selon le tamisat à 2 mm et la VBS (seuil 0,2). Ici → ${r92.symbole}.${(r92.classe === "D") !== Boolean(s.ins) ? " Les deux éditions ne jugent pas l'insensibilité de la même façon : le GTR 2024 a des règles plus détaillées, qui font intervenir le CBRi." : ""}`),
        ],
      };
    },
  },
  {
    id: "ch5-vc", titre: "Sol à gros éléments : VC1, VC2 et l'ancien C", difficulte: 2,
    generer(a) {
      let forme, f63, f50, Dmax, p63, p2, Cu, VBS, LA, MDE, w, wOPN, r, r92, p80b, p2b;
      for (let essai = 0; essai < 60; essai++) {
        forme = a.choix(["anguleux", "anguleux", "roulés"]);
        f63 = forme === "roulés" ? a.entre(50, 92, 1) : a.reel() < 0.5 ? a.entre(36, 58, 1) : a.entre(82, 93, 1);
        f50 = f63 >= 82 && forme === "anguleux" ? f63 - a.entre(0, 1, 1) : f63 - a.entre(2, 6, 1); Dmax = a.entre(90, 300, 10);
        p63 = a.entre(3, 13, 0.5); p2 = a.entre(18, 45, 1); Cu = a.entre(10, 80, 1); VBS = a.entre(0.3, 1.4, 0.05);
        LA = a.entre(15, 60, 1); MDE = a.entre(10, 55, 1);
        wOPN = a.entre(5, 9, 0.1); w = arrondi(wOPN * a.entre(0.65, 1.3, 0.01));
        p80b = arrondi(((p63 + 1) * f63) / f50); p2b = arrondi((p2 * f63) / f50);
        r = classerSol({ Dmax, fraction063: f63, forme, p63um: p63, p2mm: p2, Cu, VBS, LA, MDE, w, wOPN });
        r92 = classerSol1992({ Dmax, fraction050: f50, forme, p80um: p80b, p2mm: p2b, VBS, LA, MDE, w, wOPN });
        if (r.applicable && r92.applicable && r.etat && r92.etat && r.comportement && r92.comportement && loin(p63, [5], 0.4) && loin(LA, [45], 1) && loin(MDE, [45], 1) && loin(w / wOPN, [0.9, 1.1, 1.25], 0.015) && p80b <= 12 && loin(f50, [60, 80], 1)) break;
      }
      const autreVc = r.vc === "VC1" ? "VC2" : "VC1";
      const regle = forme === "roulés" ? "éléments roulés : la fraction 0/63 mm gouverne le comportement, VC2"
        : f63 <= 60 ? `éléments anguleux et fraction 0/63 mm de ${f63} % (≤ 60 %) : les gros éléments forment un squelette, VC1` : `fraction 0/63 mm de ${f63} % (> 80 %) : elle gouverne le comportement, VC2`;
      return {
        enonce: `Un matériau d'éboulis ${forme === "roulés" ? "à éléments roulés (ancienne terrasse)" : "à éléments anguleux"} a un Dmax de ${fr(Dmax)} mm. La fraction 0/63 mm représente ${f63} % du total (la fraction 0/50 mm, ${fr(f50)} %). Sur la fraction 0/63 mm : ${pc(p63)} de fines (63 µm), ${pc(p2, 0)} de passant à 2 mm, Cu = ${fr(Cu)}, VBS = ${frd(VBS, 2)} ; LA = ${fr(LA)}, MDE = ${fr(MDE)}. Teneur en eau ${pc(w)} pour un optimum à ${pc(wOPN)}. Ramenés à la fraction 0/50 mm, les passants valent ${pc(p80b)} à 80 µm et ${pc(p2b, 0)} à 2 mm.`,
        donnees: [donnee("Dmax", `${fr(Dmax)} mm`), donnee("Éléments", forme), donnee("Fraction 0/63 · 0/50", `${f63} % · ${fr(f50)} %`), donnee("0/63 : fines · 2 mm", `${pc(p63)} · ${pc(p2, 0)}`), donnee("Cu · VBS", `${fr(Cu)} · ${frd(VBS, 2)}`), donnee("LA · MDE", `${fr(LA)} · ${fr(MDE)}`), donnee("wn · wOPN", `${pc(w)} · ${pc(wOPN)}`)],
        questions: [
          choixMelange(a, "Le matériau est-il VC1 ou VC2 ?", [r.vc, autreVc, "ni l'un ni l'autre : il se classe comme une roche"], `Dmax = ${fr(Dmax)} mm > 63 mm : sol VC ; ${regle}.`),
          choixMelange(a, "Symbole complet au GTR 2024 ?", equilibre((x, y, z) => `${x}${r.sousClasse}${y}${z}`, [r.vc, autreVc], [r.comportement.slice(-1), r.comportement.endsWith("1") ? "2" : "1"], [r.etat, etatVoisin(a, r.etat)]),
            `${r.vc}, puis la fraction 0/63 mm classée comme un sol : ${r.comportement ?? r.sousClasse} (${etape(r, "Fines ≤ 5 %").reponse.split(" ; ")[0]}, comportement par LA et MDE), état ${r.etat} → ${r.symbole}.`),
          choixMelange(a, "Au GTR 1992, le même matériau était…", equilibre((x, y, z) => `${x}${r92.sousClasse}${y}${z}`, [r92.c, r92.c === "C1" ? "C2" : "C1"], [r92.comportement.slice(-1), r92.comportement.endsWith("1") ? "2" : "1"], r92.etat ? [r92.etat, etatVoisin(a, r92.etat)] : ["", ""]),
            `GTR 1992 : Dmax > 50 mm, classe C ; C1 si les éléments sont roulés ou si la fraction 0/50 mm dépasse 80 %, C2 sinon → ${r92.c} ; la fraction 0/50 mm (fines à 80 µm ${pc(p80b)}) se classe ${r92.sousClasse} → ${r92.symbole}.`),
          choixMelange(a, "Ce qu'il faut retenir du passage de C à VC :", ["la numérotation s'inverse : C1 (fraction fine gouvernante) est devenu VC2", "rien n'a changé : C1 et VC1 désignent les mêmes matériaux", "les sols à gros éléments sont désormais classés comme des roches", "le seuil de Dmax est passé de 63 à 50 mm"],
            "Au GTR 1992, C1 désignait les matériaux roulés ou peu charpentés (la fraction 0/50 mm gouverne) et C2 les anguleux charpentés ; au GTR 2024, c'est VC2 et VC1 — et le Dmax de référence est passé de 50 à 63 mm."),
        ],
      };
    },
  },
  {
    id: "ch5-organique", titre: "Sol organique : perte au feu et double symbole", difficulte: 1,
    generer(a) {
      const cas = a.choix(["", "O1", "O1", "O2", "O3"]);
      const cible = cas === "" ? a.entre(0.5, 1.8, 0.1) : cas === "O1" ? a.entre(2.4, 5.6, 0.1) : cas === "O2" ? a.entre(6.5, 19, 0.1) : a.entre(22, 70, 1);
      const m1 = a.entre(15, 40, 0.01), m2 = arrondi(m1 * (1 - cible / 100), 2), MO = (100 * (m1 - m2)) / m1;
      const p63 = a.entre(40, 90, 1), IP = a.entier(13, 30), wP = a.entier(16, 28), wL = wP + IP;
      const wOPN = a.entre(14, 24, 0.1), w = arrondi(wOPN * a.entre(0.92, 1.08, 0.01));
      const r = classerSol({ Dmax: 10, p63um: p63, IP, wL, wP, w, wOPN, MO });
      const org = r.organique ?? "";
      const libOrg = { "": "pas de préfixe : MO ≤ 2 %, le sol se classe normalement", O1: "O1 : faible teneur (2 à 6 %)", O2: "O2 : teneur modérée (6 à 20 %)", O3: "O3 : tourbe (plus de 20 %)" };
      const mineral = classerSol({ Dmax: 10, p63um: p63, IP, wL, wP, w, wOPN });
      const symboles = org === "O3" ? equilibre((x, y) => `${x}${y}`, ["O3", "O2"], ["", mineral.symbole])
        : equilibre((x, y) => `${x}${mineral.sousClasse}${y}`, [org, a.choix(["", "O1", "O2"].filter((x) => x !== org))], [mineral.etat, etatVoisin(a, mineral.etat)]);
      return {
        enonce: `Une perte au feu à 550 °C (NF EN 17685-1) est faite sur un sol fin de fond de vallée : l'échantillon séché à 105 °C pèse ${frd(m1, 2)} g, ${frd(m2, 2)} g après calcination. Sa partie minérale a ${p63} % de fines, wL = ${wL} %, wP = ${wP} % ; teneur en eau ${pc(w)} pour un optimum à ${pc(wOPN)}.`,
        donnees: [donnee("Avant calcination", `${frd(m1, 2)} g`), donnee("Après 550 °C", `${frd(m2, 2)} g`), donnee("Fines · wL · wP", `${p63} % · ${wL} % · ${wP} %`), donnee("wn · wOPN", `${pc(w)} · ${pc(wOPN)}`)],
        questions: [
          nombre("Teneur en matières organiques ?", MO, "%", `MO = 100 × (${frd(m1, 2)} − ${frd(m2, 2)}) / ${frd(m1, 2)} = ${pc(MO, 2)} — en se méfiant des matériaux qui perdent aussi de l'eau de constitution à 550 °C (gypse, certaines argiles).`, { abs: 0.1 }),
          choixMelange(a, "Classe vis-à-vis des matières organiques ?", [libOrg[org], ...Object.entries(libOrg).filter(([k]) => k !== org).map(([, v]) => v)],
            `Jusqu'à 2 %, classement normal ; O1 de 2 à 6 %, O2 de 6 à 20 %, O3 au-delà (tourbe) [F1 § 2.4.1]. MO = ${pc(MO, 2)} → ${org || "pas de préfixe"}.`),
          choixMelange(a, "Symbole au GTR 2024 ?", symboles,
            org === "O3" ? "Au-delà de 20 %, c'est une tourbe : O3, sans autre classement — ni remblai ni couche de forme." : `${org ? `Préfixe ${org}, puis` : "Pas de préfixe ;"} la partie minérale se classe comme un sol ordinaire : ${mineral.symbole} (IP = ${IP} → ${mineral.sousClasse}, état ${mineral.etat}) → ${r.symbole}.`),
          choixMelange(a, "Peut-on l'employer en remblai ?", [EMPLOI_REMBLAI[org], ...Object.values(EMPLOI_REMBLAI).filter((x) => x !== EMPLOI_REMBLAI[org])],
            `${org || "Sol sans préfixe"} : ${EMPLOI_REMBLAI[org]}. Les matières organiques se décomposent et font tasser le remblai.`),
          choixMelange(a, "Et en couche de forme ?", [EMPLOI_CDF(org, MO), ...["oui", "seulement après une étude particulière (dès 3 %)", "non", "oui, sous 3 % de matières organiques"].filter((x) => x !== EMPLOI_CDF(org, MO))].slice(0, 4),
            `Couche de forme : ${EMPLOI_CDF(org, MO)}. Leur acidité perturbe aussi la prise des liants : un sol organique se traite mal.`),
        ],
      };
    },
  },
  {
    id: "ch5-bascule", titre: "Un seuil qui a changé entre 1992 et 2024", difficulte: 2,
    generer(a) {
      const cas = a.choix(Object.keys(BASCULES));
      let e24, e92, enonce, donnees;
      if (cas === "IP") {
        const IP = a.entier(23, 25), wP = a.entier(18, 28), f = a.entier(50, 90);
        e24 = { Dmax: 5, p63um: f, IP }; e92 = { Dmax: 5, p80um: f + 2, IP };
        enonce = `Un limon argileux a ${f} % de passant à 63 µm (${f + 2} % à 80 µm) et des limites wL = ${wP + IP} %, wP = ${wP} %.`;
        donnees = [donnee("Fines", `${f} % · ${f + 2} %`), donnee("wL · wP", `${wP + IP} · ${wP} %`)];
      } else if (cas === "fines") {
        const p80 = a.entre(12.5, 15, 0.5), p63 = arrondi(p80 - a.entre(1, 2.5, 0.5)), sable = a.reel() < 0.5;
        const p2 = sable ? a.entre(76, 92, 1) : a.entre(28, 48, 1), Cu = a.entre(12, 45, 1), VBS = a.entre(0.4, 1.4, 0.05);
        e24 = { Dmax: sable ? 5 : 31.5, p63um: p63, p2mm: p2, Cu, VBS }; e92 = { Dmax: sable ? 5 : 31.5, p80um: p80, p2mm: p2, VBS };
        enonce = `Un${sable ? " sable" : "e grave"} limoneu${sable ? "x" : "se"} a ${pc(p63)} de passant à 63 µm et ${pc(p80)} à 80 µm, ${pc(p2, 0)} de passant à 2 mm, Cu = ${fr(Cu)} et VBS = ${frd(VBS, 2)}.`;
        donnees = [donnee("Fines", `${pc(p63)} (63 µm) · ${pc(p80)} (80 µm)`), donnee("Passant 2 mm", pc(p2, 0)), donnee("Cu · VBS", `${fr(Cu)} · ${frd(VBS, 2)}`)];
      } else if (cas === "Dmax") {
        const Dmax = a.entre(52, 62, 1), f50 = a.entre(88, 97, 1), p63 = a.entre(5.5, 11, 0.5), p2 = a.entre(25, 45, 1), Cu = a.entre(15, 60, 1), VBS = a.entre(0.3, 1.2, 0.05);
        e24 = { Dmax, p63um: p63, p2mm: p2, Cu, VBS }; e92 = { Dmax, fraction050: f50, forme: "anguleux", p80um: arrondi(((p63 + 1) * 100) / f50), p2mm: arrondi((p2 * 100) / f50), VBS };
        enonce = `Une grave concassée a un Dmax (D95) de ${fr(Dmax)} mm ; ${fr(f50)} % passent à 50 mm. Sur sa fraction 0/63 mm (le matériau entier) : ${pc(p63)} de fines à 63 µm, ${pc(p2, 0)} de passant à 2 mm, Cu = ${fr(Cu)}, VBS = ${frd(VBS, 2)} ; sur la fraction 0/50 mm : ${pc(e92.p80um)} à 80 µm et ${pc(e92.p2mm, 0)} à 2 mm.`;
        donnees = [donnee("Dmax", `${fr(Dmax)} mm`), donnee("Passant 50 mm", `${fr(f50)} %`), donnee("0/63 : fines · 2 mm", `${pc(p63)} · ${pc(p2, 0)}`), donnee("Cu · VBS", `${fr(Cu)} · ${frd(VBS, 2)}`)];
      } else if (cas === "VC") {
        const roules = a.reel() < 0.5, f63 = roules ? a.entre(60, 92, 1) : a.entre(38, 56, 1), f50 = f63 - a.entre(2, 5, 1), Dmax = a.entre(100, 250, 10);
        const p63 = a.entre(5.5, 11, 0.5), p2 = a.entre(25, 42, 1), Cu = a.entre(20, 80, 1), VBS = a.entre(0.3, 1.2, 0.05);
        const forme = roules ? "roulés" : "anguleux";
        e24 = { Dmax, fraction063: f63, forme, p63um: p63, p2mm: p2, Cu, VBS };
        e92 = { Dmax, fraction050: f50, forme, p80um: arrondi(((p63 + 1) * f63) / f50), p2mm: arrondi((p2 * f63) / f50), VBS };
        enonce = `Un matériau à éléments ${forme} a un Dmax de ${fr(Dmax)} mm ; sa fraction 0/63 mm représente ${f63} % du total (0/50 mm : ${fr(f50)} %). Sur la fraction 0/63 mm : ${pc(p63)} de fines, ${pc(p2, 0)} de passant à 2 mm, Cu = ${fr(Cu)}, VBS = ${frd(VBS, 2)} ; sur la fraction 0/50 mm : ${pc(e92.p80um)} à 80 µm, ${pc(e92.p2mm, 0)} à 2 mm.`;
        donnees = [donnee("Dmax · éléments", `${fr(Dmax)} mm · ${forme}`), donnee("Fraction 0/63 · 0/50", `${f63} % · ${fr(f50)} %`), donnee("0/63 : fines · 2 mm", `${pc(p63)} · ${pc(p2, 0)}`), donnee("Cu · VBS", `${fr(Cu)} · ${frd(VBS, 2)}`)];
      } else {
        // Insensibilité : un sable très propre mais à fines un peu actives, ou à fines nombreuses mais inactives.
        const propre = a.reel() < 0.5;
        const p63 = propre ? a.entre(2, 4.5, 0.5) : a.entre(10.5, 11.5, 0.5), VBS = propre ? a.entre(0.12, 0.19, 0.01) : a.entre(0.04, 0.09, 0.01);
        const p80 = arrondi(p63 + (propre ? 0.5 : 0.5)), p2 = a.entre(78, 95, 1), Cu = a.entre(2.5, 5, 0.5);
        e24 = { Dmax: 5, p63um: p63, p2mm: p2, Cu, VBS }; e92 = { Dmax: 5, p80um: p80, p2mm: p2, VBS };
        enonce = `Un sable de rivière a ${pc(p63)} de passant à 63 µm (${pc(p80)} à 80 µm), ${pc(p2, 0)} de passant à 2 mm, Cu = ${frd(Cu, 1)} et VBS = ${frd(VBS, 2)} ; aucun CBR immergé n'a été fait.`;
        donnees = [donnee("Fines", `${pc(p63)} · ${pc(p80)}`), donnee("Passant 2 mm · Cu", `${pc(p2, 0)} · ${frd(Cu, 1)}`), donnee("VBS", frd(VBS, 2)), donnee("CBRi", "non mesuré")];
      }
      const r24 = classerSol(e24), r92 = classerSol1992(e92);
      const lib24 = r24.symbole, lib92 = r92.symbole;
      // Leurres de chaque édition : ils ne contiennent jamais la réponse de l'autre question.
      const L92 = { IP: ["A1", "A3", "A4"], fines: ["B3", "B4", "B6", "B1", "B2"], Dmax: ["B3", "B4", "C2B3", "C2B4", "C1B3", "C1B4", "C1B5"], VC: ["C1B3", "C2B3", "C1B4", "C2B4", "C1B5", "C2B5"], ins: ["D1", "B1", "B2", "D2"] };
      const L24 = { IP: ["F1", "F2", "F4"], fines: ["S1", "S4", "G1", "G4", "I1", "S3", "G3"], Dmax: ["VC1G3", "VC2G3", "G1", "G4", "G3ins"], VC: ["VC1G3", "VC2G3", "VC1G4", "VC2G4", "VC1G1"], ins: ["S2ins", "S4", "S2", "S4ins", "S1ins"] };
      return {
        enonce: `${enonce} On le classe aux deux éditions du guide.`,
        donnees,
        questions: [
          choixMelange(a, "Classe au GTR 1992 (NF P11-300) ?", [lib92, ...a.tirage(L92[cas].filter((x) => x !== lib92), 3)],
            `${r92.arbre.filter((x) => !x.question.startsWith("État")).map((x) => `${x.question} ${x.reponse}`).join(" ; ")}.`),
          choixMelange(a, "Classe au GTR 2024 (NF EN 16907-2) ?", [lib24, ...a.tirage(L24[cas].filter((x) => x !== lib24), 3)],
            `${r24.arbre.filter((x) => !x.question.startsWith("État")).map((x) => `${x.question} ${x.reponse}`).join(" ; ")}.`),
          choixMelange(a, "Qu'est-ce qui fait basculer ce sol d'une classe à l'autre ?", [BASCULES[cas], ...a.tirage(Object.values(BASCULES).filter((x) => x !== BASCULES[cas]), 3)],
            `${BASCULES[cas].charAt(0).toUpperCase() + BASCULES[cas].slice(1)} : ${lib92} en 1992, ${lib24} en 2024. Quand on reprend une étude ancienne, on reclasse à partir des essais, jamais par simple traduction des lettres.`),
        ],
      };
    },
  },
  {
    id: "ch5-deux-editions", titre: "Une courbe, deux classements", difficulte: 3,
    generer(a) {
      const TAMIS = [0.063, 0.08, 0.5, 2, 10, 31.5, 50, 63, 80, 125, 200];
      const melange = (pops) => (d) => pops.reduce((s, [p, d50, k]) => s + p / (1 + (d50 / d) ** k), 0);
      let pts, an, VBS, w, wOPN, r24, r92, e24, e92;
      for (let essai = 0; essai < 80; essai++) {
        const w1 = a.choix([a.entre(0.06, 0.16, 0.01), a.entre(0.18, 0.3, 0.01), a.entre(0.38, 0.55, 0.01)]);
        const part = a.entre(0.15, 0.85, 0.01), gros = a.reel() < 0.4;
        const P = melange([[w1, a.entre(0.008, 0.03, 0.001), 1.3], [(1 - w1) * part, a.entre(0.2, 0.8, 0.01), a.entre(1.4, 2.4, 0.05)], [(1 - w1) * (1 - part), gros ? a.entre(14, 30, 1) : a.entre(4, 10, 0.5), a.entre(1.6, 2.6, 0.05)]]);
        const top = P(gros ? 200 : 63);
        pts = TAMIS.map((d) => [d, arrondi(Math.min(100, (100 * P(d)) / top))]);
        pts = pts.slice(0, pts.findIndex(([, p]) => p >= 100) + 1);
        an = analyser(pts);
        VBS = an.p63um > 35 ? a.entre(1.6, 7.5, 0.1) : an.p63um > 12 ? a.entre(0.4, 2.8, 0.05) : a.entre(0.05, 1.2, 0.05);
        wOPN = a.entre(6, 18, 0.1); w = arrondi(wOPN * a.entre(0.7, 1.25, 0.01));
        e24 = { Dmax: an.Dmax, p63um: an.p63um, p2mm: an.p2mm, Cu: an.Cu, D60: an.D60, D10: an.D10, fractionSable: an.fractionSable, fractionGrave: an.fractionGrave, fraction063: an.passant63mm, forme: "anguleux", VBS, w, wOPN };
        e92 = { Dmax: an.Dmax, p80um: an.p80um, p2mm: an.p2mm50, VBS, w, wOPN, fraction050: an.passant50mm, forme: "anguleux" };
        r24 = classerSol(e24); r92 = classerSol1992(e92);
        const ok = r24.applicable && r92.applicable && !r24.avertissements.length && loin(an.p63um, [5, 10, 12, 15, 35], 0.4) && loin(an.p80um, [12, 35], 0.4)
          && loin(VBS, [0.1, 0.2, 1.5, 2.5, 6], 0.06) && loin(an.Dmax, [50, 63], 2) && loin(an.passant50mm, [60, 80], 2) && loin(w / wOPN, [0.9, 1.1, 1.25, 1.3], 0.015)
          && Math.abs(an.fractionSable - an.fractionGrave) >= 3 && (!Number.isFinite(an.Cu) || loin(an.Cu, [6], 0.4)) && loin(an.p2mm50, [70], 1.5);
        if (ok) break;
      }
      // Leurres : les mêmes classements relancés avec une autre VBS ou une autre teneur en eau.
      const ALTERATIONS = [{ VBS: 0.05 }, { VBS: 0.15 }, { VBS: 0.5 }, { VBS: 1.2 }, { VBS: 2 }, { VBS: 3.5 }, { VBS: 7 }, { w: 0.65 * wOPN }, { w: 0.85 * wOPN }, { w: wOPN }, { w: 1.15 * wOPN }, { w: 1.35 * wOPN }];
      const figure = courbeGranulo({
        largeur: 600, hauteur: 300, dMin: 0.02, dMax: 200,
        series: [
          { points: [[50, 0], [50, 100]], couleur: COULEURS.gtr92, tirets: "6 3", epaisseur: 1.4, libelle: "50 mm (GTR 1992)" },
          { points: [[0.08, 0], [0.08, 100]], couleur: COULEURS.gtr92, tirets: "6 3", epaisseur: 1.4 },
          { points: pts, couleur: COULEURS.bleu, epaisseur: 2.6, marqueurs: true, libelle: "passant cumulé, matériau total" },
        ],
      });
      return {
        enonce: `La courbe granulométrique d'un sol de déblai (matériau total) passe par les points ci-dessous ; le tamis de 80 µm a été ajouté à la série pour pouvoir le classer aussi au GTR 1992. VBS = ${frd(VBS, 2)} ; teneur en eau ${pc(w)} pour un optimum Proctor normal à ${pc(wOPN)} ; éléments anguleux.`,
        donnees: [...pts.map(([d, p]) => donnee(`${fr(d, 3)} mm`, pc(p))), donnee("VBS", frd(VBS, 2)), donnee("wn · wOPN", `${pc(w)} · ${pc(wOPN)}`)],
        figure,
        questions: [
          nombre("Tamisat à 80 µm rapporté à la fraction 0/50 mm ?", an.p80um, "%", `Passant à 50 mm : ${pc(an.passant50mm)} ; 100 × ${pc(pts[1][1])} / ${pc(an.passant50mm)} = ${pc(an.p80um)}.`, { abs: 0.4 }),
          nombre("Tamisat à 63 µm rapporté à la fraction 0/63 mm ?", an.p63um, "%", `Passant à 63 mm : ${pc(an.passant63mm)} ; 100 × ${pc(pts[0][1])} / ${pc(an.passant63mm)} = ${pc(an.p63um)}.`, { abs: 0.4 }),
          choixMelange(a, "Symbole au GTR 1992 ?", [r92.symbole, ...leurres(a, classerSol1992, e92, ALTERATIONS, r92.symbole)],
            `${r92.arbre.map((x) => `${x.question} ${x.reponse}`).join(" ; ")} → ${r92.symbole}.`),
          choixMelange(a, "Symbole au GTR 2024 ?", [r24.symbole, ...leurres(a, classerSol, e24, ALTERATIONS, r24.symbole)],
            `${r24.arbre.map((x) => `${x.question} ${x.reponse}`).join(" ; ")} → ${r24.symbole}.`),
        ],
      };
    },
  },
];
