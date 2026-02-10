var utils = require("utils");
var roomPlanning = require("room.planning");
var roomRemoteHarvesting = {
    getOrder: function (parentRoom) {

        if (!parentRoom.config.remoteHarvest)
            return;

        var externalSources = [];
        for (let roomName of parentRoom.config.remoteHarvest) {
            var remoteRoom = Game.rooms[roomName];
            if (!remoteRoom)
                continue; // need reserve it?

            var remoteBuild = remoteRoom.find(FIND_CONSTRUCTION_SITES).length > 0;

             if (remoteBuild) {
                var remoteBuilders = _.filter(Game.creeps, c => c.memory.role == "builder" && c.memory.toGo && c.memory.toGo.includes(roomName));
                if (remoteBuilders.length == 0) {
                    return {"buildRoom": roomName};
                }

                
                continue;
            }
            var remoteSources = remoteRoom.find(FIND_SOURCES);

            if (remoteSources)
                externalSources = externalSources.concat(remoteSources);
        }


        for (let roomName of parentRoom.config.remoteHarvest) {
            var remoteRoom = Game.rooms[roomName];
            var needReserve = false;

            if (remoteRoom && remoteRoom.controller.reservation) {
                if (remoteRoom.controller.reservation.ticksToEnd < 1000) {
                    needReserve = true;
                }
            }
            else {
                needReserve = true;
            }

            var reservers = _.filter(Game.creeps,
                c => c.memory.role == "reserve" && c.memory.toGo &&
                    c.memory.toGo.includes(roomName));

            //console.log(room.name, needReserve, reservers);
            if (reservers.length == 0 && needReserve) {
                return {"reserveRoom": roomName}
            }

            if (!remoteRoom)
                continue;

            var sources = remoteRoom.find(FIND_SOURCES);

            for (var source of sources) {
                const sourceId = source.id;

                if (!source.container)
                {
                    roomPlanning.tryRoad(parentRoom.spawn, source, remoteRoom, 1, true);
                    
                    continue;
                }
                // Get all attached harvesters for this source
                var attachedCreeps = _.filter(Game.creeps, function (cr) {
                    return cr.memory.role == 'harvester' &&
                        cr.memory.preferredSourceId == sourceId;
                });

                if (attachedCreeps.length == 0) {
                    var memory = {
                        role: "harvester",
                        preferredSourceId: sourceId,
                        toGo: roomName
                    };

                    return {"memory": memory};
                }

                var amnt = SOURCE_ENERGY_CAPACITY / ENERGY_REGEN_TIME; // 3000/300 = 10 per sec
                
                var memory = utils.createDeliverer(source.container.id, parentRoom.storage.id, amnt, RESOURCE_ENERGY);
                
                if(memory){
                    return {"memory": memory};
                }
            }
        }


       
        for (let roomName of parentRoom.config.remoteHarvest) {
            var remoteRoom = Game.rooms[roomName];
            if (!remoteRoom)
                continue;

            var enemies = remoteRoom.find(FIND_HOSTILE_CREEPS,
                { filter: (c => c.getActiveBodyparts(ATTACK) > 0 || c.getActiveBodyparts(RANGED_ATTACK) && (c.owner.username != "")) });
            
            var attackers = _.filter(Game.creeps, 
                c => c.memory.role == "attack" &&
                    c.memory.toGo && c.memory.toGo.includes(roomName));

            remoteRoom.memory.dangerous = enemies.length > 0;
            if (enemies.length > 0 && attackers.length == 0) {
                var memory = {
                    role: "attack",
                    toGo: [roomName]
                };

                return {"memory": memory};
            }            
        }
        

    }
};

module.exports = roomRemoteHarvesting;