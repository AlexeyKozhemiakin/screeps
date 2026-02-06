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
                    object.structureType == STRUCTURE_SPAWN)
            });
        }

        if (target == undefined) {
            target = creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES, {
                filter: object => (
                    object.structureType == STRUCTURE_LINK ||
                    object.structureType == STRUCTURE_TOWER ||
                    object.structureType == STRUCTURE_SPAWN ||
                    object.structureType == STRUCTURE_EXTENSION)
            });
        }
        if (target == undefined) {
            target = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS);
        }

        if (target == undefined) {
            //console.log("no hostile creeps or key structures, attacking walls ", creep.room.name);
            var walls = creep.room.controller.pos.findInRange(FIND_STRUCTURES, 1, {
                filter: object => (
                    object.structureType == STRUCTURE_WALL)
            });

            if (walls.length > 0) {
                var sorted = _.sortBy(walls, c => c.hits);
                target = sorted[0];
            }
        }

        if (!target) {
            basic.recycleCreep(creep);
            return false;
        }
        //console.log("this room");
        //console.log("attack target ", target, " in room ", creep.room.name);

        if (!creep.pos.isNearTo(target.pos)) {
            creep.moveTo(target.pos, { visualizePathStyle: { stroke: '#ff0000' } });
            return true;
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