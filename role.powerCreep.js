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

        var range = POWER_INFO[powerType].range;
        if (!powerCreep.pos.inRangeTo(target, range)) {
            powerCreep.moveTo(target, { visualizePathStyle: { stroke: '#00ff6a' } });
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
            if (!pc.room)
                return null;

            if (pc.room.energyAvailable >= pc.room.energyCapacityAvailable * 0.2)
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