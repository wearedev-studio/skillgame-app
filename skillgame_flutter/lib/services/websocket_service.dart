import 'dart:convert';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:skillgame_flutter/models/game_model.dart';
import 'package:skillgame_flutter/utils/network_config.dart';

class WebSocketService {
  // Используем динамический URL из NetworkConfig
  static String get serverUrl => NetworkConfig.socketUrl;

  IO.Socket? _socket;
  bool _isConnected = false;
  String? _currentLobbyGameType; // Для отслеживания текущего типа лобби

  // Callbacks
  Function(bool)? onConnectionChange;
  Function(List<Room>)? onRoomsList;
  Function(Room)? onGameStart;
  Function(Room)? onGameUpdate;
  Function(Map<String, dynamic>)? onGameEnd;
  Function(String)? onError;
  Function(String)? onOpponentDisconnected;
  Function(String)? onPlayerReconnected;
  Function(Map<String, dynamic>)? onBalanceUpdated;
  Function(Map<String, dynamic>)? onGameTimeout;
  Function(Map<String, dynamic>)? onMoveTimerStart;
  Function(Map<String, dynamic>)? onMoveTimerWarning;
  Function(Map<String, dynamic>)? onPrivateRoomCreated;
  Function(Map<String, dynamic>)? onPrivateRoomInfo;
  Function(Map<String, dynamic>)? onChatJoined;
  Function(Map<String, dynamic>)? onNewMessage;
  Function(Map<String, dynamic>)? onChatError;
  Function(Map<String, dynamic>)? onMessagesRead;
  Function(Map<String, dynamic>)? onUserTyping;
  Function(Map<String, dynamic>)? onChatClosed;

  // Notification events
  Function(Map<String, dynamic>)? onNotificationReceived;
  Function(Map<String, dynamic>)? onNotificationRead;
  Function(Map<String, dynamic>)? onNotificationDeleted;
  Function(Map<String, dynamic>)? onBulkNotificationsRead;

  // KYC events
  Function(Map<String, dynamic>)? onKycVerificationStarted;
  Function(Map<String, dynamic>)? onKycVerificationCompleted;
  Function(Map<String, dynamic>)? onKycVerificationFailed;
  Function(Map<String, dynamic>)? onKycDocumentUploaded;

  // Tournament events
  Function(Map<String, dynamic>)? onTournamentStarted;
  Function(Map<String, dynamic>)? onTournamentEnded;
  Function(Map<String, dynamic>)? onTournamentBracketUpdated;
  Function(Map<String, dynamic>)? onTournamentPlayerRegistered;
  Function(Map<String, dynamic>)? onTournamentPlayerUnregistered;

  // Payment events
  Function(Map<String, dynamic>)? onPaymentInitiated;
  Function(Map<String, dynamic>)? onPaymentCompleted;
  Function(Map<String, dynamic>)? onPaymentFailed;
  Function(Map<String, dynamic>)? onDepositProcessed;
  Function(Map<String, dynamic>)? onWithdrawalProcessed;

  // Match events
  Function(Map<String, dynamic>)? onMatchCreated;
  Function(Map<String, dynamic>)? onMatchStarted;
  Function(Map<String, dynamic>)? onMatchEnded;
  Function(Map<String, dynamic>)? onMatchPlayerJoined;
  Function(Map<String, dynamic>)? onMatchPlayerLeft;

  bool get isConnected => _isConnected;

  Future<void> connect(String? token) async {
    try {
      print('Connecting to Socket.IO server: $serverUrl');
      print('Token: ${token != null ? 'Present' : 'Not provided'}');

      final optionBuilder = IO.OptionBuilder()
          .setTransports([
            'websocket',
            'polling'
          ]) // Fallback to polling if websocket fails
          .disableAutoConnect()
          .setTimeout(10000) // 10 second connection timeout
          .enableReconnection()
          .setReconnectionAttempts(5)
          .setReconnectionDelay(2000)
          .setReconnectionDelayMax(10000)
          .enableForceNew();

      if (token != null) {
        optionBuilder.setAuth({'token': 'Bearer $token'});
      }

      _socket = IO.io(serverUrl, optionBuilder.build());

      _setupEventListeners();
      _socket!.connect();

      print('Socket.IO connection initiated with enhanced settings');
    } catch (e) {
      print('Socket.IO connection failed: $e');
      _handleError(e);
    }
  }

