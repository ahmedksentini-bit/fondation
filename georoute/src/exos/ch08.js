// Exercices du chapitre 8 : contrôler le compactage et la portance — Q/S
// réalisé, masse volumique en place au gammadensimètre (densités des tranches
// par différence), pénétromètre dynamique léger, essai de plaque, dynaplaque
// et seuils de portance du chantier.
import { frd, fr, nombre, choixMelange, donnee } from "./alea.js";
import { OBJECTIFS, ENERGIES, controleDensite, densiteTranche, controleAtelier } from "../gtr/compactage.js";
import { plaque, jugerK, dynaplaque } from "../gtr/portance.js";
import { qdHollandais, enfoncementHollandais } from "../bancs/controle-dessin.js";
import { graphe, COULEURS } from "../figures.js";
import { CELLULES, materiau, famille, largeur } from "./ch07.js";

const OBJ = { q4: "l'objectif q4 (remblai)", q3: "l'objectif q3 (couche de forme)" };

/**
 * Seuils de portance à court terme pour construire la couche suivante
 * [F1 § 4.1.3] : sur l'arase, EV2 ≥ 35 MPa pour une couche de forme traitée,
 * 15 à 20 MPa au moins pour une couche de forme granulaire ; en deçà, il faut
 * d'abord améliorer l'arase. La zone 15–20 MPa, que le guide laisse à
 * l'appréciation du maître d'œuvre, n'est jamais tirée (null). Solveur local :
 * le module portance.js donne les modules, pas cette décision.
 */
function coucheDeFormePossible(EV2) {
  if (EV2 >= 35) return "traitee";
  if (EV2 >= 20) return "granulaire";
  return EV2 < 15 ? "aucune" : null;
}
const DECISIONS_ARASE = {
  traitee: "couche de forme traitée possible (EV2 ≥ 35 MPa), ou granulaire",
  granulaire: "couche de forme granulaire seulement : pas de couche de forme traitée (EV2 < 35 MPa)",
  aucune: "ni l'une ni l'autre en l'état : améliorer d'abord l'arase (EV2 < 15 MPa)",
};
/** Plateforme support de chaussée : module supérieur à 50 MPa au moment de construire la chaussée [F1 § 4.1.3]. */
const SEUIL_PLATEFORME = 50;

/** Courbes de chargement schématiques de l'essai de plaque (même tracé que le calculateur du cours). */
function figurePlaque(z1, z2) {
  const zr = Math.max(0, z1 - 1.25 * z2);
  const c1 = Array.from({ length: 21 }, (_, i) => { const q = (0.25 * i) / 20; return [q, z1 * (0.55 * (q / 0.25) + 0.45 * (q / 0.25) ** 2)]; });
  const d1 = Array.from({ length: 11 }, (_, i) => { const q = 0.25 * (1 - i / 10); return [q, zr + (z1 - zr) * (q / 0.25) ** 0.7]; });
  const c2 = Array.from({ length: 21 }, (_, i) => { const q = (0.2 * i) / 20; return [q, zr + z2 * (0.9 * (q / 0.2) + 0.1 * (q / 0.2) ** 2)]; });
  return graphe({
    largeur: 560, hauteur: 260, xmin: 0, xmax: 0.3, ymin: 0, ymax: Math.ceil(Math.max(z1, zr + z2) * 1.15 * 2) / 2, inverserY: true, pasX: 0.05,
    xlabel: "contrainte sous la plaque q (MPa)", ylabel: "enfoncement (mm)",
    series: [
      { points: c1, couleur: COULEURS.bleu, epaisseur: 2.4, libelle: "1er chargement (0,25 MPa)" },
      { points: d1, couleur: "#94a3b8", epaisseur: 1.6, tirets: "5 4", libelle: "déchargement" },
      { points: c2, couleur: COULEURS.rouge, epaisseur: 2.4, libelle: "2e chargement (0,20 MPa)" },
    ],
    marques: [{ x: 0.25, y: z1, couleur: COULEURS.bleu, libelle: `z1 = ${frd(z1, 2)} mm` }, { x: 0.2, y: zr + z2, couleur: COULEURS.rouge, libelle: `z2 = ${frd(z2, 2)} mm` }],
  });
}

