// Portance sismique (NF EN 1998-5, annexe F) : contrôle sur des lignes des
// classeurs d'étude paramétrique fournis avec le cours (docs/ec8), qui
// appliquent l'annexe avec γM = γRd = 1, g = 10 m/s², γI agR = 0,476 g, S = 1,5.
import test from "node:test";
import assert from "node:assert/strict";
import * as s from "../src/geotech/sismique.js";

const proche = (obtenu, attendu, tol, msg) =>
  assert.ok(Math.abs(obtenu - attendu) <= tol, `${msg} : obtenu ${obtenu}, attendu ${attendu} (± ${tol})`);

const alphaG = 1.4 * 0.34, S = 1.5;

test("sols cohérents — lignes des classeurs Argile et Limon", () => {
  const cas = [
    { cu: 133.788618242323, B: 2.35, L: 10, N: 7489.57543541908, V: 1058.59078828216, M: 2744.78771770954, Nmax: 1616.5334552183, Fb: 0.25082851172899, eq: -0.60143637800788 },
    { cu: 425.672189915747, B: 2.81, L: 13.92, N: 12678.6167096133, V: 3004.48126610498, M: 5339.30835480664, Nmax: 6150.0587426683, Fb: 0.09426690526328, eq: -0.83079015702898 },
    { cu: 115.168925299585, B: 2.43, L: 10.99, N: 7489.57543541908, V: 1058.59078828216, M: 2744.78771770954, Nmax: 1438.9286315885, Fb: 0.30130002437494, eq: -0.60096085057529 },
  ];
  for (const c of cas) {
    const Nmax = s.nmaxCoherent({ cu: c.cu, B: c.B, gammaM: 1 });
    proche(Nmax, c.Nmax, 1e-6 * c.Nmax, "Nmax (kN/m)");
    const Fb = s.inertieSol({ sol: "coherent", gamma: 20, alphaG, S, B: c.B, cu: c.cu, gammaM: 1 });
    proche(Fb, c.Fb, 1e-9, "F̄");
    const r = s.portanceSismique({ sol: "coherent", N: c.N / c.L, V: c.V / c.L, M: c.M / c.L, B: c.B, Nmax, Fb });
    proche(r.valeur, c.eq, 1e-9, "critère F.1");
    assert.ok(r.ok);
  }
});

test("sols frottants — lignes des classeurs Sable et Gravier", () => {
  const cas = [
    { phi: 31.8619692942739, B: 3.86, L: 15.83, N: 7489.57543541908, V: 1058.59078828216, M: 2744.78771770954, Ng: 27.104291468467565, Nmax: 2596.711140481819, Fb: 0.765858624054736, eq: -0.000397993308501432 },
    { phi: 38.3482708870166, B: 3.6, L: 15.22, N: 12678.6167096133, V: 3004.48126610498, M: 5339.30835480664, Ng: 79.5162351621253, Nmax: 6626.310521518371, Fb: 0.6016776628952334, eq: -0.00018020103584870384 },
    { phi: 30.9309846471369, B: 4.47, L: 13.5, N: 7489.57543541908, V: 1058.59078828216, M: 2744.78771770954, Ng: 23.33049, Nmax: 2997.43517, Fb: 0.79436, eq: -0.0004 },
  ];
  for (const c of cas) {
    const n = s.nmaxFrottant({ gamma: 20, B: c.B, phi: c.phi, gammaPhi: 1, avg: 0.5 * alphaG * S });
    proche(n.Ngamma, c.Ng, 1e-4, "Nγ");
    proche(n.Nmax, c.Nmax, 1e-5 * c.Nmax, "Nmax (1 − av/g)");
    const Fb = s.inertieSol({ sol: "frottant", alphaG, phiD: n.phiD });
    proche(Fb, c.Fb, 1e-5, "F̄ = ag/(g tanφ')");
    const r = s.portanceSismique({ sol: "frottant", N: c.N / c.L, V: c.V / c.L, M: c.M / c.L, B: c.B, Nmax: n.Nmax, Fb });
    proche(r.valeur, c.eq, 1e-4, "critère F.1 (à la limite, par construction des classeurs)");
  }
});

test("la surface limite se referme sur N̄ = 0 et N̄ = (1 − m F̄^k)^k'", () => {
  for (const sol of ["coherent", "frottant"]) {
    const c = s.coupeSurfaceLimite({ sol, Fb: 0.2 });
    assert.ok(c.points.every(([, m]) => m >= 0));
    const Mmax = Math.max(...c.points.map((p) => p[1]));
    assert.ok(Mmax > 0.01 && Mmax < 0.3, `${sol} : M̄ max ${Mmax}`);
    // Sans inertie du sol, la surface est plus large.
    const c0 = s.coupeSurfaceLimite({ sol, Fb: 0 });
    assert.ok(c0.lim > c.lim);
  }
  assert.equal(s.portanceSismique({ sol: "mixte", N: 1, B: 1, Nmax: 1, Fb: 0 }).applicable, false);
});
