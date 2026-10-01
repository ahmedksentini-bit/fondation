# Fondations des ouvrages — Fascicule 62 titre V et Eurocode 7

Site de cours pour le génie civil : polycopié, cours interactif, exercices,
exerciseur et bureau de calcul. Chaque semelle et chaque pieu y est justifié
deux fois — au **Fascicule 62 titre V** du CCTG et à l'**Eurocode 7** avec ses
normes d'application **NF P94-261** (fondations superficielles) et
**NF P94-262** (fondations profondes) — pour voir ce qui change, et pourquoi.

Application web **statique** et PWA : aucun framework, aucune compilation. Même
architecture et même habillage que les sites de mécanique des fluides et
d'hydrologie.

## Contenu

| Ressource | Fichier | Rôle |
|---|---|---|
| Accueil | `index.html` | ressources, parties, chapitres, banques d'exercices (3 modes) |
| Cours interactif | `cours.html` | 16 chapitres, dont les sols compressibles et les remblais ; une cinquantaine de schémas explicatifs (dont les appareils d'essai), 55 calculateurs à curseurs de calcul en direct, dont l'assistant de dépouillement pressiométrique ; 18 bancs d'essai animés : sondage carotté (paramètres de forage, caisse à carottes, RQD), piézomètres ouvert et à cellule, pénétromètre dynamique, piézocône (avec dissipation), SPT, scissomètre, dilatomètre plat, pressiomètre, boîte de cisaillement, plaque, chargement statique de pieu, Lefranc, Lugeon, pompage (avec remontée), sismique réfraction, cross-hole, œdomètre et triaxial (UU, CU, CD) ; sous les afficheurs de chaque banc, une loupe montre l'organe de l'essai au travail (la pointe qui s'enfonce, le moulinet qui tourne, la membrane qui se gonfle, la couronne qui découpe la carotte, l'eau qui quitte l'éprouvette…) |
| Exerciseur | `exerciseur.html` | 105 modèles d'exercices à données tirées au hasard, corrigés pas à pas |
| Bureau de calcul | `bureau.html` | projet et tableau de bord, sondage pressiométrique (dépouillement de chaque essai déplié étape par étape, avec toutes ses courbes), semelle, pieu, frottement négatif, groupe, effort transversal, remblai sur sol compressible (consolidation multicouche, drains, étapes, tassement résiduel) — étapes numérotées, étude paramétrique, note de calcul avec cartouche |
| Polycopié | `polycopie/fondations-polycopie.pdf` | le cours complet, produit à partir de `cours.html` |

## Déploiement — Cloudflare Pages

| Réglage | Valeur |
|---|---|
| Framework preset | **None** |
| Build command | *(vide)* |
| Build output directory | **`/`** |
| Branche de production | `main` |

Domaine personnalisé : **`fond.ksr-infra.org`**. La zone `ksr-infra.org` étant
chez Cloudflare, l'enregistrement DNS et le certificat du sous-domaine sont
créés automatiquement lors de son ajout au projet Pages.

