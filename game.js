/* =========================================================
   WarGrid — Логика RTS (Версия 6.0 — Финальная)
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
    if (scr === target) { scr.classList.remove('hidden'); scr.style.opacity = '1'; }
    else { scr.style.opacity = '0'; scr.classList.add('hidden'); }
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
  bind('btnCancelMenu', () => hideCellMenu());
  
  bind('btnBuyInfantry', () => {
    const cost = state.discountActive ? 16 : 20;
    if (state.gold >= cost) {
      state.gold -= cost;
      const squadSize = Math.floor(Math.random() * 6) + 5;
      state.units.push({
        id: Date.now() + Math.random(), owner: 'player',
        x: state.playerBase.x, y: state.playerBase.y,
        targetX: null, targetY: null, moving: false, strength: squadSize
      });
      updateHUD(); setStatus(`Прибыл отряд: ${squadSize} чел.`);
    } else {
      setStatus("Недостаточно золота!");
    }
  });

  bind('btnMoveTo', () => {
    if (state.selectedCell) {
      const {x, y} = state.selectedCell;
      state.units.forEach(u => {
        if (u.owner === 'player') {
          u.targetX = x; u.targetY = y; u.moving = true;
        }
      });
      setStatus(`Приказ: захватить [${x}, ${y}]`);
      hideCellMenu();
    }
  });

  bind('btnJustifyWar', () => {
    if (state.selectedCell && state.justificationsUsed < 2) {
      const {x, y} = state.selectedCell;
      const cellEl = getCellElement(x, y);
      if (cellEl && (cellEl.classList.contains('enemy') || cellEl.classList.contains('enemy-base'))) {
        startJustification();
        hideCellMenu();
      } else {
        setStatus("Оправдать можно только базу врага!");
      }
    } else {
      setStatus("Лимит оправданий исчерпан (макс. 2)");
    }
  });
}

const CONFIG = {
  COLS: 14, ROWS: 10, TICK_RATE: 800, GOLD_INCOME: 2, UNIT_COST: 20,
  JUSTIFY_TIME: 10,
};

const state = {
  gold: 0, tick: 0,
  playerBase: { x: 1, y: 8 }, // Ваша желтая база
  enemyBase: { x: 12, y: 1 }, // База врага (коричневая)
  units: [], isGameOver: false,
  selectedCell: null,
  justificationsUsed: 0,
  discountActive: false,
  justifyTimer: 0,
  botJustificationsUsed: 0,
  botDiscountActive: false,
  botJustifyTimer: 0,
};

let gameLoopInterval = null;

function restartGame() {
  state.gold = 40; state.tick = 0; state.units = []; state.isGameOver = false;
  state.justificationsUsed = 0; state.discountActive = false; state.justifyTimer = 0;
  state.botJustificationsUsed = 0; state.botDiscountActive = false; state.botJustifyTimer = 0;
  state.selectedCell = null;
  buildMap(); hideCellMenu();
  if (gameLoopInterval) clearInterval(gameLoopInterval);
  startLoop(); updateHUD(); setStatus("Захватите коричневую базу врага!");
}

function buildMap() {
  const grid = document.getElementById('grid');
  if (!grid) return;
  grid.innerHTML = '';
  
  for (let y = 0; y < CONFIG.ROWS; y++) {
    for (let x = 0; x < CONFIG.COLS; x++) {
      const cell = document.createElement('div');
      cell.className = 'cell neutral';
      cell.dataset.x = x; cell.dataset.y = y;
      
      // Устанавливаем базы
      if (x === state.playerBase.x && y === state.playerBase.y) {
        cell.className = 'cell player-base';
      } else if (x === state.enemyBase.x && y === state.enemyBase.y) {
        cell.className = 'cell enemy-base';
      }
      
      cell.addEventListener('click', () => handleCellClick(x, y));
      grid.appendChild(cell);
    }
  }
}

function handleCellClick(x, y) {
  if (state.isGameOver) return;
  state.selectedCell = { x, y };
  
  const cellEl = getCellElement(x, y);
  const menu = document.getElementById('cellMenu');
  menu.classList.remove('hidden');
  
  const btnJustify = document.getElementById('btnJustifyWar');
  const btnMove = document.getElementById('btnMoveTo');
  
  // Настраиваем кнопки в зависимости от клетки
  if (cellEl.classList.contains('enemy-base')) {
    btnJustify.style.display = 'block';
    btnMove.textContent = "Захватить базу (ПОБЕДА)";
  } else if (cellEl.classList.contains('enemy')) {
    btnJustify.style.display = 'block';
    btnMove.textContent = "Захватить территорию";
  } else {
    btnJustify.style.display = 'none';
    btnMove.textContent = "Захватить территорию";
  }
}

function hideCellMenu() {
  document.getElementById('cellMenu').classList.add('hidden');
  state.selectedCell = null;
}

function startJustification() {
  state.justificationsUsed++;
  state.justifyTimer = CONFIG.JUSTIFY_TIME;
  state.discountActive = false;
  setStatus(`Оправдание войны... Ждите!`);
}

function startLoop() {
  gameLoopInterval = setInterval(() => {
    if (state.isGameOver) return;
    state.tick++;
    
    let playerTerritory = document.querySelectorAll('.cell.player, .cell.player-base').length;
    let income = playerTerritory * CONFIG.GOLD_INCOME;
    if (state.discountActive) income = Math.floor(income * 1.02);
    state.gold += income;
    
    if (state.justifyTimer > 0) {
      state.justifyTimer--;
      if (state.justifyTimer === 0) {
        state.discountActive = true;
        setStatus("ОПРАВДАНО! Скидка 20% на юнитов.");
      }
    }
    
    if (state.botJustifyTimer > 0) {
      state.botJustifyTimer--;
      if (state.botJustifyTimer === 0) {
        state.botDiscountActive = true;
      }
    }
    
    enemyAI();
    updateUnits();
    updateHUD();
  }, CONFIG.TICK_RATE);
}

function enemyAI() {
  const enemyUnits = state.units.filter(u => u.owner === 'enemy');
  
  // Покупка юнитов
  if (state.tick % 15 === 0 && enemyUnits.length < 2 && Math.random() > 0.3) {
    state.units.push({
      id: Date.now() + Math.random(), owner: 'enemy',
      x: state.enemyBase.x, y: state.enemyBase.y,
      targetX: null, targetY: null, moving: false,
      strength: Math.floor(Math.random() * 3) + 2
    });
  }
  
  // Оправдание войны
  if (state.tick % 20 === 0 && state.botJustificationsUsed < 2 && state.botJustifyTimer === 0) {
    state.botJustificationsUsed++;
    state.botJustifyTimer = CONFIG.JUSTIFY_TIME;
  }
  
  // Движение
  enemyUnits.forEach(u => {
    if (!u.moving && Math.random() > 0.5) {
      const canAttackPlayer = state.botDiscountActive;
      const targets = [];
      
      // Бот всегда пытается захватить базу игрока, если оправдал войну
      if (canAttackPlayer) {
        targets.push(state.playerBase);
      } else {
        targets.push({ x: Math.floor(Math.random() * CONFIG.COLS), y: Math.floor(Math.random() * CONFIG.ROWS) });
      }
      
      const target = targets[Math.floor(Math.random() * targets.length)];
      u.targetX = target.x; u.targetY = target.y; u.moving = true;
    }
  });
}

function updateUnits() {
  document.querySelectorAll('.unit-dot').forEach(el => el.remove());
  const cellOccupants = {}; 

  state.units.forEach(unit => {
    if (unit.moving && (unit.x !== unit.targetX || unit.y !== unit.targetY)) {
      // Движение по осям
      if (unit.x < unit.targetX) unit.x++;
      else if (unit.x > unit.targetX) unit.x--;
      else if (unit.y < unit.targetY) unit.y++;
      else if (unit.y > unit.targetY) unit.y--;
      
      const cellEl = getCellElement(unit.x, unit.y);
      if (cellEl) {
        const isEnemyBase = unit.x === state.enemyBase.x && unit.y === state.enemyBase.y;
        const isPlayerBase = unit.x === state.playerBase.x && unit.y === state.playerBase.y;
        
        // Захват и проверка победы
        if (unit.owner === 'player' && isEnemyBase) {
          endGame(true); // ВЫ ПОБЕДИЛИ
        } else if (unit.owner === 'enemy' && isPlayerBase) {
          endGame(false); // ВЫ ПРОИГРАЛИ
        } else if (!isEnemyBase && !isPlayerBase) {
          cellEl.className = `cell ${unit.owner}`;
        }
      }
    }
    
    if (unit.x === unit.targetX && unit.y === unit.targetY) {
      unit.moving = false;
    }

    const key = `${unit.x},${unit.y}`;
    if (!cellOccupants[key]) cellOccupants[key] = [];
    cellOccupants[key].push(unit);
  });

  // Бой
  for (const key in cellOccupants) {
    const unitsHere = cellOccupants[key];
    const players = unitsHere.filter(u => u.owner === 'player');
    const enemies = unitsHere.filter(u => u.owner === 'enemy');
    
    if (players.length > 0 && enemies.length > 0) {
      const pPower = players.reduce((sum, u) => sum + (u.strength || 5), 0);
      const ePower = enemies.reduce((sum, u) => sum + (u.strength || 5), 0);
      
      if (pPower > ePower) {
        state.units = state.units.filter(u => !(u.owner === 'enemy' && `${u.x},${u.y}` === key));
        players[0].strength = pPower - ePower; 
        const [x, y] = key.split(',').map(Number);
        const cell = getCellElement(x, y);
        if (!cell.classList.contains('player-base') && !cell.classList.contains('enemy-base')) {
          cell.className = 'cell player';
        }
      } else if (ePower > pPower) {
        state.units = state.units.filter(u => !(u.owner === 'player' && `${u.x},${u.y}` === key));
        enemies[0].strength = ePower - pPower;
        const [x, y] = key.split(',').map(Number);
        const cell = getCellElement(x, y);
        if (!cell.classList.contains('player-base') && !cell.classList.contains('enemy-base')) {
          cell.className = 'cell enemy';
        }
      } else {
        state.units = state.units.filter(u => `${u.x},${u.y}` !== key);
      }
    }
  }

  state.units.forEach(u => {
    const cellEl = getCellElement(u.x, u.y);
    if (cellEl) {
      const el = document.createElement('div');
      el.className = `unit-dot ${u.owner}`;
      el.textContent = u.strength || 1;
      cellEl.appendChild(el);
    }
  });
}

function getCellElement(x, y) {
  return document.querySelector(`.cell[data-x="${x}"][data-y="${y}"]`);
}

function updateHUD() {
  const goldEl = document.getElementById('hudGold');
  const tickEl = document.getElementById('hudTick');
  const enemyUnitsEl = document.getElementById('hudEnemyUnits');
  const costEl = document.getElementById('unitCost');
  
  if (goldEl) goldEl.textContent = Math.floor(state.gold);
  if (tickEl) tickEl.textContent = state.tick;
  if (costEl) costEl.textContent = state.discountActive ? "16" : "20";
  
  const enemyUnitsCount = state.units.filter(u => u.owner === 'enemy').length;
  if (enemyUnitsEl) enemyUnitsEl.textContent = enemyUnitsCount;
}

function setStatus(msg) {
  const el = document.getElementById('statusMessage');
  if (el) {
    el.textContent = msg;
    el.style.color = '#fff';
    setTimeout(() => el.style.color = '#aaa', 800);
  }
}

function endGame(isVictory) {
  if (state.isGameOver) return;
  state.isGameOver = true;
  clearInterval(gameLoopInterval);
  setStatus(isVictory ? "ПОБЕДА! ВЫ ЗАХВАТИЛИ БАЗУ ВРАГА." : "ПОРАЖЕНИЕ. ВРАГ ЗАХВАТИЛ ВАШУ БАЗУ.");
  setTimeout(() => { show('screen-menu'); }, 3000);
}
