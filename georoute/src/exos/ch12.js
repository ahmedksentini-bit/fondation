// Exercices du chapitre 12 : le traitement des sols à la chaux et aux liants
// hydrauliques — quantités à épandre et contrôle à la bâche, effet de la
// chaux vive sur la teneur en eau, aptitude au traitement, amélioration et
// stabilisation.
import { fr, frd, nombre, choixMelange, donnee } from "./alea.js";
import { quantite, chauxVive, dosagePour, aptitudeTraitement } from "../gtr/traitement.js";
import { etatHydrique, ETATS_2024, intervalle } from "../gtr/classification.js";
import { casPST } from "../gtr/pst.js";

/** Tire des données jusqu'à ce qu'elles conviennent ; au pire, le dernier tirage reste valable (réponses du solveur). */
function tirer(a, tirage, accepte, essais = 80) {
  let d;
  for (let i = 0; i < essais; i++) { d = tirage(a); if (accepte(d)) return d; }
  return d;
}
/** Partie fractionnaire loin d'un entier : un arrondi au-dessus ne dépend pas des décimales retenues. */
const loinEntier = (x, marge = 0.04) => { const f = x - Math.floor(x); return f > marge && f < 1 - marge; };

/** Temps du jour et part η de la chaleur d'hydratation qui vaporise de l'eau. */
const METEOS = [
  { texte: "temps couvert et humide", eta: 0.3 }, { texte: "temps doux, sans vent", eta: 0.4 },
  { texte: "temps doux et sec", eta: 0.5 }, { texte: "temps sec et ensoleillé", eta: 0.6 }, { texte: "temps sec et venté", eta: 0.7 },
];
/** Produits de traitement et plages de dosage courantes (% de la masse de sol sec). */
const PRODUITS = [
  { nom: "chaux vive", au: "à la chaux vive", du: "de la chaux vive", min: 1, max: 3, sol: "un limon humide", rho: [1.6, 1.8], v: [2.5, 4] },
  { nom: "ciment", au: "au ciment", du: "du ciment", min: 4, max: 7, sol: "un sable limoneux", rho: [1.85, 2.05], v: [1.5, 2.5] },
  { nom: "liant hydraulique routier", au: "au liant hydraulique routier", du: "du liant hydraulique routier", min: 4, max: 8, sol: "une grave silteuse", rho: [1.95, 2.15], v: [1.5, 2.5] },
];
const NOM_SOL = { F1: "limon peu plastique F1", F2: "limon argileux F2", F3: "argile F3", I1: "sable très silteux I1", I2: "sable argileux I2", S3: "sable limoneux S3" };

/** Sols fins et intermédiaires de l'exercice « état h » : plage de wOPN courante. */
const SOLS_H = [
  { cle: "F1", nom: "limon peu plastique F1", wOPN: [13, 17] }, { cle: "F2", nom: "limon argileux F2", wOPN: [15, 19] },
  { cle: "F3", nom: "argile F3", wOPN: [19, 25] }, { cle: "I1", nom: "sable très silteux I1", wOPN: [10, 13] },
  { cle: "I2", nom: "sable argileux I2", wOPN: [11, 14] },
];
const NOM_ETAT = { th: "très humide (th)", h: "humide (h)", m: "moyen (m)", s: "sec (s)", ts: "très sec (ts)" };

