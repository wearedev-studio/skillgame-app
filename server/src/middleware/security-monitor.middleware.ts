import { Request, Response, NextFunction } from 'express';
import { securityLogger } from './security.middleware';
import Redis from 'ioredis';

// Initialize Redis for security monitoring
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: 3,
  lazyConnect: true
});

// Security thresholds and configurations
const SECURITY_THRESHOLDS = {
  MAX_FAILED_LOGINS_PER_IP: 10,
  MAX_FAILED_LOGINS_PER_EMAIL: 5,
  MAX_REQUESTS_PER_MINUTE: 120,
  MAX_UNIQUE_IPS_PER_MINUTE: 50,
  MAX_404_ERRORS_PER_IP: 20,
  MAX_500_ERRORS_PER_MINUTE: 10,
  SUSPICIOUS_USER_AGENTS: [
    'sqlmap',
    'nikto',
    'nmap',
    'masscan',
    'zap',
    'burp',
    'acunetix',
    'nessus'
  ],
  BLOCKED_COUNTRIES: process.env.BLOCKED_COUNTRIES?.split(',') || [],
  HIGH_RISK_PATHS: [
    '/admin',
    '/api/admin',
    '/api/auth',
    '/api/payments',
    '/wp-admin',
    '/.env',
    '/config',
    '/backup'
  ]
};

// Security event types
enum SecurityEventType {
  FAILED_LOGIN = 'failed_login',
  SUSPICIOUS_IP = 'suspicious_ip',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  INVALID_TOKEN = 'invalid_token',
  PERMISSION_DENIED = 'permission_denied',
  FILE_UPLOAD_ATTEMPT = 'file_upload_attempt',
  SQL_INJECTION_ATTEMPT = 'sql_injection_attempt',
  XSS_ATTEMPT = 'xss_attempt',
  PATH_TRAVERSAL_ATTEMPT = 'path_traversal_attempt',
  BRUTE_FORCE_ATTACK = 'brute_force_attack',
  DDOS_ATTEMPT = 'ddos_attempt',
  SUSPICIOUS_USER_AGENT = 'suspicious_user_agent',
  GEOGRAPHIC_ANOMALY = 'geographic_anomaly',
  ACCOUNT_TAKEOVER_ATTEMPT = 'account_takeover_attempt',
  UNUSUAL_ACTIVITY = 'unusual_activity'
}

interface SecurityEvent {
  type: SecurityEventType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  ip: string;
  userAgent?: string;
  userId?: string;
  path: string;
  method: string;
  timestamp: Date;
  details: Record<string, any>;
  blocked: boolean;
}

// Security monitoring class
class SecurityMonitor {
  private static instance: SecurityMonitor;
  private alertCooldowns = new Map<string, number>();

  public static getInstance(): SecurityMonitor {
    if (!SecurityMonitor.instance) {
      SecurityMonitor.instance = new SecurityMonitor();
    }
    return SecurityMonitor.instance;
  }

  // Log security event
  async logEvent(event: SecurityEvent): Promise<void> {
    try {
      // Store in Redis for real-time analysis
      const eventKey = `security_event:${Date.now()}:${Math.random()}`;
      await redis.setex(eventKey, 3600, JSON.stringify(event)); // Store for 1 hour

      // Log to file
      securityLogger.warn('Security Event', event);

      // Update metrics
      await this.updateMetrics(event);

      // Check for patterns and triggers
      await this.analyzePatterns(event);

      // Send alerts if necessary
      if (event.severity === 'high' || event.severity === 'critical') {
        await this.sendAlert(event);
      }

    } catch (error) {
      console.error('Error logging security event:', error);
    }
  }

