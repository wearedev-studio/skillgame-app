class User {
  final String id;
  final String username;
  final String email;
  final String avatar;
  final double balance;
  final String role; // "USER" | "ADMIN"
  final String status; // "ACTIVE" | "BANNED" | "SUSPENDED" | "PENDING"
  final String
      kycStatus; // "NOT_SUBMITTED" | "PENDING" | "APPROVED" | "REJECTED"
  final String? kycRejectionReason;
  final String kycProvider; // "LEGACY" | "SUMSUB"
  final Map<String, dynamic>? sumsubData;
  final List<KYCDocument> kycDocuments;
  final bool ageConfirmed;
  final bool termsAccepted;
  final bool privacyPolicyAccepted;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const User({
    required this.id,
    required this.username,
    required this.email,
    this.avatar = 'default_avatar.png',
    this.balance = 0.0,
    this.role = 'USER',
    this.status = 'ACTIVE',
    this.kycStatus = 'NOT_SUBMITTED',
    this.kycRejectionReason,
    this.kycProvider = 'LEGACY',
    this.sumsubData,
    this.kycDocuments = const [],
    this.ageConfirmed = false,
    this.termsAccepted = false,
    this.privacyPolicyAccepted = false,
    this.createdAt,
    this.updatedAt,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['_id'] ?? '',
      username: json['username'] ?? '',
      email: json['email'] ?? '',
      avatar: json['avatar'] ?? 'default_avatar.png',
      balance: (json['balance'] ?? 0.0).toDouble(),
      role: json['role'] ?? 'USER',
      status: json['status'] ?? 'ACTIVE',
      kycStatus: json['kycStatus'] ?? 'NOT_SUBMITTED',
      kycRejectionReason: json['kycRejectionReason'],
      kycProvider: json['kycProvider'] ?? 'LEGACY',
      sumsubData: json['sumsubData'],
      kycDocuments: json['kycDocuments'] != null
          ? List<KYCDocument>.from(
              json['kycDocuments'].map((x) => KYCDocument.fromJson(x)))
          : [],
      ageConfirmed: json['ageConfirmed'] ?? false,
      termsAccepted: json['termsAccepted'] ?? false,
      privacyPolicyAccepted: json['privacyPolicyAccepted'] ?? false,
      createdAt:
          json['createdAt'] != null ? DateTime.parse(json['createdAt']) : null,
      updatedAt:
          json['updatedAt'] != null ? DateTime.parse(json['updatedAt']) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'username': username,
      'email': email,
      'avatar': avatar,
      'balance': balance,
      'role': role,
      'status': status,
      'kycStatus': kycStatus,
      'kycRejectionReason': kycRejectionReason,
      'kycProvider': kycProvider,
      'sumsubData': sumsubData,
      'kycDocuments': kycDocuments.map((x) => x.toJson()).toList(),
      'ageConfirmed': ageConfirmed,
      'termsAccepted': termsAccepted,
      'privacyPolicyAccepted': privacyPolicyAccepted,
      'createdAt': createdAt?.toIso8601String(),
      'updatedAt': updatedAt?.toIso8601String(),
    };
  }

  User copyWith({
    String? id,
    String? username,
    String? email,
    String? avatar,
    double? balance,
    String? role,
    String? status,
    String? kycStatus,
    String? kycRejectionReason,
    String? kycProvider,
    Map<String, dynamic>? sumsubData,
    List<KYCDocument>? kycDocuments,
    bool? ageConfirmed,
    bool? termsAccepted,
    bool? privacyPolicyAccepted,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return User(
      id: id ?? this.id,
      username: username ?? this.username,
      email: email ?? this.email,
      avatar: avatar ?? this.avatar,
      balance: balance ?? this.balance,
      role: role ?? this.role,
      status: status ?? this.status,
      kycStatus: kycStatus ?? this.kycStatus,
      kycRejectionReason: kycRejectionReason ?? this.kycRejectionReason,
      kycProvider: kycProvider ?? this.kycProvider,
      sumsubData: sumsubData ?? this.sumsubData,
      kycDocuments: kycDocuments ?? this.kycDocuments,
      ageConfirmed: ageConfirmed ?? this.ageConfirmed,
      termsAccepted: termsAccepted ?? this.termsAccepted,
      privacyPolicyAccepted:
          privacyPolicyAccepted ?? this.privacyPolicyAccepted,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}

class AuthResponse {
  final String id;
  final String username;
  final String email;
  final double balance;
  final String avatar;
  final String role;
  final String token;

  const AuthResponse({
    required this.id,
    required this.username,
    required this.email,
    required this.balance,
    required this.avatar,
    required this.role,
    required this.token,
  });

  factory AuthResponse.fromJson(Map<String, dynamic> json) {
    return AuthResponse(
      id: json['_id'] ?? '',
      username: json['username'] ?? '',
      email: json['email'] ?? '',
      balance: (json['balance'] ?? 0.0).toDouble(),
      avatar: json['avatar'] ?? 'default_avatar.png',
      role: json['role'] ?? 'USER',
      token: json['token'] ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'username': username,
      'email': email,
      'balance': balance,
      'avatar': avatar,
      'role': role,
      'token': token,
    };
  }
}

class GameRecord {
  final String id;
  final String gameName;
  final String status;
  final double amountChanged;
  final String opponent;
  final DateTime createdAt;

  const GameRecord({
    required this.id,
    required this.gameName,
    required this.status,
    required this.amountChanged,
    required this.opponent,
    required this.createdAt,
  });

  factory GameRecord.fromJson(Map<String, dynamic> json) {
    return GameRecord(
      id: json['_id'] ?? '',
      gameName: json['gameName'] ?? '',
      status: json['status'] ?? '',
      amountChanged: (json['amountChanged'] ?? 0.0).toDouble(),
      opponent: json['opponent'] ?? '',
      createdAt:
          DateTime.parse(json['createdAt'] ?? DateTime.now().toIso8601String()),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'gameName': gameName,
      'status': status,
      'amountChanged': amountChanged,
      'opponent': opponent,
      'createdAt': createdAt.toIso8601String(),
    };
  }
}

class Transaction {
  final String id;
  final String type;
  final double amount;
  final String status;
  final DateTime createdAt;

  const Transaction({
    required this.id,
    required this.type,
    required this.amount,
    required this.status,
    required this.createdAt,
  });

  factory Transaction.fromJson(Map<String, dynamic> json) {
    return Transaction(
      id: json['_id'] ?? '',
      type: json['type'] ?? '',
      amount: (json['amount'] ?? 0.0).toDouble(),
      status: json['status'] ?? '',
      createdAt:
          DateTime.parse(json['createdAt'] ?? DateTime.now().toIso8601String()),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'type': type,
      'amount': amount,
      'status': status,
      'createdAt': createdAt.toIso8601String(),
    };
  }
}

/// KYC Document model согласно API документации
class KYCDocument {
  final String
      documentType; // "PASSPORT" | "UTILITY_BILL" | "INTERNATIONAL_PASSPORT" | "RESIDENCE_PERMIT"
  final String filePath;
  final DateTime submittedAt;
  final bool? mockData;

  const KYCDocument({
    required this.documentType,
    required this.filePath,
    required this.submittedAt,
    this.mockData,
  });

  factory KYCDocument.fromJson(Map<String, dynamic> json) {
    return KYCDocument(
      documentType: json['documentType'] ?? '',
      filePath: json['filePath'] ?? '',
      submittedAt: DateTime.parse(
          json['submittedAt'] ?? DateTime.now().toIso8601String()),
      mockData: json['mockData'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'documentType': documentType,
      'filePath': filePath,
      'submittedAt': submittedAt.toIso8601String(),
      'mockData': mockData,
    };
  }
}

/// Константы для пользователей согласно API
class UserRole {
  static const String user = 'USER';
  static const String admin = 'ADMIN';
}

class UserStatus {
  static const String active = 'ACTIVE';
  static const String banned = 'BANNED';
  static const String suspended = 'SUSPENDED';
  static const String pending = 'PENDING';
}

class KYCStatus {
  static const String notSubmitted = 'NOT_SUBMITTED';
  static const String pending = 'PENDING';
  static const String approved = 'APPROVED';
  static const String rejected = 'REJECTED';
}

class KYCProvider {
  static const String legacy = 'LEGACY';
  static const String sumsub = 'SUMSUB';
}

class DocumentType {
  static const String passport = 'PASSPORT';
  static const String utilityBill = 'UTILITY_BILL';
  static const String internationalPassport = 'INTERNATIONAL_PASSPORT';
  static const String residencePermit = 'RESIDENCE_PERMIT';
}
