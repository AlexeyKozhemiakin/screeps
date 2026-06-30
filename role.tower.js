module.exports = {

    run: function (room, addCpuValue) {
        var profileStep = function (label, cpuStart) {
            if (!addCpuValue)
                return;

            addCpuValue('roleTower.' + label, Game.cpu.getUsed() - cpuStart);
        };

        var cpuStep = Game.cpu.getUsed();
        if (!room)
            return;
        if (!room.controller)
            return;
        if (!room.controller.my)
            return;
        profileStep('guards', cpuStep);

        cpuStep = Game.cpu.getUsed();
        var towers = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType == STRUCTURE_TOWER });
        var repairState = { roadRepairDone: false };
        profileStep('findTowers', cpuStep);

        cpuStep = Game.cpu.getUsed();
        towers = _.sortBy(towers, t => -t.energy);
        profileStep('sortTowers', cpuStep);

        cpuStep = Game.cpu.getUsed();
        _.forEach(towers, t => this.runInternal(t, repairState, addCpuValue));
        profileStep('runInternalAll', cpuStep);
    },

    runInternal: function (tower, repairState, addCpuValue) {
        var profileStep = function (label, cpuStart) {
            if (!addCpuValue)
                return;

            addCpuValue('roleTower.' + label, Game.cpu.getUsed() - cpuStart);
        };

        var cpuStep = Game.cpu.getUsed();
        //console.log(tower);
        var closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
        var damagedTower = tower.pos.findClosestByRange(FIND_MY_STRUCTURES, { filter: s => s.structureType == STRUCTURE_TOWER && s.hits < (3000 - 2 * 800) });
        var damagedCreep = tower.pos.findClosestByRange(FIND_MY_CREEPS, { filter: s => s.hits < s.hitsMax });
        profileStep('findImmediateTargets', cpuStep);
        //var damagedBuild =  tower.pos.findClosestByRange(FIND_STRUCTURES, {filter : s=>s.hits < s.hitsMax*0.2 && s.ticksToDecay < 50});

        cpuStep = Game.cpu.getUsed();
        if (damagedTower) {
            tower.repair(damagedTower);
            profileStep('action.repairTower', cpuStep);
        }
        else if (closestHostile) {
            // attack last hit only when it got close
            //if(closestHostile.hits > 100 || closestHostile.f)
            tower.attack(closestHostile);
            profileStep('action.attackHostile', cpuStep);
        }
        else if (damagedCreep) {
            tower.heal(damagedCreep);
            profileStep('action.healCreep', cpuStep);
        }
        // else if(damagedBuild)
        //{
        //tower.repair(damagedBuild);
        //}
        else {
            if ((tower.room.energyAvailable >= 0.8 * tower.room.energyCapacityAvailable &&
                tower.energy >= 0.25 * tower.energyCapacity) ||
                (tower.energy >= 0.9 * tower.energyCapacity)) {
                var tgts;

                var wallHealth = 10000;
                var rampartHealth = RAMPART_HITS_MAX[tower.room.controller.level] / 50 || 300000;

                rampartHealth = Math.min(1000000, rampartHealth);
                //console.log(tower.room.name, " wallHealth ", wallHealth, " rampartHealth ", rampartHealth);
                var repairK = 0.90;

                cpuStep = Game.cpu.getUsed();
                tgts = tower.room.find(FIND_STRUCTURES, {
                    filter: o => ((o.structureType == STRUCTURE_WALL && o.hits + TOWER_POWER_REPAIR < wallHealth) ||
                        (o.structureType == STRUCTURE_RAMPART && o.hits + TOWER_POWER_REPAIR < rampartHealth)) ||

                        ((o.structureType != STRUCTURE_WALL && o.structureType != STRUCTURE_RAMPART) &&
                            o.hits + TOWER_POWER_REPAIR < repairK * o.hitsMax)
                });
                profileStep('repair.findTargets', cpuStep);


                cpuStep = Game.cpu.getUsed();
                var sorted = _.sortBy(tgts, c => c.hits / Math.min(c.hitsMax, wallHealth));
                profileStep('repair.sortTargets', cpuStep);

                cpuStep = Game.cpu.getUsed();
                if (sorted.length > 0) {
                    var tgt = sorted[0];

                    // understand efficiency of tower repair
                    var range = tower.pos.getRangeTo(tgt);

                    //console.log(tower.room.name, " repair " + tgt.structureType + " at range " + range + " hits " + tgt.hits + "/" + tgt.hitsMax, 
                    //        TOWER_OPTIMAL_RANGE, "/", TOWER_FALLOFF_RANGE);

                    var err = tower.repair(tgt);

                    if (err == OK && repairState && tgt.structureType == STRUCTURE_ROAD)
                        repairState.roadRepairDone = true;
                    
                    if (err != OK)
                        console.log(tower.room.name, "repair err", err);
                }
                profileStep('repair.apply', cpuStep);
            }
            else {
                //console.log("skip repair room on low energy");
                profileStep('repair.skipLowEnergy', cpuStep);
            }
        }
    },
};