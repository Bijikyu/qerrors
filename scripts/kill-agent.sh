#!/bin/bash
# USAGE:
# ./kill-agent.sh agent-name

SESSION="codex-swarm"
NAME="$1"

if [[ -z "$NAME" ]]; then
  echo "Usage: $0 agent-name"
  exit 1
fi

if ! tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "❌ Tmux session '$SESSION' is not running."
  exit 1
fi

if ! tmux list-windows -t "$SESSION" -F "#{window_name}" 2>/dev/null | grep -Fxq "$NAME"; then
  echo "❌ Agent '$NAME' window not found in session '$SESSION'."
  exit 1
fi

tmux kill-window -t "$SESSION:$NAME"
echo "🛑 Agent '$NAME' stopped."
