
### How this AI base is wired

- Entry loop lives in [main.js](main.js). Every tick it initializes the segment manager once, optionally generates a pixel at bucket cap, then for each room runs `roomMove` → visuals/planning/building → (every 7 ticks) spawning → link/tower logic → records `room.memory.cputime`. Stats are collected via `screepsplus` each tick and written to memory segments via [segment-manager.js](segment-manager.js).
- Roles are dispatched in [utils.js](utils.js) `roomMove()`, which maps `creep.memory.role` to `role.*.run(creep)`. When adding a new role, export a `run` function and register it in that map plus any spawn logic.
- Spawning pipeline is in `utils.roomSpawn()`: picks a free spawn, counts creeps by role in-room, then uses a priority checklist to enqueue bodies (harvesters, upgraders, builders, deliverers, mineralHarvesters, reserve/claim/attack/scout). Optional `spawnOrders` from `roomGetSpawnOrders()` target remote rooms for scout/claim/build/attack.
- Room layout helpers: [room.planning.js](room.planning.js) and [room.draw.visuals.js](room.draw.visuals.js) handle road/structure planning and in-game visuals. Flag `name=debug` enables planning and `name=build` permits construction. `roomAutoBuild()` consumes purple flags with secondary colors to place structures (green=extension, orange=storage, yellow=container, red=tower). Roads, containers, and links are auto-placed around sources/controller/mineral when storage/extractor exist.
- Visuals: [room.draw.visuals.js](room.draw.visuals.js) provides resource/structure badges and overlays for labs, minerals, and other objects. Used by [utils.js](utils.js) and other modules for enhanced in-game feedback.
- Combat/support: [role.tower.js](role.tower.js) prioritizes repairing damaged towers, attacking hostiles, healing creeps, then opportunistic repairs with energy thresholds; wall/rampart cap is currently ~30k hits. [role.link.js](role.link.js) pushes energy toward controller link; if the controller link is full, excess is sent toward storage-link.
- Creep boosting: [role.boost.js](role.boost.js) manages lab-based boosting for upgraders (and future builder/harvester support). Labs are prepared for boosting via `prepareLabs()` (called every tick from main loop). Lab mineral/energy demand is tracked in room memory and visualized. Deliverers auto-fill labs for boosting. Check [node_modules/@types/screeps/index.d.ts](../node_modules/@types/screeps/index.d.ts) for official boost constants and multipliers.
- Market logic: [market.js](market.js) now includes auto-generated production goals, arbitrage, buy/sell order management, and resource sharing between rooms. Labs and terminals are coordinated for efficient mineral flow and boosting support.
- Resource/telemetry: [resources.js](resources.js) summarizes each room (energy, structures, creep counts, wasted source energy, safemode status, etc.) and caches per tick for stats. Stats are serialized through `segmentManager.writeStats()` for API-rate-friendly transport.
- Prototypes in [prototypes.js](prototypes.js) add getters (`room.spawn`, `room.spawns`, `room.towers`, `room.links`, `room.labs`, `room.mineral`, etc.) plus `isOperating()` helpers on containers/links/sources and hardcoded `mineralDemand` mappings by structure id. Use these accessors instead of re-querying when possible.
- Role conventions: creeps store routing in `memory.preferredSourceId`/`preferredTargetId` and `memory.role`; tasks like harvest/deliver are toggled via `memory.task`. Deliverers/harvesters leverage `container.isOperating()`; mineral harvesters expect `room.needMineral`/`room.mineral` and extractor/container presence. `role.basic` helpers handle common actions (pickup dropped resources, etc.).
- Room memory: `Room.prototype.config` persists under `Memory.rooms[room].config`; `room.memory.iterator` is reset during spawn; `room.memory.cputime` is set each tick. Avoid clobbering these keys when adding features.
- External services: `screepsplus` (stats), `market` (now active for trading/arbitrage), optional `screeps-profiler` hooks are present but disabled. Global `_loadDebug` is set up to troubleshoot require failures.
- CPU pacing: expensive tasks are throttled (spawning every 7 ticks; planning/building per tick but cheap; link/tower each tick). Keep additions lightweight or gated by modulo checks.
- Defaults/hardcodes: `biggestRoomName` and `roomsToClaim` are hardcoded in [main.js](main.js); mineral demand ids in [prototypes.js](prototypes.js) assume specific shard objects; change cautiously.
- Testing/build: No local build or test harness; code runs directly in Screeps. Keep code ES5-compatible for in-game runtime. Avoid non-ASCII unless required by existing files.
- Module layout: Keep all modules in the repo root. This Screeps setup does not resolve subdirectories in `require()` (e.g., `lib/`), so moving files into folders will break loads unless a bundler is introduced.

