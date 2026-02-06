### How this AI base is wired

- Entry loop lives in [main.js](main.js). Every tick it initializes the segment manager once, optionally generates a pixel at bucket cap, then for each room runs `roomMove` → visuals/planning/building → (every 7 ticks) spawning → link/tower logic → records `room.memory.cputime`. Stats are collected via `screepsplus` each tick and written to memory segments via [segment-manager.js](segment-manager.js).
- Roles are dispatched in [utils.js](utils.js) `roomMove()`, which maps `creep.memory.role` to `role.*.run(creep)`. When adding a new role, export a `run` function and register it in that map plus any spawn logic.
- Spawning pipeline is in `utils.roomSpawn()`: picks a free spawn, counts creeps by role in-room, then uses a priority checklist to enqueue bodies (harvesters, upgraders, builders, deliverers, mineralHarvesters, reserve/claim/attack/scout). Optional `spawnOrders` from `roomGetSpawnOrders()` target remote rooms for scout/claim/build/attack.
- Room layout helpers: `roomPlan()` draws roads/containers using flags; flag `name=debug` enables planning and `name=build` permits construction. `roomAutoBuild()` consumes purple flags with secondary colors to place structures (green=extension, orange=storage, yellow=container, red=tower). Roads, containers, and links are auto-placed around sources/controller/mineral when storage/extractor exist.
- Combat/support: [role.tower.js](role.tower.js) prioritizes repairing damaged towers, attacking hostiles, healing creeps, then opportunistic repairs with energy thresholds; wall/rampart cap is currently ~30k hits. [role.link.js](role.link.js) pushes energy toward controller link; if the controller link is full, excess is sent toward storage-link.
- Resource/telemetry: [resources.js](resources.js) summarizes each room (energy, structures, creep counts, wasted source energy, safemode status, etc.) and caches per tick for stats. Stats are serialized through `segmentManager.writeStats()` for API-rate-friendly transport.
- Prototypes in [prototypes.js](prototypes.js) add getters (`room.spawn`, `room.spawns`, `room.towers`, `room.links`, `room.mineral`, etc.) plus `isOperating()` helpers on containers/links/sources and hardcoded `mineralDemand` mappings by structure id. Use these accessors instead of re-querying when possible.
- Role conventions: creeps store routing in `memory.preferredSourceId`/`preferredTargetId` and `memory.role`; tasks like harvest/deliver are toggled via `memory.task`. Deliverers/harvesters leverage `container.isOperating()`; mineral harvesters expect `room.needMineral`/`room.mineral` and extractor/container presence. `role.basic` helpers handle common actions (pickup dropped resources, etc.).
- Room memory: `Room.prototype.config` persists under `Memory.rooms[room].config`; `room.memory.iterator` is reset during spawn; `room.memory.cputime` is set each tick. Avoid clobbering these keys when adding features.
- External services: `screepsplus` (stats), `market` (currently commented out) for internal trading, optional `screeps-profiler` hooks are present but disabled. Global `_loadDebug` is set up to troubleshoot require failures.
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
1. **`biggestRoomName`** in [main.js](main.js) – hardcoded primary room name; change to match your main room.
2. **`roomsToClaim`** in [main.js](main.js) – hardcoded array of target rooms for claiming; update based on expansion strategy.
3. **Mineral Demand IDs** in [prototypes.js](prototypes.js) – hardcoded structure IDs tied to specific rooms/shards; adjust if room layout differs.
4. **Room Layout Defaults** in [utils.js](utils.js) – `roomPlan()` and `roomAutoBuild()` assume standard source/controller/mineral placement; customize via flags if needed.
5. **Remote Room Targets** in spawn logic – `spawnOrders` from `roomGetSpawnOrders()` may reference hardcoded remote room names for scout/claim/build/attack operations.


### Notes on Code Style and Conventions
- **ES5 Compatibility**: Since the code runs directly in Screeps, avoid using ES6+ features unless transpiled. Stick to ES5 syntax for maximum compatibility.
- **Memory Keys**: Be cautious when adding new keys to `room.memory` or `Memory.rooms[room]` to avoid overwriting existing data used by the core logic.



### ideas on logic improvements
- When adjusting builder and upgrader counts in [utils.js](utils.js), consider room energy capacity and controller level for more dynamic scaling.
- In [role.builder.js](role.builder.js), the logic for picking up dropped resources can be fine-tuned by adjusting the distance and amount thresholds in `basic.runDropped()`.
- Review spawn body part allocations in [utils.js](utils.js) to optimize for your room's energy availability and desired creep roles.

