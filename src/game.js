document.addEventListener("DOMContentLoaded", () => {
  const BOARD_SIZE = 12;
  const BOARD = [];
  const BOARD_ELEMENT = document.getElementById("board");
  const TURN_INDICATOR = document.getElementById("turn-indicator");
  const MOVE_LOG = document.getElementById("move-log");
  const RESET_BUTTON = document.getElementById("reset-btn");
  const SWAP_BUTTON = document.getElementById("swap-btn");
  const FULLSCREEN_BUTTON = document.getElementById("fullscreen-btn");
  const BOARD_PANEL = document.getElementById("board-panel");

  const BACK_PIECE_COUNTS = {
    king: 1,
    queen: 2,
    rook: 7,
    bishop: 7,
    knight: 7,
  };
  const BACK_ROWS_PER_SIDE = 2;
  const PAWN_ROWS_PER_SIDE = 2;

  const PIECE_ART = {
    white: {
      king: "datenoderso/wking.png",
      queen: "datenoderso/wqueen.png",
      rook: "datenoderso/wrook.png",
      bishop: "datenoderso/wbishop.png",
      knight: "datenoderso/wknight.png",
      pawn: "datenoderso/wpawn.png",
    },
    black: {
      king: "datenoderso/bking.png",
      queen: "datenoderso/bqueen.png",
      rook: "datenoderso/blackrook.png",
      bishop: "datenoderso/bbishop.png",
      knight: "datenoderso/bknigh.png",
      pawn: "datenoderso/bpawn.png",
    },
  };

  let selected = null;
  let legalTargets = [];
  let turn = "white";
  let isFlipped = false;
  let moveCount = 1;

  function createPiece(type, color) {
    return { type, color, hasMoved: false };
  }

  function initBoard() {
    BOARD.length = 0;
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      BOARD[row] = new Array(BOARD_SIZE).fill(null);
    }

    const blackBackRows = Array.from(
      { length: BACK_ROWS_PER_SIDE },
      (_, idx) => idx
    );
    const whiteBackRows = Array.from(
      { length: BACK_ROWS_PER_SIDE },
      (_, idx) => BOARD_SIZE - 1 - idx
    );
    const blackPawnRows = Array.from(
      { length: PAWN_ROWS_PER_SIDE },
      (_, idx) => BACK_ROWS_PER_SIDE + idx
    );
    const whitePawnRows = Array.from(
      { length: PAWN_ROWS_PER_SIDE },
      (_, idx) => BOARD_SIZE - BACK_ROWS_PER_SIDE - 1 - idx
    );

    populateBackRows("black", blackBackRows);
    populatePawnRows("black", blackPawnRows);

    populateBackRows("white", whiteBackRows);
    populatePawnRows("white", whitePawnRows);
  }

  function buildBackPiecePool() {
    const pool = [];
    Object.entries(BACK_PIECE_COUNTS).forEach(([type, count]) => {
      for (let i = 0; i < count; i += 1) {
        pool.push(type);
      }
    });
    return pool;
  }

  function shuffle(array) {
    const copy = array.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function populateBackRows(color, rowIndices) {
    const pool = shuffle(buildBackPiecePool());
    let index = 0;
    rowIndices.forEach((row) => {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        const type = pool[index];
        BOARD[row][col] = createPiece(type, color);
        index += 1;
      }
    });
  }

  function populatePawnRows(color, rowIndices) {
    rowIndices.forEach((row) => {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        BOARD[row][col] = createPiece("pawn", color);
      }
    });
  }

  function inBounds(row, col) {
    return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
  }

  function squareColorFromIndex(row, col) {
    return (row + col) % 2 === 0 ? "light" : "dark";
  }

  function coordToNotation(row, col) {
    const file = String.fromCharCode(97 + col);
    const rank = BOARD_SIZE - row;
    return `${file}${rank}`;
  }

  function describePiece(piece) {
    switch (piece.type) {
      case "king":
        return "K";
      case "queen":
        return "Q";
      case "rook":
        return "R";
      case "bishop":
        return "B";
      case "knight":
        return "N";
      default:
        return "";
    }
  }

  function getPawnMoves(row, col, piece) {
    const moves = [];
    const dir = piece.color === "white" ? -1 : 1;
    const startRow = piece.color === "white" ? BOARD_SIZE - 2 : 1;
    const oneStepRow = row + dir;

    if (inBounds(oneStepRow, col) && !BOARD[oneStepRow][col]) {
      moves.push({ row: oneStepRow, col, type: "move" });

      const twoStepRow = row + dir * 2;
      if (row === startRow && !BOARD[twoStepRow][col]) {
        moves.push({ row: twoStepRow, col, type: "move" });
      }
    }

    [-1, 1].forEach((offset) => {
      const targetRow = row + dir;
      const targetCol = col + offset;
      if (!inBounds(targetRow, targetCol)) {
        return;
      }
      const occupant = BOARD[targetRow][targetCol];
      if (occupant && occupant.color !== piece.color) {
        moves.push({ row: targetRow, col: targetCol, type: "capture" });
      }
    });

    return moves;
  }

  function collectSlidingMoves(row, col, deltas, piece) {
    const moves = [];
    deltas.forEach(([rowDelta, colDelta]) => {
      let nextRow = row + rowDelta;
      let nextCol = col + colDelta;
      while (inBounds(nextRow, nextCol)) {
        const occupant = BOARD[nextRow][nextCol];
        if (!occupant) {
          moves.push({ row: nextRow, col: nextCol, type: "move" });
        } else {
          if (occupant.color !== piece.color) {
            moves.push({ row: nextRow, col: nextCol, type: "capture" });
          }
          break;
        }
        nextRow += rowDelta;
        nextCol += colDelta;
      }
    });
    return moves;
  }

  function getMovesForPiece(row, col) {
    const piece = BOARD[row][col];
    if (!piece) {
      return [];
    }

    switch (piece.type) {
      case "pawn":
        return getPawnMoves(row, col, piece);
      case "knight": {
        const deltas = [
          [2, 1],
          [1, 2],
          [-1, 2],
          [-2, 1],
          [-2, -1],
          [-1, -2],
          [1, -2],
          [2, -1],
        ];
        return deltas
          .map(([dr, dc]) => ({ row: row + dr, col: col + dc }))
          .filter(({ row: r, col: c }) => inBounds(r, c))
          .map(({ row: r, col: c }) => {
            const occupant = BOARD[r][c];
            if (!occupant) {
              return { row: r, col: c, type: "move" };
            }
            if (occupant.color !== piece.color) {
              return { row: r, col: c, type: "capture" };
            }
            return null;
          })
          .filter(Boolean);
      }
      case "bishop":
        return collectSlidingMoves(
          row,
          col,
          [
            [1, 1],
            [1, -1],
            [-1, 1],
            [-1, -1],
          ],
          piece
        );
      case "rook":
        return collectSlidingMoves(
          row,
          col,
          [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ],
          piece
        );
      case "queen":
        return [
          ...collectSlidingMoves(
            row,
            col,
            [
              [1, 1],
              [1, -1],
              [-1, 1],
              [-1, -1],
            ],
            piece
          ),
          ...collectSlidingMoves(
            row,
            col,
            [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ],
            piece
          ),
        ];
      case "king": {
        const kingSteps = [
          [1, 0],
          [1, 1],
          [0, 1],
          [-1, 1],
          [-1, 0],
          [-1, -1],
          [0, -1],
          [1, -1],
        ];
        return kingSteps
          .map(([dr, dc]) => ({ row: row + dr, col: col + dc }))
          .filter(({ row: r, col: c }) => inBounds(r, c))
          .map(({ row: r, col: c }) => {
            const occupant = BOARD[r][c];
            if (!occupant) {
              return { row: r, col: c, type: "move" };
            }
            if (occupant.color !== piece.color) {
              return { row: r, col: c, type: "capture" };
            }
            return null;
          })
          .filter(Boolean);
      }
      default:
        return [];
    }
  }

  function renderBoard() {
    if (!BOARD_ELEMENT) {
      return;
    }
    BOARD_ELEMENT.innerHTML = "";
    const rows = Array.from({ length: BOARD_SIZE }, (_, idx) => idx);
    const cols = Array.from({ length: BOARD_SIZE }, (_, idx) => idx);
    const rowOrder = isFlipped ? rows : rows.slice().reverse();
    const colOrder = isFlipped ? cols.slice().reverse() : cols;

    rowOrder.forEach((rowIndex) => {
      colOrder.forEach((colIndex) => {
        const square = document.createElement("button");
        square.className = "square " + squareColorFromIndex(rowIndex, colIndex);
        square.dataset.row = String(rowIndex);
        square.dataset.col = String(colIndex);

        if (
          selected &&
          selected.row === rowIndex &&
          selected.col === colIndex
        ) {
          square.classList.add("highlight");
        }

        const candidate = legalTargets.find(
          (target) => target.row === rowIndex && target.col === colIndex
        );
        if (candidate) {
          square.classList.add(
            candidate.type === "capture" ? "capture-option" : "move-option"
          );
        }

        const piece = BOARD[rowIndex][colIndex];
        if (piece) {
          const img = document.createElement("img");
          img.alt = `${piece.color} ${piece.type}`;
          img.src = PIECE_ART[piece.color][piece.type];
          square.appendChild(img);
        }

        square.addEventListener("click", function () {
          handleSquareClick(rowIndex, colIndex);
        });

        BOARD_ELEMENT.appendChild(square);
      });
    });
  }

  function handleSquareClick(row, col) {
    const piece = BOARD[row][col];

    if (selected && row === selected.row && col === selected.col) {
      selected = null;
      legalTargets = [];
      renderBoard();
      return;
    }

    if (
      selected &&
      legalTargets.some((target) => target.row === row && target.col === col)
    ) {
      movePiece(selected.row, selected.col, row, col);
      return;
    }

    if (piece && piece.color === turn) {
      selected = { row, col };
      legalTargets = getMovesForPiece(row, col);
    } else {
      selected = null;
      legalTargets = [];
    }
    renderBoard();
  }

  function movePiece(fromRow, fromCol, toRow, toCol) {
    const piece = BOARD[fromRow][fromCol];
    const target = BOARD[toRow][toCol];

    BOARD[toRow][toCol] = piece;
    BOARD[fromRow][fromCol] = null;
    piece.hasMoved = true;

    const promotionRank = piece.color === "white" ? 0 : BOARD_SIZE - 1;
    if (piece.type === "pawn" && toRow === promotionRank) {
      BOARD[toRow][toCol] = createPiece("queen", piece.color);
    }

    logMove(piece, fromRow, fromCol, toRow, toCol, Boolean(target));

    turn = turn === "white" ? "black" : "white";
    selected = null;
    legalTargets = [];
    updateStatus();
    renderBoard();
  }

  function logMove(piece, fromRow, fromCol, toRow, toCol, captured) {
    const notation = (describePiece(piece) || "") + coordToNotation(
      fromRow,
      fromCol
    ) + (captured ? "x" : "-") + coordToNotation(toRow, toCol);

    if (turn === "white") {
      const li = document.createElement("li");
      li.textContent = moveCount + ". " + notation;
      MOVE_LOG.appendChild(li);
    } else {
      let li = MOVE_LOG.lastElementChild;
      if (!li) {
        li = document.createElement("li");
        li.textContent = moveCount + ". ...";
        MOVE_LOG.appendChild(li);
      }
      li.textContent = li.textContent + "   " + notation;
      moveCount += 1;
    }
  }

  function updateStatus() {
    TURN_INDICATOR.textContent =
      turn.charAt(0).toUpperCase() + turn.slice(1) + " to move";
  }

  function resetGame() {
    initBoard();
    selected = null;
    legalTargets = [];
    turn = "white";
    moveCount = 1;
    MOVE_LOG.innerHTML = "";
    updateStatus();
    renderBoard();
  }

  function flipBoard() {
    isFlipped = !isFlipped;
    renderBoard();
  }

  function toggleFullscreen() {
    const target = BOARD_PANEL || document.documentElement;
    if (!document.fullscreenElement && target.requestFullscreen) {
      target.requestFullscreen();
    } else if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen();
    }
  }

  function updateFullscreenButton() {
    if (!FULLSCREEN_BUTTON) {
      return;
    }
    FULLSCREEN_BUTTON.textContent = document.fullscreenElement
      ? "Exit Fullscreen"
      : "Fullscreen";
  }

  RESET_BUTTON.addEventListener("click", resetGame);
  SWAP_BUTTON.addEventListener("click", flipBoard);
  FULLSCREEN_BUTTON.addEventListener("click", toggleFullscreen);
  document.addEventListener("fullscreenchange", updateFullscreenButton);

  initBoard();
  updateStatus();
  renderBoard();
  updateFullscreenButton();
});

