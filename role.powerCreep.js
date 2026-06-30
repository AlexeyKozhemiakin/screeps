const roleDeliverer = require("./role.deliverer");


const REGEN_SOURCE_SEARCH_RANGE = 10; // TODO this is a hack to avoid going too far away
const REGEN_MINERAL_SEARCH_RANGE = 20; // TODO this is a hack to avoid going too far away

function hasNoActiveEffect(target, powerType) {
    var effects = target.effects || [];
    return !_.some(effects, function (effect) {
        return effect.effect == powerType && effect.ticksRemaining > 15;
    });
}

module.exports = {
    run: function (powerCreep) {
        if (!powerCreep)
            return;

        if (!powerCreep.room)
            return;

        if (this.renew(powerCreep))
            return;

        if (this.enablePowerInRoom(powerCreep))
            return;


        this.generateOps(powerCreep);

        if (this.regenSource(powerCreep))
            return;

        if (this.regenMineral(powerCreep))
            return;

        if (this.operateExtension(powerCreep))
            return;

        if (this.operateFactory(powerCreep))
            return;

        this.actAsDeliverer(powerCreep);
    },

    actAsDeliverer: function (powerCreep) {
        if (!powerCreep.room)
            return;

        roleDeliverer.run(powerCreep);
    },

    generateOps: function (powerCreep) {
        var power = powerCreep.powers[PWR_GENERATE_OPS];
        if (!power)
            return;

        if (power.cooldown > 0)
            return;

        powerCreep.usePower(PWR_GENERATE_OPS);
    },

    applyPower: function (powerCreep, powerType, findTarget, sayText) {
        var power = powerCreep.powers[powerType];
        if (!power)
            return false;

        if (power.cooldown > 0)
            return false;

        var target = findTarget(powerCreep, powerType);
        if (!target)
            return false;

        const opsCost = POWER_INFO[powerType].ops;

        if (powerType == PWR_OPERATE_FACTORY)
            console.log(`Power creep ${powerCreep.name} is trying to use power ${powerType} on target ${target} with ops cost ${opsCost}`);

        if (powerCreep.store[RESOURCE_OPS] < opsCost) {
            var target = powerCreep.room.terminal;

            if(powerCreep.store.getFreeCapacity() < 200)
                roleDeliverer.runDeliver(powerCreep);

            if (!target || target.store[RESOURCE_OPS] < opsCost)
                return false;

            if (!powerCreep.pos.isNearTo(target)) {
                powerCreep.say("need ops");
                if(powerCreep.store.getFreeCapacity() == 0)
                    for (const resourceType in powerCreep.store) { powerCreep.drop(resourceType); }
                powerCreep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
                return true;
            }

            powerCreep.withdraw(target, RESOURCE_OPS, opsCost);
            return true;
        }


        var range = POWER_INFO[powerType].range;
        if (!powerCreep.pos.inRangeTo(target, range)) {
            powerCreep.moveTo(target, { visualizePathStyle: { stroke: '#f900cf' } });
            return true;
        }


        powerCreep.say(sayText || "power");
        return powerCreep.usePower(powerType, target) == OK;
    },

    regenSource: function (powerCreep) {
        return this.applyPower(powerCreep, PWR_REGEN_SOURCE, function (pc, pwr) {
            return pc.pos.findClosestByRange(FIND_SOURCES, {
                filter: function (source) {
                    if (pc.pos.getRangeTo(source) > REGEN_SOURCE_SEARCH_RANGE)
                        return false;

                    return hasNoActiveEffect(source, pwr);
                }
            });
        }, "source ");
    },

    regenMineral: function (powerCreep) {
        return this.applyPower(powerCreep, PWR_REGEN_MINERAL, function (pc, pwr) {
            return pc.pos.findClosestByRange(FIND_MINERALS, {
                filter: function (mineral) {
                    if (pc.pos.getRangeTo(mineral) > REGEN_MINERAL_SEARCH_RANGE)
                        return false;

                    if (mineral.mineralAmount <= 1000)
                        return false;

                    return hasNoActiveEffect(mineral, pwr);
                }
            });
        }, "regen mineral");
    },

    renew: function (powerCreep) {
        if (powerCreep.ticksToLive >= 100)
            return false;

        var powerSpawn = powerCreep.room.powerSpawn;
        if (!powerSpawn || !powerSpawn.isActive())
            return false;

        if (!powerCreep.pos.isNearTo(powerSpawn)) {
            powerCreep.moveTo(powerSpawn, { visualizePathStyle: { stroke: '#ffaa00' } });
            return true;
        }

        powerCreep.say("renew");
        return powerCreep.renew(powerSpawn) == OK;
    },

    operateExtension: function (powerCreep) {
        return this.applyPower(powerCreep, PWR_OPERATE_EXTENSION, function (pc, pwr) {
            if (pc.room.energyAvailable >= pc.room.energyCapacityAvailable * 0.7)
                return null;

            var target = pc.room.storage;
            if (!target || target.store[RESOURCE_ENERGY] < 1000) {
                target = pc.room.terminal;
            }
            if (!target || target.store[RESOURCE_ENERGY] < 1000)
                return null;

            return target;
        }, "fill ext");
    },

    operateFactory: function (powerCreep) {

        return this.applyPower(powerCreep, PWR_OPERATE_FACTORY, function (pc, pwr) {


            if (!pc.room.factory || !pc.room.factory.isActive())
                return null;

            if(pc.room.factory.level == undefined)
                return pc.room.factory
            
            var factoryDemand = pc.room.memory.factoryDemand;
            if (!factoryDemand || !factoryDemand.requiresPowerApplication)
                return null;
                
            if(pc.room.factory.cooldown > 5)
                return null;


            return pc.room.factory;
        }, "factory");
    },

    enablePowerInRoom: function (creep) {

        if (creep.room.controller && creep.room.controller.isPowerEnabled)
            return false;

        console.log("Power creep " + creep.name + " is trying to enable power in room " + creep.room.name);

        if (!creep.pos.isNearTo(creep.room.controller)) {
            creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#ffaa00' } });
            return true;
        }

        creep.enableRoom(creep.room.controller);

        return true;
    }
};