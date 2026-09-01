const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const W = canvas.width;
const H = canvas.height;
const GROUND_Y = H - 68;

const scoreEl = document.getElementById('score');
const hiEl = document.getElementById('hiScore');
const startScreen = document.getElementById('startScreen');
const overScreen = document.getElementById('overScreen');
const overLine = document.getElementById('overLine');
const startBtn = document.getElementById('startBtn');
const retryBtn = document.getElementById('retryBtn');
const soundBtn = document.getElementById('soundBtn');

const headImg = new Image();
headImg.src = '../../assets/friend-head.png';

const HI_KEY = 'dinoHeadRun.hi';

const state = {
  running: false,
  over: false,
  sound: true,
  speed: 8,
  score: 0,
  hi: Number(localStorage.getItem(HI_KEY) || 0),
  ground: 0,
  frame: 0,
  spawnIn: 60,
  obstacles: [],
  clouds: [],
  jumpHeld: false
};

const runner = {
  x: 130,
  y: GROUND_Y,
  vy: 0,
  bodyW: 54,
  bodyH: 60,
  headSize: 118,
  ducking: false,
  onGround: true,
  holdFrames: 0
};

const GRAVITY = 0.85;
const JUMP_V = -15.5;
const HOLD_LIFT = -0.34;
const MAX_HOLD_FRAMES = 12;

/* ---------- audio ---------- */
let audioCtx = null;

function beep(freq, dur, type = 'square', gain = 0.05) {
  if (!state.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = gain;
    osc.connect(g).connect(audioCtx.destination);
    osc.start();
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    osc.stop(audioCtx.currentTime + dur);
  } catch (e) { /* audio unavailable */ }
}

/* ---------- helpers ---------- */
function pad(n) {
  return String(Math.floor(n)).padStart(5, '0');
}

function runnerBox() {
  const h = runner.ducking ? runner.bodyH * 0.55 : runner.bodyH;
  const headH = runner.ducking ? runner.headSize * 0.72 : runner.headSize;
  return {
    x: runner.x - 40,
    y: runner.y - h - headH * 0.78,
    w: 92,
    h: h + headH * 0.78
  };
}

function hit(a, b) {
  const pad = 12;
  return a.x + pad < b.x + b.w &&
    a.x + a.w - pad > b.x &&
    a.y + pad < b.y + b.h &&
    a.y + a.h - pad > b.y;
}

/* ---------- spawning ---------- */
function spawnObstacle() {
  const flying = state.score > 350 && Math.random() < 0.28;

  if (flying) {
    const lane = Math.random() < 0.6 ? 145 : 200;
    state.obstacles.push({
      type: 'bird',
      x: W + 40,
      y: GROUND_Y - lane,
      w: 62,
      h: 44,
      wing: 0
    });
  } else {
    const count = 1 + Math.floor(Math.random() * 3);
    const w = 20 + count * 16;
    const h = 46 + Math.random() * 34;
    state.obstacles.push({
      type: 'cactus',
      x: W + 40,
      y: GROUND_Y - h,
      w,
      h,
      count
    });
  }

  const gap = Math.max(52, 108 - state.speed * 3);
  state.spawnIn = gap + Math.random() * 60;
}

function spawnCloud() {
  state.clouds.push({
    x: W + 60,
    y: 50 + Math.random() * 130,
    s: 0.4 + Math.random() * 0.5
  });
}

/* ---------- drawing ---------- */
function drawGround() {
  ctx.strokeStyle = '#4b4b57';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y + 2);
  ctx.lineTo(W, GROUND_Y + 2);
  ctx.stroke();

  ctx.fillStyle = '#9a9aa8';
  for (let i = 0; i < 40; i++) {
    const x = ((i * 97 - state.ground) % (W + 100) + W + 100) % (W + 100) - 50;
    const y = GROUND_Y + 14 + (i % 3) * 12;
    ctx.fillRect(x, y, 12 + (i % 4) * 6, 3);
  }
}

