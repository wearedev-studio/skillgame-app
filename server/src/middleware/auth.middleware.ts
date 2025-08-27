import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import User, { IUser } from '../models/User.model';
import { securityLogger } from './security.middleware';
import crypto from 'crypto';

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      sessionId?: string;
    }
  }
}

// JWT blacklist for logout functionality and security
const tokenBlacklist = new Set<string>();

// Session tracking for additional security
const activeSessions = new Map<string, {
  userId: string;
  ip: string;
  userAgent: string;
  createdAt: Date;
  lastActivity: Date;
}>();

// Enhanced JWT protection middleware
export const protect = async (req: Request, res: Response, next: NextFunction) => {
  let token;
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'Unknown';

  // Extract token from different sources
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } else if (req.query.token) {
    token = req.query.token as string;
  }

  if (!token || token === 'null' || token === 'undefined') {
    securityLogger.warn('Authentication attempt without token', {
      ip,
      userAgent,
      path: req.path,
      timestamp: new Date()
    });
    return res.status(401).json({
      message: 'Access denied. No token provided.',
      code: 'NO_TOKEN'
    });
  }

  // Check if token is blacklisted
  if (tokenBlacklist.has(token)) {
    securityLogger.warn('Blacklisted token usage attempt', {
      ip,
      userAgent,
      path: req.path,
      timestamp: new Date()
    });
    return res.status(401).json({
      message: 'Token has been invalidated',
      code: 'BLACKLISTED_TOKEN'
    });
  }

  try {
    // Verify JWT with enhanced security options
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string, {
      algorithms: ['HS256'], // Only allow secure algorithm
      maxAge: '7d', // Maximum token age
      clockTolerance: 30 // Allow 30 seconds clock skew
    }) as JwtPayload;

    // Validate token structure
    if (!decoded.id || !decoded.iat || !decoded.exp) {
      throw new Error('Invalid token structure');
    }

    // Check token age (additional security layer)
    const tokenAge = Date.now() - (decoded.iat * 1000);
    const maxTokenAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    
    if (tokenAge > maxTokenAge) {
      throw new Error('Token expired due to age');
    }

    // Get user with additional security checks
    const user = await User.findById(decoded.id)
      .select('-password');

    if (!user) {
      securityLogger.warn('Token for non-existent user', {
        userId: decoded.id,
        ip,
        userAgent,
        timestamp: new Date()
      });
      return res.status(401).json({
        message: 'User no longer exists',
        code: 'USER_NOT_FOUND'
      });
    }

    // Check if user account is active
    if (user.status === 'BANNED' || user.status === 'SUSPENDED') {
      securityLogger.warn('Banned/suspended user access attempt', {
        userId: user._id,
        status: user.status,
        ip,
        userAgent,
        timestamp: new Date()
      });
      return res.status(403).json({
        message: 'Account has been suspended',
        code: 'ACCOUNT_SUSPENDED'
      });
    }

    // Session management
    const sessionId = decoded.sessionId || crypto.randomBytes(16).toString('hex');
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
    
    // Validate session if it exists
    if (activeSessions.has(sessionId)) {
      const session = activeSessions.get(sessionId)!;
      
      // Check if session belongs to the same user
      if (session.userId !== user.id.toString()) {
        securityLogger.error('Session hijacking attempt detected', {
          sessionId,
          expectedUserId: session.userId,
          actualUserId: user._id,
          ip,
          userAgent,
          timestamp: new Date()
        });
        
        // Invalidate the session
        activeSessions.delete(sessionId);
        tokenBlacklist.add(token);
        
        return res.status(401).json({
          message: 'Session security violation detected',
          code: 'SESSION_VIOLATION'
        });
      }
      
      // Check if session has been inactive for more than 1 hour
      if (session.lastActivity < oneHourAgo) {
        securityLogger.info('Session expired due to inactivity', {
          sessionId,
          userId: user._id,
          lastActivity: session.lastActivity,
          ip,
          userAgent,
          timestamp: now
        });
        
        // Remove expired session
        activeSessions.delete(sessionId);
        tokenBlacklist.add(token);
        
        return res.status(401).json({
          message: 'Session expired due to inactivity. Please log in again.',
          code: 'SESSION_EXPIRED'
        });
      }
      
      // Update session activity
      session.lastActivity = now;
    } else {
      // Create new session
      activeSessions.set(sessionId, {
        userId: user.id.toString(),
        ip: ip || 'unknown',
        userAgent,
        createdAt: now,
        lastActivity: now
      });
    }

    // Rate limiting per user
    const userKey = `user_requests:${user._id}`;
    // This would be implemented with Redis in production

    // Attach user and session to request
    req.user = user as IUser;
    req.sessionId = sessionId;

    // Log successful authentication for high-value operations
    if (req.path.includes('/admin') || req.path.includes('/payment')) {
      securityLogger.info('High-privilege access', {
        userId: user.id,
        userRole: user.role,
        ip,
        userAgent,
        path: req.path,
        timestamp: new Date()
      });
    }

    next();
  } catch (error: any) {
    // Enhanced error logging
    securityLogger.warn('JWT verification failed', {
      error: error.message,
      tokenPresent: !!token,
      ip,
      userAgent,
      path: req.path,
      timestamp: new Date()
    });

    // Different error responses based on error type
    let message = 'Authentication failed';
    let code = 'AUTH_FAILED';

    if (error.name === 'TokenExpiredError') {
      message = 'Token has expired';
      code = 'TOKEN_EXPIRED';
    } else if (error.name === 'JsonWebTokenError') {
      message = 'Invalid token format';
      code = 'INVALID_TOKEN';
    } else if (error.name === 'NotBeforeError') {
      message = 'Token not active yet';
      code = 'TOKEN_NOT_ACTIVE';
    }

    return res.status(401).json({ message, code });
  }
};

// Logout middleware to blacklist tokens
export const logout = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (token) {
    tokenBlacklist.add(token);
  }
  
  if (req.sessionId) {
    activeSessions.delete(req.sessionId);
  }
  
  next();
};

// Clean up expired sessions and blacklisted tokens
setInterval(() => {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
  
  // Clean up sessions inactive for more than 1 hour
  let cleanedSessions = 0;
  for (const [sessionId, session] of activeSessions.entries()) {
    if (session.lastActivity < oneHourAgo) {
      activeSessions.delete(sessionId);
      cleanedSessions++;
    }
  }
  
  if (cleanedSessions > 0) {
    securityLogger.info('Cleaned up expired sessions', {
      cleanedSessions,
      activeSessions: activeSessions.size,
      timestamp: now
    });
  }
  
  // In production, you'd implement a more sophisticated cleanup for tokenBlacklist
  // using Redis with TTL or a database cleanup job
}, 30 * 60 * 1000); // Run every 30 minutes to catch expired sessions quickly

// Export session utilities for admin monitoring
export const getActiveSessions = () => Array.from(activeSessions.entries());
export const forceLogoutUser = (userId: string) => {
  for (const [sessionId, session] of activeSessions.entries()) {
    if (session.userId === userId) {
      activeSessions.delete(sessionId);
    }
  }
};

export default { protect, logout, getActiveSessions, forceLogoutUser };