import 'package:permission_handler/permission_handler.dart';

class NotificationService {
  static bool _isInitialized = false;

  static Future<void> initialize() async {
    if (_isInitialized) return;

    // Request notification permissions
    await _requestPermissions();

    _isInitialized = true;
  }

  static Future<void> _requestPermissions() async {
    await Permission.notification.request();
  }

  static Future<void> showGameInviteNotification({
    required String title,
    required String body,
    required String gameId,
  }) async {
    print('Game invite notification: $title - $body');
  }

  static Future<void> showTournamentNotification({
    required String title,
    required String body,
    required String tournamentId,
  }) async {
    print('Tournament notification: $title - $body');
  }

  static Future<void> showGameStart({
    required String gameType,
    required String roomId,
  }) async {
    print('Game started notification: $gameType game has started!');
  }

  static Future<void> showYourTurn({
    required String gameType,
    required String roomId,
  }) async {
    print('Your turn notification: It\'s your turn in $gameType!');
  }

  static Future<void> showGameEnd({
    required String gameType,
    required String result,
    required String roomId,
  }) async {
    print('Game end notification: Game $result in $gameType');
  }

  static Future<void> showOpponentDisconnected({
    required String gameType,
    required String roomId,
  }) async {
    print('Opponent disconnected notification: Opponent left $gameType game');
  }
}
