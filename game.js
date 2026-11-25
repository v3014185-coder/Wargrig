/* =========================================================
   WarGrid — Логика RTS (Версия 4.0 — Ослабленный бот)
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
      // Ваш отряд остается сильным (5-10 человек)
      const squadSize = Math.floor(Math.random() * 6) + 5; 
      state.units.push({
        id: Date.now() + Math.random(),
        owner: 'player',
        x: state.playerBase.x,
        y: state.playerBase.y,
        targetX: null,
        targetY: null,
        moving: false,
        strength: squadSize
      });
      updateHUD();
      setStatus(`Прибыл отряд: ${squadSize} чел.`);
    } else {
      setStatus("Недостаточно золота!");
    }
  });
}

/* --- КОНФИГУРАЦИЯ --- */
const CONFIG = {
  COLS: 14,
  ROWS: 10,
  TICK_RATE: 800, 
  GOLD_INCOME: 2,
  UNIT_COST: 20,
};

const state = {
  gold: 0,
  tick: 0,
  playerBase: { x: 1, y: 8 },
  enemyBase: { x: 12, y: 1 },
  units: [],
  isGameOver: false,
};

let gameLoopInterval = null;

function restartGame() {
  state.gold = 40;
  state.tick = 0;
  state.units = [];
  state.isGameOver = false;
  
  buildMap();
  if (gameLoopInterval) clearInterval(gameLoopInterval);
  startLoop();
  updateHUD();
  setStatus("Бой начался. Бот ослаблен!");
}

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
      
      if (x === state.playerBase.x && y === state.playerBase.y) {
        cell.classList.replace('neutral', 'player');
      } else if (x === state.enemyBase.x && y === state.enemyBase.y) {
        cell.classList.replace('neutral', 'enemy');
      }
      
      cell.addEventListener('click', () => handleCellClick(x, y));
      grid.appendChild(cell);
    }
  }
}

function handleCellClick(x, y) {
  if (state.isGameOver) return;
  
  state.units.forEach(u => {
    if (u.owner === 'player') {
      u.targetX = x;
      u.targetY = y;
      u.moving = true;
    }
  });
  
  setStatus(`Приказ: выдвигаемся в [${x}, ${y}]`);
  
  document.querySelectorAll('.cell').forEach(c => c.classList.remove('target'));
  const targetCell = getCellElement(x, y);
  if (targetCell) targetCell.classList.add('target');
}

function startLoop() {
  gameLoopInterval = setInterval(() => {
    if (state.isGameOver) return;
    state.tick++;
    
    let playerTerritory = document.querySelectorAll('.cell.player').length;
    state.gold += playerTerritory * CONFIG.GOLD_INCOME;
    
    enemyAI();
    updateUnits();
    updateHUD();
  }, CONFIG.TICK_RATE);
}

/* --- ОСЛАБЛЕННЫЙ ИИ БОТА --- */
function enemyAI() {
  const enemyUnits = state.units.filter(u => u.owner === 'enemy');
  
  // Бот копит деньги и покупает реже (раз в 10 тиков), держит максимум 2 отряда
  if (state.tick % 10 === 0 && enemyUnits.length < 2 && Math.random() > 0.4) {
    state.units.push({
      id: Date.now() + Math.random(),
      owner: 'enemy',
      x: state.enemyBase.x,
      y: state.enemyBase.y,
      targetX: null,
      targetY: null,
      moving: false,
      // Сила врага 2-4 человека
      strength: Math.floor(Math.random() * 3) + 2
    });
  }
  
  // Бот отправляет юнитов реже и атакует базу игрока только в 30% случаев
  enemyUnits.forEach(u => {
    if (!u.moving && Math.random() > 0.5) {
      const isAttack = Math.random() > 0.7;
      u.targetX = isAttack ? state.playerBase.x : Math.floor(Math.random() * CONFIG.COLS);
      u.targetY = isAttack ? state.playerBase.y : Math.floor(Math.random() * CONFIG.ROWS);
      u.moving = true;
    }
  });
}

function updateUnits() {
  document.querySelectorAll('.unit-dot').forEach(el => el.remove());
  
  const cellOccupants = {}; 

  state.units.forEach(unit => {
    if (unit.moving && (unit.x !== unit.targetX || unit.y !== unit.targetY)) {
      if (unit.x < unit.targetX) unit.x++;
      else if (unit.x > unit.targetX) unit.x--;
      else if (unit.y < unit.targetY) unit.y++;
      else if (unit.y > unit.targetY) unit.y--;
      
      const cellEl = getCellElement(unit.x, unit.y);
      if (cellEl) {
        const isEnemyBase = unit.x === state.enemyBase.x && unit.y === state.enemyBase.y;
        const isPlayerBase = unit.x === state.playerBase.x && unit.y === state.playerBase.y;
        
        if (!isEnemyBase && !isPlayerBase) {
           cellEl.className = `cell ${unit.owner}`;
        } else if (unit.owner === 'enemy' && isPlayerBase) {
           endGame(false); 
        } else if (unit.owner === 'player' && isEnemyBase) {
           endGame(true); 
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
        getCellElement(x, y).className = 'cell player';
      } else if (ePower > pPower) {
        state.units = state.units.filter(u => !(u.owner === 'player' && `${u.x},${u.y}` === key));
        enemies[0].strength = ePower - pPower;
        const [x, y] = key.split(',').map(Number);
        getCellElement(x, y).className = 'cell enemy';
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
  
  if (goldEl) goldEl.textContent = Math.floor(state.gold);
  if (tickEl) tickEl.textContent = state.tick;
  
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
  setStatus(isVictory ? "ПОБЕДА! ВРАГ РАЗБИТ." : "ПОРАЖЕНИЕ. БАЗА ЗАХВАЧЕНА.");
  setTimeout(() => { show('screen-menu'); }, 3000);
}
