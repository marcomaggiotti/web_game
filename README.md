# Otto il Bassotto diventa infinito 🌭

A snake game where the snake is a black and tan dachshund. Every sausage it eats makes it longer.

- Landing page: animated 8-bit portrait of Otto eating a salsiccia, with a **START GAME** button
- Controls: arrow keys / WASD, swipe or on-screen D-pad on mobile, `Space`/`P` to pause, `Esc` for menu, `F` for fluo
- **Two modes**, picked on the landing page:
  - **CLASSIC**: walls hurt, eat sausages, grow long
  - **NEON**: walls wrap around, combo multiplier (eat fast for up to x5), power-ups
    (clock = slow-mo, super bone = walk through yourself and obstacles, star = x2 points),
    obstacles that appear as Otto grows, particles and screen shake
- **FLUO** switch (button or `F` key, works in both modes): dark glowing board, fluorescent Otto with a light trail, neon UI
- Golden sausages appear sometimes: +50 points and +3 length, but they go off after 6 seconds
- The dog speeds up with every sausage; hi-score is saved in the browser

## Run

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```