  void _setupEventListeners() {
    _socket!.on('connect', (_) {
      print('Socket.IO connected successfully');
      _isConnected = true;
      onConnectionChange?.call(true);
    });

    _socket!.on('disconnect', (reason) {
      print('Socket.IO disconnected: $reason');
      _isConnected = false;
      onConnectionChange?.call(false);
    });

    _socket!.on('connect_error', (data) {
      print('Socket.IO connection error: $data');
      _handleError(data);
    });

    _socket!.on('reconnect', (attempt) {
      print('Socket.IO reconnected after $attempt attempts');
      _isConnected = true;
      onConnectionChange?.call(true);
    });

    _socket!.on('reconnect_attempt', (attempt) {
      print('Socket.IO reconnection attempt: $attempt');
    });

    _socket!.on('reconnect_error', (error) {
      print('Socket.IO reconnection error: $error');
      _handleError(error);
    });

    _socket!.on('reconnect_failed', (_) {
      print('Socket.IO reconnection failed after maximum attempts');
      _isConnected = false;
      onConnectionChange?.call(false);
      onError
          ?.call('Connection failed. Please check your internet connection.');
    });

    _socket!.on('error', (data) {
      print('Socket.IO error: $data');
      final errorMessage =
          data is Map ? data['message'] ?? 'Unknown error' : data.toString();

      // ИСПРАВЛЕНО: Не показываем "Wait for the second player" как критическую ошибку
      if (errorMessage != 'Wait for the second player') {
        onError?.call(errorMessage);
      } else {
        print(
            '⏳ SERVER: Waiting for second player (expected during room setup)');
      }
    });

    // Game events
    _socket!.on('roomsList', (data) {
      // УБРАНО: избыточное логгирование списка комнат
      if (data is List) {
        try {
          final rooms = data.map((r) {
            // Добавляем gameType из контекста текущего лобби если он отсутствует
            if (r is Map<String, dynamic> &&
                !r.containsKey('gameType') &&
                _currentLobbyGameType != null) {
              r['gameType'] = _currentLobbyGameType;
            }

            // Безопасно обрабатываем поле players
            if (r is Map<String, dynamic> && r.containsKey('players')) {
              // Если players это число - конвертируем в пустой список
              if (r['players'] is int) {
                r['players'] = <Map<String, dynamic>>[];
              }
            }

            return Room.fromJson(r);
          }).toList();

          print(
              '📋 ROOMS: Received ${rooms.length} rooms for $_currentLobbyGameType');
          onRoomsList?.call(rooms);
        } catch (e) {
          print('❌ ROOMS ERROR: Failed to parse rooms - $e');
        }
      }
    });

    _socket!.on('gameStart', (data) {
      print('🎮 GAME START: Game found and starting!');
      if (data is Map<String, dynamic>) {
        final roomData = data['room'] ?? data;
        final room = Room.fromJson(roomData);
        print('🆔 GAME START: Room ID = ${room.id}');
        print('👥 GAME START: Players = ${room.players.length}');
        print('🎯 GAME START: Game Type = ${room.gameType}');
        onGameStart?.call(room);
      }
    });

    _socket!.on('gameUpdate', (data) {
      if (data is Map<String, dynamic>) {
        final roomData = data['room'] ?? data;
        final room = Room.fromJson(roomData);
        print('🔄 GAME UPDATE: Room ${room.id}, Turn: ${room.gameState?.turn}');
        onGameUpdate?.call(room);
      }
    });

    _socket!.on('gameEnd', (data) {
      print('Received gameEnd: $data');
      if (data is Map<String, dynamic>) {
        onGameEnd?.call(data);
      }
    });

    _socket!.on('opponentDisconnected', (data) {
      print('Received opponentDisconnected: $data');
      final message = data is Map
          ? data['message'] ?? 'Opponent disconnected'
          : data.toString();
      onOpponentDisconnected?.call(message);
    });

    _socket!.on('playerReconnected', (data) {
      print('Received playerReconnected: $data');
      final message = data is Map
          ? data['message'] ?? 'Player reconnected'
          : data.toString();
      onPlayerReconnected?.call(message);
    });

    _socket!.on('balanceUpdated', (data) {
      print('Received balanceUpdated: $data');
      if (data is Map<String, dynamic>) {
        onBalanceUpdated?.call(data);
      }
    });

    _socket!.on('gameTimeout', (data) {
      print('Received gameTimeout: $data');
      if (data is Map<String, dynamic>) {
        onGameTimeout?.call(data);
      }
    });

    _socket!.on('moveTimerStart', (data) {
      print('Received moveTimerStart: $data');
      if (data is Map<String, dynamic>) {
        onMoveTimerStart?.call(data);
      }
    });

    _socket!.on('moveTimerWarning', (data) {
      print('Received moveTimerWarning: $data');
      if (data is Map<String, dynamic>) {
        onMoveTimerWarning?.call(data);
      }
    });

    _socket!.on('privateRoomCreated', (data) {
      print('Received privateRoomCreated: $data');
      if (data is Map<String, dynamic>) {
        onPrivateRoomCreated?.call(data);
      }
    });

    _socket!.on('privateRoomInfo', (data) {
      print('Received privateRoomInfo: $data');
      if (data is Map<String, dynamic>) {
        onPrivateRoomInfo?.call(data);
      }
    });

    // Chat events
    _socket!.on('chatJoined', (data) {
      print('Received chatJoined: $data');
      if (data is Map<String, dynamic>) {
        onChatJoined?.call(data);
      }
    });

    _socket!.on('newMessage', (data) {
      print('Received newMessage: $data');
      if (data is Map<String, dynamic>) {
        onNewMessage?.call(data);
      }
    });

    _socket!.on('chatError', (data) {
      print('Received chatError: $data');
      if (data is Map<String, dynamic>) {
        onChatError?.call(data);
      }
    });

    _socket!.on('messagesRead', (data) {
      print('Received messagesRead: $data');
      if (data is Map<String, dynamic>) {
        onMessagesRead?.call(data);
      }
    });

    _socket!.on('userTyping', (data) {
      print('Received userTyping: $data');
      if (data is Map<String, dynamic>) {
        onUserTyping?.call(data);
      }
    });

    _socket!.on('chatClosed', (data) {
      print('Received chatClosed: $data');
      if (data is Map<String, dynamic>) {
        onChatClosed?.call(data);
      }
    });

    // Notification events
    _socket!.on('notificationReceived', (data) {
      print('Received notificationReceived: $data');
      if (data is Map<String, dynamic>) {
        onNotificationReceived?.call(data);
      }
    });

    _socket!.on('notificationRead', (data) {
      print('Received notificationRead: $data');
      if (data is Map<String, dynamic>) {
        onNotificationRead?.call(data);
      }
    });

    _socket!.on('notificationDeleted', (data) {
      print('Received notificationDeleted: $data');
      if (data is Map<String, dynamic>) {
        onNotificationDeleted?.call(data);
      }
    });

    _socket!.on('bulkNotificationsRead', (data) {
      print('Received bulkNotificationsRead: $data');
      if (data is Map<String, dynamic>) {
        onBulkNotificationsRead?.call(data);
      }
    });

    // KYC events
    _socket!.on('kycVerificationStarted', (data) {
      print('Received kycVerificationStarted: $data');
      if (data is Map<String, dynamic>) {
        onKycVerificationStarted?.call(data);
      }
    });

    _socket!.on('kycVerificationCompleted', (data) {
      print('Received kycVerificationCompleted: $data');
      if (data is Map<String, dynamic>) {
        onKycVerificationCompleted?.call(data);
      }
    });

    _socket!.on('kycVerificationFailed', (data) {
      print('Received kycVerificationFailed: $data');
      if (data is Map<String, dynamic>) {
        onKycVerificationFailed?.call(data);
      }
    });

    _socket!.on('kycDocumentUploaded', (data) {
      print('Received kycDocumentUploaded: $data');
      if (data is Map<String, dynamic>) {
        onKycDocumentUploaded?.call(data);
      }
    });

    // Tournament events
    _socket!.on('tournamentStarted', (data) {
      print('Received tournamentStarted: $data');
      if (data is Map<String, dynamic>) {
        onTournamentStarted?.call(data);
      }
    });

    _socket!.on('tournamentEnded', (data) {
      print('Received tournamentEnded: $data');
      if (data is Map<String, dynamic>) {
        onTournamentEnded?.call(data);
      }
    });

    _socket!.on('tournamentBracketUpdated', (data) {
      print('Received tournamentBracketUpdated: $data');
      if (data is Map<String, dynamic>) {
        onTournamentBracketUpdated?.call(data);
      }
    });

    _socket!.on('tournamentPlayerRegistered', (data) {
      print('Received tournamentPlayerRegistered: $data');
      if (data is Map<String, dynamic>) {
        onTournamentPlayerRegistered?.call(data);
      }
    });

    _socket!.on('tournamentPlayerUnregistered', (data) {
      print('Received tournamentPlayerUnregistered: $data');
      if (data is Map<String, dynamic>) {
        onTournamentPlayerUnregistered?.call(data);
      }
    });

    // Payment events
    _socket!.on('paymentInitiated', (data) {
      print('Received paymentInitiated: $data');
      if (data is Map<String, dynamic>) {
        onPaymentInitiated?.call(data);
      }
    });

    _socket!.on('paymentCompleted', (data) {
      print('Received paymentCompleted: $data');
      if (data is Map<String, dynamic>) {
        onPaymentCompleted?.call(data);
      }
    });

    _socket!.on('paymentFailed', (data) {
      print('Received paymentFailed: $data');
      if (data is Map<String, dynamic>) {
        onPaymentFailed?.call(data);
      }
    });

    _socket!.on('depositProcessed', (data) {
      print('Received depositProcessed: $data');
      if (data is Map<String, dynamic>) {
        onDepositProcessed?.call(data);
      }
    });

    _socket!.on('withdrawalProcessed', (data) {
      print('Received withdrawalProcessed: $data');
      if (data is Map<String, dynamic>) {
        onWithdrawalProcessed?.call(data);
      }
    });

    // Match events
    _socket!.on('matchCreated', (data) {
      print('Received matchCreated: $data');
      if (data is Map<String, dynamic>) {
        onMatchCreated?.call(data);
      }
    });

    _socket!.on('matchStarted', (data) {
      print('Received matchStarted: $data');
      if (data is Map<String, dynamic>) {
        onMatchStarted?.call(data);
      }
    });

    _socket!.on('matchEnded', (data) {
      print('Received matchEnded: $data');
      if (data is Map<String, dynamic>) {
        onMatchEnded?.call(data);
      }
    });

    _socket!.on('matchPlayerJoined', (data) {
      print('Received matchPlayerJoined: $data');
      if (data is Map<String, dynamic>) {
        onMatchPlayerJoined?.call(data);
      }
    });

    _socket!.on('matchPlayerLeft', (data) {
      print('Received matchPlayerLeft: $data');
      if (data is Map<String, dynamic>) {
        onMatchPlayerLeft?.call(data);
      }
    });
  }

