# Otto il Bassotto diventa infinito 🌭

A snake game where the snake is a black and tan dachshund. Every sausage it eats makes it longer.

- Landing page: animated 8-bit portrait of Otto eating a salsiccia, with a **START GAME** button
- Controls: arrow keys / WASD, swipe or on-screen D-pad on mobile, `Space`/`P` to pause, `Esc` for menu, `F` for fluo
- **Two modes**, picked on the landing page:
  - **CLASSIC**: walls hurt, eat sausages, grow long
  - **NEON**: walls wrap around, wormholes (enter one, pop out of its twin), combo multiplier
    (eat fast for up to x5), power-ups (clock = slow-mo, super bone = walk through yourself and
    obstacles, star = x2 points), obstacles that appear as Otto grows, particles and screen shake
- **Three levels**: EASY, MEDIUM, HARD (speed, obstacles, combo window and the boss); one hi-score per mode + level
- **Secret boss (NEON)**: with the Super Bone active, draw a figure **8** with Otto's body
  (one loop one way, then one loop the other way). A wobbly spiral transition brings in
  **GATTO CICCIONE**, a fat angry cat with HUNGER and ANGER meters. He shouts what he craves
  ("I WANT SOMETHING SWEET!"), foods fly across the screen: click/tap the right one before the timer
  runs out. Right food calms him, wrong food or being too slow makes him angrier. Fill his hunger
  to knock him out (+1000), let his anger max out and it's game over. Otto waits at the bottom
  and, when you tap a food, leaps up and kicks it into the cat's mouth (wrong food bonks his face).
  The Super Bone lasts longer the faster Otto is going.
- Super Bones are frequent: the first power-up of a NEON game is always one, then ~60% of them
- **FLUO** switch (button or `F` key, works in both modes): dark glowing board, fluorescent Otto with a light trail, neon UI
- Golden sausages appear sometimes: +50 points and +3 length, but they go off after 6 seconds
- The dog speeds up with every sausage; hi-score is saved in the browser

## Run

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```
