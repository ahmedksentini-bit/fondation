// Banc d'essai : le traitement d'un sol à la chaux vive en place (chapitre 12 ;
// GTS, guide technique « Traitement des sols à la chaux et/ou aux liants
// hydrauliques », NF EN 16907-4). On pose une bâche de 1 m² sur le sol ;
// l'épandeur passe et dose la chaux vive au mètre carré ; la bâche, pesée,
// contrôle le dosage. Le pulvimixeur malaxe la couche sur toute son épaisseur
// en deux ou trois passes, qui fragmentent les mottes (la mouture) ; la chaux
// vive s'hydrate — CaO + H₂O → Ca(OH)₂ — et chauffe : l'eau qu'elle fixe et
// celle que la chaleur vaporise font baisser la teneur en eau, d'autant plus
// que le temps est sec et venté. Puis le compacteur ferme la couche.
// Modèle : la réaction suit le malaxage avec un temps caractéristique de
// quatre minutes ; la baisse finale de teneur en eau est celle du solveur
// (chauxVive). L'IPI du sol traité est un modèle indicatif : IPI du sol à la
// nouvelle teneur en eau, majoré de 30 % par % de chaux pour la floculation.
import { svg, ligne, texte, couche, COULEURS, graphe } from "../figures.js";
import { quantite, chauxVive, dosagePour } from "../gtr/traitement.js";
import { etatHydrique, cleEtats, ETATS_2024, intervalle, indiceConsistance } from "../gtr/classification.js";
import { SOLS, ipiDe } from "./materiaux.js";
import { charpente, boucle, brancherMarche, lectures, f, fd, r1, esc, duree } from "./moteur.js";
import { fenetreLoupe, blocSol, fondSol, teinte, etiquette, horloge, W as WL, H as HL } from "./loupe.js";
import { bruit, roue, vapeur, ecran } from "./chantier-dessin.js";

const CHOIX = {
  limon: { sol: SOLS.limon, w0: SOLS.limon.wn, passes: 2, mouture: [60, 25], libelle: "limon des plateaux F1h" },
  argile: { sol: SOLS.argile, w0: 27.5, passes: 3, mouture: [100, 50, 30], libelle: "argile marneuse détrempée F3h" },
  sableArgileux: { sol: SOLS.sableArgileux, w0: 16, passes: 2, mouture: [50, 20], libelle: "sable argileux humide I2h" },
};
const METEO = { faible: { eta: 0.3, nom: "faible (temps couvert)" }, forte: { eta: 0.7, nom: "forte (soleil et vent)" } };
const LONG = 100, X_BACHE = 50, V_EPAND = 4 / 3.6, V_MIX = 0.6 / 3.6, V_COMP = 4 / 3.6; // m, m, m/s
const TAU = 240, K_IPI = 0.3, N_COMP = 6; // s : temps de réaction ; majoration de l'IPI par % de chaux ; passes de compacteur
const VERT = "#15803d";

