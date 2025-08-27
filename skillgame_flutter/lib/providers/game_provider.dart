import 'package:flutter/material.dart';
import 'package:collection/collection.dart'; // Для firstOrNull
import 'package:skillgame_flutter/models/game_model.dart';
import 'package:skillgame_flutter/services/websocket_service.dart';

class GameProvider extends ChangeNotifier {
  final WebSocketService _webSocketService;

  List<Room> _availableRooms = [];
  Room? _currentRoom;
  List<Game> _games = [];
  bool _isLoading = false;
  bool _isConnected = false;
  String? _error;

  List<Room> get availableRooms => _availableRooms;
  Room? get currentRoom => _currentRoom;
  List<Game> get games => _games;
  bool get isLoading => _isLoading;
  bool get isConnected => _isConnected;
  String? get error => _error;
  WebSocketService get webSocketService => _webSocketService;

  GameProvider(this._webSocketService) {
    _initializeGames();
    _webSocketService.onConnectionChange = (connected) {
      _isConnected = connected;
      notifyListeners();
    };

    _webSocketService.onRoomsList = (rooms) {
      _availableRooms = rooms;
      print('🏠 PROVIDER: Updated rooms list (${rooms.length} available)');
      notifyListeners();
    };

    _webSocketService.onGameStart = (room) {
      _currentRoom = room;
      notifyListeners();
    };

    _webSocketService.onGameUpdate = (room) {
      // ИСПРАВЛЕНО: Обрабатываем только обновления для СВОЕЙ комнаты
      if (_currentRoom != null && _currentRoom!.id == room.id) {
        print('✅ GAME UPDATE: Processing update for MY room ${room.id}');
        _currentRoom = room;
        notifyListeners();
      } else {
        print(
            '⚠️ GAME UPDATE: Ignoring update for foreign room ${room.id} (my room: ${_currentRoom?.id ?? "NULL"})');
      }
    };

    _webSocketService.onGameEnd = (result) {
      // Handle game end
      notifyListeners();
    };

    _webSocketService.onError = (error) {
      _setError(error);
    };
  }

  void _initializeGames() {
    _games = [
      const Game(
        id: 'tic-tac-toe',
        title: 'Tic Tac Toe',
        gameType: 'tic-tac-toe',
        category: 'Strategy',
        rating: 4.5,
        duration: '2 min',
        players: 2,
        difficulty: 'Easy',
        description: 'Classic Tic Tac Toe game',
      ),
      const Game(
        id: 'checkers',
        title: 'Checkers',
        gameType: 'checkers',
        category: 'Strategy',
        rating: 4.7,
        duration: '10 min',
        players: 2,
        difficulty: 'Medium',
        description: 'Traditional checkers game',
      ),
      const Game(
        id: 'chess',
        title: 'Chess',
        gameType: 'chess',
        category: 'Strategy',
        rating: 4.9,
        duration: '20 min',
        players: 2,
        difficulty: 'Hard',
        description: 'Classic chess game',
      ),
      const Game(
        id: 'backgammon',
        title: 'Backgammon',
        gameType: 'backgammon',
        category: 'Strategy',
        rating: 4.6,
        duration: '15 min',
        players: 2,
        difficulty: 'Medium',
        description: 'Traditional backgammon game',
      ),
      const Game(
        id: 'durak',
        title: 'Durak',
        gameType: 'durak',
        category: 'Card',
        rating: 4.4,
        duration: '8 min',
        players: 2,
        difficulty: 'Medium',
        description: 'Popular Russian card game',
      ),
      const Game(
        id: 'domino',
        title: 'Domino',
        gameType: 'domino',
        category: 'Strategy',
        rating: 4.3,
        duration: '6 min',
        players: 2,
        difficulty: 'Easy',
        description: 'Classic domino game',
      ),
      const Game(
        id: 'dice',
        title: 'Dice',
        gameType: 'dice',
        category: 'Luck',
        rating: 4.1,
        duration: '3 min',
        players: 2,
        difficulty: 'Easy',
        description: 'Dice rolling game',
      ),
      const Game(
        id: 'bingo',
        title: 'Bingo',
        gameType: 'bingo',
        category: 'Luck',
        rating: 4.2,
        duration: '5 min',
        players: 2,
        difficulty: 'Easy',
        description: 'Classic bingo game',
      ),
    ];
  }

  Future<void> connectToWebSocket(String? token) async {
    try {
      await _webSocketService.connect(token);
    } catch (e) {
      _setError('Failed to connect to game server: ${e.toString()}');
    }
  }

  void disconnectFromWebSocket() {
    _webSocketService.disconnect();
    _currentRoom = null;
    _availableRooms.clear();
    notifyListeners();
  }

  void joinLobby(String gameType) {
    _webSocketService.joinLobby(gameType);
  }

