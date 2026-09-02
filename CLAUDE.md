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
- Board coords `{x, y}`, x east, y south. World: x → X, y → Z. Models face +Z.
- Log with emoji prefixes: 🐉 engine, 🔮 crystal ball, 🔊 audio, 💾 saves, ✅ ready.
