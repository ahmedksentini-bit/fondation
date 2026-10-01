// Bancs d'essai du cours : chaque <div class="banc" data-banc="nom"> reçoit son
// bouton de lancement ; le module du banc (src/bancs/nom.js) n'est chargé qu'à
// l'ouverture, pour que la page reste légère. À l'impression, le banc se
// réduit à son titre et à une mention.
const MODULES = {
  "penetro-dyn": () => import("./bancs/penetro-dyn.js"),
  cptu: () => import("./bancs/cptu.js"),
  spt: () => import("./bancs/spt.js"),
  scissometre: () => import("./bancs/scissometre.js"),
  pressiometre: () => import("./bancs/pressiometre.js"),
  oedometre: () => import("./bancs/oedometre.js"),
  triaxial: () => import("./bancs/triaxial.js"),
  forage: () => import("./bancs/forage.js"),
  piezometre: () => import("./bancs/piezometre.js"),
  dmt: () => import("./bancs/dmt.js"),
  cisaillement: () => import("./bancs/cisaillement.js"),
  plaque: () => import("./bancs/plaque.js"),
  pieu: () => import("./bancs/pieu.js"),
  lefranc: () => import("./bancs/lefranc.js"),
  lugeon: () => import("./bancs/lugeon.js"),
  pompage: () => import("./bancs/pompage.js"),
  refraction: () => import("./bancs/refraction.js"),
  crosshole: () => import("./bancs/crosshole.js"),
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
