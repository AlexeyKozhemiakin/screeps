var basic = require("role.basic");

var roleDepositHarvester = {
    runHarvest: function (creep) {


        var deposit = Game.getObjectById(creep.memory.preferredSourceId);
        if (!deposit) {
            if (creep.store.getUsedCapacity() > 0) {
                creep.memory.task = "deliver";
                return;
            }

            basic.recycleCreep(creep);
            return;
        }

        if (!creep.pos.isNearTo(deposit)) {
            if (creep.fatigue == 0)
                creep.moveTo(deposit, { visualizePathStyle: { stroke: '#ffaa00' } });

            return;
        }

        if (deposit.cooldown && deposit.cooldown > 0)
            return;

        var harvestCode = creep.harvest(deposit);
        if (harvestCode != OK)
            creep.say("dep " + harvestCode);
    },

    runDeliver: function (creep) {
        // find nearby deliverers


        var deliverers = creep.pos.findInRange(FIND_MY_CREEPS, 1, {
            filter: c => c.memory.role == "deliverer"
        });

        //console.log("deliverers: " + deliverers.length);
        if (deliverers.length > 0) {
            var resType = _.findKey(creep.store, f => f > 0);
            var transferCode = creep.transfer(deliverers[0], resType);
            if (transferCode == OK) {
                creep.memory.task = "harvest";
            }
            else {
                creep.say("del " + transferCode);
            }
        }




    },

    run: function (creep) {

        if (!basic.moveToRoom(creep))
            return;

        if (creep.memory.task == undefined)
            creep.memory.task = "harvest";

        if(basic.runDropped(creep, 2, RESOURCE_SILICON))
            return;

        if (creep.store.getUsedCapacity() >= 10)
            this.runDeliver(creep);

        if (creep.memory.task == "deliver" && creep.store.getUsedCapacity() == 0)
            creep.memory.task = "harvest";

        if (creep.memory.task == "harvest") {
            this.runHarvest(creep);
            return;
        }

        if (creep.memory.task == "deliver") {
            this.runDeliver(creep);
            return;
        }
    }
};

module.exports = roleDepositHarvester;