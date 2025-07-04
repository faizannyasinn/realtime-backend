
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

// Store rooms and game states
const rooms = new Map();
const gameStates = new Map();

// Room management
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('createRoom', (playerName) => {
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const room = {
      code: roomCode,
      host: socket.id,
      players: [{ id: socket.id, name: playerName, ready: true }],
      gameSelected: null,
      gameState: null
    };
    
    rooms.set(roomCode, room);
    socket.join(roomCode);
    socket.emit('roomCreated', { roomCode, isHost: true });
    socket.emit('playerJoined', { players: room.players, roomCode });
  });

  socket.on('joinRoom', ({ roomCode, playerName }) => {
    const room = rooms.get(roomCode);
    if (!room) {
      socket.emit('error', 'Room not found');
      return;
    }
    if (room.players.length >= 2) {
      socket.emit('error', 'Room is full');
      return;
    }

    room.players.push({ id: socket.id, name: playerName, ready: true });
    socket.join(roomCode);
    socket.emit('roomJoined', { roomCode, isHost: false });
    io.to(roomCode).emit('playerJoined', { players: room.players, roomCode });
  });

  socket.on('selectGame', ({ roomCode, gameType }) => {
    const room = rooms.get(roomCode);
    if (!room || room.host !== socket.id) return;

    room.gameSelected = gameType;
    initializeGameState(roomCode, gameType);
    io.to(roomCode).emit('gameSelected', { gameType });
  });

  // Game move handler
  socket.on('makeMove', ({ roomCode, move, gameType }) => {
    const gameState = gameStates.get(roomCode);
    if (!gameState) return;

    const result = processMove(gameState, move, socket.id, gameType);
    if (result.valid) {
      gameStates.set(roomCode, result.gameState);
      io.to(roomCode).emit('gameUpdate', result);
      
      // Start timer for next turn if game is not over and first move was made
      if (!result.gameState.gameOver && result.gameState.firstMoveMade) {
        if (gameType === 'tictactoe') {
          startTurnTimer(roomCode, 4);
        } else if (gameType === 'dotsandboxes') {
          startTurnTimer(roomCode, 5);
        } else if (gameType === 'gomoku') {
          startTurnTimer(roomCode, 5);
        } else if (gameType === 'minichess') {
          startTurnTimer(roomCode, 10);
        } else if (gameType === 'ludo') {
          startTurnTimer(roomCode, 6);
        } else if (gameType === 'checkers') {
          startTurnTimer(roomCode, 5);
        } else if (gameType === 'minesweeper') {
          startTurnTimer(roomCode, 5);
        } else if (gameType === 'memorymatch') {
          startTurnTimer(roomCode, 5);
        } else if (gameType === 'battleship') {
          startTurnTimer(roomCode, 8);
        }
      }
    }
  });

  socket.on('requestGameState', ({ roomCode }) => {
    const gameState = gameStates.get(roomCode);
    if (gameState) {
      socket.emit('gameUpdate', { gameState, valid: true });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Clean up rooms and timers
    for (const [roomCode, room] of rooms.entries()) {
      room.players = room.players.filter(p => p.id !== socket.id);
      if (room.players.length === 0) {
        rooms.delete(roomCode);
        const gameState = gameStates.get(roomCode);
        if (gameState && gameState.timer) {
          clearTimeout(gameState.timer);
        }
        gameStates.delete(roomCode);
      } else {
        io.to(roomCode).emit('playerLeft', { players: room.players });
      }
    }
  });
});

function initializeGameState(roomCode, gameType) {
  const room = rooms.get(roomCode);
  let gameState = {
    currentPlayer: room.players[0].id,
    gameType,
    board: null,
    winner: null,
    gameOver: false,
    players: room.players,
    timer: null,
    timerStarted: false,
    firstMoveMade: false
  };

  switch (gameType) {
    case 'tictactoe':
      gameState.board = Array(9).fill(null);
      break;
    case 'connect4':
      gameState.board = Array(6).fill().map(() => Array(7).fill(null));
      break;
    case 'checkers':
      gameState.board = initializeCheckersBoard();
      break;
    case 'battleship':
      gameState.board = {
        [room.players[0].id]: { ships: [], shots: Array(100).fill(null) },
        [room.players[1].id]: { ships: [], shots: Array(100).fill(null) }
      };
      gameState.phase = 'setup';
      break;
    case 'gomoku':
      gameState.board = Array(15).fill().map(() => Array(15).fill(null));
      break;
    case 'dotsandboxes':
      gameState.board = initializeDotsAndBoxes();
      break;
    case 'ludo':
      gameState.board = initializeLudo();
      break;
    case 'minichess':
      gameState.board = initializeMiniChess();
      break;
    case 'memorymatch':
      gameState.board = initializeMemoryMatch();
      break;
    case 'minesweeper':
      gameState.board = initializeMinesweeper();
      break;
  }

  gameStates.set(roomCode, gameState);
}

