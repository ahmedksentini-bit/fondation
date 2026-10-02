// Exercices du chapitre 14 : cubatures et mouvement des terres — profils en
// travers, volumes entre profils (moyenne des aires, prismoïde),
// foisonnement et compactage, épure de Lalanne et ligne de répartition.
import { fr, frd, nombre, choixMelange, donnee } from "./alea.js";
import { profilTravers, coteEn, volumes, prismoide, foisonnement, coefficientCompactage, epure, repartition } from "../gtr/cubatures.js";
import { svg, graphe, ligne, texte, COULEURS } from "../figures.js";

/** Tire des données jusqu'à ce qu'elles conviennent ; au pire, le dernier tirage reste valable (réponses du solveur). */
function tirer(a, tirage, accepte, essais = 80) {
  let d;
  for (let i = 0; i < essais; i++) { d = tirage(a); if (accepte(d)) return d; }
  return d;
}
/** Partie fractionnaire loin d'un entier : un arrondi au-dessus ne dépend pas des décimales retenues. */
const loinEntier = (x, marge = 0.04) => { const f = x - Math.floor(x); return f > marge && f < 1 - marge; };
const fruit = (f) => ({ 1: "1/1", 1.5: "3/2", 2: "2/1" }[f] ?? `${frd(f, 1)}/1`);
const signe = (x, d = 2) => `${x < 0 ? "−" : ""}${frd(Math.abs(x), d)}`;
/** Nombre signé, chiffres significatifs, avec le vrai signe moins. */
const frs = (x, c = 4) => `${x < 0 ? "−" : ""}${fr(Math.abs(x), c)}`;

/** Aire d'un polygone par la formule des coordonnées (Sarrus) : opération élémentaire du cours de topographie. */
const aireSarrus = (pts) => Math.abs(pts.reduce((s, [x, z], i) => { const [x2, z2] = pts[(i + 1) % pts.length]; return s + x * z2 - x2 * z; }, 0)) / 2;

/** Abscisses où le terrain naturel coupe le projet entre ses deux extrémités (points de passage déblai–remblai). */
function passages(tn, projet) {
  const d = (x) => coteEn(tn, x) - coteEn(projet, x), res = [];
  for (let i = 1; i < projet.length; i++) {
    const x0 = projet[i - 1][0], x1 = projet[i][0], d0 = d(x0), d1 = d(x1);
    if ((d0 > 1e-9 && d1 < -1e-9) || (d0 < -1e-9 && d1 > 1e-9)) res.push(x0 + ((x1 - x0) * d0) / (d0 - d1));
  }
  return res;
}

/**
 * Zones de déblai (terrain au-dessus du projet) et de remblai entre xa et xb,
 * en polygones exacts : sur chaque intervalle entre deux sommets, l'écart
 * terrain − projet est linéaire ; on le coupe là où il change de signe.
 */
function zonesProfil(tn, projet, xa, xb) {
  const d = (x) => coteEn(tn, x) - coteEn(projet, x);
  const xs = [...new Set([xa, xb, ...tn.map((p) => p[0]), ...projet.map((p) => p[0])])].filter((x) => x >= xa && x <= xb).sort((u, v) => u - v);
  const tous = [xs[0]];
  for (let i = 1; i < xs.length; i++) {
    const x0 = xs[i - 1], x1 = xs[i], d0 = d(x0), d1 = d(x1);
    if (d0 * d1 < 0) tous.push(x0 + ((x1 - x0) * d0) / (d0 - d1));
    tous.push(x1);
  }
  const zones = [];
  let courant = null;
  for (let i = 1; i < tous.length; i++) {
    const x0 = tous[i - 1], x1 = tous[i], sg = Math.sign(d((x0 + x1) / 2));
    if (sg === 0 || x1 - x0 < 1e-9) { courant = null; continue; }
    if (!courant || courant.sg !== sg) { courant = { sg, xs: [x0] }; zones.push(courant); }
    courant.xs.push(x1);
  }
  return zones.map((z) => ({ deblai: z.sg > 0, pts: [...z.xs.map((x) => [x, coteEn(tn, x)]), ...[...z.xs].reverse().map((x) => [x, coteEn(projet, x)])] }));
}

/**
 * Coupe d'un profil en travers : terrain naturel (tirets), projet, surfaces
 * de déblai (ocre) et de remblai (vert), sans leur valeur. points : repères
 * nommés [{ x, z, nom }] ; notes : libellés libres [{ x, z, texte, couleur }].
 */
