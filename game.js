// ===== WarGrid v0.2 =====
const COLS = 14, ROWS = 10, CELL = 44;
const canvas = document.getElementById('map');
const ctx = canvas.getContext('2d');
canvas.width = COLS * CELL;
canvas.height = ROWS * CELL;

const P = 1, B = 2;
const idx = (x, y) => y * COLS + x;
const xy = (i) => [i % COLS, Math.floor(i / COLS)];

const INF_COST = 50, TANK_COST = 150, TANK_STRENGTH = 4;
let infRecruitSec = 5; // ускоряется доктриной

const screens = {
  menu: document.getElementById('menu'),
  doctrines: document.getElementById('doctrines'),
  help: document.getElementById('help'),
  game: document.getElementById('game'),
  end: document.getElementById('end'),
};
const show = (name) => {
  Object.keys(screens).forEach(k => screens[k].classList.toggle('hidden', k !== name));
};

let state = null; // инициализируется при старте партии
const bot = { gold: 100, recruitTimer: 0, justTimer: 0, target: -1, doc: 'inf' };

const el = {
  gold: document.getElementById('gold'), troops: document.getElementById('troops'),
  tanks: document.getElementById('tanks'), eTroops: document.getElementById('eTroops'),
  status: document.getElementById('status'),
  buyInf: document.getElementById('buyInf'), buyTank: document.getElementById('buyTank'),
  justifyBtn: document.getElementById('justifyBtn'),
};

const neighbors = (i) => {
  const [x, y] = xy(i); const r = [];
  if (x > 0) r.push(idx(x - 1, y));
  if (x < COLS - 1) r.push(idx(x + 1, y));
  if (y > 0) r.push(idx(x, y - 1));
  if (y < ROWS - 1) r.push(idx(x, y + 1));
  return r;
};
const cellStrength = (c) => c.troops + c.tanks * TANK_STRENGTH;
const isAdjToEnemy = (i, o) => neighbors(i).some(n => cells[n].owner !== 0 && cells[n].owner !== o);
const capitalOf = (o) => cells.findIndex(c => c.owner === o && c.capital);
const sideStats = (o) => cells.reduce((acc, c) => {
  if (c.owner === o) { acc.troops += c.troops; acc.tanks += c.tanks; }
  return acc;
}, { troops: 0, tanks: 0 });

let cells = [];
function startGame(doc) {
  infRecruitSec = (doc === 'inf') ? 3.5 : 5;
  bot.doc = doc === 'inf' ? 'tank' : 'inf';
  cells = [];
  for (let i = 0; i < COLS * ROWS; i++) cells.push({ owner: 0, troops: 0, tanks: 0, capital: false });
  cells[idx(2, 5)] = { owner: P, troops: 5, tanks: 0, capital: true };
  cells[idx(11, 5)] = { owner: B, troops: 5, tanks: 0, capital: true };
  state = {
    gold: 100, selected: -1, justification: null,
    recruitTimer: 0, over: false,
  };
  bot.gold = 100; bot.recruitTimer = 0; bot.justTimer = 0; bot.target = -1;
  el.status.textContent = 'Доктрина: ' + (doc === 'inf' ? 'пехотная' : 'танковая');
  show('game');
}

// ===== Экономика =====
setInterval(() => {
  if (!state || state.over) return;
  const buff = (state.justification || bot.justTimer > 0) ? 1.02 : 1; // +2% при оправдании
  const mine = cells.filter(c => c.owner === P).length;
  const enemy = cells.filter(c => c.owner === B).length;
  state.gold += Math.round((mine + 2) * buff);
  bot.gold += Math.round((enemy + 2) * buff);

  // Призыв пехоты в столицу
  state.recruitTimer += buff;
  if (state.recruitTimer >= infRecruitSec) {
    state.recruitTimer = 0;
    const c = capitalOf(P); if (c >= 0) cells[c].troops++;
  }
  const botRate = bot.doc === 'inf' ? 3.5 : 5;
  bot.recruitTimer += buff;
  if (bot.recruitTimer >= botRate) {
    bot.recruitTimer = 0;
    const c = capitalOf(B); if (c >= 0) cells[c].troops++;
  }
}, 1000);