function processMove(gameState, move, playerId, gameType) {
  // Game logic implementation for each game type
  switch (gameType) {
    case 'tictactoe':
      return processTicTacToeMove(gameState, move, playerId);
    case 'connect4':
      return processConnect4Move(gameState, move, playerId);
    case 'checkers':
      return processCheckersMove(gameState, move, playerId);
    case 'battleship':
      return processBattleshipMove(gameState, move, playerId);
    case 'gomoku':
      return processGomokuMove(gameState, move, playerId);
    case 'dotsandboxes':
      return processDotsAndBoxesMove(gameState, move, playerId);
    case 'ludo':
      return processLudoMove(gameState, move, playerId);
    case 'minichess':
      return processMiniChessMove(gameState, move, playerId);
    case 'memorymatch':
      return processMemoryMatchMove(gameState, move, playerId);
    case 'minesweeper':
      return processMinesweeperMove(gameState, move, playerId);
    default:
      return { gameState, valid: false };
  }
}

// Game logic implementations
function processTicTacToeMove(gameState, move, playerId) {
  if (gameState.currentPlayer !== playerId || gameState.board[move.index] !== null || gameState.gameOver) {
    return { gameState, valid: false };
  }

  // Clear existing timer
  if (gameState.timer) {
    clearTimeout(gameState.timer);
    gameState.timer = null;
  }

  const playerIndex = gameState.players.findIndex(p => p.id === playerId);
  const symbol = playerIndex === 0 ? 'X' : 'O';
  
  gameState.board[move.index] = symbol;
  gameState.firstMoveMade = true;
  
  // Check for winner
  const winPatterns = [
    [0,1,2], [3,4,5], [6,7,8], // rows
    [0,3,6], [1,4,7], [2,5,8], // columns
    [0,4,8], [2,4,6] // diagonals
  ];
  
  for (const pattern of winPatterns) {
    if (pattern.every(i => gameState.board[i] === symbol)) {
      gameState.winner = playerId;
      gameState.gameOver = true;
      return { gameState, valid: true, winner: playerId };
    }
  }
  
  if (gameState.board.every(cell => cell !== null)) {
    gameState.gameOver = true;
    return { gameState, valid: true, draw: true };
  }
  
  // Switch turns
  const currentIndex = gameState.players.findIndex(p => p.id === playerId);
  gameState.currentPlayer = gameState.players[1 - currentIndex].id;
  
  return { gameState, valid: true };
}

function processConnect4Move(gameState, move, playerId) {
  if (gameState.currentPlayer !== playerId) {
    return { gameState, valid: false };
  }

  const col = move.column;
  const playerIndex = gameState.players.findIndex(p => p.id === playerId);
  const symbol = playerIndex === 0 ? 'R' : 'Y';

  // Find the lowest empty row in the column
  let row = -1;
  for (let r = 5; r >= 0; r--) {
    if (gameState.board[r][col] === null) {
      row = r;
      break;
    }
  }

  if (row === -1) {
    return { gameState, valid: false };
  }

  gameState.board[row][col] = symbol;

  // Check for winner
  if (checkConnect4Winner(gameState.board, row, col, symbol)) {
    gameState.winner = playerId;
    gameState.gameOver = true;
    return { gameState, valid: true, winner: playerId };
  }

  // Switch turns
  const currentIndex = gameState.players.findIndex(p => p.id === playerId);
  gameState.currentPlayer = gameState.players[1 - currentIndex].id;

  return { gameState, valid: true };
}

function checkConnect4Winner(board, row, col, symbol) {
  const directions = [
    [0, 1], [1, 0], [1, 1], [1, -1]
  ];

  for (const [dr, dc] of directions) {
    let count = 1;
    
    // Check positive direction
    for (let i = 1; i < 4; i++) {
      const newRow = row + dr * i;
      const newCol = col + dc * i;
      if (newRow >= 0 && newRow < 6 && newCol >= 0 && newCol < 7 && 
          board[newRow][newCol] === symbol) {
        count++;
      } else {
        break;
      }
    }
    
    // Check negative direction
    for (let i = 1; i < 4; i++) {
      const newRow = row - dr * i;
      const newCol = col - dc * i;
      if (newRow >= 0 && newRow < 6 && newCol >= 0 && newCol < 7 && 
          board[newRow][newCol] === symbol) {
        count++;
      } else {
        break;
      }
    }
    
    if (count >= 4) return true;
  }
  
  return false;
}

// Initialize other game boards
function initializeCheckersBoard() {
  const board = Array(8).fill().map(() => Array(8).fill(null));
  // Set up checkers pieces
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 1) {
        board[row][col] = 'black';
      }
    }
  }
  for (let row = 5; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 1) {
        board[row][col] = 'red';
      }
    }
  }
  return board;
}

function initializeDotsAndBoxes() {
  return {
    gridSize: 4, // 4x4 dots = 3x3 boxes
    horizontalLines: Array(4).fill().map(() => Array(3).fill(false)),
    verticalLines: Array(3).fill().map(() => Array(4).fill(false)),
    boxes: Array(3).fill().map(() => Array(3).fill(null)),
    scores: { player1: 0, player2: 0 },
    completedBoxes: 0,
    totalBoxes: 9
  };
}