function coupeProfil(r, { points = [], notes = [] } = {}) {
  const xa = r.emprise[0] - 4, xb = r.emprise[1] + 4;
  const tn = (x) => coteEn(r.tn, x);
  const tnVue = [[xa, tn(xa)], ...r.tn.filter(([x]) => x > xa && x < xb), [xb, tn(xb)]];
  const zs = [...tnVue.map((p) => p[1]), ...r.projet.map((p) => p[1])];
  const za = Math.min(...zs) - 1, zb = Math.max(...zs) + 1.4;
  const W = 600, H = 260, kx = (W - 40) / (xb - xa), kz = Math.min((H - 62) / (zb - za), 2 * kx), exag = kz / kx;
  const X = (x) => 20 + (x - xa) * kx, Z = (z) => H - 36 - (z - za) * kz;
  const chemin = (pts) => `M${pts.map(([x, z]) => `${X(x).toFixed(1)} ${Z(z).toFixed(1)}`).join("L")}`;
  return svg({ largeur: 620, hauteur: H, titre: "Profil en travers", contenu: () => {
    let s = "";
    const zones = zonesProfil(r.tn, r.projet, r.emprise[0], r.emprise[1]);
    for (const z of zones) {
      const coul = z.deblai ? "#f59e0b" : "#22c55e";
      s += `<path d="${chemin(z.pts)}Z" fill="${coul}" stroke="${coul}" stroke-width=".6" opacity=".5"/>`;
    }
    s += `<path d="${chemin(tnVue)}" fill="none" stroke="#8b5a2b" stroke-width="2" stroke-dasharray="7 4"/>`;
    s += `<path d="${chemin(r.projet)}" fill="none" stroke="${COULEURS.encre}" stroke-width="2.4"/>`;
    s += ligne(X(0), 12, X(0), H - 30, "#94a3b8", 1, 'stroke-dasharray="2 4"') + texte(X(0) + 4, 22, "axe", 'style="font-size:11px;fill:#64748b"');
    // « terrain naturel » du côté libre du terrain : au-dessus d'un déblai, au-dessous d'un remblai.
    const xg = r.emprise[0] + 0.01, gaucheDeblai = tn(xg) > coteEn(r.projet, xg), xFin = xa + 118 / kx;
    const yTN = gaucheDeblai ? Math.min(Z(tn(xa)), Z(tn(xFin))) - 9 : Math.max(Z(tn(xa)), Z(tn(xFin))) + 17;
    s += texte(X(xa) + 4, yTN, "terrain naturel", 'class="halo" style="font-size:11.5px;font-weight:700;fill:#8b5a2b"');
    if (exag > 1.05) s += texte(600, 22, `hauteurs exagérées × ${frd(exag, 1)}`, 'text-anchor="end" style="font-size:10.5px;fill:#64748b"');
    // Noms des surfaces au pied de la figure, sous le centre de leur zone.
    const centre = (deb) => { const xs = zones.filter((z) => z.deblai === deb).flatMap((z) => z.pts.map((p) => p[0])); return xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : null; };
    const xD = centre(true), xR = centre(false);
    let pD = xD === null ? null : Math.min(Math.max(X(xD), 40), 580), pR = xR === null ? null : Math.min(Math.max(X(xR), 40), 580);
    if (pD !== null && pR !== null && Math.abs(pD - pR) < 90) { const m = (pD + pR) / 2, sg = pD < pR ? -1 : 1; pD = m + sg * 45; pR = m - sg * 45; }
    if (pD !== null) s += texte(pD, H - 8, "déblai", 'text-anchor="middle" style="font-size:12px;font-weight:800;fill:#b45309"');
    if (pR !== null) s += texte(pR, H - 8, "remblai", 'text-anchor="middle" style="font-size:12px;font-weight:800;fill:#15803d"');
    for (const p of points) {
      s += `<circle cx="${X(p.x).toFixed(1)}" cy="${Z(p.z).toFixed(1)}" r="3.5" fill="${COULEURS.rouge}"/>`;
      s += texte(X(p.x), Z(p.z) - 8, p.nom, 'text-anchor="middle" class="halo" style="font-size:12px;font-weight:800;fill:#b91c1c"');
    }
    for (const t of notes) s += texte(X(t.x), Z(t.z) + (t.dy ?? 0), t.texte, `text-anchor="${t.ancre ?? "middle"}" class="halo" style="font-size:11px;font-weight:700;fill:${t.couleur ?? COULEURS.encre}"`);
    return s;
  } });
}

/** Figure d'une épure de Lalanne donnée par ses points, avec la ligne de répartition y = c. */
function figureEpure(points, c = 0) {
  const ys = points.map((p) => p[1]), ymin = Math.min(c, ...ys), ymax = Math.max(c, ...ys), marge = 0.12 * (ymax - ymin || 1);
  return graphe({
    largeur: 620, hauteur: 290, xmin: points[0][0], xmax: points.at(-1)[0], ymin: ymin - marge, ymax: ymax + marge,
    xlabel: "abscisse le long du tracé (m)", ylabel: "volume cumulé (m³)",
    series: [
      { points, couleur: COULEURS.bleu, epaisseur: 2.6, marqueurs: true, libelle: "épure de Lalanne" },
      { points: [[points[0][0], c], [points.at(-1)[0], c]], couleur: COULEURS.rouge, epaisseur: 1.8, tirets: "6 4", libelle: `ligne de répartition (${fr(c, 3)} m³)` },
    ],
  });
}

const TN_PLAT = (z) => [[-80, z], [80, z]];

