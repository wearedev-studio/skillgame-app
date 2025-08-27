import 'dart:async';
import 'package:flutter/material.dart';
import 'package:skillgame_flutter/models/notification_model.dart'
    as NotificationModel;
import 'package:skillgame_flutter/services/api_service.dart';
import 'package:skillgame_flutter/services/websocket_service.dart';

class NotificationProvider extends ChangeNotifier {
  List<NotificationModel.Notification> _notifications = [];
  NotificationModel.NotificationSettings? _settings;
  bool _isLoading = false;
  String? _error;

  final WebSocketService _webSocketService;
  late StreamSubscription? _webSocketSubscription;

  List<NotificationModel.Notification> get notifications => _notifications;
  NotificationModel.NotificationSettings? get settings => _settings;
  bool get isLoading => _isLoading;
  String? get error => _error;

  int get unreadCount => _notifications.where((n) => !n.isRead).length;
  List<NotificationModel.Notification> get unreadNotifications =>
      _notifications.where((n) => !n.isRead).toList();

  NotificationProvider(this._webSocketService) {
    _setupWebSocketListeners();
  }

  void _setupWebSocketListeners() {
    _webSocketService.onNotificationReceived = (data) {
      _handleNewNotification(data);
    };

    _webSocketService.onNotificationRead = (data) {
      _handleNotificationRead(data);
    };

    _webSocketService.onNotificationDeleted = (data) {
      _handleNotificationDeleted(data);
    };

    _webSocketService.onBulkNotificationsRead = (data) {
      _handleBulkNotificationsRead(data);
    };
  }

  Future<void> loadNotifications(String token) async {
    _setLoading(true);
    _clearError();

    try {
      final response = await ApiService.getNotifications(token);
      if (response != null) {
        if (response is Map<String, dynamic>) {
          final responseMap = response as Map<String, dynamic>;
          final notificationsData = responseMap['notifications'] as List?;
          if (notificationsData != null) {
            _notifications = notificationsData
                .map((json) => NotificationModel.Notification.fromJson(
                    json as Map<String, dynamic>))
                .toList();

            // Сортируем по дате создания (новые сначала)
            _notifications.sort((a, b) => b.createdAt.compareTo(a.createdAt));
          }
        } else if (response is List) {
          _notifications = response
              .map((json) => NotificationModel.Notification.fromJson(
                  json as Map<String, dynamic>))
              .toList();
          _notifications.sort((a, b) => b.createdAt.compareTo(a.createdAt));
        }
      }
      notifyListeners();
    } catch (e) {
      _setError('Failed to load notifications: ${e.toString()}');
    } finally {
      _setLoading(false);
    }
  }

  Future<void> loadNotificationSettings(String token) async {
    try {
      // Для демонстрации создаем настройки по умолчанию
      // В реальном приложении это будет вызов API
      _settings = NotificationModel.NotificationSettings(
        id: 'default',
        userId: token,
        updatedAt: DateTime.now(),
      );
      notifyListeners();
    } catch (e) {
      _setError('Failed to load notification settings: ${e.toString()}');
    }
  }

  Future<bool> updateNotificationSettings(
      String token, NotificationModel.NotificationSettings newSettings) async {
    try {
      // Для демонстрации просто обновляем локально
      // В реальном приложении это будет вызов API
      _settings = newSettings;
      notifyListeners();
      return true;
    } catch (e) {
      _setError('Failed to update notification settings: ${e.toString()}');
      return false;
    }
  }

  Future<bool> markAsRead(String token, String notificationId) async {
    try {
      final response =
          await ApiService.markNotificationAsRead(token, notificationId);
      if (response != null) {
        _updateNotificationStatus(notificationId, isRead: true);

        // Отправляем WebSocket событие для синхронизации
        _webSocketService.markNotificationRead(notificationId);

        return true;
      }
      return false;
    } catch (e) {
      // Если API метод не найден, обновляем локально
      _updateNotificationStatus(notificationId, isRead: true);
      _webSocketService.markNotificationRead(notificationId);
      return true;
    }
  }

  Future<bool> markAllAsRead(String token) async {
    try {
      final response = await ApiService.markAllNotificationsAsRead(token);
      if (response != null) {
        // Отмечаем все уведомления как прочитанные локально
        _notifications = _notifications
            .map((notification) =>
                notification.copyWith(isRead: true, readAt: DateTime.now()))
            .toList();

        // Отправляем WebSocket событие для синхронизации
        _webSocketService.markAllNotificationsRead();

        notifyListeners();
        return true;
      }
      return false;
    } catch (e) {
      // Если API метод не найден, обновляем локально
      _notifications = _notifications
          .map((notification) =>
              notification.copyWith(isRead: true, readAt: DateTime.now()))
          .toList();
      _webSocketService.markAllNotificationsRead();
      notifyListeners();
      return true;
    }
  }

