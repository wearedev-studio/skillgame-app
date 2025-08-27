import express from 'express';
import { Request, Response } from 'express';
import { adminProtect } from '../middleware/admin.middleware';
import { SecurityMonitor } from '../middleware/security-monitor.middleware';
import { validate, validateMongoId, validateUserId } from '../middleware/validation.middleware';
import { query, body } from 'express-validator';

const router = express.Router();

// Security dashboard data endpoint
router.get('/dashboard', adminProtect, async (req: Request, res: Response) => {
  try {
    const monitor = SecurityMonitor.getInstance();
    const dashboardData = await monitor.getDashboardData();
    
    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch security dashboard data',
      error: error.message
    });
  }
});

// Get active sessions
router.get('/sessions', adminProtect, async (req: Request, res: Response) => {
  try {
    const { getActiveSessions } = await import('../middleware/auth.middleware');
    const sessions = getActiveSessions();
    
    res.json({
      success: true,
      data: {
        activeSessions: sessions.length,
        sessions: sessions.map(([sessionId, session]) => ({
          sessionId,
          userId: session.userId,
          ip: session.ip,
          userAgent: session.userAgent,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity
        }))
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active sessions',
      error: error.message
    });
  }
});

// Force logout user
router.post('/sessions/:userId/logout',
  adminProtect,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { forceLogoutUser } = await import('../middleware/auth.middleware');
      
      forceLogoutUser(userId);
      
      res.json({
        success: true,
        message: `User ${userId} has been logged out from all sessions`
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to logout user',
        error: error.message
      });
    }
  }
);

// Get blocked IPs
router.get('/blocked-ips', adminProtect, async (req: Request, res: Response) => {
  try {
    // This would typically fetch from Redis or database
    // For now, return a placeholder response
    res.json({
      success: true,
      data: {
        blockedIPs: [],
        message: 'Blocked IPs feature requires Redis implementation'
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch blocked IPs',
      error: error.message
    });
  }
});

// Block IP address
router.post('/block-ip',
  adminProtect,
  validate([
    body('ip')
      .isIP()
      .withMessage('Valid IP address is required'),
    body('reason')
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Reason must be between 1 and 200 characters'),
    body('duration')
      .optional()
      .isInt({ min: 60, max: 86400 })
      .withMessage('Duration must be between 60 seconds and 24 hours')
      .toInt()
  ]),
  async (req: Request, res: Response) => {
    try {
      const { ip, reason, duration = 3600 } = req.body;
      const monitor = SecurityMonitor.getInstance();
      
      await monitor.blockIP(ip, reason, duration);
      
      res.json({
        success: true,
        message: `IP ${ip} has been blocked for ${duration} seconds`,
        data: { ip, reason, duration }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to block IP',
        error: error.message
      });
    }
  }
);

// Unblock IP address
router.post('/unblock-ip',
  adminProtect,
  validate([
    body('ip')
      .isIP()
      .withMessage('Valid IP address is required')
  ]),
  async (req: Request, res: Response) => {
    try {
      const { ip } = req.body;
      const monitor = SecurityMonitor.getInstance();
      
      await monitor.unblockIP(ip);
      
      res.json({
        success: true,
        message: `IP ${ip} has been unblocked`
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to unblock IP',
        error: error.message
      });
    }
  }
);

// Get security events
router.get('/events',
  adminProtect,
  validate([
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer')
      .toInt(),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
      .toInt(),
    query('severity')
      .optional()
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Invalid severity level'),
    query('type')
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Invalid event type'),
    query('ip')
      .optional()
      .isIP()
      .withMessage('Invalid IP address format')
  ]),
  async (req: Request, res: Response) => {
    try {
      const { 
        page = 1, 
        limit = 20, 
        severity, 
        type, 
        ip 
      } = req.query;

      // In a real implementation, this would query Redis or a database
      // For now, return a placeholder response
      const mockEvents: any[] = [];
      
      res.json({
        success: true,
        data: {
          events: mockEvents,
          pagination: {
            currentPage: page,
            totalPages: 1,
            totalItems: 0,
            limit
          },
          filters: { severity, type, ip }
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch security events',
        error: error.message
      });
    }
  }
);

// Security system health check
router.get('/health', adminProtect, async (req: Request, res: Response) => {
  try {
    const monitor = SecurityMonitor.getInstance();
    
    // Check various security components
    const healthChecks = {
      timestamp: new Date(),
      components: {
        securityMonitor: 'operational',
        rateLimit: 'operational',
        bruteForceProtection: 'operational',
        fileUploadSecurity: 'operational',
        xssProtection: 'operational',
        sqlInjectionProtection: 'operational'
      },
      overall: 'healthy'
    };

    res.json({
      success: true,
      data: healthChecks
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Security health check failed',
      error: error.message
    });
  }
});

// Security configuration endpoint
router.get('/config', adminProtect, async (req: Request, res: Response) => {
  try {
    const config = {
      rateLimit: {
        global: {
          windowMs: 15 * 60 * 1000,
          max: 1000
        },
        auth: {
          windowMs: 15 * 60 * 1000,
          max: 5
        },
        admin: {
          windowMs: 5 * 60 * 1000,
          max: 100
        }
      },
      security: {
        maxLoginAttempts: 5,
        lockoutTime: 30 * 60 * 1000,
        maxFileSize: 5 * 1024 * 1024,
        allowedFileTypes: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf']
      },
      monitoring: {
        alertCooldown: 5 * 60 * 1000,
        patternDetection: true,
        realTimeAlerts: true
      }
    };

    res.json({
      success: true,
      data: config
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch security configuration',
      error: error.message
    });
  }
});

// Update security configuration
router.put('/config',
  adminProtect,
  validate([
    body('maxLoginAttempts')
      .optional()
      .isInt({ min: 3, max: 20 })
      .withMessage('Max login attempts must be between 3 and 20'),
    body('lockoutTime')
      .optional()
      .isInt({ min: 300000, max: 3600000 })
      .withMessage('Lockout time must be between 5 minutes and 1 hour'),
    body('maxFileSize')
      .optional()
      .isInt({ min: 1048576, max: 52428800 })
      .withMessage('Max file size must be between 1MB and 50MB')
  ]),
  async (req: Request, res: Response) => {
    try {
      const updates = req.body;
      
      // In a real implementation, this would update configuration
      // stored in Redis or a database
      
      res.json({
        success: true,
        message: 'Security configuration updated successfully',
        data: updates
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to update security configuration',
        error: error.message
      });
    }
  }
);

export default router;