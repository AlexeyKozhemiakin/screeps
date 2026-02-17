var basic = require("role.basic");

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
            target = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS);
        }

        if (target == undefined) {
            target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: object => (
                    object.structureType == STRUCTURE_INVADER_CORE)
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

            if (flag)
                target = flag;
        }

        if (!target) {
            console.log("no target to attack in room ", creep.room.name, " recycling ", creep.name);
            //basic.recycleCreep(creep);
            return false;
        }
        //console.log("this room");
        // console.log("attack target ", target, " in room ", creep.room.name);

        if (!creep.pos.isNearTo(target.pos)) {
            // Stuck detection: track previous position and count stuck ticks
            
            var lastPos = creep.memory._lastPos;
            if (lastPos && lastPos.x == creep.pos.x && lastPos.y == creep.pos.y && lastPos.room == creep.room.name) {
                creep.memory._stuckTicks = (creep.memory._stuckTicks || 0) + 1;
            } else {
                creep.memory._stuckTicks = 0;
            }
            creep.memory._lastPos = { x: creep.pos.x, y: creep.pos.y, room: creep.room.name };

            var isStuck = creep.memory._stuckTicks >= 2;

            // If stuck or no path, use ignoreDestructibleStructures to path through walls
            var moveOpts = { visualizePathStyle: { stroke: '#1900ff' }, reusePath: isStuck ? 0 : 5 };
            if (isStuck) {
                moveOpts.ignoreDestructibleStructures = true;
                moveOpts.visualizePathStyle.stroke = '#ff7700';
            }

            var err = creep.moveTo(target.pos, moveOpts);
            if (err == ERR_NO_PATH) {
                err = creep.moveTo(target.pos, { visualizePathStyle: { stroke: '#ff7700' }, ignoreDestructibleStructures: true, reusePath: 0 });
            }

            // Find the next step on the path toward the target to attack in that direction
            if (isStuck) {
                var path = creep.pos.findPathTo(target.pos, { ignoreDestructibleStructures: true, ignoreCreeps: true });
                if (path.length > 0) {
                    var nextStep = new RoomPosition(path[0].x, path[0].y, creep.room.name);
                    var obstacles = nextStep.lookFor(LOOK_STRUCTURES);
                    obstacles = _.filter(obstacles, function (s) {
                        return (s.structureType == STRUCTURE_WALL ||
                            s.structureType == STRUCTURE_RAMPART ||
                            s.structureType == STRUCTURE_ROAD) &&
                            !(s.structureType == STRUCTURE_RAMPART && s.my);
                    });
                    obstacles = _.sortBy(obstacles, function (c) { return c.hits; });
                    if (obstacles.length > 0 && creep.pos.isNearTo(nextStep)) {
                        creep.say("🧱 " + creep.memory._stuckTicks);
                        creep.attack(obstacles[0]);
                    }
                }
            }

            if (OK != err && ERR_NO_PATH != err)
                creep.say("a" + err);

            return true;
        }

        if (target instanceof Flag) {
            if (creep.pos.isNearTo(target.pos)) {
                //target.remove();
                return false;
            }
            else{
                //creep.moveTo(target, { visualizePathStyle: { stroke: '#ff0000' } });
                return true;
            }

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