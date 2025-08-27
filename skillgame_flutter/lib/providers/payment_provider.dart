import 'dart:async';
import 'package:flutter/material.dart';
import 'package:skillgame_flutter/models/payment_model.dart';
import 'package:skillgame_flutter/services/api_service.dart';
import 'package:skillgame_flutter/services/websocket_service.dart';

class PaymentProvider extends ChangeNotifier {
  List<Payment> _payments = [];
  List<PaymentMethod> _paymentMethods = [];
  bool _isLoading = false;
  String? _error;

  final WebSocketService _webSocketService;

  List<Payment> get payments => _payments;
  List<PaymentMethod> get paymentMethods => _paymentMethods;
  bool get isLoading => _isLoading;
  String? get error => _error;

  List<Payment> get deposits =>
      _payments.where((p) => p.type == PaymentType.deposit).toList();
  List<Payment> get withdrawals =>
      _payments.where((p) => p.type == PaymentType.withdrawal).toList();
  List<Payment> get pendingPayments =>
      _payments.where((p) => p.isPending).toList();

  PaymentProvider(this._webSocketService) {
    _setupWebSocketListeners();
  }

  void _setupWebSocketListeners() {
    _webSocketService.onPaymentInitiated = (data) {
      _handlePaymentInitiated(data);
    };

    _webSocketService.onPaymentCompleted = (data) {
      _handlePaymentCompleted(data);
    };

    _webSocketService.onPaymentFailed = (data) {
      _handlePaymentFailed(data);
    };

    _webSocketService.onDepositProcessed = (data) {
      _handleDepositProcessed(data);
    };

    _webSocketService.onWithdrawalProcessed = (data) {
      _handleWithdrawalProcessed(data);
    };
  }

  Future<void> loadPayments(String token) async {
    _setLoading(true);
    _clearError();

    try {
      // Используем существующий метод для получения истории транзакций
      final response = await ApiService.getTransactionHistory(token);
      if (response != null) {
        if (response is Map<String, dynamic>) {
          final responseMap = response as Map<String, dynamic>;
          final transactionsData = responseMap['transactions'] as List?;
          if (transactionsData != null) {
            // Конвертируем транзакции в платежи
            _payments = transactionsData
                .map((json) =>
                    _convertTransactionToPayment(json as Map<String, dynamic>))
                .toList();

            // Сортируем по дате создания (новые сначала)
            _payments.sort((a, b) => b.createdAt.compareTo(a.createdAt));
          }
        }
      }
      notifyListeners();
    } catch (e) {
      _setError('Failed to load payments: ${e.toString()}');
    } finally {
      _setLoading(false);
    }
  }

  Payment _convertTransactionToPayment(Map<String, dynamic> transactionJson) {
    return Payment(
      id: transactionJson['_id'] ?? '',
      userId: 'current_user',
      type: transactionJson['type'] ?? PaymentType.deposit,
      amount: (transactionJson['amount'] ?? 0.0).toDouble(),
      status: transactionJson['status'] ?? PaymentStatus.completed,
      createdAt: DateTime.parse(
          transactionJson['createdAt'] ?? DateTime.now().toIso8601String()),
    );
  }

  Future<void> loadPaymentMethods(String token) async {
    try {
      // Создаем методы по умолчанию для демонстрации
      // В реальном приложении это будет вызов API
      _paymentMethods = [
        PaymentMethod(
          id: 'credit_card',
          name: 'Credit Card',
          type: PaymentMethodType.creditCard,
          minAmount: 10.0,
          maxAmount: 1000.0,
          fee: 0.03,
        ),
        PaymentMethod(
          id: 'bank_transfer',
          name: 'Bank Transfer',
          type: PaymentMethodType.bankTransfer,
          minAmount: 50.0,
          maxAmount: 5000.0,
          fee: 0.01,
        ),
        PaymentMethod(
          id: 'g2pay',
          name: 'G2Pay',
          type: PaymentMethodType.g2pay,
          minAmount: 5.0,
          maxAmount: 2000.0,
          fee: 0.025,
        ),
      ];
      notifyListeners();
    } catch (e) {
      _setError('Failed to load payment methods: ${e.toString()}');
    }
  }

  Future<Map<String, dynamic>?> createDeposit(
    String token,
    DepositRequest request,
  ) async {
    _setLoading(true);
    _clearError();

    try {
      final response = await ApiService.createDeposit(token, request.amount);
      if (response != null) {
        // Добавляем новый платеж в список
        final payment = Payment(
          id: DateTime.now().millisecondsSinceEpoch.toString(),
          userId: 'current_user',
          type: PaymentType.deposit,
          amount: request.amount,
          status: PaymentStatus.pending,
          paymentMethod: request.method,
          createdAt: DateTime.now(),
        );

        _payments.insert(0, payment);
        notifyListeners();

        return response;
      }
      return null;
    } catch (e) {
      _setError('Failed to create deposit: ${e.toString()}');
      return null;
    } finally {
      _setLoading(false);
    }
  }

