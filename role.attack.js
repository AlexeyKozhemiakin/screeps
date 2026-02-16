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

        if (!target) {
            //console.log("no target to attack in room ", creep.room.name, " recycling ", creep.name);
            basic.recycleCreep(creep);
            return false;
        }
        //console.log("this room");
       // console.log("attack target ", target, " in room ", creep.room.name);

        if (!creep.pos.isNearTo(target.pos)) {

            var err = creep.moveTo(target.pos, { visualizePathStyle: { stroke: '#ff0000' } });
            if (err == ERR_NO_PATH)
                err = creep.moveTo(target.pos, { visualizePathStyle: { stroke: '#ff0000' }, ignoreDestructibleStructures: true });

            if (err == OK) {
                //creep.say("w" + err);
                var walls = creep.pos.findInRange(FIND_STRUCTURES, 1, {
                    filter: object => (
                        object.structureType == STRUCTURE_WALL ||
                        object.structureType == STRUCTURE_RAMPART)
                });

                walls = _.sortBy(walls, c => c.hits);
                walls.forEach(wall => {
                    //console.log(`Wall ID: ${wall.id}, Hits: ${wall.hits}`);
                });
                if (walls.length > 0) {
                    creep.say("🧱")
                    creep.attack(walls[0]);
                }
                return true;
            }
            if (OK != err)
                creep.say("a" + err);

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