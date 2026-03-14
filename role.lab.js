// Autonomous lab manager (no creep needed - runs per room like role.tower)
//
// Memory contract:
//   room.memory.productionTarget = string   -- current compound being produced
//   room.memory.inventoryGoal    = object   -- { resourceType: amount } goals
//   room.memory.labSetup = {
//       inputLab1  : string          -- id of first input lab
//       inputLab2  : string          -- id of second input lab
//       outputLabs : string[]        -- ids of output labs
//       reagents   : [string,string] -- reagent pair
//       targetRes  : string          -- product resource type
//   }
//   lab.mineralDemand = string              -- resource type deliverers should bring in
//
// Extracted from market.js to separate lab orchestration from market/trade logic.

var market = require('market');

var REAGENTS = {
    // Base minerals (no reagents needed)
    'U': null,
    'L': null,
    'K': null,
    'Z': null,
    'O': null,
    'H': null,
    'X': null,

    // Base compounds
    'OH': ['O', 'H'],
    'ZK': ['Z', 'K'],
    'UL': ['U', 'L'],
    'G': ['ZK', 'UL'],

    // Tier 1 - Hydrides
    'UH': ['U', 'H'],
    'KH': ['K', 'H'],
    'LH': ['L', 'H'],
    'ZH': ['Z', 'H'],
    'GH': ['G', 'H'],
    // Tier 1 - Oxides
    'UO': ['U', 'O'],
    'KO': ['K', 'O'],
    'LO': ['L', 'O'],
    'ZO': ['Z', 'O'],
    'GO': ['G', 'O'],
    // Tier 2 - Acids (hydride + OH)
    'UH2O': ['UH', 'OH'],
    'KH2O': ['KH', 'OH'],
    'LH2O': ['LH', 'OH'],
    'ZH2O': ['ZH', 'OH'],
    'GH2O': ['GH', 'OH'],
    // Tier 2 - Alkalides (oxide + OH)
    'UHO2': ['UO', 'OH'],
    'KHO2': ['KO', 'OH'],
    'LHO2': ['LO', 'OH'],
    'ZHO2': ['ZO', 'OH'],
    'GHO2': ['GO', 'OH'],
    // Tier 3 - Catalyzed (X + Tier 2)
    'XUH2O': ['X', 'UH2O'],
    'XUHO2': ['X', 'UHO2'],
    'XKH2O': ['X', 'KH2O'],
    'XKHO2': ['X', 'KHO2'],
    'XLH2O': ['X', 'LH2O'],
    'XLHO2': ['X', 'LHO2'],
    'XZH2O': ['X', 'ZH2O'],
    'XZHO2': ['X', 'ZHO2'],
    'XGH2O': ['X', 'GH2O'],
    'XGHO2': ['X', 'GHO2']
};

