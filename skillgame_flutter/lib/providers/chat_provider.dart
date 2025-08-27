import 'dart:async';
import 'package:flutter/material.dart';
import 'package:skillgame_flutter/models/chat_model.dart';
import 'package:skillgame_flutter/services/api_service.dart';
import 'package:skillgame_flutter/services/websocket_service.dart';

class ChatProvider extends ChangeNotifier {
  List<Chat> _chats = [];
  Chat? _activeChat;
  Map<String, List<ChatTypingInfo>> _typingUsers = {};
  bool _isLoading = false;
  String? _error;

  final WebSocketService _webSocketService;

  List<Chat> get chats => _chats;
  Chat? get activeChat => _activeChat;
  Map<String, List<ChatTypingInfo>> get typingUsers => _typingUsers;
  bool get isLoading => _isLoading;
  String? get error => _error;

  int get unreadMessagesCount => _chats
      .map((chat) => chat.getUnreadCount('current_user'))
      .fold(0, (sum, count) => sum + count);

  ChatProvider(this._webSocketService) {
    _setupWebSocketListeners();
  }

  void _setupWebSocketListeners() {
    _webSocketService.onChatJoined = (data) {
      _handleChatJoined(data);
    };

    _webSocketService.onNewMessage = (data) {
      _handleNewMessage(data);
    };

    _webSocketService.onChatError = (data) {
      _handleChatError(data);
    };

    _webSocketService.onMessagesRead = (data) {
      _handleMessagesRead(data);
    };

    _webSocketService.onUserTyping = (data) {
      _handleUserTyping(data);
    };

    _webSocketService.onChatClosed = (data) {
      _handleChatClosed(data);
    };
  }

  Future<void> loadChats(String token) async {
    _setLoading(true);
    _clearError();
    try {
      // Для демонстрации создаем пустой список чатов
      // В реальном приложении это будет вызов API
      _chats = [];
      notifyListeners();
    } catch (e) {
      _setError('Failed to load chats: ${e.toString()}');
    } finally {
      _setLoading(false);
    }
  }

