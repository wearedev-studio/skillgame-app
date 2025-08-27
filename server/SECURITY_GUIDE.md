# 🛡️ Security Implementation Guide

## Overview
This document outlines the comprehensive security system implemented for the SkillGame Pro platform. The system provides enterprise-grade protection against OWASP Top 10 vulnerabilities and advanced threat detection.

## 🔒 Security Features Implemented

### 1. Authentication & Authorization
- **JWT Token Security**: Enhanced token validation with blacklisting
- **Brute Force Protection**: Automatic IP blocking after failed attempts
- **Session Management**: Secure session tracking and timeout
- **Multi-Factor Authentication**: Optional 2FA support

### 2. Input Validation & Sanitization
- **Express Validator**: Comprehensive input validation schemas
- **XSS Protection**: Real-time payload detection and sanitization
- **SQL/NoSQL Injection Prevention**: MongoDB sanitization middleware
- **File Upload Security**: MIME type validation and virus scanning

### 3. Rate Limiting & DDoS Protection
- **Multi-tier Rate Limiting**: Global, auth, and admin-specific limits
- **Speed Limiting**: Progressive delays for rapid requests
- **IP-based Throttling**: Per-IP request monitoring
- **Geographic Blocking**: Country-based access control

### 4. CSRF Protection
- **Double Submit Cookie Pattern**: Enhanced CSRF token validation
- **Origin Validation**: Cross-origin request verification
- **Token Lifecycle Management**: Automatic token expiration

### 5. Security Headers
- **Helmet.js Integration**: Comprehensive security headers
- **Content Security Policy**: XSS prevention through CSP
- **HSTS**: Enforce HTTPS connections
- **X-Frame-Options**: Clickjacking protection

### 6. Monitoring & Threat Detection
- **Real-time Security Monitoring**: Live threat detection
- **Pattern Analysis**: Behavioral attack recognition
- **Automated Response**: Threat blocking and escalation
- **Security Dashboard**: Admin monitoring interface

## 🚀 Deployment Instructions

### Prerequisites
1. **Node.js** (v18+ recommended)
2. **MongoDB** (v5.0+ with replica set for transactions)
3. **Redis** (v6.0+ for session management and rate limiting)
4. **SSL Certificate** (required for production)

### Step 1: Environment Configuration

1. Copy the production environment template:
```bash
cp .env.production.example .env
```

2. Update critical security variables:
```bash
# Generate strong JWT secret (64+ characters)
JWT_SECRET=$(openssl rand -base64 48)

# Set your domain origins
ALLOWED_ORIGINS=https://yourdomain.com,https://crm.yourdomain.com

# Configure Redis for security features
REDIS_HOST=your-redis-host
REDIS_PASSWORD=your-strong-redis-password

# Set admin IP whitelist (your server IPs)
ADMIN_IP_WHITELIST=1.2.3.4,5.6.7.8
```

### Step 2: Database Security

1. **MongoDB Security Checklist**:
```javascript
// Enable authentication
mongod --auth --port 27017

// Create admin user
use admin
db.createUser({
  user: "admin",
  pwd: "strongPassword123!",
  roles: ["userAdminAnyDatabase", "dbAdminAnyDatabase"]
})

// Create application user
use skillgame-pro
db.createUser({
  user: "skillgame",
  pwd: "applicationPassword456!",
  roles: ["readWrite"]
})
```

2. **Connection String Security**:
```bash
MONGODB_URI=mongodb://skillgame:applicationPassword456!@localhost:27017/skillgame-pro?authSource=skillgame-pro
```

### Step 3: Redis Security Configuration

```bash
# Redis configuration
requirepass your-strong-redis-password
bind 127.0.0.1
protected-mode yes
port 6379
```

### Step 4: SSL/TLS Configuration

