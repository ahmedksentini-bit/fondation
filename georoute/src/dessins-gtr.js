// Dessins partagés par le cours et le bureau de calcul : coupe d'un talus avec
// son cercle de glissement critique, profil en travers avec ses surfaces de
// déblai et de remblai.
import { svg, ligne, texte, COULEURS } from "./figures.js";
import { surfaceTalus } from "./gtr/stabilite.js";
import { coteEn } from "./gtr/cubatures.js";

const fd = (x, d = 2) => (Number.isFinite(x) ? Number(x).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—");

/** Coupe d'un talus homogène (hauteur H, fruit f) et de son cercle critique r = { F, x1, x2, cercle }. */
export function coupeTalus({ H, f }, r) {
  const L = f * H, x0 = -1.4 * H, x1 = L + 1.6 * H;
  const yTop = Math.max(H, r.cercle.yc) + 0.3 * H, yBas = -0.25 * H - Math.max(0, r.cercle.R - r.cercle.yc);
  const W = 600, Hh = 300, k = Math.min((W - 20) / (x1 - x0), (Hh - 20) / (yTop - yBas));
  const X = (x) => 10 + (x - x0) * k, Y = (y) => Hh - 10 - (y - yBas) * k;
  const ys = surfaceTalus({ H, f });
  const { xc, yc, R } = r.cercle;
  const arc = (x) => yc - Math.sqrt(Math.max(0, R * R - (x - xc) ** 2));
  return svg({ largeur: 620, hauteur: Hh, titre: "Cercle critique", contenu: () => {
    let s = "";
    const sol = [[x0, ys(x0)], [0, 0], [L, H], [x1, H], [x1, yBas], [x0, yBas]];
    s += `<path d="M${sol.map(([x, y]) => `${X(x).toFixed(1)} ${Y(y).toFixed(1)}`).join("L")}Z" fill="#e7dcc8" stroke="#8b7355" stroke-width="1.2"/>`;
    // Masse qui glisse : entre la surface et l'arc.
    const n = 60, haut = [], bas = [];
    for (let i = 0; i <= n; i++) { const x = r.x1 + ((r.x2 - r.x1) * i) / n; haut.push([x, ys(x)]); bas.push([x, arc(x)]); }
    s += `<path d="M${[...haut, ...bas.reverse()].map(([x, y]) => `${X(x).toFixed(1)} ${Y(y).toFixed(1)}`).join("L")}Z" fill="#fca5a5" fill-opacity=".55" stroke="${COULEURS.rouge}" stroke-width="2.2"/>`;
    // Centre et rayons vers les extrémités.
    s += ligne(X(xc), Y(yc), X(r.x1), Y(ys(r.x1)), "#94a3b8", 1, 'stroke-dasharray="4 3"') + ligne(X(xc), Y(yc), X(r.x2), Y(ys(r.x2)), "#94a3b8", 1, 'stroke-dasharray="4 3"');
    s += `<circle cx="${X(xc).toFixed(1)}" cy="${Y(yc).toFixed(1)}" r="4" fill="${COULEURS.rouge}"/>`;
    s += texte(X(xc) + 8, Y(yc) - 6, `F = ${fd(r.F, 2)}`, `class="halo" style="font-weight:900;fill:${COULEURS.rouge}"`);
    // Cotes de hauteur et de fruit.
    s += ligne(X(L) + 14, Y(0), X(L) + 14, Y(H), COULEURS.cote, 1) + texte(X(L) + 20, Y(H / 2) + 4, `H = ${fd(H, 1)} m`, 'class="halo" style="font-size:11.5px;font-weight:700"');
    s += texte(X(L / 2) - 10, Y(H / 2) - 8, `${fd(f, 1).replace(",0", "")}/1`, 'text-anchor="end" class="halo" style="font-size:11.5px;font-weight:700;fill:#475569"');
    return s;
  } });
}

/** Coupe : terrain naturel, projet, surfaces de déblai (ocre) et de remblai (vert). */
export function coupeProfil(r) {
  const xa = Math.min(r.tn[0][0], r.emprise[0] - 3), xb = Math.max(r.tn.at(-1)[0], r.emprise[1] + 3);
  const zs = [...r.tn.map((p) => p[1]), ...r.projet.map((p) => p[1])];
  const za = Math.min(...zs) - 1.5, zb = Math.max(...zs) + 1.5;
  // Hauteurs exagérées (×2 au plus) pour lire les surfaces ; l'exagération est indiquée.
  const W = 600, H = 260, kx = (W - 40) / (xb - xa), kz = Math.min((H - 48) / (zb - za), 2 * kx), exag = kz / kx;
  const X = (x) => 20 + (x - xa) * kx, Z = (z) => H - 30 - (z - za) * kz;
  const tn = (x) => coteEn(r.tn, x), pj = (x) => coteEn(r.projet, x);
  // Surfaces par bandes fines, coupées au changement de signe.
  const n = 240, [ea, eb] = r.emprise;
  let poly = "";
  for (let i = 0; i < n; i++) {
    const x0 = ea + ((eb - ea) * i) / n, x1 = ea + ((eb - ea) * (i + 1)) / n;
    const d0 = tn(x0) - pj(x0), d1 = tn(x1) - pj(x1);
    const quad = (a, b, coul) => { poly += `<path d="M${X(a).toFixed(1)} ${Z(tn(a)).toFixed(1)}L${X(b).toFixed(1)} ${Z(tn(b)).toFixed(1)}L${X(b).toFixed(1)} ${Z(pj(b)).toFixed(1)}L${X(a).toFixed(1)} ${Z(pj(a)).toFixed(1)}Z" fill="${coul}" stroke="${coul}" stroke-width=".6"/>`; };
    const coul = (d) => (d > 0 ? "#f59e0b" : "#22c55e");
    if ((d0 >= 0) === (d1 >= 0)) quad(x0, x1, coul(d0 + d1));
    else { const xc = x0 + ((x1 - x0) * d0) / (d0 - d1); quad(x0, xc, coul(d0)); quad(xc, x1, coul(d1)); }
  }
  const trace = (pts, attrs) => `<path d="M${pts.map(([x, z]) => `${X(x).toFixed(1)} ${Z(z).toFixed(1)}`).join("L")}" fill="none" ${attrs}/>`;
  return svg({ largeur: 620, hauteur: H, titre: "Profil en travers", contenu: () => {
    let s = `<g opacity=".55">${poly}</g>`;
    s += trace(r.tn, `stroke="#8b5a2b" stroke-width="2" stroke-dasharray="7 4"`);
    s += trace(r.projet, `stroke="${COULEURS.encre}" stroke-width="2.4"`);
    s += ligne(X(0), Z(zb) + 4, X(0), Z(za), "#94a3b8", 1, 'stroke-dasharray="2 4"') + texte(X(0) + 4, Z(zb) + 14, "axe", 'style="font-size:11px;fill:#64748b"');
    if (exag > 1.05) s += texte(600, 14, `hauteurs exagérées × ${fd(exag, 1)}`, 'text-anchor="end" style="font-size:10.5px;fill:#64748b"');
    s += texte(X(r.tn[0][0]) + 4, Z(r.tn[0][1]) - 8, "terrain naturel", 'class="halo" style="font-size:11.5px;font-weight:700;fill:#8b5a2b"');
    if (r.deblai > 0.05) s += texte(20, H - 6, `déblai ${fd(r.deblai, 1)} m²`, 'style="font-size:12px;font-weight:800;fill:#b45309"');
    if (r.remblai > 0.05) s += texte(600, H - 6, `remblai ${fd(r.remblai, 1)} m²`, 'text-anchor="end" style="font-size:12px;font-weight:800;fill:#15803d"');
    s += ligne(X(r.emprise[0]), Z(za) + 6, X(r.emprise[1]), Z(za) + 6, COULEURS.cote, 1) + texte((X(r.emprise[0]) + X(r.emprise[1])) / 2, Z(za) + 18, `emprise ${fd(r.largeurEmprise, 1)} m`, 'text-anchor="middle" class="halo" style="font-size:11px;font-weight:700"');
    return s;
  } });
}
