var basic = require("role.basic");

var linkLimitHigh = 490;
var linkLimitLow = 390;

const TERMINAL_WATERMARK = 10000;
const MINERAL_WATERMARK = 500;

var roleDeliverer =
{
    getLabMineralType: function (lab) {
        if (!lab || !lab.store)
            return null;

        if (lab.mineralType)
            return lab.mineralType;

        var mineralKey = _.findKey(lab.store, function (amount, key) {
            return key !== RESOURCE_ENERGY && amount > 0;
        });

        return mineralKey || null;
    },

    getLabMineralAmount: function (lab, mineralType) {
        if (!lab || !lab.store)
            return 0;

        var type = mineralType || this.getLabMineralType(lab);
        if (!type)
            return 0;

        return lab.store[type] || 0;
    },

    runDeliver: function (creep) {
        var target = this.selectTarget(creep);

        if (!creep.memory.preferredSourceId && !target) {
            creep.say("⏳");
            if (creep.ticksToLive < 1400 && creep.room.controller.level > 3)
                basic.runRenew(creep);
            return;
        }

        if (!creep.pos.isNearTo(target)) {
            basic.goTo(creep, target);
            return;
        }

        var amnt;

        if (target.structureType == STRUCTURE_LINK) {
            amnt = Math.min(linkLimitHigh - target.energy, creep.store.energy);
            if (amnt <= 0) {
                creep.say('♻︎');
                return;
            }
        }

        //console.log("tr type ", resType);
        //var targetCanTake = tgt.
        var resType = this.storeResType(creep);

        // if transfered all allow go pickup immidiately

        var canAccept = this.capacityLeft(target, resType);
        var iHave = creep.store[resType];
        var iHaveTotal = _.sum(creep.store);

        // avoid overfill otherwise base deliverer can compete with  controller container filler
        if (creep.memory.preferredTargetId &&
            target.store[resType] > target.store.getCapacity() - 200 - creep.store.getCapacity()) {
            creep.say("...");
            return false;
        }

        var transferCode = creep.transfer(target, resType);

        if (OK == transferCode) {
            creep.memory.targetId = undefined;

            var transferAmount = Math.min(canAccept, iHave);

            // && amnt==transferAmount was removed as link may accept less than calculated
            if (transferAmount == iHave && transferAmount == iHaveTotal) {
                return true;
            }

            return false;
        }
        else if (ERR_NOT_ENOUGH_RESOURCES == transferCode) {
            if (creep.store.getFreeCapacity() > 0) {
                creep.memory.task = "pickup";
            }
            //creep.say("pickup");
        }
        else if (ERR_FULL == transferCode) {
            if (creep.memory.full)
                creep.memory.full++;
            else
                creep.memory.full = 1;

            creep.say("full");
            //creep.drop(RESOURCE_ENERGY);
        }
        else {
            creep.say("error" + transferCode);
        }
    },

    capacityLeft: function (target, resType) {
        if (resType == RESOURCE_ENERGY && target.energy != undefined) {
            return target.energyCapacity - target.energy;
        }

        if (target.store != undefined) {
            return target.store.getCapacity() - _.sum(target.store);
        }

        return 0;
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
        if (creep.memory.targetId) {
            var tgt = Game.getObjectById(creep.memory.targetId);
            if (tgt)
                return tgt;
            //creep.memory.targetId = undefined;
        }

        var target;

        var resType = this.storeResType(creep);

        if (creep.memory.preferredTargetId) {
            target = Game.getObjectById(creep.memory.preferredTargetId);

            if (!target) {
                basic.recycleCreep(creep);
                return;
            }

            if (target.store)
                if (target.store.energy == target.energyCapacity)
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
                            s.isActive &&
                            s.energy < s.energyCapacity;
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
                            s.energy < linkLimitLow;
                    }
                });
            }

            //base  container
            if (target == undefined && creep.room.spawn) {
                if (creep.room.spawn.container &&
                    creep.room.spawn.container.isActive &&
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
                            //&& s.store.energy < s.store.getCapacity()-creep.store.getCapacity() ;

                            s.store.energy < 0.2 * s.store.getCapacity();
                    }
                });
            }

            // towers fully
            if (target == undefined) {
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (s) => {
                        return (s.structureType == STRUCTURE_TOWER) &&
                            s.energy <= s.energyCapacity - creep.store.getCapacity();
                    }
                });
            }

            // labs - energy demand from boosting (higher priority)
            if (target == undefined && creep.room.memory.labEnergyDemand) {
                const labIds = Object.keys(creep.room.memory.labEnergyDemand);
                if (labIds.length > 0) {
                    target = creep.pos.findClosestByPath(
                        labIds.map(id => Game.getObjectById(id)).filter(l => l),
                        {
                            filter: (s) => {
                                const desiredEnergy = creep.room.memory.labEnergyDemand[s.id];
                                return s.structureType === STRUCTURE_LAB &&
                                    s.store[RESOURCE_ENERGY] < desiredEnergy;
                            }
                        }
                    );
                }
            }

            // terminals
            if (target == undefined) {
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (s) => {
                        return s.structureType == STRUCTURE_TERMINAL &&
                            s.isActive &&
                            s.store.energy < TERMINAL_WATERMARK - creep.store.getCapacity();
                    }
                });
            }


            // nneed extra condition to avoid pick up and then immidiately deliver to storage
            // do not disable - without this link overflow is  happening
            // 
            if (target == undefined) {
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (s) => {
                        return ((s.structureType == STRUCTURE_STORAGE) &&
                            s.isActive &&
                            s.store[RESOURCE_ENERGY] < s.store.getCapacity());
                    }
                });
            }
        }
        else {
            // Labs with mineralDemand matching what we're carrying
            if (target == undefined) {
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (lab) => {
                        var labMineralType = this.getLabMineralType(lab);
                        var labMineralAmount = this.getLabMineralAmount(lab, labMineralType);

                        return ((lab.structureType == STRUCTURE_LAB) && lab.isActive
                            && labMineralAmount < MINERAL_WATERMARK &&
                            lab.mineralDemand == resType &&
                            (labMineralType == undefined || labMineralType == resType));
                    }
                });
            }

            if (target == undefined) {
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (s) => {
                        return ((s.structureType == STRUCTURE_TERMINAL) &&
                            s.isActive &&
                            _.sum(s.store) < s.store.getCapacity() * 0.98);
                    }
                });
            }


            if (target == undefined) {
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (s) => {
                        return ((s.structureType == STRUCTURE_STORAGE) &&
                            s.isActive &&
                            _.sum(s.store) < s.store.getCapacity());
                    }
                });
            }
        }

        return target;
    },

    runPickup: function (creep) {
        var source;

        // limiting?
        if (creep.memory.preferredSourceId) {
            source = Game.getObjectById(creep.memory.preferredSourceId);

            if (!source) {
                basic.recycleCreep(creep);
                return;
            }
        }

        var resType = RESOURCE_ENERGY;
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


        // FIRST PRIORITY (after energy): Remove minerals from labs that shouldn't be there
        // This includes: wrong minerals (mineralDemand != mineralType) and unwanted minerals (no demand set)
        if (source == undefined) {
            source = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: o => {
                    if (o.structureType != STRUCTURE_LAB)
                        return false;

                    var mineralType = this.getLabMineralType(o);
                    var mineralAmount = this.getLabMineralAmount(o, mineralType);

                    return mineralAmount > 0 &&
                        (
                            (o.mineralDemand && o.mineralDemand != mineralType) ||  // wrong mineral
                            !o.mineralDemand  // no demand, should be empty
                        );
                }
            });

            if (source) {
                resType = this.getLabMineralType(source);
            }
        }

        // Labs with minerals above watermark (take excess back to storage)
        if (source == undefined) {
            source = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: o => {
                    if (o.structureType != STRUCTURE_LAB)
                        return false;

                    var mineralType = this.getLabMineralType(o);
                    var mineralAmount = this.getLabMineralAmount(o, mineralType);

                    return mineralAmount > MINERAL_WATERMARK + creep.store.getCapacity();
                }
            });

            if (source) {
                resType = this.getLabMineralType(source);
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
                var labs = creep.room.find(FIND_STRUCTURES, {
                    filter: (lab) => {
                        var labMineralType = this.getLabMineralType(lab);
                        var labMineralAmount = this.getLabMineralAmount(lab, labMineralType);

                        return ((lab.structureType == STRUCTURE_LAB) &&
                            lab.isActive &&
                            labMineralAmount < MINERAL_WATERMARK &&
                            lab.mineralDemand);
                    }
                });

                //console.log("--",labs);
                labs = _.sortBy(labs, lab => this.getLabMineralAmount(lab));
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

        //if(source == creep.room.controller.container)
        //   source = undefined;

        if (!source) {
            creep.say("no source");
            return false;
        }
        var amnt;

        if (source.structureType == STRUCTURE_LINK) {
            amnt = Math.min(source.energy - linkLimitLow, creep.store.getCapacity() - creep.store.energy);
        }

        if (!creep.pos.isNearTo(source)) {
            basic.goTo(creep, source, 1, '#ffaa00');
            return;
        }

        /*if(_.sum(source.store) == 0)
        {
            creep.say("wait");
            return;
        }*/ // need to check energy field as well

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
        var code = creep.withdraw(source, resType, amnt);

        if (OK == code) {
            creep.memory.task = "deliver";
            creep.memory.recentWithdrawResType = resType;

            return true;
        }
        else if (code == ERR_FULL) {
            creep.memory.task = "deliver";
        }
        else if (code != ERR_NOT_ENOUGH_ENERGY && code != ERR_NOT_ENOUGH_RESOURCES) {
            //console.log("w, ", resType, " ", code, source, creep.room.name);
            creep.say("!" + code);
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
            var res = this.runDeliver(creep);

            // if it has multiple materials in store - then pickup again

            // testing this since some were stuck with minerals
            //res = false;

            if (res || _.sum(creep.store) == 0) {

                if (creep.ticksToLive < creep.memory.travelTime) {
                    creep.memory.task = "recycle";
                    return;
                }
                creep.memory.task = "pickup";
                if (_.sum(creep.store) == 0)
                    creep.memory.recentWithdrawResType = undefined;


                // Only pick up dropped resources if completely empty
                if (_.sum(creep.store) == 0) {
                    // and there is no other - then take advantage
                    if (!creep.memory.preferredSourceId) {
                        if (basic.runDropped(creep, 7, undefined, 50))
                            return;
                    }
                    else
                        if (basic.runDropped(creep, 1, undefined, 50))
                            return;

                    // Only run pickup when completely empty
                    this.runPickup(creep);
                }

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
