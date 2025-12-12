#!/bin/bash
LOG_DIR="./logs"
SESSION="codex-swarm"

echo "🔍 Listing active Codex agents..."

echo "📜 Logs:"
if [[ -d "$LOG_DIR" ]]; then
  find "$LOG_DIR" -maxdepth 1 -type f -name "*.log" 2>/dev/null || echo "  (none)"
else
  echo "  (none)"
fi

echo ""
echo "🪟 Tmux windows in session '$SESSION':"
tmux list-windows -t "$SESSION" 2>/dev/null || echo "  (tmux session not running)"
