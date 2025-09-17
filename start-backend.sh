#!/bin/bash

# PLOMES-ROTA-CEP Backend Startup Script with Auto-Recovery
# Usage: ./start-backend.sh [--monitor|--dev|--prod]

set -e

# Configuration
PROJECT_DIR="/Users/rodrigooliveira/Documents/workspace/Claude-code/PLOMES-ROTA-CEP"
LOG_DIR="$PROJECT_DIR/logs"
PID_FILE="$LOG_DIR/backend.pid"
LOG_FILE="$LOG_DIR/backend.log"
ERROR_LOG="$LOG_DIR/backend-error.log"
PORT=3001

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to log with timestamp
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] SUCCESS:${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

# Create log directory
mkdir -p "$LOG_DIR"

# Function to check if port is in use
check_port() {
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to kill processes on port
kill_port_processes() {
    local pids=$(lsof -ti :$PORT 2>/dev/null || true)
    if [ ! -z "$pids" ]; then
        warn "Killing processes on port $PORT: $pids"
        echo "$pids" | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
}

# Function to cleanup on exit
cleanup() {
    log "Cleaning up..."
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            warn "Stopping backend process (PID: $pid)"
            kill -TERM "$pid" 2>/dev/null || true
            sleep 3
            if kill -0 "$pid" 2>/dev/null; then
                warn "Force killing backend process"
                kill -9 "$pid" 2>/dev/null || true
            fi
        fi
        rm -f "$PID_FILE"
    fi
    kill_port_processes
}

# Function to check if backend is healthy
check_health() {
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
            return 0
        fi
        sleep 1
        attempt=$((attempt + 1))
    done
    return 1
}

# Function to check dependencies
check_dependencies() {
    log "Checking dependencies..."

    # Check if Node.js is available
    if ! command -v node >/dev/null 2>&1; then
        error "Node.js is not installed or not in PATH"
        exit 1
    fi

    # Check Node.js version
    local node_version=$(node --version)
    log "Node.js version: $node_version"

    # Check if npm is available
    if ! command -v npm >/dev/null 2>&1; then
        error "npm is not installed or not in PATH"
        exit 1
    fi

    # Check if project directory exists
    if [ ! -d "$PROJECT_DIR" ]; then
        error "Project directory not found: $PROJECT_DIR"
        exit 1
    fi

    # Check if backend server exists
    if [ ! -f "$PROJECT_DIR/backend/server.js" ]; then
        error "Backend server file not found: $PROJECT_DIR/backend/server.js"
        exit 1
    fi

    # Check if node_modules exists
    if [ ! -d "$PROJECT_DIR/node_modules" ]; then
        warn "node_modules not found, installing dependencies..."
        cd "$PROJECT_DIR"
        npm install || {
            error "Failed to install dependencies"
            exit 1
        }
    fi

    # Check if .env file exists
    if [ ! -f "$PROJECT_DIR/.env" ]; then
        warn ".env file not found - some features may not work"
    fi

    success "Dependencies check passed"
}

# Function to fix common issues
fix_issues() {
    log "Checking for common issues..."

    # Kill any hanging processes
    kill_port_processes

    # Clear npm cache if needed
    if [ "$1" = "--force" ]; then
        log "Force mode: clearing npm cache and reinstalling..."
        cd "$PROJECT_DIR"
        npm cache clean --force || true
        rm -rf node_modules package-lock.json || true
        npm install || {
            error "Failed to reinstall dependencies"
            exit 1
        }
    fi

    # Check disk space
    local disk_usage=$(df "$PROJECT_DIR" | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$disk_usage" -gt 90 ]; then
        warn "Disk usage is high: ${disk_usage}%"
    fi

    # Check memory (macOS compatible)
    local mem_usage=$(vm_stat 2>/dev/null | awk '/Pages free:/ {free=$3} /Pages active:/ {active=$3} /Pages inactive:/ {inactive=$3} /Pages speculative:/ {spec=$3} /Pages wired down:/ {wired=$4} END {if(free && active && inactive && wired) printf "%.0f", (active+inactive+wired+spec)*100/(free+active+inactive+wired+spec)}' || echo "unknown")
    if [ "$mem_usage" != "unknown" ] && [ "$mem_usage" -gt 80 ] 2>/dev/null; then
        warn "Memory usage is high: ${mem_usage}%"
    fi

    success "Issue check completed"
}

# Function to start backend
start_backend() {
    local mode=${1:-"dev"}

    log "Starting backend in $mode mode..."

    cd "$PROJECT_DIR"

    # Set environment
    export NODE_ENV="$mode"
    if [ "$mode" = "dev" ]; then
        export NODE_ENV="development"
    elif [ "$mode" = "prod" ]; then
        export NODE_ENV="production"
    fi

    # Start the server
    if [ "$mode" = "monitor" ]; then
        # Use process monitor
        log "Starting with process monitor..."
        node process-monitor.js >> "$LOG_FILE" 2>> "$ERROR_LOG" &
    elif [ "$mode" = "dev" ]; then
        # Use nodemon for development
        log "Starting with nodemon..."
        ./node_modules/.bin/nodemon --legacy-watch --polling-interval 1000 backend/server.js >> "$LOG_FILE" 2>> "$ERROR_LOG" &
    else
        # Direct node for production
        log "Starting with node..."
        node backend/server.js >> "$LOG_FILE" 2>> "$ERROR_LOG" &
    fi

    local pid=$!
    echo "$pid" > "$PID_FILE"

    log "Backend started with PID: $pid"

    # Wait for server to be ready
    log "Waiting for server to be ready..."
    if check_health; then
        success "Backend is healthy and ready!"
        log "Server logs: tail -f $LOG_FILE"
        log "Error logs: tail -f $ERROR_LOG"
        log "Health check: curl http://localhost:$PORT/api/health"
        return 0
    else
        error "Backend failed to start or is not healthy"
        if [ -f "$ERROR_LOG" ]; then
            error "Recent errors:"
            tail -20 "$ERROR_LOG"
        fi
        return 1
    fi
}

# Function to show status
show_status() {
    log "Backend Status:"

    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            success "Backend is running (PID: $pid)"

            # Check if responding
            if check_health; then
                success "Backend is healthy and responding"
            else
                warn "Backend is running but not responding to health checks"
            fi

            # Show memory usage
            local mem_info=$(ps -p "$pid" -o rss= 2>/dev/null || echo "unknown")
            if [ "$mem_info" != "unknown" ]; then
                local mem_mb=$((mem_info / 1024))
                log "Memory usage: ${mem_mb}MB"
            fi
        else
            warn "PID file exists but process is not running"
            rm -f "$PID_FILE"
        fi
    else
        warn "Backend is not running (no PID file)"
    fi

    # Check port
    if check_port; then
        local port_pid=$(lsof -ti :$PORT)
        log "Port $PORT is in use by PID: $port_pid"
    else
        log "Port $PORT is available"
    fi
}

# Function to stop backend
stop_backend() {
    log "Stopping backend..."

    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            log "Sending SIGTERM to PID: $pid"
            kill -TERM "$pid"

            # Wait for graceful shutdown
            local attempts=10
            while [ $attempts -gt 0 ] && kill -0 "$pid" 2>/dev/null; do
                sleep 1
                attempts=$((attempts - 1))
            done

            if kill -0 "$pid" 2>/dev/null; then
                warn "Process didn't stop gracefully, force killing..."
                kill -9 "$pid"
            fi
        fi
        rm -f "$PID_FILE"
    fi

    kill_port_processes
    success "Backend stopped"
}

# Function to restart backend
restart_backend() {
    local mode=${1:-"dev"}
    log "Restarting backend..."
    stop_backend
    sleep 2
    start_backend "$mode"
}

# Main script logic
case "${1:-start}" in
    "start"|"--dev")
        trap cleanup EXIT INT TERM
        check_dependencies
        fix_issues
        start_backend "dev"
        ;;
    "--monitor")
        trap cleanup EXIT INT TERM
        check_dependencies
        fix_issues
        start_backend "monitor"
        ;;
    "--prod")
        trap cleanup EXIT INT TERM
        check_dependencies
        fix_issues
        start_backend "prod"
        ;;
    "stop")
        stop_backend
        ;;
    "restart")
        restart_backend "dev"
        ;;
    "restart-monitor")
        restart_backend "monitor"
        ;;
    "restart-prod")
        restart_backend "prod"
        ;;
    "status")
        show_status
        ;;
    "fix"|"--force")
        check_dependencies
        fix_issues "--force"
        ;;
    "logs")
        if [ -f "$LOG_FILE" ]; then
            tail -f "$LOG_FILE"
        else
            error "Log file not found: $LOG_FILE"
        fi
        ;;
    "errors")
        if [ -f "$ERROR_LOG" ]; then
            tail -f "$ERROR_LOG"
        else
            error "Error log file not found: $ERROR_LOG"
        fi
        ;;
    "health")
        if check_health; then
            success "Backend is healthy"
            curl -s "http://localhost:$PORT/api/health" | python3 -m json.tool 2>/dev/null || curl -s "http://localhost:$PORT/api/health"
        else
            error "Backend is not healthy or not running"
            exit 1
        fi
        ;;
    *)
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  start, --dev     Start backend in development mode (default)"
        echo "  --monitor        Start with process monitor"
        echo "  --prod           Start in production mode"
        echo "  stop             Stop backend"
        echo "  restart          Restart backend"
        echo "  restart-monitor  Restart with process monitor"
        echo "  restart-prod     Restart in production mode"
        echo "  status           Show backend status"
        echo "  fix, --force     Fix common issues and force reinstall"
        echo "  logs             Follow server logs"
        echo "  errors           Follow error logs"
        echo "  health           Check backend health"
        echo ""
        echo "Examples:"
        echo "  $0                 # Start in development mode"
        echo "  $0 --monitor       # Start with auto-restart monitoring"
        echo "  $0 status          # Check if backend is running"
        echo "  $0 fix             # Fix common issues"
        exit 1
        ;;
esac