1. **Obtain SSL Certificate** (Let's Encrypt recommended):
```bash
certbot certonly --standalone -d yourdomain.com -d crm.yourdomain.com
```

2. **Nginx Configuration** (recommended reverse proxy):
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Step 5: Application Deployment

1. **Install Dependencies**:
```bash
npm ci --only=production
```

2. **Start with Process Manager** (PM2 recommended):
```bash
# Install PM2 globally
npm install -g pm2

# Start application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save
pm2 startup
```

3. **PM2 Configuration** (`ecosystem.config.js`):
```javascript
module.exports = {
  apps: [{
    name: 'skillgame-api',
    script: './src/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
}
```

## 🔍 Security Monitoring

### Real-time Monitoring Features

1. **Security Dashboard** (`/security` in CRM):
   - Live threat detection
   - Blocked IP management
   - Security metrics and trends
   - Alert management

2. **Automated Alerts**:
   - Slack/Discord webhooks
   - Email notifications
   - SMS alerts (configured)

3. **Log Analysis**:
   - Structured security logging
   - Winston-based log management
   - Log rotation and retention

### Key Metrics to Monitor

- **Request Rate**: Unusual traffic spikes
- **Failed Logins**: Brute force attempts
- **Blocked IPs**: Geographic and threat-based blocking
- **Error Rates**: Application security errors
- **Response Times**: Performance impact of security measures

## 🚨 Incident Response

### Automatic Response Actions

1. **IP Blocking**: Automatic blocking of suspicious IPs
2. **Rate Limiting**: Progressive request throttling
3. **Session Termination**: Force logout on security breaches
4. **Alert Generation**: Immediate notification of critical threats

### Manual Response Procedures

1. **Security Breach Investigation**:
   ```bash
   # Check security logs
   tail -f logs/security.log
   
   # Review blocked IPs
   redis-cli KEYS "blocked_ip:*"
   
   # Check active sessions
   redis-cli KEYS "session:*"
   ```

2. **Emergency Lockdown**:
   ```bash
   # Enable security lockdown mode
   export SECURITY_LOCKDOWN_MODE=true
   pm2 restart skillgame-api
   ```

## 🧪 Security Testing

### Automated Security Tests

1. **Run Security Test Suite**:
```bash
npm run test:security
```

2. **Manual Security Testing**:
```bash
# Test XSS protection
curl -X POST http://localhost:5000/api/test \
  -H "Content-Type: application/json" \
  -d '{"test": "<script>alert(\"xss\")</script>"}'

# Test rate limiting
for i in {1..10}; do
  curl -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email": "test@test.com", "password": "wrong"}'
done

# Test CSRF protection
curl -X POST http://localhost:5000/api/admin/users \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser"}'
```

### Penetration Testing Recommendations

1. **OWASP ZAP**: Automated vulnerability scanning
2. **Burp Suite**: Manual security testing
3. **Nmap**: Network security assessment
4. **SQLMap**: SQL injection testing

## 📋 Security Checklist

### Pre-Deployment Checklist

- [ ] Strong JWT secret generated (64+ characters)
- [ ] Redis password configured
- [ ] MongoDB authentication enabled
- [ ] SSL certificate installed
- [ ] Firewall rules configured
- [ ] Security headers enabled
- [ ] Rate limiting configured
- [ ] IP whitelist updated
- [ ] Monitoring alerts configured
- [ ] Backup encryption enabled

### Post-Deployment Checklist

- [ ] Security dashboard accessible
- [ ] Threat detection working
- [ ] Rate limiting functional
- [ ] SSL grade A+ (SSLLabs test)
- [ ] Security headers present (SecurityHeaders.com)
- [ ] OWASP compliance verified
- [ ] Incident response tested
- [ ] Log monitoring active

## 🔧 Troubleshooting

### Common Issues

1. **Rate Limiting Too Strict**:
   - Adjust `RATE_LIMIT_MAX_REQUESTS` in .env
   - Check `RATE_LIMIT_WINDOW_MS` setting

2. **CSRF Token Issues**:
   - Verify frontend CSRF token handling
   - Check `CSRF_HEADER_NAME` configuration

3. **IP Blocking Problems**:
   - Review `ADMIN_IP_WHITELIST` settings
   - Check Redis connectivity

### Debug Commands

```bash
# Check Redis connectivity
redis-cli ping

# Monitor security events
tail -f logs/security.log | grep ERROR

# Check blocked IPs
redis-cli SMEMBERS blocked_ips

# Reset security metrics
redis-cli FLUSHDB
```

## 📞 Support

For security-related issues or questions:
- Review logs in `./logs/security.log`
- Check the Security Dashboard in CRM
- Monitor Redis for security events
- Contact security team for critical issues

## 🔄 Regular Maintenance

### Daily Tasks
- Monitor security dashboard
- Review failed login attempts
- Check blocked IP list

### Weekly Tasks
- Review security logs
- Update threat patterns
- Verify SSL certificate status

### Monthly Tasks
- Security audit and review
- Update dependencies
- Penetration testing
- Backup verification

---

**Remember**: Security is an ongoing process. Regularly update dependencies, monitor logs, and stay informed about new threats and vulnerabilities.