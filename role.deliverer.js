var basic = require("role.basic");
const { runDropped } = require("./role.basic");

var linkLimitHigh = 450;
var linkLimitLow = 110;

const TERMINAL_WATERMARK = 15000;
const MINERAL_WATERMARK = 500;
const FACTORY_ENERGY_WATERMARK = 5000;
const FACTORY_ENERGY_RECOVERY_THRESHOLD = 250000;

var roleDeliverer =
{
    runDeliver: function (creep) {
        var target;

        // Use cached target while moving — only recalculate when missing or adjacent
        var resType = roleDeliverer.storeResType(creep);

        if (creep.memory.cachedTargetId) {
            // Invalidate cache if resource type changed or unknown (stale from before fix)
            if (creep.memory.cachedTargetResType !== resType) {
                creep.memory.cachedTargetId = undefined;
                creep.memory.cachedTargetResType = undefined;
            } else {
                target = Game.getObjectById(creep.memory.cachedTargetId);
                if (!target) {
                    creep.memory.cachedTargetId = undefined;
                    creep.memory.cachedTargetResType = undefined;
                }
            }
        }

        if (!target) {
            target = roleDeliverer.selectTarget(creep);
            creep.memory.cachedTargetId = target ? target.id : undefined;
            creep.memory.cachedTargetResType = target ? resType : undefined;
        }

        if (!target && resType == RESOURCE_ENERGY && creep.store.getUsedCapacity() == (creep.store[RESOURCE_ENERGY] || 0)) {
            var hasMineralDemand = _.some(creep.room.labs, function (lab) {
                return roleDeliverer.labNeedsMineral(lab);
            });

            if (hasMineralDemand) {
                if (creep.room.storage && creep.room.storage.isActive() &&
                    creep.room.storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                    target = creep.room.storage;
                }
                else if (creep.room.terminal && creep.room.terminal.isActive() &&
                    creep.room.terminal.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                    target = creep.room.terminal;
                }
            }
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
            if (target.pos && target.pos.roomName != creep.room.name) {
                basic.moveToRoom(creep, target.pos.roomName, target);
                return false;
            }

            creep.say("🚚");
            basic.goTo(creep, target);
            return false;
        }

        if (creep._transferred) return false;

        var transferLimit;

        if (target.structureType == STRUCTURE_LINK) {
            if (resType != RESOURCE_ENERGY) {
                return false;
            }

            transferLimit = Math.min(linkLimitHigh - (target.store[RESOURCE_ENERGY] || 0), creep.store[RESOURCE_ENERGY] || 0);

            if (transferLimit <= 0) {
                return false;
            }
        }

        // if transfered all allow go pickup immidiately

        var targetFreeCapacity = target.store.getFreeCapacity(resType);
        var carriedResourceAmount = creep.store[resType];
        var carriedTotalAmount = creep.store.getUsedCapacity();

        if (!targetFreeCapacity || !carriedResourceAmount) {
            creep.memory.cachedTargetId = undefined;
            creep.memory.cachedTargetResType = undefined;
            return false;
        }

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
            creep._transferred = true;
            creep.memory.cachedTargetId = undefined;
            creep.memory.cachedTargetResType = undefined;
            // primary signal: pre-calculated full-offload expectation
            // safety net: actual store state after transfer
            if (expectedToBecomeEmpty || creep.store.getUsedCapacity() == 0) {
                return true;
            }

            return false;
        }
        else if (ERR_NOT_ENOUGH_RESOURCES == transferResult) {
            creep.memory.cachedTargetId = undefined;
            creep.memory.cachedTargetResType = undefined;
            if (creep.store.getFreeCapacity() > 0) {
                creep.memory.task = "pickup";
            }
        }
        else if (ERR_FULL == transferResult) {
            creep.memory.cachedTargetId = undefined;
            creep.memory.cachedTargetResType = undefined;
        }
        else {
            creep.memory.cachedTargetId = undefined;
            creep.memory.cachedTargetResType = undefined;
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

    switchToDeliverIfLoaded: function (creep) {
        if (creep.store.getUsedCapacity() > 0 && creep.store.getFreeCapacity() == 0) {
            creep.memory.task = "deliver";
            this.runDeliver(creep);
            return true;
        }

        return false;
    },

    labNeedsMineral: function (lab, resourceType) {
        if (!lab || !lab.isActive() || !lab.mineralDemand)
            return false;

        if (resourceType && lab.mineralDemand != resourceType)
            return false;

        return (!lab.mineralType || lab.mineralType == lab.mineralDemand) &&
            (lab.store[lab.mineralDemand] || 0) < MINERAL_WATERMARK;
    },

    isReservedBoostLab: function (room, lab) {
        return !!(room && room.memory && room.memory.labEnergyDemand && room.memory.labEnergyDemand[lab.id] &&
            lab.mineralDemand && (!lab.mineralType || lab.mineralType == lab.mineralDemand));
    },

    selectTarget: function (creep) {
        var target;

        var resType = this.storeResType(creep);

        if (creep.memory.preferredTargetId) {
            target = Game.getObjectById(creep.memory.preferredTargetId);

            if (!target) {
                creep.memory.task = "recycle";
                return;
            }

            if (target.store && target.pos && target.pos.roomName == creep.room.name)
                if (!target.store.getFreeCapacity(resType)) {
                    target = undefined;
                    return target;
                }
        }

        if (resType == RESOURCE_ENERGY) {
            if (target == undefined) {
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (s) => {
                        return (s.structureType == STRUCTURE_TOWER) &&
                            s.energy < s.energyCapacity * 0.3;
                    }
                });
            }

            //spawn a little bit as first priority
            if (creep.room.energyAvailable < 800)
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
                            s.isNearBase &&
                            s.store.energy < 0.2 * s.store.getCapacity(RESOURCE_ENERGY);
                    }
                });
            }

            // towers fully
            if (target == undefined) {
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (s) => {
                        return (s.structureType == STRUCTURE_TOWER) &&
                            s.store.energy <= s.store.getCapacity(RESOURCE_ENERGY)
                            - Math.min(200, creep.store.getCapacity());
                    }
                });
            }

            // labs fully
            if (target == undefined) {
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (s) => {
                        return (s.structureType == STRUCTURE_LAB) &&
                            s.store.energy <= s.store.getCapacity(RESOURCE_ENERGY)
                            - Math.min(200, creep.store.getCapacity());
                    }
                });
            }

            // power spawn fully
            if (target == undefined) {
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (s) => {
                        return (s.structureType == STRUCTURE_POWER_SPAWN) &&
                            s.store.getFreeCapacity(RESOURCE_ENERGY) > creep.store.getCapacity();
                    }
                });
            }

            // factory energy demand (e.g. battery production) - higher priority than terminal
            if (target == undefined && creep.room.memory.factoryDemand) {
                var fd = creep.room.memory.factoryDemand;
                if (fd.type === RESOURCE_ENERGY) {
                    var fdTarget = creep.room.factory;
                    if (fdTarget && fdTarget.isActive() &&
                        (fdTarget.store[RESOURCE_ENERGY] || 0) < fd.amount + 200) {
                        target = fdTarget;
                    }
                }
            }

            // terminal
            if (target == undefined) {
                target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: (s) => {
                        return s.structureType == STRUCTURE_TERMINAL &&
                            s.isActive() &&
                            s.store[RESOURCE_ENERGY] < TERMINAL_WATERMARK - creep.store.getCapacity();
                    }
                });
            }

            // factory (generic fill)
            if (target == undefined) {
                target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: (s) => {
                        return s.structureType == STRUCTURE_FACTORY &&
                            s.isActive() &&
                            s.store[RESOURCE_ENERGY] < FACTORY_ENERGY_WATERMARK - creep.store.getCapacity();
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

            if (target == undefined && creep.store.getUsedCapacity() == (creep.store[RESOURCE_ENERGY] || 0)) {
                var hasMineralDemand = _.some(creep.room.labs, function (lab) {
                    return roleDeliverer.labNeedsMineral(lab);
                });

                if (hasMineralDemand && creep.room.storage && creep.room.storage.isActive() &&
                    creep.room.storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                    target = creep.room.storage;
                }
            }
        }
        else {
            // Labs with mineralDemand matching what we're carrying
            if (target == undefined) {
                var matchingLabs = _.filter(creep.room.labs, (lab) => {
                    return roleDeliverer.labNeedsMineral(lab, resType);
                });
                if (matchingLabs.length > 0) {
                    target = creep.pos.findClosestByPath(matchingLabs);
                }
            }

            // factory resource demand (non-energy ingredient)
            if (target == undefined && creep.room.memory.factoryDemand) {
                var factoryDemand = creep.room.memory.factoryDemand;
                if (factoryDemand.type == resType) {
                    var factoryTarget = creep.room.factory;
                    if (factoryTarget && factoryTarget.isActive() &&
                        (factoryTarget.store[factoryDemand.type] || 0) < factoryDemand.amount) {
                        target = factoryTarget;
                    }
                }
            }

            // POWER SPAWN
            if (target == undefined && resType == RESOURCE_POWER && creep.room.powerSpawn && creep.room.powerSpawn.isActive()
                && creep.room.powerSpawn.store.getFreeCapacity(RESOURCE_POWER) > 80) {
                target = creep.room.powerSpawn;
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

        if (creep.memory.cachedSourceId) {
            source = Game.getObjectById(creep.memory.cachedSourceId);
            if (source && !creep.pos.isNearTo(source)) {
                resType = creep.memory.cachedSourceResType || RESOURCE_ENERGY;
                if (source.pos && source.pos.roomName != creep.room.name) {
                    basic.moveToRoom(creep, source.pos.roomName, source);
                    return false;
                }

                basic.goTo(creep, source, 1, '#ffaa00');
                return false;
            }

            creep.memory.cachedSourceId = undefined;
            creep.memory.cachedSourceResType = undefined;
            source = undefined;
        }

        // limiting?
        if (creep.memory.preferredSourceId) {
            source = Game.getObjectById(creep.memory.preferredSourceId);

            if (!source) {
                creep.memory.task = "recycle";
                return false;
            }
        }

        if (creep.memory.preferredResourceType) {
            resType = creep.memory.preferredResourceType;

            if (source && source.store && (source.store[resType] || 0) <= 0) {
                var fallbackResType = _.findKey(source.store, function (amount) { return amount > 0; });
                if (fallbackResType)
                    resType = fallbackResType;
            }
        }
        else if (source && source.store) {
            var keys = _.findKey(source.store, function (f) { return f > 0; });
            if (keys)
                resType = keys;
        }

        if (source == undefined) {
            source = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: o => (o.structureType == STRUCTURE_CONTAINER)
                    && o.store[resType] > creep.store.getCapacity()
                    && o == creep.room.controller.container
                    && o.isNearBase
                    && o.store[resType] > 1800
            });
        }


        //locallinks
        if (source == undefined) {
            if (creep.room.spawn.link && creep.room.spawn.link.energy > linkLimitHigh)
                source = creep.room.spawn.link;
        }

        // do minerals only after room is filled
        if (creep.room.energyAvailable > 0.9 * creep.room.energyCapacityAvailable) {

            //console.log("considering mineral pickup for ", creep.name);
            // FIRST PRIORITY (after energy): Remove minerals from labs that shouldn't be there
            // This includes: wrong minerals (mineralDemand != mineralType) and unwanted minerals (no demand set)
            if (source == undefined) {
                var wrongLabs = _.filter(creep.room.labs, (o) => {
                    return o.mineralType &&
                        (o.store[o.mineralType] || 0) > 0 &&
                        ((o.mineralDemand && o.mineralDemand != o.mineralType) || !o.mineralDemand);
                });
                if (wrongLabs.length > 0) {
                    source = creep.pos.findClosestByRange(wrongLabs);
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

            // Prioritize lab cleanup to unblock reaction target switches.
            // Only generic deliverers (without fixed source) should do this.
            if (source == undefined && !creep.memory.preferredSourceId) {
                var cleanupLabs = _.filter(creep.room.labs, (o) => {
                    return o.mineralType &&
                        (o.store[o.mineralType] || 0) > 0 &&
                        ((o.mineralDemand && o.mineralDemand != o.mineralType) || !o.mineralDemand);
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
                        !roleDeliverer.isReservedBoostLab(creep.room, o) &&
                        (o.store[o.mineralType] || 0) > MINERAL_WATERMARK + creep.store.getCapacity();
                });
                if (excessLabs.length > 0) {
                    source = creep.pos.findClosestByRange(excessLabs);
                }

                if (source) {
                    resType = source.mineralType;
                }
            }

            // Power spawn refill - higher priority than generic mineral shuffling
            if (source == undefined && creep.room.powerSpawn && creep.room.powerSpawn.isActive()
                && creep.room.powerSpawn.store.getFreeCapacity(RESOURCE_POWER) > 80) {
                source = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: function (o) {
                        return (o.structureType == STRUCTURE_TERMINAL || o.structureType == STRUCTURE_STORAGE)
                            && (o.store[RESOURCE_POWER] || 0) > 0;
                    }
                });

                if (source) {
                    resType = RESOURCE_POWER;
                }
            }

            if (source == undefined) {
                var labs = _.filter(creep.room.labs, function (lab) {
                    return roleDeliverer.labNeedsMineral(lab);
                });

                for (var i = 0; i < labs.length && source == undefined; i++) {
                    var lab = labs[i];
                    var tempResType = lab.mineralDemand;
                    var tempSource = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                        filter: function (o) {
                            return (o.structureType == STRUCTURE_TERMINAL || o.structureType == STRUCTURE_STORAGE)
                                && (o.store[tempResType] || 0) > 0;
                        }
                    });

                    if (tempSource) {
                        resType = tempResType;
                        source = tempSource;
                    }
                }
            }

            // Factory ingredient demand - lowest priority, pull ingredient from terminal/storage
            // For energy: only pull from storage to avoid draining the terminal
            if (source == undefined && creep.room.memory.factoryDemand) {
                
                var fd = creep.room.memory.factoryDemand;
                var fdFactory = creep.room.factory;
                if (fdFactory && fdFactory.isActive() && (fdFactory.store[fd.type] || 0) < fd.amount) {
                    
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
                var egresSize = 400;
                var getFactoryEgressThreshold = function (resourceType) {
                    if (resourceType === RESOURCE_WIRE || resourceType === RESOURCE_SWITCH ||
                        resourceType === RESOURCE_TRANSISTOR ||
                        resourceType === RESOURCE_MICROCHIP ||
                        resourceType === RESOURCE_CIRCUIT ||
                        resourceType === RESOURCE_DEVICE || resourceType === RESOURCE_COMPOSITE || resourceType === RESOURCE_CRYSTAL || 
                        resourceType === RESOURCE_CELL || resourceType === RESOURCE_PHLEGM || resourceType === RESOURCE_TISSUE || resourceType === RESOURCE_MUSCLE)
                        return 0;

                    if (resourceType === RESOURCE_GHODIUM || resourceType === RESOURCE_UTRIUM_BAR ||
                        resourceType === RESOURCE_LEMERGIUM_BAR || resourceType === RESOURCE_ZYNTHIUM_BAR ||
                        resourceType === RESOURCE_KEANIUM_BAR || resourceType === RESOURCE_OXIDANT ||
                        resourceType === RESOURCE_REDUCTANT || resourceType === RESOURCE_PURIFIER)
                        return 200;

                    return egresSize;
                };

                var factoryEgress = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {
                    filter: function (s) {
                        if (s.structureType !== STRUCTURE_FACTORY) return false;
                        var demand = creep.room.memory.factoryDemand;
                        // Protect all ingredients (not just current demand type)
                        var reserved = demand && demand.ingredients
                            ? demand.ingredients
                            : (demand ? [demand.type] : []);
                        return Object.keys(s.store).some(function (key) {
                            var threshold = getFactoryEgressThreshold(key);
                            return key !== RESOURCE_ENERGY &&
                                reserved.indexOf(key) === -1 &&
                                s.store[key] >= threshold;
                        });
                    }
                });
                if (factoryEgress) {
                    var outputKey = Object.keys(factoryEgress.store).find(function (key) {
                        var demand = creep.room.memory.factoryDemand;
                        var reserved = demand && demand.ingredients
                            ? demand.ingredients
                            : (demand ? [demand.type] : []);
                        var threshold = getFactoryEgressThreshold(key);
                        return key !== RESOURCE_ENERGY &&
                            reserved.indexOf(key) === -1 &&
                            factoryEgress.store[key] > threshold;
                    });
                    if (outputKey) {
                        resType = outputKey;
                        source = factoryEgress;
                    }
                }
            }
        }

        if (source == undefined && resType == RESOURCE_ENERGY) {
            if (creep.room.terminal && creep.room.terminal.isActive() &&
                creep.room.terminal.store[RESOURCE_ENERGY] >= TERMINAL_WATERMARK + creep.store.getCapacity())
                source = creep.room.terminal;
        }

        if (source == undefined && resType == RESOURCE_ENERGY) {
            if (creep.room.factory && creep.room.factory.isActive() &&
                creep.room.factory.store[RESOURCE_ENERGY] >= FACTORY_ENERGY_WATERMARK + creep.store.getCapacity())
                source = creep.room.factory;
        }

        if (source == undefined && resType == RESOURCE_ENERGY) {
            if (creep.room.storage && creep.room.storage.isActive() &&
                creep.room.storage.store[RESOURCE_ENERGY] >= 0)
                source = creep.room.storage;
        }

        if (source == undefined && resType == RESOURCE_ENERGY && creep.room.terminal) {
            var fallbackTarget = roleDeliverer.selectTarget(creep);
            var storageEnergy = creep.room.storage ? (creep.room.storage.store[RESOURCE_ENERGY] || 0) : 0;

            if ((!creep.room.storage || storageEnergy < creep.store.getCapacity()) &&
                (!fallbackTarget || fallbackTarget.structureType != STRUCTURE_TERMINAL)) {
                source = creep.room.terminal;
            }
        }

        if (source == undefined) {
            source = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: o => o.structureType == STRUCTURE_CONTAINER &&
                    o.store[resType] > 0 &&
                    o.isNearBase &&
                    o != creep.room.controller.container
            });
        }

        if (!source) {
            creep.say("no source");
            return false;
        }

        if (!creep.memory.preferredSourceId) {
            creep.memory.cachedSourceId = source.id;
            creep.memory.cachedSourceResType = resType;
        }

        if (source instanceof Deposit) {
            creep.memory.cachedSourceId = undefined;
            creep.memory.cachedSourceResType = undefined;

            var harvesters = source.pos.findInRange(FIND_MY_CREEPS, 3, {
                filter: c => c.memory.role == "depositHarvester" && c.store.getUsedCapacity() > 0
            });

            var depoTarget = source;
            var depoRange = 3;
            if (harvesters.length > 0) {
                depoTarget = harvesters[0];
                depoRange = 1;
            }

            if (basic.runDropped(creep, 50, RESOURCE_SILICON, 6)) {
                return false;
            }

            creep.say("depo");

            if (creep.pos.getRangeTo(depoTarget) > depoRange) {
                if (depoTarget.pos && depoTarget.pos.roomName != creep.room.name) {
                    basic.moveToRoom(creep, depoTarget.pos.roomName, depoTarget);
                    return false;
                }

                creep.moveTo(depoTarget, { range: depoRange, visualizePathStyle: { stroke: '#ffaa00' } });
            }

            return false;
        }

        if (creep.pos.getRangeTo(source) > 1) {
            if (source.pos && source.pos.roomName != creep.room.name) {
                basic.moveToRoom(creep, source.pos.roomName, source);
                return false;
            }

            basic.goTo(creep, source, 1, '#ffaa00');
            return false;
        }

        if (creep._withdrawn) return false;

        var minAmount = 150;
        minAmount = Math.min(minAmount, creep.store.getFreeCapacity());
        minAmount = creep.store.getFreeCapacity();

        if (creep.memory.preferredSourceId && resType == RESOURCE_ENERGY &&
            source.store && source.store[resType] < minAmount) {
            var str = ".";
            if (creep.ticksToLive % 3 == 0)
                str = "..";
            else if (creep.ticksToLive % 3 == 1)
                str = "...";

            creep.say(str);
            return false;
        }

        var amnt;

        if (source.structureType == STRUCTURE_LINK) {
            amnt = Math.min(Math.max(0, source.store.energy - linkLimitLow),
                creep.store.getFreeCapacity());
        }

        if (source.store && source.store.getUsedCapacity() == 0)
            return false;

        var sourceAvailableAmount = source.store ? (source.store[resType] || 0) : 0;
        var freeCapacity = creep.store.getFreeCapacity();
        var expectedWithdrawAmount = Math.min(sourceAvailableAmount, freeCapacity);
        if (amnt != undefined)
            expectedWithdrawAmount = Math.min(expectedWithdrawAmount, amnt);
        var expectedToBecomeFull = expectedWithdrawAmount == freeCapacity;

        var code;
        if (source instanceof Creep)
            code = source.transfer(creep, resType, amnt);
        else
            code = creep.withdraw(source, resType, amnt);

        if (OK == code) {
            creep._withdrawn = true;
            //creep.memory.task = "deliver";
            creep.memory.recentWithdrawResType = resType;
            creep.memory.recentWithdrawSourceId = source.id;
            creep.memory.cachedSourceId = undefined;
            creep.memory.cachedSourceResType = undefined;

            if (expectedToBecomeFull)
                return true;

            return false;
        }
        else if (code == ERR_FULL) {
            creep.memory.task = "deliver";
            creep.memory.cachedSourceId = undefined;
            creep.memory.cachedSourceResType = undefined;
        }
        else if (code != ERR_NOT_ENOUGH_ENERGY && code != ERR_NOT_ENOUGH_RESOURCES) {
            console.log("w, ", resType, " ", code, source, creep.room.name);
            creep.say("!" + code);
            creep.memory.cachedSourceId = undefined;
            creep.memory.cachedSourceResType = undefined;
        }

        return false;
    },

