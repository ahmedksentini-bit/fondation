// Exercices du chapitre 9 : la stabilité des talus — fruit et pente, talus
// infini sec et avec écoulement parallèle à la pente, méthode de Bishop
// simplifiée (une tranche, cinq tranches sur un cercle imposé) et choix d'une
// pente à partir de cercles critiques. Pour rester rapide, cercleCritique ne
// tourne que sur une grille réduite (maille 6) ; les calculs à la main se font
// sur des cercles imposés, contrôlés par bishop().
import { frd, nombre, choixMelange, donnee } from "./alea.js";
import { penteInfinie, bishop, cercleCritique, surfaceTalus } from "../gtr/stabilite.js";
import { RAD } from "../gtr/outils.js";
import { svg, ligne, texte, graphe, COULEURS } from "../figures.js";

const GW = 9.81;
const FRUITS = [[1, "1/1"], [1.25, "5/4"], [1.5, "3/2"], [1.75, "7/4"], [2, "2/1"], [2.5, "5/2"], [3, "3/1"], [3.5, "7/2"]];
const nomFruit = (f) => FRUITS.find(([x]) => Math.abs(x - f) < 1e-9)?.[1] ?? frd(f, 2);
const pente = (f) => Math.atan(1 / f) / RAD;

/**
 * Une tranche de la méthode de Bishop simplifiée, écrite comme dans bishop()
 * de src/gtr/stabilite.js : poids W = γ h b, pression interstitielle
 * u = ru γ h, mα = cos α (1 + tan α tan φ'/F), terme résistant
 * (c' b + (W − u b) tan φ')/mα et terme moteur W sin α. Solveur local, pour
 * le calcul à la main (angles en degrés).
 */
export function trancheBishop({ b, h, alpha, gamma, c, phi, ru = 0, F }) {
  const W = gamma * h * b, u = ru * gamma * h, al = alpha * RAD, tp = Math.tan(phi * RAD);
  const m = Math.cos(al) * (1 + (Math.tan(al) * tp) / F);
  return { W, u, m, resistant: (c * b + (W - u * b) * tp) / m, moteur: W * Math.sin(al) };
}

/**
 * Méthode de Bishop simplifiée sur des tranches données [{ b, h, alpha }] :
 * F = Σ [c' b + (W − u b) tan φ']/mα / Σ W sin α, itéré à partir de F0.
 * Renvoie F1 (première itération), F convergé, le terme moteur Σ W sin α et le plus
 * petit mα. Solveur local : bishop() découpe le cercle en 40 tranches.
 */
export function bishopTranches(tranches, { c, phi, gamma, ru = 0, F0 = 1 }) {
  const moteur = tranches.reduce((s, t) => s + trancheBishop({ ...t, gamma, c, phi, ru, F: 1 }).moteur, 0);
  const iterer = (F) => tranches.reduce((s, t) => s + trancheBishop({ ...t, gamma, c, phi, ru, F }).resistant, 0) / moteur;
  const F1 = iterer(F0);
  let F = F1;
  for (let k = 0; k < 200; k++) { const Fn = iterer(F); if (Math.abs(Fn - F) < 1e-9) { F = Fn; break; } F = Fn; }
  const mMin = Math.min(...tranches.map((t) => trancheBishop({ ...t, gamma, c, phi, ru, F }).m));
  return { F, F1, moteur, mMin };
}

const VERDICTS_F = ["F ≥ 1,5 : talus stable, marge suffisante", "1 ≤ F < 1,5 : talus stable mais marge faible", "F < 1 : le talus glisse"];
const verdictF = (F) => VERDICTS_F[F >= 1.5 ? 0 : F >= 1 ? 1 : 2];

// ───────────────────────────── Figures ─────────────────────────────

