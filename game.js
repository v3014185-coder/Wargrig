// ===== WarGrid MVP =====
const COLS = 14, ROWS = 10, CELL = 44;
const canvas = document.getElementById('map');
const ctx = canvas.getContext('2d');
canvas.width = COLS * CELL;
canvas.height = ROWS * CELL;

const P = 1, B = 2; // игрок (СССР) и бот (Германия)
const idx = (x, y) => y * COLS + x;
const xy = (i) => [i % COLS, Math.floor(i / COLS)];

let cells = [];
for (let i = 0; i < COLS * ROWS; i++) cells.push({ owner: 0, troops: 0, capital: false });

// Спавн, как в TERRON
const spawnP = idx(2, 5), spawnB = idx(11, 5);
cells[spawnP] = { owner: P, troops: 5, capital: true };
cells[spawnB] = { owner: B, troops: 5, capital: true };

const state = {
  gold: 100, selected: -1,
  justification: null,        // {target, timeLeft}
  recruitTimer: 0
};
const bot = { gold: 100, recruitTimer: 0, justTimer: 0, target: -1 };

const elGold = document.getElementById('gold');
const elTroops = document.getElementById('troops');
const elStatus = document.getElementById('status');
const buyBtn = document.getElementById('buyBtn');
const justifyBtn = document.getElementById('justifyBtn');

const neighbors = (i) => {
  const [x, y] = xy(i);
  const r = [];
  if (x > 0) r.push(idx(x - 1, y));
  if (x < COLS - 1) r.push(idx(x + 1, y));
  if (y > 0) r.push(idx(x, y - 1));
  if (y < ROWS - 1) r.push(idx(x, y + 1));
  return r;
};
const ownedCount = (o) => cells.filter(c => c.owner === o).length;
const totalTroops = (o) => cells.filter(c => c.owner === o).reduce((s, c) => s + c.troops, 0);
const capitalOf = (o) => cells.findIndex(c => c.owner === o && c.capital);
const isAdjToEnemy = (i, o) => neighbors(i).some(n => cells[n].owner !== 0 && cells[n].owner !== o);

// ===== Экономика =====
setInterval(() => {
  const buff = state.justification || bot.justTimer > 0 ? 1.02 : 1; // +2% во время оправдания
  state.gold += Math.round((ownedCount(P) + (cells[spawnP].owner === P ? 2 : 0)) * buff);
  bot.gold += Math.round((ownedCount(B) + (cells[spawnB].owner === B ? 2 : 0)) * buff);

  // Автопризыв пехоты в столицу раз в 5 сек (быстрее на 2% при оправдании)
  state.recruitTimer += buff;
  bot.recruitTimer += buff;
  if (state.recruitTimer >= 5) { state.recruitTimer = 0; const c = capitalOf(P); if (c >= 0) cells[c].troops++; }
  if (bot.recruitTimer >= 5) { bot.recruitTimer = 0; const c = capitalOf(B); if (c >= 0) cells[c].troops++; }
}, 1000);

// ===== Оправдание войны =====
justifyBtn.onclick = () => {
  const t = state.selected;
  if (t < 0 || cells[t].owner !== B || !isAdjToEnemy(t, P)) return;
  state.justification = { target: t, timeLeft: 15 }; // на релизе 60–180 сек
  elStatus.textContent = 'Оправдание войны... таймер идёт. Обе стороны фармят +2%.';
  justifyBtn.disabled = true;
};

buyBtn.onclick = () => {
  if (state.gold < 50) return;
  state.gold -= 50;
  const c = capitalOf(P);
  if (c >= 0) cells[c].troops++;
};

