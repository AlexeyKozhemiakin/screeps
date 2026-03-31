<!--
Sync Impact Report
- Version change: 1.0.0 -> 1.0.1
- Modified principles:
	- II. Deterministic Tick Execution & Memory Safety (clarified guard-clause and shared-state initialization style)
	- III. CPU-Budgeted Automation (clarified hot-path candidate selection and prototype accessor preference)
- Added sections:
	- None
- Removed sections:
	- None
- Templates requiring updates:
	- None
- Follow-up TODOs:
	- None
-->

# forSim Screeps AI Constitution

## Core Principles

### I. ES5 Runtime Compatibility
All production code MUST run in the Screeps runtime without transpilation assumptions.
New or changed modules MUST use ES5-compatible JavaScript unless the exact syntax is
already in repository use and verified in the target runtime. Repository-loaded
modules MUST remain in the repository root unless loader behavior is intentionally
updated and documented. Rationale: runtime and loader constraints are part of core
system stability.

### II. Deterministic Tick Execution & Memory Safety
Tick logic MUST be deterministic and idempotent: the same room, creep, or structure
processed twice in a tick MUST not diverge behavior. Changes MUST preserve existing
`room.memory.*`, `Memory.rooms.*`, and role-memory contracts or include explicit
migration logic. New role behavior MUST keep the `run(creep)` contract and update
dispatcher and spawn wiring in `utils.js` when required. Missing game objects MUST
be handled with early returns rather than nested recovery branches. Shared per-tick
global state MUST be initialized once and passed through helpers where practical
instead of being recomputed in multiple hot-path functions. Rationale:
automation failures usually originate from memory drift or non-deterministic state
transitions.

### III. CPU-Budgeted Automation
Hot-path logic MUST minimize CPU cost. Expensive scans, path scoring, planning, and
multi-room evaluation MUST be gated by tick intervals, cached memory, or precomputed
data. Existing helpers in `prototypes.js` MUST be preferred over repeated raw
`find()` calls when equivalent behavior exists. When selecting one target in a
hot path, implementations SHOULD prefer incremental best-candidate comparisons over
building arrays and sorting them unless a full ordered list is required. Periodic debug logging using
`Game.time % N` MUST NOT be added. Rationale: CPU waste directly reduces colony
throughput and obscures real regressions.

### IV. Runtime Truth Over Hardcoding
Screeps runtime globals and typings are the source of truth. API constants,
structure and resource types, and interfaces MUST be taken from
`node_modules/@types/screeps/index.d.ts`; recipe components, amounts, cooldowns, and
factory levels MUST be read from runtime globals such as `COMMODITIES`. Gameplay
classification rules derived from room coordinates or map topology MUST be computed
from parsed room data, not hardcoded room lists. Rationale: hardcoded gameplay data
drifts and causes silent logic errors.

### V. Minimal, Verifiable Changes
Changes MUST be minimal, targeted, and traceable to a feature spec, plan, tasks
file, or backlog item with concrete acceptance criteria. Every gameplay change MUST
identify its owning module, impacted memory keys, validation method, CPU impact
expectation, and rollback or disable path when risk is non-trivial. Reviewers MUST
reject speculative abstractions and unrelated refactors. Rationale: small validated
changes are safer in a persistent autonomous simulation.

## Engineering Constraints

- The primary stack is root-level ES5 JavaScript modules executed directly by
	Screeps.
- New subsystems MUST attach to an existing owner module (`role.*`, `room.*`,
	`market.js`, `utils.js`, or `main.js`) before introducing new files.
- Risky automation MUST prefer explicit runtime toggles or room-memory flags when
	practical.
- Backlog and spec artifacts MUST use concrete, testable acceptance criteria rather
	than vague goals.
- Performance-sensitive features MUST define the affected room scope, cadence, and
	data source before implementation begins.
- Style-only refactors in hot-path modules MUST preserve behavior, stay narrowly
	scoped, and avoid mixing unrelated logic changes into the same patch.

## Delivery Workflow & Quality Gates

1. `/speckit.specify` outputs MUST capture user stories, affected modules, impacted
	 memory contracts, edge cases, and measurable success criteria.
2. `/speckit.plan` outputs MUST document the selected module and file touch points,
	 CPU budget or tick cadence, validation approach, and any constitution deviations
	 in the Constitution Check.
3. `/speckit.tasks` outputs MUST organize work by user story and include tasks for
	 memory migration, validation, and rollback or operational checks whenever the
	 change affects persistent state or multi-room automation.
4. Before merge or deploy, the implementation MUST be reviewed for ES5
	 compatibility, memory safety, CPU impact, acceptance-criteria coverage, and
	 rollback readiness.
5. If architecture assumptions change, contributors MUST update
	 `.github/copilot-instructions.md` or `backlog.md` in the same change set.

## Governance

This constitution supersedes ad hoc local practices for planning and implementation.
Amendments MUST be made in `.specify/memory/constitution.md`, include a Sync Impact
Report, and update affected templates in the same change set. Versioning follows
semantic versioning: MAJOR for incompatible principle or governance changes, MINOR
for new principles or materially expanded guidance, and PATCH for clarifications
that do not change required behavior. Every plan, task list, and review MUST
include a constitution compliance check. Any approved exception MUST document the
violated rule, reason, simpler alternative rejected, approver, and expiration or
cleanup plan.

**Version**: 1.0.1 | **Ratified**: 2026-03-28 | **Last Amended**: 2026-03-31
