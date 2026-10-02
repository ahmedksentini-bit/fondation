// Exercices du chapitre 10 : la partie supérieure des terrassements (PST),
// l'arase et la plateforme — cas de PST (GTR 2024, F1 tableau 17), classes de
// portance AR et PF, court terme et long terme, amélioration et stabilisation.
// Les cas de PST viennent de casPST (src/gtr/pst.js), les classes de
// portance.js, l'état hydrique de classification.js.
import { frd, nombre, choixMelange, donnee } from "./alea.js";
import { casPST, verifierArase, MODULE_AR } from "../gtr/pst.js";
import { plaque, classeArase, classePlateforme, CLASSES_AR, CLASSES_PF } from "../gtr/portance.js";
import { ETATS_2024, intervalle, etatHydrique } from "../gtr/classification.js";
import { ETATS, NATURES, natureAvecArticle } from "./ch06.js";

const PST = ["PST0", "PST1", "PST2", "PST3", "PST4", "PST5", "PST6"];
const AR = ["AR0", "AR1", "AR1 ou AR2", "AR2", "AR2 ou AR3"];
const arEnClair = (r) => r.ar.join(" ou ");
const etatEnClair = (e) => (e === "ins" ? "insensible à l'eau" : `à l'état ${ETATS[e]}`);
const materiau = (nature, etat) => `${natureAvecArticle("", nature)}, ${etatEnClair(etat)} (${nature}${etat})`;
/** Le même, après « de » : « d'un limon ou d'une argile peu plastique, à l'état humide (F2h) ». */
const deMateriau = (nature, etat) => `d'${materiau(nature, etat).replace(/ ou (une?) /, " ou d'$1 ")}`;
/** Distracteurs : n éléments d'une liste, différents de la bonne réponse. */
const autres = (a, liste, bonne, n = 3) => a.tirage(liste.filter((x) => x !== bonne), n);

/** Contexte hydraulique d'une PST, en clair. */
function contexte({ deblai, nappe, drainage }) {
  const site = deblai
    ? (nappe === "risque" ? "En déblai, la nappe peut remonter dans la PST : aucun rabattement n'est prévu." : "En déblai, un drainage profond rabat la nappe : elle ne remonte pas dans la PST.")
    : "En remblai : pas de remontée de nappe possible dans la PST.";
  return `${site} Le projet ${drainage ? "prévoit un drainage à la base de la chaussée et l'imperméabilisation de l'arase" : "ne prévoit ni drainage à la base de la chaussée ni imperméabilisation de l'arase"}.`;
}

/** Classe de plateforme avant la note qui a créé PF2qs : l'ancienne PF2 allait de 50 à 120 MPa. Solveur local, déduit de classePlateforme. */
const classePlateformeAvantPF2qs = (EV2) => (classePlateforme(EV2) === "PF2qs" ? "PF2" : classePlateforme(EV2));

/** Une valeur intérieure à une classe [min, max) de portance, à 6 % au moins de ses bornes. */
const dansClasse = (a, c, plafond) => a.entre(Math.max(c.min * 1.06, 8), (Number.isFinite(c.max) ? c.max : plafond) * 0.94, 1);

const QUAND = {
  sensible: "peu avant de recouvrir l'arase : le sol sensible à l'eau peut perdre sa portance d'ici là",
  traite: "on peut l'anticiper, mais il vaut mieux la recontrôler après un hiver ou un trafic de chantier intense",
  insensible: "à tout moment : pour un matériau insensible à l'eau, la mesure de court terme vaut à long terme",
};
const quand = (pst) => (["PST5", "PST6"].includes(pst) ? QUAND.insensible : pst === "PST4" ? QUAND.traite : QUAND.sensible);