export default [
  {
    id: "ch12-quantite", titre: "Quantité de produit à épandre", difficulte: 1,
    generer(a) {
      const d = tirer(a, (a) => {
        const p = a.choix(PRODUITS);
        const dosage = a.entre(p.min, p.max, 0.5), rhoD = a.entre(p.rho[0], p.rho[1], 0.01), e = a.entre(0.25, 0.45, 0.05);
        const long = a.entre(400, 2000, 50), larg = a.entre(10, 14, 0.5), cap = a.choix([25, 26, 28, 30]);
        const r = quantite({ dosage, rhoD, e, surface: long * larg });
        return { p, dosage, rhoD, e, long, larg, cap, r };
      }, ({ r, cap }) => loinEntier(r.total / cap));
      const { p, dosage, rhoD, e, long, larg, cap, r } = d;
      const n = Math.ceil(r.total / cap);
      return {
        enonce: `On traite ${p.sol} ${p.au} à ${frd(dosage, 1)} % (en masse de sol sec), sur une épaisseur de ${frd(e, 2)} m compactée à ρd = ${frd(rhoD, 2)} Mg/m³. La bande à traiter mesure ${fr(long, 4)} m de long sur ${frd(larg, 1)} m de large ; le produit arrive en camions-citernes de ${cap} t.`,
        donnees: [donnee("Dosage", `${frd(dosage, 1)} %`), donnee("ρd · e", `${frd(rhoD, 2)} Mg/m³ · ${frd(e, 2)} m`), donnee("Surface", `${fr(long, 4)} × ${frd(larg, 1)} m`), donnee("Citerne", `${cap} t`)],
        questions: [
          nombre("Quantité de produit par mètre carré q ?", r.q, "kg/m²", `q = (dosage/100) × ρd × e = ${frd(dosage / 100, 3)} × ${fr(rhoD * 1000, 4)} kg/m³ × ${frd(e, 2)} m = ${frd(r.q, 2)} kg/m².`, { rel: 0.01 }),
          nombre("Masse totale de produit pour la bande ?", r.total, "t", `S = ${fr(long, 4)} × ${frd(larg, 1)} = ${fr(long * larg, 5)} m² ; ${frd(r.q, 2)} × ${fr(long * larg, 5)} / 1 000 = ${fr(r.total, 4)} t.`, { rel: 0.01 }),
          nombre("Nombre de citernes à commander ?", n, "", `${fr(r.total, 4)} / ${cap} = ${frd(r.total / cap, 2)} → ${n} citernes (on arrondit au-dessus).`, { abs: 0.5 }),
        ],
      };
    },
  },
  {
    id: "ch12-bache", titre: "Contrôle de l'épandage à la bâche", difficulte: 2,
    generer(a) {
      const d = tirer(a, (a) => {
        const p = a.choix(PRODUITS);
        const dosage = a.entre(p.min, p.max, 0.5), rhoD = a.entre(p.rho[0], p.rho[1], 0.01), e = a.entre(0.3, 0.45, 0.05);
        const q = quantite({ dosage, rhoD, e }).q;
        const m = Math.round(q * (1 + a.entre(-0.22, 0.18, 0.01)) * 10) / 10;
        return { p, dosage, rhoD, e, q, m, ecart: (100 * (m - q)) / q };
      }, ({ ecart }) => Math.abs(Math.abs(ecart) - 10) > 1 && Math.abs(ecart) >= 1);
      const { p, dosage, rhoD, e, q, m, ecart } = d;
      const q1 = quantite({ dosage: 1, rhoD, e }).q, mesure = m / q1;
      const DANS = "dosage dans le repère de ± 10 %", SOUS = "sous-dosage au-delà de 10 % : compléter l'épandage", SUR = "surdosage au-delà de 10 % : régler l'épandeur";
      const bonne = Math.abs(ecart) <= 10 ? DANS : ecart < 0 ? SOUS : SUR;
      return {
        enonce: `Traitement ${p.au}, dosé à ${frd(dosage, 1)} %, sur ${frd(e, 2)} m compactés à ρd = ${frd(rhoD, 2)} Mg/m³. Avant le passage de l'épandeur, on a posé une bâche de 1 m² sur la bande ; elle recueille ${frd(m, 1)} kg de produit. On prend ± 10 % comme repère de tolérance (la vraie tolérance est celle du marché).`,
        donnees: [donnee("Dosage visé", `${frd(dosage, 1)} %`), donnee("ρd · e", `${frd(rhoD, 2)} Mg/m³ · ${frd(e, 2)} m`), donnee("Pesée de la bâche (1 m²)", `${frd(m, 1)} kg`)],
        questions: [
          nombre("Quantité visée q ?", q, "kg/m²", `q = ${frd(dosage / 100, 3)} × ${fr(rhoD * 1000, 4)} × ${frd(e, 2)} = ${frd(q, 2)} kg/m².`, { rel: 0.01 }),
          nombre("Dosage réellement épandu ?", mesure, "%", `Un point de dosage vaut ${fr(rhoD * 1000, 4)} × ${frd(e, 2)} / 100 = ${frd(q1, 2)} kg/m² ; ${frd(m, 1)} / ${frd(q1, 2)} = ${frd(mesure, 2)} %.`, { rel: 0.015 }),
          nombre("Écart à la quantité visée, en % (négatif en cas de sous-dosage) ?", ecart, "%", `(${frd(m, 1)} − ${frd(q, 2)}) / ${frd(q, 2)} = ${ecart >= 0 ? "+" : "−"}${frd(Math.abs(ecart), 1)} %.`, { abs: 0.5 }),
          choixMelange(a, "Conclusion du contrôle ?", [bonne, ...[DANS, SOUS, SUR].filter((x) => x !== bonne)],
            `Écart de ${ecart >= 0 ? "+" : "−"}${frd(Math.abs(ecart), 1)} % → ${bonne}.${ecart < -10 ? " Un sol sous-dosé n'atteindra pas la portance ni la durabilité visées." : ecart > 10 ? " Le surdosage coûte, et peut rendre le mélange trop sec ou trop raide." : ""}`),
        ],
      };
    },
  },
  {
    id: "ch12-chaux-vive", titre: "Chaux vive : où passe l'eau ?", difficulte: 2,
    generer(a) {
      const w = a.entre(18, 32, 0.5), C = a.entre(1, 4, 0.5), met = a.choix(METEOS);
      const r = chauxVive({ w, dosage: C, eta: met.eta });
      const sol = a.choix(["un limon des plateaux", "une argile marneuse", "un sable argileux"]);
      return {
        enonce: `On traite ${sol} trop humide (w = ${frd(w, 1)} %) avec ${frd(C, 1)} % de chaux vive, par ${met.texte} : on estime que la part de la chaleur d'hydratation qui vaporise de l'eau vaut η = ${frd(met.eta, 1)}. Pour 100 g de sol sec, l'hydratation CaO + H₂O → Ca(OH)₂ consomme 0,32 g d'eau par gramme de chaux et ajoute 1,32 g de solide ; la chaleur (1,16 MJ/kg de CaO) vaporise 0,51 η g d'eau par gramme de chaux.`,
        donnees: [donnee("w initiale", `${frd(w, 1)} %`), donnee("Chaux vive", `${frd(C, 1)} %`), donnee("η", frd(met.eta, 1))],
        questions: [
          nombre("Eau fixée par l'hydratation (g pour 100 g de sol sec) ?", r.eauHydratation, "g", `18/56 = 0,32 g d'eau par gramme de CaO : 0,32 × ${frd(C, 1)} = ${frd(r.eauHydratation, 2)} g.`, { rel: 0.02 }),
          nombre("Eau vaporisée par la chaleur dégagée ?", r.eauEvaporee, "g", `0,51 η C = 0,51 × ${frd(met.eta, 1)} × ${frd(C, 1)} = ${frd(r.eauEvaporee, 2)} g.`, { rel: 0.02 }),
          nombre("Teneur en eau après traitement w' ?", r.wFinal, "%", `w' = (w − 0,32 C − 0,51 η C)/(100 + 1,32 C) × 100 = (${frd(w, 1)} − ${frd(r.eauHydratation, 2)} − ${frd(r.eauEvaporee, 2)})/${frd(100 + 1.321 * C, 2)} × 100 = ${frd(r.wFinal, 2)} %.`, { abs: 0.15 }),
          nombre("Baisse de teneur en eau par % de chaux ?", r.baisse / C, "point", `(${frd(w, 1)} − ${frd(r.wFinal, 2)}) / ${frd(C, 1)} = ${frd(r.baisse / C, 2)} point par % de chaux, dont ${frd(r.dilution / C, 2)} dû à la seule matière sèche ajoutée. La règle de chantier dit « environ un point » ; le malaxage par temps sec et venté aère encore le sol.`, { rel: 0.03 }),
        ],
      };
    },
  },
  {
    id: "ch12-etat-h", titre: "Ramener un sol à l'état moyen à la chaux vive", difficulte: 3,
    generer(a) {
      const d = tirer(a, (a) => {
        const s = a.choix(SOLS_H);
        const lignes = ETATS_2024[s.cle].lignes, lh = intervalle(lignes.find((l) => l.etat === "h").r);
        const wOPN = a.entre(s.wOPN[0], s.wOPN[1], 0.5);
        const r0 = lh.a + (lh.b - lh.a) * a.entre(0.25, 0.75, 0.05);
        const w = Math.round(r0 * wOPN * 10) / 10, met = a.choix(METEOS);
        const wVise = lh.a * wOPN, dos = dosagePour({ w, wVise, eta: met.eta });
        return { s, lh, wOPN, w, met, wVise, dos };
      }, ({ dos, w, wOPN, s, lh }) => typeof dos === "number" && dos >= 0.8 && dos <= 4.5 && loinEntier(dos * 2, 0.06)
        && Math.abs(w / wOPN - lh.a) > 0.01 && Math.abs(w / wOPN - lh.b) > 0.01 && etatHydrique(s.cle, { w, wOPN }).etat === "h");
      const { s, lh, wOPN, w, met, wVise, dos } = d;
      const et = etatHydrique(s.cle, { w, wOPN });
      const retenu = Math.ceil(dos * 2) / 2;
      const rhoD = a.entre(1.55, 1.75, 0.01), e = a.entre(0.3, 0.4, 0.05);
      const q = quantite({ dosage: retenu, rhoD, e }).q;
      const k = 0.321 + 0.513 * met.eta + 0.01321 * wVise;
      return {
        enonce: `Un ${s.nom} doit entrer en remblai ; à l'extraction, sa teneur en eau vaut w = ${frd(w, 1)} % pour un optimum Proctor normal wOPN = ${frd(wOPN, 1)} %. On veut le ramener juste à l'état moyen par un traitement d'amélioration à la chaux vive, par ${met.texte} (η = ${frd(met.eta, 1)}), sur des couches de ${frd(e, 2)} m compactées à ρd ≈ ${frd(rhoD, 2)} Mg/m³. On néglige le déplacement de l'optimum dû à la chaux.`,
        donnees: [donnee("Sol", s.nom), donnee("w · wOPN", `${frd(w, 1)} % · ${frd(wOPN, 1)} %`), donnee("η", frd(met.eta, 1)), donnee("ρd · e", `${frd(rhoD, 2)} Mg/m³ · ${frd(e, 2)} m`)],
        questions: [
          nombre("Rapport wn/wOPN à l'extraction ?", et.r, "", `wn/wOPN = ${frd(w, 1)}/${frd(wOPN, 1)} = ${frd(et.r, 3)} ; pour un ${s.cle}, l'état est ${NOM_ETAT.h} si ${frd(lh.a, 2)} ≤ wn/wOPN < ${frd(lh.b, 2)} [F2 annexe 1] → état ${NOM_ETAT[et.etat]}.`, { rel: 0.01 }),
          nombre("Teneur en eau à atteindre pour l'état moyen ?", wVise, "%", `Limite basse de l'état h : wn = ${frd(lh.a, 2)} wOPN = ${frd(lh.a, 2)} × ${frd(wOPN, 1)} = ${frd(wVise, 2)} %.`, { rel: 0.01 }),
          nombre("Dosage minimal en chaux vive ?", dos, "%", `En résolvant w' = (w − 0,32 C − 0,51 η C)/(100 + 1,32 C) × 100 = ${frd(wVise, 2)} : C = (w − w')/(0,32 + 0,51 η + 0,0132 w') = (${frd(w, 1)} − ${frd(wVise, 2)})/${frd(k, 3)} = ${frd(dos, 2)} %.`, { rel: 0.04 }),
          nombre("Quantité à épandre, dosage arrondi au demi-point supérieur ?", q, "kg/m²", `Dosage retenu ${frd(retenu, 1)} % ; q = ${frd(retenu / 100, 3)} × ${fr(rhoD * 1000, 4)} × ${frd(e, 2)} = ${frd(q, 2)} kg/m², à contrôler à la bâche.`, { rel: 0.02 }),
        ],
      };
    },
  },
  {
    id: "ch12-aptitude", titre: "Aptitude d'un sol au traitement", difficulte: 1,
    generer(a) {
      const d = tirer(a, (a) => {
        const cas = a.choix(["apte", "douteuxGv", "douteuxR", "inapteGv", "inapteR"]);
        const Gv0 = cas === "douteuxGv" ? a.entre(5.6, 9.4, 0.1) : cas === "inapteGv" ? a.entre(10.6, 15, 0.1) : cas === "inapteR" ? a.entre(1, 9, 0.1) : a.entre(0.6, 4.4, 0.1);
        const R0 = cas === "douteuxR" ? a.entre(0.11, 0.19, 0.01) : cas === "inapteR" ? a.entre(0.03, 0.09, 0.01) : cas === "inapteGv" ? a.entre(0.12, 0.35, 0.01) : a.entre(0.22, 0.45, 0.01);
        const Gv = [0, 1, 2].map(() => Math.round(Gv0 * (1 + a.entre(-0.1, 0.1, 0.01)) * 10) / 10);
        const R = [0, 1, 2].map(() => Math.max(0.01, Math.round(R0 * (1 + a.entre(-0.1, 0.1, 0.01)) * 100) / 100));
        const mG = (Gv[0] + Gv[1] + Gv[2]) / 3, mR = (R[0] + R[1] + R[2]) / 3;
        return { Gv, R, mG, mR };
      }, ({ mG, mR }) => Math.abs(mG - 5) > 0.3 && Math.abs(mG - 10) > 0.3 && Math.abs(mR - 0.1) > 0.008 && Math.abs(mR - 0.2) > 0.008);
      const { Gv, R, mG, mR } = d;
      const r = aptitudeTraitement({ Gv: mG, Rtb: mR });
      const produit = a.choix(["à la chaux et au ciment", "au liant hydraulique routier", "au ciment"]);
      const sol = a.choix(["une argile marneuse", "un limon d'altération", "un sable argileux", "une marne"]);
      const suite = {
        apte: "étude de formulation : fixer le produit et le dosage",
        douteux: "changer de produit ou de dosage, ou rechercher la cause (sulfates, matières organiques) avant de conclure",
        inapte: "renoncer à traiter ce sol avec ce produit",
      };
      return {
        enonce: `Pour savoir si l'on peut traiter ${sol} ${produit}, on a confectionné trois éprouvettes du mélange, conservées puis immergées (NF P94-100). On mesure leur gonflement volumique Gv (${Gv.map((x) => frd(x, 1)).join(" ; ")} %) et leur résistance en traction indirecte après immersion Rtb (${R.map((x) => frd(x, 2)).join(" ; ")} MPa). Critères usuels : apte si Gv ≤ 5 % et Rtb ≥ 0,2 MPa, inapte si Gv > 10 % ou Rtb < 0,1 MPa, douteux entre les deux.`,
        donnees: [donnee("Gv (%)", Gv.map((x) => frd(x, 1)).join(" · ")), donnee("Rtb (MPa)", R.map((x) => frd(x, 2)).join(" · "))],
        questions: [
          nombre("Gonflement volumique moyen Gv ?", mG, "%", `(${Gv.map((x) => frd(x, 1)).join(" + ")}) / 3 = ${frd(mG, 2)} %.`, { rel: 0.02 }),
          nombre("Résistance moyenne Rtb ?", mR, "MPa", `(${R.map((x) => frd(x, 2)).join(" + ")}) / 3 = ${frd(mR, 3)} MPa.`, { rel: 0.02 }),
          choixMelange(a, "Verdict sur l'aptitude au traitement ?", [r.verdict, ...["apte", "douteux", "inapte"].filter((x) => x !== r.verdict)],
            `Gv = ${frd(mG, 2)} % et Rtb = ${frd(mR, 3)} MPa : ${r.verdict} (${r.motif}).`),
          choixMelange(a, "Et ensuite ?", [suite[r.verdict], ...Object.values(suite).filter((x) => x !== suite[r.verdict])],
            `Sol ${r.verdict} → ${suite[r.verdict]}. Pyrite, sulfates, smectites ou matières organiques peuvent faire gonfler un sol traité ou gêner la prise : c'est ce que l'essai d'aptitude détecte.`),
        ],
      };
    },
  },
  {
    id: "ch12-pst4", titre: "Améliorer ou stabiliser : ce que devient la PST", difficulte: 2,
    generer(a) {
      const sc = a.choix(["F1", "F2", "F3", "I1", "I2", "S3"]), etat = a.choix(["h", "m"]);
      const nappe = etat === "m" ? a.choix(["non", "risque"]) : "non";
      const traitement = a.choix(["amelioration", "stabilisation", "stabilisation"]);
      const eT = traitement === "stabilisation" ? a.choix(etat === "h" ? [0.35, 0.5, 0.7, 0.7] : [0.35, 0.4, 0.5]) : 0;
      const avant = casPST({ sousClasse: sc, etat, nappe }), apres = casPST({ sousClasse: sc, etat, nappe, traitement, eTraitee: eT });
      const scenario = traitement === "amelioration"
        ? `on prévoit d'épandre 1,5 % de chaux vive et de la malaxer à la charrue, pour assécher le sol et permettre la circulation des engins et le compactage`
        : `on prévoit un traitement à la chaux puis au liant hydraulique sur ${frd(eT, 2)} m${eT >= 0.7 ? " (en deux couches)" : ""}, malaxé au pulvérisateur, avec des dosages fixés par une étude de formulation qui vérifie la tenue à l'immersion et au gel, et un drainage en pied de chaussée`;
      const PST = ["PST0", "PST1", "PST2", "PST3", "PST4", "PST5", "PST6"];
      const voisins = (p) => { const i = PST.indexOf(p); return [i + 1, i - 1, i + 2, i - 2, i + 3, i - 3].filter((j) => j >= 0 && j <= 4).slice(0, 3).map((j) => PST[j]); };
      const AMEL = "une amélioration : action à court terme, pour la mise en œuvre", STAB = "une stabilisation : résistance durable, à l'eau et au gel";
      const bonneT = traitement === "amelioration" ? AMEL : STAB;
      const arTxt = (r) => r.ar.join(" ou ");
      const arOptions = [...new Set([arTxt(apres), "AR1", "AR2", "AR1 ou AR2", "AR0"])].slice(0, 4);
      return {
        enonce: `Le mètre supérieur d'un déblai est un ${NOM_SOL[sc]} en état ${NOM_ETAT[etat]}${etat === "m" ? (nappe === "risque" ? ", exposé à une remontée de nappe" : ", sans risque de remontée de nappe (drainage profond)") : ""}. Pour la partie supérieure des terrassements, ${scenario}.`,
        donnees: [donnee("Sol de la PST", `${sc} · état ${etat}`), donnee("Nappe", nappe === "risque" ? "remontée possible" : "pas de remontée"), donnee("Traitement", traitement === "amelioration" ? "1,5 % de chaux vive" : `chaux + liant sur ${frd(eT, 2)} m`)],
        questions: [
          choixMelange(a, "Ce traitement est :", [bonneT, bonneT === AMEL ? STAB : AMEL],
            `${bonneT === AMEL ? "Assécher et rendre traficable et compactable, c'est agir à court terme" : "Une résistance durable, vérifiée par une étude et contrôlée, c'est stabiliser"} → ${bonneT} [F1 § 4.3.1].`),
          choixMelange(a, "Cas de PST du sol non traité ?", [avant.pst, ...voisins(avant.pst)], `Sans traitement : ${avant.pst}, ${avant.motif} (arase ${arTxt(avant)}).`),
          choixMelange(a, "Cas de PST après le traitement prévu ?", [apres.pst, ...voisins(apres.pst).filter((x) => x !== apres.pst)],
            `${apres.pst === "PST4" ? `${apres.pst} : ${apres.motif}.` : `${apres.pst} : ${apres.avertissements.join(" ")}`}`),
          choixMelange(a, "Classe d'arase à long terme après traitement ?", [arTxt(apres), ...arOptions.filter((x) => x !== arTxt(apres))].slice(0, 4),
            `${apres.pst} → arase ${arTxt(apres)} (${apres.modules.map((m) => `${m} MPa`).join(" ou ")}). Seule la stabilisation donne la PST4 et l'AR2 ; le sol amélioré reste, pour le tableau des PST, un sol non traité.`),
        ],
      };
    },
  },
  {
    id: "ch12-epandeur", titre: "Régler et approvisionner l'épandeur", difficulte: 2,
    generer(a) {
      const d = tirer(a, (a) => {
        const p = a.choix(PRODUITS);
        const dosage = a.entre(p.min, p.max, 0.5), rhoD = a.entre(p.rho[0], p.rho[1], 0.01), e = a.entre(0.3, 0.45, 0.05);
        const Ce = a.entre(8, 14, 1), le = a.choix([2.4, 2.5]), v = a.entre(p.v[0], p.v[1], 0.5);
        const long = a.entre(500, 1500, 50), larg = a.entre(9, 13, 0.5);
        const r = quantite({ dosage, rhoD, e, surface: long * larg });
        return { p, dosage, rhoD, e, Ce, le, v, long, larg, r };
      }, ({ r, Ce }) => loinEntier(r.total / Ce));
      const { p, dosage, rhoD, e, Ce, le, v, long, larg, r } = d;
      const Lplein = (Ce * 1000) / (r.q * le), pleins = Math.ceil(r.total / Ce), debit = (r.q * le * v * 1000) / 60;
      return {
        enonce: `Un épandeur à dosage pondéral de ${Ce} t de capacité répand ${p.du} sur une largeur de ${frd(le, 1)} m, à ${frd(dosage, 1)} % de la masse de sol sec, pour une couche de ${frd(e, 2)} m compactée à ρd = ${frd(rhoD, 2)} Mg/m³. La plateforme à traiter mesure ${fr(long, 4)} m × ${frd(larg, 1)} m.`,
        donnees: [donnee("Épandeur", `${Ce} t · ${frd(le, 1)} m de large`), donnee("Dosage", `${frd(dosage, 1)} %`), donnee("ρd · e", `${frd(rhoD, 2)} Mg/m³ · ${frd(e, 2)} m`), donnee("Plateforme", `${fr(long, 4)} × ${frd(larg, 1)} m`)],
        questions: [
          nombre("Quantité à épandre q ?", r.q, "kg/m²", `q = ${frd(dosage / 100, 3)} × ${fr(rhoD * 1000, 4)} × ${frd(e, 2)} = ${frd(r.q, 2)} kg/m².`, { rel: 0.01 }),
          nombre("Longueur de bande couverte par un plein ?", Lplein, "m", `${fr(Ce * 1000, 5)} kg / (${frd(r.q, 2)} kg/m² × ${frd(le, 1)} m) = ${fr(Lplein, 4)} m.`, { rel: 0.015 }),
          nombre("Nombre de pleins pour toute la plateforme ?", pleins, "", `Produit nécessaire : ${frd(r.q, 2)} × ${fr(long * larg, 5)} m² = ${fr(r.total, 4)} t ; ${fr(r.total, 4)} / ${Ce} = ${frd(r.total / Ce, 2)} → ${pleins} pleins.`, { abs: 0.5 }),
          nombre(`Débit que doit délivrer l'épandeur à ${frd(v, 1)} km/h ?`, debit, "kg/min", `L'épandeur avance de ${fr((v * 1000) / 60, 3)} m/min ; ${frd(r.q, 2)} × ${frd(le, 1)} × ${fr((v * 1000) / 60, 3)} = ${fr(debit, 3)} kg/min : son dosage pondéral est asservi à la vitesse.`, { rel: 0.02 }),
        ],
      };
    },
  },
];
