var basic = require("role.basic");

var roleBuilder = {

    /** @param {Creep} creep **/
    run: function (creep) {
        if (!basic.moveToRoom(creep)) {
            return;
        }

        if (!creep.memory.task)
            creep.memory.task = "harvest";

        if (creep.store.energy == creep.store.getCapacity())
            creep.memory.task = "build";

        if (creep.store.energy == 0)
            creep.memory.task = "harvest";

        if (creep.memory.task == "harvest") {

            this.runHarvest(creep);
            //creep.say('🔄 harvest');
            return;
        }
        //console.log("builder ", creep.name, " task ", creep.memory.task);

        if (creep.memory.task == "build") {

            //console.log("builder ", creep.name, " isEarlyGame ", creep.room.memory.isEarlyGame);
            if (creep.room.memory.isEarlyGame || creep.room.memory.coldStart) {
                if (this.deliverToBase(creep))
                    return;
            }
            this.runBuild(creep);
            //creep.say('🚧 build');
            return;
        }
    },
    deliverToBase: function (creep) {
        var target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (s) => {
                return (s.structureType == STRUCTURE_EXTENSION || s.structureType == STRUCTURE_SPAWN) &&
                    s.isActive &&
                    s.energy < s.energyCapacity;
            }
        })

        //console.log("deliverToBase target ", target);
        if (target) {
            if (!creep.pos.isNearTo(target) && creep.fatigue == 0) {
                var err = creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                if (err != OK)
                    creep.say(err);
                return true;
            }

            var err = creep.transfer(target, RESOURCE_ENERGY);
            if (err != OK) {
                creep.say("transf" + err);
            }
            return true;
        }

        return false;
    },
    runHarvest: function (creep) {
        if (basic.runDropped(creep, 3, RESOURCE_ENERGY, 50))
            return;

        var source;

        var sourceDismantle;

        var flagDismantle = creep.pos.findClosestByRange(FIND_FLAGS, {
            filter: flag => (flag.color == COLOR_RED && flag.secondaryColor == COLOR_BROWN)
        });

        if (flagDismantle) {
            var looks = creep.room.lookForAt(LOOK_STRUCTURES, flagDismantle);
            sourceDismantle = looks[0];
            console.log("dismantle source ", sourceDismantle, " in room ", creep.room.name);
        }

        // containers nearby
        if (source == undefined) {
            source = creep.pos.findInRange(FIND_STRUCTURES, 5, {
                filter: o => ((o.structureType == STRUCTURE_CONTAINER) &&
                    (o.store[RESOURCE_ENERGY] > 500))
            })[0];
        }

        const TERMINAL_WATERMARK = 5000;
        if (source == undefined) {
            source = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: o => ((o.structureType == STRUCTURE_TERMINAL) &&
                    (o.store[RESOURCE_ENERGY] > TERMINAL_WATERMARK + creep.carryCapacity))
            });
        }

        if (source == undefined) {
            source = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (i) => ((i.structureType == STRUCTURE_STORAGE) &&
                    i.store[RESOURCE_ENERGY] > creep.carryCapacity)
            });
        }

        if (source == undefined) {
            source = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (i) => ((i.structureType == STRUCTURE_CONTAINER &&
                    i.store[RESOURCE_ENERGY] > 2 * creep.carryCapacity))
            });

            if (source && creep.pos.getRangeTo(source.pos) > 10)
                source = undefined;
        }


        // only if container is missing
        // what are conditions to allow stealing from extensions instead of container?
        // why commented?
        if (source == undefined) {
            
            if(creep.room.spawn && !creep.room.spawn.container)
            if (creep.room.controller.level > 1 && creep.room.energyCapacityAvailable > 550)
                if (creep.room.energyAvailable > 0.75 * creep.room.energyCapacityAvailable) {
                    source = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                        filter: (i) => ((i.structureType == STRUCTURE_SPAWN ||
                            i.structureType == STRUCTURE_EXTENSION) &&
                            i.store[RESOURCE_ENERGY] > creep.carryCapacity)
                    });
                }
        }

        if (sourceDismantle) {
            if (!creep.pos.isNearTo(sourceDismantle.pos) && creep.fatigue == 0) {
                var err = creep.moveTo(sourceDismantle.pos, { visualizePathStyle: { stroke: '#ffffff' } });
                if (err != OK)
                    creep.say(err);
                return;
            }

            var err = creep.dismantle(sourceDismantle);
            if (err != OK)
                source = undefined;
        }

        else if (source) {
            if (!creep.pos.isNearTo(source.pos) && creep.fatigue == 0) {
                var err = creep.moveTo(source.pos, { visualizePathStyle: { stroke: '#ffffff' } });
                if (err != OK)
                    creep.say(err);
                return;
            }

            var err = creep.withdraw(source, RESOURCE_ENERGY);
            if (err != OK)
                source = undefined;
        }
        else {
            var source = basic.findSource(creep);

            if(!source)
                return;

            //console.log("builder " + creep.name + " harvesting from source " + source.id);
            var err = creep.moveTo(source, {
                visualizePathStyle: { stroke: '#ffffff' },
                ignoreCreeps: false
            });

            if (err == ERR_NO_PATH)
                err = creep.moveTo(source, {
                    visualizePathStyle: { stroke: '#ffffff' },
                    ignoreCreeps: true
                });

            var code = creep.harvest(source);
            if (OK == code) {

            }
            else if (ERR_NOT_IN_RANGE == code) {
                var code = creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
                //creep.say(code);
            }
            else {
                creep.say(code);
            }
        }
    }
    ,

    runBuild: function (creep) {
        var target = this.selectTarget(creep);

        if (!target) {
            this.noBuild(creep);
            return;
        }

        creep.memory.targetId = target.id;

        if (creep.pos.getRangeTo(target.pos) > 3) {
            if (creep.fatigue == 0)
                creep.moveTo(target.pos, { range: 3, visualizePathStyle: { stroke: '#ffffff' } });
            return;
        }

        var err = creep.build(target);

        if (err != OK) {
            creep.say("build" + err);
            creep.memory.targetId = undefined;
        }
    }
    ,
    selectTarget: function (creep) {
        if (creep.memory.targetId) {
            var tgt = Game.getObjectById(creep.memory.targetId);
            if (tgt)
                return tgt;

            creep.memory.targetId = undefined;
        }

        var target;
        var flag = creep.pos.findClosestByRange(FIND_FLAGS, {
            filter: flag => (flag.color == COLOR_RED && flag.secondaryColor == COLOR_RED)
        });

        if (flag) {

            target = flag.pos.findClosestByPath(FIND_CONSTRUCTION_SITES, { ignoreCreeps: true });

            if (target != null)
                console.log("building important object " + target.id);
        }

        if (target == undefined) {

            // roads on swamp
            // spawns
            // then everything else
            var targets = creep.room.find(FIND_CONSTRUCTION_SITES, {
                filter: s => (s.structureType == STRUCTURE_ROAD && 
                    s.pos.lookFor(LOOK_TERRAIN)[0] == 'swamp')
            });

            //console.log("found ", targets.length, " road swamp sites");
            if (targets.length == 0)
                targets = creep.room.find(FIND_CONSTRUCTION_SITES, {
                    filter: s => s.structureType == STRUCTURE_SPAWN
                });

            //console.log("found ", targets.length, " spawn sites");
            if (targets.length == 0)
                targets = creep.room.find(FIND_CONSTRUCTION_SITES);


            // building smaller first
            var sorted = _.sortBy(targets, c => c.progressTotal - c.progress)

            // log all sites with their progress and remaining
            //console.log("construction sites in room ", creep.room.name);
            //for (var s of sorted) {
            //    console.log("site ", s.id, " type ", s.structureType, " progress ", s.progress, "/", s.progressTotal,
            //        " remaining ", (s.progressTotal - s.progress));
            //}

            if (sorted.length > 0)
                target = sorted[0];
        }

        return target;
    }
    ,
    noBuild: function (creep) {
        if (creep.memory.toGo && creep.memory.toGo[0] == creep.room.name) {
            creep.say("now upgrader");
            creep.memory.role = "upgrader";
        }
        else if (!creep.memory.toGo) {


            if (basic.repairEmergency(creep, 15)) {
                creep.say("e1");
                return;
            }

            basic.recycleCreep(creep);
            return;
        }
        else {
            //basic.recycleCreep(creep);
            creep.say("e2");
            if (basic.repairEmergency(creep, 15)) {
                return;
            }
            return;
        }

        console.log(creep.room, "nothing to build going to room below");

        return;
    }
};

module.exports = roleBuilder;