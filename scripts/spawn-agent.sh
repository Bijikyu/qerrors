#!/bin/bash
# USAGE:
# ./spawn-agent.sh agent-name /path/to/dir [codex args...]

SESSION="codex-swarm"
NAME="$1"
DIR="$2"
shift 2
CODEX_ARGS=("$@")

if [[ -z "$NAME" || -z "$DIR" ]]; then
  echo "Usage: $0 <agent-name> <working-directory> [codex args...]"
  exit 1
fi

if [[ ! -d "$DIR" ]]; then
  echo "❌ Working directory '$DIR' does not exist."
  exit 1
fi

LOG_DIR="./logs"
mkdir -p "$LOG_DIR"

CODEX_CMD=(npx codex)

if [[ ${#CODEX_ARGS[@]} -eq 0 ]]; then
  CODEX_CMD+=(--full-auto --ask-for-approval never)
else
  ASK_FLAG_PRESENT=false
  for ARG_INDEX in "${!CODEX_ARGS[@]}"; do
    CURRENT_ARG="${CODEX_ARGS[$ARG_INDEX]}"
    if [[ "$CURRENT_ARG" == "--ask-for-approval" || "$CURRENT_ARG" == "-a" ]]; then
      ASK_FLAG_PRESENT=true
      break
    fi
  done

  CODEX_CMD+=("${CODEX_ARGS[@]}")

  if [[ "$ASK_FLAG_PRESENT" == false ]]; then
    CODEX_CMD+=(--ask-for-approval never)
  fi
fi

printf -v CODEX_CMD_STR '%q ' "${CODEX_CMD[@]}"
CODEX_CMD_STR="${CODEX_CMD_STR% }"
printf -v WINDOW_CMD 'cd %q && %s' "$DIR" "$CODEX_CMD_STR"

STDOUT_LOG="$LOG_DIR/${NAME}.log"

tmux kill-window -t "$SESSION:$NAME" 2>/dev/null

if ! tmux has-session -t "$SESSION" 2>/dev/null; then
  tmux new-session -d -s "$SESSION" -n root
fi

tmux new-window -d -t "$SESSION" -n "$NAME" "$WINDOW_CMD"
tmux pipe-pane -o -t "$SESSION:$NAME" "cat >> \"$STDOUT_LOG\""

echo "Agent '$NAME' spawned in tmux session '$SESSION'."
echo "  Send messages with: ./send-to-agent.sh $NAME \"<message>\""
echo "  Output log: $STDOUT_LOG"