  void disconnect() {
    _socket?.disconnect();
    _socket?.dispose();
    _isConnected = false;
    onConnectionChange?.call(false);
  }

  void _handleError(dynamic error) {
    print('Socket.IO error: $error');
    _isConnected = false;
    onConnectionChange?.call(false);

    // More user-friendly error messages
    String userFriendlyMessage;
    final errorString = error.toString();
    if (errorString.contains('Connection closed before full header')) {
      userFriendlyMessage = 'Server is not available. Playing in offline mode.';
    } else if (errorString.contains('Connection refused') ||
        errorString.contains('ECONNREFUSED')) {
      userFriendlyMessage =
          'Unable to connect to game server. Check your connection.';
    } else {
      userFriendlyMessage = 'Connection issue. Some features may be limited.';
    }

    onError?.call(userFriendlyMessage);
  }

  void _emit(String event, dynamic data) {
    if (_isConnected && _socket != null) {
      print('Emitting $event with data: $data');
      _socket!.emit(event, data);
    } else {
      print('Cannot emit $event - not connected to server');
      onError?.call('Not connected to server');
    }
  }

  // Game actions
  void joinLobby(String gameType) {
    print('\======== JOINING LOBBY ========');
    print('Game type: $gameType');
    print('Socket connected: $_isConnected');
    print('Socket exists: ${_socket != null}');

    if (!_isConnected || _socket == null) {
      print('Cannot join lobby - not connected to server');
      return;
    }

    _currentLobbyGameType = gameType; // Сохраняем текущий тип лобби
    print('Emitting joinLobby event with gameType: $gameType');
    _emit('joinLobby', gameType);
    print('\======== LOBBY JOIN SENT ========');
  }

