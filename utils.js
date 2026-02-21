var roleMineralHarvester = require('role.mineralHarvester');
var draw = require('room.draw.visuals');

const RICH_ROOM_ENERGY = 8000;

var utils = {

    roomDraw: function (room) {
        //room.visual.clear();

        room.spawns.forEach(spawn => {
            if (spawn.spawning) {
                var spawningCreep = Game.creeps[spawn.spawning.name];
                spawn.room.visual.text(
                    '🛠️' + spawningCreep.memory.role,
                    spawn.pos.x + 1,
                    spawn.pos.y,
                    { align: 'left', opacity: 0.8 });
            }
        });

        var debugFlag = room.find(FIND_FLAGS, { filter: f => (f.name.includes("debug")) })[0];

        if (debugFlag) {


            var ignoreKeys = ["controllerProcessStats", "controllerEfficiency", "events"];
            var messages = Object.keys(room.memory).map(key => {
                var value = room.memory[key];
                if (ignoreKeys.includes(key))
                    return;
                if (typeof value === 'object') {
                    value = JSON.stringify(value);
                }
                return key + ": " + value;
            });

            for (var i = 0; i < messages.length; i++) {
                room.visual.text(messages[i],
                    debugFlag.pos.x + 1,
                    debugFlag.pos.y + 0.5 + i * 0.6,
                    {
                        align: 'left',
                        opacity: 0.8, font: 0.5, color: 'white'
                    });
            }
        }
        /*
        if(room.mineral) { 
            room.visual.text(
                '⏱️' + room.mineral.ticksToRegeneration,
                room.mineral.pos.x + 1, 
                room.mineral.pos.y, 
                {align: 'left', opacity: 0.8});
        }
        */


        var labs = room.find(FIND_STRUCTURES, {
            filter: (lab) => {
                return ((lab.structureType == STRUCTURE_LAB) && lab.isActive()
                    && lab.mineralDemand);
            }
        });

        _.forEach(labs, lab => {
            //console.log("!!! ", lab);
            room.visual.resource(
                lab.mineralDemand,
                lab.pos.x, lab.pos.y);
        });



    },

    roomSpawn: function (room, spawnOrders) {

        var spawn = room.spawns.find(s => !s.spawning);

        if (spawn == undefined) {
            //console.log("no available spawn in room ", room.name);
            return;
        }

        if (spawn.id == '699238eb227166a800e1279a')
            return;

        var roomCreeps = _.filter(Game.creeps, cr => cr.room.name == room.name); // cannot use FIND_MY_CREEPS cause it's use spawning

        var harvesters = _.filter(roomCreeps, (creep) => creep.memory.role == 'harvester');

        var builders = _.filter(roomCreeps, (creep) => creep.memory.role == 'builder');
        var deliverers = _.filter(roomCreeps, (creep) => creep.memory.role == 'deliverer');
        var mineralHarvesters = _.filter(roomCreeps, (creep) => creep.memory.role == 'mineralHarvester');

        var extensions = _.filter(room.find(FIND_STRUCTURES), s => s.structureType == STRUCTURE_EXTENSION);

        var isEarlyGame = extensions.length < 5;
        room.memory.isEarlyGame = isEarlyGame;

        var mem = Object();
        var repl;
        var oldest;

        // replacement prep
        if (roomCreeps.length > 0 && room.controller.level >= 4) {
            var ups = _.filter(roomCreeps, (cr) =>
                (cr.memory.role == "harvester") &&
                (cr.getActiveBodyparts(WORK) >= 5) &&
                cr.memory.replaced != true
                && !cr.spawning);

            //console.log(room.name, ups);

            oldest = _.sortBy(ups, ['ticksToLive'], ['asc'])[0];

            if (oldest && oldest.ticksToLive < 100) {
                var ticksToCreate = CREEP_SPAWN_TIME * oldest.body.length;

                var speed = 1.0; //TODO:calc based on parts - we assume it's roaded always
                var ticksToTravel = oldest.pos.findPathTo(spawn.pos, { ignoreCreeps: true }).length * speed;
                var estimate = oldest.ticksToLive - ticksToCreate - ticksToTravel;

                //if(estimate < 100)
                room.memory.planReplace = ticksToCreate + " + toTravel=" + ticksToTravel + " oldest=" + oldest.ticksToLive + " to replace " + oldest.name + " in=" + estimate;

                if (oldest.ticksToLive <= ticksToCreate + ticksToTravel) {
                    //console.log("Preparing replacement for", oldest.name, oldest.ticksToLive);
                    //console.log(oldest.memory);
                    repl = Object.assign({}, oldest.memory); // shallow copy of current mem
                }
            }
            else {
                //console.log(room.name, " nothing matches replacement criteria");
            }
        }



        var sources = room.find(FIND_SOURCES);

        var sortedSources = _.sortBy(sources, function (source) {
            var path = source.pos.findPathTo(spawn.pos, { ignoreCreeps: true }); // TODO:interoom path
            //console.log(path.length);
            return path.length;
        });



        for (var source of sortedSources) {
            const sourceId = source.id;

            // Get all attached harvesters for this source
            var attachedCreeps = _.filter(Game.creeps, function (cr) {
                return cr.memory.role == 'harvester' && cr.memory.preferredSourceId == sourceId;
            });

            // Sum the WORK parts of all attached creeps
            var attachedWorkParts = _.sum(attachedCreeps, cr => cr.getActiveBodyparts(WORK));

            //var source = sources[sourceIdx];
            var slots = source.slots();
            if (slots > 2)
                slots = 2;

            // for highly developed rooms - what?
            if (room.controller.level >= 3)
                slots = 1;

            // focus on builders before first extensions
            if (isEarlyGame)
                slots = 1;

            // Instead of checking creep count, check total WORK parts capacity
            // Assume we need 5 WORK parts per source when it's in one creep

            //console.log("Source ", sourceId, " has ", attachedWorkParts, " work parts attached, slots=", slots, " creepsCount=", attachedCreeps.length, " in room ", room.name);
            var hasContainer = source.container || source.storage || source.link;

            var needMore = attachedWorkParts <= 4 && attachedCreeps.length < slots;
            //var needMore2 = !hasContainer && attachedCreeps.length < 2 * slots;


            if (needMore) {
                var pathLen = source.pos.findPathTo(spawn.pos, { ignoreCreeps: true }).length;

                if (pathLen > 15 && (!source.container && !source.link)) {
                    //console.log("skip harvesting long location without container. dist = ", pathLen, source.room);
                    room.visual.circle(source.pos, { fill: 'transparent', radius: 0.5, stroke: 'red' });
                    continue;
                }

                mem.role = 'harvester';
                mem.parts = this.getBodyParts(room.energyAvailable, hasContainer ? "harvesterContainer" : "harvester");

                //if (source.room.name != room.name)
                //    mem.parts = this.getBodyParts(1000, "remoteHarvester");

                mem.preferredSourceId = sourceId;

                // prefill preferred target id intead of logic in harvester
                break;
            }
        }


        // BUILDER PLANNING
        var buildSize = _.sum(room.find(FIND_CONSTRUCTION_SITES), site => site.progressTotal - site.progress);
        var needBuild = buildSize > 0;
        var numBld = 1;
        //console.log("Room ", room.name, " build size ", buildSize);
        // Why? priority to building instead of updating
        if (room.controller.level <= 4) {
            numBld = sources.length + 1;
            // 1 builder per source to speed up building in the beginning
        }

        // Why? - Increased building ok
        if (room.storage && room.storage.store.energy > RICH_ROOM_ENERGY && buildSize > 10000) {
            numBld = 2;
        }




        // UPGRADER PLANNING
        // plan using capacity of upgrade parts depending on available energy, that will allow to put more parts in one creep instead of several standard
        var upgradePartsNeeded = 15; // for 2 sources 

        if (sources.length == 1)
            upgradePartsNeeded = 5;

        // do not upgrade if need build for small levels 
        // in reality it has to be more complex - check actual energy capacity
        // building is really killing rooms dont increaase it PLEASE
        var hasLowEnergy =
            (room.controller.container ? room.controller.container.store.energy < 1000 : false) ||
            (room.spawn.container ? room.spawn.container.store.energy < 1000 : false) ||
            (room.storage ? room.storage.store.energy < 2000 : false);

        var hasLotsOfEnergy =
            (room.controller.container && room.controller.container.store.energy > 1500) ||
            (room.spawn.container && room.spawn.container.store.energy > 1500) ||
            (room.storage && room.storage.store.energy > 15000);

        var hasHugeEnergySurplus = room.storage && room.storage.store.energy > 200000;

        room.memory.hasLowEnergy = hasLowEnergy;
        room.memory.hasLotsOfEnergy = hasLotsOfEnergy;

        // do not upgrade if need build for poor rooms
        if (hasLowEnergy && needBuild &&
            room.controller.ticksToDowngrade > 2 * CREEP_LIFE_TIME) {
            upgradePartsNeeded = 0;
        }

        var hasEnoughSlots = room.name != "1E52S22";
        if (hasLotsOfEnergy && hasEnoughSlots && !needBuild)
            upgradePartsNeeded += 3;

        if (hasHugeEnergySurplus && room.controller.level < 8) {
            upgradePartsNeeded += 10;
        }

        // always upgrade to level 2
        if (room.controller.level == 1)
            upgradePartsNeeded = 5;

        if (room.controller.level == 8)
            upgradePartsNeeded = 15; // throttled on 8th level



        // do not count creeps close to death, that will be replaced anyway

        var upgraders = _.filter(roomCreeps, (creep) => creep.memory.role == 'upgrader');

        var upgradersLong = _.filter(roomCreeps, (creep) => creep.memory.role == 'upgrader' &&
            creep.ticksToLive > 150);
        

        var existingUpgradeParts = _.sum(upgraders, u => u.getActiveBodyparts(WORK));
        var existingUpgradePartsLong = _.sum(upgradersLong, u => u.getActiveBodyparts(WORK));

        var gapUpgradeParts = 0;

        if(upgradePartsNeeded - existingUpgradeParts > 0)
            gapUpgradeParts = upgradePartsNeeded - existingUpgradePartsLong;


        // around spawn local deliverer
        // TODO: refactor spec delivers 1) change value to dynamic calculation
        if (mem.role == null) {
            var specDelivers = _.filter(deliverers, d => !d.memory.preferredSourceId);
            var size = 50; // rough estimage


            size = (room.controller.level) * 50;


            if (room.storage && room.storage.store.energy > 100000)
                size += 100;
            // spawn
            // spawn.container
            // room.storage
            // room.terminal
            var numLocals = 1;
            if (room.name == "E48S27")
                numLocals = 2;

            if (room.spawn.container || room.storage)
                if (specDelivers.length < numLocals) {
                    var roomSwpawnRoaded = room.controller.level >= 3;
                    if (roomSwpawnRoaded)
                        mem.parts = utils.getBodyParts(Math.min(room.energyAvailable, size * 1.5), "delivererLight");
                    else
                        mem.parts = utils.getBodyParts(Math.min(room.energyAvailable, size * 2), "deliverer");

                    mem.role = 'deliverer';
                }
        }

        //if (room.name == "E48S27")
        //    console.log(room.name, " ",mem.role, " ", mem.parts);

        // FROM SOURCE CONTAINER TO BASE
        if (mem.role == null) {
            sources.forEach(source => {
                if (source.isNearBase || !source.container || source.link) {
                    return;
                }

                // do not double deliver from controller container
                //console.log(room.controller.container, source.id);
                if (room.controller.container && source.container.id == room.controller.container.id)
                    return;

                var amnt = 5 * HARVEST_POWER;
                //console.log("externalCoutnainer Ready", externalSource.container);
                // reduce for small rooms cause harvesting is small


                // optimizations for small room -cause only 4 harvest parts can fit in 550 energy
                if (room.controller.level <= 2)
                    amnt = 4 * HARVEST_POWER;

                // optimizations for small room - for 2nd level even less is possible, maybe do not create deliverers at all 
                if (room.controller.level <= 2 && room.energyCapacityAvailable < 550)
                    amnt *= 0.5;


                // sometimes becuase of traffic deliverers fall behind and containers are overfilled
                // temporarily increase delivery amount
                if (source.container.store.energy > 1800)
                    amnt *= 1.2;

                var tgt;

                if (room.storage)
                    tgt = room.storage.id;
                else if (room.spawn.container)
                    tgt = room.spawn.container.id;
                else
                    tgt = room.spawn.id;

                var res = this.createDeliverer(source.container.id, tgt, amnt, RESOURCE_ENERGY);

                if (res && room.spawn && tgt == room.spawn.id)
                    res.preferredTargetId = undefined;

                if (res && room.spawn.container && tgt == room.spawn.container.id)
                    res.preferredTargetId = undefined;


                if (res != null) {
                    mem = res;
                }
            });

        }

        // FROM BASE TO CONTROLLER

        if (mem.role == null && upgradePartsNeeded > 0) {
            if (room.controller.container &&
                (room.spawn.container || room.storage) &&
                !room.controller.storage &&
                !room.controller.link &&
                room.controller.container.store[RESOURCE_ENERGY] < 500) {

                // 
                var amnt = upgradePartsNeeded * UPGRADE_CONTROLLER_POWER;

                if (room.controller.pos.findInRange(FIND_SOURCES, 3).length > 0)
                    amnt -= 10; // 1 source equivalent

                // if not two sources are active (have containers or links)

                var src;

                if (room.storage)
                    src = room.storage.id;
                else if (room.spawn.container)
                    src = room.spawn.container.id;

                var res = this.createDeliverer(src, room.controller.container.id, amnt, RESOURCE_ENERGY);


                //console.log("Created ", amnt, " for controller deliver", " room=", room.name, " src=", src, " target=", room.controller.container.id);

                if (res != null) {
                    mem = res;
                }
            }
        }


        // MINERAL HARVESTER
        var needMinerals = roleMineralHarvester.needHarvester(room) &&
            room.storage.store[RESOURCE_ENERGY] > RICH_ROOM_ENERGY;

        room.memory.needMineralHarvester = needMinerals;

        // MINERAL deliverer
        if (mem.role == null) {
            if (mineralHarvesters.length > 0 &&
                (_.sum(room.extractor.container.store) > CONTAINER_CAPACITY * 0.5)) {
                var amountPerSec = _.sum(_.map(mineralHarvesters, m => m.getActiveBodyparts(WORK))) * HARVEST_MINERAL_POWER / EXTRACTOR_COOLDOWN;

                var targetId = room.storage.id;
                var terminalWatermark = 0.8;
                if (room.terminal && _.sum(room.terminal.store) < terminalWatermark * room.terminal.storeCapacity)
                    targetId = room.terminal.id;

                var res = this.createDeliverer(room.extractor.container.id, targetId, amountPerSec);

                if (res != null)
                    mem = res;
            }
        }

        var needAttack = room.find(FIND_HOSTILE_CREEPS).length > 0 && room.towers.length == 0;
        var largeEnemies = room.find(FIND_HOSTILE_CREEPS,
            {
                filter: (c => c.getActiveBodyparts(ATTACK) > 10 ||
                    c.getActiveBodyparts(RANGED_ATTACK) > 10 && (c.owner.username != ""))
            });

        if (largeEnemies.length > 0)
            needAttack = true;

        var attackers = _.filter(roomCreeps, (creep) => creep.memory.role == 'attack');

        var energyBudget = room.energyCapacityAvailable; // max possible


        // only builders allowed in early game
        if (isEarlyGame) {

            mem = new Object();

            if (builders.length < 3 * sources.length && mem.role == null)
                mem.role = "builder";

            if (upgraders.length < 1 && mem.role == null) {
                mem.role = "upgrader";
            }



            if (roomCreeps.length == 0)
                energyBudget = Math.max(300, room.energyAvailable); // use as min energy in start as possible
        }
        else if (needAttack && attackers.length == 0) {
            mem = new Object();
            mem.role = "attack";
        }
        else if (spawnOrders && spawnOrders.attackRoom) {
            mem = new Object();
            mem.role = "attack";
            mem.toGo = [spawnOrders.attackRoom];
        }
        else if (mem.role != null) {
            // parts already created where?
        }
        else if (needBuild && builders.length < numBld) {
            mem.role = "builder";
        }
        else if (gapUpgradeParts > 0) {
            mem.role = 'upgrader';

            // fix this for links
            //this.isRoaded(spawn, room.controller.container, room)

            // we will assume it's all roaded in auto rooms
            var isRoaded = true;
            if (isRoaded) {
                //console.log("Upgrader light for roading in ", room.name);
                mem.parts = utils.createUpgraderBody(gapUpgradeParts, room);
            }

        }
        else if (mineralHarvesters.length < 1 && needMinerals) {
            mem.role = 'mineralHarvester';
        }
        else if (spawnOrders && spawnOrders.scoutRoom) {
            mem.role = 'scout';
            mem.parts = [MOVE];

            //var scoutRoomMemory = Memory.rooms[spawnOrders.scoutRoom];

            //console.log("Need aggressive scout for ", scoutRoomMemory, "=", needAggressiveScout);
            mem.toGo = [spawnOrders.scoutRoom];
        }
        else if (repl) {
            //console.log("creating replacement");
            mem = repl;
        }
        else if (mem.role == "deliverer") {
            // do local deliverers
        }
        else if (spawnOrders && spawnOrders.claimRoom) {
            mem.role = "claim";
            mem.toGo = [spawnOrders.claimRoom];
        }
        else if (spawnOrders && spawnOrders.buildRoom) {
            mem.role = "builder";
            mem.toGo = [spawnOrders.buildRoom];
        }
        else if (spawnOrders && spawnOrders.reserveRoom) {
            mem.role = "reserve";
            mem.toGo = [spawnOrders.reserveRoom];
        }
        else if (spawnOrders && spawnOrders.memory) {
            mem = spawnOrders.memory;
        }
        else if (room.controller.safeModeAvailabe < 6) {
            if (room.storage && room.storage.store[RESOURCE_GHODIUM] > 1000) {
                mem.role = "safeModeEnabler";
            }
        }





        // TODO : bug here - it can stuck when level 2 energy 356 and no creeps
        // it's not early game and energy was <= 300 condition
        // was stuck again with 450 energy and 0 creeps
        room.memory.coldStart = !isEarlyGame && roomCreeps.length < 3;
        
        if (room.memory.coldStart) {

            if (mem.role == "deliverer" && deliverers.length == 0 && room.controller.level <= 6 && room.energyAvailable < 300) {
                // more proper amount
                mem.parts = [CARRY, MOVE]
                console.log(room.name, " low deliverer budget=", energyBudget);

            }

            if (roomCreeps.length < 3 || harvesters.length == 0) { //TODO poor harvester condition{
                energyBudget = room.energyAvailable; // use as min energy in start as possible
                console.log(room.name, " low creeps budget=", energyBudget);
                //mem.parts = [CARRY,  CARRY, MOVE, MOVE]
            }

            var deliverersBase = _.filter(deliverers,
                d => d.memory.preferredSourceId == undefined);

            if (room.storage && room.storage.store[RESOURCE_ENERGY] > 1000
                && deliverersBase.length == 0) {
                console.log(room.name, " low creeps budget deliverer=", energyBudget);
                energyBudget = room.energyAvailable;

                // create small local deliverer
                mem.role = "deliverer";
                mem.parts = [CARRY, MOVE];
                mem.preferredSourceId = undefined;
            }
        }


        var string =
            "upgradePartsNeeded=" + upgradePartsNeeded +
            " upgradeGap=" + gapUpgradeParts +
            " numBld=" + numBld +
            " energyAvailable=" + room.energyAvailable +
            " energyCapacity=" + room.energyCapacityAvailable +
            " role=" + mem.role;//" memory=" + JSON.stringify(mem);

        room.memory.planning = string;

        if (mem.role != undefined && !spawn.spawning) {
            //console.log(energyBudget);

            var parts = mem.parts;
            if (parts == undefined)
                parts = utils.getBodyParts(energyBudget, mem.role);

            mem.parts = undefined; // saving memory
            mem.motherland = room.name;

            if (parts.length != 0) {
                var name = mem.role + Math.floor(Math.random() * 10000);

                //console.log(room.name, 'Spawning new creep: ', mem.role, name, " with parts ", parts, " energyBudget=", energyBudget);
                var code = spawn.spawnCreep(parts, name, { memory: mem });

                if (OK == code) {
                    //console.log(spawn.name + ' is spawning new : ' + mem.role + " with " + parts + " - " + code);
                    if (repl && oldest) {
                        oldest.memory.replaced = true;
                    }
                }
                else {
                    console.log(room.name, 'Spawn error: ' + utils.getError(code), " for ", mem.role, " parts=", parts);
                }
            }
            else {
                console.log(room.name, 'not enough money yet for ' + mem.role, " budget=", energyBudget, " memory=", JSON.stringify(mem));
            }
        }
    },

    isRoaded(from, target, room) {
        if (target == undefined || from == undefined)
            return false;


        //console.log("checking roading from ", pos, " to ", target);
        var path = from.pos.findPathTo(target, { range: 1, ignoreCreeps: true });



        return this.isPathRoaded(path, room)
    },


    isPathRoaded: function (path, room) {
        if (path.length <= 2)
            return true;

        //this.drawPath(path, room, 'blue');
        // exclucde first and last pos, where creep will stand on, so only middle road is checked
        var middlePath = path.slice(1, path.length - 1);
        var roaded = _.every(middlePath, p => {
            var look = room.lookForAt(LOOK_STRUCTURES, p.x, p.y);
            var yesRoad = look.some(s => s.structureType == STRUCTURE_ROAD)
            return yesRoad;
        });

        //sconsole.log("isPathRoaded =", roaded, " for ", path.length, " steps");
        return roaded;
    },

    /**
     * Create an upgrader body limited by gapUpgradeParts and room energy capacity.
     * @param {number} gapUpgradeParts - Maximum number of WORK parts to add.
     * @param {Room} room - The room object to use for energy limits.
     * @returns {string[]} Array of body parts.
     */
    createUpgraderBody: function (gapUpgradeParts, room) {
        var maxWork = Math.max(0, gapUpgradeParts);
        var energyBudget = room.energyCapacityAvailable;
        var parts = [MOVE, CARRY];
        var workParts = [];
        var workCost = BODYPART_COST[WORK];
        var baseCost = BODYPART_COST[MOVE] + BODYPART_COST[CARRY];
        var usedEnergy = baseCost;
        for (var i = 0; i < maxWork; i++) {
            if (usedEnergy + workCost > energyBudget) break;
            workParts.push(WORK);
            usedEnergy += workCost;
        }
        parts = parts.concat(workParts);
        return parts;
    },

    getPathMultiroom: function (from, to, r = 1) {
        if (from.room.name == to.room.name)
            return from.pos.findPathTo(to.pos, { range: r, ignoreCreeps: true });

        let goals = _.map([to], function (s) {
            return { pos: s.pos, range: r };
        });

        let ret = PathFinder.search(from.pos, goals, {});

        return ret.path;
    }
    ,
    createDeliverer: function (fromId, toId, energyPerTick, resType) {
        if (fromId == toId)
            return null;

        var existing = _.filter(Game.creeps,
            d => d.memory.role == "deliverer" &&
                d.memory.preferredSourceId == fromId);

        // there are cases when we specify only source not target, to deliver everywhere on base
        //&&
        //d.memory.preferredTargetId == toId);

        var existingCapacity = _.sum(_.map(existing, e => e.getActiveBodyparts(CARRY) * CARRY_CAPACITY));

        var from = Game.getObjectById(fromId);
        var to = Game.getObjectById(toId);

        if (!from || !to) {
            console.log('deliverer: TO or FROM not exist', fromId, '->', toId);
            return null;
        }

        var path = this.getPathMultiroom(from, to);

        //console.log("cost analysis path", path);
        if (!path || path.length == 0) {
            console.log('deliverer cannot find path ', from.room, ' ', fromId, '->', toId);

            return null;
        }

        // -1 because path includes starting pos
        // +2 is turnaround delay tbd to remove it (currently 0)
        var travelTime = (path.length - 1) * 2 + 1;

        var pathRoaded = this.isPathRoaded(path, from.room);

        if (pathRoaded) {
            //console.log('deliverer all roaded ', fromId, '->', toId);
        }
        // travelTime += pathRoaded.length; // 1 tick per non-road
        var requiredCapacity = travelTime * energyPerTick;

        var remainingCapacity = requiredCapacity - existingCapacity;

        if (travelTime > 170)
            console.log("delivery tax for ",
                fromId, '->', toId, " travelTime=", travelTime,
                " requiredCapacity=", requiredCapacity, " energyPerTick=", energyPerTick,
                "taxPerTick=", requiredCapacity / CREEP_LIFE_TIME
            );
        //if(requiredCapacity > existingCapacity)
        //console.log('deliverer capacity diff', fromId, '->', toId, ' required=', requiredCapacity, ' existing=', existingCapacity, ' remaining=', remainingCapacity);

        if (remainingCapacity <= 0) {
            return null;
        }

        if (remainingCapacity <= 50 && resType == RESOURCE_ENERGY && existingCapacity > 0) {
            //console.log('deliverer already exists between ', fromId, '->', toId);
            return null;
        }

        var carryParts = Math.ceil(remainingCapacity / CARRY_CAPACITY);
        var moveParts = carryParts

        var parts = "deliverer";
        if (pathRoaded) {
            carryParts += carryParts % 2; // round up for roaded
            moveParts = Math.ceil(carryParts / 2);
            parts = "delivererLight";
        }

        var bodyPartsEnergy = carryParts * BODYPART_COST[CARRY] +
            moveParts * BODYPART_COST[MOVE];

        const room = to.room;

        if (bodyPartsEnergy > room.energyCapacityAvailable) {
            //console.log("limiting data from to", bodyPartsEnergy, "->", room.energyCapacityAvailable);
            bodyPartsEnergy = room.energyCapacityAvailable;
        }

        //console.log('deliverer creating new between ', fromId, '->', toId, ' carryParts=', carryParts, ' moveParts=', moveParts, ' bodyPartsEnergy=', bodyPartsEnergy, ' travelTime=', travelTime);
        var mem = new Object();
        mem.parts = utils.getBodyParts(bodyPartsEnergy, parts);
        mem.role = "deliverer";
        mem.preferredSourceId = fromId;
        mem.preferredTargetId = toId;
        mem.travelTime = travelTime;
        if (resType)
            mem.preferredResourceType = resType;

        return mem;
    }
    ,
    getError2: function (code) {
        var objprops = Object.getOwnPropertyNames(this).filter(n = n.startsWith("ERR_"));
    },

    getError: function (code) {
        switch (code) {
            case OK:
                // 0
                return "OK";
            case ERR_NOT_OWNER:
                // -1
                return "ERR_NOT_OWNER";
            case ERR_NO_PATH:
                // -2
                return "ERR_NO_PATH";
            case ERR_NAME_EXISTS:
                // -3
                return "ERR_NAME_EXISTS";
            case ERR_BUSY:
                //-4
                return "ERR_BUSY";
            case ERR_NOT_FOUND:
                // -5
                return "ERR_NOT_FOUND";
            case ERR_NOT_ENOUGH_ENERGY:
            case ERR_NOT_ENOUGH_RESOURCES:
            case ERR_NOT_ENOUGH_EXTENSIONS:
                // -6
                return "ERR_NOT_ENOUGH_";
            case ERR_INVALID_TARGET:
                // -7
                return "ERR_INVALID_TARGET";
            case ERR_FULL:
                // -8
                return "ERR_FULL";
            case ERR_NOT_IN_RANGE:
                // -9
                return "ERR_NOT_IN_RANGE";
            case ERR_INVALID_ARGS:
                // -10
                return "ERR_INVALID_ARGS";
            case ERR_TIRED:
                // -11
                return "ERR_TIRED";
            case ERR_NO_BODYPART:
                // -12
                return "ERR_NO_BODYPART";
            case ERR_RCL_NOT_ENOUGH:
                // -14
                return "ERR_RCL_NOT_ENOUGH";
        }
        return code + " code not found";
    }
    ,

    getBodyParts: function (currentEnergy, role) {
        //console.log("getBodyParts for role ", role, " with energy ", currentEnergy);

        if (role == "claim")
            return [CLAIM, MOVE];





        if (role == "remoteBuilder")
            return [
                [CARRY, MOVE,
                    CARRY, MOVE,
                    WORK, MOVE],
                [WORK, MOVE, WORK, MOVE]];

        var attackParts =
            [
                [MOVE, TOUGH, MOVE, TOUGH, MOVE, TOUGH],
                [ATTACK, MOVE], [ATTACK, MOVE], [ATTACK, MOVE], [HEAL, MOVE],
                [ATTACK, MOVE], [ATTACK, MOVE], [ATTACK, MOVE], [HEAL, MOVE],
                [ATTACK, MOVE], [ATTACK, MOVE], [ATTACK, MOVE], [HEAL, MOVE]

            ];


        var deliverParts = [
            [MOVE, CARRY],
            [MOVE, CARRY],
            [MOVE, CARRY],
            [MOVE, CARRY],
            [MOVE, CARRY],

            [MOVE, CARRY],
            [MOVE, CARRY],
            [MOVE, CARRY],
            [MOVE, CARRY],
            [MOVE, CARRY],

            [MOVE, CARRY],
            [MOVE, CARRY],
            [MOVE, CARRY],
            [MOVE, CARRY],
            [MOVE, CARRY],

            [MOVE, CARRY],
            [MOVE, CARRY],
            [MOVE, CARRY],
            [MOVE, CARRY],
            [MOVE, CARRY],

            [MOVE, CARRY],
            [MOVE, CARRY],
            [MOVE, CARRY],
            [MOVE, CARRY],
            [MOVE, CARRY]
        ];

        var deliverLightParts = [
            [MOVE, CARRY, CARRY],
            [MOVE, CARRY, CARRY],
            [MOVE, CARRY, CARRY],
            [MOVE, CARRY, CARRY],
            [MOVE, CARRY, CARRY],

            [MOVE, CARRY, CARRY],
            [MOVE, CARRY, CARRY],
            [MOVE, CARRY, CARRY],
            [MOVE, CARRY, CARRY],
            [MOVE, CARRY, CARRY],

            [MOVE, CARRY, CARRY],
            [MOVE, CARRY, CARRY],
            [MOVE, CARRY, CARRY],
            [MOVE, CARRY, CARRY],
            [MOVE, CARRY, CARRY],

            [MOVE, CARRY, CARRY],
            [MOVE, CARRY] // 50        
        ];


        //var upgraderParts       = [MOVE, CARRY, WORK ,WORK ,WORK, WORK, WORK, MOVE, MOVE ,MOVE,MOVE];
        var upgraderParts = [
            [CARRY, MOVE],
            [WORK, MOVE],
            [WORK, MOVE],
            [WORK, MOVE],
            [WORK, MOVE],
            [WORK, MOVE]];

        var upgraderLightParts = [
            [CARRY, MOVE, WORK, WORK, WORK, WORK, WORK],
            [WORK, WORK, WORK, WORK, WORK],
            [WORK, WORK, WORK, WORK, WORK]];



        var harvesterParts = [
            [CARRY, MOVE],
            [WORK, MOVE],
            [WORK, MOVE],
            [WORK, WORK],
            [WORK, MOVE],
            [WORK, MOVE]
        ];

        var harvesterContainerParts = [CARRY, MOVE, WORK, WORK, WORK, WORK, WORK,
            MOVE, MOVE];

        var remoteHarvesterParts = [MOVE, CARRY, WORK, WORK, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE, MOVE, MOVE];
        var mineralHarvesterParts = [MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY];

        var parts = [MOVE, CARRY, WORK, WORK, WORK,
            MOVE, MOVE, CARRY, WORK, WORK,
            MOVE];

        // additional work would benefit on early game
        var builderParts = [
            [MOVE, WORK, MOVE, CARRY],
            [MOVE, WORK], [MOVE, CARRY],
            [MOVE, WORK], [MOVE, CARRY],
            [MOVE, WORK], [MOVE, CARRY],
            [MOVE, WORK], [MOVE, CARRY]
        ];

        if (role == "reserve")
            parts = [[CLAIM, MOVE], [CLAIM, MOVE]];

        if (role == 'attack') {
            parts = attackParts;
        }
        if (role == 'builder')
            parts = builderParts;

        if (role == "deliverer")
            parts = deliverParts;

        if (role == "upgraderLight")
            parts = upgraderLightParts;

        if (role == "delivererLight")
            parts = deliverLightParts;

        if (role == "mineralHarvester") {
            parts = mineralHarvesterParts;
            currentEnergy = this.getPartsCost(mineralHarvesterParts);
        }

        if (role == "remoteHarvester") {
            parts = remoteHarvesterParts;
            currentEnergy = this.getPartsCost(remoteHarvesterParts);
        }

        if (role == "upgrader") {
            parts = upgraderParts;
            if (currentEnergy > this.getPartsCost(upgraderParts))
                currentEnergy = this.getPartsCost(upgraderParts);
        }

        if (role == "harvester") {
            parts = harvesterParts;
            if (currentEnergy >= this.getPartsCost(harvesterParts)) {
                currentEnergy = this.getPartsCost(harvesterParts);
            }
        }

        if (role == "harvesterContainer") {

            parts = harvesterContainerParts;
        }

        // why? ok only with deliverer?
        if (currentEnergy < 300 && role != "deliverer" && role != "delivererLight")
            return [];

        //console.log(role, ' get part for ' + currentEnergy, " ");
        return this.prefillParts(currentEnergy, parts);
    },

    prefillParts: function (budget, parts) {
        var res = [];

        // clone parts so we don't mutate caller's template arrays
        parts = parts.slice();

        while (budget > 0) {
            var next = parts[0];
            if (!next)
                break;

            // next can be either a single part (e.g. MOVE) or an array of parts (group)
            var partCost = 0;
            if (Array.isArray(next)) {
                for (var i = 0; i < next.length; i++) {
                    var p = next[i];
                    partCost += BODYPART_COST[p.toLowerCase()];
                }
            } else {
                partCost = BODYPART_COST[next.toLowerCase()];
            }

            if (budget < partCost)
                break;

            budget -= partCost;

            if (Array.isArray(next)) {
                // push all parts from the group in order
                for (var j = 0; j < next.length; j++) {
                    res.push(next[j]);
                }
            } else {
                res.push(next);
            }

            parts.shift();
        }
        //console.log("  -> created parts: ", res, " total cost=", this.getPartsCost(res));
        return res.sort().reverse();
    },

    getPartsCost: function (parts) {
        var costs = _.map(parts, p => {
            // If p is an array (group of parts), sum the cost of each part in the group
            if (Array.isArray(p)) {
                return _.sum(_.map(p, part => BODYPART_COST[part.toLowerCase()]));
            } else {
                // If p is a single part, get its cost
                return BODYPART_COST[p.toLowerCase()];
            }
        });

        return _.sum(costs);
    },

    safeModeIfDanger: function (room) {

        // activate safe mode if creep was killed or structure was destroyed
        let eventLog = room.getEventLog();

        var eventTypes = [EVENT_ATTACK, EVENT_OBJECT_DESTROYED];

        if (!room.memory.events)
            room.memory.events = {};

        // Log counters for each event type
        for (var eventType of eventTypes) {
            let events = _.filter(eventLog, function (ev) {
                return ev.event === eventType && (ev.type == EVENT_OBJECT_DESTROYED && ev.data.type !== "creep");
            });

            if (!room.memory.events[eventType])
                room.memory.events[eventType] = [];

            // Append each event to the list
            for (var event of events) {
                room.memory.events[eventType].push({
                    time: Game.time,
                    event: event
                });
            }

            // Clear old events if list is larger than 30
            if (room.memory.events[eventType].length > 10) {
                room.memory.events[eventType] = room.memory.events[eventType].slice(-30);
            }
        }

    }

};

module.exports = utils;

