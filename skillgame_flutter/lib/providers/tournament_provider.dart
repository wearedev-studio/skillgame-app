import 'package:flutter/material.dart';
import 'package:skillgame_flutter/models/tournament_model.dart';
import 'package:skillgame_flutter/services/api_service.dart';

class TournamentProvider extends ChangeNotifier {
  List<Tournament> _activeTournaments = [];
  List<Tournament> _playerTournaments = [];
  Tournament? _selectedTournament;
  bool _isLoading = false;
  String? _error;

  List<Tournament> get activeTournaments => _activeTournaments;
  List<Tournament> get playerTournaments => _playerTournaments;
  Tournament? get selectedTournament => _selectedTournament;
  bool get isLoading => _isLoading;
  String? get error => _error;

  Future<void> loadActiveTournaments() async {
    _setLoading(true);
    _clearError();

    try {
      final response = await ApiService.getActiveTournaments();
      if (response != null) {
        // Parse the response - API can return either List or Map
        try {
          if (response is List) {
            _activeTournaments = response
                .map(
                    (json) => Tournament.fromJson(json as Map<String, dynamic>))
                .toList();
          } else {
            final responseMap = response as Map<String, dynamic>;
            if (responseMap.containsKey('tournaments')) {
              final tournamentsData = responseMap['tournaments'] as List;
              _activeTournaments = tournamentsData
                  .map((json) =>
                      Tournament.fromJson(json as Map<String, dynamic>))
                  .toList();
            }
          }
        } catch (e) {
          print('Error parsing tournaments response: $e');
        }
      }
      notifyListeners();
    } catch (e) {
      _setError('Failed to load tournaments: ${e.toString()}');
    } finally {
      _setLoading(false);
    }
  }

  Future<void> loadPlayerTournaments(String token) async {
    _setLoading(true);
    _clearError();

    try {
      final response = await ApiService.getPlayerTournaments(token);
      if (response != null) {
        // Parse the response - API can return either List or Map
        try {
          if (response is List) {
            _playerTournaments = response
                .map(
                    (json) => Tournament.fromJson(json as Map<String, dynamic>))
                .toList();
          } else {
            final responseMap = response as Map<String, dynamic>;
            if (responseMap.containsKey('tournaments')) {
              final tournamentsData = responseMap['tournaments'] as List;
              _playerTournaments = tournamentsData
                  .map((json) =>
                      Tournament.fromJson(json as Map<String, dynamic>))
                  .toList();
            }
          }
        } catch (e) {
          print('Error parsing player tournaments response: $e');
        }
      }
      notifyListeners();
    } catch (e) {
      _setError('Failed to load player tournaments: ${e.toString()}');
    } finally {
      _setLoading(false);
    }
  }

  Future<void> loadTournament(String tournamentId) async {
    _setLoading(true);
    _clearError();

    try {
      final response = await ApiService.getTournament(tournamentId);
      if (response != null) {
        // Parse the response - API returns tournament data as Map
        _selectedTournament =
            Tournament.fromJson(response as Map<String, dynamic>);
      }
      notifyListeners();
    } catch (e) {
      _setError('Failed to load tournament: ${e.toString()}');
    } finally {
      _setLoading(false);
    }
  }

  Future<bool> registerInTournament(String token, String tournamentId) async {
    _clearError();

    try {
      final response =
          await ApiService.registerInTournament(token, tournamentId);
      if (response != null) {
        // Reload tournaments
        await Future.wait([
          loadActiveTournaments(),
          loadPlayerTournaments(token),
        ]);
        if (_selectedTournament?.id == tournamentId) {
          await loadTournament(tournamentId);
        }
      }
      return true;
    } catch (e) {
      _setError('Failed to register in tournament: ${e.toString()}');
      return false;
    }
  }

  Future<bool> unregisterFromTournament(
      String token, String tournamentId) async {
    _clearError();

    try {
      final response =
          await ApiService.unregisterFromTournament(token, tournamentId);
      if (response != null) {
        // Reload tournaments
        await Future.wait([
          loadActiveTournaments(),
          loadPlayerTournaments(token),
        ]);
        if (_selectedTournament?.id == tournamentId) {
          await loadTournament(tournamentId);
        }
      }
      return true;
    } catch (e) {
      _setError('Failed to unregister from tournament: ${e.toString()}');
      return false;
    }
  }

  List<Tournament> getTournamentsByGameType(String gameType) {
    return _activeTournaments.where((t) => t.gameType == gameType).toList();
  }

  List<Tournament> getWaitingTournaments() {
    return _activeTournaments.where((t) => t.isWaiting).toList();
  }

  List<Tournament> getActiveTournaments() {
    return _activeTournaments.where((t) => t.isActive).toList();
  }

  List<Tournament> getFinishedTournaments() {
    return _activeTournaments.where((t) => t.isFinished).toList();
  }

  bool isPlayerRegistered(String tournamentId, String playerId) {
    final tournament =
        _activeTournaments.where((t) => t.id == tournamentId).firstOrNull;
    if (tournament == null) return false;

    return tournament.players.any((p) => p.id == playerId);
  }

  void selectTournament(Tournament tournament) {
    _selectedTournament = tournament;
    notifyListeners();
  }

  void clearSelectedTournament() {
    _selectedTournament = null;
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

  void reset() {
    _activeTournaments.clear();
    _playerTournaments.clear();
    _selectedTournament = null;
    _isLoading = false;
    _error = null;
    notifyListeners();
  }
}