### Backlog of Future Improvements

- **Market trading**: Enable and expand market logic for inter-room resource trading.
- **Profiling**: Activate `screeps-profiler` hooks to identify CPU bottlenecks.
- **Combat AI**: Enhance tower targeting, add ranged-attack creep roles, and implement squad coordination.
- **RCL progression**: Automate RCL-gated feature unlocks (e.g., power creeps, labs).
- **Dynamic wall/rampart maintenance**: Adjust rampart caps based on room threat level.
- **Improved pathfinding**: Cache paths or use A* variants for expensive routes.
- **Link/lab networks**: Implement reaction chains and energy distribution across links.
- **Scout/claim automation**: Smarter decision logic for which remote rooms to scout/claim.
- **Memory compression**: Archive old segment data to prevent memory bloat.

If anything here feels incomplete or unclear, tell me which sections to expand or what workflows you want documented further.



### Hardcoded Values and Assumptions

#### Room Hardcodes (complete list):
1. **`roomsToClaim`** in [main.js](main.js) – hardcoded array of target rooms for claiming/expansion. Update this list to match your current expansion strategy. Example: `["E51S23", "E52S23", ...]`.
2. **Sponsor Room Selection** in [room.claim.js](room.claim.js) – sponsor room for remote operations is chosen from rooms with storage and energy > 10,000. Adjust logic if your energy thresholds or room selection criteria change.
3. **Lab/Boosting Demand** – Lab mineral/energy demand is tracked in `room.memory.labDemand` and `room.memory.labEnergyDemand`, set by [role.boost.js](role.boost.js) and used by deliverers. No hardcoded lab IDs, but logic expects labs to exist and be accessible.
4. **Room Layout Defaults** in [utils.js](utils.js) – `roomPlan()` and `roomAutoBuild()` assume standard source/controller/mineral placement; customize via flags if needed. Visuals and planning are handled in [room.draw.visuals.js](room.draw.visuals.js).
5. **Remote Room Targets** – Remote harvesting and spawn logic in [room.remoteHarvesting.js](room.remoteHarvesting.js) and [main.js](main.js) reference room names and configs. Update `parentRoom.config.remoteHarvest` as needed for your remote mining strategy.
6. **Wall/Rampart Health** in [role.tower.js](role.tower.js) – Wall and rampart repair caps are set in code (e.g., 10,000 for walls, rampart max/50). Adjust as needed for your defense policy.
7. **Link/Container/Extension Placement** – Placement logic for links, containers, and extensions is based on proximity to sources, controller, and spawn. Adjust via planning flags or by editing [room.planning.js](room.planning.js).
8. **Resource Thresholds** – Market and resource sharing logic in [market.js](market.js) uses thresholds (e.g., 100,000 energy for sending, 50,000 for receiving). Adjust in code if your economy changes.
9. **Boosting Compounds** – Only certain boosts are enabled by default (see [role.boost.js](role.boost.js)). To enable more, edit the boostConfigs object.


### Notes on Code Style and Conventions
- **ES5 Compatibility**: Since the code runs directly in Screeps, avoid using ES6+ features unless transpiled. Stick to ES5 syntax for maximum compatibility.
- **Memory Keys**: Be cautious when adding new keys to `room.memory` or `Memory.rooms[room]` to avoid overwriting existing data used by the core logic.
- **API Constants & Type Reference** (CRITICAL PRINCIPLE): **For ANY Screeps API constants, structure costs, spawn requirements, boost values, or type definitions, always reference [node_modules/@types/screeps/index.d.ts](../node_modules/@types/screeps/index.d.ts) directly.** This is the single authoritative source automatically kept in sync with official Screeps definitions. Examples: BOOSTS constant (line 614+), BODYPART_COST, CONSTRUCTION_COST, REACTION_TIME, all resource constants, structure definitions, etc. Do NOT create duplicate markdown documentation for API constants—always link to or reference node_modules/@types/screeps instead. This ensures consistency across the codebase and prevents drift from official specifications.



### ideas on logic improvements
- When adjusting builder and upgrader counts in [utils.js](utils.js), consider room energy capacity and controller level for more dynamic scaling.
- In [role.builder.js](role.builder.js), the logic for picking up dropped resources can be fine-tuned by adjusting the distance and amount thresholds in `basic.runDropped()`.
- Review spawn body part allocations in [utils.js](utils.js) to optimize for your room's energy availability and desired creep roles.

