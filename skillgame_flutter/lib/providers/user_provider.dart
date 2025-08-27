import 'package:flutter/material.dart';
import 'package:skillgame_flutter/models/user_model.dart';
import 'package:skillgame_flutter/services/api_service.dart';

class UserProvider extends ChangeNotifier {
  List<GameRecord> _gameHistory = [];
  List<Transaction> _transactionHistory = [];
  bool _isLoadingHistory = false;
  String? _error;

  List<GameRecord> get gameHistory => _gameHistory;
  List<Transaction> get transactionHistory => _transactionHistory;
  bool get isLoadingHistory => _isLoadingHistory;
  String? get error => _error;

  Future<void> loadGameHistory(String token) async {
    _setLoadingHistory(true);
    _clearError();

    try {
      final response = await ApiService.getGameHistory(token);
      if (response != null) {
        // Parse the response - API returns Map with games array
        final gamesData = response['games'] as List?;
        if (gamesData != null) {
          _gameHistory =
              gamesData.map((json) => GameRecord.fromJson(json)).toList();
        }
      }
      notifyListeners();
    } catch (e) {
      _setError('Failed to load game history: ${e.toString()}');
    } finally {
      _setLoadingHistory(false);
    }
  }

  Future<void> loadTransactionHistory(String token) async {
    _setLoadingHistory(true);
    _clearError();

    try {
      final response = await ApiService.getTransactionHistory(token);
      if (response != null) {
        // Parse the response - API returns Map with transactions array
        final transactionsData = response['transactions'] as List?;
        if (transactionsData != null) {
          _transactionHistory = transactionsData
              .map((json) => Transaction.fromJson(json))
              .toList();
        }
      }
      notifyListeners();
    } catch (e) {
      _setError('Failed to load transaction history: ${e.toString()}');
    } finally {
      _setLoadingHistory(false);
    }
  }

  Future<bool> createDeposit(String token, double amount) async {
    _clearError();

    try {
      final response = await ApiService.createDeposit(token, amount);
      if (response != null) {
        // Reload transaction history
        await loadTransactionHistory(token);
        return true;
      }
      return false;
    } catch (e) {
      _setError('Failed to create deposit: ${e.toString()}');
      return false;
    }
  }

  Future<bool> createWithdrawal(String token, double amount) async {
    _clearError();

    try {
      // createWithdrawal requires payment details as third parameter
      final response = await ApiService.createWithdrawal(
          token, amount, {'method': 'bank_transfer', 'account': 'default'});
      if (response != null) {
        // Reload transaction history
        await loadTransactionHistory(token);
        return true;
      }
      return false;
    } catch (e) {
      _setError('Failed to create withdrawal: ${e.toString()}');
      return false;
    }
  }

  void _setLoadingHistory(bool loading) {
    _isLoadingHistory = loading;
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
    _gameHistory.clear();
    _transactionHistory.clear();
    _isLoadingHistory = false;
    _error = null;
    notifyListeners();
  }
}
