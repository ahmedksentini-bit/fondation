// Exercices du chapitre 9 : tassements et module de réaction.
import { fr, frd, nombre, choixMelange, donnee } from "./alea.js";
import { tassementMenard, moduleEd, moduleReaction, schmertmann, tassementOedometrique, tassementElastique, coefficientCf, lambdas } from "../geotech/tassements.js";
import { fraction } from "./alea.js";

export default [
  {
    id: "ch9-menard", titre: "Tassement pressiométrique en sol homogène", difficulte: 2,
    generer(a) {
      const forme = a.choix(["carree", "rectangulaire", "filante"]);
      const B = a.entre(1.2, 3, 0.1), L = forme === "rectangulaire" ? +(B * a.choix([2, 3, 5])).toFixed(2) : B;
      const EM = a.entre(5, 25, 1), alpha = a.choix([1 / 3, 1 / 2, 2 / 3]);
      const s0 = a.entre(15, 40, 1), q = s0 + a.entre(80, 250, 5);
      const r = tassementMenard({ forme, B, L, q, sigmaV0: s0, alpha, Ec: EM, Ed: EM });
      return {
        enonce: `Semelle ${forme === "carree" ? "carrée" : forme === "filante" ? "filante" : `rectangulaire (L = ${frd(L, 2)} m)`} de largeur B = ${frd(B, 1)} m sur un sol homogène : EM = ${fr(EM, 2)} MPa, α = ${fraction(alpha)}. Sous la combinaison quasi permanente, q' = ${fr(q, 3)} kPa ; σ'v0 = ${fr(s0, 2)} kPa au niveau de la base.`,
        donnees: [donnee("Forme · B", `${forme} · ${frd(B, 1)} m`), donnee("EM · α", `${fr(EM, 2)} MPa · ${fraction(alpha)}`), donnee("q' − σ'v0", `${fr(q - s0, 3)} kPa`)],
        questions: [
          nombre("Coefficient λd ?", r.ld, "", `L/B = ${forme === "filante" ? "∞ (on prend 20)" : frd(L / B, 1)} ⇒ λc = ${frd(r.lc, 2)}, λd = ${frd(r.ld, 2)}.`, { rel: 0.005 }),
          nombre("Tassement sphérique sc ?", r.sc, "mm", `sc = α (q' − σ'v0) λc B / (9 EM) = ${frd(alpha, 3)} × ${fr(q - s0, 3)} × ${frd(r.lc, 2)} × ${frd(B, 1)} / (9 × ${fr(EM * 1000, 5)}) = ${frd(r.sc, 2)} mm.`, { rel: 0.02 }),
          nombre("Tassement déviatorique sd ?", r.sd, "mm", `sd = 2 (q' − σ'v0) B0 (λd B/B0)^α / (9 EM) = 2 × ${fr(q - s0, 3)} × 0,6 × (${frd((r.ld * B) / 0.6, 3)})^${fraction(alpha)} / (9 × ${fr(EM * 1000, 5)}) = ${frd(r.sd, 2)} mm.`, { rel: 0.02 }),
          nombre("Tassement final sf ?", r.sf, "mm", `sf = sc + sd = ${frd(r.sf, 2)} mm.`, { rel: 0.02 }),
        ],
      };
    },
  },
  {
    id: "ch9-Ed", titre: "Module déviatorique d'un sol hétérogène", difficulte: 2,
    generer(a) {
      const E1 = a.entre(4, 12, 0.5), E2 = a.entre(4, 15, 0.5), E35 = a.entre(8, 25, 0.5), E68 = a.entre(12, 35, 0.5), E916 = a.entre(15, 50, 0.5);
      const Ed7 = moduleEd({ E1, E2, E35, E68, E916 });
      const Ed62 = moduleEd({ E1, E2, E35, E68, E916, referentiel: "F62" });
      return {
        enonce: `Sous une semelle, les modules pressiométriques équivalents des tranches B/2 valent E1 = ${frd(E1, 1)} MPa, E2 = ${frd(E2, 1)} MPa, E3;5 = ${frd(E35, 1)} MPa, E6;8 = ${frd(E68, 1)} MPa et E9;16 = ${frd(E916, 1)} MPa.`,
        donnees: [donnee("E1 · E2", `${frd(E1, 1)} · ${frd(E2, 1)} MPa`), donnee("E3;5", `${frd(E35, 1)} MPa`), donnee("E6;8 · E9;16", `${frd(E68, 1)} · ${frd(E916, 1)} MPa`)],
        questions: [
          nombre("Ec ?", E1, "MPa", `Ec = E1 = ${frd(E1, 1)} MPa : le tassement sphérique ne voit que la première tranche.`, { rel: 0.005 }),
          nombre("Ed selon la NF P94-261 ?", Ed7, "MPa", `1/Ed = 0,25/${frd(E1, 1)} + 0,30/${frd(E2, 1)} + 0,25/${frd(E35, 1)} + 0,1/${frd(E68, 1)} + 0,1/${frd(E916, 1)} = ${frd(1 / Ed7, 4)} ⇒ Ed = ${frd(Ed7, 2)} MPa.`, { rel: 0.01 }),
          nombre("Ed selon le Fascicule 62 ?", Ed62, "MPa", `4/Ed = 1/E1 + 1/(0,85 E2) + 1/E3;5 + 1/(2,5 E6;8) + 1/(2,5 E9;16) ⇒ Ed = ${frd(Ed62, 2)} MPa — la somme des poids vaut 0,994 au lieu de 1.`, { rel: 0.01 }),
        ],
      };
    },
  },
  {
    id: "ch9-kv", titre: "Module de réaction sous une semelle", difficulte: 2,
    generer(a) {
      const forme = a.choix(["carree", "rectangulaire"]);
      const B = a.entre(1.2, 3, 0.1), L = forme === "rectangulaire" ? +(B * a.choix([2, 3, 5])).toFixed(2) : B;
      const alpha = a.choix([1 / 3, 1 / 2, 2 / 3]), Ec = a.entre(5, 15, 1), Ed = a.entre(8, 25, 1);
      const k = moduleReaction({ forme, B, L, alpha, Ec, Ed });
      const { lc, ld } = lambdas({ forme, B, L });
      return {
        enonce: `Semelle ${forme === "carree" ? "carrée" : `rectangulaire ${frd(B, 1)} × ${frd(L, 2)} m`} de largeur B = ${frd(B, 1)} m ; Ec = ${fr(Ec, 2)} MPa, Ed = ${fr(Ed, 2)} MPa, α = ${fraction(alpha)}.`,
        donnees: [donnee("B", `${frd(B, 1)} m`), donnee("Ec · Ed", `${fr(Ec, 2)} · ${fr(Ed, 2)} MPa`), donnee("α", fraction(alpha))],
        questions: [
          nombre("Module de réaction kv (charges de longue durée) ?", k.kv / 1000, "MN/m³", `1/kv = α λc B/(9 Ec) + (2 B0/9 Ed)(λd B/B0)^α avec λc = ${frd(lc, 2)}, λd = ${frd(ld, 2)} : kv = ${fr(k.kv / 1000, 3)} MN/m³.`, { rel: 0.02 }),
          nombre("Module pour les charges de courte durée ki ?", k.ki / 1000, "MN/m³", `ki = 2 kv = ${fr(k.ki / 1000, 3)} MN/m³ (F62 annexe F.3 § 4).`, { rel: 0.02 }),
          choixMelange(a, "Une semelle deux fois plus large sur le même sol aurait un module kv…", ["plus faible", "identique", "plus fort"],
            "kv = q/s et le tassement croît avec B : le module de réaction n'est pas une propriété du sol, il diminue quand la fondation s'élargit."),
        ],
      };
    },
  },
  {
    id: "ch9-schmertmann", titre: "Tassement d'une semelle filante sur sable (Schmertmann)", difficulte: 3,
    generer(a) {
      const B = a.entre(1.5, 3, 0.5), s0 = a.entre(15, 30, 1), sp = +(s0 + 19 * B).toFixed(0);
      const q = s0 + a.entre(100, 250, 5), h1 = +(a.entre(0.8, 1.6, 0.1) * B).toFixed(2), q1 = a.entre(2, 6, 0.5), q2 = a.entre(8, 20, 0.5);
      const r = schmertmann({ forme: "filante", B, q, sigmaV0: s0, sigmaVp: sp, t: 1, couches: [{ z0: 0, z1: h1, qc: q1 }, { z0: h1, z1: 8 * B, qc: q2 }] });
      return {
        enonce: `Semelle filante B = ${frd(B, 1)} m sur sable ; q' = ${fr(q, 3)} kPa, σ'v0 = ${fr(s0, 2)} kPa à la base, σ'vp = ${fr(sp, 3)} kPa au pic de Iz. Sous la base : ${frd(h1, 2)} m à qc = ${frd(q1, 1)} MPa, puis qc = ${frd(q2, 1)} MPa. Durée t = 1 an.`,
        donnees: [donnee("B", `${frd(B, 1)} m`), donnee("q' · σ'v0", `${fr(q, 3)} · ${fr(s0, 2)} kPa`), donnee("σ'vp", `${fr(sp, 3)} kPa`), donnee("qc", `${frd(q1, 1)} puis ${frd(q2, 1)} MPa`)],
        questions: [
          nombre("Izp ?", r.Izp, "", `Izp = 0,5 + 0,1 √[(q' − σ'v0)/σ'vp] = 0,5 + 0,1 √(${fr(q - s0, 3)}/${fr(sp, 3)}) = ${frd(r.Izp, 3)}.`, { rel: 0.005 }),
          nombre("C1 ?", r.C1, "", `C1 = 1 − 0,5 σ'v0/(q' − σ'v0) = ${frd(r.C1, 3)}.`, { rel: 0.005 }),
          nombre("Tassement s ?", r.s, "mm", `E = 3,5 qc (filante), C3 = 1,75, C2 = 1,2 (t = 1 an) ; s = C1 C2 (q' − σ'v0) Σ Iz Δz/(C3 E) = ${frd(r.s, 1)} mm.`, { rel: 0.03 }),
        ],
      };
    },
  },
  {
    id: "ch9-oedo", titre: "Consolidation d'une couche d'argile", difficulte: 2,
    generer(a) {
      const H = a.entre(2, 6, 0.5), e0 = a.entre(0.7, 1.4, 0.05), Cc = a.entre(0.15, 0.5, 0.01), Cs = +(Cc / a.entre(5, 8, 1)).toFixed(3);
      const s0 = a.entre(40, 120, 5), sp = s0 + a.entre(0, 60, 5), ds = a.entre(30, 150, 5);
      const r = tassementOedometrique({ H, e0, Cc, Cs, sigmaV0: s0, sigmaP: sp, dSigma: ds });
      const s1 = s0 + ds;
      return {
        enonce: `Couche d'argile de ${frd(H, 1)} m d'épaisseur : e0 = ${frd(e0, 2)}, Cc = ${frd(Cc, 2)}, Cs = ${frd(Cs, 3)}, σ'p = ${fr(sp, 3)} kPa. Au milieu de la couche, σ'v0 = ${fr(s0, 3)} kPa et la fondation ajoute Δσ'v = ${fr(ds, 3)} kPa. On traite la couche en une seule tranche.`,
        donnees: [donnee("H · e0", `${frd(H, 1)} m · ${frd(e0, 2)}`), donnee("Cc · Cs", `${frd(Cc, 2)} · ${frd(Cs, 3)}`), donnee("σ'v0 · σ'p", `${fr(s0, 3)} · ${fr(sp, 3)} kPa`), donnee("Δσ'v", `${fr(ds, 3)} kPa`)],
        questions: [
          nombre("Contrainte finale σ'vf ?", s1, "kPa", `σ'vf = σ'v0 + Δσ'v = ${fr(s1, 3)} kPa ${s1 > sp ? "> σ'p : on franchit la préconsolidation" : "≤ σ'p : on reste sur la branche de recompression"}.`, { rel: 0.005 }),
          nombre("Tassement de consolidation ?", r.s, "mm", s1 > sp
            ? `s = H/(1 + e0) [Cs lg(σ'p/σ'v0) + Cc lg(σ'vf/σ'p)] = ${frd(H, 1)}/${frd(1 + e0, 2)} × [${frd(Cs, 3)} × ${frd(Math.log10(sp / s0), 4)} + ${frd(Cc, 2)} × ${frd(Math.log10(s1 / sp), 4)}] = ${fr(r.s, 3)} mm.`
            : `s = H/(1 + e0) Cs lg(σ'vf/σ'v0) = ${frd(H, 1)}/${frd(1 + e0, 2)} × ${frd(Cs, 3)} × ${frd(Math.log10(s1 / s0), 4)} = ${fr(r.s, 3)} mm.`, { rel: 0.02 }),
        ],
      };
    },
  },
  {
    id: "ch9-giroud", titre: "Tassement élastique (abaques de Giroud)", difficulte: 1,
    generer(a) {
      const r = a.choix([1, 2, 3, 5]), B = a.entre(1, 3, 0.1), E = a.entre(10, 60, 5), nu = a.choix([0.3, 0.33, 0.35]), q = a.entre(80, 250, 10);
      const cf = coefficientCf({ forme: "rectangulaire", B, L: r * B, rigidite: "rigide" });
      const t = tassementElastique({ q, B, E, nu, cf });
      return {
        enonce: `Semelle rigide ${frd(B, 1)} m × ${frd(r * B, 1)} m sur un massif élastique homogène : E = ${fr(E, 2)} MPa, ν = ${frd(nu, 2)}, contrainte moyenne q = ${fr(q, 3)} kPa.`,
        donnees: [donnee("B · L/B", `${frd(B, 1)} m · ${r}`), donnee("E · ν", `${fr(E, 2)} MPa · ${frd(nu, 2)}`), donnee("q", `${fr(q, 3)} kPa`)],
        questions: [
          nombre("Coefficient cf (fondation rigide) ?", cf, "", `Tableau J.3.1 (Giroud) pour L/B = ${r} : cf = ${frd(cf, 2)}.`, { rel: 0.005 }),
          nombre("Tassement s ?", t.s, "mm", `s = (1 − ν²) q B cf / E = ${frd(1 - nu * nu, 4)} × ${fr(q, 3)} × ${frd(B, 1)} × ${frd(cf, 2)} / ${fr(E * 1000, 5)} = ${frd(t.s, 2)} mm.`, { rel: 0.01 }),
        ],
      };
    },
  },
];
