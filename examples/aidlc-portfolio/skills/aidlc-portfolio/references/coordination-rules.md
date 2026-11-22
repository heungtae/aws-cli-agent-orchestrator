# Coordination Rules

## Ownership

The portfolio supervisor owns catalog and dispatch state. A child runner owns
one AI-DLC intent and one worktree. The AI-DLC engine owns all child stage
routing and state transitions.

## Parent Lifecycle

The portfolio utility owns parent routing:

`Bootstrap -> Discover -> Confirm -> Plan -> Dispatch -> Integrate -> Learn`

Run `lifecycle status` after startup and callbacks. Advance only to the reported
next phase. Dispatch requires named human acceptance; integration and
completion require every reported blocker to be resolved. Never infer a parent
transition from child AI-DLC state.

## Convergence

Each child submits a structured result before completion. After all sessions
complete, run `convergence check` to compute upstream and downstream impact and
evaluate all eight dependency types. Missing results and incomplete dependency
ordering must be remediated. Unknown, deferred, and breaking findings require a
revision-bound human decision before Learn. Never treat a stale decision as
approval; the utility ignores it when the underlying risk changes.

## Dispatch

Before dispatch:

1. Validate the portfolio.
2. Confirm organization, business outcomes, capabilities, and dependencies
   through `discovery confirm`. Unknown and deferred facts must appear in the
   exact human acceptance lists.
3. Confirm the project and intent are registered.
4. Confirm the intent maps the project to one unique worktree and branch.
5. Check `dependsOn` and catalog dependencies whose `blockingAt` includes
   `dispatch`. A dependency's source project waits for its target project.
6. Confirm no active session already owns the child intent or worktree.
7. Confirm no pending human question packet exists for the child.
8. Run `harness verify` for the exact project and intent.
9. Pass only the relevant business, component, contract, and dependency slice.
10. Recall promoted learnings in the supervisor's own memory scope and render
    the assignment with `dispatch message`, which delivers only the reviewed
    learnings that apply to this project.

Use non-blocking CAO assignment for independent work and pass the registered
absolute worktree as `working_directory`. Do not use CAO's inherited supervisor
directory, and do not use a blocking handoff to serialize work that can run
concurrently.

Record a returned terminal ID with `session update --status active`. If CAO
assignment fails, keep the session pending.

## Human Questions

Generated AI-DLC questions are immutable, human-owned decision points.

1. The runner submits unanswered Markdown with `question submit`; pre-answered
   packets are rejected and the session becomes `waiting`.
2. The supervisor offers Guide, Edit Markdown, or Chat.
3. The supervisor writes human answers verbatim without changing question text.
4. The human reviews and confirms the Markdown in their own terminal with
   `operator-answer.ts`, which records the local OS account and resolves the
   packet. An external human-approval surface may also issue a record for use
   with `question answer`. A chat reply by itself does not issue a record.
   The supervisor and runner must leave confirmation to the human operator.
5. Both resolution paths validate question integrity and require every answer.
   The external path requires a matching, unconsumed approval ID. The
   terminal path binds the approved content to the local operator account.
   An answered packet cannot be resolved again.
6. The runner resumes only after observing the answered packet.

The sample stores approval records in `portfolio/approvals/`. The interactive
prompt is an operator workflow. A process running under the same OS account
can start a pseudo-terminal or write to the workspace. Deployments that need
to enforce a separate human trust boundary require a protected approval
service or records signed with a key outside the agent's reach.

## Shared Memory

Durable portfolio knowledge lives in CAO native memory, written and read
through the `memory_store` / `memory_recall` MCP tools. The supervisor is the
sole authority that promotes a learning into that memory.

1. Runners treat worktree `project.md`/`team.md` as LOCAL scratch and submit
   durable learnings as structured proposals with evidence (`learning propose`).
   There is no dispatch SHA-256 baseline and no canonical-file compare-and-swap.
2. The supervisor reviews proposals (`learning list`) for duplication,
   contradiction, and scope.
3. To accept, the supervisor writes the rule into CAO memory with `memory_store`
   (scope project, memory_type feedback), then records that promotion with
   `learning promote --promoted-by <supervisor> --memory-key <key>`, using the
   key `memory_store` returned. To decline, use `learning reject`.
4. A proposal is reviewed once; a promoted or rejected proposal cannot be
   re-promoted.
5. Integration completion blocks while any proposal is still `pending`.
6. Promoted learnings reach runners in the assignment. CAO resolves a project
   memory scope per terminal, and each runner's worktree resolves its own
   repository's scope, so a runner's `memory_recall` does not return what the
   supervisor promoted. The supervisor recalls in its own scope at dispatch and
   `dispatch message` places the relevant learnings, labelled as data, in the
   runner message. A runner may still recall its own repository's scope.

Per-space worktree memory files no longer block session completion and are not
merged from feature branches. Durable knowledge is inspected with
`memory_recall` in the supervisor's scope, not a git diff. See
[shared-memory.md](shared-memory.md) for the delivery rules and the
`CAO_PROJECT_ID` alternative.

## Contract Changes

A child may identify a shared-contract change but must escalate it before
downstream assumptions change. The supervisor records the proposed revision,
affected intents, compatibility policy, and approval. Resume affected children
only after the decision is durable.

## Recovery

CAO terminals are disposable; AI-DLC state is durable. On terminal loss, inspect
registered worktree and child status, then launch the same runner against the
same intent. Never birth a replacement intent merely because a terminal ended.

Portfolio mutations record the lock owner's process ID and timestamp. A later
mutation rejects a live owner and automatically reclaims a lock whose process
has exited; a newly created lock without valid owner metadata receives a short
grace period before reclamation.