/** Coupe d'un talus : pied en (0, 0), crête en (f H, H), cotes de hauteur et d'emprise, angle de pente. */
function coupeTalus({ H, f }) {
  const L = f * H, W = 560, x0 = -0.3 * L - 1, x1 = 1.4 * L + 1.5;
  const k = Math.min((W - 110) / (x1 - x0), 150 / H);
  const haut = 24, sol = 12, bas = 46, Hh = Math.round(haut + H * k + sol + bas);
  const gauche = (W - (x1 - x0) * k - 40) / 2;
  const X = (x) => gauche + (x - x0) * k, Y = (y) => haut + (H - y) * k;
  const fleches = (id) => `marker-start="url(#${id}-fc)" marker-end="url(#${id}-fc)"`;
  return svg({ largeur: W, hauteur: Hh, titre: "Coupe du talus", contenu: (id) => {
    let s = `<rect x="${X(x0).toFixed(1)}" y="${Y(0).toFixed(1)}" width="${((x1 - x0) * k).toFixed(1)}" height="${sol}" fill="#b39b78"/>`;
    s += `<rect x="${X(x0).toFixed(1)}" y="${Y(0).toFixed(1)}" width="${((x1 - x0) * k).toFixed(1)}" height="${sol}" fill="url(#${id}-terre)"/>`;
    const corps = [[0, 0], [L, H], [x1, H], [x1, 0]].map(([x, y]) => `${X(x).toFixed(1)} ${Y(y).toFixed(1)}`).join("L");
    s += `<path d="M${corps}Z" fill="#eadfd2"/><path d="M${corps}Z" fill="url(#${id}-remblai)" stroke="#7c6a58" stroke-width="1.4"/>`;
    s += ligne(X(x0), Y(0), X(0), Y(0), "#7c6a58", 1.4);
    // Hauteur, à droite du remblai ; emprise, sous le terrain naturel.
    s += ligne(X(x1) + 14, Y(0), X(x1) + 14, Y(H), COULEURS.cote, 1.1, fleches(id));
    s += texte(X(x1) + 20, Y(H / 2) + 4, "H", 'style="font-weight:800;fill:#2b2d42"');
    const yc = Y(0) + sol + 14;
    s += ligne(X(0), Y(0), X(0), yc + 5, "#94a3b8", 0.9, 'stroke-dasharray="3 3"') + ligne(X(L), Y(H), X(L), yc + 5, "#94a3b8", 0.9, 'stroke-dasharray="3 3"');
    s += ligne(X(0), yc, X(L), yc, COULEURS.cote, 1.1, fleches(id));
    s += texte((X(0) + X(L)) / 2, yc + 17, "emprise du talus L", 'text-anchor="middle" class="halo" style="font-size:11.5px;font-weight:700;fill:#2b2d42"');
    // Angle β au pied, et le fruit le long de la pente.
    const r = 30, b = Math.atan(1 / f);
    s += `<path d="M${(X(0) + r).toFixed(1)} ${Y(0).toFixed(1)}A${r} ${r} 0 0 0 ${(X(0) + r * Math.cos(b)).toFixed(1)} ${(Y(0) - r * Math.sin(b)).toFixed(1)}" fill="none" stroke="${COULEURS.rouge}" stroke-width="1.6"/>`;
    s += texte(X(0) + r + 5, Y(0) - 4, "β", `class="halo" style="font-weight:800;fill:${COULEURS.rouge}"`);
    s += texte(X(L / 2) - 10, Y(H / 2) - 10, `fruit ${nomFruit(f)}`, 'text-anchor="end" class="halo" style="font-size:12px;font-weight:800;fill:#475569"');
    s += texte(X(0), Y(0) - 8, "pied", 'text-anchor="end" class="pt halo"') + texte(X(L), Y(H) - 8, "crête", 'text-anchor="middle" class="pt halo"');
    return s;
  } });
}

