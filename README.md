# Starfall Keeper

A small three.js game. Pip lives on a tiny planet. Red rings show where meteors will land. Dodge them, collect the star shards they leave behind, and spend your stardust in the shop. Buy the Launch Base and every 10 shards raise a launch pad that jets Pip off to other worlds, where shards are worth more.

Play it: https://mbrock.github.io/starfall/

## Controls

- **W A S D** or the arrow keys: walk and turn
- **Mouse**: turn and look around. **Esc** frees the cursor and pauses.
- **Space**: dash
- **Right-click**: blink 3 m forward
- **Q / E / G**: Time Drift, Star Burst and Giant Pip (buy them in the shop first)
- **P**: pause
- **M**: sound on or off

### With a controller

Xbox and other standard gamepads also work: left stick moves and turns,
right stick looks, **A** dashes, **B** blinks, **X** uses Star Burst,
**Y** uses Giant Pip, **LB** uses Time Drift and **RB** launches the jets
when travel is on. **Menu/Start** pauses or resumes. Use the D-pad or left
stick to choose menu buttons and **A** to select; **B** closes the shop or
resumes. Press a controller button once if the browser has not detected it
yet. Disconnecting it pauses play.

### On a phone

Play in portrait or landscape. Use your left thumb on the left half of the planet:
drag up/down to walk forward/backward and left/right to turn. Swipe the right half
to turn and look around while walking. Lift your thumb to stop.

The bottom-right buttons give you **Dash** and **Blink** (they share a recharge),
plus **Drift**, **Burst**, and **Giant** once bought in the shop. Each button shows
its remaining recharge time. **Pause** opens the sound and fullscreen controls
(fullscreen is only offered on browsers that support it). Switching apps pauses
the run, and the shop scrolls normally with a swipe.

## Running and changing it

There is no build step: `index.html`, `style.css` and the ES modules in `src/` are served as they are.
To run it locally:

```
python3 -m http.server 8765
```

then open http://localhost:8765/ (add `?debug` to get the game's state on `window.starfall`).
[AGENTS.md](AGENTS.md) describes the layout and how to add upgrades, abilities, cosmetics and landmarks.
