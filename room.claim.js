var roomClaiming = {
    roomGetSpawnOrders: function (requestedRooms) {

        // add safemode calculation threshold

        var roomsNotClaimed = _.filter(requestedRooms, roomName => {
            var room = Game.rooms[roomName];
            if (!room)
                return false; // need visibility first

            //console.log(roomName," controller is ", Game.rooms[roomName].controller.my);
            var mine = room.controller.my;
            var lvl = room.controller.level;
            //console.log(room.name, mine, lvl, CONTROLLER_DOWNGRADE[lvl] ,room.controller.ticksToDowngrade );
            if (room.controller.safeMode)
                return true;

            if (room.controller.my)
                return false;

            if (room.controller.ticksToDowngrade < CONTROLLER_DOWNGRADE[lvl] * 0.9)
                return false;

            return true;

        });

        var roomsNeedScout = _.filter(requestedRooms, roomName => {
            var room = Game.rooms[roomName];

            if (room) {
                // no need to scout owned rooms
                if (room.controller && room.controller.my)
                    return false;

                //  need to scout with agressive scout rooms with walls around controller
                var walls = room.controller.pos.findInRange(FIND_STRUCTURES, 1, { filter: s => s.structureType == STRUCTURE_WALL });
                if (walls.length > 0) {
                    room.memory.dangerous = true;
                    return true;
                }
                // need to scout rooms with owner different than us until it becomes neutral
                if (room.controller.owner && room.controller.username != "Zenga") {
                    // downgrade not yet ready need to wait
                    room.memory.dangerous = room.find(FIND_HOSTILE_CREEPS).length > 0;

                    room.memory.timeWhenDowngrade = Game.time + room.controller.ticksToDowngrade;
                    room.memory.ungradeBlockedUntil = Game.time + room.controller.upgradeBlocked;
                    return true;
                }

                return false;
            }

            return true;
        });


        //console.log("needScout", roomsNeedScout, "notClaimed", roomsNotClaimed);

        var spawnOrder = new Object();

        for (var i in requestedRooms) {
            var roomName = requestedRooms[i];
            var room = Game.rooms[roomName];

            var bigRooms = _.filter(Game.rooms,
                r => r.controller && r.controller.my && r.name != roomName &&
                    r.storage && r.storage.store.energy >= 10000);

            var sponsorRoom = _.min(bigRooms,
                r => Game.map.getRoomLinearDistance(r.name, roomName));

            if (sponsorRoom == undefined) {
                console.log("No sponsor room found for ", roomName);
                continue;
            }

            spawnOrder.sponsorRoomName = sponsorRoom.name;
            //console.log(bigRooms.map(r => r.name).join(", "));
            //console.log("sponsorRoom for ", roomName, " is ", sponsorRoom.name);
            var scouts = _.filter(Game.creeps, c => c.memory.role == "scout" &&
                (c.memory.toGo && c.memory.toGo[0] == roomName));
            var numScout = 1;

            if (roomsNeedScout.includes(roomName)) {
                if (scouts.length < numScout) {
                    spawnOrder.scoutRoom = roomName;
                    return spawnOrder;
                }
                continue; // to next room
            }

            var claimers = _.filter(Game.creeps, c => c.memory.role == "claim" && (c.memory.toGo && c.memory.toGo[0] == roomName));
            var numClaim = 1;
            if (roomsNotClaimed.includes(roomName) && claimers.length < numClaim) {
                spawnOrder.claimRoom = roomName;
                return spawnOrder;
            }

            var room = Game.rooms[roomName];
            if (!room)
                continue;

            if (!room.controller) // in what meaning? same as above? visibility check?
                continue;

            if (room.controller.safeMode) {
                console.log("room", roomName, " in safe mode for ", room.controller.safeModeCooldown);
                room.safeMode = room.controller.safeModeCooldown;
                continue;
            }

            // ok to build check condition
            if (!room.controller.my && room.controller.upgradeBlocked > 100) {
                console.log("room", roomName, " upgrade blocked for ", room.controller.upgradeBlocked);
                room.upgradeBlocked = room.controller.upgradeBlocked;
                continue;
            }
            // if(!room.controller.my)
            //   continue; 


            // build only spawns in remote rooms for now
            var roomSpawns = _.filter(Game.spawns, s => s.room.name == roomName);
            var spawnExists = roomSpawns.length > 0;
            if (spawnExists)
                continue;

            var constructionSites = room.find(FIND_CONSTRUCTION_SITES);
            var builders = _.filter(Game.creeps, c => c.memory.role == "builder" && (c.memory.toGo && c.memory.toGo[0] == roomName));
            var remoteBuildersLimit = 2;

            if (constructionSites.length > 0 && builders.length < remoteBuildersLimit) {
                console.log("needbuild external ", roomName);
                spawnOrder.buildRoom = roomName;
                return spawnOrder;
            }

            var enemyCreeps = room.find(FIND_HOSTILE_CREEPS);
            var enemyStructures = room.controller.pos.findInRange(FIND_STRUCTURES, 1, {
                filter: object => (
                    object.structureType == STRUCTURE_WALL)
            });
            var attackers = _.filter(Game.creeps, c => c.memory.role == "attack" && (c.memory.toGo && c.memory.toGo[0] == roomName));
            var numAttack = 1;

            if (enemyCreeps.length > 0 && attackers.length < numAttack) {
                console.log("needAttack", roomName);
                spawnOrder.attackRoom = roomName;
                return spawnOrder;
            }
        }
    }
};

module.exports = roomClaiming;