  void leaveLobby(String gameType) {
    _webSocketService.leaveLobby(gameType);
  }

  // ИСПРАВЛЕНО: Сначала ищем существующие комнаты, потом создаем новую
  Future<bool> findAndJoinAvailableRoom(String gameType) async {
    try {
      print('🔍 SEARCH START: Looking for $gameType rooms...');

      if (!_isConnected) {
        print('❌ SEARCH FAILED: Not connected to WebSocket');
        return false;
      }

      // Запрашиваем актуальный список комнат
      print('📡 SEARCH: Requesting rooms list...');
      _webSocketService.requestRoomsList(gameType);

      // Ждем немного для получения списка комнат
      await Future.delayed(const Duration(milliseconds: 500));

      print('🔍 SEARCH: Available rooms: ${_availableRooms.length}');

      // Ищем доступную комнату с подходящими параметрами
      final matchingRooms =
          _availableRooms.where((room) => room.gameType == gameType).toList();

      print('🔍 SEARCH: Matching gameType rooms: ${matchingRooms.length}');

      final availableRoom = matchingRooms
          .where((room) =>
              room.players.length < 2 &&
              room.bet <= 0.0) // Ищем комнаты с низкой/нулевой ставкой
          .firstOrNull;

      if (availableRoom != null) {
        print(
            '✅ SEARCH SUCCESS: Found room ${availableRoom.id} with ${availableRoom.players.length} players, bet: ${availableRoom.bet}');
        await joinRoom(availableRoom.id);
        return true;
      } else {
        // Если нет подходящих комнат - создаем новую
        print(
            '🆕 SEARCH: No suitable rooms found (checked ${matchingRooms.length} rooms), creating new room');
        await createRoom(gameType, 0.0);
        return true;
      }
    } catch (e) {
      print('❌ SEARCH ERROR: $e');
      return false;
    }
  }

  Future<void> createRoom(String gameType, double bet) async {
    print('🔨 CREATE: Creating room for $gameType with bet $bet');
    _setLoading(true);
    try {
      _webSocketService.createRoom(gameType, bet);
    } catch (e) {
      print('❌ CREATE ERROR: ${e.toString()}');
      _setError('Failed to create room: ${e.toString()}');
    } finally {
      _setLoading(false);
    }
  }

  Future<void> joinRoom(String roomId) async {
    print('🚪 JOIN: Joining room $roomId');
    _setLoading(true);
    try {
      _webSocketService.joinRoom(roomId);
    } catch (e) {
      print('❌ JOIN ERROR: ${e.toString()}');
      _setError('Failed to join room: ${e.toString()}');
    } finally {
      _setLoading(false);
    }
  }

  void leaveRoom() {
    if (_currentRoom != null) {
      _webSocketService.leaveGame(_currentRoom!.id);
      _currentRoom = null;
      notifyListeners();
    }
  }

  void makeMove(GameMove move) {
    print('=== GAME PROVIDER MAKE MOVE ===');
    print('Current room: ${_currentRoom?.id ?? "NULL"}');
    print('Current room data: ${_currentRoom?.toJson()}');
    print('Move type: ${move.type}');
    print('Move data: ${move.data}');
    print('=== END GAME PROVIDER MAKE MOVE ===');

    if (_currentRoom != null) {
      print('=== CALLING WEBSOCKET SERVICE ===');
      _webSocketService.makeMove(_currentRoom!.id, move);
    } else {
      print('=== CANNOT MAKE MOVE - NO CURRENT ROOM ===');
      _setError('Game session not found. Please restart the game.');
    }
  }

  void rollDice() {
    if (_currentRoom != null && _currentRoom!.gameType == 'backgammon') {
      _webSocketService.rollDice(_currentRoom!.id);
    }
  }

  Future<void> createPrivateRoom(String gameType, double bet) async {
    _setLoading(true);
    try {
      _webSocketService.createPrivateRoom(gameType, bet);
    } catch (e) {
      _setError('Failed to create private room: ${e.toString()}');
    } finally {
      _setLoading(false);
    }
  }

  Future<void> joinPrivateRoom(String token) async {
    _setLoading(true);
    try {
      _webSocketService.joinPrivateRoom(token);
    } catch (e) {
      _setError('Failed to join private room: ${e.toString()}');
    } finally {
      _setLoading(false);
    }
  }

  Game? getGameByType(String gameType) {
    try {
      return _games.firstWhere((game) => game.gameType == gameType);
    } catch (e) {
      return null;
    }
  }

  void _setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }

  void _setError(String error) {
    _error = error;
    notifyListeners();
  }

  void _clearError() {
    _error = null;
  }

  void clearError() {
    _clearError();
    notifyListeners();
  }

  @override
  void dispose() {
    _webSocketService.disconnect();
    super.dispose();
  }
}
