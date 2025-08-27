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
import 'game_lobby_screen.dart';

class TicTacToeScreen extends StatefulWidget {
  const TicTacToeScreen({super.key});

  @override
  State<TicTacToeScreen> createState() => _TicTacToeScreenState();
}

class _TicTacToeScreenState extends State<TicTacToeScreen> {
  List<String> board = List.filled(9, '');
  String currentPlayer = 'X';
  String gameStatus = 'Connecting...';
  bool gameEnded = false;
  String? winner;
  bool isMyTurn = false;
  String? mySymbol;
  String? roomId;
  String? _errorMessage;
  GameProvider? _gameProvider;
  bool _isSearchingForOpponent = false;
  int _searchTimeoutSeconds = 0;
  bool _canCancelSearch =
      false; // Можно ли отменить поиск (true если создал комнату сам)

  // Move timer variables
  int _moveTimeRemaining = 0;
  Timer? _moveTimer;
  bool _showMoveTimer = false;
  String? _currentTurnPlayerId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _initGame();
    });
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
            '🎮 INIT: Found existing room ${currentRoom.id} with ${currentRoom.players.length} players');
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
            '🎮 INIT: Found existing room ${currentRoom.id} with 1 player - waiting for more');
        setState(() {
          roomId = currentRoom.id;
          gameStatus = 'Waiting for second player...';
          _isSearchingForOpponent = true;
          _canCancelSearch = true;
        });
      } else if (!gameEnded) {
        // Нет активной комнаты - начинаем поиск
        print('🎮 INIT: No active room - starting search');
        setState(() {
          gameStatus = 'Looking for opponent...';
          _isSearchingForOpponent = true;
          _canCancelSearch = true;
        });

        // Присоединяемся к лобби и ищем игру
        _gameProvider!.joinLobby('tic-tac-toe');
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
    print('🎮 SETUP: Setting up existing room ${room.id}');

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final myUserId = authProvider.user?.id;

    setState(() {
      roomId = room.id;
      board = List.filled(9, '');
      gameEnded = false;
      _errorMessage = null;

      // Определяем символ игрока и чей ход
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
          mySymbol = myIndex == 0 ? 'X' : 'O';
          print('🎮 SETUP: My symbol = $mySymbol (index $myIndex)');

          // Проверяем состояние игры
          if (room.gameState != null) {
            final gameData = room.gameState!.data;

            // Загружаем доску
            if (gameData['board'] != null) {
              final serverBoard = gameData['board'] as List<dynamic>;
              board =
                  serverBoard.map((cell) => cell?.toString() ?? '').toList();
              print('🎮 SETUP: Loaded board = $board');
            }

            // Проверяем чей ход
            final currentTurnPlayerId = gameData['turn'];
            isMyTurn = currentTurnPlayerId == myUserId;
            gameStatus = isMyTurn ? 'Your turn' : 'Opponent\'s turn';

            print(
                '🎮 SETUP: Current turn = $currentTurnPlayerId, my turn = $isMyTurn');
          } else {
            // Новая игра
            isMyTurn = mySymbol == 'X'; // X ходит первым
            gameStatus = isMyTurn ? 'Your turn' : 'Opponent\'s turn';
          }
        }
      } else {
        // Только один игрок - ждем второго
        mySymbol = 'X';
        isMyTurn = false;
        gameStatus = 'Waiting for second player...';
      }
    });
  }

  void _createBotRoom() {
    final gameProvider = Provider.of<GameProvider>(context, listen: false);

    setState(() {
      gameStatus = 'Creating game with bot...';
      board = List.filled(9, '');
      gameEnded = false;
      winner = null;
      isMyTurn = false;
      mySymbol = null;
      roomId = null;
    });

    // Create room, server will add bot automatically if no human player joins
    gameProvider.createRoom('tic-tac-toe', 0.0);
  }

  void _setupGameListeners(GameProvider gameProvider) {
    // Listen for game start - НЕ переопределяем callback GameProvider!
    // Сохраняем существующий callback GameProvider
    final originalOnGameStart = gameProvider.webSocketService.onGameStart;

    gameProvider.webSocketService.onGameStart = (room) {
      print('=== TIC TAC TOE GAME START CALLBACK ===');
      print('Room ID: ${room.id}');
      print('Mounted: $mounted');

      // Сначала вызываем оригинальный callback GameProvider
      originalOnGameStart?.call(room);

      // Потом наш локальный callback
      if (mounted) {
        print('=== UPDATING TIC TAC TOE STATE ===');
        setState(() {
          roomId = room.id; // КРИТИЧНО: устанавливаем roomId
          board = List.filled(9, '');
          gameEnded = false;
          _errorMessage = null; // ИСПРАВЛЕНО: Очищаем ошибки при начале игры

          // ИСПРАВЛЕНО: Останавливаем поиск ТОЛЬКО если есть 2+ игроков
          if (room.players.length >= 2) {
            _isSearchingForOpponent = false;
            _searchTimeoutSeconds = 0;
            print('STOPPING SEARCH - 2+ players found');
          } else {
            print(
                'KEEPING SEARCH - only ${room.players.length} player(s), waiting for more');
          }

          // Determine player symbol based on position in room
          final players = room.players;
          print('Players count: ${players.length}');
          if (players.isNotEmpty) {
            final authProvider =
                Provider.of<AuthProvider>(context, listen: false);
            final myUserId = authProvider.user?.id;
            print('My user ID: $myUserId');

            // ИСПРАВЛЕНО: более надежное определение символа
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
                mySymbol = myIndex == 0 ? 'X' : 'O';
                isMyTurn = mySymbol == 'X'; // X goes first
                currentPlayer = 'X';
                print('My player index: $myIndex');
                print('My symbol: $mySymbol');
                print('Is my turn: $isMyTurn');

                // ВАЖНО: Игра началась с двумя игроками
                gameStatus = isMyTurn ? 'Your turn' : 'Opponent\'s turn';
                print('GAME STARTED WITH 2 PLAYERS');
              } else {
                // Fallback если не нашли игрока
                mySymbol = 'X';
                isMyTurn = true;
                gameStatus = 'Your turn';
                print('Fallback: set as X');
              }
            } else if (players.length == 1) {
              // Только один игрок - ждем второго (это НЕ должно происходить в gameStart)
              mySymbol = 'X';
              isMyTurn = false; // НЕ можем ходить пока нет второго игрока
              gameStatus = 'Waiting for second player...';
              print('WARNING: gameStart called with only 1 player');
            }
          }
        });

        print('=== TIC TAC TOE STATE UPDATED ===');
        print('Final roomId: $roomId');
        print('Final isMyTurn: $isMyTurn');
        print('Final mySymbol: $mySymbol');
        print('Final gameStatus: $gameStatus');
        print('Final _isSearchingForOpponent: $_isSearchingForOpponent');
      } else {
        print('=== TIC TAC TOE NOT MOUNTED ===');
      }
    };

    // Listen for move timer events with room ID filtering
    gameProvider.webSocketService.onMoveTimerStart = (data) {
      if (mounted && roomId != null) {
        final timeLimit = data['timeLimit'] as int;
        final currentPlayerId = data['currentPlayerId'] as String;
        final authProvider = Provider.of<AuthProvider>(context, listen: false);
        final isMyTurn = currentPlayerId == authProvider.user?.id;

        // ИСПРАВЛЕНО: Показываем таймер только для своей комнаты
        print('⏰ TIMER START for $currentPlayerId in current room: $roomId');

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
              '⚠️ TIMER WARNING: ${_moveTimeRemaining}s remaining for my turn');
        }
      }
    };

    // Listen for game updates - с фильтрацией по roomId
    gameProvider.webSocketService.onGameUpdate = (room) {
      print('=== GAME UPDATE CALLBACK ===');
      print('Room ID from update: ${room.id}');
      print('Local roomId before: $roomId');
      print('Local mySymbol before: $mySymbol');
      print('Players in room: ${room.players.length}');
      print('_isSearchingForOpponent before: $_isSearchingForOpponent');

      // ИСПРАВЛЕНО: Обрабатываем только обновления для СВОЕЙ комнаты
      if (roomId != null && roomId != room.id) {
        print(
            '⚠️ TIC TAC TOE: Ignoring gameUpdate for foreign room ${room.id} (my room: $roomId)');
        return;
      }

      if (room.gameState != null) {
        print('🎮 GAME UPDATE: Processing gameState for room ${room.id}');
        print('🎮 GAME UPDATE: gameState.data = ${room.gameState!.data}');

        setState(() {
          // Останавливаем поиск если еще активен
          if (_isSearchingForOpponent) {
            print('🔍 GAME UPDATE: Stopping search during gameUpdate');
            _isSearchingForOpponent = false;
          }

          // Update board from server
          final gameData = room.gameState!.data;
          print('🎯 BOARD UPDATE: gameData = $gameData');

          if (gameData['board'] != null) {
            final serverBoard = gameData['board'] as List<dynamic>;
            final newBoard =
                serverBoard.map((cell) => cell?.toString() ?? '').toList();
            print('🎯 BOARD UPDATE: Old board = $board');
            print('🎯 BOARD UPDATE: New board = $newBoard');
            board = newBoard;
          } else {
            print('⚠️ BOARD UPDATE: No board data in gameState');
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

            // Determine winner based on response format
            if (winnerData != null) {
              if (winnerData == myUserId) {
                winner = mySymbol;
                gameStatus = 'You win!';
              } else {
                winner = mySymbol == 'X' ? 'O' : 'X';
                gameStatus = 'Opponent wins!';
              }
            } else {
              winner = null;
              gameStatus = 'Draw!';
            }

            // Show game end notification if roomId is available
            if (roomId != null) {
              NotificationService.showGameEnd(
                gameType: 'Tic Tac Toe',
                result: gameStatus,
                roomId: roomId!,
              );
            }
          } else {
            gameStatus = isMyTurn ? 'Your turn' : 'Opponent\'s turn';

            // Show your turn notification if roomId is available
            if (isMyTurn && roomId != null) {
              NotificationService.showYourTurn(
                gameType: 'Tic Tac Toe',
                roomId: roomId!,
              );
            }
          }
        });
      }

      print('Local roomId after: $roomId');
      print('Local mySymbol after: $mySymbol');
      print('=== END GAME UPDATE ===');
    };

    // Listen for game end with room filtering
    gameProvider.webSocketService.onGameEnd = (result) {
      // ИСПРАВЛЕНО: Фильтруем gameEnd по roomId
      if (gameEnded) {
        print('🎮 GAME END: Already processed - ignoring');
        return;
      }

      // Проверяем что это завершение нашей игры
      if (roomId == null) {
        print('🎮 GAME END: No roomId - ignoring');
        return;
      }

      setState(() {
        // КРИТИЧНО: Останавливаем весь поиск и таймер при завершении игры
        print('=== GAME ENDED - STOPPING ALL ACTIVITY ===');
        _isSearchingForOpponent = false;
        _searchTimeoutSeconds = 0;
        _canCancelSearch = false;
        _stopMoveTimer();
        _showMoveTimer = false;

        // ВАЖНО: Попытаться получить финальное состояние доски из gameProvider
        final gameProvider = Provider.of<GameProvider>(context, listen: false);
        final currentRoom = gameProvider.currentRoom;
        if (currentRoom?.gameState?.data != null) {
          final gameData = currentRoom!.gameState!.data;
          if (gameData['board'] != null) {
            final serverBoard = gameData['board'] as List<dynamic>;
            board = serverBoard.map((cell) => cell?.toString() ?? '').toList();
            print('=== UPDATED BOARD FROM FINAL GAME STATE ===');
            print('Final board: $board');
          }
        }

        gameEnded = true;

        // Parse winner correctly - server can send different formats
        final winnerData = result['winner'];
        if (winnerData != null) {
          if (winnerData is String) {
            winner = winnerData;
          } else if (winnerData is Map) {
            // If winner is a player object, extract username or check if it's me
            final authProvider =
                Provider.of<AuthProvider>(context, listen: false);
            final winnerId = winnerData['user']?['_id'] ?? winnerData['_id'];
            if (winnerId == authProvider.user?.id) {
              winner = mySymbol;
              gameStatus = 'You win!';
            } else {
              winner = mySymbol == 'X' ? 'O' : 'X';
              gameStatus = 'You lose!';
            }
          }
        } else {
          winner = null;
          gameStatus = 'Draw!';
        }

        // Use provided message if no custom status set
        if (result['message'] != null && !gameStatus.contains('You')) {
          gameStatus = result['message'];
        }

        print('Game ended. Final status: $gameStatus');
      });

      // Show notification
      NotificationService.showGameEnd(
        gameType: 'Tic Tac Toe',
        result: gameStatus,
        roomId: roomId ?? 'unknown',
      );
    };

    // Listen for opponent disconnected
    gameProvider.webSocketService.onOpponentDisconnected = (message) {
      if (roomId != null) {
        NotificationService.showOpponentDisconnected(
          gameType: 'Tic Tac Toe',
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
        print('Game timeout received');
      } else {
        print('Game timeout ignored - game already ended');
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

  void _makeMove(int index) {
    print(
        '🎯 MOVE: Cell $index in room $roomId (turn: $isMyTurn, symbol: $mySymbol)');

    final gameProvider = Provider.of<GameProvider>(context, listen: false);

    // Проверка валидности хода
    if (board[index] != '' || gameEnded || !isMyTurn || roomId == null) {
      if (board[index] != '') print('🚫 MOVE: Cell not empty');
      if (gameEnded) print('🚫 MOVE: Game ended');
      if (!isMyTurn) print('🚫 MOVE: Not my turn');
      if (roomId == null) print('🚫 MOVE: No room ID');
      return;
    }

    // Send move to server via WebSocket
    if (gameProvider.isConnected && roomId != null) {
      print('✅ MOVE: Sending cell $index to server');

      gameProvider.makeMove(GameMove(
        type: 'cellMove', // Только для клиентской логики
        data: {
          'cellIndex': index,
        },
      ));

      setState(() {
        gameStatus = 'Move sent, waiting for response...';
      });
    } else {
      print(
          '❌ MOVE: Not connected (connected: ${gameProvider.isConnected}, roomId: $roomId)');
      setState(() {
        _errorMessage = 'Not connected to game server';
      });
    }
  }

  // Removed offline game logic - all game logic handled by server

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
        board = List.filled(9, '');
        currentPlayer = 'X';
        gameStatus = 'Looking for opponent...';
        gameEnded = false;
        winner = null;
        isMyTurn = false;
        mySymbol = null;
        roomId = null;
      });

      // Join lobby again to find new opponent
      gameProvider.joinLobby('tic-tac-toe');
    }
  }

  void _createRoom() {
    final gameProvider = Provider.of<GameProvider>(context, listen: false);
    gameProvider.createRoom('tic-tac-toe', 0.0); // No bet for demo
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

    // Start searching animation - ИСПРАВЛЕНО: правильно устанавливаем флаг поиска
    setState(() {
      _isSearchingForOpponent = true; // КРИТИЧНО: устанавливаем флаг поиска
      _searchTimeoutSeconds = 0;
      board = List.filled(9, '');
      currentPlayer = 'X';
      gameStatus = 'Connecting to server...';
      gameEnded = false;
      winner = null;
      isMyTurn = false;
      mySymbol = null;
      roomId = null; // Сбрасываем roomId
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
    print('=== JOINING LOBBY AND SEARCH ===');
    print('_canCancelSearch before: $_canCancelSearch');

    // Leave current room if any
    if (roomId != null) {
      gameProvider.leaveRoom();
    }

    setState(() {
      gameStatus = 'Searching for opponents...';
    });

    gameProvider.joinLobby('tic-tac-toe');

    // Try to find and join an existing room first
    bool joinedExistingRoom =
        await gameProvider.findAndJoinAvailableRoom('tic-tac-toe');

    if (joinedExistingRoom) {
      print('Successfully found/joined room');
      setState(() {
        gameStatus = 'Found game, waiting for start...';
        _canCancelSearch = false; // Не можем отменить после успешного поиска
        // Поиск остановится в gameStart callback
      });
      return;
    }

    print('No room found - starting search countdown');
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
    print('=== END JOINING LOBBY AND SEARCH ===');
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
            'Currently there are no other players looking for a Tic Tac Toe match.\n\nWould you like to:',
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

  @override
  void dispose() {
    _stopMoveTimer();
    if (_gameProvider != null) {
      if (roomId != null) {
        _gameProvider!.leaveRoom();
      }
      _gameProvider!.leaveLobby('tic-tac-toe');
    }
    super.dispose();
  }

  Widget _buildPlayerNames() {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final gameProvider = Provider.of<GameProvider>(context, listen: false);

    String playerName = authProvider.user?.username ?? 'You';
    String opponentName = 'Searching...';

    // ИСПРАВЛЕНО: Правильно определяем состояние игры
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
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        title: Row(
          children: [
            Image.asset(
              'assets/images/games/tic-tac-toe.jpg',
              width: 24,
              height: 24,
            ),
            const SizedBox(width: 8),
            const Text('Tic Tac Toe'),
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

              // Game board
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
                          crossAxisCount: 3,
                          crossAxisSpacing: 8,
                          mainAxisSpacing: 8,
                        ),
                        itemCount: 9,
                        itemBuilder: (context, index) {
                          return GestureDetector(
                            onTap: () => _makeMove(index),
                            child: Container(
                              decoration: BoxDecoration(
                                color: AppTheme.backgroundColor,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(
                                  color:
                                      AppTheme.textSecondary.withOpacity(0.3),
                                  width: 1,
                                ),
                              ),
                              child: Center(
                                child: Text(
                                  board[index],
                                  style: Theme.of(context)
                                      .textTheme
                                      .displayLarge
                                      ?.copyWith(
                                        color: board[index] == 'X'
                                            ? AppTheme.primaryColor
                                            : AppTheme.accentColor,
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

              // Game status (moved below board)
              // ИСПРАВЛЕНО: Показываем статус только если реально ищем или есть активная игра
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

              // Game end status
              if (gameEnded) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: AppTheme.surfaceColor,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    children: [
                      Text(
                        gameStatus,
                        style:
                            Theme.of(context).textTheme.headlineSmall?.copyWith(
                                  color: AppTheme.textPrimary,
                                  fontWeight: FontWeight.bold,
                                ),
                        textAlign: TextAlign.center,
                      ),
                      if (winner != null && gameStatus.contains('win')) ...[
                        const SizedBox(height: 8),
                        Text(
                          'Congratulations!',
                          style:
                              Theme.of(context).textTheme.bodyLarge?.copyWith(
                                    color: AppTheme.accentColor,
                                    fontWeight: FontWeight.w600,
                                  ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 20),
              ],

              // ИСПРАВЛЕННАЯ логика кнопок с учетом количества игроков
              if (_shouldShowCancelButton()) ...[
                // Поиск соперника И можем отменить - красная кнопка отмены
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
                // Игра активна с двумя игроками - кнопка сдачи
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
              ] else if (gameEnded) ...[
                // Игра закончена - кнопка возврата в Tic Tac Toe лобби
                CustomButton(
                  text: 'Back to Lobby',
                  onPressed: _backToLobby,
                  backgroundColor: AppTheme.surfaceColor,
                  textColor: AppTheme.textPrimary,
                  width: double.infinity,
                ),
              ],
              // УБРАНА кнопка "FIND OPPONENT" - поиск автоматический
            ],
          ),
        ),
      ),
    );
  }

  // Определяет, нужно ли показывать кнопку CANCEL GAME
  bool _shouldShowCancelButton() {
    final isWaiting = _isWaitingForSecondPlayer();

    // Показываем CANCEL если:
    // 1. Идет поиск ИЛИ ожидание второго игрока
    // 2. И мы можем отменить поиск (начали сами)
    // 3. И игра не закончена
    return (_isSearchingForOpponent || isWaiting) &&
        _canCancelSearch &&
        !gameEnded;
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

    // КРИТИЧНО: НЕ перезапускаем поиск автоматически - это вызывает проблемы
    // Если нужен поиск - пользователь должен нажать кнопку

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
    gameProvider.leaveLobby('tic-tac-toe');

    // Остановить таймер хода
    _stopMoveTimer();

    // Сбросить состояние
    setState(() {
      board = List.filled(9, '');
      currentPlayer = 'X';
      gameStatus = 'Ready to play';
      gameEnded = false;
      winner = null;
      isMyTurn = false;
      mySymbol = null;
      roomId = null;
      _errorMessage = null;
      _showMoveTimer = false;
      _moveTimeRemaining = 0;
    });

    // ИСПРАВЛЕНО: Переходим в лобби игры вместо возврата на главную
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (context) => GameLobbyScreen(
          gameType: 'tic-tac-toe',
          gameTitle: 'Tic Tac Toe',
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
        gameStatus = 'You lost (surrendered)'; // ИСПРАВЛЕНО: правильный статус
        gameEnded = true;
        winner = mySymbol == 'X' ? 'O' : 'X'; // Противник побеждает при сдаче
      });

      // Показать уведомление
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('You surrendered - Game lost'),
          backgroundColor: Colors.red, // ИСПРАВЛЕНО: красный цвет для поражения
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
    gameProvider.leaveLobby('tic-tac-toe');

    // Остановить таймер хода
    _stopMoveTimer();

    // Перейти в Tic Tac Toe лобби (заменить текущий экран)
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (context) => GameLobbyScreen(
          gameType: 'tic-tac-toe',
          gameTitle: 'Tic Tac Toe',
        ),
      ),
    );
  }
}
