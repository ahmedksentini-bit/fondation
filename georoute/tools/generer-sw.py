# Régénère la coquille du service worker (sw.js) d'après les fichiers réels :
# pages, feuilles de style, tous les modules de src/ et toutes les données.
#   py tools/generer-sw.py            (garde la version courante)
#   py tools/generer-sw.py georoute-v2    (change de version : les clients rechargent)
import json, os, re, sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(RACINE)

ancien = open("sw.js", encoding="utf-8").read() if os.path.exists("sw.js") else ""
m = re.search(r'const VERSION = "([^"]+)"', ancien)
version = sys.argv[1] if len(sys.argv) > 1 else (m.group(1) if m else "georoute-v1")

# Les pages sous leurs deux formes d'adresse : Cloudflare Pages sert /cours et
# redirige /cours.html ; le serveur local ne connaît que /cours.html. La forme
# absente échoue à l'installation sans conséquence (Promise.allSettled).
pages = ["./", "./index.html", "./cours.html", "./exerciseur.html", "./bureau.html",
         "./cours", "./exerciseur", "./bureau",
         "./styles.css", "./enhancements.css", "./site.css", "./assets/icon.svg", "./manifest.webmanifest"]
modules = []
for dossier, _, fichiers in os.walk("src"):
    for f in sorted(fichiers):
        if f.endswith(".js"):
            modules.append("./" + os.path.join(dossier, f).replace(os.sep, "/"))
modules.sort()
donnees = ["./data/" + f for f in sorted(os.listdir("data")) if f.endswith(".json")]


def bloc(liste, par):
    return "\n".join("  " + ", ".join(json.dumps(x, ensure_ascii=False) for x in liste[i:i + par]) + ","
                     for i in range(0, len(liste), par))


corps = open(os.path.join("tools", "sw-modele.js"), encoding="utf-8").read()
coquille = "\n".join([
    bloc(pages, 5),
    "  // Modules : pages, solveurs, modèles d'exercices, bureau de calcul.",
    bloc(modules, 3),
    "  // Les données : un chapitre sans son fichier est un chapitre vide hors ligne.",
    bloc(donnees, 3),
])
sortie = corps.replace("__VERSION__", version).replace("  __COQUILLE__", coquille)
open("sw.js", "w", encoding="utf-8", newline="\n").write(sortie)
print(f"sw.js : version {version}, {len(pages)} pages, {len(modules)} modules, {len(donnees)} fichiers de données")
