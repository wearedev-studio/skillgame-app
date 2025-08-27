import 'dart:async';
import 'package:flutter/material.dart';
import 'package:skillgame_flutter/models/kyc_model.dart';
import 'package:skillgame_flutter/services/websocket_service.dart';

class KycProvider extends ChangeNotifier {
  KycData? _kycData;
  SumsubConfig? _sumsubConfig;
  bool _isLoading = false;
  String? _error;

  final WebSocketService _webSocketService;

  KycData? get kycData => _kycData;
  SumsubConfig? get sumsubConfig => _sumsubConfig;
  bool get isLoading => _isLoading;
  String? get error => _error;

  bool get isVerificationRequired => _kycData?.isNotSubmitted ?? true;
  bool get isVerificationPending => _kycData?.isPending ?? false;
  bool get isVerificationApproved => _kycData?.isApproved ?? false;
  bool get isVerificationRejected => _kycData?.isRejected ?? false;
  bool get requiresReview => _kycData?.requiresReview ?? false;

  KycProvider(this._webSocketService) {
    _setupWebSocketListeners();
  }

  void _setupWebSocketListeners() {
    _webSocketService.onKycVerificationStarted = (data) {
      _handleKycVerificationStarted(data);
    };

    _webSocketService.onKycVerificationCompleted = (data) {
      _handleKycVerificationCompleted(data);
    };

    _webSocketService.onKycVerificationFailed = (data) {
      _handleKycVerificationFailed(data);
    };

    _webSocketService.onKycDocumentUploaded = (data) {
      _handleKycDocumentUploaded(data);
    };
  }

  Future<void> loadKycData(String token) async {
    _setLoading(true);
    _clearError();

    try {
      // Для демонстрации используем локальные данные
      // В реальном приложении это будет вызов API
      // Создаем дефолтные данные для демонстрации
      _kycData = KycData(
        id: 'default_kyc',
        userId: 'current_user',
        status: KycStatus.notSubmitted,
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );
      notifyListeners();
    } finally {
      _setLoading(false);
    }
  }

  Future<SumsubConfig?> initiateSumsubVerification(String token) async {
    _setLoading(true);
    _clearError();

    try {
      // Для демонстрации создаем тестовую конфигурацию
      _sumsubConfig = SumsubConfig(
        accessToken: 'test_access_token',
        sdkToken: 'test_sdk_token',
        applicantId: 'test_applicant_id',
        externalUserId: 'current_user',
        config: {
          'lang': 'en',
          'email': 'user@example.com',
          'phone': '+1234567890',
        },
      );

      if (_kycData != null) {
        _kycData = KycData(
          id: _kycData!.id,
          userId: _kycData!.userId,
          status: KycStatus.pending,
          applicantId: _sumsubConfig!.applicantId,
          accessToken: _sumsubConfig!.accessToken,
          sdkToken: _sumsubConfig!.sdkToken,
          externalUserId: _sumsubConfig!.externalUserId,
          personalInfo: _kycData!.personalInfo,
          documents: _kycData!.documents,
          rejectionReason: null,
          createdAt: _kycData!.createdAt,
          updatedAt: DateTime.now(),
          submittedAt: DateTime.now(),
          approvedAt: null,
          rejectedAt: null,
        );
      }

      notifyListeners();
      return _sumsubConfig;
    } finally {
      _setLoading(false);
    }
  }

  Future<bool> submitPersonalInfo(
    String token,
    Map<String, dynamic> personalInfo,
  ) async {
    _setLoading(true);
    _clearError();

    try {
      // Для демонстрации используем локальное обновление
      final response = {'success': true};
      if (response != null) {
        // Обновляем данные KYC
        if (_kycData != null) {
          _kycData = KycData(
            id: _kycData!.id,
            userId: _kycData!.userId,
            status: _kycData!.status,
            applicantId: _kycData!.applicantId,
            inspectionId: _kycData!.inspectionId,
            externalUserId: _kycData!.externalUserId,
            accessToken: _kycData!.accessToken,
            sdkToken: _kycData!.sdkToken,
            personalInfo: personalInfo,
            documents: _kycData!.documents,
            rejectionReason: _kycData!.rejectionReason,
            createdAt: _kycData!.createdAt,
            updatedAt: DateTime.now(),
            submittedAt: _kycData!.submittedAt,
            approvedAt: _kycData!.approvedAt,
            rejectedAt: _kycData!.rejectedAt,
          );
        }

        notifyListeners();
        return true;
      }
      return false;
    } catch (e) {
      _setError('Failed to submit personal info: ${e.toString()}');
      return false;
    } finally {
      _setLoading(false);
    }
  }

