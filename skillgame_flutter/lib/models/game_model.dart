class GameType {
  static const String ticTacToe = 'tic-tac-toe';
  static const String checkers = 'checkers';
  static const String chess = 'chess';
  static const String backgammon = 'backgammon';
  static const String durak = 'durak';
  static const String domino = 'domino';
  static const String dice = 'dice';
  static const String bingo = 'bingo';
}

class Game {
  final String id;
  final String title;
  final String gameType;
  final String category;
  final double rating;
  final String duration;
  final int players;
  final String difficulty;
  final String? imageUrl;
  final String description;

  const Game({
    required this.id,
    required this.title,
    required this.gameType,
    required this.category,
    required this.rating,
    required this.duration,
    required this.players,
    required this.difficulty,
    this.imageUrl,
    this.description = '',
  });

  factory Game.fromJson(Map<String, dynamic> json) {
    return Game(
      id: json['id'] ?? '',
      title: json['title'] ?? '',
      gameType: json['gameType'] ?? '',
      category: json['category'] ?? '',
      rating: (json['rating'] ?? 0.0).toDouble(),
      duration: json['duration'] ?? '',
      players: json['players'] ?? 0,
      difficulty: json['difficulty'] ?? 'Easy',
      imageUrl: json['imageUrl'],
      description: json['description'] ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'gameType': gameType,
      'category': category,
      'rating': rating,
      'duration': duration,
      'players': players,
      'difficulty': difficulty,
      'imageUrl': imageUrl,
      'description': description,
    };
  }
}

class Room {
  final String id;
  final String gameType;
  final double bet;
  final List<Player> players;
  final GameState? gameState;
  final bool isPrivate;
  final String? invitationToken;
  final bool allowBots;
  final String? hostUserId;
  final DateTime? expiresAt;

  const Room({
    required this.id,
    required this.gameType,
    required this.bet,
    required this.players,
    this.gameState,
    this.isPrivate = false,
    this.invitationToken,
    this.allowBots = true,
    this.hostUserId,
    this.expiresAt,
  });

  factory Room.fromJson(Map<String, dynamic> json) {
    // Обработка данных лобби (упрощенный формат от сервера)
    if (json.containsKey('host') && !json.containsKey('players')) {
      List<Player> players = [];

      // Проверяем, что host содержит реального игрока, а не плейсхолдер
      if (json['host'] != null && json['host'] is Map) {
        final hostData = json['host'] as Map<String, dynamic>;
        if (hostData['user'] != null && hostData['user'] is Map) {
          final userData = hostData['user'] as Map<String, dynamic>;
          final username = userData['username'] ?? '';

          // Добавляем только реальных игроков (НЕ плейсхолдеры)
          if (username != 'Waiting for player' &&
              username.isNotEmpty &&
              username != 'Bot') {
            players.add(Player.fromJson({
              'socketId': hostData['socketId'] ?? 'host-socket',
              'user': userData
            }));
          }
        }
      }

      final room = Room(
        id: json['id'] ?? '',
        gameType: json['gameType'] ??
            'tic-tac-toe', // Fallback, должен быть установлен извне
        bet: (json['bet'] ?? 0.0).toDouble(),
        players: players,
        gameState: null,
        isPrivate: false,
        invitationToken: null,
        allowBots: true,
        hostUserId: null,
        expiresAt: null,
      );

      return room;
    }

    // Обычная обработка полных данных комнаты
    return Room(
      id: json['id'] ?? '',
      gameType: json['gameType'] ?? '',
      bet: (json['bet'] ?? 0.0).toDouble(),
      players: (json['players'] as List<dynamic>?)
              ?.map((p) => Player.fromJson(p))
              .toList() ??
          [],
      gameState: json['gameState'] != null
          ? GameState.fromJson(json['gameState'])
          : null,
      isPrivate: json['isPrivate'] ?? false,
      invitationToken: json['invitationToken'],
      allowBots: json['allowBots'] ?? true,
      hostUserId: json['hostUserId'],
      expiresAt:
          json['expiresAt'] != null ? DateTime.parse(json['expiresAt']) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'gameType': gameType,
      'bet': bet,
      'players': players.map((p) => p.toJson()).toList(),
      'gameState': gameState?.toJson(),
      'isPrivate': isPrivate,
      'invitationToken': invitationToken,
      'allowBots': allowBots,
      'hostUserId': hostUserId,
      'expiresAt': expiresAt?.toIso8601String(),
    };
  }
}

class Player {
  final String socketId;
  final PlayerUser user;

  const Player({
    required this.socketId,
    required this.user,
  });

  factory Player.fromJson(Map<String, dynamic> json) {
    return Player(
      socketId: json['socketId'] ?? '',
      user: PlayerUser.fromJson(json['user'] ?? {}),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'socketId': socketId,
      'user': user.toJson(),
    };
  }
}

class PlayerUser {
  final String id;
  final String username;
  final String avatar;
  final double balance;

  const PlayerUser({
    required this.id,
    required this.username,
    required this.avatar,
    required this.balance,
  });

  factory PlayerUser.fromJson(Map<String, dynamic> json) {
    return PlayerUser(
      id: json['_id'] ?? json['id'] ?? '',
      username: json['username'] ?? '',
      avatar: json['avatar'] ?? 'default_avatar.png',
      balance: (json['balance'] ?? 0.0).toDouble(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'username': username,
      'avatar': avatar,
      'balance': balance,
    };
  }
}

class GameState {
  final String? turn;
  final bool isGameFinished;
  final Map<String, dynamic> data;

  const GameState({
    this.turn,
    this.isGameFinished = false,
    this.data = const {},
  });

  factory GameState.fromJson(Map<String, dynamic> json) {
    return GameState(
      turn: json['turn'],
      isGameFinished: json['isGameFinished'] ?? false,
      data: Map<String, dynamic>.from(json),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'turn': turn,
      'isGameFinished': isGameFinished,
      ...data,
    };
  }
}

class GameMove {
  final String type;
  final Map<String, dynamic> data;

  const GameMove({
    required this.type,
    this.data = const {},
  });

  factory GameMove.fromJson(Map<String, dynamic> json) {
    return GameMove(
      type: json['type'] ?? '',
      data: Map<String, dynamic>.from(json)..remove('type'),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'type': type,
      ...data,
    };
  }
}
