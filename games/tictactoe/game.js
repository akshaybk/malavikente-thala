const ROUNDS_PER_MATCH = 5;

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

// Endpoints for the winning stroke, in the board's 300x300 svg space.
const LINE_COORDS = {
  '0,1,2': [12, 50, 288, 50],
  '3,4,5': [12, 150, 288, 150],
  '6,7,8': [12, 250, 288, 250],
  '0,3,6': [52, 12, 52, 288],
  '1,4,7': [150, 12, 150, 288],
  '2,5,8': [248, 12, 248, 288],
  '0,4,8': [20, 20, 280, 280],
  '2,4,6': [280, 20, 20, 280]
};

const boardEl = document.getElementById('board');
const winLineEl = document.getElementById('winLine');
const winPathEl = document.getElementById('winPath');
const scoreXEl = document.getElementById('scoreX');
const scoreOEl = document.getElementById('scoreO');
const scoreDrawEl = document.getElementById('scoreDraws');
const labelXEl = document.getElementById('labelX');
const labelOEl = document.getElementById('labelO');
const roundEl = document.getElementById('roundValue');
const turnValueEl = document.getElementById('turnValue');
const statusPanel = document.getElementById('statusPanel');
const statusTitle = document.getElementById('statusTitle');
const statusSub = document.getElementById('statusSub');
const resetBtn = document.getElementById('resetBtn');
const soundBtn = document.getElementById('soundBtn');
const menuBtn = document.getElementById('menuBtn');
const howBtn = document.getElementById('howBtn');
const modal = document.getElementById('modal');
const closeModal = document.getElementById('closeModal');
const menuScreen = document.getElementById('menuScreen');
const playPvcBtn = document.getElementById('playPvc');
const playPvpBtn = document.getElementById('playPvp');
const matchScreen = document.getElementById('matchScreen');
const matchTitle = document.getElementById('matchTitle');
const matchSub = document.getElementById('matchSub');
const matchLine = document.getElementById('matchLine');
const rematchBtn = document.getElementById('rematchBtn');
const backToMenuBtn = document.getElementById('backToMenuBtn');

const state = {
  mode: null,          // 'pvc' | 'pvp'
  cells: Array(9).fill(''),
  turn: 'X',
  starter: 'X',
  round: 1,
  roundOver: false,
  matchOver: false,
  locked: false,
  scores: { X: 0, O: 0, draws: 0 },
  sound: true
};

let roundTimer = null;

const nameOf = (player) => {
  if (player === 'X') return 'Player 1';
  return state.mode === 'pvc' ? 'Forehead' : 'Player 2';
};

const cellEls = [];
for (let i = 0; i < 9; i++) {
  const btn = document.createElement('button');
  btn.className = 'cell';
  btn.type = 'button';
  btn.dataset.index = String(i);
  btn.setAttribute('aria-label', `Square ${i + 1}`);
  btn.appendChild(document.createElement('span'));
  btn.addEventListener('click', () => play(i));
  boardEl.appendChild(btn);
  cellEls.push(btn);
}

/* ---------- sound ---------- */
let audioCtx = null;
function beep(freq, duration = 0.12, type = 'triangle', gain = 0.06) {
  if (!state.sound) return;
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const amp = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  amp.gain.setValueAtTime(gain, audioCtx.currentTime);
  amp.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
  osc.connect(amp).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}
const fanfare = (notes) => notes.forEach(([f, t]) => setTimeout(() => beep(f, 0.18, 'square', 0.05), t));

/* ---------- match flow ---------- */
function startMatch(mode) {
  state.mode = mode;
  state.round = 1;
  state.starter = 'X';
  state.matchOver = false;
  state.scores = { X: 0, O: 0, draws: 0 };
  labelXEl.textContent = 'Player 1 (X)';
  labelOEl.textContent = mode === 'pvc' ? 'Forehead (O)' : 'Player 2 (O)';
  renderScores();
  menuScreen.hidden = true;
  matchScreen.hidden = true;
  startRound();
}

