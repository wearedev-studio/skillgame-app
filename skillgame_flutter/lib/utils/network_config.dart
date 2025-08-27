import 'dart:io';
import 'package:flutter/foundation.dart';

class NetworkConfig {
  // Продакшн API URL согласно документации SkillGame Pro API
  static const String _productionBaseUrl = 'https://sklgmsapi.koltech.dev';

  // Локальная разработка
  static const String _localNetworkIp = '192.168.0.119';
  static const String _emulatorIp = '10.0.2.2';
  static const String _port = '5001';

  // Режим разработки - переключите на false для продакшн
  // В продакшн используется официальный API SkillGame Pro
  static const bool _isDevelopmentMode = false;

  /// Определяет правильный base URL для API
  static String get baseUrl {
    if (_isDevelopmentMode) {
      // Development mode - используем локальный сервер
      if (kIsWeb) {
        return 'http://localhost:$_port/api';
      } else if (Platform.isAndroid) {
        return isEmulator
            ? 'http://$_emulatorIp:$_port/api'
            : 'http://$_localNetworkIp:$_port/api';
      } else if (Platform.isIOS) {
        return 'http://$_localNetworkIp:$_port/api';
      }
      return 'http://localhost:$_port/api';
    } else {
      // Production mode - используем продакшн API
      return '$_productionBaseUrl/api';
    }
  }

  /// Определяет правильный URL для WebSocket соединения
  static String get socketUrl {
    if (_isDevelopmentMode) {
      // Development mode - используем локальный сервер
      if (kIsWeb) {
        return 'http://localhost:$_port';
      } else if (Platform.isAndroid) {
        return isEmulator
            ? 'http://$_emulatorIp:$_port'
            : 'http://$_localNetworkIp:$_port';
      } else if (Platform.isIOS) {
        return 'http://$_localNetworkIp:$_port';
      }
      return 'http://localhost:$_port';
    } else {
      // Production mode - используем продакшн WebSocket
      return _productionBaseUrl;
    }
  }

  /// Простой способ определения эмулятора Android
  /// Основан на проверке модели устройства и других характеристик
  static bool get isEmulator {
    if (!Platform.isAndroid) return false;

    // Эти свойства доступны только на Android
    // В эмуляторе обычно присутствуют специфичные значения
    try {
      // Проверяем переменные окружения и системные свойства
      // которые обычно указывают на эмулятор
      final androidId = Platform.environment['ANDROID_ID'];
      final model = Platform.environment['ro.product.model'];
      final brand = Platform.environment['ro.product.brand'];

      // Типичные признаки эмулятора
      if (androidId == null || androidId == '0000000000000000') return true;
      if (model?.toLowerCase().contains('emulator') == true) return true;
      if (model?.toLowerCase().contains('sdk') == true) return true;
      if (brand?.toLowerCase().contains('generic') == true) return true;

      return false;
    } catch (e) {
      // Если не можем определить, предполагаем что это реальное устройство
      return false;
    }
  }

  /// Информация о текущей конфигурации для отладки
  static Map<String, dynamic> get debugInfo => {
        'mode': _isDevelopmentMode ? 'Development' : 'Production',
        'platform': Platform.operatingSystem,
        'isEmulator': _isDevelopmentMode ? isEmulator : 'N/A',
        'baseUrl': baseUrl,
        'socketUrl': socketUrl,
        'productionUrl': _productionBaseUrl,
        'localNetworkIp': _localNetworkIp,
        'emulatorIp': _emulatorIp,
        'port': _port,
      };

  /// Проверяет доступность сервера по текущему URL
  static Future<bool> checkServerAvailability() async {
    try {
      final client = HttpClient();
      final request =
          await client.getUrl(Uri.parse('${baseUrl.replaceAll('/api', '')}/'));
      final response = await request.close();
      client.close();
      return response.statusCode < 500;
    } catch (e) {
      return false;
    }
  }

  /// Переключение режима (только для отладки)
  static bool get isDevelopmentMode => _isDevelopmentMode;
  static String get productionBaseUrl => _productionBaseUrl;
}
