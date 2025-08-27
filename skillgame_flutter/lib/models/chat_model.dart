class Chat {
  final String id;
  final String type;
  final List<String> participants;
  final String? name;
  final String? description;
  final List<ChatMessage> messages;
  final Map<String, DateTime> lastRead;
  final ChatMessage? lastMessage;
  final bool isActive;
  final DateTime createdAt;
  final DateTime updatedAt;

  const Chat({
    required this.id,
    required this.type,
    required this.participants,
    this.name,
    this.description,
    this.messages = const [],
    this.lastRead = const {},
    this.lastMessage,
    this.isActive = true,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Chat.fromJson(Map<String, dynamic> json) {
    return Chat(
      id: json['_id'] ?? '',
      type: json['type'] ?? ChatType.direct,
      participants: List<String>.from(json['participants'] ?? []),
      name: json['name'],
      description: json['description'],
      messages: (json['messages'] as List<dynamic>?)
              ?.map((m) => ChatMessage.fromJson(m))
              .toList() ??
          [],
      lastRead: Map<String, DateTime>.from(
        (json['lastRead'] as Map<String, dynamic>?)?.map(
              (key, value) => MapEntry(
                key,
                DateTime.parse(value),
              ),
            ) ??
            {},
      ),
      lastMessage: json['lastMessage'] != null
          ? ChatMessage.fromJson(json['lastMessage'])
          : null,
      isActive: json['isActive'] ?? true,
      createdAt:
          DateTime.parse(json['createdAt'] ?? DateTime.now().toIso8601String()),
      updatedAt:
          DateTime.parse(json['updatedAt'] ?? DateTime.now().toIso8601String()),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'type': type,
      'participants': participants,
      'name': name,
      'description': description,
      'messages': messages.map((m) => m.toJson()).toList(),
      'lastRead': lastRead.map(
        (key, value) => MapEntry(key, value.toIso8601String()),
      ),
      'lastMessage': lastMessage?.toJson(),
      'isActive': isActive,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }

  int getUnreadCount(String userId) {
    if (!lastRead.containsKey(userId)) {
      return messages.length;
    }

    final lastReadTime = lastRead[userId]!;
    return messages
        .where((msg) =>
            msg.timestamp.isAfter(lastReadTime) && msg.senderId != userId)
        .length;
  }

  bool get isDirect => type == ChatType.direct;
  bool get isGroup => type == ChatType.group;
  bool get isGame => type == ChatType.game;
  bool get isTournament => type == ChatType.tournament;
}

class ChatMessage {
  final String id;
  final String chatId;
  final String senderId;
  final String? senderName;
  final String content;
  final String type;
  final Map<String, dynamic>? metadata;
  final bool isEdited;
  final bool isDeleted;
  final DateTime timestamp;
  final DateTime? editedAt;

  const ChatMessage({
    required this.id,
    required this.chatId,
    required this.senderId,
    this.senderName,
    required this.content,
    this.type = MessageType.text,
    this.metadata,
    this.isEdited = false,
    this.isDeleted = false,
    required this.timestamp,
    this.editedAt,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      id: json['_id'] ?? '',
      chatId: json['chatId'] ?? '',
      senderId: json['senderId'] ?? '',
      senderName: json['senderName'],
      content: json['content'] ?? '',
      type: json['type'] ?? MessageType.text,
      metadata: json['metadata'],
      isEdited: json['isEdited'] ?? false,
      isDeleted: json['isDeleted'] ?? false,
      timestamp:
          DateTime.parse(json['timestamp'] ?? DateTime.now().toIso8601String()),
      editedAt:
          json['editedAt'] != null ? DateTime.parse(json['editedAt']) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'chatId': chatId,
      'senderId': senderId,
      'senderName': senderName,
      'content': content,
      'type': type,
      'metadata': metadata,
      'isEdited': isEdited,
      'isDeleted': isDeleted,
      'timestamp': timestamp.toIso8601String(),
      'editedAt': editedAt?.toIso8601String(),
    };
  }

  bool get isText => type == MessageType.text;
  bool get isImage => type == MessageType.image;
  bool get isFile => type == MessageType.file;
  bool get isSystem => type == MessageType.system;
  bool get isGameMove => type == MessageType.gameMove;
}

class ChatParticipant {
  final String userId;
  final String username;
  final String? avatar;
  final String role;
  final bool isOnline;
  final DateTime joinedAt;
  final DateTime? lastSeenAt;

  const ChatParticipant({
    required this.userId,
    required this.username,
    this.avatar,
    this.role = ParticipantRole.member,
    this.isOnline = false,
    required this.joinedAt,
    this.lastSeenAt,
  });

  factory ChatParticipant.fromJson(Map<String, dynamic> json) {
    return ChatParticipant(
      userId: json['userId'] ?? '',
      username: json['username'] ?? '',
      avatar: json['avatar'],
      role: json['role'] ?? ParticipantRole.member,
      isOnline: json['isOnline'] ?? false,
      joinedAt:
          DateTime.parse(json['joinedAt'] ?? DateTime.now().toIso8601String()),
      lastSeenAt: json['lastSeenAt'] != null
          ? DateTime.parse(json['lastSeenAt'])
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'userId': userId,
      'username': username,
      'avatar': avatar,
      'role': role,
      'isOnline': isOnline,
      'joinedAt': joinedAt.toIso8601String(),
      'lastSeenAt': lastSeenAt?.toIso8601String(),
    };
  }

  bool get isAdmin => role == ParticipantRole.admin;
  bool get isModerator => role == ParticipantRole.moderator;
  bool get isMember => role == ParticipantRole.member;
}

class ChatTypingInfo {
  final String userId;
  final String username;
  final DateTime startedAt;

  const ChatTypingInfo({
    required this.userId,
    required this.username,
    required this.startedAt,
  });

  factory ChatTypingInfo.fromJson(Map<String, dynamic> json) {
    return ChatTypingInfo(
      userId: json['userId'] ?? '',
      username: json['username'] ?? '',
      startedAt:
          DateTime.parse(json['startedAt'] ?? DateTime.now().toIso8601String()),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'userId': userId,
      'username': username,
      'startedAt': startedAt.toIso8601String(),
    };
  }

  bool get isExpired {
    return DateTime.now().difference(startedAt).inSeconds > 3;
  }
}

// Константы для типов чатов
class ChatType {
  static const String direct = 'DIRECT';
  static const String group = 'GROUP';
  static const String game = 'GAME';
  static const String tournament = 'TOURNAMENT';
  static const String support = 'SUPPORT';
}

// Константы для типов сообщений
class MessageType {
  static const String text = 'TEXT';
  static const String image = 'IMAGE';
  static const String file = 'FILE';
  static const String system = 'SYSTEM';
  static const String gameMove = 'GAME_MOVE';
  static const String emoji = 'EMOJI';
  static const String sticker = 'STICKER';
}

// Константы для ролей участников
class ParticipantRole {
  static const String admin = 'ADMIN';
  static const String moderator = 'MODERATOR';
  static const String member = 'MEMBER';
  static const String guest = 'GUEST';
}
