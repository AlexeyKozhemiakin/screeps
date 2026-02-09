// Module to format data in memory for use with the https://screepspl.us
// Grafana utility run by ags131.
//
// Installation: Run a node script from https://github.com/ScreepsPlus/node-agent
// and configure your screepspl.us token and Screeps login (if you use Steam,
// you have to create a password on the Profile page in Screeps),
// then run that in the background (e.g., on Linode, AWS, your always-on Mac).
//
// Then, put whatever you want in Memory.stats, which will be collected every
// 15 seconds (yes, not every tick) by the above script and sent to screepspl.us.
// In this case, I call the collect_stats() routine below at the end of every
// trip through the main loop, with the absolute final call at the end of the
// main loop to update the final CPU usage.
//
// Then, configure a Grafana page (see example code) which graphs stuff whichever
// way you like.
//
// This module uses my resources module, which analyzes the state of affairs
// for every room you can see.


function collect_stats_end() {
    for (var name in Memory.creeps) {
        if (!Game.creeps[name]) {
            delete Memory.creeps[name];
            console.log('Clearing non-existing creep memory:', name);
        }
    }

    /*
    for(var name in Memory.rooms) {
        if(!Game.rooms[name]) {
            delete Memory.rooms[name];
            console.log('Clearing non-existing room memory:', name);
        }
    }
    */

    // stats
    for (var roomName in Game.rooms) {
        var n = 30;

        var room = Game.rooms[roomName];
        if (!room.controller)
            continue;

        if (room.memory.controllerProcessStats == undefined) {
            room.memory.controllerProcessStats = new Array();
        }

        var st = room.memory.controllerProcessStats;

        room.memory.controllerProcessStats.push(room.controller.progress);
        if (room.memory.controllerProcessStats.length > n) {
            room.memory.controllerProcessStats.shift();

            if (room.memory.controllerProcessStats.length > n) {
                room.memory.controllerProcessStats.splice(0, room.memory.controllerProcessStats.length - n);
            }
        }

        var should = room.memory.controllerProcessStats[room.memory.controllerProcessStats.length - 1] - room.memory.controllerProcessStats[0];

        var eff = should / ((room.memory.controllerProcessStats.length - 1) * CONTROLLER_MAX_UPGRADE_PER_TICK) * 100;
        if (eff < 0) {
            eff = 0;
        }

        room.memory.controllerEfficiency = eff;

        if (Memory.stats.roomSummary[room.name])
            Memory.stats.roomSummary[room.name].controllerEfficiency = eff;
    }


    Memory.stats.cpu.used = Game.cpu.getUsed(); // AT END OF MAIN LOOP
    writeToSegment();
}
// Update the Memory.stats with useful information for trend analysis and graphing.
// Also calls all registered stats callback functions before returning.
function collect_stats() {

    if (Memory.stats == null) {
        Memory.stats = {};
    }

    Memory.stats = {};
    Memory.stats.tick = Game.time;
    Memory.stats.cpu = Game.cpu;
    Memory.stats.gcl = Game.gcl;

    const memory_used = RawMemory.get().length;

    // console.log('Memory used: ' + memory_used);
    Memory.stats.memory = {
        used: memory_used

        // Other memory stats here?
    };

    Memory.stats.market = {
        credits: Game.market.credits,
        num_orders: Game.market.orders ? Object.keys(Game.market.orders).length : 0,
    };

    Memory.stats.roomSummary = summarize_rooms();
}

