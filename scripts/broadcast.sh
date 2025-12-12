#!/bin/bash
# USAGE:
# ./broadcast.sh "your message here"
SESSION="codex-swarm"
MESSAGE="$*"

if [[ -z "$MESSAGE" ]]; then
  echo "Usage: $0 \"message to broadcast\""
  exit 1
fi

if ! tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "❌ Tmux session '$SESSION' is not running."
  exit 1
fi

tmux list-windows -t "$SESSION" -F "#{window_name}" 2>/dev/null | while read -r WINDOW_NAME; do
  if [[ -z "$WINDOW_NAME" ]]; then
    continue
  fi
  if [[ "$WINDOW_NAME" == "root" ]]; then
    continue
  fi
  tmux send-keys -t "$SESSION:$WINDOW_NAME" "$MESSAGE" C-m
  echo "📣 Sent to $WINDOW_NAME → $MESSAGE"
done
