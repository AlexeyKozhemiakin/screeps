var basic = require("role.basic");

var linkLimitHigh = 490;
var linkLimitLow = 310;

const TERMINAL_WATERMARK = 10000;
const MINERAL_WATERMARK = 1000;
const FACTORY_ENERGY_WATERMARK = 5000;

var roleDeliverer =
{
    runDeliver: function (creep) {
        var target;

        // Use cached target while moving — only recalculate when missing or adjacent
        if (creep.memory.cachedTargetId) {
            target = Game.getObjectById(creep.memory.cachedTargetId);
            if (!target) {
                creep.memory.cachedTargetId = undefined;
            }
        }

        if (!target || creep.pos.isNearTo(target)) {
            target = this.selectTarget(creep);
            creep.memory.cachedTargetId = target ? target.id : undefined;
        }

        if (!target) {
            creep.say("⏳");
            if (creep.name != 'deliverer9637')
                return false;
            if (creep.ticksToLive < 1400 && creep.room.controller.level > 3)
                basic.runRenew(creep);
            return false;
        }

        if (!creep.pos.isNearTo(target)) {
            basic.goTo(creep, target);
            return false;
        }

        //console.log("tr type ", resType);
        //var targetCanTake = tgt.
        var resType = this.storeResType(creep);
        var transferLimit;

        if (target.structureType == STRUCTURE_LINK) {
            if (resType != RESOURCE_ENERGY) {
                return false;
            }

            transferLimit = Math.min(linkLimitHigh - (target.store[RESOURCE_ENERGY] || 0), creep.store[RESOURCE_ENERGY] || 0);

            if (transferLimit <= 0) {
                /*console.log('[deliverer] transferLimit<=0 creep=' + creep.name +
                    ' room=' + creep.room.name +
                    ' link=' + target.id +
                    ' linkEnergy=' + (target.store[RESOURCE_ENERGY] || 0) +
                    ' linkLimitHigh=' + linkLimitHigh +
                    ' creepEnergy=' + (creep.store[RESOURCE_ENERGY] || 0) +
                    ' transferLimit=' + transferLimit);
                    */
                //creep.say('♻︎');
                return false;
            }
        }

        // if transfered all allow go pickup immidiately

        var targetFreeCapacity = target.store.getFreeCapacity(resType);
        var carriedResourceAmount = creep.store[resType];
        var carriedTotalAmount = creep.store.getUsedCapacity();

        var expectedTransferAmount = Math.min(targetFreeCapacity, carriedResourceAmount);
        if (transferLimit != undefined)
            expectedTransferAmount = Math.min(expectedTransferAmount, transferLimit);
        var expectedToBecomeEmpty = (expectedTransferAmount == carriedResourceAmount && expectedTransferAmount == carriedTotalAmount);

        // avoid overfill otherwise base deliverer can compete with  controller container filler
        if (creep.memory.preferredTargetId &&
            target.store[resType] > target.store.getCapacity() - 200 - creep.store.getCapacity()) {
            creep.say("...");
            return false;
        }

        var transferResult;
        if (transferLimit != undefined)
            transferResult = creep.transfer(target, resType, transferLimit);
        else
            transferResult = creep.transfer(target, resType);

        if (OK == transferResult) {
            creep.memory.cachedTargetId = undefined;
            // primary signal: pre-calculated full-offload expectation
            // safety net: actual store state after transfer
            if (expectedToBecomeEmpty || creep.store.getUsedCapacity() == 0) {
                return true;
            }

            return false;
        }
        else if (ERR_NOT_ENOUGH_RESOURCES == transferResult) {
            creep.memory.cachedTargetId = undefined;
            if (creep.store.getFreeCapacity() > 0) {
                creep.memory.task = "pickup";
            }
        }
        else {
            creep.memory.cachedTargetId = undefined;
            creep.say("error" + transferResult);
        }
    },

    storeResType: function (creep) {
        var resType = RESOURCE_ENERGY;
        var key = _.findKey(creep.store, f => f > 0);
        if (key)
            resType = key;
        else if (creep.memory.recentWithdrawResType && creep.memory.task == "deliver")
            resType = creep.memory.recentWithdrawResType;
        return resType;
    },

    selectTarget: function (creep) {
        var target;

        var resType = this.storeResType(creep);

        if (creep.memory.preferredTargetId) {
            target = Game.getObjectById(creep.memory.preferredTargetId);

            if (!target) {
                basic.recycleCreep(creep);
                return;
            }

            if (target.store)
                if (target.store.energy == target.store.getCapacity(RESOURCE_ENERGY))
                    target = undefined;
        }

        if (resType == RESOURCE_ENERGY) {
            // todo remove copypaste

            // towers up to 30%
            if (target == undefined) {
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (s) => {
                        return (s.structureType == STRUCTURE_TOWER) &&
                            s.energy < s.energyCapacity * 0.3;
                    }
                });
            }

            //spawn
            if (target == undefined) {
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (s) => {
                        return (s.structureType == STRUCTURE_EXTENSION ||
                            s.structureType == STRUCTURE_SPAWN) &&
                            s.isActive() &&
                            s.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                    }
                });
            }

            //locallinks
            if (target == undefined) {
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (s) => {
                        return (s.structureType == STRUCTURE_LINK) &&
                            s == creep.room.spawn.link &&
                            creep.room.controller.link != s &&
                            s.store.energy < linkLimitLow;
                    }
                });
            }

            //base  container
            if (target == undefined && creep.room.spawn) {
                if (creep.room.spawn.container &&
                    creep.room.spawn.container.isActive() &&
                    creep.room.spawn.container.store.getFreeCapacity(RESOURCE_ENERGY) > 0)
                    target = creep.room.spawn.container;
            }

            //controller container
            // maybe to controller link as well?
            if (target == undefined) {
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (s) => {
                        return (s.structureType == STRUCTURE_CONTAINER) &&
                            creep.room.controller.container &&
                            s.id == creep.room.controller.container.id &&
                            !creep.room.controller.link &&

                            s.store.energy < 0.2 * s.store.getCapacity(RESOURCE_ENERGY);
                    }
                });
            }

            // towers fully
            if (target == undefined) {
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (s) => {
                        return (s.structureType == STRUCTURE_TOWER) &&
                            s.store.energy <= s.store.getCapacity(RESOURCE_ENERGY) - creep.store.getCapacity();
                    }
                });
            }

            // labs fully
            if (target == undefined) {
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (s) => {
                        return (s.structureType == STRUCTURE_LAB) &&
                            s.store.energy <= s.store.getCapacity(RESOURCE_ENERGY) - creep.store.getCapacity();
                    }
                });
            }

            // factory energy demand (e.g. battery production) - higher priority than terminal
            if (target == undefined && creep.room.memory.factoryDemand) {
                var fd = creep.room.memory.factoryDemand;
                if (fd.type === RESOURCE_ENERGY) {
                    var fdTarget = Game.getObjectById(fd.factoryId);
                    if (fdTarget && fdTarget.isActive() &&
                        (fdTarget.store[RESOURCE_ENERGY] || 0) < fd.amount) {
                        target = fdTarget;
                    }
                }
            }

            // terminal
            if (target == undefined) {
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (s) => {
                        return s.structureType == STRUCTURE_TERMINAL &&
                            s.isActive() &&
                            s.store.energy < TERMINAL_WATERMARK - creep.store.getCapacity();
                    }
                });
            }

            // factory (generic fill)
            if (target == undefined) {
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (s) => {
                        return s.structureType == STRUCTURE_FACTORY &&
                            s.isActive() &&
                            s.store[RESOURCE_ENERGY] < FACTORY_ENERGY_WATERMARK;
                    }
                });
            }


            // need extra condition to avoid pick up and then immediately deliver to storage
            // do not disable - without this link overflow is happening
            // 
            if (target == undefined) {
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (s) => {
                        return ((s.structureType == STRUCTURE_STORAGE) &&
                            s.isActive() &&
                            s.store[RESOURCE_ENERGY] < s.store.getCapacity());
                    }
                });
            }
        }
        else {
            // Labs with mineralDemand matching what we're carrying
            if (target == undefined) {
                var matchingLabs = _.filter(creep.room.labs, (lab) => {
                    return lab.isActive()
                        && (lab.store[lab.mineralType] || 0) < MINERAL_WATERMARK
                        && lab.mineralDemand == resType
                        && (!lab.mineralType || lab.mineralType == resType);
                });
                if (matchingLabs.length > 0) {
                    target = creep.pos.findClosestByPath(matchingLabs);
                }
            }

            // factory resource demand (non-energy ingredient)
            if (target == undefined && creep.room.memory.factoryDemand) {
                var factoryDemand = creep.room.memory.factoryDemand;
                if (factoryDemand.type == resType) {
                    var factoryTarget = Game.getObjectById(factoryDemand.factoryId);
                    if (factoryTarget && factoryTarget.isActive() &&
                        (factoryTarget.store[factoryDemand.type] || 0) < factoryDemand.amount) {
                        target = factoryTarget;
                    }
                }
            }

            if (target == undefined) {
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (s) => {
                        return ((s.structureType == STRUCTURE_TERMINAL) &&
                            s.isActive() &&
                            _.sum(s.store) < s.store.getCapacity() * 0.98);
                    }
                });
            }


            if (target == undefined) {
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (s) => {
                        return ((s.structureType == STRUCTURE_STORAGE) &&
                            s.isActive() &&
                            _.sum(s.store) < s.store.getCapacity());
                    }
                });
            }


        }

        return target;
    },

    runPickup: function (creep) {
        var source;
        var resType = RESOURCE_ENERGY;

        // Use cached source while moving — skip expensive search
        if (creep.memory.cachedSourceId) {
            source = Game.getObjectById(creep.memory.cachedSourceId);
            if (source && !creep.pos.isNearTo(source)) {
                resType = creep.memory.cachedSourceResType || RESOURCE_ENERGY;
                basic.goTo(creep, source, 1, '#ffaa00');
                return;
            }
            // Adjacent or gone — clear cache and do full search
            creep.memory.cachedSourceId = undefined;
            creep.memory.cachedSourceResType = undefined;
            source = undefined;
        }

        // limiting?
        if (creep.memory.preferredSourceId) {
            source = Game.getObjectById(creep.memory.preferredSourceId);

            if (!source) {
                basic.recycleCreep(creep);
                return;
            }
        }

        if (creep.memory.preferredResourceType) {
            resType = creep.memory.preferredResourceType;
        }
        else {
            if (source) {
                var keys = _.findKey(source.store, f => f > 0);
                if (keys)
                    resType = keys;
            }
        }


        //console.log("withdraw type ", resType);

        // commented a few times back and forth as creep was harvesting a controller container far away
        // special case for containers near source & controller when they are near base

        if (source == undefined) {
            source = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: o => (o.structureType == STRUCTURE_CONTAINER)
                    && o.store[resType] > creep.store.getCapacity() &&
                    o == creep.room.controller.container &&
                    o.isNearBase &&
                    o.store[resType] > 1800
            });
        }


        //locallinks
        if (source == undefined) {
            if (creep.room.spawn.link && creep.room.spawn.link.energy > linkLimitHigh)
                source = creep.room.spawn.link;
        }

        // do minerals only after room is filled
        if(creep.room.name == "E51S24")
            console.log("pickup source ", source, " resType ", resType, creep.room.energyAvailable);
        
        if (creep.room.energyAvailable > 0.9 * creep.room.energyCapacityAvailable) {

            // FIRST PRIORITY (after energy): Remove minerals from labs that shouldn't be there
            // This includes: wrong minerals (mineralDemand != mineralType) and unwanted minerals (no demand set)
            if (source == undefined) {
                var wrongLabs = _.filter(creep.room.labs, (o) => {
                    return o.mineralType &&
                        (o.store[o.mineralType] || 0) > 0 &&
                        (
                            (o.mineralDemand && o.mineralDemand != o.mineralType) ||
                            !o.mineralDemand
                        );
                });
                if (wrongLabs.length > 0) {
                    source = creep.pos.findClosestByRange(wrongLabs);
                }

                if (source) {
                    resType = source.mineralType;
                }
            }

            // Prioritize lab cleanup to unblock reaction target switches.
            // Only generic deliverers (without fixed source) should do this.
            if (source == undefined && !creep.memory.preferredSourceId) {
                var cleanupLabs = _.filter(creep.room.labs, (o) => {
                    return o.mineralType &&
                        (o.store[o.mineralType] || 0) > 0 &&
                        (
                            (o.mineralDemand && o.mineralDemand != o.mineralType) ||
                            !o.mineralDemand
                        );
                });
                if (cleanupLabs.length > 0) {
                    source = creep.pos.findClosestByRange(cleanupLabs);
                }

                if (source) {
                    resType = source.mineralType;
                }
            }


            // Labs with minerals above watermark (take excess back to storage)
            if (source == undefined) {
                var excessLabs = _.filter(creep.room.labs, (o) => {
                    return o.mineralType &&
                        (o.store[o.mineralType] || 0) > MINERAL_WATERMARK + creep.store.getCapacity();
                });
                if (excessLabs.length > 0) {
                    source = creep.pos.findClosestByRange(excessLabs);
                }

                if (source) {
                    resType = source.mineralType;
                }
            }

            // Offload all minerals from storage if terminal exists
            if (source == undefined && creep.room.terminal) {
                source = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: o => {
                        if (o.structureType !== STRUCTURE_STORAGE) return false;
                        // Check if storage has any minerals (any resource that's not energy)
                        return Object.keys(o.store).some(key => key !== RESOURCE_ENERGY && o.store[key] > 0);
                    }
                });

                if (source) {
                    // Find any mineral in storage (not energy)
                    const mineralKey = Object.keys(source.store).find(key => key !== RESOURCE_ENERGY && source.store[key] > 0);
                    if (mineralKey) {
                        resType = mineralKey;
                    }
                }
            }


            // local terminal or storage for mineral
            if (source == undefined) {
                var target = this.selectTarget(creep);
                if (target && target.structureType == STRUCTURE_STORAGE) {
                    var labs = _.filter(creep.room.labs, (lab) => {
                        return lab.isActive() &&
                            (lab.store[lab.mineralType] || 0) < MINERAL_WATERMARK &&
                            lab.mineralDemand;
                    });

                    //console.log("--",labs);
                    labs = _.sortBy(labs, lab => lab.store[lab.mineralType] || 0);
                    //console.log(labs);

                    // Try each lab in priority order until we find one with available source
                    for (let i = 0; i < labs.length && source == undefined; i++) {
                        const lab = labs[i];
                        if (lab && lab.mineralDemand) {
                            const tempResType = lab.mineralDemand;
                            const tempSource = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                                filter: o => (o.structureType == STRUCTURE_TERMINAL || o.structureType == STRUCTURE_STORAGE) && o.store[tempResType] > 0
                            });

                            if (tempSource) {
                                resType = tempResType;
                                source = tempSource;
                            }
                        }
                    }
                }
            }

            // Factory ingredient demand - lowest priority, pull ingredient from terminal/storage
            // For energy: only pull from storage to avoid draining the terminal
            if (source == undefined && creep.room.memory.factoryDemand) {
                var fd = creep.room.memory.factoryDemand;
                var fdFactory = Game.getObjectById(fd.factoryId);
                if (fdFactory && fdFactory.isActive() &&
                    (fdFactory.store[fd.type] || 0) < fd.amount) {
                    var fdSource = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                        filter: function (o) {
                            var allowTerminal = fd.type !== RESOURCE_ENERGY;
                            return (o.structureType == STRUCTURE_STORAGE ||
                                (allowTerminal && o.structureType == STRUCTURE_TERMINAL))
                                && (o.store[fd.type] || 0) > 0;
                        }
                    });
                    if (fdSource) {
                        resType = fd.type;
                        source = fdSource;
                    }
                }
            }

            // Factory output egress - lowest priority, move produced bars to terminal
            if (source == undefined) {
                var factoryEgress = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {
                    filter: function (s) {
                        if (s.structureType !== STRUCTURE_FACTORY) return false;
                        var demand = creep.room.memory.factoryDemand;
                        var demandType = demand ? demand.type : null;
                        return Object.keys(s.store).some(function (key) {
                            return key !== RESOURCE_ENERGY && key !== demandType
                                && s.store[key] > creep.store.getCapacity();;
                        });
                    }
                });
                if (factoryEgress) {
                    var outputKey = Object.keys(factoryEgress.store).find(function (key) {
                        var demand = creep.room.memory.factoryDemand;
                        var demandType = demand ? demand.type : null;
                        return key !== RESOURCE_ENERGY && key !== demandType &&
                            factoryEgress.store[key] > creep.store.getCapacity();
                    });
                    if (outputKey) {
                        resType = outputKey;
                        source = factoryEgress;
                    }
                }
            }
        }

        if (source == undefined && resType == RESOURCE_ENERGY) {
            source = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: o => (o.structureType == STRUCTURE_TERMINAL)
                    && o.store[resType] >= TERMINAL_WATERMARK + creep.store.getCapacity()
            });
        }

        if (source == undefined) {
            source = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: o => (o.structureType == STRUCTURE_STORAGE)
                    && o.store[resType] >= creep.store.getCapacity()
            });
        }

        if (source == undefined) {
            source = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: o => (o.structureType == STRUCTURE_CONTAINER) &&
                    o.store[resType] > 2 * creep.store.getCapacity() &&
                    o.isNearBase &&
                    o != creep.room.controller.container
            });
        }
        if (source == undefined) {
            source = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: o => (o.structureType == STRUCTURE_CONTAINER) &&
                    o.store[resType] > creep.store.getCapacity() &&
                    o.isNearBase &&
                    o != creep.room.controller.container
            });
        }

        // any non near base container
        if (source == undefined) {
            source = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: o => (o.structureType == STRUCTURE_CONTAINER) &&
                    o.store[resType] > 3 * creep.store.getCapacity() &&
                    !o.isNearBase &&
                    o != creep.room.controller.container
            });
        }

        // any container
        if (source == undefined) {
            source = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: o => o.structureType == STRUCTURE_CONTAINER &&
                    o.store[resType] > 500 &&
                    o != creep.room.controller.container
            });
        }

        // nearbase container 
        if (source == undefined) {
            source = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: o => o.structureType == STRUCTURE_CONTAINER &&
                    o.store[resType] > 500 &&
                    o.isNearBase &&
                    o != creep.room.controller.container
            });
        }





        if (!source) {
            creep.say("no source");
            return false;
        }

        // Cache source for next tick while moving
        creep.memory.cachedSourceId = source.id;
        creep.memory.cachedSourceResType = resType;

        if (!creep.pos.isNearTo(source)) {
            basic.goTo(creep, source, 1, '#ffaa00');
            return;
        }

        //attempt to avoid withdraw to 0 base containers
        if (creep.memory.preferredSourceId && resType == RESOURCE_ENERGY && source.store[resType] < 300) {
            var str = ".";
            if (creep.ticksToLive % 3 == 0)
                str = "..";
            else if (creep.ticksToLive % 3 == 1)
                str = "...";


            creep.say(str);
            return false;
        }

        var amnt;

        // take from link only what's above high limit to avoid unnecessary trips
        if (source.structureType == STRUCTURE_LINK) {
            amnt = Math.min(Math.max(0, source.store.energy - linkLimitHigh),
                creep.store.getFreeCapacity());
        }

        var code = creep.withdraw(source, resType, amnt);

        if (OK == code) {
            creep.memory.task = "deliver";
            creep.memory.recentWithdrawResType = resType;
            creep.memory.cachedSourceId = undefined;
            creep.memory.cachedSourceResType = undefined;

            return true;
        }
        else if (code == ERR_FULL) {
            creep.memory.task = "deliver";
            creep.memory.cachedSourceId = undefined;
            creep.memory.cachedSourceResType = undefined;
        }
        else if (code != ERR_NOT_ENOUGH_ENERGY && code != ERR_NOT_ENOUGH_RESOURCES) {
            //console.log("w, ", resType, " ", code, source, creep.room.name);
            creep.say("!" + code);
            creep.memory.cachedSourceId = undefined;
            creep.memory.cachedSourceResType = undefined;
        }

        return false;
    },

    /** @param {Creep} creep **/
    run: function (creep) {
        if (creep.memory.task == undefined) {
            creep.memory.task = "pickup";
        }

        if (creep.memory.task == "recycle")
            basic.recycleCreep(creep);

        if (creep.memory.preferredSourceId == undefined)
            creep.room.visual.circle(creep.pos, { fill: 'transparent', radius: 0.55, stroke: 'orange' });

        if (creep.memory.task == "deliver") {
            var didFullyDeliver = this.runDeliver(creep);

            // if it has multiple materials in store - then pickup again

            // testing this since some were stuck with minerals
            //res = false;

            if (didFullyDeliver) {

                if (creep.ticksToLive < creep.memory.travelTime) {
                    creep.memory.task = "recycle";
                    return;
                }
                creep.memory.task = "pickup";
                creep.memory.recentWithdrawResType = undefined;
                creep.memory.cachedTargetId = undefined;
                if (creep.store.getUsedCapacity() == 0) {
                    if (!creep.memory.preferredSourceId) {
                        if (basic.runDropped(creep, 7, undefined, 50))
                            return;
                    }
                    else
                        if (basic.runDropped(creep, 1, undefined, 50))
                            return;
                }

                var pickupSuccessful = this.runPickup(creep);

                if (pickupSuccessful) {
                    creep.memory.task = "deliver";
                    this.runDeliver(creep);
                }

                return;
            }

            if (creep.store.getUsedCapacity() == 0) {
                creep.memory.task = "pickup";
                creep.memory.recentWithdrawResType = undefined;
                creep.memory.cachedTargetId = undefined;
                return;
            }
        }

        if (creep.memory.task == "pickup") {


            // and there is no other - then take advantage
            if (!creep.memory.preferredSourceId) {
                if (basic.runDropped(creep, 7, undefined, 50))
                    return;
            }
            else
                if (basic.runDropped(creep, 1, undefined, 50))
                    return;

            //otherwise run normal
            if (this.runPickup(creep)) {
                // fast
                creep.memory.task = "deliver";
                this.runDeliver(creep);
                return;
            }
        }
    }
};

module.exports = roleDeliverer;
