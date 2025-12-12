#!/bin/bash
# USAGE:
# ./kill-all-agents.sh [--purge-logs]

SESSION="codex-swarm"
LOG_DIR="./logs"
PURGE_FLAG="$1"

case "$PURGE_FLAG" in
  "") PURGE_LOGS=false ;;
  "--purge-logs") PURGE_LOGS=true ;;
  *) echo "Usage: $0 [--purge-logs]" ; exit 1 ;;
esac

if ! tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "❌ Tmux session '$SESSION' is not running."
  exit 1
fi

tmux kill-session -t "$SESSION"

if $PURGE_LOGS; then
  if [[ -d "$LOG_DIR" ]]; then
    find "$LOG_DIR" -maxdepth 1 -type f -name "*.log" -exec rm -f {} +
    echo "🗑️ Cleared logs in $LOG_DIR."
  else
    echo "ℹ️ Log directory '$LOG_DIR' not found; nothing to purge."
  fi
fi

echo "🧹 All agents stopped; tmux session '$SESSION' terminated."