  void leaveLobby(String gameType) {
    _currentLobbyGameType = null; // Очищаем текущий тип лобби
    _emit('leaveLobby', gameType);
  }

  void requestRoomsList(String gameType) {
    print('\======== REQUESTING ROOMS LIST ========');
    print('Game type: $gameType');
    _emit('requestRoomsList', gameType);
    print('\======== ROOMS LIST REQUEST SENT ========');
  }

  void createRoom(String gameType, double bet) {
    _emit('createRoom', {
      'gameType': gameType,
      'bet': bet,
    });
  }

  void joinRoom(String roomId) {
    _emit('joinRoom', roomId);
  }

  void leaveGame(String roomId) {
    _emit('leaveGame', roomId);
  }

  void makeMove(String roomId, GameMove move) {
    // Сервер ожидает: socket.on('playerMove', ({ roomId, move }) => {...})
    // где move это непосредственно данные хода (без оболочки)
    final moveData = {
      'roomId': roomId,
      'move': move.data, // Отправляем только data без type
    };

    print('=== SENDING MOVE TO SERVER ===');
    print('Event: playerMove');
    print('Room ID: $roomId');
    print('Move Type (client-only): ${move.type}');
    print('Move Data: ${move.data}');
    print('Move Data Type: ${move.data.runtimeType}');
    print('Move Data Keys: ${move.data.keys.toList()}');
    print('Full payload: $moveData');
    print('Full payload Type: ${moveData.runtimeType}');
    print('Full payload Keys: ${moveData.keys.toList()}');
    print('JSON.encode test: ${json.encode(moveData)}');
    print('=== END MOVE DEBUG ===');

    _emit('playerMove', moveData);
  }