  Future<bool> uploadDocument(
    String token,
    String documentType,
    String filePath,
  ) async {
    _setLoading(true);
    _clearError();

    try {
      // Для демонстрации используем локальное обновление
      final response = {'success': true};
      if (response != null) {
        // Добавляем документ в список
        final document = KycDocument(
          id: DateTime.now().millisecondsSinceEpoch.toString(),
          type: documentType,
          status: DocumentStatus.pending,
          fileName: filePath.split('/').last,
          uploadedAt: DateTime.now(),
        );

        if (_kycData != null) {
          final updatedDocuments = List<KycDocument>.from(_kycData!.documents);
          updatedDocuments.add(document);

          _kycData = KycData(
            id: _kycData!.id,
            userId: _kycData!.userId,
            status: _kycData!.status,
            applicantId: _kycData!.applicantId,
            inspectionId: _kycData!.inspectionId,
            externalUserId: _kycData!.externalUserId,
            accessToken: _kycData!.accessToken,
            sdkToken: _kycData!.sdkToken,
            personalInfo: _kycData!.personalInfo,
            documents: updatedDocuments,
            rejectionReason: _kycData!.rejectionReason,
            createdAt: _kycData!.createdAt,
            updatedAt: DateTime.now(),
            submittedAt: _kycData!.submittedAt,
            approvedAt: _kycData!.approvedAt,
            rejectedAt: _kycData!.rejectedAt,
          );
        }

        notifyListeners();
        return true;
      }
      return false;
    } catch (e) {
      _setError('Failed to upload document: ${e.toString()}');
      return false;
    } finally {
      _setLoading(false);
    }
  }

  Future<bool> checkVerificationStatus(String token) async {
    try {
      // Для демонстрации возвращаем текущий статус
      return true;
    } catch (e) {
      _setError('Failed to check verification status: ${e.toString()}');
      return false;
    }
  }

  void _handleKycVerificationStarted(Map<String, dynamic> data) {
    try {
      if (_kycData != null) {
        _kycData = KycData(
          id: _kycData!.id,
          userId: _kycData!.userId,
          status: KycStatus.pending,
          applicantId: _kycData!.applicantId,
          inspectionId: data['inspectionId'] as String?,
          externalUserId: _kycData!.externalUserId,
          accessToken: _kycData!.accessToken,
          sdkToken: _kycData!.sdkToken,
          personalInfo: _kycData!.personalInfo,
          documents: _kycData!.documents,
          rejectionReason: null,
          createdAt: _kycData!.createdAt,
          updatedAt: DateTime.now(),
          submittedAt: DateTime.now(),
          approvedAt: null,
          rejectedAt: null,
        );
        notifyListeners();
      }
    } catch (e) {
      print('Error handling KYC verification started: $e');
    }
  }

  void _handleKycVerificationCompleted(Map<String, dynamic> data) {
    try {
      if (_kycData != null) {
        _kycData = KycData(
          id: _kycData!.id,
          userId: _kycData!.userId,
          status: KycStatus.approved,
          applicantId: _kycData!.applicantId,
          inspectionId: _kycData!.inspectionId,
          externalUserId: _kycData!.externalUserId,
          accessToken: _kycData!.accessToken,
          sdkToken: _kycData!.sdkToken,
          personalInfo: _kycData!.personalInfo,
          documents: _kycData!.documents,
          rejectionReason: null,
          createdAt: _kycData!.createdAt,
          updatedAt: DateTime.now(),
          submittedAt: _kycData!.submittedAt,
          approvedAt: DateTime.now(),
          rejectedAt: null,
        );
        notifyListeners();
      }
    } catch (e) {
      print('Error handling KYC verification completed: $e');
    }
  }

