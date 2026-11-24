/**
 * WarGrid v1.0 - Game Logic (Fixed & Improved)
 * Senior Frontend & Game Design
 */
document.addEventListener('DOMContentLoaded', () => {
    // --- КОНСТАНТЫ И КОНФИГУРАЦИЯ ---
    const CONFIG = {
        GRID_W: 14,
        GRID_H: 10,
        START_GOLD: 60,
        START_INF: 11,
        START_TANKS: 0,
        COST_INF: 50,
        COST_TANK: 150,
        TICK_RATE: 1000, // 1 секунда = 1 тик
        CAPITAL_BONUS_GOLD: 10,
        CELL_GOLD: 1,
        WAR_JUSTIFICATION_TIME: 5000, // Уменьшил до 5 сек, чтобы не скучать
    };

    // --- СОСТОЯНИЕ ИГРЫ ---
    let state = {
        gold: CONFIG.START_GOLD,
        infantry: CONFIG.START_INF,
        tanks: CONFIG.START_TANKS,
        doctrine: 'infantry',
        isGameOver: false,
        selectedCell: null,
        timer: null,
        tickInterval: null,
        grid: [], // Массив объектов { x, y, owner, isCapital, infantry, tanks }
    };

    // --- DOM ЭЛЕМЕНТЫ ---
    const DOM = {
        menuScreen: document.getElementById('menu-screen'),
        gameScreen: document.getElementById('game-screen'),
        gameOverScreen: document.getElementById('game-over-screen'),
        grid: document.getElementById('game-grid'),
        goldDisplay: document.getElementById('gold-display'),
        infDisplay: document.getElementById('infantry-display'),
        tankDisplay: document.getElementById('tank-display'),
        buyInfBtn: document.getElementById('buy-infantry'),
        buyTankBtn: document.getElementById('buy-tank'),
        startBtn: document.getElementById('start-btn'),
        restartBtn: document.getElementById('restart-btn'),
        statusMsg: document.getElementById('status-message'),
        timerOverlay: document.getElementById('timer-overlay'),
        timerDisplay: document.getElementById('timer-display'),
        gameOverTitle: document.getElementById('game-over-title'),
        gameOverText: document.getElementById('game-over-text'),
    };

    // --- ИНИЦИАЛИЗАЦИЯ ---
    function init() {
        try {
            setupMenuListeners();
            initGrid();
            startGameLoop();
            render();
        } catch (e) {
            console.error("Критическая ошибка при инициализации:", e);
            alert("Произошла ошибка. Проверьте консоль.");
        }
    }

    // --- ИНИЦИАЛИЗАЦИЯ СЕТКИ ---
    function initGrid() {
        state.grid = [];
        DOM.grid.innerHTML = '';
        
        for (let y = 0; y < CONFIG.GRID_H; y++) {
            for (let x = 0; x < CONFIG.GRID_W; x++) {
                // Игрок слева (x < 3), Враг справа (x > 10)
                let owner = 'neutral';
                let isCapital = false;

                if (x < 3) owner = 'player';
                if (x > 10) owner = 'enemy';

                // Столицы
                if (x === 0 && y === 4) { owner = 'player'; isCapital = true; }
                if (x === 13 && y === 5) { owner = 'enemy'; isCapital = true; }

                const cell = { x, y, owner, isCapital, infantry: 0, tanks: 0 };
                
                // Начальные войска
                if (owner === 'player') { cell.infantry = 5; }
                if (owner === 'enemy') { cell.infantry = 5; }

                state.grid.push(cell);
            }
        }

        // Генерация DOM
        state.grid.forEach((cellData, index) => {
            const cellEl = document.createElement('div');
            cellEl.className = 'cell';
            cellEl.dataset.index = index;
            cellEl.id = `cell-${index}`;
            DOM.grid.appendChild(cellEl);
        });

        // Делегирование событий для сетки
        DOM.grid.addEventListener('click', (e) => {
            const cellEl = e.target.closest('.cell');
            if (!cellEl) return;
            handleCellClick(parseInt(cellEl.dataset.index));
        });
    }

    // --- МЕНЮ И ОБРАБОТЧИКИ ---
    function setupMenuListeners() {
        // Выбор доктрины (делегирование)
        document.querySelector('.doctrine-cards').addEventListener('click', (e) => {
            const card = e.target.closest('.doctrine-card');
            if (!card) return;
            
            document.querySelectorAll('.doctrine-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            state.doctrine = card.dataset.doctrine;
            DOM.startBtn.disabled = false;
        });

        DOM.startBtn.addEventListener('click', () => {
            DOM.menuScreen.classList.remove('active');
            DOM.gameScreen.classList.add('active');
            updateStatus("Кликни по красной клетке на границе, чтобы атаковать.");
            render();
        });

        // Покупка юнитов
        DOM.buyInfBtn.addEventListener('click', () => buyUnit('infantry'));
        DOM.buyTankBtn.addEventListener('click', () => buyUnit('tank'));

        // Рестарт
        DOM.restartBtn.addEventListener('click', () => {
            window.location.reload();
        });
    }

    // --- ИГРОВАЯ ЛОГИКА ---
    function buyUnit(type) {
        if (state.isGameOver) return;
        
        const cost = type === 'infantry' ? CONFIG.COST_INF : CONFIG.COST_TANK;
        if (state.gold >= cost) {
            state.gold -= cost;
            if (type === 'infantry') state.infantry += 1;
            else state.tanks += 1;
            render();
        } else {
            flashStatus("Недостаточно золота!", "var(--danger)");
        }
    }

    function handleCellClick(index) {
        if (state.isGameOver || state.timer) return;
        
        const cell = state.grid[index];
        const isBorder = cell.owner === 'enemy' && checkIfBorder(cell.x, cell.y);

        // Если кликнули по своей клетке - выделяем
        if (cell.owner === 'player') {
            if (state.selectedCell !== null) {
                const oldEl = document.getElementById(`cell-${state.selectedCell}`);
                if (oldEl) oldEl.classList.remove('selected-cell');
            }
            state.selectedCell = index;
            document.getElementById(`cell-${index}`).classList.add('selected-cell');
            updateStatus("Выбрана своя клетка. Теперь нажми на красную границу врага для атаки.");
            return;
        }

        // Если кликнули по врагу на границе - атака
        if (isBorder) {
            if (state.infantry === 0 && state.tanks === 0) {
                flashStatus("У вас нет войск для атаки! Купите их в панели сверху.", "var(--danger)");
                return;
            }
            startWarJustification(cell);
        } else {
            updateStatus("Атаковать можно только клетки на границе с вашей территорией.");
        }
    }

    // Проверка, является ли клетка граничной (есть сосед-игрок)
    function checkIfBorder(x, y) {
        const neighbors = [
            {x: x+1, y}, {x: x-1, y}, {x, y: y+1}, {x, y: y-1}
        ];
        return neighbors.some(n => {
            const neighbor = state.grid.find(c => c.x === n.x && c.y === n.y);
            return neighbor && neighbor.owner === 'player';
        });
    }

    // Механика "Оправдание войны"
    function startWarJustification(targetCell) {
        state.timer = true;
        DOM.timerOverlay.classList.remove('hidden');
        updateStatus("Идёт оправдание войны. Обе стороны получают +2% к доходу.");
        
        let timeLeft = CONFIG.WAR_JUSTIFICATION_TIME / 1000;
        DOM.timerDisplay.textContent = `${timeLeft.toFixed(1)}s`;

        const timerInterval = setInterval(() => {
            timeLeft -= 0.1;
            DOM.timerDisplay.textContent = `${Math.max(0, timeLeft).toFixed(1)}s`;
            
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                DOM.timerOverlay.classList.add('hidden');
                executeAttack(targetCell);
            }
        }, 100);
    }

    // Сама атака
    function executeAttack(targetCell) {
        state.timer = false;
        
        // Расчет силы
        const attackPower = state.infantry * 1 + state.tanks * 4;
        const defensePower = (targetCell.infantry * 1 + targetCell.tanks * 4) * 1.5; // Бонус обороны x1.5

        const cellEl = document.getElementById(`cell-${state.grid.indexOf(targetCell)}`);
        cellEl.classList.add('attacked');

        // Анимация тряски
        setTimeout(() => {
            cellEl.classList.remove('attacked');

            if (attackPower > defensePower) {
                // Победа
                targetCell.owner = 'player';
                targetCell.infantry = Math.max(1, Math.floor((attackPower - defensePower) / 2)); 
                targetCell.tanks = 0;
                
                // Обнуляем свои войска
                state.infantry = 0;
                state.tanks = 0;

                cellEl.classList.add('captured');
                flashStatus("Победа! Клетка захвачена.", "var(--success)");

                if (targetCell.isCapital) {
                    endGame(true);
                }
            } else {
                // Поражение
                flashStatus("Атака провалилась! Вражеская оборона слишком сильна.", "var(--danger)");
                targetCell.infantry = Math.max(0, targetCell.infantry - Math.floor(attackPower / 4));
                state.infantry = Math.floor(state.infantry / 2);
                state.tanks = 0;
                cellEl.classList.add('lost');
            }

            render();
        }, 500);
    }

    // --- ИИ БОТА ---
    function botTurn() {
        if (state.isGameOver || state.timer) return;

        const enemyCells = state.grid.filter(c => c.owner === 'enemy');
        let totalEnemyPower = enemyCells.reduce((sum, c) => sum + c.infantry + c.tanks * 4, 0);
        
        // Бот копит силы
        if (totalEnemyPower < 50) {
            enemyCells.forEach(c => {
                if (Math.random() > 0.7) c.infantry += 2;
            });
        } else {
            const capital = enemyCells.find(c => c.isCapital);
            if (capital && Math.random() > 0.8) capital.tanks += 1;
        }

        // Бот ищет цель
        const borderTargets = state.grid.filter(c => 
            c.owner === 'player' && checkIfBorderForEnemy(c.x, c.y)
        );

        if (borderTargets.length > 0) {
            const target = borderTargets.reduce((weakest, current) => {
                const currentPower = current.infantry + current.tanks * 4;
                const weakestPower = weakest.infantry + weakest.tanks * 4;
                return currentPower < weakestPower ? current : weakest;
            });

            const targetPower = (target.infantry + target.tanks * 4) * 1.5;
            
            const enemyPowerNearTarget = enemyCells
                .filter(c => Math.abs(c.x - target.x) <= 2 && Math.abs(c.y - target.y) <= 2)
                .reduce((sum, c) => sum + c.infantry + c.tanks * 4, 0);

            // Бот атакует только при 2x преимуществе
            if (enemyPowerNearTarget > targetPower * 2.0) {
                updateStatus("Враг готовит наступление!");
                
                setTimeout(() => {
                    if (state.isGameOver) return;
                    const cellEl = document.getElementById(`cell-${state.grid.indexOf(target)}`);
                    cellEl.classList.add('attacked');
                    
                    setTimeout(() => {
                        cellEl.classList.remove('attacked');
                        if (enemyPowerNearTarget > targetPower) {
                            target.owner = 'enemy';
                            target.infantry = Math.floor(enemyPowerNearTarget / 4);
                            target.tanks = 0;
                            cellEl.classList.add('lost');
                            flashStatus("Враг захватил вашу клетку!", "var(--danger)");
                            
                            if (target.isCapital) {
                                endGame(false);
                            }
                        } else {
                            flashStatus("Вы отбили атаку врага!", "var(--success)");
                        }
                        render();
                    }, 500);
                }, 1000);
            }
        }
    }

    function checkIfBorderForEnemy(x, y) {
        const neighbors = [
            {x: x+1, y}, {x: x-1, y}, {x, y: y+1}, {x, y: y-1}
        ];
        return neighbors.some(n => {
            const neighbor = state.grid.find(c => c.x === n.x && c.y === n.y);
            return neighbor && neighbor.owner === 'enemy';
        });
    }

    // --- ИГРОВОЙ ЦИКЛ ---
    function startGameLoop() {
        state.tickInterval = setInterval(() => {
            try {
                if (state.isGameOver || state.timer) return;

                // Доход
                let income = 0;
                state.grid.forEach(c => {
                    if (c.owner === 'player') {
                        income += CONFIG.CELL_GOLD;
                        if (c.isCapital) income += CONFIG.CAPITAL_BONUS_GOLD;
                    }
                });

                if (state.timer) income *= 1.02;
                state.gold += income;
                
                // Призыв в столице
                const capital = state.grid.find(c => c.owner === 'player' && c.isCapital);
                if (capital) {
                    let summonRate = 1;
                    if (state.doctrine === 'infantry') summonRate *= 1.4;
                    if (state.timer) summonRate *= 1.02;
                    
                    if (Math.random() < 0.1 * summonRate) { 
                        state.infantry += 1;
                    }
                }

                if (Math.random() < 0.33) {
                    botTurn();
                }

                render();
            } catch (e) {
                console.error("Ошибка в игровом цикле:", e);
            }
        }, CONFIG.TICK_RATE);
    }

    // --- РЕНДЕР ---
    function render() {
        // Обновление HUD
        DOM.goldDisplay.textContent = `Золото: ${Math.floor(state.gold)}`;
        DOM.infDisplay.textContent = `Пехота: ${state.infantry}`;
        DOM.tankDisplay.textContent = `Танки: ${state.tanks}`;

        DOM.buyInfBtn.disabled = state.gold < CONFIG.COST_INF;
        DOM.buyTankBtn.disabled = state.gold < CONFIG.COST_TANK;

        // Отрисовка сетки
        state.grid.forEach((cell, index) => {
            const el = document.getElementById(`cell-${index}`);
            if (!el) return;

            el.className = 'cell'; 
            if (cell.owner === 'player') el.classList.add('player-territory');
            if (cell.owner === 'enemy') el.classList.add('enemy-territory');
            if (cell.isCapital) el.classList.add('capital');

            if (cell.owner === 'enemy' && checkIfBorder(cell.x, cell.y)) {
                el.classList.add('selectable');
            }

            // Текст в клетке (кол-во войск)
            let troops = cell.infantry + cell.tanks;

            // Если это наша столица, показываем в ней ВСЮ нашу армию
            if (cell.owner === 'player' && cell.isCapital) {
                troops += state.infantry + state.tanks;
            }

            if (troops > 0) {
                el.textContent = troops;
            } else {
                el.textContent = '';
            }
        });
    }

    // --- УТИЛИТЫ ---
    function updateStatus(msg) {
        DOM.statusMsg.textContent = msg;
        DOM.statusMsg.style.color = '#aaa';
    }

    function flashStatus(msg, color) {
        DOM.statusMsg.textContent = msg;
        DOM.statusMsg.style.color = color;
        setTimeout(() => {
            DOM.statusMsg.style.color = '#aaa';
        }, 2000);
    }

    function endGame(isVictory) {
        state.isGameOver = true;
        clearInterval(state.tickInterval);
        
        DOM.gameScreen.classList.remove('active');
        DOM.gameOverScreen.classList.add('active');
        
        DOM.gameOverTitle.textContent = isVictory ? "Победа!" : "Поражение...";
        DOM.gameOverTitle.style.color = isVictory ? "var(--success)" : "var(--danger)";
        DOM.gameOverText.textContent = isVictory ? "Вы захватили столицу врага!" : "Ваша столица пала.";
    }

    // Запуск
    init();
});
