// Moteur commun des bancs d'essai : charpente de l'interface (commandes,
// scène animée, courbes, bilan), boucle d'animation à vitesse réglable,
// coupe de terrain et panneaux de profil sur un même axe des profondeurs.
// La simulation avance en « temps d'essai » (secondes réelles de l'essai) ;
// la vitesse choisie fixe combien de secondes d'essai passent par seconde.
import { couche, ligne, texte, COULEURS, fmt, pasJoli } from "../figures.js";
import { poserCurseurs } from "../curseurs.js";

export const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const f = (x, c = 3) => (Number.isFinite(x) ? Number(x).toLocaleString("fr-FR", { maximumSignificantDigits: c }) : "—");
export const fd = (x, d = 2) => (Number.isFinite(x) ? Number(x).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—");
export const r1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : "0");

/** Durée d'essai lisible. */
export function duree(s) {
  if (!Number.isFinite(s)) return "—";
  if (s < 90) return `${fd(s, 0)} s`;
  if (s < 5400) return `${fd(s / 60, 1)} min`;
  if (s < 2 * 86400) return `${fd(s / 3600, 1)} h`;
  return `${fd(s / 86400, 1)} j`;
}

/**
 * Charpente d'un banc : remplace le contenu de lancement par les commandes,
 * la scène, les courbes et le bilan. commandes : HTML des réglages ; les
 * boutons de marche (démarrer, vitesse, fin, recommencer) sont ajoutés ici.
 */
export function charpente(banc, { commandes = "", vitesses = [1, 10, 100, 1000], vitesse = 10, boutons = true } = {}) {
  const corps = document.createElement("div");
  corps.className = "banc-corps";
  corps.innerHTML = `
    <div class="banc-commandes">
      <div class="data-grid">${commandes}</div>
      ${boutons ? `<div class="banc-marche">
        <button type="button" class="primary" data-action="marche">Démarrer</button>
        <span class="banc-vitesses" role="group" aria-label="Vitesse de l'essai">${vitesses.map((v) => `<button type="button" class="ghost${v === vitesse ? " actif" : ""}" data-vitesse="${v}">×${f(v, 4)}</button>`).join("")}</span>
        <button type="button" class="ghost" data-action="fin">Aller à la fin</button>
        <button type="button" class="ghost" data-action="raz">Recommencer</button>
      </div>` : ""}
    </div>
    <div class="banc-vue">
      <div class="banc-scene"></div>
      <div class="banc-lectures" aria-live="off"></div>
    </div>
    <div class="banc-courbes"></div>
    <div class="banc-bilan"></div>`;
  banc.appendChild(corps);
  poserCurseurs(corps);
  const q = (s) => corps.querySelector(s);
  return { corps, commandes: q(".banc-commandes"), scene: q(".banc-scene"), lectures: q(".banc-lectures"), courbes: q(".banc-courbes"), bilan: q(".banc-bilan"), q };
}

/**
 * Boucle d'animation. avancer(dt) fait progresser l'essai de dt secondes
 * d'essai et renvoie false quand il est fini ; dessiner() met la scène à jour
 * (à chaque image) ; dessinerLent() les courbes, au plus quelques fois par seconde.
 */
export function boucle({ avancer, dessiner, dessinerLent = () => {}, surFin = () => {}, surEtat = () => {} }) {
  let enCours = false, fini = false, vitesse = 1, dernier = null, dernierLent = 0, id = null, parMinuteur = false;
  // Page cachée : requestAnimationFrame ne tourne plus ; un minuteur prend le relais, et
  // un long essai continue pendant qu'on lit autre chose.
  const planifier = () => {
    parMinuteur = typeof document !== "undefined" && document.hidden;
    id = parMinuteur ? setTimeout(() => image(performance.now()), 100) : requestAnimationFrame(image);
  };
  const annuler = () => (parMinuteur ? clearTimeout(id) : cancelAnimationFrame(id));
  const image = (t) => {
    if (!enCours) return;
    const dt = dernier === null ? 0 : Math.min(parMinuteur ? 1 : 0.1, (t - dernier) / 1000);
    dernier = t;
    let reste = dt * vitesse, continuer = true;
    // Pas de calcul bornés : une seconde d'essai au plus par appel.
    while (reste > 1e-9 && continuer !== false) { const h = Math.min(reste, 1); continuer = avancer(h); reste -= h; }
    dessiner();
    if (t - dernierLent > 140 || continuer === false) { dernierLent = t; dessinerLent(); }
    if (continuer === false) { enCours = false; fini = true; surEtat(); surFin(); return; }
    planifier();
  };
  return {
    get enCours() { return enCours; },
    get fini() { return fini; },
    lancer() { if (fini || enCours) return; enCours = true; dernier = null; surEtat(); planifier(); },
    pause() { enCours = false; annuler(); surEtat(); },
    vitesse(v) { vitesse = v; },
    /** Termine l'essai sans animation (avance par grands pas). */
    finir(pasMax = 5) {
      annuler(); enCours = false;
      for (let k = 0; k < 2e6 && !fini; k++) if (avancer(pasMax) === false) fini = true;
      fini = true; dessiner(); dessinerLent(); surEtat(); surFin();
    },
    raz() { annuler(); enCours = false; fini = false; dernier = null; surEtat(); },
  };
}