// ===== Оправдание войны =====
el.justifyBtn.onclick = () => {
  const t = state.selected;
  if (t < 0 || cells[t].owner !== B || !isAdjToEnemy(t, P)) return;
  state.justification = { target: t, timeLeft: 15 };
  el.justifyBtn.disabled = true;
  el.status.textContent = 'Таймер пошёл: обе стороны фармят на +2% быстрее!';
};

el.buyInf.onclick = () => {
  if (!state || state.over || state.gold < INF_COST) return;
  state.gold -= INF_COST;
  const c = capitalOf(P); if (c >= 0) cells[c].troops++;
};
el.buyTank.onclick = () => {
  const cost = document.querySelector('.card[data-doc="tank"]') && false ? 0 : (infRecruitSec === 5 ? 150 : 150);
  const tankCost = (tankDoc) ? TANK_COST - 30 : TANK_COST;
  if (!state || state.over || state.gold < tankCost) return;
  state.gold -= tankCost;
  const c = capitalOf(P); if (c >= 0) cells[c].tanks++;
};
// доктрина игрока
let tankDoc = false;
function pickDoc(doc) {
  tankDoc = (doc === 'tank');
  el.buyTank.textContent = tankDoc ? 'Танк (120)' : 'Танк (150)';
  startGame(doc);
}
document.querySelectorAll('.card').forEach(card =>
  card.addEventListener('click', () => pickDoc(card.dataset.doc)));

function resolveAttack(attOwner, target) {
  const atkCells = neighbors(target).filter(n => cells[n].owner === attOwner);
  const atk = atkCells.reduce((s, n) => s + cellStrength(cells[n]), 0) * 10;
  const def = cellStrength(cells[target]) * 10 * 1.5 + 20;
  const name = attOwner === P ? 'Ты' : 'Германия';

  if (atk > def) {
    const prevOwner = cells[target].owner;
    cells[target] = {
      owner: attOwner,
      troops: Math.floor((atk - def) / 10),
      tanks: 0, capital: cells[target].capital,
    };
    atkCells.forEach(n => { cells[n].troops = Math.ceil(cells[n].troops / 2); cells[n].tanks = Math.ceil(cells[n].tanks / 2); });
    el.status.textContent = `${name} захватили клетку!`;
    if (cells[target].capital && prevOwner !== attOwner) endGame(attOwner === P);
  } else {
    cells[target].troops = Math.max(1, Math.ceil((def - atk) / 10 / 1.5));
    atkCells.forEach(n => { cells[n].troops = Math.ceil(cells[n].troops / 2); cells[n].tanks = Math.ceil(cells[n].tanks / 2); });
    el.status.textContent = `Атака ${attOwner === P ? 'отбита' : 'врага отбита'}!`;
  }
  state.justification = null;
  el.justifyBtn.disabled = true;
  state.selected = -1;
}

setInterval(() => {
  if (!state || state.over) return;
  if (state.justification) {
    state.justification.timeLeft--;
    el.status.textContent = 'Оправдание войны: ' + state.justification.timeLeft + ' сек...';
    if (state.justification.timeLeft <= 0) resolveAttack(P, state.justification.target);
  }
  if (bot.justTimer > 0) {
    bot.justTimer--;
    if (bot.justTimer <= 0 && bot.target >= 0) resolveAttack(B, bot.target);
  }
}, 1000);