function startRound() {
  clearTimeout(roundTimer);
  state.cells = Array(9).fill('');
  state.turn = state.starter;
  state.roundOver = false;
  state.locked = false;
  winLineEl.classList.remove('show');
  winPathEl.setAttribute('d', '');
  cellEls.forEach((cell) => {
    cell.className = 'cell';
    cell.disabled = false;
    cell.querySelector('span').textContent = '';
  });
  roundEl.textContent = `${state.round}/${ROUNDS_PER_MATCH}`;
  updateStatus();
  maybeAiMove();
}

function endRound(result) {
  state.roundOver = true;
  if (result.player === 'draw') {
    state.scores.draws++;
    statusPanel.className = 'panel panel-status draw';
    statusTitle.textContent = 'Draw!';
    statusSub.textContent = 'Forehead survives 😐';
    beep(300, 0.25, 'sine');
  } else {
    state.scores[result.player]++;
    drawWinLine(result.line);
    statusPanel.className = `panel panel-status ${result.player === 'X' ? 'win' : 'lose'}`;
    statusTitle.textContent = `${nameOf(result.player)} wins!`;
    statusSub.textContent = `Round ${state.round} of ${ROUNDS_PER_MATCH} 👑`;
    fanfare([[523, 0], [659, 120], [784, 240], [1047, 360]]);
  }
  renderScores();
  updateTurnLabel();

  if (state.round >= ROUNDS_PER_MATCH) {
    roundTimer = setTimeout(endMatch, 1800);
  } else {
    roundTimer = setTimeout(() => {
      state.round++;
      state.starter = state.starter === 'X' ? 'O' : 'X';
      startRound();
    }, 1800);
  }
}

function endMatch() {
  state.matchOver = true;
  const { X, O } = state.scores;
  if (X === O) {
    matchTitle.textContent = 'Match drawn!';
    matchTitle.className = 'match-title draw';
    matchSub.textContent = 'Nobody claims the forehead 😐';
  } else {
    const champ = X > O ? 'X' : 'O';
    matchTitle.textContent = `${nameOf(champ)} takes the match!`;
    matchTitle.className = `match-title ${champ === 'X' ? 'win' : 'lose'}`;
    matchSub.textContent = champ === 'X' ? 'Forehead defeated 👑' : (state.mode === 'pvc' ? 'The forehead reigns 😤' : 'Forehead conquered 👑');
    fanfare([[523, 0], [659, 130], [784, 260], [1047, 390], [1319, 520]]);
  }
  matchLine.textContent = `${state.scores.X} — ${state.scores.O}  ·  ${state.scores.draws} draw${state.scores.draws === 1 ? '' : 's'} over ${ROUNDS_PER_MATCH} rounds`;
  matchScreen.hidden = false;
}

function backToMenu() {
  clearTimeout(roundTimer);
  state.mode = null;
  state.matchOver = false;
  state.scores = { X: 0, O: 0, draws: 0 };
  state.round = 1;
  state.starter = 'X';
  renderScores();
  roundEl.textContent = `1/${ROUNDS_PER_MATCH}`;
  startRoundVisualsForMenu();
  matchScreen.hidden = true;
  menuScreen.hidden = false;
}

function startRoundVisualsForMenu() {
  state.cells = Array(9).fill('');
  state.roundOver = true;
  winLineEl.classList.remove('show');
  cellEls.forEach((cell) => {
    cell.className = 'cell';
    cell.disabled = true;
    cell.querySelector('span').textContent = '';
  });
  statusPanel.className = 'panel panel-status';
  statusTitle.textContent = 'Pick a mode';
  statusSub.textContent = 'Best of 5 rounds 🏆';
  turnValueEl.textContent = '—';
}

/* ---------- round logic ---------- */
function winnerOf(cells) {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) {
      return { player: cells[a], line };
    }
  }
  return cells.every(Boolean) ? { player: 'draw', line: null } : null;
}

function play(index) {
  if (!state.mode || state.roundOver || state.locked || state.cells[index]) return;
  mark(index, state.turn);
  beep(state.turn === 'X' ? 520 : 380);

  const result = winnerOf(state.cells);
  if (result) return endRound(result);

  state.turn = state.turn === 'X' ? 'O' : 'X';
  updateStatus();
  maybeAiMove();
}

