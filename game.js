/* =========================================================
   WarGrid — Логика HOI4 + TERRON
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  try {
    initScreens();
    initButtons();
    initGameField();
  } catch (e) {
    console.error("Ошибка инициализации: ", e);
  }
});

function show(screenId) {
  const target = document.getElementById(screenId);
  if (!target) {
    console.error(`Элемент #${screenId} не найден`);
    return;
  }
  
  document.querySelectorAll('.screen').forEach(scr => {
    if (scr === target) {
      scr.classList.remove('hidden');
      void scr.offsetWidth;
      scr.style.opacity = '1';
    } else {
      scr.style.opacity = '0';
      scr.classList.add('hidden');
    }
  });
}

function initScreens() {
  const menu = document.getElementById('screen-menu');
  if (menu) menu.classList.remove('hidden');
}

function initButtons() {
  // Защищенная привязка кнопок
  const bind = (id, action) => {
    const btn = document.getElementById(id);
    if (!btn) {
      console.error(`Кнопка #${id} не найдена`);
      return;
    }
    btn.addEventListener('click', action);
  };

  // Кнопки переходов
  bind('btnEnterGame', () => { show('screen-game'); startGameLoop(); });
  bind('btnHelp', () => show('screen-help'));
  bind('btnBack', () => show('screen-menu'));
  bind('btnExit', () => show('screen-menu'));
}

/* --- ИГРОВАЯ МЕХАНИКА --- */
const CONFIG = {
  COLS: 14,
  ROWS: 10,
  TICK_MS: 1000,
  GOLD_PER_CELL: 5,
  WAR_TIMER_TICKS: 3,
  ATTACK_COST: 10,
  ATTACK_DAMAGE: 1,
};

const state = {
  gold: 0,
  tick: 0,
  warTimer: 0,
  cells: [],
  selected: null,
  loopStarted: false,
};

const gridEl = () => document.getElementById('grid');
const hudGold = () => document.getElementById('hudGold');
const hudTick = () => document.getElementById('hudTick');
const hudWar = () => document.getElementById('hudWarTimer');

function initGameField() {
  buildGrid();
  seedInitialCells();
  updateHud();
  
  const grid = gridEl();
  if (grid) grid.addEventListener('click', onGridClick);
}

function buildGrid() {
  const grid = gridEl();
  if (!grid) return;
  grid.innerHTML = '';
  state.cells = [];

  const total = CONFIG.COLS * CONFIG.ROWS;
  for (let i = 0; i < total; i++) {
    state.cells.push({ owner: 'neutral', hp: 1 });
    const cell = document.createElement('div');
    cell.className = 'cell neutral';
    cell.dataset.index = String(i);
    grid.appendChild(cell);
  }
}

function seedInitialCells() {
  const playerStart = indexOf(0, CONFIG.ROWS - 1);
  const enemyStart  = indexOf(CONFIG.COLS - 1, 0);

  if (playerStart >= 0) state.cells[playerStart].owner = 'player';
  if (enemyStart >= 0)  state.cells[enemyStart].owner  = 'enemy';

  state.gold = 0;
  state.tick = 0;
  state.warTimer = 0;

  renderCells();
}

function indexOf(col, row) {
  if (col < 0 || col >= CONFIG.COLS || row < 0 || row >= CONFIG.ROWS) return -1;
  return row * CONFIG.COLS + col;
}

function renderCells() {
  const grid = gridEl();
  if (!grid) return;
  const nodes = grid.children;
  for (let i = 0; i < state.cells.length; i++) {
    const node = nodes[i];
    if (!node) continue;
    const { owner } = state.cells[i];
    node.className = 'cell ' + owner; // Сбрасываем и ставим нужный класс
    if (state.selected === i) node.classList.add('selected');
  }
}

function updateHud() {
  if (hudGold()) hudGold().textContent = String(state.gold);
  if (hudTick()) hudTick().textContent = String(state.tick);
  if (hudWar())  hudWar().textContent  = String(state.warTimer);
}

function onGridClick(e) {
  const target = e.target;
  if (!target.classList.contains('cell')) return;

  const idx = Number(target.dataset.index);
  const cell = state.cells[idx];
  if (!cell) return;

  // Выбор своей клетки
  if (cell.owner === 'player') {
    state.selected = state.selected === idx ? null : idx;
    renderCells();
    return;
  }

  // Атака
  if (state.selected === null || state.warTimer > 0 || state.gold < CONFIG.ATTACK_COST) return;

  state.gold -= CONFIG.ATTACK_COST;
  cell.hp -= CONFIG.ATTACK_DAMAGE;

  if (cell.hp <= 0) {
    cell.owner = 'player';
    cell.hp = 1;
    state.warTimer = CONFIG.WAR_TIMER_TICKS;
  }

  state.selected = null;
  renderCells();
  updateHud();
}

function startGameLoop() {
  if (state.loopStarted) return;
  state.loopStarted = true;

  setInterval(() => {
    state.tick += 1;
    let owned = 0;
    for (const c of state.cells) if (c.owner === 'player') owned += 1;
    
    // Формула экономики
    state.gold += owned * CONFIG.GOLD_PER_CELL;
    
    // Тик таймера
    if (state.warTimer > 0) state.warTimer -= 1;
    
    updateHud();
  }, CONFIG.TICK_MS);
}
