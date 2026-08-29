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
const turnValueEl = document.getElementById('turnValue');
const statusPanel = document.getElementById('statusPanel');
const statusTitle = document.getElementById('statusTitle');
const statusSub = document.getElementById('statusSub');
const resetBtn = document.getElementById('resetBtn');
const soundBtn = document.getElementById('soundBtn');
const swapBtn = document.getElementById('swapBtn');
const howBtn = document.getElementById('howBtn');
const modal = document.getElementById('modal');
const closeModal = document.getElementById('closeModal');

const state = {
  cells: Array(9).fill(''),
  turn: 'X',
  starter: 'X',
  over: false,
  scores: { X: 0, O: 0, draws: 0 },
  sound: true
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

/* ---------- game logic ---------- */
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
  if (state.over || state.cells[index]) return;
  mark(index, state.turn);
  beep(state.turn === 'X' ? 520 : 380);

  const result = winnerOf(state.cells);
  if (result) return finish(result);

  state.turn = state.turn === 'X' ? 'O' : 'X';
  updateStatus();
}

function mark(index, player) {
  state.cells[index] = player;
  const cell = cellEls[index];
  cell.classList.add('taken', 'filled', player.toLowerCase());
  cell.querySelector('span').textContent = player === 'X' ? '✕' : '◯';
  cell.disabled = true;
}

function finish(result) {
  state.over = true;
  if (result.player === 'draw') {
    state.scores.draws++;
    scoreDrawEl.textContent = state.scores.draws;
    statusPanel.className = 'panel panel-status draw';
    statusTitle.textContent = 'Draw!';
    statusSub.textContent = 'Forehead survives 😐';
    beep(300, 0.25, 'sine');
  } else {
    state.scores[result.player]++;
    scoreXEl.textContent = state.scores.X;
    scoreOEl.textContent = state.scores.O;
    drawWinLine(result.line);
    if (result.player === 'X') {
      statusPanel.className = 'panel panel-status win';
      statusTitle.textContent = 'X wins!';
      statusSub.textContent = 'Forehead defeated 👑';
    } else {
      statusPanel.className = 'panel panel-status lose';
      statusTitle.textContent = 'O wins!';
      statusSub.textContent = 'Forehead conquered 👑';
    }
    fanfare([[523, 0], [659, 120], [784, 240], [1047, 360]]);
  }
  updateTurnLabel();
}

function drawWinLine(line) {
  const [x1, y1, x2, y2] = LINE_COORDS[line.join(',')];
  winPathEl.setAttribute('d', `M${x1} ${y1} L${x2} ${y2}`);
  winLineEl.classList.remove('show');
  void winLineEl.offsetWidth;
  winLineEl.classList.add('show');
}

function updateTurnLabel() {
  turnValueEl.textContent = state.over ? '—' : state.turn;
  turnValueEl.classList.toggle('o', state.turn === 'O');
}

function updateStatus() {
  updateTurnLabel();
  statusPanel.className = 'panel panel-status';
  if (state.turn === 'X') {
    statusTitle.textContent = 'Player 1';
    statusSub.textContent = 'X — tap the forehead 👆';
  } else {
    statusTitle.textContent = 'Player 2';
    statusSub.textContent = 'O — pass it over 🤝';
  }
}

/* ---------- controls ---------- */
function reset() {
  state.cells = Array(9).fill('');
  state.turn = state.starter;
  state.over = false;
  winLineEl.classList.remove('show');
  winPathEl.setAttribute('d', '');
  cellEls.forEach((cell) => {
    cell.className = 'cell';
    cell.disabled = false;
    cell.querySelector('span').textContent = '';
  });
  updateStatus();
  beep(660, 0.08, 'sine');
}

resetBtn.addEventListener('click', reset);

soundBtn.addEventListener('click', () => {
  state.sound = !state.sound;
  soundBtn.textContent = state.sound ? '🔊 Sound: On' : '🔇 Sound: Off';
  soundBtn.setAttribute('aria-pressed', String(state.sound));
  if (state.sound) beep(700, 0.1);
});

swapBtn.addEventListener('click', () => {
  state.starter = state.starter === 'X' ? 'O' : 'X';
  swapBtn.textContent = `🔁 Starts: ${state.starter === 'X' ? 'Player 1 (X)' : 'Player 2 (O)'}`;
  reset();
});

howBtn.addEventListener('click', () => { modal.hidden = false; });
closeModal.addEventListener('click', () => { modal.hidden = true; });
modal.addEventListener('click', (e) => { if (e.target === modal) modal.hidden = true; });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') modal.hidden = true; });

updateStatus();
