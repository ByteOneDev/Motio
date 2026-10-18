# Architecture — Motio

> Phase BMAD : **Architect** · Statut : brouillon à valider · Sources : `docs/prd.md`

## 1. Stack

| Couche | Choix | Pourquoi |
|--------|-------|----------|
| App de bureau | **Electron** | Fenêtre native, accès fichiers, hors ligne ; embarque Chromium donc WebCodecs garanti. (Tauri écarté : nécessite Rust, absent de la machine, et WebKit n'a pas d'encodeur vidéo fiable.) |
| Build | **Vite** + **electron-vite** | Démarrage instantané, rechargement à chaud |
| Langage | **TypeScript** (strict) | Modèle de données riche, refactorings sûrs |
| UI | **React 19** | Écosystème, composants de panneaux/timeline |
| Style | **Tailwind CSS** (+ Radix UI au besoin pour menus/popovers) | Interface sobre et accessible rapidement |
| État | **Zustand** + **Immer** + historique de patches | Store simple ; undo/redo par patches Immer |
| Rendu | **Canvas 2D** maison | Déterministe, suffisant pour texte/formes/images 2D, zéro dépendance lourde |
| Export vidéo | **WebCodecs** via **Mediabunny** | Encodage matériel H.264 dans Chromium, rapide, sans ffmpeg ; WebM VP9 avec transparence (Mediabunny encode l'alpha à part, Chromium ne sait pas le faire seul). mp4-muxer / webm-muxer sont dépréciés au profit de Mediabunny |
| Empaquetage | **electron-builder** | `Motio.app` + `.dmg` (Apple Silicon), association des fichiers `.motio` |
| Fichiers | JSON `.motio` validé par **Zod** | Lisible, versionnable, migrations de schéma |
| Tests | **Vitest** (moteur, interpolation) + **Playwright** (parcours UI) | |

## 2. Principe central : rendu pur

```
renderFrame(ctx, project: Project, time: number, measure: Measure): void
```

- Aucun état caché : le même `(project, t)` donne toujours la même image.
- L'aperçu appelle `render` à chaque `requestAnimationFrame` ; l'export l'appelle frame par frame
  sur un `OffscreenCanvas`, puis passe chaque `VideoFrame` à l'encodeur.

## 3. Modèle de données (simplifié)

```ts
Project   { version, id, name, width, height, fps, duration, background, palette[], assets[], layers[] }
Asset     { id, kind: 'image'|'video'|'audio', name, src, path, width, height, duration, generated /* id d'un son Motio */ }
Layer     { id, type: 'text'|'shape'|'media'|'background'|'audio'|'icon'|'subtitles'|'blur', name, start, end, visible, locked,
            transform: { x, y, width, height, rotation, opacity, scale },
            props: TextProps | ShapeProps | MediaProps | BackgroundProps,
            animIn:   InOutAnim | null,     // un emplacement par rôle : entrée,
            emphasis: Emphasis  | null,     //   mise en avant,
            animOut:  InOutAnim | null,     //   sortie
            keyframes: Partial<Record<'x'|'y'|'scale'|'rotation'|'opacity'|'color', Keyframe[]>> }
InOutAnim { preset: 'fade'|'slide'|'pop'|'zoom'|'blur'|'wipe'|'typewriter'|'draw', duration, easing, direction, distance }
Emphasis  { preset: 'pulse'|'shake'|'wobble'|'bounce'|'flash', at, duration, repeat, intensity }
Keyframe  { time /* absolu, s */, value, easing /* vers la suivante */ }
```

Les presets sont **compilés** en modificateurs (`engine/animate.ts › presetModifiers`) au moment du rendu
(ils ne génèrent pas de keyframes) : l'entrée est calée sur `start`, la sortie sur `end`, donc
déplacer ou raccourcir un calque garde l'animation cohérente.

Ordre d'évaluation d'une propriété à l'instant `t` :
`valeur de base → keyframes (resolveLayer) → presets In/Out/Emphase (multiplicatifs/additifs)`

### Édition « à l'instant courant » (auto-key)

Toute modification d'un calque passe par `editResolved(layer, time, recipe)` (via `updateLayer`) :
la recette voit les valeurs animées à l'instant courant, et si elle change une propriété qui a
des keyframes, une keyframe est créée/mise à jour à cet instant. Le glisser sur le canevas, les
poignées, le clavier et le panneau de propriétés animent donc sans mode spécial. Une propriété
sans keyframe garde un comportement statique ; le losange ◇ à côté du champ démarre l'animation.

## 4. Structure du code

```
src/
  main/              processus Electron (fenêtre, menus, dialogues fichiers)
  preload/           pont IPC typé (ouvrir/sauver/exporter)
  shared/            types partagés main ↔ renderer
  renderer/src/
    engine/          renderFrame(), géométrie, transformations, layout texte   ← pur, testé
    model/           schéma Zod, fabriques (styles, formes, fonds), modèles de scènes, polices
    store/           editor (projet + historique undo/redo), view (zoom/pan)
    export/          rendu image par image → Mediabunny (MP4, WebM) ou PNG
    file/            format .motio (lecture, écriture, validation)
    ui/
      canvas/        viewport, poignées de sélection/transformation
      layers/        pile des calques → en-têtes de la timeline     (Epic 2)
      inspector/     propriétés contextuelles
      library/       onglets Éléments, Modèles, Fonds, Médias
    fonts/           polices embarquées (@fontsource)
```

## 5. Performances

- Cache des mesures de texte et des images décodées
- Vidéos importées : décodage via `<video>` + seek pour l'aperçu, `VideoDecoder` pour l'export
- Rendu de la timeline découplé du canevas (re-render React limité par sélecteurs Zustand)

## 6. Risques

| Risque | Mitigation |
|--------|------------|
| Seek vidéo imprécis en aperçu | Export via WebCodecs frame-exact ; aperçu toléré approximatif |
| Polices non chargées à l'export | Attendre `document.fonts.ready` + préchargement explicite |
| Complexité qui revient par la porte arrière | Chaque nouvelle option doit passer par un preset ou être masquée par défaut |

## 7. Fichiers, médias et export (Epic 4)

- **`.motio`** : JSON lisible `{ format: 'motio', ...Project }`, validé par Zod à l'ouverture (les champs
  récents prennent leur valeur par défaut). Images intégrées en URL data ; vidéos référencées par chemin.
