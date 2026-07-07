var utils = require("utils");
var roomPlanning = require("room.planning");

const REMOTE_HARVESTING_ENERGY_STOP_THRESHOLD = 900000;

function isRemoteDelivererForRoom(creep, roomName) {
    if (creep.memory.role != "deliverer" || !creep.memory.preferredSourceId)
        return false;

    var source = Game.getObjectById(creep.memory.preferredSourceId);
    return !!(source && source.pos && source.pos.roomName == roomName);
}

function isAssignedToRemoteRoom(creep, roomName) {
    if (creep.memory.toGo && creep.memory.toGo.includes(roomName))
        return true;

    return isRemoteDelivererForRoom(creep, roomName);
}

function getRoomStoredEnergy(room) {
    var totalEnergy = 0;

    if (room.storage)
        totalEnergy += room.storage.store[RESOURCE_ENERGY] || 0;

    if (room.terminal)
        totalEnergy += room.terminal.store[RESOURCE_ENERGY] || 0;

    return totalEnergy;
}

var roomRemoteHarvesting = {
    getOrder: function (parentRoom) {

        if (!parentRoom.config.remoteHarvest)
            return;

        if (getRoomStoredEnergy(parentRoom) > REMOTE_HARVESTING_ENERGY_STOP_THRESHOLD)
            return;

        var memories = { "E56S24": 75076200, "E55S25": 75076200 };
        for (let roomName of parentRoom.config.remoteHarvest) {
            var roomMemory = memories[roomName];

            //console.log("Roo memory for remote room ", roomName, " is ", roomMemory, " " , Game.time);
            if (roomMemory && roomMemory > Game.time) {
                var creepsToRecycle = _.filter(Game.creeps,
                    c => c.memory.toGo && c.memory.toGo.includes(roomName));
                for (let creep of creepsToRecycle) {
                    creep.memory.task = "recycle";
                }
                console.log("Recycling " + creepsToRecycle.length + " creeps for remote room ", roomName, " in parent room ", parentRoom.name);
                continue;
            }

            var remoteRoom = Game.rooms[roomName];
            if (!remoteRoom) {

                var numScout = 1;

                var scouts = _.filter(Game.creeps, c => c.memory.role == "scout" &&
                    (c.memory.toGo && c.memory.toGo[0] == roomName));

                if (scouts.length < numScout) {

                    return { "scoutRoom": roomName };
                }

                continue;
            }

            var enemies = remoteRoom.find(FIND_HOSTILE_CREEPS,
                {
                    filter: (c => (c.getActiveBodyparts(ATTACK) > 0 || c.getActiveBodyparts(RANGED_ATTACK) > 0) &&
                        !(c.owner.username == "" || c.owner.username == "Source Keeper"))
                });

            var numAttack = 1;

            var veryDangerous = false;
            if (enemies.length >= 2) {
                remoteRoom.memory.dangerous = true;
                veryDangerous = true; // need one attacker per enemy in remote room, cause they can be far apart and we want to kill them all as fast as possible
            }

            if (veryDangerous)
                console.log(veryDangerous, enemies.length, " enemies in ", remoteRoom.name);

            if (veryDangerous) {
                //console.log("VERYVERY ", roomName, " is very dangerous with ", enemies.length, " enemies, sending more attackers");

                var creepsToRecycle = _.filter(Game.creeps,
                    c => isAssignedToRemoteRoom(c, roomName));

                var delivererToRecycle =
                    _.filter(creepsToRecycle, c => isRemoteDelivererForRoom(c, roomName));

                //console.log("Recycling ", delivererToRecycle.length, " deliverers for remote room ", roomName, " in parent room ", parentRoom.name);

                for (let creep of creepsToRecycle) {
                    creep.memory.task = "recycle";
                }
                //console.log("Recycling " + creepsToRecycle.length + " creeps for remote room ", roomName, " in parent room ", parentRoom.name);

                // TODO need to figure out a way to fight with trow boosted ranged soldiers in E56S24, maybe send more attackers or send them faster, currently they are just too strong and kill our harvesters before they can do anything

                continue;
            }

            var invaderCore = remoteRoom.find(FIND_STRUCTURES, { filter: s => s.structureType == STRUCTURE_INVADER_CORE })[0];
            if (invaderCore) {
                //enemies = enemies.concat(invaderCore);
                numAttack = 3;
            }

            var enemyReservation = remoteRoom.controller &&
                remoteRoom.controller.reservation &&
                !(remoteRoom.controller.reservation.username == "Zenga" ||
                    remoteRoom.controller.reservation.username == "Invader") &&
                remoteRoom.controller.reservation.ticksToEnd > 100;

            if (enemyReservation)
                numAttack = 3;

            var attackers = _.filter(Game.creeps,
                c => c.memory.role == "attack" &&
                    c.memory.toGo && c.memory.toGo.includes(roomName) &&
                    (c.ticksToLive > 150 + 50 + 10 || c.spawning)
            );

            var roomRegex = /([WE])(\d+)([NS])(\d+)/;
            var match = roomName.match(roomRegex);
            var x = match ? parseInt(match[2]) % 10 : 0;
            var y = match ? parseInt(match[4]) % 10 : 0;

            var centralRoom = x == 5 && y == 5; // rooms with coordinates like E45S25 are more central and usually have more traffic, so we want to send stronger creeps there
            var lairRoom = (x == 4 || x == 5 || x == 6) && (y == 4 || y == 5 || y == 6) && !centralRoom; // rooms with coordinates like E50S30 usually have lairs, so we want to send stronger creeps there



            var defendFlag = remoteRoom.find(FIND_FLAGS, { filter: f => f.name.includes("defend") })[0];

            if (lairRoom) {
                defendFlag = true;
            }

            var conquerFlag = remoteRoom.find(FIND_FLAGS, { filter: f => f.name.includes("conquer") })[0];

            remoteRoom.memory.dangerous = enemies.length > 0 || enemyReservation;

            var needAttack = remoteRoom.memory.dangerous || conquerFlag || invaderCore || defendFlag || lairRoom;

            if (needAttack) {
                if (attackers.length < numAttack) {
                    var memory = utils.createAttackMemory(remoteRoom);

                    return { "memory": memory };
                }

                // for invader core ok to proceed
                if (remoteRoom.memory.dangerous)
                    continue;
            }



            var remoteBuild = remoteRoom.find(FIND_CONSTRUCTION_SITES).length > 0;

            var trialRooms = ["E48S23", "E55S21", "E57S23", "E48S27", "E56S23", "E48S29", "E43S28", "E51S29", "E53S31", "E41S27"];

            var enableRemoteRoads = true;
            
            if (enableRemoteRoads)
                remoteBuild |= remoteRoom.find(FIND_STRUCTURES,
                    {
                        filter: s => s.structureType == STRUCTURE_ROAD &&
                            s.hits < s.hitsMax * 0.3
                    }).length > 0;

            if (remoteBuild) {
                var remoteBuilders = _.filter(Game.creeps, c => c.memory.role == "builder" && c.memory.toGo && c.memory.toGo.includes(roomName));
                if (remoteBuilders.length < 1) {
                    return { "buildRoom": roomName };
                }

                //continue;
            }

            var needReserve = false;

            // some rooms dont have controller like with spawns
            if (remoteRoom &&
                remoteRoom.controller &&
                remoteRoom.controller.reservation) {
                if (remoteRoom.controller.reservation.ticksToEnd < 1000) {
                    needReserve = true;
                }
            }
            else {
                if (remoteRoom && remoteRoom.controller)
                    needReserve = true;
            }

            var reservers = _.filter(Game.creeps,
                c => c.memory.role == "reserve" && c.memory.toGo &&
                    c.memory.toGo.includes(roomName));

            //console.log(room.name, needReserve, reservers);
            if (needReserve) {
                if (reservers.length == 0) {
                    return { "reserveRoom": roomName };
                }

                //continue;
            }

            var sources = remoteRoom.find(FIND_SOURCES);


            for (var source of sources) {
                if (!source.container) {
                    //console.log("Source ", source.id, " does not have container in remote room ", roomName);
                    roomPlanning.tryRoad(parentRoom.spawn, source, remoteRoom, 1, true);

                    continue;
                }

                if (enableRemoteRoads) {
                    //console.log("Trying to build road from ", parentRoom.spawn, " to ", source, " in ", remoteRoom.name);
                    roomPlanning.tryRoad(parentRoom.spawn, source.container, remoteRoom, 1, true);
                }

                var remoteHarvesterParts =
                    [MOVE, CARRY,
                        WORK, WORK, WORK, WORK, WORK, WORK,
                        MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];

                // replace with lair
                if (centralRoom || lairRoom) {
                    remoteHarvesterParts =
                        [
                            WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK,
                            MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE,
                            MOVE, MOVE, CARRY, CARRY];
                    // two carry for quick pickup of drops
                }

                var delay = Game.map.getRoomLinearDistance(parentRoom.name, remoteRoom.name) * 50
                    + remoteHarvesterParts.length * CREEP_SPAWN_TIME; // 50 to travel + 3*13 to create

                // Get all attached harvesters for this source
                var attachedCreeps = _.filter(Game.creeps, function (cr) {
                    return cr.memory.role == 'harvester' &&
                        cr.memory.preferredSourceId == source.id &&
                        (cr.ticksToLive > delay || cr.spawning);
                });



                if (attachedCreeps.length == 0) {
                    var memory = {
                        role: "harvester",
                        preferredSourceId: source.id,
                        toGo: [roomName],
                        parts: remoteHarvesterParts
                    };

                    return { "memory": memory };
                }

                var sourceEnergy = SOURCE_ENERGY_CAPACITY;
                if (lairRoom) {
                    // extra bonus for killing the keepers around every 300 ticks
                    var extraEnergy = 600 + 400 + 400;
                    // 400 = 10% more just to see if this will help to drop lack of deliverers
                    sourceEnergy = SOURCE_ENERGY_KEEPER_CAPACITY + extraEnergy;
                }
                else if (centralRoom)
                    sourceEnergy = SOURCE_ENERGY_KEEPER_CAPACITY;

                // around 5% of energy will be spent on container repair
                var amnt = 0.95 * sourceEnergy / ENERGY_REGEN_TIME; // 3000/300 = 10 per sec

                if (!parentRoom.storage)
                    console.log("No storage in parent room ", parentRoom.name, " for remote harvesting from ", roomName);
                var memory = utils.createDeliverer(source.container.id, parentRoom.storage.id, amnt, RESOURCE_ENERGY);

                if (memory) {
                    return { "memory": memory };
                }
            }

            if (remoteRoom.mineral && remoteRoom.extractor) {

                if (remoteRoom.mineral.mineralAmount <= 0) {
                    continue;
                }

                if (!remoteRoom.extractor.container) {
                    roomPlanning.tryRoad(parentRoom.spawn, remoteRoom.extractor, remoteRoom, 1, true);
                    continue;
                }

                roomPlanning.tryRoad(parentRoom.spawn, remoteRoom.extractor, remoteRoom, 1, true);


                var mineral = remoteRoom.mineral;
                var mineralContainer = remoteRoom.extractor.container;
                var mineralWorkParts = 15;
                var mineralHarvesterParts = utils.createWorkBody(mineralWorkParts, parentRoom, [MOVE, CARRY], 1);
                var mineralDelay = Game.map.getRoomLinearDistance(parentRoom.name, remoteRoom.name) * 50 +
                    mineralHarvesterParts.length * CREEP_SPAWN_TIME;

                var remoteMineralHarvesters = _.filter(Game.creeps, function (cr) {
                    return cr.memory.role == 'mineralHarvester' &&
                        cr.memory.preferredSourceId == mineral.id &&
                        cr.memory.toGo && cr.memory.toGo.includes(roomName) &&
                        (cr.ticksToLive > mineralDelay || cr.spawning);
                });

                if (remoteMineralHarvesters.length == 0) {
                    return {
                        "memory": {
                            role: "mineralHarvester",
                            preferredSourceId: mineral.id,
                            toGo: [roomName],
                            parts: mineralHarvesterParts
                        }
                    };
                }

                var extraForEnrgy = 5;
                var mineralAmountPerSec = utils.getMineralHarvestAmountPerSec(remoteMineralHarvesters)
                    + extraForEnrgy;
                var mineralDeliverer = utils.createMineralDeliverer(
                    mineralContainer.id,
                    parentRoom,
                    mineralAmountPerSec,
                    mineral.mineralType,
                    500
                );

                if (mineralDeliverer) {
                    return { "memory": mineralDeliverer };
                }


            }
        }
    }
};

module.exports = roomRemoteHarvesting;