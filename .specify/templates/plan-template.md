# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: JavaScript (ES5-compatible Screeps runtime)  
**Primary Dependencies**: Screeps runtime globals, Lodash, repository root modules  
**Storage**: Screeps `Memory`, per-room memory, global memory objects  
**Testing**: Runtime simulation/manual validation plus any feature-specific automation if explicitly added  
**Target Platform**: Screeps MMO/sim runtime
**Project Type**: Persistent game automation AI  
**Performance Goals**: Preserve or improve room throughput within current CPU budget  
**Constraints**: Deterministic per-tick behavior, memory contract safety, root-module loader assumptions  
**Scale/Scope**: Multi-room colony automation with shared role, room, market, and observer systems

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- ES5 compatibility confirmed; any non-ES5 syntax already exists in-repo and is runtime-verified.
- Owning modules and exact files to change are listed; new files are justified against root-module constraints.
- Impacted `room.memory.*`, `Memory.rooms.*`, role memory, and migration strategy are documented.
- CPU-sensitive logic identifies cadence, caching, and hot-path safeguards.
- Runtime constants, typings, and data sources are identified; no hardcoded gameplay tables are introduced.
- Validation plan covers acceptance criteria, rollback or disable path, and post-deploy observation window.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
main.js
utils.js
market.js
prototypes.js
console-commands.js
role.*.js
room.*.js
lib/
profiling/
specs/
```

**Structure Decision**: Prefer targeted edits to existing root modules. Any new
file must name its owning subsystem and justify why an existing `role.*`, `room.*`,
or shared root module is insufficient.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
