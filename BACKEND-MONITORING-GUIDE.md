# Backend Monitoring and Recovery Guide

## Overview

This document describes the comprehensive monitoring and auto-recovery system implemented for the PLOMES-ROTA-CEP backend to prevent crashes and ensure high availability.

## Components

### 1. Enhanced Backend Server (`backend/server.js`)

**Improvements Added:**
- Comprehensive error handling for all critical operations
- Graceful shutdown handlers for SIGTERM/SIGINT
- Uncaught exception recovery with automatic restart
- Service initialization with retry logic and timeouts
- Enhanced logging with error context and troubleshooting steps
- Memory monitoring and garbage collection triggers
- Detailed startup diagnostics and health checks

### 2. Process Monitor (`process-monitor.js`)

**Features:**
- Automatic server restart on crashes or unresponsiveness
- Memory usage monitoring with configurable thresholds
- Health check endpoint monitoring every 30 seconds
- Zombie process cleanup
- Comprehensive logging with timestamps
- Graceful shutdown handling
- Maximum restart attempt limits to prevent infinite loops

**Configuration:**
```javascript
PORT: 3001                    // Server port
CHECK_INTERVAL: 30000         // Health check interval (30s)
MAX_RESTART_ATTEMPTS: 5       // Max restart attempts
RESTART_DELAY: 5000          // Delay between restarts (5s)
MEMORY_THRESHOLD: 500        // Memory limit in MB
```

### 3. Startup Script (`start-backend.sh`)

**Capabilities:**
- Pre-flight checks (port availability, dependencies, critical files)
- Multiple startup modes (dev, monitor, production)
- Dependency validation and auto-repair
- Comprehensive logging to files
- Process lifecycle management
- Health monitoring and status reporting

## Usage

### Starting the Backend

#### Development Mode (with nodemon)
```bash
./start-backend.sh --dev
# or
npm run dev:backend
```

#### With Process Monitor (recommended for production)
```bash
./start-backend.sh --monitor
# or
npm run start:monitor
```

#### Production Mode
```bash
./start-backend.sh --prod
```

#### Safe Mode (direct process monitor)
```bash
npm run start:safe
```

### Monitoring Commands

#### Check Status
```bash
./start-backend.sh status
# or
npm run status:backend
```

#### View Logs
```bash
# Server logs
./start-backend.sh logs
# or
npm run logs:backend

# Error logs only
./start-backend.sh errors
# or
npm run errors:backend
```

#### Health Check
```bash
./start-backend.sh health
# or
npm run health:backend
```

#### Restart Backend
```bash
./start-backend.sh restart
# or
npm run restart:backend
```

#### Stop Backend
```bash
./start-backend.sh stop
# or
npm run stop:backend
```

#### Fix Common Issues
```bash
./start-backend.sh fix
# or
npm run fix:backend
```

### Process Monitor Direct Usage

```bash
# Start process monitor directly
node process-monitor.js

# Monitor will:
# - Start the backend server
# - Monitor health every 30 seconds
# - Auto-restart on failures
# - Log all activities
```

## Log Files

All logs are stored in the `logs/` directory:

- `backend.log` - Server output and general logs
- `backend-error.log` - Error logs only
- `process-monitor.log` - Process monitor activities

## Error Recovery

### Automatic Recovery Scenarios

1. **Server Crashes**: Process monitor detects and restarts
2. **Memory Leaks**: Automatic restart when memory exceeds threshold
3. **Unresponsive Server**: Health check failures trigger restart
4. **Port Conflicts**: Automatic cleanup of zombie processes
5. **Database Corruption**: Database auto-fix on startup
6. **Module Loading Errors**: Enhanced error messages and exit codes

### Manual Recovery

If automatic recovery fails:

1. **Check Status**:
   ```bash
   ./start-backend.sh status
   ```

2. **View Recent Errors**:
   ```bash
   ./start-backend.sh errors
   ```

3. **Force Cleanup and Restart**:
   ```bash
   ./start-backend.sh fix
   ./start-backend.sh restart
   ```

4. **Nuclear Option** (if all else fails):
   ```bash
   # Kill all node processes
   pkill -f "node.*server.js"
   pkill -f "nodemon"

   # Clean and reinstall
   rm -rf node_modules package-lock.json
   npm install

   # Start fresh
   ./start-backend.sh --monitor
   ```

## Health Endpoints

### Primary Health Check
```bash
curl http://localhost:3001/api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-09-15T17:25:10.464Z",
  "services": {
    "database": "connected",
    "ploome": "initialized",
    "auth": "initialized"
  }
}
```

### Extended System Info
```bash
curl http://localhost:3001/api/version
```

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   lsof -ti :3001  # Find processes using port
   ./start-backend.sh fix  # Auto-cleanup
   ```

2. **High Memory Usage**
   - Process monitor will auto-restart at 500MB
   - Check logs for memory leak patterns
   - Consider restarting with fresh state

3. **Database Issues**
   - Auto-fix runs on every startup
   - Manual fix: `node backend/auto-fix-database.js`

4. **Module Loading Errors**
   ```bash
   ./start-backend.sh fix  # Reinstalls dependencies
   ```

5. **Permission Issues**
   ```bash
   chmod +x start-backend.sh
   chmod 755 logs/  # Ensure log directory is writable
   ```

### Debug Mode

For verbose debugging:
```bash
NODE_ENV=development DEBUG=* ./start-backend.sh --dev
```

## Best Practices

1. **Always use the startup script** instead of running `node backend/server.js` directly
2. **Monitor logs regularly** for early warning signs
3. **Use process monitor in production** for automatic recovery
4. **Set up external monitoring** to alert on extended downtime
5. **Keep dependencies updated** to avoid known issues
6. **Monitor disk space** as high usage can cause issues

## Performance Monitoring

### Key Metrics to Watch

- **Memory Usage**: Should stay under 500MB
- **Response Time**: Health check should respond within 10s
- **Restart Frequency**: More than 5 restarts/hour indicates issues
- **Error Rate**: Monitor error logs for patterns

### Monitoring Commands

```bash
# Real-time monitoring
watch -n 5 './start-backend.sh status'

# Memory usage
ps aux | grep "node.*server.js"

# Port monitoring
watch -n 2 'lsof -i :3001'
```

## Advanced Configuration

### Environment Variables

- `NODE_ENV`: Set environment mode
- `PORT`: Override default port (3001)
- `PLOOME_API_KEY`: Required for Ploome integration
- `CLIENT_TAG_ID`: Filter for Ploome contacts

### Process Monitor Customization

Edit `process-monitor.js` to adjust:
- Health check interval
- Memory thresholds
- Maximum restart attempts
- Restart delays

### Startup Script Customization

Edit `start-backend.sh` to modify:
- Dependency checks
- Pre-flight validations
- Logging behavior
- Recovery strategies

## Integration with External Monitoring

The system is designed to integrate with external monitoring tools:

- Health endpoint for uptime monitoring
- Structured logging for log aggregation
- Process metrics for performance monitoring
- Status API for dashboard integration

## Support

If issues persist after following this guide:

1. Check the troubleshooting section
2. Review recent error logs
3. Try the "nuclear option" for complete reset
4. Ensure system has adequate resources (memory, disk space)

The monitoring system is designed to be self-healing, but manual intervention may be required for system-level issues or resource constraints.