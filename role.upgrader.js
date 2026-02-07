var basic = require('role.basic');

var roleUpgrader =
{
    runUpgrade: function (creep) {
        if (creep.pos.getRangeTo(creep.room.controller.pos) > 3) {
            if (creep.fatigue == 0)
                creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#ffffff' }, range: 3 });

            return;
        }

        // to avoid overcrowding try to move closer
        if (false)
            if (creep.room.controller.container || creep.room.controller.link || creep.room.controller.storage) {
                if (creep.pos.getRangeTo(creep.room.controller.pos) > 2)
                    creep.moveTo(creep.room.controller, {
                        visualizePathStyle: { stroke: '#ffffff' },
                        range: 1
                    });
            }

        //console.log(creep.room.memory.iterator);
        var parts = creep.getActiveBodyparts(WORK);
        if (creep.room.controller.level == 8 && creep.room.memory.iterator >= CONTROLLER_MAX_UPGRADE_PER_TICK) {
            creep.say("throttled");
            return;
        }

        var code = creep.upgradeController(creep.room.controller);
        creep.room.memory.iterator += parts * UPGRADE_CONTROLLER_POWER;

        if (code != OK) {
            creep.say(code);
        }
    },

    runPickup: function (creep) {
        if (basic.runDropped(creep, 2, RESOURCE_ENERGY, 30))
            return;

        var source;

        // nearby up containers
        if (source == undefined) {

            var nearby = undefined;

            if (nearby == undefined)
                nearby = creep.room.controller.container;

            if (nearby == undefined)
                nearby = creep.room.controller.storage;

            if (nearby == undefined)
                nearby = creep.room.controller.link;

            // this is strange check
            if (nearby != undefined) {
                source = nearby;

                // commented to test - since for storage it was not true

                //if (!source.isOperating()) {
                //    source = undefined;
               // }
            }
        }

        if (source == undefined) {
            source = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (structure) => {
                    return ((structure.structureType == STRUCTURE_CONTAINER ||
                        structure.structureType == STRUCTURE_STORAGE) && 
                        structure.isActive &&
                        structure.store[RESOURCE_ENERGY] > 0);
                }
            });
        }

        if (source == undefined) {
            source = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (structure) => {
                    return ((structure.structureType == STRUCTURE_STORAGE) && 
                    structure.isActive &&
                    structure.store[RESOURCE_ENERGY] > 0);
                }
            });
        }

        if (source != undefined) {
            var err = creep.withdraw(source, RESOURCE_ENERGY);
            if (err == ERR_NOT_IN_RANGE) {
                if (creep.fatigue == 0)
                    creep.moveTo(source, { visualizePathStyle: { stroke: '#0000ff' } });

            }
            else if (OK != err) {
                creep.say(err);
            }
        }
        else {
            creep.memory.upgrading = false;
            source = basic.findSource(creep);

            var err = creep.harvest(source);

            if (err == ERR_NOT_IN_RANGE) {
                if (creep.fatigue == 0)
                    creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
            else if (err == ERR_FULL) {
                upgrading = true;
            }

        }

    },

    run: function (creep) {
        if (!basic.moveToRoom(creep))
            return;

        //console.log("upgrader", creep.name, creep.room.name, creep.store);

        // apparently after fixing this code the auto pick stops working and creep is loosing a step and efficiency
        //if(creep.memory.upgrading && creep.store.energy <= creep.getActiveBodyparts(WORK)*UPGRADE_CONTROLLER_POWER) {
        //    creep.memory.upgrading = false;
        //    creep.say('🔄');
        //}

        // this is need to stop harvesting
        if (!creep.memory.upgrading && _.sum(creep.store) == creep.store.getCapacity()) {
            creep.memory.upgrading = true;
            creep.say('⚡️');
        }


        if (creep.memory.upgrading) {
            basic.repairEmergency(creep);
            this.runUpgrade(creep);


            // why 2?
            if (_.sum(creep.carry) <= creep.getActiveBodyparts(WORK) * UPGRADE_CONTROLLER_POWER) {
                //creep.say("easy");
                this.runPickup(creep);
            }
        }
        else {
            this.runPickup(creep);
        }
    }
};

module.exports = roleUpgrader;