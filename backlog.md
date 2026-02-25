# Engineering Backlog (2026)

This backlog is organized for execution, not brainstorming. Every item includes objective and acceptance criteria.

## P0 — Reliability and Core Throughput

### 1) Fix deliverer mixed-resource deadlock

- **Problem:** Deliverers can stall after energy delivery when carrying additional resource types.
- **Objective:** Ensure deliverers always resolve cargo state and continue useful work.
- **Acceptance Criteria:**
	- Deliverer never remains idle solely due to mixed cargo.
	- Resource handoff behavior is deterministic for energy and non-energy resources.
	- No repeated task flipping between ticks.

### 2) Correct degraded respawn body composition

- **Problem:** Harvesters (and likely other roles) can respawn with reduced body templates and fail to recover after energy stabilizes.
- **Objective:** Reintroduce full intended body templates once room economy can support them.
- **Acceptance Criteria:**
	- Spawn logic scales up from emergency bodies to standard bodies without manual intervention.
	- Recovery occurs within expected ticks after energy capacity/availability recovers.
	- Role minimum viability remains protected during low-energy events.

### 3) Complete link/storage transition cleanup

- **Problem:** Link migration lifecycle is incomplete (second link planning/build and container deprecation behavior).
- **Objective:** Make logistics transition explicit and self-healing.
- **Acceptance Criteria:**
	- Secondary link is planned and utilized according to room stage.
	- Obsolete containers near replaced link/storage routes are removed safely.
	- No energy starvation during transition.

## P1 — Worker Efficiency

### 4) Improve builder target selection

- **Problem:** Builders select suboptimal targets, increasing travel and reducing effective build throughput.
- **Objective:** Prioritize build/repair targets by weighted utility (distance, urgency, strategic value).
- **Acceptance Criteria:**
	- Average builder travel distance decreases in active build phases.
	- Priority structures complete faster under equal energy input.
	- Selection logic remains CPU-light.

## P1 — Boosting System Completion

### Current Status

- `role.boost.js` exists and is integrated.
- Upgrader boosting path is active.
- Lab preparation runs from main loop.
- GH upgrader boost support is implemented.

### 5) Boosting Priority 1 (Operational Baseline)

- Implement deliverer handling for `room.memory.labFillOrders`.
- Auto-supply labs from storage/terminal with demand-aware transfers.
- Validate end-to-end boosting flow in production room(s).

**Acceptance Criteria:**

- Labs are filled without manual intervention when demand is present.
- Upgrader boost cycle completes repeatedly without deadlock.
- Failed boost attempts recover automatically next tick(s).

### 6) Boosting Priority 2 (Role Expansion)

- Add builder boost support (LH chain).
- Add harvester boost support (UO chain).
- Add basic economic guardrails for boost usage.

**Acceptance Criteria:**

- Builder and harvester boosts are opt-in and role-safe.
- Boost consumption follows configured conditions.
- Net room throughput improves in measured windows.

### 7) Boosting Priority 3 (Optimization Layer)

- Enable cost-effectiveness gating for boost decisions.
- Optimize body templates when boosts are available.
- Support multi-boost scenarios where justified.
- Add terminal-based inter-room boost logistics.

**Acceptance Criteria:**

- Boosting is suppressed when economically unfavorable.
- Body composition adapts to boost availability policy.
- Cross-room boost supply avoids starving local economy.

## P2 — Architecture and Observability

### 8) Add backlog hygiene standard

- Every new backlog item must include: Problem, Objective, Acceptance Criteria, Priority.
- Remove solved items or move them to a changelog section monthly.

### 9) Add lightweight KPI tracking

- Track at least: energy throughput, spawn uptime, idle creep ratio, boost utilization.
- Use trend-based decisions for future optimization priorities.

## Definition of Done (Template)

Use this template for every new backlog item.

### Task: <Short Action Title>

- **Priority:** P0 | P1 | P2
- **Owner:** <name>
- **Scope:** <rooms/modules impacted>
- **Problem:** <what fails today>
- **Objective:** <desired outcome>
- **Non-Goals:** <what is explicitly out of scope>

**Acceptance Criteria:**

- <observable behavior change 1>
- <observable behavior change 2>
- <observable behavior change 3>

**Validation Checklist:**

- Deterministic per-tick behavior (no loop thrashing or task flip-flop).
- CPU impact measured and within budget for affected rooms.
- Memory contract preserved (`room.memory.*`, `Memory.rooms.*`) or migrated safely.
- Failure path covered (missing structures/creeps/rooms handled gracefully).
- Rollback path documented (what to disable/revert if behavior regresses).

**Operational Notes:**

- Runtime flags/toggles: <if any>
- Metrics to watch after deploy: <2-4 KPIs>
- Earliest review tick/window: <time horizon>