// Banc d'essai : essai de pénétration au carottier (SPT, chapitre 2). La
// foreuse descend le forage jusqu'à la cote d'essai, on nettoie le fond et l'on
// descend le carottier fendu ; le mouton de 63,5 kg, lâché de 76 cm, l'enfonce
// de trois fois 15 cm. On compte les coups de chaque tranche : la première
// sert d'amorce, N est la somme des deux suivantes. On remonte le carottier,
// on l'ouvre sur l'échantillon, puis on reprend le forage 1,5 m plus bas.
import { svg, ligne, texte, couche, COULEURS, solDe } from "../figures.js";
import { SPT, sptCorrige } from "../geotech/essais.js";
import { creerAlea } from "../exos/alea.js";
import { SITES, terrain } from "./terrain.js";
import { charpente, boucle, brancherMarche, lectures, coupe, axeProfondeur, panneau, f, fd, r1, esc, duree } from "./moteur.js";

const PAS_ESSAI = 1.5; // m entre deux essais
const CYCLE = 2, MONTEE = 1.3, CHUTE = 0.4; // s par coup
const H_CHUTE = 0.76;
const REFUS = 50; // coups dans une tranche de 15 cm
const VITESSE_FORAGE = { remblai: 1.2, argile: 1.8, limon: 1.5, sable: 1.0, grave: 0.5, marne: 0.4, craie: 0.6 }; // m/min
const DUREES = { nettoyage: 90, descente: 60, remontee: 60, ouverture: 40 };
const MOUTONS = { automatique: "automatique (CE = 1,20)", securite: "de sécurité (CE = 0,90)", donut: "annulaire lâché à la corde (CE = 0,75)" };

