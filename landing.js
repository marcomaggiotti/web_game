// Animated 8-bit portrait on the landing page: Otto sits, blinks, spots a
// salsiccia, chomps it in three bites and looks very pleased with himself.
(() => {
  "use strict";

  const canvas = document.getElementById("hero");
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height; // 80 x 106 art pixels
  ctx.imageSmoothingEnabled = false;

  const img = new Image();
  img.src = "assets/dachshund-8bit.png";

  // landmarks in the 80x106 portrait
  const EYES = [{ x: 27, y: 27, w: 5 }, { x: 47, y: 27, w: 5 }];
  const MOUTH = { x: 33, y: 56, w: 12 };       // line between the lips
  const JAW = { x: 27, y: 56, w: 25, h: 16 };  // chin region that drops when chewing

  const LOOP = 7200;
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const C = {
    black: "#140e12", lid: "#5a5670", mouth: "#2a0608", tongue: "#ff7f9a",
    teeth: "#f4e9d8", R: "#c0452a", H: "#f08a60", X: "#7a2414", s: "#eadcb0",
    heart: "#ff4d6d", heartHi: "#ffb3c1", text: "#ffd35a", crumb: "#b8602a",
  };

  const SAUSAGE = [
    "...RRRRRRRRRRRRRRRR...",
    ".RRHHHHHHHHRRRRRRRRRR.",
    "sRHHRRRRRRRRRRRRRRRRRs",
    "sRRRRRRRRRRRRRRRRRRRRs",
    "sRRRRRRRRRRRRRRRRRRRXs",
    ".XRRRRRRRRRRRRRRRRRXX.",
    "...XXXXXXXXXXXXXXXX...",
  ];
  const HEART = ["0110110", "1111111", "1111111", "0111110", "0011100", "0001000"];
  const FONT = {
    G: ["0111", "1000", "1011", "1001", "0111"],
    N: ["1001", "1101", "1011", "1001", "1001"],
    A: ["0110", "1001", "1111", "1001", "1001"],
    M: ["10001", "11011", "10101", "10001", "10001"],
    "!": ["1", "1", "1", "0", "1"],
  };

  const rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const ease = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);

  function drawSausage(x, y, len) {
    // len = how many columns are left (bitten from the left / mouth side)
    const full = SAUSAGE[0].length;
    const cut = full - len;
    for (let r = 0; r < SAUSAGE.length; r++)
      for (let c = cut; c < full; c++) {
        let ch = SAUSAGE[r][c];
        if (ch === ".") continue;
        if (c === cut && cut > 0) ch = "X"; // bitten end
        rect(x + c - cut, y + r, 1, 1, C[ch]);
      }
  }

  function drawText(str, x, y) {
    const glyphs = [...str].map(ch => FONT[ch]);
    for (const pass of [0, 1]) {
      let cx = x;
      for (const g of glyphs) {
        for (let r = 0; r < g.length; r++)
          for (let c = 0; c < g[r].length; c++)
            if (g[r][c] === "1") {
              if (pass === 0) rect(cx + c - 1, y + r - 1, 3, 3, C.black);
              else rect(cx + c, y + r, 1, 1, C.text);
            }
        cx += g[0].length + 1;
      }
    }
  }

  function drawHeart(x, y) {
    for (let r = 0; r < HEART.length; r++)
      for (let c = 0; c < HEART[r].length; c++)
        if (HEART[r][c] === "1") rect(x + c, y + r, 1, 1, r === 1 && c === 1 ? C.heartHi : C.heart);
  }

  function closedEyes(happy) {
    for (const e of EYES) {
      rect(e.x - 1, e.y - 1, e.w + 2, 4, C.black);
      if (happy) { // ^ ^
        rect(e.x, e.y + 1, 1, 1, C.lid);
        rect(e.x + 1, e.y, e.w - 2, 1, C.lid);
        rect(e.x + e.w - 1, e.y + 1, 1, 1, C.lid);
      } else {
        rect(e.x, e.y + 1, e.w, 1, C.lid);
      }
    }
  }

  function openJaw(k) {
    if (k <= 0) return;
    // drop the chin and paint the open mouth in the gap
    ctx.drawImage(img, JAW.x, JAW.y, JAW.w, JAW.h, JAW.x, JAW.y + k, JAW.w, JAW.h);
    rect(MOUTH.x, MOUTH.y, MOUTH.w, k, C.mouth);
    rect(MOUTH.x + 1, MOUTH.y, 2, 1, C.teeth);
    rect(MOUTH.x + MOUTH.w - 3, MOUTH.y, 2, 1, C.teeth);
    if (k >= 2) rect(MOUTH.x + 3, MOUTH.y + k - 1, MOUTH.w - 6, 1, C.tongue);
  }

  // deterministic crumbs per bite
  const crumbs = [[-3, 0], [2, 1], [-1, 2], [4, 0], [0, 3]];

  function frame(now) {
    requestAnimationFrame(frame);
    if (!canvas.offsetParent || !img.complete || !img.naturalWidth) return; // hidden or not loaded
    const t = reduceMotion ? 0 : now % LOOP;

    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(img, 0, 0);

    const SAUS_Y = MOUTH.y - 3;
    let jaw = 0, sausX = null, sausLen = SAUSAGE[0].length, gnam = false;

    if (t > 1700 && t < 2900) {
      // salsiccia flies in from the right with a little bob
      const k = ease((t - 1700) / 1000);
      sausX = Math.round(W + 2 - k * (W + 2 - (MOUTH.x + 2)));
      if (t > 2500) jaw = Math.round(ease((t - 2500) / 300) * 4);
    } else if (t >= 2900 && t < 4700) {
      // three bites
      const bite = Math.floor((t - 2900) / 600);
      const bt = ((t - 2900) % 600) / 600;
      jaw = bt < 0.45 ? Math.round((1 - bt / 0.45) * 4) : Math.round(((bt - 0.45) / 0.55) * 4);
      sausLen = Math.max(0, SAUSAGE[0].length - (bite + (bt > 0.45 ? 1 : 0)) * 8);
      if (sausLen > 0) sausX = MOUTH.x + 2;
      gnam = true;
      if (bt > 0.4 && bt < 0.9) {
        const f = (bt - 0.4) * 2;
        crumbs.forEach(([dx, dy], i) =>
          rect(MOUTH.x + 6 + dx * (1 + f * 2), MOUTH.y + 3 + dy + Math.round(f * f * 10), 1, 1, i % 2 ? C.crumb : C.R));
      }
      if (bite >= 2 && bt > 0.6) jaw = 0;
    } else if (t >= 4700 && t < 4900) {
      jaw = 0;
    }

    openJaw(jaw);
    if (sausX !== null && sausLen > 0) {
      const bob = t < 2600 ? Math.round(Math.sin(t / 80) * 2) : 0;
      drawSausage(sausX, SAUS_Y + bob + (jaw > 2 ? 1 : 0), sausLen);
    }

    // blink while waiting, squint while chewing, happy ^ ^ afterwards
    const blink = (t > 700 && t < 850) || (t > 1300 && t < 1420);
    const happy = t >= 4800 && t < 6800;
    if (blink || gnam) closedEyes(false);
    if (happy) closedEyes(true);

    if (gnam) {
      const wob = Math.floor(t / 150) % 2;
      drawText("GNAM!", 54 - wob, 6 + wob);
    }

    if (happy) {
      // licking lips + floating hearts
      const lick = Math.floor((t - 4800) / 250) % 2;
      if (t < 5800) rect(MOUTH.x + 4 + lick * 2, MOUTH.y + 1, 3, 2 + lick, C.tongue);
      const ht = (t - 4800) / 2000;
      [[12, 0], [58, 0.2], [66, 0.45]].forEach(([hx, delay]) => {
        const p = ht - delay;
        if (p <= 0 || p >= 0.8) return;
        drawHeart(hx + Math.round(Math.sin(p * 12) * 2), Math.round(24 - p * 30));
      });
    }
  }

  requestAnimationFrame(frame);
})();
