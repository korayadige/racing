# racing
Simulation de course  en automonile en 2D (vue de dessus) avec un mode 'Time-Attack'. Gestion de la physique de conduite (collisions, friction) et système de chronométrage avec sauvegarde locale des records. Interface réactive pour le suivi des performances.

# Cahier des charges — Projet libre

## 1. Informations générales

- **Nom du projet**       : Racing 
- **Membres de l'équipe** : [Koray AKGUL], [Adrien MARCUARD]
- **Lien du dépôt Git**   : *[Racing 2D Simulation](https://github.com/korayadige/racing)*

## 2. Description du projet

Nous développons un jeu de course en vue de dessus (top-down 2D) jouable
directement dans le navigateur. L'idée est de réaliser quelques tours de piste
le plus rapidement possible, avec un classement des meilleurs temps sauvegardé
localement. Ce projet nous permet d'explorer l'intégration d'un moteur de jeu
dans une application web moderne.

## 3. Objectifs

- Permettre à un·e utilisateur·rice de conduire une voiture sur un circuit et
  de compléter des tours.
- Offrir un retour immédiat sur la performance via un chronomètre et un
  classement local.
- Proposer une expérience jouable au clavier, et si possible à la manette.

## 4. Fonctionnalités

### 4.1 Principales

- Déplacement du véhicule sur un circuit oval avec physique de base
  (accélération, freinage, virage).
- Comptage des tours et chronomètre.
- Détection des sorties de route (herbe) et des collisions avec les murs.
- Écran de menu (saisie du pseudo), écran de jeu, écran de fin de course.
- Classement des 10 meilleurs temps, stocké en local.

### 4.2 Optionnelles

- Support manette (Xbox / PlayStation) via l'API Gamepad — nous essayons de
  l'intégrer, mais cela reste secondaire.
- Effets sonores générés procéduralement (moteur, crissement, collision).
- Animations ou retours visuels supplémentaires (fumée, flash de collision…).

## 5. Technologies

- **Frontend / moteur de jeu** : Phaser 3 — moteur 2D bien documenté, adapté
  aux jeux navigateur sans backend.
- **UI** : Vue 3 + Tailwind CSS — pour les écrans hors jeu (menu, résultats)
  avec un état réactif partagé.
- **Langage** : TypeScript — typage statique pour limiter les erreurs sur un
  projet multi-fichiers.
- **Audio** : Web Audio API — génération de sons directement dans le
  navigateur, sans fichiers externes.
- **Build** : Vite — bundler rapide, compatible avec Phaser et Vue.
- **Backend / BDD** : aucun — tout fonctionne côté client, les données sont
  stockées dans `localStorage`.

## 6. Architecture

L'application est entièrement côté client, sans serveur.


Navigateur
├── Vue 3 (UI)
│   ├── MenuScreen      → Saisie du pseudo, affichage du classement
│   ├── GameScreen      → Conteneur du canvas Phaser
│   └── GameOverScreen  → Résultats + bouton rejouer
├── Phaser 3 (Moteur)
│   ├── BootScene       → Chargement des assets
│   └── RaceScene       → Logique de course, physique, HUD
└── Stores (Pinia/Réactif)
    └── gameStore       → État partagé (nom, état, temps, classement)


Vue et Phaser communiquent via un store réactif commun. Pas de communication
réseau — tout reste dans le navigateur.

## 7. Évolutions possibles

- Plusieurs circuits différents.
- Mode multijoueur local (écran partagé ou tour par tour).
- Voitures adversaires contrôlées par l'IA.
- Sauvegarde des scores en ligne (nécessiterait un backend).


```
