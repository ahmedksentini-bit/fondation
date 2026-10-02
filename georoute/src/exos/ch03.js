// Exercices du chapitre 3 : l'état hydrique, le Proctor et la portance —
// point Proctor, optimum et courbes de saturation, énergie de compactage,
// IPI et correction d'origine, états hydriques par wn/wOPN, IPI et Ic, et
// leurs seuils dans le GTR 1992.
import { fr, frd, nombre, choixMelange, donnee } from "./alea.js";
import { MOULES, DAMES, volumeMoule, energie, rhoDPoint, rhoDSaturation, wSaturation, optimum, saturationOptimum } from "../gtr/proctor.js";
import { teneurEau, etat as etatSol } from "../gtr/identification.js";
import { REFERENCE_CBR, indicePortant } from "../gtr/portance.js";
import { ETATS_2024, etatHydrique, intervalle, enClair, classerSol } from "../gtr/classification.js";
import { classerSol1992, ETATS_1992 } from "../gtr/classification92.js";
import { OBJECTIFS } from "../gtr/compactage.js";
import { courbeProctor } from "../bancs/materiaux.js";
import { graphe, echantillon, COULEURS } from "../figures.js";

const pc = (x, d = 1) => `${frd(x, d)} %`;
const mg = (x, d = 3) => `${frd(x, d)} Mg/m³`;
const arrondi = (x, n = 1) => Math.round(x * 10 ** n) / 10 ** n;
const sg = (s) => String(s).replace(/^-/, "−");

const NOMS_ETAT = { th: "th : très humide", h: "h : humide", m: "m : moyen", s: "s : sec", ts: "ts : très sec" };
const optionsEtat = (bon) => [NOMS_ETAT[bon], ...Object.entries(NOMS_ETAT).filter(([k]) => k !== bon).map(([, v]) => v)];
/** Sous-classes des tableaux d'état, désignées comme dans le cours. */
const LIB = {
  F1: "un limon peu plastique (F1)", F2: "un sol fin moyennement argileux (F2)", F3: "une argile (F3)", F4: "une argile très plastique (F4)",
  I1: "un sable très silteux (I1)", I2: "un sable argileux (I2)", "S>70": "un sable (S) dont le tamisat à 2 mm dépasse 70 %",
  "S≤70": "un sable (S) dont le tamisat à 2 mm ne dépasse pas 70 %", G: "une grave (G)",
};
/** « de » élidé devant un article indéfini : « d'un limon », « d'une argile ». */
const de = (x) => x.replace(/^un /, "d'un ").replace(/^une /, "d'une ");
const NOM_PARAM = { IPI: "IPI", Ic: "Ic", r: "wn/wOPN" };
/** Fourchettes réalistes de wOPN (%) selon la sous-classe : plus le sol est fin et argileux, plus l'optimum est humide. */
const WOPN = { F1: [12, 20], F2: [14, 22], F3: [16, 26], F4: [20, 30], I1: [9, 15], I2: [10, 17], "S>70": [7, 13], "S≤70": [6, 12], G: [5, 10] };
const NOM_MOULE = { A: "moule Proctor A", B: "moule CBR B" };
/** Seuils d'un paramètre pour une sous-classe, écrits en clair : « th : IPI ≤ 3 ; h : 3 < IPI ≤ 8… ». */
const seuils = (lignes, p) => lignes.filter((l) => l[p]).map((l) => `${l.etat} : ${enClair(l[p], NOM_PARAM[p])}`).join(" ; ");
/** Distance d'une valeur au plus proche des seuils d'un paramètre (pour écarter les cas limites). */
const ecartSeuils = (lignes, p, x) => Math.min(...lignes.filter((l) => l[p]).flatMap((l) => { const I = intervalle(l[p]); return [I.a, I.b]; }).filter(Number.isFinite).map((b) => Math.abs(x - b)));
/** Valeur tirée dans un intervalle « (a,b] » d'un tableau d'état, en restant à distance des bornes. */
function dansIntervalle(a, txt, marge, bas, haut, pas) {
  const I = intervalle(txt);
  const lo = Number.isFinite(I.a) ? I.a + marge : bas, hi = Number.isFinite(I.b) ? I.b - marge : haut;
  return a.entre(Math.min(lo, hi), Math.max(lo, hi), pas);
}

