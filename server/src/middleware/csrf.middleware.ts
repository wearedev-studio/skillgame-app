import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { securityLogger } from './security.middleware';

// CSRF token store (in production, use Redis)
const csrfTokenStore = new Map<string, { token: string, expires: number, used: boolean }>();

// CSRF configuration
const CSRF_CONFIG = {
  TOKEN_LENGTH: 32,
  TOKEN_EXPIRY: 1000 * 60 * 60, // 1 hour
  HEADER_NAME: 'x-csrf-token',
  COOKIE_NAME: 'csrf-token',
  SAFE_METHODS: ['GET', 'HEAD', 'OPTIONS'],
  CLEANUP_INTERVAL: 1000 * 60 * 5 // 5 minutes
};

// Generate CSRF token
export const generateCSRFToken = (): string => {
  return crypto.randomBytes(CSRF_CONFIG.TOKEN_LENGTH).toString('hex');
};

// Store CSRF token
const storeCSRFToken = (sessionId: string, token: string): void => {
  csrfTokenStore.set(sessionId, {
    token,
    expires: Date.now() + CSRF_CONFIG.TOKEN_EXPIRY,
    used: false
  });
};

// Validate CSRF token
const validateCSRFToken = (sessionId: string, token: string): boolean => {
  const storedToken = csrfTokenStore.get(sessionId);
  
  if (!storedToken) {
    return false;
  }
  
  // Check if token is expired
  if (Date.now() > storedToken.expires) {
    csrfTokenStore.delete(sessionId);
    return false;
  }
  
  // Check if token matches
  if (storedToken.token !== token) {
    return false;
  }
  
  // Mark token as used (one-time use)
  storedToken.used = true;
  
  return true;
};

// CSRF protection middleware
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  const method = req.method.toUpperCase();
  const sessionId = req.sessionId || req.ip || 'unknown'; // Fallback to IP if no session
  
  // Skip CSRF protection for safe methods
  if (CSRF_CONFIG.SAFE_METHODS.includes(method)) {
    return next();
  }
  
  // Skip CSRF protection for API endpoints that use other authentication
  if (req.path.includes('/api/payments/webhook')) {
    return next();
  }
  
  // Get CSRF token from headers or body
  const token = req.get(CSRF_CONFIG.HEADER_NAME) ||
                req.body.csrfToken ||
                req.query.csrfToken;
  
  if (!token) {
    securityLogger.warn('CSRF token missing', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method,
      sessionId,
      timestamp: new Date()
    });
    
    return res.status(403).json({
      error: 'CSRF token required',
      code: 'CSRF_TOKEN_MISSING'
    });
  }
  
  // Validate CSRF token
  if (!validateCSRFToken(sessionId, token as string)) {
    securityLogger.warn('Invalid CSRF token', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method,
      sessionId,
      providedToken: token,
      timestamp: new Date()
    });
    
    return res.status(403).json({
      error: 'Invalid CSRF token',
      code: 'CSRF_TOKEN_INVALID'
    });
  }
  
  next();
};

// Middleware to provide CSRF token
export const provideCSRFToken = (req: Request, res: Response, next: NextFunction) => {
  const sessionId = req.sessionId || req.ip || 'unknown';
  const token = generateCSRFToken();
  
  // Store token
  storeCSRFToken(sessionId, token);
  
  // Add token to response headers
  res.setHeader('X-CSRF-Token', token);
  
  // Add token to response locals for template rendering
  res.locals.csrfToken = token;
  
  next();
};

// Cleanup expired tokens
const cleanupExpiredTokens = (): void => {
  const now = Date.now();
  for (const [sessionId, tokenData] of csrfTokenStore.entries()) {
    if (now > tokenData.expires || tokenData.used) {
      csrfTokenStore.delete(sessionId);
    }
  }
};

// Run cleanup periodically
setInterval(cleanupExpiredTokens, CSRF_CONFIG.CLEANUP_INTERVAL);

// Double submit cookie pattern
export const doubleSubmitCookie = (req: Request, res: Response, next: NextFunction) => {
  const method = req.method.toUpperCase();
  
  // Skip for safe methods
  if (CSRF_CONFIG.SAFE_METHODS.includes(method)) {
    return next();
  }
  
  // Get token from cookie and header
  const cookieToken = req.cookies[CSRF_CONFIG.COOKIE_NAME];
  const headerToken = req.get(CSRF_CONFIG.HEADER_NAME);
  
  if (!cookieToken || !headerToken) {
    securityLogger.warn('Double submit CSRF check failed - missing tokens', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      hasCookieToken: !!cookieToken,
      hasHeaderToken: !!headerToken,
      timestamp: new Date()
    });
    
    return res.status(403).json({
      error: 'CSRF protection failed',
      code: 'CSRF_DOUBLE_SUBMIT_FAILED'
    });
  }
  
  // Compare tokens
  if (cookieToken !== headerToken) {
    securityLogger.warn('Double submit CSRF check failed - token mismatch', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      timestamp: new Date()
    });
    
    return res.status(403).json({
      error: 'CSRF protection failed',
      code: 'CSRF_TOKEN_MISMATCH'
    });
  }
  
  next();
};

// Set CSRF cookie
export const setCSRFCookie = (req: Request, res: Response, next: NextFunction) => {
  const token = generateCSRFToken();
  
  // Set secure cookie with CSRF token
  res.cookie(CSRF_CONFIG.COOKIE_NAME, token, {
    httpOnly: false, // Client needs to read this for AJAX requests
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: CSRF_CONFIG.TOKEN_EXPIRY,
    path: '/'
  });
  
  // Also provide in header for initial requests
  res.setHeader('X-CSRF-Token', token);
  res.locals.csrfToken = token;
  
  next();
};

// CSRF token endpoint for AJAX requests
export const getCSRFToken = (req: Request, res: Response) => {
  const sessionId = req.sessionId || req.ip || 'unknown';
  const token = generateCSRFToken();
  
  storeCSRFToken(sessionId, token);
  
  res.json({
    success: true,
    csrfToken: token,
    expiresIn: CSRF_CONFIG.TOKEN_EXPIRY
  });
};

// Origin validation middleware - allow all origins
export const validateOrigin = (req: Request, res: Response, next: NextFunction) => {
  // Allow all origins
  next();
};

export default {
  csrfProtection,
  provideCSRFToken,
  doubleSubmitCookie,
  setCSRFCookie,
  getCSRFToken,
  validateOrigin,
  generateCSRFToken
};