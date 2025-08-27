module.exports = {
  apps: [{
    name: 'skillgame-api',
    script: './src/server.js',
    
    // Production configuration
    instances: 'max', // Use all CPU cores
    exec_mode: 'cluster',
    
    // Environment
    env: {
      NODE_ENV: 'development',
      PORT: 5000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    env_staging: {
      NODE_ENV: 'staging',
      PORT: 5001
    },
    
    // Logging
    error_file: './logs/pm2-err.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    
    // Process management
    autorestart: true,
    watch: false, // Disable in production
    max_memory_restart: '1G',
    
    // Advanced PM2 features
    min_uptime: '10s',
    max_restarts: 10,
    
    // Health monitoring
    health_check_url: 'http://localhost:5000/health',
    health_check_interval: 30000,
    
    // Security
    uid: 'www-data', // Run as non-root user
    gid: 'www-data',
    
    // Environment file
    env_file: '.env',
    
    // Graceful shutdown
    kill_timeout: 5000,
    listen_timeout: 8000,
    
    // Performance monitoring
    pmx: true,
    
    // Advanced clustering
    instance_var: 'INSTANCE_ID',
    
    // Production optimizations
    node_args: [
      '--max-old-space-size=2048',
      '--gc-interval=100'
    ]
  }],
  
  // Deployment configuration
  deploy: {
    production: {
      user: 'deploy',
      host: 'your-production-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:your-username/skillgame-pro.git',
      path: '/var/www/skillgame-pro',
      'pre-deploy-local': '',
      'post-deploy': 'npm ci --only=production && pm2 reload ecosystem.config.js --env production',
      'pre-setup': '',
      'ssh_options': 'StrictHostKeyChecking=no'
    },
    staging: {
      user: 'deploy',
      host: 'your-staging-server.com',
      ref: 'origin/develop',
      repo: 'git@github.com:your-username/skillgame-pro.git',
      path: '/var/www/skillgame-pro-staging',
      'post-deploy': 'npm ci && pm2 reload ecosystem.config.js --env staging'
    }
  }
};