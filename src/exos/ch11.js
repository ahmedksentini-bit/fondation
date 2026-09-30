// Exercices du chapitre 11 : frottement négatif et groupes de pieux.
import { fr, frd, nombre, choixMelange, donnee } from "./alea.js";
import { lambdaCombarieu, muIsole, frottementNegatif, rayonInfluence, K_TAN_DELTA } from "../geotech/frottement-negatif.js";
import { converseLabarre, efficaciteCoherentF62, efficaciteEC7, verifGroupeEC7 } from "../geotech/groupes.js";

export default [
  {
    id: "ch11-lambda", titre: "Effet d'accrochage de Combarieu", difficulte: 1,
    generer(a) {
      const [cle, mise] = a.choix([["argile-molle", "fore"], ["argile-molle", "battu"], ["tourbe", "tube"], ["argile-ferme", "fore"], ["argile-ferme", "battu"], ["argile-molle", "tube"]]);
      const Kt = K_TAN_DELTA[cle][mise], R = a.entre(0.2, 0.6, 0.05);
      const lam = lambdaCombarieu(Kt), mu = muIsole(lam), L0 = R / (mu * Kt);
      return {
        enonce: `Pieu ${mise === "fore" ? "foré" : mise === "battu" ? "battu" : "tubé"} de rayon R = ${frd(R, 2)} m traversant ${K_TAN_DELTA[cle].nom.toLowerCase()}.`,
        donnees: [donnee("Sol", K_TAN_DELTA[cle].nom), donnee("Pieu", mise), donnee("R", `${frd(R, 2)} m`)],
        questions: [
          nombre("K tanδ ?", Kt, "", `Tableau de l'annexe G.2 (F62) / H.2.2.1 (NF P94-262) : K tanδ = ${frd(Kt, 2)}.`, { abs: 0.001 }),
          nombre("Coefficient λ ?", lam, "", Kt <= 0.15 ? `K tanδ ≤ 0,15 : λ = 1/(0,5 + 25 K tanδ) = ${frd(lam, 3)}.` : `0,15 < K tanδ ≤ 0,385 : λ = 0,385 − K tanδ = ${frd(lam, 3)}.`, { rel: 0.01 }),
          nombre("μ = λ²/(1 + λ) ?", mu, "", `μ = ${frd(lam, 3)}² / ${frd(1 + lam, 3)} = ${frd(mu, 4)}.`, { rel: 0.01 }),
          nombre("Longueur caractéristique L0 = R/(μ K tanδ) ?", L0, "m", `L0 = ${frd(R, 2)} / (${frd(mu, 4)} × ${frd(Kt, 2)}) = ${frd(L0, 1)} m : sur une couche beaucoup plus mince que L0, σ'v au contact reste proche de sa valeur en tête.`, { rel: 0.015 }),
        ],
      };
    },
  },
  {
    id: "ch11-fn-sable", titre: "Frottement négatif sans accrochage", difficulte: 2,
    generer(a) {
      const B = a.entre(0.4, 1, 0.1), q = a.entre(20, 80, 5), g = a.entre(8, 11, 0.5), H = a.entre(3, 8, 0.5);
      const Kt = 0.45;
      const r = frottementNegatif({ R: B / 2, q, couches: [{ z0: 0, z1: H, gamma: g, Kt }] });
      const P = Math.PI * B, integrale = q * H + (g * H * H) / 2;
      return {
        enonce: `Un pieu de diamètre B = ${frd(B, 1)} m traverse ${frd(H, 1)} m de sable lâche (γ' = ${frd(g, 1)} kN/m³, K tanδ = 0,45) sur lequel on applique une surcharge étendue q = ${fr(q, 2)} kPa. Toute la couche tasse plus que le pieu.`,
        donnees: [donnee("B", `${frd(B, 1)} m`), donnee("Couche", `${frd(H, 1)} m · γ' = ${frd(g, 1)} kN/m³`), donnee("q", `${fr(q, 2)} kPa`)],
        questions: [
          nombre("Coefficient λ ?", lambdaCombarieu(Kt), "", "K tanδ = 0,45 > 0,385 : λ = 0, pas d'effet d'accrochage — la contrainte au contact est celle du champ libre σ'1 = q + γ' z.", { abs: 0.001 }),
          nombre("∫ σ'v dz sur la couche ?", integrale, "kN/m", `∫ (q + γ' z) dz = q H + γ' H²/2 = ${fr(q * H, 4)} + ${fr((g * H * H) / 2, 4)} = ${fr(integrale, 4)} kN/m.`, { rel: 0.01 }),
          nombre("Frottement négatif Fn ?", r.Fn, "kN", `Fn = P K tanδ ∫ σ'v dz = ${frd(P, 3)} × 0,45 × ${fr(integrale, 4)} = ${fr(r.Fn, 4)} kN.`, { rel: 0.01 }),
        ],
      };
    },
  },
  {
    id: "ch11-cumul", titre: "Cumul du frottement négatif et des charges variables", difficulte: 2,
    generer(a) {
      const G = a.entre(800, 2500, 50), Qp = a.entre(200, 900, 50), Fn = a.entre(200, 900, 50);
      const Gd = 1.35 * G, Qd = 1.5 * Qp, Fnd = 1.35 * Fn;
      const Fd = Gd + Math.max(Fnd, Qd);
      return {
        enonce: `Tête de pieu : effort permanent (parts quasi permanentes des variables comprises) G' = ${fr(G, 4)} kN ; part non quasi permanente des actions variables Q' = ${fr(Qp, 4)} kN ; frottement négatif caractéristique Gsn = ${fr(Fn, 4)} kN.`,
        donnees: [donnee("G'", `${fr(G, 4)} kN`), donnee("Q'", `${fr(Qp, 4)} kN`), donnee("Gsn", `${fr(Fn, 4)} kN`)],
        questions: [
          nombre("Gsn,d à l'ELU (défavorable) ?", Fnd, "kN", `γsn = 1,35 : ${fr(Fnd, 4)} kN (au Fascicule 62 : 1,125 × 1,2 = 1,35 également).`, { rel: 0.005 }),
          nombre("Q'd ?", Qd, "kN", `1,5 × ${fr(Qp, 4)} = ${fr(Qd, 4)} kN.`, { rel: 0.005 }),
          nombre("Effort axial de calcul Fd ?", Fd, "kN", `Fd = G'd + max(Gsn,d ; Q'd) = ${fr(Gd, 5)} + max(${fr(Fnd, 4)} ; ${fr(Qd, 4)}) = ${fr(Fd, 5)} kN.`, { rel: 0.005 }),
          nombre("Ce qu'aurait donné, à tort, la somme des maxima ?", Gd + Fnd + Qd, "kN", `${fr(Gd + Fnd + Qd, 5)} kN, soit ${fr(Math.min(Fnd, Qd), 4)} kN de trop : une charge variable réduit le frottement négatif au lieu de s'y ajouter.`, { rel: 0.005 }),
        ],
      };
    },
  },
  {
    id: "ch11-converse", titre: "Coefficient d'efficacité au Fascicule 62", difficulte: 1,
    generer(a) {
      const B = a.entre(0.4, 1, 0.1), rap = a.entre(1.5, 3.5, 0.5), m = a.entier(2, 4), n = a.entier(2, 5);
      const d = +(rap * B).toFixed(2);
      const cl = converseLabarre({ B, d, m, n }), coh = efficaciteCoherentF62({ B, d });
      return {
        enonce: `Groupe de ${m} × ${n} pieux de diamètre B = ${frd(B, 1)} m, en maille carrée d'entraxe d = ${frd(d, 2)} m.`,
        donnees: [donnee("m × n", `${m} × ${n}`), donnee("B · d", `${frd(B, 1)} · ${frd(d, 2)} m`), donnee("d/B", frd(d / B, 2))],
        questions: [
          nombre("Converse-Labarre ?", cl, "", `Ce = 1 − [arctan(B/d)/(π/2)] (2 − 1/m − 1/n) = 1 − [${frd(Math.atan(B / d), 4)}/1,5708] × ${frd(2 - 1 / m - 1 / n, 3)} = ${frd(cl, 3)}.`, { rel: 0.01 }),
          nombre("Formule des sols cohérents ?", coh, "", d / B >= 3 ? "d ≥ 3B : Ce = 1." : `Ce = ¼ (1 + d/B) = ¼ × ${frd(1 + d / B, 2)} = ${frd(coh, 3)}.`, { rel: 0.01 }),
          choixMelange(a, "Dans un sable lâche, avec des pieux battus, quelle valeur le Fascicule 62 autorise-t-il ?", ["Ce = 1", "Converse-Labarre", "la formule des sols cohérents"],
            "Le battage densifie le sable lâche : le groupe porte au moins autant que la somme des pieux (F62 annexe G.1 § 2.5,2) — à condition de battre d'abord les pieux périphériques."),
        ],
      };
    },
  },
  {
    id: "ch11-ce-ec7", titre: "Effet de groupe à la NF P94-262", difficulte: 2,
    generer(a) {
      const B = a.entre(0.4, 1, 0.1), rap = a.entre(1.5, 2.9, 0.1), m = a.entier(2, 4), n = a.entier(2, 5);
      const d = +(rap * B).toFixed(2), Rb = a.entre(200, 1000, 10), Rs = a.entre(400, 2000, 10);
      const ce = efficaciteEC7({ B, d, m, n });
      const v = verifGroupeEC7({ Fcgd: 0, N: m * n, Rbd: Rb, Rsd: Rs, Ce: ce });
      const Cd = 1 - 0.25 * (1 + d / B);
      return {
        enonce: `Groupe de ${m} × ${n} pieux, B = ${frd(B, 1)} m, d = ${frd(d, 2)} m. Pour un pieu isolé : Rb;d = ${fr(Rb, 4)} kN, Rs;d = ${fr(Rs, 4)} kN.`,
        donnees: [donnee("m × n", `${m} × ${n}`), donnee("d/B", frd(d / B, 2)), donnee("Rb;d · Rs;d", `${fr(Rb, 4)} · ${fr(Rs, 4)} kN`)],
        questions: [
          nombre("Cd ?", Cd, "", `Cd = 1 − ¼ (1 + d/B) = 1 − ¼ × ${frd(1 + d / B, 2)} = ${frd(Cd, 3)}.`, { rel: 0.01 }),
          nombre("Ce ?", ce, "", `Ce = 1 − Cd [2 − (1/m + 1/n)] = 1 − ${frd(Cd, 3)} × ${frd(2 - 1 / m - 1 / n, 3)} = ${frd(ce, 3)}.`, { rel: 0.01 }),
          nombre("Résistance de calcul du groupe ?", v.R, "kN", `N (Rb;d + Ce Rs;d) = ${m * n} × (${fr(Rb, 4)} + ${frd(ce, 3)} × ${fr(Rs, 4)}) = ${fr(v.R, 5)} kN : seul le frottement est réduit.`, { rel: 0.01 }),
        ],
      };
    },
  },
  {
    id: "ch11-rayon", titre: "Pieu au sein d'un groupe : cylindre d'influence", difficulte: 2,
    generer(a) {
      const d = a.entre(1.2, 3, 0.1), unique = a.choix([true, false]), dp = unique ? null : a.entre(1.2, 3, 0.1), q = a.entre(30, 100, 5);
      const b = rayonInfluence(unique ? { d } : { d, dPrime: dp });
      return {
        enonce: unique
          ? `File unique de pieux d'entraxe d = ${frd(d, 1)} m sous un remblai qui applique q = ${fr(q, 3)} kPa au terrain naturel.`
          : `Groupe en maille rectangulaire d × d' = ${frd(d, 1)} m × ${frd(dp, 1)} m sous un remblai qui applique q = ${fr(q, 3)} kPa au terrain naturel.`,
        donnees: [donnee(unique ? "d" : "d × d'", unique ? `${frd(d, 1)} m` : `${frd(d, 1)} × ${frd(dp, 1)} m`), donnee("q", `${fr(q, 3)} kPa`)],
        questions: [
          nombre("Rayon d'influence b ?", b, "m", unique ? `b = d/√π = ${frd(d, 1)} / 1,7725 = ${frd(b, 3)} m.` : `b = √(d d'/π) = √(${frd(d * dp, 2)}/π) = ${frd(b, 3)} m.`, { rel: 0.01 }),
          nombre("Borne π b² q du frottement négatif d'un pieu intérieur ?", Math.PI * b * b * q, "kN", `π × ${frd(b, 3)}² × ${fr(q, 3)} = ${fr(Math.PI * b * b * q, 4)} kN : un pieu ne peut pas porter plus que le poids de remblai de sa cellule.`, { rel: 0.01 }),
        ],
      };
    },
  },
];
