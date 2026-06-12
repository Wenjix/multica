/* All teaching content. Facts and file:line refs verified against the source
   tree at build time (June 2026); lines drift as the code evolves. */

const KANBAN = {
  traditional: {
    note: "Humans assign, humans execute, humans update statuses. The tool is a shared to-do list.",
    cols: [
      { name: "Todo", cards: [
        { id: "MUL-17", title: "Evaluate Redis for caching layer", who: "JY", agent: false },
        { id: "MUL-21", title: "Fix login redirect loop", who: "WF", agent: false } ] },
      { name: "In Progress", cards: [
        { id: "MUL-13", title: "Create analytics dashboard", who: "NY", agent: false } ] },
      { name: "In Review", cards: [
        { id: "MUL-09", title: "Migrate avatars to S3", who: "EV", agent: false } ] },
    ],
  },
  multica: {
    note: "Same board — but db-boy and doc-bot are AI agents. Assigning MUL-21 to db-boy queued a task; a coding tool on a teammate's Mac is doing the work right now, and everyone watches it live.",
    cols: [
      { name: "Todo", cards: [
        { id: "MUL-17", title: "Evaluate Redis for caching layer", who: "JY", agent: false } ] },
      { name: "In Progress", cards: [
        { id: "MUL-21", title: "Fix login redirect loop", who: "🤖", agent: true, working: true },
        { id: "MUL-13", title: "Create analytics dashboard", who: "NY", agent: false } ] },
      { name: "In Review", cards: [
        { id: "MUL-09", title: "Migrate avatars to S3", who: "EV", agent: false },
        { id: "MUL-24", title: "Document the webhook API", who: "🤖", agent: true } ] },
    ],
  },
};

const ENTITIES = {
  member:  { name: "Member", what: "A human in the workspace: a user account plus a role. Members assign work, review agent output, and get inbox notifications.",
    rel: "Can be an issue's <b>assignee</b> (assignee_type = 'member')." },
  agent:   { name: "Agent ✳", what: "An AI teammate. It has a name, an avatar, a system prompt (its standing instructions), attached skills — and it is bound to a Runtime, the place where it physically executes. Agents render purple with a robot icon throughout the UI.",
    rel: "Issue <b>assignee</b> (type 'agent') · executes <b>Tasks</b> · hosted on a <b>Runtime</b> · can lead a <b>Squad</b> · equipped with <b>Skills</b>." },
  squad:   { name: "Squad", what: "A team of agents with a designated leader. Assign an issue to the squad and the leader agent is woken to triage and route the work to the right member.",
    rel: "Issue <b>assignee</b> (type 'squad') · leader_id → <b>Agent</b> (service/issue.go:429 checks the leader's readiness)." },
  issue:   { name: "Issue", what: "The unit of work — title, description, status, priority, labels, comments. The schema twist that defines Multica: the assignee is polymorphic, stored as assignee_type ('member' | 'agent' | 'squad') + assignee_id.",
    rel: "Assigned to <b>Member / Agent / Squad</b> (purple dashed edges) · spawns <b>Tasks</b> · grouped by <b>Project</b> · created by <b>Autopilots</b>." },
  task:    { name: "Task", what: "One execution run: this agent, on this issue, on this runtime. Created 'queued' in the agent task queue, claimed by a daemon, then runs to completed / failed / cancelled. The issue is the conversation; the task is one shift of actual work.",
    rel: "References <b>Agent</b> + <b>Issue</b> + <b>Runtime</b> (service/task.go:466 CreateAgentTask) · lifecycle broadcast as task:* WS events." },
  runtime: { name: "Runtime", what: "A concrete execution slot: one daemon × one coding tool × one workspace. 'db-boy runs Claude Code on Wenjie's Mac mini' is a runtime. Heartbeats keep it alive; 45 silent seconds mark it offline.",
    rel: "Hosts <b>Agents</b> · executes <b>Tasks</b> · registered by a daemon (server/internal/daemon/)." },
  skill:   { name: "Skill", what: "A reusable instruction bundle (SKILL.md + references) injected into an agent's working directory at run time. Each coding tool has its own native skills path — the daemon adapts.",
    rel: "Equips <b>Agents</b> · materialized by execenv during task prep (execenv/execenv.go:167)." },
  autopilot:{ name: "Autopilot", what: "Standing automation: on a schedule or an inbound webhook, it creates issues and/or wakes an agent. 'Every morning at 9, db-boy posts the activation report' is an autopilot.",
    rel: "Creates / triggers <b>Issues</b> and enqueues tasks (service/autopilot.go:241)." },
  project: { name: "Project", what: "A grouping of issues with progress derived from their statuses — plus Resources: typed pointers to a github_repo or a local_directory that tell agents where the code lives.",
    rel: "Groups <b>Issues</b> · its resources decide the working directory for <b>Task</b> execution." },
};

