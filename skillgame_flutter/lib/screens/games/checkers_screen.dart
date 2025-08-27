import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:skillgame_flutter/providers/game_provider.dart';
import 'package:skillgame_flutter/providers/auth_provider.dart';
import 'package:skillgame_flutter/models/game_model.dart';
import 'package:skillgame_flutter/services/notification_service.dart';
import 'package:skillgame_flutter/utils/theme.dart';
import 'package:skillgame_flutter/widgets/custom_button.dart';

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
      // Connect to WebSocket and setup listeners
      _gameProvider!.connectToWebSocket(authProvider.token!);
      _setupGameListeners(_gameProvider!);

      // Join lobby to find opponent
      _gameProvider!.joinLobby('checkers');
      setState(() {
        gameStatus = 'Looking for opponent...';
      });

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
    // Listen for game start
    gameProvider.webSocketService.onGameStart = (room) {
      setState(() {
        roomId = room.id;
        gameStatus = 'Game started!';
        _initializeBoard();
        gameEnded = false;
        _isSearchingForOpponent = false; // Stop searching animation
        _searchTimeoutSeconds = 0;

        // Determine player index based on position in room
        final players = room.players;
        if (players.isNotEmpty) {
          final authProvider =
              Provider.of<AuthProvider>(context, listen: false);
          final myPlayer = players.firstWhere(
            (p) => p.user.id == authProvider.user?.id,
            orElse: () => players.first,
          );
          myPlayerIndex = players.indexOf(myPlayer);
          isMyTurn = myPlayerIndex == 0; // Player 0 (red) goes first
        }
      });
    };

    // Listen for game updates
    gameProvider.webSocketService.onGameUpdate = (room) {
      if (room.gameState != null) {
        setState(() {
          final gameData = room.gameState!.data;

          // Update board from server (64-element array)
          if (gameData['board'] != null) {
            final boardData = gameData['board'] as List<dynamic>;
            board = List.generate(64, (i) {
              final piece = boardData[i];
              return _convertServerPieceToString(piece);
            });
          }

          // Update turn - server sends player ID, need to check if it's my turn
          final currentTurnPlayerId = gameData['turn'];
          final authProvider =
              Provider.of<AuthProvider>(context, listen: false);
          final myUserId = authProvider.user?.id;
          isMyTurn = currentTurnPlayerId == myUserId;

          if (room.gameState!.isGameFinished) {
            gameEnded = true;
            final winnerData = gameData['winner'];

            // Determine winner based on response format
            if (winnerData != null) {
              if (winnerData == myUserId) {
                winner = myPlayerIndex == 0 ? 'red' : 'black';
                gameStatus = 'You win!';
              } else {
                winner = myPlayerIndex == 0 ? 'black' : 'red';
                gameStatus = 'Opponent wins!';
              }
            } else {
              winner = null;
              gameStatus = 'Draw!';
            }

            // Show game end notification
            NotificationService.showGameEnd(
              gameType: 'Checkers',
              result: gameStatus,
              roomId: roomId!,
            );
          } else {
            gameStatus = isMyTurn ? 'Your turn' : 'Opponent\'s turn';

            // Show your turn notification
            if (isMyTurn) {
              NotificationService.showYourTurn(
                gameType: 'Checkers',
                roomId: roomId!,
              );
            }
          }
        });
      }
    };

    // Listen for game end
    gameProvider.webSocketService.onGameEnd = (result) {
      setState(() {
        gameEnded = true;
        winner = result['winner'];
        gameStatus = result['message'] ?? 'Game ended';
      });

      // Show notification
      NotificationService.showGameEnd(
        gameType: 'Checkers',
        result: gameStatus,
        roomId: roomId ?? 'unknown',
      );
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
      if (selectedIndex != null) {
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
    // Check if it's a valid move
    if (!isMyTurn || gameEnded || roomId == null || myPlayerIndex == null) {
      return;
    }

    final gameProvider = Provider.of<GameProvider>(context, listen: false);

    // Send move to server via WebSocket
    if (gameProvider.isConnected && roomId != null) {
      print('=== MAKING CHECKERS MOVE ===');
      print('Connected: ${gameProvider.isConnected}');
      print('Room ID: $roomId');
      print('From: $fromIndex To: $toIndex');

      // Send move to server without updating local state
      // Server will send back the updated game state
      // For checkers, server expects { from: number, to: number, isCapture: boolean }
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

      // Show error if no response in 10 seconds
      Future.delayed(const Duration(seconds: 10), () {
        if (mounted && gameStatus == 'Move sent, waiting for response...') {
          setState(() {
            _errorMessage = 'No response from server. Check your connection.';
            gameStatus = isMyTurn ? 'Your turn' : 'Opponent\'s turn';
          });
        }
      });
    } else {
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

    return (fromRow - toRow).abs() >= 2 && (fromCol - toCol).abs() >= 2;
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
      print('Successfully joined existing checkers room');
      setState(() {
        gameStatus = 'Joined existing game, waiting for start...';
      });
      return;
    }

    // If no existing room, start countdown timer and create new room
    _startSearchCountdown();

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Searching for opponent online...'),
        backgroundColor: AppTheme.primaryColor,
        duration: Duration(seconds: 2),
      ),
    );
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

  @override
  void dispose() {
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

              // Game status
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
                    if (myPlayerIndex != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        'You are playing as ${myPlayerIndex == 0 ? "red" : "black"}',
                        style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                              color: AppTheme.textSecondary,
                            ),
                      ),
                    ],
                    if (winner != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        'Game Over!',
                        style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                              color: AppTheme.accentColor,
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                    ],
                  ],
                ),
              ),

              const SizedBox(height: 30),

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

              const SizedBox(height: 30),

              // Action buttons
              Row(
                children: [
                  Expanded(
                    child: CustomButton(
                      text: gameEnded ? 'New Game' : 'Reset Game',
                      onPressed: _resetGame,
                      backgroundColor: AppTheme.primaryColor,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        CustomButton(
                          text: _isSearchingForOpponent
                              ? 'Searching...'
                              : 'Find Opponent',
                          onPressed:
                              _isSearchingForOpponent ? null : _findOpponent,
                          backgroundColor: _isSearchingForOpponent
                              ? AppTheme.accentColor.withOpacity(0.6)
                              : AppTheme.accentColor,
                        ),
                        if (_isSearchingForOpponent)
                          const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              valueColor:
                                  AlwaysStoppedAnimation<Color>(Colors.white),
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 20),

              // Back button
              CustomButton(
                text: 'Back to Games',
                onPressed: () => Navigator.of(context).pop(),
                backgroundColor: AppTheme.surfaceColor,
                textColor: AppTheme.textPrimary,
                width: double.infinity,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
