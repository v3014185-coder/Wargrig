/* =========================================================
   WarGrid — Стратегия в реальном времени (RTS)
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  try {
    initScreens();
    initButtons();
    initGame();
  } catch (e) {
    console.error("Ошибка инициализации: ", e);
  }
});

function show(screenId) {
  const target = document.getElementById(screenId);
  if (!target) return;
  
  document.querySelectorAll('.screen').forEach(scr => {
    if (scr === target) {
      scr.classList.remove('hidden');
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
  const bind = (id, action) => {
    const btn = document.getElementById(id);
    if (!btn) return console.error(`Кнопка #${id} не найдена`);
    btn.addEventListener('click', action);
  };

  bind('btnEnterGame', () => { show('screen-game'); restartGame(); });
  bind('btnHelp', () => show('screen-help'));
  bind('btnBack', () => show('screen-menu'));
  bind('btnExit', () => show('screen-menu'));
  
  bind('btnBuyInfantry', () => {
    if (state.gold >= 20) {
      state.gold -= 20;
      // Спавн 5-10 юнитов на базе
      const count = Math.floor(Math.random() * 6) + 5;
      state.units.push({
        id: Date.now(),
        owner: 'player',
        x: state.playerBase.x,
        y: state.playerBase.y,
        targetX: null,
        targetY: null
      });
      updateHUD();
      setStatus(`Прибыло подкрепление: ${count} чел.`);
    } else {
      setStatus("Недостаточно золота!");
    }
  });
}

/* --- КОНФИГУРАЦИЯ --- */
const CONFIG = {
  COLS: 14,
  ROWS: 10,
  TICK_RATE: 1000, // 1 секунда на тик
  GOLD_INCOME: 2,
  UNIT_COST: 20,
};

/* --- СОСТОЯНИЕ ИГРЫ --- */
const state = {
  gold: 0,
  tick: 0,
  playerBase: { x: 1, y: 8 },
  enemyBase: { x: 12, y: 1 },
  cells: [],
  units: [],
  selectedTarget: null,
  isGameOver: false,
};

let gameLoopInterval = null;

function restartGame() {
  state.gold = 50;
  state.tick = 0;
  state.units = [];
  state.cells = [];
  state.selectedTarget = null;
  state.isGameOver = false;
  
  buildMap();
  startLoop();
  updateHUD();
  setStatus("Бой начался. Покупайте пехоту!");
}

/* --- КАРТА И РЕНДЕР --- */
function buildMap() {
  const grid = document.getElementById('grid');
  if (!grid) return;
  grid.innerHTML = '';
  
  for (let y = 0; y < CONFIG.ROWS; y++) {
    for (let x = 0; x < CONFIG.COLS; x++) {
      const cell = document.createElement('div');
      cell.className = 'cell neutral';
      cell.dataset.x = x;
      cell.dataset.y = y;
      
      // Начальные базы
      if (x === state.playerBase.x && y === state.playerBase.y) {
        cell.classList.add('player');
      } else if (x === state.enemyBase.x && y === state.enemyBase.y) {
        cell.classList.add('enemy');
      }
      
      cell.addEventListener('click', () => handleCellClick(x, y));
      grid.appendChild(cell);
    }
  }
}

/* --- ЛОГИКА КЛИКОВ --- */
function handleCellClick(x, y) {
  if (state.isGameOver) return;
  
  // Если кликнули по своей клетке, то назначаем цель для ВСЕХ своих юнитов
  state.selectedTarget = { x, y };
  setStatus(`Приказ: двигаться в квадрат [${x}, ${y}]`);
  
  // Отправляем всех свободных юнитов к цели
  state.units.forEach(u => {
    if (u.owner === 'player' && !u.moving) {
      u.targetX = x;
      u.targetY = y;
      u.moving = true;
    }
  });
  
  // Подсветка цели
  document.querySelectorAll('.cell').forEach(c => c.classList.remove('target'));
  const targetCell = getCellElement(x, y);
  if (targetCell) targetCell.classList.add('target');
}

/* --- ИГРОВОЙ ЦИКЛ --- */
function startLoop() {
  if (gameLoopInterval) clearInterval(gameLoopInterval);
  
  gameLoopInterval = setInterval(() => {
    if (state.isGameOver) return;
    state.tick++;
    
    // 1. Экономика (доход от клеток)
    let playerTerritory = document.querySelectorAll('.cell.player').length;
    let enemyTerritory = document.querySelectorAll('.cell.enemy').length;
    state.gold += playerTerritory * CONFIG.GOLD_INCOME;
    
    // 2. Логика Бота (Враг)
    enemyAI(enemyTerritory);
    
    // 3. Движение и бой юнитов
    updateUnits();
    
    // 4. Обновление интерфейса
    updateHUD();
    
  }, CONFIG.TICK_RATE);
}