  Future<bool> deleteNotification(String token, String notificationId) async {
    try {
      // Для демонстрации удаляем локально
      // В реальном приложении это будет вызов API
      _notifications.removeWhere((n) => n.id == notificationId);

      // Отправляем WebSocket событие для синхронизации
      _webSocketService.deleteNotification(notificationId);

      notifyListeners();
      return true;
    } catch (e) {
      _setError('Failed to delete notification: ${e.toString()}');
      return false;
    }
  }

  Future<bool> deleteAllNotifications(String token) async {
    try {
      // Для демонстрации очищаем локально
      // В реальном приложении это будет вызов API
      _notifications.clear();
      notifyListeners();
      return true;
    } catch (e) {
      _setError('Failed to delete all notifications: ${e.toString()}');
      return false;
    }
  }

  void subscribeToNotifications() {
    _webSocketService.subscribeToNotifications();
  }

  void _handleNewNotification(Map<String, dynamic> data) {
    try {
      final notification = NotificationModel.Notification.fromJson(data);
      _notifications.insert(0, notification); // Добавляем в начало списка
      notifyListeners();

      // Можно добавить показ push-уведомления или звука
      _showLocalNotification(notification);
    } catch (e) {
      print('Error handling new notification: $e');
    }
  }

  void _handleNotificationRead(Map<String, dynamic> data) {
    final notificationId = data['notificationId'] as String?;
    if (notificationId != null) {
      _updateNotificationStatus(notificationId, isRead: true);
    }
  }

  void _handleNotificationDeleted(Map<String, dynamic> data) {
    final notificationId = data['notificationId'] as String?;
    if (notificationId != null) {
      _notifications.removeWhere((n) => n.id == notificationId);
      notifyListeners();
    }
  }

  void _handleBulkNotificationsRead(Map<String, dynamic> data) {
    // Отмечаем все уведомления как прочитанные
    _notifications = _notifications
        .map((notification) =>
            notification.copyWith(isRead: true, readAt: DateTime.now()))
        .toList();
    notifyListeners();
  }

  void _updateNotificationStatus(String notificationId, {bool? isRead}) {
    final index = _notifications.indexWhere((n) => n.id == notificationId);
    if (index != -1) {
      _notifications[index] = _notifications[index].copyWith(
        isRead: isRead ?? _notifications[index].isRead,
        readAt: isRead == true ? DateTime.now() : _notifications[index].readAt,
      );
      notifyListeners();
    }
  }

  void _showLocalNotification(NotificationModel.Notification notification) {
    // Здесь можно добавить логику для показа локальных уведомлений
    // Например, используя flutter_local_notifications
    print('New notification: ${notification.title} - ${notification.message}');
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

  void reset() {
    _notifications.clear();
    _settings = null;
    _isLoading = false;
    _error = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _webSocketSubscription?.cancel();
    super.dispose();
  }

  // Демонстрационные методы для создания тестовых уведомлений
  void addTestNotification() {
    final testNotification = NotificationModel.Notification(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      userId: 'current_user',
      type: NotificationModel.NotificationType.gameStart,
      title: 'New Game Started',
      message: 'Your opponent has joined the game. Good luck!',
      createdAt: DateTime.now(),
    );

    _notifications.insert(0, testNotification);
    notifyListeners();
  }

  void addPaymentNotification() {
    final paymentNotification = NotificationModel.Notification(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      userId: 'current_user',
      type: NotificationModel.NotificationType.paymentReceived,
      title: 'Payment Received',
      message: 'Your deposit of \$50.00 has been successfully processed.',
      createdAt: DateTime.now(),
    );

    _notifications.insert(0, paymentNotification);
    notifyListeners();
  }

  void addTournamentNotification() {
    final tournamentNotification = NotificationModel.Notification(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      userId: 'current_user',
      type: NotificationModel.NotificationType.tournamentStart,
      title: 'Tournament Starting',
      message: 'The Tic-Tac-Toe Championship is about to begin!',
      createdAt: DateTime.now(),
    );

    _notifications.insert(0, tournamentNotification);
    notifyListeners();
  }
}
