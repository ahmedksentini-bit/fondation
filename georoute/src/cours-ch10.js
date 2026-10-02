// Calculateur du chapitre 10 : cas de PST et classe d'arase à long terme
// (tableau 17 du fascicule 1), avec la vérification d'une portance mesurée
// à court terme.
import { el, num, fd, esc, verdict, brancher, garde } from "./ui.js";
import { casPST, verifierArase, MODULE_AR } from "./gtr/pst.js";

const majPST = garde("psOut", () => {
  const trait = el("psTrait").value;
  el("psE").closest(".field").hidden = trait !== "stabilisation";
  const r = casPST({
    sousClasse: el("psClasse").value, etat: el("psEtat").value, traitement: trait, eTraitee: num("psE", 0),
    nappe: el("psNappe").value, drainage: el("psDrain").value === "oui", portanceCT: num("psEv2"),
  });
  if (!r.applicable) { el("psOut").innerHTML = `<span class="verdict ko">hors tableau</span> <small>${esc(r.motif)}</small>`; return; }
  const ev2 = num("psEv2");
  const controles = Number.isFinite(ev2) ? r.ar.map((a) => { const v = verifierArase({ EV2: ev2, ar: a }); return `${a} : ${verdict(v.ok, `${fd(ev2, 0)} ≥ ${v.cible} MPa`, `${fd(ev2, 0)} < ${v.cible} MPa`)}`; }).join(" ") : "";
  el("psOut").innerHTML = `<strong>${r.pst}</strong> · arase ${r.ar.map((a) => `<span class="classe">${a}</span>`).join(" ou ")}${r.ar[0] !== "AR0" ? ` (${r.ar.map((a) => `${MODULE_AR[a]} MPa`).join(" ou ")} à long terme)` : ""}
    <small>${esc(r.motif)}.${r.avertissements.length ? " " + r.avertissements.map(esc).join(" ") : ""}${controles ? `<br>Portance mesurée à court terme : ${controles}` : ""}</small>`;
});
brancher(["psClasse", "psEtat", "psNappe", "psDrain", "psTrait", "psE", "psEv2"], majPST);
