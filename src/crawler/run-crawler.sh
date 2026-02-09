#!/bin/bash
# TWSE Intraday Crawler - Linux/Mac Scheduler Script
# Usage: Add to crontab: */10 9-13 * * 1-5 /path/to/run-crawler.sh
#
# Installation:
# 1. chmod +x run-crawler.sh
# 2. crontab -e
# 3. Add: */10 9-13 * * 1-5 cd /path/to/notebooklm && ./src/crawler/run-crawler.sh

set -e

# Configuration
WORKSPACE="$(cd "$(dirname "$0")/../.." && pwd)"
LOG_DIR="$WORKSPACE/logs"
DATA_DIR="$WORKSPACE/data/intraday"

# Create directories
mkdir -p "$LOG_DIR"
mkdir -p "$DATA_DIR"

# Log function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_DIR/crawler.log"
}

log "========================================"
log "TWSE Intraday Crawler Started"
log "Workspace: $WORKSPACE"
log "========================================"

# Run crawler
cd "$WORKSPACE"
if node src/crawler/intraday-crawler.js --once >> "$LOG_DIR/crawler.log" 2>&1; then
    log "✅ Crawler completed successfully"
else
    log "❌ Crawler failed with exit code $?"
fi

log "========================================"
log "Session completed"
log "========================================"