/* --- ИСКУССТВЕННЫЙ ИНТЕЛЛЕКТ ВРАГА --- */
function enemyAI(enemyTerritory) {
  // Бот покупает юнитов, если у него много территории
  if (enemyTerritory > 3 && Math.random() > 0.7) {
    state.units.push({
      id: Date.now() + Math.random(),
      owner: 'enemy',
      x: state.enemyBase.x,
      y: state.enemyBase.y,
      targetX: null,
      targetY: null,
      moving: false
    });
  }
  
  // Бот отправляет свободных юнитов захватывать нейтральные клетки или атаковать базу игрока
  state.units.forEach(u => {
    if (u.owner === 'enemy' && !u.moving && Math.random() > 0.8) {
      // Ищем случайную нейтральную клетку или базу игрока
      const isAttack = Math.random() > 0.6; // 40% шанс атаковать игрока
      let targetX, targetY;
      
      if (isAttack) {
        targetX = state.playerBase.x;
        targetY = state.playerBase.y;
      } else {
        targetX = Math.floor(Math.random() * CONFIG.COLS);
        targetY = Math.floor(Math.random() * CONFIG.ROWS);
      }
      
      u.targetX = targetX;
      u.targetY = targetY;
      u.moving = true;
    }
  });
}

/* --- ДВИЖЕНИЕ И БОЙ --- */
function updateUnits() {
  // Очищаем все юниты с карты перед перерисовкой
  document.querySelectorAll('.unit-dot').forEach(el => el.remove());
  
  // Клетки для обработки боя
  const combatMap = {};

  state.units.forEach(unit => {
    // Если у юнита есть цель и он не на месте
    if (unit.moving && (unit.x !== unit.targetX || unit.y !== unit.targetY)) {
      // Шаг к цели (по X, затем по Y)
      if (unit.x < unit.targetX) unit.x++;
      else if (unit.x > unit.targetX) unit.x--;
      else if (unit.y < unit.targetY) unit.y++;
      else if (unit.y > unit.targetY) unit.y--;
      
      // Захват территории на пути
      const cellEl = getCellElement(unit.x, unit.y);
      if (cellEl && !cellEl.classList.contains(unit.owner)) {
         // Захватываем только нейтральные или вражеские
         cellEl.className = `cell ${unit.owner}`;
      }
    }
    
    // Проверка на прибытие
    if (unit.x === unit.targetX && unit.y === unit.targetY) {
      unit.moving = false;
      unit.targetX = null;
      unit.targetY = null;
    }

    // Отрисовка юнита на карте
    const cellEl = getCellElement(unit.x, unit.y);
    if (cellEl) {
      const unitEl = document.createElement('div');
      unitEl.className = `unit-dot ${unit.owner}`;
      cellEl.appendChild(unitEl);
    }

    // Сбор данных для боя
    const key = `${unit.x},${unit.y}`;
    if (!combatMap[key]) combatMap[key] = { player: 0, enemy: 0 };
    combatMap[key][unit.owner]++;
  });

  // Разрешение боев
  for (const pos in combatMap) {
    const { player, enemy } = combatMap[pos];
    if (player > 0 && enemy > 0) {
      // Бой! Кто меньше, тот умирает
      const [x, y] = pos.split(',').map(Number);
      const survivors = Math.abs(player - enemy);
      const winner = player > enemy ? 'player' : 'enemy';
      
      // Удаляем всех в этой клетке
      state.units = state.units.filter(u => !(u.x === x && u.y === y));
      
      // Добовляем выживших
      for(let i=0; i<survivors; i++) {
          state.units.push({ id: Date.now()+i, owner: winner, x, y, moving: false });
      }
      
      // Захват клетки победителем
      const cellEl = getCellElement(x, y);
      if (cellEl) cellEl.className = `cell ${winner}`;
    }
  }
}

/* --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ --- */
function getCellElement(x, y) {
  return document.querySelector(`.cell[data-x="${x}"][data-y="${y}"]`);
}

function updateHUD() {
  const goldEl = document.getElementById('hudGold');
  const tickEl = document.getElementById('hudTick');
  const enemyGoldEl = document.getElementById('hudEnemyGold');
  const enemyUnitsEl = document.getElementById('hudEnemyUnits');
  
  if (goldEl) goldEl.textContent = Math.floor(state.gold);
  if (tickEl) tickEl.textContent = state.tick;
  
  // Считаем врагов
  const enemyUnitsCount = state.units.filter(u => u.owner === 'enemy').length;
  const enemyTerritory = document.querySelectorAll('.cell.enemy').length;
  
  if (enemyGoldEl) enemyGoldEl.textContent = enemyTerritory * 10; // Имитация
  if (enemyUnitsEl) enemyUnitsEl.textContent = enemyUnitsCount;
}

function setStatus(msg) {
  const el = document.getElementById('statusMessage');
  if (el) {
    el.textContent = msg;
    // Легкая анимация появления
    el.style.color = '#fff';
    setTimeout(() => el.style.color = '#aaa', 500);
  }
}