export default [
  {
    id: "ch14-trapeze", titre: "Profil en travers sur terrain plat", difficulte: 1,
    generer(a) {
      const d = tirer(a, (a) => {
        const deblai = a.reel() < 0.5, zTN = a.entre(85, 140, 0.01), h = a.entre(1.5, 6, 0.1), L = a.entre(4.5, 7.5, 0.25);
        const devers = a.choix([2, 2.5, 3]), f = deblai ? a.choix([1, 1.5]) : a.choix([1.5, 2]);
        const zAxe = +(deblai ? zTN - h : zTN + h).toFixed(2);
        const r = profilTravers({ tn: TN_PLAT(zTN), zAxe, lg: L, ld: L, devers, fd: deblai ? f : 1.5, fr: deblai ? 1.5 : f });
        return { deblai, zTN, h, L, devers, f, zAxe, r };
      }, ({ r, deblai }) => r.applicable && (deblai ? r.remblai < 1e-6 : r.deblai < 1e-6));
      const { deblai, zTN, h, L, devers, f, zAxe, r } = d;
      const dv = devers / 100, zBord = zAxe - dv * L, hb = deblai ? h + dv * L : h - dv * L, S = deblai ? r.deblai : r.remblai;
      const nature = deblai ? "déblai" : "remblai";
      return {
        enonce: `Sur un terrain naturel horizontal à la cote ${frd(zTN, 2)} m, la route passe en ${nature} : la plateforme de terrassement, large de 2 × ${frd(L, 2)} m, est en toit avec un dévers de ${frd(devers, 1)} % de part et d'autre de l'axe, où sa cote vaut ${frd(zAxe, 2)} m. Les talus de ${nature} ont un fruit de ${fruit(f)} (${frd(f, 1)} m à l'horizontale pour 1 m de hauteur).`,
        donnees: [donnee("Terrain naturel", `${frd(zTN, 2)} m`), donnee("Projet à l'axe", `${frd(zAxe, 2)} m`), donnee("Plateforme", `2 × ${frd(L, 2)} m · dévers ${frd(devers, 1)} %`), donnee(`Talus de ${nature}`, fruit(f))],
        figure: coupeProfil(r, { notes: [{ x: 0, z: zAxe, dy: -9, texte: `${frd(zAxe, 2)} m` }] }),
        questions: [
          nombre("Cote des bords de la plateforme ?", zBord, "m", `z = ${frd(zAxe, 2)} − ${frd(dv, 3)} × ${frd(L, 2)} = ${frd(zBord, 3)} m : en toit, les bords sont plus bas que l'axe.`, { abs: 0.005 }),
          nombre(`Surface de ${nature} du profil ?`, S, "m²", deblai
            ? `Plateforme : ∫(h + d|x|) dx = 2 L h + d L² = 2 × ${frd(L, 2)} × ${frd(h, 2)} + ${frd(dv, 3)} × ${frd(L, 2)}² = ${frd(2 * L * h + dv * L * L, 2)} m² ; talus : hauteur au bord hb = h + d L = ${frd(hb, 3)} m, deux triangles de ${frd(f, 1)} hb²/2, soit ${frd(f * hb * hb, 2)} m². S = ${frd(S, 2)} m².`
            : `Plateforme : ∫(h − d|x|) dx = 2 L h − d L² = 2 × ${frd(L, 2)} × ${frd(h, 2)} − ${frd(dv, 3)} × ${frd(L, 2)}² = ${frd(2 * L * h - dv * L * L, 2)} m² ; talus : hauteur au bord hb = h − d L = ${frd(hb, 3)} m, deux triangles de ${frd(f, 1)} hb²/2, soit ${frd(f * hb * hb, 2)} m². S = ${frd(S, 2)} m².`, { rel: 0.01 }),
          nombre("Largeur d'emprise du profil ?", r.largeurEmprise, "m", `Chaque talus s'étend sur ${frd(f, 1)} × ${frd(hb, 3)} = ${frd(f * hb, 2)} m ; emprise = 2 × (${frd(L, 2)} + ${frd(f * hb, 2)}) = ${frd(r.largeurEmprise, 2)} m.`, { rel: 0.01 }),
        ],
      };
    },
  },
  {
    id: "ch14-mixte", titre: "Profil mixte en flanc de coteau", difficulte: 3,
    generer(a) {
      const d = tirer(a, (a) => {
        const i = a.entre(10, 25, 1), sens = a.choix([1, -1]), z0 = a.entre(100, 150, 0.01), L = a.entre(5.5, 7.5, 0.5);
        const zAxe = +(z0 + a.entre(-0.6, 0.6, 0.05)).toFixed(2);
        const tn = [[-80, z0 + (sens * i * 80) / 100], [80, z0 - (sens * i * 80) / 100]];
        const r = profilTravers({ tn, zAxe, lg: L, ld: L, devers: 2.5, fd: 1, fr: 1.5 });
        const rhoP = a.entre(1.7, 1.85, 0.01), rhoR = a.entre(1.8, 1.95, 0.01);
        return { i, sens, z0, L, zAxe, r, rhoP, rhoR };
      }, ({ r, rhoP, rhoR }) => {
        if (!r.applicable || r.deblai < 1.5 || r.remblai < 1.5 || passages(r.tn, r.projet).length !== 1) return false;
        const bilan = r.deblai * coefficientCompactage({ rhoDplace: rhoP, rhoDremblai: rhoR }) - r.remblai;
        return Math.abs(bilan) > 0.06 * r.remblai;
      });
      const { i, sens, z0, L, zAxe, r, rhoP, rhoR } = d;
      const [xP] = passages(r.tn, r.projet), zP = coteEn(r.tn, xP);
      const noms = ["A", "B", "C", "D", "E"], pts = r.projet.map(([x, z], k) => ({ x, z, nom: noms[k] }));
      const P = { x: xP, z: zP, nom: "P" };
      // Polygones : du côté du déblai, les sommets du projet entre l'extrémité et P ; idem côté remblai.
      const cote = (gauche) => [gauche ? pts[0] : pts[4], ...pts.slice(1, 4).filter((p) => (gauche ? p.x < xP : p.x > xP)).sort((u, v) => (gauche ? u.x - v.x : v.x - u.x)), P];
      const deblaiAGauche = sens === 1; // le terrain est plus haut du côté d'où il descend : le déblai est là
      const polyD = cote(deblaiAGauche), polyR = cote(!deblaiAGauche);
      const Ct = coefficientCompactage({ rhoDplace: rhoP, rhoDremblai: rhoR });
      const OUI = "oui : il reste un excédent de déblai", NON = "non : il manque du remblai, à apporter";
      const bonne = r.deblai * Ct >= r.remblai ? OUI : NON;
      const coord = (p) => `${p.nom} (${signe(p.x)} ; ${frd(p.z, 2)})`;
      return {
        enonce: `En flanc de coteau, le terrain naturel descend vers la ${sens === 1 ? "droite" : "gauche"} avec une pente transversale régulière de ${i} % ; sa cote à l'axe vaut ${frd(z0, 2)} m. Le projet : plateforme de 2 × ${frd(L, 1)} m en toit (dévers 2,5 %), à ${frd(zAxe, 2)} m à l'axe ; talus de déblai à 1/1, de remblai à 3/2. Le calcul de l'emprise donne les sommets du projet ${pts.map(coord).join(", ")} (x depuis l'axe et z en m). Le déblai sera réemployé dans le remblai : ρd en place ${frd(rhoP, 2)} Mg/m³, ρd du remblai compacté ${frd(rhoR, 2)} Mg/m³.`,
        donnees: [...pts.map((p) => donnee(p.nom, `${signe(p.x)} m · ${frd(p.z, 2)} m`)), donnee("TN", `${i} % · ${frd(z0, 2)} m à l'axe`)],
        figure: coupeProfil(r, { points: [...pts, P] }),
        questions: [
          nombre("Abscisse du point de passage P, où le terrain naturel coupe la plateforme ?", xP, "m",
            `Sur le segment ${polyD.at(-2).nom}–${polyR.at(-2).nom} du projet, l'écart terrain − projet change de signe ; il varie linéairement, d'où x = ${signe(xP)} m (z = ${frd(zP, 2)} m).`, { abs: 0.05 }),
          nombre("Surface de déblai du profil ?", r.deblai, "m²",
            `Polygone ${polyD.map((p) => p.nom).join("–")}, fermé par le terrain naturel (rectiligne) : S = ½ |Σ (xi zi+1 − xi+1 zi)| = ${frd(aireSarrus(polyD.map((p) => [p.x, p.z])), 2)} m² (on peut retrancher une même cote à tous les z).`, { rel: 0.02 }),
          nombre("Surface de remblai du profil ?", r.remblai, "m²",
            `Polygone ${polyR.map((p) => p.nom).join("–")} : S = ½ |Σ (xi zi+1 − xi+1 zi)| = ${frd(aireSarrus(polyR.map((p) => [p.x, p.z])), 2)} m².`, { rel: 0.02 }),
          choixMelange(a, "Le déblai du profil, réemployé, suffit-il à son remblai ?", [bonne, bonne === OUI ? NON : OUI],
            `Ct = ${frd(rhoP, 2)}/${frd(rhoR, 2)} = ${frd(Ct, 3)} : ${frd(r.deblai, 2)} m² de déblai donnent ${frd(r.deblai * Ct, 2)} m² de remblai compacté, pour ${frd(r.remblai, 2)} m² à construire → ${bonne}. Un profil mixte s'équilibre d'abord transversalement, sans transport en long.`),
        ],
      };
    },
  },
  {
    id: "ch14-volumes", titre: "Volumes entre profils par la moyenne des aires", difficulte: 1,
    generer(a) {
      const pas = a.choix([20, 25, 30, 40, 50]), dansLeSens = a.reel() < 0.5;
      let D = [a.entre(35, 70, 1), a.entre(15, 34, 1), a.entre(2, 12, 1), 0, 0], R = [0, 0, a.entre(2, 12, 1), a.entre(15, 40, 1), a.entre(30, 65, 1)];
      if (!dansLeSens) { D = D.reverse(); R = R.reverse(); }
      const profils = D.map((x, k) => ({ x: k * pas, deblai: x, remblai: R[k] }));
      const v = volumes(profils);
      const t = v.troncons, k = a.choix(t.map((u, i) => i).filter((i) => t[i].deblai > 0));
      const detail = (cle) => t.map((u) => `${pas} × (${fr(profils.find((p) => p.x === u.de)[cle], 3)} + ${fr(profils.find((p) => p.x === u.a)[cle], 3)})/2 = ${fr(u[cle], 4)}`).join(" ; ");
      return {
        enonce: `Cinq profils en travers, espacés de ${pas} m, ont donné les surfaces suivantes : ${profils.map((p, i) => `P${i + 1} (x = ${p.x} m) déblai ${p.deblai} m², remblai ${p.remblai} m²`).join(" ; ")}. On admet que les surfaces varient linéairement d'un profil à l'autre.`,
        donnees: profils.map((p, i) => donnee(`P${i + 1} · x = ${p.x} m`, `D ${p.deblai} m² · R ${p.remblai} m²`)),
        questions: [
          nombre("Volume de déblai total (en place) ?", v.total.deblai, "m³", `V = Σ d (S1 + S2)/2, tronçon par tronçon : ${detail("deblai")} ; total ${fr(v.total.deblai, 5)} m³.`, { rel: 0.01 }),
          nombre("Volume de remblai total ?", v.total.remblai, "m³", `${detail("remblai")} ; total ${fr(v.total.remblai, 5)} m³.`, { rel: 0.01 }),
          nombre(`Volume de déblai entre P${k + 1} et P${k + 2} ?`, t[k].deblai, "m³", `${pas} × (${profils[k].deblai} + ${profils[k + 1].deblai})/2 = ${fr(t[k].deblai, 4)} m³.`, { rel: 0.01 }),
        ],
      };
    },
  },
  {
    id: "ch14-prismoide", titre: "Moyenne des aires ou formule des trois niveaux ?", difficulte: 2,
    generer(a) {
      const zTN = a.entre(90, 130, 0.01), L = a.entre(5, 7, 0.5), f = a.choix([1, 1.5]), d = a.choix([20, 25, 30, 40, 50]);
      const h1 = a.entre(0.5, 2.5, 0.1), h2 = +(h1 + a.entre(2, 5, 0.1)).toFixed(1), hm = (h1 + h2) / 2;
      const S = (h) => profilTravers({ tn: TN_PLAT(zTN), zAxe: zTN - h, lg: L, ld: L, devers: 0, fd: f }).deblai;
      const S1 = S(h1), Sm = S(hm), S2 = S(h2);
      const Vmoy = volumes([{ x: 0, deblai: S1, remblai: 0 }, { x: d, deblai: S2, remblai: 0 }]).total.deblai;
      const Vpri = prismoide({ d, S1, Sm, S2 }), ecart = (100 * (Vmoy - Vpri)) / Vpri;
      return {
        enonce: `Une tranchée sur terrain plat s'approfondit régulièrement : la profondeur à l'axe passe de ${frd(h1, 1)} m au profil P1 à ${frd(h2, 1)} m au profil P2, ${d} m plus loin. La plateforme est horizontale (2 × ${frd(L, 1)} m), les talus ont un fruit de ${fruit(f)} : la surface d'un profil vaut donc S = 2 L h + ${frd(f, 1)} h². On a calculé S1 = ${frd(S1, 2)} m² et S2 = ${frd(S2, 2)} m².`,
        donnees: [donnee("h1 · h2", `${frd(h1, 1)} m · ${frd(h2, 1)} m`), donnee("Distance", `${d} m`), donnee("S1 · S2", `${frd(S1, 2)} · ${frd(S2, 2)} m²`), donnee("Plateforme · talus", `2 × ${frd(L, 1)} m · ${fruit(f)}`)],
        questions: [
          nombre("Surface Sm du profil intermédiaire, à mi-distance ?", Sm, "m²", `hm = (${frd(h1, 1)} + ${frd(h2, 1)})/2 = ${frd(hm, 2)} m ; Sm = 2 × ${frd(L, 1)} × ${frd(hm, 2)} + ${frd(f, 1)} × ${frd(hm, 2)}² = ${frd(Sm, 2)} m², moins que (S1 + S2)/2 = ${frd((S1 + S2) / 2, 2)} m².`, { rel: 0.01 }),
          nombre("Volume par la moyenne des aires ?", Vmoy, "m³", `V = d (S1 + S2)/2 = ${d} × (${frd(S1, 2)} + ${frd(S2, 2)})/2 = ${fr(Vmoy, 4)} m³.`, { rel: 0.01 }),
          nombre("Volume par la formule des trois niveaux (prismoïde) ?", Vpri, "m³", `V = d (S1 + 4 Sm + S2)/6 = ${d} × (${frd(S1, 2)} + 4 × ${frd(Sm, 2)} + ${frd(S2, 2)})/6 = ${fr(Vpri, 4)} m³.`, { rel: 0.01 }),
          nombre("Surestimation de la moyenne des aires, en % du volume prismoïdal ?", ecart, "%", `(${fr(Vmoy, 4)} − ${fr(Vpri, 4)})/${fr(Vpri, 4)} = ${frd(ecart, 2)} % : la surface varie comme h², pas linéairement ; la formule des trois niveaux est exacte pour une variation parabolique.`, { abs: 0.3 }),
        ],
      };
    },
  },
  {
    id: "ch14-foisonnement", titre: "Du déblai en place au remblai compacté", difficulte: 1,
    generer(a) {
      const d = tirer(a, (a) => {
        const m = a.choix([
          { nom: "un limon", Cf: a.entre(1.15, 1.3, 0.05), rp: a.entre(1.6, 1.72, 0.01), rr: a.entre(1.74, 1.85, 0.01) },
          { nom: "une grave argileuse", Cf: a.entre(1.1, 1.25, 0.05), rp: a.entre(1.85, 1.97, 0.01), rr: a.entre(1.98, 2.1, 0.01) },
          { nom: "un calcaire abattu à l'explosif", Cf: a.entre(1.45, 1.6, 0.05), rp: a.entre(2.35, 2.5, 0.01), rr: a.entre(2.05, 2.2, 0.01) },
        ]);
        const V = a.entre(5000, 40000, 500), cap = a.entre(12, 20, 1);
        const Ct = coefficientCompactage({ rhoDplace: m.rp, rhoDremblai: m.rr }), r = foisonnement({ Vplace: V, Cf: m.Cf, Ct });
        return { m, V, cap, Ct, r };
      }, ({ r, cap }) => loinEntier(r.Vfoisonne / cap, 0.03));
      const { m, V, cap, Ct, r } = d;
      const n = Math.ceil(r.Vfoisonne / cap);
      return {
        enonce: `Un déblai de ${fr(V, 5)} m³ en place, dans ${m.nom}, part en remblai. Coefficient de foisonnement Cf = ${frd(m.Cf, 2)} ; ρd en place ${frd(m.rp, 2)} Mg/m³, ρd du remblai compacté ${frd(m.rr, 2)} Mg/m³. Les tombereaux emportent ${cap} m³ foisonnés.`,
        donnees: [donnee("Déblai en place", `${fr(V, 5)} m³`), donnee("Cf", frd(m.Cf, 2)), donnee("ρd en place · remblai", `${frd(m.rp, 2)} · ${frd(m.rr, 2)} Mg/m³`), donnee("Benne", `${cap} m³ foisonnés`)],
        questions: [
          nombre("Coefficient de compactage Ct ?", Ct, "", `Ct = ρd en place / ρd compacté = ${frd(m.rp, 2)}/${frd(m.rr, 2)} = ${frd(Ct, 3)}${Ct > 1 ? " : plus de 1, comme pour une roche, dont le remblai est moins dense que le massif" : " : moins de 1, le remblai compacté est plus dense que le sol en place"}.`, { rel: 0.01 }),
          nombre("Volume foisonné à transporter ?", r.Vfoisonne, "m³", `${fr(V, 5)} × ${frd(m.Cf, 2)} = ${fr(r.Vfoisonne, 5)} m³ foisonnés.`, { rel: 0.01 }),
          nombre("Nombre de rotations de tombereaux ?", n, "", `${fr(r.Vfoisonne, 5)} / ${cap} = ${frd(r.Vfoisonne / cap, 1)} → ${fr(n, 5)} rotations.`, { abs: 0.5 }),
          nombre("Volume de remblai compacté obtenu ?", r.Vcompacte, "m³", `${fr(V, 5)} × ${frd(Ct, 3)} = ${fr(r.Vcompacte, 5)} m³ : le transport se compte foisonné, le remblai compacté.`, { rel: 0.01 }),
        ],
      };
    },
  },
  {
    id: "ch14-besoin", titre: "Quel déblai pour construire un remblai ?", difficulte: 2,
    generer(a) {
      const Vr = a.entre(10000, 60000, 500), rp = a.entre(1.62, 1.8, 0.01), rr = a.entre(rp + 0.04, rp + 0.18, 0.01);
      const part = a.entre(0.6, 0.95, 0.05), Cf = a.entre(1.15, 1.3, 0.05);
      const Ct = coefficientCompactage({ rhoDplace: rp, rhoDremblai: rr });
      const utile = Vr / Ct, total = utile / part, depot = total - utile;
      const verif = foisonnement({ Vplace: utile, Cf, Ct });
      return {
        enonce: `Il faut ${fr(Vr, 5)} m³ de remblai compacté. Le déblai voisin a une masse volumique sèche en place de ${frd(rp, 2)} Mg/m³ et sera compacté à ${frd(rr, 2)} Mg/m³ ; d'après son classement GTR et ses conditions d'utilisation, seule une part ${frd(part, 2)} de ce déblai est réutilisable en remblai, le reste partant en dépôt. Foisonnement Cf = ${frd(Cf, 2)}.`,
        donnees: [donnee("Remblai compacté", `${fr(Vr, 5)} m³`), donnee("ρd en place · compacté", `${frd(rp, 2)} · ${frd(rr, 2)} Mg/m³`), donnee("Part réutilisable", frd(part, 2)), donnee("Cf", frd(Cf, 2))],
        questions: [
          nombre("Volume de déblai réutilisable nécessaire (en place) ?", utile, "m³", `Ct = ${frd(rp, 2)}/${frd(rr, 2)} = ${frd(Ct, 3)} ; V = ${fr(Vr, 5)} / ${frd(Ct, 3)} = ${fr(utile, 5)} m³ (contrôle : ${fr(utile, 5)} × ${frd(Ct, 3)} = ${fr(verif.Vcompacte, 5)} m³).`, { rel: 0.01 }),
          nombre("Volume total à extraire (en place) ?", total, "m³", `${fr(utile, 5)} / ${frd(part, 2)} = ${fr(total, 5)} m³.`, { rel: 0.01 }),
          nombre("Volume mis en dépôt (en place) ?", depot, "m³", `${fr(total, 5)} − ${fr(utile, 5)} = ${fr(depot, 5)} m³ de matériaux non réutilisables.`, { rel: 0.015 }),
          nombre("Volume foisonné transporté vers le remblai ?", verif.Vfoisonne, "m³", `${fr(utile, 5)} × ${frd(Cf, 2)} = ${fr(verif.Vfoisonne, 5)} m³ foisonnés.`, { rel: 0.01 }),
        ],
      };
    },
  },
  {
    id: "ch14-epure", titre: "Épure de Lalanne : volumes cumulés et solde", difficulte: 2,
    generer(a) {
      const d = tirer(a, (a) => {
        const pas = a.choix([40, 50]), k = a.entier(3, 4), n = 8;
        const D = Array.from({ length: n }, (_, i) => (i === 0 ? a.entre(0, 10, 1) : i < k ? a.entre(15, 60, 1) : i === k ? a.entre(2, 10, 1) : 0));
        const R = Array.from({ length: n }, (_, i) => (i < k ? 0 : i === k ? a.entre(2, 10, 1) : i === n - 1 ? a.entre(0, 10, 1) : a.entre(15, 60, 1)));
        const profils = D.map((x, i) => ({ x: i * pas, deblai: x, remblai: R[i] }));
        const reemploi = a.entre(0.7, 1, 0.05), Ct = a.entre(0.9, 1, 0.01);
        const v = volumes(profils), e = epure(v.troncons, { reemploi, Ct });
        return { pas, profils, reemploi, Ct, v, e };
      }, ({ e, v }) => Math.abs(e.solde) > 0.06 * v.total.remblai);
      const { profils, reemploi, Ct, v, e } = d;
      const ys = e.points.map((p) => p[1]), iMax = ys.indexOf(Math.max(...ys)), xMax = e.points[iMax][0];
      const absc = e.points.map((p) => `x = ${p[0]} m`);
      const autresX = [iMax - 1, iMax + 1, iMax - 2, iMax + 2, e.points.length - 1].filter((j) => j >= 0 && j < e.points.length && j !== iMax).slice(0, 3).map((j) => absc[j]);
      const DEPOT = "mettre l'excédent en dépôt", EMPRUNT = "emprunter le déficit", RIEN = "rien : déblais et remblais s'équilibrent";
      const bonne = e.solde > 0 ? DEPOT : EMPRUNT;
      const terme = (u) => `${fr(u.deblai, 4)} × ${frd(reemploi, 2)} × ${frd(Ct, 2)} − ${fr(u.remblai, 4)} = ${signe(u.deblai * reemploi * Ct - u.remblai, 0)}`;
      return {
        enonce: `Sur une section de tracé, les profils en travers donnent : ${profils.map((p, i) => `P${i + 1} (x = ${p.x} m) déblai ${p.deblai} m², remblai ${p.remblai} m²`).join(" ; ")}. Une part ${frd(reemploi, 2)} du déblai est réutilisable, avec un coefficient de compactage Ct = ${frd(Ct, 2)}. On trace l'épure de Lalanne : à chaque tronçon, y augmente du déblai réutilisable converti en remblai compacté et diminue du remblai.`,
        donnees: [...profils.map((p, i) => donnee(`P${i + 1} · x = ${p.x} m`, `D ${p.deblai} · R ${p.remblai} m²`)), donnee("Réemploi · Ct", `${frd(reemploi, 2)} · ${frd(Ct, 2)}`)],
        questions: [
          nombre("Ordonnée maximale de l'épure ?", ys[iMax], "m³", `Volumes des tronçons par la moyenne des aires, puis cumul de (déblai × ${frd(reemploi, 2)} × ${frd(Ct, 2)} − remblai) : ${v.troncons.slice(0, iMax).map(terme).join(" ; ")} → y = ${fr(ys[iMax], 4)} m³ au sommet.`, { rel: 0.015 }),
          choixMelange(a, "Où se trouve le sommet de l'épure ?", [absc[iMax], ...autresX],
            `La courbe monte tant que le déblai l'emporte et descend ensuite : le sommet est au passage du déblai au remblai, ${absc[iMax]} (profil P${iMax + 1}).`),
          nombre("Solde de la section (négatif en cas de déficit) ?", e.solde, "m³", `Ordonnée finale de l'épure : ${fr(v.total.deblai, 5)} × ${frd(reemploi, 2)} × ${frd(Ct, 2)} − ${fr(v.total.remblai, 5)} = ${signe(e.solde, 0)} m³.`, { rel: 0.02 }),
          choixMelange(a, "Que faire de ce solde ?", [bonne, ...[DEPOT, EMPRUNT, RIEN].filter((x) => x !== bonne)],
            `Solde ${e.solde > 0 ? "positif : excédent" : "négatif : déficit"} de ${fr(Math.abs(e.solde), 4)} m³ → ${bonne}.`),
        ],
      };
    },
  },
  {
    id: "ch14-repartition", titre: "Ligne de répartition : volume et distance de transport", difficulte: 3,
    generer(a) {
      const d = tirer(a, (a) => {
        const pas = a.choix([40, 50, 60]), k1 = a.entier(2, 4), k2 = a.entier(3, 5), remonte = a.reel() < 0.5;
        const ys = [0];
        for (let i = 0; i < k1; i++) ys.push(ys.at(-1) + a.entre(300, 1500, 50));
        const M = ys.at(-1), descente = M * a.entre(1.25, 1.8, 0.05);
        const parts = Array.from({ length: k2 }, () => a.entre(1, 3, 0.5)), somme = parts.reduce((s, x) => s + x, 0);
        for (const p of parts) ys.push(Math.round((ys.at(-1) - (descente * p) / somme) / 10) * 10);
        if (remonte) { const m = ys.at(-1); ys.push(Math.round((m + -m * a.entre(0.7, 1.0, 0.05)) / 10) * 10); ys.push(Math.round((ys.at(-1) + -m * a.entre(0.6, 1.0, 0.05)) / 10) * 10); }
        const points = ys.map((y, i) => [i * pas, y]);
        return { pas, points, rep: repartition(points, 0) };
      }, ({ rep, points }) => rep.boucles.length >= 1 && Math.abs(rep.fin) > 100 && points.every((p, i) => i === 0 || p[1] !== 0));
      const { points, rep } = d;
      const b = rep.boucles[0], xc = rep.coupes[1];
      const avant = points.filter(([x]) => x < xc), dernier = avant.at(-1);
      const trapezes = avant.slice(1).map(([x, y], i) => `${x - avant[i][0]} × (${frs(avant[i][1], 4)} + ${frs(y, 4)})/2`);
      const fin = rep.fin, DEP = `${fr(Math.abs(fin), 4)} m³ à mettre en dépôt en fin de section`, EMP = `${fr(Math.abs(fin), 4)} m³ à emprunter en fin de section`;
      const bonneFin = fin > 0 ? DEP : EMP;
      return {
        enonce: `L'épure de Lalanne d'une section a pour points (abscisse ; volume cumulé) : ${points.map(([x, y]) => `(${x} m ; ${frs(y, 5)} m³)`).join(", ")}. Elle est linéaire entre deux points. On prend pour ligne de répartition l'axe des abscisses (y = 0) : entre deux points de coupe, déblais et remblais s'équilibrent.`,
        donnees: points.map(([x, y]) => donnee(`x = ${x} m`, `${frs(y, 5)} m³`)),
        figure: figureEpure(points, 0),
        questions: [
          nombre("Abscisse où la courbe recoupe la ligne de répartition ?", xc, "m", `Entre x = ${dernier[0]} m (y = ${fr(dernier[1], 4)}) et le point suivant, interpolation linéaire : x = ${fr(xc, 4)} m.`, { rel: 0.01 }),
          nombre("Volume transporté dans cette première boucle ?", b.volume, "m³", `C'est l'écart maximal entre la courbe et la ligne : ${fr(b.volume, 4)} m³, transportés ${b.sens}.`, { rel: 0.01 }),
          nombre("Moment de transport de la boucle ?", b.moment, "m³·m", `Aire entre la courbe et la ligne, de 0 à ${fr(xc, 4)} m : ${trapezes.join(" + ")} + ${frd(xc - dernier[0], 1)} × ${fr(dernier[1], 4)}/2 = ${fr(b.moment, 4)} m³·m.`, { rel: 0.02 }),
          nombre("Distance moyenne de transport ?", b.distance, "m", `d = moment / volume = ${fr(b.moment, 4)} / ${fr(b.volume, 4)} = ${fr(b.distance, 3)} m.`, { rel: 0.02 }),
          choixMelange(a, "Et au bout de la section ?", [bonneFin, bonneFin === DEP ? EMP : DEP, "rien : la ligne équilibre toute la section"],
            `L'épure finit à ${frs(points.at(-1)[1], 4)} m³, ${fin > 0 ? "au-dessus" : "au-dessous"} de la ligne : ${bonneFin}.`),
        ],
      };
    },
  },
];