// ===== ИИ =====
setInterval(() => {
  if (!state || state.over) return;
  // Бот тратит золото
  const botCap = capitalOf(B);
  if (botCap >= 0) {
    if (bot.gold >= 150 && Math.random() < 0.3) { bot.gold -= 150; cells[botCap].tanks++; }
    else if (bot.gold >= 50) { bot.gold -= 50; cells[botCap].troops++; }
  }
  // Бот решает атаковать
  if (bot.justTimer > 0 || bot.target >= 0) return;
  const border = cells.map((c, i) => ({ c, i })).filter(x => x.c.owner === B && isAdjToEnemy(x.i, B));
  for (const { c, i } of border) {
    const targets = neighbors(i).filter(n => cells[n].owner === P);
    for (const n of targets) {
      if (c.troops >= cells[n].troops + 4) {
        bot.target = n; bot.justTimer = 5;
        el.status.textContent = '⚠ Германия оправдывает войну! Усиль границу!';
        return;
      }
    }
  }
}, 5000);

// ===== Ввод (с учётом масштаба экрана) =====
canvas.addEventListener('click', (e) => {
  if (!state || state.over) return;
  const r = canvas.getBoundingClientRect();
  const scaleX = canvas.width / r.width, scaleY = canvas.height / r.height;
  const x = Math.floor((e.clientX - r.left) * scaleX / CELL);
  const y = Math.floor((e.clientY - r.top) * scaleY / CELL);
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return;
  const i = idx(x, y);
  if (cells[i].owner === B && isAdjToEnemy(i, P)) {
    state.selected = i;
    el.justifyBtn.disabled = false;
    el.status.textContent = 'Клетка выбрана. Жми «Оправдать войну».';
  } else {
    state.selected = -1;
    el.justifyBtn.disabled = true;
  }
});

// ===== Конец партии =====
function endGame(win) {
  state.over = true;
  document.getElementById('endTitle').textContent = win ? 'ПОБЕДА!' : 'ПОРАЖЕНИЕ';
  document.getElementById('endDesc').textContent = win
    ? 'Столица Германии захвачена. Рейх пал.'
    : 'Твоя столица пала. Германия торжествует.';
  show('end');
}
document.getElementById('btnRestart').onclick = () => show('menu');

// ===== Меню =====
document.getElementById('btnPlay').onclick = () => show('doctrines');
document.getElementById('btnHelp').onclick = () => show('help');
document.getElementById('btnBack').onclick = () => show('menu');

// ===== Отрисовка =====
const COLORS = { 0: '#2b2b30', [P]: '#a83232', [B]: '#5a5a6e' };
function draw() {
  if (!screens.game.classList.contains('hidden') && state) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < cells.length; i++) {
      const [x, y] = xy(i); const c = cells[i];
      ctx.fillStyle = COLORS[c.owner];
      ctx.fillRect(x * CELL, y * CELL, CELL - 2, CELL - 2);
      if (c.capital) {
        ctx.strokeStyle = '#ffd76e'; ctx.lineWidth = 2;
        ctx.strokeRect(x * CELL + 2, y * CELL + 2, CELL - 6, CELL - 6);
      }
      if (c.troops > 0 || c.tanks > 0) {
        ctx.fillStyle = '#fff'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center';
        const s = c.troops + (c.tanks > 0 ? '+' + c.tanks + 'T' : '');
        ctx.fillText(s, x * CELL + CELL / 2 - 1, y * CELL + CELL / 2 + 4);
      }
      if (i === state.selected) {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
        ctx.strokeRect(x * CELL, y * CELL, CELL - 2, CELL - 2);
      }
      if (state.justification && state.justification.target === i) {
        ctx.strokeStyle = '#ffd76e'; ctx.lineWidth = 3;
        ctx.strokeRect(x * CELL, y * CELL, CELL - 2, CELL - 2);
      }
    }
    const s = sideStats(P), e = sideStats(B);
    el.gold.textContent = state.gold;
    el.troops.textContent = s.troops;
    el.tanks.textContent = s.tanks;
    el.eTroops.textContent = e.troops;
  }
  requestAnimationFrame(draw);
}
draw();