  Future<Map<String, dynamic>?> createWithdrawal(
    String token,
    WithdrawalRequest request,
  ) async {
    _setLoading(true);
    _clearError();

    try {
      final response = await ApiService.createWithdrawal(
        token,
        request.amount,
        request.paymentDetails,
      );

      if (response != null) {
        // Добавляем новый платеж в список
        final payment = Payment(
          id: DateTime.now().millisecondsSinceEpoch.toString(),
          userId: 'current_user',
          type: PaymentType.withdrawal,
          amount: request.amount,
          status: PaymentStatus.pending,
          paymentMethod: request.paymentDetails['method'] as String?,
          createdAt: DateTime.now(),
        );

        _payments.insert(0, payment);
        notifyListeners();

        return response;
      }
      return null;
    } catch (e) {
      _setError('Failed to create withdrawal: ${e.toString()}');
      return null;
    } finally {
      _setLoading(false);
    }
  }

  Future<Map<String, dynamic>?> processG2PayDeposit(
    String token,
    double amount,
    Map<String, dynamic> g2PayData,
  ) async {
    _setLoading(true);
    _clearError();

    try {
      // Для демонстрации используем обычный метод создания депозита
      final response = await ApiService.createDeposit(token, amount);
      if (response != null) {
        // Добавляем новый платеж в список
        final payment = Payment(
          id: DateTime.now().millisecondsSinceEpoch.toString(),
          userId: 'current_user',
          type: PaymentType.deposit,
          amount: amount,
          status: PaymentStatus.processing,
          paymentMethod: PaymentMethodType.g2pay,
          metadata: g2PayData,
          createdAt: DateTime.now(),
        );

        _payments.insert(0, payment);
        notifyListeners();

        return response;
      }
      return null;
    } catch (e) {
      _setError('Failed to process G2Pay deposit: ${e.toString()}');
      return null;
    } finally {
      _setLoading(false);
    }
  }

  void subscribeToPaymentUpdates() {
    _webSocketService.subscribeToPaymentUpdates();
  }

  void unsubscribeFromPaymentUpdates() {
    _webSocketService.unsubscribeFromPaymentUpdates();
  }

  void _handlePaymentInitiated(Map<String, dynamic> data) {
    try {
      final payment = Payment.fromJson(data);
      _payments.insert(0, payment);
      notifyListeners();
    } catch (e) {
      print('Error handling payment initiated: $e');
    }
  }

  void _handlePaymentCompleted(Map<String, dynamic> data) {
    try {
      final paymentId = data['paymentId'] as String?;
      if (paymentId != null) {
        _updatePaymentStatus(paymentId, PaymentStatus.completed);
      }
    } catch (e) {
      print('Error handling payment completed: $e');
    }
  }

  void _handlePaymentFailed(Map<String, dynamic> data) {
    try {
      final paymentId = data['paymentId'] as String?;
      final errorMessage = data['error'] as String?;
      if (paymentId != null) {
        _updatePaymentStatus(paymentId, PaymentStatus.failed, errorMessage);
      }
    } catch (e) {
      print('Error handling payment failed: $e');
    }
  }

  void _handleDepositProcessed(Map<String, dynamic> data) {
    try {
      final paymentId = data['paymentId'] as String?;
      if (paymentId != null) {
        _updatePaymentStatus(paymentId, PaymentStatus.completed);
      }
    } catch (e) {
      print('Error handling deposit processed: $e');
    }
  }

  void _handleWithdrawalProcessed(Map<String, dynamic> data) {
    try {
      final paymentId = data['paymentId'] as String?;
      if (paymentId != null) {
        _updatePaymentStatus(paymentId, PaymentStatus.completed);
      }
    } catch (e) {
      print('Error handling withdrawal processed: $e');
    }
  }

  void _updatePaymentStatus(String paymentId, String status,
      [String? errorMessage]) {
    final index = _payments.indexWhere((p) => p.id == paymentId);
    if (index != -1) {
      final payment = _payments[index];
      _payments[index] = Payment(
        id: payment.id,
        userId: payment.userId,
        type: payment.type,
        amount: payment.amount,
        currency: payment.currency,
        status: status,
        paymentMethod: payment.paymentMethod,
        externalTransactionId: payment.externalTransactionId,
        metadata: payment.metadata,
        errorMessage: errorMessage,
        createdAt: payment.createdAt,
        completedAt: status == PaymentStatus.completed ? DateTime.now() : null,
      );
      notifyListeners();
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
    _payments.clear();
    _paymentMethods.clear();
    _isLoading = false;
    _error = null;
    notifyListeners();
  }

  // Демонстрационные методы для создания тестовых платежей
  void addTestDeposit() {
    final testDeposit = Payment(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      userId: 'current_user',
      type: PaymentType.deposit,
      amount: 100.0,
      status: PaymentStatus.completed,
      paymentMethod: PaymentMethodType.creditCard,
      createdAt: DateTime.now().subtract(Duration(minutes: 5)),
      completedAt: DateTime.now(),
    );

    _payments.insert(0, testDeposit);
    notifyListeners();
  }

  void addTestWithdrawal() {
    final testWithdrawal = Payment(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      userId: 'current_user',
      type: PaymentType.withdrawal,
      amount: 50.0,
      status: PaymentStatus.pending,
      paymentMethod: PaymentMethodType.bankTransfer,
      createdAt: DateTime.now().subtract(Duration(minutes: 10)),
    );

    _payments.insert(0, testWithdrawal);
    notifyListeners();
  }

  void addPendingPayment() {
    final pendingPayment = Payment(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      userId: 'current_user',
      type: PaymentType.deposit,
      amount: 75.0,
      status: PaymentStatus.processing,
      paymentMethod: PaymentMethodType.g2pay,
      createdAt: DateTime.now().subtract(Duration(minutes: 2)),
    );

    _payments.insert(0, pendingPayment);
    notifyListeners();
  }
}