  void rollDice(String roomId) {
    _emit('rollDice', roomId);
  }

  void createPrivateRoom(String gameType, double bet) {
    _emit('createPrivateRoom', {
      'gameType': gameType,
      'bet': bet,
    });
  }

  void joinPrivateRoom(String token) {
    _emit('joinPrivateRoom', token);
  }

  void getPrivateRoomInfo(String token) {
    _emit('getPrivateRoomInfo', token);
  }

  void getGameState(String roomId) {
    _emit('getGameState', roomId);
  }

  // Tournament actions
  void joinTournamentGame(String matchId) {
    _emit('joinTournamentGame', matchId);
  }

  void leaveTournamentGame(String matchId) {
    _emit('leaveTournamentGame', matchId);
  }

  void tournamentMove(String matchId, GameMove move) {
    _emit('tournamentMove', {
      'matchId': matchId,
      'move': move.toJson(),
    });
  }

  void tournamentPlayerLeft(String matchId) {
    _emit('tournamentPlayerLeft', {
      'matchId': matchId,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    });
  }

  void tournamentPlayerReturned(String matchId) {
    _emit('tournamentPlayerReturned', {
      'matchId': matchId,
    });
  }

  void tournamentPlayerForfeited(String matchId, String? reason) {
    _emit('tournamentPlayerForfeited', {
      'matchId': matchId,
      'reason': reason,
    });
  }

  // Chat actions
  void joinChat(String? chatId, {String? userId, bool autoCreate = false}) {
    _emit('joinChat', {
      'chatId': chatId,
      'userId': userId,
      'autoCreate': autoCreate,
    });
  }

  void leaveChat(String chatId) {
    _emit('leaveChat', chatId);
  }

  void sendMessage({
    String? chatId,
    required String content,
    Map<String, String>? guestInfo,
    bool autoCreate = false,
  }) {
    _emit('sendMessage', {
      'chatId': chatId,
      'content': content,
      'guestInfo': guestInfo,
      'autoCreate': autoCreate,
    });
  }

  void markChatRead(String chatId) {
    _emit('markChatRead', chatId);
  }

  void chatTyping(String chatId, bool isTyping) {
    _emit('chatTyping', {
      'chatId': chatId,
      'isTyping': isTyping,
    });
  }

  void closeChat(String chatId) {
    _emit('closeChat', chatId);
  }

  // Notification actions
  void subscribeToNotifications() {
    _emit('subscribeNotifications', {});
  }

  void markNotificationRead(String notificationId) {
    _emit('markNotificationRead', notificationId);
  }

  void markAllNotificationsRead() {
    _emit('markAllNotificationsRead', {});
  }

  void deleteNotification(String notificationId) {
    _emit('deleteNotification', notificationId);
  }

  // KYC actions
  void startKycVerification(Map<String, dynamic> data) {
    _emit('startKycVerification', data);
  }

  void uploadKycDocument(Map<String, dynamic> data) {
    _emit('uploadKycDocument', data);
  }

  void checkKycStatus() {
    _emit('checkKycStatus', {});
  }

  // Match actions
  void subscribeToMatch(String matchId) {
    _emit('subscribeMatch', matchId);
  }

  void unsubscribeFromMatch(String matchId) {
    _emit('unsubscribeMatch', matchId);
  }

  // Payment actions
  void subscribeToPaymentUpdates() {
    _emit('subscribePayments', {});
  }

  void unsubscribeFromPaymentUpdates() {
    _emit('unsubscribePayments', {});
  }
}
