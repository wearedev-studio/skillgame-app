import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:skillgame_flutter/providers/game_provider.dart';
import 'package:skillgame_flutter/providers/auth_provider.dart';
import 'package:skillgame_flutter/models/game_model.dart';
import 'package:skillgame_flutter/services/notification_service.dart';
import 'package:skillgame_flutter/utils/theme.dart';
import 'package:skillgame_flutter/widgets/custom_button.dart';

class ChessScreen extends StatefulWidget {
  const ChessScreen({super.key});

  @override
  State<ChessScreen> createState() => _ChessScreenState();
}

class _ChessScreenState extends State<ChessScreen> {
  // Chess board represented as 8x8 grid
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

  void _initGame() {
    _gameProvider = Provider.of<GameProvider>(context, listen: false);
    final authProvider = Provider.of<AuthProvider>(context, listen: false);

    if (authProvider.isAuthenticated) {
      // Connect to WebSocket and setup listeners
      _gameProvider!.connectToWebSocket(authProvider.token!);
      _setupGameListeners(_gameProvider!);

      // Join lobby to find opponent
      _gameProvider!.joinLobby('chess');
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
      myColor = null;
      roomId = null;
      selectedPiece = null;
      selectedRow = null;
      selectedCol = null;
    });

    // Create room, server will add bot automatically if no human player joins
    gameProvider.createRoom('chess', 0.0);
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

        // Determine player color based on position in room
        final players = room.players;
        if (players.isNotEmpty) {
          final authProvider =
              Provider.of<AuthProvider>(context, listen: false);
          final myPlayer = players.firstWhere(
            (p) => p.user.id == authProvider.user?.id,
            orElse: () => players.first,
          );
          final myIndex = players.indexOf(myPlayer);
          myColor = myIndex == 0 ? 'white' : 'black';
          isMyTurn = myColor == 'white'; // White goes first
        }
      });
    };

    // Listen for game updates
    gameProvider.webSocketService.onGameUpdate = (room) {
      if (room.gameState != null) {
        setState(() {
          final gameData = room.gameState!.data;

          // Update board from server - server sends chess board as 8x8 array
          if (gameData['board'] != null) {
            final boardData = gameData['board'] as List<dynamic>;
            board = List.generate(8, (row) {
              final rowData = boardData[row] as List<dynamic>;
              return List.generate(8, (col) {
                final piece = rowData[col];
                return _convertServerPieceToUnicode(piece);
              });
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
                winner = myColor;
                gameStatus = 'You win!';
              } else {
                winner = myColor == 'white' ? 'black' : 'white';
                gameStatus = 'Opponent wins!';
              }
            } else {
              winner = null;
              gameStatus = 'Draw!';
            }

            // Show game end notification
            NotificationService.showGameEnd(
              gameType: 'Chess',
              result: gameStatus,
              roomId: roomId!,
            );
          } else {
            gameStatus = isMyTurn ? 'Your turn' : 'Opponent\'s turn';

            // Show your turn notification
            if (isMyTurn) {
              NotificationService.showYourTurn(
                gameType: 'Chess',
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
        gameType: 'Chess',
        result: gameStatus,
        roomId: roomId ?? 'unknown',
      );
    };

    // Listen for opponent disconnected
    gameProvider.webSocketService.onOpponentDisconnected = (message) {
      if (roomId != null) {
        NotificationService.showOpponentDisconnected(
          gameType: 'Chess',
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

  void _onSquareTapped(int row, int col) {
    if (!isMyTurn || gameEnded || roomId == null) return;

    final piece = board[row][col];

    if (selectedPiece == null) {
      // Select a piece if it belongs to current player
      if (piece.isNotEmpty && _isPieceOwnedByPlayer(piece, myColor!)) {
        setState(() {
          selectedPiece = piece;
          selectedRow = row;
          selectedCol = col;
        });
      }
    } else {
      // Try to move the selected piece
      if (selectedRow != null && selectedCol != null) {
        _makeMove(selectedRow!, selectedCol!, row, col);
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

      return pieceSymbols[pieceColor]?[pieceType] ?? '';
    }

    // Fallback: if piece is already a string (Unicode symbol)
    return piece.toString();
  }

  void _makeMove(int fromRow, int fromCol, int toRow, int toCol) {
    // Check if it's a valid move
    if (!isMyTurn || gameEnded || roomId == null) {
      return;
    }

    final gameProvider = Provider.of<GameProvider>(context, listen: false);

    // Send move to server via WebSocket
    if (gameProvider.isConnected && roomId != null) {
      print('=== MAKING CHESS MOVE ===');
      print('Connected: ${gameProvider.isConnected}');
      print('Room ID: $roomId');
      print('From: ($fromRow, $fromCol) To: ($toRow, $toCol)');

      // Send move to server without updating local state
      // Server will send back the updated game state
      // For chess, server expects { from: {row, col}, to: {row, col} }
      gameProvider.makeMove(GameMove(
        type: 'chessMove', // Only for client logic
        data: {
          'from': {'row': fromRow, 'col': fromCol},
          'to': {'row': toRow, 'col': toCol},
          // Note: promotion handling would need to be added for pawn promotion
        },
      ));

      setState(() {
        selectedPiece = null;
        selectedRow = null;
        selectedCol = null;
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
        myColor = null;
        roomId = null;
        selectedPiece = null;
        selectedRow = null;
        selectedCol = null;
      });

      // Join lobby again to find new opponent
      gameProvider.joinLobby('chess');
    }
  }

  void _createRoom() {
    final gameProvider = Provider.of<GameProvider>(context, listen: false);
    gameProvider.createRoom('chess', 0.0); // No bet for demo
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
      myColor = null;
      roomId = null;
      selectedPiece = null;
      selectedRow = null;
      selectedCol = null;
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

    gameProvider.joinLobby('chess');

    // Try to find and join an existing room first
    bool joinedExistingRoom =
        await gameProvider.findAndJoinAvailableRoom('chess');

    if (joinedExistingRoom) {
      print('Successfully joined existing chess room');
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
            'Currently there are no other players looking for a Chess match.\n\nWould you like to:',
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
                    if (myColor != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        'You are playing as ${myColor!}',
                        style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                              color: AppTheme.textSecondary,
                            ),
                      ),
                    ],
                    if (winner != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        'Congratulations!',
                        style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                              color: AppTheme.accentColor,
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                    ],
                    if (_isSearchingForOpponent &&
                        _searchTimeoutSeconds > 5) ...[
                      const SizedBox(height: 12),
                      Text(
                        'This may take a while if no players are online',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: AppTheme.textSecondary,
                            ),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ],
                ),
              ),

              const SizedBox(height: 30),

              // Chess board
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

              const SizedBox(height: 30),

              // Action buttons
              Row(
                children: [
                  Expanded(
                    child: CustomButton(
                      text: 'New Game',
                      onPressed: _resetGame,
                      backgroundColor: AppTheme.primaryColor,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: CustomButton(
                      text: _isSearchingForOpponent
                          ? 'Searching...'
                          : 'Find Opponent',
                      onPressed: _isSearchingForOpponent ? null : _findOpponent,
                      backgroundColor: _isSearchingForOpponent
                          ? AppTheme.textSecondary.withOpacity(0.5)
                          : AppTheme.accentColor,
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
