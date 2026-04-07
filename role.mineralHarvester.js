/** @param {Creep} creep **/
var basic = require("role.basic");
var roleMineralHarvester = {

    needHarvester: function (room) {
        if (!room.extractor) {
            return false;
        }

        if (!room.extractor.container) {
            return false;
        }

        var mineral = room.mineral;
        if (!mineral) {
            return false;
        }

        return mineral.mineralAmount > 0;
    },

    runHarvest: function (creep) {
        var mineral = creep.room.mineral;
        if (!mineral || mineral.mineralAmount <= 0) {
            if (creep.store.getUsedCapacity() > 0) {
                creep.memory.task = "deliver";
                return;
            }

            basic.recycleCreep(creep);
            return;
        }

        if (!creep.pos.isNearTo(mineral.pos)) {
            if (creep.fatigue == 0) {
                basic.goTo(creep, mineral, 1, '#ffaa00');
            }
            return;
        }

        var extractor = creep.room.extractor;
        
        if (!extractor || extractor.cooldown != 0) {
            return;
        }

        var harvestCode = creep.harvest(mineral);
        if (harvestCode != OK) {
            creep.say("mnrl " + harvestCode);
        }

        //creep.memory.task = "deliver";
    },

    runDeliver: function (creep) {
        var extractor = creep.room.extractor;
        var target = extractor ? extractor.container : undefined;

        if (!target) {
            creep.say("no where to put");
            return;
        }

        if (!target.pos.isNearTo(creep.pos)) {
            basic.goTo(creep, target, 1, '#ffffff');
            return;
        }

        var resourceType = _.findKey(creep.store, function (v) { return v > 0; });
        if (!resourceType) {
            creep.memory.task = "harvest";
            return;
        }

        var transferCode = creep.transfer(target, resourceType);
        if (transferCode != OK) {
            creep.say("error " + transferCode);
            return;
        }

        if (creep.store.getUsedCapacity() == 0) {
            creep.memory.task = "harvest";
        }
    },

    /** @param {Creep} creep **/
    run: function (creep) {
        if (creep.memory.task == undefined) {
            creep.memory.task = "harvest";
        }

        if (creep.store.getFreeCapacity() <= creep.getActiveBodyparts(WORK) * HARVEST_MINERAL_POWER) {
            creep.memory.task = "deliver";
        }

        if (creep.memory.task == "harvest") {
            roleMineralHarvester.runHarvest(creep);
            return;
        }

        if (creep.memory.task == "deliver") {
            roleMineralHarvester.runDeliver(creep);
            return;
        }        
    }
};

module.exports = roleMineralHarvester;