- **Médias locaux** : le processus principal sert `motio-media://file/?p=<chemin>` (requêtes partielles pour
  la lecture vidéo, en-têtes CORS pour que le canvas reste exportable). Seuls les fichiers image/vidéo sont servis.
- **Écritures** : le renderer ne peut écrire que là où l'utilisateur a choisi (boîtes de dialogue) et dans la
  sauvegarde automatique (`userData/autosave.motio`, écrite 1,5 s après chaque modification, restaurée au lancement).
- **Export** : `FrameRenderer` dessine chaque image dans un `OffscreenCanvas` avec le même `renderFrame` que
  l'aperçu ; les vidéos sont recalées exactement sur chaque image avant le dessin.

## 8. Audio (Epic 5)

- **Sons générés** (`audio/synth.ts`, `audio/library.ts`) : batterie, basse, nappes, arpèges, cloches, souffles,
  réverbération et écho synthétisés dans un `OfflineAudioContext`, hasard à graine fixe, normalisation crête.
  Le fichier `.motio` ne stocke que l'identifiant (`generated: 'music:lofi'`) : le son est recalculé à l'ouverture.
  Pas de fichier tiers, donc pas de licence à gérer.
- **Mixage** (`audio/mix.ts › scheduleMix`) : une seule fonction programme volumes, fondus, boucles et décalages
  de source, pour la lecture (`AudioContext`) comme pour l'export (`OfflineAudioContext` → Mediabunny,
  AAC dans le MP4, Opus dans le WebM). Un calque masqué est muet ; le son des vidéos passe par le même chemin.
- **Lecture** (`ui/audio.ts`) : le son est programmé au démarrage de la lecture et reprogrammé après un saut
  de la tête de lecture ou une modification du projet. Formes d'onde calculées une fois par son.

## 9. Outils pour tutoriels (Epic 6)

- **Enregistrement** : le processus principal liste écrans et fenêtres (`desktopCapturer`) ; l'interface choisit
  la source puis appelle `getDisplayMedia`, que `setDisplayMediaRequestHandler` satisfait avec cette source.
  `MediaRecorder` (VP9 + Opus) → remultiplexage Mediabunny (durée et index : le fichier brut n'est pas navigable)
  → `Vidéos/Motio/…webm` → calque plein cadre (« Entière ») ou piste « Voix off » à l'instant de départ.
  Raccourci global ⇧⌘2 pour arrêter depuis une autre application.
- **Zoom caméra** : `MediaProps.zooms` (temps relatifs au calque) ; `zoomAt` + `zoomRect` resserrent la zone
  source dessinée, avec aller-retour lissé. Rien à recalculer à l'export : c'est le même `renderFrame`.
- **Sous-titres** : calque `subtitles` (`cues` relatifs au calque + style). Découpe du script par phrases à
  15 caractères/s, mode calage au clavier (une seule étape d'historique), import/export SRT.
- **Flou / pixellisation** : calque `blur` qui relit les pixels déjà dessinés sous sa boîte (même canvas),
  puis les redessine floutés ou pixellisés, découpés à sa forme. Limite : la zone est fixe dans le cadre,
  elle ne suit pas un zoom caméra du média en dessous (l'animer avec des images clés si besoin).
- **Rythme** : `AudioProps.bpm` (connu pour les musiques générées, saisi ou « tapé » pour les autres) ;
  `beatTimes` alimente la règle, l'aimantation et l'outil « Caler sur les temps ».
- **Kit de marque** : `userData/brand.json` (ou stockage du navigateur), hors des projets.
