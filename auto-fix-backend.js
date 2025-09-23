#!/usr/bin/env node

/**
 * Auto-Fix Backend Service
 * Garante que o backend esteja sempre rodando na porta 3001
 * Executa verificações e correções automáticas
 */

const { spawn, exec } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

class BackendAutoFix {
  constructor() {
    this.backendPort = 3001;
    this.checkInterval = 5000; // Verifica a cada 5 segundos
    this.backendProcess = null;
    this.isRunning = false;
    this.logFile = path.join(__dirname, 'backend-autofix.log');
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(`🔧 ${message}`);

    // Append to log file
    fs.appendFileSync(this.logFile, logMessage);
  }

  async checkBackendHealth() {
    return new Promise((resolve) => {
      const req = http.request({
        hostname: 'localhost',
        port: this.backendPort,
        path: '/api/health',
        method: 'GET',
        timeout: 2000
      }, (res) => {
        resolve(res.statusCode === 200);
      });

      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.end();
    });
  }

  async killExistingProcesses() {
    return new Promise((resolve) => {
      // Kill any process using port 3001
      exec(`lsof -ti:${this.backendPort}`, (error, stdout) => {
        if (stdout) {
          const pids = stdout.trim().split('\n');
          let killCount = 0;

          pids.forEach(pid => {
            if (pid) {
              try {
                process.kill(parseInt(pid), 'SIGTERM');
                killCount++;
                this.log(`Killed existing process PID: ${pid}`);
              } catch (e) {
                // Process might already be dead
              }
            }
          });

          if (killCount > 0) {
            // Wait a bit for processes to die
            setTimeout(resolve, 2000);
          } else {
            resolve();
          }
        } else {
          resolve();
        }
      });
    });
  }

  async startBackend() {
    if (this.backendProcess) {
      this.log('Backend process already exists, killing it first');
      this.backendProcess.kill();
      this.backendProcess = null;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await this.killExistingProcesses();

    this.log('Starting backend server...');

    // Start backend with proper environment
    this.backendProcess = spawn('node', ['backend/server.js'], {
      cwd: __dirname,
      env: {
        ...process.env,
        PORT: this.backendPort.toString(),
        NODE_ENV: 'development'
      },
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Log backend output
    this.backendProcess.stdout.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        this.log(`Backend: ${output}`);
      }
    });

    this.backendProcess.stderr.on('data', (data) => {
      const output = data.toString().trim();
      if (output && !output.includes('ExperimentalWarning')) {
        this.log(`Backend Error: ${output}`);
      }
    });

    this.backendProcess.on('exit', (code) => {
      this.log(`Backend process exited with code: ${code}`);
      this.backendProcess = null;
      // Restart after a delay if not manually stopped
      if (this.isRunning) {
        setTimeout(() => this.checkAndFix(), 3000);
      }
    });

    // Wait for backend to start
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  async checkAndFix() {
    if (!this.isRunning) return;

    try {
      const isHealthy = await this.checkBackendHealth();

      if (isHealthy) {
        // Backend is running fine
        return;
      }

      this.log('❌ Backend not responding, attempting to fix...');
      await this.startBackend();

      // Verify it started correctly
      await new Promise(resolve => setTimeout(resolve, 2000));
      const isNowHealthy = await this.checkBackendHealth();

      if (isNowHealthy) {
        this.log('✅ Backend successfully restarted and is healthy');
      } else {
        this.log('⚠️  Backend restart attempted but health check still failing');
      }

    } catch (error) {
      this.log(`Error during check and fix: ${error.message}`);
    }
  }

  start() {
    this.isRunning = true;
    this.log('🚀 Starting Backend Auto-Fix Service');
    this.log(`Monitoring backend health on port ${this.backendPort}`);
    this.log(`Check interval: ${this.checkInterval}ms`);

    // Initial check and fix
    this.checkAndFix();

    // Set up periodic checks
    this.checkTimer = setInterval(() => {
      this.checkAndFix();
    }, this.checkInterval);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      this.stop();
    });

    process.on('SIGTERM', () => {
      this.stop();
    });
  }

  stop() {
    this.log('🛑 Stopping Backend Auto-Fix Service');
    this.isRunning = false;

    if (this.checkTimer) {
      clearInterval(this.checkTimer);
    }

    if (this.backendProcess) {
      this.log('Stopping backend process...');
      this.backendProcess.kill();
      this.backendProcess = null;
    }

    process.exit(0);
  }
}

// Run if called directly
if (require.main === module) {
  const autoFix = new BackendAutoFix();
  autoFix.start();

  console.log('🔧 Backend Auto-Fix Service started');
  console.log('Press Ctrl+C to stop');
}

module.exports = BackendAutoFix;