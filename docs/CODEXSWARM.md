Here's your fully detailed `CODEXSWARM.md`, written as documentation that could be read and understood by Codex CLI agents themselves (or anyone running them). This version assumes agents are acting autonomously or semi-autonomously inside a `tmux`-based multi-agent environment.

---

# 🐝 CODEXSWARM.md

> Self-replicating CLI agent swarm orchestration using `tmux` and Codex CLI.

---

## 📦 Setup

### 1. **Install `tmux` in your Replit project**

Add this to `replit.nix`:

```nix
{ pkgs }:
{
	deps = [
		pkgs.tmux
		pkgs.nodejs_20
	];
}
```

In Shell:

```bash
tmux -V  # should output something like "tmux 3.4"
```

### 2. **Ensure you have the following scripts under `./scripts/`**:

* `./scripts/spawn-agent.sh` ← spawns a new Codex CLI agent in its own tmux window
* `./scripts/send-to-agent.sh` ← sends messages to an agent using `tmux send-keys`
* `./scripts/kill-agent.sh` ← terminates a specific agent window without touching others
* `./scripts/kill-all-agents.sh` ← shuts down the entire swarm session in one step
* `./scripts/broadcast.sh` ← sends one message to every active agent window
* `./scripts/list-agents.sh` ← shows active agents, logs, and windows

Make them executable (run from repo root):

```bash
chmod +x scripts/spawn-agent.sh scripts/send-to-agent.sh scripts/kill-agent.sh scripts/kill-all-agents.sh scripts/broadcast.sh scripts/list-agents.sh
```

> **Approval Tip:** If you are running with an approval policy that still prompts for shell commands, batch similar operations into a single request (for example, spawning multiple agents within one `for` loop) so you only ask for permission once instead of dozens of times.

---

## 🚀 Spawning Child Agents

Any Codex CLI agent running inside a tmux window may spawn others.

### Example (from terminal or Codex CLI):

```bash
./scripts/spawn-agent.sh agent42 ./src/agent
```

This:

* Creates a tmux window named `agent42`
* Changes directory to `./src/agent`
* Runs `npx codex --full-auto --ask-for-approval never` (uses whatever model you previously selected when you logged in)
* Logs output to `logs/agent42.log`

To spawn with arguments:

```bash
./scripts/spawn-agent.sh planner ./src/ai --plan "design DB layer"
```

Custom arguments inherit `--ask-for-approval never` automatically unless you supply your own `-a/--ask-for-approval` flag.

---

## 📡 Communicating With Agents

Each agent has a dedicated tmux window and a continuously appended log at `logs/<agent>.log`.

### To send a prompt to an agent:

```bash
./scripts/send-to-agent.sh agent42 "Fix the bug in index.js"
```

This leverages `tmux send-keys` to type into the agent's window just as if you were attached.

> **Prompt Size Reminder:** The Codex CLI clamps messages to roughly 1,024 characters. If you need longer instructions, split them across consecutive `scripts/send-to-agent.sh` calls or script a sequence of shorter prompts. The helper script already sends the follow-up newline automatically; only send an extra `C-m` manually if you injected commands via another tool.

### To observe agent output in real time:

```bash
tail -f logs/agent42.log
```

You can script observers, webhooks, or analytic tools around these logs.

---

## 🧠 Autonomy and Orchestration

A Codex CLI agent can:

* Read from the filesystem to decide what tasks to delegate
* Spawn sub-agents using `./scripts/spawn-agent.sh`
* Send messages to sibling or child agents via `./scripts/send-to-agent.sh`
* Monitor logs for coordination
* Build a dynamic swarm

**Example prompt Codex could execute:**

```bash
!./scripts/spawn-agent.sh unit-tester ./src/utils --plan "write tests for string helpers"
!./scripts/send-to-agent.sh unit-tester "Test for edge case in cleanString()"
```

---

## 🧼 Monitoring & Management

### List current agents:

```bash
./scripts/list-agents.sh
```

Outputs:

* Active logs
* tmux window list under `codex-swarm` session

### Stop an agent

```bash
./scripts/kill-agent.sh agent42
```

This cleanly closes the tmux window for `agent42` while leaving peers untouched so the swarm stays stable.

### Broadcast to the swarm

```bash
./scripts/broadcast.sh "Sync status please."
```

Every active agent window (excluding the root control pane) receives the message, enabling quick coordination.

### Kill the entire swarm

```bash
./scripts/kill-all-agents.sh
```

This tears down the `codex-swarm` tmux session, stopping all agents and clearing the orchestration environment in one action.

Append `--purge-logs` if you also want to remove the generated `logs/*.log` files once the swarm is offline.

---

## 🔒 Rules of Engagement

* **Agents must always clean up after themselves** (use `kill-agent.sh` to terminate finished workers)
* **Name conflicts are not resolved** — rerunning with the same agent name will overwrite
* Agents are encouraged to:

	* Log meaningful output
	* Check directory validity before launching
	* Avoid runaway loops that spam the Codex CLI

---

## 💡 Patterns Encouraged

* Spawn specialist agents per module or task
* Monitor logs to determine when agents should be culled or re-tasked
* Use Codex to plan the swarm layout and assign sub-agents
* Allow recursive delegation, where agents spawn their own sub-agents

---

## 🛠 Optional Extensions (future work)

* `swarm-manifest.json`: structured view of agent hierarchy and tasks
* `codex-hive.sh`: bootstrap multiple roles from a manifest

---

## 🧪 Debugging Tips

* If an agent doesn't respond, check:

	* `tmux list-windows -t codex-swarm`
	* `tail -n 20 logs/<agent>.log`
* To restart a broken agent:

	```bash
	tmux kill-window -t codex-swarm:<agent>
	./scripts/spawn-agent.sh <agent> <dir>
	```

### Instrumenting long-running work

For concurrency or throughput analysis, you can log timestamps and word counts directly from the agents:

```bash
date -u +"%Y-%m-%dT%H:%M:%SZ agent42 start" >> articles/timestamps.log
cat <<'EOF' > articles/long-article.md
# Long Article Title
...
EOF
wc -w articles/long-article.md >> articles/wordcounts.log
date -u +"%Y-%m-%dT%H:%M:%SZ agent42 finish" >> articles/timestamps.log
echo "agent42 long-article done" >> articles/concurrency.log
```

This keeps start/finish pairs and makes it easy to derive runtimes for each agent.

---

## 🧬 Example: Full Lifecycle

```bash
./scripts/spawn-agent.sh planner ./src/planner --plan "review architecture"
./scripts/spawn-agent.sh fixer ./src/fixes
./scripts/send-to-agent.sh planner "Analyze ./src/api and delegate fixes"
./scripts/send-to-agent.sh fixer "Apply patch to endpoint validation"
```

Planners and fixers now coordinate in parallel, with live I/O and logs.

---

You're now running a Codex Swarm—self-aware, self-replicating, and ready to build.

Want me to bundle this into a Markdown file and save a local copy for you?