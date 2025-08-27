import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:skillgame_flutter/models/user_model.dart';
import 'package:skillgame_flutter/services/api_service.dart';

class AuthProvider extends ChangeNotifier {
  User? _user;
  String? _token;
  bool _isLoading = false;
  String? _error;

  User? get user => _user;
  String? get token => _token;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get isAuthenticated => _user != null && _token != null;

  AuthProvider() {
    _loadStoredAuth();
  }

  Future<void> _loadStoredAuth() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      _token = prefs.getString('auth_token');
      final userJson = prefs.getString('user_data');

      if (_token != null && userJson != null) {
        try {
          final userData = jsonDecode(userJson);
          _user = User.fromJson(userData);
          // NOTE: Temporarily skip token validation to avoid blocking login screen
          // Will validate token when user tries to access protected features
          notifyListeners();
        } catch (e) {
          print('Error parsing stored user data: $e');
          // Clear invalid data
          await _clearAuth();
        }
      }
    } catch (e) {
      print('Error loading stored auth: $e');
    }
  }

  Future<void> _saveAuth(String token, User user) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('auth_token', token);
      await prefs.setString('user_data', jsonEncode(user.toJson()));
    } catch (e) {
      print('Error saving auth: $e');
    }
  }

  Future<void> _clearAuth() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('auth_token');
      await prefs.remove('user_data');
    } catch (e) {
      print('Error clearing auth: $e');
    }
  }

  Future<bool> login(String email, String password) async {
    _setLoading(true);
    _clearError();

    try {
      final response = await ApiService.login(email, password);

      if (response.success && response.data != null) {
        _token = response.data!.token;
        _user = User(
          id: response.data!.id,
          username: response.data!.username,
          email: response.data!.email,
          avatar: response.data!.avatar,
          balance: response.data!.balance,
          role: response.data!.role,
        );

        await _saveAuth(_token!, _user!);
        _setLoading(false);
        notifyListeners();
        return true;
      } else {
        _setError(response.message ?? 'Login failed');
      }
    } catch (e) {
      _setError('Login failed: ${e.toString()}');
    }

    _setLoading(false);
    return false;
  }

  Future<bool> register({
    required String username,
    required String email,
    required String password,
    required bool ageConfirmed,
    required bool termsAccepted,
    required bool privacyPolicyAccepted,
  }) async {
    _setLoading(true);
    _clearError();

    try {
      final response = await ApiService.register(
        username: username,
        email: email,
        password: password,
        ageConfirmed: ageConfirmed,
        termsAccepted: termsAccepted,
        privacyPolicyAccepted: privacyPolicyAccepted,
      );

      if (response.success && response.data != null) {
        _token = response.data!.token;
        _user = User(
          id: response.data!.id,
          username: response.data!.username,
          email: response.data!.email,
          avatar: response.data!.avatar,
          balance: response.data!.balance,
          role: response.data!.role,
          ageConfirmed: ageConfirmed,
          termsAccepted: termsAccepted,
          privacyPolicyAccepted: privacyPolicyAccepted,
        );

        await _saveAuth(_token!, _user!);
        _setLoading(false);
        notifyListeners();
        return true;
      } else {
        _setError(response.message ?? 'Registration failed');
      }
    } catch (e) {
      _setError('Registration failed: ${e.toString()}');
    }

    _setLoading(false);
    return false;
  }

  Future<bool> forgotPassword(String email) async {
    _setLoading(true);
    _clearError();

    try {
      final result = await ApiService.forgotPassword(email);
      _setLoading(false);
      if (!result.success) {
        _setError(result.message ?? 'Password reset failed');
      }
      return result.success;
    } catch (e) {
      _setError('Password reset failed: ${e.toString()}');
      _setLoading(false);
      return false;
    }
  }

  Future<bool> resetPassword({
    required String email,
    required String secretCode,
    required String newPassword,
  }) async {
    _setLoading(true);
    _clearError();

    try {
      final response = await ApiService.resetPassword(
        email: email,
        secretCode: secretCode,
        newPassword: newPassword,
      );
      _setLoading(false);
      if (!response.success) {
        _setError(response.message ?? 'Password reset failed');
      }
      return response.success;
    } catch (e) {
      _setError('Password reset failed: ${e.toString()}');
      _setLoading(false);
      return false;
    }
  }

  Future<void> getUserProfile() async {
    if (_token == null) return;

    try {
      final response = await ApiService.getUserProfile(_token!);
      if (response.success && response.data != null) {
        _user = response.data;
        notifyListeners();
      } else {
        // Token is invalid, clear auth but don't auto-logout to avoid blocking UI
        print('Invalid token detected, clearing auth');
        await _clearAuth();
        _user = null;
        _token = null;
        notifyListeners();
      }
    } catch (e) {
      print('Error fetching user profile: $e');
      // Clear auth on network errors to prevent blocking
      await _clearAuth();
      _user = null;
      _token = null;
      notifyListeners();
    }
  }

  Future<void> updateUserBalance(double newBalance) async {
    if (_user != null) {
      _user = _user!.copyWith(balance: newBalance);
      notifyListeners();
    }
  }

  Future<void> logout() async {
    _user = null;
    _token = null;
    await _clearAuth();
    notifyListeners();
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
}
