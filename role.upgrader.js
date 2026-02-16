var basic = require('role.basic');
var roleBoost = require('role.boost');

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

    getSource: function (creep) {
    
        if(creep.memory.preferredSourceId) {
            var source = Game.getObjectById(creep.memory.preferredSourceId);
            if(source && source.store[RESOURCE_ENERGY] > 0){
                creep.memory.preferredSourceId = source.id;
                return source;
            }
        }

        var source = undefined;

        // nearby up containers
        if (source == undefined) {

            var nearby = undefined;

            //var nearby = creep.room.controller.pos.findClosestByRange(FIND_STRUCTURES, {
            //    filter: (structure) => {
            //        return ((
            //            structure == creep.room.controller.container ||
            //            structure == creep.room.controller.storage ||
            //            structure == creep.room.controller.link) &&
            //            //structure.isActive &&
            //            structure.store[RESOURCE_ENERGY] > 0);
            //    }
            //});

            if (nearby == undefined)
                nearby = creep.room.controller.container;

            if (nearby == undefined)
                nearby = creep.room.controller.storage;

            if (nearby == undefined)
                nearby = creep.room.controller.link;

            if(creep.room.name == "E51S24")    
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

        if(source && source.store[RESOURCE_ENERGY] > 0)
            creep.memory.preferredSourceId = source.id;


        return source;
    },

    runPickup: function (creep) {
        if (basic.runDropped(creep, 2, RESOURCE_ENERGY, 30))
            return;

        var source = this.getSource(creep);


        if (source != undefined) {
            if (!creep.pos.isNearTo(source)) {
                if (creep.fatigue == 0)
                    creep.moveTo(source, { visualizePathStyle: { stroke: '#0000ff' } });

                return;
            }
            else {
                var err = creep.withdraw(source, RESOURCE_ENERGY);
                if (OK != err) {
                    if(err != ERR_NOT_ENOUGH_RESOURCES)
                        creep.memory.preferredSourceId = undefined;

                    creep.say(err);
                }

            }
            return;
        }
        else {
            creep.memory.upgrading = false;
            source = basic.findSource(creep);

            var err = creep.harvest(source);

            if (err == ERR_NOT_IN_RANGE) {
                if (creep.fatigue == 0)
                    creep.moveTo(source,  { range:1, visualizePathStyle: { stroke: '#ffaa00' } });
            }
            else if (err == ERR_FULL) {
                upgrading = true;
            }
        }

    },

    run: function (creep) {
        if (!basic.moveToRoom(creep))
            return;

        // Handle boosting for upgraders
        if (roleBoost.needsBoosting(creep)) {
            roleBoost.boostCreep(creep);
            return;
        }

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