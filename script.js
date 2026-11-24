const DIFFICULTIES = {
    easy: { rows: 9, cols: 9, mines: 10 },
    medium: { rows: 16, cols: 16, mines: 40 },
    hard: { rows: 16, cols: 30, mines: 99 }
  };
  
  let currentDiff = 'easy';
  let board = [];
  let rows = 9;
  let cols = 9;
  let totalMines = 10;
  let flagsPlaced = 0;
  let revealedCount = 0;
  let isFirstClick = true;
  let isGameOver = false;
  let timerInterval = null;
  let seconds = 0;
  let soundEnabled = true;
  
  // DOM элементы
  const boardEl = document.getElementById('board');
  const minesCountEl = document.getElementById('mines-count');
  const timerEl = document.getElementById('timer');
  const resetBtn = document.getElementById('reset-btn');
  const faceIcon = document.getElementById('face-icon');
  const overlayEl = document.getElementById('overlay');
  const overlayCard = overlayEl.querySelector('.overlay-card');
  const overlayTitle = document.getElementById('overlay-title');
  const overlaySubtitle = document.getElementById('overlay-subtitle');
  const overlayBtn = document.getElementById('overlay-btn');
  const soundToggleBtn = document.getElementById('sound-toggle');
  const diffBtns = document.querySelectorAll('.diff-btn');
  
  // Простой синтезатор звуков без внешних файлов
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  
  function playTone(freq, type, duration, vol = 0.08) {
    if (!soundEnabled) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
  
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  }
  
  const sfx = {
    click: () => playTone(520, 'triangle', 0.07),
    flag: () => playTone(740, 'sine', 0.09),
    unflag: () => playTone(420, 'sine', 0.09),
    win: () => {
      playTone(523.25, 'sine', 0.15);
      setTimeout(() => playTone(659.25, 'sine', 0.15), 110);
      setTimeout(() => playTone(783.99, 'sine', 0.3), 220);
    },
    boom: () => {
      playTone(130, 'sawtooth', 0.4, 0.15);
      setTimeout(() => playTone(80, 'square', 0.45, 0.15), 90);
    }
  };
  
  // Инициализация игры
  function initGame() {
    const config = DIFFICULTIES[currentDiff];
    rows = config.rows;
    cols = config.cols;
    totalMines = config.mines;
  
    board = [];
    flagsPlaced = 0;
    revealedCount = 0;
    isFirstClick = true;
    isGameOver = false;
    seconds = 0;
  
    clearInterval(timerInterval);
    timerInterval = null;
  
    updateHUD();
    faceIcon.textContent = '😎';
    overlayEl.classList.add('hidden');
    overlayCard.classList.remove('lose');
  
    renderBoard();
  }
  
  function renderBoard() {
    boardEl.innerHTML = '';
    boardEl.style.gridTemplateColumns = `repeat(${cols}, var(--cell-size))`;
  
    for (let r = 0; r < rows; r++) {
      const rowArr = [];
      for (let c = 0; c < cols; c++) {
        const cellEl = document.createElement('div');
        cellEl.classList.add('cell');
        cellEl.dataset.r = r;
        cellEl.dataset.c = c;
  
        // ЛКМ
        cellEl.addEventListener('click', () => handleCellClick(r, c));
  
        // ПКМ
        cellEl.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          toggleFlag(r, c);
        });
  
        // Долгий тап для мобильных устройств
        let pressTimer;
        cellEl.addEventListener('touchstart', () => {
          pressTimer = setTimeout(() => {
            toggleFlag(r, c);
            pressTimer = null;
          }, 400);
        }, { passive: true });
  
        cellEl.addEventListener('touchend', () => {
          if (pressTimer) clearTimeout(pressTimer);
        });
  
        boardEl.appendChild(cellEl);
        rowArr.push({
          r,
          c,
          isMine: false,
          isRevealed: false,
          isFlagged: false,
          neighborMines: 0,
          el: cellEl
        });
      }
      board.push(rowArr);
    }
  }
  
  function placeMines(safeR, safeC) {
    let placed = 0;
    while (placed < totalMines) {
      const r = Math.floor(Math.random() * rows);
      const c = Math.floor(Math.random() * cols);
  
      // Не ставим мину на первую нажатую клетку и вокруг неё
      const isSafeZone = Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1;
      if (!board[r][c].isMine && !isSafeZone) {
        board[r][c].isMine = true;
        placed++;
      }
    }
  
    // Подсчёт соседей
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!board[r][c].isMine) {
          board[r][c].neighborMines = getNeighbors(r, c).filter(n => n.isMine).length;
        }
      }
    }
  }
  
  function getNeighbors(r, c) {
    const neighbors = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          neighbors.push(board[nr][nc]);
        }
      }
    }
    return neighbors;
  }
  
  function startTimer() {
    if (timerInterval) return;
    timerInterval = setInterval(() => {
      if (seconds < 999) {
        seconds++;
        timerEl.textContent = String(seconds).padStart(3, '0');
      }
    }, 1000);
  }
  
  function handleCellClick(r, c) {
    if (isGameOver) return;
    const cell = board[r][c];
    if (cell.isFlagged) return;
  
    if (isFirstClick) {
      isFirstClick = false;
      placeMines(r, c);
      startTimer();
    }
  
    // Быстрое открытие (Chording), если кликнули по открытой цифре
    if (cell.isRevealed && cell.neighborMines > 0) {
      const neighbors = getNeighbors(r, c);
      const flaggedAround = neighbors.filter(n => n.isFlagged).length;
      if (flaggedAround === cell.neighborMines) {
        neighbors.forEach(n => {
          if (!n.isRevealed && !n.isFlagged) {
            revealCell(n.r, n.c);
          }
        });
      }
      return;
    }
  
    if (!cell.isRevealed) {
      sfx.click();
      revealCell(r, c);
    }
  }
  
  function revealCell(r, c) {
    const cell = board[r][c];
    if (cell.isRevealed || cell.isFlagged || isGameOver) return;
  
    cell.isRevealed = true;
    cell.el.classList.add('revealed');
    revealedCount++;
  
    if (cell.isMine) {
      cell.el.classList.add('mine-exploded');
      cell.el.textContent = '💥';
      endGame(false);
      return;
    }
  
    if (cell.neighborMines > 0) {
      cell.el.textContent = cell.neighborMines;
      cell.el.classList.add(`num-${cell.neighborMines}`);
    } else {
      // Рекурсивно открываем пустую область
      getNeighbors(r, c).forEach(n => {
        if (!n.isRevealed && !n.isFlagged) {
          revealCell(n.r, n.c);
        }
      });
    }
  
    checkWin();
  }
  
  function toggleFlag(r, c) {
    if (isGameOver) return;
    const cell = board[r][c];
    if (cell.isRevealed) return;
  
    if (cell.isFlagged) {
      cell.isFlagged = false;
      cell.el.classList.remove('flagged');
      cell.el.textContent = '';
      flagsPlaced--;
      sfx.unflag();
    } else {
      cell.isFlagged = true;
      cell.el.classList.add('flagged');
      cell.el.textContent = '🚩';
      flagsPlaced++;
      sfx.flag();
    }
  
    updateHUD();
  }
  
  function updateHUD() {
    const remaining = totalMines - flagsPlaced;
    const formatted = remaining < 0
      ? '-' + String(Math.abs(remaining)).padStart(2, '0')
      : String(remaining).padStart(3, '0');
    minesCountEl.textContent = formatted;
    timerEl.textContent = String(seconds).padStart(3, '0');
  }
  
  function checkWin() {
    const totalSafeCells = rows * cols - totalMines;
    if (revealedCount === totalSafeCells) {
      endGame(true);
    }
  }
  
  function endGame(isWin) {
    isGameOver = true;
    clearInterval(timerInterval);
  
    if (isWin) {
      sfx.win();
      faceIcon.textContent = '🥳';
      overlayTitle.textContent = 'СИСТЕМА ЗАЧИЩЕНА';
      overlayTitle.style.color = 'var(--neon-green)';
      overlaySubtitle.textContent = `Время: ${seconds} сек.`;
    } else {
      sfx.boom();
      faceIcon.textContent = '💀';
      overlayCard.classList.add('lose');
      overlayTitle.textContent = 'ДЕТОНАЦИЯ';
      overlayTitle.style.color = 'var(--neon-pink)';
      overlaySubtitle.textContent = 'Вы подорвались на мине';
  
      // Показываем все оставшиеся мины
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = board[r][c];
          if (cell.isMine && !cell.isRevealed && !cell.isFlagged) {
            cell.el.classList.add('mine-shown');
            cell.el.textContent = '💣';
          }
        }
      }
    }
  
    setTimeout(() => {
      overlayEl.classList.remove('hidden');
    }, isWin ? 250 : 600);
  }
  
  // Обработчики кнопок управления
  resetBtn.addEventListener('click', initGame);
  overlayBtn.addEventListener('click', initGame);
  
  diffBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      diffBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentDiff = btn.dataset.diff;
      initGame();
    });
  });
  
  soundToggleBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundToggleBtn.textContent = soundEnabled ? '🔊' : '🔇';
  });
  
  // Запуск при загрузке
  initGame();
  