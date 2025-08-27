import 'dart:async';
import 'package:flutter/material.dart';
import 'package:skillgame_flutter/utils/theme.dart';
import 'package:skillgame_flutter/screens/games/game_lobby_screen.dart';

class GameResultModal extends StatefulWidget {
  final String result; // 'win', 'lose', 'draw'
  final String gameType;
  final String gameTitle;
  final String? customMessage;
  final int autoReturnSeconds;

  const GameResultModal({
    super.key,
    required this.result,
    required this.gameType,
    required this.gameTitle,
    this.customMessage,
    this.autoReturnSeconds = 5,
  });

  @override
  State<GameResultModal> createState() => _GameResultModalState();

  static void show({
    required BuildContext context,
    required String result,
    required String gameType,
    required String gameTitle,
    String? customMessage,
    int autoReturnSeconds = 5,
  }) {
    showDialog(
      context: context,
      barrierDismissible: false,
      barrierColor: Colors.black.withOpacity(0.8),
      builder: (context) => GameResultModal(
        result: result,
        gameType: gameType,
        gameTitle: gameTitle,
        customMessage: customMessage,
        autoReturnSeconds: autoReturnSeconds,
      ),
    );
  }
}

class _GameResultModalState extends State<GameResultModal> {
  late int _timeRemaining;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timeRemaining = widget.autoReturnSeconds;
    _startCountdown();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _startCountdown() {
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }

      setState(() {
        _timeRemaining--;
      });

      if (_timeRemaining <= 0) {
        timer.cancel();
        _returnToLobby();
      }
    });
  }

  void _returnToLobby() {
    if (!mounted) return;

    Navigator.of(context).pop(); // Закрыть модальное окно
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (context) => GameLobbyScreen(
          gameType: widget.gameType,
          gameTitle: widget.gameTitle,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.transparent,
      elevation: 0,
      child: Center(
        child: Container(
          width: 320,
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: const Color(0xFF1A2332),
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.5),
                blurRadius: 20,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Кнопка закрытия
              Align(
                alignment: Alignment.topRight,
                child: Container(
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: IconButton(
                    onPressed: _returnToLobby,
                    icon: const Icon(
                      Icons.close,
                      color: Colors.white,
                      size: 20,
                    ),
                    padding: const EdgeInsets.all(8),
                    constraints: const BoxConstraints(
                      minWidth: 32,
                      minHeight: 32,
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 8),

              // Иконка результата
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: _getResultColor(),
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: _getResultColor().withOpacity(0.3),
                      blurRadius: 20,
                      spreadRadius: 4,
                    ),
                  ],
                ),
                child: Icon(
                  _getResultIcon(),
                  color: Colors.white,
                  size: 40,
                ),
              ),

              const SizedBox(height: 24),

              // Заголовок результата
              Text(
                _getResultTitle(),
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 32,
                  fontWeight: FontWeight.bold,
                ),
              ),

              const SizedBox(height: 12),

              // Описание
              Text(
                widget.customMessage ?? _getResultMessage(),
                style: TextStyle(
                  color: Colors.white.withOpacity(0.7),
                  fontSize: 16,
                ),
                textAlign: TextAlign.center,
              ),

              const SizedBox(height: 24),

              // Таймер обратного отсчета
              if (_timeRemaining > 0) ...[
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.access_time,
                        color: AppTheme.primaryColor,
                        size: 16,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'Returning in ${_timeRemaining}s',
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.8),
                          fontSize: 14,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
              ],

              // Кнопка возврата в лобби
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  onPressed: _returnToLobby,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primaryColor,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    elevation: 0,
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.arrow_back, size: 20),
                      const SizedBox(width: 8),
                      const Text(
                        'BACK TO LOBBY',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Color _getResultColor() {
    switch (widget.result) {
      case 'win':
        return const Color(0xFF10B981); // Зеленый для победы
      case 'lose':
        return const Color(0xFFEF4444); // Красный для поражения
      case 'draw':
        return const Color(0xFFF59E0B); // Оранжевый для ничьи
      default:
        return AppTheme.primaryColor;
    }
  }

  IconData _getResultIcon() {
    switch (widget.result) {
      case 'win':
        return Icons.emoji_events; // Кубок для победы
      case 'lose':
        return Icons.sentiment_dissatisfied; // Грустное лицо для поражения
      case 'draw':
        return Icons.handshake; // Рукопожатие для ничьи
      default:
        return Icons.gamepad;
    }
  }

  String _getResultTitle() {
    switch (widget.result) {
      case 'win':
        return 'Victory!';
      case 'lose':
        return 'Defeat';
      case 'draw':
        return 'Draw';
      default:
        return 'Game Over';
    }
  }

  String _getResultMessage() {
    switch (widget.result) {
      case 'win':
        return 'Congratulations! You won the match. Well played!';
      case 'lose':
        return 'Better luck next time! Keep practicing to improve.';
      case 'draw':
        return 'The match ended in a draw. Well played!';
      default:
        return 'Thanks for playing!';
    }
  }
}
