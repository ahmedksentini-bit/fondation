// Bancs d'essai du cours : chaque <div class="banc" data-banc="nom"> reçoit son
// bouton de lancement ; le module du banc (src/bancs/nom.js) n'est chargé qu'à
// l'ouverture, pour que la page reste légère. À l'impression, le banc se
// réduit à son titre et à une mention.
const MODULES = {
  tamisage: () => import("./bancs/tamisage.js"),
  sedimentometrie: () => import("./bancs/sedimentometrie.js"),
  casagrande: () => import("./bancs/casagrande.js"),
  bleu: () => import("./bancs/bleu.js"),
  "equivalent-sable": () => import("./bancs/equivalent-sable.js"),
  proctor: () => import("./bancs/proctor.js"),
  ipi: () => import("./bancs/ipi.js"),
  losangeles: () => import("./bancs/losangeles.js"),
  microdeval: () => import("./bancs/microdeval.js"),
  fragmentabilite: () => import("./bancs/fragmentabilite.js"),
  compacteur: () => import("./bancs/compacteur.js"),
  gammadensimetre: () => import("./bancs/gammadensimetre.js"),
  panda: () => import("./bancs/panda.js"),
  plaque: () => import("./bancs/plaque.js"),
  dynaplaque: () => import("./bancs/dynaplaque.js"),
  chantier: () => import("./bancs/chantier.js"),
  traitement: () => import("./bancs/traitement.js"),
  gel: () => import("./bancs/gel.js"),
};

for (const banc of document.querySelectorAll(".banc[data-banc]")) {
  const charger = MODULES[banc.dataset.banc];
  const bouton = banc.querySelector(".banc-ouvrir");
  if (!charger || !bouton) continue;
  bouton.addEventListener("click", async () => {
    bouton.disabled = true;
    bouton.textContent = "Chargement du banc…";
    try {
      const m = await charger();
      bouton.remove();
      m.monter(banc);
    } catch (e) {
      console.error(e);
      bouton.disabled = false;
      bouton.textContent = "Lancer le banc d'essai";
      banc.insertAdjacentHTML("beforeend", `<p class="method-note">Le banc n'a pas pu se charger : ${String(e.message).replace(/[<>&]/g, "")}</p>`);
    }
  });
}
