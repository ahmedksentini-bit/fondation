// Exercices du chapitre 13 : portance sismique (NF EN 1998-5, annexe F).
import { fr, frd, nombre, choixMelange, donnee } from "./alea.js";
import { nmaxCoherent, nmaxFrottant, inertieSol, portanceSismique } from "../geotech/sismique.js";

export default [
  {
    id: "ch13-nmax-coh", titre: "Nmax et inertie d'un sol cohérent", difficulte: 1,
    generer(a) {
      const B = a.entre(1.5, 3.5, 0.1), cu = a.entre(60, 250, 10), gamma = a.entre(18, 21, 0.5), ag = a.entre(0.1, 0.4, 0.02), S = a.choix([1, 1.15, 1.35, 1.5]);
      const Nmax = nmaxCoherent({ cu, B, gammaM: 1.4 });
      const Fb = inertieSol({ sol: "coherent", gamma, alphaG: ag, S, B, cu, gammaM: 1.4 });
      return {
        enonce: `Semelle filante B = ${frd(B, 1)} m sur une argile non sensible : cu = ${fr(cu, 3)} kPa, γ = ${frd(gamma, 1)} kN/m³. Séisme : ag/g = ${frd(ag, 2)}, S = ${frd(S, 2)}. On prend γM = 1,4 sur cu.`,
        donnees: [donnee("B", `${frd(B, 1)} m`), donnee("cu", `${fr(cu, 3)} kPa`), donnee("γ", `${frd(gamma, 1)} kN/m³`), donnee("ag/g · S", `${frd(ag, 2)} · ${frd(S, 2)}`)],
        questions: [
          nombre("Cohésion de calcul c̄ = cu/γM ?", cu / 1.4, "kPa", `${fr(cu, 3)} / 1,4 = ${frd(cu / 1.4, 1)} kPa.`, { rel: 0.01 }),
          nombre("Nmax ?", Nmax, "kN/m", `Nmax = (π + 2) c̄ B = 5,142 × ${frd(cu / 1.4, 1)} × ${frd(B, 1)} = ${fr(Nmax, 4)} kN/m.`, { rel: 0.01 }),
          nombre("Force d'inertie adimensionnelle F̄ ?", Fb, "", `F̄ = ρ ag S B / c̄ = γ (ag/g) S B / c̄ = ${frd(gamma, 1)} × ${frd(ag, 2)} × ${frd(S, 2)} × ${frd(B, 1)} / ${frd(cu / 1.4, 1)} = ${frd(Fb, 3)}.`, { rel: 0.01 }),
        ],
      };
    },
  },
  {
    id: "ch13-nmax-frot", titre: "Nmax et inertie d'un sol frottant", difficulte: 2,
    generer(a) {
      const B = a.entre(1.5, 3.5, 0.1), phi = a.entier(30, 40), gamma = a.entre(18, 21, 0.5), ag = a.entre(0.1, 0.35, 0.02), avg = +(a.entre(0.3, 0.6, 0.05) * ag).toFixed(3);
      const n = nmaxFrottant({ gamma, B, phi, gammaPhi: 1.25, avg });
      const Fb = inertieSol({ sol: "frottant", alphaG: ag, phiD: n.phiD });
      return {
        enonce: `Semelle filante B = ${frd(B, 1)} m sur un sable dense : φ' = ${phi}°, γ = ${frd(gamma, 1)} kN/m³. Séisme : ag/g = ${frd(ag, 2)}, av/g = ${frd(avg, 3)}. On prend γφ' = 1,25 sur tanφ'.`,
        donnees: [donnee("B", `${frd(B, 1)} m`), donnee("φ'", `${phi}°`), donnee("γ", `${frd(gamma, 1)} kN/m³`), donnee("ag/g · av/g", `${frd(ag, 2)} · ${frd(avg, 3)}`)],
        questions: [
          nombre("Angle de calcul φ'd ?", n.phiD, "°", `tanφ'd = tan${phi}°/1,25 = ${frd(Math.tan((phi * Math.PI) / 180) / 1.25, 4)} ⇒ φ'd = ${frd(n.phiD, 2)}°.`, { rel: 0.005 }),
          nombre("Nγ (avec φ'd) ?", n.Ngamma, "", `Nγ = 2 (Nq − 1) tanφ'd = ${frd(n.Ngamma, 2)}.`, { rel: 0.01 }),
          nombre("Nmax, accélération verticale défavorable ?", n.Nmax, "kN/m", `Nmax = ½ γ (1 − av/g) B² Nγ = 0,5 × ${frd(gamma, 1)} × ${frd(1 - avg, 3)} × ${frd(B * B, 2)} × ${frd(n.Ngamma, 2)} = ${fr(n.Nmax, 4)} kN/m.`, { rel: 0.015 }),
          nombre("F̄ ?", Fb, "", `F̄ = (ag/g)/tanφ'd = ${frd(ag, 2)} / ${frd(Math.tan((n.phiD * Math.PI) / 180), 4)} = ${frd(Fb, 3)}.`, { rel: 0.01 }),
        ],
      };
    },
  },
  {
    id: "ch13-verif-coh", titre: "Vérification sismique sur argile", difficulte: 3,
    generer(a) {
      const B = a.entre(2, 3.5, 0.1), cu = a.entre(100, 250, 10), gamma = 20, ag = a.entre(0.1, 0.3, 0.02), S = a.choix([1.15, 1.35, 1.5]);
      const Nmax = nmaxCoherent({ cu, B, gammaM: 1.4 });
      const Fb = inertieSol({ sol: "coherent", gamma, alphaG: ag, S, B, cu, gammaM: 1.4 });
      const N = +(Nmax * a.entre(0.2, 0.55, 0.01)).toFixed(0), V = +(N * a.entre(0.05, 0.2, 0.01)).toFixed(0), M = +(N * B * a.entre(0.02, 0.12, 0.01)).toFixed(0);
      const gRd = a.choix([1, 1.15]);
      const r = portanceSismique({ sol: "coherent", N, V, M, B, Nmax, Fb, gammaRd: gRd });
      return {
        enonce: `Semelle filante B = ${frd(B, 1)} m sur argile (cu = ${fr(cu, 3)} kPa, γM = 1,4, γ = 20 kN/m³), ag/g = ${frd(ag, 2)}, S = ${frd(S, 2)}, γRd = ${frd(gRd, 2)}. Efforts sismiques de calcul : N = ${fr(N, 4)} kN/m, V = ${fr(V, 3)} kN/m, M = ${fr(M, 4)} kN·m/m.`,
        donnees: [donnee("B · cu", `${frd(B, 1)} m · ${fr(cu, 3)} kPa`), donnee("ag/g · S", `${frd(ag, 2)} · ${frd(S, 2)}`), donnee("γRd", frd(gRd, 2)), donnee("N · V · M", `${fr(N, 4)} · ${fr(V, 3)} · ${fr(M, 4)}`)],
        questions: [
          nombre("N̄ ?", r.Nb, "", `Nmax = ${fr(Nmax, 4)} kN/m ; N̄ = γRd N/Nmax = ${frd(gRd, 2)} × ${fr(N, 4)} / ${fr(Nmax, 4)} = ${frd(r.Nb, 3)}.`, { rel: 0.01 }),
          nombre("M̄ ?", r.Mb, "", `M̄ = γRd M/(B Nmax) = ${frd(r.Mb, 4)}.`, { rel: 0.01 }),
          nombre("Valeur du membre de gauche de F.1 ?", r.valeur, "", `F̄ = ${frd(Fb, 3)} ; terme d'effort ${frd(r.t1, 3)}, terme de moment ${frd(r.t2, 3)} ; ${frd(r.t1, 3)} + ${frd(r.t2, 3)} − 1 = ${frd(r.valeur, 3)}.`, { abs: 0.02 }),
          choixMelange(a, "Portance sismique ?", r.ok ? ["vérifiée", "non vérifiée"] : ["non vérifiée", "vérifiée"],
            `Conditions ${r.conditionN ? "respectées" : "non respectées"} (N̄ ≤ ${frd(r.lim, 3)}, |V̄| ≤ 1) et membre de gauche ${r.valeur <= 0 ? "≤ 0" : "> 0"}.`),
        ],
      };
    },
  },
  {
    id: "ch13-verif-frot", titre: "Vérification sismique sur sable", difficulte: 3,
    generer(a) {
      const B = a.entre(2, 4, 0.1), phi = a.entier(32, 40), gamma = 20, ag = a.entre(0.08, 0.25, 0.01), avg = +(0.45 * ag).toFixed(3);
      const n = nmaxFrottant({ gamma, B, phi, gammaPhi: 1.25, avg });
      const Fb = inertieSol({ sol: "frottant", alphaG: ag, phiD: n.phiD });
      const N = +(n.Nmax * a.entre(0.1, 0.4, 0.01)).toFixed(0), V = +(N * a.entre(0.05, 0.15, 0.01)).toFixed(0), M = +(N * B * a.entre(0.02, 0.08, 0.01)).toFixed(0);
      const r = portanceSismique({ sol: "frottant", N, V, M, B, Nmax: n.Nmax, Fb, gammaRd: 1 });
      return {
        enonce: `Semelle filante B = ${frd(B, 1)} m sur sable dense (φ' = ${phi}°, γφ' = 1,25, γ = 20 kN/m³), ag/g = ${frd(ag, 2)}, av/g = ${frd(avg, 3)}, γRd = 1. Efforts : N = ${fr(N, 4)} kN/m, V = ${fr(V, 3)} kN/m, M = ${fr(M, 4)} kN·m/m.`,
        donnees: [donnee("B · φ'", `${frd(B, 1)} m · ${phi}°`), donnee("ag/g · av/g", `${frd(ag, 2)} · ${frd(avg, 3)}`), donnee("N · V · M", `${fr(N, 4)} · ${fr(V, 3)} · ${fr(M, 4)}`)],
        questions: [
          nombre("F̄ ?", Fb, "", `φ'd = ${frd(n.phiD, 2)}° ; F̄ = (ag/g)/tanφ'd = ${frd(Fb, 3)}.`, { rel: 0.01 }),
          nombre("Borne (1 − m F̄^k)^k' de N̄ ?", r.lim, "", `(1 − 0,96 × ${frd(Fb, 3)})^0,39 = ${frd(r.lim, 3)} : l'inertie du sol réduit déjà la charge verticale admissible.`, { rel: 0.01 }),
          nombre("N̄ ?", r.Nb, "", `Nmax = ${fr(n.Nmax, 4)} kN/m ; N̄ = ${frd(r.Nb, 3)}.`, { rel: 0.015 }),
          choixMelange(a, "Portance sismique ?", r.ok ? ["vérifiée", "non vérifiée"] : ["non vérifiée", "vérifiée"],
            `Membre de gauche de F.1 : ${Number.isFinite(r.valeur) ? frd(r.valeur, 3) : "—"} ; conditions ${r.conditionN && r.conditionV ? "respectées" : "non respectées"}.`),
        ],
      };
    },
  },
];
