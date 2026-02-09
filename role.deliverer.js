var basic = require("role.basic");

var linkLimitHigh = 400;
var linkLimitLow = 200;

var roleDeliverer =
{
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

        if (creep.memory.preferredTargetId &&
            target.store[resType] > target.store.getCapacity() - 300) {
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
            creep.memory.task = "pickup";
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
        else if (this.recentWithdrawResType)
            resType = this.recentWithdrawResType;
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
        const TERMINAL_WATERMARK = 2000;
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
                            s.isActive &&
                            s.isNearBase &&
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

            // labs 
            if (target == undefined) {
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (s) => {
                        return (s.structureType == STRUCTURE_LAB) &&
                            s.energy < s.energyCapacity - creep.store.getCapacity() &&
                            s.isBoosting;
                    }
                });
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
            if (target == undefined) {
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (lab) => {
                        return ((lab.structureType == STRUCTURE_LAB) && lab.isActive
                            && lab.mineralAmount < lab.mineralCapacity - creep.store.getCapacity() && lab.mineralDemand == resType && (lab.mineralType == undefined || lab.mineralType == resType));
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
        const TERMINAL_WATERMARK = 5000;
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
            source = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (structure.structureType == STRUCTURE_LINK) &&
                        structure.isActive &&
                        structure.isNearBase &&
                        structure.energy > linkLimitHigh;
                }
            });
        }

        // local terminal or storage for mineral
        if (source == undefined) {
            var target = this.selectTarget(creep);
            if (target && target.structureType == STRUCTURE_STORAGE) {
                var labs = creep.room.find(FIND_STRUCTURES, {
                    filter: (lab) => {
                        return ((lab.structureType == STRUCTURE_LAB) &&
                            lab.isActive &&
                            lab.mineralAmount < lab.mineralCapacity - creep.store.getCapacity() &&
                            lab.mineralDemand);
                    }
                });

                //console.log("--",labs);
                labs = _.sortBy(labs, ['mineralAmount'], ['asc']);
                //console.log(labs);
                var lab = labs[0];

                if (lab && lab.mineralDemand) {
                    resType = lab.mineralDemand;
                    source = creep.pos.findClosestByPath(FIND_STRUCTURES,
                        {
                            filter: o => (o.structureType == STRUCTURE_TERMINAL || o.structureType == STRUCTURE_STORAGE) && o.store[resType] > 0
                        });
                }
            }
        }
        // labs needing res
        if (source == undefined) {
            source = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: o => (o.structureType == STRUCTURE_LAB)
                    && o.mineralAmount >= creep.store.getCapacity() &&
                    !o.mineralDemand
            });

            if (source) {
                resType = source.mineralType;
            }
        }

        if (source == undefined) {
            source = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: o => (o.structureType == STRUCTURE_LAB) &&
                    o.mineralAmount >= creep.store.getCapacity() &&
                    o.mineralDemand != o.mineralType
            });

            if (source) {
                resType = source.mineralType;
            }
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
                    o.store[resType] > 2 * creep.store.getCapacity() &&
                    !o.isNearBase &&
                    o != creep.room.controller.container
            });
        }

        // any container
        if (source == undefined) {
            source = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: o => o.structureType == STRUCTURE_CONTAINER &&
                    o.store[resType] > 50 &&
                    o != creep.room.controller.container
            });
        }

        // nearbase container 
        if (source == undefined) {
            source = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: o => o.structureType == STRUCTURE_CONTAINER &&
                    o.store[resType] > 0 &&
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
        if (creep.memory.preferredSourceId && source.store[resType] < 300) {
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
            creep.memory.task == "deliver";
            this.recentWithdrawResType = resType;

            return true;
        }
        else if (code == ERR_FULL) {
            creep.say("full already");
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

        if (creep.memory.task == "deliver") {
            var res = this.runDeliver(creep);

            // if it has multiple materials in store - then pickup again
            if (res || _.sum(creep.store) == 0) {

                if (creep.ticksToLive < creep.memory.travelTime) {
                    creep.memory.task = "recycle";
                    return;
                }
                creep.memory.task = "pickup";


                // and there is no other - then take advantage
                if (!creep.memory.preferredSourceId) {
                    if (basic.runDropped(creep, 7, undefined, 50))
                        return;
                }
                else
                    if (basic.runDropped(creep, 1, undefined, 50))
                        return;

                this.runPickup(creep);
                
                return;
            }
        }

        if (creep.memory.task == "pickup") {
            if (_.sum(creep.store) == creep.store.getCapacity()) {
                creep.memory.task = "deliver";
                this.runDeliver(creep);

                return;
            }

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
