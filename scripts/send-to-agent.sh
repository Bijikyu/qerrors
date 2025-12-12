#!/bin/bash
# USAGE:
# ./send-to-agent.sh agent-name "your prompt here"

NAME="$1"
shift
MESSAGE="$*"
SESSION="codex-swarm"
WINDOW="$SESSION:$NAME"

if [ -z "$NAME" ] || [ -z "$MESSAGE" ]; then
  echo "Usage: $0 agent-name \"message to send\""
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

tmux send-keys -t "$WINDOW" "$MESSAGE" C-m
tmux send-keys -t "$WINDOW" C-m
echo "✅ Sent to $NAME → $MESSAGE"