/** Tire une valeur à l'écart d'un seuil : de part ou d'autre, à plus de 5 %. */
const autourDe = (a, seuil, bas = 0.65, haut = 1.5) => seuil * (a.reel() < 0.5 ? a.entre(bas, 0.95, 0.01) : a.entre(1.05, haut, 0.01));

export default [
  {
    id: "ch8-qs-poste", titre: "Q/S réalisé d'un poste", difficulte: 1,
    generer(a) {
      const { t, code, comp, cell } = a.choix(CELLULES.filter((c) => famille(c.comp) !== "PQ"));
      const L = largeur(a, comp), Q = a.entre(600, 3000, 10);
      const rapport = a.reel() < 0.5 ? a.entre(0.75, 0.96, 0.01) : a.entre(1.04, 1.3, 0.01);
      const d = Math.max(1, +(Q / (1000 * L * cell.QS * rapport)).toFixed(1));
      const S = 1000 * d * L, QSr = Q / S;
      const r = controleAtelier({ Q, engins: [{ S, QStableau: cell.QS }] });
      const dMin = Q / (1000 * L * cell.QS);
      const symbole = a.choix(t.classes);
      const vrai = r.ok ? "conforme : le Q/S réalisé ne dépasse pas celui du tableau" : "non conforme : le Q/S réalisé dépasse celui du tableau, l'énergie est insuffisante";
      return {
        enonce: `Remblai construit avec ${materiau(symbole)} (${symbole}), énergie ${ENERGIES[code]} : le tableau de compactage (annexe 4, p. ${t.page}) donne Q/S = ${frd(cell.QS, 3)} m pour le ${comp} du chantier, de largeur ${frd(L, 2)} m. À la fin du poste, le comptage des camions donne ${fr(Q, 4)} m³ mis en œuvre, et l'enregistreur du compacteur ${frd(d, 1)} km parcourus en compactage.`,
        donnees: [donnee("Q", `${fr(Q, 4)} m³`), donnee("Distance", `${frd(d, 1)} km`), donnee("L", `${frd(L, 2)} m`), donnee("Q/S du tableau", `${frd(cell.QS, 3)} m`)],
        questions: [
          nombre("Surface balayée S ?", S, "m²", `S = distance × largeur = 1 000 × ${frd(d, 1)} × ${frd(L, 2)} = ${fr(S, 5)} m².`, { rel: 0.005 }),
          nombre("Q/S réalisé ?", QSr, "m", `Q/S = ${fr(Q, 4)}/${fr(S, 5)} = ${frd(QSr, 3)} m.`, { rel: 0.01 }),
          choixMelange(a, "Le poste est-il conforme ?", [vrai, r.ok ? "non conforme : le Q/S réalisé dépasse celui du tableau, l'énergie est insuffisante" : "conforme : le Q/S réalisé ne dépasse pas celui du tableau", "conforme : un Q/S réalisé plus grand que celui du tableau traduit plus de travail", "non conforme : un Q/S réalisé plus petit que celui du tableau traduit un excès d'énergie"],
            `${frd(QSr, 3)} m ${r.ok ? "≤" : ">"} ${frd(cell.QS, 3)} m. Q/S est l'épaisseur de sol « traitée » par chaque passage : plus il est petit, plus le compacteur a travaillé ; le Q/S réalisé doit rester inférieur ou égal à celui du tableau.`),
          nombre("Distance minimale de compactage pour ce volume ?", dMin, "km", `Il faut S ≥ Q/(Q/S)tableau = ${fr(Q, 4)}/${frd(cell.QS, 3)} = ${fr(Q / cell.QS, 5)} m², soit ${fr(Q / cell.QS, 5)}/(1 000 × ${frd(L, 2)}) = ${frd(dMin, 2)} km${r.ok ? "" : ` : il manquait ${frd(dMin - d, 2)} km`}.`, { rel: 0.01 }),
        ],
      };
    },
  },
  {
    id: "ch8-rhod", titre: "Masse volumique sèche en place et taux de compactage", difficulte: 1,
    generer(a) {
      const obj = a.choix(["q4", "q3"]), o = OBJECTIFS[obj];
      const ref = a.entre(1.65, 2.15, 0.01), w = a.entre(5, 20, 0.1);
      const t = a.reel() < 0.5 ? a.entre(o.moyen + 0.4, o.moyen + 4, 0.1) : a.entre(o.moyen - 5, o.moyen - 0.4, 0.1);
      const rh = +(((t / 100) * ref * (1 + w / 100))).toFixed(3);
      const rd = rh / (1 + w / 100);
      const c = controleDensite({ rhoDmoy: rd, rhoDfc: NaN, rhoDOPN: ref, objectif: obj });
      const rhMin = c.rhoDmoyRequis * (1 + w / 100);
      const oui = `objectif moyen atteint : taux ≥ ${frd(o.moyen, 1)} %`, non = `objectif moyen non atteint : taux < ${frd(o.moyen, 1)} %`;
      return {
        enonce: `Contrôle d'une couche de ${obj === "q4" ? "remblai (objectif q4)" : "forme (objectif q3)"}. Le gammadensimètre, en transmission directe sur toute l'épaisseur, mesure une masse volumique humide ρh = ${frd(rh, 3)} Mg/m³ ; la teneur en eau d'un prélèvement voisin est w = ${frd(w, 1)} %. Pour ce matériau, ρdOPN = ${frd(ref, 2)} Mg/m³.`,
        donnees: [donnee("ρh", `${frd(rh, 3)} Mg/m³`), donnee("w", `${frd(w, 1)} %`), donnee("ρdOPN", `${frd(ref, 2)} Mg/m³`), donnee("Objectif", obj === "q4" ? "q4 · remblai" : "q3 · couche de forme")],
        questions: [
          nombre("Masse volumique sèche ρd ?", rd, "Mg/m³", `ρd = ρh/(1 + w) = ${frd(rh, 3)}/${frd(1 + w / 100, 3)} = ${frd(rd, 3)} Mg/m³.`, { rel: 0.004 }),
          nombre("Taux de compactage ρd/ρdOPN ?", c.tauxMoyen, "%", `${frd(rd, 3)}/${frd(ref, 2)} = ${frd(c.tauxMoyen, 1)} %.`, { abs: 0.3 }),
          choixMelange(a, "La densité moyenne respecte-t-elle l'objectif ?", [c.okMoyen ? oui : non, c.okMoyen ? non : oui, "objectif atteint dès que ρh dépasse ρdOPN", "impossible à dire sans essai de plaque"],
            `${OBJ[obj][0].toUpperCase()}${OBJ[obj].slice(1)} demande une densité moyenne d'au moins ${frd(o.moyen, 1)} % de ρdOPN : ${frd(c.tauxMoyen, 1)} % → ${c.okMoyen ? "atteint" : "non atteint"}. On compare la masse volumique sèche, jamais la masse humide, à ρdOPN ; reste à vérifier le fond de couche (${frd(o.fond, 0)} %).`),
          nombre("Masse volumique humide minimale qu'il fallait mesurer, à cette teneur en eau ?", rhMin, "Mg/m³", `ρd requise = ${frd(o.moyen / 100, 3)} × ${frd(ref, 2)} = ${frd(c.rhoDmoyRequis, 3)} Mg/m³ ; ρh = ρd (1 + w) = ${frd(c.rhoDmoyRequis, 3)} × ${frd(1 + w / 100, 3)} = ${frd(rhMin, 3)} Mg/m³.`, { rel: 0.004 }),
        ],
      };
    },
  },
  {
    id: "ch8-plaque", titre: "Essai de plaque : EV1, EV2 et k", difficulte: 1,
    generer(a) {
      let r, z1, z2;
      for (let i = 0; i < 50; i++) {
        const EV2 = a.entre(20, 160, 1), k = a.reel() < 0.5 ? a.entre(1.2, 1.9, 0.05) : a.entre(2.1, 3.2, 0.05);
        z2 = +(90 / EV2).toFixed(2); z1 = +((112.5 * k) / EV2).toFixed(2);
        r = plaque({ z1, z2 });
        if (Math.abs(r.k - 2) > 0.04) break;
      }
      const juge = jugerK(r), autre = jugerK({ k: r.k <= 2 ? 3 : 1 });
      return {
        enonce: `Essai de plaque (NF P94-117-1, plaque de 600 mm) sur une couche compactée : enfoncement de ${frd(z1, 2)} mm au premier chargement, jusqu'à 0,25 MPa, puis de ${frd(z2, 2)} mm au second, jusqu'à 0,20 MPa.`,
        donnees: [donnee("z1 (0,25 MPa)", `${frd(z1, 2)} mm`), donnee("z2 (0,20 MPa)", `${frd(z2, 2)} mm`)],
        figure: figurePlaque(z1, z2),
        questions: [
          nombre("Module EV1 ?", r.EV1, "MPa", `EV1 = 1,5 q a / z1 = 1,5 × 0,25 × 300/${frd(z1, 2)} = 112,5/${frd(z1, 2)} = ${frd(r.EV1, 1)} MPa.`, { rel: 0.01 }),
          nombre("Module EV2 ?", r.EV2, "MPa", `EV2 = 1,5 × 0,20 × 300/z2 = 90/${frd(z2, 2)} = ${frd(r.EV2, 1)} MPa.`, { rel: 0.01 }),
          nombre("Rapport k = EV2/EV1 ?", r.k, "", `k = ${frd(r.EV2, 1)}/${frd(r.EV1, 1)} = ${frd(r.k, 2)}.`, { rel: 0.015 }),
          choixMelange(a, "Que dit k du compactage ?", [juge, autre, "rien : k ne dépend que de la plaque utilisée"],
            `k = ${frd(r.k, 2)} : ${juge}. Un premier chargement qui serre encore beaucoup le sol (k élevé, au-delà de 2 environ) trahit un compactage insuffisant ; EV2, lui, caractérise la portance.`),
        ],
      };
    },
  },
  {
    id: "ch8-dynaplaque", titre: "Dynaplaque et planche d'étalonnage", difficulte: 2,
    generer(a) {
      const niveau = a.choix(["plateforme", "arase"]);
      const seuil = niveau === "plateforme" ? SEUIL_PLATEFORME : 35;
      const alpha = a.entre(0.9, 1.5, 0.05);
      let r, s, EV2;
      for (let i = 0; i < 50; i++) {
        const sCible = 22.5 / (autourDe(a, seuil, 0.6, 1.6) / alpha);
        s = Array.from({ length: a.choix([3, 4]) }, () => +(sCible * a.entre(0.94, 1.06, 0.01)).toFixed(2));
        r = dynaplaque({ enfoncements: s });
        EV2 = alpha * r.Evd;
        if (Math.abs(EV2 / seuil - 1) > 0.03) break;
      }
      const ok = EV2 >= seuil;
      const textes = niveau === "plateforme"
        ? [`EV2 ≥ ${SEUIL_PLATEFORME} MPa : la chaussée peut être construite`, `EV2 < ${SEUIL_PLATEFORME} MPa : la plateforme doit être reprise avant la chaussée`]
        : ["EV2 ≥ 35 MPa : une couche de forme traitée peut être exécutée", "EV2 < 35 MPa : pas de couche de forme traitée sur cette arase"];
      return {
        enonce: `Contrôle ${niveau === "plateforme" ? "d'une plateforme support de chaussée" : "d'une arase de terrassement, avant une couche de forme traitée"} à la dynaplaque (NF P94-117-2, plaque de 300 mm, σ = 0,1 MPa). En un point, les chutes de mesure donnent des enfoncements élastiques de ${s.map((x) => frd(x, 2)).join(" ; ")} mm. La planche d'étalonnage du chantier a établi, pour ce matériau, EV2 ≈ ${frd(alpha, 2)} × Evd.`,
        donnees: [donnee("Enfoncements", `${s.map((x) => frd(x, 2)).join(" · ")} mm`), donnee("Étalonnage", `EV2 ≈ ${frd(alpha, 2)} Evd`), donnee("Niveau", niveau)],
        questions: [
          nombre("Enfoncement moyen ?", r.sMoyen, "mm", `(${s.map((x) => frd(x, 2)).join(" + ")})/${s.length} = ${frd(r.sMoyen, 3)} mm.`, { rel: 0.01 }),
          nombre("Module dynamique Evd ?", r.Evd, "MPa", `Evd = 1,5 σ a / s = 1,5 × 0,1 × 150/${frd(r.sMoyen, 3)} = 22,5/${frd(r.sMoyen, 3)} = ${frd(r.Evd, 1)} MPa.`, { rel: 0.015 }),
          nombre("EV2 estimé par l'étalonnage ?", EV2, "MPa", `EV2 ≈ ${frd(alpha, 2)} × ${frd(r.Evd, 1)} = ${frd(EV2, 1)} MPa.`, { rel: 0.02 }),
          choixMelange(a, "Conclusion ?", [textes[ok ? 0 : 1], textes[ok ? 1 : 0], `on compare directement Evd au seuil de ${seuil} MPa`, "la dynaplaque ne renseigne pas sur la portance"],
            `EV2 ≈ ${frd(EV2, 1)} MPa ${ok ? "≥" : "<"} ${seuil} MPa. Le seuil du GTR est exprimé en EV2 : Evd ne s'y compare qu'à travers la relation établie sur la planche d'étalonnage, propre au matériau.`),
        ],
      };
    },
  },
  {
    id: "ch8-panda", titre: "Pénétromètre dynamique léger : un coup de marteau", difficulte: 2,
    generer(a) {
      const grave = a.reel() < 0.35, A = grave ? 4 : 2, M = 2;
      const n = a.choix([1, 2]), P = +(1.3 + 0.6 * n + 0.05).toFixed(2);
      const z = a.entre(0.08, 0.45, 0.01);
      let E = 20, e = 5, ref = grave ? 15 : 8, lim = grave ? 10 : 5;
      let qd = qdHollandais({ E, M, P, A, e }), cat = qd >= ref ? "dessus" : qd >= lim ? "entre" : "dessous";
      for (let i = 0; i < 100; i++) {
        ref = grave ? a.entre(12, 25, 0.5) : a.entre(4, 14, 0.5);
        lim = +(ref * a.entre(0.55, 0.75, 0.01)).toFixed(1);
        const voulu = a.choix(["dessus", "entre", "dessous"]);
        const qv = voulu === "dessus" ? ref * a.entre(1.08, 1.5, 0.01) : voulu === "entre" ? lim + (ref - lim) * a.entre(0.25, 0.75, 0.01) : lim * a.entre(0.5, 0.9, 0.01);
        // Enfoncement du coup, puis l'énergie qui le produit dans un sol de résistance qv (la formule lue à l'envers).
        const ee = a.entre(2, 9, 0.1);
        const EE = +((qv * ee) / enfoncementHollandais({ E: 1, M, P, A, qd: 1 })).toFixed(1);
        if (EE < 5 || EE > 65) continue;
        const q = qdHollandais({ E: EE, M, P, A, e: ee });
        if (Math.min(Math.abs(q / ref - 1), Math.abs(q / lim - 1)) <= 0.03) continue;
        [E, e, qd] = [EE, ee, q];
        cat = qd >= ref ? "dessus" : qd >= lim ? "entre" : "dessous";
        break;
      }
      const utile = (E * M) / (M + P);
      const TEXTES = {
        dessus: "au-dessus de la droite de référence : objectif de densification atteint à cette profondeur",
        entre: "entre la droite limite et la droite de référence : zone de tolérance, compactage jugé conforme",
        dessous: "sous la droite limite : anomalie de compactage à cette profondeur",
      };
      return {
        enonce: `Pénétromètre dynamique léger à énergie variable (XP P94-105) sur une couche de ${grave ? "grave" : "sol fin"} : marteau de M = ${M} kg, pointe de ${A} cm², masse frappée P = ${frd(P, 2)} kg (tête, ${n} tige${n > 1 ? "s" : ""} et pointe). À z = ${frd(z, 2)} m, le capteur mesure une énergie de coup E = ${frd(E, 1)} J et un enfoncement e = ${frd(e, 1)} mm. Pour ce matériau et l'objectif visé, les droites donnent à cette profondeur qd = ${frd(ref, 1)} MPa (référence) et ${frd(lim, 1)} MPa (limite).`,
        donnees: [donnee("M · P", `${M} kg · ${frd(P, 2)} kg`), donnee("A", `${A} cm²`), donnee("E · e", `${frd(E, 1)} J · ${frd(e, 1)} mm`), donnee("Droites à z", `${frd(ref, 1)} · ${frd(lim, 1)} MPa`)],
        questions: [
          nombre("Énergie transmise à la pointe E·M/(M + P) ?", utile, "J", `Le choc du marteau sur la masse frappée ne transmet que la part M/(M + P) : ${frd(E, 1)} × ${M}/${frd(M + P, 2)} = ${frd(utile, 2)} J.`, { rel: 0.01 }),
          nombre("Résistance de pointe qd (formule des Hollandais) ?", qd, "MPa", `qd = E·M/(M + P) / (A e) = ${frd(utile, 2)} J / (${A} × 10⁻⁴ m² × ${frd(e, 1)} × 10⁻³ m) = ${frd(qd, 2)} MPa.`, { rel: 0.02 }),
          choixMelange(a, "Que conclure à cette profondeur ?", [TEXTES[cat], ...Object.values(TEXTES).filter((x) => x !== TEXTES[cat]), "qd dépasse la droite de référence : le sol est trop compacté"],
            `qd = ${frd(qd, 2)} MPa pour ${frd(ref, 1)} MPa (référence) et ${frd(lim, 1)} MPa (limite) : ${TEXTES[cat]}. Le profil complet, coup par coup, montre où le compactage manque — très souvent en fond de couche.`),
        ],
      };
    },
  },
  {
    id: "ch8-tranches", titre: "Gammadensimètre : densité du fond de couche", difficulte: 3,
    generer(a) {
      const obj = a.choix(["q4", "q3"]), o = OBJECTIFS[obj];
      const e = a.choix([25, 30, 35, 40]);
      const z = [10, ...(e - 18 >= 8 ? [Math.round((e - 8 + 10) / 2)] : []), e - 8, e];
      const ref = a.entre(1.7, 2.15, 0.01), w = a.entre(6, 18, 0.1);
      let lus, mesures, moy, fond, c;
      for (let essai = 0; essai < 60; essai++) {
        // Profil réel des tranches (en % de ρdOPN) : densité décroissante vers le bas, parfois un fond de couche nettement plus lâche.
        const fondLache = a.reel() < 0.4;
        let tx = obj === "q4" ? a.entre(fondLache ? 98 : 96, 101, 0.5) : a.entre(fondLache ? 100.5 : 99.5, 103, 0.5);
        const taux = [];
        for (let i = 0; i < z.length; i++) {
          taux.push(tx);
          tx -= fondLache && i === z.length - 2 ? a.entre(4, 8, 0.5) : a.entre(0.5, fondLache ? 1.5 : 3, 0.5);
        }
        let M = 0, z0 = 0;
        lus = z.map((zi, i) => { M += (zi - z0) * (taux[i] / 100) * ref; z0 = zi; return { z: zi, rhoH: +((M / zi) * (1 + w / 100)).toFixed(3) }; });
        mesures = lus.map((m) => ({ z: m.z, rho: m.rhoH / (1 + w / 100) }));
        moy = densiteTranche(mesures, 0, e).rho; fond = densiteTranche(mesures, e - 8, e).rho;
        c = controleDensite({ rhoDmoy: moy, rhoDfc: fond, rhoDOPN: ref, objectif: obj });
        // Pas de verdict à quelques dixièmes d'un seuil : l'arrondi des calculs ne doit pas le renverser.
        if (Math.abs(c.tauxMoyen - o.moyen) > 0.3 && Math.abs(c.tauxFond - o.fond) > 0.6) break;
      }
      const ve = c.ok ? `objectif ${obj} atteint (moyenne et fond de couche)` : c.okMoyen ? `objectif ${obj} non atteint : la moyenne passe, le fond de couche non` : `objectif ${obj} non atteint : la densité moyenne est insuffisante`;
      const options = [`objectif ${obj} atteint (moyenne et fond de couche)`, `objectif ${obj} non atteint : la moyenne passe, le fond de couche non`, `objectif ${obj} non atteint : la densité moyenne est insuffisante`, "on ne peut pas conclure sans essai de plaque"];
      const d = (zz) => mesures.find((m) => m.z === zz).rho;
      const xs = lus.map((m) => m.rhoH);
      return {
        enonce: `Couche de ${obj === "q4" ? "remblai" : "forme"} de ${e} cm, ρdOPN = ${frd(ref, 2)} Mg/m³, teneur en eau w = ${frd(w, 1)} % (uniforme). Le gammadensimètre en transmission directe donne, pour chaque profondeur z de la source, la masse volumique humide moyenne entre la surface et z : ${lus.map((m) => `${m.z} cm → ${frd(m.rhoH, 3)} Mg/m³`).join(" ; ")}.`,
        donnees: [donnee("Épaisseur", `${e} cm`), donnee("ρdOPN", `${frd(ref, 2)} Mg/m³`), donnee("w", `${frd(w, 1)} %`), ...lus.map((m) => donnee(`ρh moyenne 0–${m.z} cm`, `${frd(m.rhoH, 3)} Mg/m³`))],
        figure: graphe({
          largeur: 560, hauteur: 260, xmin: Math.floor(Math.min(...xs) * 50 - 1) / 50, xmax: Math.ceil(Math.max(...xs) * 50 + 1) / 50, ymin: 0, ymax: e + 3, pasY: 5, inverserY: true,
          xlabel: "ρh moyenne de la surface à z (Mg/m³)", ylabel: "profondeur de la source z (cm)",
          zones: [{ x0: Math.floor(Math.min(...xs) * 50 - 1) / 50, x1: Math.ceil(Math.max(...xs) * 50 + 1) / 50, y0: e - 8, y1: e, couleur: "#f59e0b", opacite: 0.16, libelle: "fond de couche (8 cm)", position: "droite" }],
          series: [{ points: lus.map((m) => [m.rhoH, m.z]), couleur: COULEURS.bleu, epaisseur: 1.6, tirets: "4 3", marqueurs: true, libelle: "mesures en transmission directe" }],
        }),
        questions: [
          nombre("Masse volumique sèche moyenne de la couche ?", moy, "Mg/m³", `La mesure à z = ${e} cm couvre toute la couche : ρd = ${frd(lus.at(-1).rhoH, 3)}/${frd(1 + w / 100, 3)} = ${frd(moy, 3)} Mg/m³ (${frd(c.tauxMoyen, 1)} % de ρdOPN).`, { rel: 0.004 }),
          nombre(`Masse volumique sèche du fond de couche (${e - 8} à ${e} cm) ?`, fond, "Mg/m³", `ρd moyennes : ${frd(d(e - 8), 3)} Mg/m³ sur 0–${e - 8} cm et ${frd(d(e), 3)} Mg/m³ sur 0–${e} cm ; par différence, ρ = (${e} × ${frd(d(e), 3)} − ${e - 8} × ${frd(d(e - 8), 3)})/8 = ${frd(fond, 3)} Mg/m³.`, { rel: 0.008 }),
          nombre("Taux de compactage du fond de couche ?", c.tauxFond, "%", `${frd(fond, 3)}/${frd(ref, 2)} = ${frd(c.tauxFond, 1)} % de ρdOPN, pour ${frd(o.fond, 0)} % exigés en fond de couche par ${OBJ[obj]}.`, { abs: 0.8 }),
          choixMelange(a, "Verdict ?", [ve, ...options.filter((x) => x !== ve)],
            `Moyenne ${frd(c.tauxMoyen, 1)} % (≥ ${frd(o.moyen, 1)} % exigés) ; fond de couche ${frd(c.tauxFond, 1)} % (≥ ${frd(o.fond, 0)} % exigés) : ${ve}.${c.okMoyen && !c.okFond ? " La couche est trop épaisse pour ce compacteur, ou le compacteur trop léger : réduire l'épaisseur est plus efficace qu'ajouter des passes." : ""}`),
        ],
      };
    },
  },
  {
    id: "ch8-seuils", titre: "Arase et plateforme : les seuils du chantier", difficulte: 3,
    generer(a) {
      let z2a, ra, dec;
      for (let i = 0; i < 50; i++) {
        const EV2 = a.choix([a.entre(8, 14, 0.5), a.entre(21, 33, 0.5), a.entre(37, 90, 0.5)]);
        z2a = +(90 / EV2).toFixed(2);
        ra = plaque({ z1: 1.6 * z2a, z2: z2a });
        dec = coucheDeFormePossible(ra.EV2);
        if (dec && [15, 20, 35].every((x) => Math.abs(ra.EV2 - x) > 0.6)) break;
      }
      const unite = plaque({ z1: 1, z2: 1 }).EV2; // 90 MPa·mm : EV2 = 90/z2
      const z2max = unite / SEUIL_PLATEFORME, z2maxArase = unite / 35;
      const EVp = autourDe(a, SEUIL_PLATEFORME, 0.7, 1.6), z2p = +(90 / EVp).toFixed(2), rp = plaque({ z1: 1.5 * z2p, z2: z2p });
      const okP = rp.EV2 >= SEUIL_PLATEFORME;
      return {
        enonce: `Avant de construire la couche de forme, un essai de plaque sur l'arase donne z2 = ${frd(z2a, 2)} mm au second chargement. Plus tard, sur la plateforme achevée, on lit z2 = ${frd(z2p, 2)} mm. (Plaque de 600 mm : EV2 = 90/z2, z2 en mm.)`,
        donnees: [donnee("z2 sur l'arase", `${frd(z2a, 2)} mm`), donnee("z2 sur la plateforme", `${frd(z2p, 2)} mm`)],
        questions: [
          nombre("EV2 de l'arase ?", ra.EV2, "MPa", `EV2 = 90/${frd(z2a, 2)} = ${frd(ra.EV2, 1)} MPa.`, { rel: 0.01 }),
          choixMelange(a, "Quelle couche de forme peut-on exécuter sur cette arase ?", [DECISIONS_ARASE[dec], ...Object.values(DECISIONS_ARASE).filter((x) => x !== DECISIONS_ARASE[dec]), "toute couche de forme, l'arase n'a pas d'exigence de portance"],
            `Seuils du GTR (F1 § 4.1.3) : 35 MPa sur l'arase pour une couche de forme traitée, 15 à 20 MPa pour une couche de forme granulaire. EV2 = ${frd(ra.EV2, 1)} MPa → ${DECISIONS_ARASE[dec]}.`),
          nombre("Enfoncement z2 maximal admissible sur la plateforme pour construire la chaussée ?", z2max, "mm", `EV2 > ${SEUIL_PLATEFORME} MPa ⇔ z2 < 90/${SEUIL_PLATEFORME} = ${frd(z2max, 2)} mm (sur l'arase, pour une couche de forme traitée : 90/35 = ${frd(z2maxArase, 2)} mm).`, { rel: 0.01 }),
          choixMelange(a, "La chaussée peut-elle être construite sur la plateforme ?", [okP ? `oui : EV2 = ${frd(rp.EV2, 0)} MPa > ${SEUIL_PLATEFORME} MPa` : `non : EV2 = ${frd(rp.EV2, 0)} MPa < ${SEUIL_PLATEFORME} MPa`, okP ? `non : EV2 = ${frd(rp.EV2, 0)} MPa < ${SEUIL_PLATEFORME} MPa` : `oui : EV2 = ${frd(rp.EV2, 0)} MPa > ${SEUIL_PLATEFORME} MPa`, "oui, dès que l'arase dépassait 35 MPa", "on ne peut pas conclure sans le rapport k"],
            `z2 = ${frd(z2p, 2)} mm ${okP ? "<" : ">"} ${frd(z2max, 2)} mm : EV2 = 90/${frd(z2p, 2)} = ${frd(rp.EV2, 1)} MPa. Au moment de construire la chaussée, la plateforme doit offrir plus de 50 MPa (ou une déflexion de moins de 2 mm sous l'essieu de 13 t), et un nivellement dans la tolérance du marché.`),
        ],
      };
    },
  },
];
