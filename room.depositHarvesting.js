var utils = require("utils");

const MAX_COOLDOWN = 180;
const MAX_ROUTE_DISTANCE = 150;

const HARVEST_BUFFER = 150;

var roomDepositHarvesting = {
    assignDepositHarvestingRooms: function () {
        if (!Memory.observer || !Memory.observer.rooms)
            return;

        var eligibleRooms = _.chain(Game.rooms)
            .filter(function (room) {
                var enoughEnergy = room.storage && room.storage.store[RESOURCE_ENERGY] > utils.RICH_ROOM_ENERGY;
                // level 7 to have several spawns
                return room && room.controller &&
                    room.controller.my && room.controller.level >= 7 && enoughEnergy;
            })
            .map(function (room) {
                return room.name;
            })
            .value();

        if (!eligibleRooms || eligibleRooms.length == 0)
            return;

        for (var roomName in Memory.observer.rooms) {
            var observedRoom = Memory.observer.rooms[roomName];
            var bestDeposit = null;

            if (!observedRoom || !observedRoom.deposits || observedRoom.deposits.length == 0)
                continue;

            for (var i = 0; i < observedRoom.deposits.length; i++) {
                var observedDeposit = observedRoom.deposits[i];
                if (!this.isHarvestableDeposit(observedDeposit))
                    continue;

                if (!bestDeposit || this.isBetterDeposit(observedDeposit, bestDeposit))
                    bestDeposit = observedDeposit;
            }

            if (!bestDeposit)
                continue;

            if (utils.isRoomAssignedToHarvestingMemory(roomName, "depositHarvesting"))
                continue;

            var closestAssignment = utils.getClosestRoomAssignment(roomName, eligibleRooms);
            if (!closestAssignment.roomName)
                continue;

            if (closestAssignment.distance > MAX_ROUTE_DISTANCE)
                continue;

            var assignedRoom = Game.rooms[closestAssignment.roomName];
            if (!assignedRoom)
                continue;

            if (!assignedRoom.memory.depositHarvesting)
                assignedRoom.memory.depositHarvesting = [];

            if (assignedRoom.memory.depositHarvesting.indexOf(roomName) == -1) {
                assignedRoom.memory.depositHarvesting.push(roomName);
                console.log("Deposit harvesting assigned ", roomName,
                    " to ", closestAssignment.roomName,
                    " type ", bestDeposit.depositType,
                    " cooldown ", bestDeposit.cooldown,
                    " decay ", bestDeposit.ticksToDecay,
                    " distance ", closestAssignment.distance);
            }
        }
    },

    getDepositHarvestingOrder: function (roomName) {
        var parentRoom = Game.rooms[roomName];
        if (!parentRoom)
            return;

        if (!parentRoom.memory.depositHarvesting || parentRoom.memory.depositHarvesting.length == 0)
            return;

        // remove old harvest targets from memory
        for (var i = parentRoom.memory.depositHarvesting.length - 1; i >= 0; i--) {
            var assignedRoomName = parentRoom.memory.depositHarvesting[i];
            var observedRoom = Memory.observer.rooms[assignedRoomName];

            if (!observedRoom)
                continue;


            if (!observedRoom.deposits || observedRoom.deposits.length == 0) {

                console.log("No harvestable deposit in observed room ", assignedRoomName,
                    " anymore, removing from deposit harvesting list of ", roomName);
                parentRoom.memory.depositHarvesting.splice(i, 1);
            }
        }

        if (parentRoom.memory.depositHarvesting.length == 0)
            return;

        for (var roomKey in parentRoom.memory.depositHarvesting) {
            var observedRoomName = parentRoom.memory.depositHarvesting[roomKey];
            var remoteRoom = Memory.observer.rooms[observedRoomName];

            if (!remoteRoom ||
                !remoteRoom.deposits ||
                remoteRoom.deposits.length == 0)
                continue;

            var route = Game.map.findRoute(parentRoom.name, observedRoomName);

            if (route == ERR_NO_PATH) {
                console.log("Deposit harvesting has no route from ", parentRoom.name, " to ", observedRoomName);
                continue;
            }

            var travelTicks = 50 * route.length;
            var spawnDelay = CREEP_SPAWN_TIME * MAX_CREEP_SIZE;
            var delay = spawnDelay + travelTicks + HARVEST_BUFFER;

            for (var depositKey in remoteRoom.deposits) {
                var deposit = remoteRoom.deposits[depositKey];

                if (!this.isHarvestableDeposit(deposit))
                    continue;

                var harvestWindow = deposit.ticksToDecay - delay;
                if (harvestWindow <= 0)
                    continue;

                //console.log("Deposit harvesting plan ", room.name,
                //    " -> ", observedRoomName,
                //    " type ", deposit.depositType,
                //    " cooldown ", deposit.cooldown,
                //    " decay ", deposit.ticksToDecay,
                //    " delay ", delay,
                //    " observed ", Game.time - remoteRoom.observedAt,
                //    " ticks ago");

                var harvesters = _.filter(Game.creeps,
                    c => c.memory.role == "depositHarvester" &&
                        c.memory.toGo && c.memory.toGo.includes(observedRoomName) &&
                        c.memory.tag == "depositHarvesting" + depositKey);

                var maxHarvesters = Math.max(1, deposit.slots || 1);

                var parts = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE,
                    WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK,
                    CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY];

                if (harvesters.length < maxHarvesters) {
                    var memory = {
                        role: "depositHarvester",
                        toGo: [observedRoomName],
                        tag: "depositHarvesting" + depositKey,
                        preferredSourceId: deposit.id,
                        parts: parts
                    };

                    return { memory: memory };
                }

                // at least 10 cooldown to avoid too high in initial seconds

                var cooldown = Math.max(deposit.cooldown, 10);
                var amnt = maxHarvesters * HARVEST_DEPOSIT_POWER * _.sum(parts, p => p == WORK ? 1 : 0) / (cooldown);

                var memory = utils.createDeliverer(deposit.id, parentRoom.storage.id,
                    amnt, deposit.depositType, 500);

                //console.log("Existing harvesters for deposit ", deposit.id, ": ", harvesters.length,
                //    " needed deliverer capacity ", amnt);

                if (memory) {
                    return { memory: memory };
                }
            }


            var remoteRoomObj = Game.rooms[observedRoomName];
            if (!remoteRoomObj) {
                //console.log("Remote room ", observedRoomName, " not visible, cannot check for defend flag,  skipping attack assignment for deposit harvesting");
                continue;
            }

            var hostileWorkers = remoteRoomObj.find(FIND_HOSTILE_CREEPS, { filter: c => c.getActiveBodyparts(WORK) > 0 });
            //if (hostileWorkers.length > 0) {
            //    console.log("Hostile workers in remote room ", observedRoomName, " found, skipping attack assignment for deposit harvesting");
            //}

            var defendFlag = remoteRoomObj.find(FIND_CREEPS,
                { filter: f => f.name.includes("defend") })[0];


            if (defendFlag || hostileWorkers.length > 0) {
                //console.log("Defending deposit in remote room ", observedRoomName, " found, skipping attack assignment for deposit harvesting");
                var attackers = _.filter(Game.creeps,
                    c => c.memory.role == "attack" &&
                        c.memory.toGo && c.memory.toGo.includes(observedRoomName) &&
                        (c.ticksToLive > 150 + 50 + 10 || c.spawning)
                );
                if (attackers.length < 1) {
                    var memory = utils.createAttackMemory(remoteRoomObj);

                    return { "memory": memory };
                }
            }
        }
    },

    isHarvestableDeposit: function (deposit) {
        if (!deposit)
            return false;

        if (deposit.ticksToDecay < CREEP_LIFE_TIME * 2)
            return false;

        if (deposit.cooldown > MAX_COOLDOWN)
            return false;

        return true;
    },

    isBetterDeposit: function (candidate, currentBest) {
        if (candidate.cooldown != currentBest.cooldown)
            return candidate.cooldown < currentBest.cooldown;

        if (candidate.ticksToDecay != currentBest.ticksToDecay)
            return candidate.ticksToDecay > currentBest.ticksToDecay;

        return candidate.id < currentBest.id;
    }
};

module.exports = roomDepositHarvesting;