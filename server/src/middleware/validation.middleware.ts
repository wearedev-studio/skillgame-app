import { body, param, query, ValidationChain } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { handleValidationErrors } from './security.middleware';

// ========== USER VALIDATION SCHEMAS ==========

export const validateUserRegistration: ValidationChain[] = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores')
    .custom(async (value) => {
      // Check for reserved usernames
      const reserved = ['admin', 'administrator', 'root', 'system', 'support', 'api', 'null', 'undefined'];
      if (reserved.includes(value.toLowerCase())) {
        throw new Error('Username is reserved');
      }
      return true;
    }),

  body('email')
    .trim()
    .normalizeEmail()
    .isEmail()
    .withMessage('Valid email is required')
    .isLength({ max: 255 })
    .withMessage('Email too long'),

  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'),

  body('referralCode')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Referral code too long')
    .matches(/^[a-zA-Z0-9]+$/)
    .withMessage('Invalid referral code format')
];

export const validateUserLogin: ValidationChain[] = [
  body('email')
    .trim()
    .normalizeEmail()
    .isEmail()
    .withMessage('Valid email is required'),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ max: 128 })
    .withMessage('Password too long')
];

export const validateUserUpdate: ValidationChain[] = [
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),

  body('email')
    .optional()
    .trim()
    .normalizeEmail()
    .isEmail()
    .withMessage('Valid email is required'),

  body('firstName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('First name too long')
    .matches(/^[a-zA-ZÀ-ÿ\s]+$/)
    .withMessage('First name can only contain letters and spaces'),

  body('lastName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Last name too long')
    .matches(/^[a-zA-ZÀ-ÿ\s]+$/)
    .withMessage('Last name can only contain letters and spaces'),

  body('phone')
    .optional()
    .trim()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Invalid phone number format'),

  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format')
    .custom((value) => {
      const birthDate = new Date(value);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      
      if (age < 18 || age > 120) {
        throw new Error('User must be between 18 and 120 years old');
      }
      return true;
    })
];

// ========== TOURNAMENT VALIDATION SCHEMAS ==========

export const validateTournamentCreation: ValidationChain[] = [
  body('name')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Tournament name must be between 3 and 100 characters')
    .matches(/^[a-zA-Z0-9\s\-_().]+$/)
    .withMessage('Tournament name contains invalid characters'),

  body('gameType')
    .isIn(['tic-tac-toe', 'checkers', 'chess', 'backgammon', 'durak', 'domino', 'dice', 'bingo'])
    .withMessage('Invalid game type'),

  body('entryFee')
    .isFloat({ min: 0, max: 10000 })
    .withMessage('Entry fee must be between 0 and 10000')
    .toFloat(),

  body('maxPlayers')
    .isInt({ min: 2, max: 128 })
    .withMessage('Max players must be between 2 and 128')
    .toInt(),

  body('startTime')
    .isISO8601()
    .withMessage('Invalid start time format')
    .custom((value) => {
      const startTime = new Date(value);
      const now = new Date();
      
      if (startTime <= now) {
        throw new Error('Start time must be in the future');
      }
      
      const maxFuture = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year
      if (startTime > maxFuture) {
        throw new Error('Start time too far in the future');
      }
      
      return true;
    }),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description too long'),

  body('prizes')
    .optional()
    .isArray({ max: 10 })
    .withMessage('Too many prize tiers'),

  body('prizes.*')
    .optional()
    .isFloat({ min: 0, max: 1000000 })
    .withMessage('Invalid prize amount')
];

// ========== PAYMENT VALIDATION SCHEMAS ==========

export const validatePaymentRequest: ValidationChain[] = [
  body('amount')
    .isFloat({ min: 1, max: 100000 })
    .withMessage('Payment amount must be between 1 and 100000')
    .toFloat(),

  body('currency')
    .optional()
    .isIn(['USD', 'EUR', 'RUB'])
    .withMessage('Unsupported currency'),

  body('paymentMethod')
    .isIn(['card', 'bank_transfer', 'crypto', 'e_wallet'])
    .withMessage('Invalid payment method'),

  body('returnUrl')
    .optional()
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('Invalid return URL'),

  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object')
    .custom((value) => {
      const str = JSON.stringify(value);
      if (str.length > 1000) {
        throw new Error('Metadata too large');
      }
      return true;
    })
];

// ========== CHAT VALIDATION SCHEMAS ==========

export const validateChatMessage: ValidationChain[] = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message must be between 1 and 1000 characters')
    .custom((value) => {
      // Check for spam patterns
      const spamPatterns = [
        /(.)\1{10,}/, // Repeated characters
        /^.{1,3}$/g, // Too short repetitive messages
        /(http|https|www|\.com|\.net|\.org)/i // URLs (if not allowed)
      ];
      
      for (const pattern of spamPatterns) {
        if (pattern.test(value)) {
          throw new Error('Message contains prohibited content');
        }
      }
      return true;
    }),

  body('chatId')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Invalid chat ID'),

  body('guestInfo.name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Guest name must be between 1 and 50 characters')
    .matches(/^[a-zA-ZÀ-ÿ\s]+$/)
    .withMessage('Guest name can only contain letters and spaces')
];

