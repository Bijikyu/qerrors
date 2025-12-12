#!/bin/bash
S="codex-swarm";N="$1"
[[ -z "$N" ]] && { echo "Usage: $0 agent-name";exit 1; }
! tmux has-session -t "$S" 2>/dev/null && { echo "❌ Tmux session '$S' not running.";exit 1; }
! tmux list-windows -t "$S" -F "#{window_name}" 2>/dev/null|grep -Fxq "$N" && { echo "❌ Agent '$N' not found.";exit 1; }
tmux kill-window -t "$S:$N"
echo "🛑 Agent '$N' stopped."
