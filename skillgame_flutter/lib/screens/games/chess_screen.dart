import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:skillgame_flutter/providers/game_provider.dart';
import 'package:skillgame_flutter/providers/auth_provider.dart';
import 'package:skillgame_flutter/models/game_model.dart';
import 'package:skillgame_flutter/services/notification_service.dart';
import 'package:skillgame_flutter/utils/theme.dart';
import 'package:skillgame_flutter/widgets/custom_button.dart';
import 'package:skillgame_flutter/widgets/game_result_modal.dart';
import 'game_lobby_screen.dart';

class ChessScreen extends StatefulWidget {
  const ChessScreen({super.key});

  @override
  State<ChessScreen> createState() => _ChessScreenState();
}

class _ChessScreenState extends State<ChessScreen>
    with TickerProviderStateMixin {
  // Game state
  List<List<String>> board = List.generate(8, (i) => List.filled(8, ''));
  String gameStatus = 'Connecting...';
  bool gameEnded = false;
  String? winner;
  bool isMyTurn = false;
  String? myColor; // 'white' or 'black'
  String? roomId;
  String? selectedPiece;
  int? selectedRow;
  int? selectedCol;
  String? _errorMessage;

  // Game management
  GameProvider? _gameProvider;
  bool _isSearchingForOpponent = false;
  bool _hasActiveRoom = false;
  String? myUserId;
  bool _disposed = false;
  bool _isInitialized = false; // Guard against multiple initialization
  int _searchTimeoutSeconds = 0;
  bool _playerSurrendered = false; // Флаг для отслеживания сдачи игрока

  // Timer management
  AnimationController? _timerController;
  int _timeRemaining = 30;
  bool _timerRunning = false;

  @override
  void initState() {
    super.initState();
    _initializeBoard();
    _initializeTimer();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _initGame();
    });
  }

  void _initializeBoard() {
    // Initialize standard chess starting position
    board = [
      ['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'], // Black pieces
      ['♟', '♟', '♟', '♟', '♟', '♟', '♟', '♟'], // Black pawns
      ['', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['♙', '♙', '♙', '♙', '♙', '♙', '♙', '♙'], // White pawns
      ['♖', '♘', '♗', '♕', '♔', '♗', '♘', '♖'], // White pieces
    ];
  }

  void _initializeTimer() {
    _timerController = AnimationController(
      duration: const Duration(seconds: 30),
      vsync: this,
    );
  }

  void _initGame() {
    if (_disposed) return;

    _gameProvider = Provider.of<GameProvider>(context, listen: false);
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    myUserId = authProvider.user?.id;

    if (authProvider.isAuthenticated && myUserId != null) {
      _connectAndSetupGame();
    } else {
      setState(() {
        _errorMessage = 'Please log in to play Chess';
        gameStatus = 'Not authenticated';
      });
    }
  }

  void _connectAndSetupGame() {
    if (_disposed || _gameProvider == null) return;

    // ЗАЩИТА ОТ ПОВТОРНОЙ ИНИЦИАЛИЗАЦИИ
    if (_isInitialized) {
      print('🎯 Chess: Already initialized, skipping setup');
      return;
    }

    print('🎯 Chess: Connecting and setting up game...');
    _isInitialized = true; // Помечаем как инициализированный

    _gameProvider!.connectToWebSocket(
        Provider.of<AuthProvider>(context, listen: false).token!);
    _setupGameListeners();

    // Check for existing active room
    if (_gameProvider!.currentRoom != null &&
        _gameProvider!.currentRoom!.gameType == 'chess') {
      print(
          '🎯 Chess: Found existing active room: ${_gameProvider!.currentRoom!.id}');

      final room = _gameProvider!.currentRoom!;

      setState(() {
        _hasActiveRoom = true;
        roomId = room.id;

        // Если в комнате уже 2 игрока - игра началась, не запускаем поиск
        if (room.players.length >= 2) {
          gameStatus = 'Game in progress...';
          print(
              '🎯 Chess: Game already in progress with ${room.players.length} players');
          return; // НЕ запускаем поиск - игра уже идет
        } else {
          gameStatus = 'Rejoining room, waiting for players...';
        }
      });

      _rejoinActiveRoom();
    } else {
      print('🎯 Chess: No active room found, starting search');
      _startPlayerSearch();
    }
  }

  void _rejoinActiveRoom() {
    if (_disposed || _gameProvider!.currentRoom == null) return;

    final room = _gameProvider!.currentRoom!;
    roomId = room.id;

    print(
        '🎯 Chess: Rejoining room ${room.id} with ${room.players.length} players');

    setState(() {
      _hasActiveRoom = true;

      if (room.players.length >= 2) {
        // Игра уже началась
        gameStatus = 'Game in progress...';
        _isSearchingForOpponent = false;
        print('🎯 Chess: Game already active, not starting search');
      } else {
        // Ждем игроков
        gameStatus = 'Waiting for players...';
        _isSearchingForOpponent = false; // НЕ ищем - уже в комнате
        print('🎯 Chess: In room, waiting for more players');
      }
    });

    // Состояние комнаты будет обновлено через WebSocket события
    // НЕ запускаем поиск - мы уже в комнате
  }

  void _startPlayerSearch() {
    if (_disposed) return;

    print('🎯 Chess: Starting player search...');

    setState(() {
      _isSearchingForOpponent = true;
      gameStatus = 'Searching for opponent...';
      _hasActiveRoom = false;
      _searchTimeoutSeconds = 0;
    });

    _gameProvider!.joinLobby('chess');
    _joinLobbyAndSearch(_gameProvider!);
  }

  void _joinLobbyAndSearch(GameProvider gameProvider) async {
    print('=== CHESS JOINING LOBBY AND SEARCH ===');

    // Leave current room if any
    if (roomId != null) {
      gameProvider.leaveRoom();
    }

    setState(() {
      gameStatus = 'Searching for opponents...';
    });

    gameProvider.joinLobby('chess');

    // Try to find and join an existing room first
    bool joinedExistingRoom =
        await gameProvider.findAndJoinAvailableRoom('chess');

    if (joinedExistingRoom) {
      print('Successfully found/joined chess room');
      setState(() {
        gameStatus = 'Found game, waiting for start...';
        // Поиск остановится в gameStart callback
      });
      return;
    }

    print('No chess room found - starting search countdown');

    _startSearchCountdown();

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Searching for opponent online...'),
        backgroundColor: AppTheme.primaryColor,
        duration: Duration(seconds: 2),
      ),
    );

    print('=== END CHESS JOINING LOBBY AND SEARCH ===');
  }

  void _startSearchCountdown() {
    Future.delayed(const Duration(seconds: 1), () {
      if (mounted && _isSearchingForOpponent && !_disposed) {
        setState(() {
          _searchTimeoutSeconds++;
          if (_searchTimeoutSeconds <= 15) {
            gameStatus =
                'Searching for opponents... (${16 - _searchTimeoutSeconds}s)';
          }
        });

        if (_searchTimeoutSeconds < 15) {
          _startSearchCountdown();
        } else {
          // Timeout - show options
          _showOpponentNotFoundDialog();
        }
      }
    });
  }

  void _showOpponentNotFoundDialog() {
    setState(() {
      _isSearchingForOpponent = false;
      gameStatus = 'No opponents found';
    });

    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          backgroundColor: AppTheme.surfaceColor,
          title: Text(
            'No Opponents Online',
            style: TextStyle(color: AppTheme.textPrimary),
          ),
          content: Text(
            'Currently there are no other players looking for a Chess match.\n\nWould you like to:',
            style: TextStyle(color: AppTheme.textSecondary),
          ),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.of(context).pop();
                _startPlayerSearch(); // Try again
              },
              child: const Text('Try Again'),
            ),
            TextButton(
              onPressed: () {
                Navigator.of(context).pop();
                _createRoom(); // Create a room and wait
              },
              child: const Text('Create Room'),
            ),
            TextButton(
              onPressed: () {
                Navigator.of(context).pop();
                _createBotRoom(); // Play with server bot
              },
              child: const Text('Play vs Bot'),
            ),
          ],
        );
      },
    );
  }

  void _createRoom() {
    final gameProvider = Provider.of<GameProvider>(context, listen: false);
    gameProvider.createRoom('chess', 0.0); // No bet for demo
    setState(() {
      gameStatus = 'Creating room...';
    });
  }

  void _createBotRoom() {
    final gameProvider = Provider.of<GameProvider>(context, listen: false);

    setState(() {
      gameStatus = 'Creating game with bot...';
      _initializeBoard();
      gameEnded = false;
      winner = null;
      isMyTurn = false;
      myColor = null;
      roomId = null;
      selectedPiece = null;
      selectedRow = null;
      selectedCol = null;
    });

    // Create room, server will add bot automatically if no human player joins
    gameProvider.createRoom('chess', 0.0);
  }

  void _setupGameListeners() {
    if (_disposed || _gameProvider == null) return;

    print('🎯 Chess: Setting up game listeners...');

    // Game start handler
    _gameProvider!.webSocketService.onGameStart = (room) {
      print('🎯 Chess: Game started - Room ID: ${room.id}');

      if (!mounted || _disposed) {
        print('🎯 Chess: Ignoring gameStart - screen disposed or unmounted');
        return;
      }

      // УСИЛЕННАЯ ФИЛЬТРАЦИЯ: Игнорируем события если мы не ищем игру активно
      bool shouldAcceptEvent = _isSearchingForOpponent || _hasActiveRoom;

      // Дополнительная проверка: если у нас есть roomId, принимаем только события для этой комнаты
      if (roomId != null) {
        shouldAcceptEvent = shouldAcceptEvent && (roomId == room.id);
      }

      if (!shouldAcceptEvent) {
        print(
            '🎯 Chess: Ignoring gameStart - not actively searching/in room or wrong room (searching: $_isSearchingForOpponent, hasRoom: $_hasActiveRoom, currentRoom: $roomId, eventRoom: ${room.id})');
        return;
      }

      // Дополнительная защита: если мы уже в другой комнате, игнорируем
      if (roomId != null && roomId != room.id && _hasActiveRoom) {
        print(
            '🎯 Chess: Ignoring gameStart from different room: ${room.id} (current active room: $roomId)');
        return;
      }

      setState(() {
        roomId = room.id;
        _isSearchingForOpponent = false; // ВАЖНО: останавливаем поиск
        _hasActiveRoom = true;
        gameEnded = false;

        // Определяем состояние в зависимости от количества игроков
        if (room.players.length >= 2) {
          gameStatus = 'Game started!';
          print('🎯 Chess: Game started with ${room.players.length} players');
        } else {
          gameStatus = 'Waiting for opponent...';
          print(
              '🎯 Chess: Waiting for more players (${room.players.length}/2)');
        }

        // Determine player color and turn
        final players = room.players;
        if (players.isNotEmpty && myUserId != null) {
          final myPlayerIndex =
              players.indexWhere((p) => p.user.id == myUserId);
          if (myPlayerIndex != -1) {
            myColor = myPlayerIndex == 0 ? 'white' : 'black';
            print('🎯 Chess: Player color: $myColor');
          }
        }

        // Update board and turn from server game state
        if (room.gameState?.data != null) {
          final gameData = room.gameState!.data;

          // Update board from server
          if (gameData['board'] != null) {
            final boardData = gameData['board'] as List<dynamic>;
            board = List.generate(8, (row) {
              final rowData = boardData[row] as List<dynamic>;
              return List.generate(8, (col) {
                final piece = rowData[col];
                return _convertServerPieceToUnicode(piece);
              });
            });
            print('🎯 Chess: Board loaded from server state on game start');
          } else {
            // Fallback to initial board if no server state
            _initializeBoard();
            print(
                '🎯 Chess: Using initial board (no server state on game start)');
          }

          // Update turn information from server
          final currentTurnPlayerId = gameData['turn'];
          isMyTurn = currentTurnPlayerId == myUserId;
          if (room.players.length >= 2) {
            gameStatus = isMyTurn ? 'Your turn' : 'Opponent\'s turn';
          }
          print(
              '🎯 Chess: Turn from server on game start - My turn: $isMyTurn, Current player: $currentTurnPlayerId');
        } else {
          // Fallback for no game state
          _initializeBoard();
          isMyTurn = myColor == 'white'; // White goes first in new games
          if (room.players.length >= 2) {
            gameStatus = isMyTurn ? 'Your turn' : 'Opponent\'s turn';
          }
          print(
              '🎯 Chess: No server game state on game start - using defaults');
        }
      });

      if (isMyTurn && room.players.length >= 2) _startMoveTimer();
    };

    // Game update handler with room filtering
    _gameProvider!.webSocketService.onGameUpdate = (room) {
      if (!mounted || _disposed || roomId == null || room.id != roomId) return;

      print('🎯 Chess: Game update for room ${room.id}');

      if (room.gameState?.data != null) {
        final gameData = room.gameState!.data;

        setState(() {
          // Update board from server with detailed logging
          if (gameData['board'] != null) {
            final boardData = gameData['board'] as List<dynamic>;
            print('🎯 Chess: Updating board from server...');

            board = List.generate(8, (row) {
              final rowData = boardData[row] as List<dynamic>;
              return List.generate(8, (col) {
                final piece = rowData[col];
                final unicodePiece = _convertServerPieceToUnicode(piece);
                return unicodePiece;
              });
            });

            // Log updated board state
            print('🎯 Chess: Board updated. Sample pieces:');
            print('🎯 Chess: [0,0]: "${board[0][0]}" [7,0]: "${board[7][0]}"');
            print('🎯 Chess: [0,4]: "${board[0][4]}" [7,4]: "${board[7][4]}"');
          }

          // Update turn information
          final currentTurnPlayerId = gameData['turn'];
          isMyTurn = currentTurnPlayerId == myUserId;

          // Clear selection when turn changes
          if (!isMyTurn) {
            selectedPiece = null;
            selectedRow = null;
            selectedCol = null;
          }

          gameStatus = isMyTurn ? 'Your turn' : 'Opponent\'s turn';
          print(
              '🎯 Chess: Turn update - My turn: $isMyTurn, Current player: $currentTurnPlayerId');
        });

        // Manage move timer
        _stopMoveTimer();
        if (isMyTurn && !room.gameState!.isGameFinished) {
          _startMoveTimer();
        }
      }
    };

    // Game end handler with improved winner detection
    _gameProvider!.webSocketService.onGameEnd = (result) {
      if (!mounted || _disposed) return;

      // ИСПРАВЛЕНО: Проверяем что это наша игра
      final gameRoomId = result['roomId'];
      if (roomId == null || (gameRoomId != null && gameRoomId != roomId)) {
        print(
            '🎯 Chess: Ignoring gameEnd for room $gameRoomId (my room: $roomId)');
        return;
      }

      print('🎯 Chess: Game ended - $result');

      // Determine result type
      String resultType = 'draw';
      final winnerData = result['winner'];

      if (winnerData != null) {
        // Extract winner ID from various possible formats
        String winnerId;
        if (winnerData is String) {
          winnerId = winnerData;
        } else if (winnerData is Map) {
          winnerId = winnerData['user']?['_id'] ??
              winnerData['_id'] ??
              winnerData['socketId'] ??
              '';
        } else {
          winnerId = winnerData.toString();
        }

        if (winnerId == myUserId) {
          resultType = 'win';
        } else if (winnerId.isNotEmpty) {
          resultType = 'lose';
        }
      }

      setState(() {
        gameEnded = true;
        _isSearchingForOpponent = false;
        _hasActiveRoom = false;
      });

      _stopMoveTimer();

      // Show result modal
      GameResultModal.show(
        context: context,
        result: resultType,
        gameType: 'chess',
        gameTitle: 'Chess',
      );
    };

    // Move timer start handler
    _gameProvider!.webSocketService.onMoveTimerStart = (data) {
      if (!mounted || _disposed) return;

      final timerRoomId = data['roomId'];

      // ИСПРАВЛЕНО: Добавляем дополнительные проверки состояния
      if (roomId == null || timerRoomId != roomId) {
        print(
            '🎯 Chess: Ignoring moveTimerStart for room $timerRoomId (my room: $roomId)');
        return;
      }

      // Проверяем что мы не в процессе выхода из игры
      if (!_hasActiveRoom || gameEnded) {
        print(
            '🎯 Chess: Ignoring moveTimerStart - no active room or game ended');
        return;
      }

      if (isMyTurn) {
        print('🎯 Chess: Starting move timer for my turn');
        _startMoveTimer();
      }
    };

    // Error handler
    _gameProvider!.webSocketService.onError = (error) {
      if (!mounted || _disposed) return;

      print('🎯 Chess: WebSocket error - $error');
      setState(() {
        _errorMessage = error;
      });
    };
  }

  void _startMoveTimer() {
    if (_disposed || !isMyTurn) return;

    setState(() {
      _timeRemaining = 30;
      _timerRunning = true;
    });

    _timerController?.reset();
    _timerController?.forward();

    // Start countdown
    _runTimer();
  }

  void _runTimer() {
    if (!_timerRunning || _disposed) return;

    Future.delayed(const Duration(seconds: 1), () {
      if (!mounted || _disposed || !_timerRunning) return;

      setState(() {
        _timeRemaining--;
      });

      if (_timeRemaining <= 0) {
        _stopMoveTimer();
        // Time's up - could force a move or forfeit
        print('🎯 Chess: Time expired for move');
      } else {
        _runTimer();
      }
    });
  }

  void _stopMoveTimer() {
    if (_disposed) return;

    setState(() {
      _timerRunning = false;
    });

    _timerController?.stop();
  }

  void _onSquareTapped(int row, int col) {
    if (!isMyTurn || gameEnded || roomId == null || _disposed) return;

    final piece = board[row][col];
    print(
        '🎯 Chess: Square tapped ($row, $col), piece: "$piece", isMyTurn: $isMyTurn');

    if (selectedPiece == null) {
      // Select a piece if it belongs to current player
      if (piece.isNotEmpty && _isPieceOwnedByPlayer(piece, myColor!)) {
        setState(() {
          selectedPiece = piece;
          selectedRow = row;
          selectedCol = col;
        });
        print('🎯 Chess: Selected piece "$piece" at ($row, $col)');
      } else {
        print(
            '🎯 Chess: Cannot select piece "$piece" - not owned by ${myColor}');
      }
    } else {
      // Try to move the selected piece
      if (selectedRow != null && selectedCol != null) {
        // Validate move before sending
        if (_isValidMoveAttempt(selectedRow!, selectedCol!, row, col)) {
          _makeMove(selectedRow!, selectedCol!, row, col);
        } else {
          print(
              '🎯 Chess: Invalid move attempt from ($selectedRow, $selectedCol) to ($row, $col)');
          setState(() {
            _errorMessage = 'Invalid move. Try a different move.';
          });
        }
      }

      // Clear selection
      setState(() {
        selectedPiece = null;
        selectedRow = null;
        selectedCol = null;
      });
    }
  }

  bool _isPieceOwnedByPlayer(String piece, String color) {
    if (color == 'white') {
      return '♔♕♖♗♘♙'.contains(piece);
    } else {
      return '♚♛♜♝♞♟'.contains(piece);
    }
  }

  String _convertServerPieceToUnicode(dynamic piece) {
    if (piece == null) return '';

    // Server sends piece objects with type and color properties
    if (piece is Map<String, dynamic>) {
      final pieceType = piece['type'] as String?;
      final pieceColor = piece['color'] as String?;

      if (pieceType == null || pieceColor == null) return '';

      // Map server piece types and colors to Unicode symbols
      const Map<String, Map<String, String>> pieceSymbols = {
        'white': {
          'king': '♔',
          'queen': '♕',
          'rook': '♖',
          'bishop': '♗',
          'knight': '♘',
          'pawn': '♙',
        },
        'black': {
          'king': '♚',
          'queen': '♛',
          'rook': '♜',
          'bishop': '♝',
          'knight': '♞',
          'pawn': '♟',
        },
      };

      final symbol = pieceSymbols[pieceColor]?[pieceType] ?? '';
      if (symbol.isEmpty) {
        print('🎯 Chess: Unknown piece type/color: $pieceType/$pieceColor');
      }
      return symbol;
    }

    // Fallback: if piece is already a string (Unicode symbol)
    return piece.toString();
  }

  void _makeMove(int fromRow, int fromCol, int toRow, int toCol) {
    if (!isMyTurn || gameEnded || roomId == null || _disposed) return;

    final piece = board[fromRow][fromCol];
    print(
        '🎯 Chess: Making move "$piece" from ($fromRow, $fromCol) to ($toRow, $toCol)');
    print('🎯 Chess: Current board state around move:');
    print('🎯 Chess: From piece: "${board[fromRow][fromCol]}"');
    print('🎯 Chess: To piece: "${board[toRow][toCol]}"');

    // Send move to server
    if (_gameProvider!.isConnected) {
      _gameProvider!.makeMove(GameMove(
        type: 'chessMove',
        data: {
          'from': {'row': fromRow, 'col': fromCol},
          'to': {'row': toRow, 'col': toCol},
          // Note: promotion handling would be added here for pawn promotion
        },
      ));

      setState(() {
        gameStatus = 'Move sent...';
      });

      _stopMoveTimer();
    } else {
      setState(() {
        _errorMessage = 'Not connected to game server';
      });
    }
  }

  // Basic move validation to prevent obviously invalid moves
  bool _isValidMoveAttempt(int fromRow, int fromCol, int toRow, int toCol) {
    // Don't move to the same square
    if (fromRow == toRow && fromCol == toCol) return false;

    // Don't move off the board
    if (toRow < 0 || toRow >= 8 || toCol < 0 || toCol >= 8) return false;

    // Don't capture your own pieces
    final targetPiece = board[toRow][toCol];
    final sourcePiece = board[fromRow][fromCol];

    if (targetPiece.isNotEmpty && sourcePiece.isNotEmpty) {
      final sourceIsWhite = '♔♕♖♗♘♙'.contains(sourcePiece);
      final targetIsWhite = '♔♕♖♗♘♙'.contains(targetPiece);
      if (sourceIsWhite == targetIsWhite) return false; // Same color
    }

    return true;
  }

  void _backToLobby() {
    if (_disposed) return;

    print('🎯 Chess: Returning to lobby...');

    // ВАЖНО: Очищаем roomId ПЕРВЫМ делом чтобы предотвратить обработку событий
    final oldRoomId = roomId;
    roomId = null;

    // ИСПРАВЛЕНО: Останавливаем поиск и очищаем активные состояния
    setState(() {
      _isSearchingForOpponent = false;
      _searchTimeoutSeconds = 0;
      _hasActiveRoom = false;
    });

    // Останавливаем таймер
    _stopMoveTimer();

    // Покидаем комнату и лобби
    if (oldRoomId != null) {
      print('🎯 Chess: Leaving room: $oldRoomId');
      _gameProvider?.leaveRoom();
    }
    _gameProvider?.leaveLobby('chess');

    // ИСПРАВЛЕНО: Полная очистка состояния
    setState(() {
      _initializeBoard();
      gameStatus = 'Ready to play';
      gameEnded = false;
      winner = null;
      isMyTurn = false;
      myColor = null;
      selectedPiece = null;
      selectedRow = null;
      selectedCol = null;
      _errorMessage = null;
      _timerRunning = false;
      _timeRemaining = 30;
      _hasActiveRoom = false;
      _playerSurrendered = false;
      _isInitialized = false; // Сбрасываем флаг инициализации
    });

    // ИСПРАВЛЕНО: Переходим в лобби игры вместо возврата на главную
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (context) => GameLobbyScreen(
          gameType: 'chess',
          gameTitle: 'Chess',
        ),
      ),
    );
  }

  // Определяет, нужно ли показывать кнопку CANCEL GAME
  bool _shouldShowCancelButton() {
    final isWaiting = _isWaitingForSecondPlayer();
    final hasRoomButNotStarted =
        roomId != null && !_hasTwoPlayers() && !gameEnded;

    // ИСПРАВЛЕНО: Показываем CANCEL если:
    // 1. Идет поиск противника ИЛИ
    // 2. Ждем второго игрока ИЛИ
    // 3. Есть комната, но игра не началась (менее 2 игроков)
    return (_isSearchingForOpponent || isWaiting || hasRoomButNotStarted) &&
        !gameEnded;
  }

  // Определяет, нужно ли показывать кнопку SURRENDER
  bool _shouldShowSurrenderButton() {
    // Показываем SURRENDER если:
    // 1. Есть roomId (комната создана)
    // 2. НЕ идет поиск
    // 3. Игра НЕ закончена
    // 4. И есть ДВА игрока в комнате (игра реально началась)
    return roomId != null &&
        !_isSearchingForOpponent &&
        !gameEnded &&
        _hasTwoPlayers();
  }

  // Проверяет, ждем ли мы второго игрока (есть комната, но только 1 игрок)
  bool _isWaitingForSecondPlayer() {
    // НЕ считаем что ждем если игра уже началась
    if (gameEnded) {
      return false; // Игра уже закончена
    }

    bool isWaiting = roomId != null &&
        _gameProvider?.currentRoom != null &&
        _gameProvider!.currentRoom!.players.length < 2;

    return isWaiting;
  }

  // Проверяет, есть ли два игрока в комнате
  bool _hasTwoPlayers() {
    return _gameProvider?.currentRoom != null &&
        _gameProvider!.currentRoom!.players.length >= 2;
  }

  Widget _buildPlayerNames() {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);

    String playerName = authProvider.user?.username ?? 'You';
    String opponentName = 'Searching...';

    // Правильно определяем состояние игры
    if (_gameProvider?.currentRoom != null &&
        _gameProvider!.currentRoom!.players.length >= 2) {
      final myUserId = authProvider.user?.id;
      final opponent = _gameProvider!.currentRoom!.players.firstWhere(
        (p) => p.user.id != myUserId,
        orElse: () => _gameProvider!.currentRoom!.players.first,
      );
      opponentName = opponent.user.username;
    } else if (_isSearchingForOpponent || roomId == null) {
      opponentName = 'Searching...';
    } else if (gameEnded) {
      opponentName = 'Opponent';
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.surfaceColor,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        '$playerName vs $opponentName',
        style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              color: AppTheme.textPrimary,
              fontWeight: FontWeight.bold,
            ),
        textAlign: TextAlign.center,
      ),
    );
  }

  void _cancelSearch() {
    if (_disposed) return;

    print('🎯 Chess: Cancelling search...');

    // ВАЖНО: Очищаем roomId ПЕРВЫМ делом чтобы предотвратить обработку событий
    final oldRoomId = roomId;
    roomId = null;

    // ИСПРАВЛЕНО: Сначала останавливаем все состояния поиска
    setState(() {
      _isSearchingForOpponent = false;
      _searchTimeoutSeconds = 0;
      _hasActiveRoom = false;
      gameStatus = 'Search cancelled';
    });

    // ВАЖНО: Сначала покинуть комнату, затем лобби
    if (oldRoomId != null) {
      print('🎯 Chess: Leaving room: $oldRoomId');
      _gameProvider?.leaveRoom();
    }

    _gameProvider?.leaveLobby('chess');
    _stopMoveTimer();

    // ИСПРАВЛЕНО: Полный сброс состояния
    setState(() {
      _initializeBoard();
      gameStatus = 'Ready to play';
      gameEnded = false;
      winner = null;
      isMyTurn = false;
      myColor = null;
      selectedPiece = null;
      selectedRow = null;
      selectedCol = null;
      _errorMessage = null;
      _timerRunning = false;
      _timeRemaining = 30;
      _hasActiveRoom = false;
      _playerSurrendered = false;
      _isInitialized = false; // Сбрасываем флаг инициализации
    });

    // ИСПРАВЛЕНО: Переходим в лобби игры вместо возврата на главную
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (context) => GameLobbyScreen(
          gameType: 'chess',
          gameTitle: 'Chess',
        ),
      ),
    );
  }

  void _surrender() {
    // Показать диалог подтверждения
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          backgroundColor: AppTheme.surfaceColor,
          title: Text(
            'Surrender Game',
            style: TextStyle(color: AppTheme.textPrimary),
          ),
          content: Text(
            'Are you sure you want to surrender? You will lose this game.',
            style: TextStyle(color: AppTheme.textSecondary),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text(
                'Cancel',
                style: TextStyle(color: AppTheme.textSecondary),
              ),
            ),
            TextButton(
              onPressed: () {
                Navigator.of(context).pop();
                _confirmSurrender();
              },
              child: Text(
                'Surrender',
                style: TextStyle(color: Colors.red),
              ),
            ),
          ],
        );
      },
    );
  }

  void _confirmSurrender() {
    // Отправить сигнал сдачи на сервер (покидаем игру = сдача)
    if (_gameProvider!.isConnected && roomId != null) {
      _gameProvider!.leaveRoom(); // Используем leaveRoom для сдачи

      setState(() {
        gameStatus = 'You lost (surrendered)';
        gameEnded = true;
        winner = myColor == 'white'
            ? 'black'
            : 'white'; // Противник побеждает при сдаче
      });

      // Показать уведомление
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('You surrendered - Game lost'),
          backgroundColor: Colors.red,
          duration: Duration(seconds: 3),
        ),
      );
    }
  }

  @override
  void dispose() {
    print('🎯 Chess: Disposing...');
    _disposed = true;
    _isInitialized = false; // Сбрасываем флаг инициализации при dispose

    // ВАЖНО: Очищаем roomId ПЕРВЫМ делом чтобы предотвратить обработку событий
    final oldRoomId = roomId;
    roomId = null;

    _stopMoveTimer();
    _timerController?.dispose();

    // ИСПРАВЛЕНО: Очищаем состояния перед выходом
    _isSearchingForOpponent = false;
    _hasActiveRoom = false;

    if (_gameProvider != null) {
      if (oldRoomId != null) {
        print('🎯 Chess: Leaving room $oldRoomId on dispose');
        _gameProvider!.leaveRoom();
      }
      _gameProvider!.leaveLobby('chess');
    }

    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        title: Row(
          children: [
            Image.asset(
              'assets/images/games/chess.jpg',
              width: 24,
              height: 24,
            ),
            const SizedBox(width: 8),
            const Text('Chess'),
          ],
        ),
        backgroundColor: AppTheme.surfaceColor,
        foregroundColor: AppTheme.textPrimary,
        elevation: 0,
        actions: [
          // Move timer in AppBar like CheckersScreen
          if (_timerRunning && isMyTurn) ...[
            Padding(
              padding: const EdgeInsets.only(right: 16),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.timer,
                    color: _timeRemaining <= 10
                        ? AppTheme.errorColor
                        : AppTheme.primaryColor,
                    size: 20,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    '${_timeRemaining}s',
                    style: TextStyle(
                      color: _timeRemaining <= 10
                          ? AppTheme.errorColor
                          : AppTheme.textPrimary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            children: [
              // Error message
              if (_errorMessage != null) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  margin: const EdgeInsets.only(bottom: 20),
                  decoration: BoxDecoration(
                    color: AppTheme.errorColor,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error, color: Colors.white),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _errorMessage!,
                          style: const TextStyle(color: Colors.white),
                        ),
                      ),
                      IconButton(
                        onPressed: () {
                          setState(() {
                            _errorMessage = null;
                          });
                        },
                        icon: const Icon(Icons.close, color: Colors.white),
                      ),
                    ],
                  ),
                ),
              ],

              // Player Names
              _buildPlayerNames(),

              const SizedBox(height: 20),

              // Chess board
              Expanded(
                child: Center(
                  child: AspectRatio(
                    aspectRatio: 1,
                    child: Container(
                      decoration: BoxDecoration(
                        color: AppTheme.surfaceColor,
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.1),
                            blurRadius: 8,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      padding: const EdgeInsets.all(16),
                      child: GridView.builder(
                        gridDelegate:
                            const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 8,
                        ),
                        itemCount: 64,
                        itemBuilder: (context, index) {
                          final row = index ~/ 8;
                          final col = index % 8;
                          final isLightSquare = (row + col) % 2 == 0;
                          final isSelected =
                              selectedRow == row && selectedCol == col;

                          return GestureDetector(
                            onTap: () => _onSquareTapped(row, col),
                            child: Container(
                              decoration: BoxDecoration(
                                color: isSelected
                                    ? AppTheme.primaryColor.withOpacity(0.7)
                                    : isLightSquare
                                        ? const Color(0xFFF0D9B5)
                                        : const Color(0xFFB58863),
                                border: Border.all(
                                  color:
                                      AppTheme.textSecondary.withOpacity(0.3),
                                  width: 0.5,
                                ),
                              ),
                              child: Center(
                                child: Text(
                                  board[row][col],
                                  style: const TextStyle(
                                    fontSize: 24,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 20),

              // Game status (moved below board) - only show during search
              if (_isSearchingForOpponent ||
                  (!gameEnded && !_hasTwoPlayers())) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: AppTheme.surfaceColor,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          if (_isSearchingForOpponent) ...[
                            SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                color: AppTheme.primaryColor,
                                strokeWidth: 2,
                              ),
                            ),
                            const SizedBox(width: 12),
                          ],
                          Expanded(
                            child: Text(
                              gameStatus,
                              style: Theme.of(context)
                                  .textTheme
                                  .headlineSmall
                                  ?.copyWith(
                                    color: AppTheme.textPrimary,
                                    fontWeight: FontWeight.bold,
                                  ),
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ],
                      ),
                      if (_isSearchingForOpponent &&
                          _searchTimeoutSeconds > 5) ...[
                        const SizedBox(height: 12),
                        Text(
                          'This may take a while if no players are online',
                          style:
                              Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: AppTheme.textSecondary,
                                  ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 20),
              ],

              // Action buttons like in CheckersScreen
              if (_shouldShowCancelButton()) ...[
                // Cancel button during search
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton(
                    onPressed: _cancelSearch,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.red,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.close, color: Colors.white),
                        const SizedBox(width: 8),
                        const Text(
                          'CANCEL GAME',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ] else if (_shouldShowSurrenderButton()) ...[
                // Surrender button during active game
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton(
                    onPressed: _surrender,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.orange,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.flag, color: Colors.white),
                        const SizedBox(width: 8),
                        const Text(
                          'SURRENDER',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
