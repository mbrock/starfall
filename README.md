# Starfall Keeper

A small three.js game. Pip lives on a tiny planet. Red rings show where meteors will land. Dodge them, collect the star shards they leave behind, and spend your stardust in the shop.

Play it: https://mbrock.github.io/starfall/

## Controls

- **W A S D** or the arrow keys: walk and turn
- **Mouse**: turn and look around. **Esc** frees the cursor and pauses.
- **Space**: dash
- **Right-click**: blink 3 m forward
- **Q / E / G**: Time Drift, Star Burst and Giant Pip (buy them in the shop first)
- **P**: pause
- **M**: sound on or off

Xbox and other standard gamepads also work: left stick moves and turns,
right stick looks, **A** dashes, **B** blinks, **X** uses Star Burst,
**Y** uses Giant Pip, and **LB** uses Time Drift. **Menu/Start** pauses
or resumes. Use the D-pad or left stick to choose menu buttons and **A**
to select; **B** closes the shop or resumes. Press a controller button
once if the browser has not detected it yet. Disconnecting it pauses play.

The whole game is one file, `index.html`. To run it locally:

```
python3 -m http.server 8765
```

then open http://localhost:8765/