pickupPower: function (creep) {

    if (!basic.moveToRoom(creep))
        return;

    var powerBank = creep.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: s => s.structureType == STRUCTURE_POWER_BANK
    });

    creep.say(powerBank);

    if (powerBank) {
        creep.say("pwrbnk");
        if (creep.pos.getRangeTo(powerBank) > 4) {
            creep.moveTo(powerBank, { range: 4, visualizePathStyle: { stroke: '#55ff00' } });
            return;
        }

        creep.say("wait");
        return;
    }

    if (runDropped(creep, 50, RESOURCE_POWER)) {
        return;
    }

    if (creep.store.getUsedCapacity(RESOURCE_POWER) > 0) {
        creep.memory.task = "deliver";
        delete creep.memory.toGo;
    }
},

/** @param {Creep} creep **/
run: function (creep) {
    if (creep.memory.task == undefined) {
        creep.memory.task = "pickup";
    }

    if (basic.leaveDangerousRoom(creep))
        return;

    if (creep.memory.task == "recycle") {
        basic.recycleCreep(creep);
        return;
    }

    if (creep.memory.task == "pickupPower") {
        roleDeliverer.pickupPower(creep);
        return;
    }

    if (creep.memory.preferredSourceId == undefined)
        creep.room.visual.circle(creep.pos, { fill: 'transparent', radius: 0.55, stroke: 'orange' });

    if (creep.memory.task == "deliver") {
        var didFullyDeliver = roleDeliverer.runDeliver(creep);

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
            creep.memory.recentWithdrawSourceId = undefined;
            creep.memory.cachedTargetId = undefined;
            creep.memory.cachedTargetResType = undefined;

            if (creep.store.getUsedCapacity() == 0) {
                if (!creep.memory.preferredSourceId) {
                    if (basic.runDropped(creep, 7, undefined, 50))
                        return;
                }
                else
                    if (basic.runDropped(creep, 3, undefined, 50))
                        return;
            }

            var pickupSuccessful = roleDeliverer.runPickup(creep);

            //if (pickupSuccessful) {
            //    creep.memory.task = "deliver";
            //    this.runDeliver(creep);
            //}

            return;
        }

        if (creep.store.getUsedCapacity() == 0) {
            creep.memory.task = "pickup";
            creep.memory.recentWithdrawResType = undefined;
            creep.memory.recentWithdrawSourceId = undefined;
            creep.memory.cachedTargetId = undefined;
            creep.memory.cachedTargetResType = undefined;
            return;
        }
    }

    if (creep.memory.task == "pickup") {

        if (roleDeliverer.switchToDeliverIfLoaded(creep))
            return;

        // and there is no other - then take advantage
        if (!creep.memory.preferredSourceId) {
            if (basic.runDropped(creep, 7, undefined, 50))
                return;
        }
        else
            if (basic.runDropped(creep, 4, undefined, 50))
                return;

        //otherwise run normal
        if (roleDeliverer.runPickup(creep)) {
            // fast
            creep.memory.task = "deliver";
            roleDeliverer.runDeliver(creep);
            return;
        }
    }
}
};

module.exports = roleDeliverer;