  // Update security metrics
  private async updateMetrics(event: SecurityEvent): Promise<void> {
    const minute = Math.floor(Date.now() / 60000);
    const hour = Math.floor(Date.now() / 3600000);
    
    try {
      // Increment counters
      await redis.incr(`security_events:${event.type}:${minute}`);
      await redis.expire(`security_events:${event.type}:${minute}`, 3600);
      
      await redis.incr(`ip_events:${event.ip}:${minute}`);
      await redis.expire(`ip_events:${event.ip}:${minute}`, 3600);
      
      if (event.userId) {
        await redis.incr(`user_events:${event.userId}:${hour}`);
        await redis.expire(`user_events:${event.userId}:${hour}`, 86400);
      }

      // Track unique IPs per minute
      await redis.sadd(`unique_ips:${minute}`, event.ip);
      await redis.expire(`unique_ips:${minute}`, 3600);

    } catch (error) {
      console.error('Error updating security metrics:', error);
    }
  }

  // Analyze patterns for advanced threat detection
  private async analyzePatterns(event: SecurityEvent): Promise<void> {
    try {
      const minute = Math.floor(Date.now() / 60000);
      
      // Check for DDOS patterns
      const uniqueIPs = await redis.scard(`unique_ips:${minute}`);
      if (uniqueIPs > SECURITY_THRESHOLDS.MAX_UNIQUE_IPS_PER_MINUTE) {
        await this.logEvent({
          type: SecurityEventType.DDOS_ATTEMPT,
          severity: 'critical',
          ip: 'multiple',
          path: 'multiple',
          method: 'multiple',
          timestamp: new Date(),
          details: { uniqueIPs, threshold: SECURITY_THRESHOLDS.MAX_UNIQUE_IPS_PER_MINUTE },
          blocked: false
        });
      }

      // Check for brute force patterns
      if (event.type === SecurityEventType.FAILED_LOGIN) {
        const failedLogins = await redis.get(`ip_failed_logins:${event.ip}:${minute}`);
        if (failedLogins && parseInt(failedLogins) > SECURITY_THRESHOLDS.MAX_FAILED_LOGINS_PER_IP) {
          await this.logEvent({
            type: SecurityEventType.BRUTE_FORCE_ATTACK,
            severity: 'high',
            ip: event.ip,
            path: event.path,
            method: event.method,
            timestamp: new Date(),
            details: { failedLogins: parseInt(failedLogins) },
            blocked: true
          });
          
          // Auto-block IP for 30 minutes
          await redis.setex(`blocked_ip:${event.ip}`, 1800, 'brute_force');
        }
      }

      // Check for coordinated attacks
      await this.detectCoordinatedAttacks(event);

    } catch (error) {
      console.error('Error analyzing security patterns:', error);
    }
  }

  // Detect coordinated attacks
  private async detectCoordinatedAttacks(event: SecurityEvent): Promise<void> {
    try {
      const minute = Math.floor(Date.now() / 60000);
      
      // Check for multiple IPs attacking same endpoint
      const endpointKey = `endpoint_attacks:${event.path}:${minute}`;
      await redis.sadd(endpointKey, event.ip);
      await redis.expire(endpointKey, 300);
      
      const attackingIPs = await redis.scard(endpointKey);
      if (attackingIPs > 5) {
        await this.logEvent({
          type: SecurityEventType.UNUSUAL_ACTIVITY,
          severity: 'high',
          ip: 'multiple',
          path: event.path,
          method: event.method,
          timestamp: new Date(),
          details: { 
            attackingIPs, 
            pattern: 'coordinated_endpoint_attack',
            endpoint: event.path 
          },
          blocked: false
        });
      }

    } catch (error) {
      console.error('Error detecting coordinated attacks:', error);
    }
  }

