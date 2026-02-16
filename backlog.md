## Current Issues

-- Deliverers with multiple types of resources stuck after delivering energy with resource left

-- Builders choose not optimal targets - prioritize closest from energy source

-- Harvesters and probably other low-budget creeps do not recreate with proper parts after energy will restore after problem

-- 2nd link build
-- delete containers after link, storage is built

## Boosting System (In Progress)

✅ Created role.boost.js module for boost management
✅ Integrated boosting into upgrader role
✅ Added lab preparation in main loop
✅ Support for GH (Ghodium Hydride) upgrader boosts
✅ Created comprehensive BOOSTING_PLAN.md documentation

### TODO: Boosting Priority 1
-- Implement deliverer logic to handle room.memory.labFillOrders
-- Auto-fill labs with boost minerals from terminal/storage
-- Test boosting in E56S23 with live upgraders

### TODO: Boosting Priority 2  
-- Add builder boosting support (LH compounds)
-- Add harvester boosting support (UO compounds)
-- Cost-benefit analysis for boost selection

### TODO: Boosting Priority 3
-- Smart boosting: only boost when cost-effective
-- Optimize creep bodies for boosting (more WORK parts when boosts available)
-- Multi-boost support (boost multiple body part types)
-- Terminal-based boost distribution between rooms