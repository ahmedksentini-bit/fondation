// Calculateurs du chapitre 14 : profil en travers (surfaces de déblai et de
// remblai), foisonnement et compactage, volumes entre profils, épure de
// Lalanne et ligne de répartition.
import { el, num, f, fd, esc, brancher, garde, lireTableau } from "./ui.js";
import { graphe, COULEURS } from "./figures.js";
import { coupeProfil } from "./dessins-gtr.js";
import { profilTravers, volumes, epure, repartition, foisonnement, coefficientCompactage } from "./gtr/cubatures.js";

// ── Profil en travers ─────────────────────────────────────────────────────
const majProfil = garde("pfOut", () => {
  const tn = lireTableau(el("pfTn").value).filter((p) => p.length >= 2).map((p) => [p[0], p[1]]);
  const L = num("pfL");
  const r = profilTravers({ tn, zAxe: num("pfZ"), lg: L, ld: L, devers: num("pfDev"), fd: num("pfFd"), fr: num("pfFr") });
  if (!r.applicable) { el("pfOut").innerHTML = `<span class="verdict ko">profil impossible</span> <small>${esc(r.motif)}</small>`; el("pfFig").innerHTML = ""; return; }
  el("pfFig").innerHTML = coupeProfil(r);
  el("pfOut").innerHTML = `Déblai <strong>${fd(r.deblai, 2)} m²</strong> · remblai <strong>${fd(r.remblai, 2)} m²</strong> · emprise de ${fd(r.emprise[0], 1)} à ${fd(r.emprise[1], 1)} m (${fd(r.largeurEmprise, 1)} m)
    <small>${r.deblai > 0.05 && r.remblai > 0.05 ? "Profil mixte : le déblai d'un côté peut alimenter le remblai de l'autre, sans transport longitudinal." : r.deblai > 0.05 ? "Profil en déblai." : "Profil en remblai."}</small>`;
});
brancher(["pfTn", "pfZ", "pfL", "pfDev", "pfFd", "pfFr"], majProfil);

// ── Foisonnement ──────────────────────────────────────────────────────────
const majFoison = garde("foOut", () => {
  const V = num("foV"), Cf = num("foCf"), Ct = coefficientCompactage({ rhoDplace: num("foRp"), rhoDremblai: num("foRr") }), cap = num("foBenne");
  if (!(V > 0 && Cf >= 1 && Ct > 0)) { el("foOut").textContent = "Renseigner le volume, Cf ≥ 1 et les deux masses volumiques."; return; }
  const r = foisonnement({ Vplace: V, Cf, Ct });
  el("foOut").innerHTML = `${f(V, 5)} m³ en place → <strong>${f(r.Vfoisonne, 5)} m³ foisonnés</strong> à transporter${cap > 0 ? `, soit ${f(Math.ceil(r.Vfoisonne / cap), 5)} rotations de ${f(cap, 3)} m³` : ""} → <strong>${f(r.Vcompacte, 5)} m³ de remblai compacté</strong> (C<sub>t</sub> = ${fd(num("foRp"), 2)}/${fd(num("foRr"), 2)} = ${fd(Ct, 3)})
    <small>${Ct < 1 ? "Le remblai compacté est plus dense que le sol en place : il faut plus de déblai que de remblai." : "Le matériau compacté occupe plus de place qu'en place (roche, matériau surconsolidé) : un mètre cube de déblai fait plus d'un mètre cube de remblai."}</small>`;
});
brancher(["foV", "foCf", "foRp", "foRr", "foBenne"], majFoison);

// ── Épure de Lalanne ──────────────────────────────────────────────────────
const majLalanne = garde("lalOut", () => {
  const profils = lireTableau(el("lalProfils").value).filter((p) => p.length >= 3).map(([x, deblai, remblai]) => ({ x, deblai, remblai }));
  if (profils.length < 2) { el("lalOut").textContent = "Il faut au moins deux profils."; el("lalFig").innerHTML = ""; return; }
  const reemploi = num("lalReemploi"), Ct = num("lalCt"), c = num("lalC", 0);
  const v = volumes(profils), e = epure(v.troncons, { reemploi, Ct });
  const rep = repartition(e.points, c);
  const ys = e.points.map((p) => p[1]);
  const ymin = Math.min(0, c, ...ys), ymax = Math.max(0, c, ...ys), marge = 0.12 * (ymax - ymin || 1);
  el("lalFig").innerHTML = graphe({
    largeur: 620, hauteur: 300, xmin: e.points[0][0], xmax: e.points.at(-1)[0], ymin: ymin - marge, ymax: ymax + marge,
    xlabel: "abscisse le long du tracé (m)", ylabel: "volume cumulé (m³)",
    series: [
      { points: [[e.points[0][0], 0], [e.points.at(-1)[0], 0]], couleur: "#94a3b8", epaisseur: 1 },
      { points: e.points, couleur: COULEURS.bleu, epaisseur: 2.6, marqueurs: true, libelle: "épure de Lalanne" },
      { points: [[e.points[0][0], c], [e.points.at(-1)[0], c]], couleur: COULEURS.rouge, epaisseur: 1.8, tirets: "6 4", libelle: `ligne de répartition (${f(c, 4)} m³)` },
    ],
    marques: rep.coupes.map((x) => ({ x, y: c, couleur: COULEURS.rouge, rayon: 4 })),
  });
  const boucles = rep.boucles.map((b, i) => `boucle ${i + 1} (${f(b.de, 4)}–${f(b.a, 4)} m) : ${f(b.volume, 4)} m³ ${b.sens}, moment ${f(b.moment / 1000, 4)} × 10³ m³·m, distance moyenne <strong>${f(b.distance, 3)} m</strong>`).join("<br>");
  const debut = rep.debut, fin = rep.fin;
  const bout = (v_, ou) => (Math.abs(v_) < 1 ? "" : v_ > 0 ? `${ou} : ${f(v_, 4)} m³ en dépôt` : `${ou} : ${f(-v_, 4)} m³ d'emprunt`);
  el("lalOut").innerHTML = `Déblai ${f(v.total.deblai, 5)} m³ en place (${f(v.total.deblai * reemploi * Ct, 5)} m³ réutilisables, compactés) · remblai ${f(v.total.remblai, 5)} m³ · solde <strong>${e.solde >= 0 ? `+${f(e.solde, 4)} m³ (excédent)` : `−${f(-e.solde, 4)} m³ (déficit)`}</strong>
    <br>${boucles || "La ligne ne coupe pas l'épure : aucun transport équilibré."}
    <small>${[bout(-debut, "au début"), bout(fin, "à la fin")].filter(Boolean).join(" ; ")}${[bout(-debut, ""), bout(fin, "")].some(Boolean) ? ". " : ""}Moment total ${f(rep.momentTotal / 1000, 4)} × 10³ m³·m. En montant ou en descendant la ligne, on échange du transport longitudinal contre des dépôts et des emprunts : la bonne position est celle qui minimise le coût total.</small>`;
});
brancher(["lalProfils", "lalReemploi", "lalCt", "lalC"], majLalanne);
