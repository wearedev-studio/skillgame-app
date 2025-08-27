import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss';
import hpp from 'hpp';
import compression from 'compression';
import { body, validationResult, ValidationError } from 'express-validator';
import winston from 'winston';
import Redis from 'ioredis';
import crypto from 'crypto';

// Initialize Redis for rate limiting and security tracking
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  connectTimeout: 10000,
  commandTimeout: 5000
});

// Security logger
const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/security.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Enhanced CORS configuration
export const corsConfig = {
  origin: '*', // Allow all origins explicitly
  credentials: false, // Cannot be true when origin is '*'
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-socket-id', 'Access-Control-Allow-Origin']
};

// Enhanced Helmet configuration for security headers
export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "wss:", "ws:"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// Global rate limiter for DDOS protection
export const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/';
  },
  handler: (req, res) => {
    securityLogger.warn('Rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      timestamp: new Date()
    });
    
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: '15 minutes'
    });
  }
});

// Strict rate limiter for authentication endpoints
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 auth requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

// Admin route rate limiter
export const adminRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 100, // limit each IP to 100 admin requests per windowMs
  message: {
    error: 'Too many admin requests, please try again later.',
    retryAfter: '5 minutes'
  }
});

// Speed limiter to slow down suspicious requests
export const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 100, // allow 100 requests per 15 minutes at full speed
  delayMs: () => 500, // slow down subsequent requests by 500ms per request
  maxDelayMs: 20000, // maximum delay of 20 seconds
  validate: {
    delayMs: false // Disable the delayMs validation warning
  }
});

// Brute force protection for login attempts
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_TIME = 30 * 60 * 1000; // 30 minutes

export const bruteForcePrevention = async (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip;
  const email = req.body.email;
  
  if (!email) return next();
  
  const key = `login_attempts:${ip}:${email}`;
  
  try {
    const attempts = await redis.get(key);
    const attemptCount = attempts ? parseInt(attempts) : 0;
    
    if (attemptCount >= MAX_LOGIN_ATTEMPTS) {
      const ttl = await redis.ttl(key);
      securityLogger.warn('Brute force attempt blocked', {
        ip,
        email,
        attempts: attemptCount,
        ttl,
        timestamp: new Date()
      });
      
      return res.status(429).json({
        error: 'Account temporarily locked due to too many failed login attempts',
        retryAfter: Math.ceil(ttl / 60) + ' minutes'
      });
    }
    
    // Store the attempt count for failed logins
    res.locals.loginAttempts = {
      key,
      attempts: attemptCount,
      ip,
      email
    };
    
    next();
  } catch (error) {
    securityLogger.error('Redis error in brute force prevention', { error, ip, email });
    next(); // Continue if Redis is down
  }
};

// Track failed login attempts
export const trackFailedLogin = async (req: Request, res: Response, next: NextFunction) => {
  const originalSend = res.send;
  
  res.send = function(body) {
    const response = typeof body === 'string' ? JSON.parse(body) : body;
    
    if (res.statusCode === 401 && res.locals.loginAttempts) {
      const { key, attempts } = res.locals.loginAttempts;
      
      redis.incr(key).then(() => {
        redis.expire(key, LOCKOUT_TIME / 1000);
      }).catch(error => {
        securityLogger.error('Redis error tracking failed login', { error });
      });
      
      securityLogger.warn('Failed login attempt', {
        ip: res.locals.loginAttempts.ip,
        email: res.locals.loginAttempts.email,
        attempts: attempts + 1,
        timestamp: new Date()
      });
    } else if (res.statusCode === 200 && res.locals.loginAttempts) {
      // Successful login - clear attempts
      redis.del(res.locals.loginAttempts.key).catch(error => {
        securityLogger.error('Redis error clearing login attempts', { error });
      });
    }
    
    return originalSend.call(this, body);
  };
  
  next();
};

// XSS Protection middleware
export const xssProtection = (req: Request, res: Response, next: NextFunction) => {
  // Sanitize request body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  
  // Sanitize URL parameters
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  
  next();
};

// Recursive object sanitization
function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return xss(obj, {
      whiteList: {}, // No HTML tags allowed
      stripIgnoreTag: true,
      stripIgnoreTagBody: ['script']
    });
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }
  
  return obj;
}

// Input validation error handler
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    securityLogger.warn('Validation failed', {
      ip: req.ip,
      path: req.path,
      errors: errors.array(),
      timestamp: new Date()
    });
    
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  
  next();
};

// File upload security
export const secureFileUpload = (req: Request, res: Response, next: NextFunction) => {
  if (!req.file && !req.files) return next();
  
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf'
  ];
  
  const maxFileSize = 5 * 1024 * 1024; // 5MB
  
  const files = req.files ? (Array.isArray(req.files) ? req.files : [req.file]) : [req.file];
  
  for (const file of files) {
    if (!file) continue;
    
    // Check file size
    if (file.size > maxFileSize) {
      securityLogger.warn('File size exceeded', {
        ip: req.ip,
        filename: file.originalname,
        size: file.size,
        timestamp: new Date()
      });
      
      return res.status(413).json({
        error: 'File size too large. Maximum allowed size is 5MB.'
      });
    }
    
    // Check MIME type
    if (!allowedMimeTypes.includes(file.mimetype)) {
      securityLogger.warn('Invalid file type', {
        ip: req.ip,
        filename: file.originalname,
        mimetype: file.mimetype,
        timestamp: new Date()
      });
      
      return res.status(415).json({
        error: 'Invalid file type. Only images and PDFs are allowed.'
      });
    }
    
    // Generate secure filename
    const ext = file.originalname.split('.').pop();
    file.filename = crypto.randomBytes(16).toString('hex') + '.' + ext;
  }
  
  next();
};

// Security headers middleware
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Remove server signature
  res.removeHeader('X-Powered-By');
  
  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  next();
};

// Request logging for security monitoring
export const securityRequestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    // Log suspicious requests
    if (
      res.statusCode >= 400 ||
      duration > 10000 || // Requests taking more than 10 seconds
      req.url.includes('../') || // Path traversal attempts
      req.url.includes('script') || // Script injection attempts
      req.url.includes('union') || // SQL injection attempts
      req.url.includes('select')
    ) {
      securityLogger.warn('Suspicious request', {
        ip: req.ip,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        userAgent: req.get('User-Agent'),
        duration,
        timestamp: new Date()
      });
    }
  });
  
  next();
};

// MongoDB sanitization
export const mongoSanitization = mongoSanitize({
  replaceWith: '_',
  allowDots: false
});

// HTTP Parameter Pollution protection
export const httpParameterPollution = hpp({
  whitelist: ['tags', 'categories'] // Allow arrays for specific parameters
});

// Compression with security considerations
export const secureCompression = compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    // Don't compress if the request contains sensitive data
    if (req.headers['content-type']?.includes('multipart')) {
      return false;
    }
    return compression.filter(req, res);
  }
});

// Export securityLogger separately for named import
export { securityLogger };

export default {
  helmetConfig,
  corsConfig,
  globalRateLimit,
  authRateLimit,
  adminRateLimit,
  speedLimiter,
  bruteForcePrevention,
  trackFailedLogin,
  xssProtection,
  handleValidationErrors,
  secureFileUpload,
  securityHeaders,
  securityRequestLogger,
  mongoSanitization,
  httpParameterPollution,
  secureCompression,
  securityLogger
};