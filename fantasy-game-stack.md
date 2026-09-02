# Fantasy Game Tech Stack

A stack and a set of working patterns for a fantasy sibling of
`exp-3js-star-trek`: a turn-based game with a 2D board as the source of truth
and a procedural three.js scene as the "crystal ball" view. Everything below
was proven in the Star Trek project; this document translates it to dragons,
castles, and spellcraft so the new repo can start from a known-good shape.

## Tech Stack Overview

| Tool | Purpose |
|------|---------|
| **Vite** | Dev server with hot reload, multi-page build |
| **three.js** | Procedural 3D scene, bloom post-processing, orbit camera |
| **Vanilla JavaScript** (ES modules) | No framework; state-driven panels re-render from plain objects |
| **bun** | Package manager, script runner, and test runner (`bun test`) |
| **Web Audio API** | All sound synthesised in code; no audio files |
| **localStorage** | Autosave after every order; per-browser settings |
| **CSS Grid** | The bridge-style panel layout, one stylesheet per page |

### Why this stack

- **No assets.** Ships, stations, and sounds were all built from primitives
  and oscillators. A fantasy world is the same trick with different shapes:
  a dragon is a lathe body plus two extruded wings, a castle is boxes and
  cones, a forest is instanced cones. No licensing, no asset pipeline, and
  every proportion is a number you can nudge.
- **Pure engine, dumb views.** The rules live in `src/game/` with no DOM and
  no three.js, fully unit tested with a seeded RNG. The panels and the 3D
  view only render state and replay events. This is what made the Star Trek
  game easy to test, save, and animate.
- **Vanilla stays small.** The whole Star Trek bridge is ~2,500 lines. A
  framework would not have paid for itself; the React + TypeScript stack in
  `turn-based-game-stack.md` remains a fine choice if the UI grows past a
  handful of panels.

## A candidate concept

Keep the Super Star Trek skeleton, reskin the nouns. Doing this first means
the engine, panels, save system, and 3D timeline can be lifted almost
unchanged, and the fantasy flavour goes into models, effects, and text.

| Star Trek | Fantasy sibling |
|-----------|-----------------|
| Galaxy of 8×8 quadrants | Realm of 8×8 regions |
| 10×10 sectors | 10×10 tiles (meadow, forest, river, mountain) |
| Enterprise | The party, or a wizard's airship / griffon rider |
| Klingon Bird-of-Prey | Dragons (fire, frost, shadow: different energy and attacks) |
| Starbase | Castle or sanctuary: heal, resupply, repair |
| Stars | Mountains and ancient stones: block movement, absorb spells |
| Energy | Mana |
| Shields | Wards |
| Phasers | Lightning (split across every dragon in the region, falls off with distance) |
| Photon torpedoes | Fireballs (fly tile by tile, hit the first thing in the path) |
| Device damage | Wounds and broken gear: no spells, no map, slowed travel |
| Stardates | Days; the deadline is the eclipse / the winter |
| Long-range scan | Scrying |
| Library computer | The oracle |
| Red alert | The horn |
| Efficiency rating | Bard's tally |

Later, once that plays: dragons that move and hunt you, weather, a hex grid
instead of squares, quests from castles, a party with distinct members.

## Project structure

