// Exercices du chapitre 3 : dépouillement de l'essai pressiométrique.
import { fr, frd, nombre, choixMelange, donnee, FRACTIONS, fraction } from "./alea.js";
import * as P from "../geotech/pressio.js";
import { alphaMenard, ALPHA_MENARD } from "../geotech/sols.js";
import { graphe, COULEURS } from "../figures.js";

export default [
  {
    id: "ch3-corrections", titre: "Corriger un palier : ph, pe et dilatation", difficulte: 1,
    generer(a) {
      const z = a.entre(2, 20, 0.5), hc = a.entre(0.5, 1.2, 0.1), pr = a.entre(0.3, 2.5, 0.05), Vr = a.entre(150, 450, 1);
      const aa = a.entre(2, 6, 0.1), pe = a.entre(0.02, 0.12, 0.005);
      const ph = P.pressionHydrostatique(z, hc);
      const V = Vr - aa * pr, p = pr + ph - pe;
      return {
        enonce: `Palier d'un essai à ${frd(z, 1)} m, le manomètre du CPV étant à ${frd(hc, 1)} m au-dessus du sol : pression lue ${frd(pr, 2)} MPa, volume à 60 s ${fr(Vr, 3)} cm³. Le coefficient de dilatation vaut a = ${frd(aa, 1)} cm³/MPa, et l'étalonnage à l'air donne pe = ${frd(pe, 3)} MPa au volume corrigé du palier (γw = 9,81 kN/m³).`,
        donnees: [donnee("z · hc", `${frd(z, 1)} · ${frd(hc, 1)} m`), donnee("pr", `${frd(pr, 2)} MPa`), donnee("Vr", `${fr(Vr, 3)} cm³`), donnee("a", `${frd(aa, 1)} cm³/MPa`), donnee("pe(V)", `${frd(pe, 3)} MPa`)],
        questions: [
          nombre("Pression hydrostatique ph (MPa) ?", ph, "MPa", `ph = γw (hc + z) = 9,81 × ${frd(hc + z, 1)} / 1000 = ${frd(ph, 4)} MPa. La nappe n'y joue aucun rôle.`, { rel: 0.01 }),
          nombre("Volume corrigé V ?", V, "cm³", `V = Vr − a·pr = ${fr(Vr, 3)} − ${frd(aa, 1)} × ${frd(pr, 2)} = ${frd(V, 1)} cm³.`, { rel: 0.005 }),
          nombre("Pression corrigée p ?", p, "MPa", `p = pr + ph − pe = ${frd(pr, 2)} + ${frd(ph, 4)} − ${frd(pe, 3)} = ${frd(p, 4)} MPa.`, { rel: 0.01 }),
        ],
      };
    },
  },
  {
    id: "ch3-tube", titre: "Étalonnage en tube : a, Vc et Vs", difficulte: 2,
    generer(a) {
      const aa = a.entre(2, 6, 0.1), Vc = a.entre(150, 200, 1), di = a.choix([63, 66]), ls = a.choix([200, 210]);
      const pts = [1, 2, 3, 4].map((p) => ({ p, V: +(Vc + aa * p + (a.reel() - 0.5) * 0.4).toFixed(1) }));
      const r = P.calibrageAppareil(pts, { pmin: 1, di, ls });
      return {
        enonce: `Gonflée dans un tube d'acier de ${di} mm de diamètre intérieur, une sonde dont la cellule centrale mesure ${ls} mm donne, une fois plaquée contre le tube : ${pts.map((q) => `${q.V} cm³ sous ${q.p} MPa`).join(", ")}.`,
        donnees: pts.map((q) => donnee(`p = ${q.p} MPa`, `V = ${q.V} cm³`)),
        questions: [
          nombre("Coefficient de dilatation a (pente de la droite) ?", r.a, "cm³/MPa", `Droite des moindres carrés V = Vc + a·p : a = ${frd(r.a, 3)} cm³/MPa (sous 6 cm³/MPa : tubulures acceptables).`, { rel: 0.03 }),
          nombre("Ordonnée à l'origine Vc ?", r.Vc, "cm³", `Vc = ${frd(r.Vc, 2)} cm³ : le volume injecté pour atteindre le tube.`, { rel: 0.01 }),
          nombre("Volume de la cellule au repos Vs = π di² ls/4 − Vc ?", r.Vs, "cm³", `π × ${frd(di / 10, 1)}² × ${frd(ls / 10, 1)}/4 = ${frd(r.Vtube, 1)} cm³ ; Vs = ${frd(r.Vtube, 1)} − ${frd(r.Vc, 1)} = ${frd(r.Vs, 1)} cm³.`, { rel: 0.01 }),
        ],
      };
    },
  },
  {
    id: "ch3-em", titre: "Module pressiométrique EM", difficulte: 1,
    generer(a) {
      const Vs = a.choix([535, 538, 555, 593]), p1 = a.entre(0.1, 0.6, 0.01), V1 = a.entre(110, 180, 1);
      const EMvise = a.entre(3, 60, 0.5), dp = a.entre(0.3, 2, 0.01);
      const dV = (2.66 * (Vs + V1) * dp) / (EMvise - (2.66 * dp) / 2);
      const p2 = +(p1 + dp).toFixed(3), V2 = Math.round(V1 + dV);
      const r = P.moduleMenard({ Vs, p1, V1, p2, V2 });
      return {
        enonce: `Sur la courbe corrigée d'un essai (Vs = ${Vs} cm³), la phase pseudo-élastique va de (p1 = ${frd(p1, 2)} MPa ; V1 = ${V1} cm³) à (p2 = ${frd(p2, 3)} MPa ; V2 = ${V2} cm³).`,
        donnees: [donnee("Vs", `${Vs} cm³`), donnee("p1 · V1", `${frd(p1, 2)} MPa · ${V1} cm³`), donnee("p2 · V2", `${frd(p2, 3)} MPa · ${V2} cm³`)],
        questions: [
          nombre("Volume moyen Vm ?", r.Vm, "cm³", `Vm = (V1 + V2)/2 = ${frd(r.Vm, 1)} cm³.`, { rel: 0.005 }),
          nombre("Module pressiométrique EM (ν = 0,33) ?", r.EM, "MPa", `EM = 2,66 (Vs + Vm) Δp/ΔV = 2,66 × ${frd(Vs + r.Vm, 1)} × ${frd(p2 - p1, 3)}/${V2 - V1} = ${frd(r.EM, 2)} MPa.`, { rel: 0.02 }),
        ],
      };
    },
  },
  {
    id: "ch3-pl-lue", titre: "Pression limite lue sur la courbe", difficulte: 1,
    generer(a) {
      const Vs = a.choix([535, 538, 555]), V1 = a.entre(110, 170, 1), Vl = Vs + 2 * V1;
      const pa = a.entre(0.4, 3, 0.01), pb = +(pa + a.entre(0.03, 0.2, 0.01)).toFixed(3);
      const Va = Math.round(Vl - a.entre(20, 90, 1)), Vb = Math.round(Vl + a.entre(15, 90, 1));
      const pl = pa + ((pb - pa) * (Vl - Va)) / (Vb - Va);
      return {
        enonce: `Essai avec Vs = ${Vs} cm³ et V1 = ${V1} cm³ au début de la phase pseudo-élastique. Deux paliers corrigés encadrent la fin de l'essai : (${frd(pa, 3)} MPa ; ${Va} cm³) puis (${frd(pb, 3)} MPa ; ${Vb} cm³).`,
        donnees: [donnee("Vs · V1", `${Vs} · ${V1} cm³`), donnee("palier n", `${frd(pa, 3)} MPa · ${Va} cm³`), donnee("palier n + 1", `${frd(pb, 3)} MPa · ${Vb} cm³`)],
        questions: [
          nombre("Volume conventionnel Vl ?", Vl, "cm³", `Vl = Vs + 2V1 = ${Vs} + 2 × ${V1} = ${Vl} cm³ : la cavité a doublé de volume depuis le contact.`, { rel: 0.002 }),
          nombre("Pression limite pl (interpolation linéaire) ?", pl, "MPa", `pl = ${frd(pa, 3)} + (${frd(pb, 3)} − ${frd(pa, 3)}) × (${Vl} − ${Va})/(${Vb} − ${Va}) = ${frd(pl, 3)} MPa.`, { rel: 0.01 }),
        ],
      };
    },
  },
  {
    id: "ch3-pl-inverse", titre: "Pression limite extrapolée par l'inverse du volume", difficulte: 3,
    generer(a) {
      const Vs = 535, V1 = a.entre(120, 160, 1), Vl = Vs + 2 * V1;
      const pinf = a.entre(0.6, 4, 0.05), A = -1 / (pinf * a.entre(420, 600, 10));
      const B = -A * pinf;
      const ps = [0.78, 0.84, 0.9].map((x) => +(x * pinf).toFixed(3));
      const pts = ps.map((p) => ({ p, V: Math.round(1 / (B + A * p)) }));
      const r = P.extrapolationInverse(pts, Vl);
      const Afit = r.A, Bfit = r.B;
      return {
        enonce: `L'essai (Vs = ${Vs} cm³, V1 = ${V1} cm³) s'est arrêté avant d'atteindre Vl. Ses trois derniers paliers corrigés, au-delà de pf, sont : ${pts.map((q) => `(${frd(q.p, 3)} MPa ; ${q.V} cm³)`).join(", ")}.`,
        donnees: pts.map((q, i) => donnee(`palier ${i + 1}`, `${frd(q.p, 3)} MPa · ${q.V} cm³`)),
        questions: [
          nombre("Volume conventionnel Vl ?", Vl, "cm³", `Vl = ${Vs} + 2 × ${V1} = ${Vl} cm³.`, { rel: 0.002 }),
          nombre("Pente A de la droite 1/V = A·p + B (en cm⁻³/MPa) ?", Afit, "cm⁻³/MPa", `Régression de 1/V sur p : A = ${fr(Afit, 4)}, B = ${fr(Bfit, 4)}.`, { rel: 0.05 }),
          nombre("Pression limite extrapolée pl ?", r.pl, "MPa", `pl = (1/Vl − B)/A = (${fr(1 / Vl, 4)} − ${fr(Bfit, 4)}) / ${fr(Afit, 4)} = ${frd(r.pl, 3)} MPa ; la droite coupe 1/V = 0 à ${frd(r.pInfini, 3)} MPa, pression limite théorique.`, { rel: 0.02 }),
        ],
      };
    },
  },
  {
    id: "ch3-nettes", titre: "Pressions nettes et état du sol", difficulte: 2,
    generer(a) {
      const nature = a.choix(["argile", "limon", "sable"]);
      const z = a.entre(3, 18, 0.5), zw = a.entre(0.5, 5, 0.5), g = a.entre(17, 20, 0.5), gs = +(g + a.entre(0.5, 1.5, 0.5)).toFixed(1);
      const pl = a.entre(0.4, 3.5, 0.05), pf = +(pl * a.entre(0.5, 0.7, 0.01)).toFixed(3), EM = +(pl * a.entre(6, 20, 0.5)).toFixed(1);
      const c = P.contraintesEssai({ z, zw, gamma: g, gammaSat: gs });
      const p0 = P.pressionRepos({ sigmaVeff: c.sigmaVeff, u: c.u, K0: 0.5 });
      const pln = pl - p0, pfn = pf - p0, al = alphaMenard(nature, EM, pln);
      const etats = [...new Set(["sous-consolidé, altéré, remanié", "normalement consolidé", "surconsolidé", "lâche", "normalement serré", "très serré", al.etat])];
      return {
        enonce: `Essai dans un ${nature} à ${frd(z, 1)} m (γ = ${frd(g, 1)} kN/m³ au-dessus de la nappe, située à ${frd(zw, 1)} m ; γsat = ${frd(gs, 1)} kN/m³ dessous ; γw = 9,81 kN/m³ ; K0 = 0,5) : EM = ${frd(EM, 1)} MPa, pf = ${frd(pf, 3)} MPa, pl = ${frd(pl, 2)} MPa.`,
        donnees: [donnee("z · nappe", `${frd(z, 1)} · ${frd(zw, 1)} m`), donnee("EM", `${frd(EM, 1)} MPa`), donnee("pf · pl", `${frd(pf, 3)} · ${frd(pl, 2)} MPa`)],
        questions: [
          nombre("p0 = K0 σ'v0 + u0 (kPa) ?", 1000 * p0, "kPa", `σv0 = ${fr(c.sigmaV, 4)} kPa, u0 = ${fr(c.u, 3)} kPa, σ'v0 = ${fr(c.sigmaVeff, 4)} kPa ; p0 = 0,5 × ${fr(c.sigmaVeff, 4)} + ${fr(c.u, 3)} = ${fr(1000 * p0, 4)} kPa.`, { rel: 0.02 }),
          nombre("pl* ?", pln, "MPa", `pl* = pl − p0 = ${frd(pl, 2)} − ${frd(p0, 3)} = ${frd(pln, 3)} MPa.`, { rel: 0.015 }),
          nombre("pf* ?", pfn, "MPa", `pf* = pf − p0 = ${frd(pfn, 3)} MPa.`, { rel: 0.02 }),
          choixMelange(a, `État du ${nature} d'après EM/pl* ?`, [al.etat, ...a.tirage(etats.filter((e) => e !== al.etat), 3)],
            `EM/pl* = ${frd(al.rapport, 1)} : ${al.etat}, α = ${frd(al.alpha, 2)}. Un rapport bas peut aussi trahir un forage remanié.`),
        ],
      };
    },
  },
  {
    id: "ch3-fluage", titre: "Pression de fluage sur la courbe de fluage", difficulte: 2,
    generer(a) {
      const pf = a.entre(0.4, 2.5, 0.01), f0 = a.entre(1.5, 3.5, 0.1), pente = a.entre(8, 30, 1) / pf;
      const pas = +(pf / 4).toFixed(3);
      const pts = [1, 2, 3, 5, 6, 7].map((k) => {
        const p = +(k * pas * 1.05).toFixed(3);
        return { p, fluage: +(p <= pf ? f0 + (a.reel() - 0.5) * 0.2 : f0 + pente * (p - pf)).toFixed(1) };
      });
      const plateau = pts.filter((q) => q.p <= pf), montee = pts.filter((q) => q.p > pf);
      const phase = { i1: 0, i2: plateau.length - 1, p1: plateau[0].p, p2: plateau[plateau.length - 1].p };
      const courbe = pts.map((q, i) => ({ ...q, n: i + 1 }));
      const r = P.pressionFluage(courbe, phase, { nMontee: montee.length });
      const fig = graphe({
        largeur: 520, hauteur: 220, xmin: 0, xmax: pts[pts.length - 1].p * 1.08, ymin: 0, ymax: Math.max(...pts.map((q) => q.fluage)) * 1.2,
        xlabel: "pression corrigée p (MPa)", ylabel: "ΔV60/30 (cm³)", legende: false,
        series: [{ points: pts.map((q) => [q.p, q.fluage]), couleur: COULEURS.violet, marqueurs: true }],
      });
      return {
        enonce: `Les paliers d'un essai donnent la courbe de fluage ci-dessous : ${pts.map((q) => `${frd(q.p, 3)} MPa → ${frd(q.fluage, 1)} cm³`).join(" ; ")}. Les ${plateau.length} premiers forment le palier bas, les suivants la branche montante.`,
        donnees: pts.map((q) => donnee(`p = ${frd(q.p, 3)} MPa`, `ΔV60/30 = ${frd(q.fluage, 1)} cm³`)),
        figure: fig,
        questions: [
          nombre("Pression de fluage pf (intersection des deux droites) ?", r.pf, "MPa", `Droite basse : ΔV ≈ ${frd(r.bas.a, 2)} + ${frd(r.bas.b, 2)} p ; droite montante : ΔV ≈ ${frd(r.haut.a, 2)} + ${frd(r.haut.b, 2)} p ; elles se coupent à pf = ${frd(r.pf, 3)} MPa.`, { rel: 0.04 }),
        ],
      };
    },
  },
  {
    id: "ch3-alpha", titre: "Coefficient rhéologique et état du sol", difficulte: 1,
    generer(a) {
      const nature = a.choix(["argile", "limon", "sable", "grave"]);
      const lignes = ALPHA_MENARD[nature];
      const l = a.choix(lignes);
      const r = a.entre(l.rapport[0] + 0.5, Number.isFinite(l.rapport[1]) ? l.rapport[1] - 0.5 : l.rapport[0] + 6, 0.5);
      const pl = a.entre(0.6, 2.5, 0.1);
      const EM = +(r * pl).toFixed(1);
      const al = alphaMenard(nature, EM, pl);
      const etats = [...new Set(lignes.map((x) => x.etat))];
      return {
        enonce: `Dans un ${nature}, l'essai pressiométrique donne EM = ${fr(EM, 3)} MPa et pl = ${frd(pl, 1)} MPa.`,
        donnees: [donnee("Nature", nature), donnee("EM", `${fr(EM, 3)} MPa`), donnee("pl", `${frd(pl, 1)} MPa`)],
        questions: [
          nombre("Rapport EM/pl ?", EM / pl, "", `EM/pl = ${fr(EM, 3)} / ${frd(pl, 1)} = ${frd(EM / pl, 2)}.`, { rel: 0.01 }),
          choixMelange(a, "État du sol d'après le tableau de α ?", [al.etat, ...etats.filter((e) => e !== al.etat)],
            `Le tableau du coefficient rhéologique (F62 annexe C.5 ; NF P94-261 tableau H.2.1.1.1 corrigé) classe ce rapport dans « ${al.etat} ».`),
          choixMelange(a, "Coefficient α à retenir ?", [fraction(al.alpha), ...FRACTIONS.map(([, t]) => t).filter((t) => t !== fraction(al.alpha))].slice(0, 4),
            `α = ${fraction(al.alpha)}. Il sert au tassement (chapitre 9) et au module de réaction transversal des pieux (chapitre 14).`),
        ],
      };
    },
  },
];