// ========== ADMIN VALIDATION SCHEMAS ==========

export const validateAdminUserUpdate: ValidationChain[] = [
  param('userId')
    .isMongoId()
    .withMessage('Invalid user ID'),

  body('role')
    .optional()
    .isIn(['USER', 'ADMIN', 'MODERATOR'])
    .withMessage('Invalid role'),

  body('status')
    .optional()
    .isIn(['ACTIVE', 'BANNED', 'SUSPENDED', 'PENDING'])
    .withMessage('Invalid status'),

  body('balance')
    .optional()
    .isFloat({ min: 0, max: 1000000 })
    .withMessage('Balance must be between 0 and 1000000'),

  body('kycStatus')
    .optional()
    .isIn(['PENDING', 'APPROVED', 'REJECTED'])
    .withMessage('Invalid KYC status'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes too long')
];

// ========== FILE UPLOAD VALIDATION ==========

export const validateFileUpload = (req: Request, res: Response, next: NextFunction) => {
  if (!req.file && !req.files) {
    return res.status(400).json({
      error: 'No file uploaded'
    });
  }

  let file: Express.Multer.File;
  
  if (req.file) {
    file = req.file;
  } else if (req.files) {
    if (Array.isArray(req.files)) {
      file = req.files[0];
    } else {
      // Handle case where req.files is an object
      const filesArray = Object.values(req.files).flat();
      file = filesArray[0];
    }
  }
  
  if (!file!) {
    return res.status(400).json({
      error: 'Invalid file'
    });
  }

  // Additional file validation
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf'];
  const fileExtension = file.originalname.toLowerCase().split('.').pop();
  
  if (!fileExtension || !allowedExtensions.includes('.' + fileExtension)) {
    return res.status(400).json({
      error: 'Invalid file extension. Allowed: ' + allowedExtensions.join(', ')
    });
  }

  // Check for dangerous file names
  const dangerousPatterns = [
    /\.\./,          // Directory traversal
    /[<>:"|?*]/,     // Invalid filename characters
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i, // Windows reserved names
    /^\./,           // Hidden files
    /\.(exe|bat|cmd|scr|pif|com|js|jar|php|asp|aspx|jsp)$/i // Executable files
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(file.originalname)) {
      return res.status(400).json({
        error: 'Invalid filename'
      });
    }
  }

  next();
};

// ========== QUERY PARAMETER VALIDATION ==========

export const validatePagination: ValidationChain[] = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage('Page must be between 1 and 10000')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),

  query('sort')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'name', 'email', 'balance', 'status'])
    .withMessage('Invalid sort field'),

  query('order')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Order must be asc or desc')
];

export const validateSearch: ValidationChain[] = [
  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters')
    .matches(/^[a-zA-Z0-9\s\-_@.]+$/)
    .withMessage('Search query contains invalid characters')
];

// ========== ID PARAMETER VALIDATION ==========

export const validateMongoId: ValidationChain[] = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ID format')
];

export const validateUserId: ValidationChain[] = [
  param('userId')
    .isMongoId()
    .withMessage('Invalid user ID format')
];

export const validateTournamentId: ValidationChain[] = [
  param('tournamentId')
    .isMongoId()
    .withMessage('Invalid tournament ID format')
];

// ========== COMBINED VALIDATION MIDDLEWARE ==========

export const validate = (validations: ValidationChain[]) => {
  return [...validations, handleValidationErrors];
};

// ========== RATE LIMITING BY CONTENT ==========

export const validateNonSpam = (req: Request, res: Response, next: NextFunction) => {
  const content = req.body.content || req.body.message || '';
  const ip = req.ip;
  
  // Simple spam detection
  const suspiciousPatterns = [
    /(.)\1{20,}/, // Too many repeated characters
    /(buy|sell|cheap|free|money|win|prize|lottery|casino)/i, // Spam keywords
    /[A-Z]{10,}/, // Too many caps
    /\d{10,}/, // Too many numbers
    /(http|https|www)/i // URLs in messages
  ];

  let spamScore = 0;
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(content)) {
      spamScore++;
    }
  }

  if (spamScore >= 2) {
    return res.status(429).json({
      error: 'Content flagged as potential spam',
      code: 'SPAM_DETECTED'
    });
  }

  next();
};

export default {
  validateUserRegistration,
  validateUserLogin,
  validateUserUpdate,
  validateTournamentCreation,
  validatePaymentRequest,
  validateChatMessage,
  validateAdminUserUpdate,
  validateFileUpload,
  validatePagination,
  validateSearch,
  validateMongoId,
  validateUserId,
  validateTournamentId,
  validate,
  validateNonSpam
};