```
fantasy-realm/
├── index.html              # model showcase (the "hangar" page): one creature, orbit camera
├── bestiary.html           # several models + a skirmish view (like fleet.html)
├── game.html               # the game: board panels + 3D crystal-ball view
├── rules.html              # handbook; numbers injected from rules.js
├── vite.config.js          # registers every html page as a build input
├── package.json            # bun scripts: dev, build, preview, test
├── CLAUDE.md
├── README.md
├── fantasy-realm-plan.md   # milestones, layout sketch, command table
├── tests/                  # bun test; helpers.js builds fixture regions from ASCII
│   ├── helpers.js
│   ├── rng.test.js
│   ├── realm.test.js
│   ├── game.test.js
│   ├── commands.test.js
│   ├── save.test.js
│   └── fuzz.test.js        # random play over many seeds, checking invariants
└── src/
    ├── game/               # PURE ENGINE — no DOM, no three.js
    │   ├── rng.js          # seeded mulberry32 with get/setState for saves
    │   ├── rules.js        # every tunable number, difficulty presets, CELL codes
    │   ├── realm.js        # region/tile generation
    │   └── game.js         # Game class: commands return { ok, events }
    ├── ui/
    │   ├── commands.js     # vocabulary, parser, click targets (pure, tested)
    │   ├── panels.js       # region map, tile scan, status, chronicle, view label
    │   └── flavor.js       # party chatter, own RNG so it never touches the game
    ├── models/             # procedural geometry from primitives
    │   ├── parts.js        # hullMaterial, glowMaterial, strut()
    │   ├── dragon.js
    │   ├── airship.js
    │   ├── castle.js
    │   ├── terrain.js      # tile plane with vertex colours, trees, stones
    │   └── ...
    ├── stage.js            # renderer, camera, lights, bloom; sizes from a container
    ├── effects.js          # beams, bolts, flashes tracking live objects (was weapons.js)
    ├── ward.js             # fresnel bubble (was shield.js)
    ├── audio.js            # synthesised sounds
    ├── crystalball.js      # 3D view: sync(game) + play(events) on a timeline (was viewscreen.js)
    ├── bridge.js           # game.html wiring: modes, prompts, shortcuts, save/resume
    ├── main.js             # index.html
    ├── bestiary.js         # bestiary.html
    ├── rules-page.js
    ├── style.css           # shared tokens and HUD
    ├── bridge.css
    └── rules.css
```

## Getting started

```bash
mkdir fantasy-realm && cd fantasy-realm
bun init -y
bun add three
bun add -d vite
```

`package.json` scripts:

```json
{
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "bun test"
  }
}
```

`vite.config.js`, one line per page:

```js
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: new URL("./index.html", import.meta.url).pathname,
        bestiary: new URL("./bestiary.html", import.meta.url).pathname,
        game: new URL("./game.html", import.meta.url).pathname,
        rules: new URL("./rules.html", import.meta.url).pathname,
      },
    },
  },
});
```

Files worth copying from `exp-3js-star-trek` as-is on day one: `src/game/rng.js`,
`src/stage.js`, `src/parts.js`, `src/weapons.js`, `src/shield.js`,
`src/starfield.js` (becomes drifting motes or snow), `src/audio.js` (keep the
envelope and noise helpers, rewrite the instruments), and `tests/helpers.js`.

## The patterns that matter

### 1. Engine first, tested from ASCII fixtures

Every command on `Game` mutates `game.state` and returns `{ ok, events, error? }`.
Events are plain objects. Tests build a region from a picture:

```js
loadRegion(game, [
  "..........",
  "..P..D....",   // P party, D dragon, C castle, ^ mountain
  "..........",
  ...
]);
const result = game.castFireball({ dx: 1, dy: 0 });
expect(result.events.find((e) => e.type === "fireball").hit).toBe("D");
```

Keep a fuzz test from the start: play random commands over 150 seeds and
assert invariants (mana ≥ 0, exactly one party on the map, dragon count
matches the counter). It caught nothing in Star Trek because the engine was
written with it in mind; that is the point.

### 2. Seeded randomness, saved with the game

`createRng(seed)` with `getState()` / `setState()`. `Game.toJSON()` stores the
state and the RNG state; `Game.fromJSON()` restores both, so a resumed game
rolls the same dice. Flavor text and visuals use their own RNG streams so they
never change the game.

### 3. Panels re-render from state

Each panel is `render(root, game, ui)` that rebuilds its DOM. Grids of 64 and
100 cells are cheap to rebuild; diffing was never needed. Selection state
(`ui.selection`, `ui.mode`) lives in the page, not the engine.

Three ways to give every order, all backed by one parser in `ui/commands.js`:
single keys, classic typed lines (`fire 3 1`, `bolt 400`), and click-to-target.
Missing parameters prompt for input.

### 4. The 3D view syncs and replays

`crystalball.js` exposes `sync(game)` (rebuild the scene from state) and
`play(events, game)` (replay one command on a timeline, then reconcile). The
view never decides anything, so it can never drift from the board. A tiny
`Timeline` class with `at(t, fn)`, `update(delta)`, and `flush()` is enough;
flush the old timeline when a new command arrives.

Effects (`effects.js`) track live objects every frame: a lightning bolt
re-reads its caster and target positions, so creatures can keep idling while
spells are in flight. Models expose empty `Object3D` nodes as launch points
(`"staff-tip"`, `"dragon-maw"`).

### 5. Procedural models from primitives

- **Lathe** a 2D profile for bodies (saucer → dragon torso, airship hull).
  Profile order sets the winding; reversed, the mesh renders inside-out.
