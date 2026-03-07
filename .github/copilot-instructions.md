
# Screeps AI Engineering Instructions (2026)

This file is the authoritative operating guide for contributors and AI agents working in this repository.

## 1) Runtime Architecture

- Main tick orchestration is in [main.js](main.js).
- Per-room execution flow is coordinated through utilities in [utils.js](utils.js), including movement, planning/building helpers, and spawn logic.
- Role dispatch is performed by role key (`creep.memory.role`) mapped to `role.*.run(creep)` handlers.
- Core subsystems:
	- Spawning and room balancing: [utils.js](utils.js)
	- Combat/defense automation: [role.tower.js](role.tower.js), [role.attack.js](role.attack.js)
	- Logistics and energy routing: [role.deliverer.js](role.deliverer.js), [role.link.js](role.link.js)
	- Boosting: [role.boost.js](role.boost.js)
	- Market/economy: [market.js](market.js)
	- Room expansion and remote operations: [room.claim.js](room.claim.js), [room.remoteHarvesting.js](room.remoteHarvesting.js), [role.claim.js](role.claim.js), [role.reserve.js](role.reserve.js), [role.scout.js](role.scout.js)
	- Visual and planning layers: [room.draw.visuals.js](room.draw.visuals.js), [room.planning.js](room.planning.js)
	- Shared prototype extensions: [prototypes.js](prototypes.js)

## 2) Non-Negotiable Engineering Rules

1. Use ES5-compatible JavaScript (no modern syntax unless already in use and verified in runtime).
2. Keep modules in repository root unless loader behavior is explicitly updated.
3. Avoid expensive per-tick CPU operations; gate heavy logic using tick intervals.
8. Never add periodic `console.log` debug logging gated by `Game.time % N`. Each tick is ~4 seconds; such logging is too slow to be useful for debugging and wastes CPU. Use logging on every tick where possible instead
4. Do not overwrite existing memory contracts (`room.memory.*`, `Memory.rooms.*`) without migration logic.
5. Prefer existing prototype accessors from [prototypes.js](prototypes.js) instead of repetitive `find()` calls.
6. For API constants/types, always reference [node_modules/@types/screeps/index.d.ts](../node_modules/@types/screeps/index.d.ts) as the source of truth for type signatures, resource string constants, and structure interfaces.
7. For runtime recipe/component data (e.g. `COMMODITIES[product].components`, `.level`, `.amount`, `.cooldown`), always read from the runtime global constants — never hardcode recipe ingredients, amounts, or level requirements. The typings file only contains type signatures, not the actual values.

## 3) Development Workflow for New Features

When adding or modifying gameplay logic, follow this order:

1. Identify owning module (`role.*`, `room.*`, or `utils.js`).
2. Confirm memory keys and side effects impacted by the change.
3. Keep behavior deterministic and idempotent per tick.
4. Add simple guardrails for missing structures/creeps/rooms.
5. Validate CPU impact and avoid adding repeated expensive scans.
6. Update this instructions file or [backlog.md](backlog.md) if architecture assumptions changed.

## 4) Role System Contract

- Each role module exports `run(creep)`.
- New roles must be wired in:
	- Dispatcher map in [utils.js](utils.js)
	- Spawn decision logic in [utils.js](utils.js)
- Role memory conventions to preserve:
	- `memory.role`
	- `memory.task`
	- Optional route hints such as `memory.preferredSourceId` and `memory.preferredTargetId`

## 5) Hardcoded Values to Review Before Major Changes

- Expansion/claim targets and room priority assumptions in [main.js](main.js).
- Claim sponsor selection thresholds in [room.claim.js](room.claim.js).
- Tower wall/rampart repair caps and opportunistic repair conditions in [role.tower.js](role.tower.js).
- Market transfer/sell/buy thresholds in [market.js](market.js).
- Boost enablement and lab demand behavior in [role.boost.js](role.boost.js).
- Auto-planning/auto-build behavior and flag-based controls in [utils.js](utils.js) and [room.planning.js](room.planning.js).

## 6) Operational Priorities (2026)

1. Stability first: no creep deadlocks, no stuck logistics loops.
2. Economy second: keep energy throughput and terminal/market efficiency high.
3. CPU third: optimize hot paths after behavior correctness is guaranteed.
4. Expansion fourth: remote mining and claim logic should be data-driven when possible.

## 7) Quality Bar for AI-Generated Changes

- Keep patches minimal and targeted.
- Preserve existing naming/style patterns in each file.
- Do not introduce speculative abstractions.
- If a constant exists in Screeps typings, do not duplicate it in docs.
- Prefer concrete, testable acceptance criteria in backlog items.
- Prefer early-return control flow to reduce nestedness; for movement branches around `basic.goTo`, use `if (...) { basic.goTo(...); return; }` instead of `if/else` nesting.

## 8) Immediate Improvement Themes

- Dynamic spawn balancing by room energy capacity and controller level.
- Better target scoring for builders and repair units.
- Smarter recovery after low-energy or emergency states.
- Link and lab orchestration improvements with strict CPU budgeting.
- Remote room prioritization based on risk, yield, and travel cost.

