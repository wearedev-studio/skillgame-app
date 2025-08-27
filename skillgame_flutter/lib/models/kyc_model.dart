class KycData {
  final String id;
  final String userId;
  final String status;
  final String? applicantId;
  final String? inspectionId;
  final String? externalUserId;
  final String? accessToken;
  final String? sdkToken;
  final Map<String, dynamic>? personalInfo;
  final List<KycDocument> documents;
  final String? rejectionReason;
  final DateTime createdAt;
  final DateTime updatedAt;
  final DateTime? submittedAt;
  final DateTime? approvedAt;
  final DateTime? rejectedAt;

  const KycData({
    required this.id,
    required this.userId,
    required this.status,
    this.applicantId,
    this.inspectionId,
    this.externalUserId,
    this.accessToken,
    this.sdkToken,
    this.personalInfo,
    this.documents = const [],
    this.rejectionReason,
    required this.createdAt,
    required this.updatedAt,
    this.submittedAt,
    this.approvedAt,
    this.rejectedAt,
  });

  factory KycData.fromJson(Map<String, dynamic> json) {
    return KycData(
      id: json['_id'] ?? '',
      userId: json['userId'] ?? '',
      status: json['status'] ?? KycStatus.notSubmitted,
      applicantId: json['applicantId'],
      inspectionId: json['inspectionId'],
      externalUserId: json['externalUserId'],
      accessToken: json['accessToken'],
      sdkToken: json['sdkToken'],
      personalInfo: json['personalInfo'],
      documents: (json['documents'] as List<dynamic>?)
              ?.map((d) => KycDocument.fromJson(d))
              .toList() ??
          [],
      rejectionReason: json['rejectionReason'],
      createdAt:
          DateTime.parse(json['createdAt'] ?? DateTime.now().toIso8601String()),
      updatedAt:
          DateTime.parse(json['updatedAt'] ?? DateTime.now().toIso8601String()),
      submittedAt: json['submittedAt'] != null
          ? DateTime.parse(json['submittedAt'])
          : null,
      approvedAt: json['approvedAt'] != null
          ? DateTime.parse(json['approvedAt'])
          : null,
      rejectedAt: json['rejectedAt'] != null
          ? DateTime.parse(json['rejectedAt'])
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'userId': userId,
      'status': status,
      'applicantId': applicantId,
      'inspectionId': inspectionId,
      'externalUserId': externalUserId,
      'accessToken': accessToken,
      'sdkToken': sdkToken,
      'personalInfo': personalInfo,
      'documents': documents.map((d) => d.toJson()).toList(),
      'rejectionReason': rejectionReason,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
      'submittedAt': submittedAt?.toIso8601String(),
      'approvedAt': approvedAt?.toIso8601String(),
      'rejectedAt': rejectedAt?.toIso8601String(),
    };
  }

  bool get isNotSubmitted => status == KycStatus.notSubmitted;
  bool get isPending => status == KycStatus.pending;
  bool get isApproved => status == KycStatus.approved;
  bool get isRejected => status == KycStatus.rejected;
  bool get requiresReview => status == KycStatus.review;
}

class KycDocument {
  final String id;
  final String type;
  final String status;
  final String? fileName;
  final String? fileUrl;
  final String? rejectionReason;
  final DateTime uploadedAt;

  const KycDocument({
    required this.id,
    required this.type,
    required this.status,
    this.fileName,
    this.fileUrl,
    this.rejectionReason,
    required this.uploadedAt,
  });

  factory KycDocument.fromJson(Map<String, dynamic> json) {
    return KycDocument(
      id: json['_id'] ?? '',
      type: json['type'] ?? '',
      status: json['status'] ?? DocumentStatus.pending,
      fileName: json['fileName'],
      fileUrl: json['fileUrl'],
      rejectionReason: json['rejectionReason'],
      uploadedAt: DateTime.parse(
          json['uploadedAt'] ?? DateTime.now().toIso8601String()),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'type': type,
      'status': status,
      'fileName': fileName,
      'fileUrl': fileUrl,
      'rejectionReason': rejectionReason,
      'uploadedAt': uploadedAt.toIso8601String(),
    };
  }

  bool get isApproved => status == DocumentStatus.approved;
  bool get isRejected => status == DocumentStatus.rejected;
  bool get isPending => status == DocumentStatus.pending;
}

class SumsubConfig {
  final String accessToken;
  final String? sdkToken;
  final String? applicantId;
  final String? externalUserId;
  final Map<String, dynamic>? config;

  const SumsubConfig({
    required this.accessToken,
    this.sdkToken,
    this.applicantId,
    this.externalUserId,
    this.config,
  });

  factory SumsubConfig.fromJson(Map<String, dynamic> json) {
    return SumsubConfig(
      accessToken: json['accessToken'] ?? '',
      sdkToken: json['sdkToken'],
      applicantId: json['applicantId'],
      externalUserId: json['externalUserId'],
      config: json['config'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'accessToken': accessToken,
      'sdkToken': sdkToken,
      'applicantId': applicantId,
      'externalUserId': externalUserId,
      'config': config,
    };
  }
}

// Константы для статусов KYC
class KycStatus {
  static const String notSubmitted = 'NOT_SUBMITTED';
  static const String pending = 'PENDING';
  static const String review = 'REVIEW';
  static const String approved = 'APPROVED';
  static const String rejected = 'REJECTED';
}

// Константы для типов документов
class DocumentType {
  static const String passport = 'PASSPORT';
  static const String drivingLicense = 'DRIVING_LICENSE';
  static const String nationalId = 'NATIONAL_ID';
  static const String utilityBill = 'UTILITY_BILL';
  static const String bankStatement = 'BANK_STATEMENT';
  static const String selfie = 'SELFIE';
}

// Константы для статусов документов
class DocumentStatus {
  static const String pending = 'PENDING';
  static const String approved = 'APPROVED';
  static const String rejected = 'REJECTED';
  static const String expired = 'EXPIRED';
}
