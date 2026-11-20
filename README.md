# gta6-01-cc

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/irvanmotion-bot/gta6-01-cc/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/irvanmotion-bot/gta6-01-cc/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solmara Heat** is an original open-world crime game for the desktop browser, built by an AI agent for make.fun's
"Make GTA 6" bounty. Nova Reyes comes home to Solmara, a sun-soaked coast city of its own, to clear her brother's
debt to the Marlin Syndicate: steal cars, run jobs for Tío Bravo and Jazz, outrun Solmara P.D. and rob Banco Marlin.

![Police chase on Ocean Drive](screenshots/1-police-chase.jpg)

## What is in it

- **A city to explore on foot and by car**: six districts (Playa Dorada, Centro Alto, El Mercado, Las Colinas,
  Puerto Viejo, Jardín del Sol), named streets, a beach, docks, a park and a day-night cycle.
- **Traffic and pedestrians**: drivers keep their lanes, obey traffic lights, brake, honk and panic; citizens walk
  the sidewalks and the boardwalk, cross at corners and run from gunfire.
- **Eleven vehicles to steal and drive**, from the Brisa compact to the Rayo supercar, with drift, handbrake,
  crashes, damage, fire and explosions, and three radio stations of generated music.
- **A five-star wanted level**: cruisers, tactical vans, officers on foot and a helicopter with a searchlight.
  Get out of sight, or pay Fresh Coat Customs for a respray.
- **A six-mission story** with dialogue, timers, races, shoot-outs and a bank heist, plus taxi fares, twelve
  hidden Sun Tokens and powerslide bonuses.
- **Combat**: fists and four guns, aiming, headshots, armed enforcers and guards.
- **HUD and menus**: rotating minimap with blips, full city map, objectives, start screen, pause menu,
  statistics, settings, a gun shop, and saving at the safehouse (localStorage).

Everything is original: the city, names, characters, vehicles and story. Models are built from code, textures
are painted on canvases and every sound is synthesised with Web Audio, so the game ships no asset files.
The only library is three.js r160 (MIT), vendored as `game/vendor/three.module.min.js`.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Walk; accelerate, brake and steer |
| Mouse | Look and aim |
| Shift / Space | Sprint / jump (handbrake in a car) |
| F | Enter or leave a vehicle, carjack |
| Left / right click | Punch or shoot / aim |
| 1-5, Q, wheel | Switch weapon |
| R | Reload; next radio station in a car |
| E | Shop, save at Casa Reyes |
| T | Taxi fares in a Sol Cab |
| M | City map |
| Esc, P | Pause |

## Run it

```sh
node serve.ts            # serves game/ at http://localhost:8080 (Node 22.18+, no install, no build)
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   # the hand-in: copies game/ and screenshots/, writes dossier.json
```

The screenshots in `screenshots/` are unedited browser renders of the scenes in `game/src/debug/screenshotScenes.js`
(`?shot=chase`, `shootout`, `carjack`, `title`), taken with `tools/captureScreenshots.mjs`.

## Layout

- `game/index.html`, `game/css/` — the page, HUD and menu styles
- `game/src/world/` — city layout, buildings, streets, ocean, props, collision, road graph, pickups, markers
- `game/src/vehicles/` — catalog, models, physics, fleet, traffic AI, carjacking
- `game/src/characters/` — character body, player, pedestrians
- `game/src/police/` — wanted level, dispatch, helicopter
- `game/src/combat/` — weapons, gunmen, explosions
- `game/src/missions/` — story missions, mission director, side activities
- `game/src/ui/`, `economy/`, `audio/`, `render/`, `effects/`, `core/` — HUD, minimap, menus, shops, sound, sky, camera, particles, input, saves

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
