# 🏎️ Racing Game

A top-down 2D racing game built with **Phaser 3**, **Vue 3**, and **TypeScript**.  
Complete 3 laps as fast as possible and beat your best time!

---

## Technologies

| Technology | Role |
|------------|------|
| [Phaser 3](https://phaser.io/) | 2D game engine — track, car physics, rendering |
| [Vue 3](https://vuejs.org/) | UI framework — menu, HUD, game over screen |
| TypeScript | Type safety across the whole project |
| Tailwind CSS | UI styling |
| Web Audio API | Procedural sound effects (engine, screech, hit, melodies) |
| Gamepad API | Controller support (Xbox, PlayStation, generic) |

---

## Prerequisites

You need **Node.js v18 or higher** installed on your machine.

- Download: https://nodejs.org — choose the **LTS** version
- Verify your installation:

```bash
node --version   # should print v18.x or higher
npm --version    # should print 9.x or higher
```

---

## Installation & Running

### 1. Get the source code

**Option A — Clone with Git:**
```bash
git clone <repository-url>
cd racing-game
```

**Option B — Download ZIP:**  
Click the green **"Code"** button on GitHub → **"Download ZIP"** → extract the folder → open a terminal inside it.

### 2. Install dependencies

```bash
npm install
```

Downloads all required libraries (~70 MB). Only needed once.

### 3. Start the development server

```bash
npm run dev
```

Then open your browser at:
```
http://localhost:5173
```

---

## How to Play

### Keyboard controls

| Key | Action |
|-----|--------|
| `↑` Arrow Up | Accelerate |
| `↓` Arrow Down | Brake / Reverse |
| `←` Arrow Left | Steer left |
| `→` Arrow Right | Steer right |

### Gamepad controls (Xbox / PlayStation / Generic)

| Input | Action |
|-------|--------|
| Left stick X axis | Steer (analog) |
| Left stick Y axis | Accelerate / Brake |
| RT / R2 trigger | Accelerate (analog) |
| LT / L2 trigger | Brake (analog) |
| D-pad ↑ / ↓ | Accelerate / Brake |
| D-pad ← / → | Steer |

> A connected gamepad is detected automatically and takes priority over the keyboard.  
> The HUD shows the controller name when detected.

### Rules

- Drive around the oval track and cross the **checkered finish line** to count a lap.
- **Driving on grass** reduces your acceleration significantly — stay on the road.
- **Hitting a wall** bounces you back and cuts your speed.
- Finish **3 laps** — your total time is saved to the leaderboard.
- Top 10 best times are stored locally in your browser.

---

## Production Build

To generate an optimized static build:

```bash
npm run build
```

Output goes into the `dist/` folder. Preview it locally with:

```bash
npm run preview
```

Or deploy `dist/` to any static host (Vercel, Netlify, GitHub Pages).

---

## Project Structure

```
src/
├── game/
│   ├── scenes/
│   │   ├── BootScene.ts       # Asset loading
│   │   └── RaceScene.ts       # Track, car physics, HUD
│   ├── GamepadManager.ts      # Gamepad API polling & deadzone
│   ├── PhaserGame.ts          # Phaser configuration
│   └── SoundManager.ts        # Web Audio API sound synthesis
├── stores/
│   └── gameStore.ts           # Shared reactive state (Vue ↔ Phaser)
├── components/
│   ├── MenuScreen.vue          # Name input + leaderboard
│   ├── GameScreen.vue          # Phaser canvas wrapper
│   └── GameOverScreen.vue      # Results + replay button
└── App.vue                     # Screen router
```

---

## Team & Work Distribution

| Name | Responsibilities |
|------|-----------------|
| Koray AKGUL | Phaser scenes, car physics, track design, collision |
| Jonatan PERRET | Vue UI screens, Gamepad API integration, Web Audio API sounds |

---

## Known Limitations

- Single track, single player only.
- Best times are stored in `localStorage` — clearing browser data resets the leaderboard.
- Audio requires a user interaction to start (browser policy) — clicking **START** triggers it automatically.
