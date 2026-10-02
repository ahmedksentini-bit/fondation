// Exercices du chapitre 1 : les terrassements et le guide GTR — objectifs de
// densification q4 et q3, zones d'un remblai, de l'arase à la plateforme,
// profils en travers, démarche du guide et passage de l'édition 1992 à 2024.
import { fr, frd, nombre, choixMelange, donnee } from "./alea.js";
import { controleDensite, OBJECTIFS } from "../gtr/compactage.js";
import { profilTravers, coteEn, foisonnement, coefficientCompactage } from "../gtr/cubatures.js";
import { graphe, svg, texte, ligne, solDe, COULEURS } from "../figures.js";

const pc = (x) => `${frd(x, 1)} %`;
const mg = (x, d = 2) => `${frd(x, d)} Mg/m³`;
const arrondi = (x, n = 2) => Math.round(x * 10 ** n) / 10 ** n;
/** Signe moins typographique pour une abscisse. */
const moins = (s) => String(s).replace(/^-/, "−");

/** Libellé d'un objectif, avec les pourcentages lus dans OBJECTIFS (ou ceux d'un autre, pour les distracteurs). */
const libelleObjectif = (nom, valeurs = OBJECTIFS[nom]) => `${nom} : ${fr(valeurs.moyen)} % de ρdOPN en moyenne, ${fr(valeurs.fond)} % en fond de couche`;

/**
 * Taux de compactage (moyen, fond) tirés pour un cas donné, puis convertis
 * en masses volumiques arrondies au centième ; on retire les tirages trop
 * proches d'un seuil, où l'arrondi de l'énoncé ferait douter du verdict.
 */
function tirerCouche(a, rhoDOPN, cas, seuils) {
  let rm = NaN, rf = NaN;
  for (let k = 0; k < 60; k++) {
    const [tm, tf] = cas(a);
    rm = arrondi((tm / 100) * rhoDOPN);
    rf = arrondi((tf / 100) * rhoDOPN);
    const t1 = (100 * rm) / rhoDOPN, t2 = (100 * rf) / rhoDOPN;
    if (rf < rm && seuils.every(([moy, fond]) => Math.abs(t1 - moy) >= 0.25 && Math.abs(t2 - fond) >= 0.25)) break;
  }
  return { rm, rf };
}

// Zones d'un remblai d'infrastructure selon la NF EN 16907-1, comme le cours les décrit [F1 § 1.6].
const ZONES = [
  { lettre: "A", nom: "la base", role: "la zone au contact du terrain en place, qui assure souvent le drainage" },
  { lettre: "B", nom: "le noyau", role: "le corps du remblai, qui en fait l'essentiel du volume" },
  { lettre: "C", nom: "les encagements", role: "les bords du remblai : talus, filtres, protections" },
  { lettre: "D", nom: "la zone supérieure", role: "la zone qui réunit la PST et la couche de forme" },
  { lettre: "S", nom: "la superstructure", role: "la chaussée, construite sur la plateforme" },
];
// Objectif de densification de chaque élément [F1 § 1.6] : q4 pour le remblai (noyau, base, PST), q3 pour la couche de forme.
const ELEMENTS = [
  { nom: "le noyau (B)", lettre: "B", objectif: "q4" }, { nom: "la base (A)", lettre: "A", objectif: "q4" },
  { nom: "la PST, partie basse de la zone D", lettre: "D", objectif: "q4" }, { nom: "la couche de forme, partie haute de la zone D", lettre: "D", objectif: "q3" },
];

/** Coupe d'un remblai dont les zones ne sont repérées que par leur lettre (géométrie du schéma du cours). */
function figureZones() {
  const n1 = (x) => x.toFixed(1);
  const poly = (pts, attrs) => `<path d="M${pts.map(([x, y]) => `${n1(x)} ${n1(y)}`).join("L")}Z" ${attrs}/>`;
  return svg({ largeur: 640, hauteur: 290, titre: "Coupe d'un remblai : zones repérées par une lettre", contenu: (id) => {
    const yb = 240, yh = 66, xg0 = 40, xd0 = 600, xg1 = 220, xd1 = 420;
    const terrain = solDe("argile"), remblai = solDe("remblai"), forme = solDe("forme");
    const sous = [[0, yb], [640, yb], [640, 290], [0, 290]];
    let s = poly(sous, `fill="${terrain.fond}"`) + poly(sous, `fill="url(#${id}-${terrain.motif})"`);
    s += poly([[xg0 + 8, yb], [xd0 - 8, yb], [xd0 - 30, yb - 22], [xg0 + 30, yb - 22]], `fill="#d6d3d1"`);
    const noyau = [[xg0 + 64, yb - 22], [xd0 - 64, yb - 22], [xd1 + 6, yh + 46], [xg1 - 6, yh + 46]];
    s += poly(noyau, `fill="${remblai.fond}"`) + poly(noyau, `fill="url(#${id}-${remblai.motif})"`);
    s += poly([[xg0 + 30, yb - 22], [xg0 + 64, yb - 22], [xg1 - 6, yh + 46], [xg1 - 30, yh + 46]], `fill="#bbf7d0" fill-opacity=".8"`);
    s += poly([[xd0 - 30, yb - 22], [xd0 - 64, yb - 22], [xd1 + 6, yh + 46], [xd1 + 30, yh + 46]], `fill="#bbf7d0" fill-opacity=".8"`);
    s += poly([[xg1 - 30, yh + 46], [xd1 + 30, yh + 46], [xd1 + 12, yh + 22], [xg1 - 12, yh + 22]], `fill="#fde68a" fill-opacity=".85"`);
    s += poly([[xg1 - 12, yh + 22], [xd1 + 12, yh + 22], [xd1 + 4, yh + 10], [xg1 - 4, yh + 10]], `fill="${forme.fond}"`);
    s += poly([[xg1 + 20, yh + 10], [xd1 - 20, yh + 10], [xd1 - 26, yh], [xg1 + 26, yh]], `fill="#475569"`);
    s += `<path d="M${xg0} ${yb}L${xg1} ${yh + 10}L${xd1} ${yh + 10}L${xd0} ${yb}" fill="none" stroke="${COULEURS.trait}" stroke-width="2"/>`;
    s += ligne(0, yb, 640, yb, COULEURS.trait, 1.6);
    const pastille = (x, y, l) => `<circle cx="${x}" cy="${y}" r="11" fill="#0f172a"/>` + texte(x, y + 4, l, 'text-anchor="middle" style="font-size:12px;font-weight:900;fill:#fff"');
    s += pastille(320, yb - 11, "A") + pastille(320, 168, "B") + pastille(118, 196, "C") + pastille(522, 196, "C") + pastille(320, yh + 34, "D") + pastille(320, yh - 14, "S");
    s += texte(14, yb + 32, "terrain en place", 'class="halo" style="font-size:11.5px;font-weight:700"');
    return s;
  } });
}

