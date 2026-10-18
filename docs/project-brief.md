# Project Brief — Motio

> Phase BMAD : **Analyst** · Statut : brouillon à valider · Date : 2026-10-11

## 1. Problème

Les outils de motion design (After Effects, Cavalry, Fusion, Blender…) sont soit très puissants
mais complexes, soit demandent une longue courbe d'apprentissage. Pour produire de courtes séquences
animées dans des **tutoriels** et des **trailers** (titres, lower-thirds, callouts, transitions,
mises en avant de captures d'écran), on perd un temps disproportionné.

## 2. Vision

Un logiciel de motion design **simple, ergonomique, rapide à prendre en main** : on doit produire une
séquence propre en moins de 5 minutes, sans tutoriel.

Principe clé : **les animations s'appliquent comme des « effets prêts à l'emploi »** (apparition,
sortie, emphase) avec des réglages minimaux, et les keyframes manuelles restent possibles mais
optionnelles.

## 3. Utilisateur cible

- Créateur de tutoriels / formations (YouTube, cours en ligne)
- Créateur de trailers courts (produit, jeu, chaîne)
- Profil : à l'aise avec l'ordinateur, **pas** motion designer

## 4. Cas d'usage prioritaires

1. Titre animé d'intro / outro
2. Lower-third (nom + rôle)
3. Callout / flèche / surlignage sur une capture d'écran
4. Texte « machine à écrire » pour du code ou des commandes
5. Transition entre deux plans
6. Export MP4 (ou WebM transparent) à insérer dans le montage

## 5. Différenciateurs

- **Presets d'animation** en un clic (In / Out / Emphase) au lieu de keyframes
- **Modèles de scènes** (intro, lower-third, callout) modifiables
- Timeline lisible : un bloc = un calque, poignées d'entrée/sortie visibles
- Rendu déterministe : ce qu'on voit dans l'aperçu = ce qui est exporté
- Fichier projet simple (JSON), lisible et versionnable

## 6. Hors périmètre (v1)

3D, simulation de particules, tracking vidéo, expressions/scripting, collaboration temps réel,
montage vidéo complet (on reste un outil de *séquences* à importer dans un monteur).

## 7. Critères de succès

- Un nouvel utilisateur crée et exporte un lower-third animé en < 5 min
- Aperçu fluide à 60 fps sur une scène de 20 calques en 1080p
- Export MP4 1080p30 d'une séquence de 10 s en < 15 s sur un Mac récent
