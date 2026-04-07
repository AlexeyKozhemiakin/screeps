var utils = require("utils");

const HEADROOM = 500; // need to have some headroom to account for travel time and healing of power bank

var roomPowerHarvesting = {
    assignPowerHarvestingRooms: function () {

        if (!Memory.observer || !Memory.observer.rooms)
            return;

        var myLevel8Rooms = _.chain(Game.rooms)
            .filter(function (room) {

                var enoughEnergy = (room.storage && room.storage.store[RESOURCE_ENERGY] > 20000);
                var notEnoughPower = room.terminal && (room.terminal.store[RESOURCE_POWER] || 0) < 20000;

                return room && room.controller &&
                    room.controller.my && room.controller.level >= 8 && enoughEnergy && notEnoughPower;
            })
            .map(function (room) {
                return room.name;
            })
            .value();

        var result = [];

        for (var roomName in Memory.observer.rooms) {
            var observedRoom = Memory.observer.rooms[roomName];
            if (!observedRoom || !observedRoom.powerBank)
                continue;


            // already assigned to some room
            if (_.some(Game.rooms, r => r.memory.powerHarvesting && r.memory.powerHarvesting.includes(roomName)))
                continue;

            var hits = observedRoom.powerBank.hits || 0;
            var ticksToDecay = observedRoom.powerBank.ticksToDecay || 0;
            var requiredAttackParts = 0;

            if (ticksToDecay > 0) {
                requiredAttackParts = Math.ceil(hits / (ticksToDecay - HEADROOM) / ATTACK_POWER);
            }

            var closestLevel8Room = null;
            var closestLevel8Distance = null;

            for (var i = 0; i < myLevel8Rooms.length; i++) {
                var myRoomName = myLevel8Rooms[i];
                var distance = 50 * Game.map.getRoomLinearDistance(roomName, myRoomName);
                var route = Game.map.findRoute(roomName, myRoomName);
                if (route != ERR_NO_PATH) {
                    distance = 50 * route.length;
                }
                if (closestLevel8Distance === null || distance < closestLevel8Distance) {
                    closestLevel8Distance = distance;
                    closestLevel8Room = myRoomName;
                }
            }

            var efficiency = 1 - closestLevel8Distance / 1500;

            var cost = BODYPART_COST[ATTACK] + 2 * BODYPART_COST[MOVE] + BODYPART_COST[HEAL];
            cost = 65 * cost; // in credits for energy cost
            cost = cost / efficiency;


            if (ticksToDecay < 3000 ||
                closestLevel8Distance > 200 ||
                requiredAttackParts > 32 ||
                observedRoom.powerBank.power < 1500) // do not send creeps for small powerbanks, not worth the risk and cost
                continue;


            /*console.log("Power bank in ", roomName, " has hits ",
                hits, " ticksToDecay ", ticksToDecay,
                " requiredAttackParts ",
                requiredAttackParts, " closestLevel8Room ",
                closestLevel8Room, " closestLevel8Distance ",
                closestLevel8Distance, " efficiency ",
                efficiency.toFixed(2), " cost ",
                cost.toFixed(2));
            */

            var value = requiredAttackParts * cost / observedRoom.powerBank.power;

            var assignedRoom = Game.rooms[closestLevel8Room];

            if (!assignedRoom)
                continue;

            if (!assignedRoom.memory.powerHarvesting)
                assignedRoom.memory.powerHarvesting = [];

            if (!assignedRoom.memory.powerHarvesting.includes(roomName))
                assignedRoom.memory.powerHarvesting.push(roomName);

            result.push({
                roomName: roomName,
                observedAt: observedRoom.observedAt,
                observedBy: observedRoom.observedBy,
                hits: hits,
                power: observedRoom.powerBank.power,
                ticksToDecay: ticksToDecay,
                closestLevel8Room: closestLevel8Room,
                closestLevel8Distance: closestLevel8Distance,
                requiredAttackParts: requiredAttackParts,
                value: value,

            });
        }
    },

    getPowerHarvestingOrder: function (roomName) {

        var room = Game.rooms[roomName];
        if (!room)
            return;

        if (!Memory.observer || !Memory.observer.rooms) {
            room.memory.powerHarvesting = [];
            return;
        }

        if (!room.memory.powerHarvesting || room.memory.powerHarvesting.length == 0)
            return;

        for (var i = room.memory.powerHarvesting.length - 1; i >= 0; i--) {
            var staleObservedRoomName = room.memory.powerHarvesting[i];
            var staleObservedRoom = Memory.observer.rooms[staleObservedRoomName];
            if (!staleObservedRoom || !staleObservedRoom.powerBank) {
                console.log("No power bank in observed room ", staleObservedRoomName, " anymore, removing from harvesting list of ", roomName);
                room.memory.powerHarvesting.splice(i, 1);
            }
        }

        if (room.memory.powerHarvesting.length == 0)
            return;

        var powerBanks = [];
        for (var observedRoomName of room.memory.powerHarvesting) {
            var observedRoom = Memory.observer.rooms[observedRoomName];
            if (!observedRoom || !observedRoom.powerBank)
                continue;

            var hits = observedRoom.powerBank.hits || 0;
            var ticksToDecay = observedRoom.powerBank.ticksToDecay || 0;
            var requiredAttackParts = 0;

            if (ticksToDecay > 0) {
                requiredAttackParts = Math.ceil(hits / (ticksToDecay - HEADROOM) / ATTACK_POWER);
            }

            powerBanks.push({
                roomName: observedRoomName,
                id: observedRoom.powerBank.id,
                observedAt: observedRoom.observedAt,
                hits: hits,
                power: observedRoom.powerBank.power,
                ticksToDecay: ticksToDecay,
                requiredAttackParts: requiredAttackParts
            });
        }

        for (var bank of powerBanks) {
            console.log("Power bank in ", bank.roomName,
                "assigned to ", roomName, " has power ",
                " has ", bank.power,
                " hits ", bank.hits,
                " ticksToDecay ", bank.ticksToDecay,
                " attack ", bank.requiredAttackParts,
                " observed - ", Game.time - bank.observedAt, " ticks ago");


            // for each 4 x 30(attack_power) = 120 = 60 in damage = 5x12(heal power) heal needed
            const powerAttackParts =
                [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE,
                    MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE,

                    ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
                    ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,

                    ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
                    ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK];

            const powerhealerParts =
                [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE,
                    MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE,
                    HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL,
                    HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL
                ];

            // do not spawn attack/defense near end of life
            // also when attackers suicide then this code creates them again after powerbank disappears
            // but the observer didnt look here

            // potential bug here, some attackers die just before this.
            // need to do somehting to check it
            var route = Game.map.findRoute(roomName, bank.roomName);

            if (route == ERR_NO_PATH)
                return;

            var toTravel = 50 * route.length;
            var toCreate = CREEP_SPAWN_TIME * MAX_CREEP_SIZE;

            var delay = toCreate + toTravel + 100;

            if (bank.hits > 100000 && bank.ticksToDecay > 500) {
                var attackers = _.filter(Game.creeps,
                    c => c.memory.role == "attack" &&
                        c.memory.toGo && c.memory.toGo.includes(bank.roomName) &&
                        (c.ticksToLive > delay || c.spawning));

                var slots = 1; // to redo via fuction counting free slots

                if (attackers.length < slots) {
                    var memory = { role: "attack", toGo: [bank.roomName], parts: powerAttackParts };
                    memory.role = "attack";
                    return { "memory": memory };
                }

                var healers = _.filter(Game.creeps,
                    c => c.memory.role == "healer" &&
                        c.memory.toGo && c.memory.toGo.includes(bank.roomName) &&
                        (c.ticksToLive > delay || c.spawning));

                //console.log("Bank ", bank.roomName, " has ", attackers.length, " attackers and ", healers.length, " healers");
                console.log("Healer 1 in room ", healers.length > 0 ? healers[0].pos : "none", " has ticksToLive ", healers.length > 0 ? healers[0].ticksToLive : "none");
                console.log("Healer 2 in room ", healers.length > 1 ? healers[1].pos : "none", " has ticksToLive ", healers.length > 1 ? healers[1].ticksToLive : "none");
                

                console.log("Attacker 1 in room ", attackers.length > 0 ? attackers[0].name : "none", " has ticksToLive ", attackers.length > 0 ? attackers[0].ticksToLive : "none");
                //console 
                if (healers.length < 2 * attackers.length) {
                    var memory = { role: "healer", toGo: [bank.roomName], parts: powerhealerParts };
                    memory.role = "healer";
                    return { "memory": memory };
                }
            }

            // around 200 ticks
            const powerDelivererParts =
                [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE,
                    MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE,
                    CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY,
                    CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY,
                    CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY];

            console.log("Power bank in ", bank.roomName, " has delay ", delay, " ticks for deliverer to arrive");

            // each tick is roughly 1000 hits
            var extraDelivererDelay = 120;
            if (bank.hits > 1000 * (delay + extraDelivererDelay))
                continue;

            console.log("Spawning deliverer for power bank in ", 
                bank.roomName, " with delay ", delay, " ticks");
            
            var deliverers = _.filter(Game.creeps,
                c => c.memory.role == "deliverer" &&
                    c.memory.tag == "powerPickup+" + bank.roomName);


            var delivererSize = CARRY_CAPACITY * _.sum(powerDelivererParts, p => p == CARRY ? 1 : 0);

            if (deliverers.length < bank.power / delivererSize) {

                var memory = {
                    role: "deliverer",
                    toGo: [bank.roomName],
                    tag: "powerPickup+" + bank.roomName,
                    task: "pickupPower",
                    preferredSourceId: "nonexistent", // to trigger suicide on 2nd pickup
                    preferredTargetId: room.storage.id,
                    parts: powerDelivererParts
                };

                return { "memory": memory };
            }
        }
    }

};

module.exports = roomPowerHarvesting;