// Caractères distinctifs des deux éditions, d'après la comparaison du cours (chapitres 1, 2 et 5).
const EDITIONS = [
  ["Les fines sont mesurées au tamis de 80 µm, sur la fraction 0/50 mm.", 1992],
  ["Les fines sont mesurées au tamis de 63 µm, sur la fraction 0/63 mm.", 2024],
  ["Un sol dont le Dmax dépasse 50 mm est rangé dans la classe C.", 1992],
  ["Un sol dont le Dmax dépasse 63 mm est rangé dans la classe VC.", 2024],
  ["Les seuils d'IP des sols fins sont 12, 25 et 40.", 1992],
  ["Les seuils d'IP des sols fins sont 12, 22, 40 et 55.", 2024],
  ["Le coefficient d'uniformité Cu sépare les granulométries étalées et uniformes.", 2024],
  ["Les sols insensibles à l'eau forment une classe à part, la classe D.", 1992],
  ["Les sables et graves insensibles à l'eau portent le suffixe « ins ».", 2024],
  ["La plateforme PF2qs, de 80 à 120 MPa, figure parmi les classes de plateforme.", 2024],
  ["Les sols fins sont les classes A1 à A4.", 1992],
  ["Les sols fins sont les classes F1 à F4.", 2024],
  ["Les sols riches en fines commencent à 12 % de passant au tamis des fines.", 1992],
  ["Les seuils de fines sont 5, 15 et 35 %.", 2024],
];
const NOM_EDITION = { 1992: "GTR 1992 (NF P11-300)", 2024: "GTR 2024 (NF EN 16907-2)" };