export function monter(banc) {
  const c = charpente(banc, {
    vitesse: 100,
    commandes: `
      <div class="field"><label>Terrain</label><div class="input-wrap"><select data-r="site">${Object.values(SITES).map((s) => `<option value="${s.cle}">${esc(s.nom)}</option>`).join("")}</select></div></div>
      <div class="field"><label>Mouton</label><div class="input-wrap"><select data-r="mouton">${Object.entries(MOUTONS).map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join("")}</select></div></div>`,
  });
  let e, b, etatBoutons;

  const reinit = () => {
    const site = SITES[c.q('[data-r="site"]').value], T = terrain(site.cle), mouton = c.q('[data-r="mouton"]').value;
    const zMax = Math.min(site.zMax - 1, 15);
    e = { site, T, mouton, CE: SPT.energie[mouton], zMax, alea: creerAlea(site.cle === "B" ? 5 : 3), t: 0,
      fond: 0, phase: "forage", minuteur: 0, zEssai: PAS_ESSAI, essais: [], courant: null, outil: 0, fini: false };
    c.scene.innerHTML = fond(e);
    c.courbes.innerHTML = "";
    c.bilan.innerHTML = "";
    dessiner(); dessinerLent();
  };

  /** Prépare l'essai à la cote zEssai : nombres de coups par tranche, d'après N60 du terrain. */
  const preparerEssai = () => {
    const z = e.zEssai, L = z + 1.5;
    const CR = SPT.tiges(L), facteur = e.CE * CR;
    const Nmes = Math.max(1, e.T.N60(z + 0.3) / facteur * (1 + 0.24 * (e.alea.reel() - 0.5)));
    const N2 = Math.max(1, Math.round(0.47 * Nmes)), N3 = Math.max(1, Math.round(Nmes) - N2), N1 = Math.max(1, Math.round(0.7 * N2));
    e.courant = { z, CR, cibles: [N1, N2, N3], coups: [0, 0, 0], tranche: 0, pen: 0, phase: 0, refus: false };
  };

  const avancer = (dt) => {
    if (e.fini) return false;
    let reste = dt;
    while (reste > 1e-9 && !e.fini) {
      if (e.phase === "forage") {
        const k = e.T.couche(e.fond + 0.01), v = (VITESSE_FORAGE[k.sol] ?? 1) / 60;
        const h = Math.min(reste, (e.zEssai - e.fond) / v);
        e.fond += h * v; e.t += h; reste -= h; e.outil += h;
        if (e.fond >= e.zEssai - 1e-9) { e.fond = e.zEssai; e.phase = "nettoyage"; e.minuteur = DUREES.nettoyage; }
        continue;
      }
      if (["nettoyage", "descente", "remontee", "ouverture"].includes(e.phase)) {
        const h = Math.min(reste, e.minuteur);
        e.minuteur -= h; e.t += h; reste -= h;
        if (e.minuteur > 1e-9) continue;
        if (e.phase === "nettoyage") { e.phase = "descente"; e.minuteur = DUREES.descente; }
        else if (e.phase === "descente") { e.phase = "battage"; preparerEssai(); }
        else if (e.phase === "remontee") { e.phase = "ouverture"; e.minuteur = DUREES.ouverture; }
        else if (e.phase === "ouverture") {
          e.zEssai += PAS_ESSAI;
          if (e.zEssai > e.zMax) e.fini = true;
          else e.phase = "forage";
        }
        continue;
      }
      // Battage : levage, chute, choc ; enfoncement réparti dans la tranche en cours.
      const k = e.courant, choc = MONTEE + CHUTE, cible = k.phase < choc ? choc : CYCLE;
      const h = Math.min(reste, cible - k.phase);
      k.phase += h; e.t += h; reste -= h;
      if (cible === choc && k.phase >= choc - 1e-9) {
        const i = k.tranche;
        k.coups[i]++;
        k.pen = Math.min(0.15 * (i + 1), 0.15 * i + (0.15 * k.coups[i]) / k.cibles[i]);
        if (k.coups[i] >= k.cibles[i]) k.tranche++;
        else if (k.coups[i] >= REFUS) { k.refus = true; k.tranche = 3; }
        if (k.tranche >= 3) {
          const N = k.coups[1] + k.coups[2];
          const c2 = sptCorrige({ N, sigmaV0eff: e.T.contraintes(k.z + 0.3).svEff, CE: e.CE, CR: k.CR });
          e.essais.push({ z: k.z, coups: [...k.coups], N, N60: c2.N60, N160: c2.N160, refus: k.refus, couche: e.T.couche(k.z + 0.3) });
          e.fond = k.z + 0.45; e.phase = "remontee"; e.minuteur = DUREES.remontee;
        }
      }
      if (k.phase >= CYCLE - 1e-9) k.phase = 0;
    }
    return !e.fini;
  };

  // ── Dessin ──────────────────────────────────────────────────────────────
  const G = { yS: 176, bas: 488, xF: 118, kh: 56 };
  const Y = (z) => G.yS + (z / e.zMax) * (G.bas - G.yS);

  function fond(e2) {
    return svg({
      largeur: 640, hauteur: 500, titre: "Essai SPT en cours", contenu: (id) => {
        let s = coupe(id, { x0: 10, x1: 232, Y, couches: e2.site.couches, zMax: e2.zMax, zw: e2.site.zw });
        // Foreuse sur chenilles, mât, treuil.
        s += `<rect x="20" y="${G.yS - 34}" width="78" height="24" rx="5" fill="#fde68a" stroke="#92400e" stroke-width="1.2"/>`;
        s += `<rect x="16" y="${G.yS - 11}" width="88" height="10" rx="5" fill="#334155"/>`;
        s += `<rect x="${G.xF - 30}" y="8" width="8" height="${G.yS - 18}" fill="#fbbf24" stroke="#92400e"/>`;
        s += ligne(G.xF - 22, 12, G.xF + 6, 12, "#92400e", 2.4);
        s += `<circle cx="64" cy="${G.yS - 46}" r="9" fill="#e2e8f0" stroke="#475569"/>` + texte(64, G.yS - 60, "treuil", 'text-anchor="middle" style="font-size:9.5px;fill:#475569;font-weight:700"');
        s += `<g class="dyn-forage"></g><g class="dyn-outil"></g>`;
        s += axeProfondeur({ x: 262, Y, zMax: e2.zMax });
        const pN = panneau({ x0: 276, x1: 470, Y, zMax: e2.zMax, vMax: 60, titre: "N (mesuré) et N60", pas: 20 });
        e2.XN = pN.X;
        s += pN.svg;
        s += `<rect x="486" y="${Y(0)}" width="144" height="${Y(e2.zMax) - Y(0)}" fill="#fff" stroke="${COULEURS.trait}"/>`;
        s += texte(558, Y(0) - 17, "échantillons", 'text-anchor="middle" style="font-size:11px;font-weight:700"');
        s += `<g class="dyn-n"></g><g class="dyn-ech"></g>`;
        return s;
      },
    });
  }

  function dessiner() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    const yFond = Y(e.fond);
    svgEl.querySelector(".dyn-forage").innerHTML = `<rect x="${G.xF - 7}" y="${G.yS}" width="14" height="${r1(Math.max(0, yFond - G.yS))}" fill="#fff"/>`
      + ligne(G.xF - 7, G.yS, G.xF - 7, yFond, COULEURS.trait, 0.9, 'stroke-dasharray="4 3"') + ligne(G.xF + 7, G.yS, G.xF + 7, yFond, COULEURS.trait, 0.9, 'stroke-dasharray="4 3"');
    let o = "";
    const tige = (y0, y1) => `<rect x="${G.xF - 2.5}" y="${r1(y0)}" width="5" height="${r1(Math.max(0, y1 - y0))}" fill="#cbd5e1" stroke="${COULEURS.betonTrait}" stroke-width="0.8"/>`;
    if (e.phase === "forage") {
      // Train de forage et outil qui tourne, déblais qui remontent.
      o += tige(28, yFond - 7) + `<rect x="${G.xF - 11}" y="22" width="22" height="12" rx="3" fill="#f1f5f9" stroke="${COULEURS.betonTrait}"/>`;
      const a = (e.outil * 7) % 1;
      o += `<path d="M${G.xF - 6} ${r1(yFond - 7)}h12l-2 7h-8z" fill="#475569"/><path d="M${r1(G.xF - 6 + 12 * a)} ${r1(yFond - 7)}v7" stroke="#cbd5e1" stroke-width="1.5"/>`;
      for (let i = 0; i < 4; i++) { const y = yFond - ((e.outil * 30 + i * 37) % Math.max(10, yFond - G.yS)); o += `<circle cx="${G.xF + (i % 2 ? 4 : -4)}" cy="${r1(y)}" r="1.4" fill="#78716c"/>`; }
    } else if (["nettoyage", "descente", "remontee"].includes(e.phase)) {
      const zC = e.phase === "descente" ? e.fond * (1 - e.minuteur / DUREES.descente) : e.phase === "remontee" ? e.fond * (e.minuteur / DUREES.remontee) : e.fond;
      const y = Y(Math.max(zC, 0));
      o += tige(28, y - 16) + `<rect x="${G.xF - 4}" y="${r1(y - 16)}" width="8" height="16" fill="#94a3b8" stroke="#334155"/>`;
    } else if (e.phase === "battage") {
      const k = e.courant, yC = Y(k.z + k.pen);
      o += tige(70, yC - 16) + `<rect x="${G.xF - 4}" y="${r1(yC - 16)}" width="8" height="16" fill="#94a3b8" stroke="#334155"/>`;
      const choc = MONTEE + CHUTE;
      const lev = k.phase < MONTEE ? k.phase / MONTEE : k.phase < choc ? Math.max(0, 1 - (9.81 * (k.phase - MONTEE) ** 2) / 2 / H_CHUTE) : 0;
      const yM = 64 - lev * H_CHUTE * G.kh;
      o += `<rect x="${G.xF - 9}" y="66" width="18" height="6" fill="#64748b"/>`;
      o += `<rect x="${G.xF - 12}" y="${r1(yM - 20)}" width="24" height="20" rx="2" fill="#334155" stroke="#0f172a"/>`;
      if (k.phase >= choc - 0.02 && k.phase < choc + 0.12) o += `<path d="M${G.xF - 18} 66l-8-4M${G.xF + 18} 66l8-4" stroke="${COULEURS.effort}" stroke-width="2"/>`;
    } else if (e.phase === "ouverture") {
      // Carottier ouvert à côté du forage : l'échantillon de la tranche battue.
      const k = e.essais.at(-1), sol = solDe(k.couche.sol);
      o += `<rect x="150" y="${G.yS - 30}" width="74" height="14" rx="3" fill="#94a3b8" stroke="#334155"/>`;
      o += `<rect x="154" y="${G.yS - 27}" width="66" height="8" fill="${sol.fond}" stroke="#57534e" stroke-width="0.6"/>`;
      o += texte(187, G.yS - 36, "carottier ouvert", 'text-anchor="middle" class="halo" style="font-size:9.5px;font-weight:700"');
    }
    svgEl.querySelector(".dyn-outil").innerHTML = o;
    const k = e.courant;
    const libelles = { forage: "forage", nettoyage: "nettoyage du fond", descente: "descente du carottier", battage: "battage", remontee: "remontée du carottier", ouverture: "ouverture du carottier" };
    c.lectures.innerHTML = lectures([
      ["Fond du forage", fd(e.fond, 2), "m"], ["Essai à", fd(e.zEssai, 2), "m"],
      ["Coups par tranche", k && (e.phase === "battage" || e.essais.at(-1)?.z === k.z) ? k.coups.join(" · ") : "—", "/ 15 cm"],
      ["N = N2 + N3", e.essais.length ? String(e.essais.at(-1).N) : "—", "coups"], ["Temps", duree(e.t), ""],
    ]) + `<p class="banc-etat">${libelles[e.phase] ?? ""}</p>`;
  }

  function dessinerLent() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    let n = "", ech = "";
    for (const x of e.essais) {
      const y0 = Y(x.z + 0.15), y1 = Y(x.z + 0.45);
      n += `<rect x="${r1(e.XN(0))}" y="${r1(y0)}" width="${r1(e.XN(Math.min(x.N, 60)) - e.XN(0))}" height="${r1(y1 - y0)}" fill="#bae6fd" stroke="${COULEURS.bleu}"/>`;
      n += `<circle cx="${r1(e.XN(Math.min(x.N60, 60)))}" cy="${r1((y0 + y1) / 2)}" r="3.2" fill="${COULEURS.f62}"/>`;
      n += texte(e.XN(Math.min(x.N, 60)) + 6, (y0 + y1) / 2 + 4, x.refus ? "refus" : String(x.N), 'style="font-size:9.5px;font-weight:700"');
      const sol = solDe(x.couche.sol);
      ech += `<rect x="492" y="${r1(Y(x.z))}" width="22" height="${r1(Y(x.z + 0.45) - Y(x.z))}" fill="${sol.fond}" stroke="#57534e" stroke-width="0.6"/>`;
      ech += texte(520, (Y(x.z) + Y(x.z + 0.45)) / 2 + 4, x.couche.nom, 'class="halo" style="font-size:9.5px"');
    }
    svgEl.querySelector(".dyn-n").innerHTML = n;
    svgEl.querySelector(".dyn-ech").innerHTML = ech;
  }

  function bilan() {
    const lignes = e.essais.map((x) => `<tr><td class="n">${fd(x.z, 2)} – ${fd(x.z + 0.45, 2)}</td><td class="n">${x.coups.join(" · ")}</td><td class="n"><strong>${x.refus ? `refus (${x.N})` : x.N}</strong></td>
      <td class="n">${f(x.N60, 3)}</td><td class="n">${f(x.N160, 3)}</td><td>${esc(x.couche.nom)}</td></tr>`).join("");
    c.bilan.innerHTML = `<p class="final-result">${e.essais.length} essais en ${duree(e.t)}, un tous les ${fd(PAS_ESSAI, 1)} m.
        <small>N compte les coups des deux dernières tranches de 15 cm ; N60 = N C<sub>E</sub> C<sub>R</sub> (mouton ${esc(MOUTONS[e.mouton])}, correction de longueur des tiges) ;
        (N<sub>1</sub>)<sub>60</sub> le ramène à σ'<sub>v0</sub> = 100 kPa. Le calculateur qui suit reprend ces corrections pour un essai.</small></p>
      <div class="table-large"><table class="resultats"><thead><tr><th class="num">Tranche (m)</th><th class="num">Coups / 15 cm</th><th class="num">N</th><th class="num">N60</th><th class="num">(N1)60</th><th>Échantillon</th></tr></thead><tbody>${lignes}</tbody></table></div>`;
  }

  b = boucle({ avancer, dessiner, dessinerLent, surFin: bilan, surEtat: () => etatBoutons?.() });
  etatBoutons = brancherMarche(c, b, reinit);
  c.commandes.querySelectorAll("select").forEach((s) => s.addEventListener("change", () => { b.raz(); reinit(); etatBoutons(); }));
  reinit();
  etatBoutons();
}
