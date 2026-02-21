var basic = require("role.basic");

/**
 * Handles stuck detection and movement toward a target.
 * Uses PathFinder with weighted wall costs to find optimal paths
 * through defenses, breaking walls step-by-step as needed.
 * @param {Creep} creep
 * @param {RoomObject} target
 * @returns {boolean} true if still moving, false if adjacent
 */
function moveToTargetWithStuckDetection(creep, target) {
    if(target == undefined) {
        return false;
    }
    if (creep.pos.isNearTo(target.pos)) {
        creep.memory._wallBreakMode = false;
        return false;
    }

    // Stuck detection: track previous position and count stuck ticks
    var lastPos = creep.memory._lastPos;
    if (lastPos && lastPos.x === creep.pos.x && lastPos.y === creep.pos.y && lastPos.room === creep.room.name) {
        creep.memory._stuckTicks = (creep.memory._stuckTicks || 0) + 1;
    } else {
        creep.memory._stuckTicks = 0;
    }
    creep.memory._lastPos = { x: creep.pos.x, y: creep.pos.y, room: creep.room.name };

    var isStuck = creep.memory._stuckTicks >= 2;

    // Once in wall-break mode, stay in it until target is reached
    var wallBreakMode = creep.memory._wallBreakMode || false;

    // Enter wall-break mode when stuck or when normal pathing fails
    if (!wallBreakMode && !isStuck) {
        var err = creep.moveTo(target.pos, {
            visualizePathStyle: { stroke: '#1900ff' },
            reusePath: 5
        });
        if (err !== ERR_NO_PATH) {
            return true;
        }
        // ERR_NO_PATH — enter wall-breaking mode
    }

    // Activate and persist wall-break mode
    creep.memory._wallBreakMode = true;

    // Wall-breaking mode: use PathFinder with walls as expensive-but-passable.
    // Cost range scales by HP so the pathfinder routes through the weakest walls.
    var sameRoom = creep.room.name === target.pos.roomName;
    var wallBreakResult = PathFinder.search(creep.pos, { pos: target.pos, range: 1 }, {
        roomCallback: function (roomName) {
            // If target is in the same room, block other rooms so creeps
            // don't leave through exits instead of breaking through walls.
            if (sameRoom && roomName !== creep.room.name) {
                return false;
            }
            var room = Game.rooms[roomName];
            if (!room) return;
            var costs = new PathFinder.CostMatrix;
            // Collect all enemy walls/ramparts to normalize costs by HP
            var allStructs = room.find(FIND_STRUCTURES);
            var wallStructs = [];
            var minHits = Infinity;
            var maxHits = 0;
            for (var si = 0; si < allStructs.length; si++) {
                var st = allStructs[si];
                if (st.structureType === STRUCTURE_WALL ||
                    (st.structureType === STRUCTURE_RAMPART && !st.my)) {
                    wallStructs.push(st);
                    if (st.hits < minHits) minHits = st.hits;
                    if (st.hits > maxHits) maxHits = st.hits;
                }
            }
            var hpRange = maxHits - minHits;
            // Cost range: 10 (weakest wall) to 200 (strongest wall)
            var MIN_COST = 10;
            var MAX_COST = 200;

            allStructs.forEach(function (struct) {
                if (struct.structureType === STRUCTURE_ROAD) {
                    costs.set(struct.pos.x, struct.pos.y, 1);
                } else if (struct.structureType === STRUCTURE_CONTAINER) {
                    // walkable, keep terrain cost
                } else if (struct.structureType === STRUCTURE_RAMPART && struct.my) {
                    // own rampart, walkable
                } else if (struct.structureType === STRUCTURE_WALL ||
                    (struct.structureType === STRUCTURE_RAMPART && !struct.my)) {
                    // Normalize wall cost across min/max HP in this room
                    var normalized = hpRange > 0
                        ? (struct.hits - minHits) / hpRange
                        : 0.5;
                    var hpCost = Math.round(MIN_COST + normalized * (MAX_COST - MIN_COST));
                    costs.set(struct.pos.x, struct.pos.y, hpCost);
                } else {
                    // Other structures (spawns, towers, etc.): impassable
                    costs.set(struct.pos.x, struct.pos.y, 0xff);
                }
            });
            // Treat other creeps as obstacles so attackers spread out
            room.find(FIND_CREEPS).forEach(function (c) {
                if (c.id !== creep.id) {
                    costs.set(c.pos.x, c.pos.y, 0xff);
                }
            });
            return costs;
        },
        plainCost: 2,
        swampCost: 10,
        maxOps: 4000
    });

    if (wallBreakResult.incomplete || wallBreakResult.path.length === 0) {
        // Truly unreachable — fallback
        creep.moveTo(target.pos, {
            visualizePathStyle: { stroke: '#ff0000' },
            reusePath: 0,
            ignoreDestructibleStructures: true
        });
        creep.say('no path');
        return true;
    }

    // Visualize the wall-break path
    var visual = new RoomVisual(creep.room.name);
    for (var i = 0; i < wallBreakResult.path.length - 1; i++) {
        if (wallBreakResult.path[i].roomName === creep.room.name &&
            wallBreakResult.path[i + 1].roomName === creep.room.name) {
            visual.line(wallBreakResult.path[i], wallBreakResult.path[i + 1], {
                color: '#ff7700', lineStyle: 'dashed', opacity: 0.5
            });
        }
    }

    // Follow path step-by-step, attacking any wall/rampart blocking the next tile
    var nextPos = wallBreakResult.path[0];
    var wallToBreak = null;
    if (nextPos.roomName === creep.room.name) {
        var structures = creep.room.lookForAt(LOOK_STRUCTURES, nextPos.x, nextPos.y);
        for (var i = 0; i < structures.length; i++) {
            var s = structures[i];
            if (s.structureType === STRUCTURE_WALL ||
                (s.structureType === STRUCTURE_RAMPART && !s.my)) {
                if (!wallToBreak || s.hits < wallToBreak.hits) {
                    wallToBreak = s;
                }
            }
        }
    }

    if (wallToBreak) {
        if (creep.pos.isNearTo(nextPos)) {
            // Adjacent — attack the wall
            creep.attack(wallToBreak);
            var hitsDisplay = wallToBreak.hits > 1000
                ? Math.ceil(wallToBreak.hits / 1000) + 'k'
                : wallToBreak.hits;
            creep.say('🧱 ' + hitsDisplay);
        } else {
            // Move toward the wall (path to it should be clear since it's the first wall)
            creep.moveTo(nextPos, {
                visualizePathStyle: { stroke: '#ff7700' },
                reusePath: 0,
                range: 1
            });
            creep.say('→🧱');
        }
    } else {
        // Next step clear — move there
        var dir = creep.pos.getDirectionTo(nextPos);
        creep.move(dir);
    }

    return true;
}