export default [
  {
    id: "ch1-q4", titre: "Objectif q4 : contrôler une couche de remblai", difficulte: 1,
    generer(a) {
      const o = OBJECTIFS.q4;
      const rhoDOPN = a.entre(1.65, 2.1, 0.01);
      const cas = a.choix([
        (b) => { const tm = b.entre(95.6, 99.5, 0.1); return [tm, b.entre(92.4, Math.min(tm - 1, 96), 0.1)]; },
        (b) => [b.entre(95.6, 99, 0.1), b.entre(87.5, 91.6, 0.1)],
        (b) => { const tm = b.entre(92.8, 94.6, 0.1); return [tm, b.entre(92.3, tm - 0.4, 0.1)]; },
        (b) => { const tm = b.entre(89.5, 94.6, 0.1); return [tm, b.entre(85.5, Math.min(tm - 1, 91.6), 0.1)]; },
      ]);
      const { rm, rf } = tirerCouche(a, rhoDOPN, cas, [[o.moyen, o.fond]]);
      const c = controleDensite({ rhoDmoy: rm, rhoDfc: rf, rhoDOPN, objectif: "q4" });
      const verdicts = {
        11: "objectif q4 atteint : moyenne et fond de couche conformes",
        10: "non atteint : la moyenne passe, mais le fond de couche est insuffisant",
        "01": "non atteint : le fond de couche passe, mais la moyenne est insuffisante",
        "00": "non atteint : moyenne et fond de couche insuffisants",
      };
      const cle = `${c.okMoyen ? 1 : 0}${c.okFond ? 1 : 0}`;
      const conseil = cle === "10" ? " La couche est sans doute trop épaisse pour ce compacteur, ou les passes trop peu nombreuses : des passes en plus ne rattrapent pas le fond si l'épaisseur dépasse celle du tableau de compactage."
        : cle === "11" ? "" : " La couche est à reprendre (passes supplémentaires ou scarification et recompactage), après avoir vérifié l'état hydrique du matériau.";
      return {
        enonce: `Une couche du noyau d'un remblai est contrôlée au gammadensimètre. Le matériau a une masse volumique sèche à l'optimum Proctor normal ρdOPN = ${mg(rhoDOPN)}. On mesure ρdm = ${mg(rm)} en moyenne sur la couche et ρdfc = ${mg(rf)} dans ses 8 cm inférieurs.`,
        donnees: [donnee("ρdOPN", mg(rhoDOPN)), donnee("ρd moyenne", mg(rm)), donnee("ρd fond de couche", mg(rf)), donnee("Objectif", "q4 (remblai)")],
        questions: [
          nombre("Masse volumique sèche moyenne exigée par q4 ?", c.rhoDmoyRequis, "Mg/m³", `q4 : ρdm ≥ ${fr(o.moyen)} % ρdOPN = ${fr(o.moyen / 100, 4)} × ${frd(rhoDOPN, 2)} = ${frd(c.rhoDmoyRequis, 3)} Mg/m³.`, { rel: 0.005 }),
          nombre("Minimum exigé en fond de couche ?", c.rhoDfcRequis, "Mg/m³", `q4 : ρdfc ≥ ${fr(o.fond)} % ρdOPN = ${fr(o.fond / 100, 4)} × ${frd(rhoDOPN, 2)} = ${frd(c.rhoDfcRequis, 3)} Mg/m³.`, { rel: 0.005 }),
          nombre("Taux de compactage moyen mesuré (en % de ρdOPN) ?", c.tauxMoyen, "%", `${frd(rm, 2)} / ${frd(rhoDOPN, 2)} = ${pc(c.tauxMoyen)}.`, { abs: 0.3 }),
          nombre("Taux de compactage en fond de couche ?", c.tauxFond, "%", `${frd(rf, 2)} / ${frd(rhoDOPN, 2)} = ${pc(c.tauxFond)}.`, { abs: 0.3 }),
          choixMelange(a, "Verdict du contrôle ?", [verdicts[cle], ...Object.entries(verdicts).filter(([k]) => k !== cle).map(([, v]) => v)],
            `Moyenne : ${pc(c.tauxMoyen)} ${c.okMoyen ? "≥" : "<"} 95 % ; fond de couche : ${pc(c.tauxFond)} ${c.okFond ? "≥" : "<"} 92 %. Les deux critères sont exigés ensemble.${conseil}`),
        ],
      };
    },
  },
  {
    id: "ch1-q3-inverse", titre: "Couche de forme : jusqu'où peut aller ρdOPN ?", difficulte: 3,
    generer(a) {
      const q3 = OBJECTIFS.q3, q4 = OBJECTIFS.q4;
      const rhoDOPN = a.entre(1.95, 2.25, 0.01), autre = arrondi(rhoDOPN - a.entre(0.02, 0.07, 0.01));
      const cas = a.choix([
        (b) => { const tm = b.entre(98.9, 101, 0.1); return [tm, b.entre(96.4, Math.min(tm - 1.2, 98.5), 0.1)]; },
        (b) => { const tm = b.entre(95.6, 98.1, 0.1); return [tm, b.entre(92.4, tm - 1, 0.1)]; },
        (b) => { const tm = b.entre(98.9, 100.5, 0.1); return [tm, b.entre(92.6, 95.6, 0.1)]; },
        (b) => { const tm = b.entre(91, 94.6, 0.1); return [tm, b.entre(87, Math.min(tm - 1, 91.6), 0.1)]; },
      ]);
      const { rm, rf } = tirerCouche(a, rhoDOPN, cas, [[q3.moyen, q3.fond], [q4.moyen, q4.fond]]);
      const limMoy = rm / (q3.moyen / 100), limFond = rf / (q3.fond / 100), lim = Math.min(limMoy, limFond);
      const c3 = controleDensite({ rhoDmoy: rm, rhoDfc: rf, rhoDOPN, objectif: "q3" });
      const c4 = controleDensite({ rhoDmoy: rm, rhoDfc: rf, rhoDOPN, objectif: "q4" });
      const verdicts = ["conforme à q3 : elle convient en couche de forme", "conforme à q4 seulement : suffisante pour un remblai, pas pour une couche de forme", "non conforme, même à l'objectif q4 d'un remblai"];
      const bon = c3.ok ? verdicts[0] : c4.ok ? verdicts[1] : verdicts[2];
      return {
        enonce: `Sur une planche de couche de forme, le gammadensimètre donne ρdm = ${mg(rm)} en moyenne et ρdfc = ${mg(rf)} en fond de couche. Deux essais Proctor normal du même matériau ont donné ρdOPN = ${mg(autre)} et ${mg(rhoDOPN)} ; on retient la valeur la plus forte, qui est la plus sévère.`,
        donnees: [donnee("ρd moyenne", mg(rm)), donnee("ρd fond de couche", mg(rf)), donnee("ρdOPN (essais)", `${frd(autre, 2)} · ${frd(rhoDOPN, 2)} Mg/m³`), donnee("Objectif", "q3 (couche de forme)")],
        questions: [
          nombre("Au-delà de quelle valeur de ρdOPN la moyenne ne satisfait-elle plus q3 ?", limMoy, "Mg/m³", `q3 : ρdm ≥ ${fr(q3.moyen / 100, 4)} ρdOPN, soit ρdOPN ≤ ρdm / ${fr(q3.moyen / 100, 4)} = ${frd(rm, 2)} / ${fr(q3.moyen / 100, 4)} = ${frd(limMoy, 3)} Mg/m³.`, { rel: 0.004 }),
          nombre("Même question pour le fond de couche ?", limFond, "Mg/m³", `q3 : ρdfc ≥ ${fr(q3.fond / 100, 4)} ρdOPN, soit ρdOPN ≤ ${frd(rf, 2)} / ${fr(q3.fond / 100, 4)} = ${frd(limFond, 3)} Mg/m³.`, { rel: 0.004 }),
          nombre("Plus grande valeur de ρdOPN compatible avec l'objectif q3 ?", lim, "Mg/m³", `Les deux critères doivent tenir : min(${frd(limMoy, 3)} ; ${frd(limFond, 3)}) = ${frd(lim, 3)} Mg/m³ — c'est le ${limMoy <= limFond ? "critère de la moyenne" : "critère du fond de couche"} qui limite.`, { rel: 0.004 }),
          choixMelange(a, `Avec ρdOPN = ${frd(rhoDOPN, 2)} Mg/m³, la planche est…`, [bon, ...verdicts.filter((v) => v !== bon)],
            `Taux mesurés : ${pc(c3.tauxMoyen)} en moyenne et ${pc(c3.tauxFond)} en fond de couche. q3 demande 98,5 % et 96 % : ${c3.ok ? "tenu" : "non tenu"} ; q4 demande 95 % et 92 % : ${c4.ok ? "tenu" : "non tenu"}. ${rhoDOPN <= lim + 1e-9 ? `ρdOPN = ${frd(rhoDOPN, 2)} reste sous la limite de ${frd(lim, 3)} Mg/m³.` : `ρdOPN = ${frd(rhoDOPN, 2)} dépasse la limite de ${frd(lim, 3)} Mg/m³.`}`),
        ],
      };
    },
  },
  {
    id: "ch1-zones", titre: "Les zones d'un remblai et leur objectif", difficulte: 1,
    generer(a) {
      // La zone demandée n'est jamais celle que l'élément étudié nomme déjà par sa lettre.
      const el = a.choix(ELEMENTS), z = a.choix(ZONES.filter((x) => x.lettre !== el.lettre)), o = OBJECTIFS[el.objectif];
      const rhoDOPN = a.entre(1.6, 2.15, 0.01);
      const options = [libelleObjectif("q4"), libelleObjectif("q3"), libelleObjectif("q4", OBJECTIFS.q3), libelleObjectif("q3", OBJECTIFS.q4)];
      const bonne = libelleObjectif(el.objectif);
      return {
        enonce: `La figure montre la coupe d'un remblai routier dont les zones, au sens de la NF EN 16907-1, ne sont repérées que par une lettre. Le matériau de l'élément étudié a une masse volumique sèche à l'optimum Proctor normal ρdOPN = ${mg(rhoDOPN)}.`,
        donnees: [donnee("Élément étudié", el.nom), donnee("ρdOPN", mg(rhoDOPN))],
        figure: figureZones(),
        questions: [
          choixMelange(a, `Quelle lettre désigne ${z.role} ?`, [z.lettre, ...ZONES.filter((x) => x.lettre !== z.lettre).map((x) => x.lettre)],
            `${z.lettre} : ${z.nom}. ${ZONES.map((x) => `${x.lettre} ${x.nom}`).join(" ; ")}. Dans la plupart des remblais routiers, ces zones se confondent et le remblai est dit homogène.`),
          choixMelange(a, `Quel objectif de densification vise-t-on pour ${el.nom} ?`, [bonne, ...options.filter((x) => x !== bonne)],
            `${el.objectif === "q3" ? "La couche de forme porte directement la chaussée : objectif q3" : "Le noyau, la base et la PST relèvent de l'objectif du remblai, q4"} (${libelleObjectif(el.objectif)}) [F1 § 1.6].`),
          nombre("Masse volumique sèche moyenne minimale de cet élément ?", (o.moyen / 100) * rhoDOPN, "Mg/m³", `${fr(o.moyen)} % × ${frd(rhoDOPN, 2)} = ${frd((o.moyen / 100) * rhoDOPN, 3)} Mg/m³.`, { rel: 0.005 }),
          nombre("Et le minimum en fond de couche ?", (o.fond / 100) * rhoDOPN, "Mg/m³", `${fr(o.fond)} % × ${frd(rhoDOPN, 2)} = ${frd((o.fond / 100) * rhoDOPN, 3)} Mg/m³ — les 8 cm inférieurs, les plus difficiles à atteindre.`, { rel: 0.005 }),
        ],
      };
    },
  },
  {
    id: "ch1-cotes", titre: "De l'arase à la plateforme : cotes et vocabulaire", difficulte: 1,
    generer(a) {
      const remblai = a.reel() < 0.5;
      const zPF = a.entre(80, 160, 0.01), e = a.choix([0.35, 0.4, 0.5, 0.6, 0.7, 0.8]), h = a.entre(1.5, 9, 0.05);
      const zAR = arrondi(zPF - e), zTN = arrondi(remblai ? zAR - h : zAR + h), zPST = arrondi(zAR - 1);
      const hauteur = Math.abs(zAR - zTN);
      const termes = [
        ["la partie supérieure des terrassements (PST)", "le mètre supérieur environ des terrains en place (en déblai) ou des matériaux rapportés (en remblai)"],
        ["l'arase de terrassement (AR)", "la surface de la PST, que les engins de terrassement laissent derrière eux"],
        ["la couche de forme", "la structure d'adaptation, parfois absente, entre l'arase et la chaussée"],
        ["la plateforme support de chaussée (PF)", "la surface sur laquelle on construit la chaussée"],
      ];
      const [terme, definition] = a.choix(termes);
      const pst = remblai ? "de matériaux rapportés et compactés : c'est le haut du remblai" : "du terrain en place, mis à nu par le déblai";
      return {
        enonce: `Au droit d'un profil ${remblai ? "en remblai" : "en déblai"}, la plateforme support de chaussée est calée à la cote ${frd(zPF, 2)} m. Elle est la surface d'une couche de forme de ${fr(Math.round(e * 100))} cm posée sur l'arase. À l'axe, le terrain naturel est à la cote ${frd(zTN, 2)} m.`,
        donnees: [donnee("Cote de la plateforme", `${frd(zPF, 2)} m`), donnee("Couche de forme", `${fr(Math.round(e * 100))} cm`), donnee("Terrain naturel à l'axe", `${frd(zTN, 2)} m`)],
        questions: [
          nombre("Cote de l'arase ?", zAR, "m", `L'arase porte la couche de forme : ${frd(zPF, 2)} − ${frd(e, 2)} = ${frd(zAR, 2)} m.`, { abs: 0.01 }),
          nombre(remblai ? "Hauteur de remblai sous l'arase, à l'axe ?" : "Profondeur de déblai jusqu'à l'arase, à l'axe ?", hauteur, "m",
            remblai ? `Le terrain est sous l'arase : ${frd(zAR, 2)} − ${frd(zTN, 2)} = ${frd(hauteur, 2)} m de matériaux à rapporter.` : `Le terrain est au-dessus de l'arase : ${frd(zTN, 2)} − ${frd(zAR, 2)} = ${frd(hauteur, 2)} m de terrain à enlever.`, { abs: 0.01 }),
          nombre("Cote du bas de la PST ?", zPST, "m", `La PST est le mètre supérieur des terrassements, sous l'arase : ${frd(zAR, 2)} − 1 = ${frd(zPST, 2)} m.`, { abs: 0.01 }),
          choixMelange(a, "Ici, la PST est faite…", [pst, remblai ? "du terrain en place, mis à nu par le déblai" : "de matériaux rapportés et compactés : c'est le haut du remblai", "des matériaux de la couche de forme"],
            `${remblai ? "En remblai" : "En déblai"}, la PST est le mètre supérieur ${remblai ? "des matériaux rapportés" : "des terrains en place"} [F1 § 4.1.1]. La couche de forme est au-dessus de l'arase, pas dans la PST.`),
          choixMelange(a, `Quel nom porte ${definition} ?`, [terme, ...termes.map(([t]) => t).filter((t) => t !== terme)],
            `${terme.charAt(0).toUpperCase() + terme.slice(1)} : ${definition}. Sans couche de forme, la plateforme est l'arase elle-même.`),
        ],
      };
    },
  },
  {
    id: "ch1-profil", titre: "Profil en travers : déblai, remblai ou mixte ?", difficulte: 2,
    generer(a) {
      const type = a.choix(["déblai", "remblai", "mixte"]);
      const xs = [-30, -15, 0, 15, 30];
      let tn, zAxe, l, p;
      for (let essai = 0; essai < 60; essai++) {
        const pente = (type === "mixte" ? a.entre(0.1, 0.22, 0.01) : a.entre(0.02, 0.14, 0.01)) * (a.reel() < 0.5 ? 1 : -1);
        const z0 = a.entre(85, 160, 0.1);
        tn = xs.map((x) => [x, arrondi(z0 + pente * x + (x === 0 ? 0 : a.entre(-0.4, 0.4, 0.05)))]);
        l = a.choix([5, 6, 7]);
        const zs = [-l, 0, l].map((x) => coteEn(tn, x));
        zAxe = arrondi(type === "remblai" ? Math.max(...zs) + a.entre(1, 5, 0.05)
          : type === "déblai" ? Math.min(...zs) - a.entre(1.2, 5, 0.05) : coteEn(tn, 0) + a.entre(-0.6, 0.6, 0.05));
        if (Math.abs(coteEn(tn, 0) - zAxe) < 0.2) continue;
        p = profilTravers({ tn, zAxe, lg: l, ld: l, devers: 2.5, fd: 1, fr: 1.5 });
        if (!p.applicable || p.emprise[0] < -28 || p.emprise[1] > 28) continue;
        const calcule = p.deblai > 1 && p.remblai > 1 ? "mixte" : p.remblai < 1e-6 ? "déblai" : p.deblai < 1e-6 ? "remblai" : null;
        if (calcule === type) break;
      }
      const deblaiAxe = coteEn(tn, 0) > zAxe, hAxe = Math.abs(coteEn(tn, 0) - zAxe);
      const zBord = zAxe - 0.025 * l, tnBord = coteEn(tn, l), hBord = Math.abs(tnBord - zBord);
      const typeSolveur = p.deblai > 0 && p.remblai > 0 ? "mixte" : p.deblai > 0 ? "déblai" : "remblai";
      const types = { mixte: "mixte : déblai d'un côté de l'axe, remblai de l'autre", déblai: "en déblai sur toute sa largeur", remblai: "en remblai sur toute sa largeur" };
      const vus = [...tn.filter(([x]) => x > p.emprise[0] - 4 && x < p.emprise[1] + 4)];
      const x0 = Math.max(-30, Math.floor(p.emprise[0] - 4)), x1 = Math.min(30, Math.ceil(p.emprise[1] + 4));
      const ligneTN = [[x0, coteEn(tn, x0)], ...vus.filter(([x]) => x > x0 && x < x1), [x1, coteEn(tn, x1)]];
      const cotes = [...ligneTN.map((q) => q[1]), ...p.projet.map((q) => q[1])];
      const ymin = Math.floor(Math.min(...cotes) - 1), ymax = Math.ceil(Math.max(...cotes) + 1);
      const figure = graphe({
        largeur: 600, hauteur: 260, xmin: x0, xmax: x1, ymin, ymax, xlabel: "distance à l'axe x (m)", ylabel: "cote (m)",
        series: [
          { points: [[0, ymin], [0, ymax]], couleur: "#94a3b8", tirets: "3 3", epaisseur: 1, libelle: "axe" },
          { points: ligneTN, couleur: "#92400e", tirets: "7 4", epaisseur: 2, libelle: "terrain naturel" },
          { points: p.projet, couleur: COULEURS.encre, epaisseur: 2.4, libelle: "projet : arase et talus" },
        ],
      });
      const seg = l <= 15 ? `entre x = 0 (${frd(tn[2][1], 2)} m) et x = 15 m (${frd(tn[3][1], 2)} m)` : "";
      return {
        enonce: `Sur un profil en travers, le terrain naturel passe par les points (x ; z) ${tn.map(([x, z]) => `(${moins(fr(x))} ; ${frd(z, 2)})`).join(", ")}, x étant compté en mètres depuis l'axe, positif à droite. L'arase est calée à ${frd(zAxe, 2)} m à l'axe, avec un dévers de 2,5 % vers chaque bord d'une plateforme de terrassement de 2 × ${l} m ; talus de déblai à 1/1, de remblai à 3/2.`,
        donnees: [donnee("Arase à l'axe", `${frd(zAxe, 2)} m`), donnee("Demi-largeur", `${l} m`), donnee("Dévers", "2,5 %"), donnee("Talus", "déblai 1/1 · remblai 3/2")],
        figure,
        questions: [
          choixMelange(a, "À l'axe, est-on en déblai ou en remblai ?", [deblaiAxe ? "en déblai : le terrain naturel est au-dessus de l'arase" : "en remblai : le terrain naturel est sous l'arase",
            deblaiAxe ? "en remblai : le terrain naturel est sous l'arase" : "en déblai : le terrain naturel est au-dessus de l'arase", "ni l'un ni l'autre : l'arase suit le terrain naturel"],
          `À l'axe, le terrain est à ${frd(coteEn(tn, 0), 2)} m et l'arase à ${frd(zAxe, 2)} m : ${deblaiAxe ? "il faut enlever du terrain (déblai)" : "il faut rapporter des matériaux (remblai)"}.`),
          nombre("Épaisseur à enlever ou à rapporter à l'axe ?", hAxe, "m", `|${frd(coteEn(tn, 0), 2)} − ${frd(zAxe, 2)}| = ${frd(hAxe, 2)} m.`, { abs: 0.02 }),
          nombre(`Cote de l'arase au bord droit (x = ${l} m) ?`, zBord, "m", `Le dévers abaisse le bord : ${frd(zAxe, 2)} − 0,025 × ${l} = ${frd(zBord, 3)} m.`, { abs: 0.01 }),
          nombre(`Au bord droit, épaisseur à enlever ou à rapporter ?`, hBord, "m", `Terrain naturel en x = ${l} m, interpolé ${seg} : ${frd(tnBord, 3)} m ; |${frd(tnBord, 3)} − ${frd(zBord, 3)}| = ${frd(hBord, 2)} m, ${tnBord > zBord ? "en déblai" : "en remblai"}.`, { abs: 0.03 }),
          choixMelange(a, "Ce profil en travers est…", [types[typeSolveur], ...Object.entries(types).filter(([k]) => k !== typeSolveur).map(([, v]) => v)],
            `Entre les deux extrémités de l'emprise (x = ${moins(frd(p.emprise[0], 1))} et ${moins(frd(p.emprise[1], 1))} m), le projet laisse ${frd(p.deblai, 1)} m² de déblai et ${frd(p.remblai, 1)} m² de remblai : profil ${typeSolveur === "mixte" ? "mixte" : `en ${typeSolveur}`}. Un tracé économe équilibre ses déblais et ses remblais.`),
        ],
      };
    },
  },
  {
    id: "ch1-foisonnement", titre: "Du déblai au remblai : vides et volumes", difficulte: 2,
    generer(a) {
      const V = a.entre(2000, 20000, 500), rhoPlace = a.entre(1.6, 1.95, 0.01), Cf = a.entre(1.15, 1.35, 0.05);
      const rhoDOPN = arrondi(rhoPlace * a.entre(0.98, 1.16, 0.01));
      const rhoRemblai = (OBJECTIFS.q4.moyen / 100) * rhoDOPN;
      const Ct = coefficientCompactage({ rhoDplace: rhoPlace, rhoDremblai: rhoRemblai });
      const v = foisonnement({ Vplace: V, Cf, Ct });
      const benne = a.choix([10, 12, 14, 16]), rotations = Math.ceil(v.Vfoisonne / benne - 1e-9);
      return {
        enonce: `Un déblai doit fournir ${fr(V, 5)} m³ en place d'un sol réemployable en remblai. En place, sa masse volumique sèche vaut ${mg(rhoPlace)} ; extrait, il foisonne (Cf = ${frd(Cf, 2)}). Son optimum Proctor normal donne ρdOPN = ${mg(rhoDOPN)} ; le remblai sera compacté juste à l'objectif q4. Le transport se fait en tombereaux de ${benne} m³.`,
        donnees: [donnee("Volume en place", `${fr(V, 5)} m³`), donnee("ρd en place", mg(rhoPlace)), donnee("Foisonnement Cf", frd(Cf, 2)), donnee("ρdOPN", mg(rhoDOPN)), donnee("Benne", `${benne} m³`)],
        questions: [
          nombre("Volume foisonné à transporter ?", v.Vfoisonne, "m³", `${fr(V, 5)} × ${frd(Cf, 2)} = ${fr(v.Vfoisonne, 5)} m³ : l'extraction crée des vides.`, { rel: 0.01 }),
          nombre("Nombre de rotations de tombereaux ?", rotations, "", `${fr(v.Vfoisonne, 5)} / ${benne} = ${frd(v.Vfoisonne / benne, 1)}, arrondi à l'entier supérieur : ${rotations}.`, { abs: 0.5 }),
          nombre("Masse volumique sèche moyenne du remblai à l'objectif q4 ?", rhoRemblai, "Mg/m³", `${fr(OBJECTIFS.q4.moyen / 100, 4)} × ${frd(rhoDOPN, 2)} = ${frd(rhoRemblai, 3)} Mg/m³.`, { rel: 0.005 }),
          nombre("Coefficient Ct = ρd en place / ρd du remblai ?", Ct, "", `${frd(rhoPlace, 2)} / ${frd(rhoRemblai, 3)} = ${frd(Ct, 3)}.`, { rel: 0.01 }),
          nombre("Volume de remblai compacté obtenu ?", v.Vcompacte, "m³", `${fr(V, 5)} × ${frd(Ct, 3)} = ${fr(v.Vcompacte, 5)} m³ : la masse de sol sec se conserve, seul son volume change. ${Ct > 1 ? "Le remblai est ici moins dense que le terrain en place : il occupe plus de volume." : "Le remblai est plus dense que le terrain en place : il occupe moins de volume."}`, { rel: 0.01 }),
          choixMelange(a, "Si ce même sol était compacté à l'objectif q3 (98,5 % de ρdOPN), le volume de remblai obtenu…",
            ["diminuerait : la même masse sèche, plus dense, occupe moins de place", "augmenterait : un sol mieux compacté gonfle", "ne changerait pas : seul le foisonnement compte"],
            `À 98,5 % de ρdOPN, ρd = ${frd(0.985 * rhoDOPN, 3)} Mg/m³ : Ct = ${frd(rhoPlace / (0.985 * rhoDOPN), 3)} et le volume tombe à ${fr(V * rhoPlace / (0.985 * rhoDOPN), 5)} m³. Compacter, c'est réduire les vides que l'extraction a créés.`),
        ],
      };
    },
  },
  {
    id: "ch1-cours", titre: "Questions de cours : la démarche et le domaine du GTR", difficulte: 1,
    generer(a) {
      const H = a.entier(16, 25);
      const pool = [
        ["Dans quel ordre le GTR organise-t-il le travail ?", ["identifier, classer, choisir l'emploi selon la météo, compacter, contrôler", "classer, identifier, compacter, choisir l'emploi, contrôler", "identifier, compacter, classer, contrôler, choisir l'emploi", "choisir l'emploi, identifier, classer, contrôler, compacter"],
          "On identifie le matériau par quelques essais simples, on le classe, on lit dans les tableaux s'il peut aller en remblai ou en couche de forme selon la météo du jour, on le compacte avec un atelier réglé par la méthode Q/S, puis l'on contrôle [F1 § 1.4]."],
        ["Le GTR impose la façon de faire (matériau, épaisseur des couches, compacteur, vitesse, passes) et contrôle qu'elle est respectée. C'est une spécification…", ["de la méthode", "du produit fini", "de performance mécanique", "de résultat sur la seule densité"],
          "La spécification de la méthode (NF EN 16907-1 et -5) impose les moyens ; celle du produit fini fixe des performances (densité, module) et exige bien plus de contrôles. Le GTR combine les deux : méthode pour les remblais, méthode et contrôle de portance pour les plateformes."],
        ["Lequel de ces sujets le GTR ne traite-t-il pas ?", ["la stabilité des talus et les remblais sur sols compressibles", "les conditions d'utilisation des matériaux en remblai", "le compactage par la méthode Q/S", "la classification des matériaux"],
          "Le GTR n'est pas un guide de conception des ouvrages en terre : il ne traite ni de la stabilité des talus, ni des remblais sur sols compressibles, ni du drainage, ni des remblais de plus de 15 m [F1 § 1.5]."],
        [`Un remblai de ${H} m de hauteur est prévu. Le GTR…`, ["ne suffit pas : au-delà de 15 m, la conception relève d'une étude propre", "s'applique sans restriction", "s'applique, à condition de viser q3 au lieu de q4", "interdit ce remblai"],
          `Le domaine d'application du GTR s'arrête aux remblais de moins de 15 m ; à ${H} m, la conception (stabilité, tassements) relève d'une étude géotechnique propre. Ses conditions d'utilisation restent des règles de référence que le géotechnicien adapte.`],
        ["Compacter un remblai, c'est d'abord…", ["réduire les vides créés par l'extraction, pour augmenter ρd et la résistance au cisaillement", "amener le sol à saturation pour qu'il ne gonfle plus", "réduire la teneur en fines du matériau", "dessécher le sol pour le rendre insensible à l'eau"],
          "L'extraction crée des vides (le foisonnement) ; le compactage les réduit, ce qui augmente la masse volumique sèche et la résistance au cisaillement du matériau."],
        ["Pourquoi l'objectif de la couche de forme (q3) est-il plus exigeant que celui du remblai (q4) ?", ["parce qu'elle porte directement la chaussée", "parce qu'elle est toujours traitée au liant", "parce qu'elle est plus épaisse que les couches de remblai", "parce que son matériau est toujours plus fin"],
          "q4 garantit, pour la grande majorité des remblais de moins de 15 m, l'absence de fluage et de tassement sous le poids propre ; la couche de forme, qui porte directement la chaussée, demande davantage : 98,5 % et 96 % de ρdOPN."],
        ["Le « fond de couche » des objectifs de densification désigne…", ["les 8 cm inférieurs de la couche compactée", "le dernier mètre du remblai, sous l'arase", "la base du remblai, au contact du terrain", "la moitié inférieure de chaque couche"],
          "Ce sont les huit centimètres inférieurs de la couche, les plus difficiles à atteindre pour le compacteur [F1 § 1.6]."],
        ["Un remblai est dit homogène quand…", ["ses zones (base, noyau, encagements, zone supérieure) se confondent", "il est construit en une seule couche", "son matériau est insensible à l'eau", "il fait moins de 5 m de hauteur"],
          "Dans la plupart des remblais routiers, les zones de la NF EN 16907-1 se confondent : le remblai est homogène. Elles se distinguent dès que le remblai est haut, construit sur un sol mou, ou qu'il doit protéger un noyau sensible à l'eau."],
        ["Le GTR demande-t-il de mesurer la masse volumique sèche partout ?", ["non : il donne, pour chaque matériau et chaque compacteur, le réglage qui assure q4 ou q3", "oui : un essai par couche et par tranche de 50 m", "oui, mais seulement dans la couche de forme", "non : il ne fixe aucun objectif de densité"],
          "Le GTR ne demande pas de mesurer ces masses volumiques partout : il donne le réglage de l'atelier (tables de compactage, Q/S) qui les assure ; le contrôle vérifie que les règles ont été tenues."],
      ];
      return {
        enonce: "Questions de cours sur la démarche du GTR, ses objectifs et son domaine d'application.",
        questions: a.tirage(pool, 4).map(([t, o, e]) => choixMelange(a, t, o, e)),
      };
    },
  },
  {
    id: "ch1-editions", titre: "GTR 1992 ou GTR 2024 ?", difficulte: 2,
    generer(a) {
      const traits = a.tirage(EDITIONS, 3);
      const annee = a.choix([1995, 1998, 2003, 2008, 2012]);
      const lettre = a.choix(["F1", "F2"]);
      return {
        enonce: `On relit plusieurs rapports géotechniques. Pour chaque phrase relevée, dites de quelle édition du guide elle relève ; puis lisez un symbole trouvé dans un rapport de ${annee}.`,
        questions: [
          ...traits.map(([phrase, ed]) => choixMelange(a, `« ${phrase} »`, [NOM_EDITION[ed], NOM_EDITION[ed === 1992 ? 2024 : 1992]],
            `${NOM_EDITION[ed]}. ${ed === 1992 ? "L'édition de 1992 (révisée en 2000) lisait les sols sur la fraction 0/50 mm, fines au tamis de 80 µm, avec les classes A, B, C, D, R et F." : "L'édition de 2024 s'aligne sur la NF EN 16907-2 : fraction 0/63 mm, fines au tamis de 63 µm, classes F, I, S, G et VC, Cu, suffixe ins, PF2qs."}`)),
          choixMelange(a, `Un rapport de ${annee} classe un matériau « ${lettre} ». C'est…`,
            ["un sol organique ou un sous-produit industriel (classe F du GTR 1992)", `un sol fin ${lettre === "F1" ? "peu plastique" : "moyennement argileux"} (classe ${lettre} du GTR 2024)`, `l'ancien nom de la classe A${lettre.slice(1)}`, "un matériau rocheux fragmentable"],
            `Le rapport date d'avant 2024 : il suit le GTR 1992, où la classe F désignait les sols organiques et les sous-produits industriels. En 2024, F désigne les sols fins (les anciens A). Vérifier toujours l'édition de référence, et ne jamais convertir une classe sans revenir aux essais.`),
        ],
      };
    },
  },
];