function initializeLudo() {
  return {
    players: {
      player1: { pieces: [0, 0], home: 0 },
      player2: { pieces: [0, 0], home: 0 }
    },
    diceValue: 0,
    diceRolled: false,
    winner: null
  };
}

function initializeMiniChess() {
  const board = Array(5).fill().map(() => Array(5).fill(null));
  // Set up mini chess pieces
  board[0] = ['r', 'n', 'k', 'n', 'r'];
  board[1] = ['p', 'p', 'p', 'p', 'p'];
  board[3] = ['P', 'P', 'P', 'P', 'P'];
  board[4] = ['R', 'N', 'K', 'N', 'R'];
  return board;
}

function initializeMemoryMatch() {
  const cards = [];
  for (let i = 1; i <= 8; i++) {
    cards.push(i, i);
  }
  // Shuffle cards
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return {
    cards: cards.map(value => ({ value, flipped: false, matched: false })),
    flippedCards: [],
    scores: { player1: 0, player2: 0 }
  };
}

function initializeMinesweeper() {
  const board = Array(8).fill().map(() => Array(8).fill(null));
  
  // Initialize each cell
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      board[row][col] = {
        isMine: false,
        isRevealed: false,
        neighborCount: 0,
        revealedBy: null
      };
    }
  }
  
  // Place mines randomly
  let minesPlaced = 0;
  while (minesPlaced < 10) {
    const row = Math.floor(Math.random() * 8);
    const col = Math.floor(Math.random() * 8);
    if (!board[row][col].isMine) {
      board[row][col].isMine = true;
      minesPlaced++;
    }
  }
  
  return { board, scores: { player1: 0, player2: 0 } };
}

// Additional game processing functions would be implemented here
function processCheckersMove(gameState, move, playerId) {
  // Checkers logic implementation
  return { gameState, valid: true };
}

function processBattleshipMove(gameState, move, playerId) {
  // Battleship logic implementation
  return { gameState, valid: true };
}

function processGomokuMove(gameState, move, playerId) {
  if (gameState.currentPlayer !== playerId || gameState.gameOver) {
    return { gameState, valid: false };
  }

  // Clear existing timer
  if (gameState.timer) {
    clearTimeout(gameState.timer);
    gameState.timer = null;
  }

  const row = Math.floor(move.index / 15);
  const col = move.index % 15;

  // Check if cell is already occupied
  if (gameState.board[row][col] !== null) {
    return { gameState, valid: false };
  }

  const playerIndex = gameState.players.findIndex(p => p.id === playerId);
  const symbol = playerIndex === 0 ? '●' : '○';
  
  gameState.board[row][col] = symbol;
  gameState.firstMoveMade = true;
  
  // Check for winner (five in a row)
  if (checkGomokuWinner(gameState.board, row, col, symbol)) {
    gameState.winner = playerId;
    gameState.gameOver = true;
    return { gameState, valid: true, winner: playerId, winningLine: findWinningLine(gameState.board, row, col, symbol) };
  }
  
  // Check for draw (board full)
  if (gameState.board.every(row => row.every(cell => cell !== null))) {
    gameState.gameOver = true;
    return { gameState, valid: true, draw: true };
  }
  
  // Switch turns
  const currentIndex = gameState.players.findIndex(p => p.id === playerId);
  gameState.currentPlayer = gameState.players[1 - currentIndex].id;
  
  return { gameState, valid: true };
}

function checkGomokuWinner(board, row, col, symbol) {
  const directions = [
    [0, 1],   // horizontal
    [1, 0],   // vertical
    [1, 1],   // diagonal \
    [1, -1]   // diagonal /
  ];

  for (const [dr, dc] of directions) {
    let count = 1;
    
    // Check positive direction
    for (let i = 1; i < 5; i++) {
      const newRow = row + dr * i;
      const newCol = col + dc * i;
      if (newRow >= 0 && newRow < 15 && newCol >= 0 && newCol < 15 && 
          board[newRow][newCol] === symbol) {
        count++;
      } else {
        break;
      }
    }
    
    // Check negative direction
    for (let i = 1; i < 5; i++) {
      const newRow = row - dr * i;
      const newCol = col - dc * i;
      if (newRow >= 0 && newRow < 15 && newCol >= 0 && newCol < 15 && 
          board[newRow][newCol] === symbol) {
        count++;
      } else {
        break;
      }
    }
    
    if (count >= 5) return true;
  }
  
  return false;
}

function findWinningLine(board, row, col, symbol) {
  const directions = [
    [0, 1],   // horizontal
    [1, 0],   // vertical
    [1, 1],   // diagonal \
    [1, -1]   // diagonal /
  ];

  for (const [dr, dc] of directions) {
    let positions = [{row, col}];
    
    // Check positive direction
    for (let i = 1; i < 5; i++) {
      const newRow = row + dr * i;
      const newCol = col + dc * i;
      if (newRow >= 0 && newRow < 15 && newCol >= 0 && newCol < 15 && 
          board[newRow][newCol] === symbol) {
        positions.push({row: newRow, col: newCol});
      } else {
        break;
      }
    }
    
    // Check negative direction
    for (let i = 1; i < 5; i++) {
      const newRow = row - dr * i;
      const newCol = col - dc * i;
      if (newRow >= 0 && newRow < 15 && newCol >= 0 && newCol < 15 && 
          board[newRow][newCol] === symbol) {
        positions.unshift({row: newRow, col: newCol});
      } else {
        break;
      }
    }
    
    if (positions.length >= 5) {
      return positions.slice(0, 5);
    }
  }
  
  return [];
}

