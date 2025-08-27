import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:skillgame_flutter/providers/auth_provider.dart';
import 'package:skillgame_flutter/providers/game_provider.dart';
import 'package:skillgame_flutter/providers/tournament_provider.dart';
import 'package:skillgame_flutter/providers/user_provider.dart';
import 'package:skillgame_flutter/providers/notification_provider.dart';
import 'package:skillgame_flutter/providers/payment_provider.dart';
import 'package:skillgame_flutter/providers/chat_provider.dart';
import 'package:skillgame_flutter/providers/kyc_provider.dart';
import 'package:skillgame_flutter/screens/auth/splash_screen.dart';
import 'package:skillgame_flutter/services/navigation_service.dart';
import 'package:skillgame_flutter/services/notification_service.dart';
import 'package:skillgame_flutter/services/websocket_service.dart';
import 'package:skillgame_flutter/utils/theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize notification service
  await NotificationService.initialize();

  runApp(const SkillGameApp());
}

class SkillGameApp extends StatelessWidget {
  const SkillGameApp({super.key});

  @override
  Widget build(BuildContext context) {
    // Создаем singleton экземпляр WebSocketService
    final webSocketService = WebSocketService();

    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => UserProvider()),
        ChangeNotifierProvider(create: (_) => GameProvider(webSocketService)),
        ChangeNotifierProvider(create: (_) => TournamentProvider()),
        ChangeNotifierProvider(
            create: (_) => NotificationProvider(webSocketService)),
        ChangeNotifierProvider(
            create: (_) => PaymentProvider(webSocketService)),
        ChangeNotifierProvider(create: (_) => ChatProvider(webSocketService)),
        ChangeNotifierProvider(create: (_) => KycProvider(webSocketService)),
      ],
      child: MaterialApp(
        title: 'Skill Game',
        theme: AppTheme.darkTheme,
        home: const SplashScreen(),
        navigatorKey: NavigationService.navigatorKey,
        debugShowCheckedModeBanner: false,
      ),
    );
  }
}
