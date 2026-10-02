# Terrassements routiers — Guide GTR 2024

Site de cours pour le génie civil : polycopié, cours interactif avec essais
animés, exerciseur et bureau de calcul. Il suit la démarche du **guide des
terrassements routiers (GTR) 2024 du Cerema** pour les remblais et les couches
de forme — identifier un matériau, le classer (NF EN 16907-2), choisir ses
conditions d'utilisation, le compacter, contrôler l'ouvrage — et la met, chaque
fois que c'est utile, en regard du **GTR 1992** (classification NF P11-300) que
citent encore tant de rapports.

Application web **statique** et PWA : aucun framework, aucune compilation. Même
architecture et même habillage que le site des fondations
([fond.ksr-infra.org](https://fond.ksr-infra.org)), dont il reprend le socle
(service worker, bandeau de panne, curseurs de calcul en direct, moteur des
bancs d'essai, exerciseur, coque du bureau de calcul).

## Contenu

| Ressource | Fichier | Rôle |
|---|---|---|
| Accueil | `index.html` | ressources, parties, chapitres, banques d'exercices (3 modes) |
| Cours interactif | `cours.html` | 15 chapitres en quatre parties — les matériaux, les remblais, la PST et la couche de forme, le chantier ; des schémas explicatifs (synoptique de la démarche, symbole de classement, PST, classes de portance…) et 42 calculateurs à curseurs de calcul en direct : classer un sol aux deux éditions, lire un code d'utilisation, régler un atelier de compactage par la méthode Q/S, dépouiller des mesures de densité en place, un essai de plaque, une dynaplaque, chercher le cercle critique d'un talus (Bishop), trouver le cas de PST et l'épaisseur de couche de forme, doser la chaux vive, estimer la pénétration du gel, calculer des profils en travers, tracer l'épure de Lalanne, équilibrer un atelier pelle + tombereaux ; 18 bancs d'essai animés : tamisage, sédimentométrie, limites d'Atterberg (Casagrande), valeur de bleu, équivalent de sable, Proctor, IPI et CBR, Los Angeles, micro-Deval, fragmentabilité et dégradabilité, planche de compactage, gammadensimètre, pénétromètre dynamique, plaque, dynaplaque, traitement à la chaux, gonflement au gel et atelier de chantier ; sous les afficheurs de chaque banc, une loupe montre l'organe de l'essai au travail (la maille du tamis, la pâte qui se referme dans la coupelle, la dernière tache de bleu, la dame sur la couche, le boulet qui frappe les gravillons, la bille du compacteur qui serre les grains, les photons de la source au détecteur, le front de gel dans l'éprouvette…) |
| Exerciseur | `exerciseur.html` | 112 modèles d'exercices à données tirées au hasard (7 ou 8 par chapitre), corrigés pas à pas par les mêmes solveurs que le cours, en mode apprentissage, entraînement ou examen |
| Bureau de calcul | `bureau.html` | projet et tableau de bord, huit modules : classement d'un sol (GTR 2024 et 1992, conditions d'emploi en remblai et en couche de forme), matériau rocheux, compactage (tableaux de l'annexe 4, atelier, cadence), traitement à la chaux, PST et couche de forme (arase, épaisseur, plateforme), réception d'une plateforme (plaque, dynaplaque, densités), mouvement des terres (épure de Lalanne, transports), stabilité d'un talus — étapes numérotées, note de calcul avec cartouche |
| Polycopié | `polycopie/terrassements-polycopie.pdf` | le cours complet, produit à partir de `cours.html` |

## Déploiement — Cloudflare Pages

Le site vit pour l'instant dans le dossier `georoute/` du dépôt des fondations ;
il se publie par un **second projet Pages** branché sur le même dépôt :

| Réglage | Valeur |
|---|---|
| Framework preset | **None** |
| Build command | *(vide)* |
| Root directory (advanced) | **`georoute`** |
| Build output directory | **`/`** |
| Build watch paths | `georoute/*` |
| Branche de production | `main` |

Domaine personnalisé : **`georoute.ksr-infra.org`**. La zone `ksr-infra.org`
étant chez Cloudflare, l'enregistrement DNS et le certificat du sous-domaine
sont créés automatiquement lors de son ajout au projet Pages.

Tant que le dossier reste dans ce dépôt, le projet des fondations (qui publie la
racine) sert aussi une copie de `georoute/` sous `fond.ksr-infra.org/georoute/` ;
exclure `georoute/*` de ses *build watch paths* lui évite seulement d'être
reconstruit à chaque retouche. Déplacer le dossier dans un dépôt à lui (le
contenu de `georoute/` en devient la racine, Root directory vide) sépare
proprement les deux sites.

Le dossier `docs/` (fascicules du GTR 2024, GTR 1992, GTS, normes et tableurs
utilisés pour préparer le cours) est **exclu du dépôt** par `.gitignore` : ces
documents sont soumis à droits et ne doivent pas être publiés. Le dépôt ne
contient que des données tirées des tableaux (seuils, codes, valeurs de
compactage), sans les textes du guide.

## Architecture

```
index.html, cours.html, exerciseur.html, bureau.html
src/gtr/            solveurs purs et testés (aucun accès au DOM)
  outils.js           outils numériques communs
  identification.js   teneur en eau, masses volumiques, tamisage, sédimentométrie, Atterberg, bleu, ES
  granulo.js          courbe granulométrique : Dmax, D10, D60, Cu, Cc, fractions utiles au classement
  proctor.js          essai Proctor : points, optimum, courbes de saturation, énergies
  portance.js         IPI, CBR, plaque (EV1, EV2), dynaplaque, classes d'arase et de plateforme, bicouche
  roches.js           Los Angeles, micro-Deval, friabilité des sables, fragmentabilité, dégradabilité
  classification.js   GTR 2024 (NF EN 16907-2) : classes F, I, S, G, VC, O, roches, sous-classes, états
  classification92.js GTR 1992 (NF P11-300) : classes A, B, C, D, correspondance des roches R
  tables-remblai.js, tables-couche-forme.js, tables-compactage.js
                      tableaux des annexes 2, 3 et 4 du fascicule 2, transcrits (et leurs ANOMALIES)
  utilisation.js      conditions d'utilisation en remblai et en couche de forme à partir d'un classement
  compactage.js       q4 et q3, méthode Q/S, ateliers, classes de compacteurs, densité par tranches
  pst.js              cas de PST (tableau 17 du fascicule 1), classes d'arase, réception de l'arase
  couche-forme.js     Lmax, Dmax des matériaux traités, épaisseurs (tableaux du GTR 2000)
  traitement.js       chaux et liants : quantités, baisse de teneur en eau, aptitude, zones mécaniques
  gel.js              classes SGn, SGp, SGt, pente p, pénétration du gel (Stefan)
  stabilite.js        talus infini, Bishop simplifié, recherche du cercle critique
  cubatures.js        profils en travers, volumes, foisonnement, épure de Lalanne
  engins.js           pelles, tombereaux, bouteurs, compacteurs : cycles et rendements
src/cours-chN.js    calculateurs du chapitre N du cours
src/codes.js        affichage des codes E G W T R C H (remblai) et G W T S (couche de forme)
src/dessins-gtr.js  coupe d'un talus et profil en travers, communs au cours et au bureau
src/exos/           modèles d'exercices paramétrés (un fichier par chapitre)
src/exercices.js    rendu des exercices : apprentissage, entraînement, examen
src/exerciseur.js   tirages aléatoires reproductibles
src/bureau.js       coque du bureau de calcul ; src/bureau/ : les huit modules et leurs notes de calcul
src/figures.js      figures SVG (graphes, abaques) communes à tout le site
src/schemas-cours.js, src/cours-schemas.js  schémas explicatifs du cours et leur pose
src/curseurs.js     curseurs de calcul en direct (champs marqués data-curseur)
src/bancs.js        chargeur des bancs d'essai ; src/bancs/ : moteur d'animation, loupe,
                    matériaux virtuels cohérents, un module par essai
src/impression.js   mode impression du cours (polycopié)
data/chapitres.json plan du cours ; data/exercices-chN.json banques figées
tests/              contrôles numériques (exemples et tableaux du guide) et structurels
tools/              génération des banques, du service worker et du polycopié
```

Les réponses des exercices ne sont **jamais écrites à la main** : chaque modèle
calcule ses réponses avec les solveurs de `src/gtr`, et les banques de `data/`
sont produites par `tools/generer-exercices.mjs` avec une graine fixe par
exercice. Les tests vérifient que les banques correspondent aux modèles.

## Principes

- Une méthode qui ne s'applique pas doit dire **pourquoi** (`horsDomaine(motif)`) :
  une case vide sans motif est un défaut, pas un résultat.
- Les seuils de classement et les tableaux des conditions d'utilisation et de
  compactage sont repris du GTR 2024 et vérifiés sur ses exemples (fascicule 1,
  tableaux 6, 12 et 16 ; fascicule 2, annexe 4). Les écarts imprimés dans le
  guide (code qui contredit son libellé, N ou Q/L qui ne suit pas de e et de
  Q/S, renvoi sans note…) sont **conservés tels qu'imprimés** et listés dans
  les constantes `ANOMALIES`, page et case à l'appui.
- Les matériaux virtuels des bancs d'essai ont des propriétés cohérentes entre
  elles : chacun doit se classer dans la classe qu'il annonce (test).
- Là où le texte du GTR 2024 n'a pas pu être exploité (épaisseurs de couche de
  forme, classes de compacteurs, frontières des zones de matériaux traités), le
  site emploie les tableaux du **GTR 2000** et le dit à l'écran ; les frontières
  des zones des matériaux traités sont numérisées à ±5 % sur la figure du guide.
- Un modèle d'enseignement (bicouche de la couche de forme, profondeur de gel
  par la formule de Stefan) montre une tendance : il ne remplace ni les
  tableaux du guide, ni une étude.

## Développement

```text
npm test            # contrôles numériques et structurels
npm run exercices   # régénère data/exercices-chN.json à partir de src/exos
npm run sw          # régénère la coquille du service worker (sw.js)
npm run polycopie   # régénère le polycopié PDF à partir de cours.html
npm run serve       # site en local
```

Après toute modification publiée, changer la version du service worker
(`python tools/generer-sw.py georoute-v2`, par exemple) et la constante
`VERSION_ATTENDUE` de `src/socle.js`, pour que les lecteurs déjà venus reçoivent
la nouvelle version. Le polycopié se régénère après toute retouche du cours
(`NAVIGATEUR=/chemin/vers/chrome` désigne un navigateur particulier).

---

École Nationale d'Ingénieurs de Sfax — Dr Ahmed Ksentini