// Завершение оправдания: автоатака
function resolveAttack(attOwner, target) {
  const atkCells = neighbors(target).filter(n => cells[n].owner === attOwner);
  const atk = atkCells.reduce((s, n) => s + cells[n].troops, 0) * 10;
  const def = cells[target].troops * 10 * 1.5 + 20; // бонус обороны

  if (atk > def) {
    cells[target].owner = attOwner;
    cells[target].troops = Math.floor((atk - def) / 10);
    atkCells.forEach(n => cells[n].troops = Math.ceil(cells[n].troops / 2));
    elStatus.textContent = attOwner === P ? 'Клетка захвачена! Победа!' : 'Враг захватил твою клетку!';
  } else {
    cells[target].troops = Math.ceil((def - atk) / 10 / 1.5);
    atkCells.forEach(n => cells[n].troops = Math.ceil(cells[n].troops / 2));
    elStatus.textContent = attOwner === P ? 'Атака отбита! Пополни армию и попробуй снова.' : 'Ты отбил атаку врага!';
  }
  state.justification = null;
  justifyBtn.disabled = false;
}

// Тик таймеров оправдания
setInterval(() => {
  if (state.justification) {
    state.justification.timeLeft--;
    elStatus.textContent = 'Оправдание войны... ' + state.justification.timeLeft + ' сек.';
    if (state.justification.timeLeft <= 0) resolveAttack(P, state.justification.target);
  }
  if (bot.justTimer > 0) {
    bot.justTimer--;
    if (bot.justTimer <= 0 && bot.target >= 0) resolveAttack(B, bot.target);
  }
}, 1000);

// ===== ИИ бота =====
setInterval(() => {
  if (bot.justTimer > 0) return;
  const border = cells.map((c, i) => ({ c, i })).filter(x => x.c.owner === B && isAdjToEnemy(x.i, B));
  for (const { c, i } of border) {
    const enemyCells = neighbors(i).filter(n => cells[n].owner === P);
    for (const n of enemyCells) {
      if (c.troops >= cells[n].troops + 4) {
        bot.target = n; bot.justTimer = 5;
        elStatus.textContent = 'Германия оправдывает войну против тебя! Готовься!';
        return;
      }
    }
  }
}, 10000);

// ===== Ввод =====
canvas.addEventListener('click', (e) => {
  const r = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - r.left) / CELL);
  const y = Math.floor((e.clientY - r.top) / CELL);
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return;
  const i = idx(x, y);
  if (cells[i].owner === B && isAdjToEnemy(i, P)) {
    state.selected = i;
    justifyBtn.disabled = false;
    elStatus.textContent = 'Клетка выбрана. Жми «Оправдать войну».';
  } else {
    state.selected = -1;
    justifyBtn.disabled = true;
  }
});

// ===== Отрисовка =====
const COLORS = { 0: '#2b2b30', [P]: '#a83232', [B]: '#5a5a6e' };
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < cells.length; i++) {
    const [x, y] = xy(i);
    const c = cells[i];
    ctx.fillStyle = COLORS[c.owner];
    ctx.fillRect(x * CELL, y * CELL, CELL - 2, CELL - 2);
    if (c.capital) {
      ctx.strokeStyle = '#ffd76e'; ctx.lineWidth = 2;
      ctx.strokeRect(x * CELL + 2, y * CELL + 2, CELL - 6, CELL - 6);
    }
    if (c.troops > 0) {
      ctx.fillStyle = '#fff'; ctx.font = '12px Arial'; ctx.textAlign = 'center';
      ctx.fillText(c.troops, x * CELL + CELL / 2 - 1, y * CELL + CELL / 2 + 4);
    }
    if (i === state.selected) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
      ctx.strokeRect(x * CELL, y * CELL, CELL - 2, CELL - 2);
    }
  }
  if (state.justification) {
    const [x, y] = xy(state.justification.target);
    ctx.strokeStyle = '#ffd76e'; ctx.lineWidth = 3;
    ctx.strokeRect(x * CELL, y * CELL, CELL - 2, CELL - 2);
  }
  elGold.textContent = state.gold;
  elTroops.textContent = totalTroops(P);
  requestAnimationFrame(draw);
}
draw();