// Summarizes the situation in a room in a single object.
// Room can be a string room name or an actual room object.
function summarize_room_internal(room) {
    if (_.isString(room)) {
        room = Game.rooms[room];
    }
    if (room == null) {
        return null;
    }
    if (!room.controller) {
        return null;
    }
    if (room.controller.my == false) {
        return null;
    }
    const controller_level = room.controller.level;
    const controller_progress = room.controller.progress;
    const controller_needed = room.controller.progressTotal;
    const controller_downgrade = room.controller.ticksToDowngrade;
    const controller_blocked = room.controller.upgradeBlocked;
    const controller_safemode = room.controller.safeMode ? room.controller.safeMode : 0;
    const controller_safemode_avail = room.controller.safeModeAvailable;
    const controller_safemode_cooldown = room.controller.safeModeCooldown;

    const energy_avail = room.energyAvailable;
    const energy_cap = room.energyCapacityAvailable;

    const storage_details = room.storage ? room.storage.store : new Object();

    const containers = room.find(FIND_STRUCTURES, { filter: s => s.structureType == STRUCTURE_CONTAINER });
    
    const container_energy = _.sum(containers, c => c.store.energy);
    const container_energy_reduced = _.reduce(containers, (acc, res) => { acc[res.id] = res.store.energy; return acc; }, {});
    const container_details = containers ? _.reduce(containers, (acc, res) => { acc[res.id] = res.store; return acc; }, {}) : {};

    const sources = room.find(FIND_SOURCES);
    const source_energy = _.sum(sources, s => s.energy);
    const source_energy_reduced = _.reduce(sources, (acc, res) => { acc[res.id] = res.energy; return acc; }, {});

    if (!Memory.tmp)
        Memory.tmp = new Object();

    _.forEach(sources, function (source) {
        if (source.ticksToRegeneration == 1)
            Memory.tmp[source.id] = source.energy;
        if (Memory.tmp[source.id] == 5 * HARVEST_POWER)
            Memory.tmp[source.id] = 0; // assume continuous harvesting, 10 == typical energy harvset per sec
    });


    const source_energy_wasted = _.reduce(sources, (acc, source) => { acc[source.id] = Memory.tmp[source.id]; return acc; }, {});
    const source_energy_wasted2 = _.reduce(sources, (acc, source) => 
        { acc[source.id] = 0.1 * source.energy / (source.ticksToRegeneration || 1); return acc; }, {});



    // Real-time ideal diff metric:
    // For each source assume ideal harvesting is 10 per tick
    // so each tick we compare how much is left in the source and the diff from ideal harvesting
    // tickToRegeneration = 0 out of 300 
    // if 0 left then 0% diff, it 3000 left 100% diff, if 1500 left - 50% diff, if 0 left - 0% diff
    // now lets do midpoint calculation
    // if ticksToRegeneration = 150 out of 300 
    // if 1500 left then 0% diff if 1650 left then 10% diff
       
    const source_energy_diff = _.reduce(sources, (acc, source) => {
        var timeElapsed = ENERGY_REGEN_TIME - source.ticksToRegeneration;
        var idealHarvested = timeElapsed * 10;
        var idealLeft = SOURCE_ENERGY_CAPACITY - idealHarvested;
        var diff = (source.energy - idealLeft)/idealHarvested; 
        acc[source.id] = diff ;
        return acc;
    }, {});

    

    const links = room.find(FIND_STRUCTURES, { filter: s => s.structureType == STRUCTURE_LINK && s.my });
    const link_energy = _.sum(links, l => l.energy);
    const link_energy_reduced = _.reduce(links, (acc, res) => { acc[res.id] = res.energy; return acc; }, {});

    const minerals = room.find(FIND_MINERALS);
    const mineral = minerals && minerals.length > 0 ? minerals[0] : null;
    const mineral_type = mineral ? mineral.mineralType : "";
    const mineral_amount = mineral ? mineral.mineralAmount : 0;
    const mineral_ticksToRegeneration = mineral ? mineral.ticksToRegeneration : 0;
    const extractors = room.find(FIND_STRUCTURES, { filter: s => s.structureType == STRUCTURE_EXTRACTOR });
    const num_extractors = extractors.length;

    const has_terminal = room.terminal != null;
    const terminal_details = room.terminal ? room.terminal.store : new Object();

    const creeps = _.filter(Game.creeps, c => c.pos.roomName == room.name && c.my);
    const num_creeps = creeps ? creeps.length : 0;
    const creeps_bodycost = _.sum(creeps, c => _.sum(c.body, part => BODYPART_COST[part.type]));
    const enemy_creeps = room.find(FIND_HOSTILE_CREEPS);
    const creep_energy = _.sum(Game.creeps, c => c.pos.roomName == room.name ? c.store.energy : 0);
    const num_enemies = enemy_creeps ? enemy_creeps.length : 0;

    const spawns = room.find(FIND_MY_SPAWNS);
    const num_spawns = spawns ? spawns.length : 0;
    const spawns_spawning = _.sum(spawns, s => s.spawning ? 1 : 0);

    const towers = room.find(FIND_STRUCTURES, { filter: s => s.structureType == STRUCTURE_TOWER && s.my });
    const num_towers = towers ? towers.length : 0;
    const tower_energy = _.sum(towers, t => t.energy);

    const const_sites = room.find(FIND_CONSTRUCTION_SITES);
    const my_const_sites = room.find(FIND_CONSTRUCTION_SITES, { filter: cs => cs.my });
    const num_construction_sites = const_sites.length;
    const num_my_construction_sites = my_const_sites.length;
    const construction_hits = _.sum(my_const_sites, s => s.progressTotal) - _.sum(my_const_sites, s => s.progress);


    // Get info on all our structures
    // TODO: Split roads to those on swamps vs those on dirt
    const structure_types = new Set(room.find(FIND_STRUCTURES).map(s => s.structureType));
    const structure_info = {};
    for (const s of structure_types) {
        const ss = room.find(FIND_STRUCTURES, { filter: str => str.structureType == s });
        structure_info[s] = {
            count: ss.length,
            min_hits: _.min(ss, 'hits').hits,
            max_hits: _.max(ss, 'hits').hits,
        };
    }
    // console.log(JSON.stringify(structure_info));

    const ground_resources = room.find(FIND_DROPPED_RESOURCES);
    // const ground_resources_short = ground_resources.map(r => ({ amount: r.amount, resourceType: r.resourceType }));
    const reduced_resources = _.reduce(ground_resources, (acc, res) => { acc[res.resourceType] = _.get(acc, [res.resourceType], 0) + res.amount; return acc; }, {});

    // _.reduce([{resourceType: 'energy', amount: 200},{resourceType: 'energy', amount:20}], (acc, res) => { acc[res.resourceType] = _.get(acc, [res.resourceType], 0) + res.amount; return acc; }, {});

    // console.log(JSON.stringify(reduced_resources));

    // Number of each kind of creeps
    // const creep_types = new Set(creeps.map(c => c.memory.role));
    const creep_counts = _.countBy(creeps, c => c.memory.role);

    // Other things we can count:
    // Tower count, energy

    // Other things we can't count but we _can_ track manually:
    // Energy spent on repairs
    // Energy spent on making creeps
    // Energy lost to links

    const cput = room.memory.cputime;

    let retval = {
        room_name: room.name, // In case this gets taken out of context
        controller_level,
        controller_progress,
        controller_needed,
        controller_remaining: controller_needed - controller_progress,
        controller_downgrade,
        controller_blocked,
        controller_safemode,
        controller_safemode_avail,
        controller_safemode_cooldown,
        energy_avail,
        energy_cap,
        source_energy,
        source_energy_reduced,
        source_energy_wasted,
        source_energy_diff,
        minerals: {
            [mineral_type]: mineral_amount
        },
        mineral_amount,
        mineral_ticksToRegeneration,
        num_extractors,
        
        storage_details,
                
        has_terminal,
                
        terminal_details,

        container_energy,
        container_energy_reduced,
        container_details,
        link_energy,
        link_energy_reduced,
        num_creeps,
        creeps_bodycost,
        creep_counts,
        creep_energy,
        num_enemies,
        num_spawns,
        spawns_spawning,
        num_towers,
        tower_energy,
        structure_info,
        num_construction_sites,
        construction_hits,
        ground_resources: reduced_resources,
        cput
    };

    // console.log('Room ' + room.name + ': ' + JSON.stringify(retval));
    return retval;
} // summarize_room

