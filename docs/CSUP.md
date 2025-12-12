# Codex Swarm Usage Protocol (CSUP)

**CSUP = Codex Swarm Usage Protocol**

This protocol orchestrates multiple Codex CLI sessions inside a shared `tmux` environment. Each session runs in its own window, allowing you to execute 1–N Codex agents in parallel without handholding. The workflow below mirrors the coordination discipline used in `node_modules/commoncontext/ReplitCodexUse.md`, but adapts it to the `tmux`-based tooling (`./scripts/spawn-agent.sh`, `./scripts/send-to-agent.sh`, etc.) documented in `CODEXSWARM.md`.

---

## 📦 System Components

### 1. `tmux` Session
- All agents run inside a dedicated `tmux` session called `codex-swarm`.
- Each agent sits in its own window: `codex-swarm:agent01`, `codex-swarm:agent02`, …
- Windows can be created ahead of time or on demand via `./scripts/spawn-agent.sh`.

### 2. Helper Scripts (`./scripts/` directory)
- `./scripts/spawn-agent.sh` – Ensures the tmux session exists, spawns a new window, starts `npx codex --full-auto --ask-for-approval never` (using whatever model your Codex CLI session is already configured to use), and pipes output to `logs/<agent>.log`.
- `./scripts/send-to-agent.sh` – Sends a message to the target window and automatically submits the newline (`C-m`) so the CLI executes immediately.
- `./scripts/list-agents.sh` – Lists active logs and tmux windows.
- `./scripts/broadcast.sh` – Sends the same message to every agent window (excluding the root control pane).
- `./scripts/kill-agent.sh` / `./scripts/kill-all-agents.sh` – Gracefully terminate one agent or the entire swarm (the latter accepts `--purge-logs` to remove accumulated logs).

All scripts assume `tmux` and Node.js (for `npx codex`) are available. Run `chmod +x ./scripts/*.sh` after installation to ensure they're executable.

> **Approval Tip:** When operating under a policy that requires per-command approval, batch similar commands (e.g., spawning several agents inside a single `for` loop) so you only request permission once for the whole group.

### 3. Logging Directories
- `logs/<agent>.log` – Continuous transcript for each agent.
- Optional instrumentation files (you create them):
  - `articles/timestamps.log`
  - `articles/wordcounts.log`
  - `…` (any other shared data sink the agents append to)

---

## ⚙️ How Parallel Execution Works

### Sequential Launch, Parallel Work
1. Each agent is launched sequentially (`./scripts/spawn-agent.sh` followed by `./scripts/send-to-agent.sh`), but once the prompt is delivered the Codex session runs independently inside its tmux window.
2. All windows remain active simultaneously; the limiting factors are available CPU/RAM and Codex API throttling, not tmux.

### Prompt Length Limit
The interactive Codex CLI truncates input at roughly **1,024 characters**. Any message longer than that will be silently clipped and the agent may appear idle. Keep instructions tight or send them in consecutive chunks:

```bash
./scripts/send-to-agent.sh agent07 "Part 1 (under 1k chars)"
./scripts/send-to-agent.sh agent07 "Part 2 (under 1k chars)"
```

### Auto-Submit Behavior
`send-to-agent.sh` automatically sends the trailing newline (`C-m`). You only need to issue manual `tmux send-keys … C-m` calls if you bypass the helper (e.g., by scripting `tmux` directly).

### Recommended Concurrency
- On Replit's default 4 vCPU / 4 GB RAM boxes, 15–25 simultaneous agents have been stable in practice.
- Watch `htop`, `free -h`, and `./scripts/list-agents.sh` as you scale. If the Codex CLI reports throttling or windows stall on the greeting prompt, pause new launches.

---

## 📋 Normative Workflow for Codex Swarm

### Step 1. Classify & Communicate
Tell the user how you intend to proceed:
``
"This is a [trivial | non-trivial] task because …"
"I'll run [N] Codex tmux agent(s) to cover …"
``
- Trivial tasks → implement directly (no swarm).
- Non-trivial tasks → follow the remaining steps.

### Step 2. Create CURRENTPLAN.md (single agent)
1. Spawn one planning window (or reuse an existing one).
2. Send a concise prompt instructing Codex to analyse the codebase and write `CURRENTPLAN.md`.
3. Wait for completion, verify the file, and extract actionable tasks.
4. Do **not** spawn additional agents until the newly written plan is reviewed and acknowledged in the main session.

### Step 3. Create Task List
Populate your `write_task_list` tool (if available) or maintain a manual checklist derived from the plan.
Explicitly annotate each task as **Sequential** or **Parallel** (or note prerequisites) so the user can tell which workstreams will run concurrently.
Share the resulting checklist with the user before launching agents so the parallelisation plan is transparent.

### Step 4. Inspect `FILE_FLOWS.md` for Parallelization
Decide how to divide work:
- **Logical split:** by feature, component, layer, etc.
- **Index-based split:** even/odd files, file quartiles, alphabetical ranges.
- **Progressive split:** analysis passes first, followed by targeted fixes (analysis window → same window performs fixes).

Document the split and the number of windows needed (max recommended: 20).

### Step 5. Announce Execution Plan
Inform the user which agents you're deploying and why:
``
"I'll spawn 4 tmux Codex agents: auth, billing, frontend, tests."
"I'll run 3 agents split by file index (even/odd/remnants) to refactor imports."
``