  // Send security alerts
  private async sendAlert(event: SecurityEvent): Promise<void> {
    const alertKey = `${event.type}:${event.ip}`;
    const cooldownTime = 300000; // 5 minutes
    
    // Check cooldown
    const lastAlert = this.alertCooldowns.get(alertKey);
    if (lastAlert && Date.now() - lastAlert < cooldownTime) {
      return;
    }

    this.alertCooldowns.set(alertKey, Date.now());

    // Log critical alert
    securityLogger.error('SECURITY ALERT', {
      ...event,
      alert: true,
      requiresAction: event.severity === 'critical'
    });

    // In production, you would integrate with:
    // - Email alerts
    // - Slack/Discord webhooks
    // - PagerDuty
    // - SMS alerts
    // - SIEM systems

    console.log(`🚨 SECURITY ALERT [${event.severity.toUpperCase()}]: ${event.type} from ${event.ip}`);
  }

  // Get security dashboard data
  async getDashboardData(): Promise<any> {
    try {
      const minute = Math.floor(Date.now() / 60000);
      const hour = Math.floor(Date.now() / 3600000);

      const [
        totalEvents,
        uniqueIPs,
        blockedIPs,
        failedLogins,
        highSeverityEvents
      ] = await Promise.all([
        redis.get(`security_events:total:${minute}`) || '0',
        redis.scard(`unique_ips:${minute}`),
        redis.keys('blocked_ip:*').then(keys => keys.length),
        redis.get(`security_events:${SecurityEventType.FAILED_LOGIN}:${minute}`) || '0',
        redis.get(`security_events:high_severity:${minute}`) || '0'
      ]);

      return {
        timestamp: new Date(),
        metrics: {
          totalEvents: parseInt(totalEvents || '0'),
          uniqueIPs,
          blockedIPs,
          failedLogins: parseInt(failedLogins || '0'),
          highSeverityEvents: parseInt(highSeverityEvents || '0')
        },
        thresholds: SECURITY_THRESHOLDS,
        status: this.calculateSecurityStatus()
      };

    } catch (error) {
      console.error('Error getting dashboard data:', error);
      return { error: 'Failed to fetch security data' };
    }
  }

  // Calculate overall security status
  private calculateSecurityStatus(): string {
    // Simple status calculation - in production this would be more sophisticated
    const recentAlerts = Array.from(this.alertCooldowns.values())
      .filter(time => Date.now() - time < 300000).length;

    if (recentAlerts > 5) return 'critical';
    if (recentAlerts > 2) return 'high';
    if (recentAlerts > 0) return 'medium';
    return 'normal';
  }

  // Check if IP is blocked
  async isIPBlocked(ip: string): Promise<boolean> {
    try {
      const blocked = await redis.get(`blocked_ip:${ip}`);
      return !!blocked;
    } catch (error) {
      return false;
    }
  }

  // Block IP manually
  async blockIP(ip: string, reason: string, duration: number = 3600): Promise<void> {
    try {
      await redis.setex(`blocked_ip:${ip}`, duration, reason);
      await this.logEvent({
        type: SecurityEventType.SUSPICIOUS_IP,
        severity: 'high',
        ip,
        path: 'admin_action',
        method: 'BLOCK',
        timestamp: new Date(),
        details: { reason, duration, action: 'manual_block' },
        blocked: true
      });
    } catch (error) {
      console.error('Error blocking IP:', error);
    }
  }

  // Unblock IP
  async unblockIP(ip: string): Promise<void> {
    try {
      await redis.del(`blocked_ip:${ip}`);
      securityLogger.info('IP Unblocked', { ip, timestamp: new Date() });
    } catch (error) {
      console.error('Error unblocking IP:', error);
    }
  }
}