function drawClouds() {
  ctx.fillStyle = 'rgba(120, 124, 145, 0.35)';
  state.clouds.forEach((c) => {
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, 42 * c.s, 15 * c.s, 0, 0, Math.PI * 2);
    ctx.ellipse(c.x + 26 * c.s, c.y - 8 * c.s, 28 * c.s, 13 * c.s, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawCactus(o) {
  ctx.fillStyle = '#3f9e52';
  const stemW = 16;
  ctx.fillRect(o.x, o.y, stemW, o.h);

  if (o.count > 1) {
    ctx.fillRect(o.x - 14, o.y + o.h * 0.32, 14, 10);
    ctx.fillRect(o.x - 14, o.y + o.h * 0.32, 10, o.h * 0.42);
  }
  if (o.count > 2) {
    ctx.fillRect(o.x + stemW, o.y + o.h * 0.2, 14, 10);
    ctx.fillRect(o.x + stemW + 4, o.y + o.h * 0.2, 10, o.h * 0.5);
  }
}

function drawBird(o) {
  const up = Math.floor(o.wing / 8) % 2 === 0;
  ctx.fillStyle = '#3a3a46';
  ctx.beginPath();
  ctx.ellipse(o.x + o.w / 2, o.y + o.h / 2, o.w / 2, o.h / 3.4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(o.x + 16, o.y + o.h / 2);
  ctx.lineTo(o.x + 40, up ? o.y - 6 : o.y + o.h + 6);
  ctx.lineTo(o.x + 52, o.y + o.h / 2);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(o.x, o.y + o.h / 2 - 3);
  ctx.lineTo(o.x - 12, o.y + o.h / 2);
  ctx.lineTo(o.x, o.y + o.h / 2 + 3);
  ctx.closePath();
  ctx.fill();
}

function drawRunner() {
  const bodyH = runner.ducking ? runner.bodyH * 0.55 : runner.bodyH;
  const headSize = runner.ducking ? runner.headSize * 0.86 : runner.headSize;
  const baseY = runner.y;
  const bodyY = baseY - bodyH;
  const step = Math.floor(state.frame / 6) % 2 === 0;

  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.beginPath();
  ctx.ellipse(runner.x, GROUND_Y + 6, 46, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = '#4a5b3b';

  // tail
  ctx.beginPath();
  ctx.moveTo(runner.x - runner.bodyW / 2, bodyY + bodyH * 0.35);
  ctx.lineTo(runner.x - runner.bodyW / 2 - 46, bodyY + bodyH * 0.05);
  ctx.lineTo(runner.x - runner.bodyW / 2 - 10, bodyY + bodyH * 0.75);
  ctx.closePath();
  ctx.fill();

  // torso
  ctx.beginPath();
  ctx.roundRect(runner.x - runner.bodyW / 2, bodyY, runner.bodyW, bodyH, 14);
  ctx.fill();

  // arm
  ctx.fillRect(runner.x + runner.bodyW / 2 - 6, bodyY + bodyH * 0.28, 20, 8);

  // legs
  if (runner.onGround) {
    ctx.fillRect(runner.x - 18, baseY - 4, 14, step ? 18 : 8);
    ctx.fillRect(runner.x + 6, baseY - 4, 14, step ? 8 : 18);
  } else {
    ctx.fillRect(runner.x - 18, baseY - 4, 14, 12);
    ctx.fillRect(runner.x + 6, baseY - 6, 14, 12);
  }

  // giant head
  const headY = bodyY - headSize * 0.78;
  if (headImg.complete && headImg.naturalWidth) {
    ctx.drawImage(headImg, runner.x - headSize / 2 + 12, headY, headSize, headSize * 0.92);
  } else {
    ctx.fillStyle = '#c98d6b';
    ctx.beginPath();
    ctx.ellipse(runner.x + 12, headY + headSize / 2, headSize / 2, headSize / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ---------- loop ---------- */
function update() {
  state.frame++;
  state.speed = Math.min(19, 8 + state.score / 240);
  state.ground += state.speed;
  state.score += state.speed / 7;

  if (--state.spawnIn <= 0) spawnObstacle();
  if (state.frame % 110 === 0) spawnCloud();

  // runner physics
  if (state.jumpHeld && runner.vy < 0 && runner.holdFrames < MAX_HOLD_FRAMES) {
    runner.vy += HOLD_LIFT;
    runner.holdFrames++;
  }
  runner.vy += GRAVITY;
  runner.y += runner.vy;

  if (runner.y >= GROUND_Y) {
    runner.y = GROUND_Y;
    runner.vy = 0;
    runner.onGround = true;
  } else {
    runner.onGround = false;
  }

  state.clouds.forEach((c) => { c.x -= state.speed * 0.25 * c.s; });
  state.clouds = state.clouds.filter((c) => c.x > -120);

  const box = runnerBox();

  state.obstacles.forEach((o) => {
    o.x -= state.speed + (o.type === 'bird' ? 2.5 : 0);
    if (o.type === 'bird') o.wing++;
    if (hit(box, o)) gameOver();
  });

  state.obstacles = state.obstacles.filter((o) => o.x > -140);

  if (Math.floor(state.score) > 0 && Math.floor(state.score) % 500 < state.speed / 7) {
    beep(880, 0.08, 'square', 0.03);
  }

  scoreEl.textContent = pad(state.score);
}

function render() {
  ctx.clearRect(0, 0, W, H);

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#f8f6ef');
  grad.addColorStop(1, '#e8e2d3');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  drawClouds();
  drawGround();
  state.obstacles.forEach((o) => (o.type === 'bird' ? drawBird(o) : drawCactus(o)));
  drawRunner();
}

function loop() {
  if (!state.running) return;
  update();
  render();
  requestAnimationFrame(loop);
}

/* ---------- game flow ---------- */
function reset() {
  state.obstacles = [];
  state.clouds = [];
  state.score = 0;
  state.speed = 8;
  state.frame = 0;
  state.ground = 0;
  state.spawnIn = 70;
  state.over = false;
  runner.y = GROUND_Y;
  runner.vy = 0;
  runner.ducking = false;
  runner.onGround = true;
  runner.holdFrames = 0;
  scoreEl.textContent = pad(0);
}

function start() {
  reset();
  startScreen.hidden = true;
  overScreen.hidden = true;
  state.running = true;
  beep(660, 0.09);
  requestAnimationFrame(loop);
}

function gameOver() {
  if (state.over) return;
  state.over = true;
  state.running = false;

  if (state.score > state.hi) {
    state.hi = state.score;
    localStorage.setItem(HI_KEY, String(Math.floor(state.hi)));
  }
  hiEl.textContent = pad(state.hi);

  overLine.textContent =
    `Score ${pad(state.score)} · best ${pad(state.hi)}`;
  overScreen.hidden = false;

  beep(220, 0.18, 'sawtooth', 0.06);
  setTimeout(() => beep(140, 0.28, 'sawtooth', 0.06), 130);
  render();
}

function jump() {
  if (!state.running) {
    if (!overScreen.hidden || !startScreen.hidden) start();
    return;
  }
  if (runner.onGround) {
    runner.vy = JUMP_V;
    runner.onGround = false;
    runner.holdFrames = 0;
    state.jumpHeld = true;
    beep(520, 0.07);
  }
}

function setDuck(on) {
  runner.ducking = on;
  if (on && !runner.onGround) runner.vy += 3.2;
}

/* ---------- input ---------- */
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault();
    jump();
  } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
    e.preventDefault();
    setDuck(true);
  }
});

document.addEventListener('keyup', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    state.jumpHeld = false;
  } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
    setDuck(false);
  }
});

canvas.addEventListener('pointerdown', () => jump());
document.addEventListener('pointerup', () => { state.jumpHeld = false; });

startBtn.addEventListener('click', (e) => { e.stopPropagation(); start(); });
retryBtn.addEventListener('click', (e) => { e.stopPropagation(); start(); });

soundBtn.addEventListener('click', () => {
  state.sound = !state.sound;
  soundBtn.textContent = state.sound ? '🔊 Sound: On' : '🔇 Sound: Off';
  soundBtn.setAttribute('aria-pressed', String(state.sound));
});

hiEl.textContent = pad(state.hi);
headImg.onload = render;
render();
