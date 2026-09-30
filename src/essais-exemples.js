// Jeux d'exemple du chapitre des essais en place, fabriqués pour le cours avec
// une graine fixe : un sondage au piézocône à travers cinq couches et un essai
// de pompage suivi dans un piézomètre (solution de Theis).

import { creerAlea } from "./exos/alea.js";
import { Wtheis } from "./geotech/essais.js";

/**
 * Sondage CPTU : z (m), qc (MPa), fs (kPa), u2 (kPa), une mesure tous les
 * 20 cm. Chaque couche a sa résistance, son rapport de frottement et son
 * coefficient de pression interstitielle Bq ; u2 = u0 + Bq (qt − σv0).
 */
export function cptuExemple({ gamma = 18.5, zw = 1.5, a = 0.8 } = {}) {
  const alea = creerAlea(20250);
  const bruit = (amp) => (alea.reel() - 0.5) * 2 * amp;
  const couches = [
    { z1: 1.8, qc: (z) => 4.2, dqc: 1.4, Rf: 1.1, Bq: 0 },
    { z1: 6.2, qc: (z) => 0.45 + 0.06 * (z - 1.8), dqc: 0.06, Rf: 4.6, Bq: 0.55 },
    { z1: 8, qc: (z) => 2.4, dqc: 0.6, Rf: 2.4, Bq: 0.15 },
    { z1: 13.5, qc: (z) => 13 + 1.3 * (z - 8), dqc: 2.8, Rf: 0.6, Bq: 0 },
    { z1: 16.01, qc: (z) => 3.3, dqc: 0.35, Rf: 4.8, Bq: 0.25 },
  ];
  const lignes = [];
  for (let z = 0.2; z <= 16 + 1e-9; z += 0.2) {
    const c = couches.find((k) => z < k.z1);
    const qc = Math.max(0.15, c.qc(z) + bruit(c.dqc));
    const Rf = c.Rf * (1 + bruit(0.2));
    const sv = gamma * z, u0 = 9.81 * Math.max(0, z - zw);
    const u2 = z > zw ? Math.max(0, (u0 + c.Bq * (qc * 1000 - sv)) / (1 - c.Bq * (1 - a)) + bruit(8)) : 0;
    lignes.push([+z.toFixed(1), +qc.toFixed(2), +((Rf / 100) * qc * 1000).toFixed(1), +u2.toFixed(0)]);
  }
  return lignes.map((l) => l.join(" ")).join("\n");
}

/**
 * Pompage à débit constant Q (m³/s) dans un aquifère captif de transmissivité
 * T et d'emmagasinement S ; rabattements (m) à r (m), temps en minutes.
 */
export function pompageExemple({ Q = 0.01, T = 7.7e-3, S = 4.4e-3, r = 20 } = {}) {
  const alea = creerAlea(1953);
  const temps = [1, 2, 3, 5, 7, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 360, 480];
  return temps.map((t) => {
    const u = (r * r * S) / (4 * T * t * 60);
    const s = (Q / (4 * Math.PI * T)) * Wtheis(u) + (alea.reel() - 0.5) * 0.006;
    return `${t} ${s.toFixed(3)}`;
  }).join("\n");
}