Le dossier `docs/` (normes, guides Cerema, tableurs du CSTB et des bureaux
d'études utilisés pour préparer le cours) est **exclu du dépôt** par
`.gitignore` : ces documents sont soumis à droits et ne doivent pas être publiés.

## Architecture

```
index.html, cours.html, exerciseur.html, bureau.html
src/geotech/        solveurs purs et testés (aucun accès au DOM)
  outils.js           intégration, profils par couches, conventions d'unités
  sols.js             classes F62, catégories EC7, pression limite nette, α
  pressio.js          dépouillement pressiométrique : étalonnages, corrections, EM, pf, pl
  essais.js           CPTU, SPT, pénétromètre dynamique, DMT, scissomètre, plaque, essais d'eau
  combinaisons.js     combinaisons F62 (A.5) et EN 1990 (approche 2)
  superficielles.js   excentrement, ple*, qce, De, kp, kc, iδ, iβ, portance, glissement
  cphi.js             méthode c–φ (EN 1997-1 annexe D, NF P94-261 annexe F)
  tassements.js       Ménard, Schmertmann, Giroud, œdomètre, module de réaction
  consolidation.js    Terzaghi, drains (Barron–Hansbo, Carrillo), Osterberg, fluage, étapes, Asaoka, multicouche
  oedometre.js        essai œdométrique simulé et dépouillé : Casagrande, Taylor, σ'p, Cc, Cs, cv
  camclay.js          Cam-Clay modifié du triaxial virtuel : chemins drainés et non drainés, Mohr, enveloppe
  pieux.js            portance F62 (C.3, C.4) et NF P94-262 (F, G), ξ, pieu modèle
  frottement-negatif.js, groupes.js, lateral.js, tassement-pieu.js
src/cours-chN.js    calculateurs du chapitre N du cours
src/pressio-exemples.js, src/essais-exemples.js  jeux d'essais fabriqués pour le cours
src/exos/           modèles d'exercices paramétrés (un fichier par chapitre)
src/exercices.js    rendu des exercices : apprentissage, entraînement, examen
src/exerciseur.js   tirages aléatoires reproductibles (#ch6/ch6-ple/123456)
src/bureau/         justification complète d'une semelle, d'un pieu et d'un remblai, notes de calcul, projet (sondage → couches, étude paramétrique)
src/figures.js      figures SVG (coupes, diagrammes, graphes) communes à tout le site
src/schemas-essais.js, src/schemas-cours.js  schémas des appareils d'essai et schémas explicatifs du cours
src/cours-schemas.js  pose chaque schéma dans sa <figure data-schema>
src/curseurs.js     curseurs de calcul en direct (champs marqués data-curseur)
src/bancs.js        chargeur des bancs d'essai ; src/bancs/ : moteur d'animation, terrain virtuel, un module par essai
src/figures-pressio.js  figures du dépouillement pressiométrique, communes au chapitre 3 et au bureau
data/chapitres.json plan du cours ; data/exercices-chN.json banques figées
tests/              contrôles numériques (exemples des guides Cerema, feuille CSTB)
tools/              génération des banques, du service worker et du polycopié
```

Les réponses des exercices ne sont **jamais écrites à la main** : chaque modèle
calcule ses réponses avec les solveurs de `src/geotech`, et les banques de
`data/` sont produites par `tools/generer-exercices.mjs` avec une graine fixe
par exercice. Les tests vérifient que les banques correspondent aux modèles.

## Principes

- Une méthode qui ne s'applique pas doit dire **pourquoi** (`horsDomaine(motif)`) :
  une case vide sans motif est un défaut, pas un résultat.
- Les formules et tableaux sont repris des textes et vérifiés sur les exemples
  des guides Cerema (NF P94-261, NF P94-262) et sur la feuille c–φ du CSTB.
- Le dépouillement pressiométrique suit la NF P94-110-1 ; il est contrôlé sur un
  essai de référence construit pour le cours. Son option « Shg Ménard » redonne
  les résultats du logiciel ELK / Shg Ménard sur l'essai de démonstration de
  celui-ci (vérification faite hors dépôt : ces données ne sont pas publiées).
- Les valeurs du coefficient de modèle de l'annexe F de la NF P94-261
  (γR;d;v = 2,0 drainé, 1,2 non drainé) sont celles présentées au CFMS
  (J. Habert et S. Burlon, 11 octobre 2012) et reprises par la notice FONDSUP
  de Terrasol.

## Développement

```text
npm test            # contrôles numériques et structurels
npm run exercices   # régénère data/exercices-chN.json à partir de src/exos
npm run sw          # régénère la coquille du service worker (sw.js)
npm run polycopie   # régénère le polycopié PDF à partir de cours.html
npm run serve       # site en local
```

Après toute modification publiée, changer la version du service worker
(`python tools/generer-sw.py fond-v4`, par exemple) et la constante `VERSION_ATTENDUE` de
`src/socle.js`, pour que les lecteurs déjà venus reçoivent la nouvelle version.

---

École Nationale d'Ingénieurs de Sfax — Dr Ahmed Ksentini
