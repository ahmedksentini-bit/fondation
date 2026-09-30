// Exercices du chapitre 16 : sols compressibles, consolidation et remblais.
import { fr, frd, nombre, choixMelange, donnee } from "./alea.js";
import { tassementOedometrique } from "../geotech/tassements.js";
import {
  degreConsolidation, facteurTemps, consolidationAvecDrains, diametreInfluence, facteurDrain,
  compressionSecondaire, hauteurMiseEnOeuvre, asaoka,
} from "../geotech/consolidation.js";

const NC = Math.PI + 2;

export default [
  {
    id: "ch16-oedo", titre: "Tassement d'une argile sous un remblai large", difficulte: 2,
    generer(a) {
      const H = a.entre(4, 12, 0.5), ga = a.entre(15, 18, 0.5), e0 = a.entre(1, 2.5, 0.05), Cc = a.entre(0.3, 1.2, 0.01);
      const Cs = +(Cc / a.entre(6, 10, 1)).toFixed(3), pop = a.entre(10, 40, 5), hr = a.entre(2, 5, 0.5), gr = a.entre(19, 21, 0.5);
      const svp = ((ga - 10) * H) / 2, sp = svp + pop, q = gr * hr, svf = svp + q;
      const r = tassementOedometrique({ H, e0, Cc, Cs, sigmaV0: svp, sigmaP: sp, dSigma: q });
      return {
        enonce: `Un remblai de ${frd(hr, 1)} m (γ = ${frd(gr, 1)} kN/m³), très large devant l'épaisseur compressible, est construit sur ${frd(H, 1)} m d'argile molle saturée (γ = ${frd(ga, 1)} kN/m³, nappe au terrain naturel, γw = 10 kN/m³) : e0 = ${frd(e0, 2)}, Cc = ${frd(Cc, 2)}, Cs = ${frd(Cs, 3)}, σ'p = σ'v0 + ${fr(pop, 2)} kPa. On traite la couche en une seule tranche, repérée à mi-épaisseur.`,
        donnees: [donnee("Remblai", `${frd(hr, 1)} m · γ = ${frd(gr, 1)} kN/m³`), donnee("Argile", `${frd(H, 1)} m · γ = ${frd(ga, 1)} kN/m³`), donnee("e0 · Cc · Cs", `${frd(e0, 2)} · ${frd(Cc, 2)} · ${frd(Cs, 3)}`), donnee("POP", `${fr(pop, 2)} kPa`)],
        questions: [
          nombre("σ'v0 au milieu de la couche ?", svp, "kPa", `σ'v0 = (γ − γw) H/2 = ${frd(ga - 10, 1)} × ${frd(H / 2, 2)} = ${fr(svp, 3)} kPa ; σ'p = ${fr(sp, 3)} kPa.`, { rel: 0.01 }),
          nombre("Supplément de contrainte Δσ ?", q, "kPa", `Remblai large : Δσ = γ h = ${frd(gr, 1)} × ${frd(hr, 1)} = ${fr(q, 3)} kPa dans toute la couche.`, { rel: 0.01 }),
          nombre("Tassement de consolidation ?", r.s, "mm", svf > sp
            ? `σ'vf = ${fr(svf, 3)} kPa > σ'p : s = H/(1 + e0) [Cs lg(σ'p/σ'v0) + Cc lg(σ'vf/σ'p)] = ${frd(H, 1)}/${frd(1 + e0, 2)} × [${frd(Cs, 3)} × ${frd(Math.log10(sp / svp), 4)} + ${frd(Cc, 2)} × ${frd(Math.log10(svf / sp), 4)}] = ${fr(r.s, 3)} mm.`
            : `σ'vf = ${fr(svf, 3)} kPa ≤ σ'p : s = H Cs/(1 + e0) lg(σ'vf/σ'v0) = ${fr(r.s, 3)} mm — la charge ne dépasse pas la préconsolidation.`, { rel: 0.02 }),
          choixMelange(a, "Découpée en tranches plus fines, la couche tasserait…", ["davantage", "autant", "moins"],
            "Les tranches du haut, peu contraintes au départ, ont un rapport σ'vf/σ'v0 plus grand : une seule tranche sous-estime le tassement d'une couche épaisse."),
        ],
      };
    },
  },
  {
    id: "ch16-temps", titre: "Durée de la consolidation", difficulte: 1,
    generer(a) {
      const H = a.entre(4, 16, 1), cv = a.entre(0.5, 4, 0.1), double = a.choix([true, false]);
      const Hd = double ? H / 2 : H, t50 = (facteurTemps(0.5) * Hd * Hd) / cv, t90 = (facteurTemps(0.9) * Hd * Hd) / cv;
      const t90b = double ? 4 * t90 : t90 / 4;
      return {
        enonce: `Une couche d'argile de ${fr(H, 2)} m est drainée ${double ? "par un sable au-dessus et au-dessous" : "par le haut seulement (substratum imperméable)"} ; cv = ${frd(cv, 1)} m²/an.`,
        donnees: [donnee("H", `${fr(H, 2)} m`), donnee("Drainage", double ? "double" : "simple"), donnee("cv", `${frd(cv, 1)} m²/an`)],
        questions: [
          nombre("Longueur de drainage Hd ?", Hd, "m", double ? `Drainage double : Hd = H/2 = ${frd(Hd, 1)} m.` : `Drainage simple : Hd = H = ${frd(Hd, 1)} m.`, { rel: 0.005 }),
          nombre("Temps t50 ?", t50, "ans", `t50 = 0,197 Hd²/cv = 0,197 × ${frd(Hd * Hd, 2)}/${frd(cv, 1)} = ${frd(t50, 2)} ans.`, { rel: 0.02 }),
          nombre("Temps t90 ?", t90, "ans", `t90 = 0,848 Hd²/cv = ${frd(t90, 2)} ans.`, { rel: 0.02 }),
          nombre(`Et si la couche était drainée ${double ? "d'un seul côté" : "des deux côtés"} ?`, t90b, "ans", `Hd ${double ? "double" : "est divisé par deux"} : le temps ${double ? "est multiplié" : "est divisé"} par quatre, t90 = ${frd(t90b, 2)} ans.`, { rel: 0.02 }),
        ],
      };
    },
  },
  {
    id: "ch16-degre", titre: "Tassement au bout de quelques années", difficulte: 2,
    generer(a) {
      const H = a.entre(6, 14, 1), cv = a.entre(0.5, 3, 0.1), sc = a.entre(300, 1200, 10), t = a.choix([0.5, 1, 2, 3, 5]);
      const Hd = H / 2, Tv = (cv * t) / (Hd * Hd), U = degreConsolidation(Tv);
      return {
        enonce: `Sous un remblai, ${fr(H, 2)} m d'argile drainée des deux côtés doivent tasser de sc = ${fr(sc, 4)} mm en fin de consolidation primaire ; cv = ${frd(cv, 1)} m²/an. On suppose le remblai mis en place d'un coup.`,
        donnees: [donnee("H · Hd", `${fr(H, 2)} m · ${frd(Hd, 1)} m`), donnee("cv", `${frd(cv, 1)} m²/an`), donnee("sc", `${fr(sc, 4)} mm`), donnee("t", `${frd(t, 1)} an${t >= 2 ? "s" : ""}`)],
        questions: [
          nombre("Facteur temps Tv ?", Tv, "", `Tv = cv t/Hd² = ${frd(cv, 1)} × ${frd(t, 1)}/${frd(Hd * Hd, 2)} = ${frd(Tv, 4)}.`, { rel: 0.01 }),
          nombre("Degré de consolidation U ?", 100 * U, "%", U < 0.6 ? `U < 60 % : U ≈ 2 √(Tv/π) = ${frd(100 * U, 1)} %.` : `Série de Terzaghi (ou table) : U = ${frd(100 * U, 1)} %.`, { abs: 1.5 }),
          nombre("Tassement atteint à t ?", sc * U, "mm", `s = U sc = ${frd(U, 3)} × ${fr(sc, 4)} = ${fr(sc * U, 3)} mm.`, { rel: 0.03 }),
        ],
      };
    },
  },
  {
    id: "ch16-fluage", titre: "Fluage d'une argile organique", difficulte: 2,
    generer(a) {
      const H = a.entre(3, 10, 0.5), e0 = a.entre(1.5, 3.5, 0.1), Cc = a.entre(0.6, 1.8, 0.05), ratio = a.choix([0.04, 0.05, 0.06]);
      const tp = a.choix([1, 2, 3, 5]), t1 = a.choix([20, 30, 50]), Ca = Cc * ratio;
      const s1 = compressionSecondaire({ H, e0, Calpha: Ca, tp, t: t1 }), dec = ((H * Ca) / (1 + e0)) * 1000;
      return {
        enonce: `Une couche d'argile organique de ${frd(H, 1)} m (e0 = ${frd(e0, 1)}, Cc = ${frd(Cc, 2)}) achève sa consolidation primaire au bout de tp = ${tp} an${tp > 1 ? "s" : ""}. On admet Cαe/Cc = ${frd(ratio, 2)} (Mesri).`,
        donnees: [donnee("H · e0", `${frd(H, 1)} m · ${frd(e0, 1)}`), donnee("Cc", frd(Cc, 2)), donnee("Cαe/Cc", frd(ratio, 2)), donnee("tp", `${tp} an${tp > 1 ? "s" : ""}`)],
        questions: [
          nombre("Indice de fluage Cαe ?", Ca, "", `Cαe = ${frd(ratio, 2)} × ${frd(Cc, 2)} = ${frd(Ca, 4)}.`, { rel: 0.01 }),
          nombre("Fluage par décade de temps ?", dec, "mm", `H Cαe/(1 + e0) = ${frd(H, 1)} × ${frd(Ca, 4)}/${frd(1 + e0, 1)} = ${fr(dec, 3)} mm par décade.`, { rel: 0.01 }),
          nombre(`Fluage entre tp et ${t1} ans ?`, s1, "mm", `sf = H Cαe/(1 + e0) lg(t/tp) = ${fr(dec, 3)} × lg(${t1}/${tp}) = ${fr(s1, 3)} mm.`, { rel: 0.02 }),
        ],
      };
    },
  },
  {
    id: "ch16-drains", titre: "Drains verticaux en maille triangulaire", difficulte: 3,
    generer(a) {
      const esp = a.entre(1, 2.5, 0.1), ch = a.entre(1, 5, 0.5), cv = +(ch / a.choix([1, 1.5, 2])).toFixed(2), H = a.entre(8, 20, 1), t = a.choix([0.25, 0.5, 1]);
      const dw = 0.066, De = diametreInfluence(esp, "triangle"), n = De / dw, F = facteurDrain({ n });
      const r = consolidationAvecDrains({ cv, ch, Hd: H / 2, t, espacement: esp, maille: "triangle", dw });
      return {
        enonce: `Des drains en bande (dw = 66 mm) sont foncés en maille triangulaire d'espacement s = ${frd(esp, 1)} m dans ${fr(H, 2)} m d'argile drainée des deux côtés : cv = ${frd(cv, 2)} m²/an, ch = ${frd(ch, 1)} m²/an. On néglige le remaniement. Que vaut la consolidation au bout de ${fr(t * 12, 2)} mois ?`,
        donnees: [donnee("s · maille", `${frd(esp, 1)} m · triangulaire`), donnee("dw", "66 mm"), donnee("cv · ch", `${frd(cv, 2)} · ${frd(ch, 1)} m²/an`), donnee("H · t", `${fr(H, 2)} m · ${fr(t * 12, 2)} mois`)],
        questions: [
          nombre("Diamètre d'influence De ?", De, "m", `De = 1,05 s = ${frd(De, 3)} m.`, { rel: 0.01 }),
          nombre("Facteur F = ln n − 0,75 ?", F, "", `n = De/dw = ${frd(n, 1)} ; F = ln ${frd(n, 1)} − 0,75 = ${frd(F, 3)}.`, { rel: 0.01 }),
          nombre("Degré de consolidation radiale Uh ?", 100 * r.Uh, "%", `Th = ch t/De² = ${frd(r.Th, 4)} ; Uh = 1 − exp(−8 Th/F) = ${frd(100 * r.Uh, 1)} %.`, { abs: 1.5 }),
          nombre("Degré combiné U ?", 100 * r.U, "%", `Uv = ${frd(100 * r.Uv, 1)} % (Tv = ${frd(r.Tv, 4)}) ; 1 − U = (1 − Uv)(1 − Uh) ⇒ U = ${frd(100 * r.U, 1)} %.`, { abs: 1.5 }),
        ],
      };
    },
  },
  {
    id: "ch16-etapes", titre: "Hauteur admissible et construction par étapes", difficulte: 2,
    generer(a) {
      const cu0 = a.entre(10, 25, 1), g = a.entre(18, 21, 0.5), F = a.choix([1.3, 1.4, 1.5]), lam = a.choix([0.2, 0.25, 0.3]), U = a.choix([0.6, 0.7, 0.8]);
      const H1 = (NC * cu0) / (g * F), cu1 = cu0 + lam * U * g * H1, H2 = (NC * cu1) / (g * F), k = (NC * lam * U) / F, Hinf = H1 / (1 - k);
      return {
        enonce: `Un remblai large (γ = ${frd(g, 1)} kN/m³) est construit sur une argile molle épaisse de cohésion non drainée cu = ${fr(cu0, 2)} kPa. On vise F = ${frd(F, 1)} vis-à-vis du poinçonnement, Hmax = (π + 2) cu/(γ F). Entre deux étapes, on attend U = ${fr(100 * U, 2)} %, et Δcu = ${frd(lam, 2)} U Δσ'v avec Δσ'v ≈ γ H.`,
        donnees: [donnee("cu", `${fr(cu0, 2)} kPa`), donnee("γ · F", `${frd(g, 1)} kN/m³ · ${frd(F, 1)}`), donnee("λcu · U", `${frd(lam, 2)} · ${fr(100 * U, 2)} %`)],
        questions: [
          nombre("Hauteur de la première étape H1 ?", H1, "m", `H1 = (π + 2) × ${fr(cu0, 2)}/(${frd(g, 1)} × ${frd(F, 1)}) = ${frd(H1, 2)} m.`, { rel: 0.01 }),
          nombre("Cohésion après consolidation sous H1 ?", cu1, "kPa", `cu = ${fr(cu0, 2)} + ${frd(lam, 2)} × ${frd(U, 2)} × ${frd(g, 1)} × ${frd(H1, 2)} = ${frd(cu1, 1)} kPa.`, { rel: 0.01 }),
          nombre("Hauteur atteinte à la deuxième étape H2 ?", H2, "m", `H2 = (π + 2) × ${frd(cu1, 1)}/(${frd(g, 1)} × ${frd(F, 1)}) = ${frd(H2, 2)} m.`, { rel: 0.01 }),
          nombre("Hauteur limite H∞ des étapes successives ?", Hinf, "m", `k = (π + 2) λcu U/F = ${frd(k, 3)} ; H∞ = H1/(1 − k) = ${frd(Hinf, 2)} m : plus haut, il faut des banquettes, un renforcement ou un remblai allégé.`, { rel: 0.015 }),
        ],
      };
    },
  },
  {
    id: "ch16-asaoka", titre: "Tassement final par la méthode d'Asaoka", difficulte: 2,
    generer(a) {
      const sInf = a.entre(400, 1200, 10), b1 = a.entre(0.7, 0.9, 0.01), s0 = Math.round(sInf * a.entre(0.3, 0.6, 0.01)), dt = a.choix([15, 30, 60]);
      const lect = Array.from({ length: 6 }, (_, i) => Math.round(sInf - (sInf - s0) * b1 ** i));
      const r = asaoka(lect.map((s, i) => [i * dt, s]));
      const reste = r.sInf - lect.at(-1);
      return {
        enonce: `Après la fin de la construction d'un remblai, un tassomètre a donné, tous les ${dt} jours : ${lect.map((s) => fr(s, 4)).join(" ; ")} mm.`,
        donnees: [donnee("Pas de lecture", `${dt} jours`), donnee("Lectures", `${lect.map((s) => fr(s, 4)).join(" · ")} mm`)],
        questions: [
          nombre("Pente β1 de la droite s(i) = β0 + β1 s(i−1) ?", r.beta1, "", `Régression sur les couples (s(i−1), s(i)) ; ici les accroissements successifs décroissent dans le rapport ≈ ${frd(r.beta1, 3)}.`, { rel: 0.02 }),
          nombre("Tassement final s∞ = β0/(1 − β1) ?", r.sInf, "mm", `β0 = ${fr(r.beta0, 4)} mm ; s∞ = ${fr(r.beta0, 4)}/(1 − ${frd(r.beta1, 3)}) = ${fr(r.sInf, 4)} mm.`, { rel: 0.02 }),
          nombre("Tassement restant après la dernière lecture ?", reste, "mm", `${fr(r.sInf, 4)} − ${fr(lect.at(-1), 4)} = ${fr(reste, 3)} mm.`, { rel: 0.05, abs: null }),
        ],
      };
    },
  },
  {
    id: "ch16-surcharge", titre: "Quand retirer une surcharge temporaire ?", difficulte: 3,
    generer(a) {
      const qf = a.entre(40, 80, 5), qs = a.entre(20, 50, 5), H = a.entre(6, 12, 1), cv = a.entre(0.8, 3, 0.1);
      const Hd = H / 2, U = qf / (qf + qs), ts = (facteurTemps(U) * Hd * Hd) / cv, t90 = (facteurTemps(0.9) * Hd * Hd) / cv;
      return {
        enonce: `L'ouvrage appliquera qf = ${fr(qf, 2)} kPa sur ${fr(H, 2)} m d'argile drainée des deux côtés (cv = ${frd(cv, 1)} m²/an). Pour accélérer, on ajoute une surcharge temporaire qs = ${fr(qs, 2)} kPa, retirée quand le tassement atteint le tassement final sous qf seule. On admet, pour simplifier, que le tassement final est proportionnel à la charge.`,
        donnees: [donnee("qf · qs", `${fr(qf, 2)} · ${fr(qs, 2)} kPa`), donnee("H · cv", `${fr(H, 2)} m · ${frd(cv, 1)} m²/an`)],
        questions: [
          nombre("Degré de consolidation à atteindre sous qf + qs ?", 100 * U, "%", `U (qf + qs) = qf ⇒ U = qf/(qf + qs) = ${frd(100 * U, 1)} %.`, { abs: 1 }),
          nombre("Temps de retrait de la surcharge ts ?", ts, "ans", `Tv(U = ${frd(100 * U, 1)} %) = ${frd(facteurTemps(U), 3)} ; ts = Tv Hd²/cv = ${frd(ts, 2)} ans.`, { rel: 0.03 }),
          nombre("Pour comparaison : t90 sans surcharge ?", t90, "ans", `t90 = 0,848 × ${frd(Hd * Hd, 2)}/${frd(cv, 1)} = ${frd(t90, 2)} ans — la surcharge fait gagner ${frd(t90 - ts, 1)} ans.`, { rel: 0.02 }),
        ],
      };
    },
  },
  {
    id: "ch16-mise", titre: "Hauteur de remblai à mettre en œuvre", difficulte: 3,
    generer(a) {
      const Hf = a.entre(2, 4, 0.1), g = a.entre(19, 21, 0.5), s0 = a.entre(0.3, 0.9, 0.05), c = s0 / (g * Hf);
      const avec = hauteurMiseEnOeuvre({ Hfinale: Hf, gamma: g, zw: 0, tassement: (_, q) => c * q });
      const sans = hauteurMiseEnOeuvre({ Hfinale: Hf, gamma: g, immersion: false, tassement: (_, q) => c * q });
      return {
        enonce: `On veut une plateforme à ${frd(Hf, 1)} m au-dessus du terrain naturel, sur une argile molle dont la nappe affleure. Un calcul œdométrique donne un tassement final de ${frd(s0, 2)} m sous la charge γ Hf (γ = ${frd(g, 1)} kN/m³) ; on admet le tassement proportionnel à la charge. La part du remblai enfoncée sous la nappe est déjaugée (γw = 10 kN/m³).`,
        donnees: [donnee("Hf · γ", `${frd(Hf, 1)} m · ${frd(g, 1)} kN/m³`), donnee("Tassement sous γ Hf", `${frd(s0, 2)} m`), donnee("Nappe", "au terrain naturel")],
        questions: [
          nombre("Tassement final s ?", avec.s, "m", `s = c (γ (Hf + s) − γw s), c = ${frd(s0, 2)}/(${frd(g, 1)} × ${frd(Hf, 1)}) m/kPa ⇒ s = c γ Hf/(1 − c (γ − γw)) = ${frd(avec.s, 3)} m.`, { rel: 0.01 }),
          nombre("Hauteur à mettre en œuvre H ?", avec.H, "m", `H = Hf + s = ${frd(Hf, 1)} + ${frd(avec.s, 3)} = ${frd(avec.H, 2)} m.`, { rel: 0.01 }),
          nombre("Et si la nappe était profonde (pas de déjaugeage) ?", sans.H, "m", `s = c γ Hf/(1 − c γ) = ${frd(sans.s, 3)} m ⇒ H = ${frd(sans.H, 2)} m : le déjaugeage économise ${fr(100 * (sans.H - avec.H), 3)} cm de remblai.`, { rel: 0.01 }),
        ],
      };
    },
  },
];