function processDotsAndBoxesMove(gameState, move, playerId) {
  if (gameState.currentPlayer !== playerId || gameState.gameOver) {
    return { gameState, valid: false };
  }

  // Clear existing timer
  if (gameState.timer) {
    clearTimeout(gameState.timer);
    gameState.timer = null;
  }

  const { type, row, col } = move;
  let linePlaced = false;

  // Check if line can be placed
  if (type === 'horizontal') {
    if (row >= 0 && row < gameState.board.horizontalLines.length && 
        col >= 0 && col < gameState.board.horizontalLines[row].length &&
        !gameState.board.horizontalLines[row][col]) {
      gameState.board.horizontalLines[row][col] = true;
      linePlaced = true;
    }
  } else if (type === 'vertical') {
    if (row >= 0 && row < gameState.board.verticalLines.length && 
        col >= 0 && col < gameState.board.verticalLines[row].length &&
        !gameState.board.verticalLines[row][col]) {
      gameState.board.verticalLines[row][col] = true;
      linePlaced = true;
    }
  }

  if (!linePlaced) {
    return { gameState, valid: false };
  }

  gameState.firstMoveMade = true;

  // Check for completed boxes
  const completedBoxes = checkCompletedBoxes(gameState, playerId);
  let boxesCompleted = completedBoxes.length > 0;

  if (boxesCompleted) {
    // Player gets another turn for completing boxes
    const playerIndex = gameState.players.findIndex(p => p.id === playerId);
    const playerKey = playerIndex === 0 ? 'player1' : 'player2';
    gameState.board.scores[playerKey] += completedBoxes.length;
    gameState.board.completedBoxes += completedBoxes.length;
  } else {
    // Switch turns
    const currentIndex = gameState.players.findIndex(p => p.id === playerId);
    gameState.currentPlayer = gameState.players[1 - currentIndex].id;
  }

  // Check if game is over
  if (gameState.board.completedBoxes >= gameState.board.totalBoxes) {
    gameState.gameOver = true;
    const player1Score = gameState.board.scores.player1;
    const player2Score = gameState.board.scores.player2;
    
    if (player1Score > player2Score) {
      gameState.winner = gameState.players[0].id;
    } else if (player2Score > player1Score) {
      gameState.winner = gameState.players[1].id;
    } else {
      gameState.draw = true;
    }
  }

  return { 
    gameState, 
    valid: true, 
    completedBoxes,
    boxesCompleted,
    winner: gameState.winner,
    draw: gameState.draw
  };
}

function checkCompletedBoxes(gameState, playerId) {
  const completedBoxes = [];
  const playerIndex = gameState.players.findIndex(p => p.id === playerId);
  const playerSymbol = playerIndex === 0 ? 'P1' : 'P2';

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      // Skip if box is already claimed
      if (gameState.board.boxes[row][col] !== null) continue;

      // Check if all 4 sides are complete
      const topLine = gameState.board.horizontalLines[row][col];
      const bottomLine = gameState.board.horizontalLines[row + 1][col];
      const leftLine = gameState.board.verticalLines[row][col];
      const rightLine = gameState.board.verticalLines[row][col + 1];

      if (topLine && bottomLine && leftLine && rightLine) {
        gameState.board.boxes[row][col] = playerSymbol;
        completedBoxes.push({ row, col });
      }
    }
  }

  return completedBoxes;
}

function processLudoMove(gameState, move, playerId) {
  if (gameState.currentPlayer !== playerId || gameState.gameOver) {
    return { gameState, valid: false };
  }

  // Clear existing timer
  if (gameState.timer) {
    clearTimeout(gameState.timer);
    gameState.timer = null;
  }

  const { action, pieceIndex } = move;
  const playerIndex = gameState.players.findIndex(p => p.id === playerId);
  const playerKey = playerIndex === 0 ? 'player1' : 'player2';
  
  if (action === 'rollDice') {
    // Roll dice
    gameState.board.diceValue = Math.floor(Math.random() * 6) + 1;
    gameState.board.diceRolled = true;
    gameState.firstMoveMade = true;
    
    // Check if player can move any pieces
    const canMove = canPlayerMove(gameState.board, playerKey, gameState.board.diceValue);
    if (!canMove) {
      // No valid moves, switch turns
      gameState.board.diceRolled = false;
      const currentIndex = gameState.players.findIndex(p => p.id === playerId);
      gameState.currentPlayer = gameState.players[1 - currentIndex].id;
    }
    
    return { gameState, valid: true };
  } else if (action === 'movePiece' && gameState.board.diceRolled) {
    // Move piece
    const pieces = gameState.board.players[playerKey].pieces;
    if (pieceIndex < 0 || pieceIndex >= pieces.length) {
      return { gameState, valid: false };
    }
    
    const currentPosition = pieces[pieceIndex];
    let newPosition = currentPosition + gameState.board.diceValue;
    
    // Handle starting from home
    if (currentPosition === 0 && gameState.board.diceValue === 6) {
      newPosition = 1; // Start position
    } else if (currentPosition === 0) {
      return { gameState, valid: false }; // Can't move without a 6
    }
    
    // Handle winning
    if (newPosition >= 57) {
      newPosition = 57; // Home finish
      gameState.board.players[playerKey].home++;
    }
    
    pieces[pieceIndex] = newPosition;
    gameState.board.diceRolled = false;
    
    // Check for win condition
    if (gameState.board.players[playerKey].home >= 2) {
      gameState.winner = playerId;
      gameState.gameOver = true;
      return { gameState, valid: true, winner: playerId };
    }
    
    // Switch turns (unless rolled a 6)
    if (gameState.board.diceValue !== 6) {
      const currentIndex = gameState.players.findIndex(p => p.id === playerId);
      gameState.currentPlayer = gameState.players[1 - currentIndex].id;
    }
    
    return { gameState, valid: true };
  }
  
  return { gameState, valid: false };
}

