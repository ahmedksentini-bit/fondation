// Matériaux virtuels des bancs d'essai : chaque sol, chaque roche a un jeu
// complet de propriétés cohérentes entre elles — courbe granulométrique,
// limites d'Atterberg, valeur de bleu, courbe Proctor, indice portant,
// résistance mécanique — si bien que tous les essais du cours racontent le
// même matériau et aboutissent à la même classe du GTR 2024. Ce ne sont pas
// des corrélations de projet : ce sont des matériaux d'entraînement, dont les
// valeurs restent dans les ordres de grandeur des sols réels.

import { rhoDSaturation } from "../gtr/proctor.js";

/**
 * Courbe Proctor d'un sol : ρd(w) en cloche. Côté sec, une cloche
 * dissymétrique (k : finesse ; sols fins : cloche large). Côté humide, le
 * sol ne peut plus chasser l'air qui reste : la courbe longe les courbes de
 * saturation, le degré de saturation montant de sa valeur à l'optimum vers
 * SrMax (≈ 95 %, ou 15 points de plus qu'à l'optimum pour un sol grenu peu
 * saturé), avec une pente nulle au sommet. Plafond : 98 % de la courbe de
 * saturation totale.
 */
export function courbeProctor({ wOPN, rhoDOPN, rhoS, k = 0.0035, SrMax = 0.95 }) {
  const w0 = wOPN / 100;
  const Sr0 = (w0 * rhoS) / (rhoS / rhoDOPN - 1); // saturation à l'optimum (ρw = 1)
  // Les sols grenus propres, à l'optimum peu saturé, ne gagnent qu'une quinzaine de points de saturation.
  const SrM = Math.min(0.99, Math.max(Math.min(SrMax, Sr0 + 0.15), Sr0 + 0.03));
  const a = Sr0 / (w0 * (SrM - Sr0)); // dρd/dw = 0 à l'optimum
  return (w) => {
    const d = w - wOPN;
    if (d <= 0) {
      const brut = rhoDOPN * (1 - k * d * d - 0.0004 * Math.abs(d) ** 3 * 0.2);
      return Math.min(brut, 0.98 * rhoDSaturation(w, { rhoS }));
    }
    const x = w / 100, Sr = SrM - (SrM - Sr0) * Math.exp(-a * (x - w0));
    return Math.min(rhoS / (1 + (x * rhoS) / Sr), 0.98 * rhoDSaturation(w, { rhoS }));
  };
}

/**
 * Indice portant immédiat en fonction de la teneur en eau : maximal du côté
 * sec, il chute vite au-delà de l'optimum. ipiOPN : valeur à wOPN ; pente :
 * chute relative par point de teneur en eau au-delà de l'optimum.
 */
export function courbeIPI({ wOPN, ipiOPN, pente = 0.18, sec = 0.06 }) {
  return (w) => {
    const d = w - wOPN;
    return d >= 0 ? ipiOPN * Math.exp(-pente * d) : ipiOPN * (1 + sec * -d);
  };
}

