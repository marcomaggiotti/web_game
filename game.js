(() => {
  "use strict";

  // ---------- config ----------
  const GRID = 20;            // cells per side
  const CELL = 30;            // canvas px per cell
  const PX = 3;               // canvas px per sprite pixel (10x10 sprites)
  const SP = CELL / PX;       // sprite pixels per cell (10)
  const SIZE = GRID * CELL;
  const MIN_SPEED = 60;
  const SPEED_STEP = 5;
  const GOLDEN_CHANCE = 0.18;
  const GOLDEN_LIFETIME = 6000;

  // NEON mode tuning
  const NEON = {
    startSpeed: 135,
    comboWindow: 3500,     // ms between sausages to keep the combo going
    maxCombo: 5,
    obstacleEvery: 4,      // sausages
    maxObstacles: 14,
    powerLifetime: 7000,
    powerDuration: { slow: 6000, ghost: 6000, double: 8000 },
  };
  const CLASSIC_START_SPEED = 150;

  // ---------- palettes ----------
  const CLASSIC_COLORS = {
    K: "#140e12", // black fur
    S: "#4e4a5e", // fur sheen
    A: "#2a2030", // ear
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
    B: "#3a7bd5", // clock rim
    w: "#f4f1ea", // white (clock face, bone)
    q: "#9a8f8a", // bone outline
    Y: "#ffd35a", // star
    y: "#c79a1e",
  };
  // FLUO: everything glows on a dark board
  const FLUO_COLORS = {
    ...CLASSIC_COLORS,
    K: "#13e8ff",
    S: "#c9fdff",
    A: "#0a8fc4",
    T: "#ff3df2",
    D: "#b0129f",
    N: "#0b0618",
    E: "#0b0618",
    W: "#ffffff",
    P: "#ffffff",
    R: "#ff6a00",
    H: "#ffd27a",
    X: "#d23a00",
    s: "#ffffff",
    G: "#fff700",
    g: "#ffffff",
    o: "#d4c800",
    B: "#00e5ff",
    w: "#ffffff",
    q: "#b6f7ff",
    Y: "#fff700",
    y: "#ffb800",
  };
  let COLORS = CLASSIC_COLORS;

  // ---------- sprites ----------
  // Head in profile, facing right: domed skull, tan eyebrow, long snout with
  // tan muzzle, nose at the tip and a long floppy ear hanging below the neck.
  // 14x14 pixels, drawn bigger than a cell so the snout pokes forward.
  const HEAD_RIGHT = [
    "..............",
    ".....KKKK.....",
    "....KSSSKK....",
    "KKKKKKKKKKK...",
    "KKKKKKKTTKKK..",
    "KKKKKKWEKKKKK.",
    "KKAAKKKKKKKSKN",
    "KAAAAKKKKKKKNN",
    "KAAAAKKTTTTTTT",
    "KAAAAKKTTTTTD.",
    "KAAAAKKKTTTD..",
    "KAAAA..KTPT...",
    ".AAAA.........",
    "..AA..........",
  ];

  // Head seen from above, facing up: long narrow snout, tan eyebrows and
  // both ears flopping out to the sides.
  const HEAD_UP = [
    "......NN......",
    ".....TNNT.....",
    ".....TKKT.....",
    ".....TKKT.....",
    "....KKSSKK....",
    "....KKSSKK....",
    "...KEWKKWEK...",
    "...KTKKKKTK...",
    ".AAKKKKKKKKAA.",
    "AAAKKKKKKKKAAA",
    "AAAKKKKKKKKAAA",
    "AAAKKKKKKKKAAA",
    ".AAKKKKKKKKAA.",
    "...KKKKKKKK...",
  ];

  const mirror = m => m.map(row => [...row].reverse().join(""));
  const HEADS = {
    right: HEAD_RIGHT,
    left: mirror(HEAD_RIGHT),
    up: HEAD_UP,
    down: [...HEAD_UP].reverse(),
  };

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

  // power-ups (NEON mode)
  const POWER_SPRITES = {
    slow: [ // clock: everything slows down
      "..........",
      "...BBBB...",
      "..BwwwwB..",
      ".BwwwNwwB.",
      ".BwwwNwwB.",
      ".BwwwNNwB.",
      ".BwwwwwwB.",
      "..BwwwwB..",
      "...BBBB...",
      "..........",
    ],
    ghost: [ // super bone: walk through yourself and obstacles
      "..........",
      "..........",
      ".qq....qq.",
      "qwwq..qwwq",
      "qwwwwwwwwq",
      "qwwwwwwwwq",
      "qwwq..qwwq",
      ".qq....qq.",
      "..........",
      "..........",
    ],
    double: [ // star: double points
      "....YY....",
      "....YY....",
      "...YYYY...",
      "YYYYYYYYYY",
      ".YYYYYYYY.",
      "..YYYYYY..",
      "..YYyyYY..",
      ".YYy..yYY.",
      ".Yy....yY.",
      "..........",
    ],
  };
  const POWER_NAMES = { slow: "SLOW-MO", ghost: "SUPER BONE", double: "x2 POINTS" };

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
  const mainCtx = canvas.getContext("2d");
  mainCtx.imageSmoothingEnabled = false;
  let ctx = mainCtx;

  // offscreen layers for the FLUO glow
  const layer = document.createElement("canvas");
  layer.width = layer.height = SIZE;
  const layerCtx = layer.getContext("2d");
  layerCtx.imageSmoothingEnabled = false;
  const glowA = document.createElement("canvas");
  glowA.width = glowA.height = SIZE / 4;
  const glowACtx = glowA.getContext("2d");
  const glowB = document.createElement("canvas");
  glowB.width = glowB.height = SIZE / 10;
  const glowBCtx = glowB.getContext("2d");

  const screens = { landing: $("landing"), game: $("game") };
  const overlay = $("overlay");
  const overlayTitle = $("overlayTitle");
  const overlayText = $("overlayText");
  const retryBtn = $("retryBtn");

  // ---------- storage (best effort) ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { /* ignore */ } },
  };
  const HI_KEYS = { classic: "wienerSnakeHi", neon: "ottoNeonHi" };
  const hiScores = {
    classic: parseInt(store.get(HI_KEYS.classic, "0"), 10) || 0,
    neon: parseInt(store.get(HI_KEYS.neon, "0"), 10) || 0,
  };
  let mode = store.get("ottoMode", "classic") === "neon" ? "neon" : "classic";
  let fluo = store.get("ottoFluo", "0") === "1";

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
    eat: (combo = 1) => { const k = 1 + (combo - 1) * 0.15; tone(520 * k, 0.06); tone(780 * k, 0.08, "square", null, 0.06); },
    golden: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.08, "square", null, i * 0.07)),
    bark: () => { tone(420, 0.09, "sawtooth", 180, 0, 0.1); tone(380, 0.1, "sawtooth", 160, 0.13, 0.1); },
    die: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.16, "triangle", null, i * 0.15, 0.12)),
    start: () => [262, 330, 392, 523].forEach((f, i) => tone(f, 0.07, "square", null, i * 0.07)),
    power: () => [660, 880, 1320].forEach((f, i) => tone(f, 0.1, "triangle", f * 1.5, i * 0.06, 0.1)),
    block: () => tone(140, 0.12, "square", 90, 0, 0.06),
  };

  // ---------- state ----------
  let snake, dir, dirQueue, grow, food, score, speed, acc, lastTime, state, eaten, popups, stepCount;
  let obstacles, power, nextPowerAt, effects, combo, bestCombo, lastEatAt, particles, trail, shakeUntil, pausedAt, pulseAt;

  const isNeon = () => mode === "neon";
  const effectOn = (name, now) => effects[name] > now;

  function reset(now) {
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
    speed = isNeon() ? NEON.startSpeed : CLASSIC_START_SPEED;
    acc = 0;
    stepCount = 0;
    popups = [];
    obstacles = [];
    power = null;
    nextPowerAt = now + 8000;
    effects = { slow: 0, ghost: 0, double: 0 };
    combo = 0;
    bestCombo = 0;
    lastEatAt = -Infinity;
    particles = [];
    trail = [];
    shakeUntil = 0;
    pulseAt = -Infinity;
    food = null;
    spawnFood(now);
    updateHud(now);
  }

  const key = (x, y) => x + "," + y;

  function freeCells(extraBlocked = []) {
    const occupied = new Set(snake.map(s => key(s.x, s.y)));
    obstacles.forEach(o => occupied.add(key(o.x, o.y)));
    if (food) occupied.add(key(food.x, food.y));
    if (power) occupied.add(key(power.x, power.y));
    extraBlocked.forEach(c => occupied.add(key(c.x, c.y)));
    const free = [];
    for (let y = 0; y < GRID; y++)
      for (let x = 0; x < GRID; x++)
        if (!occupied.has(key(x, y))) free.push({ x, y });
    return free;
  }
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  function spawnFood(now) {
    food = null;
    const free = freeCells();
    if (!free.length) return;
    const cell = pick(free);
    const golden = eaten > 2 && Math.random() < GOLDEN_CHANCE;
    food = { ...cell, golden, born: now };
  }

  function spawnPower(now) {
    const head = snake[0];
    const free = freeCells().filter(c => Math.abs(c.x - head.x) + Math.abs(c.y - head.y) > 3);
    if (!free.length) return;
    power = { ...pick(free), type: pick(["slow", "ghost", "double"]), born: now };
  }

  function spawnObstacle() {
    const shapes = [
      [[0, 0]],
      [[0, 0], [1, 0]],
      [[0, 0], [0, 1]],
      [[0, 0], [1, 0], [0, 1]],
      [[0, 0], [1, 0], [2, 0]],
      [[0, 0], [0, 1], [0, 2]],
    ];
    const head = snake[0];
    const d = DIRS[dir];
    // keep the next few cells in front of the dog clear
    const ahead = [];
    for (let i = 1; i <= 5; i++) ahead.push({ x: (head.x + d.x * i + GRID) % GRID, y: (head.y + d.y * i + GRID) % GRID });
    const free = new Set(freeCells(ahead).map(c => key(c.x, c.y)));
    for (let tries = 0; tries < 60; tries++) {
      const shape = pick(shapes);
      const ox = Math.floor(Math.random() * GRID), oy = Math.floor(Math.random() * GRID);
      if (Math.abs(ox - head.x) + Math.abs(oy - head.y) < 5) continue;
      const cells = shape.map(([dx, dy]) => ({ x: ox + dx, y: oy + dy }));
      if (cells.every(c => c.x < GRID && c.y < GRID && free.has(key(c.x, c.y)))) {
        cells.forEach(c => obstacles.push({ ...c, born: performance.now() }));
        return;
      }
    }
  }

  let lastHud2 = "";
  function updateHud(now = performance.now()) {
    $("score").textContent = score;
    $("length").textContent = snake ? snake.length : 0;
    $("hi").textContent = hiScores[mode];
    $("hiClassic").textContent = hiScores.classic;
    $("hiNeon").textContent = hiScores.neon;
    let txt = isNeon() ? "NEON" : "CLASSIC";
    if (isNeon() && snake) {
      if (combo > 1 && now - lastEatAt < NEON.comboWindow) txt += `  COMBO x${combo}`;
      for (const name of ["slow", "ghost", "double"])
        if (effectOn(name, now)) txt += `  ${POWER_NAMES[name]} ${Math.ceil((effects[name] - now) / 1000)}`;
    }
    if (txt !== lastHud2) { $("hudMode").textContent = txt; lastHud2 = txt; }
  }

  // ---------- settings UI ----------
  function applySettings() {
    COLORS = fluo ? FLUO_COLORS : CLASSIC_COLORS;
    document.body.classList.toggle("fluo", fluo);
    document.documentElement.classList.toggle("fluo", fluo);
    document.querySelectorAll("[data-mode]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
    document.querySelectorAll(".fluoBtn").forEach(b => {
      b.setAttribute("aria-pressed", String(fluo));
      b.querySelector(".state").textContent = fluo ? "ON" : "OFF";
    });
    $("modeDesc").innerHTML = isNeon()
      ? "WALLS WRAP AROUND &middot; COMBOS<br>POWER-UPS &middot; OBSTACLES"
      : "THE ORIGINAL. DON'T HIT THE WALLS<br>OR YOUR OWN LONG BODY";
    updateHud();
  }
  function setMode(m) { mode = m; store.set("ottoMode", m); applySettings(); }
  function toggleFluo() { fluo = !fluo; store.set("ottoFluo", fluo ? "1" : "0"); applySettings(); }

  document.querySelectorAll("[data-mode]").forEach(b => b.addEventListener("click", () => setMode(b.dataset.mode)));
  document.querySelectorAll(".fluoBtn").forEach(b => b.addEventListener("click", e => { toggleFluo(); e.currentTarget.blur(); }));

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
      if (state === "menu") return; // let arrows move focus on the landing page
      e.preventDefault();
      queueDir(KEYMAP[e.code]);
      return;
    }
    if (e.code === "KeyF") {
      toggleFluo();
    } else if (e.code === "Space" || e.code === "KeyP") {
      if (state === "playing" || state === "paused") { e.preventDefault(); togglePause(); }
    } else if (e.code === "Enter") {
      const onButton = document.activeElement && document.activeElement.tagName === "BUTTON";
      if (state === "over" || (state === "menu" && !onButton)) { e.preventDefault(); startGame(); }
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
    const now = performance.now();
    reset(now);
    show("game");
    overlay.classList.add("hidden");
    state = "playing";
    lastTime = now;
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
    const now = performance.now();
    if (state === "playing") {
      state = "paused";
      pausedAt = now;
      overlayTitle.textContent = "PAUSED";
      overlayTitle.style.color = "var(--accent)";
      overlayText.textContent = "GOOD DOG. TAKE A NAP.";
      retryBtn.innerHTML = "&#9654; RESUME";
      overlay.classList.remove("hidden");
    } else if (state === "paused") {
      // freeze every timer while paused
      const dt = now - pausedAt;
      if (food) food.born += dt;
      if (power) power.born += dt;
      nextPowerAt += dt;
      lastEatAt += dt;
      for (const k in effects) if (effects[k]) effects[k] += dt;
      state = "playing";
      overlay.classList.add("hidden");
      lastTime = now;
    }
  }

  function gameOver(now) {
    state = "over";
    sfx.die();
    if (isNeon()) {
      shakeUntil = now + 450;
      snake.forEach((s, i) => { if (i % 2 === 0) burst(s.x, s.y, 4, [COLORS.K, COLORS.T, COLORS.S]); });
    }
    const newHi = score > hiScores[mode];
    if (newHi) { hiScores[mode] = score; store.set(HI_KEYS[mode], score); }
    updateHud(now);
    overlayTitle.textContent = "GAME OVER";
    overlayTitle.style.color = "var(--danger)";
    overlayText.innerHTML =
      `SAUSAGES EATEN: ${eaten}<br>LENGTH: ${snake.length}<br>SCORE: ${score}` +
      (isNeon() ? `<br>BEST COMBO: x${bestCombo}` : "") +
      (newHi ? `<br><span style="color:var(--accent)">NEW HI-SCORE!</span>` : "");
    retryBtn.innerHTML = "&#9654; PLAY AGAIN";
    overlay.classList.remove("hidden");
    retryBtn.focus();
  }

  // ---------- particles ----------
  function burst(cx, cy, n, colors) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 160;
      particles.push({
        x: cx * CELL + CELL / 2, y: cy * CELL + CELL / 2,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: 0, max: 350 + Math.random() * 350, color: pick(colors),
      });
    }
  }

  // ---------- simulation ----------
  function step(now) {
    if (dirQueue.length) dir = dirQueue.shift();
    const d = DIRS[dir];
    const head = { x: snake[0].x + d.x, y: snake[0].y + d.y };
    const ghost = isNeon() && effectOn("ghost", now);

    if (head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID) {
      if (!isNeon()) return gameOver(now);
      head.x = (head.x + GRID) % GRID;          // NEON: wrap around the edges
      head.y = (head.y + GRID) % GRID;
    }

    if (!ghost && obstacles.some(o => o.x === head.x && o.y === head.y)) return gameOver(now);

    const willEat = food && head.x === food.x && head.y === food.y;
    const tailMoves = grow === 0 && !willEat;
    const body = tailMoves ? snake.slice(0, -1) : snake;
    if (!ghost && body.some(s => s.x === head.x && s.y === head.y)) return gameOver(now);

    snake.unshift(head);
    if (willEat) {
      let pts = food.golden ? 50 : 10;
      let label = "+";
      if (isNeon()) {
        combo = now - lastEatAt < NEON.comboWindow ? Math.min(NEON.maxCombo, combo + 1) : 1;
        bestCombo = Math.max(bestCombo, combo);
        lastEatAt = now;
        pts *= combo * (effectOn("double", now) ? 2 : 1);
        burst(food.x, food.y, food.golden ? 26 : 16, food.golden ? [COLORS.G, COLORS.g, COLORS.o] : [COLORS.R, COLORS.H, COLORS.s]);
        pulseAt = now;
      }
      grow += food.golden ? 3 : 1;
      score += pts;
      eaten++;
      label += pts + (isNeon() && combo > 1 ? " x" + combo : "");
      popups.push({ x: food.x, y: food.y, text: label, t: now, golden: food.golden });
      food.golden ? sfx.golden() : sfx.eat(isNeon() ? combo : 1);
      if (eaten % 5 === 0) sfx.bark();
      speed = Math.max(MIN_SPEED, (isNeon() ? NEON.startSpeed : CLASSIC_START_SPEED) - eaten * SPEED_STEP);
      if (isNeon() && eaten % NEON.obstacleEvery === 0 && obstacles.length < NEON.maxObstacles) {
        spawnObstacle();
        sfx.block();
      }
      spawnFood(now);
    }

    if (isNeon() && power && head.x === power.x && head.y === power.y) {
      effects[power.type] = now + NEON.powerDuration[power.type];
      popups.push({ x: power.x, y: power.y, text: POWER_NAMES[power.type], t: now, golden: true });
      burst(power.x, power.y, 20, [COLORS.w, COLORS.B, COLORS.Y]);
      sfx.power();
      power = null;
      nextPowerAt = now + 9000 + Math.random() * 7000;
    }

    if (grow > 0) grow--;
    else {
      const t = snake.pop();
      trail.push({ x: t.x, y: t.y, t: now });
    }
    stepCount++;

    // golden sausages spoil, power-ups come and go
    if (food && food.golden && now - food.born > GOLDEN_LIFETIME) spawnFood(now);
    if (isNeon()) {
      if (power && now - power.born > NEON.powerLifetime) { power = null; nextPowerAt = now + 6000 + Math.random() * 6000; }
      if (!power && now > nextPowerAt) spawnPower(now);
    }
    updateHud(now);
  }

  // ---------- rendering ----------
  function drawSprite(map, cx, cy, offX = 0, offY = 0, size = PX) {
    const n = map.length;
    const pad = (n * size - CELL) / 2; // larger sprites stay centred on the cell
    for (let r = 0; r < n; r++) {
      const row = map[r];
      for (let c = 0; c < n; c++) {
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
    let dx = b.x - a.x, dy = b.y - a.y;
    if (dx > 1) dx = -1; else if (dx < -1) dx = 1;   // neighbours across a wrapped edge
    if (dy > 1) dy = -1; else if (dy < -1) dy = 1;
    if (dx > 0) return "right";
    if (dx < 0) return "left";
    if (dy > 0) return "down";
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

  function legs(seg, towardHead, phase, front) {
    const shift = phase ? 1 : -1;
    if (towardHead === "left" || towardHead === "right") {
      // side view: two short stubby legs under the belly, stepping in turn
      const fwd = towardHead === "right" ? 1 : -1;
      [1, 6].forEach((lx, i) => {
        const lifted = (i === 0) === phase;
        const len = lifted ? 2 : 3;
        px(seg.x, seg.y, lx, SP - 2, 3, 2, COLORS.K);            // upper leg
        px(seg.x, seg.y, lx, SP, 3, len - 1, COLORS.T);           // tan lower leg
        px(seg.x, seg.y, fwd > 0 ? lx + 1 : lx - 1, SP + len - 1, 3, 1, COLORS.D); // paw
      });
      if (front) {
        // tan chest like the real Otto
        const cx = towardHead === "right" ? 5 : 1;
        px(seg.x, seg.y, cx, SP - 4, 4, 3, COLORS.T);
        px(seg.x, seg.y, cx, SP - 2, 4, 1, COLORS.D);
      }
    } else {
      const y = 3 + shift;
      px(seg.x, seg.y, -2, y, 3, 3, COLORS.T);
      px(seg.x, seg.y, SP - 1, y - 2 * shift, 3, 3, COLORS.T);
      px(seg.x, seg.y, -2, y, 1, 3, COLORS.D);
      px(seg.x, seg.y, SP + 1, y - 2 * shift, 1, 3, COLORS.D);
    }
  }

  function drawBoard(now) {
    if (!fluo) {
      for (let y = 0; y < GRID; y++)
        for (let x = 0; x < GRID; x++) {
          ctx.fillStyle = (x + y) % 2 ? "#c99a98" : "#bf8e8d"; // the pink wall from the photo
          ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
        }
      return;
    }
    // FLUO: dark board with a pulsing neon grid
    ctx.fillStyle = "#0b0618";
    ctx.fillRect(0, 0, SIZE, SIZE);
    const beat = 0.5 + 0.5 * Math.sin(now / 300);
    const hit = Math.max(0, 1 - (now - pulseAt) / 400);
    ctx.fillStyle = `rgba(255, 61, 242, ${0.10 + beat * 0.06 + hit * 0.35})`;
    for (let i = 0; i <= GRID; i++) {
      ctx.fillRect(i * CELL - 1, 0, 2, SIZE);
      ctx.fillRect(0, i * CELL - 1, SIZE, 2);
    }
    ctx.fillStyle = `rgba(19, 232, 255, ${0.25 + hit * 0.4})`;
    for (let y = 0; y <= GRID; y += 1)
      for (let x = 0; x <= GRID; x += 1)
        ctx.fillRect(x * CELL - 2, y * CELL - 2, 4, 4);
  }

  function drawObstacles(now) {
    for (const o of obstacles) {
      const x = o.x * CELL, y = o.y * CELL;
      const grow = Math.min(1, (now - o.born) / 250);
      const inset = Math.round((1 - grow) * CELL / 2);
      if (fluo) {
        ctx.fillStyle = "#39ff14";
        ctx.fillRect(x + inset, y + inset, CELL - inset * 2, CELL - inset * 2);
        ctx.fillStyle = "#0b0618";
        ctx.fillRect(x + inset + 4, y + inset + 4, Math.max(0, CELL - inset * 2 - 8), Math.max(0, CELL - inset * 2 - 8));
        ctx.fillStyle = "#39ff14";
        ctx.fillRect(x + 12, y + 12, 6, 6);
      } else {
        // knitted grey block like the blanket in the photo
        ctx.fillStyle = "#6f6878";
        ctx.fillRect(x + inset, y + inset, CELL - inset * 2, CELL - inset * 2);
        if (grow >= 1) {
          ctx.fillStyle = "#a8a2b0";
          ctx.fillRect(x, y, CELL, 3); ctx.fillRect(x, y, 3, CELL);
          ctx.fillStyle = "#3e3846";
          ctx.fillRect(x, y + CELL - 3, CELL, 3); ctx.fillRect(x + CELL - 3, y, 3, CELL);
          ctx.fillStyle = "#857e8e";
          for (let i = 0; i < 3; i++) ctx.fillRect(x + 6 + i * 7, y + 9, 3, 12);
        }
      }
    }
  }

  function drawTrail(now) {
    if (!fluo) return;
    trail = trail.filter(t => now - t.t < 320);
    for (const t of trail) {
      const k = 1 - (now - t.t) / 320;
      ctx.fillStyle = `rgba(19, 232, 255, ${0.45 * k})`;
      const s = Math.round(CELL * (0.3 + 0.4 * k));
      ctx.fillRect(t.x * CELL + (CELL - s) / 2, t.y * CELL + (CELL - s) / 2, s, s);
    }
  }

  function drawDog(now) {
    const n = snake.length;
    const phase = stepCount % 2 === 0;
    const ghost = isNeon() && effectOn("ghost", now);
    if (ghost) {
      const left = effects.ghost - now;
      ctx.globalAlpha = left < 1500 && Math.floor(now / 100) % 2 ? 0.8 : 0.45;
    }

    // body segments
    for (let i = 1; i < n - 1; i++) {
      const seg = snake[i];
      const sides = [neighbourDir(seg, snake[i - 1]), neighbourDir(seg, snake[i + 1])];
      tube(seg, sides, 1, COLORS.K);
      sheen(seg, sides, 1);
    }

    // short legs: front pair behind the head, back pair before the tail
    if (n >= 3) legs(snake[1], neighbourDir(snake[1], snake[0]), phase, true);
    if (n >= 4) legs(snake[n - 2], neighbourDir(snake[n - 2], snake[n - 3]), !phase, false);

    // tail: a thin whip that tapers and wags upward, like a dachshund's
    const tail = snake[n - 1];
    const toBody = neighbourDir(tail, snake[n - 2]);
    const wag = Math.sin(now / 90) > 0 ? 1 : 0;
    const tip = OPPOSITE[toBody];
    if (tip === "left" || tip === "right") {
      const r = tip === "right";
      px(tail.x, tail.y, r ? 0 : 5, 3, 5, 3, COLORS.K);
      px(tail.x, tail.y, r ? 4 : 2, 2 - wag, 3, 2, COLORS.K);
      px(tail.x, tail.y, r ? 7 : 0, 1 - wag * 2, 3, 2, COLORS.K);
      px(tail.x, tail.y, r ? 0 : 5, 5, 4, 1, COLORS.D);
    } else {
      const d = tip === "down";
      px(tail.x, tail.y, 3, d ? 0 : 5, 4, 5, COLORS.K);
      px(tail.x, tail.y, 4 + wag, d ? 4 : 2, 2, 4, COLORS.K);
      px(tail.x, tail.y, 4 - wag, d ? 7 : 0, 2, 3, COLORS.K);
    }

    // neck: fill gap between head and first body piece
    const head = snake[0];
    const neckSide = neighbourDir(head, snake[1]);
    tube(head, [neckSide], 2, COLORS.K);
    drawSprite(HEADS[currentFacing()], head.x, head.y, 0, 0, 4);
    ctx.globalAlpha = 1;
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
      if (!fluo) {
        ctx.fillStyle = "rgba(255, 240, 160, 0.45)";
        ctx.fillRect(food.x * CELL - PX, food.y * CELL - PX, CELL + PX * 2, CELL + PX * 2);
      }
    }
    drawSprite(food.golden ? GOLDEN : SAUSAGE, food.x, food.y, 0, bob);
  }

  function drawPower(now) {
    if (!power) return;
    const left = NEON.powerLifetime - (now - power.born);
    if (left < 2000 && Math.floor(now / 120) % 2) return;
    const s = 1 + Math.round((Math.sin(now / 150) + 1) / 2); // pulse 1..2 px
    if (!fluo) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.beginPath();
      ctx.arc(power.x * CELL + CELL / 2, power.y * CELL + CELL / 2, CELL / 2 + s, 0, Math.PI * 2);
      ctx.fill();
    }
    drawSprite(POWER_SPRITES[power.type], power.x, power.y, 0, 0, PX);
  }

  function drawParticles(now, dt) {
    particles = particles.filter(p => (p.life += dt) < p.max);
    for (const p of particles) {
      p.x += p.vx * dt / 1000;
      p.y += p.vy * dt / 1000;
      p.vx *= 0.94; p.vy *= 0.94;
      const s = p.life / p.max < 0.5 ? 6 : 3;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x / 3) * 3, Math.round(p.y / 3) * 3, s, s);
    }
  }

  function drawPopups(now) {
    ctx.font = '12px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    popups = popups.filter(p => now - p.t < 800);
    for (const p of popups) {
      const k = (now - p.t) / 800;
      const x = Math.min(SIZE - 60, Math.max(60, p.x * CELL + CELL / 2)), y = Math.max(16, p.y * CELL - k * 30);
      ctx.fillStyle = fluo ? "#0b0618" : "#000";
      ctx.fillText(p.text, x + 2, y + 2);
      ctx.fillStyle = p.golden ? COLORS.G : (fluo ? "#ffffff" : "#f4e9d8");
      ctx.fillText(p.text, x, y);
    }
  }

  let lastRender = 0;
  function render(now) {
    const dt = Math.min(50, now - (lastRender || now));
    lastRender = now;

    mainCtx.save();
    if (now < shakeUntil) {
      const k = (shakeUntil - now) / 450;
      mainCtx.translate(Math.round((Math.random() - 0.5) * 16 * k), Math.round((Math.random() - 0.5) * 16 * k));
    }

    ctx = mainCtx;
    drawBoard(now);

    // sprites go to a layer, so FLUO can bloom them in one pass
    ctx = fluo ? layerCtx : mainCtx;
    if (fluo) ctx.clearRect(0, 0, SIZE, SIZE);
    drawTrail(now);
    drawObstacles(now);
    drawFood(now);
    drawPower(now);
    drawDog(now);
    drawParticles(now, dt);

    if (fluo) {
      // cheap bloom: downscale (= blur) the sprite layer and add it back on top
      glowACtx.clearRect(0, 0, glowA.width, glowA.height);
      glowACtx.drawImage(layer, 0, 0, glowA.width, glowA.height);
      glowBCtx.clearRect(0, 0, glowB.width, glowB.height);
      glowBCtx.drawImage(layer, 0, 0, glowB.width, glowB.height);
      mainCtx.imageSmoothingEnabled = true;
      mainCtx.globalCompositeOperation = "lighter";
      mainCtx.globalAlpha = 0.9;
      mainCtx.drawImage(glowB, 0, 0, SIZE, SIZE);
      mainCtx.globalAlpha = 0.8;
      mainCtx.drawImage(glowA, 0, 0, SIZE, SIZE);
      mainCtx.globalAlpha = 1;
      mainCtx.globalCompositeOperation = "source-over";
      mainCtx.imageSmoothingEnabled = false;
      mainCtx.drawImage(layer, 0, 0);
    }

    ctx = mainCtx;
    drawPopups(now);
    mainCtx.restore();
  }

  // ---------- loop ----------
  function frame(now) {
    if (state === "playing") {
      acc += now - lastTime;
      lastTime = now;
      const stepMs = isNeon() && effectOn("slow", now) ? speed * 1.6 : speed;
      // cap to avoid spiral after tab switch
      if (acc > 1000) acc = stepMs;
      while (acc >= stepMs && state === "playing") {
        acc -= stepMs;
        step(now);
      }
      if (isNeon()) updateHud(now);
    }
    if (state !== "menu" && snake) render(now);
    requestAnimationFrame(frame);
  }

  state = "menu";
  applySettings();
  requestAnimationFrame(frame);
})();
