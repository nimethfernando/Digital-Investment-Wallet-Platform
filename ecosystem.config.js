/**
 * ==============================================================================
 * AVORA BANK - PM2 Production Process Management Configuration
 * ==============================================================================
 * Enables multi-core cluster execution, zero-downtime reloads, memory limits,
 * and unified timestamped logging across bare-metal or cloud VPS instances.
 */

module.exports = {
  apps: [
    {
      name: 'avora-api',
      script: 'dist/index.js',
      cwd: './apps/server',
      instances: 2,
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 5000,
      },
      error_file: '../../logs/api-error.log',
      out_file: '../../logs/api-out.log',
      merge_logs: true,
      time: true,
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
    },
    {
      name: 'avora-web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      cwd: './apps/web',
      instances: 2,
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '768M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        INTERNAL_API_URL: 'http://localhost:5000',
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000,
        INTERNAL_API_URL: 'http://localhost:5000',
      },
      error_file: '../../logs/web-error.log',
      out_file: '../../logs/web-out.log',
      merge_logs: true,
      time: true,
      kill_timeout: 5000,
    },
  ],
};