function canPlayerMove(board, playerKey, diceValue) {
  const pieces = board.players[playerKey].pieces;
  
  for (let i = 0; i < pieces.length; i++) {
    const currentPosition = pieces[i];
    
    // Can start with a 6
    if (currentPosition === 0 && diceValue === 6) {
      return true;
    }
    
    // Can move if not at home and won't overshoot finish
    if (currentPosition > 0 && currentPosition + diceValue <= 57) {
      return true;
    }
  }
  
  return false;
}

function processMiniChessMove(gameState, move, playerId) {
  if (gameState.currentPlayer !== playerId || gameState.gameOver) {
    return { gameState, valid: false };
  }

  // Clear existing timer
  if (gameState.timer) {
    clearTimeout(gameState.timer);
    gameState.timer = null;
  }

  const { fromRow, fromCol, toRow, toCol } = move;
  
  // Validate move bounds
  if (fromRow < 0 || fromRow >= 5 || fromCol < 0 || fromCol >= 5 ||
      toRow < 0 || toRow >= 5 || toCol < 0 || toCol >= 5) {
    return { gameState, valid: false };
  }

  const piece = gameState.board[fromRow][fromCol];
  const targetPiece = gameState.board[toRow][toCol];
  
  if (!piece) {
    return { gameState, valid: false };
  }

  const playerIndex = gameState.players.findIndex(p => p.id === playerId);
  const isWhitePlayer = playerIndex === 0;
  
  // Check if piece belongs to current player
  const isPieceWhite = piece === piece.toUpperCase();
  if (isWhitePlayer !== isPieceWhite) {
    return { gameState, valid: false };
  }

  // Validate move for piece type
  if (!isValidChessMove(gameState.board, fromRow, fromCol, toRow, toCol)) {
    return { gameState, valid: false };
  }

  gameState.firstMoveMade = true;
  
  // Make the move
  gameState.board[toRow][toCol] = piece;
  gameState.board[fromRow][fromCol] = null;
  
  // Check if king was captured
  if (targetPiece && (targetPiece.toLowerCase() === 'k')) {
    gameState.winner = playerId;
    gameState.gameOver = true;
    return { gameState, valid: true, winner: playerId };
  }
  
  // Switch turns
  const currentIndex = gameState.players.findIndex(p => p.id === playerId);
  gameState.currentPlayer = gameState.players[1 - currentIndex].id;
  
  return { gameState, valid: true };
}

function isValidChessMove(board, fromRow, fromCol, toRow, toCol) {
  const piece = board[fromRow][fromCol].toLowerCase();
  const deltaRow = toRow - fromRow;
  const deltaCol = toCol - fromCol;
  const targetPiece = board[toRow][toCol];
  
  // Can't capture own piece
  if (targetPiece) {
    const isPieceWhite = board[fromRow][fromCol] === board[fromRow][fromCol].toUpperCase();
    const isTargetWhite = targetPiece === targetPiece.toUpperCase();
    if (isPieceWhite === isTargetWhite) {
      return false;
    }
  }

  switch (piece) {
    case 'p': // Pawn
      const isPieceWhite = board[fromRow][fromCol] === board[fromRow][fromCol].toUpperCase();
      const direction = isPieceWhite ? 1 : -1;
      
      if (deltaCol === 0 && !targetPiece) {
        return deltaRow === direction;
      } else if (Math.abs(deltaCol) === 1 && targetPiece) {
        return deltaRow === direction;
      }
      return false;
      
    case 'r': // Rook
      if (deltaRow === 0 || deltaCol === 0) {
        return isPathClear(board, fromRow, fromCol, toRow, toCol);
      }
      return false;
      
    case 'n': // Knight
      return (Math.abs(deltaRow) === 2 && Math.abs(deltaCol) === 1) ||
             (Math.abs(deltaRow) === 1 && Math.abs(deltaCol) === 2);
             
    case 'k': // King
      return Math.abs(deltaRow) <= 1 && Math.abs(deltaCol) <= 1;
      
    default:
      return false;
  }
}

