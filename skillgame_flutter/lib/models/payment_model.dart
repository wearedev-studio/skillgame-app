class Payment {
  final String id;
  final String userId;
  final String type;
  final double amount;
  final String currency;
  final String status;
  final String? paymentMethod;
  final String? externalTransactionId;
  final Map<String, dynamic>? metadata;
  final String? errorMessage;
  final DateTime createdAt;
  final DateTime? completedAt;

  const Payment({
    required this.id,
    required this.userId,
    required this.type,
    required this.amount,
    this.currency = 'USD',
    required this.status,
    this.paymentMethod,
    this.externalTransactionId,
    this.metadata,
    this.errorMessage,
    required this.createdAt,
    this.completedAt,
  });

  factory Payment.fromJson(Map<String, dynamic> json) {
    return Payment(
      id: json['_id'] ?? '',
      userId: json['userId'] ?? '',
      type: json['type'] ?? '',
      amount: (json['amount'] ?? 0.0).toDouble(),
      currency: json['currency'] ?? 'USD',
      status: json['status'] ?? '',
      paymentMethod: json['paymentMethod'],
      externalTransactionId: json['externalTransactionId'],
      metadata: json['metadata'],
      errorMessage: json['errorMessage'],
      createdAt:
          DateTime.parse(json['createdAt'] ?? DateTime.now().toIso8601String()),
      completedAt: json['completedAt'] != null
          ? DateTime.parse(json['completedAt'])
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'userId': userId,
      'type': type,
      'amount': amount,
      'currency': currency,
      'status': status,
      'paymentMethod': paymentMethod,
      'externalTransactionId': externalTransactionId,
      'metadata': metadata,
      'errorMessage': errorMessage,
      'createdAt': createdAt.toIso8601String(),
      'completedAt': completedAt?.toIso8601String(),
    };
  }

  bool get isPending => status == PaymentStatus.pending;
  bool get isCompleted => status == PaymentStatus.completed;
  bool get isFailed => status == PaymentStatus.failed;
  bool get isDeposit => type == PaymentType.deposit;
  bool get isWithdrawal => type == PaymentType.withdrawal;
}

class DepositRequest {
  final double amount;
  final String method;
  final Map<String, dynamic>? additionalData;

  const DepositRequest({
    required this.amount,
    required this.method,
    this.additionalData,
  });

  Map<String, dynamic> toJson() {
    return {
      'amount': amount,
      'method': method,
      'additionalData': additionalData,
    };
  }
}

class WithdrawalRequest {
  final double amount;
  final Map<String, dynamic> paymentDetails;

  const WithdrawalRequest({
    required this.amount,
    required this.paymentDetails,
  });

  Map<String, dynamic> toJson() {
    return {
      'amount': amount,
      'paymentDetails': paymentDetails,
    };
  }
}

class PaymentMethod {
  final String id;
  final String name;
  final String type;
  final bool isEnabled;
  final double? minAmount;
  final double? maxAmount;
  final double? fee;
  final String? description;
  final Map<String, dynamic>? config;

  const PaymentMethod({
    required this.id,
    required this.name,
    required this.type,
    this.isEnabled = true,
    this.minAmount,
    this.maxAmount,
    this.fee,
    this.description,
    this.config,
  });

  factory PaymentMethod.fromJson(Map<String, dynamic> json) {
    return PaymentMethod(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      type: json['type'] ?? '',
      isEnabled: json['isEnabled'] ?? true,
      minAmount: json['minAmount']?.toDouble(),
      maxAmount: json['maxAmount']?.toDouble(),
      fee: json['fee']?.toDouble(),
      description: json['description'],
      config: json['config'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'type': type,
      'isEnabled': isEnabled,
      'minAmount': minAmount,
      'maxAmount': maxAmount,
      'fee': fee,
      'description': description,
      'config': config,
    };
  }
}

// Константы для типов платежей
class PaymentType {
  static const String deposit = 'DEPOSIT';
  static const String withdrawal = 'WITHDRAWAL';
  static const String refund = 'REFUND';
  static const String fee = 'FEE';
}

// Константы для статусов платежей
class PaymentStatus {
  static const String pending = 'PENDING';
  static const String processing = 'PROCESSING';
  static const String completed = 'COMPLETED';
  static const String failed = 'FAILED';
  static const String cancelled = 'CANCELLED';
  static const String refunded = 'REFUNDED';
}

// Константы для методов платежей
class PaymentMethodType {
  static const String creditCard = 'CREDIT_CARD';
  static const String bankTransfer = 'BANK_TRANSFER';
  static const String paypal = 'PAYPAL';
  static const String cryptocurrency = 'CRYPTOCURRENCY';
  static const String g2pay = 'G2PAY';
}