function summarize_rooms() {
    const now = Game.time;

    // First check if we cached it
    if (global.summarized_room_timestamp == now) {
        return global.summarized_rooms;
    }

    let retval = {};

    for (let r in Game.rooms) {
        let summary = summarize_room_internal(Game.rooms[r]);
        if (summary)
            retval[r] = summary;
    }

    global.summarized_room_timestamp = now;
    global.summarized_rooms = retval;

    return retval;
}

function summarize_room(room) {
    if (_.isString(room)) {
        room = Game.rooms[room];
    }
    if (room == null) {
        return null;
    }

    const sr = summarize_rooms();

    return sr[room.name];
}

function writeToSegment() {
    try {

        const STATS_SEGMENT_ID = 50;
        // Initialize segment manager on first run
        if (global.segmentManagerInit === undefined) {
            global.segmentManagerInit = true;
            if (!Memory.segments) {
                Memory.segments = {
                    lastWrite: 0,
                    statsTick: 0
                };
            }
        }

        if (!Memory.stats) {
            return;
        }

        RawMemory.segments[STATS_SEGMENT_ID] = JSON.stringify(Memory.stats);

        // Mark segment for access next tick (for reading)
        RawMemory.setActiveSegments([STATS_SEGMENT_ID]);

        Memory.segments.lastWrite = Game.time;
        //console.log('[Segments] Wrote stats to segment', this.STATS_SEGMENT_ID, 'at tick', Game.time);

    } catch (err) {
        console.log('[Segments] Error writing stats:', err.toString ? err.toString() : err);
    }
}

module.exports = {
    collect_stats,
    collect_stats_end,
    summarize_room,
    summarize_rooms,
};
