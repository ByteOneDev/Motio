# PRD — Motio

> Phase BMAD : **PM** · Statut : brouillon à valider · Source : `docs/project-brief.md`

## 1. Objectifs

- Créer des séquences animées pour tutoriels et trailers **sans courbe d'apprentissage**
- Exporter en vidéo prête à intégrer dans un logiciel de montage

## 2. Exigences fonctionnelles

| ID | Exigence |
|----|----------|
| FR1 | Créer un projet avec un format prédéfini (16:9 1080p, 9:16, 1:1, 4K) et une durée |
| FR2 | Ajouter des calques : texte, forme (rectangle, cercle, ligne, flèche), image, vidéo/capture |
| FR3 | Sélectionner, déplacer, redimensionner, faire pivoter un calque directement sur le canevas |
| FR4 | Panneau de propriétés contextuel : seules les options utiles au calque sélectionné |
| FR5 | Presets d'animation **In / Out / Emphase** appliqués en un clic (fondu, glissement, zoom, pop, rebond, machine à écrire, dessin de trait…) |
| FR6 | Timeline : un bloc par calque, glisser pour déplacer, poignées pour la durée, zone In/Out visible |
| FR7 | Keyframes manuelles optionnelles sur position, échelle, rotation, opacité, couleur, avec courbes d'easing prédéfinies |
| FR8 | Lecture / pause / scrub, lecture en boucle, raccourcis clavier standards |
| FR9 | Annuler / rétablir illimité |
| FR10 | Modèles de scènes (intro, lower-third, callout, outro) insérables et modifiables |
| FR11 | Export MP4 (H.264) et WebM avec transparence, choix de la résolution et des fps |
| FR12 | Sauvegarde / ouverture de projet (`.motio`, JSON) + sauvegarde automatique |
| FR13 | Polices système + Google Fonts ; palette de couleurs du projet (charte) |

## 3. Exigences non fonctionnelles

| ID | Exigence |
|----|----------|
| NFR1 | Aperçu temps réel à 60 fps pour 20 calques en 1080p |
| NFR2 | Rendu déterministe : `frame = render(projet, t)` — aperçu et export identiques |
| NFR3 | Application de bureau macOS (Windows/Linux possibles ensuite), fonctionne hors ligne |
| NFR4 | Interface en français, sombre par défaut, une seule fenêtre |
| NFR5 | Aucune action courante à plus de 2 clics |

## 4. UX — principes

- **3 zones** : Canevas (centre) · Propriétés (droite) · Timeline (bas) ; bibliothèque d'éléments à gauche
- Tout ce qui est animable se règle d'abord par preset, ensuite (si besoin) en keyframes
- Valeurs par défaut belles : une animation non réglée doit déjà « bien rendre »

## 5. Epics et stories

### Epic 1 — Fondations & canevas
- 1.1 Squelette de l'app (fenêtre, layout 3 zones, thème sombre)
- 1.2 Modèle de données projet + store avec undo/redo
- 1.3 Moteur de rendu Canvas 2D `render(projet, t)`
- 1.4 Calques texte et formes ; sélection et transformations sur le canevas
- 1.5 Panneau de propriétés contextuel

### Epic 2 — Animation
- 2.1 Timeline (blocs, déplacement, durée, tête de lecture, scrub)
- 2.2 Lecture / pause / boucle + raccourcis
- 2.3 Presets In / Out / Emphase
- 2.4 Keyframes manuelles + easing
- 2.5 Effet machine à écrire et dessin de trait

### Epic 3 — Médias & modèles
- 3.1 Import images et vidéos (glisser-déposer)
- 3.2 Modèles de scènes
- 3.3 Polices et palette de projet

### Epic 4 — Export & fichiers
- 4.1 Sauvegarde / ouverture `.motio` + autosave
- 4.2 Export MP4 H.264
- 4.3 Export WebM transparent
- 4.4 Empaquetage de l'application macOS

### Epic 5 — Audio & montage (ajouté après l'Epic 4)
- 5.1 Bibliothèque sonore générée (musiques et bruitages libres de droits)
- 5.2 Pistes audio : lecture synchronisée, volume, fondus, boucle, son des vidéos, export audio
- 5.3 Timeline de montage : lasso, sélection multiple, déplacement groupé, visibilité / son / verrou toujours visibles
- 5.4 Barre d'outils de montage : couper, transitions, recadrer, aligner, ordre, image clé, aimantation
- 5.5 Nouveaux éléments : icônes, formes, modèles avec son

### Epic 6 — Outils pour tutoriels
- 6.1 Enregistrement de l'écran (avec micro) et de la voix off, intégré à Motio
- 6.2 Zoom caméra animé sur une capture
- 6.3 Sous-titres saisis à la main (script, calage au clavier, SRT) — pas de transcription automatique, pour garder l'application légère
- 6.4 Flou et pixellisation de zone
- 6.5 Calage des animations sur le rythme de la musique
- 6.6 Kit de marque (logo, couleurs, polices) partagé entre les projets
