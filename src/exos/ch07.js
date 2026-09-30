// Exercices du chapitre 7 : portance par la méthode c–φ.
import { fr, frd, nombre, choixMelange, donnee } from "./alea.js";
import { facteursPortance, portanceDrainee, portanceNonDrainee, verificationDA2, verificationAnnexeF } from "../geotech/cphi.js";

export default [
  {
    id: "ch7-N", titre: "Facteurs de portance", difficulte: 1,
    generer(a) {
      const phi = a.entier(20, 38);
      const N = facteursPortance(phi);
      const t = Math.tan((phi * Math.PI) / 180);
      return {
        enonce: `Sol d'angle de frottement effectif φ' = ${phi}°. On applique l'annexe D de l'EN 1997-1.`,
        donnees: [donnee("φ'", `${phi}°`), donnee("tan φ'", frd(t, 4))],
        questions: [
          nombre("Nq ?", N.Nq, "", `Nq = e^(π tanφ') tan²(45° + φ'/2) = e^(${frd(Math.PI * t, 4)}) × tan²(${frd(45 + phi / 2, 1)}°) = ${frd(N.Nq, 2)}.`, { rel: 0.01 }),
          nombre("Nc ?", N.Nc, "", `Nc = (Nq − 1) cotφ' = ${frd(N.Nq - 1, 3)} / ${frd(t, 4)} = ${frd(N.Nc, 2)}.`, { rel: 0.01 }),
          nombre("Nγ (base rugueuse) ?", N.Ngamma, "", `Nγ = 2 (Nq − 1) tanφ' = 2 × ${frd(N.Nq - 1, 3)} × ${frd(t, 4)} = ${frd(N.Ngamma, 2)}.`, { rel: 0.01 }),
          choixMelange(a, "Lequel de ces facteurs n'a pas de solution exacte ?", ["Nγ", "Nq", "Nc"],
            "Nq et Nc sont exacts (Prandtl, Reissner) pour un sol sans poids ; Nγ, qui dépend du poids du sol mobilisé, n'a que des approximations — et varie de ± 25 % selon les auteurs."),
        ],
      };
    },
  },
  {
    id: "ch7-nd", titre: "Portance à court terme d'une semelle filante", difficulte: 2,
    generer(a) {
      const B = a.entre(1.5, 3, 0.1), e = +(a.entre(0, 0.12, 0.01) * B).toFixed(2), Bp = B - 2 * e;
      const cu = a.entre(30, 90, 5), gamma = a.entre(18, 21, 0.5), D = a.entre(0.8, 1.8, 0.1), q = gamma * D;
      const H = +(a.entre(0, 0.3, 0.01) * Bp * cu).toFixed(0);
      const Vd = a.entre(200, 500, 10);
      const r = portanceNonDrainee({ forme: "filante", Bp, cu, q, H });
      const v = verificationDA2({ Rk: r.R, Vd });
      return {
        enonce: `Semelle filante B = ${frd(B, 1)} m, fondée à D = ${frd(D, 1)} m (γ = ${frd(gamma, 1)} kN/m³) sur une argile saturée de cohésion non drainée cu = ${fr(cu, 3)} kPa. À l'ELU : Vd = ${fr(Vd, 3)} kN/m, Hd = ${fr(H, 3)} kN/m, excentrement e = ${frd(e, 2)} m.`,
        donnees: [donnee("B · e", `${frd(B, 1)} m · ${frd(e, 2)} m`), donnee("cu", `${fr(cu, 3)} kPa`), donnee("q = γ D", `${fr(q, 3)} kPa`), donnee("Vd · Hd", `${fr(Vd, 3)} · ${fr(H, 3)} kN/m`)],
        questions: [
          nombre("Largeur effective B' ?", Bp, "m", `B' = B − 2e = ${frd(B, 1)} − 2 × ${frd(e, 2)} = ${frd(Bp, 2)} m.`, { rel: 0.005 }),
          nombre("Facteur d'inclinaison ic ?", r.ic, "", `ic = ½ [1 + √(1 − H/(A' cu))] = ½ [1 + √(1 − ${fr(H, 3)}/(${frd(Bp, 2)} × ${fr(cu, 3)}))] = ${frd(r.ic, 3)}.`, { rel: 0.01 }),
          nombre("Contrainte de rupture brute R/A' ?", r.qu, "kPa", `R/A' = (π + 2) cu ic + q = 5,142 × ${fr(cu, 3)} × ${frd(r.ic, 3)} + ${fr(q, 3)} = ${fr(r.qu, 4)} kPa.`, { rel: 0.01 }),
          nombre("Résistance de calcul Rd (approche 2, γR;v = 1,4) ?", v.Rd, "kN/m", `Rd = A' (R/A') / 1,4 = ${frd(Bp, 2)} × ${fr(r.qu, 4)} / 1,4 = ${fr(v.Rd, 4)} kN/m ${v.ok ? "≥" : "<"} Vd = ${fr(Vd, 3)} kN/m.`, { rel: 0.015 }),
        ],
      };
    },
  },
  {
    id: "ch7-dr", titre: "Portance à long terme sous charge inclinée", difficulte: 3,
    generer(a) {
      const Bp = a.entre(1.5, 3, 0.1), phi = a.entier(24, 34), c = a.entre(0, 10, 1);
      const gamma = a.entre(9, 11, 0.5), q = a.entre(15, 35, 0.5);
      const V = a.entre(250, 700, 10), H = +(V * a.entre(0.05, 0.25, 0.01)).toFixed(0);
      const r = portanceDrainee({ forme: "filante", Bp, phi, c, q, gamma, V, H });
      const t = Math.tan((phi * Math.PI) / 180);
      return {
        enonce: `Semelle filante de largeur effective B' = ${frd(Bp, 1)} m. Sol : φ' = ${phi}°, c' = ${fr(c, 2)} kPa, γ' = ${frd(gamma, 1)} kN/m³ (nappe au niveau de la base) ; surcharge effective des terres q' = ${frd(q, 1)} kPa. Charges de calcul : V = ${fr(V, 3)} kN/m, H = ${fr(H, 3)} kN/m.`,
        donnees: [donnee("B'", `${frd(Bp, 1)} m`), donnee("φ' · c'", `${phi}° · ${fr(c, 2)} kPa`), donnee("γ' · q'", `${frd(gamma, 1)} kN/m³ · ${frd(q, 1)} kPa`), donnee("V · H", `${fr(V, 3)} · ${fr(H, 3)} kN/m`)],
        questions: [
          nombre("Facteur iq ?", r.iq, "", `m = 2 (filante) ; iq = [1 − H/(V + A'c' cotφ')]² = [1 − ${fr(H, 3)}/(${fr(V, 3)} + ${frd(Bp, 1)} × ${fr(c, 2)} / ${frd(t, 3)})]² = ${frd(r.iq, 3)}.`, { rel: 0.01 }),
          nombre("Facteur iγ ?", r.ig, "", `iγ = [ … ]³ = ${frd(r.ig, 3)}.`, { rel: 0.01 }),
          nombre("Contrainte de rupture brute R/A' ?", r.qu, "kPa", `c' Nc ic + q' Nq iq + ½ γ' B' Nγ iγ = ${fr(r.termeC, 4)} + ${fr(r.termeQ, 4)} + ${fr(r.termeG, 4)} = ${fr(r.qu, 4)} kPa (Nq = ${frd(r.Nq, 2)}, Nc = ${frd(r.Nc, 2)}, Nγ = ${frd(r.Ngamma, 2)}).`, { rel: 0.02 }),
          choixMelange(a, "Quel terme porte l'essentiel de la résistance ici ?",
            [[r.termeC, "le terme de cohésion c' Nc"], [r.termeQ, "le terme de surcharge q' Nq"], [r.termeG, "le terme de pesanteur ½ γ' B' Nγ"]].sort((x, y) => y[0] - x[0]).map((x) => x[1]),
            `Les trois termes valent ${fr(r.termeC, 3)}, ${fr(r.termeQ, 3)} et ${fr(r.termeG, 3)} kPa. L'inclinaison frappe plus fort le terme de pesanteur (iγ = ${frd(r.ig, 3)}) que les autres.`),
        ],
      };
    },
  },
  {
    id: "ch7-forme", titre: "Semelle rectangulaire : facteurs de forme", difficulte: 2,
    generer(a) {
      const Bp = a.entre(1.5, 3, 0.1), Lp = a.entre(Bp, 3 * Bp, 0.1), phi = a.entier(26, 36);
      const gamma = a.entre(17, 20, 0.5), q = a.entre(15, 40, 1);
      const r = portanceDrainee({ forme: Math.abs(Lp - Bp) < 1e-9 ? "carree" : "rectangulaire", Bp, Lp, phi, c: 0, q, gamma, V: 1000, H: 0 });
      const s = Math.sin((phi * Math.PI) / 180);
      return {
        enonce: `Semelle ${frd(Bp, 1)} m × ${frd(Lp, 1)} m (dimensions effectives), sable φ' = ${phi}°, c' = 0, γ = ${frd(gamma, 1)} kN/m³, q' = ${fr(q, 2)} kPa. Charge verticale centrée.`,
        donnees: [donnee("B' × L'", `${frd(Bp, 1)} × ${frd(Lp, 1)} m`), donnee("φ'", `${phi}°`), donnee("γ · q'", `${frd(gamma, 1)} kN/m³ · ${fr(q, 2)} kPa`)],
        questions: [
          nombre("sq ?", r.sq, "", `sq = 1 + (B'/L') sinφ' = 1 + ${frd(Bp / Lp, 3)} × ${frd(s, 3)} = ${frd(r.sq, 3)}.`, { rel: 0.01 }),
          nombre("sγ ?", r.sg, "", `sγ = 1 − 0,3 B'/L' = ${frd(r.sg, 3)}.`, { rel: 0.01 }),
          nombre("R/A' ?", r.qu, "kPa", `q' Nq sq + ½ γ B' Nγ sγ = ${fr(r.termeQ, 4)} + ${fr(r.termeG, 4)} = ${fr(r.qu, 4)} kPa (sans cohésion, le terme c' Nc disparaît).`, { rel: 0.02 }),
          nombre("Résistance totale Rk = A' (R/A') ?", r.R, "kN", `${frd(Bp * Lp, 2)} m² × ${fr(r.qu, 4)} kPa = ${fr(r.R, 5)} kN.`, { rel: 0.02 }),
        ],
      };
    },
  },
  {
    id: "ch7-annexeF", titre: "La même semelle à l'EN 1997-1 et à la NF P94-261", difficulte: 3,
    generer(a) {
      const drainage = a.choix(["draine", "non-draine"]);
      const B = a.entre(2, 3, 0.1), Bp = +(B * a.entre(0.8, 1, 0.02)).toFixed(2);
      const qu = a.entre(200, 450, 5), q0 = a.entre(20, 40, 1), Vd = +(qu * Bp / a.entre(1.4, 2.6, 0.1)).toFixed(0);
      const da2 = verificationDA2({ Rk: qu * Bp, Vd });
      const af = verificationAnnexeF({ A: B, Ap: Bp, quBrut: qu, q0, Vd, drainage });
      return {
        enonce: `Semelle filante B = ${frd(B, 1)} m, largeur effective B' = ${frd(Bp, 2)} m. Le calcul de l'annexe D donne une contrainte de rupture brute R/A' = ${fr(qu, 3)} kPa en conditions ${drainage === "draine" ? "drainées" : "non drainées"} ; q0 = ${fr(q0, 2)} kPa au niveau de la base (sans nappe). À l'ELU : Vd = ${fr(Vd, 3)} kN/m.`,
        donnees: [donnee("B · B'", `${frd(B, 1)} · ${frd(Bp, 2)} m`), donnee("R/A'", `${fr(qu, 3)} kPa`), donnee("q0", `${fr(q0, 2)} kPa`), donnee("Vd", `${fr(Vd, 3)} kN/m`)],
        questions: [
          nombre("Rd de l'EN 1997-1, approche 2 ?", da2.Rd, "kN/m", `Rd = A' (R/A') / 1,4 = ${frd(Bp, 2)} × ${fr(qu, 3)} / 1,4 = ${fr(da2.Rd, 4)} kN/m.`, { rel: 0.01 }),
          nombre("Rv;d de la NF P94-261, annexe F ?", af.Rvd, "kN/m", `qnet = ${fr(qu, 3)} − ${fr(q0, 2)} = ${fr(af.qnet, 3)} kPa ; γR;v γR;d;v = 1,4 × ${frd(af.gammaRdv, 1)} = ${frd(af.facteur, 2)} ; Rv;d = ${frd(Bp, 2)} × ${fr(af.qnet, 3)} / ${frd(af.facteur, 2)} = ${fr(af.Rvd, 4)} kN/m.`, { rel: 0.01 }),
          nombre("Taux (Vd − R0)/Rv;d ?", af.taux, "", `R0 = B q0 = ${fr(af.R0, 3)} kN/m ; (${fr(Vd, 3)} − ${fr(af.R0, 3)}) / ${fr(af.Rvd, 4)} = ${frd(af.taux, 3)}.`, { rel: 0.015 }),
          choixMelange(a, "Verdicts ?",
            [`EN 1997-1 : ${da2.ok ? "vérifié" : "non vérifié"} ; NF P94-261 : ${af.ok ? "vérifié" : "non vérifié"}`, `EN 1997-1 : ${da2.ok ? "non vérifié" : "vérifié"} ; NF P94-261 : ${af.ok ? "vérifié" : "non vérifié"}`, `EN 1997-1 : ${da2.ok ? "vérifié" : "non vérifié"} ; NF P94-261 : ${af.ok ? "non vérifié" : "vérifié"}`],
            `Surdimensionnement ${frd(da2.surdimensionnement, 2)} à l'approche 2 contre un taux de ${frd(af.taux, 2)} à la norme française. ${drainage === "draine" ? "En conditions drainées, le coefficient de modèle 2,0 porte le facteur global à 2,8 : c'est lui qui fait la différence." : "En conditions non drainées, γR;d;v = 1,2 : la résistance nette et le coefficient de modèle se compensent en partie."}`),
        ],
      };
    },
  },
];