function isPathClear(board, fromRow, fromCol, toRow, toCol) {
  const deltaRow = toRow - fromRow;
  const deltaCol = toCol - fromCol;
  const stepRow = deltaRow === 0 ? 0 : deltaRow / Math.abs(deltaRow);
  const stepCol = deltaCol === 0 ? 0 : deltaCol / Math.abs(deltaCol);
  
  let currentRow = fromRow + stepRow;
  let currentCol = fromCol + stepCol;
  
  while (currentRow !== toRow || currentCol !== toCol) {
    if (board[currentRow][currentCol] !== null) {
      return false;
    }
    currentRow += stepRow;
    currentCol += stepCol;
  }
  
  return true;
}

function getValidMoves(board, row, col) {
  const piece = board[row][col];
  if (!piece) return [];
  
  const validMoves = [];
  
  for (let toRow = 0; toRow < 5; toRow++) {
    for (let toCol = 0; toCol < 5; toCol++) {
      if (toRow === row && toCol === col) continue;
      
      if (isValidChessMove(board, row, col, toRow, toCol)) {
        validMoves.push({ row: toRow, col: toCol });
      }
    }
  }
  
  return validMoves;
}

function processMemoryMatchMove(gameState, move, playerId) {
  if (gameState.currentPlayer !== playerId || gameState.gameOver) {
    return { gameState, valid: false };
  }

  // Clear existing timer
  if (gameState.timer) {
    clearTimeout(gameState.timer);
    gameState.timer = null;
  }

  const { cardIndex } = move;
  const card = gameState.board.cards[cardIndex];
  
  if (!card || card.flipped || card.matched) {
    return { gameState, valid: false };
  }

  gameState.firstMoveMade = true;
  
  // Flip the card
  card.flipped = true;
  gameState.board.flippedCards.push(cardIndex);
  
  // Check if this is the second card flipped
  if (gameState.board.flippedCards.length === 2) {
    const [firstIndex, secondIndex] = gameState.board.flippedCards;
    const firstCard = gameState.board.cards[firstIndex];
    const secondCard = gameState.board.cards[secondIndex];
    
    if (firstCard.value === secondCard.value) {
      // Match found
      firstCard.matched = true;
      secondCard.matched = true;
      
      const playerIndex = gameState.players.findIndex(p => p.id === playerId);
      const playerKey = `player${playerIndex + 1}`;
      
      if (!gameState.board.scores[playerKey]) {
        gameState.board.scores[playerKey] = 0;
      }
      gameState.board.scores[playerKey]++;
      
      gameState.board.flippedCards = [];
      
      // Check if game is complete
      if (gameState.board.cards.every(card => card.matched)) {
        gameState.gameOver = true;
        const player1Score = gameState.board.scores.player1 || 0;
        const player2Score = gameState.board.scores.player2 || 0;
        
        if (player1Score > player2Score) {
          gameState.winner = gameState.players[0].id;
        } else if (player2Score > player1Score) {
          gameState.winner = gameState.players[1].id;
        } else {
          gameState.draw = true;
        }
      }
      
      // Player gets another turn for finding a match
      return { gameState, valid: true, matched: true };
    } else {
      // No match - cards will be flipped back after a delay
      return { gameState, valid: true, noMatch: true };
    }
  }
  
  return { gameState, valid: true };
}

function processMinesweeperMove(gameState, move, playerId) {
  if (gameState.currentPlayer !== playerId || gameState.gameOver) {
    return { gameState, valid: false };
  }

  // Clear existing timer
  if (gameState.timer) {
    clearTimeout(gameState.timer);
    gameState.timer = null;
  }

  const { row, col } = move;
  const cell = gameState.board.board[row][col];
  
  if (cell.isRevealed) {
    return { gameState, valid: false };
  }

  gameState.firstMoveMade = true;
  
  // Reveal the cell
  cell.isRevealed = true;
  cell.revealedBy = playerId;
  
  if (cell.isMine) {
    // Player hit a mine - they lose
    gameState.gameOver = true;
    const currentIndex = gameState.players.findIndex(p => p.id === playerId);
    gameState.winner = gameState.players[1 - currentIndex].id;
    return { gameState, valid: true, hitMine: true, winner: gameState.winner };
  }
  
  // Calculate neighbor mine count
  cell.neighborCount = calculateNeighborMines(gameState.board.board, row, col);
  
  // Add score for revealing safe cell
  const playerIndex = gameState.players.findIndex(p => p.id === playerId);
  const playerKey = `player${playerIndex + 1}`;
  
  if (!gameState.board.scores[playerKey]) {
    gameState.board.scores[playerKey] = 0;
  }
  gameState.board.scores[playerKey]++;
  
  // Check if all safe cells are revealed
  const totalSafeCells = 64 - 10; // 8x8 board with 10 mines
  const revealedSafeCells = gameState.board.board.flat().filter(cell => 
    cell.isRevealed && !cell.isMine
  ).length;
  
  if (revealedSafeCells === totalSafeCells) {
    gameState.gameOver = true;
    const player1Score = gameState.board.scores.player1 || 0;
    const player2Score = gameState.board.scores.player2 || 0;
    
    if (player1Score > player2Score) {
      gameState.winner = gameState.players[0].id;
    } else if (player2Score > player1Score) {
      gameState.winner = gameState.players[1].id;
    } else {
      gameState.draw = true;
    }
  } else {
    // Switch turns
    const currentIndex = gameState.players.findIndex(p => p.id === playerId);
    gameState.currentPlayer = gameState.players[1 - currentIndex].id;
  }
  
  return { gameState, valid: true };
}