/** Tire IPI, wn et wOPN cohérents avec un état visé d'un sol F ou I (seuils ETATS_2024). */
function tirerEtat(a, nature, cible) {
  const t = ETATS_2024[nature], ligne = t.lignes.find((l) => l.etat === cible);
  const dans = (txt, marge, largeur) => {
    const I = intervalle(txt);
    return [Number.isFinite(I.a) ? I.a + marge : I.b - largeur, Number.isFinite(I.b) ? I.b - marge : I.a + largeur];
  };
  const wOPN = nature.startsWith("I") ? a.entre(9, 15, 0.5) : a.entre(13, 22, 0.5);
  const w = +(wOPN * a.entre(...dans(ligne.r, 0.03, 0.2), 0.01)).toFixed(1);
  const mIPI = t.lignes.find((l) => l.etat === "m").IPI;
  const IPI = ligne.IPI ? Math.max(1, Math.round(a.entre(...dans(ligne.IPI, 0.5, 2), 0.5))) : Math.round(intervalle(mIPI).b + a.entre(3, 15, 1));
  return { wOPN, w, IPI, h: etatHydrique(nature, { IPI, w, wOPN }) };
}

export default [
  {
    id: "ch10-classes", titre: "Classes d'arase et de plateforme", difficulte: 1,
    generer(a) {
      const ca = a.choix(CLASSES_AR), cp = a.choix([CLASSES_PF[0], CLASSES_PF[1], CLASSES_PF[1], CLASSES_PF[2], CLASSES_PF[2], CLASSES_PF[3], CLASSES_PF[4]]);
      const z2a = +(90 / dansClasse(a, ca, 280)).toFixed(2), z2p = +(90 / dansClasse(a, cp, 280)).toFixed(2);
      const ra = plaque({ z1: 2 * z2a, z2: z2a }), rp = plaque({ z1: 1.6 * z2p, z2: z2p });
      const AR_ = classeArase(ra.EV2), PF_ = classePlateforme(rp.EV2), PFancien = classePlateformeAvantPF2qs(rp.EV2);
      return {
        enonce: `Essais de plaque (600 mm) en fin de chantier : sur l'arase des terrassements, z2 = ${frd(z2a, 2)} mm au second chargement ; sur la plateforme, après la couche de forme, z2 = ${frd(z2p, 2)} mm. On admet que ces portances sont celles du long terme (EV2 = 90/z2).`,
        donnees: [donnee("z2 sur l'arase", `${frd(z2a, 2)} mm`), donnee("z2 sur la plateforme", `${frd(z2p, 2)} mm`)],
        questions: [
          nombre("EV2 de l'arase ?", ra.EV2, "MPa", `EV2 = 90/${frd(z2a, 2)} = ${frd(ra.EV2, 1)} MPa.`, { rel: 0.01 }),
          choixMelange(a, "Classe de l'arase ?", [AR_, ...autres(a, CLASSES_AR.map((c) => c.classe), AR_)],
            `AR0 < 20 MPa ≤ AR1 < 50 MPa ≤ AR2 < 120 MPa ≤ AR3 < 200 MPa ≤ AR4 : EV2 = ${frd(ra.EV2, 1)} MPa → ${AR_}.`),
          nombre("EV2 de la plateforme ?", rp.EV2, "MPa", `EV2 = 90/${frd(z2p, 2)} = ${frd(rp.EV2, 1)} MPa.`, { rel: 0.01 }),
          choixMelange(a, "Classe de la plateforme au GTR 2024 ?", [PF_, ...autres(a, CLASSES_PF.map((c) => c.classe), PF_)],
            `PF1 20 à 50 MPa, PF2 50 à 80, PF2qs 80 à 120, PF3 120 à 200, PF4 au-delà : EV2 = ${frd(rp.EV2, 1)} MPa → ${PF_}.`),
          choixMelange(a, "Et dans la classification antérieure à la PF2qs ?", [PFancien, ...["PF1", "PF2", "PF3", "PF4"].filter((x) => x !== PFancien)],
            `L'ancienne PF2 allait de 50 à 120 MPa ; la PF2qs (« qualité supérieure », 80 à 120 MPa) la partage depuis une note d'information intégrée au GTR 2024. Ici : ${PFancien}${PF_ === "PF2qs" ? " — le même module vaut aujourd'hui une PF2qs, ce qui allège la chaussée" : ""}.`),
        ],
      };
    },
  },
  {
    id: "ch10-pst", titre: "Cas de PST et classe d'arase", difficulte: 2,
    generer(a) {
      const nature = a.choix(["F1", "F2", "F3", "F4", "I1", "I2", "S1", "S2", "S3", "S4", "G1", "G2", "G3", "G4"]);
      const etat = /^[SG]/.test(nature) && a.reel() < 0.35 ? "ins" : a.choix(["th", "h", "h", "m", "m", "m", "s", "s", "ts"]);
      const deblai = a.reel() < 0.5, nappe = deblai && a.reel() < 0.6 ? "risque" : "non", drainage = a.reel() < 0.5;
      const r = casPST({ sousClasse: nature, etat, nappe, drainage });
      const q = [
        choixMelange(a, "Cas de PST ?", [r.pst, ...autres(a, PST, r.pst)], `${r.pst} : ${r.motif}.${r.avertissements.length ? ` ${r.avertissements.join(" ")}` : ""}`),
        choixMelange(a, "Classe de l'arase à long terme ?", [arEnClair(r), ...autres(a, AR, arEnClair(r))],
          `${r.pst} → ${arEnClair(r)} (tableau 17 du fascicule 1). Ces classes de long terme servent au dimensionnement de la chaussée.`),
      ];
      if (r.ar[0] !== "AR0") q.push(nombre("Module EV2 à long terme que l'on peut escompter (classe la plus faible du cas) ?", r.modules[0], "MPa", `${r.ar[0]} : ${r.modules[0]} MPa${r.ar.length > 1 ? ` (${r.ar[1]} : ${r.modules[1]} MPa, si la nature du matériau et les dispositions le permettent)` : ""}.`, { abs: 0 }));
      else q.push(choixMelange(a, "Peut-on construire la couche de forme sur cette arase ?", ["non, pas sans reclassement : drainage, purge, substitution ou traitement", "oui, une couche de forme traitée", "oui, une couche de forme granulaire épaisse", "oui, après un simple compactage intense"],
        "PST0 : portance quasi nulle, pas de couche de forme possible sans reclasser d'abord la PST dans un autre cas."));
      return {
        enonce: `${deblai ? "Déblai" : "Remblai"} routier : le mètre supérieur des terrassements (PST) est constitué ${deMateriau(nature, etat)}. ${contexte({ deblai, nappe, drainage })}`,
        donnees: [donnee("Matériau de la PST", `${nature}${etat}`), donnee("Ouvrage", deblai ? "déblai" : "remblai"), donnee("Nappe", nappe === "risque" ? "remontée possible" : "pas de remontée"), donnee("Drainage et imperméabilisation", drainage ? "oui" : "non")],
        questions: q,
      };
    },
  },
  {
    id: "ch10-traitement", titre: "Amélioration ou stabilisation ?", difficulte: 2,
    generer(a) {
      const nature = a.choix(["F1", "F2", "F3", "I1", "I2", "S3", "S4", "G3", "G4"]);
      const etat = a.choix(["h", "h", "m", "m", "s"]);
      const traitement = a.choix(["amelioration", "stabilisation", "stabilisation"]);
      const e = a.choix([0.25, 0.3, 0.35, 0.4, 0.5, 0.6, 0.7]);
      const nappe = a.choix(["non", "risque"]);
      const base = { sousClasse: nature, etat, nappe, drainage: false };
      const r = casPST({ ...base, traitement, eTraitee: e });
      const eMin = Array.from({ length: 20 }, (_, i) => +(0.05 * (i + 1)).toFixed(2)).find((x) => casPST({ ...base, traitement: "stabilisation", eTraitee: x }).pst === "PST4");
      const nomT = traitement === "amelioration" ? "un traitement d'amélioration (chaux vive)" : "un traitement de stabilisation (liant hydraulique, étude de formulation et contrôle)";
      const q = [
        choixMelange(a, "Cas de PST obtenu ?", [r.pst, ...autres(a, PST.slice(0, 5), r.pst)], `${r.pst} : ${r.motif}.${r.avertissements.length ? ` ${r.avertissements.join(" ")}` : ""}`),
        choixMelange(a, "Classe de l'arase à long terme ?", [arEnClair(r), ...autres(a, AR, arEnClair(r))], `${r.pst} → ${arEnClair(r)}.`),
        nombre("Épaisseur minimale à stabiliser pour obtenir une PST4 ?", eMin, "m", `${etat === "h" ? "Depuis une PST1 (sol humide), la PST4 demande 0,70 m stabilisés, en deux couches" : "Un sol sensible à l'eau stabilisé sur 0,35 m au moins forme une PST4"} : ${frd(eMin, 2)} m.`, { abs: 0.001 }),
      ];
      if (traitement === "amelioration") q.push(choixMelange(a, "Pourquoi l'amélioration ne change-t-elle pas le cas de PST ?",
        ["elle agit à court terme — teneur en eau, circulation, compactage — sans résistance durable à l'eau et au gel", "elle est interdite dans la PST", "la chaux vive ne réagit pas avec les sols fins", "elle n'est admise que sur 0,70 m au moins"],
        "Pour le tableau des PST, un sol amélioré reste un sol non traité : seule une stabilisation, vérifiée par une étude et un contrôle, donne une résistance durable et permet la PST4."));
      return {
        enonce: `La PST d'un ${nappe === "risque" ? "déblai, où la nappe peut remonter," : "remblai"} est constituée ${deMateriau(nature, etat)}. L'entreprise propose ${nomT} sur ${frd(e, 2)} m d'épaisseur ; pas de drainage à la base de la chaussée.`,
        donnees: [donnee("Matériau", `${nature}${etat}`), donnee("Traitement", traitement === "amelioration" ? "amélioration" : "stabilisation"), donnee("Épaisseur traitée", `${frd(e, 2)} m`), donnee("Nappe", nappe === "risque" ? "remontée possible" : "pas de remontée")],
        questions: q,
      };
    },
  },
  {
    id: "ch10-court-long", titre: "Portance à court terme, classe à long terme", difficulte: 2,
    generer(a) {
      let p, r, deblai, nappe, drainage, nature, etat, traitement;
      for (let i = 0; i < 60; i++) {
        nature = a.choix(["F1", "F2", "I1", "I2", "S1", "S3", "G1", "G3"]);
        etat = /^[SG]/.test(nature) && a.reel() < 0.3 ? "ins" : a.choix(["h", "m", "m", "s"]);
        deblai = a.reel() < 0.5; nappe = deblai && a.reel() < 0.5 ? "risque" : "non"; drainage = a.reel() < 0.5;
        traitement = etat !== "ins" && a.reel() < 0.25 ? "stabilisation" : "non";
        p = { sousClasse: nature, etat, nappe, drainage, traitement, eTraitee: etat === "h" ? 0.7 : 0.35 };
        r = casPST(p);
        if (r.pst !== "PST0") break;
      }
      const ar = r.ar.at(-1), cible = MODULE_AR[ar];
      let z2, m, v;
      for (let i = 0; i < 60; i++) {
        z2 = +(90 / (cible * (a.reel() < 0.5 ? a.entre(0.7, 0.94, 0.01) : a.entre(1.06, 1.6, 0.01)))).toFixed(2);
        m = plaque({ z1: 1.7 * z2, z2 });
        v = verifierArase({ EV2: m.EV2, ar });
        // Un sol humide sous 15 MPa à court terme serait ramené en PST0 : on écarte ce tirage.
        if (casPST({ ...p, portanceCT: m.EV2 }).pst === r.pst) break;
      }
      const oui = `oui : ${frd(m.EV2, 0)} MPa ≥ ${cible} MPa`, non = `non : ${frd(m.EV2, 0)} MPa < ${cible} MPa`;
      return {
        enonce: `${deblai ? "Déblai" : "Remblai"} dont la PST est constituée ${deMateriau(nature, etat)}${traitement === "stabilisation" ? `, stabilisé sur ${frd(p.eTraitee, 2)} m` : ""}. ${contexte({ deblai, nappe, drainage })} Le dimensionnement de la chaussée retient la classe ${ar}. Un essai de plaque sur l'arase donne z2 = ${frd(z2, 2)} mm (EV2 = 90/z2).`,
        donnees: [donnee("Matériau", `${nature}${etat}${traitement === "stabilisation" ? " stabilisé" : ""}`), donnee("Classe retenue", ar), donnee("z2", `${frd(z2, 2)} mm`)],
        questions: [
          choixMelange(a, "Cas de PST ?", [r.pst, ...autres(a, PST, r.pst)], `${r.pst} : ${r.motif}.`),
          nombre("EV2 mesuré sur l'arase ?", m.EV2, "MPa", `EV2 = 90/${frd(z2, 2)} = ${frd(m.EV2, 1)} MPa.`, { rel: 0.01 }),
          choixMelange(a, `La portance mesurée justifie-t-elle la classe ${ar} ?`, [v.ok ? oui : non, v.ok ? non : oui, "oui, une mesure de court terme suffit toujours", "on ne peut rien conclure avant l'hiver"],
            `Au chantier, la portance de l'arase mesurée à court terme doit être au moins égale au module de long terme de la classe retenue : ${ar} → ${cible} MPa ; EV2 = ${frd(m.EV2, 1)} MPa.`),
          choixMelange(a, "Quand cette mesure est-elle représentative ?", [quand(r.pst), ...Object.values(QUAND).filter((x) => x !== quand(r.pst)), "seulement après la construction de la chaussée"],
            `${r.pst} : ${quand(r.pst)}. Pour les PST1 à PST3, sensibles à l'eau, on contrôle peu avant de recouvrir ; pour la PST4, on peut anticiper ; pour les PST5 et PST6, la mesure de court terme vaut à long terme.`),
        ],
      };
    },
  },
  {
    id: "ch10-nappe", titre: "Un même sol, en remblai et en déblai", difficulte: 2,
    generer(a) {
      const nature = a.choix(["F1", "F2", "F3", "F4", "I1", "I2", "S3", "S4", "G3", "G4"]);
      const etat = a.choix(["m", "m", "s"]), drainage = a.reel() < 0.6, rabattue = a.reel() < 0.3;
      const A = casPST({ sousClasse: nature, etat, nappe: "non", drainage }), B = casPST({ sousClasse: nature, etat, nappe: rabattue ? "non" : "risque", drainage });
      const pourquoi = /^F[34]/.test(nature) ? "les argiles F3 et F4 restent en PST2 même hors d'atteinte de la nappe : leur portance peut chuter à long terme"
        : rabattue ? "le drainage profond rabat la nappe : le déblai se classe alors comme le remblai"
          : "en déblai sans rabattement, la nappe peut remonter et la portance chuter à long terme ; le remblai en est à l'abri";
      return {
        enonce: `Sur un même tracé, ${materiau(nature, etat)} forme la PST de deux tronçons : A, en remblai ; B, en déblai, ${rabattue ? "où un drainage profond rabat la nappe sous la PST" : "où la nappe peut remonter dans la PST (pas de rabattement)"}. Le projet ${drainage ? "prévoit, sur les deux tronçons, un drainage à la base de la chaussée et l'imperméabilisation de l'arase" : "ne prévoit ni drainage à la base de la chaussée ni imperméabilisation de l'arase"}.`,
        donnees: [donnee("Matériau", `${nature}${etat}`), donnee("Tronçon A", "remblai"), donnee("Tronçon B", rabattue ? "déblai, nappe rabattue" : "déblai, nappe pouvant remonter"), donnee("Drainage et imperméabilisation", drainage ? "oui" : "non")],
        questions: [
          choixMelange(a, "Cas de PST du tronçon A ?", [A.pst, ...autres(a, PST.slice(0, 5), A.pst)], `A : ${A.pst} — ${A.motif}.${A.avertissements.length ? ` ${A.avertissements.join(" ")}` : ""}`),
          choixMelange(a, "Cas de PST du tronçon B ?", [B.pst, ...autres(a, PST.slice(0, 5), B.pst)], `B : ${B.pst} — ${B.motif}.`),
          choixMelange(a, "Classe d'arase du tronçon A ?", [arEnClair(A), ...autres(a, AR, arEnClair(A))], `A : ${A.pst} → ${arEnClair(A)}${A.ar.length > 1 ? " : l'AR2 n'est accessible qu'en état moyen, avec le drainage et l'imperméabilisation, et selon la nature du matériau" : ""}.`),
          choixMelange(a, `Pourquoi les deux tronçons sont-ils ${A.pst === B.pst ? "classés de la même façon" : "classés différemment"} ?`,
            [pourquoi, "le cas de PST ne dépend que de la nature du matériau", "le drainage à la base de la chaussée rend tout sol insensible à l'eau", "un déblai est toujours mieux classé qu'un remblai"],
            `A : ${A.pst}, B : ${B.pst}. Le cas de PST dépend de la nature et de l'état du mètre supérieur, mais aussi de son environnement hydrique : nappe, drainage, imperméabilisation.`),
        ],
      };
    },
  },
  {
    id: "ch10-objectif", titre: "Viser une arase AR2 : quelle disposition ?", difficulte: 3,
    generer(a) {
      const DISPOSITIONS = [
        ["drainage à la base de la chaussée et imperméabilisation de l'arase", (p) => ({ ...p, drainage: true })],
        ["stabilisation du sol sur 0,35 m", (p) => ({ ...p, traitement: "stabilisation", eTraitee: 0.35 })],
        ["stabilisation du sol sur 0,70 m, en deux couches", (p) => ({ ...p, traitement: "stabilisation", eTraitee: 0.7 })],
        ["stabilisation du sol sur 0,25 m", (p) => ({ ...p, traitement: "stabilisation", eTraitee: 0.25 })],
        ["stabilisation du sol sur 0,30 m", (p) => ({ ...p, traitement: "stabilisation", eTraitee: 0.3 })],
        ["compactage intensif de la PST, sans autre disposition", (p) => ({ ...p })],
        ["amélioration à la chaux vive sur 0,50 m", (p) => ({ ...p, traitement: "amelioration", eTraitee: 0.5 })],
        ["rabattement de la nappe par un drainage profond, sans autre disposition", (p) => ({ ...p, nappe: "non" })],
        ["rabattement de la nappe, drainage à la base de la chaussée et imperméabilisation de l'arase", (p) => ({ ...p, nappe: "non", drainage: true })],
      ];
      for (let essai = 0; essai < 80; essai++) {
        const nature = a.choix(["F1", "F2", "I1", "I2", "S3", "S4", "G3", "G4"]), etat = a.choix(["h", "m", "m", "s"]);
        const nappe = a.choix(["non", "risque"]);
        const p = { sousClasse: nature, etat, nappe, drainage: false, traitement: "non", eTraitee: 0 };
        const r = casPST(p);
        if (r.ar.includes("AR2")) continue;
        const evaluees = DISPOSITIONS.filter(([nom]) => nappe === "risque" || !/rabattement/.test(nom)).map(([nom, f]) => ({ nom, r: casPST(f(p)) }));
        const bonnes = evaluees.filter((x) => x.r.ar.includes("AR2")), mauvaises = evaluees.filter((x) => !x.r.ar.includes("AR2"));
        if (!bonnes.length || mauvaises.length < 3) continue;
        // La stabilisation sur 0,70 m convient presque toujours : on lui préfère souvent une autre bonne réponse.
        const autresBonnes = bonnes.filter((x) => !/0,70/.test(x.nom));
        const bonne = autresBonnes.length && a.reel() < 0.6 ? a.choix(autresBonnes) : a.choix(bonnes), fausses = a.tirage(mauvaises, 3);
        const z2max = plaque({ z1: 1, z2: 1 }).EV2 / MODULE_AR.AR2; // EV2 = 90/z2
        return {
          enonce: `La PST d'un ${nappe === "risque" ? "déblai, où la nappe peut remonter (pas de rabattement prévu)," : "remblai"} est constituée ${deMateriau(nature, etat)}, sans traitement ni drainage. Le dimensionnement de la chaussée suppose une arase AR2 (${MODULE_AR.AR2} MPa à long terme).`,
          donnees: [donnee("Matériau", `${nature}${etat}`), donnee("Ouvrage", nappe === "risque" ? "déblai, nappe pouvant remonter" : "remblai"), donnee("Classe visée", "AR2")],
          questions: [
            choixMelange(a, "Cas de PST en l'état ?", [r.pst, ...autres(a, PST.slice(0, 5), r.pst)], `${r.pst} → ${arEnClair(r)} : ${r.motif}.`),
            choixMelange(a, "Laquelle de ces dispositions permet de viser AR2 ?", [bonne.nom, ...fausses.map((x) => x.nom)],
              `${bonne.nom} → ${bonne.r.pst} (${arEnClair(bonne.r)}). Les autres : ${fausses.map((x) => `${x.nom} → ${x.r.pst} (${arEnClair(x.r)})`).join(" ; ")}. Une amélioration ne change pas le cas de PST ; une stabilisation trop mince non plus.`),
            nombre("Au contrôle de l'arase, quel enfoncement z2 maximal à la plaque justifiera AR2 ?", z2max, "mm", `La portance mesurée à court terme doit atteindre le module de long terme de la classe : EV2 ≥ ${MODULE_AR.AR2} MPa ⇔ z2 ≤ 90/${MODULE_AR.AR2} = ${frd(z2max, 2)} mm (plaque de 600 mm, EV2 = 90/z2).`, { rel: 0.01 }),
          ],
        };
      }
      throw new Error("ch10-objectif : aucun tirage exploitable");
    },
  },
  {
    id: "ch10-diagnostic", titre: "Du sol mesuré à la classe d'arase", difficulte: 3,
    generer(a) {
      for (let essai = 0; essai < 60; essai++) {
        const nature = a.choix(["F1", "F2", "I1", "I2"]), cible = a.choix(["h", "h", "m", "m", "s"]);
        const { wOPN, w, IPI, h } = tirerEtat(a, nature, cible);
        const deblai = a.reel() < 0.5, nappe = deblai && a.reel() < 0.6 ? "risque" : "non", drainage = a.reel() < 0.4;
        const EV = h.etat === "h" ? a.choix([a.entre(8, 13.5, 0.5), a.entre(16.5, 25, 0.5)]) : a.entre(22, 60, 0.5);
        const z2 = +(90 / EV).toFixed(2), m = plaque({ z1: 1.8 * z2, z2 });
        if ([15, 35].some((s) => Math.abs(m.EV2 - s) < 1)) continue;
        const r = casPST({ sousClasse: nature, etat: h.etat, nappe, drainage, portanceCT: m.EV2 });
        const CDF = {
          refus: "non : jamais de couche de forme traitée directement sur une PST0 ou une PST1",
          oui: "oui : EV2 ≥ 35 MPa, et le cas de PST l'admet",
          faible: "non : le cas de PST l'admettrait, mais EV2 < 35 MPa",
        };
        const cdf = ["PST0", "PST1"].includes(r.pst) ? "refus" : m.EV2 >= 35 ? "oui" : "faible";
        const etats = ["th", "h", "m", "s", "ts"].map((e) => `${e} (${ETATS[e]})`);
        const bonEtat = `${h.etat} (${ETATS[h.etat]})`;
        return {
          enonce: `PST d'un ${deblai ? "déblai" : "remblai"} en ${NATURES[nature]} (${nature}) : wOPN = ${frd(wOPN, 1)} %, et sur place wn = ${frd(w, 1)} % et IPI = ${IPI}. ${contexte({ deblai, nappe, drainage })} Un essai de plaque sur l'arase donne z2 = ${frd(z2, 2)} mm (EV2 = 90/z2).`,
          donnees: [donnee("Nature", nature), donnee("wOPN · wn", `${frd(wOPN, 1)} % · ${frd(w, 1)} %`), donnee("IPI", String(IPI)), donnee("z2 sur l'arase", `${frd(z2, 2)} mm`)],
          questions: [
            choixMelange(a, "État hydrique du sol ?", [bonEtat, ...etats.filter((x) => x !== bonEtat)],
              `wn/wOPN = ${frd(h.r, 2)} ; ${h.mesures.map(([q, e]) => `${q} → ${e}`).join(" ; ")} : état ${bonEtat} (l'IPI prime pour les états humides, wn/wOPN pour les états secs).`),
            choixMelange(a, "Cas de PST ?", [r.pst, ...autres(a, PST.slice(0, 5), r.pst)],
              `EV2 = 90/${frd(z2, 2)} = ${frd(m.EV2, 1)} MPa. ${r.pst} : ${r.motif}.${r.avertissements.length ? ` ${r.avertissements.join(" ")}` : ""}`),
            choixMelange(a, "Classe de l'arase à long terme ?", [arEnClair(r), ...autres(a, AR, arEnClair(r))], `${r.pst} → ${arEnClair(r)}.`),
            choixMelange(a, "Peut-on exécuter directement une couche de forme traitée ?", [CDF[cdf], ...Object.values(CDF).filter((x) => x !== CDF[cdf]), "oui, dès que le sol est traité à la chaux, quel que soit EV2"],
              `${r.pst}, EV2 = ${frd(m.EV2, 1)} MPa : ${CDF[cdf]}. Sur l'arase, une couche de forme traitée demande au moins 35 MPa à court terme (chapitre 8).`),
          ],
        };
      }
      throw new Error("ch10-diagnostic : aucun tirage exploitable");
    },
  },
];