export function monter(banc) {
  const c = charpente(banc, {
    vitesse: 50, vitesses: [1, 10, 50, 200],
    commandes: `
      <div class="field" style="grid-column:span 2"><label>Sol à traiter</label><div class="input-wrap"><select data-r="sol">${Object.entries(CHOIX).map(([k, x]) => `<option value="${k}">${esc(x.libelle)} (w = ${fd(x.w0, 1)} %)</option>`).join("")}</select></div></div>
      <div class="field"><label>Dosage en chaux vive</label><div class="input-wrap"><input data-r="dosage" type="text" inputmode="decimal" value="2" data-curseur="1 4 0.5"><span class="unit">%</span></div></div>
      <div class="field"><label>Épaisseur traitée</label><div class="input-wrap"><input data-r="e" type="text" inputmode="decimal" value="0.35" data-curseur="0.3 0.5 0.05"><span class="unit">m</span></div></div>
      <div class="field"><label>Évaporation (météo)</label><div class="input-wrap"><select data-r="meteo">${Object.entries(METEO).map(([k, m]) => `<option value="${k}">${esc(m.nom)}</option>`).join("")}</select></div></div>`,
  });
  const loupe = fenetreLoupe(c, "la chaux et les mottes, au droit de la bâche", { echelle: { px: 44, libelle: "5 cm" } });
  let e, b, etatBoutons;

  const lu = (k, a, z, d) => { const x = parseFloat(String(c.q(`[data-r="${k}"]`).value).replace(",", ".")); return Number.isFinite(x) ? Math.min(z, Math.max(a, x)) : d; };

  const reinit = () => {
    const ch = CHOIX[c.q('[data-r="sol"]').value], s = ch.sol, meteo = METEO[c.q('[data-r="meteo"]').value];
    const dosage = lu("dosage", 1, 4, 2), ep = lu("e", 0.3, 0.5, 0.35);
    const cle = cleEtats(s.classe.match(/^[A-Z]+\d/)[0]);
    // Quantité à épandre (solveur) ; l'épandeur s'en écarte un peu ; la bâche pèse ce qu'il a déposé.
    const q = quantite({ dosage, rhoD: s.rhoDOPN, e: ep }).q, q1 = quantite({ dosage: 1, rhoD: s.rhoDOPN, e: ep }).q;
    const mBache = Math.round((q * (1 + 0.035 * bruit(Math.round(dosage * 10 + ep * 100), s.wOPN))) / 0.05) * 0.05;
    const dosageMesure = mBache / q1;
    const fin = chauxVive({ w: ch.w0, dosage: dosageMesure, eta: meteo.eta });
    // Programme : pose de la bâche, épandage, pesée, passes de malaxage, compactage.
    const prog = [{ cle: "pose", d: 40 }, { cle: "epandage", d: LONG / V_EPAND }, { cle: "pesee", d: 60 }];
    for (let k = 1; k <= ch.passes; k++) {
      prog.push({ cle: "passe", k, d: LONG / V_MIX, sens: k % 2 ? 1 : -1 });
      if (k < ch.passes) prog.push({ cle: "demitour", d: 60 });
    }
    for (let j = 1; j <= N_COMP; j++) prog.push({ cle: "compactage", k: j, d: LONG / V_COMP + 10, sens: j % 2 ? 1 : -1 });
    let t0 = 0;
    for (const p of prog) { p.debut = t0; t0 += p.d; p.fin = t0; }
    // Incorporation de la chaux au droit de la bâche : un peu au contact du sol dès l'épandage, puis à chaque passe.
    const incorp = [];
    const pE = prog.find((p) => p.cle === "epandage");
    incorp.push({ t: pE.debut + X_BACHE / V_EPAND, I: 0.06 });
    prog.filter((p) => p.cle === "passe").forEach((p) => incorp.push({ t: p.debut + (p.sens > 0 ? X_BACHE : LONG - X_BACHE) / V_MIX, I: p.k < ch.passes ? 1 - 0.35 ** p.k : 1 }));
    const etatsH = ETATS_2024[cle].lignes, ligneH = etatsH.find((l) => l.etat === "h"), ligneM = etatsH.find((l) => l.etat === "m");
    e = {
      ch, s, meteo, dosage, ep, cle, q, mBache, dosageMesure, fin, prog, incorp, duree: t0, t: 0, histo: [], fini: false,
      rH: intervalle(ligneH.r).a, rM: intervalle(ligneM.r).a, ipiH: intervalle(ligneH.IPI).b, ipi: ipiDe(s),
    };
    c.scene.innerHTML = fond();
    c.courbes.innerHTML = '<div class="dyn-w"></div><div class="dyn-ipi"></div>';
    c.bilan.innerHTML = "";
    noter(); dessiner(); dessinerLent();
  };

  // ── Modèle : avancement de la réaction, teneur en eau, IPI ────────────────
  /** Avancement de la réaction de la chaux au droit de la bâche, de 0 à 1. */
  const reaction = (t) => {
    let R = 0, avant = 0;
    for (const { t: ti, I } of e.incorp) { if (t > ti) R += (I - avant) * (1 - Math.exp(-(t - ti) / TAU)); avant = I; }
    return e.fini ? 1 : Math.min(1, R);
  };
  const etatA = (t) => {
    const R = reaction(t), w = e.ch.w0 + (e.fin.wFinal - e.ch.w0) * R;
    const base = e.ipi(w);
    return { R, w, ipiBase: base, IPI: base * (1 + K_IPI * e.dosageMesure * R) };
  };
  const noter = () => { const a = etatA(e.t); e.histo.push([e.t / 60, a.w, a.IPI, a.ipiBase]); };

  const phase = () => e.prog.find((p) => e.t < p.fin) ?? { cle: "fin" };
  const avancer = (dt) => {
    if (e.fini) return false;
    const pas = 15; // s : une lecture des courbes toutes les 15 s d'essai
    const t1 = Math.min(e.duree, e.t + dt);
    while (Math.floor(e.t / pas) < Math.floor(t1 / pas)) { e.t = (Math.floor(e.t / pas) + 1) * pas; noter(); }
    e.t = t1;
    if (e.t >= e.duree - 1e-9) { e.fini = true; noter(); }
    return !e.fini;
  };

  /** Position (m) et sens d'un engin pendant sa phase, ou null s'il n'est pas sur la bande. */
  const engin = (cle) => {
    const p = phase();
    if (p.cle !== cle) return null;
    const u = (e.t - p.debut);
    if (cle === "epandage") return { x: u * V_EPAND, sens: 1 };
    if (cle === "passe") return { x: p.sens > 0 ? u * V_MIX : LONG - u * V_MIX, sens: p.sens };
    if (cle === "compactage") { const v = Math.min(LONG, u * V_COMP); return { x: p.sens > 0 ? v : LONG - v, sens: p.sens }; }
    return null;
  };
  /** Nombre de passes de malaxage (et de compacteur) déjà faites à l'abscisse x. */
  const passesEn = (x, cle) => e.prog.filter((p) => p.cle === cle && (e.t >= p.fin || (e.t > p.debut && (p.sens > 0 ? (e.t - p.debut) * (cle === "passe" ? V_MIX : V_COMP) >= x : LONG - (e.t - p.debut) * (cle === "passe" ? V_MIX : V_COMP) <= x)))).length;
  const chauleEn = (x) => { const p = e.prog.find((q) => q.cle === "epandage"); return e.t >= p.debut + x / V_EPAND; };

  // ── Scène : la bande traitée en coupe, les engins, la bâche ──────────────
  const KX = 5.4, X = (m) => 52 + m * KX, YS = 214, KV = 90; // px par m en long, abscisse, surface du sol, px par m d'épaisseur
  function fond() {
    const motif = e.s.motif;
    return svg({
      largeur: 640, hauteur: 344, titre: "Traitement à la chaux vive en place", contenu: (id) => {
        e.id = id;
        let s = `<g class="dyn-etapes"></g>`;
        const hT = e.ep * KV;
        s += couche(id, { x: X(0) - 30, y: YS, w: X(LONG) - X(0) + 60, h: 300 - YS, sol: motif });
        s += `<g class="dyn-couche"></g>`;
        s += ligne(X(0), YS + hT, X(LONG), YS + hT, COULEURS.trait, 1, 'stroke-dasharray="5 4"');
        s += texte(X(LONG) + 4, YS + hT / 2 + 4, `${fd(e.ep, 2)} m`, 'class="halo" style="font-size:10.5px;font-weight:800"');
        s += texte(X(0) - 26, 296, `${e.ch.libelle}, w = ${fd(e.ch.w0, 1)} % (épaisseurs ×${Math.round(KV / KX)})`, 'class="halo" style="font-size:10px;font-weight:700"');
        for (let m = 0; m <= LONG; m += 25) s += ligne(X(m), 302, X(m), 306, COULEURS.trait, 1) + texte(X(m), 318, m === LONG ? "100 m" : String(m), `text-anchor="middle" style="font-size:10px;fill:${COULEURS.discret}"`);
        s += texte(X(LONG / 2), 336, "bande traitée de 100 m, à la largeur du pulvimixeur (2,4 m)", `text-anchor="middle" style="font-size:10px;fill:${COULEURS.discret}"`);
        // Météo.
        const fort = e.meteo.eta > 0.5;
        s += fort ? `<circle cx="610" cy="66" r="9" fill="#fbbf24"/>${Array.from({ length: 8 }, (_, j) => { const a = (j * Math.PI) / 4; return ligne(610 + 12 * Math.cos(a), 66 + 12 * Math.sin(a), 610 + 16 * Math.cos(a), 66 + 16 * Math.sin(a), "#f59e0b", 1.8); }).join("")}`
          : `<path d="M596 72h28a7 7 0 0 0 -3 -13a9 9 0 0 0 -17 -2a6 6 0 0 0 -8 15z" fill="#cbd5e1" stroke="#94a3b8"/>`;
        s += texte(590, 70, fort ? `évaporation forte (η = ${fd(e.meteo.eta, 1)})` : `évaporation faible (η = ${fd(e.meteo.eta, 1)})`, 'text-anchor="end" style="font-size:10px;font-weight:700;fill:#475569"');
        s += `<g class="dyn-engins"></g>`;
        return s;
      },
    });
  }

  /** Épandeur, pulvimixeur, compacteur, dessinés vers la droite puis retournés selon le sens. */
  function dessinEngin(type, x, sens, t, actif = true) {
    // L'épandeur est repéré par sa rampe arrière (là où tombe la chaux), les autres engins par leur centre.
    const K = 1.5, hT = (e.ep * KV) / K, x0 = X(x) + (type === "epandeur" ? 42 * K * sens : 0);
    const tr = (contenu) => `<g transform="translate(${r1(x0)} ${YS}) scale(${r1(K * sens)} ${K})">${contenu}</g>`;
    if (type === "epandeur") {
      let s = `<rect x="-36" y="-14" width="68" height="5" fill="#475569"/>`;
      s += `<rect x="-32" y="-40" width="44" height="26" rx="8" fill="#e2e8f0" stroke="#64748b" stroke-width="1.2"/><text x="-10" y="-23" text-anchor="middle" style="font-size:10px;font-weight:800;fill:#475569">chaux</text>`;
      s += `<path d="M14 -36h12l6 10v15h-18z" fill="#fbbf24" stroke="#92400e"/><path d="M17 -33h8l4 7h-12z" fill="#93c5fd"/>`;
      s += `<rect x="-42" y="-20" width="10" height="11" fill="#334155"/>`;
      if (actif) for (let j = 0; j < 9; j++) { const p = (t * 2.2 + j / 9) % 1; s += `<circle cx="${r1(-41 + (j % 3) * 4)}" cy="${r1(-8 + p * 8)}" r="1.4" fill="#f8fafc" stroke="#94a3b8" stroke-width=".4"/>`; }
      s += roue(-22, -6, 6, t * 6) + roue(-8, -6, 6, t * 6) + roue(24, -6, 6, t * 6);
      return tr(s);
    }
    if (type === "pulvimixeur") {
      let s = `<rect x="-36" y="-34" width="70" height="18" rx="3" fill="#fbbf24" stroke="#92400e"/>`;
      s += `<rect x="-6" y="-50" width="20" height="16" rx="2" fill="#93c5fd" stroke="#1e3a5f"/>`;
      s += `<rect x="-16" y="-18" width="26" height="${r1(hT + 16)}" rx="3" fill="#334155" opacity=".9"/>`;
      const cy = hT - 9, a = -t * 8;
      s += `<circle cx="-3" cy="${r1(cy)}" r="9" fill="#64748b" stroke="#0f172a"/>`;
      for (let j = 0; j < 6; j++) { const b2 = a + (j * Math.PI) / 3; s += `<path d="M${r1(-3 + 9 * Math.cos(b2))} ${r1(cy + 9 * Math.sin(b2))}l${r1(4 * Math.cos(b2 + 0.4))} ${r1(4 * Math.sin(b2 + 0.4))}" stroke="#e2e8f0" stroke-width="2"/>`; }
      if (actif) for (let j = 0; j < 7; j++) { const p = (t * 1.7 + j / 7) % 1; s += `<circle cx="${r1(-12 + ((j * 7) % 20))}" cy="${r1(cy - 4 - p * (hT + 6))}" r="1.8" fill="${fondSol(e.s.motif)}" opacity="${r1(1 - p)}"/>`; }
      s += roue(-26, -9, 9, -a / 4) + roue(24, -9, 9, -a / 4);
      return tr(s);
    }
    // Compacteur à pieds dameurs.
    let s = `<rect x="-32" y="-26" width="40" height="14" rx="3" fill="#fbbf24" stroke="#92400e"/><rect x="-26" y="-42" width="18" height="16" rx="2" fill="#93c5fd" stroke="#1e3a5f"/>`;
    const a = x / 1.2;
    s += `<circle cx="20" cy="-13" r="12" fill="#fbbf24" stroke="#92400e"/><circle cx="20" cy="-13" r="5" fill="#92400e"/>`;
    for (let j = 0; j < 10; j++) { const b2 = a * sens + (j * Math.PI) / 5; s += `<rect x="${r1(20 + 12 * Math.cos(b2) - 2)}" y="${r1(-13 + 12 * Math.sin(b2) - 2)}" width="4" height="4" fill="#78350f"/>`; }
    s += roue(-20, -8, 8, a);
    return tr(s);
  }

  function dessiner() {
    const svgEl = c.scene.querySelector("svg");
    if (!svgEl) return;
    const t = horloge(), P = phase(), hT = e.ep * KV, np = e.ch.passes;
    // Étapes du chantier.
    const etapes = [["pose", "pose de la bâche"], ["epandage", "épandage"], ["pesee", "pesée de la bâche"], ["passe", `malaxage (${np} passes)`], ["compactage", "compactage"]];
    const iCour = e.fini ? 5 : etapes.findIndex(([k]) => k === P.cle || (k === "passe" && P.cle === "demitour"));
    let et = "";
    etapes.forEach(([, nom], j) => {
      const x = 34 + j * 116, fait = j < iCour, cour = j === iCour;
      et += `<rect x="${x}" y="12" width="110" height="24" rx="6" fill="${cour ? "#fff7ed" : fait ? "#f0fdf4" : "#fff"}" stroke="${cour ? "#b45309" : fait ? VERT : "#cbd5e1"}" stroke-width="${cour ? 2 : 1}"/>`;
      et += texte(x + 55, 28, nom, `text-anchor="middle" style="font-size:10px;font-weight:${cour ? 800 : 700};fill:${cour ? "#b45309" : fait ? VERT : "#64748b"}"`);
    });
    svgEl.querySelector(".dyn-etapes").innerHTML = et;
    // Couche : chaux en surface, sol malaxé (de plus en plus clair), sol compacté.
    let co = "";
    for (let m = 0; m < LONG; m += 2) {
      const xm = m + 1, k = passesEn(xm, "passe"), kc = passesEn(xm, "compactage");
      if (k > 0) {
        co += `<rect x="${r1(X(m))}" y="${YS}" width="${r1(2 * KX + 0.1)}" height="${r1(hT)}" fill="#eef2e6" opacity="${r1(0.35 + 0.55 * (k / np))}"/>`;
        co += `<rect x="${r1(X(m))}" y="${YS}" width="${r1(2 * KX + 0.1)}" height="${r1(hT)}" fill="url(#${e.id}-traite)" opacity="${r1(k / np)}"/>`;
      }
      if (kc > 0) co += `<rect x="${r1(X(m))}" y="${YS}" width="${r1(2 * KX + 0.1)}" height="${r1(hT)}" fill="#475569" opacity="${r1(0.06 + 0.12 * (kc / N_COMP))}"/>`;
      else if (k === 0 && chauleEn(xm)) co += `<rect x="${r1(X(m))}" y="${YS - 4}" width="${r1(2 * KX + 0.1)}" height="4" fill="#fff" stroke="#64748b" stroke-width=".5"/>`;
      // Vapeur : la chaux fraîchement malaxée s'hydrate et chauffe.
      if (m % 8 === 0 && !e.fini) {
        let force = 0;
        const pass = e.prog.filter((p) => p.cle === "passe" && e.t >= p.debut);
        pass.forEach((p) => {
          const tp = p.debut + (p.sens > 0 ? xm : LONG - xm) / V_MIX;
          if (e.t > tp) force += (p.k === 1 ? 0.65 : 0.35 / p.k) * Math.exp(-(e.t - tp) / TAU) * (0.6 + e.meteo.eta);
        });
        co += vapeur(X(xm), YS - 4, t + m * 0.13, { n: 2, hauteur: 22, force });
      }
    }
    co += ligne(X(0) - 30, YS, X(LONG) + 30, YS, COULEURS.trait, 1.4);
    // Bâche : posée, couverte de chaux, puis pesée.
    const pEp = e.prog.find((p) => p.cle === "epandage"), pPe = e.prog.find((p) => p.cle === "pesee");
    if (e.t < pPe.debut + 10) {
      const couverte = e.t >= pEp.debut + X_BACHE / V_EPAND;
      co += `<rect x="${r1(X(X_BACHE) - 7)}" y="${YS - 3}" width="14" height="3" fill="${couverte ? "#f8fafc" : "#2563eb"}" stroke="#1d4ed8" stroke-width=".8"/>`;
      co += texte(X(X_BACHE), YS - 92, "bâche 1 m²", 'text-anchor="middle" class="halo" style="font-size:10px;font-weight:800;fill:#1d4ed8"') + ligne(X(X_BACHE), YS - 88, X(X_BACHE), YS - 6, "#1d4ed8", 0.8, 'stroke-dasharray="2 2"');
    }
    if (e.t >= pPe.debut) {
      // Peson : la bâche pliée, sa chaux, la lecture.
      const xp = X(X_BACHE), lu = e.t >= pPe.debut + 25 ? `${fd(e.mBache, 2)} kg` : "…";
      co += `<path d="M${xp} 46v14" stroke="#334155" stroke-width="1.6"/><rect x="${xp - 36}" y="60" width="72" height="22" rx="4" fill="#334155"/>` + ecran(xp - 32, 63, 64, 16, [[lu, { gras: true, taille: 10 }]]);
      co += `<path d="M${xp} 82v8" stroke="#334155" stroke-width="1.4"/><path d="M${xp - 14} 90h28l-5 16h-18z" fill="#2563eb" stroke="#1d4ed8"/><path d="M${xp - 11} 94h22l-3 9h-16z" fill="#f8fafc"/>`;
      co += texte(xp + 44, 76, "pesée de la bâche", 'class="halo" style="font-size:10px;font-weight:800;fill:#1d4ed8"');
    }
    // Engins.
    let en = "";
    const pE = engin("epandage"), pM = engin("passe"), pC = engin("compactage");
    if (pE) en += dessinEngin("epandeur", pE.x, pE.sens, t) + texte(X(pE.x) + 52, YS - 68, "épandeur", 'text-anchor="middle" class="halo" style="font-size:10px;font-weight:800"');
    if (pM) en += dessinEngin("pulvimixeur", pM.x, pM.sens, t) + texte(X(pM.x), YS - 82, `pulvimixeur, passe ${P.k}`, 'text-anchor="middle" class="halo" style="font-size:10px;font-weight:800"');
    if (P.cle === "demitour") {
      const prec = e.prog[e.prog.indexOf(P) - 1], xb = prec.sens > 0 ? LONG : 0;
      en += dessinEngin("pulvimixeur", xb, (e.t - P.debut) < P.d / 2 ? prec.sens : -prec.sens, t) + texte(X(xb), YS - 82, "demi-tour", 'text-anchor="middle" class="halo" style="font-size:10px;font-weight:800"');
    }
    if (P.cle === "pose") en += dessinEngin("epandeur", 0, 1, 0, false);
    if (P.cle === "pesee") en += dessinEngin("pulvimixeur", 0, 1, 0, false);
    if (pC) en += dessinEngin("compacteur", pC.x, pC.sens, t) + texte(X(pC.x), YS - 70, `compacteur, passe ${P.k}/${N_COMP}`, 'text-anchor="middle" class="halo" style="font-size:10px;font-weight:800"');
    if (e.fini) co += texte(X(LONG / 2), YS - 20, `couche traitée et compactée : w = ${fd(e.fin.wFinal, 1)} %`, `text-anchor="middle" class="halo" style="font-size:11px;font-weight:800;fill:${VERT}"`);
    svgEl.querySelector(".dyn-couche").innerHTML = co;
    svgEl.querySelector(".dyn-engins").innerHTML = en;
    const a = etatA(e.t);
    const noms = { pose: "pose de la bâche de contrôle", epandage: "épandage de la chaux vive", pesee: "pesée de la bâche", passe: `malaxage, passe ${P.k} sur ${np}`, demitour: "demi-tour du pulvimixeur", compactage: `compactage, passe ${P.k} sur ${N_COMP}` };
    c.lectures.innerHTML = lectures([
      ["Teneur en eau w", fd(a.w, 1), "%"],
      ["IPI (indicatif)", f(a.IPI, 2), ""],
      ["Chaux sur la bâche", e.t >= pPe.debut + 25 ? fd(e.mBache, 2) : "—", "kg pour 1 m²"],
      ["Chaux hydratée", fd(100 * a.R, 0), "%"],
      ["Temps", duree(e.t), ""],
    ]) + `<p class="banc-etat">${e.fini ? "couche traitée et compactée" : noms[P.cle] ?? ""}</p>`;
    loupe(...vueLoupe());
  }

  // ── Loupe : 20 cm de couche au droit de la bâche ─────────────────────────
  const YL = 44; // surface de la couche dans la loupe
  /** Mottes : grille irrégulière de polygones de taille s (px), reproductible. */
  function mottes(sPx, serre, couleur) {
    let s = "";
    const pas = sPx * (serre ? 0.92 : 1.08);
    for (let j = 0, y = YL + sPx * 0.45; y < HL + sPx; j++, y += pas * 0.86) {
      for (let i = 0, x = ((j % 2) * pas) / 2 - pas / 2; x < WL + pas; i++, x += pas) {
        const r = (sPx / 2) * (0.92 + 0.14 * bruit(i * 13 + j, 7)), n = 7;
        let d = "";
        for (let k = 0; k < n; k++) {
          const a = (k * 2 * Math.PI) / n + 0.35 * bruit(i + k, j), rr = r * (0.84 + 0.16 * bruit(i * k + 3, j + k));
          d += `${k ? "L" : "M"}${r1(x + rr * Math.cos(a))} ${r1(y + rr * 0.86 * Math.sin(a))}`;
        }
        s += `<path d="${d}Z" fill="${teinte(couleur, 0.95 + 0.08 * bruit(i, j + 2))}" stroke="${teinte(couleur, 0.7)}" stroke-width=".8"/>`;
      }
    }
    return s;
  }
  function vueLoupe() {
    const t = horloge(), np = e.ch.passes, k = passesEn(X_BACHE, "passe"), kc = passesEn(X_BACHE, "compactage");
    const chaule = chauleEn(X_BACHE), a = etatA(e.t), coul = fondSol(e.s.motif);
    const pM = engin("passe"), rotor = pM && Math.abs(pM.x - X_BACHE) < 4;
    let s = `<rect width="${WL}" height="${HL}" fill="#dbe7f3"/>`;
    let legende;
    if (k === 0) {
      // Sol en place, intact ; la chaux vive repose dessus après l'épandage.
      s += blocSol(e.s.motif, { x0: 0, x1: WL, y0: YL, y1: HL, k: 880 });
      s += `<path d="M0 ${YL}H${WL}" stroke="#334155" stroke-width="1.4"/>`;
      if (chaule) {
        s += `<rect x="0" y="${YL - 7}" width="${WL}" height="7" fill="#fff"/>`;
        for (let j = 0; j < 70; j++) s += `<circle cx="${r1(3 + ((j * 29) % 170) + bruit(j, 1))}" cy="${r1(YL - 2 - ((j * 7) % 8))}" r="${r1(1.3 + 0.7 * Math.abs(bruit(j, 2)))}" fill="#fff" stroke="#64748b" stroke-width=".6"/>`;
        s += vapeur(60, YL - 6, t, { n: 2, force: 0.25 }) + vapeur(130, YL - 6, t + 0.4, { n: 2, force: 0.25 });
        s += etiquette(WL - 4, 14, `${fd(e.q, 1)} kg/m² de chaux visés`, { ancre: "end" });
      }
      legende = chaule ? "la chaux vive repose sur le sol, en attendant le malaxage" : `sol en place avant traitement : w = ${fd(e.ch.w0, 1)} %`;
    } else {
      // Sol malaxé : mottes de plus en plus fines, grains de chaux entre elles, qui s'hydratent.
      const mouture = e.ch.mouture[Math.min(k, np) - 1], sPx = mouture * 0.88 * (kc ? 0.95 : 1);
      s += `<rect x="0" y="${YL}" width="${WL}" height="${HL - YL}" fill="${teinte(coul, kc ? 0.84 : 0.76)}"/>`;
      s += mottes(sPx, kc > 0, coul);
      const nG = 70;
      for (let j = 0; j < nG; j++) {
        const x = 4 + ((j * 47) % 168) + 2 * bruit(j, 3), y = YL + 4 + ((j * 23) % (HL - YL - 6)), hyd = a.R > (j % 10) / 10 + 0.05;
        s += hyd ? `<circle cx="${r1(x)}" cy="${r1(y)}" r="2.6" fill="#f1f5f9" stroke="#cbd5e1" stroke-width=".5" opacity=".95"/>` : `<circle cx="${r1(x)}" cy="${r1(y)}" r="1.5" fill="#fff" stroke="#64748b" stroke-width=".5"/>`;
      }
      s += `<path d="M0 ${YL}H${WL}" stroke="#334155" stroke-width="1.4"/>`;
      const vif = Math.max(0, Math.min(1, (e.incorp.filter((q) => q.t < e.t).at(-1)?.I ?? 0) - a.R)) * 2.2;
      if (!e.fini) s += vapeur(40, YL - 4, t, { n: 3, force: vif, hauteur: 30 }) + vapeur(100, YL - 4, t + 0.33, { n: 3, force: vif, hauteur: 30 }) + vapeur(150, YL - 4, t + 0.66, { n: 3, force: vif, hauteur: 30 });
      if (rotor) {
        // Le rotor du pulvimixeur traverse la vue : ses pics fragmentent les mottes.
        const ang = -t * 9;
        s += `<circle cx="88" cy="96" r="44" fill="#475569" opacity=".25"/>`;
        for (let j = 0; j < 8; j++) { const b2 = ang + (j * Math.PI) / 4; s += `<path d="M${r1(88 + 30 * Math.cos(b2))} ${r1(96 + 30 * Math.sin(b2))}L${r1(88 + 44 * Math.cos(b2 + 0.25))} ${r1(96 + 44 * Math.sin(b2 + 0.25))}" stroke="#1e293b" stroke-width="4" stroke-linecap="round"/>`; }
      }
      s += etiquette(4, 14, `mottes ≤ ${mouture} mm`) + etiquette(WL - 4, 14, `w = ${fd(a.w, 1)} %`, { ancre: "end" });
      legende = e.fini ? `couche compactée : w = ${fd(a.w, 1)} %, mouture ≤ ${mouture} mm`
        : rotor ? `passe ${phase().k} : le rotor fragmente les mottes et mêle la chaux`
          : vif > 0.15 ? "la chaux vive s'hydrate et chauffe : l'eau se vaporise"
            : kc ? "le compacteur referme la couche traitée" : `chaux en grande partie hydratée (${fd(100 * a.R, 0)} %)`;
    }
    return [s, legende];
  }

  function dessinerLent() {
    const zw = c.courbes.querySelector(".dyn-w"), zi = c.courbes.querySelector(".dyn-ipi");
    if (!zw || !zi) return;
    const H = e.histo, tMax = e.duree / 60, wO = e.s.wOPN, ch = e.ch;
    const wH = e.rH * wO, wM = e.rM * wO, wMin = Math.min(wM, e.fin.wFinal) - 1, wMax = Math.max(ch.w0, wH) + 1;
    zw.innerHTML = graphe({
      largeur: 560, hauteur: 240, xmin: 0, xmax: tMax, ymin: wMin, ymax: wMax, pasX: 5, xlabel: "temps (min)", ylabel: "teneur en eau w (%)",
      zones: [
        { x0: 0, x1: tMax, y0: wH, y1: wMax, couleur: COULEURS.rouge, opacite: 0.07, libelle: "état h", position: "droite" },
        { x0: 0, x1: tMax, y0: wM, y1: wH, couleur: VERT, opacite: 0.06, libelle: "état m", position: "droite" },
      ],
      series: [
        { points: [[0, wH], [tMax, wH]], couleur: COULEURS.rouge, tirets: "6 4", epaisseur: 1.5, libelle: `w = ${fd(e.rH, 2)} wOPN = ${fd(wH, 1)} % : limite des états h et m` },
        { points: [[0, wM], [tMax, wM]], couleur: COULEURS.gtr92, tirets: "3 3", epaisseur: 1.5, libelle: `w = ${fd(e.rM, 1)} wOPN = ${fd(wM, 1)} % : limite des états m et s` },
        { points: H.map(([x, w]) => [x, w]), couleur: COULEURS.bleu, epaisseur: 2.4, libelle: "teneur en eau au droit de la bâche" },
      ],
    });
    const iMax = Math.max(e.ipiH * 1.6, ...H.map((h) => h[2] * 1.15), 10);
    zi.innerHTML = graphe({
      largeur: 560, hauteur: 240, xmin: 0, xmax: tMax, ymin: 0, ymax: iMax, pasX: 5, xlabel: "temps (min)", ylabel: "IPI (modèle indicatif)",
      zones: [{ x0: 0, x1: tMax, y0: 0, y1: e.ipiH, couleur: COULEURS.rouge, opacite: 0.07, libelle: "état h ou th", position: "droite" }],
      series: [
        { points: [[0, e.ipiH], [tMax, e.ipiH]], couleur: COULEURS.rouge, tirets: "6 4", epaisseur: 1.5, libelle: `IPI = ${e.ipiH} : limite de l'état h` },
        { points: H.map(([x, , , base]) => [x, base]), couleur: "#94a3b8", tirets: "4 3", epaisseur: 1.8, libelle: "effet de la seule baisse de w" },
        { points: H.map(([x, , ipi]) => [x, ipi]), couleur: COULEURS.gtr24, epaisseur: 2.4, libelle: "IPI du sol traité (indicatif)" },
      ],
    });
  }

  function bilan() {
    const { s, ch, fin, cle } = e, wO = s.wOPN;
    const ic = (w) => (s.wL != null ? indiceConsistance({ wL: s.wL, wP: s.wP, w }) : NaN);
    const ipi0 = e.ipi(ch.w0), ipiF = e.ipi(fin.wFinal) * (1 + K_IPI * e.dosageMesure);
    const avant = etatHydrique(cle, { IPI: ipi0, Ic: ic(ch.w0), w: ch.w0, wOPN: wO });
    const apres = etatHydrique(cle, { IPI: ipiF, Ic: ic(fin.wFinal), w: fin.wFinal, wOPN: wO });
    const sc = s.classe.match(/^[A-Z]+\d/)[0], parPct = fin.baisse / e.dosageMesure;
    const sorti = apres.applicable && apres.etat !== "h" && apres.etat !== "th";
    const besoin = sorti ? null : dosagePour({ w: ch.w0, wVise: e.rH * wO - 0.05, eta: e.meteo.eta });
    const verdict = sorti
      ? `le sol passe de l'état ${avant.etat} à l'état ${apres.etat} (${sc}${apres.etat}) : il se compacte désormais dans de bonnes conditions — c'est l'effet recherché par le traitement à la chaux que prévoient les conditions d'utilisation du GTR (rubrique T)${apres.discordance ? ` ; les critères ne concordent pas tout à fait (${apres.mesures.map(([n, et, x]) => `${n} = ${fd(x, 2)} → ${et}`).join(", ")}) : le GTR fait primer l'IPI pour les états humides` : ""}`
      : `le sol reste à l'état ${apres.etat ?? "h"} : il faudrait environ ${Number.isFinite(besoin) ? fd(besoin, 1) : "plus de 4"} % de chaux vive par ce temps (dosage du solveur pour descendre sous ${fd(e.rH, 2)} wOPN), ou attendre un temps plus sec`;
    c.bilan.innerHTML = `<p class="final-result">Chaux épandue : <strong>${fd(e.q, 1)} kg/m²</strong> visés ; la bâche en a recueilli ${fd(e.mBache, 2)} kg, soit un dosage mesuré de <strong>${fd(e.dosageMesure, 2)} %</strong>. La teneur en eau passe de ${fd(ch.w0, 1)} à <strong>${fd(fin.wFinal, 1)} %</strong> (−${fd(fin.baisse, 1)} point${fin.baisse >= 2 ? "s" : ""}, soit ${fd(parPct, 2)} point par % de chaux : l'ordre de grandeur de la règle « environ un point par % de chaux vive ») ; ${verdict}.
        <small>q = d ρd e = ${fd(e.dosage, 1)} % × ${fd(s.rhoDOPN, 2)} Mg/m³ × ${fd(e.ep, 2)} m × 1 000 (ρd pris à l'optimum Proctor). L'hydratation fixe ${fd(fin.eauHydratation, 2)} point d'eau, la chaleur en vaporise ${fd(fin.eauEvaporee, 2)} (η = ${fd(e.meteo.eta, 1)}) et la chaux ajoutée dilue le reste. IPI ${f(ipi0, 2)} → ${f(ipiF, 2)} : modèle indicatif (IPI du sol à la nouvelle teneur en eau, majoré de 30 % par % de chaux). Le calculateur du cours refait ces calculs.</small></p>`;
  }

  b = boucle({ avancer, dessiner, dessinerLent, surFin: bilan, surEtat: () => etatBoutons?.(), pasMax: 5 });
  etatBoutons = brancherMarche(c, b, reinit);
  c.commandes.querySelectorAll("[data-r]").forEach((x) => x.addEventListener("change", () => { b.raz(); reinit(); etatBoutons(); }));
  reinit();
  etatBoutons();
}