function mark(index, player) {
  state.cells[index] = player;
  const cell = cellEls[index];
  cell.classList.add('taken', 'filled', player.toLowerCase());
  cell.querySelector('span').textContent = player === 'X' ? '✕' : '◯';
  cell.disabled = true;
}

function drawWinLine(line) {
  const [x1, y1, x2, y2] = LINE_COORDS[line.join(',')];
  winPathEl.setAttribute('d', `M${x1} ${y1} L${x2} ${y2}`);
  winLineEl.classList.remove('show');
  void winLineEl.offsetWidth;
  winLineEl.classList.add('show');
}

function renderScores() {
  scoreXEl.textContent = state.scores.X;
  scoreOEl.textContent = state.scores.O;
  scoreDrawEl.textContent = state.scores.draws;
}

function updateTurnLabel() {
  turnValueEl.textContent = state.roundOver || !state.mode ? '—' : state.turn;
  turnValueEl.classList.toggle('o', state.turn === 'O');
}

function updateStatus() {
  updateTurnLabel();
  statusPanel.className = 'panel panel-status';
  if (state.turn === 'X') {
    statusTitle.textContent = 'Player 1';
    statusSub.textContent = 'X — tap the forehead 👆';
  } else if (state.mode === 'pvc') {
    statusTitle.textContent = 'Thinking…';
    statusSub.textContent = 'Forehead plots 🧠';
  } else {
    statusTitle.textContent = 'Player 2';
    statusSub.textContent = 'O — pass it over 🤝';
  }
}

/* ---------- computer opponent: minimax with an occasional slip ---------- */
function maybeAiMove() {
  if (state.mode !== 'pvc' || state.turn !== 'O' || state.roundOver) return;
  state.locked = true;
  setTimeout(() => {
    state.locked = false;
    const move = chooseAiMove();
    if (move !== -1 && !state.roundOver) play(move);
  }, 480);
}

function chooseAiMove() {
  const free = state.cells.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  if (!free.length) return -1;
  if (Math.random() < 0.25) return free[Math.floor(Math.random() * free.length)];

  let bestScore = -Infinity;
  let best = free[0];
  for (const i of free) {
    state.cells[i] = 'O';
    const score = minimax(state.cells, false, 0);
    state.cells[i] = '';
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

function minimax(cells, maximizing, depth) {
  const result = winnerOf(cells);
  if (result) {
    if (result.player === 'O') return 10 - depth;
    if (result.player === 'X') return depth - 10;
    return 0;
  }
  let best = maximizing ? -Infinity : Infinity;
  for (let i = 0; i < 9; i++) {
    if (cells[i]) continue;
    cells[i] = maximizing ? 'O' : 'X';
    const score = minimax(cells, !maximizing, depth + 1);
    cells[i] = '';
    best = maximizing ? Math.max(best, score) : Math.min(best, score);
  }
  return best;
}

/* ---------- controls ---------- */
playPvcBtn.addEventListener('click', () => startMatch('pvc'));
playPvpBtn.addEventListener('click', () => startMatch('pvp'));
rematchBtn.addEventListener('click', () => startMatch(state.mode));
backToMenuBtn.addEventListener('click', backToMenu);
menuBtn.addEventListener('click', backToMenu);

resetBtn.addEventListener('click', () => {
  if (!state.mode || state.matchOver) return;
  beep(660, 0.08, 'sine');
  startRound();
});

soundBtn.addEventListener('click', () => {
  state.sound = !state.sound;
  soundBtn.textContent = state.sound ? '🔊 Sound: On' : '🔇 Sound: Off';
  soundBtn.setAttribute('aria-pressed', String(state.sound));
  if (state.sound) beep(700, 0.1);
});

howBtn.addEventListener('click', () => { modal.hidden = false; });
closeModal.addEventListener('click', () => { modal.hidden = true; });
modal.addEventListener('click', (e) => { if (e.target === modal) modal.hidden = true; });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') modal.hidden = true; });

backToMenu();