/* lane indices: 0 Browser · 1 Go Server · 2 Postgres · 3 Daemon */
const FLOW_STEPS = [
  { from: 0, to: 0, title: "You assign MUL-123 to db-boy",
    body: "The board updates <em>instantly</em> — before any network call. The mutation patches the Query cache optimistically; if the server later rejects it, the change rolls back.",
    ref: "packages/core (TanStack Query mutation with onMutate rollback)" },
  { from: 0, to: 1, title: "PATCH /issues/MUL-123 — with workspace context",
    body: "The shared ApiClient sends the update. Every request carries the X-Workspace-ID header — multi-tenancy is enforced on every single call, not per page.",
    ref: "packages/core/api/client.ts:258 (class ApiClient → newRequest())" },
  { from: 1, to: 1, title: "Handler validates the assignment",
    body: "Membership middleware has already gated the route. The issue handler verifies the assignee actually exists in this workspace and reconciles the task queue when the assignee changes.",
    ref: "server/internal/handler/issue.go (~L2419 queue reconcile, ~L2475 validation)" },
  { from: 1, to: 1, title: "Should this enqueue work? Two checks",
    body: "maybeEnqueueOnAssign: ① not in Backlog (backlog is a parking lot — pre-assign without executing), ② the agent is <em>ready</em>: not archived and bound to a runtime.",
    ref: "server/internal/service/issue.go:383–420" },
  { from: 1, to: 2, title: "A Task row is born — status: queued",
    body: "EnqueueTaskForIssue inserts into the agent task queue with the issue's priority. Notably, <em>no context snapshot is stored</em> — the agent will fetch fresh data itself at runtime via the multica CLI.",
    ref: "server/internal/service/task.go:430–478 (CreateAgentTask)" },
  { from: 1, to: 0, title: "Broadcast first: task:queued",
    body: "Order matters, and the code says why: the WS broadcast goes out <em>before</em> the daemon is nudged, so no client can ever observe task:dispatch before task:queued. Correctness independent of timing.",
    ref: "server/internal/service/task.go:486–493" },
  { from: 1, to: 3, title: "The daemon hears about the work",
    body: "Each runtime has its own poller (started at a staggered offset so fleets don't stampede), plus a wakeup channel for instant pickup. The daemon dials out over HTTPS — it needs no inbound ports.",
    ref: "server/internal/daemon/daemon.go:1868 (pollLoop), :1984 (runRuntimePoller)" },
  { from: 3, to: 1, title: "Claim — if it fits through two gates",
    body: "The daemon claims the task only if a slot is free: max 20 concurrent tasks per daemon, max 6 per agent. The claim path emits task:dispatch; your UI pill flips straight to “running”.",
    ref: "daemon.go (MaxConcurrentTasks) · use-realtime-sync.ts task:dispatch handler" },
  { from: 3, to: 3, title: "Isolation: a fresh git worktree",
    body: "From a per-repo bare clone, the daemon spawns a dedicated worktree for this task. Two agents in the same repo can never touch each other's files, and checkout is nearly free.",
    ref: "server/internal/daemon/repocache/cache.go:68 (Cache), :397 (CreateWorktree)" },
  { from: 3, to: 3, title: "Context injection: prompt, skills, config",
    body: "execenv prepares the working directory: runtime config, the agent's skills (placed at each tool's native path), project resources, and the task prompt itself.",
    ref: "execenv/execenv.go:167 (Prepare) · runtime_config.go:163 · prompt.go:17 (BuildPrompt)" },
  { from: 3, to: 3, title: "A real coding tool runs",
    body: "runTask launches the agent's tool — Claude Code, Codex, or any of the 12 supported CLIs — inside the worktree. Where supported, the previous session is resumed so follow-ups keep context.",
    ref: "daemon.go:2606 (runTask) · server/pkg/agent/ (one adapter per tool)" },
  { from: 3, to: 1, title: "Output streams home",
    body: "executeAndDrain relays the tool's stream: each message becomes a task:message event; comments and status changes are posted through the same public API humans use. Failures get classified, not swallowed.",
    ref: "daemon.go:3203 (executeAndDrain) · pkg/taskfailure/classify.go:43" },
  { from: 1, to: 2, title: "Comments persist, events fan out",
    body: "The agent's comment lands in Postgres like anyone's. Activity listeners publish comment:created, activity:created, and finally task:completed to every connected client in the workspace.",
    ref: "server/cmd/server/activity_listeners.go (publishActivityEvent)" },
  { from: 1, to: 0, title: "Every screen catches up — by invalidation",
    body: "use-realtime-sync maps the task:* prefix to the right wsId-keyed caches and marks them stale; they refetch authoritative state. The issue sits in In Review with db-boy's summary — watched live by the whole team.",
    ref: "packages/core/realtime/use-realtime-sync.ts:478 (task prefix invalidations)" },
];

