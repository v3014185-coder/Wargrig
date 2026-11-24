/* =========================================================
   WarGrid — Vanilla JS
   Инициализация гарантированно после DOMContentLoaded.
   Механика (баланс, таймер, урон) не изменена.
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  // Запускаем всё только после готовности DOM
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

let currentScreenId = null;

/**
 * Показывает экран по id и скрывает остальные.
 * Добавляет/убирает класс .hidden и управляет плавностью.
 */
function show(screenId) {
  const target = document.getElementById(screenId);
  if (!target) {
    console.error(`Ошибка переключения экранов: элемент #${screenId} не найден.`);
    return;
  }

  const allScreens = document.querySelectorAll('.screen');
  allScreens.forEach((scr) => {
    if (scr === target) {
      // Показываем: убираем hidden, затем даём браузеру применить opacity
      scr.classList.remove('hidden');
      // форсируем reflow для корректной анимации появления
      void scr.offsetWidth;
      scr.style.opacity = '1';
    } else {
      // Скрываем: плавно гасим, затем display:none через .hidden
      scr.style.opacity = '0';
      scr.classList.add('hidden');
    }
  });

  currentScreenId = screenId;
}

function initScreens() {
  // По умолчанию видимо меню; остальные имеют .hidden в HTML.
  // Подстрахуемся: если у меню случайно есть hidden — уберём.
  const menu = document.getElementById('screen-menu');
  if (menu) menu.classList.remove('hidden');
}

/* ---------------------------------------------------------
   КНОПКИ МЕНЮ (с защитой от отсутствия элементов)
   --------------------------------------------------------- */

function initMenuButtons() {
  // Безопасное навешивание обработчика
  const bind = (id, handler) => {
    const el = document.getElementById(id);
    if (!el) {
      console.error(`Ошибка инициализации кнопок: элемент #${id} не найден.`);
      return;
    }
    el.addEventListener('click', handler);
  };

  bind('btnPlay', () => {
    show('screen-game');
    startGameLoopIfNeeded();
  });

  bind('btnHelp', () => {
    show('screen-help');
  });

  bind('btnBack', () => {
    show('screen-menu');
  });

  // Кнопка «В меню» внутри игры (если есть)
  bind('btnToMenu', () => {
    show('screen-menu');
  });
}

/* ---------------------------------------------------------
   ИГРОВАЯ ЛОГИКА (механика сохранена)
   --------------------------------------------------------- */

const CONFIG = {
  COLS: 14,
  ROWS: 10,
  TICK_MS: 1000,
  GOLD_PER_CELL: 5,
  WAR_TIMER_TICKS: 3,
  // Стоимость/урон оставлены как в исходной механике
  ATTACK_COST: 10,
  ATTACK_DAMAGE: 1,
};

const state = {
  gold: 0,
  tick: 0,
  warTimer: 0,
  cells: [],          // { owner: 'neutral'|'player'|'enemy', hp: number }
  selected: null,     // индекс выбранной клетки игрока
  loopStarted: false,
  intervalId: null,
};

const gridEl = () => document.getElementById('grid');
const hudGoldEl = () => document.getElementById('hudGold');
const hudTickEl = () => document.getElementById('hudTick');
const hudWarEl = () => document.getElementById('hudWarTimer');

function initGame() {
  buildGrid();
  seedInitialCells();
  renderHud();

  // Привязка клика по сетке через делегирование
  const grid = gridEl();
  if (!grid) {
    console.error('Ошибка инициализации: элемент #grid не найден.');
    return;
  }
  grid.addEventListener('click', onGridClick);
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
    cell.setAttribute('role', 'gridcell');
    grid.appendChild(cell);
  }
}

function seedInitialCells() {
  // Стартовые позиции: игрок — левый нижний угол, враг — правый верхний
  const playerStart = indexOf(0, CONFIG.ROWS - 1); // нижний левый
  const enemyStart  = indexOf(CONFIG.COLS - 1, 0);  // верхний правый

  if (playerStart >= 0) state.cells[playerStart].owner = 'player';
  if (enemyStart >= 0)  state.cells[enemyStart].owner  = 'enemy';

  // Начальное золото — как в исходной логике
  state.gold = 0;
  state.tick = 0;
  state.warTimer = 0;

  renderCells();
}

function indexOf(col, row) {
  if (col < 0 || col >= CONFIG.COLS || row < 0 || row >= CONFIG.ROWS) return -1;
  return row * CONFIG.COLS + col;
}

function coordsOf(index) {
  return { col: index % CONFIG.COLS, row: Math.floor(index / CONFIG.COLS) };
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
  const g = hudGoldEl();
  const t = hudTickEl();
  const w = hudWarEl();
  if (g) g.textContent = String(state.gold);
  if (t) t.textContent = String(state.tick);
  if (w) w.textContent = String(state.warTimer);
}

/* ---------------------------------------------------------
   КЛИК ПО СЕТКЕ
   --------------------------------------------------------- */

function onGridClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (!target.classList.contains('cell')) return;

  const idx = Number(target.dataset.index);
  if (!Number.isInteger(idx) || idx < 0 || idx >= state.cells.length) return;

  const cell = state.cells[idx];

  // Клик по своей клетке — выделяем
  if (cell.owner === 'player') {
    state.selected = state.selected === idx ? null : idx;
    renderCells();
    return;
  }

  // Атака возможна только если выбрана своя клетка и таймер готов
  if (state.selected === null) return;

  if (state.warTimer > 0) {
    // Таймер «Оправдание войны» ещё идёт
    return;
  }

  if (state.gold < CONFIG.ATTACK_COST) return;

  // Списываем стоимость и наносим урон (формула сохранена)
  state.gold -= CONFIG.ATTACK_COST;
  cell.hp -= CONFIG.ATTACK_DAMAGE;

  if (cell.hp <= 0) {
    // Захват клетки
    cell.owner = 'player';
    cell.hp = 1;
    // Включаем таймер «Оправдание войны» после захвата
    state.warTimer = CONFIG.WAR_TIMER_TICKS;
  }

  state.selected = null;
  renderCells();
  renderHud();
}

/* ---------------------------------------------------------
   ИГРОВОЙ ЦИКЛ (экономика + таймер)
   --------------------------------------------------------- */

function startGameLoopIfNeeded() {
  if (state.loopStarted) return;
  state.loopStarted = true;

  state.intervalId = setInterval(() => {
    state.tick += 1;

    // Экономика: золото за тик за каждую свою клетку
    let owned = 0;
    for (const c of state.cells) if (c.owner === 'player') owned += 1;
    state.gold += owned * CONFIG.GOLD_PER_CELL;

    // Уменьшаем таймер «Оправдание войны»
    if (state.warTimer > 0) state.warTimer -= 1;

    renderHud();
  }, CONFIG.TICK_MS);
}