/** Segment le plus raide d'une courbe force–enfoncement (même lecture que indicePortant). */
function segmentPlusRaide(p) {
  let k = 0, i = 0;
  for (let j = 1; j < p.length; j++) { const kj = (p[j][1] - p[j - 1][1]) / (p[j][0] - p[j - 1][0]); if (kj > k) { k = kj; i = j; } }
  return { i, k, sm: (p[i - 1][0] + p[i][0]) / 2, Fm: (p[i - 1][1] + p[i][1]) / 2 };
}
/** Le segment le plus raide se distingue-t-il nettement (3 %) du suivant ? Sinon, deux lectures seraient défendables. */
function netteteRaide(p) {
  const k = p.slice(1).map((q, j) => (q[1] - p[j][1]) / (q[0] - p[j][0])).sort((x, y) => y - x);
  return k[0] >= 1.03 * k[1];
}
/** Détail d'une interpolation linéaire de la force à l'enfoncement s. */
function lecture(p, s) {
  for (let j = 1; j < p.length; j++) if (s <= p[j][0]) {
    const [s0, F0] = p[j - 1], [s1, F1] = p[j];
    return `entre ${fr(s0, 4)} mm (${frd(F0, 2)} kN) et ${fr(s1, 4)} mm (${frd(F1, 2)} kN)`;
  }
  return "";
}

