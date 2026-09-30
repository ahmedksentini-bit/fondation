// Mode impression du cours (cours.html?impression=1), utilisé par
// tools/polycopie.py : une fois les calculateurs exécutés, chaque champ de
// saisie est remplacé par sa valeur. Sur papier, un menu déroulant ou un
// curseur n'a pas de sens ; la valeur qu'il porte, si.
if (new URLSearchParams(location.search).has("impression")) {
  document.documentElement.classList.add("impression");
  window.addEventListener("load", () => setTimeout(() => {
    // Les réglettes de calcul en direct doublent leur case : seule la case s'imprime.
    for (const r of document.querySelectorAll(".curseur")) r.remove();
    // Un tableau de relevés s'imprime tel quel, en chasse fixe.
    for (const zone of document.querySelectorAll(".calc textarea")) {
      const pre = document.createElement("pre");
      pre.className = "valeur-imprimee releves-imprimes";
      pre.textContent = zone.value.trim() || "—";
      zone.replaceWith(pre);
    }
    for (const champ of document.querySelectorAll(".calc input, .calc select")) {
      const wrap = champ.closest(".input-wrap");
      const u = wrap?.querySelector(".unit")?.textContent.trim() ?? "";
      const unite = u === "—" ? "" : u;
      const valeur = champ.tagName === "SELECT" ? champ.options[champ.selectedIndex]?.text ?? "" : champ.value;
      // Un curseur affiche déjà sa valeur dans son étiquette d'unité (« 30° »).
      const texte = champ.type === "range" ? (unite || valeur) : !String(valeur).trim() ? "—" : unite ? `${valeur} ${unite}` : valeur;
      const span = document.createElement("span");
      span.className = "valeur-imprimee";
      span.textContent = texte;
      (wrap && wrap.querySelectorAll("input, select").length === 1 ? wrap : champ).replaceWith(span);
    }
  }, 600));
}
