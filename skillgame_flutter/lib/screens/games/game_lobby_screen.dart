import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:collection/collection.dart'; // Для firstOrNull
import 'package:skillgame_flutter/providers/game_provider.dart';
import 'package:skillgame_flutter/providers/auth_provider.dart';
import 'package:skillgame_flutter/utils/theme.dart';
import 'package:skillgame_flutter/models/game_model.dart';
import 'package:skillgame_flutter/screens/games/tic_tac_toe_screen.dart';
import 'package:skillgame_flutter/screens/games/chess_screen.dart';
import 'package:skillgame_flutter/screens/games/checkers_screen.dart';

class GameLobbyScreen extends StatefulWidget {
  final String gameType;
  final String gameTitle;

  const GameLobbyScreen({
    super.key,
    required this.gameType,
    required this.gameTitle,
  });

  @override
  State<GameLobbyScreen> createState() => _GameLobbyScreenState();
}

class _GameLobbyScreenState extends State<GameLobbyScreen> {
  double _selectedBet = 5.0;
  final List<double> _betOptions = [5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100];
  bool _isSearching = false;
  bool _isCreatingRoom = false;
  Timer? _periodicTimer;
  GameProvider?
      _gameProvider; // Сохраняем ссылку для безопасного использования в dispose

  @override
  void initState() {
    super.initState();
    // ИСПРАВЛЕНО: Сохраняем provider для безопасного использования
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _gameProvider = Provider.of<GameProvider>(context, listen: false);
      _setupGameProviderCallbacks();
      _joinLobby();
      _startPeriodicRoomsCheck();
    });
  }

  void _setupGameProviderCallbacks() {
    final gameProvider = _gameProvider!; // Используем сохраненную ссылку

    // Когда найдена игра - переходим к игровому экрану
    // НЕ переопределяем callback GameProvider!
    final originalOnGameStart = gameProvider.webSocketService.onGameStart;

    gameProvider.webSocketService.onGameStart = (room) {
      // Сначала вызываем оригинальный callback GameProvider
      originalOnGameStart?.call(room);

      // Потом наш локальный callback
      if (mounted && room.gameType == widget.gameType) {
        // ИСПРАВЛЕНО: Останавливаем поиск только если есть 2+ игроков
        print(
            '=== GAME LOBBY: Game found with ${room.players.length} players ===');
        try {
          if (mounted) {
            setState(() {
              if (room.players.length >= 2) {
                _isSearching = false;
                _isCreatingRoom = false;
                print('=== LOBBY: Stopping search - 2+ players found ===');
              } else {
                print(
                    '=== LOBBY: Keeping search active - waiting for more players ===');
              }
            });
          }
          _navigateToGameScreen(room);
        } catch (e) {
          print('GameLobbyScreen setState error (expected if navigating): $e');
          // Все равно переходим к игровому экрану
          _navigateToGameScreen(room);
        }
      }
    };

    // Обработка ошибок
    gameProvider.webSocketService.onError = (error) {
      if (mounted) {
        setState(() {
          _isSearching = false;
          _isCreatingRoom = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(error),
            backgroundColor: Colors.red,
          ),
        );
      }
    };
  }

  void _joinLobby() {
    print('🏛️ LOBBY: Joining ${widget.gameType} lobby');
    final gameProvider = Provider.of<GameProvider>(context, listen: false);

    // НЕ переопределяем onRoomsList callback - он уже установлен в GameProvider
    // Просто присоединяемся к лобби
    gameProvider.joinLobby(widget.gameType);

    // Через секунду после присоединения к лобби запрашиваем список комнат
    Timer(const Duration(seconds: 1), () {
      if (mounted) {
        gameProvider.webSocketService.requestRoomsList(widget.gameType);
      }
    });
  }

  void _startPeriodicRoomsCheck() {
    // Отменяем предыдущий таймер если есть
    _periodicTimer?.cancel();

    // УБРАНО: избыточное логгирование периодических проверок
    _periodicTimer = Timer.periodic(const Duration(seconds: 5), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }

      try {
        final gameProvider = Provider.of<GameProvider>(context, listen: false);
        // Просто запрашиваем обновление списка комнат без логов
        gameProvider.webSocketService.requestRoomsList(widget.gameType);
      } catch (e) {
        print('❌ LOBBY ERROR: Periodic check failed - $e');
        timer.cancel();
      }
    });
  }

  void _navigateToGameScreen(Room room) {
    // Проверяем что виджет еще активен перед навигацией
    if (!mounted) {
      print('GameLobbyScreen not mounted, skipping navigation');
      return;
    }

    Widget gameScreen;

    switch (widget.gameType) {
      case 'tic-tac-toe':
        gameScreen = const TicTacToeScreen();
        break;
      case 'chess':
        gameScreen = const ChessScreen();
        break;
      case 'checkers':
        gameScreen = const CheckersScreen();
        break;
      default:
        try {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Game screen not available yet!')),
            );
          }
        } catch (e) {
          print('Error showing snackbar: $e');
        }
        return;
    }

    try {
      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (context) => gameScreen),
        );
      }
    } catch (e) {
      print('Navigation error (widget may be deactivated): $e');
      // Navigation не удалась, но это не критично если виджет уже закрывается
    }
  }

  void _createRoom() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final gameProvider = Provider.of<GameProvider>(context, listen: false);

    if (authProvider.user?.balance == null ||
        authProvider.user!.balance < _selectedBet) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content:
              Text('Insufficient balance! Please add funds to your account.'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    setState(() {
      _isCreatingRoom = true;
    });

    await gameProvider.createRoom(widget.gameType, _selectedBet);
  }

  void _joinRoom(String roomId) async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final gameProvider = Provider.of<GameProvider>(context, listen: false);

    // Найти комнату по ID чтобы проверить ставку
    final room = gameProvider.availableRooms.firstWhere(
      (r) => r.id == roomId,
      orElse: () => Room(
        id: roomId,
        gameType: widget.gameType,
        bet: _selectedBet,
        players: [],
        gameState: null,
      ),
    );

    if (authProvider.user?.balance == null ||
        authProvider.user!.balance < room.bet) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Insufficient balance for this room!'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    setState(() {
      _isSearching = true;
    });

    await gameProvider.joinRoom(roomId);
  }

  void _quickMatch() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final gameProvider = Provider.of<GameProvider>(context, listen: false);

    if (authProvider.user?.balance == null ||
        authProvider.user!.balance < _selectedBet) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content:
              Text('Insufficient balance! Please add funds to your account.'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    setState(() {
      _isSearching = true;
    });

    print('🎯 LOBBY: Quick match started for ${widget.gameType}');

    // ИСПРАВЛЕНО: Используем улучшенный метод поиска/создания комнат
    bool success = await gameProvider.findAndJoinAvailableRoom(widget.gameType);

    if (!success) {
      print('❌ LOBBY: Quick match failed');
      setState(() {
        _isSearching = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Failed to find or create game room'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  void _cancelSearch() {
    print('🚫 LOBBY: Search cancelled by user');
    final gameProvider = Provider.of<GameProvider>(context, listen: false);

    setState(() {
      _isSearching = false;
      _isCreatingRoom = false;
    });

    // Покинуть текущую комнату если есть
    if (gameProvider.currentRoom != null) {
      gameProvider.leaveRoom();
    }

    // Покинуть лобби и присоединиться заново для сброса состояния
    gameProvider.leaveLobby(widget.gameType);

    Future.delayed(const Duration(milliseconds: 500), () {
      if (mounted) {
        gameProvider.joinLobby(widget.gameType);
      }
    });

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Search cancelled'),
        backgroundColor: AppTheme.primaryColor,
      ),
    );
  }

  @override
  void dispose() {
    // Отменяем таймер перед закрытием экрана
    _periodicTimer?.cancel();

    // ИСПРАВЛЕНО: Используем сохраненную ссылку вместо Provider.of()
    try {
      _gameProvider?.leaveLobby(widget.gameType);
    } catch (e) {
      print('GameLobbyScreen dispose error (safe to ignore): $e');
    }

    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        title: Text('${widget.gameTitle} Lobby'),
        backgroundColor: AppTheme.backgroundColor,
        foregroundColor: AppTheme.textPrimary,
        elevation: 0,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildBalanceCard(),
              const SizedBox(height: 20),
              _buildBetSelector(),
              const SizedBox(height: 30),
              _buildQuickMatchButton(),
              const SizedBox(height: 20),
              _buildCreateRoomButton(),
              const SizedBox(height: 30),
              _buildAvailableRoomsList(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBalanceCard() {
    return Consumer<AuthProvider>(
      builder: (context, authProvider, child) {
        final balance = authProvider.user?.balance ?? 0.0;
        return Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [AppTheme.primaryColor, AppTheme.secondaryColor],
            ),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Your Balance',
                style: TextStyle(
                  color: Colors.white70,
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 5),
              Text(
                '\$${balance.toStringAsFixed(2)}',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildBetSelector() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Select Bet Amount',
          style: TextStyle(
            color: AppTheme.textPrimary,
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 15),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: _betOptions.map((bet) {
            final isSelected = bet == _selectedBet;
            return GestureDetector(
              onTap: () {
                setState(() {
                  _selectedBet = bet;
                });
              },
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                decoration: BoxDecoration(
                  color: isSelected
                      ? AppTheme.primaryColor
                      : AppTheme.surfaceColor,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: isSelected
                        ? AppTheme.primaryColor
                        : AppTheme.textSecondary,
                  ),
                ),
                child: Text(
                  '\$${bet.toInt()}',
                  style: TextStyle(
                    color: isSelected ? Colors.white : AppTheme.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildQuickMatchButton() {
    return SizedBox(
      width: double.infinity,
      height: 50,
      child: ElevatedButton(
        onPressed:
            (_isSearching || _isCreatingRoom) ? _cancelSearch : _quickMatch,
        style: ElevatedButton.styleFrom(
          backgroundColor: (_isSearching || _isCreatingRoom)
              ? Colors.red
              : AppTheme.primaryColor,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
        child: _isSearching || _isCreatingRoom
            ? const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.close, color: Colors.white),
                  SizedBox(width: 8),
                  Text('Cancel Search'),
                ],
              )
            : Text(
                'Quick Match (\$${_selectedBet.toInt()})',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
      ),
    );
  }

  Widget _buildCreateRoomButton() {
    return SizedBox(
      width: double.infinity,
      height: 50,
      child: OutlinedButton(
        onPressed: (_isSearching || _isCreatingRoom) ? null : _createRoom,
        style: OutlinedButton.styleFrom(
          foregroundColor: AppTheme.primaryColor,
          side: const BorderSide(color: AppTheme.primaryColor),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
        child: Text(
          'Create Room (\$${_selectedBet.toInt()})',
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }

  Widget _buildAvailableRoomsList() {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Available Rooms',
            style: TextStyle(
              color: AppTheme.textPrimary,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 15),
          Expanded(
            child: Consumer<GameProvider>(
              builder: (context, gameProvider, child) {
                // УБРАНО: избыточное логгирование UI фильтрации
                final rooms = gameProvider.availableRooms
                    .where((room) => room.gameType == widget.gameType)
                    .toList();

                if (rooms.isEmpty) {
                  return const Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.search_off,
                          size: 64,
                          color: AppTheme.textSecondary,
                        ),
                        SizedBox(height: 16),
                        Text(
                          'No available rooms',
                          style: TextStyle(
                            color: AppTheme.textSecondary,
                            fontSize: 16,
                          ),
                        ),
                        SizedBox(height: 8),
                        Text(
                          'Create a room or use Quick Match',
                          style: TextStyle(
                            color: AppTheme.textSecondary,
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ),
                  );
                }

                return ListView.separated(
                  itemCount: rooms.length,
                  separatorBuilder: (context, index) =>
                      const SizedBox(height: 12),
                  itemBuilder: (context, index) {
                    final room = rooms[index];
                    return _buildRoomCard(room);
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRoomCard(Room room) {
    final hostName = room.players.isNotEmpty
        ? room.players.first.user.username
        : 'Waiting for player';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.surfaceColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.textSecondary.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  hostName,
                  style: const TextStyle(
                    color: AppTheme.textPrimary,
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Bet: \$${room.bet.toInt()}',
                  style: const TextStyle(
                    color: AppTheme.textSecondary,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Players: ${room.players.length}/2',
                  style: const TextStyle(
                    color: AppTheme.textSecondary,
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),
          ElevatedButton(
            onPressed: _isSearching ? null : () => _joinRoom(room.id),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primaryColor,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
            child: const Text('Join'),
          ),
        ],
      ),
    );
  }
}
