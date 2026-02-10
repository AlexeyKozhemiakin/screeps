var basic = require("role.basic");

var roleHarvester = {

    

    selectTarget: function (creep) {
        var target;

        if (creep.memory.preferredTargetId) {
            target = Game.getObjectById(creep.memory.preferredTargetId);
        }

        if (creep.memory.preferredSourceId) {
            var source = Game.getObjectById(creep.memory.preferredSourceId);

            var nearbyDeliverers = creep.room.find(FIND_MY_CREEPS, { filter: c => c.memory.role == "deliverer" && c.room.name == creep.room.name && c.memory.preferredSourceId == undefined });

            if (source.storage) {
                target = source.storage;
            }

            if (target == undefined && source.link && source.link.energy != source.link.energyCapacity) {
                target = source.link;
            }

            if (target == undefined && source.container) {

                if (source.container.store.energy == source.container.store.getCapacity()) {
                    // do not harvest to full container
                }
                // pre harvest for builers and upgraders
                // dont do it if there are no other creeps nearby - no one to use it                
                else if(source.container.store.energy < 500){
                    target = source.container;
                }
                else if (creep.room.controller.container && 
                    creep.room.controller.container == target) {
                    target = source.container;
                }
                else if (nearbyDeliverers.length > 0) {
                    target = source.container;
                }
                else if (source.container.isOperating()) {
                    target = source.container;
                }
                else if (creep.room.energyAvailable == creep.room.energyCapacityAvailable) {
                    target = source.container;
                }
            }

            //console.log("locked on " , target);
        }

        //spawn
        if (target == undefined) {
            target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (s) => {
                    return (s.structureType == STRUCTURE_EXTENSION || s.structureType == STRUCTURE_SPAWN) &&
                        s.isActive &&
                        s.energy < s.energyCapacity &&
                        creep.room.energyAvailable <= 800;
                }
            });
        }

        //spawn container
        if (target == undefined) {
            target = creep.room.spawn ? creep.room.spawn.container : null;
        }

        // towers up to 40%
        if (target == undefined) {
            target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (structure.structureType == STRUCTURE_TOWER) && structure.energy < structure.energyCapacity * 0.4;
                }
            });
        }

        // spawning
        if (target == undefined) {
            target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (s) => {
                    return (s.structureType == STRUCTURE_EXTENSION || s.structureType == STRUCTURE_SPAWN) &&
                        s.isActive &&
                        s.energy < s.energyCapacity;
                }
            });
        }

        // towers fully
        if (target == undefined) {
            target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (s) => {
                    return (s.structureType == STRUCTURE_TOWER) &&
                        s.energy < s.energyCapacity * 0.9;
                }
            });
        }

        if (target == undefined) {
            target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (s) => {
                    return ((s.structureType == STRUCTURE_STORAGE) &&
                        s.isActive &&
                        s.store[RESOURCE_ENERGY] < s.storeCapacity);
                }
            });
        }

        // this was causing issues with object cloning\serialization
        // need to explain the logic
        if (target == undefined) {
            target = creep.pos.findClosestByRange(FIND_MY_CREEPS, { 
                filter: c => c.memory.role == "builder" && 
                c.room.name == creep.room.name && c.store.getFreeCapacity() > 0 });
        }

        if (target == undefined) {
            target = creep.pos.findClosestByRange(FIND_MY_CREEPS, {
                 filter: c => c.memory.role == "upgrader" && 
                 c.room.name == creep.room.name && c.store.getFreeCapacity() > 0 });
        }


        return target;
    }
    ,

    runDeliver: function (creep, canMove) {
        var target = this.selectTarget(creep);

        if (target == undefined) {

            creep.say("h: no trgt");
            return;
        }

        var transferCode = creep.transfer(target, RESOURCE_ENERGY);

        if (OK == transferCode) {
            creep.memory.task = "harvest";
        }
        else if (ERR_NOT_IN_RANGE == transferCode) {
            if (canMove) {
                var err = creep.moveTo(target, {
                    visualizePathStyle:
                        { ignoreCreeps: false, stroke: '#ffffff' }
                });
                if (err != OK && err != ERR_TIRED)
                    creep.say(err);
            }
        }
        else if (ERR_NOT_ENOUGH_RESOURCES == transferCode) {
            creep.memory.task = "harvest";
            creep.say("harvest2");
        }
        else {
            creep.say("error " + transferCode);
            console.log(creep.name, "delivery error:", transferCode,
                "target:", target ? target.id || target.name : "undefined");
        }

    },

    runHarvest: function (creep) {
        if (_.sum(creep.store) == creep.store.getCapacity()) {
            creep.memory.task = "deliver";
            return;
        }

        // it will lose 3 steps to pick up but will save time on harvesting
        if (basic.runDropped(creep, 1, RESOURCE_ENERGY, 30))
            return;

        var source = basic.findSource(creep);

        if (!source) {
            creep.say("no source");
            return;
        }

        if (!creep.pos.isNearTo(source.pos)) {
            var ignore = true;
            if (creep.pos.getRangeTo(source.pos) < 5)
                ignore = false;

            if (creep.fatigue == 0) {
                var err = creep.moveTo(source, {
                    visualizePathStyle: { stroke: '#ffffff' },
                    ignoreCreeps: false
                });
                
                if (err == ERR_NO_PATH)
                    err = creep.moveTo(source, {
                        visualizePathStyle: { stroke: '#ffffff' },
                        ignoreCreeps: true
                    });

                if (err != OK && err != ERR_TIRED)
                    creep.say(err);
            }
            return;
        }

        if (source.energy == 0 && source.ticksToRegeneration > 0) {
            basic.repairEmergency(creep, 0.8);
            creep.say("⏱️ " + source.ticksToRegeneration);
            return;
        }

        var code = creep.harvest(source);
        if (OK == code) {

        }
        else {
            creep.say("no " + code);
        }
    },

    /** @param {Creep} creep **/
    run: function (creep) {
        if (creep.memory.task == undefined) {
            creep.memory.task = "harvest";
        }

        

        if (creep.memory.task == "deliver") {
            this.runDeliver(creep, true);

            if (_.sum(creep.store) == 0) {
                creep.memory.task = "harvest";                
            }
        }

        if (creep.memory.task == "harvest") {
            if(!basic.repairEmergency(creep))
                this.runHarvest(creep);

            if (_.sum(creep.store) >= creep.store.getCapacity() * 0.8) //TODO:replace to actual carry capacity and perf during tick see upgrader
            {
                //basic.repairEmergency(creep);
                this.runDeliver(creep, false);
            }
        }


        if (creep.store.getFreeCapacity() == 0) {
            creep.memory.task = "deliver";
        }

    }
};

module.exports = roleHarvester;