function calculateNeighborMines(board, row, col) {
  let count = 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const newRow = row + dr;
      const newCol = col + dc;
      if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
        if (board[newRow][newCol].isMine) count++;
      }
    }
  }
  return count;
}

function processCheckersMove(gameState, move, playerId) {
  if (gameState.currentPlayer !== playerId || gameState.gameOver) {
    return { gameState, valid: false };
  }

  // Clear existing timer
  if (gameState.timer) {
    clearTimeout(gameState.timer);
    gameState.timer = null;
  }

  const { fromRow, fromCol, toRow, toCol } = move;
  const piece = gameState.board[fromRow][fromCol];
  
  if (!piece) {
    return { gameState, valid: false };
  }

  const playerIndex = gameState.players.findIndex(p => p.id === playerId);
  const playerColor = playerIndex === 0 ? 'red' : 'black';
  
  // Check if piece belongs to current player
  if (!piece.includes(playerColor)) {
    return { gameState, valid: false };
  }

  // Validate the move
  if (!isValidCheckersMove(gameState.board, fromRow, fromCol, toRow, toCol, playerColor)) {
    return { gameState, valid: false };
  }

  gameState.firstMoveMade = true;
  
  // Make the move
  gameState.board[toRow][toCol] = piece;
  gameState.board[fromRow][fromCol] = null;
  
  // Handle capturing
  const capturedPiece = checkForCapture(gameState.board, fromRow, fromCol, toRow, toCol);
  
  // Promote to king if reached opposite end
  if ((playerColor === 'red' && toRow === 0) || (playerColor === 'black' && toRow === 7)) {
    gameState.board[toRow][toCol] = playerColor + '-king';
  }
  
  // Check for win condition
  const opponentColor = playerColor === 'red' ? 'black' : 'red';
  const opponentPieces = gameState.board.flat().filter(cell => 
    cell && cell.includes(opponentColor)
  );
  
  if (opponentPieces.length === 0) {
    gameState.winner = playerId;
    gameState.gameOver = true;
    return { gameState, valid: true, winner: playerId };
  }
  
  // Switch turns
  const currentIndex = gameState.players.findIndex(p => p.id === playerId);
  gameState.currentPlayer = gameState.players[1 - currentIndex].id;
  
  return { gameState, valid: true, captured: capturedPiece };
}

function isValidCheckersMove(board, fromRow, fromCol, toRow, toCol, playerColor) {
  const deltaRow = toRow - fromRow;
  const deltaCol = Math.abs(toCol - fromCol);
  const piece = board[fromRow][fromCol];
  
  // Must be diagonal move
  if (Math.abs(deltaRow) !== deltaCol) return false;
  
  // Target cell must be empty
  if (board[toRow][toCol] !== null) return false;
  
  // Regular piece can only move forward
  if (!piece.includes('king')) {
    if (playerColor === 'red' && deltaRow > 0) return false;
    if (playerColor === 'black' && deltaRow < 0) return false;
  }
  
  // Single step move
  if (Math.abs(deltaRow) === 1) return true;
  
  // Jump move (must capture)
  if (Math.abs(deltaRow) === 2) {
    const midRow = fromRow + deltaRow / 2;
    const midCol = fromCol + (toCol - fromCol) / 2;
    const midPiece = board[midRow][midCol];
    
    // Must jump over opponent piece
    if (!midPiece) return false;
    
    const opponentColor = playerColor === 'red' ? 'black' : 'red';
    return midPiece.includes(opponentColor);
  }
  
  return false;
}

function checkForCapture(board, fromRow, fromCol, toRow, toCol) {
  if (Math.abs(toRow - fromRow) === 2) {
    const midRow = fromRow + (toRow - fromRow) / 2;
    const midCol = fromCol + (toCol - fromCol) / 2;
    const capturedPiece = board[midRow][midCol];
    board[midRow][midCol] = null;
    return { row: midRow, col: midCol, piece: capturedPiece };
  }
  return null;
}

function processBattleshipMove(gameState, move, playerId) {
  if (gameState.phase === 'setup') {
    return processBattleshipSetup(gameState, move, playerId);
  } else {
    return processBattleshipShot(gameState, move, playerId);
  }
}

function processBattleshipSetup(gameState, move, playerId) {
  const { ships } = move;
  const playerBoard = gameState.board[playerId];
  
  if (!playerBoard) {
    return { gameState, valid: false };
  }
  
  // Validate ship placement
  if (!validateShipPlacement(ships)) {
    return { gameState, valid: false };
  }
  
  playerBoard.ships = ships;
  
  // Check if both players have placed ships
  const allPlayersReady = gameState.players.every(player => 
    gameState.board[player.id] && gameState.board[player.id].ships.length > 0
  );
  
  if (allPlayersReady) {
    gameState.phase = 'playing';
    gameState.firstMoveMade = true;
  }
  
  return { gameState, valid: true, phase: gameState.phase };
}