  void _handleKycVerificationFailed(Map<String, dynamic> data) {
    try {
      final rejectionReason = data['reason'] as String?;
      if (_kycData != null) {
        _kycData = KycData(
          id: _kycData!.id,
          userId: _kycData!.userId,
          status: KycStatus.rejected,
          applicantId: _kycData!.applicantId,
          inspectionId: _kycData!.inspectionId,
          externalUserId: _kycData!.externalUserId,
          accessToken: _kycData!.accessToken,
          sdkToken: _kycData!.sdkToken,
          personalInfo: _kycData!.personalInfo,
          documents: _kycData!.documents,
          rejectionReason: rejectionReason,
          createdAt: _kycData!.createdAt,
          updatedAt: DateTime.now(),
          submittedAt: _kycData!.submittedAt,
          approvedAt: null,
          rejectedAt: DateTime.now(),
        );
        notifyListeners();
      }
    } catch (e) {
      print('Error handling KYC verification failed: $e');
    }
  }

  void _handleKycDocumentUploaded(Map<String, dynamic> data) {
    try {
      final documentData = data['document'] as Map<String, dynamic>?;
      if (documentData != null && _kycData != null) {
        final document = KycDocument.fromJson(documentData);
        final updatedDocuments = List<KycDocument>.from(_kycData!.documents);

        // Обновляем существующий документ или добавляем новый
        final existingIndex =
            updatedDocuments.indexWhere((d) => d.id == document.id);
        if (existingIndex != -1) {
          updatedDocuments[existingIndex] = document;
        } else {
          updatedDocuments.add(document);
        }

        _kycData = KycData(
          id: _kycData!.id,
          userId: _kycData!.userId,
          status: _kycData!.status,
          applicantId: _kycData!.applicantId,
          inspectionId: _kycData!.inspectionId,
          externalUserId: _kycData!.externalUserId,
          accessToken: _kycData!.accessToken,
          sdkToken: _kycData!.sdkToken,
          personalInfo: _kycData!.personalInfo,
          documents: updatedDocuments,
          rejectionReason: _kycData!.rejectionReason,
          createdAt: _kycData!.createdAt,
          updatedAt: DateTime.now(),
          submittedAt: _kycData!.submittedAt,
          approvedAt: _kycData!.approvedAt,
          rejectedAt: _kycData!.rejectedAt,
        );
        notifyListeners();
      }
    } catch (e) {
      print('Error handling KYC document uploaded: $e');
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
    _kycData = null;
    _sumsubConfig = null;
    _isLoading = false;
    _error = null;
    notifyListeners();
  }

  // Демонстрационные методы
  void simulateApproval() {
    if (_kycData != null) {
      _kycData = KycData(
        id: _kycData!.id,
        userId: _kycData!.userId,
        status: KycStatus.approved,
        applicantId: _kycData!.applicantId,
        inspectionId: _kycData!.inspectionId,
        externalUserId: _kycData!.externalUserId,
        accessToken: _kycData!.accessToken,
        sdkToken: _kycData!.sdkToken,
        personalInfo: _kycData!.personalInfo,
        documents: _kycData!.documents,
        rejectionReason: null,
        createdAt: _kycData!.createdAt,
        updatedAt: DateTime.now(),
        submittedAt: _kycData!.submittedAt,
        approvedAt: DateTime.now(),
        rejectedAt: null,
      );
      notifyListeners();
    }
  }

  void simulateRejection(String reason) {
    if (_kycData != null) {
      _kycData = KycData(
        id: _kycData!.id,
        userId: _kycData!.userId,
        status: KycStatus.rejected,
        applicantId: _kycData!.applicantId,
        inspectionId: _kycData!.inspectionId,
        externalUserId: _kycData!.externalUserId,
        accessToken: _kycData!.accessToken,
        sdkToken: _kycData!.sdkToken,
        personalInfo: _kycData!.personalInfo,
        documents: _kycData!.documents,
        rejectionReason: reason,
        createdAt: _kycData!.createdAt,
        updatedAt: DateTime.now(),
        submittedAt: _kycData!.submittedAt,
        approvedAt: null,
        rejectedAt: DateTime.now(),
      );
      notifyListeners();
    }
  }
}
