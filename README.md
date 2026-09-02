# Fantasy Realm — skirmish

A 12×12 board with forests and mountains, four procedurally built pieces
(dragon, orc, wizard, rogue), and a hotseat free-for-all: each piece takes a
turn, moves, attacks, and the last one standing wins. Everything is three.js
primitives; no model, texture, or audio files.

```bash
bun install
bun run dev      # http://localhost:5178 (port set by DEV_PORT in .env)
bun test         # engine tests (combat, terrain, rules, fuzz)
bun run build
```

## Playing

The active piece is outlined in gold and pre-selected. Click a **green** tile to
move there, click a **red** piece (or its square) to attack, then **End turn**
(Enter). A piece that does nothing on its turn heals.

- Drag to orbit, scroll or `+` / `−` to zoom, `f` to fit the board.
- `←` `→` rotate in 45° steps, space auto-rotates.
- `n` starts a new realm with fresh terrain.

Combat is Polytopia-style and fully deterministic (all numbers in
`src/game/rules.js`):

```
attackForce  = atk × hp/maxHp
defenceForce = def × hp/maxHp × terrainBonus     (forest 1.5×)
damage       = round(attackForce / total × atk × 4.5)
retaliation  = round(defenceForce / total × def × 4.5)   from pre-hit HP
```

| Piece | HP | Atk | Def | Move | Range | Skill |
|-------|----|-----|-----|------|-------|-------|
| 🐉 Dragon | 25 | 5 | 3 | 2 | 1 | Fly: crosses and stands on mountains |
| 🪓 Orc | 15 | 3 | 3 | 1 | 1 | Persist: attacks again after a kill |
| 🧙 Wizard | 10 | 4 | 1 | 1 | 2 | Ranged (no retaliation from 2 tiles); rests heal 4 |
| 🗡️ Rogue | 10 | 2 | 1 | 3 | 1 | Escape: may move again after attacking |

Melee attackers advance into the square of a piece they kill. Mountains stop
everyone but the Dragon.

## Layout

```
src/
├── game/            # PURE ENGINE: no DOM, no three.js
│   ├── rules.js     # every number: board size, terrain, roster, combat
│   ├── rng.js       # seeded mulberry32
│   ├── terrain.js   # seeded forest / mountain generation, reach helpers
│   ├── combat.js    # resolveCombat(attacker, defender, opts)
│   └── game.js      # Game: move / attack / endTurn → { ok, events }
├── crystalball.js   # 3D view: sync(game), play(events), highlights, picking
├── stage.js         # renderer, camera, lights, bloom, fit / zoom / rotate
├── timeline.js      # schedules replay callbacks
├── effects.js       # flashes and bolts
├── hud.js           # banner, unit cards, chronicle
├── main.js          # wiring: clicks, keys, buttons
└── models/          # board + terrain props, humanoid rig, the four pieces
tests/               # bun test; helpers.js builds boards from ASCII pictures
```

Board coordinates are `{ x, y }` with x east and y south; world X = x,
world Z = y. Models face +Z. `window.__game`, `__view`, and `__stage` are dev
hooks for the console.

See `fantasy-game-stack.md` for the longer plan.
