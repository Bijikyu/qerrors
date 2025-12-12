#!/bin/bash
L="./logs";S="codex-swarm"
echo "🔍 Listing active Codex agents..."
echo "📜 Logs:"
[[ -d "$L" ]] && find "$L" -maxdepth 1 -type f -name "*.log" 2>/dev/null||echo "  (none)"
echo ""
echo "🪟 Tmux windows in session '$S':"
tmux list-windows -t "$S" 2>/dev/null||echo "  (tmux session not running)"
