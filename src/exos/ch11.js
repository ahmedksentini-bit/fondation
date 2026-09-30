// Exercices du chapitre 11 : portance d'un pieu isolé.
import { fr, frd, nombre, choixMelange, donnee } from "./alea.js";
import * as P from "../geotech/pieux.js";
import { CLASSES_F62, CATEGORIES_EC7 } from "../geotech/sols.js";
import { coupePieu } from "../figures.js";

const nomClasse = (c) => `${CLASSES_F62[c].nom.toLowerCase()} (${CLASSES_F62[c].lettre})`;

export default [
  {
    id: "ch11-intervalle", titre: "Pression limite équivalente sous la pointe", difficulte: 2,
    generer(a) {
      const B = a.entre(0.4, 1.4, 0.1), zc = a.entre(8, 16, 0.5), h = a.entre(0.3, 3, 0.1), D = +(zc + h).toFixed(2);
      const p1 = a.entre(0.4, 1.2, 0.05), p2 = a.entre(1.8, 3.5, 0.05), p3 = a.entre(1.2, 4, 0.05);
      const z2 = +(D + a.entre(0.5, 2, 0.5)).toFixed(2);
      const couches = [{ z0: 0, z1: zc, pl: p1 }, { z0: zc, z1: z2, pl: p2 }, { z0: z2, z1: 60, pl: p3 }];
      const c = (z) => couches.find((x) => z >= x.z0 && z < x.z1);
      const r = P.pleProfond({ plFn: (z) => c(z).pl, ruptures: [zc, z2], B, D, h });
      return {
        enonce: `Pieu de diamètre B = ${frd(B, 1)} m, pointe à D = ${frd(D, 2)} m. Profil : pl* = ${frd(p1, 2)} MPa jusqu'à ${frd(zc, 1)} m, ${frd(p2, 2)} MPa de ${frd(zc, 1)} à ${frd(z2, 2)} m, puis ${frd(p3, 2)} MPa.`,
        donnees: [donnee("B · D", `${frd(B, 1)} · ${frd(D, 2)} m`), donnee("h dans la couche porteuse", `${frd(h, 2)} m`), donnee("pl*", `${frd(p1, 2)} / ${frd(p2, 2)} / ${frd(p3, 2)} MPa`)],
        figure: coupePieu({ B, D, hauteur: 300, zMax: D + 4, couches: [{ z0: 0, z1: zc, sol: "argile" }, { z0: zc, z1: z2, sol: "sable" }, { z0: z2, z1: 60, sol: "marne" }], profil: { libelle: "pl*", unite: "MPa", valeurs: couches.map((x) => ({ z0: x.z0, z1: Math.min(x.z1, D + 4), v: x.pl })), etiquettes: true } }),
        questions: [
          nombre("Longueur a ?", r.a, "m", `a = max(B/2 ; 0,5 m) = ${frd(r.a, 2)} m.`, { rel: 0.005 }),
          nombre("Longueur b ?", r.b, "m", `b = min(a ; h) = min(${frd(r.a, 2)} ; ${frd(h, 2)}) = ${frd(r.b, 2)} m.`, { rel: 0.005 }),
          nombre("ple* sur [D − b ; D + 3a] ?", r.ple, "MPa", `Intervalle [${frd(r.z0, 2)} ; ${frd(r.z1, 2)}] m ; moyenne arithmétique pondérée des épaisseurs : ple* = ${frd(r.ple, 3)} MPa.`, { rel: 0.01 }),
        ],
      };
    },
  },
  {
    id: "ch11-kp-f62", titre: "Résistance de pointe au Fascicule 62", difficulte: 1,
    generer(a) {
      const classe = a.choix(Object.keys(P.KP_PIEU_F62).filter((k) => !k.startsWith("roche")));
      const refoulant = a.choix([false, true]);
      const B = a.entre(0.4, 1.2, 0.1), ple = a.entre(Math.max(CLASSES_F62[classe].pl[0], 0.5), Number.isFinite(CLASSES_F62[classe].pl[1]) ? CLASSES_F62[classe].pl[1] : 4, 0.05);
      const kp = P.KP_PIEU_F62[classe][refoulant ? 1 : 0];
      const { Ab } = P.section({ B });
      return {
        enonce: `Pieu ${refoulant ? "battu" : "foré"} de diamètre B = ${frd(B, 1)} m ancré dans ${nomClasse(classe)} ; ple* = ${frd(ple, 2)} MPa sous la pointe.`,
        donnees: [donnee("B", `${frd(B, 1)} m`), donnee("Sol", nomClasse(classe)), donnee("ple*", `${frd(ple, 2)} MPa`), donnee("Refoulement", refoulant ? "oui" : "non")],
        questions: [
          nombre("Facteur kp (F62 annexe C.3, tableau I) ?", kp, "", `Classe ${CLASSES_F62[classe].lettre}, ${refoulant ? "avec" : "sans"} refoulement : kp = ${frd(kp, 2)}.`, { abs: 0.001 }),
          nombre("Contrainte de rupture qu ?", kp * ple * 1000, "kPa", `qu = kp ple* = ${frd(kp, 2)} × ${fr(ple * 1000, 4)} = ${fr(kp * ple * 1000, 4)} kPa.`, { rel: 0.01 }),
          nombre("Résistance de pointe Qpu ?", Ab * kp * ple * 1000, "kN", `Qpu = Ab qu = ${frd(Ab, 4)} × ${fr(kp * ple * 1000, 4)} = ${fr(Ab * kp * ple * 1000, 4)} kN.`, { rel: 0.01 }),
        ],
      };
    },
  },
  {
    id: "ch11-courbeQ", titre: "Les courbes de frottement Q1 à Q7", difficulte: 1,
    generer(a) {
      const n = a.entier(1, 7), pl = a.entre(0.3, 3.5, 0.1);
      const qs = P.courbeQ(n, pl);
      let detail;
      if (n <= 4) {
        const qsn = 0.04 * n, pn = 1 + 0.5 * n, r = pl / pn;
        const q5 = pl >= 0.2 ? Math.min((pl - 0.2) / 9, (pl + 3.3) / 32) : 0;
        const brut = r <= 1 ? qsn * r * (2 - r) : qsn;
        detail = `Q${n} : qsn = 0,04 × ${n} = ${frd(qsn, 2)} MPa, pn = 1 + 0,5 × ${n} = ${frd(pn, 1)} MPa ; ${r <= 1 ? `pl/pn = ${frd(r, 3)} ≤ 1 : qs = qsn (pl/pn)(2 − pl/pn) = ${frd(brut * 1000, 1)} kPa` : `pl ≥ pn : palier qs = qsn = ${frd(brut * 1000, 1)} kPa`}${brut > q5 + 1e-12 ? `, borné par Q5 = ${frd(q5 * 1000, 1)} kPa` : ""}.`;
      } else if (n === 5) detail = `Q5 = min[(pl − 0,2)/9 ; (pl + 3,3)/32] = ${frd(qs, 1)} kPa.`;
      else if (n === 6) detail = `Q6 = min[(pl + 0,4)/10 ; (pl + 4)/30] = ${frd(qs, 1)} kPa.`;
      else detail = `Q7 = (pl + 0,4)/10 = ${frd(qs, 1)} kPa.`;
      return {
        enonce: `Frottement unitaire limite par la courbe Q${n} du Fascicule 62, pour pl = ${frd(pl, 1)} MPa.`,
        donnees: [donnee("Courbe", `Q${n}`), donnee("pl", `${frd(pl, 1)} MPa`)],
        questions: [nombre(`qs lu sur la courbe Q${n} ?`, qs, "kPa", detail, { rel: 0.015 })],
      };
    },
  },
  {
    id: "ch11-tableauII", titre: "Choisir la courbe de frottement", difficulte: 2,
    generer(a) {
      const cas = [["fore-boue", "argile-B"], ["fore-boue", "sable-B"], ["fore-simple", "argile-C"], ["battu-prefabrique", "sable-B"], ["metal-battu-ferme", "argile-B"], ["fore-tube-recupere", "sable-C"], ["injecte-hp", "marne-A"], ["battu-moule", "argile-A"]];
      const [type, classe] = a.choix(cas);
      const ch = P.choixCourbeF62(type, classe);
      const bas = Math.max(CLASSES_F62[classe].pl[0], 0.3), haut = Number.isFinite(CLASSES_F62[classe].pl[1]) ? CLASSES_F62[classe].pl[1] : 4;
      const pl = a.entre(bas, haut, 0.1), B = a.entre(0.4, 1.2, 0.1), h = a.entre(2, 10, 0.5);
      const qs = P.courbeQ(ch.n, pl), Qs = Math.PI * B * h * qs;
      const autres = [1, 2, 3, 4, 5, 6, 7].filter((k) => k !== ch.n).slice(0, 3).map((k) => `Q${k}`);
      return {
        enonce: `Pieu ${P.PIEUX_F62[type].nom.toLowerCase()} de diamètre B = ${frd(B, 1)} m, traversant ${frd(h, 1)} m de ${nomClasse(classe)} (pl = ${frd(pl, 1)} MPa), exécuté sans précaution particulière.`,
        donnees: [donnee("Pieu", P.PIEUX_F62[type].nom), donnee("Sol", nomClasse(classe)), donnee("pl", `${frd(pl, 1)} MPa`), donnee("B · h", `${frd(B, 1)} · ${frd(h, 1)} m`)],
        questions: [
          choixMelange(a, "Courbe de frottement (tableau II de l'annexe C.3) ?", [`Q${ch.n}`, ...autres],
            `Le tableau II donne Q${ch.n} pour ce couple.${ch.variante ? ` La case propose aussi Q${ch.variante.n} en cas de ${ch.variante.note}.` : ""}`),
          nombre("Frottement unitaire qs ?", qs, "kPa", `Courbe Q${ch.n} pour pl = ${frd(pl, 1)} MPa : qs = ${frd(qs, 1)} kPa.`, { rel: 0.015 }),
          nombre("Frottement mobilisé dans la couche ?", Qs, "kN", `Qs = π B h qs = π × ${frd(B, 1)} × ${frd(h, 1)} × ${frd(qs, 1)} = ${fr(Qs, 4)} kN.`, { rel: 0.015 }),
        ],
      };
    },
  },
  {
    id: "ch11-fsol", titre: "Frottement à la NF P94-262", difficulte: 2,
    generer(a) {
      const cas = [[1, "argile"], [2, "sable"], [2, "argile"], [6, "craie"], [9, "sable"], [12, "argile"], [4, "marne"], [7, "sable"]];
      const [cat, sol] = a.choix(cas);
      const X = a.entre(0.3, 3, 0.05);
      const r = P.qsEC7({ methode: "pressio", cat, sol, X });
      const pc = P.categoriePieu(cat);
      return {
        enonce: `Pieu de catégorie ${cat} (${pc.nom.toLowerCase()}) dans ${CATEGORIES_EC7[sol].nom.toLowerCase()}, pl* = ${frd(X, 2)} MPa.`,
        donnees: [donnee("Catégorie de pieu", `${cat} · ${pc.abr}`), donnee("Sol", CATEGORIES_EC7[sol].nom), donnee("pl*", `${frd(X, 2)} MPa`)],
        questions: [
          nombre("fsol ?", r.fsol, "kPa", `fsol = (a pl* + b)(1 − e^(−c pl*)) avec les paramètres du tableau F.5.2.2 pour ce sol : ${frd(r.fsol, 1)} kPa.`, { rel: 0.015 }),
          nombre("αpieu-sol ?", r.alpha, "", `Tableau F.5.2.1, catégorie ${cat} : α = ${frd(r.alpha, 2)}.`, { abs: 0.001 }),
          nombre("qs ?", r.qs, "kPa", `qs = min(α fsol ; qs,max) = min(${frd(r.alpha * r.fsol, 1)} ; ${fr(r.qsmax, 3)}) = ${frd(r.qs, 1)} kPa${r.plafonne ? " : c'est le plafond qui joue" : ""}.`, { rel: 0.015 }),
        ],
      };
    },
  },
  {
    id: "ch11-Def", titre: "Encastrement effectif et facteur kp de la norme", difficulte: 3,
    generer(a) {
      const B = a.entre(0.5, 1.2, 0.1), D = a.entre(10, 20, 1), h = a.entre(1, 5, 0.5);
      const plc = a.entre(0.2, 0.8, 0.05), ple = a.entre(1.5, 3.5, 0.05), cat = a.choix([1, 2, 6]), sol = a.choix(["sable", "marne", "craie"]);
      const couches = [{ z0: 0, z1: D - h, sol: "argile", pl: plc }, { z0: D - h, z1: D + 10, sol, pl: ple }];
      const r = P.valeursLimitesEC7({ methode: "pressio", cat, B, D, couches });
      const hD = Math.min(10 * B, D);
      return {
        enonce: `Pieu de catégorie ${cat} (${P.categoriePieu(cat).nom.toLowerCase()}), B = ${frd(B, 1)} m, D = ${fr(D, 2)} m ; argile molle (pl* = ${frd(plc, 2)} MPa) jusqu'à ${frd(D - h, 1)} m, puis ${CATEGORIES_EC7[sol].nom.toLowerCase()} (pl* = ${frd(ple, 2)} MPa).`,
        donnees: [donnee("B · D", `${frd(B, 1)} · ${fr(D, 2)} m`), donnee("Ancrage h", `${frd(h, 1)} m`), donnee("pl*", `${frd(plc, 2)} puis ${frd(ple, 2)} MPa`)],
        questions: [
          nombre("Hauteur hD = min(10B ; D) ?", hD, "m", `hD = min(${frd(10 * B, 1)} ; ${fr(D, 2)}) = ${frd(hD, 1)} m.`, { rel: 0.005 }),
          nombre("Encastrement effectif Def ?", r.pointe.Def, "m", `Def = (1/ple*) ∫ pl* dz sur [D − hD ; D] = [${frd(ple, 2)} × ${frd(Math.min(h, hD), 2)}${hD > h ? ` + ${frd(plc, 2)} × ${frd(hD - h, 2)}` : ""}] / ${frd(ple, 2)} = ${frd(r.pointe.Def, 2)} m.`, { rel: 0.01 }),
          nombre("kp ?", r.pointe.k, "", `kp,max = ${frd(r.pointe.kmax, 2)} (classe ${P.categoriePieu(cat).classe}) ; Def/B = ${frd(r.pointe.DefB, 2)} ${r.pointe.DefB >= 5 ? "≥ 5 : kp = kp,max" : `< 5 : kp = 1 + (kp,max − 1) Def/(5B) = ${frd(r.pointe.k, 3)}`}.`, { rel: 0.01 }),
        ],
      };
    },
  },
  {
    id: "ch11-cpt", titre: "Pointe d'un pieu au pénétromètre (Fascicule 62)", difficulte: 2,
    generer(a) {
      const B = a.entre(0.4, 1, 0.1), D = a.entre(10, 18, 0.5), refoulant = a.choix([false, true]);
      const q1 = a.entre(6, 15, 0.5), q2 = a.entre(15, 30, 0.5), z2 = +(D + a.entre(0.3, 1, 0.1)).toFixed(2);
      const couches = [{ z0: 0, z1: 5, qc: 2 }, { z0: 5, z1: z2, qc: q1 }, { z0: z2, z1: 50, qc: q2 }];
      const c = (z) => couches.find((x) => z >= x.z0 && z < x.z1);
      const r = P.qceProfond({ qcFn: (z) => c(z).qc, ruptures: [5, z2], B, D, h: D - 5 });
      const kc = P.KC_PIEU_F62["sable-B"][refoulant ? 1 : 0];
      const { Ab } = P.section({ B });
      return {
        enonce: `Pieu ${refoulant ? "battu" : "foré"} B = ${frd(B, 1)} m, pointe à ${frd(D, 1)} m dans un sable moyennement compact (classe B) : qc = ${frd(q1, 1)} MPa jusqu'à ${frd(z2, 2)} m, puis ${frd(q2, 1)} MPa.`,
        donnees: [donnee("B · D", `${frd(B, 1)} · ${frd(D, 1)} m`), donnee("qc", `${frd(q1, 1)} puis ${frd(q2, 1)} MPa`), donnee("Refoulement", refoulant ? "oui" : "non")],
        questions: [
          nombre("qcm sur [D − b ; D + 3a] ?", r.qcm, "MPa", `a = ${frd(r.a, 2)} m, b = ${frd(r.b, 2)} m ; moyenne sur [${frd(r.z0, 2)} ; ${frd(r.z1, 2)}] m : qcm = ${frd(r.qcm, 3)} MPa.`, { rel: 0.01 }),
          nombre("qce écrêtée à 1,3 qcm ?", r.qce, "MPa", `Plafond 1,3 qcm = ${frd(1.3 * r.qcm, 3)} MPa ; qce = ${frd(r.qce, 3)} MPa.`, { rel: 0.01 }),
          nombre("Résistance de pointe Qpu = Ab kc qce ?", Ab * kc * r.qce * 1000, "kN", `kc = ${frd(kc, 2)} (sables, ${refoulant ? "avec" : "sans"} refoulement) ; Qpu = ${frd(Ab, 4)} × ${frd(kc, 2)} × ${fr(r.qce * 1000, 4)} = ${fr(Ab * kc * r.qce * 1000, 4)} kN.`, { rel: 0.015 }),
        ],
      };
    },
  },
  {
    id: "ch11-pieu-f62", titre: "Portance complète d'un pieu foré au Fascicule 62", difficulte: 3,
    generer(a) {
      const B = a.entre(0.6, 1.2, 0.1), z1 = a.entre(3, 8, 0.5), z2 = +(z1 + a.entre(4, 10, 0.5)).toFixed(1), h = a.entre(2, 5, 0.5), D = +(z2 + h).toFixed(1);
      const pl1 = a.entre(0.3, 0.6, 0.05), pl2 = a.entre(1, 2, 0.05), pl3 = a.entre(1.6, 3.5, 0.05);
      const couches = [
        { z0: 0, z1: z1, classe: "argile-A", pl: pl1 },
        { z0: z1, z1: z2, classe: "sable-B", pl: pl2 },
        { z0: z2, z1: D + 10, classe: "marne-A", pl: pl3 },
      ];
      const r = P.pieuF62({ methode: "pressio", type: "fore-boue", B, D, couches });
      return {
        enonce: `Pieu foré à la boue, B = ${frd(B, 1)} m, D = ${frd(D, 1)} m. Argile molle (A, pl = ${frd(pl1, 2)} MPa) jusqu'à ${frd(z1, 1)} m, sable moyennement compact (B, pl = ${frd(pl2, 2)} MPa) jusqu'à ${frd(z2, 1)} m, puis marne (A, pl = ${frd(pl3, 2)} MPa).`,
        donnees: [donnee("B · D", `${frd(B, 1)} · ${frd(D, 1)} m`), donnee("Couches", `${frd(z1, 1)} m · ${frd(z2 - z1, 1)} m · ancrage ${frd(h, 1)} m`), donnee("pl", `${frd(pl1, 2)} · ${frd(pl2, 2)} · ${frd(pl3, 2)} MPa`)],
        figure: coupePieu({ B, D, hauteur: 300, zMax: D + 3, couches: couches.map((c) => ({ ...c, sol: c.classe })), profil: { libelle: "qs", unite: "kPa", valeurs: r.lignes.map((l) => ({ z0: l.z0, z1: l.z1, v: l.qs })), etiquettes: true } }),
        questions: [
          nombre("Résistance de pointe Qpu ?", r.Qpu, "kN", `ple* = ${frd(r.qEquiv, 2)} MPa (couche d'ancrage homogène), kp = ${frd(r.kPointe, 2)} (marne A, sans refoulement) ; Qpu = ${frd(r.Ab, 4)} × ${frd(r.kPointe, 2)} × ${fr(r.qEquiv * 1000, 4)} = ${fr(r.Qpu, 4)} kN.`, { rel: 0.015 }),
          nombre("Frottement Qsu ?", r.Qsu, "kN", `${r.lignes.map((l) => `Q${l.courbe} : ${frd(l.qs, 1)} kPa sur ${frd(l.z1 - l.z0, 1)} m`).join(" ; ")} ; Qsu = π B Σ qs h = ${fr(r.Qsu, 4)} kN.`, { rel: 0.015 }),
          nombre("Charge limite Qu ?", r.Qu, "kN", `Qu = ${fr(r.Qpu, 4)} + ${fr(r.Qsu, 4)} = ${fr(r.Qu, 5)} kN.`, { rel: 0.015 }),
          nombre("Charge de fluage Qc ?", r.Qc, "kN", `Qc = 0,5 Qpu + 0,7 Qsu = ${fr(r.Qc, 5)} kN.`, { rel: 0.015 }),
        ],
      };
    },
  },
];