/** Coupe d'un talus avec le cercle de glissement et ses tranches numérotées. */
function coupeBishop({ H, f }, cercle, bornes) {
  const L = f * H, { xc, yc, R } = cercle, ys = surfaceTalus({ H, f });
  const arc = (x) => yc - Math.sqrt(Math.max(0, R * R - (x - xc) ** 2));
  const x2 = bornes.at(-1);
  const x0 = Math.min(-0.5 * H, xc - 0.2 * H), x1 = Math.max(x2 + 0.5 * H, L + 0.8 * H);
  const yTop = Math.max(H, yc) + 0.15 * H, yBas = Math.min(-0.15 * H, arc(xc) - 0.15 * H);
  const W = 560, Hh = 320, k = Math.min((W - 50) / (x1 - x0), (Hh - 20) / (yTop - yBas));
  const gauche = (W - 40 - (x1 - x0) * k) / 2;
  const X = (x) => gauche + (x - x0) * k, Y = (y) => Hh - 10 - (y - yBas) * k;
  return svg({ largeur: W, hauteur: Hh, titre: "Cercle de glissement et tranches", contenu: (id) => {
    const sol = [[x0, 0], [0, 0], [L, H], [x1, H], [x1, yBas], [x0, yBas]];
    let s = `<path d="M${sol.map(([x, y]) => `${X(x).toFixed(1)} ${Y(y).toFixed(1)}`).join("L")}Z" fill="#e7dcc8" stroke="#8b7355" stroke-width="1.2"/>`;
    s += `<path d="M${sol.map(([x, y]) => `${X(x).toFixed(1)} ${Y(y).toFixed(1)}`).join("L")}Z" fill="url(#${id}-argile)"/>`;
    const n = 80, haut = [], bas = [];
    for (let i = 0; i <= n; i++) { const x = bornes[0] + ((x2 - bornes[0]) * i) / n; haut.push([x, ys(x)]); bas.push([x, arc(x)]); }
    s += `<path d="M${[...haut, ...bas.reverse()].map(([x, y]) => `${X(x).toFixed(1)} ${Y(y).toFixed(1)}`).join("L")}Z" fill="#fca5a5" fill-opacity=".5" stroke="${COULEURS.rouge}" stroke-width="2"/>`;
    for (const x of bornes.slice(1, -1)) s += ligne(X(x), Y(ys(x)), X(x), Y(arc(x)), "#7f1d1d", 1.1);
    for (let i = 0; i < bornes.length - 1; i++) {
      const xm = (bornes[i] + bornes[i + 1]) / 2;
      s += texte(X(xm), (Y(ys(xm)) + Y(arc(xm))) / 2 + 4, String(i + 1), 'text-anchor="middle" class="halo" style="font-weight:900;fill:#7f1d1d"');
    }
    s += ligne(X(xc), Y(yc), X(bornes[0]), Y(ys(bornes[0])), "#94a3b8", 1, 'stroke-dasharray="4 3"') + ligne(X(xc), Y(yc), X(x2), Y(ys(x2)), "#94a3b8", 1, 'stroke-dasharray="4 3"');
    s += `<circle cx="${X(xc).toFixed(1)}" cy="${Y(yc).toFixed(1)}" r="4" fill="${COULEURS.rouge}"/>`;
    s += texte(X(xc) + 8, Y(yc) - 6, `O (${frd(xc, 1)} ; ${frd(yc, 1)})`, `class="halo" style="font-weight:800;fill:${COULEURS.rouge}"`);
    s += ligne(X(x1) + 12, Y(0), X(x1) + 12, Y(H), COULEURS.cote, 1, `marker-start="url(#${id}-fc)" marker-end="url(#${id}-fc)"`);
    s += ligne(X(x1) - 12, Y(0), X(x1) + 18, Y(0), "#94a3b8", 0.8, 'stroke-dasharray="3 3"');
    s += texte(X(x1) + 18, Y(H / 2) + 4, "H", 'style="font-size:12px;font-weight:800;fill:#2b2d42"');
    s += texte(X(L / 2) - 10, Y(H / 2) - 8, nomFruit(f), 'text-anchor="end" class="halo" style="font-size:11.5px;font-weight:700;fill:#475569"');
    return s;
  } });
}

// ───────────────────────────── Modèles ─────────────────────────────

