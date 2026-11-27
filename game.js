(() => {
  "use strict";

  // ---------- config ----------
  const GRID = 20;            // cells per side
  const CELL = 30;            // canvas px per cell
  const PX = 3;               // canvas px per sprite pixel (10x10 sprites)
  const SP = CELL / PX;       // sprite pixels per cell (10)
  const SIZE = GRID * CELL;
  // difficulty levels (both modes + the cat boss)
  const LEVELS = {
    easy: {
      classicStart: 180, neonStart: 165, step: 3, minSpeed: 85,
      obstacleEvery: 6, comboWindow: 4500,
      boss: { need: 4, anger: 20, reqBase: 8500, reqMin: 5500, wrong: 15, slow: 12, spawn: 850 },
    },
    medium: {
      classicStart: 150, neonStart: 135, step: 5, minSpeed: 60,
      obstacleEvery: 4, comboWindow: 3500,
      boss: { need: 5, anger: 35, reqBase: 6500, reqMin: 3500, wrong: 25, slow: 20, spawn: 720 },
    },
    hard: {
      classicStart: 115, neonStart: 105, step: 6, minSpeed: 48,
      obstacleEvery: 3, comboWindow: 2500,
      boss: { need: 7, anger: 45, reqBase: 5000, reqMin: 2800, wrong: 30, slow: 25, spawn: 560 },
    },
  };
  let level = "medium";
  const L = () => LEVELS[level];
  const startSpeed = () => (mode === "neon" ? L().neonStart : L().classicStart);
  const GOLDEN_CHANCE = 0.18;
  const GOLDEN_LIFETIME = 6000;

  // NEON mode tuning (speed, combo window and obstacle rate come from LEVELS)
  const NEON = {
    maxCombo: 5,
    maxObstacles: 14,
    powerLifetime: 7000,
    powerDuration: { slow: 6000, ghost: 9000, double: 8000 },
  };


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
  // one hi-score per mode + level (classic/medium keeps the original key)
  const hiKey = (m, l) => (m === "classic" && l === "medium") ? "wienerSnakeHi"
    : (m === "neon" && l === "medium") ? "ottoNeonHi" : `ottoHi_${m}_${l}`;
  const getHi = (m = mode, l = level) => parseInt(store.get(hiKey(m, l), "0"), 10) || 0;
  let mode = store.get("ottoMode", "classic") === "neon" ? "neon" : "classic";
  level = LEVELS[store.get("ottoLevel", "medium")] ? store.get("ottoLevel", "medium") : "medium";
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
    warp: () => { tone(1200, 0.18, "sine", 200, 0, 0.09); tone(300, 0.2, "triangle", 1400, 0.08, 0.07); },
  };

  // ---------- state ----------
  let snake, dir, dirQueue, grow, food, score, speed, acc, lastTime, state, eaten, popups, stepCount;
  let obstacles, power, nextPowerAt, effects, combo, bestCombo, lastEatAt, particles, trail, shakeUntil, pausedAt, pulseAt;
  let wormholes = [], nextWormMove = 0, powersSpawned = 0;
  let ghostLoops = [], bossUsed = false, pendingBoss = false, boss = null, trans = null;

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
    speed = startSpeed();
    acc = 0;
    stepCount = 0;
    popups = [];
    obstacles = [];
    power = null;
    nextPowerAt = now + 5000;
    powersSpawned = 0;
    effects = { slow: 0, ghost: 0, double: 0 };
    combo = 0;
    bestCombo = 0;
    lastEatAt = -Infinity;
    particles = [];
    trail = [];
    shakeUntil = 0;
    pulseAt = -Infinity;
    ghostLoops = [];
    bossUsed = false;
    pendingBoss = false;
    wormholes = [];
    if (isNeon()) {
      for (let i = 0; i < (level === "hard" ? 2 : 1); i++) spawnWormholePair(now);
      nextWormMove = now + 22000;
    }
    boss = null;
    trans = null;
    food = null;
    spawnFood(now);
    updateHud(now);
  }

  const key = (x, y) => x + "," + y;

  function freeCells(extraBlocked = []) {
    const occupied = new Set(snake.map(s => key(s.x, s.y)));
    obstacles.forEach(o => occupied.add(key(o.x, o.y)));
    wormholes.forEach(w => { occupied.add(key(w.a.x, w.a.y)); occupied.add(key(w.b.x, w.b.y)); });
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
    // Super Bones are the star: the first power-up is always one, then ~60% of them
    const r = Math.random();
    const type = powersSpawned === 0 || r < 0.6 ? "ghost" : r < 0.8 ? "slow" : "double";
    powersSpawned++;
    power = { ...pick(free), type, born: now };
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
    const hi = getHi();
    $("hi").textContent = hi;
    $("hiLanding").textContent = hi;
    $("hiWhich").textContent = `${mode.toUpperCase()} ${level.toUpperCase()}`;
    let txt = (isNeon() ? "NEON " : "CLASSIC ") + level.toUpperCase();
    if (boss && (state === "boss" || state === "transition")) txt = "BOSS FIGHT!  GATTO CICCIONE";
    else if (isNeon() && snake) {
      if (combo > 1 && now - lastEatAt < L().comboWindow) txt += `  COMBO x${combo}`;
      for (const name of ["slow", "ghost", "double"])
        if (effectOn(name, now)) txt += `  ${POWER_NAMES[name]} ${Math.ceil((effects[name] - now) / 1000)}`;
      if (effectOn("ghost", now) && !bossUsed) txt += "  DRAW AN 8!";
    }
    if (txt !== lastHud2) { $("hudMode").textContent = txt; lastHud2 = txt; }
  }

  // ---------- settings UI ----------
  function applySettings() {
    COLORS = fluo ? FLUO_COLORS : CLASSIC_COLORS;
    document.body.classList.toggle("fluo", fluo);
    document.documentElement.classList.toggle("fluo", fluo);
    document.querySelectorAll("[data-mode]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
    document.querySelectorAll("[data-level]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.level === level)));
    document.querySelectorAll(".fluoBtn").forEach(b => {
      b.setAttribute("aria-pressed", String(fluo));
      b.querySelector(".state").textContent = fluo ? "ON" : "OFF";
    });
    $("modeDesc").innerHTML = isNeon()
      ? "WALLS WRAP &middot; WORMHOLES &middot; COMBOS<br>POWER-UPS &middot; OBSTACLES<br>SUPER BONE + DRAW AN 8 = ???"
      : "THE ORIGINAL. DON'T HIT THE WALLS<br>OR YOUR OWN LONG BODY";
    updateHud();
  }
  function setMode(m) { mode = m; store.set("ottoMode", m); applySettings(); }
  function setLevel(l) { level = l; store.set("ottoLevel", l); applySettings(); }
  document.querySelectorAll("[data-level]").forEach(b => b.addEventListener("click", () => setLevel(b.dataset.level)));
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
      shiftTimers(now - pausedAt);
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
    const newHi = score > getHi();
    if (newHi) store.set(hiKey(mode, level), score);
    updateHud(now);
    overlayTitle.textContent = boss && boss.phase === "lose" ? "THE CAT WON!" : "GAME OVER";
    overlayTitle.style.color = "var(--danger)";
    overlayText.innerHTML =
      `${mode.toUpperCase()} &middot; ${level.toUpperCase()}<br>SAUSAGES EATEN: ${eaten}<br>LENGTH: ${snake.length}<br>SCORE: ${score}` +
      (isNeon() ? `<br>BEST COMBO: x${bestCombo}` : "") +
      (newHi ? `<br><span style="color:var(--accent)">NEW HI-SCORE!</span>` : "");
    retryBtn.innerHTML = "&#9654; PLAY AGAIN";
    overlay.classList.remove("hidden");
    retryBtn.focus();
  }

  // ---------- particles ----------
  function burst(cx, cy, n, colors) { burstAt(cx * CELL + CELL / 2, cy * CELL + CELL / 2, n, colors); }
  function burstAt(x, y, n, colors, speed = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = (60 + Math.random() * 160) * speed;
      particles.push({
        x, y,
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

    // wormholes: step in one, pop out of its twin heading the same way
    for (const w of wormholes) {
      const exit = (head.x === w.a.x && head.y === w.a.y) ? w.b : (head.x === w.b.x && head.y === w.b.y) ? w.a : null;
      if (exit) {
        burst(head.x, head.y, 10, [w.color, "#ffffff"]);
        head.x = exit.x; head.y = exit.y;
        burst(head.x, head.y, 14, [w.color, "#ffffff"]);
        w.usedAt = now;
        sfx.warp();
        break;
      }
    }

    if (!ghost && obstacles.some(o => o.x === head.x && o.y === head.y)) return gameOver(now);

    const willEat = food && head.x === food.x && head.y === food.y;
    const tailMoves = grow === 0 && !willEat;
    const body = tailMoves ? snake.slice(0, -1) : snake;
    if (!ghost && body.some(s => s.x === head.x && s.y === head.y)) return gameOver(now);
    if (ghost && isNeon() && !bossUsed) {
      const idx = snake.findIndex(s => s.x === head.x && s.y === head.y);
      if (idx >= 6) {
        const o = loopOrientation([head, ...snake.slice(0, idx + 1)]);
        if (o) handleLoop(o, head, now);
      }
    }

    snake.unshift(head);
    if (willEat) {
      let pts = food.golden ? 50 : 10;
      let label = "+";
      if (isNeon()) {
        combo = now - lastEatAt < L().comboWindow ? Math.min(NEON.maxCombo, combo + 1) : 1;
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
      speed = Math.max(L().minSpeed, startSpeed() - eaten * L().step);
      if (isNeon() && eaten % L().obstacleEvery === 0 && obstacles.length < NEON.maxObstacles) {
        spawnObstacle();
        sfx.block();
      }
      spawnFood(now);
    }

    if (isNeon() && power && head.x === power.x && head.y === power.y) {
      // Super Bone lasts longer the faster Otto runs (same number of moves to draw an 8)
      const dur = power.type === "ghost"
        ? Math.round(NEON.powerDuration.ghost * startSpeed() / speed)
        : NEON.powerDuration[power.type];
      effects[power.type] = now + dur;
      if (power.type === "ghost") { ghostLoops = []; bossUsed = false; }
      popups.push({ x: power.x, y: power.y, text: POWER_NAMES[power.type], t: now, golden: true });
      burst(power.x, power.y, 20, [COLORS.w, COLORS.B, COLORS.Y]);
      sfx.power();
      power = null;
      nextPowerAt = now + 6000 + Math.random() * 4000;
    }

    if (grow > 0) grow--;
    else {
      const t = snake.pop();
      trail.push({ x: t.x, y: t.y, t: now });
    }
    stepCount++;

    // golden sausages spoil, power-ups come and go
    if (food && food.golden && now - food.born > GOLDEN_LIFETIME) spawnFood(now);
    if (pendingBoss) { pendingBoss = false; startTransition("out", now, () => startBoss(performance.now())); }
    if (isNeon()) {
      if (power && now - power.born > NEON.powerLifetime) { power = null; nextPowerAt = now + 3000 + Math.random() * 4000; }
      if (!power && now > nextPowerAt) spawnPower(now);
      if (level === "medium" && eaten >= 8 && wormholes.length < 2) spawnWormholePair(now);
      if (now > nextWormMove) {
        // move a wormhole pair that nobody is passing through
        const busy = w => snake.some(s => (s.x === w.a.x && s.y === w.a.y) || (s.x === w.b.x && s.y === w.b.y));
        const idle = wormholes.filter(w => !busy(w));
        if (idle.length) { const w = pick(idle); wormholes.splice(wormholes.indexOf(w), 1); spawnWormholePair(now, w.color); }
        nextWormMove = now + 20000 + Math.random() * 8000;
      }
    }
    updateHud(now);
  }

  // ---------- rendering ----------
  function drawSprite(map, cx, cy, offX = 0, offY = 0, size = PX, pal = COLORS) {
    const n = map.length;
    const pad = (n * size - CELL) / 2; // larger sprites stay centred on the cell
    for (let r = 0; r < n; r++) {
      const row = map[r];
      for (let c = 0; c < n; c++) {
        const ch = row[c];
        if (ch === ".") continue;
        ctx.fillStyle = pal[ch];
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
    if (Math.abs(dx) === GRID - 1) dx = -Math.sign(dx);   // neighbours across a wrapped edge
    if (Math.abs(dy) === GRID - 1) dy = -Math.sign(dy);
    if (Math.abs(dx) + Math.abs(dy) !== 1) return null;   // not touching (e.g. split by a wormhole)
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
    if (!towardHead) return;
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

  // ---------- wormholes (NEON) ----------
  const WORM_COLORS = ["#13e8ff", "#ff9f1a", "#ff3df2"];
  function spawnWormholePair(now, color) {
    const head = snake[0];
    const d = DIRS[dir];
    const ahead = [];
    for (let i = 1; i <= 4; i++) ahead.push({ x: (head.x + d.x * i + GRID) % GRID, y: (head.y + d.y * i + GRID) % GRID });
    const free = freeCells(ahead).filter(c => Math.abs(c.x - head.x) + Math.abs(c.y - head.y) > 3);
    for (let tries = 0; tries < 80 && free.length > 1; tries++) {
      const a = pick(free), b = pick(free);
      if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) < 8) continue;
      const used = wormholes.map(w => w.color);
      wormholes.push({ a, b, color: color || WORM_COLORS.find(c => !used.includes(c)) || WORM_COLORS[0], born: now, usedAt: -Infinity });
      return;
    }
  }

  function drawWormholes(now) {
    for (const w of wormholes) {
      const open = Math.min(1, (now - w.born) / 400);
      const flash = Math.max(0, 1 - (now - w.usedAt) / 300);
      for (const [i, c] of [w.a, w.b].entries()) {
        const cx = c.x * CELL + CELL / 2, cy = c.y * CELL + CELL / 2;
        // dark core
        ctx.fillStyle = fluo ? "#000" : "#1a0a2a";
        ctx.fillRect(cx - 12 * open, cy - 12 * open, 24 * open, 24 * open);
        // spinning pixel ring (the two ends spin opposite ways)
        const spin = now / 180 * (i ? -1 : 1);
        for (let k = 0; k < 10; k++) {
          const a = spin + (k / 10) * Math.PI * 2;
          const r = (10 + 3 * Math.sin(now / 200 + k)) * open + flash * 6;
          ctx.fillStyle = k % 2 ? w.color : "#ffffff";
          ctx.fillRect(Math.round((cx + Math.cos(a) * r) / 3) * 3 - 3, Math.round((cy + Math.sin(a) * r) / 3) * 3 - 3, 6, 6);
        }
        // inner spiral dots
        for (let k = 0; k < 4; k++) {
          const a = -spin * 1.6 + k * Math.PI / 2;
          ctx.fillStyle = w.color;
          ctx.fillRect(Math.round(cx + Math.cos(a) * 5 * open) - 2, Math.round(cy + Math.sin(a) * 5 * open) - 2, 3, 3);
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
    const toBody = neighbourDir(tail, snake[n - 2]) || OPPOSITE[dir];
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
      const half = Math.min(SIZE / 2 - 8, p.text.length * 6 + 8);
      const x = Math.min(SIZE - half, Math.max(half, p.x * CELL + CELL / 2)), y = Math.max(16, p.y * CELL - k * 30);
      ctx.fillStyle = fluo ? "#0b0618" : "#000";
      ctx.fillText(p.text, x + 2, y + 2);
      ctx.fillStyle = p.golden ? COLORS.G : (fluo ? "#ffffff" : "#f4e9d8");
      ctx.fillText(p.text, x, y);
    }
  }

  // cheap bloom: downscale (= blur) the sprite layer and add it back on top
  function bloom(out) {
    glowACtx.clearRect(0, 0, glowA.width, glowA.height);
    glowACtx.drawImage(layer, 0, 0, glowA.width, glowA.height);
    glowBCtx.clearRect(0, 0, glowB.width, glowB.height);
    glowBCtx.drawImage(layer, 0, 0, glowB.width, glowB.height);
    out.imageSmoothingEnabled = true;
    out.globalCompositeOperation = "lighter";
    out.globalAlpha = 0.9;
    out.drawImage(glowB, 0, 0, SIZE, SIZE);
    out.globalAlpha = 0.8;
    out.drawImage(glowA, 0, 0, SIZE, SIZE);
    out.globalAlpha = 1;
    out.globalCompositeOperation = "source-over";
    out.imageSmoothingEnabled = false;
    out.drawImage(layer, 0, 0);
  }

  let lastRender = 0;
  function frameDt(now) {
    const dt = Math.min(50, now - (lastRender || now));
    lastRender = now;
    return dt;
  }

  function render(now, out = mainCtx, dt = frameDt(now)) {
    out.save();
    if (now < shakeUntil) {
      const k = (shakeUntil - now) / 450;
      out.translate(Math.round((Math.random() - 0.5) * 16 * k), Math.round((Math.random() - 0.5) * 16 * k));
    }

    ctx = out;
    drawBoard(now);

    // sprites go to a layer, so FLUO can bloom them in one pass
    ctx = fluo ? layerCtx : out;
    if (fluo) ctx.clearRect(0, 0, SIZE, SIZE);
    drawTrail(now);
    drawWormholes(now);
    drawObstacles(now);
    drawFood(now);
    drawPower(now);
    drawDog(now);
    drawParticles(now, dt);

    if (fluo) bloom(out);

    ctx = out;
    drawPopups(now);
    out.restore();
    ctx = mainCtx;
  }

  // =====================================================================
  //  BOSS: GATTO CICCIONE  (NEON mode, Super Bone + figure 8)
  // =====================================================================

  // ---------- figure-8 detection ----------
  // path: cells from the head back along the body to where the head re-enters it.
  // Returns +1 / -1 for the loop's turning direction, 0 if it isn't a plain loop.
  function loopOrientation(path) {
    let ux = 0, uy = 0, area = 0;
    for (let j = 1; j < path.length; j++) {
      const nd = neighbourDir(path[j - 1], path[j]);
      if (!nd) return 0; // the loop went through a wormhole
      const dx = DIRS[nd].x, dy = DIRS[nd].y;
      const nx = ux + dx, ny = uy + dy;
      area += ux * ny - nx * uy;
      ux = nx; uy = ny;
    }
    if (ux !== 0 || uy !== 0) return 0; // went around the wrapped board
    return Math.abs(area) >= 8 ? Math.sign(area) : 0;
  }

  function handleLoop(o, at, now) {
    const last = ghostLoops[ghostLoops.length - 1];
    if (last && last.o === -o && now - last.t < 20000) {
      bossUsed = true;
      pendingBoss = true;
      popups.push({ x: at.x, y: at.y, text: "8 !!!", t: now, golden: true });
      return;
    }
    ghostLoops = [{ o, t: now }];
    popups.push({ x: at.x, y: at.y, text: "LOOP! NOW THE OTHER WAY", t: now, golden: true });
    tone(880, 0.08, "triangle"); tone(1175, 0.1, "triangle", null, 0.08);
  }

  function shiftTimers(dt) {
    if (food) food.born += dt;
    if (power) power.born += dt;
    nextPowerAt += dt;
    nextWormMove += dt;
    lastEatAt += dt;
    for (const k in effects) if (effects[k]) effects[k] += dt;
  }

  // ---------- Scooby-style wavy transition ----------
  const scene = document.createElement("canvas");
  scene.width = scene.height = SIZE;
  const sceneCtx = scene.getContext("2d");
  sceneCtx.imageSmoothingEnabled = false;
  const TRANS_MS = { out: 1400, in: 1200 };

  function wobbleSound(up) {
    if (!audio) return;
    const t0 = audio.currentTime;
    const osc = audio.createOscillator(), lfo = audio.createOscillator();
    const lfoGain = audio.createGain(), gain = audio.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(up ? 260 : 700, t0);
    osc.frequency.exponentialRampToValueAtTime(up ? 700 : 260, t0 + 1.1);
    lfo.frequency.value = 9;
    lfoGain.gain.value = 45;
    lfo.connect(lfoGain).connect(osc.frequency);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.12, t0 + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.2);
    osc.connect(gain).connect(audio.destination);
    osc.start(t0); lfo.start(t0);
    osc.stop(t0 + 1.25); lfo.stop(t0 + 1.25);
  }

  // dir "out": current scene wobbles away into the dark; then onDone() sets up the next scene
  // dir "in": the next scene wobbles in out of the dark
  function startTransition(dir, now, onDone, sceneName) {
    trans = { dir, start: now, onDone, scene: sceneName || (state === "boss" ? "boss" : "game") };
    state = "transition";
    wobbleSound(dir === "out");
    updateHud(now);
  }

  function renderTransition(now) {
    const dt = frameDt(now);
    const t = Math.min(1, (now - trans.start) / TRANS_MS[trans.dir]);
    const k = trans.dir === "out" ? t : 1 - t;                 // wobble strength
    const dark = trans.dir === "out" ? Math.max(0, (t - 0.45) / 0.55) : Math.max(0, 1 - t / 0.6);

    sceneCtx.clearRect(0, 0, SIZE, SIZE);
    if (trans.scene === "boss") renderBoss(now, sceneCtx, dt); else render(now, sceneCtx, dt);

    const out = mainCtx;
    out.fillStyle = "#000";
    out.fillRect(0, 0, SIZE, SIZE);
    // wavy ripple: every band slides sideways on a sine wave
    for (let y = 0; y < SIZE; y += 6) {
      const off = Math.sin(y * 0.04 + now * 0.012) * 90 * k * k + Math.sin(y * 0.11 - now * 0.02) * 20 * k;
      out.drawImage(scene, 0, y, SIZE, 6, off, y, SIZE, 6);
    }
    // spinning spiral
    out.save();
    out.translate(SIZE / 2, SIZE / 2);
    out.rotate(now * 0.005 + k * 8);
    out.globalAlpha = 0.55 * Math.sin(Math.PI * Math.min(1, k * 1.2));
    const cols = fluo ? ["#ff3df2", "#13e8ff"] : ["#e28c46", "#c99a98"];
    for (let i = 0; i < 16; i++) {
      out.fillStyle = cols[i % 2];
      out.beginPath();
      out.moveTo(0, 0);
      for (let r = 0; r <= 900; r += 60) {
        const a = (i / 16) * Math.PI * 2 + r * 0.006 * (1 + k);
        out.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      for (let r = 900; r >= 0; r -= 60) {
        const a = ((i + 0.5) / 16) * Math.PI * 2 + r * 0.006 * (1 + k);
        out.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      out.fill();
    }
    out.restore();
    // shade to dark (radial iris)
    if (dark > 0) {
      const g = out.createRadialGradient(SIZE / 2, SIZE / 2, 0, SIZE / 2, SIZE / 2, SIZE * 0.75);
      g.addColorStop(0, `rgba(0,0,0,${Math.min(1, dark * 1.1)})`);
      g.addColorStop(Math.max(0.01, 1 - dark), `rgba(0,0,0,${Math.min(1, dark * 1.4)})`);
      g.addColorStop(1, "rgba(0,0,0,1)");
      out.fillStyle = g;
      out.globalAlpha = Math.min(1, dark * 1.3);
      out.fillRect(0, 0, SIZE, SIZE);
      out.globalAlpha = 1;
    }

    if (t >= 1) {
      const done = trans.onDone;
      trans = null;
      done(now);
    }
  }

  // ---------- foods ----------
  const FOOD_PAL = {
    p: "#ff6fae", w: "#ffffff", y: "#ffd84a", b: "#c98a4a", o: "#a8692e",
    f: "#4fb3ff", F: "#2a76c4", k: "#10101a", S: "#c8cdd8", B: "#2f6fe0",
    Y: "#ffc21a", h: "#d99a00", r: "#e8402a", m: "#8a4a1e", M: "#c9773a",
    R: "#c0452a", H: "#f08a60", X: "#7a2414", s: "#eadcb0",
    a: "#ff8a1e", A: "#c25a00", g: "#3fc24a", G: "#1f8a2a", l: "#8fe07a",
  };
  const FOODS = {
    donut: ["..........", "...pppp...", ".ppwppypp.", ".pyp..ppp.", "pppb..bpwp", "pwpb..bppp", ".ppbbbbpy.", ".bbbbbbbb.", "...bbbb...", ".........."],
    icecream: ["...wwww...", "..wwwpww..", "..pppppp..", ".pppppppp.", ".pyppwppp.", "..bbbbbb..", "..bobobb..", "...bbbb...", "...bobb...", "....bb...."],
    fish: ["..........", "..........", "...fff...f", ".fffffffff", "fwkfffffFf", "fffffffFff", ".ffffffffF", "...fff...f", "..........", ".........."],
    tuna: ["..........", "..........", ".SSSSSSSS.", "SSSSSSSSSS", "SBBBBBBBBS", "SBwBBBwBBS", "SBBBBBBBBS", "SSSSSSSSSS", ".SSSSSSSS.", ".........."],
    cheese: ["..........", "......yy..", "....yyyyy.", "..yyyyyyyy", "yyyyyyyyyy", "YYYhYYYYYY", "YhYYYYhYYY", "YYYYYYYYhY", "YYYYYYYYYY", ".........."],
    pizza: ["bbbbbbbbbb", ".yyyyyyyy.", ".yrryyyry.", "..yrryyy..", "..yyyyry..", "...yyry...", "...yyyy...", "....yy....", "....y.....", ".........."],
    drumstick: ["..........", "...mmmm...", "..mMMMmm..", ".mMMMMMmm.", ".mMMMMMMm.", "..mMMMMm..", "...mmmw...", "......ww..", ".....wwww.", "......ww.."],
    sausage: ["..........", "..........", "..RRRRRR..", ".RHHHHRRR.", "sRRRRRRRRs", "sRRRRRRRRs", ".XRRRRRRX.", "..XXXXXX..", "..........", ".........."],
    fries: ["..........", ".y.y..y.y.", ".yyy.yyyy.", ".yyyyyyyy.", "rrrrrrrrrr", "rrwrrrrwrr", ".rrrrrrrr.", ".rrrwwrrr.", "..rrrrrr..", "..rrrrrr.."],
    popcorn: ["..ww.ww...", ".wwwwwwww.", "wwywwwyww.", ".wwwwwwww.", ".rwrwrwrw.", ".rwrwrwrw.", ".rwrwrwrw.", "..rwrwrw..", "..rwrwrw..", ".........."],
    carrot: [".....g.g..", "......gg..", ".....aaa..", "....aaaa..", "...aaAa...", "...aaaa...", "..aAaa....", "..aaa.....", ".aa.......", ".a........"],
    broccoli: ["..gg.gg...", ".gGggGgg..", "gggGgggGg.", "gGgggGggg.", ".ggggggg..", "...lll....", "...lll....", "...lll....", "..llll....", ".........."],
  };
  const CRAVINGS = [
    { text: "I WANT SOMETHING SWEET!", foods: ["donut", "icecream"] },
    { text: "GIVE ME FISH! NOW!", foods: ["fish", "tuna"] },
    { text: "CHEESE... I NEED CHEESE!", foods: ["cheese", "pizza"] },
    { text: "MEAT! FEED ME MEAT!", foods: ["drumstick", "sausage"] },
    { text: "SOMETHING SALTY, PLEASE!", foods: ["fries", "popcorn"] },
    { text: "UGH... SOMETHING GREEN.", foods: ["carrot", "broccoli"] },
  ];
  const FOOD_SIZE = 5;               // px per food pixel -> 50px sprites
  const CAT_SCALE = 5;               // 64x58 cat -> 320x290
  const CAT_W = 64, CAT_H = 58;
  const CAT_X = (SIZE - CAT_W * CAT_SCALE) / 2, CAT_Y = SIZE - CAT_H * CAT_SCALE - 6;
  const MOUTH = { x: CAT_X + 32 * CAT_SCALE, y: CAT_Y + 32 * CAT_SCALE };

  function drawMap(c, map, x, y, size, pal, alpha = 1) {
    c.globalAlpha = alpha;
    for (let r = 0; r < map.length; r++)
      for (let col = 0; col < map[r].length; col++) {
        const ch = map[r][col];
        if (ch === ".") continue;
        c.fillStyle = pal[ch];
        c.fillRect(Math.round(x + col * size), Math.round(y + r * size), size, size);
      }
    c.globalAlpha = 1;
  }

  // ---------- the cat, built pixel by pixel ----------
  const catCanvas = document.createElement("canvas");
  catCanvas.width = CAT_W; catCanvas.height = CAT_H;
  const catCtx = catCanvas.getContext("2d");
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

  function buildCat(mood, anger, now) {
    const P = fluo
      ? { fur: hex("#9b5cff"), dark: hex("#5a1fb8"), light: hex("#e0c8ff"), line: hex("#ff3df2"), pink: hex("#ff6fd8") }
      : { fur: hex("#8d86a8"), dark: hex("#5a5370"), light: hex("#c4bfd6"), line: hex("#120a18"), pink: hex("#ff8fb0") };
    const red = hex("#e0303a");
    const tint = Math.max(0, (anger - 30) / 70) * 0.65;
    const fur = mix(P.fur, red, tint), dark = mix(P.dark, red, tint * 0.6), light = mix(P.light, hex("#ffb0b0"), tint * 0.5);
    const yellow = anger > 70 ? hex("#ff5040") : hex("#ffe14d");
    const W = hex("#ffffff"), mouthC = hex("#3a0010"), collar = hex("#c0203a"), spike = hex("#e8e8f0");

    const grid = new Array(CAT_W * CAT_H).fill(null);
    const set = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < CAT_W && y < CAT_H) grid[y * CAT_W + x] = c; };
    const get = (x, y) => (x >= 0 && y >= 0 && x < CAT_W && y < CAT_H) ? grid[y * CAT_W + x] : null;
    const ellipse = (cx, cy, rx, ry, c) => {
      for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
        for (let x = Math.floor(cx - rx); x <= cx + rx; x++)
          if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) set(x, y, c);
    };
    const tri = (a, b, c, col) => {
      const minX = Math.min(a[0], b[0], c[0]), maxX = Math.max(a[0], b[0], c[0]);
      const minY = Math.min(a[1], b[1], c[1]), maxY = Math.max(a[1], b[1], c[1]);
      const s = (p, q, r) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
      for (let y = minY; y <= maxY; y++)
        for (let x = minX; x <= maxX; x++) {
          const pt = [x, y], d1 = s(pt, a, b), d2 = s(pt, b, c), d3 = s(pt, c, a);
          if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) set(x, y, col);
        }
    };
    const line = (x0, y0, x1, y1, c) => {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let i = 0; i <= n; i++) set(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, c);
    };

    // swishing striped tail (behind the body)
    const swish = mood === "sleep" ? 0 : Math.sin(now / (anger > 60 ? 90 : 220));
    for (let s = 0; s <= 1; s += 0.04) {
      const x = 50 + 10 * s + swish * 4 * s, y = 48 - 32 * s;
      ellipse(x, y, 3.4, 3.4, Math.floor(s * 8) % 2 ? dark : fur);
    }
    // fat body, belly, paws
    ellipse(32, 44, 26, 14, fur);
    ellipse(32, 47, 15, 9, light);
    ellipse(20, 55, 6, 3, light);
    ellipse(44, 55, 6, 3, light);
    for (const px2 of [17, 20, 23, 41, 44, 47]) set(px2, 56, dark);
    // body stripes
    for (const x of [10, 13, 51, 54]) line(x, 38, x + (x < 32 ? 2 : -2), 46, dark);
    // ears
    tri([13, 2], [11, 18], [26, 10], fur);
    tri([51, 2], [53, 18], [38, 10], fur);
    tri([14, 6], [14, 15], [22, 11], P.pink);
    tri([50, 6], [50, 15], [42, 11], P.pink);
    // big round head with fat cheeks
    ellipse(32, 21, 19, 14, fur);
    ellipse(32, 27, 22, 9, fur);
    ellipse(32, 30, 9, 5, light);
    // forehead stripes
    line(28, 9, 29, 14, dark); line(32, 8, 32, 14, dark); line(36, 9, 35, 14, dark);
    // spiked collar
    for (let x = 17; x <= 47; x++) { set(x, 36, collar); set(x, 37, collar); }
    for (let x = 19; x <= 45; x += 5) { set(x, 38, spike); set(x + 1, 38, spike); set(x, 39, spike); }

    // eyes
    const eyes = [[24, 21, 1], [40, 21, -1]];
    for (const [cx, cy, side] of eyes) {
      if (mood === "yum" || mood === "sleep") {
        for (let dx = -3; dx <= 3; dx++) set(cx + dx, cy - (mood === "yum" ? (3 - Math.abs(dx)) * 0.6 : 0), P.line);
        continue;
      }
      ellipse(cx, cy, 4.2, 3.2, yellow);
      // angry lid: cut the eye along a slant that dips toward the nose
      for (let x = cx - 5; x <= cx + 5; x++) {
        const lid = cy - 2 + (side > 0 ? (x - (cx - 4)) : ((cx + 4) - x)) * 0.45 + (mood === "hiss" ? 0 : 0);
        for (let y = cy - 4; y < lid; y++) if (get(x, y) === yellow) set(x, y, fur);
        set(x, lid - 1, P.line);
        set(x, lid - 2, P.line);
      }
      const look = Math.round(Math.sin(now / 700) * 1.2);
      for (let y = cy - 1; y <= cy + 2; y++) { set(cx + look, y, P.line); }
      if (mood === "hiss") set(cx + look + 1, cy + 1, P.line);
    }
    // nose
    set(31, 27, P.pink); set(32, 27, P.pink); set(33, 27, P.pink); set(32, 28, P.pink);
    // mouth
    if (mood === "hiss") {
      ellipse(32, 32, 6, 3.5, mouthC);
      ellipse(32, 34, 3, 1.2, P.pink);
      set(28, 30, W); set(28, 31, W); set(36, 30, W); set(36, 31, W);
    } else if (mood === "yum") {
      const chew = Math.floor(now / 120) % 2;
      line(28, 30 + chew, 30, 31, P.line); line(30, 31, 32, 30, P.line); line(32, 30, 34, 31, P.line); line(34, 31, 36, 30 + chew, P.line);
    } else if (mood === "sleep") {
      line(30, 31, 34, 31, P.line);
    } else {
      ellipse(32, 31.5, 4, 2, mouthC);
      set(30, 30, W); set(30, 31, W); set(34, 30, W); set(34, 31, W);
    }
    // whiskers
    const wc = fluo ? hex("#13e8ff") : W;
    line(21, 29, 8, 26, wc); line(21, 31, 7, 32, wc);
    line(43, 29, 56, 26, wc); line(43, 31, 57, 32, wc);

    // outline everything
    const out = grid.slice();
    for (let y = 0; y < CAT_H; y++)
      for (let x = 0; x < CAT_W; x++)
        if (!get(x, y) && (get(x - 1, y) || get(x + 1, y) || get(x, y - 1) || get(x, y + 1)))
          out[y * CAT_W + x] = P.line;

    const img = catCtx.createImageData(CAT_W, CAT_H);
    out.forEach((c, i) => {
      if (!c) return;
      img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255;
    });
    catCtx.putImageData(img, 0, 0);
    return catCanvas;
  }

  // ---------- Otto sprite for the boss arena (side view, 5px pixels) ----------
  const OTTO_U = 5, OTTO_CW = 28, OTTO_CH = 16;
  const OTTO_W = OTTO_CW * OTTO_U, OTTO_H = OTTO_CH * OTTO_U;
  const OTTO_HOME = { x: 6, y: SIZE - OTTO_H - 4 };
  const OTTO_PAW = { x: 21 * OTTO_U, y: 9 * OTTO_U };   // front paw while kicking
  const OTTO_T = { jump: 230, kick: 130, fall: 380 };
  const ottoCanvas = document.createElement("canvas");
  ottoCanvas.width = OTTO_CW; ottoCanvas.height = OTTO_CH;
  const ottoCtx = ottoCanvas.getContext("2d");
  let otto = null;

  function paintOtto(pose, now) {
    const o = ottoCtx, P = COLORS;
    o.clearRect(0, 0, OTTO_CW, OTTO_CH);
    const r = (x, y, w, h, c) => { o.fillStyle = c; o.fillRect(x + 2, y + 3, w, h); };
    const wag = Math.sin(now / (pose === "stand" ? 90 : 50)) > 0 ? 1 : 0;
    // tail
    r(-1, 2 - wag, 1, 3, P.K); r(0, 4, 1, 2, P.K);
    // legs (behind the body)
    if (pose === "stand") {
      const step = Math.floor(now / 160) % 2;
      for (const x of [2, 11]) { r(x, 9, 2, 1, P.K); r(x, 10, 2, 1, P.T); r(x + (step ? 0 : 1), 11, 2, 1, P.D); }
    } else if (pose === "jump") {
      r(-1, 8, 3, 1, P.T); r(-2, 8, 1, 1, P.D);       // back legs stretched back
      r(13, 9, 3, 1, P.T); r(16, 9, 1, 1, P.D);       // front legs tucked
    } else { // kick
      r(-2, 7, 4, 1, P.T); r(-3, 6, 1, 2, P.D);        // back legs push
      r(14, 7, 5, 2, P.T); r(19, 5, 2, 4, P.D);         // front paws strike forward
    }
    // long sausage body
    r(1, 4, 14, 5, P.K);
    r(2, 4, 12, 1, P.S);
    r(11, 7, 3, 2, P.T);   // tan chest
    // head (same profile sprite as the game)
    for (let y = 0; y < HEAD_RIGHT.length; y++)
      for (let x = 0; x < HEAD_RIGHT.length; x++) {
        const ch = HEAD_RIGHT[y][x];
        if (ch !== ".") r(11 + x, -2 + y, 1, 1, P[ch]);
      }
  }

  function drawOtto(c, now) {
    if (!otto || !boss) return;
    let x = otto.x, y = otto.y, pose = "stand";
    const e = now - otto.t;
    if (otto.phase === "jump") {
      const k = Math.min(1, e / OTTO_T.jump);
      x = otto.from.x + (otto.to.x - otto.from.x) * k;
      y = otto.from.y + (otto.to.y - otto.from.y) * k - Math.sin(Math.PI * k) * 60;
      pose = "jump";
    } else if (otto.phase === "kick") {
      pose = "kick";
    } else if (otto.phase === "fall") {
      const k = Math.min(1, e / OTTO_T.fall);
      x = otto.from.x + (OTTO_HOME.x - otto.from.x) * k;
      y = otto.from.y + (OTTO_HOME.y - otto.from.y) * k * k - Math.sin(Math.PI * k) * 30;
      pose = "jump";
    } else if (boss.phase === "win") {
      y -= Math.abs(Math.sin(now / 160)) * 30;           // happy hops
      pose = Math.sin(now / 160) > 0.3 ? "jump" : "stand";
    } else if (boss.phase === "play" || boss.phase === "intro") {
      y -= Math.abs(Math.sin(now / 300)) * 3;            // ready, bouncing on his paws
    }
    paintOtto(pose, now);
    c.save();
    c.imageSmoothingEnabled = false;
    if (otto.face < 0) {
      c.translate(Math.round(x) + OTTO_W, Math.round(y));
      c.scale(-1, 1);
      c.drawImage(ottoCanvas, 0, 0, OTTO_W, OTTO_H);
    } else {
      c.drawImage(ottoCanvas, Math.round(x), Math.round(y), OTTO_W, OTTO_H);
    }
    c.restore();
  }

  // ---------- boss flow ----------
  function startBoss(now) {
    boss = {
      phase: "intro", start: now, anger: L().boss.anger, fed: 0, need: L().boss.need,
      craving: null, reqStart: 0, reqDur: 6000, foods: [], nextSpawn: 0, lastGood: 0,
      mood: "angry", moodUntil: 0, shakeUntil: 0, msg: null, steamAt: 0, pausedFrom: now,
    };
    particles = [];
    otto = { x: OTTO_HOME.x, y: OTTO_HOME.y, phase: "idle", t: now, face: 1, busy: false, food: null };
    startTransition("in", now, () => { state = "boss"; boss.start = performance.now(); }, "boss");
    tone(220, 0.25, "sawtooth", 110, 1.0, 0.1);
  }

  function newCraving(now) {
    const prev = boss.craving;
    let c;
    do { c = pick(CRAVINGS); } while (c === prev);
    boss.craving = c;
    boss.reqStart = now;
    boss.reqDur = Math.max(L().boss.reqMin, L().boss.reqBase - boss.fed * 600);
    boss.lastGood = 0;
    tone(330, 0.08, "square"); tone(262, 0.12, "square", null, 0.08);
  }

  function spawnFlyingFood(now) {
    const needGood = now - boss.lastGood > 1300 || Math.random() < 0.38;
    const name = needGood ? pick(boss.craving.foods)
      : pick(Object.keys(FOODS).filter(f => !boss.craving.foods.includes(f)));
    if (needGood) boss.lastGood = now;
    const fromLeft = Math.random() < 0.5;
    const speed = 170 + Math.random() * 110 + boss.fed * 18;
    boss.foods.push({
      name, x: fromLeft ? -60 : SIZE + 10, y: 150 + Math.random() * 330,
      vx: fromLeft ? speed : -speed, wob: Math.random() * 6, amp: 10 + Math.random() * 30,
      born: now, state: "fly",
    });
  }

  function catMood(m, now, ms) { boss.mood = m; boss.moodUntil = now + ms; }
  function catSay(text, now, color) { boss.msg = { text, t: now, color }; }

  // ---------- Otto, the kicker ----------
  // tap a food: Otto leaps up, kicks it at the cat, then lands back in his corner
  function startKick(f, now) {
    f.good = boss.craving.foods.includes(f.name);
    f.state = "held";
    f.hy = f.drawY === undefined ? f.y : f.drawY;
    const fcx = f.x + 25, fcy = f.hy + 25;
    otto.face = fcx >= OTTO_HOME.x + OTTO_W / 2 ? 1 : -1;
    const pawX = otto.face > 0 ? OTTO_PAW.x : OTTO_W - OTTO_PAW.x;
    otto.from = { x: otto.x, y: otto.y };
    otto.to = { x: fcx - pawX, y: fcy - OTTO_PAW.y };
    otto.phase = "jump"; otto.t = now; otto.busy = true; otto.food = f;
    tone(260, 0.12, "square", 620, 0, 0.07);
  }

  function updateOtto(now) {
    if (!otto) return;
    const e = now - otto.t;
    if (otto.phase === "jump" && e >= OTTO_T.jump) {
      otto.phase = "kick"; otto.t = now;
      otto.x = otto.to.x; otto.y = otto.to.y;
      const f = otto.food;
      if (f && f.state === "held") {
        f.state = "kicked"; f.t = now; f.kx = f.x; f.ky = f.hy;
        f.tx = MOUTH.x - 25; f.ty = MOUTH.y - (f.good ? 25 : 75);
      }
      tone(150, 0.06, "square", 80, 0, 0.12); tone(900, 0.05, "square", null, 0.02, 0.05); // THWACK
      burstAt(otto.x + (otto.face > 0 ? OTTO_PAW.x : OTTO_W - OTTO_PAW.x), otto.y + OTTO_PAW.y, 8, ["#ffffff", "#fff700"], 0.7);
    } else if (otto.phase === "kick" && e >= OTTO_T.kick) {
      otto.phase = "fall"; otto.t = now; otto.from = { x: otto.x, y: otto.y };
    } else if (otto.phase === "fall" && e >= OTTO_T.fall) {
      otto.phase = "idle"; otto.t = now; otto.x = OTTO_HOME.x; otto.y = OTTO_HOME.y; otto.busy = false; otto.face = 1;
    }
  }

  function resolveFood(f, now) {
    if (!boss || boss.phase !== "play") { f.state = "gone"; return; }
    if (f.good) {
      f.state = "gone";
      burstAt(MOUTH.x, MOUTH.y, 12, ["#3fff7a", "#ffffff", "#fff700"], 0.6);
      boss.fed++;
      boss.anger = Math.max(0, boss.anger - 20);
      catMood("yum", now, 900);
      catSay(pick(["YUM!", "PURRR...", "GNAM GNAM!", "GOOD DOG!"]), now, "#3fff7a");
      tone(523, 0.08, "triangle"); tone(784, 0.12, "triangle", null, 0.08); tone(1047, 0.14, "triangle", null, 0.16);
      if (boss.fed >= boss.need) return winBoss(now);
      boss.craving = null;
      boss.nextCraving = now + 900;
    } else {
      // bonk! it bounces off the cat's face
      f.state = "bounce"; f.t = now;
      f.bx = f.tx; f.by = f.ty; f.bvx = (f.kx < MOUTH.x ? -1 : 1) * (180 + Math.random() * 80); f.bvy = -420;
      burstAt(MOUTH.x, MOUTH.y - 50, 14, ["#ff2a6d", "#ffffff", "#ffd84a"]);
      angerUp(L().boss.wrong, now, pick(["HISSSS!", "YUCK!", "WRONG!!", "GRRRR!"]));
    }
  }

  function angerUp(n, now, text) {
    boss.anger = Math.min(100, boss.anger + n);
    catMood("hiss", now, 700);
    boss.shakeUntil = now + 450;
    catSay(text, now, "#ff2a6d");
    tone(180, 0.25, "sawtooth", 90, 0, 0.12);
    if (boss.anger >= 100) loseBoss(now);
  }

  function winBoss(now) {
    boss.phase = "win";
    boss.end = now;
    boss.foods.forEach(f => { if (f.state === "fly") f.state = "gone"; });
    catMood("sleep", now, 1e9);
    catSay("ZZZ... GATTO KO!", now, "#fff700");
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.12, "square", null, i * 0.1));
    setTimeout(() => {
      if (state !== "boss") return;
      const t = performance.now();
      startTransition("out", t, back => {
        const away = back - boss.pausedFrom;
        shiftTimers(away);
        score += 1000;
        effects.ghost = back + 2500; // a moment to untangle
        popups.push({ x: snake[0].x, y: snake[0].y, text: "+1000 GATTO KO!", t: back, golden: true });
        startTransition("in", back, () => { state = "playing"; lastTime = performance.now(); acc = 0; boss = null; updateHud(); }, "game");
      }, "boss");
    }, 2200);
  }

  function loseBoss(now) {
    boss.phase = "lose";
    boss.end = now;
    catSay("MINE!!!", now, "#ff2a6d");
    setTimeout(() => { if (state === "boss") gameOver(performance.now()); }, 900);
  }

  function updateBoss(now) {
    if (!boss) return;
    updateOtto(now);
    if (boss.phase === "intro" && now - boss.start > 1600) {
      boss.phase = "play";
      newCraving(now);
      boss.nextSpawn = now;
    }
    if (boss.phase !== "play") return;
    if (!boss.craving && now > boss.nextCraving) newCraving(now);
    if (boss.craving) {
      if (now > boss.nextSpawn) {
        spawnFlyingFood(now);
        boss.nextSpawn = now + Math.max(380, L().boss.spawn - boss.fed * 50);
      }
      if (now - boss.reqStart > boss.reqDur && !otto.busy) { // never "too slow" mid-kick
        angerUp(L().boss.slow, now, "TOO SLOW!!");
        if (boss.phase === "play") newCraving(now);
      }
    }
  }

  // click / tap on flying food
  canvas.addEventListener("pointerdown", e => {
    if (state !== "boss" || !boss || boss.phase !== "play" || !boss.craving || otto.busy) return;
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * SIZE / r.width, y = (e.clientY - r.top) * SIZE / r.height;
    const now = performance.now();
    let best = null, bestD = 44;
    for (const f of boss.foods) {
      if (f.state !== "fly") continue;
      const fy = f.drawY === undefined ? f.y : f.drawY;
      const d = Math.hypot(f.x + 25 - x, fy + 25 - y);
      if (d < bestD) { best = f; bestD = d; }
    }
    if (best) startKick(best, now);
  });

  // ---------- boss rendering ----------
  function bossText(c, text, x, y, size, color, align = "center", glow = false) {
    c.font = `${size}px "Press Start 2P", monospace`;
    c.textAlign = align;
    c.textBaseline = "middle";
    c.fillStyle = "#000";
    c.fillText(text, x + 2, y + 2);
    if (glow) { c.shadowColor = color; c.shadowBlur = 12; }
    c.fillStyle = color;
    c.fillText(text, x, y);
    c.shadowBlur = 0;
    c.textBaseline = "alphabetic";
  }

  function meter(c, x, y, w, label, value, color, now) {
    bossText(c, label, x, y - 12, 10, "#ffffff", "left");
    c.fillStyle = "#000";
    c.fillRect(x - 3, y - 3, w + 6, 22);
    c.fillStyle = fluo ? "#1a0a30" : "#3a2a40";
    c.fillRect(x, y, w, 16);
    const fill = Math.round(w * Math.max(0, Math.min(1, value)));
    c.fillStyle = color;
    c.fillRect(x, y, fill, 16);
    c.fillStyle = "rgba(255,255,255,0.35)";
    c.fillRect(x, y, fill, 4);
    for (let i = 1; i < 10; i++) { c.fillStyle = "rgba(0,0,0,0.35)"; c.fillRect(x + (w / 10) * i, y, 2, 16); }
  }

  function renderBoss(now, out = mainCtx, dt = 16) {
    if (!boss) return;
    out.save();
    // arena
    if (fluo) {
      out.fillStyle = "#0b0618";
      out.fillRect(0, 0, SIZE, SIZE);
      const g = out.createRadialGradient(SIZE / 2, SIZE * 0.75, 20, SIZE / 2, SIZE * 0.75, SIZE * 0.7);
      g.addColorStop(0, `rgba(255,61,242,${0.25 + boss.anger / 300})`);
      g.addColorStop(1, "rgba(11,6,24,0)");
      out.fillStyle = g;
      out.fillRect(0, 0, SIZE, SIZE);
      out.fillStyle = "rgba(19,232,255,0.12)";
      for (let i = 0; i <= GRID; i++) { out.fillRect(0, SIZE - i * i * 1.5, SIZE, 2); }
    } else {
      for (let y = 0; y < GRID; y++)
        for (let x = 0; x < GRID; x++) {
          out.fillStyle = (x + y) % 2 ? "#5a3a50" : "#503448";
          out.fillRect(x * CELL, y * CELL, CELL, CELL);
        }
      const g = out.createRadialGradient(SIZE / 2, SIZE * 0.78, 20, SIZE / 2, SIZE * 0.78, SIZE * 0.6);
      g.addColorStop(0, `rgba(255,200,120,${0.35 - boss.anger / 500})`);
      g.addColorStop(1, "rgba(0,0,0,0.35)");
      out.fillStyle = g;
      out.fillRect(0, 0, SIZE, SIZE);
    }
    if (boss.anger > 70) {
      out.fillStyle = `rgba(255,0,40,${0.08 + 0.06 * Math.sin(now / 120)})`;
      out.fillRect(0, 0, SIZE, SIZE);
    }

    // sprites (cat, food, particles) -> layer for FLUO bloom
    const c = fluo ? layerCtx : out;
    if (fluo) c.clearRect(0, 0, SIZE, SIZE);
    c.imageSmoothingEnabled = false;

    const mood = boss.phase === "intro" ? "hiss" : (now < boss.moodUntil ? boss.mood : "angry");
    const cat = buildCat(mood, boss.anger, now);
    let sc = CAT_SCALE, cx = CAT_X, cy = CAT_Y;
    const breathe = Math.round(Math.sin(now / 400) * 3);
    if (boss.phase === "lose") {
      const k = Math.min(1, (now - boss.end) / 700);
      sc = CAT_SCALE + k * 5;
      cx = SIZE / 2 - (CAT_W * sc) / 2;
      cy = SIZE - CAT_H * sc + k * 60;
    }
    if (boss.phase === "intro") {
      const k = Math.min(1, (now - boss.start) / 500);
      cy = CAT_Y + (1 - k) * 300;
    }
    if (now < boss.shakeUntil) cx += Math.round((Math.random() - 0.5) * 14);
    c.drawImage(cat, cx, cy - breathe, CAT_W * sc, CAT_H * sc + breathe);

    // steam from the ears when angry
    if (boss.anger >= 60 && boss.phase !== "win") {
      for (let i = 0; i < 4; i++) {
        const p = ((now / 900) + i / 4) % 1;
        const side = i % 2 ? 1 : -1;
        const sx = SIZE / 2 + side * (95 + p * 30), sy = CAT_Y + 10 - p * 70;
        c.globalAlpha = 1 - p;
        c.fillStyle = fluo ? "#ffffff" : "#e8e0f0";
        c.fillRect(Math.round(sx / 5) * 5, Math.round(sy / 5) * 5, 10 + p * 10, 10 + p * 10);
      }
      c.globalAlpha = 1;
    }

    if (fluo) bloom(out);

    // HUD: meters
    meter(out, 24, 34, 250, "HUNGER", boss.fed / boss.need, "#3fff7a", now);
    meter(out, SIZE - 274, 34, 250, "ANGER", boss.anger / 100, boss.anger > 70 ? "#ff2a3a" : "#ff8a1e", now);
    for (let i = 0; i < boss.need; i++) {
      const fx = 24 + i * 22, fy = 64;
      out.globalAlpha = i < boss.fed ? 1 : 0.25;
      drawMap(out, FOODS.sausage, fx, fy, 2, FOOD_PAL);
    }
    out.globalAlpha = 1;

    // speech bubble with the craving + timer
    const bubbleText = boss.phase === "intro" ? "WHO WOKE ME UP?!"
      : boss.msg && now - boss.msg.t < 800 ? boss.msg.text
      : boss.craving ? boss.craving.text
      : boss.msg ? boss.msg.text : "";
    if (bubbleText) {
      const bw = Math.min(560, bubbleText.length * 14 + 40), bh = 56;
      const bx = (SIZE - bw) / 2, by = CAT_Y - 92;
      out.fillStyle = "#000";
      out.fillRect(bx - 4, by - 4, bw + 8, bh + 8);
      out.fillStyle = "#ffffff";
      out.fillRect(bx, by, bw, bh);
      out.fillRect(SIZE / 2 - 10, by + bh, 20, 8);
      out.fillRect(SIZE / 2 - 4, by + bh + 8, 8, 8);
      out.fillStyle = "#000";
      out.fillRect(SIZE / 2 - 14, by + bh + 4, 4, 8);
      out.fillRect(SIZE / 2 + 10, by + bh + 4, 4, 8);
      const isMsg = boss.msg && now - boss.msg.t < 800 && bubbleText === boss.msg.text;
      bossText(out, bubbleText, SIZE / 2, by + 24, 13, isMsg ? boss.msg.color : "#1a0a20");
      if (boss.craving && boss.phase === "play") {
        const left = 1 - (now - boss.reqStart) / boss.reqDur;
        out.fillStyle = "#ddd";
        out.fillRect(bx + 12, by + bh - 14, bw - 24, 6);
        out.fillStyle = left < 0.3 ? "#ff2a3a" : "#ff3df2";
        out.fillRect(bx + 12, by + bh - 14, Math.max(0, (bw - 24) * left), 6);
      }
    }

    // banners
    if (boss.phase === "intro") {
      const k = Math.min(1, (now - boss.start) / 300);
      bossText(out, "BOSS FIGHT!", SIZE / 2, 118 + (1 - k) * -60, 30, "#fff700", "center", fluo);
      bossText(out, "GATTO CICCIONE", SIZE / 2, 156, 16, "#ff3df2", "center", fluo);
      bossText(out, "TAP THE FOOD HE ASKS FOR", SIZE / 2, 184, 10, "#ffffff");
    } else if (boss.phase === "win") {
      bossText(out, "GATTO KO!  +1000", SIZE / 2, 150, 22, "#fff700", "center", fluo);
    }

    // top layer: foods, Otto and particles stay above the bubble and meters
    const top = fluo ? layerCtx : out;
    if (fluo) top.clearRect(0, 0, SIZE, SIZE);
    top.imageSmoothingEnabled = false;
    boss.foods = boss.foods.filter(f => f.state !== "gone" && f.x > -80 && f.x < SIZE + 80 && !(f.state === "bounce" && f.by > SIZE + 60));
    for (const f of boss.foods) {
      if (f.state === "fly") {
        f.x += f.vx * dt / 1000;
        f.drawY = f.y + Math.sin((now - f.born) / 260 + f.wob) * f.amp;
        drawMap(top, FOODS[f.name], f.x, f.drawY, FOOD_SIZE, FOOD_PAL);
      } else if (f.state === "held") {
        drawMap(top, FOODS[f.name], f.x, f.hy, FOOD_SIZE, FOOD_PAL);
      } else if (f.state === "kicked") {
        const k = Math.min(1, (now - f.t) / 300);
        const x = f.kx + (f.tx - f.kx) * k, y = f.ky + (f.ty - f.ky) * k - Math.sin(Math.PI * k) * 40;
        const sz = f.good ? FOOD_SIZE * (1 - k * 0.6) : FOOD_SIZE;
        drawMap(top, FOODS[f.name], x + (FOOD_SIZE - sz) * 5, y + (FOOD_SIZE - sz) * 5, sz, FOOD_PAL);
        if (k >= 1) resolveFood(f, now);
      } else if (f.state === "bounce") {
        f.bx += f.bvx * dt / 1000; f.by += f.bvy * dt / 1000; f.bvy += 1400 * dt / 1000;
        drawMap(top, FOODS[f.name], f.bx, f.by, FOOD_SIZE, FOOD_PAL, 0.85);
      }
    }
    drawOtto(top, now);
    particles = particles.filter(p => (p.life += dt) < p.max);
    for (const p of particles) {
      p.x += p.vx * dt / 1000; p.y += p.vy * dt / 1000; p.vx *= 0.94; p.vy *= 0.94;
      top.fillStyle = p.color;
      top.fillRect(Math.round(p.x / 3) * 3, Math.round(p.y / 3) * 3, 6, 6);
    }
    if (fluo) bloom(out);
    out.restore();
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
    if (state === "boss") updateBoss(now);
    if (state === "transition") renderTransition(now);
    else if (state === "boss" || (state === "over" && boss && boss.phase === "lose")) renderBoss(now, mainCtx, frameDt(now));
    else if (state !== "menu" && snake) render(now);
    requestAnimationFrame(frame);
  }

  state = "menu";
  applySettings();
  requestAnimationFrame(frame);
})();
