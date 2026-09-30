// Exercices du chapitre 6 : glissement et stabilité d'ensemble.
import { fr, frd, nombre, choixMelange, donnee } from "./alea.js";
import { glissementF62, glissementEC7, diagramme } from "../geotech/superficielles.js";

const RAD = Math.PI / 180;

export default [
  {
    id: "ch6-f62", titre: "Glissement au Fascicule 62", difficulte: 1,
    generer(a) {
      const B = a.entre(1.5, 3, 0.1), e = +(a.entre(0, 0.3, 0.01) * B).toFixed(2);
      const V = a.entre(200, 700, 10), H = +(V * a.entre(0.2, 0.55, 0.01)).toFixed(0);
      const phi = a.entier(24, 36), c = a.entre(0, 20, 5);
      const d = diagramme({ B, V, e });
      const r = glissementF62({ Vd: V, Hd: H, phi, c, Aprime: d.Bc });
      return {
        enonce: `Semelle filante B = ${frd(B, 1)} m, V = ${fr(V, 3)} kN/m excentrée de e = ${frd(e, 2)} m, H = ${fr(H, 3)} kN/m (ELU, combinaison la plus défavorable). Sol : φ' = ${phi}°, c' = ${fr(c, 2)} kPa.`,
        donnees: [donnee("B · e", `${frd(B, 1)} · ${frd(e, 2)} m`), donnee("Vd · Hd", `${fr(V, 3)} · ${fr(H, 3)} kN/m`), donnee("φ' · c'", `${phi}° · ${fr(c, 2)} kPa`)],
        questions: [
          nombre("Surface comprimée A' (par mètre) ?", d.Bc, "m²/m", d.trapeze ? `e ≤ B/6 : toute la semelle est comprimée, A' = ${frd(B, 2)} m²/m.` : `e > B/6 : A' = 3(B/2 − e) = ${frd(d.Bc, 3)} m²/m.`, { rel: 0.01 }),
          nombre("Résistance au glissement de calcul ?", r.R, "kN/m", `Vd tanφ'/1,2 + c'A'/1,5 = ${fr(V, 3)} × ${frd(Math.tan(phi * RAD), 3)} / 1,2 + ${fr(c, 2)} × ${frd(d.Bc, 3)} / 1,5 = ${fr(r.Rf, 4)} + ${fr(r.Rc, 3)} = ${fr(r.R, 4)} kN/m.`, { rel: 0.015 }),
          choixMelange(a, "Glissement vérifié ?", r.ok ? ["oui", "non"] : ["non", "oui"], `Hd = ${fr(H, 3)} kN/m ${r.ok ? "≤" : ">"} ${fr(r.R, 4)} kN/m (taux ${frd(r.taux, 2)}).`),
        ],
      };
    },
  },
  {
    id: "ch6-ec7-dr", titre: "Glissement drainé à la NF P94-261", difficulte: 1,
    generer(a) {
      const V = a.entre(200, 800, 10), H = +(V * a.entre(0.2, 0.5, 0.01)).toFixed(0);
      const phiC = a.entier(26, 34), prefa = a.choix([false, true]);
      const r = glissementEC7({ Vd: V, Hd: H, phiCrit: phiC, prefabrique: prefa });
      return {
        enonce: `Semelle ${prefa ? "préfabriquée à sous-face lisse" : "coulée en place"} ; Vd = ${fr(V, 3)} kN/m, Hd = ${fr(H, 3)} kN/m à l'ELU fondamental ; angle de frottement à l'état critique du sol φ'crit = ${phiC}°.`,
        donnees: [donnee("Vd · Hd", `${fr(V, 3)} · ${fr(H, 3)} kN/m`), donnee("φ'crit", `${phiC}°`), donnee("Semelle", prefa ? "préfabriquée lisse" : "coulée en place")],
        questions: [
          nombre("Angle de frottement d'interface δa;k ?", r.delta, "°", prefa ? `Préfabriquée lisse : δ = 2/3 φ'crit = ${frd(r.delta, 1)}°.` : `Coulée en place : δ = φ'crit = ${phiC}°.`, { rel: 0.005 }),
          nombre("Rh;d ?", r.Rhd, "kN/m", `Rh;d = Vd tanδ / (γR;h γR;d;h) = ${fr(V, 3)} × ${frd(Math.tan(r.delta * RAD), 3)} / (1,1 × 1,1) = ${fr(r.Rhd, 4)} kN/m.`, { rel: 0.01 }),
          choixMelange(a, "Glissement vérifié ?", r.ok ? ["oui", "non"] : ["non", "oui"], `Hd = ${fr(H, 3)} ${r.ok ? "≤" : ">"} ${fr(r.Rhd, 4)} kN/m (taux ${frd(r.taux, 2)}). La cohésion effective est négligée.`),
        ],
      };
    },
  },
  {
    id: "ch6-ec7-nd", titre: "Glissement à court terme sur une argile", difficulte: 2,
    generer(a) {
      const B = a.entre(1.5, 3, 0.1), e = +(a.entre(0, 0.2, 0.01) * B).toFixed(2), Ap = B - 2 * e;
      const cu = a.entre(20, 80, 5), V = a.entre(150, 500, 10), H = +(V * a.entre(0.15, 0.45, 0.01)).toFixed(0);
      const r = glissementEC7({ Vd: V, Hd: H, drainage: "non-draine", cu, Aprime: Ap });
      return {
        enonce: `Semelle filante B = ${frd(B, 1)} m sur argile saturée (cu = ${fr(cu, 2)} kPa), charge excentrée de e = ${frd(e, 2)} m. ELU : Vd = ${fr(V, 3)} kN/m, Hd = ${fr(H, 3)} kN/m.`,
        donnees: [donnee("B · e", `${frd(B, 1)} · ${frd(e, 2)} m`), donnee("cu", `${fr(cu, 2)} kPa`), donnee("Vd · Hd", `${fr(V, 3)} · ${fr(H, 3)} kN/m`)],
        questions: [
          nombre("Terme d'adhérence A' cu / (γR;h γR;d;h) ?", r.termeCohesion, "kN/m", `A' = B − 2e = ${frd(Ap, 2)} m²/m ; ${frd(Ap, 2)} × ${fr(cu, 2)} / 1,21 = ${fr(r.termeCohesion, 4)} kN/m.`, { rel: 0.01 }),
          nombre("Plafond 0,4 Vd ?", r.plafond, "kN/m", `0,4 × ${fr(V, 3)} = ${fr(r.plafond, 4)} kN/m.`, { rel: 0.005 }),
          nombre("Rh;d retenue ?", r.Rhd, "kN/m", `Le minimum des deux : ${fr(r.Rhd, 4)} kN/m${r.Rhd === r.plafond ? " — c'est le plafond qui gouverne" : ""}.`, { rel: 0.01 }),
          choixMelange(a, "Si la vérification échouait, que recommanderait le commentaire du Fascicule 62 ?",
            ["une disposition constructive (bêche, butons…)", "élargir la semelle jusqu'à ce que le calcul passe", "augmenter cu dans le calcul"],
            "F62 B.3.4 (commentaire) : un risque de glissement à court terme se traite de préférence par des dispositions constructives plutôt que par le dimensionnement de la fondation."),
        ],
      };
    },
  },
  {
    id: "ch6-vmin", titre: "Le bon V pour vérifier le glissement", difficulte: 2,
    generer(a) {
      const G = a.entre(200, 600, 10), Qv = a.entre(50, 250, 10), Qh = a.entre(40, 140, 5), phiC = a.entier(26, 32);
      const Vmin = G, Vmax = 1.35 * G + 1.5 * Qv, Hd = 1.5 * Qh;
      const rMin = glissementEC7({ Vd: Vmin, Hd, phiCrit: phiC }), rMax = glissementEC7({ Vd: Vmax, Hd, phiCrit: phiC });
      return {
        enonce: `Une semelle coulée en place reçoit G = ${fr(G, 3)} kN/m (poids propre compris), une charge d'exploitation verticale Qv = ${fr(Qv, 3)} kN/m et un effort variable horizontal Qh = ${fr(Qh, 3)} kN/m indépendant de Qv. Sol : φ'crit = ${phiC}°.`,
        donnees: [donnee("G", `${fr(G, 3)} kN/m`), donnee("Qv · Qh", `${fr(Qv, 3)} · ${fr(Qh, 3)} kN/m`), donnee("φ'crit", `${phiC}°`)],
        questions: [
          nombre("Hd à l'ELU ?", Hd, "kN/m", `Hd = 1,5 Qh = ${fr(Hd, 4)} kN/m.`, { rel: 0.005 }),
          nombre("Vd à associer à Hd pour le glissement ?", Vmin, "kN/m", `G est favorable (γG = 1,0) et Qv, favorable, est omise : Vd = ${fr(Vmin, 3)} kN/m.`, { rel: 0.005 }),
          nombre("Rh;d correspondante ?", rMin.Rhd, "kN/m", `${fr(Vmin, 3)} × tan${phiC}° / 1,21 = ${fr(rMin.Rhd, 4)} kN/m : taux ${frd(rMin.taux, 2)}.`, { rel: 0.01 }),
          nombre("Rh;d que l'on trouverait à tort avec 1,35 G + 1,5 Qv ?", rMax.Rhd, "kN/m", `Vd = ${fr(Vmax, 4)} kN/m donnerait ${fr(rMax.Rhd, 4)} kN/m, soit ${fr(100 * (rMax.Rhd / rMin.Rhd - 1), 2)} % de résistance fictive.`, { rel: 0.01 }),
        ],
      };
    },
  },
  {
    id: "ch6-stabilite", titre: "Paramètres de calcul pour la stabilité d'ensemble", difficulte: 1,
    generer(a) {
      const phi = a.entier(22, 36), c = a.entre(5, 30, 5), cu = a.entre(30, 100, 10);
      const t = Math.tan(phi * RAD);
      const pF = Math.atan(t / 1.2) / RAD, pE = Math.atan(t / 1.25) / RAD;
      return {
        enonce: `Talus sous une semelle : φ' = ${phi}°, c' = ${fr(c, 2)} kPa, et à court terme cu = ${fr(cu, 3)} kPa.`,
        donnees: [donnee("φ'", `${phi}°`), donnee("c'", `${fr(c, 2)} kPa`), donnee("cu", `${fr(cu, 3)} kPa`)],
        questions: [
          nombre("φd au Fascicule 62 (B.3.6) ?", pF, "°", `tanφd = tan${phi}°/1,20 = ${frd(t / 1.2, 4)} ⇒ φd = ${frd(pF, 2)}°.`, { rel: 0.005 }),
          nombre("φ'd en approche 3 (γφ' = 1,25) ?", pE, "°", `tanφ'd = tan${phi}°/1,25 = ${frd(t / 1.25, 4)} ⇒ φ'd = ${frd(pE, 2)}°.`, { rel: 0.005 }),
          nombre("cd au Fascicule 62 ?", c / 1.5, "kPa", `cd = c/1,50 = ${frd(c / 1.5, 2)} kPa (contre ${frd(c / 1.25, 2)} kPa en approche 3).`, { rel: 0.01 }),
          nombre("cu,d en approche 3 ?", cu / 1.4, "kPa", `cu,d = cu/1,4 = ${frd(cu / 1.4, 2)} kPa (contre cu/1,5 = ${frd(cu / 1.5, 2)} kPa au Fascicule 62).`, { rel: 0.01 }),
        ],
      };
    },
  },
];
