#!/bin/bash
S="codex-swarm";L="./logs";P="$1"
case "$P" in "") P=false;; "--purge-logs") P=true;; *) echo "Usage: $0 [--purge-logs]";exit 1;;esac
! tmux has-session -t "$S" 2>/dev/null && { echo "❌ Tmux session '$S' not running.";exit 1; }
tmux kill-session -t "$S"
if $P;then [[ -d "$L" ]] && { find "$L" -maxdepth 1 -type f -name "*.log" -exec rm -f {} +;echo "🗑️ Cleared logs in $L."; }||echo "ℹ️ Log dir '$L' not found.";fi
echo "🧹 All agents stopped; tmux session '$S' terminated."