// Security monitoring middleware
export const securityMonitor = (req: Request, res: Response, next: NextFunction) => {
  const monitor = SecurityMonitor.getInstance();
  const startTime = Date.now();
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';

  // Check if IP is blocked
  monitor.isIPBlocked(ip).then(blocked => {
    if (blocked) {
      monitor.logEvent({
        type: SecurityEventType.SUSPICIOUS_IP,
        severity: 'medium',
        ip,
        userAgent,
        path: req.path,
        method: req.method,
        timestamp: new Date(),
        details: { reason: 'blocked_ip_access_attempt' },
        blocked: true
      });

      return res.status(403).json({
        error: 'Access denied',
        code: 'IP_BLOCKED'
      });
    }

    // Continue with request
    next();
  }).catch(error => {
    console.error('Error checking IP block status:', error);
    next();
  });

  // Monitor response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Detect suspicious patterns
    const suspiciousPatterns = {
      sqlInjection: /(union|select|insert|update|delete|drop|exec|script)/i,
      xss: /(<script|javascript:|onerror|onload|onclick)/i,
      pathTraversal: /(\.\.|\/etc\/|\/var\/|\/usr\/|\/bin\/)/,
      suspiciousUserAgent: SECURITY_THRESHOLDS.SUSPICIOUS_USER_AGENTS.some(agent => 
        userAgent.toLowerCase().includes(agent.toLowerCase())
      )
    };

    const requestContent = JSON.stringify(req.body) + req.url + req.query;

    // Log security events based on patterns
    if (suspiciousPatterns.sqlInjection.test(requestContent)) {
      monitor.logEvent({
        type: SecurityEventType.SQL_INJECTION_ATTEMPT,
        severity: 'high',
        ip,
        userAgent,
        path: req.path,
        method: req.method,
        timestamp: new Date(),
        details: { requestContent: requestContent.substring(0, 500) },
        blocked: false
      });
    }

    if (suspiciousPatterns.xss.test(requestContent)) {
      monitor.logEvent({
        type: SecurityEventType.XSS_ATTEMPT,
        severity: 'high',
        ip,
        userAgent,
        path: req.path,
        method: req.method,
        timestamp: new Date(),
        details: { requestContent: requestContent.substring(0, 500) },
        blocked: false
      });
    }

    if (suspiciousPatterns.pathTraversal.test(requestContent)) {
      monitor.logEvent({
        type: SecurityEventType.PATH_TRAVERSAL_ATTEMPT,
        severity: 'high',
        ip,
        userAgent,
        path: req.path,
        method: req.method,
        timestamp: new Date(),
        details: { requestContent: requestContent.substring(0, 500) },
        blocked: false
      });
    }

    if (suspiciousPatterns.suspiciousUserAgent) {
      monitor.logEvent({
        type: SecurityEventType.SUSPICIOUS_USER_AGENT,
        severity: 'medium',
        ip,
        userAgent,
        path: req.path,
        method: req.method,
        timestamp: new Date(),
        details: { detectedAgent: userAgent },
        blocked: false
      });
    }

    // Log failed authentication attempts
    if (statusCode === 401 && req.path.includes('auth')) {
      monitor.logEvent({
        type: SecurityEventType.FAILED_LOGIN,
        severity: 'medium',
        ip,
        userAgent,
        path: req.path,
        method: req.method,
        timestamp: new Date(),
        details: { email: req.body?.email },
        blocked: false
      });
    }

    // Log permission denied
    if (statusCode === 403) {
      monitor.logEvent({
        type: SecurityEventType.PERMISSION_DENIED,
        severity: 'medium',
        ip,
        userAgent,
        path: req.path,
        method: req.method,
        timestamp: new Date(),
        details: { userId: (req as any).user?.id },
        blocked: false
      });
    }

    // Log high-value endpoint access
    if (SECURITY_THRESHOLDS.HIGH_RISK_PATHS.some(path => req.path.includes(path))) {
      monitor.logEvent({
        type: SecurityEventType.UNUSUAL_ACTIVITY,
        severity: 'low',
        ip,
        userAgent,
        path: req.path,
        method: req.method,
        timestamp: new Date(),
        details: { 
          statusCode,
          duration,
          highRiskEndpoint: true,
          userId: (req as any).user?.id
        },
        blocked: false
      });
    }
  });
};

// Export the security monitor instance and types
export { SecurityMonitor, SecurityEventType };
export default securityMonitor;