- **Extrude** a `Shape` for wings and sails; hinge them on nested pivot
  groups named `"wing-pivot"` with cruise/attack angles in `userData`.
- **Mirror** the port side with `scale.x = -1` on a parent group. three.js
  flips face winding for negative determinants, so it just works.
- **`strut(from, to)`**: a box stretched between two points, for necks, masts,
  bridges, and spines.
- **Emissive + bloom** for anything magical. Keep the bloom threshold high
  (~0.8) so lit surfaces stay matte and only glow parts glow.
- Terrain: a `PlaneGeometry` with vertex colours per tile type and a little
  noise displacement; trees as cones on cylinders via `InstancedMesh`.

### 6. Sound without files

`audio.js` keeps `envelope()` and `noise()` and builds instruments on top:
oscillators with pitch ramps, biquad filters that sweep, LFOs on frequency
for warble. Fantasy instruments to write: fireball whoosh, lightning crack
(noise burst, highpass, very short), dragon roar (two detuned sawtooths,
slow vibrato, lowpass sweeping down, 1.2 s), sword clash (bandpass noise
ping), spell chime, horn (three rising sawtooth whoops), victory fanfare
(three sine bell notes). Create the `AudioContext` lazily and resume it on the
first pointer or key event; browsers require a gesture.

### 7. Two spaces, one convention

Board coordinates are `{ x, y }` with x east and y south. World space maps
`x → X`, `y → Z`, with a fixed `SPACING` per tile. Creatures face `+Z` in
their own model space, so "facing north" is `rotation.y = Math.PI` and a move
turns the rig with `Math.atan2(dx, dz)`. Decide this on day one and never
special-case it.

## Gotchas already paid for

- `[hidden]` needs `display: none !important` when elements are also
  `display: flex`.
- `requestAnimationFrame` pauses in background tabs. Expose `step(dt)` on the
  3D view so tests and dev tools can advance time by hand.
- Size the renderer from its container with a `ResizeObserver`, not the
  window, when the canvas lives inside a panel.
- Refit the camera on resize and on every scene rebuild: compute the distance
  that fits the board for the current aspect ratio, with a generous margin
  because the near edge of a tilted grid is wider than the far edge.
- `element.focus({ preventScroll: true })` when refocusing the command input
  after clicks, or the page jumps.
- Fill the viewport with the panel grid and let the chronicle scroll inside
  its own panel, or it pushes the command bar off screen.
- Dark mode is the only mode; paint backgrounds explicitly.

## Milestones (template)

1. **Models.** One hero model and one dragon on the showcase page, with the
   fleet-style skirmish view. Get the bloom and the lighting right here.
2. **Engine + tests.** Realm generation, travel, spells, wards, wounds, days,
   castles, end conditions. Fuzz it.
3. **Board.** Region map with fog of war, tile scan, status, chronicle,
   command bar with keys, typed lines, and clicks. Playable with no 3D.
4. **Crystal ball.** Sync the scene from the region; replay events: travel,
   flight between regions, lightning, fireballs, dragon breath, ward flares,
   deaths.
5. **Polish.** Title screen, autosave and resume, party chatter, wound
   effects, sounds, handbook page, viewscreen settings pills.

## Conventions

- `bun`, never `npm`. Tests with `bun test`.
- Commit messages: `[#task ID] message`, `[BugFix] message`, or `[Ad Hoc] message`.
- Log with emoji prefixes so console filtering is easy: `🐉` engine,
  `🔮` crystal ball, `🔊` audio, `💾` saves, `✅` ready.
- Every tunable number lives in `src/game/rules.js` and is injected into the
  handbook page, so the docs cannot drift.

## Starter CLAUDE.md for the new repo

```markdown
Fantasy sibling of exp-3js-star-trek: a turn-based realm game with a 2D
board as the source of truth and a procedural three.js "crystal ball" view.

### Tech
| Tool | Purpose |
|------|---------|
| Vite | Build tool and dev server |
| three.js | Procedural 3D, no model files |
| bun | Packages, scripts, `bun test` |
| Web Audio | Synthesised sound, no audio files |

### Rules of the road
- The engine in `src/game/` has no DOM and no three.js. Tests first.
- Views render state and replay events; they never decide anything.
- Every number in `src/game/rules.js`.
- See `fantasy-game-stack.md` for the patterns and gotchas.
```
