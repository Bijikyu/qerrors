#!/bin/bash
N=$1;shift;M=$*;S="codex-swarm";W="$S:$N"
[[ -z "$N" || -z "$M" ]] && { echo "Usage: $0 agent-name \"message\"";exit 1; }
! tmux has-session -t "$S" 2>/dev/null && { echo "❌ Tmux session '$S' not running.";exit 1; }
! tmux list-windows -t "$S" -F "#{window_name}" 2>/dev/null|grep -Fxq "$N" && { echo "❌ Agent '$N' not found.";exit 1; }
tmux send-keys -t "$W" "$M" C-m
tmux send-keys -t "$W" C-m
echo "✅ Sent to $N → $M"