### Step 6. Implementation via tmux Agents

#### 6.1 Spawn / Reuse Windows
```bash
./scripts/spawn-agent.sh article01 ./project-root
./scripts/spawn-agent.sh article02 ./project-root
…
```
Only spawn new windows if they don't exist; otherwise reuse existing ones to keep logs contiguous.

#### 6.2 Prepare Prompts (≤ 1,024 chars each)
Include:
- Section of `CURRENTPLAN.md` the agent owns.
- Explicit list of files to modify.
- Files to avoid (handled elsewhere).
- Any instrumentation commands (timestamps, wordcounts, etc.).

#### 6.3 Send Prompts Sequentially
Example loop for three agents:
```bash
./scripts/send-to-agent.sh agentA "Handle auth feature… (≤1k chars)"
./scripts/send-to-agent.sh agentB "Handle billing feature… (≤1k chars)"
./scripts/send-to-agent.sh agentC "Handle frontend… (≤1k chars)"
```
If you have more text than fits, split into numbered parts (A1, A2 …) and send sequentially; the script will auto-submit each part.
Whenever you dispatch prompts, mirror a concise summary in the primary session so the user can see what each window is doing.

#### 6.4 Instrument Long-Running Tasks (Optional but Recommended)
Embed timestamp and bookkeeping commands in each prompt:
```bash
date -u +"%Y-%m-%dT%H:%M:%SZ agentA start" >> swarm/timestamps.log
cat <<'EOF' > path/to/output.md
# Heading
…
EOF
wc -w path/to/output.md >> swarm/wordcounts.log
date -u +"%Y-%m-%dT%H:%M:%SZ agentA finish" >> swarm/timestamps.log
echo "agentA output.md done" >> swarm/concurrency.log
```
This yields reliable start/finish pairs for performance analysis.

#### 6.5 Monitor Progress
- Tail logs: `tail -f logs/agentA.log`
- Capture panes: `tmux capture-pane -t codex-swarm:agentA -p | tail`
- Verify no window is stuck on the greeting screen; if it is, resend a shorter prompt.
Share representative log snippets or status summaries with the user during long runs so they can track progress in real time.

#### 6.6 Resolve Idle / Failed Agents
- If an agent hangs or needs a new assignment, send fresh instructions or kill and respawn the window:
  ```bash
  ./scripts/kill-agent.sh agentA
  ./scripts/spawn-agent.sh agentA ./project-root
  ```
- When an analysis assignment finishes, keep the same window alive and immediately issue the follow-up implementation or testing prompt for that scope. Do not end the workflow at analysis; transition directly to fixes unless the user redirects.

### Step 7. Architect Evaluation
Use your evaluation tool (e.g., `architect(responsibility="evaluate_task")`) after the agents finish. If gaps remain, return to Step 2 or Step 6 with revised prompts; otherwise proceed.

### Step 8. Testing Loop
1. Ensure all implementation windows are idle.
2. Spawn or reuse a dedicated test window, send:
   ``
   "Run `npm test` and report results. Do not fix anything."
   ``
3. If tests fail:
   - Read `DEBUG_TESTS.md` (or test output).
   - Decide whether to launch 1 or multiple agents to address failures.
   - Repeat Steps 6–7 focused on test fixes.
4. Loop until tests pass.

### Step 9. Completion
Once the architect confirms and tests pass, summarise outcomes, tidy logs (optional `./scripts/kill-all-agents.sh --purge-logs`), and mark tasks complete.

---

## 🔐 Operational Safeguards

1. **Prompt Size:** Keep individual messages under 1,024 characters. Split instructions if necessary.
2. **Window Verification:** After dispatching prompts, spot-check logs or `tmux capture-pane` to ensure the agent received them (look for activity, not the idle greeting).
3. **Resource Awareness:** Monitor CPU/memory to avoid oversubscription. If Codex reports throttling or windows lag, pause new launches.
4. **Log Hygiene:** Swarm runs can generate large logs quickly. Periodically archive or purge old logs (`./scripts/kill-all-agents.sh --purge-logs`) to avoid clutter.
5. **Shared Files:** If multiple agents append to the same file (e.g., `timestamps.log`), ensure commands append (`>>`) and each agent writes unique identifiers.

---

## 📚 Quick Reference

| Action | Command |
| --- | --- |
| Spawn new agent | `./scripts/spawn-agent.sh agent07 ./path` |
| Send work prompt | `./scripts/send-to-agent.sh agent07 "…"` |
| Broadcast message | `./scripts/broadcast.sh "Wrap up"` |
| List active agents | `./scripts/list-agents.sh` |
| Tail logs for agent | `tail -f logs/agent07.log` |
| Capture tmux pane | `tmux capture-pane -t codex-swarm:agent07 -p` |
| Stop one agent | `./scripts/kill-agent.sh agent07` |
| Stop all agents | `./scripts/kill-all-agents.sh --purge-logs` |

---

By following CSUP you reproduce the disciplined, parallel Codex workflow of Replit's RCUP but with the tmux-based swarm provided in this project. Keep prompts concise, plan divisions carefully, instrument long tasks, and continuously verify each agent's progress for best results.