import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:skillgame_flutter/models/user_model.dart';
import 'package:skillgame_flutter/models/tournament_model.dart';
import 'package:skillgame_flutter/utils/network_config.dart';

/// Comprehensive API service for SkillGame Pro API
/// Base URL: https://sklgmsapi.koltech.dev
class ApiService {
  static String get baseUrl => NetworkConfig.baseUrl;

  /// Standard headers for API requests
  static Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };

  /// Headers with authentication
  static Map<String, String> _authHeaders(String token) => {
        ..._headers,
        'Authorization': 'Bearer $token',
      };

  /// Handle API response with standard format согласно документации
  /// Success Response: { "success": true, "data": {...}, "message": "Success message" }
  /// Error Response: { "success": false, "message": "Error description", "error": "Detailed error information" }
  static ApiResponse _handleResponse(http.Response response) {
    try {
      final Map<String, dynamic> jsonBody = jsonDecode(response.body);

      if (response.statusCode >= 200 && response.statusCode < 300) {
        return ApiResponse(
          success: true,
          data: jsonBody['data'] ?? jsonBody,
          message: jsonBody['message'],
          statusCode: response.statusCode,
        );
      } else {
        return ApiResponse(
          success: false,
          data: null,
          message: jsonBody['message'] ?? 'Unknown error',
          error: jsonBody['error'],
          statusCode: response.statusCode,
        );
      }
    } catch (e) {
      print('JSON decode error: $e');
      print('Response body: ${response.body}');
      return ApiResponse(
        success: false,
        data: null,
        message: 'Failed to parse response',
        error: e.toString(),
        statusCode: response.statusCode,
      );
    }
  }

  // ============================================================================
  // AUTHENTICATION ENDPOINTS
  // ============================================================================

  /// Register a new user account
  /// POST /api/auth/register
  static Future<ApiResponse<AuthResponse>> register({
    required String username,
    required String email,
    required String password,
    required bool ageConfirmed,
    required bool termsAccepted,
    required bool privacyPolicyAccepted,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/register'),
        headers: _headers,
        body: jsonEncode({
          'username': username,
          'email': email,
          'password': password,
          'ageConfirmed': ageConfirmed,
          'termsAccepted': termsAccepted,
          'privacyPolicyAccepted': privacyPolicyAccepted,
        }),
      );

      final apiResponse = _handleResponse(response);
      if (apiResponse.success && apiResponse.data != null) {
        final authResponse = AuthResponse.fromJson(apiResponse.data);
        return ApiResponse(
          success: true,
          data: authResponse,
          message: apiResponse.message,
          statusCode: response.statusCode,
        );
      } else {
        return ApiResponse<AuthResponse>(
          success: false,
          data: null,
          message: apiResponse.message,
          error: apiResponse.error,
          statusCode: response.statusCode,
        );
      }
    } catch (e) {
      print('Registration error: $e');
      return ApiResponse<AuthResponse>(
        success: false,
        data: null,
        message: 'Network error during registration',
        error: e.toString(),
        statusCode: 0,
      );
    }
  }

  /// Authenticate user credentials
  /// POST /api/auth/login
  static Future<ApiResponse<AuthResponse>> login(
      String email, String password) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/login'),
        headers: _headers,
        body: jsonEncode({
          'email': email,
          'password': password,
        }),
      );

      final apiResponse = _handleResponse(response);
      if (apiResponse.success && apiResponse.data != null) {
        final authResponse = AuthResponse.fromJson(apiResponse.data);
        return ApiResponse(
          success: true,
          data: authResponse,
          message: apiResponse.message,
          statusCode: response.statusCode,
        );
      } else {
        return ApiResponse<AuthResponse>(
          success: false,
          data: null,
          message: apiResponse.message,
          error: apiResponse.error,
          statusCode: response.statusCode,
        );
      }
    } catch (e) {
      print('Login error: $e');
      return ApiResponse<AuthResponse>(
        success: false,
        data: null,
        message: 'Network error during login',
        error: e.toString(),
        statusCode: 0,
      );
    }
  }

  /// Request password reset code
  /// POST /api/auth/forgot-password
  static Future<ApiResponse<Map<String, dynamic>>> forgotPassword(
      String email) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/forgot-password'),
        headers: _headers,
        body: jsonEncode({'email': email}),
      );

      final apiResponse = _handleResponse(response);
      return ApiResponse(
        success: apiResponse.success,
        data: apiResponse.data,
        message: apiResponse.message,
        error: apiResponse.error,
        statusCode: response.statusCode,
      );
    } catch (e) {
      print('Forgot password error: $e');
      return ApiResponse<Map<String, dynamic>>(
        success: false,
        data: null,
        message: 'Network error during password reset request',
        error: e.toString(),
        statusCode: 0,
      );
    }
  }

  /// Reset password using verification code
  /// POST /api/auth/reset-password
  static Future<ApiResponse<bool>> resetPassword({
    required String email,
    required String secretCode,
    required String newPassword,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/reset-password'),
        headers: _headers,
        body: jsonEncode({
          'email': email,
          'secretCode': secretCode,
          'newPassword': newPassword,
        }),
      );

      final apiResponse = _handleResponse(response);
      return ApiResponse<bool>(
        success: apiResponse.success,
        data: apiResponse.success,
        message: apiResponse.message,
        error: apiResponse.error,
        statusCode: response.statusCode,
      );
    } catch (e) {
      print('Reset password error: $e');
      return ApiResponse<bool>(
        success: false,
        data: false,
        message: 'Network error during password reset',
        error: e.toString(),
        statusCode: 0,
      );
    }
  }

  // ============================================================================
  // USER MANAGEMENT ENDPOINTS
  // ============================================================================

  /// Get current user profile information
  /// GET /api/users/profile
  static Future<ApiResponse<User>> getUserProfile(String token) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/users/profile'),
        headers: _authHeaders(token),
      );

      final apiResponse = _handleResponse(response);
      if (apiResponse.success && apiResponse.data != null) {
        final user = User.fromJson(apiResponse.data);
        return ApiResponse(
          success: true,
          data: user,
          message: apiResponse.message,
          statusCode: response.statusCode,
        );
      } else {
        return ApiResponse<User>(
          success: false,
          data: null,
          message: apiResponse.message,
          error: apiResponse.error,
          statusCode: response.statusCode,
        );
      }
    } catch (e) {
      print('Get profile error: $e');
      return ApiResponse<User>(
        success: false,
        data: null,
        message: 'Network error fetching profile',
        error: e.toString(),
        statusCode: 0,
      );
    }
  }

  /// Update user avatar
  /// PUT /api/users/profile/avatar
  static Future<User?> updateUserAvatar(String token, File avatarFile) async {
    try {
      final request = http.MultipartRequest(
        'PUT',
        Uri.parse('$baseUrl/users/profile/avatar'),
      );
      request.headers.addAll(_authHeaders(token));
      request.files.add(
        await http.MultipartFile.fromPath('avatar', avatarFile.path),
      );

      final streamedResponse = await request.send();
      final response = await http.Response.fromStream(streamedResponse);

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return User.fromJson(data);
      }
      return null;
    } catch (e) {
      print('Update avatar error: $e');
      throw Exception('Network error updating avatar');
    }
  }

  /// Get user's game history with pagination
  /// GET /api/users/history/games
  static Future<Map<String, dynamic>?> getGameHistory(
    String token, {
    int page = 1,
    int limit = 10,
  }) async {
    try {
      final uri = Uri.parse('$baseUrl/users/history/games').replace(
        queryParameters: {
          'page': page.toString(),
          'limit': limit.toString(),
        },
      );

      final response = await http.get(uri, headers: _authHeaders(token));
      final apiResponse = _handleResponse(response);
      return apiResponse.success ? apiResponse.data : null;
    } catch (e) {
      print('Get game history error: $e');
      throw Exception('Network error fetching game history');
    }
  }

  /// Get user's transaction history with pagination
  /// GET /api/users/history/transactions
  static Future<Map<String, dynamic>?> getTransactionHistory(
    String token, {
    int page = 1,
    int limit = 10,
  }) async {
    try {
      final uri = Uri.parse('$baseUrl/users/history/transactions').replace(
        queryParameters: {
          'page': page.toString(),
          'limit': limit.toString(),
        },
      );

      final response = await http.get(uri, headers: _authHeaders(token));
      final apiResponse = _handleResponse(response);
      return apiResponse.success ? apiResponse.data : null;
    } catch (e) {
      print('Get transaction history error: $e');
      throw Exception('Network error fetching transaction history');
    }
  }

  /// Update user password
  /// PUT /api/users/profile/password
  static Future<bool> updateUserPassword(
    String token,
    String currentPassword,
    String newPassword,
  ) async {
    try {
      final response = await http.put(
        Uri.parse('$baseUrl/users/profile/password'),
        headers: _authHeaders(token),
        body: jsonEncode({
          'currentPassword': currentPassword,
          'newPassword': newPassword,
        }),
      );

      return response.statusCode == 200;
    } catch (e) {
      print('Update password error: $e');
      throw Exception('Network error updating password');
    }
  }

  /// Update user balance (demo purposes)
  /// POST /api/users/balance
  static Future<User?> updateBalance(String token, double amount) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/users/balance'),
        headers: _authHeaders(token),
        body: jsonEncode({'amount': amount}),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return User.fromJson(data);
      }
      return null;
    } catch (e) {
      print('Update balance error: $e');
      throw Exception('Network error updating balance');
    }
  }

  /// Submit KYC documents
  /// POST /api/users/kyc
  static Future<Map<String, dynamic>?> submitKYC(
    String token,
    File document,
    String documentType,
  ) async {
    try {
      final request = http.MultipartRequest(
        'POST',
        Uri.parse('$baseUrl/users/kyc'),
      );
      request.headers.addAll(_authHeaders(token));
      request.files.add(
        await http.MultipartFile.fromPath('document', document.path),
      );
      request.fields['documentType'] = documentType;

      final streamedResponse = await request.send();
      final response = await http.Response.fromStream(streamedResponse);

      final apiResponse = _handleResponse(response);
      return apiResponse.success ? apiResponse.data : null;
    } catch (e) {
      print('Submit KYC error: $e');
      throw Exception('Network error submitting KYC');
    }
  }

  // ============================================================================
  // TOURNAMENT ENDPOINTS
  // ============================================================================

  /// Get active tournaments
  /// GET /api/tournaments
  static Future<List<Tournament>> getActiveTournaments() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/tournaments'),
        headers: _headers,
      );

      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        return data.map((json) => Tournament.fromJson(json)).toList();
      }
      return [];
    } catch (e) {
      print('Get tournaments error: $e');
      throw Exception('Network error fetching tournaments');
    }
  }

  /// Get all tournaments with pagination and filtering
  /// GET /api/tournaments/all
  static Future<Map<String, dynamic>?> getAllTournaments({
    int page = 1,
    int limit = 12,
    String? status,
    String? gameType,
  }) async {
    try {
      final queryParams = <String, String>{
        'page': page.toString(),
        'limit': limit.toString(),
      };
      if (status != null) queryParams['status'] = status;
      if (gameType != null) queryParams['gameType'] = gameType;

      final uri = Uri.parse('$baseUrl/tournaments/all').replace(
        queryParameters: queryParams,
      );

      final response = await http.get(uri, headers: _headers);
      final apiResponse = _handleResponse(response);
      return apiResponse.success ? apiResponse.data : null;
    } catch (e) {
      print('Get all tournaments error: $e');
      throw Exception('Network error fetching all tournaments');
    }
  }

  /// Get finished tournaments history
  /// GET /api/tournaments/history
  static Future<Map<String, dynamic>?> getTournamentHistory({
    int page = 1,
    int limit = 10,
    String? gameType,
  }) async {
    try {
      final queryParams = <String, String>{
        'page': page.toString(),
        'limit': limit.toString(),
      };
      if (gameType != null) queryParams['gameType'] = gameType;

      final uri = Uri.parse('$baseUrl/tournaments/history').replace(
        queryParameters: queryParams,
      );

      final response = await http.get(uri, headers: _headers);
      final apiResponse = _handleResponse(response);
      return apiResponse.success ? apiResponse.data : null;
    } catch (e) {
      print('Get tournament history error: $e');
      throw Exception('Network error fetching tournament history');
    }
  }

  /// Get tournament statistics
  /// GET /api/tournaments/stats
  static Future<Map<String, dynamic>?> getTournamentStats() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/tournaments/stats'),
        headers: _headers,
      );

      final apiResponse = _handleResponse(response);
      return apiResponse.success ? apiResponse.data : null;
    } catch (e) {
      print('Get tournament stats error: $e');
      throw Exception('Network error fetching tournament stats');
    }
  }

  /// Get tournament details by ID
  /// GET /api/tournaments/:tournamentId
  static Future<Tournament?> getTournament(String tournamentId) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/tournaments/$tournamentId'),
        headers: _headers,
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return Tournament.fromJson(data);
      }
      return null;
    } catch (e) {
      print('Get tournament error: $e');
      throw Exception('Network error fetching tournament');
    }
  }

  /// Create a new tournament
  /// POST /api/tournaments
  static Future<Map<String, dynamic>?> createTournament(
    String token, {
    required String name,
    required String gameType,
    required int maxPlayers,
    required double entryFee,
    double platformCommission = 10.0,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/tournaments'),
        headers: _authHeaders(token),
        body: jsonEncode({
          'name': name,
          'gameType': gameType,
          'maxPlayers': maxPlayers,
          'entryFee': entryFee,
          'platformCommission': platformCommission,
        }),
      );

      final apiResponse = _handleResponse(response);
      return apiResponse.success ? apiResponse.data : null;
    } catch (e) {
      print('Create tournament error: $e');
      throw Exception('Network error creating tournament');
    }
  }

  /// Get tournaments for authenticated player
  /// GET /api/tournaments/player
  static Future<List<Tournament>> getPlayerTournaments(String token) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/tournaments/player'),
        headers: _authHeaders(token),
      );

      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        return data.map((json) => Tournament.fromJson(json)).toList();
      }
      return [];
    } catch (e) {
      print('Get player tournaments error: $e');
      throw Exception('Network error fetching player tournaments');
    }
  }

  /// Register for a tournament
  /// POST /api/tournaments/:tournamentId/register
  static Future<bool> registerInTournament(
    String token,
    String tournamentId, {
    String? socketId,
  }) async {
    try {
      final headers = _authHeaders(token);
      if (socketId != null) {
        headers['x-socket-id'] = socketId;
      }

      final response = await http.post(
        Uri.parse('$baseUrl/tournaments/$tournamentId/register'),
        headers: headers,
      );

      return response.statusCode == 200;
    } catch (e) {
      print('Tournament registration error: $e');
      throw Exception('Network error during tournament registration');
    }
  }

  /// Unregister from a tournament
  /// DELETE /api/tournaments/:tournamentId/register
  static Future<bool> unregisterFromTournament(
    String token,
    String tournamentId,
  ) async {
    try {
      final response = await http.delete(
        Uri.parse('$baseUrl/tournaments/$tournamentId/register'),
        headers: _authHeaders(token),
      );

      return response.statusCode == 200;
    } catch (e) {
      print('Tournament unregistration error: $e');
      throw Exception('Network error during tournament unregistration');
    }
  }

  // ============================================================================
  // TOURNAMENT TEMPLATE ENDPOINTS
  // ============================================================================

  /// Get active tournament templates
  /// GET /api/tournament-templates/active
  static Future<List<dynamic>> getActiveTournamentTemplates() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/tournament-templates/active'),
        headers: _headers,
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body) as List<dynamic>;
      }
      return [];
    } catch (e) {
      print('Get active templates error: $e');
      throw Exception('Network error fetching active templates');
    }
  }

  /// Get tournament scheduler statistics
  /// GET /api/tournament-templates/scheduler/stats
  static Future<Map<String, dynamic>?> getTournamentSchedulerStats() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/tournament-templates/scheduler/stats'),
        headers: _headers,
      );

      final apiResponse = _handleResponse(response);
      return apiResponse.success ? apiResponse.data : null;
    } catch (e) {
      print('Get scheduler stats error: $e');
      throw Exception('Network error fetching scheduler stats');
    }
  }

  /// Get all tournament templates
  /// GET /api/tournament-templates
  static Future<List<dynamic>> getAllTournamentTemplates(String token) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/tournament-templates'),
        headers: _authHeaders(token),
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body) as List<dynamic>;
      }
      return [];
    } catch (e) {
      print('Get tournament templates error: $e');
      throw Exception('Network error fetching tournament templates');
    }
  }

  // ============================================================================
  // PAYMENT ENDPOINTS
  // ============================================================================

  /// Create a deposit payment
  /// POST /api/payments/deposit
  static Future<Map<String, dynamic>?> createDeposit(
    String token,
    double amount,
  ) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/payments/deposit'),
        headers: _authHeaders(token),
        body: jsonEncode({'amount': amount}),
      );

      final apiResponse = _handleResponse(response);
      return apiResponse.success ? apiResponse.data : null;
    } catch (e) {
      print('Create deposit error: $e');
      throw Exception('Network error creating deposit');
    }
  }

  /// Create a withdrawal request
  /// POST /api/payments/withdrawal
  static Future<Map<String, dynamic>?> createWithdrawal(
    String token,
    double amount,
    Map<String, dynamic> recipientDetails,
  ) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/payments/withdrawal'),
        headers: _authHeaders(token),
        body: jsonEncode({
          'amount': amount,
          'recipientDetails': recipientDetails,
        }),
      );

      final apiResponse = _handleResponse(response);
      return apiResponse.success ? apiResponse.data : null;
    } catch (e) {
      print('Create withdrawal error: $e');
      throw Exception('Network error creating withdrawal');
    }
  }

  /// Get payment status
  /// GET /api/payments/status/:paymentId
  static Future<Map<String, dynamic>?> getPaymentStatus(
    String token,
    String paymentId,
  ) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/payments/status/$paymentId'),
        headers: _authHeaders(token),
      );

      final apiResponse = _handleResponse(response);
      return apiResponse.success ? apiResponse.data : null;
    } catch (e) {
      print('Get payment status error: $e');
      throw Exception('Network error fetching payment status');
    }
  }

  /// Get user's payment history
  /// GET /api/payments/history
  static Future<Map<String, dynamic>?> getPaymentHistory(
    String token, {
    int page = 1,
    int limit = 20,
    String? type,
  }) async {
    try {
      final queryParams = <String, String>{
        'page': page.toString(),
        'limit': limit.toString(),
      };
      if (type != null) queryParams['type'] = type;

      final uri = Uri.parse('$baseUrl/payments/history').replace(
        queryParameters: queryParams,
      );

      final response = await http.get(uri, headers: _authHeaders(token));
      final apiResponse = _handleResponse(response);
      return apiResponse.success ? apiResponse.data : null;
    } catch (e) {
      print('Get payment history error: $e');
      throw Exception('Network error fetching payment history');
    }
  }

  // ============================================================================
  // NOTIFICATION ENDPOINTS
  // ============================================================================

  /// Get user's notifications
  /// GET /api/notifications
  static Future<List<dynamic>> getNotifications(String token) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/notifications'),
        headers: _authHeaders(token),
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body) as List<dynamic>;
      }
      return [];
    } catch (e) {
      print('Get notifications error: $e');
      throw Exception('Network error fetching notifications');
    }
  }

  /// Get count of unread notifications
  /// GET /api/notifications/unread-count
  static Future<int> getUnreadNotificationsCount(String token) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/notifications/unread-count'),
        headers: _authHeaders(token),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return data['unreadCount'] ?? 0;
      }
      return 0;
    } catch (e) {
      print('Get unread count error: $e');
      throw Exception('Network error fetching unread count');
    }
  }

  /// Mark all notifications as read
  /// POST /api/notifications/read
  static Future<bool> markAllNotificationsAsRead(String token) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/notifications/read'),
        headers: _authHeaders(token),
      );

      return response.statusCode == 200;
    } catch (e) {
      print('Mark notifications read error: $e');
      throw Exception('Network error marking notifications as read');
    }
  }

  /// Mark specific notification as read
  /// POST /api/notifications/:id/read
  static Future<bool> markNotificationAsRead(
    String token,
    String notificationId,
  ) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/notifications/$notificationId/read'),
        headers: _authHeaders(token),
      );

      return response.statusCode == 200;
    } catch (e) {
      print('Mark notification read error: $e');
      throw Exception('Network error marking notification as read');
    }
  }

  // ============================================================================
  // CHAT SYSTEM ENDPOINTS
  // ============================================================================

  /// Create a new chat (supports both authenticated users and guests)
  /// POST /api/chat/create
  static Future<Map<String, dynamic>?> createChat({
    String? token,
    String? guestName,
    String? guestEmail,
    required String subject,
    required String message,
  }) async {
    try {
      final headers = token != null ? _authHeaders(token) : _headers;
      final body = <String, dynamic>{
        'subject': subject,
        'message': message,
      };

      if (guestName != null) body['guestName'] = guestName;
      if (guestEmail != null) body['guestEmail'] = guestEmail;

      final response = await http.post(
        Uri.parse('$baseUrl/chat/create'),
        headers: headers,
        body: jsonEncode(body),
      );

      final apiResponse = _handleResponse(response);
      return apiResponse.success ? apiResponse.data : null;
    } catch (e) {
      print('Create chat error: $e');
      throw Exception('Network error creating chat');
    }
  }

  /// Send message as guest user
  /// POST /api/chat/guest/message
  static Future<bool> sendGuestMessage({
    required String chatId,
    required String content,
    required String guestName,
    required String guestEmail,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/chat/guest/message'),
        headers: _headers,
        body: jsonEncode({
          'chatId': chatId,
          'content': content,
          'guestName': guestName,
          'guestEmail': guestEmail,
        }),
      );

      return response.statusCode == 200;
    } catch (e) {
      print('Send guest message error: $e');
      throw Exception('Network error sending guest message');
    }
  }

  /// Get chat details
  /// GET /api/chat/:chatId
  static Future<Map<String, dynamic>?> getChat(String chatId) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/chat/$chatId'),
        headers: _headers,
      );

      final apiResponse = _handleResponse(response);
      return apiResponse.success ? apiResponse.data : null;
    } catch (e) {
      print('Get chat error: $e');
      throw Exception('Network error fetching chat');
    }
  }

  /// Get user's chats
  /// GET /api/chat/user
  static Future<List<dynamic>> getUserChats(String token) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/chat/user'),
        headers: _authHeaders(token),
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body) as List<dynamic>;
      }
      return [];
    } catch (e) {
      print('Get user chats error: $e');
      throw Exception('Network error fetching user chats');
    }
  }

  /// Send message in chat
  /// POST /api/chat/:chatId/message
  static Future<bool> sendChatMessage(
    String token,
    String chatId,
    String content,
  ) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/chat/$chatId/message'),
        headers: _authHeaders(token),
        body: jsonEncode({'content': content}),
      );

      return response.statusCode == 200;
    } catch (e) {
      print('Send chat message error: $e');
      throw Exception('Network error sending chat message');
    }
  }

  /// Mark chat messages as read
  /// POST /api/chat/:chatId/read
  static Future<bool> markChatAsRead(String token, String chatId) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/chat/$chatId/read'),
        headers: _authHeaders(token),
      );

      return response.statusCode == 200;
    } catch (e) {
      print('Mark chat read error: $e');
      throw Exception('Network error marking chat as read');
    }
  }

  /// Close a chat
  /// POST /api/chat/:chatId/close
  static Future<bool> closeChat(String token, String chatId) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/chat/$chatId/close'),
        headers: _authHeaders(token),
      );

      return response.statusCode == 200;
    } catch (e) {
      print('Close chat error: $e');
      throw Exception('Network error closing chat');
    }
  }

  // ============================================================================
  // GAME LOBBY SCHEDULER ENDPOINTS
  // ============================================================================

  /// Get lobby scheduler statistics
  /// GET /api/game-lobby-scheduler/stats
  static Future<Map<String, dynamic>?> getLobbySchedulerStats() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/game-lobby-scheduler/stats'),
        headers: _headers,
      );

      final apiResponse = _handleResponse(response);
      return apiResponse.success ? apiResponse.data : null;
    } catch (e) {
      print('Get lobby scheduler stats error: $e');
      throw Exception('Network error fetching lobby scheduler stats');
    }
  }

  /// Get general lobby statistics
  /// GET /api/game-lobby-scheduler/lobby-stats
  static Future<Map<String, dynamic>?> getLobbyStats() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/game-lobby-scheduler/lobby-stats'),
        headers: _headers,
      );

      final apiResponse = _handleResponse(response);
      return apiResponse.success ? apiResponse.data : null;
    } catch (e) {
      print('Get lobby stats error: $e');
      throw Exception('Network error fetching lobby stats');
    }
  }

  // ============================================================================
  // KYC (SUMSUB) ENDPOINTS
  // ============================================================================

  /// Get Sumsub access token for KYC verification
  /// GET /api/sumsub/access-token
  static Future<Map<String, dynamic>?> getSumsubAccessToken(
      String token) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/sumsub/access-token'),
        headers: _authHeaders(token),
      );

      final apiResponse = _handleResponse(response);
      return apiResponse.success ? apiResponse.data : null;
    } catch (e) {
      print('Get Sumsub access token error: $e');
      throw Exception('Network error fetching Sumsub access token');
    }
  }

  /// Get user's KYC verification status
  /// GET /api/sumsub/verification-status
  static Future<Map<String, dynamic>?> getKYCVerificationStatus(
      String token) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/sumsub/verification-status'),
        headers: _authHeaders(token),
      );

      final apiResponse = _handleResponse(response);
      return apiResponse.success ? apiResponse.data : null;
    } catch (e) {
      print('Get KYC verification status error: $e');
      throw Exception('Network error fetching KYC verification status');
    }
  }

  /// Submit mock KYC documents (development only)
  /// POST /api/sumsub/mock-submission
  static Future<Map<String, dynamic>?> submitMockKYC(
    String token,
    Map<String, dynamic> kycData,
  ) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/sumsub/mock-submission'),
        headers: _authHeaders(token),
        body: jsonEncode(kycData),
      );

      final apiResponse = _handleResponse(response);
      return apiResponse.success ? apiResponse.data : null;
    } catch (e) {
      print('Submit mock KYC error: $e');
      throw Exception('Network error submitting mock KYC');
    }
  }

  // ============================================================================
  // HEALTH CHECK ENDPOINTS
  // ============================================================================

  /// Basic health check endpoint
  /// GET /health
  static Future<Map<String, dynamic>?> healthCheck() async {
    try {
      final response = await http.get(
        Uri.parse('${baseUrl.replaceAll('/api', '')}/health'),
        headers: _headers,
      );

      final apiResponse = _handleResponse(response);
      return apiResponse.success ? apiResponse.data : null;
    } catch (e) {
      print('Health check error: $e');
      throw Exception('Network error during health check');
    }
  }

  /// CORS configuration test endpoint
  /// GET /cors-test
  static Future<Map<String, dynamic>?> corsTest() async {
    try {
      final response = await http.get(
        Uri.parse('${baseUrl.replaceAll('/api', '')}/cors-test'),
        headers: _headers,
      );

      final apiResponse = _handleResponse(response);
      return apiResponse.success ? apiResponse.data : null;
    } catch (e) {
      print('CORS test error: $e');
      throw Exception('Network error during CORS test');
    }
  }

  /// API root endpoint
  /// GET /
  static Future<Map<String, dynamic>?> apiRoot() async {
    try {
      final response = await http.get(
        Uri.parse(baseUrl.replaceAll('/api', '')),
        headers: _headers,
      );

      final apiResponse = _handleResponse(response);
      return apiResponse.success ? apiResponse.data : null;
    } catch (e) {
      print('API root error: $e');
      throw Exception('Network error accessing API root');
    }
  }
}

/// Стандартный API Response согласно документации
class ApiResponse<T> {
  final bool success;
  final T? data;
  final String? message;
  final String? error;
  final int statusCode;

  const ApiResponse({
    required this.success,
    this.data,
    this.message,
    this.error,
    required this.statusCode,
  });

  factory ApiResponse.fromJson(
      Map<String, dynamic> json, T Function(Map<String, dynamic>)? fromJson) {
    return ApiResponse<T>(
      success: json['success'] ?? false,
      data: json['data'] != null && fromJson != null
          ? fromJson(json['data'])
          : json['data'],
      message: json['message'],
      error: json['error'],
      statusCode: 200, // Default when parsing from JSON
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'success': success,
      'data': data,
      'message': message,
      'error': error,
    };
  }
}