export default [
  {
    id: "ch3-point", titre: "Un point Proctor : de la pesée à ρd", difficulte: 1,
    generer(a) {
      const moule = a.choix(["A", "B"]), M = MOULES[moule], V = volumeMoule(M);
      const rhoS = a.choix([2.65, 2.67, 2.68, 2.7, 2.72]);
      const wv = a.entre(6, 22, 0.1), Sr = a.entre(65, 92, 1);
      const mSol = Math.round(rhoDSaturation(wv, { rhoS, Sr }) * (1 + wv / 100) * V);
      const mMoule = moule === "A" ? a.entre(3500, 4500, 1) : a.entre(6500, 8000, 1);
      const ms = a.entre(80, 250, 0.1), mh = arrondi(ms * (1 + wv / 100), 1);
      const w = teneurEau({ mh, ms }), rho = mSol / V, rhoD = rhoDPoint({ M: mSol, V, w });
      const e = etatSol({ rho, w, rhoS });
      return {
        enonce: `Un point d'essai Proctor normal est compacté dans le ${NOM_MOULE[moule]} (Ø ${M.D} mm, hauteur ${M.H} mm). Moule et sol arasé pèsent ${fr(mMoule + mSol, 5)} g, le moule vide ${fr(mMoule, 5)} g. Un prélèvement de sol pèse ${frd(mh, 1)} g humide et ${frd(ms, 1)} g après étuvage à 105 °C. Masse volumique des grains : ρs = ${frd(rhoS, 2)} Mg/m³.`,
        donnees: [donnee("Moule", `${moule} · Ø ${M.D} × ${M.H} mm`), donnee("Moule + sol", `${fr(mMoule + mSol, 5)} g`), donnee("Moule vide", `${fr(mMoule, 5)} g`), donnee("Prélèvement", `${frd(mh, 1)} g → ${frd(ms, 1)} g sec`), donnee("ρs", `${frd(rhoS, 2)} Mg/m³`)],
        questions: [
          nombre("Volume du moule ?", V, "cm³", `V = π D² H / 4 = π × ${fr(M.D / 10)}² × ${fr(M.H / 10)} / 4 = ${frd(V, 1)} cm³.`, { rel: 0.005 }),
          nombre("Teneur en eau du point ?", w, "%", `w = 100 (mh − ms)/ms = 100 × (${frd(mh, 1)} − ${frd(ms, 1)})/${frd(ms, 1)} = ${pc(w, 2)}.`, { abs: 0.1 }),
          nombre("Masse volumique humide ρ ?", rho, "Mg/m³", `Sol : ${fr(mMoule + mSol, 5)} − ${fr(mMoule, 5)} = ${fr(mSol, 5)} g ; ρ = ${fr(mSol, 5)} / ${frd(V, 1)} = ${mg(rho)}.`, { rel: 0.005 }),
          nombre("Masse volumique sèche ρd ?", rhoD, "Mg/m³", `ρd = ρ/(1 + w) = ${frd(rho, 3)} / (1 + ${frd(w / 100, 4)}) = ${mg(rhoD)}.`, { rel: 0.005 }),
          nombre("Degré de saturation Sr ?", e.Sr, "%", `e = ρs/ρd − 1 = ${frd(rhoS, 2)}/${frd(rhoD, 3)} − 1 = ${frd(e.e, 3)} ; Sr = w ρs/(e ρw) = ${frd(w / 100, 4)} × ${frd(rhoS, 2)} / ${frd(e.e, 3)} = ${pc(e.Sr, 0)} : le point reste sous la courbe de saturation.`, { abs: 1.5 }),
        ],
      };
    },
  },
  {
    id: "ch3-proctor", titre: "Optimum Proctor normal et objectif q4", difficulte: 2,
    generer(a) {
      let rhoS, pts, o, wn;
      for (let essai = 0; essai < 40; essai++) {
        rhoS = a.choix([2.65, 2.68, 2.7, 2.72]);
        const wOPN = a.entre(7, 22, 0.1), rhoDOPN = rhoDSaturation(wOPN, { rhoS, Sr: a.entre(76, 88, 1) });
        const courbe = courbeProctor({ wOPN, rhoDOPN, rhoS, k: a.entre(0.0028, 0.0045, 0.0001) });
        const pas = wOPN < 11 ? 1.5 : 2;
        pts = [-2, -1, 0, 1, 2].map((i) => {
          const w = arrondi(wOPN + i * pas + a.entre(-0.4, 0.4, 0.1));
          return [w, Math.round(courbe(w) * (1 + a.entre(-0.002, 0.002, 0.0005)) * 1000) / 1000];
        });
        o = optimum(pts);
        if (o.applicable) break;
      }
      wn = arrondi(o.wOPN * a.entre(0.75, 1.3, 0.01));
      const sat = saturationOptimum({ wOPN: o.wOPN, rhoDOPN: o.rhoDOPN, rhoS });
      const q4 = (OBJECTIFS.q4.moyen / 100) * o.rhoDOPN;
      const ws = pts.map((p) => p[0]), rs = pts.map((p) => p[1]);
      const xmin = Math.floor(Math.min(...ws) - 2), xmax = Math.ceil(Math.max(...ws) + 2);
      const ymin = Math.floor((Math.min(...rs) - 0.05) * 50) / 50, ymax = Math.ceil((Math.max(...rs) + 0.12) * 50) / 50;
      const c = o.coefficients;
      const figure = graphe({
        largeur: 600, hauteur: 300, xmin, xmax, ymin, ymax, xlabel: "teneur en eau w (%)", ylabel: "ρd (Mg/m³)", pasY: 0.05,
        series: [
          { points: echantillon((w) => rhoDSaturation(w, { rhoS }), xmin, xmax, 60), couleur: COULEURS.bleu, epaisseur: 2, libelle: "saturation Sr = 100 %" },
          { points: echantillon((w) => rhoDSaturation(w, { rhoS, Sr: 80 }), xmin, xmax, 60), couleur: COULEURS.bleu, tirets: "6 4", epaisseur: 1.6, libelle: "Sr = 80 %" },
          { points: pts, couleur: COULEURS.encre, nuage: true, rayon: 4.5 },
        ],
      });
      return {
        enonce: `Un essai Proctor normal (ρs = ${frd(rhoS, 2)} Mg/m³) donne les cinq points ci-dessous. On ajuste une parabole ρd = c0 + c1 w + c2 w² sur les points qui entourent le plus dense. Le sol en place a une teneur en eau naturelle wn = ${pc(wn)}.`,
        donnees: [...pts.map(([w, r]) => donnee(`w = ${pc(w)}`, mg(r))), donnee("wn", pc(wn))],
        figure,
        questions: [
          nombre("Teneur en eau de l'optimum wOPN ?", o.wOPN, "%", `Parabole des moindres carrés sur ${o.retenus.length} points : c1 = ${frd(c.c1, 4)}, c2 = ${sg(frd(c.c2, 5))} ; sommet en w = −c1/(2 c2) = ${pc(o.wOPN)}.`, { abs: 0.4 }),
          nombre("Masse volumique sèche de l'optimum ρdOPN ?", o.rhoDOPN, "Mg/m³", `Valeur de la parabole au sommet : ρdOPN = ${mg(o.rhoDOPN)} (le point le plus dense mesuré vaut ${mg(Math.max(...rs))}).`, { abs: 0.012 }),
          nombre("Degré de saturation à l'optimum ?", sat.Sr, "%", `e = ${frd(rhoS, 2)}/${frd(o.rhoDOPN, 3)} − 1 = ${frd(sat.e, 3)} ; Sr = ${frd(o.wOPN / 100, 4)} × ${frd(rhoS, 2)}/${frd(sat.e, 3)} = ${pc(sat.Sr, 0)}. ${sat.Sr > 90 ? "Au-delà de 90 %, un optimum est suspect." : "L'optimum se place, comme il se doit, sous la courbe de saturation (en général entre 75 et 90 %)."}`, { abs: 2.5 }),
          nombre("Masse volumique sèche moyenne exigée par l'objectif q4 ?", q4, "Mg/m³", `q4 : ${fr(OBJECTIFS.q4.moyen)} % de ρdOPN = ${fr(OBJECTIFS.q4.moyen / 100, 4)} × ${frd(o.rhoDOPN, 3)} = ${mg(q4)} ; en fond de couche, ${fr(OBJECTIFS.q4.fond)} % = ${mg((OBJECTIFS.q4.fond / 100) * o.rhoDOPN)}.`, { rel: 0.01 }),
          nombre("Rapport wn/wOPN du sol en place ?", wn / o.wOPN, "", `${pc(wn)} / ${pc(o.wOPN)} = ${frd(wn / o.wOPN, 2)} : le sol est ${wn / o.wOPN >= 1.1 ? "nettement du côté humide de l'optimum" : wn / o.wOPN >= 0.9 ? "au voisinage de l'optimum" : "du côté sec de l'optimum"}.`, { abs: 0.03 }),
        ],
      };
    },
  },
  {
    id: "ch3-saturation", titre: "Courbe de saturation : un point possible ?", difficulte: 2,
    generer(a) {
      const rhoS = a.choix([2.6, 2.65, 2.68, 2.7, 2.75]), w = a.entre(8, 25, 0.1);
      const possible = a.reel() < 0.65;
      let rhoD, e;
      for (let essai = 0; essai < 20; essai++) {
        rhoD = Math.round(rhoDSaturation(w, { rhoS, Sr: possible ? a.entre(70, 96, 1) : a.entre(104, 115, 1) }) * 1000) / 1000;
        e = etatSol({ rho: rhoD * (1 + w / 100), w, rhoS });
        if (Math.abs(e.Sr - 100) >= 2.5) break;
      }
      const r100 = rhoDSaturation(w, { rhoS }), r80 = rhoDSaturation(w, { rhoS, Sr: 80 }), wSat = wSaturation(rhoD, rhoS);
      const ok = e.Sr < 100;
      return {
        enonce: `Un laboratoire annonce, pour un point d'essai Proctor, w = ${pc(w)} et ρd = ${mg(rhoD)}. La masse volumique des grains du sol vaut ρs = ${frd(rhoS, 2)} Mg/m³ (ρw = 1 Mg/m³).`,
        donnees: [donnee("w", pc(w)), donnee("ρd", mg(rhoD)), donnee("ρs", `${frd(rhoS, 2)} Mg/m³`)],
        questions: [
          nombre("Masse volumique sèche sur la courbe de saturation (Sr = 100 %) à cette teneur en eau ?", r100, "Mg/m³", `ρd = ρs/(1 + w ρs/ρw) = ${frd(rhoS, 2)}/(1 + ${frd(w / 100, 3)} × ${frd(rhoS, 2)}) = ${mg(r100)}.`, { rel: 0.004 }),
          nombre("Et sur la courbe Sr = 80 % ?", r80, "Mg/m³", `ρd = ρs/(1 + w ρs/(0,8 ρw)) = ${mg(r80)}.`, { rel: 0.004 }),
          nombre("Teneur en eau qui saturerait le sol à la masse volumique sèche annoncée ?", wSat, "%", `w = ρw (1/ρd − 1/ρs) = 100 × (1/${frd(rhoD, 3)} − 1/${frd(rhoS, 2)}) = ${pc(wSat)}.`, { abs: 0.3 }),
          nombre("Degré de saturation du point annoncé ?", e.Sr, "%", `e = ${frd(rhoS, 2)}/${frd(rhoD, 3)} − 1 = ${frd(e.e, 3)} ; Sr = w ρs/(e ρw) = ${pc(e.Sr, 0)}.`, { abs: 1.5 }),
          choixMelange(a, "Ce point est-il possible ?", [ok ? "oui : il reste sous la courbe de saturation" : "non : il passe au-dessus de la courbe de saturation, une mesure est fausse",
            ok ? "non : il passe au-dessus de la courbe de saturation, une mesure est fausse" : "oui : il reste sous la courbe de saturation", "on ne peut pas le dire sans la courbe Proctor complète"],
            `${ok ? `ρd = ${frd(rhoD, 3)} < ${frd(r100, 3)} Mg/m³ : Sr = ${pc(e.Sr, 0)} < 100 %, le point est plausible.` : `ρd = ${frd(rhoD, 3)} > ${frd(r100, 3)} Mg/m³ : il faudrait Sr = ${pc(e.Sr, 0)}, plus de 100 %. Aucun point ne peut dépasser la courbe de saturation, où il n'y a plus d'air à chasser : pesée, teneur en eau ou ρs sont à revoir.`}`),
        ],
      };
    },
  },
  {
    id: "ch3-energie", titre: "Proctor normal et modifié : l'énergie de compactage", difficulte: 1,
    generer(a) {
      const moule = a.choix(["A", "B"]), M = MOULES[moule], V = volumeMoule(M), d = DAMES.normal, dm = DAMES.modifie;
      const Nn = d.coups[moule], Nerr = a.entier(Math.round(Nn * 0.6), Nn - 3);
      const En = energie("normal", moule), Em = energie("modifie", moule), Eerr = (En * Nerr) / Nn;
      const detail = (x, N) => `${x.couches} couches × ${N} coups × ${frd(x.masse, 1)} kg × 9,81 m/s² × ${frd(x.chute, 3)} m / ${frd(V, 1)}·10⁻⁶ m³`;
      return {
        enonce: `Au laboratoire, on compacte au Proctor dans le ${NOM_MOULE[moule]} (Ø ${M.D} mm, hauteur ${M.H} mm). Proctor normal : dame de ${frd(d.masse, 1)} kg tombant de ${fr(d.chute * 1000)} mm, ${d.couches} couches de ${Nn} coups ; Proctor modifié : dame de ${frd(dm.masse, 1)} kg tombant de ${fr(dm.chute * 1000)} mm, ${dm.couches} couches de ${dm.coups[moule]} coups. Un jour, un opérateur pressé n'a donné que ${Nerr} coups par couche au Proctor normal.`,
        donnees: [donnee("Moule", `${moule} · Ø ${M.D} × ${M.H} mm`), donnee("Proctor normal", `${frd(d.masse, 1)} kg · ${fr(d.chute * 1000)} mm · ${d.couches} × ${Nn}`), donnee("Proctor modifié", `${frd(dm.masse, 1)} kg · ${fr(dm.chute * 1000)} mm · ${dm.couches} × ${dm.coups[moule]}`), donnee("Coups donnés", `${Nerr} par couche`)],
        questions: [
          nombre("Volume du moule ?", V, "cm³", `π × ${fr(M.D / 10)}² × ${fr(M.H / 10)} / 4 = ${frd(V, 1)} cm³.`, { rel: 0.005 }),
          nombre("Énergie du Proctor normal par unité de volume ?", En, "kJ/m³", `E = ${detail(d, Nn)} = ${fr(En, 3)} kJ/m³, soit environ 0,6 MJ/m³.`, { rel: 0.02 }),
          nombre("Énergie du Proctor modifié ?", Em, "kJ/m³", `E = ${detail(dm, dm.coups[moule])} = ${fr(Em, 4)} kJ/m³, soit environ 2,7 MJ/m³.`, { rel: 0.02 }),
          nombre("Rapport des deux énergies ?", Em / En, "", `${fr(Em, 4)} / ${fr(En, 3)} = ${frd(Em / En, 2)} : le Proctor modifié est quatre fois et demie plus énergique.`, { rel: 0.02 }),
          nombre("Énergie réellement appliquée par l'opérateur pressé ?", Eerr, "kJ/m³", `L'énergie est proportionnelle au nombre de coups : ${fr(En, 3)} × ${Nerr}/${Nn} = ${fr(Eerr, 3)} kJ/m³.`, { rel: 0.02 }),
          choixMelange(a, "Par rapport au vrai optimum Proctor normal, l'optimum qu'il mesurera sera…", ["moins dense et plus humide", "plus dense et plus sec", "plus dense et plus humide", "identique : l'énergie ne change que la forme de la cloche"],
            "Avec plus d'énergie, l'optimum est plus dense et plus sec ; avec moins d'énergie, c'est l'inverse : ρdOPN serait sous-estimé et wOPN surestimé, et les objectifs q4 et q3, rapportés à ce ρdOPN, deviendraient trop faciles."),
        ],
      };
    },
  },
  {
    id: "ch3-ipi", titre: "Indice portant immédiat et état hydrique", difficulte: 1,
    generer(a) {
      let cle, F25, F5, i25, i5, IPI, e;
      for (let essai = 0; essai < 60; essai++) {
        cle = a.choix(Object.keys(ETATS_2024));
        const lignes = ETATS_2024[cle].lignes;
        const l = a.choix(lignes.filter((x) => x.IPI));
        const cible = dansIntervalle(a, l.IPI, 0.5, 1, 32, 0.1);
        if (a.reel() < 0.5) { F5 = Math.round(cible * REFERENCE_CBR[5]) / 100; F25 = Math.round(F5 * a.entre(0.5, 0.63, 0.01) * 100) / 100; }
        else { F25 = Math.round(cible * REFERENCE_CBR[2.5]) / 100; F5 = Math.round(F25 * a.entre(1.1, 1.42, 0.01) * 100) / 100; }
        i25 = (100 * F25) / REFERENCE_CBR[2.5]; i5 = (100 * F5) / REFERENCE_CBR[5]; IPI = Math.max(i25, i5);
        e = etatHydrique(cle, { IPI });
        if (F25 > 0.05 && e.applicable && ecartSeuils(lignes, "IPI", IPI) >= 0.25) break;
      }
      const lignes = ETATS_2024[cle].lignes;
      return {
        enonce: `Juste après son compactage à l'énergie Proctor normal, à sa teneur en eau naturelle, une éprouvette ${de(LIB[cle])} est poinçonnée sans surcharge ni immersion. La presse lit ${frd(F25, 2)} kN à 2,5 mm d'enfoncement et ${frd(F5, 2)} kN à 5 mm.`,
        donnees: [donnee("Sol", LIB[cle]), donnee("F à 2,5 mm", `${frd(F25, 2)} kN`), donnee("F à 5 mm", `${frd(F5, 2)} kN`)],
        questions: [
          nombre("Rapport à la force de référence à 2,5 mm ?", i25, "%", `100 × ${frd(F25, 2)} / ${fr(REFERENCE_CBR[2.5], 4)} = ${pc(i25)}.`, { rel: 0.01 }),
          nombre("Rapport à la force de référence à 5 mm ?", i5, "%", `100 × ${frd(F5, 2)} / ${fr(REFERENCE_CBR[5])} = ${pc(i5)}.`, { rel: 0.01 }),
          nombre("Indice portant immédiat IPI ?", IPI, "", `On retient le plus grand des deux rapports : IPI = ${frd(IPI, 1)} (${i5 > i25 ? "à 5 mm" : "à 2,5 mm"}).`, { rel: 0.01 }),
          choixMelange(a, "État hydrique que l'IPI désigne pour ce sol ?", optionsEtat(e.etat),
            `Seuils d'IPI ${de(LIB[cle])} : ${seuils(lignes, "IPI")}. IPI = ${frd(IPI, 1)} → ${NOMS_ETAT[e.etat]}. L'IPI est le paramètre à privilégier pour les états humides : il traduit la difficulté des engins à circuler.`),
        ],
      };
    },
  },
  {
    id: "ch3-poinconnement", titre: "Courbe de poinçonnement et correction d'origine", difficulte: 3,
    generer(a) {
      const LECT = [0.625, 1.25, 2, 2.5, 4, 5, 7.5, 10];
      let pts, r;
      for (let essai = 0; essai < 60; essai++) {
        const pied = a.entre(0.6, 1, 0.05), p = a.entre(0.6, 0.85, 0.01);
        const forme = (x) => Math.max(0, x - pied * (1 - Math.exp(-x / pied))) ** p;
        const echelle = a.entre(4, 40, 0.5) / indicePortant([[0, 0], ...LECT.map((x) => [x, forme(x)])]).indice;
        pts = [[0, 0], ...LECT.map((x) => [x, Math.round(forme(x) * echelle * (1 + a.entre(-0.01, 0.01, 0.002)) * 100) / 100])];
        r = indicePortant(pts);
        if (r.applicable && r.decalage >= 0.15 && segmentPlusRaide(pts).i >= 3 && netteteRaide(pts) && pts.every((q, i) => !i || q[1] > pts[i - 1][1])) break;
      }
      const seg = segmentPlusRaide(pts);
      const Fmax = Math.max(...pts.map((q) => q[1]));
      const figure = graphe({
        largeur: 600, hauteur: 280, xmin: 0, xmax: 10, ymin: 0, ymax: Math.ceil(Fmax * 1.15 * 10) / 10, xlabel: "enfoncement (mm)", ylabel: "force (kN)", pasX: 1,
        series: [{ points: pts, couleur: COULEURS.encre, epaisseur: 2, marqueurs: true, libelle: "lectures de la presse" }],
      });
      return {
        enonce: `Poinçonnement d'une éprouvette compactée au Proctor normal, sans surcharge ni immersion (essai IPI) : forces lues de 0,625 à 10 mm d'enfoncement. La courbe commence concave (mauvaise mise en contact) : on corrige l'origine en prolongeant jusqu'à F = 0 la droite du segment le plus raide, passant par son milieu, et l'on décale les enfoncements d'autant. Forces de référence : 13,35 kN à 2,5 mm et 20 kN à 5 mm.`,
        donnees: pts.slice(1).map(([s, F]) => donnee(`${fr(s, 4)} mm`, `${frd(F, 2)} kN`)),
        figure,
        questions: [
          nombre("Pente du segment le plus raide ?", seg.k, "kN/mm", `Segment de ${fr(pts[seg.i - 1][0], 4)} à ${fr(pts[seg.i][0], 4)} mm : (${frd(pts[seg.i][1], 2)} − ${frd(pts[seg.i - 1][1], 2)}) / (${fr(pts[seg.i][0], 4)} − ${fr(pts[seg.i - 1][0], 4)}) = ${frd(seg.k, 3)} kN/mm.`, { rel: 0.03 }),
          nombre("Décalage de l'origine ?", r.decalage, "mm", `Milieu du segment : (${frd(seg.sm, 3)} mm ; ${frd(seg.Fm, 3)} kN) ; la droite coupe F = 0 en ${frd(seg.sm, 3)} − ${frd(seg.Fm, 3)}/${frd(seg.k, 3)} = ${frd(r.decalage, 3)} mm.`, { abs: 0.05 }),
          nombre("Force corrigée à 2,5 mm ?", r.F25, "kN", `On lit la courbe à 2,5 + ${frd(r.decalage, 3)} = ${frd(2.5 + r.decalage, 3)} mm, ${lecture(pts, 2.5 + r.decalage)} : F = ${frd(r.F25, 3)} kN.`, { rel: 0.03 }),
          nombre("Force corrigée à 5 mm ?", r.F5, "kN", `Lecture à 5 + ${frd(r.decalage, 3)} = ${frd(5 + r.decalage, 3)} mm, ${lecture(pts, 5 + r.decalage)} : F = ${frd(r.F5, 3)} kN.`, { rel: 0.03 }),
          nombre("Indice portant immédiat ?", r.indice, "", `max(100 × ${frd(r.F25, 3)}/13,35 ; 100 × ${frd(r.F5, 3)}/20) = max(${frd(r.i25, 1)} ; ${frd(r.i5, 1)}) = ${frd(r.indice, 1)}, lu à ${r.retenu}. Sans correction, on aurait trouvé ${frd(Math.max(pts[4][1] / 0.1335, pts[6][1] / 0.2), 1)} : la correction relève l'indice.`, { rel: 0.03 }),
        ],
      };
    },
  },
  {
    id: "ch3-etat", titre: "État hydrique : wn/wOPN contre IPI", difficulte: 2,
    generer(a) {
      const SCENARIOS = [["m", "m"], ["h", "h"], ["th", "th"], ["s", null], ["ts", null], ["h", "m"], ["m", "h"], ["s", "m"], ["th", "h"]];
      let cle, w, wOPN, IPI, parR, parIPI, e;
      for (let essai = 0; essai < 80; essai++) {
        cle = a.choix(Object.keys(ETATS_2024));
        const lignes = ETATS_2024[cle].lignes;
        // Seuls les scénarios dont l'état visé par l'IPI a un seuil d'IPI pour ce sol.
        const [eR, eI] = a.choix(SCENARIOS.filter(([, x]) => !x || lignes.find((l) => l.etat === x).IPI));
        const lR = lignes.find((l) => l.etat === eR), lI = eI && lignes.find((l) => l.etat === eI);
        wOPN = a.entre(...WOPN[cle], 0.1);
        const r = dansIntervalle(a, lR.r, 0.03, 0.4, 1.55, 0.01);
        w = arrondi(r * wOPN);
        // Sans seuil d'IPI pour l'état sec visé, l'IPI mesuré est élevé : au-delà de la dernière borne.
        IPI = eI ? dansIntervalle(a, lI.IPI, 0.6, 1, 34, 0.5) : arrondi(Math.max(...lignes.filter((l) => l.IPI).map((l) => intervalle(l.IPI).b)) + a.entre(3, 15, 0.5));
        parR = etatHydrique(cle, { w, wOPN }); parIPI = etatHydrique(cle, { IPI }); e = etatHydrique(cle, { IPI, w, wOPN });
        if (parR.applicable && e.applicable && ecartSeuils(lignes, "r", w / wOPN) >= 0.012 && ecartSeuils(lignes, "IPI", IPI) >= 0.4) break;
      }
      const lignes = ETATS_2024[cle].lignes;
      const aucun = "aucun : l'IPI n'a pas de seuil à ce niveau pour ce sol";
      const bonIPI = parIPI.applicable ? NOMS_ETAT[parIPI.etat] : aucun;
      const regle = e.par === "IPI" ? (["th", "h"].includes(e.etat) ? "l'IPI désigne un état humide : il l'emporte, car il traduit la difficulté de circulation des engins" : "la teneur en eau désigne un état humide, mais l'IPI dit que le sol porte : pour juger d'un état humide, on privilégie l'IPI")
        : "pour les états secs, c'est wn/wOPN qui tranche : la difficulté de compactage en dépend directement, et l'IPI perd son sens";
      return {
        enonce: `${LIB[cle].charAt(0).toUpperCase() + LIB[cle].slice(1)} est ${LIB[cle].startsWith("une ") ? "extraite" : "extrait"} à la teneur en eau wn = ${pc(w)} ; son optimum Proctor normal est à wOPN = ${pc(wOPN)}. Un essai de poinçonnement immédiat à cette teneur en eau donne IPI = ${frd(IPI, 1)}.`,
        donnees: [donnee("Sol", LIB[cle]), donnee("wn", pc(w)), donnee("wOPN", pc(wOPN)), donnee("IPI", frd(IPI, 1))],
        questions: [
          nombre("Rapport wn/wOPN ?", w / wOPN, "", `${pc(w)} / ${pc(wOPN)} = ${frd(w / wOPN, 3)}.`, { abs: 0.01 }),
          choixMelange(a, "État hydrique d'après wn/wOPN seul ?", optionsEtat(parR.etat), `Seuils ${de(LIB[cle])} : ${seuils(lignes, "r")}. wn/wOPN = ${frd(w / wOPN, 3)} → ${NOMS_ETAT[parR.etat]}.`),
          choixMelange(a, "État hydrique d'après l'IPI seul ?", [bonIPI, ...[...Object.values(NOMS_ETAT), aucun].filter((x) => x !== bonIPI).slice(0, 4)],
            `Seuils d'IPI : ${seuils(lignes, "IPI")}. IPI = ${frd(IPI, 1)} → ${parIPI.applicable ? NOMS_ETAT[parIPI.etat] : "au-dessus du dernier seuil : l'IPI ne distingue pas les états les plus secs"}.`),
          choixMelange(a, "État hydrique à retenir ?", optionsEtat(e.etat),
            `${e.discordance ? "Les deux paramètres ne concordent pas : " : "Les deux paramètres concordent ; "}${regle} [F1 § 2.2.1 C]. État retenu : ${NOMS_ETAT[e.etat]}.`),
        ],
      };
    },
  },
  {
    id: "ch3-ic-1992", titre: "Indice de consistance : GTR 2024 et GTR 1992", difficulte: 3,
    generer(a) {
      const cas = a.choix([["F2", "A2", [13, 21]], ["F3", "A3", [26, 38]], ["F3", "A2", [23, 24]]]);
      const [c24, c92, [ipMin, ipMax]] = cas;
      const l24 = ETATS_2024[c24].lignes, l92 = ETATS_1992[c92];
      let IP, wL, wP, wn, Ic, r24, r92;
      for (let essai = 0; essai < 60; essai++) {
        IP = a.entier(ipMin, ipMax); wL = a.entier(IP + 16, IP + 38); wP = wL - IP;
        wn = arrondi(wL - a.entre(0.72, 1.48, 0.01) * IP);
        Ic = (wL - wn) / IP;
        if (ecartSeuils(l24, "Ic", Ic) >= 0.012 && ecartSeuils(l92, "Ic", Ic) >= 0.012) break;
      }
      const f = a.entier(55, 95);
      r24 = classerSol({ Dmax: 5, p63um: f, IP, wL, wP, w: wn });
      r92 = classerSol1992({ Dmax: 5, p80um: Math.min(100, f + 2), IP, Ic });
      // Leurres de l'édition 1992 seulement (classe voisine × état voisin) : rien n'y trahit les réponses au GTR 2024.
      const autre92 = r92.sousClasse === "A2" ? "A3" : "A2", eV = a.choix({ th: ["h"], h: ["th", "m"], m: ["h", "s"], s: ["m", "ts"], ts: ["s"] }[r92.etat]);
      const options92 = [`${r92.sousClasse}${r92.etat}`, `${r92.sousClasse}${eV}`, `${autre92}${r92.etat}`, `${autre92}${eV}`];
      return {
        enonce: `Un sol fin (${f} % de passant à 63 µm, ${Math.min(100, f + 2)} % à 80 µm) a pour limites wL = ${fr(wL)} % et wP = ${fr(wP)} % ; au déblai, sa teneur en eau naturelle est wn = ${pc(wn)}. Ni l'IPI ni l'optimum Proctor ne sont encore connus : on situe son état par l'indice de consistance, dans les deux éditions du guide.`,
        donnees: [donnee("wL", `${fr(wL)} %`), donnee("wP", `${fr(wP)} %`), donnee("wn", pc(wn)), donnee("Fines", `${f} % (63 µm)`)],
        questions: [
          nombre("Indice de plasticité IP ?", IP, "", `IP = ${fr(wL)} − ${fr(wP)} = ${fr(IP)}.`, { abs: 0.1 }),
          nombre("Indice de consistance Ic ?", Ic, "", `Ic = (wL − wn)/IP = (${fr(wL)} − ${frd(wn, 1)})/${fr(IP)} = ${frd(Ic, 3)}.`, { abs: 0.01 }),
          choixMelange(a, "Sous-classe au GTR 2024 ?", [r24.sousClasse, ...["F1", "F2", "F3", "F4"].filter((x) => x !== r24.sousClasse)],
            `Fines > 35 % et IP = ${fr(IP)} > 12 : l'IP est le critère ; seuils 12, 22, 40 → ${r24.sousClasse}.${c92 === "A2" && c24 === "F3" ? " Au GTR 1992, dont le seuil était 25, ce même sol serait A2 : c'est l'un des cas où les deux éditions divergent." : ""}`),
          choixMelange(a, "État hydrique au GTR 2024 d'après Ic ?", optionsEtat(r24.etat), `Seuils d'Ic de ${r24.sousClasse} : ${seuils(l24, "Ic")}. Ic = ${frd(Ic, 3)} → ${NOMS_ETAT[r24.etat]}.`),
          choixMelange(a, "Classe et état au GTR 1992, avec le même Ic ?", options92,
            `GTR 1992 : IP = ${fr(IP)} ${c92 === "A2" ? "≤ 25 → A2" : "entre 25 et 40 → A3"} ; seuils d'Ic de ${c92} : ${seuils(l92, "Ic")}. Ic = ${frd(Ic, 3)} → ${r92.symbole}. ${r92.etat === r24.etat ? "Les deux éditions donnent ici le même état." : "Les seuils ont bougé : le même sol ne reçoit pas le même état dans les deux éditions."}`),
        ],
      };
    },
  },
];
