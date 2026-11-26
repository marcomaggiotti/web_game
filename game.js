(() => {
  "use strict";

  // ---------- config ----------
  const GRID = 20;            // cells per side
  const CELL = 30;            // canvas px per cell
  const PX = 3;               // canvas px per sprite pixel (10x10 sprites)
  const SP = CELL / PX;       // sprite pixels per cell (10)
  const START_SPEED = 150;    // ms per step
  const MIN_SPEED = 60;
  const SPEED_STEP = 5;
  const GOLDEN_CHANCE = 0.18;
  const GOLDEN_LIFETIME = 6000;

  const COLORS = {
    K: "#140e12", // black fur
    S: "#4e4a5e", // fur sheen
    A: "#2a1f28", // ear
    T: "#e28c46", // tan
    D: "#b8602a", // dark tan
    N: "#000000", // nose
    E: "#3a1a08", // eye
    W: "#ffffff", // eye glint
    P: "#ff7f9a", // tongue
    R: "#c0452a", // sausage
    H: "#f08a60", // sausage highlight
    X: "#7a2414", // sausage shadow
    s: "#eadcb0", // sausage string
    G: "#ffd35a", // golden sausage
    g: "#fff2b0",
    o: "#c79a1e",
  };

  // Head, facing right (snout on the right, ear flopping back-left).
  const HEAD_RIGHT = [
    "...KKKK...",
    "..KSSSKK..",
    ".KKKTTKKK.",
    ".KKKWEKKKK",
    "AAKKKKKKKN",
    "AAAKTTTTTN",
    "AAA.TTTTT.",
    ".AA..TPT..",
    "..A.......",
    "..........",
  ];

  const SAUSAGE = [
    "..........",
    "..........",
    "..RRRRRR..",
    ".RHHHHRRR.",
    "sRRRRRRRRs",
    "sRRRRRRRRs",
    ".XRRRRRRX.",
    "..XXXXXX..",
    "..........",
    "..........",
  ];
  const GOLDEN = SAUSAGE.map(r => r.replace(/R/g, "G").replace(/H/g, "g").replace(/X/g, "o"));

  const rotCCW = m => m.map((_, r) => m.map(row => row[SP - 1 - r]).join(""));
  const rotCW = m => m.map((_, r) => m.map((_, c) => m[SP - 1 - c][r]).join(""));
  const mirror = m => m.map(row => [...row].reverse().join(""));

  const HEADS = {
    right: HEAD_RIGHT,
    left: mirror(HEAD_RIGHT),
    up: rotCCW(HEAD_RIGHT),
    down: rotCW(HEAD_RIGHT),
  };

  const DIRS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };
  const OPPOSITE = { up: "down", down: "up", left: "right", right: "left" };

  // ---------- DOM ----------
  const $ = id => document.getElementById(id);
  const canvas = $("canvas");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const screens = { landing: $("landing"), game: $("game") };
  const overlay = $("overlay");
  const overlayTitle = $("overlayTitle");
  const overlayText = $("overlayText");
  const retryBtn = $("retryBtn");

  // ---------- storage (best effort) ----------
  let hiScore = 0;
  try { hiScore = parseInt(localStorage.getItem("wienerSnakeHi") || "0", 10) || 0; } catch (e) { /* ignore */ }
  const saveHi = () => { try { localStorage.setItem("wienerSnakeHi", String(hiScore)); } catch (e) { /* ignore */ } };

  // ---------- audio ----------
  let audio = null;
  function initAudio() {
    if (audio) { if (audio.state === "suspended") audio.resume(); return; }
    try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audio = null; }
  }
  function tone(freq, dur, type = "square", slideTo = null, delay = 0, vol = 0.08) {
    if (!audio) return;
    const t0 = audio.currentTime + delay;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(audio.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }
  const sfx = {
    eat: () => { tone(520, 0.06); tone(780, 0.08, "square", null, 0.06); },
    golden: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.08, "square", null, i * 0.07)),
    bark: () => { tone(420, 0.09, "sawtooth", 180, 0, 0.1); tone(380, 0.1, "sawtooth", 160, 0.13, 0.1); },
    die: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.16, "triangle", null, i * 0.15, 0.12)),
    start: () => [262, 330, 392, 523].forEach((f, i) => tone(f, 0.07, "square", null, i * 0.07)),
  };

  // ---------- state ----------
  let snake, dir, dirQueue, grow, food, score, speed, acc, lastTime, state, eaten, popups, stepCount;

  function reset() {
    const cy = Math.floor(GRID / 2);
    snake = [
      { x: 7, y: cy },
      { x: 6, y: cy },
      { x: 5, y: cy },
      { x: 4, y: cy },
    ];
    dir = "right";
    dirQueue = [];
    grow = 0;
    score = 0;
    eaten = 0;
    speed = START_SPEED;
    acc = 0;
    stepCount = 0;
    popups = [];
    food = null;
    spawnFood();
    updateHud();
  }

  function spawnFood() {
    const occupied = new Set(snake.map(s => s.x + "," + s.y));
    const free = [];
    for (let y = 0; y < GRID; y++)
      for (let x = 0; x < GRID; x++)
        if (!occupied.has(x + "," + y)) free.push({ x, y });
    if (!free.length) { food = null; return; }
    const cell = free[Math.floor(Math.random() * free.length)];
    const golden = eaten > 2 && Math.random() < GOLDEN_CHANCE;
    food = { ...cell, golden, born: performance.now() };
  }

  function updateHud() {
    $("score").textContent = score;
    $("length").textContent = snake ? snake.length : 0;
    $("hi").textContent = hiScore;
    $("hiLanding").textContent = hiScore;
  }

  // ---------- input ----------
  function queueDir(d) {
    if (state !== "playing") return;
    const last = dirQueue.length ? dirQueue[dirQueue.length - 1] : dir;
    if (d === last || d === OPPOSITE[last]) return;
    if (dirQueue.length < 3) dirQueue.push(d);
  }

  const KEYMAP = {
    ArrowUp: "up", KeyW: "up",
    ArrowDown: "down", KeyS: "down",
    ArrowLeft: "left", KeyA: "left",
    ArrowRight: "right", KeyD: "right",
  };

  document.addEventListener("keydown", e => {
    if (KEYMAP[e.code]) {
      e.preventDefault();
      queueDir(KEYMAP[e.code]);
      return;
    }
    if (e.code === "Space" || e.code === "KeyP") {
      if (state === "playing" || state === "paused") { e.preventDefault(); togglePause(); }
    } else if (e.code === "Enter") {
      if (state === "menu") { e.preventDefault(); startGame(); }
      else if (state === "over") { e.preventDefault(); startGame(); }
    } else if (e.code === "Escape") {
      if (state !== "menu") toMenu();
    }
  });

  // swipe
  let touchStart = null;
  canvas.addEventListener("touchstart", e => {
    const t = e.changedTouches[0];
    touchStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  canvas.addEventListener("touchmove", e => {
    if (!touchStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    queueDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
    touchStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  canvas.addEventListener("touchend", () => { touchStart = null; }, { passive: true });

  document.querySelectorAll(".padbtn[data-dir]").forEach(btn => {
    const fire = e => { e.preventDefault(); queueDir(btn.dataset.dir); };
    btn.addEventListener("touchstart", fire, { passive: false });
    btn.addEventListener("mousedown", fire);
  });
  $("pauseBtn").addEventListener("click", () => togglePause());

  $("startBtn").addEventListener("click", startGame);
  retryBtn.addEventListener("click", () => {
    if (state === "paused") togglePause(); else startGame();
  });
  $("menuBtn").addEventListener("click", toMenu);

  // ---------- flow ----------
  function show(name) {
    Object.entries(screens).forEach(([k, el]) => el.classList.toggle("active", k === name));
  }

  function startGame() {
    initAudio();
    reset();
    show("game");
    overlay.classList.add("hidden");
    state = "playing";
    lastTime = performance.now();
    sfx.start();
  }

  function toMenu() {
    state = "menu";
    overlay.classList.add("hidden");
    updateHud();
    show("landing");
    $("startBtn").focus();
  }

  function togglePause() {
    if (state === "playing") {
      state = "paused";
      overlayTitle.textContent = "PAUSED";
      overlayTitle.style.color = "var(--accent)";
      overlayText.textContent = "GOOD DOG. TAKE A NAP.";
      retryBtn.innerHTML = "&#9654; RESUME";
      overlay.classList.remove("hidden");
    } else if (state === "paused") {
      state = "playing";
      overlay.classList.add("hidden");
      lastTime = performance.now();
    }
  }

  function gameOver() {
    state = "over";
    sfx.die();
    const newHi = score > hiScore;
    if (newHi) { hiScore = score; saveHi(); }
    updateHud();
    overlayTitle.textContent = "GAME OVER";
    overlayTitle.style.color = "var(--danger)";
    overlayText.innerHTML =
      `SAUSAGES EATEN: ${eaten}<br>LENGTH: ${snake.length}<br>SCORE: ${score}` +
      (newHi ? `<br><span style="color:var(--accent)">NEW HI-SCORE!</span>` : "");
    retryBtn.innerHTML = "&#9654; PLAY AGAIN";
    overlay.classList.remove("hidden");
    retryBtn.focus();
  }

  // ---------- simulation ----------
  function step(now) {
    if (dirQueue.length) dir = dirQueue.shift();
    const d = DIRS[dir];
    const head = { x: snake[0].x + d.x, y: snake[0].y + d.y };

    if (head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID) return gameOver();

    const willEat = food && head.x === food.x && head.y === food.y;
    const tailMoves = grow === 0 && !willEat;
    const body = tailMoves ? snake.slice(0, -1) : snake;
    if (body.some(s => s.x === head.x && s.y === head.y)) return gameOver();

    snake.unshift(head);
    if (willEat) {
      const pts = food.golden ? 50 : 10;
      grow += food.golden ? 3 : 1;
      score += pts;
      eaten++;
      popups.push({ x: food.x, y: food.y, text: "+" + pts, t: now, golden: food.golden });
      food.golden ? sfx.golden() : sfx.eat();
      if (eaten % 5 === 0) sfx.bark();
      speed = Math.max(MIN_SPEED, START_SPEED - eaten * SPEED_STEP);
      spawnFood();
    }
    if (grow > 0) grow--; else snake.pop();
    stepCount++;

    // golden sausages spoil
    if (food && food.golden && now - food.born > GOLDEN_LIFETIME) spawnFood();
    updateHud();
  }

  // ---------- rendering ----------
  function drawSprite(map, cx, cy, offX = 0, offY = 0, size = PX) {
    const pad = (SP * size - CELL) / 2; // larger sprites stay centred on the cell
    for (let r = 0; r < SP; r++) {
      const row = map[r];
      for (let c = 0; c < SP; c++) {
        const ch = row[c];
        if (ch === ".") continue;
        ctx.fillStyle = COLORS[ch];
        ctx.fillRect(cx * CELL + c * size + offX - pad, cy * CELL + r * size + offY - pad, size, size);
      }
    }
  }

  // fill in sprite-pixel units relative to a cell
  function px(cx, cy, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(cx * CELL + x * PX, cy * CELL + y * PX, w * PX, h * PX);
  }

  function neighbourDir(a, b) {
    if (!b) return null;
    if (b.x > a.x) return "right";
    if (b.x < a.x) return "left";
    if (b.y > a.y) return "down";
    return "up";
  }

  // draw a tube segment inside cell with given inset, extending toward given sides
  function tube(seg, sides, inset, color) {
    const len = SP - inset * 2;
    px(seg.x, seg.y, inset, inset, len, len, color);
    for (const s of sides) {
      if (s === "left") px(seg.x, seg.y, 0, inset, inset, len, color);
      if (s === "right") px(seg.x, seg.y, SP - inset, inset, inset, len, color);
      if (s === "up") px(seg.x, seg.y, inset, 0, len, inset, color);
      if (s === "down") px(seg.x, seg.y, inset, SP - inset, len, inset, color);
    }
  }

  function sheen(seg, sides, inset) {
    // one-pixel highlight stripe along the back of the dog
    const horiz = sides.some(s => s === "left" || s === "right");
    const vert = sides.some(s => s === "up" || s === "down");
    if (horiz) {
      const x0 = sides.includes("left") ? 0 : inset + 1;
      const x1 = sides.includes("right") ? SP : SP - inset - 1;
      px(seg.x, seg.y, x0, inset + 1, x1 - x0, 1, COLORS.S);
    }
    if (vert) {
      const y0 = sides.includes("up") ? 0 : inset + 1;
      const y1 = sides.includes("down") ? SP : SP - inset - 1;
      px(seg.x, seg.y, inset + 1, y0, 1, y1 - y0, COLORS.S);
    }
  }

  function legs(seg, towardHead, phase) {
    // little tan paws sticking out either side, shuffling as the dog walks
    const shift = phase ? 1 : -1;
    if (towardHead === "left" || towardHead === "right") {
      const x = 3 + shift;
      px(seg.x, seg.y, x, -2, 3, 3, COLORS.T);
      px(seg.x, seg.y, x - 2 * shift, SP - 1, 3, 3, COLORS.T);
      px(seg.x, seg.y, x, -2, 3, 1, COLORS.D);
      px(seg.x, seg.y, x - 2 * shift, SP + 1, 3, 1, COLORS.D);
    } else {
      const y = 3 + shift;
      px(seg.x, seg.y, -2, y, 3, 3, COLORS.T);
      px(seg.x, seg.y, SP - 1, y - 2 * shift, 3, 3, COLORS.T);
      px(seg.x, seg.y, -2, y, 1, 3, COLORS.D);
      px(seg.x, seg.y, SP + 1, y - 2 * shift, 1, 3, COLORS.D);
    }
  }

  function drawBoard() {
    for (let y = 0; y < GRID; y++)
      for (let x = 0; x < GRID; x++) {
        ctx.fillStyle = (x + y) % 2 ? "#c99a98" : "#bf8e8d"; // the pink wall from the photo
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
  }

  function drawDog(now) {
    const n = snake.length;
    const phase = stepCount % 2 === 0;

    // legs first so the body overlaps them
    if (n >= 3) legs(snake[1], neighbourDir(snake[1], snake[0]), phase);
    if (n >= 4) legs(snake[n - 2], neighbourDir(snake[n - 2], snake[n - 3]), !phase);

    // body segments
    for (let i = 1; i < n - 1; i++) {
      const seg = snake[i];
      const sides = [neighbourDir(seg, snake[i - 1]), neighbourDir(seg, snake[i + 1])];
      tube(seg, sides, 1, COLORS.K);
      sheen(seg, sides, 1);
    }

    // tail: thinner, tapering, wagging
    const tail = snake[n - 1];
    const toBody = neighbourDir(tail, snake[n - 2]);
    tube(tail, [toBody], 3, COLORS.K);
    const wag = Math.sin(now / 90) > 0 ? 1 : -1;
    const tip = OPPOSITE[toBody];
    if (tip === "left") px(tail.x, tail.y, 0, 4 + wag, 3, 2, COLORS.K);
    if (tip === "right") px(tail.x, tail.y, SP - 3, 4 + wag, 3, 2, COLORS.K);
    if (tip === "up") px(tail.x, tail.y, 4 + wag, 0, 2, 3, COLORS.K);
    if (tip === "down") px(tail.x, tail.y, 4 + wag, SP - 3, 2, 3, COLORS.K);

    // neck: fill gap between head and first body piece
    const head = snake[0];
    const neckSide = neighbourDir(head, snake[1]);
    tube(head, [neckSide], 2, COLORS.K);
    drawSprite(HEADS[currentFacing()], head.x, head.y, 0, 0, 4);
  }

  function currentFacing() {
    // face the direction the head actually moved (not queued input)
    return OPPOSITE[neighbourDir(snake[0], snake[1])] || dir;
  }

  function drawFood(now) {
    if (!food) return;
    const bob = Math.round(Math.sin(now / 200) * 1) * PX;
    if (food.golden) {
      const left = GOLDEN_LIFETIME - (now - food.born);
      if (left < 2000 && Math.floor(now / 120) % 2) return; // blink before spoiling
      ctx.fillStyle = "rgba(255, 240, 160, 0.45)";
      ctx.fillRect(food.x * CELL - PX, food.y * CELL - PX, CELL + PX * 2, CELL + PX * 2);
    }
    drawSprite(food.golden ? GOLDEN : SAUSAGE, food.x, food.y, 0, bob);
  }

  function drawPopups(now) {
    ctx.font = '12px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    popups = popups.filter(p => now - p.t < 700);
    for (const p of popups) {
      const k = (now - p.t) / 700;
      ctx.fillStyle = "#000";
      const x = p.x * CELL + CELL / 2, y = p.y * CELL - k * 30;
      ctx.fillText(p.text, x + 2, y + 2);
      ctx.fillStyle = p.golden ? COLORS.G : "#f4e9d8";
      ctx.fillText(p.text, x, y);
    }
  }

  function render(now) {
    drawBoard();
    drawFood(now);
    drawDog(now);
    drawPopups(now);
  }

  // ---------- loop ----------
  function frame(now) {
    if (state === "playing") {
      acc += now - lastTime;
      lastTime = now;
      // cap to avoid spiral after tab switch
      if (acc > 1000) acc = speed;
      while (acc >= speed && state === "playing") {
        acc -= speed;
        step(now);
      }
    }
    if (state !== "menu" && snake) render(now);
    requestAnimationFrame(frame);
  }

  state = "menu";
  updateHud();
  requestAnimationFrame(frame);
})();
