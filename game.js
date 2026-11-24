/* =========================================================
   WarGrid — Vanilla JS (UI в стиле TERRON)
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  try {
    initScreens();
    initMenuButtons();
    initGame();
  } catch (err) {
    console.error('Ошибка инициализации: ', err);
  }
});

/* ---------------------------------------------------------
   ПЕРЕКЛЮЧЕНИЕ ЭКРАНОВ
   --------------------------------------------------------- */

function show(screenId) {
  const target = document.getElementById(screenId);
  if (!target) {
    console.error(`Ошибка переключения: элемент #${screenId} не найден.`);
    return;
  }

  const allScreens = document.querySelectorAll('.screen');
  allScreens.forEach((scr) => {
    if (scr === target) {
      scr.classList.remove('hidden');
      void scr.offsetWidth; // Форсируем reflow для анимации
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

/* ---------------------------------------------------------
   КНОПКИ (Защищенные обработчики)
   --------------------------------------------------------- */

function initMenuButtons() {
  const bind = (id, handler) => {
    const el = document.getElementById(id);
    if (!el) {
      console.error(`Ошибка инициализации кнопок: элемент #${id} не найден.`);
      return;
    }
    el.addEventListener('click', handler);
  };

  // Вход в игру (кнопка "ИГРАТЬ" в профиле)
  bind('btnPlay', () => {
    show('screen-game');
    startGameLoopIfNeeded();
  });

  // Вход в игру (кнопка "ВОЙТИ" в карточке карты)
  bind('btnEnterLobby', () => {
    show('screen-game');
    startGameLoopIfNeeded();
  });

  // Переход в правила
  bind('btnHelp', () => {
    show('screen-help');
  });

  // Из правил обратно в меню
  bind('btnBackToMenu', () => {
    show('screen-menu');
  });

  // Выход из игры в меню (Лобби)
  bind('btnExitGame', () => {
    show('screen-menu');
  });
}

/* ---------------------------------------------------------
   ИГРОВАЯ ЛОГИКА (Механика сохранена)
   --------------------------------------------------------- */

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
const hudGoldEl = () => document.getElementById('hudGold');
const hudTickEl = () => document.getElementById('hudTick');
const hudWarEl = () => document.getElementById('hudWarTimer');

function initGame() {
  buildGrid();
  seedInitialCells();
  renderHud();

  const grid = gridEl();
  if (grid) {
    grid.addEventListener('click', onGridClick);
  }
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
    node.classList.remove('neutral', 'player', 'enemy', 'selected');
    node.classList.add(owner);
    if (state.selected === i) node.classList.add('selected');
  }
}

function renderHud() {
  if (hudGoldEl()) hudGoldEl().textContent = String(state.gold);
  if (hudTickEl()) hudTickEl().textContent = String(state.tick);
  if (hudWarEl())  hudWarEl().textContent  = String(state.warTimer);
}

function onGridClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement) || !target.classList.contains('cell')) return;

  const idx = Number(target.dataset.index);
  if (!Number.isInteger(idx) || idx < 0 || idx >= state.cells.length) return;

  const cell = state.cells[idx];

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
  renderHud();
}

function startGameLoopIfNeeded() {
  if (state.loopStarted) return;
  state.loopStarted = true;

  setInterval(() => {
    state.tick += 1;
    let owned = 0;
    for (const c of state.cells) if (c.owner === 'player') owned += 1;
    state.gold += owned * CONFIG.GOLD_PER_CELL;
    if (state.warTimer > 0) state.warTimer -= 1;
    renderHud();
  }, CONFIG.TICK_MS);
}