/** Branche les boutons de marche d'une charpente sur une boucle ; reinitialiser() refait l'essai. */
export function brancherMarche(c, b, reinitialiser) {
  const marche = c.q('[data-action="marche"]');
  const etat = () => {
    if (!marche) return;
    marche.textContent = b.fini ? "Essai terminé" : b.enCours ? "Pause" : "Démarrer";
    marche.disabled = b.fini;
  };
  marche?.addEventListener("click", () => (b.enCours ? b.pause() : b.lancer()));
  c.q('[data-action="fin"]')?.addEventListener("click", () => b.finir());
  c.q('[data-action="raz"]')?.addEventListener("click", () => { b.raz(); reinitialiser(); etat(); });
  c.corps.querySelectorAll("[data-vitesse]").forEach((x) => x.addEventListener("click", () => {
    c.corps.querySelectorAll("[data-vitesse]").forEach((y) => y.classList.toggle("actif", y === x));
    b.vitesse(Number(x.dataset.vitesse));
  }));
  const actif = c.corps.querySelector("[data-vitesse].actif");
  if (actif) b.vitesse(Number(actif.dataset.vitesse));
  return etat;
}

/** Afficheurs numériques : [[libellé, valeur, unité]]. */
export const lectures = (items) => items.map(([l, v, u]) => `<div class="afficheur"><span>${l}</span><strong>${v}</strong>${u ? `<small>${u}</small>` : ""}</div>`).join("");

// ─────────────────────── Coupe de terrain et profils ─────────────────────

/**
 * Coupe du terrain sur l'axe des profondeurs : couches (motifs du site),
 * nappe, noms des couches. Y(z) donne l'ordonnée ; [x0, x1] la bande dessinée.
 */
export function coupe(id, { x0, x1, Y, couches, zMax, zw = null, noms = true }) {
  let s = "";
  for (const c of couches) {
    if (c.z0 >= zMax) continue;
    s += couche(id, { x: x0, y: Y(c.z0), w: x1 - x0, h: Y(Math.min(c.z1, zMax)) - Y(c.z0), sol: c.sol });
  }
  s += ligne(x0, Y(0), x1, Y(0), COULEURS.trait, 1.8);
  if (zw !== null && zw < zMax) s += ligne(x0, Y(zw), x1, Y(zw), COULEURS.eau, 1.2, 'stroke-dasharray="6 4"') + `<path d="M${r1(x1 - 14)} ${r1(Y(zw) - 1)}l6-9h-12z" fill="${COULEURS.eau}"/>`;
  if (noms) for (const c of couches) if (c.z0 < zMax && Y(Math.min(c.z1, zMax)) - Y(c.z0) > 16)
    s += texte(x0 + 5, Y(c.z0) + 13, c.nom, 'class="halo" style="font-size:10.5px;font-weight:700"');
  return s;
}

/** Axe des profondeurs gradué. */
export function axeProfondeur({ x, Y, zMax, pas = null }) {
  const p = pas ?? pasJoli(zMax, 6);
  let s = ligne(x, Y(0), x, Y(zMax), COULEURS.trait, 1);
  for (let z = 0; z <= zMax + 1e-9; z += p) s += ligne(x - 4, Y(z), x, Y(z), COULEURS.trait, 1) + texte(x - 6, Y(z) + 4, fmt(z, 3), `text-anchor="end" style="font-size:10px;fill:${COULEURS.discret}"`);
  return s + texte(x - 2, Y(0) - 8, "z (m)", `text-anchor="end" style="font-size:10px;fill:${COULEURS.discret}"`);
}

/**
 * Panneau de profil : cadre, grille et graduations ; renvoie le SVG et
 * l'abscisse X(v). Échelle linéaire de 0 à vMax, ou logarithmique de vMin à vMax.
 */
export function panneau({ x0, x1, Y, zMax, vMin = 0, vMax, titre, log = false, pas = null }) {
  const X = log ? (v) => x0 + ((Math.log10(Math.max(v, vMin)) - Math.log10(vMin)) / (Math.log10(vMax) - Math.log10(vMin))) * (x1 - x0)
    : (v) => x0 + ((v - vMin) / (vMax - vMin)) * (x1 - x0);
  let s = `<rect x="${r1(x0)}" y="${r1(Y(0))}" width="${r1(x1 - x0)}" height="${r1(Y(zMax) - Y(0))}" fill="#fff" stroke="${COULEURS.trait}" stroke-width="1"/>`;
  const pz = pasJoli(zMax, 6);
  for (let z = pz; z < zMax; z += pz) s += ligne(x0, Y(z), x1, Y(z), COULEURS.grille, 1);
  const ticks = [];
  if (log) { for (let d = Math.ceil(Math.log10(vMin)); d <= Math.log10(vMax) + 1e-9; d++) ticks.push(10 ** d); }
  else { const p = pas ?? pasJoli(vMax - vMin, 4); for (let v = Math.ceil(vMin / p) * p; v <= vMax + 1e-9; v += p) ticks.push(v); }
  for (const v of ticks) {
    s += ligne(X(v), Y(0), X(v), Y(zMax), COULEURS.grille, 1);
    s += texte(X(v), Y(0) - 4, fmt(v, 4), `text-anchor="middle" style="font-size:9.5px;fill:${COULEURS.discret}"`);
  }
  s += texte((x0 + x1) / 2, Y(0) - 17, titre, 'text-anchor="middle" style="font-size:11px;font-weight:700"');
  return { svg: s, X };
}

/** Points « x,y » d'une polyligne. */
export const points = (pts) => pts.map(([x, y]) => `${r1(x)},${r1(y)}`).join(" ");
