class Tournament {
  final String id;
  final String name;
  final String gameType;
  final String status;
  final double entryFee;
  final double prizePool;
  final int maxPlayers;
  final List<TournamentPlayer> players;
  final List<TournamentRound> bracket;
  final double platformCommission;
  final DateTime? firstRegistrationTime;
  final DateTime? startedAt;
  final DateTime? finishedAt;
  final TournamentPlayer? winner;
  final DateTime createdAt;
  final DateTime updatedAt;

  const Tournament({
    required this.id,
    required this.name,
    required this.gameType,
    required this.status,
    required this.entryFee,
    required this.prizePool,
    required this.maxPlayers,
    required this.players,
    required this.bracket,
    required this.platformCommission,
    this.firstRegistrationTime,
    this.startedAt,
    this.finishedAt,
    this.winner,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Tournament.fromJson(Map<String, dynamic> json) {
    return Tournament(
      id: json['_id'] ?? '',
      name: json['name'] ?? '',
      gameType: json['gameType'] ?? '',
      status: json['status'] ?? 'WAITING',
      entryFee: (json['entryFee'] ?? 0.0).toDouble(),
      prizePool: (json['prizePool'] ?? 0.0).toDouble(),
      maxPlayers: json['maxPlayers'] ?? 8,
      players: (json['players'] as List<dynamic>?)
              ?.map((p) => TournamentPlayer.fromJson(p))
              .toList() ??
          [],
      bracket: (json['bracket'] as List<dynamic>?)
              ?.map((r) => TournamentRound.fromJson(r))
              .toList() ??
          [],
      platformCommission: (json['platformCommission'] ?? 10.0).toDouble(),
      firstRegistrationTime: json['firstRegistrationTime'] != null
          ? DateTime.parse(json['firstRegistrationTime'])
          : null,
      startedAt:
          json['startedAt'] != null ? DateTime.parse(json['startedAt']) : null,
      finishedAt: json['finishedAt'] != null
          ? DateTime.parse(json['finishedAt'])
          : null,
      winner: json['winner'] != null
          ? TournamentPlayer.fromJson(json['winner'])
          : null,
      createdAt:
          DateTime.parse(json['createdAt'] ?? DateTime.now().toIso8601String()),
      updatedAt:
          DateTime.parse(json['updatedAt'] ?? DateTime.now().toIso8601String()),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'name': name,
      'gameType': gameType,
      'status': status,
      'entryFee': entryFee,
      'prizePool': prizePool,
      'maxPlayers': maxPlayers,
      'players': players.map((p) => p.toJson()).toList(),
      'bracket': bracket.map((r) => r.toJson()).toList(),
      'platformCommission': platformCommission,
      'firstRegistrationTime': firstRegistrationTime?.toIso8601String(),
      'startedAt': startedAt?.toIso8601String(),
      'finishedAt': finishedAt?.toIso8601String(),
      'winner': winner?.toJson(),
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }

  bool get isActive => status == 'ACTIVE';
  bool get isWaiting => status == 'WAITING';
  bool get isFinished => status == 'FINISHED';
  int get currentPlayerCount => players.length;
  int get spotsRemaining => maxPlayers - players.length;
  bool get isFull => players.length >= maxPlayers;
}

class TournamentPlayer {
  final String id;
  final String username;
  final String? socketId;
  final bool isBot;
  final DateTime registeredAt;

  const TournamentPlayer({
    required this.id,
    required this.username,
    this.socketId,
    this.isBot = false,
    required this.registeredAt,
  });

  factory TournamentPlayer.fromJson(Map<String, dynamic> json) {
    return TournamentPlayer(
      id: json['_id'] ?? '',
      username: json['username'] ?? '',
      socketId: json['socketId'],
      isBot: json['isBot'] ?? false,
      registeredAt: DateTime.parse(
          json['registeredAt'] ?? DateTime.now().toIso8601String()),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'username': username,
      'socketId': socketId,
      'isBot': isBot,
      'registeredAt': registeredAt.toIso8601String(),
    };
  }
}

class TournamentMatch {
  final String matchId;
  final TournamentPlayer player1;
  final TournamentPlayer player2;
  final TournamentPlayer? winner;
  final String status;

  const TournamentMatch({
    required this.matchId,
    required this.player1,
    required this.player2,
    this.winner,
    this.status = 'WAITING',
  });

  factory TournamentMatch.fromJson(Map<String, dynamic> json) {
    return TournamentMatch(
      matchId: json['matchId'] ?? '',
      player1: TournamentPlayer.fromJson(json['player1'] ?? {}),
      player2: TournamentPlayer.fromJson(json['player2'] ?? {}),
      winner: json['winner'] != null
          ? TournamentPlayer.fromJson(json['winner'])
          : null,
      status: json['status'] ?? 'WAITING',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'matchId': matchId,
      'player1': player1.toJson(),
      'player2': player2.toJson(),
      'winner': winner?.toJson(),
      'status': status,
    };
  }
}

class TournamentRound {
  final int round;
  final List<TournamentMatch> matches;

  const TournamentRound({
    required this.round,
    required this.matches,
  });

  factory TournamentRound.fromJson(Map<String, dynamic> json) {
    return TournamentRound(
      round: json['round'] ?? 1,
      matches: (json['matches'] as List<dynamic>?)
              ?.map((m) => TournamentMatch.fromJson(m))
              .toList() ??
          [],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'round': round,
      'matches': matches.map((m) => m.toJson()).toList(),
    };
  }
}
