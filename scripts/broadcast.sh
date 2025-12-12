#!/bin/bash
S="codex-swarm";M="$*"
[[ -z "$M" ]] && { echo "Usage: $0 \"message\"";exit 1; }
! tmux has-session -t "$S" 2>/dev/null && { echo "❌ Tmux session '$S' not running.";exit 1; }
tmux list-windows -t "$S" -F "#{window_name}" 2>/dev/null|while read -r W;do
  [[ -n "$W" && "$W" != "root" ]] && { tmux send-keys -t "$S:$W" "$M" C-m;echo "📣 Sent to $W → $M"; }
done
