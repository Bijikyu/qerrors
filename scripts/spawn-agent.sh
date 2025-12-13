#!/bin/bash
S="codex-swarm";N=$1;D=$2;shift 2;A=("$@")
[[ -z "$N" || -z "$D" ]] && { echo "Usage: $0 <name> <dir> [args...]";exit 1; }
[[ ! -d "$D" ]] && { echo "❌ Dir '$D' not found.";exit 1; }
L="./logs";mkdir -p "$L"
C=(npx codex)
if [[ ${#A[@]} -eq 0 ]];then 
  C+=(--full-auto --ask-for-approval never)
else
  F=false
  for I in "${!A[@]}";do [[ "${A[$I]}" == "--ask-for-approval" || "${A[$I]}" == "-a" ]] && { F=true;break; }done
  C+=("${A[@]}")
  [[ "$F" == false ]] && C+=(--ask-for-approval never)
fi
printf -v CS '%q ' "${C[@]}";CS="${CS% }"
printf -v WC 'cd %q && %s' "$D" "$CS"
O="$L/${N}.log"
tmux kill-window -t "$S:$N" 2>/dev/null
! tmux has-session -t "$S" 2>/dev/null && tmux new-session -d -s "$S" -n root
tmux new-window -d -t "$S" -n "$N" "$WC"
tmux pipe-pane -o -t "$S:$N" "cat >> \"$O\""
echo "Agent '$N' spawned in tmux session '$S'."
echo "  Send: ./send-to-agent.sh $NAME \"<msg>\""
echo "  Log: $O"