var roleAttack = {

    attack: function (creep) {
        var target = undefined;

        if (target == undefined) {
            target = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS,
                {
                    filter: (c) => c.getActiveBodyparts(MOVE) > 0 &&
                        (c.getActiveBodyparts(ATTACK) > 0 || c.getActiveBodyparts(RANGED_ATTACK) > 0)
                });
        }


        if (target == undefined) {
            target = creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES, {
                filter: object => (

                    object.structureType == STRUCTURE_TOWER && object.isActive())
            });
        }

        if (target == undefined) {
            target = creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES, {
                filter: object => (
                    object.structureType == STRUCTURE_SPAWN && object.isActive())
            });
        }

        if (target == undefined) {
            target = creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES, {
                filter: object => (object.isActive() &&
                    (
                        object.structureType == STRUCTURE_LINK ||
                        object.structureType == STRUCTURE_TOWER ||
                        object.structureType == STRUCTURE_SPAWN ||
                        object.structureType == STRUCTURE_EXTENSION))
            });
        }

        if (target == undefined) {
            target = creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES, {
                filter: object => (
                    (object.structureType == STRUCTURE_SPAWN))
            });
        }

        if (target == undefined) {
            target = creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES, {
                filter: object => (
                    (object.structureType == STRUCTURE_EXTENSION))
            });
        }

        if (target == undefined) {
            target = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
        }

        if (target == undefined) {
            target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: object => (
                    object.structureType == STRUCTURE_INVADER_CORE)
            });
        }

        if (target == undefined) {
            target = creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES, {
                filter: object => object.structureType != STRUCTURE_WALL &&
                    object.structureType != STRUCTURE_RAMPART &&
                    (!object.store || object.store.getUsedCapacity() === 0)
            });
        }



        //console.log("attack in room ", creep.room.name, " target ", target);
        //console.log(JSON.stringify(Game.getObjectById("698d574d85ab69eef8dccd67")));


        if (target == undefined) {
            //console.log("no hostile creeps or key structures, attacking walls ", creep.room.name);
            var walls = creep.room.controller.pos.findInRange(FIND_STRUCTURES, 1, {
                filter: object => (
                    object.structureType == STRUCTURE_WALL ||
                    object.structureType == STRUCTURE_RAMPART)
            });

            if (walls.length > 0) {
                var sorted = _.sortBy(walls, c => c.hits);
                target = sorted[0];
            }
        }

        if (target == undefined) {
            var flag = creep.room.find(FIND_FLAGS, { filter: f => f.name.includes("conquer") })[0];

            if (flag) {
                // 
                var structures = creep.room.lookForAt(LOOK_STRUCTURES, flag.pos.x, flag.pos.y);
                if (structures.length > 0) {
                    target = structures[0];
                }
                else
                    target = flag;
            }
        }

        
        //console.log("this room");
        // console.log("attack target ", target, " in room ", creep.room.name);



        if (moveToTargetWithStuckDetection(creep, target)) {
            // Self-heal if damaged

            return true;
        }

        if (target instanceof Flag) {
            if (creep.pos.isNearTo(target.pos)) {
                //target.remove();
                return false;
            }
            else {
                //creep.moveTo(target, { visualizePathStyle: { stroke: '#ff0000' } });
                return true;
            }
        }

        if (!target) {
            console.log("no target to attack in room ", creep.room.name, " recycling ", creep.name);
            basic.recycleCreep(creep);
            return false;
        }

        var err = creep.attack(target);

        if (err == OK) {
            return true;
        }

        creep.say("att err" + err);
        return false;
    },

    /** @param {Creep} creep **/
    run: function (creep) {

        if (!basic.moveToRoom(creep))
            return;

        if (creep.hits < creep.hitsMax) {
            creep.heal(creep);
        }

        if (!creep.memory.attacking) {
            creep.memory.attacking = true;
            creep.say('🚧 attack');
        }

        if (creep.memory.attacking) {
            this.attack(creep);
        }
    }
};

module.exports = roleAttack;