/** Sols : propriétés de la fraction 0/63 mm, sauf mention. */
export const SOLS = {
  limon: {
    nom: "Limon des plateaux", motif: "limon", classe: "F1h",
    granulo: [[0.002, 14], [0.006, 30], [0.02, 58], [0.063, 86], [0.125, 93], [0.25, 97], [0.5, 99], [1, 100], [2, 100]],
    Dmax: 1, rhoS: 2.68, wL: 31, wP: 22, VBS: 1.8, ES: null, MO: 0.8,
    wn: 17.6, wOPN: 15.5, rhoDOPN: 1.79, ipiOPN: 12, penteIPI: 0.3, CBRi: 4, pGel: 0.6,
    texte: "lœss limoneux du Bassin parisien, peu plastique, très sensible à l'eau",
  },
  argile: {
    nom: "Argile marneuse", motif: "argile", classe: "F3m",
    granulo: [[0.001, 22], [0.002, 32], [0.006, 50], [0.02, 70], [0.063, 91], [0.25, 97], [1, 99], [2, 100]],
    Dmax: 2, rhoS: 2.70, wL: 58, wP: 26, VBS: 6.8, ES: null, MO: 1.2,
    wn: 24.5, wOPN: 22.5, rhoDOPN: 1.6, ipiOPN: 9, penteIPI: 0.2, CBRi: 2, pGel: 0.3,
    texte: "argile marneuse plastique, collante à l'état humide, très lente à sécher",
  },
  sableArgileux: {
    nom: "Sable argileux", motif: "sable", classe: "I2m",
    granulo: [[0.002, 6], [0.02, 15], [0.063, 26], [0.125, 44], [0.25, 63], [0.5, 80], [1, 90], [2, 95], [4, 98], [8, 100]],
    Dmax: 6, rhoS: 2.66, wL: 34, wP: 18, VBS: 2.3, ES: 12, MO: 0.5,
    wn: 12.3, wOPN: 12, rhoDOPN: 1.9, ipiOPN: 22, penteIPI: 0.2, CBRi: 8, pGel: 0.5,
    texte: "sable argileux d'altération, plastique, sensible à l'eau",
  },
  sableDune: {
    nom: "Sable de dune", motif: "sable", classe: "S21ins",
    granulo: [[0.063, 1.5], [0.1, 6], [0.125, 12], [0.16, 30], [0.2, 52], [0.25, 74], [0.315, 90], [0.4, 97], [0.5, 99], [1, 100]],
    Dmax: 0.4, rhoS: 2.65, wL: null, wP: null, VBS: 0.05, ES: 86, MO: 0.1, FS: 25,
    wn: 4, wOPN: 11, rhoDOPN: 1.68, ipiOPN: 12, penteIPI: 0.05, CBRi: 15, pGel: 0.02,
    texte: "sable fin propre, homométrique, insensible à l'eau mais peu traficable",
  },
  graveAlluvionnaire: {
    nom: "Grave alluvionnaire", motif: "grave", classe: "G31ins",
    granulo: [[0.063, 7], [0.125, 10], [0.25, 13], [0.5, 17], [1, 23], [2, 30], [4, 40], [8, 53], [16, 68], [31.5, 87], [50, 96], [63, 100]],
    Dmax: 48, rhoS: 2.66, wL: null, wP: null, VBS: 0.15, ES: 45, MO: 0.2, LA: 22, MDE: 16,
    wn: 5.5, wOPN: 6.5, rhoDOPN: 2.16, ipiOPN: 45, penteIPI: 0.08, CBRi: 40, pGel: 0.04,
    texte: "grave roulée de terrasse, à granulométrie étalée et peu de fines",
  },
  graveArgileuse: {
    nom: "Grave argileuse", motif: "grave", classe: "G31h",
    granulo: [[0.002, 3], [0.02, 7], [0.063, 11], [0.25, 16], [1, 24], [2, 31], [4, 41], [8, 55], [16, 70], [31.5, 88], [63, 100]],
    Dmax: 55, rhoS: 2.67, wL: 30, wP: 17, VBS: 0.6, ES: 22, MO: 0.4, LA: 24, MDE: 18,
    wn: 9.3, wOPN: 8, rhoDOPN: 2.08, ipiOPN: 22, penteIPI: 0.4, CBRi: 14, pGel: 0.25,
    texte: "grave de piémont à matrice argileuse, sensible à l'eau",
  },
  graveConcassee: {
    nom: "Grave calcaire concassée 0/31,5", motif: "grave", classe: "G11ins",
    granulo: [[0.063, 4], [0.125, 6], [0.5, 12], [1, 17], [2, 24], [4, 34], [8, 48], [16, 67], [31.5, 96], [40, 100]],
    Dmax: 30, rhoS: 2.7, wL: null, wP: null, VBS: 0.08, ES: 60, MO: 0, LA: 27, MDE: 20,
    wn: 3, wOPN: 5.5, rhoDOPN: 2.22, ipiOPN: 60, penteIPI: 0.06, CBRi: 70, pGel: 0.02,
    texte: "grave non traitée de carrière, propre et résistante",
  },
};

/** Roches et granulats des essais mécaniques. */
export const ROCHES = {
  basalte: { nom: "Basalte", famille: "Vo", LA: 12, MDE: 7, IFR: 1.2, IDGa: 1.05, rhoD: 2.85, couleur: "#475569" },
  calcaireDur: { nom: "Calcaire dur", famille: "Li", LA: 23, MDE: 18, IFR: 1.6, IDGa: 1.1, rhoD: 2.6, couleur: "#cbd5e1" },
  calcaireTendre: { nom: "Calcaire tendre", famille: "Li", LA: 42, MDE: 58, IFR: 4.5, IDGa: 1.6, rhoD: 1.75, couleur: "#e7e5e4" },
  gres: { nom: "Grès friable", famille: "Sa", LA: 55, MDE: 48, IFR: 5, IDGa: 3, rhoD: 2.2, couleur: "#d6c7a1" },
  schiste: { nom: "Schiste argileux", famille: "Cl", LA: 48, MDE: 62, IFR: 5.5, IDGa: 24, rhoD: 2.35, couleur: "#64748b" },
  marne: { nom: "Marne", famille: "Cl", LA: null, MDE: null, IFR: 14, IDGa: 30, rhoD: 2.1, couleur: "#a8b29a", w: 16, wOPN: 15 },
  craie: { nom: "Craie de densité moyenne", famille: "CH", LA: null, MDE: null, IFR: 9, IDGa: 2, rhoD: 1.62, wn: 24, couleur: "#f1f5f9" },
};

/** Courbe Proctor normale d'un sol du catalogue. */
export const proctorDe = (s) => courbeProctor({ wOPN: s.wOPN, rhoDOPN: s.rhoDOPN, rhoS: s.rhoS, k: s.VBS > 2 ? 0.0028 : s.VBS < 0.2 ? 0.0035 : 0.0045 });

/** Courbe IPI d'un sol du catalogue. */
export const ipiDe = (s) => courbeIPI({ wOPN: s.wOPN, ipiOPN: s.ipiOPN, pente: s.penteIPI ?? 0.15 });

/**
 * Proctor modifié : énergie 4,5 fois plus forte — optimum plus sec d'environ
 * 2 à 3 points et plus dense de 4 à 8 %, d'autant plus que le sol est fin.
 */
export function proctorModifieDe(s) {
  const fin = s.granulo.find(([d]) => d === 0.063)?.[1] ?? 20;
  const dw = 1.5 + 0.02 * fin, gain = 1.04 + 0.0005 * fin;
  return courbeProctor({ wOPN: s.wOPN - dw, rhoDOPN: Math.min(s.rhoDOPN * gain, 0.97 * rhoDSaturation(s.wOPN - dw, { rhoS: s.rhoS })), rhoS: s.rhoS, k: 0.005 });
}