  Future<Chat?> createDirectChat(String token, String userId) async {
    _setLoading(true);
    _clearError();

    try {
      // Для демонстрации создаем новый чат локально
      final chat = Chat(
        id: 'direct_${DateTime.now().millisecondsSinceEpoch}',
        type: ChatType.direct,
        participants: ['current_user', userId],
        isActive: true,
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      _chats.insert(0, chat);
      notifyListeners();
      return chat;
    } catch (e) {
      _setError('Failed to create direct chat: ${e.toString()}');
      return null;
    } finally {
      _setLoading(false);
    }
  }

  Future<Chat?> createGameChat(String token, String gameId) async {
    _setLoading(true);
    _clearError();

    try {
      // Для демонстрации создаем новый игровой чат локально
      final chat = Chat(
        id: 'game_${DateTime.now().millisecondsSinceEpoch}',
        type: ChatType.game,
        participants: ['current_user', 'opponent'],
        name: 'Game Chat',
        isActive: true,
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      _chats.insert(0, chat);
      notifyListeners();
      return chat;
    } catch (e) {
      _setError('Failed to create game chat: ${e.toString()}');
      return null;
    } finally {
      _setLoading(false);
    }
  }

  Future<void> loadChatMessages(String token, String chatId) async {
    try {
      // Для демонстрации используем пустой ответ
      final response = null;
      if (response != null) {
        final chatIndex = _chats.indexWhere((c) => c.id == chatId);
        if (chatIndex != -1) {
          List<ChatMessage> messages = [];

          if (response is Map<String, dynamic>) {
            final messagesData = response['messages'] as List?;
            if (messagesData != null) {
              messages = messagesData
                  .map((json) =>
                      ChatMessage.fromJson(json as Map<String, dynamic>))
                  .toList();
            }
          } else if (response is List) {
            messages = response
                .map((json) =>
                    ChatMessage.fromJson(json as Map<String, dynamic>))
                .toList();
          }

          // Сортируем сообщения по времени
          messages.sort((a, b) => a.timestamp.compareTo(b.timestamp));

          // Обновляем чат с новыми сообщениями
          final updatedChat = Chat(
            id: _chats[chatIndex].id,
            type: _chats[chatIndex].type,
            participants: _chats[chatIndex].participants,
            name: _chats[chatIndex].name,
            description: _chats[chatIndex].description,
            messages: messages,
            lastRead: _chats[chatIndex].lastRead,
            lastMessage: messages.isNotEmpty ? messages.last : null,
            isActive: _chats[chatIndex].isActive,
            createdAt: _chats[chatIndex].createdAt,
            updatedAt: _chats[chatIndex].updatedAt,
          );

          _chats[chatIndex] = updatedChat;

          // Если это активный чат, обновляем его тоже
          if (_activeChat?.id == chatId) {
            _activeChat = updatedChat;
          }

          notifyListeners();
        }
      }
    } catch (e) {
      _setError('Failed to load chat messages: ${e.toString()}');
    }
  }

  Future<bool> sendMessage(
    String token,
    String chatId,
    String content, {
    String type = MessageType.text,
    Map<String, dynamic>? metadata,
  }) async {
    try {
      // Для демонстрации добавляем сообщение локально
      final message = ChatMessage(
        id: 'msg_${DateTime.now().millisecondsSinceEpoch}',
        chatId: chatId,
        senderId: 'current_user',
        senderName: 'You',
        content: content,
        type: type,
        metadata: metadata,
        timestamp: DateTime.now(),
      );

      // Добавляем сообщение в чат
      final chatIndex = _chats.indexWhere((c) => c.id == chatId);
      if (chatIndex != -1) {
        final chat = _chats[chatIndex];
        final updatedMessages = List<ChatMessage>.from(chat.messages);
        updatedMessages.add(message);

        _chats[chatIndex] = Chat(
          id: chat.id,
          type: chat.type,
          participants: chat.participants,
          name: chat.name,
          description: chat.description,
          messages: updatedMessages,
          lastRead: chat.lastRead,
          lastMessage: message,
          isActive: chat.isActive,
          createdAt: chat.createdAt,
          updatedAt: DateTime.now(),
        );

        if (_activeChat?.id == chatId) {
          _activeChat = _chats[chatIndex];
        }

        notifyListeners();
      }

      return true;
    } catch (e) {
      _setError('Failed to send message: ${e.toString()}');
      return false;
    }
  }

  Future<bool> markChatAsRead(String token, String chatId) async {
    try {
      final response = await ApiService.markChatAsRead(token, chatId);
      if (response != null) {
        // Обновляем локально
        final chatIndex = _chats.indexWhere((c) => c.id == chatId);
        if (chatIndex != -1) {
          final updatedLastRead =
              Map<String, DateTime>.from(_chats[chatIndex].lastRead);
          updatedLastRead['current_user'] = DateTime.now();

          _chats[chatIndex] = Chat(
            id: _chats[chatIndex].id,
            type: _chats[chatIndex].type,
            participants: _chats[chatIndex].participants,
            name: _chats[chatIndex].name,
            description: _chats[chatIndex].description,
            messages: _chats[chatIndex].messages,
            lastRead: updatedLastRead,
            lastMessage: _chats[chatIndex].lastMessage,
            isActive: _chats[chatIndex].isActive,
            createdAt: _chats[chatIndex].createdAt,
            updatedAt: _chats[chatIndex].updatedAt,
          );

          notifyListeners();
        }

        return true;
      }
      return false;
    } catch (e) {
      _setError('Failed to mark chat as read: ${e.toString()}');
      return false;
    }
  }

  void joinChat(String chatId, {String? userId}) {
    _webSocketService.joinChat(chatId, userId: userId);
  }

  void leaveChat(String chatId) {
    _webSocketService.leaveChat(chatId);
  }

  void sendTypingIndicator(String chatId, bool isTyping) {
    _webSocketService.chatTyping(chatId, isTyping);
  }

  void setActiveChat(Chat? chat) {
    _activeChat = chat;
    notifyListeners();
  }

  void _handleChatJoined(Map<String, dynamic> data) {
    try {
      final chatId = data['chatId'] as String?;
      if (chatId != null) {
        // Загружаем сообщения для присоединенного чата
        // loadChatMessages('current_token', chatId);
      }
    } catch (e) {
      print('Error handling chat joined: $e');
    }
  }

  void _handleNewMessage(Map<String, dynamic> data) {
    try {
      final message = ChatMessage.fromJson(data);
      final chatId = message.chatId;

      // Находим чат и добавляем сообщение
      final chatIndex = _chats.indexWhere((c) => c.id == chatId);
      if (chatIndex != -1) {
        final chat = _chats[chatIndex];
        final updatedMessages = List<ChatMessage>.from(chat.messages);
        updatedMessages.add(message);

        _chats[chatIndex] = Chat(
          id: chat.id,
          type: chat.type,
          participants: chat.participants,
          name: chat.name,
          description: chat.description,
          messages: updatedMessages,
          lastRead: chat.lastRead,
          lastMessage: message,
          isActive: chat.isActive,
          createdAt: chat.createdAt,
          updatedAt: DateTime.now(),
        );

        // Если это активный чат, обновляем его тоже
        if (_activeChat?.id == chatId) {
          _activeChat = _chats[chatIndex];
        }

        // Перемещаем чат в начало списка
        final updatedChat = _chats.removeAt(chatIndex);
        _chats.insert(0, updatedChat);

        notifyListeners();
      }
    } catch (e) {
      print('Error handling new message: $e');
    }
  }

  void _handleChatError(Map<String, dynamic> data) {
    final error = data['error'] as String?;
    if (error != null) {
      _setError(error);
    }
  }

  void _handleMessagesRead(Map<String, dynamic> data) {
    try {
      final chatId = data['chatId'] as String?;
      final userId = data['userId'] as String?;

      if (chatId != null && userId != null) {
        // Обновляем статус прочтения
        final chatIndex = _chats.indexWhere((c) => c.id == chatId);
        if (chatIndex != -1) {
          final updatedLastRead =
              Map<String, DateTime>.from(_chats[chatIndex].lastRead);
          updatedLastRead[userId] = DateTime.now();

          _chats[chatIndex] = Chat(
            id: _chats[chatIndex].id,
            type: _chats[chatIndex].type,
            participants: _chats[chatIndex].participants,
            name: _chats[chatIndex].name,
            description: _chats[chatIndex].description,
            messages: _chats[chatIndex].messages,
            lastRead: updatedLastRead,
            lastMessage: _chats[chatIndex].lastMessage,
            isActive: _chats[chatIndex].isActive,
            createdAt: _chats[chatIndex].createdAt,
            updatedAt: _chats[chatIndex].updatedAt,
          );

          notifyListeners();
        }
      }
    } catch (e) {
      print('Error handling messages read: $e');
    }
  }

  void _handleUserTyping(Map<String, dynamic> data) {
    try {
      final chatId = data['chatId'] as String?;
      final isTyping = data['isTyping'] as bool?;
      final typingInfo = ChatTypingInfo.fromJson(data);

      if (chatId != null && isTyping != null) {
        if (!_typingUsers.containsKey(chatId)) {
          _typingUsers[chatId] = [];
        }

        final typingList = _typingUsers[chatId]!;
        typingList.removeWhere((info) => info.userId == typingInfo.userId);

        if (isTyping) {
          typingList.add(typingInfo);
        }

        // Удаляем устаревшие индикаторы набора
        typingList.removeWhere((info) => info.isExpired);

        notifyListeners();
      }
    } catch (e) {
      print('Error handling user typing: $e');
    }
  }

  void _handleChatClosed(Map<String, dynamic> data) {
    try {
      final chatId = data['chatId'] as String?;
      if (chatId != null) {
        _chats.removeWhere((c) => c.id == chatId);

        if (_activeChat?.id == chatId) {
          _activeChat = null;
        }

        notifyListeners();
      }
    } catch (e) {
      print('Error handling chat closed: $e');
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

  void reset() {
    _chats.clear();
    _activeChat = null;
    _typingUsers.clear();
    _isLoading = false;
    _error = null;
    notifyListeners();
  }

  // Демонстрационные методы
  void addTestDirectChat() {
    final testChat = Chat(
      id: 'test_direct_${DateTime.now().millisecondsSinceEpoch}',
      type: ChatType.direct,
      participants: ['current_user', 'test_user'],
      messages: [
        ChatMessage(
          id: 'msg1',
          chatId: 'test_direct',
          senderId: 'test_user',
          senderName: 'Test User',
          content: 'Hello! How are you?',
          timestamp: DateTime.now().subtract(Duration(minutes: 5)),
        ),
      ],
      lastRead: {'current_user': DateTime.now()},
      isActive: true,
      createdAt: DateTime.now().subtract(Duration(hours: 1)),
      updatedAt: DateTime.now(),
    );

    _chats.insert(0, testChat);
    notifyListeners();
  }

  void addTestGameChat() {
    final testChat = Chat(
      id: 'test_game_${DateTime.now().millisecondsSinceEpoch}',
      type: ChatType.game,
      participants: ['current_user', 'opponent'],
      name: 'Tic-Tac-Toe Game Chat',
      messages: [
        ChatMessage(
          id: 'msg1',
          chatId: 'test_game',
          senderId: 'system',
          senderName: 'System',
          content: 'Game started! Good luck!',
          type: MessageType.system,
          timestamp: DateTime.now().subtract(Duration(minutes: 10)),
        ),
      ],
      lastRead: {},
      isActive: true,
      createdAt: DateTime.now().subtract(Duration(minutes: 15)),
      updatedAt: DateTime.now(),
    );

    _chats.insert(0, testChat);
    notifyListeners();
  }
}