const OPT_STEPS = [
  { label: "1 · Patch cache", cls: "now", title: "onMutate — apply locally first",
    body: "The mutation snapshots the current cache, then writes the optimistic value. The UI re-renders immediately — zero perceived latency." },
  { label: "2 · Request in flight", cls: "now", title: "The PATCH travels",
    body: "Meanwhile the request goes out through ApiClient. The user has already moved on; nothing blocks." },
  { label: "3a · Success", cls: "ok", title: "onSettled — invalidate",
    body: "The server agreed. The cache is invalidated and refetches the authoritative row — server truth always wins in the end." },
  { label: "3b · Failure", cls: "fail", title: "onError — roll back",
    body: "The server refused (validation, permissions, conflict). The snapshot from step 1 is restored and the UI shows a toast. No phantom state survives." },
  { label: "4 · Converged", cls: "ok", title: "One source of truth",
    body: "Either way the cache ends up matching the server. Optimism is a UX trick layered on top of correctness, never instead of it." },
];

const PROVIDERS = [
  ["Antigravity", "Google", "yes", "no", ".agents/skills/"],
  ["Claude Code", "Anthropic", "yes", "yes", ".claude/skills/"],
  ["Codex", "OpenAI", "meh", "yes", "$CODEX_HOME/skills/"],
  ["Copilot", "GitHub", "yes", "no", ".github/skills/"],
  ["Cursor", "Anysphere", "meh", "no", ".cursor/skills/"],
  ["Gemini", "Google", "no", "no", ".agent_context/skills/"],
  ["Hermes", "Nous Research", "yes", "yes", ".agent_context/skills/"],
  ["Kimi", "Moonshot", "yes", "yes", ".kimi/skills/"],
  ["Kiro CLI", "Amazon", "yes", "yes", ".kiro/skills/"],
  ["OpenCode", "SST", "yes", "yes", ".opencode/skills/"],
  ["OpenClaw", "Open source", "yes", "yes", ".agent_context/skills/"],
  ["Pi", "Inflection AI", "yes", "no", ".pi/skills/"],
];

const HB_MARKS = [
  { at: 0,   pct: 0,   label: "beat", cls: "beat" },
  { at: 15,  pct: 14,  label: "15s · beat", cls: "beat" },
  { at: 30,  pct: 28,  label: "30s · beat", cls: "beat" },
  { at: 45,  pct: 46,  label: "45s · marked OFFLINE", cls: "alert" },
  { at: 0,   pct: 72,  label: "(2× interval: HTTP fallback beat)", cls: "" },
  { at: 0,   pct: 94,  label: "7 days silent · pruned", cls: "dead" },
];

const TRIGGERS = [
  { key: "assign", label: "Direct assignment", emoji: "🎯",
    body: "The chapter-4 path: set an issue's assignee to an agent (outside Backlog) and a task is enqueued — provided the agent is ready (has a runtime, not archived).",
    flow: ["Issue assigned", "maybeEnqueueOnAssign", "EnqueueTaskForIssue", "queued"],
    ref: "server/internal/service/issue.go:383 · task.go:430" },
  { key: "mention", label: "@mention in a comment", emoji: "💬",
    body: "Write “@db-boy can you check the failing migration?” in any issue comment and the mentioned agent is woken on that issue — whoever it's assigned to. Mentions trigger at comment-creation only; editing a mention in later doesn't re-fire. @all wakes members, never agents.",
    flow: ["comment:created", "computeCommentAgentTriggers", "EnqueueTaskForMention", "queued"],
    ref: "server/internal/handler/comment.go · service/task.go:500" },
  { key: "autopilot", label: "Autopilot (schedule / webhook)", emoji: "⏰",
    body: "Standing automations fire on cron schedules or inbound webhooks (the webhook URL itself is the bearer secret). The trigger creates an issue and routes it — to the agent directly, or through a squad leader.",
    flow: ["cron / webhook", "autopilot run", "EnqueueTaskForIssue | ForSquadLeader", "queued"],
    ref: "server/internal/service/autopilot.go:241–245" },
  { key: "chat", label: "Chat message", emoji: "💭",
    body: "Chat is a direct line to one agent outside any issue — same queue underneath. Each send enqueues a chat task; task:message events stream the response token-by-token into the chat window.",
    flow: ["chat send", "EnqueueChatTask", "task:message stream", "chat:done"],
    ref: "server/internal/integrations/ (chat_service.go) · use-realtime-sync.ts chat handlers" },
  { key: "squad", label: "Squad routing", emoji: "👥",
    body: "Assign an issue to a squad and the leader agent gets the task with routing instructions: triage, pick the right member agent, hand off. A pending-task guard stops duplicate leader wake-ups.",
    flow: ["assigned to squad", "leader readiness check", "EnqueueTaskForSquadLeader", "queued"],
    ref: "server/internal/service/issue.go:422–473" },
];