function processBattleshipShot(gameState, move, playerId) {
  if (gameState.currentPlayer !== playerId || gameState.gameOver) {
    return { gameState, valid: false };
  }

  // Clear existing timer
  if (gameState.timer) {
    clearTimeout(gameState.timer);
    gameState.timer = null;
  }

  const { row, col } = move;
  const currentIndex = gameState.players.findIndex(p => p.id === playerId);
  const opponentId = gameState.players[1 - currentIndex].id;
  const playerBoard = gameState.board[playerId];
  
  // Check if already shot at this position
  const shotIndex = row * 10 + col;
  if (playerBoard.shots[shotIndex] !== null) {
    return { gameState, valid: false };
  }
  
  // Check if hit
  const opponentBoard = gameState.board[opponentId];
  const hit = opponentBoard.ships.some(ship => 
    ship.positions.some(pos => pos.row === row && pos.col === col)
  );
  
  playerBoard.shots[shotIndex] = hit ? 'hit' : 'miss';
  
  // Check for sunk ships and win condition
  let sunkShip = null;
  if (hit) {
    sunkShip = checkForSunkShip(opponentBoard.ships, playerBoard.shots);
    
    // Check if all ships are sunk
    const allSunk = opponentBoard.ships.every(ship => 
      ship.positions.every(pos => {
        const index = pos.row * 10 + pos.col;
        return playerBoard.shots[index] === 'hit';
      })
    );
    
    if (allSunk) {
      gameState.winner = playerId;
      gameState.gameOver = true;
      return { gameState, valid: true, hit: true, sunk: sunkShip, winner: playerId };
    }
  }
  
  // Switch turns
  gameState.currentPlayer = opponentId;
  
  return { gameState, valid: true, hit, sunk: sunkShip };
}

function validateShipPlacement(ships) {
  if (ships.length !== 5) return false;
  
  const expectedSizes = [5, 4, 3, 3, 2];
  const sizes = ships.map(ship => ship.positions.length).sort((a, b) => b - a);
  
  return JSON.stringify(sizes) === JSON.stringify(expectedSizes);
}

function checkForSunkShip(ships, shots) {
  return ships.find(ship => 
    ship.positions.every(pos => {
      const index = pos.row * 10 + pos.col;
      return shots[index] === 'hit';
    }) && !ship.sunk
  );
}

// Timer functions
function startTurnTimer(roomCode, duration = 3) {
  const gameState = gameStates.get(roomCode);
  if (!gameState || gameState.gameOver) return;

  // Clear existing timer
  if (gameState.timer) {
    clearTimeout(gameState.timer);
  }

  gameState.timerStarted = true;
  gameState.timeLeft = duration;
  
  // Start countdown
  const countdown = setInterval(() => {
    gameState.timeLeft--;
    io.to(roomCode).emit('timerUpdate', { timeLeft: gameState.timeLeft });
    
    if (gameState.timeLeft <= 0) {
      clearInterval(countdown);
    }
  }, 1000);

  // Set timer for auto-skip
  gameState.timer = setTimeout(() => {
    clearInterval(countdown);
    skipTurn(roomCode);
  }, duration * 1000);
}

function skipTurn(roomCode) {
  const gameState = gameStates.get(roomCode);
  if (!gameState || gameState.gameOver) return;

  // Switch to next player
  const currentIndex = gameState.players.findIndex(p => p.id === gameState.currentPlayer);
  gameState.currentPlayer = gameState.players[1 - currentIndex].id;
  
  gameState.timer = null;
  gameState.timerStarted = false;
  
  gameStates.set(roomCode, gameState);
  io.to(roomCode).emit('gameUpdate', { gameState, valid: true, turnSkipped: true });
  
  // Start timer for next player
  if (gameState.gameType === 'tictactoe') {
    startTurnTimer(roomCode, 4);
  } else if (gameState.gameType === 'dotsandboxes') {
    startTurnTimer(roomCode, 5);
  } else if (gameState.gameType === 'gomoku') {
    startTurnTimer(roomCode, 5);
  } else if (gameState.gameType === 'minichess') {
    startTurnTimer(roomCode, 10);
  } else if (gameState.gameType === 'ludo') {
    startTurnTimer(roomCode, 6);
  } else if (gameState.gameType === 'checkers') {
    startTurnTimer(roomCode, 5);
  } else if (gameState.gameType === 'minesweeper') {
    startTurnTimer(roomCode, 5);
  } else if (gameState.gameType === 'memorymatch') {
    startTurnTimer(roomCode, 5);
  } else if (gameState.gameType === 'battleship') {
    startTurnTimer(roomCode, 8);
  }
}

// API endpoint for chess valid moves
app.post('/api/valid-moves', (req, res) => {
  const { board, row, col } = req.body;
  const validMoves = getValidMoves(board, row, col);
  res.json(validMoves);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
