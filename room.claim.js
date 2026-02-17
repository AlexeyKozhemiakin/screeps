var roomClaiming = {
    roomGetSpawnOrders: function (requestedRooms) {

        // add safemode calculation threshold

        var roomsClaimed = _.filter(requestedRooms, roomName => {
            var room = Game.rooms[roomName];
            if (!room)
                return false ; // need visibility first

            if (room.controller.my)
                return true;

            return false;
        });

        //console.log("needScout", roomsNeedScout, "notClaimed", roomsNotClaimed);

        var spawnOrder = new Object();
        console.log("roomsNotClaimed ", requestedRooms.filter(r => !roomsClaimed.includes(r)));
        //console.log("requestedRooms ", requestedRooms);
        for (var i in requestedRooms) {
            var roomName = requestedRooms[i];

            // already claimed
            if(roomsClaimed.includes(roomName))
                continue;

            console.log("Processing claim for ", roomName);

            // todo - need to fix this to check dynamically
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

            var room = Game.rooms[roomName];

            if (!room) {

                var numScout = 1;

                var scouts = _.filter(Game.creeps, c => c.memory.role == "scout" &&
                    (c.memory.toGo && c.memory.toGo[0] == roomName));

                if (scouts.length < numScout) {
                    spawnOrder.scoutRoom = roomName;
                    return spawnOrder;
                }

                continue;
            }

            //  need to scout with agressive scout rooms with walls around controller
            var controllerWalls = room.controller.pos.findInRange(FIND_STRUCTURES, 1, { filter: s => s.structureType == STRUCTURE_WALL });
            var enemyCreeps = room.find(FIND_HOSTILE_CREEPS);
            var enemyStructures = room.find(FIND_STRUCTURES, {
                filter: object => (
                    object.structureType == STRUCTURE_INVADER_CORE)
            });

            var conquerFlag = room.find(FIND_FLAGS, { filter: f => f.name.includes("conquer") })[0];


            room.memory.dangerous = conquerFlag || enemyCreeps.length > 0 || enemyStructures.length > 0 || controllerWalls.length > 0;

            if (room.memory.dangerous) {
                var numAttack = 1;
                var attackers = _.filter(Game.creeps, c => c.memory.role == "attack" && (c.memory.toGo && c.memory.toGo[0] == roomName));

                if (attackers.length < numAttack) {
                    console.log("needAttack", roomName);
                    spawnOrder.attackRoom = roomName;
                    return spawnOrder;
                }
                
                continue;
            }

            if (room.controller.reservation && room.controller.reservation.ticksToEnd > 100)
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


            if (!roomsClaimed.includes(roomName)) {
                var claimers = _.filter(Game.creeps, c => c.memory.role == "claim" && (c.memory.toGo && c.memory.toGo[0] == roomName));
                var numClaim = 1;
                if (claimers.length < numClaim) {
                    spawnOrder.claimRoom = roomName;
                    return spawnOrder;
                }
                
                continue;
            }

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


        }
    }
};

module.exports = roomClaiming;