var roleLab = {

    getTotalMineralAmount: function (room, resourceType) {
        var total = 0;

        // Check terminal storage
        if (room.terminal) {
            total += room.terminal.store.getUsedCapacity(resourceType);
        }

        total += _.sum(room.labs, function (lab) { return lab.store.getUsedCapacity(resourceType) || 0; });

        // check all deliverers in the room
        var creeps = room.find(FIND_MY_CREEPS, {
            filter: function (creep) {
                return creep.memory.role === 'deliverer' && creep.store.getUsedCapacity(resourceType) > 0;
            }
        });

        total += _.sum(creeps, function (creep) { return creep.store.getUsedCapacity(resourceType); });

        return total;
    },

    autoGenerateGoalsForRoom: function (room) {
        // auto generate goals per room
        // the logic should be - start from simplest compounds tier 1 and then move up
        // it's ok if we overproduce, it will be shared with other rooms and they can go faster.
        // trigger reaction when number quantity of minerals is lowAmount and finish when highAmount, let it be 1000 and 5000 for now
        // 
        // logic of function
        // Step 1 -  stick to one mineral until it reaches highAmount before moving to next
        // Step 2 - get minerals from other rooms if they have excess (above highAmount) before starting production
        // Step 3 - if there is no current product select new production target

        // production and market sharing can happen independently

        var lowAmount = 500;
        var highAmount = 4000;
        var goals = {};
        var transferLimit = highAmount;

        // Per-compound target overrides (default is highAmount)
        var targetOverrides = {
            'GH': 10000,
            'GH2O': 10000
        };

        // Helper: get target amount for a compound
        var getTargetAmount = function (res) {
            return targetOverrides[res] || highAmount;
        };

        var manualReagents = {
            // Base minerals (no reagents needed)
            'U': null,
            'L': null,
            'K': null,
            'Z': null,
            'O': null,
            'H': null,
            'X': null,

            // Base compounds
            'OH': ['O', 'H'],
            
            'ZK': ['Z', 'K'],
            'UL': ['U', 'L'],
            'G': ['ZK', 'UL'],

            // Tier 1 - Hydrides
            //'UH': ['U', 'H'],
            //'KH': ['K', 'H'],
            //'LH': ['L', 'H'],
            // 'ZH': ['Z', 'H'],
            'GH': ['G', 'H'],
            // Tier 1 - Oxides
            //'UO': ['U', 'O'],
            //'KO': ['K', 'O'],
            //'LO': ['L', 'O'],
            //'ZO': ['Z', 'O'],
            //'GO': ['G', 'O'],
            // Tier 2 - Acids (hydride + OH)
            //'UH2O': ['UH', 'OH'],
            //'KH2O': ['KH', 'OH'],
            //'LH2O': ['LH', 'OH'],
            //'ZH2O': ['ZH', 'OH'],
            'GH2O': ['GH', 'OH'],
            // Tier 2 - Alkalides (oxide + OH)
            //'UHO2': ['UO', 'OH'],
            // 'KHO2': ['KO', 'OH'],
            //'LHO2': ['LO', 'OH'],
            //'ZHO2': ['ZO', 'OH'],
            //'GHO2': ['GO', 'OH'],
            // Tier 3 - Catalyzed (X + Tier 2)
            //'XUH2O': ['X', 'UH2O'],
            //'XUHO2': ['X', 'UHO2'],
            //'XKH2O': ['X', 'KH2O'],
            //'XKHO2': ['X', 'KHO2'],
            //'XLH2O': ['X', 'LH2O'],
            //'XLHO2': ['X', 'LHO2'],
            //'XZH2O': ['X', 'ZH2O'],
            //'XZHO2': ['X', 'ZHO2'],
            // 'XGH2O': ['X', 'GH2O'], // too slow for 6 labs
            //'XGHO2': ['X', 'GHO2']
        };


        // If there's a current production target, check if it's done
        if (room.memory.productionTarget) {
           

            var _tgt = room.memory.productionTarget;
            var _tgtAmt = getTargetAmount(_tgt);
            var currentAmount = this.getTotalMineralAmount(room, _tgt);
            if (currentAmount >= _tgtAmt) {
                // Target reached, clear it and continue to reshare existing reserves
                room.memory.productionTarget = null;
            } else if (room.memory.productionTarget) {
                // Still producing current target, block other production
                goals[room.memory.productionTarget] = _tgtAmt;
            }
        }


        for (var targetRes in manualReagents) {
            // dont check mineral if it's started to produce
            if (targetRes == room.memory.productionTarget)
                continue;

            var resTarget = getTargetAmount(targetRes);
            var currentAmount = this.getTotalMineralAmount(room, targetRes);
            var gapAmount = Math.min(resTarget - currentAmount, transferLimit);

            // If below threshold, try to acquire from external sources
            if (currentAmount < resTarget && gapAmount > 2000) {
                var needAttention = true;

                //console.log(`Room ${room.name} needs ${gapAmount} of ${targetRes} (current: ${currentAmount}), trying to acquire from other rooms or market...`);         

                // First try: share from other rooms
                for (var sourceRoomName in Game.rooms) {
                    var sourceRoom = Game.rooms[sourceRoomName];
                    if (!sourceRoom || !sourceRoom.terminal || sourceRoomName === room.name)
                        continue;

                    var sourceAmount = sourceRoom.terminal.store[targetRes];

                    if (sourceAmount && sourceAmount > resTarget + gapAmount ) {
                        console.log('Sharing ' + gapAmount + ' of ' + targetRes + ' from ' + sourceRoomName + ' to ' + room.name);
                        market.shareResource(sourceRoomName, room.name, targetRes, gapAmount);
                        needAttention = false;
                        break;
                    }
                }

                // Second try: buy from market if sharing didn't work
                if (needAttention) {
                    market.matchOrderInternal(room.name, targetRes, gapAmount, ORDER_SELL);
                    // Check if market matching succeeded
                    var newAmount = this.getTotalMineralAmount(room, targetRes);
                    if (newAmount >= resTarget) {
                        needAttention = false;
                        break;
                    }
                }
            }

            var canProduce = REAGENTS[targetRes] != null;

        }

        // Pick the producible compound with the largest deficit (below its target)
        // so we always produce the scarcest resource first.
        if (room.memory.productionTarget == null) {
            var bestRes = null;
            var bestDeficit = 0;
            for (var res in manualReagents) {
                if (REAGENTS[res] == null) continue; // skip base minerals
                var amt = this.getTotalMineralAmount(room, res);
                var rTarget = getTargetAmount(res);
                var deficit = rTarget - amt;
                if (deficit > bestDeficit) {
                    bestDeficit = deficit;
                    bestRes = res;
                }
            }
            if (bestRes) {
                room.memory.productionTarget = bestRes;
                goals[bestRes] = getTargetAmount(bestRes);
            }
        }

        // If no production target and all goals are satisfied, clear lab setup
        // but only clear mineralDemand for labs that were assigned to reactions,
        // not labs reserved for boosting by role.boost.prepareLabs.
        if (!room.memory.productionTarget && Object.keys(goals).length === 0) {
            var reactionLabIds = {};
            if (room.memory.labSetup) {
                if (room.memory.labSetup.inputLab1) reactionLabIds[room.memory.labSetup.inputLab1] = true;
                if (room.memory.labSetup.inputLab2) reactionLabIds[room.memory.labSetup.inputLab2] = true;
                if (room.memory.labSetup.outputLabs) {
                    for (var ol = 0; ol < room.memory.labSetup.outputLabs.length; ol++) {
                        reactionLabIds[room.memory.labSetup.outputLabs[ol]] = true;
                    }
                }
            }
            room.memory.labSetup = null;
            var labs = room.find(FIND_MY_STRUCTURES, {
                filter: function (structure) { return structure.structureType === STRUCTURE_LAB; }
            });
            for (var i = 0; i < labs.length; i++) {
                // Only clear demands for labs that were part of the reaction setup
                if (reactionLabIds[labs[i].id]) {
                    labs[i].mineralDemand = null;
                }
            }
        }
        //console.log("Room ", room.name, " goals: ", JSON.stringify(goals), " current: ", JSON.stringify(_.mapValues(manualReagents, r => this.getTotalMineralAmount(room, r))));
        return goals;
    },

    manageInventory: function (room) {
        // Update all rooms (cycle)
        for (var roomName in Game.rooms) {
            var r = Game.rooms[roomName];
            if (!r || !r.terminal || !r.controller.my)
                continue;
            var goals = this.autoGenerateGoalsForRoom(r);
            r.memory.inventoryGoal = goals;
        }
        return;
    },

    setupReactions: function () {

        for (var roomName in Game.rooms) {
            var room = Game.rooms[roomName];

            if (!room) {
                console.log("Room ", roomName, " not accessible or doesn't exist");
                continue;
            }
            var goal = room.memory.inventoryGoal;
            if (!goal)
                continue;

            this.setupReactionsForRoom(room, goal);
        }
    },

    setupReactionsForRoom: function (room, goals) {
        var targetRes = room.memory.productionTarget;

        // Only allow lab setup for the active production target.
        // This prevents stale/secondary goal keys from reprogramming labs (e.g. back to GH).
        if (!targetRes) {
            room.memory.labSetup = null;
            return;
        }

        // If setup target drifts from current production target, force reset first.
        if (room.memory.labSetup && room.memory.labSetup.targetRes && room.memory.labSetup.targetRes !== targetRes) {
            room.memory.labSetup = null;
        }

        var requiredAmount = goals[targetRes];
        if (!requiredAmount)
            return;

        var currentAmount = this.getTotalMineralAmount(room, targetRes);
        if (currentAmount < requiredAmount) {
            this.setupRoomReagents(room, targetRes, goals);
        }
    },

    

    setupRoomReagents: function (room, targetRes, goals) {
        if (room.memory.productionTarget && room.memory.productionTarget !== targetRes)
            return;

        // Setup/check function: called less frequently
        var targetAmount = goals[targetRes];
        var currentAmount = this.getTotalMineralAmount(room, targetRes);
        if (currentAmount >= targetAmount)
            return;

        var gapAmount = targetAmount - currentAmount;
        gapAmount = Math.min(gapAmount, 1000);
        var reagents = REAGENTS[targetRes];
        if (!reagents)
            return;

        for (var i = 0; i < reagents.length; i++) {
            var reagent = reagents[i];
            var reagentAmount = this.getTotalMineralAmount(room, reagent);
            if (reagentAmount < gapAmount) {
                // If missing reagent can be produced, switch production chain to that reagent
                // instead of clearing target and getting stuck.
                if (REAGENTS[reagent]) {
                    if (room.memory.productionTarget !== reagent) {
                        console.log("Need to acquire reagent ", reagent, " for producing ", targetRes, " in ", room.name, " switching production to reagent");
                    }
                    room.memory.productionTarget = reagent;
                }
                else {
                    // Base mineral missing — keep productionTarget so sharing/market
                    // logic can acquire it next tick instead of wiping the target.
                    console.log("Waiting for base mineral ", reagent, " for producing ", targetRes, " in ", room.name);
                }
                return;
            }
        }

        var labs = room.find(FIND_MY_STRUCTURES, {
            filter: function (structure) { return structure.structureType === STRUCTURE_LAB; }
        });
        labs = _.sortBy(labs, function (l) { return l.id; });
        if (labs.length < 3)
            return;

        var getLabMineralType = function (lab) {
            if (lab.mineralType)
                return lab.mineralType;

            return _.findKey(lab.store, function (amount, key) { return key !== RESOURCE_ENERGY && amount > 0; }) || null;
        };

        // Clear stale demands only for labs that will be used for reactions.
        // Preserve mineralDemand on labs reserved for boosting by role.boost.prepareLabs.
        // Reaction labs are the first 2 (inputs) + remaining (outputs), all sorted by id.
        for (var i = 0; i < labs.length; i++) {
            // Labs sorted by id: first 2 are input, rest are output for reactions.
            // All of them are reaction labs, so clear their demands.
            labs[i].mineralDemand = null;
        }

        // Only set labSetup if all input/output labs are empty or have correct mineral
        var ready = true;
        for (var i = 0; i < 2; i++) {
            var lab = labs[i];
            var expected = reagents[i];
            var labMineralType = getLabMineralType(lab);
            if (labMineralType && labMineralType !== expected) {
                ready = false;
                if ((lab.store[labMineralType] || 0) > 0) {
                    console.log('Lab ' + lab.id + ' in ' + room.name + ' has wrong mineral (' + labMineralType + '), needs to be emptied before switching to ' + expected);
                    
                }
            }
        }
        for (var i = 2; i < labs.length; i++) {
            var lab = labs[i];
            var labMineralType = getLabMineralType(lab);
            if (labMineralType && labMineralType !== targetRes) {
                ready = false;
                if ((lab.store[labMineralType] || 0) > 0) {
                    console.log('Output lab ' + lab.id + ' in ' + room.name + ' has wrong mineral (' + labMineralType + '), needs to be emptied before producing ' + targetRes);

                }
            }
        }
        if (!ready) {
            // Keep setup disabled while labs are being emptied.
            room.memory.labSetup = null;
            return;
        }
        // Store lab IDs in memory for use in fast cycle
        room.memory.labSetup = {
            inputLab1: labs[0].id,
            inputLab2: labs[1].id,
            outputLabs: labs.slice(2).map(function (l) { return l.id; }),
            reagents: reagents,
            targetRes: targetRes
        };

        // Set mineral demands for input/output labs
        labs[0].mineralDemand = reagents[0];
        labs[1].mineralDemand = reagents[1];
        

        // that was done mostly to show icons
        // additionally to allow boosts if applicable
        // need to replace this second case with custom code and do it just for 1 lab

        for (var i = 2; i < labs.length; i++) {
            labs[i].mineralDemand = targetRes;
        }
    },

    runReaction: function (id1, id2, id3) {
        var lab1 = Game.getObjectById(id1);
        var lab2 = Game.getObjectById(id2);
        var lab3 = Game.getObjectById(id3);

        if (!lab3)
            return;

        if (lab3.cooldown > 0)
            return;

        var code = lab3.runReaction(lab1, lab2);
        if (OK != code && code != -6) {
            var l1type = lab1 && lab1.mineralType ? lab1.mineralType : 'none';
            var l2type = lab2 && lab2.mineralType ? lab2.mineralType : 'none';
            var l1amt = lab1 && lab1.mineralType ? lab1.store[lab1.mineralType] : 0;
            var l2amt = lab2 && lab2.mineralType ? lab2.store[lab2.mineralType] : 0;
            var l3type = lab3 && lab3.mineralType ? lab3.mineralType : 'none';
            var l3amt = lab3 && lab3.mineralType ? lab3.store[lab3.mineralType] : 0;
            console.log('failed to run reacton', lab1 && lab1.room ? lab1.room.name : 'unknown', 'err', code,
                'lab1:', l1type, l1amt,
                'lab2:', l2type, l2amt,
                'lab3:', l3type, l3amt
            );
        }
    },

    runReactions: function () {
        for (var roomName in Game.rooms) {
            var room = Game.rooms[roomName];
            if (!room || !room.controller || !room.controller.my || !room.memory.labSetup)
                continue;

            this.runRoomReactions(room);
        }
    },

    runRoomReactions: function (room) {
        // Fast cycle: run reactions using lab IDs from memory
        var setup = room.memory.labSetup;
        if (!setup) return;
        var lab1 = Game.getObjectById(setup.inputLab1);
        var lab2 = Game.getObjectById(setup.inputLab2);
        var outputLabs = setup.outputLabs.map(function (id) { return Game.getObjectById(id); }).filter(function (lab) { return !!lab; });
        var reagents = setup.reagents;

        if (!lab1 || !lab2 || !outputLabs.length || !reagents) return;
        if (lab1.store[reagents[0]] < LAB_REACTION_AMOUNT || lab2.store[reagents[1]] < LAB_REACTION_AMOUNT) return;
        for (var i = 0; i < outputLabs.length; i++) {
            if (outputLabs[i].cooldown === 0) {
                this.runReaction(lab1.id, lab2.id, outputLabs[i].id);
            }
        }
    }
};

module.exports = roleLab;
module.exports.REAGENTS = REAGENTS;
