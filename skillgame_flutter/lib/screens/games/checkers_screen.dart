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

class CheckersScreen extends StatefulWidget {
  const CheckersScreen({super.key});

  @override
  State<CheckersScreen> createState() => _CheckersScreenState();
}

class _CheckersScreenState extends State<CheckersScreen> {
  // Checkers board represented as 64-element array (server format)
  List<String> board = List.filled(64, '');
  String gameStatus = 'Connecting...';
  bool gameEnded = false;
  String? winner;
  bool isMyTurn = false;
  int? myPlayerIndex; // 0 or 1 (0 = red/bottom, 1 = black/top)
  String? roomId;
  String? selectedPiece;
  int? selectedIndex;
  String? _errorMessage;
  GameProvider? _gameProvider;
  bool _isSearchingForOpponent = false;
  int _searchTimeoutSeconds = 0;
  bool _canCancelSearch = false; // Можно ли отменить поиск

  // Move timer variables
  int _moveTimeRemaining = 0;
  Timer? _moveTimer;
  bool _showMoveTimer = false;
  String? _currentTurnPlayerId;

  @override
  void initState() {
    super.initState();
    _initializeBoard();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _initGame();
    });
  }

  void _initializeBoard() {
    // Initialize standard checkers starting position as 64-element array
    board = List.filled(64, '');

    // Place pieces according to server logic
    for (int i = 0; i < 64; i++) {
      final row = i ~/ 8;
      final col = i % 8;

      // Only on dark squares (odd sum of row+col)
      if ((row + col) % 2 == 1) {
        if (row >= 5) {
          board[i] = '🔴'; // Player 0 (red) pieces
        } else if (row <= 2) {
          board[i] = '⚫'; // Player 1 (black) pieces
        }
      }
    }
  }

  void _initGame() {
    _gameProvider = Provider.of<GameProvider>(context, listen: false);
    final authProvider = Provider.of<AuthProvider>(context, listen: false);

    if (authProvider.isAuthenticated) {
      // Подключаемся к WebSocket и настраиваем слушатели
      _gameProvider!.connectToWebSocket(authProvider.token!);
      _setupGameListeners(_gameProvider!);

      // ИСПРАВЛЕНО: Проверяем есть ли уже активная комната перед поиском
      final currentRoom = _gameProvider!.currentRoom;
      if (!gameEnded &&
          currentRoom != null &&
          currentRoom.players.length >= 2) {
        // Уже есть активная комната с игроками - НЕ запускаем новый поиск
        print(
            '🎮 CHECKERS INIT: Found existing room ${currentRoom.id} with ${currentRoom.players.length} players');
        setState(() {
          roomId = currentRoom.id;
          gameStatus = 'Joining existing game...';
          _isSearchingForOpponent = false;
          _canCancelSearch = false;
        });

        // Настраиваем игру с существующей комнатой
        _setupExistingRoom(currentRoom);
      } else if (!gameEnded &&
          currentRoom != null &&
          currentRoom.players.length == 1) {
        // Есть комната но только 1 игрок - продолжаем ожидание
        print(
            '🎮 CHECKERS INIT: Found existing room ${currentRoom.id} with 1 player - waiting for more');
        setState(() {
          roomId = currentRoom.id;
          gameStatus = 'Waiting for second player...';
          _isSearchingForOpponent = true;
          _canCancelSearch = true;
        });
      } else if (!gameEnded) {
        // Нет активной комнаты - начинаем поиск
        print('🎮 CHECKERS INIT: No active room - starting search');
        setState(() {
          gameStatus = 'Looking for opponent...';
          _isSearchingForOpponent = true;
          _canCancelSearch = true;
        });

        // Присоединяемся к лобби и ищем игру
        _gameProvider!.joinLobby('checkers');
        _joinLobbyAndSearch(_gameProvider!);
      } else {
        setState(() {
          gameStatus = 'Game completed';
          _isSearchingForOpponent = false;
        });
      }

      // Show error if not connected after timeout
      Future.delayed(const Duration(seconds: 5), () {
        if (!_gameProvider!.isConnected && !gameEnded) {
          setState(() {
            _errorMessage =
                'Unable to connect to game server. Please check your internet connection.';
            gameStatus = 'Connection failed';
          });
        }
      });
    } else {
      setState(() {
        _errorMessage = 'Please log in to play games';
        gameStatus = 'Not authenticated';
      });
    }
  }

  void _setupExistingRoom(Room room) {
    print('🎮 CHECKERS SETUP: Setting up existing room ${room.id}');

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final myUserId = authProvider.user?.id;

    setState(() {
      roomId = room.id;
      _initializeBoard();
      gameEnded = false;
      _errorMessage = null;

      // Определяем индекс игрока
      if (room.players.length >= 2) {
        // Найти мой индекс среди игроков
        int myIndex = -1;
        for (int i = 0; i < room.players.length; i++) {
          if (room.players[i].user.id == myUserId) {
            myIndex = i;
            break;
          }
        }

        if (myIndex >= 0) {
          myPlayerIndex = myIndex;
          print('🎮 CHECKERS SETUP: My player index = $myPlayerIndex');

          // Проверяем состояние игры
          if (room.gameState != null) {
            final gameData = room.gameState!.data;

            // Загружаем доску
            if (gameData['board'] != null) {
              final boardData = gameData['board'] as List<dynamic>;
              board = List.generate(64, (i) {
                final piece = boardData[i];
                return _convertServerPieceToString(piece);
              });
              print('🎮 CHECKERS SETUP: Loaded board');
            }

            // Проверяем чей ход
            final currentTurnPlayerId = gameData['turn'];
            isMyTurn = currentTurnPlayerId == myUserId;
            gameStatus = isMyTurn ? 'Your turn' : 'Opponent\'s turn';

            print(
                '🎮 CHECKERS SETUP: Current turn = $currentTurnPlayerId, my turn = $isMyTurn');
          } else {
            // Новая игра
            isMyTurn = myPlayerIndex == 0; // Player 0 ходит первым
            gameStatus = isMyTurn ? 'Your turn' : 'Opponent\'s turn';
          }
        }
      } else {
        // Только один игрок - ждем второго
        myPlayerIndex = 0;
        isMyTurn = false;
        gameStatus = 'Waiting for second player...';
      }
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
      myPlayerIndex = null;
      roomId = null;
      selectedPiece = null;
      selectedIndex = null;
    });

    // Create room, server will add bot automatically if no human player joins
    gameProvider.createRoom('checkers', 0.0);
  }

  void _setupGameListeners(GameProvider gameProvider) {
    // Listen for game start - НЕ переопределяем callback GameProvider!
    // Сохраняем существующий callback GameProvider
    final originalOnGameStart = gameProvider.webSocketService.onGameStart;

    gameProvider.webSocketService.onGameStart = (room) {
      print('=== CHECKERS GAME START CALLBACK ===');
      print('Room ID: ${room.id}');
      print('Mounted: $mounted');

      // Сначала вызываем оригинальный callback GameProvider
      originalOnGameStart?.call(room);

      // Потом наш локальный callback
      if (mounted) {
        print('=== UPDATING CHECKERS STATE ===');
        setState(() {
          roomId = room.id; // КРИТИЧНО: устанавливаем roomId
          _initializeBoard();
          gameEnded = false;
          _errorMessage = null;

          // ИСПРАВЛЕНО: Останавливаем поиск ТОЛЬКО если есть 2+ игроков
          if (room.players.length >= 2) {
            _isSearchingForOpponent = false;
            _searchTimeoutSeconds = 0;
            print('CHECKERS: STOPPING SEARCH - 2+ players found');
          } else {
            print(
                'CHECKERS: KEEPING SEARCH - only ${room.players.length} player(s), waiting for more');
          }

          // Determine player index based on position in room
          final players = room.players;
          print('Players count: ${players.length}');
          if (players.isNotEmpty) {
            final authProvider =
                Provider.of<AuthProvider>(context, listen: false);
            final myUserId = authProvider.user?.id;
            print('My user ID: $myUserId');

            // ИСПРАВЛЕНО: более надежное определение индекса
            if (players.length >= 2) {
              // Найти мой индекс среди игроков
              int myIndex = -1;
              for (int i = 0; i < players.length; i++) {
                if (players[i].user.id == myUserId) {
                  myIndex = i;
                  break;
                }
              }

              if (myIndex >= 0) {
                myPlayerIndex = myIndex;
                isMyTurn = myPlayerIndex == 0; // Player 0 goes first
                print('My player index: $myPlayerIndex');
                print('Is my turn: $isMyTurn');

                // ВАЖНО: Игра началась с двумя игроками
                gameStatus = isMyTurn ? 'Your turn' : 'Opponent\'s turn';
                print('CHECKERS GAME STARTED WITH 2 PLAYERS');
              } else {
                // Fallback если не нашли игрока
                myPlayerIndex = 0;
                isMyTurn = true;
                gameStatus = 'Your turn';
                print('Fallback: set as player 0');
              }
            } else if (players.length == 1) {
              // Только один игрок - ждем второго
              myPlayerIndex = 0;
              isMyTurn = false; // НЕ можем ходить пока нет второго игрока
              gameStatus = 'Waiting for second player...';
              print('WARNING: gameStart called with only 1 player');
            }
          }
        });

        print('=== CHECKERS STATE UPDATED ===');
        print('Final roomId: $roomId');
        print('Final isMyTurn: $isMyTurn');
        print('Final myPlayerIndex: $myPlayerIndex');
        print('Final gameStatus: $gameStatus');
        print('Final _isSearchingForOpponent: $_isSearchingForOpponent');
      } else {
        print('=== CHECKERS NOT MOUNTED ===');
      }
    };

    // Listen for move timer events with room ID filtering
    gameProvider.webSocketService.onMoveTimerStart = (data) {
      if (mounted && roomId != null) {
        final timeLimit = data['timeLimit'] as int;
        final currentPlayerId = data['currentPlayerId'] as String;
        final authProvider = Provider.of<AuthProvider>(context, listen: false);
        final isMyTurn = currentPlayerId == authProvider.user?.id;

        print(
            '⏰ CHECKERS TIMER START for $currentPlayerId in current room: $roomId');

        setState(() {
          _moveTimeRemaining = (timeLimit / 1000).round();
          _currentTurnPlayerId = currentPlayerId;
          _showMoveTimer = isMyTurn; // Показываем таймер только для своего хода
        });

        _startMoveTimer();
      }
    };

    gameProvider.webSocketService.onMoveTimerWarning = (data) {
      if (mounted && roomId != null) {
        final timeRemaining = data['timeRemaining'] as int;
        final currentPlayerId = data['currentPlayerId'] as String;
        final authProvider = Provider.of<AuthProvider>(context, listen: false);

        // ИСПРАВЛЕНО: Обрабатываем предупреждения только если это наш ход
        if (currentPlayerId == authProvider.user?.id) {
          setState(() {
            _moveTimeRemaining = (timeRemaining / 1000).round();
          });
          print(
              '⚠️ CHECKERS TIMER WARNING: ${_moveTimeRemaining}s remaining for my turn');
        }
      }
    };

    // Listen for game updates - с фильтрацией по roomId
    gameProvider.webSocketService.onGameUpdate = (room) {
      print('=== CHECKERS GAME UPDATE CALLBACK ===');
      print('Room ID from update: ${room.id}');
      print('Local roomId before: $roomId');
      print('Players in room: ${room.players.length}');
      print('_isSearchingForOpponent before: $_isSearchingForOpponent');

      // ИСПРАВЛЕНО: Обрабатываем только обновления для СВОЕЙ комнаты
      if (roomId != null && roomId != room.id) {
        print(
            '⚠️ CHECKERS: Ignoring gameUpdate for foreign room ${room.id} (my room: $roomId)');
        return;
      }

      if (room.gameState != null) {
        print(
            '🎮 CHECKERS GAME UPDATE: Processing gameState for room ${room.id}');
        print(
            '🎮 CHECKERS GAME UPDATE: gameState.data = ${room.gameState!.data}');

        setState(() {
          // Останавливаем поиск если еще активен
          if (_isSearchingForOpponent) {
            print('🔍 CHECKERS GAME UPDATE: Stopping search during gameUpdate');
            _isSearchingForOpponent = false;
          }

          final gameData = room.gameState!.data;
          print('🎯 CHECKERS BOARD UPDATE: gameData = $gameData');

          // Update board from server (64-element array)
          if (gameData['board'] != null) {
            final boardData = gameData['board'] as List<dynamic>;
            final newBoard = List.generate(64, (i) {
              final piece = boardData[i];
              return _convertServerPieceToString(piece);
            });
            print('🎯 CHECKERS BOARD UPDATE: Board updated');
            board = newBoard;
          } else {
            print('⚠️ CHECKERS BOARD UPDATE: No board data in gameState');
          }

          // Update turn - server sends player ID, need to check if it's my turn
          final currentTurnPlayerId = gameData['turn'];
          final authProvider =
              Provider.of<AuthProvider>(context, listen: false);
          final myUserId = authProvider.user?.id;
          isMyTurn = currentTurnPlayerId == myUserId;

          if (room.gameState!.isGameFinished) {
            // КРИТИЧНО: Остановить таймер при завершении игры
            _stopMoveTimer();
            setState(() {
              _showMoveTimer = false;
            });

            gameEnded = true;
            final winnerData = gameData['winner'];

            // Determine winner and show modal
            String resultType;
            String resultMessage;

            if (winnerData != null) {
              if (winnerData == myUserId) {
                winner = myPlayerIndex == 0 ? 'red' : 'black';
                gameStatus = 'You win!';
                resultType = 'win';
                resultMessage =
                    'Congratulations! You won the checkers match. Well played!';
              } else {
                winner = myPlayerIndex == 0 ? 'black' : 'red';
                gameStatus = 'Opponent wins!';
                resultType = 'lose';
                resultMessage =
                    'Better luck next time! Keep practicing to improve.';
              }
            } else {
              winner = null;
              gameStatus = 'Draw!';
              resultType = 'draw';
              resultMessage = 'The match ended in a draw. Well played!';
            }

            // Show modal instead of notification
            if (roomId != null) {
              Future.delayed(const Duration(milliseconds: 500), () {
                if (mounted) {
                  GameResultModal.show(
                    context: context,
                    result: resultType,
                    gameType: 'checkers',
                    gameTitle: 'Checkers',
                    customMessage: resultMessage,
                    autoReturnSeconds: 5,
                  );
                }
              });
            }
          } else {
            gameStatus = isMyTurn ? 'Your turn' : 'Opponent\'s turn';

            // Show your turn notification if roomId is available
            if (isMyTurn && roomId != null) {
              NotificationService.showYourTurn(
                gameType: 'Checkers',
                roomId: roomId!,
              );
            }
          }
        });
      }

      print('Local roomId after: $roomId');
      print('=== END CHECKERS GAME UPDATE ===');
    };

    // Listen for game end with room filtering
    gameProvider.webSocketService.onGameEnd = (result) {
      print('🎮 CHECKERS GAME END: Received gameEnd event');
      print('🎮 CHECKERS GAME END: Result = $result');
      print('🎮 CHECKERS GAME END: Current gameEnded = $gameEnded');
      print('🎮 CHECKERS GAME END: Current roomId = $roomId');

      // ИСПРАВЛЕНО: НЕ игнорируем если gameEnded уже true - обрабатываем событие
      // Проверяем что это завершение нашей игры
      if (roomId == null) {
        print('🎮 CHECKERS GAME END: No roomId - ignoring');
        return;
      }

      if (!mounted) {
        print('🎮 CHECKERS GAME END: Not mounted - ignoring');
        return;
      }

      setState(() {
        // КРИТИЧНО: Останавливаем весь поиск и таймер при завершении игры
        print('=== CHECKERS GAME ENDED - STOPPING ALL ACTIVITY ===');
        _isSearchingForOpponent = false;
        _searchTimeoutSeconds = 0;
        _canCancelSearch = false;
        _stopMoveTimer();
        _showMoveTimer = false;

        gameEnded = true;

        // Parse winner correctly and show modal
        final winnerData = result['winner'];
        final authProvider = Provider.of<AuthProvider>(context, listen: false);
        final myUserId = authProvider.user?.id;

        String resultType = 'draw';
        String resultMessage = 'The match ended in a draw. Well played!';

        print('🎮 CHECKERS GAME END: Winner data = $winnerData');
        print('🎮 CHECKERS GAME END: My user ID = $myUserId');

        if (winnerData != null) {
          String winnerId;

          if (winnerData is String) {
            winnerId = winnerData;
          } else if (winnerData is Map) {
            // Extract user ID from winner object
            winnerId = winnerData['user']?['_id'] ??
                winnerData['_id'] ??
                winnerData['socketId'];
          } else {
            winnerId = winnerData.toString();
          }

          print('🎮 CHECKERS GAME END: Winner ID = $winnerId');

          // ИСПРАВЛЕНО: Правильное определение победителя по ID
          if (winnerId == myUserId) {
            winner = myPlayerIndex == 0 ? 'red' : 'black';
            gameStatus = 'You win!';
            resultType = 'win';
            resultMessage =
                'Congratulations! You won the checkers match. Well played!';
            print('🎮 CHECKERS GAME END: I WON!');
          } else {
            winner = myPlayerIndex == 0 ? 'black' : 'red';
            gameStatus = 'You lose!';
            resultType = 'lose';
            resultMessage =
                'Better luck next time! Keep practicing to improve.';
            print('🎮 CHECKERS GAME END: I LOST!');
          }
        } else {
          winner = null;
          gameStatus = 'Draw!';
          resultType = 'draw';
          resultMessage = 'The match ended in a draw. Well played!';
          print('🎮 CHECKERS GAME END: DRAW!');
        }

        // Use provided message if available
        if (result['message'] != null) {
          resultMessage = result['message'];
          print('🎮 CHECKERS GAME END: Using server message: $resultMessage');
        }

        print('🎮 CHECKERS GAME END: Final status = $gameStatus');
        print('🎮 CHECKERS GAME END: Final result type = $resultType');

        // Show modal instead of notification
        Future.delayed(const Duration(milliseconds: 500), () {
          if (mounted) {
            GameResultModal.show(
              context: context,
              result: resultType,
              gameType: 'checkers',
              gameTitle: 'Checkers',
              customMessage: resultMessage,
              autoReturnSeconds: 5,
            );
          }
        });
      });
    };

    // Listen for opponent disconnected
    gameProvider.webSocketService.onOpponentDisconnected = (message) {
      if (roomId != null) {
        NotificationService.showOpponentDisconnected(
          gameType: 'Checkers',
          roomId: roomId!,
        );
      }
    };

    // Listen for errors
    gameProvider.webSocketService.onError = (error) {
      if (mounted) {
        setState(() {
          _errorMessage = error;
        });
      }
    };

    // Listen for opponent disconnected
    gameProvider.webSocketService.onOpponentDisconnected = (message) {
      if (roomId != null) {
        NotificationService.showOpponentDisconnected(
          gameType: 'Checkers',
          roomId: roomId!,
        );
      }
    };

    // Listen for errors
    gameProvider.webSocketService.onError = (error) {
      if (mounted) {
        setState(() {
          _errorMessage = error;
        });
      }
    };

    // Listen for game timeout using WebSocketService callback
    gameProvider.webSocketService.onGameTimeout = (data) {
      if (mounted && !gameEnded) {
        // НЕ обрабатывать timeout если игра уже завершена
        _stopMoveTimer();
        setState(() {
          _showMoveTimer = false;
        });
        print('Checkers game timeout received');
      } else {
        print('Checkers game timeout ignored - game already ended');
      }
    };
  }

  void _startMoveTimer() {
    _moveTimer?.cancel();
    _moveTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }

      // КРИТИЧНО: Остановить таймер если игра завершена
      if (gameEnded) {
        timer.cancel();
        setState(() {
          _showMoveTimer = false;
        });
        return;
      }

      setState(() {
        _moveTimeRemaining--;
      });

      if (_moveTimeRemaining <= 0) {
        timer.cancel();
        setState(() {
          _showMoveTimer = false;
        });
      }
    });
  }

  void _stopMoveTimer() {
    _moveTimer?.cancel();
    _moveTimer = null;
  }

  void _onSquareTapped(int index) {
    if (!isMyTurn || gameEnded || roomId == null || myPlayerIndex == null)
      return;

    final piece = board[index];

    if (selectedPiece == null) {
      // Select a piece if it belongs to current player
      if (piece.isNotEmpty && _isPieceOwnedByPlayer(piece, myPlayerIndex!)) {
        setState(() {
          selectedPiece = piece;
          selectedIndex = index;
        });
      }
    } else {
      // Try to move the selected piece
      if (selectedIndex != null && _isValidMove(selectedIndex!, index)) {
        _makeMove(selectedIndex!, index);
      }

      // Clear selection
      setState(() {
        selectedPiece = null;
        selectedIndex = null;
      });
    }
  }

  bool _isPieceOwnedByPlayer(String piece, int playerIndex) {
    if (playerIndex == 0) {
      return piece == '🔴' || piece == '👑'; // Player 0 (red) pieces
    } else {
      return piece == '⚫' || piece == '⚫👑'; // Player 1 (black) pieces
    }
  }

  void _makeMove(int fromIndex, int toIndex) {
    print('🎯 CHECKERS MOVE: From $fromIndex to $toIndex in room $roomId');

    final gameProvider = Provider.of<GameProvider>(context, listen: false);

    // Проверка валидности хода
    if (!isMyTurn || gameEnded || roomId == null || myPlayerIndex == null) {
      print('🚫 CHECKERS MOVE: Invalid game state');
      return;
    }

    if (!_isValidMove(fromIndex, toIndex)) {
      print('🚫 CHECKERS MOVE: Invalid move');
      setState(() {
        _errorMessage = _hasAvailableCaptures()
            ? 'You must make a capture!'
            : 'Invalid move';
      });
      return;
    }

    // Send move to server via WebSocket
    if (gameProvider.isConnected && roomId != null) {
      print('✅ CHECKERS MOVE: Sending move to server');

      gameProvider.makeMove(GameMove(
        type: 'checkersMove', // Only for client logic
        data: {
          'from': fromIndex,
          'to': toIndex,
          'isCapture': _isCapture(fromIndex, toIndex),
        },
      ));

      setState(() {
        selectedPiece = null;
        selectedIndex = null;
        gameStatus = 'Move sent, waiting for response...';
      });
    } else {
      print('❌ CHECKERS MOVE: Not connected');
      setState(() {
        _errorMessage = 'Not connected to game server';
      });
    }
  }

  bool _isCapture(int fromIndex, int toIndex) {
    final fromRow = fromIndex ~/ 8;
    final fromCol = fromIndex % 8;
    final toRow = toIndex ~/ 8;
    final toCol = toIndex % 8;

    // В шашках capture происходит если перепрыгиваем через одну клетку (разница 2)
    return (fromRow - toRow).abs() == 2 && (fromCol - toCol).abs() == 2;
  }

  // Проверяет, есть ли возможные captures для текущего игрока
  bool _hasAvailableCaptures() {
    if (myPlayerIndex == null) return false;

    for (int i = 0; i < 64; i++) {
      final piece = board[i];
      if (piece.isNotEmpty && _isPieceOwnedByPlayer(piece, myPlayerIndex!)) {
        // Проверяем все возможные captures для этой фигуры
        if (_getPossibleCaptures(i).isNotEmpty) {
          return true;
        }
      }
    }
    return false;
  }

  // Получает список возможных captures для фигуры на позиции
  List<int> _getPossibleCaptures(int fromIndex) {
    List<int> captures = [];
    final fromRow = fromIndex ~/ 8;
    final fromCol = fromIndex % 8;

    // Проверяем все диагональные направления для capture (перепрыгивание на 2 клетки)
    final directions = [
      [-2, -2], [-2, 2], [2, -2], [2, 2] // диагональные captures
    ];

    for (final direction in directions) {
      final toRow = fromRow + direction[0];
      final toCol = fromCol + direction[1];
      final toIndex = toRow * 8 + toCol;

      if (toRow >= 0 && toRow < 8 && toCol >= 0 && toCol < 8) {
        // Проверяем что целевая клетка пустая
        if (board[toIndex].isEmpty) {
          // Проверяем что между начальной и конечной позицией есть фигура противника
          final middleRow = fromRow + direction[0] ~/ 2;
          final middleCol = fromCol + direction[1] ~/ 2;
          final middleIndex = middleRow * 8 + middleCol;

          if (board[middleIndex].isNotEmpty &&
              !_isPieceOwnedByPlayer(board[middleIndex], myPlayerIndex!)) {
            captures.add(toIndex);
          }
        }
      }
    }

    return captures;
  }

  // Проверяет валидность хода
  bool _isValidMove(int fromIndex, int toIndex) {
    // Проверяем есть ли обязательные captures
    if (_hasAvailableCaptures()) {
      // Если есть captures, ход должен быть capture
      return _isCapture(fromIndex, toIndex) &&
          _getPossibleCaptures(fromIndex).contains(toIndex);
    } else {
      // Обычный ход (на одну клетку по диагонали)
      final fromRow = fromIndex ~/ 8;
      final fromCol = fromIndex % 8;
      final toRow = toIndex ~/ 8;
      final toCol = toIndex % 8;

      // Проверяем что ход по диагонали на одну клетку
      return (fromRow - toRow).abs() == 1 &&
          (fromCol - toCol).abs() == 1 &&
          board[toIndex].isEmpty;
    }
  }

  String _convertServerPieceToString(dynamic piece) {
    if (piece == null) return '';

    // Server sends piece objects with playerIndex and isKing properties
    if (piece is Map<String, dynamic>) {
      final playerIndex = piece['playerIndex'] as int?;
      final isKing = piece['isKing'] as bool? ?? false;

      if (playerIndex == null) return '';

      if (playerIndex == 0) {
        return isKing ? '👑' : '🔴'; // Red pieces
      } else {
        return isKing ? '⚫👑' : '⚫'; // Black pieces
      }
    }

    // Fallback: if piece is already a string
    return piece.toString();
  }

  void _resetGame() {
    final gameProvider = Provider.of<GameProvider>(context, listen: false);
    final authProvider = Provider.of<AuthProvider>(context, listen: false);

    if (authProvider.isAuthenticated) {
      // Leave current room if any
      if (roomId != null) {
        gameProvider.leaveRoom();
      }

      // Reset local state
      setState(() {
        _initializeBoard();
        gameStatus = 'Looking for opponent...';
        gameEnded = false;
        winner = null;
        isMyTurn = false;
        myPlayerIndex = null;
        roomId = null;
        selectedPiece = null;
        selectedIndex = null;
      });

      // Join lobby again to find new opponent
      gameProvider.joinLobby('checkers');
    }
  }

  void _createRoom() {
    final gameProvider = Provider.of<GameProvider>(context, listen: false);
    gameProvider.createRoom('checkers', 0.0); // No bet for demo
    setState(() {
      gameStatus = 'Creating room...';
    });
  }

  void _findOpponent() {
    final gameProvider = Provider.of<GameProvider>(context, listen: false);
    final authProvider = Provider.of<AuthProvider>(context, listen: false);

    if (!authProvider.isAuthenticated) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please log in to find opponents'),
          backgroundColor: AppTheme.errorColor,
        ),
      );
      return;
    }

    // Start searching animation
    setState(() {
      _isSearchingForOpponent = true;
      _searchTimeoutSeconds = 0;
      _initializeBoard();
      gameStatus = 'Connecting to server...';
      gameEnded = false;
      winner = null;
      isMyTurn = false;
      myPlayerIndex = null;
      roomId = null;
      selectedPiece = null;
      selectedIndex = null;
      _errorMessage = null;
    });

    // Connect to WebSocket if not connected
    if (!gameProvider.isConnected) {
      setState(() {
        gameStatus = 'Connecting to game server...';
      });

      gameProvider.connectToWebSocket(authProvider.token!);
      _setupGameListeners(gameProvider);

      // Wait for connection before joining lobby
      Future.delayed(const Duration(seconds: 2), () {
        if (mounted && gameProvider.isConnected) {
          _joinLobbyAndSearch(gameProvider);
        } else if (mounted) {
          setState(() {
            gameStatus = 'Connection failed';
            _isSearchingForOpponent = false;
            _errorMessage =
                'Unable to connect to game server. Please check your internet connection and try again.';
          });
        }
      });
    } else {
      _joinLobbyAndSearch(gameProvider);
    }
  }

  void _joinLobbyAndSearch(GameProvider gameProvider) async {
    print('=== CHECKERS JOINING LOBBY AND SEARCH ===');
    print('_canCancelSearch before: $_canCancelSearch');

    // Leave current room if any
    if (roomId != null) {
      gameProvider.leaveRoom();
    }

    setState(() {
      gameStatus = 'Searching for opponents...';
    });

    gameProvider.joinLobby('checkers');

    // Try to find and join an existing room first
    bool joinedExistingRoom =
        await gameProvider.findAndJoinAvailableRoom('checkers');

    if (joinedExistingRoom) {
      print('Successfully found/joined checkers room');
      setState(() {
        gameStatus = 'Found game, waiting for start...';
        _canCancelSearch = false; // Не можем отменить после успешного поиска
        // Поиск остановится в gameStart callback
      });
      return;
    }

    print('No checkers room found - starting search countdown');
    setState(() {
      _canCancelSearch = true; // Можем отменить во время поиска
    });

    _startSearchCountdown();

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Searching for opponent online...'),
        backgroundColor: AppTheme.primaryColor,
        duration: Duration(seconds: 2),
      ),
    );

    print('_canCancelSearch after: $_canCancelSearch');
    print('=== END CHECKERS JOINING LOBBY AND SEARCH ===');
  }

  void _startSearchCountdown() {
    Future.delayed(const Duration(seconds: 1), () {
      if (mounted && _isSearchingForOpponent) {
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
            'Currently there are no other players looking for a Checkers match.\n\nWould you like to:',
            style: TextStyle(color: AppTheme.textSecondary),
          ),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.of(context).pop();
                _findOpponent(); // Try again
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

  // Определяет, нужно ли показывать кнопку CANCEL GAME
  bool _shouldShowCancelButton() {
    final isWaiting = _isWaitingForSecondPlayer();

    // ИСПРАВЛЕНО: Показываем CANCEL если идет любой поиск или ожидание
    // Убираем ограничение _canCancelSearch - игрок всегда может отменить поиск
    return (_isSearchingForOpponent || isWaiting) && !gameEnded;
  }

  // Определяет, нужно ли показывать кнопку SURRENDER
  bool _shouldShowSurrenderButton() {
    final gameProvider = Provider.of<GameProvider>(context, listen: false);

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
    final gameProvider = Provider.of<GameProvider>(context, listen: false);

    // ИСПРАВЛЕНО: НЕ считаем что ждем если игра уже началась
    if (gameEnded ||
        (gameProvider.currentRoom?.gameState?.data['board'] as List?)
                ?.any((cell) => cell != null) ==
            true) {
      return false; // Игра уже началась или закончена
    }

    bool isWaiting = roomId != null &&
        gameProvider.currentRoom != null &&
        gameProvider.currentRoom!.players.length < 2;

    return isWaiting;
  }

  // Проверяет, есть ли два игрока в комнате
  bool _hasTwoPlayers() {
    final gameProvider = Provider.of<GameProvider>(context, listen: false);
    return gameProvider.currentRoom != null &&
        gameProvider.currentRoom!.players.length >= 2;
  }

  void _cancelSearch() {
    final gameProvider = Provider.of<GameProvider>(context, listen: false);

    // Остановить поиск
    setState(() {
      _isSearchingForOpponent = false;
      _searchTimeoutSeconds = 0;
      gameStatus = 'Search cancelled';
    });

    // Покинуть текущую комнату если есть
    if (roomId != null) {
      gameProvider.leaveRoom();
    }

    // Покинуть лобби
    gameProvider.leaveLobby('checkers');

    // Остановить таймер хода
    _stopMoveTimer();

    // Сбросить состояние
    setState(() {
      _initializeBoard();
      gameStatus = 'Ready to play';
      gameEnded = false;
      winner = null;
      isMyTurn = false;
      myPlayerIndex = null;
      roomId = null;
      selectedPiece = null;
      selectedIndex = null;
      _errorMessage = null;
      _showMoveTimer = false;
      _moveTimeRemaining = 0;
    });

    // ИСПРАВЛЕНО: Переходим в лобби игры вместо возврата на главную
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (context) => GameLobbyScreen(
          gameType: 'checkers',
          gameTitle: 'Checkers',
        ),
      ),
    );
  }

  void _surrender() {
    final gameProvider = Provider.of<GameProvider>(context, listen: false);

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
    final gameProvider = Provider.of<GameProvider>(context, listen: false);

    // Отправить сигнал сдачи на сервер (покидаем игру = сдача)
    if (gameProvider.isConnected && roomId != null) {
      gameProvider.leaveRoom(); // Используем leaveRoom для сдачи

      setState(() {
        gameStatus = 'You lost (surrendered)';
        gameEnded = true;
        winner = myPlayerIndex == 0
            ? 'black'
            : 'red'; // Противник побеждает при сдаче
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

  void _backToLobby() {
    final gameProvider = Provider.of<GameProvider>(context, listen: false);

    // Покинуть текущую комнату если есть
    if (roomId != null) {
      gameProvider.leaveRoom();
    }

    // Покинуть лобби
    gameProvider.leaveLobby('checkers');

    // Остановить таймер хода
    _stopMoveTimer();

    // Перейти в Checkers лобби (заменить текущий экран)
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (context) => GameLobbyScreen(
          gameType: 'checkers',
          gameTitle: 'Checkers',
        ),
      ),
    );
  }

  Widget _buildPlayerNames() {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final gameProvider = Provider.of<GameProvider>(context, listen: false);

    String playerName = authProvider.user?.username ?? 'You';
    String opponentName = 'Searching...';

    // Правильно определяем состояние игры
    if (gameProvider.currentRoom != null &&
        gameProvider.currentRoom!.players.length >= 2) {
      final myUserId = authProvider.user?.id;
      final opponent = gameProvider.currentRoom!.players.firstWhere(
        (p) => p.user.id != myUserId,
        orElse: () => gameProvider.currentRoom!.players.first,
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

  @override
  void dispose() {
    _stopMoveTimer();
    if (_gameProvider != null) {
      if (roomId != null) {
        _gameProvider!.leaveRoom();
      }
      _gameProvider!.leaveLobby('checkers');
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
              'assets/images/games/checkers.jpg',
              width: 24,
              height: 24,
            ),
            const SizedBox(width: 8),
            const Text('Checkers'),
          ],
        ),
        backgroundColor: AppTheme.surfaceColor,
        foregroundColor: AppTheme.textPrimary,
        elevation: 0,
        actions: [
          // Move timer in top right corner
          if (_showMoveTimer) ...[
            Container(
              margin: const EdgeInsets.only(right: 16),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: _moveTimeRemaining <= 10
                    ? Colors.red
                    : AppTheme.primaryColor,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.timer,
                    color: Colors.white,
                    size: 16,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    '${_moveTimeRemaining}s',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
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
              // Show error message if any
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

              // Checkers board
              Expanded(
                child: Center(
                  child: AspectRatio(
                    aspectRatio: 1,
                    child: Container(
                      decoration: BoxDecoration(
                        color: AppTheme.surfaceColor,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      padding: const EdgeInsets.all(20),
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
                          final isSelected = selectedIndex == index;

                          return GestureDetector(
                            onTap: () => _onSquareTapped(index),
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
                                  board[index],
                                  style: const TextStyle(
                                    fontSize: 20,
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

              // Action buttons like in TicTacToe
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