export default [
  {
    id: "ch9-fruit", titre: "Fruit, pente et emprise d'un talus", difficulte: 1,
    generer(a) {
      const [f, nom] = a.choix(FRUITS.slice(0, 7)), H = a.entre(2, 12, 0.5);
      const beta = pente(f), L = f * H, rampant = H * Math.hypot(1, f);
      return {
        enonce: `Un talus de remblai de ${frd(H, 1)} m de hauteur est réglé au fruit ${nom} (${nom.split("/")[0]} de base pour ${nom.split("/")[1]} de hauteur).`,
        donnees: [donnee("Hauteur H", `${frd(H, 1)} m`), donnee("Fruit", nom)],
        figure: coupeTalus({ H, f }),
        questions: [
          nombre("Angle de pente β ?", beta, "°", `tan β = hauteur/base = 1/${frd(f, 2)} ; β = arctan(${frd(1 / f, 3)}) = ${frd(beta, 1)}°.`, { abs: 0.2 }),
          nombre("Pente en pourcentage ?", 100 / f, "%", `100 × 1/${frd(f, 2)} = ${frd(100 / f, 1)} % : ${frd(100 / f, 1)} cm de dénivelé par mètre horizontal.`, { rel: 0.01 }),
          nombre("Emprise horizontale du talus L ?", L, "m", `L = fruit × H = ${frd(f, 2)} × ${frd(H, 1)} = ${frd(L, 2)} m, de chaque côté du remblai.`, { rel: 0.01 }),
          nombre("Longueur du talus, du pied à la crête (à engazonner) ?", rampant, "m", `√(H² + L²) = √(${frd(H, 1)}² + ${frd(L, 2)}²) = ${frd(rampant, 2)} m par mètre de remblai.`, { rel: 0.01 }),
        ],
      };
    },
  },
  {
    id: "ch9-sec", titre: "Talus infini sec dans un sable", difficulte: 1,
    generer(a) {
      let phi, f, nom, beta, F;
      for (let i = 0; i < 50; i++) {
        phi = a.entre(28, 40, 1); [f, nom] = a.choix(FRUITS.slice(1));
        beta = pente(f); F = penteInfinie({ phi, beta });
        if (Math.abs(F - 1.5) > 0.03 && Math.abs(F - 1) > 0.03) break;
      }
      const fMin = 1.5 / Math.tan(phi * RAD);
      return {
        enonce: `Talus de remblai en sable propre sans cohésion, d'angle de frottement φ' = ${phi}°, réglé au fruit ${nom}. On étudie un glissement superficiel parallèle à la pente, le talus étant sec.`,
        donnees: [donnee("φ'", `${phi}°`), donnee("Fruit", nom)],
        questions: [
          nombre("Angle de pente β ?", beta, "°", `β = arctan(1/${frd(f, 2)}) = ${frd(beta, 1)}°.`, { abs: 0.2 }),
          nombre("Coefficient de sécurité F (talus infini sec) ?", F, "", `F = tan φ'/tan β = tan ${phi}°/tan ${frd(beta, 1)}° = ${frd(Math.tan(phi * RAD), 3)}/${frd(1 / f, 3)} = ${frd(F, 2)}.`, { rel: 0.015 }),
          choixMelange(a, "Verdict ?", [verdictF(F), ...VERDICTS_F.filter((x) => x !== verdictF(F))],
            `F = ${frd(F, 2)}. À sec, un talus de sable tient tant que sa pente reste sous l'angle de frottement (β = ${frd(beta, 1)}° ${beta < phi ? "<" : ">"} φ' = ${phi}°) ; on vise en général F ≥ 1,5.`),
          nombre("Fruit minimal pour F = 1,5 ?", fMin, "H/V", `F = tan φ'/tan β = 1,5 ⇔ tan β = tan φ'/1,5 ⇔ fruit = 1/tan β = 1,5/tan φ' = 1,5/${frd(Math.tan(phi * RAD), 3)} = ${frd(fMin, 2)}.`, { rel: 0.015 }),
        ],
      };
    },
  },
  {
    id: "ch9-eau", titre: "Talus infini : l'effet d'un écoulement parallèle à la pente", difficulte: 2,
    generer(a) {
      let phi, f, nom, beta, g, Fs, Fe;
      for (let i = 0; i < 80; i++) {
        phi = a.entre(28, 42, 1); [f, nom] = a.choix(FRUITS.slice(1)); g = a.entre(18.5, 22, 0.5);
        beta = pente(f);
        Fs = penteInfinie({ phi, beta }); Fe = penteInfinie({ phi, beta, ecoulement: true, gamma: g, gammaW: GW });
        if (Math.abs(Fs - 1) > 0.03 && Math.abs(Fe - 1) > 0.03) break;
      }
      const cas = Fs < 1 ? 2 : Fe < 1 ? 1 : 0;
      const VERDICTS = ["le talus garde une marge, même avec l'écoulement (F ≥ 1)", "il tient à sec, mais glisse dès qu'une nappe s'écoule le long de la pente", "il glisse même à sec : la pente dépasse l'angle de frottement", "il glisse à sec, mais tient avec l'écoulement"];
      const fMin = g / ((g - GW) * Math.tan(phi * RAD));
      return {
        enonce: `Talus de remblai en matériau grenu sans cohésion (φ' = ${phi}°, γsat = ${frd(g, 1)} kN/m³), réglé au fruit ${nom}. Après de fortes pluies, une nappe perchée peut s'écouler parallèlement à la pente (γw = 9,81 kN/m³).`,
        donnees: [donnee("φ'", `${phi}°`), donnee("Fruit", nom), donnee("γsat", `${frd(g, 1)} kN/m³`)],
        questions: [
          nombre("F à sec ?", Fs, "", `F = tan ${phi}°/tan ${frd(beta, 1)}° = ${frd(Fs, 2)}.`, { rel: 0.015 }),
          nombre("F avec écoulement parallèle à la pente ?", Fe, "", `F = (γ'/γsat) tan φ'/tan β = (${frd(g - GW, 2)}/${frd(g, 1)}) × ${frd(Fs, 2)} = ${frd(Fe, 2)} : la pression de l'eau réduit la contrainte effective et divise la marge par ${frd(Fs / Fe, 2)}.`, { rel: 0.015 }),
          choixMelange(a, "Verdict ?", [VERDICTS[cas], ...VERDICTS.filter((_, i) => i !== cas)],
            `À sec F = ${frd(Fs, 2)}, avec écoulement F = ${frd(Fe, 2)} : ${VERDICTS[cas]}.${cas === 1 ? " Drainer le talus ou adoucir la pente." : ""}`),
          nombre("Fruit minimal pour que le talus tienne (F = 1) avec l'écoulement ?", fMin, "H/V", `F = 1 ⇔ tan β = (γ'/γsat) tan φ' ⇔ fruit = γsat/(γ' tan φ') = ${frd(g, 1)}/(${frd(g - GW, 2)} × ${frd(Math.tan(phi * RAD), 3)}) = ${frd(fMin, 2)}.`, { rel: 0.015 }),
        ],
      };
    },
  },
  {
    id: "ch9-tranche", titre: "Une tranche de la méthode de Bishop", difficulte: 2,
    generer(a) {
      let p, r;
      for (let i = 0; i < 50; i++) {
        p = { b: a.entre(1, 2.5, 0.1), h: a.entre(1.5, 8, 0.1), alpha: a.entre(-12, 45, 1), gamma: a.entre(18, 21, 0.5), c: a.entre(0, 15, 1), phi: a.entre(20, 34, 1), ru: a.choix([0.1, 0.2, 0.3]), F: a.entre(1.1, 1.6, 0.05) };
        r = trancheBishop(p);
        if (r.m > 0.4 && p.alpha !== 0) break;
      }
      const { b, h, alpha, gamma, c, phi, ru, F } = p;
      const tp = Math.tan(phi * RAD);
      return {
        enonce: `Dans une étude de stabilité par la méthode de Bishop, une tranche de largeur b = ${frd(b, 1)} m a une hauteur moyenne h = ${frd(h, 1)} m ; la base de la tranche est inclinée de α = ${alpha}° sur l'horizontale. Sol : γ = ${frd(gamma, 1)} kN/m³, c' = ${c} kPa, φ' = ${phi}°, rapport de pression interstitielle ru = ${frd(ru, 1)}. On en est à l'itération où F = ${frd(F, 2)}.`,
        donnees: [donnee("b · h", `${frd(b, 1)} m · ${frd(h, 1)} m`), donnee("α", `${alpha}°`), donnee("γ · c' · φ'", `${frd(gamma, 1)} kN/m³ · ${c} kPa · ${phi}°`), donnee("ru", frd(ru, 1)), donnee("F de l'itération", frd(F, 2))],
        questions: [
          nombre("Poids de la tranche W ?", r.W, "kN/m", `W = γ h b = ${frd(gamma, 1)} × ${frd(h, 1)} × ${frd(b, 1)} = ${frd(r.W, 1)} kN/m.`, { rel: 0.01 }),
          nombre("Pression interstitielle u à la base ?", r.u, "kPa", `u = ru γ h = ${frd(ru, 1)} × ${frd(gamma, 1)} × ${frd(h, 1)} = ${frd(r.u, 1)} kPa.`, { rel: 0.01 }),
          nombre("Facteur mα ?", r.m, "", `mα = cos α (1 + tan α tan φ'/F) = ${frd(Math.cos(alpha * RAD), 3)} × (1 + ${frd(Math.tan(alpha * RAD), 3)} × ${frd(tp, 3)}/${frd(F, 2)}) = ${frd(r.m, 3)}.`, { rel: 0.01 }),
          nombre("Terme résistant (c' b + (W − u b) tan φ')/mα ?", r.resistant, "kN/m", `(${c} × ${frd(b, 1)} + (${frd(r.W, 1)} − ${frd(r.u, 1)} × ${frd(b, 1)}) × ${frd(tp, 3)})/${frd(r.m, 3)} = ${frd(r.resistant, 1)} kN/m.`, { rel: 0.02 }),
          nombre("Terme moteur W sin α ?", r.moteur, "kN/m", `${frd(r.W, 1)} × sin ${alpha}° = ${frd(r.moteur, 1)} kN/m${alpha < 0 ? " : négatif, cette tranche de pied retient la masse au lieu de la pousser" : ""}.`, { rel: 0.02 }),
        ],
      };
    },
  },
  {
    id: "ch9-projet", titre: "Choisir la pente d'un remblai en sol fin", difficulte: 2,
    generer(a) {
      const fruits = [[1.5, "3/2"], [2, "2/1"], [2.5, "5/2"], [3, "3/1"]];
      for (let essai = 0; essai < 40; essai++) {
        const H = a.entre(6, 14, 1), c = a.entre(5, 20, 1), phi = a.entre(20, 30, 1), ru = a.choix([0.2, 0.3, 0.4]);
        // Grille réduite (maille 6) : quelques millisecondes par cercle critique ; F arrondi tel qu'il est affiché.
        const Fcrit = (f, r) => { const x = cercleCritique({ H, f, c, phi, gamma: 20, ru: r, maille: 6 }); return x.applicable ? +x.F.toFixed(2) : NaN; };
        const Fsec = fruits.map(([f]) => Fcrit(f, 0)), Feau = fruits.map(([f]) => Fcrit(f, ru));
        const croissant = (t) => t.every((x, i) => !i || x > t[i - 1]);
        if (!croissant(Fsec) || !croissant(Feau) || [...Fsec, ...Feau].some((x) => !Number.isFinite(x))) continue;
        const choix1 = Fsec.findIndex((x) => x >= 1.5), choix2 = Feau.findIndex((x) => x >= 1.5);
        if (choix1 < 0) continue;
        const AUCUN = "aucun des fruits étudiés : drainer, renforcer ou adoucir encore";
        const options = [...fruits.map(([, n]) => `fruit ${n}`), AUCUN];
        const bon1 = options[choix1], bon2 = choix2 < 0 ? AUCUN : options[choix2];
        const i21 = 1;
        const q = [
          choixMelange(a, "Fruit le plus raide qui donne F ≥ 1,5 à long terme (ru = 0) ?", [bon1, ...options.filter((x) => x !== bon1)],
            `F à long terme : ${fruits.map(([, n], i) => `${n} → ${frd(Fsec[i], 2)}`).join(" ; ")}. Le fruit ${fruits[choix1][1]} est le plus raide à atteindre 1,5 : on n'adoucit pas au-delà du nécessaire, chaque cran de fruit coûte de l'emprise et du volume.`),
          choixMelange(a, `Et si l'on veut F ≥ 1,5 juste après la construction (ru = ${frd(ru, 1)}) ?`, [bon2, ...options.filter((x) => x !== bon2)],
            `F avec ru = ${frd(ru, 1)} : ${fruits.map(([, n], i) => `${n} → ${frd(Feau[i], 2)}`).join(" ; ")} → ${bon2}. Un sol fin compacté humide garde des pressions interstitielles pendant et juste après la construction : c'est souvent le moment le plus critique.`),
          nombre(`Perte relative de F due à ru = ${frd(ru, 1)}, au fruit 2/1 ?`, 100 * (1 - Feau[i21] / Fsec[i21]), "%", `1 − ${frd(Feau[i21], 2)}/${frd(Fsec[i21], 2)} = ${frd(100 * (1 - Feau[i21] / Fsec[i21]), 1)} % : la pression interstitielle retranche u b de la force normale dans le terme de frottement.`, { abs: 1 }),
        ];
        if (choix2 >= 0 && choix2 !== choix1) q.push(nombre("Emprise supplémentaire au pied de chaque talus pour tenir aussi juste après la construction ?", (fruits[choix2][0] - fruits[choix1][0]) * H, "m", `(${frd(fruits[choix2][0], 1)} − ${frd(fruits[choix1][0], 1)}) × ${H} = ${frd((fruits[choix2][0] - fruits[choix1][0]) * H, 1)} m de chaque côté — ou bien drainer le remblai pendant sa construction, ou le monter plus lentement.`, { rel: 0.01 }));
        return {
          enonce: `Remblai de ${H} m en sol fin compacté (c' = ${c} kPa, φ' = ${phi}°, γ = 20 kN/m³) sur un terrain de même nature. Le bureau d'études a cherché, pour quatre fruits, le cercle critique de Bishop à long terme (talus drainé, ru = 0) et juste après la construction (ru = ${frd(ru, 1)}). On vise F ≥ 1,5.`,
          donnees: fruits.map(([, n], i) => donnee(`Fruit ${n}`, `F = ${frd(Fsec[i], 2)} (ru = 0) · ${frd(Feau[i], 2)} (ru = ${frd(ru, 1)})`)),
          figure: graphe({
            largeur: 560, hauteur: 250, xmin: 1.25, xmax: 3.25, ymin: 0, ymax: Math.max(2.5, Math.ceil(Math.max(...Fsec) * 2 + 0.5) / 2), pasX: 0.5, pasY: 0.5,
            xlabel: "fruit du talus (base / hauteur)", ylabel: "F du cercle critique",
            zones: [{ x0: 1.25, x1: 3.25, y0: 0, y1: 1, couleur: "#dc2626", opacite: 0.07, libelle: "F < 1 : rupture", position: "droite" }],
            series: [
              { points: fruits.map(([f], i) => [f, Fsec[i]]), couleur: COULEURS.bleu, epaisseur: 2.2, marqueurs: true, libelle: "long terme (ru = 0)" },
              { points: fruits.map(([f], i) => [f, Feau[i]]), couleur: COULEURS.eau, epaisseur: 2.2, tirets: "6 4", marqueurs: true, libelle: `fin de construction (ru = ${frd(ru, 1)})` },
              { points: [[1.25, 1.5], [3.25, 1.5]], couleur: "#64748b", epaisseur: 1.2, tirets: "3 3", libelle: "F = 1,5" },
            ],
          }),
          questions: q,
        };
      }
      throw new Error("ch9-projet : aucun tirage exploitable");
    },
  },
  {
    id: "ch9-bishop", titre: "Bishop à la main sur cinq tranches", difficulte: 3,
    generer(a) {
      for (let essai = 0; essai < 80; essai++) {
        const H = a.entre(5, 10, 0.5), [f, nom] = a.choix([[1.5, "3/2"], [2, "2/1"]]), gamma = a.entre(18, 21, 0.5);
        const c = a.entre(3, 15, 1), phi = a.entre(15, 28, 1), ru = a.choix([0, 0, 0.1, 0.2, 0.3, 0.4]);
        const xc = +(a.entre(0.25, 0.55, 0.05) * f * H).toFixed(1), yc = +(a.entre(1.3, 2, 0.05) * H).toFixed(1), R = Math.hypot(xc, yc);
        const cercle = { xc, yc, R };
        const fin = bishop({ H, f, c, phi, gamma, ru, cercle });
        if (!fin) continue;
        const L = f * H, x2 = fin.x2;
        if (x2 < L + 0.5) continue;
        // Trois tranches sur le talus, deux sur la plateforme : le haut de chaque tranche est rectiligne.
        const bornes = [0, L / 3, (2 * L) / 3, L, (L + x2) / 2, x2];
        const ys = surfaceTalus({ H, f }), arc = (x) => yc - Math.sqrt(R * R - (x - xc) ** 2);
        const tranches = bornes.slice(0, -1).map((x, i) => {
          const xm = (x + bornes[i + 1]) / 2;
          return { b: +(bornes[i + 1] - x).toFixed(2), h: +(ys(xm) - arc(xm)).toFixed(2), alpha: +(Math.asin((xm - xc) / R) / RAD).toFixed(1) };
        });
        if (tranches.some((t) => t.h <= 0.05)) continue;
        const r = bishopTranches(tranches, { c, phi, gamma, ru });
        if (!(r.mMin > 0.3 && r.F > 0.8 && r.F < 2.4 && Math.abs(r.F - 1.5) > 0.03 && Math.abs(r.F - 1) > 0.03)) continue;
        const v = verdictF(r.F);
        return {
          enonce: `Remblai de ${frd(H, 1)} m au fruit ${nom}, en sol fin compacté (γ = ${frd(gamma, 1)} kN/m³, c' = ${c} kPa, φ' = ${phi}°${ru ? `, ru = ${frd(ru, 1)}` : ", sec"}), sur un terrain de même nature. On vérifie le cercle de centre O (${frd(xc, 1)} ; ${frd(yc, 1)}) m — origine au pied du talus —, qui passe par le pied (R = ${frd(R, 2)} m) et ressort sur la plateforme à ${frd(x2, 2)} m. La masse qui glisse est découpée en cinq tranches : ${tranches.map((t, i) => `n° ${i + 1} : b = ${frd(t.b, 2)} m, h = ${frd(t.h, 2)} m, α = ${frd(t.alpha, 1)}°`).join(" ; ")}.`,
          donnees: [donnee("Sol", `γ = ${frd(gamma, 1)} kN/m³ · c' = ${c} kPa · φ' = ${phi}° · ru = ${frd(ru, 1)}`), ...tranches.map((t, i) => donnee(`Tranche ${i + 1}`, `b ${frd(t.b, 2)} m · h ${frd(t.h, 2)} m · α ${frd(t.alpha, 1)}°`))],
          figure: coupeBishop({ H, f }, cercle, bornes),
          questions: [
            nombre("Terme moteur Σ W sin α (par mètre de talus) ?", r.moteur, "kN/m", `W = γ h b pour chaque tranche ; Σ W sin α = ${tranches.map((t) => frd(gamma * t.h * t.b * Math.sin(t.alpha * RAD), 1)).join(" + ").replace(/\+ -/g, "− ")} = ${frd(r.moteur, 1)} kN/m.`, { rel: 0.02 }),
            nombre("F après une itération, en partant de F0 = 1 ?", r.F1, "", `Avec F = 1 dans mα = cos α (1 + tan α tan φ'/F) : Σ [c' b + (W − u b) tan φ']/mα = ${frd(r.F1 * r.moteur, 1)} kN/m, d'où F1 = ${frd(r.F1 * r.moteur, 1)}/${frd(r.moteur, 1)} = ${frd(r.F1, 3)}.`, { rel: 0.02 }),
            nombre("F après convergence ?", r.F, "", `On réinjecte F dans mα jusqu'à ce qu'il ne bouge plus : F = ${frd(r.F, 3)}. Avec 40 tranches, le solveur du cours donne F = ${frd(fin.F, 3)} sur ce cercle : cinq tranches suffisent à quelques pour cent près.`, { rel: 0.02 }),
            choixMelange(a, "Verdict pour ce cercle ?", [v, ...VERDICTS_F.filter((x) => x !== v)],
              `F = ${frd(r.F, 2)} : ${v}. Ce n'est qu'un cercle : le coefficient du talus est le plus faible de tous les cercles possibles — le cercle critique.`),
          ],
        };
      }
      throw new Error("ch9-bishop : aucun cercle exploitable");
    },
  },
  {
    id: "ch9-materiau", titre: "Quel matériau pour un talus en zone humide ?", difficulte: 3,
    generer(a) {
      const MATERIAUX = [["limon compacté", 28, "le"], ["sable", 32, "le"], ["grave roulée", 36, "la"], ["grave concassée", 40, "la"], ["enrochement", 45, "l'"]];
      for (let essai = 0; essai < 60; essai++) {
        const [f, nom] = a.choix([[2, "2/1"], [2.5, "5/2"], [3, "3/1"], [3.5, "7/2"]]), g = a.entre(19, 22, 0.5);
        const beta = pente(f), t = Math.tan(beta * RAD);
        const phiSec = Math.atan(1.5 * t) / RAD, phiEau = Math.atan((g / (g - GW)) * t) / RAD;
        const phiMin = Math.max(phiSec, phiEau);
        if (MATERIAUX.some(([, p]) => Math.abs(p - phiMin) < 0.6)) continue;
        // Le premier matériau, du plus économique au plus coûteux, qui tient dans les deux situations (vérifié par penteInfinie).
        const tient = ([, p]) => penteInfinie({ phi: p, beta }) >= 1.5 && penteInfinie({ phi: p, beta, ecoulement: true, gamma: g, gammaW: GW }) >= 1;
        const retenu = MATERIAUX.find(tient);
        if (!retenu) continue;
        const nomM = ([n, p]) => `${n} (φ' = ${p}°)`;
        return {
          enonce: `Un remblai traverse une zone où, après de fortes pluies, l'eau peut s'écouler parallèlement aux talus. Les talus seront réglés au fruit ${nom}. On exige F ≥ 1,5 à sec et F ≥ 1 avec écoulement (talus infini, matériaux sans cohésion, γsat = ${frd(g, 1)} kN/m³, γw = 9,81 kN/m³). Matériaux disponibles, du plus économique au plus coûteux : ${MATERIAUX.map(nomM).join(", ")}.`,
          donnees: [donnee("Fruit", nom), donnee("γsat", `${frd(g, 1)} kN/m³`), donnee("Exigences", "F ≥ 1,5 sec · F ≥ 1 avec écoulement")],
          questions: [
            nombre("Angle de frottement minimal pour F = 1,5 à sec ?", phiSec, "°", `tan φ' = 1,5 tan β = 1,5/${frd(f, 1)} = ${frd(1.5 * t, 3)} ⇒ φ' = ${frd(phiSec, 1)}°.`, { abs: 0.3 }),
            nombre("Angle de frottement minimal pour F = 1 avec écoulement ?", phiEau, "°", `tan φ' = (γsat/γ') tan β = (${frd(g, 1)}/${frd(g - GW, 2)}) × ${frd(t, 3)} = ${frd((g / (g - GW)) * t, 3)} ⇒ φ' = ${frd(phiEau, 1)}°.`, { abs: 0.3 }),
            choixMelange(a, "Matériau à retenir ?", [nomM(retenu), ...MATERIAUX.filter((m) => m !== retenu).map(nomM).slice(0, 3)],
              `Il faut φ' ≥ ${frd(phiMin, 1)}° (${phiEau > phiSec ? "c'est l'écoulement qui dimensionne" : "c'est la situation sèche qui dimensionne"}) : le premier matériau qui convient est ${retenu[2]}${retenu[2].endsWith("'") ? "" : " "}${retenu[0]} — à sec F = ${frd(penteInfinie({ phi: retenu[1], beta }), 2)}, avec écoulement F = ${frd(penteInfinie({ phi: retenu[1], beta, ecoulement: true, gamma: g, gammaW: GW }), 2)}. Drainer le talus permettrait un matériau moins frottant.`),
          ],
        };
      }
      throw new Error("ch9-materiau : aucun tirage exploitable");
    },
  },
];
