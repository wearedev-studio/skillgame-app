class Notification {
  final String id;
  final String userId;
  final String type;
  final String title;
  final String message;
  final Map<String, dynamic>? data;
  final bool isRead;
  final DateTime createdAt;
  final DateTime? readAt;

  const Notification({
    required this.id,
    required this.userId,
    required this.type,
    required this.title,
    required this.message,
    this.data,
    this.isRead = false,
    required this.createdAt,
    this.readAt,
  });

  factory Notification.fromJson(Map<String, dynamic> json) {
    return Notification(
      id: json['_id'] ?? '',
      userId: json['userId'] ?? '',
      type: json['type'] ?? '',
      title: json['title'] ?? '',
      message: json['message'] ?? '',
      data: json['data'],
      isRead: json['isRead'] ?? false,
      createdAt:
          DateTime.parse(json['createdAt'] ?? DateTime.now().toIso8601String()),
      readAt: json['readAt'] != null ? DateTime.parse(json['readAt']) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'userId': userId,
      'type': type,
      'title': title,
      'message': message,
      'data': data,
      'isRead': isRead,
      'createdAt': createdAt.toIso8601String(),
      'readAt': readAt?.toIso8601String(),
    };
  }

  Notification copyWith({
    String? id,
    String? userId,
    String? type,
    String? title,
    String? message,
    Map<String, dynamic>? data,
    bool? isRead,
    DateTime? createdAt,
    DateTime? readAt,
  }) {
    return Notification(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      type: type ?? this.type,
      title: title ?? this.title,
      message: message ?? this.message,
      data: data ?? this.data,
      isRead: isRead ?? this.isRead,
      createdAt: createdAt ?? this.createdAt,
      readAt: readAt ?? this.readAt,
    );
  }
}

class NotificationSettings {
  final String id;
  final String userId;
  final bool emailNotifications;
  final bool pushNotifications;
  final bool gameNotifications;
  final bool tournamentNotifications;
  final bool paymentNotifications;
  final bool marketingNotifications;
  final DateTime updatedAt;

  const NotificationSettings({
    required this.id,
    required this.userId,
    this.emailNotifications = true,
    this.pushNotifications = true,
    this.gameNotifications = true,
    this.tournamentNotifications = true,
    this.paymentNotifications = true,
    this.marketingNotifications = false,
    required this.updatedAt,
  });

  factory NotificationSettings.fromJson(Map<String, dynamic> json) {
    return NotificationSettings(
      id: json['_id'] ?? '',
      userId: json['userId'] ?? '',
      emailNotifications: json['emailNotifications'] ?? true,
      pushNotifications: json['pushNotifications'] ?? true,
      gameNotifications: json['gameNotifications'] ?? true,
      tournamentNotifications: json['tournamentNotifications'] ?? true,
      paymentNotifications: json['paymentNotifications'] ?? true,
      marketingNotifications: json['marketingNotifications'] ?? false,
      updatedAt:
          DateTime.parse(json['updatedAt'] ?? DateTime.now().toIso8601String()),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'userId': userId,
      'emailNotifications': emailNotifications,
      'pushNotifications': pushNotifications,
      'gameNotifications': gameNotifications,
      'tournamentNotifications': tournamentNotifications,
      'paymentNotifications': paymentNotifications,
      'marketingNotifications': marketingNotifications,
      'updatedAt': updatedAt.toIso8601String(),
    };
  }

  NotificationSettings copyWith({
    String? id,
    String? userId,
    bool? emailNotifications,
    bool? pushNotifications,
    bool? gameNotifications,
    bool? tournamentNotifications,
    bool? paymentNotifications,
    bool? marketingNotifications,
    DateTime? updatedAt,
  }) {
    return NotificationSettings(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      emailNotifications: emailNotifications ?? this.emailNotifications,
      pushNotifications: pushNotifications ?? this.pushNotifications,
      gameNotifications: gameNotifications ?? this.gameNotifications,
      tournamentNotifications:
          tournamentNotifications ?? this.tournamentNotifications,
      paymentNotifications: paymentNotifications ?? this.paymentNotifications,
      marketingNotifications:
          marketingNotifications ?? this.marketingNotifications,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}

// Типы уведомлений
class NotificationType {
  static const String gameStart = 'GAME_START';
  static const String gameEnd = 'GAME_END';
  static const String tournamentStart = 'TOURNAMENT_START';
  static const String tournamentEnd = 'TOURNAMENT_END';
  static const String paymentReceived = 'PAYMENT_RECEIVED';
  static const String paymentFailed = 'PAYMENT_FAILED';
  static const String withdrawalProcessed = 'WITHDRAWAL_PROCESSED';
  static const String kycRequired = 'KYC_REQUIRED';
  static const String kycApproved = 'KYC_APPROVED';
  static const String kycRejected = 'KYC_REJECTED';
  static const String friendRequest = 'FRIEND_REQUEST';
  static const String systemMaintenance = 'SYSTEM_MAINTENANCE';
  static const String promotion = 'PROMOTION';
}
