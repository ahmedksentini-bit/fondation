// Exercices du chapitre 4 : portance des semelles à partir des essais en place.
import { fr, frd, nombre, choixMelange, donnee } from "./alea.js";
import * as S from "../geotech/superficielles.js";
import { profilCouches } from "../geotech/outils.js";
import { CLASSES_F62 } from "../geotech/sols.js";
import { coupeSemelle } from "../figures.js";

const profil = (couches, cle) => { const p = profilCouches(couches); return { fn: p.fn(cle), ruptures: p.ruptures }; };
const deg = (x) => (x * 180) / Math.PI;

export default [
  {
    id: "ch4-ple", titre: "Pression limite nette équivalente sous une semelle", difficulte: 1,
    generer(a) {
      const B = a.entre(1.2, 2.4, 0.2), hr = 1.5 * B;
      const h1 = +(a.entre(0.3, 0.6, 0.05) * hr).toFixed(2), h2 = +(a.entre(0.15, 0.3, 0.05) * hr).toFixed(2);
      const p1 = a.entre(0.8, 1.8, 0.05), p2 = a.entre(0.3, 0.7, 0.05), p3 = a.entre(1.2, 2.5, 0.05);
      const pr = profil([{ z0: 0, z1: h1, pl: p1 }, { z0: h1, z1: h1 + h2, pl: p2 }, { z0: h1 + h2, z1: 50, pl: p3 }], "pl");
      const g = S.moyenneGeometrique(pr, 0, hr), m = S.moyenneArithmetique(pr, 0, hr);
      const h3 = hr - h1 - h2;
      return {
        enonce: `Semelle filante de largeur B = ${frd(B, 1)} m. Sous la base : ${frd(h1, 2)} m à pl* = ${frd(p1, 2)} MPa, puis ${frd(h2, 2)} m à ${frd(p2, 2)} MPa, puis ${frd(p3, 2)} MPa.`,
        donnees: [donnee("B", `${frd(B, 1)} m`), donnee("couche 1", `${frd(h1, 2)} m · ${frd(p1, 2)} MPa`), donnee("couche 2", `${frd(h2, 2)} m · ${frd(p2, 2)} MPa`), donnee("couche 3", `${frd(p3, 2)} MPa`)],
        questions: [
          nombre("Épaisseur d'étude hr (charge centrée) ?", hr, "m", `hr = 1,5 B = ${frd(hr, 2)} m ; la couche 3 y intervient sur ${frd(h3, 2)} m.`, { rel: 0.005 }),
          nombre("Pression limite nette équivalente ple* (moyenne géométrique) ?", g, "MPa",
            `ple* = (${frd(p1, 2)}^${frd(h1, 2)} × ${frd(p2, 2)}^${frd(h2, 2)} × ${frd(p3, 2)}^${frd(h3, 2)})^(1/${frd(hr, 2)}) = ${frd(g, 3)} MPa.`, { rel: 0.01 }),
          nombre("Pour comparaison, moyenne arithmétique sur la même épaisseur ?", m, "MPa", `(${frd(p1 * h1, 3)} + ${frd(p2 * h2, 3)} + ${frd(p3 * h3, 3)}) / ${frd(hr, 2)} = ${frd(m, 3)} MPa.`, { rel: 0.01 }),
          choixMelange(a, "Pourquoi les deux textes prennent-ils la moyenne géométrique ?",
            ["elle donne plus de poids à la couche la plus faible", "elle est plus simple à calculer", "elle est toujours supérieure à la moyenne arithmétique"],
            `La moyenne géométrique est toujours inférieure ou égale à la moyenne arithmétique, d'autant plus que le profil est contrasté : ici ${fr(100 * (1 - g / m), 2)} % de moins. La couche molle pèse davantage, ce qui est le comportement réel d'une semelle.`),
        ],
      };
    },
  },
  {
    id: "ch4-qce", titre: "Résistance de pointe équivalente écrêtée", difficulte: 2,
    generer(a) {
      const B = a.entre(1.2, 2.4, 0.2), hr = 1.5 * B;
      const h1 = +(a.entre(0.3, 0.5, 0.05) * hr).toFixed(2), h2 = +(a.entre(0.15, 0.3, 0.05) * hr).toFixed(2);
      const q1 = a.entre(3, 6, 0.5), q2 = a.entre(12, 25, 0.5), q3 = a.entre(4, 8, 0.5);
      const pr = profil([{ z0: 0, z1: h1, qc: q1 }, { z0: h1, z1: h1 + h2, qc: q2 }, { z0: h1 + h2, z1: 50, qc: q3 }], "qc");
      const r = S.qceMoyenneEcretee(pr, 0, hr);
      const h3 = hr - h1 - h2;
      const plaf = 1.3 * r.qcm;
      return {
        enonce: `Semelle filante B = ${frd(B, 1)} m sur un sable reconnu au pénétromètre : sous la base, ${frd(h1, 2)} m à qc = ${frd(q1, 1)} MPa, ${frd(h2, 2)} m à ${frd(q2, 1)} MPa, puis ${frd(q3, 1)} MPa.`,
        donnees: [donnee("B", `${frd(B, 1)} m`), donnee("couche 1", `${frd(h1, 2)} m · ${frd(q1, 1)} MPa`), donnee("couche 2", `${frd(h2, 2)} m · ${frd(q2, 1)} MPa`), donnee("couche 3", `${frd(q3, 1)} MPa`)],
        questions: [
          nombre("Moyenne qcm sur hr = 1,5 B ?", r.qcm, "MPa", `qcm = (${frd(q1, 1)} × ${frd(h1, 2)} + ${frd(q2, 1)} × ${frd(h2, 2)} + ${frd(q3, 1)} × ${frd(h3, 2)}) / ${frd(hr, 2)} = ${frd(r.qcm, 3)} MPa.`, { rel: 0.01 }),
          nombre("Plafond d'écrêtage 1,3 qcm ?", plaf, "MPa", `1,3 × ${frd(r.qcm, 3)} = ${frd(plaf, 3)} MPa : la couche 2 ${q2 > plaf ? "est écrêtée" : "reste sous le plafond"}.`, { rel: 0.01 }),
          nombre("Résistance de pointe équivalente qce ?", r.qce, "MPa", `qce = moyenne du profil écrêté = (${frd(Math.min(q1, plaf), 2)} × ${frd(h1, 2)} + ${frd(Math.min(q2, plaf), 2)} × ${frd(h2, 2)} + ${frd(Math.min(q3, plaf), 2)} × ${frd(h3, 2)}) / ${frd(hr, 2)} = ${frd(r.qce, 3)} MPa.`, { rel: 0.01 }),
        ],
      };
    },
  },
  {
    id: "ch4-kp-f62", titre: "Facteur de portance du Fascicule 62", difficulte: 1,
    generer(a) {
      const classe = a.choix(["argile-A", "argile-B", "argile-C", "sable-A", "sable-B", "sable-C", "craie-B", "marne-A"]);
      const forme = a.choix(["filante", "rectangulaire", "carree"]);
      const B = a.entre(1, 3, 0.1), L = forme === "rectangulaire" ? a.entre(B + 0.5, 3 * B, 0.1) : forme === "carree" ? B : 1;
      const De = a.entre(0.1, 1.2, 0.05) * B;
      const k = S.kpF62({ classe, B, L, forme, De });
      return {
        enonce: `Semelle ${forme === "filante" ? "filante" : forme === "carree" ? "carrée" : "rectangulaire"} de largeur B = ${frd(B, 1)} m${forme === "rectangulaire" ? ` et de longueur L = ${frd(L, 1)} m` : ""}, sol d'assise ${CLASSES_F62[classe].nom.toLowerCase()} (classe ${CLASSES_F62[classe].lettre}), De = ${frd(De, 2)} m.`,
        donnees: [donnee("Sol", `${CLASSES_F62[classe].nom} (${CLASSES_F62[classe].lettre})`), donnee("B", `${frd(B, 1)} m`), donnee("B/L", frd(k.BL, 3)), donnee("De", `${frd(De, 2)} m`)],
        questions: [
          nombre("Encastrement relatif De/B ?", k.DeB, "", `${frd(De, 2)} / ${frd(B, 1)} = ${frd(k.DeB, 3)}.`, { rel: 0.01 }),
          nombre("Facteur de portance kp (F62 annexe B.1, tableau I) ?", k.k, "", `kp = k0 [1 + a (0,6 + 0,4 B/L) De/B] = ${frd(k.k0, 1)} × [1 + ${frd(k.a, 2)} × (0,6 + 0,4 × ${frd(k.BL, 3)}) × ${frd(k.DeB, 3)}] = ${frd(k.k, 3)}.`, { rel: 0.01 }),
        ],
      };
    },
  },
  {
    id: "ch4-kp-ec7", titre: "Facteur de portance de la NF P94-261", difficulte: 2,
    generer(a) {
      const categorie = a.choix(["argile", "sable", "craie", "marne"]);
      const B = a.entre(1.5, 3, 0.1), L = a.entre(2 * B, 6 * B, 0.1);
      const De = a.entre(0.1, 1.4, 0.05) * B;
      const k = S.kpEC7({ categorie, B, L, forme: "rectangulaire", De });
      const pf = k.parametres.filante, pc = k.parametres.carree;
      return {
        enonce: `Semelle rectangulaire ${frd(B, 1)} m × ${frd(L, 1)} m sur ${categorie === "argile" ? "une argile" : categorie === "sable" ? "un sable" : categorie === "craie" ? "une craie" : "une marne"}, De = ${frd(De, 2)} m.`,
        donnees: [donnee("Catégorie", categorie), donnee("B × L", `${frd(B, 1)} × ${frd(L, 1)} m`), donnee("De", `${frd(De, 2)} m`)],
        questions: [
          nombre("kp pour B/L = 0 (filante) ?", k.kFilante, "", `k = k0 + (a + b De/B)(1 − e^(−c De/B)) avec k0 = ${frd(pf.k0, 1)}, a = ${frd(pf.a, 2)}, b = ${frd(pf.b, 2)}, c = ${frd(pf.c, 1)} et De/B = ${frd(k.DeB, 3)} : ${frd(k.kFilante, 3)}.`, { rel: 0.01 }),
          nombre("kp pour B/L = 1 (carrée) ?", k.kCarree, "", `Mêmes formules avec k0 = ${frd(pc.k0, 1)}, a = ${frd(pc.a, 2)}, b = ${frd(pc.b, 2)}, c = ${frd(pc.c, 1)} : ${frd(k.kCarree, 3)}.`, { rel: 0.01 }),
          nombre(`kp de la semelle (B/L = ${frd(k.BL, 3)}) ?`, k.k, "", `Interpolation linéaire : ${frd(k.kFilante, 3)} × (1 − ${frd(k.BL, 3)}) + ${frd(k.kCarree, 3)} × ${frd(k.BL, 3)} = ${frd(k.k, 3)}.`, { rel: 0.01 }),
        ],
      };
    },
  },
  {
    id: "ch4-idelta", titre: "Réduction pour charge inclinée", difficulte: 2,
    generer(a) {
      const sol = a.choix(["frottant", "coherent"]);
      const B = a.entre(1.5, 3, 0.1), De = a.entre(0.2, 1, 0.05) * B;
      const V = a.entre(200, 800, 10), H = +(V * a.entre(0.05, 0.35, 0.01)).toFixed(0);
      const delta = deg(Math.atan(H / V));
      const id = S.idEC7({ sol, delta, B, De });
      const F62 = sol === "coherent" ? S.phi1(delta) : S.phi2(delta, De / B);
      return {
        enonce: `Semelle filante B = ${frd(B, 1)} m, De = ${frd(De, 2)} m, sol ${sol === "coherent" ? "cohérent" : "frottant"}. Charges de calcul : Vd = ${fr(V, 3)} kN/m, Hd = ${fr(H, 3)} kN/m.`,
        donnees: [donnee("B · De", `${frd(B, 1)} m · ${frd(De, 2)} m`), donnee("Sol", sol === "coherent" ? "cohérent" : "frottant"), donnee("Vd · Hd", `${fr(V, 3)} · ${fr(H, 3)} kN/m`)],
        questions: [
          nombre("Inclinaison δ de la charge ?", delta, "°", `δ = arctan(Hd/Vd) = arctan(${fr(H, 3)}/${fr(V, 3)}) = ${frd(delta, 2)}°.`, { rel: 0.01 }),
          nombre(`Coefficient iδ de la NF P94-261 (sol ${sol === "coherent" ? "cohérent" : "frottant"}) ?`, id.i, "", sol === "coherent"
            ? `iδ = (1 − 2δ/π)² = (1 − ${frd(delta, 2)}/90)² = ${frd(id.i, 3)}.`
            : `iδ = (1 − 2δ/π)² − (2δ/π)(2 − 3·2δ/π) e^(−De/B), avec 2δ/π = ${frd(delta / 90, 4)} et e^(−De/B) = ${frd(Math.exp(-De / B), 3)} : iδ = ${frd(id.i, 3)}.`, { rel: 0.01 }),
          nombre(`Même coefficient au Fascicule 62 (${sol === "coherent" ? "Φ1" : "Φ2"}) ?`, F62, "", sol === "coherent"
            ? `Φ1(δ) = (1 − δ/90°)² = ${frd(F62, 3)} : identique.`
            : `Φ2(δ) = (1 − δ/90)² (1 − e^(−De/B)) + [max(1 − δ/45 ; 0)]² e^(−De/B) = ${frd(F62, 3)} : identique, les deux textes ont la même formule sous deux écritures.`, { rel: 0.01 }),
        ],
      };
    },
  },
  {
    id: "ch4-ibeta", titre: "Semelle en crête de talus", difficulte: 2,
    generer(a) {
      const B = a.entre(1.5, 3, 0.1), beta = a.entre(20, 40, 1), d = a.entre(0.5, 4, 0.5) * B / 2;
      const r = S.ibEC7({ sol: "frottant", beta, d, B, De: 0 });
      const t = Math.tan((beta * Math.PI) / 180);
      return {
        enonce: `Semelle filante B = ${frd(B, 1)} m posée en surface (De = 0) sur un sable, à d = ${frd(d, 2)} m de la crête d'un talus de pente β = ${fr(beta, 2)}°.`,
        donnees: [donnee("B", `${frd(B, 1)} m`), donnee("d", `${frd(d, 2)} m`), donnee("β", `${fr(beta, 2)}°`)],
        figure: coupeSemelle({ B, D: 0.3, epaisseur: 0.3, hauteur: 220, profondeurVue: 2.5 * B, talus: { beta, d }, couches: [{ z0: 0, z1: 30, sol: "sable" }] }),
        questions: [
          nombre("Rapport d/8B ?", d / (8 * B), "", `${frd(d, 2)} / (8 × ${frd(B, 1)}) = ${frd(d / (8 * B), 3)}.`, { rel: 0.01 }),
          nombre("Coefficient iβ (Corté et Garnier) ?", r.i, "", `iβ = 1 − 0,9 tanβ (2 − tanβ) (1 − d/8B)² = 1 − 0,9 × ${frd(t, 3)} × ${frd(2 - t, 3)} × ${frd((1 - d / (8 * B)) ** 2, 3)} = ${frd(r.i, 3)}.`, { rel: 0.01 }),
          choixMelange(a, "À partir de quelle distance le talus n'a-t-il plus d'effet ?", ["d ≥ 8 B", "d ≥ 2 B", "d ≥ 5 B"],
            "Le terme (1 − d/8B)² s'annule pour d = 8 B : au-delà, iβ = 1. Le Fascicule 62 impose en outre 2 m au moins entre le bord de la semelle et le talus (B.4.1,2)."),
        ],
      };
    },
  },
  {
    id: "ch4-f62", titre: "Portance d'une semelle au Fascicule 62", difficulte: 2,
    generer(a) {
      const classe = a.choix(["argile-B", "sable-B", "argile-A", "sable-C"]);
      const B = a.entre(1.5, 3, 0.1), D = a.entre(0.8, 1.5, 0.1), g = a.entre(18, 20, 1);
      // ple* tirée dans la fourchette de la classe : l'énoncé reste cohérent.
      const [bas, haut] = CLASSES_F62[classe].pl;
      const ple = a.entre(Math.max(bas, 0.35), Number.isFinite(haut) ? haut : bas + 1.5, 0.05);
      const De = +(a.entre(0.4, 0.9, 0.05) * D).toFixed(2);
      const V = a.entre(300, 900, 10), H = +(V * a.entre(0, 0.2, 0.01)).toFixed(0);
      const k = S.kpF62({ classe, B, L: 1, forme: "filante", De });
      const delta = deg(Math.atan(H / V));
      const idb = S.idbF62({ sol: classe.startsWith("argile") ? "coherent" : "frottant", delta, B, De }).i;
      const q0 = g * D;
      const p = S.portanceF62({ qnette: k.k * ple * 1000, q0, idb, qref: V / B, etat: "ELU" });
      return {
        enonce: `Semelle filante B = ${frd(B, 1)} m fondée à D = ${frd(D, 1)} m (γ = ${fr(g, 2)} kN/m³, pas de nappe) sur ${CLASSES_F62[classe].nom.toLowerCase()} (classe ${CLASSES_F62[classe].lettre}, comportement ${classe.startsWith("argile") ? "cohérent" : "frottant"}) : ple* = ${frd(ple, 2)} MPa, De = ${frd(De, 2)} m. À l'ELU fondamental : V = ${fr(V, 3)} kN/m centrée, H = ${fr(H, 3)} kN/m.`,
        donnees: [donnee("B · D", `${frd(B, 1)} · ${frd(D, 1)} m`), donnee("Sol", `${CLASSES_F62[classe].nom} (${CLASSES_F62[classe].lettre})`), donnee("ple* · De", `${frd(ple, 2)} MPa · ${frd(De, 2)} m`), donnee("V · H (ELU)", `${fr(V, 3)} · ${fr(H, 3)} kN/m`)],
        questions: [
          nombre("Facteur de portance kp ?", k.k, "", `kp = ${frd(k.k0, 1)} [1 + ${frd(k.a, 2)} × 0,6 × ${frd(k.DeB, 3)}] = ${frd(k.k, 3)} (filante : B/L = 0).`, { rel: 0.01 }),
          nombre("Coefficient iδβ ?", idb, "", `δ = ${frd(delta, 2)}° ; ${classe.startsWith("argile") ? "sol cohérent : Φ1" : "sol frottant : Φ2"} = ${frd(idb, 3)}.`, { rel: 0.015 }),
          nombre("Contrainte admissible q'0 + kp ple* iδβ / 2 ?", p.qadm, "kPa", `q'0 = ${fr(g, 2)} × ${frd(D, 1)} = ${fr(q0, 3)} kPa ; ${frd(k.k, 3)} × ${fr(ple * 1000, 4)} × ${frd(idb, 3)} / 2 + ${fr(q0, 3)} = ${fr(p.qadm, 4)} kPa.`, { rel: 0.02 }),
          nombre("Taux de travail q'ref / q'adm ?", p.taux, "", `q'ref = V/B = ${fr(V / B, 4)} kPa (charge centrée) ; ${fr(V / B, 4)} / ${fr(p.qadm, 4)} = ${frd(p.taux, 3)} ${p.ok ? "≤ 1 : portance vérifiée" : "> 1 : portance insuffisante"}.`, { rel: 0.02 }),
        ],
      };
    },
  },
  {
    id: "ch4-ec7", titre: "Portance d'une semelle à la NF P94-261", difficulte: 3,
    generer(a) {
      const categorie = a.choix(["argile", "sable"]);
      const B = a.entre(1.5, 3, 0.1), D = a.entre(0.8, 1.5, 0.1), g = a.entre(18, 20, 1);
      const ple = a.entre(0.8, 2, 0.05), De = +(a.entre(0.4, 0.9, 0.05) * D).toFixed(2);
      const V = a.entre(400, 1200, 10), H = +(V * a.entre(0, 0.2, 0.01)).toFixed(0);
      const e = +(a.entre(0, 0.12, 0.01) * B).toFixed(2);
      const k = S.kpEC7({ categorie, B, forme: "filante", De });
      const delta = deg(Math.atan(H / V));
      const id = S.idEC7({ sol: categorie === "argile" ? "coherent" : "frottant", delta, B, De }).i;
      const ex = S.excentrementEC7({ forme: "filante", B, eB: e });
      const qnet = k.k * ple * id * 1000;
      const p = S.portanceEC7({ A: B, ie: ex.ie, qnet, q0: g * D, Vd: V, etat: "ELU" });
      return {
        enonce: `Semelle filante B = ${frd(B, 1)} m, D = ${frd(D, 1)} m (γ = ${fr(g, 2)} kN/m³), sur ${categorie === "argile" ? "une argile (comportement cohérent)" : "un sable (comportement frottant)"} : ple* = ${frd(ple, 2)} MPa, De = ${frd(De, 2)} m. ELU fondamental : Vd = ${fr(V, 3)} kN/m (poids de la semelle et des terres compris), Hd = ${fr(H, 3)} kN/m, excentrement e = ${frd(e, 2)} m.`,
        donnees: [donnee("B · D", `${frd(B, 1)} · ${frd(D, 1)} m`), donnee("ple* · De", `${frd(ple, 2)} MPa · ${frd(De, 2)} m`), donnee("Vd · Hd", `${fr(V, 3)} · ${fr(H, 3)} kN/m`), donnee("e", `${frd(e, 2)} m`)],
        questions: [
          nombre("kp (filante) ?", k.k, "", `kp = k0 + (a + b De/B)(1 − e^(−c De/B)) = ${frd(k.k, 3)} pour De/B = ${frd(k.DeB, 3)}.`, { rel: 0.01 }),
          nombre("iδ ?", id, "", `δ = ${frd(delta, 2)}° → iδ = ${frd(id, 3)}.`, { rel: 0.015 }),
          nombre("Surface effective A' par mètre ?", ex.Aprime, "m²/m", `A' = B − 2e = ${frd(B, 1)} − 2 × ${frd(e, 2)} = ${frd(ex.Aprime, 3)} m²/m (ie = ${frd(ex.ie, 3)}).`, { rel: 0.01 }),
          nombre("Résistance nette de calcul Rv;d ?", p.Rvd, "kN/m", `qnet = kp ple* iδ = ${fr(qnet, 4)} kPa ; Rv;d = A' qnet / (1,4 × 1,2) = ${frd(ex.Aprime, 3)} × ${fr(qnet, 4)} / 1,68 = ${fr(p.Rvd, 4)} kN/m.`, { rel: 0.02 }),
          nombre("Taux (Vd − R0) / Rv;d ?", p.taux, "", `R0 = A q0 = ${frd(B, 1)} × ${fr(g * D, 3)} = ${fr(p.R0, 4)} kN/m ; (${fr(V, 3)} − ${fr(p.R0, 4)}) / ${fr(p.Rvd, 4)} = ${frd(p.taux, 3)} : ${p.ok ? "vérifié" : "non vérifié"}.`, { rel: 0.02 }),
        ],
      };
    },
  },
];