const STATUS_CHIPS = [
  { name: "Backlog", cls: "s-backlog", arrow: true },
  { name: "Todo", cls: "", arrow: true },
  { name: "In Progress", cls: "", arrow: true },
  { name: "In Review", cls: "", arrow: true },
  { name: "Done", cls: "s-done", arrow: false },
  { name: "Blocked", cls: "s-side", arrow: false, side: true },
  { name: "Cancelled", cls: "s-side", arrow: false, side: true },
];

const QUIZZES = {
  vocab: {
    title: null,
    questions: [
      { q: "An issue's assignee can be…",
        opts: ["Only a member", "A member or an agent", "A member, an agent, or a squad", "Anything with a UUID"],
        a: 2, explain: "assignee_type ∈ {member, agent, squad} + assignee_id — the polymorphic pair (packages/core/types/issue.ts:14)." },
      { q: "What exactly is a Runtime?",
        opts: ["A Docker container in the cloud", "One daemon × one coding tool × one workspace", "A Node.js process", "Another name for an agent"],
        a: 1, explain: "It's the concrete execution slot an agent is bound to — 'Claude Code on Wenjie's Mac mini for workspace X'." },
      { q: "Issue vs Task — which is true?",
        opts: ["They're synonyms", "A task is the conversation; an issue is one run", "An issue is the unit of work; a task is one execution run on it", "Tasks exist only for autopilots"],
        a: 2, explain: "One issue can spawn many tasks: the first run, a follow-up after your comment, a rerun after feedback." },
    ],
  },
  capstone: {
    title: null,
    questions: [
      { q: "Why does the server broadcast task:queued BEFORE nudging the daemon?",
        opts: ["The WS hub is faster", "So clients can never observe task:dispatch before task:queued", "Postgres requires it", "It retries less that way"],
        a: 1, explain: "Publishing in observe-order makes correctness independent of timing — task.go:486 says exactly this." },
      { q: "Why can the daemon run behind any firewall with zero setup?",
        opts: ["It uses UDP hole punching", "The server SSHes in", "It only dials out — polls and claims over HTTPS, no inbound ports", "It requires a VPN"],
        a: 2, explain: "All daemon traffic is outbound HTTPS; the server never connects in." },
      { q: "Two agents work the same repo at once. Why don't they collide?",
        opts: ["A global lock serializes them", "Each task runs in its own git worktree off a shared bare clone", "They use different branches of one checkout", "The server merges their diffs"],
        a: 1, explain: "repocache/cache.go: one bare clone per repo, one worktree per task — isolation by construction." },
      { q: "A WS event arrives: issue:updated. What does the frontend do with the payload?",
        opts: ["Writes it into a Zustand store", "Ignores it", "Marks the matching Query caches stale and refetches", "Patches the DOM directly"],
        a: 2, explain: "WS events are invalidation signals, never store writes — the cache stays the single source of truth." },
      { q: "You assign an agent to a Backlog issue. What happens?",
        opts: ["A task is enqueued immediately", "Nothing executes — backlog is a parking lot", "The agent declines politely", "The issue auto-moves to Todo"],
        a: 1, explain: "shouldEnqueueAgentTask returns false for backlog (issue.go:404) — pre-assign without triggering." },
      { q: "Why is task:message the one event written straight into the cache instead of invalidating?",
        opts: ["It's legacy code", "Invalidating per streamed token would flood the network with refetches", "It's not workspace-scoped", "setQueryData is always preferred"],
        a: 1, explain: "A long agent run streams hundreds of messages; one chosen, commented exception beats hundreds of refetches." },
    ],
  },
};
